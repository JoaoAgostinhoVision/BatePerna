"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe, marcaDe } from "@/lib/carimbo-fase";
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
 *  não briga. */
export default function SeloTrilha({ leitura }: { leitura: LeituraCarimbo }) {
  const venceu = useVenceu(leitura.calculadoEm);
  const fase = faseDe({ conferindo: false, erro: leitura.erro, venceu, falhou: false });

  // A MESMA palavra do carimbo da ficha, da mesma fonte — o selo é o irmão
  // pequeno, não um segundo vocabulário. Ver `marcaDe` em `carimbo-fase.ts`.
  const marca = marcaDe(fase, leitura.estado);

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
