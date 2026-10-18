import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRascunho } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDaTroca, colisaoDoPar, parOcupado, travaDaPessoa } from "@/lib/par-de-lugar";
import { parDeRascunho } from "@/lib/rascunho";
import { AGORA_SEMENTE, semearAcervo } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

/** 🔴 O DADO ESTRUTURADO DA COLISÃO — o que a rota de quem usa (Task 10) lê.
 *
 *  Até a Task 10, `colisaoDoPar`/`colisaoDaTroca`/`colisaoDaMudanca` só tinham
 *  prova pela FRASE do painel (`parOcupado`, `parDaMudanca`): um `de` trocado,
 *  ou um `semCidade` invertido, aparecia lá como frase errada. A rota dela não
 *  lê frase nenhuma — lê `!== null` —, então aqui cada ramo é provado pelo
 *  objeto inteiro (`toEqual`).
 *
 *  🔴 E DESDE A TASK 17 (decisão do João de 13/10, "Nenhum ocupa"), QUEM
 *  PERGUNTA muda o que conta: rascunho de quem usa o app não colide com
 *  ninguém, e o rascunho do João colide SÓ quando quem pergunta é ele (é a
 *  lista dele). Lugar — no ar ou escondido — colide pros dois. Cada caso de
 *  rascunho é provado pelos DOIS lados (`"joao"` e `"pessoa"`). */

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

let c: Client;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await semearAcervo(c); });
afterEach(() => c.close());
const A = AGORA_SEMENTE;

const docDe = (slug: string, nome: string, cidade?: string) =>
  JSON.stringify({ slug, modos: [], ...(cidade === undefined ? {} : { cidade }), trajeto: { waypoints: [{ nome }] } });

/** O rascunho DELA que muda — "Pedra Minha", em "Cidade Teste". */
const MEU = "pedra-minha-cidade-teste";
const MEU_DOC = docDe(MEU, "Pedra Minha", "Cidade Teste");
let minhaChave: string;

beforeEach(async () => {
  const chave = await criarRascunhoDaPessoa(c, MEU, MEU_DOC, A, PESSOA.id);
  expect(chave).not.toBeNull();
  minhaChave = chave!;
});

describe("o rascunho de quem usa não colide com ninguém", () => {
  beforeEach(async () => {
    const outro = "pedra-dela-cidade-teste";
    expect(await criarRascunhoDaPessoa(c, outro, docDe(outro, "Pedra Dela", "Cidade Teste"), A, OUTRA.id)).not.toBeNull();
  });

  it.each(["pessoa", "joao"] as const)("renomear pro par de um rascunho de OUTRA pessoa (quem pergunta: %s): livre", async (quem) => {
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, "Pedra Dela", quem)).toBeNull();
  });

  it.each(["pessoa", "joao"] as const)("mudar a cidade pro par dele (%s): livre", async (quem) => {
    const meuComONome = docDe(MEU, "Pedra Dela", "Outra Cidade");
    expect(await colisaoDaMudanca(meuComONome, minhaChave, CAMPO_DA_CIDADE, "Cidade Teste", quem)).toBeNull();
  });

  it.each(["pessoa", "joao"] as const)("o par do PRÓPRIO rascunho dela, sem `exceto` (%s): livre", async (quem) => {
    expect(await colisaoDoPar("Pedra Minha", "Cidade Teste", { exceto: null, nomeNovo: true, quem })).toBeNull();
  });

  // O estado que as portas dela não produzem (rascunho dela sem cidade): nem o
  // ramo do gêmeo sem cidade o alcança mais.
  it.each(["pessoa", "joao"] as const)("rascunho de quem usa SEM cidade (%s): não espera a cidade dele", async (quem) => {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: ["rascunho_sem_cidade", docDe("sem-cidade-x", "Pedra Sem Cidade"), A, OUTRA.id],
    });
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, "Pedra Sem Cidade", quem)).toBeNull();
  });

  // A porta do painel por cima: o João cria o par de um rascunho dela.
  it("parOcupado (o painel): o par de um rascunho dela não recusa o João", async () => {
    expect(await parOcupado("Pedra Dela", "Cidade Teste", { exceto: null, nomeNovo: true })).toBeNull();
  });
});

