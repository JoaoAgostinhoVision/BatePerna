import { ehCaminhoDeFicha } from "@/lib/despacho";

/** Onde as fichas navegadas com sucesso ficam guardadas — cada uma sob a
 *  própria URL, mais uma cópia sob CHAVE_ULTIMA. Cache com nome próprio pra
 *  poder ser limpo sozinho, sem levar junto o precache do build. */
export const CACHE_ULTIMA_FICHA = "bp-ultima-ficha";

/** Onde o serwist guarda as outras páginas (hoje só /trilhas). */
export const CACHE_PAGINAS = "bp-paginas";

/** O ponteiro do service worker pra última ficha aberta: ele não lê cookie
 *  nenhum (isto não é o espelho de nada) — guarda a ficha também sob esta
 *  chave fixa, e é ela que responde quando "/" abre sem rede e sem acervo
 *  guardado. */
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

/** O NOME DO PARÂMETRO QUE FORÇA O ESTADO DO CARIMBO.
 *
 *  Ele é ferramenta dele — `?debug=frio` é como se confere no celular uma cor
 *  que só aparece na primeira chuva. Mora aqui porque quem precisa saber que a
 *  navegação é forçada é o service worker, e `carimbo-estado.ts` (que a lê)
 *  arrasta o motor e o clima, que não podem entrar no bundle do worker. Há
 *  teste amarrando os dois nomes. */
export const PARAM_DEBUG = "debug";

/** Esta navegação carrega um estado FORÇADO?
 *
 *  🔴 O DEFEITO QUE ISTO FECHA, medido no navegador em 2026-09-11. A ficha da
 *  Véu estava guardada com o estado real (`cuidado`, "Vá com cuidado"). **Uma**
 *  visita a `/veu-de-noiva-de-bonito?debug=fresco` reescreveu a cópia guardada
 *  **sob a URL LIMPA** — e o ponteiro da última ficha junto — com um "Pode ir".
 *  A partir dali, offline, aquela trilha dizia que dava pra ir. Numa serra sem
 *  sinal, o app mandando subir num barro molhado.
 *
 *  A causa é uma boa decisão encontrando outra: `chaveDeFicha` tira a query de
 *  propósito (link do WhatsApp chega com `?fbclid=` colado, e sem isso cada
 *  compartilhamento viraria entrada nova). Só que ela tira TODA query — e a do
 *  debug não é ruído de rede social, é conteúdo diferente.
 *
 *  A saída é a mais conservadora: **presença do parâmetro basta pra não
 *  gravar.** Um `?debug=qualquercoisa` hoje não força estado nenhum e seria
 *  seguro guardar — mas amarrar a regra aos valores de hoje deixaria o guarda
 *  cego ao dia em que um valor novo aparecer. Servir continua servindo: ele
 *  precisa VER o que forçou. O que não pode é isso virar memória. */
export function ehNavegacaoForcada(url: string): boolean {
  return new URL(url).searchParams.has(PARAM_DEBUG);
}

