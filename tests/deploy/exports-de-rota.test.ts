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
      const nomes = [
        ...fonte.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)/gm),
      ].map((m) => m[1]);
      const proibidos = nomes.filter((n) => !PERMITIDOS.has(n));
      expect(proibidos).toEqual([]);
    });
  }
});
