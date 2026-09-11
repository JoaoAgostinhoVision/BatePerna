import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act, screen, waitFor } from "@testing-library/react";
import MioloHome from "@/app/MioloHome";
import type { ParFolha } from "@/app/FolhaTrilhas";
import FiltrosVivos from "@/app/filtros";
import { LeiturasProvider } from "@/app/leituras";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";
import { CHAVE_LOCAL } from "@/lib/local";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import type { Ficha } from "@/types/ficha";

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

// Mesmo padrão sintético dos outros arquivos de teste da home (fichaFake): só
// os campos que o miolo, o mapa e o cartão leem. `content/fichas/` tem UMA
// ficha hoje, e não dá pra provar "três desenham a mesma lista" com uma.
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

      severidade: "nao-va",
      regra_texto: "",
      ressalva_proxy: "",
    },
    discriminador: { formato: "", como_ler: "", permissao_abortar: "" },
    custo: { tag: "gratis" },
  };
}

const PAGO = { custo: { tag: "pago" as const, valor: "R$ 5" } };

const agoraSeg = () => Math.floor(Date.now() / 1000);

const par = (slug: string, estado: "fresco" | "frio", over: Partial<Ficha> = {}): ParFolha => ({
  ficha: { ...fichaFake(slug), ...over },
  leitura: { estado, erro: false, calculadoEm: agoraSeg() },
});

/** A home inteira menos a moldura: é assim que o `page.tsx` monta o miolo.
 *  `vivas` é a leitura que chega DEPOIS do primeiro paint (o contexto), como
 *  o `HomeViva` publica em produção. */
function Tela({ pares, vivas }: { pares: ParFolha[]; vivas?: Map<string, LeituraCarimbo> }) {
  return (
    <LocalVivo>
      <FiltrosVivos>
        <LeiturasProvider value={vivas ?? null}>
          <MioloHome pares={pares} />
        </LeiturasProvider>
      </FiltrosVivos>
    </LocalVivo>
  );
}

// ——— os três leitores da MESMA lista, lidos do DOM que foi realmente
// desenhado. Nenhum deles é um número escrito neste arquivo: a prova é a
// comparação entre eles.
const pinsNaTela = (c: HTMLElement) =>
  Array.from(c.querySelectorAll(".pin-home")).map((a) => a.getAttribute("href")!.slice(1));

const cartoesNaTela = (c: HTMLElement) =>
  Array.from(c.querySelectorAll(".cartao")).map((el) => el.id);

/** O número que a linha de resumo ESCREVEU, lido de volta do texto dela. */
const contaDaLinha = (c: HTMLElement) => {
  const texto = c.querySelector(".filtro-conta")?.textContent ?? "";
  const m = texto.match(/^(\d+)\s+trilhas?/);
  return m ? Number(m[1]) : NaN;
};

afterEach(() => { cleanup(); localStorage.clear(); });

