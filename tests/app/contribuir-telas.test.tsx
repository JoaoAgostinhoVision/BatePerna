import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ORDEM_DA_PESSOA, montarPerguntasDaPessoa } from "@/app/contribuir/perguntas";
import { CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA } from "@/lib/campos-da-pessoa";
import { PERGUNTAS } from "@/app/admin/novo/perguntas";
import { NAO_TEM } from "@/app/admin/campos/BotaoNaoSei";
import { BLOQUEADA, CLERK_FORA_AO_ABRIR, JA_CONFERIDO_AO_ABRIR, NOME_EXISTE_NA_CIDADE } from "@/lib/porta-da-pessoa";
import { CORRIGIR_O_NOME } from "@/app/admin/AvisoDoPar";
import { PROXIMA, SEGUIR_SEM_SALVAR, VOLTAR_A_REVISAO } from "@/app/admin/FormularioDeLugar";
import { ROTAS } from "@/app/admin/novo/enderecos";
import { conferirLugar, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { versaoAtual } from "@/lib/db";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { MANDAR_UM_LUGAR_NOVO } from "@/app/contribuir/palavras";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("next/navigation", async (real) => ({
  ...(await real<typeof import("next/navigation")>()),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/vista-do-mapa", async (real) => ({
  ...(await real<typeof import("@/lib/vista-do-mapa")>()),
  vistaDaCoordSemPonto: vi.fn(async () => null),
}));

const banco = await bancoDeProducao();
const Meus = (await import("@/app/contribuir/page")).default;
const Novo = (await import("@/app/contribuir/novo/page")).default;
const Publicar = (await import("@/app/contribuir/novo/publicar/page")).default;
const Editar = (await import("@/app/contribuir/[slug]/page")).default;
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  sessao.atual = PESSOA;
  sessao.fora = false;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** O rascunho DELA (ou de `dono`) nasce; devolve a CHAVE — Task 17: a chave é
 *  o que anda na URL das telas dela, e nunca é o endereço. */
async function rascunhoDe(endereco: string, doc: unknown, dono = PESSOA.id): Promise<string> {
  const chave = await criarRascunhoDaPessoa(banco, endereco, JSON.stringify(doc), 1, dono);
  expect(chave, "a premissa: o rascunho nasceu").not.toBeNull();
  return chave!;
}

/** Um toque que o jsdom não segue: devolve se o APP impediu a navegação nativa
 *  (o `preventDefault` do formulário, visto antes do nosso ouvinte). */
function toqueImpedido(el: HTMLElement): boolean {
  let impediu = false;
  const ouvir = (e: Event): void => {
    impediu = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", ouvir);
  try {
    fireEvent.click(el);
  } finally {
    document.removeEventListener("click", ouvir);
  }
  return impediu;
}

/** O `fetch` e a navegação dublados, pra conferir PRA ONDE as telas dela
 *  gravam e levam (I2 da revisão da Task 14): sem isto, apagar o
 *  `onde="contribuir"` deixava a tela dela gravando no /api/admin, verde. */
function portasFalsas() {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ slug: "x" }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("location", { ...window.location, assign: vi.fn(), reload: vi.fn() });
  return fetch;
}

describe("as perguntas dela", () => {
  // 🔴 17/10: a cidade saiu (ela sai do ponto), e o mapa subiu pro 2º lugar.
  it("são a lista dela, na ordem da spec, e o mapa no 2º lugar", () => {
    expect(ORDEM_DA_PESSOA).toEqual([
      "trajeto.waypoints.0.nome", "trajeto.waypoints.0.lat", "promessa", "acesso", "avisos",
      "custo.tag", "custo.valor", "horario", "dias",
    ]);
    for (const c of CAMPOS_DA_PESSOA) expect(ORDEM_DA_PESSOA, c).toContain(c);
  });

  it("cada texto é a pergunta do painel, já lida — nenhuma redação nova", () => {
    for (const q of montarPerguntasDaPessoa({})) expect(q.texto, q.campo.caminho).toBe(PERGUNTAS[q.campo.caminho]);
  });

  it("obrigatoriedade é a DELA: avisos, valor, horário e dias podem ficar sem resposta", () => {
    for (const q of montarPerguntasDaPessoa({})) {
      expect(q.campo.obrigatorio, q.campo.caminho).toBe(!OPCIONAIS_DA_PESSOA.has(q.campo.caminho));
    }
  });
});

describe("a porta das páginas", () => {
  it("sem sessão: manda entrar (e não mostra nada)", async () => {
    sessao.atual = null;
    await expect(Meus()).rejects.toThrow("NEXT_REDIRECT_PRA_ENTRAR");
  });

  it("Clerk fora: a frase, e nada mais", async () => {
    sessao.fora = true;
    const { container } = render(await Meus());
    expect(container.textContent).toContain(CLERK_FORA_AO_ABRIR);
    expect(container.querySelector("a[href='/contribuir/novo']")).toBeNull();
  });

  // 🔴 A ONDA DE COPY DE 13/10: ao só ABRIR uma tela dela, ninguém tentou
  // gravar — "Nada foi gravado" sobrava. As QUATRO páginas passam pela mesma
  // porta (`quemNaTela`), e cada uma é aberta aqui: a irmã de abrir
  // (`CLERK_FORA_AO_ABRIR`), nunca a de gravar (`CLERK_FORA`, das rotas).
  it.each([
    ["/contribuir", () => Meus()],
    ["/contribuir/novo", () => Novo({ searchParams: Promise.resolve({}) })],
    ["/contribuir/novo/publicar", () => Publicar({ searchParams: Promise.resolve({ slug: "qualquer" }) })],
    ["/contribuir/[slug]", () => Editar({ params: Promise.resolve({ slug: "qualquer" }) })],
  ] as const)("Clerk fora, só abrindo %s: a frase de abrir, sem 'Nada foi gravado'", async (_, abrir) => {
    sessao.fora = true;
    const { container } = render(await abrir());
    expect(container.textContent).toBe(CLERK_FORA_AO_ABRIR);
    expect(container.textContent).not.toContain("Nada foi gravado");
  });

  it("bloqueada: a frase, e nenhum caminho pra mandar nem editar", async () => {
    await banco.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, 0) ON CONFLICT(id) DO UPDATE SET bloqueado = 1", args: [PESSOA.id] });
    const { container } = render(await Meus());
    expect(container.textContent).toContain(BLOQUEADA);
    expect(container.querySelector("a[href^='/contribuir/']")).toBeNull();
  });
});

