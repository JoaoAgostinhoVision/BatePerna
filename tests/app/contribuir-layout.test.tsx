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
