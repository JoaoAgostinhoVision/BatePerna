/** Os recortes da home: "o que é melhor pra mim hoje".
 *
 *  Puro, sem React: a folha aplica, a tela desenha, e as duas REGRAS DE
 *  HONESTIDADE abaixo vivem aqui, onde podem ser provadas. */

import {
  coordDaDistancia,
  distanciaKm,
  kmNaTelaDistancia,
  type Coord,
} from "@/lib/geo";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { PISOS_FILTRAVEIS, ordemPiso, type Piso } from "@/lib/piso";
import type { Ficha } from "@/types/ficha";

export type Filtros = {
  /** Número livre, não mais `30 | 60`: os dois recortes de km viraram barra +
   *  campo digitável. Quem confere o que está guardado é o `lerFiltros`. */
  distanciaKm: number | null;
  daHoje: boolean;
  soGratis: boolean;
  pisoMinimo: Piso | null;
};

export const CHAVE_FILTROS = "bp.filtros";

/** `PASSO` é granularidade da BARRA de distância, NÃO o piso do intervalo — o
 *  piso é 1 (ver `kmGuardado` abaixo). Com o piso em 5, um `4` digitado seria
 *  aceito pela tela, guardado, e viraria `null` na releitura: o filtro se
 *  desligando sozinho entre uma abertura e outra do app, sem nada na tela
 *  dizendo por quê.
 *
 *  🔴 A distância NÃO tem mais um teto fixo aqui — `DIST_MAX_KM` morreu numa
 *  rodada passada, decisão do João: "não faz sentido limitar no bate perna". O
 *  teto da barra de distância agora é dinâmico, calculado por
 *  `tetoDaBarraDistancia`.
 *
 *  🔴 `EXT_MAX_KM` e `EXT_PASSO_KM` — o teto e o passo do recorte de tamanho da
 *  trilha — morreram nesta task (Task 7, 2026-08-23) junto com o campo
 *  `extensaoKm` do modelo: sem o campo, não sobra recorte pra ter teto nem
 *  passo. */
export const DIST_PASSO_KM = 5;

/** O piso do TETO da barra — não é o teto. Sem ele, um acervo todo perto
 *  degenera a barra em duas ou três paradas. */
export const DIST_TETO_MINIMO_KM = 30;

/** Até onde a barra de distância vai.
 *
 *  🔴 O TETO VEM DO ACERVO, e essa é a decisão do João em 2026-08-23: *"não faz
 *  sentido limitar no bate perna"*. O `DIST_MAX_KM = 100` que morreu era um
 *  número inventado; o limite agora é o mundo que existe.
 *
 *  São três candidatos, e o maior manda:
 *
 *  1. `DIST_TETO_MINIMO_KM`, o piso;
 *  2. **o corte que está ligado agora** — e este é o que impede a TELA DE
 *     MENTIR. Com "até 500 km" guardado e a trilha mais longe a 27, um teto de
 *     30 poria o pegador na parada "qualquer" (o elemento `range` prende
 *     sozinho o valor acima do `max`) enquanto a leitura ao lado diz "até 500
 *     km". A barra estica pra conter o pegador;
 *  3. a trilha mais longe do acervo.
 *
 *  🔴 O candidato 3 usa `kmNaTelaDistancia`, NÃO o km cru: é "o filtro segue a
 *  tela" aplicado ao teto. A barra tem que oferecer uma parada capaz de
 *  alcançar o número que o cartão anuncia — com o km cru, uma trilha a 30,4 km
 *  (cartão: "~30 km") empurraria o teto pra 35 e sobraria uma parada que não
 *  esconde ninguém.
 *
 *  O arredondamento pra cima no passo é PRÉ-CONDIÇÃO do `FaixaKm`: teto ou
 *  passo fracionário fariam km fracionário subir pelo `onChange`, e o
 *  `lerFiltros` recusa fracionário — o filtro se desligando sozinho entre duas
 *  aberturas do app.
 *
 *  ⚠️ O `?? 0` do ramo sub-1km é indistinguível em runtime — nenhuma mutação o
 *  separa, porque `Math.max` converte `null` pra `0` via `ToNumber` de
 *  qualquer jeito, INDEPENDENTE de o piso de 30 dominar — e é exigido pelo
 *  compilador: sem ele o `tsc` recusa (`TS2345`, `number | null` não é
 *  atribuível a `number`). */
export function tetoDaBarraDistancia(
  fichas: Ficha[],
  voce: Coord | null,
  valorAtual: number | null,
): number {
  const doAcervo = voce
    ? fichas.map((f) => kmNaTelaDistancia(distanciaKm(voce, coordDaDistancia(f))) ?? 0)
    : [];
  const bruto = Math.max(DIST_TETO_MINIMO_KM, valorAtual ?? 0, ...doAcervo);
  return Math.ceil(bruto / DIST_PASSO_KM) * DIST_PASSO_KM;
}

export const SEM_FILTRO: Filtros = {
  distanciaKm: null,
  daHoje: false,
  soGratis: false,
  pisoMinimo: null,
};

/** Quantos recortes estão ligados — o número da linha de resumo.
 *
 *  Os booleanos entram no array como booleanos (e não como `x || null`): assim
 *  as DUAS sub-cláusulas do filtro seguram peso de verdade. Com o `|| null`, o
 *  `x !== false` nunca era alcançável — o `tsc` recusava a comparação (TS2367)
 *  e a prova de mutação daquela metade era impossível. */
