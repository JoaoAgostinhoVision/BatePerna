"use client";
import { useState } from "react";
import {
  contarLigados,
  DIST_PASSO_KM,
  type Filtros,
} from "@/lib/filtros";
import { coordDe } from "@/lib/local";
import { PISOS_FILTRAVEIS, rotuloPiso } from "@/lib/piso";
import FaixaKm from "./FaixaKm";
import { useFiltros, useMexerFiltros } from "./filtros";
import { useLocal } from "./local";

/** A linha de resumo e o painel que ela abre.
 *
 *  O painel DESCE EMPURRANDO a lista (sanfona), não é cortina por cima do
 *  mapa: decisão do João, e ela vale além desta tela — este app não tem
 *  nenhuma camada flutuante, e uma cortina puxaria junto fechar-tocando-fora,
 *  prender o foco atrás dela e Esc, três coisas que hoje não existem aqui.
 *
 *  🔴 O LIMITE DE KM FIXO (o passo da faixa de distância) SAI DE
 *  `@/lib/filtros`, e não é escrito à mão aqui. Não é preciosismo: é o mesmo
 *  módulo que o `lerFiltros` usa pra conferir o que está guardado. Uma
 *  segunda cópia poderia discordar, e discordando a tela aceitaria um valor
 *  que a releitura joga fora — o filtro se desligando sozinho entre duas
 *  aberturas do app, sem nada dizendo por quê.
 *  O teto da distância NÃO é fixo: `tetoDistanciaKm` chega PRONTO por prop,
 *  calculado no `MioloHome` a partir do acervo (ver `tetoDaBarraDistancia`) —
 *  o `DIST_MAX_KM` que morava aqui era um número inventado, e o painel
 *  continua sem fazer conta de km, só de um jeito diferente: lendo em vez de
 *  importar. Por isso há teste lendo o `max` da barra E teste lendo esta
 *  fonte: em runtime o número escrito à mão e a constante são o MESMO valor,
 *  e nenhuma asserção de comportamento separa as duas versões. (Sem os
 *  números aqui de propósito: comentário que crava número envelhece calado
 *  no dia em que a constante mudar.)
 *  (A faixa de "Tamanho da trilha" saiu desta tela por decisão do João em
 *  2026-08-23 (Task 6 da mesma rodada). O campo `extensaoMaxKm` que ela ligava
 *  e os limites `EXT_MAX_KM`/`EXT_PASSO_KM` que ela lia saíram de `Filtros` e
 *  de `@/lib/filtros` na contração desta rodada (Task 7) — não sobrou nem o
 *  campo, nem o limite, nem controle nenhum aqui pra ligar algo que não
 *  existe.) */
export default function PainelFiltros({
  visiveis,
  tetoDistanciaKm,
}: {
  visiveis: number;
  /** Até onde a barra de distância vai. Vem PRONTO do `MioloHome`, que é quem
   *  tem o acervo, a sua coordenada e o filtro no mesmo escopo — o painel
   *  continua sem fazer conta de km. Ver `tetoDaBarraDistancia`. */
  tetoDistanciaKm: number;
}) {
  const filtros = useFiltros();
  const mexer = useMexerFiltros();
  const temLocal = coordDe(useLocal()) !== null;
  const [aberto, setAberto] = useState(false);
  const ligados = contarLigados(filtros);
  // `{...filtros, ...p}`, e o espalhamento do estado atual é load-bearing: com
  // `{...SEM_FILTRO, ...p}` ("reinicia e aplica") ligar um recorte APAGA os
  // outros na cara de quem acabou de ligá-los. Tem teste em cima.
  const trocar = (p: Partial<Filtros>) => mexer({ ...filtros, ...p });

  return (
    <>
      <div className="filtro-linha">
        <span className="filtro-conta">
          {visiveis === 1 ? "1 trilha" : `${visiveis} trilhas`}
          {ligados > 0 && ` · ${ligados === 1 ? "1 filtro ligado" : `${ligados} filtros ligados`}`}
        </span>
        <button className="filtro-abrir" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          FILTRAR {aberto ? "▴" : "▾"}
        </button>
      </div>
      {aberto && (
        <div className="filtro-painel">
          {/* O recorte de distância só existe quando há de onde medir. A faixa
              de tamanho da trilha, que dependia só do acervo e não de
              localização nenhuma, saiu da tela por decisão do João em
              2026-08-23 ("remova o filtro tamanho da trilha, acho que não
              está para hoje") — este `temLocal &&` hoje embrulha uma faixa
              só. */}
          {temLocal && (
            // O `FaixaKm` JÁ É o grupo (fieldset + legend). Um `<fieldset>`
            // por fora daria grupo dentro de grupo: COM legenda, dois nomes
            // pro mesmo controle; SEM legenda, um grupo anônimo entre o
            // painel e a faixa, com o `.filtro-grupo` de fora virando
            // container flex do de dentro. Tem teste em cima desta faixa — a
            // versão sem legenda passava verde antes dele.
            <FaixaKm
              rotulo="Distância daqui"
              valor={filtros.distanciaKm}
              max={tetoDistanciaKm}
              passo={DIST_PASSO_KM}
              onChange={(km) => trocar({ distanciaKm: km })}
            />
          )}
          {/* A legenda diz "no mínimo" porque sem isso "asfalto tapete" lê como
              "SÓ asfalto tapete" — e o recorte é "daqui pra cima".

              `PISOS_FILTRAVEIS`, não `PISOS`: `barro` é o pior piso da escala e,
              aceso, não esconderia nenhuma ficha. Seria um chip que a pessoa
              liga, a linha de resumo conta, e a lista não muda.

              O ternário é a ÚNICA saída deste recorte: não há chip "qualquer"
              aqui, então quem tocou por engano só desliga tocando de novo. */}
          <fieldset className="filtro-grupo">
            <legend>Piso, no mínimo</legend>
            {PISOS_FILTRAVEIS.map((p) => (
              <button
                key={p}
                className="chip"
                aria-pressed={filtros.pisoMinimo === p}
                onClick={() => trocar({ pisoMinimo: filtros.pisoMinimo === p ? null : p })}
              >
                {rotuloPiso(p)}
              </button>
            ))}
          </fieldset>
          {/* Sem `aria-label` nos fieldsets, aqui e no de cima: o nome do grupo
              sai da `<legend>`, que é o título VISÍVEL. Foi medido na Task 4 —
              com o atributo junto, apagar a legenda deixava a suíte verde,
              porque o nome acessível continuava vindo do atributo (ele tem
              precedência) e só quem OLHA a tela perdia o título. */}
          <fieldset className="filtro-grupo">
            <legend>Hoje</legend>
            <button className="chip" aria-pressed={filtros.daHoje}
              onClick={() => trocar({ daHoje: !filtros.daHoje })}>só as que dá hoje</button>
          </fieldset>
          <fieldset className="filtro-grupo">
            <legend>Custo</legend>
            <button className="chip" aria-pressed={filtros.soGratis}
              onClick={() => trocar({ soGratis: !filtros.soGratis })}>só grátis</button>
          </fieldset>
        </div>
      )}
    </>
  );
}
