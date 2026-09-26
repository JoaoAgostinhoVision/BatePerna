# As rulings da execução da ficha-no-banco — 2026-09-25

> **Por que este arquivo existe, e é versionado de propósito.** O ledger da execução mora em
> `.superpowers/sdd/2026-09-24-ficha-no-banco-e-editor/progress.md`, que o `.gitignore:57` ignora — é
> rascunho, e `git clean -fdx` o apaga. As decisões abaixo foram tomadas **no lugar do João**, sem ele na
> mesa, porque o laço de execução não para para perguntar. Decisão tomada no lugar dele que morre com um
> diretório temporário foi decisão tomada em segredo. Então elas ficam aqui, com o **custo se estiverem
> erradas**, para ele poder desfazer o que discordar.
>
> Plano: `docs/superpowers/plans/2026-09-24-ficha-no-banco-e-editor.md`.
> Spec: `docs/superpowers/specs/2026-09-24-ficha-no-banco-e-editor-design.md`.
> Estado e ponto de retomada: `docs/RESUME.md`.

---

## PARTE 1 — AS RULINGS QUE CONTINUAM VIVAS (viajam nos próximos dispatches)

**P13 + P8 — `npm run build` no dispatch de toda tarefa que toque `src/app/`, e `git add` por caminho.**
Esta é a mais importante e a mais caras de todas, porque nasceu de um erro meu. Os meus dispatches
exigiam `npm test` duas vezes e `npx tsc --noEmit`, e **não exigiam o build**. A Task 4 pôs
`await getAllFichas()` no `src/app/not-found.tsx` — a única página que lia banco **sem**
`export const dynamic = "force-dynamic"` — e o Next prerenderiza `/_not-found` no build, onde não há
banco. A branch ficou **sem compilar** com a suíte verde e o `tsc` limpo, e **dois assentos de revisão
passaram por cima**: o revisor da tarefa não rodou build porque **eu** disse a ele para não rodar suíte.
Quem achou foi o implementador da tarefa seguinte, porque o brief dela exigia build. Toda página que lê
banco declara `force-dynamic`, e o dispatch exige a linha da rota colada da tabela de rotas.
*Custo se errado:* nenhum — é uma verificação a mais. O custo de esquecer já foi medido.

**Audite a tabela de mutação do brief ANTES de despachar**, perguntando de cada linha "qual teste muda de
resultado?" **e se o teste nomeado existe**. Isto achou seis defeitos no meu próprio plano num dia: um
relógio injetado que nenhum teste lia (T2); um `try/catch` que sobrevivia aos 7 testes (T3); uma lista de
6 arquivos de teste que eram 18 (T4); uma tabela de 11 pontos de `await` que eram 13 (T4); um teste que
provava a marca "em algum lugar da tela" (T5); e uma mutação apontando para um teste inexistente (T5).
Cinco das seis são a mesma espécie: **lista escrita à mão é cega ao que cresceu** — aplicada ao plano, não
ao código.
*Custo se errado:* uma auditoria de dez minutos por tarefa.

**A trava de deploy da semente, que derruba o app inteiro se esquecida.**
`npm run semear` (chama `dotenv -e .env.local -- tsx scripts/semear-fichas.ts`) **antes** do primeiro
deploy desta branch. Sem a semente o banco não tem ficha nenhuma e **todo o app cai no `error.tsx`**,
porque a escolha do João foi "erro honesto, nunca conteúdo velho". Conferido: `tsx` e `dotenv-cli` estão
instalados. É diferente do build, que não toca o banco (todas as rotas que leem banco são `ƒ (Dynamic)`).
🔴 **Atualizado pela revisão final (C1, 2026-09-26):** isto vale também com `ficha_versoes` criada mas
VAZIA (`scripts/apply-schema.ts` sozinho, sem semear depois) — o app agora estoura nesse caso também;
`semear-fichas.ts` já chama `ensureSchema`, então **não rode `apply-schema.ts` à parte nesta branch**.
*Custo se errado:* o app publicado mostra a tela de erro em todas as telas.

**T4-6 — três números imprecisos ficam deferidos para a onda de fix da revisão final.** No docblock de
`tests/lib/sem-disco-em-producao.test.ts`: um "10251 de 14800" atribuído à expressão errada e contado em
bytes; a lista do "lado rígido" omitindo "divisão lida como regex"; e `\//` listado como resíduo quando é
conserto. Nenhum afirma nada falso sobre o comportamento do guarda.
*Custo se errado:* três números imprecisos sobrevivem num comentário.

