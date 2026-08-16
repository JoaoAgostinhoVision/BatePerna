"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
import { SEM_FILTRO, passaNoFiltro } from "@/lib/filtros";
import { coordDe } from "@/lib/local";
import CartaoTrilha from "./CartaoTrilha";
import PainelFiltros from "./PainelFiltros";
import { useFiltros, useMexerFiltros } from "./filtros";
import { useLeiturasMapa } from "./leituras";
import { useLocal } from "./local";
import { useAlgumVenceu } from "./useVenceu";

export type ParFolha = { ficha: Ficha; leitura: LeituraCarimbo };

/** A folha de cartões da home: agrupada por veredito quando dá pra confiar em
 *  todo mundo, lisa quando não dá.
 *
 *  Antes disto os cabeçalhos ("Hoje o tempo deixa" / "Hoje não") eram markup
 *  de server component, calculado uma vez e entregue como `children` do
 *  `HomeViva` — e `children` de server component não re-renderiza. O selo
 *  trocava de cor com uma leitura nova; o título acima dele, não. No portão,
 *  às 11h, com leitura mais fresca dizendo frio, o cartão virava vermelho sob
 *  um cabeçalho verde. É o MESMO defeito que o `CartaoTrilha` e o `PinTrilha`
 *  já resolveram (uma trilha, uma fonte) por uma quarta porta: o cabeçalho do
 *  GRUPO é o elemento que ninguém tinha ligado à fonte ainda.
 *
 *  Client component pela mesma razão dos dois: o texto do cabeçalho precisa
 *  nascer do MESMO contexto (`useLeiturasMapa`) que pinta `data-state` e o
 *  selo, não de uma prop congelada no primeiro render do servidor.
 *
 *  Regra (decisão do dono do produto, não escolha de implementação): basta
 *  UMA trilha sem leitura confiável na tela pra folha parar de agrupar —
 *  agrupar errado é pior que não agrupar. "Confiável" é a MESMA pergunta que
 *  o `SeloTrilha` já faz por cartão (`faseDe`), só que agregada aqui: erro em
 *  qualquer uma, ou validade vencida em qualquer uma. Escrever uma segunda
 *  regra pra "confiável" seria repetir o erro que criou este defeito — duas
 *  fontes que podem discordar.
 *
 *  Este componente também é quem RECORTA (os filtros) e quem informa a
 *  contagem à linha de resumo. Não é acúmulo de responsabilidade por
 *  preguiça: recortar num lugar e rotular em outro é a MESMA forma do defeito
 *  descrito acima, com outra roupa. A contagem que a linha mostra é
 *  `visiveis.length` — o `.length` da lista que desenhou os cartões, na mesma
 *  passada, e não uma segunda conta que pode divergir. */
export default function FolhaTrilhas({ pares }: { pares: ParFolha[] }) {
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
  // filtro ainda derruba o agrupamento se a leitura dela não presta"): não é
  // pra "consertar".
  const algumVenceu = useAlgumVenceu(pares.map((p) => atual(p).calculadoEm));
  const algumErro = pares.some((p) => atual(p).erro);
  const confia = faseDe({ conferindo: false, erro: algumErro, venceu: algumVenceu, falhou: false }) === "afirmando";

  const filtros = useFiltros();
  const mexer = useMexerFiltros();
  const voce = coordDe(useLocal());

  // Filtro e agrupamento saem da MESMA leitura (`atual`), no MESMO componente,
  // na mesma passada. Separá-los em duas etapas em dois lugares é exatamente
  // como nasceu o Critical da rodada passada: o servidor agrupava, o cliente
  // repintava, e o cabeçalho afirmava o contrário do cartão embaixo dele.
  //
  // `.filter` preserva a ordem de `pares`, que já chega pronta do servidor
  // (fresco primeiro). Filtrar tira cartões; nunca os embaralha.
  const visiveis = pares.filter((p) =>
    passaNoFiltro({ ficha: p.ficha, leitura: atual(p), filtros, voce, confia }),
  );

  // Função, não componente: chamada aqui dentro ela é a MESMA passada de
  // render, lendo `visiveis`, `confia` e `atual` do mesmo escopo. Um
  // `<Miolo>` seria um segundo componente, com seu próprio ciclo — a porta
  // exata pela qual o defeito da rodada passada entrou.
  const miolo = () => {
    // 🔴 A ORDEM DOS DOIS `if` IMPORTA, e o de baixo é o mais tentador de
    // subir. Com o vazio DEPOIS do `!confia`, o caso "carimbo não confiável +
    // filtro que zera" cai no ramo de baixo e desenha uma `.cartoes` VAZIA:
    // folha em branco, sem aviso e sem botão de limpar — que é o que a §7.4 da
    // spec proíbe. E o `!confia` é o ramo mais provável de estar na tela num
    // dia ruim, que é justamente quando a pessoa filtra mais. Tem teste
    // próprio: "filtro que zera a lista avisa TAMBÉM quando não dá pra confiar
    // no carimbo".
    if (visiveis.length === 0) {
      return (
        <div className="folha-vazia">
          <p>Nenhuma trilha com esses filtros</p>
          <button className="chip" onClick={() => mexer(SEM_FILTRO)}>limpar filtros</button>
        </div>
      );
    }

    if (!confia) {
      // Sem cabeçalho nenhum: a ORDEM continua a de `pares` — que já chega
      // pronta (fresco primeiro, depois o resto, decidida pela classificação
      // com que a página nasceu) — porque não se ordena de novo aqui, só se
      // para de rotular. Um cartão pulando de grupo bem agora seria uma
      // SEGUNDA coisa acontecendo na tela, e a pessoa está no portão decidindo.
      //
      // Mas RECORTA: este ramo desliga o agrupamento, não o filtro. Quem ligou
      // "só grátis" continua querendo só as grátis, com ou sem carimbo
      // confiável — teste "sem leitura confiável, os OUTROS recortes continuam
      // recortando".
      return (
        <div className="cartoes">
          {visiveis.map((p) => (
            <CartaoTrilha key={p.ficha.slug} ficha={p.ficha} inicial={p.leitura} />
          ))}
        </div>
      );
    }

    const podem = visiveis.filter((p) => atual(p).estado === "fresco");
    const naoPodem = visiveis.filter((p) => atual(p).estado !== "fresco");

    return (
      <>
        {grupo("Hoje o tempo deixa", podem)}
        {grupo("Hoje não", naoPodem)}
      </>
    );
  };

  return (
    <>
      {/* A linha fica FORA da `.folha` (que tem padding lateral) pra continuar
          full-bleed entre o mapa e os cartões — é dela a altura medida em
          ALTURA_LINHA_FILTRO_PX. */}
      <PainelFiltros visiveis={visiveis.length} />
      <div className="folha">{miolo()}</div>
    </>
  );
}

/** Devolver `null` pra lista vazia é o que faz o cabeçalho sumir junto com o
 *  grupo que o filtro esvaziou — o cabeçalho é uma AFIRMAÇÃO sobre o que está
 *  embaixo dele, e sem nada embaixo ele mente. Teste: "grupo esvaziado pelo
 *  filtro perde o cabeçalho". */
function grupo(titulo: string, lista: ParFolha[]) {
  if (lista.length === 0) return null;
  return (
    <>
      <div className="grupo-k">{titulo}</div>
      <div className="cartoes">
        {lista.map((p) => (
          <CartaoTrilha key={p.ficha.slug} ficha={p.ficha} inicial={p.leitura} />
        ))}
      </div>
    </>
  );
}