describe("Meus lugares", () => {
  // 🔴 I5 da pré-auditoria: "Meus lugares" é onde a barra leva, e é por aqui
  // que se manda um lugar novo. Quem nunca mandou nada (OUTRA, aqui) vê o link
  // no TOPO — o primeiro link da tela, antes de qualquer lista.
  it("quem nunca mandou nada: o primeiro link da tela é '+ mandar um lugar novo', pras perguntas", async () => {
    sessao.atual = OUTRA;
    const { container } = render(await Meus());
    const primeiro = container.querySelector("main a");
    expect(primeiro?.getAttribute("href")).toBe("/contribuir/novo");
    expect(primeiro?.textContent).toBe(MANDAR_UM_LUGAR_NOVO);
    expect(container.querySelector('[data-testid="meus-lugares"]')).toBeNull();
  });

  it("com lugares, o link do topo continua antes da lista", async () => {
    const { container } = render(await Meus());
    const links = [...container.querySelectorAll("main a")];
    expect(links[0]?.getAttribute("href")).toBe("/contribuir/novo");
    expect(container.querySelector('[data-testid="meus-lugares"]'), "a premissa: a lista dela existe").not.toBeNull();
  });

  it("mostra o dela, marcado como não conferido, com o link de editar; o de outra não aparece", async () => {
    await semearLugarDaPessoa(banco, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
    const { container } = render(await Meus());
    const item = container.querySelector(`[data-lugar="${SLUG}"]`);
    expect(item?.textContent).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(item?.querySelector(`a[href="/contribuir/${SLUG}"]`)).not.toBeNull();
    expect(container.textContent).not.toContain("Pedra Da Outra");
  });

  it("conferido: o link de editar some", async () => {
    await conferirLugar(banco, SLUG, (await versaoAtual(banco, SLUG))!.id, 1);
    const { container } = render(await Meus());
    expect(container.querySelector(`a[href="/contribuir/${SLUG}"]`)).toBeNull();
  });

  it("os rascunhos dela aparecem, com o caminho de volta pras perguntas", async () => {
    const chave = await rascunhoDe("comecado-cidade", { slug: "comecado-cidade" });
    const { container } = render(await Meus());
    expect(container.querySelector(`a[href="/contribuir/novo?slug=${chave}"]`)).not.toBeNull();
  });
});

describe("as perguntas na tela", () => {
  it("sem slug: começar (só o nome), pela rota dela", async () => {
    const fetch = portasFalsas();
    const { container } = render(await Novo({ searchParams: Promise.resolve({}) }));
    expect(container.querySelectorAll("input")).toHaveLength(1);
    // 🔴 I2(b): o rascunho nasce pela porta DELA, nunca pela do painel.
    fireEvent.change(container.querySelectorAll("input")[0], { target: { value: "Pedra" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ nome: "Pedra" });
  });

  // 🔴 I2(a) da revisão: a pergunta do rascunho dela grava pela rota DELA e
  // leva às telas DELA — Próxima, Anterior e o Desistir.
  it("com slug: grava em /api/contribuir/rascunho, e todo link fica em /contribuir", async () => {
    const S = await rascunhoDe("comecado-cidade", { slug: "comecado-cidade" });
    const fetch = portasFalsas();
    const n = ORDEM_DA_PESSOA.indexOf("promessa") + 1;
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: String(n) }) }));
    const hrefs = [...container.querySelectorAll("main a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs, "a premissa: há links na tela").toContain(`/contribuir/novo?slug=${S}&p=${n + 1}`);
    expect(hrefs).toContain(`/contribuir/novo?slug=${S}&p=${n - 1}`);
    for (const h of hrefs) expect(h, h).toMatch(/^\/contribuir\/novo\?slug=/);
    fireEvent.change(container.querySelector('[data-caixa="promessa"]')!, { target: { value: "Porque sim." } });
    fireEvent.click(container.querySelector('[data-salvar="promessa"]')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });

  // 🔴 A PÁGINA DELA LÊ O `volta` (prova-que-trava, revisão final de 18/10):
  // trocar `voltaARevisao={volta === "revisao"}` por `{false}` sobrevivia à
  // suíte inteira — só o painel tinha o caso. Com `volta=revisao` a navegação é
  // só o "Voltar à revisão", pra a revisão DELA (o literal, não as ROTAS); com
  // qualquer outro `volta`, a de sempre.
  it("com volta=revisao: só o 'Voltar à revisão', pra a revisão dela; com outro volta, Anterior e Próxima", async () => {
    const S = await rascunhoDe("comecado-cidade", { slug: "comecado-cidade" });
    portasFalsas();
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: "2", volta: "revisao" }) }));
    const voltar = [...container.querySelectorAll("main a")].find((a) => a.textContent === VOLTAR_A_REVISAO);
    expect(voltar, "a premissa: há o Voltar à revisão").toBeDefined();
    expect(voltar!.getAttribute("href")).toBe(`/contribuir/novo/publicar?slug=${S}`);
    expect([...container.querySelectorAll("main a")].some((a) => a.textContent === PROXIMA), "a Próxima na volta").toBe(false);
    cleanup();
    const outra = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: "2", volta: "outra" }) }));
    const rotulos = [...outra.container.querySelectorAll("main a")].map((a) => a.textContent);
    expect(rotulos).toContain(PROXIMA);
    expect(rotulos).not.toContain(VOLTAR_A_REVISAO);
    const proxima = [...outra.container.querySelectorAll("main a")].find((a) => a.textContent === PROXIMA)!;
    expect(proxima.getAttribute("href")).toBe(`/contribuir/novo?slug=${S}&p=3`);
  });

  // 17/10 (Task 4): o aviso do par, na frase DELA — que não nomeia o lugar que
  // já existe (I3 de 07/10) — e DEPOIS da pergunta.
  it("o par dela é de um lugar: a frase dela, que não nomeia o lugar que já existe, depois da pergunta", async () => {
    const doc = { slug: "x", cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } };
    const S = await rascunhoDe("x", doc);
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: "1" }) }));
    const aviso = container.querySelector<HTMLElement>('[role="status"]')!;
    expect(aviso, "a premissa: há aviso").not.toBeNull();
    expect(aviso.textContent).toContain(NOME_EXISTE_NA_CIDADE);
    expect(aviso.textContent).not.toContain("Pedra Mandada");
    expect(aviso.textContent).not.toContain("lista do painel");
    const link = [...aviso.querySelectorAll("a")].find((a) => a.textContent === CORRIGIR_O_NOME)!;
    expect(link.getAttribute("href")).toBe(ROTAS.contribuir.corrigir(S, 1));
    expect(link.getAttribute("href"), "o corrigir volta à revisão").toContain("&volta=revisao");
    const perg = container.querySelector(`[data-testid="pergunta-trajeto.waypoints.0.nome"]`)!;
    expect(perg.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING, "o aviso antes da pergunta").toBeTruthy();
  });

  // 🔴 I1 da revisão final (18/10): o "Corrigir o nome" dela pede o mesmo
  // segundo toque que a Próxima quando há texto não salvo; sem, é o link de sempre.
  it("'Corrigir o nome' dela: com texto não salvo, o 1º toque não sai e o 2º sai; sem, um toque só", async () => {
    const doc = { slug: "x", cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } };
    const S = await rascunhoDe("x", doc);
    portasFalsas();
    const n = ORDEM_DA_PESSOA.indexOf("promessa") + 1;
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: String(n) }) }));
    const linkDoAviso = (rotulo: string) =>
      [...container.querySelector<HTMLElement>('[role="status"]')!.querySelectorAll("a")].find((a) => a.textContent === rotulo);
    // Sem nada não salvo: o app não impede a navegação nativa.
    expect(toqueImpedido(linkDoAviso(CORRIGIR_O_NOME)!), "pediu segundo toque sem motivo").toBe(false);
    fireEvent.change(container.querySelector('[data-caixa="promessa"]')!, { target: { value: "Porque sim." } });
    expect(toqueImpedido(linkDoAviso(CORRIGIR_O_NOME)!), "o 1º toque com texto saiu").toBe(true);
    expect(location.assign).not.toHaveBeenCalled();
    expect(linkDoAviso(CORRIGIR_O_NOME), "o rótulo não mudou").toBeUndefined();
    expect(toqueImpedido(linkDoAviso(SEGUIR_SEM_SALVAR)!)).toBe(true);
    expect(location.assign).toHaveBeenCalledTimes(1);
    expect(location.assign).toHaveBeenCalledWith(ROTAS.contribuir.corrigir(S, 1));
  });

  it("o par dela livre: nenhum aviso", async () => {
    const doc = { slug: "y", cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Livre Dela" }] } };
    const S = await rascunhoDe("y", doc);
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: S, p: "1" }) }));
    expect(container.querySelector('[data-testid="pergunta-trajeto.waypoints.0.nome"]'), "a premissa: a pergunta abriu").not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("o rascunho de OUTRA pessoa é 404", async () => {
    const dela = await rascunhoDe("da-outra-cidade", { slug: "da-outra-cidade" }, OUTRA.id);
    await expect(Novo({ searchParams: Promise.resolve({ slug: dela }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  // Carregado da revisão da Task 11: `problemaDasFaixas` manda usar "não tem"
  // — a tela DELA tem de oferecê-lo onde o horário é perguntado (o horário é
  // opcional na régua dela, e o botão só existe em campo opcional preenchido).
  it("o horário respondido oferece o 'não tem' (a saída que a frase das faixas cita)", async () => {
    const doc = { slug: "com-hora-cidade", horario: [{ abre: "08:00", fecha: "17:00" }] };
    const chave = await rascunhoDe("com-hora-cidade", doc);
    const n = ORDEM_DA_PESSOA.indexOf("horario") + 1;
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: chave, p: String(n) }) }));
    const pergunta = container.querySelector('[data-testid="pergunta-horario"]');
    expect(pergunta, "a premissa: a tela é a do horário").not.toBeNull();
    expect(pergunta?.querySelector('[data-nao-sei="horario"]')?.textContent).toBe(NAO_TEM);
  });
});

