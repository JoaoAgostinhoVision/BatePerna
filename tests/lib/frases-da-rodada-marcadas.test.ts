import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** A BASE DA RODADA: o commit de onde a execução partiu (07/10). Frase que já
 *  existia aqui pode ter `LIDA:`; frase que nasceu DEPOIS, não (I6). */
const BASE = "cc6c467";

/** Os módulos onde as palavras desta rodada (07/10) moram. Arquivo de palavras
 *  NOVO desta rodada entra aqui; os do painel que ganharam frase também.
 *  ⚠️ Esta lista é à mão, e lista à mão é cega ao que cresce — por isso ela
 *  NÃO é a única cerca: a varredura de baixo (`arquivosDaRodada`) enumera do
 *  GIT todo arquivo de `src/` que mudou desde a base, e exige marca em toda
 *  constante de texto exportada que nasceu depois dela. A lista daqui fica
 *  porque é mais estrita: nestes arquivos, até a frase antiga precisa de marca. */
const ARQUIVOS = [
  "src/lib/origem.ts",
  "src/lib/porta-da-pessoa.ts",
  "src/lib/porta-da-regra-padrao.ts",
  "src/lib/calibrar.ts",
  "src/app/contribuir/palavras.ts",
  "src/app/admin/SecaoNaoConferidos.tsx",
  "src/app/admin/CaixaDaOrigem.tsx",
  "src/app/admin/TelaDaRegraPadrao.tsx",
  "src/app/admin/campos/EditorCalibrar.tsx",
  "src/app/BarraNavegacao.tsx",
];

/** As constantes de texto exportadas: `export const NOME = "..."` ou
 *  `` `...` `` (uma linha, ou a abertura de uma de várias). */
