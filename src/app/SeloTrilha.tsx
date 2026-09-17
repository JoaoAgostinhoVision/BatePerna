"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { fechadoPeloDono } from "@/lib/aviso";
import { faseDe, marcaDe, subDe } from "@/lib/carimbo-fase";
import { fechadoAgora, rotuloAbertura, type Abertura, type Agora } from "@/lib/horario";
import type { Voz } from "@/lib/severidade";
import { useVenceu } from "./useVenceu";

/** O selo de uma trilha no cartão da home. Irmão pequeno do Carimbo da ficha:
 *  mesmo vocabulário, sem o motivo escrito — na home cabe a palavra, o porquê
 *  mora na ficha.
 *
 *  Não lê o contexto de leituras: quem lê é o `CartaoTrilha`, uma vez só, e
 *  entrega o resultado pronto aqui por prop. Duas leituras do mesmo contexto
 *  em dois componentes seria a mesma armadilha de sempre — a palavra (aqui) e
 *  a cor (no `data-state` do cartão) podendo nascer de commits diferentes.
 *  `leitura` já é a fonte única; este componente só decide o texto.
 *
 *  SSR-ado mesmo sendo client component: o HTML do servidor já sai com a
 *  palavra certa porque `useVenceu` devolve `false` no primeiro render — por
 *  isso o primeiro render do cliente bate com o do servidor e a hidratação
 *  não briga. **`agora` chega por prop e é `null` no primeiro render pela mesma
 *  razão**; quem o produz é o `useAgoraRecife`, chamado UMA vez lá em cima, e
 *  não aqui — um hook por cartão faria o número de hooks variar com o tamanho
 *  da lista. */
export default function SeloTrilha({
  leitura,
  abertura,
  voz,
  agora = null,
}: {
  leitura: LeituraCarimbo;
  /** A voz da trilha deste cartão. Mesma fonte do carimbo da ficha — o selo é
   *  o irmão pequeno, não um segundo vocabulário. */
  voz: Voz;
  /** Quando esta trilha abre — hora, dias, ou os dois. Sem ela, o selo nunca
   *  fecha. Montada por `aberturaDaFicha`, nunca à mão. */
  abertura?: Abertura;
  /** O relógio de Recife, ou `null` antes de ele falar. */
  agora?: Agora | null;
}) {
  const venceu = useVenceu(leitura.calculadoEm);
  const fechado = fechadoAgora(abertura, agora);
  // O relógio do dono é o MESMO `agora` do calendário (`epochS` viaja dentro
  // dele): sem ele, no primeiro render, o aviso vale como chegou.
  const doDono = fechadoPeloDono(leitura.aviso, agora?.epochS ?? null);
  const fase = faseDe({
    conferindo: false,
    erro: leitura.erro,
    venceu,
    falhou: false,
    fechado,
    fechadoPeloDono: doDono,
  });

  // A MESMA palavra e a MESMA linha de baixo do carimbo da ficha, da mesma
  // fonte — o selo é o irmão pequeno, não um segundo vocabulário.
  //
  // 🔴 `fechado && !doDono`, E NÃO SÓ `fechado` (2026-09-16). Na home não há
  // `AvisoDoDono`: o cartão é a afirmação inteira. A Rampa numa quarta, com
  // "a rampa está em reforma" valendo, saía "FECHADO AGORA / abre sábado" —
  // e "abre sábado" é FALSO enquanto o aviso vale. O dono ganha do calendário
  // como ganha do motor; a linha de baixo se cala, e é o `Carimbo` da ficha
  // que faz a mesma conta (a frase do calendário só quando foi ELE que fechou).
  const marca = marcaDe(fase, leitura.estado, voz);
  const sub = subDe(
    fase,
    leitura.estado,
    voz,
    fechado && !doDono ? rotuloAbertura(abertura!, agora!) : null,
  );

  return (
    <span className="selo" data-fase={fase}>
      <span className="w">{marca}</span>
      <span className="s">{sub}</span>
    </span>
  );
}
