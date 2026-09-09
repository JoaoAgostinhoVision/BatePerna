import "../ficha.css";
import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";
import { rotuloPiso } from "@/lib/piso";
import { rotuloHora } from "@/lib/horario";
import { notFound } from "next/navigation";
import ConfirmarFui from "../ConfirmarFui";
import MapaEstatico from "../MapaEstatico";
import DistanciaDaqui from "../DistanciaDaqui";
import Appbar from "../Appbar";
import Carimbo from "../Carimbo";
import LocalVivo from "../local";
import Moldura from "../Moldura";

// Compute-on-load: nada de cache estático, o estado é a chuva de agora.
export const dynamic = "force-dynamic";

export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const { slug } = await params;
  const ficha = getFicha(slug);
  if (!ficha) notFound();

  const { debug } = await searchParams;
  const { estado, erro, calculadoEm } = await resolverEstado(ficha, debug);

  const wp = ficha.trajeto.waypoints[0];
  const pass = ficha.condicao.regra.janela_passado_horas;
  const fut = ficha.condicao.regra.janela_previsao_horas;

  // Chip/ticket derivados do custo (dado real).
  // 🔴 OS CENTAVOS SÃO PARTE DO RECORTE, e ficaram de fora até 2026-08-27.
  // MEDIDO com uma ficha de ensaio cobrando `R$ 12,50`: o regex antigo
  // (`/R\$\s?\d+/`) casava só `R$ 12` e o chip do topo **anunciava um preço
  // menor do que o lugar cobra**. Passou despercebido porque a única ficha paga
  // do acervo cobra R$ 5 redondos. Errar pra menos em dinheiro é a família das
  // outras mentiras deste app, com a agulha em outro lugar.
  const precoCurto = ficha.custo.valor?.match(/R\$\s?\d+(?:[.,]\d{2})?/)?.[0] ?? "Pago";
  const restoCusto = ficha.custo.valor?.replace(precoCurto, "").replace(/^\s*[·-]?\s*/, "").trim();

  // 🔴 O chip vem da FICHA, não daqui. Ele era `${precoCurto} · portão`, com o
  // "portão" escrito à mão: verdade na Rampa e invenção em qualquer trilha paga
  // que cobre de outro jeito. Sem `curto`, mostra só o preço — o app cala sobre
  // ONDE se paga em vez de supor. Ver `custo.curto` em `src/types/ficha.ts`.
  const chipCusto = ficha.custo.tag === "pago" ? (ficha.custo.curto ?? precoCurto) : undefined;

  // O fato do LUGAR que o cartão da home já mostra, agora também aqui, dentro
  // do bloco Trajeto: que piso tem a via. Formatado pela MESMA função do
  // cartão (`rotuloPiso`) — formatar de novo aqui seria a mesma trilha com
  // duas caras, que foi exatamente o defeito dos "dois km".
  //
  // A extensão (`ficha.extensaoKm`) saiu desta lista por decisão do João em
  // 2026-08-23: "remova o filtro tamanho da trilha, acho que não está para
  // hoje". O campo saiu do schema na contração da mesma rodada (Task 7) —
  // não existe mais nada aqui pra esta tela ler.
  //
  // Campo ausente não vira "—" nem "não informado": ele some da lista, e se
  // nada sobrar a linha inteira não é desenhada (o `.filter(Boolean)` mais o
  // guarda lá embaixo). Sem o guarda, com um único item a lista continua
  // sendo uma LISTA — a razão está medida na Task 7 da rodada passada: com
  // elementos separados em vez de lista, tirar o guarda faria
  // `rotuloPiso(undefined)` ESTOURAR, e "quebrou" não é o mesmo que "não
  // mostrou linha vazia".
  const fatosDaVia = [
    ficha.piso ? rotuloPiso(ficha.piso) : null,
  ].filter(Boolean);

  // 🔴 O título do bloco de checagem PAROU DE SUPOR PORTÃO (decisão dele,
  // 2026-09-09: "5 pode ligar"). Era `Na entrada — a checagem é sua`, fixo,
  // escrito na era da Rampa — onde o que decide é mesmo a entrada. Na 3ª ficha
  // (Véu de Noiva) o que decide é o **trecho de terra, antes**: a própria ficha
  // já diz "Confirme no caminho" e "No trecho de terra". Texto fixo sobre UM
  // lugar num componente que serve TODOS, pela enésima vez.
  //
  // O campo que resolve já existia e não tinha UM leitor no `src/`:
  // `discriminador.formato` ("entrada" · "estrada" · "trecho de terra").
  //
  // 🔴 E o desenho da frase é load-bearing: o `formato` entra SOZINHO, sem
  // preposição. "entrada"/"estrada" pedem "na", "trecho de terra" pede "no" —
  // derivar gênero de string livre é gramática inventada, irmã da geografia
  // inventada. Aqui não há o que derivar, e `.gate .k` é uppercase no CSS,
  // então o resultado na tela nem carrega maiúscula pra acertar.
  //
  // `formato` é obrigatório no schema, mas string vazia passa: nesse caso a
  // linha não vira " — a checagem é sua" com travessão órfão. Cala a metade
  // que não sabe e mantém a que é do app.
  const formatoGate = ficha.discriminador.formato.trim();
  const tituloGate = formatoGate ? `${formatoGate} — a checagem é sua` : "A checagem é sua";

  // 🔴 O HORÁRIO GANHOU LUGAR NA TELA (2026-09-09, decisão dele: "preço e
  // horário brilham"). Até aqui ele só aparecia quando o lugar estava FECHADO —
  // a fase `fechado` escrevia "abre amanhã às 8h". Quem abrisse a ficha às 10h,
  // com tudo aberto, nunca ficava sabendo que fecha às 17h: o dado estava na
  // ficha e mudo na tela. Numa viagem de 120 km isso decide a ida.
  //
  // Montado de `rotuloHora` — a ÚNICA forma deste app de escrever hora (a
  // mesma do `horaCurtaRecife` e do carimbo fechado). Duas formas na mesma
  // tela seriam a mesma trilha com duas caras. Nenhuma palavra nova entra
  // aqui: é o dado dele, formatado pela função que já existia.
  const faixaHorario = ficha.horario
    ? `${rotuloHora(ficha.horario.abre)}–${rotuloHora(ficha.horario.fecha)}`
    : null;

  // Ressalva: negrito na primeira oração (até o travessão).
  const [ressalvaLead, ...ressalvaResto] = ficha.condicao.ressalva_proxy.split("—");
  const mapa = `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`;

  // A Moldura é o <main className="bp" data-state>: o estado começa no que o
  // servidor leu (primeiro paint pintado, sem JS) e o Carimbo o corrige se
  // trouxer uma leitura nova do portão. Tudo aqui dentro continua sendo
  // componente de servidor — children atravessa a fronteira sem virar JS.
  return (
    <Moldura estado={estado}>
      <div className="screen">
        <Appbar chip={chipCusto} />

        <div className="hero">
          <span className="scan">{ficha.rotulo_escaneio}</span>
          <h1>{wp.nome}</h1>
          <p className="promessa">{ficha.promessa}</p>

          <Carimbo
            estado={estado}
            erro={erro}
            calculadoEm={calculadoEm}
            pass={pass}
            fut={fut}
            slug={slug}
            secaRapido={ficha.secaRapido}
            piso={ficha.piso}
            horario={ficha.horario}
          />
        </div>

        <div className="caveat">
          <span className="ic">⚠</span>
          <span><b>{ressalvaLead.trim()}.</b> {ressalvaResto.join("—").trim()}</span>
        </div>

        {/* 🔴 `data-nivel="b"` — A PROCEDÊNCIA POR CONTRASTE (decisão L3 /
            REQ-12, construída em 2026-09-09).

            A régua, que é do modelo e não minha: **o Nível B brilha, o Nível A
            é texto plano, SEM ETIQUETA SIMÉTRICA**. Nível A é o que o mapa e o
            feed de chuva entregam igual pra qualquer um (coordenada, distância,
            a leitura da chuva); Nível B é o que só sabe quem foi — a voz, o
            acesso, os avisos, o piso, o que se olha no lugar.

            🔴 POR ISSO SÓ O B É MARCADO, e a assimetria é o desenho, não
            economia: marcar os dois lados criaria a etiqueta simétrica que a
            decisão recusa, e faria a coordenada parecer uma credencial. O
            Nível A não recebe regra nenhuma — ele já É o texto plano.

            O atributo (em vez de uma classe) segue o precedente do
            `data-bloco="trajeto"` logo abaixo: sem identidade endereçável, "o
            prêmio brilha" viraria "existe em algum lugar da página", e nenhum
            teste separaria as duas versões. */}
        <div className="body">
          <div className="sec premio" data-nivel="b">
            <div className="k">O prêmio</div>
            <p>{ficha.premio}</p>
          </div>

          {/* A voz já nasceu com o tratamento (serif itálico + régua de acento)
              — foi o app inventando esta linguagem por instinto, um ano antes
              de ela ter nome. O atributo aqui não muda um pixel: ele fecha a
              CLASSIFICAÇÃO, pra o guarda do acervo poder varrer "todo campo B
              está marcado" sem uma exceção escrita à mão. */}
          <div className="voz" data-nivel="b">
            “{ficha.voz}”
            <span className="who">— a voz de quem conhece</span>
          </div>

          {/* `data-bloco` não é enfeite: os três blocos abaixo são
              `<div className="sec">` idênticos, distinguidos só pelo texto do
              `.k` lá dentro, e sem uma identidade endereçável nenhum teste
              consegue dizer que o piso está DENTRO do Trajeto e não debaixo do
              Acesso. Dado de estrada aparecendo no bloco errado é o app
              dizendo outra coisa. */}
          <div className="sec" data-bloco="trajeto">
            <div className="k">📍 Trajeto</div>
            <div className="waypoint">
              {/* Sem prop de estado: a cor do pin vem do data-state da Moldura,
                  senão ele congelaria na leitura do servidor. */}
              <MapaEstatico lat={wp.lat} lng={wp.lng} nome={wp.nome} />
              <div className="wp-body">
                {/* 🔴 O BLOCO TRAJETO É O ÚNICO MISTO DA FICHA, e por isso a
                    marca desce pra FOLHA em vez de ficar no bloco. Dentro do
                    mesmo cartão convivem a coordenada e a distância (Nível A:
                    OSM e o GPS do celular dão iguais) com a nota do waypoint e
                    o piso (Nível B: só sabe quem dirigiu até lá). Marcar o
                    bloco inteiro faria a coordenada brilhar junto — o oposto
                    exato da decisão. */}
                <div>
                  <div className="t">{wp.nome}</div>
                  {wp.nota && <div className="n" data-nivel="b">{wp.nota}</div>}
                  <div className="coord">{wp.lat}, {wp.lng}</div>
                  {fatosDaVia.length > 0 && <div className="fatos" data-nivel="b">{fatosDaVia.join(" · ")}</div>}
                  {/* LocalVivo não desenha nenhum elemento (só Context.Provider
                      por baixo) — envolve só a distância porque é o único
                      consumidor da localização nesta página hoje. Mesma fonte
                      que o mapa da home: "uma pessoa, uma fonte". */}
                  <LocalVivo>
                    <DistanciaDaqui ficha={ficha} />
                  </LocalVivo>
                </div>
                <a className="maplink" href={mapa} target="_blank" rel="noopener">Abrir no mapa</a>
              </div>
            </div>
          </div>

          <div className="sec" data-nivel="b">
            <div className="k">🚗 Acesso</div>
            <div className="note"><span className="ic">🚗</span><p>{ficha.acesso}</p></div>
          </div>

          <div className="sec" data-nivel="b">
            <div className="k">⚠ Avisos</div>
            <div className="note"><span className="ic">⚠</span><p>{ficha.avisos}</p></div>
          </div>
        </div>

        {/* O bloco de checagem é a OUTRA linguagem que o app já tinha
            inventado sozinho: borda tracejada de caderno de campo. Como a voz,
            ele já brilhava antes de a régua existir — a marca só completa a
            classificação. A `.caveat` logo acima, ao contrário, NÃO leva marca
            nenhuma e é decisão dele (2026-09-09): ela não é A nem B, é o app
            admitindo que o Nível A dele falha, e já tem o destaque azul só
            dela. */}
        <div className="gate" data-nivel="b">
          <div className="k">{tituloGate}</div>
          <div className="read">{ficha.discriminador.como_ler}</div>
          <div className="perm">“{ficha.discriminador.permissao_abortar}”</div>
        </div>

        {/* 🔴 O TÍQUETE VIROU NÍVEL B, e não é óbvio por quê — decisão dele em
            2026-09-09: *"preço e horário brilham"*.

            Preço PARECE dado de catálogo, o tipo de coisa que qualquer site
            publica. Nesta ficha ele é o contrário disso: a web dizia **R$ 5**
            em mais de uma página, com cara de fato, e o preço certo (**R$ 10**)
            veio dele. Se o 🔵 tivesse virado campo, o app anunciaria metade do
            preço pra quem dirige 120 km — e nenhum teste pegaria. O horário é o
            mesmo caso.

            🔴 AS DUAS METADES SÃO INDEPENDENTES, e o acervo real prova as três
            combinações sem precisar de ficha sintética: a Rampa é **paga sem
            horário**, a Pedra Furada é **grátis com horário** (5h–17h) e a
            cachoeira tem **os dois**. Por isso o guarda é `valor || faixa`, e
            não `valor` — prender o horário ao preço o esconderia justamente na
            ficha grátis cujo portão fecha às 17h. Sem nenhum dos dois, a linha
            inteira não é desenhada: o app cala, como em todo campo opcional. */}
        {(ficha.custo.valor || faixaHorario) && (
          <div className="ticket" data-nivel="b">
            {ficha.custo.valor && (
              <span className="tk">
                <span className="price">{precoCurto}</span> {restoCusto}
              </span>
            )}
            {faixaHorario && <span className="tk hora">{faixaHorario}</span>}
          </div>
        )}

        <ConfirmarFui slug={slug} />

        {/* 🔴 "Agreste" SAIU em 2026-09-09. As duas primeiras fichas são do
            Agreste; Bonito é BREJO — palavra dele: "bonito é brejo", e o
            "espetáculo natural do brejo pernambucano" do `premio` é dele
            também. Texto fixo sobre região, no rodapé que serve TODAS.
            Escapou da varredura de 03/09 porque eu procurei material e relevo
            (barro, portão, subir, serra) e não REGIÃO.
            Das três saídas, esta é a única que é SUBTRAÇÃO: o app cala sobre a
            região em vez de afirmar uma que pode não ser a da ficha aberta. As
            outras duas (campo `regiao` por ficha; uma palavra que cubra as
            três) acrescentam afirmação, e essa escolha é dele. */}
        <div className="foot">BatePerna · PE</div>
      </div>
    </Moldura>
  );
}
