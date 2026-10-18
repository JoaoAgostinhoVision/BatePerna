import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { criarRascunho, gravarVersao, lerAcervoComOrigem, lerRascunho, publicarRascunho, versaoAtual } from "@/lib/db";
import { NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { travaDoPainel } from "@/lib/par-de-lugar";
import { ehChaveDeRascunho, enderecoDeLugar, slugDoNome } from "@/lib/rascunho";
import { ROTAS } from "@/app/admin/novo/enderecos";
import type { QuemContribui } from "@/lib/contribuidor-sessao";
import { clienteQueIntercala, rascunhoNoBanco, salvarRascunho, semearAcervo } from "../banco";
import { lugarMarcador } from "../lugar-marcador";
import { nominatimDeTeste } from "../nominatim";
import { rascunhoCompleto } from "../rascunho-completo";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

/** 🔴 RASCUNHO NÃO OCUPA NOME (Task 17, decisão do João de 13/10: "rascunho não
 *  deve bloquear" — "Nenhum ocupa"). Só lugar que EXISTE em `ficha_versoes` (no
 *  ar ou escondido) e endereço antigo ocupam nome/endereço; quem publica
 *  primeiro fica com o endereço, e o segundo é recusado NA HORA DE PUBLICAR.
 *
 *  As provas que o brief pede, pelas rotas de verdade dos DOIS lados (a dela
 *  com o dublê do Clerk, a do painel com sessão de verdade), num arquivo só:
 *  os cenários atravessam as duas portas. */

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));
// 🔴 A suíte nunca bate no Nominatim (spec §7): o ponto 0 das duas portas
// pergunta a cidade ao dublê.
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-nao-ocupa";
const AGORA = 1_758_500_000;
let c: Client;
/** O cliente que as ROTAS veem — `c`, ou um que intercala (a corrida). */
let cli: Client;
let cookie: string;
let dela: typeof import("@/app/api/contribuir/rascunho/route");
let publicarDela: typeof import("@/app/api/contribuir/publicar/route");
let painel: typeof import("@/app/api/admin/rascunho/route");
let publicarPainel: typeof import("@/app/api/admin/publicar/route");
let endereco: typeof import("@/app/api/admin/endereco/route");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  dela = await import("@/app/api/contribuir/rascunho/route");
  publicarDela = await import("@/app/api/contribuir/publicar/route");
  painel = await import("@/app/api/admin/rascunho/route");
  publicarPainel = await import("@/app/api/admin/publicar/route");
  endereco = await import("@/app/api/admin/endereco/route");
  cookie = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// A SONDA 2 de `route-contribuir-rascunho.test.ts`, copiada (global constraints).
it("SONDA 2: o dublê reimportado depois de `vi.resetModules()` é o MESMO objeto", async () => {
  vi.resetModules();
  const outraInstancia = await import("../sessao-da-pessoa");
  expect(outraInstancia.sessao, "o módulo do dublê renasceu com OUTRO estado").toBe(sessao);
});

const json = (url: string, metodo: string, corpo: unknown, comCookie = false) =>
  new Request(url, {
    method: metodo,
    headers: comCookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });

/** O ponto 0, marcado com o Nominatim (dublado) dizendo que ele cai em `cidade`. */
const ponto = (slug: string, cidade: string) => {
  nominatimDeTeste.ponto = { cidade };
  return { slug, ponto: 0, lat: -8.31, lng: -35.97 };
};

/** 17/10: o lugar nasce só do nome, e a cidade sai do PONTO. Ela começa um
 *  lugar pela rota dela e devolve a CHAVE do rascunho e a resposta do PUT do
 *  ponto — que GRAVA sempre (a saída (b)): o PAR e o ENDEREÇO se conferem no
 *  publicar dela. */
async function comecarSemConferir(quem: QuemContribui, nome: string, cidade: string): Promise<{ chave: string; ponto: Response }> {
  sessao.atual = quem;
  const res = await dela.POST(json("http://x/api/contribuir/rascunho", "POST", { nome }));
  expect(res.status, await res.clone().text()).toBe(201);
  const chave = ((await res.json()) as { slug: string }).slug;
  return { chave, ponto: await dela.PUT(json("http://x/api/contribuir/rascunho", "PUT", ponto(chave, cidade))) };
}

