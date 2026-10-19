import MapinhaDoPonto from "./MapinhaDoPonto";
import { PULADA, SEM_RESPOSTA } from "./campos/palavras";
import type { LinhaDaRevisao } from "./novo/revisao";

/** A REVISÃO ANTES DE PUBLICAR (17/10, Task 8) — componente de SERVIDOR: toda
 *  pergunta da tela, uma por linha, cada uma com o "Corrigir" que leva a ELA
 *  (`ROTAS[onde].corrigir`, que volta à revisão). Fica acima da
 *  `TelaDePublicar`, que é de cliente e só tem o botão, o aviso e o que o app
 *  vai calar.
 *
 *  Obrigatória sem resposta é `falta` (destacada, com `SEM_RESPOSTA`); opcional
 *  sem resposta é `pulada` (`PULADA`). O ponto é mapinha, nunca número. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const TITULO_REVISAO = "Confira tudo antes de publicar:";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Palavra dele de 17/10.
export const CORRIGIR = "Corrigir";

export default function RevisaoDoLugar({ linhas }: { linhas: readonly LinhaDaRevisao[] }) {
  return (
    <section className="adm-revisao" data-testid="revisao">
      <p className="adm-publicar-titulo">{TITULO_REVISAO}</p>
      <ul className="adm-revisao-linhas">
        {linhas.map((l) => (
          <li key={l.caminho} className="adm-revisao-linha" data-caminho={l.caminho} data-estado={l.estado}>
            <p className="adm-revisao-pergunta">{l.pergunta}</p>
            {l.ponto ? (
              <MapinhaDoPonto lat={l.ponto.lat} lng={l.ponto.lng} />
            ) : (
              // Uma resposta pode ter várias linhas (o horário diferente: um grupo
              // por linha); cada uma ganha o seu parágrafo.
              (l.resposta ?? (l.estado === "falta" ? SEM_RESPOSTA : PULADA)).split("\n").map((t, i) => (
                <p key={i} className="adm-revisao-resposta">
                  {t}
                </p>
              ))
            )}
            {l.aviso && (
              <p className="adm-aviso-par" role="status">
                {l.aviso}
              </p>
            )}
            <a className="adm-revisao-corrigir" href={l.corrigir}>
              {CORRIGIR}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
