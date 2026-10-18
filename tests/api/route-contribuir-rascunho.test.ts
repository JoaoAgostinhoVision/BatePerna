import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gravarVersao } from "@/lib/db";
import { contribuidorPorId, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { SEM_NAO_SEI, TEXTO_LONGO_DEMAIS } from "@/lib/campos-da-pessoa";
import { BLOQUEADA, CLERK_FORA, CLERK_FORA_AO_ABRIR, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU } from "@/lib/porta-da-pessoa";
import { CIDADE_DO_PONTO_NAO_SAIU, NOME_SEM_LETRA, NOME_VAZIO, ehChaveDeRascunho } from "@/lib/rascunho";
import { clienteQueIntercala, rascunhoNoBanco, semearAcervo } from "../banco";
import { nominatimDeTeste } from "../nominatim";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));
// 🔴 A suíte nunca bate no Nominatim (spec §7): o ponto 0 pergunta a cidade ao
// dublê (estado em `globalThis`, como o do Clerk).
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

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
  nominatimDeTeste.ponto = { cidade: "Cidade Teste" };
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  vi.resetModules();
  rota = await import("@/app/api/contribuir/rascunho/route");
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const pedido = (metodo: string, corpo?: unknown, busca = "") =>
  new Request(`http://x/api/contribuir/rascunho${busca}`, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
/** O ENDEREÇO que o par do `comecar` dá — o `slug` de DENTRO do documento. */
const SLUG = "pedra-mandada-cidade-teste";
/** A CHAVE do rascunho que o `comecar` fez nascer (Task 17: nunca o endereço). */
let CHAVE: string;
const docDe = async (chave = CHAVE) => JSON.parse((await rascunhoNoBanco(c, chave))!.doc);
const total = async () => Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n);
/** O ponto que ela marca no mapa, e o PUT dele com o Nominatim (dublado)
 *  dizendo que ele cai em `cidade` — é por ele que a cidade chega (17/10). */
const PONTO = { ponto: 0, lat: -8.31, lng: -35.97 } as const;
function marcarPonto(slug: string, cidade = "Cidade Teste"): Promise<Response> {
  nominatimDeTeste.ponto = { cidade };
  return rota.PUT(pedido("PUT", { slug, ...PONTO }));
}
/** 17/10: o lugar nasce só do nome (`POST {nome}`), e a cidade sai do PONTO.
 *  Os casos que partem de um rascunho "com cidade" começam por aqui, pelo
 *  caminho de verdade. */
async function comecar(): Promise<void> {
  const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada" }));
  expect(res.status, await res.clone().text()).toBe(201);
  CHAVE = ((await res.json()) as { slug: string }).slug;
  const cid = await marcarPonto(CHAVE);
  expect(cid.status, await cid.clone().text()).toBe(200);
}
/** Um rascunho de OUTRA pessoa (ou dela), direto no banco; devolve a chave. */
async function deOutra(endereco: string, doc: unknown, dono = OUTRA.id): Promise<string> {
  const chave = await criarRascunhoDaPessoa(c, endereco, JSON.stringify(doc), AGORA, dono);
  expect(chave, "a premissa: o rascunho nasceu").not.toBeNull();
  return chave!;
}

/** Ela responde as obrigatórias que faltam e toca em publicar, pela rota de
 *  verdade dela — é lá que o par e o endereço se conferem desde 17/10. */
