import { describe, expect, it } from "vitest";
import { SEM_FILTRO, contarLigados, lerFiltros, passaNoFiltro, type Filtros } from "@/lib/filtros";
import { getFichasComCondicao } from "@/lib/ficha";
import { distanciaKm } from "@/lib/geo";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

const base = getFichasComCondicao()[0];
const RAMPA = base.condicao.coords;
const FRESCO: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: 1_800_000_000 };
const FRIO: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: 1_800_000_000 };

function passa(f: Partial<Filtros>, over: Partial<Ficha> = {}, extra: Partial<{
  leitura: LeituraCarimbo; voce: { lat: number; lng: number } | null; confia: boolean;
}> = {}) {
  return passaNoFiltro({
    ficha: { ...base, ...over },
    leitura: extra.leitura ?? FRESCO,
    filtros: { ...SEM_FILTRO, ...f },
    voce: extra.voce ?? null,
    confia: extra.confia ?? true,
  });
}

describe("sem filtro, tudo passa", () => {
  it("nenhuma trilha some da tela por acidente", () => {
    expect(passa({})).toBe(true);
    expect(passa({}, {}, { leitura: FRIO })).toBe(true);
  });
  it("contarLigados é zero", () => {
    expect(contarLigados(SEM_FILTRO)).toBe(0);
  });

  // ——— pré-voo 2: o "sem filtro, tudo passa" acima é CEGO pros três guardas
  // `!== null`, porque a ficha base é a Rampa — paga, e sem esforço nem duração
  // preenchidos. Cada `if` daqui é um E de duas sub-cláusulas, e a que dispara
  // primeiro esconde a outra:
  //
  //   `filtros.esforco !== null && ficha.esforco && ...`
  //
  // Apagando o `filtros.esforco !== null`, a ficha base salva o teste sozinha
  // (`ficha.esforco` é undefined, curto-circuito, passa). Só uma ficha COM o
  // campo preenchido e NENHUM filtro ligado faz o guarda ser o único a segurar.
  // Isso vira caso real no dia em que o João responder o questionário.
  it("ficha COM esforço preenchido não some quando o filtro está desligado", () => {
    expect(passa({}, { esforco: "puxada" })).toBe(true);
  });
  it("ficha COM duração preenchida não some quando o filtro está desligado", () => {
    expect(passa({}, { duracao: 90 })).toBe(true);
  });
});

describe('"dá hoje"', () => {
  it("esconde o que o motor mediu como não-vai", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRIO })).toBe(false);
  });
  it("mantém o que dá", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRESCO })).toBe(true);
  });

  // REGRA DE HONESTIDADE 1. Quando a folha não confia nas leituras, o filtro
  // fica INERTE: esconder o que não se sabe é o app fingindo que sabe, e
  // contradiz "sem leitura o app INFORMA, não manda".
  it("sem leitura confiável, não esconde nada", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRIO, confia: false })).toBe(true);
  });
  it("leitura com erro não é escondida", () => {
    expect(passa({ daHoje: true }, {}, { leitura: { ...FRIO, erro: true }, confia: false })).toBe(true);
  });

  // ——— pré-voo 2: honestidade ao contrário. Hoje só se prova que `confia:
  // false` torna o `daHoje` INERTE. Um `if (!confia) return true` no topo
  // passaria em todos os testes acima e desligaria o app inteiro: a pessoa
  // filtraria por distância, por custo, e nada aconteceria — sem nenhum aviso
  // de que o filtro não está valendo. `confia` é sobre o CARIMBO, e não pode
  // vazar pros recortes que não dependem dele.
  it("sem leitura confiável, os OUTROS recortes continuam valendo", () => {
    expect(
      passa({ soGratis: true }, { custo: { tag: "pago", valor: "R$ 5" } }, { confia: false }),
    ).toBe(false);
    expect(passa({ esforco: "leve" }, { esforco: "puxada" }, { confia: false })).toBe(false);
  });
});

