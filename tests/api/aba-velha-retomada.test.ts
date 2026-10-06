import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema, gravarVersao, historico, trocarEndereco, versaoAtual, versoesAtuais } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO } from "@/lib/endereco";
import { semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";

/** A ABA VELHA DEPOIS DE UMA RETOMADA (onda de fix 2 da Tarefa 11e, M6 —
 *  medido real pelas rotas na onda 1).
 *
 *  O lugar P sai do endereço A pra B; o lugar Q retoma A. Uma aba do painel de P
 *  aberta ANTES (em `/admin/A`) edita a voz, toca "esconder", publica um aviso,
 *  pede a troca de endereço. Antes desta onda, as gravações respondiam 200 e
 *  caíam em Q: a voz de P dita sobre outro lugar, e Q fora do ar. A condição da
 *  onda 1 (`WHERE EXISTS` versão em A) não pegava, porque A TEM versão — a de Q.
 *
 *  🔴 O ENDEREÇO NÃO É IDENTIDADE; A VERSÃO QUE A TELA ABRIU É. Toda gravação de
 *  um lugar que já existe leva `baseId`, e o banco só grava se essa versão mora
 *  no endereço pedido. As versões de P andaram com ele pra B, então a aba velha
 *  em A é recusada (409 com a frase) e Q fica intacto.
 *
 *  Cada caso tem CONTROLE: a aba NOVA de P (em B) e a aba de Q (em A) gravam —
 *  pra o 409 não ser recusa por outro motivo. Nomes e cidades são marcadores. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-aba-velha";
const AGORA = 1_759_400_000;
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";
const C = "lugar-marcador-q-antes";

let c: Client;
let cookieBom: string;
/** A versão que a aba velha de P renderizou em `/admin/A`, ANTES da troca. */
let baseVelhaDeP: number;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

async function retrato(): Promise<Record<string, unknown[]>> {
  const ler = async (sql: string) => (await c.execute(sql)).rows.map((r) => ({ ...r }));
  return {
    ficha_versoes: await ler("SELECT * FROM ficha_versoes ORDER BY id"),
    avisos: await ler("SELECT * FROM avisos ORDER BY id"),
    confirmacoes: await ler("SELECT * FROM confirmacoes ORDER BY id"),
    enderecos_antigos: await ler("SELECT * FROM enderecos_antigos ORDER BY velho"),
  };
}

const idDe = async (slug: string): Promise<number> => (await versaoAtual(c, slug))!.id;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  await semearAcervo(c);
  // P nasce em A ("Bom Marcador"), a cidade é corrigida pra "Outra Marcadora".
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 100);
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 90);
  // A aba velha abre AQUI: `/admin/A`, com a versão atual de P.
  baseVelhaDeP = await idDe(A);
  // P vai pra B.
  expect(await trocarEndereco(c, A, B, AGORA - 80, baseVelhaDeP), "P não foi pra B").toBe(true);
  // Q nasce em C e retoma A. O nome e a cidade de Q dão OUTRO endereço sugerido,
  // então uma troca pedida pela aba velha moveria Q de verdade.
  await gravarVersao(c, C, JSON.stringify(lugarMarcador(C, "Lugar Q Marcador", "Cidade Q Marcadora")), "painel", AGORA - 70);
  expect(await trocarEndereco(c, C, A, AGORA - 60, await idDe(C)), "Q não retomou A").toBe(true);

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(rota: string, metodo: string, corpo: unknown): Request {
  return new Request(`http://x/api/admin/${rota}`, {
    method: metodo,
    headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
    body: JSON.stringify(corpo),
  });
}

const VOZ_DE_P = "Voz marcadora que o dono escreveu pro P.";

/** A recusa: 409 com a frase, e o banco IGUAL — Q no ar, com a voz dele, em A. */
async function recusadoEQIntacto(res: Response, antes: Record<string, unknown[]>): Promise<void> {
  expect(res.status).toBe(409);
  expect(await res.text()).toBe(LUGAR_MUDOU_DE_ENDERECO);
  expect(await retrato(), "a aba velha gravou no banco").toEqual(antes);
  const q = await versaoAtual(c, A);
  expect(JSON.parse(q!.doc).voz, "a voz de P caiu em Q").toBe(`Uma voz marcadora do lugar ${C}.`);
  expect((await versoesAtuais(c)).has(A), "Q saiu do ar").toBe(true);
}

