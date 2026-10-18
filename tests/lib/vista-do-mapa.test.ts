import { afterEach, describe, expect, it, vi } from "vitest";
import { ESTADO_DO_APP, PRAZO_BUSCA_MS, urlBuscaCidade } from "@/lib/lugares";
import {
  MAPA_ALTURA_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_ZOOM,
  MAPA_ZOOM_EDITOR,
  MAPA_ZOOM_EDITOR_MIN,
  TILE_PX,
  enquadrar,
} from "@/lib/mapa";
import { distanciaKm } from "@/lib/geo";
import {
  FONTES_DE_PRODUCAO,
  cidadeNoEstado,
  vistaDaCidade,
  vistaDaCoordSemPonto,
  vistaDoAcervo,
  VIZINHAS_KM,
  type FontesDaVista,
} from "@/lib/vista-do-mapa";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** DE ONDE O MAPA DE PÔR O PIN COMEÇA QUANDO AINDA NÃO HÁ PONTO (Tarefa 11f, M2
 *  + C2/I1/I2 da auditoria). A vista é só o CENTRO do que a tela mostra — nunca
 *  um ponto gravado nem mostrado como fato.
 *
 *  🔴 TODA CIDADE AQUI É MARCADOR, e toda coordenada também: homônimos
 *  inventados, em estados inventados, com números que não apontam pra lugar
 *  nenhum que importe. A forma da resposta é a do serviço (`results[].name`,
 *  `feature_code`, `admin1`, `admin2`, `latitude`, `longitude`).
 *
 *  A EXCEÇÃO é o bloco das cidades reais de Pernambuco (I-2 da revisão da 11f):
 *  nome e coordenada de município são dado público de geografia, copiados da
 *  resposta do serviço medida em 2026-10-04 — e nenhum deles vai pra ficha. */

const item = (name: string, admin1: string, latitude: number, longitude: number, feature_code = "PPL", admin2?: string) => ({
  name,
  feature_code,
  admin1,
  ...(admin2 === undefined ? {} : { admin2 }),
  country: "Brasil",
  latitude,
  longitude,
});

/** O caso que a auditoria mediu de verdade (a busca devolve um homônimo de outro
 *  estado ANTES do de Pernambuco), com nomes inventados. */
const HOMONIMOS = {
  results: [
    item("Vila Marcador", "Estado Marcador Sul", -23.5, -46.5),
    item("Cidade Marcador", "Estado Marcador Sul", -23.1, -46.1),
    item("Cidade Marcador", ESTADO_DO_APP, -8.25, -37.75),
    item("Cidade Marcador", "Estado Marcador Norte", -1.5, -48.5),
  ],
};

describe("urlBuscaCidade — a busca da VISTA, que não é a busca da tela pública", () => {
  it("pede só o Brasil, e bem mais que cinco resultados (com cinco, a cidade certa some atrás dos homônimos)", () => {
    const u = new URL(urlBuscaCidade("Cidade Marcador"));
    expect(u.searchParams.get("countryCode")).toBe("BR");
    expect(Number(u.searchParams.get("count"))).toBeGreaterThanOrEqual(20);
    expect(Number(u.searchParams.get("count"))).toBeLessThanOrEqual(100); // o teto do serviço
    expect(u.searchParams.get("name")).toBe("Cidade Marcador");
    expect(u.searchParams.get("language")).toBe("pt");
  });
});

