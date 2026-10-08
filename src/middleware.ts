import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/** O CLERK SÓ NAS ROTAS DE QUEM CONTRIBUI (spec de 07/10). Ele não PROTEGE
 *  nada aqui — quem decide 401 é cada rota, por `lerContribuidor` —, só deixa
 *  a sessão legível. Fora deste `matcher`, o Clerk nem é chamado: com ele fora
 *  do ar, o app público e o painel do João seguem de pé. */

/** 🔴 O ÚNICO PONTO que decide se o Clerk está configurado. O `clerkMiddleware`
 *  (7.9.12, `dist/cjs/server/clerkMiddleware.js:48-55`) confere as duas chaves
 *  no COMEÇO de cada pedido e estoura sem elas — o pedido morreria em 500 cru,
 *  antes da rota. Sem as duas, o middleware deixa passar SEM chamar o Clerk; aí
 *  o `auth()` do adaptador estoura (o middleware dele não rodou), vira
 *  `ClerkFora`, e a rota responde 503 com frase: só a contribuição para.
 *  Atenção: o Next troca `process.env.NEXT_PUBLIC_*` pelo valor na hora do
 *  BUILD — ligar a chave depois de um deploy exige um build novo. */
export function clerkConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

const comClerk = clerkMiddleware();

export default function middleware(pedido: NextRequest, evento: NextFetchEvent) {
  if (!clerkConfigurado()) return NextResponse.next();
  return comClerk(pedido, evento);
}

export const config = {
  matcher: ["/contribuir", "/contribuir/:path*", "/api/contribuir/:path*"],
};
