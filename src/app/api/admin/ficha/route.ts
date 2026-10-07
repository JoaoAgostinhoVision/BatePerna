import { ZodError } from "zod";
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, gravarEdicao, versaoAtual, versaoPorId, versoesAtuais } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";
import {
  RecusaDoTrajeto,
  acrescentarEtapa,
  aplicarCampo,
  campoPorCaminho,
  gravarPonto,
  removerCampo,
  tirarEtapa,
  type ValorDeCampo,
} from "@/lib/campos-da-ficha";
import { parDaMudanca, parDaTroca } from "@/lib/par-de-lugar";
import { violacaoIntroduzida } from "@/lib/porta-de-coerencia";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";
import { fichaSchema } from "@/types/ficha";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** Traduz o estouro de `aplicarCampo`/`removerCampo` em 400 **com a frase no
 *  corpo**.
 *
 *  🔴 ATÉ 2026-09-27 ESTA ROTA DEVOLVIA `""` EM TODO 400, e as frases de
 *  `campos-da-ficha.ts` morriam aqui — MEDIDO no Step 0 da Tarefa 3:
 *  `{campo: "horario.abre"}` numa ficha sem `horario` devolvia 400 com corpo
 *  vazio. A frase existe justamente pra dizer ao dono O QUE FAZER
 *  ("preencha o `horario` inteiro de uma vez"), e descartá-la na porta é a
 *  régua inalcançável de novo: ele leva um 400 e não sabe o que mudou.
 *
 *  ⚠️ ZodError NÃO VAZA. A `message` dele é um JSON de `invalid_type`, que não
 *  é português e não diz nada a ninguém — ali o corpo continua vazio. Todo
 *  caminho que tem frase pra ele já a escreveu à mão (`recusarVazio`,
 *  `validarFolha`, `conferirFaixas`, `exigirCampo`); o que sobra pro zod é o
 *  documento inteiro não fechando, e disso o dono não tem o que fazer campo a
 *  campo. */
