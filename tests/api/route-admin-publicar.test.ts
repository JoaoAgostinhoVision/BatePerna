import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import {
  avisoVigente,
  contarHoje,
  criarRascunho,
  enderecoNovoDe,
  enderecosAntigosDe,
  ensureSchema,
  getFreshness,
  gravarVersao,
  historico,
  insertConfirmacao,
  inserirAviso,
  lerRascunho,
  moverRascunho,
  publicarRascunho,
  trocarEndereco,
  upsertFreshness,
  versaoAtual,
} from "@/lib/db";
import { novaChaveDeRascunho } from "@/lib/db-contribuidor";
import {
  ENDERECO_AINDA_NAO_SAIU,
  FALTA_OBRIGATORIO,
  FORMA_ERRADA,
  JA_PUBLICADO_OU_OCUPADO,
  RASCUNHO_ILEGIVEL,
  RASCUNHO_MUDOU,
  RASCUNHO_SUMIU,
  SLUG_DE_DENTRO,
  prepararPublicacao,
} from "@/lib/porta-de-publicar";
import { RASCUNHO_NAO_EXISTE_MAIS, enderecoDeLugar, gemeoSemCidade, nomeComCidade, parDeLugar, slugDoNome } from "@/lib/rascunho";
import { type Ficha, fichaSchema } from "@/types/ficha";
import { base, clienteQueIntercala, salvarRascunho, semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";
import { nominatimDeTeste } from "../nominatim";
import { rascunhoCompleto } from "../rascunho-completo";

/** A PORTA DE PUBLICAR (Tarefa 12): `POST /api/admin/publicar {slug, atualizadoEm}`.
 *
 *  Molde: `route-admin-rascunho.test.ts` — `Request` à mão, `vi.stubEnv`,
 *  `criarSessao` de verdade, acervo do BANCO por `semearAcervo`. NÃO passa por
 *  `comBaseAtual` (12-helper): ele injetaria `baseId` em todo corpo com `slug`.
 *
 *  🔴 ASSERÇÃO DUPLA EM TODA RECUSA: o código E o banco — nada em `ficha_versoes`
 *  e o rascunho continua lá.
 *
 *  🔴 A FIXTURE NUNCA DEIXA O LUGAR PUBLICADO SER O ÚNICO DONO DE UMA TABELA
 *  NEM A VERSÃO MAIS NOVA DO BANCO (I3 e I11 da auditoria de 06/10): antes de
 *  todo caso, a Rampa é ESCONDIDA por uma versão gravada depois da semente (a
 *  mais nova do banco passa a ser `oculto = 1` — o `oculto` herdado de outro
 *  lugar acenderia), e OUTRO lugar ganha aviso, relato, `freshness`, uma linha
 *  em `enderecos_antigos` e um rascunho com o MESMO `atualizado_em` do nosso —
 *  todo `WHERE … = S` sem o filtro apaga ou move o que é dos outros, e
 *  `outros()` acusa.
 *
 *  Nenhum lugar real é inventado: nomes e cidades novos são MARCADORES; os
 *  lugares do acervo entram só como "o outro", lidos do banco. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-publicar";
const AGORA = 1_758_400_000;
const ATUALIZADO = AGORA - 100;
const NOME = "Lugar Marcador Publicar";
const CIDADE = "Cidade Marcador Publicar";
/** O endereço de `NOME` em `CIDADE`. */
const S = "lugar-marcador-publicar-cidade-marcador-publicar";
/** O OUTRO lugar, dono de linhas em toda tabela que o batch toca. */
const OUTRO = "pedra-furada-de-venturosa";
const OUTRO_RASCUNHO = "lugar-marcador-outro-cidade-marcador-dois";
const VELHO_DO_OUTRO = "lugar-marcador-endereco-velho-do-outro";

let c: Client;
/** Pra onde o `getClient` da rota aponta — o banco, ou o dublê que intercala. */
let daRota: Client;
let cookieBom: string;
let rota: typeof import("@/app/api/admin/publicar/route");
let rotaRascunho: typeof import("@/app/api/admin/rascunho/route");
let fichas: typeof import("@/lib/ficha");

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => daRota };
});
// 🔴 A suíte nunca bate no Nominatim (spec §7): o PUT do ponto 0 do rascunho
// pergunta a cidade ao dublê.
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  daRota = c;
  nominatimDeTeste.ponto = { cidade: CIDADE };
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  await ensureSchema(c);
  await semearAcervo(c);
  // I3: a versão mais nova do banco é a de um lugar ESCONDIDO.
  await esconder("rampa-do-pepe", AGORA - 500);
  // I11: o OUTRO é dono de uma linha em cada tabela que o batch toca.
  expect(await inserirAviso(c, OUTRO, "aviso marcador do outro", "nenhum", AGORA - 400, AGORA + 86_400, await base(c, OUTRO))).not.toBeNull();
  await insertConfirmacao(c, OUTRO, AGORA - 400, "seco");
  await upsertFreshness(c, { slug: OUTRO, estado: "fresco", calculadoEm: AGORA - 400, fonte: "marcador", previsaoBruta: "{}" });
  await c.execute({ sql: `INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, ?, ?)`, args: [VELHO_DO_OUTRO, OUTRO, AGORA - 400] });
  expect(
    await criarRascunho(c, OUTRO_RASCUNHO, JSON.stringify({ slug: OUTRO_RASCUNHO, modos: [], cidade: "Cidade Marcador Dois", trajeto: { waypoints: [{ nome: "Lugar Marcador Outro" }] } }), ATUALIZADO),
  ).toBe(true);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  rota = await import("@/app/api/admin/publicar/route");
  rotaRascunho = await import("@/app/api/admin/rascunho/route");
  fichas = await import("@/lib/ficha");
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function esconder(slug: string, quando: number): Promise<void> {
  const atual = (await versaoAtual(c, slug))!;
  await gravarVersao(c, slug, atual.doc, "painel", quando, true);
}

