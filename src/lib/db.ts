import { createClient, type Client } from "@libsql/client";
import { REGRA_PADRAO_INICIAL, type RegraPadrao } from "@/lib/regra-padrao";
import { SEVERIDADES, type Severidade } from "@/lib/severidade";

export type TipoRelato = "seco" | "barro";

export type EfeitoAviso = "nenhum" | "fresco" | "frio" | "fechado";

export type AvisoLinha = {
  id: number;
  ficha_slug: string;
  texto: string;
  efeito: EfeitoAviso;
  criado_em: number;
  vence_em: number;
};

export type Freshness = {
  ficha_slug: string;
  estado: string;
  calculado_em: number;
  fonte: string;
  previsao_bruta: string | null;
};

let singleton: Client | null = null;

export function getClient(): Client {
  if (singleton) return singleton;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL não configurada");
  singleton = createClient({ url, authToken });
  return singleton;
}

export async function ensureSchema(client: Client): Promise<void> {
  await client.execute(`CREATE TABLE IF NOT EXISTS freshness (
    ficha_slug TEXT PRIMARY KEY, estado TEXT NOT NULL, calculado_em INTEGER NOT NULL,
    fonte TEXT NOT NULL, previsao_bruta TEXT)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS confirmacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    criado_em INTEGER NOT NULL, tipo TEXT NOT NULL DEFAULT 'foi')`);
  // 🔴 APPEND-ONLY, e `retirado` em vez de DELETE: o aviso é afirmação do dono
  // sobre um lugar real. Saber o que foi dito e quando é a régua deste projeto.
  // `vence_em` é NOT NULL de propósito — aviso sem prazo é mentira agendada.
  await client.execute(`CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    texto TEXT NOT NULL, efeito TEXT NOT NULL,
    criado_em INTEGER NOT NULL, vence_em INTEGER NOT NULL,
    retirado INTEGER NOT NULL DEFAULT 0)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS avisos_por_lugar ON avisos (ficha_slug, retirado, vence_em)`,
  );
  // 🔴 APPEND-ONLY, como `avisos`, e pela mesma razão: o que foi dito sobre um
  // lugar real, e quando, é a espinha deste projeto. A ficha saiu do git em
  // 2026-09-24, então ESTA tabela é a única procedência que existe — não há
  // `git blame` de socorro. Voltar a uma versão antiga GRAVA uma versão nova.
  //
  // 🔴 A ÚNICA EXCEÇÃO AO APPEND-ONLY, e ela não toca no que foi DITO (Tarefa
  // 11e): trocar o endereço (`trocarEndereco`) faz UPDATE no `ficha_slug` e no
  // `slug` de dentro de cada `doc` daquele lugar. O slug é IDENTIDADE, não
  // palavra do dono — e um lugar com o histórico partido entre dois endereços,
  // ou com docs que dizem um endereço morando em outro (o "Ficha divergente" de
  // `fichaDaVersao` derrubaria a home inteira), seria pior que o UPDATE. Nenhum
  // texto, preço, aviso ou visibilidade muda; e o ATO fica gravado numa versão
  // nova, com `endereco_anterior`.
  //
  // `doc` é o JSON da ficha INTEIRA, não um campo. Versão de documento inteiro
  // torna "voltar" trivial e espelha o que o git fazia; o custo é não haver
  // diff por campo, que ninguém pediu.
  await client.execute(`CREATE TABLE IF NOT EXISTS ficha_versoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    doc TEXT NOT NULL, autor TEXT NOT NULL, criado_em INTEGER NOT NULL)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS ficha_versoes_por_lugar ON ficha_versoes (ficha_slug, id)`,
  );
  await migrarColunaOculto(client);
  // 🔴 ESTA TABELA SOBRESCREVE — como `freshness` (cache recalculado) e
  // `enderecos_antigos` (abaixo), as outras duas que não são append-only —, e o
  // motivo é de régua, não de preguiça (spec §7.2, Tarefa 11): **rascunho nunca afirmou nada sobre o
  // lugar; o histórico existe pra guardar o que o app já disse.** `avisos` e
  // `ficha_versoes` são append-only porque o que está nelas FOI À TELA de
  // alguém; um rascunho nunca foi. Guardar cada toque do formulário seria
  // procedência de coisa que ninguém leu.
  //
  // E ele mora FORA de `ficha_versoes` porque lá tudo está no ar: a primeira
  // linha de um lugar meio preenchido já apareceria na home. `doc` é JSON
  // PARCIAL — não passa no `fichaSchema`, e é esse o ponto. Publicar (Tarefa 12)
  // é o que valida, grava a versão 1 e apaga esta linha.
  await client.execute(`CREATE TABLE IF NOT EXISTS ficha_rascunhos (
    slug TEXT PRIMARY KEY, doc TEXT NOT NULL, atualizado_em INTEGER NOT NULL)`);
  // 🔴 O ENDEREÇO É DADO NO BANCO (Tarefa 11e, decisão do João de 04/10): um
  // lugar publicado muda de endereço SÓ quando ele manda, e o endereço antigo
  // passa a levar ao novo — o link que já circula no WhatsApp não morre. Cada
  // linha diz "quem abrir `velho` vai pra `novo`".
  //
  // SEM CADEIA, por construção (ver `trocarEndereco`): trocar A→B e depois B→C
  // deixa A→C e B→C, nunca A→B→C. Uma consulta, uma resposta.
  //
  // ⚠️ E ELA SOBRESCREVE E APAGA, como `ficha_rascunhos`, e pela mesma régua: a
  // linha não afirma nada sobre o lugar — é encanamento de link. A procedência
  // ("este lugar morou em A") mora em `ficha_versoes.endereco_anterior`, que é
  // append-only; aqui a linha pode sumir quando A for RETOMADO por outro lugar.
  await client.execute(`CREATE TABLE IF NOT EXISTS enderecos_antigos (
    velho TEXT PRIMARY KEY, novo TEXT NOT NULL, em INTEGER NOT NULL)`);
  await migrarColunaEnderecoAnterior(client);
  // 🔴 A ORIGEM DO LUGAR (spec de 07/10): quem mandou e se o João conferiu.
  // Chave = a IDENTIDADE do lugar (menor `id` das versões, `identidadeSql`),
  // que anda com ele na troca de endereço. SÓ lugar mandado por quem usa tem
  // linha: ausente = lugar do João, conferido por definição. A única porta que
  // faz nascer linha é `publicarRascunho` com contribuidor, no MESMO batch da
  // versão 1. Sobrescreve (o "Conferi" é UPDATE): não afirma nada que já foi
  // à tela — o que foi à tela está em `ficha_versoes`.
  await client.execute(`CREATE TABLE IF NOT EXISTS origem_do_lugar (
    lugar INTEGER PRIMARY KEY, contribuidor TEXT NOT NULL,
    conferido INTEGER NOT NULL DEFAULT 0, conferido_em INTEGER)`);
  // Quem contribui. Nome e e-mail SÓ pro painel dele — nunca pra tela pública.
  await client.execute(`CREATE TABLE IF NOT EXISTS contribuidores (
    id TEXT PRIMARY KEY, nome TEXT, email TEXT,
    bloqueado INTEGER NOT NULL DEFAULT 0, criado_em INTEGER NOT NULL)`);
  // Uma linha só (`CHECK (id = 1)`). `INSERT OR IGNORE`: a semente desta linha
  // NUNCA desfaz o que o João mudou pelo painel — `ensureSchema` roda a cada
  // `npm run semear`.
  await client.execute(`CREATE TABLE IF NOT EXISTS regra_padrao (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    janela_previsao_horas REAL NOT NULL, janela_passado_horas REAL NOT NULL,
    limiar_mm REAL NOT NULL, severidade TEXT NOT NULL, atualizado_em INTEGER NOT NULL)`);
  await client.execute({
    sql: `INSERT OR IGNORE INTO regra_padrao
            (id, janela_previsao_horas, janela_passado_horas, limiar_mm, severidade, atualizado_em)
          VALUES (1, ?, ?, ?, ?, 0)`,
    args: [
      REGRA_PADRAO_INICIAL.janela_previsao_horas,
      REGRA_PADRAO_INICIAL.janela_passado_horas,
      REGRA_PADRAO_INICIAL.limiar_mm,
      REGRA_PADRAO_INICIAL.severidade,
    ],
  });
  // 🔴 O NOMINATIM (spec de 17/10): duas tabelas que SOBRESCREVEM e não afirmam
  // nada que foi à tela. `nominatim_respostas` é cache (JSON cru, 30 dias, a
  // velha vira a nova); `nominatim_vez` é a linha única do limite de 1/s —
  // `INSERT OR IGNORE`, como `regra_padrao`, pra semear de novo não zerar a vez.
  // Sem elas todo ponto salvo responde "não consegui achar a cidade": rode
  // `npm run semear` ANTES do deploy.
  await client.execute(`CREATE TABLE IF NOT EXISTS nominatim_respostas (
    chave TEXT PRIMARY KEY, resposta TEXT NOT NULL, em INTEGER NOT NULL)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS nominatim_vez (
    id INTEGER PRIMARY KEY CHECK (id = 1), ultima_ms INTEGER NOT NULL)`);
  await client.execute(`INSERT OR IGNORE INTO nominatim_vez (id, ultima_ms) VALUES (1, 0)`);
  await migrarColunaContribuidorDoRascunho(client);
}