describe("cidadeNoEstado — só o nome IGUAL, e só no estado do app", () => {
  it("o homônimo de outro estado vem ANTES na lista, e não é ele que vale", () => {
    expect(cidadeNoEstado(HOMONIMOS, "Cidade Marcador")).toEqual({ lat: -8.25, lng: -37.75 });
  });

  it("nome igual sem caixa nem acento: 'cidade marcador' e 'Cidade Márcador' acham a mesma", () => {
    expect(cidadeNoEstado(HOMONIMOS, "  cidade   marcador ")).toEqual({ lat: -8.25, lng: -37.75 });
    const comAcento = { results: [item("Cidade Márcador", ESTADO_DO_APP, -8.3, -37.7)] };
    expect(cidadeNoEstado(comAcento, "cidade marcador")).toEqual({ lat: -8.3, lng: -37.7 });
  });

  it("nome que só CONTÉM o digitado não vale ('Vila Marcador' não é 'Marcador')", () => {
    const so = { results: [item("Vila Marcador", ESTADO_DO_APP, -8.1, -35.1)] };
    expect(cidadeNoEstado(so, "Marcador")).toBeNull();
  });

  it("só em outro estado: nada (a vista cai no acervo, não no estado errado)", () => {
    const fora = { results: [item("Cidade Marcador", "Estado Marcador Sul", -23.1, -46.1)] };
    expect(cidadeNoEstado(fora, "Cidade Marcador")).toBeNull();
  });

  it("DUAS iguais no estado do app, sem sede nem município pra desempatar: AMBÍGUA — não há como saber qual é", () => {
    const duas = {
      results: [item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2), item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9)],
    };
    expect(cidadeNoEstado(duas, "Cidade Marcador")).toBe("ambigua");
  });

  // I-2 da revisão da 11f: a busca devolve também o que NÃO é cidade (um
  // aeródromo, um cabo) com o mesmo nome, e a regra "exatamente uma" recusava
  // cidades reais. Só lugar HABITADO (as classes `PPL*` do GeoNames) conta.
  it("só lugar habitado conta: o aeródromo e o cabo de mesmo nome não fazem a cidade virar ambígua", () => {
    const comAeroporto = {
      results: [
        item("Cidade Marcador", ESTADO_DO_APP, -8.3, -36.4),
        item("Cidade Marcador", ESTADO_DO_APP, -8.31, -36.41, "AIRF"),
        item("Cidade Marcador", ESTADO_DO_APP, -8.35, -34.9, "CAPE"),
      ],
    };
    expect(cidadeNoEstado(comAeroporto, "Cidade Marcador")).toEqual({ lat: -8.3, lng: -36.4 });
  });

  it("lugar que não é habitado (aeródromo, ruína, lugar abandonado) sozinho: nada", () => {
    for (const fc of ["AIRF", "CAPE", "PPLH", "PPLQ", "PPLW"]) {
      const so = { results: [item("Cidade Marcador", ESTADO_DO_APP, -8.3, -36.4, fc)] };
      expect(cidadeNoEstado(so, "Cidade Marcador"), fc).toBeNull();
    }
    const semClasse = { results: [{ ...item("Cidade Marcador", ESTADO_DO_APP, -8.3, -36.4), feature_code: undefined }] };
    expect(cidadeNoEstado(semClasse, "Cidade Marcador"), "sem classe").toBeNull();
  });

  it("duas habitadas, uma é a SEDE (PPLA*): vale a sede", () => {
    const sede = {
      results: [
        item("Cidade Marcador", ESTADO_DO_APP, -8.28, -35.03, "PPLA2"),
        item("Cidade Marcador", ESTADO_DO_APP, -8.29, -35.04, "PPL"),
      ],
    };
    expect(cidadeNoEstado(sede, "Cidade Marcador")).toEqual({ lat: -8.28, lng: -35.03 });
  });

  it("duas habitadas, sem sede: vale a do MUNICÍPIO de mesmo nome (a outra é um povoado de outro município)", () => {
    const povoado = {
      results: [
        item("Cidade Marcador", ESTADO_DO_APP, -8.47, -35.73, "PPL", "Cidade Marcador"),
        item("Cidade Marcador", ESTADO_DO_APP, -8.62, -36.28, "PPL", "Município Marcador"),
      ],
    };
    expect(cidadeNoEstado(povoado, "Cidade Marcador")).toEqual({ lat: -8.47, lng: -35.73 });
  });

  it("duas SEDES, ou dois do mesmo município: ambígua", () => {
    const duasSedes = {
      results: [item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2, "PPLA2"), item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9, "PPLA3")],
    };
    expect(cidadeNoEstado(duasSedes, "Cidade Marcador")).toBe("ambigua");
    const doisDoMunicipio = {
      results: [
        item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2, "PPL", "Cidade Marcador"),
        item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9, "PPL", "Cidade Marcador"),
      ],
    };
    expect(cidadeNoEstado(doisDoMunicipio, "Cidade Marcador")).toBe("ambigua");
  });

  // W3 da onda de fix 2 da 11f (m-1 da re-revisão): as que sobram sem desempate,
  // todas a até VIZINHAS_KM da primeira, são a MESMA vista — vale a primeira.
  // 0,04° de latitude ≈ 4,4 km; 0,05° ≈ 5,6 km (o limiar é 5 km).
  it("sem sede nem município, todas a até VIZINHAS_KM da primeira: vale a PRIMEIRA; uma mais longe: ambígua", () => {
    const perto = (dLat: number) => ({
      results: [
        item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2, "PPL", "Cidade Marcador"),
        item("Cidade Marcador", ESTADO_DO_APP, -8.2 - dLat, -36.2, "PPL", "Cidade Marcador"),
      ],
    });
    expect(distanciaKm({ lat: -8.2, lng: -36.2 }, { lat: -8.24, lng: -36.2 }), "premissa").toBeLessThan(VIZINHAS_KM);
    expect(distanciaKm({ lat: -8.2, lng: -36.2 }, { lat: -8.25, lng: -36.2 }), "premissa").toBeGreaterThan(VIZINHAS_KM);
    expect(cidadeNoEstado(perto(0.04), "Cidade Marcador")).toEqual({ lat: -8.2, lng: -36.2 });
    expect(cidadeNoEstado(perto(0.05), "Cidade Marcador")).toBe("ambigua");
    // três: as duas primeiras vizinhas, a terceira longe — ainda ambígua
    const tres = {
      results: [...perto(0.01).results, item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9, "PPL", "Município Marcador")],
    };
    expect(cidadeNoEstado(tres, "Cidade Marcador")).toBe("ambigua");
  });

  // O limiar é escolhido pela geometria da vista: com as outras a até
  // VIZINHAS_KM da primeira, a vista centrada nela (MAPA_ZOOM, moldura de
  // MAPA_ALTURA_PX) mostra todas — cabe na METADE da altura, o lado mais curto.
  it("VIZINHAS_KM cabe na metade da altura da vista da cidade, na latitude de Pernambuco", () => {
    const mPorPx = (40075016.686 * Math.cos((9 * Math.PI) / 180)) / (TILE_PX * 2 ** MAPA_ZOOM);
    const metadeDaAlturaKm = (mPorPx * MAPA_ALTURA_PX) / 2 / 1000;
    expect(VIZINHAS_KM).toBeGreaterThan(0);
    expect(VIZINHAS_KM).toBeLessThan(metadeDaAlturaKm);
  });

  it("resposta vazia, torta ou sem resultado: nada, sem estourar; cidade em branco: nada", () => {
    expect(cidadeNoEstado({}, "Cidade Marcador")).toBeNull();
    expect(cidadeNoEstado(null, "Cidade Marcador")).toBeNull();
    expect(cidadeNoEstado({ results: "x" }, "Cidade Marcador")).toBeNull();
    expect(cidadeNoEstado(HOMONIMOS, "   ")).toBeNull();
  });
});

