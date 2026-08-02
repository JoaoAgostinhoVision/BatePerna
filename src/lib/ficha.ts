import fs from "node:fs";
import path from "node:path";
import { fichaSchema, type Ficha } from "@/types/ficha";

const FICHAS_DIR = path.join(process.cwd(), "content", "fichas");

function loadAll(): Ficha[] {
  if (!fs.existsSync(FICHAS_DIR)) return [];
  return fs
    .readdirSync(FICHAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(FICHAS_DIR, f), "utf8"));
      return fichaSchema.parse(raw); // throws on malformed content — fail loud at build/test
    });
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
