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
  // 🔴 CADA PEDAÇO CARREGA O SEU NÍVEL, e por isso isto é uma lista de pares e
  // não de strings (2026-09-10). Até hoje os três viviam num `join(" · ")` —
  // uma string só, sem identidade endereçável, onde a marca do Nível B não
  // tinha onde pousar. Mesma razão que fez o `data-bloco="trajeto"` existir na
  // ficha: sem endereço, "o piso brilha" viraria "existe em algum lugar do
  // cartão", e nenhum teste separaria as duas versões.
  //
  // 🔴 O NÍVEL DE CADA CAMPO NÃO É ESCOLHA DESTA TELA — é a régua da L3, escrita
  // por extenso em `src/app/[slug]/page.tsx` e decidida por ele: Nível A é o que
  // o mapa e o feed de chuva entregam igual pra qualquer um; Nível B é o que só
  // sabe quem foi. A ficha aberta já classificava estes três campos; a HOME os
  // mostrava todos planos, e ninguém decidiu isso — a L3 parou na ficha por
  // acidente. **Duas superfícies classificando o mesmo campo de formas
  // diferentes é a família de defeito que este projeto já pagou três vezes.**
  const partes: ({ texto: string; nivel?: "b" } | null)[] = [
    // `coordDaDistancia`, nunca `ficha.condicao.coords`: o km do cartão e o km
    // da ficha são a MESMA pergunta, e quem responde é uma função só.
    //
    // SEM marca, e é o desenho: distância é Nível A — o telefone calcula, e isso
    // não é conhecimento de quem foi. Na ficha ela também não é marcada.
    voce
      ? { texto: formatarDistanciaCurta(distanciaKm(voce, coordDaDistancia(ficha))) }
      : null,
    // A extensão da trilha (`ficha.extensaoKm`) saiu desta linha por decisão
    // do João em 2026-08-23: "remova o filtro tamanho da trilha, acho que não
    // está para hoje". O campo saiu do schema na contração da mesma rodada
    // (Task 7) — não existe mais nada aqui pra esta tela ler.
    // O piso da VIA (fato do lugar), no lugar do antigo `esforco` (fato do
    // corpo de quem vai). `rotuloPiso` troca o hífen do enum por espaço —
    // "asfalto-esburacado" é chave de dado, não texto de tela.
    //
    // NÍVEL B: a régua da L3 nomeia o piso, com todas as letras, entre "o que só
    // sabe quem foi". Na ficha ele brilha dentro do `.fatos` do Trajeto.
    ficha.piso ? { texto: rotuloPiso(ficha.piso), nivel: "b" as const } : null,
    // `custo.valor` é texto livre (schema não garante separador nenhum). O
    // JSON real da Rampa usa " · ", não " — " como um teste antigo supunha —
    // por isso o corte aceita os dois. Sem separador algum, o split não acha
    // nada e devolve a string inteira (index [0]), que é o comportamento
    // certo pra um custo curto como "R$ 10".
    ficha.custo.tag === "pago" && ficha.custo.valor
      ? // NÍVEL B por decisão DELE em 2026-09-09, palavra dele: "preço e horário
        // brilham". Na ficha é o `.ticket`, marcado pela mesma razão.
        { texto: ficha.custo.valor.split(/\s[—·]\s/)[0], nivel: "b" as const }
      : null,
  ];
  const visiveis = partes.filter((p): p is { texto: string; nivel?: "b" } => p !== null);

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
