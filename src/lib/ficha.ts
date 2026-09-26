import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { getClient, versoesAtuais } from "@/lib/db";
import { buscarFichas } from "@/lib/ficha-fonte";
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
