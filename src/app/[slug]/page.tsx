import "../ficha.css";
import { getFicha } from "@/lib/ficha";
import { fetchPrecip } from "@/lib/weather";
import { avaliar, type Estado } from "@/lib/motor";
import { notFound } from "next/navigation";
import ConfirmarFui from "../ConfirmarFui";
import MapaEstatico from "../MapaEstatico";
import DistanciaDaqui from "../DistanciaDaqui";
import Appbar from "../Appbar";
import Carimbo from "../Carimbo";
import LembrarUltima from "../LembrarUltima";

// Compute-on-load: nada de cache estático, o estado é a chuva de agora.
export const dynamic = "force-dynamic";

type Render = { state: Estado; erro: boolean; calculadoEm: number };

async function resolverEstado(
  ficha: NonNullable<ReturnType<typeof getFicha>>,
  debug: string | undefined,
): Promise<Render> {
  const agora = Math.floor(Date.now() / 1000);
  if (debug === "fresco" || debug === "frio") return { state: debug, erro: false, calculadoEm: agora };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    return { state: avaliar(regra, precips, agora), erro: false, calculadoEm: agora };
  } catch {
    // Sem leitura de chuva → lado seguro: "não suba", e diz a verdade (não finge verde).
    return { state: "frio", erro: true, calculadoEm: agora };
  }
}

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
  const { state, erro, calculadoEm } = await resolverEstado(ficha, debug);

  const wp = ficha.trajeto.waypoints[0];
  const pass = ficha.condicao.regra.janela_passado_horas;
  const fut = ficha.condicao.regra.janela_previsao_horas;

  // Chip/ticket derivados do custo (dado real).
  const precoCurto = ficha.custo.valor?.match(/R\$\s?\d+/)?.[0] ?? "Pago";
  const restoCusto = ficha.custo.valor?.replace(precoCurto, "").replace(/^\s*[·-]?\s*/, "").trim();

  // Ressalva: negrito na primeira oração (até o travessão).
  const [ressalvaLead, ...ressalvaResto] = ficha.condicao.ressalva_proxy.split("—");
  const mapa = `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`;

  return (
    <main className="bp" data-state={state}>
      <LembrarUltima slug={slug} />
      <div className="screen">
        <Appbar chip={ficha.custo.tag === "pago" ? `${precoCurto} · portão` : undefined} />

        <div className="hero">
          <span className="scan">{ficha.rotulo_escaneio}</span>
          <h1>{wp.nome}</h1>
          <p className="promessa">{ficha.promessa}</p>

          <Carimbo estado={state} erro={erro} calculadoEm={calculadoEm} pass={pass} fut={fut} />
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

          <div className="sec">
            <div className="k">📍 Trajeto</div>
            <div className="waypoint">
              <MapaEstatico lat={wp.lat} lng={wp.lng} nome={wp.nome} estado={state} />
              <div className="wp-body">
                <div>
                  <div className="t">{wp.nome}</div>
                  {wp.nota && <div className="n">{wp.nota}</div>}
                  <div className="coord">{wp.lat}, {wp.lng}</div>
                  <DistanciaDaqui lat={wp.lat} lng={wp.lng} />
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
    </main>
  );
}
