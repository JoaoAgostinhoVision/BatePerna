import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { versoesAtuais } from "@/lib/db";
import { bancoVazio, semearAcervo } from "./banco";

/** 🔴 O TESTE DO HELPER DESTRUTIVO.
 *
 *  `semearAcervo` faz `DELETE FROM ficha_versoes` no cliente que recebe, e
 *  `bancoDeProducao` o chama com o `getClient` de PRODUÇÃO — que lê
 *  `TURSO_DATABASE_URL` e é um singleton preguiçoso. Se essa variável estiver
 *  exportada no shell apontando pro Turso do João, ou se algum teste abrir o
 *  cliente antes, o `DELETE` cairia no banco de verdade: apagaria o histórico de
 *  versões das fichas, que é a única procedência que existe desde que a ficha
 *  saiu do git.
 *
 *  A trava está em `tests/banco.ts`. Este arquivo é o que a mantém viva — sem
 *  ele, alguém a remove num refactor e nada pisca. */
const arquivosTemporarios: string[] = [];

afterEach(() => {
  for (const p of arquivosTemporarios.splice(0)) {
    // O Windows ainda segura o arquivo do sqlite um instante depois do `close()`,
    // e apagá-lo é cortesia com o `%TEMP%` — não parte da prova. Se falhar, o
    // teste não tem por que falhar com ele.
    try {
      fs.rmSync(p, { force: true });
    } catch {
      /* fica pro sistema limpar */
    }
  }
});

describe("semearAcervo só aceita banco descartável", () => {
  it("recusa um banco em ARQUIVO, e a mensagem diz o que fazer", async () => {
    const arquivo = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "bateperna-banco-")),
      "nao-e-memoria.sqlite",
    );
    arquivosTemporarios.push(arquivo);
    const emArquivo = createClient({ url: `file:${arquivo.replace(/\\/g, "/")}` });

    await expect(semearAcervo(emArquivo)).rejects.toThrow(/recusou o banco/);
    await expect(semearAcervo(emArquivo)).rejects.toThrow(/TURSO_DATABASE_URL/);
    emArquivo.close();
  });

  // Controle: a trava recusa o banco errado E deixa passar o certo. Sem esta
  // metade, uma trava que recusasse TUDO passaria no teste de cima e quebraria a
  // suíte inteira — e o de cima sozinho não distingue as duas coisas.
  it("aceita `:memory:` e deixa o acervo lá dentro", async () => {
    const c = bancoVazio();
    const fichas = await semearAcervo(c);
    expect(fichas.length, "o acervo do repositório está vazio").toBeGreaterThanOrEqual(3);
    expect((await versoesAtuais(c)).size).toBe(fichas.length);
    c.close();
  });
});
