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

/** `.filtro-linha`: a linha de resumo dos filtros, entre o mapa e a folha.
 *  MEDIDA no navegador, não desejo.
 *
 *  ⚠️ Isto aqui já mentiu: era 36, e a linha media 39,2px. O `min-height: 36px`
 *  do `.filtro-linha` NUNCA mordia — quem mandava era o miolo:
 *
 *      .filtro-abrir min-height   32,0
 *    + padding .2rem × 2 da linha  6,4
 *    + border-bottom da linha      1,0   (0,8 medido, ver abaixo)
 *    ────────────────────────────────
 *                                 39,4
 *
 *  E o teste de orçamento somava a CONSTANTE, nunca a régua: com o botão em
 *  `min-height: 64px` a suíte ficava verde e o primeiro cartão nascia em
 *  y=344,65, acima do teto de 320 que o teste diz defender.
 *
 *  O conserto não foi só trocar o número: o `min-height` da linha subiu pra 40
 *  pra que ele MORDA (40 > 39,4) e volte a ser quem manda. Assim a constante
 *  descreve uma declaração que o navegador realmente usa, e não uma soma
 *  frágil. O teste em tests/lib/home-layout.test.ts confere a corrente inteira:
 *  o declarado é esta constante, E é maior ou igual ao que o miolo consegue
 *  empurrar. Quem crescer o botão derruba o teste.
 *
 *  Sobre o 1,0 da borda: medido em 375×667 num monitor de dpr 1,25, o Chrome
 *  reporta 0,8px pra uma borda de 1px (encaixe em pixel de dispositivo), e a
 *  linha dá 39,2. Num iPhone (dpr 2 ou 3) a borda fecha em 1,0 e a linha daria
 *  39,4. A conta acima usa o 1,0 de propósito: é o pior caso, e é o aparelho
 *  alvo. Com o min-height em 40 os dois casos medem 40 e a diferença some.
 *
 *  Orçamento: 52 (appbar) + 168 (mapa) + 40 (esta linha) + 34 (cabeçalho de
 *  grupo) = 294, contra o teto de 320. */
export const ALTURA_LINHA_FILTRO_PX = 40;

/** O que pode existir acima do primeiro cartão. 667px é a viewport do menor
 *  iPhone ainda em uso; 320 deixa o cartão inteiro visível com folga. */
export const TETO_ANTES_DO_CARTAO_PX = 320;
