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

// O mesmo, pros dois fatos que a Task 7 levou pra ficha: o texto que as DUAS
// telas têm que dizer, escrito à mão. Chamar `formatarExtensao`/`rotuloPiso`
// aqui seria medir a função com ela mesma.
const EXTENSAO_CERTA = "4,3 km de trilha";
const PISO_CERTO = "asfalto esburacado";

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
    // 🔴 Os dois campos abaixo são a matéria da segunda prova de junção desta
    //    família (a extensão e o piso, que a ficha ganhou na Task 7). Sem eles
    //    a comparação entre as duas telas seria `null === null`: uma prova
    //    OCA, verde com a linha apagada dos dois lados. Os valores são
    //    load-bearing:
    //    - `extensaoKm: 4.25` e não 4: `formatarExtensao` arredonda pra uma
    //      casa e usa VÍRGULA ("4,3"); com inteiro, a função e um
    //      `${km} km de trilha` escrito à mão dão a MESMA string e a prova não
    //      separa as duas versões.
    //    - `piso: "asfalto-esburacado"` e não "barro": `rotuloPiso("barro")`
    //      devolve "barro", e aí chamar a função ou mostrar o enum cru é
    //      indistinguível.
    extensaoKm: 4.25,
    piso: "asfalto-esburacado" as const,
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

/** A extensão e o piso que uma tela mostra. O `.` e o `-` dentro dos padrões
 *  são de propósito: a versão ERRADA ("4.25 km de trilha" escrito à mão,
 *  "asfalto-esburacado" cru) tem que ser CAPTURADA pra ser comparada e
 *  reprovada — um padrão que só aceitasse a versão certa devolveria `null` e
 *  transformaria a divergência em silêncio. */
const extensaoMostrada = (texto: string | null | undefined) =>
  texto?.match(/[\d.,]+ km de trilha/)?.[0] ?? null;
const pisoMostrado = (texto: string | null | undefined) =>
  texto?.match(/asfalto[- ]esburacado/)?.[0] ?? null;

/** As duas telas, renderizadas com a MESMA ficha. É a razão de este arquivo
 *  existir: cada ponta testada contra si mesma nunca acusa divergência. */
async function asDuasTelas() {
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
  const pagina = render(
    await PaginaDaFicha({
      params: Promise.resolve({ slug: FICHA.slug }),
      searchParams: Promise.resolve({}),
    }),
  );
  return {
    noCartao: cartao.container.querySelector(".cartao-meta")?.textContent,
    naFicha: pagina.container.querySelector(".fatos")?.textContent,
  };
}

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

/** O irmão do de cima, pros dois fatos que a ficha ganhou na Task 7. Mesma
 *  família de defeito: duas telas respondendo a mesma pergunta sobre a mesma
 *  trilha e formatando cada uma do seu jeito — "4,3 km de trilha" no cartão e
 *  "4.25 km de trilha" na ficha é a mesma trilha com duas caras.
 *
 *  Cada teste faz DUAS asserções contra o literal e UMA cruzada — e a verdade
 *  medida sobre elas, que vale igual pro teste do km aqui em cima:
 *
 *  **Os dois literais já pegam tudo, e o cruzamento é redundante por
 *  TRANSITIVIDADE.** Enquanto os dois lados forem asseridos contra a MESMA
 *  constante, `daFicha === LITERAL ∧ doCartao === LITERAL ⟹ daFicha ===
 *  doCartao`: não existe estado do mundo em que o cruzamento estoure e os dois
 *  literais passem. Medido: sob a mutação que troca `formatarExtensao` por um
 *  sufixo escrito à mão, quem estoura é o literal da ficha, não o cruzamento.
 *  Nem "alguém atualiza a constante pra casar com a tela quebrada" o salva —
 *  aí estoura o literal do OUTRO lado.
 *
 *  O cruzamento fica assim mesmo, porque custa nada e é rede pro dia em que um
 *  dos literais sair ou em que os dois lados deixarem de compartilhar a
 *  constante — que é justamente quando a transitividade acaba. O que ele NÃO é
 *  é a asserção que pega a divergência hoje. */
