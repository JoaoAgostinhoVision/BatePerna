import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apagarRascunho,
  criarRascunho,
  ensureSchema,
  gravarVersao,
  lerRascunho,
  listarRascunhos,
  salvarRascunho,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import { buscarFichas, esquecerMemoria } from "@/lib/ficha-fonte";
import { semearAcervo } from "../banco";

/** A TABELA DE RASCUNHO (Tarefa 11) — a ÚNICA deste projeto que sobrescreve.
 *
 *  🔴 O que estes casos travam é a fronteira: o que está em `ficha_rascunhos`
 *  NUNCA está no ar, e o que está no ar NUNCA é sobrescrito por um rascunho.
 *  Os nomes dos lugares aqui são MARCADORES (`lugar-marcador-*`): nenhum lugar
 *  real é inventado num teste. */

let c: Client;
const AGORA = 1_758_000_000;
const S = "lugar-marcador-um";

beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
});
afterEach(() => {
  c.close();
  esquecerMemoria();
});

describe("ficha_rascunhos", () => {
  // 🔴 A razão de o rascunho existir: o que está em `ficha_versoes` está no ar
  // (a home lê `versoesAtuais`), então um lugar meio preenchido NUNCA pode
  // morar lá. As três leituras que mostram lugar — a do público, a do dono com
  // os escondidos, e o getter de produção — medidas com o acervo semeado (sem
  // ficha nenhuma, `buscarFichas` estoura e o caso não provaria nada).
  it("rascunho NÃO aparece no acervo público nem no painel de lugares", async () => {
    const fichas = await semearAcervo(c);
    expect(fichas.length, "a premissa: há lugares no banco").toBeGreaterThan(1);
    await salvarRascunho(c, S, JSON.stringify({ slug: S }), AGORA);

    expect((await versoesAtuais(c)).has(S)).toBe(false);
    expect((await versoesAtuais(c, { incluirOcultos: true })).has(S)).toBe(false);
    expect(await versaoAtual(c, S)).toBeNull();
    const publicas = await buscarFichas(() => versoesAtuais(c));
    expect(publicas.length, "a premissa: a leitura pública leu o acervo").toBe(fichas.length);
    expect(publicas.map((f) => f.slug)).not.toContain(S);
    // e o rascunho existe de verdade — sem isto, "não aparece" passaria com
    // `salvarRascunho` vazio
    expect(await lerRascunho(c, S)).not.toBeNull();
  });

  it("salvar duas vezes sobrescreve — o rascunho não versiona", async () => {
    await salvarRascunho(c, S, '{"a":1}', 1);
    await salvarRascunho(c, S, '{"a":2}', 2);
    expect(await listarRascunhos(c)).toHaveLength(1);
    const r = await lerRascunho(c, S);
    expect(r!.doc).toBe('{"a":2}');
    expect(r!.atualizado_em).toBe(2);
  });

  it("rascunho aceita documento INCOMPLETO — é o ponto", async () => {
    await expect(salvarRascunho(c, S, '{"slug":"x"}', 1)).resolves.not.toThrow();
    expect((await lerRascunho(c, S))!.doc).toBe('{"slug":"x"}');
  });

  it("lerRascunho de um slug sem rascunho é null, e não lê o rascunho de outro", async () => {
    await salvarRascunho(c, "lugar-marcador-dois", '{"quem":"dois"}', 1);
    expect(await lerRascunho(c, S)).toBeNull();
    await salvarRascunho(c, S, '{"quem":"um"}', 2);
    expect((await lerRascunho(c, S))!.doc).toBe('{"quem":"um"}');
    expect((await lerRascunho(c, "lugar-marcador-dois"))!.doc).toBe('{"quem":"dois"}');
  });

  // 🔴 CRIAR NÃO SOBRESCREVE. `salvarRascunho` sobrescreve (é o toque do
  // formulário); `criarRascunho` é a porta de NASCER, e um segundo "lugar novo"
  // com o mesmo nome não pode apagar o que o primeiro já respondeu.
  it("criarRascunho não sobrescreve um rascunho que já existe", async () => {
    expect(await criarRascunho(c, S, '{"quem":"primeiro"}', 1)).toBe(true);
    expect(await criarRascunho(c, S, '{"quem":"segundo"}', 2)).toBe(false);
    expect((await lerRascunho(c, S))!.doc).toBe('{"quem":"primeiro"}');
  });

  // 🔴 E NEM NASCE POR CIMA DE UM LUGAR QUE JÁ EXISTE — inclusive escondido.
  // A trava mora na própria consulta (`NOT EXISTS` em `ficha_versoes`, sem
  // filtro de `oculto`), e é a ÚNICA porta da colisão — a rota não confere
  // antes, só escolhe a frase depois de uma recusa.
  it("criarRascunho recusa slug que já tem versão — mesmo ESCONDIDO", async () => {
    await gravarVersao(c, S, '{"slug":"no-ar"}', "painel", 1);
    await gravarVersao(c, S, '{"slug":"no-ar"}', "painel", 2, true);
    expect(await criarRascunho(c, S, '{"quem":"novo"}', 3)).toBe(false);
    expect(await lerRascunho(c, S)).toBeNull();
  });

  it("listarRascunhos traz todos, o mais recente primeiro", async () => {
    await salvarRascunho(c, "lugar-marcador-a", "{}", 10);
    await salvarRascunho(c, "lugar-marcador-b", "{}", 30);
    await salvarRascunho(c, "lugar-marcador-c", "{}", 20);
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual([
      "lugar-marcador-b",
      "lugar-marcador-c",
      "lugar-marcador-a",
    ]);
  });

  it("apagarRascunho tira só aquele", async () => {
    await salvarRascunho(c, "lugar-marcador-a", "{}", 1);
    await salvarRascunho(c, "lugar-marcador-b", "{}", 2);
    await apagarRascunho(c, "lugar-marcador-a");
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual(["lugar-marcador-b"]);
  });

  // `ensureSchema` roda em todo `npm run semear` — a tabela nova tem de ser
  // idempotente como as outras, e não pode apagar rascunho nenhum.
  it("ensureSchema duas vezes não estoura nem apaga rascunho", async () => {
    await salvarRascunho(c, S, "{}", 1);
    await ensureSchema(c);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });
});
