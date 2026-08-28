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

/** A ORDEM do array é do pior pro melhor, e ela continua valendo como leitura
 *  humana da lista — o questionário oferece as quatro palavras nesta ordem.
 *
 *  🔴 ATÉ 2026-08-27 ELA ERA UMA ESCALA COMPARÁVEL: existiam `ordemPiso` e
 *  `PISOS_FILTRAVEIS`, e o filtro da home recortava "no mínimo daqui pra cima".
 *  Os dois saíram junto com aquele recorte — ele respondia a pergunta errada
 *  ("meu carro chega?") por um proxy que errava. Hoje o piso é FATO EXIBIDO
 *  (cartão e ficha) e vocabulário do questionário, e nada compara dois pisos.
 *  Se um dia voltar a comparar, a ordem está aqui pronta. */
export const PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"] as const;

export type Piso = (typeof PISOS)[number];

/** "asfalto-esburacado" → "asfalto esburacado". Só o hífen vira espaço; o
 *  resto do texto que aparece na tela decide o resto (maiúscula, ícone etc). */
export function rotuloPiso(p: Piso): string {
  return p.replace(/-/g, " ");
}

/** O que a CHUVA faz com cada piso — a segunda oração do ramo "choveu" do
 *  carimbo. Irmã do `secaRapido` da ficha, e o oposto dela por natureza:
 *  aquela fala de RELEVO (fato de UM lugar, e por isso mora na ficha, escrita
 *  por quem conhece o lugar), esta fala de MATERIAL (a mesma física em
 *  qualquer lugar, e por isso mora aqui, escrita uma vez).
 *
 *  🔴 POR QUE ELA EXISTE (2026-08-27). A frase vivia FIXA no `Carimbo.tsx`:
 *  "O barro segura água — risco de atolar", verdadeira enquanto todo o acervo
 *  era de barro. É a mesma mentira agendada que o `secaRapido` desarmou um dia
 *  antes — texto escrito quando o acervo era pequeno, num componente que serve
 *  o acervo INTEIRO. A 3ª ficha com asfalto a tornaria falsa sozinha.
 *
 *  🔴 SÓ `barro` TEM FRASE, E ISSO É DE PROPÓSITO. A frase é palavra do dono do
 *  app (`regra_texto` da Rampa: "o barro segura água"). Escrever aqui o que a
 *  chuva faz com paralelepípedo ou asfalto seria eu inventando copy que ninguém
 *  disse — a geografia inventada de volta, vestida de física. Os outros três
 *  CALAM até ele escrever a frase deles: é uma linha nesta tabela.
 *
 *  Ficha SEM `piso` cala pela mesma régua: silêncio é a saída honesta, e frase
 *  genérica de reserva seria o defeito de volta com outra roupa. */
const CHUVA_NO_PISO: Partial<Record<Piso, string>> = {
  barro: "O barro segura água — risco de atolar.",
};

/** A meia-frase de chuva do piso, ou `undefined` quando não há o que dizer com
 *  honestidade — piso sem frase, ou ficha sem piso.
 *
 *  ⚠️ O `piso ?` é do VERIFICADOR DE TIPOS, não do runtime: indexar a tabela com
 *  `undefined` já devolveria `undefined`. Nenhum teste separa as duas versões,
 *  e nenhum deveria fingir que separa. */
export function chuvaNoPiso(piso?: Piso): string | undefined {
  return piso ? CHUVA_NO_PISO[piso] : undefined;
}
