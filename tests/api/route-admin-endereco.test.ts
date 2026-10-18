import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import {
  criarRascunho,
  enderecoNovoDe,
  ensureSchema,
  gravarVersao,
  historico,
  trocarEndereco,
  versaoAtual,
} from "@/lib/db";
import {
  ENDERECO_JA_E_ESSE,
  ENDERECO_NAO_TROCOU,
  SEM_CIDADE_PRA_ENDERECO,
  enderecoOcupadoPorLugar,
  enderecoOcupadoPorRascunho,
} from "@/lib/endereco";
import { travaDoPainel } from "@/lib/par-de-lugar";
import { ehChaveDeRascunho, enderecoDeLugar } from "@/lib/rascunho";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { PESSOA_DE_TESTE, rascunhoNoBanco, semearAcervo, base, comBaseAtual } from "../banco";
import { lugarMarcador } from "../lugar-marcador";
import { nominatimDeTeste } from "../nominatim";

// Molde: `tests/api/route-admin-visibilidade.test.ts` — `Request` à mão, sessão
// de verdade, acervo do BANCO. 🔴 ASSERÇÃO DUPLA: o código da resposta E o banco.

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-endereco";
const AGORA = 1_759_100_000;
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";

let c: Client;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/endereco/route").POST;

// A CORRIDA de duas abas (M1 da revisão): o que roda logo depois da ÚLTIMA
// leitura da rota (`lerRascunho` — de 07/10 até a Task 17 foi
// `rascunhoDeQualquerUm`, enquanto o rascunho de quem usa ocupava endereço) e
// antes do batch dela.
const corrida = vi.hoisted(() => ({ antesDoBatch: null as null | (() => Promise<void>) }));

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return {
    ...mod,
    getClient: () => c,
    lerRascunho: async (cliente: Client, slug: string) => {
      const lido = await mod.lerRascunho(cliente, slug);
      const meio = corrida.antesDoBatch;
      corrida.antesDoBatch = null;
      if (meio !== null) await meio();
      return lido;
    },
  };
});

// 🔴 A suíte nunca bate no Nominatim (spec §7): o ponto 0 do rascunho pergunta
// a cidade ao dublê.
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

beforeEach(async () => {
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  await semearAcervo(c);
  // O caso dele, com marcadores: nasceu em "Bom Marcador", a cidade foi corrigida.
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 100);
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 50);

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = comBaseAtual((await import("@/app/api/admin/endereco/route")).POST, () => c);
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(corpo: unknown, cookie: string | null = cookieBom, cru = false): Request {
  return new Request("http://x/api/admin/endereco", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: cru ? (corpo as string) : JSON.stringify(corpo),
  });
}

/** O banco inteiro — o que "nada mudou" compara. */
async function retrato(): Promise<Record<string, unknown[]>> {
  const ler = async (sql: string) => (await c.execute(sql)).rows.map((r) => ({ ...r }));
  return {
    ficha_versoes: await ler("SELECT * FROM ficha_versoes ORDER BY id"),
    avisos: await ler("SELECT * FROM avisos ORDER BY id"),
    confirmacoes: await ler("SELECT * FROM confirmacoes ORDER BY id"),
    freshness: await ler("SELECT * FROM freshness ORDER BY ficha_slug"),
    enderecos_antigos: await ler("SELECT * FROM enderecos_antigos ORDER BY velho"),
    ficha_rascunhos: await ler("SELECT * FROM ficha_rascunhos ORDER BY slug"),
  };
}

describe("POST /api/admin/endereco — o caso dele", () => {
  it("troca pro nome e a cidade de AGORA: 200 com o endereço novo, e o velho leva a ele", async () => {
    const res = await POST(pedido({ slug: A }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: B });
    expect(res.headers.get("cache-control")).toBe("no-store");

    expect(await historico(c, A)).toEqual([]);
    expect(await historico(c, B)).toHaveLength(3);
    expect(await enderecoNovoDe(c, A)).toBe(B);
  });

  it("lugar escondido troca de endereço e continua escondido", async () => {
    const doc = (await versaoAtual(c, A))!.doc;
    await gravarVersao(c, A, doc, "painel", AGORA - 10, true);
    expect((await POST(pedido({ slug: A }))).status).toBe(200);
    expect((await versaoAtual(c, B))!.oculto).toBe(true);
  });

  it("voltar a uma versão de antes da troca: 200, e a home continua de pé", async () => {
    const deAntes = (await historico(c, A)).at(-1)!.id;
    expect((await POST(pedido({ slug: A }))).status).toBe(200);

    const PUT = comBaseAtual((await import("@/app/api/admin/ficha/route")).PUT, () => c);
    const volta = await PUT(
      new Request("http://x/api/admin/ficha", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: JSON.stringify({ slug: B, versaoId: deAntes }),
      }),
    );
    expect(volta.status, await volta.clone().text()).toBe(200);

    // A home lê o acervo inteiro; uma versão que dissesse A sob B derrubaria TODOS.
    const { getAllFichas } = await import("@/lib/ficha");
    const slugs = (await getAllFichas()).map((f) => f.slug);
    expect(slugs).toContain(B);
    expect(slugs).not.toContain(A);
    // Voltar restaura o DOCUMENTO (a cidade de antes), nunca o endereço.
    expect(JSON.parse((await versaoAtual(c, B))!.doc)).toMatchObject({ slug: B, cidade: "Bom Marcador" });
  });
});

