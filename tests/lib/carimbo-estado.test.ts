import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);
const H = 3600;

vi.mock("@/lib/weather", () => ({ fetchPrecip: vi.fn() }));
const { fetchPrecip } = await import("@/lib/weather");

function ficha() {
  const f = getFicha("rampa-do-pepe");
  if (!f) throw new Error("a ficha da Rampa sumiu do content/");
  return f;
}

/** Série horária cobrindo a janela inteira, com o mesmo mm em toda hora. */
function chuvaConstante(mm: number) {
  const precips = [];
  for (let i = -24; i <= 24; i++) precips.push({ time: AGORA_S + i * H, mm });
  return { precips, raw: { hourly: { time: [], precipitation: [] } } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { vi.useRealTimers(); vi.mocked(fetchPrecip).mockReset(); });

describe("resolverEstado", () => {
  it("sem chuva na janela, a serra está fresca", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(0));
    expect(await resolverEstado(ficha())).toEqual({
      estado: "fresco", erro: false, calculadoEm: AGORA_S,
    });
  });

  it("chovendo, o barro segura água", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(5));
    const r = await resolverEstado(ficha());
    expect(r.estado).toBe("frio");
    expect(r.erro).toBe(false);
  });

  it("Open-Meteo fora do ar cai pro lado seguro E admite que não leu", async () => {
    // Os dois juntos são o ponto: 'frio' sem 'erro' seria o app afirmando
    // barro que ele não mediu.
    vi.mocked(fetchPrecip).mockRejectedValue(new Error("503"));
    expect(await resolverEstado(ficha())).toEqual({
      estado: "frio", erro: true, calculadoEm: AGORA_S,
    });
  });

  it("o debug da URL curto-circuita sem tocar a rede", async () => {
    expect((await resolverEstado(ficha(), "fresco")).estado).toBe("fresco");
    expect((await resolverEstado(ficha(), "frio")).estado).toBe("frio");
    expect(fetchPrecip).not.toHaveBeenCalled();
  });

  it("debug inventado é ignorado — só 'fresco' e 'frio' valem", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(0));
    expect((await resolverEstado(ficha(), "nublado")).estado).toBe("fresco");
    expect(fetchPrecip).toHaveBeenCalled();
  });
});
