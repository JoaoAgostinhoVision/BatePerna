import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema, gravarVersao, historico, salvarRascunho, versaoAtual, versoesAtuais } from "@/lib/db";
import { CIDADE_SEM_LETRA, gemeoSemCidade, parDeLugar, parDeRascunho } from "@/lib/rascunho";
import { semearAcervo } from "../banco";
import { fichaSchema, type Ficha } from "@/types/ficha";
import type { Violacao } from "@/lib/coerencia";
import { RECUSA_TIRAR_O_LUGAR } from "@/lib/campos-da-ficha";
import { SEGUNDO, TERCEIRO, TRES_PONTOS, doisPontos, tresPontos } from "../ficha-de-tres-pontos";

// 🔴 C1 da revisão do controlador: o molde real é `tests/api/route-admin-aviso.test.ts`
// (o brief citava um caminho em `tests/app/` que não existe) — Request à mão,
// `process.env` via `vi.stubEnv`, `criarSessao` de verdade, acervo do BANCO
// via `semearAcervo` de `tests/banco.ts`.

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-ficha";
// 🔴 C3: `AGORA` é o instante FIXO em segundos — relógio congelado, porque
// Task 7 (a próxima) monta em cima deste arquivo e precisa de determinismo
// pra comparar `criado_em` entre versões.
const AGORA = 1_758_200_000;

// 🔴 C3: nomes de contrato com a Task 7 — não renomear.
let c: Client;
let SLUG: string;
let ficha: Ficha;
let outra: Ficha;
// 🔴 Task 3: o acervo INTEIRO, porque o portão de coerência compara uma ficha
// com as outras — e dois dos guardas de lá precisam de um TERCEIRO lugar, não
// só do par `ficha`/`outra`. Achado por nome, nunca por posição na lista.
let acervo: Ficha[];
let cookieBom: string;
let PUT: typeof import("@/app/api/admin/ficha/route").PUT;

