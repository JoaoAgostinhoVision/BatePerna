import type { Client } from "@libsql/client";
import { gravarRelatoDoLugar, contarHoje, type TipoRelato } from "@/lib/db";

/** Grava o relato do "✓ Fui" PELA IDENTIDADE do lugar e devolve o placar do
 *  dia de ONDE ele foi gravado — ou `null`, sem gravar nada, quando `lugar` não
 *  é a identidade de lugar nenhum no ar (Tarefa 12b, I4 da auditoria).
 *
 *  🔴 O PLACAR É O DO ENDEREÇO DO `RETURNING`, nunca o do pedido: o relato de P
 *  contado em `A` grava onde P mora agora (`B`), e o "N foram hoje" que volta
 *  é o de P. */
export async function registrarConfirmacao(
  client: Client,
  lugar: number,
  tipo: TipoRelato,
  agora: number,
): Promise<{ foram: number; barro: number } | null> {
  const onde = await gravarRelatoDoLugar(client, lugar, tipo, agora);
  return onde === null ? null : contarHoje(client, onde, agora);
}
