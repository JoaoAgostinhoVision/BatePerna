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
  await ensureSchema(client);
  await client.execute("DELETE FROM ficha_versoes");
  const fichas = loadAll();
  await semear(client, fichas, AGORA_SEMENTE);
  esquecerMemoria();
  return fichas;
}

/** Abre o banco `:memory:` que o `getClient` DE PRODUÇÃO vai devolver, com o
 *  acervo dentro. Sem mock: só a variável de ambiente que o `getClient` lê.
 *
 *  Chamar duas vezes no mesmo arquivo devolve o MESMO cliente (o singleton do
 *  `db.ts`) já limpo e semeado de novo — é o que serve de `beforeEach`. */
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
