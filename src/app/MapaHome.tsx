"use client";
import { useRef } from "react";
import {
  MAPA_ALTURA_HOME_PX,
  MAPA_ESCALA,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_LARGURA_PX,
  TILE_PX,
  enquadrarComVoce,
  foraDaJanela,
  posicaoNaCaixa,
  tilesParaCaixa,
  urlTile,
} from "@/lib/mapa";
import type { Ficha } from "@/types/ficha";
import type { Coord } from "@/lib/geo";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { coordDe } from "@/lib/local";
import { useLocal } from "./local";
import BuscaLugar from "./BuscaLugar";
import PinTrilha from "./PinTrilha";
import { aberturaDaFicha } from "@/lib/horario";
import { useAgoraRecife } from "./useAgoraRecife";

/** O mapa da home: onde ficam as trilhas de hoje.
 *
 *  Mesma natureza do mapa da ficha — imagem, mosaico de tiles, zero JS pra
 *  desenhar. A diferença é que este ENQUADRA várias coordenadas em vez de
 *  centrar numa.
 *
 *  Mais baixo que o da ficha porque aqui ele divide a tela com a decisão: o
 *  primeiro cartão tem que nascer acima da dobra. Ver src/lib/mapa.ts
 *  (MAPA_ALTURA_HOME_PX).
 *
 *  🔴 `fichas` são as trilhas VISÍVEIS, não o acervo. Quem recorta é o
 *  `MioloHome`, uma vez só, e entrega a MESMA lista pro mapa, pra linha de
 *  resumo e pra folha. **Este componente não filtra e não pode passar a
 *  filtrar** — foi exatamente a segunda conta que pôs 3 pins sobre 1 cartão,
 *  com dois pins virando âncora morta e o aviso "2 trilhas fora do mapa" a
 *  40px de uma linha que dizia "1 trilha".
 *
 *  DOIS EIXOS pelos quais um recorte a mais aqui dentro diverge da folha. São
 *  os dois que conhecemos, cada um com o teste que o pega (ambos em
 *  tests/app/MioloHome.test.tsx) — não é promessa de lista completa:
 *
 *    1. A LEITURA. Como este componente já recebe só as visíveis, filtrar de
 *       novo aqui só consegue TIRAR — nunca devolver. Então a divergência não
 *       aparece quando a leitura nova ESCONDE (os dois escondem): aparece
 *       quando ela TRAZ DE VOLTA. A chuva parou, a leitura de agora promove
 *       `frio → fresco` com "só as que dá hoje" ligado, a folha traz o cartão
 *       e o mapa — filtrando pela semente do servidor, que ainda diz frio —
 *       não traz o pin. Teste: "leitura nova que ADICIONA".
 *
 *    2. O `confia`, e este NÃO depende de leitura nova nenhuma. **Este
 *       componente não recebe `confia`**, então quem filtrar aqui tem que
 *       INVENTAR um valor — e o que se escreve sem pensar é `true`. Aí o "só
 *       as que dá hoje" fica ATIVO no mapa enquanto está INERTE na folha (a
 *       Regra de Honestidade 1: sem leitura confiável o recorte não esconde
 *       nada), e a trilha de carimbo vencido perde o pin e mantém o cartão. É
 *       o dia ruim, que é quando a pessoa mais filtra. Teste: "sem leitura
 *       confiável, continua sem cabeçalho — e o filtro 'dá hoje' fica inerte".
 *
 *  ⚠️ QUEM PEGA O QUÊ, e a ordem importa porque foi MEDIDA, não suposta:
 *
 *    • o guarda de fonte "um recorte só, num escopo léxico só" é o cinto
 *      contra APELIDO e RENOMEAÇÃO — `export const recorta = passaNoFiltro`,
 *      `import { passaNoFiltro as pf }`. Ele conta NOMES;
 *    • os dois testes de tela acima são o suspensório contra REIMPLEMENTAÇÃO.
 *      Um índice computado (`import * as F` com o nome montado por
 *      concatenação) e uma cópia da lógica à mão passam pelo guarda inteiros —
 *      medido nas duas formas, e nas duas quem pegou foi teste de tela. Guarda
 *      de nome não vê lógica copiada, e isso não é limitação a consertar: é o
 *      que ele é.
 *
 *  E como `fichas` são as visíveis, ELA PODE CHEGAR VAZIA — o filtro zera a
 *  lista e o mapa continua na tela. O que ele mostra nesse caso está no bloco
 *  do `quadro`, lá embaixo; o que NÃO pode acontecer é ele devolver `null`,
 *  porque o `BuscaLugar` mora aqui dentro e é o único jeito de dizer onde se
 *  está. */
