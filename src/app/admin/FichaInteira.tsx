import {
  camposDaFicha,
  lerCaminho,
  type CampoDaFicha,
  type EspecieCampo,
  type GrupoDaFicha,
} from "@/lib/campos-da-ficha";
import type { Ficha } from "@/types/ficha";
import EditorBloco from "./campos/EditorBloco";
import EditorBooleano from "./campos/EditorBooleano";
import EditorHora from "./campos/EditorHora";
import EditorLista from "./campos/EditorLista";
import EditorProsa from "./campos/EditorProsa";
import { NAO, SIM } from "./campos/palavras";
import type { CampoNaTela, Editor } from "./campos/tipos";

/** A FICHA INTEIRA NA TELA DO DONO (Task 5, 2026-09-27) — e desde a Task 6
 *  (2026-09-30) com o editor de cada espécie dentro do bloco do campo.
 *
 *  🔴 ELE ENXERGAVA UM CAMPO DE 17. Até hoje o painel de um lugar mostrava o
 *  carimbo, o aviso e uma caixa pra `voz`; os outros campos da ficha só
 *  existiam pra quem abrisse o JSON. Esta tela mostra TODOS os campos que o
 *  registro declara, agrupados, com o valor de cada um — e diz com a boca o
 *  que está AUSENTE, em vez de o campo sumir e o dono achar que preencheu.
 *
 *  🔴 ITERA `camposDaFicha(ficha)`, NUNCA `CAMPOS_DA_FICHA`. O registro cru
 *  traz MOLDES (`trajeto.waypoints[].nome`, com `[]` = "qualquer índice"), e
 *  `[]` não é campo de ficha nenhuma: um bloco de tela com aquele caminho
 *  seria um bloco que não dá pra gravar e que não corresponde a dado nenhum.
 *  `camposDaFicha` expande os moldes nos índices que ESTA ficha tem, na ordem
 *  em que o painel deve mostrar (o waypoint 0 inteiro, depois o 1 inteiro).
 *  Há teste cravando que nenhum `[]` chega ao DOM.
 *
 *  🔴 ESTE ARQUIVO É DE SERVIDOR, E É O ÚNICO LADO QUE CONHECE O REGISTRO.
 *  `@/lib/campos-da-ficha` começa com `import { z } from "zod"` e importa o
 *  `fichaSchema` inteiro; os editores são `"use client"`. Se um deles importasse
 *  o registro, o zod e o schema desceriam no bundle que o dono baixa no celular
 *  pra trocar uma frase. Então tudo o que um editor precisa saber desce por
 *  PROP, num objeto raso (`CampoNaTela`, em `./campos/tipos`), montado aqui. A
 *  medição que guarda isso é o First Load JS de `/admin/[slug]` no
 *  `npm run build` — comentário nenhum guarda.
 *
 *  🔴 QUAL INSTRUMENTO CADA ESPÉCIE GANHA SAI DE UM `Record<EspecieCampo, …>`
 *  (`INSTRUMENTO`, abaixo), pela mesma razão do `MOSTRAR` e do
 *  `TITULO_DO_GRUPO`: **espécie nova no registro não compila até alguém decidir
 *  o instrumento dela.** Duas espécies seguem em LEITURA de propósito, e está
 *  escrito qual tarefa as pega — `numero` (a Task 7, o número de motor com a
 *  consequência ao vivo) e `coord` (a Task 8, o mapa que arrasta o pin). Elas
 *  renderizam exatamente como antes desta tarefa, e há teste cravando isso: sem
 *  ele, a Task 7 herdaria uma tela que parece quebrada.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO MORA AQUI. Este componente serve
 *  os três lugares do acervo e os que vierem: tudo que ele escreve na tela é
 *  rótulo de CAMPO (a forma do dado, igual em qualquer lugar do mundo) ou
 *  valor que chegou pela prop `ficha`. Há teste comparando os rótulos das três
 *  fichas: um rótulo que falasse de um lugar cairia ali. */

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 TODA A COPY NOVA DESTA TELA MORA NESTE BLOCO, e é de propósito.
//
// Nenhuma delas o João leu. A regra do projeto é: eu escrevo, marco
// `PENDENTE`, mostro por extenso, ele lê, ele decide. Quantas são não está
// escrito aqui de propósito — o número sai de contar os marcadores
// `PENDENTE` deste arquivo, e prosa com número à mão já nasceu falsa neste
// repositório mais de uma vez. Juntar tudo num lugar só serve a duas coisas:
// ele lê a tela inteira sem abrir código, e a Task 6 reusa os MESMOS rótulos
// nos editores em vez de cunhar outros vinte.
//
// A PROCEDÊNCIA, que é o que importa aqui — e ela NÃO é uniforme:
//  - os TÍTULOS DE GRUPO são as seis linhas de comentário que separam os
//    blocos em `src/lib/campos-da-ficha.ts` ("— o que custa —", "— quando dá
//    pra ir —", …), escritas na Task 1;
//  - a MAIOR PARTE dos rótulos de campo é o TÍTULO DA SEÇÃO daquele campo em
//    `docs/questionario-ficha.md` — o documento que o João responde pra uma
//    ficha nascer —, pra a tela chamar cada campo pelo nome que a pergunta
//    dele já usa, em vez de cunhar um segundo vocabulário;
//  - onde UMA seção do questionário cobre VÁRIOS campos (a coordenada vira
//    latitude e longitude; "a regra em horas e milímetros" vira três números;
//    "o custo" vira tag, valor e curto; "o horário" vira o bloco e as duas
//    horas), o título não serve pra três blocos diferentes e a redação é
//    MINHA, derivada da *Pergunta* daquela seção;
//  - e onde o TÍTULO da seção é vago demais para virar pergunta na tela, o
//    rótulo é a *Pergunta* dela: `carroComum` (o título é só "O carro") e
//    `condicao.coords`. 🔴 Estas duas faltavam nesta lista, e sem elas a conta
//    "a maior parte vem do título" era maioria de UMA unidade — medido na
//    revisão desta tarefa: de 30 rótulos, 15 são o título exato, 1 é título
//    mais esclarecimento, e 14 são redação minha;
//  - 🔴 `condicao.severidade` NÃO TEM SEÇÃO NO QUESTIONÁRIO — nenhuma (medido
//    em 2026-09-27: a palavra "severidade" não aparece naquele documento). O
//    rótulo dele vem do docblock de `src/lib/severidade.ts` ("COM QUE FORÇA
//    esta trilha fala quando choveu"), com "trilha" trocado por "lugar". Fica
//    dito porque é uma pergunta que o app passa a FAZER na tela do dono sem o
//    questionário nunca ter feito;
//  - o resto (o título da tela, a frase de ausência, "Ponto N") é redação
//    minha sem fonte anterior. 🔴 "Sim"/"Não" SAÍRAM DESTE ARQUIVO na Task 6
//    (foram pra `./campos/palavras`, ainda `PENDENTE`, porque o interruptor
//    também as escreve) — junto com as frases novas dos editores, que moram
//    lá e em cada arquivo de `./campos/`.
//
// 🔴 O QUE NÃO PODE ENTRAR AQUI: nome de lugar, substantivo de lugar
// ("portão", "guarita", "parque") e qualquer fato de roteiro. Rótulo é sobre a
// FORMA do dado; o dado é a prop.
// ─────────────────────────────────────────────────────────────────────────────

