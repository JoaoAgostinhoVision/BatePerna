import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apagarRascunho,
  criarRascunho,
  ensureSchema,
  gravarVersao,
  lerRascunho,
  listarRascunhos,
  moverRascunho,
  regravarRascunho,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import { buscarFichas, esquecerMemoria } from "@/lib/ficha-fonte";
import { salvarRascunho, semearAcervo } from "../banco";

/** A TABELA DE RASCUNHO (Tarefa 11) — que sobrescreve, ao contrário de
 *  `ficha_versoes` e `avisos` (as outras que não são append-only são
 *  `freshness` e `enderecos_antigos`).
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

  // 🔴 CRIAR NÃO SOBRESCREVE. O toque do formulário sobrescreve, por
  // `regravarRascunho` (um `UPDATE` no rascunho que já existe; o `salvarRascunho`
  // daqui é o upsert de TESTE, de `tests/banco.ts`); `criarRascunho` é a porta
  // de NASCER, e um segundo "lugar novo" com o mesmo nome não pode apagar o que
  // o primeiro já respondeu.
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

  // 🔴 ONDA DE FIX 2 DA 11b (Y2): o endereço do rascunho acompanha o nome e a
  // cidade, e trocar de chave é UMA consulta — nunca "apagar e criar", que
  // deixaria uma janela com nenhum rascunho, nem "criar e apagar", com dois.
  it("moverRascunho troca a chave e o documento juntos: o velho some, o novo existe", async () => {
    await salvarRascunho(c, S, '{"quem":"antes"}', 1);
    expect(await moverRascunho(c, S, "lugar-marcador-dois", '{"quem":"depois"}', 5)).toBe(true);
    expect(await lerRascunho(c, S)).toBeNull();
    expect(await lerRascunho(c, "lugar-marcador-dois")).toEqual({
      slug: "lugar-marcador-dois",
      doc: '{"quem":"depois"}',
      atualizado_em: 5,
    });
  });

  // 🔴 M1 DA REVISÃO DA TAREFA 12: o `atualizado_em` é a IDENTIDADE que a tela
  // de publicar leu, e `agora` é em segundos. Toda gravação a muda — inclusive
  // duas no MESMO segundo, e com o relógio atrás do que está gravado.
  it("regravar e mover no MESMO segundo mudam o atualizado_em, sempre pra frente", async () => {
    await salvarRascunho(c, S, '{"quem":"um"}', 5);
    expect(await regravarRascunho(c, S, '{"quem":"dois"}', 5)).toBe(true);
    expect((await lerRascunho(c, S))?.atualizado_em, "regravar no mesmo segundo").toBe(6);
    expect(await moverRascunho(c, S, "lugar-marcador-dois", '{"quem":"tres"}', 5)).toBe(true);
    expect((await lerRascunho(c, "lugar-marcador-dois"))?.atualizado_em, "mover com o relógio atrás").toBe(7);
    expect(await regravarRascunho(c, "lugar-marcador-dois", '{"quem":"quatro"}', 20)).toBe(true);
    expect((await lerRascunho(c, "lugar-marcador-dois"))?.atualizado_em, "o relógio na frente vence").toBe(20);
  });

  // E recusa o endereço que já é de outro: de um rascunho, ou de um lugar —
  // mesmo ESCONDIDO, pela régua de `criarRascunho`. Recusado, nada muda.
  it("moverRascunho recusa endereço de outro rascunho ou de lugar ESCONDIDO, e nada muda", async () => {
    await salvarRascunho(c, S, '{"quem":"eu"}', 1);
    await salvarRascunho(c, "lugar-marcador-dois", '{"quem":"outro"}', 2);
    await gravarVersao(c, "lugar-marcador-tres", '{"slug":"no-ar"}', "painel", 1);
    await gravarVersao(c, "lugar-marcador-tres", '{"slug":"no-ar"}', "painel", 2, true);
    // e o NASCIDO escondido: a 1ª versão já com `oculto` — sem versão visível
    // nenhuma, é o caso que um filtro `oculto = 0` deixaria passar (G1 da 12).
    await gravarVersao(c, "lugar-marcador-seis", '{"slug":"escondido"}', "painel", 1, true);
    for (const destino of ["lugar-marcador-dois", "lugar-marcador-tres", "lugar-marcador-seis"]) {
      expect(await moverRascunho(c, S, destino, '{"quem":"perdido"}', 9), destino).toBe(false);
    }
    expect((await lerRascunho(c, S))!.doc).toBe('{"quem":"eu"}');
    expect((await lerRascunho(c, "lugar-marcador-dois"))!.doc).toBe('{"quem":"outro"}');
    expect(await lerRascunho(c, "lugar-marcador-tres")).toBeNull();
    expect(await lerRascunho(c, "lugar-marcador-seis")).toBeNull();
    // e sem rascunho na origem não nasce nada no destino
    expect(await moverRascunho(c, "lugar-marcador-quatro", "lugar-marcador-cinco", "{}", 9)).toBe(false);
    expect(await lerRascunho(c, "lugar-marcador-cinco")).toBeNull();
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
