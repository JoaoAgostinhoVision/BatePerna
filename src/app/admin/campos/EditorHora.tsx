"use client";
import { useState } from "react";
import { usarGravacao } from "./gravar";
import { HORA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** A HORA — `<input type="time">`, o seletor nativo, **nunca texto livre**
 *  (§3 do desenho).
 *
 *  🔴 POR QUE NÃO EXISTE AQUI UMA CONFERÊNCIA DE `HH:MM`, E ISSO FOI MEDIDO.
 *  O plano pedia *"recusa texto que não é HH:MM antes de chamar a rota"*. Um
 *  `type="time"` **que o navegador implementa** não pode produzir valor fora de
 *  `HH:MM`: a especificação manda o controle devolver ou uma hora válida ou
 *  string vazia, e foi medido em jsdom (2026-09-30) que escrever `"17h"` nele
 *  deixa o `value` em `""`. Uma regex aqui seria uma condição SEMANTICAMENTE
 *  MORTA — a espécie "condição que virou inalcançável" do catálogo deste
 *  projeto, com a agravante de vir com um teste que nunca poderia ficar
 *  vermelho por defeito (o único capaz disso teria de sobrescrever o `type` que
 *  este componente declara, o que é encenação).
 *
 *  🔴 E O CASO QUE ISSO DEIXA DESCOBERTO, ESCRITO PORQUE É VERDADE: num
 *  navegador que **não** implementa `type=time`, o controle cai para `text`,
 *  `"17h"` fica no `value`, este editor manda, `aplicarCampo` estoura um
 *  `ZodError`, a rota devolve **400 de corpo vazio** e o dono lê *"Não consegui
 *  salvar."* — a frase menos informativa do app, exatamente onde a `HORA_VAZIA`
 *  prometia dizer o formato. O alcance é baixo (todo navegador de celular de
 *  hoje implementa `type=time`) e o caminho do BLOCO dá frase boa, mas a
 *  afirmação "não pode produzir" era FALSA sem a condição, e este projeto já
 *  pagou por frase de docblock que o próximo leitor acreditou. Se algum dia
 *  aquele navegador entrar na conta, o conserto é a rota devolver a frase do
 *  `ZodError` — decisão de porta, não deste arquivo.
 *
 *  Então o que é recusado aqui é o estado que o controle DE FATO produz: hora em
 *  branco — que é exatamente o que o dono vê depois de digitar "17h" num teclado
 *  de celular. E a frase diz o FORMATO, porque senão ele lê "escolha uma hora"
 *  olhando pra uma caixa onde acabou de escrever algo.
 *
 *  🔴 QUEM GARANTE `HH:MM` É A PORTA, e ela já garante: `validarFolha` confere a
 *  folha contra o `/^\d{2}:\d{2}$/` que o `fichaSchema` declara, e estoura
 *  NOMEANDO a folha (`horario.abre`). Repetir a regex aqui seria a segunda cópia
 *  da mesma regra, que é a espécie que este projeto já pagou.
 *
 *  ⚠️ NÃO TEM `BotaoNaoSei`, e não é esquecimento: as duas horas são
 *  `obrigatorio: true` DENTRO do bloco `horario`, e o "não sei" delas é tirar o
 *  `horario` inteiro — que é o botão do bloco, no `EditorBloco`. Se um dia uma
 *  folha de espécie `hora` nascer opcional, o `campo.obrigatorio` já chega aqui
 *  por prop; hoje o registro não tem nenhuma, e o teste dessa tarefa crava isso
 *  em vez de deixar por escrito. */
export default function EditorHora({ campo, valor, slug }: PropsDoEditor) {
  const [hora, setHora] = useState(typeof valor === "string" ? valor : "");
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();

  function salvar(): void {
    if (hora === "") {
      recusarAqui(HORA_VAZIA);
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: hora });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <input
        type="time"
        className="adm-editor-hora"
        aria-label={campo.rotulo}
        data-hora={campo.caminho}
        value={hora}
        onChange={(e) => setHora(e.target.value)}
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
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
