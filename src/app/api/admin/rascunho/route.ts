import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import {
  aplicarNoRascunho,
  campoPorCaminho,
  gravarPontoNoRascunho,
  tirarDoRascunho,
  type ValorDeCampo,
} from "@/lib/campos-da-ficha";
import {
  apagarRascunho,
  criarRascunho,
  getClient,
  lerRascunho,
  listarRascunhos,
  moverRascunho,
  regravarRascunho,
} from "@/lib/db";
import { novaChaveDeRascunho } from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, parDaMudanca, parOcupado, quemOcupaNoPainel } from "@/lib/par-de-lugar";
import {
  CIDADE_VAZIA,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  RASCUNHO_NAO_EXISTE_MAIS,
  cidadeDoDoc,
  docDoLugarNovo,
  docNoEndereco,
  nomeDoRascunho,
  slugDoNome,
} from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const SEM_CACHE = { "cache-control": "no-store" } as const;

/** A PORTA DO RASCUNHO (Tarefa 11) — o lugar novo, antes de ir ao ar.
 *
 *  Quatro métodos, e todos começam pela MESMA guarda (`porta`): config →
 *  sessão, na ordem das rotas irmãs do admin. Painel desligado não anuncia que
 *  existe (404); sessão ruim nunca toca o banco (401).
 *
 *   - `POST {nome}` — o lugar novo NASCE, só do nome (17/10: a cidade vem do
 *     ponto que ele marca no mapa, não de uma caixa). Não há endereço sem
 *     cidade, então o rascunho nasce numa CHAVE PROVISÓRIA (`rascunho_<hex>`,
 *     a mesma de quem usa o app) e o `slug` de dentro do documento é essa
 *     chave. É recusado com frase só quando um LUGAR de MESMO nome ainda não
 *     tem cidade (o gêmeo, `parOcupado`): rascunho dele sem cidade não conta, e
 *     rascunho de quem usa o app nunca (Task 17: nenhum rascunho ocupa nome).
 *     Dois rascunhos do João com o mesmo nome, sem cidade, nascem os dois.
 *     201 `{slug}` com a chave.
 *   - `PUT` — responde uma pergunta, nas formas de corpo da porta da ficha
 *     (`src/app/api/admin/ficha/route.ts`), mutuamente exclusivas:
 *       `{slug, campo, valor}` · `{slug, campo, naoSei: true}` ·
 *       `{slug, ponto, lat, lng}`.
 *     Renomear (`trajeto.waypoints.0.nome`) e mudar a `cidade` passam pela
 *     colisão de PAR (`parDaMudanca`) — e, quando o documento JÁ TEM cidade, o
 *     endereço do rascunho ACOMPANHA os dois (`moverRascunho`): a resposta é
 *     `{slug}` com o endereço de agora. Sem cidade no documento, renomear só
 *     regrava: a chave não anda;
 *     a coordenada do ponto só entra como PAR (a terceira forma).
 *     A terceira existe pra o editor de coordenada servir aqui SEM MUDAR: ele
 *     grava o ponto do trajeto inteiro, num corpo só, por essa forma.
 *   - `GET` — a lista; com `?slug=`, o documento de um.
 *   - `DELETE {slug}` — tira o rascunho. Nunca toca em `ficha_versoes`. 200
 *     `{slug}` quando apagou; **404** (corpo vazio) quando não havia rascunho
 *     naquele endereço — movido noutra aba (o nome ou a cidade mudou),
 *     publicado, ou já apagado. Antes era 200 nos dois, e a tela de desistir
 *     voltava ao painel como se tivesse desistido, com o rascunho ainda lá sob
 *     o endereço novo (M1 da revisão da Tarefa 15).
 *
 *  🔴 O QUE ESTA PORTA NÃO FAZ, E É O PONTO: `fichaSchema.parse` do documento
 *  inteiro e o portão de coerência. Rascunho incompleto é o estado normal, e a
 *  coerência compara fichas que AFIRMAM — rascunho não afirma nada. Os dois são
 *  de publicar (Tarefa 12). Cada FOLHA, essa sim, é conferida contra o tipo
 *  dela (ver `aplicarNoRascunho`). */
function porta(req: Request): Response | null {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  if (!sessaoValida(process.env, tokenDoCookie(req), Math.floor(Date.now() / 1000))) {
    return new Response("", { status: 401 });
  }
  return null;
}