function recusar400(erro: unknown): Response {
  // 🔴 SÓ AS NOSSAS FRASES VÃO PRO CELULAR DELE, e a régua é a CLASSE do erro:
  // tudo o que este app escreve pra ele é `new Error(...)` com frase em
  // português (ver `campos-da-ficha.ts`), enquanto `ZodError`, `SyntaxError` e
  // `TypeError` são subclasses. Sem esta régua, um documento corrompido no banco
  // devolvia `Unexpected token 'i', "isto nao e json" is not valid JSON` — em
  // inglês, com o conteúdo bruto do documento ecoado —, medido por um re-revisor
  // em 27/09. É o mesmo mal que a guarda do `ZodError` já existia pra impedir.
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

/* O PAR, a CONTAGEM e o ACERVO-COMO da coerência moravam aqui até a Tarefa 12
   e foram pra `src/lib/porta-de-coerencia.ts`, SEM MUDAR A CONTA: a porta de
   publicar passou a precisar da mesma régua, e um arquivo de rota do Next não
   exporta nada além dos métodos. O porquê de cada escolha (o par e não a
   frase, a contagem e não o conjunto, o ilegível que fica de fora) foi junto. */

/** Grava um campo novo sobre a ficha de `slug`, como uma versão NOVA em
 *  `ficha_versoes` — nunca um UPDATE (a tabela é append-only, ver `db.ts`).
 *
 *  🔴 A ORDEM DAS GUARDAS é a mesma das outras rotas do admin: config → sessão
 *  → corpo → domínio (`campoPorCaminho`, `versaoAtual`) → validação do
 *  documento inteiro (`aplicarCampo`) → grava. Painel desligado nunca gasta
 *  banco; sessão ruim nunca lê o campo pedido.
 *
 *  🔴 Task 7 (2026-09-26): o corpo agora aceita DOIS formatos — `{slug,
 *  campo, valor}` (editar um campo, Task 6) OU `{slug, versaoId}` (voltar a
 *  uma versão antiga). Nunca os dois juntos, nunca nenhum dos dois — as duas
 *  guardas de cima (config, sessão) valem pros dois formatos igual.
 *
 *  🔴 Task 3 da rodada do painel completo (2026-09-27): eram TRÊS formatos (hoje são seis, ver a lista), e a
 *  ordem ganhou um degrau NOVO no fim — a COERÊNCIA DO ACERVO.
 *
 *   - `{slug, campo, valor}`   — grava aquele campo
 *   - `{slug, campo, naoSei}`  — TIRA a chave (`naoSei` tem que ser `true`)
 *   - `{slug, versaoId}`       — volta a uma versão (não passa pela coerência)
 *   - `{slug, ponto, lat, lng}` — grava a coordenada INTEIRA do ponto `ponto`
 *     do trajeto, numa versão só (Tarefa 8, onda de conserto 1). O índice tem
 *     de existir; passa pela coerência e herda a visibilidade como as outras.
 *   - `{slug, acrescentarEtapa: {nome, lat, lng}}` — acrescenta um ponto no FIM
 *     do trajeto, na coordenada que o dono marcou no mapa (Tarefa 10, onda 1).
 *   - `{slug, tirarEtapa: N}` — tira o ÚLTIMO ponto; `N` tem de ser o índice
 *     dele e nunca `0`, que é o lugar (409 com frase) (Tarefa 10).
 *  As duas da Tarefa 10 passam pela coerência e herdam a visibilidade, pelo
 *  MESMO caminho das outras (ver `mudar`).
 *  E TODAS as seis levam junto `baseId`, a versão que a tela abriu (onda de fix
 *  2 da 11e, M6): sem ele, 400; com ele de OUTRO lugar, 409 e nada gravado.
 *
 *  ⚠️ E EXISTIA UM QUARTO, NÃO DECLARADO, que esta tarefa fecha — medido no
 *  Step 0: `{slug, campo: "piso"}`, **sem `valor` e sem `naoSei`**, gravava 200
 *  e o campo SUMIA da ficha. `aplicarCampo(doc, "piso", undefined)` escrevia
 *  `piso: undefined`, o zod aceitava (é `.optional()`) e o `JSON.stringify`
 *  descartava a chave. Era um "não sei" ACIDENTAL: não passava por
 *  `removerCampo`, então não tinha a checagem de campo obrigatório nem a frase
 *  que diz o que fazer — um corpo malformado apagava dado de um lugar real. */
export async function PUT(req: Request): Promise<Response> {
  // 🔴 404, não 401: painel desligado não anuncia que existe. Mesma regra da
  // rota de aviso, e vem ANTES da sessão pela mesma razão — sem ADMIN_SENHA
  // não existe segredo pra validar sessão nenhuma.
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }

  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  // 🔴 `null` é JSON válido — não estoura o catch acima — mas destructurar
  // `null` estoura na hora. Mesma guarda da rota de aviso.
  if (typeof body !== "object" || body === null) return new Response("", { status: 400, headers: TEXTO });

  const corpo = body as {
    slug?: unknown;
    campo?: unknown;
    valor?: unknown;
    naoSei?: unknown;
    versaoId?: unknown;
    baseId?: unknown;
    ponto?: unknown;
    lat?: unknown;
    lng?: unknown;
    acrescentarEtapa?: unknown;
    tirarEtapa?: unknown;
  };
  const { slug, campo, valor, naoSei, versaoId, ponto, lat, lng, acrescentarEtapa: etapaNova, tirarEtapa: etapaFora } =
    corpo;
  if (typeof slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  // 🔴 A VERSÃO QUE A TELA ABRIU, EM TODA FORMA DE CORPO (onda de fix 2 da 11e,
  // M6): é ela, e não o endereço, que diz DE QUAL LUGAR é a gravação. Quem
  // confere é `gravarEdicao`, no mesmo INSERT. Não é uma família de chave: vem
  // junto de qualquer uma, e não entra na contagem abaixo.
  const { baseId } = corpo;
  if (!baseIdValido(baseId)) return new Response("", { status: 400, headers: TEXTO });

  // 🔴 C6 da revisão do controlador: os dois formatos são MUTUAMENTE
  // EXCLUSIVOS. `"campo" in corpo` (e não `campo !== undefined`) porque
  // `JSON.parse` nunca produz `undefined` como valor de chave presente — a
  // checagem lê exatamente o que chegou no corpo, não uma coincidência de
  // tipo. Nem os dois formatos juntos, nem nenhum dos dois: 400.
  //
  // 🔴 DESDE A TAREFA 8 (onda de conserto 1) ERAM TRÊS FAMÍLIAS DE CHAVE (CINCO
  // desde a Tarefa 10, ver logo abaixo), e
  // EXATAMENTE UMA tem de estar presente. A família `ponto` (`ponto`/`lat`/`lng`)
  // grava a coordenada de um ponto do trajeto ATÔMICA. Forma nova entra aqui
  // como mais uma linha `traz…` e mais um item da contagem — e a contagem é o
  // que impede um corpo de pedir duas coisas de uma vez.
  const trazVersaoId = "versaoId" in corpo;
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  // 🔴 TAREFA 10: mais duas famílias, uma chave cada. Acrescentar e tirar são
  // famílias SEPARADAS (e não uma chave `etapa` com dois modos) pra que um corpo
  // com as duas caia na contagem como qualquer outro corpo misto.
  const trazAcrescentar = "acrescentarEtapa" in corpo;
  const trazTirar = "tirarEtapa" in corpo;
  if ([trazVersaoId, trazCampo, trazPonto, trazAcrescentar, trazTirar].filter(Boolean).length !== 1) {
    return new Response("", { status: 400, headers: TEXTO });
  }

  if (trazVersaoId) {
    // 🔴 M1 DA REVISÃO FINAL (2026-09-26): `typeof versaoId !== "number"`
    // deixava passar `1.5`, `-1` e `1e999` — este último o `JSON.parse`
    // converte em `Infinity`, e o `@libsql/client` lança `RangeError` com
    // `Infinity` como parâmetro, uma exceção NÃO TRATADA numa rota que
    // devolve 400 controlado em todos os outros pontos. Mesma forma da rota
    // irmã (`src/app/api/admin/aviso/route.ts`).
    if (typeof versaoId !== "number" || !Number.isInteger(versaoId) || versaoId <= 0) {
      return new Response("", { status: 400, headers: TEXTO });
    }

    const versao = await versaoPorId(getClient(), versaoId);
    // 🔴 A LINHA VERMELHA: sem conferir que a versão pertence a ESTE slug, um
    // `versaoId` qualquer põe a voz de um lugar na ficha de outro — o
    // defeito que este projeto mais caça, agora com ajuda do banco.
    if (versao == null || versao.ficha_slug !== slug) return new Response("", { status: 400, headers: TEXTO });

    // 🔴 FIX ROUND 1 (2026-09-26): "voltar" grava VERBATIM, não renormalizado.
    //
    // O `fichaSchema.parse` aqui existe só pra DECIDIR (400 se a versão antiga
    // não passa mais no schema de hoje) — o resultado do parse é DESCARTADO. O
    // que vai pro `gravarEdicao` é `versao.doc`, o texto exatamente como ele
    // saiu do banco.
    //
    // A primeira versão desta rota gravava `JSON.stringify(fichaSchema.parse(...))`
    // — e isso REESCREVIA o passado: `src/types/ficha.ts` (comentário de
    // `esforco`/`duracao`, 2026-08-23) documenta que o zod descarta chave
    // desconhecida EM SILÊNCIO. Uma versão antiga que ainda tivesse esses
    // campos os perderia pra sempre ao "voltar" — e a ordem das chaves passaria
    // a ser a do schema, não a do documento original. Numa tabela que existe
    // para que "nada do que já se disse sobre um lugar se perca", isso é a
    // perda entrando pela porta que deveria impedi-la.
    //
    // 🔴 POR QUE É SEGURO NUNCA RENORMALIZAR: o caminho de LEITURA
    // (`fichaSchema.parse` em `buscarFichas`/`getFicha`) já filtra campo
    // desconhecido antes de a ficha chegar em qualquer tela — é assim que
    // `esforco`/`duracao` já se comportam hoje em fichas antigas. O campo
    // morto fica GUARDADO no arquivo histórico e SOME da tela, que é o
    // certo pra um arquivo.
    //
    // 🔴 CONSEQUÊNCIA DELIBERADA: uma versão que não passa mais no schema
    // ATUAL fica IMPOSSÍVEL de restaurar — 400, nunca uma ficha quebrada no
    // ar. É a mesma régua de `aplicarCampo`: estourar é melhor que publicar
    // algo meio certo.
    try {
      fichaSchema.parse(JSON.parse(versao.doc));
    } catch {
      return new Response("", { status: 400, headers: TEXTO });
    }

    // 🔴 "VOLTAR" RESTAURA O DOCUMENTO, NUNCA A VISIBILIDADE — e a visibilidade
    // que vale é a DE AGORA, não a que a versão antiga tinha. Se ela viesse de
    // `versao.oculto`, voltar a uma versão de antes de o lugar ser escondido o
    // devolveria AO AR em silêncio: a mesma família do defeito da semente, agora
    // pela porta do arquivo histórico. E "de agora" é a do INSTANTE DA GRAVAÇÃO,
    // não a desta leitura: `gravarEdicao` lê o `oculto` da versão atual dentro
    // do próprio INSERT (onda de fix 3 da 11e, N1) — um "Esconder" tocado
    // enquanto este pedido trabalha não é desfeito por ele.
    //
    // A leitura daqui serve só ao par (nome, cidade) logo abaixo. Ela nunca
    // devolve `null` (a versão de cima existe, logo o lugar tem versão).
    const atual = await versaoAtual(getClient(), slug);

    // 🔴 O PAR (NOME, CIDADE), TAMBÉM AO VOLTAR (onda de fix 2 da 11b, Y3 — o
    // M-N1 da re-revisão): a versão antiga traz o nome e a cidade DELA, e voltar
    // a ela é mudar os dois de uma vez. Sem isto, era a quarta porta que dava a
    // um lugar o par de outro. A função é a MESMA dos PUTs de campo
    // (`parDaTroca`, que `parDaMudanca` chama), nunca uma cópia.
    const doPar = await parDaTroca(
      (atual ?? versao).doc,
      slug,
      nomeDoRascunho(versao.doc, ""),
      cidadeDoDoc(versao.doc) ?? "",
    );
    if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });

    // E O ENDEREÇO TAMBÉM NÃO VOLTA (Tarefa 11e): `gravarEdicao` não copia o
    // `endereco_anterior` da versão antiga — voltar a uma versão de antes de uma
    // troca de endereço restaura o DOCUMENTO (que já diz o endereço de agora,
    // reescrito na troca), e o lugar continua onde está.
    const id = await gravarEdicao(getClient(), slug, versao.doc, agora, baseId);
    // 🔴 `null` = o lugar saiu deste endereço entre a leitura e a gravação (a
    // troca de endereço no meio, I1 da revisão da 11e): nada foi gravado.
    if (id === null) return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
    return Response.json({ id }, { headers: { "cache-control": "no-store" } });
  }

  // 🔴 CADA FORMA DE EDIÇÃO VIRA UMA TRANSFORMAÇÃO DO DOCUMENTO ATUAL (`mudar`),
  // e daqui pra baixo todas passam pelo MESMO caminho: a versão atual, a
  // transformação (que estoura com frase → 400), o portão de coerência (409) e
  // a gravação que herda a visibilidade. Forma nova (a Tarefa 10 trouxe
  // `acrescentarEtapa`/`tirarEtapa`) confere a FORMA do corpo no seu ramo e
  // devolve o seu `mudar` — nunca um caminho próprio até o banco. Há prova de
  // que CADA forma passa pelo portão, com uma regra fantasma que acusa qualquer
  // mudança (`tests/api/route-admin-ficha.test.ts`, C7 da Tarefa 10).
  let mudar: (doc: string) => string;
  if (trazPonto) {
    // 🔴 A FORMA DO CORPO, conferida aqui; a faixa e a finitude de `lat`/`lng`
    // são do schema, que revalida o documento inteiro dentro de `gravarPonto`.
    // `ponto` inteiro ≥ 0 pela mesma razão do `versaoId`: `1.5`, `-1` e `1e999`
    // (que o `JSON.parse` vira `Infinity`) não são índice de nada.
    if (
      typeof ponto !== "number" ||
      !Number.isInteger(ponto) ||
      ponto < 0 ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    mudar = (doc) => gravarPonto(doc, ponto, lat, lng);
  } else if (trazAcrescentar) {
    // 🔴 A FORMA: um objeto com EXATAMENTE as chaves `nome` (texto), `lat` e
    // `lng` (números). A coordenada é OBRIGATÓRIA desde a onda de conserto 1: é
    // a que o dono marcou no mapa, e a porta nunca inventa nem copia uma (ver
    // `acrescentarEtapa`). Chave a mais (`nota`) ou a menos é 400 sem frase;
    // faixa e finitude são do schema, dentro de `acrescentarEtapa`. Nome em
    // branco passa daqui e é recusado lá dentro, COM frase.
    //
    // ⚠️ O `typeof … !== "number"` de `lat`/`lng` é a PRIMEIRA de duas portas em
    // série: sem ele, `undefined` ou texto chegam ao `fichaSchema.parse` de
    // `acrescentarEtapa`, que recusa igual (400 vazio). MEDIDO na onda 1: a
    // mutação que o arranca SOBREVIVE à suíte (espécie 47), e não há resposta
    // observável que separe as duas. Ele fica porque é ele que dá o TIPO
    // `number` à chamada; a garantia de coordenada válida é o schema.
    const e = etapaNova as { nome?: unknown; lat?: unknown; lng?: unknown } | null;
    if (
      typeof e !== "object" ||
      e === null ||
      Object.keys(e).length !== 3 ||
      typeof e.nome !== "string" ||
      typeof e.lat !== "number" ||
      typeof e.lng !== "number"
    ) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    const { nome, lat: latNova, lng: lngNova } = e as { nome: string; lat: number; lng: number };
    mudar = (doc) => acrescentarEtapa(doc, nome, latNova, lngNova);
  } else if (trazTirar) {
    // 🔴 A FORMA: inteiro ≥ 0, pela mesma razão do `ponto` e do `versaoId`
    // (`1.5`, `-1` e `1e999`/`Infinity` não são índice de nada) — 400 sem frase.
    // O `0` PASSA DAQUI de propósito: ele é um índice bem escrito, e a recusa
    // dele é de DOMÍNIO (é o lugar), com frase e 409, dentro de `tirarEtapa`.
    if (typeof etapaFora !== "number" || !Number.isInteger(etapaFora) || etapaFora < 0) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    mudar = (doc) => tirarEtapa(doc, etapaFora);
  } else {
    // 🔴 EXATAMENTE UM DE `valor` OU `naoSei`, e é isto que fecha o quarto
    // formato não declarado (ver o docblock). `in` e nunca `!== undefined`, pela
    // mesma razão de `:51-54`: `{"valor": null}` é uma caixa que CHEGOU com
    // conteúdo (e `aplicarCampo` a recusa dizendo o tipo), enquanto `valor`
    // ausente é corpo malformado — dois consertos diferentes, e `!== undefined`
    // os confundiria num só.
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei) return new Response("", { status: 400, headers: TEXTO });

    // 🔴 `naoSei` SÓ VALE `true` — decisão desta tarefa, que o brief não tomava.
    // Com a leitura por `in`, um corpo `{campo: "piso", naoSei: false}` pediria
    // REMOÇÃO dizendo "não" — a tela que mandasse a bandeira desligada apagaria o
    // campo. Falha fechada: qualquer outra coisa é 400.
    if (trazNaoSei && naoSei !== true) return new Response("", { status: 400, headers: TEXTO });

    // 🔴 A LISTA BRANCA saiu de `CAMPOS_EDITAVEIS = ["voz"]` e virou o registro
    // de `campos-da-ficha.ts` (2026-09-26). O que ela guarda é o mesmo: sem ela,
    // um corpo com `{"campo":"slug"}` renomearia o lugar e quebraria todo link
    // que já circula (trocar o endereço é OUTRA porta, `api/admin/endereco`, que
    // guarda o velho e o redireciona). `campoPorCaminho` resolve caminho aninhado e índice de
    // waypoint (`trajeto.waypoints.0.nome`) pelo molde do registro.
    if (typeof campo !== "string" || campoPorCaminho(campo) === undefined) {
      return new Response("", { status: 400, headers: TEXTO });
    }
    mudar = (doc) =>
      trazNaoSei ? removerCampo(doc, campo) : aplicarCampo(doc, campo, valor as ValorDeCampo);
  }

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400, headers: TEXTO });

  // 🔴 O PAR (NOME, CIDADE), TAMBÉM AQUI (onda de fix da Tarefa 11b, X4): dar a
  // um lugar publicado, renomeando-o ou mudando a cidade dele, o par de OUTRO
  // lugar (no ar ou escondido) ou de um rascunho é 409 — a MESMA função das
  // portas do lugar novo (`src/lib/par-de-lugar.ts`), nunca uma cópia. O
  // próprio lugar fica de fora da comparação. Lugar ainda sem cidade não tem
  // par a conferir quando é renomeado — mas espera o gêmeo sem cidade, como
  // todo nome que muda; dar a cidade nunca espera (Y1 da onda de fix 2).
  const doPar = await parDaMudanca(versao.doc, slug, campo, valor);
  if (doPar !== null) return new Response(doPar, { status: 409, headers: TEXTO });

  // 🔴 `valor` chega como `unknown` e NÃO é coagido pra string aqui — se
  // fosse `String(valor)`, um número viraria texto válido e passaria pelo
  // schema, escondendo exatamente o defeito que `aplicarCampo` existe pra
  // pegar. O `as ValorDeCampo` é asserção de tipo, não coerção: quem confere
  // a forma de verdade é o `fichaSchema.parse` dentro de `aplicarCampo`, e o
  // estouro dele (valor errado, caixa vazia) é traduzido em 400 aqui.
  let novoDoc: string;
  try {
    novoDoc = mudar(versao.doc);
  } catch (erro) {
    // 🔴 A recusa que é do TRAJETO DE AGORA (tirar o lugar, tirar um ponto que
    // não é o último) volta 409 COM a frase, no padrão das recusas da coerência
    // — ver `RecusaDoTrajeto`. Todo o resto é 400, como sempre foi.
    if (erro instanceof RecusaDoTrajeto) return new Response(erro.message, { status: 409, headers: TEXTO });
    return recusar400(erro);
  }

  // 🔴 O PORTÃO DA COERÊNCIA — o degrau que a Tarefa 3 acrescentou, e o que ele
  // recusa é SÓ A VIOLAÇÃO QUE ESTA GRAVAÇÃO INTRODUZ.
  //
  // As regras de `coerencia.ts` moravam num arquivo de teste: rodavam no
  // laptop, antes do deploy. Um lugar que o dono edite do celular numa terça de
  // manhã nunca passava por nenhuma. Aqui elas rodam na hora da gravação.
  //
  // 🔴 POR QUE O DIFF, E NÃO "SE HOUVER VIOLAÇÃO, 409": uma única incoerência
  // preexistente no acervo trancaria TODA gravação de TODO lugar, para sempre —
  // inclusive as que a consertariam. E o caminho até lá já existe: `{slug,
  // versaoId}` grava verbatim e sem coerência, de propósito, então voltar a uma
  // versão que o acervo de hoje reprova põe uma violação no banco. Numa PORTA,
  // falso positivo é pior que falso negativo: ele trava o dono de gravar uma
  // VERDADE. A porta responde "você está introduzindo isto agora", nunca "o
  // acervo tem um problema em algum lugar".
  //
  // 🔴 E POR QUE NÃO "FILTRAR PELO SLUG EDITADO", que seria mais simples: as
  // duas regras que comparam fichas entre si (`frase-emprestada`,
  // `texto-emprestado`) acusam UM dos dois lugares do par, e qual deles depende
  // da ordem do acervo. Filtrar pelo slug editado deixaria passar exatamente a
  // cópia de frase que a regra existe pra pegar.
  //
  // 🔴 LEITURA DIRETA — `versoesAtuais`, nunca `buscarFichas`/`getAllFichas`, e
  // SEM `comPrazo`. Dois motivos medidos:
  //   1. `buscarFichas` tem MEMÓRIA de módulo (`ultimaBoa`): uma porta que
  //      medisse contra acervo LEMBRADO mediria contra uma leitura que as telas
  //      públicas deixaram ali, e que o dono já pode ter reescrito. Guarda mede
  //      AGORA.
  //   2. `comPrazo` com fallback `new Map()` faria a porta falhar pro lado
  //      PERMISSIVO: acervo vazio DESLIGA as duas regras que comparam fichas
  //      entre si, e a frase emprestada passaria em silêncio sob lentidão do
  //      banco. Numa tela de leitura, estourar o prazo significa "mostrar
  //      menos"; numa porta, significaria "gravar sem conferir".
  //  O custo é honesto e não é regressão: a gravação pode pendurar até o timeout
  //  da plataforma — exatamente como o `versaoAtual` logo acima já pendura.
  //
  // 🔴 E `incluirOcultos: true`, DESDE A TAREFA 4 (2026-09-27): o acervo que este
  // portão mede inclui os lugares ESCONDIDOS. É o P3 da rodada, e o buraco que ele
  // fecha tem três passos: esconder o Véu → copiar a voz dele na Rampa (passaria,
  // porque o Véu não estaria mais no acervo medido) → mostrar o Véu de novo → o
  // acervo PÚBLICO fica com duas fichas dizendo a mesma coisa, que é exatamente o
  // que `texto-emprestado` existe pra pegar (a `voz` está em
  // `TEXTOS_QUE_DISTINGUEM`; `frase-emprestada` é sobre o `secaRapido`, e esta
  // linha dizia o nome ERRADO desde o brief que a pediu — medido em 27/09, com a
  // regra que de fato acusa impressa na saída). Esconder não apaga, e lugar
  // escondido VOLTA — então a coerência nunca pode deixar de vê-lo. Medir contra
  // acervo parcial seria a porta ficando permissiva EM SILÊNCIO.
  //
  // A conta (o par, a contagem, a frase do achado novo) mora em
  // `violacaoIntroduzida` desde a Tarefa 12 — a mesma da porta de publicar.
  const versoes = await versoesAtuais(getClient(), { incluirOcultos: true });
  const aDizer = violacaoIntroduzida(versoes, slug, versao.doc, novoDoc);
  if (aDizer !== null) return new Response(aDizer, { status: 409, headers: TEXTO });

  // 🔴 A VERSÃO NOVA HERDA A VISIBILIDADE DA ATUAL, e sem isso a rota
  // DESESCONDERIA o lugar a cada edição de campo (a forma de nascer,
  // `gravarVersao`, tem `oculto = false` por padrão). O dono esconde um lugar,
  // conserta um typo na voz pelo celular, e o lugar VOLTA AO PÚBLICO sem ele pedir
  // — uma decisão de produto tomada de carona por um argumento omitido.
  //
  // 🔴 E "A ATUAL" É A DO INSTANTE DO INSERT, NÃO A LIDA LÁ EM CIMA (onda de fix 3
  // da 11e, N1 — linha vermelha): `gravarEdicao` nem recebe o `oculto`, lê no
  // próprio INSERT. Esta rota é a mais lenta do painel (a coerência acima roda
  // sobre o acervo inteiro); com o `versao.oculto` daqui, um "Esconder" tocado
  // na mesma tela enquanto ela trabalha dava 200, e este PUT gravava depois o
  // `oculto` de antes: o lugar de volta no ar em silêncio.
  //
  // Visibilidade só muda pela porta que existe pra isso
  // (`POST /api/admin/visibilidade`). Esta rota edita CONTEÚDO; nada aqui é um
  // canal pra mudar o que está no ar.
  //
  // 🔴 E A GRAVAÇÃO É CONDICIONAL (`gravarEdicao`, onda de fix da 11e, I1): se a
  // troca de endereço levou o lugar embora depois da leitura lá em cima, gravar
  // aqui recriaria o lugar no endereço velho. O banco decide no INSERT; `null`
  // é 409 com a frase, e nada entrou.
  const id = await gravarEdicao(getClient(), slug, novoDoc, agora, baseId);
  if (id === null) return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