describe("publicar o dela", () => {
  const SO_NOME = "so-nome-cidade-teste";
  const docSoNome = { slug: SO_NOME, cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Só Nome" }] } };

  // 🔴 Carregado da revisão da Task 13 (e refeito na Task 8, 17/10): a revisão é
  // montada pelas perguntas DELA, e cada "Corrigir" leva à pergunta DELA, na
  // posição da lista DELA, com a volta à revisão — nunca ao painel do João, que
  // ela não abre. A cidade entra logo depois do ponto, com o destino do ponto.
  it("a página dela: as linhas dela, cada Corrigir pelas ROTAS dela com volta=revisao", async () => {
    const chave = await rascunhoDe(SO_NOME, docSoNome);
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    const linhas = [...container.querySelectorAll<HTMLElement>('[data-testid="revisao"] li')];
    expect(linhas.map((l) => l.getAttribute("data-caminho"))).toEqual([
      ORDEM_DA_PESSOA[0], ORDEM_DA_PESSOA[1], "cidade", ...ORDEM_DA_PESSOA.slice(2),
    ]);
    const hrefs = linhas.map((l) => l.querySelector("a")!.getAttribute("href"));
    const posicao = (c: string) => (c === "cidade" ? 2 : ORDEM_DA_PESSOA.indexOf(c) + 1);
    expect(hrefs).toEqual(linhas.map((l) => ROTAS.contribuir.corrigir(chave, posicao(l.getAttribute("data-caminho")!))));
    expect(hrefs.every((h) => h!.endsWith("&volta=revisao") && h!.startsWith("/contribuir/novo?"))).toBe(true);
    expect(container.querySelector("a[href*='/admin']")).toBeNull();
    expect(container.querySelector('[data-testid="falta"]'), "a lista antiga saiu").toBeNull();
  });

  it("o que falta, pela régua DELA: obrigatória sem resposta é falta; a opcional dela é pulada", async () => {
    const chave = await rascunhoDe(SO_NOME, docSoNome);
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    const estado = (c: string) => container.querySelector(`[data-caminho="${c}"]`)!.getAttribute("data-estado");
    for (const c of ["trajeto.waypoints.0.lat", "promessa", "acesso", "custo.tag"]) expect(estado(c), c).toBe("falta");
    expect(estado("trajeto.waypoints.0.nome")).toBe("respondida");
    expect(estado("cidade")).toBe("respondida");
    for (const c of ["avisos", "custo.valor", "horario", "dias"]) expect(estado(c), c).toBe("pulada");
  });

  // Task 8: o aviso do par (Task 4) vai na linha do nome da revisão, na frase
  // DELA — que não nomeia o lugar que já existe (I3 de 07/10).
  it("o par dela é de um lugar: o aviso, na frase dela, só na linha do nome", async () => {
    const doc = { slug: "x", cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } };
    const chave = await rascunhoDe("x", doc);
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    const avisos = [...container.querySelectorAll<HTMLElement>('[data-testid="revisao"] [role="status"]')];
    expect(avisos).toHaveLength(1);
    expect(avisos[0].textContent).toBe(NOME_EXISTE_NA_CIDADE);
    expect(avisos[0].closest("li")!.getAttribute("data-caminho")).toBe("trajeto.waypoints.0.nome");
    expect(container.textContent).not.toContain("lista do painel");
  });

  // 🔴 17/10: a cidade não é pergunta dela — sai do ponto. Quando ela falta (um
  // rascunho com o ponto gravado antes de a cidade sair dele), o caminho é a
  // pergunta do PONTO, na posição 2; a linha da cidade diz que falta.
  it("a falta da cidade, na tela de publicar dela, leva à pergunta do ponto (posição 2)", async () => {
    const completo = {
      slug: SO_NOME, modos: [], promessa: "Uma promessa marcadora.", acesso: "De carro.", custo: { tag: "gratis" },
      trajeto: { waypoints: [{ nome: "Só Nome", lat: -8.3, lng: -35.9 }] }, condicao: { coords: { lat: -8.3, lng: -35.9 } },
    };
    const chave = await rascunhoDe(SO_NOME, completo);
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    expect(ORDEM_DA_PESSOA.indexOf("trajeto.waypoints.0.lat") + 1, "a premissa: o ponto é a 2ª").toBe(2);
    const cidade = container.querySelector('[data-caminho="cidade"]')!;
    expect(cidade.getAttribute("data-estado")).toBe("falta");
    expect(cidade.querySelector("a")!.getAttribute("href")).toBe(`/contribuir/novo?slug=${chave}&p=2&volta=revisao`);
    expect(container.querySelector('[data-caminho="trajeto.waypoints.0.lat"]')!.getAttribute("data-estado")).toBe("respondida");
    // Só a cidade falta aqui: o resto da régua dela está respondido.
    expect([...container.querySelectorAll('[data-estado="falta"]')].map((l) => l.getAttribute("data-caminho"))).toEqual(["cidade"]);
  });

  it("o rascunho de OUTRA pessoa é 404", async () => {
    const dela = await rascunhoDe(SO_NOME, docSoNome, OUTRA.id);
    await expect(Publicar({ searchParams: Promise.resolve({ slug: dela }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  // 🔴 Task 17: a tela dela publica pela CHAVE, e leva ao ENDEREÇO que a porta
  // responde — o lugar acabou de nascer lá. Ir pela chave seria um 404 na
  // página pública.
  it("publicou: leva à página pública pelo ENDEREÇO que a porta respondeu, nunca pela chave", async () => {
    const chave = await rascunhoDe(SO_NOME, docSoNome);
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ slug: SO_NOME }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, reload: vi.fn() });
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    fireEvent.click(container.querySelector(".adm-publicar button")!);
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/contribuir/publicar");
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).slug).toBe(chave);
    expect(assign).toHaveBeenCalledWith(`/${SO_NOME}`);
  });

  // 🔴 I1 da revisão da Task 17: depois do 200 o lugar JÁ ESTÁ no ar e a chave
  // já não existe — um 2º toque, enquanto a página pública carrega, iria à rota
  // e voltaria 404 ("Não consegui salvar.", falso: o lugar foi). O botão fica
  // desligado do 200 até a navegação, e o 2º toque não sai.
  it("publicou: o botão fica desligado até a navegação, e o 2º toque não manda outro POST", async () => {
    const chave = await rascunhoDe(SO_NOME, docSoNome);
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ slug: SO_NOME }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, reload: vi.fn() });
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: chave }) }));
    const botao = container.querySelector(".adm-publicar button") as HTMLButtonElement;
    fireEvent.click(botao);
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    // Deixa o `finally` (e o render que ele pediria) assentar antes de medir.
    await new Promise((ok) => setTimeout(ok, 0));
    expect(botao.disabled).toBe(true);
    fireEvent.click(botao);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe("editar o dela no ar", () => {
  it("o dela, não conferido: as perguntas dela, gravando com a versão da tela", async () => {
    const fetch = portasFalsas();
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.querySelector('[data-testid="pergunta-promessa"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pergunta-voz"]')).toBeNull();
    // 🔴 I2(c) da revisão: o "gravando com a versão da tela" do título, medido —
    // PUT na rota DELA, com o `baseId` da versão que a página leu.
    fireEvent.change(container.querySelector('[data-caixa="promessa"]')!, { target: { value: "Outra frase dela." } });
    fireEvent.click(container.querySelector('[data-salvar="promessa"]')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/contribuir/lugar");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      campo: "promessa", valor: "Outra frase dela.", baseId: (await versaoAtual(banco, SLUG))!.id,
    });
  });

  // Onda de copy de 13/10: só ABRIR a tela não é tentar gravar — a irmã de
  // abrir (`JA_CONFERIDO_AO_ABRIR`), sem o "Nada foi gravado" do PUT.
  it("conferido: a frase de abrir, e nenhum editor", async () => {
    await conferirLugar(banco, SLUG, (await versaoAtual(banco, SLUG))!.id, 1);
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.textContent).toContain(JA_CONFERIDO_AO_ABRIR);
    expect(container.textContent).not.toContain("Nada foi gravado");
    expect(container.querySelector("[data-testid^='pergunta-']")).toBeNull();
  });

  // M9 da revisão final: banco pendurado não segura a página — o prazo das
  // irmãs (`/contribuir/novo`, `/admin/novo/publicar`), e o estouro é ERRO,
  // não "não existe". `lugarDoDono` lê num `batch`; a porta (`estaBloqueado`)
  // lê por `execute`, que fica livre.
  it("banco pendurado na leitura do lugar: a página dá erro, não monta tela", async () => {
    const pendura = vi.spyOn(banco, "batch").mockReturnValue(new Promise(() => {}) as never);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const pagina = Editar({ params: Promise.resolve({ slug: SLUG }) });
      const pegou = expect(pagina).rejects.toThrow("não respondeu a tempo");
      for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS);
      await pegou;
    } finally {
      vi.useRealTimers();
      pendura.mockRestore();
    }
  });

  it("de OUTRA pessoa, ou do João: 404", async () => {
    sessao.atual = OUTRA;
    await expect(Editar({ params: Promise.resolve({ slug: SLUG }) })).rejects.toThrow("NEXT_NOT_FOUND");
    sessao.atual = PESSOA;
    await expect(Editar({ params: Promise.resolve({ slug: "rampa-do-pepe" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
