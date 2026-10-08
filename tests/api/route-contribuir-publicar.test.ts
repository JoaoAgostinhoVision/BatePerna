import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enderecoNovoDe, lerAcervoComOrigem, rascunhoDeQualquerUm, versaoAtual } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { BLOQUEADA, FALTA_DA_PESSOA, FRASE_DA_PESSOA, JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { RASCUNHO_MUDOU } from "@/lib/porta-de-publicar";
import { clienteQueIntercala, semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
const SLUG = "pedra-mandada-cidade-teste";
const COMPLETO = {
  slug: SLUG, modos: [], cidade: "Cidade Teste", promessa: "Uma pedra que ninguém mais descreveu assim.", acesso: "De carro.",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] },
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
};
let c: Client;
/** O cliente que a ROTA vê — `c`, ou um que intercala (o caso da corrida),
 *  no molde de `route-contribuir-rascunho.test.ts`. */
let cli: Client;
let POST: typeof import("@/app/api/contribuir/publicar/route").POST;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  POST = (await import("@/app/api/contribuir/publicar/route")).POST;
});
afterEach(() => { c.close(); vi.useRealTimers(); });

async function rascunho(doc: unknown = COMPLETO, dono = PESSOA.id): Promise<number> {
  await criarRascunhoDaPessoa(c, SLUG, JSON.stringify(doc), AGORA - 10, dono);
  return (await rascunhoDeQualquerUm(c, SLUG))!.atualizado_em;
}
const pedido = (corpo: unknown) => new Request("http://x/api/contribuir/publicar", { method: "POST", body: JSON.stringify(corpo) });

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

describe("POST /api/contribuir/publicar", () => {
  it("200: no ar NA HORA, não conferido, dela, e o rascunho some", async () => {
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho() }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await lerAcervoComOrigem(c)).linhas.get(SLUG)).toMatchObject({ oculto: false, conferido: false, contribuidor: PESSOA.id });
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("rascunho de OUTRA pessoa: 404, e nada vai ao ar", async () => {
    const em = await rascunho(COMPLETO, OUTRA.id);
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(404);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("faltando obrigatório dela: 400 com a frase, nada vai ao ar", async () => {
    const { promessa: _p, ...sem } = COMPLETO;
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho(sem) }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_DA_PESSOA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("a promessa IGUAL à de um lugar do João: 409 com a frase DELA (não a do painel), nada vai ao ar", async () => {
    const rampa = JSON.parse((await versaoAtual(c, "rampa-do-pepe"))!.doc);
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho({ ...COMPLETO, promessa: rampa.promessa }) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 I3 da pré-auditoria: a colisão do publicar responde a frase DELA, que
  // não nomeia ninguém (a Rampa nasceu sem cidade: nome igual é o gêmeo).
  it("o nome de um lugar do João: 409 com a frase DELA, que não nomeia ninguém, e nada vai ao ar", async () => {
    const comNomeDaRampa = { ...COMPLETO, trajeto: { waypoints: [{ ...COMPLETO.trajeto.waypoints[0], nome: "Rampa do Pepê" }] } };
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho(comNomeDaRampa) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // Ruling de produto da pré-auditoria: o João troca um endereço DEPOIS que o
  // rascunho dela nasceu, e o endereço dela vira endereço antigo. O batch
  // recusa, e a frase é a dela — nunca o "Nada foi publicado. Recarregue" mudo.
  it("o endereço virou endereço antigo de outro lugar depois que ela começou: 409 com a frase dela, e o link velho continua", async () => {
    const em = await rascunho();
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect(await enderecoNovoDe(c, SLUG)).toBe("rampa-do-pepe");
  });

  it("o texto diz a hora de fechar e o horário não foi respondido: 409 com a frase dela", async () => {
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho({ ...COMPLETO, avisos: "O portão fecha às 17h." }) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["hora-de-fechar-sem-campo"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("o rascunho mudou desde que a tela abriu: 409, nada vai ao ar", async () => {
    const em = await rascunho();
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em - 1 }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("o duplo toque: o 2º responde 409 com a frase DELA, e há UMA versão", async () => {
    const em = await rascunho();
    await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_NO_AR_DA_PESSOA);
    expect((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [SLUG] })).rows[0].n).toBe(1);
  });

  it("sem sessão 401; bloqueada 403; corpo torto 400 — nada vai ao ar", async () => {
    const em = await rascunho();
    sessao.atual = null;
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(401);
    sessao.atual = PESSOA;
    expect((await POST(pedido({ slug: SLUG }))).status).toBe(400);
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(403);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 A lição da Task 10: a porta deixou passar e o João bloqueou antes do
  // batch — quem derrubou o publicar foi o `bloqueado = 1` DENTRO do batch
  // (`publicarRascunho` com contribuidor). A frase é a de BLOQUEADA, e vem
  // antes de "mudou"/"em uso"/"recarregue": o rascunho está lá, intacto, e o
  // endereço está livre. O dublê dispara no 1º statement do batch.
  it("o bloqueio que chega entre a porta e o batch: 403 com a frase de bloqueada, e nada vai ao ar", async () => {
    const em = await rascunho();
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    });
    cli = corrida.cliente;
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect((await rascunhoDeQualquerUm(c, SLUG))?.atualizado_em).toBe(em);
  });

  // A ORDEM das duas recusas do batch: bloqueada E o endereço virou antigo, no
  // mesmo instante. Sem este caso, conferir o bloqueio só DEPOIS do
  // `porQueRecusou` (só quando ele não acha outra razão) sobrevivia — o caso de
  // cima não distingue as duas ordens, porque lá o `porQueRecusou` cairia no
  // "recarregue". A conta bloqueada é a razão que vale: a frase de "em uso"
  // mandaria ela trocar o nome de um lugar que ela não pode mais mandar.
  it("o bloqueio e o endereço antigo chegam juntos: 403 com a frase de bloqueada, não a de em uso", async () => {
    const em = await rascunho();
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
      await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    });
    cli = corrida.cliente;
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });
});
