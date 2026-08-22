"use client";
import { coordDaDistancia, distanciaKm, formatarDistancia } from "@/lib/geo";
import { coordDe } from "@/lib/local";
import type { Ficha } from "@/types/ficha";
import { useGps, useLocal, useMexerLocal } from "./local";

/** O pedido de GPS agora é automático (decisão do João, `local.tsx`): o
 *  `<LocalVivo>` já busca a posição sozinho ao montar. O botão aqui só
 *  aparece enquanto ainda não há posição E o GPS não foi negado — é o
 *  caminho de quem está esperando a resposta (ou sem sinal). Quando
 *  `gps === "negado"` não existe botão: este componente mostra a mensagem
 *  "sem localização" no lugar dele (ver abaixo), porque o navegador não
 *  pergunta duas vezes e um botão ali seria um toque que não faz nada.
 *
 *  "Uma pessoa, uma fonte": lê a MESMA localização que o mapa e o cartão da
 *  home — não pede a posição ao aparelho por conta própria. O toque só
 *  avisa o contexto (`pedirGps`, de `local.tsx`); é o contexto quem sabe
 *  pedir a posição ao aparelho e quem já sabe se foi negado antes. Duas
 *  verdades sobre a mesma pergunta em duas telas do mesmo app — o mapa
 *  dizendo que você está em Gravatá e a ficha medindo de outro lugar — é
 *  exatamente o que essa invariante proíbe.
 *
 *  Recebe a FICHA, não um par lat/lng: quem escolhe QUAL das duas coordenadas
 *  da ficha vale pra distância é `coordDaDistancia` (src/lib/geo.ts), uma vez
 *  só pro app inteiro. Com lat/lng na prop, a página podia (e podia de novo)
 *  passar `condicao.coords` e voltar a ter dois km pra mesma trilha. */
export default function DistanciaDaqui({ ficha }: { ficha: Ficha }) {
  const voce = coordDe(useLocal());
  const gps = useGps();
  const { pedirGps } = useMexerLocal();

  if (voce) {
    const km = distanciaKm(voce, coordDaDistancia(ficha));
    return <div className="dist">{formatarDistancia(km)}</div>;
  }

  // Negado uma vez, o navegador não pergunta de novo: continuar oferecendo o
  // botão seria um toque que não faz nada.
  if (gps === "negado") {
    return <div className="dist sem">sem localização — use o “Abrir no mapa”</div>;
  }

  return (
    <button className="dist-btn" onClick={pedirGps}>
      A que distância estou?
    </button>
  );
}
