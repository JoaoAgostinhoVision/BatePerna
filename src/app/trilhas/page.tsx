import "../ficha.css";
import "../home.css";
import Appbar from "../Appbar";
import BarraNavegacao from "../BarraNavegacao";
import ListaDoAcervo from "../ListaDoAcervo";

export const dynamic = "force-dynamic";

/** O acervo: TUDO o que existe, sem carimbo, feito pra navegar e descobrir.
 *
 *  Não é a home com outro nome — são perguntas diferentes. A home responde "o
 *  que dá pra fazer hoje" e só mostra o que tem veredito de clima; aqui a
 *  pergunta é "o que existe", e a resposta não muda com a chuva.
 *
 *  🔴 E POR ISSO OS FATOS DAQUI SÃO OS PERMANENTES (2026-09-11). Até hoje a
 *  lista mostrava nome, etiqueta e promessa — e mais nada. Piso, preço e
 *  **quando o lugar abre** existiam na ficha e no cartão da home, e sumiam
 *  justamente na tela cujo trabalho é responder "o que existe".
 *
 *  O caso que doía: a Rampa do Pepê só abre sábado e domingo, e a única forma
 *  de descobrir isso era abrir a ficha **num dia em que ela estivesse
 *  fechada**. Num sábado, o carimbo diz "Pode ir" e o regime do lugar não
 *  aparecia em lugar nenhum.
 *
 *  ⚠️ CARIMBO CONTINUA FORA, e é o desenho: a resposta desta tela não muda com
 *  a chuva. Quem mostra veredito é a home.
 *
 *  A montagem vem de `fatosDaTrilha` — a MESMA do cartão da home, inclusive a
 *  marcação de Nível B. Duas telas classificando o mesmo campo por conta
 *  própria é a família de defeito que este projeto já pagou três vezes.
 *
 *  Sem distância: server component, e a pergunta aqui não é "o que está perto".
 *  Ausente é silêncio, a régua de sempre. */
export default function Trilhas() {
  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <ListaDoAcervo titulo="Todas as trilhas" />
        <BarraNavegacao aqui="trilhas" />
      </div>
    </main>
  );
}
