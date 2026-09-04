import fs, { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getFicha,
  getAllFichas,
  getFichasComCondicao,
  loadAll,
  ordenarPorNome,
} from "@/lib/ficha";
import { fichaSchema } from "@/types/ficha";
import type { Ficha } from "@/types/ficha";

// Ficha mínima e sintética — só o que ordenarPorNome lê (o nome do primeiro
// waypoint). O resto do schema não importa pra este teste, e não depende do
// que existe em content/fichas (que é conteúdo real do projeto, não fixture).
function fichaComNome(nome: string): Ficha {
  return {
    slug: nome.toLowerCase(),
    modos: [],
    rotulo_escaneio: "",
    promessa: "",
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome, lat: 0, lng: 0 }] },
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

describe("ficha loader", () => {
  it("loads and validates the real Rampa do Pepê ficha", () => {
    const f = getFicha("rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.slug).toBe("rampa-do-pepe");
    expect(f!.modos).toContain("condicional");
    expect(f!.condicao.regra.tipo).toBe("chuva_binaria");
    expect(typeof f!.condicao.coords.lat).toBe("number");
    expect(f!.trajeto.waypoints.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown slug", () => {
    expect(getFicha("nao-existe")).toBeNull();
  });

  it("lists all fichas and those with condicao", () => {
    expect(getAllFichas().length).toBeGreaterThan(0);
    expect(getFichasComCondicao().every((f) => f.condicao != null)).toBe(true);
  });

  it("as fichas saem ordenadas por nome, não pela ordem do sistema de arquivos", () => {
    const nomes = getAllFichas().map((f) => f.trajeto.waypoints[0].nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("ordenarPorNome ordena de verdade — inclusive acento, que localeCompare pt-BR resolve", () => {
    // Fora de ordem de propósito, e com "Ávila" testando que o acento não vira
    // bagunça: comparação de bytes puta colocaria "Boa Vista" antes de "Ávila"
    // (o 'Á' tem code point maior que 'B' em UTF-16), localeCompare("pt-BR") não.
    const fora_de_ordem = [
      fichaComNome("Cachoeira do Urubu"),
      fichaComNome("Boa Vista"),
      fichaComNome("Ávila"),
    ];
    const nomes = ordenarPorNome(fora_de_ordem).map((f) => f.trajeto.waypoints[0].nome);
    expect(nomes).toEqual(["Ávila", "Boa Vista", "Cachoeira do Urubu"]);
  });
});

// JSON bruto (não Ficha já validada) — precisa ser o que fs.readFileSync +
// JSON.parse produziria, pra exercitar loadAll de ponta a ponta (leitura de
// diretório + parse + checagem de slug), não só a validação do schema.
function fichaJSON(slug: string, nome = slug): unknown {
  return {
    slug,
    modos: [],
    rotulo_escaneio: "",
    promessa: "",
    voz: "",
    premio: "",
    trajeto: { waypoints: [{ nome, lat: 0, lng: 0 }] },
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

/** Diretório sintético descartável — nunca content/fichas, que é conteúdo
 *  real do dono do projeto, não fixture de teste. */
function dirSintetico(arquivos: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-fichas-teste-"));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(dir, nome), JSON.stringify(conteudo));
  }
  return dir;
}

// `esforco` e `duracao` foram APAGADOS do schema nesta rodada: este app só
// sabe falar de LUGAR, e quem ficou no lugar dos dois é o par `piso` /
// `extensaoKm` do bloco abaixo.
describe("esforco e duracao saíram do schema", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  // ⚠️ QUEM PROVA O QUÊ, e aqui a resposta é "só este teste".
  //
  // O `tsc` NÃO é dono desta remoção: devolver `esforco: esforcoSchema
  // .optional()` ao `fichaSchema` é um campo opcional a mais num tipo
  // inferido que ninguém lê — compila limpo, e o `next build` também passa.
  //
  // E "não estourar" também não separa as versões: o zod, por padrão,
  // DESCARTA chave desconhecida em silêncio em vez de reclamar, então
  // `parse({...base, esforco: "puxada"})` não estoura nem antes nem depois. O
  // que separa é o campo NÃO CHEGAR no objeto lido.
  //
  // O `expect(lido.slug)` não é decoração: sem ele, um `parse` que devolvesse
  // `{}` passaria nas duas asserções de ausência (é a mesma armadilha do
  // `not.toContain` que mascara o elemento sumido).
  it("ficha antiga com os dois campos ainda carrega, e eles não chegam no objeto lido", () => {
    const lido = fichaSchema.parse({ ...base, esforco: "puxada", duracao: 90 });
    expect(lido.slug).toBe(base.slug);
    expect(lido).not.toHaveProperty("esforco");
    expect(lido).not.toHaveProperty("duracao");
  });
});

// 🔴 Era "piso e extensaoKm": o campo `extensaoKm` saiu do schema nesta task
// (Task 7, 2026-08-23). Os dois testes que só existiam pra validar a
// positividade dele ("extensaoKm zero ou negativa não valida" e "extensaoKm
// positivo valida e sobrevive ao parse") morreram junto — não sobra regra de
// validação pra provar, e `fichaSchema.parse({ ...base, extensaoKm: 0 })`
// deixaria de estourar (zod descarta chave desconhecida em silêncio), o que
// faria o primeiro deles falhar por razão errada em vez de simplesmente não
// existir mais.
describe("piso", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  it("ficha com piso inválido ('terra') não valida", () => {
    expect(() => fichaSchema.parse({ ...base, piso: "terra" })).toThrow();
  });

  it("aceita os quatro pisos da escala", () => {
    for (const p of ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"]) {
      expect(() => fichaSchema.parse({ ...base, piso: p })).not.toThrow();
    }
  });

  // 🔴 Desde a Task 8 (2026-08-23) `base` (a Rampa real) TRAZ `piso: "barro"` —
  // este teste é sobre o SCHEMA aceitar a ausência do campo, não sobre o
  // conteúdo de hoje da Rampa, então a fixture apaga o campo à mão em vez de
  // depender de uma ficha real que não o tenha.
  it("ficha SEM piso valida — é opcional", () => {
    const { piso: _piso, ...semPiso } = base;
    expect(() => fichaSchema.parse(semPiso)).not.toThrow();
    const lido = fichaSchema.parse(semPiso);
    expect(lido.piso).toBeUndefined();
  });

  // A ficha REAL. Sintética prova a função; só a real prova o conteúdo
  // (lição 10) — desde a Task 8 (2026-08-23) a Rampa carrega com
  // `piso: "barro"`, dado do João, sustentado pela ficha real em três lugares
  // (não fixture).
  it("a Rampa carrega com piso de barro — é dado real, não fixture", () => {
    const f = getFicha("rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.piso).toBe("barro");
  });

  // 🔴 PROVA DE FONTE — mesma família do "PISOS_FILTRAVEIS é derivado de PISOS"
  // em tests/lib/piso.test.ts, e existe pela MESMA razão. Em runtime,
  // `z.enum(PISOS)` e `z.enum(["barro", "paralelepipedo", ...])` são o mesmo
  // schema: aceitam os mesmos quatro nomes e recusam os mesmos, então nenhuma
  // asserção sobre o que o parse faz separa as duas versões — foi MEDIDO, a
  // suíte inteira fecha verde com a lista escrita à mão aqui. Só a FONTE
  // distingue, e é ela que garante que um quinto piso acrescentado em
  // `src/lib/piso.ts` entre no zod junto, em vez de ser recusado no parse por
  // uma segunda lista que ninguém lembrou de atualizar.
  //
  // Cobre os DOIS lados de propósito — precedente do teste dos quatro limites em
  // tests/app/PainelFiltros.test.tsx: o `import` sozinho não impede importar e
  // não usar, então a segunda asserção exige que seja `PISOS` quem monta o enum.
  it("o zod monta o enum do piso a partir de PISOS — nenhum nome escrito à mão", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "types", "ficha.ts"), "utf8");
    expect(src, "ficha.ts tem que importar PISOS de @/lib/piso").toMatch(
      /import\s*\{[^}]*\bPISOS\b[^}]*\}\s*from\s*"@\/lib\/piso"/,
    );
    expect(src, "o campo `piso` tem que ser montado com z.enum(PISOS)").toMatch(
      /piso:\s*z\.enum\(PISOS\)/,
    );
  });
});

