/** "Quanto tempo leva" — a régua que o cartão mostra de relance no portão.
 *
 *  Puro de propósito, e num arquivo PRÓPRIO por um motivo concreto, não por
 *  capricho: `src/lib/ficha.ts` reexporta esta função (fica "junto do resto
 *  que descreve uma ficha", como pedido), mas `ficha.ts` carrega
 *  `node:fs`/`node:path` no topo — é o loader de content/fichas. Um client
 *  component que importasse `formatarDuracao` de lá arrastaria esses
 *  módulos pro bundle do navegador, e o webpack do Next recusa: "node:fs"
 *  não tem como entrar no bundle do cliente (confirmado com `next build`
 *  falhando de verdade nesta rodada, não é teoria). Por isso o CartaoTrilha
 *  (client) importa DAQUI, não de `@/lib/ficha`. */
export function formatarDuracao(min: number): string {
  if (min < 60) return `~${min}min`;
  const horas = Math.floor(min / 60);
  const minutos = min % 60;
  if (minutos === 0) return `~${horas}h`;
  return `~${horas}h${String(minutos).padStart(2, "0")}`;
}
