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

/** UMA faixa: `abre` e `fecha` em "HH:MM", hora de Recife. */
export type Faixa = { abre: string; fecha: string };

/** 🔴 O HORÁRIO É UMA LISTA DE 1 A 3 FAIXAS desde a Tarefa 11c (2026-10-04),
 *  decisão dele: *"tem lugares que fecham para o almoço, aí fica de 8 às 10 e
 *  14 às 17"*. O lugar está aberto quando a hora cai DENTRO DE ALGUMA faixa.
 *
 *  ⚠️ A FORMA DE ANTES (`{abre, fecha}`, um objeto) CONTINUA SENDO LIDA, PARA
 *  SEMPRE — não é migração temporária. As fichas que já estão no banco foram
 *  gravadas nela, a semente não regrava slug existente, e o "voltar a uma
 *  versão" grava o documento antigo verbatim. Quem a converte é `faixasDe`,
 *  chamada pelo schema de leitura e pelo histórico do painel. */
export type Horario = readonly Faixa[];

/** O formato de uma hora, numa fonte só: o schema (`src/types/ficha.ts`) e a
 *  porta de escrita (`problemaDasFaixas`) leem ESTE. */
export const HHMM = /^\d{2}:\d{2}$/;

/** O agreste não tem horário de verão — mesmo offset fixo que `validade.ts` e
 *  o placar do `ConfirmarFui` usam. Repetir o número aqui seria uma segunda
 *  fonte pro mesmo fato, então ele é IMPORTADO. */
import { OFFSET_RECIFE_S } from "./validade";
import {
  DIAS,
  diasAteAbrir,
  fechadoNoDia,
  rotuloDiaSeguinteAberto,
  rotuloDias,
  rotuloProximoDia,
  rotuloSemana,
  diaDaSemanaRecife,
  type Dia,
} from "./semana";
import { fechadoPeloDono, type Aviso } from "./aviso";

/** As duas formas do horário, lidas como a mesma lista — a função PURA que o
 *  transform do schema e o histórico do painel (`campos-mudados.ts`) usam, pra
 *  as duas leituras nunca discordarem.
 *
 *  Objeto → lista de uma faixa; lista → a mesma lista; qualquer outra coisa →
 *  `undefined`. NÃO confere as faixas por dentro: forma é do schema, regra é de
 *  `problemaDasFaixas`. */
export function faixasDe(horario: unknown): Faixa[] | undefined {
  if (Array.isArray(horario)) return horario as Faixa[];
  if (typeof horario === "object" && horario !== null) return [horario as Faixa];
  return undefined;
}

/** Uma faixa que vira a meia-noite (`fecha` antes de `abre`) ou de 24h
 *  (`abre === fecha`). Só vale SOZINHA na lista. */
const especial = (f: Faixa): boolean => minutosDeHHMM(f.abre) >= minutosDeHHMM(f.fecha);

/** 🔴 AS REGRAS DE UMA LISTA DE FAIXAS VÁLIDA — e elas moram AQUI, não no
 *  schema (11c-I2 da auditoria). No schema elas virariam um 400 de corpo
 *  vazio na porta (o dono leria "Não consegui salvar."), e pior: o schema é o
 *  caminho de LEITURA, e uma regra que um documento já gravado não cumpra
 *  derrubaria a lista inteira da home. Quem chama isto são as portas de
 *  ESCRITA (`aplicarCampo`, `aplicarNoRascunho` e a publicação), que estouram
 *  com a frase.
 *
 *  Devolve a frase da recusa, ou `null` quando a lista serve. As regras:
 *   - de 1 a 3 faixas; `[]` não é "sem horário" — sem horário é a chave
 *     AUSENTE, e o caminho até ela é o "não tem" (11c-C1);
 *   - cada faixa com as duas horas, no formato `HH:MM`;
 *   - com mais de uma faixa: em ordem, sem sobreposição — e nenhuma de 24h nem
 *     atravessando a meia-noite (essas só valem sozinhas, que é o que existia e
 *     estava testado). Faixas que se TOCAM (8–10 e 10–14) passam (M4). */
