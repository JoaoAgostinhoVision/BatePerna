import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA, type CampoDaFicha } from "@/lib/campos-da-ficha";
import { criarRascunho, historico, lerRascunho, salvarRascunho, versaoAtual } from "@/lib/db";
import { docDoLugarNovo } from "@/lib/rascunho";
import { rotuloDe } from "@/app/admin/FichaInteira";
import { ORDEM, PERGUNTAS } from "@/app/admin/novo/perguntas";
import {
  AVISO_RASCUNHO,
  COMECAR,
  PULADA,
  PULAR,
} from "@/app/admin/FormularioDeLugar";
import { LUGAR_NOVO, TITULO_RASCUNHOS } from "@/app/admin/ListaDeLugares";
import { regraDe, semComentarios } from "../css";
import { bancoVazio, semearAcervo } from "../banco";

/** O FORMULÁRIO DE LUGAR NOVO (Tarefa 11) — medido NA PÁGINA, contra o banco.
 *
 *  🔴 E1 DA AUDITORIA: o `FormularioDeLugar` é de cliente e recebe as perguntas
 *  PRONTAS, montadas pela página de servidor a partir do registro. O teste do
 *  plano renderizava o componente sozinho lendo o registro — o que empurraria o
 *  import do registro pro cliente. Aqui se renderiza a PÁGINA (`/admin/novo`),
 *  com o rascunho no banco: o que se mede é a fiação inteira, não props
 *  escritas à mão.
 *
 *  🔴 E O QUE "QUAIS PERGUNTAS" SIGNIFICA SAI DO REGISTRO, AQUI, nunca da lista
 *  da tela: `esperadas()` é o registro com as duas dobras que a auditoria
 *  decidiu (folha de bloco mora no bloco; a metade `.lng` do ponto mora na
 *  `.lat`) e o molde `[]` no ponto `0`. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-formulario";
const NOME = "Lugar Marcador Um";
const S = "lugar-marcador-um";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));
vi.mock("@/lib/carimbo-estado", () => ({ resolverEstados: vi.fn() }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

let token: string;

beforeEach(async () => {
  cliente = bancoVazio();
  await semearAcervo(cliente);
  notFoundFalso.mockClear();
  cookiesFalso.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  const { resolverEstados } = await import("@/lib/carimbo-estado");
  vi.mocked(resolverEstados).mockResolvedValue(new Map());
  token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
});
afterEach(() => vi.unstubAllEnvs());

/** O rascunho nasce pela porta de verdade do banco — o mesmo `criarRascunho`
 *  e o mesmo documento que a rota usa. */
async function lugarNovo(): Promise<void> {
  expect(await criarRascunho(cliente, S, docDoLugarNovo(S, NOME), 1)).toBe(true);
}

async function paginaNovo(slug?: string) {
  const { default: Novo } = await import("@/app/admin/novo/page");
  return render(await Novo({ searchParams: Promise.resolve(slug === undefined ? {} : { slug }) }));
}

const pergunta = (caminho: string): HTMLElement => screen.getByTestId(`pergunta-${caminho}`);

/** QUAIS PERGUNTAS, lidas do REGISTRO — e não da lista da página. */
function esperadas(): CampoDaFicha[] {
  const blocos = CAMPOS_DA_FICHA.filter((c) => c.especie === "bloco").map((c) => c.caminho);
  return CAMPOS_DA_FICHA.filter(
    (c) =>
      !blocos.some((b) => c.caminho.startsWith(`${b}.`)) &&
      !(c.especie === "coord" && c.caminho.endsWith("[].lng")),
  );
}
const concreto = (molde: string): string => molde.replace("[]", ".0");

/** O `fetch` dublado que LEVA O PUT À ROTA DE VERDADE — com o cookie da sessão,
 *  no mesmo banco. É o que faz "sai e volta" ser o rascunho de verdade, e não
 *  um mock dizendo que gravou. */
