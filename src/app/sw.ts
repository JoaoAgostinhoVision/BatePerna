import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";
import { CACHE_ULTIMA_FICHA, CHAVE_ULTIMA, ehTileOsm, nuncaCachear } from "@/lib/cache-rotas";
import { ehCaminhoDeFicha } from "@/lib/despacho";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Assume o controle assim que baixa: service worker grudado servindo versão
  // velha é veneno, e é chato de desinstalar de um celular.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Placar do Fui e cron: só rede. Número velho é número inventado.
      matcher: ({ url }) => nuncaCachear(url.href),
      handler: new NetworkOnly(),
    },
    {
      // Tiles do mapa: o que já foi visto continua aparecendo na estrada.
      matcher: ({ url }) => ehTileOsm(url.href),
      handler: new CacheFirst({
        cacheName: "bp-tiles-osm",
        plugins: [
          // O mapa é <img> sem crossorigin, então a resposta vem opaca (status 0)
          // e o padrão do serwist recusa guardar — sem isto o cache fica vazio e
          // o mapa some offline. Preço: resposta opaca não deixa ver se deu erro,
          // e o browser cobra ela na cota com um padding gordo. Daí o teto baixo
          // de entradas: um punhado de fichas cabe, um álbum do Brasil não.
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },
    {
      // Páginas: rede primeiro, sempre. O cache é rede de segurança, não atalho.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "bp-paginas", networkTimeoutSeconds: 6 }),
    },
    ...defaultCache,
  ],
});

/** A resposta de rede pra uma navegação. Com navigationPreload o browser já
 *  disparou a requisição enquanto o service worker acordava; não consumir esse
 *  preload paga a viagem duas vezes numa rede que já é ruim. Nem todo browser
 *  o expõe (iOS antigo), daí a checagem antes de esperar. */
async function daRede(evento: FetchEvent): Promise<Response | null> {
  const preload: Response | null = evento.preloadResponse
    ? await evento.preloadResponse.catch(() => null)
    : null;
  return preload ?? (await fetch(evento.request).catch(() => null));
}

/** Guarda a ficha aberta e responde com ela quando faltar rede; e quando "/"
 *  abrir offline, responde com a última — o redirect de "/" precisa de
 *  servidor, e offline não há.
 *
 *  Cada ficha fica guardada sob a própria URL: offline, /trilha-a nunca pode
 *  responder com o conteúdo de /trilha-b. Errar de morro é pior que não abrir. */
self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.mode !== "navigate") return;
  const url = new URL(req.url);

  if (ehCaminhoDeFicha(url.pathname)) {
    evento.respondWith(
      (async () => {
        const resposta = await daRede(evento);
        if (resposta?.ok) {
          const sobNome = resposta.clone();
          const sobPonteiro = resposta.clone();
          // Sem await: a página começa a desenhar enquanto o corpo ainda desce.
          // waitUntil segura o service worker vivo até a gravação terminar.
          evento.waitUntil(
            caches.open(CACHE_ULTIMA_FICHA).then(async (cache) => {
              await cache.put(req, sobNome);
              // Ponteiro fixo pra "última": é o que "/" lê quando não há rede.
              await cache.put(CHAVE_ULTIMA, sobPonteiro);
            }),
          );
          return resposta;
        }
        // Rede caiu ou respondeu errado: vale a cópia guardada. Se nem isso,
        // devolve o erro de verdade — inventar "sem rede" esconde um 404.
        const guardada = await caches.match(req, { cacheName: CACHE_ULTIMA_FICHA });
        return guardada ?? resposta ?? Response.error();
      })(),
    );
    return;
  }

  if (url.pathname === "/") {
    evento.respondWith(
      (async () => {
        const resposta = await daRede(evento);
        if (resposta) return resposta;
        const cache = await caches.open(CACHE_ULTIMA_FICHA);
        return (await cache.match(CHAVE_ULTIMA)) ?? (await caches.match("/trilhas")) ?? Response.error();
      })(),
    );
  }
});

serwist.addEventListeners();
