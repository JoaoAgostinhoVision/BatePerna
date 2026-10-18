import { aplicarNoRascunho, type ValorDeCampo } from "@/lib/campos-da-ficha";
import {
  TEXTO_LONGO_DEMAIS, ehCampoDaPessoa, pontoNoRascunhoDaPessoa, textoAcimaDoTeto, tirarDoRascunhoDaPessoa,
} from "@/lib/campos-da-pessoa";
import { getClient } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, estaBloqueado, lerRascunhoDaPessoa, rascunhosDaPessoa,
  regravarRascunhoDaPessoa,
} from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDoPar } from "@/lib/par-de-lugar";
import { BLOQUEADA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, portaDaPessoa } from "@/lib/porta-da-pessoa";
import {
  CIDADE_VAZIA, NOME_SEM_LETRA, NOME_VAZIO, cidadeDoDoc, docDoLugarNovo,
  docNoEndereco, nomeDoRascunho, slugDoNome,
} from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const SEM_CACHE = { "cache-control": "no-store" } as const;
const agoraS = () => Math.floor(Date.now() / 1000);

async function corpoDe(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Só `Error` NOSSO vira frase (as do registro, já lidas por ele); qualquer
 *  outro (ZodError) é 400 mudo — mesma régua da rota do painel. */
function recusar400(erro: unknown): Response {
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

const emUso = (): Response => new Response(NOME_JA_EM_USO, { status: 409, headers: TEXTO });

/** 🔴 A GRAVAÇÃO RECUSADA POR BLOQUEIO NO MEIO (onda de fix da Task 10): a
 *  porta deixou passar, e o João bloqueou antes do statement — o `LIVRE` de
 *  `db-contribuidor.ts` derrubou a gravação. A recusa é a MESMA da porta, e
 *  vem antes de "sumiu" e de "em uso": o rascunho está lá, e o destino pode
 *  estar livre; quem recusou foi o bloqueio. */
const bloqueada = (): Response => new Response(BLOQUEADA, { status: 403, headers: TEXTO });

/** COMEÇAR: só o nome (17/10: a cidade vem do ponto que ela marca no mapa).
 *  O rascunho nasce DELA, numa chave própria que nunca é um endereço (Task 17),
 *  e a resposta é `{slug}` com essa CHAVE — é ela que as telas dela levam na
 *  URL. Sem cidade não há endereço: o documento nasce com `slug: ""` (o de
 *  dentro só vale no publicar, que o recalcula) e o `INSERT` não confere
 *  endereço.
 *
 *  🔴 Task 17 (decisão do João de 13/10, "Nenhum ocupa"): nenhum rascunho
 *  recusa — nem dela, nem de outra pessoa, nem do João. O que ainda recusa AQUI,
 *  cedo, é o que já existe: o gêmeo sem cidade de um LUGAR (o par e o endereço
 *  só se conferem quando a cidade chega, no PUT) — um aviso útil; o publicar
 *  confere de novo.
 *
 *  🔴 I3 da pré-auditoria: TODA colisão responde `NOME_JA_EM_USO`. A rota lê a
 *  colisão ESTRUTURADA (`colisaoDoPar`) e nunca diz QUEM ocupa: nada do painel
 *  ("pela lista do painel") e nenhum nome de outro chega a ela. */
export async function POST(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora, "gravar");
  if ("resposta" in porta) return porta.resposta;

  const corpo = await corpoDe(req);
  if (corpo === null || Object.keys(corpo).length !== 1 || typeof corpo.nome !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  if (textoAcimaDoTeto([nome])) return new Response(TEXTO_LONGO_DEMAIS, { status: 400, headers: TEXTO });
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  if (slugDoNome(nome) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });

  if ((await colisaoDoPar(nome, "", { exceto: null, nomeNovo: true, quem: "pessoa" })) !== null) return emUso();

  const chave = await criarRascunhoDaPessoa(getClient(), null, docDoLugarNovo("", nome), agora, porta.pessoa.id);
  if (chave !== null) return Response.json({ slug: chave }, { status: 201, headers: SEM_CACHE });
  // O banco recusou: sem endereço a conferir, só o bloqueio (Task 15) — o João
  // bloqueou entre a porta e o INSERT, e o `LIVRE` derrubou.
  if (await estaBloqueado(getClient(), porta.pessoa.id)) return bloqueada();
  return emUso();
}

/** RESPONDER uma pergunta dela. Três corpos, mutuamente exclusivos:
 *  `{slug, campo, valor}`, `{slug, campo, naoSei: true}`, `{slug, ponto: 0, lat, lng}`.
 *  🔴 Campo fora da lista dela é 400 ANTES de ler o banco (Review Focus 1). */
export async function PUT(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora, "gravar");
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  const { slug, campo, naoSei, ponto, lat, lng } = corpo;
  // 🔴 A RESPOSTA DELA ENTRA APARADA (desvio do molde do painel, que grava o
  // texto como chegou). A página pública só confere se HÁ texto, então espaço
  // nas pontas iria pra tela, e o nome aparado é o que a colisão e o endereço
  // leem. Só de espaços vira `""`, e quem a recusa é a folha (`recusarVazio`,
  // em `campos-da-ficha.ts`, com `CIDADE_VAZIA` pra cidade) — uma porta só,
  // não duas em série. É isto que deixa a cidade dela, quando chega, SEMPRE
  // com letra: o endereço que sai do par dela tem sempre o hífen do meio.
  const valor = typeof corpo.valor === "string" ? corpo.valor.trim() : corpo.valor;
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  if (trazCampo === trazPonto) return new Response("", { status: 400, headers: TEXTO });

  let mudar: (doc: string) => string;
  if (trazPonto) {
    if (ponto !== 0 || typeof lat !== "number" || typeof lng !== "number") return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => pontoNoRascunhoDaPessoa(doc, lat, lng);
  } else {
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei || (trazNaoSei && naoSei !== true)) return new Response("", { status: 400, headers: TEXTO });
    if (!ehCampoDaPessoa(campo)) return new Response("", { status: 400, headers: TEXTO });
    // M6 da revisão final: o teto, ANTES de ler o banco, como a lista.
    if (textoAcimaDoTeto(valor)) return new Response(TEXTO_LONGO_DEMAIS, { status: 400, headers: TEXTO });
    mudar = (doc) => (trazNaoSei ? tirarDoRascunhoDaPessoa(doc, campo) : aplicarNoRascunho(doc, campo, valor as ValorDeCampo));
  }

  const atual = await lerRascunhoDaPessoa(getClient(), slug, id);
  if (atual === null) return new Response("", { status: 404, headers: TEXTO });

  if ((await colisaoDaMudanca(atual.doc, slug, campo, valor, "pessoa")) !== null) return emUso();

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
  }

  // 🔴 RENOMEAR, OU MUDAR A CIDADE, É REGRAVAR O DOCUMENTO (Task 17): a chave
  // não anda. O `slug` de dentro acompanha o par (o endereço onde o lugar
  // nasceria), e ele tem de estar livre de LUGAR e de endereço antigo — o aviso
  // cedo, no mesmo UPDATE (`regravarRascunhoDaPessoa` com `endereco`).
  // O endereço só entra quando o documento JÁ TEM cidade: antes do ponto,
  // renomear só regrava (nada de `CIDADE_VAZIA`, nem endereço a conferir). O
  // nome com letra vale sempre.
  let endereco: string | null = null;
  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE)) {
    if (slugDoNome(nomeDoRascunho(novoDoc, "")) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  }
  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE) && cidadeDoDoc(novoDoc) !== undefined) {
    if (slugDoNome(cidadeDoDoc(novoDoc) ?? "") === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
    endereco = slugDoNome(`${nomeDoRascunho(novoDoc, "")} ${cidadeDoDoc(novoDoc)}`);
    novoDoc = docNoEndereco(novoDoc, endereco);
  }
  if (!(await regravarRascunhoDaPessoa(getClient(), slug, novoDoc, agora, id, endereco))) {
    if (await estaBloqueado(getClient(), id)) return bloqueada();
    if (endereco === null || (await lerRascunhoDaPessoa(getClient(), slug, id)) === null) {
      return new Response(RASCUNHO_DELA_SUMIU, { status: 409, headers: TEXTO });
    }
    // O rascunho está lá, livre, e o par mudou: quem recusou foi o endereço
    // (de um lugar, ou antigo).
    return emUso();
  }
  return Response.json({ slug }, { headers: SEM_CACHE });
}

