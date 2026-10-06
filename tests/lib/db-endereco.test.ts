import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  avisoVigente,
  contarHoje,
  criarRascunho,
  enderecoNovoDe,
  enderecosAntigosDe,
  ensureSchema,
  gravarEdicao,
  gravarVersao,
  historico,
  insertConfirmacao,
  inserirAviso,
  upsertFreshness,
  versaoAtual,
  trocarEndereco,
} from "@/lib/db";
import { fichaDaVersao } from "@/lib/ficha-fonte";
import { semear } from "@/lib/semente";
import { lugarMarcador } from "../lugar-marcador";
import { base } from "../banco";

/** A TROCA DE ENDEREÇO NO BANCO (Tarefa 11e, decisões do João de 04/10): o
 *  endereço de um lugar publicado é DADO, muda só quando ele manda, e o antigo
 *  passa a levar ao novo.
 *
 *  🔴 CADA CASO LÊ O BANCO DIRETO, tabela por tabela. A troca é UM batch de
 *  vários passos, e cada passo tem de ter um caso que fica vermelho sem ele —
 *  a tabela de mutação do relatório diz qual. Os nomes são marcadores: nenhum
 *  lugar nem cidade real. */

const AGORA = 1_759_000_000;
const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";
const C = "lugar-marcador-terceira-marcadora";

let c: Client;

beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 100);
});
afterEach(() => c.close());

/** O banco inteiro, tabela por tabela, em ordem estável — o que "nada mudou"
 *  compara. As seis tabelas que existem. */
async function retrato(): Promise<Record<string, unknown[]>> {
  const ler = async (sql: string) => (await c.execute(sql)).rows.map((r) => ({ ...r }));
  return {
    ficha_versoes: await ler("SELECT * FROM ficha_versoes ORDER BY id"),
    avisos: await ler("SELECT * FROM avisos ORDER BY id"),
    confirmacoes: await ler("SELECT * FROM confirmacoes ORDER BY id"),
    freshness: await ler("SELECT * FROM freshness ORDER BY ficha_slug"),
    enderecos_antigos: await ler("SELECT * FROM enderecos_antigos ORDER BY velho"),
    ficha_rascunhos: await ler("SELECT * FROM ficha_rascunhos ORDER BY slug"),
  };
}

async function tabelaDeEnderecos(): Promise<string[]> {
  return (await c.execute("SELECT velho, novo FROM enderecos_antigos ORDER BY velho")).rows.map(
    (r) => `${r.velho}→${r.novo}`,
  );
}

describe("trocarEndereco — o lugar inteiro vai pro endereço novo", () => {
  it("todas as versões moram no novo, e o documento de CADA uma diz o novo", async () => {
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 50);

    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(true);

    expect(await historico(c, A), "sobrou versão no endereço velho").toEqual([]);
    const h = await historico(c, B);
    expect(h).toHaveLength(3);
    for (const v of h) {
      // `fichaDaVersao` é a trava do "Ficha divergente": doc que diz A sob B estoura.
      expect(fichaDaVersao(B, v.doc).slug).toBe(B);
    }
  });

  it("o documento reescrito só muda o slug: o resto, byte a byte", async () => {
    const antes = (await versaoAtual(c, A))!.doc;
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    const movida = (await historico(c, B)).at(-1)!.doc;
    expect(movida).toBe(JSON.stringify({ ...JSON.parse(antes), slug: B }));
  });

  it("o aviso vigente aparece em /novo depois da troca", async () => {
    await inserirAviso(c, A, "aviso marcador", "fechado", AGORA - 10, AGORA + 3600, await base(c, A));
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect((await avisoVigente(c, B, AGORA))?.texto).toBe("aviso marcador");
    expect(await avisoVigente(c, A, AGORA)).toBeNull();
  });

  it("o placar de /novo conta os relatos de antes", async () => {
    await insertConfirmacao(c, A, AGORA - 10, "barro");
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect(await contarHoje(c, B, AGORA)).toEqual({ foram: 1, barro: 1 });
    expect(await contarHoje(c, A, AGORA)).toEqual({ foram: 0, barro: 0 });
  });

  // ⚠️ Ninguém LÊ `freshness` hoje (zero linhas em produção, sem cron): a única
  // prova possível é ler a tabela direto. Sem este caso, tirar o passo seria
  // mutação equivalente em toda tela.
  it("freshness vai junto (lido direto da tabela)", async () => {
    await upsertFreshness(c, { slug: A, estado: "fresco", calculadoEm: AGORA, fonte: "f", previsaoBruta: "{}" });
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    const r = await c.execute("SELECT ficha_slug FROM freshness");
    expect(r.rows.map((l) => l.ficha_slug)).toEqual([B]);
  });

  it("freshness órfã no novo não derruba a troca (é cache, e é jogada fora)", async () => {
    await upsertFreshness(c, { slug: B, estado: "frio", calculadoEm: AGORA, fonte: "orfa", previsaoBruta: "{}" });
    await upsertFreshness(c, { slug: A, estado: "fresco", calculadoEm: AGORA, fonte: "do-lugar", previsaoBruta: "{}" });
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(true);
    const r = await c.execute("SELECT ficha_slug, fonte FROM freshness");
    expect(r.rows.map((l) => `${l.ficha_slug}:${l.fonte}`)).toEqual([`${B}:do-lugar`]);
  });

  it("o endereço velho passa a levar ao novo", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect(await enderecoNovoDe(c, A)).toBe(B);
    expect(await enderecosAntigosDe(c, B)).toEqual([A]);
  });
});