async function publicarDela(chave: string): Promise<Response> {
  for (const corpo of [
    { campo: "promessa", valor: "Uma promessa marcadora, só deste rascunho." },
    { campo: "acesso", valor: "De carro." },
    { campo: "custo.tag", valor: "gratis" },
  ]) {
    const r = await rota.PUT(pedido("PUT", { slug: chave, ...corpo }));
    expect(r.status, await r.clone().text()).toBe(200);
  }
  const publicar = await import("@/app/api/contribuir/publicar/route");
  const atualizadoEm = (await rascunhoNoBanco(c, chave))!.atualizado_em;
  return publicar.POST(new Request("http://x/api/contribuir/publicar", { method: "POST", body: JSON.stringify({ slug: chave, atualizadoEm }) }));
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
    expect((await rota.POST(pedido("POST", { nome: "Pedra Mandada" }))).status).toBe(401);
    expect(await total()).toBe(0);
  });

  it("Clerk fora: 503 com a frase, e nada nasce", async () => {
    sessao.fora = true;
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA);
    expect(await total()).toBe(0);
  });

  // Onda de copy de 13/10: o GET só LÊ — ninguém tentou gravar, e "Nada foi
  // gravado" sobrava. O 503 dele diz a irmã de abrir; os que gravam (POST,
  // PUT, DELETE) seguem com `CLERK_FORA`.
  it("Clerk fora no GET: 503 com a frase de ABRIR, não a de gravar", async () => {
    sessao.fora = true;
    const res = await rota.GET(pedido("GET"));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA_AO_ABRIR);
    const apagar = await rota.DELETE(pedido("DELETE", { slug: "qualquer" }));
    expect(apagar.status).toBe(503);
    expect(await apagar.text()).toBe(CLERK_FORA);
  });

  // 🔴 I1 DA REVISÃO DA TASK 18: a outra direção da irmã. O caso de cima prova
  // que o GET (que só abre) não diz a de gravar; este prova que NENHUM handler
  // que grava diz a de abrir ("tente de novo daqui a pouco" sem "Nada foi
  // gravado" mentiria por omissão a quem acabou de escrever). Antes dele, o
  // `"gravar"` → `"abrir"` no PUT sobrevivia à suíte inteira (medido pelo
  // revisor). Um corpo que a rota aceitaria, pra que só a porta responda.
  it.each([
    ["POST", () => rota.POST(pedido("POST", { nome: "Pedra Mandada" }))],
    ["PUT", () => rota.PUT(pedido("PUT", { slug: "qualquer", campo: "promessa", valor: "Uma pedra." }))],
    ["DELETE", () => rota.DELETE(pedido("DELETE", { slug: "qualquer" }))],
  ] as const)("Clerk fora no %s (que grava): 503 com CLERK_FORA, nunca a frase de abrir", async (_metodo, chamar) => {
    sessao.fora = true;
    const res = await chamar();
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA);
    expect(await total()).toBe(0);
  });

  it("bloqueada: 403 com a frase, e nada nasce", async () => {
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, AGORA] });
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada" }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await total()).toBe(0);
  });

  it("toda porta aberta registra quem contribui, com nome e e-mail (só pro painel)", async () => {
    await comecar();
    expect(await contribuidorPorId(c, PESSOA.id)).toMatchObject({ nome: PESSOA.nome, email: PESSOA.email });
  });
});