// 🔴 O campo que nasceu de uma MENTIRA no ar (2026-08-26). A meia-frase "Área
// alta, escorre rápido — a serra firmou" morava FIXA no `Carimbo.tsx`: era
// verdade enquanto a Rampa era a única ficha do acervo, e virou falsa no
// instante em que a Pedra Furada entrou — lá é chão batido e PLANO. Estes
// testes existem pra que ela não volte pro código.
describe("secaRapido — a explicação do relevo é da FICHA, não do app", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  // Opcional pela mesma razão do `piso`: é fato de roteiro. A fixture apaga o
  // campo à mão em vez de depender de uma ficha real que não o tenha — hoje as
  // duas têm, e o teste é sobre o SCHEMA, não sobre o acervo de hoje.
  it("ficha SEM secaRapido valida — é opcional, e o campo fica indefinido", () => {
    const { secaRapido: _s, ...sem } = base;
    expect(() => fichaSchema.parse(sem)).not.toThrow();
    expect(fichaSchema.parse(sem).secaRapido).toBeUndefined();
  });

  it("secaRapido que não é texto não valida", () => {
    expect(() => fichaSchema.parse({ ...base, secaRapido: 42 })).toThrow();
  });

  // As fichas REAIS, por SLUG e nunca por índice — a lição de 2026-08-25, em
  // que nove testes quebraram porque liam o acervo supondo ficha única.
  //
  // A asserção que importa é a ÚLTIMA: as duas frases DISCORDAM. Enquanto
  // discordarem, nenhuma delas pode estar fixa no componente — ele é um só e
  // serve as duas. As de presença não são redundantes com ela: `not.toBe`
  // sozinha morreria se as duas fossem indefinidas, mas passa com uma
  // indefinida e a outra escrita, que é o meio-caminho a barrar aqui.
  it("as duas fichas do acervo trazem a sua frase, e elas DISCORDAM", () => {
    const rampa = getFicha("rampa-do-pepe");
    const pedra = getFicha("pedra-furada-de-venturosa");
    expect(rampa).not.toBeNull();
    expect(pedra).not.toBeNull();
    expect(rampa!.secaRapido, "a Rampa precisa da frase dela").toBeTruthy();
    expect(pedra!.secaRapido, "a Pedra Furada precisa da frase dela").toBeTruthy();
    expect(pedra!.secaRapido).not.toBe(rampa!.secaRapido);
  });

  // O defeito exato que estava em produção, cravado pelo nome. "Serra" é a
  // palavra da Rampa; a Pedra Furada é plana, e o João a descreveu como
  // "estrada de chão batido e plana". Reword-proof: ele pode reescrever a
  // frase à vontade, só não pode pôr serra onde não tem.
  it("a frase da Pedra Furada não fala em serra — foi essa a mentira que estava no ar", () => {
    const pedra = getFicha("pedra-furada-de-venturosa");
    expect(pedra!.secaRapido).toBeTruthy();
    expect(pedra!.secaRapido!.toLowerCase()).not.toContain("serra");
  });
});

