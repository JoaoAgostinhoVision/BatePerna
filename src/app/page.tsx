import "./ficha.css";
import "./home.css";
import { getFichasComCondicao } from "@/lib/ficha";
import { resolverEstados } from "@/lib/carimbo-estado";
import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";
import CartaoTrilha from "./CartaoTrilha";

// Compute-on-load: o veredito é a chuva de agora. Página estática congelaria
// `calculadoEm` no build e TODO visitante receberia carimbo já vencido.
export const dynamic = "force-dynamic";

/** A home: "o que dá pra fazer hoje".
 *
 *  Antes daqui saía um redirect pra última ficha aberta. Virou tela porque um
 *  app de uma trilha não precisa escolher, e um app de trilhas precisa.
 *
 *  Os dois grupos não são o acervo voltando pra tela: são a MESMA pergunta com
 *  as duas respostas. Sem o segundo, o primeiro sábado de chuva devolveria uma
 *  home em branco — que é a tela que menos ajuda a decidir. */
export default async function Home() {
  const fichas = getFichasComCondicao();
  const leituras = await resolverEstados(fichas);

  const podem = fichas.filter((f) => leituras.get(f.slug)?.estado === "fresco");
  const naoPodem = fichas.filter((f) => leituras.get(f.slug)?.estado !== "fresco");

  const grupo = (titulo: string, lista: typeof fichas) =>
    lista.length === 0 ? null : (
      <>
        <div className="grupo-k">{titulo}</div>
        <div className="cartoes">
          {lista.map((f) => (
            <CartaoTrilha key={f.slug} ficha={f} leitura={leituras.get(f.slug)!} />
          ))}
        </div>
      </>
    );

  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <div className="folha">
          {grupo("Hoje o tempo deixa", podem)}
          {grupo("Hoje não", naoPodem)}
        </div>
        <BarraNavegacao aqui="hoje" />
      </div>
    </main>
  );
}
