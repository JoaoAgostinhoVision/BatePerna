import { comPrazo } from "@/lib/cache-rotas";
import type { AcervoComOrigem } from "@/lib/db";
import { noAr } from "@/lib/regra-padrao";
import { fichaSchema, type Ficha, type FichaNoAr } from "@/types/ficha";

/** A ordem em que o acervo aparece. Veio de `ficha.ts` em 2026-09-24 para não
 *  fechar um ciclo de VALOR entre os dois módulos (`ficha.ts` passou a importar
 *  daqui). Continua pura e com teste próprio, independente do que existe em
 *  `content/fichas`.
 *
 *  Ordem de leitura do banco é estável por acaso, não por contrato — como era
 *  a do `readdir` antes dela. O acervo e a home dependem de uma ordem que a
 *  pessoa reconheça, então ela é declarada, não herdada.
 *
 *  🔴 NOME IGUAL DESEMPATA PELA CIDADE (Tarefa 11b): dois lugares podem ter o
 *  mesmo nome, e o empate deixava a ordem a do banco. Sem cidade vem antes
 *  (`""` é o menor texto) — é só ordem, não afirma nada. */
export function ordenarPorNome<F extends Ficha>(fichas: F[]): F[] {
  return [...fichas].sort(
    (a, b) =>
      a.trajeto.waypoints[0].nome.localeCompare(b.trajeto.waypoints[0].nome, "pt-BR") ||
      (a.cidade ?? "").localeCompare(b.cidade ?? "", "pt-BR"),
  );
}

/** Quanto a página espera o BANCO pela ficha antes de desistir.
 *
 *  Mesmo número e mesma razão do `PRAZO_AVISO_MS` (`carimbo-estado.ts`): uma
 *  consulta indexada de poucas linhas num banco da mesma região. A diferença é
 *  o que acontece depois: sem aviso a ficha aparece sem aviso; sem FICHA não há
 *  o que mostrar. */
export const PRAZO_FICHA_MS = 2_000;

/** As fichas de agora.
 *
 *  🔴 SEM MEMÓRIA NENHUMA, DESDE 2026-10-07. Até ali esta função guardava a
 *  última leitura boa por instância do servidor (`ultimaBoa`, o "só memória"
 *  que o João escolheu em 2026-09-24) e a servia quando o banco falhava. O furo
 *  que aquilo deixava (M4 da revisão final de 06/10): a instância memorizou P
 *  no ar, o dono esconde P, o banco cai antes da próxima leitura boa — e P
 *  escondido voltava ao público enquanto durasse a queda. Diante dele, o João
 *  reverteu a escolha de 24/09, com o custo à vista: *"Não aceitar: nada
 *  escondido aparece nunca, e com o banco fora o app sai do ar"*. Então banco
 *  fora — pendurado, recusando ou sem linha nenhuma — ESTOURA, sempre, e a
 *  página cai no `error.tsx`. Não há o que servir de antes.
 *
 *  🔴 O QUE ESTA FUNÇÃO NUNCA FAZ: cair no `content/fichas/`. Servir a semente
 *  mostraria a voz que o João já reescreveu — o app afirmando coisa falsa, que
 *  é a linha vermelha deste projeto. Foi escolha dele, com o custo à vista:
 *  "erro honesto, nunca conteúdo velho".
 *
 *  A leitura entra por parâmetro pelo molde do `resolverNavegacao` (11/09):
 *  sem isso não há como testar banco pendurado.
 *
 *  🔴 O `try/catch` em volta do `comPrazo` NÃO é redundância com o `null` de
 *  estouro: `comPrazo` é um `Promise.race` entre a leitura e um timer — uma
 *  RECUSA da leitura propaga a recusa (o `race` não a converte em `aoEstourar`;
 *  só o ESTOURO do prazo faz isso). É o `catch` quem põe os dois jeitos de o
 *  banco falhar (pendurar e recusar) no MESMO ramo, com a MESMA mensagem —
 *  sem ele, a recusa sairia como o erro cru do cliente do banco.
 *
 *  🔴 "BANCO SEM SEMENTE" SE DECIDE PELO ACERVO INTEIRO, ESCONDIDOS INCLUSIVE
 *  (C1 da revisão final de 26/09, refeito no C1 da revisão final do painel
 *  completo, 2026-10-06). Um `Map` VAZIO é uma leitura BEM-SUCEDIDA, mas só tem
 *  uma causa: a tabela `ficha_versoes` sem linha nenhuma (schema aplicado sem a
 *  semente rodar depois) — versão nunca é apagada. Esse vazio entra no MESMO
 *  ramo do banco fora e estoura — nunca `[]` como se não existisse trilha em
 *  Pernambuco.
 *
 *  Por isso `ler` tem de trazer os ESCONDIDOS também (`lerAcervoComOrigem`,
 *  que os traz) e dizer, linha a linha, quem está escondido: o
 *  filtro do público acontece AQUI, DEPOIS da pergunta do vazio. Quando a
 *  pergunta era feita sobre o mapa JÁ FILTRADO, o dono escondendo TODOS os
 *  lugares (três toques no celular) caía no ramo do banco fora e derrubava o
 *  app público inteiro. Tudo escondido é `[]` honesto, não erro.
 *
 *  🔴 DESDE 07/10 ELA DEVOLVE `FichaNoAr`: cada lugar sai com a regra efetiva e
 *  a ORIGEM, lidas no MESMO batch das versões (`lerAcervoComOrigem`). É daqui
 *  que toda tela pública tira a marca de "não conferido". */
export async function buscarFichas(ler: () => Promise<AcervoComOrigem>): Promise<FichaNoAr[]> {
  let lido: AcervoComOrigem | null;
  try {
    lido = await comPrazo(ler(), PRAZO_FICHA_MS, null);
  } catch {
    lido = null;
  }
  if (lido === null || lido.linhas.size === 0) {
    throw new Error("Não consegui ler as fichas: banco fora, ou sem nenhuma linha.");
  }
  const { linhas, padrao } = lido;
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
  const visiveis = [...linhas.entries()].filter(([, l]) => !l.oculto);
  return ordenarPorNome(visiveis.map(([slug, l]) => noAr(fichaDaVersao(slug, l.doc), l, padrao)));
}

/** O documento de UMA versão virando `Ficha` — com a trava do I5 (o `slug` de
 *  dentro tem de ser o `ficha_slug` do banco).
 *
 *  🔴 SAIU DE DENTRO DE `buscarFichas` NA TASK 9 (2026-10-01), sem mudar uma
 *  linha da conta, porque o painel precisa dela com os ESCONDIDOS: o acervo do
 *  dono inclui os escondidos, marcados, e `buscarFichas` é a porta do PÚBLICO —
 *  ela os tira. (Em 01/10 a razão era também a memória do público, que guardaria
 *  o escondido (B1 da auditoria da Task 9); a memória saiu em 07/10, ver
 *  `buscarFichas`.) Uma conta, duas portas: a do público filtra, a do dono
 *  marca. */
export function fichaDaVersao(slug: string, docTexto: string): Ficha {
  const doc = fichaSchema.parse(JSON.parse(docTexto));
  if (doc.slug !== slug) {
    throw new Error(
      `Ficha divergente: o banco guarda esta versão sob "${slug}", mas o ` +
        `documento diz "${doc.slug}" — a home e a ficha divergiriam sobre ` +
        "qual lugar é qual.",
    );
  }
  return doc;
}
