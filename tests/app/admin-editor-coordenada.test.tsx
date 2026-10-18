import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira, { precisaDeVista } from "@/app/admin/FichaInteira";
import { ERRO_GRAVAR, PortaDoEditor } from "@/app/admin/campos/gravar";
import {
  BUSCAR,
  BUSCA_NAO_SAIU,
  CIDADE_DEPOIS_DE_SALVAR,
  NENHUM_ACHADO,
  ROTULO_DA_BUSCA,
  SALVAR,
} from "@/app/admin/campos/palavras";
import EditorCoordenada, {
  AFASTAR,
  APROXIMAR,
  APROXIME_PRA_SALVAR,
  EM_CIDADE,
  MARQUE_NO_MAPA,
  PIN_FORA_DA_VISTA,
  SEM_VISTA,
  TOQUE_DE_PERTO,
  VISTA_CIDADE_AMBIGUA,
  VISTA_SEM_CIDADE,
} from "@/app/admin/campos/EditorCoordenada";
import type { VistaNaTela } from "@/app/admin/campos/tipos";
import { TETO_DA_BUSCA } from "@/lib/nominatim";
import {
  GOTA_ACIMA_DA_PONTA_PX,
  MAPA_ALTURA_PX,
  MAPA_ESCALA,
  MAPA_LARGURA_PX,
  MAPA_ZOOM_EDITOR,
  MAPA_ZOOM_EDITOR_MAX,
  MAPA_ZOOM_EDITOR_MIN,
  TILE_PX,
  coordDaPosicao,
  tilesParaCaixa,
  urlTile,
  zoomDeTiles,
} from "@/lib/mapa";
import { camposDaFicha } from "@/lib/campos-da-ficha";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao } from "../banco";

/** O MAPA QUE ARRASTA O PIN (Task 8, 2026-10-01) — o editor da espécie `coord`.
 *
 *  🔴 TODO CASO RENDERIZA A `FichaInteira` INTEIRA e mede DENTRO do bloco do
 *  campo (A3 da auditoria): o plano escrevia `<EditorCoordenada
 *  campo={campoPorCaminho(...)!} …>`, que não compila (`CampoDaFicha` ≠
 *  `CampoNaTela`) e, se compilasse, esconderia defeito de FIAÇÃO — o par do
 *  ponto do trajeto é montado no SERVIDOR, e é o servidor que tem de ser medido.
 *
 *  🔴 A ESPÉCIE TEM DUAS FORMAS (A1): `condicao.coords` é o PAR `{lat,lng}`;
 *  `trajeto.waypoints.N.lat` e `.lng` são METADES. A linha `.lat` ganha o mapa
 *  (com o pin no par daquele ponto) e grava o ponto INTEIRO num `PUT` só, pela
 *  forma `{slug, ponto, lat, lng}` da porta (onda de conserto 1, R1 — antes
 *  eram dois `PUT`s em série, e uma falha no meio publicava um ponto que ninguém
 *  escolheu); a linha `.lng` mostra só o número — dois mapas pro mesmo ponto
 *  seriam duas fontes.
 *
 *  🔴 O PONTEIRO É DISPARADO COMO `MouseEvent` DE TIPO `pointer*`, e não por
 *  `fireEvent.pointerDown`, e isso foi MEDIDO (A5): o jsdom 25 deste repositório
 *  não tem `PointerEvent` (`typeof window.PointerEvent === "undefined"`), e o
 *  `fireEvent.pointerDown` cai no `Event` cru, que JOGA FORA `clientX`/`clientY`.
 *  O React escuta o TIPO `pointerdown` e lê `clientX` do evento nativo, então um
 *  `MouseEvent("pointerdown", {clientX})` chega inteiro. Quem prova que os
 *  números chegam é o caso de DIREÇÃO E FINITUDE ("arrastar pra CIMA aumenta a
 *  latitude…"): com os números perdidos o pin não sai do lugar e ele fica
 *  vermelho. (Esta frase citava um caso "o ponteiro chega com os números" que
 *  nunca existiu — achado da revisão, M5.)
 *
 *  🔴 A CAIXA NA TELA TEM METADE DO TAMANHO DE LAYOUT (A7). O
 *  `getBoundingClientRect` é dublado com 240×100 pra uma caixa de layout de
 *  480×200: um editor que usasse o pixel de TELA como pixel de layout poria o
 *  pin no lugar errado, e a conta exata abaixo fica vermelha.
 *
 *  🔴 E SÃO DUAS CAIXAS DUBLADAS, não uma (onda 1, R6): a caixa de LAYOUT (onde
 *  o ponteiro é convertido) e a MOLDURA que a corta (a parte que o dono vê). O
 *  pin fica preso à interseção das duas — no celular a caixa de 480px é maior
 *  que a tela, e um pin na parte cortada seria um pin invisível. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

await bancoDeProducao();
const ACERVO = await getAllFichas();

function exigir(slug: string): Ficha {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
}

const FICHA = exigir("rampa-do-pepe");
const PAR = "condicao.coords";
const LAT0 = "trajeto.waypoints.0.lat";
const LNG0 = "trajeto.waypoints.0.lng";

const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;

/** A caixa como a TELA a desenha: metade da largura e da altura de layout, e
 *  deslocada da origem — os dois erros de conversão (escala e origem) aparecem. */
const RECT = { left: 10, top: 20, width: L / 2, height: A / 2 };
const ESCALA_TELA = L / RECT.width; // 2

/** O alvo do arrasto, em pixels de LAYOUT: pra DIREITA e pra CIMA do centro. */
const ALVO = { x: 360, y: 40 };
const naTela = (p: { x: number; y: number }) => ({
  clientX: RECT.left + p.x / ESCALA_TELA,
  clientY: RECT.top + p.y / ESCALA_TELA,
});

const bloco = (caminho: string): HTMLElement => screen.getByTestId(`campo-${caminho}`);
const mapaEm = (caminho: string): HTMLElement | null =>
  bloco(caminho).querySelector('[data-testid="mapa-escolher"]');
const atualEm = (caminho: string): string =>
  bloco(caminho).querySelector('[data-testid="coord-atual"]')!.textContent ?? "";
const pinEm = (caminho: string): HTMLElement => bloco(caminho).querySelector("[data-pin]") as HTMLElement;

/** O número que a tela MOSTRA, lido de volta. Exige os dois e exige finitos. */
function lido(caminho: string): { lat: number; lng: number } {
  const m = /^(-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)$/.exec(atualEm(caminho));
  expect(m, `"${atualEm(caminho)}" não é "lat, lng" em número`).not.toBeNull();
  const c = { lat: Number(m![1]), lng: Number(m![2]) };
  expect(Number.isFinite(c.lat) && Number.isFinite(c.lng), "número não finito na tela").toBe(true);
  return c;
}

