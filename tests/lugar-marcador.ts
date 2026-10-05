import { fichaSchema, type Ficha } from "@/types/ficha";
import { tresPontos } from "./ficha-de-tres-pontos";

/** UM LUGAR MARCADOR COM CIDADE — fixture da troca de endereço (Tarefa 11e).
 *
 *  🔴 NENHUMA CIDADE REAL, NENHUM LUGAR REAL. As três fichas do acervo não têm
 *  cidade (e mantêm os endereços de hoje, decisão do João de 04/10); dar uma a
 *  elas, mesmo num banco de teste, seria escrever no repositório que a Rampa
 *  fica numa cidade. Tudo aqui é marcador, a partir da ficha de três pontos
 *  (que já é marcadora), com UM ponto só: o destino.
 *
 *  Passa pelo `fichaSchema` aqui mesmo: fixture que não é ficha mede o vazio. */
export function lugarMarcador(slug: string, nome: string, cidade?: string): Ficha {
  const base = tresPontos();
  const wp0 = { ...base.trajeto.waypoints[0], nome };
  return fichaSchema.parse({
    ...base,
    slug,
    ...(cidade === undefined ? {} : { cidade }),
    // Voz própria por slug: duas fichas com a mesma voz no mesmo banco é o que a
    // coerência acusa, e o teste mediria a acusação em vez da troca.
    voz: `Uma voz marcadora do lugar ${slug}.`,
    trajeto: { waypoints: [wp0] },
  });
}
