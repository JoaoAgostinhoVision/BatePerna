/** O AVISO DE NOME QUE JÁ EXISTE NA CIDADE (17/10, Task 4) — a página das
 *  perguntas o calcula a cada carga (`travaDoPainel` / `travaDaPessoa`) e passa
 *  ao `FormularioDeLugar` só os DADOS dele (`{ frase, corrigir }`, raso, que
 *  atravessa a fronteira de cliente); é o formulário que o desenha, com este
 *  componente. Nada volta no corpo do PUT. A frase chega pronta: a do painel
 *  nomeia quem ocupa, a dela não nomeia ninguém (I3 de 07/10) — quem escolhe é a
 *  página.
 *
 *  `<p role="status">` e não um alerta: ela pode seguir respondendo, só o
 *  publicar fica travado. O link (`ROTAS[onde].corrigir`) leva à pergunta do
 *  nome, onde se corrige, e o seguir de lá volta à revisão. 🔴 O LINK CHEGA
 *  PRONTO (`link`), feito pelo `passo()` do formulário: é uma porta pra outra
 *  tela como "Anterior" e "Próxima", e com texto não salvo pede o mesmo segundo
 *  toque (revisão final de 18/10, I1 — até ali era um `<a>` simples, e quem
 *  tocava nele com texto na caixa o perdia). */
import type { ReactNode } from "react";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const CORRIGIR_O_NOME = "Corrigir o nome";

export default function AvisoDoPar({ frase, link }: { frase: string; link: ReactNode }) {
  return (
    <p className="adm-aviso-par" role="status">
      {frase} {link}
    </p>
  );
}
