import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AlvoCache,
  AQUECIMENTO,
  CACHE_PAGINAS,
  CACHE_ULTIMA_FICHA,
  CHAVE_ULTIMA,
  chavesDeGravacao,
  comPrazo,
  ehNavegacaoNossa,
  ehTileOsm,
  nuncaCachear,
  planoDaRaiz,
  podeGuardarPagina,
  resolverNavegacao,
  aquecer,
  fichasDoAcervo,
  PARAM_DEBUG,
  TETO_AQUECIMENTO,
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

  it("o ponteiro interno não é rota", () => {
    // CHAVE_ULTIMA tem cara de slug (um segmento, sem ponto). Sem excluí-la,
    // /__ultima__ digitado na barra vira "navegação nossa", o 404 da rede não é
    // ok, e a busca no cache acha o ponteiro — a URL responderia com o corpo da
    // última ficha aberta. É a mesma classe de defeito que fechamos offline.
    expect(ehNavegacaoNossa(CHAVE_ULTIMA)).toBe(false);
  });
});

describe("podeGuardarPagina", () => {
  // 🔴 O painel nao e parte do app offline. Guardar tela de admin no celular
  // e superficie de risco sem nada em troca — offline ele nao funciona mesmo,
  // porque toda acao dele e uma escrita no servidor.
  it("o painel de admin nunca e guardado", () => {
    expect(podeGuardarPagina("/admin")).toBe(false);
    expect(podeGuardarPagina("/admin/qualquer-coisa")).toBe(false);
  });

  it("e as paginas de verdade continuam sendo", () => {
    expect(podeGuardarPagina("/trilhas")).toBe(true);
    expect(podeGuardarPagina("/")).toBe(true);
  });
});

describe("AQUECIMENTO", () => {
  it("o que é aquecido na instalação é exatamente onde a raiz vai procurar", () => {
    // Aquecer uma entrada e procurar outra seria download jogado fora — e o
    // beco de abrir o app instalado offline continuaria aberto.
    expect(planoDaRaiz()).toContain(AQUECIMENTO);
  });

  it("a raiz procura o acervo antes da última ficha", () => {
    // A ordem é a resposta: "/" é a home agora, não despachante — o acervo é
    // a versão honesta dela quando não há clima pra ler.
    expect(planoDaRaiz()[0].chave).toBe(AQUECIMENTO.chave);
  });
});

