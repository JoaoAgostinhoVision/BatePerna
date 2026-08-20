/** Os recortes da home: "o que é melhor pra mim hoje".
 *
 *  Puro, sem React: a folha aplica, a tela desenha, e as duas REGRAS DE
 *  HONESTIDADE abaixo vivem aqui, onde podem ser provadas. */

import { coordDaDistancia, distanciaKm, type Coord } from "@/lib/geo";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { PISOS_FILTRAVEIS, ordemPiso, type Piso } from "@/lib/piso";
import type { Esforco, Ficha } from "@/types/ficha";

export type Filtros = {
  /** Número livre, não mais `30 | 60`: os dois recortes de km viraram barra +
   *  campo digitável. Quem confere o que está guardado é o `lerFiltros`. */
  distanciaKm: number | null;
  daHoje: boolean;
  soGratis: boolean;
  extensaoMaxKm: number | null;
  pisoMinimo: Piso | null;
  // DE SAÍDA nesta rodada (quem apaga é a Task 8). Ficam de pé porque a ordem
  // é expandir → migrar → contrair: a tela e a ficha ainda os leem, e apagá-los
  // antes de os consumidores migrarem deixaria o `tsc` vermelho no meio.
  esforco: Esforco | null;
  duracaoMax: 120 | 240 | null;
};

export const CHAVE_FILTROS = "bp.filtros";

/** Os limites dos dois recortes de km, e eles moram AQUI — ao lado da
 *  validação que os aplica. A faixa da tela os lê deste módulo; escrevê-los de
 *  novo lá seriam duas fontes que podem discordar, e discordando a barra
 *  aceitaria um valor que o `lerFiltros` joga fora na abertura seguinte.
 *
 *  🔴 `PASSO` é granularidade da BARRA, NÃO o piso do intervalo — o piso é 1.
 *  Com o piso em 5, um `4` digitado seria aceito pela tela, guardado, e viraria
 *  `null` na releitura: o filtro se desligando sozinho entre uma abertura e
 *  outra do app, sem nada na tela dizendo por quê. */
export const DIST_MAX_KM = 100;
export const DIST_PASSO_KM = 5;
export const EXT_MAX_KM = 20;
export const EXT_PASSO_KM = 1;

export const SEM_FILTRO: Filtros = {
  distanciaKm: null,
  daHoje: false,
  soGratis: false,
  extensaoMaxKm: null,
  pisoMinimo: null,
  esforco: null,
  duracaoMax: null,
};

/** Quantos recortes estão ligados — o número da linha de resumo.
 *
 *  Os booleanos entram no array como booleanos (e não como `x || null`): assim
 *  as DUAS sub-cláusulas do filtro seguram peso de verdade. Com o `|| null`, o
 *  `x !== false` nunca era alcançável — o `tsc` recusava a comparação (TS2367)
 *  e a prova de mutação daquela metade era impossível. */
export function contarLigados(f: Filtros): number {
  // SETE durante a expansão: os dois velhos (`esforco`, `duracaoMax`) ainda
  // recortam de verdade, então ainda contam. Vira CINCO na Task 8, junto com
  // eles. Cada campo aqui é uma linha do painel; um que falte faz a tela dizer
  // "2 filtros ligados" com três ligados, e a pessoa procura na tela um
  // controle que a contagem jura não existir.
  return [
    f.distanciaKm,
    f.daHoje,
    f.soGratis,
    f.extensaoMaxKm,
    f.pisoMinimo,
    f.esforco,
    f.duracaoMax,
  ].filter((x) => x !== null && x !== false).length;
}

/** `Number.isInteger` faz a pergunta certa mas **não é type guard**: o `tsc`
 *  não estreita `unknown` com ele, e sem estreitar o `v >= 1` nem compila
 *  (lição 13 do RESUME). Embrulhado num predicado `v is number` ele resolve os
 *  dois de uma vez — e o embrulho é sólido: se `Number.isInteger(v)` é
 *  verdade, `v` é número.
 *
 *  Ele SOZINHO já recusa `NaN`, `Infinity`, texto e fracionário — MEDIDO em
 *  node, não deduzido. Um `Number.isFinite` ao lado seria redundante e, pior,
 *  INPROVÁVEL: nenhuma mutação o mataria, e teste que "protege" linha que não
 *  faz nada é decoração.
 *
 *  ⚠️ E é ele quem barra o TEXTO: sem ele, `"30" >= 1` e `"30" <= 100` são os
 *  dois `true` por coerção (medido), e `distanciaKm` viraria uma string dentro
 *  do estado do app. */
