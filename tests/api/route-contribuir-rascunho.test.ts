import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rascunhoDeQualquerUm } from "@/lib/db";
import { contribuidorPorId, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { SEM_NAO_SEI } from "@/lib/campos-da-pessoa";
import { BLOQUEADA, CLERK_FORA, NOME_JA_EM_USO, RASCUNHO_DELA_JA_EXISTE, RASCUNHO_DELA_SUMIU } from "@/lib/porta-da-pessoa";
import { CIDADE_SEM_LETRA, CIDADE_VAZIA, NOME_SEM_LETRA, NOME_VAZIO } from "@/lib/rascunho";
import { clienteQueIntercala, semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
let c: Client;
/** O cliente que a ROTA vê — `c`, ou um que intercala (o caso da corrida). */
let cli: Client;
let rota: typeof import("@/app/api/contribuir/rascunho/route");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  rota = await import("@/app/api/contribuir/rascunho/route");
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const pedido = (metodo: string, corpo?: unknown, busca = "") =>
  new Request(`http://x/api/contribuir/rascunho${busca}`, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
const SLUG = "pedra-mandada-cidade-teste";
const docDe = async (slug = SLUG) => JSON.parse((await rascunhoDeQualquerUm(c, slug))!.doc);
async function comecar(): Promise<void> {
  const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
  expect(res.status, await res.clone().text()).toBe(201);
}

describe("a porta: sessão, Clerk, bloqueio", () => {
  // 🔴 A SONDA DO DUBLÊ (C2 da pré-auditoria). Roda ANTES dos outros casos da
  // porta: se a rota não enxerga a sessão que o teste muda, todo 401/503/404
  // abaixo mede o dublê, não a rota. Ela muda a sessão nos TRÊS sentidos e
  // exige que a rota veja cada um (o `portaDaPessoa` sem o `try` a deixa
  // vermelha). ⚠️ Ela NÃO trava o estado do dublê num `const` de módulo:
  // medido na Task 10, a fábrica do `vi.mock` roda uma vez por arquivo e o
  // `vi.resetModules()` do `beforeEach` não a refaz, então a rota e o teste
  // continuam com a mesma instância e esta sonda passa. Quem trava é a SONDA 2.
  it("SONDA: a rota vê a sessão que o teste muda, nos três sentidos", async () => {
    sessao.atual = null;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.atual = null").toBe(401);
    sessao.atual = PESSOA;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.atual = PESSOA").toBe(200);
    sessao.fora = true;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.fora = true").toBe(503);
  });

  // O lugar onde o dublê RENASCE: um import direto depois do
  // `vi.resetModules()`. Com o estado num `const` do módulo, esta instância
  // nova teria outro `sessao` (medido: vermelha); com o `globalThis`, é o mesmo.
  it("SONDA 2: o dublê reimportado depois de `vi.resetModules()` é o MESMO objeto", async () => {
    vi.resetModules();
    const outraInstancia = await import("../sessao-da-pessoa");
    expect(outraInstancia.sessao, "o módulo do dublê renasceu com OUTRO estado").toBe(sessao);
  });

  it("sem sessão: 401, e nada nasce", async () => {
    sessao.atual = null;
    expect((await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }))).status).toBe(401);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("Clerk fora: 503 com a frase, e nada nasce", async () => {
    sessao.fora = true;
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("bloqueada: 403 com a frase, e nada nasce", async () => {
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, AGORA] });
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("toda porta aberta registra quem contribui, com nome e e-mail (só pro painel)", async () => {
    await comecar();
    expect(await contribuidorPorId(c, PESSOA.id)).toMatchObject({ nome: PESSOA.nome, email: PESSOA.email });
  });
});

describe("POST — começar", () => {
  it("201, o slug do nome e da cidade, e o rascunho nasce DELA e sem nada a mais", async () => {
    await comecar();
    expect(await docDe()).toEqual({ slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    const linha = await c.execute({ sql: "SELECT contribuidor FROM ficha_rascunhos WHERE slug = ?", args: [SLUG] });
    expect(linha.rows[0].contribuidor).toBe(PESSOA.id);
  });

  // Review Focus 3: o par de um lugar do João. As fichas dele nasceram sem
  // cidade, então nome igual É colisão (o gêmeo sem cidade).
  // 🔴 I3 da pré-auditoria: a frase é a DELA — nunca "responda primeiro a cidade
  // dele, pela lista do painel" (ela não tem painel) —, e não nomeia ninguém.
  it("o par de um lugar do João: 409 com a frase DELA, e nada nasce", async () => {
    const res = await rota.POST(pedido("POST", { nome: "Rampa do Pepê", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(NOME_JA_EM_USO);
    expect(frase).not.toMatch(/painel/i);
    expect((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n).toBe(0);
  });

  // I3: o rascunho de OUTRA pessoa não é revelado — nem o nome, nem a cidade.
  it("o par de um rascunho de OUTRA pessoa: 409 com a frase dela, sem o nome dele, e ele fica", async () => {
    const doc = JSON.stringify({ slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    await criarRascunhoDaPessoa(c, SLUG, doc, AGORA, OUTRA.id);
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toMatchObject({ doc, contribuidor: OUTRA.id });
  });

  // I3: o ENDEREÇO ocupado (nome diferente, mesmo endereço — a fronteira entre
  // o nome e a cidade que anda) também responde a frase dela, nunca a do painel
  // (`enderecoDeRascunho` mandaria "continuar por ele na lista do painel").
  it("o endereço de um rascunho de OUTRA pessoa, de nome diferente: 409 com a frase dela", async () => {
    const outro = "lugar-marcador-cidade-marcador";
    await criarRascunhoDaPessoa(c, outro, JSON.stringify({ slug: outro, modos: [], cidade: "Cidade Marcador", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), AGORA, OUTRA.id);
    const res = await rota.POST(pedido("POST", { nome: "Lugar Marcador Cidade", cidade: "Marcador" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect((await rascunhoDeQualquerUm(c, outro))?.contribuidor).toBe(OUTRA.id);
  });

  // Ruling de produto da pré-auditoria: endereço antigo de outro lugar não é dela.
  it("um endereço antigo de um lugar do João: 409 com a frase dela, nada nasce, e o link velho continua", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it.each([[{ nome: "", cidade: "C" }], [{ nome: "N", cidade: " " }], [{ nome: "N" }], [{ nome: "N", cidade: "C", voz: "x" }]])(
    "corpo %j: 400",
    async (corpo) => expect((await rota.POST(pedido("POST", corpo))).status).toBe(400),
  );
});

describe("PUT — responder", () => {
  beforeEach(comecar);

  it("um campo dela grava", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }))).status).toBe(200);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // Review Focus 1.
  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum"])(
    "campo fora da lista dela (`%s`): 400, e o rascunho não muda",
    async (campo) => {
      const antes = await docDe();
      const valor = campo === "condicao.regra.limiar_mm" ? 1 : campo === "carroComum" ? true : campo === "condicao.severidade" ? "cuidado" : campo === "piso" ? "barro" : "texto";
      expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo, valor }))).status).toBe(400);
      expect(await docDe()).toEqual(antes);
    },
  );

  it("o ponto grava o ponto 0 E a coordenada da chuva", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, ponto: 0, lat: -8.31, lng: -35.97 }))).status).toBe(200);
    const d = await docDe();
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.31, lng: -35.97 });
    expect(d.condicao.coords).toEqual({ lat: -8.31, lng: -35.97 });
  });

  it("ponto que não é o 0: 400 (trajeto de mais de um ponto está fora)", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, ponto: 1, lat: -8.31, lng: -35.97 }))).status).toBe(400);
  });

  it("'não sei' em opcional dela tira a chave; em obrigatório dela, 400", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "avisos", valor: "Leve água." }));
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "avisos", naoSei: true }))).status).toBe(200);
    expect("avisos" in (await docDe())).toBe(false);
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    const recusa = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", naoSei: true }));
    expect(recusa.status).toBe(400);
    expect(await recusa.text()).toBe(SEM_NAO_SEI);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  it("trocar o nome muda o endereço do rascunho, e a resposta diz o novo", async () => {
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(await res.json()).toEqual({ slug: "pedra-nova-cidade-teste" });
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
    expect((await docDe("pedra-nova-cidade-teste")).slug).toBe("pedra-nova-cidade-teste");
  });

  // I3 da pré-auditoria: renomear pro nome de um lugar do João esbarra no par
  // (o gêmeo sem cidade) — e a frase é a DELA.
  it("renomear pro nome de um lugar do João: 409 com a frase dela, e o rascunho não muda", async () => {
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await docDe()).toEqual(antes);
  });

  it("rascunho de OUTRA pessoa: 404, e ele não muda", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    expect((await rota.PUT(pedido("PUT", { slug: "da-outra-cidade", campo: "promessa", valor: "x" }))).status).toBe(404);
    expect(await docDe("da-outra-cidade")).toEqual({ slug: "da-outra-cidade" });
  });

  it("o rascunho que sumiu entre a leitura e a gravação: 409 com a frase DELA", async () => {
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      await c.execute({ sql: "DELETE FROM ficha_rascunhos WHERE slug = ?", args: [SLUG] });
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_SUMIU);
  });

  // Review Focus 4: a sessão venceu no meio — o rascunho fica.
  it("401 não toca o rascunho", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    sessao.atual = null;
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Outra." }))).status).toBe(401);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // Review Focus 2 da Task 15: o bloqueio PELO ATO DO JOÃO (`bloquearContribuidor`,
  // e não um UPDATE à mão como nos casos do fim do arquivo). A porta já
  // registrou a pessoa (linha com `bloqueado = 0`): sem o `DO UPDATE SET
  // bloqueado = 1` do bloquear, ela continuava livre e a gravação passava.
  it("bloqueada no meio do formulário: 403 com a frase, e o rascunho não muda", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      const { bloquearContribuidor } = await import("@/lib/db-contribuidor");
      await bloquearContribuidor(c, PESSOA.id, AGORA);
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Outra." }));
    expect(corrida.disparos()).toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });
});

