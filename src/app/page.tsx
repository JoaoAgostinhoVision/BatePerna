import "./ficha.css";
import "./home.css";
import { getFichasComCondicao } from "@/lib/ficha";
import { resolverEstados, type LeituraCarimbo } from "@/lib/carimbo-estado";
import { fechadoPeloDono } from "@/lib/aviso";
import type { Ficha } from "@/types/ficha";
import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";
import FiltrosVivos from "./filtros";
import HomeViva from "./HomeViva";
import LocalVivo from "./local";
import MioloHome from "./MioloHome";

// Compute-on-load: o veredito é a chuva de agora — e, desde 2026-09-15, a
// palavra do dono de agora também. Página estática congelaria `calculadoEm` no
// build e TODO visitante receberia carimbo já vencido; e congelaria junto um
// aviso publicado depois do build, que é a coisa que ele acabou de escrever
// justamente porque é urgente.
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

  // Ordem FIXA da folha: quem dá pra ir primeiro, decidida uma vez pela
  // classificação com que a página nasceu no servidor. "Dá pra ir" é fresco E
  // não fechado pelo dono — o servidor não tem relógio de tela (a ordem nunca
  // prometeu calendário), mas o aviso ele TEM, na mesma `leitura` que vai pro
  // cliente: um lugar seco em reforma não é "fresco primeiro". O `MioloHome`
  // (client) é quem decide, a cada leitura nova, o que aparece e SE agrupa —
  // mas não reordena: ver o comentário da folha sobre por que um cartão não
  // pode pular de lugar na tela.
  // O relógio vai `null`: o aviso acabou de sair de `avisosVigentes`, que já
  // comparou `vence_em > agora` em SQL neste mesmo instante — vale como chegou.
  const daPraIr = (x: { leitura: LeituraCarimbo }) =>
    x.leitura.estado === "fresco" && !fechadoPeloDono(x.leitura.aviso, null);
  const pares = [...comLeitura.filter(daPraIr), ...comLeitura.filter((x) => !daPraIr(x))];

  return (
    <main className="bp">
      <LocalVivo>
        {/* Os recortes envolvem a tela inteira porque quem RESUME (a linha de
            filtro) e quem APLICA (a folha) são elementos distantes no DOM. */}
        <FiltrosVivos>
          <HomeViva inicial={Object.fromEntries(leituras)}>
            <div className="screen">
              <Appbar comSaida={false} />
              {/* 🔴 O mapa, a linha de filtro e a folha saem os TRÊS de dentro
                  do `MioloHome`, que recorta uma vez e usa o MESMO `visiveis`
                  pros três. Renderizá-los como irmãos aqui é literalmente o
                  defeito que esta rodada consertou: o mapa recebia o acervo
                  inteiro enquanto a folha desenhava o recorte, e a tela
                  mostrava 3 pins, 1 cartão e dois números que se
                  contradiziam. */}
              <MioloHome pares={pares} />
              <BarraNavegacao aqui="hoje" />
            </div>
          </HomeViva>
        </FiltrosVivos>
      </LocalVivo>
    </main>
  );
}
