import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DistanciaDaqui from "@/app/DistanciaDaqui";
import LocalVivo from "@/app/local";
import { getFichasComCondicao } from "@/lib/ficha";
import { CHAVE_GPS, CHAVE_LOCAL } from "@/lib/local";
import { bancoDeProducao } from "../banco";

const RAMPA = { lat: -7.907889, lng: -36.019222 };

// O componente recebe a FICHA e pergunta a `coordDaDistancia` qual coordenada
// vale — não um par lat/lng escolhido por quem renderiza. A ficha real da
// Rampa entra aqui de propósito; a asserção logo abaixo é o que mantém o
// "~111 km" destes testes ancorado num fato, e não numa lembrança.
// Pelo SLUG, não pelo índice: `[0]` significava "a Rampa" só enquanto o acervo
// tinha uma ficha. Entrou a Pedra Furada de Venturosa (2026-08-25) e
// `ordenarPorNome` a pôs na frente — o `[0]` passou a ser outra trilha, e as
// contas de ~111 km deste arquivo são todas ancoradas na coordenada da Rampa.
// O acervo vem do BANCO desde 2026-09-25 (semeado de `content/fichas/`), lido
// uma vez no topo — `ficha` é constante de módulo.
await bancoDeProducao();
const ACERVO = await getFichasComCondicao();

function fichaReal(slug: string) {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`ficha "${slug}" não está no acervo — estes testes são sobre ela`);
  return f;
}

const ficha = fichaReal("rampa-do-pepe");

describe("a ficha usada nestes testes", () => {
  it("começa na coordenada que as contas de ~111 km assumem", () => {
    expect(ficha.trajeto.waypoints[0].lat).toBe(RAMPA.lat);
    expect(ficha.trajeto.waypoints[0].lng).toBe(RAMPA.lng);
  });
});

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
  localStorage.clear();
});

describe("DistanciaDaqui", () => {
  it("sem localização e sem GPS negado, mostra o botão", () => {
    plantarGeo(undefined);
    render(<LocalVivo><DistanciaDaqui ficha={ficha} /></LocalVivo>);
    expect(screen.getByRole("button", { name: /dist[âa]ncia/i })).toBeTruthy();
  });

  it("já com localização no contexto, mostra a distância direto — sem botão", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido",
      coord: { lat: RAMPA.lat + 1, lng: RAMPA.lng },
      em: 1_800_000_000,
      nome: "Lugar Fictício",
      regiao: "Pernambuco",
    }));
    render(<LocalVivo><DistanciaDaqui ficha={ficha} /></LocalVivo>);
    expect(await screen.findByText(/~111 km em linha reta daqui/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dist[âa]ncia/i })).toBe(null);
  });

  it("GPS já negado antes, mostra o aviso — sem botão que não faz nada", () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    render(<LocalVivo><DistanciaDaqui ficha={ficha} /></LocalVivo>);
    expect(screen.getByText(/sem localiza[çc][ãa]o/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dist[âa]ncia/i })).toBe(null);
  });

  // O `<LocalVivo>` agora busca sozinho ao montar (Task 1 do review do
  // celular) — a primeira chamada aqui é a da montagem, não a do toque. O
  // mock falha na primeira chamada (sem sinal, code 2) pra deixar o botão
  // na tela, e só resolve na segunda — a do toque — pra continuar provando
  // que o CLIQUE também busca e a distância nasce da resposta dele.
  it("o toque pede a localização ao CONTEXTO, e a distância nasce quando ele responde", async () => {
    let chamadas = 0;
    plantarGeo({
      getCurrentPosition: (ok: PositionCallback, erro: PositionErrorCallback) => {
        chamadas += 1;
        if (chamadas === 1) {
          erro({ code: 2 } as GeolocationPositionError);
          return;
        }
        // um grau de latitude ao norte da Rampa ≈ 111 km
        ok({ coords: { latitude: RAMPA.lat + 1, longitude: RAMPA.lng } } as GeolocationPosition);
      },
    });

    render(<LocalVivo><DistanciaDaqui ficha={ficha} /></LocalVivo>);
    await screen.findByRole("button", { name: /dist[âa]ncia/i });
    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));

    expect(await screen.findByText(/~111 km em linha reta daqui/)).toBeTruthy();
  });

  // Task 1 do review do celular virou este teste do avesso: o pedido de GPS
  // deixou de ficar atrás de um toque de propósito (era esta a garantia
  // antes) e passou a disparar sozinho na montagem, por decisão do João. O
  // toque continua funcionando — é a chamada ADICIONAL que a prova mede.
  it("já pede sozinho ao montar, e o toque busca de novo", async () => {
    const espiao = vi.fn();
    plantarGeo({ getCurrentPosition: espiao });

    render(<LocalVivo><DistanciaDaqui ficha={ficha} /></LocalVivo>);
    await act(async () => {});
    expect(espiao).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /dist[âa]ncia/i }));
    expect(espiao).toHaveBeenCalledTimes(2);
  });

  // "Uma pessoa, uma fonte" — a invariante desta rodada. Hoje o
  // DistanciaDaqui.tsx chama `navigator.geolocation` por conta própria (linha
  // ~15), e é ESTA task que o migra pro contexto. Duas verdades sobre a mesma
  // pergunta em duas telas do mesmo app: o mapa dizendo que você está em
  // Gravatá e a ficha medindo de outro lugar, sem nada na tela explicando a
  // diferença.
  //
  // A prova é asserção de FONTE, e de propósito: um teste de comportamento em
  // jsdom passaria com as duas implementações, porque o `navigator.geolocation`
  // está stubado nos dois casos. O que precisa morrer é a CHAMADA PRÓPRIA, e
  // isso só se vê lendo o arquivo. Mesmo padrão dos testes de `"use client"`.
  it("a ficha não tem GPS próprio — lê a mesma localização que o mapa", () => {
    const fonte = readFileSync(
      path.join(process.cwd(), "src", "app", "DistanciaDaqui.tsx"), "utf8");
    expect(fonte).not.toContain("navigator.geolocation");
    expect(fonte).toContain("useMexerLocal");
  });
});
