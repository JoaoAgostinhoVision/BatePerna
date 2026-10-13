import { aplicarCampo, type ValorDeCampo } from "@/lib/campos-da-ficha";
import { TEXTO_LONGO_DEMAIS, ehCampoDaPessoa, pontoDaPessoa, textoAcimaDoTeto, tirarCampoDaPessoa } from "@/lib/campos-da-pessoa";
import { getClient, lugarDoDono, versoesAtuais } from "@/lib/db";
import { estaBloqueado, gravarEdicaoDaPessoa } from "@/lib/db-contribuidor";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";
import { colisaoDaMudanca } from "@/lib/par-de-lugar";
import { violacaoIntroduzidaInteira } from "@/lib/porta-de-coerencia";
import { BLOQUEADA, JA_CONFERIDO, NOME_JA_EM_USO, fraseDaPessoa, portaDaPessoa } from "@/lib/porta-da-pessoa";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** O 400 de um estouro das formas de escrita: só a `message` de um `Error`
 *  EXATO vaza (as frases nossas, como `SEM_NAO_SEI`); erro do zod ou de outra
 *  classe vira 400 vazio — a régua do `recusar400` do painel. */
function recusar400(erro: unknown): Response {
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

/** ELA EDITA O DELA, NO AR, ENQUANTO NÃO CONFERIDO (spec de 07/10, Parte 1).
 *  Os corpos são os do rascunho (`{campo, valor}`, `{campo, naoSei: true}`,
 *  `{ponto: 0, lat, lng}`), mais `slug` e `baseId` (a versão que a tela abriu).
 *
 *  A ORDEM: a porta da pessoa (503/401/403, ANTES de qualquer leitura — a
 *  pessoa bloqueada nunca ouve uma frase de colisão) → corpo (400) → o lugar
 *  DELA (404 se não é dela, nunca revelando que existe; 409 `JA_CONFERIDO`) →
 *  o par (409 `NOME_JA_EM_USO`, pela colisão ESTRUTURADA — I3) → o documento
 *  novo pelas formas de escrita (400) → a coerência por diferença (409, na
 *  frase DELA, aberta por "Nada foi gravado" — o lugar está publicado, I2 da
 *  revisão final) → o banco.
 *
 *  A leitura de antes só ESCOLHE a frase; quem DECIDE é o INSERT de
 *  `gravarEdicaoDaPessoa` (dela, não conferido, livre, versão da tela — tudo
 *  no mesmo statement). Quando ele recusa, a rota relê pra dizer por quê.
 *
 *  🔴 Nome e cidade mudam o DOCUMENTO, nunca o endereço: lugar no ar muda de
 *  endereço só quando o João manda (decisão de 04/10, Tarefa 11e) — o painel
 *  dele mostra o aviso de sempre. */
export async function PUT(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  let corpo: Record<string, unknown> | null;
  try {
    const b: unknown = await req.json();
    corpo = typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    corpo = null;
  }
  if (corpo === null || typeof corpo.slug !== "string" || !baseIdValido(corpo.baseId)) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const slug = corpo.slug;
  const baseId = corpo.baseId;
  const { campo, valor, naoSei, ponto, lat, lng } = corpo;
  // Um corpo é UM dos três: campo (com valor OU "não sei") ou ponto — nunca
  // os dois, nunca nenhum.
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  if (trazCampo === trazPonto) return new Response("", { status: 400, headers: TEXTO });

  let mudar: (doc: string) => string;
  if (trazPonto) {
    if (ponto !== 0 || typeof lat !== "number" || typeof lng !== "number") return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => pontoDaPessoa(doc, lat, lng);
  } else {
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei || (trazNaoSei && naoSei !== true)) return new Response("", { status: 400, headers: TEXTO });
    // 🔴 A lista DELA, mudo: voz, regra, discriminador, chip — nada fora dela.
    if (!ehCampoDaPessoa(campo)) return new Response("", { status: 400, headers: TEXTO });
    // M6 da revisão final: o teto, ANTES de ler o banco, como a lista.
    if (textoAcimaDoTeto(valor)) return new Response(TEXTO_LONGO_DEMAIS, { status: 400, headers: TEXTO });
    const caminho = campo;
    mudar = (doc) => (trazNaoSei ? tirarCampoDaPessoa(doc, caminho) : aplicarCampo(doc, caminho, valor as ValorDeCampo));
  }

  const lugar = await lugarDoDono(getClient(), slug);
  if (lugar === null || lugar.origem.contribuidor !== id) return new Response("", { status: 404, headers: TEXTO });
  if (lugar.origem.conferido) return new Response(JA_CONFERIDO, { status: 409, headers: TEXTO });

  // I3: a colisão estruturada, e a frase DELA — nunca `parDaMudanca`, a do
  // painel, que nomeia quem ocupa. O próprio `slug` fica de fora.
  if ((await colisaoDaMudanca(lugar.versao.doc, slug, campo, valor)) !== null) {
    return new Response(NOME_JA_EM_USO, { status: 409, headers: TEXTO });
  }

  let novo: string;
  try {
    novo = mudar(lugar.versao.doc);
  } catch (erro) {
    return recusar400(erro);
  }
  const violacao = violacaoIntroduzidaInteira(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, lugar.versao.doc, novo);
  if (violacao !== null) return new Response(fraseDaPessoa(violacao, "editar"), { status: 409, headers: TEXTO });

  if ((await gravarEdicaoDaPessoa(getClient(), slug, novo, agora, baseId, id)) !== null) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  // Recusou no INSERT: o que mudou entre a leitura e a gravação? 🔴 O
  // bloqueio PRIMEIRO (a ordem da Task 11): a recusa é a mesma da porta, e
  // vem antes de "já conferido" e de "mudou de endereço".
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  const depois = await lugarDoDono(getClient(), slug);
  if (depois?.origem.conferido) return new Response(JA_CONFERIDO, { status: 409, headers: TEXTO });
  return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
}
