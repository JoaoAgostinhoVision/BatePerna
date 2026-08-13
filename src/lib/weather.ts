import type { Coord } from "@/lib/geo";
import type { Regra } from "@/types/ficha";
import type { Precip } from "@/lib/motor";

export type OpenMeteoResponse = {
  // A Open-Meteo devolve isto em todo pedido, único ou em lote — é o que deixa
  // conferir de que coordenada a série realmente veio (ver coordBate).
  latitude?: number;
  longitude?: number;
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
  // Hora sem medida não pode virar hora seca por acidente de índice: 0mm é o
  // lado que diz "pode subir". `?? 0` escondia exatamente isso — se
  // `precipitation` vinha mais curto que `time`, toda hora faltante entrava
  // como seca em silêncio. Sem a garantia de tamanho, indexar é apostar; por
  // isso confere aqui, na função que TODO caminho passa (ficha única via
  // fetchPrecip, e cada série da home via parsePrecipLista) — não só no portão
  // de entrada da lista, que a ficha única nem atravessa.
  if (precipitation.length !== time.length) {
    throw new Error(
      `Open-Meteo: ${time.length} horas mas ${precipitation.length} medidas de chuva`,
    );
  }
  return time.map((t, i) => ({
    time: Date.parse(`${t}Z`) / 1000, // GMT naive ISO -> epoch seconds
    mm: precipitation[i],
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
  return (
    !!h &&
    Array.isArray(h.time) &&
    Array.isArray(h.precipitation) &&
    // Portão de entrada da lista: barra o array truncado antes mesmo de
    // tentar montar uma série (parsePrecip confere de novo, por conferir os
    // dois caminhos — ver o comentário lá).
    h.time.length === h.precipitation.length
  );
}

/** Tolerância entre a coordenada pedida e a que a Open-Meteo devolve.
 *
 *  A API arredonda pra grade do modelo, não devolve o lat/lng exato do pedido.
 *  No fixture real (fixtures/open-meteo-multi.json) isso já desvia até 0,023°:
 *  pedido -34.9 → devolvido -34.923065; pedido -7.907889 → devolvido
 *  -7.9086113. 0,1° dá ~4x de margem sobre esse desvio observado — nunca
 *  reprova uma leitura boa — e ainda é pequeno o bastante (~11km na linha do
 *  equador) pra pegar coordenada de um lugar de verdade diferente. Duas
 *  trilhas tão perto que caem dentro dessa margem uma da outra caem na MESMA
 *  célula da grade da Open-Meteo — a série delas seria idêntica de qualquer
 *  jeito, então confundi-las aqui é inofensivo. */
const TOLERANCIA_GRAU = 0.1;

function coordBate(pedida: Coord, recebida: unknown): boolean {
  const r = recebida as { latitude?: unknown; longitude?: unknown } | null;
  return (
    typeof r?.latitude === "number" &&
    typeof r?.longitude === "number" &&
    Math.abs(r.latitude - pedida.lat) <= TOLERANCIA_GRAU &&
    Math.abs(r.longitude - pedida.lng) <= TOLERANCIA_GRAU
  );
}

/** A resposta multi-coordenada vira uma série por trilha, NA ORDEM PEDIDA.
 *
 *  A ordem por si só não prova nada — a resposta não repete o slug nem nada
 *  que a gente reconheça. Um item a menos, ou fora de ordem, e a chuva de uma
 *  trilha viraria o veredito de outra: nome de um morro, decisão de outro. É a
 *  mesma família do "ficha A respondendo com o corpo da ficha B". Por isso
 *  cada série tem a coordenada que veio junto (`latitude`/`longitude`)
 *  conferida contra a que foi pedida NAQUELA posição — a prova, não a
 *  confiança.
 *
 *  Por isso não existe casamento parcial: tamanho diferente do pedido, ou
 *  coordenada que não bate, é erro, e quem chama transforma isso em "ninguém
 *  tem leitura". */
export function parsePrecipLista(raw: unknown, coordsEsperadas: Coord[]): Precip[][] {
  const lista = Array.isArray(raw) ? raw : [raw];
  if (lista.length !== coordsEsperadas.length) {
    throw new Error(
      `Open-Meteo devolveu ${lista.length} séries para ${coordsEsperadas.length} coordenadas`,
    );
  }
  return lista.map((r, i) => {
    if (!ehResposta(r)) throw new Error(`Open-Meteo: série ${i} sem hourly`);
    const pedida = coordsEsperadas[i];
    if (!coordBate(pedida, r)) {
      throw new Error(
        `Open-Meteo: série ${i} veio de outra coordenada (pedido ${pedida.lat},${pedida.lng})`,
      );
    }
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
  return parsePrecipLista(raw, coords);
}
