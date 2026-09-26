"use client";
import { useState } from "react";
import type { FichaVersao } from "@/lib/db";

// PENDENTE: redação minha, o João ainda não leu
const TITULO = "Histórico da voz";
// PENDENTE: redação minha, o João ainda não leu
const AUTOR = { painel: "você, pelo painel", semente: "acervo original" } as const;
// PENDENTE: redação minha, o João ainda não leu
const VOLTAR = "voltar a esta";
// PENDENTE: redação minha, o João ainda não leu
const VOLTANDO = "Voltando…";
// PENDENTE: redação minha, o João ainda não leu
const ERRO_VOLTAR = "Não consegui voltar a esta versão.";

type Props = { versoes: FichaVersao[] };

/** A voz que um documento de versão guarda — nunca lança: uma linha antiga
 *  que não parseia mostra vazio em vez de derrubar a lista inteira. */
function vozDaVersao(doc: string): string {
  try {
    const v = (JSON.parse(doc) as { voz?: unknown }).voz;
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function dataHora(criadoEm: number): string {
  return new Date(criadoEm * 1000).toLocaleString("pt-BR");
}

/** O histórico do que já foi dito sobre UM lugar, e o botão que volta a uma
 *  versão antiga (Task 7, 2026-09-26). "Voltar" GRAVA uma versão nova com o
 *  conteúdo velho — nunca apaga nada; `ficha_versoes` é append-only (ver
 *  `src/lib/db.ts`).
 *
 *  🔴 O AUTOR É POR LINHA, não um rótulo fixo — é a procedência de cada
 *  versão, e procedência é a razão desta tabela existir.
 *
 *  🔴 NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui — `versoes` chega por
 *  prop, como `ficha` chega em `EditorDeVoz`. Este componente serve QUALQUER
 *  lugar. */
export default function HistoricoDaVoz({ versoes }: Props) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [voltando, setVoltando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function voltar(slug: string, versaoId: number) {
    if (voltando != null) return;
    setErro(null);
    setVoltando(versaoId);
    try {
      const r = await fetch("/api/admin/ficha", {
        method: "PUT",
        body: JSON.stringify({ slug, versaoId }),
      });
      if (r.ok) { location.reload(); return; }
      setErro(ERRO_VOLTAR);
    } catch {
      setErro(ERRO_VOLTAR);
    } finally {
      setVoltando(null);
    }
  }

  return (
    <section className="adm-historico" data-historico>
      <h2>{TITULO}</h2>
      <ul>
        {versoes.map((v) => (
          <li key={v.id} data-versao={v.id}>
            <button type="button" data-abrir-versao={v.id} onClick={() => setAberta(aberta === v.id ? null : v.id)}>
              {dataHora(v.criado_em)} — {AUTOR[v.autor]}
            </button>
            {aberta === v.id && (
              <div className="adm-historico-item">
                <p>{vozDaVersao(v.doc)}</p>
                <button
                  type="button"
                  data-voltar-versao={v.id}
                  disabled={voltando != null}
                  onClick={() => voltar(v.ficha_slug, v.id)}
                >
                  {voltando === v.id ? VOLTANDO : VOLTAR}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </section>
  );
}
