import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import TelaDaRegraPadrao, { SALVAR_REGRA, VALE_PARA } from "@/app/admin/TelaDaRegraPadrao";
import { FALTA_UM_DOS_QUATRO } from "@/app/admin/campos/EditorCalibrar";

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

  // 🔴 I4 da revisão final: `Number("") === 0`, e 0 é uma regra VÁLIDA (cada
  // janela pode ser 0 sozinha) — a caixa apagada pra redigitar gravaria uma
  // regra que ninguém escolheu, sem frase nenhuma. A guarda do Calibrar.
  it.each(["R1", "R2", "R3"])("com a caixa %s vazia, não chama a rota e diz o que falta", async (rotulo) => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const { getByLabelText, getByRole, findByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.change(getByLabelText(rotulo), { target: { value: "" } });
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    expect((await findByRole("alert")).textContent).toBe(FALTA_UM_DOS_QUATRO);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  // M2 da revisão final: "hoje, os mandados por quem usa o app" ficava falso no
  // primeiro Calibrar (um mandado com regra própria não usa a padrão). Saiu
  // por subtração; nenhum estado de agora volta pra esta frase.
  it("VALE_PARA não afirma quem usa a regra hoje", () => {
    expect(VALE_PARA).not.toMatch(/hoje|mandados/i);
  });

  it("a recusa com frase aparece na tela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Frase da porta.", { status: 400 })));
    const { getByRole, findByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    expect((await findByRole("alert")).textContent).toBe("Frase da porta.");
  });
});
