"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import SeloTrilha from "./SeloTrilha";
import { useLeitura } from "./leituras";

/** Um cartão da folha. O cartão inteiro é o alvo de toque — mão suja de barro
 *  não acerta link de texto.
 *
 *  `id` é o slug porque o pin do mapa é uma âncora pra cá: `#<slug>`. É isso que
 *  faz o pin funcionar sem JavaScript nenhum.
 *
 *  Client component por um motivo específico, não por hábito: o `data-state`
 *  que pinta o cartão (e é a mesma cor do pin) precisa nascer da MESMA leitura
 *  que o `SeloTrilha` mostra. Se cada um lesse o contexto por conta própria —
 *  ou pior, se este `<a>` continuasse vindo pronto de um server component
 *  enquanto só o filho relê o contexto — a palavra trocaria (contexto) e a cor
 *  ficaria presa no HTML antigo, porque `children` de server component não
 *  re-renderiza. É o mesmo defeito que a `Moldura.tsx` da ficha já teve que
 *  consertar (lá virando `<main>` client component pela mesma razão). Por
 *  isso a leitura é lida AQUI, uma vez só, e desce pronta pro selo — nem o
 *  cartão nem o selo consultam duas fontes. */
export default function CartaoTrilha({
  ficha,
  inicial,
}: {
  ficha: Ficha;
  inicial: LeituraCarimbo;
}) {
  const leitura = useLeitura(ficha.slug) ?? inicial;

  return (
    <a id={ficha.slug} className="cartao" data-state={leitura.estado} href={`/${ficha.slug}`}>
      <span className="cartao-topo">
        <span className="cartao-nome">{ficha.trajeto.waypoints[0].nome}</span>
        <SeloTrilha leitura={leitura} />
      </span>
      <span className="cartao-prom">{ficha.promessa}</span>
    </a>
  );
}
