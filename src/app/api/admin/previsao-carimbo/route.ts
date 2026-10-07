import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { marcaDe, subDe } from "@/lib/carimbo-fase";
import { violacoesDoAcervo } from "@/lib/coerencia";
import { getClient, versaoAtual } from "@/lib/db";
import { avaliar } from "@/lib/motor";
import { vozDaFicha } from "@/lib/severidade";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS, fetchPrecip } from "@/lib/weather";
import { fichaSchema, regraSchema, type Ficha, type Regra } from "@/types/ficha";

export const dynamic = "force-dynamic";

/** O QUE A TELA DO LUGAR DIRIA COM O NÚMERO NOVO — e NADA MAIS do que isso
 *  (Task 7, 2026-09-30).
 *
 *  Corpo: `{ slug, campo, valor }`, o MESMO formato da porta de escrita
 *  (`PUT /api/admin/ficha`), de propósito: as duas portas respondem sobre o
 *  mesmo ato — um campo, um valor — e duas línguas pro mesmo ato é como um
 *  editor acaba mandando uma forma pra uma porta e outra pra outra.
 *
 *  Respostas:
 *
 *   - `200 { estado, marca, sub }` — o carimbo que o lugar teria AGORA com esse número
 *   - `503` de corpo vazio         — a chuva não veio (provedor recusou, caiu, ou
 *                                    estourou o prazo). O cliente diz que não
 *                                    conseguiu conferir; NUNCA um carimbo de reserva.
 *   - `400` de corpo vazio         — o número mente, ou o pedido é ruim
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
 *  🔴 A CHUVA VEM AO VIVO, PELA MESMA FUNÇÃO DA TELA PÚBLICA — `fetchPrecip(coords,
 *  regra)`, a que `resolverEstado` (`src/lib/carimbo-estado.ts`) chama pra ficha
 *  do lugar. **Onda de conserto 1 da Tarefa 7 (2026-10-01).** A primeira versão
 *  lia `freshness.previsao_bruta`, e a premissa era falsa: medido em produção, a
 *  tabela `freshness` tem ZERO linhas, porque quem a enche é só o cron
 *  `/api/cron/motor`, e esse cron nunca foi agendado (não há `vercel.json`). A
 *  prévia dizia "sem leitura" pra todo número, sempre — e no dia em que alguém
 *  rodasse o motor uma vez, passaria a mentir com chuva velha.
 *
 *  🔴 E COM A REGRA **CANDIDATA**, não a gravada: `buildUrl` tira `past_days` e
 *  `forecast_days` da regra que recebe, então alargar a janela busca a série
 *  alargada. Com a regra gravada (ou com uma série guardada pela regra antiga), a
 *  prévia de uma janela maior mediria a BORDA da série e diria "Pode ir" sobre
 *  chuva que ela não vê.
 *
 *  ⚠️ O CUSTO DE PADRÃO DE USO no provedor: uma busca por PAUSA de digitação, não
 *  por tecla — o editor espera o dedo parar (`ESPERA_PREVIA_MS`, no
 *  `EditorNumeroDeMotor`) antes de pedir, e não pede nada pro número igual ao
 *  gravado, pra caixa vazia, nem pro número que mente. É um dono, num painel.
 *
 *  🔴 E ELA NÃO GRAVA NADA. Nem `ficha_versoes`, nem `freshness`, nem chama
 *  `runMotor`/`upsertFreshness`. A única consulta ao banco é o SELECT de
 *  `versaoAtual`, e há teste conferindo que nenhuma instrução de escrita sai
 *  dela — "não grava" por promessa não é prova.
 *
 *  🔴 A EXISTÊNCIA DO LUGAR SAI DE `versaoAtual`, NUNCA DE `getFicha`. É a lição
 *  que a rota de visibilidade já escreveu: `getFicha` é a leitura do PÚBLICO, e
 *  não devolve escondido (desde 06/10 ela lê com `incluirOcultos`, e é
 *  `buscarFichas` que tira os escondidos antes de servir) — e um lugar escondido
 *  continua sendo um lugar que o dono edita. Prever pra ele não é publicá-lo.
 *
 *  A ordem das guardas é a das rotas irmãs do admin: config → sessão → corpo →
 *  domínio → responde. */

