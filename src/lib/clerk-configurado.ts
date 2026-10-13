/** 🔴 O ÚNICO PONTO que decide se o Clerk está configurado — lido pelo
 *  `src/middleware.ts` e pelo layout de `/contribuir`. Mora num módulo NEUTRO
 *  (sem `@clerk/*`) porque os dois o usam e o layout não deve puxar o middleware.
 *
 *  O `clerkMiddleware` (7.9.12, `dist/cjs/server/clerkMiddleware.js:48-55`)
 *  confere as duas chaves no COMEÇO de cada pedido e estoura sem elas — o
 *  pedido morreria em 500 cru, antes da rota. Sem as duas, o middleware deixa
 *  passar SEM chamar o Clerk; aí o `auth()` do adaptador estoura (o middleware
 *  dele não rodou), vira `ClerkFora`, e a rota responde 503 com frase: só a
 *  contribuição para. E o `<ClerkProvider>` do layout estouraria sem a chave
 *  pública: sem as duas, as telas descem sem ele, e mostram a frase do Clerk
 *  fora.
 *  Atenção: o Next troca `process.env.NEXT_PUBLIC_*` pelo valor na hora do
 *  BUILD — ligar a chave depois de um deploy exige um build novo. */
export function clerkConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}
