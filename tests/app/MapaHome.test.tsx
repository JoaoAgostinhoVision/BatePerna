import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import { regraDe, semComentarios, valorDe } from "../css";
import MapaHome from "@/app/MapaHome";
import MioloHome from "@/app/MioloHome";
import CartaoTrilha from "@/app/CartaoTrilha";
import type { ParFolha } from "@/app/FolhaTrilhas";
import FiltrosVivos from "@/app/filtros";
import LocalVivo from "@/app/local";
import { LeiturasProvider } from "@/app/leituras";
import { getFichasComCondicao } from "@/lib/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";
import { CHAVE_GPS, CHAVE_LOCAL } from "@/lib/local";
import type { Ficha } from "@/types/ficha";
import {
  MAPA_ALTURA_HOME_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_LARGURA_PX,
  RAIO_ALVO_TOQUE_PX,
  zoomDeTiles,
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
    expect(container.textContent).toContain("Não vá");
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
  // 🔴 O corpo é lido pelo VALOR da declaração, não por `[^}]*background:` dentro
  // do bloco: aquilo casava em `--background: var(--stop); background:
  // var(--go)`. MEDIDO, 523/523 VERDE com o pin da home VERDE embaixo de um
  // selo que diz "SEM INFORMAÇÕES" — a regra ganhava a cascata e pintava a cor
  // errada, que é literalmente o que o comentário acima diz estar coberto.
  it("a regra de fase do pin ganha da cor do estado — mesma disputa de especificidade do selo", () => {
    const seletor = '.bp .pin-home[data-state][data-fase="sem-informacoes"]::before';
    const regra = regraDe(semComentarios("home.css"), seletor);
    expect(regra, `faltou a regra ${seletor} no home.css`).not.toBeNull();
    expect(valorDe(regra![0], "background"), "o pin da home parou de parar de afirmar cor de veredito")
      .toBe("var(--stop)");
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
    // 🔴 Este número está PRESO ao acervo real: São Paulo está longe de TODAS
    // as trilhas, então o aviso nomeia todas. Eram 2 em 2026-08-25 (Rampa do
    // Pepê + Pedra Furada de Venturosa). Uma terceira ficha faz este teste
    // cair, e isso é o comportamento certo: alguém tem que olhar a tela de
    // novo, não é bug. Não troque por `${fichas.length}` — asserção escrita
    // contra a própria fonte é cega ao número, que é justo o que se prova aqui.
    // O texto no SINGULAR se prova em "'N fora do mapa' conta só as VISÍVEIS",
    // com fichas sintéticas, onde a contagem não depende do conteúdo.
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("2 trilhas fora do mapa");
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
  // A GEOMETRIA, e por que ela é de TRÊS trilhas e não de duas.
  //
  // Enquanto o enquadramento COUBER, ninguém fica fora por construção: o
  // `enquadrar` encaixa tudo dentro de `larguraPx - 2×MARGEM_ENQUADRO_PX`, e
  // como a margem (28) é maior que o raio do alvo de toque (22), nenhuma
  // trilha chega perto da borda. Ou seja: só existe "trilha fora" quando o
  // PISO do zoom entra — e aí o centro do mapa é VOCÊ.
  //
  // Com o centro em você e o zoom em 8, uma trilha a `dx` pixels de você fica
  // fora da janela visível se `dx > 153,25`, e fora da caixa de geração só se
  // `dx > 218`. A faixa entre os dois é onde as duas larguras discordam — e é
  // preciso uma trilha DENTRO dessa faixa mais uma outra bem longe pra acionar
  // o piso, porque a própria trilha que aciona o piso já sai da faixa.
  //
  //   você  = {-8.2, -35.56}
  //   perto = {-8.2, -35.56}   em cima de você       → dx = 0      dentro nas duas
  //   meio  = {-8.2, -34.56}   +1,0° a leste          → dx = 182,0 FORA na visível, dentro na de geração
  //   longe = {-8.2, -41.56}   −6,0° a oeste          → dx = −1092 fora nas duas (e é quem aciona o piso)
  //
  // Conferido: com a janela visível → **2 fora**; trocando só a chamada de
  // `foraDaJanela` pra caixa de geração → **1 fora**. O `dx` do "meio" tem
  // 28,8px de folga do limite de baixo e 36,0px do de cima — não é gume de
  // faca. E é robusto ainda que alguém troque AS DUAS ocorrências da
  // constante: o piso entra igual, o centro continua em você, e a conta cai
  // pra 1 do mesmo jeito.
  it("a conta de quem ficou fora usa a janela VISÍVEL, não a caixa de geração", async () => {
    const perto = fichaFake("perto");
    perto.condicao.coords = { lat: -8.2, lng: -35.56 };
    const meio = fichaFake("meio");
    meio.condicao.coords = { lat: -8.2, lng: -34.56 };
    const longe = fichaFake("longe");
    longe.condicao.coords = { lat: -8.2, lng: -41.56 };
    const tres = [perto, meio, longe];
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const leiturasTres = Object.fromEntries(
      tres.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
    );
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={tres} leituras={leiturasTres} /></LocalVivo>,
    );
    await findByTestId("voce");
    // Com MAPA_LARGURA_PX no lugar da janela visível, a trilha "meio" passa a
    // contar como dentro e este texto vira "1 trilha fora do mapa".
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("2 trilhas fora do mapa");
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

// ——————— o CASO VAZIO: o filtro escondeu todas ———————
//
// 🔴 POR QUE ESTES TESTES MONTAM O `MioloHome`, e não só o `MapaHome`.
//
// Depois que a conta subiu (Task A), `fichas` DENTRO do `MapaHome` já É a lista
// visível — quem recorta é o `MioloHome`, uma vez só. Então mutar o recorte
// aqui dentro é impossível: não existe recorte aqui dentro. O único jeito de
// provar que o mapa desenha as VISÍVEIS é montar a ligação inteira e mexer no
// filtro, que é o que a pessoa mexe. Um teste que chamasse `<MapaHome
// fichas={[...]} />` com a lista já recortada à mão provaria só que o
// componente desenha o que recebe — e isso já tem teste lá em cima.
//
// O que se prova aqui, e cada um tem prova de mutação anotada no relatório:
//   • o aviso "N fora do mapa" conta as visíveis (era ele quem MENTIA);
//   • filtro zerou + com localização → só você, na sua vizinhança;
//   • filtro zerou + sem localização → o último enquadramento fica;
//   • sem leitura NENHUMA o mapa some — que é outro caso, e continua valendo;
//   • a caixa de digitar cidade sobrevive ao vazio.
describe("MapaHome: o filtro zerou a lista", () => {
  afterEach(() => { localStorage.clear(); });

  // Mesma geometria do teste "a conta de quem ficou fora usa a janela VISÍVEL"
  // logo acima — reaproveitada de propósito: os números dela já estão medidos e
  // documentados (dx de 0, 182 e −1092 px no zoom do piso).
  const VOCE = { lat: -8.2, lng: -35.56 };
  const PAGO = { custo: { tag: "pago" as const, valor: "R$ 5" } };

  function fichaEm(slug: string, lng: number, pago: boolean): Ficha {
    const f = fichaFake(slug);
    f.condicao.coords = { lat: VOCE.lat, lng };
    if (pago) f.custo = PAGO.custo;
    return f;
  }

  const parDe = (f: Ficha): ParFolha => ({
    ficha: f,
    leitura: { estado: "fresco", erro: false, calculadoEm: Math.floor(Date.now() / 1000) },
  });

  /** A home inteira menos a moldura, como o `page.tsx` a monta. */
  function Tela({ pares }: { pares: ParFolha[] }) {
    return (
      <LocalVivo>
        <FiltrosVivos>
          <MioloHome pares={pares} />
        </FiltrosVivos>
      </LocalVivo>
    );
  }

  const tilesDe = (c: HTMLElement) =>
    Array.from(c.querySelectorAll("img")).map((i) => i.getAttribute("src"));

  const euEstouEm = (coord: { lat: number; lng: number }) =>
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ tipo: "gps", coord, em: 1_800_000_000 }));

  const soGratis = () =>
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));

  // O defeito que motivou a rodada inteira: "2 trilhas fora do mapa" a 40px de
  // uma linha que dizia "1 trilha". Com o filtro deixando UMA visível — e ela
  // fora da janela —, o aviso tem que dizer 1. Contando o acervo, diria 2 (a
  // "meio" cai na faixa em que as duas larguras discordam, já medida acima).
  it("'N fora do mapa' conta só as VISÍVEIS — com 3 trilhas e filtro deixando 1, não diz 2", async () => {
    euEstouEm(VOCE);
    soGratis();
    const pares = [
      parDe(fichaEm("perto", -35.56, true)), // em cima de você, e paga: sai no filtro
      parDe(fichaEm("meio", -34.56, true)),  // fora da janela visível, e paga: sai no filtro
      parDe(fichaEm("longe", -41.56, false)), // a única grátis, e ela está fora
    ];

    const { container } = render(<Tela pares={pares} />);

    // O recorte precisa ter MORDIDO, senão a asserção abaixo é trivial.
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.querySelector(".voce-pin")).not.toBeNull();

    expect(container.querySelector(".mapa-fora")?.textContent).toBe("1 trilha fora do mapa");
    expect(container.querySelectorAll(".pin-home")).toHaveLength(1);
  });

  // A decisão do dono do produto: sobrou nada e eu sei onde você está → o mapa
  // vira "onde eu estou", na vizinhança (o zoom da ficha, ~26 km), e não o
  // acervo inteiro no piso do zoom.
  it("filtro zera + com localização: mostra você, sem pin nenhum, e sem aviso de 'fora'", async () => {
    euEstouEm(VOCE);
    soGratis();
    // Duas pagas e MUITO longe: com o acervo na conta, o enquadramento cairia
    // no piso (zoom 8) — é o que separa "só você" de "o acervo inteiro".
    const longe = [
      parDe(fichaEm("sp1", -46.6, true)),
      parDe(fichaEm("sp2", -46.7, true)),
    ];
    longe[0].ficha.condicao.coords = { lat: -23.5, lng: -46.6 };
    longe[1].ficha.condicao.coords = { lat: -23.5, lng: -46.7 };

    const { container } = render(<Tela pares={longe} />);

    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(0));
    expect(container.querySelector(".mapa-home")).not.toBeNull();
    const eu = container.querySelector<HTMLElement>(".voce-pin");
    expect(eu).not.toBeNull();

    // 🔴 "SÓ VOCÊ, NA SUA VIZINHANÇA" são DUAS coisas, e o teste precisa das
    // duas — MEDIDO: com só o zoom aqui, a mutação `coords.length === 0` sozinha
    // (sem o `&& !voce`) passou com os 538 verdes. Ela devolve o ÚLTIMO quadro,
    // que neste fixture também é zoom 11 (as duas pagas estão a 0,1° uma da
    // outra), e o mapa ficava centrado em São Paulo com o ponto "você" jogado
    // pra fora da janela.
    //
    //   ONDE: você no centro da caixa — só é verdade se `centro` FOR você.
    expect(eu!.style.left).toBe(`${MAPA_LARGURA_PX / 2}px`);
    expect(eu!.style.top).toBe(`${MAPA_ALTURA_HOME_PX / 2}px`);
    //   QUÃO PERTO: `enquadrarComVoce([], voce, …)` cai no ramo do ponto único
    //   e devolve o zoom da ficha (~26 km). Os tiles vêm de um zoom a mais
    //   (MAPA_ESCALA), que é o que `zoomDeTiles()` diz. No piso seria 8 → 9.
    expect(tilesDe(container)[0]).toContain(`/${zoomDeTiles()}/`);
    expect(container.querySelectorAll(".pin-home")).toHaveLength(0);
    expect(container.querySelector(".mapa-fora")).toBeNull();
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // Sem trilha e sem você não há o que enquadrar, e saltar pra lugar nenhum é
  // pior que ficar parado. O "antes" não é um número escrito aqui: é o mapa que
  // as MESMAS duas trilhas desenham quando o filtro não está ligado.
  it("filtro zera + SEM localização: mantém o enquadramento que tinha", async () => {
    const duas = [fichaEm("a", -35.56, true), fichaEm("b", -34.56, true)];
    const leiturasDuas = Object.fromEntries(
      duas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
    );

    const antes = render(<MapaHome fichas={duas} leituras={leiturasDuas} />);
    const tilesAntes = tilesDe(antes.container);
    expect(tilesAntes.length).toBeGreaterThan(0);
    cleanup();

    // O primeiro render é sempre sem filtro (invariante da rodada passada), e é
    // ele quem deixa o enquadramento guardado; o efeito lê o aparelho logo
    // depois e zera a lista.
    soGratis();
    const { container } = render(<Tela pares={duas.map(parDe)} />);

    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(0));
    expect(container.querySelector(".mapa-home")).not.toBeNull();
    expect(tilesDe(container)).toEqual(tilesAntes);
    expect(container.querySelectorAll(".pin-home")).toHaveLength(0);
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // 🔴 HERDADO, e é um caso DIFERENTE: aqui o clima não respondeu por trilha
  // nenhuma. O mapa some de verdade — não há o que mostrar e não há o que
  // lembrar. Confundir os dois faria o app desenhar caixa cinza toda vez que a
  // busca de leitura falhasse.
  it("sem NENHUMA leitura o mapa continua sumindo (é outro caso)", () => {
    const { container } = render(<MapaHome fichas={[fichaFake("orfa")]} leituras={{}} />);
    expect(container.innerHTML).toBe("");
  });

  // O irmão dele, e é o que separa os dois: acervo VAZIO não é leitura
  // faltando. Sem quadro anterior nenhum não dá pra desenhar mosaico, mas a
  // moldura fica de pé — a altura não salta e a pílula continua na tela.
  it("sem ficha nenhuma e sem quadro anterior: a moldura fica, sem mosaico", () => {
    const { container } = render(<MapaHome fichas={[]} leituras={{}} />);
    expect(container.querySelector(".mapa-home")).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector(".mapa-pilula")).not.toBeNull();
    expect(container.textContent).toContain("OpenStreetMap");
  });

  // 🔴 A ALTURA, e ela é o PONTO DECLARADO da decisão do vazio: "o mapa some e
  // volta com 168px, e a folha inteira salta embaixo do dedo de quem mexe no
  // filtro". Os testes acima provavam a moldura, o mosaico ausente, a pílula e
  // o crédito — nunca a altura, que é a promessa.
  //
  // jsdom não faz layout, então a altura se mede onde ela mora: a caixa que o
  // vazio desenha tem que ser A MESMA que o mapa cheio desenha, e a regra dessa
  // caixa tem que cravar MAPA_ALTURA_HOME_PX. As duas metades juntas, porque
  // separadas nenhuma responde: só a classe não diz quanto ela mede, e só a
  // regra não diz que o vazio a usa.
  //
  // Não confundir com o guarda de tests/lib/home-layout.test.ts, que lê a mesma
  // regra: lá a pergunta é "o orçamento da dobra fecha"; aqui é "o vazio e o
  // cheio ocupam a mesma caixa". Reverter esta task deixa aquele verde.
  it("o vazio ocupa a MESMA altura do mapa cheio — senão a folha salta embaixo do dedo", () => {
    const uma = fichaEm("uma", -35.56, false);
    const cheio = render(
      <MapaHome
        fichas={[uma]}
        leituras={{ uma: { estado: "fresco", erro: false, calculadoEm: 1_800_000_000 } }}
      />,
    );
    const caixaCheia = cheio.container.firstElementChild;
    expect(caixaCheia).not.toBeNull();
    cleanup();

    const vazio = render(<MapaHome fichas={[]} leituras={{}} />);
    const caixaVazia = vazio.container.firstElementChild;
    expect(caixaVazia, "o vazio não desenhou caixa nenhuma: a folha salta 168px").not.toBeNull();

    // Mesma caixa nos dois estados — é o que faz a altura não mudar.
    expect(caixaVazia!.className).toBe(caixaCheia!.className);

    // E é a REGRA dessa caixa que crava os 168px. O `.mapa-home-tiles` de
    // dentro não serve: ele é `position: absolute` e contribui altura zero.
    const seletor = `.bp .${caixaVazia!.className}`;
    const regra = regraDe(semComentarios("home.css"), seletor);
    expect(regra, `faltou a regra ${seletor} no home.css`).not.toBeNull();
    expect(valorDe(regra![0], "height")).toBe(`${MAPA_ALTURA_HOME_PX}px`);
  });

  // 🔴 A RESTRIÇÃO QUE A REVISÃO DA TASK A ACHOU. A caixa de digitar cidade
  // mora DENTRO do `MapaHome`. Quem negou o GPS e zerou a lista com "só grátis"
  // depende dela pra dizer onde está — e é justamente nesse instante que um
  // `return null` no vazio a apagaria da tela. O caminho fica: a pílula está
  // lá, e o toque abre a busca.
  it("com o filtro zerando, ainda dá pra dizer onde estou", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    soGratis();
    const { container } = render(<Tela pares={[parDe(fichaEm("paga", -35.56, true))]} />);

    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(0));

    const pilula = container.querySelector<HTMLElement>(".mapa-pilula");
    expect(pilula, "sem a pílula não sobra jeito nenhum de dizer onde estou").not.toBeNull();
    expect(pilula!.textContent).toBe("escolher onde estou");

    await act(async () => { pilula!.click(); });
    expect(container.querySelector(".busca-campo")).not.toBeNull();
  });
});
