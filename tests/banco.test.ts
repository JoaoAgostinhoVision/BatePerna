import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  // 🔴 O RAMO QUE PROTEGE O BANCO DE VERDADE, e era o único dos dois sem teste:
  // um cliente REMOTO é recusado pelo `protocol`, e recusado ANTES de qualquer
  // consulta de ida — é esta linha que impede o `DELETE FROM ficha_versoes` de
  // cair no Turso do João. Roda offline: `createClient` não abre rede no
  // construtor, e o espião de `execute` é o que prova que nenhuma ida aconteceu.
  it("recusa um cliente REMOTO, e sem nem consultar o banco", async () => {
    const remoto = createClient({
      url: "libsql://banco-que-nao-existe.turso.io",
      authToken: "nenhum",
    });
    expect(remoto.protocol, "a premissa: um cliente remoto não é `file`").not.toBe("file");
    const espiao = vi.spyOn(remoto, "execute");

    await expect(semearAcervo(remoto)).rejects.toThrow(/não é local/);
    expect(espiao, "a recusa saiu DEPOIS de consultar o banco remoto").not.toHaveBeenCalled();
    remoto.close();
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
