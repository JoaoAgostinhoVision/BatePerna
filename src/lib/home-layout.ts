/** As medidas que garantem a regra não-negociável da home: **o primeiro cartão
 *  aparece sem rolar**. O mapa é orientação; o carimbo é a decisão. Mapa que
 *  empurra o primeiro veredito pra baixo da dobra está grande demais — quem
 *  cede é o mapa.
 *
 *  As duas alturas de moldura abaixo são MEDIDAS do CSS, não desejos. Se o
 *  padding da appbar ou o tamanho do cabeçalho de grupo mudarem em home.css /
 *  ficha.css, elas têm que ser medidas de novo — o teste só prova a soma. */

/** `.appbar`: padding .9rem/.8rem + o miolo de 1.5rem (o logo `.mk`, que é o
 *  item mais alto da linha quando não há chip). Vale pra Appbar SEM chip —
 *  com `chip`, a pílula de custo (`.cost-chip`) mede ~1,5px a mais que o
 *  logo e a soma passa a mentir por essa margem. A home usa Appbar sem chip
 *  hoje; se ganhar chip, esta constante precisa ser remedida. */
export const ALTURA_APPBAR_PX = 52;

/** `.grupo-k`: o rótulo "Hoje o tempo deixa" mais o respiro dele. */
export const ALTURA_CABECALHO_GRUPO_PX = 34;

/** O que pode existir acima do primeiro cartão. 667px é a viewport do menor
 *  iPhone ainda em uso; 320 deixa o cartão inteiro visível com folga. */
export const TETO_ANTES_DO_CARTAO_PX = 320;