/** A coluna `endereco_anterior` de `ficha_versoes` (Tarefa 11e, I4 da
 *  auditoria), pelo MESMO molde de `migrarColunaOculto` e pelas mesmas razões
 *  (a tabela já está em produção; `ADD COLUMN` não tem `IF NOT EXISTS`).
 *
 *  Só a versão do ATO de trocar o endereço a preenche, com o endereço de onde o
 *  lugar veio. Sem ela, o único registro de "este lugar morou em A" seria a
 *  linha de `enderecos_antigos` — que some quando A é retomado (E5). Numa
 *  tabela que é a única procedência do projeto, o fato sumiria do banco.
 *
 *  Nula em toda linha que já existe, e é a verdade: nenhuma delas trocou de
 *  endereço. */
async function migrarColunaEnderecoAnterior(client: Client): Promise<void> {
  const colunas = await client.execute(`PRAGMA table_info(ficha_versoes)`);
  if (colunas.rows.some((c) => String(c.name) === "endereco_anterior")) return;
  await client.execute(`ALTER TABLE ficha_versoes ADD COLUMN endereco_anterior TEXT`);
}

/** A coluna `oculto` de `ficha_versoes`, por `ALTER TABLE` guardado.
 *
 *  🔴 ELA NÃO PODE NASCER NO `CREATE TABLE` ACIMA, e é por isso que esta
 *  função existe: `ficha_versoes` JÁ ESTÁ EM PRODUÇÃO desde 2026-09-26, então
 *  o `CREATE TABLE IF NOT EXISTS` não roda mais lá — acrescentar a coluna na
 *  string dele mudaria o schema dos bancos NOVOS e deixaria o de produção sem a
 *  coluna, que é o pior dos dois mundos.
 *
 *  🔴 E `ALTER TABLE ... ADD COLUMN` NÃO TEM `IF NOT EXISTS` NO SQLITE.
 *  `ensureSchema` roda a cada `npm run semear` (e `scripts/apply-schema.ts`),
 *  que pode ser repetido — NUNCA no boot do app: o app em produção não cria
 *  coluna nem tabela. Sem o guarda, a SEGUNDA semente estouraria com
 *  "duplicate column name: oculto". E sem a semente rodar ANTES do deploy, a
 *  coluna e as tabelas novas não existem no banco, e o código PÚBLICO que as
 *  consulta estoura com "no such column/table" — a ordem `semear` → deploy não
 *  protege só o painel. Medido por leitura na re-revisão de 06/10, sem a semente
 *  caem: o "✓ Fui" inteiro (todo POST, e o GET por `?lugar=`, perguntam por
 *  `oculto` em `LUGAR_NO_AR`); TODO 404 de ficha, que vira página de erro
 *  (500), porque toda falta de `/[slug]` — link errado, robô, endereço velho —
 *  consulta `enderecos_antigos` antes do `notFound`, e o mesmo vale pra
 *  `/api/carimbo` e `/api/confirmar` com endereço desconhecido; e o painel. A
 *  home, o `/trilhas` e as fichas que existem ficam de pé. O guarda pergunta ao
 *  próprio banco (`PRAGMA table_info`) em vez de capturar a mensagem de erro do
 *  driver: a mensagem é do driver e muda com a versão dele, o pragma é a
 *  pergunta de verdade.
 *
 *  `DEFAULT 0` é o que faz toda linha JÁ GRAVADA nascer VISÍVEL — ninguém
 *  escondeu nada antes de hoje, e o dono não pode encontrar o acervo inteiro
 *  fora do ar depois de um deploy. `NOT NULL` pela mesma razão do `vence_em`
 *  de `avisos`: numa coluna que decide o que está no ar, valor em branco é
 *  uma pergunta sem resposta. */
async function migrarColunaOculto(client: Client): Promise<void> {
  const colunas = await client.execute(`PRAGMA table_info(ficha_versoes)`);
  if (colunas.rows.some((c) => String(c.name) === "oculto")) return;
  await client.execute(`ALTER TABLE ficha_versoes ADD COLUMN oculto INTEGER NOT NULL DEFAULT 0`);
}

/** A coluna `contribuidor` de `ficha_rascunhos` (spec de 07/10): de quem é o
 *  rascunho. NULL = do João — toda linha que já existe, e é a verdade. Mesmo
 *  molde de `migrarColunaOculto`: a tabela já está em produção e `ADD COLUMN`
 *  não tem `IF NOT EXISTS`. */
async function migrarColunaContribuidorDoRascunho(client: Client): Promise<void> {
  const colunas = await client.execute(`PRAGMA table_info(ficha_rascunhos)`);
  if (colunas.rows.some((c) => String(c.name) === "contribuidor")) return;
  await client.execute(`ALTER TABLE ficha_rascunhos ADD COLUMN contribuidor TEXT`);
}

export function inicioDoDiaRecife(agora: number): number {
  const OFFSET = -3 * 3600; // America/Recife = UTC-3, sem horário de verão
  return Math.floor((agora + OFFSET) / 86400) * 86400 - OFFSET;
}

export async function upsertFreshness(
  client: Client,
  row: { slug: string; estado: string; calculadoEm: number; fonte: string; previsaoBruta: string },
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO freshness (ficha_slug, estado, calculado_em, fonte, previsao_bruta)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ficha_slug) DO UPDATE SET
            estado = excluded.estado,
            calculado_em = excluded.calculado_em,
            fonte = excluded.fonte,
            previsao_bruta = excluded.previsao_bruta`,
    args: [row.slug, row.estado, row.calculadoEm, row.fonte, row.previsaoBruta],
  });
}

export async function getFreshness(client: Client, slug: string): Promise<Freshness | null> {
  const rs = await client.execute({
    sql: `SELECT ficha_slug, estado, calculado_em, fonte, previsao_bruta
          FROM freshness WHERE ficha_slug = ?`,
    args: [slug],
  });
  const r = rs.rows[0];
  if (!r) return null;
  return {
    ficha_slug: String(r.ficha_slug),
    estado: String(r.estado),
    calculado_em: Number(r.calculado_em),
    fonte: String(r.fonte),
    previsao_bruta: r.previsao_bruta == null ? null : String(r.previsao_bruta),
  };
}

/** Grava um relato em `slug`, SEM CONDIÇÃO NENHUMA — HELPER DE FIXTURE.
 *
 *  🔴 NENHUMA ROTA A CHAMA desde a Tarefa 12b (I4 da auditoria): a porta do
 *  "✓ Fui" é `gravarRelatoDoLugar`, que grava pela IDENTIDADE do lugar. Esta
 *  fica, incondicional, porque os testes de troca e de publicar precisam montar
 *  relatos ÓRFÃOS (num endereço sem lugar), que nenhuma porta de hoje produz.
 *  Um guarda por nome (`tests/api/route-confirmar.test.ts`) trava a volta dela
 *  pra rota. */
export async function insertConfirmacao(
  client: Client,
  slug: string,
  criadoEm: number,
  tipo: TipoRelato,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO confirmacoes (ficha_slug, criado_em, tipo) VALUES (?, ?, ?)`,
    args: [slug, criadoEm, tipo],
  });
}

/** A IDENTIDADE DE UM ENDEREÇO na forma de SQL: o menor `id` de
 *  `ficha_versoes` em `endereco` (uma expressão SQL — `?` ou uma coluna).
 *
 *  🔴 UMA FONTE SÓ (I5/B3 da auditoria da 12b): a página lê a identidade por
 *  `identidadeDoLugar` e a rota grava com `gravarRelatoDoLugar`; se cada uma
 *  escrevesse a sua, mudar uma (a versão mais NOVA em vez da primeira, ou o
 *  banco inteiro em vez do endereço) deixaria a outra provando o velho. As duas
 *  — e `enderecoDoLugar` — usam esta.
 *
 *  POR QUE O MENOR `id` (Tarefa 12b): é estável. As versões andam com o lugar
 *  na troca de endereço (`trocarEndereco`, passo 9), nunca são apagadas, editar,
 *  voltar e esconder só ACRESCENTAM versão, e o publicar só grava onde não há
 *  versão nenhuma. A versão mais NOVA não serve: mudaria a cada correção de
 *  vírgula do dono, e o relato de quem foi seria recusado por ela. */
function identidadeSql(endereco: string): string {
  return `(SELECT MIN(i.id) FROM ficha_versoes i WHERE i.ficha_slug = ${endereco})`;
}

/** A identidade do lugar que mora em `slug` agora, ou `null` se ninguém mora.
 *  NÃO filtra `oculto`: quem decide visibilidade é quem já decide hoje (a
 *  página só renderiza lugar no ar; a gravação confere no próprio INSERT). */
export async function identidadeDoLugar(client: Client, slug: string): Promise<number | null> {
  const r = await client.execute({ sql: `SELECT ${identidadeSql("?")} AS lugar`, args: [slug] });
  const v = r.rows[0]?.lugar;
  return v == null ? null : Number(v);
}

/** O que diz que a versão `v` é a PRIMEIRA do lugar onde mora, e que ele está
 *  NO AR (a versão atual não é `oculto = 1` — mesma régua de `versoesAtuais`). */
const LUGAR_NO_AR = `v.id = ${identidadeSql("v.ficha_slug")}
   AND (SELECT a.oculto FROM ficha_versoes a WHERE a.ficha_slug = v.ficha_slug ORDER BY a.id DESC LIMIT 1) <> 1`;

/** GRAVA O RELATO DO "✓ FUI" NO LUGAR `lugar`, onde ele mora AGORA, e devolve
 *  esse endereço — ou `null` sem gravar nada, quando `lugar` não é a identidade
 *  de lugar nenhum, ou o lugar está escondido (Tarefa 12b, C1 da auditoria).
 *
 *  🔴 QUEM ESCOLHE O ENDEREÇO É A IDENTIDADE, NO MESMO STATEMENT QUE GRAVA. O
 *  relato de P contado em `A` conta pra P em `B` (P trocou de endereço), mesmo
 *  que Q tenha retomado `A` no meio — e Q nunca recebe. Uma leitura antes
 *  ("onde P mora?") e um INSERT depois deixariam exatamente a janela em que a
 *  troca cabe; e conferir pelo endereço do PEDIDO jogaria fora o relato bom de
 *  P quando Q retoma `A`. O "escondido não conta" também mora aqui, e não numa
 *  leitura separada (M2).
 *
 *  `rowsAffected` NÃO serve de resposta: com `RETURNING`, o libsql devolve `0`
 *  mesmo gravando (medido em 06/10). Quem diz se gravou são as linhas. */
