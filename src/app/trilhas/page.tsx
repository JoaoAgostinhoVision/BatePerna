import "../ficha.css";
import "../home.css";
import { getAllFichas } from "@/lib/ficha";
import Appbar from "../Appbar";
import BarraNavegacao from "../BarraNavegacao";

export const dynamic = "force-dynamic";

/** O acervo: TUDO o que existe, sem carimbo, feito pra navegar e descobrir.
 *
 *  Não é a home com outro nome — são perguntas diferentes. A home responde "o
 *  que dá pra fazer hoje" e só mostra o que tem veredito de clima; aqui a
 *  pergunta é "o que existe", e a resposta não muda com a chuva. */
export default function Trilhas() {
  const fichas = getAllFichas();
  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <div className="lista">
          <div className="lista-k">Todas as trilhas</div>
          {fichas.map((f) => (
            <a key={f.slug} className="lista-item" href={`/${f.slug}`}>
              <span className="scan">{f.rotulo_escaneio}</span>
              <span className="lista-t">{f.trajeto.waypoints[0].nome}</span>
              <span className="lista-p">{f.promessa}</span>
            </a>
          ))}
        </div>
        <BarraNavegacao aqui="trilhas" />
      </div>
    </main>
  );
}