/** Quanto a prévia espera a chuva do provedor antes de desistir.
 *
 *  🔴 CONSTANTE PRÓPRIA, E A JUSTIFICATIVA NÃO É EMPRESTADA do `PRAZO_CLIMA_MS`
 *  (o empréstimo de constante foi o que a revisão de 26/09 mandou desfazer). O
 *  que governa este número: é uma requisição ao provedor externo, da Vercel, com
 *  o dono parado olhando a caixa que ele acabou de mudar. Menos que isso e uma
 *  rede ruim do lado de lá faria a prévia falhar à toa; mais que isso e a
 *  resposta chegaria depois de ele já ter decidido gravar ou não. E o estouro não
 *  custa nada a ele: a prévia é ajuda, o Salvar continua de pé.
 *
 *  ⚠️ `fetchPrecip` não leva `AbortSignal`; `comPrazo` só deixa de esperar. A
 *  resposta atrasada é descartada.
 *
 *  🔴 E O ESTOURO CAI PRO LADO DE "NÃO SEI", nunca pro lado de um carimbo: vira
 *  503, e o cliente diz que não conseguiu conferir. Uma prévia que inventasse
 *  `fresco` sob lentidão diria ao dono que o lugar está liberado — e esta é uma
 *  tela de decisão sobre lugar real. */
const PRAZO_PREVISAO_MS = 4_000;

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

/** A RECUSA BARATA, antes do banco: o número que ele digitou, sozinho, já mente?
 *  É o espelho, campo a campo, das duas regras de coerência que a porta de
 *  escrita roda (`janela-nao-zerada` e `janela-dentro-do-provedor`); o exame da
 *  regra INTEIRA, que é a garantia, vem depois, chamando aquelas regras de
 *  verdade sobre a ficha candidata.
 *
 *  🔴 O CHÃO DEPENDE DO CAMPO. As duas JANELAS podem ser zero — decisões do
 *  João, 2026-10-01: "só olhar a chuva que já caiu", e o espelho dela pro
 *  passado. O limiar não. As duas janelas em zero JUNTAS não são deste exame
 *  (ele só vê um número): quem as recusa é o exame da regra inteira, abaixo.
 *  Fracionário passa (`2.5`): é número que um dono pode querer, e numa porta o
 *  falso positivo trava o dono de gravar uma verdade.
 *
 *  🔴 O TETO É O DO PROVEDOR (`src/lib/weather.ts`): acima dele a busca de chuva
 *  é recusada com 400, e a prévia nem chega a perguntar.
 *
 *  `Number.isFinite` entra porque `JSON.parse("1e999")` devolve `Infinity`. */
function numeroQueNaoMente(folha: string, n: unknown): n is number {
  if (typeof n !== "number" || !Number.isFinite(n)) return false;
  if (folha === "janela_previsao_horas") return n >= 0 && n <= TETO_PREVISAO_HORAS;
  if (folha === "janela_passado_horas") return n >= 0 && n <= TETO_PASSADO_HORAS;
  return n > 0;
}

/** As regras de coerência que olham a regra de chuva. A prévia roda AS MESMAS
 *  que a porta de escrita roda — nunca uma cópia delas —, pra nunca mostrar o
 *  carimbo de uma regra que a porta recusa. */
const REGRAS_DA_CHUVA = ["janela-nao-zerada", "janela-dentro-do-provedor"];

/** Chuva de agora sob uma regra que o dono está mexendo: guardar seria mentir. */
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
  // único que esta requisição traz, e um número que mente não merece uma viagem ao Turso.
  if (!numeroQueNaoMente(folha, valor)) return new Response("", { status: 400 });

  const versao = await versaoAtual(getClient(), slug);
  if (versao == null) return new Response("", { status: 400 });

  let ficha: Ficha;
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

  // 🔴 A REGRA INTEIRA, NÃO SÓ O NÚMERO EDITADO, e pelas MESMAS regras de
  // coerência que a porta de escrita roda. Se a regra GRAVADA já mente num dos
  // outros dois números (um limiar zero herdado, p.ex.), não existe carimbo
  // honesto a mostrar. Isto NÃO o tranca: trocar justamente o número que mente dá
  // uma candidata limpa, e a prévia volta a responder.
  const fichaCandidata: Ficha = { ...ficha, condicao: { ...ficha.condicao, regra: nova } };
  if (violacoesDoAcervo([fichaCandidata]).some((v) => REGRAS_DA_CHUVA.includes(v.regra))) {
    return new Response("", { status: 400 });
  }

  // 🔴 A MESMA BUSCA DA TELA PÚBLICA, COM A REGRA CANDIDATA, e falha nunca vira
  // carimbo: provedor recusando, rede caindo, série truncada (`parsePrecip`
  // estoura) e prazo estourado caem todos em `null` → 503.
  const chuva = await comPrazo(
    fetchPrecip(ficha.condicao.coords, nova).then(
      (r) => r.precips,
      () => null,
    ),
    PRAZO_PREVISAO_MS,
    null,
  );
  if (chuva === null) return new Response("", { status: 503, ...SEM_CACHE });

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
