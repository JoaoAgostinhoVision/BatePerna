/** O AVISO DE NOME QUE JÁ EXISTE NA CIDADE (17/10, Task 4) — componente de
 *  SERVIDOR (sem `"use client"`): a página das perguntas o calcula a cada carga
 *  (`travaDoPainel` / `travaDaPessoa`) e o passa PRONTO ao `FormularioDeLugar`
 *  (um ReactNode atravessa a fronteira de cliente; uma função não). Nada volta
 *  no corpo do PUT. A frase chega por prop: a do painel nomeia quem ocupa, a
 *  dela não nomeia ninguém (I3 de 07/10) — quem escolhe é a página.
 *
 *  `<p role="status">` e não um alerta: ela pode seguir respondendo, só o
 *  publicar fica travado. O link leva à pergunta do nome, onde se corrige. */
// PENDENTE: redação minha, o João ainda não leu
export const CORRIGIR_O_NOME = "Corrigir o nome";

export default function AvisoDoPar({ frase, corrigir }: { frase: string; corrigir: string }) {
  return (
    <p className="adm-aviso-par" role="status">
      {frase} <a href={corrigir}>{CORRIGIR_O_NOME}</a>
    </p>
  );
}
