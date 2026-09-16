import type { Estado } from "@/lib/motor";
import { falaMolhada, type Voz } from "@/lib/severidade";

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

/** O que o carimbo está mostrando agora.
 *
 *  🔴 `fechado` entrou em 2026-08-27 e é a primeira fase que NÃO fala de chuva.
 *  Ela existe porque o carimbo dizia "Pode ir" às 18h num lugar que fecha às
 *  17h. Ver `src/lib/horario.ts`. */
export type Fase = "afirmando" | "conferindo" | "sem-informacoes" | "fechado";

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
  /** O lugar está fora do horário AGORA.
   *
   *  Opcional, e o padrão (`false`) é o certo: ficha sem horário nunca fecha, e
   *  o primeiro render nunca sabe a hora ainda. Quem responde é `fechadoAgora`
   *  em `src/lib/horario.ts`. */
  fechado?: boolean;
  /** O DONO disse que está fechado, e não o calendário.
   *
   *  🔴 OBRIGATÓRIO, e é o ponto do campo. `fechado` (acima) é opcional porque
   *  o primeiro render não sabe a hora ainda. Este não tem essa desculpa: ele
   *  vem do servidor junto com a leitura. Opcional, esquecer um dos CINCO
   *  pontos que montam `Situacao` passaria em silêncio — e o lugar apareceria
   *  ABERTO na tela com o dono tendo dito que está fechado. Obrigatório, o
   *  `tsc` é o guarda, sem grep e sem disciplina. */
  fechadoPeloDono: boolean;
};

/** 🔴 `fechado` GANHA DE TODAS, inclusive de `conferindo`, e isso é a regra e
 *  não um detalhe de ordem: com o lugar fechado, a chuva não decide nada. Ler
 *  a chuva enquanto o portão está trancado é uma resposta certa pra pergunta
 *  errada — e "CONFERINDO…" ali seria o app parecendo ocupado com uma coisa que
 *  não muda o veredito.
 *
 *  ✅ E EM 2026-09-15 O DONO PASSOU A FECHAR TAMBÉM. `fechadoPeloDono` é a
 *  palavra dele ("a rampa está em reforma"), e ela entra POR AQUI e não pelo
 *  estado: o motor só responde `fresco | frio`, então "em reforma" virando
 *  `frio` faria o app dizer "não vá" com as palavras da CHUVA. Ver
 *  `fechadoPeloDono` em `src/lib/aviso.ts`. */
