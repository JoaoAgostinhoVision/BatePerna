import { readFileSync } from "node:fs";
import path from "node:path";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { getFichasComCondicao } from "@/lib/ficha";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";
import { CHAVE_LOCAL } from "@/lib/local";
import type { Ficha } from "@/types/ficha";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstados: vi.fn(),
}));

// getFichasComCondicao por padrão continua sendo o loader de verdade — só o
// teste de agrupamento troca por fichas sintéticas, porque content/fichas/
// hoje tem uma ficha só e não dá pra provar "dois grupos" com uma.
vi.mock("@/lib/ficha", async (real) => {
  const mod = await real<typeof import("@/lib/ficha")>();
  return { ...mod, getFichasComCondicao: vi.fn(mod.getFichasComCondicao) };
});

const { resolverEstados } = await import("@/lib/carimbo-estado");
const Home = (await import("@/app/page")).default;
const SeloTrilha = (await import("@/app/SeloTrilha")).default;

const AGORA_S = Math.floor(Date.UTC(2027, 0, 15, 11, 0) / 1000);

function leituras(estado: "fresco" | "frio", erro = false) {
  return new Map(
    getFichasComCondicao().map((f) => [f.slug, { estado, erro, calculadoEm: AGORA_S }]),
  );
}

// Ficha mínima e sintética — mesmo padrão de tests/lib/ficha.test.ts
// (fichaComNome): só os campos que a home lê (slug, nome do 1º waypoint,
// promessa). Não depende do conteúdo real do projeto.
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
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.mocked(resolverEstados).mockReset();
  localStorage.clear();
});

