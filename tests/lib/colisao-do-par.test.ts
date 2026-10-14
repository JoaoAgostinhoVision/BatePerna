import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRascunho } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDaTroca, colisaoDoPar, parOcupado } from "@/lib/par-de-lugar";
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

  it("o rascunho do João SEM cidade: o gêmeo espera, pro João", async () => {
    expect(await criarRascunho(c, "pedra-joao-sem-cidade", docDe("pedra-joao-sem-cidade", "Pedra Joao Sem Cidade"), A)).toBe(true);
    expect(await colisaoDoPar("Pedra Joao Sem Cidade", "Cidade Teste", { exceto: null, nomeNovo: true, quem: "joao" })).toEqual({
      de: "rascunho-do-joao", semCidade: true, quem: "Pedra Joao Sem Cidade",
    });
    expect(await colisaoDoPar("Pedra Joao Sem Cidade", "Cidade Teste", { exceto: null, nomeNovo: true, quem: "pessoa" })).toBeNull();
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
