import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enderecoNovoDe, lerAcervoComOrigem, publicarRascunho, versaoAtual } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { BLOQUEADA, FALTA_DA_PESSOA, FRASE_DA_PESSOA, JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { RASCUNHO_MUDOU, SLUG_DE_DENTRO } from "@/lib/porta-de-publicar";
import { TEXTO_LONGO_DEMAIS_NO_PUBLICAR } from "@/lib/campos-da-pessoa";
import { clienteQueIntercala, rascunhoNoBanco, semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
/** O ENDEREÇO que o par de `COMPLETO` dá — onde o lugar vai nascer. */
const SLUG = "pedra-mandada-cidade-teste";
/** A CHAVE do rascunho de agora (Task 17: o rascunho dela não mora no endereço). */
let CHAVE: string;
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

/** O rascunho nasce, e devolve o CORPO do publicar: `{slug: chave, atualizadoEm}`. */
async function rascunho(doc: unknown = COMPLETO, dono = PESSOA.id): Promise<{ slug: string; atualizadoEm: number }> {
  const chave = await criarRascunhoDaPessoa(c, SLUG, JSON.stringify(doc), AGORA - 10, dono);
  expect(chave, "a premissa: o rascunho nasceu").not.toBeNull();
  CHAVE = chave!;
  return { slug: CHAVE, atualizadoEm: (await rascunhoNoBanco(c, CHAVE))!.atualizado_em };
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
  it("200: no ar NA HORA no ENDEREÇO do par, não conferido, dela, e o rascunho (pela chave) some", async () => {
    const res = await POST(pedido(await rascunho()));
    expect(res.status, await res.clone().text()).toBe(200);
    // A resposta diz o endereço — é pra lá que a tela dela leva —, nunca a chave.
    expect(await res.json()).toEqual({ slug: SLUG });
    expect((await lerAcervoComOrigem(c)).linhas.get(SLUG)).toMatchObject({ oculto: false, conferido: false, contribuidor: PESSOA.id });
    expect(await rascunhoNoBanco(c, CHAVE)).toBeNull();
    expect(await versaoAtual(c, CHAVE), "nada mora na chave").toBeNull();
  });

  // O endereço sai do PAR do documento, na hora de publicar (Task 17): o
  // `slug` de dentro tem de dizer o mesmo — a porta dela o confere.
  it("o `slug` de dentro diferente do endereço do par: 400 com SLUG_DE_DENTRO, e nada vai ao ar", async () => {
    const res = await POST(pedido(await rascunho({ ...COMPLETO, slug: "outro-endereco-qualquer" })));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(SLUG_DE_DENTRO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect(await versaoAtual(c, "outro-endereco-qualquer")).toBeNull();
  });

  // M6 da revisão final: o rascunho com texto acima do teto (só chega por
  // fora das rotas dela) não vai ao ar; no teto, vai.
  it("promessa com 2001 caracteres: 400 com a frase do teto, nada vai ao ar; com 2000, vai", async () => {
    const recusa = await POST(pedido(await rascunho({ ...COMPLETO, promessa: "a".repeat(2001) })));
    expect(recusa.status).toBe(400);
    expect(await recusa.text()).toBe(TEXTO_LONGO_DEMAIS_NO_PUBLICAR);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    const ok = await POST(pedido(await rascunho({ ...COMPLETO, promessa: "a".repeat(2000) })));
    expect(ok.status, await ok.clone().text()).toBe(200);
  });

  it("rascunho de OUTRA pessoa: 404, e nada vai ao ar", async () => {
    const corpo = await rascunho(COMPLETO, OUTRA.id);
    expect((await POST(pedido(corpo))).status).toBe(404);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("faltando obrigatório dela: 400 com a frase, nada vai ao ar", async () => {
    const { promessa: _p, ...sem } = COMPLETO;
    const res = await POST(pedido(await rascunho(sem)));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_DA_PESSOA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("a promessa IGUAL à de um lugar do João: 409 com a frase DELA (não a do painel), nada vai ao ar", async () => {
    const rampa = JSON.parse((await versaoAtual(c, "rampa-do-pepe"))!.doc);
    const res = await POST(pedido(await rascunho({ ...COMPLETO, promessa: rampa.promessa })));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 I3 da pré-auditoria: a colisão do publicar responde a frase DELA, que
  // não nomeia ninguém (a Rampa nasceu sem cidade: nome igual é o gêmeo).
  it("o nome de um lugar do João: 409 com a frase DELA, que não nomeia ninguém, e nada vai ao ar", async () => {
    // O `slug` de dentro acompanha o par (o PUT dela o mantém assim).
    const endereco = "rampa-do-pepe-cidade-teste";
    const comNomeDaRampa = { ...COMPLETO, slug: endereco, trajeto: { waypoints: [{ ...COMPLETO.trajeto.waypoints[0], nome: "Rampa do Pepê" }] } };
    const res = await POST(pedido(await rascunho(comNomeDaRampa)));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, endereco)).toBeNull();
    expect(await rascunhoNoBanco(c, CHAVE)).not.toBeNull();
  });

  // Ruling de produto da pré-auditoria: o João troca um endereço DEPOIS que o
  // rascunho dela nasceu, e o endereço dela vira endereço antigo. O batch
  // recusa, e a frase é a dela — nunca o "Nada foi publicado. Recarregue" mudo.
  it("o endereço virou endereço antigo de outro lugar depois que ela começou: 409 com a frase dela, e o link velho continua", async () => {
    const corpo = await rascunho();
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const res = await POST(pedido(corpo));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect(await enderecoNovoDe(c, SLUG)).toBe("rampa-do-pepe");
  });

  it("o texto diz a hora de fechar e o horário não foi respondido: 409 com a frase dela", async () => {
    const res = await POST(pedido(await rascunho({ ...COMPLETO, avisos: "O portão fecha às 17h." })));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["hora-de-fechar-sem-campo"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("o rascunho mudou desde que a tela abriu: 409, nada vai ao ar", async () => {
    const corpo = await rascunho();
    const res = await POST(pedido({ ...corpo, atualizadoEm: corpo.atualizadoEm - 1 }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 Task 17: o duplo toque DEPOIS do 1º terminar acha a chave vazia — o
  // rascunho saiu no batch do 1º, e sem ele não há documento de onde tirar o
  // endereço. É 404, a régua de "não é dela ou não existe" (até a Task 17 a
  // chave era o endereço, e a rota achava o lugar ali e dava
  // `JA_NO_AR_DA_PESSOA`). O botão da tela fica desligado enquanto o pedido
  // anda, então este 2º toque só sai de outra aba.
  it("o duplo toque em série: o 2º é 404, e há UMA versão", async () => {
    const corpo = await rascunho();
    expect((await POST(pedido(corpo))).status).toBe(200);
    const res = await POST(pedido(corpo));
    expect(res.status).toBe(404);
    expect((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [SLUG] })).rows[0].n).toBe(1);
  });

  // O duplo toque CONCORRENTE — os dois leram o rascunho, e o 1º publica entre
  // a leitura do 2º e o batch dele: o 2º acha a versão no endereço e o
  // rascunho sumido, e a frase é a DELA.
  it("o duplo toque concorrente: o 2º responde 409 com a frase DELA, e há UMA versão", async () => {
    const corpo = await rascunho();
    const lido = (await rascunhoNoBanco(c, CHAVE))!;
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      const { prepararPublicacaoDaPessoa } = await import("@/lib/porta-da-pessoa");
      const preparo = prepararPublicacaoDaPessoa(lido.doc, SLUG);
      if (!("doc" in preparo)) throw new Error("a premissa: o rascunho publica");
      expect(await publicarRascunho(c, SLUG, preparo.doc, AGORA - 1, lido.atualizado_em, { contribuidor: PESSOA.id, chave: CHAVE })).toBe(true);
    });
    cli = corrida.cliente;
    const res = await POST(pedido(corpo));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_NO_AR_DA_PESSOA);
    expect((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [SLUG] })).rows[0].n).toBe(1);
  });

  // 🔴 M1 da revisão da Task 17: DOIS rascunhos dela (chaves diferentes — a
  // Task 17 permite) com o MESMO documento, publicados no MESMO segundo (duas
  // abas). O 1º batch grava; o 2º é recusado no 1º passo, mas a `porta` dele
  // PASSA (o rascunho dele está lá, e a versão no endereço tem este doc, este
  // `criado_em` e este autor) — e o INSERT de `origem_do_lugar` estoura a
  // restrição do banco. A transação volta inteira; a rota não pode responder
  // 500: é a mesma recusa de "outro lugar chegou primeiro".
  it("dois rascunhos dela, o mesmo doc, o mesmo segundo: o 2º é 409 com a frase de endereço tomado, não 500, e o rascunho fica", async () => {
    const primeiro = await rascunho();
    const chave1 = CHAVE;
    const segundo = await rascunho();
    const chave2 = CHAVE;
    expect(chave2, "a premissa: duas chaves").not.toBe(chave1);
    expect(segundo.atualizadoEm).toBe(primeiro.atualizadoEm);
    const lido = (await rascunhoNoBanco(c, chave1))!;
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      const { prepararPublicacaoDaPessoa } = await import("@/lib/porta-da-pessoa");
      const preparo = prepararPublicacaoDaPessoa(lido.doc, SLUG);
      if (!("doc" in preparo)) throw new Error("a premissa: o rascunho publica");
      // O MESMO `agora` da rota (o relógio é falso): é o que faz a porta passar.
      expect(await publicarRascunho(c, SLUG, preparo.doc, AGORA, lido.atualizado_em, { contribuidor: PESSOA.id, chave: chave1 })).toBe(true);
    });
    cli = corrida.cliente;
    const res = await POST(pedido(segundo));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [SLUG] })).rows[0].n).toBe(1);
    expect((await c.execute("SELECT COUNT(*) AS n FROM origem_do_lugar")).rows[0].n).toBe(1);
    expect(await rascunhoNoBanco(c, chave2), "o rascunho da 2ª aba fica").not.toBeNull();
    expect(await rascunhoNoBanco(c, chave1)).toBeNull();
  });

  // Só a restrição do banco vira recusa: qualquer outro erro do batch continua
  // subindo (a rota não engole falha de rede/banco como "nome em uso").
  it("outro erro no batch (não de restrição) continua subindo", async () => {
    const corpo = await rascunho();
    cli = new Proxy(c, {
      get(alvo, chave) {
        if (chave === "batch") return async () => { throw Object.assign(new Error("banco caiu"), { code: "SQLITE_IOERR" }); };
        const v = (alvo as unknown as Record<PropertyKey, unknown>)[chave];
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(alvo) : v;
      },
    });
    await expect(POST(pedido(corpo))).rejects.toThrow("banco caiu");
    expect(await rascunhoNoBanco(c, CHAVE)).not.toBeNull();
  });

  it("sem sessão 401; bloqueada 403; corpo torto 400 — nada vai ao ar", async () => {
    const corpo = await rascunho();
    sessao.atual = null;
    expect((await POST(pedido(corpo))).status).toBe(401);
    sessao.atual = PESSOA;
    expect((await POST(pedido({ slug: CHAVE }))).status).toBe(400);
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    expect((await POST(pedido(corpo))).status).toBe(403);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 A lição da Task 10: a porta deixou passar e o João bloqueou antes do
  // batch — quem derrubou o publicar foi o `bloqueado = 1` DENTRO do batch
  // (`publicarRascunho` com contribuidor). A frase é a de BLOQUEADA, e vem
  // antes de "mudou"/"em uso"/"recarregue": o rascunho está lá, intacto, e o
  // endereço está livre. O dublê dispara no 1º statement do batch.
  it("o bloqueio que chega entre a porta e o batch: 403 com a frase de bloqueada, e nada vai ao ar", async () => {
    const corpo = await rascunho();
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    });
    cli = corrida.cliente;
    const res = await POST(pedido(corpo));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect((await rascunhoNoBanco(c, CHAVE))?.atualizado_em).toBe(corpo.atualizadoEm);
  });

  // A ORDEM das duas recusas do batch: bloqueada E o endereço virou antigo, no
  // mesmo instante. Sem este caso, conferir o bloqueio só DEPOIS do
  // `porQueRecusou` (só quando ele não acha outra razão) sobrevivia — o caso de
  // cima não distingue as duas ordens, porque lá o `porQueRecusou` cairia no
  // "recarregue". A conta bloqueada é a razão que vale: a frase de "em uso"
  // mandaria ela trocar o nome de um lugar que ela não pode mais mandar.
  it("o bloqueio e o endereço antigo chegam juntos: 403 com a frase de bloqueada, não a de em uso", async () => {
    const corpo = await rascunho();
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
      await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    });
    cli = corrida.cliente;
    const res = await POST(pedido(corpo));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });
});
