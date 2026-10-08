import { aplicarNoRascunho, type ValorDeCampo } from "@/lib/campos-da-ficha";
import { ehCampoDaPessoa, pontoNoRascunhoDaPessoa, tirarDoRascunhoDaPessoa } from "@/lib/campos-da-pessoa";
import { getClient } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, estaBloqueado, lerRascunhoDaPessoa, moverRascunhoDaPessoa, rascunhosDaPessoa,
  regravarRascunhoDaPessoa,
} from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDoPar } from "@/lib/par-de-lugar";
import { BLOQUEADA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, portaDaPessoa } from "@/lib/porta-da-pessoa";
import {
  CIDADE_SEM_LETRA, CIDADE_VAZIA, NOME_SEM_LETRA, NOME_VAZIO, cidadeDoDoc, docDoLugarNovo,
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

/** COMEÇAR: o nome e a cidade, como no painel (mesmas frases de campo, mesma
 *  colisão pelo par, mesmo endereço). O rascunho nasce DELA.
 *
 *  🔴 I3 da pré-auditoria: TODA colisão — o par, o gêmeo sem cidade, o
 *  endereço ocupado, o endereço antigo — responde `NOME_JA_EM_USO`. A rota lê a
 *  colisão ESTRUTURADA (`colisaoDoPar`) e nunca pergunta QUEM ocupa: nada do
 *  painel ("pela lista do painel") e nenhum nome de outro chega a ela. */
export async function POST(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;

  const corpo = await corpoDe(req);
  if (corpo === null || Object.keys(corpo).length !== 2 || typeof corpo.nome !== "string" || typeof corpo.cidade !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  const cidade = corpo.cidade.trim();
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  if (cidade === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
  if (slugDoNome(nome) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  if (slugDoNome(cidade) === "") return new Response(CIDADE_SEM_LETRA, { status: 400, headers: TEXTO });

  if ((await colisaoDoPar(nome, cidade, { exceto: null, nomeNovo: true })) !== null) return emUso();

  const slug = slugDoNome(`${nome} ${cidade}`);
  if (await criarRascunhoDaPessoa(getClient(), slug, docDoLugarNovo(slug, nome, cidade), agora, porta.pessoa.id)) {
    return Response.json({ slug }, { status: 201, headers: SEM_CACHE });
  }
  // Endereço de um lugar, de um rascunho de outro, ou endereço antigo: o
  // banco recusou, e a frase é a dela. (A Task 15 põe antes daqui a
  // conferência do bloqueio.)
  return emUso();
}

/** RESPONDER uma pergunta dela. Três corpos, mutuamente exclusivos:
 *  `{slug, campo, valor}`, `{slug, campo, naoSei: true}`, `{slug, ponto: 0, lat, lng}`.
 *  🔴 Campo fora da lista dela é 400 ANTES de ler o banco (Review Focus 1). */
export async function PUT(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora);
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
  // não duas em série. É isto, com o `trim` do POST, que deixa o rascunho
  // dela SEMPRE com cidade com letra: o ramo `semCidade` de `colisaoDoPar`
  // nunca é de um rascunho dela.
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
    mudar = (doc) => (trazNaoSei ? tirarDoRascunhoDaPessoa(doc, campo) : aplicarNoRascunho(doc, campo, valor as ValorDeCampo));
  }

  const atual = await lerRascunhoDaPessoa(getClient(), slug, id);
  if (atual === null) return new Response("", { status: 404, headers: TEXTO });

  if ((await colisaoDaMudanca(atual.doc, slug, campo, valor)) !== null) return emUso();

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
  }

  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE)) {
    if (slugDoNome(nomeDoRascunho(novoDoc, "")) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
    if (slugDoNome(cidadeDoDoc(novoDoc) ?? "") === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
    const destino = slugDoNome(`${nomeDoRascunho(novoDoc, "")} ${cidadeDoDoc(novoDoc)}`);
    if (destino !== slug) {
      if (await moverRascunhoDaPessoa(getClient(), slug, destino, docNoEndereco(novoDoc, destino), agora, id)) {
        return Response.json({ slug: destino }, { headers: SEM_CACHE });
      }
      if (await estaBloqueado(getClient(), id)) return bloqueada();
      if ((await lerRascunhoDaPessoa(getClient(), slug, id)) === null) {
        return new Response(RASCUNHO_DELA_SUMIU, { status: 409, headers: TEXTO });
      }
      // O destino está ocupado (lugar, rascunho de outro, endereço antigo): a frase dela.
      return emUso();
    }
  }
  if (!(await regravarRascunhoDaPessoa(getClient(), slug, novoDoc, agora, id))) {
    if (await estaBloqueado(getClient(), id)) return bloqueada();
    return new Response(RASCUNHO_DELA_SUMIU, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { headers: SEM_CACHE });
}

export async function GET(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(agoraS());
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
  const porta = await portaDaPessoa(agoraS());
  if ("resposta" in porta) return porta.resposta;
  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  if (!(await apagarRascunhoDaPessoa(getClient(), corpo.slug, porta.pessoa.id))) {
    if (await estaBloqueado(getClient(), porta.pessoa.id)) return bloqueada();
    return new Response("", { status: 404, headers: TEXTO });
  }
  return Response.json({ slug: corpo.slug }, { headers: SEM_CACHE });
}
