/** QUANDO dá pra entrar num lugar — a hora do dia e, desde 2026-09-11, o dia da
 *  semana.
 *
 *  🔴 POR QUE ISTO EXISTE (2026-08-27). O carimbo só olhava CHUVA. A Pedra
 *  Furada fecha às 17h, então às 18h com céu limpo a ficha dizia "Pode ir" com
 *  o lugar fechado havia uma hora — o app afirmando mais do que sabe, a mesma
 *  família do `SEM INFORMAÇÕES · tome cuidado` da v3.4. Decisão dele: **o
 *  carimbo passa a olhar a hora.**
 *
 *  🔴 E EM 2026-09-11 O MESMO DEFEITO APARECEU NUM EIXO NOVO: a Rampa do Pepê
 *  recebe visita só aos sábados e domingos, e o app dizia "Pode ir" na quarta.
 *  O eixo do DIA mora em `src/lib/semana.ts`; **este arquivo é quem junta os
 *  dois**, e é de propósito que `fechadoAgora` continue sendo a função com esse
 *  nome: nenhum call site pode acabar perguntando metade da pergunta.
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
import {
  fechadoNoDia,
  rotuloProximoDia,
  rotuloSemana,
  diaDaSemanaRecife,
  type Dia,
} from "./semana";

/** O relógio de Recife inteiro: que horas são E que dia da semana é.
 *
 *  🔴 UM OBJETO, E NÃO DOIS VALORES SOLTOS, e a razão é a meia-noite. Com dois
 *  relógios independentes — um pra hora, outro pro dia — existe um instante em
 *  que um já virou e o outro não, e a tela afirma "fechado, abre amanhã" sobre
 *  um dia que já é hoje. É a mesma regra que fez `Voz` ser um objeto em
 *  `severidade.ts`: dois campos que só fazem sentido juntos viajam juntos. */
export type Agora = { minutos: number; dia: number };

/** TUDO que uma ficha diz sobre quando dá pra entrar. Os dois campos são
 *  independentes: hora sem dia (Pedra Furada, Véu de Noiva), dia sem hora
 *  (Rampa do Pepê), os dois, ou nenhum. Ver o topo de `semana.ts` pra saber por
 *  que `dias` não mora dentro de `horario`. */
export type Abertura = { horario?: Horario; dias?: readonly Dia[] };

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

/** O relógio inteiro a partir de um instante. UMA leitura do `Date` produz os
 *  dois campos — é isto que garante que hora e dia nunca discordem. */
export function agoraRecife(epochS: number): Agora {
  return { minutos: minutosDoDiaRecife(epochS), dia: diaDaSemanaRecife(epochS) };
}

/** Está fora da faixa de HORAS agora? Metade da pergunta — quem responde a
 *  pergunta inteira é `fechadoAgora`, logo abaixo.
 *
 *  A faixa que VIRA A MEIA-NOITE (`fecha` antes de `abre`, tipo 22:00–05:00)
 *  funciona — não porque alguma ficha precise hoje, mas porque a alternativa
 *  seria uma faixa dessas ser lida ao contrário em silêncio. */
export function fechadoNaHora(horario: Horario | undefined, minutos: number | null): boolean {
  if (!horario || minutos === null) return false;
  const abre = minutosDeHHMM(horario.abre);
  const fecha = minutosDeHHMM(horario.fecha);
  if (abre === fecha) return false;               // 24h: nunca fecha
  return abre < fecha
    ? minutos < abre || minutos >= fecha
    : minutos < abre && minutos >= fecha;         // faixa que atravessa a meia-noite
}

/** Está fechado AGORA? — a pergunta INTEIRA, pelos dois eixos.
 *
 *  `agora === null` é o primeiro render, antes de o relógio do cliente falar —
 *  e a resposta tem que ser `false` (ver `useAgoraRecife`). Ficha sem horário e
 *  sem dias também é `false`: **o app não sabe que fecha, então não afirma que
 *  fechou**. É a mesma régua do `piso` e do `secaRapido`.
 *
 *  🔴 É DE PROPÓSITO QUE ESTA FUNÇÃO GUARDE O NOME `fechadoAgora`. Quando o
 *  eixo do dia entrou, a saída preguiçosa era deixar `fechadoAgora` cuidando só
 *  da hora e pedir a cada componente que chamasse também a do dia e juntasse as
 *  duas — QUATRO componentes fazendo a mesma montagem à mão, que é a família de
 *  defeito que este projeto já pagou três vezes (a palavra e a cor nascendo de
 *  commits diferentes; `vozDaFicha` existe pela mesma razão). Aqui não há meia
 *  pergunta a fazer: quem chama `fechadoAgora` recebe a resposta completa. */
