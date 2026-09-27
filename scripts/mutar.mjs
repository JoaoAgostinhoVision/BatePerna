#!/usr/bin/env node
/** 🔴 O HARNESS DE MUTAÇÃO DO `src/lib/coerencia.ts` — refeito do zero em
 *  2026-09-27 (rodada de conserto 3/5) porque o original vivia em
 *  `scratchpad/mutar.mjs`, uma pasta efêmera de sessão, e morreu com a pausa.
 *  A rodada 4/5 o endureceu depois de uma re-revisão que achou DOIS
 *  defeitos Critical nele mesmo — ver (a) e (b).
 *
 *  Este arquivo é a fonte única das 34 entradas acumuladas nas rodadas
 *  anteriores (16 da extração + 12 da rodada 1/5 + 6 da rodada 2/5; são 33
 *  trocas distintas, porque N11 e B1a coincidem — ver abaixo) — nenhuma
 *  foi reinventada; cada uma foi reconstruída lendo `task-2-report.md` e o
 *  código atual, e o que era ambíguo está anotado abaixo, mutação por mutação.
 *
 *  ## (a) AS CINCO CATEGORIAS, E POR QUE SÓ UMA É RESULTADO
 *
 *  Cada mutação cai em uma de cinco categorias, nunca "sobreviveu = bom":
 *
 *   - **morreu**      — a mutação entrou (há diff), o vitest MEDIU (escreveu
 *                       relatório e rodou pelo menos `PISO_DE_TESTES` testes)
 *                       e a suíte ficou vermelha. É o único resultado que
 *                       prova cobertura.
 *   - **sobreviveu**  — a mutação entrou, o vitest mediu, e a suíte ficou
 *                       VERDE. É um BURACO real: o exame que aquela mutação
 *                       desliga não tem prova nenhuma.
 *   - **sem alvo**    — as linhas `[inicio,fim]` do arquivo não são o texto
 *                       de `espera`, então a troca nem chegou a ser aplicada.
 *                       AUSÊNCIA DE MEDIÇÃO, não sucesso: a régua nunca tocou
 *                       o código. Nunca leia isto como "a suíte protegeu".
 *   - **sem diff**    — o texto foi trocado mas `git diff --numstat` voltou
 *                       vazio (a troca não mudou nada, ou o arquivo já estava
 *                       sujo antes de começar). Também é ausência de medição.
 *   - **sem medição** — a mutação entrou, mas o vitest NÃO MEDIU: não
 *                       escreveu relatório, escreveu um JSON inválido, ou
 *                       rodou menos testes que `PISO_DE_TESTES`. 🔴 Esta
 *                       nasceu na rodada 4/5, e o buraco que ela fecha era
 *                       grave: até então "o vitest nem rodou" caía no mesmo
 *                       ramo de "a suíte ficou vermelha" e imprimia
 *                       **morreu**, com exit 0. Um re-revisor provou o
 *                       defeito apontando o harness para dois arquivos de
 *                       teste inexistentes: uma mutação que era só troca de
 *                       comentário saiu "morreu" e o placar saiu limpo.
 *
 *  Destas cinco, **três são falha de medição** — sem alvo, sem diff e sem
 *  medição. "Sobreviveu" NÃO é: ali a medição deu certo e achou um buraco. (A
 *  redação anterior dizia "as quatro últimas" e metia "sobreviveu" no balaio
 *  — justamente a confusão que este arquivo existe pra impedir.) Qualquer uma
 *  das quatro que não for "morreu" faz o processo sair com código 2.
 *
 *  As categorias "sem alvo" e "sem diff" existem porque a rodada 2/5 mediu
 *  "0 sem alvo" sem ter a categoria — sete mutações silenciosamente pararam de
 *  aplicar, e o placar não sabia disso. Ver (b).
 *
 *
 *  ## (a1) COMO RODAR, E O QUE CADA CÓDIGO DE SAÍDA SIGNIFICA
 *
 *      node scripts/mutar.mjs                 # as 34 entradas
 *      node scripts/mutar.mjs M12 N3 B3b      # só estas
 *      node scripts/mutar.mjs --controles     # o teste do INSTRUMENTO:
 *                                             #   5 controles de CATEGORIA
 *                                             #   + 4 autotestes de RECUSA
 *
 *  Roda de qualquer pasta: a raiz sai do lugar deste arquivo, não do `cwd`.
 *
 *   - **0** — na rodada normal: todas morreram e todo `mata` declarado
 *     realmente falhou. No `--controles`: os cinco saíram como declararam.
 *   - **1** — recusa de COMEÇAR ou de terminar: árvore suja nos arquivos
 *     envolvidos (antes ou depois); arquivo de teste que não existe mais; a
 *     suíte de base já vermelha; a base executando menos testes que o piso
 *     (arquivo renomeado ou `describe.skip`); um `mata` frouxo (nome que casa
 *     zero ou mais de um teste real); ou uma entrada de `MUTACOES` trazendo
 *     campo que só existe em `CONTROLES`.
 *   - **2** — achado: sobreviveu / sem alvo / sem diff / sem medição, ou um
 *     `mata` declarado que não falhou, ou um controle fora do que declarou.
 *
 *  🔴 O `--controles` PRECISA poder ficar verde, e por isso ele não aplica a
 *  regra geral: lá "sobreviveu" e "sem medição" são o resultado CERTO. Um
 *  guarda que nunca fica verde não é guarda, é ruído que se aprende a ignorar.
 *
 *  ## (a2) O QUE MAIS O HARNESS SE RECUSA A DEIXAR PASSAR EM SILÊNCIO
 *
 *   - **arquivo de teste que sumiu.** Os itens de `ARQUIVOS_DE_TESTE` são
 *     FILTROS do vitest, não caminhos: um nome que não casa com nada não dá
 *     erro, só some da rodada, e o placar fica com a mesma cara medindo
 *     metade. `main()` confere `existsSync` em cada um — inclusive nos
 *     `arquivosDeTeste` de cada entrada — antes de começar.
 *   - **teste PULADO.** O piso é conferido contra os testes EXECUTADOS, nunca
 *     contra `numTotalTests`: um `describe.skip` deixa o total cheio, tudo em
 *     `pending` e `success: true`, e a rodada mediria ZERO achando que mediu
 *     tudo.
 *   - **vermelho sem teste vermelho.** `success: false` com zero falhas
 *     nomeadas é erro fora de teste, e vira "sem medição", não "morreu".
 *   - **`mata` que não mata, e `mata` frouxo.** Ver (c).
 *   - **o próprio instrumento, em DOIS níveis.**
 *     `node scripts/mutar.mjs --controles` roda **cinco controles de
 *     CATEGORIA** (um por ramo do que o harness DIZ) e depois **quatro
 *     autotestes de RECUSA**, cada um num processo filho, porque um
 *     `process.exit` só se confere de fora.
 *
 *     🔴 A regra que os criou: **guarda sem controle é guarda que se pode
 *     desligar em silêncio.** Ela precisou de duas rodadas para ficar de pé.
 *     Na 4b, os portões do `mata` e do piso nasceram sem controle e um
 *     re-revisor desligou os dois com os controles de então VERDES, exit 0.
 *     Consertado — e na rodada seguinte o portão NOVO daquela rodada, o piso
 *     de especificidade, repetiu a história: apagar o `if` dele deixava os
 *     **cinco** controles verdes e `mata: "a"` voltava a passar. Daí os
 *     autotestes, e daí o portão dos campos de controle.
 *
 *     As sabotagens hoje cobertas, todas medidas: colapsar "sem medição" em
 *     "morreu"; forçar `mataConfere`; baixar o piso e cortar a lista pela
 *     metade; apagar o piso de especificidade; e desligar o portão dos
 *     campos de controle. Cada uma sai com 2, nomeando quem ela quebrou.
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
 *  ⚠️  SOBRE O `grep`, e esta frase já nasceu errada DUAS vezes neste mesmo
 *  docblock — a terceira redação é esta, e cada número abaixo foi medido:
 *
 *   - `grep -c $'\r' src/lib/coerencia.ts` devolve **0** (exit 1), num
 *     arquivo que tem 592 CR. O GNU grep 3.0 daqui abre em **modo texto** e
 *     come o CR antes de casar, ainda que o mount seja `binary`.
 *   - `grep -Uc $'\r' src/lib/coerencia.ts` devolve **592** — o `-U`
 *     (modo binário) é obrigatório, e sem ele o grep responde 0 sempre.
 *   - `grep -c $"\r"` — com ASPAS DUPLAS — devolve **411**, e isso não
 *     tem nada a ver com CR: `$"..."` é tradução de locale, não escape, então
 *     o padrão vira o literal `\r`, que em BRE casa a LETRA `r`. Confere
 *     com `grep -c 'r'` → 411. Foi assim que a segunda redação
 *     desta frase se enganou, e o pior: 592 é TAMBÉM o número de linhas do
 *     arquivo, então uma leitura vazia que casasse tudo daria o número certo
 *     por coincidência. Três réguas diferentes, três respostas, e duas delas
 *     confortáveis.
 *
 *  E há uma QUARTA forma de errar, que não é do `grep` e sim da unidade:
 *  **`grep -Uc` conta LINHAS que têm CR; o `od` conta BYTES CR.** Elas só
 *  coincidem porque `coerencia.ts` é CRLF uniforme. Num arquivo com um CR no
 *  meio da linha (`printf "a\rb\r\nc\r\n"`), `grep -Uc` diz **2** e o `od`
 *  diz **3** — e a que erra pra menos é a do `grep`. Para contar OCORRÊNCIAS
 *  com grep, `grep -Uo` mais `wc -l`.
 *
 *  Resumindo a régua deste projeto: **`od` para contar bytes**; `grep` só com
 *  `-U` e aspas SIMPLES, e sabendo que ele responde em linhas. O que confere
 *  e não depende de nada disso: o mount ser `binary` (`mount` → `C: on /c type
 *  ntfs (binary,noacl,posix=0,...)`) e o `wc -c` bater byte a byte com
 *  `fs.readFileSync(...).length` do Node (31289 nos dois, em 27/09).
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
 *  substitui, ou `null` para apagar as linhas), e `mata`.
 *
 *  🔴 **`mata` NÃO é mais documentação — é PORTÃO, desde a rodada 4/5.** (Esta
 *  frase dizia "só documentação, o harness não força isso" e virou falsa no
 *  mesmo commit que criou o portão; um re-revisor a pegou. É a terceira rodada
 *  seguida com uma frase falsa escrita pelo próprio commit, sempre na parte
 *  que ninguém re-lê.) O que ele exige hoje:
 *
 *   - é um nome de teste ou uma **lista** deles; quando é lista, **todos** têm
 *     de ter falhado, e a conferência olha TODAS as falhas da rodada, não só a
 *     primeira;
 *   - cada nome tem de casar **exatamente UM** dos testes reais da base — zero
 *     é fantasma (45ª espécie) e dois é ambíguo. `main()` mede a suíte antes de
 *     mutar nada e recusa começar (código 1) se algum nome for frouxo. Sem
 *     esse piso, `mata: "a"` casaria os 51 nomes e satisfaria o portão sempre;
 *   - um `mata` declarado que NÃO falhou derruba a rodada com código 2.
 *
 *  🔴 **Campos que existem SÓ em `CONTROLES`, e agora isso é PORTÃO, não
 *  promessa:** `esperaCategoria`, `esperaMataConfere`, `mataFantasmaDeProposito`,
 *  `alvoInexistenteDeProposito`, `piso` e `arquivosDeTeste`. Uma entrada de
 *  `MUTACOES` que traga qualquer um deles faz o processo recusar começar com
 *  código 1. Antes disso a frase "só em CONTROLES" estava no docblock e nada
 *  a garantia: bastava uma entrada REAL declarar `mataFantasmaDeProposito`
 *  para pular o piso de especificidade, ou `piso`/`arquivosDeTeste` para ser
 *  medida contra metade da suíte — as duas com **exit 0**, sem tocar no
 *  motor. Medido por um re-revisor em 27/09.
 *
 *  Rode `node scripts/mutar.mjs <id>` sozinho pra conferir antes de integrar.
 *
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
 *    TRÊS mutações que o relatório amarra a essa regra ou a uma prova
 *    genérica de não-vacuidade — M6, M15 e N4 (a redação anterior desta
 *    frase dizia QUATRO e se contradizia cinco linhas abaixo). Cada
 *    `espera` inclui a linha `regra: "preco-legivel-no-custo",` acima do
 *    guarda, então o harness recusa aplicar em qualquer outra regra por
 *    engano. M2 usa a ocorrência de
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
 *    isto está dito aqui para não parecer erro de cópia. 🔴 Consequência
 *    que tem de ser dita junto com o placar: são **34 entradas e 33
 *    trocas distintas**. Quem escrever "34 mutações" sem essa linha ao
 *    lado está contando uma a mais do que mediu.
 *  - **"a regra do chip" em M2** é `chip-bate-com-preco` (é o que o
 *    relatório nomeia: "o chip que não bate com o preço é pego"), não
 *    `chip-cabe-na-pilula` nem `chip-nao-repete-a-linha`.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

/** A raiz vem do LUGAR DO SCRIPT, não do `cwd`: assim `node
 *  scripts/mutar.mjs` funciona de qualquer pasta, e um `cd` errado no meio de
 *  uma sessão não faz o harness medir árvore nenhuma e ainda imprimir placar. */
