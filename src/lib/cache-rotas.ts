import { ehCaminhoDeFicha } from "@/lib/despacho";

/** Onde as fichas navegadas com sucesso ficam guardadas — cada uma sob a
 *  própria URL, mais uma cópia sob CHAVE_ULTIMA. Cache com nome próprio pra
 *  poder ser limpo sozinho, sem levar junto o precache do build. */
export const CACHE_ULTIMA_FICHA = "bp-ultima-ficha";

/** Onde o serwist guarda as outras páginas (hoje só /trilhas). */
export const CACHE_PAGINAS = "bp-paginas";

/** O espelho offline do cookie bp_ultima: o service worker não lê cookie,
 *  então guarda a última ficha também sob esta chave fixa — e é ela que
 *  responde quando "/" abre sem rede, já que o redirect precisa de servidor. */
export const CHAVE_ULTIMA = "/__ultima__";

/** Quanto esperar a rede antes de servir a cópia guardada.
 *
 *  Não é sobre estar offline — offline o fetch falha na hora. É sobre uma
 *  barra de sinal na estrada de serra, onde o TCP não falha: ele pendura. Sem
 *  prazo, o usuário fica olhando tela em branco com a ficha inteira já
 *  guardada no celular dele. */
export const PRAZO_REDE_MS = 6_000;

/** Um lugar pra procurar quando a rede não serve. */
export interface AlvoCache {
  /** URL (ou chave fixa, no caso do ponteiro) a procurar. */
  chave: string;
  /** Em qual cache nomeado — nunca uma varredura geral. */
  cache: string;
  /** Ignorar a query na comparação. Continua exigindo o caminho igual. */
  ignorarBusca?: boolean;
}

export interface PedidoNavegacao {
  /** URL completa da navegação. */
  url: string;
  /** A rede, com prazo já aplicado. null = não veio nada. */
  buscarRede: () => Promise<Response | null>;
  /** O cache, alvo por alvo. null = não tem. */
  buscarCache: (alvo: AlvoCache) => Promise<Response | null>;
}

export interface Resolucao {
  /** O que devolver. null = não há nada; quem chama vira isso em erro de rede. */
  resposta: Response | null;
  /** Chaves onde gravar, todas em CACHE_ULTIMA_FICHA. Vazio = não grava. */
  gravarEm: string[];
}

export function ehTileOsm(url: string): boolean {
  return new URL(url).hostname === "tile.openstreetmap.org";
}

/** Placar e cron nunca saem do cache. O resto da ficha é verdade parada;
 *  o placar não é. */
export function nuncaCachear(url: string): boolean {
  return new URL(url).pathname.startsWith("/api/");
}

/** As navegações que o service worker resolve por conta própria: as fichas e
 *  a "/". O resto (a lista, os ícones) fica com as estratégias do serwist. */
export function ehNavegacaoNossa(pathname: string): boolean {
  // CHAVE_ULTIMA é chave de cache, não rota — mas tem cara de slug (um
  // segmento, sem ponto), então ehCaminhoDeFicha a aprovaria. Sem esta linha,
  // /__ultima__ na barra vira navegação nossa, o 404 da rede não é ok, a busca
  // no cache acha o ponteiro, e a URL responde com o corpo da última ficha.
  if (pathname === CHAVE_ULTIMA) return false;
  return pathname === "/" || ehCaminhoDeFicha(pathname);
}

/** A URL da ficha sem a query.
 *
 *  Link compartilhado no WhatsApp ou no Instagram chega com ?fbclid=... colado.
 *  Guardar com a query faria cada compartilhamento virar entrada nova — e, pior,
 *  o mesmo morro com outro parâmetro daria "não encontrado" offline. */
function chaveDeFicha(url: string): string {
  const u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.href;
}

/** Onde uma ficha recém-baixada é gravada: sob o próprio nome e sob o ponteiro
 *  da última. As duas chaves, sempre juntas. */
export function chavesDeGravacao(url: string): string[] {
  return [chaveDeFicha(url), CHAVE_ULTIMA];
}

/** Espera a promessa, mas até um prazo. Estourou, devolve o combinado. */
export function comPrazo<T>(promessa: Promise<T>, ms: number, aoEstourar: T): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const relogio = new Promise<T>((ok) => {
    id = setTimeout(() => ok(aoEstourar), ms);
  });
  return Promise.race([promessa, relogio]).finally(() => clearTimeout(id));
}

/** A cópia que o service worker busca já na instalação.
 *
 *  Sem ela, instalar e sair sem nunca ter navegado deixava o app abrindo na
 *  tela de erro do navegador — e em standalone, sem barra de URL, isso é um
 *  beco: não dá nem pra digitar outro endereço. A lista é a porta que sempre
 *  abre. É a mesma entrada que planoDaRaiz procura, de propósito: aquecer uma
 *  coisa e procurar outra seria trabalho jogado fora. */
export const AQUECIMENTO: AlvoCache = { chave: "/trilhas", cache: CACHE_PAGINAS };

/** Onde procurar quando "/" abre sem rede: a última ficha e, se nem isso, a
 *  lista que o serwist guardou (ou que aquecemos na instalação). */
export function planoDaRaiz(): AlvoCache[] {
  return [{ chave: CHAVE_ULTIMA, cache: CACHE_ULTIMA_FICHA }, AQUECIMENTO];
}

/** Onde procurar quando uma ficha abre sem rede: SÓ ela mesma.
 *
 *  Nunca o ponteiro da última. Offline, /trilha-a respondendo com o corpo de
 *  /trilha-b mostraria nome, trajeto e carimbo do morro errado — e o app existe
 *  justamente pra dizer se dá pra subir aquele morro ali. Não abrir é ruim;
 *  abrir errado é perigoso. */
function alvoDaFicha(url: string): AlvoCache {
  return { chave: chaveDeFicha(url), cache: CACHE_ULTIMA_FICHA, ignorarBusca: true };
}

async function primeiroQueTiver(
  buscarCache: PedidoNavegacao["buscarCache"],
  alvos: AlvoCache[],
): Promise<Response | null> {
  for (const alvo of alvos) {
    const achado = await buscarCache(alvo);
    if (achado) return achado;
  }
  return null;
}

/** A decisão inteira de uma navegação, sem tocar em Cache nem em fetch: quem
 *  chama entrega as buscas e recebe o que devolver e onde gravar.
 *
 *  Pré-condição: só vale pra URL que passou por ehNavegacaoNossa. */
export async function resolverNavegacao({
  url,
  buscarRede,
  buscarCache,
}: PedidoNavegacao): Promise<Resolucao> {
  const daRede = await buscarRede();

  if (new URL(url).pathname === "/") {
    // "/" é redirect de servidor: qualquer resposta serve, inclusive o 307.
    // Não se grava — o que vale guardar é a ficha pra onde ele aponta.
    if (daRede) return { resposta: daRede, gravarEm: [] };
    return { resposta: await primeiroQueTiver(buscarCache, planoDaRaiz()), gravarEm: [] };
  }

  if (daRede?.ok) return { resposta: daRede, gravarEm: chavesDeGravacao(url) };

  // Rede caiu ou respondeu errado. Sem cópia desta ficha, devolve o erro de
  // verdade — inventar "sem rede" esconderia um 404.
  const guardada = await buscarCache(alvoDaFicha(url));
  return { resposta: guardada ?? daRede, gravarEm: [] };
}