export function fechadoAgora(abertura: Abertura | undefined, agora: Agora | null): boolean {
  if (!abertura || agora === null) return false;
  return (
    fechadoNoDia(abertura.dias, agora.dia) || fechadoNaHora(abertura.horario, agora.minutos)
  );
}

/** A próxima abertura é HOJE ainda, ou só amanhã? Só faz sentido quando já se
 *  sabe que está fechado — é o que separa "abre às 5h" de "abre amanhã às 5h",
 *  e a diferença entre as duas frases é o dia inteiro de quem lê. */
export function abreAindaHoje(horario: Horario, minutos: number): boolean {
  return minutos < minutosDeHHMM(horario.abre);
}

/** "05:00" → "5h"; "17:30" → "17h30". Mesma forma do `horaCurtaRecife`, que já
 *  é o jeito deste app escrever hora — duas formas na mesma tela seriam a
 *  mesma trilha com duas caras. */
export function rotuloHora(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** A linha de baixo do carimbo fechado: "abre às 5h", "abre amanhã às 5h",
 *  "abre sábado", "abre amanhã".
 *
 *  🔴 O DIA GANHA DA HORA, e não é arbitrário: numa quarta-feira, num lugar que
 *  só abre sábado, dizer "abre às 5h" é verdade sobre o relógio e mentira sobre
 *  a viagem. Quem perdeu o dia precisa ouvir do dia.
 *
 *  🔴 O "amanhã" não é enfeite: quem lê isto às 18h precisa saber que perdeu o
 *  dia, e quem lê às 4h precisa saber que é só esperar. A MESMA frase nos dois
 *  casos mentiria pra metade das pessoas. Mora aqui, e não nos componentes,
 *  porque a ficha e o cartão da home mostram a mesma linha — duas fontes pro
 *  mesmo texto é o defeito que o `marcaDe` acabou de fechar.
 *
 *  `null` quando não há o que dizer com honestidade — o app CALA em vez de
 *  inventar um horário que ninguém deu. */
export function rotuloAbertura(abertura: Abertura, agora: Agora): string | null {
  if (abertura.dias && fechadoNoDia(abertura.dias, agora.dia)) {
    return rotuloProximoDia(abertura.dias, agora.dia);
  }
  if (abertura.horario && fechadoNaHora(abertura.horario, agora.minutos)) {
    const hora = rotuloHora(abertura.horario.abre);
    return abreAindaHoje(abertura.horario, agora.minutos)
      ? `abre às ${hora}`
      : `abre amanhã às ${hora}`;
  }
  return null;
}

/** "Fecha às 17h, abre às 5h." · "Abre sábado e domingo." — a frase do motivo,
 *  na ficha. Com os dois eixos declarados, as duas frases saem juntas: são
 *  fatos diferentes, e esconder um deles faria a pessoa planejar pela metade.
 *
 *  ⚠️ Sem substantivo de propósito: não diz o que fecha. Ver o topo do arquivo. */
export function rotuloFaixa(abertura: Abertura): string {
  const partes: string[] = [];
  if (abertura.dias?.length) partes.push(rotuloSemana(abertura.dias));
  if (abertura.horario) {
    partes.push(
      `Fecha às ${rotuloHora(abertura.horario.fecha)}, abre às ${rotuloHora(abertura.horario.abre)}.`,
    );
  }
  return partes.join(" ");
}

/** A abertura de uma ficha, montada num lugar só.
 *
 *  🔴 Existe pela MESMA razão que `vozDaFicha` em `severidade.ts`: são quatro
 *  telas que precisam do par (`Carimbo`, `SeloTrilha`, `PinTrilha`,
 *  `FolhaTrilhas`), e quatro montagens à mão é a família de defeito que este
 *  projeto já pagou três vezes. Com o eixo do dia recém-chegado o risco é
 *  concreto: bastaria uma dessas telas montar `{ horario }` e esquecer `dias`
 *  pra o mapa pintar o pin verde num dia em que o carimbo diz "Fechado agora".
 *
 *  Recebe a ficha estruturalmente, e não o tipo `Ficha`, pra este módulo
 *  continuar sem zod — mesmo motivo escrito no topo. */
export function aberturaDaFicha(f: { horario?: Horario; dias?: readonly Dia[] }): Abertura {
  return { horario: f.horario, dias: f.dias };
}
