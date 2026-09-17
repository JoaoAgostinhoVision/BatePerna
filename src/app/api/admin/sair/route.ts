import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, cookieDeSessao } from "@/lib/admin-guarda";

export const dynamic = "force-dynamic";

/** Falha fechada também na saída: com o painel desligado, /sair não pode
 *  responder diferente de /entrar. O que vazaria não é o cookie — apagar um
 *  cookie que talvez nem exista não revela nada por si só — é o STATUS CODE:
 *  um 200 aqui contra o 404 do resto de /api/admin/* já denuncia "existe uma
 *  feature de admin aqui", exatamente o que "falha fechada, sempre" esconde. */
export async function POST(): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  return new Response("", {
    status: 200,
    headers: {
      "set-cookie": cookieDeSessao("", 0),
      "cache-control": "no-store",
    },
  });
}