/** Teto por rodada de vitest. Sem ele, um vitest pendurado trava a rodada
 *  inteira sem diagnostico nenhum; com ele, cai no `sem medicao` que ja existe. */
const TIMEOUT_VITEST = 300_000;

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function lerLF(relativo) {
  const abs = path.join(RAIZ, relativo);
  const bruto = readFileSync(abs, "utf8");
  const crlf = bruto.includes("\r\n");
  const lf = bruto.replace(/\r\n/g, "\n");
  return { abs, crlf, lf };
}

/** ⚠️ Latente, e dito porque ninguém percebe depois: a restauração é
 *  RECONSTRUTIVA, não um `git checkout`. Se o arquivo tivesse finais de linha
 *  MISTOS, isto devolveria tudo em CRLF e o `git status` não acusaria (o
 *  `autocrlf` normaliza na comparação) — ou seja, o harness teria "arrumado"
 *  o arquivo sem ninguém pedir. Hoje os dois arquivos envolvidos são
 *  uniformemente CRLF no disco (CR = LF = 592 em `coerencia.ts` e 381 em
 *  `page.tsx`, medido em 27/09), então a reconstrução sai byte a byte igual. */
function escreverLF(abs, lf, crlf) {
  writeFileSync(abs, crlf ? lf.replace(/\n/g, "\r\n") : lf, "utf8");
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

// `let` por causa dos AUTOTESTES, que injetam uma entrada doente de propósito.
let MUTACOES = [
  {
    id: "M1",
    titulo: "violacoesDoAcervo devolve [] sempre",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 591, fim: 591,
      espera: '  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));',
      novo: '  return [];',
    }],
    mata: [
      "o chip que não bate com o preço é pego",
      "um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
      "a janela de chuva é conferida nos TRÊS números, um a um",
    ],
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
    mata: [
      "cada uma das 13 regras dispara na quebra escrita pra ela",
      "o chip que não bate com o preço é pego",
    ],
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
    mata: [
      "cada uma das 13 regras dispara na quebra escrita pra ela",
      "custo sem preço legível dá UM erro, não dois",
    ],
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
    mata: [
      "cada uma das 13 regras dispara na quebra escrita pra ela",
      "um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
    ],
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
    mata: [
      "cada uma das 13 regras dispara na quebra escrita pra ela",
      "a hora citada na prosa é lida com acento e sem acento",
    ],
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
    mata: [
      "os QUATRO textos que distinguem um lugar do outro são conferidos, um a um",
      "a lista dos textos que distinguem tem EXATAMENTE quatro campos",
    ],
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
    mata: [
      "os QUATRO textos que distinguem um lugar do outro são conferidos, um a um",
      "a lista dos textos que distinguem tem EXATAMENTE quatro campos",
    ],
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
    mata: [
      "ficha paga SEM chip é silêncio, não violação",
    ],
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
    mata: [
      "a lista dos textos que distinguem tem EXATAMENTE quatro campos",
      "campo de prosa fora da lista pode ser igual em duas fichas",
    ],
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
    mata: [
      "o texto do regex de preço aparece UMA vez só em todo o src/",
      "a página continua montando o chip a partir do PRECO importado",
    ],
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
    // A redação antiga trazia um sufixo entre parênteses (metade ausente)
    // que não existe no nome do teste — era prosa, e o guarda de `mata` pegou.
    mata: [
      "custo completo AUSENTE recebe a frase do campo vazio",
    ],
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
    // A redação antiga trazia um sufixo entre parênteses (metade ilegível)
    // que não existe no nome do teste — era prosa, e o guarda de `mata` pegou.
    mata: [
      "custo completo ILEGÍVEL mostra por extenso o que ele escreveu",
    ],
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
    // A redação antiga trazia um sufixo entre parênteses (metade sem número)
    // que não existe no nome do teste — era prosa, e o guarda de `mata` pegou.
    mata: [
      "chip SEM número recebe a frase de não mostrar preço nenhum",
    ],
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
    // A redação antiga trazia um sufixo entre parênteses (metade divergente)
    // que não existe no nome do teste — era prosa, e o guarda de `mata` pegou.
    mata: [
      "chip com número DIVERGENTE mostra os dois preços lado a lado",
    ],
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

const ARQUIVOS_DE_TESTE = [
  "tests/lib/coerencia.test.ts",
  "tests/lib/coerencia-acervo.test.ts",
];

/** O PISO: quantos testes estes dois arquivos somam quando tudo está no lugar.
 *  Medido em 2026-09-27, depois de a rodada 4/5 partir dois `it` em quatro:
 *  33 (`coerencia.test.ts`) + 18 (`coerencia-acervo.test.ts`) = **51**.
 *
 *  🔴 Ele é conferido contra os testes EXECUTADOS (passaram + falharam), nunca
 *  contra `numTotalTests`. A diferença foi medida e importa: um `describe.skip`
 *  deixa `numTotalTests` em 51 com os 51 em `pending` e `success: true` — o
 *  piso nunca dispararia, e a rodada mediria ZERO achando que mediu tudo.
 *
 *  Se você acrescentar testes a estes arquivos, suba o número: `main()` mede a
 *  base antes de mutar e RECUSA começar se o medido for menor que ele; um
 *  medido MAIOR só avisa, porque aí o piso está velho mas não está mentindo. */
const PISO_DE_TESTES = 51;

// ═══════════════════════════════════════════════════════════════════════════
// AS MUTAÇÕES DE CONTROLE — elas provam o INSTRUMENTO, não o código. Um
// harness que carimba "morreu" em tudo dá exatamente o mesmo quadro de uma
// suíte perfeita, e a rodada 3/5 só descobriu isso porque um re-revisor teve
// de COPIAR o script para mexer nele. Agora são um comando:
// `node scripts/mutar.mjs --controles`. Cada controle declara a categoria que
// TEM de sair; se sair outra, o processo termina com código 2.
//
// 🔴 Cada guarda deste arquivo tem de ter um controle SEU. A rodada 4/5 criou
// dois portões novos — o do `mata` e o do PISO — e nasceram os dois sem
// controle: um re-revisor desligou cada um deles numa cópia e os três
// controles daquele momento continuaram VERDES, exit 0. Daí `CTRL-MATA-ERRADO`
// e `CTRL-PISO-BAIXO`. Guarda sem controle é guarda que se pode desligar em
// silêncio.
// ═══════════════════════════════════════════════════════════════════════════

const CONTROLES = [
  {
    id: "CTRL-SOBREVIVE",
    titulo: "CONTROLE: troca real no arquivo, semanticamente NULA",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 1, fim: 1,
      espera: 'import { PISOS } from "@/lib/piso";',
      novo: 'import { PISOS as PISOS } from "@/lib/piso";',
    }],
    esperaCategoria: "sobreviveu",
    mata: null,
  },
  {
    id: "CTRL-SEM-ALVO",
    titulo: "CONTROLE: `espera` que não existe em lugar nenhum do repo",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 1, fim: 1,
      espera: "esta linha nao existe em lugar nenhum deste repositorio",
      novo: "nem esta",
    }],
    esperaCategoria: "sem alvo",
    mata: null,
  },
  {
    id: "CTRL-SEM-MEDICAO",
    titulo: "CONTROLE: vitest que não roda (arquivo de teste inexistente)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 1, fim: 1,
      espera: 'import { PISOS } from "@/lib/piso";',
      novo: 'import { PISOS as PISOS } from "@/lib/piso";',
    }],
    // Aponta o vitest para um arquivo que não existe: nenhum relatório é
    // escrito. ANTES da rodada 4/5 isto saía como "morreu", com exit 0.
    arquivosDeTeste: ["tests/lib/ESTE-ARQUIVO-NAO-EXISTE.test.ts"],
    alvoInexistenteDeProposito: true,
    piso: 0,
    esperaCategoria: "sem medição",
    mata: null,
  },
  {
    id: "CTRL-PISO-BAIXO",
    titulo: "CONTROLE: mede METADE da suíte (o outro ramo do `sem medição`)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 1, fim: 1,
      espera: 'import { PISOS } from "@/lib/piso";',
      novo: 'import { PISOS as PISOS } from "@/lib/piso";',
    }],
    // Os dois arquivos EXISTEM, então o `existsSync` não pega nada: o que
    // pega é o piso, e é ele que este controle exercita. Um re-revisor baixou
    // `PISO_DE_TESTES` para 0 e cortou a lista pela metade numa cópia; os três
    // controles de então ficaram verdes medindo 31 dos 49 testes.
    arquivosDeTeste: ["tests/lib/coerencia.test.ts"],
    esperaCategoria: "sem medição",
    mata: null,
  },
  {
    id: "CTRL-MATA-ERRADO",
    titulo: "CONTROLE: mutação que morre de verdade, com `mata` FANTASMA",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 591, fim: 591,
      espera: "  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));",
      novo: "  return [];",
    }],
    // Ela morre — o que este controle prova é o OUTRO portão: que o harness
    // percebe quando o teste DECLARADO não é o que falhou. Sem ele, dava para
    // trocar `mataConfere` por `true` e tudo continuava verde.
    mata: "ESTE TESTE NUNCA EXISTIU EM LUGAR NENHUM",
    mataFantasmaDeProposito: true,
    esperaCategoria: "morreu",
    esperaMataConfere: false,
  },
];