async function comRotaDeVerdade() {
  const rota = await import("@/app/api/admin/rascunho/route");
  const chamadas: { url: string; metodo: string; corpo: Record<string, unknown> }[] = [];
  const fetchFalso = vi.fn(async (url: string, init: { method: string; body: string }) => {
    chamadas.push({ url, metodo: init.method, corpo: JSON.parse(init.body) });
    const req = new Request(`http://x${url}`, {
      method: init.method,
      headers: { cookie: `${COOKIE_ADMIN}=${token}` },
      body: init.body,
    });
    const metodo = init.method as "PUT" | "POST";
    return rota[metodo](req);
  });
  vi.stubGlobal("fetch", fetchFalso);
  const reload = vi.fn();
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload, assign });
  return { fetchFalso, chamadas, reload, assign };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — as perguntas", () => {
  it("o formulário faz uma pergunta por campo do registro, e nenhuma a mais", async () => {
    await lugarNovo();
    await paginaNovo(S);
    const campos = esperadas();
    expect(campos.length, "o registro foi lido vazio: o laço não provaria nada").toBeGreaterThan(20);
    for (const c of campos) {
      expect(screen.getByTestId(`pergunta-${concreto(c.caminho)}`), c.caminho).toBeTruthy();
    }
    expect(screen.getAllByTestId(/^pergunta-/)).toHaveLength(campos.length);
    // e nenhum molde cru chega à tela
    expect(document.body.innerHTML).not.toContain("[]");
  });

  // 🔴 A ORDEM E A REDAÇÃO SÃO DO QUESTIONÁRIO, e isto é PROCEDÊNCIA: cada
  // pergunta da tela é um trecho CONTÍNUO da "Pergunta:" do documento que o
  // João leu (só a primeira letra muda de caixa). Uma palavra minha enfiada
  // numa pergunta deixa este caso vermelho.
  it("cada pergunta é um trecho do questionário, e a ordem da tela é a dele", () => {
    const plano = (s: string) =>
      s
        .replace(/\*\*|\*|`/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
    const doc = plano(readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8"));
    const posicoes: number[] = [];
    for (const molde of ORDEM) {
      const texto = PERGUNTAS[molde];
      if (texto === undefined) continue;
      const onde = doc.indexOf(plano(texto));
      expect(onde, `a pergunta de \`${molde}\` não é trecho do questionário: "${texto}"`).toBeGreaterThan(-1);
      posicoes.push(onde);
    }
    expect(posicoes.length, "nenhuma pergunta do questionário foi medida").toBeGreaterThan(20);
    expect(posicoes, "a ordem da tela não é a do questionário").toEqual([...posicoes].sort((a, b) => a - b));
  });

  // A lista à mão da ordem é vigiada pelo registro, nas duas direções.
  it("ORDEM é exatamente o conjunto de perguntas do registro", () => {
    expect([...ORDEM].sort()).toEqual(esperadas().map((c) => concreto(c.caminho)).sort());
    expect(new Set(ORDEM).size).toBe(ORDEM.length);
  });

  // 🔴 Os campos que o questionário NÃO pergunta caem no rótulo da ficha
  // inteira — nunca numa pergunta inventada. A lista é cravada pra que um campo
  // novo sem pergunta apareça aqui, e no relatório, em vez de passar calado.
  it("campo sem pergunta no questionário mostra o rótulo, e são estes três", async () => {
    const semPergunta = ORDEM.filter((m) => PERGUNTAS[m] === undefined);
    expect(semPergunta.sort()).toEqual([
      "condicao.regra.janela_previsao_horas",
      "condicao.regra.limiar_mm",
      "condicao.severidade",
    ]);
    await lugarNovo();
    await paginaNovo(S);
    for (const m of semPergunta) {
      expect(within(pergunta(concreto(m))).getByText(rotuloDe(concreto(m)))).toBeTruthy();
    }
    for (const m of ORDEM.filter((x) => PERGUNTAS[x] !== undefined)) {
      expect(within(pergunta(concreto(m))).getByText(PERGUNTAS[m])).toBeTruthy();
    }
  });

  it("a tela não traz exemplo nem o caminho velho dos arquivos", async () => {
    await lugarNovo();
    await paginaNovo(S);
    expect(document.body.textContent).not.toMatch(/exemplo/i);
    expect(document.body.textContent).not.toContain("content/fichas");
    expect(screen.getByText(AVISO_RASCUNHO)).toBeTruthy();
  });

  it("pular só aparece nos campos OPCIONAIS, nunca nos obrigatórios", async () => {
    await lugarNovo();
    await paginaNovo(S);
    let opcionais = 0;
    for (const c of esperadas()) {
      const bloco = pergunta(concreto(c.caminho));
      const pular = within(bloco).queryByRole("button", { name: /não sei|não tem|pular/i });
      if (c.obrigatorio) expect(pular, c.caminho).toBeNull();
      else {
        expect(pular, c.caminho).not.toBeNull();
        opcionais++;
      }
    }
    expect(opcionais, "sem opcional nenhum, o ramo de cima não foi medido").toBeGreaterThan(3);
  });

  // Com a resposta DADA, o botão é o "não sei" de sempre (tira a resposta);
  // um só por pergunta — "pular" e "não sei" juntos seriam dois botões pro
  // mesmo silêncio.
  it("opcional respondido: o 'não sei' de sempre, e nenhum 'pular' junto", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME)), piso: "barro" }), 2);
    await paginaNovo(S);
    const botoes = within(pergunta("piso")).getAllByRole("button", { name: /não sei|não tem|pular/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0].textContent).toMatch(/não sei/i);
  });

  it("pular não grava nada: diz que o app vai calar, e o rascunho fica igual", async () => {
    await lugarNovo();
    const { fetchFalso } = await comRotaDeVerdade();
    await paginaNovo(S);
    const antes = (await lerRascunho(cliente, S))!.doc;
    fireEvent.click(within(pergunta("secaRapido")).getByRole("button", { name: PULAR }));
    expect(within(pergunta("secaRapido")).getByText(PULADA)).toBeTruthy();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect((await lerRascunho(cliente, S))!.doc).toBe(antes);
  });

  // 🔴 E8: "nada pré-preenchido" inclui o PLACEHOLDER — exemplo dentro da
  // caixa é resposta plausível de um lugar real que se salva sem querer. Toda
  // caixa, de toda espécie: texto, número, hora, escolha, marcação.
  it("nenhum campo vem com resposta de exemplo dentro da caixa", async () => {
    await lugarNovo();
    const { container } = await paginaNovo(S);
    const nome = pergunta("trajeto.waypoints.0.nome");
    const caixas = [...container.querySelectorAll<HTMLInputElement>("input, textarea, select")];
    expect(caixas.length, "nenhuma caixa lida: o laço ficaria oco").toBeGreaterThan(20);
    for (const caixa of caixas) {
      const onde = caixa.closest("[data-testid]")?.getAttribute("data-testid");
      expect(caixa.getAttribute("placeholder") ?? "", `placeholder em ${onde}`).toBe("");
      if (nome.contains(caixa)) continue; // o nome é o que ELE digitou ao criar
      if (caixa.type === "radio" || caixa.type === "checkbox") expect(caixa.checked, onde!).toBe(false);
      else expect(caixa.value, onde!).toBe("");
    }
    // e o nome é exatamente o que ele digitou, nada além
    expect(within(nome).getByRole("textbox")).toHaveProperty("value", NOME);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — responder, sair e voltar", () => {
  it("sai da tela e volta: o que foi respondido continua lá", async () => {
    await lugarNovo();
    const { chamadas, reload } = await comRotaDeVerdade();
    const { unmount } = await paginaNovo(S);
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), {
      target: { value: "o chao firma em dois dias" },
    });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    await waitFor(() => expect(reload).toHaveBeenCalled());

    // 🔴 pra porta do RASCUNHO, nunca pra da ficha no ar
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/admin/rascunho");
    expect(chamadas[0].metodo).toBe("PUT");
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "voz", valor: "o chao firma em dois dias" });
    expect(await versaoAtual(cliente, S), "o rascunho foi parar no ar").toBeNull();

    unmount();
    await paginaNovo(S);
    expect(within(pergunta("voz")).getByDisplayValue("o chao firma em dois dias")).toBeTruthy();
  });

  // A coordenada de um lugar novo NÃO tem de onde o mapa começar — e começar
  // num ponto qualquer seria um ponto que ninguém deu, salvo com um toque. Ela
  // entra DIGITADA (é o que o questionário pergunta: "a latitude e a
  // longitude"), e só depois o mapa aparece, centrado no que ele digitou.
  it("coordenada sem resposta: duas caixas de número, sem mapa; gravada, o mapa", async () => {
    await lugarNovo();
    const { chamadas } = await comRotaDeVerdade();
    const { unmount } = await paginaNovo(S);
    const ponto = pergunta("trajeto.waypoints.0.lat");
    expect(within(ponto).queryByTestId("mapa-escolher"), "um mapa sem ponto começaria num lugar inventado").toBeNull();
    const [lat, lng] = within(ponto).getAllByRole("spinbutton");
    fireEvent.change(lat, { target: { value: "-8.1" } });
    fireEvent.change(lng, { target: { value: "-35.2" } });
    fireEvent.click(within(ponto).getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].corpo).toEqual({ slug: S, ponto: 0, lat: -8.1, lng: -35.2 });

    const chuva = pergunta("condicao.coords");
    const [clat, clng] = within(chuva).getAllByRole("spinbutton");
    fireEvent.change(clat, { target: { value: "-8.3" } });
    fireEvent.change(clng, { target: { value: "-35.4" } });
    fireEvent.click(within(chuva).getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(chamadas).toHaveLength(2));
    expect(chamadas[1].corpo).toEqual({ slug: S, campo: "condicao.coords", valor: { lat: -8.3, lng: -35.4 } });

    unmount();
    await paginaNovo(S);
    expect(within(pergunta("trajeto.waypoints.0.lat")).getByTestId("mapa-escolher")).toBeTruthy();
    expect(within(pergunta("condicao.coords")).getByTestId("mapa-escolher")).toBeTruthy();
  });

  it("caixa de coordenada vazia não grava", async () => {
    await lugarNovo();
    const { fetchFalso } = await comRotaDeVerdade();
    await paginaNovo(S);
    const ponto = pergunta("trajeto.waypoints.0.lat");
    fireEvent.change(within(ponto).getAllByRole("spinbutton")[0], { target: { value: "-8.1" } });
    fireEvent.click(within(ponto).getByRole("button", { name: /salvar/i }));
    expect(within(ponto).getByRole("alert")).toBeTruthy();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  // A prévia do carimbo pede ao servidor o carimbo do LUGAR com o número novo;
  // um rascunho não tem lugar no ar, e a resposta seria sempre "não consegui
  // conferir". No rascunho, digitar um número não chama rede nenhuma.
  it("número de motor no rascunho: sem prévia, nenhuma ida à rede ao digitar", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await lugarNovo();
      const { fetchFalso } = await comRotaDeVerdade();
      await paginaNovo(S);
      fireEvent.change(within(pergunta("condicao.regra.limiar_mm")).getByRole("spinbutton"), {
        target: { value: "3" },
      });
      vi.advanceTimersByTime(5_000);
      expect(fetchFalso).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("slug sem rascunho — inclusive o de um lugar no ar — é 404, nunca um formulário", async () => {
    await expect(paginaNovo("nao-tem")).rejects.toThrow("NEXT_NOT_FOUND");
    const noAr = (await (await import("@/lib/db")).versoesAtuais(cliente)).keys().next().value as string;
    await expect(paginaNovo(noAr)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await historico(cliente, noAr)).toHaveLength(1);
  });

  it("sem sessão: a caixa de senha, e nenhuma pergunta", async () => {
    await lugarNovo();
    cookiesFalso.mockResolvedValue({ get: () => undefined });
    const { container } = await paginaNovo(S);
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(screen.queryAllByTestId(/^pergunta-/)).toHaveLength(0);
  });

  it("painel desligado: notFound", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    await expect(paginaNovo()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — o lugar novo nasce do nome", () => {
  it("sem slug: só a pergunta do nome, caixa vazia, e começar leva ao rascunho", async () => {
    const { chamadas, assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    expect(screen.getByText(PERGUNTAS["trajeto.waypoints.0.nome"])).toBeTruthy();
    const caixa = screen.getByRole("textbox") as HTMLInputElement;
    expect(caixa.value).toBe("");
    expect(caixa.getAttribute("placeholder") ?? "").toBe("");
    expect(screen.queryAllByTestId(/^pergunta-/)).toHaveLength(0);

    fireEvent.change(caixa, { target: { value: NOME } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(`/admin/novo?slug=${S}`));
    expect(chamadas[0]).toEqual({ url: "/api/admin/rascunho", metodo: "POST", corpo: { nome: NOME } });
    expect(await lerRascunho(cliente, S)).not.toBeNull();
  });

  it("nome de um lugar que já existe: a frase da porta na tela, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const { getAllFichas } = await import("@/lib/ficha");
    const { slugDoNome, JA_EXISTE_LUGAR } = await import("@/lib/rascunho");
    const alvo = (await getAllFichas()).find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: alvo.trajeto.waypoints[0].nome } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(JA_EXISTE_LUGAR)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, alvo.slug)).toBeNull();
    expect(screen.getByRole("button", { name: COMECAR })).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 E5: VOLTAR AO RASCUNHO PRECISA DE PORTA. Medido NA PÁGINA `/admin`, com o
// rascunho no banco: o "+ lugar novo" abre o formulário, e os rascunhos moram
// numa seção SEPARADA — nunca misturados aos lugares que estão no ar.
describe("/admin — a lista ganha a porta do lugar novo e a dos rascunhos", () => {
  async function paginaAdmin() {
    const { default: Admin } = await import("@/app/admin/page");
    return render(await Admin());
  }

  it("'+ lugar novo' leva ao formulário", async () => {
    await paginaAdmin();
    expect(screen.getByRole("link", { name: LUGAR_NOVO }).getAttribute("href")).toBe("/admin/novo");
  });

  it("o rascunho aparece na seção dele, com link pra continuar — e não na lista dos lugares no ar", async () => {
    await lugarNovo();
    const { container } = await paginaAdmin();
    const secao = screen.getByTestId("rascunhos");
    expect(within(secao).getByText(TITULO_RASCUNHOS)).toBeTruthy();
    const link = within(secao).getByRole("link", { name: new RegExp(NOME) });
    expect(link.getAttribute("href")).toBe(`/admin/novo?slug=${S}`);

    const lugares = container.querySelector<HTMLElement>('[data-testid="lugares"]')!;
    expect(lugares, "a premissa: a lista dos lugares no ar existe").not.toBeNull();
    expect(lugares.contains(secao), "a seção de rascunhos está DENTRO da lista dos lugares").toBe(false);
    expect(within(lugares).queryByText(new RegExp(NOME)), "o rascunho entrou na lista dos lugares no ar").toBeNull();
    expect(within(lugares).getAllByRole("link").length, "a premissa: os lugares no ar estão lá").toBeGreaterThan(1);
  });

  it("sem rascunho, a seção não aparece", async () => {
    await paginaAdmin();
    expect(screen.queryByTestId("rascunhos")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 E1 / M8: O FORMULÁRIO DE CLIENTE NÃO IMPORTA O REGISTRO — nem por tabela.
// O guarda é a FONTE, lida pelo parser do TypeScript, seguindo os imports de
// VALOR a partir do `FormularioDeLugar` (os `import type` somem na compilação e
// não pesam no celular). A medição de kB do build é a outra metade, e está no
// relatório; esta é a que roda em todo `npm test`.
describe("o bundle do celular", () => {
  const RAIZ = path.join(process.cwd(), "src");
  const PROIBIDOS = ["@/lib/campos-da-ficha", "@/types/ficha", "zod"];

  /** Os módulos de valor alcançáveis a partir de `inicio`, e cada especificador
   *  de import visto no caminho. */
  function alcancaveis(inicio: string): { arquivos: string[]; especificadores: string[] } {
    const vistos = new Set<string>();
    const especificadores: string[] = [];
    const resolver = (de: string, esp: string): string | null => {
      const base = esp.startsWith("@/") ? path.join(RAIZ, esp.slice(2)) : esp.startsWith(".") ? path.resolve(path.dirname(de), esp) : null;
      if (base === null) return null;
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        try {
          readFileSync(base + ext);
          return base + ext;
        } catch {
          /* tenta a próxima */
        }
      }
      return null;
    };
    const andar = (arquivo: string): void => {
      if (vistos.has(arquivo)) return;
      vistos.add(arquivo);
      const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true);
      for (const n of fonte.statements) {
        if (!ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)) continue;
        if (ts.isImportDeclaration(n) && n.importClause?.isTypeOnly) continue;
        if (ts.isExportDeclaration(n) && n.isTypeOnly) continue;
        const esp = n.moduleSpecifier;
        if (!esp || !ts.isStringLiteral(esp)) continue;
        especificadores.push(esp.text);
        const alvo = resolver(arquivo, esp.text);
        if (alvo) andar(alvo);
      }
    };
    andar(inicio);
    return { arquivos: [...vistos], especificadores };
  }

  it("o FormularioDeLugar não alcança o registro, o schema, nem o zod", () => {
    const { arquivos, especificadores } = alcancaveis(path.join(RAIZ, "app", "admin", "FormularioDeLugar.tsx"));
    // controle de não-vacuidade: o caminhante seguiu os editores de verdade
    expect(arquivos.some((a) => a.endsWith("EditorProsa.tsx")), "o caminhante não seguiu os imports").toBe(true);
    for (const p of PROIBIDOS) expect(especificadores, `o formulário de cliente alcança ${p}`).not.toContain(p);
  });

  // 🔴 E O CAMINHANTE ENXERGA O PROIBIDO quando ele está lá: a página de
  // servidor importa o registro (pelas perguntas), e o mesmo caminhante tem de
  // achá-lo. Sem isto, um caminhante cego passaria o caso de cima.
  it("controle: o mesmo caminhante acha o registro a partir da página de servidor", () => {
    const { especificadores } = alcancaveis(path.join(RAIZ, "app", "admin", "novo", "page.tsx"));
    expect(especificadores).toContain("@/lib/campos-da-ficha");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Classe que a tela usa e a folha não conhece é elemento sem forma (I6 da
// revisão final de 26/09) — e regra sem classe é regra morta. As duas direções,
// pros prefixos desta tarefa.
describe("o formulário e a lista têm regra no admin.css", () => {
  it("toda classe nova tem regra, e nenhuma regra nova sobra", async () => {
    const css = semComentarios("admin/admin.css");
    await lugarNovo();
    await salvarRascunho(
      cliente,
      S,
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME)), horario: { abre: "05:00", fecha: "17:00" } }),
      2,
    );
    const novo = await paginaNovo(S);
    // o "pulada" só existe depois de um toque — sem ele, a regra dela pareceria morta
    fireEvent.click(within(novo.container).getAllByRole("button", { name: PULAR })[0]);
    const { default: Admin } = await import("@/app/admin/page");
    const lista = render(await Admin());
    const semRascunho = await paginaNovo();
    const classes = [novo.container, lista.container, semRascunho.container].flatMap((c) =>
      [...c.querySelectorAll("[class]")].flatMap((e) => [...e.classList]),
    );
    const PREFIXO = /^adm-(novo|pergunta|rascunho)/;
    const nossas = [...new Set(classes.filter((c) => PREFIXO.test(c)))];
    expect(nossas.length, "nenhuma classe desta tarefa foi lida").toBeGreaterThan(4);
    for (const c of nossas) expect(regraDe(css, `.${c}`), `.${c} sem regra no admin.css`).not.toBeNull();
    const regras = [...css.matchAll(/\.(adm-(?:novo|pergunta|rascunho)[a-z-]*)\s*[,{:]/g)].map((m) => m[1]);
    expect(regras.length).toBeGreaterThan(4);
    for (const r of new Set(regras)) expect(nossas, `.${r} tem regra e nenhuma tela usa`).toContain(r);
  });
});
