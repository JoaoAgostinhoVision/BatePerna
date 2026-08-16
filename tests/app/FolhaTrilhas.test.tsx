import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act, screen, waitFor } from "@testing-library/react";
import FolhaTrilhas, { type ParFolha } from "@/app/FolhaTrilhas";
import FiltrosVivos from "@/app/filtros";
import { LeiturasProvider } from "@/app/leituras";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";
import type { Ficha } from "@/types/ficha";

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

// Mesmo padrão sintético de tests/app/home.test.tsx (fichaFake): só os campos
// que a folha (e o cartão, por baixo) leem. Não depende do conteúdo real do
// projeto — hoje tem uma ficha só, e não dá pra provar dois grupos com uma.
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

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_S * 1000); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("FolhaTrilhas", () => {
  it("nenhum cabeçalho pode afirmar o oposto do cartão que está embaixo dele", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    // `pares` chega na ordem que o page.tsx monta: a classificação de quando a
    // página nasceu no servidor — seca fresco, molhada frio.
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S } },
    ];
    // O contexto (a leitura de AGORA, publicada depois) inverteu: seca virou
    // frio, molhada virou fresco. É literalmente o defeito do portão: o
    // servidor rotulou de um jeito, o clima mudou, e o cabeçalho tem que
    // acompanhar — não ficar preso ao que o servidor escreveu.
    const invertido = new Map([
      ["seca", { estado: "frio" as const, erro: false, calculadoEm: AGORA_S }],
      ["molhada", { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S }],
    ]);

    const { container } = render(
      <LeiturasProvider value={invertido}>
        <FolhaTrilhas pares={pares} />
      </LeiturasProvider>,
    );

    for (const cabecalho of Array.from(container.querySelectorAll(".grupo-k"))) {
      const esperado = cabecalho.textContent === "Hoje o tempo deixa" ? "fresco" : "frio";
      const grupo = cabecalho.nextElementSibling;
      for (const cartao of Array.from(grupo?.querySelectorAll(".cartao") ?? [])) {
        expect(cartao.getAttribute("data-state")).toBe(esperado);
      }
    }
    // E a inversão realmente aconteceu — não é "nada contradiz nada" só porque
    // nada mudou de lugar.
    expect(container.querySelector("#seca")?.getAttribute("data-state")).toBe("frio");
    expect(container.querySelector("#molhada")?.getAttribute("data-state")).toBe("fresco");
  });

  it("a leitura vence sozinha, sem nenhuma requisição — e os cabeçalhos somem", () => {
    const seca = fichaFake("seca");
    const pares = [{ ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } }];

    const { container } = render(<FolhaTrilhas pares={pares} />);
    expect(container.querySelector(".grupo-k")?.textContent).toBe("Hoje o tempo deixa");

    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });

    expect(container.querySelector(".grupo-k")).toBeNull();
    expect(container.querySelector(".selo")?.textContent).toContain("SEM INFORMAÇÕES");
  });

  it("clima fora do ar — erro em todas — e nenhuma frase de veredito aparece", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    const pares = [
      { ficha: seca, leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: true, calculadoEm: AGORA_S } },
    ];

    const { container } = render(<FolhaTrilhas pares={pares} />);

    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0);
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
    expect(container.textContent).not.toContain("Hoje não");
    expect(container.textContent).not.toContain("Não suba");
    expect(container.textContent).not.toContain("Pode subir");
  });

  it("todas com leitura confiável — os dois cabeçalhos aparecem, na ordem certa", () => {
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S } },
      { ficha: molhada, leitura: { estado: "frio" as const, erro: false, calculadoEm: AGORA_S } },
    ];

    const { container } = render(<FolhaTrilhas pares={pares} />);

    const cabecalhos = Array.from(container.querySelectorAll(".grupo-k")).map((el) => el.textContent);
    expect(cabecalhos).toEqual(["Hoje o tempo deixa", "Hoje não"]);
  });

  it("o primeiro quadro mostra cabeçalho — igual ao HTML do servidor mostraria — mesmo com a leitura já vencida no relógio", () => {
    // Mesma técnica de tests/app/home.test.tsx ("useVenceu devolve false no
    // primeiro quadro"): o Profiler entrega o COMMIT antes dos efeitos
    // passivos, que é o único jeito honesto de ver o que o HTML do servidor
    // (e o primeiro paint do cliente) mostrariam. `render()` sozinho já drena
    // o efeito — perguntar ao DOM depois dele já responde com o valor
    // corrigido, escondendo justamente o quadro que este teste precisa provar.
    const seca = fichaFake("seca");
    const pares = [
      { ficha: seca, leitura: { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S - 40 * 60 } },
    ];
    const quadros: string[] = [];
    const registrar = () => {
      quadros.push(document.querySelector(".grupo-k")?.textContent ?? "sem cabeçalho");
    };

    render(
      <Profiler id="folha" onRender={registrar}>
        <FolhaTrilhas pares={pares} />
      </Profiler>,
    );

    expect(quadros[0]).toBe("Hoje o tempo deixa"); // primeiro commit: useAlgumVenceu ainda não rodou
    // depois do efeito, o mesmo DOM já sabe que a leitura venceu
    expect(document.querySelector(".grupo-k")).toBeNull();
  });
});

