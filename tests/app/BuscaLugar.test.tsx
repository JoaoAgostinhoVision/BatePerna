import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent, within } from "@testing-library/react";
import BuscaLugar, { ESPERA_MS } from "@/app/BuscaLugar";
import LocalVivo from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL, CHAVE_SESSAO, MARCA_SESSAO } from "@/lib/local";
import { readFileSync } from "node:fs";
import path from "node:path";
import { regraDe, semComentarios, valorDe } from "../css";

// `ESPERA_MS` sai EXPORTADO de BuscaLugar.tsx (o Step 3 abaixo já traz o
// `export`). Mesmo precedente do `zoomDeTiles()` em src/lib/mapa.ts —
// "exportado (em vez de inline no componente) pra esse invariante ter teste".
// Assim os testes de relógio avançam o tempo pelo valor REAL: mudar a espera
// não faz um teste mentir, e não trava o valor a um número escrito à mão.

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); });

const GRAVATA = { nome: "Gravatá", regiao: "Pernambuco", pais: "Brasil", lat: -8.2, lng: -35.56 };
// Segunda cidade, pros dois testes de relógio falso lá embaixo. Nome diferente
// de propósito — a REGIÃO das duas é a mesma (Pernambuco), então asserção por
// região não distinguiria uma da outra.
const RECIFE = { nome: "Recife", regiao: "Pernambuco", pais: "Brasil", lat: -8.05, lng: -34.9 };

function comLocalVivo() {
  return render(<LocalVivo><BuscaLugar /></LocalVivo>);
}

