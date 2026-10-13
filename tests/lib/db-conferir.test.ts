import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { conferirLugar, contribuidorPorId, gravarEdicaoDaPessoa, naoConferidos } from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, PESSOA_DE_TESTE, semearAcervo, semearLugarDaPessoa } from "../banco";

let c: Client;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
});
afterEach(() => c.close());

const base = async (slug: string) => (await versaoAtual(c, slug))!.id;

describe("naoConferidos", () => {
  it("lista os lugares de quem usa, ainda não conferidos, o mais novo primeiro, com quem mandou", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 0, ?)",
      args: [PESSOA_DE_TESTE, "Maria Teste", "maria@teste.invalid", AGORA_SEMENTE],
    });
    const velho = await semearLugarDaPessoa(c, { nome: "Pedra Velha", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 10 });
    const novo = await semearLugarDaPessoa(c, { nome: "Pedra Nova", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 20 });
    const lista = await naoConferidos(c);
    expect(lista.map((l) => l.slug)).toEqual([novo, velho]);
    expect(lista[0]).toMatchObject({ mandadoEm: AGORA_SEMENTE + 20, contribuidor: { id: PESSOA_DE_TESTE, nome: "Maria Teste", email: "maria@teste.invalid", bloqueado: false } });
  });

  it("nenhum lugar do João entra, e o conferido sai", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99)).toBe(true);
    expect(await naoConferidos(c)).toEqual([]);
  });

  it("quem mandou sem linha em contribuidores aparece só com o id — nada inventado", async () => {
    await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect((await naoConferidos(c))[0].contribuidor).toEqual({ id: PESSOA_DE_TESTE, nome: null, email: null, bloqueado: false });
  });
});

describe("conferirLugar", () => {
  it("liga o conferido do lugar, e a leitura do público vê", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99)).toBe(true);
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(true);
  });

  it("lugar do João não tem o que conferir — false, e nenhuma linha nasce", async () => {
    expect(await conferirLugar(c, "rampa-do-pepe", await base("rampa-do-pepe"), AGORA_SEMENTE + 99)).toBe(false);
    expect(Number((await c.execute("SELECT COUNT(*) AS n FROM origem_do_lugar")).rows[0].n)).toBe(0);
  });

  it("o segundo toque não confere de novo — false", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99);
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 100)).toBe(false);
  });

  // 🔴 A ABA VELHA DO MESMO LUGAR (C1 da revisão final): o João abriu a versão
  // N; ela grava a N+1 (o lugar ainda não conferido é editável por ela); o
  // "Conferi" com o baseId da tela dele NÃO pode tirar a marca de um texto que
  // ele nunca viu. A versão N continua morando no endereço — só deixou de ser
  // a atual — por isso o caso de "outro lugar" (abaixo) não prova isto.
  it("ela edita entre a leitura dele e o Conferi: false, e o lugar continua não conferido", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const daTela = await base(slug);
    const nova = await gravarEdicaoDaPessoa(c, slug, (await versaoAtual(c, slug))!.doc, AGORA_SEMENTE + 50, daTela, PESSOA_DE_TESTE);
    expect(nova, "a premissa: a edição dela gravou").not.toBeNull();
    expect(await conferirLugar(c, slug, daTela, AGORA_SEMENTE + 99)).toBe(false);
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(false);
    // e com a versão que ele relê, confere
    expect(await conferirLugar(c, slug, nova!, AGORA_SEMENTE + 100)).toBe(true);
  });

  // A aba velha de OUTRO lugar: a versão que a tela abriu nunca morou aqui.
  it("baseId de outro lugar não confere este", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base("rampa-do-pepe"), AGORA_SEMENTE + 99)).toBe(false);
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(false);
  });

  it("conferir um lugar não confere OUTRO da mesma pessoa", async () => {
    const a = await semearLugarDaPessoa(c, { nome: "Pedra Um", cidade: "Cidade Teste" });
    const b = await semearLugarDaPessoa(c, { nome: "Pedra Dois", cidade: "Cidade Teste" });
    await conferirLugar(c, a, await base(a), AGORA_SEMENTE + 99);
    expect((await lerAcervoComOrigem(c)).linhas.get(b)?.conferido).toBe(false);
  });
});

describe("contribuidorPorId", () => {
  it("devolve a linha, e null pra quem não tem", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 1, ?)",
      args: [PESSOA_DE_TESTE, "Maria Teste", null, AGORA_SEMENTE],
    });
    expect(await contribuidorPorId(c, PESSOA_DE_TESTE)).toEqual({ id: PESSOA_DE_TESTE, nome: "Maria Teste", email: null, bloqueado: true });
    expect(await contribuidorPorId(c, "user_ninguem")).toBeNull();
  });
});
