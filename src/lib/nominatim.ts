/** O Nominatim (OpenStreetMap), a parte PURA: URLs, chaves de guarda e a leitura
 *  da resposta. Sem fetch e sem banco — quem pede e quem guarda moram em
 *  `./nominatim-servico` e `./db-nominatim`, SÓ servidor.
 *
 *  Política de uso lida em 17/10: no máximo 1 consulta por segundo no TOTAL,
 *  `User-Agent` fixo do app, resposta guardada, nunca busca-enquanto-digita,
 *  nada de consulta sistemática. A ÚNICA coisa que vem daqui e é gravada é a
 *  cidade do ponto que a pessoa marcou (spec §7). */
import { ESTADO_DO_APP } from "@/lib/lugares";

export const USER_AGENT_DO_APP = "BatePerna/1.0 (+https://github.com/JoaoAgostinhoVision/BatePerna)";
/** O molde de `PRAZO_BUSCA_MS`: a pessoa está olhando a tela. */
export const PRAZO_NOMINATIM_MS = 3_000;
export const INTERVALO_NOMINATIM_MS = 1_000;
/** 30 dias, em SEGUNDOS (a coluna `em` é em segundos, como o resto do banco). */
export const VALIDADE_DA_RESPOSTA_S = 30 * 24 * 3600;
export const QUANTOS_NA_BUSCA = 10;
/** Caracteres. Acima disso a rota recusa sem pedir nada. */
export const TETO_DA_BUSCA = 120;

export type AchadoNoMapa = { nome: string; lat: number; lng: number };

const BASE = "https://nominatim.openstreetmap.org";

/** 4 casas ≈ 11 m: a chave do guardado e a consulta são o MESMO ponto. */
export function pontoArredondado(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

export function urlBuscaNoMapa(q: string): string {
  const params = new URLSearchParams({
    q: q.trim(),
    countrycodes: "br",
    format: "jsonv2",
    limit: String(QUANTOS_NA_BUSCA),
    addressdetails: "1",
  });
  return `${BASE}/search?${params.toString()}`;
}

export function urlCidadeDoPonto(lat: number, lng: number): string {
  const p = pontoArredondado(lat, lng);
  const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lng), format: "jsonv2", zoom: "10" });
  return `${BASE}/reverse?${params.toString()}`;
}

/** Caixa e espaço repetido não contam; ACENTO conta (outra palavra). */
export function chaveDaBusca(q: string): string {
  return "busca:" + q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function chaveDoPonto(lat: number, lng: number): string {
  const p = pontoArredondado(lat, lng);
  return `ponto:${p.lat},${p.lng}`;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** `municipality` primeiro: onde o Nominatim o devolve, é ele o município e as
 *  outras chaves podem ser o povoado (spec §2.2: "o que conta é o município").
 *  `{"error": …}`, sem `address` ou nenhuma das quatro → `null`. */
export function municipioDaResposta(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = (raw as { address?: unknown }).address;
  if (typeof a !== "object" || a === null) return null;
  const end = a as Record<string, unknown>;
  for (const chave of ["municipality", "city", "town", "village"]) {
    const t = texto(end[chave]);
    if (t) return t;
  }
  return null;
}

/** Os de Pernambuco primeiro (ordem estável), sem tirar nenhum. O nome é o
 *  `display_name` — só pra escolher, nunca gravado. */
export function achadosDaResposta(raw: unknown): AchadoNoMapa[] {
  if (!Array.isArray(raw)) return [];
  const daqui: AchadoNoMapa[] = [];
  const dosOutros: AchadoNoMapa[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as { display_name?: unknown; lat?: unknown; lon?: unknown; address?: { state?: unknown } | null };
    const nome = texto(it.display_name);
    const lat = typeof it.lat === "string" || typeof it.lat === "number" ? Number(it.lat) : NaN;
    const lng = typeof it.lon === "string" || typeof it.lon === "number" ? Number(it.lon) : NaN;
    if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    (it.address?.state === ESTADO_DO_APP ? daqui : dosOutros).push({ nome, lat, lng });
  }
  return [...daqui, ...dosOutros];
}