describe("vistaDoAcervo — o fallback vem do BANCO, nunca de número cravado no código", () => {
  const ACERVO = [
    { lat: -8.0, lng: -35.0 },
    { lat: -8.6, lng: -36.4 },
  ];

  it("é o enquadramento das coordenadas do acervo, o mesmo quadro da home", () => {
    const v = vistaDoAcervo(ACERVO)!;
    const q = enquadrar(ACERVO, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_PX);
    expect(v.centro).toEqual(q.centro);
    expect(v.z).toBe(q.z);
    expect(v.origem).toBe("acervo");
  });

  it("o zoom fica entre o piso do editor e o da ficha pública: um acervo espalhado não vira mancha", () => {
    const longe = [
      { lat: 10, lng: -70 },
      { lat: -30, lng: -35 },
    ];
    expect(enquadrar(longe, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_PX).z, "premissa").toBeLessThan(MAPA_ZOOM_EDITOR_MIN);
    expect(vistaDoAcervo(longe)!.z).toBe(MAPA_ZOOM_EDITOR_MIN);
    expect(vistaDoAcervo([ACERVO[0]])!.z).toBe(MAPA_ZOOM);
  });

  it("acervo vazio: nenhuma vista — e não um número inventado", () => {
    expect(vistaDoAcervo([])).toBeNull();
  });
});

