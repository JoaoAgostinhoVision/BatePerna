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
import { ORDEM, PERGUNTAS, escolherPosicao } from "@/app/admin/novo/perguntas";
import {
  ANTERIOR,
  AVISO_RASCUNHO,
  COMECAR,
  PROXIMA,
  PULADA,
  PULAR,
  RESPONDIDA,
  SEM_RESPOSTA,
  enderecoDaPergunta,
  posicaoNaTela,
} from "@/app/admin/FormularioDeLugar";
import EditorProsa from "@/app/admin/campos/EditorProsa";
import { ERRO_REDE } from "@/app/admin/campos/gravar";
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
const CIDADE = "Cidade Marcador Um";
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
  expect(await criarRascunho(cliente, S, docDoLugarNovo(S, NOME, CIDADE), 1)).toBe(true);
}

async function paginaNovo(slug?: string, p?: string | string[]) {
  const { default: Novo } = await import("@/app/admin/novo/page");
  const params: { slug?: string; p?: string | string[] } = {};
  if (slug !== undefined) params.slug = slug;
  if (p !== undefined) params.p = p;
  return render(await Novo({ searchParams: Promise.resolve(params) }));
}

const pergunta = (caminho: string): HTMLElement => screen.getByTestId(`pergunta-${caminho}`);

/** O caminho de cada pergunta que a tela mostra agora (o `data-testid`). */
const naTela = (): string[] =>
  screen.queryAllByTestId(/^pergunta-/).map((e) => e.getAttribute("data-testid")!.slice("pergunta-".length));

/** A posição (1…M) de uma pergunta na ordem da tela. */
function posDe(caminho: string): number {
  const i = ORDEM.indexOf(caminho);
  expect(i, `${caminho} não está na ordem`).toBeGreaterThan(-1);
  return i + 1;
}
const telaDe = (caminho: string) => paginaNovo(S, String(posDe(caminho)));

/** 🔴 TODAS AS TELAS, uma por uma, de `p=1` a `p=M` — com M lido do REGISTRO,
 *  nunca da página. Cada tela é desmontada antes da próxima. */
async function porTodasAsTelas(fn: (n: number, container: HTMLElement) => void | Promise<void>): Promise<number> {
  const total = esperadas().length;
  for (let n = 1; n <= total; n++) {
    const { container } = await paginaNovo(S, String(n));
    await fn(n, container);
    cleanup();
  }
  return total;
}

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