// ——————— filtro e agrupamento: a MESMA passada ———————
//
// O Critical da rodada passada nasceu de agrupar num lugar e repintar em
// outro. Aqui o risco é o mesmo com outra roupa: recortar num lugar e rotular
// em outro. Todos os testes abaixo olham a folha DEPOIS do filtro — cabeçalho,
// cartões e contagem juntos, no mesmo DOM.
describe("filtro e agrupamento juntos", () => {
  // Timers de verdade neste bloco: `waitFor`/`findBy` do testing-library não
  // reconhecem o relógio falso do vitest (o guarda deles procura o global
  // `jest`, que não existe aqui) e ficariam esperando um `setInterval` que
  // ninguém adianta. Mesmo precedente do teste do LocalVivo em
  // tests/app/home.test.tsx:191. Nada aqui depende de tempo congelado: as
  // leituras ou são de agora, ou são de 99.999s atrás.
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => { localStorage.clear(); });

  const agoraSeg = () => Math.floor(Date.now() / 1000);

  const par = (slug: string, estado: "fresco" | "frio", over: Partial<Ficha> = {}): ParFolha => ({
    ficha: { ...fichaFake(slug), ...over },
    leitura: { estado, erro: false, calculadoEm: agoraSeg() },
  });

  const monta = (pares: ParFolha[]) =>
    render(<LocalVivo><FiltrosVivos><FolhaTrilhas pares={pares} /></FiltrosVivos></LocalVivo>);

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
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  it("limpar traz tudo de volta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    const b = await screen.findByRole("button", { name: /limpar/i });
    await act(async () => { b.click(); });
    expect(container.querySelectorAll(".cartao")).toHaveLength(1);
  });

  // A regra que já existe e não pode ser quebrada por esta task.
  it("sem leitura confiável, continua sem cabeçalho — e o filtro 'dá hoje' fica inerte", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(2));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
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
      par("b", "fresco", { custo: { tag: "pago", valor: "R$ 5" } }),
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
      { ficha: { ...fichaFake("a"), custo: { tag: "pago", valor: "R$ 5" } }, leitura: vencido },
    ]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  // `confia` é a pergunta sobre TODAS as trilhas, não só as visíveis — e isso
  // é decisão, não detalhe.
  //
  // Não dá pra ser diferente: `passaNoFiltro` RECEBE `confia`, então calcular
  // `confia` a partir de `visiveis` seria circular. Mas a consequência é
  // visível e alguém vai querer "consertar": uma trilha que o filtro escondeu,
  // com leitura estragada, derruba os cabeçalhos das que ficaram na tela.
  //
  // Está CERTO assim, e a razão é a invariante "tudo ou nada no clima": a
  // leitura vem numa busca só, pro lote inteiro. Uma leitura estragada não é
  // notícia sobre aquele morro, é notícia sobre a busca — e ela vale pra todos.
  // Fingir confiança nos que sobraram seria o app afirmando o que não sabe.
  it("trilha escondida pelo filtro ainda derruba o agrupamento se a leitura dela não presta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([
      // Esta some da tela (é paga) — mas a leitura dela está com erro.
      {
        ficha: { ...fichaFake("a"), custo: { tag: "pago", valor: "R$ 5" } },
        leitura: { estado: "frio", erro: true, calculadoEm: agoraSeg() },
      },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
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
      expect(container.textContent).toContain(n === 1 ? "1 trilha" : `${n} trilhas`);
    });
  });
});