function git(args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" });
}

/** Roda o vitest e devolve SEMPRE um de três estados, nunca dois colapsados
 *  num só: `{ medido:false }` (o vitest não chegou a medir — e isso NÃO é
 *  "morreu"), `{ medido:true, passou:true }` e `{ medido:true, passou:false }`.
 *
 *  🔴 O buraco que isto fecha, achado na re-revisão da rodada 3/5: relatório
 *  ausente caía no mesmo `else` do teste vermelho, então "o vitest nem rodou"
 *  e "a suíte ficou vermelha por causa da mutação" imprimiam a MESMA palavra,
 *  com exit 0. Uma mutação que era só troca de comentário saiu "morreu". */
function rodarVitest(arquivosDeTeste, piso) {
  const saida = path.join(os.tmpdir(), `mutar-vitest-${process.pid}-${Date.now()}.json`);
  let erroBruto = "";
  try {
    execFileSync(
      "npx",
      ["vitest", "run", ...arquivosDeTeste, "--reporter=json", `--outputFile=${saida}`],
      { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], shell: true, timeout: TIMEOUT_VITEST },
    );
  } catch (erro) {
    // O vitest sai com código != 0 quando há teste vermelho — aí o relatório
    // existe e é ele que interessa. Mas ele também sai != 0 quando não achou
    // arquivo de teste nenhum, e AÍ não há relatório: guardamos o stderr em
    // vez de jogá-lo fora, porque é a única pista do que aconteceu.
    erroBruto = String(erro?.stderr ?? erro?.message ?? "").trim();
  }

  try {
    if (!existsSync(saida)) {
      return { medido: false, porque: "o vitest não escreveu relatório nenhum", erroBruto, falhas: [] };
    }

    let relatorio;
    try {
      relatorio = JSON.parse(readFileSync(saida, "utf8"));
    } catch (erro) {
      return { medido: false, porque: `o relatório do vitest não é JSON válido (${erro.message})`, erroBruto, falhas: [] };
    }

    // 🔴 EXECUTADOS, não `numTotalTests`: teste PULADO conta no total e não
    // roda. Com um `describe.skip` o total continua cheio, `success` fica
    // `true`, e a rodada mediria zero achando que mediu tudo.
    const passados = relatorio.numPassedTests ?? 0;
    const falhados = relatorio.numFailedTests ?? 0;
    const executados = passados + falhados;
    if (executados < piso) {
      return {
        medido: false,
        porque: `o vitest EXECUTOU ${executados} teste(s) (de ${relatorio.numTotalTests ?? "?"} no total), e o piso é ${piso}`,
        erroBruto,
        falhas: [],
      };
    }

    const falhas = [];
    for (const arquivo of relatorio.testResults ?? []) {
      for (const teste of arquivo.assertionResults ?? []) {
        if (teste.status === "failed") falhas.push(teste.fullName ?? teste.title);
      }
    }

    const passou = relatorio.success === true && falhados === 0;
    // 🔴 Vermelho SEM falha nomeada não é "morreu": é o vitest quebrando fora
    // de teste nenhum (`unhandledErrors`). Sem esta linha isso cairia em
    // "morreu" com a coluna do teste vazia.
    if (!passou && falhas.length === 0) {
      return { medido: false, porque: "a suíte ficou vermelha mas nenhum teste falhou (erro fora de teste)", erroBruto, falhas: [] };
    }
    return { medido: true, passou, falhas, executados };
  } finally {
    try { if (existsSync(saida)) unlinkSync(saida); } catch { /* lixo em tmp não vale falhar uma rodada */ }
  }
}

