import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { comPrazo } from "@/lib/cache-rotas";
import { PONTO, obrigatoriosDaPessoaFaltando } from "@/lib/campos-da-pessoa";
import { getClient, type Rascunho } from "@/lib/db";
import { lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE } from "@/lib/par-de-lugar";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { cidadeDoDoc, nomeComCidade, nomeDoRascunho } from "@/lib/rascunho";
import TelaDePublicar from "../../../admin/TelaDePublicar";
import { ROTAS } from "../../../admin/novo/enderecos";
import { PERGUNTAS } from "../../../admin/novo/perguntas";
import { TITULO_MANDAR } from "../../palavras";
import { ORDEM_DA_PESSOA } from "../../perguntas";
import { quemNaTela } from "../../sessao";
import "../../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo do rascunho dela");

/** `/contribuir/novo/publicar?slug=S` — a tela de publicar o rascunho DELA, no
 *  molde de `/admin/novo/publicar`. Rascunho que não é dela é 404.
 *
 *  🔴 O QUE FALTA É PELA RÉGUA DELA (`obrigatoriosDaPessoaFaltando`, a mesma
 *  que a porta de publicar dela usa), e cada item leva às perguntas DELA
 *  (`ROTAS.contribuir.pergunta`), na posição da lista DELA — nunca ao
 *  `enderecoDaPergunta` do painel (achado da revisão da Task 13). Em ordem de
 *  pergunta: o ponto (que a régua põe no fim) vem no 2º lugar, onde ela o vê.
 *  🔴 E A CIDADE QUE FALTA LEVA AO PONTO (17/10): ela não é pergunta — sai do
 *  ponto que ela marca —, então o caminho pra ela é gravar o ponto de novo.
 *  Uma linha só, mesmo quando faltam os dois.
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
  const caminhos = new Set(
    obrigatoriosDaPessoaFaltando(doc).map((c) => (c === PONTO || c === CAMPO_DA_CIDADE ? "trajeto.waypoints.0.lat" : c)),
  );
  const faltam = [...caminhos]
    .map((caminho) => {
      const n = ORDEM_DA_PESSOA.indexOf(caminho) + 1;
      return { n, texto: PERGUNTAS[caminho] ?? caminho, href: ROTAS.contribuir.pergunta(slug, n) };
    })
    .sort((a, b) => a.n - b.n)
    .map(({ texto, href }) => ({ texto, href }));

  return (
    <main className="adm">
      <h1>{TITULO_MANDAR}</h1>
      <p className="adm-publicar-nome">{nomeComCidade(nomeDoRascunho(r.doc, slug), cidadeDoDoc(r.doc))}</p>
      <TelaDePublicar slug={slug} atualizadoEm={r.atualizado_em} frases={[]} faltam={faltam} onde="contribuir" />
    </main>
  );
}
