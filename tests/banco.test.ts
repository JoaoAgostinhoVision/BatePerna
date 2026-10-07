import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contarHoje, criarRascunho, gravarVersao, insertConfirmacao, inserirAviso, listarRascunhos, trocarEndereco, upsertFreshness, versoesAtuais, avisoVigente } from "@/lib/db";
import { bancoVazio, semearAcervo, base } from "./banco";
import { lugarMarcador } from "./lugar-marcador";

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

/** 🔴 O ISOLAMENTO ENTRE TESTES DO MESMO ARQUIVO (Tarefa 11e, I9 da auditoria).
 *  `semearAcervo` é o `beforeEach` de vários arquivos com o MESMO cliente; com a
 *  semente pulando todo endereço antigo (E6), uma troca de endereço num teste
 *  deixaria o seguinte com um lugar a menos — verde ou vermelho pelo motivo
 *  errado. E pela mesma razão os avisos, relatos e rascunhos de um teste não
 *  podem atravessar pro outro. */
describe("semearAcervo limpa o que a troca de endereço suja", () => {
  it("um teste troca o endereço da Rampa; o seguinte, no mesmo cliente, acha as 3 fichas e nada do anterior", async () => {
    const c = bancoVazio();
    const fichas = await semearAcervo(c);
    const AGORA = 1_759_000_000;
    await inserirAviso(c, "rampa-do-pepe", "aviso marcador", "fechado", AGORA - 1, AGORA + 3600, await base(c, "rampa-do-pepe"));
    await insertConfirmacao(c, "rampa-do-pepe", AGORA - 1, "seco");
    await criarRascunho(c, "lugar-marcador-cidade-marcador", "{}", AGORA);
    expect(await trocarEndereco(c, "rampa-do-pepe", "lugar-marcador-x", AGORA, await base(c, "rampa-do-pepe"))).toBe(true);
    // 🔴 M4 DA REVISÃO: aviso e relato gravados DEPOIS da troca, no endereço
    // novo. Os de cima a troca MOVE pra `lugar-marcador-x`, e por isso "a Rampa
    // não tem aviso" seria verdade sem limpeza nenhuma.
    expect(await inserirAviso(c, "lugar-marcador-x", "aviso marcador depois", "frio", AGORA, AGORA + 3600, await base(c, "lugar-marcador-x"))).not.toBeNull();
    await insertConfirmacao(c, "lugar-marcador-x", AGORA, "barro");

    await semearAcervo(c);

    expect([...(await versoesAtuais(c)).keys()].sort()).toEqual(fichas.map((f) => f.slug).sort());
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA)).toBeNull();
    expect(await contarHoje(c, "rampa-do-pepe", AGORA)).toEqual({ foram: 0, barro: 0 });
    expect(await avisoVigente(c, "lugar-marcador-x", AGORA), "aviso atravessou pro teste seguinte").toBeNull();
    expect(await contarHoje(c, "lugar-marcador-x", AGORA), "relato atravessou pro teste seguinte").toEqual({ foram: 0, barro: 0 });
    expect(await listarRascunhos(c)).toEqual([]);
    c.close();
  });
});

/** 🔴 A VARREDURA DO ISOLAMENTO: TODA tabela do banco, lida do `sqlite_master`
 *  — não de uma lista à mão, que fica cega à tabela que nascer depois. O teste
 *  suja cada uma, semeia de novo, e exige cada uma igual à de um banco recém-
 *  semeado; a mensagem diz QUAL ficou suja. O `id` sai da comparação: o
 *  `AUTOINCREMENT` não volta atrás com o `DELETE`, e o número não é conteúdo. */
describe("semearAcervo deixa TODA tabela como a de um banco recém-semeado", () => {
  type Retrato = Record<string, string[]>;
  async function retrato(c: ReturnType<typeof bancoVazio>): Promise<Retrato> {
    const tabelas = (await c.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)).rows.map((r) => String(r.name));
    const saida: Retrato = {};
    for (const t of tabelas) {
      saida[t] = (await c.execute(`SELECT * FROM "${t}"`)).rows
        .map((r) => {
          const { id: _id, ...resto } = { ...r } as Record<string, unknown>;
          return JSON.stringify(resto);
        })
        .sort();
    }
    return saida;
  }

  it("um teste suja cada tabela; depois da semente, nenhuma guarda o que ele deixou", async () => {
    const limpo = bancoVazio();
    await semearAcervo(limpo);
    const esperado = await retrato(limpo);
    limpo.close();
    expect(Object.keys(esperado).length, "a premissa: o sqlite_master listou as tabelas").toBeGreaterThanOrEqual(6);

    const c = bancoVazio();
    await semearAcervo(c);
    const AGORA = 1_759_000_000;
    const X = "lugar-marcador-sujo";
    await gravarVersao(c, X, JSON.stringify(lugarMarcador(X, "Lugar Marcador Sujo", "Cidade Marcador Suja")), "painel", AGORA);
    await inserirAviso(c, X, "aviso marcador sujo", "fechado", AGORA - 1, AGORA + 3600, await base(c, X));
    await insertConfirmacao(c, X, AGORA - 1, "seco");
    await upsertFreshness(c, { slug: X, estado: "fresco", calculadoEm: AGORA, fonte: "marcador", previsaoBruta: "{}" });
    await criarRascunho(c, "lugar-marcador-sujo-rascunho", "{}", AGORA);
    await c.execute({ sql: `INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, ?, ?)`, args: ["lugar-marcador-velho-sujo", X, AGORA] });
    const sujo = await retrato(c);
    expect(Object.keys(sujo)).toEqual(Object.keys(esperado));
    for (const t of Object.keys(esperado)) {
      expect(sujo[t], `a premissa: o teste não sujou a tabela ${t} — suje-a aqui`).not.toEqual(esperado[t]);
    }

    await semearAcervo(c);

    const depois = await retrato(c);
    for (const t of Object.keys(esperado)) {
      expect(depois[t], `a tabela ${t} ficou suja depois da semente`).toEqual(esperado[t]);
    }
    c.close();
  });
});
