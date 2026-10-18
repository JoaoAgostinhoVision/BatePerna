import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, type Rascunho } from "@/lib/db";
import { lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { FONTES_DE_PRODUCAO, vistaDaCoordSemPonto } from "@/lib/vista-do-mapa";
import FormularioDeLugar, { ComecarLugarNovo } from "../../admin/FormularioDeLugar";
import { PERGUNTAS, escolherPosicao } from "../../admin/novo/perguntas";
import { TITULO_MANDAR } from "../palavras";
import { montarPerguntasDaPessoa } from "../perguntas";
import { quemNaTela } from "../sessao";
import "../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo do rascunho dela");

/** `/contribuir/novo` — as perguntas DELA, no molde de `/admin/novo`: sem
 *  `?slug=`, só o nome (a cidade vem do ponto que ela marca); com `?slug=`, uma
 *  pergunta por vez sobre o rascunho DELA (`&p=N`). Rascunho que não é dela —
 *  de outra pessoa, do João, ou que não existe — é 404: não revela que existe.
 *  A porta é `quemNaTela` (Clerk), não a senha do painel. */
export default async function NovoDaPessoa({
  searchParams,
}: { searchParams: Promise<{ slug?: string | string[]; p?: string | string[] }> }) {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { slug, p } = await searchParams;
  if (typeof slug !== "string") {
    return (
      <main className="adm">
        <h1>{TITULO_MANDAR}</h1>
        <ComecarLugarNovo pergunta={PERGUNTAS["trajeto.waypoints.0.nome"]} onde="contribuir" />
      </main>
    );
  }
  // Banco pendurado não segura a página: o mesmo prazo de `/admin/novo`, e o
  // estouro é ERRO, não "não existe".
  const r = await comPrazo<Rascunho | null | typeof ESTOUROU>(
    lerRascunhoDaPessoa(getClient(), slug, quem.pessoa.id), PRAZO_FICHA_MS, ESTOUROU,
  );
  if (r === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do rascunho.");
  if (r === null) notFound();
  const doc: unknown = JSON.parse(r.doc);
  const perguntas = montarPerguntasDaPessoa(doc);
  const respondidas = perguntas.map((q) => q.valor !== undefined);
  const posicao = escolherPosicao(p, respondidas);
  const pergunta = perguntas[posicao - 1];
  // A coordenada sem ponto: a vista do mapa é calculada aqui, no servidor, como
  // em `/admin/novo` (Tarefa 11f).
  const semPonto = pergunta.especie === "coord" && pergunta.valor === undefined;
  const vista = semPonto ? await vistaDaCoordSemPonto(doc, pergunta.campo.caminho, FONTES_DE_PRODUCAO) : null;
  return (
    <main className="adm">
      <h1>{TITULO_MANDAR}</h1>
      <FormularioDeLugar
        slug={slug}
        pergunta={vista ? { ...pergunta, campo: { ...pergunta.campo, vista } } : pergunta}
        posicao={posicao}
        respondidas={respondidas}
        onde="contribuir"
      />
    </main>
  );
}
