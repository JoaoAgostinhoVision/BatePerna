"use client";

/** Um recorte de km: a barra pra escolher rápido, o campo pra escolher exato.
 *
 *  GENÉRICO de propósito — não sabe o que é distância nem tamanho de trilha, e
 *  não conhece as constantes de `src/lib/filtros.ts`. Quem as lê e as passa é o
 *  painel; escrevê-las aqui seriam duas fontes que podem discordar, e
 *  discordando a tela aceitaria um valor que o `lerFiltros` joga fora na
 *  abertura seguinte — o filtro se desligando sozinho entre duas aberturas do
 *  app, sem nada na tela dizendo por quê.
 *
 *  UM VALOR SÓ: a barra e o campo escrevem no mesmo `onChange` e os dois
 *  MOSTRAM a prop `valor`. Nenhum estado local espelhando — dois estados pra
 *  uma verdade só é a assinatura de defeito que este app persegue. */

type Props = {
  rotulo: string;
  valor: number | null;
  /** Teto do recorte. A barra ganha UMA parada além dele, e essa parada vale
   *  `null`. Se o fim da barra fosse `max` chamado de "qualquer", uma trilha a
   *  130 km sumiria com a tela dizendo "qualquer distância".
   *
   *  ⚠️ PRÉ-CONDIÇÃO: **inteiro**. A barra NÃO trunca o que o elemento entrega —
   *  ela sobe `Number(e.target.value)` cru —, e só é honesta porque as paradas
   *  são inteiras. Teto ou passo fracionário fariam km fracionário subir pelo
   *  `onChange`, e o `lerFiltros` recusa fracionário: o filtro se desligaria
   *  sozinho na abertura seguinte.
   *
   *  🔴 Quem GARANTE o inteiro hoje não é mais uma constante: é o
   *  `Math.ceil(bruto / DIST_PASSO_KM) * DIST_PASSO_KM` dentro de
   *  `tetoDaBarraDistancia` (`src/lib/filtros.ts`) — o teto virou dinâmico, e é
   *  esse arredondamento pra cima no passo que mantém a pré-condição. Quem
   *  passa o `passo`, esse sim, ainda vem de uma constante inteira do mesmo
   *  módulo (`DIST_PASSO_KM`). */
  max: number;
  /** Granularidade da BARRA, e só dela. NÃO é o piso do intervalo: o piso é 1,
   *  e digitar 4 com passo 5 filtra por 4 km, o que é verdade. Prender o piso
   *  no passo tornaria o campo indigitável: o `4` viraria `5` no primeiro
   *  dígito, e nenhum número que comece por um dígito abaixo do passo seria
   *  alcançável pelo teclado, dígito a dígito.
   *
   *  🔴 Isto era hipótese enquanto o `max` era fixo — hoje, com o `max`
   *  dinâmico, o MESMO tipo de truncamento acontece de verdade, só que pelo
   *  TETO, não pelo piso: medido com o acervo todo perto (teto 30), digitar
   *  `50` no campo devolve `30` (ver `kmDoTexto` abaixo). O piso continua 1,
   *  sem esse truncamento — é o teto que prende na hora.
   *
   *  ⚠️ PRÉ-CONDIÇÃO: **inteiro**, e pela mesma razão do `max` acima. */
  passo: number;
  onChange: (km: number | null) => void;
};

/** O contrato da leitura do campo, escrito uma vez:
 *
 *      não-finito → null            |  "" → null (cai no `i < 1`, ver abaixo)
 *      i = Math.trunc(Number(txt))   |  i < 1 → null  |  i > max → max  |  senão i
 *
 *  O vazio cai no `i < 1` sozinho, e por isso não tem guarda próprio: MEDIDO em
 *  node, `Number("")` e `Number("   ")` são `0`, e `0 < 1`. Um `if (txt === "")`
 *  aqui devolveria o mesmo `null` por outro caminho, sem nenhuma mutação capaz
 *  de matá-lo — linha que não faz nada, e teste que a "protegesse" seria
 *  decoração. Pela mesma medição saiu o `txt.trim()`: `Number(" 45 ")` é `45`.
 *
 *  O TETO prende NA HORA porque é ele que carrega a honestidade: um número
 *  maior que o teto atual na tela, com o filtro cortando ali mesmo, é a tela
 *  mentindo sobre o que está escondendo — MEDIDO com o `max` dinâmico: teto
 *  30, digitar `50` devolve `30`. O PISO não prende na hora — abaixo dele não
 *  há mentira, só um número menor —, e é por isso que não existe buffer de
 *  digitação aqui.
 *
 *  🔴 O piso é `< 1`, e o `=` que falta é o que separa este campo do "campo
 *  indigitável": com `<= 1`, digitar `1` esvazia o campo e todo número que
 *  COMEÇA por 1 (`1`, `10`, `100`) fica inalcançável pelo teclado.
 *
 *  `Math.trunc` porque `type="number"` aceita `4.5` e o `lerFiltros` só guarda
 *  inteiro: sem truncar, o valor voltaria `null` na releitura.
 *
 *  ⚠️ O `Number.isFinite` é CINTO e NÃO tem asserção fingindo que carrega
 *  alguma coisa. MEDIDO em jsdom: `input[type=number]` já sanitiza `"abc"` pra
 *  `""` antes do handler, então essa porta não se abre pelo teclado. Ele fica
 *  porque sem ele um texto que chegasse aqui viraria `NaN` subindo pelo
 *  `onChange` — e `Math.trunc(NaN) < 1` é `false`, ou seja, NaN passaria
 *  inteiro pelos dois guardas abaixo. */