// 🔴 A REGRA FANTASMA (C7 da auditoria da Tarefa 10). Nenhuma regra real olha
// coordenada nem a cadeia do trajeto, então nenhuma gravação de PONTO ou de ETAPA
// consegue provar, com regra real, que passa pelo portão de coerência. O dublê
// SOMA à lista real uma regra que o caso liga quando quer — e desligada (`null`,
// o padrão) a rota mede exatamente o que mediria em produção. É `vi.hoisted`
// porque o `vi.mock` sobe pro topo do arquivo antes de qualquer `let`.
const fantasma = vi.hoisted(() => ({
  regra: null as null | ((fichas: readonly Ficha[]) => Violacao[]),
}));
vi.mock("@/lib/coerencia", async (io) => {
  const mod = await io<typeof import("@/lib/coerencia")>();
  return {
    ...mod,
    violacoesDoAcervo: (fichas: readonly Ficha[]) => [
      ...mod.violacoesDoAcervo(fichas),
      ...(fantasma.regra?.(fichas) ?? []),
    ],
  };
});

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);

  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  // A rota valida o slug contra a versão atual do BANCO, que é semeado com
  // uma versão por lugar (autor "semente") — é por isso que "nada foi
  // gravado" nos testes abaixo é `historico(...).toHaveLength(1)`, não 0.
  const fichas = await semearAcervo(c);
  ficha = fichas.find((f) => f.slug === "rampa-do-pepe")!;
  outra = fichas.find((f) => f.slug !== ficha.slug)!;
  acervo = fichas;
  SLUG = ficha.slug;

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  ({ PUT } = await import("@/app/api/admin/ficha/route"));

  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  fantasma.regra = null;
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(corpo: unknown, cookie?: string): Request {
  return new Request("http://x/api/admin/ficha", {
    method: "PUT",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
}

describe("PUT /api/admin/ficha", () => {
  // 🔴 RULING equivalente ao da rota de aviso: FALHA FECHADA. Sem
  // ADMIN_SENHA o painel não existe — 404, nunca 401, nunca 200 — e a
  // guarda vem antes de tocar o banco.
  it("sem ADMIN_SENHA no env: 404, e nada é gravado", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { PUT: putSemSenha } = await import("@/app/api/admin/ficha/route");
    const res = await putSemSenha(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));
    expect(res.status).toBe(404);
    expect(await historico(c, SLUG)).toHaveLength(1); // ⬅ só a semente
  });

  // 🔴 M3 do plano de mutação: gravar antes de checar sessão tem que morrer
  // aqui — o código (401) E o efeito (nada gravado) são os dois provados.
  it("painel ligado, sem cookie: 401, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }));
    expect(res.status).toBe(401);
    expect(await historico(c, SLUG)).toHaveLength(1); // ⬅ só a semente
  });

  // 🔴 M4 do plano de mutação ("um teste que lê o autor da versão nova"):
  // este é ele — `gravarVersao(..., "semente", ...)` no lugar de "painel"
  // tem que morrer NESTA asserção.
  it("cookie válido: grava a voz nova com autor painel, e a versão antiga fica no histórico", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));
    expect(res.status).toBe(200);
    const atual = await versaoAtual(c, SLUG);
    expect(JSON.parse(atual!.doc).voz).toBe("texto novo");
    expect(atual!.autor).toBe("painel");
    expect(await historico(c, SLUG)).toHaveLength(2); // ⬅ a antiga ficou
  });

  // 🔴 M1 do plano de mutação: sem o segundo `fichaSchema.parse` dentro de
  // `aplicarCampo`, um número passaria como "voz" e este teste é quem morre.
  it("valor inválido (número em vez de texto): 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: 42 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("slug que não existe no acervo: 400", async () => {
    const res = await PUT(pedido({ slug: "morro-inventado", campo: "voz", valor: "x" }, cookieBom));
    expect(res.status).toBe(400);
  });

  // 🔴 REANCORADO em 2026-09-26: a isca era `campo: "piso"`, e `piso` PASSOU
  // A SER EDITÁVEL nesta rodada (entrou no registro de `campos-da-ficha.ts`).
  // Quem guarda a trava agora é o `slug` — o campo que o registro recusa de
  // propósito, porque trocá-lo renomeia o lugar e quebra todo link que já
  // circula. Este é o teste de NÍVEL DE ROTA; o de unidade em
  // `tests/lib/aplicar-campo.test.ts` cobre os outros recusados.
  it("campo fora do registro do painel (slug): 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "slug", valor: "outro-lugar" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 O par do de cima, e ele é quem prova que a trava não virou um "recusa
  // tudo": um caminho ANINHADO, que a rota não sabia alcançar até esta rodada,
  // tem que atravessar a porta inteira e gravar. Sem ele, um registro vazio
  // (ou um `return 400` no lugar da guarda) passaria verde no teste de cima.
  //
  // 🔴 A CARGA MUDOU NA TAREFA 3 (2026-09-27), e o caso continua provando a
  // MESMA coisa. Ele gravava `custo.valor: "R$ 12,00"` numa ficha cujo chip diz
  // "R$ 5 · portão" — **uma ficha que anuncia um preço no topo e cobra outro no
  // ticket**, que é exatamente o defeito de `chip-bate-com-preco` (o chip
  // anunciando um décimo do preço, auditoria de 03/09). Enquanto a coerência
  // morava num arquivo de teste isso passava 200; com o portão na rota é 409, e
  // o 409 está CERTO. Quem prova o 409 é o caso homônimo lá embaixo; aqui a
  // carga passou a ser um valor que não mente — o mesmo preço, outra redação —
  // porque o que este caso guarda é que um caminho ANINHADO atravessa a porta
  // inteira e grava.
  it("campo aninhado que entrou no registro (custo.valor): 200, e grava", async () => {
    const VALOR = "R$ 5 por pessoa · cobrado na portaria";
    // 🔴 A PREMISSA DESTE CASO, e ela é nova: a carga só atravessa o portão de
    // coerência porque o preço dela BATE com o chip do topo da ficha. Sem esta
    // linha, o dia em que o preço da Rampa mudar no acervo faz este caso virar
    // 409, e o vermelho vai parecer defeito de rota.
    // 🔴 A premissa é sobre o que a REGRA extrai, não sobre substring: um
    // re-revisor mediu que `toContain("R$ 5")` fica VERDE com o chip em
    // "R$ 50 · portão" — e nesse estado o caso leva 409, ou seja, a premissa
    // passava e o vermelho confuso acontecia igual.
    expect(
      ficha.custo.curto?.match(/R\$\s?\d+(?:[.,]\d{2})?/)?.[0],
      "a premissa: o preço do chip tem que ser o mesmo da carga",
    ).toBe("R$ 5");
    const res = await PUT(pedido({ slug: SLUG, campo: "custo.valor", valor: VALOR }, cookieBom));
    expect(res.status).toBe(200);
    const atual = await versaoAtual(c, SLUG);
    expect(JSON.parse(atual!.doc).custo.valor).toBe(VALOR);
    expect(JSON.parse(atual!.doc).custo.tag).toBe("pago");
  });

  // 🔴 M5 do plano de mutação, medido no nível da ROTA com um SEGUNDO lugar
  // (`outra`): trocar o spread por `{ [campo]: valor }` em `aplicarCampo`
  // apagaria a ficha de `outra` inteira — mas como cada gravação é por slug,
  // este teste garante que editar UM lugar não escreve versão nenhuma pro
  // outro.
  it("editar a voz de um lugar não grava versão nenhuma pra outro lugar", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "só esta muda" }, cookieBom));
    expect(res.status).toBe(200);
    expect(await historico(c, outra.slug)).toHaveLength(1); // ⬅ intocado
    const versaoOutra = await versaoAtual(c, outra.slug);
    expect(JSON.parse(versaoOutra!.doc).voz).toBe(outra.voz);
  });

  // 🔴 FIX ROUND 1, item 2: só o status não prova nada — todo irmão de
  // recusa deste arquivo prova código E efeito. Sem `historico`, um bug que
  // gravasse por engano antes de devolver 400 passaria verde aqui.
  it("corpo JSON malformado: 400, e nada é gravado", async () => {
    const res = await PUT(
      new Request("http://x/api/admin/ficha", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("corpo null: 400, não exceção — e nada é gravado", async () => {
    const res = await PUT(pedido(null, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });
});

describe("PUT /api/admin/ficha — voltar a uma versão (versaoId)", () => {
  // 🔴 O teste central da escolha 3 dele: voltar GRAVA, não apaga.
  //
  // 🔴 C1 da revisão do controlador: o brief cravava `toHaveLength(3)`, e a
  // conta certa é 4 (semente + "a primeira" + "a segunda" + o voltar) — mas
  // cravar QUALQUER número trava de novo se o `beforeEach` mudar de tamanho.
  // A asserção é RELATIVA (`antes + 1`), estritamente mais forte, e a
  // absoluta que prova que "a segunda" continua lá fica intacta.
  it("voltar a uma versão antiga grava versão nova, e a atual continua no histórico", async () => {
    const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a segunda" }), "painel", AGORA + 10);

    const antes = await historico(c, SLUG);

    const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

    expect(r.status).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("a primeira");
    const h = await historico(c, SLUG);
    expect(h, "voltar tem que INSERIR, nunca apagar").toHaveLength(antes.length + 1);
    expect(JSON.parse(h[1].doc).voz, "a versão de onde voltamos continua lá").toBe("a segunda");
  });

  // 🔴 A LINHA VERMELHA EM FORMA DE TESTE. Sem conferir que a versão é DAQUELE
  // lugar, um `versaoId` qualquer põe a voz da Rampa na ficha da Pedra Furada —
  // exatamente o defeito que este projeto mais caça, agora com ajuda do banco.
  it("versaoId de OUTRO lugar: 400, e a ficha não é tocada", async () => {
    const daRampa = await gravarVersao(c, "rampa-do-pepe", JSON.stringify({ ...ficha, voz: "voz da Rampa" }), "painel", AGORA);
    await gravarVersao(c, "pedra-furada-de-venturosa", JSON.stringify({ ...outra, voz: "voz da Pedra" }), "semente", AGORA);

    const r = await PUT(pedido({ slug: "pedra-furada-de-venturosa", versaoId: daRampa }, cookieBom));

    expect(r.status).toBe(400);
    expect(JSON.parse((await versaoAtual(c, "pedra-furada-de-venturosa"))!.doc).voz).toBe("voz da Pedra");
  });

  it("versaoId que não existe: 400", async () => {
    expect((await PUT(pedido({ slug: SLUG, versaoId: 99_999 }, cookieBom))).status).toBe(400);
  });

  // 🔴 I1 DA REVISÃO FINAL (2026-09-26): o `try { fichaSchema.parse(...) }
  // catch { 400 }` que decide se uma versão antiga ainda pode ser restaurada
  // não tinha teste nenhum — apagar as cinco linhas do `catch` não deixava
  // nada vermelho. O custo é grande: se uma versão que não passa mais no
  // schema de hoje virasse a atual, `buscarFichas`/`getAllFichas` estourariam
  // pro acervo INTEIRO (home, /trilhas, /<slug>, /admin e /admin/<slug> —
  // inclusive a tela pela qual se desfaria o erro), sem saída por SQL na mão.
  // `promessa` é campo obrigatório do schema de hoje; a versão gravada abaixo
  // não o tem.
  it("voltar a uma versão que não passa mais no schema de hoje: 400, e o histórico não muda", async () => {
    const { promessa: _promessa, ...semPromessa } = ficha;
    const v1 = await gravarVersao(c, SLUG, JSON.stringify(semPromessa), "semente", AGORA);
    const antes = await historico(c, SLUG);

    const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

    expect(r.status).toBe(400);
    const depois = await historico(c, SLUG);
    expect(depois, "voltar pra uma versão inválida não pode gravar nada novo").toHaveLength(antes.length);
  });

  // 🔴 FIX ROUND 1 (2026-09-26): "voltar" grava VERBATIM, não renormalizado.
  // Sem isto, `fichaSchema.parse` reescreve o passado — descarta chave
  // desconhecida em silêncio (mesma régua documentada em `src/types/ficha.ts`
  // pra `esforco`/`duracao`) e reordena as chaves pela ordem do schema, não a
  // do documento original. O doc de teste carrega os DOIS defeitos ao mesmo
  // tempo — chave a mais e ordem diferente — porque só assim "gravou o
  // antigo" se distingue de "gravou o renormalizado".
  it("voltar grava o doc EXATAMENTE como estava — nunca renormalizado pelo schema", async () => {
    const chaveDesconhecida = "campoQueOSchemaNaoConheceMais";
    const invertido = Object.fromEntries([...Object.entries(ficha)].reverse());
    const docAntigo = JSON.stringify({ ...invertido, [chaveDesconhecida]: "só sobrevive se gravar verbatim" });

    const v1 = await gravarVersao(c, SLUG, docAntigo, "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a mais nova" }), "painel", AGORA + 10);

    const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

    expect(r.status).toBe(200);
    expect(
      (await versaoAtual(c, SLUG))!.doc,
      "verbatim: a mesma string byte a byte, não reserializada pelo schema",
    ).toBe(docAntigo);
  });

  // 🔴 C6 da revisão do controlador: o ramo novo não pode virar porta lateral —
  // nem os dois formatos juntos, nem nenhum dos dois, é gravação nenhuma.
  it("corpo sem campo/valor e sem versaoId: 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("corpo com campo e versaoId ao mesmo tempo: 400, e nada é gravado", async () => {
    const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
    const antes = await historico(c, SLUG);
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "x", versaoId: v1 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(antes.length);
  });

  // 🔴 M1 DA REVISÃO FINAL (2026-09-26), medido pelo revisor: `versaoId:
  // 1e999` sobrevive ao `JSON.parse` como `Infinity` (`typeof` continua
  // "number"), e o `@libsql/client` lança `RangeError` com `Infinity` como
  // parâmetro de bind — uma exceção não tratada, não um 400 controlado. `1.5`
  // é o irmão mais simples (não-inteiro, mas `typeof` também deixa passar).
  //
  // ⚠️ HONESTIDADE DE MUTAÇÃO: este teste NÃO mata sozinho a remoção do
  // `!Number.isInteger(...)` — medido: sem essa checagem, `versaoPorId` com
  // `id = 1.5` roda a consulta de qualquer forma, não acha linha (os ids são
  // inteiros) e devolve `null`, que o ramo seguinte já traduz em 400 pelo
  // motivo errado. Fica como documentação do contrato (a rota recusa
  // explicitamente, não por acaso de não achar linha); quem prova o defeito
  // real de M1 é o teste de `1e999` logo abaixo.
  it("versaoId não-inteiro (1.5): 400, e nada é gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, versaoId: 1.5 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 `JSON.stringify({ versaoId: 1e999 })` NÃO exercita o defeito: em JS o
  // literal `1e999` já É `Infinity` no momento em que o teste o escreve, e
  // `JSON.stringify` serializa não-finito como `null` — o corpo chegaria com
  // `versaoId: null`, que `typeof null !== "number"` já rejeitava mesmo
  // ANTES deste conserto. O ataque real manda o TEXTO `1e999` no JSON (um
  // número gigante, não `Infinity`), e é o `JSON.parse` DO SERVIDOR quem o
  // estoura pra `Infinity` — por isso o corpo é montado como string à mão.
  it("versaoId gigante o bastante pra o JSON.parse do servidor virar Infinity: 400, e nada é gravado", async () => {
    const req = new Request("http://x/api/admin/ficha", {
      method: "PUT",
      headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
      body: `{"slug":"${SLUG}","versaoId":1e999}`,
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Task 3 da rodada do painel completo (2026-09-27)
//
// 🔴 O QUE O STEP 0 MEDIU, E POR QUE ESTE CABEÇALHO EXISTE: dos oito casos que
// o brief pedia, SEIS já passavam contra a rota INTACTA — caminho aninhado,
// número/booleano, string vazia, campo fora do registro e os DOIS de `naoSei`
// (estes últimos passavam pela porta ERRADA, porque `aplicarCampo(doc, campo,
// undefined)` já apagava a chave sem passar por `removerCampo`). Caso que já
// passava antes não prova implementação nenhuma, então os casos abaixo são os
// que a tabela de mutação sustenta, e nenhum deles é cópia de um que já estava
// verde.
// ────────────────────────────────────────────────────────────────────────────

/** A ficha `f` com o chip do topo trocado — mentira de preço montada à mão pra
 *  pôr violação no acervo SEM passar pela porta (é como ela chega de verdade:
 *  pela semente, ou por "voltar" a uma versão que o acervo de hoje reprova). */
const comChip = (f: Ficha, curto: string) => JSON.stringify({ ...f, custo: { ...f.custo, curto } });

/** A ficha `f` SEM o bloco `horario`. */
const semHorario = (f: Ficha) => {
  const { horario: _fora, ...resto } = f;
  return JSON.stringify(resto);
};

describe("PUT /api/admin/ficha — os três formatos são exaustivos e exclusivos", () => {
  // 🔴 O QUARTO CAMINHO NÃO DECLARADO, e o Step 0 o mediu vivo: `{slug, campo:
  // "piso"}` devolvia **200 e o `piso` sumia da ficha**. Era um "não sei"
  // ACIDENTAL — não passava por `removerCampo`, então não tinha a checagem de
  // campo obrigatório nem frase nenhuma —, e enquanto ele existisse os dois
  // casos de `naoSei` do brief ficariam verdes SEM `naoSei` implementado.
  //
  // ⚠️ A asserção que importa é a SEGUNDA: 400 sozinho não distingue "recusou"
  // de "recusou depois de apagar".
  it("remoção acidental — corpo com campo e sem valor e sem naoSei: 400, e o campo CONTINUA na ficha", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "piso" }, cookieBom));
    expect(res.status).toBe(400);
    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect("piso" in doc, "o campo não pode ter sumido por um corpo malformado").toBe(true);
    expect(doc.piso).toBe(ficha.piso);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 O CAMPO AQUI É `piso` DE PROPÓSITO, E ISSO FOI MEDIDO, NÃO ESCOLHIDO NO
  // ESCURO. O brief escrevia este caso com `campo: "voz"`, e ASSIM ELE PASSA
  // PELO MOTIVO ERRADO: com a guarda arrancada, `voz` cairia em `removerCampo`,
  // que estoura porque a voz é obrigatória — o teste continuaria verde vendo um
  // 400 que não tem nada a ver com a exclusividade dos formatos. Medido: a
  // mutação "aceita `valor` e `naoSei` juntos" SOBREVIVEU à versão com `voz`.
  // Com `piso` — opcional — a mutação apaga o campo e devolve 200, e o caso
  // morre. É a 48ª espécie: prova que passa por acidente do vizinho.
  it("corpo com valor E naoSei juntos: 400, e o campo CONTINUA na ficha", async () => {
    const res = await PUT(
      pedido({ slug: SLUG, campo: "piso", valor: "asfalto-tapete", naoSei: true }, cookieBom),
    );
    expect(res.status).toBe(400);
    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect("piso" in doc, "corpo ambíguo não pode nem gravar nem apagar").toBe(true);
    expect(doc.piso).toBe(ficha.piso);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 `naoSei: false` é o irmão perigoso do de cima: lido por `in`, ele PEDIRIA
  // remoção dizendo "não". Uma tela que mandasse a bandeira desligada apagaria
  // o campo do dono.
  it("naoSei: false — 400, e o campo CONTINUA na ficha", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "piso", naoSei: false }, cookieBom));
    expect(res.status).toBe(400);
    expect("piso" in JSON.parse((await versaoAtual(c, SLUG))!.doc)).toBe(true);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 ESTE CASO PASSAVA PELO MOTIVO ERRADO, e um re-revisor mediu: a carga
  // levava `campo`, então a recusa vinha da primeira cláusula de `trazCampo` e o
  // caso ficava VERDE mesmo arrancando o `|| "naoSei" in corpo`. O buraco real
  // era `{slug, naoSei, versaoId}` SEM `campo`: saía 200 e **voltava a versão
  // antiga**, ignorando o `naoSei` em silêncio. Sem `campo` na carga, e a
  // asserção é sobre o CONTEÚDO — o tamanho do histórico sozinho não distingue
  // "recusou" de "voltou a versão errada" numa base que já tem duas.
  // 🔴 A RÉGUA NOVA DO 400 NÃO TINHA PROVA: um re-revisor voltou `recusar400`
  // para a régua ANTERIOR (só `ZodError` barrado) e a suíte inteira ficou verde,
  // porque o caso que parecia guardá-la é o do zod, que já existia. O que
  // distingue as duas réguas é um `Error` que NÃO é nosso: um documento
  // corrompido no banco devolvia `Unexpected token 'i', "isto nao e json" is not
  // valid JSON` — em inglês, com o conteúdo bruto ecoado pro celular dele.
  it("documento corrompido no banco: 400 com corpo VAZIO — mensagem de motor não vira texto de tela", async () => {
    await gravarVersao(c, SLUG, "isto nao e json", "semente", AGORA);
    const antes = await historico(c, SLUG);

    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "voz nova" }, cookieBom));

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("");
    expect(await historico(c, SLUG)).toHaveLength(antes.length);
  });

  it("corpo com naoSei e versaoId, SEM campo: 400, e a versão NÃO volta", async () => {
    const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a segunda" }), "painel", AGORA);
    const antes = await historico(c, SLUG);

    const res = await PUT(pedido({ slug: SLUG, naoSei: true, versaoId: v1 }, cookieBom));

    expect(res.status).toBe(400);
    expect(await historico(c, SLUG)).toHaveLength(antes.length);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("a segunda");
  });
});

describe('PUT /api/admin/ficha — o "não sei" de verdade (removerCampo)', () => {
  it("naoSei tira a chave, e o histórico ganha versão", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "piso", naoSei: true }, cookieBom));
    expect(res.status).toBe(200);
    expect("piso" in JSON.parse((await versaoAtual(c, SLUG))!.doc)).toBe(false);
    expect(await historico(c, SLUG)).toHaveLength(2);
  });

  // 🔴 ESTE CASO TEM UMA ARMADILHA, e a asserção do CORPO é o que a desarma: com
  // `aplicarCampo(doc, "voz", undefined)` — o caminho acidental de antes — ele
  // também dava 400, mas por ZodError (`voz` é obrigatória no schema), com corpo
  // VAZIO. Medir só o status provaria o schema, não a rota. A frase só existe
  // dentro de `removerCampo`, então o corpo é a prova de que a rota passou por
  // lá: é a diferença entre "deu erro" e "o dono foi informado de que este campo
  // não tem 'não sei'".
  it('naoSei em campo obrigatório: 400, nada gravado, e a frase diz que não tem "não sei"', async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", naoSei: true }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/`voz` é obrigatório: sem ele a ficha não existe/);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 ZodError NÃO VAZA PRA TELA: quando a recusa vem do schema (e não de uma
  // frase escrita à mão), o corpo é vazio. Sem isto, o dono leria
  // `[{"code":"invalid_type",...}]` no celular.
  it("valor de tipo errado: 400 com corpo VAZIO — o JSON do zod não vira texto de tela", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: 42 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("");
    expect(await historico(c, SLUG)).toHaveLength(1);
  });
});

