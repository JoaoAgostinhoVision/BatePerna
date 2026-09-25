import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, historico, versaoAtual, versoesAtuais } from "@/lib/db";

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
