"use client";
import { useEffect, useRef, useState } from "react";
import { rotuloPilula } from "@/lib/local";
import type { Lugar } from "@/lib/lugares";
import { useGps, useLocal, useMexerLocal } from "./local";

type Fase = "fechado" | "aberto";
type Resultado = { tipo: "vazio" } | { tipo: "lista"; lugares: Lugar[] } | { tipo: "falhou" };

/** Espera de digitação: busca a cada letra seria uma requisição por tecla.
 *  Exportada (em vez de constante privada) pra ter teste — mesmo motivo do
 *  `zoomDeTiles()` em src/lib/mapa.ts. Os testes de relógio falso avançam o
 *  tempo por ESTE valor, então mudar a espera não faz nenhum teste mentir. */
export const ESPERA_MS = 350;

/** A pílula no canto do mapa e a busca que ela abre — o único lugar de onde a
 *  localização se mexe.
 *
 *  Quem nunca permitiu o GPS vê "Ver daqui", e o toque PEDE o GPS: é o toque
 *  único que o João aprovou. Quem já negou vê "escolher onde estou", e o
 *  toque abre a busca — insistir no GPS ali seria um botão que não faz nada,
 *  porque o navegador não pergunta duas vezes. */
export default function BuscaLugar() {
  const local = useLocal();
  const gps = useGps();
  const { pedirGps, escolher } = useMexerLocal();
  const [fase, setFase] = useState<Fase>("fechado");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado>({ tipo: "vazio" });
  const pedido = useRef(0);

  const soGps = local.tipo === "nao-sei" && gps === "nunca";

  useEffect(() => {
    if (fase !== "aberto" || q.trim() === "") {
      setRes({ tipo: "vazio" });
      return;
    }
    const meu = ++pedido.current;
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lugares?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const lugares = (await r.json()) as Lugar[];
        // Resposta de uma busca antiga chegando depois da nova sobrescreveria
        // a lista certa pela errada.
        if (meu === pedido.current) setRes({ tipo: "lista", lugares });
      } catch {
        if (meu === pedido.current) setRes({ tipo: "falhou" });
      }
    }, ESPERA_MS);
    return () => clearTimeout(id);
  }, [q, fase]);

  return (
    <>
      <button
        className="mapa-pilula"
        onClick={() => (soGps ? pedirGps() : setFase(fase === "aberto" ? "fechado" : "aberto"))}
      >
        {rotuloPilula(local, gps)}
      </button>

      {fase === "aberto" && (
        <div className="busca">
          <input
            className="busca-campo"
            type="text"
            autoFocus
            placeholder="digite a cidade"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {/* 🔴 O caminho de VOLTA pro GPS, e ele conserta um beco que já está
              em produção: com uma cidade escolhida, `soGps` é falso, o toque
              na pílula abre esta busca, e ela só oferecia outras cidades —
              `pedirGps` ficava sem chamador nenhum no app.

              FORA do `.busca-rolo` de propósito, pelo mesmo motivo medido do
              crédito do GeoNames logo abaixo: o que mora dentro da caixa que
              rola sai de vista quando a lista de cidades cresce, e este é o
              item que precisa continuar alcançável.

              Some com o GPS negado — o navegador não pergunta duas vezes, e o
              botão viraria um que não faz nada. Mesmo argumento do
              `rotuloPilula`. */}
          {gps !== "negado" && (
            <button
              className="busca-item"
              onClick={() => {
                pedirGps();
                setFase("fechado");
              }}
            >
              de onde eu estou
            </button>
          )}
          {/* 🔴 O que ROLA é só esta caixa. O campo fica em cima dela e o
              crédito embaixo, os dois FORA da área de rolagem — ver o
              comentário do crédito logo abaixo. */}
          <div className="busca-rolo">
            {res.tipo === "falhou" && <p className="busca-aviso">não consegui buscar agora</p>}
            {res.tipo === "lista" && res.lugares.length === 0 && (
              <p className="busca-aviso">não achei esse lugar</p>
            )}
            {res.tipo === "lista" &&
              res.lugares.map((l) => (
                <button
                  key={`${l.nome}-${l.lat}-${l.lng}`}
                  className="busca-item"
                  onClick={() => {
                    escolher({
                      tipo: "escolhido",
                      coord: { lat: l.lat, lng: l.lng },
                      em: Math.floor(Date.now() / 1000),
                      nome: l.nome,
                      regiao: l.regiao,
                    });
                    setFase("fechado");
                    setQ("");
                  }}
                >
                  <span className="busca-nome">{l.nome}</span>
                  <span className="busca-reg">{[l.regiao, l.pais].filter(Boolean).join(" · ")}</span>
                </button>
              ))}
          </div>
          {/* OBRIGAÇÃO DE LICENÇA, não enfeite — descoberta no Step 6 da Task 5.
              Os dados de lugar vêm do GeoNames via Open-Meteo, sob CC-BY, que
              exige atribuição VISÍVEL e com link. Mesma disciplina do
              `© OpenStreetMap` que todo mapa deste app já carrega por ODbL.

              🔴 FORA do `.busca-rolo` de propósito. Enquanto ele era o último
              filho da caixa que rola, MEDIDO em 375×667: o painel mostrava
              168px de 344px de conteúdo e o crédito nascia 144px ABAIXO do fim
              visível — só aparecia pra quem rolasse dentro de uma caixa sem
              nenhuma dica de que rola. Atribuição que exige descoberta não é
              atribuição visível. O `© OpenStreetMap` do mapa está sempre na
              tela pelo mesmo motivo. */}
          <p className="busca-fonte">
            dados de <a href="https://www.geonames.org/">GeoNames</a>
          </p>
        </div>
      )}
    </>
  );
}
