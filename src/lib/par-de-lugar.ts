import { getClient, todosOsRascunhos, versoesAtuais } from "@/lib/db";
import {
  cidadeDoDoc, gemeoSemCidade, nomeComCidade, nomeDoRascunho, parDeLugar, parDeRascunho, parDeRascunhoDeQuemUsa,
  slugDoNome,
} from "@/lib/rascunho";

/** O QUE COLIDIU — sem frase. `quem` é o nome (e a cidade, se houver) de quem
 *  JÁ EXISTE, lido do dado; `slug`, o endereço dele (a rota de quem usa o lê
 *  pra saber se o rascunho que colide é DELA — I1 da revisão final — e nunca
 *  o devolve a ela). */
export type Colisao = {
  de: "lugar" | "rascunho-do-joao" | "rascunho-de-quem-usa";
  slug: string;
  semCidade: boolean;
  quem: string;
};

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
 *   - todo rascunho, de QUALQUER dono — `todosOsRascunhos`, I4 de 07/10;
 *  menos `exceto` (o próprio lugar ou rascunho, quando ele muda nome ou cidade).
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
 *  contrário da porta do endereço (`criarRascunho`, uma consulta só). Aceita
 *  porque o painel tem um dono só; a normalização não cabe numa consulta SQL.
 *
 *  🔴 DESDE 07/10 DEVOLVE O QUE COLIDIU, NÃO A FRASE (I3 da pré-auditoria): o
 *  painel fala por `fraseDoPainel`; a rota de quem usa responde frases só
 *  dela, que não nomeiam ninguém além dela (`NOME_JA_EM_USO`, Task 10; e, no
 *  rascunho, `RASCUNHO_DELA_JA_EXISTE` quando quem ocupa é um rascunho DELA —
 *  I1 da revisão final). */
export async function colisaoDoPar(
  nome: string,
  cidade: string,
  { exceto, nomeNovo }: { exceto: string | null; nomeNovo: boolean },
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
    if (achou !== null) return { de: "lugar", slug: v.ficha_slug, ...achou };
  }
  for (const r of await todosOsRascunhos(getClient())) {
    const achou = bate(r.doc, r.slug);
    if (achou !== null) return { de: r.contribuidor === null ? "rascunho-do-joao" : "rascunho-de-quem-usa", slug: r.slug, ...achou };
  }
  return null;
}

/** A FRASE DO PAINEL pra uma colisão — as de hoje, e a de quem usa quando o
 *  rascunho que colide é DELA (ele não está na lista do painel). */
export function fraseDoPainel(c: Colisao): string {
  if (c.de === "rascunho-de-quem-usa") return parDeRascunhoDeQuemUsa(c.quem);
  if (c.semCidade) return gemeoSemCidade(c.quem);
  return c.de === "lugar" ? parDeLugar(c.quem) : parDeRascunho(c.quem);
}

/** A porta do PAINEL: a colisão, na frase do painel. Mesma assinatura de hoje. */
export async function parOcupado(
  nome: string,
  cidade: string,
  o: { exceto: string | null; nomeNovo: boolean },
): Promise<string | null> {
  const c = await colisaoDoPar(nome, cidade, o);
  return c === null ? null : fraseDoPainel(c);
}

/** O dado da colisão de uma troca; a frase é de quem responde (`parDaTroca`
 *  é a porta do painel, logo abaixo). */
export async function colisaoDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<Colisao | null> {
  const nomeNovo = slugDoNome(nome) !== slugDoNome(nomeDoRascunho(atual, ""));
  return colisaoDoPar(nome, cidade, { exceto: slug, nomeNovo });
}

/** O PAR DE UMA TROCA — o lugar `slug`, cujo documento é `atual`, passa a ter
 *  `nome` e `cidade`. É a função que TODA porta que muda um lugar que já existe
 *  chama: os dois PUTs de campo (por `parDaMudanca`) e o "voltar a uma versão"
 *  da ficha no ar (M-N1 da re-revisão: era uma quarta porta sem o par). O
 *  próprio `slug` fica de fora da comparação, e o nome só é NOVO quando muda
 *  pela normalização. */
export async function parDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<string | null> {
  const c = await colisaoDaTroca(atual, slug, nome, cidade);
  return c === null ? null : fraseDoPainel(c);
}

/** O campo que é o NOME do lugar (o ponto `0`) e o da cidade: as duas metades
 *  do par. */
export const CAMPO_DO_NOME = "trajeto.waypoints.0.nome";
export const CAMPO_DA_CIDADE = "cidade";

/** O dado da colisão de uma mudança; a frase é de quem responde
 *  (`parDaMudanca` é a porta do painel, logo abaixo). */
export async function colisaoDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<Colisao | null> {
  if ((campo !== CAMPO_DO_NOME && campo !== CAMPO_DA_CIDADE) || typeof valor !== "string") return null;
  const nome = campo === CAMPO_DO_NOME ? valor : nomeDoRascunho(atual, "");
  const cidade = campo === CAMPO_DA_CIDADE ? valor : (cidadeDoDoc(atual) ?? "");
  return colisaoDaTroca(atual, slug, nome, cidade);
}

/** O PAR DE UMA MUDANÇA — o que os dois PUTs (rascunho e ficha no ar) chamam
 *  antes de gravar. Renomear, ou mudar a cidade, é a segunda porta do mesmo
 *  buraco do POST: um lugar que nasceu com um par não pode virar o par de outro
 *  depois (11b-M3, e X4 da onda de fix). O par novo é o valor que chega e a
 *  outra metade como está no documento `atual` do próprio `slug`, que fica de
 *  fora da comparação. Qualquer outro campo, ou valor que não é texto (a folha
 *  o recusa depois): `null`. */
export async function parDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<string | null> {
  const c = await colisaoDaMudanca(atual, slug, campo, valor);
  return c === null ? null : fraseDoPainel(c);
}