describe("o rascunho do João: conta pro João, não pra ela", () => {
  const DO_JOAO = "pedra-do-joao-cidade-teste";
  beforeEach(async () => {
    expect(await criarRascunho(c, DO_JOAO, docDe(DO_JOAO, "Pedra do João", "Cidade Teste"), A)).toBe(true);
  });

  it("quem pergunta é o João: de rascunho-do-joao, com cidade", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, "Pedra do João", "joao")).toEqual({
      de: "rascunho-do-joao", semCidade: false, quem: "Pedra do João (Cidade Teste)",
    });
    expect(await parOcupado("Pedra do João", "Cidade Teste", { exceto: null, nomeNovo: true })).toBe(parDeRascunho("Pedra do João (Cidade Teste)"));
  });

  it("quem pergunta é ela: livre", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, "Pedra do João", "pessoa")).toBeNull();
    expect(await colisaoDoPar("Pedra do João", "Cidade Teste", { exceto: null, nomeNovo: true, quem: "pessoa" })).toBeNull();
  });

  // 17/10: o lugar nasce só do nome, então rascunho do João sem cidade é o
  // estado normal — só LUGAR é gêmeo (M3). Vale pra qualquer cidade perguntada, e
  // pra cidade sem letra (`"--"`), que também não separa nada.
  it("o rascunho do João SEM cidade não é gêmeo, nem pro João", async () => {
    expect(await criarRascunho(c, "pedra-joao-sem-cidade", docDe("pedra-joao-sem-cidade", "Pedra Joao Sem Cidade"), A)).toBe(true);
    expect(await criarRascunho(c, "pedra-joao-tracos", docDe("pedra-joao-tracos", "Pedra Joao Tracos", "--"), A)).toBe(true);
    for (const quem of ["joao", "pessoa"] as const) {
      expect(await colisaoDoPar("Pedra Joao Sem Cidade", "Cidade Teste", { exceto: null, nomeNovo: true, quem }), quem).toBeNull();
      expect(await colisaoDoPar("Pedra Joao Sem Cidade", "", { exceto: null, nomeNovo: true, quem }), quem).toBeNull();
      expect(await colisaoDoPar("Pedra Joao Tracos", "", { exceto: null, nomeNovo: true, quem }), quem).toBeNull();
    }
    expect(await parOcupado("Pedra Joao Sem Cidade", "", { exceto: null, nomeNovo: true })).toBeNull();
  });

  it("o `exceto` tira o próprio rascunho do João", async () => {
    expect(await colisaoDoPar("Pedra do João", "Cidade Teste", { exceto: DO_JOAO, nomeNovo: true, quem: "joao" })).toBeNull();
  });
});

describe("lugar colide pros dois", () => {
  it.each(["pessoa", "joao"] as const)("lugar do João sem cidade (%s): de lugar, semCidade, só o nome", async (quem) => {
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, "Rampa do Pepê", quem)).toEqual({
      de: "lugar", semCidade: true, quem: "Rampa do Pepê",
    });
  });

  it.each(["pessoa", "joao"] as const)("lugar ESCONDIDO com cidade (%s): de lugar, com cidade", async (quem) => {
    const H = "pedra-escondida-endereco-de-antes";
    await c.execute({
      sql: "INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto) VALUES (?, ?, 'painel', ?, 1)",
      args: [H, docDe(H, "Pedra Escondida", "Cidade Teste"), A],
    });
    expect(await colisaoDoPar("Pedra Escondida", "Cidade Teste", { exceto: null, nomeNovo: true, quem })).toEqual({
      de: "lugar", semCidade: false, quem: "Pedra Escondida (Cidade Teste)",
    });
  });
});

