"use client";
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent } from "react";
import {
  GOTA_ACIMA_DA_PONTA_PX,
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM_EDITOR,
  MAPA_ZOOM_EDITOR_MAX,
  MAPA_ZOOM_EDITOR_MIN,
  RAIO_ALVO_TOQUE_PX,
  TILE_PX,
  TOQUE_MAX_PX,
  coordDaPosicao,
  posicaoNaCaixa,
  tilesParaCaixa,
  urlTile,
  zoomDeTiles,
} from "@/lib/mapa";
import { usarGravacao } from "./gravar";
import { SALVANDO, SALVAR } from "./palavras";
import type { CampoNaTela, PropsDoEditor, VistaNaTela } from "./tipos";

/** O MAPA DE PÔR O PIN — o instrumento da espécie `coord` (Task 8, 2026-10-01;
 *  refeito na Tarefa 11f, 2026-10-04, a pedido dele: *"latitude e longitude,
 *  era bom ter um mapa e a pessoa arrastar para a localização correta — que
 *  horror"*). É a única interação de ponteiro do mapa deste app: o resto dele é
 *  mosaico de tiles desenhado por funções puras, sem JS.
 *
 *  🔴 A ESPÉCIE TEM DUAS FORMAS, e este editor atende as duas:
 *   - `condicao.coords` é o PAR `{lat,lng}`: mapa + pin, e UM `PUT` com o par;
 *   - `trajeto.waypoints.N.lat` é uma METADE: o MESMO mapa, com o pin no par
 *     daquele ponto (que chega por `campo.ponto`, montado no servidor), e salvar
 *     manda o ponto INTEIRO num `PUT` só — `{slug, ponto: N, lat, lng}`. 🔴 Até a
 *     onda de conserto 1 da Task 8 eram dois `PUT`s em série, e uma falha de rede
 *     entre os dois publicava um ponto que ninguém escolheu. Agora o ponto entra
 *     numa versão só, ou não entra;
 *   - `trajeto.waypoints.N.lng` é a outra metade: SÓ o número, sem mapa e sem
 *     botão. O pin dela mora na linha `.lat`; dois mapas pro mesmo ponto seriam
 *     duas fontes pra mesma pergunta.
 *
 *  🔴 SEM PONTO, O MAPA NASCE SEM PIN — E SEM SALVAR (11f, M1/M4). A coordenada
 *  ainda sem resposta (no lugar novo; ou um documento torto na ficha no ar) não
 *  é mais digitada em duas caixas de número: é o mesmo mapa, começando na VISTA
 *  que o servidor mandou (`campo.vista`: a cidade do lugar, ou o ponto 0 pra a
 *  coordenada da chuva, ou o acervo). A vista não é ponto: não há pin, o número
 *  embaixo está vazio e o Salvar não existe até um TOQUE dele. Se a vista caísse
 *  no Salvar, o centro de uma cidade viraria o ponto de partida de um lugar, e o
 *  "Abrir no mapa" levaria gente pra lá.
 *
 *  🔴 OS GESTOS (11f, I3 da auditoria) — e eles não se confundem:
 *   - DEDO NA GOTA (num círculo de `RAIO_ALVO_TOQUE_PX`, 22px de TELA, em volta
 *     do meio da gota visível — não da ponta, que o dedo tampa): arrasta o PIN,
 *     pelo DESLOCAMENTO do dedo. O pin não salta pro dedo: pegá-lo pela borda
 *     não o move (no z13, um salto de 22px seriam ~400 m);
 *   - DEDO NO FUNDO, arrastado mais que `TOQUE_MAX_PX` (8px de tela): move a
 *     VISTA. O pin é um lugar NO mapa e anda junto; o número não muda;
 *   - DEDO NO FUNDO, solto com até 8px andados: é um TOQUE, e o pin vai pra
 *     onde o dedo soltou — o primeiro ponto, ou um ponto novo com o pin já posto
 *     (ruling do orquestrador: o mesmo gesto, uma regra só);
 *   - + e −: aproximam e afastam um degrau, entre `MAPA_ZOOM_EDITOR_MIN` e
 *     `MAPA_ZOOM_EDITOR_MAX`. COM PIN, EM VOLTA DO PIN — ele fica onde está na
 *     tela (onda de fix da 11f, C-1: em volta do centro, dois + jogavam o pin
 *     pra fora da tela); sem pin, em volta do centro. Sem pinça nesta tarefa.
 *  Só o ponteiro principal (o dedo, a caneta, o clique esquerdo), e um gesto de
 *  cada vez: o botão direito abre menu, e um segundo dedo seria pinça.
 *  `pointercancel` (o navegador tomando o gesto) desfaz o gesto e não vira toque.
 *
 *  🔴 O SALVAR VALE PELO PIN, NÃO PELA VISTA (11f, C1; refeito na onda de fix,
 *  C-1 da revisão). Afastado, um dedo errado por 10px é ~12 km (no z7). O pin
 *  se põe e se arrasta em qualquer zoom, e GUARDA o zoom do último gesto que o
 *  pôs ou moveu; o Salvar só liga se esse zoom for o `MAPA_ZOOM_EDITOR` (a
 *  precisão que ele pediu em 2026-10-01) ou mais perto, E se o pin estiver na
 *  parte VISÍVEL do mapa (ele grava o que está vendo). 🔴 Até a onda de fix o
 *  portão media o zoom da VISTA, e o caminho que a própria ajuda ensinava —
 *  tocar afastado, apertar + — gravava o toque do z7 (medido no Chrome: ~75 km
 *  da cidade). Um pin posto de longe só se salva depois de tocado ou arrastado
 *  de novo, de perto. O pin que veio do banco conta como posto no
 *  `MAPA_ZOOM_EDITOR`: é o ponto que já está lá. (O ponto NOVO do
 *  `EditorWaypoints` não tem ponto que já esteja lá: nasce sem pin desde a onda
 *  de fix 2 da 11f, m-5.) A ajuda (`portaoDoSalvar`) diz o que falta em cada
 *  caso.
 *
 *  🔴 ARRASTAR NÃO GRAVA, NEM MEXER NA VISTA. Só o Salvar manda pra porta — o
 *  dono confere o número embaixo contra o que sabe antes.
 *
 *  🔴 NÃO EXISTE BUSCA DE ENDEREÇO, e não é esquecimento (spec §3.2): busca
 *  traria de fora um ponto que ninguém conferiu. A cidade que o servidor busca
 *  é só onde a câmera começa (`src/lib/vista-do-mapa.ts`). Nem GPS: o dono
 *  bloqueia localização por padrão.
 *
 *  🔴 PIXEL DE TELA NÃO É PIXEL DE LAYOUT. O pin é posicionado em pixels de
 *  layout da caixa (`MAPA_LARGURA_PX` × `MAPA_ALTURA_PX`, no zoom da VISTA), e o
 *  ponteiro chega em pixels de TELA. A conversão é pela caixa que a tela de fato
 *  desenhou (`getBoundingClientRect`), e o `centro`, o `z` e o tamanho passados
 *  a `coordDaPosicao` são EXATAMENTE os do `posicaoNaCaixa` que põe o pin. O
 *  MOSAICO é desenhado em `zoomDeTiles(z)` reduzido por `1/MAPA_ESCALA` — a mesma
 *  geometria por outro caminho; há teste conferindo, pela URL dos tiles, que o
 *  ponto gravado cai no mosaico sob o pin, também depois de mexer na vista.
 *
 *  🔴 O PIN FICA PRESO À PARTE VISÍVEL. No celular a caixa de 480px é mais larga
 *  que a tela e a moldura corta a sobra; o pin arrastado é limitado à interseção
 *  da caixa com a moldura (os dois `getBoundingClientRect`).
 *
 *  🔴 TILES SÓ DA VISTA ATUAL (M6, a Tile Usage Policy do OSM): cada vista pede
 *  os tiles que ela mostra, quando ela muda — nenhum pré-carregamento, nenhum
 *  cache novo. E o service worker não os guarda no cache offline da ficha
 *  pública (`src/app/sw.ts`, I7 da auditoria).
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: a coordenada e a vista
 *  vêm da prop; as frases fixas servem a todo lugar, e o crédito do OSM é
 *  licença. */