describe("PUT /api/admin/ficha — o bloco horario, e a IDA E VOLTA", () => {
  // `pedra-furada-de-venturosa` é a ficha que TEM `horario` e cuja prosa NÃO
  // cita hora de fechar — tirar o bloco dela não mexe com a coerência, o que
  // deixa estes casos medindo o bloco e mais nada.
  const PEDRA = "pedra-furada-de-venturosa";

  it("naoSei no bloco inteiro: 200, e o horário sai da ficha", async () => {
    const res = await PUT(pedido({ slug: PEDRA, campo: "horario", naoSei: true }, cookieBom));
    expect(res.status).toBe(200);
    expect("horario" in JSON.parse((await versaoAtual(c, PEDRA))!.doc)).toBe(false);
    expect(await historico(c, PEDRA)).toHaveLength(2);
  });

  // 🔴 A 47ª ESPÉCIE (duas portas em série): `campoPorCaminho("horario.abre")`
  // ACHA a entrada, então a guarda da lista branca deixa passar; quem recusa é
  // `aplicarCampo`. Só o status não distingue as duas — a frase, que nomeia o
  // BLOCO, distingue.
  it("horario.abre sozinho com o bloco AUSENTE: 400, e a recusa nomeia o bloco", async () => {
    // A Rampa é a ficha do acervo que não tem `horario`.
    expect(ficha.horario, "a premissa deste caso: a Rampa não tem horário").toBeUndefined();
    const res = await PUT(pedido({ slug: SLUG, campo: "horario.abre", valor: "09:00" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/`horario` não está preenchido nesta ficha/);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴🔴 A IDA E VOLTA — O CASO QUE A LEI DELE EXIGE. Sem ele, o "não sei" do
  // horário é uma porta de mão única pela ROTA: o dono desliga o horário, muda
  // de ideia, e religá-lo passa a exigir um desenvolvedor no banco. A emenda C1
  // da Tarefa 1 consertou isso em `aplicarCampo`; aqui é a prova de que a
  // consertou ONDE O CELULAR ALCANÇA.
  it("tirar o horário e RELIGÁ-LO inteiro, tudo pela API: o bloco volta", async () => {
    expect((await PUT(pedido({ slug: PEDRA, campo: "horario", naoSei: true }, cookieBom))).status).toBe(200);
    expect("horario" in JSON.parse((await versaoAtual(c, PEDRA))!.doc)).toBe(false);

    const volta = await PUT(
      pedido({ slug: PEDRA, campo: "horario", valor: { abre: "08:00", fecha: "17:00" } }, cookieBom),
    );
    expect(volta.status, await volta.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, PEDRA))!.doc).horario).toEqual({ abre: "08:00", fecha: "17:00" });
    expect(await historico(c, PEDRA)).toHaveLength(3);
  });

  // O par do de cima: com o bloco PRESENTE, gravar o objeto fechado por cima
  // pularia a conferência folha a folha, e é recusado.
  it("gravar o bloco horario quando ele JÁ existe: 400, e nada é gravado", async () => {
    const res = await PUT(
      pedido({ slug: PEDRA, campo: "horario", valor: { abre: "08:00", fecha: "17:00" } }, cookieBom),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/`horario` já está preenchido/);
    expect(await historico(c, PEDRA)).toHaveLength(1);
  });

  // 🔴 VALIDAÇÃO FOLHA A FOLHA (C1): a recusa nomeia `horario.abre`, não devolve
  // um erro cru de schema sobre o objeto inteiro. É a diferença entre o dono
  // saber qual das duas horas está errada e não saber.
  it("religar o bloco com uma hora malformada: 400 nomeando horario.abre", async () => {
    expect((await PUT(pedido({ slug: PEDRA, campo: "horario", naoSei: true }, cookieBom))).status).toBe(200);
    const res = await PUT(
      pedido({ slug: PEDRA, campo: "horario", valor: { abre: "8h", fecha: "17:00" } }, cookieBom),
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/`horario\.abre` não serve/);
    expect(await historico(c, PEDRA)).toHaveLength(2); // ⬅ só a semente e o "não sei"
  });
});

describe("PUT /api/admin/ficha — molde e waypoint concreto", () => {
  // 🔴 A 47ª ESPÉCIE outra vez, e aqui ela é mais escorregadia: o molde ESTÁ no
  // registro, então `campoPorCaminho` o acha e a guarda da lista branca deixa
  // passar. Quem recusa é `exigirCampo`, uma porta abaixo. A frase é o que prova
  // QUAL das duas recusou.
  it("o molde do waypoint (trajeto.waypoints[].nome): 400, nada gravado, e a recusa nomeia o molde", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "trajeto.waypoints[].nome", valor: "x" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/é o molde, não um campo: diga o índice/);
    expect(await historico(c, SLUG)).toHaveLength(1);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).trajeto.waypoints[0].nome).toBe(
      ficha.trajeto.waypoints[0].nome,
    );
  });

  // O par: o caminho CONCRETO atravessa e grava. É dele que a tarefa da cadeia
  // de trajeto vai depender, e nenhum caso do brief o tocava.
  it("waypoint concreto (trajeto.waypoints.0.nota): 200, e grava só aquela folha", async () => {
    const res = await PUT(
      pedido({ slug: SLUG, campo: "trajeto.waypoints.0.nota", valor: "entrada pela porteira azul" }, cookieBom),
    );
    expect(res.status).toBe(200);
    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect(doc.trajeto.waypoints[0].nota).toBe("entrada pela porteira azul");
    expect(doc.trajeto.waypoints[0].nome).toBe(ficha.trajeto.waypoints[0].nome);
  });
});

