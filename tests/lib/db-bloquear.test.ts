import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historico, lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import {
  bloquearContribuidor, conferirLugar, contribuidorPorId, criarRascunhoDaPessoa, desbloquearContribuidor, estaBloqueado,
  registrarContribuidor,
} from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
let A: string;
let B: string;
let DA_OUTRA: string;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  A = await semearLugarDaPessoa(c, { nome: "Pedra Um", cidade: "Cidade Teste" });
  B = await semearLugarDaPessoa(c, { nome: "Pedra Dois", cidade: "Cidade Teste" });
  DA_OUTRA = await semearLugarDaPessoa(c, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
});
afterEach(() => c.close());
const T = AGORA_SEMENTE + 500;
const oculto = async (s: string) => (await versaoAtual(c, s))!.oculto;

describe("bloquearContribuidor", () => {
  it("bloqueia, e esconde TODOS os lugares dela — conferidos inclusive", async () => {
    await conferirLugar(c, B, (await versaoAtual(c, B))!.id, T - 1);
    expect(await bloquearContribuidor(c, PESSOA.id, T)).toBe(2);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
    expect([await oculto(A), await oculto(B)]).toEqual([true, true]);
  });

  it("não encosta nos lugares de outra pessoa nem nos do João", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await oculto(DA_OUTRA)).toBe(false);
    expect(await oculto("rampa-do-pepe")).toBe(false);
  });

  it("esconder é VERSÃO NOVA (append-only), com o documento intacto", async () => {
    const antes = (await versaoAtual(c, A))!.doc;
    await bloquearContribuidor(c, PESSOA.id, T);
    const h = await historico(c, A);
    expect(h).toHaveLength(2);
    expect(h[0].doc).toBe(antes);
    expect(h[0].autor).toBe("painel");
  });

  it("o lugar já escondido não ganha versão repetida", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [A] });
    expect(await bloquearContribuidor(c, PESSOA.id, T)).toBe(1);
    expect(await historico(c, A)).toHaveLength(1);
  });

  it("quem nunca passou pela porta (sem linha em contribuidores) é bloqueado do mesmo jeito", async () => {
    expect(await contribuidorPorId(c, PESSOA.id)).toBeNull();
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
  });

  // 🔴 M6 da pré-auditoria: o caso de cima NÃO mata o `ON CONFLICT … DO
  // NOTHING` — sem linha prévia, o INSERT nasce bloqueado de qualquer jeito. É
  // ESTE que o mata: quem já passou pela porta TEM linha (`bloqueado = 0`), e
  // só o `DO UPDATE SET bloqueado = 1` a bloqueia.
  it("quem JÁ passou pela porta (com linha, desbloqueada) também é bloqueado — nome e e-mail ficam", async () => {
    await registrarContribuidor(c, PESSOA, T - 10);
    expect(await estaBloqueado(c, PESSOA.id), "a premissa: a linha existe, desbloqueada").toBe(false);
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await contribuidorPorId(c, PESSOA.id)).toEqual({ id: PESSOA.id, nome: PESSOA.nome, email: PESSOA.email, bloqueado: true });
  });

  it("e a leitura do público deixa de ver os lugares dela", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get(A)?.oculto).toBe(true);
    expect(linhas.get(DA_OUTRA)?.oculto).toBe(false);
  });
});

describe("desbloquearContribuidor", () => {
  it("desfaz o bloqueio e deixa os lugares escondidos", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await desbloquearContribuidor(c, PESSOA.id)).toBe(true);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect(await oculto(A)).toBe(true);
  });

  it("depois de desbloqueada, ela volta a gravar", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    await desbloquearContribuidor(c, PESSOA.id);
    expect(await criarRascunhoDaPessoa(c, "nova-cidade", '{"slug":"nova-cidade"}', T, PESSOA.id)).not.toBeNull();
  });
});
