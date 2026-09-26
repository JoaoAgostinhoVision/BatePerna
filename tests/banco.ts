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
