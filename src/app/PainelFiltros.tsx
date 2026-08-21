"use client";
import { useState } from "react";
import {
  contarLigados,
  DIST_MAX_KM,
  DIST_PASSO_KM,
  EXT_MAX_KM,
  EXT_PASSO_KM,
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
 *  🔴 OS QUATRO LIMITES DE KM SAEM DE `@/lib/filtros`, e nenhum deles é escrito
 *  à mão aqui. Não é preciosismo: é o mesmo módulo que o `lerFiltros` usa pra
 *  conferir o que está guardado. Uma segunda cópia poderia discordar, e
 *  discordando a tela aceitaria um valor que a releitura joga fora — o filtro
 *  se desligando sozinho entre duas aberturas do app, sem nada dizendo por quê.
 *  Trocar os limites ENTRE as duas faixas produz exatamente esse defeito — o
 *  `Tamanho da trilha` aceitaria na tela um teto de distância, e o `lerFiltros`
 *  o devolveria `null` na abertura seguinte. Por isso há teste lendo o `max` de
 *  cada barra E teste lendo esta fonte: em runtime o número escrito à mão e a
 *  constante são o MESMO valor, e nenhuma asserção de comportamento separa as
 *  duas versões. (Sem os números aqui de propósito: comentário que crava
 *  número envelhece calado no dia em que a constante mudar.) */
export default function PainelFiltros({ visiveis }: { visiveis: number }) {
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
          {/* O recorte de distância só existe quando há de onde medir — e SÓ
              ele. A faixa de tamanho da trilha não depende de localização
              nenhuma: embrulhar as duas aqui faria o recorte de tamanho sumir
              pra quem está sem GPS, sem nada na tela dizendo por quê. */}
          {temLocal && (
            <FaixaKm
              rotulo="Distância daqui"
              valor={filtros.distanciaKm}
              max={DIST_MAX_KM}
              passo={DIST_PASSO_KM}
              onChange={(km) => trocar({ distanciaKm: km })}
            />
          )}
          {/* O `FaixaKm` JÁ É o grupo (fieldset + legend). Um `<fieldset>` por
              fora daria grupo dentro de grupo e dois nomes acessíveis pro mesmo
              controle. */}
          <FaixaKm
            rotulo="Tamanho da trilha"
            valor={filtros.extensaoMaxKm}
            max={EXT_MAX_KM}
            passo={EXT_PASSO_KM}
            onChange={(km) => trocar({ extensaoMaxKm: km })}
          />
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