describe("planoDaRaiz: ordem invertida (home antes de despachante)", () => {
  it("offline, '/' procura o acervo ANTES da última ficha", () => {
    const [primeiro, segundo] = planoDaRaiz();
    expect(primeiro).toEqual(AQUECIMENTO);
    expect(segundo.chave).toBe(CHAVE_ULTIMA);
  });

  it("a home nunca é gravada, mesmo respondendo 200 — veredito guardado é veredito velho", async () => {
    const { gravarEm } = await resolverNavegacao({
      url: "https://bateperna.vercel.app/",
      buscarRede: async () => new Response("<html>a home</html>", { status: 200 }),
      buscarCache: async () => null,
    });
    expect(gravarEm).toEqual([]);
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
  it("com rede boa (200) devolve o que veio, e não grava", async () => {
    const ok = resposta(200);
    const cache = cacheFalso();
    const r = await resolverNavegacao({
      url: RAIZ,
      buscarRede: async () => ok,
      buscarCache: cache.buscar,
    });

    expect(r.resposta).toBe(ok);
    expect(r.gravarEm).toEqual([]);
    expect(cache.chavesPerguntadas()).toEqual([]);
  });

  it("sem acervo guardado, cai na última ficha", async () => {
    const ultima = resposta();
    const cache = cacheFalso({ [CHAVE_ULTIMA]: ultima });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(ultima);
    expect(cache.perguntas[0]).toMatchObject({ chave: AQUECIMENTO.chave, cache: CACHE_PAGINAS });
    expect(cache.perguntas[1]).toMatchObject({ chave: CHAVE_ULTIMA, cache: CACHE_ULTIMA_FICHA });
  });

  it("sem rede, cai direto no acervo guardado pelo serwist", async () => {
    const lista = resposta();
    const cache = cacheFalso({ "/trilhas": lista });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(lista);
    expect(cache.perguntas[0]).toMatchObject({ chave: "/trilhas", cache: CACHE_PAGINAS });
  });

  it("sem nada guardado, não inventa resposta", async () => {
    const cache = cacheFalso();
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBeNull();
  });

  it("os dois caches presentes ao mesmo tempo: o acervo vence, não a última ficha", async () => {
    // O estado mais realista de quem já navegou antes e teve o acervo
    // aquecido na instalação — os dois estão guardados, e é exatamente aí que
    // a inversão desta rodada precisa se provar: "/" é a home agora, não
    // despachante pra última trilha aberta.
    const lista = resposta();
    const ultima = resposta();
    const cache = cacheFalso({ "/trilhas": lista, [CHAVE_ULTIMA]: ultima });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: semRede, buscarCache: cache.buscar });

    expect(r.resposta).toBe(lista);
    expect(r.resposta).not.toBe(ultima);
  });

  it("5xx com acervo guardado ao lado cai no acervo, não mostra o erro cru", async () => {
    // "/" deixou de ser um redirect de servidor — hoje é a porta do app. Um
    // 500 transitório com o celular online não pode aparecer cru quando o
    // acervo está guardado bem ali do lado.
    const erro = resposta(500);
    const lista = resposta();
    const cache = cacheFalso({ "/trilhas": lista, [CHAVE_ULTIMA]: resposta() });
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: async () => erro, buscarCache: cache.buscar });

    expect(r.resposta).toBe(lista);
    expect(r.resposta).not.toBe(erro);
    expect(r.gravarEm).toEqual([]);
  });

  it("5xx sem nada guardado devolve a resposta de rede — o erro real, melhor que nada", async () => {
    const erro = resposta(500);
    const cache = cacheFalso();
    const r = await resolverNavegacao({ url: RAIZ, buscarRede: async () => erro, buscarCache: cache.buscar });

    expect(r.resposta).toBe(erro);
    expect(r.gravarEm).toEqual([]);
  });
});

