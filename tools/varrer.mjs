#!/usr/bin/env node
/** Varre TODO texto visível de `src/` — literais de string e texto de JSX —
 *  SEM os comentários.
 *
 *  🔴 POR QUE ELE EXISTE. Em 2026-08-27 eu montei à mão um inventário de "que
 *  texto fixo no código afirma coisa sobre UM lugar". O inventário visitou dois
 *  arquivos e carimbou de seguro uma frase que não era. Esta varredura, rodada
 *  depois, achou um arquivo INTEIRO que o inventário nunca abriu
 *  (`ConfirmarFui.tsx`), com os TRÊS mesmos defeitos dentro. A lição virou
 *  regra: **inventário sem varredura mecânica inventaria só o que você já
 *  suspeitava.**
 *
 *  🔴 E POR QUE ELE ESTÁ VERSIONADO. Ele nasceu em `scratchpad/varrer.mjs`, que
 *  é scratch e SUMIU com a sessão — enquanto o `docs/RESUME.md` seguia mandando
 *  a sessão seguinte rodá-lo. Ferramenta que um documento manda usar não pode
 *  morar em diretório descartável.
 *
 *  Uso:
 *      node tools/varrer.mjs             # tudo de src/
 *      node tools/varrer.mjs Carimbo     # só arquivos cujo caminho casa
 *
 *  A pergunta que se faz a cada linha da saída:
 *      **este texto fala de UM lugar, num componente que serve TODOS?**
 *  Se falar, ele é fato de LUGAR (vai pra ficha) ou fato de MATERIAL (vai pra
 *  uma tabela em `lib/`, uma vez). Nunca frase genérica de reserva.
 *
 *  ⚠️ O QUE ELE NÃO PEGA, e isto não é modéstia — é o limite real:
 *   - texto montado por concatenação/template com pedaços vindos de variável;
 *   - texto que vem de dado (as fichas em `content/` são fonte, não código);
 *   - se a frase é VERDADE sobre o mundo — isso nenhum programa responde.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = path.join(process.cwd(), "src");
const filtro = process.argv[2] ?? "";

/** Percorre o arquivo caractere a caractere, porque regex de tira-comentário
 *  come string que CONTÉM `//` (uma URL, por exemplo) e some com meio arquivo.
 *  Devolve o código com os comentários trocados por espaço — as posições e as
 *  quebras de linha continuam batendo com o original. */
function semComentarios(src) {
  let fora = "";
  let i = 0;
  let linha = 1;
  const linhas = [];
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "\n") linha++;
    // comentário de linha
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // comentário de bloco
    if (c === "/" && d === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") {
          linha++;
          fora += "\n";
        }
        i++;
      }
      i += 2;
      continue;
    }
    // string: copia inteira, sem olhar `//` lá dentro
    if (c === '"' || c === "'" || c === "`") {
      const aspas = c;
      fora += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          fora += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (src[i] === aspas) break;
        if (src[i] === "\n") linha++;
        fora += src[i];
        i++;
      }
      fora += aspas;
      i++;
      continue;
    }
    fora += c;
    linhas[fora.length] = linha;
    i++;
  }
  return fora;
}

/** Tem letra de palavra de verdade? Corta `px`, `#fff`, `1fr`, `&&`. */
const temFrase = (s) => /\p{L}/u.test(s) && s.trim().length > 1;

/** Coisas que são código vestido de string: caminho de import, seletor, chave
 *  de dado, classe de CSS. Heurística — na dúvida ele MOSTRA, porque falso
 *  positivo custa um segundo de leitura e falso negativo custou uma rodada. */
const pareceCodigo = (s) =>
  /^[@./]/.test(s) ||
  /^[a-z0-9-]+$/.test(s) ||
  /^[a-z][a-zA-Z0-9]*$/.test(s) ||
  /^\d/.test(s) ||
  /^[A-Z_]+$/.test(s);

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivos(p));
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(p);
  }
  return saida.sort();
}

let total = 0;
for (const arquivo of arquivos(RAIZ)) {
  const rel = path.relative(process.cwd(), arquivo).replace(/\\/g, "/");
  if (filtro && !rel.includes(filtro)) continue;
  const codigo = semComentarios(readFileSync(arquivo, "utf8"));

  const achados = new Set();

  // 1) literais de string
  for (const m of codigo.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (temFrase(s) && !pareceCodigo(s)) achados.add(s);
  }

  // 2) texto solto de JSX: entre `>` e `<`, fora de chaves
  for (const m of codigo.matchAll(/>([^<>{}]+)</g)) {
    const s = m[1].replace(/\s+/g, " ").trim();
    if (temFrase(s) && !pareceCodigo(s)) achados.add(s);
  }

  if (achados.size === 0) continue;
  console.log(`\n── ${rel}`);
  for (const s of [...achados].sort()) {
    console.log(`   ${s}`);
    total++;
  }
}

console.log(`\n${total} trechos de texto visível.`);
console.log("Pergunta de cada um: fala de UM lugar, num componente que serve TODOS?");
