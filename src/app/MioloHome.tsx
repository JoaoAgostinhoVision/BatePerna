"use client";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
import { passaNoFiltro } from "@/lib/filtros";
import { coordDe } from "@/lib/local";
import FolhaTrilhas, { type ParFolha } from "./FolhaTrilhas";
import MapaHome from "./MapaHome";
import PainelFiltros from "./PainelFiltros";
import { useFiltros } from "./filtros";
import { useLeiturasMapa } from "./leituras";
import { useLocal } from "./local";
import { useAlgumVenceu } from "./useVenceu";

/** O miolo da home: o mapa, a linha de resumo e a folha — os três desenhando
 *  da MESMA lista.
 *
 *  🔴 ESTE COMPONENTE EXISTE POR UMA RAZÃO SÓ, e ela é a razão de a lista ser
 *  UMA. Antes daqui, `confia` e `visiveis` nasciam dentro da `FolhaTrilhas` e o
 *  `MapaHome` era irmão dela no `page.tsx`, recebendo o acervo inteiro. A
 *  revisão da branch mediu, com 3 trilhas e "até 30 km" ligado:
 *
 *      conta da linha: "1 trilha · 1 filtro ligado"
 *      aviso do mapa:  "2 trilhas fora do mapa"
 *      pins: 3   cartões: 1   âncoras mortas: 2
 *
 *  Três defeitos, uma raiz: duas contas. O pin é `<a href="#slug">` pro cartão
 *  daquela trilha — escondido o cartão, o toque no pin não faz nada; o aviso
 *  "2 trilhas fora do mapa" AFIRMA um número falso a 40px de "1 trilha"; e o
 *  enquadramento se abria pra caber um morro que o filtro tinha escondido.
 *
 *  Por isso a conta subiu pra um dono único, e a regra é literal: **um array
 *  só, num escopo léxico só**, consumido pelo mapa, pela linha e pela folha.
 *  Nada de o mapa refazer o `filter` "porque é barato" — duas expressões
 *  produzindo a lista é o Critical de duas rodadas atrás (agrupar num lugar,
 *  repintar em outro) com outra roupa. Teste: "com filtro ligado, pins,
 *  contagem e cartões são a MESMA lista".
 *
 *  Client component, e não por hábito: `visiveis` nasce de `useFiltros`,
 *  `useLocal` e da leitura de AGORA (`useLeiturasMapa`) — as três coisas que
 *  só existem depois da hidratação. Sem a diretiva a home fica parada no
 *  aparelho e o jsdom não acusa nada (lição 5 do docs/RESUME.md). */
export default function MioloHome({ pares }: { pares: ParFolha[] }) {
  const mapa = useLeiturasMapa();
  const atual = (p: ParFolha): LeituraCarimbo => mapa?.get(p.ficha.slug) ?? p.leitura;

  // `useAlgumVenceu` devolve `false` no primeiro quadro, sempre — por isso o
  // primeiro render aqui bate com o que o HTML do servidor mostrou, mesmo que
  // a leitura já tenha, no relógio, passado dos 30 minutos.
  //
  // 🔴 `algumVenceu`, `algumErro` e `confia` saem de `pares` — TODAS as
  // trilhas, não as visíveis. Não é descuido e não é otimizável:
  //   1. `passaNoFiltro` RECEBE `confia`; tirá-lo de `visiveis` seria circular;
  //   2. `useAlgumVenceu` é hook e recebe um array — alimentá-lo com uma lista
  //      que muda de tamanho a cada toque no filtro é convite pra defeito;
  //   3. e é o certo pelo produto: a leitura vem numa busca só, pro lote
  //      inteiro ("tudo ou nada no clima"). Leitura estragada não é notícia
  //      sobre aquele morro, é notícia sobre a BUSCA — vale pra todos,
  //      inclusive pros que o filtro escondeu.
  // A consequência é visível e tem teste próprio ("trilha escondida pelo
  // filtro ainda derruba o agrupamento"): não é pra "consertar".
  const algumVenceu = useAlgumVenceu(pares.map((p) => atual(p).calculadoEm));
  const algumErro = pares.some((p) => atual(p).erro);
  const confia = faseDe({ conferindo: false, erro: algumErro, venceu: algumVenceu, falhou: false }) === "afirmando";

  const filtros = useFiltros();
  const voce = coordDe(useLocal());

  // O RECORTE, e ele acontece UMA vez. Filtro, agrupamento e pins saem da
  // MESMA leitura (`atual`), no MESMO escopo, na mesma passada. Separá-los em
  // duas etapas em dois lugares é exatamente como nasceu o Critical da rodada
  // passada: o servidor agrupava, o cliente repintava, e o cabeçalho afirmava o
  // contrário do cartão embaixo dele.
  //
  // `.filter` preserva a ordem de `pares`, que já chega pronta do servidor
  // (fresco primeiro). Filtrar tira cartões; nunca os embaralha.
  const visiveis = pares.filter((p) =>
    passaNoFiltro({ ficha: p.ficha, leitura: atual(p), filtros, voce, confia }),
  );

  // Os três consumidores, todos derivados de `visiveis` — nunca de `pares`.
  // A ordem no DOM é a de sempre: mapa, linha de resumo (full-bleed, fora da
  // `.folha`, é dela a altura de ALTURA_LINHA_FILTRO_PX) e a folha.
  //
  // O mapa recebe FICHA + SEMENTE das visíveis. A semente é a leitura do
  // servidor que o `PinTrilha` usa como `inicial` — a mesma que o cartão
  // recebe, tirada do mesmo `visiveis`.
  //
  // O plano previa um segundo prop, um `Record` de leituras vindo do
  // `page.tsx`. Não é o que está aqui, e vale registrar o motivo CERTO: como
  // `fichas` já são as visíveis, um Record maior não desenharia pin a mais —
  // teria chaves inertes. O que ele seria é a MESMA informação viajando duas
  // vezes (ela já está dentro de `pares`), serializada de novo do servidor pro
  // cliente. Duas cópias do mesmo dado é uma que pode ficar velha no próximo
  // refactor, e é carga a mais no payload por nada.
  return (
    <>
      <MapaHome
        fichas={visiveis.map((p) => p.ficha)}
        leituras={Object.fromEntries(visiveis.map((p) => [p.ficha.slug, p.leitura]))}
      />
      <PainelFiltros visiveis={visiveis.length} />
      <FolhaTrilhas visiveis={visiveis} confia={confia} />
    </>
  );
}