export function problemaDasFaixas(lista: unknown): string | null {
  if (!Array.isArray(lista)) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    return "o horário é uma lista de faixas, cada uma com a hora de abrir e a de fechar";
  }
  if (lista.length === 0) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    return 'o horário precisa de pelo menos uma faixa: se o lugar não tem hora pra abrir e fechar, use "não tem"';
  }
  if (lista.length > 3) {
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    return "o horário cabe em até 3 faixas";
  }
  for (const f of lista as unknown[]) {
    const faixa = (typeof f === "object" && f !== null ? f : {}) as Record<string, unknown>;
    if (typeof faixa.abre !== "string" || typeof faixa.fecha !== "string") {
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      return "cada faixa do horário precisa da hora de abrir e da hora de fechar";
    }
    const estranha = Object.keys(faixa).find((k) => k !== "abre" && k !== "fecha");
    if (estranha !== undefined) {
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      return `uma faixa do horário só tem a hora de abrir e a de fechar ("${estranha}" não é parte dela)`;
    }
    if (!HHMM.test(faixa.abre) || !HHMM.test(faixa.fecha)) {
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      return `"${faixa.abre}" ou "${faixa.fecha}" não é uma hora (o formato é 08:00)`;
    }
  }
  const faixas = lista as Faixa[];
  if (faixas.length === 1) return null;
  const sozinha = faixas.find(especial);
  if (sozinha) {
    // 🔴 A FRASE DIZ O QUE A FAIXA É (M-2 da revisão da 11c): a que FECHA à
    // meia-noite (14:00–00:00) não "passa" dela, termina nela. A regra é uma só
    // (`especial`); só a palavra se bifurca.
    const eh =
      sozinha.abre === sozinha.fecha
        ? // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          "é de 24 horas"
        : minutosDeHHMM(sozinha.fecha) === 0
          ? // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            "fecha à meia-noite"
          : // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            "passa da meia-noite";
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    return `a faixa ${rotuloFaixaCurta([sozinha])} ${eh}, e uma faixa assim só vale sozinha no horário`;
  }
  for (let i = 1; i < faixas.length; i++) {
    const antes = faixas[i - 1];
    const agora = faixas[i];
    if (minutosDeHHMM(agora.abre) < minutosDeHHMM(antes.abre)) {
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      return (
        `as faixas vão na ordem do dia: a ${rotuloFaixaCurta([agora])} vem antes da ` +
        `${rotuloFaixaCurta([antes])}`
      );
    }
    if (minutosDeHHMM(agora.abre) < minutosDeHHMM(antes.fecha)) {
      // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
      return `as faixas ${rotuloFaixaCurta([antes])} e ${rotuloFaixaCurta([agora])} se sobrepõem`;
    }
  }
  return null;
}

/** O relógio de Recife inteiro: que horas são, que dia da semana é — e o
 *  INSTANTE de onde os dois saíram.
 *
 *  🔴 UM OBJETO, E NÃO DOIS VALORES SOLTOS, e a razão é a meia-noite. Com dois
 *  relógios independentes — um pra hora, outro pro dia — existe um instante em
 *  que um já virou e o outro não, e a tela afirma "fechado, abre amanhã" sobre
 *  um dia que já é hoje. É a mesma regra que fez `Voz` ser um objeto em
 *  `severidade.ts`: dois campos que só fazem sentido juntos viajam juntos.
 *
 *  `epochS` (2026-09-16) é o terceiro campo pela MESMA regra: o prazo do aviso
 *  do dono (`fechadoPeloDono` em `aviso.ts`) precisa do relógio em segundos, e
 *  a saída preguiçosa seria um TERCEIRO hook de minuto em cada componente
 *  (`useVenceu`, `useAgoraRecife` e mais um), três `Date.now()` decidindo a
 *  mesma tela. O instante já era lido aqui, uma vez; ele só passa a viajar
 *  junto. */
export type Agora = { minutos: number; dia: number; epochS: number };

/** TUDO que uma ficha diz sobre quando dá pra entrar. Os dois campos são
 *  independentes: hora sem dia (Pedra Furada, Véu de Noiva), dia sem hora
 *  (Rampa do Pepê), os dois, ou nenhum. Ver o topo de `semana.ts` pra saber por
 *  que `dias` não mora dentro de `horario`. */
export type Abertura = { horario?: Horario; dias?: readonly Dia[]; porDia?: readonly GrupoDeHorario[] };

