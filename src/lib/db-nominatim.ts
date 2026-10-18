/** O banco do Nominatim: a resposta guardada e a vez de 1 por segundo. SÓ
 *  servidor. Vale entre recargas E entre instâncias da Vercel — memória do
 *  processo não valeria. */
import type { Client } from "@libsql/client";
import { INTERVALO_NOMINATIM_MS, VALIDADE_DA_RESPOSTA_S } from "@/lib/nominatim";

/** O JSON cru guardado, ou `null` se não há ou tem mais de 30 dias (ausente). */
export async function respostaGuardada(client: Client, chave: string, agoraS: number): Promise<string | null> {
  const r = await client.execute({
    sql: `SELECT resposta FROM nominatim_respostas WHERE chave = ? AND em > ?`,
    args: [chave, agoraS - VALIDADE_DA_RESPOSTA_S],
  });
  return r.rows.length ? String(r.rows[0].resposta) : null;
}

/** Sobrescreve (a velha vira a nova). */
export async function guardarResposta(client: Client, chave: string, resposta: string, agoraS: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO nominatim_respostas (chave, resposta, em) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET resposta = excluded.resposta, em = excluded.em`,
    args: [chave, resposta, agoraS],
  });
}

/** 🔴 A condição de corrida mora NO MESMO statement que grava: UM `UPDATE … WHERE
 *  ultima_ms <= ?`, e só `rowsAffected === 1` é a vez. Nunca "ler e depois
 *  gravar" — duas instâncias leriam o mesmo valor velho. */
export async function tomarVezDoNominatim(client: Client, agoraMs: number): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE nominatim_vez SET ultima_ms = ? WHERE id = 1 AND ultima_ms <= ?`,
    args: [agoraMs, agoraMs - INTERVALO_NOMINATIM_MS],
  });
  return r.rowsAffected === 1;
}