type Par = { lat: number; lng: number };
type Vista = { centro: Par; z: number };

/** A ajuda da coordenada ainda sem ponto: o mapa nasce sem pin, e é o toque
 *  dele que o põe. Na linha da `DICA_DO_PONTO_NOVO` do `EditorWaypoints`. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const MARQUE_NO_MAPA = "Toque no mapa onde fica o ponto. Depois, arraste o pin pra acertar.";

/** O portão do Salvar (C1): o pin foi posto com a vista afastada, e a vista
 *  ainda está afastada. Trocada na onda de fix da 11f (C-1): a anterior,
 *  "Aproxime o mapa (+) pra poder salvar.", ensinava o furo — aproximar sem
 *  tocar de novo salvava o toque de longe. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const APROXIME_PRA_SALVAR = "Aproxime o mapa (+) e toque de novo no ponto pra poder salvar.";

/** O portão do Salvar (C-1 da revisão da 11f): a vista já está perto, mas o pin
 *  foi posto de longe — falta o toque (ou o arrasto) de perto. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const TOQUE_DE_PERTO = "O pin foi posto de longe: toque de novo no ponto, ou arraste o pin, pra poder salvar.";

/** O portão do Salvar (C-1 da revisão da 11f): o pin saiu da parte visível do
 *  mapa (arrastando o fundo), e ninguém grava o que não está vendo. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PIN_FORA_DA_VISTA = "O pin saiu do mapa: arraste o mapa até ele, ou toque no ponto, pra poder salvar.";

/** A vista caiu no acervo: a cidade do lugar não foi achada (ou o serviço não
 *  respondeu), e o mapa começa na região dos lugares do app. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const VISTA_SEM_CIDADE = "Não achei a cidade no mapa: ele começa na região dos lugares do app.";

/** A vista caiu no acervo porque a cidade foi achada MAIS DE UMA VEZ em
 *  Pernambuco e não há como saber qual é (I-2 da revisão da 11f): "não achei"
 *  seria falso. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const VISTA_CIDADE_AMBIGUA = "Achei mais de um lugar com o nome dessa cidade: o mapa começa na região dos lugares do app.";

/** Sem ponto e sem vista nenhuma (cidade não achada E acervo vazio — impossível
 *  hoje, mas com ramo, e não um número inventado). */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const SEM_VISTA = "Sem mapa: não achei de onde começar.";

