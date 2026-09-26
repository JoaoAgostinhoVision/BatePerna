"use client";
import { useState } from "react";
import type { Ficha } from "@/types/ficha";

// PENDENTE: redação minha, o João ainda não leu
const TITULO = "A sua voz";
// PENDENTE: redação minha, o João ainda não leu
const AJUDA = "É o que só quem já foi sabe. Aparece entre aspas na ficha.";
// PENDENTE: redação minha, o João ainda não leu
const ERRO_GRAVAR = "Não consegui salvar.";
// PENDENTE: redação minha, o João ainda não leu
const ERRO_REDE = "Sem rede.";

type Props = { ficha: Ficha };

/** O editor da `voz` — o primeiro campo que o dono pode mudar do celular
 *  (Task 6, 2026-09-26). Mesmo padrão de `CaixaDeSenha` e do formulário de
 *  aviso em `PainelAdmin`: estado local, `PUT` na rota, `location.reload()`
 *  no sucesso pra tela vir da fonte nova (o banco), nunca de estado otimista.
 *
 *  🔴 NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui — só `ficha.voz`, que
 *  chega por prop. Este componente serve QUALQUER lugar; a voz de um lugar só
 *  é de um lugar só. */
export default function EditorDeVoz({ ficha }: Props) {
  const [valor, setValor] = useState(ficha.voz);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/ficha", {
        method: "PUT",
        body: JSON.stringify({ slug: ficha.slug, campo: "voz", valor }),
      });
      if (r.ok) { location.reload(); return; }
      setErro(ERRO_GRAVAR);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="adm-voz" data-editor-voz={ficha.slug}>
      <h2>{TITULO}</h2>
      <p className="adm-ajuda">{AJUDA}</p>
      <textarea
        aria-label={TITULO}
        data-voz={ficha.slug}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <button type="button" data-salvar-voz={ficha.slug} disabled={salvando} onClick={() => salvar()}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </section>
  );
}