describe("a versão do ATO", () => {
  it("grava uma versão nova, de autor painel, com o endereço anterior", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    const h = await historico(c, B);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ autor: "painel", criado_em: AGORA, endereco_anterior: A });
    expect(h[1].endereco_anterior, "só a versão do ato carrega o endereço anterior").toBeUndefined();
    expect(h[0].doc).toBe(h[1].doc);
  });

  it("lugar escondido troca de endereço e continua escondido", async () => {
    const doc = (await versaoAtual(c, A))!.doc;
    await gravarVersao(c, A, doc, "painel", AGORA - 5, true);
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect((await versaoAtual(c, B))!.oculto).toBe(true);
  });

  it("lugar no ar troca de endereço e continua no ar", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect((await versaoAtual(c, B))!.oculto).toBe(false);
  });

  it("retomar o endereço velho não apaga, do histórico, de onde o lugar veio", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    // Um lugar NOVO nasce em A (E5) — aqui direto no banco, como a Tarefa 12 fará.
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA + 10);
    await c.execute({ sql: "DELETE FROM enderecos_antigos WHERE velho = ?", args: [A] });
    expect((await historico(c, B))[0].endereco_anterior).toBe(A);
  });
});

describe("sem cadeia: o endereço velho sempre leva ao ATUAL", () => {
  it("A→B→C: /A leva a C", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    await trocarEndereco(c, B, C, AGORA + 1, await base(c, B));
    expect(await enderecoNovoDe(c, A)).toBe(C);
    expect(await enderecoNovoDe(c, B)).toBe(C);
  });

  it("A→B→A→C: tabela final [A→C, B→C]", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    await trocarEndereco(c, B, A, AGORA + 1, await base(c, B));
    expect(await tabelaDeEnderecos(), "voltar ao endereço velho não deixa A→A").toEqual([`${B}→${A}`]);
    expect(await trocarEndereco(c, A, C, AGORA + 2, await base(c, A))).toBe(true);
    expect(await tabelaDeEnderecos()).toEqual([`${A}→${C}`, `${B}→${C}`]);
  });
});

describe("recusa: nada muda em NENHUMA das tabelas", () => {
  beforeEach(async () => {
    await inserirAviso(c, A, "aviso marcador", "fechado", AGORA - 10, AGORA + 3600, await base(c, A));
    await insertConfirmacao(c, A, AGORA - 10, "seco");
    await upsertFreshness(c, { slug: A, estado: "fresco", calculadoEm: AGORA, fonte: "f", previsaoBruta: "{}" });
  });

  it("novo ocupado por lugar escondido: 409, nada mudou em NENHUMA das 5 tabelas", async () => {
    await gravarVersao(c, B, JSON.stringify(lugarMarcador(B, "Outro Marcador", "Outra Marcadora")), "painel", AGORA - 3, true);
    const antes = await retrato();
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(false);
    expect(await retrato()).toEqual(antes);
  });

  it("novo ocupado por um rascunho: nada muda", async () => {
    expect(await criarRascunho(c, B, JSON.stringify({ slug: B }), AGORA - 3)).toBe(true);
    const antes = await retrato();
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(false);
    expect(await retrato()).toEqual(antes);
  });

  // 🔴 I3 DA REVISÃO: a recusa COM endereço antigo envolvido. Os casos de cima
  // não têm linha nenhuma em `enderecos_antigos`, e por isso tirar a porta dos
  // dois passos que mexem NELA sobrevivia à suíte inteira.
  it("o lugar que recusa já veio de outro endereço (D→A): a linha D→A continua levando a ELE", async () => {
    const D = "lugar-marcador-quarta-marcadora";
    expect(await trocarEndereco(c, A, D, AGORA - 30, await base(c, A))).toBe(true);
    expect(await trocarEndereco(c, D, A, AGORA - 20, await base(c, D))).toBe(true);
    expect(await tabelaDeEnderecos(), "a premissa: o lugar mora em A e D leva a ele").toEqual([`${D}→${A}`]);
    await gravarVersao(c, B, JSON.stringify(lugarMarcador(B, "Outro Marcador", "Outra Marcadora")), "painel", AGORA - 3);
    const antes = await retrato();
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(false);
    // Sem a porta no "repontar", D passaria a levar a B — a OUTRO lugar.
    expect(await retrato()).toEqual(antes);
  });

  it("o novo é endereço antigo de outro lugar, com rascunho nele (B→E): a linha B→E não morre", async () => {
    const E = "lugar-marcador-quinta-marcadora";
    await gravarVersao(c, B, JSON.stringify(lugarMarcador(B, "Outro Marcador", "Outra Marcadora")), "painel", AGORA - 30);
    expect(await trocarEndereco(c, B, E, AGORA - 20, await base(c, B))).toBe(true);
    expect(await criarRascunho(c, B, JSON.stringify({ slug: B }), AGORA - 10)).toBe(true);
    expect(await tabelaDeEnderecos(), "a premissa: B leva ao outro lugar").toEqual([`${B}→${E}`]);
    const antes = await retrato();
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(false);
    // Sem a porta no "apagar a linha retomada", B→E sumiria: link velho de outro lugar, 404.
    expect(await retrato()).toEqual(antes);
  });

  it("velho que não é lugar nenhum: nada muda", async () => {
    const antes = await retrato();
    expect(await trocarEndereco(c, "lugar-que-nao-existe-marcador", B, AGORA, await base(c, "lugar-que-nao-existe-marcador"))).toBe(false);
    expect(await retrato()).toEqual(antes);
  });
});

