import type { Client } from "@libsql/client";
import type { Rascunho } from "@/lib/db";
import type { QuemContribui } from "@/lib/contribuidor-sessao";

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

/** Ela não está bloqueada — em SQL, pra morar NO statement que grava (o João
 *  pode bloquear entre a porta da rota e a gravação). */
const LIVRE = `NOT EXISTS (SELECT 1 FROM contribuidores WHERE id = ? AND bloqueado = 1)`;

/** 🔴 O endereço não é endereço ANTIGO de outro lugar (ruling de produto da
 *  pré-auditoria de 07/10): o link velho que circula continua levando ao lugar
 *  de onde veio, e o rascunho dela não nasce nem se muda pra lá. Em SQL, pra
 *  morar NO statement que grava; o `publicarRascunho` (Task 1) confere de novo,
 *  no batch, pra corrida. Um `?`: o endereço. */
const SEM_ENDERECO_ANTIGO = `NOT EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?)`;

const rascunho = (r: Record<string, unknown>): Rascunho => ({
  slug: String(r.slug), doc: String(r.doc), atualizado_em: Number(r.atualizado_em),
});

/** Quem contribui, a cada porta aberta. Perfil novo atualiza; perfil que não
 *  veio (`null`) NÃO apaga o de antes. 🔴 NUNCA mexe em `bloqueado`: só o João
 *  bloqueia e desbloqueia (Task 15). */
export async function registrarContribuidor(client: Client, p: QuemContribui, agora: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 0, ?)
          ON CONFLICT(id) DO UPDATE SET nome = COALESCE(excluded.nome, contribuidores.nome),
                                        email = COALESCE(excluded.email, contribuidores.email)`,
    args: [p.id, p.nome, p.email, agora],
  });
}

export async function estaBloqueado(client: Client, id: string): Promise<boolean> {
  const r = await client.execute({ sql: `SELECT bloqueado FROM contribuidores WHERE id = ?`, args: [id] });
  return r.rows.length > 0 && Number(r.rows[0].bloqueado) === 1;
}

/** BLOQUEAR QUEM MANDOU (spec de 07/10, Parte 3): numa transação, a pessoa
 *  passa a bloqueada E cada lugar DELA que está no ar ganha uma versão nova
 *  `oculto = 1` com o documento atual (append-only; conferidos inclusive — e
 *  os que ela ainda edita, que a partir daqui o `LIVRE` recusa). Devolve
 *  quantos lugares saíram do ar; os já escondidos não ganham versão repetida.
 *  Quem nunca passou pela porta (sem linha) nasce bloqueado; quem já passou
 *  TEM linha (`bloqueado = 0`), e é o `DO UPDATE` que a bloqueia — nome e
 *  e-mail ficam.
 *
 *  O `rowsAffected` do `INSERT … SELECT` SEM `RETURNING` conta as linhas certas
 *  no libsql 0.14 (medido na pré-auditoria de 07/10; o comentário de
 *  `gravarRelatoDoLugar` mediu que é COM `RETURNING` que ele mente). Não ponha
 *  `RETURNING` aqui. */
export async function bloquearContribuidor(client: Client, id: string, agora: number): Promise<number> {
  const rs = await client.batch(
    [
      {
        sql: `INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, NULL, NULL, 1, ?)
              ON CONFLICT(id) DO UPDATE SET bloqueado = 1`,
        args: [id, agora],
      },
      {
        sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
              SELECT v.ficha_slug, v.doc, 'painel', ?, 1
                FROM ficha_versoes v
               WHERE v.id IN (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)
                 AND v.oculto <> 1
                 AND ${IDENTIDADE("v.ficha_slug")} IN (SELECT lugar FROM origem_do_lugar WHERE contribuidor = ?)`,
        args: [agora, id],
      },
    ],
    "write",
  );
  return rs[1].rowsAffected;
}

/** DESBLOQUEAR: só o bloqueio. Os lugares continuam escondidos até o João
 *  mostrar cada um, pelo botão de visibilidade de sempre (spec, Parte 3).
 *  `false` = não havia linha (nunca foi bloqueada nem passou pela porta). */
export async function desbloquearContribuidor(client: Client, id: string): Promise<boolean> {
  const r = await client.execute({ sql: `UPDATE contribuidores SET bloqueado = 0 WHERE id = ?`, args: [id] });
  return r.rowsAffected === 1;
}

/** O rascunho DELA nasce — com a régua de `criarRascunho` (endereço livre nas
 *  duas tabelas, numa consulta só) e mais duas: é dela, e ela não está
 *  bloqueada. */
