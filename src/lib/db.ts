import { createClient, type Client } from "@libsql/client";

export type TipoRelato = "seco" | "barro";

export type EfeitoAviso = "nenhum" | "fresco" | "frio" | "fechado";

export type AvisoLinha = {
  id: number;
  ficha_slug: string;
  texto: string;
  efeito: EfeitoAviso;
  criado_em: number;
  vence_em: number;
};

export type Freshness = {
  ficha_slug: string;
  estado: string;
  calculado_em: number;
  fonte: string;
  previsao_bruta: string | null;
};

let singleton: Client | null = null;

export function getClient(): Client {
  if (singleton) return singleton;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL não configurada");
  singleton = createClient({ url, authToken });
  return singleton;
}

export async function ensureSchema(client: Client): Promise<void> {
  await client.execute(`CREATE TABLE IF NOT EXISTS freshness (
    ficha_slug TEXT PRIMARY KEY, estado TEXT NOT NULL, calculado_em INTEGER NOT NULL,
    fonte TEXT NOT NULL, previsao_bruta TEXT)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS confirmacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    criado_em INTEGER NOT NULL, tipo TEXT NOT NULL DEFAULT 'foi')`);
  // 🔴 APPEND-ONLY, e `retirado` em vez de DELETE: o aviso é afirmação do dono
  // sobre um lugar real. Saber o que foi dito e quando é a régua deste projeto.
  // `vence_em` é NOT NULL de propósito — aviso sem prazo é mentira agendada.
  await client.execute(`CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    texto TEXT NOT NULL, efeito TEXT NOT NULL,
    criado_em INTEGER NOT NULL, vence_em INTEGER NOT NULL,
    retirado INTEGER NOT NULL DEFAULT 0)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS avisos_por_lugar ON avisos (ficha_slug, retirado, vence_em)`,
  );
  // 🔴 APPEND-ONLY, como `avisos`, e pela mesma razão: o que foi dito sobre um
  // lugar real, e quando, é a espinha deste projeto. A ficha saiu do git em
  // 2026-09-24, então ESTA tabela é a única procedência que existe — não há
  // `git blame` de socorro. Voltar a uma versão antiga GRAVA uma versão nova.
  //
  // `doc` é o JSON da ficha INTEIRA, não um campo. Versão de documento inteiro
  // torna "voltar" trivial e espelha o que o git fazia; o custo é não haver
  // diff por campo, que ninguém pediu.
  await client.execute(`CREATE TABLE IF NOT EXISTS ficha_versoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    doc TEXT NOT NULL, autor TEXT NOT NULL, criado_em INTEGER NOT NULL)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS ficha_versoes_por_lugar ON ficha_versoes (ficha_slug, id)`,
  );
  await migrarColunaOculto(client);
}

/** A coluna `oculto` de `ficha_versoes`, por `ALTER TABLE` guardado.
 *
 *  🔴 ELA NÃO PODE NASCER NO `CREATE TABLE` ACIMA, e é por isso que esta
 *  função existe: `ficha_versoes` JÁ ESTÁ EM PRODUÇÃO desde 2026-09-26, então
 *  o `CREATE TABLE IF NOT EXISTS` não roda mais lá — acrescentar a coluna na
 *  string dele mudaria o schema dos bancos NOVOS e deixaria o de produção sem a
 *  coluna, que é o pior dos dois mundos.
 *
 *  🔴 E `ALTER TABLE ... ADD COLUMN` NÃO TEM `IF NOT EXISTS` NO SQLITE.
 *  `ensureSchema` roda em TODO boot e o resto deste arquivo depende de ela ser
 *  idempotente; sem o guarda, o SEGUNDO boot estouraria com "duplicate column
 *  name: oculto" e derrubaria o app inteiro. O guarda pergunta ao próprio banco
 *  (`PRAGMA table_info`) em vez de capturar a mensagem de erro do driver: a
 *  mensagem é do driver e muda com a versão dele, o pragma é a pergunta de
 *  verdade.
 *
 *  `DEFAULT 0` é o que faz toda linha JÁ GRAVADA nascer VISÍVEL — ninguém
 *  escondeu nada antes de hoje, e o dono não pode encontrar o acervo inteiro
 *  fora do ar depois de um deploy. `NOT NULL` pela mesma razão do `vence_em`
 *  de `avisos`: numa coluna que decide o que está no ar, valor em branco é
 *  uma pergunta sem resposta. */
