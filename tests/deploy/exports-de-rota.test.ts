import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src", "app");

function arquivosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const p = path.join(dir, entrada);
    if (statSync(p).isDirectory()) return arquivosDeRota(p);
    return entrada === "route.ts" || entrada === "route.tsx" ? [p] : [];
  });
}

/** O que o Next aceita como export de um route handler. Qualquer outro nome
 *  faz o `next build` morrer com "Type 'X' is not assignable to type 'never'".
 *  Lista em https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 *  mais os verbos HTTP. */
const PERMITIDOS = new Set([
  "GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS",
  "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime",
  "preferredRegion", "maxDuration", "generateStaticParams", "config",
]);

/** Todo nome de valor que o arquivo exporta em runtime — o que o Next
 *  realmente vê quando confere o módulo. Cobre as formas que já derrubaram o
 *  build por 4 commits com a suíte verde:
 *
 *    export const X = ...          (já cobria)
 *    export { X }                  (fix round 2: NÃO era pega)
 *    export { X as Y }             (idem — quem conta é Y, o nome exportado)
 *    export default ...            (idem)
 *    export * from "./outro"       (idem — reexporta tudo, nome desconhecido)
 *
 *  `export type { X }` fica de fora de propósito: tipo não existe em
 *  runtime, `typeof import(...)` (que é o que o Next usa pra checar o
 *  módulo) não o enxerga, e o `next build` não reclama dele. Provado abaixo
 *  com um caso dedicado. */
function nomesExportados(fonte: string): string[] {
  const nomes: string[] = [];

  // export const/let/var/function/class NOME
  for (const m of fonte.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)/gm)) {
    nomes.push(m[1]);
  }

  // export default ...  — route handler não tem default; conta como proibido.
  if (/^export\s+default\b/m.test(fonte)) nomes.push("default");

  // export * from "..."  — reexporta tudo, nome desconhecido: proibido sempre.
  if (/^export\s+\*\s*from\b/m.test(fonte)) nomes.push("*");
  // export * as NS from "..."  — o nome que aparece é o do namespace.
  for (const m of fonte.matchAll(/^export\s+\*\s+as\s+(\w+)\s+from\b/gm)) {
    nomes.push(m[1]);
  }

  // export { a, b as c }  e  export { a, b as c } from "..."
  // (mas não `export type { ... }`, tratado à parte)
  for (const m of fonte.matchAll(/^export\s+(?!type\b)\{([^}]*)\}/gm)) {
    for (const bruto of m[1].split(",")) {
      const item = bruto.trim();
      if (!item || item.startsWith("type ")) continue; // "type X" dentro da lista: só tipo
      const partes = item.split(/\s+as\s+/);
      nomes.push(partes[partes.length - 1].trim()); // o nome que EXPORTA é o último (o "as", se houver)
    }
  }

  return nomes;
}

/** ESTE TESTE NASCEU DE UM BUILD QUEBRADO QUE A SUÍTE INTEIRA NÃO VIU.
 *
 *  Um fix round exportou uma constante de `api/lugares/route.ts` pra que um
 *  teste pudesse importá-la — precedente legítimo em módulo de lib, ilegal num
 *  route handler. Os 392 testes passaram, três revisões e uma re-revisão
 *  passaram por cima, e o `next build` estava quebrado havia quatro commits:
 *  o deploy teria falhado.
 *
 *  A lição é maior que o caso: **`npm test` verde não prova que o app
 *  constrói.** O vitest roda por esbuild e nunca invoca o `next build`. Este
 *  teste cobre a fatia específica que nos mordeu; o resto continua sendo
 *  responsabilidade de rodar o build de verdade antes de fechar a rodada. */
describe("o que um route handler pode exportar", () => {
  const rotas = arquivosDeRota(APP);

  it("existe rota pra conferir (senão este teste não prova nada)", () => {
    expect(rotas.length).toBeGreaterThan(0);
  });

  for (const arquivo of rotas) {
    const curto = path.relative(process.cwd(), arquivo);
    it(`${curto} só exporta o que o Next aceita`, () => {
      const fonte = readFileSync(arquivo, "utf8");
      const proibidos = nomesExportados(fonte).filter((n) => !PERMITIDOS.has(n));
      expect(proibidos).toEqual([]);
    });
  }
});