// 🔴 O DEFEITO QUE ESTE BLOCO TRANCA (2026-09-11). O instalador guardava a
// PÁGINA DO ACERVO e mais nada — então o app abria offline numa sala de links
// mortos: a lista mostrava as três trilhas e **nenhuma delas abria**, a não ser
// a que já tivesse sido visitada. Guardar a lista do que existe e nada do que
// ela lista é meio caminho, e meio caminho na serra é o mesmo que nada.
//
// ⚠️ A LISTA DE AQUECIMENTO SAI DA PRÓPRIA /trilhas, e é isso que a impede de
// envelhecer: ela não tem como discordar do que a tela mostra, porque ela É o
// que a tela mostra. A alternativa — um arquivo de slugs gerado no build —
// seria uma SEGUNDA fonte do acervo, a espécie "guarda que enumera o acervo à
// mão é cego a ele crescer".
describe("o aquecimento lê o acervo da própria página", () => {
  it("acha as fichas nos links da lista", () => {
    const html = `<a href="/rampa-do-pepe"><a href="/veu-de-noiva-de-bonito">`;
    expect(fichasDoAcervo(html)).toEqual(["/rampa-do-pepe", "/veu-de-noiva-de-bonito"]);
  });

  // 🔴 O HTML tem outros href além das fichas, e dois deles são armadilhas de
  // verdade: "/" é a home — aquecê-la gravaria VEREDITO DE CHUVA, que
  // `resolverNavegacao` recusa em todos os ramos —, e "/trilhas" já está sendo
  // guardada, no outro cache. Quem separa é `ehCaminhoDeFicha`, a mesma função
  // que decide o que é navegação nossa.
  it("ignora a home, a lista e o que não é ficha", () => {
    const html = [
      '<a href="/">', '<a href="/trilhas">', '<a href="/icones/192">',
      '<a href="https://example.com/rampa-do-pepe">', '<a href="#topo">',
      '<a href="/rampa-do-pepe">',
    ].join("");
    expect(fichasDoAcervo(html)).toEqual(["/rampa-do-pepe"]);
  });

  it("não repete a mesma ficha, mesmo linkada duas vezes", () => {
    const html = '<a href="/rampa-do-pepe"><a href="/rampa-do-pepe">';
    expect(fichasDoAcervo(html)).toEqual(["/rampa-do-pepe"]);
  });

  it("HTML sem link de ficha nenhum devolve lista vazia, e não estoura", () => {
    expect(fichasDoAcervo("<p>sem links</p>")).toEqual([]);
    expect(fichasDoAcervo("")).toEqual([]);
  });

  // 🔴 O TETO NÃO É UM NÚMERO MEU: é o `maxEntries` do cache das fichas, em
  // sw.ts. Aquecer mais do que o cache guarda faria a instalação baixar páginas
  // pra despejá-las na linha seguinte — dados gastos por nada, e invisível.
  it("nunca aquece mais fichas do que o cache guarda", () => {
    const html = Array.from({ length: 40 }, (_, i) => `<a href="/trilha-${i}">`).join("");
    expect(fichasDoAcervo(html)).toHaveLength(TETO_AQUECIMENTO);
  });

  // O par que amarra o teto ao cache. Lido da FONTE do sw.ts, porque o número
  // mora lá e é lá que alguém vai mexer nele.
  it("o teto daqui é o mesmo maxEntries do cache das fichas em sw.ts", () => {
    const sw = readFileSync(path.join(process.cwd(), "src", "app", "sw.ts"), "utf8");
    const bloco = sw.slice(sw.indexOf("new CacheExpiration(CACHE_ULTIMA_FICHA"));
    const achado = /maxEntries:\s*(\d+)/.exec(bloco);
    expect(achado, "não achei o maxEntries do cache das fichas em sw.ts").not.toBeNull();
    expect(
      Number(achado![1]),
      "o teto do aquecimento e o do cache divergiram: a instalação baixaria fichas pra despejar",
    ).toBe(TETO_AQUECIMENTO);
  });
});

// 🔴 A PROVA CONTRA O HTML REAL, e ela é a que importa: os testes acima medem a
// função contra strings que eu escrevi. Só esta amarra o extrator à PÁGINA QUE
// EXISTE — se o markup da lista mudar (um `<Link>`, um onClick, um href
// relativo), os de cima continuam verdes e o aquecimento silenciosamente para
// de achar ficha nenhuma.
describe("o aquecimento contra a página de verdade", () => {
  it("acha TODAS as fichas do acervo no HTML que /trilhas realmente rende", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const Trilhas = (await import("@/app/trilhas/page")).default;
    const { getAllFichas } = await import("@/lib/ficha");

    const html = renderToStaticMarkup(Trilhas());
    const achadas = fichasDoAcervo(html);
    const esperadas = getAllFichas().map((f) => `/${f.slug}`);

    expect(esperadas.length, "o acervo sumiu — este guarda ficaria oco").toBeGreaterThanOrEqual(3);
    expect(
      [...achadas].sort(),
      "o aquecimento deixou de achar alguma ficha no HTML real da lista",
    ).toEqual([...esperadas].sort());
  });
});

