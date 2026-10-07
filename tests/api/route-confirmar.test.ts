import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema, gravarVersao, trocarEndereco, versaoAtual } from "@/lib/db";
import { esquecerMemoria } from "@/lib/ficha-fonte";
import { lugarMarcador } from "../lugar-marcador";
import { semearAcervo, base, clienteQueIntercala } from "../banco";

let client: Client;
/** O cliente que a ROTA recebe, quando não é o do teste (o dublê que intercala). */
let daRota: Client | null = null;
vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => daRota ?? client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  // A rota valida o slug contra o acervo, que vem do BANCO desde 2026-09-25 —
  // o mesmo cliente que ela usa pro placar.
  await semearAcervo(client);
});
afterEach(() => {
  daRota = null;
  client.close();
});

describe("route /api/confirmar", () => {
  it("POST válido registra e retorna placar; GET lê o placar", async () => {
    const { POST, GET } = await import("@/app/api/confirmar/route");
    const post = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "barro" }),
      }),
    );
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ foram: 1, barro: 1 });

    const get = await GET(new Request("http://x/api/confirmar?slug=rampa-do-pepe"));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ foram: 1, barro: 1 });
  });

  it("POST com tipo inválido → 400", async () => {
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "molhado" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET sem slug → 400", async () => {
    const { GET } = await import("@/app/api/confirmar/route");
    const res = await GET(new Request("http://x/api/confirmar"));
    expect(res.status).toBe(400);
  });
});

