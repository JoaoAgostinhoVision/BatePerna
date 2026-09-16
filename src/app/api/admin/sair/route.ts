import { COOKIE_ADMIN } from "@/lib/admin-guarda";

export const dynamic = "force-dynamic";

/** Sair sempre funciona, inclusive com o painel desligado: apagar um cookie
 *  não revela nada e não pode depender de configuração. */
export async function POST(): Promise<Response> {
  return new Response("", {
    status: 200,
    headers: {
      "set-cookie": `${COOKIE_ADMIN}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      "cache-control": "no-store",
    },
  });
}