/** O revisor da rodada anterior provou por execução que o guarda acima tinha
 *  ponto cego: trocou `export const PRAZO_MS = 3_000;` (forma que a regex
 *  pegava) por `const PRAZO_MS = 3_000; export { PRAZO_MS };` (forma que não
 *  pegava) — 7/7 verde aqui, `next build` continuou quebrando com o mesmo
 *  "Type '3000' is not assignable to type 'never'". Cada `it` abaixo prova,
 *  uma forma por vez, que `nomesExportados` agora enxerga o nome que o Next
 *  reclamaria — testando a MESMA função que o teste por arquivo, acima, usa
 *  de verdade (não uma cópia da regex). */
describe("nomesExportados pega as formas que a versão anterior deixava passar", () => {
  it("export { X } — a forma exata que escapou na revisão passada", () => {
    const fonte = `const PRAZO_MS = 3_000;\nexport { PRAZO_MS };\n`;
    expect(nomesExportados(fonte)).toEqual(["PRAZO_MS"]);
  });

  it("export { X as Y } — quem conta é o nome exportado (Y), não o interno (X)", () => {
    const fonte = `const interno = 3_000;\nexport { interno as PRAZO_MS };\n`;
    expect(nomesExportados(fonte)).toEqual(["PRAZO_MS"]);
  });

  it("export { a, b as c } — lista com mais de um nome, misturando as duas formas", () => {
    const fonte = `const a = 1, b = 2;\nexport { a, b as c };\n`;
    expect(nomesExportados(fonte)).toEqual(["a", "c"]);
  });

  it("export default — route handler não tem default; conta como proibido", () => {
    const fonte = `export default function handler() {}\n`;
    expect(nomesExportados(fonte)).toContain("default");
  });

  it("export * from \"./outro\" — reexporta tudo, nome desconhecido: sempre proibido", () => {
    const fonte = `export * from "./outro";\n`;
    expect(nomesExportados(fonte)).toContain("*");
  });

  it("export * as NS from \"./outro\" — o nome que aparece é o do namespace", () => {
    const fonte = `export * as Utils from "./outro";\n`;
    expect(nomesExportados(fonte)).toEqual(["Utils"]);
  });

  it("export { X } from \"./outro\" — reexport nomeado também conta (mesma regra da lista)", () => {
    const fonte = `export { PRAZO_MS } from "./outro";\n`;
    expect(nomesExportados(fonte)).toEqual(["PRAZO_MS"]);
  });

  // Cada forma acima, aplicada de verdade num nome fora de PERMITIDOS, tem
  // que produzir um "proibido" — é isto que faz o teste por arquivo, lá em
  // cima, FALHAR diante da mutação do revisor. Prova direta da composição
  // nomesExportados + PERMITIDOS, não só da função isolada.
  it("qualquer uma das formas acima, com um nome fora de PERMITIDOS, é rejeitada pelo filtro real", () => {
    const casos = [
      `const PRAZO_MS = 3_000;\nexport { PRAZO_MS };\n`,
      `const interno = 3_000;\nexport { interno as PRAZO_MS };\n`,
      `export default function handler() {}\n`,
      `export * from "./outro";\n`,
    ];
    for (const fonte of casos) {
      const proibidos = nomesExportados(fonte).filter((n) => !PERMITIDOS.has(n));
      expect(proibidos.length, `deveria rejeitar: ${fonte}`).toBeGreaterThan(0);
    }
  });

  // A decisão consciente: tipo não existe em runtime, o Next não vê `export
  // type` na checagem do módulo, e continuar tratando como proibido só geraria
  // falso positivo. Prova nos dois formatos que o TS aceita pra type-only.
  it("export type { X } — tipo não existe em runtime; o guarda deixa passar de propósito", () => {
    expect(nomesExportados(`export type { PRAZO_MS };\n`)).toEqual([]);
  });

  it("export { type X } — modificador \"type\" por item, dentro de uma lista mista, também não conta", () => {
    const fonte = `const GET_de_verdade = 1;\nexport { type PRAZO_MS, GET_de_verdade as GET };\n`;
    expect(nomesExportados(fonte)).toEqual(["GET"]);
  });
});
