import type { FichaVersao } from "@/lib/db";
import { type Violacao, violacoesDoAcervo } from "@/lib/coerencia";
import { type Ficha, fichaSchema } from "@/types/ficha";

/** 🔴 O PORTÃO DA COERÊNCIA NUMA GRAVAÇÃO, e ele recusa SÓ A VIOLAÇÃO QUE A
 *  GRAVAÇÃO INTRODUZ — de duas portas: a da ficha no ar
 *  (`src/app/api/admin/ficha/route.ts`, Tarefa 3) e a de publicar
 *  (`src/app/api/admin/publicar/route.ts`, Tarefa 12, 12-I2).
 *
 *  Saiu da rota da ficha na Tarefa 12 (I8 da auditoria de 06/10) SEM MUDAR A
 *  CONTA: um arquivo de rota do Next não exporta nada além dos métodos, e a
 *  porta de publicar precisava da MESMA régua — uma cópia seria a espécie "duas
 *  respostas pra mesma pergunta". NÃO mora em `coerencia.ts` de propósito: os
 *  alvos de `scripts/mutar.mjs` lá são por linha, e uma linha a mais deixaria as
 *  entradas "sem alvo".
 *
 *  🔴 POR QUE O DIFF, E NÃO "SE HOUVER VIOLAÇÃO, 409": uma única incoerência
 *  preexistente no acervo trancaria TODA gravação de TODO lugar, para sempre —
 *  inclusive as que a consertariam. Numa PORTA, falso positivo é pior que falso
 *  negativo: ele trava o dono de gravar uma VERDADE. A porta responde "você está
 *  introduzindo isto agora", nunca "o acervo tem um problema em algum lugar".
 *
 *  🔴 E POR QUE NÃO "FILTRAR PELO SLUG GRAVADO", que seria mais simples: as
 *  duas regras que comparam fichas entre si (`frase-emprestada`,
 *  `texto-emprestado`) acusam UM dos dois lugares do par, e qual deles depende
 *  da ordem do acervo. Filtrar deixaria passar exatamente a cópia de frase que a
 *  regra existe pra pegar.
 *
 *  🔴 QUEM CHAMA MEDE CONTRA `versoesAtuais(getClient(), { incluirOcultos: true })`
 *  — nunca `buscarFichas`/`getAllFichas` (memória de módulo: mediria contra uma
 *  leitura que as telas públicas deixaram ali), e nunca sem os ESCONDIDOS
 *  (esconder o Véu → copiar a voz dele noutro lugar → mostrar o Véu de novo:
 *  duas fichas públicas dizendo a mesma coisa). O porquê inteiro (incluindo o
 *  `comPrazo` que esta leitura NÃO usa) está na rota da ficha, onde nasceu. */

/** O PAR (`regra`, `slug`) de uma violação — e o portão compara a CONTAGEM de
 *  cada par, não o conteúdo das frases.
 *
 *  🔴 A REDAÇÃO ANTERIOR USAVA A `frase`, E ISSO TRANCAVA O DONO DE RENOMEAR O
 *  LUGAR. Medido por um re-revisor em 2026-09-27, com requisições de verdade: o
 *  nome do lugar (`trajeto.waypoints[0].nome`) aparece na frase de **todas as
 *  regras** (é o `nomeDe(f)` de `coerencia.ts`). Então, numa ficha que já tinha
 *  qualquer violação preexistente, renomear o lugar mudava a frase daquela
 *  violação, a identidade deixava de casar, e o diff classificava como
 *  **introduzida** uma violação que **já estava no acervo** — exatamente o que o
 *  ruling T3-R1 proíbe. Três medições dele:
 *
 *    - chip velho preexistente na própria ficha + renomear → **409**, e a frase
 *      falava de PREÇO;
 *    - `limiar_mm` zerado preexistente + renomear → **409**, e a frase falava de
 *      CHUVA;
 *    - a voz duplicada acusada no OUTRO lugar + renomear este → **409**, por
 *      violação de um lugar que ele não estava editando.
 *
 *  E `trajeto.waypoints[].nome` é obrigatório: **não tem "não sei", não tem
 *  saída pelo campo.** Um typo no nome do lugar é das coisas mais prováveis de
 *  se querer consertar do celular, e a porta respondia sobre outro assunto.
 *
 *  🔴 POR QUE A CONTAGEM, E NÃO O CONJUNTO DE PARES. Três regras podem acusar o
 *  MESMO par mais de uma vez: `janela-nao-zerada` empurra um achado por cada um
 *  dos três números zerados, `texto-emprestado` um por campo de prosa copiado, e
 *  `dia-repetido-ou-inventado` **um por ESPÉCIE de malformação** — no máximo
 *  dois, um de dia repetido e um de dia inventado, e não um por dia. (A redação
 *  anterior desta linha dizia "um por dia malformado" e era FALSA: medido,
 *  `["sab","sab","dom","dom"]` dá UM achado. E por esta porta aquele par nunca
 *  passa de 1, porque `dias` é `z.array(z.enum(DIAS))` e a grafia inventada é
 *  barrada com 400 antes de chegar aqui.) Comparando conjuntos, uma
 *  ficha que já tinha UMA dessas passaria a ter DUAS em silêncio — o dono
 *  quebraria o segundo campo e a porta calaria, porque o par já existia. A
 *  contagem é a leitura humana de *"a minha gravação piorou esta ficha?"*.
 *
 *  🔴 E O QUE ISTO DEIXA PASSAR, DE PROPÓSITO — está escrito porque é escolha, e
 *  não descuido. Uma gravação que MANTÉM a contagem de um par mas troca o valor
 *  errado por outro valor errado passa: se o chip já dizia R$ 1 numa ficha que
 *  cobra R$ 5, escrever R$ 12 no valor sai com 200, e o documento continua
 *  incoerente **como já estava**. É a leitura deliberada de T3-R1: numa porta, o
 *  falso positivo é pior que o falso negativo, porque **trava o dono de gravar
 *  uma verdade** — e ele não introduziu problema nenhum, herdou um. Quem cobra
 *  essa dívida são os 15 guardas de coerência do acervo, não esta porta. */
