import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { marcaDe, subDe } from "@/lib/carimbo-fase";
import { getClient, getFreshness, versaoAtual } from "@/lib/db";
import { avaliar } from "@/lib/motor";
import { vozDaFicha } from "@/lib/severidade";
import { parsePrecip, type OpenMeteoResponse } from "@/lib/weather";
import { fichaSchema, regraSchema, type Regra } from "@/types/ficha";

export const dynamic = "force-dynamic";

/** O QUE A TELA DO LUGAR DIRIA COM O NÚMERO NOVO — e NADA MAIS do que isso
 *  (Task 7, 2026-09-30).
 *
 *  Corpo: `{ slug, campo, valor }`, o MESMO formato da porta de escrita
 *  (`PUT /api/admin/ficha`), de propósito: as duas portas respondem sobre o
 *  mesmo ato — um campo, um valor — e duas línguas pro mesmo ato é como um
 *  editor acaba mandando uma forma pra uma porta e outra pra outra.
 *
 *  Resposta 200 em duas formas, e o cliente as distingue pelo campo `semLeitura`
 *  — nunca por adivinhação:
 *
 *   - `{ estado, marca, sub }`  — o carimbo que o lugar teria AGORA com esse número
 *   - `{ semLeitura: true }`    — o motor ainda não deixou chuva utilizável aqui
 *
 *  🔴 A REGRA DA PRÉVIA É A REGRA GRAVADA COM **UM** NÚMERO TROCADO, e isto é
 *  mais do que economia de bytes. O plano pedia o corpo `{ slug, regra }`, com os
 *  três números vindo do cliente — e naquele formato uma tela mal escrita podia
 *  mandar uma regra cujos OUTROS dois números não são os que estão no documento,
 *  e a prévia descreveria uma regra que não existe em lugar nenhum. Aqui os
 *  outros dois saem do próprio documento, então a frase *"com este número, a tela
 *  diria"* é verdadeira sobre a ficha de verdade. É também o que mantém
 *  `PropsDoEditor` como a Tarefa 6 a fixou: o editor de um campo não precisa
 *  conhecer os campos vizinhos.
 *
 *  🔴 ELA NÃO CHAMA `runMotor`, E O PLANO MANDAVA CHAMAR. Medido, `runMotor` faz
 *  três coisas que uma prévia não pode fazer: lê TODAS as fichas
 *  (`getFichasComCondicao`), bate no PROVEDOR EXTERNO uma vez por ficha
 *  (`fetchPrecip`) e **ESCREVE NO BANCO** (`upsertFreshness`). Uma prévia que o
 *  chamasse gravaria o estado dos três lugares a cada toque de tecla — o oposto
 *  do que ela promete. O motor desta pergunta é `avaliar(regra, precips, agora)`,
 *  função PURA de 20 linhas em `src/lib/motor.ts`, que é exatamente o que o
 *  `runMotor` chama por dentro. A regra continua tendo uma fonte só; o que não se
 *  reusa é o laço que grava.
 *
 *  🔴 A CHUVA VEM DO BANCO, NÃO DO CÉU — `freshness.previsao_bruta`, que é o
 *  `JSON.stringify(raw)` que o `runMotor` guardou, de volta em `Precip[]` por
 *  `parsePrecip`. Medido em 2026-09-30: antes desta rota **nada em `src/` relia
 *  aquela coluna**; o dado estava guardado e não servia a ninguém. Três razões, as
 *  três medidas:
 *
 *   1. **De graça.** Zero chamada externa por toque de tecla. Este projeto já
 *      perdeu uma rodada inteira (13/09) pra política de uso de um terceiro, e
 *      aquela política proibia pelo PADRÃO de uso, não pelo volume — uma prévia
 *      que busca previsão a cada dígito é exatamente um padrão de uso.
 *   2. **Honesta.** "A mesma chuva que o motor usou" é o que torna duas prévias
 *      COMPARÁVEIS. Com duas buscas, o dono mexeria no limiar e veria o carimbo
 *      mudar por causa do TEMPO que passou entre as duas respostas.
 *   3. **Determinística.** O teste injeta chuva conhecida e mede o código, não o
 *      céu. A prova do plano (*"limiar 999 e limiar 0.1 dão carimbos
 *      diferentes"*) só é verdadeira numa semana de chuva: numa semana seca os
 *      dois dão `fresco` e ela fica vermelha — ou verde por sorte, que é pior.
 *
 *  🔴 E ELA NÃO GRAVA NADA. Nem `ficha_versoes`, nem `freshness`. As duas únicas
 *  consultas são SELECTs de uma linha (`versaoAtual`, `getFreshness`), e há teste
 *  com espiã no `fetch` global provando que o provedor externo não é chamado —
 *  "não grava" por promessa não é prova.
 *
 *  🔴 A EXISTÊNCIA DO LUGAR SAI DE `versaoAtual`, NUNCA DE `getFicha`. É a lição
 *  que a rota de visibilidade já escreveu: `getFicha` sai de `versoesAtuais`, que
 *  esconde os ocultos — e um lugar escondido continua sendo um lugar que o dono
 *  edita. Prever pra ele não é publicá-lo.
 *
 *  A ordem das guardas é a das rotas irmãs do admin: config → sessão → corpo →
 *  domínio → responde. */

