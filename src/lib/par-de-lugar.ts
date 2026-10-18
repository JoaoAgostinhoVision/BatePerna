import { enderecoNovoDe, getClient, lerRascunho, listarRascunhos, versaoAtual, versoesAtuais } from "@/lib/db";
import {
  cidadeDoDoc, enderecoDeLugar, enderecoDeRascunho, gemeoSemCidade, nomeComCidade, nomeDoRascunho, parDeLugar,
  parDeRascunho, slugDoNome,
} from "@/lib/rascunho";

/** O QUE COLIDIU — sem frase. `quem` é o nome (e a cidade, se houver) de quem
 *  JÁ EXISTE, lido do dado. */
export type Colisao = {
  de: "lugar" | "rascunho-do-joao";
  semCidade: boolean;
  quem: string;
};

/** QUEM PERGUNTA (Task 17): o João, pelo painel, ou quem usa o app, pelas
 *  rotas dela. Muda só o que conta como ocupado — ver `colisaoDoPar`. */
export type QuemPergunta = "joao" | "pessoa";

/** 🔴 A COLISÃO POR PAR (NOME, CIDADE) — Tarefa 11b, 2026-10-04, e UMA função só
 *  para as três portas que mudam o nome ou a cidade de um lugar: o POST do lugar
 *  novo, o PUT do rascunho e o PUT da ficha no ar (X4 da onda de fix — antes a
 *  ficha no ar não conferia nada). Mora aqui, e não numa das rotas, porque um
 *  arquivo de rota do Next não pode exportar nada além dos métodos.
 *
 *  Até a Tarefa 11b a colisão era por NOME (onda de conserto 1 da Tarefa 11), e
 *  o João a desfez: dois lugares podem ter o mesmo nome, e às vezes a diferença
 *  é só a cidade. O que continua sendo o MESMO lugar é o par — mesmo nome E
 *  mesma cidade, comparados pela normalização do endereço (`slugDoNome`: sem
 *  acento, sem caixa, pontuação e espaços colapsados). Lido do DADO (o nome do
 *  ponto `0` e a `cidade` de cada documento), nunca do endereço: o endereço de
 *  um lugar não diz nada confiável sobre o nome nem sobre a cidade dele.
 *  Contra:
 *   - a versão ATUAL de todo lugar, SEM filtro de `oculto` — um lugar escondido
 *     é um lugar, e volta ao ar;
 *   - 🔴 e, SÓ quando quem pergunta é o João, os rascunhos DELE
 *     (`listarRascunhos`): é a lista dele, e a frase manda continuar por ela.
 *     Rascunho de quem usa o app não conta pra ninguém, e o do João não conta
 *     contra ela (Task 17, decisão do João de 13/10: "rascunho não deve
 *     bloquear", "Nenhum ocupa"). Até ali TODO rascunho, de qualquer dono,
 *     ocupava o par (I4 de 07/10), e um rascunho abandonado o ocupava pra
 *     sempre. Quem publica primeiro fica com o par; o segundo esbarra no
 *     LUGAR, na hora de publicar;
 *  menos `exceto` (o próprio lugar ou rascunho, quando ele muda nome ou cidade).
 *
 *  🔴 RASCUNHO DO JOÃO SEM CIDADE NÃO É GÊMEO (17/10: o lugar nasce só do nome,
 *  e a cidade só chega com o ponto): o gêmeo sem cidade é pergunta pra quem
 *  responde a cidade de um LUGAR, e rascunho ainda sem cidade é o estado normal
 *  de todo lugar novo — contá-lo recusaria o segundo "Pedra do Navio" dele com
 *  uma frase que manda responder uma cidade que nem existe ainda. Só lugar
 *  conta como gêmeo; rascunho do João COM cidade continua contando no par.
 *
 *  🔴 O GÊMEO DE UM LUGAR SEM CIDADE (X2 da onda de fix): o par só separa dois
 *  lugares quando os DOIS têm cidade. Os que nasceram antes da 11b não têm até o
 *  dono respondê-la, e um lugar com o MESMO nome de um deles pode ser o mesmo
 *  lugar ou outro — só ele sabe. Então a recusa pede a cidade daquele primeiro
 *  (`gemeoSemCidade`). Cidade sem letra nem número conta como sem cidade (não
 *  separa nada). Isto some sozinho quando todo lugar tiver cidade: é a mesma
 *  conferência, não há código a apagar. Ninguém deduz a cidade por ele.
 *
 *  🔴 E A ESPERA É DE QUANDO O NOME NASCE OU MUDA (`nomeNovo`, Y1 da onda de
 *  fix 2 — o I-N1 da re-revisão): o POST, e o PUT que troca o nome (no rascunho,
 *  na ficha no ar, e o "voltar a uma versão"). Responder a CIDADE nunca esbarra
 *  nela, só no par — é o ato que desfaz a dúvida, e recusá-lo deixava dois
 *  lugares de mesmo nome sem cidade pedindo, cada um, a cidade do outro
 *  primeiro, sem saída. Vale também pra quem ainda NÃO tem cidade: renomear um
 *  lugar sem cidade pro nome de outro sem cidade espera. ⚠️ Isso NÃO impede
 *  que dois lugares de mesmo nome fiquem sem cidade: renomear um lugar sem
 *  cidade pro nome de outro COM cidade passa, e o "voltar a uma versão" de
 *  antes da cidade a apaga (medido na re-revisão 2 da 11b). Não trava: cada um
 *  ainda recebe a sua cidade, porque responder a cidade só esbarra no par.
 *  Reescrever o MESMO nome noutra grafia não é nome
 *  novo (`parDaTroca` compara pela normalização).
 *
 *  Devolve o que colidiu — com o nome (e a cidade, se houver) de QUEM JÁ
 *  EXISTE —, ou `null` se está livre. Sem nome, nada a conferir. Sem CIDADE
 *  (só a ficha no ar chega assim: as 3 de antes da 11b), o par não é conferido —
 *  não há par a comparar —, e só a espera do gêmeo vale (quando o nome muda).
 *
 *  ⚠️ Esta conferência LÊ e depois a rota GRAVA — há janela entre as duas, ao
 *  contrário da porta do endereço (`criarRascunho`, uma consulta só): a
 *  normalização não cabe numa consulta SQL. Desde 07/10 MUITAS pessoas chamam
 *  esta função (as rotas de quem usa), não só o dono do painel — a premissa
 *  "um dono só" que a sustentava ficou falsa (M7 da revisão final). O risco
 *  real segue pequeno: o par igual quase sempre vira o MESMO endereço, e o
 *  `ON CONFLICT`/`NOT EXISTS` do statement que grava recusa o segundo — pro
 *  lugar de quem usa, desde a Task 17, o statement que decide é o 1º passo do
 *  batch de `publicarRascunho` (o rascunho dela não ocupa endereço). O que
 *  a janela ainda deixa passar: o gêmeo de um lugar SEM cidade (a espera
 *  dele é só desta leitura — o endereço difere, e o statement não o vê) e a
 *  corrida com uma renomeação do João no meio (o par muda sem o endereço
 *  mudar). Aceito por isso, não por haver um dono só.
 *
 *  🔴 DESDE 07/10 DEVOLVE O QUE COLIDIU, NÃO A FRASE (I3 da pré-auditoria): o
 *  painel fala por `fraseDoPainel`; a rota de quem usa responde uma frase só
 *  dela, que não nomeia ninguém (`NOME_JA_EM_USO`, Task 10). */