function rodarUma(mutacao) {
  // Hoje todas as mutações mexem num arquivo só; se um dia uma precisar de
  // dois, esta função troca `mutacao.arquivo` por uma lista e repete o padrão
  // abaixo por arquivo.
  const base = { id: mutacao.id, arquivo: mutacao.arquivo, numstat: "", teste: "", falhas: [], mataConfere: null };
  const original = lerLF(mutacao.arquivo);
  const novoConteudo = aplicarEdicoes(original.lf, mutacao.edicoes);

  if (novoConteudo === null) return { ...base, categoria: "sem alvo" };

  emAndamento = { originais: [original] };
  try {
    escreverLF(original.abs, novoConteudo, original.crlf);

    const numstat = git(["diff", "--numstat", "--", mutacao.arquivo]).trim();
    if (numstat === "") return { ...base, categoria: "sem diff" };

    const arquivos = mutacao.arquivosDeTeste ?? ARQUIVOS_DE_TESTE;
    const piso = mutacao.piso ?? PISO_DE_TESTES;
    const r = rodarVitest(arquivos, piso);

    if (!r.medido) {
      return { ...base, categoria: "sem medição", numstat, teste: r.porque, erroBruto: r.erroBruto };
    }
    if (r.passou) return { ...base, categoria: "sobreviveu", numstat };

    // 🔴 Confere o `mata` contra TODAS as falhas, não só a primeira, e exige
    // que TODOS os nomes declarados tenham falhado. Antes da rodada 4/5 o
    // campo não era lido por ninguém: era prosa ao lado do código. "Morreu" é
    // uma coisa; "morreu no teste desenhado pra ela" é outra, e é a segunda
    // que trava a 45ª espécie do catálogo (nome de teste fantasma na tabela).
    const nomes = mutacao.mata == null ? null : (Array.isArray(mutacao.mata) ? mutacao.mata : [mutacao.mata]);
    const mataConfere = nomes === null ? null : nomes.every((n) => r.falhas.some((f) => f.includes(n)));
    return { ...base, categoria: "morreu", numstat, teste: r.falhas[0] ?? "", falhas: r.falhas, mataConfere };
  } finally {
    restaurarTudo();
  }
}

