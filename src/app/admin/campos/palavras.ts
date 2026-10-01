/** AS PALAVRAS QUE MAIS DE UM PEDAÇO DESTA TELA USA — e elas moram juntas pelo
 *  mesmo motivo que a copy de `FichaInteira` mora num bloco só: o João lê a
 *  tela inteira sem abrir componente por componente, e quatro editores que
 *  cunhassem quatro palavras pra "salvar" seriam quatro idiomas na mesma tela.
 *
 *  ⚠️ PURO DE PROPÓSITO: sem zod, sem `node:fs`, sem import de `@/lib/*`. É
 *  lido por componentes `"use client"` (os editores) e por um de servidor
 *  (`FichaInteira`) — mesma razão que mantém `src/lib/piso.ts` puro.
 *
 *  A PROCEDÊNCIA de cada uma está ao lado. Duas delas vinham do
 *  `EditorDeVoz.tsx`, componente APAGADO nesta tarefa — o nome vem sem caminho
 *  porque não há arquivo pra abrir. Estavam na tela **sem marcador nenhum**,
 *  fora da fila de leitura dele; agora estão marcadas. Marcar a mais é honesto;
 *  marcar a menos é a frase que sobe sem ninguém ler. */

/** O "sim" de um booleano e o "sim" de um bloco opcional são a MESMA palavra de
 *  propósito: as duas respondem a mesma forma de pergunta ("este lugar tem
 *  isto?"). Vinham de `FichaInteira.tsx`, onde nasceram na Task 5; mudaram de
 *  arquivo porque agora o editor de booleano também as escreve, e duas cópias
 *  da mesma palavra é como um "Sim" e um "sim" acabam na mesma tela. */
// PENDENTE: redação minha, o João ainda não leu
export const SIM = "Sim";
// PENDENTE: redação minha, o João ainda não leu
export const NAO = "Não";

/** O rótulo do botão que grava. Vinha de `EditorDeVoz.tsx:58`, escrito inline e
 *  SEM marcador. */
// PENDENTE: estava no ar sem marcador, vindo do `EditorDeVoz`; o João ainda não leu
export const SALVAR = "Salvar";
// PENDENTE: estava no ar sem marcador, vindo do `EditorDeVoz`; o João ainda não leu
export const SALVANDO = "Salvando…";

/** A recusa de "nada escolhido" — vale pra lista fechada (nenhuma opção) e pro
 *  interruptor (nem sim nem não). Uma frase só porque a pergunta é a mesma; e
 *  ela NÃO promete o "não sei", porque campo obrigatório não tem esse botão e a
 *  frase apareceria prometendo o que não está na tela. */
// PENDENTE: redação minha, o João ainda não leu
export const NADA_ESCOLHIDO = "Escolha uma das opções.";

/** A recusa de hora em branco. Ela DIZ O FORMATO porque o dono pode ter digitado
 *  "17h" num teclado de celular e o próprio controle de hora esvaziou o campo —
 *  sem o formato escrito, ele lê "escolha uma hora" olhando pra uma caixa onde
 *  acabou de escrever algo.
 *
 *  🔴 E O ALCANCE DELA TEM LIMITE, MEDIDO: ela cobre o que um `<input
 *  type="time">` DE VERDADE produz (hora válida ou vazio). Num navegador que
 *  **não implementa** `type=time`, o `type` cai para `text`, `"17h"` fica no
 *  `value`, esta recusa não dispara (o campo não está em branco), e a porta
 *  estoura um `ZodError` — que a rota devolve com **corpo vazio**, então o dono
 *  lê *"Não consegui salvar."*, a frase menos informativa do app, exatamente
 *  onde esta aqui prometia dizer o formato. **Esta frase não cobre aquele
 *  caso, e o parágrafo existe pra ninguém achar que cobre.**
 *
 *  ⚠️ POR QUE NÃO UMA REGEX DE `HH:MM` AQUI: ela seria inalcançável em todo
 *  ambiente que este projeto consegue medir (em jsdom o `type=time` funciona e
 *  esvazia o valor), e o único teste capaz de deixá-la vermelha teria de
 *  SOBRESCREVER o `type` que o componente declara — encenação. Condição que
 *  nasce inalcançável com um teste que nunca fica vermelho por defeito é a 52ª
 *  espécie do catálogo deste projeto. O que guarda o alcance é uma asserção em
 *  `tests/app/admin-editores-de-campo.test.tsx` cravando que o instrumento é
 *  `type="time"`: se ele deixar de ser, o caso fica vermelho e esta frase
 *  precisa de outra decisão — que é de PRODUTO (a rota devolveria a frase do
 *  `ZodError`?), não de render. */