export async function gravarRelatoDoLugar(
  client: Client,
  lugar: number,
  tipo: TipoRelato,
  agora: number,
): Promise<string | null> {
  const r = await client.execute({
    sql: `INSERT INTO confirmacoes (ficha_slug, criado_em, tipo)
          SELECT v.ficha_slug, ?, ? FROM ficha_versoes v
           WHERE v.id = ?
             AND ${LUGAR_NO_AR}
          RETURNING ficha_slug`,
    args: [agora, tipo, lugar],
  });
  return r.rows.length ? String(r.rows[0].ficha_slug) : null;
}

/** Onde o lugar `lugar` mora AGORA, se ele está no ar — o placar que a página
 *  dele lê (`GET /api/confirmar?lugar=`). `null` pra identidade de ninguém ou
 *  de lugar escondido. Mesma condição de `gravarRelatoDoLugar`. */
export async function enderecoDoLugar(client: Client, lugar: number): Promise<string | null> {
  const r = await client.execute({
    sql: `SELECT v.ficha_slug FROM ficha_versoes v WHERE v.id = ? AND ${LUGAR_NO_AR}`,
    args: [lugar],
  });
  return r.rows.length ? String(r.rows[0].ficha_slug) : null;
}

export async function countConfirmacoes(client: Client, slug: string): Promise<number> {
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?`,
    args: [slug],
  });
  return Number(rs.rows[0]?.n ?? 0);
}

export async function contarHoje(
  client: Client,
  slug: string,
  agora: number,
): Promise<{ foram: number; barro: number }> {
  const inicio = inicioDoDiaRecife(agora);
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS foram,
                 SUM(CASE WHEN tipo = 'barro' THEN 1 ELSE 0 END) AS barro
          FROM confirmacoes
          WHERE ficha_slug = ? AND criado_em >= ?`,
    args: [slug, inicio],
  });
  const r = rs.rows[0];
  return { foram: Number(r?.foram ?? 0), barro: Number(r?.barro ?? 0) };
}

/** Grava um aviso — SÓ SE A VERSÃO `baseId` (a que a tela do dono abriu) MORA
 *  EM `slug` NA HORA DE GRAVAR, e devolve `null` quando não mora (onda de fix
 *  da Tarefa 11e, I1 da revisão; e a onda de fix 2, M6).
 *
 *  🔴 A CONDIÇÃO MORA NO MESMO `INSERT`, NUNCA NUMA LEITURA ANTES. A rota lê o
 *  lugar e grava depois; se a troca de endereço roda no meio, o aviso caía no
 *  endereço VELHO — um "fechado" que o dono publicou e que nunca aparecia no
 *  lugar, que já morava no novo. Com o `WHERE EXISTS`, quem decide é o banco no
 *  instante da gravação.
 *
 *  🔴 E O ENDEREÇO NÃO É IDENTIDADE (M6): se OUTRO lugar retomou `slug`, "existe
 *  versão em `slug`" é verdade — a dele — e o aviso de um lugar caía no outro.
 *  Quem identifica o lugar é a versão que a tela abriu: as versões andam com o
 *  lugar na troca, então a da aba velha já mora no endereço novo, e aqui não
 *  bate. Ver `gravarEdicao`. */
export async function inserirAviso(
  client: Client, slug: string, texto: string, efeito: EfeitoAviso,
  criadoEm: number, venceEm: number, baseId: number,
): Promise<number | null> {
  const r = await client.execute({
    sql: `INSERT INTO avisos (ficha_slug, texto, efeito, criado_em, vence_em)
          SELECT ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
          RETURNING id`,
    args: [slug, texto, efeito, criadoEm, venceEm, baseId, slug],
  });
  return r.rows.length ? Number(r.rows[0].id) : null;
}

function linha(r: Record<string, unknown>): AvisoLinha {
  return {
    id: Number(r.id), ficha_slug: String(r.ficha_slug), texto: String(r.texto),
    efeito: String(r.efeito) as EfeitoAviso,
    criado_em: Number(r.criado_em), vence_em: Number(r.vence_em),
  };
}

/** O aviso que vale AGORA pra este lugar: o mais recente que não venceu e não
 *  foi retirado. `vence_em > agora` — no instante exato do prazo, já venceu. */
export async function avisoVigente(
  client: Client, slug: string, agora: number,
): Promise<AvisoLinha | null> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE ficha_slug = ? AND retirado = 0 AND vence_em > ?
          ORDER BY criado_em DESC, id DESC LIMIT 1`,
    args: [slug, agora],
  });
  return r.rows.length ? linha(r.rows[0] as unknown as Record<string, unknown>) : null;
}

/** Todos os vigentes de uma vez — a home tem N lugares, e N consultas saindo
 *  do celular no portão é o que `resolverEstados` já existe pra evitar. */
export async function avisosVigentes(
  client: Client, agora: number,
): Promise<Map<string, AvisoLinha>> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE retirado = 0 AND vence_em > ? ORDER BY criado_em ASC, id ASC`,
    args: [agora],
  });
  const fora = new Map<string, AvisoLinha>();
  // ASC + set = o último a entrar vence, que é o mais recente. Um por lugar.
  for (const row of r.rows) {
    const a = linha(row as unknown as Record<string, unknown>);
    fora.set(a.ficha_slug, a);
  }
  return fora;
}

/** Tirar da tela. NUNCA apaga a linha — ver o comentário da tabela. */
export async function retirarAviso(client: Client, id: number): Promise<void> {
  await client.execute({ sql: `UPDATE avisos SET retirado = 1 WHERE id = ?`, args: [id] });
}

export type AutorVersao = "painel" | "semente" | "contribuidor";

export type FichaVersao = {
  id: number;
  ficha_slug: string;
  doc: string;
  autor: AutorVersao;
  criado_em: number;
  /** `true` = fora do público. NÃO é "apagado": a linha continua no histórico,
   *  o painel continua editando o lugar, e a versão seguinte pode devolvê-lo ao
   *  ar. Ver `versoesAtuais`. */
  oculto: boolean;
  /** Só na versão do ATO de trocar o endereço (Tarefa 11e): o endereço de onde
   *  o lugar veio. Ausente em toda outra versão — a chave nem existe, e não
   *  `null`, pra uma versão comum continuar com a forma de sempre. */
  endereco_anterior?: string;
};

function versaoDaLinha(r: Record<string, unknown>): FichaVersao {
  return {
    id: Number(r.id),
    ficha_slug: String(r.ficha_slug),
    doc: String(r.doc),
    autor: String(r.autor) as AutorVersao,
    criado_em: Number(r.criado_em),
    // 🔴 `Number(...) === 1`, NUNCA `Boolean(r.oculto)`. Se o driver devolver a
    // coluna como STRING, `Boolean("0")` é `true` — e TODA ficha do acervo
    // nasceria escondida, o app inteiro fora do ar sem ninguém pedir. Mesma
    // régua das outras conversões desta função: à mão, e pro tipo certo.
    oculto: Number(r.oculto) === 1,
    ...(r.endereco_anterior == null ? {} : { endereco_anterior: String(r.endereco_anterior) }),
  };
}

/** Grava uma versão NOVA — INSERT, nunca UPDATE (ver o comentário da tabela;
 *  a única exceção é a troca de endereço, `trocarEndereco`, e é de IDENTIDADE).
 *
 *  🔴 ESTA É A FORMA DO NASCIMENTO, INCONDICIONAL: a 1ª versão de um lugar (a
 *  semente; a publicação, Tarefa 12) nasce em endereço VAZIO por definição. Quem
 *  grava versão de um lugar QUE JÁ EXISTE (as rotas `ficha` e `visibilidade` do
 *  painel) usa `gravarEdicao` (conteúdo) ou `gravarVisibilidade`, as formas
 *  condicionais — ver lá o porquê (a corrida com a troca de endereço, e a de
 *  duas gravações do mesmo lugar). As formas são separadas pelo NOME, e cada rota
 *  do painel importa só a sua; a prova é `tests/api/corrida-endereco.test.ts`.
 *
 *  🔴 O `oculto` TEM DEFAULT `false` PRA NÃO MEXER NOS CHAMADORES ANTIGOS, E
 *  ISSO É UMA ARMADILHA PARA QUEM GRAVA UMA EDIÇÃO. Quem grava versão nova de um
 *  lugar QUE JÁ EXISTE tem de passar o `oculto` da versão ATUAL: com o default,
 *  o dono esconde um lugar, conserta um typo pelo celular, e o lugar VOLTA AO AR
 *  em silêncio. Visibilidade só muda pela porta que existe pra isso
 *  (`POST /api/admin/visibilidade`) — nunca de carona numa edição de campo. É o
 *  que `src/app/api/admin/ficha/route.ts` faz, com o porquê escrito lá — hoje
 *  por `gravarEdicao`, que nem recebe o `oculto`: lê o da versão atual no
 *  próprio INSERT (onda de fix 3 da 11e). */
export async function gravarVersao(
  client: Client, slug: string, doc: string, autor: AutorVersao, criadoEm: number,
  oculto: boolean = false,
): Promise<number> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [slug, doc, autor, criadoEm, oculto ? 1 : 0],
  });
  return Number(r.rows[0].id);
}

