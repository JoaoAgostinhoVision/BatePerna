import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 🔴 O GUARDA DO PRÓPRIO INSTRUMENTO — e ele existe porque a recursão de
 *  conserto da Tarefa 2 andou SETE rodadas sem sair do lugar.
 *
 *  `scripts/mutar.mjs` é o harness de mutação do `src/lib/coerencia.ts`: ele
 *  troca trechos do módulo por versões erradas e afirma que a suíte MORRE em
 *  cada troca. É ele que sustenta a frase "as regras de coerência estão
 *  provadas". SETE rodadas seguidas, um revisor conseguiu DESLIGAR em silêncio o
 *  portão que a rodada anterior tinha acabado de criar, sempre com os controles
 *  verdes e `exit 0` — e nas duas últimas o portão desligado era um guarda DESTE
 *  arquivo:
 *
 *    4a  o portão nasceu sem controle            -> nasceram os CONTROLES
 *    4b  o portão NOVO nasceu sem controle       -> nasceram os AUTOTESTES
 *    4c  o CONTROLE novo nasceu sem inventário   -> nasceu a lista cravada à mão
 *    4d  a lista cravada guardava só o NOME      -> passou a guardar o PAR
 *    4e  a CARGA ÚTIL não tinha inventário       -> nasceu este arquivo
 *    4f  nada guardava ESTE arquivo              -> o harness passou a EXIGI-LO
 *    4g  a substância pinava o LUGAR, não a troca-> a troca entrou no par
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
 *  fim do módulo, então `import` dele executaria a bateria inteira (42 mutações
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
  categorias: string[];
  arquivosExigidos: string[];
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
  // Onda de conserto 2 da Tarefa 7 (2026-10-01): a 14ª regra (o teto) e a
  // aceitação dos dois zeros — as provas saíram da tabela do relatório e
  // entraram no instrumento.
  "T1", "T2", "T3", "T4",
  "Z1", "Z2", "Z3", "Z4",
];

const CONTROLES_CRAVADOS = [
  "CTRL-SOBREVIVE",
  "CTRL-SEM-ALVO",
  "CTRL-SEM-DIFF",
  "CTRL-SEM-MEDICAO",
  "CTRL-PISO-BAIXO",
  "CTRL-MATA-ERRADO",
];

/** Onze de RECUSA (código 1) e cinco de VEREDITO (código 2). */
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
  "guarda-de-fora",
  "veredito-sobreviveu",
  "veredito-sem-alvo",
  "veredito-sem-diff",
  "veredito-sem-medicao",
  "veredito-mata-mente",
];

/** 🔴 OS CINCO DE VEREDITO, um por ramo da sentença — e a razão de estarem
 *  cravados aqui, e não só contados: a sentença do harness confere QUATRO
 *  categorias de falha (`sobreviveu`, `sem alvo`, `sem diff`, `sem medição`) e
 *  nasceu, na rodada 4e, com controle para UMA. Um re-revisor apagou **uma
 *  parcela** da soma e uma entrada que a suíte NUNCA MEDIU saiu com exit 0 e
 *  stdout idêntico, com os cinco controles, os doze autotestes de então e o
 *  `npm test` verdes. É a 48ª espécie (regra que confere várias coisas, provada
 *  por uma só) aplicada à SENTENÇA. */
const VEREDITO_CRAVADO = [
  "veredito-mata-mente",
  "veredito-sem-alvo",
  "veredito-sem-diff",
  "veredito-sem-medicao",
  "veredito-sobreviveu",
];

/** 🔴 A SUBSTÂNCIA dos cinco controles, por extenso — "nome não basta" valia de
 *  dentro e não tinha sido levado para cá. `CTRL-SEM-MEDICAO` e
 *  `CTRL-PISO-BAIXO` existem para os DOIS ramos distintos de "sem medição"
 *  (relatório ausente × piso curto), e tinham a substância byte a byte
 *  idêntica: duas edições de DADO faziam um virar clone do outro com as duas
 *  camadas verdes, e o ramo perdido é o que já fez, em 3/5, uma troca de
 *  COMENTÁRIO sair carimbada "morreu" com exit 0. */
