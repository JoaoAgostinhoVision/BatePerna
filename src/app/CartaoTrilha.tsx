import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import SeloTrilha from "./SeloTrilha";

/** Um cartão da folha. O cartão inteiro é o alvo de toque — mão suja de barro
 *  não acerta link de texto.
 *
 *  `id` é o slug porque o pin do mapa é uma âncora pra cá: `#<slug>`. É isso que
 *  faz o pin funcionar sem JavaScript nenhum. */
export default function CartaoTrilha({
  ficha,
  leitura,
}: {
  ficha: Ficha;
  leitura: LeituraCarimbo;
}) {
  return (
    <a id={ficha.slug} className="cartao" data-state={leitura.estado} href={`/${ficha.slug}`}>
      <span className="cartao-topo">
        <span className="cartao-nome">{ficha.trajeto.waypoints[0].nome}</span>
        <SeloTrilha slug={ficha.slug} inicial={leitura} />
      </span>
      <span className="cartao-prom">{ficha.promessa}</span>
    </a>
  );
}
