import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historico, versaoAtual } from "@/lib/db";
import { conferirLugar } from "@/lib/db-contribuidor";
import { BLOQUEADA, CLERK_FORA, FRASE_DA_PESSOA, JA_CONFERIDO, NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { clienteQueIntercala, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
let c: Client;
/** O cliente que a ROTA vê — `c`, ou um que intercala (os casos de corrida). */
let cli: Client;
let SLUG: string;
let PUT: typeof import("@/app/api/contribuir/lugar/route").PUT;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  PUT = (await import("@/app/api/contribuir/lugar/route")).PUT;
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const base = async (s = SLUG) => (await versaoAtual(c, s))!.id;
const pedido = (corpo: unknown) => new Request("http://x/api/contribuir/lugar", { method: "PUT", body: JSON.stringify(corpo) });
const versoes = async () => (await historico(c, SLUG)).length;

describe("o dublê do Clerk", () => {
  // A SONDA 2 de `route-contribuir-rascunho.test.ts`, copiada (global
  // constraints): o lugar onde o dublê RENASCE é um import direto depois do
  // `vi.resetModules()`. Com o estado num `const` do módulo, esta instância
  // nova teria outro `sessao`; com o `globalThis`, é o mesmo.
  it("SONDA 2: o dublê reimportado depois de `vi.resetModules()` é o MESMO objeto", async () => {
    vi.resetModules();
    const outraInstancia = await import("../sessao-da-pessoa");
    expect(outraInstancia.sessao, "o módulo do dublê renasceu com OUTRO estado").toBe(sessao);
  });
});

describe("PUT /api/contribuir/lugar", () => {
  it("um campo dela: 200, versão nova dela", async () => {
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "De moto também." }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).acesso).toBe("De moto também.");
    expect(await versoes()).toBe(2);
  });

  it.each(["voz", "condicao.regra.limiar_mm", "discriminador.como_ler", "custo.curto"])(
    "campo fora da lista dela (`%s`): 400, nada gravado",
    async (campo) => {
      const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo, valor: campo.endsWith("limiar_mm") ? 1 : "x" }));
      expect(res.status).toBe(400);
      expect(await versoes()).toBe(1);
    },
  );

  it("o ponto troca o ponto 0 e a chuva juntos", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), ponto: 0, lat: -8.4, lng: -36.0 }));
    const d = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect(d.condicao.coords).toEqual({ lat: -8.4, lng: -36.0 });
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.4, lng: -36.0 });
  });

  // I1 da revisão da Task 12: o portão da coerência na edição dela. A
  // promessa IGUAL à de um lugar do João introduz `texto-emprestado`: 409 com
  // a frase DELA pela regra (nunca a do painel, que nomeia a Rampa), e a
  // versão no banco não muda.
  it("a promessa igual à de um lugar do João: 409 com a frase dela, nada gravado", async () => {
    const antes = (await versaoAtual(c, SLUG))!;
    const rampa = JSON.parse((await versaoAtual(c, "rampa-do-pepe"))!.doc);
    const res = await PUT(pedido({ slug: SLUG, baseId: antes.id, campo: "promessa", valor: rampa.promessa }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
    expect(await versoes()).toBe(1);
    const depois = (await versaoAtual(c, SLUG))!;
    expect([depois.id, depois.doc]).toEqual([antes.id, antes.doc]);
  });

  it("trocar o nome muda o documento e NÃO o endereço", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Pedra Renomeada" }));
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).trajeto.waypoints[0].nome).toBe("Pedra Renomeada");
    expect(await versaoAtual(c, "pedra-renomeada-cidade-teste")).toBeNull();
  });

  // I3 da pré-auditoria: renomear pro nome de um lugar do João (o gêmeo sem
  // cidade) é 409 com a frase DELA — nunca "responda a cidade dele, pela lista
  // do painel" —, e nada é gravado.
  it("renomear pro nome de um lugar do João: 409 com a frase dela, nada gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versoes()).toBe(1);
  });

  it("lugar de OUTRA pessoa, ou do João: 404, nada gravado", async () => {
    sessao.atual = OUTRA;
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }))).status).toBe(404);
    sessao.atual = PESSOA;
    expect((await PUT(pedido({ slug: "rampa-do-pepe", baseId: await base("rampa-do-pepe"), campo: "acesso", valor: "x" }))).status).toBe(404);
    expect(await versoes()).toBe(1);
    expect(await historico(c, "rampa-do-pepe")).toHaveLength(1);
  });

  it("depois do Conferi: 409 com a frase, nada gravado", async () => {
    await conferirLugar(c, SLUG, await base(), AGORA - 1);
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_CONFERIDO);
    expect(await versoes()).toBe(1);
  });

  // Conferido E pedindo um nome em uso: a resposta é "já conferido" (ela não
  // edita mais nada aqui), não a colisão — a leitura de antes escolhe a frase
  // ANTES do par. Sem ela, só a recusa do INSERT diria "já conferido", e o par
  // falaria primeiro.
  it("depois do Conferi, pedindo um nome em uso: 409 JA_CONFERIDO, não a frase da colisão", async () => {
    await conferirLugar(c, SLUG, await base(), AGORA - 1);
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_CONFERIDO);
    expect(await versoes()).toBe(1);
  });

  // 🔴 Review Focus 2: o João toca "Conferi" DEPOIS que a rota leu o lugar e
  // ANTES de gravar. A condição mora no INSERT, então nada grava.
  it("a corrida com o Conferi: 409, nada gravado", async () => {
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await conferirLugar(c, SLUG, await base(), AGORA - 1);
    });
    cli = corrida.cliente;
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_CONFERIDO);
    expect(await versoes()).toBe(1);
  });

  // 🔴 O bloqueio que chega entre a porta e o INSERT (lição da Task 10/11): a
  // recusa é a MESMA da porta (403 com a frase), e vem antes das outras —
  // inclusive quando o João conferiu E bloqueou no mesmo intervalo.
  it("a corrida com o bloqueio (e com o Conferi junto): 403 com a frase, nada gravado", async () => {
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
      await conferirLugar(c, SLUG, await base(), AGORA - 1);
    });
    cli = corrida.cliente;
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versoes()).toBe(1);
  });

  it("sem baseId: 400; sem sessão: 401; bloqueada: 403 — nada gravado", async () => {
    expect((await PUT(pedido({ slug: SLUG, campo: "acesso", valor: "x" }))).status).toBe(400);
    sessao.atual = null;
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }))).status).toBe(401);
    sessao.atual = PESSOA;
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versoes()).toBe(1);
  });

  // Bloqueada E pedindo um nome que colide: a resposta é a do bloqueio, nunca
  // a frase da colisão (a ordem da Task 11: a porta antes de tudo).
  it("bloqueada pedindo um nome em uso: 403 com a frase do bloqueio, não a da colisão", async () => {
    // Nenhum pedido passou pela porta ainda: a linha dela pode não existir.
    await c.execute({
      sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET bloqueado = 1",
      args: [PESSOA.id, AGORA],
    });
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
  });

  // O 503 que a rota do publicar não provava (revisão da Task 11): com o
  // Clerk fora, a porta responde ANTES de qualquer leitura — sem a porta, a
  // rota gravaria (200).
  it("Clerk fora: 503 com a frase, nada gravado", async () => {
    sessao.fora = true;
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA);
    expect(await versoes()).toBe(1);
  });

  it("'não sei' em `avisos` tira a chave; em `acesso`, 400", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "avisos", valor: "Leve água." }));
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "avisos", naoSei: true }))).status).toBe(200);
    expect("avisos" in JSON.parse((await versaoAtual(c, SLUG))!.doc)).toBe(false);
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", naoSei: true }))).status).toBe(400);
  });
});