describe("PUT /api/admin/ficha — o portão da coerência", () => {
  const VEU = "veu-de-noiva-de-bonito";
  const nomeDoVeu = () => acervo.find((f) => f.slug === VEU)!.trajeto.waypoints[0].nome;

  // 🔴 A RECUSA. O schema aceita `custo.curto: "R$ 1"` sem pestanejar — é uma
  // string. Só a coerência vê que o chip do topo passaria a anunciar R$ 1 numa
  // ficha que cobra R$ 5, que é o defeito de 03/09 (o chip anunciando um décimo
  // do preço, com a suíte inteira verde).
  //
  // ⚠️ A asserção do corpo é na FRASE INTEIRA, não "o texto aparece em algum
  // lugar": ela tem que nomear o lugar e os DOIS preços, senão o dono lê que
  // algo está errado e não sabe o quê.
  it("gravação que passa no schema e mente sobre o lugar: 409, nada gravado, e a frase volta", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "custo.curto", valor: "R$ 1" }, cookieBom));
    expect(res.status).toBe(409);
    const nome = ficha.trajeto.waypoints[0].nome;
    expect(await res.text()).toMatch(
      new RegExp(`O chip do topo de ${nome} diz R\\$ 1 e o custo completo diz R\\$ 5`),
    );
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴🔴 O GUARDA DE SILÊNCIO, e ele é o mais importante deste arquivo.
  //
  // Sem ele, a mutação "recusa QUALQUER violação, não só a nova" sobrevive — e
  // com ela **uma única incoerência preexistente no acervo tranca TODA gravação
  // de TODO lugar, para sempre**, inclusive as que a consertariam. Numa PORTA o
  // falso positivo é pior que o falso negativo: ele trava o dono de gravar uma
  // VERDADE. É a 48ª espécie, e foi o defeito mais feio da Tarefa 2.
  //
  // O acervo sujo é montado por `gravarVersao` direto, que é como a sujeira
  // chega de verdade: a semente, ou um "voltar" a uma versão que o acervo de
  // hoje reprova (esse caminho grava verbatim e sem coerência, de propósito).
  it("acervo que JÁ tem violação preexistente não tranca gravação legítima em outro lugar", async () => {
    const veu = acervo.find((f) => f.slug === VEU)!;
    // Tirar o `horario` do Véu põe uma violação REAL no acervo: a prosa dele diz
    // "fecha às 17h", e sem campo o carimbo nunca fecha.
    await gravarVersao(c, VEU, semHorario(veu), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "voz nova e honesta" }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("voz nova e honesta");
    expect(await historico(c, SLUG)).toHaveLength(2);
  });

  // 🔴🔴 O QUE ESTE BLOCO DE QUATRO CASOS GUARDA: a IDENTIDADE da violação no
  // diff. Ela não tinha prova em NENHUM dos dois sentidos — um re-revisor mediu
  // que trocar `[regra, slug, frase]` por `[regra, slug]` **ou** por
  // `[regra, frase]` deixava a suíte inteira VERDE. E era a `frase` ali que
  // trancava o dono de renomear o lugar, porque o nome do lugar aparece na frase
  // de todas as regras.
  //
  // Os quatro casos abaixo morrem em mutações DIFERENTES, de propósito:
  //   (1) e (2) morrem se a `frase` (ou qualquer coisa que varie com o nome do
  //       lugar) voltar para a identidade;
  //   (3) morre se a comparação virar CONJUNTO de pares em vez de CONTAGEM;
  //   (4) morre se a identidade virar só a `regra`, sem o `slug`.
  it("renomear o lugar NÃO é trancado por violação preexistente na própria ficha", async () => {
    // O chip velho fica mentindo no acervo (R$ 1 num lugar que cobra R$ 5). Com
    // a frase na identidade, renomear devolvia 409 FALANDO DE PREÇO — o dono
    // pedia pra consertar o NOME e a porta respondia sobre outro assunto.
    await gravarVersao(c, SLUG, comChip(ficha, "R$ 1 · portão"), "semente", AGORA);
    const novoNome = `${ficha.trajeto.waypoints[0].nome} (Gravatá)`;

    const res = await PUT(
      pedido({ slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: novoNome }, cookieBom),
    );

    expect(res.status, await res.text()).toBe(200);
    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc) as Ficha;
    expect(doc.trajeto.waypoints[0].nome).toBe(novoNome);
  });

  it("renomear o lugar NÃO é trancado por violação preexistente no OUTRO lugar do par", async () => {
    // `frase-emprestada` compara fichas entre si e acusa UM dos dois lados. Com
    // a frase na identidade, renomear a Rampa era recusado por uma violação que
    // o módulo atribui ao VÉU — um lugar que o dono não estava editando.
    const veu = acervo.find((f) => f.slug === VEU)!;
    await gravarVersao(c, VEU, JSON.stringify({ ...veu, voz: ficha.voz }), "semente", AGORA);
    const novoNome = `${ficha.trajeto.waypoints[0].nome} (Gravatá)`;

    const res = await PUT(
      pedido({ slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: novoNome }, cookieBom),
    );

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).trajeto.waypoints[0].nome).toBe(novoNome);
  });

  it("a SEGUNDA violação da mesma regra no MESMO lugar é recusada — o portão conta, não agrupa", async () => {
    // 🔴 `janela-nao-zerada` empurra UM achado por número que mente. Com o limiar
    // já zerado no acervo, pôr TAMBÉM a janela do passado negativa leva o par de
    // 1 para 2. Comparando CONJUNTO de pares, isto passaria em silêncio: o par já
    // existia. (Até 2026-10-01 o segundo número era o passado ZERO — que passou a
    // valer sozinho, por decisão do João; o negativo continua mentindo.)
    const comLimiarZero = {
      ...ficha,
      condicao: { ...ficha.condicao, regra: { ...ficha.condicao.regra, limiar_mm: 0 } },
    };
    await gravarVersao(c, SLUG, JSON.stringify(comLimiarZero), "semente", AGORA);

    const res = await PUT(
      pedido({ slug: SLUG, campo: "condicao.regra.janela_passado_horas", valor: -1 }, cookieBom),
    );

    expect(res.status).toBe(409);
    // E nada foi gravado: a versão de cima continua sendo a do limiar zerado.
    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc) as Ficha;
    expect(doc.condicao.regra.janela_passado_horas).toBe(ficha.condicao.regra.janela_passado_horas);
    expect(await historico(c, SLUG)).toHaveLength(2);
  });

  it("o 409 fala do achado que a gravação INTRODUZIU, não do que já estava lá", async () => {
    // 🔴 A regra da chuva emite um achado por número zerado, e os três moram no
    // MESMO par `(regra, slug)`. Com a janela do passado já negativa no acervo
    // (era ZERADA até 2026-10-01, quando o passado zero passou a valer),
    // zerar o LIMIAR fazia a porta devolver a frase da JANELA — o dono mexia num
    // número e lia sobre o outro. É a forma-mensagem do defeito que gerou esta
    // onda: "ele pede pra consertar X e a porta responde sobre Y".
    const comJanelaZero = {
      ...ficha,
      condicao: { ...ficha.condicao, regra: { ...ficha.condicao.regra, janela_passado_horas: -1 } },
    };
    await gravarVersao(c, SLUG, JSON.stringify(comJanelaZero), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.limiar_mm", valor: 0 }, cookieBom));

    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase, "a frase tem que falar do LIMITE, que é o que ele acabou de zerar").toContain(
      "O limite de chuva",
    );
    expect(frase, "e não pode falar da janela, que já mentia antes").not.toContain("pra trás");
  });

  it("a MESMA contagem com valor errado DIFERENTE passa — a escolha está escrita, e é de propósito", async () => {
    // 🔴 O preço do falso negativo que a porta aceita pagar, e ele está aqui como
    // TESTE pra ninguém "consertar" isso por engano. O chip já mentia no acervo
    // (R$ 1 numa ficha que cobra R$ 5); gravar R$ 12 no custo completo mantém a
    // contagem do par `chip-bate-com-preco` em 1 e sai com 200, com o documento
    // continuando incoerente COMO JÁ ESTAVA. É a leitura deliberada de T3-R1:
    // numa porta, o falso positivo é pior, porque trava o dono de gravar uma
    // verdade — e aqui ele não introduziu nada, herdou. A dívida é cobrada pelos
    // 15 guardas de coerência do acervo, não por esta porta.
    await gravarVersao(c, SLUG, comChip(ficha, "R$ 1 · portão"), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "custo.valor", valor: "R$ 12,00" }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).custo.valor).toBe("R$ 12,00");
  });

  it("a violação que MUDA DE LUGAR é recusada, mesmo com a contagem total igual", async () => {
    // 🔴 ESTE CASO EXISTE PORQUE UMA MUTAÇÃO SOBREVIVEU: tirar o `slug` do par
    // (contando só por regra) não derrubava teste nenhum, então o `slug` estava
    // sem prova. Aqui a contagem TOTAL de `frase-emprestada` fica em 1 antes e
    // depois — o que muda é DE QUEM é a violação, e é o `slug` no par que vê.
    //
    // Antes: a Rampa e a Pedra explicam o chão com a mesma frase (o módulo acusa
    // a segunda em ordem de acervo). A gravação troca a frase da Rampa pela do
    // Véu: a primeira violação desaparece e nasce outra, em outro lugar.
    // 🔴 A gravação é no VÉU, não na Rampa, e o motivo é MEDIDO: a ordem do
    // acervo é `pedra | veu | rampa`, e esta regra acusa todos menos o primeiro
    // do grupo — então uma gravação na Rampa (que é a última) sempre acusaria a
    // própria Rampa, e a violação nunca mudaria de lugar.
    const pedra = acervo.find((f) => f.slug !== SLUG && f.slug !== VEU)!;
    const veu = acervo.find((f) => f.slug === VEU)!;
    // Antes: o Véu explica o chão com a frase da Pedra, e o módulo acusa o VÉU.
    await gravarVersao(c, VEU, JSON.stringify({ ...veu, secaRapido: pedra.secaRapido }), "semente", AGORA);
    // 🔴 A PREMISSA, medida e explícita: a ordem do acervo é a do ÚLTIMO
    // gravado, e esta regra acusa todos menos o primeiro do grupo. Se o Véu
    // ficar por último, ele é acusado nos dois lados e a violação não muda de
    // lugar — o caso deixaria de medir o que diz medir. Esta gravação a mais
    // (idêntica, na Rampa) devolve o Véu para o meio.
    await gravarVersao(c, SLUG, JSON.stringify(ficha), "semente", AGORA);
    const ordem = [...(await versoesAtuais(c)).keys()];
    expect(ordem.indexOf(VEU), `a premissa deste caso: o Véu no meio, e a ordem é ${ordem.join(" | ")}`)
      .toBe(1);
    const antes = await historico(c, VEU);

    // A gravação copia pro Véu a frase da RAMPA: a acusação do Véu morre e nasce
    // uma na Rampa. Contagem total de `frase-emprestada`: 1 antes, 1 depois.
    const res = await PUT(pedido({ slug: VEU, campo: "secaRapido", valor: ficha.secaRapido }, cookieBom));

    expect(res.status).toBe(409);
    expect(JSON.parse((await versaoAtual(c, VEU))!.doc).secaRapido).toBe(pedra.secaRapido);
    expect(await historico(c, VEU)).toHaveLength(antes.length);
  });

  // 🔴 POR QUE A IDENTIDADE TEM O `slug`, E NÃO SÓ A REGRA.
  //
  // Duas fichas, a MESMA regra: o Véu já viola `chip-bate-com-preco` (chip R$ 1,
  // valor R$ 10), e a gravação introduz a violação da MESMA regra na Rampa (chip
  // R$ 2, valor R$ 5). Comparando só pela regra, a violação nova sumiria no diff
  // — a porta deixaria passar exatamente o defeito que ela existe pra pegar, e
  // só porque outro lugar já tinha o mesmo tipo de problema.
  it("a violação NOVA é recusada mesmo quando aquela MESMA regra já acusava outro lugar", async () => {
    const veu = acervo.find((f) => f.slug === VEU)!;
    await gravarVersao(c, VEU, comChip(veu, "R$ 1 · entrada"), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "custo.curto", valor: "R$ 2" }, cookieBom));

    expect(res.status).toBe(409);
    const nome = ficha.trajeto.waypoints[0].nome;
    expect(await res.text(), "a frase tem que ser a da RAMPA, não a do Véu").toMatch(
      new RegExp(`O chip do topo de ${nome} diz R\\$ 2`),
    );
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // O portão vale nos DOIS caminhos de gravação: tirar um campo também pode
  // introduzir violação. Aqui o "não sei" no horário do Véu deixaria a prosa
  // dele ("fecha às 17h") prometendo um fechamento que o carimbo nunca cumpre.
  it('o "não sei" também passa pelo portão: remoção que introduz violação dá 409', async () => {
    const res = await PUT(pedido({ slug: VEU, campo: "horario", naoSei: true }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toMatch(
      new RegExp(`O texto de ${nomeDoVeu()} diz que fecha às 17h, mas a ficha não tem horário preenchido`),
    );
    expect(await historico(c, VEU)).toHaveLength(1);
    expect("horario" in JSON.parse((await versaoAtual(c, VEU))!.doc)).toBe(true);
  });

  // 🔴 VOLTAR NÃO PASSA PELA COERÊNCIA, e isso é deliberado desde a Task 7 da
  // rodada passada: voltar a uma versão que o acervo de hoje reprova é decisão
  // DELE, não erro novo. Rodar coerência aqui transformaria o arquivo histórico
  // em algo que o dono não pode mais alcançar.
  it("voltar a uma versão que o acervo de hoje reprova NÃO é barrado pela coerência", async () => {
    const incoerente = await gravarVersao(c, SLUG, comChip(ficha, "R$ 1 · portão"), "semente", AGORA);
    await gravarVersao(c, SLUG, JSON.stringify(ficha), "painel", AGORA + 10);

    const res = await PUT(pedido({ slug: SLUG, versaoId: incoerente }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).custo.curto).toBe("R$ 1 · portão");
  });

  // 🔴 DOCUMENTO ILEGÍVEL DE OUTRO LUGAR NÃO TRANCA A GRAVAÇÃO DESTE. Sem o
  // `try/catch` de `acervoComo`, um `doc` que não passa no `fichaSchema` de hoje
  // derruba a gravação com exceção — e o dono fica impedido de editar o lugar A
  // por causa de um defeito no lugar B, que ele não conserta sem editar.
  it("documento ilegível de outro lugar no acervo não impede a gravação deste", async () => {
    await gravarVersao(c, VEU, JSON.stringify({ slug: VEU }), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "continua editável" }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("continua editável");
  });

  // 🔴🔴 A SAÍDA, E ELA É A RÉGUA DA LEI DELE: "atualizar dado mutável sem
  // mexer no código".
  //
  // Medido nesta tarefa: com o portão no lugar, **trocar o preço de um lugar
  // pago é impossível numa gravação só** — escrever `custo.valor` primeiro
  // diverge do chip antigo, e escrever `custo.curto` primeiro diverge do valor
  // antigo. Os dois lados dão 409, o que poderia parecer uma trava.
  //
  // Não é: o chip é OPCIONAL, então o caminho existe e é todo do celular — "não
  // sei" no chip, preço novo, chip novo. Este caso é a prova de que ele existe,
  // e o primeiro `expect` é a prova de que a fricção também é real (é o que o
  // João precisa saber pra decidir a redação da frase).
  it("trocar o preço do lugar é possível do celular: três gravações, nenhum desenvolvedor", async () => {
    const VALOR_NOVO = "R$ 12 por pessoa · cobrado no portão da entrada";

    const direto = await PUT(pedido({ slug: SLUG, campo: "custo.valor", valor: VALOR_NOVO }, cookieBom));
    expect(direto.status, "de uma vez não dá — o chip antigo passaria a mentir").toBe(409);

    expect((await PUT(pedido({ slug: SLUG, campo: "custo.curto", naoSei: true }, cookieBom))).status).toBe(200);
    const comValor = await PUT(pedido({ slug: SLUG, campo: "custo.valor", valor: VALOR_NOVO }, cookieBom));
    expect(comValor.status, await comValor.text()).toBe(200);
    const comChipNovo = await PUT(pedido({ slug: SLUG, campo: "custo.curto", valor: "R$ 12 · portão" }, cookieBom));
    expect(comChipNovo.status, await comChipNovo.text()).toBe(200);

    const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect(doc.custo.valor).toBe(VALOR_NOVO);
    expect(doc.custo.curto).toBe("R$ 12 · portão");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ESTA ROTA E O LUGAR ESCONDIDO (Tarefa 4, 2026-09-27). A coluna `oculto`
// nasceu noutro arquivo, mas ela muda DUAS coisas aqui, e as duas em silêncio se
// ninguém escrever o argumento certo.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — e o lugar escondido", () => {
  const VEU = "veu-de-noiva-de-bonito";

  /** Esconde um lugar como o painel fará: versão nova, MESMO documento,
   *  `oculto = true`. Nunca um UPDATE. */
  const esconder = (slug: string, doc: Ficha) =>
    gravarVersao(c, slug, JSON.stringify(doc), "painel", AGORA + 5, true);

  // 🔴 A1 — O PORTÃO DE COERÊNCIA TEM DE VER O ACERVO INTEIRO, INCLUSIVE O
  // ESCONDIDO. É o P3 da rodada, e o buraco tem três passos: esconder o Véu →
  // copiar a voz dele na Rampa → mostrar o Véu de novo → o acervo PÚBLICO fica
  // com duas fichas dizendo a mesma coisa, que é exatamente o que
  // `texto-emprestado` existe pra pegar. Esconder não apaga, e **lugar escondido
  // volta**: se este portão medisse contra o acervo público, ele ficaria
  // permissivo EM SILÊNCIO no minuto em que a coluna nasceu.
  it("o portão vê o lugar ESCONDIDO: copiar a voz de um lugar oculto ainda dá 409", async () => {
    const veu = acervo.find((f) => f.slug === VEU)!;
    await esconder(VEU, veu);
    expect(
      (await versoesAtuais(c)).has(VEU),
      "a premissa deste caso: pro leitor público o Véu já não está no acervo",
    ).toBe(false);

    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: veu.voz }, cookieBom));

    expect(res.status, await res.text()).toBe(409);
    // E nada foi gravado: a voz da Rampa continua sendo a dela.
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe(ficha.voz);
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  // 🔴 A4 — ESCONDER É TIRAR DO PÚBLICO, NÃO TIRAR DO DONO. A rota tem de
  // continuar aceitando a edição de um lugar escondido, senão esconder tranca a
  // ficha para sempre.
  it("editar um campo de um lugar ESCONDIDO: 200, e a ficha muda", async () => {
    await esconder(SLUG, ficha);

    const res = await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("texto novo");
  });

  // 🔴 E O OUTRO LADO DO MESMO CASO, que é o defeito de verdade: `gravarVersao`
  // tem `oculto = false` por padrão, então uma rota que o chame SEM o argumento
  // DESESCONDE o lugar a cada edição de campo. O dono esconde um lugar, conserta
  // um typo pelo celular, e o lugar volta ao público sem ele pedir — uma decisão
  // de produto tomada de carona por um argumento omitido. A versão nova HERDA a
  // visibilidade da atual.
  it("editar um campo de um lugar escondido NÃO o devolve ao ar", async () => {
    await esconder(SLUG, ficha);

    await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));

    expect((await versaoAtual(c, SLUG))!.oculto, "a edição de campo não pode desesconder").toBe(true);
    expect((await versoesAtuais(c)).has(SLUG), "e o público continua sem ver").toBe(false);
  });

  // O ramo simétrico: num lugar que está NO AR, a edição não o esconde. Sem este
  // caso, trocar a herança por um `true` cravado passaria verde no de cima.
  it("editar um campo de um lugar que está no ar o mantém no ar", async () => {
    await PUT(pedido({ slug: SLUG, campo: "voz", valor: "texto novo" }, cookieBom));

    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
    expect((await versoesAtuais(c)).has(SLUG)).toBe(true);
  });

  // 🔴 "VOLTAR" RESTAURA O DOCUMENTO, NUNCA A VISIBILIDADE — e a que vale é a DE
  // AGORA, não a que a versão antiga carregava. Se viesse da versão restaurada,
  // voltar a uma versão de antes de o lugar ser escondido o devolveria AO AR em
  // silêncio: a mesma família do defeito da semente, agora pela porta do arquivo
  // histórico. Visibilidade só muda por /api/admin/visibilidade.
  it('"voltar" num lugar escondido devolve o documento e NÃO devolve o lugar ao ar', async () => {
    const antiga = await gravarVersao(
      c, SLUG, JSON.stringify({ ...ficha, voz: "a voz de antes" }), "painel", AGORA + 1,
    );
    await esconder(SLUG, ficha);

    const res = await PUT(pedido({ slug: SLUG, versaoId: antiga }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    const atual = await versaoAtual(c, SLUG);
    expect(JSON.parse(atual!.doc).voz).toBe("a voz de antes");
    expect(atual!.oculto, "voltar restaura o DOCUMENTO, nunca a visibilidade").toBe(true);
  });

  it('"voltar" num lugar que está no ar o mantém no ar', async () => {
    const antiga = await gravarVersao(
      c, SLUG, JSON.stringify({ ...ficha, voz: "a voz de antes" }), "painel", AGORA + 1,
    );
    await gravarVersao(c, SLUG, JSON.stringify(ficha), "painel", AGORA + 2);

    const res = await PUT(pedido({ slug: SLUG, versaoId: antiga }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A REGRA DE CHUVA NA PORTA — onda de conserto 1 da Tarefa 7 (2026-10-01).
describe("PUT /api/admin/ficha — a regra de chuva: o teto do provedor e as janelas zero", () => {
  const nomeDe = (f: Ficha) => f.trajeto.waypoints[0].nome;
  const regraGravada = async () =>
    (JSON.parse((await versaoAtual(c, SLUG))!.doc) as Ficha).condicao.regra;

  // 🔴 F2: `480` no lugar de `48`. Antes desta onda a porta gravava com 200, e a
  // busca da tela inicial (uma só, com a maior janela do acervo) passava a ser
  // recusada pela Open-Meteo — todos os lugares PÚBLICOS sem informação.
  // ⚠️ A frase não afirma isso desde a onda de conserto 2: é falso pra lugar
  // oculto (a home não o lê). Ela diz só o que vale sempre: a busca é recusada.
  for (const [campo, valor, lado] of [
    ["janela_previsao_horas", 385, "pra frente"],
    ["janela_previsao_horas", 480, "pra frente"],
    ["janela_passado_horas", 2233, "pra trás"],
  ] as const) {
    it(`${campo} = ${valor}: 409 com a frase do teto, e nada gravado`, async () => {
      const res = await PUT(pedido({ slug: SLUG, campo: `condicao.regra.${campo}`, valor }, cookieBom));

      expect(res.status).toBe(409);
      const frase = await res.text();
      expect(frase).toContain(nomeDe(ficha));
      expect(frase).toContain(`${valor} horas ${lado}`);
      expect(frase).toContain("a busca de chuva é recusada");
      expect(frase, "a frase voltou a afirmar o que é falso pra lugar oculto").not.toContain("todos os lugares");
      expect(await historico(c, SLUG)).toHaveLength(1);
    });
  }

  it("no teto exato (384 pra frente, 2232 pra trás) a porta grava", async () => {
    const a = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_previsao_horas", valor: 384 }, cookieBom));
    expect(a.status, await a.text()).toBe(200);
    const b = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_passado_horas", valor: 2232 }, cookieBom));
    expect(b.status, await b.text()).toBe(200);
    expect(await regraGravada()).toMatchObject({ janela_previsao_horas: 384, janela_passado_horas: 2232 });
  });

  // 🔴 DECISÃO DO JOÃO, 2026-10-01: previsão zero vale — "só olhar a chuva que
  // já caiu". A porta grava.
  it("previsão 0: a porta GRAVA (200)", async () => {
    expect(ficha.condicao.regra.janela_passado_horas, "a premissa: o passado está vivo").toBeGreaterThan(0);

    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_previsao_horas", valor: 0 }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await regraGravada()).janela_previsao_horas).toBe(0);
  });

  // 🔴 E O PAR QUE NUNCA FECHA CONTINUA 409: com a previsão já zero, zerar o
  // passado deixa a regra cega pra toda chuva — e a frase que ele lê diz isso.
  it("previsão 0 E passado 0: 409, com a frase de que o lugar nunca fecha", async () => {
    const semPrevisao = {
      ...ficha,
      condicao: { ...ficha.condicao, regra: { ...ficha.condicao.regra, janela_previsao_horas: 0 } },
    };
    await gravarVersao(c, SLUG, JSON.stringify(semPrevisao), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_passado_horas", valor: 0 }, cookieBom));

    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toContain("pra trás");
    expect(frase).toContain("nunca fecha");
    expect((await regraGravada()).janela_passado_horas).toBe(ficha.condicao.regra.janela_passado_horas);
  });

  // 🔴 DECISÃO DO JOÃO, 2026-10-01, simétrica: passado zero vale também — a regra
  // fecha pela previsão. A porta grava.
  it("passado 0: a porta GRAVA (200)", async () => {
    expect(ficha.condicao.regra.janela_previsao_horas, "a premissa: a previsão está viva").toBeGreaterThan(0);

    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_passado_horas", valor: 0 }, cookieBom));

    expect(res.status, await res.text()).toBe(200);
    expect((await regraGravada()).janela_passado_horas).toBe(0);
  });

  // O par pelo OUTRO lado: com o passado já zero, zerar a previsão é o que fecha
  // o par — e a frase que sai é a mesma, verdadeira nele.
  it("passado 0 E previsão 0 (zerando a previsão por último): 409, nunca fecha", async () => {
    const semPassado = {
      ...ficha,
      condicao: { ...ficha.condicao, regra: { ...ficha.condicao.regra, janela_passado_horas: 0 } },
    };
    await gravarVersao(c, SLUG, JSON.stringify(semPassado), "semente", AGORA);

    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_previsao_horas", valor: 0 }, cookieBom));

    expect(res.status).toBe(409);
    expect(await res.text()).toContain("nunca fecha");
    expect((await regraGravada()).janela_previsao_horas).toBe(ficha.condicao.regra.janela_previsao_horas);
  });

  it("passado negativo: 409, e a frase não diz que o lugar nunca fecha", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_passado_horas", valor: -5 }, cookieBom));

    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).not.toContain("nunca fecha");
    expect(frase).toContain("-5 horas pra trás");
  });

  it("previsão negativa: 409, e a frase não diz que o lugar nunca fecha", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.regra.janela_previsao_horas", valor: -5 }, cookieBom));

    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).not.toContain("nunca fecha");
    expect(frase).toContain("use 0");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 O PONTO DO TRAJETO GRAVA ATÔMICO (Tarefa 8, onda de conserto 1, R1). A
// ruling anterior mandava DOIS `PUT`s em série (`.lat` e `.lng`), e uma falha de
// rede no meio publicava um ponto que ninguém escolheu (latitude nova com
// longitude velha). A forma `{slug, ponto, lat, lng}` grava as duas folhas numa
// versão só, ou nenhuma.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — a forma `{slug, ponto, lat, lng}`", () => {
  const NOVO = { lat: -8.123456, lng: -36.654321 };

  it("grava a latitude E a longitude do ponto numa versão só, com autor painel", async () => {
    const res = await PUT(pedido({ slug: SLUG, ponto: 0, ...NOVO }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await historico(c, SLUG), "duas versões: a semente e UMA nova").toHaveLength(2);
    const atual = await versaoAtual(c, SLUG);
    expect(atual!.autor).toBe("painel");
    const doc = JSON.parse(atual!.doc) as Ficha;
    expect(doc.trajeto.waypoints[0].lat).toBe(NOVO.lat);
    expect(doc.trajeto.waypoints[0].lng).toBe(NOVO.lng);
    // e o resto do ponto (e da ficha) não mudou
    expect(doc.trajeto.waypoints[0].nome).toBe(ficha.trajeto.waypoints[0].nome);
    expect(doc.condicao.coords).toEqual(ficha.condicao.coords);
    expect(doc.voz).toBe(ficha.voz);
  });

  it("a versão nova herda a visibilidade: ponto gravado num lugar escondido não o devolve ao ar", async () => {
    await gravarVersao(c, SLUG, JSON.stringify(ficha), "painel", AGORA + 5, true);
    const res = await PUT(pedido({ slug: SLUG, ponto: 0, ...NOVO }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  // Mutuamente exclusiva com as outras três formas, pela PRESENÇA da chave.
  for (const [nome, corpo] of [
    ["ponto + campo/valor", { ponto: 0, ...NOVO, campo: "voz", valor: "x" }],
    ["ponto + versaoId", { ponto: 0, ...NOVO, versaoId: 1 }],
    ["ponto + naoSei", { ponto: 0, ...NOVO, naoSei: true }],
    ["campo/valor + lat", { campo: "trajeto.waypoints.0.lat", valor: NOVO.lat, lat: NOVO.lat }],
    ["campo/valor + lng", { campo: "trajeto.waypoints.0.lng", valor: NOVO.lng, lng: NOVO.lng }],
  ] as const) {
    it(`corpo misto (${nome}): 400, e nada é gravado`, async () => {
      const res = await PUT(pedido({ slug: SLUG, ...corpo }, cookieBom));
      expect(res.status).toBe(400);
      expect(await historico(c, SLUG)).toHaveLength(1);
    });
  }

  for (const [nome, corpo] of [
    ["sem lat", { ponto: 0, lng: NOVO.lng }],
    ["sem lng", { ponto: 0, lat: NOVO.lat }],
    ["sem ponto", { ...NOVO }],
    ["ponto texto", { ponto: "0", ...NOVO }],
    ["ponto fracionário", { ponto: 0.5, ...NOVO }],
    ["ponto negativo", { ponto: -1, ...NOVO }],
    ["lat texto", { ponto: 0, lat: "-8.1", lng: NOVO.lng }],
  ] as const) {
    it(`corpo malformado (${nome}): 400 SEM frase (a forma do corpo é da rota), e nada é gravado`, async () => {
      const res = await PUT(pedido({ slug: SLUG, ...corpo }, cookieBom));
      expect(res.status).toBe(400);
      // 🔴 Corpo vazio: quem recusou foi a conferência de FORMA da rota, não a
      // escrita lá embaixo (que recusaria `0.5` com frase própria). Sem isto, a
      // conferência de inteiro podia sumir e o caso ficaria verde pelo motivo
      // errado.
      expect(await res.text()).toBe("");
      expect(await historico(c, SLUG)).toHaveLength(1);
    });
  }

  it("ponto que a ficha não tem: 400 COM frase, e não cria ponto", async () => {
    const n = ficha.trajeto.waypoints.length;
    const res = await PUT(pedido({ slug: SLUG, ponto: n, ...NOVO }, cookieBom));
    expect(res.status).toBe(400);
    expect((await res.text()).trim(), "a recusa tem de dizer o porquê").not.toBe("");
    expect(await historico(c, SLUG)).toHaveLength(1);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).trajeto.waypoints).toHaveLength(n);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 COORDENADA FINITA E NA FAIXA, NO SCHEMA (Tarefa 8, onda 1, R2). Até aqui
// `{lng: 1e999}` era ACEITO, o documento gravado (`null`) não relia e o lugar
// saía do ar — o mesmo buraco que a Task 7 fechou nos números do motor. E
// `{lat: 200}` gravava um ponto fora do planeta.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — coordenada fora do planeta não entra", () => {
  const cru = (texto: string): Request =>
    new Request("http://x/api/admin/ficha", {
      method: "PUT",
      headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
      body: texto,
    });
  const LNG = -36.8;
  const casos: [string, () => Request][] = [
    ["par com lat 200", () => pedido({ slug: SLUG, campo: "condicao.coords", valor: { lat: 200, lng: LNG } }, cookieBom)],
    ["par com lng 500", () => pedido({ slug: SLUG, campo: "condicao.coords", valor: { lat: -8, lng: 500 } }, cookieBom)],
    ["par com lng 1e999", () => cru(`{"slug":"${SLUG}","campo":"condicao.coords","valor":{"lat":-8,"lng":1e999}}`)],
    ["metade lat 200", () => pedido({ slug: SLUG, campo: "trajeto.waypoints.0.lat", valor: 200 }, cookieBom)],
    ["metade lng 500", () => pedido({ slug: SLUG, campo: "trajeto.waypoints.0.lng", valor: 500 }, cookieBom)],
    ["metade lat 1e999", () => cru(`{"slug":"${SLUG}","campo":"trajeto.waypoints.0.lat","valor":1e999}`)],
    ["ponto com lat 200", () => pedido({ slug: SLUG, ponto: 0, lat: 200, lng: LNG }, cookieBom)],
    ["ponto com lng 500", () => pedido({ slug: SLUG, ponto: 0, lat: -8, lng: 500 }, cookieBom)],
    ["ponto com lng 1e999", () => cru(`{"slug":"${SLUG}","ponto":0,"lat":-8,"lng":1e999}`)],
  ];
  for (const [nome, req] of casos) {
    it(`${nome}: recusado antes de gravar`, async () => {
      const res = await PUT(req());
      expect([400, 409], `status ${res.status}`).toContain(res.status);
      expect(await historico(c, SLUG)).toHaveLength(1);
    });
  }

  // O controle: a faixa não tranca coordenada de verdade, inclusive nas bordas.
  it("as bordas da faixa entram (lat ±90, lng ±180)", async () => {
    const res = await PUT(pedido({ slug: SLUG, campo: "condicao.coords", valor: { lat: -90, lng: 180 } }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 A CADEIA DO TRAJETO PELO CELULAR (Tarefa 10, C1 da auditoria). Até aqui a
// porta gravava UM campo de um ponto que JÁ existia, e não havia como criar o
// `waypoints[1]`: a cadeia só nasceria por semente, que é código — o contrário da
// lei do projeto. Duas formas novas, e só duas: ACRESCENTAR um ponto no FIM e
// TIRAR o ÚLTIMO. `waypoints[0]` é O LUGAR, e nenhuma das duas o toca.
//
// Todo lugar daqui é FIXTURE (`tests/ficha-de-tres-pontos.ts`), plantado no banco
// `:memory:` do arquivo: nenhum lugar real ganha etapa, nem em teste.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — as etapas do trajeto (`acrescentarEtapa` / `tirarEtapa`)", () => {
  const T = TRES_PONTOS.slug;
  const plantar = (f: Ficha, oculto = false) =>
    gravarVersao(c, f.slug, JSON.stringify(f), "semente", AGORA - 10, oculto);
  const docDe = async (slug: string) => JSON.parse((await versaoAtual(c, slug))!.doc) as Ficha;
  /** 🔴 A POSIÇÃO QUE O DONO MARCOU NO MAPA (onda de conserto 1). Ela é
   *  diferente de TODO ponto da fixture de propósito: um ponto novo que saísse
   *  com a coordenada copiada de qualquer ponto existente falha a igualdade
   *  exata. Até a onda 1 a porta COPIAVA a do último, e a ficha pública
   *  afirmava como fato, com "Abrir no mapa", uma posição que ninguém deu. */
  const MARCADO = { lat: -8.471234, lng: -36.271234 };
  const UM_PONTO: Ficha = {
    ...tresPontos(),
    slug: "lugar-de-um-ponto-teste",
    trajeto: { waypoints: [tresPontos().trajeto.waypoints[0]] },
  };

  it("acrescentar: grava UMA versão com o ponto novo no FIM, na coordenada que o DONO mandou, e o lugar intocado", async () => {
    await plantar(TRES_PONTOS);
    const res = await PUT(pedido({ slug: T, acrescentarEtapa: { nome: "Quarto ponto", ...MARCADO } }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await historico(c, T), "a fixture e UMA versão nova").toHaveLength(2);
    expect((await versaoAtual(c, T))!.autor).toBe("painel");

    const [w0, w1, w2, w3, ...resto] = (await docDe(T)).trajeto.waypoints;
    expect(resto).toEqual([]);
    // 🔴 O LUGAR NÃO SE MEXE — nem nome, nem coordenada, nem posição.
    expect(w0).toEqual(TRES_PONTOS.trajeto.waypoints[0]);
    expect([w1.nome, w2.nome, w3.nome]).toEqual([SEGUNDO, TERCEIRO, "Quarto ponto"]);
    // A coordenada é EXATAMENTE a do corpo — a que o dono marcou no mapa —, e
    // nunca uma cópia de outro ponto. Sem nota: nada é pré-preenchido.
    expect(w3).toEqual({ nome: "Quarto ponto", ...MARCADO });
    expect([w2.lat, w2.lng], "a premissa: a marcada não é a do último").not.toEqual([MARCADO.lat, MARCADO.lng]);
  });

  it("acrescentar num lugar de UM ponto: o lugar continua o primeiro, e o novo vira o segundo", async () => {
    await plantar(UM_PONTO);
    const res = await PUT(pedido({ slug: UM_PONTO.slug, acrescentarEtapa: { nome: "Ponto marcador", ...MARCADO } }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    const pontos = (await docDe(UM_PONTO.slug)).trajeto.waypoints;
    expect(pontos.map((w) => w.nome)).toEqual([UM_PONTO.trajeto.waypoints[0].nome, "Ponto marcador"]);
    // e a primeira etapa NÃO nasce em cima do destino (o Critical 1 da revisão)
    expect(pontos[1]).toEqual({ nome: "Ponto marcador", ...MARCADO });
  });

  it("acrescentar herda a visibilidade: num lugar escondido, a versão nova continua escondida", async () => {
    await plantar(TRES_PONTOS, true);
    const res = await PUT(pedido({ slug: T, acrescentarEtapa: { nome: "Quarto ponto", ...MARCADO } }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect((await versaoAtual(c, T))!.oculto, "acrescentar ponto não pode desesconder").toBe(true);
  });

  it("acrescentar num lugar no ar o mantém no ar", async () => {
    await plantar(TRES_PONTOS);
    await PUT(pedido({ slug: T, acrescentarEtapa: { nome: "Quarto ponto", ...MARCADO } }, cookieBom));
    expect((await versaoAtual(c, T))!.oculto).toBe(false);
  });

  it("acrescentar com nome em branco: 400 COM frase, e nada é gravado", async () => {
    await plantar(TRES_PONTOS);
    const res = await PUT(pedido({ slug: T, acrescentarEtapa: { nome: "   ", ...MARCADO } }, cookieBom));
    expect(res.status).toBe(400);
    expect((await res.text()).trim(), "a recusa tem de dizer o porquê").not.toBe("");
    expect(await historico(c, T)).toHaveLength(1);
  });

  for (const [nome, carga] of [
    ["texto em vez de objeto", "Quarto ponto"],
    ["objeto vazio", {}],
    ["sem nome", { lat: -8.47, lng: -36.27 }],
    ["nome número", { nome: 4, lat: -8.47, lng: -36.27 }],
    // 🔴 onda de conserto 1: a coordenada é OBRIGATÓRIA. Sem ela não existe
    // ponto, e a porta não inventa uma.
    ["só o nome (sem lat/lng)", { nome: "Quarto ponto" }],
    ["sem lat", { nome: "Quarto ponto", lng: -36.27 }],
    ["sem lng", { nome: "Quarto ponto", lat: -8.47 }],
    ["lat texto", { nome: "Quarto ponto", lat: "-8.47", lng: -36.27 }],
    ["chave a mais (nota)", { nome: "Quarto ponto", lat: -8.47, lng: -36.27, nota: "x" }],
    ["null", null],
  ] as const) {
    it(`acrescentar malformado (${nome}): 400 SEM frase, e nada é gravado`, async () => {
      await plantar(TRES_PONTOS);
      const res = await PUT(pedido({ slug: T, acrescentarEtapa: carga }, cookieBom));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("");
      expect(await historico(c, T)).toHaveLength(1);
    });
  }

  it("acrescentar com coordenada fora do planeta: recusado, e nada é gravado", async () => {
    await plantar(TRES_PONTOS);
    const res = await PUT(pedido({ slug: T, acrescentarEtapa: { nome: "Quarto ponto", lat: 200, lng: -36 } }, cookieBom));
    expect([400, 409]).toContain(res.status);
    expect(await historico(c, T)).toHaveLength(1);
  });

  // 🔴 A FRONTEIRA DE DOIS PONTOS (Critical 2 da revisão). Lugar + UMA etapa é o
  // estado logo depois do primeiro "acrescentar", e tirar o último ali é tirar a
  // única etapa — o caso que mais vai acontecer, e o que nenhuma prova cobria.
  it("tirar a ÚNICA etapa (trajeto de DOIS pontos): 200, UMA versão, e sobra só o lugar", async () => {
    const dois = doisPontos();
    await plantar(dois);
    const res = await PUT(pedido({ slug: dois.slug, tirarEtapa: 1 }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await historico(c, dois.slug)).toHaveLength(2);
    expect((await docDe(dois.slug)).trajeto.waypoints).toEqual([dois.trajeto.waypoints[0]]);
  });

  // 🔴 m3 da revisão: num trajeto de UM ponto, `tirarEtapa: 1` pede o Ponto 2,
  // que NÃO EXISTE — e a resposta era a frase do lugar, sobre outro assunto.
  // Agora é a recusa de item inexistente que a porta já tinha (a mesma de
  // `escrever`), e o 3 num trajeto de 3 cai nela também.
  for (const [quem, f, n, tem] of [
    ["um ponto", () => UM_PONTO, 1, 1],
    ["três pontos", () => TRES_PONTOS, 3, 3],
  ] as const) {
    it(`tirar um ponto que NÃO EXISTE (${n}, ${quem}): 400 com a frase do item inexistente`, async () => {
      await plantar(f());
      const res = await PUT(pedido({ slug: f().slug, tirarEtapa: n }, cookieBom));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe(`não existe o item ${n} nesta lista (ela tem ${tem})`);
      expect(await historico(c, f().slug)).toHaveLength(1);
    });
  }

  it("tirar o ÚLTIMO: grava UMA versão sem ele, e os outros intocados", async () => {
    await plantar(TRES_PONTOS);
    const res = await PUT(pedido({ slug: T, tirarEtapa: 2 }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await historico(c, T)).toHaveLength(2);
    expect((await versaoAtual(c, T))!.autor).toBe("painel");
    expect((await docDe(T)).trajeto.waypoints).toEqual(TRES_PONTOS.trajeto.waypoints.slice(0, 2));
  });

  it("tirar herda a visibilidade: num lugar escondido, a versão nova continua escondida", async () => {
    await plantar(TRES_PONTOS, true);
    const res = await PUT(pedido({ slug: T, tirarEtapa: 2 }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect((await versaoAtual(c, T))!.oculto, "tirar ponto não pode desesconder").toBe(true);
  });

  // 🔴 O `[0]` É O LUGAR. A porta recusa com 409 e a frase que diz POR QUÊ — e
  // nos DOIS formatos de ficha: com um ponto só (onde `0` também seria "o
  // último", e só a regra do lugar o segura) e com três (onde a frase tem de ser
  // a do LUGAR, não a de "só o último sai").
  for (const [quem, f] of [
    ["um ponto", () => UM_PONTO],
    ["três pontos", () => TRES_PONTOS],
  ] as const) {
    it(`tirar o ponto 0 (${quem}): 409 com a frase do lugar, e nada é gravado`, async () => {
      await plantar(f());
      const res = await PUT(pedido({ slug: f().slug, tirarEtapa: 0 }, cookieBom));
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(RECUSA_TIRAR_O_LUGAR);
      expect(await historico(c, f().slug)).toHaveLength(1);
      expect((await docDe(f().slug)).trajeto.waypoints[0]).toEqual(f().trajeto.waypoints[0]);
    });
  }

  for (const n of [1]) {
    it(`tirar um ponto que não é o último (${n}, num trajeto de 3): 409 COM frase, e nada é gravado`, async () => {
      await plantar(TRES_PONTOS);
      const res = await PUT(pedido({ slug: T, tirarEtapa: n }, cookieBom));
      expect(res.status).toBe(409);
      const frase = await res.text();
      expect(frase.trim()).not.toBe("");
      expect(frase, "a frase do lugar é outra recusa").not.toBe(RECUSA_TIRAR_O_LUGAR);
      expect(await historico(c, T)).toHaveLength(1);
    });
  }

  for (const [nome, carga] of [
    ["texto", "2"],
    ["fracionário", 1.5],
    ["negativo", -1],
    ["null", null],
  ] as const) {
    it(`tirar malformado (${nome}): 400 SEM frase, e nada é gravado`, async () => {
      await plantar(TRES_PONTOS);
      const res = await PUT(pedido({ slug: T, tirarEtapa: carga }, cookieBom));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("");
      expect(await historico(c, T)).toHaveLength(1);
    });
  }

  it("tirar com índice que o JSON.parse vira Infinity: 400, e nada é gravado", async () => {
    await plantar(TRES_PONTOS);
    const res = await PUT(
      new Request("http://x/api/admin/ficha", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: `{"slug":"${T}","tirarEtapa":1e999}`,
      }),
    );
    expect(res.status).toBe(400);
    expect(await historico(c, T)).toHaveLength(1);
  });

  // Mutuamente exclusivas com as outras formas — e ENTRE SI —, pela PRESENÇA da chave.
  for (const [nome, corpo] of [
    ["acrescentar + tirar", { acrescentarEtapa: { nome: "x", lat: -8.47, lng: -36.27 }, tirarEtapa: 2 }],
    ["acrescentar + campo/valor", { acrescentarEtapa: { nome: "x", lat: -8.47, lng: -36.27 }, campo: "voz", valor: "y" }],
    ["acrescentar + naoSei", { acrescentarEtapa: { nome: "x", lat: -8.47, lng: -36.27 }, campo: "piso", naoSei: true }],
    ["acrescentar + ponto", { acrescentarEtapa: { nome: "x", lat: -8.47, lng: -36.27 }, ponto: 0, lat: -8, lng: -36 }],
    ["acrescentar + versaoId", { acrescentarEtapa: { nome: "x", lat: -8.47, lng: -36.27 }, versaoId: 1 }],
    ["tirar + campo/valor", { tirarEtapa: 2, campo: "voz", valor: "y" }],
    ["tirar + ponto", { tirarEtapa: 2, ponto: 0, lat: -8, lng: -36 }],
    ["tirar + versaoId", { tirarEtapa: 2, versaoId: 1 }],
    ["tirar + lat solta", { tirarEtapa: 2, lat: -8 }],
  ] as const) {
    it(`corpo misto (${nome}): 400, e nada é gravado`, async () => {
      await plantar(TRES_PONTOS);
      const res = await PUT(pedido({ slug: T, ...corpo }, cookieBom));
      expect(res.status).toBe(400);
      expect(await historico(c, T)).toHaveLength(1);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 TODA FORMA DE CORPO PASSA PELO PORTÃO DE COERÊNCIA (C7, herdado da Tarefa
// 8). A rota tem UM caminho até o banco pra toda forma de edição (`mudar` → o
// portão → `gravarVersao`), e o risco é uma forma nova ganhar um atalho. Com
// regra real ninguém prova isso pra PONTO nem pra ETAPA, porque nenhuma regra
// olha coordenada nem cadeia. A regra FANTASMA acusa o lugar sempre que o
// documento dele MUDA — então toda edição válida dela vira uma violação
// INTRODUZIDA, e tem de voltar 409 com a frase, sem gravar.
//
// O controle de cada caso (a mesma edição SEM a fantasma → 200) é o que impede o
// 409 de ser outra recusa qualquer com a mesma cara.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — o portão de coerência vale pra TODA forma de corpo", () => {
  const T = TRES_PONTOS.slug;
  const FRASE_FANTASMA = "frase da regra fantasma deste arquivo";

  beforeEach(async () => {
    await gravarVersao(c, T, JSON.stringify(TRES_PONTOS), "semente", AGORA - 10);
  });

  /** Acusa o lugar `T` sempre que o documento dele não é mais o da fixture —
   *  comparado DEPOIS do `fichaSchema.parse`, que é como a rota o entrega à
   *  coerência (a ordem das chaves é a do schema). */
  function ligarFantasma(): void {
    const base = JSON.stringify(fichaSchema.parse(TRES_PONTOS));
    fantasma.regra = (fichas) =>
      fichas
        .filter((f) => f.slug === T && JSON.stringify(f) !== base)
        .map((f) => ({ regra: "regra-fantasma", slug: f.slug, frase: FRASE_FANTASMA }));
  }

  const FORMAS: [string, Record<string, unknown>][] = [
    ["campo/valor", { campo: "voz", valor: "outra voz marcadora" }],
    ["campo/naoSei", { campo: "trajeto.waypoints.1.nota", naoSei: true }],
    ["ponto", { ponto: 1, lat: -8.5, lng: -36.5 }],
    ["acrescentarEtapa", { acrescentarEtapa: { nome: "Quarto ponto", lat: -8.47, lng: -36.27 } }],
    ["tirarEtapa", { tirarEtapa: 2 }],
  ];

  for (const [nome, corpo] of FORMAS) {
    it(`${nome}: com a regra fantasma ligada, 409 com a frase dela, e nada é gravado`, async () => {
      ligarFantasma();
      const res = await PUT(pedido({ slug: T, ...corpo }, cookieBom));
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(FRASE_FANTASMA);
      expect(await historico(c, T)).toHaveLength(1);
    });

    it(`${nome}: o controle — sem a fantasma, a MESMA edição grava (200)`, async () => {
      const res = await PUT(pedido({ slug: T, ...corpo }, cookieBom));
      expect(res.status, await res.text()).toBe(200);
      expect(await historico(c, T)).toHaveLength(2);
    });
  }

  // ⚠️ A EXCEÇÃO, escrita como prova pra não virar esquecimento: "voltar" grava
  // VERBATIM e NÃO passa pela coerência, de propósito (ver o comentário do
  // portão na rota — voltar a uma versão que o acervo de hoje reprova é
  // permitido, e é por isso que o portão mede DIFERENÇA e não "tem violação").
  it("versaoId: NÃO passa pelo portão, de propósito — com a fantasma ligada, volta igual (200)", async () => {
    const antiga = await gravarVersao(
      c,
      T,
      JSON.stringify({ ...TRES_PONTOS, voz: "uma voz antiga marcadora" }),
      "painel",
      AGORA - 5,
    );
    await gravarVersao(c, T, JSON.stringify(TRES_PONTOS), "painel", AGORA - 1);
    ligarFantasma();
    const res = await PUT(pedido({ slug: T, versaoId: antiga }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ONDA DE FIX DA TAREFA 11b — O PAR (NOME, CIDADE) TAMBÉM NA FICHA NO AR (X4),
// e a cidade sem letra recusada aqui também (X3).
//
// Renomear um lugar publicado, ou mudar a cidade dele, passa pela MESMA
// conferência do lugar novo (`parOcupado`, de `src/lib/par-de-lugar.ts`): o par
// de OUTRO lugar (no ar, escondido) ou de um rascunho é 409, e o próprio par
// nunca colide consigo. Os lugares aqui são MARCADORES gravados neste banco de
// teste — nenhuma cidade real, nenhuma cidade nas fichas reais.
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/admin/ficha — o par (nome, cidade) e a cidade sem letra (onda de fix da 11b)", () => {
  const CAMPO_NOME = "trajeto.waypoints.0.nome";
  const CIDADE = "Cidade Marcador Um";
  const OUTRA_CIDADE = "Cidade Marcador Dois";
  const B = "marcador-lugar-b";

  /** Um lugar marcador no ar (ou escondido): o documento de `outra`, com slug,
   *  nome e (se houver) cidade escolhidos aqui. */
  async function lugar(slug: string, nome: string, cidade?: string, oculto = false): Promise<void> {
    const [primeiro, ...resto] = outra.trajeto.waypoints;
    const doc = {
      ...outra,
      slug,
      ...(cidade === undefined ? {} : { cidade }),
      trajeto: { ...outra.trajeto, waypoints: [{ ...primeiro, nome }, ...resto] },
    };
    await gravarVersao(c, slug, JSON.stringify(doc), "painel", AGORA - 10, oculto);
  }

  beforeEach(async () => {
    await lugar(B, "Lugar Marcador Dois", OUTRA_CIDADE);
  });

  it("renomear pro par de OUTRO lugar no ar, ou ESCONDIDO: 409 com o nome e a cidade DELE, nada gravado", async () => {
    await lugar("marcador-lugar-a", "Lugar Marcador Um", OUTRA_CIDADE);
    await lugar("marcador-lugar-escondido", "Lugar Marcador Escondido", OUTRA_CIDADE, true);
    for (const [valor, frase] of [
      ["lugar  MARCADOR um", parDeLugar(`Lugar Marcador Um (${OUTRA_CIDADE})`)],
      ["Lugar Marcador Escondido", parDeLugar(`Lugar Marcador Escondido (${OUTRA_CIDADE})`)],
    ] as const) {
      const res = await PUT(pedido({ slug: B, campo: CAMPO_NOME, valor }, cookieBom));
      expect(res.status, valor).toBe(409);
      expect(await res.text(), valor).toBe(frase);
    }
    expect(await historico(c, B)).toHaveLength(1);
  });

  it("renomear pro par de um RASCUNHO: 409 com a frase do rascunho, nada gravado", async () => {
    const doc = { slug: "marcador-rascunho", modos: [], cidade: OUTRA_CIDADE, trajeto: { waypoints: [{ nome: "Lugar Marcador Tres" }] } };
    await salvarRascunho(c, "marcador-rascunho", JSON.stringify(doc), AGORA);
    const res = await PUT(pedido({ slug: B, campo: CAMPO_NOME, valor: "Lugar Marcador Três" }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeRascunho(`Lugar Marcador Tres (${OUTRA_CIDADE})`));
    expect(await historico(c, B)).toHaveLength(1);
  });

  it("mudar a cidade pra a de OUTRO lugar de mesmo nome: 409, nada gravado", async () => {
    await lugar("marcador-lugar-gemeo", "Lugar Marcador Dois", CIDADE);
    const res = await PUT(pedido({ slug: B, campo: "cidade", valor: "cidade marcador UM" }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(`Lugar Marcador Dois (${CIDADE})`));
    expect(await historico(c, B)).toHaveLength(1);
  });

  // X2 aqui também: o nome de um lugar SEM cidade espera a cidade dele.
  it("renomear pro nome de um lugar SEM cidade: 409 pedindo a cidade dele, nada gravado", async () => {
    await lugar("marcador-lugar-sem-cidade", "Lugar Marcador Sete");
    const res = await PUT(pedido({ slug: B, campo: CAMPO_NOME, valor: "lugar marcador sete" }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade("Lugar Marcador Sete"));
    expect(await historico(c, B)).toHaveLength(1);
  });

  // 🔴 O PRÓPRIO par, noutra grafia, PRIMEIRO: só passa porque o lugar não
  // colide consigo mesmo. Depois, o nome de um lugar de OUTRA cidade é livre.
  it("o PRÓPRIO par noutra grafia, e o nome de um lugar de OUTRA cidade: 200, e grava", async () => {
    await lugar("marcador-lugar-longe", "Lugar Marcador Oito", CIDADE);
    for (const [campo, valor] of [
      [CAMPO_NOME, "LUGAR marcador DOIS"],
      ["cidade", "cidade marcador dois"],
      [CAMPO_NOME, "Lugar Marcador Oito"],
    ] as const) {
      const res = await PUT(pedido({ slug: B, campo, valor }, cookieBom));
      expect(res.status, `${campo}=${valor}: ${await res.clone().text()}`).toBe(200);
    }
    expect(await historico(c, B)).toHaveLength(4);
  });

  // 🔴 X3: `"--"` virava "Rampa do Pepê — -- · BatePerna" no título do link.
  it("cidade sem letra nem número: 400 com a frase do POST, e nada gravado", async () => {
    for (const valor of ["--", " ... ", "—"]) {
      const res = await PUT(pedido({ slug: SLUG, campo: "cidade", valor }, cookieBom));
      expect(res.status, valor).toBe(400);
      expect(await res.text(), valor).toBe(CIDADE_SEM_LETRA);
    }
    expect(await historico(c, SLUG)).toHaveLength(1);
  });
});
