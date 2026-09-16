import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste";

beforeEach(() => {
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

const pedido = (body: unknown) =>
  new Request("http://x/api/admin/entrar", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/admin/entrar", () => {
  it("senha certa devolve um cookie httpOnly, secure e sameSite=strict", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: SENHA }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_ADMIN}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
  });

  it("senha errada não devolve cookie nenhum", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: "e".repeat(MIN_SENHA) }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("corpo sem senha, ou lixo, não estoura", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    expect((await POST(pedido({}))).status).toBe(401);
    expect((await POST(pedido({ senha: 42 }))).status).toBe(401);
    const cru = new Request("http://x/api/admin/entrar", { method: "POST", body: "nao-e-json" });
    expect((await POST(cru)).status).toBe(401);
  });

  // 🔴 FALHA FECHADA. Sem ADMIN_SENHA o painel não existe — 404, não 401.
  // 401 diria "existe um admin aqui, tente de novo". 404 não diz nada.
  it("sem ADMIN_SENHA configurada, a rota é 404", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: SENHA }));
    expect(res.status).toBe(404);
  });

  it("com ADMIN_SENHA curta, a rota também é 404 — o painel está desligado", async () => {
    vi.stubEnv("ADMIN_SENHA", "curta");
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/entrar/route");
    expect((await POST(pedido({ senha: "curta" }))).status).toBe(404);
  });

  // 🔴 GUARDA DE FONTE. A suíte de comportamento acima passa igual se a rota
  // trocar `senhaConfere(cfg.senha, senha)` por `cfg.senha === senha` — os
  // valores de teste são strings do mesmo tamanho, então a comparação insegura
  // dá as mesmas respostas. Só olhando o texto da rota se prova que a
  // comparação de tempo constante realmente está no caminho da senha. Mira o
  // PONTO DE CHAMADA exato (com os argumentos), não a palavra solta —
  // `toContain("senhaConfere")` sobreviveria pendurado no import.
  it("guarda de fonte: a rota chama senhaConfere(cfg.senha, senha), não ===", () => {
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "app", "api", "admin", "entrar", "route.ts"),
      "utf8",
    );
    expect(fonte).toMatch(/senhaConfere\(cfg\.senha, senha\)/);
  });
});

describe("POST /api/admin/sair", () => {
  it("apaga o cookie", async () => {
    const { POST } = await import("@/app/api/admin/sair/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_ADMIN}=;`);
    expect(cookie).toContain("Max-Age=0");
  });
});
