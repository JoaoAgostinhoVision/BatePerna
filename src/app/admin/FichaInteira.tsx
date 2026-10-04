import {
  camposDaFicha,
  lerCaminho,
  type CampoDaFicha,
  type EspecieCampo,
  type GrupoDaFicha,
} from "@/lib/campos-da-ficha";
import { Fragment } from "react";
import type { Ficha } from "@/types/ficha";
import EditorFaixas from "./campos/EditorFaixas";
import EditorBooleano from "./campos/EditorBooleano";
import EditorCoordenada from "./campos/EditorCoordenada";
import EditorLista from "./campos/EditorLista";
import EditorNumeroDeMotor from "./campos/EditorNumeroDeMotor";
import EditorProsa from "./campos/EditorProsa";
import EditorWaypoints from "./campos/EditorWaypoints";
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
 *  (`INSTRUMENTO`, abaixo), pela mesma razão do `TITULO_DO_GRUPO`:
 *  **espécie nova no registro não compila até alguém decidir
 *  o instrumento dela.** Desde a Task 8 (2026-10-01) nenhuma sobra em leitura:
 *  `coord`, a última, ganhou o mapa que arrasta o pin.
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
//    "o custo" vira tag, valor e curto), o título não serve pra três blocos
//    diferentes e a redação é
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
  // PENDENTE: redação minha, o João ainda não leu
  cidade: "A cidade",
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
 *  declara diferentes) — então quem monta o `ponto` do mapa (`pontoDoTrajeto`)
 *  tem que separar as duas. */
