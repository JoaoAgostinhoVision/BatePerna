/** "De onde eu estou" — a fonte única da localização da pessoa.
 *
 *  Puro de propósito: sem React, sem `navigator`, sem `localStorage`. Quem lê
 *  o aparelho é `src/app/local.tsx`; aqui só mora a forma do dado e o que se
 *  decide a partir dela, que é o que precisa de teste.
 *
 *  O rótulo da pílula vive aqui, e não no componente, porque ele é uma
 *  DECISÃO (o que o app diz quando não sabe, quando o GPS foi negado, quando
 *  a pessoa escolheu na mão), não uma formatação. */

import type { Coord } from "@/lib/geo";

export type Local =
  | { tipo: "nao-sei" }
  | { tipo: "gps"; coord: Coord; em: number }
  | { tipo: "escolhido"; coord: Coord; em: number; nome: string; regiao: string };

/** Se o navegador já negou o GPS uma vez. Não é um `Local`: é sobre a
 *  PERMISSÃO, não sobre a posição — dá pra ter posição escolhida na mão e o
 *  GPS negado ao mesmo tempo. */
export type EstadoGps = "nunca" | "negado";

/** `localStorage` é do domínio inteiro. Prefixo pra não colidir com nada. */
export const CHAVE_LOCAL = "bp.local";
export const CHAVE_GPS = "bp.gps";

export const NAO_SEI: Local = { tipo: "nao-sei" };

function ehCoord(x: unknown): x is Coord {
  const c = x as Coord | null;
  return (
    typeof c?.lat === "number" &&
    typeof c?.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/** O que estiver guardado no aparelho, conferido antes de virar decisão.
 *
 *  Qualquer coisa que não tenha exatamente a forma esperada vira "não sei".
 *  Uma versão anterior do app pode ter gravado outra coisa nesta chave, e
 *  aceitar de olhos fechados daria `{lat: undefined}` no enquadramento do
 *  mapa — que não estoura, só desenha um mapa em branco sem erro nenhum. */
export function lerLocal(bruto: string | null): Local {
  if (!bruto) return NAO_SEI;
  let x: unknown;
  try {
    x = JSON.parse(bruto);
  } catch {
    return NAO_SEI;
  }
  const o = x as Record<string, unknown> | null;
  if (typeof o !== "object" || o === null) return NAO_SEI;
  if (!ehCoord(o.coord) || typeof o.em !== "number" || !Number.isFinite(o.em)) return NAO_SEI;

  if (o.tipo === "gps") return { tipo: "gps", coord: o.coord, em: o.em };
  if (o.tipo === "escolhido" && typeof o.nome === "string" && typeof o.regiao === "string") {
    return { tipo: "escolhido", coord: o.coord, em: o.em, nome: o.nome, regiao: o.regiao };
  }
  return NAO_SEI;
}

export function lerEstadoGps(bruto: string | null): EstadoGps {
  return bruto === "negado" ? "negado" : "nunca";
}

export function coordDe(l: Local): Coord | null {
  return l.tipo === "nao-sei" ? null : l.coord;
}

/** O texto da pílula no canto do mapa — o único lugar de onde a localização
 *  se mexe. */
export function rotuloPilula(l: Local, gps: EstadoGps): string {
  if (l.tipo === "escolhido") return `de ${l.nome} · trocar`;
  if (l.tipo === "gps") return "daqui · trocar";
  // Negado uma vez, o navegador não pergunta de novo: continuar oferecendo
  // "Ver daqui" seria um botão que não faz nada. O app não insiste e não pede
  // desculpa — só troca o caminho.
  return gps === "negado" ? "escolher onde estou" : "Ver daqui";
}