/** O corpo como objeto, ou `null` — JSON quebrado e `null` (que é JSON válido)
 *  caem os dois aqui. */
async function corpoDe(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 400 COM a frase quando ela é nossa (`Error` exato, em português) e vazio
 *  quando não é. É a régua do `recusar400` da porta da ficha, pelo mesmo
 *  motivo: `SyntaxError` de um documento corrompido ecoaria o conteúdo bruto, em
 *  inglês, no celular dele. (Cópia de três linhas: um arquivo de rota do Next
 *  não pode exportar nada além dos métodos.) */
function recusar400(erro: unknown): Response {
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

export async function POST(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const corpo = await corpoDe(req);
  // Exatamente `{nome}`: chave a mais (uma `cidade`, um `slug` escolhido por
  // fora) ou a menos é corpo malformado — o rascunho nasce do nome, e de nada
  // mais.
  if (corpo === null || Object.keys(corpo).length !== 1 || typeof corpo.nome !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  if (slugDoNome(nome) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });

  // O gêmeo de um LUGAR sem cidade (spec §2.3.1): com a cidade vazia, só ele
  // dispara — o par precisa dos dois lados.
  const doPar = await parOcupado(nome, "", { exceto: null, nomeNovo: true });
  if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });

  // 🔴 A CHAVE É PROVISÓRIA E NUNCA É UM ENDEREÇO (`novaChaveDeRascunho`): sem
  // cidade não há endereço. O `slug` de dentro é a chave — o documento não pode
  // dizer um endereço e morar noutro (`docNoEndereco`). Quando a pessoa marcar
  // o ponto e a cidade chegar, o rascunho muda de endereço pela consulta única
  // de `moverRascunho` (o PUT), que é quem recusa endereço ocupado.
  const agora = Math.floor(Date.now() / 1000);
  const chave = novaChaveDeRascunho();
  if (await criarRascunho(getClient(), chave, docDoLugarNovo(chave, nome), agora)) {
    return Response.json({ slug: chave }, { status: 201, headers: SEM_CACHE });
  }
  // A chave é um UUID novo: recusa aqui só se o banco falhou em silêncio.
  return new Response("", { status: 500, headers: TEXTO });
}

