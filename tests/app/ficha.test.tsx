import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { CHAVE_LOCAL } from "@/lib/local";
import type { Ficha as TipoFicha } from "@/types/ficha";
import { regraDe, semComentarios, valorDe } from "../css";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

// Duas fichas sintéticas pros casos do piso. Sintéticas porque, desde
// 2026-08-23 (Task 8), o JSON real (a Rampa) traz `piso: "barro"` — e `barro`
// é justamente o piso cujo formato coincide com o valor cru (ver abaixo), o
// que o torna inútil pra provar que `rotuloPiso` faz alguma coisa. Pra isso é
// preciso um piso COM hífen, e a Rampa real não tem — por isso as sintéticas.
//
// `piso: "asfalto-esburacado"`, não "barro", é load-bearing e não decorativo:
// `rotuloPiso("barro")` devolve "barro", e aí chamar a função e mostrar o enum
// cru dão a MESMA string — nenhuma asserção separaria as duas versões. Com o
// hífen, separa.
//
// 🔴 Havia uma terceira ficha aqui, `COM_FATOS` (piso + `extensaoKm: 4.25`),
// pra provar "a tela parou de mostrar" (campo presente) contra "o dado sumiu"
// (campo ausente). A contração desta task (Task 7, 2026-08-23) apagou
// `extensaoKm` do schema — sem o campo, essa distinção não existe mais pra
// provar, e `COM_FATOS` virou EQUIVALENTE a `SO_PISO` pra este teste (só o
// `slug` difere entre as duas; o piso é o mesmo, "asfalto-esburacado", e nem
// um nem outro tem mais o campo morto). O `slug` não carrega prova nenhuma —
// nada no bloco de baixo lê ou compara essa string —, então a diferença não
// separa as duas versões. O teste que usava `COM_FATOS` foi apagado junto —
// ver a nota abaixo.
const { SEM_FATOS, SO_PISO, PAGO_SEM_CURTO, PAGO_CENTAVOS } = vi.hoisted(() => {
  const base = {
    slug: "morro-de-teste",
    modos: ["contemplativo"],
    rotulo_escaneio: "MORRO",
    promessa: "Um morro inventado só pra este teste.",
    voz: "Sobe cedo.",
    premio: "A vista.",
    trajeto: {
      waypoints: [{ nome: "Morro de Teste", lat: -8.4, lng: -36.2, nota: "o portão" }],
    },
    acesso: "De carro.",
    avisos: "Leve água.",
    condicao: {
      coords: { lat: -8.4, lng: -36.2 },
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
  };
  return {
    SEM_FATOS: { ...base, slug: "morro-sem-fatos" },
    SO_PISO: { ...base, slug: "morro-so-piso", piso: "asfalto-esburacado" },
    // 🔴 Paga e SEM `custo.curto`, e os dois detalhes são load-bearing: o preço
    // não é "R$ 5" (a Rampa é), e a cobrança não é num portão. É a única
    // fixture capaz de separar "o chip vem da ficha" de "o chip é montado no
    // código" — com uma paga que tivesse curto, as duas versões coincidiriam.
    PAGO_SEM_CURTO: {
      ...base,
      slug: "morro-pago-sem-curto",
      custo: { tag: "pago" as const, valor: "R$ 9 por carro · na guarita da fazenda" },
    },
    // 🔴 CENTAVOS, e eles são o ponto desta fixture. Medido em 2026-08-27 com
    // uma ficha de ensaio: o recorte do preço parava no primeiro grupo de
    // dígitos e o chip anunciava `R$ 12` num lugar que cobra `R$ 12,50` — o app
    // errando pra MENOS em dinheiro. A única ficha paga do acervo cobra R$ 5
    // redondos, e por isso ninguém tinha visto.
    PAGO_CENTAVOS: {
      ...base,
      slug: "morro-pago-centavos",
      custo: { tag: "pago" as const, valor: "R$ 12,50 por carro · na guarita" },
    },
  };
});

// Só os slugs sintéticos são interceptados: "rampa-do-pepe" continua saindo do
// JSON de verdade, senão o teste que fala de produção viraria decoração.
vi.mock("@/lib/ficha", async (real) => {
  const mod = await real<typeof import("@/lib/ficha")>();
  const sinteticas = [SEM_FATOS, SO_PISO, PAGO_SEM_CURTO, PAGO_CENTAVOS] as unknown as TipoFicha[];
  return {
    ...mod,
    getFicha: (slug: string) => sinteticas.find((f) => f.slug === slug) ?? mod.getFicha(slug),
  };
});

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getFicha, getAllFichas } = await import("@/lib/ficha");
const Ficha = (await import("@/app/[slug]/page")).default;

/** Abre a página da ficha DE VERDADE (o server component de [slug]/page.tsx),
 *  sem embrulhar nada à mão — é o ponto de uso, não um componente vizinho. */
async function abrir(slug: string, estado: "fresco" | "frio" = "fresco") {
  vi.mocked(resolverEstado).mockResolvedValue({
    estado,
    erro: false,
    calculadoEm: Math.floor(Date.now() / 1000),
  });
  return render(
    await Ficha({
      params: Promise.resolve({ slug }),
      searchParams: Promise.resolve({}),
    }),
  );
}

