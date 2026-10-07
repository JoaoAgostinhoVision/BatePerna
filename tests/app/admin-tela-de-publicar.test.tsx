import { readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { historico, lerRascunho, versaoAtual } from "@/lib/db";
import { oQueOAppCala } from "@/lib/o-que-o-app-cala";
import { FALTA_OBRIGATORIO } from "@/lib/porta-de-publicar";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { nomeComCidade } from "@/lib/rascunho";
import TelaDePublicar, { PUBLICANDO, PUBLICAR, TITULO_CALA, TITULO_FALTA } from "@/app/admin/TelaDePublicar";
import { ERRO_GRAVAR, ERRO_REDE } from "@/app/admin/campos/gravar";
import { enderecoDaPergunta } from "@/app/admin/novo/enderecos";
import { ORDEM, PERGUNTAS, montarPerguntas } from "@/app/admin/novo/perguntas";
import { bancoVazio, salvarRascunho, semearAcervo } from "../banco";
import { rascunhoCompleto } from "../rascunho-completo";

/** A TELA DE PUBLICAR (Tarefa 12) — o componente, com frases montadas à mão (I7
 *  da auditoria de 06/10: o componente é de cliente e recebe as frases PRONTAS),
 *  e a PÁGINA de servidor `/admin/novo/publicar`, contra o banco, que é quem as
 *  monta.
 *
 *  Nenhum lugar real: nomes e cidades são marcadores. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-publicar-tela";
const NOME = "Lugar Marcador Tela";
const CIDADE = "Cidade Marcador Tela";
const S = "lugar-marcador-tela-cidade-marcador-tela";
const ATUALIZADO = 1_758_300_000;

const FRASES_A_MAO = ["Uma frase marcadora do que o app cala.", "Outra frase marcadora do que o app cala."];

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

let token: string;

beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      throw new Error(`fetch sem dublê neste teste: ${url}`);
    }),
  );
  cliente = bancoVazio();
  await semearAcervo(cliente);
  notFoundFalso.mockClear();
  cookiesFalso.mockReset();
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** O `fetch` que leva o POST da tela à ROTA DE VERDADE, com o cookie, no mesmo
 *  banco — e o `location` dublado, que o jsdom não navega. */
async function comRotaDeVerdade() {
  const rota = await import("@/app/api/admin/publicar/route");
  const corpos: Record<string, unknown>[] = [];
  const fetchFalso = vi.fn(async (url: string, init: { method: string; body: string }) => {
    corpos.push(JSON.parse(init.body));
    return rota.POST(
      new Request(`http://x${url}`, { method: init.method, headers: { cookie: `${COOKIE_ADMIN}=${token}` }, body: init.body }),
    );
  });
  vi.stubGlobal("fetch", fetchFalso);
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  return { fetchFalso, corpos, assign };
}

async function paginaPublicar(slug: string) {
  const { default: Publicar } = await import("@/app/admin/novo/publicar/page");
  return render(await Publicar({ searchParams: Promise.resolve({ slug }) }));
}

const semCampo = (doc: Record<string, unknown>, ...chaves: string[]): Record<string, unknown> => {
  const copia = structuredClone(doc);
  for (const k of chaves) delete copia[k];
  return copia;
};

// ═══════════════════════════════════════════════════════════════════════════
describe("TelaDePublicar — o componente", () => {
  it("a tela de publicar mostra, por extenso, o que o app vai calar", () => {
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={FRASES_A_MAO} />);
    const lista = screen.getByTestId("cala");
    expect(within(lista).getByText(TITULO_CALA)).toBeTruthy();
    for (const frase of FRASES_A_MAO) expect(within(lista).getByText(frase)).toBeTruthy();
  });

  // 🔴 Calar é permitido — é a régua do app inteiro. A lista existe pra ele
  // VER o preço da honestidade, não pra bloquear a publicação.
  it("o botão de publicar não some por causa dos campos vazios", () => {
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={FRASES_A_MAO} />);
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("publicar manda o slug e o atualizadoEm que a tela recebeu, e no 200 vai pro painel do lugar", async () => {
    const corpos: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        corpos.push(JSON.parse(init.body));
        return Response.json({ slug: S });
      }),
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(corpos).toEqual([{ slug: S, atualizadoEm: ATUALIZADO }]);
    expect(assign).toHaveBeenCalledWith(`/admin/${S}`);
  });

  it("recusa: a frase da porta aparece como chegou, ninguém navega, e o botão volta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Frase marcadora da porta.", { status: 409 })));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Frase marcadora da porta.");
    expect(assign).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  // A frase do componente quando a porta não dá a dela: sem rede, e a resposta
  // de erro com corpo VAZIO. Nenhuma das duas pode virar silêncio.
  it("sem rede: a frase de sem rede, e o botão volta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe(ERRO_REDE);
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("erro com corpo vazio: a frase de não consegui salvar, nunca um alerta vazio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe(ERRO_GRAVAR);
  });

  // 🔴 O DUPLO TOQUE (M4) NÃO CHEGA A SAIR: com o pedido andando, o botão está
  // desligado e diz que está publicando, e o segundo toque não manda nada.
  it("com o pedido andando: o botão desliga, diz que publica, e o segundo toque não sai", async () => {
    let soltar: (r: Response) => void = () => {};
    const fetchFalso = vi.fn(() => new Promise<Response>((ok) => { soltar = ok; }));
    vi.stubGlobal("fetch", fetchFalso);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TelaDePublicar slug={S} atualizadoEm={ATUALIZADO} frases={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    const botao = screen.getByRole("button", { name: PUBLICANDO }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(botao);
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await act(async () => {
      soltar(Response.json({ slug: S }));
    });
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo/publicar — a página, contra o banco", () => {
  it("as frases são as do rascunho guardado, por extenso, e o botão está lá", async () => {
    const doc = semCampo(rascunhoCompleto(S, NOME, CIDADE), "piso", "secaRapido");
    await salvarRascunho(cliente, S, JSON.stringify(doc), ATUALIZADO);
    await paginaPublicar(S);
    const frases = oQueOAppCala(doc);
    expect(frases, "a premissa: o rascunho cala duas coisas").toHaveLength(2);
    const lista = screen.getByTestId("cala");
    for (const frase of frases) expect(within(lista).getByText(frase)).toBeTruthy();
    expect(screen.queryByTestId("falta"), "um rascunho completo não tem o que faltar").toBeNull();
    // O lugar pelo NOME e pela cidade — nunca pelo endereço.
    expect(screen.getByText(nomeComCidade(NOME, CIDADE))).toBeTruthy();
    expect(screen.queryByText(S)).toBeNull();
    expect((screen.getByRole("button", { name: PUBLICAR }) as HTMLButtonElement).disabled).toBe(false);
  });

  // 🔴 A FIAÇÃO INTEIRA: o `atualizado_em` que a PÁGINA leu desce até a porta, e
  // a porta põe o lugar no ar — sem nenhum valor escrito à mão no meio.
  it("publicar pela tela põe o lugar no ar: o pedido leva o atualizado_em que a página leu", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(rascunhoCompleto(S, NOME, CIDADE)), ATUALIZADO);
    const { corpos, assign } = await comRotaDeVerdade();
    await paginaPublicar(S);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(corpos).toEqual([{ slug: S, atualizadoEm: ATUALIZADO }]);
    expect(assign).toHaveBeenCalledWith(`/admin/${S}`);
    expect((await versaoAtual(cliente, S))?.autor).toBe("painel");
    expect(await lerRascunho(cliente, S)).toBeNull();
  });

  it("o que falta: cada obrigatória sem resposta, com o link da pergunta dela; e a porta recusa com a frase", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(semCampo(rascunhoCompleto(S, NOME, CIDADE), "voz")), ATUALIZADO);
    await comRotaDeVerdade();
    await paginaPublicar(S);
    const falta = screen.getByTestId("falta");
    expect(within(falta).getByText(TITULO_FALTA)).toBeTruthy();
    const links = within(falta).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe(PERGUNTAS.voz);
    expect(links[0].getAttribute("href")).toBe(enderecoDaPergunta(S, ORDEM.indexOf("voz") + 1));
    // O botão continua lá — quem recusa é a porta, e diz por quê.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: PUBLICAR }));
    });
    expect(screen.getByRole("alert").textContent).toBe(FALTA_OBRIGATORIO);
    expect(await historico(cliente, S)).toEqual([]);
    expect(await lerRascunho(cliente, S)).not.toBeNull();
  });

  it("slug sem rascunho — inclusive o de um lugar no ar — é 404", async () => {
    await expect(paginaPublicar("rampa-do-pepe")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  // 🔴 AS GUARDAS, cada uma com um rascunho GUARDADO que cala alguma coisa: sem
  // a guarda, a página seguiria e mostraria o rascunho.
  it("sem cookie: a caixa de senha, e nada do rascunho", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(semCampo(rascunhoCompleto(S, NOME, CIDADE), "piso")), ATUALIZADO);
    cookiesFalso.mockResolvedValue({ get: () => undefined });
    const { container } = await paginaPublicar(S);
    expect(container.querySelector('input[type="password"]'), "a caixa de senha não está lá").not.toBeNull();
    expect(screen.queryByTestId("cala")).toBeNull();
    expect(screen.queryByRole("button", { name: PUBLICAR })).toBeNull();
    expect(screen.queryByText(nomeComCidade(NOME, CIDADE))).toBeNull();
  });

  it("painel desligado: 404, mesmo com sessão e rascunho", async () => {
    await salvarRascunho(cliente, S, JSON.stringify(semCampo(rascunhoCompleto(S, NOME, CIDADE), "piso")), ATUALIZADO);
    vi.stubEnv("ADMIN_SENHA", "");
    await expect(paginaPublicar(S)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundFalso).toHaveBeenCalled();
  });

  // O documento guardado que não abre como JSON: a tela não estoura — toda
  // obrigatória aparece no que falta, e a porta é quem recusa.
  it("rascunho que não abre: a tela fica de pé, com cada obrigatória no que falta", async () => {
    await salvarRascunho(cliente, S, "{{", ATUALIZADO);
    await paginaPublicar(S);
    const esperadas = montarPerguntas({}).filter((q) => q.campo.obrigatorio && q.valor === undefined).map((q) => q.texto);
    expect(esperadas.length, "a premissa: o registro tem obrigatórias").toBeGreaterThan(3);
    const links = within(screen.getByTestId("falta")).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(esperadas);
    expect(screen.getByRole("button", { name: PUBLICAR })).toBeTruthy();
  });

  // O banco que não responde é ERRO, como em `/admin/novo` — nunca uma tela
  // montada sobre nada.
  it("banco pendurado na leitura do rascunho: a página dá erro, não monta tela", async () => {
    await import("@/app/admin/novo/publicar/page");
    cliente = { execute: () => new Promise(() => {}) } as unknown as Client;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const pagina = paginaPublicar(S);
      const pegou = expect(pagina).rejects.toThrow("não respondeu a tempo");
      for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS);
      await pegou;
    } finally {
      vi.useRealTimers();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 G3 DA AUDITORIA: a tela é de CLIENTE e não alcança o registro, o schema nem
// o zod — eles iriam pro celular. Seguido pelos imports de VALOR, pelo parser do
// TypeScript, como o guarda do `FormularioDeLugar`. A medição de kB do build é a
// outra metade, e está no relatório.
describe("o bundle do celular", () => {
  const RAIZ = path.join(process.cwd(), "src");
  const PROIBIDOS = ["@/lib/campos-da-ficha", "@/types/ficha", "zod", "@/lib/o-que-o-app-cala", "@/lib/porta-de-publicar"];

  /** O especificador `esp`, importado de `de`, como ARQUIVO no disco — `@/` e
   *  relativo pela mesma régua —, ou `null` (pacote, ou nada achado). */
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

  /** 🔴 M7 da revisão da Tarefa 12: o guarda comparava ESPECIFICADORES como
   *  texto, e `import … from "../../lib/campos-da-ficha"` passava pela lista.
   *  Agora o proibido de `src` é um ARQUIVO resolvido, e o que se compara são os
   *  arquivos que o caminhante alcançou; só o pacote (`zod`) é comparado pelo
   *  nome, que é o único jeito de importá-lo. */
  const PROIBIDOS_ARQUIVO = PROIBIDOS.filter((p) => p.startsWith("@/")).map((p) => {
    const arq = resolver(path.join(RAIZ, "x.ts"), p);
    if (arq === null) throw new Error(`o proibido ${p} não resolve pra arquivo nenhum`);
    return arq;
  });
  const PROIBIDOS_PACOTE = PROIBIDOS.filter((p) => !p.startsWith("@/") && !p.startsWith("."));

  /** O grafo de imports de VALOR a partir de `inicio`. `ler` existe pro controle
   *  pôr um arquivo SABOTADO no lugar de um de verdade, sem tocar em `src`. */
  function grafo(
    inicio: string,
    ler: (arquivo: string) => string = (a) => readFileSync(a, "utf8"),
  ): { arquivos: string[]; especificadores: string[] } {
    const vistos = new Set<string>();
    const vistosEsp: string[] = [];
    const andar = (arquivo: string): void => {
      if (vistos.has(arquivo)) return;
      vistos.add(arquivo);
      const fonte = ts.createSourceFile(arquivo, ler(arquivo), ts.ScriptTarget.Latest, true);
      for (const n of fonte.statements) {
        if (!ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)) continue;
        if (ts.isImportDeclaration(n) && n.importClause?.isTypeOnly) continue;
        if (ts.isExportDeclaration(n) && n.isTypeOnly) continue;
        const esp = n.moduleSpecifier;
        if (!esp || !ts.isStringLiteral(esp)) continue;
        vistosEsp.push(esp.text);
        const alvo = resolver(arquivo, esp.text);
        if (alvo) andar(alvo);
      }
    };
    andar(inicio);
    return { arquivos: [...vistos], especificadores: vistosEsp };
  }

  /** O que o grafo de `inicio` alcança da lista proibida: arquivos e pacotes. */
  function proibidosAlcancados(inicio: string, ler?: (arquivo: string) => string): string[] {
    const { arquivos, especificadores } = grafo(inicio, ler);
    const pacote = (e: string, p: string) => e === p || e.startsWith(`${p}/`);
    return [
      ...PROIBIDOS_ARQUIVO.filter((p) => arquivos.includes(p)),
      ...PROIBIDOS_PACOTE.filter((p) => especificadores.some((e) => pacote(e, p))),
    ];
  }

  const TELA = path.join(RAIZ, "app", "admin", "TelaDePublicar.tsx");

  it("a TelaDePublicar não alcança o registro, o schema, o zod, nem as funções que os leem", () => {
    const { arquivos } = grafo(TELA);
    expect(arquivos.some((a) => a.endsWith("gravar.ts")), "o caminhante não seguiu os imports").toBe(true);
    expect(PROIBIDOS_ARQUIVO, "a premissa: os quatro proibidos de src resolvem").toHaveLength(4);
    expect(proibidosAlcancados(TELA), "a tela de cliente alcança o proibido").toEqual([]);
  });

  it("controle: o caminhante enxerga o proibido quando ele está lá (a página de servidor)", () => {
    const pagina = path.join(RAIZ, "app", "admin", "novo", "publicar", "page.tsx");
    const alcancados = proibidosAlcancados(pagina);
    expect(alcancados).toContain(resolver(pagina, "@/lib/o-que-o-app-cala"));
    expect(alcancados).toContain(resolver(pagina, "@/lib/campos-da-ficha"));
  });

  // 🔴 A prova do M7: a MESMA tela, com um import RELATIVO de valor de um
  // proibido acrescentado (lida por `ler`, sem tocar no disco). O proibido é
  // lido como uma FOLHA (sem imports): o de verdade importa `@/types/ficha`, e
  // a comparação por texto o pegaria de tabela, pelo especificador de DENTRO
  // dele — o controle ficaria verde pelo motivo errado. Com a folha, só a
  // comparação por ARQUIVO o vê.
  it("controle: um import RELATIVO de um proibido-folha, sabotado na tela, é pego", () => {
    const real = readFileSync(TELA, "utf8");
    const proibido = resolver(TELA, "@/lib/campos-da-ficha");
    const sabotada = 'import { CAMPOS_DA_FICHA } from "../../lib/campos-da-ficha";\nvoid CAMPOS_DA_FICHA;\n' + real;
    const ler = (a: string) =>
      a === TELA ? sabotada : a === proibido ? "export const CAMPOS_DA_FICHA = [];\n" : readFileSync(a, "utf8");
    const { especificadores } = grafo(TELA, ler);
    expect(especificadores, "a premissa: o import sabotado foi lido").toContain("../../lib/campos-da-ficha");
    for (const p of PROIBIDOS) expect(especificadores, `a premissa: só o texto relativo, nunca ${p}`).not.toContain(p);
    expect(proibidosAlcancados(TELA, ler)).toEqual([proibido]);
  });
});
