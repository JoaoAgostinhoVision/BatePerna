import { beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => clerk);

const { ClerkFora, irPraEntrar, lerContribuidor } = await import("@/lib/contribuidor-sessao");

beforeEach(() => { clerk.auth.mockReset(); clerk.currentUser.mockReset(); });

describe("lerContribuidor", () => {
  it("sem sessão: null, e não pergunta quem é", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect(await lerContribuidor()).toBeNull();
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it("com sessão: o id, o nome e o e-mail principal", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ firstName: "Maria", lastName: "Teste", primaryEmailAddress: { emailAddress: "m@teste.invalid" } });
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: "Maria Teste", email: "m@teste.invalid" });
  });

  // O nome e o e-mail são só pro painel dele: sem eles, a pessoa ainda contribui.
  it("o perfil não vem: o id basta, nome e e-mail ficam null — nada inventado", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockRejectedValue(new Error("rede"));
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: null, email: null });
  });

  it("perfil sem nome: null, nunca string vazia", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ firstName: null, lastName: null, primaryEmailAddress: null });
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: null, email: null });
  });

  it("o Clerk não responde (ou sem middleware/chave): estoura ClerkFora", async () => {
    clerk.auth.mockRejectedValue(new Error("clerkMiddleware não rodou"));
    await expect(lerContribuidor()).rejects.toBeInstanceOf(ClerkFora);
  });
});

describe("irPraEntrar", () => {
  // O `redirectToSignIn()` do Next estoura (NEXT_REDIRECT) em vez de voltar;
  // o dublê imita isso. SEM argumento: o Clerk volta pro endereço do pedido —
  // um endereço fixo aqui perderia o `?p=N` da pergunta.
  it("manda pra tela de entrar do Clerk, sem endereço de volta fixo", async () => {
    const redirectToSignIn = vi.fn(() => { throw new Error("NEXT_REDIRECT"); });
    clerk.auth.mockResolvedValue({ userId: null, redirectToSignIn });
    await expect(irPraEntrar()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectToSignIn).toHaveBeenCalledTimes(1);
    expect(redirectToSignIn).toHaveBeenCalledWith();
  });
});
