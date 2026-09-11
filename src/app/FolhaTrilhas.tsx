"use client";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { SEM_FILTRO } from "@/lib/filtros";
import { fechadoAgora } from "@/lib/horario";
import { tomDe } from "@/lib/severidade";
import CartaoTrilha from "./CartaoTrilha";
import { useMexerFiltros } from "./filtros";
import { useLeiturasMapa } from "./leituras";
import { useAgoraRecife } from "./useAgoraRecife";

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
 *  Esta folha NÃO RECORTA e NÃO decide se dá pra confiar: recebe `visiveis` e
 *  `confia` prontos do `MioloHome`. A conta subiu de propósito, e o comentário
 *  de lá diz por quê — o mapa desenhava o acervo enquanto esta folha desenhava
 *  o recorte, e pin, aviso e contagem discordavam na mesma tela. Recortar num
 *  lugar e rotular em outro é a MESMA forma do defeito descrito acima; a saída
 *  não foi espalhar a conta, foi ter UMA, e a lista que chega aqui é o mesmo
 *  array que desenhou os pins e alimentou a contagem da linha.
 *
 *  Ela continua dona de DUAS coisas: o agrupamento (e a decisão de não agrupar)
 *  e o estado vazio. */
export default function FolhaTrilhas({
  visiveis,
  confia,
}: {
  visiveis: ParFolha[];
  confia: boolean;
}) {
  // A leitura de AGORA, do mesmo contexto que pinta o selo, o cartão e o pin —
  // "uma trilha, uma fonte". O `MioloHome` lê o MESMO contexto na MESMA passada
  // de render pra decidir o recorte; o React garante um único valor de contexto
  // por render, então não há duas respostas possíveis aqui.
  const mapa = useLeiturasMapa();
  const atual = (p: ParFolha): LeituraCarimbo => mapa?.get(p.ficha.slug) ?? p.leitura;

  // UMA chamada pra folha inteira, e ela desce por prop até cada selo. Um
  // `useAgoraRecife` dentro do `.map()` faria o número de hooks variar com o
  // tamanho da lista — a mesma partida que o React não deixa jogar e que já
  // obrigou o `useAlgumVenceu` a existir.
  const agora = useAgoraRecife();

  const mexer = useMexerFiltros();

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
    //
    // ⚠️ A frase abaixo NÃO é verdade universal — ela assume que algum recorte
    // está ligado. Com o `pares` do `MioloHome` vazio e nenhum filtro ligado, a
    // tela se contradiz: a linha diz "0 trilhas" SEM o sufixo "· 1 filtro
    // ligado", e logo abaixo o aviso culpa filtros que não existem.
    //
    // Hoje o ramo é INALCANÇÁVEL nesse formato — aquele `pares` vem do acervo
    // local, que nunca é vazio. Ele passa a ser alcançável se (a) o acervo virar dado
    // remoto/paginado, ou (b) entrar um recorte que zere por outra razão que
    // não um filtro ligado. Aí a saída barata é distinguir os dois casos por
    // `visiveis.length === 0 && contarLigados(filtros) > 0` e escrever a outra
    // frase pro caso sem filtro. **Deixado de propósito: é decisão de produto,
    // não conserto de implementação.**
    if (visiveis.length === 0) {
      return (
        <div className="folha-vazia">
          <p>Nenhuma trilha com esses filtros</p>
          <button className="chip" onClick={() => mexer(SEM_FILTRO)}>limpar filtros</button>
        </div>
      );
    }

    if (!confia) {
      // Sem cabeçalho nenhum: a ORDEM continua a que `visiveis` trouxe — que
      // já chega pronta (fresco primeiro, depois o resto, decidida pela
      // classificação com que a página nasceu, e o `.filter` do `MioloHome`
      // preserva) — porque não se ordena de novo aqui, só se
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
            <CartaoTrilha key={p.ficha.slug} ficha={p.ficha} inicial={p.leitura} agora={agora} />
          ))}
        </div>
      );
    }

    // 🔴 FECHADO NÃO ENTRA NO GRUPO DE CIMA, mesmo com o tempo bom — e o
    // cabeçalho é exatamente por que isso importa. "Hoje o tempo deixa" é uma
    // AFIRMAÇÃO sobre os cartões embaixo dele: com um cartão dizendo "Fechado
    // agora" ali, o grupo estaria convidando pra uma coisa que não dá. Mesma
    // régua do cabeçalho que some quando o filtro esvazia o grupo. Fechado
    // também não entra no grupo do MEIO, e pela mesma frase.
    //
    // 🔴 SÃO TRÊS GRUPOS DESDE 2026-09-10, e o agrupamento pergunta o TOM, não
    // o estado. Decisão dele (*"a cor e o grupo seguem o nível"*): o carimbo da
    // Véu de Noiva passou a dizer "Vá com cuidado" em âmbar, e ela continuava
    // caindo sob "Hoje não" — o título contradizendo o cartão embaixo dele, que
    // é a mesma família do selo verde dizendo "Não vá".
    const tomDaqui = (p: ParFolha) =>
      fechadoAgora(p.ficha.horario, agora)
        ? "frio"
        : tomDe(atual(p).estado, p.ficha.condicao.severidade);

    const podem = visiveis.filter((p) => tomDaqui(p) === "fresco");
    const comCuidado = visiveis.filter((p) => tomDaqui(p) === "cuidado");
    const naoPodem = visiveis.filter((p) => tomDaqui(p) === "frio");

    return (
      <>
        {grupo("Hoje o tempo deixa", podem, agora)}
        {grupo(TITULO_CUIDADO, comCuidado, agora)}
        {grupo("Hoje não", naoPodem, agora)}
      </>
    );
  };

  return <div className="folha">{miolo()}</div>;
}

