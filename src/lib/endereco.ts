import { slugDoNome } from "@/lib/rascunho";

/** O ENDEREÇO DE UM LUGAR PUBLICADO, e quando o painel oferece trocá-lo
 *  (Tarefa 11e, decisões do João de 04/10).
 *
 *  🔴 O ENDEREÇO MUDA SÓ QUANDO ELE MANDA. Não acompanha o nome nem a cidade
 *  sozinho (ele recusou): as três fichas do acervo mantêm os endereços de hoje
 *  mesmo depois de ganharem cidade. Quando ele CORRIGE a cidade, o painel avisa
 *  que o endereço ainda diz a cidade velha e oferece trocar pra `nome-cidade` —
 *  o desenho que ele viu:
 *
 *      Pedra do Navio  (cidade corrigida)
 *        cidade:   Floresta
 *        endereço: pedra-do-navio-bom-jardim
 *        ⚠ o endereço ainda diz bom-jardim
 *          [trocar para pedra-do-navio-floresta]
 *
 *  ⚠️ Puro, sem zod e sem banco: a página do painel (servidor) faz a conta e
 *  manda o resultado por prop; a rota usa a MESMA `enderecoSugerido`. */

/** O endereço que o nome e a cidade dão — a MESMA regra de quando um lugar
 *  nasce (`slugDoNome(nome + " " + cidade)`, em `api/admin/rascunho`), e só ela.
 *  `null` quando a cidade ou o nome não têm letra nem número: sem os dois, o
 *  endereço sairia sem o hífen do meio, e um endereço sem hífen pode ser o nome
 *  de uma tela do app (`SLUGS_RESERVADOS`). */
export function enderecoSugerido(nome: string, cidade: string | undefined): string | null {
  if (cidade === undefined || slugDoNome(nome) === "" || slugDoNome(cidade) === "") return null;
  return slugDoNome(`${nome} ${cidade}`);
}

/** O aviso "o endereço ainda diz X", ou `null`.
 *
 *  Existe SÓ quando as três coisas valem:
 *   1. há endereço a sugerir (o lugar tem cidade) e ele é DIFERENTE do atual —
 *      sem isso o aviso não tem saída (I7 da auditoria: o lugar que foi de "Bom
 *      Marcador" pra "Marcador" e voltou tem o endereço certo, e a cidade velha
 *      "marcador" é sufixo dele);
 *   2. uma cidade que o lugar JÁ TEVE no histórico, e não tem mais (pela
 *      normalização do endereço), é o FIM do endereço, depois de um hífen;
 *   3. dessas, vale a de MAIOR endereço — "bom-marcador" ganha de "marcador"
 *      quando as duas servem, porque é a que o endereço de fato diz.
 *  As três fichas que só GANHARAM cidade nunca avisam: não tiveram outra.
 *
 *  `cidadesDoHistorico` vem de todas as versões do lugar (`undefined` onde não
 *  havia cidade). Histórico que não foi lido é lista vazia → sem aviso: o
 *  painel cala em vez de supor. */
export function avisoDoEndereco({
  endereco,
  nome,
  cidade,
  cidadesDoHistorico,
}: {
  endereco: string;
  nome: string;
  cidade: string | undefined;
  cidadesDoHistorico: readonly (string | undefined)[];
}): { diz: string; sugerido: string } | null {
  const sugerido = enderecoSugerido(nome, cidade);
  if (sugerido === null || sugerido === endereco) return null;
  const agora = slugDoNome(cidade ?? "");
  const velhas = cidadesDoHistorico
    .map((c) => slugDoNome(c ?? ""))
    .filter((c) => c !== "" && c !== agora && endereco.endsWith(`-${c}`));
  if (velhas.length === 0) return null;
  const diz = velhas.reduce((maior, c) => (c.length > maior.length ? c : maior));
  return { diz, sugerido };
}

// ─── AS PALAVRAS DA TROCA ────────────────────────────────────────────────────
// Nenhuma delas o João leu. O desenho que ele viu tinha "endereço", "⚠ o
// endereço ainda diz X" e "trocar para Y"; mesmo assim são redação minha até ele
// ler a tela de verdade.

// PENDENTE: redação minha, o João ainda não leu
export const ROTULO_ENDERECO = "endereço";
// PENDENTE: redação minha, o João ainda não leu
export const aindaDiz = (cidade: string): string => `⚠ o endereço ainda diz ${cidade}`;
// PENDENTE: redação minha, o João ainda não leu
export const trocarPara = (novo: string): string => `trocar para ${novo}`;
// PENDENTE: redação minha, o João ainda não leu
export const TROCAR_MESMO = "Trocar mesmo? O endereço de agora vai levar ao novo.";
// PENDENTE: redação minha, o João ainda não leu
export const TROCANDO = "Trocando…";

// As recusas da porta (`POST /api/admin/endereco`), no corpo do 400/409.
// PENDENTE: redação minha, o João ainda não leu
export const SEM_CIDADE_PRA_ENDERECO = "Esse lugar ainda não tem cidade: responda a cidade primeiro, e o endereço sai do nome e dela.";
// PENDENTE: redação minha, o João ainda não leu
export const ENDERECO_JA_E_ESSE = "O endereço desse lugar já é o do nome e da cidade dele.";
// PENDENTE: redação minha, o João ainda não leu
export const enderecoOcupadoPorLugar = (novo: string, quem: string): string =>
  `O endereço ${novo} já é de outro lugar do app: ${quem}. Enquanto for dele, este continua no endereço de agora.`;
// PENDENTE: redação minha, o João ainda não leu
export const enderecoOcupadoPorRascunho = (novo: string, quem: string): string =>
  `O endereço ${novo} já é de um lugar novo começado: ${quem}. Enquanto for dele, este continua no endereço de agora.`;
// PENDENTE: redação minha, o João ainda não leu
export const ENDERECO_NAO_TROCOU = "Não consegui trocar o endereço: nada mudou. Recarregue a página e tente de novo.";

/** A linha do histórico na versão do ATO (I4 da auditoria): de onde o lugar
 *  veio. Voltar a uma versão restaura o DOCUMENTO, nunca o endereço. */
// PENDENTE: redação minha, o João ainda não leu
export const enderecoTrocado = (velho: string): string => `endereço trocado; antes era ${velho}`;