type Caixa = { left: number; top: number; width: number; height: number };
function dublarRect(el: HTMLElement, r: Caixa = RECT): void {
  el.getBoundingClientRect = () =>
    ({
      ...r,
      x: r.left,
      y: r.top,
      right: r.left + r.width,
      bottom: r.top + r.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** A caixa de layout E a moldura visível. Por padrão as duas são o `RECT` (a
 *  moldura mostra a caixa inteira). */
function dublarCaixas(mapa: HTMLElement, caixa: Caixa = RECT, moldura: Caixa = caixa): void {
  dublarRect(mapa, caixa);
  dublarRect(mapa.parentElement!, moldura);
}

const ponteiro = (el: HTMLElement, tipo: string, p: { clientX: number; clientY: number }): void => {
  fireEvent(el, new MouseEvent(tipo, { bubbles: true, cancelable: true, ...p }));
};

/** Encosta no centro da caixa e arrasta até `ALVO`, soltando lá. */
function arrastar(caminho: string): void {
  const mapa = mapaEm(caminho)!;
  dublarCaixas(mapa);
  ponteiro(mapa, "pointerdown", naTela({ x: L / 2, y: A / 2 }));
  ponteiro(mapa, "pointermove", naTela({ x: (L / 2 + ALVO.x) / 2, y: (A / 2 + ALVO.y) / 2 }));
  ponteiro(mapa, "pointermove", naTela(ALVO));
  ponteiro(mapa, "pointerup", naTela(ALVO));
}

const salvar = (caminho: string): void => {
  fireEvent.click(within(bloco(caminho)).getByRole("button", { name: SALVAR }));
};

type Chamada = [string, { method: string; body: string }];
function comRota(responder: (n: number) => Promise<Response> = () => Promise.resolve(Response.json({ id: 1 }))) {
  let n = 0;
  const fetchFalso = vi.fn((_url: string, _init: { method: string; body: string }) => responder(n++));
  vi.stubGlobal("fetch", fetchFalso);
  const reloadFalso = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
  return { fetchFalso, reloadFalso };
}
const corpos = (f: ReturnType<typeof comRota>["fetchFalso"]) =>
  (f.mock.calls as Chamada[]).map((c) => ({ url: c[0], metodo: c[1].method, corpo: JSON.parse(c[1].body) }));

/** A coordenada que o ALVO tem de virar, pela função pura — com o centro do
 *  mapa sendo o valor que está no banco. */
const esperado = (centro: { lat: number; lng: number }) =>
  coordDaPosicao(ALVO.x, ALVO.y, centro, MAPA_ZOOM_EDITOR, L, A);

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — o par `condicao.coords`", () => {
  it("abre mostrando a coordenada do banco em número, lat E lng, pra ele conferir", () => {
    render(<FichaInteira ficha={FICHA} />);
    expect(atualEm(PAR)).toMatch(/^-?\d+\.\d{3,}, -?\d+\.\d{3,}$/);
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
  });

  it("o pin nasce no centro da caixa: o mapa é centrado no ponto que está no banco", () => {
    render(<FichaInteira ficha={FICHA} />);
    expect(pinEm(PAR).style.left).toBe(`${L / 2}px`);
    expect(pinEm(PAR).style.top).toBe(`${A / 2}px`);
  });

  // A5: sem isto, o atalho `fireEvent.pointerDown` (que perde `clientX` no
  // jsdom) deixaria todos os casos de arrasto medindo NaN — e "o texto mudou"
  // passaria com NaN.
  it("arrastar pra CIMA aumenta a latitude e pra DIREITA aumenta a longitude, e os dois são finitos", () => {
    render(<FichaInteira ficha={FICHA} />);
    const antes = lido(PAR);
    arrastar(PAR);
    const depois = lido(PAR);
    expect(depois.lat, "arrastou pra cima e a latitude não subiu").toBeGreaterThan(antes.lat);
    expect(depois.lng, "arrastou pra direita e a longitude não subiu").toBeGreaterThan(antes.lng);
  });

  // A7: a caixa na tela tem METADE do tamanho de layout. O número tem de ser o
  // do ponto de LAYOUT, exato — e o pin tem de ir pra lá.
  it("o ponteiro é convertido pela caixa que a TELA desenhou (rect), não pela de layout", () => {
    render(<FichaInteira ficha={FICHA} />);
    arrastar(PAR);
    const e = esperado(FICHA.condicao.coords);
    const c = lido(PAR);
    expect(c.lat).toBeCloseTo(e.lat, 6);
    expect(c.lng).toBeCloseTo(e.lng, 6);
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(ALVO.x, 0);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(ALVO.y, 0);
  });

  // A4: o plano tinha este caso com o corpo vazio — passava com qualquer código.
  it("só grava quando o dono confirma — arrastar sozinho não chama a rota", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    arrastar(PAR);
    expect(lido(PAR), "o arrasto não moveu nada: o caso mediria o vazio").not.toEqual(FICHA.condicao.coords);
    expect(fetchFalso, "arrastar gravou sem o dono confirmar").not.toHaveBeenCalled();
    // E o dublê está de pé: o Salvar, sim, chama.
    salvar(PAR);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  // A6: sem isto, "salvar manda a coordenada ANTIGA" sobrevive.
  it("salvar manda a coordenada NOVA — a mesma que a tela mostra — num PUT só", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    arrastar(PAR);
    const mostrado = lido(PAR);
    salvar(PAR);
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([
      { url: "/api/admin/ficha", metodo: "PUT", corpo: { slug: FICHA.slug, campo: PAR, valor: mostrado } },
    ]);
    expect(mostrado).not.toEqual(FICHA.condicao.coords);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — as metades de um ponto do trajeto", () => {
  it("o acervo tem ponto de trajeto pra medir", () => {
    expect(FICHA.trajeto.waypoints.length).toBeGreaterThan(0);
  });

  it("UM mapa por ponto do trajeto: na linha da latitude, nunca na da longitude", () => {
    let pontos = 0;
    for (const f of ACERVO) {
      const { container, unmount } = render(<FichaInteira ficha={f} />);
      f.trajeto.waypoints.forEach((_, i) => {
        expect(mapaEm(`trajeto.waypoints.${i}.lat`), `ponto ${i} de ${f.slug} sem mapa`).not.toBeNull();
        expect(mapaEm(`trajeto.waypoints.${i}.lng`), `ponto ${i} de ${f.slug} com DOIS mapas`).toBeNull();
        pontos++;
      });
      // e a conta da tela inteira: o par + um por ponto, nem mais nem menos
      expect(container.querySelectorAll('[data-testid="mapa-escolher"]').length).toBe(
        1 + f.trajeto.waypoints.length,
      );
      unmount();
    }
    expect(pontos, "nenhum ponto medido: o caso ficaria oco").toBeGreaterThan(0);
  });

  it("a linha da longitude mostra o número dela, sem mapa e sem botão — e ainda é editor", () => {
    render(<FichaInteira ficha={FICHA} />);
    const el = bloco(LNG0);
    expect(el.querySelector(`[data-editor="${LNG0}"]`)).not.toBeNull();
    expect(atualEm(LNG0)).toBe(String(FICHA.trajeto.waypoints[0].lng));
    expect(within(el).queryByRole("button")).toBeNull();
  });

  it("o mapa do ponto abre no par DAQUELE ponto (montado no servidor), não no da chuva", () => {
    for (const f of ACERVO) {
      const { unmount } = render(<FichaInteira ficha={f} />);
      f.trajeto.waypoints.forEach((wp, i) => {
        expect(lido(`trajeto.waypoints.${i}.lat`)).toEqual({ lat: wp.lat, lng: wp.lng });
      });
      unmount();
    }
    // 🔴 E A PROVA NÃO PODE SER VÁCUA, e no acervo de hoje ela seria: MEDIDO,
    // nas três fichas o ponto 0 é exatamente a coordenada da chuva, então um
    // servidor que mandasse `condicao.coords` como par do ponto passaria verde
    // no laço de cima. A ficha abaixo é a real com o ponto 0 deslocado.
    const wp = FICHA.trajeto.waypoints[0];
    const deslocado = { ...wp, lat: wp.lat + 0.01, lng: wp.lng - 0.01 };
    const outra: Ficha = { ...FICHA, trajeto: { ...FICHA.trajeto, waypoints: [deslocado, ...FICHA.trajeto.waypoints.slice(1)] } };
    render(<FichaInteira ficha={outra} />);
    expect(lido(LAT0)).toEqual({ lat: deslocado.lat, lng: deslocado.lng });
    expect(lido(LAT0)).not.toEqual(outra.condicao.coords);
  });

  // 🔴 R1 DA ONDA 1: UM `PUT`, com o ponto inteiro. O teste anterior provava
  // dois `PUT`s em série — a ruling que a revisão derrubou.
  it("arrastar no ponto do trajeto não grava; salvar grava o ponto INTEIRO num PUT só, com a coordenada nova", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    arrastar(LAT0);
    expect(fetchFalso, "arrastar gravou sem o dono confirmar").not.toHaveBeenCalled();
    const mostrado = lido(LAT0);
    const wp = FICHA.trajeto.waypoints[0];
    const e = esperado({ lat: wp.lat, lng: wp.lng });
    expect(mostrado.lat).toBeCloseTo(e.lat, 6);
    expect(mostrado.lng).toBeCloseTo(e.lng, 6);

    salvar(LAT0);
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)).toEqual([
      { url: "/api/admin/ficha", metodo: "PUT", corpo: { slug: FICHA.slug, ponto: 0, lat: mostrado.lat, lng: mostrado.lng } },
    ]);
  });

  it("se o PUT do ponto falhar, a tela diz que não salvou e não recarrega", async () => {
    const { fetchFalso, reloadFalso } = comRota(() => Promise.resolve(new Response("", { status: 500 })));
    render(<FichaInteira ficha={FICHA} />);
    arrastar(LAT0);
    salvar(LAT0);
    expect((await within(bloco(LAT0)).findByRole("alert")).textContent).toBe(ERRO_GRAVAR);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(reloadFalso).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — o que ele NÃO tem", () => {
  // A4: o plano tinha este caso sem render — `screen` vazio passa sempre.
  it("NÃO tem caixa de busca de endereço em linha `coord` nenhuma", () => {
    render(<FichaInteira ficha={FICHA} />);
    const coords = camposDaFicha(FICHA).filter((c) => c.especie === "coord");
    expect(coords.length, "nenhum campo `coord`: o caso ficaria oco").toBeGreaterThanOrEqual(3);
    expect(mapaEm(PAR), "o mapa não está na tela: o caso mediria o vazio").not.toBeNull();
    for (const c of coords) {
      const el = within(bloco(c.caminho));
      expect(el.queryByRole("searchbox"), c.caminho).toBeNull();
      expect(el.queryByRole("textbox"), c.caminho).toBeNull();
      expect(el.queryByPlaceholderText(/buscar|endereço|procurar/i), c.caminho).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ONDA DE CONSERTO 1 (R4, achado I1 da revisão): O PIN E O MOSAICO NA MESMA
// GEOMETRIA. O dono põe o pin EM CIMA DO QUE VÊ (a entrada da trilha, a ponte);
// se o mosaico desalinhar do pin, a coordenada gravada é outra e ninguém nota.
// Duas mutações sobreviviam à suíte inteira: tiles com `scale(1)` e tiles no zoom
// do pin em vez do zoom dos tiles.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — o pin está em cima do mosaico", () => {
  /** Mercator na forma CLÁSSICA, `(1 − ln(tan φ + sec φ)/π)/2`, escrita aqui DE
   *  PROPÓSITO: o pin é posicionado por `posicaoNaCaixa` (que usa a forma em
   *  seno de `pontoNoMundo`), e uma prova que usasse a mesma função concordaria
   *  consigo mesma. */
  const mundo = (c: { lat: number; lng: number }, z: number) => {
    const n = TILE_PX * 2 ** z;
    const fi = (c.lat * Math.PI) / 180;
    return {
      x: ((c.lng + 180) / 360) * n,
      y: ((1 - Math.log(Math.tan(fi) + 1 / Math.cos(fi)) / Math.PI) / 2) * n,
    };
  };

  for (const caminho of [PAR, LAT0]) {
    it(`${caminho}: depois do arrasto, o número mostrado cai no mosaico exatamente sob o pin`, () => {
      render(<FichaInteira ficha={FICHA} />);
      arrastar(caminho);
      const c = lido(caminho);
      const caixa = mapaEm(caminho)!;
      const camada = caixa.querySelector(".adm-editor-mapa-tiles") as HTMLElement;
      const escala = Number(/scale\(([^)]+)\)/.exec(camada.style.transform)![1]);
      const imgs = [...camada.querySelectorAll("img")];
      expect(imgs.length, "nenhum tile desenhado: o caso mediria o vazio").toBeGreaterThan(0);
      // O zoom sai da URL do tile — o que o OSM de fato desenha.
      const z = Number(/\/(\d+)\/\d+\/\d+\.png$/.exec(imgs[0].getAttribute("src")!)![1]);
      const w = mundo(c, z);
      const tx = Math.floor(w.x / TILE_PX);
      const ty = Math.floor(w.y / TILE_PX);
      const img = imgs.find((i) => i.getAttribute("src")!.endsWith(`/${z}/${tx}/${ty}.png`));
      expect(img, `o ponto mostrado (${z}/${tx}/${ty}) não está em tile nenhum desenhado`).toBeDefined();
      const x = (parseFloat(img!.style.left) + (w.x - tx * TILE_PX)) * escala;
      const y = (parseFloat(img!.style.top) + (w.y - ty * TILE_PX)) * escala;
      const pin = pinEm(caminho);
      expect(Math.abs(x - parseFloat(pin.style.left)), "pin e mosaico desalinhados no eixo x").toBeLessThan(1);
      expect(Math.abs(y - parseFloat(pin.style.top)), "pin e mosaico desalinhados no eixo y").toBeLessThan(1);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ONDA 1, R6 (achados M1, M2, M6): o pin preso à parte VISÍVEL, e o pin que só
// anda com o dedo encostado.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — onde o pin pode ir, e quando", () => {
  /** O caso real do celular: a caixa de layout tem os 480px dela (rect.width ===
   *  L) e começa 60px à esquerda da moldura, que mostra só 360px. */
  const CAIXA = { left: -60, top: 20, width: L, height: A };
  const MOLDURA = { left: 0, top: 20, width: 360, height: A };
  const esperadoEm = (x: number, y: number) =>
    coordDaPosicao(x, y, FICHA.condicao.coords, MAPA_ZOOM_EDITOR, L, A);

  it("arrastar pra fora da tela prende o pin na borda VISÍVEL da caixa, nos dois lados e embaixo", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    dublarCaixas(mapa, CAIXA, MOLDURA);
    ponteiro(mapa, "pointerdown", { clientX: 180, clientY: 120 });

    ponteiro(mapa, "pointermove", { clientX: 1000, clientY: 120 });
    // borda direita VISÍVEL: clientX 360 → layout 360 − (−60) = 420, não 480
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(420, 1);
    let c = lido(PAR);
    expect(c.lat).toBeCloseTo(esperadoEm(420, 100).lat, 6);
    expect(c.lng).toBeCloseTo(esperadoEm(420, 100).lng, 6);

    ponteiro(mapa, "pointermove", { clientX: -500, clientY: 1000 });
    // borda esquerda visível: clientX 0 → layout 60; embaixo: layout 200
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(60, 1);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(A, 1);
    c = lido(PAR);
    expect(c.lat).toBeCloseTo(esperadoEm(60, A).lat, 6);
    expect(c.lng).toBeCloseTo(esperadoEm(60, A).lng, 6);
  });

  it("passar o ponteiro por cima SEM encostar não move o pin", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    dublarCaixas(mapa);
    ponteiro(mapa, "pointermove", naTela(ALVO));
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
  });

  for (const fim of ["pointerup", "pointercancel"]) {
    it(`depois de ${fim}, mover o ponteiro não move mais o pin`, () => {
      render(<FichaInteira ficha={FICHA} />);
      const mapa = mapaEm(PAR)!;
      dublarCaixas(mapa);
      ponteiro(mapa, "pointerdown", naTela({ x: L / 2, y: A / 2 }));
      ponteiro(mapa, fim, naTela({ x: L / 2, y: A / 2 }));
      ponteiro(mapa, "pointermove", naTela(ALVO));
      expect(lido(PAR)).toEqual(FICHA.condicao.coords);
    });
  }

  it("o botão direito do mouse não põe o pin", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    dublarCaixas(mapa);
    fireEvent(mapa, new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 2, ...naTela(ALVO) }));
    ponteiro(mapa, "pointermove", naTela(ALVO));
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 TAREFA 11f (pedido dele, 2026-10-04: "era bom ter um mapa e a pessoa
// arrastar para a localização correta"). O mapa ANDA: arrastar o FUNDO move a
// vista, o + e o − aproximam e afastam, e um TOQUE põe o pin. Os gestos são os
// da auditoria (I3): o alvo de pegar o pin é um círculo de `RAIO_ALVO_TOQUE_PX`
// (22px de TELA) em volta da GOTA visível; o pin anda o DESLOCAMENTO do dedo
// (sem salto); toque = soltar com até `TOQUE_MAX_PX` (8px de tela) andados.
// ═══════════════════════════════════════════════════════════════════════════

/** A gota do pin na TELA, com o pin no centro da caixa (onde ele nasce). */
const GOTA = naTela({ x: L / 2, y: A / 2 - GOTA_ACIMA_DA_PONTA_PX });

type NaTela = { clientX: number; clientY: number };

/** Um gesto inteiro em pixels de TELA: encosta em `de`, passa por `por`, solta no último. */
function gesto(caminho: string, de: NaTela, ...por: NaTela[]): void {
  const mapa = mapaEm(caminho)!;
  dublarCaixas(mapa);
  ponteiro(mapa, "pointerdown", de);
  for (const p of por) ponteiro(mapa, "pointermove", p);
  ponteiro(mapa, "pointerup", por.at(-1) ?? de);
}
const mais = (caminho: string): HTMLButtonElement => within(bloco(caminho)).getByRole("button", { name: APROXIMAR });
const menos = (caminho: string): HTMLButtonElement => within(bloco(caminho)).getByRole("button", { name: AFASTAR });
const salvarEm = (caminho: string): HTMLButtonElement | null =>
  bloco(caminho).querySelector<HTMLButtonElement>(`[data-salvar="${caminho}"]`);
/** O zoom que a tela DESENHA, lido da URL do primeiro tile. */
const zoomDosTiles = (caminho: string): number =>
  Number(/\/(\d+)\/\d+\/\d+\.png$/.exec(mapaEm(caminho)!.querySelector("img")!.getAttribute("src")!)![1]);

describe("EditorCoordenada — os gestos (Tarefa 11f, I3 da auditoria)", () => {
  it("pegar o pin pela BORDA da gota não o faz saltar: ele anda o deslocamento do dedo", () => {
    render(<FichaInteira ficha={FICHA} />);
    // 15px de tela à direita do meio da gota: dentro do alvo de 22px, longe da ponta
    const de = { clientX: GOTA.clientX + 15, clientY: GOTA.clientY };
    gesto(PAR, de, { clientX: de.clientX + 20, clientY: de.clientY + 10 });
    // 20×10 px de tela = 40×20 px de layout (a caixa na tela tem metade do tamanho)
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(L / 2 + 40, 1);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(A / 2 + 20, 1);
    const e = coordDaPosicao(L / 2 + 40, A / 2 + 20, FICHA.condicao.coords, MAPA_ZOOM_EDITOR, L, A);
    expect(lido(PAR).lat).toBeCloseTo(e.lat, 6);
    expect(lido(PAR).lng).toBeCloseTo(e.lng, 6);
  });

  it("dedo FORA do alvo do pin e arrastado: a VISTA anda (o pin vai junto do mapa), e o número não muda", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    // a 23px de tela da gota: fora do alvo, por um pixel
    const de = { clientX: GOTA.clientX - 23, clientY: GOTA.clientY };
    expect(Math.hypot(de.clientX - GOTA.clientX, de.clientY - GOTA.clientY)).toBeGreaterThan(22);
    gesto(
      PAR,
      de,
      { clientX: de.clientX + 25, clientY: de.clientY + 15 },
      { clientX: de.clientX + 50, clientY: de.clientY + 30 },
    );
    expect(lido(PAR), "arrastar o fundo mexeu no ponto").toEqual(FICHA.condicao.coords);
    // o mapa andou 50×30 de tela = 100×60 de layout, e o pin, que é um lugar NO mapa, andou junto
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(L / 2 + 100, 1);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(A / 2 + 60, 1);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("um TOQUE fora do pin (até 8px andados) leva o pin pra lá — o mesmo gesto do primeiro ponto", () => {
    render(<FichaInteira ficha={FICHA} />);
    const de = naTela({ x: 100, y: 40 });
    const ate = { clientX: de.clientX + 3, clientY: de.clientY + 2 }; // 3,6px de tela
    gesto(PAR, de, ate);
    const layout = { x: (ate.clientX - RECT.left) * ESCALA_TELA, y: (ate.clientY - RECT.top) * ESCALA_TELA };
    const e = coordDaPosicao(layout.x, layout.y, FICHA.condicao.coords, MAPA_ZOOM_EDITOR, L, A);
    expect(lido(PAR).lat).toBeCloseTo(e.lat, 6);
    expect(lido(PAR).lng).toBeCloseTo(e.lng, 6);
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(layout.x, 1);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(layout.y, 1);
  });

  // O alvo é a GOTA visível, e não a ponta (I3a): numa caixa em escala 1, um
  // dedo 15px acima do meio da gota está a ~28px da ponta — fora de um alvo
  // centrado na ponta, dentro do certo. Pegou o pin: o número muda.
  it("o alvo de pegar o pin é o meio da GOTA, não a ponta que o dedo tampa", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    const UM = { left: 0, top: 0, width: L, height: A };
    dublarCaixas(mapa, UM);
    const de = { clientX: L / 2, clientY: A / 2 - GOTA_ACIMA_DA_PONTA_PX - 15 };
    expect(Math.hypot(0, A / 2 - de.clientY), "premissa: longe da ponta").toBeGreaterThan(22);
    ponteiro(mapa, "pointerdown", de);
    ponteiro(mapa, "pointermove", { clientX: de.clientX + 30, clientY: de.clientY });
    ponteiro(mapa, "pointerup", { clientX: de.clientX + 30, clientY: de.clientY });
    expect(lido(PAR), "o dedo na gota não pegou o pin").not.toEqual(FICHA.condicao.coords);
  });

  // Um arrasto do fundo que VOLTA perto de onde começou não vira toque: ele já
  // foi arrasto (I3c — "passou disso, é arrasto de vista e não põe pin").
  it("arrastar o fundo e voltar ao ponto de partida não é toque: não põe pin", () => {
    render(<FichaInteira ficha={FICHA} />);
    const de = naTela({ x: 100, y: 40 });
    gesto(PAR, de, { clientX: de.clientX + 40, clientY: de.clientY }, { clientX: de.clientX + 2, clientY: de.clientY });
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
  });

  it("andar 9px já é arrasto do fundo: não põe pin", () => {
    render(<FichaInteira ficha={FICHA} />);
    const de = naTela({ x: 100, y: 40 });
    gesto(PAR, de, { clientX: de.clientX + 9, clientY: de.clientY });
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
  });

  it("o navegador cancelar o gesto (pointercancel) não vira toque, e o ponteiro solto não move mais nada", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    dublarCaixas(mapa);
    const de = naTela({ x: 100, y: 40 });
    ponteiro(mapa, "pointerdown", de);
    ponteiro(mapa, "pointercancel", de);
    ponteiro(mapa, "pointermove", { clientX: de.clientX + 40, clientY: de.clientY });
    ponteiro(mapa, "pointerup", { clientX: de.clientX + 40, clientY: de.clientY });
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
    expect(parseFloat(pinEm(PAR).style.left)).toBe(L / 2);
  });

  it("o − afasta um degrau e o + aproxima, em volta do pin (que nasce no centro); o número e a rota não mexem", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
    fireEvent.click(menos(PAR));
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR - 1));
    // o pin estava no centro da vista, e o zoom é em volta dele: continua lá
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(L / 2, 1);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(A / 2, 1);
    fireEvent.click(mais(PAR));
    fireEvent.click(mais(PAR));
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR + 1));
    expect(lido(PAR)).toEqual(FICHA.condicao.coords);
    expect(fetchFalso).not.toHaveBeenCalled();
    // +/− são botões que não gravam: dentro de um <form> um botão sem type é submit
    expect(mais(PAR).getAttribute("type")).toBe("button");
    expect(menos(PAR).getAttribute("type")).toBe("button");
  });

  it("o + e o − param nos limites, e o botão do limite desliga", () => {
    render(<FichaInteira ficha={FICHA} />);
    for (let z = MAPA_ZOOM_EDITOR; z < MAPA_ZOOM_EDITOR_MAX; z++) fireEvent.click(mais(PAR));
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR_MAX));
    expect(mais(PAR).disabled).toBe(true);
    expect(menos(PAR).disabled).toBe(false);
    for (let z = MAPA_ZOOM_EDITOR_MAX; z > MAPA_ZOOM_EDITOR_MIN; z--) fireEvent.click(menos(PAR));
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR_MIN));
    expect(menos(PAR).disabled).toBe(true);
    expect(mais(PAR).disabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 C1 DA AUDITORIA DA 11f: afastado, um toque grava um ponto a quilômetros (no
// z7, ~1,2 km por pixel). O Salvar só liga com o PIN posto ou movido no
// `MAPA_ZOOM_EDITOR` ou mais perto, e à vista — na ficha no ar também. Afastado,
// o pin ainda se põe e se arrasta. (Até a onda de fix valia o zoom da VISTA, e
// aproximar depois do toque salvava o toque de longe: C-1 da revisão da 11f.)
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — o portão do Salvar no zoom (C1)", () => {
  it("afastado: o Salvar desliga, a ajuda diz pra aproximar, e tocar no Salvar não chama a rota", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    expect(salvarEm(PAR)!.disabled).toBe(false);
    expect(within(bloco(PAR)).queryByText(APROXIME_PRA_SALVAR)).toBeNull();
    fireEvent.click(menos(PAR));
    fireEvent.click(menos(PAR));
    // o portão é do PIN, não da vista: o ponto do banco, intocado, segue salvável
    expect(salvarEm(PAR)!.disabled, "afastar a vista desligou o Salvar do pin que ninguém mexeu").toBe(false);
    gesto(PAR, naTela({ x: 100, y: 40 })); // um toque afastado põe o pin…
    expect(lido(PAR)).not.toEqual(FICHA.condicao.coords);
    expect(salvarEm(PAR)!.disabled, "afastado, o Salvar continuou ligado").toBe(true); // …mas não salva
    expect(within(bloco(PAR)).getByText(APROXIME_PRA_SALVAR)).toBeTruthy();
    fireEvent.click(salvarEm(PAR)!);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  // 🔴 C-1 DA REVISÃO DA 11f (o furo nasceu no plano: a prova "tocar afastado,
  // aproximar, Salvar liga" ERA o furo). Medido no Chrome: toque no z7, seis +,
  // Salvar aceito — um ponto posto a ~1,2 km/px, gravado a ~75 km da cidade. O
  // Salvar vale pelo zoom em que o PIN foi posto ou movido, não pelo da vista.
  it("C-1: tocar no z7 e apertar + seis vezes NÃO liga o Salvar — o pin vale pelo zoom em que foi posto; tocar de perto, sim", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    for (let z = MAPA_ZOOM_EDITOR; z > MAPA_ZOOM_EDITOR_MIN; z--) fireEvent.click(menos(PAR));
    expect(zoomDosTiles(PAR), "premissa: o z7").toBe(zoomDeTiles(MAPA_ZOOM_EDITOR_MIN));
    gesto(PAR, naTela({ x: 100, y: 40 }));
    const longe = lido(PAR);
    expect(within(bloco(PAR)).getByText(APROXIME_PRA_SALVAR)).toBeTruthy();
    for (let z = MAPA_ZOOM_EDITOR_MIN; z < MAPA_ZOOM_EDITOR; z++) fireEvent.click(mais(PAR));
    expect(zoomDosTiles(PAR), "premissa: de volta ao zoom do portão").toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
    // o + aproxima em volta do PIN: ele fica onde o dedo o pôs, à vista
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(100, 0);
    expect(parseFloat(pinEm(PAR).style.top)).toBeCloseTo(40, 0);
    expect(lido(PAR), "aproximar mexeu no ponto").toEqual(longe);
    expect(salvarEm(PAR)!.disabled, "o toque do z7 ficou salvável depois de aproximar").toBe(true);
    // perto, a ajuda já não manda aproximar: manda tocar (ou arrastar) de novo
    expect(within(bloco(PAR)).getByText(TOQUE_DE_PERTO)).toBeTruthy();
    expect(within(bloco(PAR)).queryByText(APROXIME_PRA_SALVAR)).toBeNull();
    fireEvent.click(salvarEm(PAR)!);
    expect(fetchFalso).not.toHaveBeenCalled();
    // um toque DE PERTO põe o ponto que se grava
    gesto(PAR, naTela({ x: 300, y: 150 }));
    const perto = lido(PAR);
    expect(perto).not.toEqual(longe);
    expect(salvarEm(PAR)!.disabled).toBe(false);
    expect(within(bloco(PAR)).queryByText(TOQUE_DE_PERTO)).toBeNull();
    salvar(PAR);
    await waitFor(() => expect(reloadFalso).toHaveBeenCalled());
    expect(corpos(fetchFalso)[0].corpo).toEqual({ slug: FICHA.slug, campo: PAR, valor: perto });
  });

  it("C-1: o pin posto de longe e ARRASTADO de perto também se salva — o gesto que move conta como o que põe", () => {
    render(<FichaInteira ficha={FICHA} />);
    fireEvent.click(menos(PAR));
    fireEvent.click(menos(PAR));
    gesto(PAR, naTela({ x: 100, y: 40 }));
    fireEvent.click(mais(PAR));
    fireEvent.click(mais(PAR));
    expect(salvarEm(PAR)!.disabled, "premissa: o toque de longe não salva").toBe(true);
    // pega a gota (o pin ficou em (100, 40) de layout) e arrasta 10px de tela
    const gota = naTela({ x: 100, y: 40 - GOTA_ACIMA_DA_PONTA_PX });
    gesto(PAR, gota, { clientX: gota.clientX + 10, clientY: gota.clientY + 10 });
    expect(parseFloat(pinEm(PAR).style.left), "premissa: o arrasto pegou o pin").toBeCloseTo(120, 0);
    expect(salvarEm(PAR)!.disabled).toBe(false);
  });

  it("com pin, o + e o − aproximam e afastam EM VOLTA DO PIN: ele fica no mesmo pixel, e o número não muda", () => {
    render(<FichaInteira ficha={FICHA} />);
    gesto(PAR, naTela({ x: 80, y: 160 }));
    const ponto = lido(PAR);
    for (const botao of [mais, mais, menos, menos, menos]) {
      fireEvent.click(botao(PAR));
      expect(parseFloat(pinEm(PAR).style.left), "o zoom tirou o pin do lugar (x)").toBeCloseTo(80, 0);
      expect(parseFloat(pinEm(PAR).style.top), "o zoom tirou o pin do lugar (y)").toBeCloseTo(160, 0);
    }
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR - 1));
    expect(lido(PAR)).toEqual(ponto);
  });

  it("sem pin, o + aproxima em volta do CENTRO da vista: tocar o meio dá o centro", () => {
    const semNada = {
      ...FICHA,
      condicao: { ...FICHA.condicao, coords: { lat: NaN, lng: -36 } },
      trajeto: { ...FICHA.trajeto, waypoints: [{ ...FICHA.trajeto.waypoints[0], lat: NaN }] },
    } as Ficha;
    const vista: VistaNaTela = { centro: { lat: -8.5, lng: -36.5 }, z: 11, origem: "cidade" };
    render(<FichaInteira ficha={semNada} vistaSemPonto={vista} />);
    fireEvent.click(mais(PAR));
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(12));
    gesto(PAR, naTela({ x: L / 2, y: A / 2 }));
    expect(lido(PAR)).toEqual(vista.centro);
  });

  // (c): o pin que saiu da parte VISÍVEL (arrastando o fundo) não se salva — ele
  // grava o que está vendo. O caso do celular: a caixa de 480px começa 60px à
  // esquerda da moldura, que mostra 360px; o pin em x=440 está DENTRO da caixa
  // e FORA da tela, e só a medida da moldura o acha.
  it("pin fora da parte visível do mapa: sem Salvar, e a ajuda diz que ele saiu; de volta à vista, salva", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    dublarCaixas(mapa, { left: -60, top: 20, width: L, height: A }, { left: 0, top: 20, width: 360, height: A });
    // o pin nasce em (240, 100) de layout = (180, 120) de tela; o dedo encosta longe da gota
    ponteiro(mapa, "pointerdown", { clientX: 100, clientY: 150 });
    ponteiro(mapa, "pointermove", { clientX: 200, clientY: 150 });
    ponteiro(mapa, "pointermove", { clientX: 300, clientY: 150 });
    ponteiro(mapa, "pointerup", { clientX: 300, clientY: 150 });
    expect(parseFloat(pinEm(PAR).style.left), "premissa: o pin na sobra cortada").toBeCloseTo(440, 1);
    expect(lido(PAR), "arrastar o fundo mexeu no ponto").toEqual(FICHA.condicao.coords);
    expect(salvarEm(PAR)!.disabled, "o pin fora da tela ficou salvável").toBe(true);
    expect(within(bloco(PAR)).getByText(PIN_FORA_DA_VISTA)).toBeTruthy();
    fireEvent.click(salvarEm(PAR)!);
    expect(fetchFalso).not.toHaveBeenCalled();
    ponteiro(mapa, "pointerdown", { clientX: 300, clientY: 150 });
    ponteiro(mapa, "pointermove", { clientX: 250, clientY: 150 });
    ponteiro(mapa, "pointermove", { clientX: 200, clientY: 150 });
    ponteiro(mapa, "pointerup", { clientX: 200, clientY: 150 });
    expect(parseFloat(pinEm(PAR).style.left)).toBeCloseTo(340, 1);
    expect(salvarEm(PAR)!.disabled).toBe(false);
    expect(within(bloco(PAR)).queryByText(PIN_FORA_DA_VISTA)).toBeNull();
  });

  // W1 da onda de fix 2 da 11f (I-1 da re-revisão): a regra (c) confere QUATRO
  // bordas e um evento, e só a direita estava provada. Cada caso abaixo arrasta o
  // FUNDO (o pin vai junto do mapa, o número não muda) até o pin sair por UMA
  // borda, e volta. Caixa em escala 1 (tela = layout), pra o deslocamento do dedo
  // ser o do pin. O pin nasce no centro, (240, 100).
  /** Arrasta o fundo de `de` até `ate` (tela), em dois passos, e solta. */
  function arrastarFundo(mapa: HTMLElement, de: NaTela, ate: NaTela): void {
    ponteiro(mapa, "pointerdown", de);
    ponteiro(mapa, "pointermove", { clientX: (de.clientX + ate.clientX) / 2, clientY: (de.clientY + ate.clientY) / 2 });
    ponteiro(mapa, "pointermove", ate);
    ponteiro(mapa, "pointerup", ate);
  }
  const ESCALA_UM = { left: 0, top: 20, width: L, height: A };
  for (const caso of [
    // a caixa de 480 começa 60px à esquerda da moldura de 360: a parte visível é
    // x ∈ [60, 420]. O pin em x=40 está DENTRO da caixa e FORA da tela.
    {
      borda: "ESQUERDA",
      caixa: { left: -60, top: 20, width: L, height: A },
      moldura: { left: 0, top: 20, width: 360, height: A },
      de: { clientX: 300, clientY: 150 },
      ate: { clientX: 100, clientY: 150 },
      eixo: "left" as const,
      fora: 40,
    },
    {
      borda: "de CIMA",
      caixa: ESCALA_UM,
      moldura: ESCALA_UM,
      de: { clientX: 100, clientY: 190 },
      ate: { clientX: 100, clientY: 40 },
      eixo: "top" as const,
      fora: -50,
    },
    {
      borda: "de BAIXO",
      caixa: ESCALA_UM,
      moldura: ESCALA_UM,
      de: { clientX: 100, clientY: 30 },
      ate: { clientX: 100, clientY: 160 },
      eixo: "top" as const,
      fora: A / 2 + 130,
    },
  ]) {
    it(`pin fora da parte visível pela borda ${caso.borda}: sem Salvar, e a ajuda diz que ele saiu; de volta à vista, salva`, () => {
      const { fetchFalso } = comRota();
      render(<FichaInteira ficha={FICHA} />);
      const mapa = mapaEm(PAR)!;
      dublarCaixas(mapa, caso.caixa, caso.moldura);
      expect(salvarEm(PAR)!.disabled, "premissa: o pin do banco, à vista, salva").toBe(false);
      arrastarFundo(mapa, caso.de, caso.ate);
      expect(parseFloat(pinEm(PAR).style[caso.eixo]), "premissa: o pin fora por aquela borda").toBeCloseTo(caso.fora, 1);
      expect(lido(PAR), "arrastar o fundo mexeu no ponto").toEqual(FICHA.condicao.coords);
      expect(salvarEm(PAR)!.disabled, `o pin fora pela borda ${caso.borda} ficou salvável`).toBe(true);
      expect(within(bloco(PAR)).getByText(PIN_FORA_DA_VISTA)).toBeTruthy();
      fireEvent.click(salvarEm(PAR)!);
      expect(fetchFalso).not.toHaveBeenCalled();
      arrastarFundo(mapa, caso.ate, caso.de);
      expect(salvarEm(PAR)!.disabled, "de volta à vista, o pin não salvou").toBe(false);
      expect(within(bloco(PAR)).queryByText(PIN_FORA_DA_VISTA)).toBeNull();
    });
  }

  // O celular gira (ou a janela estreita): a moldura passa a cortar outra fatia,
  // e o pin que estava à vista fica fora — sem nenhum gesto. É o `resize` que
  // manda medir de novo.
  it("a moldura encolhe com a janela (resize): o pin que saiu da vista desliga o Salvar; ela volta a crescer, ele liga", () => {
    render(<FichaInteira ficha={FICHA} />);
    const mapa = mapaEm(PAR)!;
    expect(parseFloat(pinEm(PAR).style.left), "premissa: o pin no centro").toBeCloseTo(L / 2, 1);
    expect(salvarEm(PAR)!.disabled, "premissa: à vista, salva").toBe(false);
    // a moldura passa a mostrar só x ∈ [0, 200] da caixa: o pin em 240 fica fora
    dublarCaixas(mapa, ESCALA_UM, { left: 0, top: 20, width: 200, height: A });
    expect(salvarEm(PAR)!.disabled, "premissa: sem o resize nada redesenha").toBe(false);
    fireEvent(window, new Event("resize"));
    expect(salvarEm(PAR)!.disabled, "a janela estreitou e o pin fora da tela ficou salvável").toBe(true);
    expect(within(bloco(PAR)).getByText(PIN_FORA_DA_VISTA)).toBeTruthy();
    dublarRect(mapa.parentElement!, ESCALA_UM);
    fireEvent(window, new Event("resize"));
    expect(salvarEm(PAR)!.disabled, "a janela voltou e o pin à vista não salvou").toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 I4 DA AUDITORIA DA 11f: a guarda pin ↔ mosaico em TODO zoom e centro. O
// defeito provável desta tarefa é o deslocamento da vista aplicado aos tiles e
// não à conta do ponto (ou o contrário) — e o ponto gravado sairia de outro
// lugar que o mostrado. A prova é a mesma do R4 da Tarefa 8, pela URL do tile.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — pin e mosaico depois de mexer na vista (I4)", () => {
  const mundo = (c: { lat: number; lng: number }, z: number) => {
    const n = TILE_PX * 2 ** z;
    const fi = (c.lat * Math.PI) / 180;
    return {
      x: ((c.lng + 180) / 360) * n,
      y: ((1 - Math.log(Math.tan(fi) + 1 / Math.cos(fi)) / Math.PI) / 2) * n,
    };
  };
  function pinSobreOMosaico(caminho: string): void {
    const c = lido(caminho);
    const camada = mapaEm(caminho)!.querySelector(".adm-editor-mapa-tiles") as HTMLElement;
    const escala = Number(/scale\(([^)]+)\)/.exec(camada.style.transform)![1]);
    const imgs = [...camada.querySelectorAll("img")];
    const z = zoomDosTiles(caminho);
    const w = mundo(c, z);
    const tx = Math.floor(w.x / TILE_PX);
    const ty = Math.floor(w.y / TILE_PX);
    const img = imgs.find((i) => i.getAttribute("src")!.endsWith(`/${z}/${tx}/${ty}.png`));
    expect(img, `o ponto mostrado (${z}/${tx}/${ty}) não está em tile nenhum desenhado`).toBeDefined();
    const x = (parseFloat(img!.style.left) + (w.x - tx * TILE_PX)) * escala;
    const y = (parseFloat(img!.style.top) + (w.y - ty * TILE_PX)) * escala;
    expect(Math.abs(x - parseFloat(pinEm(caminho).style.left)), "pin e mosaico desalinhados no eixo x").toBeLessThan(1);
    expect(Math.abs(y - parseFloat(pinEm(caminho).style.top)), "pin e mosaico desalinhados no eixo y").toBeLessThan(1);
  }

  for (const caminho of [PAR, LAT0]) {
    it(`${caminho}: depois do −, de um arrasto da vista e de um toque, o ponto gravado é o do mosaico sob o pin`, async () => {
      const { fetchFalso } = comRota();
      render(<FichaInteira ficha={FICHA} />);
      fireEvent.click(menos(caminho));
      const de = naTela({ x: 60, y: 160 });
      gesto(
        caminho,
        de,
        { clientX: de.clientX + 30, clientY: de.clientY - 20 },
        { clientX: de.clientX + 70, clientY: de.clientY - 35 },
      );
      // o arrasto levou o pin (um lugar NO mapa) pra (380, 30); o toque é longe dele
      gesto(caminho, naTela({ x: 120, y: 150 }));
      // o pin cai ONDE o dedo tocou, também afastado e com a vista andada
      expect(parseFloat(pinEm(caminho).style.left), "o pin não caiu sob o dedo").toBeCloseTo(120, 0);
      expect(parseFloat(pinEm(caminho).style.top), "o pin não caiu sob o dedo").toBeCloseTo(150, 0);
      pinSobreOMosaico(caminho);
      fireEvent.click(mais(caminho));
      pinSobreOMosaico(caminho);
      // o toque do z12 não se salva (C-1): um toque de perto, e é ELE que vai
      gesto(caminho, naTela({ x: 300, y: 60 }));
      pinSobreOMosaico(caminho);
      const mostrado = lido(caminho);
      salvar(caminho);
      await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
      const corpo = corpos(fetchFalso)[0].corpo;
      expect(caminho === PAR ? corpo.valor : { lat: corpo.lat, lng: corpo.lng }).toEqual(mostrado);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 M1/M4 DA 11f, NA FICHA NO AR: coordenada que não é par finito. Até a 11f
// essa linha ficava SEM MAPA (onda 1 da Tarefa 8, R3: `lng: Infinity` travava o
// laço de tiles). Agora é MAPA SEM PIN, começando na vista que o servidor
// mandou (a cidade da ficha) — e sem vista, a frase de sem mapa. O laço de
// tiles continua longe do número torto: o mosaico sai da VISTA, nunca do valor.
// (O schema não deixa esse documento existir: JSON não tem NaN nem Infinity. É
// um conserto, não um caminho do dia a dia — m5 da auditoria.)
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — coordenada que não é par finito", () => {
  /** Vista de MARCADOR: um número qualquer, que não é ponto de lugar nenhum. */
  const VISTA: VistaNaTela = { centro: { lat: -8.5, lng: -36.5 }, z: 11, origem: "cidade" };
  const semPar = (f: Ficha): Ficha => ({ ...f, condicao: { ...f.condicao, coords: { lat: NaN, lng: -36 } } }) as Ficha;
  const semPonto0 = (f: Ficha): Ficha =>
    ({ ...f, trajeto: { ...f.trajeto, waypoints: [{ ...f.trajeto.waypoints[0], lat: NaN }] } }) as Ficha;

  for (const [nome, coords] of [
    ["lat NaN", { lat: NaN, lng: -36 }],
    ["lat Infinity", { lat: Infinity, lng: -36 }],
    ["lng Infinity", { lat: -8, lng: Infinity }],
  ] as const) {
    it(`condicao.coords com ${nome}, com vista: MAPA SEM PIN, número vazio, nenhum Salvar, e a ajuda de marcar`, () => {
      const torta = { ...FICHA, condicao: { ...FICHA.condicao, coords } } as Ficha;
      render(<FichaInteira ficha={torta} vistaSemPonto={VISTA} />);
      expect(mapaEm(PAR), "sem mapa: a pergunta não tem como ser respondida").not.toBeNull();
      expect(bloco(PAR).querySelector("[data-pin]"), "um pin que ninguém pôs").toBeNull();
      expect(atualEm(PAR)).toBe("");
      expect(salvarEm(PAR), "Salvar sem pin gravaria o centro da vista").toBeNull();
      expect(within(bloco(PAR)).getByText(MARQUE_NO_MAPA)).toBeTruthy();
    });
  }

  it("condicao.coords torta e o ponto 0 bom: a vista começa no ponto 0, no zoom de pôr o pin — não na da cidade", () => {
    render(<FichaInteira ficha={semPar(FICHA)} vistaSemPonto={VISTA} />);
    expect(zoomDosTiles(PAR)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
  });

  it("sem vista nenhuma: sem mapa, sem número, e a frase que diz que não há mapa", () => {
    render(<FichaInteira ficha={semPonto0(semPar(FICHA))} />);
    expect(mapaEm(PAR)).toBeNull();
    expect(mapaEm(LAT0)).toBeNull();
    expect(atualEm(PAR)).toBe("");
    expect(within(bloco(PAR)).getByText(SEM_VISTA)).toBeTruthy();
    expect(within(bloco(LAT0)).getByText(SEM_VISTA)).toBeTruthy();
  });

  it("ponto do trajeto com lng Infinity: a linha da latitude vira mapa SEM PIN na vista do servidor", () => {
    const wp = { ...FICHA.trajeto.waypoints[0], lng: Infinity };
    const torta = { ...FICHA, trajeto: { ...FICHA.trajeto, waypoints: [wp] } } as Ficha;
    render(<FichaInteira ficha={torta} vistaSemPonto={VISTA} />);
    expect(mapaEm(LAT0)).not.toBeNull();
    expect(bloco(LAT0).querySelector("[data-pin]")).toBeNull();
    expect(zoomDosTiles(LAT0)).toBe(zoomDeTiles(VISTA.z));
  });

  it("M4: abrir e NÃO tocar — nenhum Salvar; tocar e salvar grava o ponto do TOQUE, não o centro da vista", async () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={semPonto0(semPar(FICHA))} vistaSemPonto={{ ...VISTA, z: MAPA_ZOOM_EDITOR }} />);
    expect(salvarEm(PAR)).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
    gesto(PAR, naTela({ x: 400, y: 30 }));
    const e = coordDaPosicao(400, 30, VISTA.centro, MAPA_ZOOM_EDITOR, L, A);
    salvar(PAR);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const valor = corpos(fetchFalso)[0].corpo.valor as { lat: number; lng: number };
    expect(valor.lat).toBeCloseTo(e.lat, 6);
    expect(valor.lng).toBeCloseTo(e.lng, 6);
    expect(valor, "gravou o centro da vista, que ninguém escolheu").not.toEqual(VISTA.centro);
  });

  // 🔴 A PÁGINA SÓ VAI AO SERVIÇO DE GEOCODING QUANDO PRECISA: uma ficha sã
  // abre sem rede nenhuma a mais (`admin/[slug]/page.tsx`).
  it("precisaDeVista: nenhuma ficha sã do acervo; a torta sem ponto 0, sim; a da chuva torta com o ponto 0 bom, não", () => {
    for (const f of ACERVO) expect(precisaDeVista(f), f.slug).toBe(false);
    expect(precisaDeVista(semPar(FICHA)), "a chuva torta sai do ponto 0, sem rede").toBe(false);
    expect(precisaDeVista(semPonto0(semPar(FICHA)))).toBe(true);
    expect(precisaDeVista(semPonto0(FICHA)), "o ponto 0 torto precisa da cidade").toBe(true);
  });

  // Medido no Chrome (375×667): com a ajuda EM CIMA do mapa, o primeiro toque a
  // apagava e o mapa subia ~45px debaixo do dedo. Toda ajuda mora embaixo dele.
  it("as ajudas que somem com o toque ficam DEPOIS do mapa — o mapa não pula quando elas somem", () => {
    render(<FichaInteira ficha={semPonto0(semPar(FICHA))} vistaSemPonto={{ ...VISTA, origem: "cidade-nao-achada" }} />);
    const ajudas = [...bloco(PAR).querySelectorAll(".adm-editor-ajuda")];
    expect(ajudas.map((p) => p.textContent)).toEqual([VISTA_SEM_CIDADE, MARQUE_NO_MAPA]);
    for (const p of ajudas) {
      expect(mapaEm(PAR)!.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING, p.textContent!).toBeTruthy();
    }
  });

  it("a vista que caiu no acervo diz que não achou a cidade; a da cidade não diz nada disso", () => {
    const longe = semPonto0(semPar(FICHA));
    const { unmount } = render(<FichaInteira ficha={longe} vistaSemPonto={{ ...VISTA, origem: "cidade-nao-achada" }} />);
    expect(within(bloco(PAR)).getByText(VISTA_SEM_CIDADE)).toBeTruthy();
    unmount();
    render(<FichaInteira ficha={longe} vistaSemPonto={VISTA} />);
    expect(within(bloco(PAR)).queryByText(VISTA_SEM_CIDADE)).toBeNull();
    expect(within(bloco(PAR)).queryByText(VISTA_CIDADE_AMBIGUA)).toBeNull();
  });

  // I-2 da revisão da 11f: achada mais de uma vez não é "não achei".
  it("a vista que caiu no acervo porque a cidade é AMBÍGUA diz isso, e não 'não achei'", () => {
    render(<FichaInteira ficha={semPonto0(semPar(FICHA))} vistaSemPonto={{ ...VISTA, origem: "cidade-ambigua" }} />);
    expect(within(bloco(PAR)).getByText(VISTA_CIDADE_AMBIGUA)).toBeTruthy();
    expect(within(bloco(PAR)).queryByText(VISTA_SEM_CIDADE)).toBeNull();
    expect(within(bloco(PAR)).getByText(MARQUE_NO_MAPA)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// O meio da gota (o alvo de pegar o pin) sai da regra do pin no CSS.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — o alvo do pin bate com o desenho dele", () => {
  it("GOTA_ACIMA_DA_PONTA_PX = o margin-top da gota menos metade da altura dela", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "admin", "admin.css"), "utf8");
    const regra = /\.adm-editor-mapa-pin \{([^}]*)\}/.exec(css)![1];
    const altura = Number(/height: ([\d.]+)px/.exec(regra)![1]);
    const topo = Number(/margin: -([\d.]+)px/.exec(regra)![1]);
    expect(GOTA_ACIMA_DA_PONTA_PX).toBeCloseTo(topo - altura / 2, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17/10, Task 5: A BUSCA NO MAPA DO PONTO. Ela só MOVE o mapa; o ponto continua
// vindo do dedo de quem sabe. Renderiza o `EditorCoordenada` direto, dentro de
// um provedor com `buscarEm` (a `FichaInteira` não monta provedor), num `div`
// com o `data-testid` do bloco pra reaproveitar os ajudantes acima.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — a busca no mapa (17/10)", () => {
  const ROTA_BUSCA = "/api/admin/buscar-no-mapa";
  /** Vista de MARCADOR, ABAIXO do zoom de pôr o pin (11 < 13): é o que separa
   *  "escolher abre no zoom de pôr o pin" de "escolher mantém a vista". */
  const VISTA_LONGE: VistaNaTela = { centro: { lat: -8.5, lng: -36.5 }, z: 11, origem: "cidade" };
  const ACHADO = { nome: "Lugar Marcador Um, Cidade Marcador Um", lat: -8.1, lng: -35.2 };
  const OUTRO_ACHADO = { nome: "Lugar Marcador Dois, Cidade Marcador Dois", lat: -8.3, lng: -35.4 };
  const SALVO = { lat: -8.2, lng: -35.9 };

  function montar(
    p: { buscarEm?: string | null; recarregarSe401?: boolean; salvo?: { lat: number; lng: number }; cidade?: string } = {},
  ): void {
    const campo = {
      caminho: LAT0,
      rotulo: "Latitude",
      obrigatorio: true,
      vista: VISTA_LONGE,
      ...(p.salvo ? { ponto: { indice: 0, ...p.salvo } } : {}),
      ...(p.cidade !== undefined ? { cidade: p.cidade } : {}),
    };
    render(
      <PortaDoEditor.Provider
        value={{
          gravarEm: "/api/admin/rascunho",
          previa: false,
          depoisDeGravar: null,
          recarregarSe401: p.recarregarSe401 ?? false,
          buscarEm: p.buscarEm === undefined ? ROTA_BUSCA : p.buscarEm,
        }}
      >
        <div data-testid={`campo-${LAT0}`}>
          <EditorCoordenada campo={campo} valor={undefined} slug="rascunho-marcador" />
        </div>
      </PortaDoEditor.Provider>,
    );
  }

  const caixaDaBusca = (): HTMLInputElement => screen.getByRole("searchbox", { name: ROTULO_DA_BUSCA });
  const querBuscar = (): HTMLElement => screen.getByRole("button", { name: BUSCAR });
  const semCaixa = (): boolean => screen.queryByRole("searchbox") === null;
  const putsDe = (f: ReturnType<typeof comRota>["fetchFalso"]) =>
    (f.mock.calls as unknown as [string, { method?: string } | undefined][]).filter(([, i]) => i?.method === "PUT");
  /** Os tiles que o mapa de `centro` em `z` desenha — a conta pura, escrita do
   *  lado de fora do componente. */
  const tilesEsperados = (centro: { lat: number; lng: number }, z: number): string[] =>
    tilesParaCaixa(centro, zoomDeTiles(z), L * MAPA_ESCALA, A * MAPA_ESCALA).map(urlTile).sort();
  const urlsDosTiles = (): string[] =>
    [...mapaEm(LAT0)!.querySelectorAll("img")].map((i) => i.getAttribute("src")!).sort();

  /** Digita e manda o formulário (o Enter). */
  function buscar(q = "Lugar Marcador"): void {
    fireEvent.change(caixaDaBusca(), { target: { value: q } });
    fireEvent.submit(caixaDaBusca().closest("form")!);
  }

  it("digitar não busca: só o botão (ou o Enter) chama a rota, uma vez", async () => {
    const { fetchFalso } = comRota(() => Promise.resolve(Response.json([ACHADO])));
    montar();
    fireEvent.change(caixaDaBusca(), { target: { value: "Lugar Marcador" } });
    fireEvent.change(caixaDaBusca(), { target: { value: "Lugar Marcador Um" } });
    fireEvent.change(caixaDaBusca(), { target: { value: "Lugar Marcador" } });
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.submit(caixaDaBusca().closest("form")!);
    await screen.findByRole("button", { name: ACHADO.nome });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(String(fetchFalso.mock.calls[0][0])).toBe("/api/admin/buscar-no-mapa?q=Lugar%20Marcador");
  });

  it("o botão é o submit do formulário: tocar nele busca, uma vez", async () => {
    const { fetchFalso } = comRota(() => Promise.resolve(Response.json([ACHADO])));
    montar();
    expect(querBuscar().getAttribute("type")).toBe("submit");
    expect(querBuscar().closest("form")).toBe(caixaDaBusca().closest("form"));
    fireEvent.change(caixaDaBusca(), { target: { value: "Lugar Marcador" } });
    fireEvent.click(querBuscar());
    await screen.findByRole("button", { name: ACHADO.nome });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  // Revisão final (18/10): acima do teto a rota dá 400 mudo, e a tela diria
  // `BUSCA_NAO_SAIU` ("tente de novo") de uma busca que nunca sairia.
  it("a caixa não aceita mais que TETO_DA_BUSCA caracteres (o teto da rota)", () => {
    comRota();
    montar();
    expect(caixaDaBusca().maxLength).toBe(TETO_DA_BUSCA);
  });

  it("caixa vazia ou só de espaços: não há viagem nenhuma", () => {
    const { fetchFalso } = comRota();
    montar();
    for (const q of ["", "   "]) buscar(q);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("🔴 escolher um achado move o mapa e NÃO grava ponto", async () => {
    const { fetchFalso } = comRota(() => Promise.resolve(Response.json([ACHADO, OUTRO_ACHADO])));
    montar();
    expect(urlsDosTiles()).toEqual(tilesEsperados(VISTA_LONGE.centro, VISTA_LONGE.z));
    buscar();
    fireEvent.click(await screen.findByRole("button", { name: ACHADO.nome }));
    const c = bloco(LAT0);
    expect(c.querySelector("[data-pin]"), "a busca pôs um pin que ninguém tocou").toBeNull();
    expect(c.querySelector("[data-salvar]"), "a busca ligou o Salvar").toBeNull();
    expect(atualEm(LAT0)).toBe("");
    expect(putsDe(fetchFalso)).toEqual([]);
    // os tiles agora são do zoom de pôr o pin, em volta do achado:
    expect(urlsDosTiles()).toEqual(tilesEsperados({ lat: ACHADO.lat, lng: ACHADO.lng }, MAPA_ZOOM_EDITOR));
    // a lista some ao escolher
    expect(screen.queryByRole("button", { name: OUTRO_ACHADO.nome })).toBeNull();
  });

  it("depois de escolher, um toque no mapa liga o Salvar (o zoom em que o toque vale)", async () => {
    // O CONTROLE: sem escolher, o toque é de longe (z11) e o portão segura o Salvar.
    comRota();
    montar();
    gesto(LAT0, naTela({ x: 300, y: 60 }));
    expect(salvarEm(LAT0)!.disabled, "o toque de longe devia ficar preso pelo portão").toBe(true);
    cleanup();

    comRota(() => Promise.resolve(Response.json([ACHADO])));
    montar();
    buscar();
    fireEvent.click(await screen.findByRole("button", { name: ACHADO.nome }));
    expect(salvarEm(LAT0)).toBeNull();
    gesto(LAT0, naTela({ x: 300, y: 60 }));
    expect(salvarEm(LAT0)!.disabled, "o toque depois da busca não vale").toBe(false);
    const e = coordDaPosicao(300, 60, { lat: ACHADO.lat, lng: ACHADO.lng }, MAPA_ZOOM_EDITOR, L, A);
    expect(lido(LAT0).lat).toBeCloseTo(e.lat, 5);
  });

  it("sem achado: NENHUM_ACHADO; serviço fora ou rede caída: BUSCA_NAO_SAIU — frases diferentes", async () => {
    expect(NENHUM_ACHADO).not.toBe(BUSCA_NAO_SAIU);
    comRota(() => Promise.resolve(Response.json([])));
    montar();
    buscar();
    expect(await screen.findByText(NENHUM_ACHADO)).toBeTruthy();
    expect(screen.queryByText(BUSCA_NAO_SAIU)).toBeNull();
    cleanup();

    comRota(() => Promise.resolve(new Response(BUSCA_NAO_SAIU, { status: 503 })));
    montar();
    buscar();
    expect(await screen.findByText(BUSCA_NAO_SAIU)).toBeTruthy();
    expect(screen.queryByText(NENHUM_ACHADO)).toBeNull();
    cleanup();

    comRota(() => Promise.reject(new Error("sem rede")));
    montar();
    buscar();
    expect(await screen.findByText(BUSCA_NAO_SAIU)).toBeTruthy();
    expect(screen.queryByText(NENHUM_ACHADO)).toBeNull();
  });

  it("401 na busca dela recarrega a tela; no painel é a frase de falha", async () => {
    const dela = comRota(() => Promise.resolve(new Response("", { status: 401 })));
    montar({ recarregarSe401: true });
    buscar();
    await waitFor(() => expect(dela.reloadFalso).toHaveBeenCalledTimes(1));
    expect(dela.fetchFalso).toHaveBeenCalledTimes(1);
    cleanup();

    const painel = comRota(() => Promise.resolve(new Response("", { status: 401 })));
    montar({ recarregarSe401: false });
    buscar();
    expect(await screen.findByText(BUSCA_NAO_SAIU)).toBeTruthy();
    expect(painel.reloadFalso).not.toHaveBeenCalled();
  });

  it("a busca usa a rota que o provedor deu (a dela, não a do painel)", async () => {
    const { fetchFalso } = comRota(() => Promise.resolve(Response.json([])));
    montar({ buscarEm: "/api/contribuir/buscar-no-mapa" });
    buscar("Lugar Marcador");
    await screen.findByText(NENHUM_ACHADO);
    expect(String(fetchFalso.mock.calls[0][0])).toBe("/api/contribuir/buscar-no-mapa?q=Lugar%20Marcador");
  });

  it("sem buscarEm (a FichaInteira), não há caixa", () => {
    render(<FichaInteira ficha={FICHA} />);
    expect(semCaixa()).toBe(true);
    cleanup();
    montar({ buscarEm: null });
    expect(semCaixa()).toBe(true);
    expect(screen.queryByRole("button", { name: BUSCAR })).toBeNull();
  });

  it("com ponto salvo, não há caixa", () => {
    montar({ salvo: SALVO });
    expect(semCaixa()).toBe(true);
  });

  it("depois de um toque (ainda sem ponto salvo), a caixa continua", () => {
    comRota();
    montar();
    gesto(LAT0, naTela({ x: 300, y: 60 }));
    expect(salvarEm(LAT0)).not.toBeNull();
    expect(semCaixa()).toBe(false);
  });

  it("a cidade embaixo do mapa: Fica em: <cidade> com o pin salvo; a frase de salvar depois de mexer", () => {
    comRota();
    montar({ salvo: SALVO, cidade: "Cidade Marcador Um" });
    expect(atualEm(LAT0)).toBe(`${EM_CIDADE} Cidade Marcador Um`);
    expect(atualEm(LAT0)).not.toContain(String(SALVO.lat));
    arrastar(LAT0);
    expect(atualEm(LAT0)).toBe(CIDADE_DEPOIS_DE_SALVAR);
  });

  it("ponto novo numa tela com cidade: nada antes do toque, e a frase de salvar depois", () => {
    comRota();
    montar({ cidade: "Cidade Marcador Um" });
    expect(atualEm(LAT0)).toBe("");
    gesto(LAT0, naTela({ x: 300, y: 60 }));
    expect(atualEm(LAT0)).toBe(CIDADE_DEPOIS_DE_SALVAR);
  });

  it("mapa sem cidade no documento (origem acervo): nenhuma frase de \"não achei\" — nada foi procurado", () => {
    const sem = { ...FICHA, trajeto: { ...FICHA.trajeto, waypoints: [{ ...FICHA.trajeto.waypoints[0], lat: NaN }] } } as Ficha;
    const torta = { ...sem, condicao: { ...sem.condicao, coords: { lat: NaN, lng: -36 } } } as Ficha;
    render(<FichaInteira ficha={torta} vistaSemPonto={{ ...VISTA_LONGE, origem: "acervo" }} />);
    expect(within(bloco(PAR)).queryByText(VISTA_SEM_CIDADE)).toBeNull();
    expect(within(bloco(PAR)).getByText(MARQUE_NO_MAPA)).toBeTruthy();
  });

  it("sem campo.cidade, os números de hoje", () => {
    comRota();
    montar({ salvo: SALVO });
    expect(atualEm(LAT0)).toBe(`${SALVO.lat}, ${SALVO.lng}`);
    cleanup();
    montar();
    gesto(LAT0, naTela({ x: 300, y: 60 }));
    expect(lido(LAT0)).toBeTruthy();
    expect(atualEm(LAT0)).not.toBe(CIDADE_DEPOIS_DE_SALVAR);
  });
});
