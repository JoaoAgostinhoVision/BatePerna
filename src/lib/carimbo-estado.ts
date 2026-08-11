import type { Ficha } from "@/types/ficha";
import { avaliar, type Estado } from "@/lib/motor";
import { fetchPrecip } from "@/lib/weather";

/** O trio que descreve um carimbo. A página entrega isto ao componente; a rota
 *  /api/carimbo devolve isto no corpo. Mesmo formato de propósito: são a mesma
 *  informação chegando por dois caminhos. */
export type LeituraCarimbo = { estado: Estado; erro: boolean; calculadoEm: number };

/** Lê a chuva de agora e decide. Mora aqui, e não dentro da página, porque a
 *  rota precisa da MESMA função: duas fontes pro mesmo carimbo seriam a semente
 *  de duas respostas diferentes pro mesmo morro. */
export async function resolverEstado(ficha: Ficha, debug?: string): Promise<LeituraCarimbo> {
  const agora = Math.floor(Date.now() / 1000);
  if (debug === "fresco" || debug === "frio") return { estado: debug, erro: false, calculadoEm: agora };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    return { estado: avaliar(regra, precips, agora), erro: false, calculadoEm: agora };
  } catch {
    // Sem leitura de chuva → lado seguro, e diz a verdade (não finge verde).
    return { estado: "frio", erro: true, calculadoEm: agora };
  }
}
