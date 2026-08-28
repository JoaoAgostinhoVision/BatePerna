import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DIST_PASSO_KM,
  DIST_TETO_MINIMO_KM,
  SEM_FILTRO,
  contarLigados,
  lerFiltros,
  passaNoFiltro,
  tetoDaBarraDistancia,
  type Filtros,
} from "@/lib/filtros";
import { getFichasComCondicao } from "@/lib/ficha";
import { distanciaKm, kmNaTelaDistancia } from "@/lib/geo";
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

  // ——— O pré-voo 2 desta rodada escreveu aqui uma nota longa sobre o guarda
  // `filtros.pisoMinimo !== null` e o curto-circuito que o escondia. Ela saiu
  // com o recorte, em 2026-08-27. O que sobrevive dela é a régua, e ela vale
  // pro próximo recorte que chegar: num `E` de duas sub-cláusulas, a que
  // dispara primeiro ESCONDE a outra — só um caso que passe pela primeira faz
  // a segunda ser a única a segurar.
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
    // 🔴 O segundo recorte aqui já foi `extensaoMaxKm` (fora do modelo na Task
    // 7) e depois `pisoMinimo` (fora da tela em 2026-08-27). Hoje o par é o
    // `distanciaKm`, que é o outro recorte independente do carimbo.
    expect(
      passa({ distanciaKm: 1 }, {}, { confia: false, voce: { lat: 0, lng: 0 } }),
    ).toBe(false);
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

  // ——— pré-voo 2: A BORDA DA DISTÂNCIA. Que o corte acontece NO limite pedido,
  // e não num número parecido (km trocado por metro, degrau trocado, constante
  // errada).
  //
  // 🔴 A BORDA MUDOU DE LUGAR nesta rodada, e a razão é a decisão do dono do
  // app — **o filtro segue a tela**. O que o recorte compara agora é o número
  // ARREDONDADO, o mesmo que o cartão está mostrando (`kmNaTelaDistancia`, em
  // `src/lib/geo.ts`). De 10 km pra cima a tela mostra INTEIRO, então "até 30
  // km" corta onde a tela deixa de dizer "~30": em 30,45 km, e não em 30,000.
  //
  // O comentário antigo daqui dizia que `>` e `>=` eram indistinguíveis na
  // distância porque o haversine pula o 30 cravado. Isso ERA verdade e deixou
  // de ser: o valor comparado hoje é o inteiro da tela, e ele acerta o 30 com
  // folga — qualquer km em [29,5; 30,45) vira 30. Por isso o par 30,44/30,46
  // abaixo mata o `>=` sozinho, sem espião nenhum.
  const aoNorte = (km: number) => ({
    lat: RAMPA.lat + (km / 6371) * (180 / Math.PI),
    lng: RAMPA.lng,
  });

  it("o corte acontece onde a TELA muda de número, por um triz dos dois lados", () => {
    // A construção é conferida antes de valer como prova: com dLng = 0 o
    // haversine vira R·Δφ. Se `geo.ts` mudar de fórmula, esta linha falha
    // alto em vez de o teste abaixo virar vazio.
    expect(distanciaKm(aoNorte(30.44), RAMPA)).toBeCloseTo(30.44, 6);
    expect(distanciaKm(aoNorte(30.46), RAMPA)).toBeCloseTo(30.46, 6);

    // 30,44 → a tela diz "~30 km"; 30,46 → a tela diz "~31 km". O corte é ali.
    expect(passa({ distanciaKm: 30 }, {}, { voce: aoNorte(30.44) })).toBe(true);
    expect(passa({ distanciaKm: 30 }, {}, { voce: aoNorte(30.46) })).toBe(false);
    expect(passa({ distanciaKm: 60 }, {}, { voce: aoNorte(60.44) })).toBe(true);
    expect(passa({ distanciaKm: 60 }, {}, { voce: aoNorte(60.46) })).toBe(false);
  });

  // 🔴 O DEFEITO, no valor exato em que a revisão da branch inteira o mediu — e
  // este estava EM PRODUÇÃO, não só na branch. Com "até 10 km" ligado, uma
  // trilha a 10,4495 km sumia da home enquanto o cartão dela anunciava "~10 km
  // em linha reta": o filtro escondendo por um número que a pessoa não tinha
  // como ver na tela. A faixa é de ~450 m no teto de 10 (abaixo de 10 km a tela
  // mostra uma casa e ela cai pra ~50 m).
  //
  // Este é um caso que SEPARA as duas versões: com o km cru, `10.4495 > 10` e a
  // trilha some; com o número da tela, `10 > 10` é falso e ela fica.
  it("'até 10 km' NÃO esconde a trilha que o cartão anuncia como ~10 km (10,4495)", () => {
    expect(distanciaKm(aoNorte(10.4495), RAMPA)).toBeCloseTo(10.4495, 6);
    expect(passa({ distanciaKm: 10 }, {}, { voce: aoNorte(10.4495) })).toBe(true);
    // O irmão que ainda esconde, pra isto não virar "o recorte de 10 não filtra
    // mais nada": em 10,46 a tela já diz "~11 km", e aí sumir é honesto.
    expect(passa({ distanciaKm: 10 }, {}, { voce: aoNorte(10.46) })).toBe(false);
  });

  // 🔴 O RAMO. `kmNaTelaDistancia` muda de forma no meio da escala: uma casa
  // decimal abaixo de 10, INTEIRO de 10 pra cima. Sem um caso de cada lado, o
  // recorte podia herdar o ramo errado sem nada cair — e aí "até 9 km"
  // esconderia (ou mostraria) uma trilha por um arredondamento que a tela não
  // faz. 9,44 é o par exato do 30,44 de cima, do outro lado da fronteira: lá
  // ele passa (30 inteiro), aqui ele NÃO passa, porque a tela diz "~9,4 km" e
  // 9,4 > 9.
  it("abaixo de 10 km o corte é o da tela de UMA CASA, não o do inteiro", () => {
    expect(passa({ distanciaKm: 9 }, {}, { voce: aoNorte(9.44) })).toBe(false);
    // E o que a tela mostra como "~9,0 km" fica: 8,96 arredonda pra 9,0.
    expect(passa({ distanciaKm: 9 }, {}, { voce: aoNorte(8.96) })).toBe(true);
  });

  // "Menos de 1 km": a tela NÃO mostra número nenhum ("menos de 1 km em linha
  // reta"), e `kmNaTelaDistancia` devolve `null` justamente por isso. O que a
  // tela não mostrou não pode esconder — então a trilha ao lado passa em
  // QUALQUER recorte, inclusive no menor que o app deixa guardar (1 km).
  //
  // ⚠️ HONESTIDADE SOBRE ESTA PROVA: ela NÃO separa o `null` das alternativas
  // razoáveis, e isso foi medido. Devolver o km cru (0,4) ou devolver 1 dá o
  // MESMO resultado aqui, porque `lerFiltros` só guarda teto inteiro ≥ 1 e a
  // `FaixaKm` só deixa digitar ≥ 1: nenhum teto alcançável separa as três
  // versões. Quem separa é o teste de unidade em tests/lib/geo.test.ts, que
  // olha o valor devolvido. Este aqui trava o COMPORTAMENTO — e o domínio: se
  // um dia o teto puder ser fracionário, ele é quem grita.
  it("a trilha a menos de 1 km não some nem no menor recorte guardável", () => {
    expect(passa({ distanciaKm: 1 }, {}, { voce: aoNorte(0.4) })).toBe(true);
    expect(passa({ distanciaKm: 5 }, {}, { voce: aoNorte(0.4) })).toBe(true);
  });

  // ——— fix round: o teto inclusivo na DISTÂNCIA, com o km CRU cravado em 30
  // pelo espião. Ele nasceu quando este era o único jeito de acertar o valor
  // exato; depois da mudança de rodada não é mais — o par 30,44/30,46 lá em
  // cima já mata o `>=` sozinho, e foi medido. Fica como cinto e como o único
  // caso da suíte em que o km cru e o número da tela COINCIDEM, que é o estado
  // em que as duas versões do filtro concordam.
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