describe("POST /api/admin/endereco — duas abas no mesmo segundo (M1)", () => {
  it("a 2ª passa das leituras, a 1ª troca no meio: a 2ª diz o endereço que vale (200) e não grava 2º ato", async () => {
    corrida.antesDoBatch = async () => {
      expect(await trocarEndereco(c, A, B, AGORA, await base(c, A)), "a 1ª aba não trocou").toBe(true);
    };
    const res = await POST(pedido({ slug: A }));
    expect(corrida.antesDoBatch, "a corrida não aconteceu").toBeNull();
    // "Nada mudou" seria falso: mudou, pela outra aba, e pro MESMO endereço.
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: B });
    expect((await historico(c, B)).filter((v) => v.endereco_anterior === A), "um 2º ato").toHaveLength(1);
  });
});

// 🔴 N3 da re-revisão (onda de fix 3): os pré-cheques passaram, e o endereço
// novo é ocupado ANTES do batch — quem decide é o 1º passo dele, que recusa. A
// rota tem de dizer "nada mudou" (409 `ENDERECO_NAO_TROCOU`), e nunca o 200
// "trocado" do caso das duas abas: com ele, o dono iria pro `/admin/<novo>`, o
// painel de OUTRO lugar (ou de um rascunho).
describe("POST /api/admin/endereco — o endereço novo é ocupado entre os pré-cheques e o batch (N3)", () => {
  const OCUPAR = {
    "por outro lugar": () =>
      gravarVersao(c, B, JSON.stringify(lugarMarcador(B, "Outro Marcador", "Cidade Marcadora")), "painel", AGORA - 5),
    "por um rascunho": () =>
      criarRascunho(c, B, JSON.stringify({ slug: B, cidade: "Outra Marcadora", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), AGORA - 5),
  } as const;

  for (const [como, ocupar] of Object.entries(OCUPAR)) {
    it(`ocupado ${como}: 409 com a frase "nada mudou", e o banco igual ao de depois da ocupação`, async () => {
      let depois: Record<string, unknown[]> | null = null;
      corrida.antesDoBatch = async () => {
        await ocupar();
        depois = await retrato();
      };
      const res = await POST(pedido({ slug: A }));
      expect(corrida.antesDoBatch, "a corrida não aconteceu").toBeNull();
      expect(depois, "a ocupação do meio não rodou").not.toBeNull();
      expect(res.status, await res.clone().text()).toBe(409);
      expect(await res.text()).toBe(ENDERECO_NAO_TROCOU);
      expect(await retrato(), "a troca recusada mexeu no banco").toEqual(depois);
      expect(await enderecoNovoDe(c, A)).toBeNull();
    });
  }
});

describe("POST /api/admin/endereco — recusas, e nada muda", () => {
  it("painel desligado: 404 de corpo vazio", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(await retrato()).toEqual(antes);
  });

  it("sem sessão: 401 de corpo vazio", async () => {
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }, null));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
    expect(await retrato()).toEqual(antes);
  });

  it.each([
    ["não é JSON", "{ isto não", true],
    ["null", null, false],
    ["sem slug", {}, false],
    ["slug não é texto", { slug: 3 }, false],
  ])("corpo malformado (%s): 400", async (_nome, corpo, cru) => {
    const antes = await retrato();
    const res = await POST(pedido(corpo, cookieBom, cru as boolean));
    expect(res.status).toBe(400);
    expect(await retrato()).toEqual(antes);
  });

  // 🔴 I6 da auditoria: o endereço novo sai do SERVIDOR, do nome e da cidade
  // que o documento já diz. Um corpo que traga o novo é corpo malformado — um
  // endereço com uma cidade que nenhum dado do lugar diz fere a linha vermelha.
  it("um corpo com `novo` a mais é 400, e nada muda", async () => {
    const antes = await retrato();
    const res = await POST(pedido({ slug: A, novo: "lugar-marcador-cidade-inventada" }));
    expect(res.status).toBe(400);
    expect(await retrato()).toEqual(antes);
  });

  it("lugar que não existe: 400", async () => {
    const antes = await retrato();
    expect((await POST(pedido({ slug: "lugar-que-nao-existe-marcador" }))).status).toBe(400);
    expect(await retrato()).toEqual(antes);
  });

  it("lugar sem cidade: 400 com a frase", async () => {
    const antes = await retrato();
    const res = await POST(pedido({ slug: "rampa-do-pepe" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(SEM_CIDADE_PRA_ENDERECO);
    expect(await retrato()).toEqual(antes);
  });

  it("o endereço já é o do nome e da cidade: 400 com a frase", async () => {
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 10);
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(ENDERECO_JA_E_ESSE);
    expect(await retrato()).toEqual(antes);
  });

  it("novo ocupado por lugar ESCONDIDO: 409 dizendo quem, e nada mudou em nenhuma tabela", async () => {
    await gravarVersao(c, B, JSON.stringify(lugarMarcador(B, "Outro Marcador", "Cidade Marcadora")), "painel", AGORA - 5, true);
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoOcupadoPorLugar(B, "Outro Marcador (Cidade Marcadora)"));
    expect(await retrato()).toEqual(antes);
  });

  it("novo ocupado por um rascunho: 409 dizendo quem, e nada muda", async () => {
    await criarRascunho(c, B, JSON.stringify({ slug: B, cidade: "Outra Marcadora", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), AGORA - 5);
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoOcupadoPorRascunho(B, "Lugar Marcador (Outra Marcadora)"));
    expect(await retrato()).toEqual(antes);
  });

  // 🔴 Task 17 (decisão do João de 13/10, "Nenhum ocupa"): o rascunho de quem
  // usa o app não ocupa endereço — a chave dele nunca é um endereço. O João
  // troca pro endereço que o par dela daria, e o rascunho dela fica. (De 07/10
  // até a Task 17 era 409, por `rascunhoDeQualquerUm` — M11 da pré-auditoria.)
  it("novo é o endereço que um rascunho de QUEM USA daria: troca, e o dela fica", async () => {
    const doc = JSON.stringify({ slug: B, cidade: "Outra Marcadora", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } });
    const chave = await criarRascunhoDaPessoa(c, B, doc, AGORA - 5, PESSOA_DE_TESTE);
    expect(chave, "a premissa: o rascunho dela nasceu").not.toBeNull();
    const res = await POST(pedido({ slug: A }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: B });
    expect(await versaoAtual(c, A)).toBeNull();
    expect((await versaoAtual(c, B))?.autor).toBe("painel");
    expect(await rascunhoNoBanco(c, chave!)).toMatchObject({ doc, contribuidor: PESSOA_DE_TESTE });
  });
});

