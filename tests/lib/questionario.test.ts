import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fichaSchema } from "@/types/ficha";

const DOC = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");

describe("o questionário cobre a ficha inteira", () => {
  it("todo campo do schema tem pergunta — senão a ficha nova nasce incompleta", () => {
    for (const campo of Object.keys(fichaSchema.shape)) {
      expect(DOC, `faltou pergunta para "${campo}"`).toContain(`\`${campo}\``);
    }
  });

  it("o questionário pergunta os dois campos novos, com o nome do campo", () => {
    expect(DOC).toContain("`esforco`");
    expect(DOC).toContain("`duracao`");
  });

  it("a pergunta da duração pede minutos — senão a resposta vem em texto e o schema recusa", () => {
    // ATENÇÃO: `indexOf` acha a PRIMEIRA ocorrência. Se o `duracao` da seção
    // "O que acontece depois de responder" vier antes da pergunta no arquivo,
    // esta fatia pega a seção errada e o teste vira loteria. Posicione as duas
    // seções novas DEPOIS de "## O acesso" e ANTES de "## O que acontece
    // depois", como o Step 3 manda — e se o arquivo não permitir isso, ancore
    // no cabeçalho da seção em vez de na primeira ocorrência do campo.
    const secao = DOC.slice(DOC.indexOf("`duracao`"));
    expect(secao.slice(0, 900)).toMatch(/minuto/i);
  });

  // Do pré-voo: sem os três nomes EXATOS no papel, a resposta natural do João
  // vem "moderada" ou "média" e o schema recusa — que é precisamente o defeito
  // que a lição "para artefato que vira entrada de outra coisa, a prova é
  // USÁ-LO" já pegou duas vezes neste projeto. O questionário é a interface de
  // quem responde; se ela não diz as palavras aceitas, a culpa do erro é dela.
  it("a pergunta do esforço diz as TRÊS palavras aceitas, exatamente como o schema as quer", () => {
    const secao = DOC.slice(DOC.indexOf("`esforco`"), DOC.indexOf("`esforco`") + 900);
    for (const palavra of ["leve", "media", "puxada"]) {
      expect(secao).toContain(palavra);
    }
  });
});
