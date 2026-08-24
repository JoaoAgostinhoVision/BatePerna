# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** O ledger da execução vive em
> `.superpowers/sdd/2026-08-18-review-do-celular/progress.md`, que é **scratch git-ignorado** —
> um `git clean -fdx` o apaga. O essencial dele está aqui.

**Última parada:** 2026-08-23. ✅ **SEGUNDA RODADA DO REVIEW FECHADA E MERGEADA.**
`main` em **`8329284`** (merge `--no-ff` de `review-2-celular`, 15 commits), mais a **rodada curta
do "daqui"** que veio depois (ver §Z). **659/659 em 49 arquivos**, `tsc` limpo, `npm run build` passa — **os três conferidos por mim em `main` DEPOIS do
merge**, não relatados por agente. ✅ **NO AR**: deploy `● Ready · Production`, e os **seis
marcadores conferidos por `curl`** em produção (ver §D).

✅ **AS OITO TASKS FECHARAM**, cada uma com implementador → revisão com dois veredictos → fix
round quando preciso → re-revisão escopada. Mais a **revisão da branch inteira**, que achou **1
Critical de JUNÇÃO** — **oitava rodada seguida em que ela paga**.

🔴 **O placar de método, o mesmo há quatro sessões: NENHUM fix round consertou lógica de
aplicação.** O código dos implementadores chegou certo **oito vezes em oito**. Todos os achados
foram de **PROVA** e de **COMENTÁRIO**, e a maioria foi **deles em cima de MIM** — inclusive **três
frases minhas escritas sobre arquivos que eu não tinha aberto**, duas delas pegas no pré-voo antes
de virarem código.

---

# ▶▶ SE O JOÃO DISSER "CONTINUA" — ele volta pra DIZER O QUE ACHOU. Isto é triagem, não retomada.

🔴 **NÃO EXISTE NADA PENDENTE DO MEU LADO.** A rodada de 2026-08-23 fechou, mergeou
(`main` `8329284`) e **está no ar**, conferida por `curl`. Ele já mandou dois reviews do celular, e
cada um virou uma rodada inteira — o terceiro é o caminho provável.

🔴 **E TEM DUAS PERGUNTAS DE PRODUTO ESPERANDO POR ELE — §P item 3.** A revisão da branch achou
dois becos **pré-existentes**, que não são desta rodada. **Não conserte por conta própria** — são
decisões dele.

O protocolo de triagem de sempre:

- **Não devolva menu.** Não pergunte "o que você quer fazer agora".
- **Não pergunte "o que faltou"** — ele já respondeu isso uma vez, e a resposta virou esta rodada
  inteira. Perguntar de novo é fazê-lo repetir trabalho.
- **Se ele disser só "continua" e mais nada:** o correto é dizer **em três linhas** o que está no
  ar (§7), o que sobrou pra ele (§P), e **calar**. Ele fala quando quiser.
- **Se ele vier com o review** (o caso provável): **triagem**, no molde que já funcionou duas
  vezes — cada frase dele vira um item; cada item vira *defeito* / *pedido novo* / *decisão de
  produto*; e **só depois** vira spec e plano. **Não comece a codar na primeira frase.**

🔴 **E leia a ficha real antes de traduzir qualquer pedido dele em campo.** Foi o que reorganizou
a rodada passada inteira: a lista dele parecia ser sobre *esforço do corpo* e era sobre *piso da
via*, porque **a Rampa do Pepê é um rolê de carro**. Este app só sabe falar de LUGAR.

### 0. As permissões já estão largas — isto foi pedido dele em 2026-08-21

Ele disse que **os prompts de permissão são o que mais atrasa**. Então `.claude/settings.json`
(local, porque `.claude/` é gitignored inteiro) agora tem `defaultMode: "acceptEdits"` + 59 regras
de allow cobrindo `git`, `npm`/`npx`/`node`, e o shell de leitura. **Não peça permissão pra
editar, criar arquivo, rodar teste, build ou commit — já está liberado.**

Três coisas continuam **perguntando de propósito**, e não são atraso: `git push`, o **deploy do
vercel**, e o `gh`. São as que saem da máquina dele. E o `git clean -fdx` está **negado** — neste
repo ele apaga o ledger de scratch e o próprio `.claude/`.

### 1. Confira o chão em silêncio

```
git branch --show-current  → main
git status --short         → limpo
npm test                   → 659/659 em 49 arquivos   ← tudo verde, NÃO há falha esperada
npx tsc --noEmit           → limpo
npm run build              → passa
```

⚠️ **A suíte ENCOLHEU de 662 pra 657, e isso é esperado:** a rodada de 2026-08-23 apagou o campo
`extensaoKm` inteiro. A contagem foi fechada **nome a nome** pela revisão (38 removidos, 1
acrescentado, 13 renomes, e 10 escondidos dentro de três blocos `it.each`); depois a leva final
devolveu +4 do guarda de orçamento de altura.

**Os três foram conferidos por mim em `main` depois do merge**, não relatados por agente. Se a
suíte estiver diferente disso, alguma coisa mudou e vale descobrir o quê antes de seguir.

### §7 — O QUE A RODADA DE 2026-08-23 MUDOU (as quatro linhas, se ele só disser "continua")

1. **A cidade escolhida à mão agora vence POR SESSÃO** — aba viva **e** no máximo 6h. Passado
   isso, a próxima abertura volta a pedir GPS sozinha. E **entrou um "de onde eu estou"** no painel
   de busca: quem escolheu cidade tem caminho de volta, o que **não existia em produção**.
2. **O teto de 100 km MORREU.** A barra de distância vai até a **trilha mais longe do acervo**
   (piso de 30), e o campo aceita qualquer número. Nada de limite inventado.
3. **`extensaoKm` saiu INTEIRO** — filtro, cartão, ficha, schema, `geo.ts` e questionário.
   Conferido nos chunks de produção: zero.
4. **A Rampa tem `piso: "barro"`** — dado dele, sustentado pela ficha real em três lugares. É a
   **primeira vez que o campo da rodada passada carrega conteúdo de verdade**, e ele aparece no
   cartão e no bloco 📍 Trajeto.

**Consequência que ele aceitou de olhos abertos:** com **uma ficha só, e ela de barro**, qualquer
chip de piso **esvazia a home** — e a tela explica, com "Nenhuma trilha com esses filtros" e o
botão de limpar. É a resposta certa: "no mínimo asfalto esburacado" realmente exclui uma rampa de
barro.

### §P — O QUE SOBROU

1. 🔴 **O DEPLOY, e é passo MEU, não dele.** A rodada mergeou e **não foi pro ar**. Ver §D.
2. 🟠 **O iPHONE.** Nada de duas rodadas foi visto em WebKit. O que só ele responde: a barra de km
   **arrasta com o polegar**? o campo numérico abre o **teclado certo**? **a barra encolhendo
   quando o dedo solta em "qualquer" assusta?** (o teto é dinâmico agora). E o **cartão com
   "barro"** junto do `~27 km em linha reta · R$ 5` cabe na linha a ~360px?
3. 🟠 **DUAS PERGUNTAS DE PRODUTO, achadas pela revisão da branch, e as duas são PRÉ-EXISTENTES —
   não desta rodada.** Não conserte por conta própria:
   - **`contarLigados` conta a distância mesmo sem localização.** A linha de resumo diz "1 filtro
     ligado" e o painel **não desenha o grupo** (ele está atrás do `temLocal &&`). É filtro contado
     sem chip pra desligar — **exatamente o sintoma que ele reclamou no 1º review** — e está
     alcançável no celular dele enquanto o GPS não responde, ou se ele negar.
   - **Com `local = "nao-sei"` e o GPS respondendo `code 2`/`code 3`** (sem sinal / estourou o
     prazo), `soGps` continua `true`, a pílula **sempre** pede GPS e o painel de busca **nunca
     abre** — não há caminho pra digitar cidade. O "de onde eu estou" novo **não ajuda**: ele mora
     dentro do painel que não abre. Só a recusa (`code 1`) está sã.
4. 🟠 **`docs/questionario-ficha.md` continua PRONTO pra ele responder.** A pergunta da extensão
   saiu; a do `piso` foi corrigida (ela mandava procurar uma pergunta que deixou de existir). A 2ª
   ficha continua sendo o que acende os filtros.
5. 🟠 **Dívida registrada, não bloqueio:** as **11 provas de fonte** que leem o arquivo cru
   continuam lá (ver §4). Os dois helpers já existem.

### §D — O DEPLOY, e 🔴 O COMANDO DO REGISTRO ESTAVA INCOMPLETO

🔴 **`npx --yes vercel@latest --prod --yes` FALHA com `Not authorized`.** Descoberto em
2026-08-21. **Não é sessão expirada** — `npx vercel whoami` responde
`joaoricardoagostinho285-1392` normalmente. **O projeto vive num TIME** (`.vercel/project.json`
tem `orgId: team_anCtRLJUFJs5xrs9X57lYltw`), e sem `--scope` a CLI mira a **conta pessoal**. O
comando certo é:

```bash
npx --yes vercel@latest --prod --yes --scope bate-perna
npx --yes vercel@latest ls --scope bate-perna     # a linha de cima tem que ser ● Ready · Production
```

✅ **A RODADA DE 2026-08-23 ESTÁ NO AR** — `● Ready · Production`, e os seis marcadores abaixo
passaram em produção logo depois do deploy.

```bash
H=https://bateperna.vercel.app
curl -s $H/rampa-do-pepe | grep -c 'class="fatos"'          # 1   — a Rampa AGORA tem piso ✅
curl -s $H/rampa-do-pepe | grep -o 'barro' | wc -l          # 13  — o dado real na tela ✅
curl -s $H/ | grep -c 'km em linha reta'                    # 0   — 1º render sem localização ✅
curl -s $H/ | grep -c 'FILTRAR'                             # 1   ✅
```

🔴 **E o CSS SERVIDO, que é uma conferência a mais e nasceu de um susto real.** O conserto do
"daqui" (ver §Z) depende de **ordem de regra** no arquivo — e o Next **reescreve e FUNDE seletores**
na minificação. Conferido em produção: o minificador juntou `.busca-campo` e `.busca-item` num
seletor só pras declarações comuns, **mas preservou a ordem e o seletor de 3 classes**.

```bash
CSS=$(curl -s $H/ | grep -o '/_next/static/css/[^"]*\.css' | sort -u)   # são TRÊS arquivos
# no que tem as regras da busca: .bp .busca-item{...width:100%...} em 7036
#                                .bp .busca-linha .busca-daqui{...}    em 7166  ← DEPOIS ✅
# e zero regras de .busca-item depois da nossa mexendo em width/display/text-align ✅
```

🔴 **E a conferência que o `vitest` NÃO consegue dar — varrer os chunks servidos.** Não basta rodar
`grep` no `.next/` local: o que importa é o que o navegador dele baixa. Os **6 chunks** foram
puxados um a um de produção:

```bash
CHUNKS=$(curl -s $H/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u)
for c in $CHUNKS; do curl -s "$H$c"; done | \
  grep -cE 'extensaoKm|formatarExtensao|kmNaTelaExtensao|DIST_MAX_KM|EXT_MAX_KM|Tamanho da trilha'
# 0 ✅ — a CONTRAÇÃO chegou ao bundle
for c in $CHUNKS; do curl -s "$H$c"; done | \
  grep -cE 'de onde eu estou|tetoDistanciaKm|asfalto-esburacado'
# 4 ✅ — e o vocabulário NOVO chegou junto
```

⚠️ **As duas metades importam.** Só a primeira prova que o morto sumiu; sem a segunda, um deploy
que não subiu passaria verde nas duas — nada morto e nada vivo dá zero e zero.

**Conferência da rodada anterior (os seis passaram em 2026-08-21, guardados como história):**

```bash
curl -s $H/rampa-do-pepe | grep -c 'data-bloco="trajeto"'   # 1
curl -s $H/ | grep -c 'FILTRAR'                             # 1
# nos chunks: 0 de /puxada|duracaoMax|1h30|formatarDuracao/ e >=1 de /asfalto-esburacado/.
```

### §Z — 🆕 A RODADA CURTA DE DEPOIS: o "daqui" ao lado do campo (2026-08-23, mesma sessão)

**Ele usou o app e pediu o oposto da correção do Critical:** queria poder ir pro GPS **no meio da
digitação**. Está no ar (`main`, merge `--no-ff` de `gps-ao-lado-do-campo`, **659/659**).

O campo e o botão agora dividem a primeira linha, dentro de uma `.busca-linha`. **É geometria, não
estética:** os dois custam UMA linha de 44px, a mesma que o campo sozinho custava, e a lista fica
com os ~70px. O custo mudou de eixo — saiu da ALTURA da lista e foi pra LARGURA do campo
(353px → **265px**, medido em Chrome real em 375; 214px em 320). O rótulo encurtou pra **`daqui`**,
que é o vocabulário que a pílula já usa.

🔴 **E a primeira tentativa nasceu com um Critical PIOR que o original.** `.bp .busca-daqui` e
`.bp .busca-item` empatavam em especificidade (0,2,0), e o botão carrega **as duas classes**.
Empate se resolve por ordem, o item de LISTA vinha depois — então **ele** ganhava: o botão saía
`display:block; width:100%; text-align:left`, tomava a linha inteira e espremia o campo até
**24px**. Medido em Chrome real, e o defeito foi reproduzido lá **dígito a dígito** restaurando a
regra antiga via CSSOM ao vivo.

**Corrigido por DUAS vias, e as duas são necessárias por razões diferentes:**
- a **especificidade** (`.bp .busca-linha .busca-daqui`, 0,3,0) é o que vale no navegador e
  sobrevive a alguém reordenar o arquivo — confirmado em Chrome real;
- a **posição**, depois do `.busca-item`, é o que torna a regra **provável**: 🔴 **medido, o
  `getComputedStyle` do jsdom resolve este caso por ORDEM e não por especificidade.** Sem a
  posição, o teste falharia com o CSS certo.

### 2. Leia, nesta ordem

1. `docs/superpowers/specs/2026-08-18-review-do-celular.md` — o desenho aprovado por ele.
2. `docs/superpowers/plans/2026-08-18-review-do-celular.md` — 8 tasks. 🔴 **Leia os blocos de
   citação "EMENDA DO PRÉ-VOO"**: eles CORRIGEM o texto ao redor, e onde discordarem a emenda
   vence. Tem emenda na Task 2, na 3 e na 4.
3. `.superpowers/sdd/2026-08-18-review-do-celular/progress.md` — o ledger. **É scratch
   git-ignorado; se um `git clean` o apagou, o essencial está aqui e no plano versionado.**

Os **briefs das 8 tasks** ficaram em `.superpowers/sdd/.../task-N-brief.md`, que é scratch — mas
são extraídos do plano com o script, então **regeneram**:
`"…/superpowers/6.3.0/skills/subagent-driven-development/scripts/task-brief" <plano> <N>`.
🔴 **O brief regenerado NÃO tem as emendas do pré-voo** — elas foram escritas à mão por cima.
Depois de regenerar, **releia o plano e recoloque a emenda da task** antes de despachar. As da
Task 2, 3 e 4 estão no plano; as das Tasks 5 a 8 ainda não foram feitas.

### 3. O estado exato, task a task

