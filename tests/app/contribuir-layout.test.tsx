import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/** O LAYOUT DE /contribuir (ruling do controlador na Task 14): com as duas
 *  chaves do Clerk, as telas dela moram dentro do `<ClerkProvider>` — é o
 *  clerk-js no navegador que renova a sessão (~60 s) enquanto ela responde, e
 *  sem ele todo Salvar depois de um minuto voltava 401 e a tela recarregava,
 *  perdendo o que ela digitou. Sem as chaves (testes, `npm run build`, produção
 *  antes da integração), o provedor estouraria por falta da chave pública: as
 *  telas descem SEM ele, e a porta das páginas mostra a frase do Clerk fora.
 *
 *  O provedor é dublado: o que se prova aqui é a DECISÃO (por
 *  `clerkConfigurado`, a mesma do middleware), não a renovação — essa só se
 *  mede com chave de verdade, no ar. */
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="clerk-provider">{children}</div>,
}));
const Layout = (await import("@/app/contribuir/layout")).default;

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const filho = <p data-testid="filho">as perguntas dela</p>;

describe("o layout de /contribuir", () => {
  it("com as duas chaves: as telas dela dentro do ClerkProvider", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const { container } = render(<>{Layout({ children: filho })}</>);
    expect(container.querySelector('[data-testid="clerk-provider"] [data-testid="filho"]')).not.toBeNull();
  });

  it.each([
    ["sem nenhuma", undefined, undefined],
    ["só a pública", "pk_test_x", undefined],
    ["só a secreta", undefined, "sk_test_x"],
  ])("%s: as telas descem sem o provedor (que estouraria sem a chave)", (_nome, pub, sec) => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pub);
    vi.stubEnv("CLERK_SECRET_KEY", sec);
    const { container } = render(<>{Layout({ children: filho })}</>);
    expect(container.querySelector('[data-testid="filho"]'), "a premissa: o filho desceu").not.toBeNull();
    expect(container.querySelector('[data-testid="clerk-provider"]')).toBeNull();
  });
});

// 25/10 (pedido do João: "faça de acordo com o design do sistema"): as telas
// dela moram na moldura do app — `.bp` › `.screen`, a marca em cima, a barra
// embaixo — com ou sem o Clerk.
describe("a moldura do app nas telas dela", () => {
  it.each([
    ["com as chaves", "pk_test_x", "sk_test_x"],
    ["sem as chaves", undefined, undefined],
  ])("%s: o filho mora em .bp-manda .screen, entre a marca e a barra", (_n, pub, sec) => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", pub);
    vi.stubEnv("CLERK_SECRET_KEY", sec);
    const { container } = render(<>{Layout({ children: filho })}</>);
    const tela = container.querySelector(".bp.bp-manda > .screen");
    expect(tela, "a moldura").not.toBeNull();
    expect(tela!.firstElementChild?.className).toBe("appbar");
    expect(tela!.querySelector('[data-testid="filho"]')).not.toBeNull();
    expect(tela!.lastElementChild?.tagName).toBe("NAV");
    // O item de mandar continua sem `aria-current` (não é seção), e nenhum acende.
    expect(tela!.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("a folha dela só usa as cores do app (tokens), nunca cor solta — o escuro vem junto", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/contribuir/contribuir.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.match(/var\(--/g)?.length ?? 0, "a premissa: a folha usa tokens").toBeGreaterThan(20);
    // Só o branco do texto no botão cheio, como o `.mk` da marca.
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toEqual(["#fff"]);
    // Toda regra é escopada: nenhuma vaza pro painel do João.
    const seletores = css.split("}").map((b) => b.split("{")[0].trim()).filter(Boolean);
    for (const s of seletores) for (const parte of s.split(",")) expect(parte.trim(), s).toMatch(/^\.bp-manda\b/);
  });
});
