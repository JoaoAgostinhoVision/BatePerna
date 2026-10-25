import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gravarVersao, identidadeDoLugar, versaoAtual } from "@/lib/db";
import { fuiDaPessoa } from "@/lib/db-contribuidor";
import { bloquearContribuidor } from "@/lib/db-contribuidor";
import { semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

/** POST /api/contribuir/fui (25/10): a área dela leva pra CONTA as idas que o
 *  aparelho anotou no "✓ Fui" da ficha pública. */
const AGORA = 1_760_000_000;
let c: Client;
let POST: typeof import("@/app/api/contribuir/fui/route").POST;
let RAMPA: number;
let VEU: number;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  RAMPA = (await identidadeDoLugar(c, "rampa-do-pepe"))!;
  VEU = (await identidadeDoLugar(c, "veu-de-noiva-de-bonito"))!;
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  POST = (await import("@/app/api/contribuir/fui/route")).POST;
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const pedido = (corpo: unknown) => new Request("http://x/api/contribuir/fui", { method: "POST", body: JSON.stringify(corpo) });
const ms = (s: number) => s * 1000;

describe("POST /api/contribuir/fui", () => {
  it("grava as idas dela na conta, pela identidade, e a lista volta com a data", async () => {
    const res = await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA - 86_400) }] }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ gravados: 1 });
    const l = await fuiDaPessoa(c, PESSOA.id);
    expect(l.map((x) => [x.slug, x.em])).toEqual([["rampa-do-pepe", AGORA - 86_400]]);
  });

  it("sem identidade, o endereço resolve o lugar (o relato legado)", async () => {
    await POST(pedido({ itens: [{ slug: "veu-de-noiva-de-bonito", em: ms(AGORA - 10) }] }));
    expect((await fuiDaPessoa(c, PESSOA.id)).map((x) => x.slug)).toEqual(["veu-de-noiva-de-bonito"]);
  });

  it("o mesmo lugar duas vezes: uma linha, com a ida mais nova; a lista vem da mais nova pra mais velha", async () => {
    await POST(pedido({ itens: [
      { slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA - 900_000) },
      { slug: "veu-de-noiva-de-bonito", lugar: VEU, em: ms(AGORA - 500_000) },
    ] }));
    await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA - 100) }] }));
    await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA - 999_999) }] }));
    expect((await fuiDaPessoa(c, PESSOA.id)).map((x) => [x.slug, x.em])).toEqual([
      ["rampa-do-pepe", AGORA - 100],
      ["veu-de-noiva-de-bonito", AGORA - 500_000],
    ]);
  });

  it("lugar que não existe é ignorado, sem derrubar os outros", async () => {
    const res = await POST(pedido({ itens: [
      { slug: "nao-existe", em: ms(AGORA) },
      { slug: "x", lugar: 999_999, em: ms(AGORA) },
      { slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA) },
    ] }));
    expect(await res.json()).toEqual({ gravados: 1 });
  });

  it("hora do futuro vira agora; hora de antes do app existir é ignorada", async () => {
    await POST(pedido({ itens: [
      { slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA + 99_999) },
      { slug: "veu-de-noiva-de-bonito", lugar: VEU, em: ms(1_600_000_000) },
    ] }));
    expect((await fuiDaPessoa(c, PESSOA.id)).map((x) => [x.slug, x.em])).toEqual([["rampa-do-pepe", AGORA]]);
  });

  it("a lista é DELA: a outra pessoa não vê", async () => {
    await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA) }] }));
    expect(await fuiDaPessoa(c, OUTRA.id)).toEqual([]);
  });

  it("lugar escondido depois some da lista dela, e volta se for mostrado", async () => {
    await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA) }] }));
    const doc = (await versaoAtual(c, "rampa-do-pepe"))!.doc;
    await gravarVersao(c, "rampa-do-pepe", doc, "painel", AGORA + 1, true);
    expect(await fuiDaPessoa(c, PESSOA.id)).toEqual([]);
    await gravarVersao(c, "rampa-do-pepe", doc, "painel", AGORA + 2, false);
    expect((await fuiDaPessoa(c, PESSOA.id)).map((x) => x.slug)).toEqual(["rampa-do-pepe"]);
  });

  it("sem sessão: 401, nada gravado", async () => {
    sessao.atual = null;
    const res = await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA) }] }));
    expect(res.status).toBe(401);
    sessao.atual = PESSOA;
    expect(await fuiDaPessoa(c, PESSOA.id)).toEqual([]);
  });

  it("conta bloqueada: 403, nada gravado", async () => {
    await POST(pedido({ itens: [] }));
    await bloquearContribuidor(c, PESSOA.id, AGORA);
    const res = await POST(pedido({ itens: [{ slug: "rampa-do-pepe", lugar: RAMPA, em: ms(AGORA) }] }));
    expect(res.status).toBe(403);
    expect(await fuiDaPessoa(c, PESSOA.id)).toEqual([]);
  });

  it.each([
    ["sem itens", {}],
    ["itens não é lista", { itens: "x" }],
    ["lista grande demais", { itens: Array.from({ length: 201 }, () => ({ slug: "rampa-do-pepe", em: 1 })) }],
  ])("corpo torto (%s): 400", async (_n, corpo) => {
    expect((await POST(pedido(corpo))).status).toBe(400);
  });
});
