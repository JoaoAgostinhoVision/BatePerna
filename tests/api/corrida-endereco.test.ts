import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { enderecoNovoDe, ensureSchema, gravarVersao, historico, trocarEndereco, versoesAtuais } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO } from "@/lib/endereco";
import { semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";

/** A CORRIDA EDIÇÃO × TROCA DE ENDEREÇO (onda de fix da Tarefa 11e, I1 da
 *  revisão). Toda rota de escrita do painel LÊ a versão atual de `slug` e GRAVA
 *  depois; se a troca de endereço roda no meio, a gravação caía no endereço
 *  velho e recriava ali um lugar de uma versão só — no ar. E o pior dos três: o
 *  dono pedia "esconder", lia 200, e o lugar seguia no ar no endereço novo.
 *
 *  🔴 AS REQUISIÇÕES SÃO INTERCALADAS DE VERDADE, na rota de verdade: o dublê de
 *  `versaoAtual` lê o banco e, logo DEPOIS da leitura do lugar, roda a troca
 *  A→B — é a ordem da corrida (lido antes, gravado depois). Cada caso tem o seu
 *  CONTROLE: o mesmo pedido sem a corrida grava (200), pra o 409 não ser
 *  recusa por outro motivo. Nomes e cidades são marcadores. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-corrida";
const AGORA = 1_759_300_000;
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";

let c: Client;
let cookieBom: string;
let primeiraDeA: number;
/** O banco logo depois da troca do meio — o que "nada gravado" compara. */
let depoisDaTroca: Record<string, unknown[]> | null;

const corrida = vi.hoisted(() => ({ depoisDeLer: null as null | (() => Promise<void>) }));

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return {
    ...mod,
    getClient: () => c,
    versaoAtual: async (cliente: Client, slug: string) => {
      const lida = await mod.versaoAtual(cliente, slug);
      const meio = corrida.depoisDeLer;
      if (meio !== null && slug === A) {
        corrida.depoisDeLer = null;
        await meio();
      }
      return lida;
    },
  };
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

function trocarNoMeio(): void {
  corrida.depoisDeLer = async () => {
    expect(await trocarEndereco(c, A, B, AGORA), "a troca do meio não rodou").toBe(true);
    depoisDaTroca = await retrato();
  };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime((AGORA + 1) * 1000);
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  await semearAcervo(c);
  primeiraDeA = await gravarVersao(
    c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 100,
  );
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 50);
  corrida.depoisDeLer = null;
  depoisDaTroca = null;
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

/** O que vale depois de TODA corrida: 409 com a frase, nada gravado depois da
 *  troca, nenhum lugar recriado no endereço velho, e o velho ainda leva ao novo. */
async function nadaGravado(res: Response): Promise<void> {
  expect(depoisDaTroca, "a corrida não aconteceu: a rota não leu o lugar").not.toBeNull();
  expect(res.status).toBe(409);
  expect(await res.text()).toBe(LUGAR_MUDOU_DE_ENDERECO);
  expect(await retrato(), "a gravação de depois da troca entrou no banco").toEqual(depoisDaTroca);
  expect(await historico(c, A), "o lugar foi recriado no endereço velho").toEqual([]);
  expect((await versoesAtuais(c, { incluirOcultos: true })).has(A)).toBe(false);
  expect(await enderecoNovoDe(c, A)).toBe(B);
}

const CORPO_CAMPO = { slug: A, campo: "voz", valor: "Uma voz marcadora escrita no meio da troca." };
const CORPO_ESCONDER = { slug: A, oculto: true };
const corpoAviso = () => ({ slug: A, texto: "aviso marcador do meio", efeito: "fechado", venceEm: AGORA + 3600 });

describe("a corrida: lido antes da troca, gravado depois", () => {
  it("PUT de campo: 409, e A não ressuscita", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    trocarNoMeio();
    await nadaGravado(await PUT(pedido("ficha", "PUT", CORPO_CAMPO)));
  });

  it("voltar a uma versão: 409, e A não ressuscita", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    trocarNoMeio();
    await nadaGravado(await PUT(pedido("ficha", "PUT", { slug: A, versaoId: primeiraDeA })));
  });

  it("ESCONDER: 409 (nunca um 200 com o lugar no ar), e B continua como estava", async () => {
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    trocarNoMeio();
    await nadaGravado(await POST(pedido("visibilidade", "POST", CORPO_ESCONDER)));
  });

  it("aviso: 409, e nenhum aviso órfão no endereço velho", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    trocarNoMeio();
    await nadaGravado(await POST(pedido("aviso", "POST", corpoAviso())));
  });
});

// Controle: os MESMOS pedidos, sem a corrida, gravam. Sem esta metade, um 409
// por outro motivo (corpo torto, coerência) passaria por prova da corrida.
describe("controle: sem a corrida, os mesmos pedidos gravam", () => {
  it("PUT de campo: 200", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    expect((await PUT(pedido("ficha", "PUT", CORPO_CAMPO))).status).toBe(200);
    expect(await historico(c, A)).toHaveLength(3);
  });

  it("voltar: 200", async () => {
    const { PUT } = await import("@/app/api/admin/ficha/route");
    expect((await PUT(pedido("ficha", "PUT", { slug: A, versaoId: primeiraDeA }))).status).toBe(200);
    expect(await historico(c, A)).toHaveLength(3);
  });

  it("esconder: 200", async () => {
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    expect((await POST(pedido("visibilidade", "POST", CORPO_ESCONDER))).status).toBe(200);
    expect((await versoesAtuais(c)).has(A)).toBe(false);
  });

  it("aviso: 200", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    expect((await POST(pedido("aviso", "POST", corpoAviso()))).status).toBe(200);
    expect((await c.execute("SELECT ficha_slug FROM avisos")).rows.map((r) => r.ficha_slug)).toEqual([A]);
  });
});
