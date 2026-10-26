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

/** As três portas do Clerk: o adaptador e o middleware (servidor), e o layout
 *  de `/contribuir` — o `<ClerkProvider>` que renova a sessão no navegador
 *  enquanto ela está nas telas dela (ruling do controlador na Task 14: a sessão
 *  vive ~60 s, e sem o clerk-js todo Salvar depois disso voltava 401). Cada
 *  uma com o pacote que ela importa: o layout puxa `@clerk/nextjs` (o
 *  provedor), as outras duas `@clerk/nextjs/server`. */
const PORTAS = new Map([
  [path.join(SRC, "lib", "contribuidor-sessao.ts"), "@clerk/nextjs/server"],
  [path.join(SRC, "middleware.ts"), "@clerk/nextjs/server"],
  [path.join(SRC, "app", "contribuir", "layout.tsx"), "@clerk/nextjs"],
  // A quarta porta (25/10): a tela de entrar DENTRO do app, que desenha o
  // `<SignIn>` do Clerk em vez de mandar pro portal hospedado dele (em inglês).
  [path.join(SRC, "app", "contribuir", "entrar", "[[...entrar]]", "page.tsx"), "@clerk/nextjs"],
]);

describe("o Clerk entra só pelas portas dele", () => {
  it("o enumerador leu src/ inteiro (não-vacuidade)", () => {
    const lidos = todos(SRC);
    expect(lidos.length).toBeGreaterThan(100);
    for (const p of PORTAS.keys()) expect(lidos).toContain(p);
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

  it("e as quatro portas importam mesmo (o guarda não está cego)", () => {
    for (const [p, pacote] of PORTAS) {
      expect(readFileSync(p, "utf8"), path.relative(process.cwd(), p)).toMatch(new RegExp(`from\\s+["']${pacote}["']`));
    }
  });
});
