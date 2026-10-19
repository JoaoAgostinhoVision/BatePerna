"use client";
import { useRef, useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";
import { BLOQUEAR, BLOQUEAR_MESMO, DESBLOQUEAR } from "./campos/palavras";

/** BLOQUEAR / DESBLOQUEAR QUEM MANDOU (Task 15 da rodada de 07/10), na caixa
 *  da origem. Molde do "Conferi" da `CaixaDaOrigem`: bloquear pede o 2º toque
 *  (o que diz que TODOS os lugares dela saem do ar); desbloquear é um toque só
 *  — desfaz só o bloqueio, nenhum lugar volta ao ar. No sucesso a tela se relê
 *  do banco (`location.reload()`), nunca estado otimista; a trava do duplo envio
 *  é um `useRef`, pela razão medida no `BotaoDesistir`. Na recusa, as frases do
 *  painel (`ERRO_GRAVAR`/`ERRO_REDE`): a rota não tem frase própria. */
export default function BotaoBloquear({ contribuidor, bloqueado }: { contribuidor: string; bloqueado: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  async function trocar(): Promise<void> {
    if (!bloqueado && !confirmando) { setConfirmando(true); return; }
    if (emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setIndo(true);
    // Só o sucesso liga (ver `usarGravacao`, em `campos/gravar.ts`): o `finally` não
    // pode religar o botão com a página saindo.
    let saindo = false;
    try {
      const r = await fetch("/api/admin/contribuidor", { method: "POST", body: JSON.stringify({ id: contribuidor, bloquear: !bloqueado }) });
      if (r.ok) { saindo = true; location.reload(); return; }
      setErro(ERRO_GRAVAR);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      if (!saindo) {
        emVoo.current = false;
        setIndo(false);
      }
    }
  }

  return (
    <>
      <button type="button" disabled={indo} onClick={trocar}>
        {bloqueado ? DESBLOQUEAR : confirmando ? BLOQUEAR_MESMO : BLOQUEAR}
      </button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </>
  );
}