/** O bloco 📍 Trajeto. Os três blocos da ficha são `<div className="sec">`
 *  idênticos — sem o `data-bloco` não existe âncora, e "dentro do Trajeto"
 *  viraria "existe em algum lugar da página". */
function blocoTrajeto(container: HTMLElement): HTMLElement {
  const bloco = container.querySelector<HTMLElement>('[data-bloco="trajeto"]');
  expect(bloco, "o bloco Trajeto perdeu a identidade endereçável").not.toBeNull();
  return bloco!;
}

/** 🔴 A âncora das asserções de posição é o `.wp-body`, e não o bloco inteiro,
 *  porque é a MESMA cadeia que o CSS declara: `.bp .wp-body .fatos`
 *  (`ficha.css`). Escopar pelo bloco é grosso demais — MEDIDO: com a linha
 *  virando irmã do `.waypoint` (fora do `.wp-body`, ainda dentro do
 *  `[data-bloco="trajeto"]`) a suíte fechava 631/631 verde e o seletor do CSS
 *  deixava de casar, deixando a linha sem estilo nenhum na tela.
 *
 *  Isso não é aparência (essa metade continua sem prova, de propósito, e vai
 *  no iPhone): é a precondição estrutural pra QUALQUER regra se aplicar, e o
 *  jsdom responde isso com um `querySelector`. */
function corpoDoWaypoint(container: HTMLElement): HTMLElement {
  const corpo = blocoTrajeto(container).querySelector<HTMLElement>(".wp-body");
  expect(corpo, "o .wp-body sumiu de dentro do bloco Trajeto").not.toBeNull();
  return corpo!;
}

// Mesma trilha e mesmas coordenadas de tests/app/DistanciaDaqui.test.tsx —
// content/fichas/rampa-do-pepe.json, waypoint (-7.907889, -36.019222). Um
// grau de latitude ao norte ≈ 111 km, que é o que o teste abaixo espera ler.
const RAMPA = { lat: -7.907889, lng: -36.019222 };

afterEach(() => {
  cleanup();
  vi.mocked(resolverEstado).mockReset();
  localStorage.clear();
});