describe("POST — começar", () => {
  it("201 com a CHAVE (nunca o endereço), o endereço do nome e da cidade no documento, e o rascunho nasce DELA e sem nada a mais", async () => {
    await comecar();
    expect(CHAVE).not.toBe(SLUG);
    expect(await docDe()).toEqual({
      slug: SLUG, modos: [], cidade: "Cidade Teste",
      trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] }, condicao: { coords: { lat: -8.31, lng: -35.97 } },
    });
    expect((await rascunhoNoBanco(c, CHAVE))?.contribuidor).toBe(PESSOA.id);
    expect(await rascunhoNoBanco(c, SLUG), "nada mora no endereço").toBeNull();
  });

  // 17/10 (M6): o lugar nasce só do nome — sem cidade não há endereço, e o
  // `INSERT` não o confere. O caso semeia um LUGAR morando em `slugDoNome(NOME)`
  // (o endereço que um POST que passasse o nome como endereço conferiria).
  it("POST {nome} dela nasce, sem cidade e sem conferir endereço", async () => {
    await gravarVersao(c, "pedra-mandada", JSON.stringify({ slug: "pedra-mandada", modos: [], cidade: "Cidade Outra", trajeto: { waypoints: [{ nome: "Outro Nome Marcador" }] } }), "painel", AGORA - 5);
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada" }));
    expect(res.status, await res.clone().text()).toBe(201);
    const { slug } = (await res.json()) as { slug: string };
    expect(ehChaveDeRascunho(slug)).toBe(true);
    expect(await docDe(slug)).toEqual({ slug: "", modos: [], trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    expect((await rascunhoNoBanco(c, slug))?.contribuidor).toBe(PESSOA.id);
  });

  it("POST dela com cidade é 400", async () => {
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(400);
    expect(await total()).toBe(0);
  });

  // Review Focus 3: o par de um lugar do João. As fichas dele nasceram sem
  // cidade, então nome igual É colisão (o gêmeo sem cidade).
  // 🔴 I3 da pré-auditoria: a frase é a DELA — nunca "responda primeiro a cidade
  // dele, pela lista do painel" (ela não tem painel) —, e não nomeia ninguém.
  it("o gêmeo sem cidade de um lugar responde NOME_JA_EM_USO: a frase DELA, e nada nasce", async () => {
    const res = await rota.POST(pedido("POST", { nome: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(NOME_JA_EM_USO);
    expect(frase).not.toMatch(/painel/i);
    expect((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n).toBe(0);
  });

  // 🔴 Task 17 (decisão do João de 13/10, "Nenhum ocupa"): o rascunho de OUTRA
  // pessoa não recusa — os dois nascem, e quem publicar primeiro fica com o
  // endereço (`tests/api/rascunho-nao-ocupa.test.ts`). Até ali era 409.
  it("o par de um rascunho de OUTRA pessoa: nasce, e o dela fica", async () => {
    const doc = { slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } };
    const dela = await deOutra(SLUG, doc);
    await comecar();
    expect(await rascunhoNoBanco(c, dela)).toMatchObject({ doc: JSON.stringify(doc), contribuidor: OUTRA.id });
    expect(await total()).toBe(2);
  });

  it("o endereço de um rascunho de OUTRA pessoa, de nome diferente: nasce", async () => {
    const outro = "lugar-marcador-cidade-marcador";
    const dela = await deOutra(outro, { slug: outro, modos: [], cidade: "Cidade Marcador", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } });
    const res = await rota.POST(pedido("POST", { nome: "Lugar Marcador Cidade" }));
    expect(res.status, await res.clone().text()).toBe(201);
    // o endereço só existe quando a cidade chega (o ponto)
    const { slug } = (await res.json()) as { slug: string };
    const cid = await marcarPonto(slug, "Marcador");
    expect(cid.status, await cid.clone().text()).toBe(200);
    expect((await rascunhoNoBanco(c, dela))?.contribuidor).toBe(OUTRA.id);
  });

  // 🔴 §2.3.0 DELA (a saída (b) do João, 17/10): o ENDEREÇO de um LUGAR (nome
  // diferente, mesmo endereço — a fronteira entre o nome e a cidade que anda)
  // NÃO recusa o ponto: o ponto e a cidade gravam, e quem recusa é o PUBLICAR
  // dela, com a frase dela (nunca `enderecoDeLugar`, que nomearia o lugar).
  // Até 17/10 o PUT da cidade recusava com 409 no statement (`ENDERECO_LIVRE`).
  it("§2.3.0 dela: colisão no ponto grava; o publicar dela responde NOME_JA_EM_USO", async () => {
    const outro = "lugar-marcador-cidade-marcador";
    await gravarVersao(c, outro, JSON.stringify({ slug: outro, modos: [], cidade: "Cidade Marcador", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), "painel", AGORA - 5);
    const nasceu = await rota.POST(pedido("POST", { nome: "Lugar Marcador Cidade" }));
    expect(nasceu.status).toBe(201);
    const { slug } = (await nasceu.json()) as { slug: string };
    const res = await marcarPonto(slug, "Marcador");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug });
    expect(await docDe(slug)).toMatchObject({ slug: outro, cidade: "Marcador", trajeto: { waypoints: [{ lat: -8.31, lng: -35.97 }] } });
    // e o publicar dela trava
    const publicou = await publicarDela(slug);
    expect(publicou.status).toBe(409);
    expect(await publicou.text()).toBe(NOME_JA_EM_USO);
    expect(await total()).toBe(1);
  });

  // Ruling de produto da pré-auditoria: endereço antigo de outro lugar não é
  // dela — e desde 17/10 é o publicar que o diz, não o ponto.
  it("um endereço antigo de um lugar do João: o ponto grava; o publicar responde a frase dela, e o link velho continua", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const nasceu = await rota.POST(pedido("POST", { nome: "Pedra Mandada" }));
    expect(nasceu.status).toBe(201);
    const { slug } = (await nasceu.json()) as { slug: string };
    const res = await marcarPonto(slug);
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await docDe(slug)).cidade).toBe("Cidade Teste");
    const publicou = await publicarDela(slug);
    expect(publicou.status).toBe(409);
    expect(await publicou.text()).toBe(NOME_JA_EM_USO);
    expect((await c.execute({ sql: "SELECT novo FROM enderecos_antigos WHERE velho = ?", args: [SLUG] })).rows[0]?.novo).toBe("rampa-do-pepe");
    expect(await total()).toBe(1);
  });

  it.each([[{ nome: "" }], [{}], [{ nome: 7 }], [{ nome: "N", cidade: "C" }], [{ nome: "N", voz: "x" }]])(
    "corpo %j: 400",
    async (corpo) => expect((await rota.POST(pedido("POST", corpo))).status).toBe(400),
  );
});