> ✅ **RESOLVIDO na onda de fix da revisão final (2026-09-26) — e a correção que esta ruling propunha
> estava ERRADA.** Onde antes se lia aqui *"o verdadeiro é 10079 de 14570, medido por mim"*: isso é falso
> para a expressão que o docblock cita. Duas medições independentes, que bateram entre si: a tira de
> comentário de **bloco sozinha** come **8880 de 14570 (60,9%)**; os **10079 (69,2%)** só aparecem quando
> a tira de comentário de **linha** roda **depois** dela. E a causa narrada no docblock — um `/*` escondido
> dentro de um literal, cegando a tira — **não reproduz hoje**: não há nenhuma ocorrência de `"/*`, `'/*`
> ou `` `/* `` no arquivo. O volume alto vem só do tanto de JSDoc de bloco que o `cache-rotas.ts` tem.
> **A lição, e é a razão de este parágrafo existir:** trocar um número por outro teria mantido a frase
> falsa, só que com outro número. O que conserta uma frase medida é medir de novo, não reescrever.

**T4-5 — onde o guarda para de crescer.** Decidido *antes* de ver o resultado da última re-revisão, para
ser decisão e não reação: o resíduo declarado do varredor (texto de JSX com `//`, `${}` aninhado, regex
não licenciado) **não abre novo fix round**. Ele está medido como inexistente nos 75 arquivos de `src/` e
escrito no próprio guarda — e o passo seguinte seria escrever um parser de TypeScript dentro de um arquivo
de teste, trocando um risco pequeno e documentado por um grande e novo. **O que NÃO se parqueia:** qualquer
forma que deixe o guarda **verde** com leitura de disco e que **exista hoje** em `src/`.
*Custo se errado:* fica um furo teórico num guarda que já pegou três reais.

---

## PARTE 2 — O QUE A REVISÃO DA TASK 5 TEM QUE OLHAR

