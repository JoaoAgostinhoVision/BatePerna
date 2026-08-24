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

/** O que o NAVEGADOR responde sobre a permissão de geolocalização.
 *  `null` quer dizer "não deu pra perguntar" — a API não existe, ou rejeitou. */
export type PermissaoGps = "granted" | "denied" | "prompt" | null;

/** Negado de verdade, ou só lembrança velha?
 *
 *  🔴 ESTA FUNÇÃO EXISTE POR UM DEFEITO MEDIDO NO CELULAR DO DONO DO APP, em
 *  produção: `navigator.permissions.query({name:"geolocation"})` respondia
 *  `granted` e o `bp.gps` guardado dizia `negado`. O app escondia o caminho de
 *  volta pro GPS — a funcionalidade que ele tinha pedido DUAS vezes — com base
 *  numa lembrança que o navegador desmentia.
 *
 *  A causa era de desenho: `"negado"` era gravado uma única vez, no callback de
 *  erro `code 1`, e **nenhum ponto do código o apagava ou reescrevia**. Quem
 *  negasse uma vez ficava marcado pra sempre, e liberar a permissão nas
 *  configurações não desfazia. **O app usava MEMÓRIA onde existe FONTE.**
 *
 *  Agora a fonte manda, e a lembrança é só o que sobra quando não há fonte.
 *
 *  ⚠️ O ramo do `null` NÃO é defensivo à toa: o Safari só passou a responder
 *  `permissions.query` pra geolocalização em versões recentes, e antes disso
 *  **rejeita**. Neste app isso importa de verdade — o veículo é um PWA
 *  instalado no iPhone. Sem fonte, o comportamento tem que ser exatamente o de
 *  antes desta correção, senão o conserto vira regressão em quem não tem a API.
 *
 *  Puro de propósito, como o resto deste arquivo: quem chama o navegador é o
 *  `src/app/local.tsx`. */
export function estadoGpsEfetivo(lembranca: EstadoGps, permissao: PermissaoGps): EstadoGps {
  if (permissao === null) return lembranca;
  return permissao === "denied" ? "negado" : "nunca";
}

export function coordDe(l: Local): Coord | null {
  return l.tipo === "nao-sei" ? null : l.coord;
}

/** Quanto tempo uma cidade escolhida à mão continua valendo.
 *
 *  Decisão do João em 2026-08-23, depois de ver no celular que a cidade não
 *  mudava nunca: a escolha vale por SESSÃO, e ele pediu cinto E suspensório —
 *  aba viva **e** no máximo 6h. A de aba sozinha não fecha o PWA do iPhone (o
 *  app fica SUSPENSO, não fechado, e reabrir amanhã continuaria mostrando a
 *  cidade de ontem); a de tempo sozinha não fecha "fechei o Safari e abri de
 *  novo em meia hora". */
export const VALIDADE_ESCOLHA_S = 6 * 60 * 60;

/** `sessionStorage` é do domínio inteiro, como o `localStorage`. */
export const CHAVE_SESSAO = "bp.sessao";

/** O valor gravado, escrito UMA vez: quem marca e quem confere leem daqui.
 *  Duas cópias literais poderiam divergir e a escolha nunca mais valeria. */
export const MARCA_SESSAO = "1";

/** A cidade escolhida à mão ainda manda? Puro de propósito: quem lê o relógio
 *  e o `sessionStorage` é o `src/app/local.tsx`.
 *
 *  ⚠️ Buraco conhecido, e é do relógio, não do desenho: com o relógio do
 *  aparelho atrasado, `agoraSeg - em` fica negativo e a escolha continua
 *  valendo. Não vale código — a saída é a pessoa tocar em "trocar", que é a
 *  mesma de sempre. */
export function escolhaAindaVale(
  local: Local,
  agoraSeg: number,
  marcadorDaSessao: string | null,
): boolean {
  if (local.tipo !== "escolhido") return false;
  if (marcadorDaSessao !== MARCA_SESSAO) return false;
  return agoraSeg - local.em < VALIDADE_ESCOLHA_S;
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
