#!/usr/bin/env node
/** 🔴 O HARNESS DE MUTAÇÃO DO `src/lib/coerencia.ts` — refeito do zero em
 *  2026-09-27 (rodada de conserto 3/5) porque o original vivia em
 *  `scratchpad/mutar.mjs`, uma pasta efêmera de sessão, e morreu com a pausa.
 *  Este arquivo é a fonte única das 34 mutações acumuladas nas rodadas
 *  anteriores (16 da extração + 12 da rodada 1/5 + 6 da rodada 2/5) — nenhuma
 *  foi reinventada; cada uma foi reconstruída lendo `task-2-report.md` e o
 *  código atual, e o que era ambíguo está anotado abaixo, mutação por mutação.
 *
 *  ## (a) AS QUATRO CATEGORIAS, E POR QUE "SEM ALVO" NÃO É RESULTADO
 *
 *  Cada mutação cai em uma de quatro categorias, nunca "sobreviveu = bom":
 *
 *   - **morreu**      — a mutação entrou (há diff) e a suíte ficou vermelha.
 *                       É o único resultado que prova cobertura.
 *   - **sobreviveu**  — a mutação entrou e a suíte ficou VERDE. É um BURACO
 *                       real: o exame que aquela mutação desliga não tem
 *                       prova nenhuma.
 *   - **sem alvo**    — o texto que a mutação procura não foi encontrado
 *                       (ficou 0 ocorrências) OU foi encontrado mais de uma
 *                       vez (ficou ambíguo, e aplicar a errada não mede nada).
 *                       Isto é AUSÊNCIA DE MEDIÇÃO, não sucesso: a régua nunca
 *                       chegou a tocar o código. Sem alvo nunca deve ser lido
 *                       como "a suíte protegeu isto".
 *   - **sem diff**    — o texto foi trocado mas `git diff --numstat` voltou
 *                       vazio (a troca não mudou nada, ou o arquivo já estava
 *                       sujo antes de começar). Também é ausência de medição.
 *
 *  As últimas duas categorias existem exatamente porque a rodada 2/5 mediu
 *  "0 sem alvo" sem ter a categoria — sete mutações silenciosamente pararam
 *  de aplicar, e o placar registrado não sabia disso. Ver item (b).
 *
 *  ## (b) A ARMADILHA DO CRLF, E COMO ESTE HARNESS A NEUTRALIZA
 *
 *  Nesta máquina `git config core.autocrlf` é `true` e o repo NÃO tem
 *  `.gitattributes`. Os blobs de TODOS os commits desta branch são LF puro;
 *  é o CHECKOUT que sai em CRLF, sempre, em qualquer sessão nesta máquina —
 *  não é acidente de uma rodada, é a condição padrão, e vale igualmente para
 *  um checkout fresco de qualquer commit anterior.
 *
 *  A RECEITA PARA MEDIR, e ela tem uma armadilha que já pegou este arquivo:
 *
 *      git cat-file -p <sha>:<arquivo> | od -An -tx1 -v | tr -s " " "\n" \\
 *        | grep -c "^0d$"
 *
 *  O `-v` é obrigatório (sem ele o `od` colapsa linhas repetidas num `*` e
 *  some com bytes) e o `tr` também. A versão curta que este docblock trazia
 *  antes — `od -An -tx1 | grep -c "0d0a"` — devolve **0 em qualquer arquivo,
 *  inclusive num 100% CRLF**, porque o `od` imprime os bytes separados por
 *  espaço (`0d 0a`) e `0d0a` nunca aparece. Era uma régua que só sabia dar a
 *  resposta confortável. Medido em 27/09 contra um arquivo de teste com CRLF
 *  conhecido: a receita antiga disse 0, a de cima disse 2.
 *
 *  ⚠️  E o que este docblock afirmava sobre o `grep` era FALSO, medido no
 *  mesmo dia. `grep`/`cat`/`sed` deste Git Bash NÃO traduzem CRLF→LF e NÃO
 *  mentem sobre `\r`: os mounts do MSYS aqui são **binary** (`mount` mostra
 *  `C: on /c type ntfs (binary,noacl,posix=0,...)`), `grep -c $"\r"` em
 *  `src/lib/coerencia.ts` devolve 592 e o `od` devolve os mesmos 592, e o
 *  `wc -c` bate byte a byte com `fs.readFileSync(...).length` do Node. Use
 *  `od` por ser o instrumento mais direto, não porque o `grep` minta.
 *
 *  Este harness lê o arquivo com `fs.readFileSync(..., "utf8")`: bytes como
 *  eles são, sem tradução de fim de linha.
 *  Ele NORMALIZA para LF antes de procurar o alvo (`\r\n` → `\n`),
 *  aplica a troca, e DEVOLVE para CRLF antes de escrever de volta em disco
 *  **se e somente se o arquivo já estava em CRLF** — para o `git diff
 *  --numstat` continuar mostrando só a linha mutada (o git normaliza CRLF↔LF
 *  na comparação por causa do `autocrlf`, mas só se o resto do arquivo
 *  continuar no mesmo final de linha que o blob espera na superfície).
 *
 *  ## (c) COMO ACRESCENTAR UMA MUTAÇÃO NOVA
 *
 *  Adicione uma entrada em `MUTACOES` com: `id` (novo, nunca reusado),
 *  `arquivo` (caminho relativo à raiz do repo), `edicoes` (lista de
 *  `{ inicio, fim, espera, novo }` em linhas 1-indexadas do arquivo NORMAL-
 *  IZADO PRA LF; `espera` é o texto exato que deve estar ali — o harness
 *  RECUSA aplicar se não bater, e cai em "sem alvo"; `novo` é o texto que
 *  substitui, ou `null` para apagar as linhas), e `mata` (o nome do teste, ou
 *  parte dele, que se espera que morra — só documentação, o harness não força
 *  isso). Rode `node scripts/mutar.mjs <id>` sozinho pra conferir antes de
 *  integrar ao conjunto.
 *
 *  ## Por que este arquivo é `.mjs` e não `.ts`
 *
 *  `tsconfig.json` só inclui `**\/*.ts` e `**\/*.tsx` — um `.mjs` nunca entra
 *  em `npx tsc --noEmit`. E o `next build` só compila o que está no grafo de
 *  módulos importado pelas rotas; nada em `src/` importa este arquivo. Os
 *  dois são medidos ao fim de uma rodada (ver `task-2-report.md`) exatamente
 *  para prová-lo, não só para presumir.
 *
 *  ## Onde a reconstrução foi AMBÍGUA, e o que eu escolhi
 *
 *  - **M2 / M6 / M15 / N4** mutam a MESMA linha (o guarda de
 *    `f.custo.tag !== "pago" || !f.custo.curto` nasce IDÊNTICO em quatro
 *    regras de custo: `preco-legivel-no-custo`, `chip-bate-com-preco`,
 *    `chip-cabe-na-pilula`, `chip-nao-repete-a-linha`). Escolhi sempre a
 *    ocorrência de `preco-legivel-no-custo` (a primeira da tabela) para as
 *    quatro mutações que o relatório amarra a essa regra ou a uma prova
 *    genérica de não-vacuidade — cada `espera` inclui a linha `regra:
 *    "preco-legivel-no-custo",` acima do guarda, então o harness recusa
 *    aplicar em qualquer outra regra por engano. M2 usa a ocorrência de
 *    `chip-bate-com-preco` (é a que o relatório nomeia).
 *  - **M7 ("a regra dos dias devolve [] sempre")** não diz qual das DUAS
 *    regras de dia (`dia-repetido-ou-inventado` × `semana-inteira-nao-
 *    declara`). Escolhi `dia-repetido-ou-inventado`, por ser a que o dono lê
 *    primeiro na tabela e a que tem quebra dedicada em `QUEBRAS`.
 *  - **N9 e N10 não têm identificador nenhum no relatório** — o texto lista
 *    "12 novas" (N1..N12) mas só nomeia N1, N2..N8, N11, N12 em prosa (10).
 *    A seção "I1.6, I2, I3 — três frases que mentiam pro dono" descreve TRÊS
 *    consertos de frase (horário invertido, grafia do dia, semana vazia) e
 *    só amarra explicitamente N11 ao primeiro. Fiz a reconstrução honesta: os
 *    testes que fecham os outros dois consertos existem nomeados em
 *    `tests/lib/coerencia.test.ts` ("a frase do dia não reconhecido fala de
 *    GRAFIA…" e "a frase da semana inteira não manda esvaziar…"), então
 *    escolhi N9 = reverter a frase da grafia do dia, N10 = reverter a frase
 *    da semana vazia — na ordem em que a prosa do relatório os lista.
 *  - **N11 e B1a acabam sendo a MESMA mutação** (colapsar `abre === fecha`
 *    pra sempre verdadeiro). Não é duplicata por engano: N11 nasceu na
 *    rodada 1/5 medindo só essa direção; a rodada 2/5 (B1a/B1b) mediu as DUAS
 *    direções da mesma bifurcação depois de achar que a rodada 1/5 só tinha
 *    provado uma. Mantive as duas entradas — cada uma documenta uma rodada
 *    diferente — mas quem rodar as 34 vai ver os dois placares idênticos, e
 *    isto está dito aqui para não parecer erro de cópia.
 *  - **"a regra do chip" em M2** é `chip-bate-com-preco` (é o que o
 *    relatório nomeia: "o chip que não bate com o preço é pego"), não
 *    `chip-cabe-na-pilula` nem `chip-nao-repete-a-linha`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const RAIZ = process.cwd();

function lerLF(relativo) {
  const abs = path.join(RAIZ, relativo);
  const bruto = readFileSync(abs, "utf8");
  const crlf = bruto.includes("\r\n");
  const lf = bruto.replace(/\r\n/g, "\n");
  return { abs, crlf, lf };
}

function escreverLF(abs, lf, crlf) {
  writeFileSync(abs, crlf ? lf.replace(/\n/g, "\r\n") : lf, "utf8");
}

/** Conta ocorrências de `alvo` dentro do texto do arquivo (já em LF), pra
 *  detectar tanto "não achei" (0) quanto "achei em mais de um lugar, e
 *  aplicar a errada não prova nada" (>1). As duas viram "sem alvo". */
