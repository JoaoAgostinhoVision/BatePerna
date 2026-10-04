#!/usr/bin/env node
/** 🔴 O HARNESS DE MUTAÇÃO DO `src/lib/coerencia.ts` — refeito do zero em
 *  2026-09-27 (rodada de conserto 3/5) porque o original vivia em
 *  `scratchpad/mutar.mjs`, uma pasta efêmera de sessão, e morreu com a pausa.
 *  A rodada 4/5 o endureceu depois de uma re-revisão que achou DOIS
 *  defeitos Critical nele mesmo — ver (a) e (b).
 *
 *  Este arquivo é a fonte única das 42 entradas acumuladas nas rodadas
 *  anteriores (16 da extração + 12 da rodada 1/5 + 6 da rodada 2/5 + 8 da
 *  onda de conserto 2 da Tarefa 7, T e Z; são 41 trocas distintas, porque
 *  N11 e B1a coincidem — ver abaixo) — nenhuma das 34 primeiras
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
 *      node scripts/mutar.mjs                 # as 42 entradas
 *      node scripts/mutar.mjs M12 N3 B3b      # só estas
 *      node scripts/mutar.mjs --controles     # o teste do INSTRUMENTO: os
 *                                             # controles de CATEGORIA e TODOS
 *                                             # os autotestes (de RECUSA,
 *                                             # código 1, e de VEREDITO, 2).
 *                                             # 🔴 QUANTOS SÃO NÃO ESTÁ ESCRITO
 *                                             # AQUI, de propósito: esta prosa
 *                                             # já nasceu falsa DUAS vezes (a
 *                                             # 4d acrescentou o quinto
 *                                             # autoteste e deixou dois lugares
 *                                             # dizendo "quatro"; a 4e
 *                                             # acrescentou quatro e deixou
 *                                             # dizendo "dez e dois"). O número
 *                                             # de verdade sai do banner do
 *                                             # comando, contado das listas
 *                                             # cravadas, e o guarda dele é
 *                                             # tests/lib/harness-de-mutacao
 *                                             # .test.ts.
 *      node scripts/mutar.mjs --inventario    # as três listas REAIS (não as
 *                                             # cravadas), mais tudo de que o
 *                                             # guarda de fora precisa: o piso,
 *                                             # os arquivos medidos, as
 *                                             # categorias e os arquivos
 *                                             # exigidos. Em JSON, sem mutar
 *                                             # nada. 🔴 QUANTAS CHAVES SÃO não
 *                                             # está escrito aqui, pelo mesmo
 *                                             # motivo das contagens acima: a
 *                                             # redação anterior dizia "cinco"
 *                                             # e o MESMO commit acrescentou a
 *                                             # sexta e a sétima.
 *
 *  🔴 Este arquivo tem contagens em prosa em vários lugares (as 42 entradas, as
 *  cinco categorias, os níveis do instrumento), e TODA VEZ que uma delas ficou
 *  no mundo antigo ela virou frase falsa — sete rodadas, sete. As do comando
 *  acima são as que mais custaram: a rodada 4d acrescentou o quinto autoteste e deixou
 *  dois lugares dizendo "quatro" — a quinta frase falsa em cinco rodadas,
 *  sempre na parte que ninguém re-lê, e esta na única seção que alguém lê ANTES
 *  de rodar o comando. Quem for mexer nas listas: o número de verdade sai de
 *  `node scripts/mutar.mjs --inventario`, e o guarda dele é
 *  `tests/lib/harness-de-mutacao.test.ts`, que roda em `npm test`.
 *
 *  Roda de qualquer pasta: a raiz sai do lugar deste arquivo, não do `cwd`.
 *
 *   - **0** — na rodada normal: todas morreram e todo `mata` declarado
 *     realmente falhou. No `--controles`: os controles E os autotestes saíram
 *     como declararam, e o inventário das três listas bate.
 *   - **1** — recusa de COMEÇAR ou de terminar. A lista é aberta de propósito,
 *     porque ela cresceu em cinco rodadas seguidas, e hoje tem: árvore suja
 *     nos arquivos envolvidos (antes ou depois); arquivo de teste que não
 *     existe mais; a suíte de base já vermelha; a base executando menos testes
 *     que o piso (arquivo renomeado ou `describe.skip`); um `mata` frouxo (nome
 *     que casa zero ou mais de um teste real); uma entrada de `MUTACOES`
 *     trazendo campo que só existe em `CONTROLES`, **própria ou herdada do
 *     protótipo**; uma entrada de `MUTACOES` **sem `mata`, ou com `mata: []`**;
 *     **qualquer uma das três listas fora do inventário cravado à mão**; e o
 *     **guarda de fora apagado** (`tests/lib/harness-de-mutacao.test.ts`), que é
 *     a recusa nascida na rodada 4f e que ficou faltando nesta lista no commit
 *     que a criou.
 *     Cada recusa imprime uma MARCA (`[PORTAO:...]`), e é a marca — nunca a
 *     prosa — que os autotestes casam.
 *   - **2** — achado, e as duas sentenças também imprimem marca
 *     (`[VEREDITO:...]`): sobreviveu / sem alvo / sem diff / sem medição, ou um
 *     `mata` declarado que não falhou, ou um controle fora do que declarou, ou
 *     um autoteste que parou de recusar.
 *
 *  🔴 O `--controles` PRECISA poder ficar verde, e por isso ele não aplica a
 *  regra geral: lá "sobreviveu", "sem alvo" e "sem medição" são o resultado
 *  CERTO. Um guarda que nunca fica verde não é guarda, é ruído que se aprende a
 *  ignorar. 🔴 Mas o preço disso ficou escondido quatro rodadas: o modo
 *  controle dá `return` ANTES do veredito, então ele exercita o
 *  CLASSIFICADOR e nunca a SENTENÇA. É a terceira família de autotestes
 *  (`esperaCodigo: 2`) que cobre isso, e ela nasceu na rodada 4e.
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
 *   - **o próprio instrumento, em CINCO níveis** (a redação anterior dizia
 *     QUATRO e se contradizia cinco linhas abaixo, nomeando um quinto — a mesma
 *     espécie que este arquivo já confessou ter corrigido uma vez):
 *
 *       1. os **controles de CATEGORIA**, um por ramo do que o harness DIZ — e
 *          o do `sem diff` só nasceu na rodada 4g, depois de um re-revisor medir
 *          que ele era o único ramo do classificador sem controle nenhum;
 *       2. os **autotestes de RECUSA** (código 1);
 *       3. os **autotestes de VEREDITO** (código 2) — porque o modo controle dá
 *          `return` antes da sentença, e por quatro rodadas ninguém provou que
 *          dizer "sobreviveu" virava exit 2;
 *       4. o **inventário** das três listas contra as listas cravadas à mão;
 *       5. e o único que **não mora aqui**:
 *          `tests/lib/harness-de-mutacao.test.ts`, que roda em `npm test` e
 *          portanto em todo dispatch.
 *
 *     Os autotestes rodam cada um num processo filho, porque um `process.exit`
 *     só se confere de fora.
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
 *     🔴 ONDE A RECURSÃO PARA, e a resposta MUDOU na rodada 4e. Por cinco
 *     rodadas ela foi "a última camada não é mecanismo: é um inventário cravado
 *     à mão". Estava incompleta, e um re-revisor mostrou por quê: o inventário
 *     morava **dentro do arquivo que a sabotagem edita**, então quem apaga 31
 *     das 34 entradas apaga a lista cravada no mesmo movimento. A resposta de
 *     hoje tem duas metades:
 *
 *       (i)  a última camada é **DADO que uma pessoa lê** — `MUTACOES_ESPERADAS`,
 *            `CONTROLES_ESPERADOS` e `AUTOTESTES_ESPERADOS`, que pinam o **par**
 *            nome + o que cada entrada AFIRMA (nome não basta: cinco clones
 *            mantendo os nomes e afirmando outra coisa passaram verdes);
 *       (ii) e ela mora **FORA**, em `tests/lib/harness-de-mutacao.test.ts`, que
 *            roda em `npm test`. As duas camadas se guardam: o teste de fora pega
 *            as sabotagens COORDENADAS (as duas listas cortadas juntas), e o
 *            portão `ARQUIVOS_EXIGIDOS` daqui recusa começar se o teste de fora
 *            for apagado — que era silencioso nas duas pontas até a 4e.
 *
 *     Mexeu em lista? Mexa nas cravadas, à mão — a fricção é o ponto.
 *
 *     As sabotagens hoje cobertas, todas medidas: colapsar "sem medição" em
 *     "morreu"; forçar `mataConfere`; baixar o piso e cortar a lista pela
 *     metade; apagar o piso de especificidade; desligar o portão dos campos
 *     de controle; apagar ou renomear um autoteste; trocar a substância de um
 *     autoteste mantendo o nome; e uma entrada real **sem** `mata`. Cada uma
 *     sai com 1 ou 2, nomeando quem ela quebrou.
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
 *  O `include` do `tsconfig.json` tem quatro padrões (`next-env.d.ts`,
 *  `**\/*.ts`, `**\/*.tsx` e `.next/types/**\/*.ts`) e nenhum deles alcança um
 *  `.mjs` — este arquivo nunca entra em `npx tsc --noEmit`. (A redação anterior
 *  dizia "só inclui `**\/*.ts` e `**\/*.tsx`", que é falso no meio e verdadeiro
 *  na conclusão; medido em 27/09.) E o `next build` só compila o que está no grafo de
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
 *    diferente — mas quem rodar as 42 vai ver os dois placares idênticos, e
 *    isto está dito aqui para não parecer erro de cópia. 🔴 Consequência
 *    que tem de ser dita junto com o placar: são **42 entradas e 41
 *    trocas distintas**. Quem escrever "42 mutações" sem essa linha ao
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
// AS 42 MUTAÇÕES — 16 da extração (M) + 12 da rodada 1/5 (N) + 6 da rodada
// 2/5 (B), reconstruídas de `task-2-report.md` contra o `src/lib/coerencia.ts`
// e o `src/app/[slug]/page.tsx` de HOJE; mais 8 (T e Z) da onda de conserto 2
// da Tarefa 7 (2026-10-01): a 14ª regra e a aceitação dos dois zeros.
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
      inicio: 668, fim: 668,
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
      inicio: 201, fim: 204,
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
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "o chip que não bate com o preço é pego",
    ],
  },
  {
    id: "M3",
    titulo: "a regra do piso ignora a prosa",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 370, fim: 370,
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
      inicio: 668, fim: 668,
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
      inicio: 289, fim: 289,
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
      inicio: 293, fim: 293,
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
      inicio: 165, fim: 168,
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
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "custo sem preço legível dá UM erro, não dois",
    ],
  },
  {
    id: "M7",
    titulo: "a regra dos dias devolve [] (dia-repetido-ou-inventado)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 544, fim: 547,
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
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
    ],
  },
  {
    id: "M8",
    titulo: "desliga o exame do limiar_mm",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 524, fim: 524,
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
      inicio: 457, fim: 457,
      espera: '        if (!citada || !f.horario) return []; // sem campo, quem acusa é a regra de cima',
      novo: '        if (true) return []; // sem campo, quem acusa é a regra de cima (mutacao M9)',
    }],
    mata: [
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "a hora citada na prosa é lida com acento e sem acento",
    ],
  },
  {
    id: "M10",
    titulo: "desliga o exame do nome de dia inventado",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 558, fim: 558,
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
      inicio: 486, fim: 486,
      espera: '        if (!(r.janela_passado_horas >= 0)) {',
      novo: '        if (false) { // mutacao M11: exame do janela_passado_horas desligado',
    }],
    mata: "a janela de chuva é conferida nos TRÊS números, um a um",
  },
  {
    id: "M12",
    titulo: "tira rotulo_escaneio dos textos que distinguem",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 150, fim: 150,
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
      inicio: 412, fim: 412,
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
      inicio: 147, fim: 147,
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
      inicio: 165, fim: 168,
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
      inicio: 364, fim: 369,
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
      inicio: 288, fim: 289,
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
      inicio: 146, fim: 151,
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
      inicio: 165, fim: 168,
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
      inicio: 206, fim: 208,
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
      inicio: 247, fim: 247,
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
      inicio: 411, fim: 411,
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
        inicio: 435, fim: 435,
        espera: '        const citada = /fecha (?:às|as) (\\d{1,2})\\s*h/i.exec(prosaDe(f));',
        novo: '        const citada = /fecha às (\\d{1,2})\\s*h/i.exec(prosaDe(f)); // mutacao N8',
      },
      {
        inicio: 456, fim: 456,
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
      inicio: 569, fim: 572,
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
      inicio: 601, fim: 603,
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
      inicio: 415, fim: 415,
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
      inicio: 109, fim: 109,
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
      inicio: 415, fim: 415,
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
      inicio: 415, fim: 415,
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
      inicio: 178, fim: 178,
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
      inicio: 178, fim: 178,
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
      inicio: 215, fim: 215,
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
      inicio: 215, fim: 215,
      espera: '          frase: noCurto',
      novo: '          frase: false // mutacao B3b: sempre o ramo sem numero',
    }],
    // A redação antiga trazia um sufixo entre parênteses (metade divergente)
    // que não existe no nome do teste — era prosa, e o guarda de `mata` pegou.
    mata: [
      "chip com número DIVERGENTE mostra os dois preços lado a lado",
    ],
  },
  // ── A 14ª regra (o teto do provedor) e a aceitação dos DOIS zeros — onda de
  // conserto 2 da Tarefa 7 (2026-10-01). Até ela estas provas existiam só na
  // tabela dos relatórios, não no instrumento (Minor n4 da re-revisão).
  // T1/T2 desligam cada exame do teto; T3/T4 movem cada borda (o teto exato
  // passa a ser recusado). Z1/Z2 voltam a recusar cada zero sozinho; Z3 deixa
  // o par 0/0 passar; Z4 esquece a previsão NEGATIVA no par (a outra metade
  // da bifurcação `!(previsão > 0)`).
  {
    id: "T1",
    titulo: "desliga o teto da previsão (janela-dentro-do-provedor)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 632, fim: 632,
      espera: '        if (r.janela_previsao_horas > TETO_PREVISAO_HORAS) {',
      novo: '        if (false) { // mutacao T1: teto da previsao desligado',
    }],
    mata: [
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
    ],
  },
  {
    id: "T2",
    titulo: "desliga o teto do passado (janela-dentro-do-provedor)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 642, fim: 642,
      espera: '        if (r.janela_passado_horas > TETO_PASSADO_HORAS) {',
      novo: '        if (false) { // mutacao T2: teto do passado desligado',
    }],
    mata: "a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  },
  {
    id: "T3",
    titulo: "borda do teto da previsão: `>` vira `>=` (recusa o teto exato)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 632, fim: 632,
      espera: '        if (r.janela_previsao_horas > TETO_PREVISAO_HORAS) {',
      novo: '        if (r.janela_previsao_horas >= TETO_PREVISAO_HORAS) { // mutacao T3',
    }],
    mata: "a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  },
  {
    id: "T4",
    titulo: "borda do teto do passado: `>` vira `>=` (recusa o teto exato)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 642, fim: 642,
      espera: '        if (r.janela_passado_horas > TETO_PASSADO_HORAS) {',
      novo: '        if (r.janela_passado_horas >= TETO_PASSADO_HORAS) { // mutacao T4',
    }],
    mata: "a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  },
  {
    id: "Z1",
    titulo: "a previsão zero volta a ser recusada",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 515, fim: 515,
      espera: '        if (!(r.janela_previsao_horas >= 0)) {',
      novo: '        if (!(r.janela_previsao_horas > 0)) { // mutacao Z1: recusa a previsao zero',
    }],
    mata: [
      "previsão ZERO sozinha não é violação: a regra ainda fecha pelo passado",
      "previsão 0 E passado 0: violação, com a frase de que o lugar nunca fecha",
    ],
  },
  {
    id: "Z2",
    titulo: "o passado zero volta a ser recusado",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 486, fim: 486,
      espera: '        if (!(r.janela_passado_horas >= 0)) {',
      novo: '        if (!(r.janela_passado_horas > 0)) { // mutacao Z2: recusa o passado zero',
    }],
    mata: "passado ZERO sozinho não é violação: a regra ainda fecha pela previsão",
  },
  {
    id: "Z3",
    titulo: "o par 0/0 (a regra que nunca fecha) passa",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 499, fim: 499,
      espera: '        if (r.janela_passado_horas === 0 && !(r.janela_previsao_horas > 0)) {',
      novo: '        if (false) { // mutacao Z3: o par 0/0 passa',
    }],
    mata: [
      "cada uma das 14 regras dispara na quebra escrita pra ela",
      "janela de chuva zerada é pega",
      "previsão 0 E passado 0: violação, com a frase de que o lugar nunca fecha",
    ],
  },
  {
    id: "Z4",
    titulo: "o par só acusa com a previsão EXATAMENTE zero (esquece a negativa)",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 499, fim: 499,
      espera: '        if (r.janela_passado_horas === 0 && !(r.janela_previsao_horas > 0)) {',
      novo: '        if (r.janela_passado_horas === 0 && r.janela_previsao_horas === 0) { // mutacao Z4',
    }],
    mata: "passado 0 E previsão negativa: as duas frases, a do par e a do negativo",
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

/** 🔴 O GUARDA DE FORA, EXIGIDO E NÃO MEDIDO — e esta lista nasceu do achado
 *  mais desconfortável da re-revisão da 4e: **nada guardava o guarda de fora.**
 *  A tese da rodada era "a última camada mora em `tests/`, que roda em todo
 *  dispatch", e um re-revisor simplesmente MOVEU o arquivo para fora da
 *  árvore: `npx vitest run` ficou verde em 81/1289 (ninguém acusou os nove
 *  testes que sumiram, porque número nenhum estava cravado), o harness seguiu
 *  em exit 0 — e com o arquivo fora, as TRÊS sabotagens coordenadas que a
 *  rodada 4e provou vermelhas voltavam a passar. É a família do defeito mais
 *  caro desta branch: o que não é referenciado por nada desaparece em silêncio.
 *
 *  Estes arquivos são **exigidos** (`existsSync`) e **não medidos**: eles não
 *  entram no filtro do vitest nem no piso. Agora as duas camadas se guardam:
 *  apagar o guarda de fora faz o harness RECUSAR começar, e o portão que faz
 *  isso tem autoteste (`guarda-de-fora`), que por sua vez está cravado na lista
 *  do guarda de fora. */
