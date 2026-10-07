import { createClient, type Client } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";
import { ensureSchema, gravarVersao, versoesAtuais } from "@/lib/db";
import { buscarFichas, PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import rampa from "../../content/fichas/rampa-do-pepe.json";

const umaLinha = (doc: unknown) => new Map([["rampa-do-pepe", { doc: JSON.stringify(doc), oculto: false }]]);

/** Uma leitura BOA, medida — a premissa de toda prova "com leitura boa antes".
 *  Sem ela, as provas de baixo seriam a de "banco fora numa instância que nunca
 *  leu", e passariam igual com a memória de volta (ver o bloco da decisão). */
async function leituraBoa(): Promise<void> {
  const fichas = await buscarFichas(async () => umaLinha(rampa));
  expect(fichas.map((f) => f.slug), "a premissa: houve uma leitura boa antes").toEqual(["rampa-do-pepe"]);
}

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

  // 🔴 A tela NÃO inventa e NÃO mostra semente — ela estoura, e o `error.tsx`
  // do app aparece. Este teste é o que impede alguém de "melhorar" isso mais
  // tarde caindo no JSON do repositório.
  it("banco pendurado: estoura, nunca conteúdo velho", async () => {
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    // Achado ao rodar a suíte (não do brief): entre criar `pendurado` e o
    // `await expect(...)` mais abaixo, `advanceTimersByTimeAsync` já assenta a
    // rejeição (o `throw` do banco fora) sem que ninguém ainda esteja olhando
    // essa promessa — o Node marca UNHANDLED nesse intervalo e, sob
    // concorrência de workers, chegou a matar o worker (suíte caindo pra
    // 1125/1130 numa corrida observada). Este `.catch` mudo só marca a
    // promessa como "alguém está de olho" a tempo; não muda o que é testado —
    // a asserção de verdade continua sendo o `rejects.toThrow()` abaixo, na
    // MESMA promessa.
    pendurado.catch(() => {});
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    await expect(pendurado).rejects.toThrow(/banco fora/);
    vi.useRealTimers();
  });

  // 🔴 Ruling P7 (2026-09-25): o `comPrazo` é um `Promise.race` — uma recusa da
  // promessa lida PROPAGA a recusa (não estoura o prazo). É o `try/catch` em
  // volta dele que põe a recusa no MESMO ramo do pendurado; a mensagem é o que
  // prova que passou por ali, e não que o erro cru do cliente vazou.
  it("banco que RECUSA: estoura pelo mesmo ramo do pendurado", async () => {
    await expect(buscarFichas(async () => { throw new Error("turso fora"); })).rejects.toThrow(/banco fora/);
  });

  it("ordena por nome do primeiro waypoint, como a home espera", async () => {
    const fichas = await buscarFichas(async () => new Map([
      ["b", { doc: JSON.stringify({ ...rampa, slug: "b", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Zebu" }] } }), oculto: false }],
      ["a", { doc: JSON.stringify({ ...rampa, slug: "a", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Abacate" }] } }), oculto: false }],
    ]));
    expect(fichas.map((f) => f.trajeto.waypoints[0].nome)).toEqual(["Abacate", "Zebu"]);
  });

  // 🔴 C1 DA REVISÃO FINAL (2026-09-26): um `Map` VAZIO é uma leitura BEM
  // SUCEDIDA, não um banco fora — mas só tem uma causa (tabela sem semente), e
  // entra no ramo do banco fora: estoura, nunca lista vazia (que é a home
  // dizendo "não existe trilha nenhuma").
  it("banco de pé mas com a tabela VAZIA: estoura, nunca lista vazia", async () => {
    await expect(buscarFichas(async () => new Map())).rejects.toThrow(/sem nenhuma linha/);
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
// 🔴 A DECISÃO DE 07/10: SEM MEMÓRIA. Até ali `buscarFichas` guardava a última
// leitura boa e a servia com o banco fora. O João a tirou (M4 da revisão final
// de 06/10): *"Não aceitar: nada escondido aparece nunca, e com o banco fora o
// app sai do ar"*.
//
// 🔴 CADA CASO FAZ UMA LEITURA BOA ANTES, e é isso que os torna prova. Sem ela,
// "banco fora estoura" passaria IGUAL com a memória de volta — memória vazia
// também estoura. Só uma instância que JÁ LEU distingue "não há memória" de
// "a memória estava vazia". Os três jeitos de o banco falhar, um por caso.
// ═══════════════════════════════════════════════════════════════════════════
describe("buscarFichas sem memória: leitura boa antes, banco fora depois", () => {
  it("banco PENDURADO depois de uma leitura boa: estoura", async () => {
    await leituraBoa();
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    // O mesmo `.catch` mudo do caso pendurado de cima, pela mesma razão.
    pendurado.catch(() => {});
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    await expect(pendurado).rejects.toThrow(/banco fora/);
    vi.useRealTimers();
  });

  it("banco que RECUSA depois de uma leitura boa: estoura", async () => {
    await leituraBoa();
    await expect(buscarFichas(async () => { throw new Error("turso fora"); })).rejects.toThrow(/banco fora/);
  });

  it("tabela VAZIA depois de uma leitura boa: estoura", async () => {
    await leituraBoa();
    await expect(buscarFichas(async () => new Map())).rejects.toThrow(/sem nenhuma linha/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 ESCONDER LUGARES, CONTRA O BANCO DE VERDADE (Tarefa 4 da rodada do painel
// completo, 2026-09-27; refeito no C1 da revisão final da mesma rodada,
// 2026-10-06).
//
// O C1 de 26/09 pôs a tabela VAZIA no ramo do banco fora. Até 06/10 a pergunta
// do vazio era feita sobre o mapa JÁ FILTRADO pelo SQL, e esconder TODOS os
// lugares caía nela: o app público caía (ou, com a memória que existia até
// 07/10, servia os escondidos). Agora a leitura traz o acervo inteiro
// (`incluirOcultos: true`, como `getAllFichas`), o vazio se decide por ele, e
// o filtro do público acontece depois — tudo escondido é `[]` honesto.
//
// 🔴 ESTE BLOCO USA `versoesAtuais` DE VERDADE, contra um banco de verdade, em
// vez de um `Map` montado à mão: o que ele mede é a JUNÇÃO das peças — a coluna
// `oculto` lida pelo SQL e o filtro em `buscarFichas`.
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

  it("esconder o ÚNICO lugar: lista vazia honesta, não estouro", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "painel", 2, true);
    expect(await buscarFichas(() => lerTudo(c))).toEqual([]);
    c.close();
  });

  // 🔴 O FURO DO M4, FECHADO (07/10): leitura boa com o lugar no ar, o dono o
  // esconde, e o banco cai. Com a memória, a queda servia o lugar escondido;
  // sem ela, estoura — nunca o escondido.
  it("lido no ar, escondido, e o banco cai: estoura, nunca serve o escondido", async () => {
    const c = await banco();
    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    const antes = await buscarFichas(() => lerTudo(c));
    expect(antes.map((f) => f.slug), "a premissa: houve uma leitura boa com o lugar no ar").toEqual(["rampa-do-pepe"]);

    await gravarVersao(c, "rampa-do-pepe", doc("rampa-do-pepe"), "painel", 2, true);
    expect(await buscarFichas(() => lerTudo(c))).toEqual([]);

    await expect(buscarFichas(async () => { throw new Error("turso fora"); })).rejects.toThrow(/banco fora/);
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
  // continua no ramo do banco fora — e estoura mesmo depois de uma leitura boa
  // noutro banco. Contra o banco de verdade, não um `Map()` literal.
  it("tabela realmente vazia: estoura, mesmo com uma leitura boa antes", async () => {
    const vazio = await banco();
    await expect(buscarFichas(() => lerTudo(vazio))).rejects.toThrow(/sem nenhuma linha/);
    const cheio = await banco();
    await gravarVersao(cheio, "rampa-do-pepe", doc("rampa-do-pepe"), "semente", 1);
    expect((await buscarFichas(() => lerTudo(cheio))).map((f) => f.slug)).toEqual(["rampa-do-pepe"]);
    await expect(buscarFichas(() => lerTudo(vazio))).rejects.toThrow(/sem nenhuma linha/);
    vazio.close();
    cheio.close();
  });
});
