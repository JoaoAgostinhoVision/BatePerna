"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
import { useLeitura } from "./leituras";
import { useVenceu } from "./useVenceu";

/** O selo de uma trilha no cartão da home. Irmão pequeno do Carimbo da ficha:
 *  mesmo vocabulário, sem o motivo escrito — na home cabe a palavra, o porquê
 *  mora na ficha.
 *
 *  Client component, mas SSR-ado: o HTML do servidor já sai com a palavra e a
 *  cor certas. O JS só troca quando chega leitura nova. `inicial` é o valor do
 *  servidor e continua valendo enquanto não houver provedor — por isso o
 *  primeiro render do cliente bate com o do servidor e a hidratação não briga. */
export default function SeloTrilha({
  slug,
  inicial,
}: {
  slug: string;
  inicial: LeituraCarimbo;
}) {
  const leitura = useLeitura(slug) ?? inicial;
  const venceu = useVenceu(leitura.calculadoEm);
  const fase = faseDe({ conferindo: false, erro: leitura.erro, venceu, falhou: false });

  const marca =
    fase === "sem-informacoes" ? "SEM INFORMAÇÕES"
    : leitura.estado === "frio" ? "Não suba"
    : "Pode subir";

  const sub =
    fase === "sem-informacoes" ? "tome cuidado"
    : leitura.estado === "fresco" ? "seco · carro comum"
    : "barro · dá um tempo";

  return (
    <span className="selo" data-fase={fase}>
      <span className="w">{marca}</span>
      <span className="s">{sub}</span>
    </span>
  );
}