function ehInteiro(v: unknown): v is number {
  return Number.isInteger(v);
}

/** Km guardado: inteiro, de 1 até `max`. Qualquer outra coisa vira `null` —
 *  um valor estranho que passasse viraria um filtro escondendo trilha pra
 *  sempre, sem a pessoa saber o que desligar.
 *
 *  Um só pros dois recortes de propósito: duas cópias desta regra podiam
 *  divergir, e é o mesmo `max` que a faixa da tela lê. */
function kmGuardado(v: unknown, max: number): number | null {
  return ehInteiro(v) && v >= 1 && v <= max ? v : null;
}

/** `PISOS_FILTRAVEIS`, não `PISOS`: `barro` é o piso da escala e, com o filtro
 *  lido como "no mínimo daqui pra cima", aceso ele não esconde NADA — e o
 *  painel não desenha chip de barro, então a linha de resumo diria "1 filtro
 *  ligado" sem nenhum controle na tela capaz de desligá-lo. Predicado, e não
 *  `includes` com cast, pela mesma razão do `ehInteiro`: quem estreita
 *  `unknown` é ele. */
function ehPisoFiltravel(v: unknown): v is Piso {
  return PISOS_FILTRAVEIS.some((p) => p === v);
}

export function lerFiltros(bruto: string | null): Filtros {
  // Este guarda parece redundante pro vitest — sem ele, `JSON.parse("")`
  // estoura e o `catch` logo abaixo devolve SEM_FILTRO do mesmo jeito. Ele
  // fica porque quem o precisa é o `tsc`: é ele que estreita `string | null`
  // pra `string` antes do `JSON.parse`. Não apague pela prova de mutação do
  // vitest sozinha (lição 13 do RESUME).
  if (!bruto) return SEM_FILTRO;
  // O `| null` do cast não é enfeite: `JSON.parse("null")` devolve `null` de
  // verdade, e um cast que escondesse isso estaria afirmando pro `tsc` o que o
  // runtime desmente — e ainda desarmaria o guarda logo abaixo, deixando só o
  // vitest de pé. Mesmo formato do `lerLocal` em `src/lib/local.ts`.
  let x: Record<string, unknown> | null;
  try {
    x = JSON.parse(bruto) as Record<string, unknown> | null;
  } catch {
    return SEM_FILTRO;
  }
  // Sem este guarda, `x.distanciaKm` ESTOURA no "null" guardado e a home não
  // abre — e ele agora é carregador das DUAS ferramentas: apagá-lo derruba o
  // teste no vitest E não compila no `tsc`.
  //
  // O `typeof x !== "object" ||` que o acompanhava no plano SAIU: ele não era
  // provável por nenhuma das duas. Pro texto "5", ler campo de um número devolve
  // `undefined` no vitest — o resultado é o mesmo SEM_FILTRO, por outro caminho.
  // Um teste dele continua logo abaixo, travando o COMPORTAMENTO ("número não
  // estoura, vira SEM_FILTRO") em vez da linha.
  if (x === null) return SEM_FILTRO;
  // Cada recorte cai pro próprio padrão se vier fora do conjunto. Um valor
  // estranho que passasse viraria um filtro escondendo tudo pra sempre, sem a
  // pessoa saber o que desligar.
  return {
    distanciaKm: kmGuardado(x.distanciaKm, DIST_MAX_KM),
    daHoje: x.daHoje === true,
    soGratis: x.soGratis === true,
    extensaoMaxKm: kmGuardado(x.extensaoMaxKm, EXT_MAX_KM),
    pisoMinimo: ehPisoFiltravel(x.pisoMinimo) ? x.pisoMinimo : null,
    esforco:
      x.esforco === "leve" || x.esforco === "media" || x.esforco === "puxada" ? x.esforco : null,
    duracaoMax: x.duracaoMax === 120 || x.duracaoMax === 240 ? x.duracaoMax : null,
  };
}

/** Uma trilha passa se passar em TODOS os recortes ligados.
 *
 *  `confia` é a MESMA pergunta que o `MioloHome` já faz pra decidir se a folha
 *  agrupa — recebida pronta de propósito. Escrever aqui uma segunda regra pra
 *  "confiável" seria criar duas fontes que podem discordar, que é a família
 *  de defeito que já custou dois Criticals a este app. */
