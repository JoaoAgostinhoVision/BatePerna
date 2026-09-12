/** EM QUE DIAS DA SEMANA dá pra entrar num lugar.
 *
 *  🔴 POR QUE ISTO EXISTE (2026-09-11). O app já sabia dizer que um lugar fecha
 *  às 17h — mas não sabia dizer que ele **não abre na quarta-feira**. A Rampa do
 *  Pepê virou "Eco Park" e passou a receber visita **só aos sábados e domingos**;
 *  a ficha dela não tem `horario` nenhum, então numa quarta seca o app dizia
 *  **"Pode ir"** e mandava a pessoa dirigir 178 km até um portão trancado.
 *
 *  É a MESMA família do defeito de 2026-08-27 (a Pedra Furada dizendo "Pode ir"
 *  às 18h num lugar fechado desde as 17h), num eixo que não existia: lá o app
 *  afirmava mais do que sabia sobre a HORA, aqui sobre o DIA. E a decisão é a
 *  mesma que já foi tomada duas vezes neste projeto: **quando o app não pode
 *  afirmar, ele para de afirmar.**
 *
 *  🔴 POR QUE `dias` NÃO MORA DENTRO DE `horario`, e a razão é dura: **a Rampa
 *  tem dia e não tem hora.** Ninguém — nem ele, nem fonte nenhuma — disse a que
 *  horas ela abre. Enfiar `dias` dentro do `horario` obrigaria a inventar um
 *  `abre`/`fecha` pra poder declarar o sábado, e geografia inventada com roupa
 *  de schema continua sendo geografia inventada. Os dois campos são
 *  independentes de propósito: uma ficha pode ter hora sem dia (Pedra Furada,
 *  Véu de Noiva), dia sem hora (Rampa), os dois, ou nenhum.
 *
 *  A régua do projeto decide o corte, como sempre: **quais dias** é fato do
 *  LUGAR e mora na ficha; **as palavras** ("sábado", "abre amanhã") moram aqui,
 *  uma vez. Mesmo molde do `CHUVA_NO_PISO` em `piso.ts` e do `FALA_MOLHADA` em
 *  `severidade.ts`.
 *
 *  ⚠️ NENHUM SUBSTANTIVO DE LUGAR MORA AQUI — nem "portão", nem "parque", nem
 *  "guichê". Mesma regra que o topo de `horario.ts` já carrega, e pela mesma
 *  história: foi esse tipo de palavra que passou o dia 2026-08-27 inteiro sendo
 *  arrancada do código.
 *
 *  Puro de propósito, sem zod e sem `node:fs`: client components leem este
 *  módulo direto. `src/types/ficha.ts` monta o `z.enum` A PARTIR de `DIAS` —
 *  nunca o contrário. */

import { OFFSET_RECIFE_S } from "./validade";

/** 🔴 A ORDEM NÃO É ESTÉTICA: o índice de cada dia aqui é exatamente o que
 *  `Date.getUTCDay()` devolve (0 = domingo … 6 = sábado). É isso que dispensa
 *  uma tabela de conversão entre "o dia que o relógio diz" e "o dia que a ficha
 *  declara" — e tabela de conversão é, neste projeto, sinônimo de duas fontes
 *  pro mesmo fato. Há teste cravando essa correspondência; se alguém reordenar
 *  este array, ele cai. */
export const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

export type Dia = (typeof DIAS)[number];

/** O nome por extenso de cada dia — a metade MATERIAL, que é igual em qualquer
 *  lugar do mundo e por isso mora aqui e não na ficha.
 *
 *  Forma curta ("sexta", não "sexta-feira") porque o destino é a linha de baixo
 *  do carimbo, que divide espaço com a palavra grande num celular de 375px. A
 *  forma longa não cabe, e "sex." abreviado seria uma terceira forma de escrever
 *  dia da semana no mesmo app. */
const NOME: Record<Dia, string> = {
  dom: "domingo",
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sab: "sábado",
};

/** Que dia da semana é em Recife — 0 (domingo) a 6 (sábado).
 *
 *  O agreste não tem horário de verão, e o offset é IMPORTADO de `validade.ts`
 *  pela mesma razão que `horario.ts` o importa: repetir o número seria uma
 *  segunda fonte pro mesmo fato.
 *
 *  ⚠️ E o offset importa DE VERDADE aqui, mais até do que na hora: às 21h de um
 *  sábado em Recife já é domingo em UTC. Usar `getDay()` do fuso do navegador,
 *  ou `getUTCDay()` sem o deslocamento, faria o app fechar a Rampa no sábado à
 *  noite — o dia da semana errado pelas três horas de diferença. */