export async function PUT(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  const { slug, campo, valor, naoSei, ponto, lat, lng } = corpo;

  // As famílias de chave, e EXATAMENTE UMA presente — a mesma contagem da porta
  // da ficha, e pelo mesmo motivo: um corpo nunca pede duas coisas de uma vez.
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  if (trazCampo === trazPonto) return new Response("", { status: 400, headers: TEXTO });

  let mudar: (doc: string) => string;
  if (trazPonto) {
    if (
      typeof ponto !== "number" ||
      !Number.isInteger(ponto) ||
      ponto < 0 ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    mudar = (doc) => gravarPontoNoRascunho(doc, ponto, lat, lng);
  } else {
    // Exatamente um de `valor` ou `naoSei`, e `naoSei` só vale `true` — as duas
    // decisões da porta da ficha (Tarefa 3), pelos mesmos motivos.
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei) return new Response("", { status: 400, headers: TEXTO });
    if (trazNaoSei && naoSei !== true) return new Response("", { status: 400, headers: TEXTO });
    // A lista branca do registro: `slug` e `modos` não são perguntas.
    if (typeof campo !== "string" || campoPorCaminho(campo) === undefined) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    mudar = (doc) => (trazNaoSei ? tirarDoRascunho(doc, campo) : aplicarNoRascunho(doc, campo, valor as ValorDeCampo));
  }

  // 🔴 O PUT NUNCA FAZ UM RASCUNHO NASCER. Sem rascunho, 400 — e é isto que
  // impede um PUT com o slug de um lugar no ar de criar um rascunho por cima
  // dele, pulando a conferência de colisão que só o POST faz.
  const atual = await lerRascunho(getClient(), slug);
  if (atual === null) return new Response("", { status: 400, headers: TEXTO });

  // Renomear, ou mudar a cidade, passa pelo PAR (11b-M3) — a função é a mesma
  // da ficha no ar, e desde 17/10 é aqui que o par de verdade se confere: o POST
  // nasce sem cidade e só vê o gêmeo. Valor que não é texto segue adiante e é
  // recusado pela folha. Mudar só a cidade nunca esbarra no gêmeo sem cidade
  // (Y1 da onda de fix 2): ver `parOcupado`.
  const doPar = await parDaMudanca(atual.doc, slug, campo, valor);
  if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
  }
  const agora = Math.floor(Date.now() / 1000);

  // 🔴 O ENDEREÇO DO RASCUNHO ACOMPANHA O NOME E A CIDADE (onda de fix 2 da 11b,
  // Y2 — o I-N2 da re-revisão). Congelado, um rascunho corrigido de cidade
  // continuava no endereço da cidade errada: o lugar real daquela cidade não
  // nascia mais (a frase mandava "mudar um pouco o nome" dele), e a Tarefa 12
  // publicaria com aquele endereço. Rascunho não tem link circulando; o lugar
  // NO AR, esse sim, guarda o endereço com que nasceu (a porta da ficha nunca
  // muda endereço). A troca de chave é UMA consulta (`moverRascunho`), recusada
  // quando o endereço novo já é de outro — e a resposta devolve o endereço de
  // AGORA, que é por onde o formulário segue.
  // O nome com letra vale sempre; o resto só quando o documento JÁ TEM cidade:
  // antes do ponto, renomear só regrava (a chave provisória não anda, e nada
  // pede cidade).
  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE)) {
    if (slugDoNome(nomeDoRascunho(novoDoc, "")) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  }
  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE) && cidadeDoDoc(novoDoc) !== undefined) {
    // As duas metades com letra: é o hífen no meio que nunca deixa o endereço
    // cair numa tela do app.
    if (slugDoNome(cidadeDoDoc(novoDoc) ?? "") === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
    const destino = slugDoNome(`${nomeDoRascunho(novoDoc, "")} ${cidadeDoDoc(novoDoc)}`);
    if (destino !== slug) {
      if (await moverRascunho(getClient(), slug, destino, docNoEndereco(novoDoc, destino), agora)) {
        return Response.json({ slug: destino }, { headers: SEM_CACHE });
      }
      // A recusa pode ser do ORIGEM, não do destino (M4 da revisão da Tarefa
      // 12): entre a leitura lá em cima e o `moverRascunho`, o rascunho foi
      // publicado, apagado ou movido noutra aba. Nomear "quem ocupa" o destino
      // seria falso — ele pode estar livre.
      if ((await lerRascunho(getClient(), slug)) === null) {
        return new Response(RASCUNHO_NAO_EXISTE_MAIS, { status: 409, headers: TEXTO });
      }
      return new Response(await quemOcupaNoPainel(destino), { status: 409, headers: TEXTO });
    }
  }
  // 🔴 `UPDATE`, NUNCA UPSERT (Tarefa 12, I1 da auditoria de 06/10): entre a
  // leitura lá em cima e esta gravação, o rascunho pode ter sido PUBLICADO (ou
  // apagado, ou movido noutra aba). O upsert o recriava em `slug` — ao lado do
  // lugar que acabou de ir ao ar no mesmo endereço — e a resposta dele ficava
  // fora do lugar no ar, em silêncio. Sem linha, 409 com a frase, nada gravado.
  if (!(await regravarRascunho(getClient(), slug, novoDoc, agora))) {
    return new Response(RASCUNHO_NAO_EXISTE_MAIS, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { headers: SEM_CACHE });
}

export async function GET(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const slug = new URL(req.url).searchParams.get("slug");
  if (slug !== null) {
    const r = await lerRascunho(getClient(), slug);
    if (r === null) return new Response("", { status: 404, headers: TEXTO });
    return Response.json({ slug: r.slug, doc: JSON.parse(r.doc) }, { headers: SEM_CACHE });
  }
  const rascunhos = (await listarRascunhos(getClient())).map((r) => ({
    slug: r.slug,
    nome: nomeDoRascunho(r.doc, r.slug),
    atualizado_em: r.atualizado_em,
  }));
  return Response.json({ rascunhos }, { headers: SEM_CACHE });
}

export async function DELETE(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  // Só `ficha_rascunhos`: um slug de lugar no ar sem rascunho é um DELETE que
  // não apaga nada, nunca uma porta pra tirar lugar do ar — e responde 404,
  // como todo endereço sem rascunho: "não apagou" nunca sai como sucesso.
  if (!(await apagarRascunho(getClient(), corpo.slug))) return new Response("", { status: 404, headers: TEXTO });
  return Response.json({ slug: corpo.slug }, { headers: SEM_CACHE });
}