| Task | Estado | Commits |
|---|---|---|
| 1 — GPS pede sozinho na 1ª abertura | **completa**, 1 fix round, re-revisão limpa | `b4a7585`, `2260c36` |
| 2 — `piso.ts` + schema + questionário | **completa**, 3 fix rounds, re-revisão **ADDRESSED** nos 6 achados | `ad88d20` (WIP), `9b03f43`, `cb97792`, `0445f50`, `bdb4497` |
| 3 — recortes novos em `filtros.ts` | **completa**, 1 fix round + 1 conserto meu, re-revisão **ADDRESSED** nos 4 | `066cb08`, `c4161b4`, `e0d1442` |
| 4 — `FaixaKm`: a barra e o campo | **completa**, 1 fix round (9 achados), re-revisão **PROVA Approved** + 1 conserto meu de comentário | `41ee448`, `0ddf131`, `2250e7c` |
| 5 — o painel: duas faixas e os chips de piso | **completa**, 1 fix round (3 achados), re-revisão **Approved nos DOIS veredictos** | `3dc3957`, `941365b` |
| 6 — o cartão | **completa**, 1 fix round (1 Important + 3 Minor) + 1 conserto de 1 linha, re-revisão **Approved nos DOIS veredictos** | `b03b985`, `627e8e0`, `eb9daab` |
| 7 — a ficha: piso e extensão no Trajeto | **completa**, 1 fix round (1 Important + 2 Minor) + 1 oração, re-revisão **Approved nos DOIS veredictos, sem achado novo** | `75ef513`, `f8455ba`, `80e6834` |
| 8 — A CONTRAÇÃO | **completa**, revisão **Approved nos dois** de cara + 1 fix round (2 Minor), re-revisão **Approved nos DOIS, sem achado novo** | `903575b`, `0426475` |

✅ **AS OITO TASKS ESTÃO FECHADAS.** **Chão depois da Task 8:** `npm test` **613/613 em 49
arquivos**, `tsc` limpo, `npm run build` passa. A base da rodada era 539; o pico foi 632, e a
**contração devolveu 19** — conferidos teste a teste pelo revisor (24 nomes sumiram, 5 entraram,
e **3 dos 24 eram RENOMES, não remoções**; os 21 removidos de verdade são todos sobre os campos
mortos).

⬅️ **É AQUI QUE VOCÊ COMEÇA: a REVISÃO DA BRANCH INTEIRA**, com agente **novo** (sem o viés de
quem revisou task a task). Pauta no plano, "Depois das oito", item 3. Depois dela: merge
`--no-ff`, deploy, e conferir com `curl`.

✅ **A re-revisão da Task 5 voltou e fechou: Approved nos DOIS veredictos.** Somadas as duas
passadas, **30 mutações medidas nesta task e 30 morrem** — inclusive as três que estavam vivas.
O teste novo de aninhamento **não passa por vacuidade**: o revisor apontou o seletor pra uma
classe inexistente e mediu que o teste CAI com a linha de guarda e PASSA sem ela. É o primeiro
guarda anti-vacuidade desta rodada escrito **e** medido no mesmo commit.

### 3a. 🔴 O QUE AS TASKS 4 E 5 DEIXARAM DECIDIDO

- O `FaixaKm` **já é o grupo**: `<fieldset class="filtro-grupo faixa-km">` + `<legend>{rotulo}</legend>`.
  **Não o embrulhe em outro fieldset.** O nome acessível sai da legend **de propósito** — o
  `aria-label` foi REMOVIDO na revisão porque, junto com a legend, ele mascarava o sumiço dela
  (medido: apagar a legenda deixava a suíte 19/19 verde, e só quem OLHA a tela perdia o título).
- Barra: `min={passo}`, `max={max + passo}`, `step={passo}`; a parada extra vale **`null`**.
  Campo: role `spinbutton`, prende **só o teto** na hora, piso é `1`, `Math.trunc`.
- **Custo aceito e registrado** (não re-litigar): com corte abaixo do passo — 4 km na distância,
  passo 5 — o pegador fica na primeira parada enquanto o campo diz `4` e a leitura diz `até 4 km`.
  Só o controle grosso discorda; os dois portadores de TEXTO dizem a verdade. As três saídas
  alternativas são piores, e o porquê está no item 6 da emenda 2 da Task 4.
- **O painel (Task 5) está assim:** Distância daqui → Tamanho da trilha → Piso, no mínimo → Hoje →
  Custo. As duas primeiras são `<FaixaKm>`; a de distância continua atrás do `temLocal &&`, a de
  tamanho **não**. Esforço e Duração **saíram da tela** (os campos só morrem na Task 8). Os quatro
  limites são **importados** de `@/lib/filtros`, e há asserção de FONTE provando que nenhum km
  está escrito à mão — ela é a única capaz de pegar `max={100}` no lugar de `max={DIST_MAX_KM}`,
  porque em runtime os dois são o mesmo valor. **Medido: essa mutação derruba só a de fonte.**
- **Os `aria-label` dos fieldsets de `Hoje` e `Custo` foram removidos** (o implementador estendeu
  o ruling da Task 4; o revisor verificou no repo inteiro que nenhum teste os consulta por
  role/nome, e as duas `<legend>` dizem o mesmo que os atributos diziam).

### 3b. 🔴 O QUE JÁ ESTÁ DECIDIDO E AS TASKS 6 A 8 TÊM QUE CASAR

- **Os quatro limites moram em `src/lib/filtros.ts`** (`DIST_MAX_KM = 100`, `EXT_MAX_KM = 20`,
  `DIST_PASSO_KM = 5`, `EXT_PASSO_KM = 1`) e a tela os **lê de lá** — provado por asserção de
  FONTE no `PainelFiltros`, e o `filtros.test.ts` prende os quatro **valores literais**.
- **`lerFiltros` valida `>= 1`, não `>= passo`.** Se a tela prender no `passo`, um `4` digitado é
  aceito, guardado, e vira `null` na releitura — **o filtro se desligando sozinho entre duas
  aberturas do app.** É o defeito central desta rodada; ele reapareceu em quatro roupas
  diferentes (o piso do campo, o `step` da barra, o fracionário, e os limites trocados entre as
  duas faixas) e as quatro estão fechadas por teste.
- ✅ **O deferido I-2 da Task 3 (`barro` entrando pelo estado em memória) FECHOU na Task 5**, por
  construção: o único jeito de escrever `pisoMinimo` é tocar um chip, e os chips saem de
  `PISOS_FILTRAVEIS`. Há teste de que o chip de `barro` não existe.
- 🔴 **O filtro FANTASMA, e ele só morre na Task 8** (transferido da Task 5, achado T5-2): entre
  agora e a Task 8, um `esforco`/`duracaoMax` guardado no celular dele **conta na linha de resumo
  sem chip pra desligar e sem botão de limpar** — o `limpar filtros` do `FolhaTrilhas` vive dentro
  do ramo `visiveis.length === 0`, e a lista não fica vazia. **Hoje o dano é o contador mentindo,
  não trilha sumida**, porque a única ficha real não tem `esforco` e a REGRA DE HONESTIDADE 2
  impede o fantasma de esconder. Com uma 2ª ficha COM `esforco`, passaria a esconder de verdade.
  **A Task 8 resolve por construção** — e o teste `contarLigados(lerFiltros(velho)) === 0` é a
  prova de que fechou. **Não mergeie a rodada sem a Task 8.**
- **Deferido que chega na Task 5** (achado I-2 da revisão da Task 3, plan-mandated): o tipo
  `pisoMinimo: Piso | null` ainda deixa `barro` entrar pelo **estado em memória** — a emenda 2
  fechou só a porta do `localStorage`. Aceso, `barro` não esconde nada **e não tem chip pra
  desligar**: a linha diria "1 filtro ligado" sem controle na tela. Já está registrado no teste.

### 4. 🔴 O PRÉ-VOO DE CADA TASK JÁ PAGOU OITO VEZES NESTA RODADA — não pule

**Antes de despachar qualquer task, releia a lista de testes do brief perguntando "que linha do
código eu posso apagar sem isto falhar?"** e mande o complemento junto no despacho. Nesta rodada
o pré-voo já achou **mais de vinte furos do plano** (sem total cravado de propósito: o número
envelhece) — e as emendas estão **no plano versionado**
(`docs/superpowers/plans/2026-08-18-review-do-celular.md`, em blocos de citação 🔴), não só nos
briefs de scratch.

🔴 **O padrão que as três tasks desta sessão confirmaram: o código dos implementadores estava
certo todas as vezes. Os oito achados foram do PLANO e da PROVA.** Nenhum fix round desta sessão
consertou lógica de aplicação. Quando o revisor rotula "plan-mandated", é literal.

**As três formas novas, e elas valem além desta rodada:**

- **Uma prova que a CAMADA não pode dar.** A mutação #2 da Task 2 (`PISOS_FILTRAVEIS` virando
  lista copiada à mão) **não morde** — medida, 3/3 verde. Em runtime, lista derivada e lista
  copiada com o mesmo conteúdo **são o mesmo valor**; nenhuma asserção de valor as distingue. O
  remédio foi **asserção de fonte**, o precedente do `"use client"`. **Antes de exigir uma
  mutação, pergunte se a camada consegue distinguir as duas versões.**
- **Prova OCA porque as duas versões coincidem no caso testado.** Eu cravei que
  `"distanciaKm 0 → null"` provava o piso do intervalo. **Não prova:** `0 >= 5` também é falso,
  então `>= 1` e `>= passo` eram indistinguíveis pela suíte que eu especifiquei. Medido pelo
  implementador e confirmado pelo revisor: mutando o piso caem **só** os testes que ele
  acrescentou (`distanciaKm 4 → 4`). **Escolha o caso de teste que SEPARA as duas versões, não um
  que ambas rejeitam.**
- **Teste auto-referente quanto ao VALOR.** Os testes de borda escritos contra o símbolo
  (`DIST_MAX_KM + 1`) provam a RELAÇÃO e são cegos ao número: trocar `EXT_MAX_KM` de 20 pra 8
  deixava tudo verde, porque o teste vira "9 → null" e "8 → 8", corretos com 8. **As duas provas
  são ortogonais e as duas precisam existir** — medido nos dois sentidos: mutar o valor derruba
  só a asserção literal; mutar a relação (`<=` → `<`) derruba só os testes de borda.
- 🆕 **O COMENTÁRIO MENTIROSO DESTA VEZ FOI MEU, E ESTAVA NO PLANO — 2026-08-20.** Minha emenda
  justificava o `step` da barra dizendo que sem ele ela produz 101…104 *"que o `lerFiltros` joga
  fora na abertura seguinte: o filtro se desligando sozinho"*. **É falso, e o revisor mediu:** o
  próprio componente faz `n > max ? null : n` antes de qualquer coisa sair dele — com `step={1}`,
  pedir 101 à barra devolve `null`. **Nenhum valor acima do teto escapa, com ou sem `step`.** A
  linha vale (o `step` é DESENHO: sem ele a barra vira granular de 1 km e sobram ~4px de zona
  morta), mas a razão escrita era outra. Do plano a frase foi pro `FaixaKm.tsx` e pro teste:
  **dois arquivos a partir de uma frase minha, pela segunda sessão seguida** (a primeira foi o
  "asfalto" da Rampa, que virou quatro). Corrigido na nascente em `6fb4e39`.
- 🆕 **A lição do caso-que-separa vale por COMPARAÇÃO, não por controle.** O implementador da
  Task 4 aplicou-a certo na barra — pegou uma prova oca MINHA (`valor 4` com `min=5`: o elemento
  prende o 4 em `"5"`, e a versão certa e a arredondada mostram a mesma coisa; com `7` elas se
  separam) — e no **mesmo arquivo** deixou o campo sem nenhum caso de fronteira. As duas
  comparações que faltavam eram exatamente as duas que a revisão achou: `n > max` → `n >= max` e
  `i < 1` → `i <= 1`, **as duas com a suíte 19/19 verde**. A segunda é o "campo indigitável" de
  volta com um `=` de diferença: com `<= 1`, digitar `1` esvazia o campo e **todo número que
  começa por 1** (`1`, `10`, `100`) fica inalcançável pelo teclado.
- 🆕 **E ACONTECEU DE NOVO NA TASK 5, mesma sessão, mesmo formato — são DUAS.** A emenda da Task 5
  prometia que *"o botão 'limpar filtros' da folha continua sendo a saída"* pro filtro fantasma.
  **Medido: o `limpar filtros` vive dentro do ramo `if (visiveis.length === 0)`** e só aparece
  quando o filtro zerou a lista — que não é o caso. **As duas frases erradas desta sessão têm a
  mesma assinatura: eu afirmando no plano uma proteção que existe no meu RACIOCÍNIO e não no
  código, sobre um arquivo que eu não abri.** Nas duas vezes quem pegou foi a régua de MEDIR, não
  a de ler. A regra que fica: **antes de escrever "X continua sendo a saída" ou "Y joga isso
  fora", abra o arquivo e confira o RAMO em que a linha vive.**
- 🆕 **A COSTURA DE COMPONENTE CONTROLADO — defeito de junção pego, pela primeira vez, na revisão
  de TASK.** O `FaixaKm` é controlado: a Task 4 provou que ele **obedece** à prop, e a Task 5
  tinha que provar que o painel **alimenta** a prop com o que está guardado. Ela provou só a
  direção da ESCRITA (`fireEvent.change` → ler o `localStorage`), e as duas mutações da direção
  de volta ficaram **33/33 verdes**: `valor={filtros.distanciaKm}` → `valor={null}` (a lista corta
  em 30 km de verdade, a linha diz "1 filtro ligado", **e o campo fica em branco dizendo
  "qualquer"**) e a faixa de tamanho lendo o valor da de distância (dois recortes exibindo um
  número só). **Quando um componente controlado atravessa duas tasks, a de baixo prova a
  obediência e a de cima tem que provar a ALIMENTAÇÃO — são duas direções, e a suíte da escrita
  não vê a da leitura.**
- 🆕 **A prova de mutação que não foi APLICADA conta como sobrevivente — e neste repo há uma
  armadilha concreta pra isso.** Medido: **o código-fonte (`PainelFiltros.tsx`, `FaixaKm.tsx`,
  `home.css`) está em CRLF e os arquivos de teste em LF.** Uma âncora de mutação com quebra de
  linha casada em LF simplesmente não encontra nada no `.tsx`, a substituição vira no-op, a suíte
  fica verde e a mutação entra no relatório como "sobreviveu" — a revisão então pede conserto de
  coisa que não está quebrada. **Todo aplicador de mutação tem que ABORTAR ALTO quando a âncora
  não casa** (e quando casa mais de uma vez), nunca seguir em silêncio.
  🔴 **A assimetria que salva, e vale saber:** uma mutação não aplicada só produz **falso
  sobrevivente**, nunca falsa morte. Então todo "morde" reportado é seguro por construção; quem
  precisa de verificação é só o sobrevivente. E nesta rodada **todo sobrevivente reportado voltou
  a FALHAR depois do conserto**, o que prova retroativamente que foi aplicado de verdade.
- 🆕 **O atributo que MASCARA o sumiço do elemento.** `aria-label` no `<fieldset>` **junto** com a
  `<legend>`: apagar a legenda deixava tudo verde, porque o nome acessível continuava vindo do
  atributo (ele tem precedência) e só quem OLHA a tela perdia o título. **Duas fontes pro mesmo
  nome, e a de fora mascarando a de dentro.** Mesma família: três `getByRole` soltos não provam
  contenção — é `within(grupo)` que prova.
- **Um campo indigitável.** A Task 4, como eu a escrevi, prendia o campo numérico no intervalo
  `[passo, max]` "na hora", com `DIST_PASSO_KM = 5` — o `4` vira `5` no primeiro dígito e
  **ninguém consegue digitar `45`**, nem `100`. Ruling: **o piso do intervalo é `1`**; `passo` é
  granularidade da BARRA. **Simule o dedo dígito a dígito antes de cravar comportamento de
  campo** — nenhum teste desta suíte pega isso.
