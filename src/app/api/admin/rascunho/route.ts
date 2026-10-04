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
  CIDADE_SEM_LETRA,
  CIDADE_VAZIA,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  cidadeDoDoc,
  docDoLugarNovo,
  enderecoDeLugar,
  enderecoDeRascunho,
  enderecosDoLugar,
  nomeComCidade,
  nomeDoRascunho,
  parDeLugar,
  parDeRascunho,
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
 *   - `POST {nome, cidade}` — o lugar novo NASCE (Tarefa 11b: a cidade é
 *     obrigatória, e é ela que separa dois lugares de mesmo nome). O endereço
 *     sai dos dois (`enderecosDoLugar`); é recusado com frase quando o PAR
 *     (nome, cidade) já é de um lugar (inclusive ESCONDIDO) ou de um rascunho
 *     (`parOcupado`), ou quando todo endereço possível já é de um lugar ou de um
 *     rascunho. Nome repetido em OUTRA cidade nasce. 201 `{slug}`.
 *   - `PUT` — responde uma pergunta, nas formas de corpo da porta da ficha
 *     (`src/app/api/admin/ficha/route.ts`), mutuamente exclusivas:
 *       `{slug, campo, valor}` · `{slug, campo, naoSei: true}` ·
 *       `{slug, ponto, lat, lng}`.
 *     Renomear (`trajeto.waypoints.0.nome`) e mudar a `cidade` passam pela
 *     mesma colisão de PAR do POST — e o endereço não muda com nenhum dos dois;
 *     a coordenada do ponto só entra como PAR (a terceira forma).
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

/** 🔴 A COLISÃO POR PAR (NOME, CIDADE) — Tarefa 11b, 2026-10-04.
 *
 *  Até aqui a colisão era por NOME (onda de conserto 1 da Tarefa 11), e o João
 *  a desfez: dois lugares podem ter o mesmo nome, e às vezes a diferença é só a
 *  cidade. O que continua sendo o MESMO lugar é o par — mesmo nome E mesma
 *  cidade, comparados pela normalização do endereço (`slugDoNome`: sem acento,
 *  sem caixa, pontuação e espaços colapsados). Lido do DADO, e não do endereço,
 *  porque nem todo lugar tem endereço que sai do nome (um do acervo leva a
 *  cidade no endereço e não no nome): sem esta conferência, o gêmeo dele
 *  nasceria em outro endereço (11b-I4). Contra:
 *   - a versão ATUAL de todo lugar, SEM filtro de `oculto` — um lugar escondido
 *     é um lugar, e volta ao ar;
 *   - todo rascunho, menos `exceto` (o próprio, quando ele muda nome ou cidade).
 *  Devolve a frase da recusa — com o nome e a cidade de QUEM JÁ EXISTE —, ou
 *  `null` se o par está livre.
 *
 *  ⚠️ LUGAR SEM CIDADE NÃO COLIDE POR PAR: os que nasceram antes da 11b não têm
 *  cidade até o dono respondê-la pelo painel, e até lá um gêmeo de um deles
 *  entra sem aviso. Ninguém deduz a cidade por eles.
 *
 *  ⚠️ Esta conferência LÊ e depois a rota GRAVA — há janela entre as duas, ao
 *  contrário da porta do endereço (`criarRascunho`, uma consulta só). Aceita
 *  porque o painel tem um dono só; a normalização não cabe numa consulta SQL. */
async function parOcupado(nome: string, cidade: string, exceto?: string): Promise<string | null> {
  const n = slugDoNome(nome);
  const c = slugDoNome(cidade);
  if (n === "" || c === "") return null;
  const bate = (doc: string, slug: string): string | null => {
    const deles = cidadeDoDoc(doc);
    const nomeDeles = nomeDoRascunho(doc, slug);
    if (deles === undefined || slugDoNome(deles) !== c || slugDoNome(nomeDeles) !== n) return null;
    return nomeComCidade(nomeDeles, deles);
  };
  for (const v of (await versoesAtuais(getClient(), { incluirOcultos: true })).values()) {
    const quem = bate(v.doc, v.ficha_slug);
    if (quem !== null) return parDeLugar(quem);
  }
  for (const r of await listarRascunhos(getClient())) {
    if (r.slug === exceto) continue;
    const quem = bate(r.doc, r.slug);
    if (quem !== null) return parDeRascunho(quem);
  }
  return null;
}

