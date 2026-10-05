import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { enderecoNovoDe, enderecosAntigosDe, getClient, versaoAtual, versoesAtuais } from "@/lib/db";
import { comPrazo } from "@/lib/cache-rotas";
import { PRAZO_FICHA_MS, buscarFichas, fichaDaVersao } from "@/lib/ficha-fonte";
import { fichaSchema, type Ficha } from "@/types/ficha";
// `ordenarPorNome` mora em `ficha-fonte.ts` desde 2026-09-25 (Task 3 do plano
// "ficha no banco"): ela foi pro único lugar que a usa em produção, junto do
// `buscarFichas` que lê do banco. Se este módulo a importasse de lá e
// `ficha-fonte.ts` a importasse de volta daqui, seria um ciclo de VALOR (não
// de tipo) entre os dois — o caso irmão do que o topo de `aviso.ts` registra.
// A direção certa é só esta: `ficha.ts` importa de `ficha-fonte.ts`.
import { ordenarPorNome } from "@/lib/ficha-fonte";

// Reexportada pra `tests/lib/ficha.test.ts` continuar importando-a
// de `@/lib/ficha`, como sempre importou.
export { ordenarPorNome } from "@/lib/ficha-fonte";

const FICHAS_DIR = path.join(process.cwd(), "content", "fichas");

/** 🔴 DESDE 2026-09-25 ESTA É A ÚNICA FUNÇÃO QUE TOCA O DISCO, e ela roda SÓ
 *  na semente (`scripts/semear-fichas.ts`) e em teste. Produção lê o banco,
 *  pelos getters abaixo. Se você está prestes a chamar `loadAll` de um
 *  componente ou de uma rota, pare: é a volta das duas fontes, e o guarda em
 *  `tests/lib/sem-disco-em-producao.test.ts` existe por causa disso.
 *
 *  Carrega e valida todo `.json` de `dir` (default: content/fichas real).
 *  O parâmetro existe só pra teste poder apontar pra um diretório sintético
 *  sem tocar em content/fichas — que é conteúdo do dono do projeto, não
 *  fixture de teste. (A oração "em produção roda sempre com o default" morava
 *  aqui e morreu no dia em que produção parou de chamar esta função.)
 *
 *  Estoura em slug repetido. Sem isto, dois JSONs com o mesmo slug fariam a
 *  home (que agrupa num Map, onde o ÚLTIMO arquivo lido vence) e /{slug} (que
 *  usa find, onde o PRIMEIRO vence) discordarem sobre qual morro é qual — a
 *  mesma classe de defeito que a leitura de clima acabou de ser blindada
 *  contra, entrando pelo conteúdo. Mesmo tom do fichaSchema.parse logo
 *  abaixo: falha alta, em build e em teste, nunca em silêncio no portão. */
export function loadAll(dir: string = FICHAS_DIR): Ficha[] {
  if (!fs.existsSync(dir)) return [];
  const arquivoDoSlug = new Map<string, string>();
  const fichas = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const ficha = fichaSchema.parse(raw); // throws on malformed content — fail loud at build/test
      const arquivoAnterior = arquivoDoSlug.get(ficha.slug);
      if (arquivoAnterior) {
        throw new Error(
          `Slug duplicado "${ficha.slug}": ${arquivoAnterior} e ${f} declaram o mesmo slug. ` +
            `A home e a ficha da trilha divergiriam sobre qual veredito é de qual morro — ` +
            `renomeie o slug de um dos dois arquivos.`,
        );
      }
      arquivoDoSlug.set(ficha.slug, f);
      return ficha;
    });
  return ordenarPorNome(fichas);
}

/** As fichas de agora, do BANCO — não do disco.
 *
 *  🔴 `cache()` do React, e não é otimização: `[slug]/page.tsx` chama
 *  `getFicha` DUAS vezes no mesmo pedido (no `generateMetadata` e na página).
 *  Sem isto seriam duas idas ao banco por visita, e — pior — duas leituras
 *  que podem discordar se o João salvar entre elas: o título do cartão de um
 *  lugar e o corpo do outro. `cache()` dura UM pedido, então continua
 *  instantâneo entre pedidos, que é o que ele escolheu.
 *
 *  ⚠️ O `cache()` é INERTE EM TESTE, e isso foi medido (2026-09-25): fora de um
 *  pedido não há dispatcher de cache do React, nem sob `renderToStaticMarkup`,
 *  e a função embrulhada roda toda vez. Por isso nenhum teste desta suíte prova
 *  a dedução por pedido — o que existe é o guarda de FONTE em
 *  `tests/lib/ficha.test.ts` ("o getter está embrulhado em cache()"), com o
 *  porquê escrito lá. Em teste o efeito colateral é bom: cada chamada relê o
 *  banco, que é o que faz "grava versão nova e vê a mudança chegar" funcionar. */
export const getAllFichas = cache(
  async (): Promise<Ficha[]> => buscarFichas(() => versoesAtuais(getClient())),
);

export async function getFicha(slug: string): Promise<Ficha | null> {
  return (await getAllFichas()).find((f) => f.slug === slug) ?? null;
}

export async function getFichasComCondicao(): Promise<Ficha[]> {
  return (await getAllFichas()).filter((f) => f.condicao != null);
}