function ehPar(valor: unknown): valor is { lat: number; lng: number } {
  if (typeof valor !== "object" || valor === null) return false;
  const p = valor as { lat?: unknown; lng?: unknown };
  // 🔴 FINITOS, não só `number` (onda de conserto 1 da Task 8, R3): `NaN` e
  // `Infinity` são `typeof "number"`, e um par com `lng: Infinity` descia como
  // `ponto` pro editor, cujo laço de tiles nunca terminava (medido: heap out of
  // memory). Fora de forma, o editor cai no estado vazio.
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

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

/** O INSTRUMENTO DE CADA ESPÉCIE. Chaveado por `EspecieCampo`: **espécie nova
 *  no registro não compila até alguém decidir o instrumento dela** — em vez de
 *  nascer sem editor, invisível, com a suíte verde.
 *
 *  🔴 O CONTROLE É O VALOR, em toda espécie: a caixa de texto traz a frase, a
 *  lista traz a opção marcada, o número de motor traz o número, o mapa traz o
 *  pin e o número embaixo dele, e o horário traz as faixas nas caixas de hora.
 *  Um `<p>` de leitura ao lado diria a mesma coisa duas vezes — e no dia em que
 *  a caixa abrisse com outro valor que o `<p>`, a tela mostraria duas respostas
 *  pra um campo só. Até a Tarefa 11d havia um mapa `MOSTRAR` (como cada espécie
 *  vira texto) e uma marca `mostraOValor` por espécie, pra uma exceção só: o
 *  BLOCO `horario`, cujo editor não mostrava caixa nenhuma com o bloco
 *  presente. O bloco virou a lista de faixas (11c) com o editor de verdade
 *  (11d), e as duas peças saíram com ele.
 *
 *  ⚠️ A DÍVIDA DE PALAVRA QUE MORAVA NO DOCBLOCK DO `MOSTRAR` CONTINUA, e é do
 *  `EditorLista`: as quatro listas (`piso`, `dias`, `custo.tag`,
 *  `condicao.severidade`) aparecem pelo CÓDIGO das opções (`barro`, `nao-va`,
 *  `sab`), porque `custo.tag` e `condicao.severidade` não têm palavra neutra
 *  nenhuma no app, e cunhá-las é copy nova sobre a voz dos lugares, que não se
 *  escreve sem o dono ler. Quatro conjuntos de opções pra ele batizar, de uma
 *  vez — pra tela não falar dois idiomas no meio do caminho. */
const INSTRUMENTO: Record<EspecieCampo, Editor> = {
  prosa: EditorProsa,
  lista: EditorLista,
  booleano: EditorBooleano,
  // O horário inteiro: a lista de faixas, com "+ outra faixa", "tirar esta
  // faixa" e UM Salvar (Tarefas 11c e 11d).
  faixas: EditorFaixas,
  numero: EditorNumeroDeMotor,
  // 🔴 `coord` ENTROU NA TASK 8: o editor mostra o número embaixo do mapa (é o
  // que o dono confere). As DUAS formas da espécie (o par e as metades de um
  // ponto) estão no docblock do `EditorCoordenada`.
  coord: EditorCoordenada,
};

/** O ÍNDICE e o PAR de um ponto do trajeto, pra a linha `.lat` dele — e só pra ela.
 *
 *  🔴 A METADE `.lat` CARREGA O MAPA DO PONTO, e o mapa precisa dos dois números
 *  pra pôr o pin; o editor não lê a ficha (é `"use client"` e só conhece a
 *  prop), então o par desce montado daqui, raso — com o ÍNDICE, que é o que a
 *  porta pede pra gravar o ponto inteiro num `PUT` só. A linha `.lng` NÃO recebe —
 *  é isso que deixa um mapa por ponto, e há teste contando. `condicao.coords`
 *  também não: lá o `valor` já é o par. */
function pontoDoTrajeto(ficha: Ficha, caminho: string): Pick<CampoNaTela, "ponto"> {
  if (!caminho.endsWith(".lat")) return {};
  const indice = indiceDe(caminho);
  const ponto = lerValor(ficha, caminho.slice(0, -".lat".length));
  return indice !== null && ehPar(ponto) ? { ponto: { indice, lat: ponto.lat, lng: ponto.lng } } : {};
}

/** UM campo na tela: rótulo, a marca de ausente quando o campo não está no
 *  documento, e o instrumento que grava aquele campo sozinho.
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
 *  ⚠️ Até a Tarefa 11d havia aqui o caso da FOLHA DE UM BLOCO AUSENTE, que não
 *  ganhava editor (a porta recusava `horario.abre` sozinho). O bloco saiu; toda
 *  entrada do registro tem instrumento. */
function Bloco({ ficha, campo }: { ficha: Ficha; campo: CampoDaFicha }) {
  const valor = lerValor(ficha, campo.caminho);
  const ausente = valor === undefined;
  const Instrumento = INSTRUMENTO[campo.especie];

  const naTela: CampoNaTela = {
    caminho: campo.caminho,
    rotulo: rotuloDe(campo.caminho),
    obrigatorio: campo.obrigatorio,
    ...(campo.opcoes ? { opcoes: campo.opcoes, multiplo: multiploDe(campo.caminho) } : {}),
    ...(campo.especie === "coord" ? pontoDoTrajeto(ficha, campo.caminho) : {}),
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
      {ausente && <p className="adm-campo-ausente">{AUSENTE}</p>}
      <Instrumento campo={naTela} valor={valor} slug={ficha.slug} />
    </div>
  );
}

export default function FichaInteira({ ficha }: { ficha: Ficha }) {
  const campos = camposDaFicha(ficha);
  // Os grupos SAEM DOS CAMPOS DESTA FICHA, na ordem em que o registro os
  // declara — nunca de uma lista de grupos escrita aqui. Duas consequências
  // que valem: grupo novo no registro aparece sozinho, e grupo sem campo
  // nenhum não vira caixa vazia na tela. A ORDEM é contrato desta tela (é a
  // ordem em que o dono lê a ficha, e a §3 do desenho), e há teste cravando a
  // sequência das seis.
  const grupos = [...new Set(campos.map((c) => c.grupo))];
  // 🔴 A CADEIA DO TRAJETO (Tarefa 10): o editor que acrescenta e tira pontos
  // mora logo DEPOIS do último campo do último ponto — é ali que o dono acabou
  // de ler a cadeia inteira. O servidor conta os pontos e escreve o rótulo do
  // último com a MESMA função dos blocos (`parada`); o editor só recebe props.
  const pontos = ficha.trajeto.waypoints.length;
  // Onde o mapa do ponto novo COMEÇA (onda de conserto 1). Não é o valor do
  // ponto novo: ele só vira dado se o dono confirmar o pin ali.
  const ultimoPonto = ficha.trajeto.waypoints[pontos - 1];
  const ultimoDoTrajeto = campos.filter((c) => c.caminho.startsWith("trajeto.waypoints.")).at(-1)?.caminho;
  return (
    <section className="adm-ficha-inteira" data-ficha-inteira={ficha.slug}>
      <h2>{TITULO}</h2>
      {grupos.map((g) => (
        <section key={g} className="adm-grupo" data-testid={`grupo-${g}`}>
          <h3>{TITULO_DO_GRUPO[g]}</h3>
          {campos
            .filter((c) => c.grupo === g)
            .map((c) => (
              <Fragment key={c.caminho}>
                <Bloco ficha={ficha} campo={c} />
                {c.caminho === ultimoDoTrajeto && (
                  <EditorWaypoints
                    slug={ficha.slug}
                    pontos={pontos}
                    rotuloDoUltimo={parada(pontos)}
                    ultimo={{ lat: ultimoPonto.lat, lng: ultimoPonto.lng }}
                  />
                )}
              </Fragment>
            ))}
        </section>
      ))}
    </section>
  );
}
