import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { CHAVE_LOCAL } from "@/lib/local";
import type { Ficha as TipoFicha } from "@/types/ficha";
import { regraDe, semComentarios } from "../css";

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
const { SEM_FATOS, SO_PISO } = vi.hoisted(() => {
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
  };
});

// Só os slugs sintéticos são interceptados: "rampa-do-pepe" continua saindo do
// JSON de verdade, senão o teste que fala de produção viraria decoração.
vi.mock("@/lib/ficha", async (real) => {
  const mod = await real<typeof import("@/lib/ficha")>();
  const sinteticas = [SEM_FATOS, SO_PISO] as unknown as TipoFicha[];
  return {
    ...mod,
    getFicha: (slug: string) => sinteticas.find((f) => f.slug === slug) ?? mod.getFicha(slug),
  };
});

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getFicha } = await import("@/lib/ficha");
const Ficha = (await import("@/app/[slug]/page")).default;

/** Abre a página da ficha DE VERDADE (o server component de [slug]/page.tsx),
 *  sem embrulhar nada à mão — é o ponto de uso, não um componente vizinho. */
async function abrir(slug: string) {
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
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