/** Ela começa um lugar pela rota dela; devolve a CHAVE do rascunho. */
async function comecar(quem: QuemContribui, nome: string, cidade: string): Promise<string> {
  const { chave, ponto: res } = await comecarSemConferir(quem, nome, cidade);
  expect(res.status, await res.clone().text()).toBe(200);
  return chave;
}

/** O João cria um lugar novo pelo painel: o nome, e o ponto (de onde sai a
 *  cidade). Devolve a resposta do PUT do ponto — `{slug}` com o endereço quando
 *  o rascunho se mudou pra ele, ou com a chave provisória quando o par ou o
 *  endereço já é de outro (a saída (b)) —, ou a do POST quando é o POST que
 *  recusa. */
async function painelCria(nome: string, cidade: string): Promise<Response> {
  const res = await painel.POST(json("http://x/api/admin/rascunho", "POST", { nome }, true));
  if (res.status !== 201) return res;
  const { slug: chave } = (await res.clone().json()) as { slug: string };
  return painel.PUT(json("http://x/api/admin/rascunho", "PUT", ponto(chave, cidade), true));
}

/** Ela responde as obrigatórias dela, pela rota dela (a promessa é só dela: a
 *  coerência recusa texto emprestado de outro lugar). O ponto já foi no
 *  `comecar` (é dele que a cidade sai). */
async function completar(quem: QuemContribui, chave: string): Promise<void> {
  sessao.atual = quem;
  for (const corpo of [
    { slug: chave, campo: "promessa", valor: `A promessa de ${quem.id}, com as palavras dela.` },
    { slug: chave, campo: "acesso", valor: "De carro." },
    { slug: chave, campo: "custo.tag", valor: "gratis" },
  ]) {
    const res = await dela.PUT(json("http://x/api/contribuir/rascunho", "PUT", corpo));
    expect(res.status, await res.clone().text()).toBe(200);
  }
}

async function publicar(quem: QuemContribui, chave: string): Promise<Response> {
  sessao.atual = quem;
  const atualizadoEm = (await rascunhoNoBanco(c, chave))!.atualizado_em;
  return publicarDela.POST(json("http://x/api/contribuir/publicar", "POST", { slug: chave, atualizadoEm }));
}

const versoesEm = async (slug: string) =>
  Number((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [slug] })).rows[0].n);

const NOME = "Pedra Dupla";
const CIDADE = "Cidade Teste";
const E = slugDoNome(`${NOME} ${CIDADE}`);

