import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarFichas, esquecerMemoria, PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import rampa from "../../content/fichas/rampa-do-pepe.json";

beforeEach(() => esquecerMemoria());

const umaLinha = (doc: unknown) => new Map([["rampa-do-pepe", { doc: JSON.stringify(doc) }]]);

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
      ["b", { doc: JSON.stringify({ ...rampa, slug: "b", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Zebu" }] } }) }],
      ["a", { doc: JSON.stringify({ ...rampa, slug: "a", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Abacate" }] } }) }],
    ]));
    expect(fichas.map((f) => f.trajeto.waypoints[0].nome)).toEqual(["Abacate", "Zebu"]);
  });
});
