import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historico, versaoAtual } from "@/lib/db";
import { conferirLugar, gravarEdicaoDaPessoa, lugaresDaPessoa } from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
let SLUG: string;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});
afterEach(() => c.close());
const A = AGORA_SEMENTE + 100;
const base = async (s = SLUG) => (await versaoAtual(c, s))!.id;
const outroDoc = async () => JSON.stringify({ ...JSON.parse((await versaoAtual(c, SLUG))!.doc), promessa: "Nova." });

describe("gravarEdicaoDaPessoa", () => {
  it("grava, com autor 'contribuidor'", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), PESSOA.id)).not.toBeNull();
    const v = (await versaoAtual(c, SLUG))!;
    expect(JSON.parse(v.doc).promessa).toBe("Nova.");
    expect(v.autor).toBe("contribuidor");
  });

  it("OUTRA pessoa não grava no lugar dela", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), OUTRA.id)).toBeNull();
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("ninguém de fora grava em lugar do João", async () => {
    const doc = (await versaoAtual(c, "rampa-do-pepe"))!.doc;
    expect(await gravarEdicaoDaPessoa(c, "rampa-do-pepe", doc, A, await base("rampa-do-pepe"), PESSOA.id)).toBeNull();
  });

  it("depois do Conferi, ela não grava mais", async () => {
    await conferirLugar(c, SLUG, await base(), A);
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A + 1, await base(), PESSOA.id)).toBeNull();
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("bloqueada, ela não grava", async () => {
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A + 1, await base(), PESSOA.id)).toBeNull();
  });

  it("editar lugar escondido não o devolve ao ar", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [SLUG] });
    await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), PESSOA.id);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("a versão da tela que não mora aqui não grava", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base("rampa-do-pepe"), PESSOA.id)).toBeNull();
  });
});

describe("lugaresDaPessoa", () => {
  it("só os dela, com conferido e oculto, o mais novo primeiro", async () => {
    const novo = await semearLugarDaPessoa(c, { nome: "Pedra Nova", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 60 });
    await semearLugarDaPessoa(c, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
    await conferirLugar(c, SLUG, await base(), A);
    const l = await lugaresDaPessoa(c, PESSOA.id);
    expect(l.map((x) => [x.slug, x.conferido, x.oculto])).toEqual([[novo, false, false], [SLUG, true, false]]);
  });

  // Escondido pelo João continua na lista DELA, marcado `oculto` — e o
  // documento é o da versão ATUAL, não o da versão 1 (a identidade).
  it("o escondido entra marcado, com o documento da versão atual", async () => {
    await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), PESSOA.id);
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [SLUG] });
    const [l] = await lugaresDaPessoa(c, PESSOA.id);
    expect([l.slug, l.oculto, JSON.parse(l.doc).promessa]).toEqual([SLUG, true, "Nova."]);
  });
});
