import "./ficha.css";
import "./home.css";
import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";
import ListaDoAcervo from "./ListaDoAcervo";
import { getAllFichas } from "@/lib/ficha";

// Sem isto, o `next build` prerenderiza `/_not-found` estaticamente — e nesse
// momento não há request, não há instância quente, e o banco pode estar fora
// do alcance: o `getAllFichas` abaixo quebra o BUILD, não uma visita. As outras
// páginas que leem o banco (`page.tsx`, `trilhas/page.tsx`, `[slug]/page.tsx`,
// `admin/page.tsx`) já têm este mesmo `force-dynamic`; esta ficou de fora
// porque nasceu antes do banco (2026-09-11) e ninguém a revisitou quando a
// leitura mudou de disco pra banco (2026-09-25).
export const dynamic = "force-dynamic";

/** O QUE APARECE QUANDO O ENDEREÇO NÃO EXISTE.
 *
 *  🔴 POR QUE ISTO EXISTE (2026-09-11). Sem este arquivo, um slug errado caía
 *  no 404 padrão do Next: **"This page could not be found"** — em inglês, fora
 *  da moldura do app, sem uma única porta de volta. Em standalone não há barra
 *  de URL, então aquilo é um BECO: não dá nem pra digitar outro endereço.
 *
 *  É o mesmo beco que o aquecimento do service worker fechou algumas horas
 *  antes, por outra causa (lá era a rede, aqui é o endereço) — e a resposta é a
 *  mesma que `planoDaRaiz` já dava: *"o acervo é a versão honesta da home
 *  quando não há clima pra ler: mostra o que existe e não finge veredito"*.
 *  Quem tocou num link de trilha quer uma trilha; a resposta útil é mostrar as
 *  que existem.
 *
 *  E ficou mais provável de ser alcançado hoje mesmo: os links das fichas
 *  passaram a mandar cartão próprio no WhatsApp, então eles vão circular — e
 *  link circulando é link que sobrevive a uma ficha mudar de nome.
 *
 *  ⚠️ A FRASE NÃO AFIRMA NADA SOBRE LUGAR NENHUM. Diz só o que o app fez:
 *  procurou e não achou. "Essa trilha não existe" seria uma afirmação sobre o
 *  mundo — o endereço pode ter mudado, e quem sabe disso não é esta tela.
 *
 *  A barra de baixo fica, e é ela que garante a saída mesmo se a lista um dia
 *  estiver vazia. */
export default async function NaoAchei() {
  // O acervo vem do BANCO e desce por prop — ver o comentário do
  // `ListaDoAcervo`.
  //
  // ⚠️ E ESTA LEITURA VEM ANTES DO JSX: com o banco fora **e sem cópia em
  // memória** (instância fria — a condição exata que o `buscarFichas` escreve),
  // esta tela cai junto, e a saída passa a ser a barra do `error.tsx` (que tem a
  // mesma `BarraNavegacao` e um "Tentar de novo"). Com a instância quente o
  // `buscarFichas` serve a última leitura boa e esta tela continua de pé, com a
  // lista de antes. A garantia da barra daqui, escrita acima, é pro caso de a
  // lista vir VAZIA — não pro caso de a leitura falhar.
  const fichas = await getAllFichas();
  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <p className="nao-achei">Não achei essa trilha.</p>
        <ListaDoAcervo titulo="Todas as trilhas" fichas={fichas} />
        <BarraNavegacao aqui="trilhas" />
      </div>
    </main>
  );
}
