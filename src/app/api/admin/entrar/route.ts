import { lerConfigAdmin } from "@/lib/admin-config";
import { cookieDeSessao } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao, senhaConfere } from "@/lib/admin-sessao";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  // 🔴 404, não 401: painel desligado não anuncia que existe.
  if (!cfg.ligado) return new Response("", { status: 404 });

  let senha: unknown;
  try {
    senha = (await req.json())?.senha;
  } catch {
    senha = undefined;
  }
  if (typeof senha !== "string" || !senhaConfere(cfg.senha, senha)) {
    return new Response("", { status: 401 });
  }

  const agora = Math.floor(Date.now() / 1000);
  const token = criarSessao(cfg.segredo, agora, DURACAO_SESSAO_S);
  return new Response("", {
    status: 200,
    headers: {
      "set-cookie": cookieDeSessao(token, DURACAO_SESSAO_S),
      "cache-control": "no-store",
    },
  });
}
