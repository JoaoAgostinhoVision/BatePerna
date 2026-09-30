"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { NADA_ESCOLHIDO, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** A LISTA FECHADA — escolher, **nunca digitar** (§3 do desenho).
 *
 *  Quatro campos hoje: `piso`, `custo.tag`, `condicao.severidade` (uma opção) e
 *  `dias` (várias). As palavras chegam pela prop `campo.opcoes`, que o servidor
 *  lê do REGISTRO — este arquivo não conhece módulo de vocabulário nenhum, e
 *  não há cópia de palavra aqui.
 *
 *  ⚠️ E O REGISTRO NÃO TEM UMA FONTE SÓ, que é o que a frase anterior deste
 *  docblock afirmava (*"vêm de `PISOS`/`DIAS`/`SEVERIDADES`"*) e era FALSO:
 *  três das quatro vêm daquelas listas, e `custo.tag` tem `opcoes:
 *  ["gratis","pago"]` **literal** em `campos-da-ficha.ts:105` — segunda cópia
 *  do `z.enum` de `types/ficha.ts:71`. A duplicação é dívida da Task 1 e não se
 *  conserta aqui; a frase, sim.
 *
 *  🔴 DUAS FORMAS, PORQUE SÃO DUAS PERGUNTAS. "Qual é o piso?" é `<select>` (o
 *  seletor nativo do celular, uma resposta); "quais dias abre?" é caixa de
 *  marcar por opção, porque um `<select multiple>` no celular é uma lista de
 *  rolagem onde se perde a seleção com um toque errado. Uma lista de UMA
 *  escolha por `<select>` e VÁRIAS por marcação não é dois idiomas: é a
 *  diferença entre as duas perguntas, dita pelo instrumento.
 *
 *  🔴 NÃO DÁ PRA DIGITAR, E ISSO É O PONTO: a mutação que troca isto por um
 *  `<input>` livre deixa o dono gravar `"asfalto bom"` num campo que é
 *  `z.enum(PISOS)` — 400 na cara dele, num campo que a tela ofereceu como texto.
 *
 *  🔴 A ORDEM QUE VAI PRA PORTA É A DO REGISTRO, nunca a dos toques. `dias`
 *  chega ao banco na ordem de `DIAS` (dom→sab), e é isso que faz
 *  `rotuloDias`/`faixaDeDias` lerem a semana como semana. Gravar na ordem dos
 *  toques poria `["sab","dom"]` num dia e `["dom","sab"]` no outro pro mesmo
 *  lugar.
 *
 *  ⚠️ NADA É PRÉ-PREENCHIDO (§4.4). Com o campo AUSENTE, o `<select>` abre numa
 *  opção em branco — sem texto, porque texto de exemplo num campo de lugar real
 *  é resposta plausível que se grava sem querer. Salvar sem escolher é recusado
 *  aqui, sem viagem. */
const jaEscolhidas = (valor: unknown): readonly string[] => {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === "string");
  return [];
};

export default function EditorLista({ campo, valor, slug }: PropsDoEditor) {
  const opcoes = campo.opcoes ?? [];
  const [marcadas, setMarcadas] = useState<readonly string[]>(jaEscolhidas(valor));
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui } = gravacao;

  function salvar(): void {
    // A ordem do REGISTRO, não a dos toques — ver o docblock.
    const emOrdem = opcoes.filter((o) => marcadas.includes(o));
    if (emOrdem.length === 0) {
      recusarAqui(NADA_ESCOLHIDO);
      return;
    }
    void gravar({
      slug,
      campo: campo.caminho,
      valor: campo.multiplo ? emOrdem : emOrdem[0],
    });
  }

  function alternar(opcao: string, ligar: boolean): void {
    setMarcadas((antes) => (ligar ? [...antes, opcao] : antes.filter((o) => o !== opcao)));
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {campo.multiplo ? (
        <fieldset className="adm-editor-opcoes" aria-label={campo.rotulo}>
          {opcoes.map((o) => (
            <label key={o} className="adm-editor-opcao">
              <input
                type="checkbox"
                value={o}
                checked={marcadas.includes(o)}
                onChange={(e) => alternar(o, e.target.checked)}
              />
              {o}
            </label>
          ))}
        </fieldset>
      ) : (
        <select
          className="adm-editor-escolha"
          aria-label={campo.rotulo}
          data-escolha={campo.caminho}
          value={marcadas[0] ?? ""}
          onChange={(e) => setMarcadas(e.target.value === "" ? [] : [e.target.value])}
        >
          {/* A opção em branco existe só enquanto o campo está sem valor — com
              valor, ela seria um convite a esvaziar, que não é "não sei". */}
          {marcadas.length === 0 && <option value="" />}
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
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
      <BotaoNaoSei campo={campo} valor={valor} slug={slug} gravacao={gravacao} />
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
