import { createClient, type Client } from "@libsql/client";
import { ensureSchema, getClient, gravarVersao } from "@/lib/db";
import { loadAll } from "@/lib/ficha";
import { esquecerMemoria } from "@/lib/ficha-fonte";
import { semear } from "@/lib/semente";
import type { Ficha } from "@/types/ficha";

/** O BANCO DOS TESTES — um só jeito de montá-lo, pro app inteiro.
 *
 *  Não é um teste (o `include` do vitest só coleta `*.test.*`). É o que põe o
 *  acervo do repositório num banco `:memory:` e APONTA OS GETTERS DE PRODUÇÃO
 *  pra ele, desde 2026-09-25, quando `getAllFichas` parou de ler o disco.
 *
 *  🔴 POR QUE ISTO NÃO MOCKA OS GETTERS. Um teste que troque `getAllFichas`
 *  inteiro por uma lista de fichas não prova nada sobre o banco: passaria
 *  igualzinho se o getter continuasse lendo o JSON, se a consulta de
 *  `versoesAtuais` pegasse a linha errada, ou se o `fichaSchema.parse` do
 *  `buscarFichas` estourasse. O caminho daqui é o de produção inteiro —
 *  `getAllFichas` → `buscarFichas` → `comPrazo` → `versoesAtuais` → SQL —, e a
 *  única peça trocada é PARA ONDE o `getClient` aponta.
 *
 *  Duas portas, porque os testes chegam de dois jeitos:
 *   - `bancoDeProducao()`: sem mock nenhum. `TURSO_DATABASE_URL=":memory:"` faz
 *     o `getClient` de verdade abrir um banco em memória, e o getter de
 *     produção acha o que a semente pôs lá. É a que mente menos.
 *   - `semearAcervo(client)`: pros arquivos que JÁ trocam `getClient` por um
 *     cliente próprio (`tests/api/route-confirmar.test.ts` e irmãos fazem isso
 *     desde agosto, por causa do placar de confirmações). Semeia o cliente
 *     deles, sem abrir um segundo banco.
 *
 *  ⚠️ UM `:memory:` É POR CLIENTE. Dois clientes são dois bancos que não se
 *  veem — foi por isso que este arquivo nasceu em vez de cada teste chamar
 *  `createClient` por conta própria. */

/** 🔴 A TRAVA DO HELPER DESTRUTIVO, e ela existe porque a alternativa é
 *  apagável demais pra ficar por disciplina.
 *
 *  `semearAcervo` faz `DELETE FROM ficha_versoes` no cliente que RECEBE, e
 *  `bancoDeProducao` o chama com o cliente do `getClient` — que é um singleton
 *  preguiçoso: se alguém já o tiver aberto neste arquivo de teste, ou se
 *  `TURSO_DATABASE_URL` estiver exportada no shell apontando pro Turso do João,
 *  o `DELETE` cai LÁ. Seria apagar o histórico de versões das fichas — a única
 *  procedência que existe desde que a ficha saiu do git — a partir da suíte de
 *  testes, sem ninguém pedir.
 *
 *  A checagem é a do próprio banco, não uma suposição sobre a URL: `protocol`
 *  separa local de remoto (`libsql://` vem como `http`/`ws`) e o
 *  `PRAGMA database_list` de um banco em memória devolve `file: ""`, enquanto um
 *  banco em arquivo devolve o caminho. O protocolo é checado ANTES do pragma, pra
 *  um cliente remoto ser recusado sem nem uma consulta de ida.
 *
 *  E ela ESTOURA, em vez de voltar em silêncio: teste que não semeou é teste que
 *  mede o vazio, e este projeto tem 42 espécies catalogadas de prova que passa
 *  verde sem travar nada. */
async function exigirBancoDescartavel(client: Client): Promise<void> {
  const recusa = (motivo: string) =>
    new Error(
      `semearAcervo() recusou o banco: ${motivo}. Este helper APAGA a tabela ` +
        "`ficha_versoes` antes de semear, então ele só roda em banco `:memory:`. " +
        "Se o alvo não é em memória, algo aponta o teste pro banco de verdade — " +
        "confira `TURSO_DATABASE_URL` no ambiente e quem chamou `getClient()` antes.",
    );
  if (client.protocol !== "file") throw recusa(`protocolo "${client.protocol}" não é local`);
  const r = await client.execute("PRAGMA database_list");
  const arquivo = String(r.rows[0]?.file ?? "(desconhecido)");
  if (arquivo !== "") throw recusa(`está em arquivo ("${arquivo}"), não em memória`);
}

