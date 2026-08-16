/** Os recortes da home: "o que é melhor pra mim hoje".
 *
 *  Puro, sem React: a folha aplica, a tela desenha, e as duas REGRAS DE
 *  HONESTIDADE abaixo vivem aqui, onde podem ser provadas. */

import { distanciaKm, type Coord } from "@/lib/geo";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import type { Esforco, Ficha } from "@/types/ficha";

export type Filtros = {
  distanciaKm: 30 | 60 | null;
  daHoje: boolean;
  soGratis: boolean;
  esforco: Esforco | null;
  duracaoMax: 120 | 240 | null;
};

export const CHAVE_FILTROS = "bp.filtros";

export const SEM_FILTRO: Filtros = {
  distanciaKm: null,
  daHoje: false,
  soGratis: false,
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
  return [f.distanciaKm, f.daHoje, f.soGratis, f.esforco, f.duracaoMax].filter(
    (x) => x !== null && x !== false,
  ).length;
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
    distanciaKm: x.distanciaKm === 30 || x.distanciaKm === 60 ? x.distanciaKm : null,
    daHoje: x.daHoje === true,
    soGratis: x.soGratis === true,
    esforco:
      x.esforco === "leve" || x.esforco === "media" || x.esforco === "puxada" ? x.esforco : null,
    duracaoMax: x.duracaoMax === 120 || x.duracaoMax === 240 ? x.duracaoMax : null,
  };
}

/** Uma trilha passa se passar em TODOS os recortes ligados.
 *
 *  `confia` é a MESMA pergunta que a `FolhaTrilhas` já faz pra decidir se
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
  if (filtros.distanciaKm !== null && voce) {
    if (distanciaKm(voce, ficha.condicao.coords) > filtros.distanciaKm) return false;
  }

  if (filtros.soGratis && ficha.custo.tag !== "gratis") return false;

  // REGRA DE HONESTIDADE 2: ficha sem o campo NUNCA é escondida por ele.
  // Sumir por dado que falta é mentira silenciosa — e hoje todas as fichas
  // estão nesse caso.
  if (filtros.esforco !== null && ficha.esforco && ficha.esforco !== filtros.esforco) return false;
  if (filtros.duracaoMax !== null && ficha.duracao && ficha.duracao > filtros.duracaoMax) {
    return false;
  }

  return true;
}
