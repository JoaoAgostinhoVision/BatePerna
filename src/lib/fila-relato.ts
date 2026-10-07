/** A FILA DO "✓ FUI" — o relato que não se perde quando não tem sinal.
 *
 *  🔴 POR QUE ELA EXISTE (2026-09-10). O `✓ Fui` é a **única porta** pela qual
 *  conhecimento de quem foi entra neste app sem o dono escrever uma ficha — e
 *  ela se fechava exatamente onde a pessoa está quando tem o que contar: **no
 *  lugar, sem sinal**. O `catch` do envio virava uma tela de erro e o relato
 *  morria ali. Quem volta de 120 km de estrada com a informação na cabeça é
 *  justamente quem está fora de cobertura.
 *
 *  Puro de propósito, sem zod e sem `node:fs`, pela mesma razão que `piso.ts` e
 *  `local.ts`: quem lê isto é client component. E **todas as funções recebem o
 *  relógio por parâmetro** — nada aqui chama `Date.now()`. É o que deixa o
 *  teste virar o dia sem mexer em timer global, e é o molde que `horario.ts` já
 *  usa neste projeto.
 *
 *  ⚠️ **O QUE ESTA FILA NÃO FAZ, e é escolha, não esquecimento:** ela não
 *  reenvia relato de um dia que já passou. O placar do app é do **dia de hoje**
 *  (`inicioDoDiaRecife` em `src/lib/db.ts`); um relato de ontem subindo hoje
 *  seria contado como se a pessoa tivesse ido hoje — o app afirmando sobre um
 *  dia em que ninguém foi. Guardar o dia de ORIGEM e mandá-lo junto resolveria,
 *  mas mexe na rota e na tabela, que já tem linhas gravadas em produção: é
 *  decisão de produto, não de implementação, e está anotada no `docs/RESUME.md`. */

/** O dia civil de Recife (UTC−3), como número inteiro de dias desde a época.
 *
 *  🔴 MORA AQUI E SÓ AQUI desde 2026-09-10. Esta conta estava escrita à mão
 *  dentro do `ConfirmarFui.tsx`, e agora dois lugares precisam dela (a chave do
 *  "já contou hoje" e o descarte da fila). Duas cópias da mesma conta é a
 *  família que este projeto já pagou várias vezes — a palavra e a cor nascendo
 *  de commits diferentes. Uma pergunta, uma resposta.
 *
 *  Recebe o relógio: quem chama decide que instante é esse. */
export function diaRecife(agoraMs: number): number {
  const OFFSET = -3 * 3600;
  return Math.floor((agoraMs / 1000 + OFFSET) / 86400);
}

/** Um relato esperando para subir. O `dia` é o de ORIGEM — o dia em que a
 *  pessoa esteve lá —, e é ele que o descarte compara.
 *
 *  🔴 `lugar` É A IDENTIDADE DO LUGAR QUE A PESSOA VIU (Tarefa 12b, 12-N6): o
 *  menor `id` de `ficha_versoes` do lugar (`identidadeDoLugar` em `db.ts`). O
 *  `slug` é só o ENDEREÇO em que ela contou, e endereço não é identidade: o
 *  lugar P sai de `A` e o lugar Q passa a morar em `A` no mesmo dia, e um
 *  relato que só diz `A` contaria pra Q o que quem foi a P viu. O servidor
 *  grava PELA IDENTIDADE, onde o lugar mora na hora de gravar.
 *
 *  Opcional SÓ pra ler o que já estava guardado antes desta tarefa (o relato
 *  LEGADO, sem identidade) — ver `RELATO_LEGADO`. */
export type Relato = { slug: string; tipo: "seco" | "barro"; dia: number; lugar?: number };

