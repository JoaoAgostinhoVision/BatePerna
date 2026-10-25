"use client";
import { useEffect } from "react";
import { esquecerFuis, lerFuis } from "@/lib/fui-no-aparelho";

/** LEVA PRA CONTA AS IDAS ANOTADAS NO APARELHO (25/10, o perfil dela). O "✓ Fui"
 *  da ficha pública anota onde e quando ela foi (`fui-no-aparelho`); aqui, na
 *  área dela e logada, a lista sobe (`/api/contribuir/fui`) e sai do aparelho.
 *  Se alguma ida entrou na conta, a página recarrega UMA vez pra mostrá-la.
 *  Falha de rede ou de sessão: a lista fica, e sobe na próxima visita. Não
 *  desenha nada. */
export default function SobeOsFuis() {
  useEffect(() => {
    const itens = lerFuis();
    if (itens.length === 0) return;
    let vivo = true;
    void (async () => {
      let r: Response;
      try {
        r = await fetch("/api/contribuir/fui", { method: "POST", body: JSON.stringify({ itens }) });
      } catch {
        return;
      }
      if (!r.ok) return;
      let gravados = 0;
      try {
        gravados = Number(((await r.json()) as { gravados?: unknown }).gravados) || 0;
      } catch {
        return; // 2xx sem o corpo da rota (portal cativo): não subiu
      }
      esquecerFuis(itens);
      if (gravados > 0 && vivo) location.reload();
    })();
    return () => { vivo = false; };
  }, []);
  return null;
}
