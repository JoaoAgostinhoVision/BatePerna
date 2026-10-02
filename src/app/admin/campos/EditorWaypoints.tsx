"use client";
import { useState } from "react";
import { MapaDoPin } from "./EditorCoordenada";
import { usarGravacao } from "./gravar";
import { CAIXA_VAZIA, SALVANDO, SALVAR } from "./palavras";

/** A CADEIA DO TRAJETO, PELO CELULAR (Tarefa 10, C1 da auditoria do brief).
 *
 *  🔴 POR QUE ISTO EXISTE. O painel já editava TODO campo de TODO ponto que a
 *  ficha tem (`camposDaFicha` expande o molde `trajeto.waypoints[]`), mas não
 *  havia como CRIAR o segundo ponto: a cadeia só nasceria por semente — código,
 *  deploy, programador. É o contrário da lei do projeto (dado novo entra pelo
 *  APP). Este editor é a menor coisa que devolve essa autonomia ao dono.
 *
 *  🔴 DUAS AÇÕES, E SÓ DUAS:
 *   - ACRESCENTAR UM PONTO NO FIM: o botão abre o nome e o MESMO mapa do
 *     `EditorCoordenada` (`MapaDoPin`), com o pin começando no último ponto. O
 *     dono escreve o nome, POSICIONA o pin e confirma; o que vai pra porta é a
 *     posição do pin. 🔴 Até a onda de conserto 1 a coordenada era COPIADA do
 *     último ponto pela porta, e a ficha pública a imprimia como fato, com
 *     "Abrir no mapa" — na primeira etapa, em cima do próprio destino. Agora
 *     nenhuma coordenada é copiada em lugar nenhum: confirmar sem mexer o pin é o
 *     DONO afirmando aquela posição, e é aceito sem heurística de "igual à
 *     anterior" (que comeria o caso real de duas etapas no mesmo ponto).
 *   - TIRAR O ÚLTIMO, EM DOIS TOQUES (decisão do João, 2026-10-01): o primeiro
 *     troca o botão pela pergunta (`TIRAR_MESMO`), e só o segundo manda. O estado
 *     de "confirmar" é desta tela: recarregar desfaz. Só aparece com dois pontos
 *     ou mais — com um só, o único ponto é O LUGAR, e a tela nem oferece (a porta
 *     recusaria com 409). Nada se perde: a versão anterior fica no histórico.
 *
 *  🔴 NUNCA O PONTO 1, NUNCA NO MEIO. `waypoints[0]` é o lugar (o nome na home,
 *  o pin, a ordem, a distância); inserir antes dele ou tirá-lo trocaria o lugar
 *  pela primeira etapa do caminho em todas as telas.
 *
 *  🔴 O SERVIDOR CONTA, O EDITOR NÃO SABE O QUE É FICHA. `pontos`, o rótulo e a
 *  posição do último chegam por PROP, montados por `FichaInteira` — o mesmo
 *  contrato de `./tipos.ts`: nenhum editor importa `@/lib/campos-da-ficha`, que
 *  traria o zod pro celular. O `ultimo` é só ONDE O MAPA COMEÇA; ele só vira
 *  dado se o dono confirmar o pin ali. */

/** O nome da caixa do ponto novo. "O nome" é a palavra que o painel já usa pra
 *  essa folha de todo ponto (`ROTULO_DO_PONTO.nome`), e "ponto" é a que o
 *  trajeto usa. Vai como `aria-label`. */
// PENDENTE: redação minha, o João ainda não leu
export const NOME_DO_PONTO_NOVO = "O nome do ponto novo";

// PENDENTE: redação minha, o João ainda não leu
export const ACRESCENTAR_PONTO = "Acrescentar um ponto no fim do trajeto";

/** O pin começa no último ponto, e o dono precisa saber que é ELE quem diz onde
 *  o ponto novo fica — senão confirma sem olhar. Trocada na onda de conserto 1:
 *  a anterior ("nasce na coordenada do último; depois, ajuste") descrevia a cópia
 *  que deixou de existir. */
// PENDENTE: redação minha, o João ainda não leu
export const DICA_DO_PONTO_NOVO = "Arraste o pin até onde fica o ponto novo.";

/** `rotulo` é o "Ponto N" que o servidor já escreve no bloco de cada ponto —
 *  uma forma só de nomear um ponto na tela inteira. */
// PENDENTE: redação minha, o João ainda não leu
export const tirarPonto = (rotulo: string): string => `Tirar o ${rotulo}`;

/** O segundo toque do "tirar" (R2 da onda de conserto 1, decisão do João). */
// PENDENTE: redação minha, o João ainda não leu
export const TIRAR_MESMO = "Tirar mesmo?";

type Par = { lat: number; lng: number };

export default function EditorWaypoints({
  slug,
  pontos,
  rotuloDoUltimo,
  ultimo,
}: {
  slug: string;
  /** Quantos pontos o trajeto tem AGORA (o lugar conta). */
  pontos: number;
  /** O rótulo do último ponto, como o bloco dele o mostra ("Ponto 3"). */
  rotuloDoUltimo: string;
  /** Onde o mapa do ponto novo COMEÇA: a posição do último ponto. */
  ultimo: Par;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState<Par>(ultimo);
  const [confirmandoTirar, setConfirmandoTirar] = useState(false);
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();

  function acrescentar(): void {
    if (nome.trim() === "") {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    void gravar({ slug, acrescentarEtapa: { nome, lat: pin.lat, lng: pin.lng } });
  }

  function tirar(): void {
    if (!confirmandoTirar) {
      setConfirmandoTirar(true);
      return;
    }
    void gravar({ slug, tirarEtapa: pontos - 1 });
  }

  return (
    <div className="adm-campo adm-editor" data-testid="editor-waypoints">
      {aberto ? (
        <>
          <input
            type="text"
            className="adm-editor-caixa"
            aria-label={NOME_DO_PONTO_NOVO}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <p className="adm-editor-ajuda">{DICA_DO_PONTO_NOVO}</p>
          <MapaDoPin centro={ultimo} atual={pin} aoMover={setPin} />
          <p className="adm-editor-coord" data-testid="coord-atual">
            {`${pin.lat}, ${pin.lng}`}
          </p>
          <button type="button" className="adm-editor-salvar" disabled={salvando} onClick={acrescentar}>
            {salvando ? SALVANDO : SALVAR}
          </button>
        </>
      ) : (
        <button type="button" className="adm-editor-salvar" onClick={() => setAberto(true)}>
          {ACRESCENTAR_PONTO}
        </button>
      )}
      {pontos > 1 && (
        <button type="button" className="adm-editor-nao-sei" disabled={salvando} onClick={tirar}>
          {confirmandoTirar ? TIRAR_MESMO : tirarPonto(rotuloDoUltimo)}
        </button>
      )}
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
