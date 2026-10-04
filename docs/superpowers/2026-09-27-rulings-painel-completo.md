# As rulings da rodada do painel completo — e o custo de cada uma se estiver errada

> **Este arquivo existe porque o ledger da execução é git-ignored** (`.gitignore:57`, `.superpowers/`)
> e morre num `git clean -fdx`. Aqui ficam as decisões que eu tomei no lugar do João, versionadas.
>
> Plano: `docs/superpowers/plans/2026-09-26-painel-completo.md`
> Desenho: `docs/superpowers/specs/2026-09-26-painel-completo-design.md`
> Branch: `painel-completo`, a partir de `3eb8a0f`. **Nada foi ao ar.**

---

## As sete rulings do pré-voo — feitas ANTES de despachar a primeira tarefa

A varredura pré-voo do plano (pares de tarefas que compartilham arquivo ou interface, mais cada
tarefa contra si mesma) achou **sete defeitos no meu próprio plano**. É o mesmo método que em 25/09
achou seis, e cinco deles eram a mesma espécie: lista escrita à mão cega ao que cresceu.

**P1 — o registro de campos guarda um MOLDE de waypoint, e uma função o expande por ficha.**
`CAMPOS_DA_FICHA` não pode listar `trajeto.waypoints.7.nome` estaticamente: o número de waypoints é
**dado**, não código. A entrada usa `[]` literal e nasce `camposDaFicha(ficha)` com os caminhos
expandidos. As tarefas de tela iteram essa função, nunca o registro cru.
*Custo se errada:* a tela do lugar mostra um bloco fantasma que não edita nada. Visível na primeira
olhada no celular, barato de desfazer.

**P2 — o módulo de coerência carrega 13 regras, não 15.**
🔴 **O número estava certo por acaso e a minha conta estava errada** — o implementador divergiu, o
revisor conferiu caso a caso, e os dois estavam certos. `15 − 2` não dá 13: três dos 15 casos não
podem virar regra de produção (dois são não-vacuidade **do teste**, o terceiro lê o disco comparando
dois arquivos de código). Sobram 10 de conteúdo, e três deles juntavam num `it(` só defeitos com
consertos diferentes na mão do dono. 10 → 13.
*Custo se errada:* alguém conta 13 e acha que duas regras se perderam na extração. Por isso a conta
caso a caso está escrita no docblock do módulo.

**P3 — a coerência enxerga o acervo INTEIRO, inclusive os lugares escondidos.**
Quatro das regras comparam uma ficha com as outras, e um lugar escondido **volta** — esconder não é
apagar. Se a coerência ignorasse os ocultos, o dono poderia escrever no lugar A a frase do lugar B
escondido, e o defeito só apareceria no dia em que reexibisse B.
*Custo se errada:* a porta recusa uma gravação legítima citando um lugar que ninguém vê. Confuso,
não é dano.

**P4 — a tarefa da tela do lugar desmonta o editor de voz antigo** em vez de deixar a voz aparecer
duas vezes na tela entre uma tarefa e outra.
*Custo se errada:* zero para ele — nada sobe pela metade, então a voz ficar temporariamente
não-editável **dentro da branch** não chega a ninguém.

**P5 — duas tarefas incluem `src/app/admin/page.tsx`**, que o plano esqueceu de listar quando
`ListaDeLugares` ganha props novas.
*Custo se errada:* nenhum, o `tsc` pegaria na hora.

**P6 — o guarda registro×schema varre até as FOLHAS, não só o 1º nível.**
🔴 **O defeito mais sério do pré-voo, e era meu.** Um guarda de primeiro nível não veria
`condicao.regra` ganhar um parâmetro novo nem `custo` ganhar uma chave — o campo nasceria invisível
no painel **com o teste verde**. É a espécie que mais custou a este projeto. A varredura caminha o
`fichaSchema` recursivamente e `FORA_DE_PROPOSITO` passa a ser de caminhos, cada um com o motivo ao
lado. *Medido na revisão:* 33 folhas contadas à mão contra o schema, encaixando sem folga com as 28
entradas-folha do registro.
*Custo se errada:* o guarda fica mais caro e pode acusar falso num campo de união. A saída é
acrescentar o caminho com o motivo escrito — **nunca afrouxar a varredura**.