- 🆕 **REQUISITO ENUNCIADO EM PROSA, SEM DONO NA TABELA DE MUTAÇÃO — o Important da Task 6
  (2026-08-21), e é meu.** O brief dizia *"a linha some inteira se nada sobrar"* e não pôs isso
  nem na lista de testes nem na tabela. **Medido: apagar a guarda `partes.length > 0 &&` deixava
  a suíte 624/624 verde.** A regra que fica: **toda frase de comportamento escrita em prosa no
  brief precisa de linha na tabela de mutação** — se não tem dono, não existe.
- 🆕 **A ASSERÇÃO DE AUSÊNCIA DE TEXTO MASCARA O SUMIÇO DO ELEMENTO, e é a família do
  `aria-label` sobre a `<legend>` com outra roupa.** `container.querySelector(".x")?.textContent
  ?? ""` seguido de `not.toContain(...)` **passa nos dois mundos**: com o elemento presente e
  vazio, e com ele ausente. O `?.` e o `?? ""` são a máscara. **Se o que se prova é que o
  elemento não existe, a asserção é `toBeNull()`** — e o teste tem que cair **pelo motivo certo**
  (na Task 6 a mensagem do vitest, `expected <span class="cartao-meta"></span> to be null`, foi
  ela mesma a prova de que o seletor casava quando o elemento existia; um seletor digitado errado
  teria passado em silêncio).
- 🆕 **Teste de ausência sem o irmão de PRESENÇA é meia prova.** Todos os "não inventa" passam
  com o componente inteiro apagado.
- 🆕 **ESCOLHA DE FIXTURE LOAD-BEARING TEM QUE TER A RAZÃO ESCRITA AO LADO.** Na Task 6 foram
  **três** no mesmo arquivo: `piso: "asfalto-esburacado"` em vez de `barro` (senão `rotuloPiso` é
  inprovável), `extensaoKm: 4.25` em vez de `4` (senão o sufixo à mão é indistinguível da
  função), e `valor: "R$ 5 por pessoa"` numa ficha **gratuita** (senão a checagem de
  `tag === "pago"` não tem como ser provada — medido, a mutação sobrevivia 625/625). **Sem a
  frase ao lado, o próximo leitor "limpa" o valor como ruído e a prova fica oca em silêncio.**
- 🆕 **A COLISÃO ESTRUTURAL "só estes arquivos" × "não deixe comentário mentir", e a saída medida
  (Task 6, 2026-08-21).** Toda task que remove o **último chamador** de um símbolo torna falsas,
  **no mesmo instante**, frases que vivem fora do escopo dela — na Task 6 foram três comentários,
  e nenhum estava num arquivo que a task podia tocar. **A saída NÃO é outro portão "volte
  limpo"** (o meu, na Task 8, não fechava por duas razões: o termo era digitado de memória —
  `duracao` não acha `formatarDuracao`, e `rg` é sensível a caixa — e porque **referência
  histórica legítima deve sobreviver**). A forma que funciona está escrita no plano, na Task 8:
  **termos copiados do diff, busca `-i`, e o passo produz CLASSIFICAÇÃO em três baldes** — (a)
  frase que AFIRMA um consumidor desfeito → corrija a oração agora; (b) referência declarada como
  HISTÓRIA → deixe; (c) CÓDIGO → a task não terminou, **e só este bloqueia**. Mais a cláusula de
  permissão na linha `Files:`, senão o passo é ilegal pra quem o executa.
- 🆕 **ORTOGONALIDADE SE MEDE, NÃO SE SUPÕE PELA FORMA — e o erro foi meu, na Task 7
  (2026-08-21).** Eu escrevi no plano que, num teste de junção, *"cada asserção pega um defeito:
  o cruzamento pega a DIVERGÊNCIA, o literal pega a VACUIDADE"*. **Falso, e por transitividade,
  não por amostragem:** enquanto os dois lados forem asseridos contra a **mesma constante**,
  `A === L ∧ B === L ⟹ A === B`. **Não existe estado do mundo em que o cruzamento falhe e os dois
  literais passem** — logo não existe mutação que só ele pegue, nem hoje nem depois. Medido: sob
  a mutação da formatação à mão, quem estoura é sempre o literal do lado que quebrou; e no
  cenário "alguém atualiza a constante pra casar com a tela quebrada", estoura o literal do
  **outro** lado (essa segunda foi medida com mutação DUPLA, de propósito, porque era a única
  frase do conserto ainda não medida). **O cruzamento fica** — é rede pro dia em que um literal
  sair ou as constantes divergirem — **mas escrito como REDUNDÂNCIA.** A régua geral: *existe
  mutação que derruba A e não B, nos dois sentidos?* Se não existe, uma é redundante. Eu já
  escrevi essa mesma frase CERTA uma vez (o par valor-literal × relação-simbólica) e errada
  agora — o que muda é ter medido.
- 🆕 **DECLARAR BURACO É CERTO; ENTERRAR JUNTO A METADE PROVÁVEL, NÃO.** Na Task 7 o
  implementador declarou *"a CSS não tem dono, o jsdom não mede aparência"* — e estava **meio**
  certo. São duas perguntas: *fica bonito?* (não mede — declarar foi correto, e cravar
  `font-size` num `toBe` compraria churn de design por nenhuma segurança) e ***o seletor casa?***
  (mede perfeitamente, com um `querySelector`). **Antes de declarar buraco, separe o que a camada
  não pode medir do que ela pode.**
- 🆕 **O DOM ESCORREGANDO DE BAIXO DO PRÓPRIO SELETOR — forma nova, e passava verde.** Medido:
  mover a linha pra **fora do `.wp-body`** mantendo-a **dentro** do bloco endereçável deixava
  632 testes verdes, e nessa posição a cadeia que o CSS declara (`.bp .wp-body .fatos`) **deixa
  de casar** — a linha perde estilo inteiro em silêncio. A asserção posicional escopava pelo
  bloco, que é grosso demais. **Escope a asserção pela MESMA cadeia que o CSS usa**, não por um
  ancestral qualquer. E o fecho honesto do outro lado é **existência do seletor** (`regraDe(...)`
  `.not.toBeNull()`), **nunca valor** — a régua `tests/css.ts` já existe neste repo pra isso.
- 🆕 **Mutação que derruba a suíte por EXCEÇÃO não prova o requisito.** Achado do implementador
  da Task 7, em cima do meu brief: com a linha do piso e a da extensão como elementos separados,
  tirar o guarda `ficha.piso &&` faria `rotuloPiso(undefined)` **estourar** — e "quebrou" não é o
  mesmo que "não mostrou linha vazia". Ele resolveu com lista única + guarda único (o desenho do
  cartão), e aí a remoção do guarda falha **por asserção**, com a mensagem exata do defeito.
  **Ao desenhar a mutação, pergunte se ela falha pelo motivo que você quer provar.**
- 🆕 **QUEM PROVA O QUÊ, na contração (Task 8) — medido, e com a correção do que eu ia registrar
  errado.** Numa task que APAGA, o `npm test` não é o juiz principal, mas ele também não é
  dispensável — e a repartição exata só apareceu medindo cada ressurreição:
  - **`esforco` de volta ao SCHEMA** → 1 teste cai, **e o `tsc` fica LIMPO**. O compilador **não**
    é dono disso;
  - **`esforco`/`duracaoMax` de volta ao `Filtros`/`contarLigados`** → 8 testes (é o filtro
    fantasma voltando a contar);
  - **re-export sem o módulo** → `tsc` **TS2307**;
  - **`lerFiltros` voltando a preservar o campo** → 1 teste (`toEqual`);
  - **SEM DONO, e declarado:** `esforcoSchema`, `type Esforco` **e a ausência do próprio
    `src/lib/duracao.ts`**. 🔴 **Esta terceira eu ia registrar errado:** o commit dizia que o
    `tsc` era dono "do módulo apagado", e o revisor mediu — **recriar `duracao.ts` sem consumidor
    deixa `tsc` limpo, `build` passando e a suíte verde**. O `tsc` é dono do **re-export**, não da
    ausência do módulo.
- 🆕 **QUANDO a asserção de FONTE se justifica — a régua que faltava, e ela fecha uma dúvida que
  esta rodada abriu duas vezes.** O precedente (`PISOS_FILTRAVEIS`, `"use client"`) valia porque
  as duas versões **produzem o mesmo valor em runtime** e a diferença tem **consequência
  observável** que nenhuma outra camada alcança (a lista copiada diverge e o filtro esconde
  trilha errada; o componente vira server e a cor congela). Já `esforcoSchema` exportado sem
  chamador **não tem consequência**: não renderiza, não computa, nem entra no bundle. **Asserção
  de FONTE se justifica quando a diferença que ela pega tem consequência observável; sem
  consequência atrás, ela vira prova de ARRUMAÇÃO** — a mesma família do rename consistente que a
  Task 7 aceitou deixar invisível.
- 🆕 🔴 **A PROVA DE FONTE QUE LÊ O COMENTÁRIO — e a armadilha nasce JUNTO com a boa prática que
  este projeto prega (2026-08-21).** Achada pelo implementador **dentro do próprio teste que ele
  estava escrevendo**, e só porque ele mediu: a asserção lia o arquivo **cru**, ele apagou a
  chamada da função pra ver o teste cair, e ele **passou verde** — porque o **comentário** logo
  acima citava `kmNaTelaExtensao(undefined)` pra registrar uma medição, e o regex casou o
  comentário.
  > **Prova de fonte que lê comentário mostra que alguém ESCREVEU o nome, não que o código o
  > CHAMA.**

  **Por que isto é pior do que parece:** asserção de fonte é o instrumento que esta rodada usou
  **seis vezes**, e a regra da casa manda **escrever a medição num comentário ao lado da prova**.
  As duas boas práticas se atropelam — *"o comentário que fura nasce junto com a medição que ele
  registra"*. **O remédio:** tirar comentários antes da busca, **com asserção conferindo que a
  tira não comeu o código** (senão o remédio vira o próximo furo).

  **A auditoria do repo inteiro (27 provas) deu 1 furada — a que já foi consertada.** Mas o
  revisor mediu que a tira é **load-bearing nos dois sentidos**: `filtros.ts:223` tem um
  `Math.round(NaN)/10` **dentro de um comentário**, e a asserção irmã é de **AUSÊNCIA**
  (`not.toMatch(/Math\.round\(/)`) — lendo o arquivo cru ela **falharia hoje, com o código
  certo**. Presença fica furada, ausência fica falso-positiva.

  🟠 **DÍVIDA REGISTRADA, não bloqueio:** **11 provas de presença** em `.ts/.tsx` ainda leem o
  arquivo cru (P1, P2a/b, P3a/b, P4a/b, P5a/b, P7, P11). Estão sãs **por acidente** — nenhum
  comentário casa **hoje**. Os dois helpers já existem (`tests/css.ts:24` e o local em
  `tests/app/MioloHome.test.tsx:518`). As cinco de CSS são seguras por forma (pedem seletor +
  corpo `{…}` juntos) e as cinco de `"use client"` são **estruturalmente imunes**
  (`trimStart().startsWith`).
- 🆕 **O limite conhecido vale escrito AO LADO da prova.** O par de testes de CSS da Task 7
  *"parece a mesma prova e não é"* (um prende o DOM à cadeia, o outro prende a cadeia a existir).
  Sem uma oração dizendo o que o par deliberadamente **não** cobre — o rename consistente em JSX
  **e** CSS, que é refatoração e não defeito — o próximo leitor ou confia demais, ou "completa" a
  prova com asserção de **nome de classe**, que não deveria existir: nome de classe não é
  comportamento, e travá-lo cobra pedágio de toda renomeação sem comprar segurança.

### 4a. 🆕 O QUE A RODADA DE 2026-08-23 ACRESCENTOU — oito lições, todas medidas

- 🔴 **AS VARREDURAS DE COMENTÁRIO SÃO CEGAS EM CASCATA, e são TRÊS espécies, não uma.** Esta
  rodada descobriu as duas de baixo do jeito mais caro (achado na revisão), e cada uma é invisível
  pra anterior:
  1. **por SÍMBOLO** (`extensaoKm`, `EXT_MAX_KM`), com termos copiados do diff — é a que a rodada
     passada cravou. **Cega a prosa.** Medido: um comentário falso em `src/app/ficha.css` tinha
     **zero** ocorrências de símbolo, porque falava *"extensão da trilha"* em português corrido;
  2. **por PROSA** (`"extens"`, `"km de trilha"`, `"dois números"`) — a varredura em prosa achou
     **quatro** comentários falsos que a de símbolo não acharia. **Cega a posição.**
  3. 🆕 **por REFERÊNCIA POSICIONAL** (*"a pergunta seguinte"*, *"a de cima"*, *"as duas acima"*).
     Não tem símbolo **nem** a palavra-tema, então as duas primeiras passam batido. Quebra sempre
     que uma seção some. **O caso real doeu no `docs/questionario-ficha.md`**, o arquivo que o
     João responde à mão: a pergunta do `piso` mandava procurar uma pergunta que a contração tinha
     apagado. **Toda contração precisa das três, e a de prosa tem que cobrir `.css`, `.md` e
     `.json`, não só `.ts/.tsx`.**
- 🔴 **TEMPO VERBAL É PISTA, NÃO CRITÉRIO.** A classificação em três baldes (afirma consumidor
  desfeito / história / código) foi feita reconhecendo história pelo **verbo no passado** — e por
  isso deixou passar uma frase **no presente** que afirmava um consumidor já desfeito. **O critério
  é um só: *isto ainda é verdade depois desta mudança?***
- 🆕 🔴 **O DEFEITO DE JUNÇÃO GEOMÉTRICO — e é o Critical desta rodada.** Um elemento novo entrou
  como filho direto de flex do `.busca`, que é `position:absolute; inset:0` numa caixa de **altura
  FIXA** com `overflow:hidden`. O único irmão elástico é a caixa que rola, então os 44px do
  elemento **saíram inteiros dela**: `.busca-rolo` de **70,09px → 19,70px**, e o primeiro resultado
  de busca mostrando 45% de si mesmo. **Três coisas valem guardar:**
  (a) **nenhuma revisão de task podia ver** — o jsdom não mede pixel, e a prova daquela task é
  estrutural de propósito; (b) **a asserção que garantia o elemento era a mesma que matava a
  lista** (`volta.closest(".busca-rolo") === null`); (c) **a suíte inteira não tinha nenhum teste
  de orçamento de altura** — por isso 50px sumiram passando por oito revisões. O guarda novo
  compara a **lista exata de classes dos filhos** do painel, então pega **qualquer** filho fixo
  devolvido ali, não só aquele botão.
  🔴 **A régua que fica: em caixa de altura FIXA, todo elemento novo é subtraído de alguém. Pergunte
  DE QUEM antes de acrescentar.**
- 🆕 **EXCEÇÃO DENTRO DE CLIQUE É MASCARADA PELO REACT.** Um teste que provava um `try/catch`
  passava **com a proteção removida**: o despacho sintético de evento converte a exceção em
  "Unhandled Error" global em vez de propagá-la. **Pra provar que algo estoura, chame a função
  DIRETO, sem `.click()`** — e o arquivo já tinha a convenção certa oitenta linhas acima, num
  teste irmão cujo comentário descrevia a máscara.
- 🆕 **`vi.spyOn(sessionStorage, "setItem")` NÃO INTERCEPTA NADA neste jsdom.** É preciso espionar
  `Storage.prototype` **com checagem de `this`** pra isolar a instância e preservar o
  `localStorage` real. ⚠️ E o inverso é perigoso: espião largo em `Storage.prototype` já envenenou
  testes vizinhos aqui.
- 🆕 **A ASSERÇÃO "ACESSÓRIA" QUE TORNA A ISOLAÇÃO LOAD-BEARING.** Medido por acidente: tirando a
  checagem de `this`, o teste do `sessionStorage` cai numa asserção sobre **`localStorage`** que
  ninguém tinha escrito com essa intenção. Ela é o que prova que o espião não vazou. **Antes de
  "limpar" uma asserção que parece fora do assunto, mute a vizinhança e veja o que ela segura.**
