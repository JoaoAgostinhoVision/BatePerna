import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import { ERRO_GRAVAR } from "@/app/admin/campos/gravar";
import { SALVAR } from "@/app/admin/campos/palavras";
import { MAPA_ALTURA_PX, MAPA_LARGURA_PX, MAPA_ZOOM_EDITOR, TILE_PX, coordDaPosicao } from "@/lib/mapa";
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
// 🔴 ONDA 1, R3 (achado M3): `typeof === "number"` aceita `NaN` e `Infinity`, e
// `lng: Infinity` fazia o laço de tiles nunca terminar (a revisão mediu: heap
// out of memory). Valor fora de forma cai no estado vazio, como o contrato de
// `PropsDoEditor` promete.
// ═══════════════════════════════════════════════════════════════════════════
describe("EditorCoordenada — coordenada não finita no documento", () => {
  for (const [nome, coords] of [
    ["lat NaN", { lat: NaN, lng: -36 }],
    ["lat Infinity", { lat: Infinity, lng: -36 }],
    ["lng Infinity", { lat: -8, lng: Infinity }],
  ] as const) {
    it(`condicao.coords com ${nome}: sem mapa e sem número, e a tela não cai`, () => {
      const torta = { ...FICHA, condicao: { ...FICHA.condicao, coords } } as Ficha;
      render(<FichaInteira ficha={torta} />);
      expect(mapaEm(PAR)).toBeNull();
      expect(atualEm(PAR)).toBe("");
    });
  }

  it("ponto do trajeto com lng Infinity: a linha da latitude fica sem mapa", () => {
    const wp = { ...FICHA.trajeto.waypoints[0], lng: Infinity };
    const torta = { ...FICHA, trajeto: { ...FICHA.trajeto, waypoints: [wp] } } as Ficha;
    render(<FichaInteira ficha={torta} />);
    expect(mapaEm(LAT0)).toBeNull();
  });
});
