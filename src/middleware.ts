import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkConfigurado } from "@/lib/clerk-configurado";

/** O CLERK SÓ NAS ROTAS DE QUEM CONTRIBUI (spec de 07/10). Ele não PROTEGE
 *  nada aqui — quem decide 401 é cada rota, por `lerContribuidor` —, só deixa
 *  a sessão legível. Fora deste `matcher`, o Clerk nem é chamado: com ele fora
 *  do ar, o app público e o painel do João seguem de pé. */

const comClerk = clerkMiddleware();

/** Sem as duas chaves, deixa passar sem chamar o Clerk — quem decide é
 *  `clerkConfigurado` (`src/lib/clerk-configurado.ts`, o único ponto, e o
 *  porquê mora lá). */

export default function middleware(pedido: NextRequest, evento: NextFetchEvent) {
  if (!clerkConfigurado()) return NextResponse.next();
  return comClerk(pedido, evento);
}

export const config = {
  matcher: ["/contribuir", "/contribuir/:path*", "/api/contribuir/:path*"],
};
