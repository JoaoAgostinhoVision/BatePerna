import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import TelaDaRegraPadrao, { SALVAR_REGRA } from "@/app/admin/TelaDaRegraPadrao";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ROTULOS = { previsao: "R1", passado: "R2", limiar: "R3", severidade: "R4" };
const ATUAL = { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado" as const };

describe("a tela da regra padrão", () => {
  it("mostra os quatro valores de AGORA, cada um com o rótulo já lido do painel", () => {
    const { getByLabelText } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    expect((getByLabelText("R1") as HTMLInputElement).value).toBe("3");
    expect((getByLabelText("R2") as HTMLInputElement).value).toBe("6");
    expect((getByLabelText("R3") as HTMLInputElement).value).toBe("0.2");
    expect((getByLabelText("R4") as HTMLSelectElement).value).toBe("cuidado");
  });

  it("salvar manda os quatro como NÚMEROS, num PUT só, e relê a tela", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByLabelText, getByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.change(getByLabelText("R2"), { target: { value: "12" } });
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/regra-padrao");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ ...ATUAL, janela_passado_horas: 12 });
  });

  it("a recusa com frase aparece na tela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Frase da porta.", { status: 400 })));
    const { getByRole, findByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    expect((await findByRole("alert")).textContent).toBe("Frase da porta.");
  });
});
