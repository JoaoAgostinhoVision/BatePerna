"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
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
}: {
  slug: string;
  nome: string;
  left: number;
  top: number;
  inicial: LeituraCarimbo;
}) {
  const leitura = useLeitura(slug) ?? inicial;
  const venceu = useVenceu(leitura.calculadoEm);
  const fase = faseDe({ conferindo: false, erro: leitura.erro, venceu, falhou: false });

  return (
    <a
      className="pin-home"
      href={`#${slug}`}
      data-state={leitura.estado}
      data-fase={fase}
      style={{ left, top }}
      aria-label={`Ver ${nome}`}
    />
  );
}