/** 🟠 O TÍTULO DO GRUPO DO MEIO, E ELE ESTÁ PENDENTE DA PALAVRA DELE.
 *
 *  O que está aqui é **MONTAGEM**: duas palavras da fala dele de 2026-09-10
 *  (*"com chuva dá pra ir sim, com cuidado"*), recombinadas — não há sílaba
 *  minha. Mas ele escolheu a ESTRUTURA ("um terceiro grupo no meio"), não este
 *  nome: a opção que ele leu dizia, com todas as letras, *"preciso do NOME
 *  dele, e nome é sua palavra"*, e o desenho da opção mostrava `???` no lugar
 *  do título.
 *
 *  🔴 **NÃO SUBIU AO AR COM ESTE VALOR, e não pode subir sem ele citar a
 *  frase.** Prosa minha já foi publicada uma vez neste projeto assinada como a
 *  voz dele, por seis dias, porque quem escreveu o texto foi quem removeu a
 *  trava — ver `docs/RESUME.md` e a memória `trava-removida-por-quem-escreveu`.
 *  *"Pode seguir"* nunca foi *"li e aprovei"*.
 *
 *  Os outros dois títulos ("Hoje o tempo deixa" / "Hoje não") são anteriores a
 *  esta rodada e não estão em questão aqui. */
const TITULO_CUIDADO = "Dá, com cuidado";

/** Devolver `null` pra lista vazia é o que faz o cabeçalho sumir junto com o
 *  grupo que o filtro esvaziou — o cabeçalho é uma AFIRMAÇÃO sobre o que está
 *  embaixo dele, e sem nada embaixo ele mente. Teste: "grupo esvaziado pelo
 *  filtro perde o cabeçalho". */
function grupo(titulo: string, lista: ParFolha[], agora: number | null) {
  if (lista.length === 0) return null;
  return (
    <>
      <div className="grupo-k">{titulo}</div>
      <div className="cartoes">
        {lista.map((p) => (
          <CartaoTrilha key={p.ficha.slug} ficha={p.ficha} inicial={p.leitura} agora={agora} />
        ))}
      </div>
    </>
  );
}
