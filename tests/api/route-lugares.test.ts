import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, PRAZO_MS } from "@/app/api/lugares/route";

afterEach(() => { vi.restoreAllMocks(); });

function pedido(q: string) {
  return new Request(`http://x/api/lugares?q=${encodeURIComponent(q)}`);
}

describe("GET /api/lugares", () => {
  it("busca vazia não chama o serviço — devolve lista vazia", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await GET(pedido("  "));
    expect(await res.json()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("devolve os lugares em JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        results: [{ name: "Gravatá", admin1: "Pernambuco", country: "Brasil", latitude: -8.2, longitude: -35.56 }],
      }),
    );
    const res = await GET(pedido("Gravatá"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { nome: "Gravatá", regiao: "Pernambuco", pais: "Brasil", lat: -8.2, lng: -35.56 },
    ]);
  });

  // Resultado de busca guardado é resultado errado depois. `nuncaCachear` já
  // trata /api/* no service worker, mas ele não é o único cache no caminho.
  it("nunca é guardado em cache", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [] }));
    const res = await GET(pedido("Recife"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serviço fora do ar vira 503, não uma lista vazia mentirosa", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("rede"));
    const res = await GET(pedido("Recife"));
    expect(res.status).toBe(503);
  });

  // ——— pré-voo desta task.

  // O BURACO MAIS SÉRIO: o teste acima cobre o `fetch` REJEITANDO (rede caiu),
  // não o serviço RESPONDENDO mal. Sem o `if (!res.ok)`, um 429 (o geocoding
  // da Open-Meteo tem cota) com corpo `{}` atravessa o try inteiro, vira
  // `lerLugares({})` → `[]` → **200 com lista vazia**. A tela então diz "não
  // achei essa cidade" quando a verdade é "estourei a cota" — exatamente a
  // mentira que o comentário do `catch` diz não querer, e a pessoa reescreve o
  // nome dez vezes achando que digitou errado. Apagar o `if` não quebrava nada.
  it("serviço respondendo 429 vira 503 — não 'não achei essa cidade'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({}, { status: 429 }),
    );
    const res = await GET(pedido("Gravatá"));
    expect(res.status).toBe(503);
  });

  it("serviço respondendo 500 com corpo válido também vira 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ results: [] }, { status: 500 }),
    );
    expect((await GET(pedido("Gravatá"))).status).toBe(503);
  });

  // O prazo e o no-store da CHAMADA (o teste de cache acima olha o cabeçalho da
  // RESPOSTA, que é outra coisa). Sem `signal`, um serviço que aceita a conexão
  // e nunca responde pendura a rota até o teto da plataforma; sem
  // `cache: "no-store"`, o fetch do Next pode servir busca velha. Nenhum dos
  // dois tinha teste — asserção sobre os argumentos, que é o que dá pra provar
  // aqui sem inventar relógio.
  it("chama o serviço com prazo e sem cache", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [] }));
    await GET(pedido("Recife"));
    const [url, opcoes] = spy.mock.calls[0];
    expect(String(url)).toContain("geocoding-api.open-meteo.com");
    expect(opcoes?.cache).toBe("no-store");
    expect(opcoes?.signal).toBeInstanceOf(AbortSignal);
    // A instância sozinha não prova prazo: `new AbortController().signal`
    // também é um AbortSignal e nunca aborta. Provar que o signal veio de
    // `AbortSignal.timeout(PRAZO_MS)` — não só "algum AbortSignal" — é o que
    // pega a troca por um controller que nunca desiste.
    expect(timeoutSpy).toHaveBeenCalledWith(PRAZO_MS);
    expect(opcoes?.signal).toBe(timeoutSpy.mock.results[0]?.value);
  });

  // O 503 também não pode ser guardado: um erro em cache é um erro que não
  // sara sozinho quando o serviço volta.
  it("o 503 também sai com no-store", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("rede"));
    const res = await GET(pedido("Recife"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