// PENDENTE: redação minha, o João ainda não leu
const TITULO = "A ficha inteira";

// PENDENTE: redação minha, o João ainda não leu
const AUSENTE = "Não sei — o app não diz nada sobre isto.";

/** O "sim" de um booleano e o "sim" do bloco opcional são a MESMA palavra de
 *  propósito: as duas respondem a mesma forma de pergunta ("este lugar tem
 *  isto?"), e duas palavras diferentes pro mesmo sim seriam dois idiomas na
 *  mesma tela.
 *
 *  🔴 AS DUAS MUDARAM DE ARQUIVO NA TASK 6 (estão em `./campos/palavras`, ainda
 *  `PENDENTE`) porque o INTERRUPTOR também as escreve: a leitura e a escrita do
 *  mesmo campo não podem falar duas línguas. */

/** O prefixo do bloco de um campo que vive dentro de uma LISTA — hoje só os
 *  waypoints têm índice. Conta a partir de **1**: o dono não conta pontos do
 *  zero.
 *
 *  🔴 A REDAÇÃO ANTERIOR ERA `Parada N`, e o comentário dizia que *"a palavra é
 *  a que o trajeto usa"* — **era falso, e um re-revisor mediu**: a palavra
 *  "parada" não existe em lugar nenhum do app fora deste arquivo. O que o
 *  trajeto usa é **ponto** (`### O nome do ponto` no questionário,
 *  `className="waypoint"` e o bloco `📍 Trajeto` na ficha pública). Com
 *  `Parada` o bloco saía `Parada 1 · O nome do ponto` — duas palavras para a
 *  mesma coisa na mesma linha, que é o *"dois idiomas na mesma tela"* que este
 *  arquivo condena duas vezes. */