describe("a troca e a mudança", () => {
  it("o próprio lugar fica de fora (exceto)", async () => {
    const L = "pedra-com-cidade-cidade-teste";
    const docL = docDe(L, "Pedra Com Cidade", "Cidade Teste");
    await c.execute({
      sql: "INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto) VALUES (?, ?, 'contribuidor', ?, 0)",
      args: [L, docL, A],
    });
    expect(await colisaoDaTroca(docL, L, "Pedra Com Cidade", "Cidade Teste", "pessoa")).toBeNull();
    // Noutro endereço, o par é o dele: a prova acima não é vácua.
    expect(await colisaoDaTroca(docL, "outro-endereco", "Pedra Com Cidade", "Cidade Teste", "pessoa")).toEqual({
      de: "lugar", semCidade: false, quem: "Pedra Com Cidade (Cidade Teste)",
    });
  });

  it("reescrever o MESMO nome noutra grafia não é nome novo: o gêmeo sem cidade não espera", async () => {
    const meuRampa = docDe(MEU, "Rampa do Pepê", "Cidade Teste");
    expect(await colisaoDaTroca(meuRampa, minhaChave, "RAMPA DO PEPE", "Cidade Teste", "pessoa")).toBeNull();
    expect(await colisaoDaTroca(MEU_DOC, minhaChave, "RAMPA DO PEPE", "Cidade Teste", "pessoa")).toEqual({
      de: "lugar", semCidade: true, quem: "Rampa do Pepê",
    });
  });

  it("campo que não é o nome nem a cidade, ou valor que não é texto: null", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, "promessa", "Rampa do Pepê", "pessoa")).toBeNull();
    expect(await colisaoDaMudanca(MEU_DOC, minhaChave, CAMPO_DO_NOME, 42, "pessoa")).toBeNull();
  });
});

/** 🔴 A TRAVA DELA (Task 4): o aviso das perguntas dela. Ela só ouve que o par
 *  (ou o endereço que sairia dele) é de um LUGAR — e antigo de um lugar —,
 *  nunca de um rascunho (decisão do João de 13/10). */
describe("travaDaPessoa", () => {
  const insere = (slug: string, doc: string) =>
    c.execute({
      sql: "INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto) VALUES (?, ?, 'painel', ?, 0)",
      args: [slug, doc, A],
    });

  it("o par é de um lugar: trava; outra cidade ou outro nome: livre", async () => {
    await insere("pedra-ocupada-cidade-teste", docDe("pedra-ocupada-cidade-teste", "Pedra Ocupada", "Cidade Teste"));
    expect(await travaDaPessoa(docDe("x", "Pedra Ocupada", "Cidade Teste"))).toBe(true);
    expect(await travaDaPessoa(docDe("x", "Pedra Ocupada", "Outra Cidade"))).toBe(false);
    expect(await travaDaPessoa(docDe("x", "Pedra Livre", "Cidade Teste"))).toBe(false);
  });

  it("o endereço que sairia dela é de um lugar de OUTRO nome: trava", async () => {
    await insere("pedra-fantasma-cidade-teste", docDe("pedra-fantasma-cidade-teste", "Outro Nome Qualquer", "Cidade Teste"));
    expect(await travaDaPessoa(docDe("x", "Pedra Fantasma", "Cidade Teste"))).toBe(true);
  });

  it("endereço antigo de outro lugar também trava", async () => {
    expect(await travaDaPessoa(docDe("x", "Pedra Antiga", "Cidade Teste"))).toBe(false);
    await c.execute({
      sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, ?, ?)",
      args: ["pedra-antiga-cidade-teste", "pedra-ocupada-cidade-teste", A],
    });
    expect(await travaDaPessoa(docDe("x", "Pedra Antiga", "Cidade Teste"))).toBe(true);
  });

  it("rascunho do João com o mesmo par não trava ela; sem cidade com letra, nada a travar", async () => {
    expect(await criarRascunho(c, "pedra-do-joao-2-cidade-teste", docDe("pedra-do-joao-2-cidade-teste", "Pedra do Joao 2", "Cidade Teste"), A)).toBe(true);
    expect(await travaDaPessoa(docDe("x", "Pedra do Joao 2", "Cidade Teste"))).toBe(false);
    await insere("pedra-sem-cidade-x", docDe("pedra-sem-cidade-x", "Pedra Sem Cidade X"));
    expect(await travaDaPessoa(docDe("x", "Pedra Sem Cidade X"))).toBe(false);
    expect(await travaDaPessoa(docDe("x", "Pedra Sem Cidade X", "--"))).toBe(false);
  });
});