export async function criarRascunhoDaPessoa(client: Client, slug: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
                             AND ${SEM_ENDERECO_ANTIGO} AND ${LIVRE}
          ON CONFLICT(slug) DO NOTHING`,
    args: [slug, doc, agora, id, slug, slug, id],
  });
  return r.rowsAffected === 1;
}

export async function lerRascunhoDaPessoa(client: Client, slug: string, id: string): Promise<Rascunho | null> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE slug = ? AND contribuidor = ?`,
    args: [slug, id],
  });
  return r.rows.length ? rascunho(r.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function rascunhosDaPessoa(client: Client, id: string): Promise<Rascunho[]> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE contribuidor = ? ORDER BY atualizado_em DESC, slug ASC`,
    args: [id],
  });
  return r.rows.map((l) => rascunho(l as unknown as Record<string, unknown>));
}

/** A régua de `regravarRascunho` (UPDATE, nunca upsert; `atualizado_em` cresce
 *  estritamente), e só no rascunho DELA, livre. */
export async function regravarRascunhoDaPessoa(client: Client, slug: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET doc = ?, atualizado_em = MAX(?, atualizado_em + 1)
           WHERE slug = ? AND contribuidor = ? AND ${LIVRE}`,
    args: [doc, agora, slug, id, id],
  });
  return r.rowsAffected === 1;
}

/** A régua de `moverRascunho` (o destino livre nas duas tabelas, num UPDATE
 *  só), e só no rascunho DELA, livre — e o destino não é endereço antigo. */
export async function moverRascunhoDaPessoa(client: Client, de: string, para: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET slug = ?, doc = ?, atualizado_em = MAX(?, atualizado_em + 1)
           WHERE slug = ? AND contribuidor = ? AND ${LIVRE}
             AND NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
             AND NOT EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ?)
             AND ${SEM_ENDERECO_ANTIGO}`,
    args: [para, doc, agora, de, id, id, para, para, para],
  });
  return r.rowsAffected === 1;
}

/** DESISTIR: só o rascunho DELA, e só livre (onda de fix da Task 10) — conta
 *  bloqueada não apaga nem desiste: o que ela mandou fica pro João ver. O
 *  `${LIVRE}` mora no statement, como nas outras gravações, pela corrida. */
export async function apagarRascunhoDaPessoa(client: Client, slug: string, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `DELETE FROM ficha_rascunhos WHERE slug = ? AND contribuidor = ? AND ${LIVRE}`,
    args: [slug, id, id],
  });
  return r.rowsAffected === 1;
}

/** A EDIÇÃO DELA, no lugar dela no ar (Task 12) — a régua de `gravarEdicao`
 *  (identidade pela versão da tela; `oculto` lido no próprio INSERT: esconder
 *  é do João, e editar não devolve ao ar) e mais três condições, TODAS no
 *  mesmo statement (Review Focus 2): o lugar é dela, ainda não conferido, e
 *  ela não está bloqueada. Uma checagem antes e um INSERT depois deixariam a
 *  janela em que o "Conferi" do João cabe — e a aba velha dela regravaria um
 *  lugar que ele já conferiu. Lugar do João não tem linha em
 *  `origem_do_lugar`, então o `EXISTS` o recusa. `null` = nada gravado. */
export async function gravarEdicaoDaPessoa(
  client: Client, slug: string, doc: string, agora: number, baseId: number, id: string,
): Promise<number | null> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          SELECT ?, ?, 'contribuidor', ?,
                 (SELECT oculto FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1)
          WHERE EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
            AND EXISTS (SELECT 1 FROM origem_do_lugar
                         WHERE lugar = ${IDENTIDADE("?")} AND contribuidor = ? AND conferido <> 1)
            AND ${LIVRE}
          RETURNING id`,
    args: [slug, doc, agora, slug, baseId, slug, slug, id, id],
  });
  return r.rows.length ? Number(r.rows[0].id) : null;
}

export type LugarDaPessoa = { slug: string; doc: string; oculto: boolean; conferido: boolean };

/** Os lugares que ELA publicou, onde moram agora (a versão mais nova do
 *  endereço da identidade), o mais novo primeiro — escondidos inclusive: ela
 *  vê que estão fora do ar; quem os escondeu foi o João. */
export async function lugaresDaPessoa(client: Client, id: string): Promise<LugarDaPessoa[]> {
  const r = await client.execute({
    sql: `SELECT v.ficha_slug AS slug, v.doc, v.oculto, o.conferido
            FROM origem_do_lugar o
            JOIN ficha_versoes v
              ON v.id = (SELECT MAX(j.id) FROM ficha_versoes j
                          WHERE j.ficha_slug = (SELECT f.ficha_slug FROM ficha_versoes f WHERE f.id = o.lugar))
           WHERE o.contribuidor = ?
           ORDER BY o.lugar DESC`,
    args: [id],
  });
  return r.rows.map((l) => ({
    slug: String(l.slug), doc: String(l.doc), oculto: Number(l.oculto) === 1, conferido: Number(l.conferido) === 1,
  }));
}
