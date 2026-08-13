import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFicha } from "@/lib/ficha";
import { janelaMaxima, resolverEstado, resolverEstados } from "@/lib/carimbo-estado";
import type { Ficha } from "@/types/ficha";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);
const H = 3600;

vi.mock("@/lib/weather", () => ({ fetchPrecip: vi.fn(), fetchPrecipMulti: vi.fn() }));
const { fetchPrecip, fetchPrecipMulti } = await import("@/lib/weather");

function ficha() {
  const f = getFicha("rampa-do-pepe");
  if (!f) throw new Error("a ficha da Rampa sumiu do content/");
  return f;
}

/** Uma ficha mínima com regra própria. Só o que resolverEstados olha. */
function fichaFake(slug: string, passado: number, previsao: number, lat: number): Ficha {
  const base = ficha();
  return {
    ...base,
    slug,
    condicao: {
      ...base.condicao,
      coords: { lat, lng: -36 },
      regra: { ...base.condicao.regra, janela_passado_horas: passado, janela_previsao_horas: previsao },
    },
  };
}

/** Série horária constante, do jeito que fetchPrecipMulti devolve. */
function serie(mm: number) {
  const p = [];
  for (let i = -48; i <= 48; i++) p.push({ time: AGORA_S + i * H, mm });
  return p;
}

/** Série horária cobrindo a janela inteira, com o mesmo mm em toda hora. */
function chuvaConstante(mm: number) {
  const precips = [];
  for (let i = -24; i <= 24; i++) precips.push({ time: AGORA_S + i * H, mm });
  return { precips, raw: { hourly: { time: [], precipitation: [] } } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(fetchPrecip).mockReset();
  vi.mocked(fetchPrecipMulti).mockReset();
});

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

describe("janelaMaxima", () => {
  it("pega o maior de cada eixo, independentemente", () => {
    const fichas = [fichaFake("a", 6, 3, -7.9), fichaFake("b", 2, 24, -8.1)];
    expect(janelaMaxima(fichas)).toEqual({ passadoHoras: 6, previsaoHoras: 24 });
  });
});

describe("resolverEstados", () => {
  it("uma chamada só, com todas as coordenadas na ordem das fichas", async () => {
    const fichas = [fichaFake("a", 6, 3, -7.9), fichaFake("b", 6, 3, -8.1)];
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serie(0), serie(0)]);

    await resolverEstados(fichas);

    expect(fetchPrecipMulti).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchPrecipMulti).mock.calls[0][0]).toEqual([
      { lat: -7.9, lng: -36 },
      { lat: -8.1, lng: -36 },
    ]);
  });

  it("cada trilha recebe o veredito da SUA série, não da do vizinho", async () => {
    const fichas = [fichaFake("seca", 6, 3, -7.9), fichaFake("molhada", 6, 3, -8.1)];
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serie(0), serie(5)]);

    const r = await resolverEstados(fichas);

    expect(r.get("seca")).toEqual({ estado: "fresco", erro: false, calculadoEm: AGORA_S });
    expect(r.get("molhada")!.estado).toBe("frio");
  });

  it("clima fora do ar: TODAS ficam sem leitura, nenhuma afirma nada", async () => {
    const fichas = [fichaFake("a", 6, 3, -7.9), fichaFake("b", 6, 3, -8.1)];
    vi.mocked(fetchPrecipMulti).mockRejectedValue(new Error("503"));

    const r = await resolverEstados(fichas);

    expect([...r.values()].every((l) => l.erro)).toBe(true);
    expect([...r.values()].every((l) => l.estado === "frio")).toBe(true);
    expect(r.size).toBe(2);
  });

  it("sem ficha nenhuma não toca a rede", async () => {
    expect((await resolverEstados([])).size).toBe(0);
    expect(fetchPrecipMulti).not.toHaveBeenCalled();
  });

  it("home e ficha concordam sobre o mesmo morro na mesma hora", async () => {
    const f = ficha();
    vi.mocked(fetchPrecip).mockResolvedValue({
      precips: serie(5), raw: { hourly: { time: [], precipitation: [] } },
    });
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serie(5)]);

    const daFicha = await resolverEstado(f);
    const daHome = (await resolverEstados([f])).get(f.slug)!;

    expect(daHome.estado).toBe(daFicha.estado);
  });
});
