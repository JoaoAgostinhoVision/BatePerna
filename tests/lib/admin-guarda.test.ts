import { afterEach, describe, expect, it, vi } from "vitest";
import { lerConfigAdmin, MIN_SENHA } from "@/lib/admin-config";
import { avisarDesligado } from "@/lib/admin-guarda";

afterEach(() => vi.restoreAllMocks());

// 🔴 I4 DA REVISÃO FINAL (2026-09-16): a spec pedia "falha fechada" E "motivo
// explícito na tela", e os dois se contradizem — falha fechada VENCE. A tela
// pública nunca explica por que o admin está desligado; o motivo vai pro LOG
// do servidor, e só quando é ENGANO (senha curta, sem segredo). `ausente` é o
// estado normal de todo ambiente não configurado e não pode virar ruído.
describe("avisarDesligado", () => {
  const SENHA = "s".repeat(MIN_SENHA);

  it("senha curta — avisa uma vez, com o motivo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    avisarDesligado(lerConfigAdmin({ ADMIN_SENHA: "curta", ADMIN_SEGREDO: "x" }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("senha-curta");
  });

  it("sem segredo — avisa uma vez, com o motivo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    avisarDesligado(lerConfigAdmin({ ADMIN_SENHA: SENHA, ADMIN_SEGREDO: "" }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("sem-segredo");
  });

  it("ausente — NÃO avisa: é o estado normal, não um engano", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    avisarDesligado(lerConfigAdmin({}));
    expect(warn).not.toHaveBeenCalled();
  });

  it("ligado — não avisa nada", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    avisarDesligado(lerConfigAdmin({ ADMIN_SENHA: SENHA, ADMIN_SEGREDO: "x" }));
    expect(warn).not.toHaveBeenCalled();
  });
});
