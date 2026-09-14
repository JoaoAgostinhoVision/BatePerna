import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { regraDe, semComentarios, valorDe } from "../css";
import MapaEstatico from "@/app/MapaEstatico";
import { MAPA_LARGURA_PX } from "@/lib/mapa";

afterEach(() => { cleanup(); });

const RAMPA = { lat: -7.907889, lng: -36.019222, nome: "Rampa do Pepe" };

describe("MapaEstatico", () => {
  it("mostra a atribuição do OpenStreetMap como link pro copyright deles", () => {
    const { getByText } = render(<MapaEstatico {...RAMPA} />);
    const credito = getByText("© OpenStreetMap");
    expect(credito.tagName).toBe("A");
    expect(credito.getAttribute("href")).toContain("openstreetmap.org");
  });

  it("o pin não guarda estado próprio — a cor dele é a da moldura", () => {
    // Antes o pin levava data-estado com a leitura do SERVIDOR. Quando o carimbo
    // buscava leitura nova no portão e o selo virava vermelho, esse atributo
    // ficava para trás e o pin seguia verde ao lado dele. Cor de decisão tem
    // uma fonte só: o [data-state] do <main>.
    const { container } = render(<MapaEstatico {...RAMPA} />);
    const pin = container.querySelector(".wp-pin");
    expect(pin).not.toBeNull();
    expect(pin?.getAttribute("data-estado")).toBeNull();
  });

  it("o CSS pinta o pin a partir do mesmo atributo que a moldura escreve", () => {
    // Par que não pode desemparelhar: se o seletor voltar a olhar um atributo
    // do próprio pin, ele sai do ar sem nenhum teste reclamar — jsdom não
    // computa cor.
    //
    // 🔴 A cor é lida pelo VALOR da declaração. `[^}]*background:\s*var\(--stop\)`
    // dentro do bloco casava em `--background: var(--stop); background:
    // var(--go)`: MEDIDO, 523/523 VERDE com o pin da ficha PINTADO DE VERDE ao
    // lado de um carimbo que diz frio. "Cor de um lado, palavra do outro" já
    // custou dois Criticals a este app; esta era a terceira porta.
    const css = semComentarios("ficha.css");
    const regra = regraDe(css, '.bp[data-state="frio"] .wp-pin');
    expect(regra, "faltou a regra que pinta o pin de frio no ficha.css").not.toBeNull();
    expect(valorDe(regra![0], "background"), "o pin da ficha parou de pintar frio com a cor de frio")
      .toBe("var(--stop)");
    expect(css).not.toMatch(/\.wp-pin\[data-estado/);
  });

  // 🔴 O DEFEITO QUE ESTE BLOCO TRANCA (2026-09-13). Instalar o app, sair de
  // casa e abrir uma ficha AQUECIDA que nunca foi aberta dá a ficha inteira com
  // o mapa vazio: o `bp-tiles-osm` só guarda o que a pessoa JÁ VIU, e a Tile
  // Usage Policy do OSM proíbe baixar tile antes (ver o guarda em
  // tests/lib/cache-rotas.test.ts). O que sobrava na tela era um PIN BOIANDO
  // NUM RETÂNGULO VAZIO — alfinete marcando nada, com cara de mapa carregado.
  describe("quando o mapa não carrega", () => {
    it("sobra um recado, e não um retângulo mudo", () => {
      const { getByText } = render(<MapaEstatico {...RAMPA} />);
      expect(getByText("Sem o mapa, vale a coordenada abaixo.")).not.toBeNull();
    });

    // 🔴 A ORDEM É A MECÂNICA INTEIRA, não estilo. O recado só some quando os
    // tiles pintam porque ele vem ANTES deles no DOM. Movido pra depois, ele
    // fica POR CIMA do mapa que funciona — uma linha de texto atravessada no
    // meio da estrada, em todo mundo, o tempo todo.
    it("o recado vem ANTES do mosaico — senão fica por cima do mapa que funciona", () => {
      const { container } = render(<MapaEstatico {...RAMPA} />);
      const recado = container.querySelector(".wp-sem-mapa")!;
      const mosaico = container.querySelector(".wp-tiles")!;
      expect(recado, "sumiu o recado de mapa ausente").not.toBeNull();
      expect(
        recado.compareDocumentPosition(mosaico) & Node.DOCUMENT_POSITION_FOLLOWING,
        "o recado passou pra depois do mosaico: agora ele tapa o mapa que carregou",
      ).toBeTruthy();
    });

    // 🔴 A REGRA QUE NÃO PODE EXISTIR, e esta é a que o CSS deixaria passar
    // verde: `.wp-tiles` é transparente de propósito. Ganhando um background,
    // ele vira uma tampa opaca de 480×200 exatamente em cima do recado — o
    // retângulo mudo volta, e nenhum teste de DOM percebe, porque o elemento
    // continua lá.
    it("o mosaico não pode ter fundo próprio — seria a tampa do recado", () => {
      const css = semComentarios("ficha.css");
      const regra = regraDe(css, ".bp .wp-tiles");
      expect(regra, "sumiu a regra do mosaico no ficha.css").not.toBeNull();
      // Lido no TEXTO da regra, e não por `valorDe("background")`: aquele
      // exige `background:` colado nos dois-pontos e passaria batido por um
      // `background-color:` ou `background-image:`, que tapam igualzinho.
      expect(
        /(?:^|[{;])\s*background(-color|-image)?\s*:/.test(regra![0]),
        "o mosaico ganhou fundo: ele tapa o recado e o mapa vazio volta a ser um retângulo mudo",
      ).toBe(false);
    });

    it("o recado fica atrás do mosaico também pelo z-index", () => {
      const css = semComentarios("ficha.css");
      const regra = regraDe(css, ".bp .wp-sem-mapa");
      expect(regra, "sumiu a regra do recado no ficha.css").not.toBeNull();
      expect(valorDe(regra![0], "z-index")).toBe("0");
    });

    // 🔴 O RECADO PRECISA CABER NA FAIXA DO MOSAICO, e este par de asserções é o
    // que amarra as duas metades — MEDIDO NO NAVEGADOR em 2026-09-13.
    //
    // `.wp-tiles` tem MAPA_LARGURA_PX (480) fixos, centrados dentro de uma
    // `.wp-mapa` FLUIDA. Num viewport maior que 480 a `.wp-mapa` é mais larga
    // que o mosaico, e aí só o que está centrado E mais estreito que 480 fica
    // garantidamente coberto pelos tiles. Um recado encostado numa borda, ou
    // mais largo que a faixa, vaza pra fora do mosaico e passa a aparecer POR
    // CIMA de um mapa que carregou — em todo mundo, o tempo todo.
    //
    // A primeira versão usava `margin: 0 auto` e o Chrome resolveu as duas
    // margens em 0px (o clamp do `max-width` não re-roda o cálculo das margens
    // automáticas): no ar, colado na esquerda. Só abrir o navegador achou.
    it("o recado é centrado de verdade, e não por margin auto", () => {
      const css = semComentarios("ficha.css");
      const regra = regraDe(css, ".bp .wp-sem-mapa")![0];
      expect(valorDe(regra, "left"), "o recado saiu do centro da caixa").toBe("50%");
      expect(
        valorDe(regra, "transform"),
        "sem o translateX ele fica com a BORDA ESQUERDA no meio, e vaza pra direita",
      ).toBe("translateX(-50%)");
      expect(
        /margin\s*:\s*0\s+auto/.test(regra),
        "voltou o `margin: 0 auto`: no Chrome ele resolve em 0px e cola o recado na esquerda",
      ).toBe(false);
    });

    it("e é mais estreito que a faixa de tiles — o número vem de MAPA_LARGURA_PX", () => {
      const css = semComentarios("ficha.css");
      const regra = regraDe(css, ".bp .wp-sem-mapa")![0];
      const largura = valorDe(regra, "width");
      const teto = /min\((\d+)px/.exec(largura ?? "");
      expect(teto, `não achei o teto de largura do recado (li "${largura}")`).not.toBeNull();
      expect(
        Number(teto![1]),
        "o recado ficou mais largo que o mosaico: ele vaza e tapa o mapa que carregou",
      ).toBeLessThan(MAPA_LARGURA_PX);
    });
  });

  it("renderiza ao menos um tile do OSM", () => {
    const { container } = render(<MapaEstatico {...RAMPA} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.every((img) => img.getAttribute("src")?.includes("tile.openstreetmap.org"))).toBe(true);
  });
});