describe("PUT — responder", () => {
  beforeEach(comecar);

  // 17/10: antes do ponto não há cidade — renomear só regrava (nada de
  // `CIDADE_VAZIA`), e o `slug` de dentro continua `""`.
  it("renomear antes do ponto: regrava, a chave não muda, sem CIDADE_VAZIA", async () => {
    const nasceu = await rota.POST(pedido("POST", { nome: "Pedra Primeira" }));
    const { slug } = (await nasceu.json()) as { slug: string };
    const res = await rota.PUT(pedido("PUT", { slug, campo: "trajeto.waypoints.0.nome", valor: "Pedra Segunda Marcada" }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug });
    expect(await docDe(slug)).toEqual({ slug: "", modos: [], trajeto: { waypoints: [{ nome: "Pedra Segunda Marcada" }] } });
    const semLetra = await rota.PUT(pedido("PUT", { slug, campo: "trajeto.waypoints.0.nome", valor: "--" }));
    expect(semLetra.status).toBe(400);
    expect(await semLetra.text()).toBe(NOME_SEM_LETRA);
  });

  it("um campo dela grava", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }))).status).toBe(200);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // Review Focus 1.
  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum"])(
    "campo fora da lista dela (`%s`): 400, e o rascunho não muda",
    async (campo) => {
      const antes = await docDe();
      const valor = campo === "condicao.regra.limiar_mm" ? 1 : campo === "carroComum" ? true : campo === "condicao.severidade" ? "cuidado" : campo === "piso" ? "barro" : "texto";
      expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo, valor }))).status).toBe(400);
      expect(await docDe()).toEqual(antes);
    },
  );

  it("o ponto dela grava ponto, chuva, cidade e o slug de dentro nome-cidade", async () => {
    nominatimDeTeste.pontos.length = 0;
    nominatimDeTeste.ponto = { cidade: "Outra Cidade" };
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, ponto: 0, lat: -8.4, lng: -35.9 }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json(), "a chave dela não anda").toEqual({ slug: CHAVE });
    const d = await docDe();
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.4, lng: -35.9 });
    expect(d.condicao.coords).toEqual({ lat: -8.4, lng: -35.9 });
    expect(d.cidade).toBe("Outra Cidade");
    expect(d.slug).toBe("pedra-mandada-outra-cidade");
    expect(nominatimDeTeste.pontos).toEqual([{ lat: -8.4, lng: -35.9 }]);
  });

  it.each(["fora", "limite", "sem-municipio"])("cidade que não sai (%s): 503, nada gravado", async (falha) => {
    nominatimDeTeste.ponto = { falha };
    const antes = await rascunhoNoBanco(c, CHAVE);
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, ponto: 0, lat: -8.4, lng: -35.9 }));
    expect([res.status, await res.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
    expect(await rascunhoNoBanco(c, CHAVE)).toEqual(antes);
  });

  it("a cidade do reverse sem letra nem número: 503, nada gravado", async () => {
    const antes = await rascunhoNoBanco(c, CHAVE);
    const res = await marcarPonto(CHAVE, "--");
    expect([res.status, await res.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
    expect(await rascunhoNoBanco(c, CHAVE)).toEqual(antes);
  });

  // `1e999` chega do `JSON.parse` como `Infinity`: barrado antes do Nominatim.
  it("coordenada que não é finita: 400, e o Nominatim não é consultado", async () => {
    nominatimDeTeste.pontos.length = 0;
    const antes = await docDe();
    const res = await rota.PUT(new Request("http://x/api/contribuir/rascunho", { method: "PUT", body: `{"slug":"${CHAVE}","ponto":0,"lat":1e999,"lng":-35}` }));
    expect(res.status).toBe(400);
    expect(nominatimDeTeste.pontos).toEqual([]);
    expect(await docDe()).toEqual(antes);
  });

  it("ponto que não é o 0: 400 (trajeto de mais de um ponto está fora)", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: CHAVE, ponto: 1, lat: -8.31, lng: -35.97 }))).status).toBe(400);
  });

  it("'não sei' em opcional dela tira a chave; em obrigatório dela, 400", async () => {
    await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "avisos", valor: "Leve água." }));
    expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "avisos", naoSei: true }))).status).toBe(200);
    expect("avisos" in (await docDe())).toBe(false);
    await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }));
    const recusa = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", naoSei: true }));
    expect(recusa.status).toBe(400);
    expect(await recusa.text()).toBe(SEM_NAO_SEI);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // 🔴 Task 17: a chave não anda — renomear regrava o documento, e o `slug` de
  // dentro (o endereço onde o lugar nasceria) acompanha o par.
  it("trocar o nome regrava o documento na MESMA chave, e o endereço de dentro acompanha", async () => {
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(await res.json()).toEqual({ slug: CHAVE });
    expect((await docDe()).slug).toBe("pedra-nova-cidade-teste");
    expect((await docDe()).trajeto.waypoints[0].nome).toBe("Pedra Nova");
    expect(await total()).toBe(1);
  });

  it("corrigir o ponto pra outra cidade também: o endereço de dentro acompanha", async () => {
    expect((await marcarPonto(CHAVE, "Outra Cidade")).status).toBe(200);
    expect((await docDe()).slug).toBe("pedra-mandada-outra-cidade");
  });

  // O aviso cedo do renomear: o ENDEREÇO que o par novo daria é de um lugar (o
  // par é outro — a fronteira entre o nome e a cidade que anda). Quem recusa é
  // o UPDATE (`regravarRascunhoDaPessoa` com `endereco`).
  it("renomear pro ENDEREÇO de um lugar, de par diferente: 409 com a frase dela, e o rascunho não muda", async () => {
    const outro = "pedra-mandada-x-cidade-teste";
    await gravarVersao(c, outro, JSON.stringify({ slug: outro, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada X Cidade" }] } }), "painel", AGORA - 5);
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Mandada X" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await docDe()).toEqual(antes);
  });

  it("renomear pra um endereço ANTIGO de outro lugar: 409 com a frase dela, e o rascunho não muda", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES ('pedra-velha-cidade-teste', 'rampa-do-pepe', ?)", args: [AGORA] });
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Velha" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await docDe()).toEqual(antes);
  });

  // I3 da pré-auditoria: renomear pro nome de um lugar do João esbarra no par
  // (o gêmeo sem cidade) — e a frase é a DELA.
  it("renomear pro nome de um lugar do João: 409 com a frase dela, e o rascunho não muda", async () => {
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await docDe()).toEqual(antes);
  });

  it("rascunho de OUTRA pessoa: 404, e ele não muda", async () => {
    const dela = await deOutra("da-outra-cidade", { slug: "da-outra-cidade" });
    expect((await rota.PUT(pedido("PUT", { slug: dela, campo: "promessa", valor: "x" }))).status).toBe(404);
    expect(await docDe(dela)).toEqual({ slug: "da-outra-cidade" });
  });

  it("o rascunho que sumiu entre a leitura e a gravação: 409 com a frase DELA", async () => {
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      await c.execute({ sql: "DELETE FROM ficha_rascunhos WHERE slug = ?", args: [CHAVE] });
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_SUMIU);
  });

  // O mesmo no RENOMEAR (o UPDATE que confere o endereço, Task 17): sumido é
  // "sumiu", nunca "em uso" — o endereço novo estava livre.
  it("o rascunho que sumiu no meio de um renomear: 409 com a frase de sumiu, não a de em uso", async () => {
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      await c.execute({ sql: "DELETE FROM ficha_rascunhos WHERE slug = ?", args: [CHAVE] });
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_SUMIU);
  });

  // Review Focus 4: a sessão venceu no meio — o rascunho fica.
  it("401 não toca o rascunho", async () => {
    await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }));
    sessao.atual = null;
    expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Outra." }))).status).toBe(401);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // Review Focus 2 da Task 15: o bloqueio PELO ATO DO JOÃO (`bloquearContribuidor`,
  // e não um UPDATE à mão como nos casos do fim do arquivo). A porta já
  // registrou a pessoa (linha com `bloqueado = 0`): sem o `DO UPDATE SET
  // bloqueado = 1` do bloquear, ela continuava livre e a gravação passava.
  it("bloqueada no meio do formulário: 403 com a frase, e o rascunho não muda", async () => {
    await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }));
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      const { bloquearContribuidor } = await import("@/lib/db-contribuidor");
      await bloquearContribuidor(c, PESSOA.id, AGORA);
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Outra." }));
    expect(corrida.disparos()).toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });
});

