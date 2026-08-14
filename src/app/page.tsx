import "./ficha.css";
import "./home.css";
import { getFichasComCondicao } from "@/lib/ficha";
import { resolverEstados, type LeituraCarimbo } from "@/lib/carimbo-estado";
import type { Ficha } from "@/types/ficha";
import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";
import FolhaTrilhas from "./FolhaTrilhas";
import HomeViva from "./HomeViva";
import LocalVivo from "./local";
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

  // Ordem FIXA da folha: fresco primeiro, decidida uma vez pela classificação
  // com que a página nasceu no servidor. A `FolhaTrilhas` (client) é quem
  // decide, a cada leitura nova, SE agrupa — mas não reordena: ver o
  // comentário lá sobre por que um cartão não pode pular de lugar na tela.
  const pares = [
    ...comLeitura.filter((x) => x.leitura.estado === "fresco"),
    ...comLeitura.filter((x) => x.leitura.estado !== "fresco"),
  ];

  return (
    <main className="bp">
      <LocalVivo>
        <HomeViva inicial={Object.fromEntries(leituras)}>
          <div className="screen">
            <Appbar comSaida={false} />
            <MapaHome fichas={fichas} leituras={Object.fromEntries(leituras)} />
            <div className="folha">
              <FolhaTrilhas pares={pares} />
            </div>
            <BarraNavegacao aqui="hoje" />
          </div>
        </HomeViva>
      </LocalVivo>
    </main>
  );
}