/** LER: o rascunho dela (`?slug=`) ou a lista. Só lê — o 503 é a frase de
 *  ABRIR (`CLERK_FORA_AO_ABRIR`, onda de copy de 13/10). */
export async function GET(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(agoraS(), "abrir");
  if ("resposta" in porta) return porta.resposta;
  const slug = new URL(req.url).searchParams.get("slug");
  if (slug !== null) {
    const r = await lerRascunhoDaPessoa(getClient(), slug, porta.pessoa.id);
    if (r === null) return new Response("", { status: 404, headers: TEXTO });
    return Response.json({ slug: r.slug, doc: JSON.parse(r.doc) }, { headers: SEM_CACHE });
  }
  const rascunhos = (await rascunhosDaPessoa(getClient(), porta.pessoa.id)).map((r) => ({
    slug: r.slug, nome: nomeDoRascunho(r.doc, r.slug), atualizado_em: r.atualizado_em,
  }));
  return Response.json({ rascunhos }, { headers: SEM_CACHE });
}

/** DESISTIR (o "Desistir deste lugar" da Tarefa 15 vale aqui também). */
export async function DELETE(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(agoraS(), "gravar");
  if ("resposta" in porta) return porta.resposta;
  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  if (!(await apagarRascunhoDaPessoa(getClient(), corpo.slug, porta.pessoa.id))) {
    if (await estaBloqueado(getClient(), porta.pessoa.id)) return bloqueada();
    return new Response("", { status: 404, headers: TEXTO });
  }
  return Response.json({ slug: corpo.slug }, { headers: SEM_CACHE });
}