describe("distância", () => {
  const perto = { lat: RAMPA.lat + 0.05, lng: RAMPA.lng };      // ~5 km
  const longe = { lat: RAMPA.lat + 1.2, lng: RAMPA.lng };       // ~130 km

  it("dentro do limite passa", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: perto })).toBe(true);
  });
  it("fora do limite não passa", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: longe })).toBe(false);
  });
  // Sem localização o recorte nem aparece na tela; se chegar aqui ligado
  // (estado guardado de outra sessão), não pode esconder nada.
  it("sem localização, não filtra", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: null })).toBe(true);
  });

  // ——— pré-voo 2. Todos os testes de "tudo passa" acima rodam com `voce:
  // null`, então o E do `if` de distância nunca foi exercitado com a
  // localização presente e o recorte desligado — que é o estado NORMAL de
  // quem tocou "Ver daqui" e não abriu o painel.
  //
  // Honestidade sobre a prova: quem mata a mutação aqui é o `tsc`, não o
  // vitest — sem o `!== null`, `filtros.distanciaKm` continua `30 | 60 | null`
  // dentro do `if` e a comparação não compila (lição 13 do RESUME: rodar
  // `tsc --noEmit` antes de declarar uma linha morta). O teste vale pelo
  // CASO, que hoje não existe na suíte, não por ser a única rede.
  it("com localização e o recorte desligado, nada some", () => {
    expect(passa({}, {}, { voce: perto })).toBe(true);
    expect(passa({}, {}, { voce: longe })).toBe(true);
  });

  // ——— pré-voo 2: A BORDA DA DISTÂNCIA, e o que dela é honestamente provável.
  //
  // A regra cravada diz que o teto é inclusivo nos DOIS recortes. Na duração
  // isso é observável e está provado abaixo (120 é inteiro e a pessoa acerta
  // ele). Na distância, NÃO É: medi antes de escrever este teste, e o
  // haversine com estas coordenadas pula o valor exato — o passo de saída
  // perto de 30 km é ~1e-13, e os vizinhos são 29.999999999999968 e
  // 30.000000000000068. Não existe coordenada que devolva 30 cravado, então
  // `>` e `>=` são indistinguíveis aqui, na suíte e na vida.
  //
  // O que É provável, e é o que este teste faz: que o corte acontece NO
  // limite pedido, e não num número parecido (km trocado por metro, degrau
  // trocado, constante errada).
  const aoNorte = (km: number) => ({
    lat: RAMPA.lat + (km / 6371) * (180 / Math.PI),
    lng: RAMPA.lng,
  });

  it("o corte acontece no limite pedido, por um triz dos dois lados", () => {
    // A construção é conferida antes de valer como prova: com dLng = 0 o
    // haversine vira R·Δφ. Se `geo.ts` mudar de fórmula, esta linha falha
    // alto em vez de o teste abaixo virar vazio.
    expect(distanciaKm(aoNorte(29.999), RAMPA)).toBeCloseTo(29.999, 6);
    expect(distanciaKm(aoNorte(30.001), RAMPA)).toBeCloseTo(30.001, 6);

    expect(passa({ distanciaKm: 30 }, {}, { voce: aoNorte(29.999) })).toBe(true);
    expect(passa({ distanciaKm: 30 }, {}, { voce: aoNorte(30.001) })).toBe(false);
    expect(passa({ distanciaKm: 60 }, {}, { voce: aoNorte(59.999) })).toBe(true);
    expect(passa({ distanciaKm: 60 }, {}, { voce: aoNorte(60.001) })).toBe(false);
  });
});

describe("custo", () => {
  it("só grátis esconde a paga", () => {
    expect(passa({ soGratis: true }, { custo: { tag: "pago", valor: "R$ 5" } })).toBe(false);
  });
  it("só grátis mantém a grátis", () => {
    expect(passa({ soGratis: true }, { custo: { tag: "gratis" } })).toBe(true);
  });
});

describe("esforço e duração", () => {
  it("esforço igual passa, diferente não", () => {
    expect(passa({ esforco: "leve" }, { esforco: "leve" })).toBe(true);
    expect(passa({ esforco: "leve" }, { esforco: "puxada" })).toBe(false);
  });
  it("duração dentro do teto passa", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: 90 })).toBe(true);
    expect(passa({ duracaoMax: 120 }, { duracao: 300 })).toBe(false);
  });

  // ——— pré-voo: A BORDA, que este brief não especificava.
  //
  // "até 2h" com uma trilha de exatamente 120min: passa ou não? Eu tinha dado
  // só 90 e 300 — dois implementadores razoáveis decidiriam diferente, e a
  // pessoa que ligou "até 2h" veria a trilha de 2h sumir sem entender.
  // **A REGRA, cravada: o teto é INCLUSIVO nos dois recortes.** "até 2h"
  // inclui 2h; "até 30 km" inclui 30 km. É como se lê em português, e o
  // contrário esconde justamente o caso que a pessoa tinha em mente.
  it("o teto de duração é inclusivo — 'até 2h' inclui a trilha de 2h", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: 120 })).toBe(true);
    expect(passa({ duracaoMax: 120 }, { duracao: 121 })).toBe(false);
  });

  // Os outros dois degraus existem e nenhum teste os exercitava — só 120.
  it("o degrau de 240 também recorta", () => {
    expect(passa({ duracaoMax: 240 }, { duracao: 200 })).toBe(true);
    expect(passa({ duracaoMax: 240 }, { duracao: 260 })).toBe(false);
  });

  // As três palavras de esforço, uma a uma: com só "leve"/"puxada" testados,
  // um `===` trocado por comparação parcial passaria batido em "media".
  it("cada esforço recorta o seu, e só o seu", () => {
    for (const e of ["leve", "media", "puxada"] as const) {
      expect(passa({ esforco: e }, { esforco: e })).toBe(true);
      for (const outro of ["leve", "media", "puxada"] as const) {
        if (outro !== e) expect(passa({ esforco: e }, { esforco: outro })).toBe(false);
      }
    }
  });

  // REGRA DE HONESTIDADE 2. Sumir por dado que falta é mentira silenciosa —
  // e hoje TODAS as fichas estão nesse caso.
  it("ficha sem esforço nunca é escondida pelo filtro de esforço", () => {
    expect(passa({ esforco: "leve" }, { esforco: undefined })).toBe(true);
  });
  it("ficha sem duração nunca é escondida pelo filtro de duração", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: undefined })).toBe(true);
  });
});

