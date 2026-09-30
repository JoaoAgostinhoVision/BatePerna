"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { HORA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O BLOCO OPCIONAL INTEIRO — `horario` é o único hoje, e ele é o instrumento
 *  que a auditoria do brief (A3) exigiu.
 *
 *  🔴 O DEFEITO QUE ISTO EXISTE PRA NÃO COMETER: **a tela convidando a um ato
 *  que a porta nega.** Com o `horario` ausente, `camposDaFicha` devolve TRÊS
 *  blocos (`horario`, `horario.abre`, `horario.fecha`) e os três dizem "não
 *  sei". Se cada folha ganhasse uma caixa de hora, o dono digitaria a hora de
 *  abrir, tocaria salvar, e levaria a recusa *"`horario` não está preenchido
 *  nesta ficha: preencha o `horario` inteiro de uma vez"*
 *  (`campos-da-ficha.ts:414`) — num campo que a tela ofereceu. A porta só aceita
 *  `{campo: "horario", valor: {abre, fecha}}` com o bloco ausente (é o
 *  `gravarBloco`, ruling C1 da Tarefa 1), então é ISSO que a tela oferece.
 *
 *  🔴 DOIS ESTADOS, E ELES SÃO OPOSTOS:
 *
 *   - **bloco AUSENTE** — uma caixa por folha, as duas juntas, e um Salvar só.
 *     As folhas, nos blocos delas, não oferecem salvar nenhum (quem decide é
 *     `FichaInteira`).
 *   - **bloco PRESENTE** — nenhuma caixa aqui: cada folha tem o instrumento
 *     dela, e `aplicarCampo` no bloco presente é RECUSADO de propósito (gravar o
 *     objeto fechado por cima pularia a conferência folha a folha). O que o
 *     bloco oferece é o botão que tira o bloco inteiro — a única forma de dizer
 *     "este lugar não tem hora pra abrir e fechar".
 *
 *  🔴 TODA FOLHA DE BLOCO É `hora` HOJE, e isto é GUARDA, não memória: o teste
 *  desta tarefa crava que nenhuma folha de nenhum `bloco` do registro tem outra
 *  espécie. Um bloco novo com folha de prosa deixa a suíte vermelha antes de
 *  mostrar um seletor de hora pra um campo de texto.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO: os rótulos das folhas chegam por
 *  prop, resolvidos pelo servidor a partir do registro. */

// PENDENTE: redação minha, o João ainda não leu
export const BLOCO_JUNTO = "Estes campos entram juntos: um sozinho não vira ficha.";

export default function EditorBloco({ campo, valor, slug }: PropsDoEditor) {
  const folhas = campo.folhas ?? [];
  const [horas, setHoras] = useState<Readonly<Record<string, string>>>({});
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();
  const ausente = valor === undefined;

  function salvar(): void {
    if (folhas.some((f) => (horas[f.chave] ?? "") === "")) {
      recusarAqui(HORA_VAZIA);
      return;
    }
    void gravar({
      slug,
      campo: campo.caminho,
      valor: Object.fromEntries(folhas.map((f) => [f.chave, horas[f.chave]])),
    });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {ausente && (
        <>
          <p className="adm-editor-ajuda">{BLOCO_JUNTO}</p>
          {folhas.map((f) => (
            <input
              key={f.chave}
              type="time"
              className="adm-editor-hora"
              aria-label={f.rotulo}
              data-hora={f.caminho}
              value={horas[f.chave] ?? ""}
              onChange={(e) => setHoras((antes) => ({ ...antes, [f.chave]: e.target.value }))}
            />
          ))}
          <button
            type="button"
            className="adm-editor-salvar"
            data-salvar={campo.caminho}
            disabled={salvando}
            onClick={salvar}
          >
            {salvando ? SALVANDO : SALVAR}
          </button>
        </>
      )}
      {!campo.obrigatorio && <BotaoNaoSei caminho={campo.caminho} slug={slug} bloco />}
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
