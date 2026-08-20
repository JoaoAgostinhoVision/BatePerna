import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PISOS } from "@/lib/piso";
import { fichaSchema } from "@/types/ficha";

const DOC = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");

/** Devolve o corpo da SEÇÃO (`## … \`campo\``) até o próximo `## ` — não uma
 *  janela de N caracteres a partir da primeira ocorrência do nome do campo.
 *
 *  A janela por ocorrência já mentiu neste arquivo, medido: o teste antigo
 *  fatiava a partir do primeiro `` `duracao` `` do documento, que passou a ser
 *  a NOTA DE RODAPÉ ("estes dois campos saíram do questionário"), e casava
 *  `/minuto/i` no texto da nota — verde afirmando uma pergunta que não existe
 *  mais. Ancorar no cabeçalho também é o que dá sentido ao nome do teste: o que
 *  se quer provar é que o campo TEM PERGUNTA PRÓPRIA, não que o nome dele
 *  aparece em algum lugar do arquivo. */
function secaoDoCampo(campo: string): string {
  const cabecalho = new RegExp("^## .*`" + campo + "`\\s*$", "m");
  const achado = DOC.match(cabecalho);
  expect(
    achado,
    `o questionário não tem uma seção "## … \`${campo}\`" — o campo não é perguntado`,
  ).not.toBeNull();
  const resto = DOC.slice(achado!.index! + achado![0].length);
  const fim = resto.indexOf("\n## ");
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe("o questionário cobre a ficha inteira", () => {
  // ⚠️ ESTE TESTE GARANTE MENOS DO QUE O NOME PROMETE, HOJE. Ele varre
  // `fichaSchema.shape`, que durante a EXPANSÃO desta rodada ainda tem
  // `esforco` e `duracao`; os dois já não são perguntados, e o teste passa
  // porque a NOTA DE RODAPÉ do questionário cita os dois nomes entre crases —
  // uma nota que diz textualmente que não são pergunta. Ou seja: para esses
  // dois campos, hoje, ele checa menção, não pergunta.
  //
  // Isso se resolve sozinho na Task 8, quando `esforco` e `duracao` saem do
  // schema: aí o laço deixa de visitá-los e a asserção volta a significar o
  // que diz. Não há máquina a construir aqui — construir uma lista de exceções
  // agora seria código que a Task 8 apaga. Para os campos que importam nesta
  // task (`piso`, `extensaoKm`), quem prova pergunta de verdade é
  // `secaoDoCampo` nos testes abaixo.
  it("todo campo do schema tem pergunta — senão a ficha nova nasce incompleta", () => {
    for (const campo of Object.keys(fichaSchema.shape)) {
      expect(DOC, `faltou pergunta para "${campo}"`).toContain(`\`${campo}\``);
    }
  });

  it("o questionário pergunta os dois campos novos, com o nome do campo", () => {
    // `secaoDoCampo` falha se não existir um `## … \`campo\`` — menção solta na
    // nota de rodapé não serve.
    expect(secaoDoCampo("piso").length).toBeGreaterThan(0);
    expect(secaoDoCampo("extensaoKm").length).toBeGreaterThan(0);
  });

  // 🔴 As QUATRO palavras vêm de `PISOS`, não de uma lista literal escrita
  // aqui: comparar o documento contra uma cópia local não protegeria de o enum
  // mudar e o papel ficar para trás — é a mesma razão que fez
  // `PISOS_FILTRAVEIS` ser derivado (ver tests/lib/piso.test.ts).
  //
  // Sem as palavras exatas no papel, a resposta natural de quem responde vem
  // "terra batida" ou "calçamento", e o `z.enum` recusa a ficha inteira. O
  // questionário é a interface de quem responde; se ela não diz as palavras
  // aceitas, a culpa do erro é dela.
  it("a pergunta do piso diz as QUATRO palavras aceitas, exatamente como o schema as quer", () => {
    const secao = secaoDoCampo("piso");
    for (const palavra of PISOS) {
      expect(secao, `a seção do piso não oferece a opção "${palavra}"`).toContain(palavra);
    }
  });

  // 🔴 "o PIOR trecho" sozinho ainda deixa a dúvida de pé quando o caminho
  // muda de piso no meio: quem lê pensa no trecho final, ou na média. O
  // exemplo da Rampa é o que desfaz a ambiguidade porque ele é o caso
  // CONFLITANTE — a maior parte do caminho é asfalto e a resposta ainda é
  // `barro`. Sem ele no papel, a Rampa seria respondida `asfalto-tapete` e
  // ninguém veria o erro.
  it("a pergunta do piso diz que é o PIOR trecho, e traz o exemplo da Rampa", () => {
    const secao = secaoDoCampo("piso");
    expect(secao).toContain("PIOR");
    expect(secao, "a seção do piso perdeu o exemplo da Rampa").toContain("Exemplo (Rampa)");
    const exemplo = secao.slice(secao.indexOf("Exemplo (Rampa)"));
    expect(exemplo, "o exemplo não mostra o caminho que muda de piso").toContain("asfalto");
    expect(exemplo, "o exemplo não aterrissa na resposta certa").toContain("`barro`");
  });

  // 🔴 Sem "só a ida" com todas as letras, a resposta vem ida e volta: o número
  // sai dobrado e nada no app percebe — nem o schema (é um número positivo
  // válido) nem a tela. É o tipo de erro que só aparece quando alguém caminha.
  it("a pergunta da extensão diz SÓ IDA, com todas as letras", () => {
    const secao = secaoDoCampo("extensaoKm");
    expect(secao).toMatch(/só a ida/i);
    expect(secao).toMatch(/não conte a volta/i);
  });

  // Os dois campos são `.optional()` no schema, e quem responde precisa saber
  // disso ANTES de inventar um valor pra não deixar em branco — inventar é
  // exatamente o que o aviso no topo do documento proíbe.
  it("as duas perguntas novas dizem que pular é permitido", () => {
    for (const campo of ["piso", "extensaoKm"]) {
      expect(secaoDoCampo(campo), `a seção de \`${campo}\` não diz que dá pra pular`).toMatch(
        /pular é permitido/i,
      );
    }
  });
});
