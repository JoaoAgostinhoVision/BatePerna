import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema, gravarVersao, trocarEndereco, versaoAtual, versoesAtuais } from "@/lib/db";
import { semearAcervo, base, clienteQueIntercala, comBaseAtual } from "../banco";
import { lugarMarcador } from "../lugar-marcador";

/** DUAS GRAVAÇÕES DO MESMO LUGAR, UMA NO MEIO DA OUTRA (onda de fix 3 da Tarefa
 *  11e, N1 da re-revisão — linha vermelha, e pré-existente à 11e).
 *
 *  Na mesma tela do painel, "Salvar" um campo e "Esconder" são botões
 *  separados. O PUT de campo é a rota mais lenta (roda a coerência sobre o
 *  acervo inteiro); se o dono toca "Esconder" enquanto ela trabalha, o esconder
 *  termina antes. Até esta onda, cada gravação levava o que NÃO era o assunto
 *  dela (o `oculto` do campo e do voltar; o `doc` do esconder) de uma leitura
 *  feita ANTES, e a de depois apagava a outra: as duas davam 200 e **o lugar
 *  voltava ao ar em silêncio**; no inverso, a voz recém-salva sumia.
 *
 *  🔴 A INTERCALAÇÃO É A DO BANCO, NA ROTA DE VERDADE: o `getClient` das rotas é
 *  um `clienteQueIntercala` que, imediatamente antes do `INSERT INTO
 *  ficha_versoes` da 1ª gravação, roda a 2ª pela rota inteira. Cada caso afirma
 *  que o dublê DISPAROU e que a 2ª deu 200 — sem isso, mediria o vazio.
 *
 *  ⚠️ NÃO É TRAVA DE CONCORRÊNCIA: as duas gravações passam, cada uma preservando
 *  o assunto da outra (ruling U1: `baseId` é identidade, não versão esperada).
 *  Nomes e cidades são marcadores. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-intercalacao";
const AGORA = 1_759_500_000;
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";
const C = "lugar-marcador-q-antes";
const D = "lugar-marcador-q-depois";
const VOZ_NOVA = "Uma voz marcadora salva no meio de outra gravação.";

let c: Client;
/** O que o `getClient` das rotas devolve: `c`, ou o dublê que intercala. */
let daRota: Client;
let cookieBom: string;
let primeiraDeA: number;

/** A corrida do N5: o que roda logo DEPOIS da leitura de `versaoAtual(A)`. */
const corrida = vi.hoisted(() => ({ depoisDeLer: null as null | (() => Promise<void>) }));

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return {
    ...mod,
    getClient: () => daRota,
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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  daRota = c;
  await ensureSchema(c);
  await semearAcervo(c);
  primeiraDeA = await gravarVersao(
    c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 100,
  );
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 50);
  corrida.depoisDeLer = null;
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

const rotaFicha = async () => comBaseAtual((await import("@/app/api/admin/ficha/route")).PUT, () => c);
const rotaVisibilidade = async () =>
  comBaseAtual((await import("@/app/api/admin/visibilidade/route")).POST, () => c);

/** Arma o dublê: antes do 1º `INSERT INTO ficha_versoes` da rota, roda `outra`
 *  e confere que ela respondeu 200. Devolve o contador de disparos. */
function intercalar(outra: () => Promise<Response>): () => number {
  const { cliente, disparos } = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {
    daRota = c; // a 2ª gravação corre limpa, sem gatilho
    const res = await outra();
    expect(res.status, `a gravação do meio não passou: ${await res.clone().text()}`).toBe(200);
    daRota = cliente;
  });
  daRota = cliente;
  return disparos;
}

