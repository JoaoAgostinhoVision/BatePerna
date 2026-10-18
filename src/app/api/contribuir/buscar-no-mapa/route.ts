import { portaDaPessoa } from "@/lib/porta-da-pessoa";
import { respostaDaBusca } from "@/lib/resposta-da-busca";

export const dynamic = "force-dynamic";

/** A BUSCA NO MAPA DE QUEM USA (17/10, Task 5): a irmã de
 *  `/api/admin/buscar-no-mapa`, com a porta DELA — o Clerk, antes de qualquer
 *  busca. É leitura, então o 503 é a frase de ABRIR (`"abrir"`), como o `GET`
 *  do rascunho. Vazio, teto e falha: `respostaDaBusca`, a mesma das duas. */
export async function GET(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(Math.floor(Date.now() / 1000), "abrir");
  if ("resposta" in porta) return porta.resposta;
  return respostaDaBusca(new URL(req.url).searchParams.get("q"));
}