// ——————— a JUNÇÃO: os três desenham da mesma lista ———————
//
// É o teste que esta task existe pra ter. O defeito medido pela revisão da
// branch anterior: 3 pins, 1 cartão, "1 trilha" na linha e "2 trilhas fora do
// mapa" logo acima dela — três contas diferentes na mesma tela.
describe("MioloHome: pins, contagem e cartões saem de UMA lista só", () => {
  it("com filtro ligado, pins, contagem e cartões são a MESMA lista", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const todas = [par("zebra", "fresco"), par("caro", "fresco", PAGO), par("morro", "frio")];

    const { container } = render(<Tela pares={todas} />);

    // O recorte precisa ter MORDIDO — senão as igualdades abaixo são triviais
    // (com tudo visível, três contas erradas iguais também passariam).
    await waitFor(() => {
      expect(cartoesNaTela(container).length).toBeLessThan(todas.length);
    });
    const cartoes = cartoesNaTela(container);
    expect(cartoes.length).toBeGreaterThan(0);

    // 🔴 A asserção é ENTRE os três, não contra um número que eu escrevi: um
    // número meu provaria a mesma suposição minha três vezes.
    expect([...pinsNaTela(container)].sort()).toEqual([...cartoes].sort());
    expect(contaDaLinha(container)).toBe(cartoes.length);
  });

  // O quadro que o Critical de duas rodadas atrás produziu: uma leitura nova
  // chega pelo contexto DEPOIS do primeiro paint, e algo repinta e algo não.
  //
  // Este é o teste que separa "o mapa RECEBE a lista" de "o mapa REFAZ a
  // conta": refazendo, o mapa filtraria pela leitura que ele tem à mão (a
  // semente do servidor, que diz fresco), enquanto a folha filtra pela leitura
  // de agora. Com um recorte que não depende de leitura (custo) as duas contas
  // dariam o mesmo resultado e a divergência ficaria invisível.
  it("leitura nova chegando com filtro ligado: os três continuam concordando", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const todas = [par("zebra", "fresco"), par("abelha", "fresco"), par("morro", "fresco")];
    const semente = new Map(todas.map((p) => [p.ficha.slug, p.leitura]));

    const { container, rerender } = render(<Tela pares={todas} vivas={semente} />);
    // Todas frescas: "só as que dá hoje" ainda não esconde ninguém.
    await waitFor(() => expect(cartoesNaTela(container)).toHaveLength(todas.length));

    // A leitura de AGORA chega e derruba uma delas.
    const nova = new Map(semente);
    nova.set("abelha", { estado: "frio", erro: false, calculadoEm: agoraSeg() });
    rerender(<Tela pares={todas} vivas={nova} />);

    const cartoes = cartoesNaTela(container);
    expect(cartoes).not.toContain("abelha"); // a leitura nova mordeu
    expect([...pinsNaTela(container)].sort()).toEqual([...cartoes].sort());
    expect(contaDaLinha(container)).toBe(cartoes.length);
  });

  // 🔴 O IRMÃO NA OUTRA DIREÇÃO, e ele existe porque a suíte inteira só
  // exercitava a leitura nova TIRANDO trilha da tela.
  //
  // Depois que a conta subiu, o `MapaHome` recebe só as visíveis — então um
  // segundo recorte lá dentro só consegue TIRAR mais, e nunca discorda no
  // cenário de cima. A divergência que sobra é a de ADICIONAR: a chuva parou,
  // a leitura de agora promove `frio → fresco` com "só as que dá hoje" ligado,
  // a folha traz a trilha de volta — e o mapa, se filtrar pela semente do
  // servidor (que ainda diz frio), não traz. Cartão sem pin, `.mapa-fora`
  // subcontando e o enquadramento ignorando uma trilha que está na tela.
  //
  // MEDIDO pela revisão: sem este teste, um segundo `filter` dentro do
  // `MapaHome` passa com os 530 verdes.
  it("leitura nova que ADICIONA: a trilha que voltou ganha cartão E pin", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const todas = [par("zebra", "fresco"), par("abelha", "frio"), par("morro", "frio")];
    const semente = new Map(todas.map((p) => [p.ficha.slug, p.leitura]));

    const { container, rerender } = render(<Tela pares={todas} vivas={semente} />);
    // "só as que dá hoje" ligado: só a zebra passa — o recorte mordeu.
    await waitFor(() => expect(cartoesNaTela(container)).toEqual(["zebra"]));

    // A chuva parou na abelha: a leitura de AGORA a promove de volta.
    const nova = new Map(semente);
    nova.set("abelha", { estado: "fresco", erro: false, calculadoEm: agoraSeg() });
    rerender(<Tela pares={todas} vivas={nova} />);

    const cartoes = cartoesNaTela(container);
    expect(cartoes).toContain("abelha"); // a promoção entrou na folha
    // e o recorte continua mordendo: o morro segue frio e segue fora
    expect(cartoes.length).toBeLessThan(todas.length);
    expect([...pinsNaTela(container)].sort()).toEqual([...cartoes].sort());
    expect(contaDaLinha(container)).toBe(cartoes.length);
  });

  // A invariante herdada, que subir a conta pode quebrar sem ninguém ver: o
  // HTML do servidor não conhece filtro nenhum, e a home chega do cache do
  // service worker. Ler o aparelho durante o render quebraria a hidratação bem
  // nos elementos que carregam a decisão — agora são DOIS (os pins e os
  // cartões), e o mapa é o que não tinha prova.
  //
  // Mesma técnica dos outros testes de primeiro quadro do projeto: o Profiler
  // entrega o COMMIT antes dos efeitos passivos. `render()` sozinho já drena o
  // efeito que lê o aparelho, e perguntar ao DOM depois dele responde com a
  // lista JÁ recortada — escondendo justamente o quadro que importa.
  it("o PRIMEIRO render mostra TODOS os pins, mesmo com filtro guardado", () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const todas = [par("caro", "fresco", PAGO), par("gratis", "fresco")];
    const quadros: number[] = [];
    const registrar = () => { quadros.push(document.querySelectorAll(".pin-home").length); };

    render(
      <LocalVivo>
        <FiltrosVivos>
          <Profiler id="miolo" onRender={registrar}>
            <MioloHome pares={todas} />
          </Profiler>
        </FiltrosVivos>
      </LocalVivo>,
    );

    expect(quadros[0]).toBe(todas.length); // primeiro commit: o recorte guardado ainda não vale
    // depois do efeito, o mesmo DOM já obedece ao que estava no aparelho
    expect(document.querySelectorAll(".pin-home")).toHaveLength(todas.length - 1);
  });

  // `confia` sai de `pares`, não de `visiveis` — decisão registrada (spec §5),
  // não otimizável: `passaNoFiltro` RECEBE `confia`, `useAlgumVenceu` precisa
  // de array de tamanho estável, e a leitura vem numa busca só pro lote
  // inteiro ("tudo ou nada no clima"). A consequência é visível e alguém vai
  // querer "consertar": uma trilha que o filtro escondeu, com leitura
  // estragada, derruba os cabeçalhos das que ficaram na tela.
  it("trilha escondida pelo filtro ainda derruba o agrupamento", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const todas: ParFolha[] = [
      // Esta some da tela (é paga) — mas a leitura dela está com erro.
      {
        ficha: { ...fichaFake("caro"), ...PAGO },
        leitura: { estado: "frio", erro: true, calculadoEm: agoraSeg() },
      },
      par("gratis", "fresco"),
    ];

    const { container } = render(<Tela pares={todas} />);

    await waitFor(() => expect(cartoesNaTela(container)).toHaveLength(1));
    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0);
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // ——— a ORDEM dos três na tela, que ficou sem trava quando eles vieram
  // morar juntos.
  //
  // Antes, o mapa nascia no `page.tsx` e a linha dentro da folha: trocá-los de
  // lugar exigia editar dois arquivos. Agora são quatro linhas de JSX vizinhas
  // aqui — uma troca de ordem num refactor é fácil e silenciosa. E o teste de
  // orçamento da dobra (tests/lib/home-layout.test.ts) NÃO acusa: ele SOMA
  // appbar + mapa + linha + cabeçalho, e a soma não muda de lugar.
  //
  // A ordem é decisão de produto: o mapa em cima (é ele quem responde "onde
  // fica"), a linha full-bleed entre o mapa e os cartões, e a folha embaixo.
  // Com a linha acima do mapa, o resumo passa a rotular uma coisa que ainda
  // não apareceu.
  it("na tela, nesta ordem: o mapa, a linha de resumo, a folha", () => {
    const { container } = render(<Tela pares={[par("zebra", "fresco"), par("morro", "frio")]} />);
    const ordem = Array.from(container.querySelectorAll(".mapa-home, .filtro-linha, .folha")).map(
      (el) => el.className,
    );
    expect(ordem).toEqual(["mapa-home", "filtro-linha", "folha"]);
  });

  // O `"use client"` é o que o jsdom NÃO enxerga: ele renderiza tudo como
  // cliente, então apagar a diretiva deixa a suíte verde e a home parada no
  // aparelho do João — sem filtro, sem leitura nova, sem localização. Lição 5
  // do docs/RESUME.md: com o `MapaHome`, isso deixou 26 de 27 testes verdes.
  // E aqui o dano seria maior: este é o componente que ESTADO nenhum sobrevive
  // sem, e é ele quem embrulha o mapa e a folha.
  it("MioloHome é client component — é ele quem segura os hooks da tela inteira", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src", "app", "MioloHome.tsx"), "utf8");
    expect(fonte.trimStart().startsWith('"use client"')).toBe(true);
  });
});

