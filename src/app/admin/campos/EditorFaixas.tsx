"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { BLOCO_JUNTO, HORA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O HORÁRIO INTEIRO — a lista de faixas (Tarefa 11c), gravada de uma vez.
 *
 *  ⚠️ ESTE É O INSTRUMENTO MÍNIMO, E É DE PROPÓSITO. A Tarefa 11c mudou o
 *  DADO (o horário virou lista de 1 a 3 faixas) e a porta de escrita; o
 *  editor de verdade — acrescentar e tirar faixa — é a Tarefa 11d. Até lá
 *  este mostra as faixas que o lugar JÁ TEM, cada uma com as duas horas, e o
 *  Salvar manda a lista inteira: a porta (`aplicarCampo`, com as regras de
 *  `problemaDasFaixas`) substitui a lista. Ele nunca ENCOLHE a lista sem o dono
 *  ver: mostra todas, grava todas.
 *
 *  Sem horário, aparece UMA faixa vazia: é o caminho de volta depois de um
 *  "não tem", e as caixas nascem vazias — nada pré-preenchido.
 *
 *  🔴 A LISTA VAZIA NUNCA SAI DAQUI (11c-C1): "sem horário" é o "não tem", que
 *  tira a chave. Uma caixa vazia é recusada aqui, antes da viagem.
 *
 *  Nenhum editor importa o registro nem `@/lib/horario` — o contrato é de props
 *  (ver o topo de `tipos.ts`); o valor chega `unknown` e é estreitado aqui. */

type Faixa = { abre: string; fecha: string };

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

/** O que o documento tem, nas duas formas que ele pode ter (a lista, ou o
 *  objeto de antes da 11c) — e uma faixa vazia quando não tem nada legível. */
function faixasDoValor(valor: unknown): Faixa[] {
  if (Array.isArray(valor) && valor.length > 0 && valor.every(ehFaixa)) return valor.map((f) => ({ ...f }));
  if (ehFaixa(valor)) return [{ abre: valor.abre, fecha: valor.fecha }];
  return [{ abre: "", fecha: "" }];
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
      {/* Sem horário, a mesma ajuda que o bloco de antes da 11c dava: as duas
          horas de uma faixa entram juntas. */}
      {valor === undefined && <p className="adm-editor-ajuda">{BLOCO_JUNTO}</p>}
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
        </div>
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
      <BotaoNaoSei campo={campo} valor={valor} slug={slug} gravacao={gravacao} bloco />
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
