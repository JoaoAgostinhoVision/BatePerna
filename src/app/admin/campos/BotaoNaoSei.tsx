"use client";
import { usarGravacao } from "./gravar";

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
 *  🔴 E A PALAVRA MUDA NO BLOCO, de propósito. Num campo comum, tirar a chave é
 *  *"não sei"* — o dono não sabe, e o app cala. Num BLOCO opcional (`horario`
 *  é o único hoje) tirar o bloco é a **única** forma de dizer *"este lugar não
 *  tem hora pra abrir e fechar"* — a régua do app é que ficha sem horário nunca
 *  fecha (`src/lib/horario.ts:117`). Chamar isso de "não sei" faria o dono
 *  declarar ignorância quando o que ele está declarando é um FATO. Duas
 *  palavras, um botão, e teste pros dois ramos: frase montada por bifurcação
 *  com prova de um lado só é a 49ª espécie do catálogo deste projeto.
 *
 *  ⚠️ SEM CONFIRMAÇÃO, e é escolha: a tabela de versões é append-only, o
 *  histórico da tela do lugar traz o "voltar", e o bloco VOLTA inteiro (ruling
 *  C1 da Tarefa 1). Nada aqui é irreversível pelo celular. */

// PENDENTE: redação minha, o João ainda não leu
export const NAO_SEI = "Não sei — o app cala sobre isto";
// PENDENTE: redação minha, o João ainda não leu
export const NAO_TEM = "Não tem — o app cala sobre isto";
// PENDENTE: redação minha, o João ainda não leu
const TIRANDO = "Tirando…";

export default function BotaoNaoSei({
  caminho,
  slug,
  bloco = false,
}: {
  caminho: string;
  slug: string;
  /** `true` só pra espécie `bloco` — troca a palavra, ver o docblock. */
  bloco?: boolean;
}) {
  const { erro, salvando, gravar } = usarGravacao();
  return (
    <>
      <button
        type="button"
        className="adm-editor-nao-sei"
        data-nao-sei={caminho}
        disabled={salvando}
        onClick={() => void gravar({ slug, campo: caminho, naoSei: true })}
      >
        {salvando ? TIRANDO : bloco ? NAO_TEM : NAO_SEI}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}
