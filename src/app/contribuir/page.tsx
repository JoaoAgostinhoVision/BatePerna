import Link from "next/link";
import type { Metadata } from "next";
import { getClient } from "@/lib/db";
import { fuiDaPessoa, lugaresDaPessoa, rascunhosDaPessoa } from "@/lib/db-contribuidor";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";
import { ESCONDIDO } from "../admin/campos/palavras";
import { TITULO_RASCUNHOS } from "../admin/ListaDeLugares";
import { CONFERIDO, FOI_EM, FUI_VAZIO, MANDAR_UM_LUGAR_NOVO, MUDAR, TITULO_FUI, TITULO_MEUS, TITULO_VOCE } from "./palavras";
import SobeOsFuis from "./SobeOsFuis";
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
/** O dia da ida, em Recife, só números: 19/10/2025. */
const diaDaIda = (s: number): string =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(s * 1000));

export default async function MeusLugares() {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const [lugares, rascunhos, idas] = await Promise.all([
    lugaresDaPessoa(getClient(), quem.pessoa.id),
    rascunhosDaPessoa(getClient(), quem.pessoa.id),
    fuiDaPessoa(getClient(), quem.pessoa.id),
  ]);
  return (
    <main className="adm">
      <h1>{TITULO_VOCE}</h1>
      {/* 🔴 I5: o PRIMEIRO link da tela. A barra traz a pessoa pra cá, e é
          daqui que se manda um lugar novo — com ou sem lugares na lista. */}
      <Link href="/contribuir/novo" className="adm-novo-link">{MANDAR_UM_LUGAR_NOVO}</Link>
      {/* O PERFIL DELA (25/10): onde ela já foi, pelo "✓ Fui" anotado no
          aparelho e levado pra conta pelo `SobeOsFuis`. */}
      <SobeOsFuis />
      <section className="adm-rascunhos adm-fui" data-testid="onde-ja-foi">
        <h2 className="adm-rascunhos-titulo">{TITULO_FUI}</h2>
        {idas.length === 0 ? (
          <p className="adm-novo-aviso">{FUI_VAZIO}</p>
        ) : (
          <ul className="adm-lista">
            {idas.map((i) => (
              <li key={i.slug} className="adm-item" data-fui={i.slug}>
                <a href={`/${i.slug}`} className="adm-item-link">
                  <span className="adm-item-nome">
                    {nomeDoRascunho(i.doc, i.slug)}
                    {cidadeDoDoc(i.doc) && <span className="adm-item-cidade">{cidadeDoDoc(i.doc)}</span>}
                  </span>
                </a>
                <span className="adm-fui-quando">{FOI_EM} {diaDaIda(i.em)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2 className="adm-rascunhos-titulo">{TITULO_MEUS}</h2>
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