/** Sentinela do estouro do prazo nas leituras do DONO — `Symbol` pela mesma
 *  razão do `ESTOUROU` de `admin/[slug]/page.tsx`: não se confunde com nenhuma
 *  resposta real do banco, nem com `null` ("esse lugar não existe"). */
const ESTOUROU_DONO = Symbol("prazo da leitura do dono");

async function lerNoPrazo<T>(leitura: Promise<T>): Promise<T> {
  const r = await comPrazo<T | typeof ESTOUROU_DONO>(leitura, PRAZO_FICHA_MS, ESTOUROU_DONO);
  if (r === ESTOUROU_DONO) throw new Error("O banco não respondeu a tempo à leitura do painel.");
  return r;
}

/** O ACERVO DO DONO: todo lugar, inclusive os ESCONDIDOS, e quais estão
 *  escondidos (Task 9, 2026-10-01, B1 da auditoria).
 *
 *  🔴 POR QUE NÃO `getAllFichas`. Aquela é a leitura do PÚBLICO: filtra os
 *  ocultos (então o lugar escondido sumia da lista do próprio dono, sem caminho
 *  de volta pela tela) e MEMORIZA o que leu em `ultimaBoa`, que a home serve
 *  quando o banco cai. Ligar `incluirOcultos` naquele caminho poria o escondido
 *  na memória do público — e no primeiro tropeço do Turso a home o mostraria de
 *  volta. Por isso esta leitura é OUTRA porta: lê com `incluirOcultos`, usa a
 *  MESMA conta de documento (`fichaDaVersao`) e não toca na memória.
 *
 *  🔴 SEM MEMÓRIA, ENTÃO BANCO FORA É ERRO, não lista velha. É a tela de quem
 *  edita: mostrar uma versão antiga pra quem vai mudá-la é pior que a página de
 *  erro. O prazo é o mesmo do público (`PRAZO_FICHA_MS`). */
export async function getAcervoDoDono(): Promise<{ fichas: Ficha[]; ocultos: Set<string> }> {
  const linhas = await lerNoPrazo(versoesAtuais(getClient(), { incluirOcultos: true }));
  const fichas = ordenarPorNome([...linhas.entries()].map(([slug, v]) => fichaDaVersao(slug, v.doc)));
  const ocultos = new Set([...linhas.values()].filter((v) => v.oculto).map((v) => v.ficha_slug));
  return { fichas, ocultos };
}

/** UM lugar, pro DONO — escondido ou não. `null` só quando o lugar não existe.
 *
 *  🔴 A EXISTÊNCIA É CONFERIDA COM `versaoAtual`, NUNCA COM `getFicha` — a
 *  pré-condição que a Task 5 deixou escrita em `admin/[slug]/page.tsx`: o
 *  `getFicha` filtra os ocultos, e a página do lugar escondido dava 404 pro
 *  dono, justamente a página onde mora o botão de mostrá-lo de novo. Mesma
 *  regra da rota `api/admin/visibilidade`. */
export async function getFichaDoDono(slug: string): Promise<{ ficha: Ficha; oculto: boolean } | null> {
  const v = await lerNoPrazo(versaoAtual(getClient(), slug));
  if (v == null) return null;
  return { ficha: fichaDaVersao(slug, v.doc), oculto: v.oculto };
}

/** O LUGAR NO AR a que um ENDEREÇO VELHO leva, ou `null` (Tarefa 11e, E4).
 *
 *  🔴 SÓ LUGAR VISÍVEL: o destino passa pelo `getFicha` do público, que filtra
 *  os escondidos. O endereço velho de um lugar escondido é o MESMO 404 de
 *  qualquer endereço que nunca existiu — não revela que ali houve um lugar, nem
 *  pra onde ele foi. Usado pela página pública e pelas duas rotas que a página
 *  guardada no celular chama com o endereço de antes (`/api/confirmar`,
 *  `/api/carimbo`).
 *
 *  Banco que não responde a tempo ESTOURA (pela `lerNoPrazo` do dono): a página
 *  cai no `error.tsx`, e o service worker serve a cópia guardada — um 404 aqui
 *  apagaria essa cópia (ver `resolverNavegacao`) por uma falha que não é dele. */
export async function fichaDoEnderecoAntigo(velho: string): Promise<Ficha | null> {
  const novo = await lerNoPrazo(enderecoNovoDe(getClient(), velho));
  return novo === null ? null : getFicha(novo);
}

/** Pra onde um endereço velho leva, pro DONO — escondido ou não (M5 da
 *  auditoria da 11e: esconder é tirar do público, não do dono). */
export async function enderecoNovoDoDono(velho: string): Promise<string | null> {
  return lerNoPrazo(enderecoNovoDe(getClient(), velho));
}

/** Os endereços antigos que levam a `slug` — pro "✓ Fui" subir os relatos
 *  guardados offline no endereço de antes (I1 da auditoria da 11e).
 *
 *  ⚠️ FALHA VIRA LISTA VAZIA, e é escolha: sem ela a página do lugar inteira
 *  cairia por uma leitura acessória. O custo é o de antes desta tarefa — um
 *  relato guardado no endereço velho espera até a meia-noite e some. */
export async function antigosDoEndereco(slug: string): Promise<string[]> {
  try {
    return await lerNoPrazo(enderecosAntigosDe(getClient(), slug));
  } catch {
    return [];
  }
}
