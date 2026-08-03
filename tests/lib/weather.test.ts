import { describe, expect, it } from "vitest";
import { buildUrl, parsePrecip, type OpenMeteoResponse } from "@/lib/weather";
import type { Regra } from "@/types/ficha";
import sample from "../../fixtures/open-meteo-sample.json";

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
