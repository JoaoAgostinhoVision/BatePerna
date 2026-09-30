import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, test } from "vitest";

test("test runner works", () => {
  expect(1 + 1).toBe(2);
});

/** 🔴 O MAPA APONTA PRA ARQUIVO QUE EXISTE.
 *
 *  Este projeto escreve muito comentário que manda o próximo leitor a outro
 *  arquivo ("mesmo molde de tal teste", "o padrão está em tal módulo"), e isso é
 *  bom — até a tarefa que APAGA o arquivo citado. **Suíte verde não prova
 *  contração: teste apagado não falha**, e o ponteiro morto sobrevive porque
 *  nada o lê. Foi o que aconteceu com o `editor-de-voz.test.tsx` e com o
 *  `EditorDeVoz.tsx`, apagados em 2026-09-30: sobraram QUATRO referências a
 *  eles (duas em `src/`, duas em `tests/`), e a revisão da tarefa achou UMA.
 *
 *  🔴 A REGRA É EXATA, NÃO HEURÍSTICA: o que este guarda exige é que todo
 *  CAMINHO (com barras, no formato `tests/…` ou `src/…`) escrito em `src/` ou
 *  em `tests/` aponte pra arquivo que existe. Ele não tenta adivinhar intenção
 *  — cerco montado por heurística é a 53ª espécie do catálogo deste projeto.
 *  Prosa sobre um arquivo que MORREU continua possível: ela cita o nome
 *  (`editor-de-voz.test.tsx`) sem o caminho, porque um caminho é uma instrução
 *  pra ir ver, e não há o que ver. */
describe("as referências a arquivo do repo apontam pra arquivo que existe", () => {
  const todosOsArquivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = path.join(dir, e);
      return statSync(p).isDirectory() ? todosOsArquivos(p) : [p];
    });

  const CAMINHO = /(?:src|tests)\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:tsx?|css|json|mjs)/g;

  it("nenhum comentário manda o próximo leitor a um arquivo que não existe", () => {
    const fontes = [...todosOsArquivos("src"), ...todosOsArquivos("tests")].filter((a) =>
      /\.(ts|tsx|css|mjs)$/.test(a),
    );
    expect(fontes.length, "nenhum arquivo foi varrido: o guarda ficaria oco").toBeGreaterThan(100);

    const referencias: { onde: string; alvo: string }[] = [];
    for (const a of fontes) {
      for (const alvo of readFileSync(a, "utf8").match(CAMINHO) ?? []) {
        referencias.push({ onde: a, alvo });
      }
    }
    expect(
      referencias.length,
      "nenhuma referência foi achada: a regex do guarda parou de casar e ele ficaria verde por vacuidade",
    ).toBeGreaterThan(50);

    for (const { onde, alvo } of referencias) {
      expect(
        existsSync(alvo),
        `${onde} manda o leitor a \`${alvo}\`, que não existe — se o arquivo morreu, cite o NOME dele sem o caminho e diga que morreu`,
      ).toBe(true);
    }
  });
});
