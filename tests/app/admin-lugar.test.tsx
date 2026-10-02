import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import type { Client } from "@libsql/client";
import { bancoVazio, semearAcervo } from "../banco";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// 🔴 A página é um Server Component (usa `cookies()` de next/headers e
// `notFound()` de next/navigation) — mesmo molde de
// `tests/app/admin-page.test.tsx`, que já mocka os dois pra poder importar a
// página fora do runtime do Next.
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();

vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

function semCookie() {
  cookiesFalso.mockResolvedValue({ get: () => undefined });
}

describe("/admin/[slug] — painel desligado", () => {
  beforeEach(() => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  // 🔴 M3 do plano de mutação: pôr a guarda de sessão ANTES da de config
  // tem que morrer aqui. Sem cookie e sem ADMIN_SENHA, o mutante ainda cairia
  // no ramo "sem sessão" e devolveria a caixa de senha — nunca o 404 que a
  // spec exige (painel desligado NÃO ANUNCIA que existe).
  it("com o painel desligado (env vazio), a página CHAMA notFound() mesmo com um slug qualquer", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "qualquer-coisa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundFalso).toHaveBeenCalledTimes(1);
  });

  it("com ADMIN_SENHA curta, a página continua 404 — e avisa o motivo no log, uma vez", async () => {
    vi.stubEnv("ADMIN_SENHA", "curta");
    vi.stubEnv("ADMIN_SEGREDO", "x");
    semCookie();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "qualquer-coisa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// 🔴 O DUBLÊ DO BANCO É PARCIAL, mesmo molde de `admin-page.test.tsx`: a
// página lê o acervo do BANCO (`getFicha` é `async`), então precisa do
// `versoesAtuais` de verdade — só `avisoVigente`/`getClient` são dublados.
let cliente: Client;
vi.mock("@/lib/db", async (real) => {
  const mod = await real<typeof import("@/lib/db")>();
  return {
    ...mod,
    avisoVigente: vi.fn(),
    getClient: vi.fn(() => cliente),
    // 🔴 I2 da revisão final: por padrão DELEGA pro `historico` de verdade
    // (é o que a página usa pra montar o histórico real do lugar), mas fica
    // dublável por teste — é o mesmo molde do `avisoVigente`, só que este
    // aqui tem comportamento default em vez de mock cego.
    historico: vi.fn(mod.historico),
  };
});
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

describe("/admin/[slug] — a porta e o conteúdo", () => {
  const SENHA = "s".repeat(24);
  const SEGREDO = "segredo-de-assinatura-do-teste-lugar";

  beforeEach(async () => {
    notFoundFalso.mockClear();
    cookiesFalso.mockReset();
    vi.unstubAllEnvs();
    cliente = bancoVazio();
    await semearAcervo(cliente);
    vi.stubEnv("ADMIN_SENHA", SENHA);
    vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
    vi.resetModules();
    const { resolverEstado } = await import("@/lib/carimbo-estado");
    const { avisoVigente } = await import("@/lib/db");
    vi.mocked(resolverEstado).mockResolvedValue({ estado: "fresco", erro: false, calculadoEm: 0, aviso: null });
    vi.mocked(avisoVigente).mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  async function comSessaoValida() {
    const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
    const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
    cookiesFalso.mockResolvedValue({
      get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined),
    });
  }

  // 1. Com cookie válido: o bloco do lugar aparece.
  it("com cookie válido: o bloco do lugar aparece", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));
    expect(container.querySelector(".adm-painel")).not.toBeNull();
    // 🔴 A BUSCA É DENTRO DO PAINEL, e passou a ser na Task 5 (2026-09-27): o
    // nome do ponto agora aparece DUAS vezes na página — o `<h2>` do painel e o
    // bloco `campo-trajeto.waypoints.0.nome` da ficha inteira. `screen.getByText`
    // estoura com dois achados, e afrouxar pra `getAllByText` provaria menos do
    // que este teste provava (ele existe pra dizer que o BLOCO DO LUGAR
    // apareceu). Escopar no `.adm-painel` mantém exatamente a mesma prova.
    expect(
      within(container.querySelector<HTMLElement>(".adm-painel")!).getByText(
        new RegExp(ficha.trajeto.waypoints[0].nome),
      ),
    ).toBeTruthy();
  });

  // 🔴 Task 5 (2026-09-27): sem isto, apagar `<FichaInteira>` da página — o
  // dono voltando a enxergar UM campo de 17 — passaria a suíte inteira verde.
  // Mesmo molde do teste do editor da voz logo abaixo.
  it("com cookie válido: a ficha inteira aparece, com os seis grupos", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));
    expect(
      container.querySelector(`[data-ficha-inteira="${ficha.slug}"]`),
      "a ficha inteira sumiu da tela do lugar",
    ).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="grupo-"]').length).toBe(6);
  });

  // 🔴 I2 DA REVISÃO FINAL (2026-09-26): nada nesta suíte provava que o editor da
  // voz e `HistoricoDaVoz` de fato aparecem na tela do lugar — apagar o editor
  // (o dono não pode editar nada), apagar `<HistoricoDaVoz>` — hoje `<HistoricoDaFicha>`, renomeado na Task 9 — (sem histórico, sem
  // voltar) ou passar `versoes={[]}` sobreviviam à suíte inteira.
  //
  // ⚠️ O MARCADOR MUDOU NA TASK 6 (2026-09-30), e o defeito medido é o MESMO.
  // `EditorDeVoz` foi apagado: a voz passou a ser editada pelo `EditorProsa`,
  // dentro do bloco `campo-voz` da ficha inteira. Então o que se mede é o
  // instrumento DAQUELE campo (`[data-editor="voz"]` dentro de
  // `[data-testid="campo-voz"]`) — e não só a presença da ficha inteira, que o
  // caso de cima já cobre. Se os editores saíssem da ficha inteira, o dono
  // voltaria a só LER a tela, com a suíte verde; é isso que esta asserção trava.
  it("com cookie válido: o editor da voz e o histórico aparecem, e o histórico não vem vazio", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const { historico } = await import("@/lib/db");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));

    const blocoDaVoz = container.querySelector('[data-testid="campo-voz"]');
    expect(blocoDaVoz, "o bloco da voz sumiu da tela do lugar").not.toBeNull();
    expect(
      blocoDaVoz!.querySelector('[data-editor="voz"]'),
      "o editor da voz sumiu: o dono voltou a só LER a ficha",
    ).not.toBeNull();
    expect(
      blocoDaVoz!.querySelector('[data-salvar="voz"]'),
      "o editor da voz apareceu sem botão de gravar",
    ).not.toBeNull();
    const historicoEl = container.querySelector("[data-historico]");
    expect(historicoEl, "o histórico sumiu").not.toBeNull();

    const versoesReais = await historico(cliente, ficha.slug);
    expect(versoesReais.length, "sem versão nenhuma este teste não separa vazio de cheio").toBeGreaterThan(0);
    expect(
      historicoEl!.querySelectorAll("li").length,
      "o histórico apareceu vazio, mesmo com versão gravada no banco",
    ).toBe(versoesReais.length);
  });

  // 2. Slug fora do acervo: `notFound()` é chamado.
  // 🔴 M2 do plano de mutação: tirar este `notFound()` tem que morrer aqui.
  it("slug que não existe no acervo: 404", async () => {
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "nao-existe" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  // 3. Sem cookie: caixa de senha, e NADA do lugar.
  // 🔴 A asserção que vale é a do `textContent`: "não mostra o painel" (a
  // classe `.adm-painel` ausente) já não distingue caixa vazia de ausência
  // real — o que falta provar é que o CONTEÚDO do lugar (a voz dele, escrita
  // à mão na ficha) não vaza pra quem não entrou.
  it("sem cookie: caixa de senha, e NADA do lugar", async () => {
    const { getAllFichas } = await import("@/lib/ficha");
    const fichas = await getAllFichas();
    const ficha = fichas[0];
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: ficha.slug }) }));
    expect(container.querySelector('input[type="password"]'), "a caixa de senha sumiu").not.toBeNull();
    expect(container.querySelector(".adm-painel"), "o painel apareceu sem cookie").toBeNull();
    expect(container.textContent).not.toContain(ficha.voz);
  });

  // 4. Painel desligado (sem ADMIN_SENHA), agora com sessão dentro do bloco
  // que semeia o banco — prova que a guarda de config corta ANTES de tocar o
  // banco: com `ADMIN_SENHA` vazia o `getFicha` nem chega a ser chamado.
  it("painel desligado (sem ADMIN_SENHA): 404, e a tela não explica", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.stubEnv("ADMIN_SEGREDO", "");
    semCookie();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    await expect(Lugar({ params: Promise.resolve({ slug: "pedra-furada-de-venturosa" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  // 5. FINDING 1 da revisão da Task 5: banco PENDURADO (não FORA DO AR) no
  // aviso deste admin nunca tinha prova — o mock de `avisoVigente` no
  // `beforeEach` sempre RESOLVE (nunca pendura), então o buraco ficava
  // invisível. Relógio FALSO e uma promessa que NUNCA resolve, no molde de
  // `tests/lib/carimbo-estado-aviso.test.ts` ("banco PENDURADO não segura o
  // carimbo"): sem `comPrazo` aqui, o `await` fica pendurado pra sempre e o
  // teste só terminaria pelo timeout do vitest — por isso o timeout curto
  // (1 s), bem menor que qualquer prazo real (`PRAZO_AVISO_MS` são 2 s).
  //
  // 🔴 O que vale não é só "a tela renderiza" — é que ela conta a verdade:
  // banco pendurado tem que virar ERRO DE LEITURA (`avisoErro` → o
  // `role="alert"` de `PainelAdmin`), nunca "sem aviso publicado" (`null`).
  // As duas dariam a MESMA tela, e o dono leria "sumiu meu recado" quando o
  // Turso só ficou mudo — por isso M6 (fazer o estouro devolver
  // `{ erro: false }`) tem que morrer bem aqui.
  it(
    "banco pendurado no aviso: a tela renderiza e diz que não conseguiu ler, não finge 'sem aviso'",
    { timeout: 1_000 },
    async () => {
      const { getAllFichas } = await import("@/lib/ficha");
      const fichas = await getAllFichas();
      const ficha = fichas[0];
      await comSessaoValida();
      const { avisoVigente } = await import("@/lib/db");
      const { PRAZO_AVISO_MS } = await import("@/lib/carimbo-estado");
      vi.mocked(avisoVigente).mockReturnValue(new Promise<never>(() => {}));

      vi.useFakeTimers();
      try {
        const { default: Lugar } = await import("@/app/admin/[slug]/page");
        const pagina = Lugar({ params: Promise.resolve({ slug: ficha.slug }) });
        await vi.advanceTimersByTimeAsync(PRAZO_AVISO_MS + 1);
        const { container } = render(await pagina);

        expect(
          container.querySelector(".adm-painel"),
          "banco pendurado derrubou o painel inteiro",
        ).not.toBeNull();
        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toMatch(/não consegui ler o aviso/i);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  // 🔴 I2/I3 DA REVISÃO FINAL (2026-09-26): irmão do teste 5, agora pro
  // HISTÓRICO — banco pendurado (não fora do ar) na consulta de `historico`
  // nunca tinha prova, e o `lerHistorico` da página trata isso como ERRO DE
  // LEITURA (`historicoErro` → `role="alert"`), NUNCA como "não há histórico"
  // (lista vazia). As duas dariam a mesma tela sem marca nenhuma, e o dono
  // leria "este lugar nunca teve edição" quando o Turso só ficou mudo.
  // `PRAZO_HISTORICO_MS` não é exportado da página; usa-se o valor de
  // `PRAZO_AVISO_MS` (mesmos 2 s, ver o comentário do próprio `page.tsx`
  // sobre o prazo do histórico ser "o mesmo valor" do vizinho).
  it(
    "banco pendurado no histórico: a tela renderiza e diz que não conseguiu ler, não finge 'sem histórico'",
    { timeout: 1_000 },
    async () => {
      const { getAllFichas } = await import("@/lib/ficha");
      const fichas = await getAllFichas();
      const ficha = fichas[0];
      await comSessaoValida();
      const { historico } = await import("@/lib/db");
      const { PRAZO_AVISO_MS } = await import("@/lib/carimbo-estado");
      vi.mocked(historico).mockReturnValue(new Promise<never>(() => {}));

      vi.useFakeTimers();
      try {
        const { default: Lugar } = await import("@/app/admin/[slug]/page");
        const pagina = Lugar({ params: Promise.resolve({ slug: ficha.slug }) });
        await vi.advanceTimersByTimeAsync(PRAZO_AVISO_MS + 1);
        const { container } = render(await pagina);

        expect(
          container.querySelector(".adm-painel"),
          "banco pendurado derrubou o painel inteiro",
        ).not.toBeNull();
        const historicoEl = container.querySelector("[data-historico]");
        expect(historicoEl, "o histórico sumiu inteiro em vez de mostrar erro").not.toBeNull();
        expect(historicoEl!.querySelectorAll("li").length, "mostrou lista vazia em vez de erro").toBe(0);
        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toMatch(/não consegui ler o histórico/i);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Task 9 (2026-10-01): o lugar ESCONDIDO abre pro dono, e o botão de mostrar
  // de novo mora aqui.
  //
  // 🔴 A PRÉ-CONDIÇÃO QUE A TASK 5 DEIXOU ESCRITA: desde a Task 4 o `getFicha`
  // filtra os ocultos, e esta página o usava pra conferir se o lugar existe —
  // então o lugar escondido dava 404 PRO DONO. Com a lista do painel agora
  // mostrando o escondido (B1), o link dele levaria a um 404, e o botão de
  // mostrar de novo moraria numa página que não abre justamente quando ele é
  // necessário: porta de mão única.
  // ───────────────────────────────────────────────────────────────────────────
  const SLUG_ESCONDIDO = "rampa-do-pepe";

  async function esconder(slug: string) {
    const { gravarVersao, versaoAtual } = await import("@/lib/db");
    const atual = (await versaoAtual(cliente, slug))!;
    await gravarVersao(cliente, slug, atual.doc, "painel", Math.floor(Date.now() / 1000), true);
  }

  it("lugar escondido ABRE pro dono (não 404), marcado, com o botão de mostrar de novo", async () => {
    await esconder(SLUG_ESCONDIDO);
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: SLUG_ESCONDIDO }) }));
    expect(notFoundFalso).not.toHaveBeenCalled();
    expect(container.querySelector(".adm-painel"), "o painel do lugar escondido não abriu").not.toBeNull();
    const vis = container.querySelector("[data-visibilidade]") as HTMLElement | null;
    expect(vis, "o botão de visibilidade sumiu da página do lugar").not.toBeNull();
    expect(within(vis!).getByRole("button", { name: /mostrar de novo/i })).toBeTruthy();
    expect(within(vis!).getByText(/escondid/i)).toBeTruthy();
  });

  it("lugar no ar: o botão é o de esconder, e nada diz escondido", async () => {
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: SLUG_ESCONDIDO }) }));
    const vis = container.querySelector("[data-visibilidade]") as HTMLElement | null;
    expect(vis).not.toBeNull();
    expect(within(vis!).getByRole("button", { name: /esconder/i })).toBeTruthy();
    expect(within(container).queryByText(/escondid/i)).toBeNull();
  });

  // 🔴 A PÁGINA calcula o "que mudou" (B2) e entrega os rótulos prontos. Sem
  // este caso, uma página que passasse `mudou: []` pra toda versão — ou que
  // esquecesse de chamar o diff — deixaria o componente provado e a tela vazia.
  it("o histórico da página diz, na linha da versão nova, o campo que mudou", async () => {
    const { gravarVersao, versaoAtual } = await import("@/lib/db");
    const { rotuloDe } = await import("@/app/admin/FichaInteira");
    const atual = (await versaoAtual(cliente, SLUG_ESCONDIDO))!;
    const doc = { ...JSON.parse(atual.doc), custo: { ...JSON.parse(atual.doc).custo, curto: "outro custo" } };
    const id = await gravarVersao(cliente, SLUG_ESCONDIDO, JSON.stringify(doc), "painel", Math.floor(Date.now() / 1000));
    await comSessaoValida();
    const { default: Lugar } = await import("@/app/admin/[slug]/page");
    const { container } = render(await Lugar({ params: Promise.resolve({ slug: SLUG_ESCONDIDO }) }));

    const rotulo = rotuloDe("custo.curto");
    const linhaNova = container.querySelector(`[data-testid="versao-${id}"]`) as HTMLElement | null;
    expect(linhaNova, "a versão nova não apareceu no histórico").not.toBeNull();
    expect(within(linhaNova!).getByText(rotulo)).toBeTruthy();
    expect(within(container.querySelector(`[data-testid="versao-${atual.id}"]`) as HTMLElement).queryByText(rotulo)).toBeNull();
  });
});