let ARQUIVOS_EXIGIDOS = ["tests/lib/harness-de-mutacao.test.ts"];

/** O PISO: quantos testes estes dois arquivos somam quando tudo está no lugar.
 *  Medido em 2026-09-27, depois de a rodada 4/5 partir dois `it` em quatro:
 *  33 (`coerencia.test.ts`) + 18 (`coerencia-acervo.test.ts`) = **51**.
 *  Subido em 2026-10-01 (onda de conserto 2 da Tarefa 7), medido de novo:
 *  40 + 19 = **59** — os casos do teto e dos dois zeros entraram, e o piso
 *  velho só avisava.
 *
 *  🔴 Ele é conferido contra os testes EXECUTADOS (passaram + falharam), nunca
 *  contra `numTotalTests`. A diferença foi medida e importa: um `describe.skip`
 *  deixa `numTotalTests` em 51 com os 51 em `pending` e `success: true` — o
 *  piso nunca dispararia, e a rodada mediria ZERO achando que mediu tudo.
 *
 *  Se você acrescentar testes a estes arquivos, suba o número: `main()` mede a
 *  base antes de mutar e RECUSA começar se o medido for menor que ele; um
 *  medido MAIOR só avisa, porque aí o piso está velho mas não está mentindo. */
const PISO_DE_TESTES = 59;

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

