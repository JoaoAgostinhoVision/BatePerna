import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRascunho, listarRascunhos, rascunhoDeQualquerUm } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, estaBloqueado, lerRascunhoDaPessoa, moverRascunhoDaPessoa,
  rascunhosDaPessoa, regravarRascunhoDaPessoa, registrarContribuidor, contribuidorPorId,
} from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await semearAcervo(c); });
afterEach(() => c.close());
const A = AGORA_SEMENTE;
const doc = (slug: string) => JSON.stringify({ slug });

describe("registrarContribuidor", () => {
  it("nasce desbloqueado, e o perfil novo atualiza nome e e-mail", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await registrarContribuidor(c, { ...PESSOA, nome: "Maria Nova" }, A + 1);
    expect(await contribuidorPorId(c, PESSOA.id)).toEqual({ id: PESSOA.id, nome: "Maria Nova", email: PESSOA.email, bloqueado: false });
  });

  it("perfil que não veio (null) não apaga o que já havia", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await registrarContribuidor(c, { id: PESSOA.id, nome: null, email: null }, A + 1);
    expect(await contribuidorPorId(c, PESSOA.id)).toMatchObject({ nome: PESSOA.nome, email: PESSOA.email });
  });

  // 🔴 Registrar de novo NUNCA desbloqueia: só o João desbloqueia (Task 15).
  it("registrar de novo não desbloqueia", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    await registrarContribuidor(c, PESSOA, A + 1);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
  });
});

describe("o rascunho dela é dela", () => {
  it("nasce com o contribuidor, e não entra na lista do painel", async () => {
    expect(await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id)).toBe(true);
    expect((await lerRascunhoDaPessoa(c, "pedra-cidade", PESSOA.id))?.slug).toBe("pedra-cidade");
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("OUTRA pessoa não lê, não regrava, não move, não apaga", async () => {
    await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id);
    expect(await lerRascunhoDaPessoa(c, "pedra-cidade", OUTRA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, "pedra-cidade", '{"x":1}', A + 1, OUTRA.id)).toBe(false);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "outro-cidade", doc("outro-cidade"), A + 1, OUTRA.id)).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, "pedra-cidade", OUTRA.id)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, "pedra-cidade"))?.doc).toBe(doc("pedra-cidade"));
  });

  it("ela não alcança rascunho do João", async () => {
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await lerRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, "do-joao-cidade", '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBe(false);
  });

  it("não nasce em endereço de lugar (escondido inclusive) nem de outro rascunho", async () => {
    expect(await criarRascunhoDaPessoa(c, "rampa-do-pepe", doc("rampa-do-pepe"), A, PESSOA.id)).toBe(false);
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await criarRascunhoDaPessoa(c, "do-joao-cidade", doc("do-joao-cidade"), A, PESSOA.id)).toBe(false);
  });

  // 🔴 Ruling de produto da pré-auditoria (07/10): endereço antigo de outro
  // lugar não é dela — o link velho continua levando ao lugar de onde veio.
  it("não nasce, nem se muda, pra um endereço antigo de outro lugar", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES ('velho-cidade', 'rampa-do-pepe', ?)", args: [A] });
    expect(await criarRascunhoDaPessoa(c, "velho-cidade", doc("velho-cidade"), A, PESSOA.id)).toBe(false);
    expect(await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id)).toBe(true);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "velho-cidade", doc("velho-cidade"), A + 1, PESSOA.id)).toBe(false);
    expect(await rascunhoDeQualquerUm(c, "velho-cidade")).toBeNull();
    expect((await rascunhoDeQualquerUm(c, "pedra-cidade"))?.contribuidor).toBe(PESSOA.id);
  });

  it("bloqueada: não cria, não regrava, não move", async () => {
    await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id);
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await criarRascunhoDaPessoa(c, "outra-cidade", doc("outra-cidade"), A, PESSOA.id)).toBe(false);
    expect(await regravarRascunhoDaPessoa(c, "pedra-cidade", '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "nova-cidade", doc("nova-cidade"), A + 1, PESSOA.id)).toBe(false);
  });

  it("a lista dela tem só os dela, o mexido por último primeiro", async () => {
    await criarRascunhoDaPessoa(c, "um-cidade", doc("um-cidade"), A, PESSOA.id);
    await criarRascunhoDaPessoa(c, "dois-cidade", doc("dois-cidade"), A + 5, PESSOA.id);
    await criarRascunhoDaPessoa(c, "da-outra-cidade", doc("da-outra-cidade"), A + 9, OUTRA.id);
    expect((await rascunhosDaPessoa(c, PESSOA.id)).map((r) => r.slug)).toEqual(["dois-cidade", "um-cidade"]);
  });
});
