import "./ficha.css";
import "./home.css";
import { getFichasComCondicao } from "@/lib/ficha";
import { resolverEstados, type LeituraCarimbo } from "@/lib/carimbo-estado";
import type { Ficha } from "@/types/ficha";
import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";
import CartaoTrilha from "./CartaoTrilha";
import MapaHome from "./MapaHome";

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

  // O par ficha+leitura só existe se a leitura existir: `resolverEstados`
  // devolve uma entrada por ficha hoje, mas fazer o TIPO provar isso — em vez
  // de um `.get(...)!` afirmando o que o filtro logo abaixo não garante — é o
  // que impede um `undefined` de estourar no portão se um dia essa premissa
  // parar de valer.
  const comLeitura: { ficha: Ficha; leitura: LeituraCarimbo }[] = fichas.flatMap((f) => {
    const leitura = leituras.get(f.slug);
    return leitura ? [{ ficha: f, leitura }] : [];
  });

  const podem = comLeitura.filter((x) => x.leitura.estado === "fresco");
  const naoPodem = comLeitura.filter((x) => x.leitura.estado !== "fresco");

  const grupo = (titulo: string, lista: typeof comLeitura) =>
    lista.length === 0 ? null : (
      <>
        <div className="grupo-k">{titulo}</div>
        <div className="cartoes">
          {lista.map((x) => (
            <CartaoTrilha key={x.ficha.slug} ficha={x.ficha} inicial={x.leitura} />
          ))}
        </div>
      </>
    );

  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <MapaHome fichas={fichas} leituras={leituras} />
        <div className="folha">
          {grupo("Hoje o tempo deixa", podem)}
          {grupo("Hoje não", naoPodem)}
        </div>
        <BarraNavegacao aqui="hoje" />
      </div>
    </main>
  );
}