function contarOcorrencias(lf, alvo) {
  if (alvo === "") return 0;
  let n = 0, i = 0;
  while ((i = lf.indexOf(alvo, i)) !== -1) { n++; i += Math.max(alvo.length, 1); }
  return n;
}

/** Aplica uma lista de edições de linha (1-indexadas, inclusive) sobre o
 *  conteúdo LF do arquivo. Cada edição confere que as linhas [inicio,fim]
 *  são EXATAMENTE `espera` antes de trocar por `novo` (ou apagar, se `novo`
 *  for `null`). Se qualquer edição não bater, devolve `null` (sem alvo) — a
 *  função nunca aplica metade das edições de uma mutação. */
function aplicarEdicoes(lf, edicoes) {
  const linhas = lf.split("\n");
  // Confere TODAS antes de mexer em qualquer uma, pra não aplicar pela metade.
  for (const { inicio, fim, espera } of edicoes) {
    const atual = linhas.slice(inicio - 1, fim).join("\n");
    if (atual !== espera) return null;
  }
  // Aplica de trás pra frente, pra os índices das edições anteriores não
  // deslizarem quando uma edição apaga ou insere linha.
  const ordenadas = [...edicoes].sort((a, b) => b.inicio - a.inicio);
  for (const { inicio, fim, novo } of ordenadas) {
    const novasLinhas = novo === null ? [] : novo.split("\n");
    linhas.splice(inicio - 1, fim - inicio + 1, ...novasLinhas);
  }
  return linhas.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// AS 34 MUTAÇÕES — 16 da extração (M) + 12 da rodada 1/5 (N) + 6 da rodada
// 2/5 (B), reconstruídas de `task-2-report.md` contra o `src/lib/coerencia.ts`
// e o `src/app/[slug]/page.tsx` de HOJE.
// ═══════════════════════════════════════════════════════════════════════════

const COERENCIA = "src/lib/coerencia.ts";
const PAGINA = "src/app/[slug]/page.tsx";

const MUTACOES = [
  {
    id: "M1",
    titulo: "violacoesDoAcervo devolve [] sempre",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 591, fim: 591,
      espera: '  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));',
      novo: '  return [];',
    }],
    mata: "cada uma das 13 regras dispara na quebra escrita pra ela",
  },
  {
    id: "M2",
    titulo: "desliga a regra do chip (chip-bate-com-preco)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 196, fim: 199,
      espera: [
        '    regra: "chip-bate-com-preco",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (f.custo.tag !== "pago" || !f.custo.curto) return []; // ausente é silêncio',
      ].join("\n"),
      novo: [
        '    regra: "chip-bate-com-preco",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (true) return []; // ausente é silêncio (mutacao M2: regra desligada)',
      ].join("\n"),
    }],
    mata: 'o caso de cobertura novo, e "o chip que não bate com o preço é pego"',
  },
  {
    id: "M3",
    titulo: "a regra do piso ignora a prosa",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 365, fim: 365,
      espera: '        if (estranhos.length === 0) return [];',
      novo: '        if (true) return []; // mutacao M3: regra do piso ignora a prosa',
    }],
    mata: "a prosa que nomeia piso diferente do campo é pega",
  },
  {
    id: "M4",
    titulo: "`frase` passa a ser `regra`",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 591, fim: 591,
      espera: '  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));',
      novo: '  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a, frase: r.regra })));',
    }],
    mata: "a frase da violação nomeia o lugar e não é o identificador da regra",
  },
  {
    id: "M5",
    titulo: "frase emprestada compara a ficha consigo mesma",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 284, fim: 284,
      espera: '        const k = f.secaRapido.trim().toLowerCase();',
      novo: '        const k = f.slug; // mutacao M5: chave por ficha, nunca agrupa com outra',
    }],
    mata: "uma ficha que empresta a frase de outra é pega",
  },
  {
    id: "M5b",
    titulo: "frase emprestada acusa o grupo inteiro (inclusive o 1º)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 288, fim: 288,
      espera: '        grupo.slice(1).map((f) => ({',
      novo: '        grupo.map((f) => ({ // mutacao M5b: acusa o grupo inteiro, inclusive o 1º',
    }],
    mata: "a ficha sozinha, com a frase dela mesma, não é acusada de emprestar",
  },
  {
    id: "M6",
    titulo: "desliga a regra do preço legível (preco-legivel-no-custo)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 160, fim: 163,
      espera: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (f.custo.tag !== "pago" || !f.custo.curto) return [];',
      ].join("\n"),
      novo: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (true) return []; // mutacao M6: regra desligada',
      ].join("\n"),
    }],
    mata: 'o caso de cobertura novo ("todas as regras do módulo são conferidas contra o acervo real, uma a uma")',
  },
  {
    id: "M7",
    titulo: "a regra dos dias devolve [] (dia-repetido-ou-inventado)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 515, fim: 518,
      espera: [
        '    regra: "dia-repetido-ou-inventado",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (!f.dias?.length) return [];',
      ].join("\n"),
      novo: [
        '    regra: "dia-repetido-ou-inventado",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (true) return []; // mutacao M7: regra desligada',
      ].join("\n"),
    }],
    mata: "não-vacuidade (cada uma das 13 regras dispara na quebra escrita pra ela)",
  },
  {
    id: "M8",
    titulo: "desliga o exame do limiar_mm",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 495, fim: 495,
      espera: '        if (!(r.limiar_mm > 0)) {',
      novo: '        if (false) { // mutacao M8: exame do limiar_mm desligado',
    }],
    mata: "a janela de chuva é conferida nos TRÊS números, um a um",
  },
  {
    id: "M9",
    titulo: "prosa-bate-com-hora-de-fechar nunca dispara",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 452, fim: 452,
      espera: '        if (!citada || !f.horario) return []; // sem campo, quem acusa é a regra de cima',
      novo: '        if (true) return []; // sem campo, quem acusa é a regra de cima (mutacao M9)',
    }],
    mata: "não-vacuidade (cada uma das 13 regras dispara na quebra escrita pra ela)",
  },
  {
    id: "M10",
    titulo: "desliga o exame do nome de dia inventado",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 529, fim: 529,
      espera: '        const inventados = f.dias.filter((d) => !DIAS.includes(d));',
      novo: '        const inventados = []; // mutacao M10: exame do dia inventado desligado',
    }],
    mata: "um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
  },
  {
    id: "M11",
    titulo: "desliga o exame do janela_passado_horas",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 477, fim: 477,
      espera: '        if (!(r.janela_passado_horas > 0)) {',
      novo: '        if (false) { // mutacao M11: exame do janela_passado_horas desligado',
    }],
    mata: "a janela de chuva é conferida nos TRÊS números, um a um",
  },
  {
    id: "M12",
    titulo: "tira rotulo_escaneio dos textos que distinguem",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 145, fim: 145,
      espera: '  { campo: "rotulo_escaneio", rotulo: "a etiqueta" },',
      novo: null,
    }],
    mata: 'os QUATRO textos que distinguem…, e "a lista dos textos que distinguem tem EXATAMENTE quatro campos"',
  },
  {
    id: "M13",
    titulo: "arranca a válvula de escape do horário invertido",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 407, fim: 407,
      espera: '        if (/noite|madrugada|24 ?h|vinte e quatro/.test(prosaDe(f))) return [];',
      novo: null,
    }],
    mata: "a travessia da noite DITA na ficha passa — a regra exige o aviso, não proíbe o horário",
  },
  {
    id: "M14",
    titulo: "tira voz dos textos que distinguem",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 142, fim: 142,
      espera: '  { campo: "voz", rotulo: "a voz" },',
      novo: null,
    }],
    mata: 'os QUATRO textos que distinguem…, e "a lista dos textos que distinguem tem EXATAMENTE quatro campos"',
  },
  {
    id: "M15",
    titulo: "arranca o !custo.curto do preço legível",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 160, fim: 163,
      espera: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (f.custo.tag !== "pago" || !f.custo.curto) return [];',
      ].join("\n"),
      novo: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (f.custo.tag !== "pago") return []; // mutacao M15: sem exigir custo.curto',
      ].join("\n"),
    }],
    mata: 'ficha paga SEM chip é silêncio, não violação (sub-caso "por extenso")',
  },
  {
    id: "N1",
    titulo: "restaura o `?? \"\"` e arranca a guarda do piso ausente",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 359, fim: 364,
      espera: [
        '        if (!f.piso) return []; // ausente é silêncio: ele não declarou piso nenhum',
        '        const prosa = prosaDe(f);',
        '        // "asfalto-esburacado" e "asfalto-tapete" aparecem em prosa como duas',
        '        // palavras; o valor do enum é hifenizado. Comparo pelo primeiro termo.',
        '        const citados = PISOS.filter((p) => prosa.includes(p.split("-")[0]));',
        '        const estranhos = citados.filter((p) => p.split("-")[0] !== f.piso!.split("-")[0]);',
      ].join("\n"),
      novo: [
        '        const prosa = prosaDe(f);',
        '        // "asfalto-esburacado" e "asfalto-tapete" aparecem em prosa como duas',
        '        // palavras; o valor do enum é hifenizado. Comparo pelo primeiro termo.',
        '        const citados = PISOS.filter((p) => prosa.includes(p.split("-")[0]));',
        '        const estranhos = citados.filter((p) => p.split("-")[0] !== (f.piso ?? "").split("-")[0]); // mutacao N1',
      ].join("\n"),
    }],
    mata: "ficha SEM piso é silêncio, mesmo com a prosa nomeando um piso",
  },
  {
    id: "N2",
    titulo: "arranca o guarda do secaRapido ausente",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 283, fim: 284,
      espera: [
        '        if (!f.secaRapido) continue; // ausente é silêncio: o carimbo termina antes',
        '        const k = f.secaRapido.trim().toLowerCase();',
      ].join("\n"),
      novo: '        const k = (f.secaRapido ?? "").trim().toLowerCase(); // mutacao N2: guarda removida',
    }],
    mata: "duas fichas SEM secaRapido não emprestam frase uma da outra",
  },
  {
    id: "N3",
    titulo: "acrescenta `acesso` aos textos que distinguem",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 141, fim: 146,
      espera: [
        'const TEXTOS_QUE_DISTINGUEM = [',
        '  { campo: "voz", rotulo: "a voz" },',
        '  { campo: "promessa", rotulo: "a promessa" },',
        '  { campo: "premio", rotulo: "o prêmio" },',
        '  { campo: "rotulo_escaneio", rotulo: "a etiqueta" },',
        '] as const;',
      ].join("\n"),
      novo: [
        'const TEXTOS_QUE_DISTINGUEM = [',
        '  { campo: "voz", rotulo: "a voz" },',
        '  { campo: "promessa", rotulo: "a promessa" },',
        '  { campo: "premio", rotulo: "o prêmio" },',
        '  { campo: "rotulo_escaneio", rotulo: "a etiqueta" },',
        '  { campo: "acesso", rotulo: "o acesso" }, // mutacao N3',
        '] as const;',
      ].join("\n"),
    }],
    mata: 'a lista dos textos que distinguem tem EXATAMENTE quatro campos, e "campo de prosa fora da lista pode ser igual em duas fichas"',
  },
  {
    id: "N4",
    titulo: "arranca o `tag !== \"pago\"` (preco-legivel-no-custo)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 160, fim: 163,
      espera: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (f.custo.tag !== "pago" || !f.custo.curto) return [];',
      ].join("\n"),
      novo: [
        '    regra: "preco-legivel-no-custo",',
        '    achar: (fichas) =>',
        '      fichas.flatMap((f) => {',
        '        if (!f.custo.curto) return []; // mutacao N4: sem exigir tag pago',
      ].join("\n"),
    }],
    mata: "ficha grátis não é medida por regra de custo nenhuma",
  },
  {
    id: "N5",
    titulo: "as regras 1 e 2 (preco/chip) deixam de ser exclusivas",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 201, fim: 203,
      espera: [
        '        if (!noValor) return []; // quem acusa isto é a regra de cima',
        '        const noCurto = f.custo.curto.match(PRECO)?.[0];',
        '        if (noCurto?.replace(/\\s/g, "") === noValor.replace(/\\s/g, "")) return [];',
      ].join("\n"),
      novo: [
        '        const noCurto = f.custo.curto.match(PRECO)?.[0]; // mutacao N5: guarda de exclusividade removida',
        '        if (noCurto?.replace(/\\s/g, "") === (noValor ?? "").replace(/\\s/g, "")) return [];',
      ].join("\n"),
    }],
    mata: "custo sem preço legível dá UM erro, não dois",
  },
  {
    id: "N6",
    titulo: "`palavras <= 4` → `<= 5`",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 242, fim: 242,
      espera: '        if (palavras <= 4) return [];',
      novo: '        if (palavras <= 5) return []; // mutacao N6',
    }],
    mata: "o chip cabe com 4 palavras e não cabe com 5",
  },
  {
    id: "N7",
    titulo: "`abre < fecha` → `<=`",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 406, fim: 406,
      espera: '        if (abre < fecha) return [];',
      novo: '        if (abre <= fecha) return []; // mutacao N7',
    }],
    mata: "horário igual em abre e fecha é acusado, e a frase fala de 24 horas",
  },
  {
    id: "N8",
    titulo: '`(?:às|as)` → `às` nas duas regras da hora',
    arquivo: COERENCIA,
    edicoes: [
      {
        inicio: 430, fim: 430,
        espera: '        const citada = /fecha (?:às|as) (\\d{1,2})\\s*h/i.exec(prosaDe(f));',
        novo: '        const citada = /fecha às (\\d{1,2})\\s*h/i.exec(prosaDe(f)); // mutacao N8',
      },
      {
        inicio: 451, fim: 451,
        espera: '        const citada = /fecha (?:às|as) (\\d{1,2})\\s*h/i.exec(prosaDe(f));',
        novo: '        const citada = /fecha às (\\d{1,2})\\s*h/i.exec(prosaDe(f)); // mutacao N8',
      },
    ],
    mata: "a hora citada na prosa é lida com acento e sem acento",
  },
  {
    id: "N9",
    titulo: "reverte a frase do dia inventado pra 'não é dia da semana'",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 540, fim: 543,
      espera: [
        '            frase:',
        '              `${nomeDe(f)} tem ${inventados.map((d) => `"${d}"`).join(", ")} na lista de dias, ` +',
        '              "e o app não reconhece essa grafia. As palavras que ele entende são: " +',
        '              `${DIAS.join(", ")}.`,',
      ].join("\n"),
      novo: [
        '            frase:',
        '              `${nomeDe(f)} tem ${inventados.map((d) => `"${d}"`).join(", ")} na lista de dias, ` +',
        '              "e isso não é dia da semana.", // mutacao N9: reverte a correcao da grafia',
      ].join("\n"),
    }],
    mata: "a frase do dia não reconhecido fala de GRAFIA e mostra os sete dias",
  },
  {
    id: "N10",
    titulo: "reverte a frase da semana inteira pra 'deixe a lista vazia'",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 572, fim: 574,
      espera: [
        '          frase:',
        '            `${nomeDe(f)} declara os sete dias da semana, o que é o mesmo que não declarar dia ` +',
        '            "nenhum. Tire os dias da ficha: o app só fala de dia quando o lugar folga em algum.",',
      ].join("\n"),
      novo: [
        '          frase:',
        '            `${nomeDe(f)} declara os sete dias da semana, o que é o mesmo que não declarar dia ` +',
        '            "nenhum. Deixe a lista de dias vazia: o app só fala de dia quando o lugar folga em algum.", // mutacao N10',
      ].join("\n"),
    }],
    mata: "a frase da semana inteira não manda esvaziar a lista, porque o schema recusa",
  },
  {
    id: "N11",
    titulo: "colapsa a bifurcação do horário invertido (sempre 24h)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 410, fim: 410,
      espera: '          frase: abre === fecha',
      novo: '          frase: true // mutacao N11: colapsa a bifurcacao (sempre 24h)',
    }],
    mata: "a ficha genuinamente invertida recebe a frase da noite, não a das 24 horas",
  },
  {
    id: "N12",
    titulo: "a página reinlina o literal do PRECO",
    arquivo: PAGINA,
    edicoes: [{
      inicio: 106, fim: 106,
      espera: '  const precoCurto = ficha.custo.valor?.match(PRECO)?.[0] ?? "Pago";',
      novo: '  const precoCurto = ficha.custo.valor?.match(/R\\$\\s?\\d+(?:[.,]\\d{2})?/)?.[0] ?? "Pago"; // mutacao N12',
    }],
    mata: 'o texto do regex de preço aparece UMA vez só em todo o src/, e "a página continua montando o chip a partir do PRECO importado"',
  },
  {
    id: "B1a",
    titulo: "sempre a frase das 24h (horário invertido)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 410, fim: 410,
      espera: '          frase: abre === fecha',
      novo: '          frase: true // mutacao B1a: sempre a frase das 24h',
    }],
    mata: "a ficha genuinamente invertida recebe a frase da noite, não a das 24 horas",
  },
  {
    id: "B1b",
    titulo: "sempre a frase da noite (horário invertido)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 410, fim: 410,
      espera: '          frase: abre === fecha',
      novo: '          frase: false // mutacao B1b: sempre a frase da noite',
    }],
    mata: "horário igual em abre e fecha é acusado, e a frase fala de 24 horas",
  },
  {
    id: "B2a",
    titulo: "sempre o ramo ilegível do custo (preco-legivel-no-custo)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 173, fim: 173,
      espera: '          frase: f.custo.valor',
      novo: '          frase: true // mutacao B2a: sempre o ramo ilegivel',
    }],
    mata: "custo completo AUSENTE e custo ILEGÍVEL recebem frases diferentes (metade ausente)",
  },
  {
    id: "B2b",
    titulo: "sempre o ramo ausente do custo (preco-legivel-no-custo)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 173, fim: 173,
      espera: '          frase: f.custo.valor',
      novo: '          frase: false // mutacao B2b: sempre o ramo ausente',
    }],
    mata: "custo completo AUSENTE e custo ILEGÍVEL recebem frases diferentes (metade ilegível)",
  },
  {
    id: "B3a",
    titulo: "sempre o ramo com número do chip (chip-bate-com-preco)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 210, fim: 210,
      espera: '          frase: noCurto',
      novo: '          frase: true // mutacao B3a: sempre o ramo com numero',
    }],
    mata: "chip SEM número e chip com número divergente recebem frases diferentes (metade sem número)",
  },
  {
    id: "B3b",
    titulo: "sempre o ramo sem número do chip (chip-bate-com-preco)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 210, fim: 210,
      espera: '          frase: noCurto',
      novo: '          frase: false // mutacao B3b: sempre o ramo sem numero',
    }],
    mata: "chip SEM número e chip com número divergente recebem frases diferentes (metade divergente)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// O MOTOR: aplica, mede, restaura — sempre nesta ordem, sempre com `finally`.
