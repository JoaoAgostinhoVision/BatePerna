import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { clerkConfigurado } from "@/lib/clerk-configurado";
import { ENTRAR } from "@/lib/entrar";
import { CLERK_FORA_AO_ABRIR } from "@/lib/porta-da-pessoa";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** `/contribuir/entrar` — A TELA DE ENTRAR DENTRO DO APP (25/10). O Clerk
 *  desenha o formulário (em português, pelo `ptBR` do layout), na moldura do
 *  app; a mesma tela cria a conta (`withSignUp`). Depois de entrar ela volta
 *  pro endereço de onde veio (o `redirect_url` que o `redirectToSignIn`
 *  põe). Sem as chaves do Clerk o layout desce sem o provedor, e o `<SignIn>`
 *  estouraria: aí a frase do Clerk fora, como nas outras telas dela. */
export default function Entrar() {
  if (!clerkConfigurado()) return <main className="adm"><p className="adm-erro">{CLERK_FORA_AO_ABRIR}</p></main>;
  return (
    <main className="adm adm-entrar">
      <SignIn
        routing="path"
        path={ENTRAR}
        withSignUp
        appearance={{
          variables: { colorPrimary: "#A5522A", fontFamily: "inherit", borderRadius: "12px" },
          // Medido a 375 px no ar (25/10): o cartão do Clerk tem largura fixa e
          // passava da borda direita da moldura. Aqui ele ocupa a coluna.
          elements: { rootBox: { width: "100%" }, cardBox: { width: "100%", maxWidth: "100%" } },
        }}
      />
    </main>
  );
}