function frasesExportadas(fonte: string): { nome: string; linha: number }[] {
  const linhas = fonte.split(/\r?\n/);
  return linhas.flatMap((l, i) => {
    const m = /^export const ([A-Z][A-Z0-9_]*)\s*(?::\s*string\s*)?=\s*(["`]|$)/.exec(l);
    return m ? [{ nome: m[1], linha: i }] : [];
  });
}

/** A marca de uma constante: `PENDENTE` ou `LIDA:` num comentário `//` do
 *  BLOCO DE COMENTÁRIO colado em cima dela (o docblock da constante pode ficar
 *  entre ela e a marca). `PENDENTE` ganha quando as duas aparecem.
 *  🔴 O BLOCO, E NÃO "AS 3 LINHAS DE CIMA" (o brief): com constantes coladas
 *  uma na outra (`contribuir/palavras.ts`, `admin/campos/palavras.ts`), a
 *  janela de 3 linhas alcançava o `// PENDENTE` da VIZINHA de cima — tirar a
 *  marca do `MUDAR` ou do `BLOQUEAR_MESMO` SOBREVIVIA, medido. O bloco para na
 *  primeira linha que não é comentário (código, ou linha em branco). */
function marcaDe(linhas: string[], i: number): "PENDENTE" | "LIDA" | null {
  let topo = i;
  while (topo > 0 && /^\s*(\/\/|\/\*|\*)/.test(linhas[topo - 1])) topo--;
  const acima = linhas.slice(topo, i).filter((l) => /^\s*\/\//.test(l));
  if (acima.some((l) => /PENDENTE/.test(l))) return "PENDENTE";
  if (acima.some((l) => /LIDA:/.test(l))) return "LIDA";
  return null;
}

/** Os nomes das constantes de texto que o arquivo exportava na BASE. Arquivo
 *  que não existia lá = nenhum (toda frase dele é nova). */
function nomesNaBase(arquivo: string): Set<string> {
  let antes = "";
  try {
    antes = execFileSync("git", ["show", `${BASE}:${arquivo}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    antes = "";
  }
  return new Set(frasesExportadas(antes).map((f) => f.nome));
}

/** 🔴 I6 DA PRÉ-AUDITORIA: `LIDA:` só vale pra frase que JÁ EXISTIA na base.
 *  Frase que nasceu nesta rodada e diz `LIDA:` é marca escrita por mim — e
 *  "pode seguir" (aprovar o DESENHO) nunca é "li e aprovei" a frase (memória
 *  "trava removida por quem escreveu"). Foi o `SECO_SEM_CARRO` do plano
 *  original, e o guarda de antes o aceitava. */
function problemasDaMarca(fonte: string, base: Set<string>): string[] {
  const linhas = fonte.split(/\r?\n/);
  return frasesExportadas(fonte).flatMap((f) => {
    const marca = marcaDe(linhas, f.linha);
    if (marca === null) return [`${f.nome}: sem marca`];
    if (marca === "LIDA" && !base.has(f.nome)) return [`${f.nome}: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`];
    return [];
  });
}

/** 🔴 A CERCA QUE NÃO É À MÃO (Task 16, por cima do brief). Todo arquivo
 *  `.ts`/`.tsx` de `src/` que mudou desde a BASE — o que o git diz, mais o que
 *  ainda não foi adicionado (`--others`: arquivo novo fora do índice não
 *  aparece no `git diff`). Foi esta enumeração que achou as frases que a lista
 *  `ARQUIVOS` não via: `AVISO_PUBLICAR_PESSOA` (`TelaDePublicar.tsx`, Task 13),
 *  `NAO_CONFERIU`/`TITULO_REGRA_PADRAO`/`BLOQUEAR`/`BLOQUEAR_MESMO`/
 *  `DESBLOQUEAR` (`admin/campos/palavras.ts`, Tasks 6, 7, 15) e `SEM_NAO_SEI`
 *  (`campos-da-pessoa.ts`, Task 10). */
function arquivosDaRodada(): string[] {
  const git = (args: string[]) =>
    execFileSync("git", args, { encoding: "utf8" }).split(/\r?\n/).filter((f) => /^src\/.*\.tsx?$/.test(f));
  const mudados = git(["diff", "--name-only", "--diff-filter=d", BASE, "--", "src"]);
  const soltos = git(["ls-files", "--others", "--exclude-standard", "--", "src"]);
  return [...new Set([...mudados, ...soltos])].sort();
}

/** Nos arquivos que JÁ existiam, frase antiga pode não ter marca nenhuma (é de
 *  antes da regra); o que a varredura cobra é a frase NOVA: nome que a base não
 *  exportava. Nova = `PENDENTE`, e `LIDA` nova é recusada como no I6. */
function problemasDasNovas(fonte: string, base: Set<string>, naoSaoFrase: readonly string[] = []): string[] {
  return problemasDaMarca(fonte, base).filter((p) => {
    const nome = p.slice(0, p.indexOf(":"));
    return !base.has(nome) && !naoSaoFrase.includes(nome);
  });
}

/** 🔴 AS CONSTANTES DE TEXTO NOVAS QUE NÃO SÃO FRASE DE TELA — por NOME, com o
 *  porquê, e nunca por heurística (tamanho, forma, espaço): exceção por forma
 *  come o caso real que se parece com ela. Marcar uma destas `PENDENTE` poria
 *  no pacote de copy dele uma coisa que não é palavra pra ler. Cada nome daqui
 *  tem de EXISTIR no arquivo (caso abaixo), senão a exceção apodrece calada.
 *  - `PONTO` = "ponto": a CHAVE da pergunta do mapa na lista do que falta
 *    (`obrigatoriosDaPessoaFaltando`); a tela de publicar a troca pelo caminho
 *    `trajeto.waypoints.0.lat` e mostra o RÓTULO dele, nunca a palavra. */
const NAO_SAO_FRASE: Readonly<Record<string, readonly string[]>> = {
  "src/lib/campos-da-pessoa.ts": ["PONTO"],
};

/** As constantes de texto exportadas que nasceram depois da BASE, em todo
 *  arquivo da rodada — a matéria-prima da não-vacuidade da varredura. */
function frasesNovasDaRodada(): string[] {
  return arquivosDaRodada().flatMap((a) => {
    const base = nomesNaBase(a);
    return frasesExportadas(readFileSync(path.join(process.cwd(), a), "utf8"))
      .filter((f) => !base.has(f.nome))
      .map((f) => f.nome);
  });
}

const ler = (arquivo: string) => readFileSync(path.join(process.cwd(), arquivo), "utf8").split(/\r?\n/);

describe("toda frase nova desta rodada nasce marcada", () => {
  it("o guarda leu frases (não-vacuidade): pelo menos 30 nos arquivos da rodada", () => {
    const total = ARQUIVOS.reduce((n, a) => n + frasesExportadas(readFileSync(path.join(process.cwd(), a), "utf8")).length, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });

  // Não-vacuidade da leitura da BASE: se o `git show` falhasse sempre, toda
  // frase pareceria nova — o guarda ficaria MAIS estrito, nunca mais frouxo;
  // mesmo assim, ele tem de saber ler a base de verdade.
  it("o guarda lê a base: um arquivo que já existia nela devolve as frases de lá", () => {
    expect(nomesNaBase("src/lib/porta-de-publicar.ts").has("RASCUNHO_MUDOU")).toBe(true);
    expect(nomesNaBase("src/lib/origem.ts").size, "origem.ts nasce nesta rodada").toBe(0);
  });

  it.each(ARQUIVOS)("%s: toda constante de texto exportada tem marca, e LIDA só em frase que já existia", (arquivo) => {
    const fonte = readFileSync(path.join(process.cwd(), arquivo), "utf8");
    expect(problemasDaMarca(fonte, nomesNaBase(arquivo))).toEqual([]);
  });

  // A não-vacuidade da VARREDURA: ela tem de enumerar os arquivos que a lista
  // à mão não tem, e achar neles as frases que só ela vê. Se o `git diff`
  // voltasse vazio (base errada, git ausente), a varredura passaria calada —
  // por isso o piso de 41 (as constantes de texto novas da rodada em 12/10: 42
  // contadas, menos o `PONTO`, que não é frase) e os nomes que moram FORA de
  // `ARQUIVOS`.
  it("a varredura enumera do git: os arquivos fora da lista à mão, e as frases novas deles", () => {
    const arquivos = arquivosDaRodada();
    for (const a of ["src/app/admin/TelaDePublicar.tsx", "src/app/admin/campos/palavras.ts", "src/lib/campos-da-pessoa.ts"]) {
      expect(arquivos, a).toContain(a);
      expect(ARQUIVOS, a).not.toContain(a);
    }
    const excecoes = Object.values(NAO_SAO_FRASE).flat();
    const novas = frasesNovasDaRodada().filter((n) => !excecoes.includes(n));
    expect(novas.length).toBeGreaterThanOrEqual(41);
    for (const n of ["AVISO_PUBLICAR_PESSOA", "NAO_CONFERIU", "TITULO_REGRA_PADRAO", "BLOQUEAR", "BLOQUEAR_MESMO", "DESBLOQUEAR", "SEM_NAO_SEI"]) {
      expect(novas, n).toContain(n);
    }
  });

  it("todo arquivo de src/ que mudou desde a base: toda constante de texto exportada NOVA nasce PENDENTE", () => {
    const problemas = arquivosDaRodada().flatMap((a) =>
      problemasDasNovas(readFileSync(path.join(process.cwd(), a), "utf8"), nomesNaBase(a), NAO_SAO_FRASE[a]).map(
        (p) => `${a}: ${p}`,
      ),
    );
    expect(problemas).toEqual([]);
  });

  it("cada exceção de NAO_SAO_FRASE existe: é constante de texto NOVA do arquivo dito, e não está em ARQUIVOS", () => {
    for (const [arquivo, nomes] of Object.entries(NAO_SAO_FRASE)) {
      expect(arquivosDaRodada(), arquivo).toContain(arquivo);
      expect(ARQUIVOS, arquivo).not.toContain(arquivo);
      const base = nomesNaBase(arquivo);
      const novas = frasesExportadas(readFileSync(path.join(process.cwd(), arquivo), "utf8")).map((f) => f.nome);
      for (const n of nomes) {
        expect(novas, n).toContain(n);
        expect(base.has(n), n).toBe(false);
      }
    }
  });

  // Os controles: o guarda SABE achar uma frase sem marca, e uma LIDA nova.
  it("controle: uma frase sem marca é achada", () => {
    const fonte = 'const x = 1;\nexport const FRASE = "sem marca";\n';
    expect(problemasDaMarca(fonte, new Set())).toEqual(["FRASE: sem marca"]);
  });

  it("controle: a marca da VIZINHA de cima não serve (constantes coladas); o docblock entre a marca e a frase serve", () => {
    const coladas = '// PENDENTE: minha\nexport const A = "a";\n// sem a palavra\nexport const B = "b";\n';
    expect(problemasDaMarca(coladas, new Set())).toEqual(["B: sem marca"]);
    const comDoc = '// PENDENTE: minha\n/** o porquê,\n *  em duas linhas */\nexport const C = "c";\n';
    expect(problemasDaMarca(comDoc, new Set())).toEqual([]);
  });

  it("controle: LIDA numa frase nova é achada; LIDA numa frase da base passa; PENDENTE sempre passa", () => {
    const fonte = '// LIDA: aprovada\nexport const NOVA = "x";\n// LIDA: aprovada\nexport const VELHA = "y";\n// PENDENTE: minha\nexport const OUTRA = "z";\n';
    expect(problemasDaMarca(fonte, new Set(["VELHA"]))).toEqual([
      `NOVA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
  });

  it("controle da varredura: frase antiga sem marca passa; frase nova sem marca, e LIDA nova, são achadas", () => {
    const fonte = 'export const VELHA = "antes da regra";\nexport const NOVA = "sem marca";\n// LIDA: aprovada\nexport const OUTRA = "x";\n';
    expect(problemasDasNovas(fonte, new Set(["VELHA"]))).toEqual([
      "NOVA: sem marca",
      `OUTRA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
    // A exceção cala SÓ o nome dito, nunca o vizinho.
    expect(problemasDasNovas(fonte, new Set(["VELHA"]), ["OUTRA"])).toEqual(["NOVA: sem marca"]);
  });

  // ⚠️ O brief media as entradas com `/^\s+"[a-z-]+": "/`, e duas das seis
  // quebram a linha depois dos dois-pontos (`"horario-invertido-sem-aviso":` e
  // `"semana-inteira-nao-declara":`): o caso contava 4 e ficava vermelho. A
  // entrada é a CHAVE, com ou sem o texto na mesma linha — e só dentro do
  // bloco do `FRASE_DA_PESSOA`.
  it("cada frase de FRASE_DA_PESSOA tem PENDENTE na linha de cima", () => {
    const linhas = ler("src/lib/porta-da-pessoa.ts");
    const abre = linhas.findIndex((l) => /^export const FRASE_DA_PESSOA\b/.test(l));
    const fecha = linhas.findIndex((l, i) => i > abre && /^};/.test(l));
    expect(abre, "o bloco existe").toBeGreaterThan(-1);
    const entradas = linhas.flatMap((l, i) => (i > abre && i < fecha && /^\s+"[a-z-]+":(\s|$)/.test(l) ? [i] : []));
    expect(entradas.length).toBe(6);
    for (const i of entradas) expect(linhas[i - 1], linhas[i]).toMatch(/PENDENTE/);
  });

  // As frases desta rodada que o regex de `export const NOME = "…"` não lê
  // (M9 da pré-auditoria): entrada de objeto, e a marca que divide a linha com
  // um `LIDA:` antigo (caso de baixo). Conferidas POR NOME. (As duas funções
  // que devolviam frase — `parDeRascunhoDeQuemUsa` e
  // `enderecoDeRascunhoDeQuemUsa`, em `rascunho.ts` — foram apagadas na Task
  // 17, com o estado que as alcançava: rascunho de quem usa não ocupa mais
  // nome. Não há outra função-frase nova na rodada.)
  it.each([
    ["src/app/admin/HistoricoDaFicha.tsx", /^\s+contribuidor: "quem mandou",/],
  ] as const)("%s: %s tem PENDENTE na linha de cima", (arquivo, alvo) => {
    const linhas = ler(arquivo);
    const i = linhas.findIndex((l) => alvo.test(l));
    expect(i, "a frase existe").toBeGreaterThan(0);
    expect(linhas[i - 1]).toMatch(/^\s*\/\/ PENDENTE/);
  });

  it("o título do link (generateMetadata): o ` · não conferido` tem PENDENTE na própria linha, depois do LIDA antigo", () => {
    const linhas = ler("src/app/[slug]/page.tsx");
    const nome = linhas.filter((l) => /^\s+const nome = .*ETIQUETA_NAO_CONFERIDO/.test(l));
    expect(nome).toHaveLength(1);
    expect(nome[0]).toMatch(/\/\/ LIDA:.*PENDENTE: o " · não conferido"/);
  });
});