/** QUEM OCUPA um endereço que `criarRascunho` recusou — a frase nomeia o lugar
 *  (ou o rascunho) que JÁ ESTÁ lá, com o nome e a cidade DELE, lidos do dado.
 *  `versaoAtual`, NUNCA a leitura pública (`versoesAtuais` sem
 *  `incluirOcultos`): com ela, um lugar escondido levaria a frase do rascunho. */
async function quemOcupa(slug: string): Promise<string> {
  const lugar = await versaoAtual(getClient(), slug);
  if (lugar !== null) return enderecoDeLugar(nomeComCidade(nomeDoRascunho(lugar.doc, slug), cidadeDoDoc(lugar.doc)));
  const r = await lerRascunho(getClient(), slug);
  const doc = r?.doc ?? "";
  return enderecoDeRascunho(nomeComCidade(nomeDoRascunho(doc, slug), cidadeDoDoc(doc)));
}

/** O campo que é o NOME do lugar (o ponto `0`). Renomear passa pela colisão de
 *  par, e mudar a `cidade` também. */
const CAMPO_DO_NOME = "trajeto.waypoints.0.nome";
const CAMPO_DA_CIDADE = "cidade";

export async function POST(req: Request): Promise<Response> {
  const fechada = porta(req);
  if (fechada) return fechada;

  const corpo = await corpoDe(req);
  // Exatamente `{nome, cidade}`: chave a mais (um `slug` escolhido por fora, por
  // exemplo) ou a menos (o corpo de antes da 11b, só com o nome) é corpo
  // malformado — o endereço sai do nome e da cidade, e de nada mais.
  if (
    corpo === null ||
    Object.keys(corpo).length !== 2 ||
    typeof corpo.nome !== "string" ||
    typeof corpo.cidade !== "string"
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  const cidade = corpo.cidade.trim();
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  if (cidade === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
  if (slugDoNome(nome) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  if (slugDoNome(cidade) === "") return new Response(CIDADE_SEM_LETRA, { status: 400, headers: TEXTO });

  // O PAR, antes do endereço. As duas recusas são de coisas DIFERENTES (o par
  // que bate com endereço outro × o endereço que bate com par outro), e cada
  // uma tem caso que só ela pega — não é a mesma porta duas vezes.
  const doPar = await parOcupado(nome, cidade);
  if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });

  // 🔴 A COLISÃO DE ENDEREÇO TEM UMA PORTA SÓ, e ela é a consulta de
  // `criarRascunho`: o INSERT só acontece se o slug não existe em
  // `ficha_rascunhos` NEM em `ficha_versoes` — sem filtro de `oculto`, porque um
  // lugar ESCONDIDO é um lugar: um rascunho com o slug dele seria publicado como
  // versão nova DELE, e com `oculto = 0`, desescondendo-o. Conferir e gravar na
  // mesma consulta também não deixa janela entre as duas coisas.
  //
  // Os endereços são tentados EM ORDEM (`enderecosDoLugar`: o sem repetir a
  // cidade, e a forma inteira atrás dele); o primeiro livre é o do lugar.
  const agora = Math.floor(Date.now() / 1000);
  const enderecos = enderecosDoLugar(nome, cidade);
  for (const slug of enderecos) {
    if (await criarRascunho(getClient(), slug, docDoLugarNovo(slug, nome, cidade), agora)) {
      return Response.json({ slug }, { status: 201, headers: SEM_CACHE });
    }
  }
  // Todos ocupados: só falta dizer POR QUEM — o do primeiro, que é o endereço
  // que este lugar teria.
  return new Response(await quemOcupa(enderecos[0]), { status: 409, headers: TEXTO });
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

  // Renomear, ou mudar a cidade, é a segunda porta do mesmo buraco do POST: um
  // rascunho que nasceu com outro par não pode virar o par de um lugar (ou de
  // outro rascunho) depois (11b-M3). O par novo é o valor que chega e a outra
  // metade como está no rascunho; rascunho sem a outra metade não colide.
  // Valor que não é texto segue adiante e é recusado pela folha.
  if ((campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE) && typeof valor === "string") {
    const nome = campo === CAMPO_DO_NOME ? valor : nomeDoRascunho(atual.doc, "");
    const cidade = campo === CAMPO_DA_CIDADE ? valor : (cidadeDoDoc(atual.doc) ?? "");
    const doPar = await parOcupado(nome, cidade, slug);
    if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });
  }

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
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
