import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheExpiration,
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";
import {
  AQUECIMENTO,
  CACHE_PAGINAS,
  CACHE_ULTIMA_FICHA,
  PRAZO_REDE_MS,
  aquecer,
  comPrazo,
  ehNavegacaoNossa,
  ehTileOsm,
  nuncaCachear,
  podeGuardarPagina,
  resolverNavegacao,
  tilePodeIrProCache,
} from "@/lib/cache-rotas";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const MES_EM_S = 60 * 60 * 24 * 30;

/** Tiles do mapa: o que já foi visto continua aparecendo na estrada. */
const tilesGuardados = new CacheFirst({
  cacheName: "bp-tiles-osm",
  plugins: [
    // O mapa é <img> sem crossorigin, então a resposta vem opaca (status 0)
    // e o padrão do serwist recusa guardar — sem isto o cache fica vazio e
    // o mapa some offline. Preço: resposta opaca não deixa ver se deu erro,
    // e o browser cobra ela na cota com um padding gordo. Daí o teto baixo
    // de entradas: um punhado de fichas cabe, um álbum do Brasil não.
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: MES_EM_S }),
  ],
});

/** 🔴 Os tiles do PAINEL só pela rede (Tarefa 11f, I7): o mapa de pôr o pin anda
 *  e aproxima, e os tiles dele despejariam do cache acima os das fichas que o
 *  dono guardou pra estrada. Ver `tilePodeIrProCache`. */
const tilesDoPainel = new NetworkOnly();

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
      // 🔴 Nada sob /admin pode virar cache -- em NENHUM cache, nem só na
      // navegação. Excluir o painel da NOSSA estratégia (podeGuardarPagina, na
      // rota abaixo) não bastava: request.mode !== "navigate" (uma chamada de
      // API do próprio painel, por exemplo) não passa por ehNavegacaoNossa nem
      // pela rota de baixo, e cai direto no catch-all "others" do spread do
      // serwist logo abaixo -- que é `sameOrigin && !pathname.startsWith("/api/")`,
      // e /admin bate nele igual a qualquer outra página. Achado em revisão
      // (2026-09-13): o painel acabava guardado do mesmo jeito, só que sob
      // outro nome de cache.
      //
      // A ordem AQUI é a defesa inteira: serwist casa em ordem de registro,
      // primeira rota que bater ganha. Por isso esta entra antes do spread --
      // mesma lógica do nuncaCachear pra /api/, uma linha acima. Há teste
      // lendo o ARQUIVO pra travar essa ordem (sw.ts não é importável), em
      // tests/app/sw.test.ts.
      matcher: ({ url }) => url.pathname.startsWith("/admin"),
      handler: new NetworkOnly(),
    },
    {
      // 🔴 /contribuir também nunca vira cache (07/10): é a tela de quem
      // manda um lugar, logada pelo Clerk — uma cópia guardada mostraria a
      // lista de uma pessoa a quem abrir o celular dela depois de sair, e
      // perguntas de um rascunho que já foi publicado. Mesma razão e mesmo
      // lugar do /admin, logo acima.
      matcher: ({ url }) => url.pathname.startsWith("/contribuir"),
      handler: new NetworkOnly(),
    },
    {
      // Tiles do mapa. A janela que pediu decide: a do painel vai só pela rede,
      // as outras pelo cache de sempre. O `Referer` não serve pra isso — pra
      // outra origem o navegador manda só a origem, sem o caminho —, e por isso
      // a pergunta é à JANELA (`clientId`).
      matcher: ({ url }) => ehTileOsm(url.href),
      handler: async (opcoes) => {
        const evento = opcoes.event as FetchEvent;
        const janela = evento.clientId ? await self.clients.get(evento.clientId) : undefined;
        return (tilePodeIrProCache(janela?.url) ? tilesGuardados : tilesDoPainel).handle(opcoes);
      },
    },
    {
      // As outras páginas (hoje só /trilhas): rede primeiro, cache como rede de
      // segurança. As fichas e a "/" NÃO passam por aqui — quem responde por
      // elas é o listener lá embaixo, e respondWith para a propagação do evento
      // antes de o roteador do serwist ver qualquer coisa. O painel de admin
      // também não bate aqui na prática (a rota dele, acima, já o intercepta
      // antes) — mas podeGuardarPagina fica como segunda trava, porque ele não
      // é parte do app offline (ver o comentário na própria função, em
      // cache-rotas.ts).
      matcher: ({ request, url }) =>
        request.mode === "navigate" && podeGuardarPagina(url.pathname),
      handler: new NetworkFirst({
        cacheName: CACHE_PAGINAS,
        networkTimeoutSeconds: PRAZO_REDE_MS / 1000,
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: MES_EM_S })],
      }),
    },
    ...defaultCache,
  ],
});

/** O cache das fichas é escrito à mão (não por estratégia), então o teto vem
 *  daqui. Sem teto ele cresceria pra sempre e, junto com o padding das
 *  respostas opacas dos tiles, empurraria o navegador a despejar justamente o
 *  que faz falta na estrada. */
