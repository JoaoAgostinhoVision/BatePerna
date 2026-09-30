"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { CAIXA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** A CAIXA DE TEXTO — o instrumento da espécie `prosa` (16 dos 30 campos do
 *  registro, incluindo a `voz`).
 *
 *  Este componente ABSORVEU o `EditorDeVoz.tsx` que vivia em `src/app/admin/`,
 *  e que foi APAGADO na mesma tarefa — o nome vem sem caminho porque não há
 *  arquivo pra abrir. O que veio de lá, inteiro: estado local, `PUT`,
 *  `location.reload()` no sucesso (agora em `./gravar`), e as duas frases de
 *  erro. O que ficou pra trás: o título de seção próprio ("A sua voz") e a
 *  linha de ajuda daquele campo — a tela agora chama cada campo pelo rótulo do
 *  registro, e um campo com ajuda entre 29 sem seria dois idiomas na mesma tela.
 *
 *  🔴 A CAIXA VAZIA NÃO GRAVA, E ISSO NÃO É O MESMO QUE "NÃO SEI". Recusa aqui,
 *  sem viagem — e há teste cravando que a rota não foi chamada. A garantia
 *  continua sendo a porta (`recusarVazio` em `campos-da-ficha.ts`), que recusa
 *  inclusive só-espaços; isto poupa uma ida ao banco.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui. O que entra na caixa
 *  vem da prop `valor`, e o rótulo vem do registro pela prop `campo.rotulo`. */
export default function EditorProsa({ campo, valor, slug }: PropsDoEditor) {
  const [texto, setTexto] = useState(typeof valor === "string" ? valor : "");
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui } = gravacao;

  function salvar(): void {
    // `trim()` pra casar com a porta, que conta só-espaços como vazia.
    if (texto.trim() === "") {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: texto });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {/* 🔴 `aria-label`, nunca um rótulo visível: o bloco da ficha já imprime
          o rótulo em `.adm-campo-rotulo`, e um segundo rótulo dentro do editor
          faria a mesma pergunta duas vezes na mesma linha. */}
      <textarea
        className="adm-editor-caixa"
        aria-label={campo.rotulo}
        data-caixa={campo.caminho}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button
        type="button"
        className="adm-editor-salvar"
        data-salvar={campo.caminho}
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? SALVANDO : SALVAR}
      </button>
      <BotaoNaoSei campo={campo} valor={valor} slug={slug} gravacao={gravacao} />
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