// ——————— filtro e agrupamento: a MESMA passada ———————
//
// Bloco herdado de tests/app/FolhaTrilhas.test.tsx: quando a conta subiu pra
// cá, estes testes vieram junto — quem RECORTA agora é o `MioloHome`, e um
// teste que monta só a folha deixaria de exercitar o recorte.
//
// O Critical da rodada passada nasceu de agrupar num lugar e repintar em
// outro. Aqui o risco é o mesmo com outra roupa: recortar num lugar e rotular
// em outro. Todos os testes abaixo olham a tela DEPOIS do filtro — cabeçalho,
// cartões e contagem juntos, no mesmo DOM.
describe("filtro e agrupamento juntos", () => {
  // Timers de verdade neste bloco: `waitFor`/`findBy` do testing-library não
  // reconhecem o relógio falso do vitest (o guarda deles procura o global
  // `jest`, que não existe aqui) e ficariam esperando um `setInterval` que
  // ninguém adianta. Mesmo precedente do teste do LocalVivo em
  // tests/app/home.test.tsx. Nada aqui depende de tempo congelado: as leituras
  // ou são de agora, ou são de 99.999s atrás.
  const monta = (pares: ParFolha[]) => render(<Tela pares={pares} />);

  it("sem filtro, a folha é a de hoje: agrupada e completa", () => {
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    expect(container.textContent).toContain("Hoje o tempo deixa");
    expect(container.textContent).toContain("Hoje não");
    expect(container.querySelectorAll(".cartao")).toHaveLength(2);
  });

  it('"dá hoje" tira as que não dão', async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
  });

  // O cabeçalho é uma AFIRMAÇÃO sobre o que está embaixo dele. Sobrando nada
  // embaixo, ele mente. Primo direto do Critical da rodada passada.
  it("grupo esvaziado pelo filtro perde o cabeçalho", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.textContent).not.toContain("Hoje não"));
    expect(container.textContent).toContain("Hoje o tempo deixa");
  });

  it("filtro que zera a lista mostra o aviso e o jeito de limpar", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", PAGO)]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  // 🔴 A VIRADA DE 2026-08-27, e ela é o resumo da rodada. Este teste provava
  // que um chip de piso ESVAZIAVA a home — "a consequência que o João aceitou
  // de olhos abertos" em 2026-08-23. Não era consequência aceitável: o piso
  // estava sendo usado como proxy de "meu carro chega?", e nas duas fichas
  // reais o carro chega. Esvaziar a home era o proxy ERRANDO.
  //
  // O recorte saiu, e o teste inverteu junto: o piso guardado do celular dele
  // agora é fantasma, e a trilha de barro CONTINUA NA TELA. É o mesmo cenário,
  // com a asserção ao contrário — por isso ele fica aqui em vez de morrer.
  it("com o piso fantasma guardado, a trilha de barro NÃO some mais da home", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({
      ...SEM_FILTRO, pisoMinimo: "asfalto-esburacado",
    }));
    const { container } = monta([par("barrenta", "fresco", { piso: "barro" })]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.textContent).not.toContain("Nenhuma trilha com esses filtros");
    // E a linha de resumo não conta um filtro que não existe mais.
    expect(container.textContent).not.toContain("filtro ligado");
  });

  it("limpar traz tudo de volta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", PAGO)]);
    const b = await screen.findByRole("button", { name: /limpar/i });
    await act(async () => { b.click(); });
    expect(container.querySelectorAll(".cartao")).toHaveLength(1);
  });

  // A regra que já existe e não pode ser quebrada por esta task.
  //
  // 🔴 E ele carrega uma SEGUNDA prova, do outro eixo pelo qual um recorte a
  // mais dentro do `MapaHome` diverge — o do `confia`, que não depende de
  // leitura nova nenhuma.
  //
  // O mecanismo: **o `MapaHome` não recebe `confia`.** Quem quiser filtrar lá
  // dentro tem que INVENTAR um valor pra ele, e o valor que se escreve sem
  // pensar é `true`. Aí o "só as que dá hoje" fica ATIVO no mapa enquanto está
  // INERTE na folha (a Regra de Honestidade 1 do `passaNoFiltro`: sem leitura
  // confiável o recorte não esconde nada) — e a trilha de carimbo vencido
  // perde o pin mas mantém o cartão. Este cenário é o dia ruim, que é
  // justamente quando a pessoa mais filtra.
  //
  // Este teste já montava a `<Tela>` inteira, mapa incluído, e só contava
  // `.cartao` — o pin estava na tela e ninguém olhava. A igualdade de três
  // vias no fim é o que fecha o eixo.
  it("sem leitura confiável, continua sem cabeçalho — e o filtro 'dá hoje' fica inerte", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(2));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");

    const cartoes = cartoesNaTela(container);
    expect([...pinsNaTela(container)].sort()).toEqual([...cartoes].sort());
    expect(contaDaLinha(container)).toBe(cartoes.length);
  });

  // O ramo `!confia` desliga o AGRUPAMENTO, não o filtro. Quem ligou "só
  // grátis" continua querendo só as grátis, com ou sem carimbo confiável.
  //
  // Sem ESTE teste a prova de mutação "o ramo !confia volta a usar `pares`"
  // não morde: o único recorte exercitado no ramo `!confia` pelo teste acima é
  // o `daHoje`, que ali é inerte de propósito — então `pares` e `visiveis` são
  // a MESMA lista e a mutação passaria despercebida.
  it("sem leitura confiável, os OUTROS recortes continuam recortando", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco", PAGO),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // A folha vazia tem que valer NOS DOIS ramos.
  //
  // Com o `if (visiveis.length === 0)` escrito depois do `if (!confia)`, o caso
  // "sem carimbo confiável + filtro que zera" cai no ramo de cima e desenha uma
  // `.cartoes` VAZIA: folha em branco, sem aviso e sem o botão de limpar — que
  // é exatamente o que a §7.4 da spec proíbe. E o ramo `!confia` é o mais
  // provável de estar na tela num dia ruim, que é justamente quando a pessoa
  // filtra mais.
  it("filtro que zera a lista avisa TAMBÉM quando não dá pra confiar no carimbo", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: { ...fichaFake("a"), ...PAGO }, leitura: vencido },
    ]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  // A contagem da linha e a lista na tela SÃO a mesma conta. Se saírem de
  // dois lugares, a linha diz "4 trilhas" com 2 na tela — a mesma família do
  // cabeçalho verde sobre cartão vermelho.
  it("a contagem da linha bate com os cartões desenhados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio"), par("c", "frio")]);
    await waitFor(() => {
      const n = container.querySelectorAll(".cartao").length;
      expect(n).toBe(1); // o recorte precisa ter mordido — senão a igualdade abaixo é trivial
      expect(contaDaLinha(container)).toBe(n);
    });
  });

  // ——— a invariante "filtrar não reordena".
  //
  // Hoje ela é ESTRUTURAL (`.filter` preserva a ordem de `pares`, e o
  // particionamento podem/naoPodem também), e é por isso mesmo que ela some
  // em silêncio: um `.sort()` que alguém acrescente no futuro — por km, por
  // nome — não derruba nada. E na tela é uma SEGUNDA coisa acontecendo
  // enquanto a pessoa decide no portão: ela tocou um chip e o cartão que ela
  // estava lendo mudou de lugar.
  //
  // Os DOIS ramos precisam de teste porque são dois caminhos diferentes: o
  // liso (`!confia`) desenha `visiveis` direto; o agrupado desenha duas
  // partições. Um `.sort()` num não é pego pelo teste do outro.
  //
  // Os slugs são não-alfabéticos de propósito: com "a", "b", "c" um sort por
  // nome devolveria a mesma sequência e a prova de mutação não morderia.
  it("filtrar não reordena: ramo AGRUPADO mantém a ordem de `pares`", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    // Ordem de `pares` como o servidor entrega: fresco primeiro, depois o resto.
    const { container } = monta([
      par("zebra", "fresco"),
      par("abelha", "fresco"),
      par("caro", "fresco", PAGO), // sai no filtro
      par("morro", "frio"),
      par("beira", "frio"),
    ]);
    await waitFor(() => {
      expect(container.querySelectorAll(".grupo-k")).toHaveLength(2); // confirma: ramo agrupado
      expect(cartoesNaTela(container)).toEqual(["zebra", "abelha", "morro", "beira"]);
    });
  });

  it("filtrar não reordena: ramo LISO (sem carimbo confiável) mantém a ordem de `pares`", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([
      par("zebra", "fresco"),
      par("abelha", "fresco"),
      par("caro", "fresco", PAGO), // sai no filtro
      // leitura vencida: derruba `confia` e joga tudo no ramo liso
      { ficha: fichaFake("morro"), leitura: { estado: "frio", erro: false, calculadoEm: agoraSeg() - 99_999 } },
    ]);
    await waitFor(() => {
      expect(container.querySelectorAll(".grupo-k")).toHaveLength(0); // confirma: ramo liso
      expect(cartoesNaTela(container)).toEqual(["zebra", "abelha", "morro"]);
    });
  });

  // ——— "primeiro render sem filtro, SEMPRE", visto nos CARTÕES.
  //
  // O teste irmão dos PINS está no primeiro bloco deste arquivo, e o do valor
  // do provedor em tests/app/PainelFiltros.test.tsx. A invariante existe por
  // causa da HIDRATAÇÃO DA LISTA: a home chega do cache do service worker com
  // HTML velho, e é aqui — nos cartões, o elemento que carrega a decisão — que
  // o mismatch apareceria.
  it("o PRIMEIRO quadro da folha ignora o filtro guardado — é o HTML do servidor que a hidratação encontra", () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const pares = [par("caro", "fresco", PAGO), par("gratis", "fresco")];
    const quadros: number[] = [];
    const registrar = () => { quadros.push(document.querySelectorAll(".cartao").length); };

    render(
      <LocalVivo>
        <FiltrosVivos>
          <Profiler id="miolo-filtrado" onRender={registrar}>
            <MioloHome pares={pares} />
          </Profiler>
        </FiltrosVivos>
      </LocalVivo>,
    );

    expect(quadros[0]).toBe(2); // primeiro commit: o recorte guardado ainda não vale
    // depois do efeito, o mesmo DOM já obedece ao que estava no aparelho
    expect(document.querySelectorAll(".cartao")).toHaveLength(1);
  });
});

