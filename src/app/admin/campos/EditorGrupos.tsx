"use client";
import { useState } from "react";
import BotaoDesfazer from "./BotaoDesfazer";
import BotaoNaoSei from "./BotaoNaoSei";
import CaixasDeFaixas, { FAIXA_VAZIA, ehFaixa, mesmasFaixas, naOrdemDoDia, temCaixaVazia, type Faixa } from "./CaixasDeFaixas";
import { usarGravacao } from "./gravar";
import { HORA_VAZIA, SALVANDO, SALVAR } from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O HORÁRIO DIFERENTE EM ALGUNS DIAS (18/10) — a lista de 1 a 3 grupos, cada um
 *  com os dias e as faixas dele, editada como lista e gravada de uma vez.
 *
 *  🔴 OS DOIS INSTRUMENTOS DE SEMPRE, NÃO DOIS NOVOS. Os dias de um grupo são as
 *  caixas de marcar do `EditorLista` de vários (a mesma classe, o nome do dia por
 *  extenso que o servidor manda em `campo.rotulos`); as horas são as
 *  `CaixasDeFaixas`, as mesmas do horário de sempre. O que é deste editor é só a
 *  LISTA de grupos: "+ outro grupo" (até 3, o teto da porta), "Tirar este grupo"
 *  (só com dois ou mais — com um, quem tira o campo é o "não tem"), e UM Salvar
 *  que manda a lista inteira numa requisição. A porta (`aplicarCampo`/
 *  `aplicarNoRascunho`, com `problemaDosGrupos`) SUBSTITUI a lista.
 *
 *  🔴 PRA EXIGIR MENOS (spec §6, decisão minha):
 *  - os dias oferecidos são os dias em que o lugar ABRE. Quem filtra é o
 *    servidor, que monta `campo.opcoes` a partir dos `dias` do documento
 *    (`diasDosGrupos`, em `FichaInteira`) — este editor não sabe o que é `dias`;
 *  - um dia já marcado em OUTRO grupo aparece desligado: a recusa "o mesmo dia
 *    em dois grupos" fica inalcançável pela tela.
 *
 *  A ORDEM QUE VAI PRA PORTA é a do registro (dom→sab) pros dias, nunca a dos
 *  toques — a mesma régua do `EditorLista` —, e a do dia pras faixas.
 *
 *  Sem resposta, aparece UM grupo vazio (nenhum dia marcado, uma faixa de caixas
 *  vazias) — nada pré-preenchido. Grupo sem dia não é recusado aqui: a porta
 *  recusa com a frase dela (`GRUPO_SEM_DIA`), e uma segunda frase pro mesmo caso
 *  na tela seria duas fontes. Caixa de hora vazia é recusada aqui, com a frase do
 *  horário de sempre (`HORA_VAZIA`): é o mesmo instrumento.
 *
 *  O "Desfazer" volta a lista inteira ao `valor` de AGORA (a prop). Desmarcar e
 *  marcar de novo o mesmo dia não é mudança: a comparação dos dias é de CONJUNTO. */

/** O título de cada grupo, com o número dele contado de 1 ("Grupo 1"). */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha.
export const TITULO_DO_GRUPO = "Grupo";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha.
export const MAIS_GRUPO = "+ outro grupo";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha.
export const TIRAR_GRUPO = "Tirar este grupo";

/** No lugar do editor, quando o lugar não tem o horário de sempre (T5c). */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha.
export const RESPONDA_O_HORARIO_PRIMEIRO = "Responda primeiro o horário de sempre; aqui entram só os dias que fogem dele.";

type Grupo = { dias: string[]; faixas: Faixa[] };

/** O teto da lista — o mesmo de `problemaDosGrupos`. Repetido aqui (e não
 *  importado de `@/lib/horario`) pela regra do topo de `tipos.ts`; a porta é a
 *  garantia. */
const MAXIMO = 3;

const grupoVazio = (): Grupo => ({ dias: [], faixas: [{ ...FAIXA_VAZIA }] });

const ehGrupo = (v: unknown): v is { dias: unknown[]; faixas: Faixa[] } =>
  typeof v === "object" &&
  v !== null &&
  Array.isArray((v as Grupo).dias) &&
  Array.isArray((v as Grupo).faixas) &&
  (v as Grupo).faixas.length > 0 &&
  (v as Grupo).faixas.every(ehFaixa);

/** O que o documento tem — a lista de grupos —, e um grupo vazio quando não tem
 *  nada legível (documento é dado: forma estranha cai no vazio, nunca estoura). */