/** O campo do registro de um caminho concreto da tela. */
function campoDe(concretoDaTela: string): CampoDaFicha {
  const c = esperadas().find((x) => concreto(x.caminho) === concretoDaTela);
  expect(c, `${concretoDaTela} não é campo do registro`).toBeDefined();
  return c!;
}

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — as perguntas", () => {
  // 🔴 UMA PERGUNTA POR VEZ (decisão dele, 03/10): cada tela tem EXATAMENTE
  // uma, e a UNIÃO das telas 1…M é o registro — cada campo uma vez só, na ordem
  // do questionário.
  it("o formulário faz uma pergunta por campo do registro, e nenhuma a mais", async () => {
    await lugarNovo();
    const campos = esperadas();
    expect(campos.length, "o registro foi lido vazio: o laço não provaria nada").toBeGreaterThan(20);
    const vistas: string[] = [];
    const total = await porTodasAsTelas((n) => {
      const aqui = naTela();
      expect(aqui, `a tela ${n} não tem exatamente uma pergunta`).toHaveLength(1);
      vistas.push(aqui[0]);
      expect(screen.getByText(posicaoNaTela(n, campos.length)), `tela ${n}`).toBeTruthy();
      // e nenhum molde cru chega à tela
      expect(document.body.innerHTML).not.toContain("[]");
    });
    expect(vistas).toHaveLength(total);
    expect(new Set(vistas).size, "a mesma pergunta apareceu em duas telas").toBe(vistas.length);
    expect([...vistas].sort()).toEqual(campos.map((c) => concreto(c.caminho)).sort());
    expect(vistas, "a ordem das telas não é a do questionário").toEqual([...ORDEM]);
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
    let medidas = 0;
    await porTodasAsTelas(() => {
      const [m] = naTela();
      const texto = PERGUNTAS[m] ?? rotuloDe(m);
      if (semPergunta.includes(m)) expect(PERGUNTAS[m]).toBeUndefined();
      expect(within(pergunta(m)).getByText(texto), m).toBeTruthy();
      medidas++;
    });
    expect(medidas).toBe(ORDEM.length);
  });

  it("a tela não traz exemplo nem o caminho velho dos arquivos", async () => {
    await lugarNovo();
    await porTodasAsTelas((n) => {
      expect(document.body.textContent, `tela ${n}`).not.toMatch(/exemplo/i);
      expect(document.body.textContent, `tela ${n}`).not.toContain("content/fichas");
      expect(screen.getByText(AVISO_RASCUNHO), `tela ${n}`).toBeTruthy();
    });
  });

  it("pular só aparece nos campos OPCIONAIS, nunca nos obrigatórios", async () => {
    await lugarNovo();
    let opcionais = 0;
    let obrigatorios = 0;
    await porTodasAsTelas(() => {
      const [m] = naTela();
      const c = campoDe(m);
      const pular = within(pergunta(m)).queryByRole("button", { name: /não sei|não tem|pular/i });
      if (c.obrigatorio) {
        expect(pular, m).toBeNull();
        obrigatorios++;
      } else {
        expect(pular, m).not.toBeNull();
        opcionais++;
      }
    });
    expect(opcionais, "sem opcional nenhum, o ramo de cima não foi medido").toBeGreaterThan(3);
    expect(obrigatorios, "sem obrigatório nenhum, o ramo de cima não foi medido").toBeGreaterThan(3);
  });

  // Com a resposta DADA, o botão é o "não sei" de sempre (tira a resposta);
  // um só por pergunta — "pular" e "não sei" juntos seriam dois botões pro
  // mesmo silêncio.
  it("opcional respondido: o 'não sei' de sempre, e nenhum 'pular' junto", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), piso: "barro" }), 2);
    await telaDe("piso");
    const botoes = within(pergunta("piso")).getAllByRole("button", { name: /não sei|não tem|pular/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0].textContent).toMatch(/não sei/i);
  });

  // Pular é um ato (o dono dizendo que não vai responder), e como o Salvar,
  // AVANÇA — sem gravar nada: a ausência já é o "não sei" no documento.
  it("pular não grava nada: diz que o app vai calar, o rascunho fica igual, e vai pra próxima", async () => {
    await lugarNovo();
    const { fetchFalso, assign, reload } = await comRotaDeVerdade();
    await telaDe("secaRapido");
    const antes = (await lerRascunho(cliente, S))!.doc;
    fireEvent.click(within(pergunta("secaRapido")).getByRole("button", { name: PULAR }));
    expect(within(pergunta("secaRapido")).getByText(PULADA)).toBeTruthy();
    expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe("secaRapido") + 1));
    expect(reload).not.toHaveBeenCalled();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect((await lerRascunho(cliente, S))!.doc).toBe(antes);
  });

  it("pular na ÚLTIMA pergunta: fica nela", async () => {
    await lugarNovo();
    const { assign, reload } = await comRotaDeVerdade();
    const ultima = ORDEM[ORDEM.length - 1];
    expect(campoDe(ultima).obrigatorio, "a premissa: a última é opcional").toBe(false);
    await telaDe(ultima);
    fireEvent.click(within(pergunta(ultima)).getByRole("button", { name: PULAR }));
    expect(within(pergunta(ultima)).getByText(PULADA)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  // 🔴 E8: "nada pré-preenchido" inclui o PLACEHOLDER — exemplo dentro da
  // caixa é resposta plausível de um lugar real que se salva sem querer. Toda
  // caixa, de toda espécie, em TODA tela: texto, número, hora, escolha, marcação.
  it("nenhum campo vem com resposta de exemplo dentro da caixa", async () => {
    await lugarNovo();
    let lidas = 0;
    // O nome e a cidade são o que ELE digitou ao criar (Tarefa 11b) — e são
    // exatamente isso, nada além.
    const DIGITADOS: Record<string, string> = { "trajeto.waypoints.0.nome": NOME, cidade: CIDADE };
    const conferidos = new Set<string>();
    await porTodasAsTelas((n, container) => {
      const [m] = naTela();
      const caixas = [...container.querySelectorAll<HTMLInputElement>("input, textarea, select")];
      expect(caixas.length, `a tela ${n} não tem caixa nenhuma`).toBeGreaterThan(0);
      for (const caixa of caixas) {
        lidas++;
        expect(caixa.getAttribute("placeholder") ?? "", `placeholder em ${m}`).toBe("");
        if (m in DIGITADOS) continue;
        if (caixa.type === "radio" || caixa.type === "checkbox") expect(caixa.checked, m).toBe(false);
        else expect(caixa.value, m).toBe("");
      }
      if (m in DIGITADOS) {
        expect(within(pergunta(m)).getByRole("textbox")).toHaveProperty("value", DIGITADOS[m]);
        conferidos.add(m);
      }
    });
    expect(lidas, "nenhuma caixa lida: o laço ficaria oco").toBeGreaterThan(20);
    expect([...conferidos].sort()).toEqual(Object.keys(DIGITADOS).sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 R1: A POSIÇÃO MORA NA URL (`?slug=X&p=N`), e `p` torto nunca é 500 nem
// tela vazia — cai na primeira pergunta ainda sem resposta (ou na 1ª, se todas
// tiverem).
describe("/admin/novo — a posição mora na URL", () => {
  it("escolherPosicao: cada borda de p", () => {
    const r = [true, false, true, false];
    // válido: é ele
    expect(escolherPosicao("1", r)).toBe(1);
    expect(escolherPosicao("3", r)).toBe(3);
    expect(escolherPosicao("4", r)).toBe(4);
    // torto: a primeira sem resposta (a 2ª)
    for (const p of [undefined, "", "abc", "0", "-1", "5", "99", "1.5", "2x", " 3", "1e0", ["1", "3"], []]) {
      expect(escolherPosicao(p as string | string[] | undefined, r), JSON.stringify(p)).toBe(2);
    }
    // todas respondidas: a 1ª
    expect(escolherPosicao(undefined, [true, true, true])).toBe(1);
    expect(escolherPosicao("9", [true, true, true])).toBe(1);
    // nenhuma respondida: a 1ª
    expect(escolherPosicao(undefined, [false, false])).toBe(1);
  });

  it("na página: p torto cai na 1ª sem resposta; p válido é obedecido", async () => {
    await lugarNovo();
    const total = esperadas().length;
    // o nome e a cidade já estão respondidos (é deles que o rascunho nasce): a
    // 1ª sem resposta é a 3ª
    expect(ORDEM.slice(0, 2), "a premissa: as duas primeiras são o nome e a cidade").toEqual([
      "trajeto.waypoints.0.nome",
      "cidade",
    ]);
    for (const p of [undefined, "", "abc", "0", "-2", String(total + 1), "1.5", ["3", "4"]]) {
      await paginaNovo(S, p);
      expect(naTela(), JSON.stringify(p)).toEqual([ORDEM[2]]);
      expect(screen.getByText(posicaoNaTela(3, total)), JSON.stringify(p)).toBeTruthy();
      cleanup();
    }
    await paginaNovo(S, "5");
    expect(naTela()).toEqual([ORDEM[4]]);
    cleanup();
    await paginaNovo(S, "1");
    expect(naTela()).toEqual([ORDEM[0]]);
  });

  // 🔴 R5: quem volta pelo link do rascunho na lista do painel (que não leva
  // `p`) cai na primeira pergunta SEM resposta — e não no começo de novo.
  it("sai e volta pela lista do painel: cai na primeira pergunta sem resposta", async () => {
    await lugarNovo();
    const doc = JSON.parse(docDoLugarNovo(S, NOME, CIDADE));
    doc.trajeto.waypoints[0] = { ...doc.trajeto.waypoints[0], lat: -8.1, lng: -35.2 };
    await salvarRascunho(cliente, S, JSON.stringify(doc), 2);
    const { default: Admin } = await import("@/app/admin/page");
    render(await Admin());
    const href = within(screen.getByTestId("rascunhos")).getByRole("link", { name: new RegExp(NOME) }).getAttribute("href")!;
    cleanup();
    const params = new URL(href, "http://x").searchParams;
    expect(params.get("p"), "a premissa: o link da lista não leva posição").toBeNull();
    await paginaNovo(params.get("slug")!);
    expect(naTela()).toEqual([ORDEM[3]]);
    expect(screen.getByText(posicaoNaTela(4, esperadas().length))).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 R3: ANDAR SEM GRAVAR. "Anterior" e "Próxima" são LINKS — servem pra voltar
// a uma resposta ou deixar uma obrigatória pra depois (rascunho é incompleto
// por natureza). E a lista de saltos diz quais já têm resposta.
describe("/admin/novo — andar entre as perguntas", () => {
  it("primeira: só 'Próxima'; do meio: as duas; última: só 'Anterior' — e são links", async () => {
    await lugarNovo();
    const total = esperadas().length;
    await paginaNovo(S, "1");
    expect(screen.queryByRole("link", { name: ANTERIOR })).toBeNull();
    expect(screen.getByRole("link", { name: PROXIMA }).getAttribute("href")).toBe(enderecoDaPergunta(S, 2));
    cleanup();
    await paginaNovo(S, "5");
    expect(screen.getByRole("link", { name: ANTERIOR }).getAttribute("href")).toBe(enderecoDaPergunta(S, 4));
    expect(screen.getByRole("link", { name: PROXIMA }).getAttribute("href")).toBe(enderecoDaPergunta(S, 6));
    expect(screen.queryByRole("button", { name: new RegExp(`${ANTERIOR}|${PROXIMA}`) })).toBeNull();
    cleanup();
    await paginaNovo(S, String(total));
    expect(screen.getByRole("link", { name: ANTERIOR }).getAttribute("href")).toBe(enderecoDaPergunta(S, total - 1));
    expect(screen.queryByRole("link", { name: PROXIMA })).toBeNull();
  });

  it("andar não grava nada", async () => {
    await lugarNovo();
    const { fetchFalso } = await comRotaDeVerdade();
    await paginaNovo(S, "5");
    // o jsdom não navega; o toque no link tem de chegar, e não sair dali
    const parar = (e: Event) => e.preventDefault();
    document.addEventListener("click", parar);
    try {
      fireEvent.click(screen.getByRole("link", { name: PROXIMA }));
      fireEvent.click(screen.getByRole("link", { name: ANTERIOR }));
    } finally {
      document.removeEventListener("click", parar);
    }
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a lista de saltos: uma por pergunta, cada uma marcada respondida ou sem resposta", async () => {
    await lugarNovo();
    await salvarRascunho(
      cliente,
      S,
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), voz: "frase marcadora" }),
      2,
    );
    const total = esperadas().length;
    await paginaNovo(S, "4");
    const saltos = within(screen.getByTestId("saltos")).getAllByRole("link");
    expect(saltos).toHaveLength(total);
    const respondidas = new Set([posDe("trajeto.waypoints.0.nome"), posDe("cidade"), posDe("voz")]);
    saltos.forEach((a, i) => {
      const n = i + 1;
      expect(a.getAttribute("href"), `salto ${n}`).toBe(enderecoDaPergunta(S, n));
      expect(a.getAttribute("aria-label"), `salto ${n}`).toBe(
        `${posicaoNaTela(n, total)}: ${respondidas.has(n) ? RESPONDIDA : SEM_RESPOSTA}`,
      );
      expect(a.getAttribute("aria-current"), `salto ${n}`).toBe(n === 4 ? "step" : null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — responder, sair e voltar", () => {
  // 🔴 R2: gravar com sucesso AVANÇA pra próxima pergunta (`location.assign`),
  // e não recarrega a mesma.
  it("sai da tela e volta: o que foi respondido continua lá", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    const { unmount } = await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), {
      target: { value: "o chao firma em dois dias" },
    });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe("voz") + 1)));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    // 🔴 pra porta do RASCUNHO, nunca pra da ficha no ar
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/admin/rascunho");
    expect(chamadas[0].metodo).toBe("PUT");
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "voz", valor: "o chao firma em dois dias" });
    expect(await versaoAtual(cliente, S), "o rascunho foi parar no ar").toBeNull();

    unmount();
    await telaDe("voz");
    expect(within(pergunta("voz")).getByDisplayValue("o chao firma em dois dias")).toBeTruthy();
  });

  // 🔴 Y2 DA ONDA DE FIX 2 DA 11b: corrigir a cidade (ou o nome) muda o
  // endereço do rascunho, e a próxima pergunta é a do endereço DEVOLVIDO pela
  // porta — nunca a do slug velho, que já não existe.
  it("corrigir a cidade: vai pra próxima pergunta no endereço NOVO, que a porta devolveu", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    await telaDe("cidade");
    fireEvent.change(within(pergunta("cidade")).getByRole("textbox"), { target: { value: "Cidade Marcador Dois" } });
    fireEvent.click(pergunta("cidade").querySelector('[data-salvar="cidade"]')!);
    const novo = "lugar-marcador-um-cidade-marcador-dois";
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(novo, posDe("cidade") + 1)));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "cidade", valor: "Cidade Marcador Dois" });
    expect(await lerRascunho(cliente, S)).toBeNull();
    expect(JSON.parse((await lerRascunho(cliente, novo))!.doc).cidade).toBe("Cidade Marcador Dois");
  });

  it("gravar na ÚLTIMA pergunta: fica na última", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    const ultima = ORDEM[ORDEM.length - 1];
    const total = esperadas().length;
    expect(posDe(ultima)).toBe(total);
    await telaDe(ultima);
    fireEvent.click(within(pergunta(ultima)).getAllByRole("checkbox")[0]);
    fireEvent.click(pergunta(ultima).querySelector(`[data-salvar="${ultima}"]`)!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, total)));
    expect(chamadas).toHaveLength(1);
    expect(reload).not.toHaveBeenCalled();
  });

  // Erro de gravação NÃO avança: a frase da porta aparece, e ele fica na
  // pergunta, com o que digitou na caixa.
  it("recusa da porta: a frase na tela, e não sai da pergunta", async () => {
    await lugarNovo();
    const FRASE = "Frase marcadora da recusa.";
    const fetchFalso = vi.fn(async () => new Response(FRASE, { status: 409 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), { target: { value: "texto marcador" } });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    expect(await within(pergunta("voz")).findByText(FRASE)).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(within(pergunta("voz")).getByDisplayValue("texto marcador")).toBeTruthy();
  });

  // 🔴 ONDA 3 (m-A da re-revisão): a falha de REDE também não avança. No
  // celular com sinal ruim, avançar jogaria fora o texto que ele acabou de
  // escrever — e a mutação "a rede navega" sobrevivia à suíte inteira.
  it("falha de rede: 'Sem rede.' na tela, e não sai da pergunta", async () => {
    await lugarNovo();
    const fetchFalso = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), { target: { value: "texto marcador" } });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    expect(await within(pergunta("voz")).findByText(ERRO_REDE)).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(within(pergunta("voz")).getByDisplayValue("texto marcador")).toBeTruthy();
  });

  // 🔴 O PADRÃO NÃO MUDOU: fora do formulário de lugar novo (a `FichaInteira`
  // não monta provedor), um editor que grava RECARREGA a página, como antes, e
  // não navega pra lugar nenhum.
  it("editor sem provedor (a ficha no ar): gravar recarrega, e não navega", async () => {
    const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    render(
      <EditorProsa
        campo={{ caminho: "voz", rotulo: "voz", obrigatorio: true }}
        valor="frase marcadora"
        slug="lugar-marcador-no-ar"
      />,
    );
    fireEvent.click(document.querySelector('[data-salvar="voz"]')!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
    expect((fetchFalso.mock.calls[0] as unknown as [string])[0]).toBe("/api/admin/ficha");
  });

  // A coordenada de um lugar novo NÃO tem de onde o mapa começar — e começar
  // num ponto qualquer seria um ponto que ninguém deu, salvo com um toque. Ela
  // entra DIGITADA (é o que o questionário pergunta: "a latitude e a
  // longitude"), e só depois o mapa aparece, centrado no que ele digitou.
  it("coordenada sem resposta: duas caixas de número, sem mapa; gravada, o mapa", async () => {
    await lugarNovo();
    const { chamadas } = await comRotaDeVerdade();
    const primeira = await telaDe("trajeto.waypoints.0.lat");
    const ponto = pergunta("trajeto.waypoints.0.lat");
    expect(within(ponto).queryByTestId("mapa-escolher"), "um mapa sem ponto começaria num lugar inventado").toBeNull();
    const [lat, lng] = within(ponto).getAllByRole("spinbutton");
    fireEvent.change(lat, { target: { value: "-8.1" } });
    fireEvent.change(lng, { target: { value: "-35.2" } });
    fireEvent.click(within(ponto).getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].corpo).toEqual({ slug: S, ponto: 0, lat: -8.1, lng: -35.2 });
    primeira.unmount();

    const segunda = await telaDe("condicao.coords");
    const chuva = pergunta("condicao.coords");
    const [clat, clng] = within(chuva).getAllByRole("spinbutton");
    fireEvent.change(clat, { target: { value: "-8.3" } });
    fireEvent.change(clng, { target: { value: "-35.4" } });
    fireEvent.click(within(chuva).getByRole("button", { name: /salvar/i }));
    await waitFor(() => expect(chamadas).toHaveLength(2));
    expect(chamadas[1].corpo).toEqual({ slug: S, campo: "condicao.coords", valor: { lat: -8.3, lng: -35.4 } });

    segunda.unmount();
    const terceira = await telaDe("trajeto.waypoints.0.lat");
    expect(within(pergunta("trajeto.waypoints.0.lat")).getByTestId("mapa-escolher")).toBeTruthy();
    terceira.unmount();
    await telaDe("condicao.coords");
    expect(within(pergunta("condicao.coords")).getByTestId("mapa-escolher")).toBeTruthy();
  });

  it("caixa de coordenada vazia não grava", async () => {
    await lugarNovo();
    const { fetchFalso } = await comRotaDeVerdade();
    await telaDe("trajeto.waypoints.0.lat");
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
      await telaDe("condicao.regra.limiar_mm");
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
describe("/admin/novo — o lugar novo nasce do nome e da cidade", () => {
  // 🔴 TAREFA 11b: o lugar nasce com as DUAS respostas — o nome e a cidade, as
  // duas caixas vazias e sem placeholder (nada pré-preenchido, spec §4.4).
  it("sem slug: só as perguntas do nome e da cidade, caixas vazias, e começar leva ao rascunho", async () => {
    const { chamadas, assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const caixaDo = (texto: string) => screen.getByRole("textbox", { name: texto }) as HTMLInputElement;
    const nome = caixaDo(PERGUNTAS["trajeto.waypoints.0.nome"]);
    const cidade = caixaDo(PERGUNTAS.cidade);
    expect(screen.getAllByRole("textbox"), "uma caixa a mais ou a menos").toHaveLength(2);
    for (const caixa of [nome, cidade]) {
      expect(caixa.value).toBe("");
      expect(caixa.getAttribute("placeholder") ?? "").toBe("");
    }
    expect(screen.queryAllByTestId(/^pergunta-/)).toHaveLength(0);

    fireEvent.change(nome, { target: { value: NOME } });
    fireEvent.change(cidade, { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    const nasce = "lugar-marcador-um-cidade-marcador-um";
    await waitFor(() => expect(assign).toHaveBeenCalledWith(`/admin/novo?slug=${nasce}`));
    expect(chamadas[0]).toEqual({ url: "/api/admin/rascunho", metodo: "POST", corpo: { nome: NOME, cidade: CIDADE } });
    expect(JSON.parse((await lerRascunho(cliente, nasce))!.doc).cidade).toBe(CIDADE);
  });

  it("sem a cidade: a frase da porta na tela, o nome fica na caixa, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const { CIDADE_VAZIA } = await import("@/lib/rascunho");
    const nome = screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }) as HTMLInputElement;
    fireEvent.change(nome, { target: { value: NOME } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(CIDADE_VAZIA)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(nome.value).toBe(NOME);
    expect(await lerRascunho(cliente, "lugar-marcador-um-cidade-marcador-um")).toBeNull();
  });

  // A INVERSÃO DA INVERSÃO (onda de fix da 11b, X2): o nome de um lugar que já
  // está no ar SEM cidade (como os de hoje) não nasce — a tela mostra a frase
  // que pede a cidade DAQUELE, e o que ele digitou fica nas caixas.
  it("nome de um lugar que já existe SEM cidade: a frase pede a cidade dele, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const { getAllFichas } = await import("@/lib/ficha");
    const { gemeoSemCidade, slugDoNome } = await import("@/lib/rascunho");
    const alvo = (await getAllFichas()).find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    expect(alvo.cidade, "a premissa: os lugares de hoje não têm cidade").toBeUndefined();
    const nome = screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }) as HTMLInputElement;
    fireEvent.change(nome, { target: { value: alvo.trajeto.waypoints[0].nome } });
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS.cidade }), { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(gemeoSemCidade(alvo.trajeto.waypoints[0].nome))).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(nome.value).toBe(alvo.trajeto.waypoints[0].nome);
    expect(await lerRascunho(cliente, `${alvo.slug}-cidade-marcador-um`)).toBeNull();
    expect(await historico(cliente, alvo.slug)).toHaveLength(1);
  });

  it("nome e cidade de um rascunho que já existe: a frase da porta na tela, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { parDeRascunho } = await import("@/lib/rascunho");
    await lugarNovo();
    const { container } = await paginaNovo();
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }), {
      target: { value: NOME },
    });
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS.cidade }), { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(parDeRascunho(`${NOME} (${CIDADE})`))).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, "lugar-marcador-um-cidade-marcador-um")).toBeNull();
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

  // 🔴 TAREFA 11b: a cidade aparece onde o nome aparece pra ESCOLHER — dois
  // rascunhos de mesmo nome só se distinguem por ela.
  it("o rascunho mostra a cidade dele junto do nome, dentro do item", async () => {
    await lugarNovo();
    await paginaAdmin();
    const item = screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;
    expect(item, "a premissa: o item do rascunho existe").not.toBeNull();
    expect(within(item).getByText(NOME)).toBeTruthy();
    expect(within(item).getByText(CIDADE)).toBeTruthy();
  });

  it("rascunho SEM cidade (nascido antes da 11b): só o nome, e nenhuma palavra no lugar dela", async () => {
    expect(await criarRascunho(cliente, S, JSON.stringify({ slug: S, modos: [], trajeto: { waypoints: [{ nome: NOME }] } }), 1)).toBe(true);
    await paginaAdmin();
    const item = screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;
    expect(item.textContent).toBe(NOME);
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
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), horario: { abre: "05:00", fecha: "17:00" } }),
      2,
    );
    await comRotaDeVerdade();
    // uma tela do MEIO (as duas setas) com um opcional sem resposta (o "pular")
    const novo = await telaDe("piso");
    // o "pulada" só existe depois de um toque — sem ele, a regra dela pareceria morta
    fireEvent.click(within(novo.container).getByRole("button", { name: PULAR }));
    // e outra tela com o "pular" ainda de pé (o toque acima o trocou pelo "pulada")
    const outra = await telaDe("secaRapido");
    const { default: Admin } = await import("@/app/admin/page");
    const lista = render(await Admin());
    const semRascunho = await paginaNovo();
    const classes = [novo.container, outra.container, lista.container, semRascunho.container].flatMap((c) =>
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
