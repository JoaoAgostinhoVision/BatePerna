import "../ficha.css";
import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";
import { rotuloPiso } from "@/lib/piso";
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

        <div className="body">
          <div className="sec premio">
            <div className="k">O prêmio</div>
            <p>{ficha.premio}</p>
          </div>

          <div className="voz">
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
                <div>
                  <div className="t">{wp.nome}</div>
                  {wp.nota && <div className="n">{wp.nota}</div>}
                  <div className="coord">{wp.lat}, {wp.lng}</div>
                  {fatosDaVia.length > 0 && <div className="fatos">{fatosDaVia.join(" · ")}</div>}
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

          <div className="sec">
            <div className="k">🚗 Acesso</div>
            <div className="note"><span className="ic">🚗</span><p>{ficha.acesso}</p></div>
          </div>

          <div className="sec">
            <div className="k">⚠ Avisos</div>
            <div className="note"><span className="ic">⚠</span><p>{ficha.avisos}</p></div>
          </div>
        </div>

        <div className="gate">
          <div className="k">{tituloGate}</div>
          <div className="read">{ficha.discriminador.como_ler}</div>
          <div className="perm">“{ficha.discriminador.permissao_abortar}”</div>
        </div>

        {ficha.custo.valor && (
          <div className="ticket">
            <span className="price">{precoCurto}</span> {restoCusto}
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
