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
