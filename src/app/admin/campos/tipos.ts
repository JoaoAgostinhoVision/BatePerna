import type { ReactElement } from "react";

/** O CONTRATO ENTRE O SERVIDOR E OS EDITORES — e ele é de **props**, nunca de
 *  import.
 *
 *  🔴 NENHUM EDITOR IMPORTA `@/lib/campos-da-ficha`, e isto não é estilo. A
 *  primeira linha daquele arquivo é `import { z } from "zod"` e ele também
 *  importa o `fichaSchema` inteiro; todo editor é `"use client"`. Um import
 *  dali põe o zod e o schema no bundle que o dono baixa **no celular**, numa
 *  rede de interior, pra trocar uma frase de texto. Quem conhece o registro é
 *  o componente de SERVIDOR (`FichaInteira`, que já o importa); o que desce
 *  pro cliente é este objeto raso — string, booleano e lista de string.
 *
 *  🔴 E O TIPO É DECLARADO AQUI, não importado de lá, pela mesma razão. A trava
 *  contra os dois desandarem não é memória: `FichaInteira` MONTA o
 *  `CampoNaTela` a partir do `CampoDaFicha` do registro, então uma entrada do
 *  registro que mude de forma (perca `obrigatorio`, troque `opcoes` de tipo)
 *  deixa **aquele** arquivo sem compilar. E o guarda de verdade é a MEDIÇÃO:
 *  `npm run build` imprime o First Load JS de `/admin/[slug]`, e um import
 *  acidental do registro aparece ali em kB. Comentário nenhum segura isto. */
export type CampoNaTela = {
  /** O caminho CONCRETO (`trajeto.waypoints.0.nome`), que é o que a porta de
   *  escrita espera em `{campo}`. Nunca o molde com `[]`. */
  caminho: string;
  /** O rótulo que o servidor já resolveu (`rotuloDe`). O editor usa como
   *  `aria-label` do instrumento — nunca imprime um segundo rótulo visível, que
   *  duplicaria o `.adm-campo-rotulo` que o bloco já mostra. */
  rotulo: string;
  /** Obrigatório não tem "não sei" (§4.2 do desenho). É UM dos dois estados que
   *  escondem o `BotaoNaoSei`; o outro é o campo JÁ AUSENTE, onde o botão não
   *  mudaria nada. Quem decide, nos dois casos, é o próprio `BotaoNaoSei`, num
   *  lugar só — e a porta recusa igual, com frase, se a tela errar. */
  obrigatorio: boolean;
  /** Só pra espécie `lista`: as palavras que o registro deixa escolher, por
   *  PROP — o editor não conhece módulo de vocabulário nenhum. Três delas vêm
   *  de `PISOS`/`DIAS`/`SEVERIDADES`; `custo.tag` tem a lista LITERAL no
   *  registro (dívida da Task 1, ver o docblock do `EditorLista`), e dizer
   *  "vêm de PISOS/DIAS/SEVERIDADES" sem essa ressalva era falso. */
  opcoes?: readonly string[];
  /** Só pra espécie `lista`: este campo guarda VÁRIAS opções (`dias`) ou uma
   *  (`piso`, `custo.tag`, `condicao.severidade`). Quem decide é
   *  `FichaInteira`, com guarda medido contra a porta de escrita. */
  multiplo?: boolean;
  /** Só pra espécie `coord` SEM ponto (o lugar novo, ou um documento torto na
   *  ficha no ar): de onde o mapa COMEÇA — centro e zoom da vista, calculados no
   *  SERVIDOR (`src/lib/vista-do-mapa.ts`) e entregues prontos. 🔴 NÃO É PONTO:
   *  o mapa nasce sem pin e sem Salvar, e nada grava a vista. Sem `vista` e sem
   *  ponto, o editor diz que não há mapa.
   *
   *  ⚠️ Até a Tarefa 11f havia aqui `folhas` — as duas metades da coordenada
   *  vazia, que entravam DIGITADAS em duas caixas de número (`CoordenadaDigitada`,
   *  apagada). Ele pediu o mapa: "latitude e longitude… que horror". */
  vista?: VistaNaTela;
  /** Só pra espécie `coord`, e só na METADE `.lat` de um ponto do trajeto: o
   *  ÍNDICE e o PAR daquele ponto, montados no servidor (Task 8). A metade
   *  sozinha é um número, e o mapa precisa dos dois pra pôr o pin; é a linha
   *  `.lat` que carrega o mapa do ponto e grava o ponto INTEIRO, num `PUT` só,
   *  pela forma `{slug, ponto: indice, lat, lng}` da porta (onda de conserto 1).
   *  A linha `.lng` NÃO recebe isto — dois mapas pro mesmo ponto seriam duas
   *  fontes pra mesma pergunta. `condicao.coords` também não: lá o `valor` já É
   *  o par. */
  ponto?: { indice: number; lat: number; lng: number };
};

