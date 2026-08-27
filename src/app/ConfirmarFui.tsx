"use client";
import { useEffect, useState } from "react";

/** O "✓ Fui": ele volta do passeio e conta como estava. É a alça de confiança do
 *  app — o único dado que não vem de satélite.
 *
 *  🔴 A PERGUNTA SUPUNHA TRÊS COISAS DE UMA VEZ, e as três já tinham sido
 *  corrigidas no carimbo sem ninguém olhar aqui (2026-08-27): *"E no **portão**,
 *  como estava?"* (ele decide **dirigindo**), *"Deu pra **subir**"* (ladeira — a
 *  Pedra Furada é plana) e *"Tava **barro**"* (o material — e aqui é pior que no
 *  selo: quem reporta numa trilha de asfalto não teria botão que sirva). Decisão
 *  dele: **tirar os três de uma vez.**
 *
 *  ⚠️ O RÓTULO E O VALOR GRAVADO DIVERGEM DE PROPÓSITO. O botão diz "Tava ruim"
 *  e manda `tipo: "barro"` — o enum vive no banco (`src/lib/db.ts`, tabela
 *  `confirmacoes`) e já tem linhas gravadas; trocá-lo seria migração de dado, não
 *  troca de copy. **Se um dia migrar, é aqui e nos três arquivos da rota.** */
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
          <div className="q">E como estava o chão?</div>
          <div className="opts">
            <button className="opt seco" onClick={() => enviar("seco")}>Deu pra ir</button>
            <button className="opt barro" onClick={() => enviar("barro")}>Tava ruim</button>
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
  // "achou o chão ruim", e não "achou ruim": em português "achei ruim" lê-se
  // como *não gostei*, que é outra coisa. É a lição da frase invertida da Pedra
  // Furada — ler o que a frase AFIRMA antes de escrevê-la.
  //
  // O verbo concorda, como o "foi/foram" ao lado: "2 achou" estava errado desde
  // sempre e só não aparecia porque ninguém tinha contado duas vezes no mesmo dia.
  const verbo = placar.barro === 1 ? "achou" : "acharam";
  const barroTxt = placar.barro > 0 ? ` · ${placar.barro} ${verbo} o chão ruim` : "";
  return <div className="placar">Hoje: {placar.foram} {placar.foram === 1 ? "foi" : "foram"}{barroTxt}</div>;
}