describe("duas trocas no MESMO segundo (M1 da revisão)", () => {
  it("a segunda devolve false e não grava um segundo ato", async () => {
    // Com a freshness do lugar: ela é a tabela que a 2ª, de porta aberta, mexeria
    // (o passo que joga fora a "órfã" do novo apagaria a do PRÓPRIO lugar).
    await upsertFreshness(c, { slug: A, estado: "fresco", calculadoEm: AGORA, fonte: "f", previsaoBruta: "{}" });
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(true);
    const antes = await retrato();
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(false);
    expect(await retrato(), "a segunda troca mexeu no banco").toEqual(antes);
    expect((await historico(c, B)).filter((v) => v.endereco_anterior === A)).toHaveLength(1);
  });
});

describe("gravarEdicao: só grava onde o lugar mora (I1 da revisão)", () => {
  it("no endereço que o lugar deixou: null, nada gravado, A não ressuscita", async () => {
    const lida = (await versaoAtual(c, A))!;
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    const antes = await retrato();
    expect(await gravarEdicao(c, A, lida.doc, AGORA + 1, true, lida.id)).toBeNull();
    expect(await retrato()).toEqual(antes);
  });

  it("controle: onde o lugar mora, grava com o oculto pedido e devolve o id", async () => {
    const lida = (await versaoAtual(c, A))!;
    const id = await gravarEdicao(c, A, lida.doc, AGORA + 1, true, lida.id);
    expect(id).toBeTypeOf("number");
    expect(await versaoAtual(c, A)).toMatchObject({ id, autor: "painel", oculto: true, criado_em: AGORA + 1 });
  });
});

