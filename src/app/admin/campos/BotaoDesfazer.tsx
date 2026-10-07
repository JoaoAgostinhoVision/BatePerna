"use client";
import { DESFAZER } from "./palavras";

/** O "DESFAZER" DE UM EDITOR — voltar o que está na tela ao SALVO, sem gravar
 *  (Tarefa 15, 07/10: o segundo dos "dois cancelar" que o João pediu).
 *
 *  🔴 ELE NÃO SABE O QUE É O SALVO, e é de propósito: cada editor compara o
 *  estado dele com a PROP `valor` (lida a cada render — nunca uma cópia da
 *  montagem) e passa `mudou`; o toque chama `aoDesfazer`, que o editor escreve
 *  pra voltar o estado dele. Um botão só pros sete editores — a palavra, a
 *  classe e o "só aparece com mudança" num lugar, como o `BotaoNaoSei`.
 *
 *  🔴 NÃO GRAVA NADA, NÃO PERGUNTA NADA. Nenhum `fetch` passa por aqui, e não há
 *  segundo toque: o que se perde é o que ainda não foi salvo, e está na tela de
 *  quem toca. É `type="button"`, como todo botão do painel que não grava.
 *
 *  ⚠️ Desligado enquanto o editor grava: voltar a caixa no meio de um Salvar
 *  mostraria uma coisa na tela enquanto outra vai pra porta. */
export default function BotaoDesfazer({
  mudou,
  salvando,
  aoDesfazer,
}: {
  mudou: boolean;
  salvando: boolean;
  aoDesfazer: () => void;
}) {
  if (!mudou) return null;
  return (
    <button type="button" className="adm-editor-desfazer" disabled={salvando} onClick={aoDesfazer}>
      {DESFAZER}
    </button>
  );
}
