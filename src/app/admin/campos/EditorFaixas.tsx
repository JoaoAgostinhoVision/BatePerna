"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { HORAS_JUNTAS, HORA_VAZIA, MAIS_FAIXA, SALVANDO, SALVAR, TIRAR_FAIXA } from "./palavras";
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
 *
 *  Sem horário, aparece UMA faixa vazia — o caminho de volta depois de um
 *  "não tem". Com horário, as faixas DELE, com as horas dele: resposta dele
 *  aparecendo de volta na caixa não é pré-preenchimento.
 *
 *  Nenhum editor importa o registro nem `@/lib/horario` — o contrato é de props
 *  (ver o topo de `tipos.ts`); o valor chega `unknown` e é estreitado aqui. */

type Faixa = { abre: string; fecha: string };

/** O teto da lista — o mesmo de `problemaDasFaixas`. Repetido aqui (e não
 *  importado de `@/lib/horario`) pela regra do topo; a porta é a garantia. */
const MAXIMO = 3;

/** O nome de cada caixa pra quem lê a tela em voz alta. São os rótulos que
 *  `horario.abre`/`horario.fecha` tinham em `FichaInteira` até a 11c, quando as
 *  duas folhas deixaram de ser campos; vieram pra cá com o marcador. */
const HORA_DE: Record<keyof Faixa, string> = {
  // PENDENTE: redação minha, o João ainda não leu
  abre: "A hora de abrir",
  // PENDENTE: redação minha, o João ainda não leu
  fecha: "A hora de fechar",
};

const ehFaixa = (v: unknown): v is Faixa =>
  typeof v === "object" && v !== null && typeof (v as Faixa).abre === "string" && typeof (v as Faixa).fecha === "string";

const VAZIA: Faixa = { abre: "", fecha: "" };

/** O que o documento tem, nas duas formas que ele pode ter (a lista, ou o
 *  objeto de antes da 11c) — e uma faixa vazia quando não tem nada legível. */
function faixasDoValor(valor: unknown): Faixa[] {
  if (Array.isArray(valor) && valor.length > 0 && valor.every(ehFaixa)) return valor.map((f) => ({ ...f }));
  if (ehFaixa(valor)) return [{ abre: valor.abre, fecha: valor.fecha }];
  return [{ ...VAZIA }];
}

export default function EditorFaixas({ campo, valor, slug }: PropsDoEditor) {
  const [faixas, setFaixas] = useState<Faixa[]>(() => faixasDoValor(valor));
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui } = gravacao;

  function mudar(i: number, chave: keyof Faixa, hora: string): void {
    setFaixas((antes) => antes.map((f, j) => (j === i ? { ...f, [chave]: hora } : f)));
  }

  function salvar(): void {
    if (faixas.some((f) => f.abre === "" || f.fecha === "")) {
      recusarAqui(HORA_VAZIA);
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: faixas });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {/* Sem horário, a ajuda de que as duas horas de uma faixa entram juntas. */}
      {valor === undefined && <p className="adm-editor-ajuda">{HORAS_JUNTAS}</p>}
      {faixas.map((f, i) => (
        <div key={i} className="adm-editor-faixa" data-faixa={i}>
          {(["abre", "fecha"] as const).map((chave) => (
            <input
              key={chave}
              type="time"
              className="adm-editor-hora"
              aria-label={faixas.length > 1 ? `${HORA_DE[chave]} ${i + 1}` : HORA_DE[chave]}
              data-hora={`${campo.caminho}.${i}.${chave}`}
              value={f[chave]}
              onChange={(e) => mudar(i, chave, e.target.value)}
            />
          ))}
          {faixas.length > 1 && (
            <button
              type="button"
              className="adm-editor-tirar-faixa"
              data-tirar-faixa={i}
              disabled={salvando}
              onClick={() => setFaixas((antes) => antes.filter((_, j) => j !== i))}
            >
              {TIRAR_FAIXA}
            </button>
          )}
        </div>
      ))}
      {faixas.length < MAXIMO && (
        <button
          type="button"
          className="adm-editor-mais-faixa"
          data-mais-faixa=""
          disabled={salvando}
          onClick={() => setFaixas((antes) => [...antes, { ...VAZIA }])}
        >
          {MAIS_FAIXA}
        </button>
      )}
      <button
        type="button"
        className="adm-editor-salvar"
        data-salvar={campo.caminho}
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? SALVANDO : SALVAR}
      </button>
      <BotaoNaoSei campo={campo} valor={valor} slug={slug} gravacao={gravacao} naoTem />
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