/** Quanto a prévia espera a chuva guardada antes de responder "sem leitura".
 *
 *  🔴 CONSTANTE PRÓPRIA, E A JUSTIFICATIVA NÃO É EMPRESTADA DO `PRAZO_AVISO_MS`
 *  — foi exatamente esse empréstimo que a revisão de 26/09 mandou desfazer na
 *  página do painel. O valor coincide e a consulta é do mesmo tipo (UMA linha,
 *  pela chave primária `ficha_slug`, no mesmo Turso), mas o CONTEXTO é outro e é
 *  ele que governa o número: isto roda com o dedo dele no teclado, entre dois
 *  toques, e o que está em jogo é por quanto tempo a prévia fica calada depois de
 *  ele mudar o número. Esperar mais faria a tela parecer travada no meio de uma
 *  digitação.
 *
 *  🔴 E O ESTOURO CAI PRO LADO DE "NÃO SEI", nunca pro lado de um carimbo: o
 *  combinado é `null`, que entra no mesmo ramo de "não há leitura". Uma prévia que
 *  inventasse `fresco` sob lentidão do banco diria ao dono que o lugar está
 *  liberado — e esta é uma tela de decisão sobre lugar real. */
const PRAZO_PREVISAO_MS = 2_000;

/** QUAIS CAMPOS DA TELA SÃO NÚMERO DE MOTOR, e a tabela SAI DO `regraSchema` —
 *  nunca de três caminhos escritos à mão aqui.
 *
 *  🔴 Lista à mão cega ao que cresceu é a espécie que mais custou a este projeto
 *  (cinco defeitos de um plano só, em 25/09). Um parâmetro novo na regra de chuva
 *  entra aqui sozinho, no dia em que entrar no schema; e há guarda cravando as
 *  DUAS direções contra as entradas `especie: "numero"` do registro de campos, pra
 *  esta tabela não poder divergir da tela que a usa. O único pedaço escrito é o
 *  PREFIXO — onde a regra mora dentro da ficha —, e o guarda é quem o prova.
 *
 *  ⚠️ E ELA NÃO É EXPORTADA de propósito: `route.ts` é segmento do Next, que
 *  valida os nomes exportados de um arquivo de rota, e um `export` a mais aqui é
 *  risco de build por conveniência de teste. O guarda das duas direções mede o
 *  COMPORTAMENTO da rota — um POST por entrada `especie: "numero"` do registro,
 *  mais um por caminho que não é número —, que é prova melhor que comparar duas
 *  listas: ele fica vermelho se a rota aceitar ou recusar o caminho errado, e não
 *  só se uma lista divergir da outra. */
const FOLHA_DE = new Map<string, string>(
  Object.keys(regraSchema.shape)
    .filter((k) => k !== "tipo")
    .map((k) => [`condicao.regra.${k}`, k]),
);

/** A regra MENTE sobre o lugar? Três valores, um exame só, e é o MESMO exame que
 *  a regra `janela-nao-zerada` de `src/lib/coerencia.ts` faz na hora de gravar —
 *  de propósito: a prévia não pode mostrar carimbo de uma regra que a porta de
 *  escrita recusa, porque isso é a tela convidando a um ato que a porta nega (o
 *  mesmo defeito que `FichaInteira` já evita na folha de um bloco ausente).
 *
 *  🔴 `> 0` E NADA MAIS, e o que isso DEIXA PASSAR é escolha medida: janela
 *  fracionária (`2.5`) passa, porque `avaliar` a usa sem reclamar e é um valor que
 *  um dono pode querer de verdade. Numa porta, falso positivo é pior que falso
 *  negativo: ele trava o dono de gravar uma verdade.
 *
 *  `Number.isFinite` entra porque `JSON.parse("1e999")` devolve `Infinity`, e
 *  `Infinity > 0` é verdadeiro — sem ele, uma janela infinita somaria TODA a chuva
 *  da série e a prévia responderia com cara de resposta. É o mesmo estado que o
 *  `.finite()` do `regraSchema` fecha na porta de escrita. */