export function contarLigados(f: Filtros): number {
  // QUATRO: eram sete durante a expansão da rodada passada, com `esforco` e
  // `duracaoMax` juntos; os dois foram apagados na contração daquela rodada.
  // `extensaoMaxKm` era o quinto, e morre nesta task (Task 7, 2026-08-23)
  // junto com o campo `extensaoKm` do modelo. Cada campo aqui é uma linha do
  // painel, e a lista tem que ser exatamente os campos de `Filtros` — um que
  // falte faz a tela dizer "2 filtros ligados" com três ligados, e a pessoa
  // procura na tela um controle que a contagem jura não existir; um que sobre
  // é o contrário, e foi o defeito que o dono do app viu no celular (contagem
  // prometendo chip que a tela não desenha).
  return [f.distanciaKm, f.daHoje, f.soGratis, f.pisoMinimo].filter(
    (x) => x !== null && x !== false,
  ).length;
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

/** Km guardado: inteiro, de 1 pra cima. **Não há teto** — o da distância virou
 *  dinâmico (`tetoDaBarraDistancia`) e o da extensão deixou de existir com o
 *  campo. Sem teto não existe valor "grande demais": um corte absurdo produz um
 *  filtro INERTE, não um filtro que esconde.
 *
 *  O piso continua `1`, e não o passo: com o piso em 5, um `4` digitado seria
 *  aceito pela tela, guardado, e viraria `null` na releitura — o filtro se
 *  desligando sozinho entre duas aberturas do app.
 *
 *  🔴 Tinha um segundo parâmetro (`max`) até esta task (Task 7, 2026-08-23):
 *  servia pros DOIS recortes de km — a distância com `null` (sem teto) e a
 *  extensão com `EXT_MAX_KM`. Com a extensão fora do modelo, sobrou um
 *  chamador só, e o parâmetro morto seria uma pergunta sem resposta possível
 *  (`max` sempre `null`) — pior que apagá-lo. */
function kmGuardado(v: unknown): number | null {
  return ehInteiro(v) && v >= 1 ? v : null;
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
    distanciaKm: kmGuardado(x.distanciaKm),
    daHoje: x.daHoje === true,
    soGratis: x.soGratis === true,
    pisoMinimo: ehPisoFiltravel(x.pisoMinimo) ? x.pisoMinimo : null,
    // O que está guardado no celular do dono do app tem `esforco`,
    // `duracaoMax` e (a partir desta task) `extensaoMaxKm` gravados de
    // verdade, e nenhum dos três é lido aqui — de propósito. Ler um campo que
    // a tela não desenha mais faria a linha de resumo dizer "1 filtro ligado"
    // sem nenhum chip pra desligar, que é exatamente o que ele reclamou.
    // Chave desconhecida no JSON é ignorada em silêncio: o objeto de saída é
    // montado campo a campo, nunca espalhado do que veio.
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
  //
  // 🔴 E o NÚMERO sai de `kmNaTelaDistancia` — o mesmo defeito entrando pela
  // outra ponta, este ainda EM PRODUÇÃO quando foi medido: a coordenada já era
  // uma só, mas a tela arredondava e esta linha comparava o km CRU. Com "até 10
  // km" ligado, uma trilha a 10,4495 km sumia da home enquanto o cartão dela
  // anunciava "~10 km em linha reta" (faixa de ~450 m no teto de 10; abaixo de
  // 10 km, onde a tela mostra uma casa, ~50 m). A decisão do dono do app: **o
  // filtro segue a tela**. NÃO refaça a conta aqui — a fonte é `geo.ts`, e uma
  // cópia à mão devolve o defeito com outra roupa.
  //
  // O `naTela !== null` é o ramo "a tela não mostra número" (menos de 1 km): o
  // que a tela não mostrou não pode esconder. Ele não é opcional — sem ele, o
  // `tsc` recusa a comparação (TS18047, `naTela` is possibly 'null').
  if (filtros.distanciaKm !== null && voce) {
    const naTela = kmNaTelaDistancia(distanciaKm(voce, coordDaDistancia(ficha)));
    if (naTela !== null && naTela > filtros.distanciaKm) return false;
  }

  if (filtros.soGratis && ficha.custo.tag !== "gratis") return false;

  // REGRA DE HONESTIDADE 2: ficha sem o campo NUNCA é escondida por ele.
  // Sumir por dado que falta é mentira silenciosa.
  //
  // 🔴 Até esta task (Task 7, 2026-08-23) esta regra tinha DOIS campos
  // opcionais: `extensaoKm` (com um bloco de filtro inteiro, apagado junto com
  // o campo) e `piso` (o bloco logo abaixo). Hoje só `piso` sobra — e a única
  // ficha real segue sem ele, então continua nunca sendo escondida por esta
  // regra.
  //
  // "No mínimo daqui pra cima" na escala de `PISOS` (a ORDEM do array É a
  // escala). Ficha com piso PIOR que o pedido some; ficha sem piso, nunca.
  //
  // O `ficha.piso &&` MORDE no vitest: `ordemPiso(undefined)` cai num
  // `indexOf` e devolve -1, que é MENOR que qualquer piso — sem o `&&`, ficha
  // sem piso sumiria da home. Já o `!== null` é o caso oposto: `ordemPiso(null)`
  // também dá -1, `0 < -1` é `false`, e apagá-lo deixa a suíte verde; quem o
  // segura é o `tsc`. As duas metades foram medidas separadas, porque num E a
  // primeira esconde a outra.
  if (
    filtros.pisoMinimo !== null &&
    ficha.piso &&
    ordemPiso(ficha.piso) < ordemPiso(filtros.pisoMinimo)
  ) {
    return false;
  }

  return true;
}
