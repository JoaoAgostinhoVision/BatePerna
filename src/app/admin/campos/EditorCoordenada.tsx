"use client";
import { useRef, useState, type PointerEvent } from "react";
import {
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM,
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
 *  🔴 A ESPÉCIE TEM DUAS FORMAS, e este editor atende as duas (A1 da auditoria):
 *   - `condicao.coords` é o PAR `{lat,lng}`: mapa + pin, e UM `PUT` com o par;
 *   - `trajeto.waypoints.N.lat` é uma METADE: o MESMO mapa, com o pin no par
 *     daquele ponto (que chega por `campo.par`, montado no servidor), e salvar
 *     manda DOIS `PUT`s em série — `.lat` e depois `.lng`. Se o segundo falhar,
 *     a tela mostra o erro que `gravar.ts` já tem e não recarrega;
 *   - `trajeto.waypoints.N.lng` é a outra metade: SÓ o número, sem mapa e sem
 *     botão. O pin dela mora na linha `.lat`; dois mapas pro mesmo ponto seriam
 *     duas fontes pra mesma pergunta.
 *
 *  🔴 ARRASTAR NÃO GRAVA. O pin se move, o número embaixo acompanha, e só o
 *  Salvar manda pra porta — o dono confere o número contra o que sabe antes.
 *
 *  🔴 NÃO EXISTE BUSCA DE ENDEREÇO, e não é esquecimento (spec §3.2): busca
 *  traria de fora um ponto que ninguém conferiu, e este app não inventa fato de
 *  lugar. O ponto sai da mão de quem foi.
 *
 *  🔴 PIXEL DE TELA NÃO É PIXEL DE LAYOUT (A7). O pin é posicionado em pixels
 *  de layout da caixa (`MAPA_LARGURA_PX` × `MAPA_ALTURA_PX`, no `MAPA_ZOOM`),
 *  e o ponteiro chega em pixels de TELA. A conversão é pela caixa que a tela
 *  de fato desenhou (`getBoundingClientRect`), e o `z` e o tamanho passados a
 *  `coordDaPosicao` são EXATAMENTE os do `posicaoNaCaixa` que põe o pin — é o
 *  que faz arrastar e reabrir caírem no mesmo ponto.
 *
 *  ⚠️ O MAPA É CENTRADO NO PONTO QUE ESTÁ NO BANCO e não segue o pin. No
 *  `MAPA_ZOOM` a caixa cobre ~36 km; mover mais que isso é salvar e abrir de
 *  novo (o `reload` recentra). O pin fica preso dentro da caixa.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: a coordenada vem da
 *  prop, e a única frase fixa é o crédito do OSM, que é licença. */

type Par = { lat: number; lng: number };

const ehPar = (v: unknown): v is Par =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Par).lat === "number" &&
  typeof (v as Par).lng === "number";

/** Seis casas: ~0,1 m, muito abaixo do que um pixel do mapa alcança. Arredondar
 *  é o que faz o número da TELA e o do `PUT` serem o mesmo número. */
const seisCasas = (n: number): number => Number(n.toFixed(6));

const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;

export default function EditorCoordenada({ campo, valor, slug }: PropsDoEditor) {
  if (ehPar(valor)) return <ComMapa campo={campo} centro={valor} slug={slug} metade={false} />;
  if (campo.par && campo.caminho.endsWith(".lat")) {
    return <ComMapa campo={campo} centro={campo.par} slug={slug} metade />;
  }
  // A metade `.lng` (ou uma forma que o documento não devia ter): só o número.
  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <p className="adm-editor-coord" data-testid="coord-atual">
        {typeof valor === "number" ? String(valor) : ""}
      </p>
    </div>
  );
}

function ComMapa({
  campo,
  centro,
  slug,
  metade,
}: {
  campo: CampoNaTela;
  centro: Par;
  slug: string;
  metade: boolean;
}) {
  const [atual, setAtual] = useState<Par>(centro);
  const arrastando = useRef(false);
  const { erro, salvando, gravar } = usarGravacao();

  // O mosaico é o MESMO do `MapaEstatico`: tiles de um zoom a mais desenhados em
  // 1/MAPA_ESCALA. O pin, não — ele vive em pixels de layout no `MAPA_ZOOM`.
  const tiles = tilesParaCaixa(centro, zoomDeTiles(), L * MAPA_ESCALA, A * MAPA_ESCALA);
  const pin = posicaoNaCaixa(atual, centro, MAPA_ZOOM, L, A);

  function mover(e: PointerEvent<HTMLDivElement>): void {
    const r = e.currentTarget.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return;
    const x = ((e.clientX - r.left) * L) / r.width;
    const y = ((e.clientY - r.top) * A) / r.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const c = coordDaPosicao(
      Math.min(L, Math.max(0, x)),
      Math.min(A, Math.max(0, y)),
      centro,
      MAPA_ZOOM,
      L,
      A,
    );
    setAtual({ lat: seisCasas(c.lat), lng: seisCasas(c.lng) });
  }

  function salvar(): void {
    if (metade) {
      const irma = campo.caminho.replace(/\.lat$/, ".lng");
      void gravar(
        { slug, campo: campo.caminho, valor: atual.lat },
        { slug, campo: irma, valor: atual.lng },
      );
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
            arrastando.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            mover(e);
          }}
          onPointerMove={(e) => {
            if (arrastando.current) mover(e);
          }}
          onPointerUp={() => {
            arrastando.current = false;
          }}
          onPointerCancel={() => {
            arrastando.current = false;
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
