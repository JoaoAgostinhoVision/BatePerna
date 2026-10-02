import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { gravarVersao } from "@/lib/db";
import { ordenarPorNome } from "@/lib/ficha-fonte";
import { DESTINO, NOTA_DO_SEGUNDO, SEGUNDO, TERCEIRO, TRES_PONTOS, tresPontos } from "../ficha-de-tres-pontos";
import { AGORA_SEMENTE, bancoDeProducao } from "../banco";

/** A CADEIA DE WAYPOINTS NA TELA (Tarefa 10, spec §6).
 *
 *  🔴 A DISTINÇÃO QUE DECIDE TUDO: `waypoints[0]` é O LUGAR; `waypoints[1..]`
 *  são AS ETAPAS DO CAMINHO até ele. Só o bloco Trajeto da ficha passa a ler a
 *  cadeia — o nome na home, a ordem do acervo, o pin e a distância continuam no
 *  `[0]`, porque falam do lugar. Este arquivo prova os dois lados: a cadeia
 *  APARECE onde deve, e NÃO aparece onde o app fala do lugar.
 *
 *  A ficha de três pontos é fixture de TESTE, gravada no banco `:memory:` da
 *  suíte (`tests/ficha-de-tres-pontos.ts`); nenhum lugar real ganha etapa. */

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getAllFichas } = await import("@/lib/ficha");
const Pagina = (await import("@/app/[slug]/page")).default;
const CartaoTrilha = (await import("@/app/CartaoTrilha")).default;

// O banco da suíte, com o acervo real E a ficha de três pontos. O acervo real é
// lido ANTES de a fixture entrar, pra o teste da ordem medir a fixture contra
// os lugares de verdade.
const banco = await bancoDeProducao();
const ACERVO = await getAllFichas();
await gravarVersao(banco, TRES_PONTOS.slug, JSON.stringify(TRES_PONTOS), "semente", AGORA_SEMENTE);

afterEach(() => {
  cleanup();
  vi.mocked(resolverEstado).mockReset();
});

async function abrir(slug: string) {
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
    erro: false,
    calculadoEm: Math.floor(Date.now() / 1000),
    aviso: null,
  });
  return render(await Pagina({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));
}

function blocoTrajeto(container: HTMLElement): HTMLElement {
  const bloco = container.querySelector<HTMLElement>('[data-bloco="trajeto"]');
  expect(bloco, "o bloco Trajeto perdeu a identidade endereçável").not.toBeNull();
  return bloco!;
}

describe("o bloco Trajeto lê a cadeia", () => {
  it("o bloco Trajeto lista TODAS as etapas, na ordem", async () => {
    const { container } = await abrir(TRES_PONTOS.slug);
    const trajeto = blocoTrajeto(container);
    const itens = within(trajeto).getAllByRole("listitem");
    // 🔴 A ORDEM, e não "estão em algum lugar": `[1]` antes de `[2]`, e só eles.
    // O destino NÃO entra na lista — ele já é o cartão de cima, com mapa e
    // distância; repeti-lo como etapa seria o lugar contado duas vezes.
    expect(itens.map((li) => li.querySelector(".t")?.textContent)).toEqual([SEGUNDO, TERCEIRO]);
  });

  it("a nota da etapa aparece, marcada como Nível B — dentro do item DELA", async () => {
    const { container } = await abrir(TRES_PONTOS.slug);
    const [segundo, terceiro] = within(blocoTrajeto(container)).getAllByRole("listitem");
    const nota = within(segundo).getByText(NOTA_DO_SEGUNDO);
    expect(nota.getAttribute("data-nivel")).toBe("b");
    // O terceiro ponto não tem nota, e a do segundo não vaza pra ele.
    expect(within(terceiro).queryByText(NOTA_DO_SEGUNDO)).toBeNull();
  });

  it("cada etapa tem a coordenada dela e o link do mapa DELA", async () => {
    const { container } = await abrir(TRES_PONTOS.slug);
    const [, terceiro] = within(blocoTrajeto(container)).getAllByRole("listitem");
    const [, , w2] = TRES_PONTOS.trajeto.waypoints;
    expect(terceiro.querySelector(".coord")?.textContent).toBe(`${w2.lat}, ${w2.lng}`);
    expect(within(terceiro).getByRole("link").getAttribute("href")).toContain(`${w2.lat},${w2.lng}`);
  });

  it("o cartão de cima continua sendo o DESTINO, com o nome dele", async () => {
    const { container } = await abrir(TRES_PONTOS.slug);
    expect(container.querySelector("h1")?.textContent).toBe(DESTINO);
    expect(blocoTrajeto(container).querySelector(".wp-body .t")?.textContent).toBe(DESTINO);
  });

  it("ficha com um ponto só continua igual — nada de lista de um item", async () => {
    const { container } = await abrir("rampa-do-pepe");
    const trajeto = blocoTrajeto(container);
    expect(within(trajeto).queryByRole("list")).toBeNull();
  });
});

// 🔴 O que a cadeia NÃO pode mudar. `waypoints[0]` é O LUGAR.
describe("o que fala do LUGAR continua no waypoint 0", () => {
  it("a home mostra o nome do DESTINO, não o da primeira etapa", () => {
    const leitura = { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000, aviso: null };
    render(<CartaoTrilha ficha={TRES_PONTOS} inicial={leitura} />);
    expect(screen.getByText(DESTINO)).toBeTruthy();
    expect(screen.queryByText(SEGUNDO)).toBeNull();
  });

  // 🔴 C3 da auditoria: a versão do plano fazia cópia RASA (sujava a fixture
  // compartilhada) e afirmava "o primeiro não é AAA…", que nenhuma ordenação
  // tornaria falso. Esta mede a POSIÇÃO: a etapa se chama "AAA…" (ordenaria
  // primeiro), o destino se chama "Zz…" (ordena por último), e o lugar tem de
  // ir pro FIM — onde o nome do DESTINO o põe.
  it("a ordem do acervo continua pelo nome do destino", () => {
    const fora = tresPontos();
    fora.trajeto.waypoints[1].nome = "AAA primeiro do alfabeto";

    const ordenado = ordenarPorNome([fora, ...ACERVO]);

    expect(ACERVO.length, "o acervo real tem de estar na conta").toBeGreaterThanOrEqual(2);
    expect(ordenado.indexOf(fora)).toBe(ordenado.length - 1);
    // e a fixture compartilhada não foi tocada
    expect(TRES_PONTOS.trajeto.waypoints[1].nome).toBe(SEGUNDO);
  });
});
