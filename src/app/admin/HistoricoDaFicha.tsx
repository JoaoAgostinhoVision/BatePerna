"use client";
import { useContext, useState } from "react";
import { VersaoDaTela, comBase } from "./campos/gravar";
import type { AutorVersao, FichaVersao } from "@/lib/db";
import { DE_VOLTA_AO_AR, ESCONDIDO } from "./campos/palavras";
import { enderecoTrocado } from "@/lib/endereco";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const TITULO = "Histórico da ficha";
// O `satisfies` é o guarda: autor novo sem rótulo não compila.
const AUTOR = {
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  painel: "você, pelo painel",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  semente: "acervo original",
  // PENDENTE: redação minha, o João ainda não leu (as duas palavras vêm da spec de 07/10, Parte 3)
  contribuidor: "quem mandou",
} as const satisfies Record<AutorVersao, string>;
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const VOLTAR = "voltar a esta";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const VOLTANDO = "Voltando…";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
const ERRO_VOLTAR = "Não consegui voltar a esta versão.";

/** Uma versão como a TELA a recebe: a linha do banco e, já resolvidos no
 *  servidor, os RÓTULOS dos campos que ela mudou em relação à anterior.
 *
 *  🔴 OS RÓTULOS CHEGAM PRONTOS, e não é preguiça (B2 da auditoria da Task 9):
 *  saber "que campo mudou" exige o registro de campos, que traz o zod; este
 *  componente é `"use client"` e desce pro celular. A conta é
 *  `camposQueMudaram` (`src/lib/campos-mudados.ts`), chamada pela página; o
 *  rótulo é `rotuloDe`, a MESMA fonte que nomeia o bloco na ficha inteira. */
export type VersaoNaTela = FichaVersao & {
  mudou: readonly string[];
  /** O ATO desta versão sobre a visibilidade (`atoDeVisibilidade`, no
   *  servidor). 🔴 A marca sai DAQUI, nunca de `oculto`: o estado marcaria
   *  toda edição feita com o lugar escondido, e a versão que mostrou de novo
   *  ficaria sem nada (R2 da onda de conserto 1). */
  ato: "escondeu" | "mostrou" | null;
};

type Props = { versoes: VersaoNaTela[] };

/** A voz que um documento de versão guarda — nunca lança: uma linha antiga
 *  que não parseia mostra vazio em vez de derrubar a lista inteira. */
function vozDaVersao(doc: string): string {
  try {
    const v = (JSON.parse(doc) as { voz?: unknown }).voz;
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

function dataHora(criadoEm: number): string {
  return new Date(criadoEm * 1000).toLocaleString("pt-BR");
}

/** O histórico do que já foi dito sobre UM lugar, e o botão que volta a uma
 *  versão antiga (Task 7, 2026-09-26).
 *
 *  🔴 ERA `HistoricoDaVoz` ATÉ A TASK 9 (2026-10-01), e o nome dizia o defeito:
 *  ele só sabia extrair a `voz`, então uma versão que mudou o preço aparecia
 *  sem nada na linha — o dono não via o próprio trabalho. Hoje cada linha diz
 *  QUE CAMPOS mudaram (`mudou`, resolvido no servidor) e se a versão
 *  ESCONDEU o lugar ou o MOSTROU de novo (`ato` — o ato, não o estado). Abrir a linha ainda mostra a voz daquela versão, como antes. "Voltar" GRAVA uma versão nova com o
 *  conteúdo velho — nunca apaga nada; `ficha_versoes` é append-only (ver
 *  `src/lib/db.ts`).
 *
 *  🔴 O AUTOR É POR LINHA, não um rótulo fixo — é a procedência de cada
 *  versão, e procedência é a razão desta tabela existir.
 *
 *  🔴 NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui — `versoes` chega por
 *  prop, como `ficha` chega em `FichaInteira`. Este componente serve QUALQUER
 *  lugar. (A frase dizia `EditorDeVoz`, que a Task 6 apagou.) */
export default function HistoricoDaFicha({ versoes }: Props) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [voltando, setVoltando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A versão que a tela abriu (onda de fix 2 da 11e): ver `VersaoDaTela`.
  const baseId = useContext(VersaoDaTela);

  async function voltar(slug: string, versaoId: number) {
    if (voltando != null) return;
    setErro(null);
    setVoltando(versaoId);
    try {
      const r = await fetch("/api/admin/ficha", {
        method: "PUT",
        body: JSON.stringify(comBase({ slug, versaoId }, baseId)),
      });
      if (r.ok) { location.reload(); return; }
      // O 409 com frase (o lugar mudou de endereço no meio, onda de fix da 11e;
      // ou o par de outro lugar) diz o que fazer; sem frase, a nossa.
      const frase = r.status === 409 ? (await r.text()).trim() : "";
      setErro(frase === "" ? ERRO_VOLTAR : frase);
    } catch {
      setErro(ERRO_VOLTAR);
    } finally {
      setVoltando(null);
    }
  }

  return (
    <section className="adm-historico" data-historico>
      <h2>{TITULO}</h2>
      <ul>
        {versoes.map((v) => (
          <li key={v.id} data-versao={v.id} data-testid={`versao-${v.id}`}>
            <button type="button" data-abrir-versao={v.id} onClick={() => setAberta(aberta === v.id ? null : v.id)}>
              {dataHora(v.criado_em)} — {AUTOR[v.autor]}
            </button>
            {v.ato === "escondeu" && <span className="adm-marca-escondido">{ESCONDIDO}</span>}
            {v.ato === "mostrou" && <span className="adm-marca-escondido">{DE_VOLTA_AO_AR}</span>}
            {/* 🔴 O ATO DE TROCAR O ENDEREÇO (Tarefa 11e, I4): a versão dele tem o
                MESMO documento da anterior, e sem esta linha sairia só com data e
                autor. É também a procedência que fica quando o endereço velho é
                retomado por outro lugar. Voltar a uma versão restaura o
                DOCUMENTO, nunca o endereço. */}
            {v.endereco_anterior && <span className="adm-marca-escondido">{enderecoTrocado(v.endereco_anterior)}</span>}
            {v.mudou.length > 0 && (
              // 🔴 `<span>`, NÃO `<li>` aninhado: a linha da versão É o `<li>`, e
              // há teste contando `li` do histórico contra as versões do banco.
              <p className="adm-historico-mudou">
                {v.mudou.map((rotulo) => <span key={rotulo}>{rotulo}</span>)}
              </p>
            )}
            {aberta === v.id && (
              <div className="adm-historico-item">
                <p>{vozDaVersao(v.doc)}</p>
                <button
                  type="button"
                  data-voltar-versao={v.id}
                  disabled={voltando != null}
                  onClick={() => voltar(v.ficha_slug, v.id)}
                >
                  {voltando === v.id ? VOLTANDO : VOLTAR}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </section>
  );
}