// PENDENTE: redação minha, o João ainda não leu
const parada = (n: number): string => `Ponto ${n}`;

/** O título de cada grupo. Chaveado por `GrupoDaFicha`, então um grupo novo no
 *  registro NÃO compila até ganhar título aqui — o `Record` é o guarda, não a
 *  minha memória. */
const TITULO_DO_GRUPO: Record<GrupoDaFicha, string> = {
  // PENDENTE: redação minha, o João ainda não leu
  voz: "O que o lugar é, na voz de quem foi",
  // PENDENTE: redação minha, o João ainda não leu
  chegar: "Como se chega, e o que se encontra no caminho",
  // PENDENTE: redação minha, o João ainda não leu
  custo: "O que custa",
  // PENDENTE: redação minha, o João ainda não leu
  quando: "Quando dá pra ir",
  // PENDENTE: redação minha, o João ainda não leu
  condicao: "O que a chuva faz aqui",
  // PENDENTE: redação minha, o João ainda não leu
  discriminador: "O que se olha na entrada pra decidir",
};

/** O rótulo de cada campo do registro que NÃO é molde, chaveado pelo caminho.
 *  As folhas de um ponto do trajeto (as que vêm como molde) estão em
 *  `ROTULO_DO_PONTO`, logo depois deste mapa.
 *
 *  🔴 NÃO É `Record<string, string>` POR COMODIDADE: um `Record` de chaves
 *  literais não fecharia o buraco (o registro é anotado `readonly
 *  CampoDaFicha[]`, então `caminho` é `string` e o compilador não tem a lista).
 *  Quem guarda é o teste "todo campo do registro tem rótulo, e não há rótulo
 *  sobrando", que compara os dois conjuntos nas DUAS direções. Sem ele, campo
 *  novo no registro nasceria na tela chamado pelo caminho cru — a espécie
 *  "lista à mão cega ao que cresceu", que este projeto já pagou quatro vezes
 *  nesta rodada. */
export const ROTULOS: Record<string, string> = {
  // — o que o lugar é, na voz de quem foi —
  // PENDENTE: redação minha, o João ainda não leu
  rotulo_escaneio: "O rótulo de escaneio",
  // PENDENTE: redação minha, o João ainda não leu
  promessa: "A promessa",
  // PENDENTE: redação minha, o João ainda não leu
  voz: "A voz",
  // PENDENTE: redação minha, o João ainda não leu
  premio: "O prêmio",

  // — como se chega, e o que se encontra no caminho —
  // 🔴 As quatro folhas de um PONTO do trajeto NÃO ENTRAM AQUI: elas vêm no
  // registro como MOLDE (`[]` = qualquer índice) e o rótulo delas mora em
  // `ROTULO_DO_PONTO`, logo abaixo. Ver a justificativa lá.
  // PENDENTE: redação minha, o João ainda não leu
  acesso: "O acesso",
  // PENDENTE: redação minha, o João ainda não leu
  avisos: "Os avisos",
  // PENDENTE: redação minha, o João ainda não leu
  piso: "O piso da via",
  // PENDENTE: redação minha, o João ainda não leu
  carroComum: "Carro comum chega até lá?",

  // — o que custa —
  // PENDENTE: redação minha, o João ainda não leu
  "custo.tag": "Custa ou é grátis",
  // PENDENTE: redação minha, o João ainda não leu
  "custo.valor": "Quanto é, e como se paga",
  // PENDENTE: redação minha, o João ainda não leu
  "custo.curto": "O custo em três ou quatro palavras",

  // — quando dá pra ir —
  // PENDENTE: redação minha, o João ainda não leu
  horario: "Este lugar tem hora pra abrir e pra fechar?",
  // PENDENTE: redação minha, o João ainda não leu
  "horario.abre": "A hora de abrir",
  // PENDENTE: redação minha, o João ainda não leu
  "horario.fecha": "A hora de fechar",
  // PENDENTE: redação minha, o João ainda não leu
  dias: "Os dias da semana em que abre",

  // — o que a chuva faz aqui —
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.coords": "A coordenada de onde se mede a chuva, e onde o pin aparece no mapa da home",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.regra.janela_previsao_horas": "Quantas horas pra frente olhar se vem chuva",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.regra.janela_passado_horas": "Quantas horas pra trás olhar se choveu",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.regra.limiar_mm": "De quantos milímetros de chuva conta",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.severidade": "Com que força este lugar fala quando choveu",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.regra_texto": "O texto da regra",
  // PENDENTE: redação minha, o João ainda não leu
  "condicao.ressalva_proxy": "A ressalva do proxy",
  // PENDENTE: redação minha, o João ainda não leu
  secaRapido: "Por que o chão firma rápido aqui",

  // — o que se olha na entrada pra decidir —
  // PENDENTE: redação minha, o João ainda não leu
  "discriminador.formato": "O formato",
  // PENDENTE: redação minha, o João ainda não leu
  "discriminador.como_ler": "O que se lê no lugar",
  // PENDENTE: redação minha, o João ainda não leu
  "discriminador.permissao_abortar": "A permissão de dar meia-volta",
};