function par(v: Violacao): string {
  return JSON.stringify([v.regra, v.slug]);
}

function contarPares(violacoes: Violacao[]): Map<string, number> {
  const conta = new Map<string, number>();
  for (const v of violacoes) conta.set(par(v), (conta.get(par(v)) ?? 0) + 1);
  return conta;
}

/** O acervo INTEIRO como fichas, com o documento de `slug` trocado por `doc` —
 *  ou TIRADO, quando `doc` é `null` (o "antes" de um lugar que ainda não
 *  existe: a publicação).
 *
 *  🔴 DOCUMENTO QUE NÃO ABRE FICA DE FORA, E ISSO É DELIBERADO. Um `doc` de
 *  OUTRO lugar que não passe no `fichaSchema` de hoje derrubaria a gravação
 *  inteira com exceção — e trancaria o dono de gravar o lugar A por causa de um
 *  defeito no lugar B. A porta mede contra o que ela consegue ler. O documento
 *  DESTE slug nunca cai aqui: quem chama já o parseou. */
function acervoComo(versoes: Map<string, FichaVersao>, slug: string, doc: string | null): Ficha[] {
  const docs = new Map([...versoes].map(([s, v]) => [s, v.doc] as const));
  if (doc === null) docs.delete(slug);
  else docs.set(slug, doc);

  const fichas: Ficha[] = [];
  for (const texto of docs.values()) {
    try {
      fichas.push(fichaSchema.parse(JSON.parse(texto)));
    } catch {
      // ver o docblock: ilegível fica de fora, nunca tranca a gravação.
    }
  }
  return fichas;
}

/** A frase da violação que gravar `depois` em `slug` INTRODUZ no acervo
 *  `versoes` — ou `null`, se não introduz nenhuma. `antes` é o documento de
 *  agora daquele lugar, ou `null` se ele ainda não existe.
 *
 *  Introduzida = par cuja CONTAGEM cresceu. E a frase que volta é a do achado
 *  que não existia antes, não a primeira em ordem de tabela (medido em 27/09:
 *  com a janela do passado já zerada, zerar o LIMIAR devolvia a frase da
 *  janela — "o dono pede pra consertar X e a porta responde sobre Y"). Comparar
 *  frases AQUI é seguro: só escolhe QUAL mostrar, dentro de um par cuja contagem
 *  já cresceu — nunca decide recusar. Sem achado novo, a primeira em ORDEM DE
 *  TABELA, que é a ordem da tela do dono. */
export function violacaoIntroduzida(
  versoes: Map<string, FichaVersao>,
  slug: string,
  antes: string | null,
  depois: string,
): string | null {
  const violacoesAntes = violacoesDoAcervo(acervoComo(versoes, slug, antes));
  const contaAntes = contarPares(violacoesAntes);
  const todasDepois = violacoesDoAcervo(acervoComo(versoes, slug, depois));
  const contaDepois = contarPares(todasDepois);
  const introduzidas = todasDepois.filter((v) => (contaDepois.get(par(v)) ?? 0) > (contaAntes.get(par(v)) ?? 0));
  if (introduzidas.length === 0) return null;
  const frasesAntes = new Set(violacoesAntes.map((v) => v.frase));
  return (introduzidas.find((v) => !frasesAntes.has(v.frase)) ?? introduzidas[0]).frase;
}
