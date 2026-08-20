import { describe, expect, it, vi } from "vitest";
import {
  DIST_MAX_KM,
  EXT_MAX_KM,
  SEM_FILTRO,
  contarLigados,
  lerFiltros,
  passaNoFiltro,
  type Filtros,
} from "@/lib/filtros";
import { getFichasComCondicao } from "@/lib/ficha";
import { distanciaKm } from "@/lib/geo";
import { PISOS, PISOS_FILTRAVEIS } from "@/lib/piso";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

// O haversine PULA os 30 km exatos (ver o comentário no bloco "distância"), e
// sem o valor exato o `>` e o `>=` são indistinguíveis. Este espião existe pra
// UM teste: ele DELEGA pro `distanciaKm` de verdade em todos os outros — a
// aritmética real continua sendo exercitada, inclusive pela auto-conferência do
// `aoNorte` — e só naquele um caso devolve 30 cravado, uma vez.
vi.mock("@/lib/geo", async (original) => {
  const real = await original<typeof import("@/lib/geo")>();
  return { ...real, distanciaKm: vi.fn(real.distanciaKm) };
});

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
  // O nome deste teste dizia "leitura com erro não é escondida", e prometia uma
  // proteção que não existe: quem torna o recorte inerte aqui é o `confia`, não
  // o `erro`. `passaNoFiltro` NUNCA lê `leitura.erro` — de propósito. A decisão
  // "dá pra confiar nestas leituras?" nasce inteira no `MioloHome`
  // (`src/app/MioloHome.tsx`, `algumErro` → `faseDe` → `confia`) e
  // chega aqui pronta; uma segunda regra nesta lib seria a segunda fonte que já
  // custou dois Criticals a este app. Então este caso é o irmão do de cima —
  // mesma cláusula, entrada mais parecida com a real (frio E com erro) — e o
  // nome agora diz isso.
  it("o inerte vale também quando a leitura veio com erro — pelo `confia`, não pelo `erro`", () => {
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
  // vitest — sem o `!== null`, `filtros.distanciaKm` continua `number | null`
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

  // ——— fix round: o teto inclusivo na DISTÂNCIA, o único pedaço da regra
  // cravada que a aritmética real não deixa provar. Com o espião devolvendo 30
  // cravado uma única vez, `>` passa (inclusivo, certo) e `>=` esconde a trilha
  // que a pessoa tinha em mente. É o mesmo ruling já provado na duração.
  it("o teto de distância é inclusivo — 'até 30 km' inclui os 30 km cravados", () => {
    vi.mocked(distanciaKm).mockReturnValueOnce(30);
    expect(passa({ distanciaKm: 30 }, {}, { voce: perto })).toBe(true);
    // O espião volta a delegar pro real na chamada seguinte: se o `mockReturnValueOnce`
    // vazasse, este 30 cravado continuaria valendo e o `longe` passaria também.
    expect(passa({ distanciaKm: 30 }, {}, { voce: longe })).toBe(false);
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

describe("piso da via", () => {
  // A escala inteira numa pergunta só, porque é ela que dá sentido ao recorte:
  // "no mínimo daqui pra cima". Com só dois pisos assertados, um `<` trocado
  // por `<=` passaria batido — e ele esconde justamente o piso PEDIDO, que é a
  // trilha que a pessoa tinha em mente quando ligou o filtro.
  it("pisoMinimo 'asfalto-esburacado': esconde barro e paralelepípedo, mostra esburacado e tapete", () => {
    expect(passa({ pisoMinimo: "asfalto-esburacado" }, { piso: "barro" })).toBe(false);
    expect(passa({ pisoMinimo: "asfalto-esburacado" }, { piso: "paralelepipedo" })).toBe(false);
    expect(passa({ pisoMinimo: "asfalto-esburacado" }, { piso: "asfalto-esburacado" })).toBe(true);
    expect(passa({ pisoMinimo: "asfalto-esburacado" }, { piso: "asfalto-tapete" })).toBe(true);
  });

  // REGRA DE HONESTIDADE 2. Vale pra ESCALA INTEIRA, inclusive `barro`, que o
  // `lerFiltros` recusa mas o tipo permite — se um dia ele chegar aqui por
  // outro caminho, continua não podendo esconder ficha sem o campo.
  it("ficha SEM piso passa com qualquer pisoMinimo ligado", () => {
    for (const p of PISOS) expect(passa({ pisoMinimo: p }, { piso: undefined })).toBe(true);
  });

  // ——— o guarda `filtros.pisoMinimo !== null`, e a prova dele é do `tsc`, não
  // do vitest: sem o guarda, `ordemPiso(null)` cai em `PISOS.indexOf(null)`,
  // que devolve -1, e `ordemPiso("barro") < -1` é `false` — a ficha passa do
  // mesmo jeito (MEDIDO em node). Quem recusa é o `tsc`: `ordemPiso` recebe
  // `Piso`, não `Piso | null` (lição 13). O caso fica pelo COMPORTAMENTO, que
  // é o estado normal de quem nunca abriu o painel.
  it("ficha COM piso preenchido não some quando o recorte está desligado", () => {
    expect(passa({}, { piso: "barro" })).toBe(true);
  });
});

describe("extensão da trilha", () => {
  // O teto é INCLUSIVO nos dois recortes de km — mesmo ruling já provado na
  // duração e na distância. "até 4 km" inclui a trilha de 4 km.
  it("extensão 4 com corte 4 PASSA; extensão 5 com corte 4 não", () => {
    expect(passa({ extensaoMaxKm: 4 }, { extensaoKm: 4 })).toBe(true);
    expect(passa({ extensaoMaxKm: 4 }, { extensaoKm: 5 })).toBe(false);
  });

  // REGRA DE HONESTIDADE 2, nos dois extremos do intervalo válido.
  it("ficha SEM extensaoKm passa com qualquer extensaoMaxKm ligado", () => {
    expect(passa({ extensaoMaxKm: 1 }, { extensaoKm: undefined })).toBe(true);
    expect(passa({ extensaoMaxKm: EXT_MAX_KM }, { extensaoKm: undefined })).toBe(true);
  });

  // ——— o guarda `filtros.extensaoMaxKm !== null`, e aqui o vitest MORDE
  // sozinho: sem ele, `12 > null` é `12 > 0` — `true` por coerção (medido) — e
  // toda ficha com extensão preenchida sumiria da home com o filtro DESLIGADO.
  it("ficha COM extensaoKm preenchida não some quando o recorte está desligado", () => {
    expect(passa({}, { extensaoKm: 12 })).toBe(true);
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

  // ——— pré-voo 2: o teste acima liga 3 dos recortes, então os outros podem ser
  // APAGADOS do array e ele continua devolvendo 3. A linha de resumo diria "3
  // filtros ligados" com sete ligados, e a pessoa que não achasse mais nada na
  // tela procuraria quatro filtros que a contagem jura não existirem. Com os
  // sete ligados, apagar QUALQUER um dá 6.
  //
  // 🔴 SETE, não cinco: durante a EXPANSÃO o `Filtros` carrega os dois velhos
  // (`esforco`, `duracaoMax`) junto dos novos, e eles ainda recortam de
  // verdade. Vira cinco só na Task 8, quando eles saírem.
  //
  // O objeto é escrito por INTEIRO, sem espalhar `SEM_FILTRO`: espalhando, um
  // campo novo que ninguém ligasse entraria como `null` e o teste continuaria
  // dando 7 sem exercitá-lo. Escrito à mão, o `tsc` cobra o campo novo.
  it("contarLigados conta os SETE recortes, não só os três primeiros", () => {
    expect(
      contarLigados({
        distanciaKm: 30,
        daHoje: true,
        soGratis: true,
        extensaoMaxKm: 8,
        pisoMinimo: "asfalto-esburacado",
        esforco: "leve",
        duracaoMax: 120,
      }),
    ).toBe(7);
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
  //
  // 🔴 SETE durante a expansão (vira cinco na Task 8). Sem estender ESTE
  // teste, os dois campos novos ficariam sem nenhuma prova de que sobrevivem
  // ao `lerFiltros` — e o filtro que a pessoa ligou não voltaria depois de
  // fechar o app, que é a reclamação "ele esquece".
  it("preserva os SETE campos válidos, não só dois", () => {
    const cheio: Filtros = {
      distanciaKm: 60,
      daHoje: true,
      soGratis: true,
      extensaoMaxKm: 8,
      pisoMinimo: "asfalto-esburacado",
      esforco: "media",
      duracaoMax: 240,
    };
    expect(lerFiltros(JSON.stringify(cheio))).toEqual(cheio);
  });

  // (b) A validação também é campo a campo, e o teste era em bloco. Um caso
  // por campo: assim a falha DIZ qual validação caiu, em vez de um objeto
  // inteiro diferente. `soGratis: "sim"` é o caso realista — JSON de uma
  // versão futura, ou mexido na mão pelo inspetor do navegador.
  //
  // ⚠️ O caso do `distanciaKm` era `45` e PRECISOU mudar: com o conjunto
  // `{30,60}` virando o intervalo `[1,100]`, 45 passou a ser um valor VÁLIDO —
  // o teste continuaria verde só enquanto a linha nova estivesse errada. Trocado
  // por `999`, que é torto nos dois mundos.
  it.each([
    ["distanciaKm", { distanciaKm: 999 }],
    ["daHoje", { daHoje: "sim" }],
    ["soGratis", { soGratis: "sim" }],
    ["extensaoMaxKm", { extensaoMaxKm: 999 }],
    ["pisoMinimo", { pisoMinimo: "cascalho" }],
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

// Os dois recortes de km deixaram de ser "está no conjunto?" e viraram
// intervalo. Cada caso erra em UMA coisa só: num E de quatro sub-cláusulas, a
// que dispara primeiro esconde as outras (lição 2).
describe("lerFiltros: os intervalos de km", () => {
  const so = (campo: string, v: unknown) => lerFiltros(JSON.stringify({ [campo]: v }));

  it("distanciaKm 0 → null", () => {
    expect(so("distanciaKm", 0).distanciaKm).toBe(null);
  });
  it("distanciaKm 101 (acima do teto) → null", () => {
    expect(so("distanciaKm", DIST_MAX_KM + 1).distanciaKm).toBe(null);
  });
  // O teto cravado, dos dois lados, e ele é o que pega CONSTANTE TROCADA: com
  // `EXT_MAX_KM` no lugar do `DIST_MAX_KM`, este 100 viraria `null` e a pessoa
  // veria o filtro que ela acabou de ligar sumir na abertura seguinte.
  it("distanciaKm 100 (o teto cravado) → 100", () => {
    expect(so("distanciaKm", DIST_MAX_KM).distanciaKm).toBe(DIST_MAX_KM);
  });
  it("distanciaKm '30' (texto) → null", () => {
    expect(so("distanciaKm", "30").distanciaKm).toBe(null);
  });
  it("distanciaKm 7.5 (fracionário) → null", () => {
    expect(so("distanciaKm", 7.5).distanciaKm).toBe(null);
  });
  // Decisão do plano: `passo` é da UI (granularidade da barra), não do valor. O
  // campo digitável aceita 7, então o que foi guardado tem que voltar.
  it("distanciaKm 7 (fora do passo, dentro do intervalo) → 7", () => {
    expect(so("distanciaKm", 7).distanciaKm).toBe(7);
  });
  // 🔴 O piso é 1, NÃO `DIST_PASSO_KM`. Este é o teste que morde a troca: com o
  // piso em 5, um `4` digitado seria aceito pela tela, guardado no
  // `localStorage`, e voltaria `null` na abertura seguinte — o filtro se
  // desligando sozinho entre uma abertura e outra, sem nada na tela dizendo
  // por quê. Sem ESTE caso, nenhum teste da suíte distingue os dois pisos: o
  // `distanciaKm 0 → null` passa com `>= 5` do mesmo jeito.
  it("distanciaKm 4 (abaixo do passo da barra, digitado à mão) → 4", () => {
    expect(so("distanciaKm", 4).distanciaKm).toBe(4);
  });
  // `1e999` é JSON VÁLIDO e vira `Infinity` no parse (medido) — o único
  // não-finito que chega até aqui.
  it("distanciaKm 1e999 (vira Infinity no JSON.parse) → null", () => {
    expect(JSON.parse('{"d":1e999}').d).toBe(Infinity);
    expect(lerFiltros('{"distanciaKm":1e999}').distanciaKm).toBe(null);
  });
  // `typeof NaN === "number"` é a armadilha que quase furou a Task 5 da rodada
  // passada. Aqui ela NÃO É ALCANÇÁVEL, e isto é medido, não deduzido: o filtro
  // só chega por `localStorage`, sempre como JSON. Este teste trava as duas
  // medições e o caso REAL que sobra — o `null` que o `stringify` produz.
  it("NaN não chega no lerFiltros: o JSON o converte em null na saída e recusa o literal na volta", () => {
    expect(JSON.stringify({ distanciaKm: NaN })).toBe('{"distanciaKm":null}');
    expect(() => JSON.parse('{"distanciaKm":NaN}')).toThrow();
    expect(lerFiltros('{"distanciaKm":null}').distanciaKm).toBe(null);
  });

  it("extensaoMaxKm 0 → null", () => {
    expect(so("extensaoMaxKm", 0).extensaoMaxKm).toBe(null);
  });
  // O piso, do lado de cá: 1 km é o menor recorte que faz sentido pedir, e ele
  // tem que sobreviver. (`EXT_PASSO_KM` é 1, então aqui os dois pisos
  // coincidem — quem separa os conceitos é o caso do `4` na distância.)
  it("extensaoMaxKm 1 (o piso cravado) → 1", () => {
    expect(so("extensaoMaxKm", 1).extensaoMaxKm).toBe(1);
  });
  // O par que pega o teto ERRADO na extensão: com `DIST_MAX_KM` aqui, 21
  // passaria — e a barra da tela, que vai até 20, nunca conseguiria desligar
  // um filtro cortando em 21.
  it("extensaoMaxKm 21 (acima do teto de 20) → null", () => {
    expect(so("extensaoMaxKm", EXT_MAX_KM + 1).extensaoMaxKm).toBe(null);
  });
  it("extensaoMaxKm 20 (o teto cravado) → 20", () => {
    expect(so("extensaoMaxKm", EXT_MAX_KM).extensaoMaxKm).toBe(EXT_MAX_KM);
  });
  it("extensaoMaxKm 3.5 (fracionário) → null", () => {
    expect(so("extensaoMaxKm", 3.5).extensaoMaxKm).toBe(null);
  });

  // O celular dele tem `bp.filtros` gravado de verdade, e ali `distanciaKm` só
  // podia ser 30 ou 60. Os dois têm que continuar de pé no intervalo novo —
  // senão a rodada desliga, sozinha, o filtro que ele deixou ligado.
  it("os valores guardados 30 e 60 da versão velha continuam válidos no intervalo novo", () => {
    expect(so("distanciaKm", 30).distanciaKm).toBe(30);
    expect(so("distanciaKm", 60).distanciaKm).toBe(60);
  });
});

describe("lerFiltros: pisoMinimo", () => {
  it("pisoMinimo 'terra' → null", () => {
    expect(lerFiltros(JSON.stringify({ pisoMinimo: "terra" })).pisoMinimo).toBe(null);
  });
  // 🔴 `barro` é o PIOR piso da escala: aceso, ele não esconde uma ficha
  // sequer — e o painel não desenha chip de barro, então a linha diria "1
  // filtro ligado" com a lista idêntica e NENHUM controle na tela capaz de
  // desligá-lo. Por isso a validação olha `PISOS_FILTRAVEIS`, não `PISOS`.
  it("pisoMinimo 'barro' → null — é o piso da escala: aceso, contaria como filtro sem chip pra desligar", () => {
    expect(lerFiltros(JSON.stringify({ pisoMinimo: "barro" })).pisoMinimo).toBe(null);
  });
  it("cada piso filtrável sobrevive à releitura, um a um", () => {
    for (const p of PISOS_FILTRAVEIS) {
      expect(lerFiltros(JSON.stringify({ pisoMinimo: p })).pisoMinimo).toBe(p);
    }
  });
});

// O celular dele abre com o `bp.filtros` da versão ANTERIOR gravado. Nesta
// fase — expansão — `esforco` e `duracaoMax` continuam sendo lidos e continuam
// recortando: um filtro velho FILTRA SIM, e é isso que tem que acontecer até a
// Task 8. O que este teste trava é que ele não estoura e que os campos novos,
// ausentes no JSON velho, chegam como `null` em vez de `undefined`.
describe("lerFiltros: o que já está gravado no celular dele", () => {
  const VELHO = JSON.stringify({ duracaoMax: 120, esforco: "media", distanciaKm: 60 });

  it("filtro guardado da versão VELHA não estoura, e os campos novos vêm null", () => {
    expect(() => lerFiltros(VELHO)).not.toThrow();
    expect(lerFiltros(VELHO)).toEqual({
      ...SEM_FILTRO,
      duracaoMax: 120,
      esforco: "media",
      distanciaKm: 60,
    });
    expect(lerFiltros(VELHO).extensaoMaxKm).toBe(null);
    expect(lerFiltros(VELHO).pisoMinimo).toBe(null);
  });
});
