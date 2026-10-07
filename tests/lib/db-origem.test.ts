import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apagarRascunho,
  criarRascunho,
  enderecoNovoDe,
  ensureSchema,
  gravarRegraPadrao,
  gravarVersao,
  lerAcervoComOrigem,
  lerRascunho,
  lerRegraPadrao,
  listarRascunhos,
  lugarDoDono,
  moverRascunho,
  publicarRascunho,
  rascunhoDeQualquerUm,
  regravarRascunho,
  todosOsRascunhos,
  versaoAtual,
} from "@/lib/db";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { AGORA_SEMENTE, PESSOA_DE_TESTE, semearAcervo, semearLugarDaPessoa } from "../banco";

let c: Client;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
});
afterEach(() => c.close());

const contarOrigens = async () =>
  Number((await c.execute("SELECT COUNT(*) AS n FROM origem_do_lugar")).rows[0].n);

describe("a regra padrão da chuva mora no banco", () => {
  it("nasce 3 h pra frente, 6 h pra trás, 0,2 mm, cuidado — a decisão dele de 07/10", async () => {
    expect(await lerRegraPadrao(c)).toEqual({
      janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado",
    });
    expect(REGRA_PADRAO_INICIAL).toEqual(await lerRegraPadrao(c));
  });

  it("gravar muda a leitura", async () => {
    await gravarRegraPadrao(c, { janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" }, AGORA_SEMENTE + 5);
    expect(await lerRegraPadrao(c)).toEqual({ janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" });
  });

  // 🔴 `ensureSchema` roda a cada `npm run semear`. Se a semente da regra fosse
  // um upsert, o deploy seguinte desfaria em silêncio o que o João mudou pelo
  // painel — a família do "semente regrava o que o dono escondeu".
  it("rodar o schema de novo NÃO devolve a regra ao valor inicial", async () => {
    await gravarRegraPadrao(c, { janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" }, AGORA_SEMENTE + 5);
    await ensureSchema(c);
    await ensureSchema(c);
    expect((await lerRegraPadrao(c)).janela_passado_horas).toBe(9);
  });

  // Review Focus 5: sem linha, ou com severidade torta, é ERRO — nunca um
  // carimbo com número que ninguém escolheu.
  it("sem linha, a leitura estoura", async () => {
    await c.execute("DELETE FROM regra_padrao");
    await expect(lerRegraPadrao(c)).rejects.toThrow(/regra padrão/);
    await expect(lerAcervoComOrigem(c)).rejects.toThrow(/regra padrão/);
  });

  it("severidade torta estoura, e não vira 'cuidado' por padrão", async () => {
    await c.execute("UPDATE regra_padrao SET severidade = 'talvez' WHERE id = 1");
    await expect(lerRegraPadrao(c)).rejects.toThrow(/talvez/);
  });
});

describe("a migração: o acervo de antes é do João", () => {
  it("todo lugar existente sai conferido e sem contribuidor, e nenhuma linha de origem nasce", async () => {
    await ensureSchema(c);
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.size, "a premissa: o acervo foi semeado").toBeGreaterThan(2);
    for (const [slug, l] of linhas) {
      expect({ slug, conferido: l.conferido, contribuidor: l.contribuidor }).toEqual({ slug, conferido: true, contribuidor: null });
    }
    expect(await contarOrigens()).toBe(0);
  });
});

describe("publicar de quem usa", () => {
  it("o lugar vai ao ar NÃO conferido, com o contribuidor, e a versão diz 'contribuidor'", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get(slug)).toMatchObject({ oculto: false, conferido: false, contribuidor: PESSOA_DE_TESTE });
    expect((await versaoAtual(c, slug))!.autor).toBe("contribuidor");
    expect(await contarOrigens()).toBe(1);
  });

  it("os lugares do João continuam conferidos depois que um da pessoa entra", async () => {
    await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get("rampa-do-pepe")).toMatchObject({ conferido: true, contribuidor: null });
  });

  // 🔴 A ARMADILHA DO `INTEGER PRIMARY KEY`: `INSERT … SELECT MIN(id) …` com o
  // portão fechado devolve UMA linha com NULL, e NULL numa chave inteira vira
  // um rowid NOVO — uma origem órfã apontando pra um lugar que não é o dela.
  it("publicar recusado (rascunho mudou) não deixa linha de origem nenhuma", async () => {
    const slug = "pedra-mandada-cidade-teste";
    const doc = JSON.stringify({ slug, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, doc, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE - 1, PESSOA_DE_TESTE)).toBe(false);
    expect(await contarOrigens()).toBe(0);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("o publicar do painel não leva ao ar rascunho de quem usa", async () => {
    const slug = "pedra-mandada-cidade-teste";
    const doc = JSON.stringify({ slug, modos: [] });
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, doc, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE)).toBe(false);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("e quem usa não leva ao ar rascunho do João", async () => {
    const slug = "lugar-do-joao-cidade";
    const doc = JSON.stringify({ slug, modos: [] });
    expect(await criarRascunho(c, slug, doc, AGORA_SEMENTE)).toBe(true);
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE, PESSOA_DE_TESTE)).toBe(false);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("pessoa bloqueada não publica", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, NULL, NULL, 1, ?)",
      args: [PESSOA_DE_TESTE, AGORA_SEMENTE],
    });
    await expect(semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" })).rejects.toThrow(/não publicou/);
    expect(await contarOrigens()).toBe(0);
  });

  // 🔴 RULING DE PRODUTO DA PRÉ-AUDITORIA (07/10): o lugar dela NUNCA toma o
  // endereço antigo de outro lugar — o link velho que circula (WhatsApp)
  // continua levando ao lugar de onde ele veio. A recusa mora no 1º passo do
  // batch: a corrida (o João troca um endereço DEPOIS que o rascunho dela
  // nasceu) não passa.
  it("quem usa não publica num endereço antigo de outro lugar, e o link velho continua", async () => {
    const slug = "pedra-mandada-cidade-teste";
    await c.execute({
      sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)",
      args: [slug, AGORA_SEMENTE],
    });
    await expect(semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" })).rejects.toThrow(/não publicou/);
    expect(await versaoAtual(c, slug)).toBeNull();
    expect(await enderecoNovoDe(c, slug)).toBe("rampa-do-pepe");
    expect(await contarOrigens()).toBe(0);
  });

  // O controle do caso de cima: a recusa é SÓ de quem usa. O publicar do JOÃO
  // continua retomando o endereço antigo (E5 da Tarefa 11e, a régua de hoje).
  it("o publicar do JOÃO continua retomando o endereço antigo", async () => {
    const slug = "lugar-do-joao-cidade";
    const doc = JSON.stringify({ slug, modos: [] });
    await c.execute({
      sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)",
      args: [slug, AGORA_SEMENTE],
    });
    expect(await criarRascunho(c, slug, doc, AGORA_SEMENTE)).toBe(true);
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE)).toBe(true);
    expect(await enderecoNovoDe(c, slug)).toBeNull();
  });
});

