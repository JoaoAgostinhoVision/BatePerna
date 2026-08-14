import { describe, expect, it } from "vitest";
import {
  CHAVE_LOCAL,
  NAO_SEI,
  coordDe,
  lerEstadoGps,
  lerLocal,
  rotuloPilula,
  type Local,
} from "@/lib/local";

const GPS: Local = { tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000 };
const ESCOLHIDO: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

describe("lerLocal: nada guardado, ou guardado torto, é 'não sei'", () => {
  it("sem nada guardado", () => {
    expect(lerLocal(null)).toEqual(NAO_SEI);
  });

  it("texto que não é JSON não derruba a home", () => {
    expect(lerLocal("{isso não é json")).toEqual(NAO_SEI);
  });

  // Uma versão antiga do app pode ter gravado outra forma aqui. Aceitar
  // qualquer objeto faria coordDe devolver {lat: undefined} e o mapa
  // enquadrar contra NaN — mapa em branco, sem erro nenhum.
  it("objeto com tipo desconhecido", () => {
    expect(lerLocal(JSON.stringify({ tipo: "satelite", coord: { lat: 1, lng: 2 } }))).toEqual(NAO_SEI);
  });

  it("gps sem coordenada numérica", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: "-8", lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("escolhido sem nome não vira escolhido — a pílula ficaria sem o que dizer", () => {
    expect(
      lerLocal(JSON.stringify({ tipo: "escolhido", coord: { lat: -8, lng: -35 }, em: 1, regiao: "PE" })),
    ).toEqual(NAO_SEI);
  });

  it("coordenada fora do mundo é recusada", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: 99, lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("ida e volta preserva o gps", () => {
    expect(lerLocal(JSON.stringify(GPS))).toEqual(GPS);
  });

  it("ida e volta preserva o escolhido, com nome e região", () => {
    expect(lerLocal(JSON.stringify(ESCOLHIDO))).toEqual(ESCOLHIDO);
  });
});

describe("coordDe", () => {
  it("'não sei' não tem coordenada — quem chama decide o que fazer", () => {
    expect(coordDe(NAO_SEI)).toBeNull();
  });
  it("gps e escolhido têm", () => {
    expect(coordDe(GPS)).toEqual(GPS.coord);
    expect(coordDe(ESCOLHIDO)).toEqual(ESCOLHIDO.coord);
  });
});

describe("rotuloPilula: a pílula é o único lugar de onde a localização se mexe", () => {
  it("nunca perguntou: convida", () => {
    expect(rotuloPilula(NAO_SEI, "nunca")).toBe("Ver daqui");
  });

  // Negado uma vez, o navegador não pergunta de novo. Continuar oferecendo
  // "Ver daqui" seria um botão que não faz nada.
  it("negado: oferece o caminho manual, sem insistir no GPS", () => {
    expect(rotuloPilula(NAO_SEI, "negado")).toBe("escolher onde estou");
  });

  // O GPS não devolve nome de cidade. Inventar um seria inventar geografia.
  it("gps: diz 'daqui', sem nome de lugar", () => {
    expect(rotuloPilula(GPS, "nunca")).toBe("daqui · trocar");
  });

  it("escolhido: diz o nome que o serviço devolveu", () => {
    expect(rotuloPilula(ESCOLHIDO, "nunca")).toBe("de Gravatá · trocar");
  });

  // Já teve localização = já permitiu, ou escolheu na mão. O texto não pode
  // regredir pro convite só porque a flag de gps diz "negado".
  it("com localização, o estado do gps não muda o rótulo", () => {
    expect(rotuloPilula(ESCOLHIDO, "negado")).toBe("de Gravatá · trocar");
  });
});

describe("lerEstadoGps", () => {
  it("sem nada guardado é 'nunca'", () => {
    expect(lerEstadoGps(null)).toBe("nunca");
  });
  it("qualquer coisa que não seja 'negado' é 'nunca'", () => {
    expect(lerEstadoGps("talvez")).toBe("nunca");
  });
  it("'negado' se mantém", () => {
    expect(lerEstadoGps("negado")).toBe("negado");
  });
});

describe("a chave de armazenamento", () => {
  it("tem prefixo do app — o localStorage é compartilhado com todo o domínio", () => {
    expect(CHAVE_LOCAL.startsWith("bp.")).toBe(true);
  });
});
