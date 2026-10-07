import { readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { historico, lerRascunho, salvarRascunho, versaoAtual } from "@/lib/db";
import { oQueOAppCala } from "@/lib/o-que-o-app-cala";
import { FALTA_OBRIGATORIO } from "@/lib/porta-de-publicar";
import TelaDePublicar, { PUBLICAR, TITULO_CALA, TITULO_FALTA } from "@/app/admin/TelaDePublicar";
import { enderecoDaPergunta } from "@/app/admin/novo/enderecos";
import { ORDEM, PERGUNTAS } from "@/app/admin/novo/perguntas";
import { bancoVazio, semearAcervo } from "../banco";
import { rascunhoCompleto } from "../rascunho-completo";

/** A TELA DE PUBLICAR (Tarefa 12) — o componente, com frases montadas à mão (I7
 *  da auditoria de 06/10: o componente é de cliente e recebe as frases PRONTAS),
 *  e a PÁGINA de servidor `/admin/novo/publicar`, contra o banco, que é quem as
 *  monta.
 *
 *  Nenhum lugar real: nomes e cidades são marcadores. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-publicar-tela";
const NOME = "Lugar Marcador Tela";
const CIDADE = "Cidade Marcador Tela";
const S = "lugar-marcador-tela-cidade-marcador-tela";
const ATUALIZADO = 1_758_300_000;

const FRASES_A_MAO = ["Uma frase marcadora do que o app cala.", "Outra frase marcadora do que o app cala."];

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

let token: string;

beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      throw new Error(`fetch sem dublê neste teste: ${url}`);
    }),
  );
  cliente = bancoVazio();
  await semearAcervo(cliente);
  notFoundFalso.mockClear();
  cookiesFalso.mockReset();
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** O `fetch` que leva o POST da tela à ROTA DE VERDADE, com o cookie, no mesmo
 *  banco — e o `location` dublado, que o jsdom não navega. */
async function comRotaDeVerdade() {
  const rota = await import("@/app/api/admin/publicar/route");
  const corpos: Record<string, unknown>[] = [];
  const fetchFalso = vi.fn(async (url: string, init: { method: string; body: string }) => {
    corpos.push(JSON.parse(init.body));
    return rota.POST(
      new Request(`http://x${url}`, { method: init.method, headers: { cookie: `${COOKIE_ADMIN}=${token}` }, body: init.body }),
    );
  });
  vi.stubGlobal("fetch", fetchFalso);
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  return { fetchFalso, corpos, assign };
}

async function paginaPublicar(slug: string) {
  const { default: Publicar } = await import("@/app/admin/novo/publicar/page");
  return render(await Publicar({ searchParams: Promise.resolve({ slug }) }));
}

const semCampo = (doc: Record<string, unknown>, ...chaves: string[]): Record<string, unknown> => {
  const copia = structuredClone(doc);
  for (const k of chaves) delete copia[k];
  return copia;
};

// ═══════════════════════════════════════════════════════════════════════════
describe("TelaDePublicar — o componente", () => {
  it("a tela de publicar mostra, por extenso, o que o app vai calar", () => {
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={FRASES_A_MAO} />);
    const lista = screen.getByTestId("cala");
    expect(within(lista).getByText(TITULO_CALA)).toBeTruthy();
    for (const frase of FRASES_A_MAO) expect(within(lista).getByText(frase)).toBeTruthy();
  });

  // 🔴 Calar é permitido — é a régua do app inteiro. A lista existe pra ele
  // VER o preço da honestidade, não pra bloquear a publicação.
  it("o botão de publicar não some por causa dos campos vazios", () => {
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={FRASES_A_MAO} />);
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("publicar manda o slug e o atualizadoEm que a tela recebeu, e no 200 vai pro painel do lugar", async () => {
    const corpos: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        corpos.push(JSON.parse(init.body));
        return Response.json({ slug: S });
      }),
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(corpos).toEqual([{ slug: S, atualizadoEm: ATUALIZADO }]);
    expect(assign).toHaveBeenCalledWith(`/admin/${S}`);
  });

  it("recusa: a frase da porta aparece como chegou, ninguém navega, e o botão volta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Frase marcadora da porta.", { status: 409 })));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Frase marcadora da porta.");
    expect(assign).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo/publicar — a página, contra o banco", () => {
  it("as frases são as do rascunho guardado, por extenso, e o botão está lá", async () => {
    const doc = semCampo(rascunhoCompleto(S, NOME, CIDADE), "piso", "secaRapido");
    await salvarRascunho(cliente, S, JSON.stringify(doc), ATUALIZADO);
    await paginaPublicar(S);
    const frases = oQueOAppCala(doc);
    expect(frases, "a premissa: o rascunho cala duas coisas").toHaveLength(2);
    const lista = screen.getByTestId("cala");
    for (const frase of frases) expect(within(lista).getByText(frase)).toBeTruthy();
    expect(screen.queryByTestId("falta"), "um rascunho completo não tem o que faltar").toBeNull();
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  // 🔴 A FIAÇÃO INTEIRA: o `atualizado_em` que a PÁGINA leu desce até a porta, e
  // a porta põe o lugar no ar — sem nenhum valor escrito à mão no meio.
  it("publicar pela tela põe o lugar no ar: o pedido leva o atualizado_em que a página leu", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(rascunhoCompleto(S, NOME, CIDADE)), ATUALIZADO);
    const { corpos, assign } = await comRotaDeVerdade();
    await paginaPublicar(S);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(corpos).toEqual([{ slug: S, atualizadoEm: ATUALIZADO }]);
    expect(assign).toHaveBeenCalledWith(`/admin/${S}`);
    expect((await versaoAtual(cliente, S))?.autor).toBe("painel");
    expect(await lerRascunho(cliente, S)).toBeNull();
  });

  it("o que falta: cada obrigatória sem resposta, com o link da pergunta dela; e a porta recusa com a frase", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(semCampo(rascunhoCompleto(S, NOME, CIDADE), "voz")), ATUALIZADO);
    await comRotaDeVerdade();
    await paginaPublicar(S);
    const falta = screen.getByTestId("falta");
    expect(within(falta).getByText(TITULO_FALTA)).toBeTruthy();
    const links = within(falta).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe(PERGUNTAS.voz);
    expect(links[0].getAttribute("href")).toBe(enderecoDaPergunta(S, ORDEM.indexOf("voz") + 1));
    // O botão continua lá — quem recusa é a porta, e diz por quê.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe(FALTA_OBRIGATORIO);
    expect(await historico(cliente, S)).toEqual([]);
    expect(await lerRascunho(cliente, S)).not.toBeNull();
  });

  it("slug sem rascunho — inclusive o de um lugar no ar — é 404", async () => {
    await expect(paginaPublicar("rampa-do-pepe")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 G3 DA AUDITORIA: a tela é de CLIENTE e não alcança o registro, o schema nem
// o zod — eles iriam pro celular. Seguido pelos imports de VALOR, pelo parser do
// TypeScript, como o guarda do `FormularioDeLugar`. A medição de kB do build é a
// outra metade, e está no relatório.
describe("o bundle do celular", () => {
  const RAIZ = path.join(process.cwd(), "src");
  const PROIBIDOS = ["@/lib/campos-da-ficha", "@/types/ficha", "zod", "@/lib/o-que-o-app-cala", "@/lib/porta-de-publicar"];

  function especificadores(inicio: string): { arquivos: string[]; especificadores: string[] } {
    const vistos = new Set<string>();
    const vistosEsp: string[] = [];
    const resolver = (de: string, esp: string): string | null => {
      const base = esp.startsWith("@/") ? path.join(RAIZ, esp.slice(2)) : esp.startsWith(".") ? path.resolve(path.dirname(de), esp) : null;
      if (base === null) return null;
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        try {
          readFileSync(base + ext);
          return base + ext;
        } catch {
          /* tenta a próxima */
        }
      }
      return null;
    };
    const andar = (arquivo: string): void => {
      if (vistos.has(arquivo)) return;
      vistos.add(arquivo);
      const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true);
      for (const n of fonte.statements) {
        if (!ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)) continue;
        if (ts.isImportDeclaration(n) && n.importClause?.isTypeOnly) continue;
        if (ts.isExportDeclaration(n) && n.isTypeOnly) continue;
        const esp = n.moduleSpecifier;
        if (!esp || !ts.isStringLiteral(esp)) continue;
        vistosEsp.push(esp.text);
        const alvo = resolver(arquivo, esp.text);
        if (alvo) andar(alvo);
      }
    };
    andar(inicio);
    return { arquivos: [...vistos], especificadores: vistosEsp };
  }

  it("a TelaDePublicar não alcança o registro, o schema, o zod, nem as funções que os leem", () => {
    const { arquivos, especificadores: esps } = especificadores(path.join(RAIZ, "app", "admin", "TelaDePublicar.tsx"));
    expect(arquivos.some((a) => a.endsWith("gravar.ts")), "o caminhante não seguiu os imports").toBe(true);
    for (const p of PROIBIDOS) expect(esps, `a tela de cliente alcança ${p}`).not.toContain(p);
  });

  it("controle: o caminhante enxerga o proibido quando ele está lá (a página de servidor)", () => {
    const { especificadores: esps } = especificadores(path.join(RAIZ, "app", "admin", "novo", "publicar", "page.tsx"));
    expect(esps).toContain("@/lib/o-que-o-app-cala");
    expect(esps).toContain("@/lib/campos-da-ficha");
  });
});
