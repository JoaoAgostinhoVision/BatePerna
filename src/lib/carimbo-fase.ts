/** Quanto tempo o "Conferindo…" pode ficar na tela.
 *
 *  Três segundos, e não os seis do service worker, porque os contextos são
 *  opostos: lá é o que se espera antes de servir uma cópia guardada, com a tela
 *  em branco; aqui a tela já tem conteúdo, e o que está em jogo é por quanto
 *  tempo o app fica sem afirmar nada — bem na hora da decisão.
 *
 *  Estourar não cancela a busca: a resposta que chega depois ainda repinta. */
export const PRAZO_CONFERINDO_MS = 3_000;

/** Piso entre duas buscas automáticas. Sem ele, alternar de app dez vezes vira
 *  dez chamadas. O toque não obedece a este piso — quem tocou está pedindo. */
export const PISO_AUTO_MS = 30_000;

/** O que o carimbo está mostrando agora. */
export type Fase = "afirmando" | "conferindo" | "sem-informacoes";

/** Por que não há leitura. Vira o texto do motivo; `null` quando há leitura. */
export type Sintoma = "falhou" | "erro" | "venceu" | null;

export type Situacao = {
  /** Há uma busca em andamento e ainda dentro do prazo de tela. */
  conferindo: boolean;
  /** O servidor não conseguiu ler a chuva quando montou esta leitura. */
  erro: boolean;
  /** A leitura na tela passou dos 30 minutos. */
  venceu: boolean;
  /** A última busca estourou o prazo de tela ou falhou de vez. */
  falhou: boolean;
};

export function faseDe({ conferindo, erro, venceu, falhou }: Situacao): Fase {
  if (conferindo) return "conferindo";
  return erro || venceu || falhou ? "sem-informacoes" : "afirmando";
}

/** Qual dos motivos contar. A ordem é cronológica ao contrário: a notícia mais
 *  recente é a que explica a tela. E `erro` ganha de `venceu` porque, sem
 *  leitura nenhuma, não existe hora de leitura pra citar. */
export function sintomaDe({ erro, venceu, falhou }: Situacao): Sintoma {
  if (falhou) return "falhou";
  if (erro) return "erro";
  if (venceu) return "venceu";
  return null;
}

export type Gatilho = "carregou" | "voltou" | "toque";

/** Vale buscar agora?
 *
 *  `carregou` não retenta o erro do servidor de propósito: a página acabou de
 *  tentar, do servidor, milissegundos atrás. E página recém-renderizada nunca
 *  está vencida — `calculadoEm` é agora —, então na prática este gatilho só
 *  dispara pra página vinda do cache do service worker, que é exatamente onde
 *  buscar é o certo. */
export function podeBuscar(
  gatilho: Gatilho,
  { erro, venceu, conferindo, desdeUltimaMs }: Omit<Situacao, "falhou"> & { desdeUltimaMs: number },
): boolean {
  if (conferindo) return false;
  if (gatilho === "toque") return true;
  if (desdeUltimaMs < PISO_AUTO_MS) return false;
  return gatilho === "voltou" ? erro || venceu : venceu;
}