/** 🔴 A TERCEIRA JUNÇÃO DESTA FAMÍLIA, e a que este conserto veio fechar: não
 *  "duas telas discordando entre si", mas **a tela e o FILTRO discordando**.
 *
 *  A tela arredondava o km e o recorte comparava o km CRU. Resultado medido
 *  pela revisão da branch inteira: um cartão anunciando "4 km de trilha" sumia
 *  do "até 4 km", e — este já EM PRODUÇÃO — um anunciando "~10 km em linha
 *  reta" sumia do "até 10 km". A pessoa lê o número no cartão, digita esse
 *  mesmo número no recorte, e a trilha some. Nenhum teste de unidade dos dois
 *  lados pega isso: cada lado está certo sozinho.
 *
 *  O teste é escrito NA ORDEM EM QUE A PESSOA FAZ: renderiza o cartão, LÊ os
 *  dois números do texto que apareceu, e usa **esses** números como teto do
 *  filtro. Nada aqui chama `formatarExtensao` nem `kmNaTela*` — régua
 *  auto-referente não mede nada.
 *
 *  A ficha da FRONTEIRA é sintética pela mesma razão da outra deste arquivo:
 *  4,04 km de trilha e 10,4495 km de distância são os valores exatos em que as
 *  duas versões do filtro se SEPARAM (com o km cru, as duas somem). Um valor em
 *  que elas concordassem — 4 km cravados — deixaria a prova oca.
 *
 *  Por que só o CARTÃO, e não também a ficha da trilha: as duas telas já estão
 *  presas ao mesmo texto pelos testes deste arquivo, e `geo.ts` já tem prova de
 *  fonte de que quem formata não refaz a conta (tests/lib/geo.test.ts). O que
 *  faltava, e é o que está aqui, é a ponte TELA→FILTRO. */
describe("o número que a tela mostra é o número que o filtro compara", () => {
  // 10,4495 km ao NORTE de VOCE: com dLng = 0 o haversine vira R·Δφ, e a
  // conversão está escrita aqui pra o número não ser copiado à mão. A
  // construção é conferida dentro do teste antes de valer como prova.
  const KM_DAQUI = 10.4495;
  const KM_DE_TRILHA = 4.04;
  const FRONTEIRA = {
    ...FICHA,
    slug: "morro-da-fronteira",
    trajeto: {
      waypoints: [
        {
          ...FICHA.trajeto.waypoints[0],
          lat: VOCE.lat + (KM_DAQUI / 6371) * (180 / Math.PI),
          lng: VOCE.lng,
        },
      ],
    },
    extensaoKm: KM_DE_TRILHA,
  } satisfies Ficha as Ficha;

  /** O número CRU que a pessoa leu no cartão — o que ela digitaria no recorte.
   *  Vírgula vira ponto porque o campo do filtro é numérico. */
  const numeroDe = (texto: string | null) =>
    texto === null ? null : Number(texto.match(/[\d,]+/)![0].replace(",", "."));

  it("o cartão mostra ~10 km e 4 km, e 'até 10' + 'até 4' NÃO o escondem", () => {
    expect(distanciaKm(VOCE, FRONTEIRA.trajeto.waypoints[0])).toBeCloseTo(KM_DAQUI, 6);

    guardarLocal();
    const cartao = render(
      <LocalVivo>
        <CartaoTrilha ficha={FRONTEIRA} inicial={LEITURA} />
      </LocalVivo>,
    );
    const meta = cartao.container.querySelector(".cartao-meta")?.textContent;

    const tetoDistancia = numeroDe(kmMostrado(meta));
    const tetoExtensao = numeroDe(extensaoMostrada(meta));

    // Sem estas duas, um cartão que parasse de mostrar os números deixaria os
    // tetos em `null` — e filtro desligado passa em tudo, com a prova oca.
    expect(tetoDistancia, "o cartão parou de mostrar a distância").toBe(10);
    expect(tetoExtensao, "o cartão parou de mostrar a extensão").toBe(4);

    // E agora o recorte, com os números que a tela acabou de dar. Com o km cru
    // dos dois lados, este `toBe(true)` era `false` nas duas contas.
    expect(
      passaNoFiltro({
        ficha: FRONTEIRA,
        leitura: LEITURA,
        filtros: { ...SEM_FILTRO, distanciaKm: tetoDistancia, extensaoMaxKm: tetoExtensao },
        voce: VOCE,
        confia: true,
      }),
      "o filtro escondeu a trilha pelos números que o próprio cartão mostrou",
    ).toBe(true);
  });
});

describe("uma trilha, UMA extensão e UM piso", () => {
  it("cartão e ficha mostram o MESMO texto de extensão", async () => {
    const { noCartao, naFicha } = await asDuasTelas();
    const doCartao = extensaoMostrada(noCartao);
    const daFicha = extensaoMostrada(naFicha);

    expect(doCartao, "o cartão parou de mostrar a extensão").toBe(EXTENSAO_CERTA);
    expect(daFicha, "a ficha parou de mostrar a extensão").toBe(EXTENSAO_CERTA);
    expect(daFicha, "as duas telas formatam a extensão de jeitos diferentes").toBe(doCartao);
  });

  it("cartão e ficha mostram o MESMO piso", async () => {
    const { noCartao, naFicha } = await asDuasTelas();
    const doCartao = pisoMostrado(noCartao);
    const daFicha = pisoMostrado(naFicha);

    expect(doCartao, "o cartão parou de mostrar o piso").toBe(PISO_CERTO);
    expect(daFicha, "a ficha parou de mostrar o piso").toBe(PISO_CERTO);
    expect(daFicha, "uma das telas mostra o enum cru e a outra o rótulo").toBe(doCartao);
  });
});