const CONTROLES_SUBSTANCIA: Record<string, string> = {
  "CTRL-SOBREVIVE": "sobreviveu|mataConfere=nao-declarado|porque=null",
  "CTRL-SEM-ALVO": "sem alvo|mataConfere=nao-declarado|porque=null",
  // 🔴 O sexto, e ele faltava: `sem diff` era o único ramo do classificador sem
  // controle nenhum, e a frase do docblock dizia "cinco controles, um por ramo"
  // — falsa por causa dele. Medido na sétima passada: desviar o ramo `sem diff`
  // para outra categoria de falha deixava as três camadas verdes.
  "CTRL-SEM-DIFF": "sem diff|mataConfere=nao-declarado|porque=null",
  "CTRL-SEM-MEDICAO": 'sem medição|mataConfere=nao-declarado|porque="não escreveu relatório"',
  "CTRL-PISO-BAIXO": 'sem medição|mataConfere=nao-declarado|porque="EXECUTOU"',
  "CTRL-MATA-ERRADO": "morreu|mataConfere=false|porque=null",
};

/** As cinco categorias. A sentença do veredito é DERIVADA desta lista, então
 *  tirar uma daqui tira a parcela dela da sentença. */
const CATEGORIAS_CRAVADAS = ["morreu", "sobreviveu", "sem alvo", "sem diff", "sem medição"];

