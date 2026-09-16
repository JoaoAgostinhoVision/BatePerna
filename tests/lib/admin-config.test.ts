import { describe, expect, it } from "vitest";
import { MIN_SENHA, lerConfigAdmin } from "@/lib/admin-config";

const SENHA_BOA = "x".repeat(MIN_SENHA);
const SEGREDO = "um-segredo-de-assinatura-qualquer";

describe("lerConfigAdmin", () => {
  it("com senha longa e segredo, o admin está ligado", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA, ADMIN_SEGREDO: SEGREDO })).toEqual({
      ligado: true,
      senha: SENHA_BOA,
      segredo: SEGREDO,
    });
  });

  // 🔴 FALHA FECHADA. Uma variável de ambiente que some — deploy novo, projeto
  // clonado, ambiente de preview — não pode virar painel aberto. "Ausente" é o
  // caso NORMAL enquanto ele não configurar, e o app tem que rodar assim.
  it("sem senha nenhuma, o admin não existe", () => {
    expect(lerConfigAdmin({}).ligado).toBe(false);
    expect(lerConfigAdmin({})).toEqual({ ligado: false, motivo: "ausente" });
    expect(lerConfigAdmin({ ADMIN_SENHA: "" })).toEqual({ ligado: false, motivo: "ausente" });
    expect(lerConfigAdmin({ ADMIN_SENHA: "   " })).toEqual({ ligado: false, motivo: "ausente" });
  });

  // 🔴 Senha fraca é a chave do app inteiro. Recusar DESLIGA o painel em vez de
  // pedir cuidado: o erro fica impossível, não improvável.
  it("senha curta desliga o admin, e a borda decide de um jeito só", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: "x".repeat(MIN_SENHA - 1), ADMIN_SEGREDO: SEGREDO })).toEqual({
      ligado: false,
      motivo: "senha-curta",
    });
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA, ADMIN_SEGREDO: SEGREDO }).ligado).toBe(true);
  });

  it("senha boa sem segredo de assinatura também desliga", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA })).toEqual({
      ligado: false,
      motivo: "sem-segredo",
    });
  });

  it("o mínimo é 24 — abaixo disso força bruta deixa de ser teoria", () => {
    expect(MIN_SENHA).toBe(24);
  });
});