/** Grava uma versão nova de um lugar QUE JÁ EXISTE — só se ele ainda mora em
 *  `slug` na hora de gravar. Devolve `null` (sem gravar nada) quando não mora
 *  mais (onda de fix da Tarefa 11e, I1 da revisão).
 *
 *  🔴 A CORRIDA QUE ISTO FECHA: a rota lê `versaoAtual(A)`, a troca de endereço
 *  leva o lugar pra B, e a rota grava em A. Com o `INSERT` de sempre, isso
 *  RECRIAVA o lugar em A (uma versão só, no ar) e travava A pra sempre — e o pior:
 *  um "esconder" respondia 200 e o lugar seguia no ar em B. A condição mora NO
 *  MESMO `INSERT` (`WHERE EXISTS`), nunca numa leitura antes: entre ler e gravar
 *  é exatamente onde a troca cabe.
 *
 *  🔴 E "MORA EM `slug`" É PELA VERSÃO QUE A TELA ABRIU, NÃO POR "`slug` TEM
 *  VERSÃO" (onda de fix 2 da 11e, M6 — medido pelas rotas reais). O lugar P sai
 *  de A pra B, o lugar Q retoma A: A TEM versão (a de Q), e a aba velha de P em
 *  `/admin/A` gravava a voz de P em Q e escondia Q, as duas com 200. O endereço
 *  não é identidade. `baseId` é a versão que a página do painel renderizou; as
 *  versões andam com o lugar na troca (`trocarEndereco`, passo 9), então a da
 *  aba velha mora em B e `id = baseId AND ficha_slug = slug` não acha nada em A.
 *  Esta condição SUBSTITUI a da onda 1 (que era só "`slug` tem versão"): ela a
 *  contém — a corrida da onda 1 também move a versão `baseId` pra longe de A.
 *
 *  ⚠️ `baseId` NÃO É TRAVA DE CONCORRÊNCIA DO MESMO LUGAR: qualquer versão do
 *  lugar, atual ou não, passa. Duas abas do mesmo lugar continuam gravando como
 *  sempre gravaram (ruling U1 da onda 2); o que se confere é só identidade.
 *
 *  🔴 O `oculto` NÃO VEM DE QUEM CHAMA: é o da versão ATUAL, lido DENTRO deste
 *  mesmo INSERT (onda de fix 3 da 11e, N1 da re-revisão — linha vermelha). Esta
 *  é a forma das edições de CONTEÚDO (campo e voltar), e visibilidade não é
 *  assunto delas (ver a armadilha descrita em `gravarVersao`). Até a onda 3 a
 *  rota passava o `oculto` que tinha LIDO antes; o dono tocava "Salvar" e, com
 *  o PUT ainda trabalhando, "Esconder" na mesma tela — o esconder gravava, e o
 *  PUT gravava depois o `oculto` de antes: os dois 200, e **o lugar de volta no
 *  ar em silêncio**. Lido aqui, entre ler e gravar não cabe ninguém. Mudar a
 *  visibilidade é `gravarVisibilidade`. O autor é sempre o painel — a semente
 *  nunca edita, ela só faz nascer. */
export async function gravarEdicao(
  client: Client, slug: string, doc: string, criadoEm: number, baseId: number,
): Promise<number | null> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          SELECT ?, ?, 'painel', ?,
                 (SELECT oculto FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1)
          WHERE EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
          RETURNING id`,
    args: [slug, doc, criadoEm, slug, baseId, slug],
  });
  return r.rows.length ? Number(r.rows[0].id) : null;
}

/** Esconde um lugar, ou o devolve ao ar: uma versão nova com o `oculto` pedido
 *  e o DOCUMENTO DA VERSÃO ATUAL, copiado DENTRO deste mesmo INSERT (onda de fix
 *  3 da 11e, N1 — o mesmo `INSERT … SELECT` do passo 7 da troca de endereço).
 *  Devolve `null`, sem gravar nada, quando a versão `baseId` não mora em `slug`
 *  — a mesma identidade de `gravarEdicao`, no mesmo statement.
 *
 *  🔴 POR QUE O DOCUMENTO NÃO VEM DE QUEM CHAMA: a rota lia a versão atual e
 *  gravava o `doc` dela depois. Com um "Salvar" de campo no meio, o esconder
 *  regravava o documento de ANTES e a voz que o dono acabara de salvar sumia —
 *  perda, com 200 nos dois. Visibilidade não é assunto de conteúdo, nem o
 *  contrário. O documento vai VERBATIM (sem `json_set`, sem renormalizar): ver
 *  `src/app/api/admin/visibilidade/route.ts`. */
export async function gravarVisibilidade(
  client: Client, slug: string, oculto: boolean, criadoEm: number, baseId: number,
): Promise<number | null> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          SELECT ficha_slug, doc, 'painel', ?, ?
          FROM ficha_versoes
          WHERE ficha_slug = ?
            AND EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
          ORDER BY id DESC LIMIT 1
          RETURNING id`,
    args: [criadoEm, oculto ? 1 : 0, slug, baseId, slug],
  });
  return r.rows.length ? Number(r.rows[0].id) : null;
}

/** O que a porta da visibilidade precisa pra decidir que um pedido NÃO grava
 *  nada (o estado pedido já vale) — numa consulta SÓ (onda de fix 3 da 11e, N5
 *  da re-revisão): a versão atual de `slug` (`id`, `oculto`) e se a versão
 *  `baseId`, a que a tela abriu, mora em `slug` (`daTela`). `null` = `slug` não
 *  tem versão.
 *
 *  🔴 POR QUE NUMA SÓ: a rota lia o estado numa consulta e a identidade noutra.
 *  Com duas trocas de endereço entre as duas (o lugar de lá sai, o da tela
 *  volta), o estado era de um lugar e a identidade do outro — e um "esconder"
 *  respondia 200 com o lugar da tela no ar. Aqui as duas respostas são do mesmo
 *  instante do banco. */
export async function estadoDaTela(
  client: Client, slug: string, baseId: number,
): Promise<{ id: number; oculto: boolean; daTela: boolean } | null> {
  const r = await client.execute({
    sql: `SELECT id, oculto,
                 EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?) AS da_tela
          FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1`,
    args: [baseId, slug, slug],
  });
  if (!r.rows.length) return null;
  const l = r.rows[0];
  return { id: Number(l.id), oculto: Number(l.oculto) === 1, daTela: Number(l.da_tela) === 1 };
}

/** A ficha de AGORA daquele lugar: a versão de maior `id`.
 *
 *  🔴 ORDENA POR `id`, NÃO POR `criado_em`. Duas gravações no mesmo segundo
 *  são reais (salvar duas vezes seguidas), e por tempo o desempate viraria
 *  sorteio — o João salvaria e veria a versão anterior. O `id` é monotônico. */
export async function versaoAtual(client: Client, slug: string): Promise<FichaVersao | null> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1`,
    args: [slug],
  });
  return r.rows.length ? versaoDaLinha(r.rows[0]) : null;
}

/** Uma versão específica, por `id` — a peça que falta pro "voltar": antes de
 *  regravar o conteúdo dela, quem chama tem que conferir que `ficha_slug`
 *  bate com o lugar pedido (ver `src/app/api/admin/ficha/route.ts`). Devolve
 *  `null` pra um `id` que não existe, nunca lança. */
export async function versaoPorId(client: Client, id: number): Promise<FichaVersao | null> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE id = ?`,
    args: [id],
  });
  return r.rows.length ? versaoDaLinha(r.rows[0]) : null;
}

/** A versão atual de TODOS os lugares, numa consulta só — irmão do
 *  `avisosVigentes`, e pela mesma razão: N consultas no portão é o que esta
 *  família evita.
 *
 *  🔴 O PADRÃO É SÓ O QUE ESTÁ NO AR. Lugar cuja versão de maior `id` tem
 *  `oculto = 1` NÃO SAI DAQUI. É o lado seguro pra quem chamar sem pensar —
 *  mas, desde 2026-10-06, NENHUM chamador de produção usa o padrão: todos os
 *  da lista abaixo passam `incluirOcultos` — os itens 3 e 5 até 07/10, quando
 *  passaram a ler `lerAcervoComOrigem`, que traz os escondidos pela mesma razão.
 *
 *  🔴 QUEM TEM DE PASSAR `{ incluirOcultos: true }`, E POR QUÊ (medido antes de
 *  escrever a coluna, porque o padrão novo muda estes em silêncio):
 *
 *   1. **O portão de coerência** (`src/app/api/admin/ficha/route.ts`): duas das
 *      regras comparam uma ficha com as outras, e **lugar escondido
 *      volta**. Sem o acervo inteiro, o buraco é: esconder o Véu → copiar a voz
 *      dele na Rampa (passa, o Véu não está mais no acervo medido) → mostrar o
 *      Véu de novo → duas fichas públicas dizendo a mesma coisa.
 *   2. **A semente** (`src/lib/semente.ts`): um acervo todo escondido pareceria
 *      VAZIO, e `npm run semear` regravaria tudo VISÍVEL por cima do que o dono
 *      escondeu de propósito.
 *   3. **A lista do painel** (`getAcervoDoDono`, em `src/lib/ficha.ts`; Task 9,
 *      2026-10-01): esconder é tirar do PÚBLICO, não do dono — sem os ocultos
 *      o lugar escondido sumia da lista dele, sem caminho de volta pela tela.
 *   4. **A publicação** (`src/app/api/admin/publicar/route.ts`): a mesma
 *      coerência por diferença do item 1, e pelo mesmo porquê — o lugar novo
 *      é medido contra os escondidos também, porque escondido volta.
 *   5. **A leitura do PÚBLICO** (`getAllFichas`, em `src/lib/ficha.ts`; C1 da
 *      revisão final do painel completo, 2026-10-06): `buscarFichas` decide
 *      "banco sem semente" pelo acervo INTEIRO e só depois tira os escondidos.
 *      Com o padrão, esconder TODOS os lugares parecia banco vazio, e o app
 *      público caía (ou, até 07/10, quando ainda havia memória, ela servia os
 *      escondidos).
 *   (E `parOcupado`, em `src/lib/par-de-lugar.ts`: o par nome+cidade de um
 *   lugar escondido continua ocupado, pela mesma razão do item 1.)
 *
 *  🔴 E O FILTRO FICA **FORA** DA SUBCONSULTA, DE PROPÓSITO. Dentro dela
 *  (`SELECT MAX(id) ... WHERE oculto <> 1`) o lugar escondido continuaria
 *  aparecendo, servido pela última versão VISÍVEL — o dono esconderia o lugar e
 *  o público continuaria vendo a ficha dele, uma versão atrasada. O `MAX(id)`
 *  escolhe a versão que vale; só depois se pergunta se ela está no ar.
 *
 *  🔴 E É `oculto <> 1`, NÃO `oculto = 0`, PORQUE ESTA CONSULTA E O
 *  `versaoDaLinha` LEEM A MESMA COLUNA E TÊM DE CONCORDAR. Lá a régua é
 *  `Number(r.oculto) === 1` (ver o porquê ali), ou seja: **só `1` esconde, tudo
 *  o mais está no ar**. Com `= 0` aqui, um valor estranho na coluna — texto, o
 *  que um driver ou um escritor fora desta API produziria — sairia ESCONDIDO pro
 *  público e VISÍVEL pro painel: duas respostas pra mesma pergunta sobre o mesmo
 *  lugar, que é a espécie de defeito que este projeto já pagou três vezes. E o
 *  lado escolhido é "no ar", porque é o estado de todo lugar que ninguém
 *  escondeu, e porque o acervo inteiro sair do ar por um valor torto é o pior
 *  desfecho possível. */
