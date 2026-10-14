import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRascunho, listarRascunhos } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, estaBloqueado, lerRascunhoDaPessoa,
  rascunhosDaPessoa, regravarRascunhoDaPessoa, registrarContribuidor, contribuidorPorId,
} from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, rascunhoNoBanco, semearAcervo } from "../banco";
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
  /** O rascunho dela nasce; devolve a CHAVE (Task 17: nunca o endereço). */
  const nasce = async (endereco: string, dono = PESSOA.id, quando = A): Promise<string> => {
    const chave = await criarRascunhoDaPessoa(c, endereco, doc(endereco), quando, dono);
    expect(chave, "a premissa: o rascunho nasceu").not.toBeNull();
    return chave!;
  };

  it("nasce numa chave nova, com o contribuidor, e não entra na lista do painel", async () => {
    const chave = await nasce("pedra-cidade");
    expect(chave).not.toBe("pedra-cidade");
    expect((await lerRascunhoDaPessoa(c, chave, PESSOA.id))?.doc).toBe(doc("pedra-cidade"));
    expect(await rascunhoNoBanco(c, "pedra-cidade"), "nada mora no endereço").toBeNull();
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("OUTRA pessoa não lê, não regrava, não apaga", async () => {
    const chave = await nasce("pedra-cidade");
    expect(await lerRascunhoDaPessoa(c, chave, OUTRA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, chave, '{"x":1}', A + 1, OUTRA.id)).toBe(false);
    expect(await regravarRascunhoDaPessoa(c, chave, doc("outro-cidade"), A + 1, OUTRA.id, "outro-cidade")).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, chave, OUTRA.id)).toBe(false);
    expect((await rascunhoNoBanco(c, chave))?.doc).toBe(doc("pedra-cidade"));
  });

  it("ela não alcança rascunho do João", async () => {
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await lerRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, "do-joao-cidade", '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBe(false);
  });

  // O aviso cedo (Task 17): o endereço que o par dela daria não pode ser de um
  // LUGAR (escondido inclusive). Rascunho nenhum recusa — nem do João, nem de
  // outra pessoa, nem dela mesma.
  it("não nasce quando o endereço é de um lugar (escondido inclusive); nasce sobre o endereço de qualquer rascunho", async () => {
    expect(await criarRascunhoDaPessoa(c, "rampa-do-pepe", doc("rampa-do-pepe"), A, PESSOA.id)).toBeNull();
    await c.execute("UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = 'rampa-do-pepe'");
    expect(await criarRascunhoDaPessoa(c, "rampa-do-pepe", doc("rampa-do-pepe"), A, PESSOA.id)).toBeNull();
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    await nasce("do-joao-cidade");
    await nasce("do-joao-cidade", OUTRA.id);
    await nasce("do-joao-cidade");
    expect(Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n)).toBe(4);
  });

  it("renomear (regravar COM endereço) pro endereço de um lugar: não grava; pro de um rascunho: grava", async () => {
    const chave = await nasce("pedra-cidade");
    expect(await regravarRascunhoDaPessoa(c, chave, doc("rampa-do-pepe"), A + 1, PESSOA.id, "rampa-do-pepe")).toBe(false);
    expect((await rascunhoNoBanco(c, chave))?.doc).toBe(doc("pedra-cidade"));
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await regravarRascunhoDaPessoa(c, chave, doc("do-joao-cidade"), A + 1, PESSOA.id, "do-joao-cidade")).toBe(true);
    expect((await rascunhoNoBanco(c, chave))?.doc).toBe(doc("do-joao-cidade"));
  });

  // 🔴 Ruling de produto da pré-auditoria (07/10): endereço antigo de outro
  // lugar não é dela — o link velho continua levando ao lugar de onde veio.
  it("não nasce, nem se renomeia, pra um endereço antigo de outro lugar", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES ('velho-cidade', 'rampa-do-pepe', ?)", args: [A] });
    expect(await criarRascunhoDaPessoa(c, "velho-cidade", doc("velho-cidade"), A, PESSOA.id)).toBeNull();
    const chave = await nasce("pedra-cidade");
    expect(await regravarRascunhoDaPessoa(c, chave, doc("velho-cidade"), A + 1, PESSOA.id, "velho-cidade")).toBe(false);
    expect((await rascunhoNoBanco(c, chave))?.doc).toBe(doc("pedra-cidade"));
  });

  // Onda de fix da Task 10: conta bloqueada não desiste (o que ela mandou fica pro João).
  it("bloqueada: não apaga", async () => {
    const chave = await nasce("pedra-cidade");
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await apagarRascunhoDaPessoa(c, chave, PESSOA.id)).toBe(false);
    expect((await rascunhoNoBanco(c, chave))?.contribuidor).toBe(PESSOA.id);
  });

  it("bloqueada: não cria, não regrava, não renomeia", async () => {
    const chave = await nasce("pedra-cidade");
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await criarRascunhoDaPessoa(c, "outra-cidade", doc("outra-cidade"), A, PESSOA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, chave, '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await regravarRascunhoDaPessoa(c, chave, doc("nova-cidade"), A + 1, PESSOA.id, "nova-cidade")).toBe(false);
  });

  it("a lista dela tem só os dela, o mexido por último primeiro", async () => {
    const um = await nasce("um-cidade");
    const dois = await nasce("dois-cidade", PESSOA.id, A + 5);
    await nasce("da-outra-cidade", OUTRA.id, A + 9);
    expect((await rascunhosDaPessoa(c, PESSOA.id)).map((r) => r.slug)).toEqual([dois, um]);
  });
});
