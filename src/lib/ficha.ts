import fs from "node:fs";
import path from "node:path";
import { fichaSchema, type Ficha } from "@/types/ficha";

const FICHAS_DIR = path.join(process.cwd(), "content", "fichas");

// Ordem de readdir é estável por acaso, não por contrato: muda com o sistema
// de arquivos e com o nome do JSON. O acervo e a home dependem de uma ordem
// que a pessoa reconheça, então ela é declarada aqui — pura e exportada, pra
// o critério ter teste próprio, independente do que existe em content/fichas
// (que é conteúdo do dono do projeto, não fixture de teste).
export function ordenarPorNome(fichas: Ficha[]): Ficha[] {
  return [...fichas].sort((a, b) =>
    a.trajeto.waypoints[0].nome.localeCompare(b.trajeto.waypoints[0].nome, "pt-BR"),
  );
}

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

// Reexportada aqui pra ficar "junto do resto que descreve uma ficha" — mas a
// implementação mora em src/lib/duracao.ts, um módulo puro, sem `node:fs`.
// Quem precisar importá-la de um client component importa de lá direto, não
// daqui: este arquivo carrega `node:fs`/`node:path` no topo,
// e isso quebra o bundle do navegador. Ver o comentário em duracao.ts.
export { formatarDuracao } from "./duracao";