describe("M6: a aba velha de P, em /admin/A, depois que Q retomou A", () => {
  it("PUT da voz: 409, e a voz de P NÃO cai em Q", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    const antes = await retrato();
    const res = await PUT(pedido("ficha", "PUT", { slug: A, campo: "voz", valor: VOZ_DE_P, baseId: baseVelhaDeP }));
    await recusadoEQIntacto(res, antes);
  });

  it("ESCONDER: 409, e Q continua no ar", async () => {
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    const antes = await retrato();
    const res = await POST(pedido("visibilidade", "POST", { slug: A, oculto: true, baseId: baseVelhaDeP }));
    await recusadoEQIntacto(res, antes);
  });

  // N7 da re-revisão (onda de fix 3): este caso se chamava "MOSTRAR" e mandava
  // `oculto: true` — é o ESCONDER que acha o estado já valendo e não grava. O
  // MOSTRAR de verdade (que grava) é o caso seguinte.
  it("ESCONDER de novo, com Q já escondido (o pedido que não grava nada): 409, nunca um 200 sobre Q", async () => {
    await gravarVersao(c, A, (await versaoAtual(c, A))!.doc, "painel", AGORA - 10, true);
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    const antes = await retrato();
    const res = await POST(pedido("visibilidade", "POST", { slug: A, oculto: true, baseId: baseVelhaDeP }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(LUGAR_MUDOU_DE_ENDERECO);
    expect(await retrato()).toEqual(antes);
  });

  it("MOSTRAR, com Q escondido (o pedido que grava): 409, e Q continua fora do ar", async () => {
    await gravarVersao(c, A, (await versaoAtual(c, A))!.doc, "painel", AGORA - 10, true);
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    const antes = await retrato();
    const res = await POST(pedido("visibilidade", "POST", { slug: A, oculto: false, baseId: baseVelhaDeP }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(LUGAR_MUDOU_DE_ENDERECO);
    expect(await retrato(), "a aba velha gravou no banco").toEqual(antes);
    expect((await versoesAtuais(c)).has(A), "a aba velha de P pôs Q no ar").toBe(false);
  });

  it("aviso: 409, e nenhum aviso de P pendurado em Q", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const antes = await retrato();
    const res = await POST(
      pedido("aviso", "POST", {
        slug: A, texto: "aviso marcador de P", efeito: "fechado", venceEm: AGORA + 3600, baseId: baseVelhaDeP,
      }),
    );
    await recusadoEQIntacto(res, antes);
  });

  it("trocar o endereço: 409, e Q NÃO sai de A", async () => {
    const { POST } = await import("@/app/api/admin/endereco/route");
    const antes = await retrato();
    const res = await POST(pedido("endereco", "POST", { slug: A, baseId: baseVelhaDeP }));
    await recusadoEQIntacto(res, antes);
  });

  it("voltar a uma versão de P: recusado, e nada muda", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    const antes = await retrato();
    const res = await PUT(pedido("ficha", "PUT", { slug: A, versaoId: baseVelhaDeP, baseId: baseVelhaDeP }));
    expect(res.status).not.toBe(200);
    expect(await retrato()).toEqual(antes);
  });
});

// Controle: as abas NOVAS gravam. Sem esta metade, um 409 por outro motivo
// (corpo torto, coerência, a rota recusando tudo) passaria por prova.
describe("controle: a aba nova de P (em /admin/B) e a de Q (em /admin/A) gravam", () => {
  it("P em B: a voz entra em P", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    const res = await PUT(pedido("ficha", "PUT", { slug: B, campo: "voz", valor: VOZ_DE_P, baseId: await idDe(B) }));
    expect(res.status).toBe(200);
    expect(JSON.parse((await versaoAtual(c, B))!.doc).voz).toBe(VOZ_DE_P);
  });

  it("P em B: esconder tira P do ar", async () => {
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    const res = await POST(pedido("visibilidade", "POST", { slug: B, oculto: true, baseId: await idDe(B) }));
    expect(res.status).toBe(200);
    expect((await versoesAtuais(c)).has(B)).toBe(false);
    expect((await versoesAtuais(c)).has(A)).toBe(true);
  });

  it("P em B: o aviso entra em B", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      pedido("aviso", "POST", {
        slug: B, texto: "aviso marcador de P", efeito: "fechado", venceEm: AGORA + 3600, baseId: await idDe(B),
      }),
    );
    expect(res.status).toBe(200);
    expect((await c.execute("SELECT ficha_slug FROM avisos")).rows.map((r) => r.ficha_slug)).toEqual([B]);
  });

  it("Q em A: a troca de endereço move Q", async () => {
    const { POST } = await import("@/app/api/admin/endereco/route");
    const res = await POST(pedido("endereco", "POST", { slug: A, baseId: await idDe(A) }));
    expect(res.status).toBe(200);
    expect(await historico(c, A)).toEqual([]);
  });

  it("duas abas do MESMO lugar: a de versão anterior também grava (baseId não é trava de concorrência)", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    const anteriorDeP = baseVelhaDeP; // mora em B desde a troca, e não é a atual (a atual é o ato)
    expect(anteriorDeP).not.toBe(await idDe(B));
    const res = await PUT(pedido("ficha", "PUT", { slug: B, campo: "voz", valor: VOZ_DE_P, baseId: anteriorDeP }));
    expect(res.status).toBe(200);
  });
});