describe("GET e DELETE", () => {
  beforeEach(comecar);

  it("GET lista só os rascunhos dela", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    const r = await (await rota.GET(pedido("GET"))).json();
    expect(r.rascunhos.map((x: { slug: string }) => x.slug)).toEqual([SLUG]);
  });

  it("DELETE do dela: 200 e some; do de outra: 404 e fica", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    expect((await rota.DELETE(pedido("DELETE", { slug: "da-outra-cidade" }))).status).toBe(404);
    expect(await rascunhoDeQualquerUm(c, "da-outra-cidade")).not.toBeNull();
    expect((await rota.DELETE(pedido("DELETE", { slug: SLUG }))).status).toBe(200);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });
});

// 🔴 A PORTA DELA APARA E RECUSA (revisões anteriores, fechado na Task 10). A
// página pública só confere se há TEXTO (`if (ficha.avisos)`): um campo só de
// espaços passaria lá como resposta e sairia em branco na tela. E a cidade:
// o ramo `semCidade` de `colisaoDoPar` para rascunho de quem usa só é
// inalcançável se NENHUMA porta dela deixar o rascunho sem cidade com letra —
// estes casos são essa prova, porta a porta (POST, PUT de valor, "não sei").
describe("o texto dela entra aparado, e cidade vazia não chega ao rascunho dela", () => {
  const total = async () => Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n);

  it("POST: nome e cidade com espaço nas pontas nascem aparados", async () => {
    const res = await rota.POST(pedido("POST", { nome: "  Pedra Mandada ", cidade: "\tCidade Teste  " }));
    expect(res.status).toBe(201);
    expect(await docDe()).toEqual({ slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
  });

  // A FRASE de cada recusa, e não só o 400: as recusas do POST são portas em
  // série (vazia → sem letra), e só a frase diz qual delas recusou.
  it.each([
    [{ nome: "   ", cidade: "Cidade Teste" }, NOME_VAZIO],
    [{ nome: "Pedra Mandada", cidade: "" }, CIDADE_VAZIA],
    [{ nome: "Pedra Mandada", cidade: "   " }, CIDADE_VAZIA],
    [{ nome: "Pedra Mandada", cidade: "--" }, CIDADE_SEM_LETRA],
    [{ nome: "--", cidade: "Cidade Teste" }, NOME_SEM_LETRA],
  ])("POST %j: 400 com a frase, e nada nasce", async (corpo, frase) => {
    const res = await rota.POST(pedido("POST", corpo));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(frase);
    expect(await total()).toBe(0);
  });

  describe("PUT", () => {
    beforeEach(comecar);

    it("a resposta com espaço nas pontas entra aparada", async () => {
      expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "  Uma pedra.\n" }))).status).toBe(200);
      expect((await docDe()).promessa).toBe("Uma pedra.");
    });

    it("o nome com espaço nas pontas: aparado no documento e no endereço", async () => {
      const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "  Pedra Nova  " }));
      expect(await res.json()).toEqual({ slug: "pedra-nova-cidade-teste" });
      expect((await docDe("pedra-nova-cidade-teste")).trajeto.waypoints[0].nome).toBe("Pedra Nova");
    });

    it.each(["promessa", "acesso", "avisos", "custo.valor", "trajeto.waypoints.0.nome", "cidade"].flatMap((campo) =>
      ["", "   ", " \t\n "].map((valor) => [campo, valor] as const),
    ))("`%s` = %j: 400, e o rascunho não muda", async (campo, valor) => {
      const antes = await docDe();
      expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo, valor }))).status).toBe(400);
      expect(await docDe()).toEqual(antes);
    });

    it("cidade vazia, só de espaços, sem letra, ou 'não sei': recusada, e a cidade dela continua", async () => {
      for (const [corpo, frase] of [
        [{ campo: "cidade", valor: "" }, CIDADE_VAZIA],
        [{ campo: "cidade", valor: "   " }, CIDADE_VAZIA],
        [{ campo: "cidade", valor: "--" }, CIDADE_SEM_LETRA],
      ] as const) {
        const res = await rota.PUT(pedido("PUT", { slug: SLUG, ...corpo }));
        expect(res.status, JSON.stringify(corpo)).toBe(400);
        expect(await res.text(), JSON.stringify(corpo)).toBe(frase);
      }
      const naoSei = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "cidade", naoSei: true }));
      expect(naoSei.status).toBe(400);
      expect(await naoSei.text()).toBe(SEM_NAO_SEI);
      expect((await docDe()).cidade).toBe("Cidade Teste");
    });
  });
});