export async function colisaoDoPar(
  nome: string,
  cidade: string,
  { exceto, nomeNovo, quem }: { exceto: string | null; nomeNovo: boolean; quem: QuemPergunta },
): Promise<Colisao | null> {
  const n = slugDoNome(nome);
  const c = slugDoNome(cidade);
  if (n === "") return null;
  const bate = (doc: string, slug: string): { semCidade: boolean; quem: string } | null => {
    const nomeDeles = nomeDoRascunho(doc, slug);
    if (slug === exceto || slugDoNome(nomeDeles) !== n) return null;
    const deles = cidadeDoDoc(doc);
    if (deles === undefined || slugDoNome(deles) === "") return nomeNovo ? { semCidade: true, quem: nomeDeles } : null;
    return slugDoNome(deles) === c ? { semCidade: false, quem: nomeComCidade(nomeDeles, deles) } : null;
  };
  for (const v of (await versoesAtuais(getClient(), { incluirOcultos: true })).values()) {
    const achou = bate(v.doc, v.ficha_slug);
    if (achou !== null) return { de: "lugar", ...achou };
  }
  if (quem === "pessoa") return null;
  for (const r of await listarRascunhos(getClient())) {
    const achou = bate(r.doc, r.slug);
    if (achou !== null && !achou.semCidade) return { de: "rascunho-do-joao", ...achou };
  }
  return null;
}

