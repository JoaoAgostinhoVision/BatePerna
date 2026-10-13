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
 *  Desde a onda de fix da Tarefa 11b, nenhum endereço de lugar novo chega a
 *  uma delas POR CONSTRUÇÃO: o endereço é sempre nome + cidade, os dois com
 *  letra, então tem sempre um hífen no meio — e nenhuma tela tem. A lista fica
 *  como a prova disso, e por isso é VIGIADA PELO DISCO: o teste
 *  `route-admin-rascunho.test.ts` lê as pastas de `src/app`, de `src/app/admin`
 *  e de `src/app/contribuir` (o editar dela mora em `/contribuir/<slug>`) e
 *  exige esta lista igual, nas duas direções, e um outro caso
 *  exige que nenhuma tenha hífen. Pasta de rota nova sem reserva, ou com hífen,
 *  fica vermelha. */
export const SLUGS_RESERVADOS: readonly string[] = ["admin", "api", "chuva", "contribuir", "icones", "trilhas", "novo"];

/** O nome com a cidade entre parênteses, quando há cidade — é como uma frase do
 *  painel distingue dois lugares de mesmo nome. Sem cidade, só o nome: nunca
 *  "sem cidade", que seria palavra nova pra um silêncio. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Formato meu (" (Cidade)").
export const nomeComCidade = (nome: string, cidade: string | undefined): string =>
  cidade ? `${nome} (${cidade})` : nome;

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const NOME_VAZIO = "O lugar precisa de um nome: escreva como você o chama.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const NOME_SEM_LETRA = "Esse nome não tem letra nem número, e não dá pra fazer o endereço dele.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const CIDADE_VAZIA = "O lugar precisa da cidade onde ele fica: é ela que separa dois lugares de mesmo nome.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const CIDADE_SEM_LETRA = "Essa cidade não tem letra nem número, e não dá pra fazer o endereço do lugar com ela.";

/** 🔴 AS CINCO RECUSAS DE COLISÃO, e cada uma diz o que é VERDADE no caso dela.
 *  `quem` é sempre o lugar que JÁ EXISTE, com o nome e a cidade DELE lidos do
 *  dado (`nomeComCidade`) — nunca o que foi digitado agora.
 *   - PAR: o mesmo nome na mesma cidade (pela normalização do endereço). Aqui
 *     dizer "esse nome nessa cidade" é verdade.
 *   - GÊMEO SEM CIDADE (onda de fix da 11b): o mesmo nome, e o que já existe
 *     ainda não tem a cidade respondida. Pode ser o mesmo lugar ou outro, e só
 *     o dono sabe — a frase pede a cidade DAQUELE primeiro, e nunca diz que é
 *     o mesmo lugar nem que não é. `quem` aqui é só o nome (não há cidade).
 *   - ENDEREÇO: o endereço que sairia está ocupado por um lugar de nome OU
 *     cidade diferente. A frase NUNCA diz que o nome é o mesmo, porque não é
 *     (era o m-D da re-revisão da Tarefa 11, e o I5 da auditoria da 11b).
 *     🔴 E NUNCA MANDA MUDAR O NOME (onda de fix 2 da 11b, I-N2 da re-revisão):
 *     o nome digitado é o de um lugar real, e inventar outro pra caber num
 *     endereço é o defeito. Ainda é alcançável — a fronteira entre o nome e a
 *     cidade que anda ("Lugar Marcador" em "Cidade Marcador" × "Lugar Marcador
 *     Cidade" em "Marcador"), e um lugar NO AR, que guarda o endereço com que
 *     nasceu, depois de renomeado ou de ter a cidade corrigida. A frase diz o
 *     que é verdade e a única saída que existe: se é o MESMO lugar, seguir por
 *     ele. Se não é, o painel não tem saída hoje, e a frase diz isso. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const parDeLugar = (quem: string): string =>
  `Já existe no app um lugar com esse nome nessa cidade: ${quem}. Mude o que já existe pela lista.`;
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const parDeRascunho = (quem: string): string =>
  `Já tem um lugar novo começado com esse nome nessa cidade: ${quem}. Continue por ele, na lista do painel.`;
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const gemeoSemCidade = (quem: string): string =>
  `Já tem um lugar com esse nome que ainda está sem a cidade: ${quem}. Responda primeiro a cidade dele, pela lista do painel: só você sabe se é o mesmo lugar.`;
// 🔴 FRASE NOVA NA TAREFA 11e (M7 da auditoria): a anterior terminava com "se
// não for, o painel ainda não sabe dar outro endereço a este" — e deixou de ser
// verdade quando o endereço passou a ser trocável. O caso que a motivou é o dele
// (a Pedra do Navio publicada em Bom Jardim por engano e corrigida pra
// Floresta): o painel do OUTRO lugar avisa que o endereço ainda diz a cidade
// velha e oferece trocar, e depois disso este endereço fica livre.
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const enderecoDeLugar = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de outro lugar do app: ${quem}. Se for o mesmo lugar, mude o que já existe pela lista. Se não for, e a cidade dele foi corrigida, o painel dele oferece trocar o endereço; depois disso, este fica livre.`;
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const enderecoDeRascunho = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de um lugar novo começado: ${quem}. Se for o mesmo lugar, continue por ele na lista do painel; se não for, o painel ainda não sabe dar outro endereço a este.`;
// As duas de baixo: o PAINEL quando quem colide é rascunho de QUEM USA o app
// (I4 da pré-auditoria de 07/10). Ele não está na lista do painel, então
// "continue por ele na lista" seria mentira. Elas nomeiam o rascunho: é o
// painel do João, que já lê nome e e-mail de quem manda. Nenhuma diz "nessa
// cidade": a do par vale também no ramo do gêmeo sem cidade.
// PENDENTE: redação minha, o João ainda não leu (I4 da pré-auditoria de 07/10)
export const parDeRascunhoDeQuemUsa = (quem: string): string =>
  `Alguém que usa o app está mandando um lugar com esse nome: ${quem}. Ele ainda não foi publicado; se for o mesmo lugar, espere ele ir ao ar e confira por lá.`;
// PENDENTE: redação minha, o João ainda não leu (I4 da pré-auditoria de 07/10)
export const enderecoDeRascunhoDeQuemUsa = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de um lugar que alguém que usa o app está mandando: ${quem}. Se for o mesmo lugar, espere ele ir ao ar e confira por lá; se não for, o painel ainda não sabe dar outro endereço a este.`;

/** A recusa do PUT do rascunho quando ele já não mora no endereço pedido
 *  (Tarefa 12, I1 da auditoria de 06/10): publicado, apagado ou movido entre a
 *  leitura e a gravação. Nada foi gravado — e nenhum rascunho renasceu ali. */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const RASCUNHO_NAO_EXISTE_MAIS =
  "Nada foi gravado: este rascunho não está mais neste endereço. Ele foi publicado, apagado, ou mudou de nome ou de cidade: volte pela lista do painel.";

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

/** O documento de um rascunho com o `slug` de dentro trocado pelo endereço
 *  novo — o endereço do rascunho acompanha o nome e a cidade (onda de fix 2 da
 *  11b), e o documento não pode dizer um endereço e morar noutro. A chave
 *  continua onde estava (o espalhamento mantém a ordem). */
export function docNoEndereco(doc: string, slug: string): string {
  return JSON.stringify({ ...(JSON.parse(doc) as Record<string, unknown>), slug });
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