const CATEGORIAS = ["morreu", "sobreviveu", "sem alvo", "sem diff", "sem medição"];

/** As últimas linhas que dizem alguma coisa. O stderr do `npx vitest` começa
 *  com o aviso de depreciação do Vite e a lista de filtros; a CAUSA ("No test
 *  files found, exiting with code 1") é a ÚLTIMA. A rodada 4/5 imprimia a
 *  PRIMEIRA linha e mostrava o aviso inócuo no lugar do diagnóstico — no
 *  caminho que existe justamente para diagnosticar. */
function ultimasLinhas(texto, quantas) {
  return String(texto ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-quantas);
}

/** Roda a suíte de base uma vez e devolve os nomes de todos os testes, pra
 *  `verificarMata` ter contra o que conferir. */
function nomesDosTestes() {
  const saida = path.join(os.tmpdir(), `mutar-base-${process.pid}-${Date.now()}.json`);
  try {
    execFileSync(
      "npx",
      ["vitest", "run", ...ARQUIVOS_DE_TESTE, "--reporter=json", `--outputFile=${saida}`],
      { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], shell: true, timeout: TIMEOUT_VITEST },
    );
  } catch { /* o relatório é que interessa */ }
  if (!existsSync(saida)) return null;
  try {
    const relatorio = JSON.parse(readFileSync(saida, "utf8"));
    const nomes = [];
    for (const arquivo of relatorio.testResults ?? []) {
      for (const teste of arquivo.assertionResults ?? []) nomes.push(teste.fullName ?? teste.title);
    }
    return { nomes, executados: (relatorio.numPassedTests ?? 0) + (relatorio.numFailedTests ?? 0), vermelho: relatorio.success !== true };
  } finally {
    try { if (existsSync(saida)) unlinkSync(saida); } catch { /* idem */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OS AUTOTESTES — os controles das RECUSAS (código 1), que nenhum controle de
// categoria alcança.
//
// 🔴 Por que existem, e é o achado da re-revisão da rodada 4b: os cinco
// controles de categoria provam o que o harness DIZ (sobreviveu, sem alvo, sem
// medição, `mata` que não mata). Eles não tocam os portões que fazem o harness
// se RECUSAR a começar — e o portão novo daquela rodada, o piso de
// especificidade do `mata`, nasceu de novo sem guarda de si mesmo. Um
// re-revisor apagou o `if` dele e rodou `--controles`: **os cinco verdes, exit
// 0**, e `mata: "a"` (que casa os 51 testes) voltou a passar na rodada normal,
// também com exit 0.
//
// Pior: dava para burlar **sem editar o motor**. Bastava uma entrada REAL
// declarar `mataFantasmaDeProposito: true` — campo que o docblock afirmava
// existir "só em CONTROLES", promessa que o código não cumpria. Mesma espécie
// do `contarOcorrencias` da rodada 3 (mecanismo prometido que não existe),
// agora com consequência: a tabela mentindo com exit 0.
//
// Cada autoteste injeta UMA entrada deliberadamente doente em `MUTACOES` e
// espera que o processo recuse começar, com o código e a frase declarados. O
// `--controles` roda os cinco de categoria e depois estes, cada um num
// processo filho — é a única forma de conferir um `process.exit` de dentro.
// ═══════════════════════════════════════════════════════════════════════════

/** A edição que todos os autotestes usam: a mesma de M1, que existe e aplica.
 *  O que se mede aqui não é a mutação — é o PORTÃO que roda antes dela. */
const EDICAO_DE_AUTOTESTE = [{
  inicio: 591, fim: 591,
  espera: "  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));",
  novo: "  return [];",
}];

const AUTOTESTES = [
  {
    nome: "mata-frouxo",
    porque: 'uma entrada com `mata: "a"`, que casa os 51 testes e provaria nada',
    entrada: { id: "AUTO-FROUXO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE, mata: "a" },
    esperaCodigo: 1,
    esperaTrecho: "piso de especificidade",
  },
  {
    nome: "mata-fantasma",
    porque: "uma entrada cujo `mata` não casa teste nenhum (45ª espécie)",
    entrada: { id: "AUTO-FANTASMA", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE, mata: "ESTE TESTE NUNCA EXISTIU" },
    esperaCodigo: 1,
    esperaTrecho: "piso de especificidade",
  },
  {
    nome: "campo-de-controle",
    porque: "uma entrada REAL declarando `mataFantasmaDeProposito`, a flag que pula o portão",
    entrada: {
      id: "AUTO-FLAG", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE,
      mata: "a", mataFantasmaDeProposito: true,
    },
    esperaCodigo: 1,
    esperaTrecho: "campo de controle",
  },
  {
    nome: "piso-por-entrada",
    porque: "uma entrada REAL com `piso` e `arquivosDeTeste` próprios, medindo metade em silêncio",
    entrada: {
      id: "AUTO-PISO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE,
      mata: "cada uma das 13 regras dispara na quebra escrita pra ela",
      arquivosDeTeste: ["tests/lib/coerencia.test.ts"], piso: 1,
    },
    esperaCodigo: 1,
    esperaTrecho: "campo de controle",
  },
];

/** Os campos que só fazem sentido num controle. Uma entrada de `MUTACOES` que
 *  traga qualquer um deles está pedindo para pular um portão — e o docblock
 *  dizia "só em CONTROLES" sem nada garantir. Agora garante. */
const CAMPOS_SO_DE_CONTROLE = [
  "esperaCategoria",
  "esperaMataConfere",
  "mataFantasmaDeProposito",
  "alvoInexistenteDeProposito",
  "piso",
  "arquivosDeTeste",
];

function recusarCamposDeControle(entradas) {
  const culpadas = [];
  for (const m of entradas) {
    const achados = CAMPOS_SO_DE_CONTROLE.filter((c) => Object.prototype.hasOwnProperty.call(m, c));
    if (achados.length > 0) culpadas.push(`${m.id}: ${achados.join(", ")}`);
  }
  if (culpadas.length > 0) {
    console.error("🔴 entrada de MUTACOES com campo de controle — isso pula portão:");
    for (const linha of culpadas) console.error(`  ${linha}`);
    console.error("Estes campos existem só em CONTROLES. Em MUTACOES eles desligam o piso de");
    console.error("especificidade do `mata` ou trocam a suíte medida, e a rodada mente com exit 0.");
    process.exit(1);
  }
}

function rodarAutotestes() {
  const esteArquivo = fileURLToPath(import.meta.url);
  const falhas = [];
  console.log("\nautotestes das RECUSAS (cada um num processo filho):");
  for (const a of AUTOTESTES) {
    let codigo = 0;
    let saida = "";
    try {
      saida = execFileSync(process.execPath, [esteArquivo, `--autoteste=${a.nome}`], {
        cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT_VITEST,
      });
    } catch (erro) {
      codigo = erro?.status ?? -1;
      saida = String(erro?.stdout ?? "") + String(erro?.stderr ?? "");
    }
    const codigoBate = codigo === a.esperaCodigo;
    const trechoBate = saida.includes(a.esperaTrecho);
    if (codigoBate && trechoBate) {
      console.log(`  ✅ ${a.nome} — recusou com ${codigo}: ${a.porque}`);
    } else {
      console.log(`  🔴 ${a.nome} — ${a.porque}`);
      falhas.push(
        `${a.nome}: esperava código ${a.esperaCodigo} e a frase "${a.esperaTrecho}"; ` +
          `saiu código ${codigo}${trechoBate ? "" : ' e a frase NÃO apareceu'}`,
      );
    }
  }
  return falhas;
}

function main() {
  const pedido = process.argv.slice(2);
  const modoControle = pedido.includes("--controles");

  // `--autoteste=<nome>` injeta UMA entrada doente em MUTACOES e segue o
  // caminho normal, pra um processo pai poder conferir a RECUSA. Ver AUTOTESTES.
  const pedidoAuto = pedido.find((a) => a.startsWith("--autoteste="));
  let idAuto = null;
  if (pedidoAuto) {
    const nome = pedidoAuto.slice("--autoteste=".length);
    const auto = AUTOTESTES.find((a) => a.nome === nome);
    if (!auto) {
      console.error(`autoteste desconhecido: ${nome}`);
      process.exit(1);
    }
    MUTACOES = [...MUTACOES, auto.entrada];
    idAuto = auto.entrada.id;
  }

  const ids = idAuto ? [idAuto] : pedido.filter((a) => a !== "--controles");
  const universo = modoControle ? CONTROLES : MUTACOES;
  const alvo = ids.length > 0 ? universo.filter((m) => ids.includes(m.id)) : universo;

  // 🔴 Nenhuma entrada de MUTACOES pode trazer campo de controle. O docblock
  // dizia "só em CONTROLES" e nada garantia: uma entrada real que declarasse
  // `mataFantasmaDeProposito` pulava o piso de especificidade do `mata`, e uma
  // com `piso`/`arquivosDeTeste` media metade da suíte — as duas com exit 0 e
  // sem tocar no motor. Medido por um re-revisor em 27/09.
  if (!modoControle) recusarCamposDeControle(alvo);

  if (ids.length > 0 && alvo.length !== ids.length) {
    const achados = new Set(alvo.map((m) => m.id));
    console.error(`id(s) desconhecido(s): ${ids.filter((id) => !achados.has(id)).join(", ")}`);
    process.exit(1);
  }

  // 🔴 Os itens de ARQUIVOS_DE_TESTE são FILTROS do vitest, não caminhos: um
  // nome que não casa com arquivo nenhum não dá erro, só some da rodada — e o
  // placar continua com a mesma cara, medindo metade. É a 44ª espécie (guarda
  // cego ao que sumiu) aplicada ao próprio instrumento. Os overrides por
  // mutação entram no mesmo guarda, menos o único que aponta um arquivo
  // inexistente DE PROPÓSITO.
  const listas = [ARQUIVOS_DE_TESTE];
  for (const m of alvo) {
    if (m.arquivosDeTeste && !m.alvoInexistenteDeProposito) listas.push(m.arquivosDeTeste);
  }
  const sumidos = [...new Set(listas.flat())].filter((f) => !existsSync(path.join(RAIZ, f)));
  if (sumidos.length > 0) {
    console.error(`arquivo(s) de teste que não existem mais: ${sumidos.join(", ")}`);
    console.error("conserte a lista e o piso — rodar assim mede menos do que o placar diz.");
    process.exit(1);
  }

  const statusInicial = git(["status", "--porcelain", "--", ...ARQUIVOS_ENVOLVIDOS]);
  if (statusInicial.trim() !== "") {
    console.error("árvore suja nos arquivos envolvidos antes de começar — aborte e confira:");
    console.error(statusInicial);
    process.exit(1);
  }

  // A base: mede a suíte limpa, confere o piso, e dá os nomes reais contra os
  // quais cada `mata` declarado é validado.
  const base = nomesDosTestes();
  if (base === null) {
    console.error("não consegui medir a suíte de base (o vitest não escreveu relatório).");
    process.exit(1);
  }
  if (base.vermelho) {
    console.error("a suíte de base já está VERMELHA antes de qualquer mutação — conserte antes.");
    process.exit(1);
  }
  if (base.executados < PISO_DE_TESTES) {
    console.error(`a base executou ${base.executados} testes e o piso é ${PISO_DE_TESTES}.`);
    console.error("arquivo sumiu, foi renomeado, ou tem teste PULADO. Conserte a lista ou o piso.");
    process.exit(1);
  }
  if (base.executados > PISO_DE_TESTES) {
    console.log(`aviso: a base executou ${base.executados} testes e o piso ainda diz ${PISO_DE_TESTES} — suba o piso.`);
  }

  // 🔴 O PISO DE ESPECIFICIDADE do `mata`. Sem ele o portão do `mata` é
  // satisfeito por substring solta: medido, `mata: "a"` casa os 51 nomes e
  // `"violacoesDoAcervo"` casa 31 deles. Cada nome declarado tem de casar
  // EXATAMENTE UM teste real — nem zero (fantasma), nem dois (ambíguo).
  const frouxos = [];
  for (const m of alvo) {
    if (m.mata == null || m.mataFantasmaDeProposito) continue;
    for (const n of Array.isArray(m.mata) ? m.mata : [m.mata]) {
      const quantos = base.nomes.filter((t) => t.includes(n)).length;
      if (quantos !== 1) frouxos.push(`${m.id}: "${n}" casa ${quantos} teste(s) — tem de casar exatamente 1`);
    }
  }
  if (frouxos.length > 0) {
    console.error("🔴 `mata` sem piso de especificidade — a tabela não prova o que diz provar:");
    for (const linha of frouxos) console.error(`  ${linha}`);
    process.exit(1);
  }

  const linhas = [];
  const placar = Object.fromEntries(CATEGORIAS.map((c) => [c, 0]));
  const mataFalhou = [];
  const controleFalhou = [];

  for (const mutacao of alvo) {
    const r = rodarUma(mutacao);
    placar[r.categoria]++;

    if (modoControle) {
      if (r.categoria !== mutacao.esperaCategoria) {
        controleFalhou.push(`${r.id}: esperava categoria "${mutacao.esperaCategoria}", saiu "${r.categoria}"`);
      } else if (mutacao.esperaMataConfere !== undefined && r.mataConfere !== mutacao.esperaMataConfere) {
        controleFalhou.push(`${r.id}: esperava mataConfere=${mutacao.esperaMataConfere}, saiu ${r.mataConfere}`);
      }
    } else if (r.mataConfere === false) {
      mataFalhou.push(`${r.id}: declara matar ${JSON.stringify(mutacao.mata)}, e esse teste não falhou`);
    }

    linhas.push([
      r.id,
      r.arquivo,
      r.categoria,
      r.numstat.replace(/\n/g, " / ").replace(/\t/g, " ") || "(vazio)",
      r.teste,
      r.mataConfere === null ? "—" : r.mataConfere ? "sim" : "NÃO",
    ].join("\t"));

    console.log(`${r.id} [${r.categoria}] ${mutacao.titulo}`);
    if (r.categoria === "morreu") {
      console.log(`  morreu em: ${r.teste}${r.falhas.length > 1 ? ` (+${r.falhas.length - 1} outra(s))` : ""}`);
      if (r.mataConfere === false) {
        console.log(`  🔴 mas o teste DECLARADO em "mata" não falhou: ${JSON.stringify(mutacao.mata)}`);
        console.log("     quem falhou de verdade:");
        for (const f of r.falhas) console.log(`       - ${f}`);
      }
    }
    if (r.categoria === "sobreviveu") console.log("  🔴 SOBREVIVEU — buraco real, escreva o teste que mata");
    if (r.categoria === "sem alvo") console.log("  🔴 SEM ALVO — o texto esperado não bateu nas linhas indicadas");
    if (r.categoria === "sem diff") console.log("  🔴 SEM DIFF — a troca não mudou o arquivo");
    if (r.categoria === "sem medição") {
      console.log(`  🔴 SEM MEDIÇÃO — ${r.teste}`);
      for (const linha of ultimasLinhas(r.erroBruto, 3)) console.log(`     stderr: ${linha}`);
    }
  }

  console.log("\nid\tarquivo\tcategoria\tnumstat\tteste_que_matou\tmata_confere");
  console.log(linhas.join("\n"));
  console.log(`\nplacar: ${CATEGORIAS.map((c) => `${placar[c]} ${c}`).join(", ")} (de ${alvo.length})`);

  const statusFinal = git(["status", "--porcelain", "--", ...ARQUIVOS_ENVOLVIDOS]);
  if (statusFinal.trim() !== "") {
    console.error("\n🔴 árvore ficou suja ao final — isto não deveria acontecer:");
    console.error(statusFinal);
    process.exit(1);
  }

  if (modoControle) {
    // 🔴 No modo controle o placar "ruim" é o RESULTADO ESPERADO: os controles
    // têm de sair nas categorias que declaram. Aplicar aqui a regra geral
    // (categoria != morreu ⇒ exit 2) faria este comando ser SEMPRE vermelho —
    // e um guarda que nunca fica verde não é guarda, é ruído que todo mundo
    // aprende a ignorar. Aqui só uma coisa reprova: um controle que saiu
    // diferente do que declarou, em categoria ou em `mataConfere`.
    if (controleFalhou.length > 0) {
      console.error("\n🔴 CONTROLE FALHOU — o instrumento não sabe mais dizer o que promete:");
      for (const linha of controleFalhou) console.error(`  ${linha}`);
      process.exit(2);
    }

    const autoFalhou = rodarAutotestes();
    if (autoFalhou.length > 0) {
      console.error("\n🔴 AUTOTESTE FALHOU — um portão de RECUSA parou de recusar:");
      for (const linha of autoFalhou) console.error(`  ${linha}`);
      process.exit(2);
    }
    console.log(`\n✅ os ${alvo.length} controles de CATEGORIA e os ${AUTOTESTES.length} autotestes de RECUSA`);
    console.log("   saíram como declararam. O instrumento sabe dizer sobreviveu, sem alvo e");
    console.log("   sem medição nos dois ramos, sabe acusar um `mata` que não mata, e sabe");
    console.log("   RECUSAR começar com `mata` frouxo, `mata` fantasma ou campo de controle");
    console.log("   numa entrada real. Não é um carimbador de morreu.");
    return;
  }

  if (mataFalhou.length > 0) {
    console.error('\n🔴 "mata" DECLARADO QUE NÃO MORREU — a tabela mente sobre quem trava o quê:');
    for (const linha of mataFalhou) console.error(`  ${linha}`);
    process.exit(2);
  }
  if (placar.sobreviveu + placar["sem alvo"] + placar["sem diff"] + placar["sem medição"] > 0) {
    process.exit(2);
  }
}

main();
