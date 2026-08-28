"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe, marcaDe, subDe } from "@/lib/carimbo-fase";
import { fechadoAgora, rotuloAbertura, type Horario } from "@/lib/horario";
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
  horario,
  agora = null,
}: {
  leitura: LeituraCarimbo;
  /** A faixa de horário desta trilha. Sem ela, o selo nunca fecha. */
  horario?: Horario;
  /** Minutos desde a meia-noite em Recife, ou `null` antes de o relógio falar. */
  agora?: number | null;
}) {
  const venceu = useVenceu(leitura.calculadoEm);
  const fechado = fechadoAgora(horario, agora);
  const fase = faseDe({ conferindo: false, erro: leitura.erro, venceu, falhou: false, fechado });

  // A MESMA palavra e a MESMA linha de baixo do carimbo da ficha, da mesma
  // fonte — o selo é o irmão pequeno, não um segundo vocabulário.
  const marca = marcaDe(fase, leitura.estado);
  const sub = subDe(fase, leitura.estado, fechado && horario ? rotuloAbertura(horario, agora!) : null);

  return (
    <span className="selo" data-fase={fase}>
      <span className="w">{marca}</span>
      <span className="s">{sub}</span>
    </span>
  );
}
