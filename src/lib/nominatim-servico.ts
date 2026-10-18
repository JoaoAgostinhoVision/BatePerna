/** O Nominatim atrás de uma porta só — SÓ servidor. Guardado primeiro; senão a
 *  vez do 1/s (que RECUSA, não espera: dormir numa função da Vercel custa e não
 *  prova nada); senão pede, guarda e lê. Qualquer exceção de banco ou de rede
 *  vira `fora`, nunca estoura. */
import type { Client } from "@libsql/client";
import { getClient } from "@/lib/db";
import { guardarResposta, respostaGuardada, tomarVezDoNominatim } from "@/lib/db-nominatim";
import {
  PRAZO_NOMINATIM_MS,
  USER_AGENT_DO_APP,
  achadosDaResposta,
  chaveDaBusca,
  chaveDoPonto,
  municipioDaResposta,
  urlBuscaNoMapa,
  urlCidadeDoPonto,
  type AchadoNoMapa,
} from "@/lib/nominatim";

export type FontesDoNominatim = {
  pedir: (url: string) => Promise<unknown>;
  client: () => Client;
  agoraMs: () => number;
};

export const FONTES_NOMINATIM: FontesDoNominatim = {
  pedir: async (url) => {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT_DO_APP, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(PRAZO_NOMINATIM_MS),
    });
    if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);
    return res.json();
  },
  client: getClient,
  agoraMs: () => Date.now(),
};

export type FalhaDoNominatim = "fora" | "limite";

/** A resposta CRUA da chave: do guardado, ou pedida (gastando a vez) e guardada.
 *  Falha de rede/HTTP nunca é guardada; resposta válida sem município, é. */
async function respostaDe(
  chave: string,
  url: string,
  f: FontesDoNominatim,
): Promise<{ raw: unknown } | { falha: FalhaDoNominatim }> {
  try {
    const client = f.client();
    const agoraMs = f.agoraMs();
    const agoraS = Math.floor(agoraMs / 1000);
    const guardada = await respostaGuardada(client, chave, agoraS);
    if (guardada !== null) return { raw: JSON.parse(guardada) };
    if (!(await tomarVezDoNominatim(client, agoraMs))) return { falha: "limite" };
    const raw = await f.pedir(url);
    await guardarResposta(client, chave, JSON.stringify(raw), agoraS);
    return { raw };
  } catch {
    return { falha: "fora" };
  }
}

export async function cidadeDoPonto(
  lat: number,
  lng: number,
  f: FontesDoNominatim = FONTES_NOMINATIM,
): Promise<{ cidade: string } | { falha: FalhaDoNominatim | "sem-municipio" }> {
  const r = await respostaDe(chaveDoPonto(lat, lng), urlCidadeDoPonto(lat, lng), f);
  if ("falha" in r) return r;
  const cidade = municipioDaResposta(r.raw);
  return cidade ? { cidade } : { falha: "sem-municipio" };
}

export async function buscarNoMapa(
  q: string,
  f: FontesDoNominatim = FONTES_NOMINATIM,
): Promise<{ achados: AchadoNoMapa[] } | { falha: FalhaDoNominatim }> {
  if (q.trim() === "") return { achados: [] };
  const r = await respostaDe(chaveDaBusca(q), urlBuscaNoMapa(q), f);
  if ("falha" in r) return r;
  return { achados: achadosDaResposta(r.raw) };
}