/** QUEM OCUPA um endereço que `criarRascunho` ou `moverRascunho` recusou — a
 *  frase nomeia o lugar (ou o rascunho do João) que JÁ ESTÁ lá, com o nome e a
 *  cidade DELE, lidos do dado. `versaoAtual`, NUNCA a leitura pública
 *  (`versoesAtuais` sem `incluirOcultos`): com ela, um lugar escondido levaria a
 *  frase do rascunho. Era o `quemOcupa` da rota do rascunho; mora aqui porque a
 *  rota do Next não pode exportar nada além dos métodos. */
export async function quemOcupaNoPainel(endereco: string): Promise<string> {
  const lugar = await versaoAtual(getClient(), endereco);
  if (lugar !== null) {
    return enderecoDeLugar(nomeComCidade(nomeDoRascunho(lugar.doc, endereco), cidadeDoDoc(lugar.doc)));
  }
  // `lerRascunho` (só os do João): o rascunho de quem usa o app não ocupa
  // endereço — a chave dele nunca é um endereço (Task 17), e o `criarRascunho`
  // não o vê.
  const r = await lerRascunho(getClient(), endereco);
  const doc = r?.doc ?? "";
  return enderecoDeRascunho(nomeComCidade(nomeDoRascunho(doc, endereco), cidadeDoDoc(doc)));
}

/** 🔴 O QUE IMPEDE O RASCUNHO DO PAINEL DE MORAR NO `nome-cidade` DELE — a
 *  frase do painel, ou `null` quando nada impede (17/10, a saída (b) do João).
 *  Gravar o ponto grava sempre o ponto e a cidade; quando o par (o nome nessa
 *  cidade) já é de outro, ou o endereço que sairia já é de outro, o rascunho
 *  fica numa chave provisória, e é ESTA função que diz por quê — a mesma
 *  régua do ponto: o par com `nomeNovo: false` (o gêmeo sem cidade é da tela
 *  do nome, spec §2.3.1), e o endereço pelas duas tabelas que `moverRascunho`
 *  confere, com a frase de `quemOcupaNoPainel`. Sem nome ou sem cidade com
 *  letra não há `nome-cidade` a impedir: `null`. `slug` é a chave de agora do
 *  rascunho, fora da comparação. */
export async function travaDoPainel(doc: string, slug: string): Promise<string | null> {
  const nome = nomeDoRascunho(doc, "");
  const cidade = cidadeDoDoc(doc) ?? "";
  if (slugDoNome(nome) === "" || slugDoNome(cidade) === "") return null;
  const doPar = await parOcupado(nome, cidade, { exceto: slug, nomeNovo: false });
  if (doPar !== null) return doPar;
  const destino = slugDoNome(`${nome} ${cidade}`);
  if (destino === slug) return null;
  const ocupado = (await versaoAtual(getClient(), destino)) !== null || (await lerRascunho(getClient(), destino)) !== null;
  return ocupado ? quemOcupaNoPainel(destino) : null;
}

/** 🔴 O QUE TRAVA O PUBLICAR DELA, para o aviso das perguntas (Task 4): `true`
 *  quando o par (o nome nessa cidade) já é de um LUGAR, ou o endereço que sairia
 *  dele já é de um lugar ou é o endereço ANTIGO de um — as mesmas recusas que o
 *  publicar dela dá (`NOME_JA_EM_USO`). Só lugar conta: o rascunho de ninguém
 *  ocupa nada dela (decisão do João de 13/10), nem o do João (`quem: "pessoa"`).
 *  O par com `nomeNovo: false`, como `travaDoPainel`: o gêmeo sem cidade é da
 *  tela do nome. Devolve só o booleano — a frase dela não nomeia ninguém (I3).
 *  Sem nome ou sem cidade com letra, não há par nem endereço: `false`. */
