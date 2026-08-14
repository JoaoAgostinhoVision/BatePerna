import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import MapaHome from "@/app/MapaHome";
import CartaoTrilha from "@/app/CartaoTrilha";
import LocalVivo from "@/app/local";
import { LeiturasProvider } from "@/app/leituras";
import { getFichasComCondicao } from "@/lib/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { CHAVE_LOCAL } from "@/lib/local";
import type { Ficha } from "@/types/ficha";
import {
  MAPA_ALTURA_HOME_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_LARGURA_PX,
  RAIO_ALVO_TOQUE_PX,
  ZOOM_MINIMO_HOME_COM_VOCE,
} from "@/lib/mapa";

afterEach(() => { cleanup(); });

// Ficha mínima e sintética — mesmo padrão de tests/app/home.test.tsx
// (fichaFake): só os campos que o mapa lê. Não exporta o de lá nem move:
// duplicar sete linhas de fixture custa menos que acoplar dois arquivos de
// teste.
function fichaFake(slug: string): Ficha {
  return {
    slug,
    modos: [],
    rotulo_escaneio: "",
    promessa: `promessa de ${slug}`,
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome: slug, lat: 0, lng: 0 }] },
    acesso: "",
    avisos: "",
    condicao: {
      coords: { lat: 0, lng: 0 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 0, janela_passado_horas: 0, limiar_mm: 0 },
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

const fichas = getFichasComCondicao();
const leituras: Record<string, LeituraCarimbo> = Object.fromEntries(
  fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
);

describe("MapaHome", () => {
  it("um pin por trilha, e cada pin é âncora pro cartão dela", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    const pins = Array.from(container.querySelectorAll(".pin-home"));
    expect(pins).toHaveLength(fichas.length);
    for (const f of fichas) {
      expect(pins.some((p) => p.getAttribute("href") === `#${f.slug}`)).toBe(true);
    }
  });

  it("o pin funciona sem JS: é <a href>, não botão", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    for (const p of container.querySelectorAll(".pin-home")) {
      expect(p.tagName).toBe("A");
    }
  });

  it("a cor do pin é a leitura daquela trilha, não a de outra", () => {
    const mistas: Record<string, LeituraCarimbo> = Object.fromEntries(
      fichas.map((f, i) => [
        f.slug,
        { estado: i === 0 ? ("frio" as const) : ("fresco" as const), erro: false, calculadoEm: 1_800_000_000 },
      ]),
    );
    const { container } = render(<MapaHome fichas={fichas} leituras={mistas} />);
    const pin = container.querySelector(`.pin-home[href="#${fichas[0].slug}"]`);
    expect(pin?.getAttribute("data-state")).toBe("frio");
  });

  it("carrega tiles do OpenStreetMap", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].getAttribute("src")).toContain("tile.openstreetmap.org");
  });

  it("credita o OpenStreetMap — é obrigação de licença, não enfeite", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // Cicatriz: na rodada do carimbo o pin guardou a leitura do servidor e ficou
  // verde ao lado de um selo que já tinha virado vermelho. O guarda é
  // COMPORTAMENTAL de propósito — uma leitura nova no contexto tem que mover
  // TODOS os três: o pin, a cor do cartão e a palavra do selo. Renderizamos
  // CartaoTrilha (não SeloTrilha solto): depois da correção da Task 6, quem lê
  // o contexto é o CartaoTrilha, uma leitura só, que alimenta o data-state do
  // cartão E a prop do selo — SeloTrilha virou apresentacional.
  it("leitura nova no contexto move o pin, a cor do cartão E a palavra, no mesmo quadro", () => {
    const slug = fichas[0].slug;
    const nova = new Map<string, LeituraCarimbo>([
      [slug, { estado: "frio", erro: false, calculadoEm: 1_800_000_000 }],
    ]);
    const { container } = render(
      <LeiturasProvider value={nova}>
        <MapaHome fichas={fichas} leituras={leituras} />
        <CartaoTrilha ficha={fichas[0]} inicial={leituras[slug]} />
      </LeiturasProvider>,
    );
    // As props (`leituras`, `inicial`) dizem "fresco" — é a semente do servidor.
    // O contexto diz "frio". Os três têm que obedecer ao contexto, senão existe
    // mais de uma fonte de cor na tela.
    expect(container.querySelector(`.pin-home[href="#${slug}"]`)?.getAttribute("data-state"))
      .toBe("frio");
    expect(container.querySelector(".cartao")?.getAttribute("data-state")).toBe("frio");
    expect(container.textContent).toContain("Não suba");
  });

  // Mesmo padrão do guarda do .selo em tests/app/home.test.tsx — essa classe
  // exata de bug (a regra de fase perdendo a cascata pra cor do estado) já
  // vazou pra produção uma vez. Aqui a disputa é (0,4,1) contra (0,3,1):
  // .bp .pin-home[data-state][data-fase="sem-informacoes"]::before tem um
  // seletor a mais que .bp .pin-home[data-state="fresco"]::before — vitória
  // direta de especificidade, não empate resolvido por ordem no arquivo.
  // jsdom não resolve cascata, então o guarda lê a folha — seletor E corpo
  // juntos — pra não passar só porque o texto apareceu num comentário, nem
  // porque a regra ganhou a cascata mas pintou a cor errada.
  it("a regra de fase do pin ganha da cor do estado — mesma disputa de especificidade do selo", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    expect(css).toMatch(
      /\.bp \.pin-home\[data-state\]\[data-fase="sem-informacoes"\]::before\s*\{[^}]*background:\s*var\(--stop\)/,
    );
  });
});