describe("a lista de rascunhos do painel é só do João", () => {
  it("o rascunho de quem usa não aparece em listarRascunhos", async () => {
    await criarRascunho(c, "do-joao-cidade", JSON.stringify({ slug: "do-joao-cidade" }), AGORA_SEMENTE);
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: ["da-pessoa-cidade", JSON.stringify({ slug: "da-pessoa-cidade" }), AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual(["do-joao-cidade"]);
  });
});

// 🔴 M11 E I4 DA PRÉ-AUDITORIA, e o ruling de produto: o painel do João NÃO
// age sobre rascunho de quem usa (nem lê, nem regrava, nem move, nem apaga —
// um caso por porta), mas a COLISÃO o vê, com o dono.
describe("o rascunho de quem usa: o painel não alcança, a colisão vê", () => {
  const DELA = "da-pessoa-cidade";
  const DOC_DELA = JSON.stringify({ slug: DELA });
  beforeEach(async () => {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [DELA, DOC_DELA, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
  });

  it("lerRascunho do painel não o lê", async () => {
    expect(await lerRascunho(c, DELA)).toBeNull();
    expect(await rascunhoDeQualquerUm(c, DELA), "a premissa: o rascunho dela está no banco").not.toBeNull();
  });

  it("regravarRascunho do painel não o regrava", async () => {
    expect(await regravarRascunho(c, DELA, '{"x":1}', AGORA_SEMENTE + 1)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, DELA))?.doc).toBe(DOC_DELA);
  });

  it("moverRascunho do painel não o move", async () => {
    expect(await moverRascunho(c, DELA, "outro-cidade", '{"slug":"outro-cidade"}', AGORA_SEMENTE + 1)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, DELA))?.slug).toBe(DELA);
  });

  it("apagarRascunho do painel não o apaga", async () => {
    expect(await apagarRascunho(c, DELA)).toBe(false);
    expect(await rascunhoDeQualquerUm(c, DELA)).not.toBeNull();
  });

  it("todosOsRascunhos e rascunhoDeQualquerUm o veem, com o dono — e os do João com dono nulo", async () => {
    await criarRascunho(c, "do-joao-cidade", JSON.stringify({ slug: "do-joao-cidade" }), AGORA_SEMENTE + 1);
    expect((await todosOsRascunhos(c)).map((r) => [r.slug, r.contribuidor])).toEqual([
      ["do-joao-cidade", null],
      [DELA, PESSOA_DE_TESTE],
    ]);
    expect(await rascunhoDeQualquerUm(c, DELA)).toMatchObject({ slug: DELA, contribuidor: PESSOA_DE_TESTE });
    expect(await rascunhoDeQualquerUm(c, "ninguem-cidade")).toBeNull();
  });
});