/** Os nomes do + e do − pra quem lê a tela em voz alta (o glifo sozinho não é
 *  nome). Os glifos "+" e "−" são o desenho do botão. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const APROXIMAR = "Aproximar o mapa";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const AFASTAR = "Afastar o mapa";

/** 🔴 FINITOS, não só `number` (onda 1 da Task 8, R3): `NaN` e `Infinity` são
 *  `typeof "number"`, e com `lng: Infinity` o laço de `tilesParaCaixa` nunca
 *  termina. Fora de forma, o valor não é ponto — e o mosaico nunca sai dele:
 *  sai da VISTA. */
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

/** O índice do ponto do trajeto de uma linha `.lat`, ou `null` (o par da chuva). */
function indiceDe(campo: CampoNaTela): number | null {
  if (campo.ponto) return campo.ponto.indice;
  const m = /\.(\d+)\.lat$/.exec(campo.caminho);
  return m ? Number(m[1]) : null;
}

export default function EditorCoordenada({ campo, valor, slug }: PropsDoEditor) {
  // A metade `.lng`: só o número. O pin dela mora na linha `.lat`.
  if (campo.caminho.endsWith(".lng")) {
    return (
      <div className="adm-editor" data-editor={campo.caminho}>
        <p className="adm-editor-coord" data-testid="coord-atual">
          {typeof valor === "number" && Number.isFinite(valor) ? String(valor) : ""}
        </p>
      </div>
    );
  }
  const ponto: Par | null = ehPar(valor)
    ? valor
    : campo.ponto && ehPar(campo.ponto)
      ? { lat: campo.ponto.lat, lng: campo.ponto.lng }
      : null;
  // Com ponto, o mapa começa NELE, no zoom de pôr o pin. Sem ponto, na vista do
  // servidor — e sem nenhuma das duas, não há mapa.
  const vista: VistaNaTela | null = ponto ? { centro: ponto, z: MAPA_ZOOM_EDITOR, origem: "ponto" } : (campo.vista ?? null);
  if (vista === null) {
    return (
      <div className="adm-editor" data-editor={campo.caminho}>
        <p className="adm-editor-ajuda">{SEM_VISTA}</p>
        <p className="adm-editor-coord" data-testid="coord-atual" />
      </div>
    );
  }
  return <ComMapa campo={campo} slug={slug} indice={indiceDe(campo)} inicial={ponto} vistaInicial={vista} />;
}

const entre = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** O gesto em curso: o ponteiro que o começou, onde ele encostou (TELA), e o que
 *  ele está movendo. `fundo.longe` vira verdade quando o dedo passa de
 *  `TOQUE_MAX_PX` — daí em diante é arrasto da vista, e soltar não põe pin. */