- 🆕 **CONTABILIDADE DE TESTE: `it.each` ESCONDE N TESTES NUMA LINHA.** A suíte caiu **37** e o
  diff mostrava líquido **−27**. Os 10 que faltavam estavam em **três** blocos `it.each` em dois
  arquivos. **Contar linhas `it(` no diff não fecha conta** — só contar nome a nome, rodando a
  suíte nos dois commits, fecha. E **separe RENOME de REMOÇÃO**: nesta rodada, **13 dos 38
  "removidos" eram renomes**.
- 🆕 **ATUALIZAR UM TESTE ≠ DESTRUÍ-LO, e o implementador viu isso melhor que o meu brief.** Eu
  mandei inverter quatro asserções de `piso`; ele **recusou uma** e estava certo: aquela vivia
  dentro de `"ficha SEM piso valida — é opcional"`, um teste sobre **opcionalidade do schema**, não
  sobre o conteúdo da Rampa. Inverter teria matado a prova. Ele derivou um fixture sem o campo
  (`const { piso: _piso, ...semPiso } = base`), e o revisor mediu que a prova sobrevive (tornar o
  campo obrigatório derruba o teste). **Antes de atualizar uma asserção, leia o NOME do teste que
  a contém.**

### 4c. 🆕 O QUE A RODADA CURTA DO "daqui" ACRESCENTOU — e uma delas é ESPÉCIE DE TESTE NOVA

- 🔴 **PROVA DE CASCATA — a suíte não tinha, e a falta dela deixou 659 testes verdes com o campo de
  busca inutilizável.** Todos os testes de CSS deste repo leem **UMA regra por vez** do TEXTO do
  arquivo (`regraDe`/`valorDe`). Isso é **estruturalmente cego** à interação entre duas classes no
  MESMO elemento: nenhuma leitura isolada diz qual das duas ganha. A prova que faltava é **DOM real
  do componente + a folha real injetada no documento + `getComputedStyle`** — e o jsdom aguenta.
  ⚠️ **Com dois limites medidos, e os dois importam:** (1) o jsdom resolve por **ordem**, não por
  especificidade — então a regra tem que estar posicionada certo pra prova existir; (2) **toda regra
  deste projeto é `.bp .algo`**, e o `.bp` mora no `<main>` do `Moldura`/`page.tsx` — um teste de
  componente **não o renderiza**, então sem uma raiz `.bp` explícita **nenhuma regra casa e a prova
  inteira é vácuo**. Daí a asserção de não-vacuidade obrigatória (um valor que só pode ter vindo da
  folha), que foi medida caindo.
- 🔴 **ASSERÇÃO POR NEGAÇÃO É MEIA PROVA — e o argumento é geral.** As três asserções da prova de
  cascata nasceram como `not.toBe("100%")`, `not.toBe("block")`, `not.toBe("left")`: provavam que o
  concorrente **perdeu**, mas passam com **qualquer terceiro valor**. Trocar `width: auto` por
  `width: 60%` não seria pego por teste nenhum do repo. **Quando o valor certo é conhecido, afirme
  o valor certo** — é estritamente mais forte e prova a negação de quebra. Medido: as três mutações
  que a negação deixava passar caem com a asserção positiva.
- 🔴 **MUTAÇÃO QUE QUEBRA A SINTAXE NÃO É MUTAÇÃO — ela produz FALSO SOBREVIVENTE.** A mutação mais
  importante da rodada (devolver o botão pra fora da linha) reportou **0 falhas** e eu quase a
  registrei como sobrevivente. Era artefato: eu tinha inserido um `</div>` sem tirar o outro, o JSX
  ficou malformado, **a suíte nem rodou**, e o parser leu "0 failed". **Toda mutação precisa
  produzir código VÁLIDO, e o relatório precisa distinguir "rodou e ninguém pegou" de "não rodou".**
  Irmã da lição da rodada anterior (âncora que não casa), com cara nova.
- 🔴 **RODE MUTAÇÃO COM A BASE COMMITADA.** Rodei a primeira bateria com o trabalho não commitado, e
  uma exceção deixou uma mutação aplicada — um `git checkout --` por reflexo teria apagado a
  implementação inteira. **Commite antes; o `git checkout` do restore só é seguro assim.**
- 🆕 **O BUNDLE REESCREVE CSS, e conserto que depende de ORDEM precisa ser conferido SERVIDO.** O
  Next fundiu `.busca-campo` e `.busca-item` num seletor só pras declarações comuns. Neste caso a
  ordem e o seletor de 3 classes sobreviveram (conferido em produção), mas **a verificação não é
  opcional** quando a correção depende de posição — ver o §D.

### 4b. 🔴 A OUTRA FAMÍLIA QUE APARECEU TRÊS VEZES NESTA SESSÃO: comentário que envelhece

Três achados foram **comentários afirmando medições que deixaram de ser verdade**, sempre dentro
do comentário que existia justamente pra registrar a medição:

1. um guarda afirmando que *"fecha a porta pela qual a invenção anterior entrou"* — recolando a
   invenção como prosa, 9/9 verde. Ele fecha a porta **vizinha**;
2. `"585/585 VERDE"` cravado num comentário, envelhecido em duas horas;
3. um comentário afirmando **no presente** que quatro mutações deixam a suíte verde — o que era
   verdade **antes** da asserção escrita três linhas abaixo, a asserção que ele existe pra
   justificar.

**A regra que ficou: não crave total absoluto de suíte em comentário** ("nenhuma asserção cai" não
envelhece; "585/585" envelhece a cada task), **e escreva no passado o que foi medido antes da
mudança.** O risco do #3 é o pior: quem medir recebe o oposto do escrito e **desacredita o bloco
inteiro**, inclusive a parte que vale.

### 5. 🔴 A armadilha da Task 2, e ela vale além dela — foi o Critical desta rodada

`docs/questionario-ficha.md` é respondido **pelo João**, que não programa, e a resposta vira um
JSON que tem que passar no schema. **Na rodada passada o revisor achou DOIS defeitos nesse
arquivo que nenhuma leitura pegou — e só apareceram porque ele RESPONDEU o questionário e rodou
o JSON contra o schema.** A lição da casa é literal: *para artefato que vira entrada de outra
coisa, a prova é USÁ-LO.*

✅ **Feito na Task 2 (2026-08-19), e pagou de novo:** o JSON respondido passou no schema de
primeira, **mas a checagem com o dado real da Rampa achou um furo que nenhuma leitura pegou** — a
frase *"Não é o trecho final"* lia como instrução de **excluir** o último trecho, e na Rampa o
pior trecho **é** o último. Um leitor obediente excluiria o barro, sobraria asfalto, e o campo
que decide *"não suba de carro comum"* nasceria como `asfalto-tapete`. **Terceira rodada seguida
em que responder o questionário acha o que ler não acha. Faça sempre que o texto mudar** — um §C
velho não vale para pergunta nova.

Três pontos do texto que decidem se o dado entra certo ou errado **pra sempre**:
- **`extensaoKm` é SÓ IDA** — se a pergunta não disser com todas as letras, ele responde ida e
  volta e o número fica errado sem ninguém perceber.
- **`extensaoKm` é a TRILHA, o trecho a pé — não a estrada de carro até lá.** A pergunta do
  `piso`, logo acima no papel, acaba de falar da estrada; sem a exclusão escrita com todas as
  letras, a resposta natural é a quilometragem da estrada, e o cartão passa a mostrar dois
  números em km lado a lado, o segundo mentindo. É o defeito dos "dois km" com outra roupa.
- **`piso` é O PIOR TRECHO do caminho DIRIGIDO**, não o final nem a média nem o que predomina.
  Um exemplo do caso conflitante (o pior pedaço é curto e é o último) tem que estar no
  questionário; é ele que desfaz a ambiguidade.

🔴 **E o exemplo tem que ser HIPOTÉTICO, não a Rampa.** Uma versão anterior deste bloco dizia
*"Na Rampa: asfalto até o pé da serra, barro na subida"*. **A ficha real não tem a palavra
"asfalto" uma única vez** — `barro` é dado do João; a proporção asfalto/barro é invenção. Ela
nasceu aqui, foi pro plano, do plano pro brief, do brief pro `piso.ts` e pro questionário — que
promete no cabeçalho, com todas as letras, que *"todo exemplo abaixo é a resposta real que já
existe pra Rampa do Pepê — não é ficção"*. Quatro arquivos a partir de uma frase deste
documento. **A Rampa entra só como `barro`, justificada pelo que a ficha diz; quem ensina a
regra é um morro inventado e rotulado como tal.**

### 5d. ✅ AS DUAS DECISÕES QUE O JOÃO TOMOU EM 2026-08-21 — não re-litigue

Levei as duas com as saídas na mesa e os números medidos. Ele respondeu:

**1. `A escolha à mão vence`** — sobre o Critical da revisão da branch (o GPS automático apagando
a cidade escolhida). Se `bp.local` tem `tipo === "escolhido"`, o app **não pede GPS sozinho** e a
escolha **não é sobrescrita**. Bate com as palavras dele no review original: *"já ia abrir pegando sua localização, **só modificaria
se o usuário quiser**"* — a escolha manual **é** o "usuário quis". **O GPS automático da Task 1
continua valendo pra quem não escolheu à mão** (`gps`, `nao-sei`, ou nada guardado).

🔴 **ERRO MEU, PEGO PELO IMPLEMENTADOR NO MESMO DIA, e é a assinatura que esta sessão inteira
repetiu.** Eu escrevi aqui, junto do ruling, que *"o caminho de voltar pro GPS continua sendo
tocar na pílula"*. **É FALSO, e ele conferiu em vez de aceitar:** com `local.tipo === "escolhido"`,
o `BuscaLugar.tsx:32` faz `soGps` virar `false`, então **o toque na pílula abre a busca de
cidade** e nunca chama `pedirGps`; o painel só oferece cidades, sem item *"de onde eu estou"*; e o
botão do `DistanciaDaqui` só aparece quando **não há localização nenhuma**. `pedirGps` não tem
outro chamador no repo.

**Ele implementou assim mesmo, e a razão é boa: conferiu o `main` (`f10f075`) e o beco JÁ EXISTE
em produção** — lá a linha é `if (guardado.tipo === "gps") buscarGps()` e o `soGps` é idêntico.
**Quem escolhe uma cidade no app que está no celular dele hoje já fica sem caminho de volta.** O
conserto **restaura a semântica que está no ar**; não cria a armadilha. O que a branch fazia era
*mascarar* a armadilha com um defeito pior — a escolha nem sobrevivia.

🟠 **PENDÊNCIA NOVA PRO JOÃO, e ela é pré-existente, não desta rodada:** o "trocar" da pílula
devolve **só outra cidade**. Falta um *"de onde eu estou"*. O conserto mínimo seria um primeiro
item no painel de busca chamando `pedirGps` quando `gps !== "negado"`. **Ninguém inventou essa
tela** — é decisão dele.

**2. `O filtro segue a tela`** — sobre a divergência do §5c abaixo. O recorte passa a comparar o
número **arredondado, do jeito que a pessoa está vendo**. A regra é *"a pessoa filtra pelo número
que está na tela"*, e ela fecha **os quatro pares** de uma vez (cartão-distância, ficha-distância,
cartão-extensão, ficha-extensão). 🔴 **O jeito certo de fazer é UMA FONTE:** o arredondamento vira
função própria em `geo.ts`, e **tanto o formatador quanto o `passaNoFiltro` chamam ela** — se o
filtro reimplementar o arredondamento à mão, o defeito volta com outra roupa, que é o padrão que
este projeto já pagou três vezes ("km, uma fonte").

### 5c. 🟠 A DIVERGÊNCIA MEDIDA — a tela arredonda, o filtro compara cru (DECIDIDA, ver §5d)

`formatarExtensao(4.04)` mostra **"4 km de trilha"** e `passaNoFiltro(…, extensaoMaxKm: 4)`
devolve **`false`**: o recorte "até 4 km" **esconde um cartão que a tela anuncia como 4 km**. É a
forma exata do que o comentário de `filtros.ts:180-185` chama de *"a pior versão: some sem
explicação"*, e o irmão do "km, uma fonte" da rodada passada — só que lá as duas telas discordavam
entre si, e aqui **a tela discorda do filtro**.

Na extensão a faixa é estreita (`(n, n+0,05]`, ~50 m, e com `EXT_PASSO_KM = 1` o teto é sempre
inteiro). **Mas o gêmeo da DISTÂNCIA já está no ar com faixa muito maior:** `formatarDistancia`
arredonda pra inteiro acima de 10 km → até **0,5 km** de desencontro. **Não é regressão desta
rodada**; a Task 6 só deu o segundo exemplo.

✅ **DECIDIDO por ele em 2026-08-21: `O filtro segue a tela`** — ver o §5d acima.

🔴 **A revisão da branch mediu o tamanho real, e é maior do que a Task 6 tinha visto:**
- **Extensão:** faixa `(n, n+0,05)` ≈ **49 m**, presente em **todo** teto de 1 a 20 (varredura de
  1 m: 980 pontos divergentes).
- **Distância:** pior caso **teto 10, km 10,4495** → a tela diz `~10 km em linha reta` e o filtro
  esconde. Faixa = **0,4495 km (~450 m)**. Abaixo de 10 km cai pra ~50 m.
- 🔴 **E há um TERCEIRO ponto que ninguém tinha listado: a FICHA.** O `DistanciaDaqui` usa a
  **mesma** `formatarDistancia`. O inventário completo é **4 superfícies de exibição** ×
  **2 comparações**: cartão-distância, ficha-distância, cartão-extensão, ficha-extensão.
  **O mapa NÃO é um quinto** — ele não mostra km nenhum (conferido: só `CartaoTrilha`,
  `DistanciaDaqui`, `[slug]/page.tsx` e `filtros.ts` tocam essas funções).

### 5b. 🔴 O QUE A TASK 6 ENCONTROU — confirmado, não redescubra

- **`content/fichas/` tem UMA ficha** (`rampa-do-pepe.json`) e **ela não tem nenhum dos quatro
  campos** (`piso`, `extensaoKm`, `esforco`, `duracao`) — conferido em 2026-08-20. Por isso o
  teste *"a Rampa REAL"* tem que carregar o JSON **pelo loader**, não um fixture parecido: é ele
  que fala de produção.
- **Consequência, e é o que dizer ao João no fim da rodada:** o **cartão em produção não muda uma
  vírgula** nesta rodada. Ele já mostra `~27 km em linha reta · R$ 5` e vai continuar mostrando.
  **O que muda na tela dele é o painel de filtros.** O resto acende quando o questionário voltar.
- **O exemplo do teste tem que ser `asfalto-esburacado`, nunca `barro`:** `rotuloPiso("barro")`
  devolve `"barro"`, então com esse exemplo chamar a função ou usar o campo cru dá a MESMA string
  e a prova é oca. Vale pra Task 6 e pra Task 7.
