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
 *  falhar (pendurar e recusar) da mesma forma.
 *
 *  🔴 ACHADO DA REVISÃO FINAL (C1, 2026-09-26): `linhas === null` cobria só a
 *  RECUSA/ESTOURO do banco — não cobria um `Map` VAZIO, que é uma leitura
 *  BEM-SUCEDIDA e diferente de "banco fora". Um Turso DE PÉ com a tabela
 *  `ficha_versoes` ainda sem linha nenhuma (schema aplicado sem a semente
 *  rodar depois) devolvia `[]`, nenhum ramo de erro disparava, e `[]` ficava
 *  MEMORIZADO como "última boa" — a home e o acervo passavam a afirmar, em
 *  silêncio, que não existe trilha nenhuma em Pernambuco. Por isso o mapa
 *  vazio entra no MESMO ramo do banco fora: sem cópia em memória, estoura;
 *  com cópia, serve a última boa. "Acervo vazio" hoje só existe por essa
 *  falta de semente — criar/apagar ficha pelo painel é rodada futura —,
 *  então esta trava não custa nada ao caminho normal. */
export async function buscarFichas(
  ler: () => Promise<Map<string, { doc: string }>>,
): Promise<Ficha[]> {
  let linhas: Map<string, { doc: string }> | null;
  try {
    linhas = await comPrazo(ler(), PRAZO_FICHA_MS, null);
  } catch {
    linhas = null;
  }
  if (linhas === null || linhas.size === 0) {
    if (ultimaBoa) return ultimaBoa;
    throw new Error(
      "Não consegui ler as fichas: banco fora, ou sem nenhuma linha, e sem cópia em memória.",
    );
  }
  // 🔴 I5 da revisão final (2026-09-26): a chave do Map é o `ficha_slug` do
  // BANCO — a identidade de verdade da linha —, e o `slug` de DENTRO do
  // documento é só o que o dono digitou lá dentro. Os três escritores de
  // `ficha_versoes` hoje mantêm os dois iguais (é o que `versaoPorId`
  // exige na rota de "voltar"), mas isso valia por DISCIPLINA, não por
  // trava — exatamente o ponto que `loadAll` (`ficha.ts`) já tranca há mais
  // tempo pro leitor de DISCO. Se algum dia divergirem, a home (que agrupa
  // pela chave) e a ficha (que lê o `slug` de dentro) discordariam sobre
  // qual morro é qual — a mesma classe de defeito, agora no leitor que roda
  // em produção.
  const fichas = ordenarPorNome(
    [...linhas.entries()].map(([slug, l]) => {
      const doc = fichaSchema.parse(JSON.parse(l.doc));
      if (doc.slug !== slug) {
        throw new Error(
          `Ficha divergente: o banco guarda esta versão sob "${slug}", mas o ` +
            `documento diz "${doc.slug}" — a home e a ficha divergiriam sobre ` +
            "qual lugar é qual.",
        );
      }
      return doc;
    }),
  );
  ultimaBoa = fichas;
  return fichas;
}
