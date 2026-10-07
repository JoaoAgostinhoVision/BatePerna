import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, identidadeDoLugar, trocarEndereco } from "@/lib/db";
import { registrarConfirmacao } from "@/lib/confirmar";

let client: Client;
beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("registrarConfirmacao", () => {
  it("registra com tipo e devolve o placar do dia", async () => {
    const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
    // Desde a Tarefa 12b o relato entra pela IDENTIDADE do lugar: o endereço
    // tem de ter um lugar. O documento não importa a esta tabela.
    await gravarVersao(client, "lugar-marcador-um", "{}", "semente", agora - 10);
    const lugar = (await identidadeDoLugar(client, "lugar-marcador-um"))!;
    const a = await registrarConfirmacao(client, lugar, "seco", agora);
    expect(a).toEqual({ foram: 1, barro: 0 });
    const b = await registrarConfirmacao(client, lugar, "barro", agora);
    expect(b).toEqual({ foram: 2, barro: 1 });
  });

  it("identidade de lugar nenhum: null, e nada gravado", async () => {
    expect(await registrarConfirmacao(client, 999_999, "seco", 1_760_000_000)).toBeNull();
    expect((await client.execute("SELECT COUNT(*) AS n FROM confirmacoes")).rows[0].n).toBe(0);
  });
});

// 🔴 A IDENTIDADE DO LUGAR (Tarefa 12b): o menor `id` das versões DO ENDEREÇO,
// nunca do banco inteiro. B9 da auditoria: sem o `WHERE ficha_slug`, o `MIN(id)`
// é a linha mais VELHA do banco — por isso há um lugar MAIS VELHO que P aqui, e
// um mais novo também.
describe("identidadeDoLugar", () => {
  const AGORA = 1_760_000_000;
  const VELHO = "lugar-marcador-velho";
  const P = "lugar-marcador-pe";
  const NOVO = "lugar-marcador-novo";
  const minDe = async (slug: string) =>
    Number((await client.execute({ sql: "SELECT MIN(id) AS m FROM ficha_versoes WHERE ficha_slug = ?", args: [slug] })).rows[0].m);

  beforeEach(async () => {
    await gravarVersao(client, VELHO, "{}", "semente", AGORA - 30);
    await gravarVersao(client, P, "{}", "semente", AGORA - 20);
    await gravarVersao(client, P, "{}", "painel", AGORA - 19);
    await gravarVersao(client, NOVO, "{}", "painel", AGORA - 10);
  });

  it("é o MIN das versões do endereço — nem o do banco, nem a versão mais nova", async () => {
    const p = await identidadeDoLugar(client, P);
    expect(p).toBe(await minDe(P));
    expect(p).not.toBe(await identidadeDoLugar(client, VELHO));
    expect(p).not.toBe(await identidadeDoLugar(client, NOVO));
  });

  it("endereço sem lugar: null", async () => {
    expect(await identidadeDoLugar(client, "lugar-marcador-ninguem")).toBeNull();
  });

  // A estabilidade: as versões andam com o lugar na troca de endereço.
  it("o mesmo número depois de o lugar trocar de endereço", async () => {
    const antes = await identidadeDoLugar(client, P);
    const atual = Number((await client.execute({ sql: "SELECT MAX(id) AS m FROM ficha_versoes WHERE ficha_slug = ?", args: [P] })).rows[0].m);
    expect(await trocarEndereco(client, P, "lugar-marcador-pe-novo", AGORA, atual)).toBe(true);
    expect(await identidadeDoLugar(client, "lugar-marcador-pe-novo")).toBe(antes);
    expect(await identidadeDoLugar(client, P)).toBeNull();
  });
});