// 🔴 O describe "piso da via" morreu aqui (2026-08-27), e com ele os TRÊS
// testes que provavam o recorte "no mínimo daqui pra cima": a escala inteira,
// a REGRA DE HONESTIDADE 2 aplicada ao piso, e o guarda do recorte desligado.
// O recorte saiu da tela porque respondia a pergunta errada — quem filtra
// quer saber se o carro chega, e o piso era um proxy que errava. Sem o
// recorte, não sobra comportamento pra provar; não há substituto porque o
// chip do carro NÃO entrou no lugar (as duas fichas respondem "sim", e um chip
// que não filtra é o defeito que o `barro` já tinha ensinado).
// A REGRA DE HONESTIDADE 2 continua provada — no bloco do `carroComum` em
// tests/lib/ficha.test.ts, que é onde o campo mora agora.

// 🔴 O describe "extensão da trilha" morreu aqui (Task 7, 2026-08-23): o
// campo `extensaoKm` saiu do modelo, `extensaoMaxKm` saiu de `Filtros`, e
// `passaNoFiltro` não tem mais o bloco que os comparava. Os SEIS testes que
// viviam aqui (contados no commit anterior a esta contração, por
// `ancestorTitles`) provavam exatamente esse recorte — sem ele, não sobra o
// que provar; não há substituto porque não há mais comportamento.

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
  // filtros ligados" com quatro ligados, e a pessoa que não achasse mais nada
  // na tela procuraria um filtro que a contagem jura não existir. Com os
  // quatro ligados, apagar QUALQUER um dá 3.
  //
  // 🔴 QUATRO, e a contagem não se ajusta: eram CINCO até esta rodada, com
  // `extensaoMaxKm` no `Filtros`; a contração desta task (Task 7) apagou o
  // campo. Se este número não bater com o painel um dia, descubra por quê
  // antes de mexer nele.
  //
  // Este é também o IRMÃO DE PRESENÇA do `contarLigados(lerFiltros(velho))
  // === 1` mais abaixo: sem ele, um `contarLigados` que devolvesse `1` sempre
  // deixaria aquele teste de ausência verde.
  //
  // O objeto é escrito por INTEIRO, sem espalhar `SEM_FILTRO`: espalhando, um
  // campo novo que ninguém ligasse entraria como `null` e o teste continuaria
  // dando 4 sem exercitá-lo. Escrito à mão, o `tsc` cobra o campo novo.
  it("contarLigados conta os TRÊS campos que sobraram", () => {
    expect(contarLigados({
      distanciaKm: 30, daHoje: true, soGratis: true,
    })).toBe(3);
    expect(contarLigados(SEM_FILTRO)).toBe(0);
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
  //
  // 🔴 NÃO EXISTE MAIS RECORTE DE CONJUNTO FECHADO. `distanciaKm` saiu deste
  // caso na rodada de 2026-08-23 (sem teto, `999` é VÁLIDO); a extensão saiu do
  // modelo na Task 7; e o piso — o último enum — saiu da tela em 2026-08-27.
  // O que sobra são dois booleanos, e "fora do conjunto" pra booleano é
  // qualquer coisa que não seja `true`.
  it("valor fora do conjunto cai pro padrão daquele recorte", () => {
    expect(lerFiltros(JSON.stringify({ daHoje: "sim", soGratis: 1 })))
      .toEqual(SEM_FILTRO);
  });
  it("preserva o que é válido", () => {
    expect(lerFiltros(JSON.stringify({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 })))
      .toEqual({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 });
  });

  // ——— pré-voo 2, quatro furos neste bloco.
  //
  // (a) O "preserva o que é válido" acima só exercita DOIS dos quatro campos.
  // Trocar a linha do `pisoMinimo` por `pisoMinimo: null` fixo passa em tudo o
  // que existe lá em cima — o filtro nunca mais voltaria depois de fechar o
  // app, e a pessoa reclamaria que "ele esquece".
  //
  // 🔴 QUATRO: eram cinco até esta rodada, com `extensaoMaxKm` no `Filtros`; a
  // contração desta task (Task 7) apagou o campo. O tipo `Filtros` é escrito
  // de propósito, sem espalhar `SEM_FILTRO`, pra o `tsc` cobrar campo novo
  // aqui.
  it("preserva os TRÊS campos válidos, não só dois", () => {
    const cheio: Filtros = {
      distanciaKm: 60,
      daHoje: true,
      soGratis: true,
    };
    expect(lerFiltros(JSON.stringify(cheio))).toEqual(cheio);
  });

  // (b) A validação também é campo a campo, e o teste era em bloco. Um caso
  // por campo: assim a falha DIZ qual validação caiu, em vez de um objeto
  // inteiro diferente. `soGratis: "sim"` é o caso realista — JSON de uma
  // versão futura, ou mexido na mão pelo inspetor do navegador.
  //
  // ⚠️ O caso do `distanciaKm` mudou DE NOVO nesta rodada: era `45`, e quando o
  // conjunto `{30,60}` virou o intervalo `[1,100]` passou a `999` (acima do
  // teto de então). Nesta rodada o teto da distância morreu — `999` também
  // virou um valor VÁLIDO, e o caso precisou trocar mais uma vez. Trocado por
  // `0`, que fica torto em qualquer versão: o piso (1) não se move.
  it.each([
    ["distanciaKm", { distanciaKm: 0 }],
    ["daHoje", { daHoje: "sim" }],
    ["soGratis", { soGratis: "sim" }],
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

// O número que sobrou é DECISÃO DE PRODUTO, e a barra da tela vai lê-lo
// DAQUI — trocá-lo muda o que o app oferece, sem duas fontes pra discordar e
// sem nada gritando.
//
// 🔴 Eram QUATRO até esta rodada (conferido em `a66e0ef`): `DIST_PASSO_KM`,
// `DIST_MAX_KM`, `EXT_MAX_KM`, `EXT_PASSO_KM`. `DIST_MAX_KM` morreu na Task 5
// desta MESMA rodada — o teto da distância virou dinâmico, vem do acervo, e
// tem describe próprio ("tetoDaBarraDistancia: o teto vem do acervo").
// `EXT_MAX_KM` e `EXT_PASSO_KM` morrem NESTA task (Task 7, 2026-08-23): sem o
// campo `extensaoKm` no modelo, não sobra recorte pra ter teto nem passo. Só
// `DIST_PASSO_KM` continua de pé.
//
// ⚠️ O lado direito é LITERAL de propósito: derivá-lo de qualquer coisa
// importada do `filtros.ts` devolveria a asserção pro buraco de onde ela veio.
describe("os limites são decisão de produto, e o número fica preso", () => {
  it("o limite cravado é este — passo 5", () => {
    expect(DIST_PASSO_KM).toBe(5);
  });
});

// O recorte de km deixou de ser "está no conjunto?" e virou intervalo. (Era
// um de DOIS recortes assim — os seis casos do de extensão foram removidos
// mais abaixo, junto com o campo, na contração da Task 7.) Cada caso erra em
// UMA coisa só: num E de quatro sub-cláusulas, a que dispara primeiro esconde
// as outras (lição 2).
describe("lerFiltros: os intervalos de km", () => {
  const so = (campo: string, v: unknown) => lerFiltros(JSON.stringify({ [campo]: v }));

  // 🔴 O CASO QUE SEPARA a versão nova da velha. Com `DIST_MAX_KM = 100`, este
  // valor virava `null`. Sem teto não existe "grande demais": um corte absurdo
  // guardado produz um filtro INERTE, não um filtro que esconde.
  it("distância guardada acima de 100 km é aceita — não há mais teto", () => {
    expect(so("distanciaKm", 5000).distanciaKm).toBe(5000);
  });
  it("distanciaKm '30' (texto) → null", () => {
    expect(so("distanciaKm", "30").distanciaKm).toBe(null);
  });
  // As duas metades que CONTINUAM valendo, e a de baixo é a que impede o
  // "campo indigitável" de voltar: o piso é 1, não o passo.
  it("distância 0 e fracionária continuam virando null", () => {
    expect(so("distanciaKm", 0).distanciaKm).toBeNull();
    expect(so("distanciaKm", 4.5).distanciaKm).toBeNull();
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
  // por quê. Sem ESTE caso, nenhum teste da suíte distingue os dois pisos.
  it("distância 4 é aceita — o piso é 1, não o passo", () => {
    expect(so("distanciaKm", 4).distanciaKm).toBe(4);
  });
  // `1e999` é JSON VÁLIDO e vira `Infinity` no parse (medido) — o único
  // não-finito que chega até aqui.
  //
  // CINTO, e a honestidade sobre o que ele é: **nenhuma mutação única o mata**,
  // porque as duas cláusulas o barram sozinhas — sem `ehInteiro`,
  // `Infinity <= 100` é `false`; sem o teto, `Number.isInteger(Infinity)` é
  // `false` (medido dos dois lados). Ele fica como documentação do caminho
  // medido, não como rede: ver este teste verde NÃO prova que o não-finito
  // está protegido por alguma linha em particular.
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

  // 🔴 Os seis testes de `extensaoMaxKm` que viviam aqui morreram nesta task
  // (Task 7, 2026-08-23): o campo saiu de `Filtros`, `lerFiltros` não o lê
  // mais, e `so("extensaoMaxKm", ...)` produziria um objeto que `kmGuardado`
  // nunca vê — não haveria mais o que provar. `EXT_MAX_KM`/`EXT_PASSO_KM`
  // morreram junto, em `src/lib/filtros.ts`.

  // O celular dele tem `bp.filtros` gravado de verdade, e ali `distanciaKm` só
  // podia ser 30 ou 60. Os dois têm que continuar de pé no intervalo novo —
  // senão a rodada desliga, sozinha, o filtro que ele deixou ligado.
  it("os valores guardados 30 e 60 da versão velha continuam válidos no intervalo novo", () => {
    expect(so("distanciaKm", 30).distanciaKm).toBe(30);
    expect(so("distanciaKm", 60).distanciaKm).toBe(60);
  });
});

// 🔴 O describe "lerFiltros: pisoMinimo" morreu aqui (2026-08-27) — QUATRO
// testes, e vale registrar o que cada um provava, porque nenhum foi movido:
//   1. piso inválido guardado vira `null`;
//   2. `barro` guardado vira `null` (aceso, não esconderia nada e não teria
//      chip pra desligar — a lição que voltou hoje, aplicada ao chip do carro);
//   3. cada piso filtrável sobrevive à releitura;
//   4. a PROVA DE FONTE de que a validação consultava `PISOS_FILTRAVEIS`.
// Os quatro provavam a leitura de um campo que `Filtros` não tem mais.
// `PISOS_FILTRAVEIS` e `ordemPiso` saíram de `src/lib/piso.ts` na mesma
// contração — o piso parou de ser comparado com piso.
//
// ⚠️ O que NÃO morreu com eles: o `pisoMinimo` guardado no celular DELE agora é
// um fantasma, e o teste que prova que ele é ignorado está no bloco
// "filtro fantasma" logo abaixo. Esse é o caso perigoso: ao contrário dos
// fantasmas de 2026-08-23, este esconde ficha de verdade.

// 🔴 A PROVA DE FONTE DO ARREDONDAMENTO — a quarta desta família no repo, e a
// que este conserto existe pra instalar.
//
// Em runtime, `kmNaTelaExtensao(4.04)` e um `Math.round(4.04 * 10) / 10`
// escrito à mão AQUI DENTRO devolvem o MESMO valor: nenhuma asserção sobre o
// que o filtro esconde separa as duas versões — todos os testes de fronteira
// deste arquivo passam com a conta copiada. Só a FONTE separa, e é a fonte que
// garante que no dia em que a tela mudar de arredondamento (mais uma casa,
// outro degrau) o recorte mude junto, em vez de a divergência voltar com outra
// roupa. É exatamente esse padrão — duas cópias da mesma conta em dois arquivos
// — que já custou a este app os "dois km" da mesma trilha e o "não suba" em
// selo verde.
//
// Dois lados, como as irmãs: importar não obriga a usar, e não refazer a conta
// não obriga a chamar quem a faz. As três asserções são independentes.
// 🔴 OS COMENTÁRIOS SAEM ANTES DE QUALQUER BUSCA, e isto NÃO é higiene: foi
// medido. A primeira versão destas asserções lia o arquivo cru, e a mutação que
// troca `kmNaTelaExtensao(ficha.extensaoKm)` por `Math.round(...)` à mão deixou
// o "e CHAMA as duas" VERDE — porque o comentário do bloco da extensão cita
// `kmNaTelaExtensao(undefined)` pra registrar uma medição, e o regex casou o
// comentário. Um teste de fonte lendo comentário prova que alguém ESCREVEU o
// nome, não que o código o CHAMA. O que se procura é código.
describe("o filtro não refaz a conta do arredondamento — ele chama a fonte", () => {
  const src = readFileSync(path.join(process.cwd(), "src", "lib", "filtros.ts"), "utf8");
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // A tira de comentários é conferida antes de valer como prova: se ela
  // engolisse o arquivo, todas as asserções abaixo passariam vazias — as de
  // ausência sozinhas, e as de presença pela mensagem errada.
  it("a tira de comentários deixa o código de pé", () => {
    expect(codigo).toContain("export function passaNoFiltro");
    expect(codigo).toContain("export function lerFiltros");
    // E tirou mesmo alguma coisa: senão ela é um `replace` que não replaceia.
    expect(codigo.length).toBeLessThan(src.length);
  });

  // 🔴 Era "as duas funções" e "CHAMA as duas": `kmNaTelaExtensao` saiu do
  // import nesta task (Task 7, 2026-08-23) junto com o campo `extensaoKm` —
  // sem recorte de extensão, não sobra o que a função meça pro filtro.
  it("filtros.ts importa kmNaTelaDistancia de @/lib/geo", () => {
    const importado = codigo.match(/import\s*\{([\s\S]*?)\}\s*from\s*"@\/lib\/geo"/);
    expect(importado, "filtros.ts tem que importar de @/lib/geo").not.toBeNull();
    expect(importado![1]).toContain("kmNaTelaDistancia");
    expect(importado![1]).not.toContain("kmNaTelaExtensao");
  });

  it("e CHAMA a função — no recorte de distância", () => {
    expect(codigo, "o recorte de distância tem que chamar kmNaTelaDistancia").toMatch(
      /kmNaTelaDistancia\(/,
    );
    expect(codigo, "kmNaTelaExtensao não existe mais — não há mais recorte pra chamá-la").not.toMatch(
      /kmNaTelaExtensao\(/,
    );
  });

  // A outra metade: nenhuma aritmética de arredondamento escrita aqui. As duas
  // formas realistas de reimplementar a conta à mão são `Math.round(km * 10)`
  // e `Number(km.toFixed(1))` — as duas ficam proibidas por nome. `filtros.ts`
  // é um módulo de REGRA, não de formatação: se um dia ele precisar
  // legitimamente de uma delas, esta asserção é o lugar de discutir por quê.
  it("e não escreve arredondamento nenhum de próprio punho", () => {
    expect(codigo, "arredondamento em filtros.ts é a segunda fonte voltando").not.toMatch(
      /Math\.round\(/,
    );
    expect(codigo, "toFixed em filtros.ts é a segunda fonte voltando").not.toMatch(/toFixed\(/);
  });
});

// O celular dele abre com o `bp.filtros` da versão ANTERIOR gravado, e ali
// `esforco` e `duracaoMax` estão escritos de verdade. Depois da contração eles
// não são mais lidos, e é isso que este bloco trava.
//
// 🔴 `extensaoMaxKm` entra nesta fixture como um TERCEIRO campo morto: esta
// task (Task 7, 2026-08-23) apagou o recorte de extensão junto com o campo
// `extensaoKm` do modelo. Ele fica como `null` aqui (não é o caso que separa
// "gravado de verdade" — esse é o bloco "o FILTRO FANTASMA" logo abaixo, com
// um valor não-nulo).
//
// 🔴 A FIXTURE É LOAD-BEARING DUAS VEZES, e as duas razões são estas:
//
// 1. É a FORMA DE PRODUÇÃO. `src/app/filtros.tsx` grava `JSON.stringify(f)` — o
//    objeto `Filtros` INTEIRO, não só o que a pessoa ligou —, então o que está
//    no celular dele traz os quatro vivos escritos como `null`/`false` ao lado
//    dos três mortos. Fixture com só os campos mortos dá o mesmo resultado
//    (chave ausente e chave nula caem no mesmo padrão, medido), mas não é o
//    que o comentário acima afirma estar gravado lá.
// 2. NENHUM recorte vivo vem LIGADO. Com um ligado junto (um `distanciaKm: 60`,
//    que o JSON real dele também pode ter), o `contarLigados(...) === 0` viraria
//    `=== 1` e deixaria de separar as versões — passaria igual com os campos
//    mortos sendo contados. Que os valores vivos da versão velha sobrevivem já
//    está provado em "os valores guardados 30 e 60 da versão velha continuam
//    válidos".
describe("lerFiltros: o que já está gravado no celular dele", () => {
  const VELHO = JSON.stringify({
    distanciaKm: null, daHoje: false, soGratis: false, extensaoMaxKm: null, pisoMinimo: null,
    duracaoMax: 120, esforco: "media",
  });

  it("filtro guardado com duracaoMax e esforco continua não estourando", () => {
    expect(() => lerFiltros(VELHO)).not.toThrow();
    expect(lerFiltros(VELHO)).toEqual(SEM_FILTRO);
  });

  // A asserção que fala da TELA dele, e não do crash: entre a expansão e agora,
  // um `esforco` guardado contava na linha de resumo ("1 filtro ligado") sem
  // nenhum chip no painel pra desligar e sem botão de limpar — ele reclamou
  // disso no celular. A saída se fecha por construção, porque o `lerFiltros`
  // deixou de ler os dois campos.
  //
  // ⚠️ O QUE ESTA ASSERÇÃO É, MEDIDO NOS DOIS SENTIDOS — e o resultado tem duas
  // metades que não se misturam:
  //
  // ELA NÃO É REDUNDANTE COM O `toEqual(SEM_FILTRO)` DE CIMA. Um `...x`
  // espalhado no `lerFiltros` derruba SÓ aquele (1 teste da suíte inteira, e o
  // `tsc` fica limpo: spread não dispara checagem de propriedade excedente);
  // um `contarLigados` contando um a mais derruba SÓ esta aqui, dentro deste
  // bloco. As duas medições foram feitas, uma em cada sentido.
  //
  // O QUE É REDUNDANTE é ela ser o ÚNICO detector de alguma coisa: não existe.
  // Sempre que ela cai, ou cai o `toEqual` junto, ou caem os irmãos de
  // presença ("contarLigados é zero", "conta cada recorte ligado uma vez",
  // "conta os QUATRO campos") — a mutação do parágrafo acima derruba vários
  // testes, e esta é um deles. Ela fica porque é a única forma EXECUTÁVEL do
  // requisito do jeito que a pessoa o vive: "o filtro fantasma não conta na
  // linha de resumo".
  it("filtro guardado da versão velha não conta filtro ligado nenhum", () => {
    expect(contarLigados(lerFiltros(VELHO))).toBe(0);
  });
});

// 🔴 O FILTRO FANTASMA DESTA TASK (Task 7, 2026-08-23) — a prova de que a
// CONTRAÇÃO fechou. É a mesma família do bloco acima (esforco/duracaoMax na
// rodada passada), mas com um detalhe mais forte: aqui `extensaoMaxKm` não
// está `null`, está GRAVADO DE VERDADE — o celular do João tem o recorte que
// ele usou. Se `lerFiltros` continuasse lendo o campo, a linha de resumo
// diria "1 filtro ligado" sem chip pra desligar e sem botão de limpar (o
// `limpar filtros` do `FolhaTrilhas` vive dentro do ramo
// `visiveis.length === 0`, e a lista não fica vazia). Foi exatamente o que
// ele reclamou no primeiro review do celular.
describe("lerFiltros: os filtros fantasmas de todas as contrações", () => {
  // 🔴 O `pisoMinimo` entrou nesta lista em 2026-08-27 e é O MAIS PERIGOSO DOS
  // QUATRO. Os outros três (`esforco`, `duracaoMax`, `extensaoMaxKm`) nunca
  // chegaram a esconder ficha: os campos que eles comparavam não existem mais
  // em ficha nenhuma, então o dano era o CONTADOR mentindo. O piso não —
  // `piso: "barro"` está gravado nas DUAS fichas reais, e um `pisoMinimo`
  // sobrevivente esconderia as duas de vez, sem chip pra desligar e sem botão
  // de limpar (o `limpar filtros` vive dentro do ramo `visiveis.length === 0`).
  // A home ficaria VAZIA no celular dele, e nada na tela diria por quê.
  it("o que está guardado no celular dele não acende filtro nenhum", () => {
    const velho = JSON.stringify({
      distanciaKm: 30, extensaoMaxKm: 6, esforco: "media", duracaoMax: 90,
      pisoMinimo: "asfalto-tapete",
    });
    const lido = lerFiltros(velho);
    expect(contarLigados(lido)).toBe(1); // só a distância, que continua existindo
    // A lista de chaves é a prova de que o campo morto não voltou pelo objeto:
    // `contarLigados` sozinho não distingue "não li" de "li e deu falso".
    expect(Object.keys(lido).sort()).toEqual(
      ["daHoje", "distanciaKm", "soGratis"],
    );
  });

  // 🔴 E A METADE QUE FALTAVA: o contador não mentir não basta, a ficha tem
  // que CONTINUAR NA TELA. Este é o caso que separa "o campo foi ignorado" de
  // "o campo foi lido e por acaso não escondeu" — e é o único que exercita o
  // dano real do fantasma do piso.
  it("com o piso fantasma guardado, a ficha de barro continua passando", () => {
    const lido = lerFiltros(JSON.stringify({ pisoMinimo: "asfalto-tapete" }));
    expect(passaNoFiltro({
      ficha: { ...base, piso: "barro" },
      leitura: FRESCO, filtros: lido, voce: null, confia: true,
    })).toBe(true);
  });
});

// Um grau de latitude ≈ 111,195 km (é o que tests/lib/geo.test.ts mede). Pra
// pôr uma ficha a ~N km de VOCE, desloca-se a latitude. Não é preciso ao
// metro, e nenhum teste abaixo depende disso: os que dependem de um valor
// exato ASSERTAM a distância antes de usá-la.
const VOCE = { lat: -8, lng: -35 };

// Sobrescreve SÓ o waypoint, deixando `condicao.coords` como o da Rampa real
// (`base`). Na Rampa as duas coordenadas coincidem por acaso; sobrescrevendo
// só uma, elas passam a DIFERIR — e é isso que faz a mutação #8 da tabela
// (`coordDaDistancia(f)` → `f.condicao.coords`) morder sozinha. Se as duas
// fossem sobrescritas juntas, elas continuariam iguais entre si e a mutação
// não teria como se separar da versão correta.
const fichaA = (slug: string, grausAoNorte: number): Ficha => ({
  ...base,
  slug,
  trajeto: { waypoints: [{ nome: slug, lat: VOCE.lat + grausAoNorte, lng: VOCE.lng }] },
});

describe("tetoDaBarraDistancia: o teto vem do acervo, não de um número inventado", () => {
  // O piso. Sem ele, um acervo todo perto degenera a barra em duas paradas.
  it("com tudo perto, o teto é o mínimo — não a trilha mais longe", () => {
    const perto = fichaA("perto", 0.07); // ~7,8 km
    expect(tetoDaBarraDistancia([perto], VOCE, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  // 🔴 O CASO QUE SEPARA a versão "acervo" da versão "constante fixa": a
  // trilha mais longe TEM que estar acima do piso, senão as duas versões
  // devolvem o mesmo número e a prova é oca.
  it("com uma trilha longe, o teto sobe pra ela, arredondado pra cima no passo", () => {
    const longe = fichaA("longe", 0.42); // ~46,7 km
    const bruta = distanciaKm(VOCE, { lat: VOCE.lat + 0.42, lng: VOCE.lng });
    // Não-vacuidade: o caso só separa se a distância cair na faixa que eu digo.
    expect(bruta).toBeGreaterThan(45);
    expect(bruta).toBeLessThan(50);
    expect(tetoDaBarraDistancia([longe], VOCE, null)).toBe(50);
  });

  // 🔴 O CANDIDATO 2, e ele é o que impede a TELA DE MENTIR: com um corte
  // guardado acima do teto do acervo, o elemento `range` prende o pegador no
  // `max` e ele encosta na parada "qualquer" enquanto a leitura ao lado diz
  // "até 500 km". A barra estica pra conter o pegador.
  it("um corte guardado ACIMA do acervo estica o teto", () => {
    const perto = fichaA("perto", 0.07);
    expect(tetoDaBarraDistancia([perto], VOCE, 500)).toBe(500);
  });

  it("um corte guardado ABAIXO do teto não o encolhe", () => {
    const longe = fichaA("longe", 0.42);
    expect(tetoDaBarraDistancia([longe], VOCE, 10)).toBe(50);
  });

  // 🔴 "O FILTRO SEGUE A TELA" aplicado ao teto. O caso que separa km cru de
  // km da tela: uma trilha cuja distância CRUA está logo acima de um múltiplo
  // do passo, mas cujo número NA TELA é o múltiplo. Com o km cru o teto pularia
  // pro próximo passo e sobraria uma parada que não esconde ninguém.
  it("o teto sai do número que a TELA mostra, não do km cru", () => {
    const f = fichaA("borda", 0.2735); // ~30,4 km cru → "~30 km" na tela
    const bruta = distanciaKm(VOCE, { lat: VOCE.lat + 0.2735, lng: VOCE.lng });
    // Não-vacuidade nos dois lados: o caso só separa dentro desta faixa.
    expect(bruta).toBeGreaterThan(30);
    expect(bruta).toBeLessThan(30.5);
    expect(kmNaTelaDistancia(bruta)).toBe(30);
    expect(tetoDaBarraDistancia([f], VOCE, null)).toBe(30); // com o km cru daria 35
  });

  // Sem localização o recorte nem aparece na tela; a função ainda tem que
  // devolver um número usável, e o acervo não entra na conta.
  it("sem localização, o teto é o mínimo", () => {
    const longe = fichaA("longe", 0.42);
    expect(tetoDaBarraDistancia([longe], null, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  it("acervo vazio não estoura", () => {
    expect(tetoDaBarraDistancia([], VOCE, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  // O contrato do FaixaKm: `max` inteiro, e as paradas inteiras. Sem isso a
  // barra sobe km fracionário pelo onChange e o `lerFiltros` o recusa — o
  // filtro se desligando sozinho entre duas aberturas do app.
  it("o teto é sempre múltiplo inteiro do passo — é pré-condição do FaixaKm", () => {
    for (const graus of [0.01, 0.07, 0.2735, 0.42, 1.1, 3.7]) {
      const teto = tetoDaBarraDistancia([fichaA("x", graus)], VOCE, null);
      expect(Number.isInteger(teto)).toBe(true);
      expect(teto % DIST_PASSO_KM).toBe(0);
    }
  });

  // O teto sai da trilha MAIS LONGE, não da primeira nem da última do array.
  it("com várias trilhas, manda a mais longe — em qualquer ordem", () => {
    const a = fichaA("a", 0.07), b = fichaA("b", 0.42), c = fichaA("c", 0.2);
    expect(tetoDaBarraDistancia([a, b, c], VOCE, null)).toBe(50);
    expect(tetoDaBarraDistancia([b, c, a], VOCE, null)).toBe(50);
  });
});
