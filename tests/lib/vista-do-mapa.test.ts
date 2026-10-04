import { describe, expect, it, vi } from "vitest";
import { ESTADO_DO_APP, urlBuscaCidade } from "@/lib/lugares";
import {
  MAPA_ALTURA_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_ZOOM,
  MAPA_ZOOM_EDITOR,
  MAPA_ZOOM_EDITOR_MIN,
  enquadrar,
} from "@/lib/mapa";
import { cidadeNoEstado, vistaDaCoordSemPonto, vistaDoAcervo, type FontesDaVista } from "@/lib/vista-do-mapa";

/** DE ONDE O MAPA DE PÔR O PIN COMEÇA QUANDO AINDA NÃO HÁ PONTO (Tarefa 11f, M2
 *  + C2/I1/I2 da auditoria). A vista é só o CENTRO do que a tela mostra — nunca
 *  um ponto gravado nem mostrado como fato.
 *
 *  🔴 TODA CIDADE AQUI É MARCADOR, e toda coordenada também: homônimos
 *  inventados, em estados inventados, com números que não apontam pra lugar
 *  nenhum que importe. A forma da resposta é a do serviço (`results[].name`,
 *  `admin1`, `latitude`, `longitude`), a mesma que `lerLugares` lê. */

const item = (name: string, admin1: string, latitude: number, longitude: number) => ({
  name,
  admin1,
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

  it("DUAS iguais no estado do app: nada — não há como saber qual é", () => {
    const duas = {
      results: [item("Cidade Marcador", ESTADO_DO_APP, -8.2, -36.2), item("Cidade Marcador", ESTADO_DO_APP, -7.9, -39.9)],
    };
    expect(cidadeNoEstado(duas, "Cidade Marcador")).toBeNull();
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

  it("cidade não achada, serviço fora (503/estouro) ou sem cidade: o acervo", async () => {
    const acervo = vistaDoAcervo(ACERVO);
    expect(await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", fontes(async () => ({})))).toEqual(acervo);
    const fora = fontes(async () => {
      throw new Error("503");
    });
    expect(await vistaDaCoordSemPonto(doc("Cidade Marcador"), "trajeto.waypoints.0.lat", fora)).toEqual(acervo);
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