- **A Task 7 tem uma mutação sem dono** no plano original (o teste *"cartão e ficha mostram o
  MESMO texto de extensão"* não estava na lista). Ele entra, e é de **JUNÇÃO**: os dois
  renderizados com a mesma ficha, comparados **um contra o outro** — não cada um contra um
  literal, porque dois literais iguais escritos à mão são a mesma mentira duas vezes.

### 6. O método, e ele já está autorizado

**SDD com subagentes — o João autorizou nesta rodada** ("pode seguir"). Implementador → revisão
por task com dois veredictos → conserto pelo mesmo implementador → re-revisão escopada →
**revisão da branch inteira no fim, sem exceção** (7ª rodada seguida em que ela é obrigatória).

**A ordem das tasks é 1→8 e ela NÃO é arbitrária: é expandir → migrar → contrair.** A rodada
apaga `esforco` e `duracao`, que têm consumidores em quatro arquivos; apagá-los antes da Task 8
deixa o `tsc` vermelho no meio da rodada. **Não "limpe" os campos velhos cedo.**

### 7. O que a rodada entrega (as palavras dele, no review do iPhone)

1. *"o mapa já ia abrir pegando sua localização"* → GPS automático na 1ª abertura. ✅ **FEITO**
   (Task 1).
2. *"o filtro duração deveria ser distância — cada navegador tem seu ritmo"* → duração **morre**;
   entra tamanho da trilha em km, **só ida**. ✅ **FEITO INTEIRO** (Tasks 2 a 8): o campo, a
   pergunta do questionário, o recorte, a tela, o cartão, a ficha — e a `duracao` **apagada** do
   schema, dos filtros e do `src/lib/duracao.ts`, que deixou de existir.
3. *"com a chegada do esforço, isso deve ser inserido dentro das trilhas"* → piso e extensão
   aparecem na ficha, junto ao Trajeto. ✅ **FEITO** (Task 7) — dentro do bloco 📍 Trajeto, no
   `.wp-body`, com a mesma função de formatação e a mesma ordem do cartão. 🟠 **Nunca visto em
   tela nenhuma:** a prova de aparência não existe e está declarada como inexistente (o jsdom não
   mede) — vai na fila do iPhone.
4. *"o filtro quando selecionado não é possível deselecionar"* → **ele mesmo retirou** e trocou
   por *"melhor o usuário conseguir digitar ou mover uma barra"*. Os dois recortes numéricos
   viram **barra + campo**; o problema do chip morre por construção. ✅ **FEITO** (Tasks 4 e 5) —
   e o chip que sobrou (piso) desliga no segundo toque, com teste.
5. *"esforço podia ser — barro, paralelepípedo, asfalto esburacado, asfalto tapete"* → o
   `esforco` (leve/media/puxada, sobre o corpo) vira **piso da via** (sobre o lugar). ✅ **FEITO
   INTEIRO** (Tasks 2 a 8): o vocabulário (`src/lib/piso.ts`), o campo no schema, a pergunta, o
   recorte, os chips, o cartão, a ficha — e o `esforco` **apagado**, junto do `esforcoSchema` e
   do `type Esforco`.

**A descoberta que reorganizou tudo, e ela vale reler:** a lista dele é vocabulário de estrada, e
a ficha real explica por quê — *"Dá pra ir de carro comum; molhado, o risco é atolar"*, *"não
suba de carro comum; o barro segura água"*. **A Rampa do Pepê é um rolê de carro.** Por isso um
campo sobre o preparo do corpo nunca teve de onde sair: este app só sabe falar de lugar.

### 8. O que continua sendo só dele (não é trabalho da rodada)

- ✅ **`docs/questionario-ficha.md` está PRONTO pra ele responder.** As perguntas do `piso` e da
  `extensaoKm` fecharam na Task 2, com as três armadilhas do §5 resolvidas e travadas por teste.
  **Não há mais razão pra esperar** — antes havia (as perguntas iam mudar).
- 🟠 **PERGUNTA CURTA PRO JOÃO, e ela nasceu do texto novo — não decida sozinho.** A pergunta da
  extensão agora diz, com todas as letras, que se **não se caminha nada** (o rolê é do carro e
  acabou) a resposta certa é **deixar em branco**. Se for esse o caso da Rampa, o filtro de
  tamanho da trilha nasce **inerte** — exatamente o defeito "filtro que não tem como filtrar" já
  registrado nos deferidos, que ele viu no celular e reclamou. *"Na Rampa se caminha? Se o rolê é
  todo de carro, o filtro de tamanho da trilha tem o que filtrar?"*
- **Abrir a home no iPHONE.** As quatro perguntas da §15 da spec anterior continuam abertas
  (pins com folga, barra fixa × faixa de gesto, painel empurrando a lista, piso de zoom 8), mais
  as três novas da §14 da spec desta rodada: a barra arrasta com o polegar? o campo numérico abre
  o teclado certo? o balão de GPS aparece antes ou depois da home pintar? ✅ **As duas primeiras
  JÁ EXISTEM na tela** desde a Task 5 — dá pra abrir e ver.
  🆕 Junto delas, o que as revisões das Tasks 4 e 5 listaram como impossível de medir daqui:
  o trilho de 4px centrado na caixa de 44px; **cada faixa provavelmente quebrando em DUAS linhas**
  em ~360px (barra 55% + campo 4,4rem + a leitura + dois gaps não cabem), e com **duas** faixas o
  painel aberto ficou bem mais alto do que já foi — "Custo" pode nascer longe da dobra; os três
  chips de piso são rótulos de duas palavras num alvo de 36px; e qual teclado o
  `inputMode="numeric"` de fato abre. **Nada disso quebra constante nenhuma** (o orçamento da
  dobra mede a `.filtro-linha`, não o painel aberto, e isso foi conferido) — é rolagem, e ninguém
  nunca viu este painel deste tamanho.

### 9. O resumo do que a sessão de 2026-08-20 fez

Fechou **as Tasks 4 e 5**, cada uma com implementador → revisão com dois veredictos → fix round →
re-revisão escopada. Suíte **588 → 622**. E **pré-voou as oito tasks**: antes só a 2, 3 e 4 tinham
emenda; agora a 5, a 6, a 7 e a 8 também têm, no plano versionado.

**De novo, nenhum fix round consertou lógica de aplicação.** Os doze achados foram de PROVA e de
COMENTÁRIO. O padrão desta rodada está confirmado pela quarta task seguida: o código dos
implementadores chega certo; o que erra é o meu plano e a minha prova.

**Os dois Importants meus da sessão são a mesma frase, escrita duas vezes** — ver o §4: uma
justificando o `step` (*"o `lerFiltros` joga esses valores fora"*) e outra prometendo uma saída
pro filtro fantasma (*"o botão limpar filtros continua sendo a saída"*). As duas falsas, as duas
medidas pelo revisor, as duas corrigidas na nascente antes de qualquer conserto de código. A
primeira já tinha se propagado pra dois arquivos.

**O que os implementadores acharam em cima de mim, e vale registrar porque é mão dupla:** o da
Task 4 pegou uma prova OCA minha (`valor 4` com `min=5` — o elemento prende o 4 em `"5"` e as
duas versões coincidem; com `7` elas se separam) e mediu a razão em vez de deduzi-la.

### 9b. O resumo do que a sessão de 2026-08-19 fez

Retomou na Task 2 (que estava como WIP não revisado) e fechou **as Tasks 2 e 3**, cada uma com
implementador → revisão com dois veredictos → fix round → re-revisão escopada. Suíte **560 → 588**.

**Nenhum fix round consertou lógica de aplicação.** Os quatro fix rounds foram sobre a **prova** e
sobre o **conteúdo do questionário** — o código dos implementadores estava certo nas duas tasks.

**O Critical da sessão foi meu:** o questionário afirmava *"a estrada até o pé da serra é
asfalto"* e *"a maior parte do caminho asfaltada"* sobre a Rampa. **A ficha real não tem a palavra
"asfalto" uma única vez.** A frase nasceu no §5 **deste arquivo**, foi pro plano, do plano pro
brief, do brief pro `piso.ts` e pro questionário — que promete no cabeçalho que todo exemplo é
dado real. **Quatro arquivos a partir de uma frase minha, e um teste já a protegia.** Corrigido
na nascente; ver o §5.

---

## ✅ "O MAPA FILTRA JUNTO" FECHADA E MERGEADA (`dca2a39`)

**Decisão do João**, respondendo à pergunta que a revisão da rodada levantou: *"com filtro
ligado, o mapa esconde os pins junto"*; e, no seguimento, *"filtrou e não sobrou nada → o mapa
mostra só você, na sua vizinhança"*.

**`main` em `dca2a39`. 539 testes em 47 arquivos**, `tsc` limpo, `npm run build` passa — os três
conferidos em `main` depois do merge. 2 tasks, **4 fix rounds**, revisão da branch inteira.
Spec: `docs/superpowers/specs/2026-08-17-mapa-filtra-junto.md` (emenda o §6 da spec anterior).

**Fechou três defeitos de uma raiz só** (o `page.tsx` entregava o acervo inteiro ao mapa enquanto
a folha desenhava as visíveis): pin virando âncora morta, o `.mapa-fora` **afirmando um número
falso** a ~40px de uma contagem que o desmentia, e o enquadramento se abrindo pra caber trilha
que o filtro escondeu. Agora pins, enquadramento e aviso saem da MESMA lista.

**A conta subiu pro `src/app/MioloHome.tsx`** — dono único que alimenta mapa, linha e folha; a
`FolhaTrilhas` parou de calcular e recebe `visiveis`/`confia` por prop. **Um array só, num
escopo léxico só.** O caso vazio ganhou `useRef` do último enquadramento (escrito no render;
hidratação verificada por `renderToString`→`hydrateRoot`, zero mismatch).

**Duas restrições que só a revisão achou e que entraram junto:** o `BuscaLugar` mora dentro do
`MapaHome`, então o vazio **não pode devolver `null`** (quem está sem GPS perderia o único jeito
de dizer onde está); e o vazio ocupa a **mesma altura**, senão a folha salta embaixo do dedo.

🔴 **A LIÇÃO DESTA RODADA, e ela é nova:** **nenhum defeito de CÓDIGO escapou das revisões de
task. Os nove achados foram COMENTÁRIOS que prometiam proteção não medida** — três no mesmo
arquivo, e um custou um fix round inteiro. O padrão, nomeado pelo próprio implementador: *"escrevo
a proteção que o raciocínio PREVÊ em vez da que a execução MOSTROU"*. **Comentário mentiroso é a
única coisa aqui que se propaga sozinha** — o próximo leitor confia nele em vez de medir. Virou
regra de despacho: *se não der pra pôr uma prova rodada atrás da frase, escreva menos.*

**Corolário medido:** não existe guarda de FONTE que feche reimplementação. O guarda de nomes é
cinto contra apelido e renomeação; contra lógica copiada à mão só o **teste de tela** funciona —
provado furando o guarda de duas formas (índice computado e cópia à mão), com o teste de
comportamento pegando as duas.

## ✅ RODADA "DE ONDE EU ESTOU" FECHADA E MERGEADA — 12/12

**`main` em `6f37bbb`** (a rodada em `ce40307`, mais o fecho do débito da régua) (merge `--no-ff` de `daqui-e-filtros`, que ficou em `a6f2f45`).
**523 testes em 46 arquivos**, `npx tsc --noEmit` limpo, `npm run build` passa — os três
conferidos **em `main` depois do merge**, não só na branch. Árvore limpa.
**Nada em voo:** nenhum agente rodando, nenhum fix round aberto.

**12 tasks SDD**, cada uma com implementador → revisão com dois veredictos → fix round →
re-revisão escopada, mais **revisão da branch inteira** e **quatro fix rounds** depois dela.
A suíte foi de **278 → 523**.

### ✅ DEPLOY: FEITO. E O JEITO DE FAZER ESTÁ AQUI — eu já errei isto uma vez.

🔴 **ERRO MEU, corrigido em 2026-08-17, e vale mais que o procedimento:** eu escrevi neste
arquivo que *"não dá pra deployar deste ambiente"*, porque conferi **`git remote -v`** (vazio) e
a **CLI global** (ausente) e parei aí. **O João me corrigiu: "quem estava fazendo deploy era tu."**
Ele estava certo — o caminho existia o tempo todo e eu não olhei:

```bash
npx --yes vercel@latest --prod --yes      # o projeto já está linkado e a sessão autenticada
```

- **`.vercel/project.json` existe** (`bate-perna/bateperna`) — o diretório está linkado.
- **A sessão está autenticada** (`npx vercel whoami` → `joaoricardoagostinho285-1392`).
- **`git remote` é irrelevante**: o deploy sobe os arquivos, não usa git.
- Se a primeira tentativa der `fetch failed`, **é transitório — repetir resolve** (aconteceu).
- Conferir depois: `npx vercel ls` (a linha de cima tem que ser `Production ● Ready`) e `curl` na
  home procurando marcadores da rodada.

**A moral é a mesma que esta sessão inteira martelou, e desta vez o texto mentiroso era MEU:**
conclusão negativa escrita no registro (*"não dá"*) orienta todas as sessões seguintes e ninguém
a remede. **Antes de escrever "não dá", esgotar os caminhos** — aqui faltou olhar `.vercel/` e
`npx`.

---

## ▶ O que ficou aberto (lista pra triagem do review)

As duas rodadas acabaram e **estão NO AR** (deploy conferido: `Production ● Ready`, e a home
servindo `FILTRAR`, `filtro-linha`, `Ver daqui`, `mapa-pilula`, mais o CSS com `--goteira-esq`,
`position:fixed`, `--barra-h`). **Não há task pendente.** O que está na mesa:

1. ~~Descobrir como deployar~~ — **resolvido, e o comando está na seção acima.**
2. **A pergunta que sobrou** (a do mapa **ele já respondeu** — ver o topo):
   - **filtro que não tem como filtrar** — a linha diz "2 filtros ligados" e nada muda, porque
     nenhuma ficha tem esforço/duração. É **100% do app** enquanto o questionário não voltar.
   - 🆕 **O caso vazio é alcançável com UM toque em produção**, e ele nunca o viu: a única ficha
     real é **paga**, então "só grátis" zera a home. Sem GPS ele verá o mapa da região da Rampa
     **sem pin nenhum** + "0 trilhas · 1 filtro ligado" + o aviso e o botão de limpar; com GPS,
     o mapa recentra nele a ~27 km. **Os dois estados estão corretos pela spec e nenhum foi
     visto em WebKit.**
   - 🆕 **Deferido novo, e ele chega junto com a 2ª ficha:** o piso de zoom
     (`ZOOM_MINIMO_HOME_COM_VOCE = 8`) **só se aplica quando há `voce`**. Sem localização,
     `enquadrar` desce até `ZOOM_MINIMO = 2` — com uma 2ª ficha distante (Rampa + São Paulo,
     medido) o primeiro render nasce em **z=3, ~6.597 km de largura**, e é esse quadro que o
     `ultimo.current` passa a **congelar** quando o filtro zera. Não é regressão desta rodada,
     mas ela transforma um quadro transitório em persistente. Saída barata: o mesmo piso, também
     sem `voce`.
   - 🆕 **Minor de honestidade, herdado de `main`:** no mapa vazio o `role="img"` mantém
     `aria-label="Mapa com as trilhas de hoje"` sobre um mapa com **zero** trilhas — rótulo
     afirmando o que não está lá, a mesma família de "informar, não afirmar" que o app persegue.
     Nada desta rodada o tocou; ela só tornou o estado alcançável.
3. **O iPhone**, que continua sem nenhuma medição possível daqui (§15 da spec, 4 perguntas).

E as pendências antigas dele seguem: **responder `docs/questionario-ficha.md`** (a 2ª ficha
destrava as fatias 2 e 3 — e **dois** achados desta rodada são invisíveis com uma ficha só) e
**esforço/duração da Rampa**.

---

<details>
<summary>O bloco de retomada da rodada anterior (histórico — a rodada fechou)</summary>

---

## ▶ SE O JOÃO DISSER SÓ "CONTINUA" — comece por aqui, sem perguntar nada antes

**O jeito dele de retomar é essa palavra só.** Não devolva menu nem peça contexto. Ele já disse
o que quer nesta rodada; a pauta está cravada. **Não repita a pergunta "o que faltou"** — ela já
foi respondida (é o §1 da spec).

1. **Confira o chão em silêncio** (sem narrar):
   - `git branch --show-current` → deve ser **`daqui-e-filtros`**. Se estiver em `main`, é só
     trocar; a branch existe e tem os commits.
   - `git status --short` → **limpo**.
   - `git log --oneline 8c88415..HEAD` → os commits da rodada.
   - `npm test` → **426/426** e **`npm run build` → passa** (os dois conferidos no fim da sessão).
     **Rode os DOIS.** Ver a lição 9 — o build já esteve quebrado por quatro commits com a
     suíte inteira verde.

2. **Leia o ledger:** `.superpowers/sdd/2026-08-13-daqui-e-filtros/progress.md`. Ele é a memória
   da execução — tem a varredura de pré-voo, o ruling da ordem, e o estado de cada task. **Se ele
   tiver sumido** (`git clean`), reconstrua pelo `git log` e por este arquivo.

   **Os briefs das tasks que faltam NÃO dependem dele.** Estão versionados em
   `docs/superpowers/briefs/` (com um `README.md` explicando o estado do pré-voo de cada uma),
   justamente porque as emendas do pré-voo são trabalho real e sumiriam com um `git clean`.

3. **Tasks 1 a 8 estão FECHADAS. Não as reabra.** A Task 2 custou dois fix rounds, os dois
   pela mesma causa (guard sem prova de mutação), e a segunda re-revisão devolveu ADDRESSED
   depois de rodar a mutação ela mesma. Fica o precedente, porque ele decide discussões
   futuras: o implementador argumentou que um guard não precisava de teste próprio porque
   "é o mesmo padrão já provado em outro caminho"; **a re-revisão removeu o guard, viu a
   suíte ficar 12/12 verde, e o argumento caiu.** A régua deste projeto é literal — *apagar
   a linha faz um teste falhar* — e não "existe prova parecida em outro lugar".

   **Precedente irmão, da Task 3:** um Important pode ser real e mesmo assim **não abrir fix
   round**, quando não há linha a consertar naquela camada. A revisão da Task 3 mostrou que
   nada em `tests/lib/mapa.test.ts` distingue a janela visível (350,5) da caixa de geração
   (480) — mas as funções recebem a largura como argumento, então isso é **improvável de
   provar na camada pura**. O achado foi transferido pra Task 4, onde virou teste que morde.
   **Quando transferir um achado assim, registre o ruling** em vez de deixá-lo sumir.

4. **Retome a execução em `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md`**, da **Task 9**
   em diante. As 7 e 8 já saíram (o ruling mandava 8 antes de 7). Faltam **9, 10, 11 e 12**. **A ordem de execução tem um ruling e NÃO é a numeração:**

   > **1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12**

   O ruling existia porque a Task 7 escreve `ficha.esforco`/`ficha.duracao`, que só nascem no
   schema na Task 8 — na ordem escrita o `tsc` quebrava. **Isso já passou:** de 9 a 12 a ordem
   é a numérica.

   **Os briefs de 9 a 12 estão em `docs/superpowers/briefs/`** (versionados). O
   `README.md` de lá diz, task a task, o que o pré-voo já emendou e o que falta — comece por
   ele. A cópia em `.superpowers/sdd/.../task-N-brief.md` é a mesma coisa, mas é scratch.

5. **Método: SDD com subagentes, e o João já autorizou nesta rodada** (ele escolheu a opção 1
   quando ofereci). Implementador → revisão por task com dois veredictos → conserto pelo mesmo
   implementador → re-revisão escopada → **revisão da branch inteira no fim, sem exceção.**

   **A Task 9 já tem meio pré-voo feito** — o detalhe completo está em
   `docs/superpowers/briefs/README.md`. Em resumo, o brief já recebeu:
   - **A BORDA — era furo de ESPECIFICAÇÃO, não de teste.** "até 2h" com uma trilha de
     exatamente 120min: passa ou não? Eu só tinha dado 90 e 300, e dois implementadores
     razoáveis decidiriam diferente. **CRAVADO: o teto é INCLUSIVO nos dois recortes**
     (duração e distância) — é como se lê em português, e o contrário esconde justamente o
     caso que a pessoa tinha em mente. Testes de 120/121 já escritos.
   - O degrau de 240 (só o 120 era exercitado) e as três palavras de esforço uma a uma.

   **O que FALTA pré-voar na Task 9** (varrido, ainda NÃO escrito no brief):
   1. **`contarLigados` conta 5 recortes e o teste só prova 3** — apagar `esforco` e
      `duracaoMax` do array continua devolvendo 3. Falta o caso com os cinco ligados.
   2. **`lerFiltros` valida 5 campos, e o teste prova em bloco, não campo a campo** — mesma
      família do OU. `lerFiltros({soGratis: "sim"})` deve virar `false` e nada prova isso.
   3. **A borda da DISTÂNCIA** (o teste novo cobre a da duração; falta o par exato de 30 km).
   4. Conferir se `confia: false` deixa os OUTROS recortes funcionando — hoje só se prova que
      ele torna o `daHoje` inerte.

   (Nada disso se perde num `git clean`: o brief emendado está versionado em
   `docs/superpowers/briefs/task-9-filtros-puros.md`.)

6. **A lição que as duas primeiras tasks já ensinaram, e que muda os briefs seguintes:** os
   implementadores estão **acertando o código e errando onde o meu plano deixou o teste fraco**.
   Task 1 teve 4 Important, Task 2 teve 1 — **todos rotulados plan-mandated**, todos da mesma
   família: um guard ou uma regra sem teste que o prove. **Antes de despachar cada task, releia a
   lista de testes do brief perguntando "que linha do código eu posso apagar sem isto falhar?"** e
   mande o complemento junto no despacho.

   **Isso virou rotina em 2026-08-14 e paga sozinho.** Os briefs das Tasks 3, 4 e 5 já foram
   emendados no disco (`.superpowers/sdd/.../task-N-brief.md`) antes de qualquer despacho, e o
   pré-voo achou **onze furos meus**. A forma que mais se repete: **um `if` que é um OU de
   várias sub-cláusulas, com um teste só — e num OU a cláusula que dispara primeiro esconde
   todas as outras.** Aconteceu duas vezes:
   - `foraDaJanela` (Task 3): as trilhas "longe" dos meus testes caíam a oeste **e** ao sul, e
     3 das 4 bordas podiam ser apagadas com a suíte verde.
   - `lerLugares` (Task 5): o meu item de teste vinha sem latitude **e** sem longitude, e 4 das
     5 cláusulas de descarte ficavam sem prova. Pior: `typeof NaN === "number"`, então os dois
     `Number.isFinite` eram os únicos capazes de pegar NaN — o caso que o comentário da
     implementação promete tratar.

   **O achado mais grave do pré-voo até agora** (Task 5): a rota `/api/lugares` devolveria
   **200 com lista vazia** quando o serviço respondesse 429 ou 500 com corpo JSON — meu único
   teste de falha cobria o `fetch` *rejeitando*, não o serviço *respondendo mal*. A tela diria
   "não achei essa cidade" quando a verdade é "estourei a cota", e a pessoa reescreveria o nome
   dez vezes achando que digitou errado. O geocoding da Open-Meteo tem cota; não é hipótese.

   **Duas outras formas que o pré-voo pega e a revisão de task não pega**, porque o jsdom não
   as enxerga (Task 4): apagar o `"use client"` do `MapaHome` deixa a suíte inteira verde e o
   mapa parado no celular — o jsdom renderiza tudo como cliente; e esquecer o `<LocalVivo>` no
   `page.tsx` também deixa tudo verde, porque os testes embrulham na mão. Nos dois casos a
   prova é asserção de fonte / render do ponto de uso real.

   **Quarta forma, do pré-voo da Task 6: o que só aparece com o RELÓGIO.** A espera de
   digitação (`ESPERA_MS`) e o guarda da corrida (`meu === pedido.current`) tinham comentário
   justificando e zero teste. Os outros testes usam `findByText`, que espera até 1000ms — por
   isso não percebem se a busca dispara a cada tecla; e nenhum deles tinha **duas requisições
   em voo**, que é a única situação em que o guarda faz algo. Sem ele, a resposta de "Gravatá"
   chegando depois da de "Recife" repinta a lista com o lugar errado, e a pessoa toca no que
   está na tela achando que é o que pediu. **Guarda de concorrência exige relógio falso e duas
   respostas fora de ordem; não há atalho.**

   **E um erro meu que quase virou teste inútil, pego relendo o que eu tinha acabado de
   escrever:** a asserção do teste de corrida olhava `/Pernambuco/` — mas Recife e Gravatá são
   **as duas** de Pernambuco, então ela passaria com qualquer uma na tela. **Num teste que
   distingue A de B, asserte no que os diferencia**, não num campo que os dois compartilham.

</details>

## O que esta rodada fez (a pauta do João, dita por ele) — TUDO ENTREGUE

Ao ver a home no ar, ele disse **"ficou legal, mas ainda faltou mais coisa"**. Na sessão seguinte
disse o quê — três coisas:

1. **O mapa deve ser da localização dele**; sem sinal, poder escolher onde está; e daí calcular as
   distâncias, **que também aparecem nos cartões**.
2. **Faltaram os filtros na tela de hoje.**
3. **A barra do menu deveria estar fixa no fim do aparelho** — "não vi isso". (Confirmado no
   código: ela estava em fluxo normal.)

**Spec:** `docs/superpowers/specs/2026-08-13-daqui-e-filtros-design.md` (aprovada por ele)
**Plano:** `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md` (12 tasks, aprovado)

### As decisões que ele tomou no brainstorm (não reabrir)

| Tema | Decisão |
|---|---|
| Pedido de GPS | **Um toque na primeira vez** ("Ver daqui"), automático depois. Nunca sozinho na abertura. |
| O que o mapa enquadra | **Você e todas as trilhas juntos**, com piso de legibilidade (zoom 8). |
| Sem GPS | **Digitar a cidade e escolher na lista.** O app guarda. |
| Recortes | Distância, "dá hoje", custo, **esforço e duração** (campos novos). |
| Forma do filtro | **Uma linha de resumo que abre um painel**, não chips permanentes. |
| De onde o painel abre | **Desce da linha e empurra a lista** (sanfona), não cortina por cima do mapa. |

O "piscar" (a home abre sem você e num instante se reenquadra com você) **ele viu desenhado e
disse que não incomoda**. É consequência inevitável da regra do primeiro render.

## Onde a rodada parou, commit a commit

| Task | Estado | Commits |
|---|---|---|
| 1 — localização pura (`src/lib/local.ts`) | **completa, revisão limpa** | `f07da0c`, `ecc0fc9` |
| 2 — contexto (`src/app/local.tsx`) | **completa**, 2 fix rounds, re-revisão limpa | `e4dbae2`, `ee28635`, `86e9658` |
| 3 — enquadrar com você (`src/lib/mapa.ts`) | **completa**, revisão Approved with comments | `6ae990a` |
| 4 — o mapa da home usa a localização | **completa**, 1 fix round, revisão **Approved** | `34f74bb`, `2feae91` |
| 5 — busca de cidade (lib + rota) | **completa**, 1 fix round, re-revisão limpa | `c1257ed`, `c1f01d4` |
| 6 — a pílula e a busca de cidade | **completa**, 2 fix rounds, re-revisão limpa | `2d48df0`, `280683e`, `fcb5875` |
| 8 — `esforco`/`duracao` no schema + questionário | **completa**, revisão limpa, zero fix rounds | `5d2f817` |
| 7 — km/duração/esforço/custo no cartão + invariante da ficha | **completa**, 2 fix rounds, re-revisão limpa | `ed4b38e`, `318231e`, `b7cb153`, `ff217df` |
| 9 — filtros puros (`src/lib/filtros.ts`) | **completa**, 1 fix round, re-revisão ADDRESSED | `5cf567e`, `481a57f` |
| 10 — a linha e o painel sanfona | **completa**, 1 fix round, re-revisão ADDRESSED | `9a4e0f5`, `ab6ce1c` |
| 11 — filtro e agrupamento na mesma passada | **completa**, 1 fix round, re-revisão ADDRESSED | `97c228d`, `dea695d` |
| 12 — a barra fixa no rodapé | **completa**, 2 fix rounds, re-revisão ADDRESSED | `d5a8a76`, `e4c6ad4`, `a674bc4` |
| **revisão da BRANCH INTEIRA** | **4 fix rounds depois dela** | `60d8e9e`, `9ec60b2`, `8be3c50`, `490095f`, `22d7347`, `a6d15d9`, `a6f2f45` |

Suíte: **523/523 em 46 arquivos** (a base da rodada era 278). `tsc` limpo, **`npm run build`
passa**. Merge em `main`: **`ce40307`** (`--no-ff`).

**Os briefs das Tasks 9–12, já pré-voados, estão versionados** em `docs/superpowers/briefs/`
(com um `README.md` que registra, task a task, o que o pré-voo achou e os rulings). Não se
perdem num `git clean`.

## O que a revisão da branch inteira pegou (5ª rodada seguida que ela paga)

Todas as 12 tasks tinham sido revisadas individualmente, com prova de mutação, e todas passaram.

**Important 1 — a mesma trilha tinha DOIS km.** `CartaoTrilha` e `filtros.ts` mediam até
`ficha.condicao.coords` (o ponto do clima, onde o pin é plantado); a ficha media até
`trajeto.waypoints[0]`. Reproduzido: **cartão anunciando ~89 km e a ficha da mesma trilha ~40
km**, e "até 60 km" escondendo uma trilha cujo portão está a 40. **Invisível só porque a única
ficha real tem os dois pontos iguais — chega junto com a segunda ficha.**
**Conserto:** `coordDaDistancia(ficha)` em `src/lib/geo.ts`, uma função só, chamada pelos três.
**O waypoint venceu porque é o que o botão "Abrir no mapa" abre** — medir por outro faria o app
dizer "40 km" e mandar a pessoa pra outro lugar. E o `DistanciaDaqui` passou a receber a **ficha**
em vez de `lat`/`lng`, pra a fonte ser única por **estrutura**, não por convenção. O pin do mapa
continua em `condicao.coords` (é o ponto do clima; o questionário documenta as duas).

**Important 2 — o mapa (não filtrado) contradiz a folha (filtrada).** Virou pergunta pro João,
detalhada nos deferidos.

**E a família de asserção frouxa em CSS: TREZE frestas fechadas, treze medidas VIVAS antes do
conserto** (nenhuma consertada por "parecer frouxa"), mais **uma registrada como débito**. Ver a
lição 23.

## Invariantes que não podem ser quebradas

Herdadas e ainda valendo:

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Depende de `force-dynamic` na
  home e na ficha. Vale pro mosaico do mapa também.
- **`useVenceu` devolve `false` no primeiro render, sempre.**
- **Uma trilha, uma fonte.** Cartão, selo, pin, cabeçalho do grupo — e agora o km. Sexta porta.
- **A regra de CSS da fase carrega `[data-state]` junto**, senão perde de especificidade e
  "SEM INFORMAÇÕES" sai em selo verde. Vale pro `.selo` e pro `.pin-home`.
- **Sem leitura o app INFORMA, não manda:** `SEM INFORMAÇÕES · tome cuidado`.
- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.**
- **Tudo ou nada no clima:** falha na busca → nenhuma trilha recebe carimbo.
- **A série de clima prova de que coordenada veio**; **slug repetido estoura no carregamento.**
- **Nenhuma URL de trilha responde com o corpo de outra**, online ou offline.
- **Sem `next/link`.** Âncora pura. **`© OpenStreetMap`** em todo mapa (ODbL).

Novas desta rodada:

- **Primeiro render sem localização e sem filtro, SEMPRE**, mesmo com dado guardado. Mesma razão
  do `useVenceu`: a home chega do cache do service worker com HTML velho.
- **Uma pessoa, uma fonte:** mapa, cartão e filtro leem a MESMA localização. Nada mais no app pode
  chamar `navigator.geolocation` por conta própria — o `DistanciaDaqui` da ficha ainda chama, e a
  Task 7 é quem o migra.
- **Não inventar geografia.** Nome de cidade só quando o serviço devolveu (o GPS não devolve nome,
  por isso a pílula diz só "daqui"). `esforco`/`duracao` só quando o João disser — por isso são
  **opcionais** no schema.
- **"em linha reta" não é droppável** em nenhum texto de distância.

## Deferidos vivos (registrados, nenhum bloqueia)

### 🔴 A TERCEIRA FAMÍLIA DA ASSERÇÃO FROUXA EM CSS — "duplicata por cascata"

**Débito escrito de propósito, com decisão: a rodada foi mergeada sabendo dele.** As duas
primeiras famílias (o decoy `--`/`max-` na camada de LAYOUT, e o valor-solto-no-bloco na de
PINTURA) foram fechadas — 13 frestas, todas medidas vivas antes do conserto. Esta é a terceira,
e ela é de outra forma.

**A forma:** todo leitor de CSS da suíte passa por `regraDe` (`tests/css.ts`), que usa `match`
**sem `/g`** e devolve a **PRIMEIRA** regra que casa o seletor. O navegador usa a **ÚLTIMA**.
Uma regra duplicada mais abaixo no arquivo vence a cascata e a suíte inteira não vê.

**Exemplo MEDIDO** (2026-08-16): acrescentando ao fim do `home.css`

```css
.bp .folha { padding: 0; }
.bp .mapa-home { height: 40px; }
```

a suíte fecha **523/523 VERDE**. No navegador: o último cartão volta pra trás da barra fixa (o
defeito que a Task 12 existe pra matar) e o mapa da home colapsa pra 40px, com
`MAPA_ALTURA_HOME_PX = 168` e todo o orçamento da dobra virando ficção.

⚠️ **E há um comentário HOJE ERRADO no repo por causa disto**, já corrigido em
`tests/app/BarraNavegacao.test.tsx`: ele afirmava que uma segunda regra `.bp .folha` mais abaixo
"deixaria este teste vermelho, o que é o certo". Não deixa. Foi medido.

**Custo estimado de fechar:** pequeno em código, médio em verificação. É **uma função** —
`regraDe` passa a varrer com `/g`, devolver a ÚLTIMA e/ou falhar quando houver mais de uma regra
com o seletor EXATO (cuidado: `.bp .cartao` e `.bp .cartao:active` são seletores diferentes e
ambos legítimos; o alvo é a duplicata exata). Como todas as asserções de CSS passam por ela, a
lição 20 obriga a **re-rodar as ~15 provas de mutação** que ela carrega hoje.

**Por que não foi fechada agora:** a camada de layout e a de pintura protegem defeitos que este
app **já teve de verdade**; esta protege um que ele nunca teve. Não valia segurar uma rodada de
12 tasks e 523 testes. Mas débito registrado é decisão, e débito esquecido é acidente.

**Padrão que fica:** cada varredura desta rodada achou mais que a anterior (3 → 8 → 5 → 1 de
outra forma). Não é varredura ruim: **a régua só encontra o que ela sabe perguntar**, e cada
âncora nova revela a fresta seguinte. Isso não converge sozinho — por isso o critério de parada
passou a ser explícito ("feche o que protege defeito real, registre o resto"), e não "varra até
não achar mais".

---

Desta rodada (estão no ledger, o revisor final vai triar):

- `src/lib/local.ts:53-54` — limites 90/180 sem comentário de derivação.
- `src/app/local.tsx` — os dois `Provider` recebem objeto literal novo a cada render.
- Sem de-dupe de `pedirGps()` em toque duplo.
- `src/app/page.tsx` — `Object.fromEntries(leituras)` computado duas vezes (desperdício; nenhum
  consumidor depende de identidade referencial).
- `.voce-pin` sem `aria-hidden` explícito (vive dentro do `role="img"` que já existia).
- Falta um `it("sem localização, a ficha mostra o BOTÃO")` renderizando `[slug]/page.tsx` de
  verdade. Hoje o caso oposto é coberto indiretamente (estrutura do componente + duas
  mutações), mas não por asserção explícita no ponto de uso.
- O comentário do `route.ts` afirma que o prazo da busca é menor que o `PRAZO_CLIMA_MS` e
  **essa relação não tem teste**, embora o padrão exista (`weather.test.ts` testa
  `PRAZO_CLIMA_MS < PRAZO_REDE_MS`). A constante virou `PRAZO_BUSCA_MS` em `src/lib/lugares.ts`.
- `src/app/api/lugares/route.ts` — o comentário afirma que `PRAZO_MS` é menor que
  `PRAZO_CLIMA_MS` e **essa relação não tem teste**, embora o padrão já exista na suíte
  (`tests/lib/weather.test.ts:168-171` testa `PRAZO_CLIMA_MS < PRAZO_REDE_MS` pelo mesmo
  motivo). Barato e idiomático — achado da re-revisão da Task 5, fora do escopo dela.
- **Higiene de mock em `tests/lib/filtros.test.ts`** (achado da re-revisão da Task 9, Minor). O
  arquivo tem um espião de módulo (`vi.mock("@/lib/geo")` delegando pro real) e a config não tem
  cinto: `vitest.config.ts` está com `setupFiles: []` e sem `clearMocks`. Provado pelo revisor:
  um futuro `mockReturnValue` **sem** `Once` vaza em silêncio pros testes seguintes do arquivo e
  **nada** cai — hoje não morde porque o `Once` é consumido e a 2ª asserção do teste é rede.
  🔴 **Os DOIS remédios óbvios estão errados, e eu medi os dois** (arquivos de scratch, apagados):
  `clearMocks: true` **não cura** — `mockClear` não remove implementação, que é o mesmo motivo
  pelo qual o revisor o achou seguro; e `mockReset()` **quebra a delegação** — neste vitest
  (2.1.9) ele reseta pra função vazia, não pra impl passada em `vi.fn(impl)` (`expected undefined
  to be 2`). O remédio certo é restaurar explicitamente
  (`afterEach(() => vi.mocked(distanciaKm).mockImplementation(real))`, com o real vindo de
  `vi.importActual`), e isso é máquina demais pra um risco que hoje não morde. **Deferido de
  propósito, com a medição registrada** — o revisor final decide.
- ✅ **FECHADO em 2026-08-16** (`da408e9`, mergeado em `6f37bbb`) — era o débito abaixo, a
  *terceira* família. **Reproduzido antes de mexer** (523/523 verde com o defeito no arquivo),
  morto depois com **duas** asserções nomeadas. O `regraDe` passou a juntar TODAS as regras do
  seletor na ordem do arquivo e o `valorDe` a ler a **ÚLTIMA** declaração — que é a cascata de
  verdade: uma segunda regra sobrescreve **as propriedades que declara**, não a regra inteira.
  **Lição 20 aplicada: as nove provas que a régua carrega foram RE-RODADAS uma a uma** (decoy de
  prefixo, decoy de propriedade customizada, lado do shorthand, `.bp` anulando goteira de outro
  arquivo, área segura, cor do pin, alvo de toque). Nenhuma esvaziou. **E o comentário que estava
  no `regraDe` afirmava o CONTRÁRIO** — que uma segunda regra deixaria o teste vermelho, "o que é
  o certo". Terceiro comentário mentiroso desta rodada; o padrão está na lição 23.
  <details><summary>o débito, como estava registrado</summary>

  **`regraDe` usa `match` sem `/g` e devolve a PRIMEIRA regra; o
  navegador usa a ÚLTIMA.** Anexando ao fim do `home.css` `\.bp .folha { padding: 0 }` e
  `.bp .mapa-home { height: 40px }`, a suíte fecha **523/523 verde** — e no navegador o último
  cartão volta pra trás da barra fixa e o mapa da home colapsa pra 40px, com
  `MAPA_ALTURA_HOME_PX = 168` e o orçamento da dobra inteiro virando ficção. **Custo de fechar:**
  pequeno em código (varrer com `/g`, devolver a última e/ou falhar em duplicata de seletor
  exato, sem confundir `.bp .cartao` com `.bp .cartao:active`), **médio em verificação** — a
  lição 20 obriga re-rodar as ~15 provas que o `regraDe` carrega. **Não consertado de propósito:
  a rodada parou aqui por critério de parada explícito.** Junto disso foi corrigido um comentário
  do `BarraNavegacao.test.tsx` que afirmava o CONTRÁRIO (que uma segunda regra deixaria o teste
  vermelho) — comentário errado é pior que a fresta, porque o próximo leitor confia nele.
  </details>
- 🟠 **PERGUNTA CURTA PRO JOÃO — filtro que não tem como filtrar.** Medido na home real: ligar
  "leve" e "até 2h" leva a linha a dizer **"1 trilha · 2 filtros ligados"** com a lista
  **idêntica** e nenhuma palavra na tela explicando. Está **correto** pela regra de honestidade 2
  (nenhuma ficha tem esforço/duração, nenhuma pode ser escondida), mas é **100% do app** enquanto
  o questionário não voltar respondido. *"Filtro que não tem como filtrar — a linha diz alguma
  coisa, ou fica calada?"* Irmão hoje inalcançável: o `contarLigados` conta `distanciaKm` mesmo
  quando o painel esconde o grupo Distância por falta de localização — a pessoa veria "1 filtro
  ligado" sem nenhum controle pra desligar.
- 🟠 **PERGUNTA CURTA PRO JOÃO, e é comportamento NOVO da Task 11** (achado da revisão dela,
  Important, plan-mandated). **Com um filtro ligado, o pin de uma trilha escondida vira âncora
  morta.** O `PinTrilha` é `<a href="#slug">` (`src/app/PinTrilha.tsx:38`) apontando pro
  `id={ficha.slug}` do cartão (`CartaoTrilha.tsx:57`), e o `MapaHome` recebe `fichas={fichas}` —
  **o acervo inteiro, sem filtro** (`page.tsx:58`) — enquanto a folha agora desenha só
  `visiveis`. Tocar o pin não faz nada; no extremo, a folha diz "Nenhuma trilha com esses
  filtros" com o mapa cheio de pins, todos mortos. Antes da Task 11 nada era escondido, então
  todo pin tinha alvo. **Não é a família do Critical antigo** (não há afirmação falsa sobre
  segurança), mas é a mesma FORMA: recortar num lugar e mostrar em outro. A §6 da spec diz que o
  mapa enquadra "você e **todas** as trilhas" — o conflito é com uma decisão dele, por isso não
  decido sozinho. *"Com um filtro ligado, o mapa esconde os pins junto, apaga o toque deles, ou
  deixa como está?"* **Nenhuma task da rodada cobre isto.**
- **Estado vazio com acervo vazio e nenhum filtro ligado** (Minor da mesma revisão): a folha
  diria "Nenhuma trilha com esses filtros" **sem filtro nenhum**, e a linha acima diria "0
  trilhas" SEM o sufixo "· 1 filtro ligado" — a tela se contradiz. Hoje **inalcançável** (sempre
  há ≥1 ficha). Deferido de propósito, com comentário no código apontando a condição que o torna
  alcançável. Saída barata, se um dia: `visiveis.length === 0 && contarLigados(filtros) > 0`.
