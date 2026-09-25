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
import type { Ficha } from "@/types/ficha";

export type Filtros = {
  /** Número livre, não mais `30 | 60`: virou barra + campo digitável. (Era um
   *  de DOIS recortes de km assim — o de extensão, `extensaoMaxKm`, saiu de
   *  `Filtros` na contração da Task 7.) Quem confere o que está guardado é o
   *  `lerFiltros`. */
  distanciaKm: number | null;
  daHoje: boolean;
  soGratis: boolean;
  // 🔴 AQUI MORAVA `pisoMinimo`, e ele saiu em 2026-08-27 sem substituto na
  // tela. O recorte de piso RESPONDIA A PERGUNTA ERRADA: ninguém filtra por
  // material do chão, filtra por "meu carro chega lá?". O piso era o proxy — e
  // ele errava CONTRA a pessoa, porque as duas fichas reais são `barro` e a
  // Pedra Furada some de quem pede piso melhor, com o carro que chegava.
  //
  // O fato de carro virou campo da FICHA (`carroComum`), mas NÃO virou chip:
  // as duas fichas respondem "sim", então o chip acenderia, contaria na linha
  // de resumo e não mudaria a lista — o defeito exato pelo qual `barro` foi
  // excluído dos chips de piso. Decisão dele, com as duas fichas na mão.
  // O chip entra no dia em que existir trilha que carro comum não alcança.
};

export const CHAVE_FILTROS = "bp.filtros";

/** `PASSO` é granularidade da BARRA de distância, NÃO o piso do intervalo — o
 *  piso é 1 (ver `kmGuardado` abaixo). Com o piso em 5, um `4` digitado seria
 *  aceito pela tela, guardado, e viraria `null` na releitura: o filtro se
 *  desligando sozinho entre uma abertura e outra do app, sem nada na tela
 *  dizendo por quê.
 *
 *  🔴 A distância NÃO tem mais um teto fixo aqui — `DIST_MAX_KM` morreu
 *  NESTA task (Task 5, 2026-08-23), decisão do João: "não faz sentido limitar
 *  no bate perna". O teto da barra de distância agora é dinâmico, calculado
 *  por `tetoDaBarraDistancia`.
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
  return [f.distanciaKm, f.daHoje, f.soGratis].filter(
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
    // O que está guardado no celular do dono do app tem `esforco`,
    // `duracaoMax`, `extensaoMaxKm` e — a partir de 2026-08-27 — `pisoMinimo`
    // gravados de verdade, e NENHUM deles é lido aqui, de propósito. Ler um
    // campo que a tela não desenha mais faria a linha de resumo dizer "1 filtro
    // ligado" sem nenhum chip pra desligar, que é exatamente o que ele
    // reclamou. 🔴 O `pisoMinimo` é o caso mais perigoso dos quatro: o celular
    // DELE tem um piso guardado agora, e ele esconde ficha de verdade — o
    // fantasma não seria só um contador errado, seria trilha sumida sem
    // controle na tela pra trazer de volta.
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
  fechado,
}: {
  ficha: Ficha;
  leitura: LeituraCarimbo;
  filtros: Filtros;
  voce: Coord | null;
  confia: boolean;
  /** Este lugar está fechado AGORA — por hora, por dia da semana, ou pelo
   *  dono. Quem junta as causas é `fechadoHoje`, em `horario.ts`.
   *
   *  Vem de fora porque quem tem o relógio é a tela (`MioloHome`), e este
   *  módulo é puro. `false` no primeiro render, antes de o relógio falar: o
   *  calendário ainda não sabe se existe, mas o dono já pode ter fechado
   *  desde então — ver `fechadoHoje`. */
  fechado: boolean;
}): boolean {
  // REGRA DE HONESTIDADE 1: "dá hoje" só esconde o que o motor MEDIU. Sem
  // leitura confiável o recorte fica inerte — esconder o que não se sabe é o
  // app fingindo que sabe, e ele foi construído pra informar, não pra mandar.
  //
  // 🔴 E O CHIP PROMETE **HOJE**, NÃO PROMETE CHUVA (2026-09-12). Até hoje este
  // recorte só consultava o motor, e um lugar SECO que não abre hoje passava
  // direto: a Rampa do Pepê, numa quarta-feira, dentro de uma lista que a pessoa
  // acabou de pedir pra mostrar só o que dá — com o cartão dela dizendo
  // "FECHADO AGORA" ali do lado. O filtro e o cartão se contradizendo na mesma
  // tela. Mesma família do defeito das 18h (2026-08-27): responder a pergunta da
  // chuva e chamar isso de a pergunta inteira.
  //
  // ⚠️ O RAMO DO FECHADO **NÃO** PASSA PELO `confia`, e a diferença é real: a
  // REGRA 1 existe porque o app não pode esconder o que não MEDIU — e horário e
  // dias não são medição de nada, são fato da ficha mais o relógio. Isto o app
  // sabe. Juntar os dois ramos num `&&` só faria o lugar fechado reaparecer
  // toda vez que o clima falhasse.
  if (filtros.daHoje && fechado) return false;
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
  // 🔴 Este bloco já foi de `extensaoKm` (apagado na Task 7 junto com o campo) e
  // depois de `piso` (apagado em 2026-08-27, quando o recorte passou a
  // perguntar do CARRO — ver `soCarroComum` em `Filtros`). O campo muda; a
  // regra é a mesma, e é sobre o CAMPO AUSENTE, não sobre qual ficha o tem hoje.
  //
  // ⚠️ HOJE NENHUM CAMPO OPCIONAL DA FICHA RECORTA — a regra fica escrita
  // porque o próximo recorte que chegar tem que nascer obedecendo a ela, e
  // porque o `carroComum` (gravado nas fichas desde 2026-08-27) é o candidato
  // óbvio. Quando ele virar chip: `ficha.carroComum === false`, e NUNCA
  // `!ficha.carroComum` — o segundo esconderia também a ficha SEM o dado
  // (`undefined` é falso), que é a mentira silenciosa que a regra proíbe. As
  // duas versões só se separam numa ficha sem o campo.

  return true;
}
