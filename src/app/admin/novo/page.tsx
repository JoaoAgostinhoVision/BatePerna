import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lerRascunho, type Rascunho } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { FONTES_DE_PRODUCAO, vistaDaCoordSemPonto } from "@/lib/vista-do-mapa";
import CaixaDeSenha from "../CaixaDeSenha";
import FormularioDeLugar, { ComecarLugarNovo } from "../FormularioDeLugar";
import { travaDoPainel } from "@/lib/par-de-lugar";
import { ROTAS } from "./enderecos";
import { PERGUNTAS, escolherPosicao, montarPerguntas } from "./perguntas";
import "../admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const TITULO_NOVO = "Lugar novo";

const ESTOUROU = Symbol("prazo do rascunho");

/** `/admin/novo` — o lugar novo (Tarefa 11).
 *
 *  Sem `?slug=`: a pergunta do NOME, e só ela — a cidade vem do ponto que ele
 *  marca no mapa (17/10), e o endereço sai dela.
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
  searchParams: Promise<{ slug?: string | string[]; p?: string | string[]; volta?: string | string[] }>;
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

  const { slug, p, volta } = await searchParams;
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
  const doc: unknown = JSON.parse(r.doc);
  const perguntas = montarPerguntas(doc);
  const respondidas = perguntas.map((q) => q.valor !== undefined);
  const posicao = escolherPosicao(p, respondidas);
  const pergunta = perguntas[posicao - 1];

  // 🔴 A COORDENADA SEM PONTO (Tarefa 11f): o mapa nasce sem pin, numa VISTA que
  // é calculada AQUI, no servidor, e desce pronta — uma busca no celular
  // chegaria depois do mapa desenhado e a vista pularia, talvez depois do toque
  // dele (I1 da auditoria). Só a pergunta da TELA, e só se ela for de mapa sem
  // ponto: as outras telas não vão ao serviço de geocoding. A vista não é ponto
  // e não é gravada (`src/lib/vista-do-mapa.ts`). Não há pergunta de `.lng`:
  // `camposQueSaoPergunta` a tira (o mapa mora na linha da `.lat`).
  const semPonto = pergunta.especie === "coord" && pergunta.valor === undefined;
  const vista = semPonto ? await vistaDaCoordSemPonto(doc, pergunta.campo.caminho, FONTES_DE_PRODUCAO) : null;

  // 🔴 O AVISO DO PAR (17/10, Task 4): calculado AQUI a cada carga, em TODA tela
  // de pergunta enquanto a trava existe; a frase é a do painel, que nomeia quem
  // ocupa. O link leva à pergunta do nome (posição 1). Descem só os dados: o
  // formulário desenha o link pelo segundo toque dele (I1 de 18/10).
  const trava = await travaDoPainel(r.doc, slug);
  const aviso = trava === null ? undefined : { frase: trava, corrigir: ROTAS.painel.corrigir(slug, 1) };

  return (
    <main className="adm">
      <h1>Painel</h1>
      <h2>{TITULO_NOVO}</h2>
      <FormularioDeLugar
        aviso={aviso}
        slug={slug}
        pergunta={vista ? { ...pergunta, campo: { ...pergunta.campo, vista } } : pergunta}
        posicao={posicao}
        respondidas={respondidas}
        voltaARevisao={volta === "revisao"}
      />
    </main>
  );
}
