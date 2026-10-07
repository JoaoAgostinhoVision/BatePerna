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

/** O "sim" e o "não" do interruptor. Nasceram em `FichaInteira.tsx` na Task 5,
 *  onde também respondiam o bloco opcional (o `horario` de antes da 11c), e
 *  mudaram pra cá quando o editor de booleano passou a escrevê-las — duas
 *  cópias da mesma palavra é como um "Sim" e um "sim" acabam na mesma tela.
 *  Desde a Tarefa 11d só o interruptor as usa. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const SIM = "Sim";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const NAO = "Não";

/** O rótulo do botão que grava. Vinha de `EditorDeVoz.tsx:58`, escrito inline e
 *  SEM marcador. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Estava no ar sem marcador, vindo do `EditorDeVoz`.
export const SALVAR = "Salvar";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Estava no ar sem marcador, vindo do `EditorDeVoz`.
export const SALVANDO = "Salvando…";

/** A recusa de "nada escolhido" — vale pra lista fechada (nenhuma opção) e pro
 *  interruptor (nem sim nem não). Uma frase só porque a pergunta é a mesma; e
 *  ela NÃO promete o "não sei", porque campo obrigatório não tem esse botão e a
 *  frase apareceria prometendo o que não está na tela. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
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
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const HORA_VAZIA = "Escolha uma hora, no formato HH:MM.";

/** A ajuda das horas que entram JUNTAS: as duas horas de uma faixa só gravam
 *  com as duas preenchidas. Nasceu no `EditorBloco` (o bloco `horario`
 *  ausente, apagado na Tarefa 11d) e é do `EditorFaixas` desde a 11c — o nome
 *  da constante perdeu o "bloco" na 11d; o texto é o mesmo. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const HORAS_JUNTAS = "Estes campos entram juntos: um sozinho não vira ficha.";

/** Os dois botões que MEXEM NA LISTA de faixas sem gravar nada (Tarefa 11d).
 *  Quem grava é o Salvar, um só, com a lista inteira. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const MAIS_FAIXA = "+ outra faixa";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const TIRAR_FAIXA = "Tirar esta faixa";

/** A recusa de caixa de texto vazia — o outro lado do "não sei" (§4.1 do
 *  desenho: caixa vazia é ERRO DE PREENCHIMENTO, "não sei" é outra ação).
 *
 *  🔴 ELA NÃO REPETE A FRASE DA PORTA de propósito. A porta diz *"caixa vazia em
 *  `X`: escreva algo, ou diga 'não sei' (que tira o campo)"* — com o caminho
 *  cru entre backticks, que não é palavra de tela — e ela só chega aqui se a
 *  requisição sair. Esta recusa acontece ANTES da viagem, e o campo já está
 *  rotulado na linha de cima. A garantia continua sendo a porta; isto poupa uma
 *  ida ao Turso numa rede de interior. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const CAIXA_VAZIA = "Caixa vazia não grava: escreva algo.";

/** ─────────────────────────────────────────────────────────────────────────────
 *  AS PALAVRAS DO NÚMERO DE MOTOR (Task 7) — e a PROCEDÊNCIA de cada pedaço está
 *  escrita ao lado de cada uma, porque três delas afirmam o que acontece com um
 *  lugar real quando o número muda. Nenhuma é fala dele; todas nasceram `PENDENTE` e ele leu todas (Serve, 07/10).
 *
 *  🔴 ELAS MORAM AQUI, E NÃO EM `src/lib/`, DE PROPÓSITO. O cerco de nome de
 *  lugar varre todo literal de `src/app/admin/**`; copy de editor em `src/lib/`
 *  é o resíduo que a Tarefa 6 mediu e declarou — e que só se fecharia seguindo o
 *  grafo de imports. Pôr frase de editor fora desta árvore tornaria aquele
 *  resíduo real por um ganho nenhum.
 *  ──────────────────────────────────────────────────────────────────────────── */