let CONTROLES = [
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
    esperaPorque: null,
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
    esperaPorque: null,
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
    // O ramo DESTE controle: relatório ausente. A frase é só dele — a do outro
    // ramo fala de EXECUTOU.
    esperaPorque: "não escreveu relatório",
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
    // O outro ramo: o vitest MEDIU, e mediu menos que o piso. "EXECUTOU" não
    // aparece na mensagem do ramo de cima. O número de testes fica fora de
    // propósito: ele muda quando alguém acrescenta um `it`, e isso não é
    // defeito nenhum deste controle.
    esperaPorque: "EXECUTOU",
    mata: null,
  },
  {
    id: "CTRL-SEM-DIFF",
    titulo: "CONTROLE: troca que não muda NADA (o `novo` igual ao `espera`)",
    arquivo: COERENCIA,
    // 🔴 Este controle faltava, e a frase "cinco controles, um por ramo do que o
    // harness DIZ" era falsa por causa dele: `sem diff` era o único ramo do
    // classificador sem controle nenhum. Medido na sétima passada — desviar o
    // ramo `sem diff` para `sobreviveu` deixava as três camadas verdes.
    edicoes: [{
      inicio: 1, fim: 1,
      espera: 'import { PISOS } from "@/lib/piso";',
      novo: 'import { PISOS } from "@/lib/piso";',
    }],
    esperaCategoria: "sem diff",
    esperaPorque: null,
    mata: null,
  },
  {
    id: "CTRL-MATA-ERRADO",
    titulo: "CONTROLE: mutação que morre de verdade, com `mata` FANTASMA",
    arquivo: COERENCIA,
    edicoes: [{
      inicio: 668, fim: 668,
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
    esperaPorque: null,
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
    // 🔴 `nomes.length > 0` antes do `every`: `[].every(...)` é `true` por
    // vacuidade, e com isso `mata: []` imprimia "mata confere: sim" provando
    // nada. O portão de cima já recusa a entrada; este cinto existe porque a
    // rodada 4d mostrou que DUAS portas em série caem juntas quando as duas
    // confiam na mesma leitura (47ª espécie).
    const mataConfere = nomes === null ? null : nomes.length > 0 && nomes.every((n) => r.falhas.some((f) => f.includes(n)));
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

// As MARCAS das recusas. Elas existem para o `esperaTrecho` dos AUTOTESTES nao
// depender da PROSA da mensagem: um re-revisor mediu que a frase "piso de
// especificidade" aparece, partida pela quebra de linha, DENTRO da mensagem do
// outro portao -- um `console.error` reembrulhado e os dois autotestes deixavam
// de discriminar. Marca e codigo, nao texto.
const MARCA_ESPECIFICIDADE = "[PORTAO:ESPECIFICIDADE]";
const MARCA_CAMPOS = "[PORTAO:CAMPOS-DE-CONTROLE]";
const MARCA_SEM_MATA = "[PORTAO:SEM-MATA]";
const MARCA_INVENTARIO = "[PORTAO:INVENTARIO]";
const MARCA_GUARDA = "[PORTAO:GUARDA-DE-FORA]";
/** 🔴 As marcas do VEREDITO, e elas nasceram do achado mais fino da rodada
 *  4e/5: os cinco controles de categoria provam que o harness sabe DIZER
 *  "sobreviveu"; nada provava que dizer isso virava **exit 2**. Um re-revisor
 *  apagou as três linhas do veredito e um buraco REAL saiu com **exit 0**,
 *  imprimindo `🔴 SOBREVIVEU` igual — stdout idêntico, e só o código de saída
 *  diferente, que é justamente o que um dispatch lê. A sentença agora tem
 *  marca, e a marca tem autoteste (família `esperaCodigo: 2`). */
const MARCA_VEREDITO_MATA = "[VEREDITO:MATA-NAO-MORREU]";
const MARCA_VEREDITO_CATEGORIA = "[VEREDITO:CATEGORIA-DE-FALHA]";

// ═══════════════════════════════════════════════════════════════════════════
// O INVENTÁRIO CRAVADO À MÃO — e é AQUI que a recursão para.
//
// 🔴 A quinta sabotagem, medida por um re-revisor em 27/09: os autotestes eram
// um **enumerador sem controle de não-vacuidade**. Nada conferia quantos são,
// quais são, nem que fossem distintos — e o banner de sucesso imprimia
// `AUTOTESTES.length`, que vem da PRÓPRIA lista, então ele não enxerga o que
// encolheu. Trocando os quatro autotestes por quatro CLONES do mesmo e
// apagando o piso de especificidade, `--controles` saiu **verde, exit 0**,
// ainda dizendo "4 autotestes", e `mata: "a"` voltou a passar. É a 44ª espécie
// do catálogo — guarda cego ao que sumiu — aplicada aos próprios guardas.
//
// O padrão das últimas três rodadas, escrito por extenso porque ele é o
// aprendizado e não o defeito:
//
//   4a  o portão nasceu sem controle           → nasceram os controles
//   4b  o portão NOVO nasceu sem controle      → nasceram os autotestes
//   4c  o CONTROLE novo nasceu sem inventário  → nasceu este arquivo de listas
//
// Cada rodada resolveu o caso e criou a camada seguinte sem guarda. Uma quarta
// camada de mecanismo repetiria isso para sempre. **A recursão só para quando
// a última camada é um DADO que uma pessoa lê**, e não um mecanismo que se
// audita — o mesmo idioma que `tests/lib/coerencia.test.ts:182` já usa neste
// projeto: *"o número é cravado à mão, como todo número deste projeto"*.
//
// Mexeu em controle ou autoteste? Mexa aqui também, à mão. É para doer um
// pouco: é essa fricção que faz alguém olhar.
// ═══════════════════════════════════════════════════════════════════════════

/** 🔴 Nome NÃO basta, e eu descobri isso testando o meu próprio conserto: a
 *  primeira versão destas listas guardava só os nomes, e eu troquei os cinco
 *  autotestes por cinco CLONES que mantinham os nomes e afirmavam outra coisa
 *  — passou verde, exit 0. Então o que está cravado aqui é o PAR: o nome e o
 *  que aquele guarda tem de AFIRMAR. Trocar a substância mantendo o nome bate
 *  aqui; e trocar o nome também. */
/** 🔴 A SUBSTÂNCIA de cada espécie de entrada — o "o que este guarda AFIRMA"
 *  do par que o inventário pina. As três funções existem porque **nome não
 *  basta** (rodada 4d) e porque **categoria não basta** (rodada 4e): o
 *  inventário dos controles pinava só `esperaCategoria`, e apagar a linha
 *  `esperaMataConfere: false` de `CTRL-MATA-ERRADO` — UMA linha de dado —
 *  deixava o portão do `mata` sem controle nenhum enquanto o banner seguia
 *  afirmando por extenso que o instrumento "sabe acusar um `mata` que não
 *  mata". Medido por um re-revisor em 27/09. O par é composto de propósito:
 *  tudo o que aquela entrada promete entra na string. */
function substanciaDeControle(c) {
  // 🔴 A categoria NÃO é o ramo, e isto foi medido: `CTRL-SEM-MEDICAO` e
  // `CTRL-PISO-BAIXO` existem para os DOIS ramos distintos de "sem medição"
  // (relatório ausente × piso curto) e tinham a substância byte a byte
  // idêntica. Duas edições de DADO — trocar `arquivosDeTeste` e apagar
  // `piso: 0` — faziam um virar clone do outro com as duas camadas verdes, e o
  // ramo perdido é justamente o `!existsSync(saida)`, cuja ausência em 3/5 fez
  // uma troca de COMENTÁRIO sair carimbada "morreu" com exit 0.
  //
  // `esperaPorque` é o trecho da mensagem que aquele ramo — e só ele —
  // imprime. É conferido de verdade em `main()`, não só cravado aqui.
  const mc = "esperaMataConfere" in c ? String(c.esperaMataConfere) : "nao-declarado";
  const porque = "esperaPorque" in c ? JSON.stringify(c.esperaPorque) : "nao-declarado";
  return `${c.esperaCategoria}|mataConfere=${mc}|porque=${porque}`;
}

/** Para um autoteste, a substância é a MARCA que ele espera mais o `mata` que
 *  ele injeta — sem a segunda metade, clonar `mata-fantasma` em cima de
 *  `mata-frouxo` (mesmo nome, mesma marca, `mata` trocado de fantasma para
 *  `"a"`) passava pelo inventário em silêncio, e o ramo ZERO do piso de
 *  especificidade perdia o controle. */
function substanciaDeAutoteste(a) {
  // 🔴 Sem os `args` os três autotestes de inventário tinham a substância
  // IDÊNTICA (`1|[PORTAO:INVENTARIO]|mata=(sem entrada)`), e um re-revisor
  // trocou as `args` de dois deles para `--sabotar=mutacoes`: os três ficaram
  // verdes testando a MESMA lista, os portões de inventário de CONTROLES e de
  // AUTOTESTES ficaram sem controle, e o banner seguiu dizendo que "o
  // inventário das TRÊS listas bate". É a 44ª espécie na forma de clone.
  const mata = a.entrada && "mata" in a.entrada ? JSON.stringify(a.entrada.mata) : "(sem entrada)";
  // 🔴 E o `novo` de cada edição entra também, porque sem ele os três autotestes
  // de VEREDITO das categorias de falha (`sem alvo`, `sem diff`, `sem medição`)
  // nasceram com substância IDÊNTICA — medido por mim, no mesmo dia em que um
  // re-revisor me mostrou essa espécie nos três de inventário. O que distingue
  // esses três não é a linha (os três mexem na linha 1): é a TROCA.
  const troca = a.entrada
    ? a.entrada.edicoes.map((e) => `${e.inicio}-${e.fim}→${JSON.stringify(e.novo)}`).join("; ")
    : "(sem entrada)";
  // 🔴 E os campos de controle da entrada injetada, separando PRÓPRIO de
  // HERDADO — porque é exatamente isso que `campo-de-controle-herdado` existe
  // para exercitar, e sem isto ele era degradável por DADO: trocar o
  // `Object.create({piso: 1})` por um objeto comum com `piso` próprio deixava a
  // substância byte a byte idêntica, e depois disso reverter o `c in m` para
  // `hasOwnProperty` mantinha o autoteste VERDE. Medido na sétima passada.
  const campos = a.entrada
    ? CAMPOS_SO_DE_CONTROLE
        .filter((c) => c in a.entrada)
        .map((c) => `${Object.prototype.hasOwnProperty.call(a.entrada, c) ? "own" : "proto"}:${c}`)
        .join(",") || "(nenhum)"
    : "(sem entrada)";
  return `${a.esperaCodigo}|${a.esperaTrecho}|mata=${mata}|args=${JSON.stringify(a.args ?? [])}|troca=${troca}|campos=${campos}`;
}

/** E para uma mutação, a substância é o `mata` — o teste que ela declara
 *  matar, que é a única coisa que ela promete ao mundo. */
function substanciaDeMutacao(m) {
  // 🔴 O `mata` sozinho pinava a DECLARAÇÃO e deixava a CARGA de fora — medido
  // por um re-revisor em 27/09: repontar as `edicoes` de M8 para as de M11
  // (que declara o mesmo `mata`) saía "34 morreu, mata confere: sim, exit 0"
  // com as DUAS camadas verdes, e o exame do `limiar_mm` ficava sem sonda
  // nenhuma. O `arquivo` entra porque `ARQUIVOS_ENVOLVIDOS` deriva daqui: a
  // única entrada que muta `page.tsx` é o que mantém o arquivo no guarda de
  // árvore suja.
  // 🔴 E a TROCA entra junto, não só o lugar — esta é a metade que a onda
  // anterior deixou de fora, e a sétima passada mediu o preço: trocando só o
  // `novo` de M8 por uma quebra de OUTRA coisa, o harness imprimia
  // `M8 [morreu] desliga o exame do limiar_mm`, `mata confere: sim`, exit 0,
  // com o exame do `limiar_mm` INTACTO e o inventário byte a byte igual. A
  // entrada mentia sobre a própria identidade. `substanciaDeAutoteste` já
  // pinava a troca desde o commit anterior; aqui é a mesma decisão, na lista
  // que mais precisava dela.
  const onde = m.edicoes.map((e) => `${e.inicio}-${e.fim}→${JSON.stringify(e.novo)}`).join("; ");
  const oque = m.mata == null ? "(sem mata)" : (Array.isArray(m.mata) ? m.mata.join(" + ") : String(m.mata));
  return `${m.arquivo}@${onde} · ${oque}`;
}

/** 🔴 As listas cravadas à mão, e a regra que as governa: **o número nunca vem
 *  do `length` do array que acabou de rodar.** Os literais estão escritos por
 *  extenso de propósito, sem referência a constante — colapsar as quatro
 *  `MARCA_*` num valor só deixava o inventário MUDO, porque os dois lados
 *  viravam a mesma constante, e os autotestes voltavam a não discriminar qual
 *  portão disparou (que é a colisão de prosa que a rodada 4d consertou).
 *  Mexeu numa lista? Mexa aqui, à mão. A fricção é o ponto. */
const CONTROLES_ESPERADOS = {
  "CTRL-SOBREVIVE": "sobreviveu|mataConfere=nao-declarado|porque=null",
  "CTRL-SEM-ALVO": "sem alvo|mataConfere=nao-declarado|porque=null",
  "CTRL-SEM-DIFF": "sem diff|mataConfere=nao-declarado|porque=null",
  "CTRL-SEM-MEDICAO": 'sem medição|mataConfere=nao-declarado|porque="não escreveu relatório"',
  "CTRL-PISO-BAIXO": 'sem medição|mataConfere=nao-declarado|porque="EXECUTOU"',
  "CTRL-MATA-ERRADO": "morreu|mataConfere=false|porque=null",
};

const AUTOTESTES_ESPERADOS = {
  "mata-frouxo": "1|[PORTAO:ESPECIFICIDADE]|mata=\"a\"|args=[]|troca=668-668→\"  return [];\"|campos=(nenhum)",
  "mata-fantasma": "1|[PORTAO:ESPECIFICIDADE]|mata=\"ESTE TESTE NUNCA EXISTIU\"|args=[]|troca=668-668→\"  return [];\"|campos=(nenhum)",
  "mata-ausente": "1|[PORTAO:SEM-MATA]|mata=(sem entrada)|args=[]|troca=668-668→\"  return [];\"|campos=(nenhum)",
  "campo-de-controle": "1|[PORTAO:CAMPOS-DE-CONTROLE]|mata=\"a\"|args=[]|troca=668-668→\"  return [];\"|campos=own:mataFantasmaDeProposito",
  "piso-por-entrada": "1|[PORTAO:CAMPOS-DE-CONTROLE]|mata=\"cada uma das 14 regras dispara na quebra escrita pra ela\"|args=[]|troca=668-668→\"  return [];\"|campos=own:piso,own:arquivosDeTeste",
  "mata-lista-vazia": "1|[PORTAO:SEM-MATA]|mata=[]|args=[]|troca=668-668→\"  return [];\"|campos=(nenhum)",
  "campo-de-controle-herdado": "1|[PORTAO:CAMPOS-DE-CONTROLE]|mata=\"o chip que não bate com o preço é pego\"|args=[]|troca=668-668→\"  return [];\"|campos=proto:piso",
  "inventario-mutacoes": "1|[PORTAO:INVENTARIO]|mata=(sem entrada)|args=[\"--sabotar=mutacoes\"]|troca=(sem entrada)|campos=(sem entrada)",
  "inventario-controles": "1|[PORTAO:INVENTARIO]|mata=(sem entrada)|args=[\"--sabotar=controles\"]|troca=(sem entrada)|campos=(sem entrada)",
  "inventario-autotestes": "1|[PORTAO:INVENTARIO]|mata=(sem entrada)|args=[\"--sabotar=autotestes\"]|troca=(sem entrada)|campos=(sem entrada)",
  "veredito-sobreviveu": "2|[VEREDITO:CATEGORIA-DE-FALHA]|mata=\"cada uma das 14 regras dispara na quebra escrita pra ela\"|args=[]|troca=1-1→\"import { PISOS as PISOS } from \\\"@/lib/piso\\\";\"|campos=(nenhum)",
  "veredito-sem-alvo": "2|[VEREDITO:CATEGORIA-DE-FALHA]|mata=\"o chip que não bate com o preço é pego\"|args=[]|troca=1-1→\"nada\"|campos=(nenhum)",
  "veredito-sem-diff": "2|[VEREDITO:CATEGORIA-DE-FALHA]|mata=\"o chip que não bate com o preço é pego\"|args=[]|troca=1-1→\"import { PISOS } from \\\"@/lib/piso\\\";\"|campos=(nenhum)",
  "veredito-sem-medicao": "2|[VEREDITO:CATEGORIA-DE-FALHA]|mata=\"o chip que não bate com o preço é pego\"|args=[]|troca=1-1→\"import { PISOS } from \\\"@/lib/piso\\\"; ((((\"|campos=(nenhum)",
  "guarda-de-fora": "1|[PORTAO:GUARDA-DE-FORA]|mata=(sem entrada)|args=[\"--sabotar=guarda\"]|troca=(sem entrada)|campos=(sem entrada)",
  "veredito-mata-mente": "2|[VEREDITO:MATA-NAO-MORREU]|mata=\"a ficha sozinha, com a frase dela mesma, não é acusada de emprestar\"|args=[]|troca=668-668→\"  return [];\"|campos=(nenhum)",
};

/** 🔴 A SEXTA SABOTAGEM, e ela é a razão desta lista existir: `MUTACOES` era a
 *  única lista do arquivo SEM inventário — a carga útil, a razão de o arquivo
 *  existir. Um re-revisor cortou 31 das 34 entradas numa cópia e mediu
 *  `placar: 3 morreu, 0, 0, 0, 0 (de 3)` com **exit 0**, os cinco controles,
 *  os cinco autotestes e os DOIS inventários verdes — porque o denominador
 *  vinha do `length` do array que acabou de encolher, que é exatamente o
 *  defeito que a rodada anterior declarou ter matado e consertou só no banner
 *  do `--controles`. Efeito colateral medido por ele: `ARQUIVOS_ENVOLVIDOS`
 *  deriva de `MUTACOES`, e só UMA das entradas muta `page.tsx` — apagar
 *  essa uma tirava o arquivo do guarda de árvore suja, em silêncio.
 *
 *  O valor é o `mata` de cada entrada escrito por extenso (vários nomes
 *  juntados por ` + `), porque uma pessoa tem de poder LER esta lista: é ela a
 *  última camada de dado deste arquivo. Apagar uma entrada bate aqui; trocar o
 *  teste que ela declara matar também. */
const MUTACOES_ESPERADAS = {
  "M1": "src/lib/coerencia.ts@668-668→\"  return [];\" · o chip que não bate com o preço é pego + um nome de dia que não existe é pego, mesmo sem repetição nenhuma + a janela de chuva é conferida nos TRÊS números, um a um",
  "M2": "src/lib/coerencia.ts@201-204→\"    regra: \\\"chip-bate-com-preco\\\",\\n    achar: (fichas) =>\\n      fichas.flatMap((f) => {\\n        if (true) return []; // ausente é silêncio (mutacao M2: regra desligada)\" · cada uma das 14 regras dispara na quebra escrita pra ela + o chip que não bate com o preço é pego",
  "M3": "src/lib/coerencia.ts@370-370→\"        if (true) return []; // mutacao M3: regra do piso ignora a prosa\" · a prosa que nomeia piso diferente do campo é pega",
  "M4": "src/lib/coerencia.ts@668-668→\"  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a, frase: r.regra })));\" · a frase da violação nomeia o lugar e não é o identificador da regra",
  "M5": "src/lib/coerencia.ts@289-289→\"        const k = f.slug; // mutacao M5: chave por ficha, nunca agrupa com outra\" · uma ficha que empresta a frase de outra é pega",
  "M5b": "src/lib/coerencia.ts@293-293→\"        grupo.map((f) => ({ // mutacao M5b: acusa o grupo inteiro, inclusive o 1º\" · a ficha sozinha, com a frase dela mesma, não é acusada de emprestar",
  "M6": "src/lib/coerencia.ts@165-168→\"    regra: \\\"preco-legivel-no-custo\\\",\\n    achar: (fichas) =>\\n      fichas.flatMap((f) => {\\n        if (true) return []; // mutacao M6: regra desligada\" · cada uma das 14 regras dispara na quebra escrita pra ela + custo sem preço legível dá UM erro, não dois",
  "M7": "src/lib/coerencia.ts@544-547→\"    regra: \\\"dia-repetido-ou-inventado\\\",\\n    achar: (fichas) =>\\n      fichas.flatMap((f) => {\\n        if (true) return []; // mutacao M7: regra desligada\" · cada uma das 14 regras dispara na quebra escrita pra ela + um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
  "M8": "src/lib/coerencia.ts@524-524→\"        if (false) { // mutacao M8: exame do limiar_mm desligado\" · a janela de chuva é conferida nos TRÊS números, um a um",
  "M9": "src/lib/coerencia.ts@457-457→\"        if (true) return []; // sem campo, quem acusa é a regra de cima (mutacao M9)\" · cada uma das 14 regras dispara na quebra escrita pra ela + a hora citada na prosa é lida com acento e sem acento",
  "M10": "src/lib/coerencia.ts@558-558→\"        const inventados = []; // mutacao M10: exame do dia inventado desligado\" · um nome de dia que não existe é pego, mesmo sem repetição nenhuma",
  "M11": "src/lib/coerencia.ts@486-486→\"        if (false) { // mutacao M11: exame do janela_passado_horas desligado\" · a janela de chuva é conferida nos TRÊS números, um a um",
  "M12": "src/lib/coerencia.ts@150-150→null · os QUATRO textos que distinguem um lugar do outro são conferidos, um a um + a lista dos textos que distinguem tem EXATAMENTE quatro campos",
  "M13": "src/lib/coerencia.ts@412-412→null · a travessia da noite DITA na ficha passa — a regra exige o aviso, não proíbe o horário",
  "M14": "src/lib/coerencia.ts@147-147→null · os QUATRO textos que distinguem um lugar do outro são conferidos, um a um + a lista dos textos que distinguem tem EXATAMENTE quatro campos",
  "M15": "src/lib/coerencia.ts@165-168→\"    regra: \\\"preco-legivel-no-custo\\\",\\n    achar: (fichas) =>\\n      fichas.flatMap((f) => {\\n        if (f.custo.tag !== \\\"pago\\\") return []; // mutacao M15: sem exigir custo.curto\" · ficha paga SEM chip é silêncio, não violação",
  "N1": "src/lib/coerencia.ts@364-369→\"        const prosa = prosaDe(f);\\n        // \\\"asfalto-esburacado\\\" e \\\"asfalto-tapete\\\" aparecem em prosa como duas\\n        // palavras; o valor do enum é hifenizado. Comparo pelo primeiro termo.\\n        const citados = PISOS.filter((p) => prosa.includes(p.split(\\\"-\\\")[0]));\\n        const estranhos = citados.filter((p) => p.split(\\\"-\\\")[0] !== (f.piso ?? \\\"\\\").split(\\\"-\\\")[0]); // mutacao N1\" · ficha SEM piso é silêncio, mesmo com a prosa nomeando um piso",
  "N2": "src/lib/coerencia.ts@288-289→\"        const k = (f.secaRapido ?? \\\"\\\").trim().toLowerCase(); // mutacao N2: guarda removida\" · duas fichas SEM secaRapido não emprestam frase uma da outra",
  "N3": "src/lib/coerencia.ts@146-151→\"const TEXTOS_QUE_DISTINGUEM = [\\n  { campo: \\\"voz\\\", rotulo: \\\"a voz\\\" },\\n  { campo: \\\"promessa\\\", rotulo: \\\"a promessa\\\" },\\n  { campo: \\\"premio\\\", rotulo: \\\"o prêmio\\\" },\\n  { campo: \\\"rotulo_escaneio\\\", rotulo: \\\"a etiqueta\\\" },\\n  { campo: \\\"acesso\\\", rotulo: \\\"o acesso\\\" }, // mutacao N3\\n] as const;\" · a lista dos textos que distinguem tem EXATAMENTE quatro campos + campo de prosa fora da lista pode ser igual em duas fichas",
  "N4": "src/lib/coerencia.ts@165-168→\"    regra: \\\"preco-legivel-no-custo\\\",\\n    achar: (fichas) =>\\n      fichas.flatMap((f) => {\\n        if (!f.custo.curto) return []; // mutacao N4: sem exigir tag pago\" · ficha grátis não é medida por regra de custo nenhuma",
  "N5": "src/lib/coerencia.ts@206-208→\"        const noCurto = f.custo.curto.match(PRECO)?.[0]; // mutacao N5: guarda de exclusividade removida\\n        if (noCurto?.replace(/\\\\s/g, \\\"\\\") === (noValor ?? \\\"\\\").replace(/\\\\s/g, \\\"\\\")) return [];\" · custo sem preço legível dá UM erro, não dois",
  "N6": "src/lib/coerencia.ts@247-247→\"        if (palavras <= 5) return []; // mutacao N6\" · o chip cabe com 4 palavras e não cabe com 5",
  "N7": "src/lib/coerencia.ts@411-411→\"        if (abre <= fecha) return []; // mutacao N7\" · horário igual em abre e fecha é acusado, e a frase fala de 24 horas",
  "N8": "src/lib/coerencia.ts@435-435→\"        const citada = /fecha às (\\\\d{1,2})\\\\s*h/i.exec(prosaDe(f)); // mutacao N8\"; 456-456→\"        const citada = /fecha às (\\\\d{1,2})\\\\s*h/i.exec(prosaDe(f)); // mutacao N8\" · a hora citada na prosa é lida com acento e sem acento",
  "N9": "src/lib/coerencia.ts@569-572→\"            frase:\\n              `${nomeDe(f)} tem ${inventados.map((d) => `\\\"${d}\\\"`).join(\\\", \\\")} na lista de dias, ` +\\n              \\\"e isso não é dia da semana.\\\", // mutacao N9: reverte a correcao da grafia\" · a frase do dia não reconhecido fala de GRAFIA e mostra os sete dias",
  "N10": "src/lib/coerencia.ts@601-603→\"          frase:\\n            `${nomeDe(f)} declara os sete dias da semana, o que é o mesmo que não declarar dia ` +\\n            \\\"nenhum. Deixe a lista de dias vazia: o app só fala de dia quando o lugar folga em algum.\\\", // mutacao N10\" · a frase da semana inteira não manda esvaziar a lista, porque o schema recusa",
  "N11": "src/lib/coerencia.ts@415-415→\"          frase: true // mutacao N11: colapsa a bifurcacao (sempre 24h)\" · a ficha genuinamente invertida recebe a frase da noite, não a das 24 horas",
  "N12": "src/app/[slug]/page.tsx@109-109→\"  const precoCurto = ficha.custo.valor?.match(/R\\\\$\\\\s?\\\\d+(?:[.,]\\\\d{2})?/)?.[0] ?? \\\"Pago\\\"; // mutacao N12\" · o texto do regex de preço aparece UMA vez só em todo o src/ + a página continua montando o chip a partir do PRECO importado",
  "B1a": "src/lib/coerencia.ts@415-415→\"          frase: true // mutacao B1a: sempre a frase das 24h\" · a ficha genuinamente invertida recebe a frase da noite, não a das 24 horas",
  "B1b": "src/lib/coerencia.ts@415-415→\"          frase: false // mutacao B1b: sempre a frase da noite\" · horário igual em abre e fecha é acusado, e a frase fala de 24 horas",
  "B2a": "src/lib/coerencia.ts@178-178→\"          frase: true // mutacao B2a: sempre o ramo ilegivel\" · custo completo AUSENTE recebe a frase do campo vazio",
  "B2b": "src/lib/coerencia.ts@178-178→\"          frase: false // mutacao B2b: sempre o ramo ausente\" · custo completo ILEGÍVEL mostra por extenso o que ele escreveu",
  "B3a": "src/lib/coerencia.ts@215-215→\"          frase: true // mutacao B3a: sempre o ramo com numero\" · chip SEM número recebe a frase de não mostrar preço nenhum",
  "B3b": "src/lib/coerencia.ts@215-215→\"          frase: false // mutacao B3b: sempre o ramo sem numero\" · chip com número DIVERGENTE mostra os dois preços lado a lado",
  "T1": "src/lib/coerencia.ts@632-632→\"        if (false) { // mutacao T1: teto da previsao desligado\" · cada uma das 14 regras dispara na quebra escrita pra ela + a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  "T2": "src/lib/coerencia.ts@642-642→\"        if (false) { // mutacao T2: teto do passado desligado\" · a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  "T3": "src/lib/coerencia.ts@632-632→\"        if (r.janela_previsao_horas >= TETO_PREVISAO_HORAS) { // mutacao T3\" · a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  "T4": "src/lib/coerencia.ts@642-642→\"        if (r.janela_passado_horas >= TETO_PASSADO_HORAS) { // mutacao T4\" · a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um",
  "Z1": "src/lib/coerencia.ts@515-515→\"        if (!(r.janela_previsao_horas > 0)) { // mutacao Z1: recusa a previsao zero\" · previsão ZERO sozinha não é violação: a regra ainda fecha pelo passado + previsão 0 E passado 0: violação, com a frase de que o lugar nunca fecha",
  "Z2": "src/lib/coerencia.ts@486-486→\"        if (!(r.janela_passado_horas > 0)) { // mutacao Z2: recusa o passado zero\" · passado ZERO sozinho não é violação: a regra ainda fecha pela previsão",
  "Z3": "src/lib/coerencia.ts@499-499→\"        if (false) { // mutacao Z3: o par 0/0 passa\" · cada uma das 14 regras dispara na quebra escrita pra ela + janela de chuva zerada é pega + previsão 0 E passado 0: violação, com a frase de que o lugar nunca fecha",
  "Z4": "src/lib/coerencia.ts@499-499→\"        if (r.janela_passado_horas === 0 && r.janela_previsao_horas === 0) { // mutacao Z4\" · passado 0 E previsão negativa: as duas frases, a do par e a do negativo",
};

/** Confere um enumerador contra a lista escrita à mão: mesmos nomes, mesma
 *  quantidade, sem repetido, mesma substância. 🔴 A quantidade ESPERADA nunca
 *  vem do array que acabou de rodar — vem da lista cravada, e foi exatamente
 *  assim que a quinta sabotagem passou (o banner imprimia `AUTOTESTES.length`,
 *  que encolhe junto). O array de verdade é percorrido, claro; o que ele não
 *  faz é dar o número contra o qual ele mesmo é conferido. */
function conferirInventario(rotulo, reais, esperados) {
  const nomesReais = reais.map((r) => r.nome);
  const nomesEsperados = Object.keys(esperados);
  const faltando = nomesEsperados.filter((n) => !nomesReais.includes(n));
  const sobrando = nomesReais.filter((n) => !nomesEsperados.includes(n));
  const repetidos = nomesReais.filter((n, i) => nomesReais.indexOf(n) !== i);
  const trocados = reais
    .filter((r) => nomesEsperados.includes(r.nome) && r.afirma !== esperados[r.nome])
    .map((r) => `${r.nome} afirma ${JSON.stringify(r.afirma)}, e a lista diz ${JSON.stringify(esperados[r.nome])}`);
  if (faltando.length === 0 && sobrando.length === 0 && repetidos.length === 0 && trocados.length === 0) return;

  console.error(`${MARCA_INVENTARIO} o inventário de ${rotulo} não bate com a lista cravada à mão:`);
  if (faltando.length > 0) console.error(`  sumiram: ${faltando.join(", ")}`);
  if (sobrando.length > 0) console.error(`  apareceram sem estar na lista: ${sobrando.join(", ")}`);
  if (repetidos.length > 0) console.error(`  repetidos: ${[...new Set(repetidos)].join(", ")}`);
  for (const linha of trocados) console.error(`  trocaram de substância: ${linha}`);
  console.error("  Se a mudança é deliberada, atualize a lista à mão no topo do arquivo.");
  process.exit(1);
}

/** 🔴 O escape de DADO, e o mais plausível por acidente de todos: uma entrada
 *  de `MUTACOES` SEM o campo `mata` pula os DOIS portões do `mata` de uma vez
 *  (`mutacao.mata == null` é `true` para `undefined`, tanto em `rodarUma`
 *  quanto no piso de especificidade), e a rodada sai com 0 provando nada sobre
 *  teste nenhum. `CAMPOS_SO_DE_CONTROLE` não alcança isto: ela é lista negra
 *  de campo a MAIS, e o que falta aqui é o campo OBRIGATÓRIO. Quem acrescentar
 *  a 35ª entrada e esquecer o `mata` bate aqui. */
function recusarEntradasSemMata(entradas) {
  // 🔴 `mata: []` é a MESMA ausência, e ela atravessava os três portões por
  // VACUIDADE: `[] == null` é false, o piso de especificidade itera sobre zero
  // nomes, e `[].every(...)` é `true`. Medido em 27/09 saindo com exit 0 e
  // `mata confere: sim`. Lista vazia não é declaração — é a 48ª espécie.
  const semMata = entradas
    .filter((m) => m.mata == null || (Array.isArray(m.mata) && m.mata.length === 0))
    .map((m) => m.id);
  if (semMata.length > 0) {
    console.error(`${MARCA_SEM_MATA} entrada de MUTACOES sem \`mata\` (ausente ou lista vazia): ${semMata.join(", ")}`);
    console.error("Sem `mata` a entrada pula o piso de especificidade E a conferência de quem");
    console.error("morreu — ela mede, mas não prova nada sobre teste nenhum. Declare o teste.");
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OS AUTOTESTES — os controles do que só se confere DE FORA: as RECUSAS
// (código 1) e as SENTENÇAS (código 2). Nenhum controle de categoria alcança
// nenhum dos dois, porque o modo controle dá `return` antes da sentença.
//
// 🔴 A redação anterior desta linha dizia "os controles das RECUSAS (código 1)"
// e já era falsa quando foi escrita: o mesmo commit criou a família de
// VEREDITO, com código 2. Sexta rodada em seis com frase falsa, sempre na parte
// que ninguém re-lê.
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
// 🔴 Os autotestes NÃO são todos da mesma forma, e a redação anterior desta
// frase ("cada autoteste injeta UMA entrada doente em MUTACOES e espera que o
// processo recuse começar") descrevia bem sete de dezesseis. São três formas:
//
//  - **injetam entrada doente** em `MUTACOES` e esperam RECUSA (código 1);
//  - **sabotam uma lista** por `--sabotar=` e esperam RECUSA (código 1) — estes
//    não injetam nada, e é o próprio `main()` que diz isso;
//  - **injetam entrada legítima** e esperam SENTENÇA (código 2): a entrada roda
//    até o fim, e o que se confere é o veredito, não a recusa.
//
// O `--controles` roda os cinco controles de categoria e depois estes, cada um
// num processo filho — é a única forma de conferir um `process.exit` de dentro.
// ═══════════════════════════════════════════════════════════════════════════

/** A edição que todos os autotestes usam: a mesma de M1, que existe e aplica.
 *  O que se mede aqui não é a mutação — é o PORTÃO que roda antes dela. */
const EDICAO_DE_AUTOTESTE = [{
  inicio: 668, fim: 668,
  espera: "  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));",
  novo: "  return [];",
}];

/** A troca semanticamente NULA — a mesma de `CTRL-SOBREVIVE`. Ela entra no
 *  arquivo (há diff), o vitest mede, e a suíte fica VERDE: é um "sobreviveu"
 *  de verdade, que é o que o autoteste do veredito precisa para provar que
 *  sobreviver vira **exit 2** e não exit 0. */
const EDICAO_QUE_SOBREVIVE = [{
  inicio: 1, fim: 1,
  espera: 'import { PISOS } from "@/lib/piso";',
  novo: 'import { PISOS as PISOS } from "@/lib/piso";',
}];

let AUTOTESTES = [
  {
    nome: "mata-frouxo",
    porque: 'uma entrada com `mata: "a"`, que casa os 51 testes e provaria nada',
    entrada: { id: "AUTO-FROUXO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE, mata: "a" },
    esperaCodigo: 1,
    esperaTrecho: MARCA_ESPECIFICIDADE,
  },
  {
    nome: "mata-fantasma",
    porque: "uma entrada cujo `mata` não casa teste nenhum (45ª espécie)",
    entrada: { id: "AUTO-FANTASMA", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE, mata: "ESTE TESTE NUNCA EXISTIU" },
    esperaCodigo: 1,
    esperaTrecho: MARCA_ESPECIFICIDADE,
  },
  {
    nome: "mata-ausente",
    porque: "uma entrada sem o campo `mata`, que pula os DOIS portões do `mata` de uma vez",
    entrada: { id: "AUTO-SEM-MATA", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE },
    esperaCodigo: 1,
    esperaTrecho: MARCA_SEM_MATA,
  },
  {
    nome: "campo-de-controle",
    porque: "uma entrada REAL declarando `mataFantasmaDeProposito`, a flag que pula o portão",
    entrada: {
      id: "AUTO-FLAG", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE,
      mata: "a", mataFantasmaDeProposito: true,
    },
    esperaCodigo: 1,
    esperaTrecho: MARCA_CAMPOS,
  },
  {
    nome: "piso-por-entrada",
    porque: "uma entrada REAL com `piso` e `arquivosDeTeste` próprios, medindo metade em silêncio",
    entrada: {
      id: "AUTO-PISO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE,
      mata: "cada uma das 14 regras dispara na quebra escrita pra ela",
      arquivosDeTeste: ["tests/lib/coerencia.test.ts"], piso: 1,
    },
    esperaCodigo: 1,
    esperaTrecho: MARCA_CAMPOS,
  },
  {
    nome: "mata-lista-vazia",
    porque: "uma entrada com `mata: []`, que atravessava os TRÊS portões do `mata` por VACUIDADE",
    // 🔴 Três portas vazias em série, medidas por um re-revisor em 27/09:
    // `[] == null` é false (passa o portão do `mata` ausente, que acabara de
    // nascer), o piso de especificidade itera sobre ZERO nomes (nenhum frouxo)
    // e `[].every(...)` é `true` por vacuidade — então a tabela saía com
    // `mata confere: SIM` e exit 0, provando nada sobre teste nenhum. É a 48ª
    // espécie do catálogo, e o escape mais plausível por acidente logo depois
    // do que a rodada anterior fechou: quem põe `mata: []` pra preencher depois.
    entrada: { id: "AUTO-MATA-VAZIO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE, mata: [] },
    esperaCodigo: 1,
    esperaTrecho: MARCA_SEM_MATA,
  },
  {
    nome: "campo-de-controle-herdado",
    porque: "uma entrada REAL com `piso` HERDADO do protótipo, que o `hasOwnProperty` não via",
    // 🔴 O portão dos campos de controle usava `hasOwnProperty`, e os
    // consumidores leem pelo protótipo (`m.piso ?? PISO_DE_TESTES`): um
    // `Object.create` com `piso` no protótipo pulava o portão e era MEDIDO de
    // verdade — o re-revisor provou pela saída "o vitest EXECUTOU 18 teste(s)",
    // que só aparece se o override chegou ao motor. É a sabotagem da rodada 4c
    // ressuscitada por DADO, sem tocar em lógica.
    // 🔴 O `mata` daqui É A SUBSTÂNCIA DO AUTOTESTE, e a primeira versão errou:
    // com `mata: "a"` a entrada saía com 1 de qualquer jeito — pelo piso de
    // ESPECIFICIDADE, não pelo portão dos campos —, então o autoteste ficava
    // verde mesmo com o `hasOwnProperty` de volta. Medido. Agora o `mata` é um
    // teste real e único que MORRE nesta mutação: com o portão no lugar, sai 1
    // pelos CAMPOS; com o `hasOwnProperty` de volta, a entrada atravessa tudo e
    // sai **0** medindo com piso 1, que é o escape que o re-revisor mediu.
    entrada: Object.assign(
      Object.create({ piso: 1 }),
      {
        id: "AUTO-PROTO", titulo: "autoteste", arquivo: COERENCIA, edicoes: EDICAO_DE_AUTOTESTE,
        mata: "o chip que não bate com o preço é pego",
      },
    ),
    esperaCodigo: 1,
    esperaTrecho: MARCA_CAMPOS,
  },
  {
    nome: "inventario-mutacoes",
    porque: "uma entrada APAGADA de MUTACOES — a sexta sabotagem, e a lista da carga útil",
    args: ["--sabotar=mutacoes"],
    esperaCodigo: 1,
    esperaTrecho: MARCA_INVENTARIO,
  },
  {
    nome: "inventario-controles",
    porque: "um CONTROLE apagado da lista",
    args: ["--sabotar=controles"],
    esperaCodigo: 1,
    esperaTrecho: MARCA_INVENTARIO,
  },
  {
    nome: "inventario-autotestes",
    porque: "um AUTOTESTE apagado da lista — a quinta sabotagem, agora com controle",
    args: ["--sabotar=autotestes"],
    esperaCodigo: 1,
    esperaTrecho: MARCA_INVENTARIO,
  },
  {
    nome: "veredito-sobreviveu",
    porque: "um buraco REAL (mutação que sobrevive) tem de virar exit 2, não exit 0",
    // 🔴 A terceira família, e ela nasceu do achado mais fino da rodada 4e: os
    // controles de categoria provam que o harness sabe DIZER "sobreviveu";
    // nada provava que dizer isso virava exit 2. Apagando as três linhas do
    // veredito, o stdout ficava IDÊNTICO — inclusive o `🔴 SOBREVIVEU` — e só
    // o código de saída mudava, que é o que um dispatch lê. Este autoteste
    // roda o vitest de verdade (base + mutação), por isso é lento.
    entrada: {
      id: "AUTO-VEREDITO-SOBREVIVE", titulo: "autoteste", arquivo: COERENCIA,
      edicoes: EDICAO_QUE_SOBREVIVE,
      mata: "cada uma das 14 regras dispara na quebra escrita pra ela",
    },
    esperaCodigo: 2,
    esperaTrecho: MARCA_VEREDITO_CATEGORIA,
  },
  {
    nome: "veredito-sem-alvo",
    porque: "uma entrada cujo `espera` não bate nas linhas — AUSÊNCIA de medição tem de virar 2",
    // 🔴 As três parcelas de AUSÊNCIA DE MEDIÇÃO não tinham controle nenhum: a
    // sentença conferia quatro coisas e `veredito-sobreviveu` cobria UMA. É a
    // 48ª espécie do catálogo aplicada à SENTENÇA. E "sem alvo" é o drift mais
    // plausível do mundo real: qualquer edição em `coerencia.ts` mexe nas
    // linhas, e a mutação silenciosamente deixa de ser aplicada.
    entrada: {
      id: "AUTO-VEREDITO-SEM-ALVO", titulo: "autoteste", arquivo: COERENCIA,
      edicoes: [{ inicio: 1, fim: 1, espera: "ESTE TEXTO NÃO ESTÁ NA LINHA 1", novo: "nada" }],
      mata: "o chip que não bate com o preço é pego",
    },
    esperaCodigo: 2,
    esperaTrecho: MARCA_VEREDITO_CATEGORIA,
  },
  {
    nome: "veredito-sem-diff",
    porque: "uma entrada cujo `novo` é igual ao `espera` — troca que não muda nada tem de virar 2",
    entrada: {
      id: "AUTO-VEREDITO-SEM-DIFF", titulo: "autoteste", arquivo: COERENCIA,
      edicoes: [{
        inicio: 1, fim: 1,
        espera: 'import { PISOS } from "@/lib/piso";',
        novo: 'import { PISOS } from "@/lib/piso";',
      }],
      mata: "o chip que não bate com o preço é pego",
    },
    esperaCodigo: 2,
    esperaTrecho: MARCA_VEREDITO_CATEGORIA,
  },
  {
    nome: "veredito-sem-medicao",
    porque: "uma entrada que quebra a sintaxe do módulo — o vitest não mede, e isso tem de virar 2",
    // Este é o ramo que custou mais caro a este projeto: até a rodada 4/5, "o
    // vitest nem rodou" e "a suíte ficou vermelha" imprimiam a mesma palavra, e
    // uma troca de COMENTÁRIO saía carimbada "morreu" com exit 0.
    entrada: {
      id: "AUTO-VEREDITO-SEM-MEDICAO", titulo: "autoteste", arquivo: COERENCIA,
      edicoes: [{
        inicio: 1, fim: 1,
        espera: 'import { PISOS } from "@/lib/piso";',
        novo: 'import { PISOS } from "@/lib/piso"; ((((',
      }],
      mata: "o chip que não bate com o preço é pego",
    },
    esperaCodigo: 2,
    esperaTrecho: MARCA_VEREDITO_CATEGORIA,
  },
  {
    nome: "guarda-de-fora",
    porque: "o guarda que mora em `tests/` apagado — a única camada que pega as sabotagens coordenadas",
    args: ["--sabotar=guarda"],
    esperaCodigo: 1,
    esperaTrecho: MARCA_GUARDA,
  },
  {
    nome: "veredito-mata-mente",
    porque: "uma mutação que morre no teste ERRADO tem de virar exit 2",
    // O outro ramo do veredito: a entrada morre de verdade, mas o `mata` que
    // ela declara é um teste real, único, e NÃO é o que falhou. Sem controle,
    // apagar o `if` do `mataFalhou` fazia a tabela mentir com exit 0.
    //
    // 🔴 E A ESCOLHA DO TESTE É A SUBSTÂNCIA DESTE AUTOTESTE, não detalhe —
    // eu errei na primeira versão e a medição me corrigiu. Declarei "a hora
    // citada na prosa é lida com acento e sem acento", que é real e único, mas
    // que a mutação `return []` TAMBÉM derruba: `mataConfere` saiu `true` e o
    // autoteste saiu com código 0. O `mata` tem de nomear um teste que
    // SOBREVIVE a esta mutação, e os que sobrevivem são os NEGATIVOS — os que
    // afirmam silêncio (`not.toContain`). Com `return []` o silêncio continua
    // verdadeiro, então o teste passa, então o `mata` mente, que é o que este
    // autoteste precisa provar.
    entrada: {
      id: "AUTO-VEREDITO-MATA", titulo: "autoteste", arquivo: COERENCIA,
      edicoes: EDICAO_DE_AUTOTESTE,
      mata: "a ficha sozinha, com a frase dela mesma, não é acusada de emprestar",
    },
    esperaCodigo: 2,
    esperaTrecho: MARCA_VEREDITO_MATA,
  },
];

/** Os campos que só fazem sentido num controle. Uma entrada de `MUTACOES` que
 *  traga qualquer um deles está pedindo para pular um portão — e o docblock
 *  dizia "só em CONTROLES" sem nada garantir. Agora garante. */
const CAMPOS_SO_DE_CONTROLE = [
  "esperaCategoria",
  "esperaMataConfere",
  "esperaPorque",
  "mataFantasmaDeProposito",
  "alvoInexistenteDeProposito",
  "piso",
  "arquivosDeTeste",
];

function recusarCamposDeControle(entradas) {
  const culpadas = [];
  for (const m of entradas) {
    // 🔴 `c in m`, não `hasOwnProperty`: os consumidores leem pelo PROTÓTIPO
    // (`m.piso ?? PISO_DE_TESTES`), então um `Object.create({piso: 1})` pulava
    // o portão e era medido contra 33 dos 51 testes com exit 0 — medido em
    // 27/09. O portão tem de ler do mesmo jeito que o motor lê.
    const achados = CAMPOS_SO_DE_CONTROLE.filter((c) => c in m);
    if (achados.length > 0) culpadas.push(`${m.id}: ${achados.join(", ")}`);
  }
  if (culpadas.length > 0) {
    console.error(`${MARCA_CAMPOS} 🔴 entrada de MUTACOES com campo de controle — isso pula portão:`);
    for (const linha of culpadas) console.error(`  ${linha}`);
    console.error("Estes campos existem só em CONTROLES. Em MUTACOES eles desligam o piso de");
    console.error("especificidade do `mata` ou trocam a suíte medida, e a rodada mente com exit 0.");
    process.exit(1);
  }
}

function rodarAutotestes() {
  const esteArquivo = fileURLToPath(import.meta.url);
  const falhas = [];
  // 🔴 "das RECUSAS" era falso desde que a família de VEREDITO nasceu, e esta
  // frase é IMPRESSA, não comentada: o operador lia "recusou com 2" para um
  // autoteste que não recusou nada — sentenciou. Era a confusão exata que a
  // rodada 4e diz querer impedir, na tela.
  console.log("\nautotestes (cada um num processo filho, porque `process.exit` só se confere de fora):");
  for (const a of AUTOTESTES) {
    let codigo = 0;
    let saida = "";
    try {
      saida = execFileSync(process.execPath, [esteArquivo, `--autoteste=${a.nome}`, ...(a.args ?? [])], {
        cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT_VITEST,
      });
    } catch (erro) {
      codigo = erro?.status ?? -1;
      saida = String(erro?.stdout ?? "") + String(erro?.stderr ?? "");
    }
    const codigoBate = codigo === a.esperaCodigo;
    const trechoBate = saida.includes(a.esperaTrecho);
    if (codigoBate && trechoBate) {
      const verbo = a.esperaCodigo === 1 ? "recusou" : "sentenciou";
      console.log(`  ✅ ${a.nome} — ${verbo} com ${codigo}: ${a.porque}`);
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

  // 🔴 `--sabotar=<lista>` existe SÓ para os autotestes do inventário, e ele
  // não é uma porta: tudo o que sabe fazer é REMOVER a primeira entrada de uma
  // das três listas, o que só pode fazer o inventário ACUSAR (código 1). Não
  // existe forma de usá-lo para silenciar guarda nenhum — um portão que só
  // sabe disparar é seguro de ter; era isso ou o portão do inventário seguir
  // sem controle nenhum, que é o defeito que esta rodada inteira persegue.
  const pedidoSabotar = pedido.find((a) => a.startsWith("--sabotar="));
  if (pedidoSabotar) {
    const qual = pedidoSabotar.slice("--sabotar=".length);
    if (qual === "mutacoes") MUTACOES = MUTACOES.slice(1);
    else if (qual === "controles") CONTROLES = CONTROLES.slice(1);
    else if (qual === "autotestes") AUTOTESTES = AUTOTESTES.slice(1);
    // `guarda` aponta a exigência para um arquivo que não existe: é a única
    // forma de conferir de fora o portão do guarda de fora sem apagar o arquivo
    // de verdade. Também aqui o sabotar só sabe fazer um portão ACUSAR.
    else if (qual === "guarda") ARQUIVOS_EXIGIDOS = ["tests/lib/ESTE-GUARDA-FOI-APAGADO.test.ts"];
    else {
      console.error(`--sabotar desconhecido: ${qual} (use mutacoes, controles, autotestes ou guarda)`);
      process.exit(1);
    }
  }

  // 🔴 O INVENTÁRIO, ANTES DE QUALQUER OUTRA COISA — inclusive antes da
  // injeção do `--autoteste`, que acrescenta uma entrada a `MUTACOES` de
  // propósito. As três listas do arquivo são conferidas contra as listas
  // cravadas à mão: é o que a quinta sabotagem derrubou nos guardas (quatro
  // clones do mesmo autoteste passavam, e o banner ainda dizia "4"), e o que a
  // SEXTA derrubou na CARGA ÚTIL — `MUTACOES` era a única lista sem
  // inventário, e cortar 31 das 34 entradas saía com exit 0 e
  // `placar: 3 morreu (de 3)`, com os cinco controles e os autotestes verdes.
  conferirInventario("MUTACOES", MUTACOES.map((m) => ({ nome: m.id, afirma: substanciaDeMutacao(m) })), MUTACOES_ESPERADAS);
  conferirInventario("CONTROLES", CONTROLES.map((c) => ({ nome: c.id, afirma: substanciaDeControle(c) })), CONTROLES_ESPERADOS);
  conferirInventario("AUTOTESTES", AUTOTESTES.map((a) => ({ nome: a.nome, afirma: substanciaDeAutoteste(a) })), AUTOTESTES_ESPERADOS);

  // 🔴 O guarda de FORA tem de existir. Sem este portão, apagar
  // `tests/lib/harness-de-mutacao.test.ts` era silencioso nas duas pontas.
  const guardasSumidos = ARQUIVOS_EXIGIDOS.filter((f) => !existsSync(path.join(RAIZ, f)));
  if (guardasSumidos.length > 0) {
    console.error(`${MARCA_GUARDA} 🔴 o guarda de fora não existe mais: ${guardasSumidos.join(", ")}`);
    console.error("Ele é a única camada que pega as sabotagens COORDENADAS (as duas listas cortadas");
    console.error("juntas), porque mora fora deste arquivo e roda em `npm test`. Sem ele, o");
    console.error("inventário daqui é cego, e este harness não tem o direito de dizer que mediu.");
    process.exit(1);
  }

  // `--inventario` imprime as TRÊS listas REAIS (não as cravadas) em JSON e
  // sai. É a porta pela qual `tests/lib/harness-de-mutacao.test.ts` confere o
  // instrumento — e esse teste é a última camada de propósito: ele mora em
  // `tests/`, logo roda em `npm test`, logo roda em TODO dispatch. Um guarda
  // que vive dentro do arquivo que a sabotagem edita nunca fecha a recursão.
  // Vai junto tudo de que o guarda de fora precisa, não só as três listas: ele
  // é o único lugar em que o piso, as categorias e a própria exigência estão
  // cravados FORA deste arquivo. (Não conte as chaves em prosa: a redação que
  // dizia "cinco" nasceu falsa no mesmo commit que acrescentou duas.)
  if (pedido.includes("--inventario")) {
    console.log(JSON.stringify({
      mutacoes: MUTACOES.map((m) => ({ id: m.id, afirma: substanciaDeMutacao(m) })),
      controles: CONTROLES.map((c) => ({ id: c.id, afirma: substanciaDeControle(c) })),
      autotestes: AUTOTESTES.map((a) => ({ id: a.nome, afirma: substanciaDeAutoteste(a) })),
      piso: PISO_DE_TESTES,
      arquivosDeTeste: ARQUIVOS_DE_TESTE,
      // 🔴 `categorias` sai aqui para o guarda de fora poder cravá-la: a
      // sentença do veredito é derivada dela, então tirar uma categoria da
      // lista tira a parcela da sentença. E `arquivosExigidos` sai para o
      // guarda de fora conferir que ELE MESMO é exigido — é assim que as duas
      // camadas se guardam em vez de uma depender da outra.
      categorias: CATEGORIAS,
      arquivosExigidos: ARQUIVOS_EXIGIDOS,
    }, null, 2));
    return;
  }

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
    // Os autotestes do INVENTÁRIO não injetam entrada: eles sabotam uma lista
    // por `--sabotar=` e o processo já morreu no inventário, lá em cima.
    if (auto.entrada) {
      MUTACOES = [...MUTACOES, auto.entrada];
      idAuto = auto.entrada.id;
    }
  }

  const ids = idAuto ? [idAuto] : pedido.filter((a) => a !== "--controles");
  const universo = modoControle ? CONTROLES : MUTACOES;
  const alvo = ids.length > 0 ? universo.filter((m) => ids.includes(m.id)) : universo;

  // 🔴 Nenhuma entrada de MUTACOES pode trazer campo de controle. O docblock
  // dizia "só em CONTROLES" e nada garantia: uma entrada real que declarasse
  // `mataFantasmaDeProposito` pulava o piso de especificidade do `mata`, e uma
  // com `piso`/`arquivosDeTeste` media metade da suíte — as duas com exit 0 e
  // sem tocar no motor. Medido por um re-revisor em 27/09.
  if (!modoControle) {
    recusarCamposDeControle(alvo);
    recusarEntradasSemMata(alvo);
  }

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
  // `"violacoesDoAcervo"` casa 33 deles (o 31 desta linha era resíduo da era
  // de 49 testes, e ela dizia "medido" no presente — medido de novo em 27/09
  // contra os 51 nomes reais: 51 para `"a"` e 33 para `"violacoesDoAcervo"`).
  // Cada nome declarado tem de casar
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
    console.error(`${MARCA_ESPECIFICIDADE} 🔴 \`mata\` sem piso de especificidade — a tabela não prova o que diz provar:`);
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
      } else if (typeof mutacao.esperaPorque === "string" && !String(r.teste).includes(mutacao.esperaPorque)) {
        // 🔴 O RAMO, não só a categoria: duas causas diferentes caem na mesma
        // categoria ("sem medição") e o controle ficava satisfeito com
        // qualquer uma das duas.
        controleFalhou.push(
          `${r.id}: esperava a mensagem do ramo "${mutacao.esperaPorque}", e saiu "${r.teste}"`,
        );
      } else if (!("esperaPorque" in mutacao)) {
        controleFalhou.push(`${r.id}: não declara \`esperaPorque\` — todo controle declara o RAMO, mesmo que null`);
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
  // 🔴 O DENOMINADOR VEM DA LISTA CRAVADA À MÃO, nunca do `length` do array
  // que acabou de rodar — foi exatamente assim que a SEXTA sabotagem passou:
  // cortando 31 das 34 entradas, o placar dizia `3 morreu … (de 3)` com exit 0.
  // A regra já estava escrita para o banner do `--controles` e o placar da
  // rodada normal tinha ficado de fora.
  const cravadas = Object.keys(modoControle ? CONTROLES_ESPERADOS : MUTACOES_ESPERADAS).length;
  const denominador = ids.length > 0 ? `${alvo.length} pedida(s), de ${cravadas} cravada(s) à mão` : `${cravadas} cravada(s) à mão`;
  console.log(`\nplacar: ${CATEGORIAS.map((c) => `${placar[c]} ${c}`).join(", ")} (de ${denominador})`);
  if (ids.length === 0 && alvo.length !== cravadas) {
    console.error(`\n${MARCA_INVENTARIO} rodaram ${alvo.length} entradas e a lista cravada tem ${cravadas} — o inventário deveria ter pegado isto antes.`);
    process.exit(1);
  }

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
    // Os números vêm das listas CRAVADAS À MÃO, nunca do `length` dos arrays
    // que acabaram de rodar: foi exatamente assim que a quinta sabotagem
    // imprimiu "4 autotestes" rodando quatro clones do mesmo.
    const nAuto = Object.keys(AUTOTESTES_ESPERADOS).length;
    const nVeredito = Object.values(AUTOTESTES_ESPERADOS).filter((v) => v.startsWith("2|")).length;
    console.log(`\n✅ os ${Object.keys(CONTROLES_ESPERADOS).length} controles de CATEGORIA e os ${nAuto} autotestes`);
    console.log(`   (${nAuto - nVeredito} de RECUSA, código 1, e ${nVeredito} de VEREDITO, código 2) saíram como`);
    console.log("   declararam, e o inventário das TRÊS listas — mutações, controles e");
    console.log("   autotestes — bate com a lista cravada à mão, entrada por entrada, com a");
    console.log("   SUBSTÂNCIA de cada uma. O instrumento sabe DIZER sobreviveu, sem alvo e");
    console.log("   sem medição nos dois ramos, e sabe acusar um `mata` que não mata. Sabe");
    console.log("   RECUSAR começar com `mata` frouxo, fantasma, AUSENTE ou lista VAZIA; com");
    console.log("   campo de controle numa entrada real (próprio ou herdado do protótipo);");
    console.log("   com qualquer das três listas encolhida; e sem o guarda que mora em");
    console.log("   `tests/`. E sabe SENTENCIAR com 2 as QUATRO categorias de falha, uma a");
    console.log("   uma, e o `mata` que mente. Não é um carimbador de morreu.");
    return;
  }

  // 🔴 AS DUAS SENTENÇAS DA RODADA NORMAL, e elas passaram quatro rodadas sem
  // controle nenhum: o `--controles` exercita o CLASSIFICADOR (o harness sabe
  // DIZER "sobreviveu"), nunca a SENTENÇA (dizer isso sair com 2). Um
  // re-revisor apagou as três linhas e um buraco real saiu com exit 0
  // imprimindo `🔴 SOBREVIVEU` — stdout idêntico, só o código de saída
  // diferente, que é justamente o que um dispatch lê. Agora cada sentença tem
  // MARCA, e cada marca tem autoteste na terceira família (`esperaCodigo: 2`).
  if (mataFalhou.length > 0) {
    console.error(`\n${MARCA_VEREDITO_MATA} 🔴 "mata" DECLARADO QUE NÃO MORREU — a tabela mente sobre quem trava o quê:`);
    for (const linha of mataFalhou) console.error(`  ${linha}`);
    process.exit(2);
  }
  // 🔴 A soma sai de `CATEGORIAS`, não de quatro parcelas escritas à mão: com
  // as parcelas à mão, apagar UMA (`placar["sem alvo"]`) fazia uma entrada que
  // a suíte NUNCA MEDIU sair com exit 0 e stdout IDÊNTICO — medido por um
  // re-revisor em 27/09, com os 5 controles, os 12 autotestes e o `npm test`
  // verdes. Categoria nova passa a entrar na sentença sozinha.
  const deFalha = CATEGORIAS.filter((c) => c !== "morreu").reduce((n, c) => n + placar[c], 0);
  // 🔴 O cinto é uma LEI DE CONSERVAÇÃO: toda entrada que rodou tem de estar
  // contada em alguma categoria. Ele pega as três formas de quebrar o placar
  // que eu soube inventar — categoria fora da lista, categoria tirada de
  // `CATEGORIAS`, e `r.categoria` undefined —, e nas três a soma sai **0**,
  // nunca `NaN`.
  //
  // A redação anterior dizia que a soma "vira NaN, e `NaN > 0` é false", e um
  // re-revisor mediu que não: `placar` nasce de `Object.fromEntries(CATEGORIAS…)`,
  // então `placar[c]` para `c ∈ CATEGORIAS` é sempre número, e o
  // `!Number.isInteger(somaTotal)` era INALCANÇÁVEL — metade do cinto era código
  // morto sustentando uma frase falsa. O mecanismo de verdade é a igualdade.
  const somaTotal = CATEGORIAS.reduce((n, c) => n + placar[c], 0);
  if (somaTotal !== alvo.length) {
    console.error(`\n${MARCA_VEREDITO_CATEGORIA} 🔴 o placar não fecha: ${somaTotal} contadas para ${alvo.length} rodadas.`);
    console.error("  Alguma categoria saiu de CATEGORIAS ou `rodarUma` devolveu categoria fora da lista.");
    process.exit(2);
  }
  if (deFalha > 0) {
    console.error(`\n${MARCA_VEREDITO_CATEGORIA} 🔴 ${deFalha} entrada(s) fora de "morreu" — três das quatro categorias são AUSÊNCIA DE MEDIÇÃO, e "sobreviveu" é buraco real.`);
    process.exit(2);
  }
}

main();
