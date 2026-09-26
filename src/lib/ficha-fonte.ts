import { comPrazo } from "@/lib/cache-rotas";
import { fichaSchema, type Ficha } from "@/types/ficha";

/** A ordem em que o acervo aparece. Veio de `ficha.ts` em 2026-09-24 para não
 *  fechar um ciclo de VALOR entre os dois módulos (`ficha.ts` passou a importar
 *  daqui). Continua pura e com teste próprio, independente do que existe em
 *  `content/fichas`.
 *
 *  Ordem de leitura do banco é estável por acaso, não por contrato — como era
 *  a do `readdir` antes dela. O acervo e a home dependem de uma ordem que a
 *  pessoa reconheça, então ela é declarada, não herdada. */
export function ordenarPorNome(fichas: Ficha[]): Ficha[] {
  return [...fichas].sort((a, b) =>
    a.trajeto.waypoints[0].nome.localeCompare(b.trajeto.waypoints[0].nome, "pt-BR"),
  );
}

/** Quanto a página espera o BANCO pela ficha antes de desistir.
 *
 *  Mesmo número e mesma razão do `PRAZO_AVISO_MS` (`carimbo-estado.ts`): uma
 *  consulta indexada de poucas linhas num banco da mesma região. A diferença é
 *  o que acontece depois: sem aviso a ficha aparece sem aviso; sem FICHA não há
 *  o que mostrar. */
export const PRAZO_FICHA_MS = 2_000;

/** A última leitura boa. Vive por instância do servidor, não é compartilhada,
 *  e some quando a instância morre — é exatamente o que o João escolheu em
 *  2026-09-24 ("só memória"), sabendo que instância fria + banco fora = erro. */
let ultimaBoa: Ficha[] | null = null;

/** Só pra teste isolar uma leitura da outra. */
export function esquecerMemoria(): void {
  ultimaBoa = null;
}

/** As fichas de agora.
 *
 *  🔴 O QUE ESTA FUNÇÃO NUNCA FAZ: cair no `content/fichas/`. Se o banco não
 *  respondeu e não há cópia em memória, ela ESTOURA, e a página cai no
 *  `error.tsx`. Servir a semente mostraria a voz que o João já reescreveu —
 *  o app afirmando coisa falsa, que é a linha vermelha deste projeto. Foi
 *  escolha dele, com o custo à vista: "erro honesto, nunca conteúdo velho".
 *
 *  A leitura entra por parâmetro pelo molde do `resolverNavegacao` (11/09):
 *  sem isso não há como testar banco pendurado.
 *
 *  🔴 O `try/catch` em volta do `comPrazo` NÃO é redundância com o `null` de
 *  estouro: `comPrazo` é um `Promise.race` entre a leitura e um timer — uma
 *  RECUSA da leitura propaga a recusa (o `race` não a converte em `aoEstourar`;
 *  só o ESTOURO do prazo faz isso). Sem o `catch`, banco que recusa (em vez de
 *  pendurar) faria esta função rejeitar direto, pulando a memória — a última
 *  boa nunca seria servida. É o `catch` quem trata os dois jeitos de o banco
 *  falhar (pendurar e recusar) da mesma forma. */
export async function buscarFichas(
  ler: () => Promise<Map<string, { doc: string }>>,
): Promise<Ficha[]> {
  let linhas: Map<string, { doc: string }> | null;
  try {
    linhas = await comPrazo(ler(), PRAZO_FICHA_MS, null);
  } catch {
    linhas = null;
  }
  if (linhas === null) {
    if (ultimaBoa) return ultimaBoa;
    throw new Error("Não consegui ler as fichas: banco fora e sem cópia em memória.");
  }
  const fichas = ordenarPorNome([...linhas.values()].map((l) => fichaSchema.parse(JSON.parse(l.doc))));
  ultimaBoa = fichas;
  return fichas;
}
