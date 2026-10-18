import { DIAS, NOME_DO_DIA } from "./semana";

/** AS PALAVRAS DA TELA PARA AS OPÇÕES DAS PERGUNTAS (17/10). O que se grava no
 *  banco continua sendo o valor cru (`gratis`, `pago`, `sab`); aqui mora só o que
 *  a pessoa LÊ na lista. Módulo puro (sem zod, sem registro): desce pro servidor
 *  que monta o `CampoNaTela` e dali pro cliente como objeto raso. */

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const ROTULO_GRATIS = "Grátis";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const ROTULO_PAGO = "Pago";

/** valor gravado → palavra da tela, ou `undefined` quando o campo não tem rótulos
 *  (a opção aparece pelo valor, como era). `dias` usa `NOME_DO_DIA` de `semana.ts`
 *  — o mesmo "domingo…sábado" do carimbo público, uma fonte só. */
export function rotulosDe(caminho: string): Readonly<Record<string, string>> | undefined {
  if (caminho === "custo.tag") return { gratis: ROTULO_GRATIS, pago: ROTULO_PAGO };
  if (caminho === "dias") return Object.fromEntries(DIAS.map((d) => [d, NOME_DO_DIA[d]]));
  return undefined;
}
