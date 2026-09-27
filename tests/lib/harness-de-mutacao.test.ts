import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 🔴 O GUARDA DO PRÓPRIO INSTRUMENTO — e ele existe porque a recursão de
 *  conserto da Tarefa 2 andou CINCO rodadas sem sair do lugar.
 *
 *  `scripts/mutar.mjs` é o harness de mutação do `src/lib/coerencia.ts`: ele
 *  troca trechos do módulo por versões erradas e afirma que a suíte MORRE em
 *  cada troca. É ele que sustenta a frase "as 13 regras de coerência estão
 *  provadas". Cinco rodadas seguidas, um revisor conseguiu DESLIGAR em silêncio
 *  o portão que a rodada anterior tinha acabado de criar, sempre com os
 *  controles verdes e `exit 0`:
 *
 *    4a  o portão nasceu sem controle            -> nasceram os CONTROLES
 *    4b  o portão NOVO nasceu sem controle       -> nasceram os AUTOTESTES
 *    4c  o CONTROLE novo nasceu sem inventário   -> nasceu a lista cravada à mão
 *    4d  a lista cravada guardava só o NOME      -> passou a guardar o PAR
 *    4e  a CARGA ÚTIL não tinha inventário       -> nasceu este arquivo
 *
 *  🔴 A razão de este guarda morar em `tests/` e não dentro do harness: **um
 *  guarda que vive no arquivo que a sabotagem edita nunca fecha a recursão.**
 *  Quem apaga 31 das 34 mutações apaga a lista cravada no mesmo movimento, e o
 *  `node scripts/mutar.mjs` volta a sair com 0 dizendo `3 morreu (de 3)`. Aqui
 *  é diferente: `npm test` roda em TODO dispatch desta rodada, e este arquivo
 *  não é o que a sabotagem está editando. A última camada não é mais um
 *  mecanismo novo — é um teste normal, com números cravados à mão, no mesmo
 *  idioma de `tests/lib/coerencia.test.ts:182` ("o número é cravado à mão, como
 *  todo número deste projeto").
 *
 *  🔴 E POR QUE ELE NÃO IMPORTA O HARNESS: `scripts/mutar.mjs` roda `main()` no
 *  fim do módulo, então `import` dele executaria a bateria inteira (34 mutações
 *  × a suíte). Por isso o harness ganhou `--inventario`, que imprime as TRÊS
 *  listas REAIS em JSON e sai sem mutar nada. As listas impressas são as de
 *  verdade, nunca as cravadas — se fossem as cravadas, isto compararia a lista
 *  com ela mesma, que é a 44ª espécie do catálogo (guarda cego ao que sumiu)
 *  aplicada a si próprio.
 */

const RAIZ = path.resolve(__dirname, "..", "..");
const HARNESS = path.join("scripts", "mutar.mjs");

function inventario(): {
  mutacoes: { id: string; afirma: string }[];
  controles: { id: string; afirma: string }[];
  autotestes: { id: string; afirma: string }[];
  piso: number;
  arquivosDeTeste: string[];
} {
  const saida = execFileSync(process.execPath, [HARNESS, "--inventario"], {
    cwd: RAIZ,
    encoding: "utf8",
    timeout: 60_000,
  });
  return JSON.parse(saida);
}

/** Roda o harness esperando que ele RECUSE começar, e devolve o que saiu. Um
 *  `process.exit` só se confere de fora — é a mesma razão de os autotestes do
 *  harness rodarem em processo filho. */
function recusa(args: string[]): { codigo: number; saida: string } {
  try {
    const saida = execFileSync(process.execPath, [HARNESS, ...args], {
      cwd: RAIZ,
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { codigo: 0, saida };
  } catch (erro) {
    const e = erro as { status?: number; stdout?: string; stderr?: string };
    return { codigo: e.status ?? -1, saida: String(e.stdout ?? "") + String(e.stderr ?? "") };
  }
}

// 🔴 OS NÚMEROS E OS NOMES SÃO CRAVADOS À MÃO. Mexeu no harness? Mexa aqui, e
// leia o que está mexendo. A fricção é o ponto: é ela que impede que uma lista
// encolha em silêncio.
const MUTACOES_CRAVADAS = [
  "M1", "M2", "M3", "M4", "M5", "M5b", "M6", "M7", "M8", "M9", "M10", "M11",
  "M12", "M13", "M14", "M15",
  "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12",
  "B1a", "B1b", "B2a", "B2b", "B3a", "B3b",
];

const CONTROLES_CRAVADOS = [
  "CTRL-SOBREVIVE",
  "CTRL-SEM-ALVO",
  "CTRL-SEM-MEDICAO",
  "CTRL-PISO-BAIXO",
  "CTRL-MATA-ERRADO",
];

/** Os dez de RECUSA (código 1) e os dois de VEREDITO (código 2). */
const AUTOTESTES_CRAVADOS = [
  "mata-frouxo",
  "mata-fantasma",
  "mata-ausente",
  "mata-lista-vazia",
  "campo-de-controle",
  "campo-de-controle-herdado",
  "piso-por-entrada",
  "inventario-mutacoes",
  "inventario-controles",
  "inventario-autotestes",
  "veredito-sobreviveu",
  "veredito-mata-mente",
];

describe("o harness de mutação do coerencia.ts", () => {
  // A comparação é por CONJUNTO (as duas pontas ordenadas) e não pela ordem do
  // arquivo: reordenar entradas não muda substância nenhuma, e um guarda que
  // fica vermelho por reordenação ensina a ignorá-lo. O que ele não perdoa é
  // entrada que SOME, entrada que APARECE e nome repetido.
  it("tem as 34 mutações cravadas à mão, nem uma a menos", () => {
    const { mutacoes } = inventario();
    expect([...mutacoes.map((m) => m.id)].sort()).toEqual([...MUTACOES_CRAVADAS].sort());
    expect(mutacoes).toHaveLength(34);
    expect(new Set(mutacoes.map((m) => m.id)).size).toBe(34);
  });

  it("tem os 5 controles de categoria e os 12 autotestes", () => {
    const { controles, autotestes } = inventario();
    expect([...controles.map((c) => c.id)].sort()).toEqual([...CONTROLES_CRAVADOS].sort());
    expect([...autotestes.map((a) => a.id)].sort()).toEqual([...AUTOTESTES_CRAVADOS].sort());
    expect(controles).toHaveLength(5);
    expect(autotestes).toHaveLength(12);
  });

  it("dois autotestes são de VEREDITO (código 2), e não só de recusa", () => {
    // Sem esta linha, a terceira família poderia ser apagada e os dez de
    // recusa continuariam bastando para o teste de cima — e o veredito
    // (sobreviveu ⇒ exit 2) voltaria a não ter controle nenhum.
    const { autotestes } = inventario();
    const veredito = autotestes.filter((a) => a.afirma.startsWith("2|"));
    expect([...veredito.map((a) => a.id)].sort()).toEqual(["veredito-mata-mente", "veredito-sobreviveu"]);
  });

  it("toda mutação declara qual teste ela mata — nenhuma com `mata` ausente ou vazio", () => {
    const { mutacoes } = inventario();
    const semMata = mutacoes.filter((m) => m.afirma === "(sem mata)" || m.afirma.trim() === "");
    expect(semMata.map((m) => m.id)).toEqual([]);
  });

  it("`CTRL-MATA-ERRADO` ainda declara que o `mata` NÃO confere", () => {
    // 🔴 Uma linha de DADO: apagar `esperaMataConfere: false` deixava o portão
    // do `mata` sem controle nenhum, enquanto o banner seguia afirmando que o
    // instrumento "sabe acusar um `mata` que não mata". Medido em 27/09.
    const { controles } = inventario();
    const c = controles.find((x) => x.id === "CTRL-MATA-ERRADO");
    expect(c?.afirma).toBe("morreu|mataConfere=false");
  });

  it("mede a suíte inteira do coerencia: o piso é 51 nos dois arquivos", () => {
    const { piso, arquivosDeTeste } = inventario();
    expect(piso).toBe(51);
    expect(arquivosDeTeste).toEqual([
      "tests/lib/coerencia.test.ts",
      "tests/lib/coerencia-acervo.test.ts",
    ]);
  });

  describe("recusa começar quando uma das três listas encolhe", () => {
    for (const lista of ["mutacoes", "controles", "autotestes"]) {
      it(`pega uma entrada apagada de ${lista}`, () => {
        const { codigo, saida } = recusa([`--sabotar=${lista}`, "--inventario"]);
        expect(codigo).toBe(1);
        expect(saida).toContain("[PORTAO:INVENTARIO]");
        expect(saida).toContain("sumiram:");
      });
    }
  });
});
