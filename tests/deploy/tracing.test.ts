import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import cfg from "../../next.config.mjs";

const RAIZ = process.cwd();
const APP = path.join(RAIZ, "src", "app");
const LIB = path.join(RAIZ, "src", "lib");

function arquivosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const p = path.join(dir, entrada);
    if (statSync(p).isDirectory()) return arquivosDeRota(p);
    return entrada === "page.tsx" || entrada === "route.ts" || entrada === "route.tsx" ? [p] : [];
  });
}

/** src/app/[slug]/page.tsx -> "/[slug]" ; src/app/page.tsx -> "/" */
function rotaDe(arquivo: string): string {
  const partes = path.relative(APP, path.dirname(arquivo)).split(path.sep).filter(Boolean);
  return "/" + partes.join("/");
}

/** Módulos de src/lib que leem ficha. Sem isso, a rota do cron passa batida:
 *  ela não importa @/lib/ficha direto, importa runMotor, que importa. */
function libsQueLeemFicha(): string[] {
  return readdirSync(LIB)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => readFileSync(path.join(LIB, f), "utf8").includes("@/lib/ficha"))
    .map((f) => "@/lib/" + f.replace(/\.ts$/, ""));
}

describe("cadeado de deploy", () => {
  it("toda rota que lê ficha declara content/** em outputFileTracingIncludes", () => {
    const declaradas = Object.keys(cfg.outputFileTracingIncludes ?? {});
    const alvos = ["@/lib/ficha", ...libsQueLeemFicha()];

    for (const arquivo of arquivosDeRota(APP)) {
      const fonte = readFileSync(arquivo, "utf8");
      if (!alvos.some((a) => fonte.includes(a))) continue;
      expect(
        declaradas,
        `${rotaDe(arquivo)} lê ficha por fs e precisa estar em outputFileTracingIncludes — ` +
          `senão o deploy quebra só em produção`,
      ).toContain(rotaDe(arquivo));
    }
  });
});