describe("duas pessoas começam o MESMO nome e cidade", () => {
  it("os dois rascunhos existem; a primeira publica no endereço; a segunda é recusada no publicar, e o rascunho dela fica", async () => {
    const dePessoa = await comecar(PESSOA, NOME, CIDADE);
    const deOutra = await comecar(OUTRA, NOME, CIDADE);
    expect(dePessoa).not.toBe(deOutra);
    expect(await rascunhoNoBanco(c, dePessoa)).toMatchObject({ contribuidor: PESSOA.id });
    expect(await rascunhoNoBanco(c, deOutra)).toMatchObject({ contribuidor: OUTRA.id });

    await completar(PESSOA, dePessoa);
    await completar(OUTRA, deOutra);
    const primeira = await publicar(PESSOA, dePessoa);
    expect(primeira.status, await primeira.clone().text()).toBe(200);
    // A resposta diz o ENDEREÇO onde o lugar foi ao ar — nunca a chave do rascunho.
    expect(await primeira.json()).toEqual({ slug: E });
    expect((await lerAcervoComOrigem(c)).linhas.get(E)).toMatchObject({ contribuidor: PESSOA.id, conferido: false });
    expect(await rascunhoNoBanco(c, dePessoa)).toBeNull();

    const antes = (await rascunhoNoBanco(c, deOutra))!;
    const segunda = await publicar(OUTRA, deOutra);
    expect(segunda.status).toBe(409);
    expect(await segunda.text()).toBe(NOME_JA_EM_USO);
    expect(await versoesEm(E)).toBe(1);
    expect(await rascunhoNoBanco(c, deOutra)).toEqual(antes);
    // A frase é VERDADE neste estado: o nome já é de outro lugar no BatePerna
    // (o da primeira, que não é dela) — e ela não fala mais de rascunho.
    expect((await versaoAtual(c, E))?.autor).toBe("contribuidor");
    expect(NOME_JA_EM_USO).not.toMatch(/começou|ainda não publicou/);
  });

  // A corrida: a segunda passa por toda a leitura da rota (o par está livre), e
  // a primeira publica entre a leitura e o batch dela. Quem recusa é o 1º passo
  // do batch (`NOT EXISTS` de versão no ENDEREÇO) — a frase é a mesma.
  it("a corrida: a primeira publica entre a leitura da segunda e o batch dela — a segunda é recusada pelo banco", async () => {
    const dePessoa = await comecar(PESSOA, NOME, CIDADE);
    const deOutra = await comecar(OUTRA, NOME, CIDADE);
    await completar(PESSOA, dePessoa);
    await completar(OUTRA, deOutra);
    const daPessoa = (await rascunhoNoBanco(c, dePessoa))!;
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      expect(await publicarRascunho(c, E, daPessoa.doc, AGORA - 1, daPessoa.atualizado_em, { contribuidor: PESSOA.id, chave: dePessoa })).toBe(true);
    });
    cli = corrida.cliente;
    const res = await publicar(OUTRA, deOutra);
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versoesEm(E)).toBe(1);
    expect((await lerAcervoComOrigem(c)).linhas.get(E)).toMatchObject({ contribuidor: PESSOA.id });
    expect(await rascunhoNoBanco(c, deOutra)).not.toBeNull();
  });
});