async function migrarColunaOculto(client: Client): Promise<void> {
  const colunas = await client.execute(`PRAGMA table_info(ficha_versoes)`);
  if (colunas.rows.some((c) => String(c.name) === "oculto")) return;
  await client.execute(`ALTER TABLE ficha_versoes ADD COLUMN oculto INTEGER NOT NULL DEFAULT 0`);
}

export function inicioDoDiaRecife(agora: number): number {
  const OFFSET = -3 * 3600; // America/Recife = UTC-3, sem horário de verão
  return Math.floor((agora + OFFSET) / 86400) * 86400 - OFFSET;
}

export async function upsertFreshness(
  client: Client,
  row: { slug: string; estado: string; calculadoEm: number; fonte: string; previsaoBruta: string },
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO freshness (ficha_slug, estado, calculado_em, fonte, previsao_bruta)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ficha_slug) DO UPDATE SET
            estado = excluded.estado,
            calculado_em = excluded.calculado_em,
            fonte = excluded.fonte,
            previsao_bruta = excluded.previsao_bruta`,
    args: [row.slug, row.estado, row.calculadoEm, row.fonte, row.previsaoBruta],
  });
}

export async function getFreshness(client: Client, slug: string): Promise<Freshness | null> {
  const rs = await client.execute({
    sql: `SELECT ficha_slug, estado, calculado_em, fonte, previsao_bruta
          FROM freshness WHERE ficha_slug = ?`,
    args: [slug],
  });
  const r = rs.rows[0];
  if (!r) return null;
  return {
    ficha_slug: String(r.ficha_slug),
    estado: String(r.estado),
    calculado_em: Number(r.calculado_em),
    fonte: String(r.fonte),
    previsao_bruta: r.previsao_bruta == null ? null : String(r.previsao_bruta),
  };
}

export async function insertConfirmacao(
  client: Client,
  slug: string,
  criadoEm: number,
  tipo: TipoRelato,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO confirmacoes (ficha_slug, criado_em, tipo) VALUES (?, ?, ?)`,
    args: [slug, criadoEm, tipo],
  });
}

export async function countConfirmacoes(client: Client, slug: string): Promise<number> {
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?`,
    args: [slug],
  });
  return Number(rs.rows[0]?.n ?? 0);
}

export async function contarHoje(
  client: Client,
  slug: string,
  agora: number,
): Promise<{ foram: number; barro: number }> {
  const inicio = inicioDoDiaRecife(agora);
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS foram,
                 SUM(CASE WHEN tipo = 'barro' THEN 1 ELSE 0 END) AS barro
          FROM confirmacoes
          WHERE ficha_slug = ? AND criado_em >= ?`,
    args: [slug, inicio],
  });
  const r = rs.rows[0];
  return { foram: Number(r?.foram ?? 0), barro: Number(r?.barro ?? 0) };
}

export async function inserirAviso(
  client: Client, slug: string, texto: string, efeito: EfeitoAviso,
  criadoEm: number, venceEm: number,
): Promise<number> {
  const r = await client.execute({
    sql: `INSERT INTO avisos (ficha_slug, texto, efeito, criado_em, vence_em)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [slug, texto, efeito, criadoEm, venceEm],
  });
  return Number(r.rows[0].id);
}

function linha(r: Record<string, unknown>): AvisoLinha {
  return {
    id: Number(r.id), ficha_slug: String(r.ficha_slug), texto: String(r.texto),
    efeito: String(r.efeito) as EfeitoAviso,
    criado_em: Number(r.criado_em), vence_em: Number(r.vence_em),
  };
}

/** O aviso que vale AGORA pra este lugar: o mais recente que não venceu e não
 *  foi retirado. `vence_em > agora` — no instante exato do prazo, já venceu. */
export async function avisoVigente(
  client: Client, slug: string, agora: number,
): Promise<AvisoLinha | null> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE ficha_slug = ? AND retirado = 0 AND vence_em > ?
          ORDER BY criado_em DESC, id DESC LIMIT 1`,
    args: [slug, agora],
  });
  return r.rows.length ? linha(r.rows[0] as unknown as Record<string, unknown>) : null;
}

