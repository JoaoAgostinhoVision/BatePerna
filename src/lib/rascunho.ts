/** O LUGAR NOVO, ANTES DE EXISTIR (Tarefa 11): de onde sai o endereço dele, e
 *  o que um rascunho tem quando nasce.
 *
 *  ⚠️ Sem `zod` e sem o registro de campos de propósito: este módulo é lido pela
 *  rota e pela página de servidor, mas nada aqui precisaria pesar no celular. */

/** O ENDEREÇO SAI DO NOME, e o dono nunca digita um slug.
 *
 *  🔴 POR QUE NÃO PERGUNTAR O SLUG, como o questionário fazia ("se essa trilha
 *  fosse um endereço na internet…"): aquela pergunta era pra quem montava o
 *  JSON à mão. No celular, uma segunda caixa pra escrever a mesma coisa sem
 *  acento e com hífen é uma chance de os dois divergirem — o nome diz um lugar,
 *  o link diz outro. Uma resposta, uma fonte.
 *
 *  A regra é a do questionário (letras minúsculas, sem acento, palavras
 *  separadas por hífen): tira os acentos pela decomposição Unicode, troca toda
 *  sequência que não é letra ou número por UM hífen, e corta hífen das pontas.
 *  Nome sem letra nem número dá `""`, e quem chama recusa com frase. */
export function slugDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 🔴 OS NOMES QUE SÃO TELA DO PRÓPRIO APP. A ficha pública mora em `/<slug>` e
 *  o painel do lugar em `/admin/<slug>`; um segmento ESTÁTICO de rota vence o
 *  dinâmico, então um lugar chamado "Trilhas" teria a ficha escondida atrás da
 *  página do acervo, e um chamado "Novo" teria o painel atrás deste formulário —
 *  os dois inalcançáveis, sem erro nenhum na tela.
 *
 *  É uma lista à mão, e por isso é VIGIADA PELO DISCO: o teste
 *  `route-admin-rascunho.test.ts` lê as pastas de `src/app` e de
 *  `src/app/admin` e exige esta lista igual, nas duas direções. Pasta de rota
 *  nova sem reserva fica vermelha. */
export const SLUGS_RESERVADOS: readonly string[] = ["admin", "api", "icones", "trilhas", "novo"];

// PENDENTE: redação minha, o João ainda não leu
export const NOME_VAZIO = "O lugar precisa de um nome: escreva como você o chama.";
// PENDENTE: redação minha, o João ainda não leu
export const NOME_SEM_LETRA = "Esse nome não tem letra nem número, e não dá pra fazer o endereço dele.";
// PENDENTE: redação minha, o João ainda não leu
export const JA_EXISTE_LUGAR = "Já existe um lugar com esse nome no app. Escolha outro nome, ou mude o que já existe pela lista.";
// PENDENTE: redação minha, o João ainda não leu
export const JA_EXISTE_RASCUNHO = "Já tem um lugar novo começado com esse nome: continue por ele, na lista do painel.";
// PENDENTE: redação minha, o João ainda não leu
export const NOME_DE_TELA = "Esse nome é de uma tela do próprio app: escolha outro.";

/** O DOCUMENTO COM QUE UM RASCUNHO NASCE — e é tudo o que ele tem.
 *
 *  🔴 NADA É PRÉ-PREENCHIDO (spec §4.4): nenhum campo vem de outro lugar, de
 *  busca, ou de mim. Três chaves, e cada uma tem dono:
 *   - `slug` — a identidade, derivada do nome;
 *   - `trajeto.waypoints[0].nome` — o nome que ELE acabou de digitar;
 *   - `modos: []` — ruling R3 da spec: o campo fica no schema e sai do
 *     formulário, e criar grava a lista vazia. Não afirma nada sobre o lugar
 *     (nenhuma tela lê `modos` hoje).
 *  Há teste que cria o rascunho pela rota, com o acervo inteiro no banco, e
 *  exige este documento EXATO. */
export function docDoLugarNovo(slug: string, nome: string): string {
  return JSON.stringify({ slug, modos: [], trajeto: { waypoints: [{ nome }] } });
}

/** O nome que a LISTA do painel mostra pra um rascunho: o do ponto `0`, que é
 *  o que ele digitou ao criar (e que ele pode ter trocado depois, pela pergunta
 *  do nome). Documento que não abre, ou sem nome, cai no slug — nunca em
 *  "sem nome", que seria palavra nova pra um caso que não deveria existir.
 *
 *  Serve a QUALQUER documento de lugar, não só a rascunho: a colisão por nome
 *  da rota (onda de conserto 1) lê com ela também o nome dos lugares no ar. */
export function nomeDoRascunho(doc: string, slug: string): string {
  try {
    const nome = (JSON.parse(doc) as { trajeto?: { waypoints?: { nome?: unknown }[] } }).trajeto?.waypoints?.[0]
      ?.nome;
    return typeof nome === "string" && nome.trim() !== "" ? nome : slug;
  } catch {
    return slug;
  }
}