export default function MapaHome({
  fichas,
  leituras,
}: {
  fichas: Ficha[];
  leituras: Record<string, LeituraCarimbo>;
}) {
  // Mesma disciplina do page.tsx: o par ficha+leitura só existe se a leitura
  // existir. Fazer o TIPO provar isso — em vez de um `leituras.get(...)!`
  // afirmando o que este filtro é quem garante — impede um `undefined` de
  // estourar dentro do PinTrilha se um dia essa premissa parar de valer. E a
  // consequência de deixar passar seria pior aqui do que lá: lá uma ficha
  // some da lista; aqui derrubaria o MapaHome inteiro, e o mapa sumiria da
  // porta do app.
  // useLocal() vem antes do return condicional abaixo: hook não pode ser
  // chamado condicionalmente, e comLeitura.length pode ser 0.
  const local = useLocal();
  const voce = coordDe(local);

  // O ÚLTIMO ENQUADRAMENTO DESENHADO. Ele existe por um caso só: o filtro
  // zerou a lista e ninguém sabe onde a pessoa está. Sem trilha e sem você não
  // há o que enquadrar, e saltar pra lugar nenhum é pior que ficar parado —
  // decisão do dono do produto (spec §4), não fallback improvisado.
  //
  // Gravado DURANTE o render, e não num efeito: quem o lê é o render SEGUINTE
  // (o que já chega com a lista vazia), e um efeito só correria depois do
  // commit — tarde pra decidir o que pintar.
  //
  // 🔴 O RISCO REAL DE ESCREVER EM REF NO RENDER, nomeado, porque não é
  // "o valor pode não ser puro": é o render que o React COMEÇA E DESCARTA. O
  // objeto devolvido pelo `useRef` é compartilhado entre a fiber `current` e a
  // `workInProgress`, então a escrita de um render jogado fora SOBREVIVE ao
  // descarte — e o sintoma aqui seria o mapa guardar um enquadramento que
  // nunca chegou à tela.
  //
  // Hoje esta árvore não produz render descartado: não há `useTransition`,
  // `useDeferredValue`, `startTransition` nem `<Suspense>` em lugar nenhum do
  // `src/` (grepado). **É essa ausência, e não a pureza da conta, que segura
  // esta linha** — no dia em que qualquer um dos quatro entrar acima da home,
  // este é o primeiro lugar a reexaminar.
  //
  // Medido pela revisão desta task, e é o que sobra de garantia enquanto isso:
  // sob StrictMode as duas escritas são idênticas (mosaico byte-idêntico), e a
  // hidratação de verdade (`renderToString` → `hydrateRoot`) não acusa
  // mismatch nenhum — o ref nasce vazio no servidor e no cliente, então o
  // primeiro paint é o mesmo nos dois.
  const ultimo = useRef<{ centro: Coord; z: number } | null>(null);

  // 🔴 AQUI EM CIMA, e não lá embaixo perto dos pins: este componente tem um
  // `return null` no meio (o guarda do mapa sem pin nenhum), e hook depois de
  // saída condicional é a partida que o React não deixa jogar. UMA leitura do
  // relógio pro mapa inteiro, descendo por prop até cada pin — um hook dentro
  // do `.map()` faria o número de hooks variar com a lista.
  //
  // É o que impede o pin de ficar VERDE ao lado de um selo que já diz "Fechado
  // agora": o defeito que o próprio comentário do `PinTrilha` conta que já
  // aconteceu uma vez, com outra causa.
  const agora = useAgoraRecife();

  const comLeitura: { ficha: Ficha; leitura: LeituraCarimbo }[] = fichas.flatMap((f) => {
    const leitura = leituras[f.slug];
    return leitura ? [{ ficha: f, leitura }] : [];
  });

  // 🔴 DOIS VAZIOS DIFERENTES — e um deles é CINTO, não caminho vivo. Vale
  // dizer qual é qual, porque a metade de baixo desta condição parece
  // load-bearing e não é:
  //
  //   • NÃO HÁ FICHA NENHUMA = o filtro escondeu todas (ou o acervo está
  //     vazio). Este acontece — é o assunto desta rodada — e aqui o mapa FICA;
  //     os dois ramos dele estão no `quadro`, logo abaixo.
  //
  //   • HÁ FICHA E NENHUMA TEM LEITURA: hoje isto NÃO ACONTECE, e não por
  //     acaso. Este componente tem um chamador só, o `MioloHome`, que monta
  //     `leituras` a partir das MESMAS visíveis que viram `fichas` — uma chave
  //     por ficha, sempre. E a busca de clima FALHANDO também não produz este
  //     quadro: `resolverEstados` (src/lib/carimbo-estado.ts) captura o erro e
  //     devolve o Map CHEIO, com `erro: true`, que a home desenha com pins de
  //     erro. O único Map vazio que ela devolve é o de `fichas.length === 0` —
  //     que é o OUTRO caso, o de cima.
  //
  // O guarda fica assim mesmo: sem ele, uma ficha sem leitura que chegasse por
  // um chamador futuro viraria uma caixa de mapa sem pin nenhum, afirmando pela
  // ausência que ali não há trilha. Ele é barato e a intenção está provada — o
  // teste "sem NENHUMA leitura o mapa continua sumindo (é outro caso)" monta
  // esse quadro À MÃO, que é o único jeito de exercitá-lo com o caminho de
  // produção fechado.
  if (fichas.length > 0 && comLeitura.length === 0) return null;

  // O ENQUADRAMENTO cabe contra a janela que a tela realmente mostra
  // (MAPA_JANELA_VISIVEL_HOME_PX), não contra a caixa de geração dos tiles
  // (MAPA_LARGURA_PX, usada abaixo só pra desenhar o mosaico e posicionar
  // dentro dele) — ver o comentário da constante em src/lib/mapa.ts.
  const coords = comLeitura.map((x) => x.ficha.condicao.coords);

  // Zerou a lista e EU SEI onde você está: `enquadrarComVoce([], voce, …)` cai
  // no ramo do ponto único e devolve o zoom da ficha — ~26 km em volta de
  // você, a sua vizinhança. Zerou e NÃO sei: `enquadrar` estouraria de
  // propósito ("quem chama decide não desenhar mapa"), então fica o último.
  //
  // As duas sub-cláusulas seguram coisas diferentes, cada uma medida contra a
  // própria mutação: sem `coords.length === 0`, todo mapa sem localização
  // perde o mosaico (11 TESTES caem, em 2 arquivos); sem `&& !voce`, o vazio COM
  // localização passa a mostrar o quadro velho em vez de você — e essa só cai
  // porque o teste confere ONDE você está desenhado, não só o zoom.
  const quadro =
    coords.length === 0 && !voce
      ? ultimo.current
      : enquadrarComVoce(coords, voce, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_HOME_PX);
  if (quadro) ultimo.current = quadro;

  const fora = quadro
    ? foraDaJanela(coords, quadro.centro, quadro.z, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_HOME_PX)
    : 0;

  // Tiles de um zoom a mais desenhados em 1/MAPA_ESCALA: o dobro da densidade,
  // igual à ficha. zoomDeTiles() não serve aqui — ela crava MAPA_ZOOM, e o
  // zoom desta caixa é o `z` que saiu do enquadramento, não uma constante.
  const largura = MAPA_LARGURA_PX * MAPA_ESCALA;
  const altura = MAPA_ALTURA_HOME_PX * MAPA_ESCALA;

  return (
    <div className="mapa-home">
      <div
        className="mapa-home-tiles"
        role="img"
        aria-label="Mapa com as trilhas de hoje"
        style={{ width: MAPA_LARGURA_PX, height: MAPA_ALTURA_HOME_PX, marginLeft: -MAPA_LARGURA_PX / 2 }}
      >
        {/* Sem `quadro` não há centro nem zoom: nada de mosaico e nada de pin.
            Sobra esta caixa vazia — que NÃO é quem segura os 168px. Ela é
            `position: absolute` (home.css) e contribui altura ZERO; quem crava
            a altura é a regra `.bp .mapa-home { height: 168px }`, amarrada a
            MAPA_ALTURA_HOME_PX por tests/lib/home-layout.test.ts. Ou seja: o
            que impede a folha inteira de saltar embaixo do dedo de quem mexe
            no filtro é **este componente não devolver `null`** — não o que
            sobra dentro dele. Teste: "o vazio ocupa a MESMA altura do mapa
            cheio". O `tsc` é quem impede apagar esta condição: `quadro` é
            `… | null`. */}
        {quadro && (
          <>
            <div
              className="mapa-home-in"
              style={{ width: largura, height: altura, transform: `scale(${1 / MAPA_ESCALA})` }}
            >
              {tilesParaCaixa(quadro.centro, quadro.z + Math.log2(MAPA_ESCALA), largura, altura).map((t) => (
                <img
                  key={`${t.z}/${t.x}/${t.y}`}
                  src={urlTile(t)}
                  alt=""
                  width={TILE_PX}
                  height={TILE_PX}
                  style={{ left: t.left, top: t.top }}
                />
              ))}
            </div>
            {comLeitura.map(({ ficha: f, leitura }) => {
              const { left, top } = posicaoNaCaixa(
                f.condicao.coords, quadro.centro, quadro.z, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX,
              );
              return (
                <PinTrilha
                  key={f.slug}
                  slug={f.slug}
                  nome={f.trajeto.waypoints[0].nome}
                  left={left}
                  top={top}
                  inicial={leitura}
                  abertura={aberturaDaFicha(f)}
                  severidade={f.condicao.severidade}
                  agora={agora}
                />
              );
            })}
            {voce && (() => {
              const p = posicaoNaCaixa(voce, quadro.centro, quadro.z, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX);
              return <span className="voce-pin" data-testid="voce" style={{ left: p.left, top: p.top }} />;
            })()}
          </>
        )}
      </div>
      {fora > 0 && (
        <span className="mapa-fora">
          {fora === 1 ? "1 trilha fora do mapa" : `${fora} trilhas fora do mapa`}
        </span>
      )}
      {/* Atribuição ODbL — obrigação de licença, não enfeite. Não remover. */}
      <a className="wp-osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
        © OpenStreetMap
      </a>
      {/* 🔴 FORA de todo condicional, e é a razão de o vazio não devolver
          `null`. Esta é a caixa de digitar cidade — o ÚNICO lugar de onde a
          localização se mexe. Quem negou o GPS e zerou a lista com "só grátis"
          perderia, naquele instante exato, o jeito de dizer onde está. Teste:
          "com o filtro zerando, ainda dá pra dizer onde estou". */}
      <BuscaLugar />
    </div>
  );
}
