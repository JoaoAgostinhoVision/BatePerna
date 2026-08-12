import type { Coord } from "@/lib/geo";
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

/** A maior janela entre todas as regras, cada eixo calculado por si. Uma
 *  requisição só serve todas as trilhas porque `avaliar` recorta a janela dele
 *  mesmo das horas que recebe — quem pede a mais não atrapalha quem quer menos. */
export type JanelaMax = { passadoHoras: number; previsaoHoras: number };

/** Quanto a página espera o clima antes de desistir.
 *
 *  Menor que o PRAZO_REDE_MS do service worker (6s) de propósito: aquele é o
 *  último recurso antes de servir uma cópia guardada; este roda DENTRO do tempo
 *  de resposta da home, com a pessoa olhando pra tela em branco. */
export const PRAZO_CLIMA_MS = 4_000;

export function buildUrlMulti(coords: Coord[], janela: JanelaMax): string {
  const params = new URLSearchParams({
    latitude: coords.map((c) => String(c.lat)).join(","),
    longitude: coords.map((c) => String(c.lng)).join(","),
    hourly: "precipitation",
    past_days: String(Math.max(1, Math.ceil(janela.passadoHoras / H_PER_DAY))),
    forecast_days: String(Math.max(1, Math.ceil(janela.previsaoHoras / H_PER_DAY))),
    timezone: "GMT",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function ehResposta(x: unknown): x is OpenMeteoResponse {
  const h = (x as OpenMeteoResponse | null)?.hourly;
  return !!h && Array.isArray(h.time) && Array.isArray(h.precipitation);
}

/** A resposta multi-coordenada vira uma série por trilha, NA ORDEM PEDIDA.
 *
 *  A ordem é a única coisa que liga o resultado 3 à trilha 3 — a resposta não
 *  repete o slug nem nada que a gente reconheça. Um item a menos e a chuva de
 *  uma trilha viraria o veredito de outra: nome de um morro, decisão de outro.
 *  É a mesma família do "ficha A respondendo com o corpo da ficha B".
 *
 *  Por isso não existe casamento parcial: tamanho diferente do pedido é erro, e
 *  quem chama transforma isso em "ninguém tem leitura". */
export function parsePrecipLista(raw: unknown, esperado: number): Precip[][] {
  const lista = Array.isArray(raw) ? raw : [raw];
  if (lista.length !== esperado) {
    throw new Error(`Open-Meteo devolveu ${lista.length} séries para ${esperado} coordenadas`);
  }
  return lista.map((r, i) => {
    if (!ehResposta(r)) throw new Error(`Open-Meteo: série ${i} sem hourly`);
    return parsePrecip(r);
  });
}

/** Busca com prazo. Separado de fetchPrecipMulti (que crava o host do
 *  Open-Meteo) pra o prazo ser testável contra um servidor local que aceita e
 *  nunca responde. */
export async function buscarJson(url: string, prazoMs: number): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(prazoMs) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

export async function fetchPrecipMulti(coords: Coord[], janela: JanelaMax): Promise<Precip[][]> {
  const raw = await buscarJson(buildUrlMulti(coords, janela), PRAZO_CLIMA_MS);
  return parsePrecipLista(raw, coords.length);
}