describe("o baseId é obrigatório, e é número inteiro positivo", () => {
  const ROTAS = [
    {
      nome: "ficha (campo)", rota: "ficha", metodo: "PUT",
      corpo: (b?: unknown) => ({ slug: B, campo: "voz", valor: VOZ_DE_P, ...(b === undefined ? {} : { baseId: b }) }),
    },
    {
      nome: "ficha (voltar)", rota: "ficha", metodo: "PUT",
      corpo: (b?: unknown) => ({ slug: B, versaoId: baseVelhaDeP, ...(b === undefined ? {} : { baseId: b }) }),
    },
    {
      nome: "visibilidade", rota: "visibilidade", metodo: "POST",
      corpo: (b?: unknown) => ({ slug: B, oculto: true, ...(b === undefined ? {} : { baseId: b }) }),
    },
    {
      nome: "aviso", rota: "aviso", metodo: "POST",
      corpo: (b?: unknown) => ({
        slug: B, texto: "aviso marcador", efeito: "fechado", venceEm: AGORA + 3600, ...(b === undefined ? {} : { baseId: b }),
      }),
    },
    {
      nome: "endereco", rota: "endereco", metodo: "POST",
      corpo: (b?: unknown) => ({ slug: B, ...(b === undefined ? {} : { baseId: b }) }),
    },
  ] as const;

  async function chamar(rota: string, metodo: string, corpo: unknown): Promise<Response> {
    const mod = (await import(`@/app/api/admin/${rota}/route`)) as Record<string, (r: Request) => Promise<Response>>;
    return mod[metodo](pedido(rota, metodo, corpo));
  }

  for (const r of ROTAS) {
    it(`${r.nome}: sem baseId, ou baseId que não é inteiro positivo → 400, e nada muda`, async () => {
      // Endereço de B leva a nada novo (P já está no endereço sugerido), então
      // a rota de endereço precisa de um lugar que trocaria de verdade: Q em A.
      const corpo = r.rota === "endereco" ? (b?: unknown) => ({ slug: A, ...(b === undefined ? {} : { baseId: b }) }) : r.corpo;
      const antes = await retrato();
      for (const ruim of [undefined, String(await idDe(B)), 1.5, 0, -1, null, true]) {
        const res = await chamar(r.rota, r.metodo, corpo(ruim));
        expect(res.status, `baseId ${JSON.stringify(ruim)}`).toBe(400);
      }
      expect(await retrato()).toEqual(antes);
      // E o controle do mesmo corpo, com o baseId certo: grava.
      const certo = r.rota === "endereco" ? await idDe(A) : await idDe(B);
      expect((await chamar(r.rota, r.metodo, corpo(certo))).status).toBe(200);
    });
  }
});
