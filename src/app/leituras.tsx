"use client";
import { createContext, useContext } from "react";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

/** As leituras que estão na tela agora, por slug.
 *
 *  Existe pela mesma razão que a Moldura da ficha existe: quando a home busca
 *  leituras novas, a PALAVRA e a COR de uma trilha têm que mudar no mesmo lote.
 *  Selo e pin são elementos distantes um do outro no DOM — se cada um guardasse
 *  o próprio estado, o portão mostraria "Não suba" ao lado de um pin verde.
 *  Uma trilha, uma fonte.
 *
 *  Vazio por padrão: fora de um provedor (a home server-rendered antes de
 *  hidratar, e os testes de unidade) quem consome cai na leitura que veio por
 *  prop — que é exatamente a do servidor. */
const Leituras = createContext<Map<string, LeituraCarimbo> | null>(null);

export function useLeitura(slug: string): LeituraCarimbo | undefined {
  return useContext(Leituras)?.get(slug);
}

/** O mapa inteiro, não uma trilha. Existe pra quem precisa de uma pergunta
 *  AGREGADA sobre várias trilhas de uma vez — hoje são DOIS consumidores, o
 *  `MioloHome` (recorta e decide se a folha agrupa) e a `FolhaTrilhas`
 *  (`atual`, pra particionar os grupos). Que sejam dois é o ponto: os dois
 *  leem o MESMO valor de contexto na mesma passada de render, e é essa
 *  propriedade que a `FolhaTrilhas` invoca pra afirmar que não há duas
 *  respostas possíveis. Um doc que nomeasse só um faria o próximo leitor achar
 *  que a folha parou de ler o contexto — sem cair na armadilha de chamar `useLeitura` dentro
 *  de um loop (número de hooks variável entre renders, se a lista de fichas
 *  um dia deixar de ser estática). `null` fora de um provedor, mesma regra do
 *  `useLeitura`. */
export function useLeiturasMapa(): Map<string, LeituraCarimbo> | null {
  return useContext(Leituras);
}

export const LeiturasProvider = Leituras.Provider;
