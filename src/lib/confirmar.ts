import type { Client } from "@libsql/client";
import { insertConfirmacao, contarHoje, type TipoRelato } from "@/lib/db";

export async function registrarConfirmacao(
  client: Client,
  slug: string,
  tipo: TipoRelato,
  agora: number,
): Promise<{ foram: number; barro: number }> {
  await insertConfirmacao(client, slug, agora, tipo);
  return contarHoje(client, slug, agora);
}
