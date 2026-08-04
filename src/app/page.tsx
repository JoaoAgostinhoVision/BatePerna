import "./ficha.css";
import { getFicha } from "@/lib/ficha";
import { fetchPrecip } from "@/lib/weather";
import { avaliar, type Estado } from "@/lib/motor";
import ConfirmarFui from "./ConfirmarFui";

// Compute-on-load: nada de cache estático, o estado é a chuva de agora.
export const dynamic = "force-dynamic";

const SLUG = "rampa-do-pepe";

type Render = { state: Estado; erro: boolean };

async function resolverEstado(
  ficha: NonNullable<ReturnType<typeof getFicha>>,
  debug: string | undefined,
): Promise<Render> {
  if (debug === "fresco" || debug === "frio") return { state: debug, erro: false };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    const agora = Math.floor(Date.now() / 1000);
    return { state: avaliar(regra, precips, agora), erro: false };
  } catch {
    // Sem leitura de chuva → lado seguro: "não suba", e diz a verdade (não finge verde).
    return { state: "frio", erro: true };
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const ficha = getFicha(SLUG);
  if (!ficha) {
    return (
      <main className="bp">
        <div className="screen">
          <div className="foot">Ficha “{SLUG}” não encontrada.</div>
        </div>
      </main>
    );
  }

  const { debug } = await searchParams;
  const { state, erro } = await resolverEstado(ficha, debug);

  const wp = ficha.trajeto.waypoints[0];
  const pass = ficha.condicao.regra.janela_passado_horas;
  const fut = ficha.condicao.regra.janela_previsao_horas;

  // Chip/ticket derivados do custo (dado real).
  const precoCurto = ficha.custo.valor?.match(/R\$\s?\d+/)?.[0] ?? "Pago";
  const restoCusto = ficha.custo.valor?.replace(precoCurto, "").replace(/^\s*[·-]?\s*/, "").trim();

  // Ressalva: negrito na primeira oração (até o travessão).
  const [ressalvaLead, ...ressalvaResto] = ficha.condicao.ressalva_proxy.split("—");
  const mapa = `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`;

  const carimbo =
    state === "fresco"
      ? { mark: "Pode subir", sub: "seco · carro comum" }
      : erro
        ? { mark: "Não suba", sub: "sem leitura · cheque no portão" }
        : { mark: "Não suba", sub: "barro · dá um tempo" };

  return (
    <main className="bp" data-state={state}>
      <div className="screen">
        <div className="appbar">
          <div className="brand"><span className="mk">🥾</span> BatePerna</div>
          {ficha.custo.tag === "pago" && (
            <span className="cost-chip">{precoCurto} · portão</span>
          )}
        </div>

        <div className="hero">
          <span className="scan">{ficha.rotulo_escaneio}</span>
          <h1>{wp.nome}</h1>
          <p className="promessa">{ficha.promessa}</p>

          <div className="decision" role="status" aria-live="polite">
            <div className="stamp">
              <div className="mark">{carimbo.mark}</div>
              <div className="sub">{carimbo.sub}</div>
            </div>
            <p className="reason">
              {erro ? (
                <>Não deu pra ler a chuva agora. Na dúvida, <b>não suba</b> — cheque o barro no portão.</>
              ) : state === "fresco" ? (
                <>Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>. Área alta, escorre rápido — a serra firmou.</>
              ) : (
                <>Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>). O barro segura água — risco de atolar.</>
              )}
            </p>
            <div className="live">
              <span className="pulse"></span>
              <span>lido da chuva agora · {pass}h atrás + {fut}h à frente</span>
            </div>
          </div>
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
              <div className="wp-map" aria-hidden="true"><span className="wp-pin">📍</span></div>
              <div className="wp-body">
                <div>
                  <div className="t">{wp.nome}</div>
                  {wp.nota && <div className="n">{wp.nota}</div>}
                  <div className="coord">{wp.lat}, {wp.lng}</div>
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

        <ConfirmarFui slug={SLUG} />

        <div className="foot">BatePerna · Agreste · PE</div>
      </div>
    </main>
  );
}
