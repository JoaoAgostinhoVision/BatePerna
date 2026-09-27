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

  // 🔴 O SEGUNDO TESTE MAIS IMPORTANTE DESTE ARQUIVO, e ele nasceu com a coluna
  // `oculto` (Tarefa 4, 2026-09-27). `jaTem` lê com `incluirOcultos: true`, e sem
  // isso um acervo cujos lugares estão TODOS escondidos pareceria VAZIO daqui: a
  // semente regravaria tudo, as versões novas nasceriam VISÍVEIS, e os lugares que
  // o dono tirou do ar de propósito VOLTARIAM — no próximo `npm run semear`, que é
  // parte do deploy. Ele não teria feito nada; o app o desobedeceria sozinho.
  it("acervo TODO escondido NÃO é regravado, e continua fora do ar", async () => {
    await semear(c, [fichaFalsa("morro-a", "voz a"), fichaFalsa("morro-b", "voz b")], AGORA);
    // O dono esconde os dois pelo painel: versão nova, mesmo documento.
    await gravarVersao(c, "morro-a", JSON.stringify({ slug: "morro-a", voz: "voz a" }), "painel", AGORA + 100, true);
    await gravarVersao(c, "morro-b", JSON.stringify({ slug: "morro-b", voz: "voz b" }), "painel", AGORA + 100, true);

    const r = await semear(c, [fichaFalsa("morro-a", "voz a"), fichaFalsa("morro-b", "voz b")], AGORA + 200);

    expect(r.semeados).toEqual([]);
    expect(r.pulados.sort()).toEqual(["morro-a", "morro-b"]);
    // 🔴 E a leitura de volta, que é o que separa "recusou" de "gravou a coisa
    // errada": nada foi acrescentado, e os dois continuam ESCONDIDOS.
    expect(await historico(c, "morro-a")).toHaveLength(2);
    expect(await historico(c, "morro-b")).toHaveLength(2);
    expect((await versaoAtual(c, "morro-a"))!.oculto).toBe(true);
    expect((await versaoAtual(c, "morro-b"))!.oculto).toBe(true);
  });

  // O par do de cima: um lugar escondido não faz a semente pular um lugar NOVO.
  it("lugar novo entra mesmo com todos os outros escondidos", async () => {
    await semear(c, [fichaFalsa("morro-a", "voz a")], AGORA);
    await gravarVersao(c, "morro-a", JSON.stringify({ slug: "morro-a", voz: "voz a" }), "painel", AGORA + 100, true);

    const r = await semear(c, [fichaFalsa("morro-a", "voz a"), fichaFalsa("morro-b", "voz b")], AGORA + 200);

    expect(r.semeados).toEqual(["morro-b"]);
    expect(r.pulados).toEqual(["morro-a"]);
    expect((await versaoAtual(c, "morro-b"))!.oculto).toBe(false);
  });

  // 🔴 Achado da revisão (fix round 1): `jaTem` é um retrato de antes do
  // laço — sem rastrear o que o próprio laço já gravou, dois slugs iguais no
  // MESMO lote passariam os dois pelo `jaTem.has` e gravariam duas vezes numa
  // única chamada, contradizendo o "IDEMPOTENTE" do docstring da função.
  it("dois slugs iguais no mesmo lote gravam UMA versão só", async () => {
    const r = await semear(c, [fichaFalsa("morro-a", "primeira"), fichaFalsa("morro-a", "segunda")], AGORA);
    expect(r.semeados).toEqual(["morro-a"]);
    expect(r.pulados).toEqual(["morro-a"]);
    expect(await historico(c, "morro-a")).toHaveLength(1);
  });
});
