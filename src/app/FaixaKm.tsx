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
   *  130 km sumiria com a tela dizendo "qualquer distância". */
  max: number;
  /** Granularidade da BARRA, e só dela. NÃO é o piso do intervalo: o piso é 1,
   *  e digitar 4 com passo 5 filtra por 4 km, o que é verdade. Prender o piso
   *  no passo tornaria o campo indigitável (o `4` viraria `5` no primeiro
   *  dígito, e `100` seria inalcançável pelo teclado). */
  passo: number;
  onChange: (km: number | null) => void;
};

/** O contrato da leitura do campo, escrito uma vez:
 *
 *      ""  → null                    |  não-finito → null
 *      i = Math.trunc(Number(txt))   |  i < 1 → null  |  i > max → max  |  senão i
 *
 *  O TETO prende NA HORA porque é ele que carrega a honestidade: `150` na tela
 *  com o filtro cortando em `100` é a tela mentindo sobre o que está
 *  escondendo. O PISO não prende na hora — abaixo dele não há mentira, só um
 *  número menor —, e é por isso que não existe buffer de digitação aqui.
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
  const t = txt.trim();
  if (t === "") return null;
  const n = Number(t);
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

  return (
    <fieldset className="filtro-grupo faixa-km" aria-label={rotulo}>
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
        // Sem o `step`, a barra cai no padrão 1 e passa a oferecer valores
        // ACIMA do teto (com max 100 e passo 5: 101…104) que o `lerFiltros`
        // joga fora na releitura.
        step={passo}
        value={valor === null ? qualquer : valor}
        aria-label={`${rotulo}: arrastar`}
        // Sem isto, quem ouve a tela ouviria o número da parada extra na
        // posição que quer dizer "qualquer".
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