/** 🔴 PENDENTE-JOÃO: relato legado sem lugar — aceitar × descartar.
 *
 *  O relato SEM `lugar` vem de três lugares: a fila de quem guardou antes do
 *  deploy (só o dia do deploy: a fila descarta todo dia que passou), as ABAS
 *  abertas antes do deploy e as páginas e chunks que o service worker guardou
 *  (`bp-paginas` e `bp-ultima-ficha` por até 30 dias), que seguem rodando o
 *  código velho e mandando POST sem `lugar` até recarregar. E a página cuja
 *  identidade não pôde ser lida (banco fora no instante da leitura).
 *
 *  - `"aceitar"`: conta pro lugar que mora no ENDEREÇO na hora — o comportamento
 *    de antes desta tarefa, com o risco de antes (se outro lugar retomou o
 *    endereço, o relato conta pra ele). A lista `antigos` da página existe SÓ
 *    por este ramo.
 *  - `"descartar"`: o cliente não sobe relato legado (ele vence na virada do
 *    dia) e o servidor responde 400 ao POST sem `lugar` — NUNCA 2xx: o código
 *    velho faz `setPlacar` de qualquer 2xx. O código velho guarda e mostra
 *    "tenta de novo"; o novo tira da fila.
 *
 *  Implementado "aceitar" porque é o de hoje e não muda nada pra ninguém. É UMA
 *  constante, lida pelo cliente (`relatosDaPagina`) e pelo servidor
 *  (`lugarDoCorpo`), as duas com o comportamento como PARÂMETRO e o padrão
 *  vindo daqui: trocar é mudar esta linha. */
export type DestinoDoLegado = "aceitar" | "descartar";
// PENDENTE-JOÃO: relato legado sem lugar — aceitar × descartar
export const RELATO_LEGADO: DestinoDoLegado = "aceitar";

/** A identidade de um lugar na forma: inteiro positivo, e NADA mais.
 *
 *  🔴 `"17"` NÃO É `17` (M1 da auditoria da 12b, medido no SQLite): o `MIN(id)`
 *  de um agregado não tem afinidade, e `(SELECT MIN(id) …) = '17'` dá falso em
 *  silêncio. Quem lê a identidade de fora (localStorage, corpo do POST, `?lugar=`
 *  do GET) passa por aqui antes de qualquer conta. */
export function ehLugar(x: unknown): x is number {
  return typeof x === "number" && Number.isSafeInteger(x) && x > 0;
}

/** O que o servidor faz com o corpo de um POST, quanto à identidade:
 *  - `{ lugar }`: grava pela identidade;
 *  - `"legado"`: sem `lugar` E `legado === "aceitar"` — resolve pelo endereço;
 *  - `"recusa"`: `lugar` presente e fora da forma, ou ausente com
 *    `legado === "descartar"` (400).
 *  Puro, e com o destino do legado por parâmetro, pra os dois lados do
 *  PENDENTE-JOÃO serem provados sem `vi.mock`. */
export function lugarDoCorpo(
  corpo: { lugar?: unknown },
  legado: DestinoDoLegado = RELATO_LEGADO,
): { lugar: number } | "legado" | "recusa" {
  if (corpo.lugar === undefined) return legado === "aceitar" ? "legado" : "recusa";
  return ehLugar(corpo.lugar) ? { lugar: corpo.lugar } : "recusa";
}

/** Os relatos da fila que ESTA página sobe.
 *
 *  🔴 COM IDENTIDADE (`pagina.lugar` não nulo): só os relatos daquele lugar,
 *  qualquer que seja o endereço em que foram contados. O relato de P NUNCA sobe
 *  pela página de Q, mesmo que Q more hoje no endereço onde P foi contado — ele
 *  FICA na fila, esperando a página de P (C2 da auditoria da 12b).
 *
 *  O relato LEGADO (sem `lugar`) sobe pela página cujo endereço, ou um dos
 *  antigos, é o dele — só com `legado === "aceitar"`. Uma página SEM identidade
 *  (a leitura falhou) é toda ela o ramo legado: só sobe relato legado. */
