import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { vozDaFicha } from "@/lib/severidade";
import { faseDe, marcaDe } from "@/lib/carimbo-fase";
import { fechadoPeloDono } from "@/lib/aviso";
import { aberturaDaFicha, agoraRecife, fechadoAgora } from "@/lib/horario";

/** O que está NA TELA agora, pro dono — byte a byte a mesma palavra que o
 *  selo público (`SeloTrilha`) diria NO INSTANTE em que a página foi lida,
 *  calendário incluso: mesma fonte (`faseDe`/`marcaDe` em `carimbo-fase.ts`),
 *  nunca uma tabela paralela escrita aqui.
 *
 *  🔴 EXTRAÍDA DE `PainelAdmin.tsx` NA TASK 5 (2026-09-25), quando `/admin`
 *  virou lista e nasceu `/admin/<slug>`: a lista precisa da MESMA marca que o
 *  painel do lugar mostra, e uma segunda montagem à mão seria a família de
 *  defeito que este projeto já pagou (a palavra e a cor nascendo de commits
 *  diferentes; a fala do Nível A/B duplicada; `vozDaFicha` e `aberturaDaFicha`
 *  existem pela mesma razão). Antes da Task 5 isto era a função local
 *  `motorAgora`, que hoje só embrulha esta com o prefixo "Na tela agora: ".
 *
 *  🔴 O CALENDÁRIO ENTRA, e uma rodada anterior deste projeto errou dizendo que
 *  "o servidor não tem relógio de tela" — falso: `agora` chega por prop (a
 *  página o computa com `Date.now()` no load), e `horario.ts` expõe
 *  `agoraRecife`/`aberturaDaFicha`/`fechadoAgora` puros, sem precisar do
 *  `useAgoraRecife` do CLIENTE (esse sim é o "relógio de tela": o hook que
 *  bate a cada minuto na tela viva). O painel (e a lista) são um retrato de um
 *  instante — recarregam a página depois de cada ação —, então o instante do
 *  retrato É o relógio certo: sem ele, a Rampa do Pepê apareceria "Pode ir"
 *  numa quarta na lista do dono enquanto a tela pública diz "Fechado agora".
 *
 *  `erro` não precisa de ramo próprio: `faseDe` já o transforma em
 *  `sem-informacoes`, e é `marcaDe` quem decide a palavra ("SEM
 *  INFORMAÇÕES") — vocabulário único, nunca dois. */
export function marcaAgora(ficha: Ficha, leitura: LeituraCarimbo, agora: number): string {
  const fase = faseDe({
    conferindo: false,
    erro: leitura.erro,
    venceu: false,
    falhou: false,
    fechado: fechadoAgora(aberturaDaFicha(ficha), agoraRecife(agora)),
    // O instante do retrato também decide o prazo do aviso — o mesmo `agora`.
    fechadoPeloDono: fechadoPeloDono(leitura.aviso, agora),
  });
  return marcaDe(fase, leitura.estado, vozDaFicha(ficha.condicao));
}
