import { enderecoNovoDe, getClient, publicarRascunho, versaoAtual, versoesAtuais } from "@/lib/db";
import { estaBloqueado, lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { colisaoDoPar } from "@/lib/par-de-lugar";
import { violacaoIntroduzidaInteira } from "@/lib/porta-de-coerencia";
import { NADA_PUBLICADO, RASCUNHO_MUDOU } from "@/lib/porta-de-publicar";
import {
  BLOQUEADA, JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, fraseDaPessoa, portaDaPessoa, prepararPublicacaoDaPessoa,
} from "@/lib/porta-da-pessoa";
import { cidadeDoDoc, nomeDoRascunho, slugDoNome } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const recusa = (status: 400 | 409, frase: string) => new Response(frase, { status, headers: TEXTO });

/** Por que o banco recusou — a régua de `porQueRecusou` do painel, com as
 *  frases DELA onde a do painel falaria do painel ou NOMEARIA quem ocupa (I3
 *  da pré-auditoria: o endereço ocupado por um lugar é `NOME_JA_EM_USO`, nunca
 *  `enderecoDeLugar`, que diz o nome de um lugar talvez escondido).
 *
 *  🔴 DUAS COISAS, SEPARADAS (Task 17): o rascunho DELA, lido pela `chave`
 *  (`lerRascunhoDaPessoa`), e o `endereco` onde o lugar iria nascer. Lugar no
 *  endereço com o rascunho dela sumido é o duplo toque concorrente (o 1º
 *  publicou e apagou); com o rascunho lá, é OUTRO lugar que chegou primeiro —
 *  outra pessoa, ou o João, que publicou o mesmo par. O último ramo é o ruling
 *  do endereço antigo: o batch recusou porque o endereço virou antigo depois
 *  que o rascunho nasceu.
 *
 *  🔴 O BLOQUEIO NÃO MORA AQUI: quem chama confere `estaBloqueado` ANTES
 *  (lição da Task 10) — o rascunho bloqueado está lá, intacto, e cairia em
 *  "recarregue". */
async function porQueRecusou(chave: string, endereco: string, atualizadoEm: number, id: string): Promise<string> {
  const lugar = await versaoAtual(getClient(), endereco);
  const r = await lerRascunhoDaPessoa(getClient(), chave, id);
  if (r !== null && r.atualizado_em !== atualizadoEm) return RASCUNHO_MUDOU;
  if (lugar !== null && r === null) return JA_NO_AR_DA_PESSOA;
  if (lugar !== null) return NOME_JA_EM_USO;
  if (r === null) return RASCUNHO_DELA_SUMIU;
  if ((await enderecoNovoDe(getClient(), endereco)) !== null) return NOME_JA_EM_USO;
  return NADA_PUBLICADO;
}

/** PUBLICAR O LUGAR DELA (spec de 07/10, Parte 1): "no ar na hora, com a
 *  marca". A marca não é desta rota: é a linha de `origem_do_lugar` que
 *  `publicarRascunho` faz nascer NO MESMO batch da versão 1 (Task 1) — e o
 *  mesmo batch recusa a pessoa bloqueada, o endereço que já é de um lugar, e
 *  o endereço que virou endereço antigo de outro lugar (ruling da
 *  pré-auditoria: o link velho do João continua levando ao lugar dele).
 *
 *  🔴 O CORPO TRAZ A CHAVE DO RASCUNHO, NÃO O ENDEREÇO (Task 17): `{slug,
 *  atualizadoEm}`, com `slug` = a chave que o começar devolveu. O ENDEREÇO é
 *  calculado AQUI, do nome e da cidade do documento, na hora de publicar — o
 *  rascunho não ocupa endereço nenhum até lá, e quem publica primeiro fica com
 *  ele. A resposta de sucesso é `{slug}` com o ENDEREÇO: é pra lá que a tela
 *  dela leva (`ROTAS.contribuir.publicou`), e a chave já não existe.
 *
 *  A ORDEM, a do painel (`/api/admin/publicar`) com as portas DELA: a porta
 *  da pessoa (503/401/403) → corpo (400) → o rascunho DELA (404 se não é dela
 *  ou não existe mais — sem a chave não há endereço a conferir —, 409 se
 *  mudou) → o documento pela lista dela (`prepararPublicacaoDaPessoa`, 400 com
 *  frase) → o par contra LUGAR (409 `NOME_JA_EM_USO`, pela colisão ESTRUTURADA
 *  — I3) → a coerência por diferença (409, na frase DELA pela regra) → o
 *  banco. */
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
  const chave = c.slug;
  const atualizadoEm = c.atualizadoEm as number;

  const rascunho = await lerRascunhoDaPessoa(getClient(), chave, id);
  if (rascunho === null) return new Response("", { status: 404, headers: TEXTO });
  if (rascunho.atualizado_em !== atualizadoEm) return recusa(409, RASCUNHO_MUDOU);

  // O endereço sai do PAR do documento, pela regra de quando um lugar nasce
  // (`slugDoNome(nome + " " + cidade)`). O `slug` de dentro tem de dizer o
  // mesmo (`SLUG_DE_DENTRO`, na porta): o PUT dela o mantém junto do par.
  const endereco = slugDoNome(`${nomeDoRascunho(rascunho.doc, "")} ${cidadeDoDoc(rascunho.doc) ?? ""}`);
  const preparo = prepararPublicacaoDaPessoa(rascunho.doc, endereco);
  if ("frase" in preparo) return recusa(400, preparo.frase);
  const { doc } = preparo;

  // I3: a colisão estruturada, e a frase dela — nunca `parOcupado` (a do
  // painel). Contra LUGAR só (Task 17), e sem `exceto`: o lugar dela ainda não
  // existe, e o rascunho dela não entra na conta.
  if ((await colisaoDoPar(nomeDoRascunho(doc, ""), cidadeDoDoc(doc) ?? "", { exceto: null, nomeNovo: true, quem: "pessoa" })) !== null) {
    return recusa(409, NOME_JA_EM_USO);
  }

  const violacao = violacaoIntroduzidaInteira(await versoesAtuais(getClient(), { incluirOcultos: true }), endereco, null, doc);
  if (violacao !== null) return recusa(409, fraseDaPessoa(violacao, "publicar"));

  if (await publicarRascunho(getClient(), endereco, doc, agora, atualizadoEm, { contribuidor: id, chave })) {
    return Response.json({ slug: endereco }, { headers: { "cache-control": "no-store" } });
  }
  // 🔴 O bloqueio que chegou entre a porta e o batch (lição da Task 10): a
  // recusa é a MESMA da porta, e vem antes de "mudou"/"em uso"/"recarregue".
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  return recusa(409, await porQueRecusou(chave, endereco, atualizadoEm, id));
}