/** Onde o mapa de pôr o pin começa quando não há ponto, e DE ONDE veio esse
 *  começo — a tela diz quando não achou a cidade. Declarado aqui, e não
 *  importado de `@/lib/vista-do-mapa`, pela regra do topo; aquele módulo devolve
 *  um objeto desta mesma forma, e a página que o passa adiante não compila se
 *  as duas desandarem. */
export type VistaNaTela = {
  centro: { lat: number; lng: number };
  z: number;
  origem: "ponto" | "cidade" | "acervo" | "cidade-ambigua";
};

/** 🔴 `valor` É `unknown` DE PROPÓSITO. Ele vem do documento que está no banco,
 *  e documento é dado: uma ficha antiga pode ter o campo com outra forma. Cada
 *  editor estreita com guarda de runtime e cai num estado VAZIO em vez de
 *  estourar na mão do dono — é o mesmo motivo que fez `lerValor` devolver
 *  `unknown` em `FichaInteira`. */
export type PropsDoEditor = { campo: CampoNaTela; valor: unknown; slug: string };

/** O que `FichaInteira` guarda no `Record<EspecieCampo, …>`: qualquer editor
 *  serve, desde que aceite exatamente estas props. É esse `Record` que faz uma
 *  espécie nova no registro NÃO COMPILAR até alguém decidir o instrumento
 *  dela. */
export type Editor = (props: PropsDoEditor) => ReactElement;

/** A espécie, repetida AQUI e não importada do registro, pela mesma razão do
 *  `CampoNaTela` (ver o docblock do topo). Quem monta a `PerguntaNaTela` é o
 *  servidor, a partir do `CampoDaFicha` — e uma espécie nova no registro que
 *  não esteja aqui deixa AQUELE arquivo sem compilar. */
export type EspecieNaTela = "prosa" | "lista" | "booleano" | "numero" | "coord" | "faixas";

/** UMA PERGUNTA DO FORMULÁRIO DE LUGAR NOVO (Tarefa 11) — o contrato entre a
 *  página de servidor (`/admin/novo`, que lê o registro e o questionário) e o
 *  `FormularioDeLugar`, que é de cliente e NÃO PODE importar o registro (E1 da
 *  auditoria: o zod iria pro celular).
 *
 *  - `texto` — a PERGUNTA, na redação do `docs/questionario-ficha.md`; ou o
 *    rótulo do campo (`rotuloDe`), quando o questionário não pergunta por ele.
 *  - `valor` — o que o rascunho já tem nesse caminho (`undefined` = ainda sem
 *    resposta, ou pulado — no documento, os dois são a mesma ausência).
 *
 *  🔴 UM INSTRUMENTO POR PERGUNTA, E UM SALVAR. Até a Tarefa 11d havia um
 *  `dentro` (as folhas de um bloco presente, cada uma com o Salvar dela), e foi
 *  por ele que o I-B da Tarefa 11 aconteceu: dois Salvar na pergunta do
 *  horário, o primeiro avançava e a hora da outra caixa sumia. O horário virou
 *  um instrumento só (`EditorFaixas`), e o `dentro` saiu. */
export type PerguntaNaTela = {
  especie: EspecieNaTela;
  campo: CampoNaTela;
  texto: string;
  valor: unknown;
};
