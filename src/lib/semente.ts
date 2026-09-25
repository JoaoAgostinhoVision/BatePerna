import type { Client } from "@libsql/client";
import { gravarVersao, versoesAtuais } from "@/lib/db";
import type { Ficha } from "@/types/ficha";

/** Põe no banco as fichas que ainda não estão lá, e SÓ essas.
 *
 *  🔴 IDEMPOTENTE, e isto é a coisa inteira. A semente roda uma vez, mas
 *  alguém vai rodá-la de novo — por engano, ou porque o primeiro deploy morreu
 *  no meio. Regravar não violaria o append-only (nada seria apagado), e ainda
 *  assim o texto que o João escreveu pelo painel sumiria da tela: a semente
 *  viraria a versão de maior `id`, que é a que o app mostra. */
export async function semear(
  client: Client, fichas: Ficha[], agora: number,
): Promise<{ semeados: string[]; pulados: string[] }> {
  const jaTem = await versoesAtuais(client);
  const semeados: string[] = [];
  const pulados: string[] = [];
  for (const f of fichas) {
    if (jaTem.has(f.slug)) { pulados.push(f.slug); continue; }
    await gravarVersao(client, f.slug, JSON.stringify(f), "semente", agora);
    semeados.push(f.slug);
  }
  return { semeados, pulados };
}