// 🔴 O ENDEREÇO VELHO, DA FILA OFFLINE (Tarefa 11e, I2 da auditoria): o relato
// guardado em /A sobe depois que o dono trocou o endereço pra /B. A rota GRAVA e
// CONTA no endereço resolvido — uma linha órfã em A seria herdada pelo lugar que
// RETOMAR A (E5): o lugar novo nasceria com o "N foram hoje" de outro.
describe("route /api/confirmar — endereço velho", () => {
  const A = "lugar-marcador-bom-marcador";
  const B = "lugar-marcador-outra-marcadora";
  const AGORA = Math.floor(Date.now() / 1000);

  beforeEach(async () => {
    await gravarVersao(client, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 10);
    await trocarEndereco(client, A, B, AGORA - 5, await base(client, A));
    esquecerMemoria();
  });

  const contar = async (slug: string) =>
    Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?", args: [slug] })).rows[0].n);

  it("POST {slug: A} grava em B, e zero em A", async () => {
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: A, tipo: "seco" }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 0 });
    expect(await contar(B)).toBe(1);
    expect(await contar(A)).toBe(0);
  });

  it("GET ?slug=A devolve a contagem de B", async () => {
    const { POST, GET } = await import("@/app/api/confirmar/route");
    await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: B, tipo: "barro" }) }));
    const res = await GET(new Request(`http://x/api/confirmar?slug=${A}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 1 });
  });

  it("o novo ESCONDIDO: 400, e nada é gravado", async () => {
    await gravarVersao(client, B, (await versaoAtual(client, B))!.doc, "painel", AGORA, true);
    esquecerMemoria();
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify({ slug: A, tipo: "seco" }) }));
    expect(res.status).toBe(400);
    expect(await contar(A) + (await contar(B))).toBe(0);
  });
});

// 🔴 O RELATO CONTA PRO LUGAR, NÃO PRO ENDEREÇO (Tarefa 12b, 12-N6; C1 da
// auditoria). P mora em A; quem foi a P conta "✓ Fui" com a identidade de P.
// P vai pra B e Q passa a morar em A. O relato de P conta pra P, onde P mora na
// hora de gravar — e Q nunca recebe.
//
// A FIXTURE NÃO DEIXA P SOZINHO NEM NA PONTA: o acervo da semente é mais VELHO
// que P (B9 — sem o `WHERE ficha_slug`, o `MIN(id)` do banco inteiro seria um
// lugar da semente, nunca P), e Q nasce DEPOIS de P (P não é a versão mais nova
// do banco). Nomes marcadores.
describe("route /api/confirmar — a identidade do lugar", () => {
  const A = "lugar-marcador-pe-marcador";
  const B = "lugar-marcador-pe-novo-marcador";
  const C = "lugar-marcador-que-marcadora";
  const AGORA = Math.floor(Date.now() / 1000);
  let P: number;
  let Q: number;

  const contar = async (slug: string) =>
    Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?", args: [slug] })).rows[0].n);
  const total = async () => Number((await client.execute("SELECT COUNT(*) AS n FROM confirmacoes")).rows[0].n);
  /** A identidade por SQL CRU, de propósito: se viesse de `identidadeDoLugar`,
   *  um defeito nela produziria a "resposta certa" do próprio teste. */
  const minDe = async (slug: string) =>
    Number((await client.execute({ sql: "SELECT MIN(id) AS m FROM ficha_versoes WHERE ficha_slug = ?", args: [slug] })).rows[0].m);
  const post = async (corpo: unknown) => {
    const { POST } = await import("@/app/api/confirmar/route");
    return POST(new Request("http://x/api/confirmar", { method: "POST", body: JSON.stringify(corpo) }));
  };
  const get = async (busca: string) => {
    const { GET } = await import("@/app/api/confirmar/route");
    return GET(new Request(`http://x/api/confirmar?${busca}`));
  };
  /** P sai de A pra B; Q, que morava em C, retoma A. */
  const trocaERetomada = async () => {
    expect(await trocarEndereco(client, A, B, AGORA - 4, await base(client, A))).toBe(true);
    expect(await trocarEndereco(client, C, A, AGORA - 3, await base(client, C))).toBe(true);
    esquecerMemoria();
  };

  beforeEach(async () => {
    // P com DUAS versões desde já (B3: com uma só, "a mais nova" e "a primeira"
    // seriam a mesma no instante em que a página lê a identidade).
    const docP = JSON.stringify(lugarMarcador(A, "Pe Marcador", "Cidade Marcadora"));
    await gravarVersao(client, A, docP, "painel", AGORA - 20);
    await gravarVersao(client, A, docP, "painel", AGORA - 19);
    await gravarVersao(client, C, JSON.stringify(lugarMarcador(C, "Que Marcadora", "Outra Cidade Marcadora")), "painel", AGORA - 18);
    esquecerMemoria();
    P = await minDe(A);
    Q = await minDe(C);
    // Premissa da fixture: P não é o mais velho do banco nem o mais novo.
    const extremos = (await client.execute("SELECT MIN(id) AS lo, MAX(id) AS hi FROM ficha_versoes")).rows[0];
    expect(Number(extremos.lo)).toBeLessThan(P);
    expect(Number(extremos.hi)).toBeGreaterThan(P);
  });

  // N6-servidor (C2): a porta do servidor sozinha. É também a página velha de
  // P, aberta em /A antes da retomada, mandando online.
  it("N6-servidor: POST {slug: A, lugar: P} depois que Q retomou A conta pra P em B, e Q fica com 0", async () => {
    await trocaERetomada();
    const res = await post({ slug: A, tipo: "barro", lugar: P });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 1 });
    expect(await contar(A), "o relato de P caiu em Q").toBe(0);
    expect(await contar(B)).toBe(1);
  });

  it("endereço velho do MESMO lugar: P foi de A pra B, ninguém retomou A — conta pra P em B", async () => {
    expect(await trocarEndereco(client, A, B, AGORA - 4, await base(client, A))).toBe(true);
    esquecerMemoria();
    const res = await post({ slug: A, tipo: "seco", lugar: P });
    expect(res.status).toBe(200);
    expect(await contar(B)).toBe(1);
    expect(await contar(A)).toBe(0);
  });

  // B3: a identidade é a PRIMEIRA versão, nunca a mais nova — a correção de
  // vírgula do dono não pode recusar o relato de quem foi.
  it("caso normal: o relato de P, o dono EDITA P, e o relato conta pra P", async () => {
    await gravarVersao(client, A, (await versaoAtual(client, A))!.doc, "painel", AGORA - 1);
    esquecerMemoria();
    const res = await post({ slug: A, tipo: "seco", lugar: P });
    expect(res.status).toBe(200);
    expect(await contar(A)).toBe(1);
  });

  it("identidade que não é de lugar nenhum (ou não é a PRIMEIRA versão): 400, nada gravado", async () => {
    const ultimaDeP = Number((await client.execute({ sql: "SELECT MAX(id) AS m FROM ficha_versoes WHERE ficha_slug = ?", args: [A] })).rows[0].m);
    for (const lugar of [999_999_999, ultimaDeP]) {
      const res = await post({ slug: A, tipo: "seco", lugar });
      expect(res.status, `lugar ${lugar}`).toBe(400);
    }
    expect(await total()).toBe(0);
  });

  // M2: o "escondido não conta" mora no mesmo statement.
  it("lugar ESCONDIDO: 400, nada gravado — e o controle no ar grava", async () => {
    await gravarVersao(client, A, (await versaoAtual(client, A))!.doc, "painel", AGORA - 1, true);
    esquecerMemoria();
    expect((await post({ slug: A, tipo: "seco", lugar: P })).status).toBe(400);
    expect(await total()).toBe(0);
    expect((await post({ slug: C, tipo: "seco", lugar: Q })).status).toBe(200);
    expect(await contar(C)).toBe(1);
  });

  // M1/B14: `"17"` não é `17`. Sem a validação, a afinidade INTEGER da coluna
  // `id` converte o texto e o relato GRAVARIA (medido: `v.id = '2'` casa).
  it("lugar fora da forma (texto do id certo, fração, zero, negativo, nulo): 400, nada gravado", async () => {
    for (const lugar of [String(P), P + 0.5, 0, -P, null]) {
      const res = await post({ slug: A, tipo: "seco", lugar });
      expect(res.status, `lugar ${JSON.stringify(lugar)}`).toBe(400);
    }
    expect(await total()).toBe(0);
    // Controle: o número certo grava.
    expect((await post({ slug: A, tipo: "seco", lugar: P })).status).toBe(200);
  });

  // B10: a página velha de P não pinta o placar de Q.
  it("GET ?slug=A&lugar=P depois da retomada: o placar de P, nunca o de Q", async () => {
    await trocaERetomada();
    await post({ slug: A, tipo: "barro", lugar: Q });
    await post({ slug: A, tipo: "barro", lugar: Q });
    await post({ slug: B, tipo: "seco", lugar: P });
    const res = await get(`slug=${A}&lugar=${P}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ foram: 1, barro: 0 });
    // Controle: a mesma busca sem lugar é o placar de quem mora em A (Q).
    expect(await (await get(`slug=${A}`)).json()).toEqual({ foram: 2, barro: 2 });
  });

  it("GET com identidade de ninguém, ou de lugar escondido: 200 null — nunca um placar", async () => {
    let res = await get(`slug=${A}&lugar=999999999`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    await gravarVersao(client, A, (await versaoAtual(client, A))!.doc, "painel", AGORA - 1, true);
    res = await get(`slug=${A}&lugar=${P}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("GET com ?lugar= fora da forma: 400", async () => {
    for (const cru of ["abc", "0", "-1", "1.5", "01", ""]) {
      expect((await get(`slug=${A}&lugar=${cru}`)).status, `lugar=${cru}`).toBe(400);
    }
  });

  // B4: A CONFERÊNCIA MORA NO INSERT. O dublê roda a troca E a retomada logo
  // antes do INSERT: uma rota que lesse "onde P mora" antes e gravasse depois
  // gravaria em A — que já é de Q.
  it("corrida: a troca e a retomada entram logo antes do INSERT — nada em Q, 1 em P no endereço novo", async () => {
    const intercala = clienteQueIntercala(client, /^INSERT INTO confirmacoes/, trocaERetomada);
    daRota = intercala.cliente;
    const res = await post({ slug: A, tipo: "seco", lugar: P });
    expect(intercala.disparos(), "o dublê não disparou — o teste mediria o vazio").toBeGreaterThan(0);
    expect(res.status).toBe(200);
    expect(await contar(A), "o relato de P caiu em Q").toBe(0);
    expect(await contar(B)).toBe(1);
  });

  // O relato LEGADO, aceito como hoje (decisão do João, 06/10, "aceitar como
  // hoje"): o POST sem lugar das abas velhas resolve o endereço e conta pra
  // quem mora nele.
  it("relato legado: POST sem lugar conta pra quem mora no endereço", async () => {
    const res = await post({ slug: A, tipo: "seco" });
    expect(res.status).toBe(200);
    expect(await contar(A)).toBe(1);
  });

  // 🔴 M4 da revisão da 12b: o ramo legado resolvia o endereço pelo `getFicha`,
  // que responde da MEMÓRIA (`ultimaBoa`) quando o banco falha na leitura das
  // fichas — e um lugar publicado depois da memória não está nela. Dava 400 (a
  // recusa definitiva, que tira o relato da fila) por uma falha de passagem.
  describe("o legado resolve o endereço no banco, nunca na memória", () => {
    const D = "lugar-marcador-recente-marcador";
    const D2 = "lugar-marcador-recente-novo-marcador";
    /** O cliente da rota com a leitura das FICHAS (a de `getFicha`) recusada:
     *  é o banco que falha nela, e a rota serve a memória. O resto passa. */
    const fichasRecusadas = () =>
      new Proxy(client, {
        get(alvo, chave) {
          if (chave === "execute") {
            return async (...args: Parameters<Client["execute"]>) => {
              const primeiro = args[0] as unknown;
              const sql = typeof primeiro === "string" ? primeiro : (primeiro as { sql: string }).sql;
              if (/^SELECT \* FROM ficha_versoes WHERE id IN/.test(sql.trimStart())) throw new Error("banco fora (dublê)");
              return alvo.execute(...args);
            };
          }
          const v = Reflect.get(alvo, chave, alvo) as unknown;
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(alvo) : v;
        },
      });

    beforeEach(async () => {
      // A memória nasce ANTES de D existir.
      expect((await get(`slug=${A}`)).status).toBe(200);
      await gravarVersao(client, D, JSON.stringify(lugarMarcador(D, "Recente Marcador", "Cidade Marcadora")), "painel", AGORA - 2);
      daRota = fichasRecusadas();
    });

    it("lugar publicado depois da memória: POST sem lugar conta (não 400)", async () => {
      // A premissa: a memória não tem D — pela porta do GET, que ainda passa por ela.
      expect((await get(`slug=${D}`)).status, "a memória já tinha D: o teste mediria o vazio").toBe(400);
      const res = await post({ slug: D, tipo: "seco" });
      expect(res.status).toBe(200);
      expect(await contar(D)).toBe(1);
    });

    it("e pelo endereço antigo dele: conta onde ele mora agora", async () => {
      daRota = null;
      expect(await trocarEndereco(client, D, D2, AGORA - 1, await base(client, D))).toBe(true);
      daRota = fichasRecusadas();
      expect((await get(`slug=${D}`)).status, "a memória já tinha D2: o teste mediria o vazio").toBe(400);
      const res = await post({ slug: D, tipo: "barro" });
      expect(res.status).toBe(200);
      expect(await contar(D2)).toBe(1);
      expect(await contar(D)).toBe(0);
    });

    it("endereço de ninguém continua 400, nada gravado", async () => {
      const res = await post({ slug: "lugar-marcador-de-ninguem-marcador", tipo: "seco" });
      expect(res.status).toBe(400);
      expect(await total()).toBe(0);
    });
  });
});

// I4 da auditoria da 12b: `insertConfirmacao` grava sem condição nenhuma e
// ficou como helper de FIXTURE. A rota não pode voltar a ela — o guarda é por
// NOME, no fonte, porque nenhum teste de comportamento separa "gravou pela
// identidade" de "gravou no endereço resolvido" quando ninguém retomou nada.
describe("a porta do ✓ Fui grava pela identidade", () => {
  const ler = (arquivo: string) => readFileSync(arquivo, "utf8");
  it("a rota e o registrar não chamam insertConfirmacao; o registrar chama gravarRelatoDoLugar", () => {
    const rota = ler("src/app/api/confirmar/route.ts");
    const registrar = ler("src/lib/confirmar.ts");
    expect(rota).not.toMatch(/insertConfirmacao/);
    expect(registrar).not.toMatch(/insertConfirmacao/);
    expect(registrar).toMatch(/gravarRelatoDoLugar\(/);
    expect(rota).toMatch(/registrarConfirmacao\(/);
  });
});