describe("vistaDaCoordSemPonto — a ordem das fontes", () => {
  const ACERVO = [{ lat: -8.0, lng: -35.0 }];
  const fontes = (buscar: FontesDaVista["buscarCidade"]): FontesDaVista => ({
    buscarCidade: vi.fn(buscar),
    coordsDoAcervo: vi.fn(async () => ACERVO),
  });
  const doc = (cidade?: string, ponto0?: unknown) => ({
    ...(cidade === undefined ? {} : { cidade }),
    trajeto: { waypoints: [{ nome: "Lugar Marcador", ...(ponto0 as object) }] },
  });

  it("cidade achada no estado: a vista começa nela, no zoom da ficha pública (mostra nome de cidade)", async () => {
    const f = fontes(async () => HOMONIMOS);
    const v = await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", f);
    expect(v).toEqual({ centro: { lat: -8.25, lng: -37.75 }, z: MAPA_ZOOM, origem: "cidade" });
    expect(f.buscarCidade).toHaveBeenCalledWith("Cidade Marcador");
    expect(f.coordsDoAcervo).not.toHaveBeenCalled();
  });

  it("cidade não achada, serviço fora (503/estouro) ou sem cidade: o acervo — e só a que foi procurada diz \"não achada\"", async () => {
    const acervo = vistaDoAcervo(ACERVO);
    const naoAchada = { ...acervo!, origem: "cidade-nao-achada" };
    expect(await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", fontes(async () => ({})))).toEqual(naoAchada);
    const fora = fontes(async () => {
      throw new Error("503");
    });
    expect(await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", fora)).toEqual(naoAchada);
    const sem = fontes(async () => HOMONIMOS);
    expect(await vistaDaCoordSemPonto(doc(), "trajeto.waypoints.0.lat", sem)).toEqual(acervo);
    expect(sem.buscarCidade, "sem cidade não há o que buscar").not.toHaveBeenCalled();
  });

  it("acervo fora do ar e cidade não achada: nenhuma vista", async () => {
    const f: FontesDaVista = {
      buscarCidade: async () => ({}),
      coordsDoAcervo: async () => {
        throw new Error("banco fora");
      },
    };
    expect(await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", f)).toBeNull();
  });

  // M2: pra a coordenada da CHUVA, o ponto de partida do lugar (o ponto 0) já
  // dado por ele é um centro melhor que a cidade — e não precisa de rede.
  it("condicao.coords com o ponto 0 já marcado: a vista começa NELE, no zoom de pôr o pin, sem buscar nada", async () => {
    const f = fontes(async () => HOMONIMOS);
    const v = await vistaDaCoordSemPonto(doc("Cidade Marcador", { lat: -8.4, lng: -36.2 }), "condicao.coords", f);
    expect(v).toEqual({ centro: { lat: -8.4, lng: -36.2 }, z: MAPA_ZOOM_EDITOR, origem: "ponto" });
    expect(f.buscarCidade).not.toHaveBeenCalled();
  });

  it("condicao.coords SEM o ponto 0: a cidade, como as outras", async () => {
    const v = await vistaDaCoordSemPonto(doc("Cidade Marcador"), "condicao.coords", fontes(async () => HOMONIMOS));
    expect(v?.origem).toBe("cidade");
  });

  it("o ponto 0 só serve à chuva: um OUTRO ponto do trajeto sem par começa na cidade, não no ponto 0", async () => {
    const v = await vistaDaCoordSemPonto(
      doc("Cidade Marcador", { lat: -8.4, lng: -36.2 }),
      "trajeto.waypoints.1.lat",
      fontes(async () => HOMONIMOS),
    );
    expect(v?.origem).toBe("cidade");
  });

  it("o ponto 0 só serve à chuva: a pergunta do próprio ponto 0 não começa nele", async () => {
    const v = await vistaDaCoordSemPonto(
      doc("Cidade Marcador", { lat: Number.NaN, lng: -36.2 }),
      "trajeto.waypoints.0.lat",
      fontes(async () => HOMONIMOS),
    );
    expect(v?.origem).toBe("cidade");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 I-2 DA REVISÃO DA 11f: CIDADES REAIS DE PERNAMBUCO que a regra "exatamente
// uma" recusava — Bonito (a do Véu de Noiva) entre elas. As linhas são as que o
// serviço devolveu em 2026-10-04 com \`admin1\` = Pernambuco (as de outros
// estados vêm na mesma resposta e já caíam pelo estado), na forma da resposta.
// Nome e coordenada de município são dado público; nenhum vai pra ficha.
// ═══════════════════════════════════════════════════════════════════════════
describe("cidadeNoEstado — as cidades reais que a revisão mediu", () => {
  const PE = ESTADO_DO_APP;
  const outroEstado = (name: string) => item(name, "Mato Grosso do Sul", -21.12, -56.48, "PPL", name);
  const CASOS: [string, ReturnType<typeof item>[], { lat: number; lng: number }][] = [
    [
      "Bonito",
      [
        outroEstado("Bonito"),
        item("Bonito", PE, -8.47028, -35.72861, "PPL", "Bonito"),
        item("Bonito", PE, -8.61667, -36.28333, "PPL", "Ibirajuba"),
      ],
      { lat: -8.47028, lng: -35.72861 },
    ],
    [
      "Cabo de Santo Agostinho",
      [
        item("Cabo de Santo Agostinho", PE, -8.28773, -35.02925, "PPLA2", "Cabo de Santo Agostinho"),
        item("Cabo de Santo Agostinho", PE, -8.28667, -35.035, "PPL", "Cabo de Santo Agostinho"),
        item("Cabo de Santo Agostinho", PE, -8.35167, -34.9398, "CAPE", "Cabo de Santo Agostinho"),
      ],
      { lat: -8.28773, lng: -35.02925 },
    ],
    [
      "Santa Cruz do Capibaribe",
      [
        item("Santa Cruz do Capibaribe", PE, -7.9575, -36.20472, "PPL", "Santa Cruz do Capibaribe"),
        item("Santa Cruz Do Capibaribe", PE, -7.95, -36.2, "AIRF", "Santa Cruz do Capibaribe"),
      ],
      { lat: -7.9575, lng: -36.20472 },
    ],
    [
      "Belo Jardim",
      [
        item("Belo Jardim", PE, -8.33556, -36.42417, "PPL", "Belo Jardim"),
        item("Belo Jardim", PE, -8.34923, -36.40015, "AIRF", "Belo Jardim"),
      ],
      { lat: -8.33556, lng: -36.42417 },
    ],
    // m-1 da re-revisão da 11f: as duas entradas do MESMO município, a menos de
    // 1 km uma da outra, sem sede (medido no serviço em 2026-10-04, 3 casas).
    [
      "Barra de Guabiraba",
      [
        item("Barra de Guabiraba", PE, -8.416, -35.663, "PPL", "Barra de Guabiraba"),
        item("Barra de Guabiraba", PE, -8.42, -35.658, "PPL", "Barra de Guabiraba"),
      ],
      { lat: -8.416, lng: -35.663 },
    ],
  ];
  for (const [cidade, results, esperado] of CASOS) {
    it(`${cidade}: acha a cidade, e não "nenhuma" nem "ambígua"`, () => {
      expect(cidadeNoEstado({ results }, cidade)).toEqual(esperado);
    });
  }
});

describe("vistaDaCidade — a cidade ambígua não é \"não achei\"", () => {
  const ACERVO = [{ lat: -8.0, lng: -35.0 }];
  it("mais de uma no estado: a vista do acervo, com a origem dizendo que a cidade foi achada mais de uma vez", async () => {
    const duas = {
      results: [item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2), item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9)],
    };
    const v = await vistaDaCidade({ cidade: "Cidade Marcador" }, { buscarCidade: async () => duas, coordsDoAcervo: async () => ACERVO });
    expect(v).toEqual({ ...vistaDoAcervo(ACERVO)!, origem: "cidade-ambigua" });
  });
  it("nenhuma: a vista do acervo, origem \"cidade-nao-achada\" (procurou e não achou)", async () => {
    const v = await vistaDaCidade({ cidade: "Cidade Marcador" }, { buscarCidade: async () => ({}), coordsDoAcervo: async () => ACERVO });
    expect(v).toEqual({ ...vistaDoAcervo(ACERVO)!, origem: "cidade-nao-achada" });
  });
  it("o serviço de cidade fora do ar também é \"procurou e não achou\"", async () => {
    const fora = async () => {
      throw new Error("fora");
    };
    const v = await vistaDaCidade({ cidade: "Cidade Marcador" }, { buscarCidade: fora, coordsDoAcervo: async () => ACERVO });
    expect(v?.origem).toBe("cidade-nao-achada");
  });
  // 17/10: o rascunho novo não tem cidade antes do ponto. Nada foi procurado, então a
  // tela não pode dizer que não achou.
  it("documento sem cidade: origem acervo, e nenhuma busca de cidade saiu", async () => {
    const buscas: string[] = [];
    const fontes = {
      buscarCidade: async (c: string) => {
        buscas.push(c);
        return {};
      },
      coordsDoAcervo: async () => ACERVO,
    };
    for (const doc of [{}, { cidade: "" }, { cidade: "   " }, { cidade: 7 }]) {
      const v = await vistaDaCidade(doc, fontes);
      expect(v, JSON.stringify(doc)).toEqual(vistaDoAcervo(ACERVO));
      expect(v?.origem).toBe("acervo");
    }
    expect(buscas).toEqual([]);
  });
  it("ambígua e acervo fora do ar: nenhuma vista", async () => {
    const duas = {
      results: [item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2), item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9)],
    };
    const v = await vistaDaCidade(
      { cidade: "Cidade Marcador" },
      {
        buscarCidade: async () => duas,
        coordsDoAcervo: async () => {
          throw new Error("banco fora");
        },
      },
    );
    expect(v).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 I-1 DA REVISÃO DA 11f: AS FONTES DE PRODUÇÃO, com o \`fetch\` dublado. O
// prazo é o que impede a página do painel de pendurar quando o serviço de
// geocoding aceita a conexão e não responde (sem ele, o \`fetch\` do Node espera
// o seu próprio teto, minutos). O relógio do prazo é encurtado pelo dublê do
// \`AbortSignal.timeout\` — e o teste confere que ele foi pedido com o
// \`PRAZO_BUSCA_MS\` —, então o caso mede o CAMINHO (pendurado → aborta → acervo)
// sem esperar 3 s.
// ═══════════════════════════════════════════════════════════════════════════
describe("FONTES_DE_PRODUCAO — a busca da cidade tem prazo, e resposta ruim cai no acervo", () => {
  const ACERVO = [{ lat: -8.0, lng: -35.0 }];
  const UMA = { results: [item("Cidade Marcador", ESTADO_DO_APP, -8.25, -37.75)] };
  const fontes: FontesDaVista = { ...FONTES_DE_PRODUCAO, coordsDoAcervo: async () => ACERVO };
  const PENDUROU = Symbol("pendurou");
  const comLimite = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<typeof PENDUROU>((r) => setTimeout(() => r(PENDUROU), ms))]);

  it("serviço que responde: pede a URL da vista, sem cache e com o signal do prazo — e acha a cidade", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const f = vi.fn(async (_u: string, _i?: RequestInit) => Response.json(UMA));
    vi.stubGlobal("fetch", f);
    const v = await vistaDaCidade({ cidade: "Cidade Marcador" }, fontes);
    expect(v?.origem).toBe("cidade");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(urlBuscaCidade("Cidade Marcador"));
    expect(init?.cache).toBe("no-store");
    expect(timeout).toHaveBeenCalledWith(PRAZO_BUSCA_MS);
    expect(init?.signal).toBe(timeout.mock.results[0]?.value);
  });

  it("serviço PENDURADO: o prazo aborta a busca e a vista cai no acervo — a página não pendura", async () => {
    const real = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => real(20));
    // aceita a conexão e nunca responde; só desiste se o signal abortar
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init?: RequestInit) =>
          new Promise<Response>((_ok, falha) => init?.signal?.addEventListener("abort", () => falha(init.signal!.reason))),
      ),
    );
    const v = await comLimite(vistaDaCidade({ cidade: "Cidade Marcador" }, fontes), 1_000);
    expect(v, "a busca pendurou: nenhum prazo abortou o fetch").not.toBe(PENDUROU);
    expect(v).toEqual({ ...vistaDoAcervo(ACERVO)!, origem: "cidade-nao-achada" });
    expect(timeout).toHaveBeenCalledWith(PRAZO_BUSCA_MS);
  });

  it("resposta que não é ok (503), mesmo com uma cidade boa no corpo: o acervo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(UMA, { status: 503 })));
    expect(await vistaDaCidade({ cidade: "Cidade Marcador" }, fontes)).toEqual({
      ...vistaDoAcervo(ACERVO)!,
      origem: "cidade-nao-achada",
    });
  });
});
