import { CAMPOS_DA_FICHA, lerCaminho, type CampoDaFicha } from "@/lib/campos-da-ficha";
import { rotulosDe } from "@/lib/rotulos-das-opcoes";
import { diasDosGrupos, multiploDe, rotuloDe } from "../FichaInteira";
import type { CampoNaTela, PerguntaNaTela } from "../campos/tipos";

/** AS PERGUNTAS DO LUGAR NOVO (Tarefa 11) — e este arquivo é de SERVIDOR.
 *
 *  🔴 E1 DA AUDITORIA: o `FormularioDeLugar` é `"use client"` e NÃO importa o
 *  registro (o zod e o `fichaSchema` iriam pro celular). Quem conhece o registro
 *  é este módulo, chamado só pela página `/admin/novo`; o que desce pro cliente
 *  é a lista de `PerguntaNaTela`, objeto raso. O mesmo desenho do
 *  `CampoNaTela`/`FichaInteira`.
 *
 *  🔴 E2: DUAS FONTES, CADA UMA COM UM PAPEL.
 *   - O REGISTRO (`CAMPOS_DA_FICHA`) decide QUAIS perguntas existem. O teste lê
 *     o registro, nunca esta lista: campo novo no registro sem lugar em `ORDEM`
 *     fica vermelho.
 *   - O QUESTIONÁRIO (`docs/questionario-ficha.md`, que o João já leu e que
 *     foi como dois lugares entraram) dá a REDAÇÃO e a ORDEM. Cada texto de
 *     `PERGUNTAS` é um TRECHO CONTÍNUO da "Pergunta:" daquele campo no
 *     documento — adaptado só por SUBTRAÇÃO (cortei os parênteses que mandavam
 *     pegar coordenada no Google Maps ou davam o caso de um lugar real) e com a
 *     primeira letra maiúscula. UMA troca que não é subtração, e é dele: em
 *     2026-10-07 o João decidiu *"Trocar 'essa trilha' por 'esse lugar'"* neste
 *     formulário, então "trilha" virou "lugar" com a concordância ("essa
 *     trilha" → "esse lugar", "a trilha está fechada ou aberta" → "o lugar
 *     está fechado ou aberto"). O documento dele
 *     continua dizendo "trilha"; o comentário de cada pergunta trocada diz isso.
 *     Há teste que confere cada um contra o documento (com essa troca, e só
 *     ela), e que a ordem da tela é a ordem do documento.
 *   - Campo do registro que o questionário NÃO pergunta usa `rotuloDe`, o mesmo
 *     rótulo da ficha inteira — nenhuma pergunta inventada.
 *
 *  🔴 E ESTAS PERGUNTAS NÃO TRAZEM EXEMPLO. O questionário dá, embaixo de cada
 *  pergunta, a resposta da Rampa; na tela, exemplo é resposta plausível de um
 *  lugar real que se copia sem querer (spec §4.4). Fica só a pergunta.
 *
 *  ⚠️ O texto do questionário que fala de "arquivo JSON em `content/fichas/`"
 *  está velho (a ficha mora no banco) e não vem pra cá. */

/** A redação de cada pergunta, pelo caminho CONCRETO da tela (o ponto do
 *  trajeto é o `0`, o único de um lugar novo).
 *
 *  ⚠️ CONCRETO, E NÃO O MOLDE `[]` DO REGISTRO, de propósito: o molde só mora
 *  em `src/lib/campos-da-ficha.ts`, e há guarda que exige isso
 *  (`tests/lib/coerencia-acervo.test.ts`, "colchete vazio é o MOLDE").
 *
 *  Todas nasceram PENDENTE na primeira ida à tela, mesmo vindo do questionário;
 *  as que ele leu no pacote de copy (07/10) dizem `LIDA:`. */
