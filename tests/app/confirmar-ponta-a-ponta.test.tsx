import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ConfirmarFui from "@/app/ConfirmarFui";
import { ensureSchema, gravarVersao, trocarEndereco } from "@/lib/db";
import { CHAVE_FILA, diaRecife } from "@/lib/fila-relato";
import { lugarMarcador } from "../lugar-marcador";
import { semearAcervo, base } from "../banco";

/** 🔴 O N6 DE PONTA A PONTA (Tarefa 12b, C2 da auditoria): o componente de
 *  verdade, falando com a ROTA de verdade, sobre um banco de verdade. O `fetch`
 *  do componente é ligado ao `GET`/`POST` de `src/app/api/confirmar/route.ts`.
 *
 *  As duas portas em série — o filtro do cliente e a gravação pela identidade
 *  no servidor — estão aqui JUNTAS, de propósito: cada uma tem a sua prova
 *  sozinha (`tests/app/ConfirmarFui.test.tsx`, "N6-cliente";
 *  `tests/api/route-confirmar.test.ts`, "N6-servidor"), e esta é a que prova
 *  que o laço inteiro fecha: o relato de P sai da fila pela página de P e
 *  conta pra P, e Q fica com zero.
 *
 *  Fixture: o acervo da semente (mais velho que P), P em A, Q nascendo DEPOIS
 *  de P. Nomes marcadores. */
let client: Client;
vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

const A = "lugar-marcador-pe-marcador";
const B = "lugar-marcador-pe-novo-marcador";
const C = "lugar-marcador-que-marcadora";
const AGORA = Math.floor(Date.now() / 1000);
let P: number;
let Q: number;

const minDe = async (slug: string) =>
  Number((await client.execute({ sql: "SELECT MIN(id) AS m FROM ficha_versoes WHERE ficha_slug = ?", args: [slug] })).rows[0].m);
const contar = async (slug: string) =>
  Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?", args: [slug] })).rows[0].n);
const naFila = () => JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]");

/** O `fetch` do componente, ligado à rota. Guarda os POSTs. */
async function ligarNaRota(): Promise<Array<Record<string, unknown>>> {
  const { GET, POST } = await import("@/app/api/confirmar/route");
  const posts: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const req = new Request(new URL(url, "http://x").toString(), init);
      if (init?.method === "POST") posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return init?.method === "POST" ? POST(req) : GET(req);
    }),
  );
  return posts;
}

beforeEach(async () => {
  localStorage.clear();
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  await semearAcervo(client);
  await gravarVersao(client, A, JSON.stringify(lugarMarcador(A, "Pe Marcador", "Cidade Marcadora")), "painel", AGORA - 20);
  await gravarVersao(client, C, JSON.stringify(lugarMarcador(C, "Que Marcadora", "Outra Cidade Marcadora")), "painel", AGORA - 18);
  P = await minDe(A);
  Q = await minDe(C);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  client.close();
});

describe("N6 de ponta a ponta", () => {
  it("o relato de P, contado em A, fica na fila pela página de Q em /A e sobe pela de P em /B — P com 1, Q com 0", async () => {
    // Quem foi a P contou sem sinal, na página de P em /A.
    localStorage.setItem(CHAVE_FILA, JSON.stringify([{ slug: A, tipo: "barro", dia: diaRecife(Date.now()), lugar: P }]));
    // P vai pra B; Q, que morava em C, retoma A.
    expect(await trocarEndereco(client, A, B, AGORA - 4, await base(client, A))).toBe(true);
    expect(await trocarEndereco(client, C, A, AGORA - 3, await base(client, C))).toBe(true);
    const posts = await ligarNaRota();

    // A página de Q em /A: o relato de P não sobe.
    render(<ConfirmarFui slug={A} lugar={Q} />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toEqual([]);
    expect(naFila()).toHaveLength(1);
    expect(await contar(A)).toBe(0);
    cleanup();

    // A página de P em /B: sobe, conta pra P, e a fila esvazia.
    render(<ConfirmarFui slug={B} lugar={P} />);
    await screen.findByText(/anotado/i);
    expect(await contar(B)).toBe(1);
    expect(await contar(A), "o relato de P caiu em Q").toBe(0);
    expect(naFila()).toEqual([]);
    expect((await screen.findByText(/Hoje:/)).textContent).toBe("Hoje: 1 foi · 1 achou o chão ruim");
  });
});