/** O rótulo das folhas de um PONTO do trajeto, chaveado pela FOLHA (o último
 *  degrau do caminho) — não pelo caminho do registro.
 *
 *  🔴 DUAS RAZÕES, e a segunda é uma trava de verdade deste repositório:
 *
 *  1. O rótulo de `nome` é o mesmo no ponto 1 e no ponto 7 — quem varia é o
 *     PREFIXO (`Parada 3 · …`), e ele sai do índice do caminho. Chavear pelo
 *     caminho do registro obrigaria a repetir o molde aqui pra dizer quatro
 *     coisas que não dependem dele.
 *  2. `tests/lib/coerencia-acervo.test.ts` crava que a string
 *     `waypoints` + colchete VAZIO só existe em `src/lib/campos-da-ficha.ts`,
 *     e a razão do guarda é boa: colchete vazio não pode virar esconderijo de
 *     um leitor de cadeia de verdade. Escrever o molde aqui o deixaria vermelho
 *     — e eu não tenho licença pra mexer naquele arquivo nesta tarefa. Chavear
 *     pela folha não é fuga do guarda: é a forma que não precisa do molde.
 *
 *  ⚠️ "Último degrau" basta hoje porque as folhas de um ponto são rasas
 *  (`nome`, `lat`, `lng`, `nota`). Se um molde ganhar folha ANINHADA, duas
 *  folhas de nome igual em pais diferentes colidiriam aqui — e o teste de
 *  cobertura de rótulos fica vermelho antes de a tela mentir. */
export const ROTULO_DO_PONTO: Record<string, string> = {
  // PENDENTE: redação minha, o João ainda não leu
  nome: "O nome",
  // PENDENTE: redação minha, o João ainda não leu
  lat: "A latitude",
  // PENDENTE: redação minha, o João ainda não leu
  lng: "A longitude",
  // PENDENTE: redação minha, o João ainda não leu
  nota: "A nota",
};

/** O par de coordenadas, quando o valor é o par e não uma metade solta.
 *  `condicao.coords` é `{lat, lng}`; `trajeto.waypoints[].lat` é um número. As
 *  duas formas são `especie: "coord"` no registro, de propósito (o schema as
 *  declara diferentes) — então quem MOSTRA tem que aguentar as duas. */
function ehPar(valor: unknown): valor is { lat: number; lng: number } {
  if (typeof valor !== "object" || valor === null) return false;
  const p = valor as { lat?: unknown; lng?: unknown };
  return typeof p.lat === "number" && typeof p.lng === "number";
}

