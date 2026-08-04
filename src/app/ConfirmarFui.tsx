"use client";
import { useEffect, useState } from "react";

type Placar = { foram: number; barro: number };
type Fase = "idle" | "perguntando" | "enviando" | "contado" | "erro";

function diaRecife(): number {
  const OFFSET = -3 * 3600;
  return Math.floor((Date.now() / 1000 + OFFSET) / 86400);
}

export default function ConfirmarFui({ slug }: { slug: string }) {
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const jaContouKey = `bp:contou:${slug}:${diaRecife()}`;

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(jaContouKey)) {
      setFase("contado");
    }
    fetch(`/api/confirmar?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPlacar(p))
      .catch(() => {});
  }, [slug, jaContouKey]);

  async function enviar(tipo: "seco" | "barro") {
    setFase("enviando");
    try {
      const r = await fetch("/api/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tipo }),
      });
      if (!r.ok) throw new Error();
      setPlacar(await r.json());
      localStorage.setItem(jaContouKey, "1");
      setFase("contado");
    } catch {
      setFase("erro");
    }
  }

  return (
    <div className="confirmar">
      {fase === "idle" && (
        <button className="btn" onClick={() => setFase("perguntando")}>✓ Fui</button>
      )}
      {fase === "perguntando" && (
        <div className="perg">
          <div className="q">E no portão, como estava?</div>
          <div className="opts">
            <button className="opt seco" onClick={() => enviar("seco")}>Deu pra subir</button>
            <button className="opt barro" onClick={() => enviar("barro")}>Tava barro</button>
          </div>
        </div>
      )}
      {fase === "enviando" && <div className="soon">enviando…</div>}
      {fase === "contado" && <div className="obrigado">Valeu — anotado 🙏</div>}
      {fase === "erro" && (
        <div className="erro">
          não deu pra registrar agora, tenta de novo
          <button className="btn" onClick={() => setFase("perguntando")}>tentar de novo</button>
        </div>
      )}
      <PlacarLinha placar={placar} fase={fase} />
    </div>
  );
}

function PlacarLinha({ placar, fase }: { placar: { foram: number; barro: number } | null; fase: Fase }) {
  if (!placar || placar.foram === 0) {
    if (!placar && fase === "contado") return null;
    return <div className="placar vazio">Ninguém contou ainda hoje — seja o primeiro a dizer como tá.</div>;
  }
  const barroTxt = placar.barro > 0 ? ` · ${placar.barro} achou barro` : "";
  return <div className="placar">Hoje: {placar.foram} {placar.foram === 1 ? "foi" : "foram"}{barroTxt}</div>;
}