/** A data da semente nos testes. Número fixo: o `criado_em` da versão não muda
 *  resposta nenhuma (o desempate é por `id`), e um relógio de verdade aqui
 *  faria a mesma suíte contar histórias diferentes a cada hora. */
export const AGORA_SEMENTE = 1_758_000_000;

/** Põe o acervo do repositório neste banco e esquece a cópia em memória.
 *
 *  🔴 O `DELETE` é o que dá isolamento entre testes do MESMO arquivo: o cliente
 *  de produção é um singleton, então sem isto uma versão gravada por um teste
 *  (é assim que se prova "editou e a tela mudou") sobreviveria pro seguinte. A
 *  tabela é append-only em PRODUÇÃO, que é onde a regra vale — aqui ela é o
 *  banco descartável de um processo de teste.
 *
 *  O `esquecerMemoria()` fecha uma porta estreita e real: a última leitura boa
 *  do `ficha-fonte` mora num módulo que vive o arquivo de teste inteiro, e só é
 *  servida quando o banco falha. Num arquivo que simule banco fora, ela
 *  entregaria o acervo do teste anterior — uma linha, e a porta fecha. */
export async function semearAcervo(client: Client): Promise<Ficha[]> {
  await exigirBancoDescartavel(client);
  await ensureSchema(client);
  await client.execute("DELETE FROM ficha_versoes");
  // 🔴 E AS OUTRAS CINCO TABELAS QUE UM TESTE SUJA (Tarefa 11e, I9 da
  // auditoria). Com a semente pulando todo endereço antigo (E6), uma troca de
  // endereço sobrevivendo pro teste seguinte o deixaria com um lugar a menos;
  // aviso, relato e rascunho de um teste também não podem atravessar pro outro.
  await client.execute("DELETE FROM enderecos_antigos");
  await client.execute("DELETE FROM avisos");
  await client.execute("DELETE FROM confirmacoes");
  await client.execute("DELETE FROM freshness");
  await client.execute("DELETE FROM ficha_rascunhos");
  const fichas = loadAll();
  await semear(client, fichas, AGORA_SEMENTE);
  esquecerMemoria();
  return fichas;
}

/** Abre o banco `:memory:` que o `getClient` DE PRODUÇÃO vai devolver, com o
 *  acervo dentro. Sem mock: só a variável de ambiente que o `getClient` lê.
 *
 *  Chamar duas vezes no mesmo arquivo devolve o MESMO cliente (o singleton do
 *  `db.ts`) já limpo e semeado de novo — é o que serve de `beforeEach`.
 *
 *  ⚠️ Com uma exceção: `vi.resetModules()` entre as duas chamadas descarta o
 *  módulo `db.ts` e com ele o singleton, então a segunda chamada abre um banco
 *  NOVO e o que a primeira gravou fica atrás. Quem precisa dos dois (resetar
 *  módulos E manter o banco) usa `bancoVazio()` + `semearAcervo()` com o cliente
 *  na mão e um dublê de `getClient`, que é o que `tests/app/admin-page.test.tsx`
 *  faz. Falha alta de qualquer forma — banco novo é banco vazio, e quem lê acha
 *  zero ficha —, mas o aviso é mais barato que a descoberta. */
export async function bancoDeProducao(): Promise<Client> {
  process.env.TURSO_DATABASE_URL = ":memory:";
  const client = getClient();
  await semearAcervo(client);
  return client;
}

/** Um banco `:memory:` VAZIO e avulso, pra quem precisa de um cliente só seu. */
export function bancoVazio(): Client {
  return createClient({ url: ":memory:" });
}

/** Grava uma versão NOVA de um lugar, como o painel fará.
 *
 *  🔴 É a prova que separa "o teste espera a promessa" de "o teste lê o banco":
 *  a ficha muda DEPOIS do primeiro `getAllFichas()`, e o segundo tem que
 *  trazer a mudança. Com o getter lendo o JSON do repositório, ou com
 *  `versaoAtual` pegando a linha velha, o texto novo nunca chega. */
export async function gravarEdicao(
  client: Client,
  ficha: Ficha,
  mudanca: Partial<Ficha>,
  quando: number = AGORA_SEMENTE + 60,
): Promise<Ficha> {
  const nova = { ...ficha, ...mudanca } as Ficha;
  await gravarVersao(client, ficha.slug, JSON.stringify(nova), "painel", quando);
  return nova;
}

