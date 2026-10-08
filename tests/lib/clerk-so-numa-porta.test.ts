import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const todos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? todos(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

/** Qualquer jeito de puxar `@clerk/*`: `from "…"`, `import "…"` sem `from`,
 *  `import("…")` e `require("…")` — o nome do pacote entre aspas, em qualquer
 *  posição. Crase só logo depois de `import(`/`require(`: solta, a crase é o
 *  jeito de os COMENTÁRIOS daqui citarem o pacote, e citar não puxa nada. */
const PUXA_CLERK = /["']@clerk\/|(?:import|require)\s*\(\s*`@clerk\//;

/** As duas portas do Clerk: o adaptador e o middleware. */
const PORTAS = new Set([path.join(SRC, "lib", "contribuidor-sessao.ts"), path.join(SRC, "middleware.ts")]);

describe("o Clerk entra por uma porta só", () => {
  it("o enumerador leu src/ inteiro (não-vacuidade)", () => {
    const lidos = todos(SRC);
    expect(lidos.length).toBeGreaterThan(100);
    for (const p of PORTAS) expect(lidos).toContain(p);
  });

  // O guarda não pode ser mais estreito que os jeitos de importar.
  it.each([
    `import { auth } from "@clerk/nextjs/server";`,
    `export { auth } from '@clerk/nextjs/server';`,
    `import "@clerk/nextjs";`,
    `const m = await import("@clerk/nextjs/server");`,
    "const m = await import(`@clerk/nextjs/server`);",
    `const m = require("@clerk/nextjs/server");`,
  ])("o guarda pega: %s", (linha) => expect(PUXA_CLERK.test(linha)).toBe(true));

  it("e não acusa comentário que só CITA o pacote", () => {
    expect(PUXA_CLERK.test("// Nenhum outro arquivo de `src/` importa `@clerk/*`")).toBe(false);
  });

  it("nenhum outro arquivo de src/ importa @clerk", () => {
    const fora = todos(SRC).filter((f) => !PORTAS.has(f) && PUXA_CLERK.test(readFileSync(f, "utf8")));
    expect(fora.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  it("e as duas portas importam mesmo (o guarda não está cego)", () => {
    for (const p of PORTAS) expect(readFileSync(p, "utf8")).toMatch(/from\s+["']@clerk\/nextjs\/server["']/);
  });
});
