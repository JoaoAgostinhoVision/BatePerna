"use client";
import { useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";

/** A TELA DE PUBLICAR (Tarefa 12) — o último passo do lugar novo: o que falta, o
 *  que o app vai calar, e o botão que põe o lugar no ar.
 *
 *  🔴 ESTE ARQUIVO É DE CLIENTE E NÃO CONHECE O REGISTRO (G3 da auditoria): as
 *  frases chegam PRONTAS por prop, montadas por `oQueOAppCala` na página de
 *  servidor (`/admin/novo/publicar`). Nenhum import daqui alcança
 *  `@/lib/campos-da-ficha`, o `fichaSchema` ou o zod — eles iriam pro celular.
 *
 *  🔴 CALAR É PERMITIDO: a lista do que o app vai calar existe pra o dono VER o
 *  preço da honestidade, e o botão NUNCA some nem trava por causa dela. Quem
 *  recusa (obrigatório faltando, par, coerência, endereço) é a porta
 *  (`POST /api/admin/publicar`), e a frase dela aparece aqui como chegou.
 *
 *  O pedido leva `atualizadoEm`, o `atualizado_em` do rascunho que a página leu:
 *  o que vai ao ar é o que esta tela mostrou, ou nada (I1 da auditoria). O botão
 *  fica desligado enquanto o pedido anda — o duplo toque (M4) não chega a sair.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: as frases e os pedidos
 *  chegam por prop, e as palavras fixas abaixo servem a todo lugar. */

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PUBLICAR = "Publicar";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PUBLICANDO = "Publicando…";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const AVISO_PUBLICAR = "Publicar põe este lugar no ar, pra quem abrir o app.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const TITULO_FALTA = "Antes de publicar, falta responder:";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const TITULO_CALA = "O que o app vai calar sobre este lugar:";

/** Uma pergunta obrigatória ainda sem resposta: o texto dela e o endereço da
 *  tela onde se responde. */
export type Falta = { texto: string; href: string };

export default function TelaDePublicar({
  slug,
  atualizadoEm,
  frases,
  faltam = [],
}: {
  slug: string;
  atualizadoEm: number;
  /** Uma por campo opcional sem resposta (`oQueOAppCala`, no servidor). */
  frases: readonly string[];
  /** As obrigatórias sem resposta, se houver — a porta recusaria publicar. */
  faltam?: readonly Falta[];
}) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function publicar(): Promise<void> {
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/publicar", { method: "POST", body: JSON.stringify({ slug, atualizadoEm }) });
      if (r.ok) {
        // O lugar já está no ar: o painel DELE, onde se edita lugar publicado.
        location.assign(`/admin/${encodeURIComponent(slug)}`);
        return;
      }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <section className="adm-publicar" data-rascunho={slug}>
      {faltam.length > 0 && (
        <div className="adm-publicar-falta" data-testid="falta">
          <p className="adm-publicar-titulo">{TITULO_FALTA}</p>
          <ul>
            {faltam.map((f) => (
              <li key={f.href}>
                <a href={f.href}>{f.texto}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {frases.length > 0 && (
        <div className="adm-publicar-cala" data-testid="cala">
          <p className="adm-publicar-titulo">{TITULO_CALA}</p>
          <ul>
            {frases.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="adm-publicar-aviso">{AVISO_PUBLICAR}</p>
      <button type="button" onClick={publicar} disabled={indo}>
        {indo ? PUBLICANDO : PUBLICAR}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}