// 🔴 O campo que nasceu de um "portão" ESCRITO NO CÓDIGO (2026-08-27). O chip
// do topo era montado como `${preço} · portão` — verdade na Rampa e invenção em
// qualquer trilha paga que cobre de outro jeito. Decisão dele: *"tem que ser
// algo personalizável, nem tudo tem o mesmo valor e mesma forma"*.
describe("custo.curto — o chip é da FICHA, não do app", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  it("ficha paga SEM curto valida — é opcional, e o app mostra só o preço", () => {
    const { curto: _c, ...custoSem } = base.custo;
    const sem = { ...base, custo: custoSem };
    expect(() => fichaSchema.parse(sem)).not.toThrow();
    expect(fichaSchema.parse(sem).custo.curto).toBeUndefined();
  });

  it("curto que não é texto não valida", () => {
    expect(() => fichaSchema.parse({ ...base, custo: { ...base.custo, curto: 5 } })).toThrow();
  });

  // A ficha REAL, por slug. A Pedra Furada é GRÁTIS, então não entra aqui — e
  // isso é registro, não esquecimento: hoje só existe uma ficha paga no acervo,
  // que é justamente por que o "portão" fixo passou despercebido tanto tempo.
  it("a Rampa traz o chip dela, e ele NÃO repete a linha completa do custo", () => {
    const rampa = getFicha("rampa-do-pepe")!;
    expect(rampa.custo.tag).toBe("pago");
    expect(rampa.custo.curto, "a Rampa precisa do chip dela").toBeTruthy();
    // Curto é curto: se alguém colar a frase inteira aqui, o chip do topo
    // estoura a barra. Quatro palavras é o orçamento real da pílula.
    expect(rampa.custo.curto!.split(/\s+/).length).toBeLessThanOrEqual(4);
    expect(rampa.custo.curto).not.toBe(rampa.custo.valor);
  });

  it("a única ficha grátis do acervo não tem chip pra ter", () => {
    expect(getFicha("pedra-furada-de-venturosa")!.custo.tag).toBe("gratis");
  });
});

