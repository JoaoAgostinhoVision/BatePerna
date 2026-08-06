import "../ficha.css";
import { getAllFichas } from "@/lib/ficha";

export const dynamic = "force-dynamic";

/** A lista é crua de propósito: sem carimbo, sem filtro. Carimbo aqui seria
 *  uma chamada ao Open-Meteo por trilha a cada abertura — isso é a home rica,
 *  sub-projeto 2. Esta tela é andaime, feita pra ser descartada, não refatorada. */
export default function Trilhas() {
  const fichas = getAllFichas();
  return (
    <main className="bp">
      <div className="screen">
        <div className="appbar">
          <div className="brand"><span className="mk">🥾</span> BatePerna</div>
        </div>
        <div className="lista">
          <div className="lista-k">Trilhas</div>
          {fichas.map((f) => (
            <a key={f.slug} className="lista-item" href={`/${f.slug}`}>
              <span className="scan">{f.rotulo_escaneio}</span>
              <span className="lista-t">{f.trajeto.waypoints[0].nome}</span>
              <span className="lista-p">{f.promessa}</span>
            </a>
          ))}
        </div>
        <div className="foot">BatePerna · Agreste · PE</div>
      </div>
    </main>
  );
}
