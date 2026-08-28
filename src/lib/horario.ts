/** A faixa de horário em que dá pra entrar num lugar.
 *
 *  🔴 POR QUE ISTO EXISTE (2026-08-27). O carimbo só olhava CHUVA. A Pedra
 *  Furada fecha às 17h, então às 18h com céu limpo a ficha dizia "Pode ir" com
 *  o lugar fechado havia uma hora — o app afirmando mais do que sabe, a mesma
 *  família do `SEM INFORMAÇÕES · tome cuidado` da v3.4. Decisão dele: **o
 *  carimbo passa a olhar a hora.**
 *
 *  ⚠️ NENHUM SUBSTANTIVO DE LUGAR MORA AQUI. Nem "portão", nem "guarita", nem
 *  "entrada": foi exatamente esse tipo de palavra que passou o dia 2026-08-27
 *  inteiro sendo arrancada do código (o carimbo, o "✓ Fui", o chip do custo).
 *  A tela diz "Fecha às 17h · abre às 5h" e pronto; **o nome da coisa que
 *  fecha, quando importar, é prosa da ficha** — cabe no `acesso`, e o
 *  `custo.curto` já é o precedente de como fazer isso virar campo.
 *
 *  Puro de propósito, sem zod e sem `node:fs`: client components leem este
 *  módulo direto. Mesma razão que já exilou `piso.ts` — a razão inteira está
 *  escrita lá. */

/** `abre` e `fecha` em "HH:MM", hora de Recife. */
export type Horario = { abre: string; fecha: string };

/** O agreste não tem horário de verão — mesmo offset fixo que `validade.ts` e
 *  o placar do `ConfirmarFui` usam. Repetir o número aqui seria uma segunda
 *  fonte pro mesmo fato, então ele é IMPORTADO. */
import { OFFSET_RECIFE_S } from "./validade";

/** "17:30" → 1050. Aceita só o formato que o schema deixa entrar. */
export function minutosDeHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Quantos minutos desde a meia-noite de Recife. */
export function minutosDoDiaRecife(epochS: number): number {
  const local = new Date((epochS + OFFSET_RECIFE_S) * 1000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Está fechado AGORA?
 *
 *  `agora === null` é o primeiro render, antes de o relógio do cliente falar —
 *  e a resposta tem que ser `false` (ver `useAgoraRecife`). Ficha SEM horário
 *  também é `false`: **o app não sabe que fecha, então não afirma que fechou**.
 *  É a mesma régua do `piso` e do `secaRapido`.
 *
 *  A faixa que VIRA A MEIA-NOITE (`fecha` antes de `abre`, tipo 22:00–05:00)
 *  funciona — não porque alguma ficha precise hoje, mas porque a alternativa
 *  seria uma faixa dessas ser lida ao contrário em silêncio. */
export function fechadoAgora(horario: Horario | undefined, agora: number | null): boolean {
  if (!horario || agora === null) return false;
  const abre = minutosDeHHMM(horario.abre);
  const fecha = minutosDeHHMM(horario.fecha);
  if (abre === fecha) return false;               // 24h: nunca fecha
  return abre < fecha
    ? agora < abre || agora >= fecha
    : agora < abre && agora >= fecha;             // faixa que atravessa a meia-noite
}

/** A próxima abertura é HOJE ainda, ou só amanhã? Só faz sentido quando já se
 *  sabe que está fechado — é o que separa "abre às 5h" de "abre amanhã às 5h",
 *  e a diferença entre as duas frases é o dia inteiro de quem lê. */
export function abreAindaHoje(horario: Horario, agora: number): boolean {
  return agora < minutosDeHHMM(horario.abre);
}

/** "05:00" → "5h"; "17:30" → "17h30". Mesma forma do `horaCurtaRecife`, que já
 *  é o jeito deste app escrever hora — duas formas na mesma tela seriam a
 *  mesma trilha com duas caras. */
export function rotuloHora(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** "abre às 5h" ou "abre amanhã às 5h" — a linha de baixo do carimbo fechado.
 *
 *  🔴 O "amanhã" não é enfeite: quem lê isto às 18h precisa saber que perdeu o
 *  dia, e quem lê às 4h precisa saber que é só esperar. A MESMA frase nos dois
 *  casos mentiria pra metade das pessoas. Mora aqui, e não nos componentes,
 *  porque a ficha e o cartão da home mostram a mesma linha — duas fontes pro
 *  mesmo texto é o defeito que o `marcaDe` acabou de fechar. */
export function rotuloAbertura(horario: Horario, agora: number): string {
  const hora = rotuloHora(horario.abre);
  return abreAindaHoje(horario, agora) ? `abre às ${hora}` : `abre amanhã às ${hora}`;
}

/** "fecha às 17h, abre às 5h" — a frase do motivo, na ficha.
 *
 *  ⚠️ Sem substantivo de propósito: não diz o que fecha. Ver o topo do arquivo. */
export function rotuloFaixa(horario: Horario): string {
  return `Fecha às ${rotuloHora(horario.fecha)}, abre às ${rotuloHora(horario.abre)}.`;
}