/** 🔴 UM GRUPO DE DIAS COM OUTRO HORÁRIO (18/10): "sábado e domingo, 7h–12h" num
 *  lugar que abre 8h–17h nos outros dias. `horario` e `dias` ficam EXATAMENTE
 *  como são; o grupo só descreve a DIFERENÇA. Ver o desenho em
 *  `docs/superpowers/specs/2026-10-18-horario-por-dia-design.md`.
 *
 *  ⚠️ LIMITE HONESTO: faixa que atravessa a meia-noite (20h–02h) segue a regra
 *  de sempre — é lida com o horário do dia CORRENTE. A madrugada de sábado não
 *  "pertence" à sexta; nenhum lugar do acervo precisa disso ainda. */
export type GrupoDeHorario = { dias: readonly Dia[]; faixas: Horario };

/** O horário DO DIA `dia` (0 = domingo … 6 = sábado): as faixas do grupo que
 *  contém esse dia, senão o `horario` de sempre. 🔴 Toda leitura de hora passa
 *  por aqui — `fechadoAgora`, `rotuloAbertura`, `rotuloFaixa` —, senão uma tela
 *  diria a hora de um dia usando a de outro. */
export function horarioDoDia(abertura: Abertura, dia: number): Horario | undefined {
  const grupo = abertura.porDia?.find((g) => g.dias.includes(DIAS[dia]));
  return grupo ? grupo.faixas : abertura.horario;
}

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
 *  dois campos (e carrega o próprio instante) — é isto que garante que hora e
 *  dia nunca discordem, nem do prazo do aviso. */
export function agoraRecife(epochS: number): Agora {
  return { minutos: minutosDoDiaRecife(epochS), dia: diaDaSemanaRecife(epochS), epochS };
}

/** A hora cai DENTRO desta faixa? As bordas são as de sempre: no minuto de
 *  abrir já abriu, no minuto de fechar já fechou.
 *
 *  A faixa que VIRA A MEIA-NOITE (`fecha` antes de `abre`, tipo 22:00–05:00)
 *  funciona — não porque alguma ficha precise hoje, mas porque a alternativa
 *  seria uma faixa dessas ser lida ao contrário em silêncio. */
function dentroDaFaixa(faixa: Faixa, minutos: number): boolean {
  const abre = minutosDeHHMM(faixa.abre);
  const fecha = minutosDeHHMM(faixa.fecha);
  if (abre === fecha) return true;                // 24h: nunca fecha
  return abre < fecha
    ? minutos >= abre && minutos < fecha
    : minutos >= abre || minutos < fecha;         // faixa que atravessa a meia-noite
}

/** Está fora das faixas de HORAS agora? Metade da pergunta — quem responde a
 *  pergunta inteira é `fechadoAgora`, logo abaixo.
 *
 *  Fechado é estar fora de TODAS as faixas: no intervalo do almoço (entre 10h
 *  e 14h, num lugar de 8–10 e 14–17) está fechado.
 *
 *  🔴 A LISTA VAZIA NÃO FECHA (11c-C1, o Critical da auditoria). "Fora de todas
 *  as faixas" de uma lista sem faixa nenhuma é "fechado a qualquer hora" — o
 *  carimbo dizendo "Fechado" num lugar cujo dono só tirou as horas. O schema
 *  recusa `[]`; esta guarda é a segunda trava, porque documento é dado. */
export function fechadoNaHora(horario: Horario | undefined, minutos: number | null): boolean {
  if (!horario || horario.length === 0 || minutos === null) return false;
  return !horario.some((faixa) => dentroDaFaixa(faixa, minutos));
}

/** O `abre` da PRÓXIMA faixa ainda hoje, se houver: o MENOR `abre` depois de
 *  agora — nunca "a seguinte no array", que o documento pode trazer fora de
 *  ordem (11c-I2). */
function proximaAberturaHoje(horario: Horario, minutos: number): Faixa | undefined {
  return naOrdemDoDia(horario).find((f) => minutos < minutosDeHHMM(f.abre));
}

/** As faixas na ORDEM DO DIA (pelo `abre`), numa cópia — o documento de quem
 *  chamou não é mexido. É a ordem de toda frase que diz as faixas: o motivo
 *  (`rotuloFaixa`) e o tíquete (`rotuloFaixaCurta`) são a mesma tela, e um
 *  documento fora de ordem (o schema de leitura só confere forma) não pode
 *  sair em duas ordens nela (I-1 da revisão da 11c). */