// Task 10 desta rodada corrigiu MapaHome pra enquadrar contra
// MAPA_JANELA_VISIVEL_HOME_PX (a fatia que `.mapa-home` realmente mostra),
// não contra MAPA_LARGURA_PX (a caixa de geração de 480px, maior — que era o
// bug: pin fora da tela). Os quatro testes de geometria em
// tests/lib/mapa.test.ts chamam `enquadrar()` DIRETO, com a constante certa
// passada à mão — nenhum deles prova que MapaHome é quem passa essa
// constante. Revertendo a chamada em MapaHome.tsx pra usar MAPA_LARGURA_PX
// de novo, aquela suíte continua toda verde; só um teste no PONTO DE USO
// (renderizando MapaHome de verdade) pega isso.
describe("MapaHome: o enquadramento usa a janela que a tela mostra, não a caixa de geração", () => {
  const RAMPA = { lat: -7.907889, lng: -36.019222 };

  /** Desloca uma coordenada por uma distância em metros (plano local —
   *  mesmo helper de tests/lib/mapa.test.ts, duplicado aqui de propósito:
   *  este teste não deve depender de nada exportado por mapa.ts além do que
   *  MapaHome também usa). */
  function deslocaMetros(base: { lat: number; lng: number }, dxM: number, dyM: number) {
    const metroPorGrauLat = 111320;
    const metroPorGrauLng = 111320 * Math.cos((base.lat * Math.PI) / 180);
    return { lat: base.lat + dyM / metroPorGrauLat, lng: base.lng + dxM / metroPorGrauLng };
  }

  // Ficha sintética mínima — mesmo padrão de fichaFake em tests/app/home.test.tsx.
  function fichaEm(slug: string, coords: { lat: number; lng: number }): Ficha {
    return {
      slug,
      modos: [],
      rotulo_escaneio: "",
      promessa: "",
      voz: "",
      premio: "",
      trajeto: { waypoints: [{ nome: slug, lat: coords.lat, lng: coords.lng }] },
      acesso: "",
      avisos: "",
      condicao: {
        coords,
        regra: { tipo: "chuva_binaria", janela_previsao_horas: 0, janela_passado_horas: 0, limiar_mm: 0 },
        regra_texto: "",
        ressalva_proxy: "",
      },
      discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
      custo: { tag: "gratis" },
    };
  }

  it("duas trilhas a ~60km entre si (leste-oeste): os dois pins caem dentro da janela visível, com o alvo de toque inteiro", () => {
    const fichas = [
      fichaEm("leste", deslocaMetros(RAMPA, 30_000, 0)),
      fichaEm("oeste", deslocaMetros(RAMPA, -30_000, 0)),
    ];
    const leituras: Record<string, LeituraCarimbo> = Object.fromEntries(
      fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
    );

    const { container } = render(<MapaHome fichas={fichas} leituras={leituras} />);
    const pins = Array.from(container.querySelectorAll(".pin-home")) as HTMLElement[];
    expect(pins).toHaveLength(2);

    // Mesmos limites do teste de geometria em tests/lib/mapa.test.ts, mas
    // aqui contra o DOM que MapaHome realmente produz — não contra uma
    // chamada direta de enquadrar().
    const janelaMin = (MAPA_LARGURA_PX - MAPA_JANELA_VISIVEL_HOME_PX) / 2;
    const janelaMax = (MAPA_LARGURA_PX + MAPA_JANELA_VISIVEL_HOME_PX) / 2;

    for (const pin of pins) {
      const left = parseFloat(pin.style.left);
      const top = parseFloat(pin.style.top);
      expect(left).toBeGreaterThanOrEqual(janelaMin + RAIO_ALVO_TOQUE_PX);
      expect(left).toBeLessThanOrEqual(janelaMax - RAIO_ALVO_TOQUE_PX);
      expect(top).toBeGreaterThanOrEqual(RAIO_ALVO_TOQUE_PX);
      expect(top).toBeLessThanOrEqual(MAPA_ALTURA_HOME_PX - RAIO_ALVO_TOQUE_PX);
    }
  });
});

