"use client";
import type { Gravacao } from "./gravar";
import type { PropsDoEditor } from "./tipos";

/** O "NÃO SEI" — a outra ação, a que TIRA a chave do documento pra o app parar
 *  de afirmar (§4.1 do desenho).
 *
 *  🔴 NÃO É "LIMPAR A CAIXA". Caixa vazia é erro de preenchimento e a porta a
 *  recusa; isto chama `removerCampo`, e o app passa a CALAR sobre aquilo. São
 *  duas ações com dois botões porque são duas intenções — e `""` nunca chega ao
 *  documento (a ficha pública faz `ficha.custo.curto ?? precoCurto`, e o `??`
 *  não pega string vazia: gravar `""` deixaria o chip EM BRANCO em vez de cair
 *  no preço).
 *
 *  🔴 SÓ APARECE EM CAMPO OPCIONAL, e quem decide é o `obrigatorio` do
 *  registro, lido pelo servidor. Campo obrigatório não tem "não sei" — a porta
 *  recusa com frase, mas oferecer o botão seria a tela convidando a um ato que
 *  a porta nega.
 *
 *  🔴 E SÓ APARECE EM CAMPO QUE ESTÁ PREENCHIDO, o que é o mesmo princípio uma
 *  camada abaixo: num campo JÁ AUSENTE este botão não nega nada, ele **não faz
 *  nada**. Medido contra a porta de verdade: `removerCampo` sobre um caminho
 *  que a ficha não tem devolve **o documento idêntico** — e a rota grava versão
 *  nova sem comparar. O dono tocava, a página recarregava, **nada mudava**, e o
 *  Histórico da voz ganhava uma linha *"você, pelo painel"* que não mudou uma
 *  vírgula. A tela oferecendo um ato VAZIO é irmã da tela oferecendo um ato que
 *  a porta nega, e custa a mesma confiança.
 *
 *  ⚠️ E ISTO NÃO TRANCA NINGUÉM DE GRAVAR UMA VERDADE: o estado que este botão
 *  produziria (a chave fora do documento, o app calado) é **exatamente o estado
 *  em que o campo já está**. Esconder um `no-op` não tira saída nenhuma do
 *  dono; a saída dele pra dizer "não tem" num campo já vazio é não fazer nada,
 *  porque o app já está calado. O guarda que amarra isto é o teste que roda
 *  `removerCampo` de verdade em todo campo opcional AUSENTE das três fichas e
 *  exige documento idêntico — se um dia `removerCampo` passar a fazer algo
 *  nesse estado, aquele teste fica vermelho e este esconderijo deixa de ser
 *  honesto. É a porta que decide, não este componente.
 *
 *  🔴 E A PALAVRA MUDA NO HORÁRIO, de propósito. Num campo comum, tirar a chave
 *  é *"não sei"* — o dono não sabe, e o app cala. No `horario` (a lista de
 *  faixas; até a Tarefa 11c era um BLOCO, e a palavra nasceu lá) tirar a chave
 *  é a **única** forma de dizer *"este lugar não tem hora pra abrir e fechar"*
 *  — a régua do app é que ficha sem horário nunca fecha (`fechadoAgora`, em
 *  `src/lib/horario.ts`). Chamar isso de "não sei" faria o dono
 *  declarar ignorância quando o que ele está declarando é um FATO. Duas
 *  palavras, um botão, e teste pros dois ramos: frase montada por bifurcação
 *  com prova de um lado só é a 49ª espécie do catálogo deste projeto.
 *
 *  🔴 A GRAVAÇÃO VEM DE QUEM CHAMA, e isto é conserto medido: este componente
 *  tinha `usarGravacao()` PRÓPRIO, então o `disabled={salvando}` do Salvar do
 *  editor não o alcançava e os dois botões corriam entre si — dois `PUT`
 *  simultâneos sobre a mesma ficha, último escreve, numa tabela append-only.
 *  Com o `Gravacao` do editor, um `salvando` só governa os dois botões. E o
 *  `role="alert"` também é um só: duas caixas de erro no mesmo bloco fariam a
 *  tela dizer duas coisas sobre uma gravação.
 *
 *  ⚠️ SEM CONFIRMAÇÃO, e é escolha: a tabela de versões é append-only, o
 *  histórico da tela do lugar traz o "voltar", e o horário tirado volta pelo
 *  próprio editor dele (uma faixa de caixas vazias). Nada aqui é irreversível
 *  pelo celular. */

// PENDENTE: redação minha, o João ainda não leu
export const NAO_SEI = "Não sei — o app cala sobre isto";
// PENDENTE: redação minha, o João ainda não leu
export const NAO_TEM = "Não tem — o app cala sobre isto";
// PENDENTE: redação minha, o João ainda não leu
export const TIRANDO = "Tirando…";

export default function BotaoNaoSei({
  campo,
  valor,
  slug,
  gravacao,
  naoTem = false,
}: PropsDoEditor & {
  /** O `usarGravacao()` DO EDITOR — nunca um próprio, ver o docblock. */
  gravacao: Gravacao;
  /** `true` só no horário (`EditorFaixas`) — troca a palavra, ver o docblock. */
  naoTem?: boolean;
}) {
  const { salvando, gravar } = gravacao;
  // 🔴 As duas saídas, e as duas são "a tela não oferece o que não vale":
  // obrigatório é ato que a porta NEGA; já ausente é ato que não FAZ nada.
  if (campo.obrigatorio || valor === undefined) return null;
  return (
    <button
      type="button"
      className="adm-editor-nao-sei"
      data-nao-sei={campo.caminho}
      disabled={salvando}
      onClick={() => void gravar({ slug, campo: campo.caminho, naoSei: true })}
    >
      {salvando ? TIRANDO : naoTem ? NAO_TEM : NAO_SEI}
    </button>
  );
}
