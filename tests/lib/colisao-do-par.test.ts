import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRascunho } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDaTroca, colisaoDoPar } from "@/lib/par-de-lugar";
import { AGORA_SEMENTE, semearAcervo } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

/** 🔴 O DADO ESTRUTURADO DA COLISÃO — o que a rota de quem usa (Task 10) lê.
 *
 *  Até a Task 10, `colisaoDoPar`/`colisaoDaTroca`/`colisaoDaMudanca` só tinham
 *  prova pela FRASE do painel (`parOcupado`, `parDaMudanca`): um `de` trocado
 *  entre os dois tipos de rascunho, ou um `semCidade` invertido, aparecia lá
 *  como frase errada. A rota dela não lê frase nenhuma — lê `!== null` — e a
 *  frase do painel de quem usa (`parDeRascunhoDeQuemUsa`) é a MESMA nos dois
 *  ramos de `semCidade`, então a troca dele no ramo de quem usa passava verde
 *  por todas as provas de antes. Aqui cada ramo é provado pelo objeto inteiro
 *  (`toEqual`), com os dois valores de `semCidade` no ramo de quem usa.
 *
 *  O rascunho de quem usa SEM cidade é montado direto no banco: as portas dela
 *  nunca o produzem (provado em `tests/api/route-contribuir-rascunho.test.ts`,
 *  "cidade vazia não chega ao rascunho dela"), mas o ramo existe em
 *  `colisaoDoPar` e a troca dele tem de ficar vermelha. */

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

beforeEach(async () => {
  expect(await criarRascunhoDaPessoa(c, MEU, MEU_DOC, A, PESSOA.id)).toBe(true);
});

describe("o ramo de quem usa", () => {
  beforeEach(async () => {
    expect(await criarRascunhoDaPessoa(c, "pedra-dela-cidade-teste", docDe("pedra-dela-cidade-teste", "Pedra Dela", "Cidade Teste"), A, OUTRA.id)).toBe(true);
  });

  it("renomear pro par de um rascunho de OUTRA pessoa: de quem usa, COM cidade", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, MEU, CAMPO_DO_NOME, "Pedra Dela")).toEqual({
      de: "rascunho-de-quem-usa", semCidade: false, quem: "Pedra Dela (Cidade Teste)",
    });
  });

  it("mudar a cidade pro par dele: o mesmo dado", async () => {
    const meuComONome = docDe(MEU, "Pedra Dela", "Outra Cidade");
    expect(await colisaoDaMudanca(meuComONome, MEU, CAMPO_DA_CIDADE, "Cidade Teste")).toEqual({
      de: "rascunho-de-quem-usa", semCidade: false, quem: "Pedra Dela (Cidade Teste)",
    });
  });

  it("o mesmo nome noutra cidade não colide", async () => {
    expect(await colisaoDaMudanca(docDe(MEU, "Pedra Minha", "Outra Cidade"), MEU, CAMPO_DO_NOME, "Pedra Dela")).toBeNull();
  });

  it("rascunho de quem usa SEM cidade (estado que as portas dela não produzem): semCidade, só o nome", async () => {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: ["sem-cidade-x", docDe("sem-cidade-x", "Pedra Sem Cidade"), A, OUTRA.id],
    });
    expect(await colisaoDaMudanca(MEU_DOC, MEU, CAMPO_DO_NOME, "Pedra Sem Cidade")).toEqual({
      de: "rascunho-de-quem-usa", semCidade: true, quem: "Pedra Sem Cidade",
    });
    // E responder a cidade nunca esbarra no gêmeo (Y1): só no par.
    const meuComONome = docDe(MEU, "Pedra Sem Cidade", "Outra Cidade");
    expect(await colisaoDaMudanca(meuComONome, MEU, CAMPO_DA_CIDADE, "Cidade Teste")).toBeNull();
  });
});

describe("os outros dois ramos, pelo mesmo dado", () => {
  it("lugar do João sem cidade: de lugar, semCidade, só o nome", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, MEU, CAMPO_DO_NOME, "Rampa do Pepê")).toEqual({
      de: "lugar", semCidade: true, quem: "Rampa do Pepê",
    });
  });

  it("rascunho do João com cidade: de rascunho-do-joao", async () => {
    await criarRascunho(c, "pedra-do-joao-cidade-teste", docDe("pedra-do-joao-cidade-teste", "Pedra do João", "Cidade Teste"), A);
    expect(await colisaoDaMudanca(MEU_DOC, MEU, CAMPO_DO_NOME, "Pedra do João")).toEqual({
      de: "rascunho-do-joao", semCidade: false, quem: "Pedra do João (Cidade Teste)",
    });
  });
});

describe("a troca e a mudança", () => {
  it("o próprio rascunho fica de fora (exceto)", async () => {
    expect(await colisaoDaTroca(MEU_DOC, MEU, "Pedra Minha", "Cidade Teste")).toBeNull();
    // Sem o `exceto`, o par é o dele mesmo: a prova acima não é vácua.
    expect(await colisaoDoPar("Pedra Minha", "Cidade Teste", { exceto: null, nomeNovo: true })).toEqual({
      de: "rascunho-de-quem-usa", semCidade: false, quem: "Pedra Minha (Cidade Teste)",
    });
  });

  it("reescrever o MESMO nome noutra grafia não é nome novo: o gêmeo sem cidade não espera", async () => {
    const meuRampa = docDe(MEU, "Rampa do Pepê", "Cidade Teste");
    expect(await colisaoDaTroca(meuRampa, MEU, "RAMPA DO PEPE", "Cidade Teste")).toBeNull();
    expect(await colisaoDaTroca(MEU_DOC, MEU, "RAMPA DO PEPE", "Cidade Teste")).toEqual({
      de: "lugar", semCidade: true, quem: "Rampa do Pepê",
    });
  });

  it("campo que não é o nome nem a cidade, ou valor que não é texto: null", async () => {
    expect(await colisaoDaMudanca(MEU_DOC, MEU, "promessa", "Rampa do Pepê")).toBeNull();
    expect(await colisaoDaMudanca(MEU_DOC, MEU, CAMPO_DO_NOME, 42)).toBeNull();
  });
});
