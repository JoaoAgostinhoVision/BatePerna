import { describe, expect, it } from "vitest";
import {
  type AlvoCache,
  CACHE_PAGINAS,
  CACHE_ULTIMA_FICHA,
  CHAVE_ULTIMA,
  chavesDeGravacao,
  comPrazo,
  ehNavegacaoNossa,
  ehTileOsm,
  nuncaCachear,
  resolverNavegacao,
} from "@/lib/cache-rotas";

const FICHA = "https://bateperna.vercel.app/rampa-do-pepe";
const OUTRA = "https://bateperna.vercel.app/monte-das-tabocas";
const RAIZ = "https://bateperna.vercel.app/";

function resposta(status = 200): Response {
  return new Response("<html>ficha</html>", { status });
}

/** Um cache de mentira que anota tudo que perguntaram — é o que deixa os
 *  testes afirmarem onde o resolvedor NÃO foi procurar. */
function cacheFalso(conteudo: Record<string, Response> = {}) {
  const perguntas: AlvoCache[] = [];
  return {
    perguntas,
    chavesPerguntadas: () => perguntas.map((a) => a.chave),
    buscar: async (alvo: AlvoCache) => {
      perguntas.push(alvo);
      return conteudo[alvo.chave] ?? null;
    },
  };
}

const semRede = async () => null;

describe("ehTileOsm", () => {
  it("reconhece tile do OSM", () => {
    expect(ehTileOsm("https://tile.openstreetmap.org/12/1234/2345.png")).toBe(true);
  });

  it("não confunde com a própria página", () => {
    expect(ehTileOsm(FICHA)).toBe(false);
  });
});

describe("nuncaCachear", () => {
  it("placar do Fui nunca vem do cache — número velho é número inventado", () => {
    expect(nuncaCachear("https://bateperna.vercel.app/api/confirmar?slug=rampa-do-pepe")).toBe(true);
  });

  it("o cron também não", () => {
    expect(nuncaCachear("https://bateperna.vercel.app/api/cron/motor")).toBe(true);
  });

  it("a ficha pode ser cacheada", () => {
    expect(nuncaCachear(FICHA)).toBe(false);
  });
});

describe("CACHE_ULTIMA_FICHA", () => {
  it("tem nome próprio pra poder ser limpo sozinho", () => {
    expect(CACHE_ULTIMA_FICHA).toMatch(/^bp-/);
  });
});

describe("ehNavegacaoNossa", () => {
  it("a ficha e a raiz são resolvidas por nós", () => {
    expect(ehNavegacaoNossa("/rampa-do-pepe")).toBe(true);
    expect(ehNavegacaoNossa("/")).toBe(true);
  });

  it("a lista e os ícones ficam com as estratégias do serwist", () => {
    expect(ehNavegacaoNossa("/trilhas")).toBe(false);
    expect(ehNavegacaoNossa("/icones/192")).toBe(false);
  });
});

describe("chavesDeGravacao", () => {
  it("grava sob o nome da ficha e sob o ponteiro da última", () => {
    expect(chavesDeGravacao(FICHA)).toEqual([FICHA, CHAVE_ULTIMA]);
  });

  it("descarta a query — link do WhatsApp não pode virar entrada nova", () => {
    expect(chavesDeGravacao(`${FICHA}?fbclid=abc123`)).toEqual([FICHA, CHAVE_ULTIMA]);
  });
});

describe("comPrazo", () => {
  it("devolve o combinado quando a espera estoura", async () => {
    const pendurada = new Promise<string>(() => {});
    await expect(comPrazo(pendurada, 10, "estourou")).resolves.toBe("estourou");
  });

  it("devolve o valor quando chega a tempo", async () => {
    await expect(comPrazo(Promise.resolve("chegou"), 10_000, "estourou")).resolves.toBe("chegou");
  });
});

describe("resolverNavegacao: ficha", () => {
  it("rede boa vence e manda gravar nas duas chaves", async () => {
    const daRede = resposta();
    const cache = cacheFalso();
    const r = await resolverNavegacao({
      url: FICHA,
      buscarRede: async () => daRede,
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(daRede);
    expect(r.gravarEm).toEqual([FICHA, CHAVE_ULTIMA]);
    expect(cache.chavesPerguntadas()).toEqual([]);
  });

  it("sem rede, NUNCA procura o ponteiro da última — morro errado é pior que morro nenhum", async () => {
    const cache = cacheFalso({ [CHAVE_ULTIMA]: resposta() });
    const r = await resolverNavegacao({ url: OUTRA, buscarRede: semRede, buscarCache: cache.buscar });

    expect(cache.chavesPerguntadas()).toEqual([OUTRA]);
    expect(cache.chavesPerguntadas()).not.toContain(CHAVE_ULTIMA);
    expect(r.resposta).toBeNull();
  });

  it("sem rede, serve a cópia da própria ficha", async () => {
    const guardada = resposta();
    const cache = cacheFalso({ [FICHA]: guardada });
    const r = await resolverNavegacao({ url: FICHA, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(guardada);
    expect(r.gravarEm).toEqual([]);
    expect(cache.perguntas[0].cache).toBe(CACHE_ULTIMA_FICHA);
  });

  it("link compartilhado com ?fbclid acha a cópia guardada", async () => {
    const guardada = resposta();
    const cache = cacheFalso({ [FICHA]: guardada });
    const r = await resolverNavegacao({
      url: `${FICHA}?fbclid=abc123`,
      buscarRede: semRede,
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(guardada);
    expect(cache.perguntas[0].ignorarBusca).toBe(true);
  });

  it("404 sem cópia devolve o 404 de verdade, não um erro de rede inventado", async () => {
    const naoAchou = resposta(404);
    const cache = cacheFalso();
    const r = await resolverNavegacao({
      url: FICHA,
      buscarRede: async () => naoAchou,
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(naoAchou);
    expect(r.gravarEm).toEqual([]);
  });

  it("resposta ruim não é gravada por cima da cópia boa", async () => {
    const guardada = resposta();
    const cache = cacheFalso({ [FICHA]: guardada });
    const r = await resolverNavegacao({
      url: FICHA,
      buscarRede: async () => resposta(500),
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(guardada);
    expect(r.gravarEm).toEqual([]);
  });
});

describe("resolverNavegacao: raiz", () => {
  it("com rede devolve o que veio, mesmo sendo o redirect, e não grava", async () => {
    const redirect = new Response(null, { status: 307 });
    const cache = cacheFalso();
    const r = await resolverNavegacao({
      url: RAIZ,
      buscarRede: async () => redirect,
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(redirect);
    expect(r.gravarEm).toEqual([]);
  });

  it("sem rede cai na última ficha", async () => {
    const ultima = resposta();
    const cache = cacheFalso({ [CHAVE_ULTIMA]: ultima });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(ultima);
    expect(cache.perguntas[0]).toMatchObject({ chave: CHAVE_ULTIMA, cache: CACHE_ULTIMA_FICHA });
  });

  it("sem última ficha, cai na lista guardada pelo serwist", async () => {
    const lista = resposta();
    const cache = cacheFalso({ "/trilhas": lista });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(lista);
    expect(cache.perguntas[1]).toMatchObject({ chave: "/trilhas", cache: CACHE_PAGINAS });
  });

  it("sem nada guardado, não inventa resposta", async () => {
    const cache = cacheFalso();
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBeNull();
  });
});
