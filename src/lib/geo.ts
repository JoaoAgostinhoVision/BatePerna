/** "É longe?" — distância entre dois pontos e o texto honesto que a ficha mostra.
 *  Puro de propósito: quando o tempo de estrada real entrar, troca-se a fonte
 *  do número e esta formatação continua de pé. */

import type { Ficha } from "@/types/ficha";

export type Coord = { lat: number; lng: number };

const RAIO_TERRA_KM = 6371;

const rad = (graus: number) => (graus * Math.PI) / 180;

/** Haversine. Linha reta sobre a esfera — nunca a estrada. */
export function distanciaKm(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 🔴 O NÚMERO QUE A TELA MOSTRA pra uma DISTÂNCIA — e é a ÚNICA fonte do
 *  arredondamento: `formatarDistancia` formata o que sai daqui, e o filtro
 *  `passaNoFiltro` compara com o que sai daqui. Nenhum dos dois refaz a conta.
 *
 *  A razão é um defeito medido: a tela arredondava e o filtro comparava o km
 *  CRU, então "até 10 km" escondia um cartão que a própria tela anunciava como
 *  "~10 km em linha reta" (pior caso varrido: 10,4495 km). A trilha sumia da
 *  home por um número que a pessoa não tinha como ver — a pior versão do
 *  defeito, porque some sem explicação. A decisão do dono do app foi **o filtro
 *  segue a tela**: quem recorta é o número que ele está lendo.
 *
 *  `null` quer dizer "a tela NÃO mostra número aqui" (o ramo do "menos de 1
 *  km"). Não é o mesmo que zero, e é de propósito que não é um número: quem
 *  filtra não pode esconder por algo que a tela não mostrou — é a mesma
 *  honestidade da REGRA 2 do `passaNoFiltro`, e assim o ramo do sub-1 fica
 *  incapaz de esconder POR CONSTRUÇÃO, em vez de por sorte aritmética. Também é
 *  o que mantém o limiar `km < 1` escrito UMA vez só: quem decide o ramo é esta
 *  função, e o formatador abaixo só descobre qual saiu.
 *
 *  ⚠️ Ela e a irmã `kmNaTelaExtensao` NÃO arredondam igual — ver o comentário
 *  de lá. Uma só não serviria: 12,4 km de distância aparece como "~12" e 12,4
 *  km de trilha aparece como "12,4". */
export function kmNaTelaDistancia(km: number): number | null {
  if (km < 1) return null;
  // Arredonda pra uma casa ANTES de decidir o ramo: senão um valor como 9,99
  // cai no ramo de uma casa e toFixed(1) mostra "10,0", enquanto 10 mostra
  // "10" — a mesma distância com duas caras diferentes.
  const arred = Math.round(km * 10) / 10;
  return arred < 10 ? arred : Math.round(arred);
}

/** O "em linha reta" é load-bearing: no agreste, 40 km em reta pode ser 1h30
 *  de serra. Sem o rótulo, o número mente pra baixo.
 *
 *  Aqui NÃO se arredonda nada: `toFixed(1)` sobre um número que já tem uma casa
 *  é preenchimento, e `String` sobre um inteiro é transcrição. A conta é toda de
 *  `kmNaTelaDistancia`, e uma segunda cópia dela aqui devolveria o defeito. */
export function formatarDistancia(km: number): string {
  const naTela = kmNaTelaDistancia(km);
  if (naTela === null) return "menos de 1 km em linha reta daqui";
  const n = naTela < 10 ? naTela.toFixed(1).replace(".", ",") : String(naTela);
  return `~${n} km em linha reta daqui`;
}

/** A distância como o CARTÃO a mostra: sem o "daqui", porque a pílula do mapa
 *  logo acima já diz de onde se está medindo. O "em linha reta" fica — ele é
 *  a parte honesta do texto, não enfeite. */
export function formatarDistanciaCurta(km: number): string {
  return formatarDistancia(km).replace(" daqui", "");
}

/** O NÚMERO QUE A TELA MOSTRA pra uma EXTENSÃO, irmã de `kmNaTelaDistancia` e
 *  com o mesmo contrato: fonte única do arredondamento, `null` quando a tela
 *  não mostra número. A razão inteira está escrita lá em cima.
 *
 *  🔴 E são DUAS funções, não uma, porque as duas telas NÃO arredondam igual: a
 *  distância vira INTEIRA de 10 km pra cima (`~12 km`), a extensão fica sempre
 *  com uma casa (`12,4 km de trilha`). Uma função só teria que escolher um dos
 *  dois e faria uma das telas mentir. Cada uma tem dono na prova de mutação.
 *
 *  O PISO, no molde da irmã. Sem ele, `formatarExtensao(0.04)` devolve "0 km de
 *  trilha" — o app AFIRMANDO zero km de trilha, que é o tipo de mentira que
 *  este projeto não conta. E o valor é alcançável: `extensaoKm` é
 *  `z.number().positive()` (não inteiro) em `src/types/ficha.ts`, e o
 *  questionário CONVIDA o decimal ("pode ter casa decimal: `4` ou `4.2`").
 *
 *  ⚠️ A frase que estava aqui — "nada aqui muda o FILTRO: quem ele compara é o
 *  km cru da ficha" — descrevia o defeito, não a regra. Era exatamente o km cru
 *  que fazia "até 4 km" esconder um cartão dizendo "4 km de trilha" (faixa
 *  medida: 4,00 a 4,05, e um intervalo desses em TODO teto de 1 a 20). Agora o
 *  filtro compara ISTO. */
export function kmNaTelaExtensao(km: number): number | null {
  if (km < 1) return null;
  return Math.round(km * 10) / 10;
}

/** A extensão da trilha em si (não a distância até ela) — km SÓ IDA, decisão
 *  explícita do dono do app. O sufixo mora AQUI DENTRO, não em cada chamador:
 *  o cartão (Task 6) e a ficha (Task 7) mostram o MESMO número, e foi
 *  exatamente duas formatações escritas em dois lugares que fez a mesma
 *  trilha ter dois km diferentes numa rodada passada (ver o comentário de
 *  `coordDaDistancia` abaixo, mesma família de defeito). Com o sufixo dentro
 *  da função, nenhum chamador tem como deixá-lo cair.
 *
 *  Como a irmã `formatarDistancia`, aqui NÃO se arredonda nada: a conta é toda
 *  de `kmNaTelaExtensao`, e o que sobra é escolher entre "12" e "12,4". */
export function formatarExtensao(km: number): string {
  const naTela = kmNaTelaExtensao(km);
  if (naTela === null) return "menos de 1 km de trilha";
  const n = Number.isInteger(naTela) ? String(naTela) : naTela.toFixed(1).replace(".", ",");
  return `${n} km de trilha`;
}

/** 🔴 O ÚNICO ponto de onde o app mede distância até uma trilha.
 *
 *  Uma ficha carrega DUAS coordenadas — `trajeto.waypoints[0]` (onde a trilha
 *  começa) e `condicao.coords` (onde se mede a chuva) — e nada obriga as duas
 *  a coincidirem. Na Rampa elas são iguais por acaso; a segunda ficha desfaz
 *  esse acaso. Enquanto o cartão e o filtro mediam até `condicao.coords` e a
 *  ficha media até o waypoint, a MESMA trilha tinha dois km (89 e 40, com um
 *  par sintético) e o filtro "até 60 km" escondia uma trilha cujo portão está
 *  a 40. É a invariante "uma trilha, uma fonte" quebrada por dentro.
 *
 *  A escolha é o WAYPOINT, e a razão é o botão "Abrir no mapa" da ficha: ele
 *  abre o waypoint no Google Maps. Medir por outro ponto faria o app dizer
 *  "40 km" e mandar a pessoa pra um lugar diferente. O pin do mapa da HOME
 *  continua em `condicao.coords` — lá o pin marca o ponto do clima, que é o
 *  que aquele mapa responde.
 *
 *  Mora em geo.ts, e não em ficha.ts, por uma razão dura: ficha.ts carrega
 *  `node:fs` no topo e quebraria o bundle do navegador — e dois dos três
 *  consumidores (`CartaoTrilha`, `DistanciaDaqui`) são client components. É o
 *  mesmo motivo que já exilou o `formatarDuracao` pra duracao.ts (apagado na
 *  contração). O `import type` daqui some na compilação, então nada de zod
 *  entra no bundle.
 *
 *  Recebe a FICHA inteira de propósito. Se recebesse uma `Coord`, cada chamador
 *  voltaria a escolher qual das duas passar — que é exatamente o defeito. */
export function coordDaDistancia(ficha: Ficha): Coord {
  const inicio = ficha.trajeto.waypoints[0];
  return { lat: inicio.lat, lng: inicio.lng };
}
