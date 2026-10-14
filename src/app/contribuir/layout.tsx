import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkConfigurado } from "@/lib/clerk-configurado";

/** O CLERK NO NAVEGADOR, SÓ NAS TELAS DE QUEM MANDA UM LUGAR (ruling do
 *  controlador na revisão da Task 13, feito na Task 14, por cima da decisão "Clerk sem `<ClerkProvider>`"
 *  do plano, e SÓ aqui).
 *
 *  🔴 POR QUÊ: a sessão do Clerk vive ~60 s. O `clerkMiddleware` só a renova
 *  (pelo handshake) em navegação de DOCUMENTO, nunca num `fetch()`. Sem o
 *  clerk-js no navegador, todo Salvar/Publicar feito mais de um minuto depois
 *  de a página abrir voltava 401, o `recarregarSe401` do formulário recarregava
 *  a tela, e ela perdia o que tinha digitado. O provedor carrega o clerk-js, e
 *  é ele que mantém o cookie da sessão fresco enquanto ela está aqui.
 *
 *  🔴 SÓ NESTE LAYOUT: o app público não carrega Clerk nenhum (era a razão do
 *  plano), e `tests/lib/clerk-so-numa-porta.test.ts` trava que este é o único
 *  arquivo de tela que importa `@clerk/*`.
 *
 *  🔴 SEM AS CHAVES (testes, `npm run build`, produção antes de o João instalar
 *  a integração) o provedor estouraria pela falta da chave pública — 500 cru.
 *  Aí as telas descem SEM ele, e a porta das páginas (`quemNaTela`) mostra a
 *  frase do Clerk fora. A decisão é a MESMA do middleware (`clerkConfigurado`).
 *
 *  ⚠️ A renovação em si não tem prova aqui: só se mede com chave de verdade, no
 *  ar (conferir-no-ar, depois do deploy). */
export default function LayoutDeQuemContribui({ children }: { children: ReactNode }) {
  if (!clerkConfigurado()) return children;
  return <ClerkProvider>{children}</ClerkProvider>;
}
