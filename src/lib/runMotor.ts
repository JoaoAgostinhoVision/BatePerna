import type { Client } from "@libsql/client";
import { getFichasComCondicao } from "@/lib/ficha";
import { fetchPrecip } from "@/lib/weather";
import { avaliar } from "@/lib/motor";
import { upsertFreshness } from "@/lib/db";

type Deps = {
  client: Client;
  agora: number; // epoch seconds
  fetchPrecipFn?: typeof fetchPrecip;
};

export async function runMotor(deps: Deps): Promise<{ atualizadas: number }> {
  const fetchPrecipFn = deps.fetchPrecipFn ?? fetchPrecip;
  const fichas = getFichasComCondicao();
  let atualizadas = 0;
  for (const ficha of fichas) {
    try {
      const { precips, raw } = await fetchPrecipFn(ficha.condicao.coords, ficha.condicao.regra);
      const estado = avaliar(ficha.condicao.regra, precips, deps.agora);
      await upsertFreshness(deps.client, {
        slug: ficha.slug,
        estado,
        calculadoEm: deps.agora,
        fonte: "open-meteo",
        previsaoBruta: JSON.stringify(raw),
      });
      atualizadas++;
    } catch (err) {
      // Fail gracefully: do NOT overwrite the good state on a provider error.
      console.error(`motor: falha em ${ficha.slug}:`, err);
    }
  }
  return { atualizadas };
}
