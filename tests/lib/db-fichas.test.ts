import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, historico, versaoAtual, versaoPorId, versoesAtuais } from "@/lib/db";

let c: Client;
const AGORA = 1_758_000_000;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await ensureSchema(c); });
afterEach(() => c.close());

describe("ficha_versoes", () => {
  it("grava e lê a versão atual", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"slug":"rampa-do-pepe"}', "semente", AGORA);
    const v = await versaoAtual(c, "rampa-do-pepe");
    expect(v?.doc).toBe('{"slug":"rampa-do-pepe"}');
    expect(v?.autor).toBe("semente");
  });

  it("lugar sem versão devolve null", async () => {
    expect(await versaoAtual(c, "nao-existe")).toBeNull();
  });

  // 🔴 Achado da revisão (fix round 1): sem este teste, o `WHERE ficha_slug = ?`
  // de `versaoAtual` é apagável sem a suíte notar — os outros testes só têm UM
  // slug na tabela por vez. Com DOIS lugares presentes, apagar o WHERE faz
  // `versaoAtual` pegar a linha errada (a de maior id da tabela inteira), que
  // é a voz de um lugar vazando pra ficha de outro — a linha vermelha do
  // projeto, já paga quatro vezes.
  it("versaoAtual de um lugar não traz a versão do outro", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"quem":"rampa"}', "painel", AGORA);
    await gravarVersao(c, "pedra-furada-de-venturosa", '{"quem":"pedra"}', "painel", AGORA + 10);
    const v = await versaoAtual(c, "rampa-do-pepe");
    expect(v?.doc).toBe('{"quem":"rampa"}');
  });

  // 🔴 O ponto da tabela: a versão nova VENCE, e a antiga CONTINUA EXISTINDO.
  // Se `versaoAtual` lesse a primeira em vez da última, o painel salvaria e a
  // tela não mudaria — e o João concluiria que o app não gravou.
  it("a versão mais recente vence, e a antiga não some", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"antiga"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"nova"}', "painel", AGORA + 10);
    expect((await versaoAtual(c, "rampa-do-pepe"))?.doc).toBe('{"voz":"nova"}');
    expect(await historico(c, "rampa-do-pepe")).toHaveLength(2);
  });

  // 🔴 Empate de `criado_em` é real: duas gravações no mesmo segundo. Se o
  // desempate fosse por tempo, qual vence seria sorteio. É por `id`.
  it("mesmo segundo: desempata pelo id, não pelo relógio", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"primeira"}', "painel", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"segunda"}', "painel", AGORA);
    expect((await versaoAtual(c, "rampa-do-pepe"))?.doc).toBe('{"voz":"segunda"}');
  });

  it("o histórico vem do mais novo pro mais velho", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"v":1}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"v":2}', "painel", AGORA + 10);
    await gravarVersao(c, "rampa-do-pepe", '{"v":3}', "painel", AGORA + 20);
    expect((await historico(c, "rampa-do-pepe")).map((v) => v.doc)).toEqual(['{"v":3}', '{"v":2}', '{"v":1}']);
  });

  // 🔴 O histórico é de UM lugar. Sem o WHERE por slug, a tela da Rampa
  // mostraria as versões da Pedra Furada — a voz de um lugar na tela de outro,
  // que é a linha vermelha deste projeto.
  it("o histórico não mistura lugares", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"quem":"rampa"}', "painel", AGORA);
    await gravarVersao(c, "pedra-furada-de-venturosa", '{"quem":"pedra"}', "painel", AGORA + 10);
    const h = await historico(c, "rampa-do-pepe");
    expect(h).toHaveLength(1);
    expect(h[0].doc).toBe('{"quem":"rampa"}');
  });

  it("versoesAtuais devolve a última de cada lugar, uma consulta só", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"antiga"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"nova"}', "painel", AGORA + 10);
    await gravarVersao(c, "veu-de-noiva-de-bonito", '{"voz":"veu"}', "semente", AGORA);
    const m = await versoesAtuais(c);
    expect(m.get("rampa-do-pepe")?.doc).toBe('{"voz":"nova"}');
    expect(m.get("veu-de-noiva-de-bonito")?.doc).toBe('{"voz":"veu"}');
    expect(m.size).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `oculto` — ESCONDER SEM APAGAR (Tarefa 4 da rodada do painel completo,
// 2026-09-27). Esconder é uma VERSÃO NOVA com `oculto = 1`; nada é atualizado e
// nada é apagado. O que o público vê é a versão de maior `id` QUE ESTÁ NO AR.
// ═══════════════════════════════════════════════════════════════════════════
describe("ficha_versoes — esconder", () => {
  it("toda versão nasce VISÍVEL quando ninguém pede o contrário", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "semente", AGORA);
    expect((await versaoAtual(c, "rampa-do-pepe"))!.oculto).toBe(false);
    expect((await versoesAtuais(c)).has("rampa-do-pepe")).toBe(true);
  });

  it("esconder é uma VERSÃO NOVA, e a antiga continua lá", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "semente", AGORA);
    const antes = await historico(c, "rampa-do-pepe");
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "painel", AGORA + 10, true);
    const depois = await historico(c, "rampa-do-pepe");
    expect(depois).toHaveLength(antes.length + 1);
    expect(depois[0].oculto).toBe(true);
    expect(depois[1].oculto).toBe(false);
    // E o conteúdo não se perdeu no caminho: esconder não reescreve o documento.
    expect(depois[0].doc).toBe('{"voz":"x"}');
  });

  it("versoesAtuais esconde o oculto por padrão, e mostra quando pedido", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "painel", AGORA, true);
    expect((await versoesAtuais(c)).has("rampa-do-pepe")).toBe(false);
    expect((await versoesAtuais(c, { incluirOcultos: true })).has("rampa-do-pepe")).toBe(true);
  });

  // 🔴 O CASO QUE O FILTRO **FORA** DA SUBCONSULTA EXISTE PRA IMPEDIR, e sem este
  // teste a escolha fica sem prova. Se o `oculto = 0` morasse DENTRO do
  // `SELECT MAX(id) ... GROUP BY ficha_slug`, o lugar escondido continuaria
  // aparecendo no público — servido pela última versão VISÍVEL, que é uma ficha
  // ATRASADA. O dono esconderia o lugar e o veria no ar com texto velho, que é
  // pior que não esconder: ele acharia que o app ignorou o comando.
  it("o lugar escondido NÃO volta pela versão visível anterior", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"visivel e velha"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"a de agora"}', "painel", AGORA + 10, true);
    const publico = await versoesAtuais(c);
    expect(publico.has("rampa-do-pepe")).toBe(false);
    expect(publico.size).toBe(0);
  });

  it("mostrar de novo devolve o lugar ao público, e são TRÊS versões", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "painel", AGORA + 10, true);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "painel", AGORA + 20, false);
    expect((await versoesAtuais(c)).has("rampa-do-pepe")).toBe(true);
    expect(await historico(c, "rampa-do-pepe")).toHaveLength(3);
  });

  // 🔴 A4 DA AUDITORIA: esconder é tirar do PÚBLICO, não tirar do DONO. As três
  // leituras de UM lugar não filtram, e é isso que mantém o painel capaz de
  // editar (e de reexibir) um lugar escondido. Se qualquer uma passasse a
  // filtrar, esconder viraria porta de mão única.
  it("versaoAtual, versaoPorId e historico continuam vendo o lugar escondido", async () => {
    const primeira = await gravarVersao(c, "rampa-do-pepe", '{"voz":"antiga"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"nova"}', "painel", AGORA + 10, true);
    expect((await versaoAtual(c, "rampa-do-pepe"))?.doc).toBe('{"voz":"nova"}');
    expect((await versaoPorId(c, primeira))?.doc).toBe('{"voz":"antiga"}');
    expect(await historico(c, "rampa-do-pepe")).toHaveLength(2);
  });

  it("um lugar escondido não esconde os outros", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"rampa"}', "painel", AGORA, true);
    await gravarVersao(c, "veu-de-noiva-de-bonito", '{"voz":"veu"}', "semente", AGORA);
    const publico = await versoesAtuais(c);
    expect([...publico.keys()]).toEqual(["veu-de-noiva-de-bonito"]);
  });

  // 🔴 A3 DA AUDITORIA, REPRODUZIDA NO BANCO: a conversão é `Number(...) === 1`,
  // nunca `Boolean(r.oculto)`. Com `Boolean`, qualquer TEXTO na coluna vira
  // `true` — e `Boolean("0")` também é `true`, o que esconderia o acervo
  // INTEIRO. A afinidade INTEGER do SQLite converte '0' e '1' em número, mas
  // guarda como TEXTO o que não converte sem perda; é por isso que este caso usa
  // `'false'`, que é exatamente o que um escritor mal tipado gravaria.
  //
  // E o lado escolhido é VISÍVEL: "no ar" é o estado de todo lugar que ninguém
  // escondeu, então lixo na coluna não pode tirar um lugar do ar em silêncio.
  it("valor de texto na coluna oculto não esconde o lugar, e as DUAS leituras concordam", async () => {
    await c.execute({
      sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
            VALUES (?, ?, ?, ?, ?)`,
      args: ["rampa-do-pepe", '{"voz":"x"}', "semente", AGORA, "false"],
    });
    expect((await versaoAtual(c, "rampa-do-pepe"))!.oculto).toBe(false);
    expect((await versoesAtuais(c)).has("rampa-do-pepe")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 A MIGRAÇÃO. `ficha_versoes` JÁ EXISTE EM PRODUÇÃO desde 2026-09-26, então a
// coluna `oculto` entra por `ALTER TABLE` — e `ADD COLUMN` não tem
// `IF NOT EXISTS` no SQLite, num `ensureSchema` que roda a cada `npm run semear`
// (que pode ser repetido) — nunca no boot do app.
// ═══════════════════════════════════════════════════════════════════════════
describe("ensureSchema e a coluna oculto", () => {
  it("ensureSchema roda DUAS vezes seguidas sem estourar, e a tabela continua servindo", async () => {
    // O `beforeEach` já rodou uma; estas são a segunda e a terceira. É a segunda
    // que estoura sem o guarda do `ALTER TABLE`.
    await ensureSchema(c);
    await ensureSchema(c);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"x"}', "semente", AGORA);
    expect((await versaoAtual(c, "rampa-do-pepe"))!.oculto).toBe(false);
  });

  // 🔴 O CASO DE PRODUÇÃO, e sem ele a migração está sem prova: a tabela como ela
  // está HOJE no Turso do João (sem a coluna), com linhas dentro, passando por
  // `ensureSchema`. O `DEFAULT 0` é o que faz o acervo dele continuar NO AR
  // depois do deploy — sem ele, as linhas antigas viriam com `oculto` nulo e o
  // app inteiro sairia do ar de uma vez.
  it("a tabela SEM a coluna ganha a coluna, e a linha antiga continua VISÍVEL", async () => {
    const antigo = createClient({ url: ":memory:" });
    // O shape exato de produção antes desta tarefa.
    await antigo.execute(`CREATE TABLE ficha_versoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
      doc TEXT NOT NULL, autor TEXT NOT NULL, criado_em INTEGER NOT NULL)`);
    await antigo.execute({
      sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em) VALUES (?, ?, ?, ?)`,
      args: ["rampa-do-pepe", '{"voz":"gravada antes da coluna existir"}', "semente", AGORA],
    });

    await ensureSchema(antigo);

    const v = await versaoAtual(antigo, "rampa-do-pepe");
    expect(v!.doc).toBe('{"voz":"gravada antes da coluna existir"}');
    expect(v!.oculto, "linha de antes da coluna tem que nascer NO AR").toBe(false);
    expect((await versoesAtuais(antigo)).has("rampa-do-pepe")).toBe(true);
    antigo.close();
  });
});
