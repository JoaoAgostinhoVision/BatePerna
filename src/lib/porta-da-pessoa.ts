import { chavesForaDaPessoa, obrigatoriosDaPessoaFaltando } from "@/lib/campos-da-pessoa";
import type { Violacao } from "@/lib/coerencia";
import { getClient } from "@/lib/db";
import { estaBloqueado, registrarContribuidor } from "@/lib/db-contribuidor";
import { lerContribuidor, type QuemContribui } from "@/lib/contribuidor-sessao";
import { faixasDe, problemaDasFaixas } from "@/lib/horario";
import { FORMA_ERRADA, RASCUNHO_ILEGIVEL, SLUG_DE_DENTRO } from "@/lib/porta-de-publicar";
import { fichaSchema } from "@/types/ficha";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

// PENDENTE: redação minha, o João ainda não leu
export const CLERK_FORA = "Não deu pra conferir quem você é agora. Nada foi gravado: tente de novo daqui a pouco.";
// PENDENTE: redação minha, o João ainda não leu
export const BLOQUEADA = "Esta conta não pode mais mandar nem mudar lugares no BatePerna.";
/** A variante DELA do `RASCUNHO_NAO_EXISTE_MAIS` do painel — aquele manda
 *  "voltar pela lista do painel", que ela não tem. */
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_DELA_SUMIU =
  "Nada foi gravado: este rascunho não está mais neste endereço. Ele foi publicado, apagado, ou mudou de nome ou de cidade: volte pela sua lista de lugares.";
/** 🔴 O 409 DE TODA COLISÃO DELA (I3 da pré-auditoria de 07/10) — o par, o
 *  gêmeo sem cidade, o endereço ocupado por lugar ou rascunho de outro, e o
 *  endereço antigo de outro lugar. UMA frase, e de propósito: as do painel
 *  falam do painel ("pela lista do painel", "responda a cidade dele") e
 *  NOMEIAM quem ocupa — um rascunho de outra pessoa, ou um lugar escondido do
 *  João. Esta não nomeia ninguém, e foi escrita POR SUBTRAÇÃO (onda de fix da
 *  Task 10): a anterior dizia "um lugar no ar ou um que alguém está mandando"
 *  e "ele já está (ou logo estará) no app" — falso pro lugar ESCONDIDO (não
 *  está no ar) e pro ENDEREÇO ANTIGO (o nome dela não está em uso: é o
 *  endereço que sairia dele que leva a outro lugar). Sobrou só o que vale nos
 *  quatro: o nome, ou o endereço que sairia dele, já é de outro lugar — sem
 *  dizer onde ele está nem se vai ao ar.
 *
 *  📝 DECISÃO DO JOÃO, pro pacote de copy: em dois casos ela fica SEM saída —
 *  o gêmeo sem cidade (só o João responde a cidade do lugar dele) e um lugar
 *  real diferente com o mesmo nome na mesma cidade. A frase não inventa
 *  saída; o que fazer nesses dois é dele. */
// PENDENTE: redação minha, o João ainda não leu
export const NOME_JA_EM_USO =
  "Nada foi gravado: este nome, ou o endereço que sairia dele, já é de outro lugar no BatePerna, ou de um que alguém começou e ainda não publicou.";
/** O 409 quando o que colide é o rascunho DELA mesma (I1 da revisão final):
 *  `NOME_JA_EM_USO` diria "de outro lugar", e é o lugar que ELA começou — está
 *  na lista dela (`/contribuir`), que é onde ela continua. Só nomeia o que é
 *  dela, então o I3 da pré-auditoria continua valendo. Desde a mesma revisão,
 *  `NOME_JA_EM_USO` ganhou "ou de um que alguém começou": rascunho de outra
 *  pessoa (ou do João) não está "no BatePerna", e a frase não dizia isso — o
 *  acréscimo diz a categoria, nunca quem. */
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_DELA_JA_EXISTE =
  "Nada foi gravado: você já começou um lugar com este nome, ou com o endereço que sairia dele. Continue por ele, na sua lista de lugares.";

/** O 409 da edição DELA depois do "Conferi" do João (Task 12): conferido, o
 *  lugar passa a ser do BatePerna — ela não edita mais. */
// PENDENTE: redação minha, o João ainda não leu
export const JA_CONFERIDO = "Nada foi gravado: o BatePerna já conferiu este lugar, e agora só ele muda o que o app diz daqui.";

