import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DistanciaDaqui from "@/app/DistanciaDaqui";

const RAMPA = { lat: -7.907889, lng: -36.019222 };

/** jsdom não traz navigator.geolocation; a gente planta (ou remove) na mão. */
function plantarGeo(valor: unknown) {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    value: valor,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  plantarGeo(undefined);
  vi.restoreAllMocks();
});

describe("DistanciaDaqui", () => {
  it("um toque mede e mostra a distância dizendo que é linha reta", () => {
    plantarGeo({
      getCurrentPosition: (ok: PositionCallback) =>
        // um grau de latitude ao norte da Rampa ≈ 111 km
        ok({ coords: { latitude: RAMPA.lat + 1, longitude: RAMPA.lng } } as GeolocationPosition),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/~111 km em linha reta daqui/)).toBeTruthy();
  });

  it("em cima do lugar não finge precisão", () => {
    plantarGeo({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: RAMPA.lat, longitude: RAMPA.lng } } as GeolocationPosition),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/menos de 1 km em linha reta daqui/)).toBeTruthy();
  });

  it("permissão negada vira estado normal, sem insistir", () => {
    plantarGeo({
      getCurrentPosition: (_ok: PositionCallback, erro: PositionErrorCallback) =>
        erro({ code: 1, message: "denied" } as GeolocationPositionError),
    });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/sem localiza[çc][ãa]o/i)).toBeTruthy();
    // e o convite some — não fica pedindo de novo
    expect(screen.queryByRole("button", { name: /dist[âa]ncia/i })).toBe(null);
  });

  it("navegador sem geolocalização cai no mesmo estado, sem quebrar", () => {
    plantarGeo(undefined);

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(screen.getByText(/sem localiza[çc][ãa]o/i)).toBeTruthy();
  });

  it("não pede localização sozinho — só depois do toque", () => {
    const espiao = vi.fn();
    plantarGeo({ getCurrentPosition: espiao });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    expect(espiao).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it("enquanto mede, o botão não aceita toque duplo", () => {
    const espiao = vi.fn(); // nunca chama callback: fica preso em "medindo"
    plantarGeo({ getCurrentPosition: espiao });

    render(<DistanciaDaqui lat={RAMPA.lat} lng={RAMPA.lng} />);
    const btn = screen.getByRole("button", { name: /dist[âa]ncia/i });
    fireEvent.click(btn);

    expect(screen.getByText(/vendo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(espiao).toHaveBeenCalledTimes(1);
  });
});