/** COMO CADA ESPÉCIE VIRA TEXTO. Chaveado por `EspecieCampo`, pela mesma razão
 *  do `TITULO_DO_GRUPO`: espécie nova no registro não compila até dizer como
 *  aparece — em vez de cair num `String(valor)` de reserva e a tela mostrar
 *  `[object Object]` na mão do dono.
 *
 *  🔴 `lista` SAI CRU (`barro`, `nao-va`, `sab, dom`), e isso é decisão desta
 *  tarefa, não esquecimento. Existe `rotuloPiso` e `rotuloDias` pra DUAS das
 *  quatro listas do registro; `custo.tag` e `condicao.severidade` não têm
 *  palavra neutra nenhuma (o que existe pra severidade é a fala do CARIMBO,
 *  que embute um número da ficha). Traduzir duas e deixar duas em código
 *  cru seria dois idiomas na mesma tela; e cunhar as duas que faltam é copy
 *  nova sobre a voz dos lugares, que não se decide numa tarefa de render.
 *
 *  🔴 ESTA FRASE PROMETIA QUE "a palavra de cada opção nasce na LISTA FECHADA do
 *  editor da Task 6" — E A TASK 6 NÃO A CUMPRIU. O `EditorLista` oferece as
 *  opções pelo CÓDIGO delas (`barro`, `nao-va`, `sab`), as mesmas que este
 *  `MOSTRAR` imprime, e por exatamente a razão do parágrafo acima: `custo.tag` e
 *  `condicao.severidade` não têm palavra neutra nenhuma no app, e cunhá-las é
 *  copy nova sobre um lugar real, que não se escreve sem o dono ler. Trocar o
 *  arquivo onde a promessa mora não a torna paga. **Fica como dívida escrita, e
 *  ela é de PALAVRA, não de código:** quatro listas, quatro conjuntos de opções
 *  pra ele ler e batizar, e aí `rotuloPiso`/`rotuloDias` entram junto com as
 *  duas que faltam — de uma vez, pra tela não falar dois idiomas no meio do
 *  caminho.
 *
 *  ⚠️ NA TASK 6 O `<p>` DE LEITURA SÓ SOBRA ONDE NÃO HÁ INSTRUMENTO, ou onde o
 *  instrumento não carrega o valor (o `bloco` — ver `INSTRUMENTO` abaixo). Nos
 *  outros, quem mostra o valor é o próprio controle; um `<p>` ao lado da caixa
 *  diria a mesma coisa duas vezes. As entradas de `prosa`/`lista`/`booleano`/
 *  `hora` continuam aqui porque `bloco`, `numero` e `coord` ainda as usam e
 *  porque o `Record` é o que trava espécie nova. */
const MOSTRAR: Record<EspecieCampo, (valor: unknown) => string> = {
  prosa: (v) => String(v),
  hora: (v) => String(v),
  numero: (v) => String(v),
  lista: (v) => (Array.isArray(v) ? v.join(", ") : String(v)),
  booleano: (v) => (v === true ? SIM : NAO),
  coord: (v) => (ehPar(v) ? `${v.lat}, ${v.lng}` : String(v)),
  // 🔴 O BLOCO NÃO MOSTRA FOLHA NENHUMA. `horario` (espécie `bloco`) vem no
  // registro AO LADO de `horario.abre` e `horario.fecha` — três entradas sobre
  // o mesmo assunto —, e o que ele existe pra responder é "este lugar TEM
  // horário?": é ele que carrega o "não sei" do grupo (é assim que a porta de
  // escrita o trata — `removerCampo` no bloco tira o bloco inteiro, e é o
  // único caminho pra dizer "este lugar não fecha por horário"). Repetir aqui
  // o valor de `abre` faria a tela dizer a mesma coisa duas vezes, e o bloco
  // deixaria de responder a pergunta que é dele.
  bloco: () => SIM,
};

/** O valor que ESTA ficha tem neste caminho concreto, ou `undefined`.
 *
 *  🔴 ERA UM CAMINHADOR PRÓPRIO DE 7 LINHAS, O MESMO ALGORITMO do `lerCaminho`
 *  de `campos-da-ficha.ts` — a revisão da Task 5 mediu que os dois concordavam
 *  em 90 caminhos concretos e 22 casos de borda, e a razão do irmão existir era
 *  só que o de lá era privado do módulo. A Task 6 exportou o de lá (autorizado
 *  no A7 do brief) e apagou este. Uma pergunta, uma resposta. */
