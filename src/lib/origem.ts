/** AS PALAVRAS DA ORIGEM DE UM LUGAR (spec de 07/10, Parte 2) — e só elas.
 *
 *  🔴 Elas afirmam coisa sobre a ORIGEM ("o BatePerna não conferiu"), nunca
 *  sobre o lugar, e por isso podem morar num módulo que serve todos: são
 *  verdade em todo lugar que as recebe. O nome de quem mandou NUNCA entra aqui.
 *
 *  🔴 A MEIA-LINHA DA REGRA PADRÃO SAIU (onda de copy de 13/10): o João leu
 *  "regra padrão — ninguém calibrou a chuva aqui" no pacote e mandou TIRAR. A
 *  marca é a etiqueta e a faixa; o carimbo de um lugar sem regra própria se
 *  distingue só pelo "seco" sem "carro comum" (`SECO_SEM_CARRO`, abaixo).
 *
 *  Puro, sem zod: client components (cartão, pin, carimbo) leem direto. */

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const ETIQUETA_NAO_CONFERIDO = "não conferido";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const FAIXA_NAO_CONFERIDO = "Mandado por alguém que usa o app. O BatePerna ainda não conferiu.";

/** A linha seca de um lugar SEM regra própria: a de sempre ("seco · carro
 *  comum", LIDA) com a metade que ninguém conferiu tirada — a spec de 07/10,
 *  Parte 4: "ninguém conferiu que carro comum chega". (A rodada "como se
 *  chega" depois alimenta esta linha.)
 *
 *  Nasceu sem `LIDA` (I6 da pré-auditoria): ele tinha aprovado o
 *  DESENHO ("está certo, pode seguir"), não lido a frase na tela — e "pode
 *  seguir" nunca é "li e aprovei" (memória "trava removida por quem
 *  escreveu"). Foi pro pacote, e ele leu: "Serve", em 13/10. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13. (Subtração de "seco · carro comum", LIDA; a palavra é da spec de 07/10, Parte 4.)
export const SECO_SEM_CARRO = "seco";
