/** 🔴 PROVA DE JUNÇÃO, não de unidade.
 *
 *  Três telas respondem "é longe?" sobre a mesma trilha: o cartão da home, a
 *  ficha da trilha e o filtro "até 60 km". Cada uma tem teste próprio, e os
 *  três passavam enquanto o cartão e o filtro mediam até `condicao.coords` e a
 *  ficha media até `trajeto.waypoints[0]` — porque a única ficha que existe
 *  hoje tem as duas coordenadas IGUAIS. Testar cada ponta contra si mesma nunca
 *  ia pegar isso; só uma ficha em que as duas coordenadas DIFEREM de propósito
 *  pega.
 *
 *  A ficha é sintética justamente por isso: ela é o caso que a segunda ficha
 *  real vai criar, e que ninguém pode esperar acontecer em produção pra
 *  descobrir. Com o defeito de volta, o cartão anuncia ~89 km, a ficha da mesma
 *  trilha anuncia ~40, e o "até 60 km" esconde uma trilha cujo portão está a
 *  40 — sumindo sem explicação nenhuma na tela. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { Ficha } from "@/types/ficha";

// Onde a pessoa está.
const VOCE = { lat: -8.0, lng: -36.0 };
// Onde a trilha COMEÇA — o ponto que o "Abrir no mapa" da ficha abre.
// 0,36° de latitude ao norte ≈ 40,0 km.
const INICIO = { lat: -7.64, lng: -36.0 };
// Onde se mede a CHUVA — outro ponto, como o questionário já permite.
// 0,80° de latitude ao norte ≈ 89,0 km.
const CLIMA = { lat: -7.2, lng: -36.0 };

// O km que as três telas TÊM que dizer. Literal, não calculado com a mesma
// função que está sendo provada: régua auto-referente não mede nada.
const KM_CERTO = "~40 km em linha reta";

const { FICHA } = vi.hoisted(() => ({
  FICHA: {
    slug: "morro-sintetico",
    modos: ["contemplativo"],
    rotulo_escaneio: "MORRO",
    promessa: "Uma trilha inventada só pra este teste.",
    voz: "Sobe cedo.",
    premio: "A vista.",
    trajeto: {
      waypoints: [{ nome: "Morro Sintético", lat: -7.64, lng: -36.0, nota: "o portão" }],
    },
    acesso: "De carro.",
    avisos: "Leve água.",
    condicao: {
      coords: { lat: -7.2, lng: -36.0 },
      regra: {
        tipo: "chuva_binaria",
        janela_previsao_horas: 3,
        janela_passado_horas: 6,
        limiar_mm: 1,
      },
      regra_texto: "chuva nas últimas 6h ou nas próximas 3h",
      ressalva_proxy: "A leitura é de satélite — confira no lugar.",
    },
    discriminador: {
      formato: "olhar o chão",
      como_ler: "Pise e veja se marca.",
      permissao_abortar: "Se marcar, volte.",
    },
    custo: { tag: "gratis" as const },
  } satisfies Ficha as Ficha,
}));

vi.mock("@/lib/ficha", async (real) => ({
  ...(await real<typeof import("@/lib/ficha")>()),
  getFicha: () => FICHA,
}));

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { distanciaKm } = await import("@/lib/geo");
const { passaNoFiltro, SEM_FILTRO } = await import("@/lib/filtros");
const { CHAVE_LOCAL } = await import("@/lib/local");
const CartaoTrilha = (await import("@/app/CartaoTrilha")).default;
const LocalVivo = (await import("@/app/local")).default;
const PaginaDaFicha = (await import("@/app/[slug]/page")).default;

const LEITURA = { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 };

function guardarLocal() {
  localStorage.setItem(
    CHAVE_LOCAL,
    JSON.stringify({
      tipo: "escolhido",
      coord: VOCE,
      em: 1_800_000_000,
      nome: "Lugar Fictício",
      regiao: "Pernambuco",
    }),
  );
}

/** O km que uma tela mostra, seja qual for o resto do texto ao redor. */
const kmMostrado = (texto: string | null | undefined) =>
  texto?.match(/~[\d,]+ km em linha reta/)?.[0] ?? null;

afterEach(() => {
  cleanup();
  vi.mocked(resolverEstado).mockReset();
  localStorage.clear();
});

describe("a ficha sintética separa as duas coordenadas de verdade", () => {
  // Sem isto, um dia alguém "conserta" as coordenadas pra ficarem iguais e o
  // teste inteiro vira decoração: passaria com o defeito de volta.
  it("as duas coordenadas da ficha são diferentes", () => {
    expect(FICHA.trajeto.waypoints[0]).toMatchObject(INICIO);
    expect(FICHA.condicao.coords).toEqual(CLIMA);
    expect(FICHA.condicao.coords).not.toEqual(INICIO);
  });

  it("e elas caem em lados OPOSTOS do recorte de 60 km", () => {
    expect(distanciaKm(VOCE, INICIO)).toBeLessThan(60);
    expect(distanciaKm(VOCE, CLIMA)).toBeGreaterThan(60);
  });
});

describe("uma trilha, UM km", () => {
  it("o cartão da home e a ficha da trilha dizem o MESMO número", async () => {
    guardarLocal();
    vi.mocked(resolverEstado).mockResolvedValue({
      estado: "fresco",
      erro: false,
      calculadoEm: Math.floor(Date.now() / 1000),
    });

    const cartao = render(
      <LocalVivo>
        <CartaoTrilha ficha={FICHA} inicial={LEITURA} />
      </LocalVivo>,
    );
    const kmDoCartao = kmMostrado(cartao.container.querySelector(".cartao-meta")?.textContent);

    const pagina = render(
      await PaginaDaFicha({
        params: Promise.resolve({ slug: FICHA.slug }),
        searchParams: Promise.resolve({}),
      }),
    );
    const kmDaFicha = kmMostrado(pagina.container.querySelector(".dist")?.textContent);

    expect(kmDoCartao, "o cartão parou de medir até o início da trilha").toBe(KM_CERTO);
    expect(kmDaFicha, "a ficha parou de medir até o início da trilha").toBe(KM_CERTO);
    expect(kmDaFicha).toBe(kmDoCartao);
  });

  it("o filtro 'até 60 km' usa esse MESMO km — e não esconde a trilha", () => {
    const passa = passaNoFiltro({
      ficha: FICHA,
      leitura: LEITURA,
      filtros: { ...SEM_FILTRO, distanciaKm: 60 },
      voce: VOCE,
      confia: true,
    });
    // Com o filtro medindo até `condicao.coords` (89 km), esta trilha sumia da
    // home mostrando "~40 km em linha reta" no cartão que a pessoa acabou de
    // ver. Filtro que esconde por um número que a tela não mostra.
    expect(passa, "o filtro escondeu uma trilha que o cartão anuncia a 40 km").toBe(true);
  });
});