function lerValor(ficha: Ficha, caminho: string): unknown {
  return lerCaminho(ficha, caminho.split("."));
}

/** O índice da lista dentro de um caminho concreto (`trajeto.waypoints.0.nome`
 *  → `0`), ou `null` pra caminho que não passa por lista. */
function indiceDe(caminho: string): number | null {
  for (const degrau of caminho.split(".")) {
    if (/^\d+$/.test(degrau)) return Number(degrau);
  }
  return null;
}

/** O rótulo de um caminho CONCRETO. Quem tem índice ganha o prefixo da parada,
 *  pra duas paradas não mostrarem dois blocos com o mesmo nome.
 *
 *  O `?? caminho` é saída de emergência, NÃO a conta certa: campo sem rótulo
 *  apareceria na tela do dono chamado `condicao.regra.limiar_mm`. Quem impede
 *  isso é o teste "todo campo do registro tem rótulo, e não há rótulo
 *  sobrando", que fecha as duas direções. */
export function rotuloDe(caminho: string): string {
  const i = indiceDe(caminho);
  if (i === null) return ROTULOS[caminho] ?? caminho;
  const folha = caminho.split(".").at(-1)!;
  return `${parada(i + 1)} · ${ROTULO_DO_PONTO[folha] ?? caminho}`;
}

/** 🔴 QUAL LISTA GUARDA VÁRIAS OPÇÕES, E POR QUE ISTO É UMA TABELA À MÃO.
 *
 *  `dias` é `readonly Dia[]`; `piso`, `custo.tag` e `condicao.severidade` são
 *  UMA palavra. As quatro são `especie: "lista"` no registro, e o registro **não
 *  diz** a multiplicidade — quem a declara é o `fichaSchema`, e ler o zod aqui
 *  seria a segunda cópia do `tipoNoCaminho` que `campos-da-ficha.ts` já tem
 *  (esta tarefa não pode mexer naquele arquivo além do `export` do `lerCaminho`).
 *
 *  E não dá pra deduzir do VALOR: `piso` e `dias` são opcionais, e num campo
 *  ausente não há array nenhum pra olhar. Uma lista de vários renderizada como
 *  escolha única **trancaria o dono de gravar "sab, dom"** — a linha vermelha
 *  desta rodada —, então a tabela é o preço.
 *
 *  🔴 O QUE A TORNA HONESTA SÃO DOIS GUARDAS MEDIDOS, não este comentário:
 *  um que fecha as DUAS direções contra as entradas `lista` do registro (lista à
 *  mão cega ao que cresceu é a espécie que mais custou aqui), e outro que prova
 *  cada VALOR contra a porta de escrita de verdade — `aplicarCampo` aceita a
 *  forma que a tabela diz e recusa a outra. Tabela que mente sai vermelha. */
export const LISTA_MULTIPLA: Record<string, boolean> = {
  piso: false,
  "custo.tag": false,
  dias: true,
  "condicao.severidade": false,
};

/** O MOLDE de um caminho CONCRETO (`trajeto.waypoints.0.nome` →
 *  `trajeto.waypoints[].nome`), que é a chave com que o registro fala.
 *
 *  🔴 ISTO EXISTE PORQUE A TABELA ACIMA É CHAVEADA PELO REGISTRO e esta tela
 *  itera CAMPOS CONCRETOS. `camposDaFicha` expande `[]` nos índices que a ficha
 *  tem e **não guarda de qual molde cada campo veio**, então um
 *  `LISTA_MULTIPLA[campo.caminho]` com o caminho já expandido consultaria um
 *  espaço de chaves que a tabela não usa. Hoje nenhuma das quatro listas é
 *  molde, então aquilo estava certo **por acidente**: o dia em que uma `lista`
 *  entrar dentro de `trajeto.waypoints[]`, a consulta devolveria `undefined`, o
 *  editor renderizaria um `<select>` de UMA escolha pra um campo de várias, e o
 *  guarda das duas direções continuaria **verde** (as duas pontas dele casam no
 *  molde). Cobertura por acidente é a 50ª espécie do catálogo deste projeto; a
 *  saída é as duas pontas falarem a MESMA chave, por construção.
 *
 *  O guarda que amarra isto não é este comentário: é o teste que exige
 *  `moldeDe(concretizar(c.caminho)) === c.caminho` pra TODO campo do registro —
 *  e o registro TEM moldes (`trajeto.waypoints[].*`), então ele fica vermelho se
 *  esta função virar identidade. */
