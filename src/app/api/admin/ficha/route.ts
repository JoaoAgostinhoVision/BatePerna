import { ZodError } from "zod";
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { type FichaVersao, getClient, gravarVersao, versaoAtual, versaoPorId, versoesAtuais } from "@/lib/db";
import { aplicarCampo, campoPorCaminho, removerCampo, type ValorDeCampo } from "@/lib/campos-da-ficha";
import { type Violacao, violacoesDoAcervo } from "@/lib/coerencia";
import { type Ficha, fichaSchema } from "@/types/ficha";

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
 *  `validarFolha`, `gravarBloco`, `exigirCampo`); o que sobra pro zod é o
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

/** O PAR (`regra`, `slug`) de uma violação — e o portão compara a CONTAGEM de
 *  cada par, não o conteúdo das frases.
 *
 *  🔴 A REDAÇÃO ANTERIOR USAVA A `frase`, E ISSO TRANCAVA O DONO DE RENOMEAR O
 *  LUGAR. Medido por um re-revisor em 2026-09-27, com requisições de verdade: o
 *  nome do lugar (`trajeto.waypoints[0].nome`) aparece na frase de **todas as
 *  regras** (é o `nomeDe(f)` de `coerencia.ts`). Então, numa ficha que já tinha
 *  qualquer violação preexistente, renomear o lugar mudava a frase daquela
 *  violação, a identidade deixava de casar, e o diff classificava como
 *  **introduzida** uma violação que **já estava no acervo** — exatamente o que o
 *  ruling T3-R1 proíbe. Três medições dele:
 *
 *    - chip velho preexistente na própria ficha + renomear → **409**, e a frase
 *      falava de PREÇO;
 *    - `limiar_mm` zerado preexistente + renomear → **409**, e a frase falava de
 *      CHUVA;
 *    - a voz duplicada acusada no OUTRO lugar + renomear este → **409**, por
 *      violação de um lugar que ele não estava editando.
 *
 *  E `trajeto.waypoints[].nome` é obrigatório: **não tem "não sei", não tem
 *  saída pelo campo.** Um typo no nome do lugar é das coisas mais prováveis de
 *  se querer consertar do celular, e a porta respondia sobre outro assunto.
 *
 *  🔴 POR QUE A CONTAGEM, E NÃO O CONJUNTO DE PARES. Três regras podem acusar o
 *  MESMO par mais de uma vez: `janela-nao-zerada` empurra um achado por cada um
 *  dos três números zerados, `texto-emprestado` um por campo de prosa copiado, e
 *  `dia-repetido-ou-inventado` **um por ESPÉCIE de malformação** — no máximo
 *  dois, um de dia repetido e um de dia inventado, e não um por dia. (A redação
 *  anterior desta linha dizia "um por dia malformado" e era FALSA: medido,
 *  `["sab","sab","dom","dom"]` dá UM achado. E por esta porta aquele par nunca
 *  passa de 1, porque `dias` é `z.array(z.enum(DIAS))` e a grafia inventada é
 *  barrada com 400 antes de chegar aqui.) Comparando conjuntos, uma
 *  ficha que já tinha UMA dessas passaria a ter DUAS em silêncio — o dono
 *  quebraria o segundo campo e a porta calaria, porque o par já existia. A
 *  contagem é a leitura humana de *"a minha gravação piorou esta ficha?"*.
 *
 *  🔴 E O QUE ISTO DEIXA PASSAR, DE PROPÓSITO — está escrito porque é escolha, e
 *  não descuido. Uma gravação que MANTÉM a contagem de um par mas troca o valor
 *  errado por outro valor errado passa: se o chip já dizia R$ 1 numa ficha que
 *  cobra R$ 5, escrever R$ 12 no valor sai com 200, e o documento continua
 *  incoerente **como já estava**. É a leitura deliberada de T3-R1: numa porta, o
 *  falso positivo é pior que o falso negativo, porque **trava o dono de gravar
 *  uma verdade** — e ele não introduziu problema nenhum, herdou um. Quem cobra
 *  essa dívida são os 15 guardas de coerência do acervo, não esta porta. */