describe("N1: Salvar e Esconder na mesma tela, um no meio do outro", () => {
  it("Salvar um campo + Esconder no meio: os dois 200, a voz nova entra E o lugar continua fora do ar", async () => {
    const PUT = await rotaFicha();
    const POST = await rotaVisibilidade();
    const disparos = intercalar(() => POST(pedido("visibilidade", "POST", { slug: A, oculto: true })));

    const res = await PUT(pedido("ficha", "PUT", { slug: A, campo: "voz", valor: VOZ_NOVA }));
    expect(disparos(), "o dublê nunca disparou: o teste não intercalou nada").toBeGreaterThan(0);
    expect(res.status, await res.clone().text()).toBe(200);

    const atual = (await versaoAtual(c, A))!;
    expect(JSON.parse(atual.doc).voz).toBe(VOZ_NOVA);
    expect(atual.oculto, "o Salvar pôs o lugar de volta no ar").toBe(true);
    expect((await versoesAtuais(c)).has(A), "o lugar escondido está no público").toBe(false);
  });

  it("voltar a uma versão + Esconder no meio: os dois 200, o documento volta E o lugar continua fora do ar", async () => {
    const PUT = await rotaFicha();
    const POST = await rotaVisibilidade();
    const disparos = intercalar(() => POST(pedido("visibilidade", "POST", { slug: A, oculto: true })));

    const res = await PUT(pedido("ficha", "PUT", { slug: A, versaoId: primeiraDeA }));
    expect(disparos(), "o dublê nunca disparou: o teste não intercalou nada").toBeGreaterThan(0);
    expect(res.status, await res.clone().text()).toBe(200);

    const atual = (await versaoAtual(c, A))!;
    expect(JSON.parse(atual.doc).cidade).toBe("Bom Marcador");
    expect(atual.oculto, "o voltar pôs o lugar de volta no ar").toBe(true);
    expect((await versoesAtuais(c)).has(A), "o lugar escondido está no público").toBe(false);
  });

  it("Esconder + Salvar um campo no meio: os dois 200, o lugar sai do ar E a voz recém-salva NÃO some", async () => {
    const PUT = await rotaFicha();
    const POST = await rotaVisibilidade();
    const disparos = intercalar(() => PUT(pedido("ficha", "PUT", { slug: A, campo: "voz", valor: VOZ_NOVA })));

    const res = await POST(pedido("visibilidade", "POST", { slug: A, oculto: true }));
    expect(disparos(), "o dublê nunca disparou: o teste não intercalou nada").toBeGreaterThan(0);
    expect(res.status, await res.clone().text()).toBe(200);

    const atual = (await versaoAtual(c, A))!;
    expect(atual.oculto).toBe(true);
    expect(JSON.parse(atual.doc).voz, "o esconder regravou o documento velho: a voz salva sumiu").toBe(VOZ_NOVA);
  });
});

// N5 da re-revisão: o "esconder" que acha o estado pedido já valendo não grava
// nada — mas "já valendo" tem de ser do lugar DA TELA no mesmo instante. Com
// duas trocas entre a leitura e a resposta (Q sai de A, P volta pra A), a rota
// lia "Q escondido" e respondia 200 sobre P, que estava no ar.
describe("N5: o esconder que não grava decide numa consulta só", () => {
  it("Q (escondido) sai de A e P volta pra A entre a leitura e a resposta: P sai do ar, nunca um 200 com P no ar", async () => {
    const deP = await base(c, A);
    expect(await trocarEndereco(c, A, B, AGORA - 40, deP)).toBe(true);
    await gravarVersao(c, C, JSON.stringify(lugarMarcador(C, "Lugar Q Marcador", "Cidade Q Marcadora")), "painel", AGORA - 30);
    expect(await trocarEndereco(c, C, A, AGORA - 20, await base(c, C))).toBe(true);
    await gravarVersao(c, A, (await versaoAtual(c, A))!.doc, "painel", AGORA - 10, true); // Q escondido

    corrida.depoisDeLer = async () => {
      expect(await trocarEndereco(c, A, D, AGORA, await base(c, A)), "Q não saiu de A").toBe(true);
      expect(await trocarEndereco(c, B, A, AGORA + 1, deP), "P não voltou pra A").toBe(true);
    };
    const { POST } = await import("@/app/api/admin/visibilidade/route");
    const res = await POST(pedido("visibilidade", "POST", { slug: A, oculto: true, baseId: deP }));
    expect(corrida.depoisDeLer, "a corrida não aconteceu").toBeNull();

    expect(res.status, await res.clone().text()).toBe(200);
    const p = (await versaoAtual(c, A))!;
    expect(JSON.parse(p.doc).trajeto.waypoints[0].nome).toBe("Lugar Marcador");
    expect(p.oculto, "200 de um esconder, e P no ar").toBe(true);
    expect((await versoesAtuais(c)).has(A)).toBe(false);
  });
});
