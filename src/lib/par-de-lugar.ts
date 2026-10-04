import { getClient, listarRascunhos, versoesAtuais } from "@/lib/db";
import { cidadeDoDoc, gemeoSemCidade, nomeComCidade, nomeDoRascunho, parDeLugar, parDeRascunho, slugDoNome } from "@/lib/rascunho";

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
 *   - todo rascunho;
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
 *  Devolve a frase da recusa — com o nome (e a cidade, se houver) de QUEM JÁ
 *  EXISTE —, ou `null` se está livre. O par que chega SEM cidade (ou sem nome)
 *  não é conferido: só a ficha no ar chega assim (as 3 de antes da 11b), e sem
 *  a cidade dela não há par a comparar.
 *
 *  ⚠️ Esta conferência LÊ e depois a rota GRAVA — há janela entre as duas, ao
 *  contrário da porta do endereço (`criarRascunho`, uma consulta só). Aceita
 *  porque o painel tem um dono só; a normalização não cabe numa consulta SQL. */
export async function parOcupado(nome: string, cidade: string, exceto?: string): Promise<string | null> {
  const n = slugDoNome(nome);
  const c = slugDoNome(cidade);
  if (n === "" || c === "") return null;
  const bate = (doc: string, slug: string): { semCidade: boolean; quem: string } | null => {
    const nomeDeles = nomeDoRascunho(doc, slug);
    if (slug === exceto || slugDoNome(nomeDeles) !== n) return null;
    const deles = cidadeDoDoc(doc);
    if (deles === undefined || slugDoNome(deles) === "") return { semCidade: true, quem: nomeDeles };
    return slugDoNome(deles) === c ? { semCidade: false, quem: nomeComCidade(nomeDeles, deles) } : null;
  };
  for (const v of (await versoesAtuais(getClient(), { incluirOcultos: true })).values()) {
    const achou = bate(v.doc, v.ficha_slug);
    if (achou !== null) return achou.semCidade ? gemeoSemCidade(achou.quem) : parDeLugar(achou.quem);
  }
  for (const r of await listarRascunhos(getClient())) {
    const achou = bate(r.doc, r.slug);
    if (achou !== null) return achou.semCidade ? gemeoSemCidade(achou.quem) : parDeRascunho(achou.quem);
  }
  return null;
}

/** O campo que é o NOME do lugar (o ponto `0`) e o da cidade: as duas metades
 *  do par. */
const CAMPO_DO_NOME = "trajeto.waypoints.0.nome";
const CAMPO_DA_CIDADE = "cidade";

/** O PAR DE UMA MUDANÇA — o que os dois PUTs (rascunho e ficha no ar) chamam
 *  antes de gravar. Renomear, ou mudar a cidade, é a segunda porta do mesmo
 *  buraco do POST: um lugar que nasceu com um par não pode virar o par de outro
 *  depois (11b-M3, e X4 da onda de fix). O par novo é o valor que chega e a
 *  outra metade como está no documento `atual` do próprio `slug`, que fica de
 *  fora da comparação. Qualquer outro campo, ou valor que não é texto (a folha
 *  o recusa depois): `null`. */
export async function parDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<string | null> {
  if ((campo !== CAMPO_DO_NOME && campo !== CAMPO_DA_CIDADE) || typeof valor !== "string") return null;
  const nome = campo === CAMPO_DO_NOME ? valor : nomeDoRascunho(atual, "");
  const cidade = campo === CAMPO_DA_CIDADE ? valor : (cidadeDoDoc(atual) ?? "");
  return parOcupado(nome, cidade, slug);
}