export async function travaDaPessoa(doc: string): Promise<boolean> {
  const nome = nomeDoRascunho(doc, "");
  const cidade = cidadeDoDoc(doc) ?? "";
  if (slugDoNome(nome) === "" || slugDoNome(cidade) === "") return false;
  if ((await colisaoDoPar(nome, cidade, { exceto: null, nomeNovo: false, quem: "pessoa" })) !== null) return true;
  const destino = slugDoNome(`${nome} ${cidade}`);
  return (await versaoAtual(getClient(), destino)) !== null || (await enderecoNovoDe(getClient(), destino)) !== null;
}

/** A FRASE DO PAINEL pra uma colisão. */
export function fraseDoPainel(c: Colisao): string {
  if (c.semCidade) return gemeoSemCidade(c.quem);
  return c.de === "lugar" ? parDeLugar(c.quem) : parDeRascunho(c.quem);
}

/** A porta do PAINEL: a colisão vista pelo João, na frase do painel. */
export async function parOcupado(
  nome: string,
  cidade: string,
  o: { exceto: string | null; nomeNovo: boolean },
): Promise<string | null> {
  const c = await colisaoDoPar(nome, cidade, { ...o, quem: "joao" });
  return c === null ? null : fraseDoPainel(c);
}

/** O dado da colisão de uma troca; a frase é de quem responde (`parDaTroca`
 *  é a porta do painel, logo abaixo). */
export async function colisaoDaTroca(
  atual: string, slug: string, nome: string, cidade: string, quem: QuemPergunta,
): Promise<Colisao | null> {
  const nomeNovo = slugDoNome(nome) !== slugDoNome(nomeDoRascunho(atual, ""));
  return colisaoDoPar(nome, cidade, { exceto: slug, nomeNovo, quem });
}

/** O PAR DE UMA TROCA — o lugar `slug`, cujo documento é `atual`, passa a ter
 *  `nome` e `cidade`. É a função que TODA porta que muda um lugar que já existe
 *  chama: os dois PUTs de campo (por `parDaMudanca`) e o "voltar a uma versão"
 *  da ficha no ar (M-N1 da re-revisão: era uma quarta porta sem o par). O
 *  próprio `slug` fica de fora da comparação, e o nome só é NOVO quando muda
 *  pela normalização. */
export async function parDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<string | null> {
  const c = await colisaoDaTroca(atual, slug, nome, cidade, "joao");
  return c === null ? null : fraseDoPainel(c);
}

/** O campo que é o NOME do lugar (o ponto `0`) e o da cidade: as duas metades
 *  do par. */
export const CAMPO_DO_NOME = "trajeto.waypoints.0.nome";
export const CAMPO_DA_CIDADE = "cidade";

/** O dado da colisão de uma mudança; a frase é de quem responde
 *  (`parDaMudanca` é a porta do painel, logo abaixo). */
export async function colisaoDaMudanca(
  atual: string, slug: string, campo: unknown, valor: unknown, quem: QuemPergunta,
): Promise<Colisao | null> {
  if ((campo !== CAMPO_DO_NOME && campo !== CAMPO_DA_CIDADE) || typeof valor !== "string") return null;
  const nome = campo === CAMPO_DO_NOME ? valor : nomeDoRascunho(atual, "");
  const cidade = campo === CAMPO_DA_CIDADE ? valor : (cidadeDoDoc(atual) ?? "");
  return colisaoDaTroca(atual, slug, nome, cidade, quem);
}

/** O PAR DE UMA MUDANÇA — o que os dois PUTs (rascunho e ficha no ar) chamam
 *  antes de gravar. Renomear (nos dois), ou mudar a cidade (só na ficha no
 *  ar: no rascunho a cidade sai do ponto, e o par dele se confere ali, pela
 *  saída (b) — `pontoComCidade` na rota do rascunho), passa por aqui: um lugar
 *  não pode virar o par de outro (11b-M3, e X4 da onda de fix). O par novo é o
 *  valor que chega e a outra metade como está no documento `atual` do próprio
 *  `slug`, que fica de fora da comparação. Qualquer outro campo, ou valor que
 *  não é texto (a folha o recusa depois): `null`. */
export async function parDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<string | null> {
  const c = await colisaoDaMudanca(atual, slug, campo, valor, "joao");
  return c === null ? null : fraseDoPainel(c);
}
