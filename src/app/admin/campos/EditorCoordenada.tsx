"use client";
import { useRef, useState, type PointerEvent } from "react";
import {
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM_EDITOR,
  TILE_PX,
  coordDaPosicao,
  posicaoNaCaixa,
  tilesParaCaixa,
  urlTile,
  zoomDeTiles,
} from "@/lib/mapa";
import { usarGravacao } from "./gravar";
import { SALVANDO, SALVAR } from "./palavras";
import type { CampoNaTela, PropsDoEditor } from "./tipos";

/** O MAPA QUE ARRASTA O PIN — o instrumento da espécie `coord` (Task 8,
 *  2026-10-01). É a primeira interação de ponteiro do mapa deste app: o resto
 *  dele é mosaico de tiles desenhado por funções puras, sem JS.
 *
 *  🔴 A ESPÉCIE TEM DUAS FORMAS, e este editor atende as duas:
 *   - `condicao.coords` é o PAR `{lat,lng}`: mapa + pin, e UM `PUT` com o par;
 *   - `trajeto.waypoints.N.lat` é uma METADE: o MESMO mapa, com o pin no par
 *     daquele ponto (que chega por `campo.ponto`, montado no servidor), e salvar
 *     manda o ponto INTEIRO num `PUT` só — `{slug, ponto: N, lat, lng}`. 🔴 Até a
 *     onda de conserto 1 eram dois `PUT`s em série (`.lat`, depois `.lng`), e a
 *     revisão mostrou o custo: uma falha de rede entre os dois publicava um ponto
 *     que ninguém escolheu (latitude nova, longitude velha), com a tela dizendo
 *     "não consegui salvar". Agora o ponto entra numa versão só, ou não entra;
 *   - `trajeto.waypoints.N.lng` é a outra metade: SÓ o número, sem mapa e sem
 *     botão. O pin dela mora na linha `.lat`; dois mapas pro mesmo ponto seriam
 *     duas fontes pra mesma pergunta.
 *
 *  🔴 ARRASTAR NÃO GRAVA. O pin se move só com o dedo (ou o botão principal)
 *  ENCOSTADO, o número embaixo acompanha, e só o Salvar manda pra porta — o dono
 *  confere o número contra o que sabe antes.
 *
 *  🔴 NÃO EXISTE BUSCA DE ENDEREÇO, e não é esquecimento (spec §3.2): busca
 *  traria de fora um ponto que ninguém conferiu, e este app não inventa fato de
 *  lugar. O ponto sai da mão de quem foi.
 *
 *  🔴 PIXEL DE TELA NÃO É PIXEL DE LAYOUT. O pin é posicionado em pixels de
 *  layout da caixa (`MAPA_LARGURA_PX` × `MAPA_ALTURA_PX`, no `MAPA_ZOOM_EDITOR`),
 *  e o ponteiro chega em pixels de TELA. A conversão é pela caixa que a tela de
 *  fato desenhou (`getBoundingClientRect`), e o `z` e o tamanho passados a
 *  `coordDaPosicao` são EXATAMENTE os do `posicaoNaCaixa` que põe o pin. E o
 *  MOSAICO é desenhado em `zoomDeTiles(MAPA_ZOOM_EDITOR)` reduzido por
 *  `1/MAPA_ESCALA` — a mesma geometria por outro caminho; há teste conferindo,
 *  pela URL dos tiles, que o ponto gravado cai no mosaico sob o pin.
 *
 *  🔴 O PIN FICA PRESO À PARTE VISÍVEL. No celular a caixa de 480px é mais larga
 *  que a tela e a moldura corta a sobra; o ponteiro é limitado à interseção da
 *  caixa com a moldura (os dois `getBoundingClientRect`), então o pin nunca vai
 *  parar na parte cortada, onde o dono não o veria.
 *
 *  ⚠️ O MAPA É CENTRADO NO PONTO QUE ESTÁ NO BANCO e não segue o pin. No
 *  `MAPA_ZOOM_EDITOR` a caixa cobre ~9 km (e o celular vê ~6); mover mais que
 *  isso é salvar e abrir de novo — o `reload` recentra. Decisão do João.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: a coordenada vem da
 *  prop, e a única frase fixa é o crédito do OSM, que é licença. */

type Par = { lat: number; lng: number };

/** 🔴 FINITOS, não só `number` (onda 1, R3): `NaN` e `Infinity` são `typeof
 *  "number"`, e com `lng: Infinity` o laço de `tilesParaCaixa` nunca termina —
 *  a revisão mediu o render morrendo por falta de memória. Fora de forma, o
 *  editor cai no estado vazio, como o contrato de `PropsDoEditor` promete. */
const ehPar = (v: unknown): v is Par =>
  typeof v === "object" &&
  v !== null &&
  Number.isFinite((v as Par).lat) &&
  Number.isFinite((v as Par).lng);

/** Seis casas: ~0,1 m, muito abaixo do que um pixel do mapa alcança. Arredondar
 *  é o que faz o número da TELA e o do `PUT` serem o mesmo número. */
const seisCasas = (n: number): number => Number(n.toFixed(6));

const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;
const Z = MAPA_ZOOM_EDITOR;