describe("GET e DELETE", () => {
  beforeEach(comecar);

  it("GET lista só os rascunhos dela, pela chave", async () => {
    await deOutra("da-outra-cidade", { slug: "da-outra-cidade" });
    const r = await (await rota.GET(pedido("GET"))).json();
    expect(r.rascunhos.map((x: { slug: string }) => x.slug)).toEqual([CHAVE]);
  });

  it("DELETE do dela: 200 e some; do de outra: 404 e fica", async () => {
    const dela = await deOutra("da-outra-cidade", { slug: "da-outra-cidade" });
    expect((await rota.DELETE(pedido("DELETE", { slug: dela }))).status).toBe(404);
    expect(await rascunhoNoBanco(c, dela)).not.toBeNull();
    expect((await rota.DELETE(pedido("DELETE", { slug: CHAVE }))).status).toBe(200);
    expect(await rascunhoNoBanco(c, CHAVE)).toBeNull();
  });
});

// 🔴 A PORTA DELA APARA E RECUSA (revisões anteriores, fechado na Task 10). A
// página pública só confere se há TEXTO (`if (ficha.avisos)`): um campo só de
// espaços passaria lá como resposta e sairia em branco na tela. E a cidade: o
// endereço que sai do par dela (no documento, e no publicar) só tem o hífen do
// meio — e nunca é o nome de uma tela do app (`SLUGS_RESERVADOS`) — se NENHUMA
// porta dela deixar o rascunho sem cidade com letra. Desde 17/10 ela não
// escreve a cidade (o PUT de campo `cidade` é 400 mudo), e a do ponto sem letra
// é 503 (casos do "PUT — responder"). Estes casos são essa prova, porta a porta
// (POST, PUT de valor, "não sei"). (Até a Task 17 eram
// também a prova de que o ramo `semCidade` de `colisaoDoPar` nunca era de um
// rascunho dela; desde ela, rascunho dela nem entra na colisão.)
describe("o texto dela entra aparado, e cidade vazia não chega ao rascunho dela", () => {
  const total = async () => Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n);

  it("POST: o nome com espaço nas pontas nasce aparado", async () => {
    const res = await rota.POST(pedido("POST", { nome: "  Pedra Mandada " }));
    expect(res.status).toBe(201);
    expect(await docDe(((await res.json()) as { slug: string }).slug)).toEqual({ slug: "", modos: [], trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
  });

  // A FRASE de cada recusa, e não só o 400: as recusas do POST são portas em
  // série (vazia → sem letra), e só a frase diz qual delas recusou.
  it.each([
    [{ nome: "   " }, NOME_VAZIO],
    [{ nome: "--" }, NOME_SEM_LETRA],
  ])("POST %j: 400 com a frase, e nada nasce", async (corpo, frase) => {
    const res = await rota.POST(pedido("POST", corpo));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(frase);
    expect(await total()).toBe(0);
  });

  describe("PUT", () => {
    beforeEach(comecar);

    it("a resposta com espaço nas pontas entra aparada", async () => {
      expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "  Uma pedra.\n" }))).status).toBe(200);
      expect((await docDe()).promessa).toBe("Uma pedra.");
    });

    it("o nome com espaço nas pontas: aparado no documento e no endereço de dentro", async () => {
      const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "  Pedra Nova  " }));
      expect(await res.json()).toEqual({ slug: CHAVE });
      expect((await docDe()).trajeto.waypoints[0].nome).toBe("Pedra Nova");
      expect((await docDe()).slug).toBe("pedra-nova-cidade-teste");
    });

    it.each(["promessa", "acesso", "avisos", "custo.valor", "trajeto.waypoints.0.nome"].flatMap((campo) =>
      ["", "   ", " \t\n "].map((valor) => [campo, valor] as const),
    ))("`%s` = %j: 400, e o rascunho não muda", async (campo, valor) => {
      const antes = await docDe();
      expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo, valor }))).status).toBe(400);
      expect(await docDe()).toEqual(antes);
    });

    // 🔴 17/10: a cidade SAI DO PONTO — ela não é campo dela. Qualquer PUT de
    // campo `cidade` (com valor, vazio, sem letra, ou "não sei") é 400 MUDO,
    // antes de ler o banco, e a cidade dela continua a do ponto. (Até 17/10
    // eram 400 com `CIDADE_VAZIA`/`CIDADE_SEM_LETRA`/`SEM_NAO_SEI`.)
    it("PUT do campo cidade é 400 mudo, nada gravado", async () => {
      const antes = await docDe();
      for (const corpo of [
        { campo: "cidade", valor: "Outra Cidade" },
        { campo: "cidade", valor: "" },
        { campo: "cidade", valor: "--" },
        { campo: "cidade", naoSei: true },
      ]) {
        const res = await rota.PUT(pedido("PUT", { slug: CHAVE, ...corpo }));
        expect(res.status, JSON.stringify(corpo)).toBe(400);
        expect(await res.text(), JSON.stringify(corpo)).toBe("");
      }
      expect(await docDe()).toEqual(antes);
      expect((await docDe()).cidade).toBe("Cidade Teste");
    });
  });
});