export async function versoesAtuais(
  client: Client,
  opts: { incluirOcultos?: boolean } = {},
): Promise<Map<string, FichaVersao>> {
  const r = await client.execute(
    `SELECT * FROM ficha_versoes WHERE id IN
       (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)
       ${opts.incluirOcultos ? "" : "AND oculto <> 1"}`,
  );
  return new Map(r.rows.map((l) => { const v = versaoDaLinha(l); return [v.ficha_slug, v]; }));
}

/** Tudo que já foi dito sobre UM lugar, do mais novo pro mais velho.
 *
 *  🔴 NÃO FILTRA `oculto`, e nem `versaoAtual` nem `versaoPorId` filtram —
 *  esconder é tirar do PÚBLICO, não tirar do DONO. Se qualquer uma das três
 *  passasse a filtrar, o painel deixaria de conseguir editar um lugar escondido
 *  e o "voltar" morreria com ele: uma porta de mão única, que é o defeito que a
 *  ruling C1 da Tarefa 1 desta rodada já pagou uma vez. */
export async function historico(client: Client, slug: string): Promise<FichaVersao[]> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC`,
    args: [slug],
  });
  return r.rows.map(versaoDaLinha);
}

export type Rascunho = { slug: string; doc: string; atualizado_em: number };

function rascunhoDaLinha(r: Record<string, unknown>): Rascunho {
  return { slug: String(r.slug), doc: String(r.doc), atualizado_em: Number(r.atualizado_em) };
}

/** Regrava o rascunho de `slug` — SÓ SE ELE AINDA EXISTE ali. Devolve `false`
 *  sem gravar nada quando não há rascunho em `slug` (Tarefa 12, I1 da auditoria
 *  de 06/10).
 *
 *  🔴 É A FORMA DO PUT DO RASCUNHO, e é `UPDATE`, nunca upsert: o PUT lê o
 *  rascunho e grava depois; se a PUBLICAÇÃO (`publicarRascunho`) roda no meio,
 *  o upsert que o PUT usava até a Tarefa 12 RECRIAVA o rascunho em `slug` — ao
 *  lado do lugar que acabou de ir ao ar no mesmo endereço, que é o estado que
 *  `criarRascunho` recusa — e a última resposta do dono ficava fora
 *  do lugar no ar, em silêncio. Com o `UPDATE`, o rascunho só nasce por
 *  `criarRascunho`. (Aquele upsert não mora mais em `src`: virou helper de
 *  teste, em `tests/banco.ts`.)
 *
 *  🔴 O `atualizado_em` SÓ CRESCE, e ESTRITAMENTE (M1 da revisão da Tarefa 12):
 *  ele é a IDENTIDADE do rascunho que a tela de publicar leu, e `agora` é em
 *  segundos. Com `= agora`, duas gravações no MESMO segundo deixavam a
 *  identidade igual com o documento diferente, e o publicar levaria ao ar o que
 *  a tela não mostrou. `MAX(agora, atual + 1)`: toda gravação muda a identidade.
 *
 *  SÓ os do João (07/10): o rascunho de quem usa o app é dela até publicar, e
 *  o painel não age sobre ele. */
export async function regravarRascunho(client: Client, slug: string, doc: string, agora: number): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET doc = ?, atualizado_em = MAX(?, atualizado_em + 1) WHERE slug = ? AND contribuidor IS NULL`,
    args: [doc, agora, slug],
  });
  return r.rowsAffected === 1;
}

/** Faz um rascunho NASCER, e só se o `slug` estiver livre nas DUAS tabelas.
 *  Devolve `false` sem gravar nada quando já existe rascunho com esse slug OU
 *  lugar com esse slug em `ficha_versoes`.
 *
 *  🔴 O `NOT EXISTS` EM `ficha_versoes` NÃO FILTRA `oculto`, de propósito: um
 *  lugar ESCONDIDO continua sendo um lugar, e volta ao ar. Um rascunho com o
 *  slug dele seria publicado (Tarefa 12) como versão nova DAQUELE lugar — e com
 *  `oculto = 0`, o desescondendo. É a mesma régua de `versaoAtual`/`historico`.
 *
 *  🔴 E É UMA CONSULTA SÓ, não "ler e depois gravar": a conferência e o INSERT
 *  acontecem juntos no banco, então não há janela entre os dois. É a ÚNICA
 *  porta da colisão: a rota só lê `versaoAtual` DEPOIS de uma recusa, pra
 *  escolher a frase. */
export async function criarRascunho(client: Client, slug: string, doc: string, agora: number): Promise<boolean> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_rascunhos (slug, doc, atualizado_em)
          SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
          ON CONFLICT(slug) DO NOTHING`,
    args: [slug, doc, agora, slug],
  });
  return r.rowsAffected === 1;
}

/** Muda o rascunho de `de` pra o endereço `para`, com o documento `doc` — e só
 *  se `para` estiver livre nas DUAS tabelas, pela régua de `criarRascunho`
 *  (sem filtro de `oculto`). Devolve `false` sem mudar nada quando `para` já é
 *  de um rascunho ou de um lugar, ou quando não há rascunho em `de`.
 *
 *  🔴 POR QUE EXISTE (onda de fix 2 da Tarefa 11b): o endereço de um RASCUNHO
 *  acompanha o nome e a cidade dele até publicar — ainda não há link
 *  circulando, e o endereço velho seria o de um par que não é mais o dele, que
 *  a Tarefa 12 publicaria.
 *
 *  🔴 E É UM `UPDATE` SÓ, nunca "criar o novo e apagar o velho" (uma janela com
 *  DOIS rascunhos do mesmo lugar) nem "apagar e criar" (uma janela com nenhum):
 *  a conferência do destino e a troca de chave acontecem juntas no banco.
 *  `para` diferente de `de` é de quem chama — com os dois iguais, o próprio
 *  rascunho ocuparia o destino e a resposta seria `false`.
 *
 *  O `atualizado_em` cresce ESTRITAMENTE, pela régua de `regravarRascunho`.
 *
 *  SÓ os do João (07/10): o rascunho de quem usa o app é dela até publicar, e
 *  o painel não age sobre ele. Os dois `NOT EXISTS` do destino continuam sem filtro de dono, mas
 *  desde a Task 17 (13/10) o de rascunho só alcança os do JOÃO: hoje só o
 *  rascunho dele tem chave = endereço; o dela mora numa chave (`rascunho_…`)
 *  que nenhum endereço iguala, e nunca ocupa `para`. */
export async function moverRascunho(client: Client, de: string, para: string, doc: string, agora: number): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET slug = ?, doc = ?, atualizado_em = MAX(?, atualizado_em + 1)
          WHERE slug = ? AND contribuidor IS NULL
            AND NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
            AND NOT EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ?)`,
    args: [para, doc, agora, de, para, para],
  });
  return r.rowsAffected === 1;
}

/** O rascunho de `slug`, ou `null` se não há.
 *
 *  SÓ os do João (07/10): o rascunho de quem usa o app é dela até publicar, e
 *  o painel não age sobre ele. */
