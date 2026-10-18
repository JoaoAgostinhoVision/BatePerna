import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema } from "@/lib/db";
import { guardarResposta, respostaGuardada, tomarVezDoNominatim } from "@/lib/db-nominatim";
import { chaveDaBusca, chaveDoPonto, urlBuscaNoMapa, urlCidadeDoPonto, USER_AGENT_DO_APP, VALIDADE_DA_RESPOSTA_S } from "@/lib/nominatim";
import { buscarNoMapa, cidadeDoPonto, FONTES_NOMINATIM, type FontesDoNominatim } from "@/lib/nominatim-servico";
import { dubleDoNominatim, nominatimDeTeste } from "../nominatim";

const fx = (nome: string): unknown => JSON.parse(readFileSync(`tests/fixtures/${nome}.json`, "utf8"));
const T0 = 1_758_300_000_000;

let c: Client;
let agora: number;
let pedir: ReturnType<typeof vi.fn>;
let f: FontesDoNominatim;

beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  agora = T0;
  pedir = vi.fn(async (url: string) => (url.includes("/search") ? fx("nominatim-busca") : fx("nominatim-reverso-town")));
  f = { pedir, client: () => c, agoraMs: () => agora };
});
afterEach(() => { c.close(); vi.unstubAllGlobals(); });

describe("a cidade do ponto", () => {
  it("acha a cidade e guarda: o mesmo ponto de novo não pede", async () => {
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ cidade: "Cidade Marcador Um" });
    agora += 10; // dentro do mesmo segundo, e mesmo assim responde: é guardado
    expect(await cidadeDoPonto(-8.10001, -35.2, f)).toEqual({ cidade: "Cidade Marcador Um" });
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir.mock.calls[0][0]).toBe(urlCidadeDoPonto(-8.1, -35.2));
  });

  it("o limite: um ponto NOVO no mesmo segundo não pede, e diz limite", async () => {
    await cidadeDoPonto(-8.1, -35.2, f);
    agora += 999;
    expect(await cidadeDoPonto(-8.3, -35.4, f)).toEqual({ falha: "limite" });
    expect(pedir).toHaveBeenCalledTimes(1);
    agora += 1;
    expect(await cidadeDoPonto(-8.3, -35.4, f)).toEqual({ cidade: expect.any(String) });
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("o limite é do banco: duas fontes com o MESMO banco dividem a vez", async () => {
    const pedir2 = vi.fn(async () => fx("nominatim-reverso-town"));
    const f2: FontesDoNominatim = { pedir: pedir2, client: () => c, agoraMs: () => agora };
    const r = await Promise.all([cidadeDoPonto(-8.1, -35.2, f), cidadeDoPonto(-8.3, -35.4, f2)]);
    expect(r.filter((x) => "cidade" in x)).toHaveLength(1);
    expect(r.filter((x) => "falha" in x && x.falha === "limite")).toHaveLength(1);
    expect(pedir.mock.calls.length + pedir2.mock.calls.length).toBe(1);
  });

  it("a vez: duas tomadas no mesmo instante, só a primeira leva", async () => {
    const r = await Promise.all([tomarVezDoNominatim(c, T0), tomarVezDoNominatim(c, T0)]);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(await tomarVezDoNominatim(c, T0 + 1000)).toBe(true);
  });

  it("fora do ar: falha 'fora', e nada guardado", async () => {
    pedir.mockRejectedValueOnce(new Error("503"));
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ falha: "fora" });
    expect(await respostaGuardada(c, chaveDoPonto(-8.1, -35.2), Math.floor(agora / 1000))).toBeNull();
  });

  it("o mar: 'sem-municipio', guardado (não pede de novo)", async () => {
    pedir.mockResolvedValue(fx("nominatim-reverso-mar"));
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ falha: "sem-municipio" });
    agora += 5_000;
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ falha: "sem-municipio" });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("resposta de mais de 30 dias conta como ausente, e é sobrescrita", async () => {
    const chave = chaveDoPonto(-8.1, -35.2);
    const s = Math.floor(agora / 1000);
    await guardarResposta(c, chave, JSON.stringify(fx("nominatim-reverso-municipality")), s - VALIDADE_DA_RESPOSTA_S - 1);
    expect(await respostaGuardada(c, chave, s)).toBeNull();
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ cidade: "Cidade Marcador Um" });
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await respostaGuardada(c, chave, s))!)).toEqual(fx("nominatim-reverso-town"));
  });

  it("resposta de 29 dias ainda vale", async () => {
    const chave = chaveDoPonto(-8.1, -35.2);
    const s = Math.floor(agora / 1000);
    await guardarResposta(c, chave, JSON.stringify(fx("nominatim-reverso-municipality")), s - VALIDADE_DA_RESPOSTA_S + 60);
    expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ cidade: "Cidade Marcador Dois" });
    expect(pedir).not.toHaveBeenCalled();
  });

  it("banco fora (tabela ausente): falha 'fora', nunca estoura", async () => {
    const cru = createClient({ url: ":memory:" }); // sem ensureSchema
    const sem: FontesDoNominatim = { ...f, client: () => cru };
    expect(await cidadeDoPonto(-8.1, -35.2, sem)).toEqual({ falha: "fora" });
    expect(await buscarNoMapa("lugar marcador", sem)).toEqual({ falha: "fora" });
    expect(pedir).not.toHaveBeenCalled();
    cru.close();
  });
});