function par(v: Violacao): string {
  return JSON.stringify([v.regra, v.slug]);
}

function contarPares(violacoes: Violacao[]): Map<string, number> {
  const conta = new Map<string, number>();
  for (const v of violacoes) conta.set(par(v), (conta.get(par(v)) ?? 0) + 1);
  return conta;
}

/** O acervo INTEIRO como fichas, com o documento de `slug` trocado por `doc`.
 *
 *  🔴 O ACERVO INTEIRO É EXIGÊNCIA DO MÓDULO DE COERÊNCIA (P3 da rodada): duas
 *  das regras comparam uma ficha com as outras, e lugar escondido volta.
 *
 *  ⚠️ SE `slug` NÃO ESTIVER NO MAPA, ELE ENTRA — e isto é estado impossível
 *  aqui (o `versaoAtual` lá embaixo já garantiu que existe versão deste lugar,
 *  e ela vem da mesma tabela). Escrito em vez de implícito porque o dia em que
 *  deixar de ser impossível — criar lugar, T11/T12 — é o dia em que a ficha
 *  nova precisa ser conferida CONTRA o acervo, não ignorada por ele.
 *
 *  🔴 DOCUMENTO QUE NÃO ABRE FICA DE FORA, E ISSO É DELIBERADO. Um `doc` de
 *  OUTRO lugar que não passe no `fichaSchema` de hoje derrubaria a gravação
 *  inteira com exceção — e trancaria o dono de editar o lugar A por causa de
 *  um defeito no lugar B, que ele não pode consertar sem... editar. A porta
 *  mede contra o que ela consegue ler. O documento DESTE slug nunca cai aqui:
 *  ele acabou de sair de `aplicarCampo`/`removerCampo`, que o parseiam. */