// ——————— o que NENHUM teste de comportamento pode ver ———————
//
// 🔴 ESTE GUARDA NASCEU DE UMA PROVA DE MUTAÇÃO QUE NÃO MORDEU, e o achado é
// o motivo dele existir. A mutação era "o mapa refaz o `filter` por conta
// própria, com a mesma expressão, num segundo array". Escrita ao pé da letra —
// um segundo `pares.filter(<expressão idêntica>)` no MESMO escopo do
// `MioloHome` — a suíte inteira ficou VERDE, e está certo que tenha ficado:
// `passaNoFiltro` é pura e `.filter` é determinístico, então as duas listas
// têm conteúdo idêntico por construção. Nenhuma asserção de comportamento, em
// framework nenhum, consegue distingui-las: o que muda é uma alocação.
//
// O perigo, porém, é real e é de MANUTENÇÃO: duas expressões que hoje dizem a
// mesma coisa são duas expressões que alguém edita separadamente amanhã — é
// literalmente a forma do Critical de duas rodadas atrás (agrupar num lugar,
// repintar em outro). Por isso a spec (§5) não pede um comportamento, pede uma
// ESTRUTURA: "um array só, num escopo léxico só". Invariante estrutural se
// prova na fonte, como o `"use client"` e o `<FiltrosVivos>` do page.tsx já se
// provam neste projeto.
//
// 🔴 O QUE ESTE GUARDA NÃO VÊ, e não é conserto pendente — é o que ele é.
// Ele conta NOMES. Duas formas de recortar de novo passam por ele inteiras, as
// duas MEDIDAS:
//
//   • índice computado — `import * as F from "@/lib/filtros"` com o nome
//     montado por concatenação: zero menção literal;
//   • cópia da lógica à mão — um `.filter` que nem chama a função.
//
// Nas duas, quem pegou foi TESTE DE TELA. Então a divisão é: este guarda é o
// cinto contra apelido e renomeação; os testes de junção lá de cima são o
// suspensório contra reimplementação. Nenhum dos dois sozinho cobre o outro —
// medido, não suposto: a cópia à mão que lê a leitura de agora e crava
// `confia: true` escapa DESTE guarda e cai só na igualdade de três vias do
// teste "sem leitura confiável, ... o filtro 'dá hoje' fica inerte".
describe("um recorte só, num escopo léxico só", () => {
  // 🔴 `src` INTEIRO, não `src/app`. A primeira versão varria só `src/app` e a
  // revisão a furou em três linhas: `export const recorta = passaNoFiltro` no
  // `src/lib/filtros.ts` — onde o guarda não olhava — mais um `recorta(...)`
  // dentro do `MapaHome`. **530/530 verde, tsc limpo, guarda verde**, e a tela
  // com cartão sem pin. Quem varre o dono da função tem que varrer a casa dela.
  const SRC = path.join(process.cwd(), "src");

  /** Fonte sem comentários: o guarda conta CHAMADAS, e um comentário que cite
   *  o nome (há um, logo acima da conta, explicando por que `confia` sai de
   *  `pares`) não é uma chamada. O `[^:]` antes do `//` poupa o `https://` dos
   *  links. */
  const semComentarios = (fonte: string) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const arquivosDoSrc = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) return arquivosDoSrc(p);
      return /\.tsx?$/.test(e) ? [p] : [];
    });

  // 🔴 A conta é de MENÇÕES ao identificador, não de chamadas — e isso foi
  // MEDIDO, não escolhido por gosto. A primeira versão contava `passaNoFiltro(`
  // e ficou VERDE contra a mutação escrita com `import { passaNoFiltro as pf }`
  // + `pf(...)` dentro do `MapaHome`: o apelido some do call site e a regex não
  // vê mais nada. É o mesmo ponto cego que o guarda de exports de rota já
  // documenta (`export { X as Y }` escapando da regex antiga). Quem NÃO some no
  // apelido é o nome importado — quem quiser usar a função tem que escrevê-lo
  // ao menos uma vez, no `import`.
  it("o src inteiro conhece `passaNoFiltro` em dois arquivos só: quem a define e quem a chama", () => {
    const mencoes: Record<string, number> = {};
    const chamadas: Record<string, number> = {};
    for (const arquivo of arquivosDoSrc(SRC)) {
      const fonte = semComentarios(readFileSync(arquivo, "utf8"));
      const curto = path.relative(SRC, arquivo).replace(/\\/g, "/");
      const m = (fonte.match(/\bpassaNoFiltro\b/g) ?? []).length;
      const c = (fonte.match(/\bpassaNoFiltro\s*\(/g) ?? []).length;
      if (m > 0) mencoes[curto] = m;
      if (c > 0) chamadas[curto] = c;
    }
    // A conta, arquivo por arquivo, e cada número segura um jeito de furar:
    //
    //   lib/filtros.ts    1 menção  — a DECLARAÇÃO, e só ela. Um segundo nome
    //                                 pra mesma função (`export const recorta =
    //                                 passaNoFiltro`, `export { passaNoFiltro
    //                                 as … }`) vira 2 e derruba isto. Foi a
    //                                 mutação que passou pela versão anterior.
    //   app/MioloHome.tsx 2 menções — o `import` e a chamada. Uma terceira é um
    //                                 segundo recorte no mesmo escopo.
    //
    // Um TERCEIRO arquivo em qualquer um dos dois mapas é a lista nascendo em
    // dois lugares.
    expect(mencoes).toEqual({ "app/MioloHome.tsx": 2, "lib/filtros.ts": 1 });
    // A declaração casa com `passaNoFiltro({`, e é por isso que ela aparece
    // aqui também — o que importa é que nenhum arquivo NOVO apareça.
    expect(chamadas).toEqual({ "app/MioloHome.tsx": 1, "lib/filtros.ts": 1 });
  });
});

