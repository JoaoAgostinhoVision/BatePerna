import type { Ficha } from "@/types/ficha";
import { avaliar, type Estado } from "@/lib/motor";
import { fetchPrecip, fetchPrecipMulti, type JanelaMax } from "@/lib/weather";

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

/** A janela que cobre TODAS as regras: o maior passado e a maior previsão,
 *  cada eixo escolhido por si — uma trilha pode pedir passado longo e previsão
 *  curta, outra o oposto, e a requisição única precisa satisfazer as duas. */
export function janelaMaxima(fichas: Ficha[]): JanelaMax {
  return {
    passadoHoras: Math.max(...fichas.map((f) => f.condicao.regra.janela_passado_horas)),
    previsaoHoras: Math.max(...fichas.map((f) => f.condicao.regra.janela_previsao_horas)),
  };
}

/** O carimbo de várias trilhas, numa chamada de rede só.
 *
 *  O julgamento continua sendo o `avaliar` de sempre, uma vez por trilha, com a
 *  regra dela: o que ganhou versão plural foi o transporte da chuva, nunca a
 *  decisão. Home, ficha e /api/carimbo não podem divergir sobre o mesmo morro.
 *
 *  Falhou a busca — rede, prazo, ou lista de tamanho errado — e NINGUÉM recebe
 *  carimbo. Meia home preenchida parece defeito e a pessoa não sabe quais
 *  confiar; todas sem leitura é uma frase honesta que ela entende. */
export async function resolverEstados(fichas: Ficha[]): Promise<Map<string, LeituraCarimbo>> {
  const agora = Math.floor(Date.now() / 1000);
  if (fichas.length === 0) return new Map();
  try {
    const series = await fetchPrecipMulti(
      fichas.map((f) => f.condicao.coords),
      janelaMaxima(fichas),
    );
    return new Map(
      fichas.map((f, i) => [
        f.slug,
        { estado: avaliar(f.condicao.regra, series[i], agora), erro: false, calculadoEm: agora },
      ]),
    );
  } catch {
    return new Map(
      fichas.map((f) => [f.slug, { estado: "frio" as const, erro: true, calculadoEm: agora }]),
    );
  }
}