// ═══════════════════════════════════════════════════════════════════════════

const ARQUIVOS_ENVOLVIDOS = [...new Set(MUTACOES.map((m) => m.arquivo))];

/** Estado da mutação em curso, pra o handler de SIGINT saber o que restaurar.
 *  `null` quando nenhuma mutação está com o disco sujo. */
let emAndamento = null;

function restaurarTudo() {
  if (!emAndamento) return;
  for (const original of emAndamento.originais) {
    escreverLF(original.abs, original.lf, original.crlf);
  }
  emAndamento = null;
}

process.on("SIGINT", () => {
  restaurarTudo();
  process.exit(130);
});

function git(args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" });
}

function rodarVitest(arquivosDeTeste) {
  const saida = path.join(os.tmpdir(), `mutar-vitest-${process.pid}-${Date.now()}.json`);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", ...arquivosDeTeste, "--reporter=json", `--outputFile=${saida}`],
      { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "ignore", "ignore"], shell: true },
    );
  } catch {
    // vitest sai com código != 0 quando há teste vermelho — o relatório
    // ainda foi escrito, é ele que interessa, não o exit code.
  }
  if (!existsSync(saida)) {
    return { passou: false, semRelatorio: true, falhas: [] };
  }
  const relatorio = JSON.parse(readFileSync(saida, "utf8"));
  const falhas = [];
  for (const arquivo of relatorio.testResults ?? []) {
    for (const teste of arquivo.assertionResults ?? []) {
      if (teste.status === "failed") falhas.push(teste.fullName ?? teste.title);
    }
  }
  return {
    passou: relatorio.success === true && (relatorio.numFailedTests ?? 0) === 0,
    falhas,
  };
}