describe("a identidade é a VERSÃO que a tela abriu, não o endereço (onda de fix 2, M6)", () => {
  // P sai de A pra B; Q (em C) retoma A. A versão que a aba velha de P abriu
  // mora em B agora — e A TEM versão, a de Q, que é o que a onda 1 conferia.
  let deP: number;
  beforeEach(async () => {
    deP = await base(c, A);
    expect(await trocarEndereco(c, A, B, AGORA, deP)).toBe(true);
    await gravarVersao(c, C, JSON.stringify(lugarMarcador(C, "Lugar Q Marcador", "Cidade Q Marcadora")), "painel", AGORA + 1);
    expect(await trocarEndereco(c, C, A, AGORA + 2, await base(c, C))).toBe(true);
  });

  it("gravarEdicao com a versão de P, em A: null, e Q intacto", async () => {
    const antes = await retrato();
    expect(await gravarEdicao(c, A, (await versaoAtual(c, A))!.doc, AGORA + 3, true, deP)).toBeNull();
    expect(await retrato()).toEqual(antes);
  });

  it("inserirAviso com a versão de P, em A: null, e nenhum aviso em Q", async () => {
    const antes = await retrato();
    expect(await inserirAviso(c, A, "aviso marcador de P", "fechado", AGORA + 3, AGORA + 3600, deP)).toBeNull();
    expect(await retrato()).toEqual(antes);
  });

  it("trocarEndereco com a versão de P, saindo de A: false, e Q continua em A", async () => {
    const antes = await retrato();
    expect(await trocarEndereco(c, A, "lugar-marcador-destino-da-aba-velha", AGORA + 3, deP)).toBe(false);
    expect(await retrato()).toEqual(antes);
  });

  it("controle: com a versão de Q, em A, as três gravam", async () => {
    const deQ = await base(c, A);
    expect(await gravarEdicao(c, A, (await versaoAtual(c, A))!.doc, AGORA + 3, false, deQ)).toBeTypeOf("number");
    expect(await inserirAviso(c, A, "aviso marcador de Q", "fechado", AGORA + 3, AGORA + 3600, deQ)).toBeTypeOf("number");
    expect(await trocarEndereco(c, A, "lugar-marcador-destino-de-q", AGORA + 4, deQ)).toBe(true);
  });

  it("controle: com a versão de P, em B (onde P mora), as três gravam — mesmo não sendo a atual de P", async () => {
    expect(deP).not.toBe(await base(c, B));
    expect(await gravarEdicao(c, B, (await versaoAtual(c, B))!.doc, AGORA + 3, false, deP)).toBeTypeOf("number");
    expect(await inserirAviso(c, B, "aviso marcador de P", "fechado", AGORA + 3, AGORA + 3600, deP)).toBeTypeOf("number");
    expect(await trocarEndereco(c, B, "lugar-marcador-destino-de-p", AGORA + 4, deP)).toBe(true);
  });
});

describe("o endereço velho é RETOMÁVEL (E5)", () => {
  it("um rascunho pode nascer no endereço velho, e enquanto é rascunho o velho continua levando ao novo", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    expect(await criarRascunho(c, A, JSON.stringify({ slug: A }), AGORA + 1)).toBe(true);
    expect(await enderecoNovoDe(c, A)).toBe(B);
  });

  it("trocar PARA o endereço velho de outro lugar o retoma: a linha some, e o órfão de lá não vem junto", async () => {
    // A foi pra B. Depois, um aviso e um relato ÓRFÃOS ficaram em A. O relato
    // ainda chega assim (o "✓ Fui" público resolve o endereço e grava depois);
    // o aviso, desde a onda de fix (I1), `inserirAviso` recusa — então ele entra
    // pela tabela, como dado de antes do conserto.
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    await c.execute({
      sql: `INSERT INTO avisos (ficha_slug, texto, efeito, criado_em, vence_em) VALUES (?, ?, 'fechado', ?, ?)`,
      args: [A, "aviso órfão marcador", AGORA + 1, AGORA + 3600],
    });
    await insertConfirmacao(c, A, AGORA + 1, "barro");
    // Um OUTRO lugar, em C, pega o endereço A.
    await gravarVersao(c, C, JSON.stringify(lugarMarcador(C, "Terceiro Marcador", "Terceira Marcadora")), "painel", AGORA + 2);
    expect(await trocarEndereco(c, C, A, AGORA + 3, await base(c, C))).toBe(true);

    expect(await tabelaDeEnderecos()).toEqual([`${C}→${A}`]);
    expect(await avisoVigente(c, A, AGORA + 4), "o lugar que retomou A herdou o aviso do outro").toBeNull();
    expect((await avisoVigente(c, B, AGORA + 4))?.texto, "o órfão voltou ao lugar dele").toBe("aviso órfão marcador");
    expect(await contarHoje(c, A, AGORA + 4)).toEqual({ foram: 0, barro: 0 });
    expect(await contarHoje(c, B, AGORA + 4)).toEqual({ foram: 1, barro: 1 });
  });
});

describe("documento ilegível (M4)", () => {
  it("uma versão que não abre não tranca a troca, e muda de endereço igual", async () => {
    await gravarVersao(c, A, "{ isto não é json", "painel", AGORA - 60);
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Bom Marcador")), "painel", AGORA - 40);
    expect(await trocarEndereco(c, A, B, AGORA, await base(c, A))).toBe(true);
    const docs = (await historico(c, B)).map((v) => v.doc);
    expect(docs).toContain("{ isto não é json");
    expect(await historico(c, A)).toEqual([]);
  });
});

describe("a semente não recria o lugar no endereço velho (E6)", () => {
  it("semear de novo pula todo endereço velho", async () => {
    await trocarEndereco(c, A, B, AGORA, await base(c, A));
    const r = await semear(c, [lugarMarcador(A, "Lugar Marcador", "Bom Marcador")], AGORA + 1);
    expect(r).toEqual({ semeados: [], pulados: [A] });
    expect(await historico(c, A)).toEqual([]);
  });
});
