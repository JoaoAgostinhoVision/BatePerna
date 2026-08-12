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

function loadAll(): Ficha[] {
  if (!fs.existsSync(FICHAS_DIR)) return [];
  return ordenarPorNome(
    fs
      .readdirSync(FICHAS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const raw = JSON.parse(fs.readFileSync(path.join(FICHAS_DIR, f), "utf8"));
        return fichaSchema.parse(raw); // throws on malformed content — fail loud at build/test
      }),
  );
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