export function passaNoFiltro({
  ficha,
  leitura,
  filtros,
  voce,
  confia,
}: {
  ficha: Ficha;
  leitura: LeituraCarimbo;
  filtros: Filtros;
  voce: Coord | null;
  confia: boolean;
}): boolean {
  // REGRA DE HONESTIDADE 1: "dá hoje" só esconde o que o motor MEDIU. Sem
  // leitura confiável o recorte fica inerte — esconder o que não se sabe é o
  // app fingindo que sabe, e ele foi construído pra informar, não pra mandar.
  if (filtros.daHoje && confia && leitura.estado !== "fresco") return false;

  // Sem localização o recorte de distância nem aparece na tela. Se chegar
  // ligado (guardado de outra sessão), não esconde nada.
  //
  // A coordenada sai de `coordDaDistancia` — a MESMA que o cartão mostra e a
  // ficha mostra. Enquanto isto aqui media até `condicao.coords`, o "até 60 km"
  // escondia trilha cujo cartão anunciava 40. Filtro que esconde por um número
  // que a tela não mostra é a pior versão do defeito: some sem explicação.
  if (filtros.distanciaKm !== null && voce) {
    if (distanciaKm(voce, coordDaDistancia(ficha)) > filtros.distanciaKm) return false;
  }

  if (filtros.soGratis && ficha.custo.tag !== "gratis") return false;

  // REGRA DE HONESTIDADE 2: ficha sem o campo NUNCA é escondida por ele.
  // Sumir por dado que falta é mentira silenciosa — e hoje todas as fichas
  // estão nesse caso, nos QUATRO campos opcionais (`esforco`, `duracao`,
  // `extensaoKm`, `piso`): a única ficha real não tem nenhum deles.
  if (filtros.esforco !== null && ficha.esforco && ficha.esforco !== filtros.esforco) return false;
  if (filtros.duracaoMax !== null && ficha.duracao && ficha.duracao > filtros.duracaoMax) {
    return false;
  }

  // Teto INCLUSIVO — precedente cravado na rodada passada: "até 4 km" inclui a
  // trilha de 4 km, que é como se lê em português; o contrário esconde
  // justamente o caso que a pessoa tinha em mente.
  //
  // O `ficha.extensaoKm &&` escreve a honestidade 2, mas — MEDIDO, não
  // deduzido — quem a segura em runtime é a aritmética: `undefined > 4` é
  // `false`, e apagar o `&&` deixa a suíte inteira 585/585 VERDE. Quem recusa
  // apagá-lo é o `tsc` (TS18048, "'ficha.extensaoKm' is possibly 'undefined'").
  // É a terceira resposta da lição 13, e é por isso que ele fica: diz a regra
  // na cara de quem lê, e é a única rede no dia em que a comparação mudar.
  //
  // Dependência silenciosa que mora em OUTRO arquivo, e por isso está escrita:
  // `extensaoKm` é `.positive()` no `src/types/ficha.ts`, então `0` não
  // existe. Se o `.positive()` cair, o `&&` passa a LER `0` como "campo
  // ausente" — hoje sem consequência observável (zero nunca é maior que um
  // teto ≥ 1), mas a linha muda de significado sem uma linha de diff aqui.
  if (
    filtros.extensaoMaxKm !== null &&
    ficha.extensaoKm &&
    ficha.extensaoKm > filtros.extensaoMaxKm
  ) {
    return false;
  }

  // "No mínimo daqui pra cima" na escala de `PISOS` (a ORDEM do array É a
  // escala). Ficha com piso PIOR que o pedido some; ficha sem piso, nunca.
  //
  // Aqui o `ficha.piso &&` MORDE no vitest, ao contrário do irmão acima:
  // `ordemPiso(undefined)` cai num `indexOf` e devolve -1, que é MENOR que
  // qualquer piso — sem o `&&`, ficha sem piso sumiria da home. Já o
  // `!== null` é o caso oposto: `ordemPiso(null)` também dá -1, `0 < -1` é
  // `false`, e apagá-lo deixa a suíte verde; quem o segura é o `tsc`. As duas
  // metades foram medidas separadas, porque num E a primeira esconde a outra.
  if (
    filtros.pisoMinimo !== null &&
    ficha.piso &&
    ordemPiso(ficha.piso) < ordemPiso(filtros.pisoMinimo)
  ) {
    return false;
  }

  return true;
}
