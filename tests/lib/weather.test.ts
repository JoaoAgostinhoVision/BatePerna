import { createServer, type Server } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRAZO_CLIMA_MS,
  buildUrl,
  buildUrlMulti,
  buscarJson,
  fetchPrecipMulti,
  parsePrecip,
  parsePrecipLista,
  type JanelaMax,
  type OpenMeteoResponse,
} from "@/lib/weather";
import type { Regra } from "@/types/ficha";
import sample from "../../fixtures/open-meteo-sample.json";
import multi from "../../fixtures/open-meteo-multi.json";

const regra: Regra = {
  tipo: "chuva_binaria",
  janela_previsao_horas: 48,
  janela_passado_horas: 48,
  limiar_mm: 0.2,
};

describe("weather", () => {
  it("builds an Open-Meteo URL with coords, precipitation, past+forecast days, GMT", () => {
    const url = buildUrl({ lat: -7.907889, lng: -36.019222 }, regra);
    expect(url).toContain("latitude=-7.907889");
    expect(url).toContain("longitude=-36.019222");
    expect(url).toContain("hourly=precipitation");
    expect(url).toContain("past_days=2");
    expect(url).toContain("forecast_days=2");
    expect(url).toContain("timezone=GMT");
  });

  it("parses hourly time/precipitation into epoch-seconds Precip[]", () => {
    const precips = parsePrecip(sample as OpenMeteoResponse);
    expect(precips).toHaveLength(4);
    // 2026-08-01T01:00Z
    expect(precips[1].time).toBe(Date.parse("2026-08-01T01:00Z") / 1000);
    expect(precips[1].mm).toBe(0.3);
  });
});

const JANELA: JanelaMax = { passadoHoras: 6, previsaoHoras: 30 };
const COORDS = [
  { lat: -7.907889, lng: -36.019222 },
  { lat: -8.05, lng: -34.9 },
];

describe("buildUrlMulti", () => {
  it("junta as coordenadas por vírgula, na ordem recebida", () => {
    const p = new URL(buildUrlMulti(COORDS, JANELA)).searchParams;
    expect(p.get("latitude")).toBe("-7.907889,-8.05");
    expect(p.get("longitude")).toBe("-36.019222,-34.9");
  });

  it("as janelas viram dias arredondados pra cima, cada eixo por si", () => {
    const p = new URL(buildUrlMulti(COORDS, JANELA)).searchParams;
    expect(p.get("past_days")).toBe("1");
    expect(p.get("forecast_days")).toBe("2");
    expect(p.get("timezone")).toBe("GMT");
  });
});

describe("parsePrecipLista", () => {
  it("uma série por coordenada, na ordem pedida", () => {
    const series = parsePrecipLista(multi, 2);
    expect(series).toHaveLength(2);
    expect(series[0].length).toBeGreaterThan(0);
  });

  it("resposta de coordenada única (objeto, não lista) também serve", () => {
    const uma = { hourly: { time: ["2026-08-01T00:00"], precipitation: [0.4] } };
    expect(parsePrecipLista(uma, 1)[0][0].mm).toBe(0.4);
  });

  // ESTE é o teste que impede o pior defeito da rodada: veredito de uma trilha
  // aparecendo no cartão de outra.
  it("lista mais curta que o pedido é erro — ninguém recebe carimbo pela metade", () => {
    expect(() => parsePrecipLista(multi, 3)).toThrow(/3/);
  });

  it("lista mais longa que o pedido também é erro", () => {
    expect(() => parsePrecipLista(multi, 1)).toThrow();
  });

  it("entrada sem hourly é erro, não série vazia", () => {
    expect(() => parsePrecipLista([{ latitude: -7.9 }], 1)).toThrow();
  });

  it("resposta vazia é erro", () => {
    expect(() => parsePrecipLista([], 2)).toThrow();
  });
});

describe("buscarJson", () => {
  let servidor: Server;
  let porta: number;

  beforeEach(async () => {
    // Aceita a conexão e NUNCA responde. Modo avião falha na hora e passaria
    // mesmo com o prazo quebrado — o que mata na serra é o pendurado.
    servidor = createServer(() => {});
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    porta = (servidor.address() as { port: number }).port;
  });

  afterEach(() => { servidor.close(); });

  it("desiste quando o outro lado aceita e não responde", async () => {
    const t0 = Date.now();
    await expect(buscarJson(`http://127.0.0.1:${porta}/`, 150)).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("o prazo do clima é menor que o do service worker", async () => {
    const { PRAZO_REDE_MS } = await import("@/lib/cache-rotas");
    expect(PRAZO_CLIMA_MS).toBeLessThan(PRAZO_REDE_MS);
  });
});

describe("fetchPrecipMulti", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("devolve uma série por coordenada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(multi))));
    expect(await fetchPrecipMulti(COORDS, JANELA)).toHaveLength(2);
  });

  it("HTTP ruim vira erro, não série vazia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    await expect(fetchPrecipMulti(COORDS, JANELA)).rejects.toThrow(/503/);
  });
});
