import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { bancoVazio, semearAcervo } from "../banco";

/** AS DUAS PORTAS DO DONO (`getAcervoDoDono`, `getFichaDoDono` em
 *  `src/lib/ficha.ts`, Task 9) — as travas que a revisão da Task 9 achou sem
 *  prova (I3 e I4, onda de conserto 1, 2026-10-01).
 *
 *  🔴 I3 — O PRAZO. As duas leem por `lerNoPrazo` (`comPrazo` com
 *  `PRAZO_FICHA_MS`): banco PENDURADO tem de virar erro no prazo, e não uma tela
 *  do dono esperando até o timeout da plataforma. Tirar o `lerNoPrazo` de
 *  qualquer uma deixava a suíte inteira verde.
 *
 *  🔴 I4 — A TRAVA DO SLUG DIVERGENTE. A porta do público tem prova
 *  (`ficha-fonte.test.ts`); as do dono passam pela MESMA conta
 *  (`fichaDaVersao`), mas trocá-la por um parse cru passava verde. Na lista do
 *  dono a divergência é a linha vermelha: a marca vem do `ficha_slug` e o link
 *  do `slug` de dentro — o dono veria a marca num lugar e abriria outro. */

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

beforeEach(async () => {
  cliente = bancoVazio();
  await semearAcervo(cliente);
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());

/** Um banco que aceita a consulta e nunca responde — o Turso pendurado. */
const pendurado = () =>
  ({ execute: () => new Promise<never>(() => {}), batch: () => new Promise<never>(() => {}) }) as unknown as Client;

/** Roda a leitura com o relógio falso e diz como ela terminou DEPOIS do prazo:
 *  `"pendurada"` se ainda não terminou. Medir o estado depois de avançar o
 *  relógio (e não esperar a promessa) é o que deixa a mutação "sem prazo"
 *  vermelha na hora, em vez de só pelo timeout do vitest. */
async function depoisDoPrazo(ler: () => Promise<unknown>): Promise<"pendurada" | { erro: unknown } | { ok: unknown }> {
  const { PRAZO_FICHA_MS } = await import("@/lib/ficha-fonte");
  vi.useFakeTimers();
  let fim: { erro: unknown } | { ok: unknown } | null = null;
  ler().then((ok) => { fim = { ok }; }, (erro) => { fim = { erro }; });
  await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
  return fim ?? "pendurada";
}

describe("a porta do dono com o banco PENDURADO (I3)", () => {
  it("getAcervoDoDono estoura no prazo, não pendura", async () => {
    const { getAcervoDoDono } = await import("@/lib/ficha");
    cliente = pendurado();
    const fim = await depoisDoPrazo(() => getAcervoDoDono());
    expect(fim, "a lista do dono ficou pendurada além do prazo").not.toBe("pendurada");
    expect(String((fim as { erro: unknown }).erro)).toMatch(/não respondeu a tempo/);
  });

  it("getFichaDoDono estoura no prazo, não pendura", async () => {
    const { getFichaDoDono } = await import("@/lib/ficha");
    cliente = pendurado();
    const fim = await depoisDoPrazo(() => getFichaDoDono("rampa-do-pepe"));
    expect(fim, "a página do lugar ficou pendurada além do prazo").not.toBe("pendurada");
    expect(String((fim as { erro: unknown }).erro)).toMatch(/não respondeu a tempo/);
  });

  // A premissa: com o banco de pé, as mesmas leituras RESPONDEM — sem isto, um
  // erro por outro motivo passaria os dois casos de cima.
  it("com o banco de pé, as duas respondem", async () => {
    const { getAcervoDoDono, getFichaDoDono } = await import("@/lib/ficha");
    expect((await getAcervoDoDono()).fichas.length).toBeGreaterThan(1);
    expect((await getFichaDoDono("rampa-do-pepe"))?.ficha.slug).toBe("rampa-do-pepe");
  });
});

describe("a porta do dono com o slug do banco DIVERGENTE do slug do documento (I4)", () => {
  async function gravarDivergente() {
    const { gravarVersao, versaoAtual } = await import("@/lib/db");
    const doc = JSON.parse((await versaoAtual(cliente, "pedra-furada-de-venturosa"))!.doc);
    // A linha diz `rampa-do-pepe`; o documento dentro dela diz outro lugar.
    expect(doc.slug, "a premissa: os dois slugs são diferentes").not.toBe("rampa-do-pepe");
    await gravarVersao(cliente, "rampa-do-pepe", JSON.stringify(doc), "painel", 1_758_000_100);
  }

  it("getAcervoDoDono recusa, como o público", async () => {
    await gravarDivergente();
    const { getAcervoDoDono } = await import("@/lib/ficha");
    await expect(getAcervoDoDono()).rejects.toThrow(/divergente/i);
  });

  it("getFichaDoDono recusa, como o público", async () => {
    await gravarDivergente();
    const { getFichaDoDono } = await import("@/lib/ficha");
    await expect(getFichaDoDono("rampa-do-pepe")).rejects.toThrow(/divergente/i);
  });
});