export const PERGUNTAS: Readonly<Record<string, string>> = {
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "trajeto.waypoints.0.nome": "Como você chama esse lugar, do jeito que chamaria conversando com alguém que já foi?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "trajeto.waypoints.0.lat": "Qual é a latitude e a longitude desse ponto?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "trajeto.waypoints.0.nota":
    "Tem alguma coisa que vale avisar sobre esse trecho específico — um detalhe de como é chegar ali, o que se vê no caminho?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  promessa: "Em uma frase, por que alguém pegaria o carro pra ir até aí?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  premio:
    "O que esse lugar entrega, especificamente, quando dá certo? Pode ser mais detalhado que a promessa — é o parágrafo, não a frase de efeito.",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  voz: "Se você tivesse que avisar um amigo sobre esse lugar em uma frase direta, sem meias palavras, o que você diria?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  rotulo_escaneio:
    "Se esse lugar tivesse uma etiqueta de três ou quatro palavras — o tipo de coisa que dá pra ler de relance, sem parar pra pensar — o que ela diria?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  acesso: "Como alguém chega até lá — que tipo de carro serve, tem algum trecho que exige cuidado?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  piso:
    "Pensando no caminho INTEIRO de carro até lá, da estrada principal até onde o carro para — qual é o PIOR trecho? Vale o pior pedaço mesmo que ele seja curto, e mesmo que ele seja justamente o último: não é a média dos trechos, e não é o piso que predomina no caminho.",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  secaRapido:
    "Quando faz umas horas que não chove, o que é que faz o chão desse lugar estar bom de novo? É o relevo, é o tipo de terra, é sol batendo? Responda em uma frase curta, do jeito que você diria pra um amigo no telefone.",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  avisos: "O que pode dar errado, e o que a pessoa devia saber antes de decidir ir?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  "condicao.coords": "Qual é a latitude e a longitude do ponto certo pra medir a chuva desse lugar?",
  // 🔴 UMA pergunta do questionário pros TRÊS números da regra. Ela abre o
  // trio, na primeira pergunta dele (a janela de trás, que é a ordem da frase);
  // as outras duas usam o rótulo, porque a pergunta já foi feita logo acima.
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  "condicao.regra.janela_passado_horas":
    'Pra esse lugar virar "frio" (não suba), quanto tempo pra trás vale olhar se choveu, quanto tempo pra frente vale olhar se vai chover, e a partir de quantos milímetros de chuva isso conta?',
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  "condicao.regra_texto":
    "Escreva a mesma regra acima, mas como frase — do jeito que você explicaria pra alguém por que o lugar está fechado ou aberto hoje.",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "condicao.ressalva_proxy": "O que a previsão do tempo não enxerga, que só quem está no lugar enxerga?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "discriminador.formato": "Em uma ou duas palavras, que tipo de checagem é essa — o que ela descreve?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "discriminador.como_ler":
    "Já na entrada, o que a pessoa deve olhar pra confirmar se dá pra ir — não a previsão, a coisa concreta que ela vê com os próprios olhos?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "discriminador.permissao_abortar": "O que você diria pra alguém que chegou até ali e decidiu não seguir?",
  // 🔴 A pergunta do custo é UMA no questionário e cobre DOIS campos: a
  // primeira frase é a `tag` (custa ou não), a segunda é o `valor`.
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela. O pacote mostrava "trilha"; a tela diz
  // "lugar" por decisão dele (07/10), tomada ANTES de ele marcar "Serve".
  "custo.tag": "Entrar nesse lugar custa alguma coisa?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "custo.valor": "Se custar, quanto, e como é cobrado (no portão, antecipado, por pessoa, por carro)?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  "custo.curto":
    "Como caberia isso em três ou quatro palavras, pro chip do topo da tela? O preço mais o onde — na sua palavra.",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  carroComum:
    'Um carro comum chega até lá? (Sim / não. Se a resposta for "sim, mas só com o chão seco", ainda é sim — a ressalva de chuva quem diz é o carimbo.)',
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  horario: "Esse lugar tem hora pra abrir e pra fechar? Se tiver, que horas?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Do questionário, que ele leu; primeira vez numa tela.
  dias: "Esse lugar abre todo dia, ou tem dia que não abre? Se tiver, em que dias ele abre?",
  // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-20. Redação minha. Do questionário (seção nova de 18/10), que ele também leu.
  horarioPorDia: "Algum dia esse lugar abre ou fecha em outra hora? Se tiver, quais dias e que horas?",
};

