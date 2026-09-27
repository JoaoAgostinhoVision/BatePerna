import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 🔴 A OUTRA METADE DA PALAVRA "ESCONDER" (A7 da auditoria da Tarefa 4,
 *  2026-09-27): tirar o lugar da home e do acervo é fácil de ver; o que é fácil
 *  de ESQUECER é a página dele, que continua respondendo por LINK DIRETO — e link
 *  direto de trilha é o que circula no WhatsApp, justamente onde ele mais dura.
 *
 *  A cadeia é `[slug]/page.tsx` → `getFicha` → `getAllFichas` → `buscarFichas` →
 *  `versoesAtuais`, e é o filtro novo no fim dela que faz a página dar 404. O 404
 *  sai "de graça", e é exatamente por isso que ele precisa de teste: nenhuma
 *  linha desta tarefa o pede por nome, então nada avisaria se ele se perdesse —
 *  e o que se perde é um lugar "escondido" continuando no ar.
 *
 *  ⚠️ POR QUE UM ARQUIVO PRÓPRIO, e não um caso em `tests/app/ficha.test.tsx`:
 *  lá `@/lib/ficha` é parcialmente dublado (quatro fichas sintéticas são
 *  interceptadas antes do banco) e `next/navigation` não é mockado. Aqui a página
 *  roda contra o acervo de VERDADE no banco, sem dublê de `getFicha`.
 *
 *  ⚠️ E A CÓPIA EM MEMÓRIA (`ultimaBoa`, em `ficha-fonte.ts`) FARIA ISTO PASSAR
 *  POR ACIDENTE — pior: passar servindo a ficha escondida. Ela vive no módulo e
 *  atravessa o arquivo inteiro, então todo caso a esquece antes de medir. */
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));

// `resolverEstado` sai do caminho: ele lê clima e aviso, e nada disto é sobre
// isso. Mesmo molde de `tests/app/ficha.test.tsx`.
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getFicha } = await import("@/lib/ficha");
const { gravarVersao } = await import("@/lib/db");
const { esquecerMemoria } = await import("@/lib/ficha-fonte");
const Ficha = (await import("@/app/[slug]/page")).default;
const { bancoDeProducao, AGORA_SEMENTE } = await import("../banco");

// O banco `:memory:` que o `getClient` DE PRODUÇÃO devolve, já com o acervo
// dentro. Sem dublê de getter: a única peça trocada é para onde o cliente aponta.
const banco = await bancoDeProducao();
const SLUG = "rampa-do-pepe";

/** O documento da ficha, lido UMA vez com o acervo inteiro no ar.
 *
 *  🔴 Ele é capturado aqui, e não dentro de cada caso, porque `getFicha` para de
 *  achar o lugar assim que um caso o esconde — e `JSON.stringify(null)` gravaria
 *  a string `"null"` na tabela de versões. Foi o que aconteceu na primeira
 *  redação deste arquivo: o terceiro caso "mostrava de novo" um documento nulo. */
const docOriginal = JSON.stringify((await getFicha(SLUG))!);

const esconder = (quando: number) =>
  gravarVersao(banco, SLUG, docOriginal, "painel", quando, true);

const abrir = () =>
  Ficha({ params: Promise.resolve({ slug: SLUG }), searchParams: Promise.resolve({}) });

// Cada caso começa com o lugar NO AR, por gravação — a tabela é append-only, e
// "desfazer" aqui é gravar de novo, como o painel faz. Sem isto os casos
// dependeriam da ordem, porque o banco vive o arquivo inteiro.
beforeEach(async () => {
  notFoundFalso.mockClear();
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
    erro: false,
    calculadoEm: AGORA_SEMENTE,
    aviso: null,
  });
  await gravarVersao(banco, SLUG, docOriginal, "painel", AGORA_SEMENTE + 1, false);
  esquecerMemoria();
});

afterEach(() => vi.mocked(resolverEstado).mockReset());

describe("a página pública de um lugar escondido", () => {
  // 🔴 A PREMISSA, MEDIDA: o mesmo arranjo, com o lugar no ar, ABRE. Sem este
  // caso, o de baixo passaria igual com o banco vazio, com o slug errado, ou com
  // a página quebrada por qualquer outro motivo — e o teste diria "escondeu"
  // quando o que aconteceu foi "nunca existiu".
  it("com o lugar no ar, a página abre e notFound() não é chamado", async () => {
    expect(await getFicha(SLUG)).not.toBeNull();
    await expect(abrir()).resolves.toBeTruthy();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("escondido, o link direto dá 404 — a página CHAMA notFound()", async () => {
    await esconder(AGORA_SEMENTE + 60);
    esquecerMemoria();

    expect(await getFicha(SLUG), "o getter público não acha mais o lugar").toBeNull();
    await expect(abrir()).rejects.toThrow("NEXT_NOT_FOUND");
    // 🔴 Não basta "não renderizou": o que se prova é que o `notFound()` da
    // página foi CHAMADO. Sem esta asserção, apagar o `if (!ficha) notFound()`
    // deixaria o caso verde por estourar noutro lugar.
    expect(notFoundFalso).toHaveBeenCalledTimes(1);
  });

  it("mostrado de novo, o mesmo link volta a abrir", async () => {
    await esconder(AGORA_SEMENTE + 60);
    esquecerMemoria();
    await gravarVersao(banco, SLUG, docOriginal, "painel", AGORA_SEMENTE + 120, false);
    esquecerMemoria();

    await expect(abrir()).resolves.toBeTruthy();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });
});