export const moldeDe = (caminho: string): string =>
  caminho
    .split(".")
    .reduce<string[]>((degraus, d) => {
      if (/^\d+$/.test(d) && degraus.length > 0) degraus[degraus.length - 1] += "[]";
      else degraus.push(d);
      return degraus;
    }, [])
    .join(".");

/** A multiplicidade de uma `lista` NUM CAMINHO CONCRETO, pela chave do
 *  registro. `undefined` é "o registro tem uma lista que a tabela não declara"
 *  — estado que o guarda das duas direções torna impossível. */
export const multiploDe = (caminho: string): boolean | undefined => LISTA_MULTIPLA[moldeDe(caminho)];

/** O INSTRUMENTO DE CADA ESPÉCIE. Chaveado por `EspecieCampo` pela mesma razão
 *  do `MOSTRAR`: **espécie nova no registro não compila até alguém decidir o
 *  instrumento dela** — em vez de nascer sem editor, invisível, com a suíte
 *  verde.
 *
 *  `null` é "ainda só leitura", com a tarefa escrita ao lado. As duas que faltam
 *  não são esquecimento: `numero` precisa da consequência ao vivo (o motor
 *  rodando com o valor novo antes de gravar) e `coord` precisa do mapa com pin
 *  arrastado — são as Tasks 7 e 8, e cada uma é um componente próprio.
 *
 *  `mostraOValor` é o que decide se o `<p>` de leitura sai: onde o controle já
 *  traz o valor dentro dele, um `<p>` ao lado diria a mesma coisa duas vezes. O
 *  `bloco` é a exceção e ela é de significado, não de estilo — com o bloco
 *  PRESENTE o editor dele não mostra caixa nenhuma (só o botão que tira o bloco
 *  inteiro), então quem responde "este lugar TEM horário?" continua sendo o
 *  `<p>` com o `SIM` do `MOSTRAR`. */
const INSTRUMENTO: Record<EspecieCampo, { Editor: Editor; mostraOValor: boolean } | null> = {
  prosa: { Editor: EditorProsa, mostraOValor: true },
  lista: { Editor: EditorLista, mostraOValor: true },
  booleano: { Editor: EditorBooleano, mostraOValor: true },
  hora: { Editor: EditorHora, mostraOValor: true },
  bloco: { Editor: EditorBloco, mostraOValor: false },
  numero: null, // Task 7 — o número de motor com a consequência ao vivo
  coord: null, // Task 8 — o mapa com o pin que se arrasta
};

/** Os caminhos de espécie `bloco` DESTA ficha, tirados do registro expandido —
 *  nunca uma lista escrita aqui. Irmão do `BLOCOS_OPCIONAIS` de
 *  `campos-da-ficha.ts`, e pelo mesmo motivo: quem acrescentar um bloco ao
 *  registro ganha o comportamento sem tocar neste arquivo. */
const blocosDe = (campos: readonly CampoDaFicha[]): string[] =>
  campos.filter((c) => c.especie === "bloco").map((c) => c.caminho);

/** O bloco que CONTÉM este caminho, se houver (`horario.abre` → `horario`). */
const blocoQueContem = (blocos: readonly string[], caminho: string): string | undefined =>
  blocos.find((b) => caminho.startsWith(`${b}.`));

