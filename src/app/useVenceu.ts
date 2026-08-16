"use client";
import { useEffect, useState } from "react";
import { carimboVenceu } from "@/lib/validade";

/** O relógio da validade de uma leitura.
 *
 *  **Devolve `false` no primeiro render, sempre.** Não é descuido: é o que faz
 *  o HTML do servidor e o primeiro render do cliente concordarem. Calcular
 *  `Date.now()` durante o render quebraria a hidratação de uma página vinda do
 *  cache do service worker — o servidor gravou "Pode subir" e o cliente, 40
 *  minutos depois, desenharia "SEM INFORMAÇÕES" no mesmo lugar. É a mesma razão
 *  do `useState(false)` no Carimbo da ficha.
 *
 *  O intervalo serve a tela aberta na mão. Quem cobre o celular no bolso são os
 *  gatilhos do HomeViva — navegador estrangula timer de aba escondida. */
export function useVenceu(calculadoEm: number): boolean {
  const [venceu, setVenceu] = useState(false);
  useEffect(() => {
    const checar = () => setVenceu(carimboVenceu(calculadoEm, Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [calculadoEm]);
  return venceu;
}

/** O mesmo relógio, agregado: `true` assim que QUALQUER uma das leituras
 *  vencer. Existe pro `MioloHome`, que precisa de uma pergunta só —"tem
 *  alguma trilha sem leitura confiável na tela?"— sem chamar `useVenceu` uma
 *  vez por cartão dentro de um `.map()` (número de hooks variando com o
 *  tamanho da lista é a partida que o React não deixa jogar).
 *
 *  A dependência do efeito é a STRING das horas, não o array: um array vindo
 *  de `.map()` é uma referência nova a cada render, e usar a referência como
 *  dependência faria o efeito recriar o intervalo pra sempre, mesmo quando as
 *  horas são as mesmas.
 *
 *  **Devolve `false` no primeiro render, sempre** — mesma disciplina do
 *  `useVenceu`, e pela mesma razão: calcular `Date.now()` durante o render
 *  quebraria a hidratação, e agora quebraria bem no elemento que decide se a
 *  folha agrupa. */
export function useAlgumVenceu(calculadoEms: number[]): boolean {
  const chave = calculadoEms.join(",");
  const [venceu, setVenceu] = useState(false);
  useEffect(() => {
    const valores = chave === "" ? [] : chave.split(",").map(Number);
    const checar = () => {
      const agora = Math.floor(Date.now() / 1000);
      setVenceu(valores.some((c) => carimboVenceu(c, agora)));
    };
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [chave]);
  return venceu;
}
