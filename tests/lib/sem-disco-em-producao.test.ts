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
 *  MEDIDO em 2026-09-25, e a medição mudou o guarda. A primeira versão pedia
 *  que a linha juntasse o acervo com uma chamada de `node:fs` ou de
 *  `path.join`. Uma mutação que punha, no alto de `src/lib/runMotor.ts`:
 *
 *      import fsMut from "node:fs";
 *      import pathMut from "node:path";
 *      const DIR_MUT = pathMut.join(process.cwd(), "content", "fichas");
 *      const DO_DISCO = fsMut.readdirSync(DIR_MUT);
 *
 *  passou VERDE: o regex procurava `path.join(`, e o import se chamava
 *  `pathMut`. Guarda que depende do NOME do import não guarda. A régua abaixo
 *  não depende de nome nenhum: em `src/`, **mencionar o caminho do acervo em
 *  CÓDIGO** (não em comentário) já é a volta das duas fontes — produção não tem
 *  o que fazer com esse caminho, e quem o menciona vai lê-lo.
 *
 *  Se esta lista precisar de exceção um dia, a exceção é uma LINHA AQUI, com o
 *  motivo escrito — nunca um `// eslint-disable` no arquivo que voltou a ler. */
const RAIZ = path.join(process.cwd(), "src");

/** O ÚNICO arquivo de `src/` que pode ler o acervo do disco: é onde vive o
 *  `loadAll`, que desde 2026-09-25 roda só na semente e em teste. */
const O_UNICO = "src/lib/ficha.ts";

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

const relativo = (p: string) => path.relative(process.cwd(), p).replace(/\\/g, "/");

/** Mesma tira de comentários de `tests/lib/fatos-da-trilha.test.ts`: é ela que
 *  faz este guarda olhar código em vez de prosa. */
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** O caminho do acervo, em qualquer grafia que o código use: `"content",
 *  "fichas"`, `content/fichas`, `content\\fichas`, ou a constante que este
 *  projeto deu a ele. */
const CAMINHO_DO_ACERVO = /content.{0,12}fichas|FICHAS_DIR/;

/** 🔴 A OUTRA METADE, e é a mais provável das duas: `loadAll` é a leitura de
 *  disco com NOME DE FUNÇÃO. Uma rota que faça `loadAll()` lê o acervo do disco
 *  sem citar caminho nenhum — nenhum regex de caminho a pegaria, e é
 *  exatamente o que o comentário do `loadAll` manda não fazer. Fora do
 *  `ficha.ts`, em `src/`, mencionar esse nome já é o defeito. */
const O_LEITOR = /\bloadAll\b/;

/** As linhas de CÓDIGO deste arquivo que leem o acervo do disco. */
function linhasQueLeemOAcervo(fonte: string): string[] {
  return semComentarios(fonte)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => CAMINHO_DO_ACERVO.test(l) || O_LEITOR.test(l));
}

describe("nenhum caminho de produção lê content/fichas", () => {
  // 🔴 CONTROLE, e sem ele o teste abaixo é oco: um detector que não casa com
  // nada deixa a lista de culpados vazia pra sempre, e o guarda fica verde
  // enquanto o disco volta pra dentro de uma rota. Este teste exige que o
  // detector ACUSE o leitor de verdade — o `loadAll` do `ficha.ts`, que
  // continua existindo pra semente —, e as DUAS metades dele: o caminho e o
  // nome da função.
  it("o detector acha o leitor que EXISTE — senão ele não acharia nenhum outro", () => {
    const fonte = fs.readFileSync(path.join(process.cwd(), O_UNICO), "utf8");
    const achadas = linhasQueLeemOAcervo(fonte);
    expect(achadas, `o detector parou de enxergar a leitura de disco do ${O_UNICO}`).not.toEqual([]);
    expect(
      achadas.some((l) => CAMINHO_DO_ACERVO.test(l)),
      "a metade do CAMINHO parou de casar — nenhum diretório de acervo seria achado",
    ).toBe(true);
    expect(
      achadas.some((l) => O_LEITOR.test(l)),
      "a metade do NOME parou de casar — um `loadAll()` numa rota passaria batido",
    ).toBe(true);
  });

  it(`só o \`${O_UNICO}\` lê o acervo do disco, e só pelo \`loadAll\` da semente`, () => {
    const culpados = arquivos(RAIZ)
      .filter((p) => relativo(p) !== O_UNICO)
      .filter((p) => linhasQueLeemOAcervo(fs.readFileSync(p, "utf8")).length > 0)
      .map(relativo);
    expect(
      culpados,
      "voltou a existir código de produção lendo a ficha do disco — são duas fontes " +
        "pra mesma pergunta, e elas divergem na primeira edição pelo painel",
    ).toEqual([]);
  });

  // A segunda asserção, e ela é mais larga que a primeira de propósito: um
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