// tests/app/home.test.tsx tem o par desta prova pra home (linha ~190) — o
// comentário lá explica a razão inteira: os testes de
// tests/app/DistanciaDaqui.test.tsx embrulham <DistanciaDaqui> num
// <LocalVivo> na mão, então continuariam verdes mesmo se [slug]/page.tsx
// esquecesse o <LocalVivo> — e o botão "A que distância estou?" morreria em
// produção sem que a suíte notasse. Este é o ponto de uso de verdade:
// renderiza a página da ficha de verdade, sem embrulhar nada à mão.
describe("a ficha de verdade", () => {
  it("embrulha a distância no LocalVivo: com localização salva, a página já mostra o km sem ninguém embrulhar na mão", async () => {
    vi.mocked(resolverEstado).mockResolvedValue({
      estado: "fresco",
      erro: false,
      calculadoEm: Math.floor(Date.now() / 1000),
    });
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido",
      coord: { lat: RAMPA.lat + 1, lng: RAMPA.lng },
      em: 1_800_000_000,
      nome: "Lugar Fictício",
      regiao: "Pernambuco",
    }));

    const { findByText, queryByRole } = render(
      await Ficha({
        params: Promise.resolve({ slug: "rampa-do-pepe" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(await findByText(/~111 km em linha reta daqui/)).toBeTruthy();
    // Sem <LocalVivo>, useLocal() fora de provedor devolve "não sei" pra
    // sempre — o botão nunca sairia de tela, mesmo com localStorage cheio.
    expect(queryByRole("button", { name: /dist[âa]ncia/i })).toBe(null);
  });
});

// 🔴 A DIREÇÃO DA ALIMENTAÇÃO — a lição do componente controlado, aplicada ao
// campo novo. `tests/app/Carimbo.test.tsx` prova que o carimbo OBEDECE à prop
// `secaRapido`; nada lá provaria que `[slug]/page.tsx` a ENTREGA. Com
// `secaRapido={undefined}` na página, toda aquela suíte fica verde e a linha
// verde do app perde a explicação em produção — que é o defeito de 2026-08-26
// só que mudo em vez de mentiroso.
describe("a frase de relevo atravessa da ficha até a tela", () => {
  it("a página entrega ao carimbo o que a ficha REAL diz", async () => {
    const f = getFicha("rampa-do-pepe")!;
    expect(f.secaRapido, "a Rampa perdeu a frase dela — este teste ficaria oco").toBeTruthy();
    const { container } = await abrir("rampa-do-pepe");
    // Montada a partir da própria ficha: ele pode reescrever a frase (e as
    // janelas de chuva) sem que o teste vire manutenção.
    expect(container.querySelector(".reason")?.textContent).toBe(
      `Sem chuva nas últimas ~${f.condicao.regra.janela_passado_horas}h e nada previsto pras ` +
        `próximas ~${f.condicao.regra.janela_previsao_horas}h. ${f.secaRapido}`,
    );
  });

  // O par ortogonal, e ele não é redundante com o de cima: `secaRapido="Área
  // alta, escorre rápido — a serra firmou."` escrito à mão na página passaria
  // no teste da Rampa (é a frase dela) e SÓ CAI aqui. Medido.
  it("ficha sem a frase: a página não põe nenhuma no lugar", async () => {
    // A fixture sintética não traz o campo — conferido aqui, e não assumido,
    // pra o dia em que alguém o acrescentar a ela não deixar este teste
    // passando por outro motivo que não o testado.
    expect((SEM_FATOS as TipoFicha).secaRapido).toBeUndefined();
    const { container } = await abrir("morro-sem-fatos");
    const texto = container.querySelector(".reason")?.textContent;
    expect(texto).toBeTruthy();
    expect(texto).toMatch(/nada previsto pras próximas ~\d+h\.$/);
  });
});

// 🔴 A MESMA DIREÇÃO DA ALIMENTAÇÃO, pro campo do ramo MOLHADO (2026-08-27).
// `tests/app/Carimbo.test.tsx` prova que o carimbo obedece à prop `piso`; nada
// lá provaria que `[slug]/page.tsx` a ENTREGA. Com `piso={undefined}` na página
// toda aquela suíte fica verde e a linha vermelha perde a explicação em
// produção — mudo em vez de mentiroso, que é o mesmo defeito de ontem.
// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27). O chip do topo era
// montado aqui como `${preço} · portão`, com o "portão" ESCRITO À MÃO — verdade
// na Rampa, invenção em qualquer trilha paga que cobre numa guarita, por Pix ou
// com alguém na estrada. E o caminho página→Appbar não tinha teste NENHUM: o
// `Appbar.test.tsx` passa a string pronta, então nada olhava de onde ela vinha.
// Decisão dele: *"tem que ser algo personalizável, nem tudo tem o mesmo valor e
// mesma forma"*.
describe("o chip do custo vem da FICHA, não do código", () => {
  const chip = (c: HTMLElement) => c.querySelector(".cost-chip")?.textContent;

  it("a página entrega o que a ficha REAL diz — a palavra dela, não a minha", async () => {
    const f = getFicha("rampa-do-pepe")!;
    expect(f.custo.curto, "a Rampa perdeu o chip — este teste ficaria oco").toBeTruthy();
    const { container } = await abrir("rampa-do-pepe");
    expect(chip(container)).toBe(f.custo.curto);
  });

  // 🔴 ESTE É O TESTE DA RODADA. Com a Rampa sozinha, "chip da ficha" e "chip
  // montado no código" davam a MESMA string — ela cobra R$ 5 num portão. Só uma
  // ficha paga que cobra de OUTRO jeito separa as duas versões.
  it("ficha paga sem o campo mostra só o preço — o app não inventa onde se paga", async () => {
    expect((PAGO_SEM_CURTO as TipoFicha).custo.curto).toBeUndefined();
    const { container } = await abrir("morro-pago-sem-curto");
    expect(chip(container)).toBe("R$ 9");
  });

  it("o preço com centavos não é cortado — o chip não pode cobrar menos", async () => {
    const { container } = await abrir("morro-pago-centavos");
    expect(chip(container)).toBe("R$ 12,50");
  });

  it("ficha grátis não tem chip nenhum", async () => {
    const { container } = await abrir("morro-sem-fatos");
    expect(container.querySelector(".cost-chip")).toBeNull();
  });

  // PROVA DE FONTE: enquanto a Rampa for a única paga do acervo, a versão certa
  // e a versão com o "portão" de volta pintam a MESMA tela. Só a fonte separa.
  it("nenhum lugar de cobrança escrito à mão na página", async () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "[slug]", "page.tsx"), "utf8");
    const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(codigo, "a tira de comentários comeu o código").toContain("chipCusto");
    expect(codigo, "o portão voltou pro código").not.toMatch(/portão/i);
  });
});

// 🔴 A DIREÇÃO DA ALIMENTAÇÃO, pro campo do horário (2026-08-27). O
// `Carimbo.test.tsx` prova que o carimbo OBEDECE à prop `horario`; nada lá
// provaria que `[slug]/page.tsx` a ENTREGA. Com `horario={undefined}` na
// página, toda aquela suíte fica verde e a ficha volta a dizer "Pode ir" às 18h
// em produção — o defeito inteiro de volta, com os testes passando.
describe("o horário atravessa da ficha até o carimbo", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2027, 0, 15, 21, 0)); }); // 18h Recife
  afterEach(() => { vi.useRealTimers(); });

  it("às 18h, a ficha REAL que fecha às 17h diz que está fechada", async () => {
    const f = getFicha("pedra-furada-de-venturosa")!;
    expect(f.horario, "a Pedra Furada perdeu o horário — este teste ficaria oco").toBeTruthy();
    const { container } = await abrir("pedra-furada-de-venturosa");
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    // Montada a partir da própria ficha: ele pode mudar o horário sem que o
    // teste vire manutenção.
    expect(container.querySelector(".reason")?.textContent).toBe(
      `Fecha às ${Number(f.horario!.fecha.slice(0, 2))}h, abre às ${Number(f.horario!.abre.slice(0, 2))}h.`,
    );
  });

  // 🔴 O PAR QUE PROTEGE A RAMPA, e ele não é redundante: com `horario` cravado
  // à mão na página, o teste de cima passaria (é o horário da Pedra Furada) e
  // SÓ CAI aqui — a Rampa passaria a fechar num horário que ninguém deu.
  it("a ficha REAL sem horário continua decidindo só pela chuva, às 18h", async () => {
    const f = getFicha("rampa-do-pepe")!;
    expect(f.horario, "a Rampa ganhou horário — este par perdeu o sentido").toBeUndefined();
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".mark")?.textContent).not.toBe("Fechado agora");
  });
});

