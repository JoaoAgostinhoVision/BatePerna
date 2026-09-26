import Link from "next/link";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { marcaAgora } from "./marca-agora";

// PENDENTE: redação minha, o João ainda não leu
const RODAPE_LISTA = "Toque num lugar pra ver e mudar o que o app diz dele.";

type Props = {
  fichas: Ficha[];
  leituras: Record<string, LeituraCarimbo>;
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
 *  ele promete, e a promessa quebrada é do app. */
export default function ListaDeLugares({ fichas, leituras, agora }: Props) {
  return (
    <>
      <ul className="adm-lista">
        {fichas.map((f) => {
          const leitura = leituras[f.slug];
          return (
            <li key={f.slug} className="adm-item" data-lugar={f.slug}>
              <Link href={`/admin/${f.slug}`} className="adm-item-link">
                <span className="adm-item-nome">{f.trajeto.waypoints[0].nome}</span>
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