// 🔴 A PROVA DA ORQUESTRAÇÃO, e ela nasceu de uma medição (2026-09-11). Na
// primeira versão desta rodada o aquecimento das fichas morava solto dentro do
// ~install~ do sw.ts — e DUAS mutações sobreviveram à suíte inteira: apagar a
// busca das fichas, e gravá-las TAMBÉM sob CHAVE_ULTIMA. O sw.ts não é
// importável em teste (arrasta o serwist), então tudo que mora lá é código sem
// prova. A orquestração mudou-se pra cá, com a IO injetada, exatamente como
// ~resolverNavegacao~ já fazia.
describe("aquecer: a instalação guarda a lista E o que ela lista", () => {
  const ORIGEM = "https://bateperna.vercel.app";

  /** Um instalador de mentira: diz o que cada caminho responde e anota tudo o
   *  que foi gravado, com o cache de destino. */
  function instalador(paginas: Record<string, string | null>) {
    const gravado: { chave: string; cache: string; corpo: string }[] = [];
    const buscado: string[] = [];
    return {
      gravado,
      buscado,
      pedido: {
        origem: ORIGEM,
        buscar: async (caminho: string) => {
          buscado.push(caminho);
          const corpo = paginas[caminho];
          return corpo === null || corpo === undefined ? null : new Response(corpo);
        },
        gravar: async (alvo: { chave: string; cache: string }, r: Response) => {
          gravado.push({ chave: alvo.chave, cache: alvo.cache, corpo: await r.text() });
        },
      },
    };
  }

  const ACERVO = '<a href="/rampa-do-pepe"><a href="/veu-de-noiva-de-bonito">';

  it("guarda a lista e CADA ficha que ela lista", async () => {
    const i = instalador({
      "/trilhas": ACERVO,
      "/rampa-do-pepe": "<html>rampa</html>",
      "/veu-de-noiva-de-bonito": "<html>veu</html>",
    });
    const guardadas = await aquecer(i.pedido);

    expect([...guardadas].sort()).toEqual(["/rampa-do-pepe", "/veu-de-noiva-de-bonito"]);
    expect(i.gravado.map((g) => g.cache).filter((c) => c === CACHE_PAGINAS)).toHaveLength(1);
    // As fichas vão pro cache DELAS, e sob a URL absoluta — é a chave que
    // ~alvoDaFicha~ procura quando a navegação chega sem rede.
    const fichas = i.gravado.filter((g) => g.cache === CACHE_ULTIMA_FICHA);
    expect(fichas.map((f) => f.chave).sort()).toEqual([
      ORIGEM + "/rampa-do-pepe",
      ORIGEM + "/veu-de-noiva-de-bonito",
    ]);
  });

  // 🔴 A MUTAÇÃO A7, QUE SOBREVIVEU ANTES DESTE TESTE. Gravar a ficha aquecida
  // sob o ponteiro da última faria "/" offline abrir numa trilha que ninguém
  // pediu — ~planoDaRaiz~ consulta esse ponteiro. **Aquecer não é abrir.**
  it("NUNCA grava sob o ponteiro da última ficha — aquecer não é abrir", async () => {
    const i = instalador({ "/trilhas": ACERVO, "/rampa-do-pepe": "r", "/veu-de-noiva-de-bonito": "v" });
    await aquecer(i.pedido);
    expect(
      i.gravado.map((g) => g.chave),
      "o aquecimento encheu o ponteiro da última ficha",
    ).not.toContain(CHAVE_ULTIMA);
  });

  // A resposta da lista é lida DUAS vezes (o texto, pros links; o corpo, pro
  // cache). Sem o clone, a segunda leitura vem vazia e a porta do app fica
  // guardada em branco — falha que só aparece offline, meses depois.
  it("a lista guardada tem o corpo inteiro, e não um corpo já consumido", async () => {
    const i = instalador({ "/trilhas": ACERVO, "/rampa-do-pepe": "r", "/veu-de-noiva-de-bonito": "v" });
    await aquecer(i.pedido);
    const lista = i.gravado.find((g) => g.cache === CACHE_PAGINAS);
    expect(lista?.corpo, "a página do acervo foi guardada vazia").toBe(ACERVO);
  });

  // 🔴 CADA FICHA FALHA SOZINHA. Na estrada a rede cai no meio: sem isto, uma
  // ficha sem resposta levaria as outras junto, e o aquecimento viraria tudo
  // ou nada bem no momento em que "alguma coisa" é o que salva.
  it("ficha que não responde não leva as outras junto", async () => {
    const i = instalador({
      "/trilhas": ACERVO,
      "/rampa-do-pepe": null, // a rede caiu pra esta
      "/veu-de-noiva-de-bonito": "<html>veu</html>",
    });
    const guardadas = await aquecer(i.pedido);
    expect(guardadas).toEqual(["/veu-de-noiva-de-bonito"]);
    expect(i.gravado.filter((g) => g.cache === CACHE_ULTIMA_FICHA)).toHaveLength(1);
  });

  // Sem a lista não há o que aquecer, e não há o que gravar: instalar sem rede
  // não pode deixar lixo no cache nem estourar.
  it("sem a lista, não grava nada e não estoura", async () => {
    const i = instalador({ "/trilhas": null });
    await expect(aquecer(i.pedido)).resolves.toEqual([]);
    expect(i.gravado).toEqual([]);
  });

  // Lista sem link de ficha (acervo vazio, ou markup mudado): a porta ainda é
  // guardada. Meio caminho é melhor que nada — e o guarda do HTML real, mais
  // abaixo, é quem avisa se o markup mudou.
  it("lista sem fichas ainda guarda a lista", async () => {
    const i = instalador({ "/trilhas": "<p>nada aqui</p>" });
    await expect(aquecer(i.pedido)).resolves.toEqual([]);
    expect(i.gravado).toHaveLength(1);
    expect(i.gravado[0].cache).toBe(CACHE_PAGINAS);
  });

  // 🔴 O QUE TORNA O `allSettled` LOAD-BEARING, e sem este caso ele não era:
  // medido em 2026-09-11, trocar `allSettled` por `all` não quebrava nada,
  // porque nenhum teste fazia a GRAVAÇÃO falhar. E ela falha de verdade — é o
  // `QuotaExceededError` do iPhone, que o `guardar` do sw.ts já trata na
  // navegação. Com `all`, a primeira cota estourada levaria junto as fichas
  // que ainda caberiam.
  it("cota cheia numa ficha não impede as outras de serem guardadas", async () => {
    const gravado: string[] = [];
    const guardadas = await aquecer({
      origem: ORIGEM,
      buscar: async (caminho) =>
        new Response(caminho === "/trilhas" ? ACERVO : "corpo"),
      gravar: async ({ chave }) => {
        if (chave.endsWith("/rampa-do-pepe")) throw new Error("QuotaExceededError");
        gravado.push(chave);
      },
    });
    expect(guardadas, "a ficha que estourou a cota não pode contar como guardada")
      .toEqual(["/veu-de-noiva-de-bonito"]);
    expect(gravado).toContain(ORIGEM + "/veu-de-noiva-de-bonito");
  });

  // 🔴 A MUTAÇÃO A8, QUE SOBREVIVEU ANTES DESTE ARQUIVO: o instalador parar de
  // buscar as fichas e voltar a guardar só a lista — o defeito original, de
  // volta em silêncio.
  it("busca a lista E as fichas — não só a lista", async () => {
    const i = instalador({ "/trilhas": ACERVO, "/rampa-do-pepe": "r", "/veu-de-noiva-de-bonito": "v" });
    await aquecer(i.pedido);
    expect([...i.buscado].sort()).toEqual([
      "/rampa-do-pepe", "/trilhas", "/veu-de-noiva-de-bonito",
    ]);
  });

  // 🔴 A TAREFA QUE MORREU AQUI, E O GUARDA QUE IMPEDE ELA DE RESSUSCITAR
  // (2026-09-13). O plano da rodada era guardar os tiles do mapa junto com as
  // fichas: sem eles, instalar, sair de casa e abrir uma ficha AQUECIDA dá a
  // ficha inteira com um retângulo vazio no lugar do mapa — e o mapa é o que
  // orienta onde o texto não orienta.
  //
  // O desenho estava pronto (extrair os `<img>` do HTML que o instalador acabou
  // de baixar, igual `fichasDoAcervo` faz com os links) e o CUSTO FOI MEDIDO NO
  // AR: **38 tiles ≈ 259 KB** pelas 3 fichas — 48 ≈ 328 KB se a home entrasse,
  // e a home não compartilha NENHUM tile com as fichas. Cabia nas 120 entradas
  // do `bp-tiles-osm` com folga.
  //
  // A Tile Usage Policy do OSM (operations.osmfoundation.org/policies/tiles/,
  // lida em 2026-09-13) fecha a porta, e fecha pelo PADRÃO, não pelo volume:
  //
  //   "You must not: Bulk download ('scrape') tiles OR OFFER PREFETCH FEATURES."
  //   "Bulk downloading is any PRE-EMPTIVE FETCHING OF TILES OTHER THAN THOSE A
  //    USER IS ACTIVELY VIEWING."
  //   "OFFLINE USE IS NOT PERMITTED on tile.openstreetmap.org."
  //   Não permitido: "any 'download for offline' button OR BACKGROUND JOB THAT
  //    FETCHES TILES A USER IS NOT CURRENTLY VIEWING."
  //
  // O `install` do service worker buscando 38 tiles é, ao pé da letra, um
  // background job buscando tile que ninguém está olhando. "São só 38" não é
  // defesa: não há faixa de tolerância na política, e a sanção declarada é
  // bloqueio SEM AVISO — o mapa sumiria pra todo mundo, online inclusive, pra
  // ganhar mapa offline de uma ficha nunca aberta. Troca ruim.
  //
  // ✅ O que a MESMA política permite continua de pé e já está no ar: o
  // `CacheFirst` do `bp-tiles-osm` ("re-visits served from your local cache").
  // Ficha ABERTA uma vez mantém o mapa offline. O buraco restante é a ficha
  // aquecida e nunca aberta — e a saída dele não é baixar tile escondido, é o
  // mapa DIZER que não tem mapa (ver MapaEstatico e `.wp-sem-mapa`).
  //
  // Este teste é a única coisa que impede a próxima sessão de ler o plano velho
  // e implementá-lo sem reler a política.
  it("o aquecimento NUNCA busca tile — a política do OSM proíbe prefetch", async () => {
    const i = instalador({ "/trilhas": ACERVO, "/rampa-do-pepe": "r", "/veu-de-noiva-de-bonito": "v" });
    await aquecer(i.pedido);
    const tiles = i.buscado.filter((c) => c.includes("tile.openstreetmap.org") || /\/\d+\/\d+\/\d+\.png$/.test(c));
    expect(
      tiles,
      "o aquecimento voltou a buscar tile: isso é prefetch, e a política do OSM manda bloquear sem aviso",
    ).toEqual([]);
  });

  // O par do de cima, e sem ele aquele seria vácuo: prova que o instalador
  // BUSCA alguma coisa. Um `aquecer` que não busca nada passaria naquele.
  it("e mesmo assim busca as páginas — o guarda acima não é vácuo", async () => {
    const i = instalador({ "/trilhas": ACERVO, "/rampa-do-pepe": "r", "/veu-de-noiva-de-bonito": "v" });
    await aquecer(i.pedido);
    expect(i.buscado.length).toBeGreaterThan(1);
  });
});

