import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const barra = (f: string): string => f.split(sep).join("/");

/** O BOTÃO NÃO RELIGA ENQUANTO A PÁGINA SAI (18/10, medido em produção).
 *
 *  `location.reload()`/`location.assign()` não param o script: um `finally` que
 *  desliga o "em voo" roda DEPOIS do `return` do sucesso e religa o botão com a
 *  página seguinte ainda carregando — o segundo toque grava com a tela velha. O
 *  molde é o da `TelaDePublicar`: `saindo = true` antes de navegar, e
 *  `if (!saindo)` no `finally`. Este guarda varre `src/` INTEIRO, então um
 *  componente novo com o mesmo padrão não nasce de fora.
 *
 *  Sem tirar comentários por regex (a tira-comentário já cegou guarda neste
 *  projeto): o corpo do `finally` é lido por contagem de chaves e exige `!saindo`
 *  — uma palavra solta num comentário não basta. */

const RAIZ = join(__dirname, "..", "..", "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

/** Os corpos de cada `finally { ... }`, por contagem de chaves. */
function corposDeFinally(codigo: string): string[] {
  const corpos: string[] = [];
  const achar = /\bfinally\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = achar.exec(codigo))) {
    let fundo = 1;
    let i = m.index + m[0].length;
    const ini = i;
    while (i < codigo.length && fundo > 0) {
      if (codigo[i] === "{") fundo++;
      else if (codigo[i] === "}") fundo--;
      i++;
    }
    corpos.push(codigo.slice(ini, i - 1));
  }
  return corpos;
}

const QUE_NAVEGAM = arquivos(RAIZ)
  .map((f) => ({ f, codigo: readFileSync(f, "utf8") }))
  .filter(({ codigo }) => /location\.(reload|assign)/.test(codigo) && /\bfinally\s*\{/.test(codigo));

describe("todo `finally` que desliga o botão sabe que a página está saindo", () => {
  it("o enumerador acha os arquivos que navegam e têm `finally` (não-vacuidade)", () => {
    expect(QUE_NAVEGAM.length, "o enumerador sumiu com os arquivos").toBeGreaterThanOrEqual(13);
    const nomes = QUE_NAVEGAM.map(({ f }) => barra(f));
    expect(nomes.some((f) => f.endsWith("admin/TelaDePublicar.tsx"))).toBe(true);
    expect(nomes.some((f) => f.endsWith("admin/campos/gravar.ts"))).toBe(true);
  });

  it.each(QUE_NAVEGAM.map(({ f, codigo }) => [barra(f.slice(RAIZ.length + 1)), codigo] as const))(
    "%s: cada `finally` só desliga com `!saindo`",
    (_nome, codigo) => {
      const corpos = corposDeFinally(codigo);
      expect(corpos.length).toBeGreaterThan(0);
      for (const corpo of corpos) {
        expect(corpo, "um `finally` religa o botão com a página saindo").toMatch(/!\s*saindo\b/);
      }
    },
  );
});