/** UM campo na tela: rótulo, o valor (ou a marca de ausente), e o instrumento
 *  que grava aquele campo sozinho.
 *
 *  🔴 AUSENTE É `undefined`, NADA MAIS. `carroComum: false` é uma AFIRMAÇÃO
 *  ("não chega") e aparece como "Não"; `""` nunca chega ao documento (a porta
 *  de escrita recusa caixa vazia). Um `!valor` aqui misturaria o `false` e o
 *  `0` com o silêncio — e `condicao.regra.limiar_mm` pode ser `0`.
 *
 *  🔴 A MARCA DE AUSENTE CONTINUA SENDO ESCRITA MESMO COM EDITOR, e isso é o
 *  ponto da tela: o bloco diz "não sei" em cima e oferece o instrumento embaixo.
 *  O campo que o app cala tem que dizer que cala — se o editor aparecesse
 *  sozinho, um campo vazio ficaria indistinguível de um campo nunca respondido.
 *
 *  🔴 E A FOLHA DE UM BLOCO AUSENTE NÃO GANHA EDITOR NENHUM (A3 do brief).
 *  Com o `horario` ausente, a porta RECUSA `{campo: "horario.abre"}` com a frase
 *  "preencha o `horario` inteiro de uma vez" — oferecer ali uma caixa de hora
 *  com um Salvar seria a tela convidando a um ato que a porta nega. Quem oferece
 *  as duas horas juntas é o editor DO BLOCO. */
function Bloco({
  ficha,
  campo,
  blocos,
  folhasDoBloco,
}: {
  ficha: Ficha;
  campo: CampoDaFicha;
  blocos: readonly string[];
  folhasDoBloco: (bloco: string) => CampoNaTela["folhas"];
}) {
  const valor = lerValor(ficha, campo.caminho);
  const ausente = valor === undefined;

  const bloco = blocoQueContem(blocos, campo.caminho);
  const blocoAusente = bloco !== undefined && lerValor(ficha, bloco) === undefined;
  const instrumento = blocoAusente ? null : INSTRUMENTO[campo.especie];

  const naTela: CampoNaTela = {
    caminho: campo.caminho,
    rotulo: rotuloDe(campo.caminho),
    obrigatorio: campo.obrigatorio,
    ...(campo.opcoes ? { opcoes: campo.opcoes, multiplo: multiploDe(campo.caminho) } : {}),
    ...(campo.especie === "bloco" ? { folhas: folhasDoBloco(campo.caminho) } : {}),
  };

  return (
    <div
      className="adm-campo"
      data-testid={`campo-${campo.caminho}`}
      {...(ausente ? { "data-ausente": "" } : {})}
    >
      <span className="adm-campo-rotulo" data-rotulo={campo.caminho}>
        {rotuloDe(campo.caminho)}
      </span>
      {ausente ? (
        <p className="adm-campo-ausente">{AUSENTE}</p>
      ) : (
        (instrumento === null || !instrumento.mostraOValor) && (
          <p className="adm-campo-valor">{MOSTRAR[campo.especie](valor)}</p>
        )
      )}
      {instrumento !== null && <instrumento.Editor campo={naTela} valor={valor} slug={ficha.slug} />}
    </div>
  );
}

export default function FichaInteira({ ficha }: { ficha: Ficha }) {
  const campos = camposDaFicha(ficha);
  const blocos = blocosDe(campos);
  const folhasDoBloco = (bloco: string): CampoNaTela["folhas"] =>
    campos
      .filter((c) => c.caminho.startsWith(`${bloco}.`))
      .map((c) => ({
        // A chave é o nome da folha DENTRO do bloco, que é o que `gravarBloco`
        // espera no corpo do `PUT` — nunca o caminho completo.
        chave: c.caminho.slice(bloco.length + 1),
        caminho: c.caminho,
        rotulo: rotuloDe(c.caminho),
      }));
  // Os grupos SAEM DOS CAMPOS DESTA FICHA, na ordem em que o registro os
  // declara — nunca de uma lista de grupos escrita aqui. Duas consequências
  // que valem: grupo novo no registro aparece sozinho, e grupo sem campo
  // nenhum não vira caixa vazia na tela. A ORDEM é contrato desta tela (é a
  // ordem em que o dono lê a ficha, e a §3 do desenho), e há teste cravando a
  // sequência das seis.
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  return (
    <section className="adm-ficha-inteira" data-ficha-inteira={ficha.slug}>
      <h2>{TITULO}</h2>
      {grupos.map((g) => (
        <section key={g} className="adm-grupo" data-testid={`grupo-${g}`}>
          <h3>{TITULO_DO_GRUPO[g]}</h3>
          {campos
            .filter((c) => c.grupo === g)
            .map((c) => (
              <Bloco
                key={c.caminho}
                ficha={ficha}
                campo={c}
                blocos={blocos}
                folhasDoBloco={folhasDoBloco}
              />
            ))}
        </section>
      ))}
    </section>
  );
}