describe("o João e ela, no mesmo par", () => {
  const NOME_J = "Lugar Marcador Joao";
  const CIDADE_J = "Cidade Marcador Joao";
  const X = slugDoNome(`${NOME_J} ${CIDADE_J}`);

  it("o João tem rascunho em X; ela começa e publica o mesmo par: vai ao ar em X; o publicar do João depois é recusado com enderecoDeLugar (a frase de hoje do painel pra endereço ocupado por lugar)", async () => {
    const criou = await painelCria(NOME_J, CIDADE_J);
    expect(criou.status, await criou.clone().text()).toBe(200);
    expect(await criou.json()).toEqual({ slug: X });
    await salvarRascunho(c, X, JSON.stringify(rascunhoCompleto(X, NOME_J, CIDADE_J)), AGORA - 50);

    const chave = await comecar(PESSOA, NOME_J, CIDADE_J);
    await completar(PESSOA, chave);
    const res = await publicar(PESSOA, chave);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: X });
    expect((await lerAcervoComOrigem(c)).linhas.get(X)).toMatchObject({ contribuidor: PESSOA.id });
    expect(await lerRascunho(c, X), "o rascunho do João continua na lista dele").not.toBeNull();

    const doJoao = await publicarPainel.POST(json("http://x/api/admin/publicar", "POST", { slug: X, atualizadoEm: AGORA - 50 }, true));
    expect(doJoao.status).toBe(409);
    // O par dele não acusa (o `exceto` do publicar tira o próprio endereço X, onde
    // agora mora o lugar dela); quem recusa é o batch, e a frase é a do endereço.
    expect(await doJoao.text()).toBe(enderecoDeLugar(`${NOME_J} (${CIDADE_J})`));
    expect(await versoesEm(X)).toBe(1);
    expect((await versaoAtual(c, X))?.autor).toBe("contribuidor");
  });

  it("ela tem rascunho com o par P; o João CRIA lugar novo com P pelo painel: não é recusado", async () => {
    const chave = await comecar(PESSOA, NOME_J, CIDADE_J);
    const res = await painelCria(NOME_J, CIDADE_J);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await lerRascunho(c, X)).not.toBeNull();
    expect(await rascunhoNoBanco(c, chave), "o dela continua").toMatchObject({ contribuidor: PESSOA.id });
  });

  it("ela começa o par de um rascunho do João: não é recusada", async () => {
    expect((await painelCria(NOME_J, CIDADE_J)).status).toBe(200);
    const chave = await comecar(PESSOA, NOME_J, CIDADE_J);
    expect(await rascunhoNoBanco(c, chave)).toMatchObject({ contribuidor: PESSOA.id });
  });

  // Pro João, o rascunho DELE continua contando (a lista dele): a colisão
  // João × João é a de hoje — e desde 17/10 ela não recusa o ponto (a saída
  // (b)): o segundo fica numa chave provisória, e o que a tela diz é a frase de
  // hoje.
  it("o João começa o par de um rascunho DELE: fica na provisória, com a frase de hoje, 'continue por ele, na lista do painel'", async () => {
    expect(await (await painelCria(NOME_J, CIDADE_J)).json()).toEqual({ slug: X });
    const res = await painelCria(NOME_J, CIDADE_J);
    expect(res.status, await res.clone().text()).toBe(200);
    const { slug } = (await res.json()) as { slug: string };
    expect(ehChaveDeRascunho(slug), slug).toBe(true);
    expect(await travaDoPainel((await lerRascunho(c, slug))!.doc, slug)).toMatch(/lista do painel/);
  });

  it("o João troca o endereço de um lugar pra um endereço que só um rascunho DELA usaria: não é recusado", async () => {
    const A = "lugar-marcador-bom-marcador";
    const novo = "lugar-marcador-outra-marcadora";
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 100);
    // O par dela é OUTRO (a fronteira entre o nome e a cidade que anda), e o
    // endereço que sairia dele é o novo do lugar do João.
    const chave = await comecar(PESSOA, "Lugar Marcador Outra", "Marcadora");
    expect(JSON.parse((await rascunhoNoBanco(c, chave))!.doc).slug, "a premissa: o endereço dela seria o novo").toBe(novo);
    const res = await endereco.POST(json("http://x/api/admin/endereco", "POST", { slug: A, baseId: (await versaoAtual(c, A))!.id }, true));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: novo });
    expect(await rascunhoNoBanco(c, chave)).toMatchObject({ contribuidor: PESSOA.id });
  });
});