// 🔴 Task 17 (decisão do João de 13/10, "Nenhum ocupa"): o par que a rota dela
// confere é o de LUGAR (`colisaoDaMudanca` com `"pessoa"`), e o rascunho de
// OUTRA pessoa não recusa — pelos dois lados do par. Até ali era 409.
describe("PUT — o par de um rascunho de outra pessoa não recusa", () => {
  let dela: string;
  beforeEach(async () => {
    await comecar();
    const outro = "pedra-dela-outra-cidade";
    dela = await deOutra(outro, { slug: outro, modos: [], cidade: "Outra Cidade", trajeto: { waypoints: [{ nome: "Pedra Dela" }] } });
  });

  it("renomear pro nome do outro, estando na cidade dele: grava, e o dele fica", async () => {
    expect((await marcarPonto(CHAVE, "Outra Cidade")).status).toBe(200);
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Dela" }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await docDe()).slug).toBe("pedra-dela-outra-cidade");
    expect((await rascunhoNoBanco(c, dela))?.contribuidor).toBe(OUTRA.id);
  });

  it("corrigir o ponto pro par do outro: grava, e o dele fica", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Dela" }))).status).toBe(200);
    const res = await marcarPonto(CHAVE, "Outra Cidade");
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await docDe()).cidade).toBe("Outra Cidade");
    expect((await rascunhoNoBanco(c, dela))?.contribuidor).toBe(OUTRA.id);
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
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "promessa", valor: "Uma pedra." }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await docDe()).toEqual(antes);
  });

  // Renomear é o UPDATE com o endereço a conferir (Task 17): o bloqueio que
  // chega no meio vem antes de "em uso" — o endereço novo estava livre.
  it("PUT que renomeia: 403 com a frase de bloqueada, e o rascunho não muda", async () => {
    const antes = await docDe();
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: CHAVE, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await docDe()).toEqual(antes);
  });

  it("DELETE: 403 com a frase de bloqueada, e o rascunho fica", async () => {
    const corrida = clienteQueIntercala(c, /^DELETE FROM ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.DELETE(pedido("DELETE", { slug: CHAVE }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await rascunhoNoBanco(c, CHAVE)).not.toBeNull();
  });

  // O POST (Task 15, Step 5): o único ponto em que a rota ainda caía em "em
  // uso" quando quem recusou foi o bloqueio. O `beforeEach` já começou um
  // rascunho, então o pedido aqui é de OUTRO lugar, num endereço livre.
  it("POST que começa: 403 com a frase de bloqueada, não a de em uso, e nada nasce", async () => {
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_rascunhos/, bloquear);
    cli = corrida.cliente;
    const res = await rota.POST(pedido("POST", { nome: "Pedra Segunda" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await total()).toBe(1);
  });

  it("DELETE de quem já está bloqueada: 403 na porta, e o rascunho fica", async () => {
    await bloquear();
    const res = await rota.DELETE(pedido("DELETE", { slug: CHAVE }));
    expect(res.status).toBe(403);
    expect(await rascunhoNoBanco(c, CHAVE)).not.toBeNull();
  });
});

// 🔴 M6 DA REVISÃO FINAL: o teto de 2000 caracteres por campo que ela escreve,
// na porta — no começar (o nome) e no responder (todo campo de texto dela; a
// cidade sai do ponto desde 17/10, e não é campo dela).
describe("o teto do texto dela", () => {
  const longo = (n: number) => "a".repeat(n);

  it("POST: nome com 2000 nasce; com 2001, 400 com a frase, e nada nasce", async () => {
    const corpo = (n: number) => ({ nome: longo(n) });
    const recusa = await rota.POST(pedido("POST", corpo(2001)));
    expect(recusa.status).toBe(400);
    expect(await recusa.text()).toBe(TEXTO_LONGO_DEMAIS);
    expect(await total()).toBe(0);
    expect((await rota.POST(pedido("POST", corpo(2000)))).status).toBe(201);
  });

  it.each(["promessa", "acesso", "avisos", "custo.valor", "trajeto.waypoints.0.nome"])(
    "PUT `%s`: 2000 grava; 2001 é 400 com a frase, e o rascunho não muda",
    async (campo) => {
      await comecar();
      const antes = await docDe();
      const recusa = await rota.PUT(pedido("PUT", { slug: CHAVE, campo, valor: longo(2001) }));
      expect(recusa.status).toBe(400);
      expect(await recusa.text()).toBe(TEXTO_LONGO_DEMAIS);
      expect(await docDe()).toEqual(antes);
      expect((await rota.PUT(pedido("PUT", { slug: CHAVE, campo, valor: longo(2000) }))).status).toBe(200);
    },
  );
});

// 🔴 TASK 17 (decisão do João de 13/10, "Nenhum ocupa"): até ali o rascunho
// DELA mesma recusava o par e o endereço, com `RASCUNHO_DELA_JA_EXISTE` (I1 da
// revisão final). Agora dois rascunhos dela com o mesmo nome podem existir — ela
// desiste do que sobrar (consequência aceita da decisão) —, e a frase foi
// apagada com o estado que a alcançava.
describe("dois rascunhos dela com o mesmo nome e cidade", () => {
  it("POST com o par de um rascunho dela: nasce outro, numa chave nova", async () => {
    await comecar();
    const primeira = CHAVE;
    await comecar();
    expect(CHAVE).not.toBe(primeira);
    expect(await total()).toBe(2);
    expect((await docDe(primeira)).slug).toBe((await docDe()).slug);
  });

  it("PUT que renomeia pro par de outro rascunho dela: grava", async () => {
    await comecar();
    const primeira = CHAVE;
    const segunda = await rota.POST(pedido("POST", { nome: "Pedra Segunda" }));
    expect(segunda.status).toBe(201);
    const cidade = await marcarPonto(((await segunda.json()) as { slug: string }).slug);
    expect(cidade.status).toBe(200);
    const res = await rota.PUT(pedido("PUT", { slug: primeira, campo: "trajeto.waypoints.0.nome", valor: "Pedra Segunda" }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await docDe(primeira)).slug).toBe("pedra-segunda-cidade-teste");
  });
});

// Onda de fix da Task 10: a frase de toda colisão dela não diz "no ar" (falso
// pro lugar escondido) nem que o lugar "logo estará" no app (falso pro
// endereço antigo), e não nomeia ninguém.
it("NOME_JA_EM_USO não promete onde o outro lugar está", () => {
  expect(NOME_JA_EM_USO).not.toMatch(/no ar|logo estar|mandando|painel/i);
});

// Task 17: rascunho não ocupa nada — a frase não fala mais dele. O pedaço "ou de
// um que alguém começou e ainda não publicou" (I1 da revisão final) saiu por
// subtração: ficou falso.
// (Onda de copy de 13/10: a frase ganhou a saída que o João escolheu — "use
// um nome que diferencie, como fazem por lá" — e o texto exato é travado em
// `tests/lib/onda-de-copy-13-10.test.ts`.)
it("NOME_JA_EM_USO não fala de rascunho: só de lugar que já é do BatePerna", () => {
  expect(NOME_JA_EM_USO).not.toMatch(/começou|ainda não publicou/);
  expect(NOME_JA_EM_USO).toMatch(/já é de outro lugar no BatePerna\. /);
});