// 🔴 O CENÁRIO QUE MOTIVOU A TAREFA, ATÉ ONDE EXISTE CÓDIGO (E5): a Pedra do
// Navio foi publicada com a cidade errada (Bom Jardim) e corrigida pra Floresta;
// depois a Pedra do Navio de Bom Jardim DE VERDADE precisa do endereço
// `pedra-do-navio-bom-jardim`. Aqui com marcadores. Publicar o rascunho é a
// Tarefa 12 — este caso vai até o rascunho nascer no endereço retomado.
describe("o cenário dele: retomar o endereço velho", () => {
  it("antes da troca o lugar novo esbarra no endereço; depois, nasce nele, e o velho segue levando ao lugar corrigido", async () => {
    const { POST: criar, PUT: responder } = await import("@/app/api/admin/rascunho/route");
    const cabecas = { cookie: `${COOKIE_ADMIN}=${cookieBom}` };
    // 17/10: o lugar nasce só do nome, e a cidade sai do PONTO (o Nominatim
    // dublado diz "Bom Marcador"): é nele que o endereço se confere.
    nominatimDeTeste.ponto = { cidade: "Bom Marcador" };
    const marcarPonto = (slug: string) =>
      responder(new Request("http://x/api/admin/rascunho", { method: "PUT", headers: cabecas, body: JSON.stringify({ slug, ponto: 0, lat: -8.1, lng: -35.2 }) }));
    const nasceu = await criar(new Request("http://x/api/admin/rascunho", { method: "POST", headers: cabecas, body: JSON.stringify({ nome: "Lugar Marcador" }) }));
    expect(nasceu.status).toBe(201);
    const { slug: chave } = (await nasceu.json()) as { slug: string };

    // O endereço ainda é do lugar corrigido: o ponto grava (a saída (b)) e o
    // rascunho fica na chave provisória — e o que a tela diz é a saída que
    // agora existe (M7): trocar o endereço do outro.
    const antes = await marcarPonto(chave);
    expect(antes.status, await antes.clone().text()).toBe(200);
    expect(await antes.json(), "o endereço ainda é do lugar corrigido").toEqual({ slug: chave });
    expect(ehChaveDeRascunho(chave)).toBe(true);
    const doc = (await rascunhoNoBanco(c, chave))!.doc;
    expect(await travaDoPainel(doc, chave)).toBe(enderecoDeLugar("Lugar Marcador (Outra Marcadora)"));

    expect((await POST(pedido({ slug: A }))).status).toBe(200);

    // Depois da troca, o mesmo rascunho, com o ponto salvo de novo, se muda pro endereço.
    const depois = await marcarPonto(chave);
    expect(depois.status, await depois.clone().text()).toBe(200);
    expect(await depois.json()).toEqual({ slug: A });
    // Enquanto é rascunho, o endereço velho continua levando ao lugar corrigido.
    expect(await enderecoNovoDe(c, A)).toBe(B);
    expect(await historico(c, A)).toEqual([]);
  });
});
