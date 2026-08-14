import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import LocalVivo, { useGps, useLocal, useMexerLocal } from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL, type Local } from "@/lib/local";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const GRAVATA: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

function Espia() {
  const l = useLocal();
  const gps = useGps();
  return <div data-testid="espia">{`${l.tipo}|${gps}`}</div>;
}

describe("LocalVivo", () => {
  it("fora de um provedor, é 'não sei' — nunca estoura", () => {
    render(<Espia />);
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
  });

  // ESTA É A REGRA DURA. A home chega do cache do service worker com HTML
  // velho; ler o aparelho durante o render quebraria a hidratação exatamente
  // no elemento que carrega a decisão. Mesma disciplina do useVenceu.
  it("com localização guardada, o PRIMEIRO render ainda é 'não sei'", () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    let noPrimeiroRender = "";
    function Grava() {
      const l = useLocal();
      noPrimeiroRender ||= l.tipo;
      return null;
    }
    render(<LocalVivo><Grava /></LocalVivo>);
    expect(noPrimeiroRender).toBe("nao-sei");
  });

  it("depois de montar, a localização guardada entra", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
  });

  it("guardado torto não derruba nada: fica 'não sei'", async () => {
    localStorage.setItem(CHAVE_LOCAL, "{lixo");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|nunca")).toBeTruthy();
  });

  it("escolher grava no aparelho e aparece na tela", async () => {
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });
});

describe("o GPS", () => {
  function aparelhoComGps(impl: (ok: PositionCallback, erro: PositionErrorCallback) => void) {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: impl },
    });
  }

  // Nunca sozinho na abertura: negado por reflexo, o navegador não pergunta
  // mais nunca e o GPS morre naquele aparelho.
  it("não pede GPS sozinho ao montar", async () => {
    const pediu = vi.fn();
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(pediu).not.toHaveBeenCalled();
  });

  it("pedirGps aceito vira localização de gps", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -8.1, longitude: -35.5 } } as GeolocationPosition),
    );
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("gps|nunca");
  });

  it("negado fica marcado no aparelho — o app não pergunta de novo", async () => {
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|negado");
    expect(localStorage.getItem(CHAVE_GPS)).toBe("negado");
  });

  // Estourou o prazo com uma posição guardada em mãos: a guardada continua.
  // Trocar por "não sei" apagaria da tela um km que estava certo.
  it("gps que falha não apaga a localização que já existia", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    aparelhoComGps((_ok, erro) => erro({ code: 3 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|negado");
  });

  // Concedido uma vez, o navegador não pergunta mais. A partir daí toda
  // abertura já vem com a posição, sem toque nenhum — é a promessa que o João
  // aprovou ("um toque na vida").
  it("com gps já concedido antes, busca sozinho ao montar", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.3, lng: -35.4 }, em: 1_800_000_000,
    }));
    const pediu = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -8.31, longitude: -35.41 } } as GeolocationPosition),
    );
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(pediu).toHaveBeenCalled();
  });
});
