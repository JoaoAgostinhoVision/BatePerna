"use client";
import { useState } from "react";
import { MAPA_ZOOM_EDITOR } from "@/lib/mapa";
import { MapaDoPin, portaoDoSalvar } from "./EditorCoordenada";
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
 *     `EditorCoordenada` (`MapaDoPin`), com a VISTA começando no último ponto
 *     e SEM PIN. O dono escreve o nome, TOCA onde fica o ponto (e arrasta pra
 *     acertar) e confirma; o que vai pra porta é a posição do pin. 🔴 Até a
 *     onda de conserto 1 a coordenada era COPIADA do último ponto pela porta, e
 *     a ficha pública a imprimia como fato, com "Abrir no mapa" — na primeira
 *     etapa, em cima do próprio destino. 🔴 E até a onda de fix 2 da 11f (m-5 da
 *     re-revisão) a cópia voltava pela porta do PIN PRÉ-POSTO: o pin nascia no
 *     último ponto e se confirmava sem gesto nenhum. Agora não há pin nem Salvar
 *     até o toque dele, e nenhuma coordenada é copiada em lugar nenhum. Duas
 *     etapas no mesmo ponto continuam possíveis: é tocar ali.
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
 *  traria o zod pro celular. O `ultimo` é só ONDE O MAPA COMEÇA (a vista);
 *  nunca vira pin nem dado.
 *
 *  🔴 O MAPA ANDA DESDE A TAREFA 11f (m6 da auditoria): o mesmo `MapaDoPin`
 *  ganhou o arrastar do fundo, o + e o − e o toque que leva o pin. Acabou o
 *  limite de ~9 km pra etapa nova (antes, mais longe era salvar e abrir de
 *  novo). E o mesmo portão do Salvar (`portaoDoSalvar`): o pin posto com a
 *  vista afastada (abaixo do `MAPA_ZOOM_EDITOR`) não se confirma — nem depois
 *  de aproximar, até ser tocado ou arrastado de perto (onda de fix da 11f, C-1
 *  da revisão) —, e o pin fora da parte visível também não. Sem pin (antes do
 *  primeiro toque), não há Salvar: a vista nunca é gravada. */

/** O nome da caixa do ponto novo. "O nome" é a palavra que o painel já usa pra
 *  essa folha de todo ponto (`ROTULO_DO_PONTO.nome`), e "ponto" é a que o
 *  trajeto usa. Vai como `aria-label`. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const NOME_DO_PONTO_NOVO = "O nome do ponto novo";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ACRESCENTAR_PONTO = "Acrescentar um ponto no fim do trajeto";

/** A ajuda do mapa SEM PIN do ponto novo: a vista começa no último ponto, mas o
 *  ponto novo só existe depois do toque dele. Trocada na onda de fix 2 da 11f
 *  (m-5): a anterior ("Arraste o pin até onde fica o ponto novo.") descrevia o
 *  pin pré-posto no último ponto, que deixou de existir. Some com o toque, e
 *  mora EMBAIXO do mapa (como a `MARQUE_NO_MAPA`): uma linha que some em cima
 *  faria o mapa pular debaixo do dedo. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const DICA_DO_PONTO_NOVO = "Toque no mapa onde fica o ponto novo. Depois, arraste o pin pra acertar.";

/** `rotulo` é o "Ponto N" que o servidor já escreve no bloco de cada ponto —
 *  uma forma só de nomear um ponto na tela inteira. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const tirarPonto = (rotulo: string): string => `Tirar o ${rotulo}`;

/** O segundo toque do "tirar" (R2 da onda de conserto 1, decisão do João). */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
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
  /** Onde a VISTA do ponto novo começa: a posição do último ponto. Nunca o pin. */
  ultimo: Par;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  // 🔴 SEM PIN até o toque dele (m-5): o último ponto é só onde a vista começa.
  const [pin, setPin] = useState<Par | null>(null);
  // Só vale com pin: o primeiro `aoMover` o troca pelo zoom do gesto.
  const [zDoPin, setZDoPin] = useState(MAPA_ZOOM_EDITOR);
  const [pinAVista, setPinAVista] = useState(true);
  const [vista, setVista] = useState({ centro: ultimo, z: MAPA_ZOOM_EDITOR });
  const ajudaDoPortao = portaoDoSalvar({ zDoPin, zDaVista: vista.z, pinAVista });
  const [confirmandoTirar, setConfirmandoTirar] = useState(false);
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();

  function acrescentar(posto: Par): void {
    if (nome.trim() === "") {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    void gravar({ slug, acrescentarEtapa: { nome, lat: posto.lat, lng: posto.lng } });
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
          <MapaDoPin
            vista={vista}
            atual={pin}
            aoMover={(p, z) => {
              setPin(p);
              setZDoPin(z);
            }}
            aoMudarVista={setVista}
            aoVerPin={setPinAVista}
          />
          <p className="adm-editor-coord" data-testid="coord-atual" aria-live="polite">
            {pin ? `${pin.lat}, ${pin.lng}` : ""}
          </p>
          {pin === null && <p className="adm-editor-ajuda">{DICA_DO_PONTO_NOVO}</p>}
          {pin !== null && ajudaDoPortao !== null && <p className="adm-editor-ajuda">{ajudaDoPortao}</p>}
          {/* 🔴 SEM PIN NÃO HÁ SALVAR: nada aqui grava a vista (nem o último ponto). */}
          {pin !== null && (
            <button
              type="button"
              className="adm-editor-salvar"
              disabled={salvando || ajudaDoPortao !== null}
              onClick={() => acrescentar(pin)}
            >
              {salvando ? SALVANDO : SALVAR}
            </button>
          )}
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
