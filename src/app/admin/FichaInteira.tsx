import {
  camposDaFicha,
  type CampoDaFicha,
  type EspecieCampo,
  type GrupoDaFicha,
} from "@/lib/campos-da-ficha";
import type { Ficha } from "@/types/ficha";

/** A FICHA INTEIRA NA TELA DO DONO (Task 5, 2026-09-27) — render puro, sem
 *  editor nenhum.
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
 *  🔴 SEM EDITOR, E ISSO É DESENHO, não pressa: os editores por espécie são a
 *  Task 6 e encaixam DENTRO de `Bloco` abaixo, no lugar do `<p>` do valor. O
 *  que esta tarefa fecha é "o dono vê a ficha inteira"; "o dono edita a ficha
 *  inteira" é a próxima.
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
//  - 🔴 `condicao.severidade` NÃO TEM SEÇÃO NO QUESTIONÁRIO — nenhuma (medido
//    em 2026-09-27: a palavra "severidade" não aparece naquele documento). O
//    rótulo dele vem do docblock de `src/lib/severidade.ts` ("COM QUE FORÇA
//    esta trilha fala quando choveu"), com "trilha" trocado por "lugar". Fica
//    dito porque é uma pergunta que o app passa a FAZER na tela do dono sem o
//    questionário nunca ter feito;
//  - o resto (o título da tela, a frase de ausência, "Sim"/"Não", "Parada N")
//    é redação minha sem fonte anterior.
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
 *  mesma tela. */
// PENDENTE: redação minha, o João ainda não leu
const SIM = "Sim";
// PENDENTE: redação minha, o João ainda não leu
const NAO = "Não";

/** O prefixo do bloco de um campo que vive dentro de uma LISTA — hoje só os
 *  waypoints têm índice, e a palavra é a que o trajeto usa. Conta a partir de
 *  1: o dono não conta paradas do zero. */
// PENDENTE: redação minha, o João ainda não leu
const parada = (n: number): string => `Parada ${n}`;

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
  "condicao.coords": "A coordenada de onde se mede a chuva",
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
  nome: "O nome do ponto",
  // PENDENTE: redação minha, o João ainda não leu
  lat: "A latitude do ponto",
  // PENDENTE: redação minha, o João ainda não leu
  lng: "A longitude do ponto",
  // PENDENTE: redação minha, o João ainda não leu
  nota: "A nota do ponto",
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
 *  nova sobre a voz dos lugares, que não se decide numa tarefa de render. A
 *  palavra de cada opção nasce na LISTA FECHADA do editor da Task 6, que é
 *  onde o dono escolhe — ali ela serve pra escolher, não só pra ler. */
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
 *  ⚠️ É um caminhador de caminho próprio, e não o do `campos-da-ficha.ts`:
 *  aquele (`lerCaminho`) é privado do módulo, e esta tarefa não pode mexer
 *  naquele arquivo. Exportá-lo lá é o conserto certo, e é decisão de quem
 *  despacha — fica relatado. Índice de lista entra como degrau normal
 *  (`arr["0"]` é `arr[0]`), que é o mesmo atalho que o irmão usa. */
function lerValor(ficha: Ficha, caminho: string): unknown {
  let no: unknown = ficha;
  for (const degrau of caminho.split(".")) {
    if (typeof no !== "object" || no === null) return undefined;
    no = (no as Record<string, unknown>)[degrau];
  }
  return no;
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

/** UM campo na tela: rótulo, e embaixo o valor ou a marca de ausente.
 *
 *  🔴 AUSENTE É `undefined`, NADA MAIS. `carroComum: false` é uma AFIRMAÇÃO
 *  ("não chega") e aparece como "Não"; `""` nunca chega ao documento (a porta
 *  de escrita recusa caixa vazia). Um `!valor` aqui misturaria o `false` e o
 *  `0` com o silêncio — e `condicao.regra.limiar_mm` pode ser `0`. */
function Bloco({ ficha, campo }: { ficha: Ficha; campo: CampoDaFicha }) {
  const valor = lerValor(ficha, campo.caminho);
  const ausente = valor === undefined;
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
        <p className="adm-campo-valor">{MOSTRAR[campo.especie](valor)}</p>
      )}
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
  return (
    <section className="adm-ficha-inteira" data-ficha-inteira={ficha.slug}>
      <h2>{TITULO}</h2>
      {grupos.map((g) => (
        <section key={g} className="adm-grupo" data-testid={`grupo-${g}`}>
          <h3>{TITULO_DO_GRUPO[g]}</h3>
          {campos
            .filter((c) => c.grupo === g)
            .map((c) => (
              <Bloco key={c.caminho} ficha={ficha} campo={c} />
            ))}
        </section>
      ))}
    </section>
  );
}
