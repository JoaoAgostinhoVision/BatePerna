"use client";
import { MAIS_FAIXA, TIRAR_FAIXA } from "./palavras";

/** AS CAIXAS DE UMA LISTA DE FAIXAS — as linhas de "abre/fecha", o "tirar esta
 *  faixa" e o "+ outra faixa", SEM estado e sem Salvar (18/10).
 *
 *  🔴 SAIU DE DENTRO DO `EditorFaixas`, E NÃO FOI COPIADA. O horário diferente em
 *  alguns dias (`EditorGrupos`) tem, em cada grupo, as MESMAS faixas do horário
 *  de sempre — a mesma regra (`problemaDasFaixas`), o mesmo instrumento. Duas
 *  cópias das caixas seriam duas chances de uma divergir da outra (o nome de
 *  leitor de tela, o teto de 3, o "tirar" só com duas ou mais). Quem guarda a
 *  lista e grava é o editor que a usa; aqui só se desenha e se avisa a mudança.
 *
 *  O que vale aqui vale nos dois (era o docblock do `EditorFaixas`):
 *  - "+ outra faixa" acrescenta uma faixa de caixas VAZIAS, até 3 — o teto da porta;
 *  - "Tirar esta faixa" só aparece com DUAS ou mais (11d-I3): a lista vazia nunca
 *    sai daqui;
 *  - os dois são `type="button"`: mexem na lista NA TELA e não gravam nada. */

export type Faixa = { abre: string; fecha: string };

/** O teto da lista — o mesmo de `problemaDasFaixas`. Repetido aqui (e não
 *  importado de `@/lib/horario`) pela regra do topo de `tipos.ts`; a porta é a
 *  garantia. */
const MAXIMO = 3;

/** O nome de cada caixa pra quem lê a tela em voz alta. São os rótulos que
 *  `horario.abre`/`horario.fecha` tinham em `FichaInteira` até a 11c, quando as
 *  duas folhas deixaram de ser campos; vieram pra cá com o marcador. */
const HORA_DE: Record<keyof Faixa, string> = {
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  abre: "A hora de abrir",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
  fecha: "A hora de fechar",
};

export const ehFaixa = (v: unknown): v is Faixa =>
  typeof v === "object" && v !== null && typeof (v as Faixa).abre === "string" && typeof (v as Faixa).fecha === "string";

export const FAIXA_VAZIA: Faixa = { abre: "", fecha: "" };

/** Alguma caixa vazia? Meia faixa não é faixa — o editor recusa antes da viagem. */
export const temCaixaVazia = (faixas: readonly Faixa[]): boolean => faixas.some((f) => f.abre === "" || f.fecha === "");

/** 🔴 NA ORDEM DO DIA (M-1 da revisão da 11d): "+ outra faixa" põe a nova no
 *  FIM, e a porta recusa lista fora de ordem. Ordenar pelo `abre` não muda o que
 *  ele quis — a tela pública sempre diz as faixas na ordem do dia. "HH:MM"
 *  ordena como texto. Uma cópia: a lista de quem chamou não muda. */
export const naOrdemDoDia = (faixas: readonly Faixa[]): Faixa[] =>
  [...faixas].sort((a, b) => (a.abre < b.abre ? -1 : a.abre > b.abre ? 1 : 0));

/** As mesmas horas, na mesma ordem? Hora por hora, e não `JSON.stringify`: o
 *  documento pode trazer as chaves em outra ordem, e isso não é mudança. */
export const mesmasFaixas = (a: readonly Faixa[], b: readonly Faixa[]): boolean =>
  a.length === b.length && a.every((f, i) => f.abre === b[i].abre && f.fecha === b[i].fecha);

export default function CaixasDeFaixas({
  faixas,
  mudar,
  prefixo,
  salvando,
  nome,
}: {
  faixas: readonly Faixa[];
  /** A lista inteira depois do toque — quem chama guarda. */
  mudar: (faixas: Faixa[]) => void;
  /** O começo do `data-hora` de cada caixa (`horario` → `horario.0.abre`). */
  prefixo: string;
  salvando: boolean;
  /** Só quando há mais de uma lista de faixas no mesmo bloco (os grupos): o nome
   *  dela, na frente do nome de cada caixa — senão o leitor de tela diria "a hora
   *  de abrir" igual em todos os grupos. */
  nome?: string;
}) {
  function trocar(i: number, chave: keyof Faixa, hora: string): void {
    mudar(faixas.map((f, j) => (j === i ? { ...f, [chave]: hora } : f)));
  }
  return (
    <>
      {faixas.map((f, i) => (
        <div key={i} className="adm-editor-faixa" data-faixa={i}>
          {(["abre", "fecha"] as const).map((chave) => {
            const daCaixa = faixas.length > 1 ? `${HORA_DE[chave]} ${i + 1}` : HORA_DE[chave];
            return (
              <input
                key={chave}
                type="time"
                className="adm-editor-hora"
                // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha. É o " · " entre o nome do grupo e o da caixa (18/10).
                aria-label={nome === undefined ? daCaixa : `${nome} · ${daCaixa}`}
                data-hora={`${prefixo}.${i}.${chave}`}
                value={f[chave]}
                onChange={(e) => trocar(i, chave, e.target.value)}
              />
            );
          })}
          {faixas.length > 1 && (
            <button
              type="button"
              className="adm-editor-tirar-faixa"
              data-tirar-faixa={i}
              disabled={salvando}
              onClick={() => mudar(faixas.filter((_, j) => j !== i))}
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
          onClick={() => mudar([...faixas, { ...FAIXA_VAZIA }])}
        >
          {MAIS_FAIXA}
        </button>
      )}
    </>
  );
}
