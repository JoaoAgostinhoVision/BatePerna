"use client";

import Appbar from "./Appbar";
import BarraNavegacao from "./BarraNavegacao";

/** O QUE APARECE QUANDO ALGUMA COISA QUEBRA NO MEIO.
 *
 *  🔴 POR QUE ISTO EXISTE (2026-09-11). É o irmão do `not-found.tsx`, e fecha o
 *  mesmo beco por outra causa: sem este arquivo, um erro de render caía na tela
 *  de erro padrão do Next — fora da moldura do app, sem porta de volta. Em
 *  standalone não há barra de URL, e a pessoa fica presa **exatamente no
 *  momento em que o app já falhou uma vez**.
 *
 *  ⚠️ NÃO MOSTRA O ACERVO, e não é escolha — mas o MOTIVO mudou em 2026-09-25,
 *  quando a ficha saiu do disco e foi pro banco. `error.tsx` é obrigatoriamente
 *  client component, e o acervo agora é uma leitura ASSÍNCRONA DE SERVIDOR
 *  (`getAllFichas` → banco): nenhum componente de cliente a alcança. Até aquela
 *  data o impedimento era outro e igualmente firme — a lista lia
 *  `content/fichas/` com `node:fs`, e encaixá-la aqui arrastaria o `node:fs` pro
 *  bundle do navegador, o mesmo motivo que mantém `piso.ts`, `semana.ts` e
 *  `fatos-da-trilha.ts` puros. E há o motivo que vale pelos dois: esta tela é o
 *  que aparece justamente quando aquela leitura FALHOU, então mostrar a lista
 *  aqui seria tentar de novo o que acabou de não dar. A porta é a barra de
 *  baixo, que basta.
 *
 *  ⚠️ E NÃO MOSTRA A MENSAGEM DO ERRO. Ela é escrita pra quem programa, em
 *  inglês, e quase sempre não diz nada a quem está no portão decidindo se sobe.
 *  O app já tem uma regra pra isso — quando não pode afirmar, para de afirmar —
 *  e mostrar `TypeError: undefined` seria afirmar precisão que não existe.
 *
 *  O `reset` é o que o Next dá pra tentar renderizar de novo: um erro passageiro
 *  (uma leitura de rede que falhou no meio) some no toque, sem recarregar a
 *  página inteira. */
export default function Quebrou({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="bp">
      <div className="screen">
        <Appbar comSaida={false} />
        <p className="nao-achei">Alguma coisa quebrou aqui.</p>
        <p className="quebrou-acao">
          <button type="button" className="btn" onClick={reset}>
            Tentar de novo
          </button>
        </p>
        <BarraNavegacao aqui="hoje" />
      </div>
    </main>
  );
}