export async function lerRascunho(client: Client, slug: string): Promise<Rascunho | null> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE slug = ? AND contribuidor IS NULL`,
    args: [slug],
  });
  return r.rows.length ? rascunhoDaLinha(r.rows[0] as unknown as Record<string, unknown>) : null;
}

/** Todos os rascunhos, o mexido por último primeiro — é a ordem da lista do
 *  painel, onde o dono volta pro que estava preenchendo.
 *
 *  SÓ os do João (desde 07/10): o rascunho de quem usa o app é dela até
 *  publicar, e não entra na lista do painel. */
export async function listarRascunhos(client: Client): Promise<Rascunho[]> {
  const r = await client.execute(
    `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE contribuidor IS NULL
     ORDER BY atualizado_em DESC, slug ASC`,
  );
  return r.rows.map((l) => rascunhoDaLinha(l as unknown as Record<string, unknown>));
}

/** Tira o rascunho — o `DELETE` do painel. Pode apagar sem culpa pela mesma
 *  razão de `ficha_rascunhos` sobrescrever: rascunho nunca afirmou nada.
 *  (Publicar NÃO passa por aqui: o rascunho sai DENTRO do batch de
 *  `publicarRascunho`, como o último passo dele.)
 *
 *  Devolve SE APAGOU (M1 da revisão da Tarefa 15): `false` quando não havia
 *  rascunho naquele endereço — movido noutra aba, publicado, ou já apagado. É o
 *  `rowsAffected` de um DELETE simples, sem `RETURNING` (medido no libsql local:
 *  1 com a linha, 0 sem ela). A rota responde 404 nesse caso, pra a tela não
 *  dizer "desisti" de um rascunho que continua lá.
 *
 *  SÓ os do João (07/10): o rascunho de quem usa o app é dela até publicar, e
 *  o painel não age sobre ele. */
export async function apagarRascunho(client: Client, slug: string): Promise<boolean> {
  const r = await client.execute({ sql: `DELETE FROM ficha_rascunhos WHERE slug = ? AND contribuidor IS NULL`, args: [slug] });
  return r.rowsAffected === 1;
}

/** TROCA O ENDEREÇO DE UM LUGAR PUBLICADO, de `velho` pra `novo`, e o velho
 *  passa a levar ao novo (Tarefa 11e, decisões do João de 04/10). Devolve
 *  `false` SEM MUDAR NADA quando `velho` não é lugar, ou quando `novo` já é de
 *  um lugar (no ar ou ESCONDIDO — lugar escondido é lugar, e volta) ou de um
 *  rascunho. `novo` é de quem chama: a rota o calcula no servidor, do nome e da
 *  cidade que o documento já diz (I6 da auditoria).
 *
 *  🔴 UM BATCH `write`, UMA TRANSAÇÃO: todos os passos ou nenhum (medido pela
 *  auditoria nos dois drivers — local é `BEGIN IMMEDIATE`/`ROLLBACK`; remoto o
 *  hrana condiciona cada passo ao anterior). Um lugar com o histórico partido
 *  entre dois endereços, ou dois lugares no mesmo, é o que um meio-termo daria.
 *
 *  🔴 E UM BATCH NÃO RAMIFICA (I5): a conferência "novo livre" é o 1º passo
 *  (o INSERT da linha `velho→novo`, só se velho é lugar e novo está livre), e
 *  TODO passo seguinte é condicionado a ESSA linha existir com este `em`. Copiar
 *  o `NOT EXISTS` em cada passo seria errado: depois do 1º UPDATE mover as
 *  versões, "novo livre" vira falso e o resto ficaria no velho, EM SILÊNCIO.
 *  E `client.transaction()` (que deixaria ler e decidir) é PROIBIDO aqui: em
 *  `:memory:` o cliente 0.14 larga a conexão depois dela, e a consulta seguinte
 *  abre um banco VAZIO — é assim que roda a suíte inteira.
 *
 *  🔴 E A PORTA É "A LINHA DESTE `em` EXISTE **E** O VELHO AINDA TEM VERSÃO"
 *  (M1 da revisão da onda de fix). Só a linha não bastava: duas requisições no
 *  MESMO segundo davam o mesmo `(velho, novo, em)`, a 2ª passava pela porta
 *  aberta pela 1ª e gravava um SEGUNDO ato — e respondia "nada mudou". Com o
 *  velho ainda tendo versão, a 2ª acha o velho vazio e não faz nada. Por isso
 *  mover as versões é o ÚLTIMO passo: até ele, o velho ainda tem versão em todo
 *  passo deste batch (a subconsulta do próprio último passo não depende de
 *  linha — é avaliada uma vez).
 *
 *  Os passos, em ordem, e por que cada um:
 *   1. a linha `velho→novo` — o portão (ver acima). "Velho é lugar" é "a
 *      versão `baseId`, a que a tela do dono abriu, mora em `velho`" (onda de
 *      fix 2, M6): se outro lugar retomou `velho`, a aba velha moveria ESSE
 *      lugar. Ver `gravarEdicao`. É só aqui: todo passo seguinte depende da
 *      linha que este grava;
 *   2. os ÓRFÃOS de `novo` (relato gravado lá por uma corrida do "✓ Fui"
 *      ANTES da Tarefa 12b, depois que o lugar de antes saiu dali — desde ela,
 *      `gravarRelatoDoLugar` grava onde o lugar mora no instante do INSERT, e
 *      relato órfão novo não nasce; aviso, desde a onda de fix,
 *      `inserirAviso` já não grava em endereço sem lugar — o passo fica pelos
 *      dois) voltam pro lugar a que `novo` levava —
 *      quem retoma um endereço não herda o "N foram hoje" de outro lugar;
 *   3. avisos e relatos mudam de `ficha_slug`;
 *   4. `freshness`: a linha órfã de `novo` sai antes (PK — é cache
 *      recalculável, não afirmação do dono), e a do lugar vai junto;
 *   5. quem apontava pro velho passa a apontar pro novo (sem cadeia);
 *   6. a linha cujo `velho` é o NOVO some — é a retomada (E5), e a ida e volta
 *      A→B→A não deixa um A→A;
 *   7. a versão do ATO, por `INSERT … SELECT` da atual (ainda no velho) DENTRO
 *      do batch, já no `novo` e já com o `slug` de dentro reescrito: herda o
 *      `oculto` dela (C1 — com o default, trocar o endereço de um lugar
 *      escondido o poria no ar) e grava `endereco_anterior`;
 *   8. o `slug` de DENTRO de cada `doc` vira `novo` (`json_set`, que sai byte a
 *      byte igual ao `JSON.stringify` — medido). Sem isto, "voltar" gravaria um
 *      doc que diz `velho` sob `novo` e o "Ficha divergente" derrubaria a home
 *      INTEIRA. `json_valid` deixa a versão ilegível como está (M4): sem ele, um
 *      doc torto estouraria o batch e o lugar nunca mais trocaria de endereço;
 *   9. as versões mudam de `ficha_slug` — por último (ver a porta). */
export async function trocarEndereco(
  client: Client, velho: string, novo: string, agora: number, baseId: number,
): Promise<boolean> {
  // O portão de todo passo depois do 1º: a linha que o 1º acabou de gravar, e
  // o lugar ainda no velho.
  const porta = `EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ? AND novo = ? AND em = ?)
              AND EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)`;
  const p = [velho, novo, agora, velho];
  const rs = await client.batch(
    [
      {
        sql: `INSERT INTO enderecos_antigos (velho, novo, em)
              SELECT ?, ?, ?
              WHERE EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
                AND NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
                AND NOT EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ?)
              ON CONFLICT(velho) DO NOTHING`,
        args: [velho, novo, agora, baseId, velho, novo, novo],
      },
      {
        sql: `UPDATE avisos SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [novo, novo, novo, ...p],
      },
      {
        sql: `UPDATE confirmacoes SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [novo, novo, novo, ...p],
      },
      { sql: `UPDATE avisos SET ficha_slug = ? WHERE ficha_slug = ? AND ${porta}`, args: [novo, velho, ...p] },
      { sql: `UPDATE confirmacoes SET ficha_slug = ? WHERE ficha_slug = ? AND ${porta}`, args: [novo, velho, ...p] },
      { sql: `DELETE FROM freshness WHERE ficha_slug = ? AND ${porta}`, args: [novo, ...p] },
      { sql: `UPDATE freshness SET ficha_slug = ? WHERE ficha_slug = ? AND ${porta}`, args: [novo, velho, ...p] },
      { sql: `UPDATE enderecos_antigos SET novo = ? WHERE novo = ? AND ${porta}`, args: [novo, velho, ...p] },
      { sql: `DELETE FROM enderecos_antigos WHERE velho = ? AND ${porta}`, args: [novo, ...p] },
      {
        sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto, endereco_anterior)
              SELECT ?, CASE WHEN json_valid(doc) THEN json_set(doc, '$.slug', ?) ELSE doc END, 'painel', ?, oculto, ?
              FROM ficha_versoes WHERE ficha_slug = ? AND ${porta}
              ORDER BY id DESC LIMIT 1`,
        args: [novo, novo, agora, velho, velho, ...p],
      },
      {
        sql: `UPDATE ficha_versoes SET doc = json_set(doc, '$.slug', ?)
              WHERE ficha_slug = ? AND json_valid(doc) AND ${porta}`,
        args: [novo, velho, ...p],
      },
      { sql: `UPDATE ficha_versoes SET ficha_slug = ? WHERE ficha_slug = ? AND ${porta}`, args: [novo, velho, ...p] },
    ],
    "write",
  );
  return rs[0].rowsAffected === 1;
}

