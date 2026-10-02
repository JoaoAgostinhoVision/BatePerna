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
  /** Só pra espécie `bloco`: as folhas que entram JUNTAS quando o bloco está
   *  ausente. `chave` é o nome da folha DENTRO do bloco (`abre`), que é a chave
   *  que `gravarBloco` espera no corpo; `caminho` é o caminho completo, pro
   *  marcador de teste. */
  folhas?: readonly { chave: string; caminho: string; rotulo: string }[];
  /** Só pra espécie `coord`, e só na METADE `.lat` de um ponto do trajeto: o
   *  PAR daquele ponto, montado no servidor (Task 8). A metade sozinha é um
   *  número, e o mapa precisa dos dois pra pôr o pin; é a linha `.lat` que
   *  carrega o mapa do ponto e grava as duas metades. A linha `.lng` NÃO recebe
   *  isto — dois mapas pro mesmo ponto seriam duas fontes pra mesma pergunta.
   *  `condicao.coords` também não: lá o `valor` já É o par. */
  par?: { lat: number; lng: number };
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