/** A ORDEM DA TELA: a do questionário, pelo caminho concreto (o molde do
 *  registro com o ponto `0`). Desde 17/10 o ponto é a 2ª: a cidade não é mais
 *  pergunta (ela sai do ponto, `saiDoPonto` no registro), e a pergunta dela,
 *  "Em que cidade fica esse lugar?", foi apagada daqui junto.
 *
 *  Os três campos que o questionário não pergunta por si (os dois números da
 *  regra que dividem a pergunta do primeiro, e a `condicao.severidade`) vão
 *  junto do vizinho deles no registro — a severidade logo depois do trio da
 *  regra, que é onde ela mora no registro e no bloco "O que a chuva faz aqui".
 *
 *  🔴 LISTA À MÃO, E POR ISSO VIGIADA: o teste exige que ela seja EXATAMENTE o
 *  conjunto de perguntas que o registro produz (`camposQueSaoPergunta`, no
 *  ponto `0`). */
export const ORDEM: readonly string[] = [
  "trajeto.waypoints.0.nome",
  "trajeto.waypoints.0.lat",
  "trajeto.waypoints.0.nota",
  "promessa",
  "premio",
  "voz",
  "rotulo_escaneio",
  "acesso",
  "piso",
  "secaRapido",
  "avisos",
  "condicao.coords",
  "condicao.regra.janela_passado_horas",
  "condicao.regra.janela_previsao_horas",
  "condicao.regra.limiar_mm",
  "condicao.severidade",
  "condicao.regra_texto",
  "condicao.ressalva_proxy",
  "discriminador.formato",
  "discriminador.como_ler",
  "discriminador.permissao_abortar",
  "custo.tag",
  "custo.valor",
  "custo.curto",
  "carroComum",
  "horario",
  "dias",
  "horarioPorDia",
];

/** QUAIS ENTRADAS DO REGISTRO SÃO PERGUNTA — derivado do registro, por
 *  propriedade do registro, nunca por nome, com duas saídas:
 *   - a única dobra que a tela faz: a METADE `.lng` de um ponto do trajeto mora
 *     na pergunta da `.lat`, como na ficha inteira — o questionário pergunta "a
 *     latitude e a longitude" numa frase só, e o editor de mapa grava o ponto
 *     INTEIRO num corpo só;
 *   - o que SAI DO PONTO (`saiDoPonto`, 17/10): a cidade, que o servidor tira do
 *     ponto 0 marcado no mapa. Ela continua obrigatória no registro (não se
 *     publica sem ela); só deixa de ser pergunta.
 *
 *  ⚠️ Até a Tarefa 11d havia uma segunda dobra: as folhas do bloco `horario`
 *  moravam dentro da pergunta do bloco (E2). O horário virou UMA entrada (a
 *  lista de faixas, 11c) com UM instrumento (11d), e a dobra saiu.
 *  O molde `[]` continua aqui; quem o troca pelo índice `0` é `noPonto0`. */
export function camposQueSaoPergunta(): CampoDaFicha[] {
  return CAMPOS_DA_FICHA.filter((c) => !c.saiDoPonto && !(c.especie === "coord" && c.caminho.endsWith("[].lng")));
}

/** O molde com o índice do único ponto que um lugar novo tem: o `0`, que é o
 *  próprio lugar. Etapas a mais se acrescentam depois de publicar, pelo painel
 *  do lugar (`EditorWaypoints`). */
const noPonto0 = (molde: string): string => molde.replace("[]", ".0");

