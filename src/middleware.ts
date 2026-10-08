import { clerkMiddleware } from "@clerk/nextjs/server";

/** O CLERK SÓ NAS ROTAS DE QUEM CONTRIBUI (spec de 07/10). Ele não PROTEGE
 *  nada aqui — quem decide 401 é cada rota, por `lerContribuidor` —, só deixa
 *  a sessão legível. Fora deste `matcher`, o Clerk nem é chamado: com ele fora
 *  do ar, o app público e o painel do João seguem de pé. */
export default clerkMiddleware();

export const config = {
  matcher: ["/contribuir", "/contribuir/:path*", "/api/contribuir/:path*"],
};