/** A PORTA DE TODA ROTA DE QUEM CONTRIBUI, nesta ordem: o Clerk respondeu
 *  (senão 503 com frase), há sessão (senão 401 — e a tela recarrega e pede
 *  login, Review Focus 4), quem é fica registrado (nome e e-mail SÓ pro painel
 *  dele), e ela não está bloqueada (senão 403 com frase). O bloqueio também
 *  mora em cada gravação (`LIVRE`, em `db-contribuidor.ts`): esta checagem dá
 *  a frase, aquela fecha a corrida. */
export async function portaDaPessoa(agora: number): Promise<{ pessoa: QuemContribui } | { resposta: Response }> {
  let pessoa: QuemContribui | null;
  try {
    pessoa = await lerContribuidor();
  } catch {
    return { resposta: new Response(CLERK_FORA, { status: 503, headers: TEXTO }) };
  }
  if (pessoa === null) return { resposta: new Response("", { status: 401, headers: TEXTO }) };
  await registrarContribuidor(getClient(), pessoa, agora);
  if (await estaBloqueado(getClient(), pessoa.id)) {
    return { resposta: new Response(BLOQUEADA, { status: 403, headers: TEXTO }) };
  }
  return { pessoa };
}

// PENDENTE: redação minha, o João ainda não leu
export const FALTA_DA_PESSOA = "Nada foi publicado: ainda falta responder pergunta obrigatória. As que faltam estão listadas nesta tela.";
// PENDENTE: redação minha, o João ainda não leu
export const FORA_DA_LISTA_DELA = "Nada foi publicado: este rascunho tem resposta que não é das perguntas daqui.";
/** O DUPLO TOQUE dela — irmã de `JA_PUBLICADO_OU_OCUPADO` do painel, com a
 *  lista DELA no lugar da do painel. Mesma cautela (M4 da auditoria da
 *  Tarefa 12): o lugar que ocupa o endereço pode ser de OUTRA pessoa ou do
 *  João, então a frase não afirma que é o dela, nem o nomeia. */
// PENDENTE: redação minha, o João ainda não leu
export const JA_NO_AR_DA_PESSOA =
  "Nada foi publicado agora: este endereço já é de um lugar do app, e o rascunho não está mais aqui. Se você tocou duas vezes, o lugar foi publicado no primeiro toque: confira na sua lista de lugares.";
// PENDENTE: redação minha, o João ainda não leu
export const RECUSA_DA_PESSOA = "Nada foi publicado: uma resposta não combina com outra. Confira as respostas e tente de novo.";

/** AS RECUSAS DA COERÊNCIA NA LÍNGUA DELA (spec de 07/10, Parte 3) — uma por
 *  regra de `coerencia.ts` que os campos dela alcançam. Regra fora daqui cai
 *  em `RECUSA_DA_PESSOA`; a frase do João (que NOMEIA outro lugar e fala do
 *  painel: "o chip", "a etiqueta", "tire os dias da ficha") nunca chega a ela.
 *
 *  Quais ela alcança, pelos campos dela (`promessa`, `acesso`, `avisos`,
 *  `custo.tag`/`custo.valor`, `horario`, `dias`): sem `piso`, a regra do piso
 *  cala; sem `custo.curto`, as três do chip calam, e a `preco-legivel-no-custo`
 *  também (ela só examina ficha paga COM chip); sem `secaRapido`, a da frase
 *  emprestada cala; sem `condicao.regra`, as de janela calam. Sobram as seis
 *  abaixo. Cada frase diz o que a REGRA confere — lida contra `coerencia.ts`
 *  (Task 11), e três ajustadas por isso:
 *   - `texto-emprestado` compara sem caixa e sem espaço nas pontas: "esta
 *     mesma frase", não "exatamente esta frase". Dos textos que a regra
 *     compara (voz, promessa, prêmio, etiqueta), ela só escreve a promessa;
 *   - `horario-invertido-sem-aviso` acusa também abrir e fechar NA MESMA hora
 *     (o app lê 24h), e não só "fecha antes de abrir"; o que a cala é
 *     "noite", "madrugada" ou "24h" no texto — e o "o que pode dar errado"
 *     (`avisos`) é um dos textos que ela lê;
 *   - `semana-inteira-nao-declara`: "pule a pergunta" não servia a quem já a
 *     respondeu; o conserto é ficar SEM resposta (o "não sei" dela tira o
 *     campo — lista vazia o schema recusa).
 *  A `dia-repetido-ou-inventado` também pega grafia inventada, que ela não
 *  alcança: `dias` é lista de opções fechadas, e o `fichaSchema` barra antes
 *  (`FORMA_ERRADA`). A frase dela fala só do dia repetido. */