describe("a home", () => {
  it("dá um link pra cada trilha com condição", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const f of getFichasComCondicao()) expect(hrefs).toContain(`/${f.slug}`);
  });

  it("o carimbo já vem pintado no HTML do servidor, sem depender de JS", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    const selo = container.querySelector(".cartao .selo");
    expect(selo?.textContent).toContain("Pode subir");
    expect(container.querySelector('.cartao[data-state="fresco"]')).not.toBeNull();
  });

  it("agrupa por veredito: o que dá hoje em cima, o que não dá embaixo", async () => {
    // Duas fichas sintéticas, dois estados diferentes — só assim existe um
    // render com os DOIS grupos na tela pra provar posição relativa e título.
    // (Com uma ficha só, ou tudo cai no mesmo grupo, e um bug que sempre
    // rotulasse "Hoje não", ou que invertesse os cabeçalhos, passaria.)
    const seca = fichaFake("seca");
    const molhada = fichaFake("molhada");
    vi.mocked(getFichasComCondicao).mockReturnValueOnce([seca, molhada]);
    vi.mocked(resolverEstados).mockResolvedValue(
      new Map([
        ["seca", { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S }],
        ["molhada", { estado: "frio" as const, erro: false, calculadoEm: AGORA_S }],
      ]),
    );

    const { container } = render(await Home());

    const cabecalhos = Array.from(container.querySelectorAll(".grupo-k")).map((el) => el.textContent);
    expect(cabecalhos).toEqual(["Hoje o tempo deixa", "Hoje não"]);
    expect(container.querySelector('.cartao[data-state="fresco"]')?.id).toBe("seca");
    expect(container.querySelector('.cartao[data-state="frio"]')?.id).toBe("molhada");
  });

  // A folha AGRUPADA reordena sozinha (podem/naoPodem em FolhaTrilhas.tsx),
  // então o teste acima passa mesmo se page.tsx entregasse `comLeitura` cru
  // em vez de `pares` — nada expõe a ordem que a PÁGINA calcula. Só o
  // caminho SEM cabeçalho expõe: ali a folha não filtra nem reordena de
  // novo (decisão do dono do produto — um cartão não pode pular de lugar no
  // portão), então a ordem em tela é exatamente a que `pares` entregou.
  it("sem cabeçalhos (leitura não confiável), a ordem continua fresco-primeiro — vem pronta de `pares`, ninguém reordena depois", async () => {
    // Ordem de ORIGEM de propósito não-fresco-primeiro: se page.tsx trocar
    // `pares` por `comLeitura` cru, a ordem em tela vira a de origem
    // (molhada, seca, instavel) em vez de fresco-primeiro.
    const molhada = fichaFake("molhada");
    const seca = fichaFake("seca");
    const instavel = fichaFake("instavel");
    vi.mocked(getFichasComCondicao).mockReturnValueOnce([molhada, seca, instavel]);
    vi.mocked(resolverEstados).mockResolvedValue(
      new Map([
        ["molhada", { estado: "frio" as const, erro: false, calculadoEm: AGORA_S }],
        ["seca", { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S }],
        // erro:true em qualquer par derruba `confia` (ver FolhaTrilhas.tsx) —
        // é o que tira os cabeçalhos e força o caminho que não reordena.
        ["instavel", { estado: "frio" as const, erro: true, calculadoEm: AGORA_S }],
      ]),
    );

    const { container } = render(await Home());

    expect(container.querySelectorAll(".grupo-k")).toHaveLength(0); // confirma: caiu no caminho sem cabeçalho
    const ids = Array.from(container.querySelectorAll(".cartao")).map((el) => el.id);
    expect(ids).toEqual(["seca", "molhada", "instavel"]);
  });

  it("barro medido diz 'Não suba' — a regra tem dois lados, e este é o outro", async () => {
    // Par do teste "sem leitura informa": aquele prova que frio+erro NÃO diz
    // "Não suba". Este prova que frio+leitura confiável DIZ. Sem os dois,
    // apagar o ramo "Não suba" do SeloTrilha deixaria a suíte inteira verde.
    vi.mocked(resolverEstados).mockResolvedValue(leituras("frio", false));
    const { container } = render(await Home());
    expect(container.textContent).toContain("Não suba");
    expect(container.textContent).not.toContain("SEM INFORMAÇÕES");
  });

  it("sem leitura, informa em vez de mandar — 'Não suba' é só pro barro medido", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("frio", true));
    const { container } = render(await Home());
    expect(container.textContent).toContain("SEM INFORMAÇÕES");
    expect(container.textContent).not.toContain("Não suba");
  });

  it("a barra marca que você está na home", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    const { container } = render(await Home());
    expect(container.querySelector('.barra [aria-current="page"]')?.getAttribute("href")).toBe("/");
  });

  it("não é estática — se congelar no build, todo visitante recebe carimbo vencido", async () => {
    const mod = await import("@/app/page");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  // A palavra e a cor têm que dizer a mesma coisa. Em CSS isso é uma disputa de
  // especificidade, e ela já foi perdida uma vez neste app: a rodada do carimbo
  // shipou "Não suba" dentro de um selo verde. jsdom não resolve cascata, então
  // o guarda lê a folha — seletor E corpo juntos (mesmo padrão de
  // tests/app/Carimbo.test.tsx), pra não passar só porque o texto do seletor
  // apareceu dentro de um comentário, nem porque a regra ganhou a cascata mas
  // pintou a cor errada.
  it("a regra de fase ganha da cor do estado — senão 'sem informações' sai verde", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
    // .bp .cartao[data-state] .selo[data-fase="sem-informacoes"] é (0,5,0):
    // um seletor a mais que .bp .cartao[data-state="fresco"] .selo, que é
    // (0,4,0) — vitória direta de especificidade, não empate resolvido por
    // ordem no arquivo.
    expect(css).toMatch(
      /\.bp \.cartao\[data-state\] \.selo\[data-fase="sem-informacoes"\]\s*\{[^}]*--c:\s*var\(--stop-ink\)/,
    );
  });

  // Os testes de tests/app/MapaHome.test.tsx embrulham <MapaHome> num
  // <LocalVivo> na mão. Se o page.tsx esquecer o <LocalVivo>, todos eles
  // continuam passando e o recurso está morto em produção — é a forma exata
  // do defeito que a rodada passada deixou escapar ("o conserto do mapa
  // passou na revisão com zero proteção"). Este é o ponto de uso de verdade:
  // renderiza a home de verdade (page.tsx), sem embrulhar nada à mão.
  it("a home de verdade embrulha tudo no LocalVivo: o ponto 'você' aparece sem ninguém embrulhar na mão", async () => {
    vi.useRealTimers();
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const { container, findByTestId } = render(await Home());
    await findByTestId("voce");
    expect(container.querySelector(".voce-pin")).not.toBeNull();
  });

  // Irmão exato do teste acima, e pela mesma razão: todos os testes de
  // tests/app/FolhaTrilhas.test.tsx e tests/app/PainelFiltros.test.tsx
  // embrulham `<FiltrosVivos>` na mão. Se o page.tsx esquecer o provedor, eles
  // continuam TODOS verdes e a home real não filtra nada.
  //
  // A Task 10 deixou aqui só uma prova de FONTE (`expect(fonte).toContain(
  // "<FiltrosVivos>")`), fraca de propósito: naquela hora nada consumia o
  // provedor ainda. Agora a folha consome, então a prova forte é possível — e
  // ela mora neste arquivo porque é aqui que a home de verdade é renderizada,
  // com o loader de ficha e o `resolverEstados` já no lugar.
  //
  // A única ficha real do projeto é PAGA (R$ 5 no portão da Rampa), então "só
  // grátis" zera a home de verdade: se o filtro chegar, a folha vira o aviso.
  it("a home de verdade embrulha tudo no FiltrosVivos: o filtro guardado recorta sem ninguém embrulhar na mão", async () => {
    vi.useRealTimers();
    vi.mocked(resolverEstados).mockResolvedValue(leituras("fresco"));
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = render(await Home());
    // `waitFor` com `expect` dentro, não `findByText`: o que cai quando o
    // provedor some é uma ASSERÇÃO nomeada, não um erro de query — a lição 15
    // do RESUME ("suíte vermelha não é o mesmo que asserção caindo") pede que a
    // prova de mutação seja legível como asserção.
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(container.querySelectorAll(".cartao")).toHaveLength(0);
  });
});

describe("SeloTrilha — o relógio da validade", () => {
  it("useVenceu devolve false no primeiro quadro, sempre — mesmo com leitura de 40min", () => {
    // Mesma técnica de tests/app/Carimbo.test.tsx ("o que os quadros
    // commitados mostram"): o Profiler entrega o COMMIT antes dos efeitos
    // passivos, que é o único jeito honesto de ver o que o HTML do servidor
    // (e o primeiro paint do cliente, inclusive vindo do cache do service
    // worker) mostrariam. `render()` sozinho já drena o efeito — perguntar
    // ao DOM depois dele já responde com o valor CORRIGIDO, escondendo
    // justamente o quadro que este teste precisa provar.
    const leituraVelha = { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S - 40 * 60 };
    const quadros: string[] = [];
    const registrar = () => {
      quadros.push(document.querySelector(".selo .w")?.textContent ?? "");
    };

    render(
      <Profiler id="selo" onRender={registrar}>
        <SeloTrilha leitura={leituraVelha} />
      </Profiler>,
    );

    expect(quadros[0]).toBe("Pode subir"); // primeiro commit: useVenceu ainda não rodou
    // depois do efeito, o mesmo nó já diz a verdade: a leitura venceu
    expect(document.querySelector(".selo .w")?.textContent).toBe("SEM INFORMAÇÕES");
  });
});
