"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import {
  coordDaDistancia,
  distanciaKm,
  formatarDistanciaCurta,
} from "@/lib/geo";
// `piso.ts` é puro de propósito — sem zod e sem `node:fs` — e é por isso que um
// client component pode lê-lo direto. A razão inteira está escrita lá.
import { rotuloPiso } from "@/lib/piso";
import { tomDe, vozDaFicha } from "@/lib/severidade";
import { coordDe } from "@/lib/local";
import SeloTrilha from "./SeloTrilha";
import { useLeitura } from "./leituras";
import { useLocal } from "./local";

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
  agora = null,
}: {
  ficha: Ficha;
  inicial: LeituraCarimbo;
  /** A hora de Recife em minutos, ou `null` no primeiro render. Chega por prop
   *  e não de um hook daqui: são N cartões, e um hook por cartão faria o número
   *  de hooks variar com o tamanho da lista. Quem chama `useAgoraRecife` é a
   *  folha, uma vez só. */
  agora?: number | null;
}) {
  const leitura = useLeitura(ficha.slug) ?? inicial;

  // A mesma fonte que o mapa: "uma pessoa, uma fonte" também vale aqui — o
  // cartão não chama navigator.geolocation por conta própria, lê o contexto.
  const voce = coordDe(useLocal());
  const partes = [
    // `coordDaDistancia`, nunca `ficha.condicao.coords`: o km do cartão e o km
    // da ficha são a MESMA pergunta, e quem responde é uma função só.
    voce ? formatarDistanciaCurta(distanciaKm(voce, coordDaDistancia(ficha))) : null,
    // A extensão da trilha (`ficha.extensaoKm`) saiu desta linha por decisão
    // do João em 2026-08-23: "remova o filtro tamanho da trilha, acho que não
    // está para hoje". O campo saiu do schema na contração da mesma rodada
    // (Task 7) — não existe mais nada aqui pra esta tela ler.
    // O piso da VIA (fato do lugar), no lugar do antigo `esforco` (fato do
    // corpo de quem vai). `rotuloPiso` troca o hífen do enum por espaço —
    // "asfalto-esburacado" é chave de dado, não texto de tela.
    ficha.piso ? rotuloPiso(ficha.piso) : null,
    // `custo.valor` é texto livre (schema não garante separador nenhum). O
    // JSON real da Rampa usa " · ", não " — " como um teste antigo supunha —
    // por isso o corte aceita os dois. Sem separador algum, o split não acha
    // nada e devolve a string inteira (index [0]), que é o comportamento
    // certo pra um custo curto como "R$ 10".
    ficha.custo.tag === "pago" && ficha.custo.valor
      ? ficha.custo.valor.split(/\s[—·]\s/)[0]
      : null,
  ].filter(Boolean);

  return (
    <a
      id={ficha.slug}
      className="cartao"
      data-state={tomDe(leitura.estado, ficha.condicao.severidade)}
      href={`/${ficha.slug}`}
    >
      <span className="cartao-topo">
        <span className="cartao-nome">{ficha.trajeto.waypoints[0].nome}</span>
        <SeloTrilha
          leitura={leitura}
          horario={ficha.horario}
          voz={vozDaFicha(ficha.condicao)}
          agora={agora}
        />
      </span>
      <span className="cartao-prom">{ficha.promessa}</span>
      {partes.length > 0 && <span className="cartao-meta">{partes.join(" · ")}</span>}
    </a>
  );
}
