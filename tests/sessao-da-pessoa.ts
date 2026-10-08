import type { QuemContribui } from "@/lib/contribuidor-sessao";

/** O DUBLÊ DO CLERK de todas as rotas e telas da pessoa. Quem o usa faz, no
 *  topo do arquivo:
 *
 *    vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
 *
 *  e muda `sessao.atual` / `sessao.fora` em cada caso. Nenhuma chave real.
 *
 *  🔴 O ESTADO MORA EM `globalThis`, NÃO NUM `const` DESTE MÓDULO (C2 da
 *  pré-auditoria de 07/10). A pré-auditoria mediu, num experimento seu, a rota
 *  lendo um `sessao` e o teste mudando outro ("sem sessão" esperava 401 e
 *  recebeu 200). ⚠️ No molde de `tests/api/route-contribuir-rascunho.test.ts`
 *  isso NÃO se reproduziu (medido na Task 10, vitest 2.1.9): a fábrica do
 *  `vi.mock` roda UMA vez por arquivo — o `vi.resetModules()` não zera o
 *  registro de mocks —, este módulo nasce uma vez só, e com o estado num
 *  `const` a SONDA 1 de lá passava verde. Onde ele renasce é num import
 *  DIRETO depois do `vi.resetModules()`: um `const` daria ali outro `sessao`.
 *  Com o `??=` em `globalThis`, toda instância deste módulo devolve o MESMO
 *  objeto, seja qual for o molde de quem o usa. A SONDA 2 daquele arquivo
 *  trava isto: volte a um `const` local e ela fica vermelha. */
export const PESSOA: QuemContribui = { id: "user_pessoa_de_teste", nome: "Maria Teste", email: "maria@teste.invalid" };
export const OUTRA: QuemContribui = { id: "user_outra_pessoa", nome: "Outra Pessoa", email: null };

type Sessao = { atual: QuemContribui | null; fora: boolean };
const g = globalThis as typeof globalThis & { __sessaoDaPessoa?: Sessao };
export const sessao: Sessao = (g.__sessaoDaPessoa ??= { atual: PESSOA, fora: false });

class ClerkFora extends Error {}
export const moduloFalso = {
  ClerkFora,
  lerContribuidor: async (): Promise<QuemContribui | null> => {
    if (sessao.fora) throw new ClerkFora("dublê: o Clerk caiu");
    return sessao.atual;
  },
  irPraEntrar: async (): Promise<never> => {
    throw new Error("NEXT_REDIRECT_PRA_ENTRAR");
  },
};