function acervoComo(versoes: Map<string, FichaVersao>, slug: string, doc: string): Ficha[] {
  const docs = new Map([...versoes].map(([s, v]) => [s, v.doc] as const));
  docs.set(slug, doc);

  const fichas: Ficha[] = [];
  for (const texto of docs.values()) {
    try {
      fichas.push(fichaSchema.parse(JSON.parse(texto)));
    } catch {
      // ver o docblock: ilegível fica de fora, nunca tranca a gravação.
    }
  }
  return fichas;
}

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
 *  🔴 Task 3 da rodada do painel completo (2026-09-27): são TRÊS formatos, e a
 *  ordem ganhou um degrau NOVO no fim — a COERÊNCIA DO ACERVO.
 *
 *   - `{slug, campo, valor}`   — grava aquele campo
 *   - `{slug, campo, naoSei}`  — TIRA a chave (`naoSei` tem que ser `true`)
 *   - `{slug, versaoId}`       — volta a uma versão (não passa pela coerência)
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
  };
  const { slug, campo, valor, naoSei, versaoId } = corpo;
  if (typeof slug !== "string") return new Response("", { status: 400, headers: TEXTO });

  // 🔴 C6 da revisão do controlador: os dois formatos são MUTUAMENTE
  // EXCLUSIVOS. `"campo" in corpo` (e não `campo !== undefined`) porque
  // `JSON.parse` nunca produz `undefined` como valor de chave presente — a
  // checagem lê exatamente o que chegou no corpo, não uma coincidência de
  // tipo. Nem os dois formatos juntos, nem nenhum dos dois: 400.
  const trazVersaoId = "versaoId" in corpo;
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  if (trazVersaoId === trazCampo) return new Response("", { status: 400, headers: TEXTO });

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
    // que vai pro `gravarVersao` é `versao.doc`, o texto exatamente como ele
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
    // pela porta do arquivo histórico. E com o default `false` de
    // `gravarVersao` seria pior — TODO "voltar" desesconderia.
    //
    // A leitura a mais é o preço, e é uma consulta indexada de uma linha na mesma
    // tabela que o `versaoPorId` acima já leu. Ela nunca devolve `null` aqui (a
    // versão de cima existe, logo o lugar tem versão), mas o `?? false` está
    // escrito porque falha fechada num campo de visibilidade significa "no ar",
    // que é o estado de todo lugar que ninguém escondeu.
    const atual = await versaoAtual(getClient(), slug);
    const id = await gravarVersao(getClient(), slug, versao.doc, "painel", agora, atual?.oculto ?? false);
    return Response.json({ id }, { headers: { "cache-control": "no-store" } });
  }

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
  // que já circula. `campoPorCaminho` resolve caminho aninhado e índice de
  // waypoint (`trajeto.waypoints.0.nome`) pelo molde do registro.
  if (typeof campo !== "string" || campoPorCaminho(campo) === undefined) {
    return new Response("", { status: 400, headers: TEXTO });
  }

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400, headers: TEXTO });

  // 🔴 `valor` chega como `unknown` e NÃO é coagido pra string aqui — se
  // fosse `String(valor)`, um número viraria texto válido e passaria pelo
  // schema, escondendo exatamente o defeito que `aplicarCampo` existe pra
  // pegar. O `as ValorDeCampo` é asserção de tipo, não coerção: quem confere
  // a forma de verdade é o `fichaSchema.parse` dentro de `aplicarCampo`, e o
  // estouro dele (valor errado, caixa vazia) é traduzido em 400 aqui.
  let novoDoc: string;
  try {
    novoDoc = trazNaoSei ? removerCampo(versao.doc, campo) : aplicarCampo(versao.doc, campo, valor as ValorDeCampo);
  } catch (erro) {
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
  const versoes = await versoesAtuais(getClient(), { incluirOcultos: true });
  const violacoesAntes = violacoesDoAcervo(acervoComo(versoes, slug, versao.doc));
  const antes = contarPares(violacoesAntes);
  const todasDepois = violacoesDoAcervo(acervoComo(versoes, slug, novoDoc));
  const depois = contarPares(todasDepois);
  // Introduzida = par cuja CONTAGEM cresceu.
  const introduzidas = todasDepois.filter((v) => (depois.get(par(v)) ?? 0) > (antes.get(par(v)) ?? 0));
  // 🔴 E A FRASE QUE VOLTA É A DO ACHADO QUE NÃO EXISTIA ANTES, não a primeira
  // em ordem de tabela. Medido por um re-revisor em 27/09: com a janela do
  // passado já zerada no acervo, zerar o LIMIAR devolvia a frase que fala da
  // janela — *"o dono pede pra consertar X e a porta responde sobre Y"*, que é o
  // defeito que gerou esta onda, na forma de mensagem.
  //
  // ⚠️ Comparar frases AQUI é seguro, e o porquê tem de ficar escrito: esta
  // comparação só escolhe QUAL frase mostrar, DENTRO de um par cuja contagem já
  // cresceu — ela nunca decide recusar. Renomear o lugar não cresce contagem
  // nenhuma, então não chega aqui, que era exatamente o C1 desta tarefa.
  // A primeira em ORDEM DE TABELA, que é a ordem da tela do dono: as regras de
  // custo vêm na frente porque é onde o defeito mais caro já entrou.
  if (introduzidas.length > 0) {
    const frasesAntes = new Set(violacoesAntes.map((v) => v.frase));
    const aDizer = introduzidas.find((v) => !frasesAntes.has(v.frase)) ?? introduzidas[0];
    return new Response(aDizer.frase, { status: 409, headers: TEXTO });
  }

  // 🔴 A VERSÃO NOVA HERDA A VISIBILIDADE DA ATUAL (`versao.oculto`), e sem este
  // argumento a rota DESESCONDERIA o lugar a cada edição de campo: `gravarVersao`
  // tem `oculto = false` por padrão. O dono esconde um lugar, conserta um typo na
  // voz pelo celular, e o lugar VOLTA AO PÚBLICO sem ele pedir — uma decisão de
  // produto tomada de carona por um argumento omitido.
  //
  // Visibilidade só muda pela porta que existe pra isso
  // (`POST /api/admin/visibilidade`). Esta rota edita CONTEÚDO; nada aqui é um
  // canal pra mudar o que está no ar.
  const id = await gravarVersao(getClient(), slug, novoDoc, "painel", agora, versao.oculto);
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