type Gesto =
  | { tipo: "pin"; id: number; x0: number; y0: number; pinX: number; pinY: number }
  | { tipo: "fundo"; id: number; x0: number; y0: number; vista: Vista; longe: boolean };

/** A geometria da caixa NA TELA: o rect dela e a parte VISÍVEL (a interseção
 *  com a moldura), já em pixels de LAYOUT. `null` se a caixa não tem tamanho ou
 *  não aparece. */
function medir(el: HTMLElement) {
  const caixa = el.getBoundingClientRect();
  const moldura = (el.parentElement ?? el).getBoundingClientRect();
  if (!(caixa.width > 0) || !(caixa.height > 0)) return null;
  const esq = Math.max(caixa.left, moldura.left);
  const dir = Math.min(caixa.right, moldura.right);
  const topo = Math.max(caixa.top, moldura.top);
  const base = Math.min(caixa.bottom, moldura.bottom);
  if (!(dir > esq) || !(base > topo)) return null;
  const kx = L / caixa.width;
  const ky = A / caixa.height;
  return {
    caixa,
    kx,
    ky,
    /** A parte visível, em pixels de layout. */
    visivel: {
      esq: (esq - caixa.left) * kx,
      dir: (dir - caixa.left) * kx,
      topo: (topo - caixa.top) * ky,
      base: (base - caixa.top) * ky,
    },
  };
}

/** O MAPA QUE ANDA E O PIN QUE SE PÕE — a parte deste editor que desenha mosaico
 *  e pin e traduz o dedo em vista e em coordenada. Exportado (Tarefa 10, onda de
 *  conserto 1) pra o `EditorWaypoints` marcar o ponto NOVO no MESMO mapa.
 *
 *  CONTROLADO: não guarda coordenada nem vista. Quem chama guarda `atual` (o pin,
 *  ou `null` antes do primeiro toque) e `vista`, e recebe cada pin novo por
 *  `aoMover` (já arredondado a seis casas, e com o ZOOM DA VISTA em que o gesto
 *  o pôs — é por ele que o portão do Salvar decide) e cada vista nova por
 *  `aoMudarVista`. Mexer na vista NUNCA chama `aoMover`. Depois de cada
 *  desenho, `aoVerPin` diz se o pin está na parte VISÍVEL do mapa. */