/** Todos os vigentes de uma vez — a home tem N lugares, e N consultas saindo
 *  do celular no portão é o que `resolverEstados` já existe pra evitar. */
export async function avisosVigentes(
  client: Client, agora: number,
): Promise<Map<string, AvisoLinha>> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE retirado = 0 AND vence_em > ? ORDER BY criado_em ASC, id ASC`,
    args: [agora],
  });
  const fora = new Map<string, AvisoLinha>();
  // ASC + set = o último a entrar vence, que é o mais recente. Um por lugar.
  for (const row of r.rows) {
    const a = linha(row as unknown as Record<string, unknown>);
    fora.set(a.ficha_slug, a);
  }
  return fora;
}

/** Tirar da tela. NUNCA apaga a linha — ver o comentário da tabela. */
export async function retirarAviso(client: Client, id: number): Promise<void> {
  await client.execute({ sql: `UPDATE avisos SET retirado = 1 WHERE id = ?`, args: [id] });
}

export type AutorVersao = "painel" | "semente";

export type FichaVersao = {
  id: number;
  ficha_slug: string;
  doc: string;
  autor: AutorVersao;
  criado_em: number;
  /** `true` = fora do público. NÃO é "apagado": a linha continua no histórico,
   *  o painel continua editando o lugar, e a versão seguinte pode devolvê-lo ao
   *  ar. Ver `versoesAtuais`. */
  oculto: boolean;
};

function versaoDaLinha(r: Record<string, unknown>): FichaVersao {
  return {
    id: Number(r.id),
    ficha_slug: String(r.ficha_slug),
    doc: String(r.doc),
    autor: String(r.autor) as AutorVersao,
    criado_em: Number(r.criado_em),
    // 🔴 `Number(...) === 1`, NUNCA `Boolean(r.oculto)`. Se o driver devolver a
    // coluna como STRING, `Boolean("0")` é `true` — e TODA ficha do acervo
    // nasceria escondida, o app inteiro fora do ar sem ninguém pedir. Mesma
    // régua das outras conversões desta função: à mão, e pro tipo certo.
    oculto: Number(r.oculto) === 1,
  };
}

/** Grava uma versão NOVA — INSERT, nunca UPDATE (ver o comentário da tabela).
 *
 *  🔴 O `oculto` TEM DEFAULT `false` PRA NÃO MEXER NOS CHAMADORES ANTIGOS, E
 *  ISSO É UMA ARMADILHA PARA QUEM GRAVA UMA EDIÇÃO. Quem grava versão nova de um
 *  lugar QUE JÁ EXISTE tem de passar o `oculto` da versão ATUAL: com o default,
 *  o dono esconde um lugar, conserta um typo pelo celular, e o lugar VOLTA AO AR
 *  em silêncio. Visibilidade só muda pela porta que existe pra isso
 *  (`POST /api/admin/visibilidade`) — nunca de carona numa edição de campo. É o
 *  que `src/app/api/admin/ficha/route.ts` faz, com o porquê escrito lá. */
export async function gravarVersao(
  client: Client, slug: string, doc: string, autor: AutorVersao, criadoEm: number,
  oculto: boolean = false,
): Promise<number> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [slug, doc, autor, criadoEm, oculto ? 1 : 0],
  });
  return Number(r.rows[0].id);
}

/** A ficha de AGORA daquele lugar: a versão de maior `id`.
 *
 *  🔴 ORDENA POR `id`, NÃO POR `criado_em`. Duas gravações no mesmo segundo
 *  são reais (salvar duas vezes seguidas), e por tempo o desempate viraria
 *  sorteio — o João salvaria e veria a versão anterior. O `id` é monotônico. */
export async function versaoAtual(client: Client, slug: string): Promise<FichaVersao | null> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1`,
    args: [slug],
  });
  return r.rows.length ? versaoDaLinha(r.rows[0]) : null;
}

/** Uma versão específica, por `id` — a peça que falta pro "voltar": antes de
 *  regravar o conteúdo dela, quem chama tem que conferir que `ficha_slug`
 *  bate com o lugar pedido (ver `src/app/api/admin/ficha/route.ts`). Devolve
 *  `null` pra um `id` que não existe, nunca lança. */
