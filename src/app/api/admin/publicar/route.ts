import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, lerRascunho, publicarRascunho, versaoAtual, versoesAtuais } from "@/lib/db";
import { parOcupado, travaDoPainel } from "@/lib/par-de-lugar";
import { violacaoIntroduzida } from "@/lib/porta-de-coerencia";
import {
  ENDERECO_AINDA_NAO_SAIU,
  JA_PUBLICADO_OU_OCUPADO,
  NADA_PUBLICADO,
  RASCUNHO_MUDOU,
  RASCUNHO_SUMIU,
  prepararPublicacao,
} from "@/lib/porta-de-publicar";
import { cidadeDoDoc, enderecoDeLugar, nomeComCidade, nomeDoRascunho, slugDoNome } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const SEM_CACHE = { "cache-control": "no-store" } as const;

const recusa = (status: 400 | 409, frase: string): Response => new Response(frase, { status, headers: TEXTO });

/** A FRASE DE UM PUBLICAR QUE O BANCO RECUSOU — escolhida por leitura DEPOIS da
 *  recusa, no molde de `quemOcupaNoPainel` (`par-de-lugar.ts`), que nomeia quem
 *  ocupa o endereço que um `moverRascunho` recusou (a leitura nunca DECIDE
 *  recusar: quem decidiu foi o portão do batch, no instante da gravação).
 *  `versaoAtual`, NUNCA a leitura pública: um lugar ESCONDIDO ocupa o endereço
 *  do mesmo jeito, e a frase tem de nomeá-lo. */
async function porQueRecusou(slug: string, atualizadoEm: number): Promise<string> {
  const lugar = await versaoAtual(getClient(), slug);
  const rascunho = await lerRascunho(getClient(), slug);
  if (rascunho !== null && rascunho.atualizado_em !== atualizadoEm) return RASCUNHO_MUDOU;
  if (lugar !== null && rascunho === null) return JA_PUBLICADO_OU_OCUPADO;
  if (lugar !== null) return enderecoDeLugar(nomeComCidade(nomeDoRascunho(lugar.doc, slug), cidadeDoDoc(lugar.doc)));
  if (rascunho === null) return RASCUNHO_SUMIU;
  return NADA_PUBLICADO;
}

/** `POST /api/admin/publicar {slug, atualizadoEm}` — o rascunho de `slug` vai
 *  ao ar como a VERSÃO 1 de um lugar novo, e deixa de ser rascunho (Tarefa 12).
 *
 *  `atualizadoEm` é a IDENTIDADE do rascunho (I1 da auditoria de 06/10): o
 *  `atualizado_em` que a página de publicar leu junto com a lista do que o app
 *  vai calar. O que vai ao ar é o que o dono viu — se o rascunho mudou depois
 *  (outro "Salvar", um rename noutra aba), 409 e nada gravado.
 *
 *  🔴 A ORDEM: config (404) → sessão (401) → corpo (400) → o rascunho que a tela
 *  leu (409) → o DOCUMENTO (`prepararPublicacao`: obrigatórios do registro,
 *  horário, schema, `slug` de dentro — 400 com frase) → a CHAVE é o
 *  `nome-cidade` (409) → o PAR (nome, cidade) (409) → a COERÊNCIA (409) → o
 *  banco (`publicarRascunho`: 409 se o endereço já é de um lugar ou o
 *  rascunho mudou no meio). Toda recusa deixa o banco
 *  como estava: o rascunho continua lá.
 *
 *  🔴 A COLISÃO DE ENDEREÇO TEM UMA PORTA SÓ, e ela é o `NOT EXISTS` do 1º passo
 *  do batch, sem filtro de `oculto` (G1 e I4 da auditoria): um lugar ESCONDIDO é
 *  um lugar, e publicar por cima dele gravaria uma versão nova NO HISTÓRICO
 *  DELE, desescondendo-o. Nenhum pré-cheque em JS: entre ler e gravar é
 *  exatamente onde um lugar pode nascer.
 *
 *  🔴 O PAR (12-M1): mesmo nome E mesma cidade de outro lugar (inclusive
 *  escondido) ou de outro rascunho é 409 — `parOcupado` com a cidade do
 *  documento e `nomeNovo: true` (o par E a espera do gêmeo sem cidade), e
 *  `exceto: slug`, senão o rascunho colidiria consigo mesmo. Desde 17/10 não é
 *  mais a régua do POST: o POST chama sem cidade (`parOcupado(nome, "")`, só o
 *  gêmeo), e o par com cidade é conferido no PONTO, com `nomeNovo: false`.
 *  Esta conferência LÊ e depois o batch GRAVA; a janela é a de toda
 *  `colisaoDoPar`, aceita pelo motivo escrito lá (`par-de-lugar.ts`). NOME
 *  REPETIDO NOUTRA CIDADE PUBLICA (decisão do João de 04/10, G1′).
 *
 *  🔴 A COERÊNCIA POR DIFERENÇA (12-I2): o acervo de agora, COM os escondidos,
 *  sem e com o lugar novo — só a violação que ESTA publicação introduz é 409.
 *  Uma violação antiga de outro lugar não trava publicação nenhuma. */
