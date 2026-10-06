import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { avisoVigente, avisosVigentes, ensureSchema, gravarVersao, inserirAviso, retirarAviso } from "@/lib/db";
import { base } from "../banco";

let c: Client;
const AGORA = 1_757_000_000;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  // Aviso só se grava em LUGAR (onda de fix da 11e, I1): os dois endereços
  // destes casos têm de existir. O documento não importa a esta tabela.
  await gravarVersao(c, "rampa-do-pepe", "{}", "semente", AGORA - 1);
  await gravarVersao(c, "veu-de-noiva-de-bonito", "{}", "semente", AGORA - 1);
});
afterEach(() => c.close());

describe("avisos", () => {
  // N7 da re-revisão (onda de fix 3): o nome dizia também "ou o lugar saiu dele",
  // que este caso não prova (o `base` de um endereço vazio é uma versão que não
  // existe). O lugar que SAI é provado em `tests/lib/db-endereco.test.ts` (a
  // identidade da versão, e a retomada dentro do INSERT) e em
  // `tests/api/corrida-endereco.test.ts`.
  it("endereço que nunca foi lugar (a versão-base não existe): não grava, devolve null", async () => {
    expect(await inserirAviso(c, "lugar-marcador-sem-versao", "obra", "fechado", AGORA, AGORA + 3600, await base(c, "lugar-marcador-sem-versao"))).toBeNull();
    expect((await c.execute("SELECT COUNT(*) AS n FROM avisos")).rows[0].n).toBe(0);
    // Controle: no lugar que existe, grava e devolve o id.
    expect(await inserirAviso(c, "rampa-do-pepe", "obra", "fechado", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"))).toBeTypeOf("number");
  });

  it("grava e lê o vigente", async () => {
    await inserirAviso(c, "rampa-do-pepe", "em reforma", "fechado", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    const a = await avisoVigente(c, "rampa-do-pepe", AGORA);
    expect(a?.texto).toBe("em reforma");
    expect(a?.efeito).toBe("fechado");
  });

  it("lugar sem aviso devolve null", async () => {
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA)).toBeNull();
  });

  // 🔴 O prazo é o ponto do campo: aviso sem validade é mentira agendada — "em
  // reforma" ainda no ar em março. A borda decide de um jeito só.
  it("vencido não é vigente, e o instante exato do vencimento já venceu", async () => {
    await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 60, await base(c, "rampa-do-pepe"));
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA + 59)).not.toBeNull();
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA + 60)).toBeNull();
  });

  it("dois avisos no mesmo lugar: vence o mais recente", async () => {
    await inserirAviso(c, "rampa-do-pepe", "velho", "frio", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    await inserirAviso(c, "rampa-do-pepe", "novo", "fresco", AGORA + 10, AGORA + 3600, await base(c, "rampa-do-pepe"));
    expect((await avisoVigente(c, "rampa-do-pepe", AGORA + 20))?.texto).toBe("novo");
  });

  // 🔴 APPEND-ONLY. Retirar não apaga: num app cuja linha vermelha é
  // procedência, saber o que foi dito sobre um lugar e quando não é luxo.
  it("retirar tira da tela mas NAO apaga a linha", async () => {
    const id = await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    await retirarAviso(c, id!);
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA)).toBeNull();
    const todas = await c.execute("SELECT COUNT(*) AS n FROM avisos");
    expect(Number(todas.rows[0].n), "a linha foi APAGADA — o historico morreu").toBe(1);
  });

  it("o aviso de um lugar não vaza para outro", async () => {
    await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    expect(await avisoVigente(c, "veu-de-noiva-de-bonito", AGORA)).toBeNull();
  });

  it("avisosVigentes traz todos de uma vez, sem os vencidos nem os retirados", async () => {
    await inserirAviso(c, "rampa-do-pepe", "a", "frio", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    await inserirAviso(c, "veu-de-noiva-de-bonito", "b", "nenhum", AGORA, AGORA + 10, await base(c, "veu-de-noiva-de-bonito"));
    const m = await avisosVigentes(c, AGORA + 20);
    expect([...m.keys()]).toEqual(["rampa-do-pepe"]);
  });

  // 🔴 Teste que falta no brief: o único caso de avisosVigentes tem UM aviso
  // por lugar, então a ordem do ORDER BY não decide quem vence o Map.set().
  // Isto trava a regra "o mais recente vence" quando há DOIS avisos no MESMO
  // lugar — mesma regra que avisoVigente já prova, mas por este outro caminho.
  it("avisosVigentes: dois avisos no mesmo lugar, vence o mais recente", async () => {
    await inserirAviso(c, "rampa-do-pepe", "velho", "frio", AGORA, AGORA + 3600, await base(c, "rampa-do-pepe"));
    await inserirAviso(c, "rampa-do-pepe", "novo", "fresco", AGORA + 10, AGORA + 3600, await base(c, "rampa-do-pepe"));
    const m = await avisosVigentes(c, AGORA + 20);
    expect(m.get("rampa-do-pepe")?.texto).toBe("novo");
  });
});
