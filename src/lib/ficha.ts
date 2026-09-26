import fs from "node:fs";
import path from "node:path";
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

/** Carrega e valida todo `.json` de `dir` (default: content/fichas real).
 *  O parâmetro existe só pra teste poder apontar pra um diretório sintético
 *  sem tocar em content/fichas — que é conteúdo do dono do projeto, não
 *  fixture de teste; em produção roda sempre com o default.
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

export function getAllFichas(): Ficha[] {
  return loadAll();
}

export function getFicha(slug: string): Ficha | null {
  return loadAll().find((f) => f.slug === slug) ?? null;
}

export function getFichasComCondicao(): Ficha[] {
  return loadAll().filter((f) => f.condicao != null);
}
