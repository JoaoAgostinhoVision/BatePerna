import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import EditorCalibrar, { CALIBRAR, FALTA_UM_DOS_QUATRO } from "@/app/admin/campos/EditorCalibrar";
import FichaInteira from "@/app/admin/FichaInteira";
import { ComVersaoDaTela } from "@/app/admin/campos/gravar";
import { fichaSchema } from "@/types/ficha";
import { loadAll } from "@/lib/ficha";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ROT = { previsao: "R1", passado: "R2", limiar: "R3", severidade: "R4" };
// O DOCUMENTO de um lugar mandado por quem usa (sem `condicao.regra`), e NÃO a
// ficha pública (`FichaNoAr`, que sempre traz regra — a padrão, quando falta):
// com a pública, o ramo "sem regra própria" nunca seria exercitado.
const PESSOA = fichaSchema.parse({
  slug: "pedra-mandada-cidade-teste", modos: [], cidade: "Cidade Teste", promessa: "p",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] }, acesso: "a",
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
});

describe("EditorCalibrar", () => {
  it("os quatro campos começam VAZIOS — nada pré-preenchido", () => {
    const { getByLabelText } = render(<EditorCalibrar slug="x" rotulos={ROT} />);
    for (const r of ["R1", "R2", "R3"]) expect((getByLabelText(r) as HTMLInputElement).value).toBe("");
    expect((getByLabelText("R4") as HTMLSelectElement).value).toBe("");
  });

  it("manda os quatro como números, com o baseId da tela, num POST só", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { getByLabelText, getByRole } = render(
      <ComVersaoDaTela id={5}><EditorCalibrar slug="x" rotulos={ROT} /></ComVersaoDaTela>,
    );
    fireEvent.change(getByLabelText("R1"), { target: { value: "2" } });
    fireEvent.change(getByLabelText("R2"), { target: { value: "5" } });
    fireEvent.change(getByLabelText("R3"), { target: { value: "1.2" } });
    fireEvent.change(getByLabelText("R4"), { target: { value: "espera" } });
    fireEvent.click(getByRole("button", { name: CALIBRAR }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/calibrar");
    expect(JSON.parse(init.body)).toEqual({
      slug: "x", baseId: 5,
      regra: { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" },
    });
  });
});

describe("EditorCalibrar com resposta faltando", () => {
  it("com uma caixa vazia, não chama a rota e diz o que falta", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const { getByLabelText, getByRole, findByRole } = render(<EditorCalibrar slug="x" rotulos={ROT} />);
    fireEvent.change(getByLabelText("R1"), { target: { value: "2" } });
    fireEvent.change(getByLabelText("R2"), { target: { value: "5" } });
    fireEvent.change(getByLabelText("R4"), { target: { value: "espera" } });
    fireEvent.click(getByRole("button", { name: CALIBRAR }));
    expect((await findByRole("alert")).textContent).toBe(FALTA_UM_DOS_QUATRO);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("a ficha inteira de um lugar sem regra própria", () => {
  it("mostra o Calibrar, e NÃO os editores de número da regra", () => {
    const { container, getByRole } = render(<FichaInteira ficha={PESSOA} />);
    expect(getByRole("button", { name: CALIBRAR })).not.toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.regra.limiar_mm"]')).toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.severidade"]')).toBeNull();
  });

  // É também o CONTROLE do caso de cima: o MESMO seletor acha o bloco na Rampa
  // — sem ele, o `toBeNull()` de lá passaria por vacuidade.
  it("a da Rampa (com regra) mostra os editores de sempre, e não o Calibrar", () => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    const { container, queryByRole } = render(<FichaInteira ficha={rampa} />);
    expect(queryByRole("button", { name: CALIBRAR })).toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.regra.limiar_mm"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.severidade"]')).not.toBeNull();
  });
});