describe("o piso atravessa da ficha até a linha molhada do carimbo", () => {
  it("a página entrega ao carimbo o piso da ficha REAL", async () => {
    const f = getFicha("rampa-do-pepe")!;
    expect(f.piso, "a Rampa perdeu o piso — este teste ficaria oco").toBe("barro");
    const { container } = await abrir("rampa-do-pepe", "frio");
    // Montada a partir da própria ficha, como a irmã de cima: as janelas de
    // chuva podem mudar sem que o teste vire manutenção.
    expect(container.querySelector(".reason")?.textContent).toBe(
      `Choveu nas últimas ~${f.condicao.regra.janela_passado_horas}h (ou vem chuva nas ` +
        `próximas ~${f.condicao.regra.janela_previsao_horas}h). O barro segura água — risco de atolar.`,
    );
  });

  // O par ortogonal: `piso="barro"` escrito à mão na página passaria no teste
  // de cima (é o piso da Rampa) e SÓ CAI aqui.
  it("ficha sem piso: a página não põe nenhum no lugar", async () => {
    expect((SEM_FATOS as TipoFicha).piso).toBeUndefined();
    const { container } = await abrir("morro-sem-fatos", "frio");
    const texto = container.querySelector(".reason")?.textContent;
    expect(texto).toBeTruthy();
    expect(texto).toMatch(/próximas ~\d+h\)\.$/);
  });
});