describe("a pílula", () => {
  it("sem localização e sem gps negado, convida", () => {
    comLocalVivo();
    expect(screen.getByRole("button", { name: /Ver daqui/ })).toBeTruthy();
  });

  it("com gps negado, oferece o caminho manual", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /escolher onde estou/ })).toBeTruthy();
  });

  it("com lugar escolhido, diz o nome dele", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /de Gravatá/ })).toBeTruthy();
  });

  // "Ver daqui" é o toque que pede o GPS — a promessa do "um toque na vida".
  // Desde a Task 1 do review do celular o `<LocalVivo>` já pede sozinho ao
  // montar, então a asserção mede a chamada A MAIS que o toque faz, não a
  // primeira (que já aconteceu antes do clique).
  it("'Ver daqui' pede o GPS, não abre a busca", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    await act(async () => {});
    const chamadasAntes = pediu.mock.calls.length;
    await act(async () => { screen.getByRole("button", { name: /Ver daqui/ }).click(); });
    expect(pediu.mock.calls.length).toBeGreaterThan(chamadasAntes);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // Mesma ressalva: com gps já negado, a montagem também chama
  // `getCurrentPosition` sozinha (o navegador só não pergunta de novo — a
  // chamada em si não é o que este teste proíbe). O que este teste prova é
  // que o TOQUE na pílula não soma mais uma chamada — ele abre a busca.
  it("com gps negado, o toque abre a busca em vez de pedir de novo", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    const chamadasAntes = pediu.mock.calls.length;
    await act(async () => { b.click(); });
    expect(pediu.mock.calls.length).toBe(chamadasAntes);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("a busca", () => {
  async function abrir() {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { b.click(); });
  }

  // ——— o caminho de volta pro GPS (pedido do João, 2026-08-23) ———
  //
  // 🔴 Isto conserta um beco PRÉ-EXISTENTE, não desta rodada: com uma cidade
  // escolhida, `soGps` é falso, o toque na pílula abre a busca, e a busca só
  // oferecia outras cidades. `pedirGps` ficava sem nenhum chamador.
  it("o painel oferece o 'daqui' e o toque PEDE o GPS", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    render(<LocalVivo><BuscaLugar /></LocalVivo>);
    const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
    await act(async () => { pilula.click(); });
    const volta = screen.getByRole("button", { name: /^daqui$/i });
    const antes = pediu.mock.calls.length;
    await act(async () => { volta.click(); });
    expect(pediu.mock.calls.length).toBeGreaterThan(antes);
    // Fecha o painel, igual a escolher uma cidade já faz. Sem esta metade, um
    // botão que pede o GPS e deixa a busca aberta por cima do mapa passaria.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // Regra da casa (é o mesmo argumento do `rotuloPilula`): negado uma vez, o
  // navegador não pergunta de novo — o item viraria um botão que não faz nada.
  it("com gps negado, o 'daqui' NÃO aparece", async () => {
    await abrir();  // o helper já grava bp.gps = "negado"
    expect(screen.queryByRole("button", { name: /^daqui$/i })).toBeNull();
    // Não-vacuidade: o painel ESTÁ aberto. Sem esta linha, o teste passa com o
    // componente inteiro apagado — é a família "teste de ausência sem o irmão
    // de presença é meia prova".
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  // 🔴 POSICIONAL, e com a LISTA CHEIA — que é o cenário em que a posição
  // importa: é quando a lista cresce que o que mora dentro da caixa que rola
  // sai de vista (medido em 375×667: 168px visíveis de 344px de conteúdo).
  //
  // ⚠️ Uma versão anterior deste teste rodava com o campo VAZIO, porque a
  // primeira correção do Critical apagava o botão assim que se digitava. O João
  // usou e pediu o contrário — o botão agora divide a primeira linha com o
  // campo e fica na tela o tempo todo —, então o cenário forte voltou a ser
  // possível e é o que se mede aqui.
  it("o 'daqui' fica FORA da caixa que rola, com a lista cheia", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([GRAVATA, RECIFE, GRAVATA, RECIFE, GRAVATA]),
    );
    // 🔴 Uma cidade escolhida É A PRÉ-CONDIÇÃO de o toque ABRIR o painel: com
    // `local` = "não sei" e `gps` = "nunca", `soGps` é true e a pílula PEDE o
    // GPS em vez de abrir. O marcador de sessão vai junto porque, sem ele, a
    // Task 2 faz a escolha vencer e o app volta pro estado "não sei".
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: Math.floor(Date.now() / 1000), nome: "Gravatá", regiao: "Pernambuco",
    }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    render(<LocalVivo><BuscaLugar /></LocalVivo>);
    const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
    await act(async () => { pilula.click(); });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    await screen.findAllByText(/Pernambuco/);

    const volta = screen.getByRole("button", { name: /^daqui$/i });
    expect(volta.closest(".busca-rolo"), "o item voltou pra dentro da caixa que rola").toBeNull();
    expect(volta.closest(".busca"), "o item saiu do painel de busca").not.toBeNull();
  });

  // ——— o botão divide a PRIMEIRA LINHA com o campo (decisão do João, 2026-08-23) ———
  //
  // 🔴 CRITICAL da revisão da branch: o botão entrava como filho direto de flex
  // do `.busca` (altura fixa 168px, `overflow: hidden`), e o único irmão
  // elástico é o `.busca-rolo`. MEDIDO em Chrome headless 375×667 com o CSS
  // real: os 44px do botão mais o gap saíam INTEIROS do orçamento da lista —
  // `.busca-rolo` caiu de 70,09px pra 19,70px, e o primeiro resultado aparecia
  // cortado pela metade (19,70 de 44px, 45%).
  //
  // A primeira correção escondeu o botão enquanto se digitava. **O João usou e
  // pediu o contrário:** ele quer poder ir pro GPS NO MEIO da digitação. A saída
  // que atende os dois é geométrica — o campo e o botão LADO A LADO custam UMA
  // linha de 44px, a mesma que o campo sozinho custava, e a lista fica com os
  // ~70px que sempre teve. O custo caiu na LARGURA do campo (353px → ~277px),
  // não na altura da lista.
  describe("o botão 'daqui' e o campo dividem a primeira linha", () => {
    async function abrirComCidadeEscolhida() {
      vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: vi.fn() } });
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
        tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
        em: Math.floor(Date.now() / 1000), nome: "Gravatá", regiao: "Pernambuco",
      }));
      sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
      render(<LocalVivo><BuscaLugar /></LocalVivo>);
      const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
      await act(async () => { pilula.click(); });
    }

    it("campo vazio: o botão está lá", async () => {
      await abrirComCidadeEscolhida();
      expect(screen.getByRole("button", { name: /^daqui$/i })).toBeTruthy();
    });

    // 🔴 O PEDIDO DELE, e é o oposto do que a primeira correção fez: com a
    // lista de cidades na tela, o caminho pro GPS CONTINUA à mão.
    it("com a lista de cidades na tela, o botão CONTINUA lá", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
      await abrirComCidadeEscolhida();
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
      await screen.findAllByText(/Pernambuco/);
      expect(screen.getByRole("button", { name: /^daqui$/i })).toBeTruthy();
    });

    // 🔴 A METADE GEOMÉTRICA, e é ela que impede o Critical de voltar: os dois
    // no MESMO elemento é o que os faz custar 44px em vez de 88. Sem esta
    // prova, alguém "arruma" o JSX tirando o botão da linha, o teste de
    // presença acima continua verde, e a lista volta a 19,70px.
    it("o campo e o botão estão na MESMA linha — é isso que os faz custar 44px, não 88", async () => {
      await abrirComCidadeEscolhida();
      const linha = document.querySelector(".busca-linha") as HTMLElement | null;
      expect(linha, "faltou a .busca-linha").not.toBeNull();
      expect(linha!.querySelector(".busca-campo"), "o campo saiu da linha").not.toBeNull();
      expect(within(linha!).getByRole("button", { name: /^daqui$/i })).toBeTruthy();
    });

    // 🔴 O ORÇAMENTO DE ALTURA, e é o que faltava na suíte inteira — é por isso
    // que o Critical passou por oito revisões. jsdom não mede pixel, então a
    // prova é ESTRUTURAL e ARITMÉTICA: com resultados na tela, o `.busca` tem
    // que ter EXATAMENTE os filhos que cabem no orçamento (a LINHA do campo +
    // rolo + crédito) — nenhum irmão de 44px a mais competindo com a lista pelo
    // espaço fixo de 168px do painel.
    //
    // Medido em Chrome headless 375×667 com o CSS real, quando o botão era
    // filho direto: o `.busca-rolo` caiu de 70,09px pra 19,70px, e o primeiro
    // resultado (44px) apareceu cortado a 45%. Lado a lado dentro da
    // `.busca-linha`, os dois voltam a custar UMA linha.
    //
    // ⚠️ A asserção é a LISTA EXATA de classes, não "não contém o botão": assim
    // ela pega QUALQUER filho fixo novo que alguém acrescente aqui, não só este.
    it("com lista na tela, o painel tem só os três filhos que cabem no orçamento — nenhum irmão fixo a mais", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
      await abrirComCidadeEscolhida();
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
      await screen.findAllByText(/Pernambuco/);

      const painel = document.querySelector(".busca");
      expect(painel, "painel de busca sumiu").not.toBeNull();
      const filhos = Array.from(painel!.children).map((el) => el.className);
      expect(filhos, "o painel ganhou (ou perdeu) um filho — orçamento de altura mudou")
        .toEqual(["busca-linha", "busca-rolo", "busca-fonte"]);
    });

    // 🔴 O CSS que sustenta a geometria, e ele tem TRÊS metades que só juntas
    // seguram: a linha não pode encolher (`flex: none`), ela tem que ser flex
    // (senão o botão cai pra baixo e vira uma segunda linha de 44px), e o campo
    // tem que poder ENCOLHER — item de flex nasce com `min-width: auto`, que o
    // proibiria de ficar menor que o conteúdo e empurraria o botão pra fora do
    // painel de 375px.
    // 🔴 PROVA DE CASCATA, e ela é de uma espécie que esta suíte NÃO TINHA.
    //
    // Todos os outros testes de CSS deste repo leem o ARQUIVO e conferem uma
    // regra por vez (`regraDe`/`valorDe`). Isso é estruturalmente cego à
    // interação entre DUAS classes no MESMO elemento: o botão carrega
    // `busca-item busca-daqui`, e nenhuma leitura de regra isolada diz qual
    // das duas ganha.
    //
    // O defeito que isto pega foi REAL e chegou a ser commitado: escrito como
    // `.bp .busca-daqui`, o seletor empatava em especificidade com
    // `.bp .busca-item` (0,2,0 nos dois) e PERDIA por vir antes no arquivo.
    // Medido em Chrome headless e reproduzido aqui: o botão saía
    // `display: block`, `width: 100%`, `text-align: left` — tomava a primeira
    // linha inteira e espremia o campo de digitar até ~24px, só padding e
    // borda. Era pior que o Critical que esta mudança existe pra corrigir, e
    // a suíte inteira ficava verde.
    //
    // A prova é o DOM de verdade (o componente renderiza) + a folha de estilo
    // de verdade (o arquivo entra no documento) + o `getComputedStyle` do
    // jsdom, que resolve especificidade e ordem. Não é o arquivo lido como
    // texto.
    // ⚠️ E ESTA PROVA QUASE NASCEU OCA — o tropeço vale escrito. A primeira
    // versão renderizava como os testes vizinhos, sem ancestral `.bp`. Só que
    // TODA regra deste arquivo é `.bp .algo`, e o `.bp` mora no `<main>` do
    // `Moldura`/`page.tsx`, que este teste não monta: nenhuma regra casava,
    // `getComputedStyle` devolvia o padrão do jsdom, e o `not.toBe("100%")`
    // passava com **zero CSS aplicado**. Daí a raiz `.bp` explícita abaixo e,
    // principalmente, a ASSERÇÃO DE NÃO-VACUIDADE: um valor que só pode ter
    // vindo da folha. Sem ela, esta prova inteira é decoração.
    it("a cascata deixa o BOTÃO ganhar do item de lista — as duas classes no mesmo elemento", async () => {
      const folha = document.createElement("style");
      folha.textContent = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
      document.head.appendChild(folha);
      const raiz = document.createElement("main");
      raiz.className = "bp";
      document.body.appendChild(raiz);
      try {
        localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
          tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
          em: Math.floor(Date.now() / 1000), nome: "Gravatá", regiao: "Pernambuco",
        }));
        sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
        vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: vi.fn() } });
        render(<LocalVivo><BuscaLugar /></LocalVivo>, { container: raiz });
        const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
        await act(async () => { pilula.click(); });

        // 🔴 NÃO-VACUIDADE, e ela vem primeiro de propósito: os 16px do campo
        // só existem na folha (é a regra que impede o Safari de dar zoom ao
        // focar). Se ela não casou, nada abaixo significa coisa alguma.
        const campo = screen.getByRole("textbox");
        expect(getComputedStyle(campo).fontSize, "a folha de estilo NÃO está sendo aplicada — o resto deste teste é vácuo")
          .toBe("16px");

        // O requisito, escrito contra o que o `.busca-item` IMPORIA se ganhasse
        // a cascata. Foi exatamente esse o defeito medido: o botão saía com os
        // três valores do item de LISTA e tomava a primeira linha inteira,
        // espremendo o campo até ~24px.
        const botao = screen.getByRole("button", { name: /^daqui$/i });
        const lido = getComputedStyle(botao);
        expect(lido.width, "o `.busca-item` ganhou a cascata: o botão estica pela linha e esmaga o campo")
          .not.toBe("100%");
        expect(lido.display, "o `.busca-item` ganhou a cascata no display").not.toBe("block");
        expect(lido.textAlign, "o `.busca-item` ganhou a cascata no alinhamento").not.toBe("left");
        // A metade que NÃO pode ser sobrescrita: o alvo de toque de 44px vem
        // do `.busca-item`, e desfazê-lo por acidente deixaria o botão menor
        // que o mínimo tocável do resto do app.
        expect(lido.minHeight, "o alvo de toque de 44px se perdeu").toBe("44px");
      } finally {
        folha.remove();
        raiz.remove();
      }
    });

    it("a linha é flex, não encolhe, e o campo pode encolher", () => {
      const css = semComentarios("home.css");
      const linha = regraDe(css, ".busca-linha");
      expect(linha, "faltou a regra .busca-linha").not.toBeNull();
      expect(valorDe(linha![0], "display"), "a linha parou de ser flex — o botão cai pra baixo").toBe("flex");
      expect(valorDe(linha![0], "flex"), "a linha passou a encolher").toBe("none");
      const campo = regraDe(css, ".busca-campo");
      expect(campo, "faltou a regra .busca-campo").not.toBeNull();
      expect(valorDe(campo![0], "min-width"), "sem min-width:0 o campo empurra o botão pra fora").toBe("0");
    });
  });

  it("mostra a região de cada resultado — sem ela o dedo acerta o lugar errado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    expect(await screen.findByText(/Pernambuco/)).toBeTruthy();
  });

  it("escolher um resultado guarda a localização e fecha a busca", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    const item = await screen.findByText(/Pernambuco/);
    await act(async () => { (item.closest("button") as HTMLButtonElement).click(); });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });

  it("serviço fora do ar: diz que não conseguiu buscar, não 'nada encontrado'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Recife" } });
    expect(await screen.findByText(/não consegui buscar/i)).toBeTruthy();
  });

  // Crédito do GeoNames: CC-BY exige atribuição visível E com link. O
  // `© OpenStreetMap` do mapa já tem teste próprio pelo mesmo motivo — este
  // app trata atribuição como obrigação, e obrigação sem teste é obrigação que
  // some no primeiro refactor de layout.
  it("credita o GeoNames com link, como a licença CC-BY exige", async () => {
    await abrir();
    const link = screen.getByRole("link", { name: /GeoNames/i });
    expect(link.getAttribute("href")).toContain("geonames.org");
  });

  // 🔴 "Existe no DOM" não é "visível". MEDIDO em 375×667 com cinco
  // resultados: o painel mostrava 168px de 344px de conteúdo e o crédito
  // nascia 144px ABAIXO do fim visível — dentro de uma caixa que rola sem
  // nenhuma dica de que rola. CC-BY pede atribuição VISÍVEL; o teste acima
  // passava com o crédito escondido.
  //
  // jsdom não mede pixel, então a prova é ESTRUTURAL, nos dois elos: o crédito
  // não é descendente da caixa que rola (DOM), e a caixa que rola é o
  // `.busca-rolo`, não o painel inteiro (CSS). Cada elo sozinho passa com o
  // defeito de volta.
  it("o crédito do GeoNames fica FORA da caixa que rola — atribuição escondida não é atribuição", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([GRAVATA, RECIFE, GRAVATA, RECIFE, GRAVATA]),
    );
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    await screen.findAllByText(/Pernambuco/);

    const credito = screen.getByRole("link", { name: /GeoNames/i }).closest(".busca-fonte");
    expect(credito, "o crédito perdeu a classe .busca-fonte").not.toBeNull();
    expect(
      credito!.closest(".busca-rolo"),
      "o crédito voltou pra dentro da caixa que rola — ele sai da tela com a lista cheia",
    ).toBeNull();

    const css = semComentarios("home.css");
    const painel = regraDe(css, ".busca");
    const rolo = regraDe(css, ".busca-rolo");
    expect(painel, "faltou a regra .busca").not.toBeNull();
    expect(rolo, "faltou a regra .busca-rolo — não existe caixa de rolagem separada").not.toBeNull();
    // Ancorado: `/overflow-y:\s*auto/` casava dentro de `--overflow-y: auto`, e
    // MEDIDO deixava a suíte verde com a lista inteira inalcançável.
    expect(valorDe(rolo![0], "overflow-y"), "a .busca-rolo parou de rolar — os resultados de baixo ficam inalcançáveis")
      .toBe("auto");
    // Pelo VALOR, não por uma negação sobre o bloco: negação casa em comentário
    // e em custom property e dá alarme falso. O painel corta, nunca rola.
    expect(valorDe(painel![0], "overflow"), "o painel de busca parou de cortar")
      .toBe("hidden");
    expect(valorDe(painel![0], "overflow-y"), "a rolagem voltou pro painel inteiro — o crédito rola junto")
      .toBeNull();
    // 🔴 NÃO tem asserção sobre o `min-height: 0` do `.busca-rolo`. Ele estava
    // no plano deste conserto e a mutação NÃO MORDEU: medido em 375×667, tirar
    // só ele deixa a caixa em 70,05px e o crédito visível do mesmo jeito —
    // flexbox zera o mínimo automático de quem é container de rolagem, então
    // enquanto o `overflow-y: auto` estiver lá ele é redundante. A linha fica
    // como cinto (comentada como tal no home.css); a asserção sairia mentindo
    // que ela carrega alguma coisa, que é a família de teste que este fix round
    // inteiro existe pra tirar.
  });

  // ——— OS DOIS ABAIXO VIERAM DO PRÉ-VOO, e são os mais importantes do arquivo.
  //
  // O `ESPERA_MS` e o guarda `meu === pedido.current` são as duas linhas desta
  // task com comentário que as justifica e ZERO teste — a família exata que já
  // custou cinco fix rounds nesta rodada. Apagar as duas deixava tudo verde:
  // os outros testes usam `findByText`, que espera até 1000ms e portanto não
  // percebe se a busca dispara a cada tecla; e nenhum deles tem duas
  // requisições em voo, que é a única situação em que o guarda faz algo.
  //
  // Os dois precisam de relógio falso. **Isso é chato e pode brigar com o
  // `act`** — se brigar, PARE e relate o que observou em vez de enfraquecer a
  // asserção. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` e devolva com
  // `vi.useRealTimers()` no fim de cada um, pra não vazar pros vizinhos que
  // rodam com relógio de verdade.

  it("espera a digitação parar: três letras, uma requisição só", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
      await abrir();
      const campo = screen.getByRole("textbox");
      fireEvent.change(campo, { target: { value: "G" } });
      fireEvent.change(campo, { target: { value: "Gr" } });
      fireEvent.change(campo, { target: { value: "Gra" } });
      // Antes da espera vencer, nada saiu do aparelho.
      expect(spy).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });
      // Uma requisição só, e com a ÚLTIMA letra — não três, nem a primeira.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain("q=Gra");
    } finally {
      vi.useRealTimers();
    }
  });

  // O guarda da corrida. Sem ele, a resposta de "Gravatá" chegando DEPOIS da
  // de "Recife" repinta a lista com o lugar errado — e a pessoa toca no que
  // está na tela achando que é o que ela pediu. Some da tela a cidade certa e
  // entra a errada, sem erro nenhum. Esta é a única forma de reproduzir: duas
  // requisições em voo, resolvidas fora de ordem.
  it("resposta velha chegando depois não sobrescreve a busca nova", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let soltarVelha!: (r: Response) => void;
      const velha = new Promise<Response>((r) => { soltarVelha = r; });
      vi.spyOn(globalThis, "fetch")
        .mockImplementationOnce(() => velha)
        .mockImplementationOnce(async () => Response.json([RECIFE]));

      await abrir();
      const campo = screen.getByRole("textbox");
      fireEvent.change(campo, { target: { value: "Gravatá" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });
      fireEvent.change(campo, { target: { value: "Recife" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });

      // A nova já pintou. Agora a VELHA responde, atrasada.
      // Asserção pelo NOME, não pela região: Recife e Gravatá são as duas de
      // Pernambuco, e um teste que olhasse "Pernambuco" passaria com qualquer
      // uma das duas na tela — provando nada.
      expect(await screen.findByText("Recife")).toBeTruthy();
      await act(async () => { soltarVelha(Response.json([GRAVATA])); await vi.advanceTimersByTimeAsync(10); });

      // Recife continua na tela; Gravatá não entrou.
      expect(screen.getByText("Recife")).toBeTruthy();
      expect(screen.queryByText("Gravatá")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // Task 6, fix round: a mutação `encodeURIComponent(q)` → `q` não mordia
  // nenhum teste existente — todos buscam nomes sem caractere especial. Sem
  // encode, "&" na query string ABRE UM PARÂMETRO NOVO em vez de fazer parte
  // do valor: `q=A&B` vira `q=A` pro servidor, o resto ("B") some sem erro
  // nenhum na tela. Por isso o caractere do teste é "&", não um acento — a
  // Task 5 mostrou que fetch/jsdom pode normalizar acento e "provar" nada.
  it("o texto digitado chega inteiro na URL — '&' não abre um parâmetro novo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
      await abrir();
      const campo = screen.getByRole("textbox");
      fireEvent.change(campo, { target: { value: "A&B" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(ESPERA_MS + 50); });
      expect(spy).toHaveBeenCalledTimes(1);
      // Codificado, "&" vira %26 e sobrevive dentro do valor de "q". Sem
      // encode, a URL teria "q=A&B" — dois parâmetros, "B" perdido.
      expect(String(spy.mock.calls[0][0])).toContain("q=A%26B");
    } finally {
      vi.useRealTimers();
    }
  });

  it("busca sem resultado diz que não achou", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xyzabc" } });
    expect(await screen.findByText(/não achei/i)).toBeTruthy();
  });

  // 🔴 A QUARTA IRMÃ do decoy `--`, e é a que guarda o iPhone do dono do
  // projeto. `toMatch(/font-size:\s*16px/)` sobre o bloco inteiro casa dentro
  // de `--font-size: 16px; font-size: 13px` — mutação provada, suíte VERDE, e
  // o que esse 16 segura está em maiúsculas no próprio CSS: abaixo de 16px o
  // Safari do iPhone dá ZOOM sozinho ao focar o campo e a tela salta. Ancorado
  // no `valorDe` (tests/css.ts), que exige a propriedade começando a
  // declaração e compara o VALOR.
  it("o campo tem 16px — abaixo disso o Safari dá zoom sozinho ao focar e a tela salta", () => {
    const regra = regraDe(semComentarios("home.css"), ".busca-campo");
    expect(regra, "faltou a regra .busca-campo").not.toBeNull();
    expect(valorDe(regra![0], "font-size"), "o campo desceu de 16px — o Safari vai dar zoom")
      .toBe("16px");
  });

  // O segundo toque na pílula é o ÚNICO jeito de fechar a busca sem escolher
  // um resultado. Sem essa prova, o ternário `soGps ? pedirGps() :
  // setFase(fase === "aberto" ? "fechado" : "aberto")` pode virar
  // `setFase("aberto")` fixo em silêncio, e a pessoa fica presa na tela de
  // busca até escolher alguma cidade — inclusive uma errada, só pra sair
  // dali. O rótulo da pílula não muda com `fase` (rotuloPilula só olha
  // `local`/`gps`), então o mesmo seletor de `abrir()` continua valendo.
  it("o segundo toque na pílula fecha a busca sem escolher nada", async () => {
    await abrir();
    expect(screen.getByRole("textbox")).toBeTruthy();
    const pilula = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { pilula.click(); });
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // O `"use client"` é o que faz `getCurrentPosition`/`fetch` disparar a
  // partir de clique de verdade no aparelho. jsdom não distingue server de
  // client component — apagar a diretiva deixa a suíte inteira verde e o
  // recurso morto em produção. Mesmo padrão de asserção de fonte do
  // `MapaHome.tsx` em tests/app/MapaHome.test.tsx (Task 4: apagar a diretiva
  // lá deixou 26 de 27 testes verdes — só essa asserção acusou).
  it("BuscaLugar é client component — sem isso o GPS e a busca não disparam em produção", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src", "app", "BuscaLugar.tsx"), "utf8");
    expect(fonte.trimStart().startsWith('"use client"')).toBe(true);
  });
});
