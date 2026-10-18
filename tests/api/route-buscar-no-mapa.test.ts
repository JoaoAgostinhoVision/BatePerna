import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { ensureSchema } from "@/lib/db";
import { TETO_DA_BUSCA } from "@/lib/nominatim";
import { CLERK_FORA_AO_ABRIR } from "@/lib/porta-da-pessoa";
import { BUSCA_NAO_SAIU } from "@/app/admin/campos/palavras";
import { nominatimDeTeste } from "../nominatim";
import { PESSOA, sessao } from "../sessao-da-pessoa";

/** AS DUAS PORTAS DA BUSCA NO MAPA (17/10, Task 5): `/api/admin/buscar-no-mapa`
 *  (painel) e `/api/contribuir/buscar-no-mapa` (quem usa). A busca só MOVE o
 *  mapa; estas rotas só leem — nenhuma grava nada. 🔴 O que a prova mede em
 *  todo caso que recusa é que NENHUMA busca saiu (`nominatimDeTeste.buscas`):
 *  a política do Nominatim é pedir o mínimo, e recusar DEPOIS de pedir gastaria
 *  a vez do 1/s à toa. Os achados e as cidades são MARCADORES. */

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-buscar-no-mapa";
const AGORA = 1_758_400_000;
const ACHADOS = [
  { nome: "Lugar Marcador Um, Cidade Marcador Um", lat: -8.1, lng: -35.2 },
  { nome: "Lugar Marcador Dois, Cidade Marcador Dois", lat: -8.3, lng: -35.4 },
];

let c: Client;
let cookieBom: string;
let painel: typeof import("@/app/api/admin/buscar-no-mapa/route");
let dela: typeof import("@/app/api/contribuir/buscar-no-mapa/route");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  nominatimDeTeste.busca = { achados: ACHADOS };
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  painel = await import("@/app/api/admin/buscar-no-mapa/route");
  dela = await import("@/app/api/contribuir/buscar-no-mapa/route");
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// `null` = SEM cookie (parâmetro padrão com `undefined` viraria o cookie bom).
const doPainel = (q: string | null, cookie: string | null = cookieBom) =>
  painel.GET(
    new Request(`http://x/api/admin/buscar-no-mapa${q === null ? "" : `?q=${encodeURIComponent(q)}`}`, {
      headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    }),
  );
const daPessoa = (q: string | null) =>
  dela.GET(new Request(`http://x/api/contribuir/buscar-no-mapa${q === null ? "" : `?q=${encodeURIComponent(q)}`}`));

describe("a porta do painel", () => {
  it("painel desligado: 404, sem chamar a busca", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    painel = await import("@/app/api/admin/buscar-no-mapa/route");
    expect((await doPainel("Lugar Marcador")).status).toBe(404);
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("sem sessão: 401, sem chamar a busca", async () => {
    expect((await doPainel("Lugar Marcador", null)).status).toBe(401);
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("q vazio, ausente ou só espaços: [] sem chamar a busca", async () => {
    for (const q of [null, "", "   "]) {
      const r = await doPainel(q);
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual([]);
    }
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("o teto: q acima de TETO_DA_BUSCA é 400 mudo, sem chamar a busca", async () => {
    const r = await doPainel("a".repeat(TETO_DA_BUSCA + 1));
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("");
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("o teto é inclusivo: q de exatamente TETO_DA_BUSCA letras passa", async () => {
    const q = "a".repeat(TETO_DA_BUSCA);
    expect((await doPainel(q)).status).toBe(200);
    expect(nominatimDeTeste.buscas).toEqual([q]);
  });

  it("os achados, como o serviço deu", async () => {
    const r = await doPainel("Lugar Marcador");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(ACHADOS);
    expect(nominatimDeTeste.buscas).toEqual(["Lugar Marcador"]);
  });

  it("falha do serviço: 503 com BUSCA_NAO_SAIU", async () => {
    nominatimDeTeste.busca = { falha: "fora" };
    const r = await doPainel("Lugar Marcador");
    expect(r.status).toBe(503);
    expect(await r.text()).toBe(BUSCA_NAO_SAIU);
  });
});

describe("a porta dela", () => {
  it("SONDA: a rota vê a sessão que o teste muda", async () => {
    sessao.atual = null;
    expect((await daPessoa("Lugar Marcador")).status, "a rota não viu sessao.atual = null").toBe(401);
    sessao.atual = PESSOA;
    expect((await daPessoa("Lugar Marcador")).status, "a rota não viu sessao.atual = PESSOA").toBe(200);
    sessao.fora = true;
    expect((await daPessoa("Lugar Marcador")).status, "a rota não viu sessao.fora = true").toBe(503);
  });

  it("sem sessão do Clerk: 401, sem chamar a busca", async () => {
    sessao.atual = null;
    expect((await daPessoa("Lugar Marcador")).status).toBe(401);
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("Clerk fora: 503 com a frase de ABRIR, sem chamar a busca", async () => {
    sessao.fora = true;
    const r = await daPessoa("Lugar Marcador");
    expect(r.status).toBe(503);
    expect(await r.text()).toBe(CLERK_FORA_AO_ABRIR);
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("q vazio ou só espaços: [] sem chamar a busca", async () => {
    for (const q of ["", "   "]) {
      const r = await daPessoa(q);
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual([]);
    }
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("o teto: q acima de TETO_DA_BUSCA é 400 mudo, sem chamar a busca", async () => {
    const r = await daPessoa("a".repeat(TETO_DA_BUSCA + 1));
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("");
    expect(nominatimDeTeste.buscas).toEqual([]);
  });

  it("os achados, como o serviço deu", async () => {
    const r = await daPessoa("Lugar Marcador");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(ACHADOS);
    expect(nominatimDeTeste.buscas).toEqual(["Lugar Marcador"]);
  });

  it("falha do serviço: 503 com BUSCA_NAO_SAIU", async () => {
    nominatimDeTeste.busca = { falha: "limite" };
    const r = await daPessoa("Lugar Marcador");
    expect(r.status).toBe(503);
    expect(await r.text()).toBe(BUSCA_NAO_SAIU);
  });
});
