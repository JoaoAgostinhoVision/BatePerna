import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, historico, versaoAtual } from "@/lib/db";
import { semear } from "@/lib/semente";
import type { Ficha } from "@/types/ficha";

let c: Client;
const AGORA = 1_758_000_000;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await ensureSchema(c); });
afterEach(() => c.close());

const fichaFalsa = (slug: string, voz: string) => ({ slug, voz }) as unknown as Ficha;

describe("semear", () => {
  it("grava uma versão por ficha, com autor semente", async () => {
    const r = await semear(c, [fichaFalsa("morro-a", "voz a"), fichaFalsa("morro-b", "voz b")], AGORA);
    expect(r.semeados.sort()).toEqual(["morro-a", "morro-b"]);
    expect((await versaoAtual(c, "morro-a"))?.autor).toBe("semente");
    expect(JSON.parse((await versaoAtual(c, "morro-a"))!.doc).voz).toBe("voz a");
    expect((await versaoAtual(c, "morro-a"))?.criado_em).toBe(AGORA);
  });

  // 🔴 O teste que mais importa desta tarefa. A semente roda uma vez em
  // produção, mas alguém vai rodá-la duas vezes — por engano, ou porque o
  // primeiro deploy falhou no meio. Se ela regravasse, a semente viraria a
  // versão MAIS NOVA e APAGARIA o que o João escreveu pelo painel: a régua
  // append-only intacta, e o texto dele perdido mesmo assim.
  it("rodar de novo NÃO regrava, e não atropela o que o painel escreveu", async () => {
    await semear(c, [fichaFalsa("morro-a", "voz original")], AGORA);
    await gravarVersao(c, "morro-a", JSON.stringify({ slug: "morro-a", voz: "voz do João" }), "painel", AGORA + 100);

    const r = await semear(c, [fichaFalsa("morro-a", "voz original")], AGORA + 200);

    expect(r.semeados).toEqual([]);
    expect(r.pulados).toEqual(["morro-a"]);
    expect(JSON.parse((await versaoAtual(c, "morro-a"))!.doc).voz).toBe("voz do João");
    expect(await historico(c, "morro-a")).toHaveLength(2);
  });

  it("ficha nova entra mesmo com as outras já semeadas", async () => {
    await semear(c, [fichaFalsa("morro-a", "a")], AGORA);
    const r = await semear(c, [fichaFalsa("morro-a", "a"), fichaFalsa("morro-b", "b")], AGORA + 10);
    expect(r.semeados).toEqual(["morro-b"]);
    expect(r.pulados).toEqual(["morro-a"]);
  });
});