const ARQUIVOS_DE_TESTE = [
  "tests/lib/coerencia.test.ts",
  "tests/lib/coerencia-acervo.test.ts",
];

function rodarUma(mutacao) {
  // Hoje todas as mutações mexem num arquivo só; se um dia uma precisar de
  // dois, esta função troca `mutacao.arquivo` por uma lista e repete o padrão
  // abaixo por arquivo.
  const original = lerLF(mutacao.arquivo);
  const novoConteudo = aplicarEdicoes(original.lf, mutacao.edicoes);

  if (novoConteudo === null) {
    return { id: mutacao.id, arquivo: mutacao.arquivo, categoria: "sem alvo", numstat: "", teste: "" };
  }

  emAndamento = { originais: [original] };
  try {
    escreverLF(original.abs, novoConteudo, original.crlf);

    const numstat = git(["diff", "--numstat", "--", mutacao.arquivo]).trim();
    if (numstat === "") {
      return { id: mutacao.id, arquivo: mutacao.arquivo, categoria: "sem diff", numstat: "", teste: "" };
    }

    const resultado = rodarVitest(ARQUIVOS_DE_TESTE);
    if (resultado.passou) {
      return { id: mutacao.id, arquivo: mutacao.arquivo, categoria: "sobreviveu", numstat, teste: "" };
    }
    return {
      id: mutacao.id,
      arquivo: mutacao.arquivo,
      categoria: "morreu",
      numstat,
      teste: resultado.falhas[0] ?? "(vitest terminou sem relatório — ver saída bruta)",
      todasAsFalhas: resultado.falhas,
    };
  } finally {
    restaurarTudo();
  }
}

