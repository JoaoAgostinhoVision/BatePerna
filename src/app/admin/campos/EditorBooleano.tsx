"use client";
import { useState } from "react";
import BotaoNaoSei from "./BotaoNaoSei";
import { usarGravacao } from "./gravar";
import { NADA_ESCOLHIDO, NAO, SALVANDO, SALVAR, SIM } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O INTERRUPTOR — um campo só hoje (`carroComum`), e três estados, não dois.
 *
 *  🔴 TRÊS: `true`, `false` e AUSENTE. `carroComum: false` é uma AFIRMAÇÃO ("não
 *  chega") e o app a mostra por extenso; ausente é SILÊNCIO, e o app cala. Um
 *  `checkbox` só teria dois estados e misturaria "ele disse que não" com "ele
 *  não disse" — por isso são duas opções de marcar mais o `BotaoNaoSei`, que é
 *  o terceiro estado com nome.
 *
 *  🔴 O QUE APARECE É A FRASE QUE O VALOR VIRA NA TELA, NUNCA O NOME DO CAMPO.
 *  O dono lê "Carro comum chega até lá?" com "Sim" e "Não" — não `carroComum`,
 *  não `true`. A pergunta vem do registro pela prop `campo.rotulo` (é o rótulo
 *  que `FichaInteira` já resolveu, o mesmo que o bloco imprime acima), e as duas
 *  respostas são as MESMAS palavras que a ficha inteira usa pra ler um booleano
 *  (`SIM`/`NAO` em `./palavras`) — a leitura e a escrita não podem falar duas
 *  línguas sobre o mesmo campo.
 *
 *  ⚠️ `aria-label` no grupo, sem rótulo visível: o bloco da ficha já imprime a
 *  pergunta em `.adm-campo-rotulo`. */
export default function EditorBooleano({ campo, valor, slug }: PropsDoEditor) {
  const [marcado, setMarcado] = useState<boolean | null>(typeof valor === "boolean" ? valor : null);
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui } = gravacao;

  function salvar(): void {
    // 🔴 `=== null`, nunca `!marcado`: `false` é resposta, e um `!` aqui
    // recusaria gravar "não chega" — a mesma confusão entre `false` e silêncio
    // que `FichaInteira` evita no render.
    if (marcado === null) {
      recusarAqui(NADA_ESCOLHIDO);
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: marcado });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <fieldset className="adm-editor-opcoes" aria-label={campo.rotulo}>
        {[true, false].map((v) => (
          <label key={String(v)} className="adm-editor-opcao">
            <input
              type="radio"
              name={`sim-nao-${campo.caminho}`}
              checked={marcado === v}
              onChange={() => setMarcado(v)}
            />
            {v ? SIM : NAO}
          </label>
        ))}
      </fieldset>
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
