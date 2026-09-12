import { coordDaDistancia, distanciaKm, formatarDistanciaCurta, type Coord } from "./geo";
import { rotuloPiso, type Piso } from "./piso";
import { rotuloDias, type Dia } from "./semana";
import { rotuloFaixaCurta, type Horario } from "./horario";

/** OS FATOS COMPACTOS DE UMA TRILHA — a linha "· barro · R$ 5 · sábado e
 *  domingo" que o cartão da home e a lista do acervo desenham.
 *
 *  🔴 POR QUE ISTO SAIU DO COMPONENTE (2026-09-11). A montagem morava dentro do
 *  `CartaoTrilha`, e `/trilhas` mostrava outra coisa — nome, promessa, etiqueta
 *  — sem piso, sem preço, sem horário. No dia em que a lista passasse a mostrar
 *  os mesmos fatos, seriam **duas telas classificando o mesmo campo por conta
 *  própria**, que é a família de defeito que este projeto já pagou três vezes
 *  (a palavra e a cor nascendo de commits diferentes; `marcaDe` e `vozDaFicha`
 *  existem pela mesma razão).
 *
 *  🔴 E O QUE ESTÁ EM JOGO AQUI É A RÉGUA DA L3, não um `join(" · ")`. Nível A
 *  é o que o mapa e o feed de chuva entregam igual pra qualquer um; **Nível B é
 *  o que só sabe quem foi**, e brilha na tela. A classificação é decisão DELE —
 *  *"preço e horário brilham"* (2026-09-09) — e mora aqui, uma vez. Duas
 *  superfícies com marcações diferentes fariam o mesmo piso ser conhecimento
 *  numa tela e trivialidade na outra.
 *
 *  Puro de propósito, sem zod e sem `node:fs`: `CartaoTrilha` é client
 *  component e lê este módulo direto. Mesma razão que já exilou `piso.ts`. */

export type Fato = { texto: string; nivel?: "b" };

/** O que uma tela precisa saber pra montar a linha. Estrutural, e não a `Ficha`
 *  inteira, pra este módulo continuar sem zod — mesmo molde do `vozDaFicha`. */
export type TrilhaCompacta = {
  piso?: Piso;
  custo: { tag: "gratis" | "pago"; valor?: string };
  horario?: Horario;
  dias?: readonly Dia[];
  trajeto: { waypoints: readonly { lat: number; lng: number }[] };
};

/** Os fatos de uma trilha, na ordem em que se lê.
 *
 *  `voce` só existe onde há localização — a home a tem pelo contexto, `/trilhas`
 *  não (é server component, e a pergunta lá é "o que existe", não "o que está
 *  perto"). Sem ela a distância simplesmente não entra: **ausente é silêncio**,
 *  a régua de sempre.
 *
 *  `comAbertura` separa as duas telas de propósito, e não por gosto: no cartão
 *  da home o selo JÁ diz "Fechado agora · abre amanhã" quando importa, e repetir
 *  os dias ali só alongaria uma linha que já quebra em duas no celular. Na
 *  lista do acervo **não há selo nenhum** — e é lá que "só abre sábado e
 *  domingo" é a única forma de descobrir o regime do lugar sem abrir a ficha
 *  num dia em que ela esteja fechada. */
export function fatosDaTrilha(
  t: TrilhaCompacta,
  { voce, comAbertura = false }: { voce?: Coord | null; comAbertura?: boolean } = {},
): Fato[] {
  const partes: (Fato | null)[] = [
    // `coordDaDistancia`, nunca `condicao.coords`: o km do cartão e o km da
    // ficha são a MESMA pergunta, e quem responde é uma função só.
    //
    // SEM marca, e é o desenho: distância é Nível A — o telefone calcula, e
    // isso não é conhecimento de quem foi. Na ficha ela também não é marcada.
    voce ? { texto: formatarDistanciaCurta(distanciaKm(voce, coordDaDistancia(t))) } : null,

    // O piso da VIA (fato do lugar). `rotuloPiso` troca o hífen do enum por
    // espaço — "asfalto-esburacado" é chave de dado, não texto de tela.
    //
    // NÍVEL B: a régua da L3 nomeia o piso, com todas as letras, entre "o que
    // só sabe quem foi". Na ficha ele brilha dentro do `.fatos` do Trajeto.
    t.piso ? { texto: rotuloPiso(t.piso), nivel: "b" as const } : null,

    // `custo.valor` é texto livre (o schema não garante separador nenhum). O
    // JSON real usa " · "; o corte aceita " — " também. Sem separador algum o
    // split devolve a string inteira, que é o certo pra um custo curto.
    //
    // NÍVEL B por decisão DELE em 2026-09-09: *"preço e horário brilham"*.
    t.custo.tag === "pago" && t.custo.valor
      ? { texto: t.custo.valor.split(/\s[—·]\s/)[0], nivel: "b" as const }
      : null,

    // 🔴 OS DOIS EIXOS DA ABERTURA, e eles vêm SEPARADOS de propósito: uma
    // trilha pode ter dia sem hora (a Rampa: ninguém sabe a que horas ela abre)
    // ou hora sem dia. Juntá-los numa string só obrigaria a inventar a metade
    // que falta — o mesmo motivo pelo qual `dias` não mora dentro de `horario`.
    //
    // NÍVEL B pela mesma palavra dele: horário brilha.
    comAbertura && t.dias?.length
      ? { texto: rotuloDias(t.dias), nivel: "b" as const }
      : null,
    comAbertura && t.horario
      ? { texto: rotuloFaixaCurta(t.horario), nivel: "b" as const }
      : null,
  ];
  return partes.filter((p): p is Fato => p !== null);
}