export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  // Exatamente `{slug, atualizadoEm}`: `atualizadoEm` inteiro ≥ 0 (o
  // `JSON.parse` vira `1e999` em `Infinity`, que o driver estoura).
  if (
    typeof corpo !== "object" ||
    corpo === null ||
    Array.isArray(corpo) ||
    Object.keys(corpo).length !== 2 ||
    typeof (corpo as { slug?: unknown }).slug !== "string" ||
    !Number.isSafeInteger((corpo as { atualizadoEm?: unknown }).atualizadoEm) ||
    ((corpo as { atualizadoEm: number }).atualizadoEm) < 0
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const { slug, atualizadoEm } = corpo as { slug: string; atualizadoEm: number };

  // O rascunho que a tela leu. Se não é mais ele, nem se confere o documento:
  // a frase de quem venceu vem da mesma leitura de uma recusa do banco.
  const rascunho = await lerRascunho(getClient(), slug);
  if (rascunho === null || rascunho.atualizado_em !== atualizadoEm) {
    return recusa(409, await porQueRecusou(slug, atualizadoEm));
  }

  const preparo = prepararPublicacao(rascunho.doc, slug);
  if ("frase" in preparo) return recusa(400, preparo.frase);
  const { doc } = preparo;

  // 🔴 A CHAVE TEM DE SER O `nome-cidade` DO DOCUMENTO (17/10, Review Focus 4).
  // O rascunho do painel nasce numa chave provisória (`rascunho_<hex>`) e só se
  // muda pro endereço quando o ponto traz a cidade e o par e o endereço estão
  // livres; senão FICA na provisória (a saída (b), `PUT` do rascunho). Publicar
  // dali poria no ar um lugar em `/rascunho_…`, um endereço que nada no app
  // produz — e o `prepararPublicacao` não vê, porque o `slug` de dentro
  // acompanha a chave. A frase diz o que impede (`travaDoPainel`), ou, se nada
  // impede mais, que o endereço ainda não saiu. A `cidade` está lá: ela é
  // obrigatória, e `prepararPublicacao` já conferiu.
  const nome = nomeDoRascunho(doc, "");
  if (slug !== slugDoNome(`${nome} ${cidadeDoDoc(doc) ?? ""}`)) {
    return recusa(409, (await travaDoPainel(doc, slug)) ?? ENDERECO_AINDA_NAO_SAIU);
  }

  const doPar = await parOcupado(nome, cidadeDoDoc(doc) ?? "", { exceto: slug, nomeNovo: true });
  if (doPar !== null) return recusa(409, doPar);

  const versoes = await versoesAtuais(getClient(), { incluirOcultos: true });
  const aDizer = violacaoIntroduzida(versoes, slug, null, doc);
  if (aDizer !== null) return recusa(409, aDizer);

  if (await publicarRascunho(getClient(), slug, doc, agora, atualizadoEm)) {
    return Response.json({ slug }, { headers: SEM_CACHE });
  }
  return recusa(409, await porQueRecusou(slug, atualizadoEm));
}
