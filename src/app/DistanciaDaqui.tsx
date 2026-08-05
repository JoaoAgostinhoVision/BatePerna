"use client";
import { useState } from "react";
import { distanciaKm, formatarDistancia } from "@/lib/geo";

type Fase = "idle" | "medindo" | "ok" | "negado";

/** A distância fica ATRÁS DE UM TOQUE de propósito: prompt de GPS não
 *  solicitado é o jeito mais rápido de ser negado pra sempre — e negado uma
 *  vez, o navegador não pergunta de novo. */
export default function DistanciaDaqui({ lat, lng }: { lat: number; lng: number }) {
  const [fase, setFase] = useState<Fase>("idle");
  const [texto, setTexto] = useState("");

  function medir() {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      setFase("negado");
      return;
    }
    setFase("medindo");
    geo.getCurrentPosition(
      (pos) => {
        const daqui = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setTexto(formatarDistancia(distanciaKm(daqui, { lat, lng })));
        setFase("ok");
      },
      // Negado, estourou o tempo, indisponível: pro cliente dá tudo no mesmo.
      () => setFase("negado"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  if (fase === "ok") return <div className="dist">{texto}</div>;
  if (fase === "negado") {
    return <div className="dist sem">sem localização — use o “Abrir no mapa”</div>;
  }
  return (
    <button className="dist-btn" onClick={medir} disabled={fase === "medindo"}>
      {fase === "medindo" ? "vendo…" : "A que distância estou?"}
    </button>
  );
}
