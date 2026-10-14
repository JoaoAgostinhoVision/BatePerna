"use client";
import { useContext, useRef, useState } from "react";
import BotaoBloquear from "./BotaoBloquear";
import { ERRO_GRAVAR, ERRO_REDE, VersaoDaTela, comBase } from "./campos/gravar";
import { quandoRecife } from "./SecaoNaoConferidos";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const MANDADO_POR = "Mandado por quem usa o app";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const CONFERI = "Conferi";
/** O 2º toque do "Conferi". Dizia "A marca sai do ar" — meio falsa enquanto a
 *  meia-linha da regra padrão ficava no carimbo depois do Conferi; a proposta
 *  da revisão nomeia o que sai (a etiqueta e a faixa), e ele aprovou em 13/10,
 *  na mesma onda em que mandou tirar a meia-linha. */
// LIDA: proposta aprovada pelo João no pacote de copy em 2026-10-13.
export const CONFERI_MESMO = "Conferi mesmo? A etiqueta e a faixa saem do ar, e quem mandou não edita mais.";

/** QUEM MANDOU ESTE LUGAR, e o "Conferi" em dois toques (spec de 07/10, Parte
 *  3). Mesmo molde do `BotaoDesistir`: o 1º toque pede confirmação, o 2º grava;
 *  no sucesso a tela se relê do banco (`location.reload()`), nunca estado
 *  otimista. O `baseId` é a versão que a página abriu (`VersaoDaTela`).
 *
 *  🔴 A TRAVA DO DUPLO ENVIO É UM `useRef`, pela razão medida no
 *  `BotaoDesistir` (M2 da revisão da Tarefa 15): um 2º clique antes do redesenho
 *  ainda vê o `indo` velho. Aqui um 2º POST seria só um 409 inofensivo (o
 *  `UPDATE` exige `conferido <> 1`), mas a frase do 409 apareceria por cima de
 *  um sucesso. Na recusa, a frase é a da PORTA (`NAO_CONFERIU`); corpo vazio
 *  (sessão vencida, corpo torto) cai no `ERRO_GRAVAR` do painel.
 *
 *  O "Bloquear quem mandou" (Task 15) mora aqui também, depois do "Conferi", e
 *  aparece com o lugar conferido ou não: bloquear esconde TODOS os lugares
 *  dela, conferidos inclusive. `contribuidor` é o id de quem mandou (de
 *  `origem_do_lugar`); `bloqueado`, a linha dela em `contribuidores`. */
export default function CaixaDaOrigem({
  slug, quem, email, mandadoEm, conferido, contribuidor, bloqueado,
}: {
  slug: string; quem: string | null; email: string | null; mandadoEm: number | null; conferido: boolean;
  contribuidor: string; bloqueado: boolean;
}) {
  const baseId = useContext(VersaoDaTela);
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  async function conferir(): Promise<void> {
    if (!confirmando) { setConfirmando(true); return; }
    if (emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/conferir", { method: "POST", body: JSON.stringify(comBase({ slug }, baseId)) });
      if (r.ok) { location.reload(); return; }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      emVoo.current = false;
      setIndo(false);
    }
  }

  return (
    <section className="adm-origem" data-origem={slug}>
      <p className="adm-origem-titulo">{MANDADO_POR}</p>
      {(quem || email) && <p className="adm-quem">{[quem, email].filter(Boolean).join(" · ")}</p>}
      {/* Sem a data (o histórico não foi lido), cala — nunca "01/01/1970". */}
      {mandadoEm !== null && <time dateTime={new Date(mandadoEm * 1000).toISOString()}>{quandoRecife(mandadoEm)}</time>}
      {!conferido && (
        <button type="button" disabled={indo} onClick={conferir}>
          {confirmando ? CONFERI_MESMO : CONFERI}
        </button>
      )}
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
      <BotaoBloquear contribuidor={contribuidor} bloqueado={bloqueado} />
    </section>
  );
}
