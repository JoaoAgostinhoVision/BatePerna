import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 🔴 O GUARDA DESTA RODADA INTEIRA.
 *
 *  A ficha saiu do disco e foi pro banco. Se um caminho de runtime voltar a ler
 *  `content/fichas/`, o app passa a ter DUAS fontes pra mesma pergunta — e essa
 *  é a espécie que este projeto já pagou três vezes (cabeçalho x cartão, HTML x
 *  cache, chip x carimbo). O pior é que ela não quebra nada: as duas fontes
 *  concordam no dia da migração e divergem na primeira edição.
 *
 *  Este guarda vale só pra `src/`. `scripts/` e `tests/` leem o disco de
 *  propósito: a semente e os fixtures.
 *
 *  🔴 POR QUE ELE NÃO VARRE POR PALAVRA — e a próxima pessoa vai querer
 *  "simplificar" isto de volta, então está escrito. Um guarda que reprovasse
 *  todo arquivo cujo TEXTO casasse com `content/fichas` nasceria vermelho e
 *  pelo motivo errado: `src/app/error.tsx`, `src/lib/cache-rotas.ts` e
 *  `src/lib/ficha-fonte.ts` citam o caminho EM COMENTÁRIO, e os três
 *  comentários são a melhor coisa que há neles — o do `cache-rotas` explica por
 *  que o service worker não pode ler de lá, e o do `ficha-fonte` diz *"o que
 *  esta função nunca faz: cair no `content/fichas/`"*, que é a frase que
 *  explica o erro honesto da rodada inteira. Um guarda que pune o comentário
 *  certo é um guarda que ensina a apagar o comentário; e "consertá-lo"
 *  enumerando os arquivos de hoje na lista esperada o transformaria num carimbo
 *  do estado de hoje, que não protege nada.
 *
 *  🔴 E POR QUE ELE NÃO EXIGE A CHAMADA DE `fs` NA MESMA LINHA — isto foi
 *  MEDIDO em 2026-09-25, e a medição mudou o guarda duas vezes.
 *
 *  A 1ª versão pedia que a LINHA juntasse o acervo com uma chamada de `node:fs`
 *  ou de `path.join`. Passou VERDE com um `import fsMut from "node:fs"` +
 *  `pathMut.join(process.cwd(), "content", "fichas")` em `src/lib/runMotor.ts`:
 *  o regex procurava `path.join(`, e o import se chamava `pathMut`. Guarda que
 *  depende do NOME do import não guarda.
 *
 *  A 2ª versão passou a procurar o CAMINHO em código, mas ainda linha a linha —
 *  e o furo seguinte é a montagem em duas etapas, que é como código real
 *  cresce:
 *
 *      const DIR_CONTENT = path.join(process.cwd(), "content");
 *      const DIR_FICHAS = path.join(DIR_CONTENT, "fichas");
 *
 *  Nenhuma das duas linhas tem as duas palavras. Daí a régua de hoje: o exame é
 *  do ARQUIVO INTEIRO, e os dois pedaços do caminho são procurados em separado
 *  — cada um como SEGMENTO de caminho (entre aspas, `/` ou `\`), que é o que
 *  separa `"content", "fichas"` de um `textContent` ou de uma variável chamada
 *  `fichas`.
 *
 *  Se esta lista precisar de exceção um dia, a exceção é uma LINHA AQUI, com o
 *  motivo escrito — nunca um `// eslint-disable` no arquivo que voltou a ler. */
const RAIZ = path.join(process.cwd(), "src");

/** O ÚNICO arquivo de `src/` que pode ler o acervo do disco: é onde vive o
 *  `loadAll`, que desde 2026-09-25 roda só na semente e em teste. */
const O_UNICO = "src/lib/ficha.ts";

/** Piso de arquivos varridos. Cravado à mão e com folga pra baixo (o `src/`
 *  tinha 75 arquivos no dia em que este guarda nasceu): serve pra acusar um
 *  enumerador que parou de enumerar, não pra contar o projeto. Ver o teste da
 *  VARREDURA abaixo. */
const PISO_DE_ARQUIVOS = 50;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

const relativo = (p: string) => path.relative(process.cwd(), p).replace(/\\/g, "/");

/** Depois de que `/` pode vir um REGEX LITERAL em vez de uma divisão: fim de
 *  operador, de abre-parêntese, de vírgula, ou de uma das palavras que esperam
 *  um valor. Depois de identificador, número, `)`, `]` ou fim de string, uma
 *  barra é divisão. Heurística conhecida, e é o que basta aqui. */
const ANTES_DE_REGEX =
  /[(,=:[!&|?{};+\-*%^<>~]$|\b(?:return|typeof|case|in|of|new|delete|void|yield|await|do|else)$/;

/** A tira de comentários deste guarda — e ela NÃO é o `replace` de uma linha que
 *  os outros arquivos de teste usam, de propósito. Ela é um varredor, e o que ele
 *  entende (e o que não entende) está escrito aqui porque **guarda cego é guarda
 *  silencioso**, e este guarda sustenta a rodada inteira.
 *
 *  🔴 "TIRA-DE-COMENTÁRIOS QUE COME O ARQUIVO" é espécie catalogada neste
 *  projeto, e ela já cobrou duas vezes nesta tarefa — as duas MEDIDAS:
 *
 *   1. `src.replace(/\/\*[\s\S]*?\*\//g, "")`, a tira de uma linha, não sabe o
 *      que é string: com um `"/*"` dentro de um literal ela comeu **10251 dos
 *      14800 caracteres** do `cache-rotas.ts` (69%) e devolveu "limpo" um
 *      arquivo com o caminho do acervo em código.
 *   2. a 1ª versão DESTE varredor não sabia o que era regex literal, e a
 *      re-revisão mediu as duas formas que a cegavam: um regex terminado em
 *      barra escapada (`/^\/api\//` é a forma realista) fazia o `\//` final
 *      passar por começo de comentário e **apagava o resto da linha**; e um
 *      regex com abre-comentário dentro de classe (`/[/*]/`) apagava dali até o
 *      próximo fechamento — 109 de 148 caracteres num arquivo de ensaio, com o
 *      canário CALADO, porque o `import` do topo sobreviveu.
 *
 *  O (2) é o mesmo furo do (1) entrando por outra porta, e é por isso que o
 *  varredor de hoje entende QUATRO formas: comentário de linha, comentário de
 *  bloco, string/template (`"` `'` e crase) e regex literal — este último pelo
 *  `ANTES_DE_REGEX` acima, respeitando escape e classe `[...]`.
 *
 *  ⚠️ O QUE ELE NÃO ENTENDE, porque ele não é um parser: texto de JSX (um `//`
 *  solto no meio de `<p>…</p>` passaria por comentário de linha), `${}` aninhado
 *  dentro de template, e regex em posição que o `ANTES_DE_REGEX` não licencia.
 *  Medido em 2026-09-25 nos 75 arquivos de `src/`: nenhum deles tem qualquer uma
 *  dessas formas (nem `\//`, nem `//` em texto de JSX), então o guarda não está
 *  cego hoje — mas "hoje" não é remédio, é o estado, e é por isso que está
 *  escrito aqui em vez de virar silêncio.
 *
 *  Nos outros erros — string sem fechar, template aninhado, regex sem fechar na
 *  linha — ele copia DEMAIS, e copiar demais deixa o guarda mais rígido, nunca
 *  mais frouxo. O `CANARIOS` abaixo é a segunda linha, e pega só o caso
 *  grosseiro (arquivo comido inteiro), nunca o pedaço. */
function semComentarios(src: string): string {
  let fora = "";
  let i = 0;
  /** O rabo do que já saiu, sem espaço no fim: é o que diz se um `/` é regex ou
   *  divisão. 24 caracteres bastam pra maior das palavras da lista. */
  const cauda = () => fora.slice(-24).replace(/\s+$/, "");
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      fora += src.slice(i, j + 1); // a string inteira ATRAVESSA, aspas e tudo
      i = j + 1;
    } else if (c === "/" && d === "/") {
      // Comentário de linha. `//` nunca é regex (regex vazio não existe) nem
      // divisão dupla, então esta checagem vem antes da do regex.
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && d === "*") {
      // Comentário de bloco. `/*` também nunca é regex: quantificador sem alvo.
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === "/" && (cauda() === "" || ANTES_DE_REGEX.test(cauda()))) {
      // Regex literal: ATRAVESSA inteiro, como a string. O `\` escapa qualquer
      // coisa (é o `/\//` que enganava a versão anterior) e dentro de `[...]` a
      // barra não fecha (é o `/[/*]/`).
      let j = i + 1;
      let emClasse = false;
      while (j < src.length) {
        const ch = src[j];
        if (ch === "\\") { j += 2; continue; }
        if (ch === "\n") break; // regex não atravessa linha: desiste e copia
        if (emClasse) { if (ch === "]") emClasse = false; j++; continue; }
        if (ch === "[") { emClasse = true; j++; continue; }
        if (ch === "/") { j++; break; }
        j++;
      }
      fora += src.slice(i, j);
      i = j;
    } else {
      fora += c;
      i++;
    }
  }
  return fora;
}

/** O canário do arquivo despido: as palavras que um arquivo de código tem e um
 *  arquivo comido não tem. A comparação é com o ANTES, nunca com uma expectativa
 *  cravada — `src/app/sw.ts` não tem um único `export` (é script de service
 *  worker, não módulo), e medir "todo arquivo tem export" acusaria ELE em vez da
 *  tira. A regra que vale é: se o arquivo TINHA e o despido NÃO TEM, a tira
 *  comeu. (Medido: foi assim que o `sw.ts` apareceu.) */
const CANARIOS = /\b(?:export|import|const|function)\b/;

/** Os dois pedaços do caminho do acervo, cada um como SEGMENTO: entre aspas,
 *  crase, `/` ou `\`. É o que casa `"content", "fichas"`, `"content/fichas"` e
 *  `'content\\fichas'`, e é o que NÃO casa `textContent` nem `const fichas =`.
 *  Insensível a caixa: `Content/Fichas` acharia o mesmo diretório no Windows. */
const SEGMENTO_CONTENT = /["'`/\\]content["'`/\\]/i;
const SEGMENTO_FICHAS = /["'`/\\]fichas["'`/\\]/i;

/** O nome que este projeto deu ao diretório, e que dispensa os segmentos. */
const CONSTANTE_DO_DIRETORIO = /\bFICHAS_DIR\b/;

/** 🔴 A OUTRA METADE, e é a mais provável das duas: `loadAll` é a leitura de
 *  disco com NOME DE FUNÇÃO. Uma rota que faça `loadAll()` lê o acervo do disco
 *  sem citar caminho nenhum — nenhum regex de caminho a pegaria, e é
 *  exatamente o que o comentário do `loadAll` manda não fazer. Fora do
 *  `ficha.ts`, em `src/`, mencionar esse nome já é o defeito. */
const O_LEITOR = /\bloadAll\b/;

/** O arquivo lê o acervo do disco? Exame do arquivo INTEIRO, no código (a prosa
 *  sai antes). Devolve o motivo, pro relatório da falha dizer qual metade
 *  acusou. */
function porQueLeOAcervo(fonte: string): string | null {
  const codigo = semComentarios(fonte);
  if (CANARIOS.test(fonte) && !CANARIOS.test(codigo)) {
    throw new Error(
      "a tira de comentários comeu o arquivo (sumiram os `export`/`import`/`const`/" +
        "`function` que ele tinha): este guarda julgaria o vazio e ficaria verde. " +
        "Provável `/*` dentro de string ou de regex literal.",
    );
  }
  if (O_LEITOR.test(codigo)) return "chama `loadAll`";
  if (CONSTANTE_DO_DIRETORIO.test(codigo)) return "usa `FICHAS_DIR`";
  if (SEGMENTO_CONTENT.test(codigo) && SEGMENTO_FICHAS.test(codigo)) {
    return "monta o caminho `content/fichas`";
  }
  return null;
}

describe("nenhum caminho de produção lê content/fichas", () => {
  // 🔴 CONTROLE DA VARREDURA, e ele é o irmão esquecido do controle do detector:
  // o teste principal EXCLUI o `ficha.ts` da lista, então ele não pode servir de
  // canário de si mesmo. Se o `arquivos()` passar a devolver `[]` — filtro de
  // extensão, `RAIZ` mudando de lugar, a pasta sendo renomeada —, os dois testes
  // de baixo ficam verdes PARA SEMPRE e o disco volta em silêncio.
  it("a varredura acha os arquivos de `src/` — inclusive o que sabemos que existe", () => {
    const vistos = arquivos(RAIZ).map(relativo);
    expect(vistos, `a varredura não achou o ${O_UNICO} — ela parou de enumerar`).toContain(O_UNICO);
    expect(
      vistos.length,
      `a varredura devolveu ${vistos.length} arquivos de src/ — abaixo do piso, ` +
        "provavelmente ela parou de descer nas subpastas",
    ).toBeGreaterThanOrEqual(PISO_DE_ARQUIVOS);
  });

  // 🔴 CONTROLE DO DETECTOR, e sem ele o teste seguinte é oco: um detector que
  // não casa com nada deixa a lista de culpados vazia pra sempre. Este teste
  // exige que ele ACUSE o leitor de verdade — o `loadAll` do `ficha.ts`, que
  // continua existindo pra semente —, e as DUAS metades dele: o nome da função e
  // o caminho.
  it("o detector acha o leitor que EXISTE — senão ele não acharia nenhum outro", () => {
    const codigo = semComentarios(fs.readFileSync(path.join(process.cwd(), O_UNICO), "utf8"));
    expect(
      O_LEITOR.test(codigo),
      "a metade do NOME parou de casar — um `loadAll()` numa rota passaria batido",
    ).toBe(true);
    expect(
      SEGMENTO_CONTENT.test(codigo) && SEGMENTO_FICHAS.test(codigo),
      "a metade do CAMINHO parou de casar — nenhum diretório de acervo seria achado",
    ).toBe(true);
  });

  it(`só o \`${O_UNICO}\` lê o acervo do disco, e só pelo \`loadAll\` da semente`, () => {
    const culpados = arquivos(RAIZ)
      .filter((p) => relativo(p) !== O_UNICO)
      .map((p) => ({ arquivo: relativo(p), motivo: porQueLeOAcervo(fs.readFileSync(p, "utf8")) }))
      .filter((x) => x.motivo !== null)
      .map((x) => `${x.arquivo} (${x.motivo})`);
    expect(
      culpados,
      "voltou a existir código de produção lendo a ficha do disco — são duas fontes " +
        "pra mesma pergunta, e elas divergem na primeira edição pelo painel",
    ).toEqual([]);
  });

  // A última asserção, e ela é mais larga que as outras de propósito: um
  // componente ou rota não tem o que fazer com `node:fs`, qualquer que seja o
  // arquivo lido. Já passava antes desta rodada, e continua sendo a linha que
  // pega a próxima tentativa antes de ela virar leitura de acervo.
  it("nenhum componente ou rota importa `node:fs`", () => {
    const culpados = arquivos(path.join(RAIZ, "app"))
      .filter((p) => /from "node:fs"|require\("node:fs"\)/.test(fs.readFileSync(p, "utf8")))
      .map(relativo);
    expect(culpados).toEqual([]);
  });
});
