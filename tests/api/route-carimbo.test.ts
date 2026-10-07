import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base } from "../banco";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);

vi.mock("@/lib/carimbo-estado", () => ({ resolverEstado: vi.fn() }));
const { resolverEstado } = await import("@/lib/carimbo-estado");
const { bancoDeProducao } = await import("../banco");

// A rota busca a ficha no BANCO desde 2026-09-25: sem semear, todo slug daria
// 404 e o teste do 404 passaria pelo motivo errado. Semeado ANTES dos relógios
// falsos do `beforeEach`, de propósito.
await bancoDeProducao();

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

// 🔴 A PÁGINA GUARDADA NO CELULAR CHAMA ESTA ROTA COM O ENDEREÇO DE ANTES
// (Tarefa 11e, E4): a ficha guardada offline de /A pede o carimbo de A depois
// que o dono trocou o endereço. A rota resolve A → B, e SÓ pra lugar no ar.
describe("route /api/carimbo — endereço velho", () => {
  const A = "lugar-marcador-bom-marcador";
  const B = "lugar-marcador-outra-marcadora";

  beforeEach(async () => {
    const { gravarVersao, trocarEndereco } = await import("@/lib/db");
    const { lugarMarcador } = await import("../lugar-marcador");
    const banco = await bancoDeProducao();
    await gravarVersao(banco, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA_S - 10);
    await trocarEndereco(banco, A, B, AGORA_S - 5, await base(banco, A));
  });

  it("o endereço velho devolve a leitura do lugar NOVO", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request(`http://x/api/carimbo?slug=${A}`));
    expect(res.status).toBe(200);
    expect(vi.mocked(resolverEstado).mock.calls[0][0].slug).toBe(B);
  });

  it("o novo ESCONDIDO: 404, como qualquer endereço que não existe", async () => {
    const { gravarVersao, getClient, versaoAtual } = await import("@/lib/db");
    await gravarVersao(getClient(), B, (await versaoAtual(getClient(), B))!.doc, "painel", AGORA_S, true);
    const { GET } = await import("@/app/api/carimbo/route");
    expect((await GET(new Request(`http://x/api/carimbo?slug=${A}`))).status).toBe(404);
    expect(resolverEstado).not.toHaveBeenCalled();
  });
});