/** É um tile do mapa?
 *
 *  🔴 SERVE SÓ PRA A ESTRATÉGIA DE RE-VISITA em `sw.ts`, e nunca pra aquecer.
 *  A Tile Usage Policy do OSM proíbe "prefetch features" e "any background job
 *  that fetches tiles a user is not currently viewing" — pelo PADRÃO, não pelo
 *  volume. Guardar o que a pessoa JÁ VIU é a outra metade da mesma política, e
 *  essa é permitida. A razão inteira, com as citações e o custo medido, está no
 *  guarda que trava isto: "o aquecimento NUNCA busca tile", em
 *  tests/lib/cache-rotas.test.ts. */
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
export function chaveDeFicha(url: string): string {
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

/** 🔴 QUANTAS FICHAS CABEM NO AQUECIMENTO, e o número não é meu: é o
 *  `maxEntries` do `CacheExpiration` que governa o `CACHE_ULTIMA_FICHA` em
 *  `sw.ts`. Aquecer mais fichas do que o cache guarda faria a instalação
 *  baixar páginas pra despejá-las na linha seguinte — trabalho e dados
 *  gastos por nada, e o pior tipo: invisível.
 *
 *  Há teste cravando os dois números juntos; se um mudar sem o outro, ele cai. */
export const TETO_AQUECIMENTO = 12;

/** As fichas que existem, lidas da PÁGINA DO ACERVO que o instalador acabou de
 *  baixar.
 *
 *  🔴 POR QUE DAQUI, E NÃO DE UMA LISTA: o service worker não pode ler
 *  `content/fichas/` (nada de `node:fs` no bundle do worker), e gerar um
 *  arquivo de slugs no build criaria uma SEGUNDA fonte do acervo — a espécie
 *  "guarda que enumera o acervo à mão é cego a ele crescer", que este projeto
 *  já pagou. Lendo os links da própria `/trilhas`, a lista de aquecimento
 *  **não tem como discordar do que a tela mostra**: ela É o que a tela mostra.
 *
 *  Cada candidato ainda passa por `ehCaminhoDeFicha` — o HTML tem outros
 *  `href` (a barra de navegação, o ícone), e aquecer "/" seria gravar veredito
 *  de chuva, que é a coisa que `resolverNavegacao` recusa em todos os ramos. */
export function fichasDoAcervo(html: string): string[] {
  const vistos = new Set<string>();
  for (const [, caminho] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    if (ehCaminhoDeFicha(caminho)) vistos.add(caminho);
  }
  return [...vistos].slice(0, TETO_AQUECIMENTO);
}

/** Onde procurar quando "/" abre sem rede.
 *
 *  O acervo primeiro, a última ficha depois — invertido de propósito quando "/"
 *  deixou de ser despachante e virou a home. Você toca no ícone esperando a
 *  tela de casa; cair dentro de uma trilha específica, que pode nem ser a que
 *  você queria, confunde mais do que ajuda. O acervo é a versão honesta da home
 *  quando não há clima pra ler: mostra o que existe e não finge veredito.
 *
 *  A última ficha continua guardada e continua abrindo pela URL dela. */
export function planoDaRaiz(): AlvoCache[] {
  return [AQUECIMENTO, { chave: CHAVE_ULTIMA, cache: CACHE_ULTIMA_FICHA }];
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
    // A home é veredito do momento: guardada, viraria "pode subir" de três
    // horas atrás com cara de agora. Nunca se grava — em nenhum ramo abaixo,
    // nem quando a resposta é boa.
    //
    // Só a resposta OK passa direto. Um 5xx transitório não pode aparecer cru
    // com o acervo guardado bem ali do lado — "/" é a porta do app agora, não
    // um redirect de servidor. Sem cópia guardada nenhuma, a resposta de rede
    // (o erro de verdade) ainda é melhor que inventar um null.
    if (daRede?.ok) return { resposta: daRede, gravarEm: [] };
    const guardada = await primeiroQueTiver(buscarCache, planoDaRaiz());
    return { resposta: guardada ?? daRede, gravarEm: [] };
  }

  // 🔴 ESTADO FORÇADO NUNCA VIRA MEMÓRIA. Ver `ehNavegacaoForcada`: servir,
  // sim — ele precisa ver o que pediu. Gravar, nunca: a cópia iria parar sob a
  // URL limpa e mentiria offline por tempo indeterminado.
  if (daRede?.ok) {
    return { resposta: daRede, gravarEm: ehNavegacaoForcada(url) ? [] : chavesDeGravacao(url) };
  }

  // Rede caiu ou respondeu errado. Sem cópia desta ficha, devolve o erro de
  // verdade — inventar "sem rede" esconderia um 404.
  const guardada = await buscarCache(alvoDaFicha(url));
  return { resposta: guardada ?? daRede, gravarEm: [] };
}

/** A IO que o aquecimento precisa, entregue por quem chama. Mesmo desenho do
 *  `PedidoNavegacao`: este módulo decide, o service worker toca em `fetch` e
 *  em `caches`. */
export interface PedidoAquecimento {
  /** Busca uma página. null = não veio nada, e o aquecimento segue sem ela. */
  buscar: (caminho: string) => Promise<Response | null>;
  /** Grava uma resposta sob uma chave, num cache nomeado. */
  gravar: (alvo: AlvoCache, resposta: Response) => Promise<void>;
  /** A origem do app, pra montar a chave absoluta das fichas. */
  origem: string;
}

/** O AQUECIMENTO INTEIRO: a lista do acervo mais as fichas que ela lista.
 *
 *  🔴 POR QUE ISTO MORA AQUI, e não solto dentro do `install` do sw.ts: a
 *  primeira versão desta rodada (2026-09-11) pôs a orquestração no listener, e
 *  a medição de mutação mostrou o buraco — **apagar a busca das fichas, ou
 *  gravá-las também sob CHAVE_ULTIMA, deixava a suíte inteira verde.** O
 *  `sw.ts` não é importável em teste (arrasta o serwist), então tudo que mora
 *  lá é código sem prova. Mesma razão pela qual `resolverNavegacao` já existia
 *  neste arquivo em vez de dentro do listener de `fetch`.
 *
 *  Devolve os caminhos guardados, em ordem, pra quem chama poder contar.
 *
 *  ⚠️ NUNCA GRAVA SOB `CHAVE_ULTIMA`, e é a linha que mais importa aqui:
 *  aquecer não é abrir. O ponteiro da última ficha é memória do que a PESSOA
 *  escolheu ver, e enchê-lo na instalação faria "/" offline abrir numa trilha
 *  que ninguém pediu — `planoDaRaiz` o consulta.
 *
 *  Cada ficha falha sozinha: sem rede pra uma delas, as outras continuam. */
export async function aquecer({ buscar, gravar, origem }: PedidoAquecimento): Promise<string[]> {
  const pagina = await buscar(AQUECIMENTO.chave);
  if (!pagina) return [];

  // Clonar ANTES de ler o corpo: o texto abaixo o consome, e o que vai pro
  // cache tem que ser a resposta inteira.
  const paraCache = pagina.clone();
  const html = await pagina.text().catch(() => "");
  await gravar(AQUECIMENTO, paraCache);

  const guardadas: string[] = [];
  await Promise.allSettled(
    fichasDoAcervo(html).map(async (caminho) => {
      const r = await buscar(caminho);
      if (!r) return;
      await gravar(
        { chave: chaveDeFicha(new URL(caminho, origem).href), cache: CACHE_ULTIMA_FICHA },
        r,
      );
      guardadas.push(caminho);
    }),
  );
  return guardadas;
}
