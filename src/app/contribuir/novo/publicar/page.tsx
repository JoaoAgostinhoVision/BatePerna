import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, type Rascunho } from "@/lib/db";
import { lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { travaDaPessoa } from "@/lib/par-de-lugar";
import { NOME_EXISTE_NA_CIDADE } from "@/lib/porta-da-pessoa";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { cidadeDoDoc, nomeComCidade, nomeDoRascunho } from "@/lib/rascunho";
import RevisaoDoLugar from "../../../admin/RevisaoDoLugar";
import TelaDePublicar from "../../../admin/TelaDePublicar";
import { ROTAS } from "../../../admin/novo/enderecos";
import { montarRevisao } from "../../../admin/novo/revisao";
import { TITULO_MANDAR } from "../../palavras";
import { montarPerguntasDaPessoa } from "../../perguntas";
import { quemNaTela } from "../../sessao";
import "../../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo do rascunho dela");

/** `/contribuir/novo/publicar?slug=S` — a tela de publicar o rascunho DELA, no
 *  molde de `/admin/novo/publicar`. Rascunho que não é dela é 404.
 *
 *  🔴 A REVISÃO É PELAS PERGUNTAS DELA (`montarPerguntasDaPessoa`, com a
 *  obrigatoriedade dela), e cada "Corrigir" leva à pergunta DELA
 *  (`ROTAS.contribuir.corrigir`, com `volta=revisao`), na posição da lista
 *  DELA — nunca ao endereço do painel (achado da revisão da Task 13).
 *  🔴 E A CIDADE ENTRA LOGO DEPOIS DO PONTO (17/10): ela não é pergunta — sai do
 *  ponto que ela marca —, então o "Corrigir" dela é o do ponto, e a linha diz
 *  que falta quando o documento não a tem.
 *
 *  `frases={[]}`: o "o que o app vai calar" do painel fala de campos que ela nem
 *  viu — a página dela cala o que ela não respondeu, e o aviso de publicar dela
 *  já diz que o lugar vai marcado. */
export default async function PublicarDaPessoa({ searchParams }: { searchParams: Promise<{ slug?: string | string[] }> }) {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { slug } = await searchParams;
  if (typeof slug !== "string") notFound();

  const r = await comPrazo<Rascunho | null | typeof ESTOUROU>(
    lerRascunhoDaPessoa(getClient(), slug, quem.pessoa.id), PRAZO_FICHA_MS, ESTOUROU,
  );
  if (r === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do rascunho.");
  if (r === null) notFound();

  // Documento que não abre: tudo conta como sem resposta, e a porta recusa com
  // frase se ela tocar em publicar. A tela não estoura por isso.
  let doc: unknown = {};
  try {
    doc = JSON.parse(r.doc);
  } catch {
    // ver acima
  }
  // A frase do aviso do par é a DELA, que não nomeia o lugar que já existe (I3).
  const linhas = montarRevisao(montarPerguntasDaPessoa(doc), doc, {
    corrigir: (n) => ROTAS.contribuir.corrigir(slug, n),
    aviso: (await travaDaPessoa(r.doc)) ? NOME_EXISTE_NA_CIDADE : null,
  });

  return (
    <main className="adm">
      <h1>{TITULO_MANDAR}</h1>
      <p className="adm-publicar-nome">{nomeComCidade(nomeDoRascunho(r.doc, slug), cidadeDoDoc(r.doc))}</p>
      <RevisaoDoLugar linhas={linhas} />
      <TelaDePublicar slug={slug} atualizadoEm={r.atualizado_em} frases={[]} onde="contribuir" />
    </main>
  );
}
