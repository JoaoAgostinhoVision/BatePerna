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
 *  Opcional por dois caminhos, os dois o relato LEGADO (sem identidade): o que
 *  já estava guardado antes desta tarefa, e o que a página SEM identidade grava
 *  hoje — quando a leitura dela falhou, o `ConfirmarFui` guarda o relato sem
 *  `lugar` (`lugar === null`). Ver "O RELATO LEGADO É ACEITO COMO HOJE", abaixo. */
export type Relato = { slug: string; tipo: "seco" | "barro"; dia: number; lugar?: number };

/** ✅ O RELATO LEGADO (sem `lugar`) É ACEITO COMO HOJE — decisão do João em
 *  06/10, palavras dele: *"aceitar como hoje"*.
 *
 *  O relato SEM `lugar` vem de: a fila de quem guardou antes do deploy (só o
 *  dia do deploy: a fila descarta todo dia que passou), as ABAS abertas antes
 *  do deploy e as páginas e chunks que o service worker guardou (`bp-paginas` e
 *  `bp-ultima-ficha` por até 30 dias), que seguem rodando o código velho e
 *  mandando POST sem `lugar` até recarregar; e a página cuja identidade não
 *  pôde ser lida (banco fora no instante da leitura).
 *
 *  Ele conta pro lugar que mora no ENDEREÇO na hora — o comportamento de antes
 *  da Tarefa 12b, com o risco de antes: se outro lugar retomou o endereço, o
 *  relato conta pra ele. A lista `antigos` da página existe SÓ por este ramo.
 *
 *  ⚠️ O QUE AS ABAS VELHAS NÃO PODEM MAIS FAZER (M1 da revisão da 12b):
 *  consumir um relato NOVO. A fila nova mora em `CHAVE_FILA`, que o código
 *  velho não lê; sem isso, uma aba de antes do deploy subiria `{A, lugar: P}`
 *  como `{A}` — e o relato de P contaria pra quem retomou `A`. */

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
 *  - `"legado"`: sem `lugar` — resolve pelo endereço (aceito como hoje);
 *  - `"recusa"`: `lugar` presente e fora da forma (400). */
export function lugarDoCorpo(corpo: { lugar?: unknown }): { lugar: number } | "legado" | "recusa" {
  if (corpo.lugar === undefined) return "legado";
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
 *  antigos, é o dele. Uma página SEM identidade (a leitura falhou) é toda ela o
 *  ramo legado: só sobe relato legado. */
export function relatosDaPagina(
  fila: readonly Relato[],
  pagina: { slug: string; antigos: readonly string[]; lugar: number | null },
): Relato[] {
  const enderecos = [pagina.slug, ...pagina.antigos];
  return fila.filter((r) =>
    r.lugar === undefined ? enderecos.includes(r.slug) : pagina.lugar !== null && r.lugar === pagina.lugar,
  );
}

/** Onde a fila mora (M1 da revisão da 12b): numa chave que o código de antes
 *  da Tarefa 12b NÃO lê. Uma aba aberta antes do deploy lê e escreve só
 *  `CHAVE_FILA_VELHA`; se lesse esta, subiria o relato novo sem o `lugar` (o
 *  `escoar` velho só manda `slug` e `tipo`) e o apagaria da fila. */
export const CHAVE_FILA = "bp:fila-relato:v2";

/** A chave de antes da Tarefa 12b. O código novo a LÊ (o que estiver lá é o
 *  relato legado, guardado pelo código velho) e tira dela o que subiu ou
 *  venceu; nunca grava relato novo nela. Vazia, ela é APAGADA. */
export const CHAVE_FILA_VELHA = "bp:fila-relato";

/** Tudo que está na fila, ou `[]` quando não há nada legível.
 *
 *  🔴 CORPO INVÁLIDO É FILA VAZIA, nunca um item inventado. `localStorage` é
 *  editável por qualquer um e sobrevive a troca de versão do app: um JSON de
 *  outra época viraria `undefined` nos três campos, e um relato com `slug`
 *  `undefined` subiria pra uma ficha que não existe. Mesma régua do `ehLeitura`
 *  no `Carimbo.tsx` — o corpo é conferido, não assumido. */
function lerChave(chave: string): Relato[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(cru) ? cru.filter(ehRelato) : [];
  } catch {
    return [];
  }
}

/** As duas chaves juntas: a nova e a velha (a do relato legado). O mesmo
 *  relato nas duas (uma aba velha e uma página sem identidade guardaram o mesmo
 *  endereço no mesmo dia) aparece UMA vez, a da chave nova: duas cópias
 *  subiriam duas vezes. */
function ler(): Relato[] {
  const nova = lerChave(CHAVE_FILA);
  return [...nova, ...lerChave(CHAVE_FILA_VELHA).filter((v) => !nova.some((n) => mesmo(n, v)))];
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

function escreverChave(chave: string, fila: Relato[]): void {
  if (typeof localStorage === "undefined") return;
  // Fila vazia APAGA a chave em vez de guardar "[]": sem isto, todo aparelho
  // que uma vez ficou sem sinal carregaria a chave pra sempre.
  if (fila.length === 0) localStorage.removeItem(chave);
  else localStorage.setItem(chave, JSON.stringify(fila));
}

/** Aplica `manter` às duas chaves. A VELHA só é reescrita se perdeu algo —
 *  nunca é criada, nunca recebe relato —, e some quando esvazia. */
function filtrar(manter: (r: Relato) => boolean): void {
  if (typeof localStorage === "undefined") return;
  const nova = lerChave(CHAVE_FILA);
  const novaFica = nova.filter(manter);
  if (novaFica.length !== nova.length) escreverChave(CHAVE_FILA, novaFica);
  const velha = lerChave(CHAVE_FILA_VELHA);
  const velhaFica = velha.filter(manter);
  if (velhaFica.length !== velha.length) escreverChave(CHAVE_FILA_VELHA, velhaFica);
}

/** Guarda um relato para subir depois — SEMPRE na chave nova.
 *
 *  **Um relato por lugar por dia, e o último ganha.** A pessoa que erra o botão
 *  e responde de novo não vira dois relatos — e nenhum contador de `foram` do
 *  app aguenta contar a mesma ida duas vezes sem mentir. O "mesmo" de antes
 *  sai das DUAS chaves. */
export function guardar(relato: Relato): void {
  filtrar((r) => !mesmo(r, relato));
  escreverChave(CHAVE_FILA, [...lerChave(CHAVE_FILA), relato]);
}

/** Os relatos que ainda podem subir — e, de quebra, LIMPA os vencidos do
 *  armazenamento. Ler é o momento honesto de varrer: não há timer nenhum aqui,
 *  e uma fila que só cresce é lixo que a pessoa carrega no aparelho. */
export function pendentes(agoraMs: number): Relato[] {
  const hoje = diaRecife(agoraMs);
  filtrar((r) => r.dia === hoje);
  return ler();
}

/** Tira um relato da fila — chamado quando ele subiu de verdade, nunca antes. */
export function remover(relato: Relato): void {
  filtrar((r) => !mesmo(r, relato));
}
