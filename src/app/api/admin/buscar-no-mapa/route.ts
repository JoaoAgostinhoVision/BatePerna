import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { respostaDaBusca } from "@/lib/resposta-da-busca";

export const dynamic = "force-dynamic";

/** A BUSCA NO MAPA DO PAINEL (17/10, Task 5): `GET ?q=` → os achados do
 *  Nominatim (`AchadoNoMapa[]`), pra caixa que só MOVE o mapa do ponto. A
 *  ordem das guardas é a das rotas irmãs: config → sessão → busca. Painel
 *  desligado é 404 (não anuncia que existe), sem sessão é 401, e nos dois
 *  NENHUMA busca sai. O resto (vazio, teto, falha) mora em `respostaDaBusca`. */
export async function GET(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });
  return respostaDaBusca(new URL(req.url).searchParams.get("q"));
}