/** Um id que NENHUMA versão tem, mas que é um `baseId` válido na forma — o que
 *  `base` devolve pra endereço sem lugar. Se fosse `0` (inválido), a recusa
 *  "slug que não é lugar → 400" passaria a sair da guarda do `baseId`, e a guarda
 *  do lugar ficaria sem prova (duas portas em série). */
export const BASE_DE_NINGUEM = 999_999_999;

/** A versão ATUAL de `slug` — o `baseId` de uma tela do painel aberta AGORA
 *  (onda de fix 2 da 11e, M6). SQL cru, de propósito: vários arquivos dublam
 *  `versaoAtual` pra montar uma corrida, e este helper não pode disparar o dublê. */
export async function base(client: Client, slug: string): Promise<number> {
  const r = await client.execute({
    sql: `SELECT id FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1`,
    args: [slug],
  });
  return r.rows.length ? Number(r.rows[0].id) : BASE_DE_NINGUEM;
}

/** A rota do painel como uma ABA ABERTA AGORA a chama: o corpo que tem `slug` e
 *  NÃO tem `baseId` ganha o `baseId` da versão atual daquele slug, lido na hora
 *  do pedido (onda de fix 2 da 11e). É o que deixa as provas que existiam antes
 *  da onda medirem o que mediam — uma tela fresca —, sem copiar o `baseId` em
 *  cada corpo. Corpo que já traz a chave `baseId` vai como está; corpo que não é
 *  JSON de objeto também. A prova de que a rota EXIGE o `baseId` não passa por
 *  aqui: ela chama a rota crua (`tests/api/aba-velha-retomada.test.ts`). */
export function comBaseAtual(
  rota: (req: Request) => Promise<Response>,
  client: () => Client,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const texto = await req.text();
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = undefined;
    }
    const comSlug =
      typeof corpo === "object" && corpo !== null && !Array.isArray(corpo) &&
      typeof (corpo as { slug?: unknown }).slug === "string" && !("baseId" in corpo);
    const novo = comSlug
      ? JSON.stringify({ ...(corpo as Record<string, unknown>), baseId: await base(client(), (corpo as { slug: string }).slug) })
      : texto;
    return rota(new Request(req.url, { method: req.method, headers: req.headers, body: novo }));
  };
}

/** UM CLIENTE QUE INTERCALA (onda de fix 3 da 11e, N1/N2 da re-revisão): o
 *  `Client` de teste, intacto, exceto que IMEDIATAMENTE ANTES do 1º `execute`
 *  cujo SQL começa com `gatilho` ele roda `antes()` — e só uma vez.
 *
 *  🔴 É O QUE PROVA "NA MESMA CONSULTA". As corridas de antes intercalavam
 *  entre a leitura da ROTA e a chamada da função de gravar; aqui o outro pedido
 *  entra DENTRO da função, entre qualquer `SELECT` que ela faça e o `INSERT`.
 *  Uma gravação que confira (ou leia) numa consulta e grave noutra passa a ver
 *  o mundo velho, e o teste acusa.
 *
 *  🔴 E CONTA QUANTAS VEZES DISPAROU. O gatilho é TEXTO de SQL: se a gravação
 *  mudar de forma (outro começo de statement, `batch` em vez de `execute`), o
 *  dublê nunca dispara e o teste mediria o vazio. Quem usa afirma
 *  `disparos > 0`. `batch` e o resto passam direto, sem gatilho. */
export function clienteQueIntercala(
  real: Client,
  gatilho: RegExp,
  antes: () => Promise<void>,
): { cliente: Client; disparos: () => number } {
  let armado = true;
  let disparos = 0;
  const cliente = new Proxy(real, {
    get(alvo, chave) {
      if (chave === "execute") {
        return async (...args: Parameters<Client["execute"]>) => {
          const primeiro = args[0] as unknown;
          const sql = typeof primeiro === "string" ? primeiro : (primeiro as { sql: string }).sql;
          if (armado && gatilho.test(sql.trimStart())) {
            armado = false;
            disparos++;
            await antes();
          }
          return (alvo.execute as (...a: unknown[]) => ReturnType<Client["execute"]>)(...args);
        };
      }
      const v = Reflect.get(alvo, chave, alvo) as unknown;
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(alvo) : v;
    },
  });
  return { cliente, disparos: () => disparos };
}