// 🔴 17/10 (a saída (b) do João): o lugar que existe não recusa mais o PONTO
// dela — o ponto e a cidade gravam —; quem recusa é o PUBLICAR, com a frase
// dela. Cedo, só o renomear (o último caso).
describe("o que ainda recusa: lugar que existe", () => {
  // O endereço do lugar escondido NÃO é o que o par dela daria: a recusa só
  // pode vir da colisão pelo PAR, e não do endereço no batch.
  it("o par de um lugar ESCONDIDO: o ponto grava; o publicar recusa, com a frase dela", async () => {
    const H = "pedra-escondida-endereco-de-antes";
    await gravarVersao(c, H, JSON.stringify(lugarMarcador(H, "Pedra Escondida", "Cidade Teste")), "painel", AGORA - 100, true);
    const { chave, ponto: res } = await comecarSemConferir(PESSOA, "Pedra Escondida", "Cidade Teste");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.parse((await rascunhoNoBanco(c, chave))!.doc).cidade, "a cidade do ponto gravou").toBe("Cidade Teste");
    await completar(PESSOA, chave);
    const pub = await publicar(PESSOA, chave);
    expect(pub.status).toBe(409);
    expect(await pub.text()).toBe(NOME_JA_EM_USO);
    expect((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n).toBe(1);
    expect(await versoesEm(slugDoNome("Pedra Escondida Cidade Teste"))).toBe(0);
  });

  it("o ENDEREÇO de um lugar, de par diferente: o ponto grava; o publicar recusa, com a frase dela", async () => {
    const A = "lugar-marcador-outra-marcadora";
    await gravarVersao(c, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", AGORA - 100);
    const { chave, ponto: res } = await comecarSemConferir(PESSOA, "Lugar Marcador Outra", "Marcadora");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.parse((await rascunhoNoBanco(c, chave))!.doc)).toMatchObject({ slug: A, cidade: "Marcadora" });
    await completar(PESSOA, chave);
    const pub = await publicar(PESSOA, chave);
    expect(pub.status).toBe(409);
    expect(await pub.text()).toBe(NOME_JA_EM_USO);
    expect(await versoesEm(A)).toBe(1);
    expect((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n).toBe(1);
  });

  it("renomear o rascunho dela pro par de um lugar escondido: recusada, e o nome fica", async () => {
    const H = "pedra-escondida-endereco-de-antes";
    await gravarVersao(c, H, JSON.stringify(lugarMarcador(H, "Pedra Escondida", "Cidade Teste")), "painel", AGORA - 100, true);
    const chave = await comecar(PESSOA, NOME, CIDADE);
    const res = await dela.PUT(json("http://x/api/contribuir/rascunho", "PUT", { slug: chave, campo: "trajeto.waypoints.0.nome", valor: "Pedra Escondida" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(JSON.parse((await rascunhoNoBanco(c, chave))!.doc).trajeto.waypoints[0].nome).toBe(NOME);
  });
});

// 🔴 A CHAVE DO RASCUNHO DELA NUNCA É UM ENDEREÇO. Todo endereço de lugar sai
// de `slugDoNome` (o POST do João, a troca de endereço) ou da semente (o nome
// do arquivo), e os dois só têm `[a-z0-9-]`. A chave tem `_`, que nenhum dos
// dois produz — então ela nunca coincide com um endereço, nem de lugar, nem de
// rascunho do João, nem antigo.
describe("a chave do rascunho dela", () => {
  const ENDERECO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it("tem um caractere que nenhum endereço tem, e o slugDoNome nunca o produz", async () => {
    const chave = await comecar(PESSOA, NOME, CIDADE);
    expect(chave).toMatch(/_/);
    expect(chave).not.toMatch(ENDERECO);
    for (const s of [chave, "a_b", "__", "Pedra_do_Navio", "x _ y", "ção_ão", `${NOME} ${CIDADE}`]) {
      expect(slugDoNome(s), s).not.toMatch(/_/);
    }
    // E o acervo semeado: todo endereço dele tem a forma de endereço.
    const enderecos = (await c.execute("SELECT DISTINCT ficha_slug FROM ficha_versoes")).rows.map((l) => String(l.ficha_slug));
    expect(enderecos.length, "a premissa: há lugares no banco").toBeGreaterThan(2);
    for (const e of enderecos) expect(e).toMatch(ENDERECO);
  });

  it("nasce outra a cada rascunho, mesmo com o mesmo nome e a mesma cidade", async () => {
    const um = await comecar(PESSOA, NOME, CIDADE);
    const dois = await comecar(PESSOA, NOME, CIDADE);
    expect(um).not.toBe(dois);
    expect(Number((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n)).toBe(2);
  });

  it("anda na URL das telas dela e volta igual, e a rota a aceita", async () => {
    const chave = await comecar(PESSOA, NOME, CIDADE);
    for (const url of [ROTAS.contribuir.pergunta(chave, 2), ROTAS.contribuir.publicar(chave), ROTAS.contribuir.comecou(chave)]) {
      expect(new URL(url, "http://x").searchParams.get("slug"), url).toBe(chave);
    }
    const lido = await dela.GET(new Request(`http://x/api/contribuir/rascunho?slug=${encodeURIComponent(chave)}`));
    expect(lido.status).toBe(200);
    expect(((await lido.json()) as { slug: string }).slug).toBe(chave);
  });

  it("renomear não muda a chave: o documento é regravado, e o endereço de dentro acompanha o par", async () => {
    const chave = await comecar(PESSOA, NOME, CIDADE);
    const res = await dela.PUT(json("http://x/api/contribuir/rascunho", "PUT", { slug: chave, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: chave });
    expect(JSON.parse((await rascunhoNoBanco(c, chave))!.doc).slug).toBe(slugDoNome(`Pedra Nova ${CIDADE}`));
  });
});
