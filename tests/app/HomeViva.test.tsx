import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import HomeViva from "@/app/HomeViva";
import { useLeitura } from "@/app/leituras";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);
const VELHA: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: AGORA_S - 3600 };

/** Uma sonda que só reporta o que o contexto está dizendo.
 *
 *  O trabalho do HomeViva é buscar e PUBLICAR — quem pinta é o CartaoTrilha, e
 *  a costura entre contexto, cor e palavra já tem guarda própria no teste do
 *  MapaHome. Testar por aqui com o cartão de verdade misturaria as duas coisas
 *  e obrigaria este arquivo a montar uma Ficha inteira só pra ler uma palavra. */
function Sonda({ slug }: { slug: string }) {
  const l = useLeitura(slug);
  return <span data-testid="sonda">{l ? `${l.estado}·${l.erro}·${l.calculadoEm}` : "sem"}</span>;
}

function montar(inicial: Record<string, LeituraCarimbo>) {
  return render(
    <HomeViva inicial={inicial}>
      <Sonda slug="rampa" />
    </HomeViva>,
  );
}

function lido() {
  return screen.getByTestId("sonda").textContent;
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(AGORA_S * 1000); });
afterEach(() => { vi.useRealTimers(); cleanup(); vi.unstubAllGlobals(); });

describe("HomeViva", () => {
  it("sem busca nenhuma, publica o que veio do servidor", () => {
    montar({ rampa: { estado: "fresco", erro: false, calculadoEm: AGORA_S } });
    expect(lido()).toBe(`fresco·false·${AGORA_S}`);
  });

  it("leitura vencida + volta pra frente = busca, e a leitura nova entra no contexto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ rampa: { estado: "frio", erro: false, calculadoEm: AGORA_S } })),
    ));
    montar({ rampa: VELHA });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith("/api/carimbos", expect.objectContaining({ cache: "no-store" }));
    expect(lido()).toBe(`frio·false·${AGORA_S}`);
  });

  // O corpo torto não pode virar decisão: `carimboVenceu(undefined)` é NaN, e
  // NaN >= 1800 é false — a tela afirmaria "Pode subir" a partir de nada.
  it("corpo fora do formato é descartado, e a leitura velha continua valendo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rampa: { estado: "azul" } }))));
    montar({ rampa: VELHA });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(lido()).toBe(`fresco·false·${VELHA.calculadoEm}`);
  });

  it("slug torto não contamina os slugs bons do mesmo corpo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        rampa: { estado: "frio", erro: false, calculadoEm: AGORA_S },
        outra: { estado: "azul" },
      })),
    ));
    montar({ rampa: VELHA });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(lido()).toBe(`frio·false·${AGORA_S}`);
  });

  it("leitura fresca não dispara busca — o piso existe pra não virar dez chamadas", async () => {
    vi.stubGlobal("fetch", vi.fn());
    montar({ rampa: { estado: "fresco", erro: false, calculadoEm: AGORA_S } });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