- **DECISÃO DE PRODUTO pendente, não é só limpeza:** `enquadrarComVoce([], voce, ...)` devolve
  zoom 11 (~26 km), enquanto uma trilha só, longe demais, cai no piso de zoom 8 (~212 km) —
  zero trilhas fica **mais apertado** que uma trilha distante. Assimetria herdada de reusar o
  `enquadrar`, que ninguém decidiu. Hoje é inalcançável, **mas as tasks de filtro desta mesma
  rodada podem zerar a lista.** Decidir de propósito ao pré-voar a task de filtro; se for
  pergunta pro João, é curta: *"filtrou e não sobrou nada — o mapa mostra a sua vizinhança ou
  a região toda?"*

(O `beforeEach` morto em `tests/app/local.test.tsx` saiu no fix round 1/5 da Task 2.)

Herdados:

- `useVenceu` duplica o relógio do `Carimbo.tsx`.
- `home.css` não tem a regra neutra de `data-fase="conferindo"` que o `ficha.css` tem.
- `HomeViva` usa `!== "hidden"` e `Carimbo` usa `=== "visible"`; nenhum teste cobre aba oculta.
- Cookie `bp_ultima` órfão até 1 ano nos celulares que já usavam o app.
- `ensureSchema` (`src/lib/db.ts`) declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte.
- Deploy no meio com a página aberta: chunks somem, o JS morre, a tela congela.
- A home não tem `<h1>`; sem `:focus-visible` em `.cartao`, `.pin-home`, `.barra-item`.
- A folha não sobrepõe a base do mapa como a spec da rodada anterior pedia.