// ——————— o relógio da validade decide se a folha agrupa ———————
//
// Bloco herdado de tests/app/FolhaTrilhas.test.tsx: `useAlgumVenceu` e
// `algumErro` subiram pro `MioloHome` junto com a conta, e é aqui que a
// derivação de `confia` passa a ter ponto de uso.
describe("MioloHome: de onde `confia` sai", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_S * 1000); });
  afterEach(() => { vi.useRealTimers(); });

  it("a leitura vence sozinha, sem nenhuma requisição — e os cabeçalhos somem", () => {
    const pares = [{ ficha: fichaFake("seca"), leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } }];

    const { container } = render(<MioloHome pares={pares} />);
    expect(container.querySelector(".grupo-k")?.textContent).toBe("Hoje o tempo deixa");

    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });

    expect(container.querySelector(".grupo-k")).toBeNull();
    expect(container.querySelector(".selo")?.textContent).toContain("SEM INFORMAÇÕES");
  });

  // O nome diz "em QUALQUER UMA" e o fixture tem que provar isso: uma com erro
  // e outra sem. Com erro nas duas, `some` e `every` dão a mesma resposta e o
  // teste exercitava a semântica que não está no nome — a família de teste que
  // promete mais do que mede, que esta branch já corrigiu noutro arquivo.
  it("clima fora do ar — erro em qualquer uma — e nenhuma frase de veredito aparece", () => {
    const pares = [
      { ficha: fichaFake("seca"), leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S } },
      { ficha: fichaFake("molhada"), leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S } },
    ];

    const { container } = render(<MioloHome pares={pares} />);

    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0);
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
    expect(container.textContent).not.toContain("Hoje não");
  });

  it("o primeiro quadro mostra cabeçalho — igual ao HTML do servidor mostraria — mesmo com a leitura já vencida no relógio", () => {
    // Mesma técnica dos outros testes de primeiro quadro: o Profiler entrega o
    // COMMIT antes dos efeitos passivos, que é o único jeito honesto de ver o
    // que o HTML do servidor (e o primeiro paint do cliente) mostrariam.
    const pares = [
      { ficha: fichaFake("seca"), leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S - 40 * 60 } },
    ];
    const quadros: string[] = [];
    const registrar = () => {
      quadros.push(document.querySelector(".grupo-k")?.textContent ?? "sem cabeçalho");
    };

    render(
      <Profiler id="miolo-relogio" onRender={registrar}>
        <MioloHome pares={pares} />
      </Profiler>,
    );

    expect(quadros[0]).toBe("Hoje o tempo deixa"); // primeiro commit: useAlgumVenceu ainda não rodou
    // depois do efeito, o mesmo DOM já sabe que a leitura venceu
    expect(document.querySelector(".grupo-k")).toBeNull();
  });
});

