import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lerRascunho, type Rascunho } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import CaixaDeSenha from "../CaixaDeSenha";
import FormularioDeLugar, { ComecarLugarNovo } from "../FormularioDeLugar";
import { PERGUNTAS, escolherPosicao, montarPerguntas } from "./perguntas";
import "../admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

// PENDENTE: redação minha, o João ainda não leu
const TITULO_NOVO = "Lugar novo";

const ESTOUROU = Symbol("prazo do rascunho");

/** `/admin/novo` — o lugar novo (Tarefa 11).
 *
 *  Sem `?slug=`: a pergunta do NOME, e só ela — é dele que sai o endereço.
 *  Com `?slug=`: o formulário sobre o RASCUNHO daquele slug, UMA PERGUNTA POR
 *  VEZ — a da posição `&p=N` (1 a M); `p` ausente ou torto cai na primeira
 *  ainda sem resposta (`escolherPosicao`).
 *
 *  🔴 ESTA PÁGINA É DE SERVIDOR E É QUEM CONHECE O REGISTRO: `montarPerguntas`
 *  lê `CAMPOS_DA_FICHA` e o questionário e entrega ao `FormularioDeLugar` (de
 *  cliente) só objetos rasos (E1 da auditoria).
 *
 *  🔴 SLUG SEM RASCUNHO É 404 — inclusive o slug de um lugar que está no ar. O
 *  formulário nunca abre uma ficha publicada como se fosse rascunho: quem edita
 *  lugar no ar é `/admin/<slug>`, com histórico e coerência.
 *
 *  A ordem das guardas é a das páginas irmãs: config → sessão → banco. */
export default async function Novo({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string | string[]; p?: string | string[] }>;
}) {
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

  const { slug, p } = await searchParams;
  if (typeof slug !== "string") {
    return (
      <main className="adm">
        <h1>Painel</h1>
        <h2>{TITULO_NOVO}</h2>
        <ComecarLugarNovo pergunta={PERGUNTAS["trajeto.waypoints.0.nome"]} />
      </main>
    );
  }

  // Banco pendurado não segura a página pra sempre: mesmo prazo da leitura do
  // dono (`getFichaDoDono`), e o estouro é ERRO, não "não existe" — dizer 404
  // pra um rascunho que só não foi lido a tempo seria perder a porta de volta.
  const r = await comPrazo<Rascunho | null | typeof ESTOUROU>(
    lerRascunho(getClient(), slug),
    PRAZO_FICHA_MS,
    ESTOUROU,
  );
  if (r === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do rascunho.");
  if (r === null) notFound();

  // A lista INTEIRA é montada aqui (é o registro que decide quais perguntas);
  // o cliente recebe só a da posição `p`, e quais já têm resposta.
  const perguntas = montarPerguntas(JSON.parse(r.doc));
  const respondidas = perguntas.map((q) => q.valor !== undefined);
  const posicao = escolherPosicao(p, respondidas);

  return (
    <main className="adm">
      <h1>Painel</h1>
      <h2>{TITULO_NOVO}</h2>
      <FormularioDeLugar
        slug={slug}
        pergunta={perguntas[posicao - 1]}
        posicao={posicao}
        respondidas={respondidas}
      />
    </main>
  );
}