const validadeDasFichas = new CacheExpiration(CACHE_ULTIMA_FICHA, {
  maxEntries: 12,
  maxAgeSeconds: MES_EM_S,
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

function guardar(evento: FetchEvent, chaves: string[], resposta: Response): void {
  // Clonar agora, síncrono, antes de a página começar a ler o corpo.
  const copias = chaves.map(() => resposta.clone());
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_ULTIMA_FICHA);
      for (const [i, chave] of chaves.entries()) {
        await cache.put(chave, copias[i]);
        await validadeDasFichas.updateTimestamp(chave);
      }
      await validadeDasFichas.expireEntries();
      // Cota cheia (o QuotaExceededError do iPhone) não pode derrubar a
      // navegação: a página já foi entregue. Ficar sem cópia dói offline,
      // amanhã — estourar aqui dói agora, e por nada.
    })().catch(() => undefined),
  );
}

/** Instalar o app e sair de casa sem nunca ter navegado dava tela de erro do
 *  navegador na serra — em standalone, sem barra de URL, um beco. Uma cópia da
 *  lista na instalação garante que a porta abre. Falhar aqui não pode impedir
 *  a instalação: sem rede neste instante, segue-se sem a cópia.
 *
 *  🔴 E DESDE 2026-09-11 AS FICHAS VÊM JUNTO, porque a porta abria numa sala de
 *  links mortos: o acervo listava as três trilhas e **nenhuma delas abria** sem
 *  rede, a não ser a que já tivesse sido visitada. Guardar a lista do que existe
 *  e nada do que ela lista é meio caminho — e meio caminho, na serra, é o mesmo
 *  que nada.
 *
 *  ⚠️ O CUSTO FOI MEDIDO, NÃO ESTIMADO (2026-09-11): as quatro páginas somam
 *  **20 KB comprimidos** no ar. O JS e o CSS já estavam no precache do build,
 *  então isto é só o HTML. Uma ressalva antiga dizia que aquecer as fichas
 *  "gasta os dados dele" — gasta menos que uma foto pequena, e é o que faz o
 *  app funcionar onde ele foi feito pra funcionar.
 *
 *  A lista sai da PRÓPRIA `/trilhas` recém-baixada, e não de um arquivo gerado:
 *  assim ela não tem como discordar do que a tela mostra. Ver `fichasDoAcervo`.
 *
 *  Cada ficha falha sozinha: `allSettled`, e sem rede pra uma delas as outras
 *  continuam. Nada aqui pode impedir a instalação. */
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      await aquecer({
        origem: self.location.origin,
        buscar: async (caminho) => {
          const r = await fetch(caminho, { cache: "no-store" }).catch(() => null);
          return r?.ok ? r : null;
        },
        gravar: async ({ chave, cache: nome }, resposta) => {
          await (await caches.open(nome)).put(chave, resposta);
          // Só o cache das fichas tem relógio próprio; o das páginas é
          // governado pelo ExpirationPlugin da estratégia lá em cima.
          if (nome === CACHE_ULTIMA_FICHA) await validadeDasFichas.updateTimestamp(chave);
        },
      });
      await validadeDasFichas.expireEntries();
    })().catch(() => undefined),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.mode !== "navigate") return;
  if (!ehNavegacaoNossa(new URL(req.url).pathname)) return;

  evento.respondWith(
    (async () => {
      const { resposta, gravarEm, apagarEm } = await resolverNavegacao({
        url: req.url,
        // O prazo é o coração disto: offline a rede falha na hora, mas com uma
        // barra de sinal ela pendura, e sem prazo a ficha já guardada no
        // celular nunca chega à tela.
        buscarRede: () => comPrazo(daRede(evento), PRAZO_REDE_MS, null),
        buscarCache: async ({ chave, cache, ignorarBusca }) =>
          (await caches.match(chave, { cacheName: cache, ignoreSearch: ignorarBusca })) ?? null,
      });

      if (resposta && gravarEm.length > 0) guardar(evento, gravarEm, resposta);
      // 🔴 A cópia de uma URL que respondeu 404 ou redirect SAI do cache (Tarefa
      // 11e, C2) — e com ela o ponteiro da última, se era ela, e a `/trilhas`
      // guardada (onda de fix, I2): sem isto, o lugar escondido continuaria
      // abrindo offline. Cada alvo no SEU cache. ⚠️ É a única linha desta decisão
      // sem prova em teste: este arquivo não é importável (arrasta o serwist); a
      // decisão de O QUE apagar está em `resolverNavegacao`, e esta foi medida
      // no Chrome com o service worker ativo.
      if (apagarEm.length > 0) {
        evento.waitUntil(
          (async () => {
            for (const { chave, cache: nome, ignorarBusca } of apagarEm) {
              await (await caches.open(nome)).delete(chave, { ignoreSearch: ignorarBusca ?? false });
            }
          })().catch(() => undefined),
        );
      }
      return resposta ?? Response.error();
    })(),
  );
});

serwist.addEventListeners();