// PENDENTE: redação minha, o João ainda não leu
export const HORA_VAZIA = "Escolha uma hora, no formato HH:MM.";

/** A recusa de caixa de texto vazia — o outro lado do "não sei" (§4.1 do
 *  desenho: caixa vazia é ERRO DE PREENCHIMENTO, "não sei" é outra ação).
 *
 *  🔴 ELA NÃO REPETE A FRASE DA PORTA de propósito. A porta diz *"caixa vazia em
 *  `X`: escreva algo, ou diga 'não sei' (que tira o campo)"* — com o caminho
 *  cru entre backticks, que não é palavra de tela — e ela só chega aqui se a
 *  requisição sair. Esta recusa acontece ANTES da viagem, e o campo já está
 *  rotulado na linha de cima. A garantia continua sendo a porta; isto poupa uma
 *  ida ao Turso numa rede de interior. */
// PENDENTE: redação minha, o João ainda não leu
export const CAIXA_VAZIA = "Caixa vazia não grava: escreva algo.";

/** ─────────────────────────────────────────────────────────────────────────────
 *  AS PALAVRAS DO NÚMERO DE MOTOR (Task 7) — e a PROCEDÊNCIA de cada pedaço está
 *  escrita ao lado de cada uma, porque três delas afirmam o que acontece com um
 *  lugar real quando o número muda. Nenhuma é fala dele; todas são `PENDENTE`.
 *
 *  🔴 ELAS MORAM AQUI, E NÃO EM `src/lib/`, DE PROPÓSITO. O cerco de nome de
 *  lugar varre todo literal de `src/app/admin/**`; copy de editor em `src/lib/`
 *  é o resíduo que a Tarefa 6 mediu e declarou — e que só se fecharia seguindo o
 *  grafo de imports. Pôr frase de editor fora desta árvore tornaria aquele
 *  resíduo real por um ganho nenhum.
 *  ──────────────────────────────────────────────────────────────────────────── */

/** A recusa de um número que MENTE sobre o lugar — janela do PASSADO zero ou
 *  negativa, limiar zero ou negativo. Uma frase só pros dois, porque o conserto
 *  na mão dele é um só: pôr um número maior que zero.
 *
 *  🔴 ELA NÃO VALE MAIS PRA JANELA DE PREVISÃO. Desde 2026-10-01 (decisão do
 *  João: "só olhar a chuva que já caiu") a previsão pode ser zero, e medido com
 *  `avaliar` (previsão 0, passado 6, limiar 0.2) o lugar fecha com 5 mm uma hora
 *  atrás e abre sem chuva — nenhuma das duas metades desta frase era verdade ali.
 *  A previsão negativa tem frase própria (`JANELA_NEGATIVA`).
 *
 *  🔴 ELA DIZ O QUE ACONTECE, não "valor inválido". A procedência das duas
 *  metades:
 *   - *"o lugar passa a dizer não para sempre"* vem da regra `janela-nao-zerada`
 *     de `src/lib/coerencia.ts`, que é quem recusa isto na GRAVAÇÃO (*"qualquer
 *     orvalho fecha o lugar, e o app passa a dizer não o ano inteiro"*) —
 *     paráfrase minha daquela frase, encurtada pra caber do lado de um campo;
 *   - *"ou nunca avisar"* é o outro lado, que eu MEDI rodando `avaliar`: com
 *     `janela_passado_horas: -5` e 5 mm de chuva uma hora atrás o motor devolve
 *     `fresco` — a janela invertida cega o motor pra chuva que caiu, e o aviso
 *     fica desligado em silêncio.
 *
 *  ⚠️ Ela NÃO cita nenhum dos nomes de campo: o rótulo do campo está na linha de
 *  cima, e repeti-lo aqui faria a tela perguntar duas vezes. */