export default function EditorCoordenada({ campo, valor, slug }: PropsDoEditor) {
  if (ehPar(valor)) return <ComMapa campo={campo} centro={valor} slug={slug} indice={null} />;
  if (campo.ponto && ehPar(campo.ponto) && campo.caminho.endsWith(".lat")) {
    const { indice, lat, lng } = campo.ponto;
    return <ComMapa campo={campo} centro={{ lat, lng }} slug={slug} indice={indice} />;
  }
  // A metade `.lng` (ou uma forma que o documento não devia ter): só o número.
  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <p className="adm-editor-coord" data-testid="coord-atual">
        {typeof valor === "number" && Number.isFinite(valor) ? String(valor) : ""}
      </p>
    </div>
  );
}

const entre = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function ComMapa({
  campo,
  centro,
  slug,
  indice,
}: {
  campo: CampoNaTela;
  centro: Par;
  slug: string;
  /** O índice do ponto do trajeto, ou `null` pro par `condicao.coords`. */
  indice: number | null;
}) {
  const [atual, setAtual] = useState<Par>(centro);
  /** O ponteiro que está arrastando, ou `null`. Só ELE move o pin: soltar,
   *  cancelar ou um segundo dedo não mexem em nada. */
  const arrastando = useRef<{ id: number | undefined } | null>(null);
  const { erro, salvando, gravar } = usarGravacao();

  // O mosaico é o MESMO do `MapaEstatico`: tiles de um zoom a mais desenhados em
  // 1/MAPA_ESCALA. O pin, não — ele vive em pixels de layout no zoom do editor.
  const tiles = tilesParaCaixa(centro, zoomDeTiles(Z), L * MAPA_ESCALA, A * MAPA_ESCALA);
  const pin = posicaoNaCaixa(atual, centro, Z, L, A);

  function mover(e: PointerEvent<HTMLDivElement>): void {
    const caixa = e.currentTarget.getBoundingClientRect();
    const moldura = (e.currentTarget.parentElement ?? e.currentTarget).getBoundingClientRect();
    if (!(caixa.width > 0) || !(caixa.height > 0)) return;
    // A parte VISÍVEL: a caixa cortada pela moldura. Sem interseção, não há onde pôr.
    const esq = Math.max(caixa.left, moldura.left);
    const dir = Math.min(caixa.right, moldura.right);
    const topo = Math.max(caixa.top, moldura.top);
    const base = Math.min(caixa.bottom, moldura.bottom);
    if (!(dir > esq) || !(base > topo)) return;
    const cx = entre(e.clientX, esq, dir);
    const cy = entre(e.clientY, topo, base);
    const x = ((cx - caixa.left) * L) / caixa.width;
    const y = ((cy - caixa.top) * A) / caixa.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const c = coordDaPosicao(x, y, centro, Z, L, A);
    setAtual({ lat: seisCasas(c.lat), lng: seisCasas(c.lng) });
  }

  function salvar(): void {
    if (indice !== null) {
      void gravar({ slug, ponto: indice, lat: atual.lat, lng: atual.lng });
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: atual });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <div className="adm-editor-mapa" style={{ height: A }}>
        <div
          className="adm-editor-mapa-caixa"
          data-testid="mapa-escolher"
          style={{ width: L, height: A, marginLeft: -L / 2 }}
          onPointerDown={(e) => {
            // Só o botão principal (o dedo, a caneta, o clique esquerdo), e só o
            // primeiro dedo: o direito abre menu, e um segundo dedo é pinça.
            if (e.button !== 0 || e.isPrimary === false || arrastando.current !== null) return;
            arrastando.current = { id: e.pointerId };
            e.currentTarget.setPointerCapture?.(e.pointerId);
            mover(e);
          }}
          onPointerMove={(e) => {
            if (arrastando.current !== null && arrastando.current.id === e.pointerId) mover(e);
          }}
          onPointerUp={(e) => {
            if (arrastando.current?.id === e.pointerId) arrastando.current = null;
          }}
          onPointerCancel={(e) => {
            if (arrastando.current?.id === e.pointerId) arrastando.current = null;
          }}
        >
          <div
            className="adm-editor-mapa-tiles"
            style={{ width: L * MAPA_ESCALA, height: A * MAPA_ESCALA, transform: `scale(${1 / MAPA_ESCALA})` }}
          >
            {tiles.map((t) => (
              <img
                key={`${t.z}/${t.x}/${t.y}`}
                src={urlTile(t)}
                alt=""
                width={TILE_PX}
                height={TILE_PX}
                draggable={false}
                style={{ left: t.left, top: t.top }}
              />
            ))}
          </div>
          <span
            className="adm-editor-mapa-pin"
            data-pin=""
            aria-hidden="true"
            style={{ left: pin.left, top: pin.top }}
          />
        </div>
        {/* Atribuição ODbL — obrigação de licença, não copy. A mesma do `MapaEstatico`. */}
        <a
          className="adm-editor-mapa-osm"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener"
        >
          © OpenStreetMap
        </a>
      </div>
      <p className="adm-editor-coord" data-testid="coord-atual">
        {`${atual.lat}, ${atual.lng}`}
      </p>
      <button
        type="button"
        className="adm-editor-salvar"
        data-salvar={campo.caminho}
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? SALVANDO : SALVAR}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