function numeroQueNaoMente(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Leitura de chuva guardada é leitura mentirosa — e esta ainda é a chuva de
 *  AGORA sob uma regra que o dono está mexendo. */
const SEM_CACHE = { headers: { "cache-control": "no-store" } } as const;

export async function POST(req: Request): Promise<Response> {
  // 404, não 401: painel desligado não anuncia que existe, e vem ANTES da sessão
  // porque sem ADMIN_SENHA não existe segredo pra validar sessão nenhuma.
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
    return new Response("", { status: 400 });
  }
  // `null` é JSON válido e não estoura o `catch` acima; destructurar `null`
  // estoura na hora. Mesma guarda das rotas irmãs.
  if (typeof body !== "object" || body === null) return new Response("", { status: 400 });

  const { slug, campo, valor } = body as { slug?: unknown; campo?: unknown; valor?: unknown };
  if (typeof slug !== "string") return new Response("", { status: 400 });

  const folha = typeof campo === "string" ? FOLHA_DE.get(campo) : undefined;
  if (folha === undefined) return new Response("", { status: 400 });

  // A recusa barata vem antes do banco: o número que ele acabou de digitar é o
  // único que esta requisição traz, e um zero não merece uma viagem ao Turso.
  if (!numeroQueNaoMente(valor)) return new Response("", { status: 400 });

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400 });

  let ficha;
  try {
    ficha = fichaSchema.parse(JSON.parse(versao.doc));
  } catch {
    // Documento que não abre não tem carimbo nenhum a prever — e nunca um
    // carimbo montado por cima de uma ficha que o app não consegue ler.
    return new Response("", { status: 400 });
  }

  // A regra candidata: a gravada com UM número trocado. O `regraSchema` é a
  // mesma fonte que a porta de escrita usa, então uma regra que não viraria
  // documento também não vira prévia.
  const candidata = { ...ficha.condicao.regra, [folha]: valor };
  const forma = regraSchema.safeParse(candidata);
  if (!forma.success) return new Response("", { status: 400 });
  const nova: Regra = forma.data;

  // 🔴 OS TRÊS NÚMEROS, NÃO SÓ O EDITADO. Se a regra GRAVADA já mente num dos
  // outros dois (um limiar zero herdado, p.ex.), não existe carimbo honesto a
  // mostrar — e mostrar um daria ao dono a impressão de que a regra funciona.
  // Isto NÃO o tranca: trocar justamente o número que mente dá uma candidata
  // limpa, e a prévia volta a responder na mesma tecla.
  if (
    !numeroQueNaoMente(nova.janela_previsao_horas) ||
    !numeroQueNaoMente(nova.janela_passado_horas) ||
    !numeroQueNaoMente(nova.limiar_mm)
  ) {
    return new Response("", { status: 400 });
  }

  const linha = await comPrazo(getFreshness(getClient(), slug), PRAZO_PREVISAO_MS, null);

  // 🔴 AS TRÊS AUSÊNCIAS CAEM NO MESMO RAMO, e isso é decisão: sem linha de
  // `freshness`, com a coluna em branco, e com uma série que não parseia, o FATO é
  // o mesmo — o motor não deixou chuva utilizável pra este lugar — e a ação do dono
  // é a mesma: esperar o motor rodar. Inventar um carimbo aqui seria a prévia
  // afirmando sobre um lugar real sem ter lido chuva nenhuma.
  let chuva;
  try {
    if (linha?.previsao_bruta == null) return Response.json({ semLeitura: true }, SEM_CACHE);
    chuva = parsePrecip(JSON.parse(linha.previsao_bruta) as OpenMeteoResponse);
  } catch {
    return Response.json({ semLeitura: true }, SEM_CACHE);
  }

  const estado = avaliar(nova, chuva, agora);

  // 🔴 A `voz` SAI DA REGRA NOVA, NÃO DA GRAVADA, e sem isto a tela se contradiz
  // numa frase só. `vozDaFicha` devolve `horasPassado: regra.janela_passado_horas`,
  // e a fala do nível `espera` é literalmente `Espera {n}h`: montada a partir da
  // ficha do banco, o dono digitaria 12 e leria "Espera 6h" ao lado de um estado
  // calculado com 12.
  const voz = vozDaFicha({ severidade: ficha.condicao.severidade, regra: nova });

  // `afirmando` de propósito: a prévia responde "o que a CHUVA diria com esta
  // regra". As outras fases (`fechado`, `conferindo`, `sem-informacoes`) não
  // dependem de número nenhum desta tela, e deixá-las entrar aqui esconderia a
  // resposta que o dono pediu atrás de uma que ele não mudou.
  return Response.json(
    { estado, marca: marcaDe("afirmando", estado, voz), sub: subDe("afirmando", estado, voz) },
    SEM_CACHE,
  );
}