describe("lerAcervoComOrigem e lugarDoDono", () => {
  it("traz os escondidos, marcados, e a regra padrão da mesma leitura", async () => {
    await c.execute("UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = 'rampa-do-pepe'");
    const { linhas, padrao } = await lerAcervoComOrigem(c);
    expect(linhas.get("rampa-do-pepe")?.oculto).toBe(true);
    expect(padrao).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("lugarDoDono diz a origem de um lugar da pessoa e de um do João, e null pra ninguém", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect((await lugarDoDono(c, slug))!.origem).toEqual({ contribuidor: PESSOA_DE_TESTE, conferido: false });
    expect((await lugarDoDono(c, "rampa-do-pepe"))!.origem).toEqual({ contribuidor: null, conferido: true });
    expect(await lugarDoDono(c, "ninguem-mora-aqui")).toBeNull();
  });

  // 🔴 A origem é do LUGAR, não do endereço nem da versão: a identidade (menor
  // id) anda com ele na troca de endereço, e a versão ATUAL não é a 1ª.
  it("a origem acompanha o lugar com 2 versões e endereço novo", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const atual = await versaoAtual(c, slug);
    await gravarVersao(c, slug, atual!.doc, "contribuidor", AGORA_SEMENTE + 99);
    await c.execute({ sql: "UPDATE ficha_versoes SET ficha_slug = 'endereco-novo-cidade' WHERE ficha_slug = ?", args: [slug] });
    expect((await lerAcervoComOrigem(c)).linhas.get("endereco-novo-cidade")).toMatchObject({ conferido: false, contribuidor: PESSOA_DE_TESTE });
  });

  // 🔴 Valor torto na coluna sai NÃO conferido — o lado que mostra a marca.
  it("conferido torto numa linha de origem é lido como não conferido", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    await c.execute("UPDATE origem_do_lugar SET conferido = 'sim'");
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(false);
  });
});
