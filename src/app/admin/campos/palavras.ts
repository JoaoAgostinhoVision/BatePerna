/** AS PALAVRAS QUE MAIS DE UM PEDAÇO DESTA TELA USA — e elas moram juntas pelo
 *  mesmo motivo que a copy de `FichaInteira` mora num bloco só: o João lê a
 *  tela inteira sem abrir componente por componente, e quatro editores que
 *  cunhassem quatro palavras pra "salvar" seriam quatro idiomas na mesma tela.
 *
 *  ⚠️ PURO DE PROPÓSITO: sem zod, sem `node:fs`, sem import de `@/lib/*`. É
 *  lido por componentes `"use client"` (os editores) e por um de servidor
 *  (`FichaInteira`) — mesma razão que mantém `src/lib/piso.ts` puro.
 *
 *  A PROCEDÊNCIA de cada uma está ao lado. Duas delas vinham de
 *  `src/app/admin/EditorDeVoz.tsx` (apagado nesta tarefa) **sem marcador
 *  nenhum** — estavam na tela e não estavam na fila de leitura dele. Agora
 *  estão marcadas: marcar a mais é honesto, marcar a menos é a frase que sobe
 *  sem ninguém ler. */

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
 *  acabou de escrever algo. */
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