export function MapaDoPin({
  vista,
  atual,
  aoMover,
  aoMudarVista,
  aoVerPin,
}: {
  vista: Vista;
  atual: Par | null;
  aoMover: (par: Par, zDoGesto: number) => void;
  aoMudarVista: (vista: Vista) => void;
  aoVerPin: (visivel: boolean) => void;
}) {
  const gesto = useRef<Gesto | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const { centro, z } = vista;
  // A janela muda de largura (o celular gira) e a moldura corta outra fatia:
  // redesenha pra medir de novo.
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener("resize", redesenhar);
    return () => window.removeEventListener("resize", redesenhar);
  }, []);

  // O mosaico é o MESMO do `MapaEstatico`: tiles de um zoom a mais desenhados em
  // 1/MAPA_ESCALA, centrados na VISTA. O pin vive em pixels de layout no zoom da
  // vista. Só os tiles desta vista: nada é pedido antes de ela existir.
  const tiles = tilesParaCaixa(centro, zoomDeTiles(z), L * MAPA_ESCALA, A * MAPA_ESCALA);
  const pin = atual ? posicaoNaCaixa(atual, centro, z, L, A) : null;

  // 🔴 O PIN ESTÁ À VISTA? (C-1 da revisão da 11f, regra c). Medido DEPOIS de
  // cada desenho, contra a parte visível (a mesma de `medir`). Sem caixa medível
  // (nada desenhado ainda), a régua é a caixa de layout inteira.
  useLayoutEffect(() => {
    const el = caixaRef.current;
    const v = (el ? medir(el)?.visivel : undefined) ?? { esq: 0, dir: L, topo: 0, base: A };
    aoVerPin(pin !== null && pin.left >= v.esq && pin.left <= v.dir && pin.top >= v.topo && pin.top <= v.base);
  });

  /** Um ponto da caixa (layout) vira coordenada — preso à parte visível. */
  function porNoLayout(x: number, y: number, v: NonNullable<ReturnType<typeof medir>>["visivel"]): void {
    const c = coordDaPosicao(entre(x, v.esq, v.dir), entre(y, v.topo, v.base), centro, z, L, A);
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    aoMover({ lat: seisCasas(c.lat), lng: seisCasas(c.lng) }, z);
  }

  /** Um degrau de zoom. COM PIN, em volta DELE: o centro novo é o que deixa o
   *  pin no mesmo pixel da caixa — numa vista centrada no pin, no zoom novo,
   *  ele fica em (L − pin.left, A − pin.top). Sem pin, em volta do centro. */
  function zoomPara(zNovo: number): void {
    aoMudarVista({ centro: atual && pin ? coordDaPosicao(L - pin.left, A - pin.top, atual, zNovo, L, A) : centro, z: zNovo });
  }

  function encostar(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0 || e.isPrimary === false || gesto.current !== null) return;
    const g = medir(e.currentTarget);
    if (!g) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (pin) {
      // O meio da gota VISÍVEL, em pixels de TELA.
      const gx = g.caixa.left + pin.left / g.kx;
      const gy = g.caixa.top + (pin.top - GOTA_ACIMA_DA_PONTA_PX) / g.ky;
      if (Math.hypot(e.clientX - gx, e.clientY - gy) <= RAIO_ALVO_TOQUE_PX) {
        gesto.current = { tipo: "pin", id: e.pointerId, x0: e.clientX, y0: e.clientY, pinX: pin.left, pinY: pin.top };
        return;
      }
    }
    gesto.current = { tipo: "fundo", id: e.pointerId, x0: e.clientX, y0: e.clientY, vista, longe: false };
  }

  function mover(e: PointerEvent<HTMLDivElement>): void {
    const atualGesto = gesto.current;
    if (atualGesto === null || atualGesto.id !== e.pointerId) return;
    const g = medir(e.currentTarget);
    if (!g) return;
    const dx = e.clientX - atualGesto.x0;
    const dy = e.clientY - atualGesto.y0;
    if (atualGesto.tipo === "pin") {
      // O pin anda o DESLOCAMENTO do dedo, nunca salta pra ele.
      porNoLayout(atualGesto.pinX + dx * g.kx, atualGesto.pinY + dy * g.ky, g.visivel);
      return;
    }
    if (!atualGesto.longe && Math.hypot(dx, dy) <= TOQUE_MAX_PX) return;
    atualGesto.longe = true;
    // O fundo vai junto do dedo: o centro novo é o ponto que estava a (−dx, −dy)
    // do centro, na vista de quando o dedo encostou.
    const v0 = atualGesto.vista;
    const c = coordDaPosicao(L / 2 - dx * g.kx, A / 2 - dy * g.ky, v0.centro, v0.z, L, A);
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    aoMudarVista({ centro: c, z: v0.z });
  }

  function soltar(e: PointerEvent<HTMLDivElement>): void {
    const g0 = gesto.current;
    if (g0 === null || g0.id !== e.pointerId) return;
    gesto.current = null;
    // TOQUE: encostou no fundo e soltou sem andar. O pin vai pra onde soltou.
    if (g0.tipo === "fundo" && !g0.longe && Math.hypot(e.clientX - g0.x0, e.clientY - g0.y0) <= TOQUE_MAX_PX) {
      const g = medir(e.currentTarget);
      if (!g) return;
      porNoLayout((e.clientX - g.caixa.left) * g.kx, (e.clientY - g.caixa.top) * g.ky, g.visivel);
    }
  }

  return (
    <div className="adm-editor-mapa" style={{ height: A }}>
      <div
        ref={caixaRef}
        className="adm-editor-mapa-caixa"
        data-testid="mapa-escolher"
        style={{ width: L, height: A, marginLeft: -L / 2 }}
        onPointerDown={encostar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={(e) => {
          // O navegador tomou o gesto (rolagem, um segundo dedo): nada acontece.
          if (gesto.current?.id === e.pointerId) gesto.current = null;
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
        {pin && (
          <span
            className="adm-editor-mapa-pin"
            data-pin=""
            aria-hidden="true"
            style={{ left: pin.left, top: pin.top }}
          />
        )}
      </div>
      {/* Fora da caixa: o dedo no + e no − não é gesto do mapa. O limite é o
          `disabled` — um botão desligado não dispara clique, e uma segunda trava
          no clique seria uma porta em série que nenhum teste distingue. */}
      <div className="adm-editor-mapa-zoom">
        <button
          type="button"
          className="adm-editor-mapa-zoom-botao"
          aria-label={APROXIMAR}
          disabled={z >= MAPA_ZOOM_EDITOR_MAX}
          onClick={() => zoomPara(z + 1)}
        >
          +
        </button>
        <button
          type="button"
          className="adm-editor-mapa-zoom-botao"
          aria-label={AFASTAR}
          disabled={z <= MAPA_ZOOM_EDITOR_MIN}
          onClick={() => zoomPara(z - 1)}
        >
          −
        </button>
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
  );
}

/** Perto o bastante pra o dedo não errar por quilômetros (C1). */
export const pertoPraSalvar = (z: number): boolean => z >= MAPA_ZOOM_EDITOR;

/** 🔴 O PORTÃO DO SALVAR (C1; refeito na onda de fix da 11f, C-1 da revisão):
 *  `null` quando o pin pode ser salvo, ou a ajuda que diz o que falta. Uma
 *  regra só pra quem tem pin (o `EditorCoordenada` com pin e o ponto novo do
 *  `EditorWaypoints`):
 *   (a) o pin vale pelo zoom do último gesto que o PÔS ou MOVEU — posto de
 *       longe, só se salva depois de tocado ou arrastado de perto;
 *   (c) pin fora da parte visível do mapa não se salva.
 *  Aproximar a vista não muda o zoom do pin: é isso que fecha o furo. */
export function portaoDoSalvar(p: { zDoPin: number; zDaVista: number; pinAVista: boolean }): string | null {
  if (!pertoPraSalvar(p.zDoPin)) return pertoPraSalvar(p.zDaVista) ? TOQUE_DE_PERTO : APROXIME_PRA_SALVAR;
  return p.pinAVista ? null : PIN_FORA_DA_VISTA;
}

function ComMapa({
  campo,
  slug,
  indice,
  inicial,
  vistaInicial,
}: {
  campo: CampoNaTela;
  slug: string;
  /** O índice do ponto do trajeto, ou `null` pro par `condicao.coords`. */
  indice: number | null;
  /** O ponto que o documento tem, ou `null` (o mapa nasce sem pin). */
  inicial: Par | null;
  vistaInicial: VistaNaTela;
}) {
  const [atual, setAtual] = useState<Par | null>(inicial);
  // O ponto que o documento já tem conta como posto de perto: é o ponto que
  // está lá, e regravá-lo sem mexer é o dono afirmando ele.
  const [zDoPin, setZDoPin] = useState(MAPA_ZOOM_EDITOR);
  const [pinAVista, setPinAVista] = useState(true);
  const [vista, setVista] = useState<Vista>({ centro: vistaInicial.centro, z: vistaInicial.z });
  const { erro, salvando, gravar } = usarGravacao();
  const ajudaDoPortao = portaoDoSalvar({ zDoPin, zDaVista: vista.z, pinAVista });

  function mover(par: Par, zDoGesto: number): void {
    setAtual(par);
    setZDoPin(zDoGesto);
  }

  function salvar(par: Par): void {
    if (indice !== null) {
      void gravar({ slug, ponto: indice, lat: par.lat, lng: par.lng });
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: par });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <MapaDoPin vista={vista} atual={atual} aoMover={mover} aoMudarVista={setVista} aoVerPin={setPinAVista} />
      <p className="adm-editor-coord" data-testid="coord-atual" aria-live="polite">
        {atual ? `${atual.lat}, ${atual.lng}` : ""}
      </p>
      {/* 🔴 AS AJUDAS MORAM EMBAIXO DO MAPA, nunca em cima: elas somem com o
          primeiro toque, e uma linha que some EM CIMA do mapa o faria pular
          ~45px pra cima debaixo do dedo dele (medido no Chrome em 375×667). */}
      {atual === null && vistaInicial.origem === "acervo" && <p className="adm-editor-ajuda">{VISTA_SEM_CIDADE}</p>}
      {atual === null && vistaInicial.origem === "cidade-ambigua" && (
        <p className="adm-editor-ajuda">{VISTA_CIDADE_AMBIGUA}</p>
      )}
      {atual === null && <p className="adm-editor-ajuda">{MARQUE_NO_MAPA}</p>}
      {atual !== null && ajudaDoPortao !== null && <p className="adm-editor-ajuda">{ajudaDoPortao}</p>}
      {/* 🔴 SEM PIN NÃO HÁ SALVAR: nada aqui grava a vista. */}
      {atual !== null && (
        <button
          type="button"
          className="adm-editor-salvar"
          data-salvar={campo.caminho}
          disabled={salvando || ajudaDoPortao !== null}
          onClick={() => salvar(atual)}
        >
          {salvando ? SALVANDO : SALVAR}
        </button>
      )}
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