export async function versaoPorId(client: Client, id: number): Promise<FichaVersao | null> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE id = ?`,
    args: [id],
  });
  return r.rows.length ? versaoDaLinha(r.rows[0]) : null;
}

/** A versão atual de TODOS os lugares, numa consulta só — irmão do
 *  `avisosVigentes`, e pela mesma razão: N consultas no portão é o que esta
 *  família evita.
 *
 *  🔴 O PADRÃO É SÓ O QUE ESTÁ NO AR. Lugar cuja versão de maior `id` tem
 *  `oculto = 1` NÃO SAI DAQUI — é assim que a home, o acervo e a página do
 *  lugar param de mostrá-lo, sem nenhuma delas saber que "esconder" existe.
 *
 *  🔴 QUEM TEM DE PASSAR `{ incluirOcultos: true }`, E POR QUÊ (medido antes de
 *  escrever a coluna, porque o padrão novo muda estes dois em silêncio):
 *
 *   1. **O portão de coerência** (`src/app/api/admin/ficha/route.ts`): duas das
 *      treze regras comparam uma ficha com as outras, e **lugar escondido
 *      volta**. Sem o acervo inteiro, o buraco é: esconder o Véu → copiar a voz
 *      dele na Rampa (passa, o Véu não está mais no acervo medido) → mostrar o
 *      Véu de novo → duas fichas públicas dizendo a mesma coisa.
 *   2. **A semente** (`src/lib/semente.ts`): um acervo todo escondido pareceria
 *      VAZIO, e `npm run semear` regravaria tudo VISÍVEL por cima do que o dono
 *      escondeu de propósito.
 *
 *  🔴 E O FILTRO FICA **FORA** DA SUBCONSULTA, DE PROPÓSITO. Dentro dela
 *  (`SELECT MAX(id) ... WHERE oculto <> 1`) o lugar escondido continuaria
 *  aparecendo, servido pela última versão VISÍVEL — o dono esconderia o lugar e
 *  o público continuaria vendo a ficha dele, uma versão atrasada. O `MAX(id)`
 *  escolhe a versão que vale; só depois se pergunta se ela está no ar.
 *
 *  🔴 E É `oculto <> 1`, NÃO `oculto = 0`, PORQUE ESTA CONSULTA E O
 *  `versaoDaLinha` LEEM A MESMA COLUNA E TÊM DE CONCORDAR. Lá a régua é
 *  `Number(r.oculto) === 1` (ver o porquê ali), ou seja: **só `1` esconde, tudo
 *  o mais está no ar**. Com `= 0` aqui, um valor estranho na coluna — texto, o
 *  que um driver ou um escritor fora desta API produziria — sairia ESCONDIDO pro
 *  público e VISÍVEL pro painel: duas respostas pra mesma pergunta sobre o mesmo
 *  lugar, que é a espécie de defeito que este projeto já pagou três vezes. E o
 *  lado escolhido é "no ar", porque é o estado de todo lugar que ninguém
 *  escondeu, e porque o acervo inteiro sair do ar por um valor torto é o pior
 *  desfecho possível. */
export async function versoesAtuais(
  client: Client,
  opts: { incluirOcultos?: boolean } = {},
): Promise<Map<string, FichaVersao>> {
  const r = await client.execute(
    `SELECT * FROM ficha_versoes WHERE id IN
       (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)
       ${opts.incluirOcultos ? "" : "AND oculto <> 1"}`,
  );
  return new Map(r.rows.map((l) => { const v = versaoDaLinha(l); return [v.ficha_slug, v]; }));
}

/** Tudo que já foi dito sobre UM lugar, do mais novo pro mais velho.
 *
 *  🔴 NÃO FILTRA `oculto`, e nem `versaoAtual` nem `versaoPorId` filtram —
 *  esconder é tirar do PÚBLICO, não tirar do DONO. Se qualquer uma das três
 *  passasse a filtrar, o painel deixaria de conseguir editar um lugar escondido
 *  e o "voltar" morreria com ele: uma porta de mão única, que é o defeito que a
 *  ruling C1 da Tarefa 1 desta rodada já pagou uma vez. */
export async function historico(client: Client, slug: string): Promise<FichaVersao[]> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC`,
    args: [slug],
  });
  return r.rows.map(versaoDaLinha);
}
