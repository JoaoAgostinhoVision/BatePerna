import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);

vi.mock("@/lib/carimbo-estado", () => ({ resolverEstado: vi.fn() }));
const { resolverEstado } = await import("@/lib/carimbo-estado");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA_MS);
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null
  });
});
afterEach(() => { vi.useRealTimers(); vi.mocked(resolverEstado).mockReset(); });

describe("route /api/carimbo", () => {
  it("devolve a leitura inteira", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null });
  });

  it("nunca é guardada — leitura de chuva vinda de cache é leitura mentirosa", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("slug que não existe → 404, e não inventa leitura", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=morro-inventado"));
    expect(res.status).toBe(404);
    expect(resolverEstado).not.toHaveBeenCalled();
  });

  it("sem slug → 404", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    expect((await GET(new Request("http://x/api/carimbo"))).status).toBe(404);
  });

  it("falha na leitura NÃO vira 5xx — 'não consegui ler' é resposta do domínio", async () => {
    // O cliente precisa distinguir 'não consegui ler a chuva' de 'a requisição
    // nem chegou'. As duas coisas viram telas diferentes.
    vi.mocked(resolverEstado).mockResolvedValue({
      estado: "frio", erro: true, calculadoEm: AGORA_S, aviso: null
    });
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erro: true, estado: "frio" });
  });
});
