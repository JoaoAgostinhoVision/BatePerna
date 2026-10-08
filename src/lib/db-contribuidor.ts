import type { Client } from "@libsql/client";

/** O BANCO DE QUEM USA O APP, e dos atos do João sobre o que essa pessoa mandou
 *  (spec de 07/10). Mora fora de `db.ts` por tamanho, não por regra: as mesmas
 *  réguas valem — toda condição de corrida NO MESMO statement que grava, e
 *  `Number(...) === 1` pras colunas que decidem. */

export type Contribuidor = { id: string; nome: string | null; email: string | null; bloqueado: boolean };
export type NaoConferido = { slug: string; doc: string; mandadoEm: number; contribuidor: Contribuidor };

const texto = (v: unknown): string | null => (v == null ? null : String(v));

/** A identidade do lugar que mora em `slug` (menor `id`), em SQL — a mesma
 *  conta de `identidadeSql` em `db.ts`. */
const IDENTIDADE = (slug: string) => `(SELECT MIN(i.id) FROM ficha_versoes i WHERE i.ficha_slug = ${slug})`;

/** Os lugares de quem usa que o João ainda não conferiu, o mais novo primeiro.
 *  `mandadoEm` é o `criado_em` da versão 1 (a do publicar). Quem mandou vem
 *  de `contribuidores`; sem linha lá, só o id — nome e e-mail ficam `null`,
 *  nunca inventados. Inclui os ESCONDIDOS: esconder é tirar do público, não
 *  da fila dele. */
export async function naoConferidos(client: Client): Promise<NaoConferido[]> {
  const r = await client.execute(
    `SELECT v.ficha_slug AS slug, v.doc, o.contribuidor, k.nome, k.email, k.bloqueado,
            (SELECT criado_em FROM ficha_versoes WHERE id = o.lugar) AS mandado_em
       FROM origem_do_lugar o
       JOIN ficha_versoes v
         ON v.id = (SELECT MAX(j.id) FROM ficha_versoes j
                     WHERE j.ficha_slug = (SELECT f.ficha_slug FROM ficha_versoes f WHERE f.id = o.lugar))
       LEFT JOIN contribuidores k ON k.id = o.contribuidor
      WHERE o.conferido <> 1
      ORDER BY mandado_em DESC, slug ASC`,
  );
  return r.rows.map((l) => ({
    slug: String(l.slug),
    doc: String(l.doc),
    mandadoEm: Number(l.mandado_em),
    contribuidor: { id: String(l.contribuidor), nome: texto(l.nome), email: texto(l.email), bloqueado: Number(l.bloqueado) === 1 },
  }));
}

/** Quem é a pessoa de `id`, pela linha de `contribuidores`; `null` = sem linha
 *  (a caixa da origem mostra então só o que há — nada inventado). */
export async function contribuidorPorId(client: Client, id: string): Promise<Contribuidor | null> {
  const r = await client.execute({ sql: `SELECT id, nome, email, bloqueado FROM contribuidores WHERE id = ?`, args: [id] });
  if (!r.rows.length) return null;
  const l = r.rows[0];
  return { id: String(l.id), nome: texto(l.nome), email: texto(l.email), bloqueado: Number(l.bloqueado) === 1 };
}

/** "CONFERI": o lugar de `slug` passa a conferido — só se ele é de quem usa,
 *  ainda não foi conferido, e a versão `baseId` (a que a tela do painel abriu)
 *  mora em `slug`. Tudo no MESMO `UPDATE`. `false` = nada mudou.
 *
 *  🔴 Lugar do João não tem linha, então não há o que atualizar — e esta
 *  função NUNCA cria linha: conferir não é dizer de onde o lugar veio. */
export async function conferirLugar(client: Client, slug: string, baseId: number, agora: number): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE origem_do_lugar SET conferido = 1, conferido_em = ?
           WHERE conferido <> 1
             AND lugar = ${IDENTIDADE("?")}
             AND EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)`,
    args: [agora, slug, baseId, slug],
  });
  return r.rowsAffected === 1;
}