// 🔴 O DEFEITO QUE ESTE BLOCO TRANCA, e ele foi MEDIDO NO NAVEGADOR, não
// imaginado (2026-09-11). A ficha da Véu de Noiva estava guardada com o estado
// real — ~cuidado~, "Vá com cuidado". **Uma** visita a
// ~/veu-de-noiva-de-bonito?debug=fresco~ reescreveu a cópia guardada SOB A URL
// LIMPA, e o ponteiro da última ficha junto, com um **"Pode ir"**. A partir
// dali, offline, aquela trilha dizia que dava pra ir.
//
// A causa é uma boa decisão encontrando outra: ~chaveDeFicha~ tira a query de
// propósito (o ~?fbclid=~ que o WhatsApp cola nos links), e ela tira TODA
// query — inclusive a que muda o conteúdo.
//
// É a linha vermelha do projeto: o app afirmando falso sobre um lugar real, no
// lugar onde ninguém olha.
describe("estado forçado nunca vira memória", () => {
  const URL_FICHA = "https://bateperna.vercel.app/veu-de-noiva-de-bonito";

  const navegar = (url: string, ok = true) =>
    resolverNavegacao({
      url,
      buscarRede: async () => new Response("corpo", { status: ok ? 200 : 500 }),
      buscarCache: async () => null,
    });

  it("navegação limpa grava, como sempre", async () => {
    const { gravarEm } = await navegar(URL_FICHA);
    expect(gravarEm).toEqual([URL_FICHA, CHAVE_ULTIMA]);
  });

  // 🔴 O CASO EXATO QUE ESTAVA NO AR.
  it("navegação com estado forçado NÃO grava — nem sob a URL limpa, nem no ponteiro", async () => {
    const { gravarEm } = await navegar(URL_FICHA + "?debug=fresco");
    expect(
      gravarEm,
      "o estado forçado foi parar no cache, e mentiria offline por tempo indeterminado",
    ).toEqual([]);
  });

  // Mas SERVE: ele precisa ver o que forçou. Não gravar não é não mostrar.
  it("e ainda assim serve a página — ele precisa ver o que pediu", async () => {
    const { resposta } = await navegar(URL_FICHA + "?debug=frio");
    expect(resposta?.status, "a navegação forçada parou de responder").toBe(200);
  });

  // 🔴 CONSERVADOR DE PROPÓSITO: qualquer valor no parâmetro basta. Amarrar a
  // regra aos valores de hoje ("fresco"/"frio") deixaria o guarda cego ao dia
  // em que um valor novo aparecer — e aí o envenenamento volta calado.
  it("qualquer valor no parâmetro basta, e não só os de hoje", async () => {
    for (const v of ["fresco", "frio", "", "qualquercoisa"]) {
      const { gravarEm } = await navegar(URL_FICHA + "?debug=" + v);
      expect(gravarEm, "valor " + JSON.stringify(v) + " passou").toEqual([]);
    }
  });

  // O par que impede o remédio de virar doença: o ~?fbclid=~ do WhatsApp
  // continua sendo ruído, e link compartilhado tem que continuar guardando.
  // Esta é a razão pela qual ~chaveDeFicha~ tira a query, e ela segue valendo.
  it("query que NÃO é a do debug continua gravando — o link do WhatsApp", async () => {
    const { gravarEm } = await navegar(URL_FICHA + "?fbclid=XYZ&utm_source=zap");
    expect(gravarEm, "o link compartilhado parou de ser guardado").toEqual([URL_FICHA, CHAVE_ULTIMA]);
  });

  it("a home nunca grava, com ou sem estado forçado — ela é veredito do momento", async () => {
    for (const u of ["https://bateperna.vercel.app/", "https://bateperna.vercel.app/?debug=fresco"]) {
      expect((await navegar(u)).gravarEm).toEqual([]);
    }
  });

  // 🔴 O NOME DO PARÂMETRO MORA EM DOIS ARQUIVOS — aqui e em quem o lê na
  // página — e este guarda é o preço disso. Sem ele, renomear o parâmetro na
  // página deixaria o service worker cego: o estado forçado voltaria a ser
  // guardado, em silêncio, e a suíte ficaria verde.
  it("o nome do parâmetro é o mesmo que a página realmente lê", () => {
    const pagina = readFileSync(
      path.join(process.cwd(), "src", "app", "[slug]", "page.tsx"), "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(pagina, "a tira de comentários comeu a página").toContain("searchParams");
    expect(
      pagina,
      "a página deixou de ler o parâmetro com este nome — o service worker ficou cego",
    ).toContain(PARAM_DEBUG + "?:");
  });

  // E o outro lado: o módulo que decide o estado forçado tem que reconhecer os
  // valores que o guarda protege. Se ele parar de aceitar qualquer um, a
  // proteção continua certa — mas o atalho DELE morreu, e isso tem que doer.
  it("o atalho dele continua existindo — senão a proteção guarda uma porta murada", () => {
    const motor = readFileSync(
      path.join(process.cwd(), "src", "lib", "carimbo-estado.ts"), "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(motor, "a tira comeu o arquivo").toContain("resolverEstado");
    expect(motor, "o atalho de conferir no celular sumiu").toMatch(/debug === "(fresco|frio)"/);
  });
});
