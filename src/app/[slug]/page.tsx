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
  const precoCurto = ficha.custo.valor?.match(/R\$\s?\d+/)?.[0] ?? "Pago";
  const restoCusto = ficha.custo.valor?.replace(precoCurto, "").replace(/^\s*[·-]?\s*/, "").trim();

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
        <Appbar chip={ficha.custo.tag === "pago" ? `${precoCurto} · portão` : undefined} />

        <div className="hero">
          <span className="scan">{ficha.rotulo_escaneio}</span>
          <h1>{wp.nome}</h1>
          <p className="promessa">{ficha.promessa}</p>

          <Carimbo estado={estado} erro={erro} calculadoEm={calculadoEm} pass={pass} fut={fut} slug={slug} />
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
          <div className="k">Na entrada — a checagem é sua</div>
          <div className="read">{ficha.discriminador.como_ler}</div>
          <div className="perm">“{ficha.discriminador.permissao_abortar}”</div>
        </div>

        {ficha.custo.valor && (
          <div className="ticket">
            <span className="price">{precoCurto}</span> {restoCusto}
          </div>
        )}

        <ConfirmarFui slug={slug} />

        <div className="foot">BatePerna · Agreste · PE</div>
      </div>
    </Moldura>
  );
}
