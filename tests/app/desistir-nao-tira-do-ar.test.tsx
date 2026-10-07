import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";

/** 🔴 DESISTIR NUNCA TIRA LUGAR DO AR (Tarefa 15, 07/10).
 *
 *  O botão "Desistir deste lugar" chama `DELETE /api/admin/rascunho` com um
 *  slug, e um lugar NO AR pode estar nesse mesmo slug — o rascunho que acabou
 *  de ser publicado noutra aba, ou um rascunho torto que sobrou no endereço de
 *  um lugar. A rota só apaga `ficha_rascunhos`, e é isso que se prova aqui PELA
 *  PÁGINA PÚBLICA, não só pela tabela: o caso irmão em
 *  `tests/api/route-admin-rascunho.test.ts` ("DELETE tira o rascunho, e nunca
 *  toca em ficha_versoes") mede o histórico de um lugar SEM rascunho; este põe
 *  os DOIS no mesmo slug e abre o link que circula no WhatsApp.
 *
 *  Molde de `tests/app/ficha-escondida.test.tsx`: o banco de produção em
 *  `:memory:` (sem dublê de `getClient`), a página `[slug]` de verdade, e a
 *  ROTA de verdade com sessão de verdade. */
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));

// `resolverEstado` sai do caminho: ele lê clima e aviso, e nada disto é sobre
// isso. Mesmo molde de `tests/app/ficha-escondida.test.tsx`.
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-desistir-no-ar";

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getFicha } = await import("@/lib/ficha");
const { historico, lerRascunho, versaoAtual } = await import("@/lib/db");
const Ficha = (await import("@/app/[slug]/page")).default;
const rota = await import("@/app/api/admin/rascunho/route");
const { bancoDeProducao, salvarRascunho, AGORA_SEMENTE } = await import("../banco");

const banco = await bancoDeProducao();
const SLUG = "rampa-do-pepe";

const abrir = () => Ficha({ params: Promise.resolve({ slug: SLUG }), searchParams: Promise.resolve({}) });

beforeEach(() => {
  notFoundFalso.mockClear();
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
    erro: false,
    calculadoEm: AGORA_SEMENTE,
    aviso: null,
  });
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
});

afterEach(() => {
  vi.mocked(resolverEstado).mockReset();
  vi.unstubAllEnvs();
});

function desistir(slug: string): Promise<Response> {
  const cookie = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  return rota.DELETE(
    new Request("http://x/api/admin/rascunho", {
      method: "DELETE",
      headers: { cookie: `${COOKIE_ADMIN}=${cookie}` },
      body: JSON.stringify({ slug }),
    }),
  );
}

describe("desistir do rascunho num slug que tem lugar no ar", () => {
  it("o rascunho some; a versão do lugar fica, e a página pública continua abrindo", async () => {
    // A premissa, medida: o lugar está no ar e a página abre.
    await expect(abrir()).resolves.toBeTruthy();
    const antes = await versaoAtual(banco, SLUG);
    expect(antes, "a premissa: o lugar está no ar").not.toBeNull();
    const versoes = (await historico(banco, SLUG)).length;
    // E um rascunho NO MESMO slug — sem ele, o DELETE não apagaria nada e o
    // caso passaria por vácuo.
    await salvarRascunho(banco, SLUG, JSON.stringify({ slug: SLUG, modos: [] }), AGORA_SEMENTE + 5);
    expect(await lerRascunho(banco, SLUG), "a premissa: o rascunho está no slug do lugar").not.toBeNull();

    expect((await desistir(SLUG)).status).toBe(200);

    expect(await lerRascunho(banco, SLUG), "o DELETE não apagou o rascunho").toBeNull();
    expect(await versaoAtual(banco, SLUG), "a versão do lugar no ar mudou").toEqual(antes);
    expect(await historico(banco, SLUG), "o histórico do lugar perdeu versão").toHaveLength(versoes);
    expect(await getFicha(SLUG), "o getter público não acha mais o lugar").not.toBeNull();
    await expect(abrir()).resolves.toBeTruthy();
    expect(notFoundFalso, "a página pública deu 404 depois de desistir").not.toHaveBeenCalled();
  });
});