/** PUBLICA O RASCUNHO DE `slug`: o lugar novo vai ao ar como a versão 1, e o
 *  rascunho deixa de existir (Tarefa 12). Devolve `false` SEM MUDAR NADA quando
 *  `slug` já é de um lugar (no ar ou ESCONDIDO) ou quando o rascunho de `slug`
 *  não é mais o que a tela leu (`atualizadoEm` — outro "Salvar", um rename, ou
 *  já publicado por um toque anterior).
 *
 *  `doc` é o documento JÁ NORMALIZADO e conferido pela rota
 *  (`src/app/api/admin/publicar/route.ts`): schema, obrigatórios, horário, par,
 *  coerência. Esta função só decide o que é de BANCO, no instante da gravação.
 *
 *  🔴 UM BATCH `write`, UMA TRANSAÇÃO, no molde de `trocarEndereco` (C1 da
 *  auditoria de 06/10) — e NUNCA `gravarVersao`, que é um `execute` próprio e
 *  incondicional: "confere antes e grava depois" deixa a janela onde um lugar
 *  nasce em `slug` (e o publicar viraria versão nova DELE, com `oculto = 0`,
 *  desescondendo-o), e quatro chamadas separadas deixam meio-termos.
 *
 *  🔴 E UM BATCH NÃO RAMIFICA: o portão é o 1º passo (o INSERT da versão, só se
 *  `slug` não tem versão NENHUMA — sem filtro de `oculto`: lugar escondido é
 *  lugar, e volta — E o rascunho de `slug` ainda tem o `atualizado_em` que a
 *  tela leu). TODO passo seguinte é condicionado à `porta`, que tem DUAS
 *  cláusulas, e cada uma decide sozinha num caso (M2 da revisão da Tarefa 12:
 *  havia uma terceira, `slug` com UMA versão só, que nenhum caso decidia — se a
 *  versão do 1º passo existe, ela é a única, porque o 1º passo exigiu `slug`
 *  sem versão nenhuma — e ela saiu):
 *   - a versão que o 1º passo gravou (este `doc`, este `criado_em`, este
 *     `autor` — `painel`, ou `contribuidor` desde 07/10 —, no ar) está em `slug`. É ela que segura um publicar recusado pelo
 *     ENDEREÇO: o rascunho continua lá com o mesmo `atualizado_em`, e só esta
 *     cláusula cai;
 *   - o rascunho ainda está lá com aquele `atualizado_em`. É ela que segura o
 *     DUPLO TOQUE concorrente no mesmo segundo: o 2º batch acha a versão do 1º
 *     (a mesma, byte a byte) e só esta cláusula cai — sem ela, ele refazia os
 *     passos 2 a 6 e apagava a `freshness` que `slug` ganhou no meio.
 *  O rascunho sai no ÚLTIMO passo, então a porta vale do 2º ao último — e um
 *  publicar recusado (o rascunho mudou, o endereço já tem lugar, já foi
 *  publicado) não toca em nada: nem órfão, nem a linha `velho = slug`, nem a
 *  `freshness`, nem o rascunho.
 *
 *  O `oculto` é o literal `0`: o lugar novo nasce no ar, e nunca herda a
 *  visibilidade de outro lugar.
 *
 *  Os passos, em ordem, e por que cada um (12-E5, com o I13 da auditoria):
 *   1. a versão 1 — o portão;
 *   2. e 3. os ÓRFÃOS de `slug` (aviso e relato que chegaram lá DEPOIS de o
 *      lugar de antes sair — a corrida do "✓ Fui" anterior à Tarefa 12b; o que
 *      chegou enquanto ele morava ali foi junto na troca) voltam pro lugar a que
 *      `slug` levava (`velho = slug`) — o SQL é o dos passos 2 e 3 de
 *      `trocarEndereco`. Quem nasce num endereço não herda o "N foram hoje" nem
 *      o aviso de outro lugar. Têm de vir ANTES do passo 5, que apaga a linha
 *      que eles leem.
 *      ⚠️ SEM linha `velho = slug`, os órfãos FICAM (M7 da auditoria). É estado
 *      que nenhuma porta de hoje produz: relato só entra no endereço onde o
 *      lugar mora no instante do INSERT (`gravarRelatoDoLugar`, por construção
 *      desde a Tarefa 12b) e aviso só pra versão que mora no endereço
 *      (`inserirAviso`); o único jeito de um endereço ficar sem lugar com
 *      aviso/relato dentro é o lugar SAIR dele, e sair grava a linha. Quando a
 *      linha some por retomada, a retomada já levou os órfãos (`trocarEndereco`
 *      passo 2) — e aqui, o passo 2;
 *   4. a `freshness` de `slug` sai: é cache recalculável (a do lugar que saiu
 *      foi junto com ele na troca), e o UPDATE pra outro endereço violaria a PK;
 *   5. a linha `velho = slug` some — o endereço é RETOMADO pelo lugar novo, e o
 *      link antigo passa a levar a ele (decisão do João de 04/10, a mesma da
 *      retomada pela troca);
 *   6. o rascunho, por último (ver a porta) — o 7º quando quem publica é
 *      quem usa o app (ver abaixo).
 *
 *  🔴 E DESDE 07/10 ELA PUBLICA TAMBÉM O LUGAR DE QUEM USA (`contribuidor` não
 *  nulo): a versão nasce com `autor = 'contribuidor'`, e um passo a mais — o
 *  penúltimo, ANTES de o rascunho sair, porque a porta depende dele — faz
 *  nascer a linha de `origem_do_lugar` com `conferido = 0`. Os dois na mesma
 *  transação: lugar da pessoa no ar sem origem seria lido como do João, SEM
 *  MARCA. O 1º passo confere também que o rascunho é de quem publica
 *  (`contribuidor IS ?`: o painel não publica rascunho dela, ela não publica o
 *  dele), que ela não está bloqueada (`id = NULL` nunca casa: o João passa) e
 *  — ruling de produto da pré-auditoria de 07/10 — que o endereço NÃO é
 *  endereço antigo de outro lugar quando quem publica é ela (`? IS NULL OR …`:
 *  o João continua retomando, com a régua de hoje). O link velho do João
 *  continua levando ao lugar dele.
 *
 *  🔴 E DESDE A TASK 17 (decisão do João de 13/10, "rascunho não deve
 *  bloquear") O RASCUNHO DELA NÃO MORA NO ENDEREÇO: mora numa CHAVE própria
 *  (`novaChaveDeRascunho`, em `db-contribuidor.ts`), que `dela.chave` traz, e
 *  `slug` é o ENDEREÇO onde o lugar vai nascer — calculado pela rota, do nome
 *  e da cidade, na hora de publicar. Os dois andam SEPARADOS e cada passo usa
 *  o seu: o 1º passo confere a versão (`NOT EXISTS`) e o endereço antigo no
 *  ENDEREÇO, e o rascunho (dela, com o `atualizado_em` da tela) na CHAVE; a
 *  `porta` confere o rascunho pela CHAVE e, pelo ENDEREÇO, UMA versão com este
 *  doc, este `criado_em` e este autor; os passos 2 a 5 (órfãos, `freshness`, `enderecos_antigos`) operam
 *  no ENDEREÇO; o DELETE final, na CHAVE. Tudo na mesma transação. É o
 *  `NOT EXISTS` do 1º passo que decide quem fica com o endereço quando duas
 *  pessoas (ou ela e o João) publicam o mesmo par: o primeiro batch grava a
 *  versão, e o segundo a acha ali. ⚠️ Pra ela, os passos 2, 3 e 5 nunca acham
 *  linha: o 1º passo já recusou o endereço que é antigo, e são eles que leem a
 *  linha `velho = slug`. Ficam porque o batch é um só pros dois donos.
 *  ⚠️ PRA ELA, A PORTA JÁ NÃO PROVA "foi ESTE batch que gravou a versão" (M1
 *  da revisão da Task 17): antes só cabia um rascunho por endereço; agora dois
 *  rascunhos DELA (chaves diferentes) com o mesmo doc, publicados no mesmo
 *  segundo, fazem o 2º batch ser recusado no 1º passo e PASSAR na porta (o
 *  rascunho dele está lá; a versão do 1º tem o mesmo doc, `criado_em` e
 *  autor). Quem segura é o INSERT de `origem_do_lugar`: a versão do 1º já tem
 *  origem, a chave primária estoura, e a transação volta INTEIRA — nada do 2º
 *  fica gravado, nem o DELETE do rascunho dele. Esta função então LANÇA o
 *  erro de restrição (não devolve `false`), e a rota dela o trata como
 *  recusa (`/api/contribuir/publicar`). No do João não acontece: uma chave =
 *  um endereço = um rascunho.
 *  Sem `dela`, a chave É o endereço — o caminho do João, byte a byte o de
 *  antes. Um rascunho do João no mesmo endereço não impede o dela (não é o
 *  rascunho dela, e rascunho não ocupa); depois, é o publicar dele que acha o
 *  lugar ali e é recusado. */
