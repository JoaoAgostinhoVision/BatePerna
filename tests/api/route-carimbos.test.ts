import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstados: vi.fn(),
}));

const { GET } = await import("@/app/api/carimbos/route");
const { resolverEstados } = await import("@/lib/carimbo-estado");
const { getFichasComCondicao } = await import("@/lib/ficha");
const { bancoDeProducao, gravarEdicao } = await import("../banco");

// A rota lê o acervo do BANCO desde 2026-09-25 — o `getClient` de produção
// aponta pro `:memory:` semeado aqui.
const banco = await bancoDeProducao();

afterEach(() => { vi.mocked(resolverEstados).mockReset(); });

describe("GET /api/carimbos", () => {
  it("devolve um objeto slug -> leitura, com todas as trilhas com condição", async () => {
    const slugs = (await getFichasComCondicao()).map((f) => f.slug);
    vi.mocked(resolverEstados).mockResolvedValue(
      new Map(slugs.map((s) => [s, { estado: "fresco" as const, erro: false, calculadoEm: 42, aviso: null }])),
    );

    const res = await GET();
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(resolverEstados).toHaveBeenCalledWith(await getFichasComCondicao());
    for (const s of slugs) {
      expect(corpo[s]).toEqual({ estado: "fresco", erro: false, calculadoEm: 42, aviso: null });
    }
  });

  it("nunca é guardada em cache — leitura de chuva guardada é leitura mentirosa", async () => {
    vi.mocked(resolverEstados).mockResolvedValue(new Map());
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
  });

  // 🔴 A PROVA DE QUE A ROTA LÊ O BANCO, e não o JSON: o painel grava uma
  // versão nova e a requisição seguinte já entrega a ficha nova pro
  // `resolverEstados`. Sem ela, os dois testes acima passariam com a rota
  // lendo o disco — eles comparam a rota com o acervo, que é o mesmo conteúdo
  // nos dois casos.
  it("depois de uma edição, a rota manda a ficha NOVA pro carimbo", async () => {
    const antes = (await getFichasComCondicao()).find((f) => f.slug === "rampa-do-pepe")!;
    expect(antes, "a Rampa sumiu do acervo semeado").toBeTruthy();
    try {
      await gravarEdicao(banco, antes, { promessa: "PROMESSA REESCRITA PELO PAINEL" });
      vi.mocked(resolverEstados).mockResolvedValue(new Map());
      await GET();
      const entregues = vi.mocked(resolverEstados).mock.calls[0][0];
      expect(
        entregues.find((f) => f.slug === "rampa-do-pepe")?.promessa,
        "a rota entregou a promessa do JSON — o banco não é a fonte",
      ).toBe("PROMESSA REESCRITA PELO PAINEL");
    } finally {
      // Desfazer é gravar a antiga de novo: a tabela é append-only.
      await gravarEdicao(banco, antes, {});
    }
  });
});