describe("a busca no mapa", () => {
  it("a busca vazia/espaços não pede nem gasta a vez", async () => {
    expect(await buscarNoMapa("   ", f)).toEqual({ achados: [] });
    expect(await buscarNoMapa("", f)).toEqual({ achados: [] });
    expect(pedir).not.toHaveBeenCalled();
    expect(await tomarVezDoNominatim(c, agora)).toBe(true);
  });

  it("a busca guarda pela chave da busca", async () => {
    const a = await buscarNoMapa("Lugar  Marcador", f);
    expect("achados" in a && a.achados.map((x) => x.nome)).toEqual(["Lugar Marcador PE", "Lugar Marcador SC", "Lugar Marcador BA"]);
    expect(pedir.mock.calls[0][0]).toBe(urlBuscaNoMapa("Lugar  Marcador"));
    agora += 10;
    expect(await buscarNoMapa(" lugar marcador ", f)).toEqual(a); // outra caixa, outro espaço: o mesmo guardado
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(await respostaGuardada(c, chaveDaBusca("lugar marcador"), Math.floor(agora / 1000))).not.toBeNull();
  });

  it("busca nova no mesmo segundo: limite", async () => {
    await buscarNoMapa("lugar marcador", f);
    expect(await buscarNoMapa("outro marcador", f)).toEqual({ falha: "limite" });
  });

  it("rede caída na busca: 'fora', nada guardado", async () => {
    pedir.mockRejectedValueOnce(new Error("timeout"));
    expect(await buscarNoMapa("lugar marcador", f)).toEqual({ falha: "fora" });
    expect(await respostaGuardada(c, chaveDaBusca("lugar marcador"), Math.floor(agora / 1000))).toBeNull();
  });
});

describe("a rede e o dublê", () => {
  it("FONTES_NOMINATIM manda o User-Agent do app e o prazo", async () => {
    const fetchFalso = vi.fn(async (..._a: unknown[]) => Response.json({}));
    vi.stubGlobal("fetch", fetchFalso);
    await FONTES_NOMINATIM.pedir("https://nominatim.openstreetmap.org/x");
    const init = fetchFalso.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("user-agent")).toBe(USER_AGENT_DO_APP);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("resposta não-ok estoura (e vira 'fora' lá em cima)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 429 })));
    await expect(FONTES_NOMINATIM.pedir("https://nominatim.openstreetmap.org/x")).rejects.toThrow(/429/);
  });

  it("controle do setup: a suíte não alcança o Nominatim de verdade", async () => {
    await expect(fetch("https://nominatim.openstreetmap.org/search?q=x")).rejects.toThrow(/nunca bate no Nominatim/);
  });

  // 🔴 SONDA do dublê: molde da SONDA 2 do Clerk. Um import depois de
  // `vi.resetModules()` renasce o módulo; com o estado num `const` ele teria
  // OUTRO objeto e a rota veria um estado que o teste não muda.
  it("SONDA do dublê: o módulo dublado vê o estado que o teste muda", async () => {
    vi.resetModules();
    const outra = await import("../nominatim");
    expect(outra.nominatimDeTeste, "o dublê renasceu com OUTRO estado").toBe(nominatimDeTeste);
    nominatimDeTeste.ponto = { cidade: "Cidade Marcador Sonda" };
    expect(await outra.dubleDoNominatim().cidadeDoPonto(-8, -35)).toEqual({ cidade: "Cidade Marcador Sonda" });
    expect(nominatimDeTeste.pontos.at(-1)).toEqual({ lat: -8, lng: -35 });
    await dubleDoNominatim().buscarNoMapa("lugar marcador");
    expect(nominatimDeTeste.buscas.at(-1)).toBe("lugar marcador");
    nominatimDeTeste.ponto = { cidade: "Cidade Marcador Um" };
  });
});
