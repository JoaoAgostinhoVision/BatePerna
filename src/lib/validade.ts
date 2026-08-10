/** Quanto tempo uma leitura de chuva ainda vale. Passou disso, o carimbo
 *  para de afirmar: a regra da Rampa olha 3h à frente, e previsão vira. */
export const VALIDADE_S = 30 * 60;

const OFFSET_RECIFE_S = -3 * 3600;

/** Epoch em SEGUNDOS nos dois argumentos.
 *  Relógio atrasado do lado do cliente não vence carimbo — na dúvida, vale. */
export function carimboVenceu(calculadoEm: number, agora: number): boolean {
  return agora - calculadoEm >= VALIDADE_S;
}

/** "8h12" no fuso de Recife. Mesmo offset fixo que ConfirmarFui usa pro
 *  placar do dia: o agreste não tem horário de verão. */
export function horaCurtaRecife(epochS: number): string {
  const local = new Date((epochS + OFFSET_RECIFE_S) * 1000);
  const h = local.getUTCHours();
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}
