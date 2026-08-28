"use client";
import { useEffect, useState } from "react";
import { minutosDoDiaRecife } from "@/lib/horario";

/** Que horas são em Recife, em minutos desde a meia-noite — ou `null`.
 *
 *  **Devolve `null` no primeiro render, sempre**, e essa é a linha inteira que
 *  importa. Mesma disciplina do `useVenceu`, e pela mesma razão: a ficha e a
 *  home são pré-renderizadas em BUILD (`generateStaticParams`), então o HTML
 *  que chega ao celular foi escrito num instante que não tem relação nenhuma
 *  com agora. Calcular a hora durante o render faria o primeiro quadro do
 *  cliente discordar do HTML e a hidratação brigar — bem no elemento que
 *  decide se dá pra ir.
 *
 *  `null` significa "ainda não sei", e quem consome trata isso como ABERTO
 *  (ver `fechadoAgora`): o app não afirma que fechou antes de ter o relógio.
 *
 *  UM hook pra tela toda, não um por cartão: a folha precisa da hora dentro de
 *  um `.map()`, e número de hooks variando com o tamanho da lista é a partida
 *  que o React não deixa jogar. É a mesma razão que fez `useAlgumVenceu`
 *  existir ao lado do `useVenceu`.
 *
 *  O intervalo é de um minuto porque a unidade da resposta é o minuto — e ele
 *  serve a tela aberta na mão; quem cobre o celular no bolso são os gatilhos de
 *  `visibilitychange`/`pageshow` que o `Carimbo` e o `HomeViva` já registram. */
export function useAgoraRecife(): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const checar = () => setAgora(minutosDoDiaRecife(Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, []);
  return agora;
}