describe("MapaHome com a localização da pessoa", () => {
  afterEach(() => { localStorage.clear(); });

  const leiturasObj = Object.fromEntries(
    fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
  );

  it("sem localização, não desenha o ponto 'você' — e o mapa é o de hoje", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leiturasObj} />);
    expect(container.querySelector(".voce-pin")).toBeNull();
  });

  // O ponto de uso: não basta enquadrarComVoce existir e ter teste — é
  // MapaHome quem tem que passar a coordenada da pessoa pra ela. Revertendo
  // essa ligação, a suíte de tests/lib/mapa.test.ts fica toda verde.
  it("com localização, aparece o ponto 'você' e os tiles mudam de lugar", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const semLocal = render(<MapaHome fichas={fichas} leituras={leiturasObj} />);
    const tilesAntes = Array.from(semLocal.container.querySelectorAll("img"))
      .map((i) => i.getAttribute("src")).join("|");
    cleanup();

    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    const tilesDepois = Array.from(container.querySelectorAll("img"))
      .map((i) => i.getAttribute("src")).join("|");
    expect(tilesDepois).not.toBe(tilesAntes);
  });

  it("trilha longe demais: avisa quantas ficaram fora do mapa", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -23.5, lng: -46.6 },
      em: 1_800_000_000, nome: "São Paulo", regiao: "São Paulo",
    }));
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("1 trilha fora do mapa");
  });

  it("continua creditando o OpenStreetMap com a localização ligada", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // ——— os quatro abaixo entraram no pré-voo desta task: sem eles, quatro
  // linhas desta implementação podiam ser apagadas com a suíte inteira verde.

  // content/fichas/ tem UMA ficha hoje, então o ramo plural do aviso nunca é
  // exercido pelo fixture real — e é o ramo que sai errado ("2 trilha fora").
  // Sintéticas, mesmo padrão do fichaFake de tests/app/home.test.tsx.
  it("duas trilhas fora: o aviso vai pro plural", async () => {
    const longe: Ficha[] = [fichaFake("uma"), fichaFake("outra")];
    const dobradas = Object.fromEntries(
      longe.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
    );
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -23.5, lng: -46.6 },
      em: 1_800_000_000, nome: "São Paulo", regiao: "São Paulo",
    }));
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={longe} leituras={dobradas} /></LocalVivo>,
    );
    await findByTestId("voce");
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("2 trilhas fora do mapa");
  });

  // O `.voce-pin` mora na CAIXA DE GERAÇÃO (MAPA_LARGURA_PX, 480), igual aos
  // pins de trilha — enquanto o ENQUADRAMENTO decide contra a janela visível
  // (350,5). Trocar uma largura pela outra no `.voce-pin` desloca a pessoa
  // 64,75px do lugar dela e nenhum teste acima acusa. Esta prova não recalcula
  // `posicaoNaCaixa` (isso seria auto-referente): põe VOCÊ exatamente em cima
  // da trilha e exige que os dois pins caiam no MESMO ponto — o que só é
  // verdade se as duas chamadas usarem a mesma largura.
  it("você em cima da trilha: o ponto 'você' cai exatamente sobre o pin dela", async () => {
    const mesma = fichaFake("mesma");
    mesma.condicao.coords = { lat: -8.2, lng: -35.56 };
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const { container, findByTestId } = render(
      <LocalVivo>
        <MapaHome
          fichas={[mesma]}
          leituras={{ mesma: { estado: "fresco", erro: false, calculadoEm: 1_800_000_000 } }}
        />
      </LocalVivo>,
    );
    await findByTestId("voce");
    const voce = container.querySelector<HTMLElement>(".voce-pin")!;
    const pin = container.querySelector<HTMLElement>(".pin-home")!;
    expect(voce.style.left).toBe(pin.style.left);
    expect(voce.style.top).toBe(pin.style.top);
  });

  // ——— ESTE veio da revisão da Task 3, e é obrigatório: é o único lugar do
  // repositório onde a largura CERTA pode ser travada.
  //
  // `enquadrarComVoce` e `foraDaJanela` são puras e recebem `larguraPx` como
  // argumento, então NENHUM teste em tests/lib/mapa.test.ts pode dizer qual
  // largura o app deve passar — a revisão da Task 3 provou isso trocando a
  // constante nos testes de lá e vendo 50/50 continuar verde. Quem decide é
  // ESTE componente, e o erro é fácil de cometer porque o mesmo arquivo usa as
  // duas: MAPA_LARGURA_PX (480) pra DESENHAR o mosaico e posicionar pins, e
  // MAPA_JANELA_VISIVEL_HOME_PX (350,5) pra DECIDIR o enquadramento e a conta
  // de quem ficou fora — a fatia central que um iPhone de 375px realmente
  // mostra dentro do overflow:hidden.
  //
  // A geometria abaixo foi calculada pra separar as duas: com a janela visível
  // dá **1 fora** (a trilha B cai em left=539,3, muito além do limite de
  // 328,5); com a caixa de geração dá **0** (left=422,0, dentro do limite de
  // 458) e o aviso SOME da tela. Os dois casos ficam a ~36px das bordas de
  // arredondamento, então não é um teste de gume de faca.
  //
  // Nota honesta sobre o alcance: neste cenário o piso do zoom entra nas duas
  // larguras (z=8 em ambas, centro em VOCÊ), então o que este teste prende é a
  // largura passada ao `foraDaJanela`. A largura do `enquadrarComVoce` fica
  // presa por tabela — se alguém passar 480 lá, o `centro`/`z` mudam nos casos
  // sem piso e os outros testes deste describe acusam.
  it("a conta de quem ficou fora usa a janela VISÍVEL, não a caixa de geração", async () => {
    const perto = fichaFake("perto");
    perto.condicao.coords = { lat: -8.2, lng: -35.56 };
    const longe = fichaFake("longe");
    longe.condicao.coords = { lat: -8.2, lng: -33.56 };
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const duas = Object.fromEntries(
      [perto, longe].map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
    );
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={[perto, longe]} leituras={duas} /></LocalVivo>,
    );
    await findByTestId("voce");
    // Com MAPA_LARGURA_PX no lugar da janela visível, este elemento nem existe.
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("1 trilha fora do mapa");
  });

  // O `"use client"` é o coração da ATENÇÃO desta task, e o jsdom NÃO o prova:
  // ele renderiza tudo como cliente, então apagar a diretiva deixa a suíte
  // inteira verde e o mapa parado no aparelho do João. Mesmo padrão de
  // asserção de fonte que tests/app/home.test.tsx já usa pro CSS.
  it("MapaHome é client component — sem isso a localização não move o mapa em produção", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src", "app", "MapaHome.tsx"), "utf8");
    expect(fonte.trimStart().startsWith('"use client"')).toBe(true);
  });
});
