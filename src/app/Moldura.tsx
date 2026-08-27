"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Estado } from "@/lib/motor";

/** `data-state` no `<main>` é a fonte ÚNICA de cor da ficha: dele saem o selo
 *  (`.bp[data-state] .stamp`) e o pin do mapa (`.bp[data-state] .wp-pin`).
 *
 *  Ele não codifica a fase — quem faz isso é o `data-fase` do carimbo, e só ele.
 *  São duas perguntas diferentes: `data-fase` diz o que o carimbo está fazendo
 *  (afirmando / conferindo / sem informações), `data-state` diz de que cor é a
 *  leitura que está na tela. As regras de fase, em ficha.css, ganham da cor do
 *  estado no selo — de propósito.
 *
 *  Por que um contexto e não só a prop do servidor: quando o Carimbo busca uma
 *  leitura nova no portão, o texto muda ("Pode ir" → "Não vá") e a cor tem
 *  que ir junto. A cor é o que o motorista lê primeiro; selo verde dizendo
 *  "Não vá" é pior que não dizer nada.
 *
 *  O `<main>` continua saindo do servidor com a cor certa no primeiro paint —
 *  `useState(estado)` é o valor da prop, então a hidratação bate e quem está
 *  sem JS vê a decisão pintada do mesmo jeito. O cliente só corrige depois,
 *  quando a leitura muda de verdade. */
const Aviso = createContext<(estado: Estado) => void>(() => {});

/** Como o Carimbo avisa a moldura de que a leitura na tela mudou de cor.
 *  Fora de uma `<Moldura>` (testes de unidade do carimbo) é um no-op. */
export function useAvisarEstado() {
  return useContext(Aviso);
}

export default function Moldura({
  estado,
  children,
}: {
  estado: Estado;
  children: ReactNode;
}) {
  const [naTela, setNaTela] = useState<Estado>(estado);
  return (
    <main className="bp" data-state={naTela}>
      <Aviso.Provider value={setNaTela}>{children}</Aviso.Provider>
    </main>
  );
}