export function faseDe({ conferindo, erro, venceu, falhou, fechado, fechadoPeloDono }: Situacao): Fase {
  if (fechado || fechadoPeloDono) return "fechado";
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

/** A PALAVRA que o app põe na cara da decisão. A mesma no carimbo da ficha e no
 *  selo do cartão — e por isso mora aqui, no módulo puro que os dois já
 *  importam, e não escrita à mão em cada um.
 *
 *  🔴 ELA ESTAVA DUPLICADA nos dois componentes até 2026-08-27. Duas fontes pro
 *  mesmo nome é a família que este projeto já pagou várias vezes (a palavra e a
 *  cor nascendo de commits diferentes; o `aria-label` mascarando o sumiço da
 *  `<legend>`). Trocar o vocabulário tem que ser UMA edição, não duas que
 *  alguém pode fazer pela metade.
 *
 *  🔴 E A PALAVRA NÃO FALA MAIS EM SUBIR. "Pode ir"/"Não vá" supunham
 *  ladeira em todo lugar do acervo: verdade na Rampa do Pepê, falsa na Pedra
 *  Furada, que é **plana** — o passeio lá é chegar, não subir. Mesma família do
 *  `secaRapido` e do `chuvaNoPiso`, e a terceira vez na mesma semana: texto
 *  escrito quando o acervo era pequeno, num componente que serve TODOS.
 *  Decisão dele em 2026-08-27, e o "Não vá" é palavra dele — é a `voz` da
 *  Rampa na ficha: *"é barro: molhou, não vá"*.
 *
 *  ✅ E EM 2026-09-10 AS PALAVRAS DO RAMO MOLHADO SAÍRAM DAQUI, pela terceira
 *  vez na mesma família: o bloco acima dizia que "Não vá" é palavra dele — e é,
 *  mas é a palavra da RAMPA, e este arquivo serve o acervo inteiro. Quem
 *  responde agora é `falaMolhada` em `src/lib/severidade.ts`, lendo o nível que
 *  a própria ficha declara. O ramo SECO continua aqui: "Pode ir" e "seco ·
 *  carro comum" são os mesmos em todo o acervo.
 *
 *  ✅ O `sub` mudou-se pra cá em 2026-08-27, quando a fase `fechado` obrigou a
 *  mexer nele — era a dívida anotada aqui mesmo, e deixá-la de pé teria sido
 *  escrever o ramo novo à mão nos dois arquivos, que é a coisa exata que este
 *  bloco existe pra impedir. */
export function marcaDe(fase: Fase, estado: Estado, voz: Voz): string {
  if (fase === "fechado") return "Fechado agora";
  if (fase === "conferindo") return "CONFERINDO…";
  if (fase === "sem-informacoes") return "SEM INFORMAÇÕES";
  return estado === "frio" ? falaMolhada(voz.severidade, voz.horasPassado).marca : "Pode ir";
}

/** A linha de baixo da marca. Irmã do `marcaDe`, e mora aqui pela mesma razão:
 *  a ficha e o cartão da home dizem a MESMA coisa.
 *
 *  `abertura` só é usada na fase `fechado`, e nela nunca é `null` por
 *  construção — a fase só existe quando há horário. O `?? ""` não é fallback
 *  disfarçado: é o app CALANDO se algum dia a construção mudar, em vez de
 *  inventar um horário que ninguém deu.
 *
 *  ⚠️ "seco · carro comum" continua supondo o veículo. **Ele decidiu deixar
 *  assim em 2026-08-27**, de olhos abertos, sabendo que a 3ª ficha de asfalto o
 *  quebra. Não é esquecimento — e o molde pra resolver já existe
 *  (`chuvaNoPiso`). A dívida gêmea do ramo molhado ("barro · …") mudou-se pra
 *  `severidade.ts` junto com as palavras, e continua anotada lá. */
export function subDe(
  fase: Fase,
  estado: Estado,
  voz: Voz,
  abertura: string | null = null,
): string {
  if (fase === "fechado") return abertura ?? "";
  if (fase === "conferindo") return "lendo a chuva agora";
  if (fase === "sem-informacoes") return "tome cuidado";
  return estado === "fresco"
    ? "seco · carro comum"
    : falaMolhada(voz.severidade, voz.horasPassado).sub;
}

export type Gatilho = "carregou" | "voltou" | "toque";

/** Vale buscar agora?
 *
 *  `carregou` não retenta o erro do servidor de propósito: a página acabou de
 *  tentar, do servidor, milissegundos atrás. E página recém-renderizada nunca
 *  está vencida — `calculadoEm` é agora —, então na prática este gatilho só
 *  dispara pra página vinda do cache do service worker, que é exatamente onde
 *  buscar é o certo.
 *
 *  🔴 `fechadoPeloDono` ENTRA NO `Omit` PELA MESMA RAZÃO QUE `falhou` JÁ
 *  ESTAVA LÁ, e isto NÃO é o campo virando opcional. A regra deste `Omit` é
 *  uma só: campo OBRIGATÓRIO de `Situacao` que esta função não usa e para o
 *  qual os chamadores dela não têm valor nenhum a dar. O `HomeViva` pergunta
 *  "vale buscar a chuva de N trilhas?" — não existe um "o dono fechou" de N
 *  trilhas, e inventar um `false` ali ensinaria o próximo leitor que o campo é
 *  decorativo.
 *
 *  O guarda que o campo existe pra ser continua inteiro: quem monta uma `Fase`
 *  (`faseDe`, `sintomaDe`) não escapa dele, e é a `Fase` que vai pra tela. Esta
 *  função devolve um booleano sobre IR BUSCAR, e nunca uma palavra que alguém
 *  lê. (Repare que `fechado` também é ignorado aqui, e sempre foi: com ou sem
 *  portão trancado, uma leitura vencida continua tendo que ser renovada.) */
export function podeBuscar(
  gatilho: Gatilho,
  {
    erro,
    venceu,
    conferindo,
    desdeUltimaMs,
  }: Omit<Situacao, "falhou" | "fechadoPeloDono"> & { desdeUltimaMs: number },
): boolean {
  if (conferindo) return false;
  if (gatilho === "toque") return true;
  if (desdeUltimaMs < PISO_AUTO_MS) return false;
  return gatilho === "voltou" ? erro || venceu : venceu;
}
