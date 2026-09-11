"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
import { fechadoAgora, type Horario } from "@/lib/horario";
import { tomDe, type Severidade } from "@/lib/severidade";
import { useLeitura } from "./leituras";
import { useVenceu } from "./useVenceu";

/** O pin de uma trilha no mapa da home.
 *
 *  É ÂNCORA, não botão: `href="#<slug>"` rola até o cartão daquela trilha. Assim
 *  tocar o pin funciona com o JavaScript desligado, que é a regra da casa —
 *  este app não tem next/link nem navegação soft em lugar nenhum.
 *
 *  A COR não tem estado próprio aqui: sai do mesmo contexto que pinta o selo do
 *  cartão. Guardar a leitura localmente seria a segunda fonte de cor, e foi
 *  exatamente isso que uma vez pôs "Não vá" dentro de um selo verde. O único
 *  estado local é o relógio da validade (useVenceu), que não decide cor de
 *  veredito — decide se ainda há veredito. */
export default function PinTrilha({
  slug,
  nome,
  left,
  top,
  inicial,
  horario,
  severidade,
  agora = null,
}: {
  slug: string;
  nome: string;
  left: number;
  top: number;
  inicial: LeituraCarimbo;
  /** A faixa de horário desta trilha. Sem ela, o pin nunca fecha. */
  horario?: Horario;
  /** O nível desta trilha: o pin é pintado pelo TOM, igual ao cartão e ao selo.
   *  Sem ele o mapa seria a quarta boca a discordar das outras três. */
  severidade: Severidade;
  /** A hora de Recife em minutos, ou `null` no primeiro render. Chega por prop
   *  pela mesma razão que a leitura chega: são N pins, e a fonte tem que ser
   *  UMA — quem lê o relógio é o `MapaHome`, uma vez só. */
  agora?: number | null;
}) {
  const leitura = useLeitura(slug) ?? inicial;
  const venceu = useVenceu(leitura.calculadoEm);
  const fase = faseDe({
    conferindo: false,
    erro: leitura.erro,
    venceu,
    falhou: false,
    fechado: fechadoAgora(horario, agora),
  });

  return (
    <a
      className="pin-home"
      href={`#${slug}`}
      data-state={tomDe(leitura.estado, severidade)}
      data-fase={fase}
      style={{ left, top }}
      aria-label={`Ver ${nome}`}
    />
  );
}
