"use client";
import { useState } from "react";
import BotaoDesfazer from "./BotaoDesfazer";
import BotaoNaoSei from "./BotaoNaoSei";
import CaixasDeFaixas, { FAIXA_VAZIA, ehFaixa, mesmasFaixas, naOrdemDoDia, temCaixaVazia, type Faixa } from "./CaixasDeFaixas";
import { usarGravacao } from "./gravar";
import { HORAS_JUNTAS, HORA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O HORÁRIO INTEIRO — a lista de 1 a 3 faixas (Tarefa 11c), editada como
 *  lista e gravada de uma vez (Tarefa 11d).
 *
 *  🔴 UM INSTRUMENTO, UM SALVAR, A LISTA INTEIRA NUMA REQUISIÇÃO. É o que fecha
 *  o I-B da Tarefa 11: com o horário de antes (um bloco de duas folhas), a
 *  pergunta do horário tinha DOIS Salvar, e no formulário de lugar novo o
 *  primeiro avançava de pergunta e jogava fora, sem aviso, a hora digitada na
 *  outra caixa. Aqui as horas de abrir e de fechar — de todas as faixas — só
 *  gravam JUNTAS: a porta (`aplicarCampo`/`aplicarNoRascunho`, com as regras de
 *  `problemaDasFaixas`) SUBSTITUI a lista. É o mesmo componente na ficha no ar
 *  (`FichaInteira`, que recarrega) e no lugar novo (`FormularioDeLugar`, que
 *  avança) — quem decide pra onde a tela vai é o provedor de `./gravar`.
 *
 *  - "+ outra faixa" acrescenta uma faixa de caixas VAZIAS (nada
 *    pré-preenchido), até 3 — o teto da porta.
 *  - "Tirar esta faixa" só aparece com DUAS ou mais. 🔴 Com uma só não existe
 *    (11d-I3): a lista vazia nunca sai daqui, porque "sem horário" não é `[]`
 *    (a porta e o schema a recusam) — é o "não tem", que tira a chave.
 *  - Os dois são `type="button"`: mexem na lista NA TELA e não gravam nada.
 *    Quem grava é o Salvar, um só.
 *  - Caixa vazia é recusada aqui, antes da viagem (meia faixa não é faixa).
 *  - A lista vai pra porta NA ORDEM DO DIA (ordenada pelo `abre`).
 *
 *  Sem horário, aparece UMA faixa vazia — o caminho de volta depois de um
 *  "não tem". Com horário, as faixas DELE, com as horas dele: resposta dele
 *  aparecendo de volta na caixa não é pré-preenchimento.
 *
 *  Nenhum editor importa o registro nem `@/lib/horario` — o contrato é de props
 *  (ver o topo de `tipos.ts`); o valor chega `unknown` e é estreitado aqui.
 *
 *  O "Desfazer" (Tarefa 15) volta a LISTA inteira ao `valor` de AGORA (a prop):
 *  as horas, e também as faixas acrescentadas ou tiradas sem Salvar. Não grava.
 *
 *  🔴 AS CAIXAS MORAM EM `CaixasDeFaixas` DESDE 18/10: o horário diferente em
 *  alguns dias (`EditorGrupos`) usa as mesmas, em cada grupo. Aqui ficam o estado,
 *  o Salvar, o Desfazer e o "não tem". */

/** O que o documento tem — a LISTA de faixas — e uma faixa vazia quando não
 *  tem nada legível.
 *
 *  ⚠️ Até a revisão da 11d havia aqui um segundo ramo, pro objeto `{abre,
 *  fecha}` de antes da 11c, e o comentário prometia "as duas formas". Ele era
 *  inalcançável (M-6 daquela revisão): na ficha no ar o valor passa pelo
 *  `fichaSchema`, cujo `transform` já entrega a lista, e no rascunho toda
 *  gravação desde a 11c passa por `conferirFaixas`. O ramo saiu; a forma velha,
 *  se um dia chegar, cai na faixa vazia, como qualquer valor ilegível. */
function faixasDoValor(valor: unknown): Faixa[] {
  if (Array.isArray(valor) && valor.length > 0 && valor.every(ehFaixa)) return valor.map((f) => ({ ...f }));
  return [{ ...FAIXA_VAZIA }];
}

export default function EditorFaixas({ campo, valor, slug }: PropsDoEditor) {
  const [faixas, setFaixas] = useState<Faixa[]>(() => faixasDoValor(valor));
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui, limparErro } = gravacao;
  // Hora por hora, e não `JSON.stringify`: o documento pode trazer as chaves em
  // outra ordem, e isso não é mudança que ele fez.
  const salvas = faixasDoValor(valor);
  const mudou = !mesmasFaixas(faixas, salvas);

  function salvar(): void {
    if (temCaixaVazia(faixas)) {
      recusarAqui(HORA_VAZIA);
      return;
    }
    // Na ordem do dia (ver `naOrdemDoDia`). A porta continua recusando lista
    // fora de ordem que chegue por outro caminho.
    void gravar({ slug, campo: campo.caminho, valor: naOrdemDoDia(faixas) });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {/* Sem horário, a ajuda de que as duas horas de uma faixa entram juntas. */}
      {valor === undefined && <p className="adm-editor-ajuda">{HORAS_JUNTAS}</p>}
      <CaixasDeFaixas faixas={faixas} mudar={setFaixas} prefixo={campo.caminho} salvando={salvando} />
      <button
        type="button"
        className="adm-editor-salvar"
        data-salvar={campo.caminho}
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? SALVANDO : SALVAR}
      </button>
      <BotaoDesfazer
        mudou={mudou}
        salvando={salvando}
        aoDesfazer={() => {
          setFaixas(salvas);
          limparErro();
        }}
      />
      <BotaoNaoSei campo={campo} valor={valor} slug={slug} gravacao={gravacao} naoTem />
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
