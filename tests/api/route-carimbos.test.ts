import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstados: vi.fn(),
}));

const { GET } = await import("@/app/api/carimbos/route");
const { resolverEstados } = await import("@/lib/carimbo-estado");
const { getFichasComCondicao } = await import("@/lib/ficha");

afterEach(() => { vi.mocked(resolverEstados).mockReset(); });

describe("GET /api/carimbos", () => {
  it("devolve um objeto slug -> trio, com todas as trilhas com condição", async () => {
    const slugs = getFichasComCondicao().map((f) => f.slug);
    vi.mocked(resolverEstados).mockResolvedValue(
      new Map(slugs.map((s) => [s, { estado: "fresco" as const, erro: false, calculadoEm: 42 }])),
    );

    const res = await GET();
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(resolverEstados).toHaveBeenCalledWith(getFichasComCondicao());
    for (const s of slugs) {
      expect(corpo[s]).toEqual({ estado: "fresco", erro: false, calculadoEm: 42 });
    }
  });

  it("nunca é guardada em cache — leitura de chuva guardada é leitura mentirosa", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(new Map());
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
  });
});