// PENDENTE: redação minha, o João ainda não leu
export const REGRA_QUE_MENTE =
  "Zero ou menos não é regra: assim o lugar passa a dizer não para sempre, ou nunca avisa. Use um número maior que zero.";

/** A recusa da janela de PREVISÃO negativa — a única que sobrou pra ela depois
 *  que o zero passou a valer (2026-10-01). Ela não diz "o lugar nunca fecha",
 *  porque não é verdade: a janela do passado continua avisando. Diz o que é (não
 *  existe janela negativa) e mostra a saída que ele provavelmente queria. */
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_NEGATIVA =
  "Janela negativa não existe. Use 0 pra olhar só a chuva que já caiu, ou um número maior que zero.";

/** A recusa de uma janela acima do que o provedor de chuva aceita.
 *
 *  🔴 OS DOIS NÚMEROS DENTRO DELA SÃO OS TETOS de `src/lib/weather.ts`
 *  (`TETO_PREVISAO_HORAS`, `TETO_PASSADO_HORAS`), medidos contra a Open-Meteo, e
 *  estão escritos por extenso porque o cerco de completude só lê literal simples.
 *  Há teste cravando que a frase contém os dois números das constantes — se o
 *  teto mudar lá, ela fica vermelha.
 *
 *  *"a tela inicial fica sem informação de chuva pra todos os lugares"* é
 *  medido: a busca da tela inicial é uma só, com a maior janela do acervo, e a
 *  recusa do provedor dá "sem informação" a todo lugar (revisão da Tarefa 7). */
// PENDENTE: redação minha, o João ainda não leu
export const ALEM_DO_PROVEDOR =
  "Esse número passa do que a previsão do tempo alcança: até 384 horas pra frente e 2232 pra trás. Com ele a tela inicial fica sem informação de chuva pra todos os lugares. Use um número menor.";

/** A moldura da prévia — a frase que diz que o que vem a seguir é uma
 *  SIMULAÇÃO, e não o estado de agora.
 *
 *  🔴 SEM ELA A PRÉVIA MENTE POR FALTA DE CONTEXTO: o dono veria *"Não vá ·
 *  barro · dá um tempo"* aparecer ao lado do campo e leria isso como o estado do
 *  lugar AGORA — que é precisamente o que o carimbo de verdade, no topo do mesmo
 *  painel, está dizendo com as mesmas palavras. As palavras depois dos dois
 *  pontos não são minhas nem desta tela: elas vêm do motor, por
 *  `src/lib/severidade.ts` e `src/lib/carimbo-fase.ts`, que são as MESMAS que a
 *  tela pública imprime. É o ponto da prévia. */
// PENDENTE: redação minha, o João ainda não leu
export const COM_ESTE_NUMERO = "Com este número, a tela do lugar diria:";

/** Enquanto a prévia não chegou. Irmã do `SALVANDO`, e pelo mesmo motivo: numa
 *  rede de interior, campo que não responde parece campo quebrado. */
// PENDENTE: redação minha, o João ainda não leu
export const PREVENDO = "Conferindo o que muda…";

/** A prévia não veio — o provedor de chuva recusou, a rede caiu, o prazo
 *  estourou, ou a rota recusou. E ela NÃO esconde o botão de salvar: a prévia é
 *  ajuda, não portão. O portão é a porta de escrita.
 *
 *  ⚠️ Até 2026-10-01 havia uma irmã, `SEM_LEITURA` (*"Ainda não tem chuva lida
 *  aqui…"*), pra quando a chuva GUARDADA faltava. A prévia passou a buscar a
 *  chuva ao vivo, aquele estado deixou de existir, e a frase foi apagada junto —
 *  ela prometia um "ainda" que nada no sistema cumpria. */
// PENDENTE: redação minha, o João ainda não leu
export const PREVISAO_FALHOU = "Não consegui conferir o que muda.";
