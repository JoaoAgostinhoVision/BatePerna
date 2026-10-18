"use client";
import { useState, type FormEvent } from "react";
import type { AchadoNoMapa } from "@/lib/nominatim";
import { BUSCANDO, BUSCAR, BUSCA_NAO_SAIU, NENHUM_ACHADO, ROTULO_DA_BUSCA } from "./palavras";

/** A CAIXA DE BUSCA EM CIMA DO MAPA DO PONTO (17/10, Task 5).
 *
 *  🔴 ELA SÓ MOVE O MAPA. `aoEscolher` recebe o centro do achado e é só isso: o
 *  achado nunca vira pin, nunca liga o Salvar, nunca preenche nada — o ponto
 *  continua vindo do dedo de quem sabe (spec §3.4; o motivo de 26/09, a
 *  cachoeira a 5 km da cidade, fica).
 *
 *  🔴 SÓ O BOTÃO BUSCA (a política do Nominatim: nunca busca-enquanto-digita).
 *  A caixa é um `<form>` com `<input type="search">` e o botão: o Enter e o
 *  toque no botão são o MESMO `submit`, uma busca; o `onChange` só muda o
 *  estado. Texto vazio ou só de espaços não faz viagem, e enquanto uma busca
 *  está na rua o botão não dispara outra.
 *
 *  A busca vai à rota que o provedor deu (`buscarEm`: a do painel ou a dela) —
 *  este componente não conhece Nominatim, só a rota. 401 na tela de QUEM USA é
 *  a sessão do Clerk que venceu: a tela recarrega (`recarregarSe401`, como o
 *  resto do formulário); no painel é a frase de falha. Os dois fins ruins têm
 *  frases DIFERENTES: serviço fora ou rede caída (`BUSCA_NAO_SAIU`) não é "não
 *  achei nada" (`NENHUM_ACHADO`). */

type Centro = { lat: number; lng: number };

const ehAchado = (v: unknown): v is AchadoNoMapa => {
  const a = v as Partial<AchadoNoMapa> | null;
  return typeof a === "object" && a !== null && typeof a.nome === "string" && Number.isFinite(a.lat) && Number.isFinite(a.lng);
};

export default function BuscaNoMapa({
  buscarEm,
  recarregarSe401,
  aoEscolher,
}: {
  buscarEm: string;
  recarregarSe401: boolean;
  aoEscolher: (centro: Centro) => void;
}) {
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [achados, setAchados] = useState<AchadoNoMapa[]>([]);
  const [frase, setFrase] = useState<string | null>(null);

  async function buscar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const texto = q.trim();
    if (texto === "" || buscando) return;
    setBuscando(true);
    setFrase(null);
    setAchados([]);
    try {
      const r = await fetch(`${buscarEm}?q=${encodeURIComponent(texto)}`);
      if (r.status === 401 && recarregarSe401) {
        location.reload();
        return;
      }
      const dados: unknown = r.ok ? await r.json() : null;
      if (!Array.isArray(dados)) {
        setFrase(BUSCA_NAO_SAIU);
        return;
      }
      const lista = dados.filter(ehAchado);
      setAchados(lista);
      if (lista.length === 0) setFrase(NENHUM_ACHADO);
    } catch {
      setFrase(BUSCA_NAO_SAIU);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="adm-busca">
      <form className="adm-busca-form" onSubmit={(e) => void buscar(e)}>
        {/* Rótulo VISÍVEL em vez de `placeholder`: nada de exemplo dentro da caixa
            (a regra do formulário), e o nome acessível vem do `<label>`. */}
        <label className="adm-busca-rotulo">
          <span>{ROTULO_DA_BUSCA}</span>
          <input
            type="search"
            className="adm-busca-caixa"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button type="submit" className="adm-busca-botao" disabled={buscando}>
          {buscando ? BUSCANDO : BUSCAR}
        </button>
      </form>
      {frase !== null && <p className="adm-editor-ajuda">{frase}</p>}
      {achados.length > 0 && (
        <ul className="adm-busca-lista">
          {achados.map((a) => (
            <li key={`${a.lat},${a.lng},${a.nome}`}>
              <button
                type="button"
                className="adm-busca-achado"
                onClick={() => {
                  setAchados([]);
                  aoEscolher({ lat: a.lat, lng: a.lng });
                }}
              >
                {a.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