// 🔴 O campo que nasceu de um PROXY que errava (2026-08-27). O filtro de piso
// era usado como "meu carro chega lá?" — e as duas fichas reais são `barro` com
// carro comum chegando nas duas, então quem pedia piso melhor perdia as duas
// com o carro que tinha. O recorte saiu da tela; o fato virou campo.
describe("carroComum — a pergunta que o piso respondia errado", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  it("ficha SEM o campo valida — é opcional, e ausente é SILÊNCIO", () => {
    const { carroComum: _c, ...sem } = base;
    expect(() => fichaSchema.parse(sem)).not.toThrow();
    expect(fichaSchema.parse(sem).carroComum).toBeUndefined();
  });

  it("carroComum que não é booleano não valida", () => {
    expect(() => fichaSchema.parse({ ...base, carroComum: "sim" })).toThrow();
  });

  // 🔴 ESTE É O TESTE QUE REGISTRA O ERRO DE PREMISSA. Antes de escrever o
  // campo eu ia gravar `false` na Rampa, porque o `RESUME` dizia "a Rampa não
  // sobe de carro comum". A ficha DELA diz o contrário: *"Dá pra ir de carro
  // comum — mas só quando não estiver chovendo"*. A ressalva é de CHUVA, e
  // quem a diz é o carimbo; o campo responde só "o carro chega?".
  //
  // Se um dia alguém achar que a Rampa é `false`, é este teste que discorda —
  // e a asserção do `acesso` é o porquê, no mesmo lugar.
  // 🔴 VARRIA UMA LISTA DE SLUGS ESCRITA À MÃO até 2026-09-04, e por isso não
  // enxergou a 3ª ficha: medido, apagar o `carroComum` da Véu de Noiva ou pôr
  // nela um `acesso` dizendo "só 4x4 alto chega" passava verde. É a espécie 12
  // ("guarda que enumera o acervo à mão é cego a ele crescer") no arquivo que
  // tem, dois testes abaixo, o guarda que fez tudo certo. Agora varre o acervo.
  it("toda ficha que afirma carro comum sustenta o fato no acesso — a ressalva é de chuva, não de veículo", () => {
    const afirmam = getAllFichas().filter((f) => f.carroComum === true);
    expect(afirmam.length, "sumiu a ficha que afirma carro comum: este guarda ficaria oco")
      .toBeGreaterThanOrEqual(2);
    for (const f of afirmam) {
      expect(
        f.acesso.toLowerCase(),
        `o acesso de ${f.slug} deixou de sustentar o carroComum — releia antes de mexer no campo`,
      ).toContain("carro comum");
    }
  });

  // ⚠️ A consequência que ELE aceitou de olhos abertos: com todas em `true`,
  // um chip "só onde carro comum chega" acenderia e não mudaria a lista — o
  // defeito do `barro`. Por isso o campo existe e o chip NÃO. Este teste cai no
  // dia em que entrar uma ficha `false`, que é exatamente o dia de rever a
  // decisão — é um lembrete com data, não uma trava.
  //
  // 🔴 VARRE O ACERVO INTEIRO, e não uma lista de slugs escrita à mão. A
  // primeira versão listava as duas fichas de hoje — MEDIDO em 2026-08-27 com
  // uma ficha de ensaio `carroComum: false` no `content/`: ela **passava**, e o
  // lembrete não tocava justamente no caso pra que foi escrito. É a espécie do
  // "índice significando identidade" (2026-08-25) com outra roupa: **guarda que
  // enumera o acervo à mão é cego ao acervo crescer.**
  it("enquanto TODAS forem true, não há chip pra ter — o recorte não recortaria", () => {
    const todas = getAllFichas();
    expect(todas.length, "o acervo sumiu — este lembrete ficaria oco").toBeGreaterThanOrEqual(2);
    const semCarro = todas.filter((f) => f.carroComum === false).map((f) => f.slug);
    expect(
      semCarro,
      `chegou ficha que carro comum NÃO alcança (${semCarro.join(", ")}) — ` +
        "o chip do carro passou a filtrar de verdade, e a decisão de 2026-08-27 " +
        "de não desenhá-lo precisa ser refeita com ele.",
    ).toEqual([]);
  });
});

describe("loadAll: slug repetido não pode divergir entre telas", () => {
  it("dois JSONs com o mesmo slug estouram, citando o slug e os dois arquivos", () => {
    const dir = dirSintetico({
      "a-arquivo.json": fichaJSON("morro-x", "Morro X (versão A)"),
      "b-arquivo.json": fichaJSON("morro-x", "Morro X (versão B)"),
    });

    expect(() => loadAll(dir)).toThrow(/morro-x/);
    expect(() => loadAll(dir)).toThrow(/a-arquivo\.json/);
    expect(() => loadAll(dir)).toThrow(/b-arquivo\.json/);
  });

  it("o caminho normal — slugs distintos — continua carregando", () => {
    const dir = dirSintetico({
      "a.json": fichaJSON("morro-a", "Morro A"),
      "b.json": fichaJSON("morro-b", "Morro B"),
    });

    expect(loadAll(dir).map((f) => f.slug)).toEqual(["morro-a", "morro-b"]);
  });
});
