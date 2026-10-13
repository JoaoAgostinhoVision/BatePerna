import Link from "next/link";
import type { Metadata } from "next";
import { getClient } from "@/lib/db";
import { lugaresDaPessoa, rascunhosDaPessoa } from "@/lib/db-contribuidor";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";
import { ESCONDIDO } from "../admin/campos/palavras";
import { TITULO_RASCUNHOS } from "../admin/ListaDeLugares";
import { CONFERIDO, MANDAR_UM_LUGAR_NOVO, MUDAR, TITULO_MEUS } from "./palavras";
import { quemNaTela } from "./sessao";
import "../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** `/contribuir` — "MEUS LUGARES" (spec de 07/10, Parte 1; I5 da pré-auditoria).
 *  É onde o "+ mandar um lugar" da barra leva, e é daqui que ela manda um novo:
 *  o link do topo vai às perguntas. Embaixo, os lugares que ela publicou (com a
 *  marca, e o "mudar" enquanto o BatePerna não conferiu) e os rascunhos dela.
 *  É o destino de toda frase que manda "voltar pela sua lista de lugares"
 *  (`RASCUNHO_DELA_SUMIU`, `JA_NO_AR_DA_PESSOA`).
 *
 *  Fora da varredura da marca (Task 5) de propósito: não é superfície pública
 *  — exige login, e é dela sobre os lugares DELA. */
export default async function MeusLugares() {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const [lugares, rascunhos] = await Promise.all([
    lugaresDaPessoa(getClient(), quem.pessoa.id),
    rascunhosDaPessoa(getClient(), quem.pessoa.id),
  ]);
  return (
    <main className="adm">
      <h1>{TITULO_MEUS}</h1>
      {/* 🔴 I5: o PRIMEIRO link da tela. A barra traz a pessoa pra cá, e é
          daqui que se manda um lugar novo — com ou sem lugares na lista. */}
      <Link href="/contribuir/novo" className="adm-novo-link">{MANDAR_UM_LUGAR_NOVO}</Link>
      {lugares.length > 0 && (
        <ul className="adm-lista" data-testid="meus-lugares">
          {lugares.map((l) => (
            <li key={l.slug} className="adm-item" data-lugar={l.slug}>
              {/* O link do lugar vai pra página PÚBLICA dele — onde ela vê a
                  marca, como todo mundo. */}
              <a href={`/${l.slug}`} className="adm-item-link">
                <span className="adm-item-nome">
                  {nomeDoRascunho(l.doc, l.slug)}
                  {cidadeDoDoc(l.doc) && <span className="adm-item-cidade">{cidadeDoDoc(l.doc)}</span>}
                </span>
              </a>
              <span className="adm-item-marca">{l.conferido ? CONFERIDO : ETIQUETA_NAO_CONFERIDO}</span>
              {l.oculto && <span className="adm-marca-escondido">{ESCONDIDO}</span>}
              {!l.conferido && <Link href={`/contribuir/${l.slug}`}>{MUDAR}</Link>}
            </li>
          ))}
        </ul>
      )}
      {rascunhos.length > 0 && (
        <section className="adm-rascunhos" data-testid="rascunhos">
          <h2 className="adm-rascunhos-titulo">{TITULO_RASCUNHOS}</h2>
          <ul className="adm-lista">
            {rascunhos.map((r) => (
              <li key={r.slug} className="adm-item" data-rascunho={r.slug}>
                <Link href={`/contribuir/novo?slug=${encodeURIComponent(r.slug)}`} className="adm-item-link">
                  <span className="adm-item-nome">{nomeDoRascunho(r.doc, r.slug)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