**P7 — o formulário de criar pergunta por CAMPO DO REGISTRO; o questionário de 24 perguntas manda
na REDAÇÃO e na ORDEM, não na contagem.**
As 24 perguntas cobrem campos agrupados (uma resolve `custo.tag` + `valor` + `curto` juntos); o
registro tem uma entrada por folha. Os dois números nunca vão bater, e o teste do plano que
comparava com `CAMPOS_DA_FICHA.length` era falso.
*Custo se errada:* o formulário fica mais longo ou mais curto do que a conversa que já funcionou
duas vezes. É risco de tela, e é o que `olho-de-tela` e os olhos dele pegam no fim.

---

## As rulings que nasceram durante a execução

**H1 — o registro ganha entradas de BLOCO OPCIONAL INTEIRO, e `horario` é a primeira.**
Com a Tarefa 1 como entregue, **não existia caminho nenhum para dizer "este lugar não fecha por
horário"**: as duas horas são obrigatórias *quando o bloco existe*, então o "não sei" do horário é
tirar o **bloco**, e bloco não era entrada do registro. A régua do app é *"ficha sem horário NUNCA
fecha"*, e régua inalcançável não é régua. Espécie `"bloco"`.
*Custo se errada:* uma entrada a mais no registro. O inverso — deixar como estava — seria ele não
conseguir dizer que um lugar não tem horário.

**C1 da Tarefa 1 — EMENDO A MINHA PRÓPRIA H1: a espécie `bloco` aceita DUAS operações.**
🔴 **A H1 como eu a escrevi criou uma porta de mão única.** Removido o `horario`, nenhuma sequência
da API o devolvia (`abre` sozinho estoura por falta de `fecha` e vice-versa), e a frase de tela
mandava "preencher um a um", que era impossível. Ele tocaria "não sei", mudaria de ideia, e o
horário só voltaria com um desenvolvedor mexendo no banco — **exatamente o que a lei dele proíbe**, e
a inversão do argumento que motivou a H1.
Emenda: `aplicarCampo` no bloco é permitido **quando o bloco está ausente** e recusado quando ele
existe; e a gravação **valida folha a folha antes de montar**, cada folha contra a entrada dela no
registro, para que `{abre: "8h"}` seja recusado pela regra de `hora` nomeando `horario.abre` e não
por um erro cru de schema.
*Custo se errada:* uma operação a mais na espécie. O inverso é um campo que o dono desliga e não
consegue religar sozinho.

**EMENDA DA TAREFA 11c (2026-10-04) — o `horario` deixa de ser BLOCO e vira UMA entrada, a LISTA de
faixas.** Decisão dele: *"tem lugares que fecham para o almoço, aí fica de 8 às 10 e 14 às 17"*. O
horário passou a ser uma lista de 1 a 3 faixas `{abre, fecha}`, e com intervalo as horas de cada faixa
dependem umas das outras — editá-las folha a folha (o que a H1 e o C1 acima montaram) deixa de fazer
sentido. O registro tem agora UMA entrada `horario`, espécie `faixas`, cuja gravação **substitui a
lista inteira**, com as regras (ordem, sobreposição, 24h e meia-noite só sozinhas) em
`problemaDasFaixas` (`src/lib/horario.ts`), chamada pelas portas de ESCRITA — nunca no schema, que é o
caminho de leitura. O que a H1 protegia continua: a entrada carrega o "não sei", e é o ÚNICO caminho
até "sem horário" (`[]` é recusado). O schema LÊ as duas formas — o objeto de antes e a lista — para
sempre: as fichas no banco estão na forma velha, e o "voltar" a grava de novo verbatim. As espécies
`bloco` e `hora` ficaram sem entrada; a contração da tela delas é a Tarefa 11d. Os achados que
moldaram isto estão em `task-11bcd-auditoria.md` (11c-C1, I1–I7), fora do git.

