import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const todos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? todos(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

/** As duas portas do Clerk: o adaptador e o middleware. */
const PORTAS = new Set([path.join(SRC, "lib", "contribuidor-sessao.ts"), path.join(SRC, "middleware.ts")]);

describe("o Clerk entra por uma porta só", () => {
  it("o enumerador leu src/ inteiro (não-vacuidade)", () => {
    const lidos = todos(SRC);
    expect(lidos.length).toBeGreaterThan(100);
    for (const p of PORTAS) expect(lidos).toContain(p);
  });

  it("nenhum outro arquivo de src/ importa @clerk", () => {
    const fora = todos(SRC).filter((f) => !PORTAS.has(f) && /from\s+["']@clerk\//.test(readFileSync(f, "utf8")));
    expect(fora.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  it("e as duas portas importam mesmo (o guarda não está cego)", () => {
    for (const p of PORTAS) expect(readFileSync(p, "utf8")).toMatch(/from\s+["']@clerk\/nextjs\/server["']/);
  });
});
