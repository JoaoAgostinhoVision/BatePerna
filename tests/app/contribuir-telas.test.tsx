import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ORDEM_DA_PESSOA, montarPerguntasDaPessoa } from "@/app/contribuir/perguntas";
import { CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA } from "@/lib/campos-da-pessoa";
import { PERGUNTAS } from "@/app/admin/novo/perguntas";
import { NAO_TEM } from "@/app/admin/campos/BotaoNaoSei";
import { BLOQUEADA, CLERK_FORA, JA_CONFERIDO } from "@/lib/porta-da-pessoa";
import { conferirLugar, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { versaoAtual } from "@/lib/db";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { MANDAR_UM_LUGAR_NOVO } from "@/app/contribuir/palavras";
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
afterEach(() => cleanup());

describe("as perguntas dela", () => {
  it("são a lista dela, na ordem da spec, e o mapa no 3º lugar", () => {
    expect(ORDEM_DA_PESSOA).toEqual([
      "trajeto.waypoints.0.nome", "cidade", "trajeto.waypoints.0.lat", "promessa", "acesso", "avisos",
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
    expect(container.textContent).toContain(CLERK_FORA);
    expect(container.querySelector("a[href='/contribuir/novo']")).toBeNull();
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
    await criarRascunhoDaPessoa(banco, "comecado-cidade", JSON.stringify({ slug: "comecado-cidade" }), 1, PESSOA.id);
    const { container } = render(await Meus());
    expect(container.querySelector('a[href="/contribuir/novo?slug=comecado-cidade"]')).not.toBeNull();
  });
});

describe("as perguntas na tela", () => {
  it("sem slug: começar (nome e cidade), pela rota dela", async () => {
    const { container } = render(await Novo({ searchParams: Promise.resolve({}) }));
    expect(container.querySelectorAll("input")).toHaveLength(2);
  });

  it("o rascunho de OUTRA pessoa é 404", async () => {
    await criarRascunhoDaPessoa(banco, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), 1, OUTRA.id);
    await expect(Novo({ searchParams: Promise.resolve({ slug: "da-outra-cidade" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  // Carregado da revisão da Task 11: `problemaDasFaixas` manda usar "não tem"
  // — a tela DELA tem de oferecê-lo onde o horário é perguntado (o horário é
  // opcional na régua dela, e o botão só existe em campo opcional preenchido).
  it("o horário respondido oferece o 'não tem' (a saída que a frase das faixas cita)", async () => {
    const doc = { slug: "com-hora-cidade", horario: [{ abre: "08:00", fecha: "17:00" }] };
    await criarRascunhoDaPessoa(banco, "com-hora-cidade", JSON.stringify(doc), 1, PESSOA.id);
    const n = ORDEM_DA_PESSOA.indexOf("horario") + 1;
    const { container } = render(await Novo({ searchParams: Promise.resolve({ slug: "com-hora-cidade", p: String(n) }) }));
    const pergunta = container.querySelector('[data-testid="pergunta-horario"]');
    expect(pergunta, "a premissa: a tela é a do horário").not.toBeNull();
    expect(pergunta?.querySelector('[data-nao-sei="horario"]')?.textContent).toBe(NAO_TEM);
  });
});

describe("publicar o dela", () => {
  const SO_NOME = "so-nome-cidade-teste";
  const docSoNome = { slug: SO_NOME, cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Só Nome" }] } };

  // 🔴 Carregado da revisão da Task 13: o "falta responder" do painel é montado
  // com `enderecoDaPergunta` (o endereço do PAINEL). O dela leva às perguntas
  // DELA, na posição da lista DELA, e na ordem em que ela as vê — um link pra
  // /admin seria a tela dela mandando-a ao painel do João, que ela não abre.
  it("o que falta leva às perguntas DELA, na posição da lista dela — nunca ao painel", async () => {
    await criarRascunhoDaPessoa(banco, SO_NOME, JSON.stringify(docSoNome), 1, PESSOA.id);
    const { container } = render(await Publicar({ searchParams: Promise.resolve({ slug: SO_NOME }) }));
    const faltam = [...container.querySelectorAll('[data-testid="falta"] a')];
    const esperado = ["trajeto.waypoints.0.lat", "promessa", "acesso", "custo.tag"].map((c) => ({
      texto: PERGUNTAS[c],
      href: `/contribuir/novo?slug=${SO_NOME}&p=${ORDEM_DA_PESSOA.indexOf(c) + 1}`,
    }));
    expect(faltam.map((a) => ({ texto: a.textContent, href: a.getAttribute("href") }))).toEqual(esperado);
    expect(container.querySelector("a[href*='/admin']")).toBeNull();
  });

  it("o rascunho de OUTRA pessoa é 404", async () => {
    await criarRascunhoDaPessoa(banco, SO_NOME, JSON.stringify(docSoNome), 1, OUTRA.id);
    await expect(Publicar({ searchParams: Promise.resolve({ slug: SO_NOME }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("editar o dela no ar", () => {
  it("o dela, não conferido: as perguntas dela, gravando com a versão da tela", async () => {
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.querySelector('[data-testid="pergunta-promessa"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pergunta-voz"]')).toBeNull();
  });

  it("conferido: a frase, e nenhum editor", async () => {
    await conferirLugar(banco, SLUG, (await versaoAtual(banco, SLUG))!.id, 1);
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.textContent).toContain(JA_CONFERIDO);
    expect(container.querySelector("[data-testid^='pergunta-']")).toBeNull();
  });

  it("de OUTRA pessoa, ou do João: 404", async () => {
    sessao.atual = OUTRA;
    await expect(Editar({ params: Promise.resolve({ slug: SLUG }) })).rejects.toThrow("NEXT_NOT_FOUND");
    sessao.atual = PESSOA;
    await expect(Editar({ params: Promise.resolve({ slug: "rampa-do-pepe" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