describe("filtros combinados", () => {
  it("todos têm que passar, não basta um", () => {
    expect(
      passa({ soGratis: true, daHoje: true }, { custo: { tag: "gratis" } }, { leitura: FRIO }),
    ).toBe(false);
  });
  it("contarLigados conta cada recorte ligado uma vez", () => {
    expect(contarLigados({ ...SEM_FILTRO, daHoje: true, soGratis: true, distanciaKm: 30 })).toBe(3);
  });

  // ——— pré-voo 2: o teste acima liga 3 dos 5 recortes, então `esforco` e
  // `duracaoMax` podem ser APAGADOS do array e ele continua devolvendo 3. A
  // linha de resumo diria "3 filtros ligados" com cinco ligados, e a pessoa
  // que não achasse mais nada na tela procuraria dois filtros que a contagem
  // jura não existirem. Com os cinco ligados, apagar qualquer um dá 4.
  it("contarLigados conta os CINCO recortes, não só os três primeiros", () => {
    expect(
      contarLigados({
        distanciaKm: 30,
        daHoje: true,
        soGratis: true,
        esforco: "leve",
        duracaoMax: 120,
      }),
    ).toBe(5);
  });
});

describe("lerFiltros: o que estiver guardado é conferido", () => {
  it("nada guardado é SEM_FILTRO", () => {
    expect(lerFiltros(null)).toEqual(SEM_FILTRO);
  });
  it("texto torto é SEM_FILTRO", () => {
    expect(lerFiltros("{{{")).toEqual(SEM_FILTRO);
  });
  // Um valor fora do conjunto viraria um filtro que esconde tudo pra sempre,
  // e a pessoa não teria como desligar o que não sabe que ligou.
  it("valor fora do conjunto cai pro padrão daquele recorte", () => {
    expect(lerFiltros(JSON.stringify({ distanciaKm: 999, esforco: "brutal" }))).toEqual(SEM_FILTRO);
  });
  it("preserva o que é válido", () => {
    expect(lerFiltros(JSON.stringify({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 })))
      .toEqual({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 });
  });

  // ——— pré-voo 2, quatro furos neste bloco.
  //
  // (a) O "preserva o que é válido" acima só exercita DOIS dos cinco campos.
  // Trocar a linha do `esforco` por `esforco: null` fixo passa em tudo o que
  // existe hoje — o filtro nunca mais voltaria depois de fechar o app, e a
  // pessoa reclamaria que "ele esquece".
  it("preserva os CINCO campos válidos, não só dois", () => {
    const cheio: Filtros = {
      distanciaKm: 60,
      daHoje: true,
      soGratis: true,
      esforco: "media",
      duracaoMax: 240,
    };
    expect(lerFiltros(JSON.stringify(cheio))).toEqual(cheio);
  });

  // (b) A validação também é campo a campo, e o teste era em bloco. Um caso
  // por campo: assim a falha DIZ qual validação caiu, em vez de um objeto
  // inteiro diferente. `soGratis: "sim"` é o caso realista — JSON de uma
  // versão futura, ou mexido na mão pelo inspetor do navegador.
  it.each([
    ["distanciaKm", { distanciaKm: 45 }],
    ["daHoje", { daHoje: "sim" }],
    ["soGratis", { soGratis: "sim" }],
    ["esforco", { esforco: "brutal" }],
    ["duracaoMax", { duracaoMax: 999 }],
  ])("campo %s fora do conjunto cai pro padrão DELE, sozinho", (_campo, torto) => {
    expect(lerFiltros(JSON.stringify(torto))).toEqual(SEM_FILTRO);
  });

  // (c) e (d) O guarda `typeof x !== "object" || x === null` é um OU de duas
  // sub-cláusulas, e elas NÃO fazem a mesma coisa — a família que já mordeu
  // duas vezes nesta rodada. Um caso pra cada, falhando por uma razão só:
  //
  //   "null"  → JSON.parse devolve null; `typeof null === "object"`, então
  //             quem segura é o `x === null`. Sem ele, `x.distanciaKm`
  //             ESTOURA e a home não abre.
  //   "5"     → JSON.parse devolve número; quem segura é o `typeof`. Sem ele
  //             não estoura (as leituras dão undefined), então esta metade
  //             pode parecer morta no vitest — **rode `tsc --noEmit` antes de
  //             declarar isso**, porque é ela que estreita `unknown` pra
  //             objeto (lição 13).
  it("JSON válido que não é objeto: null vira SEM_FILTRO em vez de estourar", () => {
    expect(() => lerFiltros("null")).not.toThrow();
    expect(lerFiltros("null")).toEqual(SEM_FILTRO);
  });
  it("JSON válido que não é objeto: número vira SEM_FILTRO", () => {
    expect(lerFiltros("5")).toEqual(SEM_FILTRO);
  });
});
