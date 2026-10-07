import { CAMPOS_DA_FICHA, lerCaminho } from "@/lib/campos-da-ficha";

/** O QUE O APP VAI CALAR (Tarefa 12) — uma frase por campo OPCIONAL que o
 *  rascunho deixou sem resposta, dizendo o que a ficha deixa de afirmar por
 *  causa dele. A tela de publicar mostra a lista POR EXTENSO antes do botão.
 *
 *  🔴 CALAR É PERMITIDO, E É A RÉGUA DO APP INTEIRO: onde falta o dado, o app
 *  cala em vez de inventar. A lista existe pra o dono VER o preço da
 *  honestidade, nunca pra bloquear a publicação.
 *
 *  🔴 ESTE MÓDULO LÊ O REGISTRO (`campos-da-ficha.ts`, que importa o zod e o
 *  `fichaSchema`) E POR ISSO NUNCA É IMPORTADO NO CLIENTE (G3 da auditoria): a
 *  página de servidor `/admin/novo/publicar` chama esta função e entrega as
 *  frases PRONTAS à `TelaDePublicar` por prop.
 *
 *  🔴 O CONJUNTO DE OPCIONAIS VEM DO REGISTRO (`obrigatorio: false`), nunca de
 *  uma lista à mão. Opcional novo no registro sem frase aqui deixa o teste de
 *  completude vermelho (`tests/lib/o-que-o-app-cala.test.ts`) — e, se chegasse
 *  à tela, apareceria com o CAMINHO cru, que é feio de propósito: um silêncio
 *  sem frase seria pior.
 *
 *  O molde `[]` dos pontos do trajeto vira o ponto `.0`, O LUGAR — o único que
 *  um lugar novo tem (etapas entram depois de publicar, pelo painel do lugar).
 *  Uma frase só, não uma por ponto. */

/** A régua do custo (I6 da auditoria): o valor e o chip só existem numa ficha
 *  PAGA. Num lugar grátis a ausência deles não cala nada — dizer que calou seria
 *  uma frase sobre UM tipo de lugar num componente que serve todos. */
const SO_SE_PAGO = new Set(["custo.valor", "custo.curto"]);

/** As frases, pelo caminho CONCRETO.
 *
 *  🔴 SEIS SÃO DO QUESTIONÁRIO (`docs/questionario-ficha.md`, "O que acontece
 *  depois de responder", a lista dos opcionais), que ele já leu, adaptadas só
 *  por SUBTRAÇÃO (o nome do campo na frente e o negrito saíram; a primeira
 *  letra virou maiúscula). Duas o questionário NÃO cobre — a nota do ponto e o
 *  valor do custo — e são redação minha, a menor possível. Todas PENDENTE: é a
 *  primeira vez que vão pra uma tela. */
const FRASES: Readonly<Record<string, string>> = {
  // PENDENTE: redação minha, o João ainda não leu (o questionário não cobre a nota)
  "trajeto.waypoints.0.nota": "Sem a nota, o trajeto mostra o ponto só com o nome e a coordenada.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela
  piso: "Sem ele, a ficha não mostra a linha do chão da via, e o carimbo não diz o que a chuva faz ali.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela
  carroComum: "Sem ele, o app não afirma nada sobre que carro chega.",
  // PENDENTE: redação minha, o João ainda não leu (o questionário não cobre o valor)
  "custo.valor": "Numa ficha paga sem o valor, o app não diz quanto custa nem como se paga.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela. Cortada por SUBTRAÇÃO (M6 da
  // revisão da Tarefa 12): a metade que saiu era falsa junto de outro campo ausente
  "custo.curto": "Numa ficha paga sem ele, o app não diz onde se paga.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela. Cortada por SUBTRAÇÃO (M6 da
  // revisão da Tarefa 12): a metade que saiu era falsa junto de outro campo ausente
  horario: "Sem ele, a ficha nunca fecha por hora.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela
  dias: "Sem ele, a ficha nunca fecha por dia da semana: o app não sabe que aquele lugar folga, então não afirma que folgou.",
  // PENDENTE: do questionário, que ele leu; primeira vez numa tela
  secaRapido: "Sem ele, a linha verde do carimbo termina nas horas de chuva, sem a meia-frase que explica o terreno.",
};

/** Uma frase por campo opcional AUSENTE em `doc`, na ordem do registro. Ficha
 *  com todo opcional respondido (ou só com os de custo ausentes, num lugar
 *  grátis) devolve `[]`. `doc` que não é objeto: tudo ausente. */
export function oQueOAppCala(doc: unknown): string[] {
  const pago = lerCaminho(doc, ["custo", "tag"]) === "pago";
  const frases: string[] = [];
  for (const campo of CAMPOS_DA_FICHA) {
    if (campo.obrigatorio) continue;
    const caminho = campo.caminho.replace("[]", ".0");
    if (SO_SE_PAGO.has(caminho) && !pago) continue;
    if (lerCaminho(doc, caminho.split(".")) !== undefined) continue;
    frases.push(FRASES[caminho] ?? caminho);
  }
  return frases;
}