/** A recusa de um LIMIAR que mente sobre o lugar — zero ou negativo.
 *
 *  🔴 ELA NÃO VALE MAIS PRA JANELA NENHUMA. Desde 2026-10-01 (decisões do João:
 *  "só olhar a chuva que já caiu", e depois o espelho dela pro passado) cada
 *  janela pode ser zero sozinha, e medido com `avaliar` nenhuma das duas metades
 *  da frase antiga era verdade ali: previsão 0 fecha com chuva caída e abre sem
 *  ela; passado 0 fecha com chuva prevista e abre sem ela. Janela negativa tem
 *  frase própria (`JANELA_NEGATIVA`, `JANELA_PASSADO_NEGATIVA`).
 *
 *  🔴 E A SEGUNDA METADE SAIU (onda de conserto 2, por subtração). Ela dizia
 *  *"…para sempre, ou nunca avisa"*, e o *"ou nunca avisa"* era a medição da
 *  janela do passado NEGATIVA (`-5` cegava o motor pra chuva caída). Sobrando só
 *  o limiar, medido com `avaliar`: limiar 0 e limiar -1, sem chuva nenhuma, dão
 *  `frio` os dois — o limiar zero ou negativo só diz não, nunca deixa de avisar.
 *
 *  🔴 ELA DIZ O QUE ACONTECE, não "valor inválido". *"o lugar passa a dizer não
 *  para sempre"* vem da regra `janela-nao-zerada` de `src/lib/coerencia.ts`, que
 *  é quem recusa isto na GRAVAÇÃO (*"qualquer orvalho fecha o lugar, e o app
 *  passa a dizer não o ano inteiro"*) — paráfrase minha daquela frase, encurtada
 *  pra caber do lado de um campo.
 *
 *  ⚠️ Ela NÃO cita nenhum dos nomes de campo: o rótulo do campo está na linha de
 *  cima, e repeti-lo aqui faria a tela perguntar duas vezes. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const REGRA_QUE_MENTE =
  "Zero ou menos não é regra: assim o lugar passa a dizer não para sempre. Use um número maior que zero.";

/** A recusa da janela de PREVISÃO negativa — a única que sobrou pra ela depois
 *  que o zero passou a valer (2026-10-01). Ela não diz "o lugar nunca fecha",
 *  porque não é verdade: a janela do passado continua avisando. Diz o que é (não
 *  existe janela negativa) e mostra a saída que ele provavelmente queria. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const JANELA_NEGATIVA =
  "Janela negativa não existe. Use 0 pra olhar só a chuva que já caiu, ou um número maior que zero.";

/** A recusa da janela do PASSADO negativa — a única que sobrou pra ela depois
 *  que o zero passou a valer (decisão do João, 2026-10-01, simétrica à da
 *  previsão). É a irmã de cima MENOS o *"pra olhar só a chuva que já caiu"*, que
 *  é a fala dele sobre a PREVISÃO zero e aqui seria falsa: o passado zero olha só
 *  a chuva prevista. Não acrescenta palavra que a irmã não tenha. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const JANELA_PASSADO_NEGATIVA =
  "Janela negativa não existe. Use 0 ou um número maior que zero.";

/** A recusa de uma janela acima do que o provedor de chuva aceita.
 *
 *  🔴 OS DOIS NÚMEROS DENTRO DELA SÃO OS TETOS de `src/lib/weather.ts`
 *  (`TETO_PREVISAO_HORAS`, `TETO_PASSADO_HORAS`), medidos contra a Open-Meteo, e
 *  estão escritos por extenso porque o cerco de completude só lê literal simples.
 *  Há teste cravando que a frase contém os dois números das constantes — se o
 *  teto mudar lá, ela fica vermelha.
 *
 *  ⚠️ ELA DIZIA *"Com ele a tela inicial fica sem informação de chuva pra todos
 *  os lugares."*, e a frase saiu por subtração (onda de conserto 2, 2026-10-01):
 *  é falsa pra lugar OCULTO — a home lê `getAllFichas`, que o filtra, então a
 *  janela dele não entra na busca da home enquanto ele estiver escondido. A
 *  recusa continua certa; a frase só não afirma o que não vale sempre. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ALEM_DO_PROVEDOR =
  "Esse número passa do que a previsão do tempo alcança: até 384 horas pra frente e 2232 pra trás. Use um número menor.";

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
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const COM_ESTE_NUMERO = "Com este número, a tela do lugar diria:";

/** Enquanto a prévia não chegou. Irmã do `SALVANDO`, e pelo mesmo motivo: numa
 *  rede de interior, campo que não responde parece campo quebrado. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PREVENDO = "Conferindo o que muda…";

/** A prévia não veio — o provedor de chuva recusou, a rede caiu, o prazo
 *  estourou, ou a rota recusou. E ela NÃO esconde o botão de salvar: a prévia é
 *  ajuda, não portão. O portão é a porta de escrita.
 *
 *  ⚠️ Até 2026-10-01 havia uma irmã, `SEM_LEITURA` (*"Ainda não tem chuva lida
 *  aqui…"*), pra quando a chuva GUARDADA faltava. A prévia passou a buscar a
 *  chuva ao vivo, aquele estado deixou de existir, e a frase foi apagada junto —
 *  ela prometia um "ainda" que nada no sistema cumpria. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PREVISAO_FALHOU = "Não consegui conferir o que muda.";

/** ─────────────────────────────────────────────────────────────────────────────
 *  AS PALAVRAS DO ESCONDER (Task 9, 2026-10-01). Nenhuma é fala dele; todas nasceram
 *  `PENDENTE` e ele leu todas (Serve, 07/10). Moram aqui porque três pedaços da tela as escrevem — a lista
 *  (`ListaDeLugares`, servidor), o histórico e o botão (`"use client"`) — e uma
 *  palavra com três cópias é como "escondido" e "oculto" acabam na mesma tela.
 *
 *  🔴 NENHUMA DIZ APAGAR, e há teste cravando isso. Esconder é uma VERSÃO NOVA
 *  em `ficha_versoes` (append-only), desfaz com um toque, e nada sai do banco.
 *  ──────────────────────────────────────────────────────────────────────────── */

/** Na lista, a marca de um lugar que ESTÁ fora do ar pro público (estado). No
 *  histórico, a marca da versão que o ESCONDEU (ato — R2 da onda de conserto 1
 *  da Task 9): edições feitas com ele já escondido não a levam. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ESCONDIDO = "escondido";

/** O botão com o lugar no ar. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ESCONDER = "Esconder este lugar";

/** O botão com o lugar escondido. O "de novo" diz que ele já esteve no ar e
 *  volta como estava — nada se perdeu. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const MOSTRAR_DE_NOVO = "Mostrar de novo";

/** A marca da versão que MOSTROU o lugar de novo, no histórico (R2 da onda de
 *  conserto 1 da Task 9). Irmã de `ESCONDIDO`, que marca a versão que escondeu:
 *  as duas marcam o ATO, nunca o estado. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const DE_VOLTA_AO_AR = "de volta ao ar";
