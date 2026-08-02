import type { Regra } from "@/types/ficha";
import type { Precip } from "@/lib/motor";

export type OpenMeteoResponse = {
  hourly: { time: string[]; precipitation: number[] };
};

const H_PER_DAY = 24;

export function buildUrl(
  coords: { lat: number; lng: number },
  regra: Regra,
): string {
  const pastDays = Math.max(1, Math.ceil(regra.janela_passado_horas / H_PER_DAY));
  const forecastDays = Math.max(1, Math.ceil(regra.janela_previsao_horas / H_PER_DAY));
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lng),
    hourly: "precipitation",
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: "GMT",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function parsePrecip(resp: OpenMeteoResponse): Precip[] {
  const { time, precipitation } = resp.hourly;
  return time.map((t, i) => ({
    time: Date.parse(`${t}Z`) / 1000, // GMT naive ISO -> epoch seconds
    mm: precipitation[i] ?? 0,
  }));
}

export async function fetchPrecip(
  coords: { lat: number; lng: number },
  regra: Regra,
): Promise<{ precips: Precip[]; raw: OpenMeteoResponse }> {
  const res = await fetch(buildUrl(coords, regra), { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const raw = (await res.json()) as OpenMeteoResponse;
  return { precips: parsePrecip(raw), raw };
}