**C1 da Tarefa 2 — `undefined` é SILÊNCIO, e uma regra de coerência nunca afirma o que o dono
declarou.**
`prosa-bate-com-piso` acusava ficha **sem** `piso` (que é opcional de propósito): ausente, o campo
virava `""` e todo piso citado na prosa virava "estranho". **Duas das três fichas reais seriam
recusadas com o piso em branco**, e a frase dizia que ele *"declara o piso (nenhum)"* — ele não
declarou nada.
🔴 **É a linha vermelha do projeto invertida:** em vez de o app afirmar demais sobre o **lugar**, o
app afirma demais sobre **o que o dono disse**. O comportamento era herdado do teste antigo, mas é
esta rodada que o transforma de teste vermelho no laptop em **trava no celular**.
*Custo se errada:* uma regra que cala quando devia falar. Por isso o conserto foi medido nos **dois**
lados: silêncio no ausente **e** acusação no divergente.

**I4 da Tarefa 2 — a duplicação do regex de preço morre; a página importa `PRECO` do módulo.**
O comentário que a justificava afirmava que *"a página não pode importar o módulo que a audita"* — e
isso é falso: a página é server component e já importa `@/lib/piso`, `@/lib/semana`, `@/lib/horario`,
e o módulo não audita a página. O argumento original (*"o teste não deve importar a implementação que
audita"*) era verdadeiro e **não sobrevive ao arranjo novo**, porque agora as duas cópias são de
produção. Com uma cópia só, a classe de defeito do chip anunciando preço diferente do valor fica
**impossível por construção** em vez de vigiada.
*Custo se errada:* um guarda foi apagado. Medido na re-revisão: uma segunda cópia escrita de
propósito num arquivo de `src/` deixa o guarda novo **vermelho na hora**, e a página reinlinando o
regex acusa nos dois guardas.

---

## Três espécies novas de prova fraca, catalogadas nesta rodada

**A 47ª — `toThrow()` sobre função com DUAS PORTAS EM SÉRIE.** A mutação que arranca a porta de cima
sobrevive porque a de baixo estoura igual, e o teste nunca soube **quem** recusou. Remédio: afirmar o
**tipo** do erro e que a **mensagem nomeia o motivo** da porta de cima. Vale também para
`rejects.toThrow()` e para `expect(status).toBe(400)` em rota com validação em camadas.

**A 48ª — regra que confere VÁRIAS COISAS, provada por UMA SÓ.** "Uma quebra por regra" não basta
quando a regra tem mais de um exame, uma válvula de escape ou uma fronteira numérica dentro.
🔴 **A pior ocorrência não era um buraco, era o contrário:** arrancar a válvula de escape do horário
invertido fazia a regra **recusar a gravação de um lugar que abre à noite de propósito**, e nada
reclamava. **Numa porta, falso positivo é pior que falso negativo: ele trava o dono de gravar uma
verdade.** Treze ocorrências no total — seis achadas pelo implementador, sete pelo revisor. Remédio:
provar cada exame **e cada fronteira** (testar em 4 e em 5, não só em 6), e cada ramo de
`continue`/`return`.

**A 49ª — BIFURCAÇÃO DE FRASE com prova de um lado só.** Uma frase montada por ternária ou por `??`
tem dois ramos; se só um tem asserção de conteúdo, colapsar a bifurcação deixa a suíte verde e o
outro ramo passa a mentir. Foram três ocorrências, e duas escondiam um defeito **diferente** do que a
frase descrevia (*"o custo está escrito como ''"* quando o campo está **ausente**; *"o chip diz
nenhum preço"* escondendo chip preenchido **sem número dentro**). Remédio: caso simétrico por ramo,
com a frase dele afirmada e a do outro **negada**, e mutação colapsando nos dois sentidos.
⚠️ **É disciplina, não guarda** — declarado como buraco: guarda de verdade exigiria enumerar ramos.

**E um defeito de instrumento, que é a espécie 43 com roupa nova:** ao rodar as mutações, sete
voltaram *"alvo não encontrado"* porque as edições deixaram dois arquivos em **CRLF** e os alvos
multi-linha do harness usavam `\n`. 🔴 **"Sem alvo" estava sendo impresso como se fosse um
RESULTADO, quando é a AUSÊNCIA de medição.** Corrigido, com o placar separando
morreu/sobreviveu/sem-alvo/sem-diff.