export const FRASE_DA_PESSOA: Readonly<Record<string, string>> = {
  // PENDENTE: redação minha, o João ainda não leu
  "texto-emprestado": "Nada foi publicado: outro lugar do app já tem esta mesma frase do que é o lugar. Escreva com as suas palavras.",
  // PENDENTE: redação minha, o João ainda não leu
  "horario-invertido-sem-aviso":
    "Nada foi publicado: no horário, a hora de fechar não vem depois da de abrir. Se o lugar abre de noite ou fica aberto 24h, diga isso no que pode dar errado; se não, confira as duas horas.",
  // PENDENTE: redação minha, o João ainda não leu
  "hora-de-fechar-sem-campo": "Nada foi publicado: o texto diz a que horas o lugar fecha, mas a pergunta do horário não foi respondida.",
  // PENDENTE: redação minha, o João ainda não leu
  "prosa-bate-com-hora-de-fechar": "Nada foi publicado: a hora de fechar escrita no texto não é a mesma da pergunta do horário.",
  // PENDENTE: redação minha, o João ainda não leu
  "dia-repetido-ou-inventado": "Nada foi publicado: um dia da semana aparece mais de uma vez nos dias.",
  // PENDENTE: redação minha, o João ainda não leu
  "semana-inteira-nao-declara":
    "Nada foi publicado: marcar os sete dias é o mesmo que não marcar nenhum. Se o lugar abre todo dia, deixe a pergunta dos dias sem resposta.",
};

/** A abertura de toda frase de `FRASE_DA_PESSOA` e de `RECUSA_DA_PESSOA` — a
 *  do PUBLICAR. Não é frase de tela sozinha: é o pedaço que a edição troca. */
const ABERTURA_DO_PUBLICAR = "Nada foi publicado:";
/** 🔴 A abertura da EDIÇÃO do lugar dela no ar (I2 da revisão final): ali o
 *  lugar ESTÁ publicado, e "Nada foi publicado" a faria achar que ele saiu do
 *  ar. Só a mudança foi recusada. O resto da frase é o mesmo da tabela — sete
 *  frases à mão em dobro seriam sete chances de uma divergir da outra. */
// PENDENTE: redação minha, o João ainda não leu
export const ABERTURA_DA_EDICAO = "Nada foi gravado:";

/** A frase DELA pra uma violação da coerência: pela REGRA, nunca a `frase` da
 *  violação (a do painel). `ato` diz de onde ela veio: o publicar (a frase da
 *  tabela) ou a edição do lugar no ar (a mesma, aberta por
 *  `ABERTURA_DA_EDICAO`). Sem padrão: quem chama escolhe, de propósito. */
export function fraseDaPessoa(v: Violacao, ato: "publicar" | "editar"): string {
  const frase = FRASE_DA_PESSOA[v.regra] ?? RECUSA_DA_PESSOA;
  if (ato === "publicar" || !frase.startsWith(ABERTURA_DO_PUBLICAR)) return frase;
  return ABERTURA_DA_EDICAO + frase.slice(ABERTURA_DO_PUBLICAR.length);
}

/** A PORTA DE PUBLICAR DELA — irmã de `prepararPublicacao` (a do João), com a
 *  lista dela no lugar do registro. A ordem: abrir → 🔴 nada fora da lista
 *  dela (Review Focus 1: voz, regra, discriminador — venha a sobra de onde
 *  vier) → os obrigatórios DELA → o horário pela regra de escrita → o
 *  `fichaSchema` → o `slug` de dentro. Vai ao ar o documento NORMALIZADO, como
 *  no do João (o porquê de cada passo está no docblock de `prepararPublicacao`,
 *  em `porta-de-publicar.ts`). Todas as recusas são 400 na rota. */
export function prepararPublicacaoDaPessoa(texto: string, slug: string): { doc: string } | { frase: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(texto);
  } catch {
    return { frase: RASCUNHO_ILEGIVEL };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return { frase: RASCUNHO_ILEGIVEL };
  if (chavesForaDaPessoa(doc).length > 0) return { frase: FORA_DA_LISTA_DELA };
  if (obrigatoriosDaPessoaFaltando(doc).length > 0) return { frase: FALTA_DA_PESSOA };
  if ("horario" in doc) {
    const problema = problemaDasFaixas(faixasDe((doc as { horario: unknown }).horario));
    if (problema !== null) return { frase: problema };
  }
  const lido = fichaSchema.safeParse(doc);
  if (!lido.success) return { frase: FORMA_ERRADA };
  if (lido.data.slug !== slug) return { frase: SLUG_DE_DENTRO };
  return { doc: JSON.stringify(lido.data) };
}
