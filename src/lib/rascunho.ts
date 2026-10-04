/** O LUGAR NOVO, ANTES DE EXISTIR (Tarefa 11): de onde sai o endereço dele, e
 *  o que um rascunho tem quando nasce. Desde a Tarefa 11b (2026-10-04), o lugar
 *  nasce com NOME e CIDADE, e é a cidade que separa dois lugares de mesmo nome.
 *
 *  ⚠️ Sem `zod` e sem o registro de campos de propósito: este módulo é lido pela
 *  rota e pela página de servidor, mas nada aqui precisaria pesar no celular. */

/** A NORMALIZAÇÃO DO ENDEREÇO, e o dono nunca digita um slug.
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

/** 🔴 O ENDEREÇO DE UM LUGAR NOVO É O NOME E A CIDADE (Tarefa 11b, decisão do
 *  João em 2026-10-04: *"a Pedra do Navio existe uma em Bom Jardim e outra em
 *  Floresta"*). Devolve os endereços a TENTAR, em ordem — a rota fica com o
 *  primeiro que estiver livre:
 *
 *   - o normal é `slugDoNome(nome + " " + cidade)`, um só;
 *   - quando o nome JÁ TERMINA com a cidade (como palavra: `…-de-x` e `x`), ou
 *     É a cidade, a cidade não se repete — e a forma inteira vem logo atrás.
 *     🔴 A forma inteira existe porque a elisão faz dois nomes DIFERENTES
 *     caírem no mesmo endereço ("Mirante X" em X e "Mirante" em X): sem ela, o
 *     segundo seria recusado com o endereço de um lugar que não é ele (11b-I5).
 *
 *  As telas do app (`SLUGS_RESERVADOS`) nunca saem daqui: com a cidade sempre
 *  dentro, só a elisão chegaria a um nome sem hífen, e aí a forma inteira é a
 *  que fica. Nome ou cidade sem letra nem número: lista vazia — quem chama
 *  recusa antes, com a frase de cada um.
 *
 *  ⚠️ O ENDEREÇO NASCE UMA VEZ E NÃO MUDA: renomear, ou mudar a cidade, depois
 *  não mexe nele — link que já circula continua valendo. */
export function enderecosDoLugar(nome: string, cidade: string): string[] {
  const n = slugDoNome(nome);
  const c = slugDoNome(cidade);
  if (n === "" || c === "") return [];
  const inteiro = `${n}-${c}`;
  const semRepetir = n === c || n.endsWith(`-${c}`) ? [n, inteiro] : [inteiro];
  return semRepetir.filter((e) => !SLUGS_RESERVADOS.includes(e));
}

/** O nome com a cidade entre parênteses, quando há cidade — é como uma frase do
 *  painel distingue dois lugares de mesmo nome. Sem cidade, só o nome: nunca
 *  "sem cidade", que seria palavra nova pra um silêncio. */
export const nomeComCidade = (nome: string, cidade: string | undefined): string =>
  cidade ? `${nome} (${cidade})` : nome;

// PENDENTE: redação minha, o João ainda não leu
export const NOME_VAZIO = "O lugar precisa de um nome: escreva como você o chama.";
// PENDENTE: redação minha, o João ainda não leu
export const NOME_SEM_LETRA = "Esse nome não tem letra nem número, e não dá pra fazer o endereço dele.";
// PENDENTE: redação minha, o João ainda não leu
export const CIDADE_VAZIA = "O lugar precisa da cidade onde ele fica: é ela que separa dois lugares de mesmo nome.";
// PENDENTE: redação minha, o João ainda não leu
export const CIDADE_SEM_LETRA = "Essa cidade não tem letra nem número, e não dá pra fazer o endereço do lugar com ela.";