// O par que a rota dela confere é o DADO (`colisaoDaMudanca`), e ele vale
// também contra o rascunho de OUTRA pessoa — pelos dois lados do par.
describe("PUT — o par contra o rascunho de outra pessoa", () => {
  beforeEach(async () => {
    await comecar();
    const outro = "pedra-dela-outra-cidade";
    await criarRascunhoDaPessoa(c, outro, JSON.stringify({ slug: outro, modos: [], cidade: "Outra Cidade", trajeto: { waypoints: [{ nome: "Pedra Dela" }] } }), AGORA, OUTRA.id);
  });

  it("renomear pro nome do outro, estando na cidade dele: 409 com a frase dela, e o nome fica", async () => {
    const antes = await docDe();
    // Primeiro a cidade dela vira a dele — o par (Pedra Mandada, Outra Cidade) é livre.
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "cidade", valor: "Outra Cidade" }))).status).toBe(200);
    const res = await rota.PUT(pedido("PUT", { slug: "pedra-mandada-outra-cidade", campo: "trajeto.waypoints.0.nome", valor: "Pedra Dela" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect((await docDe("pedra-mandada-outra-cidade")).trajeto).toEqual(antes.trajeto);
  });

  it("mudar a cidade pro par do outro: 409 com a frase dela, e a cidade fica", async () => {
    // Primeiro o nome dela vira o dele — o par (Pedra Dela, Cidade Teste) é livre.
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Pedra Dela" }))).status).toBe(200);
    const res = await rota.PUT(pedido("PUT", { slug: "pedra-dela-cidade-teste", campo: "cidade", valor: "Outra Cidade" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect((await docDe("pedra-dela-cidade-teste")).cidade).toBe("Cidade Teste");
  });
});

// 🔴 O BLOQUEIO NO MEIO (onda de fix da Task 10): a porta deixou passar, e o
// João bloqueou entre ela e a gravação. Quem derruba é o `LIVRE` no statement;
// a resposta tem de ser a de BLOQUEADA — não "sumiu", não "em uso", não 404.
describe("o bloqueio que chega entre a porta e a gravação", () => {
  beforeEach(comecar);
  const bloquear = async () => {
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
  };

  it("PUT que regrava: 403 com a frase de bloqueada, e o rascunho não muda", async () => {
    const antes = await docDe();
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await docDe()).toEqual(antes);
  });

  it("PUT que muda o endereço (renomear): 403 com a frase de bloqueada, e o rascunho fica onde estava", async () => {
    const antes = await docDe();
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await docDe()).toEqual(antes);
    expect(await rascunhoDeQualquerUm(c, "pedra-nova-cidade-teste")).toBeNull();
  });

  it("DELETE: 403 com a frase de bloqueada, e o rascunho fica", async () => {
    const corrida = clienteQueIntercala(c, /^DELETE FROM ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.DELETE(pedido("DELETE", { slug: SLUG }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await rascunhoDeQualquerUm(c, SLUG)).not.toBeNull();
  });

  // O POST (Task 15, Step 5): o único ponto em que a rota ainda caía em "em
  // uso" quando quem recusou foi o bloqueio. O `beforeEach` já começou um
  // rascunho, então o pedido aqui é de OUTRO lugar, num endereço livre.
  it("POST que começa: 403 com a frase de bloqueada, não a de em uso, e nada nasce", async () => {
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.POST(pedido("POST", { nome: "Pedra Segunda", cidade: "Cidade Teste" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await rascunhoDeQualquerUm(c, "pedra-segunda-cidade-teste")).toBeNull();
  });

  it("DELETE de quem já está bloqueada: 403 na porta, e o rascunho fica", async () => {
    await bloquear();
    const res = await rota.DELETE(pedido("DELETE", { slug: SLUG }));
    expect(res.status).toBe(403);
    expect(await rascunhoDeQualquerUm(c, SLUG)).not.toBeNull();
  });
});

// 🔴 I1 DA REVISÃO FINAL: o que colide é o rascunho DELA mesma. `NOME_JA_EM_USO`
// ("já é de outro lugar") seria falsa: é dela, está na lista dela. A frase
// aponta pra lista. Um caso por ramo da rota: a colisão pelo PAR (POST e PUT) e
// a recusa do BANCO pelo ENDEREÇO (par diferente, mesmo endereço — POST e PUT
// que muda o endereço). O rascunho de OUTRA pessoa continua `NOME_JA_EM_USO`
// (casos acima).
describe("o que colide é o rascunho DELA mesma", () => {
  const total = async () => Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n);
  const MARCADOR = "lugar-marcador-cidade-marcador";
  const comecarMarcador = async () => {
    const r = await rota.POST(pedido("POST", { nome: "Lugar Marcador", cidade: "Cidade Marcador" }));
    expect(r.status, await r.clone().text()).toBe(201);
  };

  it("POST com o par de um rascunho dela: 409 com a frase que aponta a lista dela, e nada nasce", async () => {
    await comecar();
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_JA_EXISTE);
    expect(await total()).toBe(1);
  });

  it("POST com o ENDEREÇO de um rascunho dela, de par diferente (a recusa do banco): a mesma frase", async () => {
    await comecarMarcador();
    const res = await rota.POST(pedido("POST", { nome: "Lugar Marcador Cidade", cidade: "Marcador" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_JA_EXISTE);
    expect(await total()).toBe(1);
  });

  it("PUT que renomeia pro par de outro rascunho dela: a mesma frase, e o rascunho não muda", async () => {
    await comecar();
    expect((await rota.POST(pedido("POST", { nome: "Pedra Segunda", cidade: "Cidade Teste" }))).status).toBe(201);
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Pedra Segunda" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_JA_EXISTE);
    expect(await docDe()).toEqual(antes);
  });

  it("PUT que muda pro ENDEREÇO de outro rascunho dela, de par diferente (a recusa do banco): a mesma frase", async () => {
    await comecarMarcador();
    const x = await rota.POST(pedido("POST", { nome: "Pedra X", cidade: "Marcador" }));
    expect(x.status).toBe(201);
    const res = await rota.PUT(pedido("PUT", { slug: "pedra-x-marcador", campo: "trajeto.waypoints.0.nome", valor: "Lugar Marcador Cidade" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_JA_EXISTE);
    expect((await docDe("pedra-x-marcador")).trajeto.waypoints[0].nome).toBe("Pedra X");
  });

  it("a frase dela não fala de outro lugar nem do painel, e aponta a lista dela", () => {
    expect(RASCUNHO_DELA_JA_EXISTE).not.toMatch(/outro lugar|painel/i);
    expect(RASCUNHO_DELA_JA_EXISTE).toMatch(/sua lista/);
  });
});

// Onda de fix da Task 10: a frase de toda colisão dela não diz "no ar" (falso
// pro lugar escondido) nem que o lugar "logo estará" no app (falso pro
// endereço antigo e pro rascunho que nunca sai), e não nomeia ninguém.
it("NOME_JA_EM_USO não promete onde o outro lugar está", () => {
  expect(NOME_JA_EM_USO).not.toMatch(/no ar|logo estar|mandando|painel/i);
});

// I1 da revisão final: o rascunho de OUTRA pessoa (ou do João) não é lugar
// "no BatePerna" — a frase diz a categoria dele também, sem dizer de quem.
it("NOME_JA_EM_USO é verdade também quando o que ocupa é um rascunho de outro", () => {
  expect(NOME_JA_EM_USO).toMatch(/alguém começou e ainda não publicou/);
});
