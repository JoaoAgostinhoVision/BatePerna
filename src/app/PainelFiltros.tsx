"use client";
import { useState } from "react";
import { contarLigados, type Filtros } from "@/lib/filtros";
import { coordDe } from "@/lib/local";
import { useFiltros, useMexerFiltros } from "./filtros";
import { useLocal } from "./local";

/** A linha de resumo e o painel que ela abre.
 *
 *  O painel DESCE EMPURRANDO a lista (sanfona), não é cortina por cima do
 *  mapa: decisão do João, e ela vale além desta tela — este app não tem
 *  nenhuma camada flutuante, e uma cortina puxaria junto fechar-tocando-fora,
 *  prender o foco atrás dela e Esc, três coisas que hoje não existem aqui. */
export default function PainelFiltros({ visiveis }: { visiveis: number }) {
  const filtros = useFiltros();
  const mexer = useMexerFiltros();
  const temLocal = coordDe(useLocal()) !== null;
  const [aberto, setAberto] = useState(false);
  const ligados = contarLigados(filtros);
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
          {/* O recorte de distância só existe quando há de onde medir. */}
          {temLocal && (
            <fieldset className="filtro-grupo" aria-label="Distância">
              <legend>Distância</legend>
              {([30, 60, null] as const).map((v) => (
                <button key={String(v)} className="chip" aria-pressed={filtros.distanciaKm === v}
                  onClick={() => trocar({ distanciaKm: v })}>
                  {v === null ? "qualquer" : `até ${v} km`}
                </button>
              ))}
            </fieldset>
          )}
          <fieldset className="filtro-grupo" aria-label="Hoje">
            <legend>Hoje</legend>
            <button className="chip" aria-pressed={filtros.daHoje}
              onClick={() => trocar({ daHoje: !filtros.daHoje })}>só as que dá hoje</button>
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Custo">
            <legend>Custo</legend>
            <button className="chip" aria-pressed={filtros.soGratis}
              onClick={() => trocar({ soGratis: !filtros.soGratis })}>só grátis</button>
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Esforço">
            <legend>Esforço</legend>
            {(["leve", "media", "puxada"] as const).map((e) => (
              <button key={e} className="chip" aria-pressed={filtros.esforco === e}
                onClick={() => trocar({ esforco: filtros.esforco === e ? null : e })}>{e}</button>
            ))}
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Duração">
            <legend>Duração</legend>
            {([120, 240, null] as const).map((v) => (
              <button key={String(v)} className="chip" aria-pressed={filtros.duracaoMax === v}
                onClick={() => trocar({ duracaoMax: v })}>
                {v === 120 ? "até 2h" : v === 240 ? "até meio dia" : "qualquer"}
              </button>
            ))}
          </fieldset>
        </div>
      )}
    </>
  );
}