/** 🔴 AS QUATRO RECUSAS DE COLISÃO, e cada uma diz o que é VERDADE no caso dela.
 *  `quem` é sempre o lugar que JÁ EXISTE, com o nome e a cidade DELE lidos do
 *  dado (`nomeComCidade`) — nunca o que foi digitado agora.
 *   - PAR: o mesmo nome na mesma cidade (pela normalização do endereço). Aqui
 *     dizer "esse nome nessa cidade" é verdade.
 *   - ENDEREÇO: o endereço que sairia está ocupado por um lugar de nome OU
 *     cidade diferente. A frase NUNCA diz que o nome é o mesmo, porque não é
 *     (era o m-D da re-revisão da Tarefa 11, e o I5 da auditoria da 11b). */
// PENDENTE: redação minha, o João ainda não leu
export const parDeLugar = (quem: string): string =>
  `Já existe no app um lugar com esse nome nessa cidade: ${quem}. Mude o que já existe pela lista.`;
// PENDENTE: redação minha, o João ainda não leu
export const parDeRascunho = (quem: string): string =>
  `Já tem um lugar novo começado com esse nome nessa cidade: ${quem}. Continue por ele, na lista do painel.`;
// PENDENTE: redação minha, o João ainda não leu
export const enderecoDeLugar = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de outro lugar do app: ${quem}. Mude um pouco o nome pra diferenciar.`;
// PENDENTE: redação minha, o João ainda não leu
export const enderecoDeRascunho = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de um lugar novo começado: ${quem}. Mude um pouco o nome, ou continue por ele na lista do painel.`;

/** O DOCUMENTO COM QUE UM RASCUNHO NASCE — e é tudo o que ele tem.
 *
 *  🔴 NADA É PRÉ-PREENCHIDO (spec §4.4): nenhum campo vem de outro lugar, de
 *  busca, ou de mim. Quatro chaves, e cada uma tem dono:
 *   - `slug` — a identidade, derivada do nome e da cidade;
 *   - `trajeto.waypoints[0].nome` — o nome que ELE acabou de digitar;
 *   - `cidade` — a cidade que ELE acabou de digitar (Tarefa 11b);
 *   - `modos: []` — ruling R3 da spec: o campo fica no schema e sai do
 *     formulário, e criar grava a lista vazia. Não afirma nada sobre o lugar
 *     (nenhuma tela lê `modos` hoje).
 *  Há teste que cria o rascunho pela rota, com o acervo inteiro no banco, e
 *  exige este documento EXATO. */
export function docDoLugarNovo(slug: string, nome: string, cidade: string): string {
  return JSON.stringify({ slug, modos: [], cidade, trajeto: { waypoints: [{ nome }] } });
}

/** O nome que a LISTA do painel mostra pra um rascunho: o do ponto `0`, que é
 *  o que ele digitou ao criar (e que ele pode ter trocado depois, pela pergunta
 *  do nome). Documento que não abre, ou sem nome, cai no slug — nunca em
 *  "sem nome", que seria palavra nova pra um caso que não deveria existir.
 *
 *  Serve a QUALQUER documento de lugar, não só a rascunho: a colisão por par
 *  (nome, cidade) da rota lê com ela também o nome dos lugares no ar. */
export function nomeDoRascunho(doc: string, slug: string): string {
  try {
    const nome = (JSON.parse(doc) as { trajeto?: { waypoints?: { nome?: unknown }[] } }).trajeto?.waypoints?.[0]
      ?.nome;
    return typeof nome === "string" && nome.trim() !== "" ? nome : slug;
  } catch {
    return slug;
  }
}

/** A CIDADE de qualquer documento de lugar, ou `undefined` — documento que não
 *  abre, ou sem cidade. Ausente é silêncio: os lugares que nasceram antes da
 *  Tarefa 11b não têm cidade até o dono respondê-la. (Cidade EM BRANCO não
 *  chega a documento nenhum: o POST e a caixa vazia de toda porta de escrita a
 *  recusam antes — por isso não há ramo pra ela aqui.) */
export function cidadeDoDoc(doc: string): string | undefined {
  try {
    const cidade = (JSON.parse(doc) as { cidade?: unknown }).cidade;
    return typeof cidade === "string" ? cidade : undefined;
  } catch {
    return undefined;
  }
}