function naOrdemDoDia(horario: Horario): Faixa[] {
  return [...horario].sort((a, b) => minutosDeHHMM(a.abre) - minutosDeHHMM(b.abre));
}

/** A primeira faixa do dia: o menor `abre` de todos. É dela o "abre amanhã". */
function primeiraDoDia(horario: Horario): Faixa {
  return naOrdemDoDia(horario)[0];
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
 *  pergunta a fazer sobre os DOIS EIXOS: quem chama `fechadoAgora` recebe a
 *  resposta completa do calendário; pra juntar o dono, ver `fechadoHoje`, logo
 *  abaixo. */
export function fechadoAgora(abertura: Abertura | undefined, agora: Agora | null): boolean {
  if (!abertura || agora === null) return false;
  return (
    fechadoNoDia(abertura.dias, agora.dia) || fechadoNaHora(horarioDoDia(abertura, agora.dia), agora.minutos)
  );
}

/** O lugar está fechado AGORA, por QUALQUER das duas causas: o calendário
 *  (hora ou dia da semana, que precisa do relógio) ou o dono (que não precisa
 *  — o aviso já veio do servidor dentro da leitura).
 *
 *  🔴 É A ÚNICA FUNÇÃO QUE JUNTA AS DUAS. `MioloHome` (o chip "só as que dá
 *  hoje") e `FolhaTrilhas` (o cabeçalho do grupo) chamam ESTA, nunca
 *  `fechadoAgora` direto — em 2026-09-15 cada um chamava `fechadoAgora` por
 *  conta própria e os dois ficaram cegos ao dono: um lugar seco em reforma
 *  caía sob "Hoje o tempo deixa" com o selo dizendo "Fechado agora", e
 *  sobrevivia ao chip. Duas chamadas iguais em dois arquivos é a forma exata
 *  de esquecer a segunda causa nos dois.
 *
 *  Com `agora === null` o calendário responde `false` (não se esconde pelo que
 *  não se sabe); o dono responde pelo aviso mesmo assim — e, com o relógio na
 *  mão, só enquanto o aviso não venceu (`epochS` é o mesmo instante de onde
 *  saíram a hora e o dia; ver `fechadoPeloDono`). */
export function fechadoHoje(
  abertura: Abertura | undefined,
  aviso: Aviso | null | undefined,
  agora: Agora | null,
): boolean {
  return fechadoAgora(abertura, agora) || fechadoPeloDono(aviso, agora?.epochS ?? null);
}

/** "05:00" → "5h"; "17:30" → "17h30". Mesma forma do `horaCurtaRecife`, que já
 *  é o jeito deste app escrever hora — duas formas na mesma tela seriam a
 *  mesma trilha com duas caras. */
export function rotuloHora(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** "5h–17h" · "8h–10h · 14h–17h" — as faixas compactas, pro ticket da ficha e
 *  pra lista do acervo, na ordem do dia (`naOrdemDoDia`). Com uma faixa só, sai
 *  como sempre saiu.
 *
 *  🔴 Ela vivia ESCRITA À MÃO dentro de `[slug]/page.tsx` (`${rotuloHora(abre)}–${rotuloHora(fecha)}`),
 *  e ali era a única tela que a mostrava. Com `/trilhas` passando a mostrá-la
 *  também (2026-09-11), duas montagens da mesma string seriam duas telas
 *  podendo escrever a mesma faixa de formas diferentes — a família de sempre.
 *  O travessão é o EN DASH, e é o que separa uma faixa de uma subtração. */
export function rotuloFaixaCurta(horario: Horario): string {
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha — o " · " entre as faixas.
  return naOrdemDoDia(horario).map((f) => `${rotuloHora(f.abre)}–${rotuloHora(f.fecha)}`).join(" · ");
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
  // 🔴 O horário de HOJE decide se fechou e quando reabre hoje; o do PRÓXIMO dia
  // aberto decide a hora do "abre amanhã" — com grupos são faixas diferentes.
  const deHoje = horarioDoDia(abertura, agora.dia);
  if (deHoje && fechadoNaHora(deHoje, agora.minutos)) {
    const hoje = proximaAberturaHoje(deHoje, agora.minutos);
    if (hoje) return `abre às ${rotuloHora(hoje.abre)}`;
    // 🔴 O "amanhã" OLHA `dias` desde a 11c (11c-I5): domingo 18h, num lugar de
    // sábado e domingo, "abre amanhã" era mentira — segunda está fechado.
    const dia = abertura.dias ? rotuloDiaSeguinteAberto(abertura.dias, agora.dia) : "abre amanhã";
    if (dia === null) return null;
    const amanha = (agora.dia + 1) % 7;
    const proximo = abertura.dias ? (amanha + (diasAteAbrir(abertura.dias, amanha) ?? 0)) % 7 : amanha;
    const dele = horarioDoDia(abertura, proximo);
    // Sem faixas no dia que abre, o app CALA em vez de usar as de outro dia.
    if (!dele || dele.length === 0) return null;
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha — o dia pelo nome + a hora.
    return `${dia} às ${rotuloHora(primeiraDoDia(dele).abre)}`;
  }
  return null;
}

/** "Fecha às 17h, abre às 5h." · "Abre sábado e domingo." — a frase do motivo,
 *  na ficha. Com os dois eixos declarados, as duas frases saem juntas: são
 *  fatos diferentes, e esconder um deles faria a pessoa planejar pela metade.
 *
 *  ⚠️ Sem substantivo de propósito: não diz o que fecha. Ver o topo do arquivo. */
export function rotuloFaixa(abertura: Abertura, dia?: number): string {
  const partes: string[] = [];
  if (abertura.dias?.length) partes.push(rotuloSemana(abertura.dias));
  // Com o dia, as faixas DELE (grupo ou base); sem o dia, o base, como sempre.
  const faixas = (dia === undefined ? abertura.horario : horarioDoDia(abertura, dia)) ?? [];
  if (faixas.length === 1) {
    partes.push(`Fecha às ${rotuloHora(faixas[0].fecha)}, abre às ${rotuloHora(faixas[0].abre)}.`);
  } else if (faixas.length > 1) {
    // Com intervalo, "fecha às X, abre às Y" não diz qual das faixas: a frase
    // passa a dizer as faixas, na ordem do dia.
    const das = naOrdemDoDia(faixas).map((f) => `das ${rotuloHora(f.abre)} às ${rotuloHora(f.fecha)}`);
    // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
    partes.push(`Abre ${das.slice(0, -1).join(", ")} e ${das[das.length - 1]}.`);
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
export function aberturaDaFicha(f: {
  horario?: Horario;
  dias?: readonly Dia[];
  horarioPorDia?: readonly GrupoDeHorario[];
}): Abertura {
  return { horario: f.horario, dias: f.dias, porDia: f.horarioPorDia };
}

/** As linhas do horário na ficha quando há grupos: a do horário de sempre (os
 *  dias abertos MENOS os dos grupos) e uma por grupo, cada uma com os dias por
 *  extenso e as horas. Sem `horarioPorDia`: `[]` — a ficha segue como sempre.
 *
 *  Só a leitura; nenhuma tela a usa ainda. */
export function linhasDoHorario(f: {
  horario?: Horario;
  dias?: readonly Dia[];
  horarioPorDia?: readonly GrupoDeHorario[];
}): { dias: string; faixas: string }[] {
  const grupos = f.horarioPorDia;
  if (!grupos || grupos.length === 0) return [];
  const dosGrupos = new Set<Dia>(grupos.flatMap((g) => g.dias));
  const abertos = (f.dias ?? DIAS).filter((d) => !dosGrupos.has(d));
  const linhas: { dias: string; faixas: string }[] = [];
  if (f.horario && abertos.length > 0) {
    linhas.push({ dias: rotuloDias(abertos), faixas: rotuloFaixaCurta(f.horario) });
  }
  for (const g of grupos) linhas.push({ dias: rotuloDias(g.dias), faixas: rotuloFaixaCurta(g.faixas) });
  return linhas;
}

/** 🔴 AS FRASES DA RECUSA DOS GRUPOS (18/10). Uma por causa, DIFERENTES entre si:
 *  nenhuma frase serve a duas causas. */
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_NAO_E_LISTA = "o horário diferente é uma lista de grupos, cada um com os dias e as horas";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_LISTA_VAZIA = 'o horário diferente precisa de pelo menos um grupo: se nenhum dia é diferente, use "não tem"';
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_MAIS_DE_TRES = "o horário diferente cabe em até 3 grupos de dias";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_SEM_HORARIO = "sem o horário de sempre não dá pra dizer o que é diferente: ponha primeiro o horário";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_MAL_FORMADO = "cada grupo do horário diferente tem os dias e as horas";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_SEM_DIA = "cada grupo do horário diferente precisa de pelo menos um dia";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_DIA_DESCONHECIDO = "um dia do horário diferente não é um dia da semana";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_SEM_FAIXA = "cada grupo do horário diferente precisa de pelo menos uma faixa de horas";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_DIA_REPETIDO = "um mesmo dia não pode estar em dois grupos do horário diferente";
/** O mesmo dia DUAS VEZES num grupo só (T2, da revisão da T1): caía na frase
 *  de cima, que fala de "dois grupos" com um grupo só na tela — causa errada. A
 *  tela não produz isto (caixas de marcar); a porta pode receber. Recusa, e não
 *  tira a repetição calada: um corpo assim é defeito de quem mandou, e
 *  consertá-lo em silêncio esconderia o defeito. */
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_DIA_REPETIDO_NO_GRUPO = "um grupo do horário diferente tem o mesmo dia duas vezes";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_DIA_FECHADO = "um grupo do horário diferente tem um dia em que o lugar não abre";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_COBRE_TUDO = "os grupos cobrem todos os dias em que o lugar abre: o horário de sempre nunca valeria, então mude o horário de sempre";
// PENDENTE: redação minha, o João ainda não leu
export const GRUPO_IGUAL_AO_HORARIO = "um grupo tem as mesmas horas do horário de sempre, então não é diferente";

/** A regra de escrita de `horarioPorDia` — função pura, chamada pelas portas de
 *  ESCRITA (não pelo schema de leitura, pela razão de `problemaDasFaixas`).
 *  `null` = válido; senão, a frase da recusa. `doc` é o documento onde o campo
 *  vai morar (precisa do `horario` e dos `dias`).
 *
 *  A ordem das checagens é a da pergunta que o dono precisa responder primeiro:
 *  forma, horário-base, cada grupo, entre grupos, contra o lugar. */
export function problemaDosGrupos(
  grupos: unknown,
  doc: { horario?: unknown; dias?: unknown },
): string | null {
  if (!Array.isArray(grupos)) return GRUPO_NAO_E_LISTA;
  if (grupos.length === 0) return GRUPO_LISTA_VAZIA;
  if (grupos.length > 3) return GRUPO_MAIS_DE_TRES;
  const base = faixasDe(doc.horario);
  if (base === undefined) return GRUPO_SEM_HORARIO;

  const vistos = new Set<string>();
  for (const g of grupos as unknown[]) {
    if (typeof g !== "object" || g === null || Array.isArray(g)) return GRUPO_MAL_FORMADO;
    const { dias, faixas } = g as Record<string, unknown>;
    if (!Array.isArray(dias) || dias.length === 0) return GRUPO_SEM_DIA;
    if (dias.some((d) => !(DIAS as readonly unknown[]).includes(d))) return GRUPO_DIA_DESCONHECIDO;
    if (new Set(dias).size !== dias.length) return GRUPO_DIA_REPETIDO_NO_GRUPO;
    if (!Array.isArray(faixas) || faixas.length === 0) return GRUPO_SEM_FAIXA;
    const dasFaixas = problemaDasFaixas(faixas);
    if (dasFaixas !== null) return dasFaixas;
    for (const d of dias as string[]) {
      if (vistos.has(d)) return GRUPO_DIA_REPETIDO;
      vistos.add(d);
    }
  }

  const abertos: readonly string[] = Array.isArray(doc.dias) ? (doc.dias as string[]) : DIAS;
  if ([...vistos].some((d) => !abertos.includes(d))) return GRUPO_DIA_FECHADO;
  if (abertos.every((d) => vistos.has(d))) return GRUPO_COBRE_TUDO;

  const igual = (a: Faixa[], b: Faixa[]) => {
    const x = naOrdemDoDia(a);
    const y = naOrdemDoDia(b);
    return x.length === y.length && x.every((f, i) => f.abre === y[i].abre && f.fecha === y[i].fecha);
  };
  for (const g of grupos as { faixas: Faixa[] }[]) {
    if (igual(g.faixas, base)) return GRUPO_IGUAL_AO_HORARIO;
  }
  return null;
}