function gruposDoValor(valor: unknown): Grupo[] {
  if (Array.isArray(valor) && valor.length > 0 && valor.every(ehGrupo)) {
    return valor.map((g) => ({
      dias: g.dias.filter((d): d is string => typeof d === "string"),
      faixas: g.faixas.map((f) => ({ abre: f.abre, fecha: f.fecha })),
    }));
  }
  return [grupoVazio()];
}

const mesmosDias = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((d) => b.includes(d));

const mesmosGrupos = (a: readonly Grupo[], b: readonly Grupo[]): boolean =>
  a.length === b.length && a.every((g, i) => mesmosDias(g.dias, b[i].dias) && mesmasFaixas(g.faixas, b[i].faixas));

/** 🔴 SEM O HORÁRIO DE SEMPRE, SÓ A LINHA (T5c, spec §6: "exija menos do
 *  usuário"). Um grupo é diferente DO horário de sempre; sem ele, as caixas só
 *  levariam a uma recusa no Salvar. O servidor diz (`campo.semHorario`), e o
 *  corpo do editor nem monta — por isso é uma casca: os hooks moram no `Corpo`. */
export default function EditorGrupos(props: PropsDoEditor) {
  if (props.campo.semHorario) {
    return (
      <p className="adm-editor-sem-horario" data-editor={props.campo.caminho}>
        {RESPONDA_O_HORARIO_PRIMEIRO}
      </p>
    );
  }
  return <CorpoDosGrupos {...props} />;
}

function CorpoDosGrupos({ campo, valor, slug }: PropsDoEditor) {
  const opcoes = campo.opcoes ?? [];
  const palavra = (d: string): string => campo.rotulos?.[d] ?? d;
  const [grupos, setGrupos] = useState<Grupo[]>(() => gruposDoValor(valor));
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui, limparErro } = gravacao;
  const salvos = gruposDoValor(valor);
  const mudou = !mesmosGrupos(grupos, salvos);

  function trocar(i: number, novo: Partial<Grupo>): void {
    setGrupos((antes) => antes.map((g, j) => (j === i ? { ...g, ...novo } : g)));
  }

  function alternar(i: number, dia: string, ligar: boolean): void {
    setGrupos((antes) =>
      antes.map((g, j) => (j === i ? { ...g, dias: ligar ? [...g.dias, dia] : g.dias.filter((d) => d !== dia) } : g)),
    );
  }

  function salvar(): void {
    if (grupos.some((g) => temCaixaVazia(g.faixas))) {
      recusarAqui(HORA_VAZIA);
      return;
    }
    void gravar({
      slug,
      campo: campo.caminho,
      // Os dias na ordem do REGISTRO (a de `campo.opcoes`, que o servidor tira
      // de `DIAS`), nunca a dos toques; as faixas na ordem do dia.
      valor: grupos.map((g) => ({ dias: opcoes.filter((d) => g.dias.includes(d)), faixas: naOrdemDoDia(g.faixas) })),
    });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {grupos.map((g, i) => {
        const nome = `${TITULO_DO_GRUPO} ${i + 1}`;
        // Os dias marcados nos OUTROS grupos: aqui eles aparecem desligados.
        const dosOutros = new Set(grupos.flatMap((o, j) => (j === i ? [] : o.dias)));
        return (
          <div key={i} className="adm-editor-grupo" data-grupo={i}>
            <p className="adm-editor-grupo-titulo">{nome}</p>
            <fieldset className="adm-editor-opcoes" aria-label={nome}>
              {opcoes.map((d) => (
                <label key={d} className="adm-editor-opcao">
                  <input
                    type="checkbox"
                    value={d}
                    checked={g.dias.includes(d)}
                    disabled={salvando || dosOutros.has(d)}
                    onChange={(e) => alternar(i, d, e.target.checked)}
                  />
                  {palavra(d)}
                </label>
              ))}
            </fieldset>
            <CaixasDeFaixas
              faixas={g.faixas}
              mudar={(faixas) => trocar(i, { faixas })}
              prefixo={`${campo.caminho}.${i}.faixas`}
              salvando={salvando}
              nome={nome}
            />
            {grupos.length > 1 && (
              <button
                type="button"
                className="adm-editor-tirar-grupo"
                data-tirar-grupo={i}
                disabled={salvando}
                onClick={() => setGrupos((antes) => antes.filter((_, j) => j !== i))}
              >
                {TIRAR_GRUPO}
              </button>
            )}
          </div>
        );
      })}
      {grupos.length < MAXIMO && (
        <button
          type="button"
          className="adm-editor-mais-grupo"
          data-mais-grupo=""
          disabled={salvando}
          onClick={() => setGrupos((antes) => [...antes, grupoVazio()])}
        >
          {MAIS_GRUPO}
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
      <BotaoDesfazer
        mudou={mudou}
        salvando={salvando}
        aoDesfazer={() => {
          setGrupos(salvos);
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
