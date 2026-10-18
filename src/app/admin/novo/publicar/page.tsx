import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lerRascunho, type Rascunho } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { oQueOAppCala } from "@/lib/o-que-o-app-cala";
import { travaDoPainel } from "@/lib/par-de-lugar";
import { cidadeDoDoc, nomeComCidade, nomeDoRascunho } from "@/lib/rascunho";
import CaixaDeSenha from "../../CaixaDeSenha";
import RevisaoDoLugar from "../../RevisaoDoLugar";
import TelaDePublicar from "../../TelaDePublicar";
import { ROTAS } from "../enderecos";
import { montarPerguntas } from "../perguntas";
import { montarRevisao } from "../revisao";
import "../../admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const TITULO_PUBLICAR = "Publicar lugar novo";

const ESTOUROU = Symbol("prazo do rascunho");

/** `/admin/novo/publicar?slug=S` — a tela de publicar o rascunho `S` (Tarefa
 *  12, R3 da auditoria de 06/10). Chega-se aqui pelo "Próxima" da última
 *  pergunta e pelo "publicar" do rascunho na lista do painel.
 *
 *  🔴 ESTA PÁGINA É DE SERVIDOR E É QUEM CONHECE O REGISTRO: `oQueOAppCala` (o
 *  que o app vai calar) e `montarPerguntas` (a revisão) leem
 *  `CAMPOS_DA_FICHA`; a `TelaDePublicar` (cliente) recebe só as frases prontas
 *  (G3 da auditoria). O First Load JS desta rota é medido no `npm run build`.
 *
 *  🔴 O `atualizado_em` QUE ESTA PÁGINA LEU desce junto: é a identidade do
 *  rascunho até o portão do banco (I1) — o que vai ao ar é o que esta tela
 *  mostrou, ou nada.
 *
 *  A ordem das guardas é a das páginas irmãs: config → sessão → banco. Slug sem
 *  rascunho é 404 (inclusive o de um lugar já no ar), e o banco que não responde
 *  a tempo é ERRO, como em `/admin/novo`. */
export default async function Publicar({ searchParams }: { searchParams: Promise<{ slug?: string | string[] }> }) {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    notFound();
  }

  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!sessaoValida(process.env, token, Math.floor(Date.now() / 1000))) {
    return (
      <main className="adm">
        <h1>Painel</h1>
        <CaixaDeSenha />
      </main>
    );
  }

  const { slug } = await searchParams;
  if (typeof slug !== "string") notFound();

  const r = await comPrazo<Rascunho | null | typeof ESTOUROU>(lerRascunho(getClient(), slug), PRAZO_FICHA_MS, ESTOUROU);
  if (r === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do rascunho.");
  if (r === null) notFound();

  // Documento que não abre: tudo conta como sem resposta, e a porta recusa com
  // frase se ele tocar em publicar. A tela não estoura por isso.
  let doc: unknown = {};
  try {
    doc = JSON.parse(r.doc);
  } catch {
    // ver acima
  }
  // A REVISÃO (17/10, Task 8): toda pergunta, uma por linha, com o "Corrigir"
  // que volta pra cá; a cidade entra depois do ponto e FALTA quando o rascunho
  // tem ponto e não tem cidade (dado de antes de ela sair do ponto) — por isso a
  // frase de recusa da porta, "estão listadas nesta tela", é verdadeira. O aviso
  // do par vai na linha do nome, e a chave provisória (`rascunho_…`) abre como
  // qualquer outra.
  const linhas = montarRevisao(montarPerguntas(doc), doc, {
    corrigir: (n) => ROTAS.painel.corrigir(slug, n),
    aviso: await travaDoPainel(r.doc, slug),
  });

  return (
    <main className="adm">
      <h1>Painel</h1>
      <h2>{TITULO_PUBLICAR}</h2>
      <p className="adm-publicar-nome">{nomeComCidade(nomeDoRascunho(r.doc, slug), cidadeDoDoc(r.doc))}</p>
      <RevisaoDoLugar linhas={linhas} />
      <TelaDePublicar slug={slug} atualizadoEm={r.atualizado_em} frases={oQueOAppCala(doc)} />
    </main>
  );
}
