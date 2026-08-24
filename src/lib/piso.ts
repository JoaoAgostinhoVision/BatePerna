/** O piso da VIA — o trecho que se DIRIGE, da estrada principal até onde o
 *  carro para. O que se caminha depois de estacionar não é deste campo.
 *
 *  🔴 Até a contração de 2026-08-23 (Task 7) esse "o que se caminha" tinha
 *  nome — `extensaoKm`, formatado em `geo.ts`. O campo saiu do modelo; o
 *  corte que esta oração descreve (via dirigida × trecho a pé) continua sendo
 *  o certo, só não há mais o par pra apontar. O questionário faz o mesmo
 *  corte, com as mesmas palavras, e os dois têm que continuar batendo: este
 *  campo responde "que carro serve", e é isso que o filtro da tela pergunta.
 *
 *  Dentro dessa via, vale o PIOR trecho — mesmo curto, mesmo sendo o último —
 *  e não a média nem o piso que predomina.
 *
 *  🔴 A resposta do questionário pra Rampa do Pepê é `barro` — dado do dono do
 *  app: `voz` = "é barro: molhou, não vá", `regra_texto` = "não suba de carro
 *  comum; o barro segura água". Desde a Task 8 (2026-08-23) o JSON TRAZ o
 *  campo `piso: "barro"`. COMO É O RESTO DA ESTRADA ATÉ LÁ NINGUÉM DISSE. Uma
 *  versão anterior deste comentário afirmava "a estrada até o pé da serra é
 *  asfalto e a subida é barro" — invenção, que a ficha real não sustenta em
 *  nenhum campo, e que daqui se propagou pro questionário que ele lê. Não
 *  reponha: a escala não precisa desse fato, e este projeto não afirma fato de
 *  lugar que o dono não deu.
 *
 *  Puro de propósito, sem zod e sem `node:fs`: client components leem este
 *  módulo direto (é a mesma razão que já exilou `formatarDuracao` pra
 *  `duracao.ts` (apagado na contração) e `coordDaDistancia` pra dentro de
 *  `geo.ts` — um client component que importasse algo carregando `node:fs` no
 *  meio do caminho arrastaria esses módulos pro bundle do navegador, e o
 *  webpack do Next recusa). `src/types/ficha.ts` monta o `z.enum` A PARTIR de `PISOS` — nunca
 *  o contrário — pra este arquivo continuar sem zod. */

/** A ORDEM do array É A ESCALA, do pior pro melhor. É a única coisa que dá
 *  sentido a `ordemPiso`: não reordene sem entender que está reordenando a
 *  escala inteira, e não insira um piso novo no meio sem decidir onde ele
 *  entra nessa ordem. */
export const PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"] as const;

export type Piso = (typeof PISOS)[number];

/** DERIVADO de `PISOS` — nunca uma segunda lista escrita à mão (ver o
 *  comentário em `PISOS`). `barro` é o PIOR piso da escala; com o filtro lido
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