describe("o harness de mutação do coerencia.ts", () => {
  // A comparação é por CONJUNTO (as duas pontas ordenadas) e não pela ordem do
  // arquivo: reordenar entradas não muda substância nenhuma, e um guarda que
  // fica vermelho por reordenação ensina a ignorá-lo. O que ele não perdoa é
  // entrada que SOME, entrada que APARECE e nome repetido.
  it("tem as 42 mutações cravadas à mão, nem uma a menos", () => {
    const { mutacoes } = inventario();
    expect([...mutacoes.map((m) => m.id)].sort()).toEqual([...MUTACOES_CRAVADAS].sort());
    expect(mutacoes).toHaveLength(42);
    expect(new Set(mutacoes.map((m) => m.id)).size).toBe(42);
  });

  it("tem os 6 controles de categoria e os 16 autotestes", () => {
    const { controles, autotestes } = inventario();
    expect([...controles.map((c) => c.id)].sort()).toEqual([...CONTROLES_CRAVADOS].sort());
    expect([...autotestes.map((a) => a.id)].sort()).toEqual([...AUTOTESTES_CRAVADOS].sort());
    expect(controles).toHaveLength(6);
    expect(autotestes).toHaveLength(16);
  });

  it("os CINCO autotestes de VEREDITO existem — um por ramo da sentença", () => {
    // Sem isto, a família do veredito poderia encolher e os de recusa
    // continuariam bastando para o teste de cima — e as três parcelas de
    // AUSÊNCIA DE MEDIÇÃO voltariam a não ter controle nenhum.
    const { autotestes } = inventario();
    const veredito = autotestes.filter((a) => a.afirma.startsWith("2|"));
    expect([...veredito.map((a) => a.id)].sort()).toEqual(VEREDITO_CRAVADO);
  });

  it("cada um dos 6 controles declara a substância dele, com o RAMO", () => {
    const { controles } = inventario();
    const real = Object.fromEntries(controles.map((c) => [c.id, c.afirma]));
    expect(real).toEqual(CONTROLES_SUBSTANCIA);
  });

  it("as cinco categorias estão lá — a sentença do veredito é derivada delas", () => {
    const { categorias } = inventario();
    expect(categorias).toEqual(CATEGORIAS_CRAVADAS);
  });

  it("o harness EXIGE este arquivo: as duas camadas se guardam", () => {
    // 🔴 Este é o fecho do desenho, e ele nasceu de o contrário ter sido
    // medido: um re-revisor MOVEU este arquivo para fora da árvore e
    // `npx vitest run` ficou verde em 81/1289 — ninguém acusou os nove testes
    // que sumiram —, o harness seguiu em exit 0, e com ele fora as TRÊS
    // sabotagens coordenadas que a rodada 4e provou vermelhas voltavam a
    // passar. Agora o harness recusa começar sem este arquivo, e esta linha é o
    // que impede alguém de tirar a exigência.
    const { arquivosExigidos } = inventario();
    expect(arquivosExigidos).toContain("tests/lib/harness-de-mutacao.test.ts");
  });

  it("nenhuma entrada é clone de outra por DADO — as substâncias são distintas", () => {
    // 🔴 Espécie medida três vezes em 27/09, sempre a mesma: duas entradas com
    // a substância IDÊNTICA podem ser trocadas uma pela outra sem que nada
    // fique vermelho, e o portão que uma delas exercitava fica sem controle.
    // Aconteceu com os três autotestes de inventário (só as `args` os
    // distinguiam), com os dois controles de "sem medição" (só o ramo), e com
    // os três autotestes de veredito que EU escrevi (só a troca).
    const { mutacoes, controles, autotestes } = inventario();
    expect(new Set(controles.map((c) => c.afirma)).size).toBe(6);
    expect(new Set(autotestes.map((a) => a.afirma)).size).toBe(16);
    const substancias = mutacoes.map((m) => m.afirma);
    expect(new Set(substancias).size).toBe(42);
    // 🔴 42 de 42 (eram 34 de 34) desde que a TROCA entrou na substância — e aqui vai a parte
    // desconfortável, medida: `N11` e `B1a` são a MESMA mutação semântica
    // (colapsam a bifurcação na linha 426, as duas escrevendo `frase: true`), e
    // o que as distingue nesta contagem é só o COMENTÁRIO dentro do `novo`. Ou
    // seja: 34 distintas aqui NÃO significa 34 trocas distintas no módulo — são
    // 33, como o docblock do harness diz. A distinção da 34ª é cosmética, está
    // escrita, e é melhor assim do que uma contagem que parece semântica e não é.
    // (Com as 8 da onda de conserto 2: 42 distintas aqui, 41 trocas no módulo.)
    const na426 = mutacoes.filter((m) => m.afirma.includes("@426-426") && m.afirma.includes("frase: true"));
    expect([...na426.map((m) => m.id)].sort()).toEqual(["B1a", "N11"]);
  });

  it("as 42 mutações mutam os arquivos que dizem mutar — 41 no módulo, 1 na página", () => {
    // 🔴 `ARQUIVOS_ENVOLVIDOS` deriva de `MUTACOES`, e só UMA das entradas
    // muta `src/app/[slug]/page.tsx`: apagar ou repontar essa uma tira o
    // arquivo do guarda de árvore suja, em silêncio.
    const { mutacoes } = inventario();
    const porArquivo: Record<string, number> = {};
    for (const m of mutacoes) {
      const arquivo = m.afirma.split("@")[0];
      porArquivo[arquivo] = (porArquivo[arquivo] ?? 0) + 1;
    }
    expect(porArquivo).toEqual({ "src/lib/coerencia.ts": 41, "src/app/[slug]/page.tsx": 1 });
  });

  it("toda mutação declara qual teste ela mata — nenhuma com `mata` ausente ou vazio", () => {
    // 🔴 Esta asserção era VÁCUA e um re-revisor mediu: `m.afirma === "(sem
    // mata)"` nunca podia ser verdade, porque a substância é
    // `arquivo@linhas→troca · mata` — uma entrada sem `mata` lê
    // `"…@495-495→… · (sem mata)"`, que não é igual a `"(sem mata)"`. Apagando o
    // `mata` de uma entrada e sincronizando a lista cravada, os 15 testes daqui
    // passavam verdes. Quem pegava era o portão do harness (exit 1), não este
    // teste, que dizia conferir isso e não conferia.
    const { mutacoes } = inventario();
    const semMata = mutacoes.filter((m) => m.afirma.endsWith(" · (sem mata)") || m.afirma.trim() === "");
    expect(semMata.map((m) => m.id)).toEqual([]);
  });

  it("`CTRL-MATA-ERRADO` ainda declara que o `mata` NÃO confere", () => {
    // 🔴 Uma linha de DADO: apagar `esperaMataConfere: false` deixava o portão
    // do `mata` sem controle nenhum, enquanto o banner seguia afirmando que o
    // instrumento "sabe acusar um `mata` que não mata". Medido em 27/09.
    const { controles } = inventario();
    const c = controles.find((x) => x.id === "CTRL-MATA-ERRADO");
    expect(c?.afirma).toContain("mataConfere=false");
    expect(c?.afirma).toBe(CONTROLES_SUBSTANCIA["CTRL-MATA-ERRADO"]);
  });

  it("mede a suíte inteira do coerencia: o piso é 59 nos dois arquivos", () => {
    const { piso, arquivosDeTeste } = inventario();
    expect(piso).toBe(59);
    expect(arquivosDeTeste).toEqual([
      "tests/lib/coerencia.test.ts",
      "tests/lib/coerencia-acervo.test.ts",
    ]);
  });

  it("recusa começar quando ESTE arquivo não existe", () => {
    const { codigo, saida } = recusa(["--sabotar=guarda", "--inventario"]);
    expect(codigo).toBe(1);
    expect(saida).toContain("[PORTAO:GUARDA-DE-FORA]");
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
