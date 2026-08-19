/** O piso da via até a trilha — o PIOR trecho do caminho, não o trecho final
 *  nem a média. Na Rampa, a estrada até o pé da serra é asfalto e a subida é
 *  barro: a resposta certa pra `piso` é `barro`.
 *
 *  Puro de propósito, sem zod e sem `node:fs`: client components leem este
 *  módulo direto (é a mesma razão que já exilou `formatarDuracao` pra
 *  `duracao.ts` e `coordDaDistancia` pra dentro de `geo.ts` — um client
 *  component que importasse algo carregando `node:fs` no meio do caminho
 *  arrastaria esses módulos pro bundle do navegador, e o webpack do Next
 *  recusa). `src/types/ficha.ts` monta o `z.enum` A PARTIR de `PISOS` — nunca
 *  o contrário — pra este arquivo continuar sem zod. */

/** A ORDEM do array É A ESCALA, do pior pro melhor. É a única coisa que dá
 *  sentido a `ordemPiso`: não reordene sem entender que está reordenando a
 *  escala inteira, e não insira um piso novo no meio sem decidir onde ele
 *  entra nessa ordem. */
export const PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"] as const;

export type Piso = (typeof PISOS)[number];

/** DERIVADO de `PISOS` — nunca uma segunda lista escrita à mão (ver o
 *  comentário em `PISOS`). `barro` é o piso da escala; com o filtro lido
 *  como "no mínimo daqui pra cima", incluir `barro` nas opções filtráveis
 *  não esconderia nenhuma ficha — um filtro aceso que não filtra é o defeito
 *  que esta task existe pra evitar. */
export const PISOS_FILTRAVEIS = PISOS.slice(1);

export function ordemPiso(p: Piso): number {
  return PISOS.indexOf(p);
}

/** "asfalto-esburacado" → "asfalto esburacado". Só o hífen vira espaço; o
 *  resto do texto que aparece na tela decide o resto (maiúscula, ícone etc). */
export function rotuloPiso(p: Piso): string {
  return p.replace(/-/g, " ");
}
