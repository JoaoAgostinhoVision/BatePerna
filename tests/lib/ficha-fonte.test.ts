import { createClient, type Client } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema, gravarVersao, versoesAtuais } from "@/lib/db";
import { buscarFichas, esquecerMemoria, PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import rampa from "../../content/fichas/rampa-do-pepe.json";

beforeEach(() => esquecerMemoria());

const umaLinha = (doc: unknown) => new Map([["rampa-do-pepe", { doc: JSON.stringify(doc), oculto: false }]]);

describe("buscarFichas", () => {
  it("lê do banco e valida pelo fichaSchema", async () => {
    const fichas = await buscarFichas(async () => umaLinha(rampa));
    expect(fichas).toHaveLength(1);
    expect(fichas[0].slug).toBe("rampa-do-pepe");
  });

  // 🔴 A porta de leitura também valida: documento podre no banco não vira
  // ficha na tela. O banco é escrito por formulário agora, não por mim.
  it("documento inválido no banco estoura, não vira ficha pela metade", async () => {
    await expect(buscarFichas(async () => umaLinha({ slug: "x" }))).rejects.toThrow();
  });

  // 🔴 O caso da escolha 6 dele: banco pendurado, memória quente.
  it("banco pendurado com cópia em memória: serve a última boa", async () => {
    vi.useFakeTimers();
    await buscarFichas(async () => umaLinha(rampa));
    const pendurado = buscarFichas(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    expect((await pendurado)[0].slug).toBe("rampa-do-pepe");
    vi.useRealTimers();
  });

  // 🔴 E o outro lado da MESMA escolha, que é o que ele pediu de propósito:
  // sem memória, a tela NÃO inventa e NÃO mostra semente — ela estoura, e o
  // `error.tsx` do app aparece. Este teste é o que impede alguém de "melhorar"
  // isso mais tarde caindo no JSON do repositório.
  it("banco pendurado SEM cópia em memória: estoura, nunca conteúdo velho", async () => {
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    // Achado ao rodar a suíte (não do brief): entre criar `pendurado` e o
    // `await expect(...)` mais abaixo, `advanceTimersByTimeAsync` já assenta a
    // rejeição (o `throw` do banco-fora-sem-memória) sem que ninguém ainda
    // esteja olhando essa promessa — o Node marca UNHANDLED nesse intervalo e,
    // sob concorrência de workers, chegou a matar o worker (suíte caindo pra
    // 1125/1130 numa corrida observada). Este `.catch` mudo só marca a
    // promessa como "alguém está de olho" a tempo; não muda o que é testado —
    // a asserção de verdade continua sendo o `rejects.toThrow()` abaixo, na
    // MESMA promessa.
    pendurado.catch(() => {});
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    await expect(pendurado).rejects.toThrow();
    vi.useRealTimers();
  });

  it("banco que RECUSA sem memória: estoura igual", async () => {
    await expect(buscarFichas(async () => { throw new Error("turso fora"); })).rejects.toThrow();
  });

  // 🔴 Ruling P7 (2026-09-25): o `comPrazo` é um `Promise.race` — uma recusa da
  // promessa lida PROPAGA a recusa (não estoura o prazo). Quem serve a última
  // boa quando o Turso RECUSA (em vez de pendurar) é só o `try/catch` em volta
  // do `comPrazo`. Sem ele, este caso ficaria indistinguível do de cima nos 7
  // testes do brief — os dois "rejects.toThrow()" passariam mesmo com o banco
  // recusando e propagando, escondendo que a memória não foi consultada.
  it("banco que RECUSA com cópia em memória: serve a última boa", async () => {
    await buscarFichas(async () => umaLinha(rampa));
    const fichas = await buscarFichas(async () => { throw new Error("turso fora"); });
    expect(fichas[0].slug).toBe("rampa-do-pepe");
  });

  // 🔴 A memória guarda a ÚLTIMA boa, não a primeira: depois de o João salvar,
  // a cópia velha não pode ressuscitar no próximo pendurado.
  it("a memória é atualizada a cada leitura boa", async () => {
    await buscarFichas(async () => umaLinha({ ...rampa, voz: "voz velha" }));
    await buscarFichas(async () => umaLinha({ ...rampa, voz: "voz nova" }));
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    expect((await pendurado)[0].voz).toBe("voz nova");
    vi.useRealTimers();
  });

  it("ordena por nome do primeiro waypoint, como a home espera", async () => {
    const fichas = await buscarFichas(async () => new Map([
      ["b", { doc: JSON.stringify({ ...rampa, slug: "b", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Zebu" }] } }), oculto: false }],
      ["a", { doc: JSON.stringify({ ...rampa, slug: "a", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Abacate" }] } }), oculto: false }],
    ]));
    expect(fichas.map((f) => f.trajeto.waypoints[0].nome)).toEqual(["Abacate", "Zebu"]);
  });

  // 🔴 C1 DA REVISÃO FINAL (2026-09-26): um `Map` VAZIO é uma leitura BEM
  // SUCEDIDA, não um banco fora — mas antes deste conserto ela caía no MESMO
  // ramo de "tudo certo" que uma leitura com fichas, e `[]` virava "última
  // boa" pra sempre. Os dois lados da mesma escolha 6 dele, agora cobrindo
  // vazio: com memória quente, serve a última boa; sem memória, estoura —
  // nunca lista vazia (que é a home dizendo "não existe trilha nenhuma").
  it("banco de pé mas com a tabela VAZIA, e cópia em memória: serve a última boa", async () => {
    await buscarFichas(async () => umaLinha(rampa));
    const fichas = await buscarFichas(async () => new Map());
    expect(fichas[0].slug).toBe("rampa-do-pepe");
  });

  it("banco de pé mas com a tabela VAZIA, SEM cópia em memória: estoura, nunca lista vazia", async () => {
    await expect(buscarFichas(async () => new Map())).rejects.toThrow();
  });

  // 🔴 I5 DA REVISÃO FINAL: a chave do Map (o `ficha_slug` do banco) é a
  // identidade de verdade da linha; o `slug` de DENTRO do documento é só o
  // que foi digitado lá. Hoje os três escritores mantêm os dois iguais, mas
  // isso valia por disciplina, não por trava — o leitor de disco (`loadAll`)
  // já tem essa trava; o de banco não tinha. Uma linha gravada sob uma chave
  // e com outro slug escrito dentro do doc tem que estourar, nunca servir a
  // ficha (potencialmente a de outro lugar) em silêncio.
  it("chave do banco e slug de dentro do documento divergem: estoura, nunca serve a ficha errada", async () => {
    const doc = { ...rampa, slug: "pedra-furada-de-venturosa" };
    await expect(
      buscarFichas(async () => new Map([["rampa-do-pepe", { doc: JSON.stringify(doc), oculto: false }]])),
    ).rejects.toThrow(/divergente/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ESCONDER LUGARES, CONTRA O BANCO DE VERDADE (Tarefa 4 da rodada do painel
// completo, 2026-09-27; refeito no C1 da revisão final da mesma rodada,
// 2026-10-06).
//
// O C1 de 26/09 pôs a tabela VAZIA no ramo do banco fora. Até 06/10 a pergunta
// do vazio era feita sobre o mapa JÁ FILTRADO pelo SQL, e esconder TODOS os
// lugares caía nela: a instância quente servia os escondidos pela memória, a
// fria derrubava o app público. Agora a leitura traz o acervo inteiro
// (`incluirOcultos: true`, como `getAllFichas`), o vazio se decide por ele, e
// o filtro do público acontece depois — tudo escondido é `[]` honesto.
//
// 🔴 ESTE BLOCO USA `versoesAtuais` DE VERDADE, contra um banco de verdade, em
// vez de um `Map` montado à mão: o que ele mede é a JUNÇÃO das peças — a coluna
// `oculto` lida pelo SQL e o filtro em `buscarFichas`.
//
// ⚠️ A CÓPIA EM MEMÓRIA (`ultimaBoa`) pode fazer qualquer um destes passar por
// ACIDENTE: ela vive no módulo e atravessa o arquivo. O `beforeEach` do topo a
// esquece; quem a esquenta de propósito diz por quê.
// ═══════════════════════════════════════════════════════════════════════════
describe("buscarFichas contra o banco: lugar escondido", () => {
  const doc = (slug: string) => JSON.stringify({ ...rampa, slug });
  const lerTudo = (c: Client) => versoesAtuais(c, { incluirOcultos: true });

  async function banco(): Promise<Client> {
    const c = createClient({ url: ":memory:" });
    await ensureSchema(c);
    return c;
  }

  // 🔴 A PREMISSA MEDIDA, e sem ela os casos abaixo poderiam estar medindo um
  // banco quebrado em vez do esconder: o MESMO arranjo, com o lugar no ar,
  // entrega a ficha.
  it("com o lugar no ar, a mesma leitura entrega a ficha", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    const fichas = await buscarFichas(() => lerTudo(c));
    expect(fichas.map((f) => f.slug)).toEqual(["rampa-do-pepe"]);
    c.close();
  });

  it("esconder o ÚNICO lugar, instância fria: lista vazia honesta, não estouro", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "painel", 2, true);
    expect(await buscarFichas(() => lerTudo(c))).toEqual([]);
    c.close();
  });

  // 🔴 O CAMINHO QUENTE — o C1 da revisão final de 06/10. Até ali este caso
  // PINAVA o defeito: a memória esquentada com o lugar no ar servia o lugar
  // escondido até a instância morrer, com o banco DE PÉ.
  it("esconder o ÚNICO lugar, instância QUENTE: lista vazia, a memória não serve o escondido", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    const antes = await buscarFichas(() => lerTudo(c));
    expect(antes.map((f) => f.slug), "a premissa: a memória esquentou com o lugar").toEqual(["rampa-do-pepe"]);

    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "painel", 2, true);
    expect(await buscarFichas(() => lerTudo(c))).toEqual([]);

    // E o que se memorizou foi o `[]`: com o banco recusando agora, a
    // memória devolve o vazio, não o escondido.
    const naQueda = await buscarFichas(async () => { throw new Error("turso fora"); });
    expect(naQueda).toEqual([]);
    c.close();
  });

  // O outro lado, e é o caminho normal: esconder UM lugar não derruba o acervo.
  it("esconder um lugar de dois deixa o outro no ar", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    await gravarVersao(c, "veu-de-noiva-de-bonito", doc("veu-de-noiva-de-bonito"), "semente", 1);
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "painel", 2, true);
    const fichas = await buscarFichas(() => lerTudo(c));
    expect(fichas.map((f) => f.slug)).toEqual(["veu-de-noiva-de-bonito"]);
    c.close();
  });

  // 🔴 O CONTROLE do outro lado: a tabela REALMENTE vazia (schema sem semente)
  // continua no ramo do banco fora — sem memória estoura, com memória serve a
  // última boa. Contra o banco de verdade, não um `Map()` literal.
  it("tabela realmente vazia: sem memória estoura; com memória serve a última boa", async () => {
    const vazio = await banco();
    await expect(buscarFichas(() => lerTudo(vazio))).rejects.toThrow();
    const cheio = await banco();
    await gravarVersao(cheio, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    await buscarFichas(() => lerTudo(cheio));
    expect((await buscarFichas(() => lerTudo(vazio))).map((f) => f.slug)).toEqual(["rampa-do-pepe"]);
    vazio.close();
    cheio.close();
  });
});
