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
 *  pessoa esteve lá —, e é ele que o descarte compara. */
export type Relato = { slug: string; tipo: "seco" | "barro"; dia: number };

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
  const { slug, tipo, dia } = x as Record<string, unknown>;
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    (tipo === "seco" || tipo === "barro") &&
    typeof dia === "number" &&
    Number.isFinite(dia)
  );
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
 *  **Um relato por trilha por dia, e o último ganha.** A pessoa que erra o botão
 *  e responde de novo não vira dois relatos — e nenhum contador de `foram` do
 *  app aguenta contar a mesma ida duas vezes sem mentir. */
export function guardar(relato: Relato): void {
  const resto = ler().filter((r) => !(r.slug === relato.slug && r.dia === relato.dia));
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
  escrever(ler().filter((r) => !(r.slug === relato.slug && r.dia === relato.dia)));
}