// ——————— o teto da barra de distância sai de `pares`, nunca de `visiveis` ———————
//
// 🔴 É CIRCULAR com `visiveis`: ligar "até 10 km" esconderia a trilha mais
// longe, o teto encolheria, e a barra se reescreveria embaixo do dedo — o
// caminho de volta pra 50 km deixaria de existir na tela. Mesmo motivo pelo
// qual o `confia` já sai de `pares` neste arquivo.
describe("o teto da barra de distância", () => {
  // VOCE em (-8, -35): `longe` fica a ~46,7 km e `perto` a ~7,8 km.
  const semeiaVoce = () =>
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8, lng: -35 }, em: Math.floor(Date.now() / 1000),
    }));
  const parEm = (slug: string, graus: number): ParFolha => ({
    ficha: { ...fichaFake(slug), trajeto: { waypoints: [{ nome: slug, lat: -8 + graus, lng: -35 }] } },
    leitura: { estado: "fresco", erro: false, calculadoEm: agoraSeg() },
  });
  const maxDoCampo = () =>
    (screen.getByRole("spinbutton", { name: /distância daqui: km/i }) as HTMLInputElement)
      .getAttribute("max");

  it("com um filtro que ESCONDE a trilha mais longe, o teto não encolhe", async () => {
    semeiaVoce();
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, distanciaKm: 10 }));
    render(<Tela pares={[parEm("perto", 0.07), parEm("longe", 0.42)]} />);
    await act(async () => {});
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    // Não-vacuidade: o filtro está de fato escondendo a trilha longe.
    expect(cartoesNaTela(document.body).length).toBe(1);
    // E o teto continua o do ACERVO (46,7 → 50), não o das visíveis (7,8 → 30).
    expect(maxDoCampo()).toBe("50");
  });

  // 🔴 MEDIDO: a mutação "3º argumento vira `null`" (o candidato `valorAtual`
  // saindo da conta do teto) NÃO morde no teste acima — com "até 10 km"
  // guardado, o candidato do acervo (50) já vence o do valor atual (10) dos
  // dois jeitos, e a suíte inteira continua verde. Este é o caso que SEPARA as
  // duas versões: um corte guardado MAIOR que a trilha mais longe do acervo —
  // sem o 3º argumento, o teto voltaria a 50 (só acervo); com ele, sobe pra
  // 200, porque é o corte ligado que garante a "TELA DE MENTIR" no meio do
  // comentário do `tetoDaBarraDistancia`: sem ele, o pegador da barra ficaria
  // preso em 50 enquanto a leitura ao lado diz "até 200 km".
  it("um corte guardado maior que o acervo também vira candidato do teto", async () => {
    semeiaVoce();
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, distanciaKm: 200 }));
    render(<Tela pares={[parEm("perto", 0.07), parEm("longe", 0.42)]} />);
    await act(async () => {});
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    expect(maxDoCampo()).toBe("200");
  });
});