🟢 **HISTÓRICA — RESOLVIDA EM 2026-09-26, mantida só como registro.** No dia em que esta seção foi
escrita (2026-09-25), a Task 5 estava commitada e sem revisão; a instrução era não redespachá-la e
despachar a revisão. **Isso já aconteceu**: a revisão rodou, voltou com achados, saiu **1 fix round**, e a
re-revisão fechou **limpa** (ver `docs/RESUME.md`, tabela das sete tarefas — Task 5 "✅ completa (26/09), 1
fix round"). Quem ler esta seção agora, depois do merge, **não tem tarefa nenhuma pra fazer aqui** — o
"não redespachar" e o "despachar a revisão" abaixo são instrução MORTA, preservada só pelo valor histórico
dos riscos nomeados (item 3, "as cinco mutações não têm prova nenhuma", é o que virou I1/M1 da revisão
final da branch inteira).

A Task 5 estava **commitada em `4ad7764` e não revisada**, sem relatório: a sessão foi encerrada a pedido do
João e o implementador já havia commitado sem escrever o relatório. **Não redespachar a tarefa** — gerar
`review-package ... 4c766d1 4ad7764` e despachar a revisão, avisando que **não existe relatório** e que a
ausência de medição de mutação é, por si, achado a reportar. Riscos nomeados:

1. **`src/app/admin/marca-agora.ts` é arquivo novo que o brief não previu** — extração da pipeline da
   marca. Ele **reusa** `faseDe`/`marcaDe`/`vozDaFicha` ou **duplica** a lógica? Duplicar é a espécie que
   este app pagou quatro vezes.
2. **`PainelAdmin.tsx` teve 247 linhas mexidas** num arquivo que o brief mandava **mover, não reescrever**
   (ele passa a servir um lugar em vez de três). Comportamento se moveu?
3. **As cinco mutações (M1–M5) não têm prova nenhuma.** A M5 é a que eu criei: **trocar as marcas entre
   dois lugares**, que tem que morrer no teste escopado.
4. **Já conferido por mim, não refazer:** build verde com `/admin` e `/admin/[slug]` como **ƒ (Dynamic)**;
   1152/1152 em 75 arquivos com exit 0 em duas execuções; `tsc` limpo; e a asserção escopada da ruling P10
   chegou (`tests/app/admin-lista.test.tsx:72,79`, `link.closest("li")` + `within`).

**Duas palavras de tela esperando o João ler**, as duas marcadas `// PENDENTE` e extraídas por mim do
código porque o relatório não foi escrito. Copy é escolha dele:
- `src/app/admin/ListaDeLugares.tsx:7` — *"Toque num lugar pra ver e mudar o que o app diz dele."*
- `src/app/admin/PainelAdmin.tsx:28` — *"Não consegui ler o aviso publicado — a seção abaixo pode estar
  incompleta."*

---

## PARTE 3 — AS RULINGS JÁ CONSUMIDAS (história, para não se repetir a discussão)

**Pré-flight, antes da Task 2:**
- **P1** — `ordenarPorNome` muda de `ficha.ts` para `ficha-fonte.ts` **e a reexportação entra no mesmo
  commit**, senão a suíte fica vermelha entre a Task 3 e a 4 e a Task 3 seria revisada com a suíte
  quebrada. O motivo de fundo é um ciclo **de valor** (não de tipo), que quebra em runtime.
- **P2** e **P2-bis** — o guarda "ninguém lê o disco" mira **código que lê**, não palavra que aparece:
  quatro arquivos citam `content/fichas` em comentário, e três desses comentários são bons. A P2 estava
  certa no diagnóstico e **incompleta no remédio** — o implementador acrescentou a metade que importa:
  `loadAll()` chamado de uma rota lê o disco **sem citar caminho nenhum**.
- **P3** — a Task 2 ganhou uma asserção de `criado_em` e a mutação M3: sem elas, um relógio injetado que o
  corpo ignora sobreviveria aos três testes do brief. Confirmado por evidência pelo revisor.
- **P4** — a prosa das Global Constraints diz "(Task 3)" para a semente, que é a Task 2. Erro de prosa.
- **P5** — a semente gravar sem chamar `fichaSchema` **não** viola a porta de escrita: o `loadAll`
  (`src/lib/ficha.ts:37`) valida rio acima.
- **P6** — BASE da revisão da Task 2 = `c299998`, não `b4667c5`, para o diff não carregar um commit de doc.
- **P7** — a Task 3 ganhou um 8º teste e a mutação M6: o `comPrazo` é um `Promise.race`, então quem serve a
  cópia em memória quando o banco **recusa** é só o `try/catch`, e nenhum dos 7 testes cobria isso.

**Task 2:**
- **T2-1** — o Important `plan-mandated` do slug repetido no mesmo lote foi **consertado, não parqueado**:
  o docstring afirmava idempotência que o corpo não garantia; "o `loadAll` estoura" é guarda de outro
  módulo cobrindo o call site deste; e a Task 4 passou a consumir a primitiva de vários lugares.
- **T2-2** — o Minor do lote vazio fica deferido: seria verdadeiro por vacuidade.

**Task 4:**
- **P9** — a lista de arquivos de teste do plano era 6 e eram **18**, com dois chamando o getter no **topo
  do módulo**, onde semear no `beforeEach` não serve. O implementador derivou a lista por grep.
- **T4-1** — `next.config.mjs` e `tests/deploy/tracing.test.ts` afirmavam leitura por `fs` em request, e o
  teste estava **verde por vacuidade** (o laço pula toda rota que não lê por `fs`, e nenhuma lê mais). Os
  includes mortos e o teste saíram **juntos**: teste vazio guardando config morta é pior que config morta
  sozinha. Virou a Task 4-bis. A proteção que fica é o guarda, estritamente mais forte.
- **T4-2** — o 404 passar a depender do banco foi parqueado como decisão do João, e depois **morreu sem
  custar nada a ele**: quando o build quebrou (T4-7), virou invariante de engenharia, e a saída mínima
  (`force-dynamic`) resolveu **sem mudar a tela**. ⚠️ Nesta ruling eu **errei e me corrigi**: escrevi que a
  pessoa perderia a barra de saída e que o beco fechado em 11/09 reabriria. Fui ler o `src/app/error.tsx:38`
  e ele renderiza a `BarraNavegacao` e um "Tentar de novo" — o beco **não** reabre; ela perde a lista, não
  a saída. A saída **proibida** era a terceira: renderizar a lista vazia, porque "Todas as trilhas" sem nada
  embaixo afirma que não existe trilha nenhuma.
- **T4-3** — os 5 Important entraram no laço e eu **puxei cinco Minor** com eles, por um critério só: eram
  a mesma espécie — afirmação que o commit tornou falsa, ou o guarda podendo ficar oco. Um deles, o M8, era
  um defeito silencioso escondido num Minor: a tira de comentários comia **69% do `cache-rotas.ts`** e o
  guarda ficava verde com leitura de disco em código.
- **T4-4** — os dois Important novos do próprio diff de correção (um comentário afirmando dependência mais
  forte do que existe; a justificativa falsa do varredor + o furo do regex literal) entraram no round 2.
  Não aceitei "hoje não acontece" como remédio: a tira antiga também "não acontecia" até alguém medir.
- **T4-7** — conserto do build **antes** de qualquer outra coisa, medindo as saídas em ordem.

---

## O que eu errei nesta execução, para o próximo não repetir

1. **Não pedi `npm run build`** na tarefa que mudou 11 arquivos de produção — e disse ao revisor para não
   rodar suíte. Resultado: branch sem compilar, com dois assentos de revisão limpos.
2. **O meu plano tinha listas escritas à mão** em três lugares (arquivos de teste, pontos de `await`,
   nomes de teste na tabela de mutação), e as três estavam incompletas ou erradas.
3. **Afirmei que o 404 perdia a saída** sem ter lido o `error.tsx` até o fim.
4. **Apaguei quatro linhas do índice de memória** com um intervalo de substituição que englobou entradas
   vizinhas — restaurado no mesmo minuto, mas o erro foi de método: substituir por índice de texto sem
   conferir o que cai no meio.