function kmDoTexto(txt: string, max: number): number | null {
  const n = Number(txt);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1) return null;
  return i > max ? max : i;
}

export default function FaixaKm({ rotulo, valor, max, passo, onChange }: Props) {
  // A parada extra é um ESTADO ("qualquer"), não um número de km.
  const qualquer = max + passo;
  // Sai da mesma prop, no mesmo render: o `<span>` não é segunda fonte. Ele
  // existe pro caso `null`, em que o campo está vazio e nada mais na tela
  // diria que vazio quer dizer "qualquer".
  const leitura = valor === null ? "qualquer" : `até ${valor} km`;

  // O `<fieldset>` NÃO leva `aria-label`, de propósito: o nome do grupo sai da
  // `<legend>`, que é o título VISÍVEL na tela. MEDIDO na revisão — com o
  // `aria-label` junto, apagar a legenda deixava a suíte inteira verde: o nome
  // acessível continuava vindo do atributo (ele tem precedência) e só quem OLHA
  // a tela perdia o título. Duas fontes pro mesmo nome, e a de fora mascarando
  // o sumiço da de dentro.
  return (
    <fieldset className="filtro-grupo faixa-km">
      <legend>{rotulo}</legend>
      <input
        type="range"
        className="faixa-arrasto"
        // ⚠️ MEDIDO no jsdom (e é o que o navegador faz): valor ABAIXO do
        // `min` é preso no `min` pelo próprio elemento. Com passo 5, um corte
        // de 4 km põe o pegador na primeira parada enquanto o campo mostra 4 —
        // nenhum código nosso arredonda nada, é o piso da barra. É por isso que
        // a prova de "não arredondar" usa um valor FORA do passo e DENTRO do
        // intervalo (7), o único caso em que as duas versões se separam.
        min={passo}
        max={qualquer}
        // O `step` é DESENHO, não honestidade — e a versão anterior deste
        // comentário dizia o contrário. Medido na revisão: com `step={1}`,
        // pedir um valor acima do teto à barra devolve `null` do mesmo jeito,
        // porque o `n > max` logo abaixo fecha a porta antes de qualquer coisa
        // sair daqui; nenhum valor acima do teto escapa, com ou sem `step`. O
        // que o `step` evita é a barra virar granular de 1 km num trilho onde
        // cada posição acima do teto sobra como zona morta que quer dizer
        // "qualquer" — 🔴 o `max` agora é dinâmico, então a densidade
        // (km por pixel do trilho) muda com o acervo: no piso mínimo
        // (`DIST_TETO_MINIMO_KM`, teto 30), ~0,15 km por pixel — bem mais
        // granular do que o "meio quilômetro por pixel" de quando o teto era
        // fixo em 100.
        step={passo}
        value={valor === null ? qualquer : valor}
        aria-label={`${rotulo}: arrastar`}
        // Sem o `aria-valuetext`, quem ouve a tela ouve o NÚMERO da parada
        // extra na posição que quer dizer "qualquer" — `passo` km acima do
        // teto (o teto agora é dinâmico, então esse número muda com o acervo)
        // —, e é justamente essa a mentira que a parada extra existe pra
        // evitar.
        aria-valuetext={leitura}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(n > max ? null : n);
        }}
      />
      <input
        type="number"
        inputMode="numeric"
        className="faixa-campo"
        min={1}
        max={max}
        step={1}
        placeholder="km"
        value={valor === null ? "" : String(valor)}
        aria-label={`${rotulo}: km`}
        onChange={(e) => onChange(kmDoTexto(e.target.value, max))}
      />
      <span className="faixa-leitura">{leitura}</span>
    </fieldset>
  );
}
