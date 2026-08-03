import type { Client } from "@libsql/client";
import { insertConfirmacao, countConfirmacoes } from "@/lib/db";

export async function registrarConfirmacao(
  client: Client,
  slug: string,
  agora: number,
): Promise<{ count: number }> {
  await insertConfirmacao(client, slug, agora);
  return { count: await countConfirmacoes(client, slug) };
}
