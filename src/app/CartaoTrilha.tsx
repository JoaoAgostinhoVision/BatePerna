"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { fatosDaTrilha } from "@/lib/fatos-da-trilha";
import { aberturaDaFicha, type Agora } from "@/lib/horario";
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
  /** O relógio de Recife (`Agora`), ou `null` no primeiro render. Chega por prop
   *  e não de um hook daqui: são N cartões, e um hook por cartão faria o número
   *  de hooks variar com o tamanho da lista. Quem chama `useAgoraRecife` é a
   *  folha, uma vez só. */
  agora?: Agora | null;
}) {
  const leitura = useLeitura(ficha.slug) ?? inicial;

  // A mesma fonte que o mapa: "uma pessoa, uma fonte" também vale aqui — o
  // cartão não chama navigator.geolocation por conta própria, lê o contexto.
  const voce = coordDe(useLocal());
  // 🔴 A MONTAGEM MORA EM `src/lib/fatos-da-trilha.ts` DESDE 2026-09-11, e não
  // mais aqui. Ela vivia neste componente, e `/trilhas` mostrava outra coisa;
  // no dia em que a lista do acervo passasse a mostrar os mesmos fatos, seriam
  // duas telas classificando o mesmo campo por conta própria — inclusive o
  // NÍVEL de cada um, que é a régua da L3 e decisão dele, não desta tela.
  //
  // `comAbertura` fica falso aqui de propósito: o selo logo acima já diz
  // "Fechado agora · abre amanhã" quando importa, e repetir os dias alongaria
  // uma linha que já quebra em duas no celular. Na lista do acervo, onde não há
  // selo nenhum, ele é verdadeiro. A razão inteira está escrita lá.
  const visiveis = fatosDaTrilha(ficha, { voce });

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
          abertura={aberturaDaFicha(ficha)}
          voz={vozDaFicha(ficha.condicao)}
          agora={agora}
        />
      </span>
      <span className="cartao-prom">{ficha.promessa}</span>
      {/* O separador vive ENTRE os pedaços, e não dentro deles: com o " · "
          colado no texto de cada um, a marca do Nível B pintaria o ponto
          também — e o ponto não é conhecimento de ninguém, é pontuação. Por
          isso ele sai num `<span>` sem marca, e só entre dois pedaços. */}
      {visiveis.length > 0 && (
        <span className="cartao-meta">
          {visiveis.map((p, i) => (
            <span key={p.texto}>
              {i > 0 && <span className="sep"> · </span>}
              <span data-nivel={p.nivel}>{p.texto}</span>
            </span>
          ))}
        </span>
      )}
    </a>
  );
}
