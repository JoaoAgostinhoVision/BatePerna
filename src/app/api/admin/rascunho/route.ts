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
  salvarRascunho,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import {
  JA_EXISTE_LUGAR,
  JA_EXISTE_RASCUNHO,
  NOME_DE_TELA,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  SLUGS_RESERVADOS,
  docDoLugarNovo,
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
 *   - `POST {nome}` — o lugar novo NASCE. O slug sai do nome (`slugDoNome`); é
 *     recusado com frase quando já é de um lugar (inclusive ESCONDIDO), de um
 *     rascunho, ou de uma tela do app — e quando o NOME já é de um lugar ou de
 *     um rascunho, mesmo com endereço outro (`nomeOcupado`). 201 `{slug}`.
 *   - `PUT` — responde uma pergunta, nas formas de corpo da porta da ficha
 *     (`src/app/api/admin/ficha/route.ts`), mutuamente exclusivas:
 *       `{slug, campo, valor}` · `{slug, campo, naoSei: true}` ·
 *       `{slug, ponto, lat, lng}`.
 *     Renomear (o nome do ponto `0` mudar no documento, por qualquer grafia
 *     do caminho) passa pelas mesmas portas do nome do POST; a coordenada do ponto só entra como PAR (a terceira forma).
 *     A terceira existe pra o editor de coordenada servir aqui SEM MUDAR: ele
 *     grava o ponto do trajeto inteiro, num corpo só, por essa forma.
 *   - `GET` — a lista; com `?slug=`, o documento de um.
 *   - `DELETE {slug}` — tira o rascunho. Nunca toca em `ficha_versoes`.
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

/** 🔴 A COLISÃO POR NOME (onda de conserto 1 da Tarefa 11) — a que a frase
 *  `JA_EXISTE_LUGAR` sempre prometeu. O endereço sai do nome NO NASCIMENTO, mas
 *  nem todo lugar tem endereço que sai do nome dele (um leva a cidade), e o nome
 *  continua editável depois de nascer. Sem esta conferência, o nome EXATO de um
 *  lugar no ar fazia nascer um rascunho com outro slug — e publicá-lo poria dois
 *  lugares de mesmo nome na home.
 *
 *  O nome é o do ponto `0` (`nomeDoRascunho`, que serve a qualquer documento de
 *  lugar), comparado pela MESMA normalização do endereço (`slugDoNome`: sem
 *  acento, sem caixa, pontuação e espaços colapsados). Contra:
 *   - a versão ATUAL de todo lugar, SEM filtro de `oculto` — um lugar escondido
 *     é um lugar, e volta ao ar;
 *   - todo rascunho, menos `exceto` (o próprio, quando ele se renomeia).
 *  Devolve a frase da recusa, ou `null` se o nome está livre.
 *
 *  ⚠️ Esta conferência LÊ e depois a rota GRAVA — há janela entre as duas, ao
 *  contrário da porta do endereço (`criarRascunho`, uma consulta só). Aceita
 *  porque o painel tem um dono só; a normalização não cabe numa consulta SQL. */
async function nomeOcupado(nome: string, exceto?: string): Promise<string | null> {
  const alvo = slugDoNome(nome);
  for (const v of (await versoesAtuais(getClient(), { incluirOcultos: true })).values()) {
    if (slugDoNome(nomeDoRascunho(v.doc, v.ficha_slug)) === alvo) return JA_EXISTE_LUGAR;
  }
  for (const r of await listarRascunhos(getClient())) {
    if (r.slug !== exceto && slugDoNome(nomeDoRascunho(r.doc, r.slug)) === alvo) return JA_EXISTE_RASCUNHO;
  }
  return null;
}

/** 🔴 AS PORTAS DO NOME, numa função só — o POST (o lugar nasce) e o PUT (ele se
 *  renomeia) passam pelas MESMAS, na MESMA ordem: em branco → `NOME_VAZIO`; sem
 *  letra nem número → `NOME_SEM_LETRA`; nome de tela do app → `NOME_DE_TELA`;
 *  nome de um lugar ou de outro rascunho → `nomeOcupado`. Devolve a recusa, ou
 *  `null` se o nome passa. `exceto` é o próprio rascunho, quando ele se renomeia.
 *
 *  Até a onda 3 o PUT tinha uma cópia parcial disto (só a colisão), e um
 *  rascunho podia virar "!!!" pelo PUT, que o POST recusava. */
async function recusaDoNome(nome: string, exceto?: string): Promise<Response | null> {
  // Sem `trim` aqui, e foi medido: o POST já apara antes de chamar, e no PUT o
  // nome em branco nunca chega (a folha recusa a caixa vazia antes) — com ou
  // sem `trim`, `slugDoNome` e `nomeOcupado` decidem igual, e a mutação que o
  // tirava sobrevivia à suíte inteira por ser equivalente.
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  const slug = slugDoNome(nome);
  if (slug === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  if (SLUGS_RESERVADOS.includes(slug)) return new Response(NOME_DE_TELA, { status: 409, headers: TEXTO });
  const ocupado = await nomeOcupado(nome, exceto);
  return ocupado === null ? null : new Response(ocupado, { status: 409, headers: TEXTO });
}

export async function POST(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const corpo = await corpoDe(req);
  // Exatamente `{nome}`: chave a mais (um `slug` escolhido por fora, por
  // exemplo) é corpo malformado — o endereço sai do nome, e de nada mais.
  if (corpo === null || Object.keys(corpo).length !== 1 || typeof corpo.nome !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  // O NOME, antes do endereço. As duas recusas são de coisas DIFERENTES (o nome
  // que bate com endereço outro × o endereço que bate com nome outro), e cada
  // uma tem caso que só ela pega — não é a mesma porta duas vezes.
  const doNome = await recusaDoNome(nome);
  if (doNome !== null) return doNome;
  const slug = slugDoNome(nome);

  // 🔴 A COLISÃO TEM UMA PORTA SÓ, e ela é a consulta de `criarRascunho`: o
  // INSERT só acontece se o slug não existe em `ficha_rascunhos` NEM em
  // `ficha_versoes` — sem filtro de `oculto`, porque um lugar ESCONDIDO é um
  // lugar: um rascunho com o slug dele seria publicado como versão nova DELE, e
  // com `oculto = 0`, desescondendo-o. Uma conferência a mais aqui, antes do
  // INSERT, seria a segunda porta em série (a de baixo recusa igual, e a de cima
  // ficaria sem prova nenhuma — espécie 47 do catálogo); conferir e gravar na
  // mesma consulta também não deixa janela entre as duas coisas.
  const agora = Math.floor(Date.now() / 1000);
  if (!(await criarRascunho(getClient(), slug, docDoLugarNovo(slug, nome), agora))) {
    // Recusado: só falta dizer POR QUÊ. `versaoAtual`, NUNCA a leitura pública
    // (`versoesAtuais` sem `incluirOcultos`), pela mesma razão do escondido: com
    // ela, o nome de um lugar escondido levaria a frase do rascunho.
    const lugar = (await versaoAtual(getClient(), slug)) !== null;
    return new Response(lugar ? JA_EXISTE_LUGAR : JA_EXISTE_RASCUNHO, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { status: 201, headers: SEM_CACHE });
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

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
  }

  // 🔴 RENOMEAR passa pelas portas do POST (`recusaDoNome`), e quem decide se
  // houve renomeação é o RESULTADO — o nome do ponto `0` no documento novo
  // contra o do atual —, nunca o texto do caminho pedido. Até a onda 3 era
  // `campo === "trajeto.waypoints.0.nome"`, e `trajeto.waypoints.00.nome` (que
  // `escrever` lê como o índice 0) renomeava o rascunho pro nome exato de um
  // lugar no ar. Nome que não mudou não paga a leitura, e um rascunho que já
  // tinha um nome colidindo continua respondendo as outras perguntas.
  //   O nome em branco nunca chega aqui (a folha recusa a caixa vazia antes), e
  // por isso o recuo de `nomeDoRascunho` pro slug não pesa: medido, ler o nome
  // cru em vez dele era mutação equivalente.
  const nomeNovo = nomeDoRascunho(novoDoc, slug);
  if (nomeNovo !== nomeDoRascunho(atual.doc, slug)) {
    const recusa = await recusaDoNome(nomeNovo, slug);
    if (recusa !== null) return recusa;
  }
  await salvarRascunho(getClient(), slug, novoDoc, Math.floor(Date.now() / 1000));
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
  // não apaga nada, nunca uma porta pra tirar lugar do ar.
  await apagarRascunho(getClient(), corpo.slug);
  return Response.json({ slug: corpo.slug }, { headers: SEM_CACHE });
}