export function diaDaSemanaRecife(epochS: number): number {
  return new Date((epochS + OFFSET_RECIFE_S) * 1000).getUTCDay();
}

/** Está fechado HOJE por causa do dia da semana?
 *
 *  Ficha sem `dias` é `false`, e essa é a régua de sempre: **o app não sabe que
 *  aquele lugar folga, então não afirma que folgou.** `dia === null` é o
 *  primeiro render, antes de o relógio do cliente falar — mesma disciplina do
 *  `fechadoAgora`, e a resposta também é `false`. */
export function fechadoNoDia(dias: readonly Dia[] | undefined, dia: number | null): boolean {
  if (!dias || dia === null) return false;
  return !dias.includes(DIAS[dia]);
}

/** Daqui a quantos dias abre de novo? `0` = hoje mesmo, `1` = amanhã.
 *
 *  Devolve `null` quando `dias` está vazio — que o schema não deixa entrar, mas
 *  que um `[]` vindo de qualquer outro caminho tornaria um laço infinito. Vale a
 *  guarda: a alternativa é o navegador travar na mão de quem só queria saber se
 *  dá pra ir. */
export function diasAteAbrir(dias: readonly Dia[], dia: number): number | null {
  for (let d = 0; d < 7; d++) {
    if (dias.includes(DIAS[(dia + d) % 7])) return d;
  }
  return null;
}

/** 🔴 A ORDEM EM QUE SE LÊ A SEMANA NÃO É A ORDEM EM QUE O RELÓGIO A CONTA.
 *
 *  `DIAS` começa no domingo porque é isso que `Date.getUTCDay()` devolve — e
 *  ler por ali produziu, na primeira versão deste arquivo, **"Abre domingo e
 *  sábado."** na ficha da Rampa. Ninguém fala assim: o fim de semana se lê
 *  sábado→domingo. A lista de leitura começa na segunda e termina no domingo.
 *
 *  É DERIVADA de `DIAS`, nunca uma segunda lista de nomes escrita à mão — o dia
 *  em que alguém acrescentasse um dia a uma e não à outra, a tela perderia um
 *  dia em silêncio. */
const ORDEM_LEITURA: readonly Dia[] = [...DIAS.slice(1), DIAS[0]];

/** "sábado e domingo" · "segunda, quarta e sexta" · "sábado".
 *
 *  A ordem é a da SEMANA LIDA, não a que a ficha escreveu: `["dom","sab"]` e
 *  `["sab","dom"]` são o mesmo fato, e duas fichas com o mesmo fato têm que
 *  produzir a mesma frase na tela. */
export function rotuloDias(dias: readonly Dia[]): string {
  const nomes = ORDEM_LEITURA.filter((d) => dias.includes(d)).map((d) => NOME[d]);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** "abre amanhã" · "abre sábado" — a linha de baixo do carimbo quando o que
 *  fechou foi o DIA.
 *
 *  🔴 O "amanhã" é o mesmo raciocínio que `rotuloAbertura` já carrega pra hora,
 *  e pela mesma razão: quem lê isto numa sexta precisa saber que é só esperar a
 *  noite passar, e quem lê numa segunda precisa saber que perdeu a semana. A
 *  MESMA frase nos dois casos mentiria pra metade das pessoas.
 *
 *  ⚠️ `null` quando não há dia nenhum pra abrir — o app CALA em vez de inventar
 *  um sábado. Mesmo padrão do `?? ""` em `subDe`. */
export function rotuloProximoDia(dias: readonly Dia[], dia: number): string | null {
  const falta = diasAteAbrir(dias, dia);
  if (falta === null) return null;
  if (falta === 1) return "abre amanhã";
  return `abre ${NOME[DIAS[(dia + falta) % 7]]}`;
}

/** "Abre sábado e domingo." — a frase do motivo, na ficha.
 *
 *  ⚠️ Sem substantivo, igual ao `rotuloFaixa`: não diz o que abre. Ver o topo
 *  deste arquivo. */
export function rotuloSemana(dias: readonly Dia[]): string {
  return `Abre ${rotuloDias(dias)}.`;
}
