import { enderecoNovoDe, getClient, publicarRascunho, rascunhoDeQualquerUm, versaoAtual, versoesAtuais } from "@/lib/db";
import { estaBloqueado, lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { colisaoDoPar } from "@/lib/par-de-lugar";
import { violacaoIntroduzidaInteira } from "@/lib/porta-de-coerencia";
import { NADA_PUBLICADO, RASCUNHO_MUDOU } from "@/lib/porta-de-publicar";
import {
  BLOQUEADA, JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, fraseDaPessoa, portaDaPessoa, prepararPublicacaoDaPessoa,
} from "@/lib/porta-da-pessoa";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const recusa = (status: 400 | 409, frase: string) => new Response(frase, { status, headers: TEXTO });

/** Por que o banco recusou — a régua de `porQueRecusou` do painel, com as
 *  frases DELA onde a do painel falaria do painel ou NOMEARIA quem ocupa (I3
 *  da pré-auditoria: o endereço ocupado por um lugar é `NOME_JA_EM_USO`, nunca
 *  `enderecoDeLugar`, que diz o nome de um lugar talvez escondido).
 *  `rascunhoDeQualquerUm`, e NÃO `lerRascunho`: desde 07/10 aquela é só do
 *  João, e o rascunho daqui é dela. O último ramo é o ruling do endereço
 *  antigo: o batch recusou porque o endereço virou antigo depois que o
 *  rascunho nasceu.
 *
 *  🔴 O BLOQUEIO NÃO MORA AQUI: quem chama confere `estaBloqueado` ANTES
 *  (lição da Task 10) — o rascunho bloqueado está lá, intacto, e cairia em
 *  "recarregue". */
async function porQueRecusou(slug: string, atualizadoEm: number): Promise<string> {
  const lugar = await versaoAtual(getClient(), slug);
  const r = await rascunhoDeQualquerUm(getClient(), slug);
  if (r !== null && r.atualizado_em !== atualizadoEm) return RASCUNHO_MUDOU;
  if (lugar !== null && r === null) return JA_NO_AR_DA_PESSOA;
  if (lugar !== null) return NOME_JA_EM_USO;
  if (r === null) return RASCUNHO_DELA_SUMIU;
  if ((await enderecoNovoDe(getClient(), slug)) !== null) return NOME_JA_EM_USO;
  return NADA_PUBLICADO;
}

/** PUBLICAR O LUGAR DELA (spec de 07/10, Parte 1): "no ar na hora, com a
 *  marca". A marca não é desta rota: é a linha de `origem_do_lugar` que
 *  `publicarRascunho` faz nascer NO MESMO batch da versão 1 (Task 1) — e o
 *  mesmo batch recusa a pessoa bloqueada e o endereço que virou endereço
 *  antigo de outro lugar (ruling da pré-auditoria: o link velho do João
 *  continua levando ao lugar dele).
 *
 *  A ORDEM, a do painel (`/api/admin/publicar`) com as portas DELA: a porta
 *  da pessoa (503/401/403) → corpo (400) → o rascunho DELA (404 se não é dela
 *  — salvo o duplo toque, abaixo —, 409 se mudou) → o documento pela lista
 *  dela (`prepararPublicacaoDaPessoa`, 400 com frase) → o par (409
 *  `NOME_JA_EM_USO`, pela colisão ESTRUTURADA — I3) → a coerência por
 *  diferença (409, na frase DELA pela regra) → o banco. */
export async function POST(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  // Exatamente `{slug, atualizadoEm}`: `atualizadoEm` inteiro ≥ 0 (o
  // `JSON.parse` vira `1e999` em `Infinity`, que o driver estoura).
  const c = corpo as { slug?: unknown; atualizadoEm?: unknown };
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) || Object.keys(corpo).length !== 2 ||
    typeof c.slug !== "string" || !Number.isSafeInteger(c.atualizadoEm) || (c.atualizadoEm as number) < 0
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const slug = c.slug;
  const atualizadoEm = c.atualizadoEm as number;

  const rascunho = await lerRascunhoDaPessoa(getClient(), slug, id);
  if (rascunho === null) {
    // Nem dela, nem existe: 404 — a não ser que ela mesma acabou de publicar
    // (duplo toque) ou o rascunho mudou de endereço: aí a frase explica.
    const lugar = await versaoAtual(getClient(), slug);
    if (lugar === null) return new Response("", { status: 404, headers: TEXTO });
    return recusa(409, await porQueRecusou(slug, atualizadoEm));
  }
  if (rascunho.atualizado_em !== atualizadoEm) return recusa(409, RASCUNHO_MUDOU);

  const preparo = prepararPublicacaoDaPessoa(rascunho.doc, slug);
  if ("frase" in preparo) return recusa(400, preparo.frase);
  const { doc } = preparo;

  // I3: a colisão estruturada, e a frase dela — nunca `parOcupado` (a do painel).
  const colisao = await colisaoDoPar(nomeDoRascunho(doc, ""), cidadeDoDoc(doc) ?? "", { exceto: slug, nomeNovo: true });
  if (colisao !== null) return recusa(409, NOME_JA_EM_USO);

  const violacao = violacaoIntroduzidaInteira(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, null, doc);
  if (violacao !== null) return recusa(409, fraseDaPessoa(violacao));

  if (await publicarRascunho(getClient(), slug, doc, agora, atualizadoEm, id)) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  // 🔴 O bloqueio que chegou entre a porta e o batch (lição da Task 10): a
  // recusa é a MESMA da porta, e vem antes de "mudou"/"em uso"/"recarregue".
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  return recusa(409, await porQueRecusou(slug, atualizadoEm));
}
