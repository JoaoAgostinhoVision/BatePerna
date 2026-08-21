import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { CHAVE_LOCAL } from "@/lib/local";
import type { Ficha as TipoFicha } from "@/types/ficha";
import { regraDe, semComentarios } from "../css";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

// Três fichas sintéticas pros três casos do piso/extensão. Sintéticas porque o
// JSON real (a Rampa) não traz nenhum dos dois campos — com ele só dá pra
// provar AUSÊNCIA, e ausência sem o irmão da presença é meia prova.
//
// Duas escolhas de exemplo aqui são load-bearing, e nenhuma é decorativa:
//
// - `piso: "asfalto-esburacado"`, não "barro": `rotuloPiso("barro")` devolve
//   "barro", e aí chamar a função e mostrar o enum cru dão a MESMA string —
//   nenhuma asserção separaria as duas versões. Com o hífen, separa.
// - `extensaoKm: 4.25`, não 4: `formatarExtensao(4)` e um `${km} km de trilha`
//   escrito à mão dão a mesma string; 4.25 separa, porque a função arredonda
//   pra uma casa e usa VÍRGULA ("4,3") e a cópia à mão mostraria "4.25".
//
// Quem "limpar" esses dois valores deixa a prova oca em silêncio.
const { COM_FATOS, SEM_FATOS, SO_PISO } = vi.hoisted(() => {
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
    COM_FATOS: {
      ...base,
      slug: "morro-com-fatos",
      piso: "asfalto-esburacado",
      extensaoKm: 4.25,
    },
    SEM_FATOS: { ...base, slug: "morro-sem-fatos" },
    SO_PISO: { ...base, slug: "morro-so-piso", piso: "asfalto-esburacado" },
  };
});

// Só os slugs sintéticos são interceptados: "rampa-do-pepe" continua saindo do
// JSON de verdade, senão o teste que fala de produção viraria decoração.
vi.mock("@/lib/ficha", async (real) => {
  const mod = await real<typeof import("@/lib/ficha")>();
  const sinteticas = [COM_FATOS, SEM_FATOS, SO_PISO] as unknown as TipoFicha[];
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

describe("o piso e a extensão no bloco Trajeto", () => {
  // A asserção é POSICIONAL (`within` no corpo do waypoint, que só existe
  // dentro do bloco Trajeto), não de existência: um dado de estrada é uma
  // coisa debaixo do 📍 Trajeto e outra debaixo do 🚗 Acesso ou do ⚠ Avisos.
  // Movida a linha pro bloco vizinho, o texto continua na página e este teste
  // tem que cair mesmo assim — e cai também se ela só escorregar pra fora do
  // `.wp-body` (ver `corpoDoWaypoint`).
  //
  // E é a LINHA INTEIRA (`toBe`), não `toContain`: só assim ela prova de uma
  // vez a ordem (extensão · piso), o formato de cada um e a ausência de
  // separador solto.
  it("ficha com piso e extensão mostra os dois dentro do bloco Trajeto", async () => {
    const { container } = await abrir(COM_FATOS.slug);
    const fatos = within(corpoDoWaypoint(container)).getByText(/km de trilha/);
    expect(fatos.textContent).toBe("4,3 km de trilha · asfalto esburacado");
  });

  // O irmão de ausência do teste acima. `toBeNull` no ELEMENTO, e não um
  // `not.toContain` no texto: um teste de ausência de texto passa também
  // quando o elemento existe e está vazio — que é exatamente o defeito aqui
  // (uma linha em branco no meio do bloco).
  it("ficha sem os dois não mostra linha vazia nem separador solto", async () => {
    const { container } = await abrir(SEM_FATOS.slug);
    // Escopado pelo bloco, como o teste da Rampa aqui embaixo — a pergunta é
    // sobre o Trajeto, não sobre a página inteira.
    expect(blocoTrajeto(container).querySelector(".fatos")).toBeNull();
    expect(container.textContent).not.toContain("undefined");
  });

  // O caso do meio, que nenhum dos dois acima pega: com um campo só, a linha
  // aparece com o que tem e sem o " · " pendurado.
  it("com só um dos dois, a linha mostra o que tem e nada mais", async () => {
    const { container } = await abrir(SO_PISO.slug);
    const fatos = within(corpoDoWaypoint(container)).getByText(/asfalto/);
    expect(fatos.textContent).toBe("asfalto esburacado");
  });

  // O teste que fala de PRODUÇÃO: a Rampa vem do JSON de verdade (o mock
  // acima só intercepta os slugs sintéticos) e hoje não traz nenhum dos dois
  // campos. Consequência, e não defeito: no celular do João esta rodada não
  // muda uma vírgula da ficha da Rampa. Fixture sintética não provaria isso.
  it("a Rampa real continua abrindo — e, sem os dois campos no JSON, sem a linha", async () => {
    const rampa = getFicha("rampa-do-pepe");
    expect(rampa?.piso).toBeUndefined();
    expect(rampa?.extensaoKm).toBeUndefined();

    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector("h1")?.textContent).toBe("Rampa do Pepê");
    expect(blocoTrajeto(container).querySelector(".fatos")).toBeNull();
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
  it("a regra do .fatos existe no ficha.css, na mesma cadeia que o DOM monta", () => {
    const seletor = ".bp .wp-body .fatos";
    expect(
      regraDe(semComentarios("ficha.css"), seletor),
      `faltou a regra ${seletor} no ficha.css`,
    ).not.toBeNull();
  });
});