function ehPar(v: unknown): v is { lat: number; lng: number } {
  if (typeof v !== "object" || v === null) return false;
  const p = v as { lat?: unknown; lng?: unknown };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Os rótulos das opções, só quando o caminho tem (`rotulosDe`); sem, nada desce. */
const rotulosNaTela = (caminho: string): Pick<CampoNaTela, "rotulos"> => {
  const rotulos = rotulosDe(caminho);
  return rotulos ? { rotulos } : {};
};

function naTela(c: CampoDaFicha, caminho: string, rascunho: unknown): CampoNaTela {
  const base: CampoNaTela = {
    caminho,
    rotulo: rotuloDe(caminho),
    obrigatorio: c.obrigatorio,
    ...(c.opcoes ? { opcoes: c.opcoes, multiplo: multiploDe(caminho), ...rotulosNaTela(caminho) } : {}),
  };
  // Os grupos do horário diferente: as caixas de dia são os dias em que ESTE
  // rascunho abre (os `dias` que ele já respondeu, que vêm antes na ordem).
  if (c.especie === "grupos") return { ...base, ...diasDosGrupos(rascunho) };
  if (c.especie === "coord") {
    // O ponto do trajeto já marcado desce com o índice e o par (o mapa põe o
    // pin nele). Sem ponto, o mapa nasce SEM PIN, na vista que a PÁGINA busca
    // (`vistaDaCoordSemPonto`) — a Tarefa 11f apagou as duas caixas de número
    // que ficavam aqui no lugar do mapa.
    const ponto = caminho.endsWith(".lat") ? lerCaminho(rascunho, caminho.split(".").slice(0, -1)) : undefined;
    const indice = Number(caminho.split(".").find((d) => /^\d+$/.test(d)));
    // 17/10: a cidade do documento desce com o PONTO 0 (a linha `.lat`), pra o mapa
    // dizer "Fica em: <cidade>" embaixo; sem cidade no documento, não desce nada.
    const cidade = (rascunho as { cidade?: unknown } | null)?.cidade;
    const daCidade = caminho === "trajeto.waypoints.0.lat" && typeof cidade === "string" && cidade !== "";
    return {
      ...base,
      ...(caminho.endsWith(".lat") && ehPar(ponto) ? { ponto: { indice, lat: ponto.lat, lng: ponto.lng } } : {}),
      ...(daCidade ? { cidade } : {}),
    };
  }
  return base;
}

/** QUAL PERGUNTA A TELA MOSTRA (onda 2: uma pergunta por vez, decisão do João
 *  de 2026-10-03) — a posição mora na URL, `?slug=X&p=N`, com N de 1 a M.
 *
 *  `p` só vale se for um número inteiro escrito só com dígitos e estiver entre
 *  1 e M. Qualquer outra coisa (ausente, vazio, letra, 0, negativo, decimal,
 *  maior que M, ou repetido na URL) cai na PRIMEIRA pergunta ainda SEM
 *  resposta — ou na 1ª, se todas tiverem. Nunca erro, nunca tela vazia: é por
 *  aqui que entra quem volta pela lista do painel, cujo link não leva `p`.
 *
 *  `respondidas[i]` diz se a pergunta `i + 1` já tem resposta no rascunho. */
export function escolherPosicao(p: string | string[] | undefined, respondidas: readonly boolean[]): number {
  if (typeof p === "string" && /^\d+$/.test(p)) {
    const n = Number(p);
    if (n >= 1 && n <= respondidas.length) return n;
  }
  const semResposta = respondidas.indexOf(false);
  return semResposta < 0 ? 1 : semResposta + 1;
}

/** AS PERGUNTAS, NA ORDEM DA TELA, COM O QUE O RASCUNHO JÁ RESPONDEU. */
export function montarPerguntas(rascunho: unknown): PerguntaNaTela[] {
  // 🔴 QUEM DECIDE QUAIS PERGUNTAS É O REGISTRO, aqui em produção também, e não
  // só no teste: a lista sai de `camposQueSaoPergunta()`; `ORDEM` só ORDENA.
  // Campo do registro que `ORDEM` ainda não conhece não some — vai pro FIM, com
  // o rótulo dele. O teste fica vermelho nesse caso (ORDEM tem de ser o
  // conjunto exato), mas a tela do dono nunca perde uma pergunta por isso.
  const posicao = (caminho: string): number => {
    const i = ORDEM.indexOf(caminho);
    return i < 0 ? ORDEM.length : i;
  };
  const campos = camposQueSaoPergunta()
    .map((c) => ({ c, caminho: noPonto0(c.caminho) }))
    .sort((a, b) => posicao(a.caminho) - posicao(b.caminho));
  return campos.map(
    ({ c, caminho }): PerguntaNaTela => ({
      especie: c.especie,
      campo: naTela(c, caminho, rascunho),
      texto: PERGUNTAS[caminho] ?? rotuloDe(caminho),
      valor: lerCaminho(rascunho, caminho.split(".")),
    }),
  );
}