export function relatosDaPagina(
  fila: readonly Relato[],
  pagina: { slug: string; antigos: readonly string[]; lugar: number | null },
  legado: DestinoDoLegado = RELATO_LEGADO,
): Relato[] {
  const enderecos = [pagina.slug, ...pagina.antigos];
  return fila.filter((r) =>
    r.lugar === undefined
      ? legado === "aceitar" && enderecos.includes(r.slug)
      : pagina.lugar !== null && r.lugar === pagina.lugar,
  );
}

export const CHAVE_FILA = "bp:fila-relato";

/** Tudo que está na fila, ou `[]` quando não há nada legível.
 *
 *  🔴 CORPO INVÁLIDO É FILA VAZIA, nunca um item inventado. `localStorage` é
 *  editável por qualquer um e sobrevive a troca de versão do app: um JSON de
 *  outra época viraria `undefined` nos três campos, e um relato com `slug`
 *  `undefined` subiria pra uma ficha que não existe. Mesma régua do `ehLeitura`
 *  no `Carimbo.tsx` — o corpo é conferido, não assumido. */
function ler(): Relato[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]");
    return Array.isArray(cru) ? cru.filter(ehRelato) : [];
  } catch {
    return [];
  }
}

function ehRelato(x: unknown): x is Relato {
  if (typeof x !== "object" || x === null) return false;
  const { slug, tipo, dia, lugar } = x as Record<string, unknown>;
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    (tipo === "seco" || tipo === "barro") &&
    typeof dia === "number" &&
    Number.isFinite(dia) &&
    // Ausente (o relato legado) ou a identidade na forma. `null`, texto,
    // fração, zero e negativo não são lugar — e um relato com `lugar` torto
    // não pode virar legado e subir pelo endereço.
    (lugar === undefined || ehLugar(lugar))
  );
}

/** A chave de "o mesmo relato" (I3 da auditoria da 12b): o LUGAR e o dia; o
 *  endereço só pro relato legado, que não tem lugar. Dois lugares que contaram
 *  no mesmo endereço no mesmo dia são dois relatos; o mesmo lugar contado em
 *  dois endereços no mesmo dia é um. */
function mesmo(a: Relato, b: Relato): boolean {
  const chave = (r: Relato) => (r.lugar !== undefined ? `L${r.lugar}` : `s:${r.slug}`);
  return chave(a) === chave(b) && a.dia === b.dia;
}

function escrever(fila: Relato[]): void {
  if (typeof localStorage === "undefined") return;
  // Fila vazia APAGA a chave em vez de guardar "[]": sem isto, todo aparelho
  // que uma vez ficou sem sinal carregaria a chave pra sempre.
  if (fila.length === 0) localStorage.removeItem(CHAVE_FILA);
  else localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

/** Guarda um relato para subir depois.
 *
 *  **Um relato por lugar por dia, e o último ganha.** A pessoa que erra o botão
 *  e responde de novo não vira dois relatos — e nenhum contador de `foram` do
 *  app aguenta contar a mesma ida duas vezes sem mentir. */
export function guardar(relato: Relato): void {
  const resto = ler().filter((r) => !mesmo(r, relato));
  escrever([...resto, relato]);
}

/** Os relatos que ainda podem subir — e, de quebra, LIMPA os vencidos do
 *  armazenamento. Ler é o momento honesto de varrer: não há timer nenhum aqui,
 *  e uma fila que só cresce é lixo que a pessoa carrega no aparelho. */
export function pendentes(agoraMs: number): Relato[] {
  const hoje = diaRecife(agoraMs);
  const vivos = ler().filter((r) => r.dia === hoje);
  const todos = ler();
  if (vivos.length !== todos.length) escrever(vivos);
  return vivos;
}

/** Tira um relato da fila — chamado quando ele subiu de verdade, nunca antes. */
export function remover(relato: Relato): void {
  escrever(ler().filter((r) => !mesmo(r, relato)));
}
