"use client";
import { useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";
import { ESCONDER, ESCONDIDO, MOSTRAR_DE_NOVO, SALVANDO } from "./campos/palavras";

type Props = { slug: string; oculto: boolean };

/** ESCONDER UM LUGAR DO PÚBLICO, E MOSTRÁ-LO DE NOVO (Task 9, 2026-10-01) — o
 *  botão da porta que a Task 4 abriu (`POST /api/admin/visibilidade`, corpo
 *  `{ slug, oculto }`).
 *
 *  🔴 NADA AQUI APAGA, E NENHUMA PALAVRA DIZ ISSO. Esconder grava uma VERSÃO
 *  NOVA em `ficha_versoes` (append-only) com o mesmo documento e `oculto`
 *  ligado; mostrar de novo grava outra com ele desligado. Por isso não há
 *  "tem certeza?": a ação se desfaz com o mesmo botão, um toque.
 *
 *  🔴 O MOLDE É O DOS EDITORES (`campos/gravar.ts`): no sucesso,
 *  `location.reload()` — a tela vem do banco, nunca de estado otimista. Um
 *  botão que trocasse o próprio rótulo sozinho afirmaria que o lugar saiu do ar
 *  sem ter lido isso do banco. E as frases de erro são as MESMAS dos editores
 *  (`ERRO_GRAVAR`, `ERRO_REDE`): a porta responde corpo vazio em toda recusa,
 *  então não há português dela pra mostrar.
 *
 *  ⚠️ NÃO usa `usarGravacao` porque aquele hook fala com `/api/admin/ficha` por
 *  `PUT`; esta porta é outra, por `POST`. Generalizá-lo por um botão só seria
 *  mexer nos sete editores por nada. */
export default function BotaoVisibilidade({ slug, oculto }: Props) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar() {
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/visibilidade", {
        method: "POST",
        body: JSON.stringify({ slug, oculto: !oculto }),
      });
      if (r.ok) { location.reload(); return; }
      setErro(ERRO_GRAVAR);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <section className="adm-visibilidade" data-visibilidade={oculto ? "escondido" : "no-ar"}>
      {oculto && <p className="adm-marca-escondido">{ESCONDIDO}</p>}
      <button type="button" disabled={indo} onClick={trocar}>
        {indo ? SALVANDO : oculto ? MOSTRAR_DE_NOVO : ESCONDER}
      </button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </section>
  );
}