function main() {
  const pedido = process.argv.slice(2);
  const alvo = pedido.length > 0
    ? MUTACOES.filter((m) => pedido.includes(m.id))
    : MUTACOES;

  if (pedido.length > 0 && alvo.length !== pedido.length) {
    const achados = new Set(alvo.map((m) => m.id));
    const faltando = pedido.filter((id) => !achados.has(id));
    console.error(`id(s) desconhecido(s): ${faltando.join(", ")}`);
    process.exit(1);
  }

  const statusInicial = git(["status", "--porcelain", "--", ...ARQUIVOS_ENVOLVIDOS]);
  if (statusInicial.trim() !== "") {
    console.error("árvore suja nos arquivos envolvidos antes de começar — aborte e confira:");
    console.error(statusInicial);
    process.exit(1);
  }

  const linhas = [];
  const placar = { morreu: 0, sobreviveu: 0, "sem alvo": 0, "sem diff": 0 };

  for (const mutacao of alvo) {
    const r = rodarUma(mutacao);
    placar[r.categoria]++;
    const testeCol = r.categoria === "morreu" ? r.teste : "";
    linhas.push(
      `${r.id}\t${r.arquivo}\t${r.categoria}\t${r.numstat.replace(/\n/g, " / ").replace(/\t/g, " ") || "(vazio)"}\t${testeCol}`,
    );
    console.log(`${r.id} [${r.categoria}] ${mutacao.titulo}`);
    if (r.categoria === "morreu") console.log(`  morreu em: ${r.teste}`);
    if (r.categoria === "sobreviveu") console.log(`  🔴 SOBREVIVEU — buraco real, escreva o teste que mata`);
    if (r.categoria === "sem alvo") console.log(`  🔴 SEM ALVO — o texto esperado não bateu (0 ou >1 ocorrências)`);
    if (r.categoria === "sem diff") console.log(`  🔴 SEM DIFF — a troca não mudou o arquivo`);
  }

  console.log("\nid\tarquivo\tcategoria\tnumstat\tteste_que_matou");
  console.log(linhas.join("\n"));
  console.log(
    `\nplacar: ${placar.morreu} morreram, ${placar.sobreviveu} sobreviveram, ` +
      `${placar["sem alvo"]} sem alvo, ${placar["sem diff"]} sem diff (de ${alvo.length})`,
  );

  const statusFinal = git(["status", "--porcelain", "--", ...ARQUIVOS_ENVOLVIDOS]);
  if (statusFinal.trim() !== "") {
    console.error("\n🔴 árvore ficou suja ao final — isto não deveria acontecer:");
    console.error(statusFinal);
    process.exit(1);
  }

  if (placar.sobreviveu > 0 || placar["sem alvo"] > 0 || placar["sem diff"] > 0) {
    process.exit(2);
  }
}

main();
