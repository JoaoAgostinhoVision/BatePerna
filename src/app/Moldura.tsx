"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Estado } from "@/lib/motor";
import type { Fase } from "@/lib/carimbo-fase";
import { tomDe, type Severidade } from "@/lib/severidade";

/** `data-state` no `<main>` é a fonte ÚNICA de cor da ficha: dele saem o selo
 *  (`.bp[data-state] .stamp`) e o pin do mapa (`.bp[data-state] .wp-pin`).
 *
 *  🔴 E `data-fase` MUDOU-SE PRA CÁ EM 2026-09-10, junto com ele, porque o pin
 *  estava VERDE ao lado de um carimbo vermelho dizendo "Fechado agora" — todo
 *  dia, depois das 17h, sem chuva nenhuma. A cor do pin saía de `data-state`,
 *  que só fala de chuva; as fases que NÃO falam de chuva (`fechado`,
 *  `sem-informacoes`) nunca o alcançavam, porque `data-fase` vivia no
 *  `.decision` do Carimbo — que não é ancestral do pin. A home já tratava os
 *  dois casos (`home.css`: `.pin-home[data-state][data-fase=…]`); a ficha
 *  tratava metade.
 *
 *  ⚠️ **DOIS ATRIBUTOS NO MESMO ELEMENTO NÃO SÃO DUAS FONTES — desde que o dono
 *  seja um só, e é.** Eles respondem perguntas diferentes, e este arquivo já
 *  dizia isso: `data-fase` diz o que o carimbo está FAZENDO (afirmando /
 *  conferindo / sem informações / fechado), `data-state` diz de que COR é a
 *  leitura. Quem calcula os dois é o **Carimbo**, um lugar só, e os publica
 *  aqui; a Moldura não decide nada, só carrega. O defeito que este projeto
 *  pagou (o pulso piscando ao lado de "SEM INFORMAÇÕES") foi o contrário disto:
 *  dois atributos codificando o MESMO fato, calculados em lugares diferentes.
 *
 *  Por que um contexto e não só a prop do servidor: quando o Carimbo busca uma
 *  leitura nova no portão, o texto muda ("Pode ir" → "Não vá") e a cor tem
 *  que ir junto. A cor é o que o motorista lê primeiro; selo verde dizendo
 *  "Não vá" é pior que não dizer nada.
 *
 *  O `<main>` continua saindo do servidor com a cor certa no primeiro paint —
 *  `useState(estado)` é o valor da prop, então a hidratação bate e quem está
 *  sem JS vê a decisão pintada do mesmo jeito. O cliente só corrige depois,
 *  quando a leitura muda de verdade. O mesmo vale pra fase: o servidor manda a
 *  que ele sabe calcular, e ela é a MESMA que o Carimbo produz no primeiro
 *  render — senão a hidratação brigaria. */
type Publicar = { estado?: Estado; fase?: Fase };
const Aviso = createContext<(mudou: Publicar) => void>(() => {});

/** Como o Carimbo avisa a moldura de que a leitura ou a fase na tela mudou.
 *  Fora de uma `<Moldura>` (testes de unidade do carimbo) é um no-op. */
export function useAvisarMoldura() {
  return useContext(Aviso);
}

export default function Moldura({
  estado,
  severidade,
  fase,
  children,
}: {
  estado: Estado;
  /** O nível desta trilha. 🔴 A cor deixou de ser o estado cru em 2026-09-10:
   *  quem responde é `tomDe`, porque uma ficha de nível `cuidado` dizendo "Vá
   *  com cuidado" dentro de um retângulo VERMELHO é a palavra e a cor
   *  discordando — o defeito que o bloco acima conta. */
  severidade: Severidade;
  /** A fase que o SERVIDOR sabe calcular (só `erro` a muda), pro primeiro paint
   *  e pra quem está sem JS. O Carimbo assume daqui em diante. */
  fase: Fase;
  children: ReactNode;
}) {
  const [naTela, setNaTela] = useState<Estado>(estado);
  const [faseNaTela, setFaseNaTela] = useState<Fase>(fase);
  const publicar = (mudou: Publicar) => {
    if (mudou.estado !== undefined) setNaTela(mudou.estado);
    if (mudou.fase !== undefined) setFaseNaTela(mudou.fase);
  };
  return (
    <main className="bp" data-state={tomDe(naTela, severidade)} data-fase={faseNaTela}>
      <Aviso.Provider value={publicar}>{children}</Aviso.Provider>
    </main>
  );
}