// ⚠️ `null` = SEM cookie (a lição de `route-admin-rascunho.test.ts`: com
// parâmetro padrão, `undefined` viraria o cookie bom em silêncio).
function publicar(corpo: unknown, cookie: string | null = cookieBom): Promise<Response> {
  return rota.POST(
    new Request("http://x/api/admin/publicar", {
      method: "POST",
      headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
      body: JSON.stringify(corpo),
    }),
  );
}
const publicarS = (cookie: string | null = cookieBom) => publicar({ slug: S, atualizadoEm: ATUALIZADO }, cookie);

const completo = () => rascunhoCompleto(S, NOME, CIDADE);
const guardar = (doc: Record<string, unknown> | string, slug = S, quando = ATUALIZADO) =>
  salvarRascunho(c, slug, typeof doc === "string" ? doc : JSON.stringify(doc), quando);

/** As linhas que são dos OUTROS, em cada tabela que o batch toca. */
async function outros(): Promise<unknown> {
  const tabela = async (sql: string) => (await c.execute(sql)).rows.map((r) => ({ ...r }));
  return {
    avisos: await tabela(`SELECT * FROM avisos WHERE ficha_slug <> '${S}' ORDER BY id`),
    confirmacoes: await tabela(`SELECT * FROM confirmacoes WHERE ficha_slug <> '${S}' ORDER BY id`),
    freshness: await tabela(`SELECT * FROM freshness WHERE ficha_slug <> '${S}' ORDER BY ficha_slug`),
    enderecos: await tabela(`SELECT * FROM enderecos_antigos WHERE velho <> '${S}' ORDER BY velho`),
    rascunhos: await tabela(`SELECT * FROM ficha_rascunhos WHERE slug <> '${S}' ORDER BY slug`),
    versoes: await tabela(`SELECT * FROM ficha_versoes WHERE ficha_slug <> '${S}' ORDER BY id`),
  };
}

/** Só as linhas do OUTRO lugar (o endereço antigo DELE e o rascunho de OUTRO
 *  endereço inclusos) — pra quando as de `S` mudam de dono de propósito. */
async function doOutro(): Promise<unknown> {
  const tabela = async (sql: string, args: string[]) => (await c.execute({ sql, args })).rows.map((r) => ({ ...r }));
  return {
    avisos: await tabela(`SELECT * FROM avisos WHERE ficha_slug = ? ORDER BY id`, [OUTRO]),
    confirmacoes: await tabela(`SELECT * FROM confirmacoes WHERE ficha_slug = ? ORDER BY id`, [OUTRO]),
    freshness: await tabela(`SELECT * FROM freshness WHERE ficha_slug = ?`, [OUTRO]),
    enderecos: await tabela(`SELECT * FROM enderecos_antigos WHERE velho = ?`, [VELHO_DO_OUTRO]),
    rascunhos: await tabela(`SELECT * FROM ficha_rascunhos WHERE slug = ?`, [OUTRO_RASCUNHO]),
  };
}

/** Nada entrou em `S`, e o rascunho continua lá, com o `atualizado_em` dele. */
async function nadaMudou(quando = ATUALIZADO): Promise<void> {
  expect(await historico(c, S), "entrou versão em S").toEqual([]);
  expect((await lerRascunho(c, S))?.atualizado_em, "o rascunho não sobreviveu à recusa").toBe(quando);
}

// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/admin/publicar — as guardas", () => {
  it("sem cookie: 401, e nada gravado nem apagado", async () => {
    await guardar(completo());
    expect((await publicarS(null)).status).toBe(401);
    await nadaMudou();
  });

  it("painel desligado: 404, e nada gravado", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    await guardar(completo());
    expect((await publicarS()).status).toBe(404);
    await nadaMudou();
  });

  it("corpo torto (sem atualizadoEm, chave a mais, Infinity): 400, nada gravado", async () => {
    await guardar(completo());
    for (const corpo of [{ slug: S }, { slug: S, atualizadoEm: ATUALIZADO, x: 1 }, { slug: S, atualizadoEm: 1.5 }, null]) {
      expect((await publicar(corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    const infinito = await rota.POST(
      new Request("http://x/api/admin/publicar", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: `{"slug":"${S}","atualizadoEm":1e999}`,
      }),
    );
    expect(infinito.status).toBe(400);
    await nadaMudou();
  });

  // 🔴 Cada uma destas tem o RASCUNHO GUARDADO em `S` com outro `atualizado_em`:
  // sem a conferência do corpo, a rota seguia e respondia 409 (o rascunho que a
  // tela leu não é este), nunca 400. O 400 é a prova de que foi o corpo.
  it("corpo torto (atualizadoEm negativo, slug que não é texto): 400, nada gravado", async () => {
    await guardar(completo());
    for (const corpo of [{ slug: S, atualizadoEm: -1 }, { slug: 5, atualizadoEm: ATUALIZADO }]) {
      expect((await publicar(corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    await nadaMudou();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/admin/publicar — o documento", () => {
  // 🔴 O rascunho guardado não abre como JSON: a frase é a do documento
  // ilegível — nunca a de "falta pergunta", que mandaria o dono responder de
  // novo o que já respondeu.
  it("rascunho que não abre como JSON: 400 com a frase do ilegível, nada gravado", async () => {
    await guardar("{{");
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(RASCUNHO_ILEGIVEL);
    await nadaMudou();
  });

  // 🔴 O MOLDE `[]` (12-I1): a lista de pontos existe e não está vazia, mas o
  // ponto 0 não tem `lat`. Sem a conferência por ponto, o schema recusaria
  // igual — com a frase de FORMA errada, que manda o dono "responder de novo a
  // que estiver estranha" quando o que falta é uma resposta.
  it("rascunho com o ponto do trajeto sem lat: 400 com a frase do obrigatório, não a da forma", async () => {
    const doc = completo();
    const ponto = (doc.trajeto as { waypoints: Record<string, unknown>[] }).waypoints[0];
    delete ponto.lat;
    expect(ponto.lng, "a premissa: só a lat saiu").toBeDefined();
    await guardar(doc);
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_OBRIGATORIO);
    await nadaMudou();
  });

  it("rascunho sem os obrigatórios: 400, e NADA entra em ficha_versoes", async () => {
    await guardar({ slug: S });
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_OBRIGATORIO);
    await nadaMudou();
  });

  // 🔴 12-I1 / M10. A prova é pela `cidade`, e por isso: ela é o ÚNICO
  // obrigatório do registro que o `fichaSchema` aceita ausente
  // (`OBRIGATORIO_SO_NO_REGISTRO`). Em todo outro, o schema recusaria igual —
  // duas portas em série —, e arrancar a conferência do registro sobreviveria.
  it("rascunho completo SEM cidade: 400 com a frase, nada gravado, o rascunho continua lá", async () => {
    const doc = completo();
    delete doc.cidade;
    expect(fichaSchema.safeParse(doc).success, "a premissa: o schema aceita sem cidade").toBe(true);
    await guardar(doc);
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_OBRIGATORIO);
    await nadaMudou();
  });

  // 🔴 M1 (I2 da auditoria): todo obrigatório presente, e o TIPO errado — só o
  // `fichaSchema.parse` da normalização recusa.
  it("rascunho com todos os obrigatórios e um TIPO errado: 400, nada gravado", async () => {
    for (const torto of [
      { ...completo(), custo: { tag: "caro" } },
      { ...completo(), condicao: { ...(completo().condicao as object), regra: { tipo: "chuva_binaria", janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: "muito" } } },
    ]) {
      await guardar(torto);
      const res = await publicarS();
      expect(res.status).toBe(400);
      expect(await res.text()).toBe(FORMA_ERRADA);
      await nadaMudou();
    }
  });

  // 🔴 FAIXAS-PULADA (M3 da auditoria): o schema aceita faixas sobrepostas; só a
  // regra de escrita (`problemaDasFaixas`) recusa.
  it("horário com faixas sobrepostas: 400 com a frase da regra, nada gravado", async () => {
    const doc = { ...completo(), horario: [{ abre: "08:00", fecha: "12:00" }, { abre: "10:00", fecha: "17:00" }] };
    expect(fichaSchema.safeParse(doc).success, "a premissa: o schema aceita a sobreposição").toBe(true);
    await guardar(doc);
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/horário|faixa/);
    await nadaMudou();
  });

  // 🔴 GRAVA-CRU (12-I3): o que vai ao ar é o documento NORMALIZADO.
  it("horário em OBJETO no rascunho (a forma velha): vai ao ar como LISTA", async () => {
    await guardar({ ...completo(), horario: { abre: "08:00", fecha: "17:00" } });
    expect((await publicarS()).status).toBe(200);
    const gravado = JSON.parse((await versaoAtual(c, S))!.doc) as { horario: unknown };
    expect(gravado.horario).toEqual([{ abre: "08:00", fecha: "17:00" }]);
  });

  // 🔴 SLUG-DE-DENTRO (I12): um documento assim no ar derrubaria a home inteira.
  it("o slug de dentro diferente do endereço: 400, nada gravado, e a home continua de pé", async () => {
    await guardar({ ...completo(), slug: "lugar-marcador-outro-endereco" });
    const res = await publicarS();
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(SLUG_DE_DENTRO);
    await nadaMudou();
    expect((await fichas.getAllFichas()).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/admin/publicar — o par e a coerência", () => {
  // 🔴 Review Focus 2, na porta de criar.
  it("rascunho completo que MENTE sobre o lugar: 409, nada gravado, frase de volta", async () => {
    await guardar({ ...completo(), custo: { tag: "pago", valor: "R$ 10 marcador, por pessoa", curto: "R$ 1" } });
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect(await res.text()).toMatch(/R\$/);
    await nadaMudou();
  });

  // 🔴 12-I2a: a coerência é por DIFERENÇA. Uma violação ANTIGA de outro lugar
  // (gravada crua, depois da semente) não trava publicação nenhuma.
  it("uma violação antiga de OUTRO lugar não trava a publicação", async () => {
    const doOutro = JSON.parse((await versaoAtual(c, OUTRO))!.doc) as Ficha;
    await gravarVersao(c, OUTRO, JSON.stringify({ ...doOutro, custo: { tag: "pago", valor: "R$ 10 marcador", curto: "R$ 1" } }), "painel", AGORA - 300);
    await guardar(completo());
    const res = await publicarS();
    expect(res.status, await res.clone().text()).toBe(200);
  });

  // 🔴 12-I2b: o acervo da coerência inclui os ESCONDIDOS.
  it("a voz de um lugar ESCONDIDO copiada no rascunho: 409, nada gravado", async () => {
    const veu = "veu-de-noiva-de-bonito";
    const vozDoVeu = (JSON.parse((await versaoAtual(c, veu))!.doc) as Ficha).voz;
    await esconder(veu, AGORA - 300);
    await guardar({ ...completo(), voz: vozDoVeu });
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect((await res.text()).length).toBeGreaterThan(0);
    await nadaMudou();
  });

  // 🔴 12-M1a: o mesmo nome na mesma cidade de outro lugar, gravado CRU depois da
  // semente (sem passar pela porta que o recusaria) — a publicação recusa.
  it("mesmo nome na mesma cidade de um lugar que já existe: 409 com a frase do par, nada gravado", async () => {
    const gemeo = "lugar-marcador-gemeo";
    await gravarVersao(c, gemeo, JSON.stringify(lugarMarcador(gemeo, NOME, CIDADE)), "painel", AGORA - 300);
    await guardar(completo());
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(nomeComCidade(NOME, CIDADE)));
    await nadaMudou();
  });

  // 🔴 M3 da revisão da Tarefa 12: o `nomeNovo: true` do par. Um lugar SEM
  // cidade (as fichas de antes da 11b) com o MESMO nome, gravado cru depois da
  // semente — chega assim quando um deles é renomeado pro nome do rascunho, o que
  // o par do rename deixa passar (o rascunho tem cidade). Com `nomeNovo: false`,
  // o gêmeo sem cidade não conta e o rascunho publicava.
  it("um lugar SEM cidade com o mesmo nome: 409 pedindo a cidade dele, nada gravado", async () => {
    const gemeo = "lugar-marcador-gemeo-sem-cidade";
    await gravarVersao(c, gemeo, JSON.stringify(lugarMarcador(gemeo, NOME)), "painel", AGORA - 300);
    expect(JSON.parse((await versaoAtual(c, gemeo))!.doc).cidade, "a premissa: o gêmeo não tem cidade").toBeUndefined();
    await guardar(completo());
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade(NOME));
    await nadaMudou();
  });

  it("mesmo nome em OUTRA cidade publica (decisão do João de 04/10)", async () => {
    const outraCidade = "lugar-marcador-gemeo";
    await gravarVersao(c, outraCidade, JSON.stringify(lugarMarcador(outraCidade, NOME, "Cidade Marcador Outra")), "painel", AGORA - 300);
    await guardar(completo());
    expect((await publicarS()).status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/admin/publicar — publicar de verdade", () => {
  it("publicar de verdade: 200, vira versão 1 autorada 'painel', no ar, e o rascunho some", async () => {
    await guardar(completo());
    const antes = await outros();
    const res = await publicarS();
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: S });
    const h = await historico(c, S);
    expect(h).toHaveLength(1);
    expect(h[0].autor).toBe("painel");
    expect(h[0].criado_em).toBe(AGORA);
    // I3 / M7: a versão mais nova do banco antes desta era a da Rampa ESCONDIDA.
    expect(h[0].oculto).toBe(false);
    expect(JSON.parse(h[0].doc)).toEqual(fichaSchema.parse(completo()));
    expect(await lerRascunho(c, S)).toBeNull();
    const noAr = (await fichas.getAllFichas()).map((f) => f.slug);
    expect(noAr).toContain(S);
    expect(noAr, "a premissa: a Rampa está escondida").not.toContain("rampa-do-pepe");
    // I11: nada que é dos OUTROS mudou — aviso, relato, freshness, endereço
    // antigo, o outro rascunho (com o MESMO atualizado_em) e as versões.
    expect(await outros()).toEqual(antes);
  });

  // 🔴 M4 da auditoria: o 2º toque acha o endereço ocupado e nenhum rascunho.
  it("o segundo toque não grava nada, e a frase não diz que falhou o que já está no ar", async () => {
    await guardar(completo());
    expect((await publicarS()).status).toBe(200);
    const segundo = await publicarS();
    expect(segundo.status).toBe(409);
    expect(await segundo.text()).toBe(JA_PUBLICADO_OU_OCUPADO);
    expect(await historico(c, S)).toHaveLength(1);
  });

  // 🔴 M2 da revisão da Tarefa 12: a cláusula do RASCUNHO na `porta`. No duplo
  // toque CONCORRENTE no mesmo segundo, o 1º batch inteiro roda entre a leitura
  // do 2º e o batch dele, com o MESMO documento — a versão do 1º é igual, byte a
  // byte, à que o 2º gravaria, e só o rascunho (que o 1º apagou) segura a porta.
  // Sem a cláusula, o 2º refazia os passos 2 a 6 e apagava a `freshness` que o
  // lugar ganhou no meio.
  it("duplo toque CONCORRENTE no mesmo segundo: o 2º não grava nem apaga nada", async () => {
    await guardar(completo());
    const preparo = prepararPublicacao(JSON.stringify(completo()), S);
    if (!("doc" in preparo)) throw new Error("a premissa: o rascunho completo se prepara");
    const g = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {
      expect(await publicarRascunho(c, S, preparo.doc, AGORA, ATUALIZADO), "o 1º toque").toBe(true);
      await upsertFreshness(c, { slug: S, estado: "fresco", calculadoEm: AGORA, fonte: "marcador", previsaoBruta: "{}" });
    });
    daRota = g.cliente;
    const antes = await outros();
    const res = await publicarS();
    expect(g.disparos(), "o dublê nunca disparou: nada foi intercalado").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_PUBLICADO_OU_OCUPADO);
    const h = await historico(c, S);
    expect(h).toHaveLength(1);
    expect(h[0].doc, "a premissa: o 1º gravou o MESMO documento que o 2º gravaria").toBe(preparo.doc);
    expect((await getFreshness(c, S))?.estado, "a freshness que o lugar ganhou no meio sumiu").toBe("fresco");
    expect(await outros()).toEqual(antes);
  });

  it("controle: o dublê de batch dispara UMA vez e, sem intercalar nada, publica", async () => {
    await guardar(completo());
    const g = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {});
    daRota = g.cliente;
    expect((await publicarS()).status).toBe(200);
    expect(g.disparos()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 A COLISÃO DE ENDEREÇO TEM UMA PORTA SÓ: o `NOT EXISTS` do 1º passo do batch,
// sem filtro de `oculto` (G1, I4).
// 🔴 17/10: a porta da CHAVE (o rascunho do painel só publica do `nome-cidade`
// dele) vem antes do batch, então o rascunho destes casos mora em `S` — o
// `nome-cidade` de `NOME` em `CIDADE` — e quem ocupa `S` é um lugar de OUTRO
// par (gravado cru, sem a porta que o recusaria). Até 17/10 o rascunho
// morava no endereço do lugar do acervo, e a porta da chave o recusaria antes
// de o batch ser medido.
describe("POST /api/admin/publicar — o endereço já ocupado", () => {
  const OCUPANTE = "Lugar Marcador Ocupante";
  const DO_OCUPANTE = "Cidade Marcador Ocupante";

  it("endereço que já é de um lugar: 409 com a frase de quem ocupa, e o lugar antigo fica intacto", async () => {
    await gravarVersao(c, S, JSON.stringify(lugarMarcador(S, OCUPANTE, DO_OCUPANTE)), "painel", AGORA - 300);
    const antes = await historico(c, S);
    await guardar(completo());
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeLugar(nomeComCidade(OCUPANTE, DO_OCUPANTE)));
    expect(await historico(c, S)).toEqual(antes);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });

  // 🔴 G1 — o mais grave: a leitura PÚBLICA não vê o escondido. (O lugar tem
  // versões VISÍVEIS mais antigas, como a Rampa que a fixture esconde.)
  it("endereço de um lugar ESCONDIDO: 409, o histórico dele intacto, e ele continua escondido", async () => {
    await gravarVersao(c, S, JSON.stringify(lugarMarcador(S, OCUPANTE, DO_OCUPANTE)), "painel", AGORA - 300);
    await esconder(S, AGORA - 200);
    const antes = await historico(c, S);
    expect(antes.map((v) => v.oculto), "a premissa: escondido, com uma versão visível antes").toEqual([true, false]);
    await guardar(completo());
    expect((await publicarS()).status).toBe(409);
    expect(await historico(c, S)).toEqual(antes);
    expect((await versaoAtual(c, S))!.oculto).toBe(true);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });

  // 🔴 M6, medido: `AND oculto <> 1` dentro do `NOT EXISTS` SOBREVIVIA ao caso de
  // cima — a Rampa escondida tem versões VISÍVEIS mais antigas, e "existe versão
  // visível" continua verdade. O escondido que só esta régua pega é o lugar cuja
  // ÚNICA versão é oculta: nenhuma porta de hoje o produz (gravado cru aqui), e a
  // porta do banco não pode depender disso.
  it("endereço de um lugar cuja única versão é ESCONDIDA: 409, nada muda nele", async () => {
    await gravarVersao(c, S, JSON.stringify(lugarMarcador(S, "Lugar Marcador Só Escondido", "Cidade Marcador Escondida")), "painel", AGORA - 300, true);
    const antes = await historico(c, S);
    expect(antes.map((v) => v.oculto), "a premissa: uma versão, oculta").toEqual([true]);
    await guardar(completo());
    expect((await publicarS()).status).toBe(409);
    expect(await historico(c, S)).toEqual(antes);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });

  // 🔴 A CORRIDA (I4, 12-N2): um lugar nasce em S DEPOIS de a rota ler tudo e
  // ANTES do batch. Só o portão do banco o vê.
  it("um lugar nasce no endereço logo antes do batch: 409, uma versão só (a do intruso), o rascunho intacto", async () => {
    await guardar(completo());
    const intruso = JSON.stringify(lugarMarcador(S, "Lugar Marcador Intruso", "Cidade Marcador Intrusa"));
    const g = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {
      await gravarVersao(c, S, intruso, "painel", AGORA);
    });
    daRota = g.cliente;
    const res = await publicarS();
    expect(g.disparos(), "o dublê nunca disparou: nada foi intercalado").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeLugar(nomeComCidade("Lugar Marcador Intruso", "Cidade Marcador Intrusa")));
    const h = await historico(c, S);
    expect(h).toHaveLength(1);
    expect(h[0].doc).toBe(intruso);
    expect((await lerRascunho(c, S))?.atualizado_em).toBe(ATUALIZADO);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 17/10 (Review Focus 4 da rodada): A CHAVE TEM DE SER O `nome-cidade`. O
// rascunho do painel nasce numa chave provisória, e fica nela quando o ponto
// diz um par (ou um endereço) que já é de outro — a saída (b). Aberto pela
// lista do painel e pelo "publicar" de lá, ele chega aqui com a chave
// provisória; e nunca vai ao ar em `/rascunho_…`.
describe("POST /api/admin/publicar — a chave tem de ser o nome-cidade", () => {
  // 🔴 A TRAVA QUE SÓ ESTA PORTA VÊ: o endereço `S` é de um lugar de OUTRO par
  // (a fronteira entre o nome e a cidade que anda). O par do rascunho está
  // livre, e o batch gravaria na chave — sem esta porta, o lugar ia ao ar em
  // `/rascunho_…` (medido: M4). Com ela, 409 com a frase de quem ocupa `S`.
  it("chave provisória nunca vai ao ar: 409 com a frase da trava, nada em ficha_versoes", async () => {
    await gravarVersao(c, S, JSON.stringify(lugarMarcador(S, "Lugar Marcador Publicar Cidade", "Marcador Publicar")), "painel", AGORA - 300);
    expect(slugDoNome("Lugar Marcador Publicar Cidade Marcador Publicar"), "a premissa: o outro par cai em S").toBe(S);
    const k = novaChaveDeRascunho();
    await guardar(rascunhoCompleto(k, NOME, CIDADE), k);
    const antesDeS = await historico(c, S);
    const res = await publicar({ slug: k, atualizadoEm: ATUALIZADO });
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeLugar(nomeComCidade("Lugar Marcador Publicar Cidade", "Marcador Publicar")));
    expect(await historico(c, k), "um lugar foi ao ar na chave provisória").toEqual([]);
    expect(await historico(c, S)).toEqual(antesDeS);
    expect((await lerRascunho(c, k))?.atualizado_em).toBe(ATUALIZADO);
  });

  // E quando o que trava é o PAR (um lugar de mesmo nome e cidade noutro
  // endereço), a frase é a do par — a mesma que o ponto deixou na tela.
  it("chave provisória com o par de outro: 409 com a frase do par, nada em ficha_versoes", async () => {
    const gemeo = "lugar-marcador-gemeo";
    await gravarVersao(c, gemeo, JSON.stringify(lugarMarcador(gemeo, NOME, CIDADE)), "painel", AGORA - 300);
    const k = novaChaveDeRascunho();
    await guardar(rascunhoCompleto(k, NOME, CIDADE), k);
    const antes = await outros();
    const res = await publicar({ slug: k, atualizadoEm: ATUALIZADO });
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(nomeComCidade(NOME, CIDADE)));
    expect(await historico(c, k)).toEqual([]);
    expect(await historico(c, S)).toEqual([]);
    expect((await lerRascunho(c, k))?.atualizado_em).toBe(ATUALIZADO);
    expect(await outros()).toEqual(antes);
  });

  // O ocupante saiu depois do ponto (apagado, ou noutro endereço): nada impede
  // mais, e a chave ainda não andou — a frase é a de "ainda não saiu". Vale
  // também pra uma chave `nome-cidade` que não é a do documento.
  it("chave provisória sem trava nenhuma: 409 ENDERECO_AINDA_NAO_SAIU", async () => {
    for (const k of [novaChaveDeRascunho(), "lugar-marcador-publicar-cidade-marcador-velha"]) {
      await guardar(rascunhoCompleto(k, NOME, CIDADE), k);
      const res = await publicar({ slug: k, atualizadoEm: ATUALIZADO });
      expect(res.status, k).toBe(409);
      expect(await res.text(), k).toBe(ENDERECO_AINDA_NAO_SAIU);
      expect(await historico(c, k), k).toEqual([]);
      expect((await lerRascunho(c, k))?.atualizado_em, k).toBe(ATUALIZADO);
      // Um de cada vez: o rascunho dele com o mesmo par seria a trava do próximo.
      await c.execute({ sql: "DELETE FROM ficha_rascunhos WHERE slug = ?", args: [k] });
    }
    expect(await historico(c, S)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 I1 DA AUDITORIA: o que vai ao ar é o rascunho que a TELA mostrou.
describe("POST /api/admin/publicar — a identidade do rascunho", () => {
  it("o rascunho mudou depois que a tela abriu: 409, nada no ar, o rascunho novo intacto", async () => {
    await guardar(completo(), S, ATUALIZADO + 5);
    const res = await publicarS();
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    await nadaMudou(ATUALIZADO + 5);
  });

  // A mesma coisa, entre tudo o que a rota leu e o batch: só o portão do banco
  // (o `atualizado_em` no 1º passo) a vê.
  it("um Salvar entra logo antes do batch: 409, nada no ar, o rascunho de agora intacto", async () => {
    await guardar(completo());
    const g = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {
      await guardar({ ...completo(), voz: "Uma voz marcadora salva no meio." }, S, ATUALIZADO + 7);
    });
    daRota = g.cliente;
    const res = await publicarS();
    expect(g.disparos()).toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    await nadaMudou(ATUALIZADO + 7);
  });

  it("um rename noutra aba entra logo antes do batch: 409, nada em S, o rascunho no endereço novo intacto", async () => {
    await guardar(completo());
    const outroEndereco = "lugar-marcador-renomeado-cidade-marcador-publicar";
    const g = clienteQueIntercala(c, /^INSERT INTO ficha_versoes\b/, async () => {
      expect(await moverRascunho(c, S, outroEndereco, JSON.stringify({ ...completo(), slug: outroEndereco }), ATUALIZADO + 9)).toBe(true);
    });
    daRota = g.cliente;
    const res = await publicarS();
    expect(g.disparos()).toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_SUMIU);
    expect(await historico(c, S)).toEqual([]);
    expect(await lerRascunho(c, S)).toBeNull();
    expect((await lerRascunho(c, outroEndereco))?.atualizado_em).toBe(ATUALIZADO + 9);
  });

  // 🔴 M1 da revisão da Tarefa 12: a identidade tem resolução de 1 segundo, e
  // duas gravações no MESMO segundo (o PUT em voo que chega depois de a página
  // de publicar ler) deixavam o `atualizado_em` igual com o documento diferente.
  it("dois Salvar no MESMO segundo: a tela que leu o primeiro leva 409, nada no ar", async () => {
    await guardar(completo());
    const salvar = (valor: string) =>
      rotaRascunho.PUT(
        new Request("http://x/api/admin/rascunho", {
          method: "PUT",
          headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
          body: JSON.stringify({ slug: S, campo: "voz", valor }),
        }),
      );
    expect((await salvar("Uma voz marcadora, a primeira.")).status).toBe(200);
    const daTela = (await lerRascunho(c, S))!.atualizado_em;
    expect((await salvar("Uma voz marcadora, a segunda.")).status).toBe(200);
    expect(Math.floor(Date.now() / 1000), "a premissa: o relógio não andou entre os dois").toBe(AGORA);
    const agora = (await lerRascunho(c, S))!;
    expect(JSON.parse(agora.doc).voz, "a premissa: o segundo Salvar gravou").toBe("Uma voz marcadora, a segunda.");
    const res = await publicar({ slug: S, atualizadoEm: daTela });
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    await nadaMudou(agora.atualizado_em);
  });

  // 🔴 M4 da revisão da Tarefa 12: o mesmo atraso, num PUT que muda a CIDADE (e
  // por isso o endereço) — desde 17/10, o PUT do PONTO, de onde a cidade sai:
  // `moverRascunho` recusa porque o ORIGEM sumiu, e a frase de "quem ocupa" o
  // destino — livre — seria falsa.
  it("um PUT do ponto atrasado, que muda a cidade, depois de publicar: 409 com a frase do rascunho que não existe mais", async () => {
    await guardar(completo());
    const noAr = JSON.stringify(fichaSchema.parse(completo()));
    const g = clienteQueIntercala(c, /^(UPDATE|INSERT INTO) ficha_rascunhos\b/, async () => {
      expect(await publicarRascunho(c, S, noAr, AGORA, ATUALIZADO)).toBe(true);
    });
    daRota = g.cliente;
    const destino = "lugar-marcador-publicar-cidade-marcador-mudada";
    nominatimDeTeste.ponto = { cidade: "Cidade Marcador Mudada" };
    const res = await rotaRascunho.PUT(
      new Request("http://x/api/admin/rascunho", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: JSON.stringify({ slug: S, ponto: 0, lat: -8.2, lng: -35.3 }),
      }),
    );
    expect(g.disparos(), "o dublê nunca disparou: nada foi intercalado").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_NAO_EXISTE_MAIS);
    expect(await lerRascunho(c, S), "o rascunho renasceu ao lado do lugar no ar").toBeNull();
    expect(await lerRascunho(c, destino), "o rascunho renasceu no endereço novo").toBeNull();
    expect(await historico(c, destino)).toEqual([]);
    expect(await historico(c, S)).toHaveLength(1);
  });

  // 🔴 R2 (I1b): o PUT do rascunho que leu ANTES da publicação e grava DEPOIS.
  // Com upsert, ele RECRIAVA o rascunho em S, ao lado do lugar no ar.
  it("um PUT do rascunho atrasado, depois de publicar: 409, nenhum rascunho renasce, o lugar publicado intacto", async () => {
    await guardar(completo());
    const noAr = JSON.stringify(fichaSchema.parse(completo()));
    const g = clienteQueIntercala(c, /^(UPDATE|INSERT INTO) ficha_rascunhos\b/, async () => {
      expect(await publicarRascunho(c, S, noAr, AGORA, ATUALIZADO)).toBe(true);
    });
    daRota = g.cliente;
    const res = await rotaRascunho.PUT(
      new Request("http://x/api/admin/rascunho", {
        method: "PUT",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: JSON.stringify({ slug: S, campo: "voz", valor: "Uma voz marcadora atrasada." }),
      }),
    );
    expect(g.disparos(), "o dublê nunca disparou: nada foi intercalado").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_NAO_EXISTE_MAIS);
    expect(await lerRascunho(c, S), "o rascunho renasceu ao lado do lugar no ar").toBeNull();
    const h = await historico(c, S);
    expect(h).toHaveLength(1);
    expect(h[0].doc).toBe(noAr);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 12-E5: publicar num endereço que JÁ FOI de outro lugar o RETOMA. O lugar P
// morava em S e foi pra T; S ficou levando a T, e órfãos ficaram em S.
describe("POST /api/admin/publicar — o endereço antigo de outro lugar", () => {
  const T = "lugar-marcador-antigo-cidade-marcador-antiga";

  async function sLevaAT(): Promise<void> {
    await gravarVersao(c, S, JSON.stringify(lugarMarcador(S, "Lugar Marcador Antigo", "Cidade Marcador Antiga")), "painel", AGORA - 60);
    expect(await trocarEndereco(c, S, T, AGORA - 50, await base(c, S))).toBe(true);
    // Órfãos em S, entrados pela tabela (como dado de antes do conserto da 11e).
    await c.execute({
      sql: `INSERT INTO avisos (ficha_slug, texto, efeito, criado_em, vence_em) VALUES (?, ?, 'fechado', ?, ?)`,
      args: [S, "aviso órfão marcador", AGORA - 40, AGORA + 3600],
    });
    await insertConfirmacao(c, S, AGORA - 40, "barro");
    await upsertFreshness(c, { slug: S, estado: "frio", calculadoEm: AGORA - 40, fonte: "marcador", previsaoBruta: "{}" });
    await upsertFreshness(c, { slug: T, estado: "fresco", calculadoEm: AGORA - 40, fonte: "marcador", previsaoBruta: "{}" });
    expect(await enderecoNovoDe(c, S), "a premissa: S leva a T").toBe(T);
  }

  it("/S mostra o lugar novo; o link antigo do outro some; os órfãos voltam pro dono; a freshness de S sai", async () => {
    await sLevaAT();
    await guardar(completo());
    const doOutroAntes = await doOutro();
    expect((doOutroAntes as { avisos: unknown[] }).avisos, "a premissa: o outro tem aviso").toHaveLength(1);
    const res = await publicarS();
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await fichas.getFicha(S))?.trajeto.waypoints[0].nome).toBe(NOME);
    expect((await fichas.getFicha(T))?.trajeto.waypoints[0].nome).toBe("Lugar Marcador Antigo");
    // E5-VELHO: a linha `velho = S` sumiu.
    expect(await enderecoNovoDe(c, S)).toBeNull();
    expect(await enderecosAntigosDe(c, T)).not.toContain(S);
    // E5-ORFAOS: o aviso e o relato órfãos são do lugar que morava em S.
    expect(await avisoVigente(c, S, AGORA)).toBeNull();
    expect((await avisoVigente(c, T, AGORA))?.texto).toBe("aviso órfão marcador");
    expect(await contarHoje(c, S, AGORA)).toEqual({ foram: 0, barro: 0 });
    expect(await contarHoje(c, T, AGORA)).toEqual({ foram: 1, barro: 1 });
    // E5-FRESH: a de S sai (cache), a de T fica.
    expect(await getFreshness(c, S)).toBeNull();
    expect((await getFreshness(c, T))?.estado).toBe("fresco");
    // I11: o re-casar e os apagares só tocaram no que era de S.
    expect(await doOutro()).toEqual(doOutroAntes);
  });

  // 🔴 PORTA-SEM: um publicar RECUSADO não toca em nada — nem a linha, nem os
  // órfãos, nem a freshness, nem o rascunho.
  it("publicar recusado num endereço antigo (o rascunho mudou) não toca em nada", async () => {
    await sLevaAT();
    await guardar(completo());
    const antes = {
      linha: await enderecoNovoDe(c, S),
      aviso: await avisoVigente(c, S, AGORA),
      relatos: await contarHoje(c, S, AGORA),
      fresh: await getFreshness(c, S),
    };
    expect(antes.aviso, "a premissa: há aviso órfão em S").not.toBeNull();
    const doc = JSON.stringify(fichaSchema.parse(completo()));
    expect(await publicarRascunho(c, S, doc, AGORA, ATUALIZADO + 1)).toBe(false);
    expect({
      linha: await enderecoNovoDe(c, S),
      aviso: await avisoVigente(c, S, AGORA),
      relatos: await contarHoje(c, S, AGORA),
      fresh: await getFreshness(c, S),
    }).toEqual(antes);
    await nadaMudou();
  });
});