## Lições que valem além desta rodada

1. **Teste de mutação decide qualquer discussão sobre teste.** Apague a linha, veja falhar,
   devolva, cole a saída. Esta suíte já produziu **nove** testes que passavam com o código
   apagado — e as revisões desta rodada já pegaram mais seis lacunas do mesmo tipo.
   **Corolário fechado em 2026-08-14:** "existe um teste parecido em outro caminho de código"
   **não é prova**. O implementador da Task 2 usou esse argumento pra pular um guard; a
   re-revisão apagou o guard, viu 12/12 verde, e o argumento morreu. A régua é literal.
2. **Mutação sub-cláusula a sub-cláusula, não a linha inteira.** Apagar a linha toda "provou" um
   `ehCoord` e deixou passar um `em` sem teste nenhum. **E cuidado especial com `if` que é um
   OU:** a cláusula que dispara primeiro esconde todas as outras, então o caso de teste tem
   que falhar em UMA coisa só. Dois briefs meus desta rodada caíram nisso.
3. **Aponte o teste pro PONTO DE USO**, não pro arquivo de nome parecido.
4. **Para artefato que vira entrada de outra coisa, a prova é USÁ-LO** (o questionário: responder
   e rodar o JSON contra o schema).
5. **Nenhum teste desta suíte mede geometria renderizada.** Se um número de pixel importa, medir
   em navegador é a única prova. "Parece certo" não é resposta; "não medi" é.
   **Corolário provado em 2026-08-14: o jsdom também não enxerga server vs client.** Apagar o
   `"use client"` do `MapaHome` deixa **26 dos 27** testes verdes — inclusive os que exercitam
   a localização de ponta a ponta — porque o jsdom renderiza tudo como cliente. Só a asserção
   de FONTE (ler o arquivo e conferir a primeira linha) acusa. Mesma coisa com o `<LocalVivo>`
   do `page.tsx`: tirá-lo deixa os 16 testes do `MapaHome.test.tsx` verdes, porque eles
   embrulham o provedor na mão. **Para o que o jsdom não vê, a prova é asserção de fonte ou
   render do ponto de uso real** — e esses testes "feios" são os que separam "passou" de
   "funciona no celular".
6. **Mandar o implementador PARAR quando a mutação não morde funciona — e duas vezes nesta
   rodada o erro era meu, não dele.** Na Task 4 ele provou com teste-sonda que uma mutação do
   meu brief não derrubava nada, e parou em vez de afrouxar a asserção; refiz a conta e ele
   estava certo. Duas outras vezes a instrução "se a contagem não bater, não ajuste o
   relatório, descubra por quê" pegou erros de aritmética meus. **Escreva as duas instruções
   em todo despacho.**
7. **Defeito de junção não aparece na revisão de task** — por isso a revisão da branch inteira é
   obrigatória. Em três rodadas seguidas ela achou o que nenhuma revisão de task pegou.
8. **O plano é o elo fraco.** Quando o revisor rotula um achado "plan-mandated", quase sempre quer
   dizer que a lista de testes do plano tinha buraco — não que o revisor esteja errado.
