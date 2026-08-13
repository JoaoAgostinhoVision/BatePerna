"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { faseDe } from "@/lib/carimbo-fase";
import CartaoTrilha from "./CartaoTrilha";
import { useLeiturasMapa } from "./leituras";
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
 *  fontes que podem discordar. */
export default function FolhaTrilhas({ pares }: { pares: ParFolha[] }) {
  const mapa = useLeiturasMapa();
  const atual = (p: ParFolha): LeituraCarimbo => mapa?.get(p.ficha.slug) ?? p.leitura;

  // `useAlgumVenceu` devolve `false` no primeiro quadro, sempre — por isso o
  // primeiro render aqui bate com o que o HTML do servidor mostrou, mesmo que
  // a leitura já tenha, no relógio, passado dos 30 minutos.
  const algumVenceu = useAlgumVenceu(pares.map((p) => atual(p).calculadoEm));
  const algumErro = pares.some((p) => atual(p).erro);
  const confia = faseDe({ conferindo: false, erro: algumErro, venceu: algumVenceu, falhou: false }) === "afirmando";

  if (!confia) {
    // Sem cabeçalho nenhum: a ORDEM continua a de `pares` — que já chega
    // pronta (fresco primeiro, depois o resto, decidida pela classificação
    // com que a página nasceu) — porque não se filtra nem se ordena de novo
    // aqui, só se para de rotular. Um cartão pulando de grupo bem agora seria
    // uma SEGUNDA coisa acontecendo na tela, e a pessoa está no portão
    // decidindo.
    return (
      <div className="cartoes">
        {pares.map((p) => (
          <CartaoTrilha key={p.ficha.slug} ficha={p.ficha} inicial={p.leitura} />
        ))}
      </div>
    );
  }

  const podem = pares.filter((p) => atual(p).estado === "fresco");
  const naoPodem = pares.filter((p) => atual(p).estado !== "fresco");

  return (
    <>
      {grupo("Hoje o tempo deixa", podem)}
      {grupo("Hoje não", naoPodem)}
    </>
  );
}

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
