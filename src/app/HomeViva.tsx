"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { type Gatilho, podeBuscar } from "@/lib/carimbo-fase";
import { carimboVenceu } from "@/lib/validade";
import { LeiturasProvider } from "./leituras";

/** O que mantém a home viva quando o app volta do bolso.
 *
 *  Irmão do Carimbo da ficha, com uma diferença que é a razão de existir: a
 *  home tem N carimbos, e buscá-los um a um seriam N requisições saindo do
 *  celular no portão. Uma chamada a /api/carimbos repinta a tela inteira.
 *
 *  Não há fase "conferindo" aqui de propósito. Na ficha, o carimbo é a tela
 *  toda e ficar sem afirmar nada por 3s é informação; na home, piscar cinco
 *  selos ao mesmo tempo vira tremeliques. A home troca quando a resposta chega,
 *  e enquanto não chega continua mostrando o que tinha — que é honesto, porque
 *  a leitura vencida já se mostra como "sem informações" por conta própria. */
export default function HomeViva({
  inicial,
  children,
}: {
  inicial: Record<string, LeituraCarimbo>;
  children: ReactNode;
}) {
  const [leituras, setLeituras] = useState(() => new Map(Object.entries(inicial)));

  const leiturasRef = useRef(leituras);
  leiturasRef.current = leituras;
  const buscando = useRef(false);
  const ultimaTentativa = useRef(Number.NEGATIVE_INFINITY);
  const vivo = useRef(true);
  // Rearmar na montagem, não só derrubar na limpeza: o StrictMode do `next dev`
  // monta, limpa e monta de novo, e sem isto o segundo mount nasce morto —
  // toda resposta descartada, a home nunca renova, e só em dev.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const buscar = useCallback(async () => {
    buscando.current = true;
    ultimaTentativa.current = Date.now();
    try {
      const res = await fetch("/api/carimbos", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const corpo: unknown = await res.json();
      // O corpo é conferido, não assumido: é ele que vira a decisão que a pessoa
      // lê. Um 200 com corpo torto daria `undefined` nos campos, e
      // carimboVenceu(undefined) é NaN >= 1800 → false: a tela afirmaria "Pode
      // subir" a partir de nada.
      const novas = lerCorpo(corpo);
      if (!vivo.current) return;
      setLeituras((antes) => new Map([...antes, ...novas]));
    } catch {
      // Falhou: as leituras que estão na tela continuam, e as vencidas já se
      // mostram como "sem informações" sozinhas. Não há o que inventar aqui.
    } finally {
      buscando.current = false;
    }
  }, []);

  const tentar = useCallback(
    (gatilho: Gatilho) => {
      const agora = Math.floor(Date.now() / 1000);
      const valores = [...leiturasRef.current.values()];
      const pode = podeBuscar(gatilho, {
        // Basta UMA trilha sem leitura ou vencida pra valer a chamada: ela é uma
        // só e traz todas de volta.
        erro: valores.some((l) => l.erro),
        venceu: valores.some((l) => carimboVenceu(l.calculadoEm, agora)),
        conferindo: buscando.current,
        desdeUltimaMs: Date.now() - ultimaTentativa.current,
      });
      if (pode) void buscar();
    },
    [buscar],
  );

  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState !== "hidden") tentar("voltou"); };
    const aoCarregar = () => tentar("carregou");
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoCarregar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoCarregar);
    };
  }, [tentar]);

  return <LeiturasProvider value={leituras}>{children}</LeiturasProvider>;
}

/** Só entra na tela o que tem a forma do trio. Slug com corpo torto é
 *  descartado inteiro — melhor manter a leitura velha, que ao menos se
 *  reconhece vencida, do que aceitar uma nova que não se sabe o que é. */
function lerCorpo(x: unknown): Map<string, LeituraCarimbo> {
  const fora = new Map<string, LeituraCarimbo>();
  if (typeof x !== "object" || x === null) return fora;
  for (const [slug, v] of Object.entries(x as Record<string, unknown>)) {
    if (ehLeitura(v)) fora.set(slug, v);
  }
  return fora;
}

function ehLeitura(x: unknown): x is LeituraCarimbo {
  if (typeof x !== "object" || x === null) return false;
  const { estado, erro, calculadoEm } = x as Record<string, unknown>;
  return (
    (estado === "fresco" || estado === "frio") &&
    typeof erro === "boolean" &&
    typeof calculadoEm === "number" &&
    Number.isFinite(calculadoEm)
  );
}