9. 🔴 **`npm test` VERDE NÃO PROVA QUE O APP CONSTRÓI.** O vitest roda por esbuild e nunca
   invoca o `next build`. Em 2026-08-14 o build ficou **quebrado por quatro commits** com a
   suíte inteira verde, e **três revisões e uma re-revisão passaram por cima** — a re-revisão
   inclusive aprovou por escrito a linha que o quebrava. Ninguém errou: a régua da rodada era
   `npm test` + `tsc`, e ninguém tinha motivo pra rodar o build. Quem achou foi um
   implementador, por acidente, investigando outra coisa. **O deploy teria falhado.**
   **`npm run build` entra na verificação de toda task e de toda revisão.**

   A causa foi um fix round que exportou uma constante de um `route.ts`, citando o precedente
   do `zoomDeTiles`. **O precedente é de módulo de LIB; route handler do Next tem superfície
   de export restrita** — qualquer nome fora da lista quebra com `Type 'X' is not assignable
   to type 'never'`. Consertado (`318231e`): a constante virou `PRAZO_BUSCA_MS` em
   `src/lib/lugares.ts`. **Guarda criado:** `tests/deploy/exports-de-rota.test.ts`.

   **E o guarda nasceu com ponto cego** — eu provei UMA forma (`export const X`) e presumi as
   outras; `const X; export { X }` passava verde com o build quebrado. Consertado em
   `ff217df`, com cada forma provada **pelas duas ferramentas**. A lista `PERMITIDOS` foi
   conferida contra o arquivo de tipos que o **próprio Next gera** (`.next/types/.../route.ts`),
   não contra documentação. **Moral dupla: escrever a rede de segurança não basta — a rede
   também precisa de prova de mutação, forma a forma.**

10. **Ficha sintética prova a FUNÇÃO; só a ficha REAL prova a integração com o conteúdo.**
    Meu brief afirmou que o custo da Rampa usa `—` como separador. Usa `·`. Os testes eram
    sintéticos, com o separador que eu SUPUS, e passavam — com a ficha real o cartão mostraria
    "R$ 5 por pessoa · cobrado no portão da entrada" inteiro, e como o cartão junta seus campos
    com `" · "`, a logística se disfarçaria de mais um metadado. A prova de mutação é a
    demonstração: restaurando o corte errado, **só o teste da ficha real falha**.

11. **`git checkout -- <arquivo>` durante prova de mutação só é seguro se o arquivo estiver
    COMMITADO.** Com trabalho não-commitado dentro, ele reverte tudo. Mordeu um implementador
    (Task 8) e **mordeu a mim** no mesmo dia, uma hora depois de eu escrever a lição.
    **Restaure com edição pontual.** E a conferência que fecha a dúvida sobre perda silenciosa
    é `git diff <base-da-task> HEAD -- <arquivo>`, não `git diff HEAD`.

12. **Mandar o implementador PARAR quando a mutação não morde funciona.** Nesta rodada isso
    aconteceu três vezes e **nas três o erro era do plano, não dele**. Some a isso "se a
    contagem não bater, não ajuste o relatório — descubra por quê", que pegou **cinco** erros
    de aritmética meus. **As duas instruções entram em todo despacho.**

15. 🔴 **SUÍTE VERMELHA NÃO É O MESMO QUE ASSERÇÃO CAINDO.** Em 2026-08-16 o meu brief da Task
    10 prescreveu uma prova de mutação que **aprovava o mutante**: apagando o `try/catch` da
    escrita em `filtros.tsx`, o teste que eu nomeei passava (`1 passed | 19 skipped`) e a suíte
    só ficava vermelha por `Errors 1` — **erro global, nenhuma asserção caindo**. Duas causas
    somadas: o `setFiltros` roda **antes** do `setItem`, então tudo o que eu mandava asseverar
    acontece com ou sem o guarda; e a exceção, vinda de um CLIQUE, é engolida pelo despacho
    sintético do React e vira `Unhandled Error` do jsdom. **Isso já estava documentado neste
    repositório** (`tests/app/local.test.tsx:88-94`), que resolve chamando o setter DIRETO em
    vez de clicar — e o meu brief mandou espelhar aquele arquivo e copiou justamente a forma que
    ele rejeita. **Ao validar uma mutação, diga qual das duas coisas aconteceu.** "Ficou
    vermelho" não é prova; "caiu a asserção X" é.

21. **MEÇA GEOMETRIA NO BUILD DE PRODUÇÃO — e nunca rode `next dev` e `next start` no mesmo
    `.next/`.** ⚠️ *Esta lição nasceu errada e foi corrigida no mesmo dia; o erro é instrutivo.*
    Um implementador relatou que `/_next/static/css/app/layout.css` dava **404** no `next dev` e
    que por isso o iframe media uma página sem estilo. **Eu escrevi isso como lição sem
    verificar.** O revisor mediu os dois servidores lado a lado: o dev **serve** o CSS (200,
    11712 bytes, com as regras dentro). A causa real do sintoma é que **`next dev` e `next start`
    compartilham o `.next/`** — rodando os dois juntos, o `start` passa a dar 500 com
    `ENOENT: .next/required-server-files.json`, porque o dev reescreve o diretório debaixo dele.
    Produz exatamente o "faltou tudo" que ele viu. **A recomendação sobrevive, por outro motivo,
    mais forte: meça no `next build` + `next start` porque é o artefato que vai pro ar.** Dois
    detalhes práticos: o `document.body` da página hospedeira computa `display: none` sob a
    extensão, então o iframe tem que ser pendurado no `documentElement`; e um iframe "de 375px"
    vira 360 quando o documento rola — compense em laço até `contentWindow.innerWidth === 375`.
    Pra medir o painel de busca, `localStorage['bp.gps'] = 'negado'` antes, senão o toque na
    pílula pede o GPS em vez de abrir a busca. **Moral de método: relato de agente não é
    medição.** Eu tratei um como o outro e publiquei uma causa falsa.

23. 🔴 **A FAMÍLIA DA ASSERÇÃO FROUXA EM CSS — e ela era MUITO maior do que a primeira varredura
    sugeriu.** Forma: `toContain`/`toMatch` de um pedaço de declaração sobre um **bloco** de CSS.
    Dois decoys a conhecer, os dois provados neste repo:
    - **prefixo**: `"height: 168px"` é substring de `"max-height: 168px"`; `left:` casa em
      `margin-left:`; `bottom: 0` casa em `padding-bottom: 0`; `width:` casa dentro de
      `max-width:` (e `match` sem `/g` devolve a **primeira** ocorrência).
    - **propriedade customizada**: `--font-size: 16px` satisfaz `/font-size:\s*16px/` e é
      **inerte**. (`max-min-height` não existe; `--min-height` existe — o decoy certo.)

    O que a rodada achou, em ondas: **1** (o refactor que esvaziou o `mapa.test.ts`), depois
    **3** na varredura da revisão da branch, depois **+2** na re-revisão, depois **+1 viva e
    provada +5 suspeitas +2 constantes sem corrente** na varredura do implementador. **Cada
    varredura achou mais.** A pior: `/left:\s*var\(--goteira-esq\)/` casando em `margin-left`,
    que deixava voltar o defeito da Task 12 inteiro (barra desamarrada da moldura) — **celular
    errado, monitor certo, que foi como o defeito passou da primeira vez.**

    **Remédio, e ele é estrutural:** uma régua central (`tests/css.ts`: `semComentarios`,
    `regraDe`, `valorDe`, `fatiar`, `paddingLado`, `px`) lida por todos os arquivos de teste, com
    a âncora `(?:^|[{;])` e `toBe` no lugar de `toContain`. **Cada cópia solta do helper é uma
    chance de UMA delas perder a âncora e enfraquecer só o arquivo dela.** Onde a asserção existe
    pra travar uma MEDIDA, leia a medida — ou pelo menos a declaração inteira ancorada no nome da
    propriedade.

22. **NÚMERO MEDIDO NO MEU MONITOR NÃO VIRA CONSTANTE DO APARELHO ALVO.** Eu mandei "corrija a
    constante pro valor medido" (39,2px). O implementador parou: **39,2 é artefato de `dpr`
    1,25** (o Chrome reporta 0,8px pra uma borda de 1px); num iPhone, `dpr` 2 ou 3, a mesma
    linha dá **39,4**. Gravar 39,2 seria uma constante que mente no único aparelho que importa.
    A saída dele é melhor que a minha: em vez de a constante descrever uma **soma** que qualquer
    filho invalida em silêncio, subiu o `min-height` pra **40px** pra que ele **morda** — a
    constante passou a descrever uma **declaração que o navegador usa**, e mede 40 em qualquer
    `dpr`. **Constante de layout tem que apontar pra uma declaração, não pra uma soma medida.**

20. 🔴 **REFACTOR PODE ESVAZIAR UM TESTE VIZINHO SEM TOCAR NELE, E A SUÍTE FICA VERDE.** No fix
    round da Task 12, mover a fórmula da goteira do `padding:` do `.bp` pra declarações
    `--goteira-*` **esvaziou** a asserção de `tests/lib/mapa.test.ts:301-310`, que provava que
    `MAPA_JANELA_VISIVEL_HOME_PX` ainda bate com o CSS de onde foi derivada: ela casava
    `clamp(0px, 3vw, 1rem)` **na regra `.bp` inteira**, então passou a casar as variáveis novas em
    vez do padding. Provado zerando o padding lateral — o `mapa.test.ts` **passa verde** com a
    constante do mapa invalidada. **Ao mover uma expressão de lugar dentro de um arquivo, procure
    quem a casava por texto** — asserção que lê "a regra inteira" muda de significado sem uma
    linha de diff no teste. Irmã disto: **dois testes deste repo dependem de "o primeiro `.bp {`
    do `ficha.css` é o de verdade"** (`mapa.test.ts` e o da barra), o que faz uma regra `.bp`
    inserida antes deles mascarar os dois.

18. 🔴 **MEDIR NÃO BASTA SE A COMPARAÇÃO NÃO ESTIVER ESCRITA COMO PERGUNTA.** Na Task 12 o
    implementador mediu, na MESMA sondagem e no mesmo objeto JSON, `.barra` com 375,20 de
    largura e `.screen` com 352,70 — e **não comparou os dois**. Os números estavam na frente
    dele. Ele respondeu a pergunta que o meu brief fez ("na janela larga a barra fica dentro da
    moldura?") em vez da pergunta que os dados respondiam. E o meu brief escopou a conferência
    de largura à **janela larga**, que era exatamente o único viewport onde o defeito não
    existe — meia volta do achado do meu próprio pré-voo: o conserto tratou o monitor e deixou o
    celular. **Passo de medição tem que nomear a COMPARAÇÃO e os viewports, não só o que
    olhar.** Corolário: `toContain('max-width: 25.5rem')` era necessário e não suficiente —
    trava o número, não o alinhamento; **quem prova geometria é o navegador.**

19. **Uma mutação que morre cedo demais é prova de outra coisa.** No fix round da Task 12, a
    mutação "copiei a fórmula da goteira pra dentro da barra" caiu na asserção *anterior* (a do
    `left: var(...)`) sem nunca chegar na contagem que ela existia pra exercitar. Refeita pondo a
    cópia num lugar neutro. **Ao validar, confira que a asserção que caiu é a que a mutação
    visava** — senão o relatório credita uma prova que não aconteceu.

17. **"E mais nenhum teste cai" é afirmação sobre a suíte INTEIRA.** Na Task 10 o revisor mediu
    quatro mutações com `npx vitest run tests/app/ tests/lib/` — subconjunto por caminho, 36 de
    45 arquivos — e relatou os números como se fossem do todo. O implementador pegou a
    discrepância (447 contra 487) e **não ajustou: perguntou por quê**, que é a régua desta
    rodada aplicada de baixo pra cima. A causa importava: as afirmações do tipo "e mais nenhum
    cai" são justamente sobre o que NÃO cai, e dois dos arquivos de fora (`tests/deploy/*`) leem
    fontes de `src/app/`, inclusive um alvo de mutação. Remedido na árvore inteira, nenhuma
    conclusão mudou. **"O teste nomeado morre" um arquivo prova; "e mais nenhum" exige
    `npm test`.**

16. **O `next build` só protege o que está NA ÁRVORE, e isso muda o valor da asserção de fonte.**
    Medido nas duas direções na Task 10: apagando o `"use client"` do `filtros.tsx` (já
    importado pelo `page.tsx`) o **build falha** (`You're importing a component that needs
    useState`); apagando o do `PainelFiltros.tsx` (que só entra na árvore na Task 11) o **build
    passa**. O mecanismo é alcançabilidade a partir da página, não o hook. **Para componente
    ainda não montado na página, a asserção de fonte é a ÚNICA proteção** — nem vitest nem
    build pegam.

14. 🔴 **Com subagente em voo, `git add -A` não é meu direito.** Em 2026-08-16 commitei uma
    mudança de DOCUMENTAÇÃO com `git add -A` enquanto um implementador trabalhava na mesma
    árvore, e o `-A` varreu o conserto dele pra dentro de um commit com mensagem de docs. Saiu
    coerente **por sorte**: conferi depois e o arquivo estava num estado completo. Se eu tivesse
    pego no meio de uma prova de mutação, teria commitado **código mutado**, e a mensagem do
    commit não daria pista nenhuma disso pra quem lesse o `git log` depois. **Irmã da lição 11:
    a árvore não é minha sozinho enquanto há agente rodando. `git add <caminho explícito>`,
    sempre.**

13. **"A mutação não mordeu" tem TRÊS respostas, não duas.** Além de "falta teste" e "a linha
    é redundante mesmo", existe **"a linha é provada por OUTRA ferramenta"**. Duas linhas que
    o vitest dizia mortas eram carregadoras de peso pro `tsc` (`Number.isFinite` não é type
    guard; quem estreita `unknown` pra `number` é o `typeof`). **Rode `tsc --noEmit` antes de
    declarar uma linha morta.**

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + **o celular** + **os fatos de
roteiro**. Código, deploy e verificação eu toco. **Agentes: autorizados nesta rodada.**

### Pendências dele, e nenhuma trava a rodada

1. **Esforço e duração da Rampa do Pepe** — quão puxada (leve/média/puxada) e quanto tempo leva
   (em minutos). Vira uma linha no cartão. Sem isso a Rampa só não mostra essa linha.
2. **Responder `docs/questionario-ficha.md`** — a segunda ficha. Filtro que filtra um item e km
   num cartão só não mostram que funcionam; ele sabe disso e escolheu construir em paralelo.
   **A Task 8 acrescenta duas perguntas ao questionário — ele deve responder DEPOIS dela**, senão
   responde duas vezes.
3. **Abrir a home no iPHONE.** A home nova **nunca foi vista em WebKit**. Quatro perguntas, na §15
   da spec: os pins estão dentro do mapa com folga? A barra fixa e a faixa de gesto convivem? O
   painel de filtros empurra a lista sem pular? O piso de zoom 8 orienta ou vira mancha?

## Registro histórico (não refazer)

- Rodada 1 (esqueleto): merge `a179e46`. Rampa ao vivo (Versão D): `7d4bd59`. "Fui": `4b6d9a7`.
  Mapa de verdade: `a671146`. Forma de app: `6ef0fdc`. Carimbo busca leitura nova: `9c3dcf8`.
  Home "Hoje": `645ebe1`. **"De onde eu estou" (localização + filtros + barra fixa): `ce40307`
  — mergeada em 2026-08-16 e NÃO deployada (ver o topo).**
- **iPhone provado em 2026-08-10** com a versão anterior à home. Da home pra cá, não.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute).
- Os mockups do brainstorm desta rodada estão em `.superpowers/brainstorm/2019-1786672214/content/`
  (git-ignorado): `mapa-centro.html`, `layout-filtros.html`, `folha-de-cima.html`.