describe("o piso no bloco Trajeto (a extensão saiu da tela na Task 6, e do modelo na Task 7)", () => {
  // 🔴 O teste "a ficha não mostra mais km de trilha, mesmo com o campo
  // presente" morreu aqui (Task 7, 2026-08-23), com a fixture `COM_FATOS` que
  // só ele usava. Ele provava "a tela parou de mostrar" (campo presente)
  // contra "o dado sumiu" (campo ausente) — distinção que só faz sentido
  // enquanto o campo existe pra estar presente ou ausente. Sem `extensaoKm`
  // no schema, `COM_FATOS` (piso + extensaoKm) e `SO_PISO` (só piso) ficaram
  // EQUIVALENTES pra este teste — só o `slug` os distingue, e nada aqui lê ou
  // compara essa string —, e o teste duplicava exatamente o de baixo ("com
  // piso, a linha mostra o piso e nada mais"). Preservar as duas seria um
  // teste redundante fingindo provar algo que não existe mais.

  // Ausência de TEXTO mascara o sumiço do elemento: `?.textContent ?? ""`
  // devolve a mesma string vazia com o span presente-e-vazio e com ele
  // ausente. Aqui o que se prova é que a extensão não está mais na linha, com
  // o elemento PRESENTE — por isso o `toBe` da linha inteira, e não um
  // `not.toContain`.
  it("ficha sem piso não mostra linha vazia nem separador solto", async () => {
    const { container } = await abrir(SEM_FATOS.slug);
    // Escopado pelo bloco, como o teste da Rampa aqui embaixo — a pergunta é
    // sobre o Trajeto, não sobre a página inteira.
    expect(blocoTrajeto(container).querySelector(".fatos")).toBeNull();
    expect(container.textContent).not.toContain("undefined");
  });

  it("com piso, a linha mostra o piso e nada mais", async () => {
    const { container } = await abrir(SO_PISO.slug);
    const fatos = within(corpoDoWaypoint(container)).getByText(/asfalto/);
    expect(fatos.textContent).toBe("asfalto esburacado");
  });

  // O teste que fala de PRODUÇÃO: a Rampa vem do JSON de verdade (o mock
  // acima só intercepta os slugs sintéticos), que desde 2026-08-23 (Task 8)
  // traz `piso: "barro"` — dado do João, sustentado pela ficha real em três
  // lugares. Fixture sintética não provaria isso.
  it("a Rampa real abre e mostra o piso no Trajeto", async () => {
    const rampa = getFicha("rampa-do-pepe");
    expect(rampa?.piso).toBe("barro");

    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector("h1")?.textContent).toBe("Rampa do Pepê");
    const fatos = blocoTrajeto(container).querySelector(".fatos");
    expect(fatos, "a linha de fatos sumiu do bloco Trajeto").not.toBeNull();
    expect(fatos!.textContent).toBe("barro");
  });

  // A OUTRA metade do par seletor↔DOM: o teste de posição acima prende o DOM
  // debaixo da cadeia que o CSS declara; este prende a cadeia a existir. Sem
  // ele, apagar a regra do `ficha.css` deixa a suíte verde e a linha perde
  // estilo inteiro na tela.
  //
  // 🔴 Só a EXISTÊNCIA, nunca os valores. `font-size`/`color`/`margin-top`
  // aqui são decoração: cravá-los num `toBe` compraria churn de design sem
  // segurança nenhuma, e continuaria sem responder a única pergunta que
  // importa de verdade — como a linha fica no celular. Essa metade não tem
  // prova nesta camada, de propósito, e vai junto na conferência do iPhone.
  //
  // 🔴 O QUE O PAR COBRE, e o que ele deliberadamente NÃO cobre — os dois
  // testes parecem a mesma prova e não são. Juntos, eles prendem o DOM à
  // cadeia (o de posição) e a cadeia a existir (este). O que fica de fora é o
  // rename CONSISTENTE, no JSX e no CSS juntos: ali nada observável muda — a
  // estrutura é a mesma, a regra casa, a tela é idêntica —, então um teste que
  // caísse aí estaria provando a ESCOLHA DO NOME, e nome de classe não é
  // comportamento; travá-lo cobraria pedágio de toda renomeação futura sem
  // comprar segurança. Não "complete" o par com uma asserção de nome de
  // classe. Como a linha fica na tela segue sem prova nesta camada — vai no
  // iPhone.
  it("a regra do .fatos existe no ficha.css, na mesma cadeia que o DOM monta", () => {
    const seletor = ".bp .wp-body .fatos";
    expect(
      regraDe(semComentarios("ficha.css"), seletor),
      `faltou a regra ${seletor} no ficha.css`,
    ).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 AS DUAS FRASES DE CHROME QUE FALAVAM DE UM LUGAR SÓ (2026-09-09)
//
// Os dois defeitos são o mesmo de sempre — texto FIXO afirmando coisa sobre UM
// lugar, num componente que serve TODOS —, e os dois escaparam da varredura de
// 03/09 pelo mesmo motivo: eu procurei material e relevo (barro, portão, subir,
// serra) e não procurei nem REGIÃO nem ONDE SE CHECA.
//
//  1. `Na entrada — a checagem é sua`: verdade na Rampa (é a entrada que
//     decide), falsa na Véu de Noiva, onde o que decide é o trecho de terra
//     ANTES — a própria ficha diz "Confirme no caminho".
//  2. `BatePerna · Agreste · PE`: as duas primeiras fichas são do Agreste;
//     Bonito é BREJO ("bonito é brejo", palavra dele, 2026-09-09).
//
// ⚠️ ESTES TESTES VARREM O ACERVO INTEIRO, nunca uma lista de slugs — é a
// lição medida em `tests/lib/coerencia-acervo.test.ts`: 14 das 19 mutações
// sobreviveram a 751/751 porque toda prova de conteúdo estava endereçada por
// slug escrito à mão, e a ficha nova não aparecia em teste nenhum.
// ═══════════════════════════════════════════════════════════════════════════
describe("o chrome da ficha parou de falar de UM lugar", () => {
  const acervo = getAllFichas();
  const titulo = (c: HTMLElement) => c.querySelector(".gate .k")?.textContent ?? "";
  const rodape = (c: HTMLElement) => c.querySelector(".foot")?.textContent ?? "";

  // 🔴 NÃO-VACUIDADE: todo teste abaixo é um laço sobre `acervo`. Com o acervo
  // vazio os três passariam sem provar nada. O número é cravado à mão e cresce
  // com o acervo, de propósito — `acervo.length` contra si mesmo é a asserção
  // escrita contra a própria fonte, cega ao número (a lição do tripwire do
  // mapa, em tests/app/MapaHome.test.tsx).
  it("o acervo tem fichas pra varrer — sem isto os laços abaixo passam vazios", () => {
    expect(acervo.length, "o acervo sumiu: os guardas deste bloco ficariam ocos")
      .toBeGreaterThanOrEqual(3);
  });

  it("o título da checagem começa pelo `discriminador.formato` DA FICHA ABERTA", async () => {
    for (const f of acervo) {
      cleanup();
      const { container } = await abrir(f.slug);
      const t = titulo(container);
      // `startsWith`, e não `contains`: `Na entrada — a checagem é sua` CONTÉM
      // "entrada", então um `contains` deixaria o texto fixo velho passar na
      // ficha da Rampa. Começar pelo campo é o que separa ler da ficha de
      // repetir a palavra por coincidência.
      expect(
        t.toLowerCase().startsWith(f.discriminador.formato.trim().toLowerCase()),
        `[${f.slug}] o título da checagem ("${t}") não começa pelo formato da ficha ` +
          `("${f.discriminador.formato}") — a tela voltou a supor onde se checa`,
      ).toBe(true);
      // A outra metade continua sendo do app, e é o que dá sentido à frase.
      expect(t.endsWith("a checagem é sua"), `[${f.slug}] a metade do app sumiu do título`).toBe(true);
    }
  });

  // 🔴 O PAR ORTOGONAL, e ele não é redundante: o teste de cima passaria com o
  // título CONSTANTE se todas as fichas tivessem o mesmo `formato`. Este
  // prende a variação — títulos diferentes onde os formatos diferem —, que é a
  // única coisa que prova que a tela lê a ficha em vez de repetir uma palavra.
  // MEDIDO: hoje o acervo tem "entrada", "estrada" e "trecho de terra".
  it("fichas com formatos diferentes mostram títulos diferentes", async () => {
    const formatos = new Set(acervo.map((f) => f.discriminador.formato.trim().toLowerCase()));
    expect(
      formatos.size,
      "todas as fichas têm o mesmo `formato`: este teste ficou oco, e o de cima também",
    ).toBeGreaterThan(1);

    const titulos = new Set<string>();
    for (const f of acervo) {
      cleanup();
      const { container } = await abrir(f.slug);
      titulos.add(titulo(container).toLowerCase());
    }
    expect(titulos.size, "o título da checagem não varia com a ficha — está fixo no código")
      .toBe(formatos.size);
  });

  // 🔴 A ASSERÇÃO É ESTRUTURAL, não a cópia da string: o rodapé tem DUAS
  // metades separadas por "·", e a do meio — a região — é onde a afirmação
  // morava. Assim o guarda mata "Agreste" de volta E qualquer outra região
  // reinserida ("Brejo", "Sertão"), sem eu precisar listar regiões — listar
  // seria eu afirmando que conheço as do estado dele.
  //
  // ⚠️ O QUE ESTE TESTE NÃO COBRE, e está declarado de propósito: o "PE" ainda
  // é fixo. Todas as três fichas são de Pernambuco hoje, então a frase é
  // verdadeira por CONTEÚDO, não por desenho — é a próxima mentira agendada,
  // e ela dispara no dia em que entrar uma ficha de outro estado. Um teste que
  // soubesse o estado de cada ficha seria geografia inventada com roupa de
  // prova: não existe campo de estado, e inventar um é decisão dele.
  it("o rodapé não afirma região nenhuma — em ficha nenhuma", async () => {
    for (const f of acervo) {
      cleanup();
      const { container } = await abrir(f.slug);
      const r = rodape(container);
      expect(r, `[${f.slug}] o rodapé sumiu — a ausência de texto não é a prova procurada`)
        .toBeTruthy();
      expect(
        r.split("·").length,
        `[${f.slug}] o rodapé ("${r}") voltou a ter três metades: a do meio é uma região ` +
          `afirmada sobre TODAS as fichas`,
      ).toBe(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 L3 / REQ-12 — A PROCEDÊNCIA POR CONTRASTE (2026-09-09)
//
// A régua é do modelo, não minha: **o Nível B brilha, o Nível A é texto plano,
// SEM ETIQUETA SIMÉTRICA**. Nível A = o que o mapa e o feed de chuva entregam
// iguais pra qualquer um; Nível B = o que só sabe quem foi.
//
// Ele escolheu o tratamento "a tinta" entre três (2026-09-09): a tipografia
// carrega o contraste, e **nenhuma palavra nova entra na tela** — foi por isso
// que ele adiou o tratamento da assinatura ("1 agora, 3 depois").
//
// ⚠️ O QUE ESTES TESTES NÃO PROVAM, e está declarado: como a tela FICA. Serif
// contra sans em 375px é olho, e vai no iPhone. O que eles travam é a
// classificação (quem é B) e a cadeia CSS que a pinta — as duas coisas que
// somem em silêncio.
// ═══════════════════════════════════════════════════════════════════════════
describe("Nível B brilha, Nível A fica plano", () => {
  const acervo = getAllFichas();
  const b = (c: HTMLElement, sel: string) =>
    c.querySelector<HTMLElement>(sel)?.getAttribute("data-nivel");

  it("o acervo tem fichas pra varrer — sem isto os laços abaixo passam vazios", () => {
    expect(acervo.length, "o acervo sumiu: os guardas deste bloco ficariam ocos")
      .toBeGreaterThanOrEqual(3);
  });

  it("todo campo que só quem foi sabe está marcado — em TODAS as fichas", async () => {
    for (const f of acervo) {
      cleanup();
      const { container } = await abrir(f.slug);
      const eu = `[${f.slug}]`;

      expect(b(container, ".sec.premio"), `${eu} o prêmio perdeu a marca`).toBe("b");
      expect(b(container, ".voz"), `${eu} a voz perdeu a marca`).toBe("b");
      expect(b(container, ".gate"), `${eu} o bloco de checagem perdeu a marca`).toBe("b");

      // Acesso e Avisos endereçados pela ESTRUTURA (as duas `.sec` que contêm
      // uma `.note`), não pelo texto do rótulo: casar "🚗 Acesso" prenderia o
      // teste a uma palavra de tela.
      const comNota = [...container.querySelectorAll<HTMLElement>(".sec")]
        .filter((s) => s.querySelector(".note"));
      expect(comNota.length, `${eu} acesso/avisos sumiram — o laço abaixo ficaria oco`).toBe(2);
      for (const sec of comNota) {
        expect(sec.getAttribute("data-nivel"), `${eu} uma seção de nota perdeu a marca`).toBe("b");
      }

      // As folhas do bloco MISTO. A condição é lida da FICHA, então uma ficha
      // que perdesse o dado não faz o teste passar por ausência: ele deixa de
      // perguntar junto com o app.
      if (f.trajeto.waypoints[0].nota) {
        expect(b(container, ".wp-body .n"), `${eu} a nota do waypoint perdeu a marca`).toBe("b");
      }
      if (f.piso) {
        expect(b(container, ".wp-body .fatos"), `${eu} o piso perdeu a marca`).toBe("b");
      }
    }
  });

  // 🔴 A ASSIMETRIA É O DESENHO INTEIRO, e este é o teste que a trava.
  // "Sem etiqueta simétrica" não é economia de markup: marcar os dois lados
  // faria a coordenada parecer uma credencial, quando o que precisa chamar
  // atenção é justamente o que o mapa NÃO dá.
  it("o Nível A não recebe etiqueta nenhuma — nem no markup, nem no CSS", async () => {
    for (const f of acervo) {
      cleanup();
      const { container } = await abrir(f.slug);
      const eu = `[${f.slug}]`;

      expect(
        container.querySelectorAll('[data-nivel="a"]').length,
        `${eu} apareceu etiqueta de Nível A: a decisão L3 recusa o par simétrico`,
      ).toBe(0);

      // A coordenada é o caso-teste do A: é o que o OSM dá igual pra qualquer
      // um, e mora DENTRO do bloco misto, ao lado de duas folhas B.
      const coord = container.querySelector<HTMLElement>(".wp-body .coord");
      expect(coord, `${eu} a coordenada sumiu — a asserção abaixo ficaria vazia`).not.toBeNull();
      expect(coord!.hasAttribute("data-nivel"), `${eu} a coordenada foi marcada`).toBe(false);

      // 🔴 E o bloco Trajeto INTEIRO não pode ser marcado: ele é misto, e uma
      // marca nele derramaria o brilho sobre a coordenada — o oposto exato da
      // decisão. É a mutação mais provável de todas (marcar o bloco é mais
      // fácil que marcar as folhas) e a que nenhum outro teste aqui pegaria.
      const trajeto = container.querySelector<HTMLElement>('[data-bloco="trajeto"]');
      expect(trajeto!.hasAttribute("data-nivel"), `${eu} o bloco misto do Trajeto foi marcado`)
        .toBe(false);

      // A ressalva do proxy: decisão dele (2026-09-09, "ressalva fica"). Não é
      // A nem B — é o app admitindo que o Nível A dele falha — e já tem o
      // destaque azul só dela.
      const caveat = container.querySelector<HTMLElement>(".caveat");
      expect(caveat, `${eu} a ressalva sumiu da ficha`).not.toBeNull();
      expect(caveat!.hasAttribute("data-nivel"), `${eu} a ressalva foi classificada`).toBe(false);
    }
  });

  // A outra metade do par DOM↔CSS, no mesmo molde do `.fatos` mais acima: o
  // teste de cima prende a marca no markup, este prende a cadeia que a pinta.
  // Sem ele, apagar a regra do ficha.css deixa a suíte verde e o B para de
  // brilhar na tela — o defeito inteiro de volta, mudo.
  it("a regra que pinta o B existe no ficha.css, e é o serif", () => {
    const css = semComentarios("ficha.css");
    const regra = regraDe(css, '.bp .sec[data-nivel="b"] p');
    expect(regra, "faltou a regra do Nível B no ficha.css").not.toBeNull();
    expect(valorDe(regra![0], "font-family")).toBe("var(--serif)");
    expect(valorDe(regra![0], "color")).toBe("var(--ink)");

    // 🔴 E NÃO PODE EXISTIR REGRA PRO A. Mesma decisão do teste de markup, na
    // outra camada: uma regra de Nível A, mesmo uma que só apagasse, é a
    // etiqueta simétrica entrando pelo CSS.
    expect(
      regraDe(css, '[data-nivel="a"]'),
      "apareceu regra de Nível A no ficha.css: a decisão L3 recusa o par simétrico",
    ).toBeNull();
  });

  // 🔴 O TESTE DA ORDEM — a fresta que ESTE tratamento criou, e que nada mais
  // pega. A regra nova empata em especificidade (0,3,1) com `.bp .sec.premio p`,
  // que já existia; empate quem ganha é a ORDEM no arquivo. Mover o bloco novo
  // pra cima do `.premio` — coisa que qualquer arrumação de CSS faz sem pensar —
  // faz o prêmio parar de brilhar, e a única diferença na tela é um `font-size`.
  it("a regra do B vem DEPOIS da regra do prêmio — o empate é resolvido pela ordem", () => {
    const css = semComentarios("ficha.css");
    const iPremio = css.indexOf(".bp .sec.premio p");
    const iNivel = css.indexOf('.bp .sec[data-nivel="b"] p');
    expect(iPremio, "sumiu a regra .bp .sec.premio p: este teste ficaria oco").toBeGreaterThan(-1);
    expect(iNivel, "sumiu a regra do Nível B: este teste ficaria oco").toBeGreaterThan(-1);
    expect(
      iNivel,
      "a regra do Nível B subiu pra ANTES do .premio — empate de especificidade, e o prêmio " +
        "para de brilhar sem nada ficar vermelho por si só",
    ).toBeGreaterThan(iPremio);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 O HORÁRIO GANHOU LUGAR NA TELA — e ele e o preço viraram Nível B
// (decisão dele, 2026-09-09: "preço e horário brilham").
//
// Até aqui o horário só aparecia com o lugar FECHADO. Quem abrisse a ficha às
// 10h nunca ficava sabendo que fecha às 17h: o dado estava na ficha e mudo na
// tela — e numa viagem de 120 km é ele que decide a ida.
// ═══════════════════════════════════════════════════════════════════════════
describe("o tíquete: preço e horário, cada um calando sozinho", () => {
  const acervo = getAllFichas();
  const tk = (c: HTMLElement) => c.querySelector<HTMLElement>(".ticket");

  // 🔴 AS TRÊS COMBINAÇÕES SAEM DO ACERVO REAL, e nenhuma ficha sintética foi
  // precisa: a Rampa é paga SEM horário, a Pedra Furada é grátis COM horário, e
  // a cachoeira tem os dois. Procuradas por PROPRIEDADE, nunca por slug escrito
  // à mão — se um dia o acervo perder uma das combinações, o teste fica
  // vermelho dizendo que o guarda ficou oco, em vez de passar por ausência.
  const soPreco = acervo.find((f) => f.custo.valor && !f.horario);
  const soHora = acervo.find((f) => !f.custo.valor && f.horario);
  const ambos = acervo.find((f) => f.custo.valor && f.horario);

  it("o acervo ainda exerce as três combinações — sem elas os testes abaixo ficam ocos", () => {
    expect(soPreco, "sumiu do acervo a ficha PAGA SEM HORÁRIO").toBeTruthy();
    expect(soHora, "sumiu do acervo a ficha GRÁTIS COM HORÁRIO").toBeTruthy();
    expect(ambos, "sumiu do acervo a ficha com PREÇO E HORÁRIO").toBeTruthy();
  });

  it("ficha paga sem horário: mostra o preço e cala a hora", async () => {
    const { container } = await abrir(soPreco!.slug);
    const linha = tk(container);
    expect(linha, "o tíquete sumiu da ficha paga").not.toBeNull();
    expect(linha!.querySelector(".price")).not.toBeNull();
    expect(
      linha!.querySelector(".hora"),
      "apareceu horário numa ficha que não tem o campo — o app inventou uma hora",
    ).toBeNull();
  });

  // 🔴 ESTE É O TESTE DA RODADA. Antes de hoje o tíquete só era desenhado com
  // `custo.valor`, então esta ficha — grátis, com portão que FECHA ÀS 17h — não
  // mostrava linha nenhuma. O dado estava na ficha desde 2026-08-25 e a tela
  // era muda justamente onde é de graça e ainda assim dá pra chegar tarde e não
  // entrar.
  it("ficha grátis COM horário: o tíquete existe só pela hora", async () => {
    const { container } = await abrir(soHora!.slug);
    const linha = tk(container);
    expect(linha, "ficha grátis com horário voltou a não desenhar o tíquete").not.toBeNull();
    expect(linha!.querySelector(".price"), "apareceu preço numa ficha grátis").toBeNull();
    const hora = linha!.querySelector(".hora")!.textContent!;
    // Derivado à mão, sem chamar `rotuloHora`: asserção escrita com a própria
    // função que produz o texto ficaria cega ao formato mudar.
    expect(hora, "o horário foi pra tela no formato cru do JSON").not.toContain(":");
    expect(hora).toContain(`${Number(soHora!.horario!.abre.split(":")[0])}h`);
    expect(hora).toContain(`${Number(soHora!.horario!.fecha.split(":")[0])}h`);
  });

  it("ficha com os dois: as duas metades na mesma linha, e ela é Nível B", async () => {
    const { container } = await abrir(ambos!.slug);
    const linha = tk(container)!;
    expect(linha.querySelector(".price")).not.toBeNull();
    expect(linha.querySelector(".hora")).not.toBeNull();
    expect(linha.getAttribute("data-nivel"), "o tíquete perdeu a marca de Nível B").toBe("b");
  });

  it("sem preço e sem horário: a linha inteira não é desenhada — o app cala", async () => {
    expect((SEM_FATOS as TipoFicha).custo.valor).toBeUndefined();
    expect((SEM_FATOS as TipoFicha).horario).toBeUndefined();
    const { container } = await abrir("morro-sem-fatos");
    expect(tk(container), "o tíquete foi desenhado vazio numa ficha sem os dois campos").toBeNull();
  });
});
