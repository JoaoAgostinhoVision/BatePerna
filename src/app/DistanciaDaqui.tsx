"use client";
import { distanciaKm, formatarDistancia } from "@/lib/geo";
import { coordDe } from "@/lib/local";
import { useGps, useLocal, useMexerLocal } from "./local";

/** A distância fica ATRÁS DE UM TOQUE de propósito: prompt de GPS não
 *  solicitado é o jeito mais rápido de ser negado pra sempre — e negado uma
 *  vez, o navegador não pergunta de novo.
 *
 *  "Uma pessoa, uma fonte": lê a MESMA localização que o mapa e o cartão da
 *  home — não pede a posição ao aparelho por conta própria. O toque só
 *  avisa o contexto (`pedirGps`, de `local.tsx`); é o contexto quem sabe
 *  pedir a posição ao aparelho e quem já sabe se foi negado antes. Duas
 *  verdades sobre a mesma pergunta em duas telas do mesmo app — o mapa
 *  dizendo que você está em Gravatá e a ficha medindo de outro lugar — é
 *  exatamente o que essa invariante proíbe. */
export default function DistanciaDaqui({ lat, lng }: { lat: number; lng: number }) {
  const voce = coordDe(useLocal());
  const gps = useGps();
  const { pedirGps } = useMexerLocal();

  if (voce) {
    return <div className="dist">{formatarDistancia(distanciaKm(voce, { lat, lng }))}</div>;
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
