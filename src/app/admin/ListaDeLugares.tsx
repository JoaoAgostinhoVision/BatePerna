import Link from "next/link";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { marcaAgora } from "./marca-agora";
import { ESCONDIDO } from "./campos/palavras";

// PENDENTE: redação minha, o João ainda não leu
const RODAPE_LISTA = "Toque num lugar pra ver e mudar o que o app diz dele.";

type Props = {
  fichas: Ficha[];
  leituras: Record<string, LeituraCarimbo>;
  /** Os slugs ESCONDIDOS do público (Task 9). Obrigatório de propósito: quem
   *  monta a lista tem de dizer quais estão escondidos, e uma página que
   *  esquecesse não compila — em vez de mostrar todos como se estivessem no ar. */
  ocultos: ReadonlySet<string>;
  agora: number;
};

/** A lista do painel (Task 5, 2026-09-25): um item por lugar do acervo, cada
 *  um levando pro seu PRÓPRIO `/admin/<slug>` — nunca pro de outro. Tocar na
 *  Pedra Furada e cair na Rampa seria editar a voz de um lugar achando que é a
 *  de outro, a pior coisa que este painel pode fazer.
 *
 *  A marca ao lado do nome é `marcaAgora` — a MESMA pipeline que o painel do
 *  lugar (`PainelAdmin`) usa, nunca uma cópia: string fixa aqui seria a voz de
 *  um lugar virando a língua dos três, a espécie que este app já pagou quatro
 *  vezes (a última em `severidade.ts`, 16/09).
 *
 *  🔴 SEM O "+ lugar novo" da maquete que o João aprovou: criar ficha é rodada
 *  futura (spec §6), e um botão que não abre nada é pior que nenhum botão —
 *  ele promete, e a promessa quebrada é do app.
 *
 *  🔴 O LUGAR ESCONDIDO ESTÁ NA LISTA, MARCADO (Task 9, 2026-10-01). Esconder
 *  tira do PÚBLICO, não do dono: sem ele aqui, não haveria caminho pela tela
 *  até o botão de mostrá-lo de novo. Quem entrega o escondido é a página
 *  (`getAcervoDoDono`); este componente só marca o que recebe. */
export default function ListaDeLugares({ fichas, leituras, ocultos, agora }: Props) {
  return (
    <>
      <ul className="adm-lista">
        {fichas.map((f) => {
          const leitura = leituras[f.slug];
          return (
            <li key={f.slug} className="adm-item" data-lugar={f.slug} data-testid={`lugar-${f.slug}`}>
              <Link href={`/admin/${f.slug}`} className="adm-item-link">
                <span className="adm-item-nome">{f.trajeto.waypoints[0].nome}</span>
                {ocultos.has(f.slug) && <span className="adm-marca-escondido">{ESCONDIDO}</span>}
                {leitura && <span className="adm-item-marca">{marcaAgora(f, leitura, agora)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="adm-lista-rodape">{RODAPE_LISTA}</p>
    </>
  );
}
