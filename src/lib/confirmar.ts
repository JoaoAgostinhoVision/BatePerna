import type { Client } from "@libsql/client";
import { insertConfirmacao, countConfirmacoes, type TipoRelato } from "@/lib/db";

export async function registrarConfirmacao(
  client: Client,
  slug: string,
  agora: number,
  tipo: TipoRelato = "seco",
): Promise<{ count: number }> {
  await insertConfirmacao(client, slug, agora, tipo);
  return { count: await countConfirmacoes(client, slug) };
}