export async function publicarRascunho(
  client: Client, slug: string, doc: string, agora: number, atualizadoEm: number,
  dela: { contribuidor: string; chave: string } | null = null,
): Promise<boolean> {
  const contribuidor = dela?.contribuidor ?? null;
  // A chave do rascunho: a dela (Task 17), ou — no do João — o próprio endereço.
  const chave = dela?.chave ?? slug;
  const autor: AutorVersao = contribuidor === null ? "painel" : "contribuidor";
  const porta = `EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ? AND atualizado_em = ?)
              AND EXISTS (SELECT 1 FROM ficha_versoes
                          WHERE ficha_slug = ? AND doc = ? AND criado_em = ? AND autor = ? AND oculto = 0)`;
  const p = [chave, atualizadoEm, slug, doc, agora, autor];
  const rs = await client.batch(
    [
      {
        sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
              SELECT ?, ?, ?, ?, 0
              WHERE NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
                AND EXISTS (SELECT 1 FROM ficha_rascunhos
                            WHERE slug = ? AND atualizado_em = ? AND contribuidor IS ?)
                AND NOT EXISTS (SELECT 1 FROM contribuidores WHERE id = ? AND bloqueado = 1)
                AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?))`,
        args: [slug, doc, autor, agora, slug, chave, atualizadoEm, contribuidor, contribuidor, contribuidor, slug],
      },
      {
        sql: `UPDATE avisos SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [slug, slug, slug, ...p],
      },
      {
        sql: `UPDATE confirmacoes SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [slug, slug, slug, ...p],
      },
      { sql: `DELETE FROM freshness WHERE ficha_slug = ? AND ${porta}`, args: [slug, ...p] },
      { sql: `DELETE FROM enderecos_antigos WHERE velho = ? AND ${porta}`, args: [slug, ...p] },
      // 🔴 `ORDER BY id LIMIT 1`, NUNCA `SELECT MIN(id)`: com a porta fechada o
      // agregado devolve UMA linha com NULL, e NULL numa `INTEGER PRIMARY KEY`
      // vira rowid novo — uma origem órfã. Sem linha, sem INSERT.
      ...(contribuidor === null
        ? []
        : [{
            sql: `INSERT INTO origem_do_lugar (lugar, contribuidor, conferido)
                  SELECT id, ?, 0 FROM ficha_versoes WHERE ficha_slug = ? AND ${porta}
                  ORDER BY id LIMIT 1`,
            args: [contribuidor, slug, ...p],
          }]),
      {
        sql: `DELETE FROM ficha_rascunhos WHERE slug = ? AND atualizado_em = ? AND ${porta}`,
        args: [chave, atualizadoEm, ...p],
      },
    ],
    "write",
  );
  return rs[0].rowsAffected === 1;
}

/** Pra onde o endereço `velho` leva hoje, ou `null` se ele não é endereço
 *  antigo de ninguém. NÃO diz se o lugar de lá está no ar: quem chama decide
 *  (a página pública só leva a lugar visível; o painel leva sempre). */
export async function enderecoNovoDe(client: Client, velho: string): Promise<string | null> {
  const r = await client.execute({ sql: `SELECT novo FROM enderecos_antigos WHERE velho = ?`, args: [velho] });
  return r.rows.length ? String(r.rows[0].novo) : null;
}

/** Os endereços antigos que levam a `novo`, em ordem — a página do lugar os
 *  passa ao "✓ Fui", pra a fila offline subir os relatos guardados no
 *  endereço de antes (I1 da auditoria). */
export async function enderecosAntigosDe(client: Client, novo: string): Promise<string[]> {
  const r = await client.execute({
    sql: `SELECT velho FROM enderecos_antigos WHERE novo = ? ORDER BY velho`,
    args: [novo],
  });
  return r.rows.map((l) => String(l.velho));
}

/** Todo endereço antigo — a semente os trata como "já tem" (E6). */
export async function enderecosVelhos(client: Client): Promise<Set<string>> {
  const r = await client.execute(`SELECT velho FROM enderecos_antigos`);
  return new Set(r.rows.map((l) => String(l.velho)));
}

/** Todo endereço com RASCUNHO — a semente também os trata como "já tem" (M3 da
 *  revisão final do painel completo, 2026-10-06): versão ao lado de rascunho no
 *  mesmo endereço é o estado que `criarRascunho` recusa. Lê TODA chave: a do
 *  rascunho do João é o endereço, e a de quem usa nunca coincide com um (Task
 *  17, `novaChaveDeRascunho`) — entra no conjunto sem efeito. ⚠️ Desde a Task
 *  17 aquele estado EXISTE por um caminho: ela publica o par de um rascunho do
 *  João (rascunho não ocupa), e o rascunho dele fica ao lado do lugar dela até
 *  ele desistir — o publicar dele é recusado pelo lugar. */
export async function enderecosComRascunho(client: Client): Promise<Set<string>> {
  const r = await client.execute(`SELECT slug FROM ficha_rascunhos`);
  return new Set(r.rows.map((l) => String(l.slug)));
}

/** De onde veio o lugar. `contribuidor: null` = do João, e aí `conferido` é
 *  sempre `true`. */
export type OrigemDoLugar = { contribuidor: string | null; conferido: boolean };

/** 🔴 `Number(...) === 1` pela régua de `versaoDaLinha`, e o lado escolhido é
 *  o que MOSTRA a marca: valor torto numa linha de origem sai NÃO conferido.
 *  Sem linha (`o_contribuidor` nulo) é lugar do João. */
function origemDaLinha(r: Record<string, unknown>): OrigemDoLugar {
  if (r.o_contribuidor == null) return { contribuidor: null, conferido: true };
  return { contribuidor: String(r.o_contribuidor), conferido: Number(r.o_conferido) === 1 };
}

const SQL_REGRA_PADRAO = `SELECT janela_previsao_horas, janela_passado_horas, limiar_mm, severidade
                          FROM regra_padrao WHERE id = 1`;

/** 🔴 Sem linha, ou com severidade fora de `SEVERIDADES`, ESTOURA — nunca cai
 *  num padrão escrito aqui. Um carimbo com número que ninguém escolheu é a
 *  linha vermelha do projeto; a página cai no `error.tsx`, como banco fora. */
function regraDaLinha(r: Record<string, unknown> | undefined): RegraPadrao {
  if (!r) throw new Error("A regra padrão da chuva não está no banco: rode o schema (npm run semear).");
  const severidade = String(r.severidade);
  if (!(SEVERIDADES as readonly string[]).includes(severidade)) {
    throw new Error(`A regra padrão da chuva tem uma severidade que o app não conhece: "${severidade}".`);
  }
  return {
    janela_previsao_horas: Number(r.janela_previsao_horas),
    janela_passado_horas: Number(r.janela_passado_horas),
    limiar_mm: Number(r.limiar_mm),
    severidade: severidade as Severidade,
  };
}

export async function lerRegraPadrao(client: Client): Promise<RegraPadrao> {
  const r = await client.execute(SQL_REGRA_PADRAO);
  return regraDaLinha(r.rows[0] as unknown as Record<string, unknown> | undefined);
}

/** Grava SEM conferir: quem confere os números é a rota que chama esta função
 *  (`PUT /api/admin/regra-padrao`, Task 7), por `lerRegraDoCorpo`, em
 *  `porta-da-regra-padrao.ts`. Chamar daqui sem passar por lá grava sem juízo. */
export async function gravarRegraPadrao(client: Client, r: RegraPadrao, agora: number): Promise<void> {
  await client.execute({
    sql: `UPDATE regra_padrao SET janela_previsao_horas = ?, janela_passado_horas = ?,
            limiar_mm = ?, severidade = ?, atualizado_em = ? WHERE id = 1`,
    args: [r.janela_previsao_horas, r.janela_passado_horas, r.limiar_mm, r.severidade, agora],
  });
}

export type LinhaDoAcervo = { doc: string; oculto: boolean } & OrigemDoLugar;
export type AcervoComOrigem = { linhas: Map<string, LinhaDoAcervo>; padrao: RegraPadrao };

/** O JOIN da origem: a linha de `origem_do_lugar` cuja chave é a identidade do
 *  lugar onde a versão `v` mora — a mesma conta de `identidadeSql`. */
const JOIN_ORIGEM = `LEFT JOIN origem_do_lugar o
  ON o.lugar = (SELECT MIN(i.id) FROM ficha_versoes i WHERE i.ficha_slug = v.ficha_slug)`;

/** A versão atual de TODO lugar (escondidos inclusive, marcados), a ORIGEM de
 *  cada um e a regra padrão — numa transação de leitura só.
 *
 *  🔴 POR QUE NUM BATCH: em duas leituras, um lugar da pessoa publicado entre
 *  a primeira e a segunda sairia com versão e SEM origem — lido como do João,
 *  sem marca, na tela pública. O batch `read` é um retrato só do banco.
 *  (`client.transaction()` continua proibido: ver `trocarEndereco`.)
 *
 *  Os escondidos vêm junto pela razão de `buscarFichas` ("banco sem semente"
 *  se decide pelo acervo inteiro); quem filtra é quem devolve ao público. */
export async function lerAcervoComOrigem(client: Client): Promise<AcervoComOrigem> {
  const [acervo, regra] = await client.batch(
    [
      `SELECT v.ficha_slug, v.doc, v.oculto, o.contribuidor AS o_contribuidor, o.conferido AS o_conferido
         FROM ficha_versoes v ${JOIN_ORIGEM}
        WHERE v.id IN (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)`,
      SQL_REGRA_PADRAO,
    ],
    "read",
  );
  const linhas = new Map<string, LinhaDoAcervo>();
  for (const l of acervo.rows) {
    const r = l as unknown as Record<string, unknown>;
    linhas.set(String(r.ficha_slug), { doc: String(r.doc), oculto: Number(r.oculto) === 1, ...origemDaLinha(r) });
  }
  return { linhas, padrao: regraDaLinha(regra.rows[0] as unknown as Record<string, unknown> | undefined) };
}

/** UM lugar, pro painel: a versão atual (escondida ou não), a origem e a regra
 *  padrão — no mesmo retrato. `null` = ninguém mora em `slug`. */
export async function lugarDoDono(
  client: Client, slug: string,
): Promise<{ versao: FichaVersao; origem: OrigemDoLugar; padrao: RegraPadrao } | null> {
  const [atual, regra] = await client.batch(
    [
      {
        sql: `SELECT v.*, o.contribuidor AS o_contribuidor, o.conferido AS o_conferido
                FROM ficha_versoes v ${JOIN_ORIGEM}
               WHERE v.ficha_slug = ? ORDER BY v.id DESC LIMIT 1`,
        args: [slug],
      },
      SQL_REGRA_PADRAO,
    ],
    "read",
  );
  if (!atual.rows.length) return null;
  const r = atual.rows[0] as unknown as Record<string, unknown>;
  return {
    versao: versaoDaLinha(r),
    origem: origemDaLinha(r),
    padrao: regraDaLinha(regra.rows[0] as unknown as Record<string, unknown> | undefined),
  };
}
