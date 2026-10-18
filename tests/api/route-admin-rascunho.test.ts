import { readdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA, lerCaminho } from "@/lib/campos-da-ficha";
import {
  apagarRascunho,
  ensureSchema,
  gravarVersao,
  historico,
  lerRascunho,
  listarRascunhos,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import { travaDoPainel } from "@/lib/par-de-lugar";
import {
  CIDADE_DO_PONTO_NAO_SAIU,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  RASCUNHO_NAO_EXISTE_MAIS,
  SLUGS_RESERVADOS,
  ehChaveDeRascunho,
  enderecoDeLugar,
  enderecoDeRascunho,
  gemeoSemCidade,
  parDeLugar,
  parDeRascunho,
  slugDoNome,
} from "@/lib/rascunho";
import type { Ficha } from "@/types/ficha";
import { criarRascunhoDaPessoa, novaChaveDeRascunho } from "@/lib/db-contribuidor";
import { PESSOA_DE_TESTE, clienteQueIntercala, rascunhoNoBanco, salvarRascunho, semearAcervo } from "../banco";
import { nominatimDeTeste } from "../nominatim";
import { rascunhoCompleto } from "../rascunho-completo";

/** A PORTA DO RASCUNHO (Tarefa 11): `/api/admin/rascunho`.
 *
 *  Molde: `route-admin-visibilidade.test.ts` — `Request` à mão, `vi.stubEnv`,
 *  `criarSessao` de verdade, acervo do BANCO por `semearAcervo`.
 *
 *  🔴 ASSERÇÃO DUPLA EM TODO CASO QUE RECUSA: o código E o banco. "Recusou" sem
 *  olhar o banco não distingue de "gravou a coisa errada e devolveu 400", e aqui
 *  a coisa errada é um rascunho por cima de um lugar que está no ar.
 *
 *  Nenhum lugar real é inventado: os nomes novos são MARCADORES, e as cidades
 *  também (`Cidade Marcador …`) — nenhuma cidade real entra em teste. O único
 *  nome real que aparece é o de um lugar que JÁ ESTÁ no banco, lido do banco. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-rascunho";
const AGORA = 1_758_400_000;
const NOME = "Lugar Marcador Um";
const CIDADE = "Cidade Marcador Um";
const OUTRA_CIDADE = "Cidade Marcador Dois";
/** O endereço de `NOME` em `CIDADE`: o nome, e a cidade depois (Tarefa 11b). */
const S = "lugar-marcador-um-cidade-marcador-um";

let c: Client;
/** O cliente que a ROTA vê — `c`, ou um que intercala (os casos de corrida). */
let cli: Client;
let acervo: Ficha[];
let cookieBom: string;
let rota: typeof import("@/app/api/admin/rascunho/route");

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => cli };
});
// 🔴 A suíte nunca bate no Nominatim (spec §7): o ponto 0 pergunta a cidade ao
// dublê, que diz `nominatimDeTeste.ponto` e anota cada pergunta em `.pontos`.
vi.mock("@/lib/nominatim-servico", async () => (await import("../nominatim")).dubleDoNominatim());

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await ensureSchema(c);
  acervo = await semearAcervo(c);
  // O estado do dublê mora em `globalThis` e nunca renasce: zerado a cada caso.
  nominatimDeTeste.ponto = { cidade: CIDADE };
  nominatimDeTeste.pontos.length = 0;
  nominatimDeTeste.buscas.length = 0;
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  rota = await import("@/app/api/admin/rascunho/route");
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function pedido(metodo: string, corpo: unknown, cookie?: string, busca = ""): Request {
  return new Request(`http://x/api/admin/rascunho${busca}`, {
    method: metodo,
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

// ⚠️ `null` = SEM cookie. Não `undefined`: com parâmetro padrão, `undefined`
// vira o cookie bom em silêncio, e o caso do 401 manda sessão válida. Medido:
// foi assim que os dois casos de 401 nasceram, VERMELHOS contra uma rota certa
// (201 e 200 onde se esperava 401) — o defeito era do teste, não da porta.

/** O ponto marcado no mapa (o ponto 0, de onde sai a cidade). */
const LAT = -8.1;
const LNG = -35.2;
const mudar = (corpo: unknown, cookie: string | null = cookieBom) => rota.PUT(pedido("PUT", corpo, cookie ?? undefined));
/** O PUT do ponto 0, com o Nominatim (dublado) dizendo que ele cai em `cidade`. */
function marcarPonto(slug: string, cidade: string = CIDADE, cookie: string | null = cookieBom): Promise<Response> {
  nominatimDeTeste.ponto = { cidade };
  return mudar({ slug, ponto: 0, lat: LAT, lng: LNG }, cookie);
}
/** A chave provisória do rascunho que o `POST {nome}` fez nascer. */
async function nascer(nome: string): Promise<string> {
  const r = await rota.POST(pedido("POST", { nome }, cookieBom));
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await r.json()) as { slug: string }).slug;
}

/** 🔴 O LUGAR NOVO POR INTEIRO, como a tela o faz desde 17/10: o `POST {nome}`
 *  (numa chave provisória) e o PONTO 0, de onde sai a cidade (`marcarPonto`,
 *  com o Nominatim dublado dizendo `cidade`). É o ponto que leva o rascunho ao
 *  endereço nome + cidade, e é nele que o PAR e o ENDEREÇO se conferem.
 *
 *  ⚠️ O PONTO NÃO RECUSA COLISÃO (a saída (b) do João, spec §2.3.0): o ponto e
 *  a cidade gravam, e o rascunho FICA na chave provisória. `criar` traduz esse
 *  "ficou" no que a tela e o publicar diriam — 409 com a frase de
 *  `travaDoPainel` — e apaga o provisório, pra os casos de PAR e de ENDEREÇO
 *  continuarem medindo QUEM bloqueia e que nada nasce no endereço. Que o ponto
 *  GRAVA e que o publicar TRAVA, em si, é medido em "a cidade sai do ponto".
 *  Se o POST recusa, devolve a recusa dele; se o PUT recusa, apaga o
 *  provisório e devolve a recusa do PUT; se o rascunho chega ao endereço,
 *  devolve 201 com ele, como o POST de antes. */
async function criar(nome: string, cidade: string = CIDADE, cookie: string | null = cookieBom): Promise<Response> {
  const nasceu = await rota.POST(pedido("POST", { nome }, cookie ?? undefined));
  if (nasceu.status !== 201) return nasceu;
  const { slug: chave } = (await nasceu.clone().json()) as { slug: string };
  const res = await marcarPonto(chave, cidade, cookie);
  if (res.status !== 200) {
    await apagarRascunho(c, chave);
    return res;
  }
  const { slug } = (await res.json()) as { slug: string };
  if (ehChaveDeRascunho(slug)) {
    const trava = await travaDoPainel((await lerRascunho(c, slug))!.doc, slug);
    await apagarRascunho(c, slug);
    return new Response(trava ?? "", { status: 409 });
  }
  return Response.json({ slug }, { status: 201 });
}
/** O documento do rascunho que o POST {nome} fez nascer. */
async function docDoPost(nome: string): Promise<Record<string, unknown>> {
  const r = await rota.POST(pedido("POST", { nome }, cookieBom));
  expect(r.status).toBe(201);
  return JSON.parse((await lerRascunho(c, ((await r.json()) as { slug: string }).slug))!.doc);
}
const docDe = async (slug: string): Promise<Record<string, unknown>> => JSON.parse((await lerRascunho(c, slug))!.doc);

/** Esconde um lugar do jeito que a porta de visibilidade faz: versão nova, `oculto`. */
async function esconder(slug: string): Promise<void> {
  const atual = (await versaoAtual(c, slug))!;
  await gravarVersao(c, slug, atual.doc, "painel", AGORA, true);
}

// ═══════════════════════════════════════════════════════════════════════════
describe("o slug sai do NOME", () => {
  it("minúsculas, sem acento, hífen entre palavras", () => {
    expect(slugDoNome("Lugar Marcador Um")).toBe("lugar-marcador-um");
    expect(slugDoNome("  Áçaí  da   Ponte—Velha! ")).toBe("acai-da-ponte-velha");
    expect(slugDoNome("Cachoeira nº 2")).toBe("cachoeira-n-2");
    expect(slugDoNome("!!!")).toBe("");
  });

  // 🔴 A TELA DO APP NUNCA VIRA ENDEREÇO, POR CONSTRUÇÃO (onda de fix da 11b):
  // o endereço de um lugar novo é SEMPRE nome + cidade, os dois com letra, então
  // sempre tem um hífen no meio — e nenhuma tela do app tem. Pasta de rota nova
  // com hífen entra em `SLUGS_RESERVADOS` (o caso de baixo a exige) e deixa
  // este vermelho: aí o endereço PODERIA chegar a ela, e a conferência volta.
  it("nenhuma tela do app tem hífen, e todo endereço de lugar novo tem", () => {
    expect(SLUGS_RESERVADOS.length, "a premissa: a lista foi lida").toBeGreaterThan(0);
    for (const tela of SLUGS_RESERVADOS) expect(tela, tela).not.toContain("-");
  });

  // 🔴 O mesmo slug que a SEMENTE deu aos lugares de hoje sai do nome deles —
  // é isso que faz os casos "o nome de um lugar no ar, numa cidade" abaixo
  // medirem um endereço que JÁ EXISTE (o do nome sozinho), e não um qualquer.
  it("o nome de um lugar do acervo dá o slug dele", () => {
    expect(
      acervo.some((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug),
      "nenhum lugar do acervo tem o slug derivado do nome: os casos abaixo não mediriam o caso comum",
    ).toBe(true);
  });

  // 🔴 LISTA À MÃO, VIGIADA PELO DISCO: todo segmento estático de rota que um
  // slug alcançaria (`/<slug>`, `/admin/<slug>` e, desde 07/10, o editar dela
  // em `/contribuir/<slug>`) tem de estar reservado. Um
  // lugar chamado "Trilhas" teria a ficha pública atrás da página do acervo, e um
  // chamado "Novo" teria o painel atrás do formulário — os dois inalcançáveis.
  //
  // ⚠️ "Segmento de rota" é pasta com `page` ou `route` em algum ponto abaixo
  // dela: `admin/campos/` é pasta de componentes, não abre URL nenhuma, e
  // reservá-la travaria um lugar chamado "Campos" sem motivo — numa porta, o
  // falso positivo trava o dono de gravar uma verdade.
  it("todo segmento estático de rota é reservado, e não sobra reserva sem rota", () => {
    const abreUrl = (dir: string): boolean =>
      readdirSync(dir, { withFileTypes: true }).some((e) =>
        e.isDirectory() ? abreUrl(path.join(dir, e.name)) : /^(page|route).tsx?$/.test(e.name),
      );
    const estaticos = (dir: string): string[] =>
      readdirSync(path.join(process.cwd(), "src", "app", dir), { withFileTypes: true })
        .filter((e) => e.isDirectory() && !/^[[(@_]/.test(e.name))
        .filter((e) => abreUrl(path.join(process.cwd(), "src", "app", dir, e.name)))
        .map((e) => e.name);
    const rotas = [...new Set([...estaticos(""), ...estaticos("admin"), ...estaticos("contribuir")])];
    expect(rotas, "a premissa: o disco foi lido").toContain("admin");
    expect([...SLUGS_RESERVADOS].sort()).toEqual(rotas.sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("POST — o lugar novo nasce", () => {
  it("201, o slug do nome e da cidade, e o rascunho nasce", async () => {
    const res = await criar(NOME);
    expect(res.status, await res.clone().text()).toBe(201);
    expect(await res.json()).toEqual({ slug: S });
    expect(await lerRascunho(c, S)).not.toBeNull();
    // e não entrou nada no ar
    expect(await versaoAtual(c, S)).toBeNull();
  });

  // 🔴 E3 DA AUDITORIA: o teste do plano lia `lerRascunho(c, "zero")` de um
  // slug que nunca existiu — `null` → `"{}"` → passava com QUALQUER código.
  // Aqui o rascunho nasce PELO CAMINHO REAL, com o acervo inteiro no banco (de
  // onde uma cópia poderia vir), e o documento é medido INTEIRO: só o que o dono
  // disse (o nome — desde 17/10 a cidade só chega com o ponto), a identidade
  // (`slug`) e o `modos: []` da R3.
  it("rascunho novo nasce VAZIO — não herda de lugar nenhum", async () => {
    expect(acervo.length, "a premissa: há lugares no banco de onde copiar").toBeGreaterThan(1);
    const doc = await docDoPost(NOME);
    expect(doc).toEqual({ slug: doc.slug, modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
    for (const campo of CAMPOS_DA_FICHA) {
      const caminho = campo.caminho.replace("[]", ".0");
      if (caminho === "trajeto.waypoints.0.nome") continue;
      expect(lerCaminho(doc, caminho.split(".")), caminho).toBeUndefined();
    }
  });

  // 🔴 17/10 (M2): sem cidade não há endereço — o rascunho nasce numa CHAVE
  // PROVISÓRIA (`rascunho_<hex>`, a de quem usa o app), e o `slug` de dentro do
  // documento é essa chave. Medido pelo corpo da resposta E pelo documento.
  it("POST {nome} nasce numa chave provisória, com o documento exato", async () => {
    const r = await rota.POST(pedido("POST", { nome: NOME }, cookieBom));
    expect(r.status).toBe(201);
    const { slug } = (await r.json()) as { slug: string };
    expect(ehChaveDeRascunho(slug)).toBe(true);
    expect(slug).not.toBe(slugDoNome(NOME));
    expect(JSON.parse((await lerRascunho(c, slug))!.doc)).toEqual({ slug, modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("POST com cidade é 400, nada nasce", async () => {
    expect((await rota.POST(pedido("POST", { nome: NOME, cidade: CIDADE }, cookieBom))).status).toBe(400);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("dois rascunhos do João com o MESMO nome, sem cidade, nascem os dois", async () => {
    const a = await rota.POST(pedido("POST", { nome: NOME }, cookieBom));
    const b = await rota.POST(pedido("POST", { nome: ` ${NOME.toUpperCase()} ` }, cookieBom));
    expect([a.status, b.status]).toEqual([201, 201]);
    const chaves = (await listarRascunhos(c)).map((r) => r.slug);
    expect(chaves).toHaveLength(2);
    expect(new Set(chaves).size).toBe(2);
  });

  // M4: o gêmeo de um LUGAR sem cidade continua recusado na tela do nome, com
  // a frase que pede a cidade DELE — e nada nasce.
  it("o gêmeo de um LUGAR sem cidade continua recusado na tela do nome", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    const nome = alvo.trajeto.waypoints[0].nome;
    const res = await rota.POST(pedido("POST", { nome }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade(nome));
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("a chave provisória nunca é uma tela nem um endereço", () => {
    const k = novaChaveDeRascunho();
    expect(ehChaveDeRascunho(k)).toBe(true);
    expect(SLUGS_RESERVADOS).not.toContain(k);
    expect(slugDoNome(k)).not.toBe(k);
    expect(ehChaveDeRascunho(slugDoNome(NOME))).toBe(false);
    expect(ehChaveDeRascunho("rascunho_" + "g".repeat(32))).toBe(false);
  });

  it("sem cookie: 401, e nada nasce", async () => {
    expect((await criar(NOME, CIDADE, null)).status).toBe(401);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("painel desligado: 404, e nada nasce", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await criar(NOME)).status).toBe(404);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // 🔴 TAREFA 11b — O CASO QUE O JOÃO TROUXE: dois lugares com o MESMO nome em
  // cidades DIFERENTES são dois lugares, e os dois nascem. Era recusado até
  // 04/10 (a colisão por nome da onda 1); a prova foi INVERTIDA, não apagada.
  it("mesmo nome, cidades diferentes: os dois nascem (201, 201), cada um no seu endereço", async () => {
    const um = await criar(NOME, CIDADE);
    const dois = await criar(NOME, OUTRA_CIDADE);
    expect([um.status, dois.status]).toEqual([201, 201]);
    expect(await um.json()).toEqual({ slug: S });
    expect(await dois.json()).toEqual({ slug: "lugar-marcador-um-cidade-marcador-dois" });
    expect((await listarRascunhos(c)).map((r) => r.slug).sort()).toEqual([
      "lugar-marcador-um-cidade-marcador-dois",
      S,
    ]);
  });

  // 🔴 ONDA DE FIX DA 11b (X1): o endereço é SEMPRE o nome e a cidade, um só,
  // inclusive quando o nome já termina com a cidade ou É ela — nenhuma forma
  // encurtada, nenhuma segunda tentativa. Era a forma encurtada que fazia dois
  // nomes DIFERENTES caírem no mesmo endereço (os Mirantes, abaixo).
  it("o endereço é SEMPRE nome + cidade, mesmo quando o nome já termina com ela", async () => {
    for (const [nome, cidade, slug] of [
      ["Mirante de Cidade Marcador", "cidade marcador", "mirante-de-cidade-marcador-cidade-marcador"],
      ["Marcador", "MARCADOR", "marcador-marcador"],
      ["Lugar Supermarcador", "Marcador", "lugar-supermarcador-marcador"],
    ] as const) {
      const res = await criar(nome, cidade);
      expect(res.status, nome).toBe(201);
      expect(await res.json(), nome).toEqual({ slug });
      expect(slug, "a premissa: é o slug do nome e da cidade juntos").toBe(slugDoNome(`${nome} ${cidade}`));
    }
    expect(await lerRascunho(c, "mirante-de-cidade-marcador")).toBeNull();
    expect(await lerRascunho(c, "marcador")).toBeNull();
  });

  // 🔴 ONDA DE FIX DA 11b (X2) — O GÊMEO DE UM LUGAR SEM CIDADE. Os lugares de
  // hoje não têm cidade, e o par só separa dois lugares quando os DOIS têm. Um
  // lugar novo com o mesmo nome de um deles pode ser o mesmo lugar ou outro, e
  // só o dono sabe: a criação é recusada até ele responder a cidade DAQUELE.
  // Até 04/10 este caso nascia (201) — a prova foi INVERTIDA, não apagada.
  it("nome de um lugar no ar SEM cidade: 409 pedindo a cidade DELE, e nada nasce", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    expect(alvo.cidade, "a premissa: os lugares de hoje não têm cidade").toBeUndefined();
    const nome = alvo.trajeto.waypoints[0].nome;
    for (const grafia of [nome, `  ${nome.toUpperCase()}  `]) {
      const res = await criar(grafia, CIDADE);
      expect(res.status, grafia).toBe(409);
      expect(await res.text(), grafia).toBe(gemeoSemCidade(nome));
    }
    expect(await listarRascunhos(c)).toEqual([]);
    expect(await historico(c, alvo.slug)).toHaveLength(1);
  });

  it("nome de um lugar ESCONDIDO sem cidade: 409 pedindo a cidade dele, e ele continua escondido e intacto", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    await esconder(alvo.slug);
    expect((await versoesAtuais(c)).has(alvo.slug), "a premissa: o público não o vê").toBe(false);
    const res = await criar(alvo.trajeto.waypoints[0].nome, CIDADE);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade(alvo.trajeto.waypoints[0].nome));
    expect(await listarRascunhos(c)).toEqual([]);
    const h = await historico(c, alvo.slug);
    expect(h).toHaveLength(2);
    expect(h[0].oculto).toBe(true);
  });

  // 🔴 O CASO QUE A REVISÃO DA 11b ACHOU (I-1): o nome EXATO de um lugar real e,
  // como cidade, a última palavra dele — o gêmeo exato. Com a forma encurtada
  // ele nascia na forma inteira (201), e este caso cravava isso como certo.
  // Agora o endereço dele está livre e só o gêmeo segura: 409.
  it("o gêmeo EXATO de um lugar escondido sem cidade (a cidade = a última palavra do nome): 409", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    await esconder(alvo.slug);
    const ultima = alvo.slug.split("-").pop()!;
    const res = await criar(alvo.trajeto.waypoints[0].nome, ultima);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade(alvo.trajeto.waypoints[0].nome));
    expect(await listarRascunhos(c)).toEqual([]);
    const h = await historico(c, alvo.slug);
    expect(h).toHaveLength(2);
    expect(h[0].oculto).toBe(true);
  });

  // 17/10: rascunho do João sem cidade (o estado normal de todo lugar novo), ou
  // com cidade sem letra nem número (`"--"`, gravada antes de as portas a
  // recusarem), NÃO é gêmeo — só LUGAR é. Era 409 `gemeoSemCidade`, e a frase
  // manda responder uma cidade que não existe mais como pergunta (M3).
  it("nome de um RASCUNHO sem cidade, ou com cidade sem letra: nasce, e o outro não muda", async () => {
    const doc = JSON.stringify({ slug: "marcador-rascunho-antigo", modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
    await salvarRascunho(c, "marcador-rascunho-antigo", doc, AGORA);
    const res = await rota.POST(pedido("POST", { nome: NOME }, cookieBom));
    expect(res.status).toBe(201);
    expect((await lerRascunho(c, "marcador-rascunho-antigo"))!.doc).toBe(doc);

    const tracos = JSON.stringify({ slug: "marcador-rascunho-tracos", modos: [], cidade: "--", trajeto: { waypoints: [{ nome: "Lugar Marcador Nove" }] } });
    await salvarRascunho(c, "marcador-rascunho-tracos", tracos, AGORA);
    const res2 = await rota.POST(pedido("POST", { nome: "Lugar Marcador Nove" }, cookieBom));
    expect(res2.status).toBe(201);
    expect((await listarRascunhos(c)).map((r) => r.slug)).toHaveLength(4);
  });

  it("nome E cidade de um rascunho que já existe: 409, e o primeiro não perde nada", async () => {
    expect((await criar(NOME)).status).toBe(201);
    await salvarRascunho(c, S, JSON.stringify({ ...(await docDe(S)), voz: "o que ele já respondeu" }), AGORA);
    const res = await criar("lugar   marcador UM", " cidade marcador UM ");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeRascunho(`${NOME} (${CIDADE})`));
    expect((await docDe(S)).voz).toBe("o que ele já respondeu");
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual([S]);
  });

  // 🔴 A tela do app NUNCA vira endereço, pela rota de verdade: o nome que É uma
  // tela, na "cidade" de mesmo nome, nasce em `novo-novo` — nunca em `/novo`.
  // (A razão é a do caso "nenhuma tela do app tem hífen", lá em cima.)
  it("nome e cidade que são uma tela do app: nasce em nome-cidade, nunca na tela", async () => {
    for (const nome of ["Novo", "Trilhas", "ADMIN"]) {
      const res = await criar(nome, nome);
      expect(res.status, nome).toBe(201);
      const slug = slugDoNome(nome);
      expect(await res.json(), nome).toEqual({ slug: `${slug}-${slug}` });
      expect(await lerRascunho(c, slug), nome).toBeNull();
    }
  });

  // (A cidade não se digita desde 17/10: a que vem sem letra do Nominatim é o
  // caso "a cidade do reverse sem letra", em "a cidade sai do ponto".)
  it("nome em branco, ou sem letra nem número: 400 com a frase de cada um", async () => {
    for (const [nome, frase] of [
      ["", NOME_VAZIO],
      ["   ", NOME_VAZIO],
      ["!!! ---", NOME_SEM_LETRA],
    ] as const) {
      const res = await criar(nome);
      expect(res.status, nome).toBe(400);
      expect(await res.text(), nome).toBe(frase);
    }
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // Exatamente `{nome}`: chave a mais (uma `cidade`, um `slug` escolhido por
  // fora) ou a menos é corpo malformado.
  it("corpo malformado: 400 sem nada nascer", async () => {
    for (const corpo of [
      null,
      { nome: 7, cidade: CIDADE },
      { nome: NOME, cidade: 7 },
      {},
      { cidade: CIDADE },
      { nome: NOME, cidade: CIDADE },
      { nome: NOME, slug: "outro" },
    ]) {
      expect((await rota.POST(pedido("POST", corpo, cookieBom))).status, JSON.stringify(corpo)).toBe(400);
    }
    expect(await listarRascunhos(c)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("PUT — responder uma pergunta", () => {
  beforeEach(async () => {
    expect((await criar(NOME)).status).toBe(201);
  });

  // M5: antes do ponto não há cidade, e renomear só regrava.
  it("renomear antes do ponto: regrava, a chave não muda, sem CIDADE_VAZIA", async () => {
    const chave = ((await (await rota.POST(pedido("POST", { nome: "Lugar Marcador Seis" }, cookieBom))).json()) as { slug: string }).slug;
    const res = await mudar({ slug: chave, campo: "trajeto.waypoints.0.nome", valor: "Lugar Marcador Sete" });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: chave });
    expect(await docDe(chave)).toEqual({ slug: chave, modos: [], trajeto: { waypoints: [{ nome: "Lugar Marcador Sete" }] } });
    expect((await listarRascunhos(c)).map((r) => r.slug).sort()).toEqual([chave, S].sort());
  });

  it("grava o campo no rascunho, e NADA entra em ficha_versoes", async () => {
    const res = await mudar({ slug: S, campo: "voz", valor: "o chão firma em dois dias" });
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await docDe(S)).voz).toBe("o chão firma em dois dias");
    expect(await versaoAtual(c, S)).toBeNull();
  });

  // O documento continua INCOMPLETO depois de cada resposta: a porta do
  // rascunho não passa pelo `fichaSchema` do documento inteiro, nem pela
  // coerência. Uma resposta numa ficha que ainda não tem `condicao` nem
  // `custo` tem de entrar.
  it("documento incompleto aceita resposta em bloco que ainda não existe", async () => {
    expect((await mudar({ slug: S, campo: "custo.curto", valor: "marcador curto" })).status).toBe(200);
    expect((await mudar({ slug: S, campo: "condicao.regra.limiar_mm", valor: 2 })).status).toBe(200);
    const doc = await docDe(S);
    expect(doc.custo).toEqual({ curto: "marcador curto" });
    expect(doc.condicao).toEqual({ regra: { limiar_mm: 2 } });
  });

  // Rascunho não é ficha, mas cada FOLHA tem o tipo que o schema declara pra
  // ela: o formulário relê o rascunho, e um valor torto não teria instrumento.
  it("folha com valor do tipo errado: 400 com frase, e o rascunho não muda", async () => {
    const antes = (await lerRascunho(c, S))!.doc;
    for (const corpo of [
      { slug: S, campo: "piso", valor: "um chão inventado" },
      { slug: S, campo: "carroComum", valor: "sim" },
      { slug: S, campo: "condicao.regra.limiar_mm", valor: "dois" },
      { slug: S, campo: "condicao.coords", valor: { lat: 200, lng: 0 } },
    ]) {
      const res = await mudar(corpo);
      expect(res.status, JSON.stringify(corpo)).toBe(400);
      expect((await res.text()).length, "a recusa tem de dizer o que houve").toBeGreaterThan(0);
    }
    expect((await lerRascunho(c, S))!.doc).toBe(antes);
  });

  it("caixa vazia não é resposta: 400 com frase", async () => {
    const res = await mudar({ slug: S, campo: "voz", valor: "   " });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/não sei/);
    expect((await docDe(S)).voz).toBeUndefined();
  });

  it("'não sei' tira a resposta de um opcional; obrigatório recusa com frase", async () => {
    expect((await mudar({ slug: S, campo: "piso", valor: "barro" })).status).toBe(200);
    expect((await docDe(S)).piso).toBe("barro");
    expect((await mudar({ slug: S, campo: "piso", naoSei: true })).status).toBe(200);
    expect("piso" in (await docDe(S))).toBe(false);

    expect((await mudar({ slug: S, campo: "voz", valor: "marcador" })).status).toBe(200);
    const res = await mudar({ slug: S, campo: "voz", naoSei: true });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/obrigatório/);
    expect((await docDe(S)).voz).toBe("marcador");
  });

  // 🔴 TAREFA 11c: o horário é a LISTA de faixas, e entra inteiro — também no
  // rascunho. A lista nova substitui a velha; as regras são as da ficha no ar
  // (`problemaDasFaixas`), com a frase chegando à tela.
  it("o horário entra inteiro, em lista, e a lista nova substitui a velha", async () => {
    expect((await mudar({ slug: S, campo: "horario.abre", valor: "05:00" })).status).toBe(400);
    expect((await mudar({ slug: S, campo: "horario", valor: [{ abre: "05:00", fecha: "17:00" }] })).status).toBe(200);
    expect((await docDe(S)).horario).toEqual([{ abre: "05:00", fecha: "17:00" }]);
    const almoco = [
      { abre: "08:00", fecha: "10:00" },
      { abre: "14:00", fecha: "17:00" },
    ];
    expect((await mudar({ slug: S, campo: "horario", valor: almoco })).status).toBe(200);
    expect((await docDe(S)).horario).toEqual(almoco);
    const vazia = await mudar({ slug: S, campo: "horario", valor: [] });
    expect(vazia.status).toBe(400);
    expect(await vazia.text()).toMatch(/não tem/);
    expect((await docDe(S)).horario).toEqual(almoco);
  });

  it("a coordenada do ponto entra INTEIRA, pela forma `ponto` da porta", async () => {
    expect((await mudar({ slug: S, ponto: 0, lat: -8.1, lng: -35.2 })).status).toBe(200);
    expect((await docDe(S)).trajeto).toEqual({ waypoints: [{ nome: NOME, lat: -8.1, lng: -35.2 }] });
    // fora do planeta, ou ponto que o rascunho não tem: recusa, nada muda
    expect((await mudar({ slug: S, ponto: 0, lat: 91, lng: 0 })).status).toBe(400);
    expect((await mudar({ slug: S, ponto: 1, lat: -8, lng: -35 })).status).toBe(400);
    expect((await docDe(S)).trajeto).toEqual({ waypoints: [{ nome: NOME, lat: -8.1, lng: -35.2 }] });
  });

  // 🔴 A LISTA BRANCA do registro: `slug` e `modos` não são perguntas. Trocar o
  // `slug` por aqui faria o rascunho dizer um endereço e morar em outro.
  it("campo fora do registro: 400, e o rascunho não muda", async () => {
    const antes = (await lerRascunho(c, S))!.doc;
    for (const campo of ["slug", "modos", "trajeto", "inventado"]) {
      expect((await mudar({ slug: S, campo, valor: "x" })).status, campo).toBe(400);
    }
    expect((await lerRascunho(c, S))!.doc).toBe(antes);
  });

  // 🔴 E6 + M6: o PUT NUNCA faz um rascunho nascer. Sem esta guarda, um PUT com
  // o slug de um lugar no ar criaria um rascunho por cima dele, pulando a
  // conferência de colisão do POST — e publicar gravaria por cima do lugar.
  it("PUT num slug sem rascunho: 400, nada nasce, e o lugar no ar fica intacto", async () => {
    const alvo = acervo[0];
    const res = await mudar({ slug: alvo.slug, campo: "voz", valor: "marcador por cima" });
    expect(res.status).toBe(400);
    expect(await lerRascunho(c, alvo.slug)).toBeNull();
    expect(await historico(c, alvo.slug)).toHaveLength(1);
  });

  it("corpo misto ou malformado: 400", async () => {
    for (const corpo of [
      { slug: S, campo: "voz" },
      { slug: S, campo: "voz", valor: "a", naoSei: true },
      { slug: S, campo: "piso", naoSei: false },
      { slug: S, campo: "voz", valor: "a", ponto: 0, lat: 1, lng: 1 },
      { slug: S, ponto: "0", lat: 1, lng: 1 },
      { slug: S, ponto: 0, lat: "1", lng: 1 },
      { campo: "voz", valor: "a" },
      null,
    ]) {
      expect((await mudar(corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
  });

  // 🔴 `cidadeDoPonto` não confere a coordenada (Task 1): `1e999` chega do
  // `JSON.parse` como `Infinity`, que é `number`, e a porta o barra ANTES de
  // perguntar ao Nominatim. Corpo cru: o `JSON.stringify` não escreve Infinity.
  it("coordenada que não é finita: 400, e o Nominatim não é consultado", async () => {
    const antes = (await lerRascunho(c, S))!.doc;
    nominatimDeTeste.pontos.length = 0;
    for (const corpo of [`{"slug":"${S}","ponto":0,"lat":1e999,"lng":-35}`, `{"slug":"${S}","ponto":0,"lat":-8,"lng":-1e999}`]) {
      const res = await rota.PUT(
        new Request("http://x/api/admin/rascunho", { method: "PUT", headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` }, body: corpo }),
      );
      expect(res.status, corpo).toBe(400);
    }
    expect(nominatimDeTeste.pontos).toEqual([]);
    expect((await lerRascunho(c, S))!.doc).toBe(antes);
  });

  it("sem cookie: 401, e o rascunho não muda", async () => {
    const antes = (await lerRascunho(c, S))!.doc;
    expect((await mudar({ slug: S, campo: "voz", valor: "x" }, null)).status).toBe(401);
    expect((await lerRascunho(c, S))!.doc).toBe(antes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 TAREFA 11b — O QUE COLIDE É O PAR (NOME, CIDADE), POR DADO, E O ENDEREÇO.
//
// A colisão por NOME da onda de conserto 1 saiu inteira: o João decidiu (04/10)
// que dois lugares podem ter o mesmo nome — "a Pedra do Navio existe uma em
// Bom Jardim e outra em Floresta". O que continua sendo o MESMO lugar é o par:
// mesmo nome E mesma cidade (pela normalização do endereço, `slugDoNome`),
// lido do DADO de cada lugar — no ar ou escondido — e de cada rascunho (11b-I4).
// Sem o par, o gêmeo de um lugar cujo endereço não sai do nome (há um no
// acervo: o endereço dele tem uma palavra que o nome não tem) nasceria sem
// aviso. E contra um lugar SEM cidade o par não decide nada: o gêmeo espera a
// cidade dele (X2 da onda de fix).
//
// Cada caso prova UMA porta sozinha: o par que bate com endereço diferente (a
// porta do par), e o endereço que bate com nome diferente (a porta do slug) —
// com as duas batendo juntas, arrancar uma delas sobreviveria (espécie 47).
// ═══════════════════════════════════════════════════════════════════════════

/** Um lugar marcador no banco, com endereço, nome e cidade escolhidos separados.
 *  O resto do documento é o de um lugar do acervo — só pra ser uma ficha
 *  inteira; nada dele é lido aqui além do nome do ponto `0` e da cidade.
 *  `cidade` ausente = o lugar não tem cidade (como os de hoje). */
async function lugarMarcador(slug: string, nome: string, cidade?: string, oculto = false): Promise<void> {
  const base = acervo[0];
  const [primeiro, ...resto] = base.trajeto.waypoints;
  const doc = {
    ...base,
    slug,
    ...(cidade === undefined ? {} : { cidade }),
    trajeto: { ...base.trajeto, waypoints: [{ ...primeiro, nome }, ...resto] },
  };
  await gravarVersao(c, slug, JSON.stringify(doc), "painel", AGORA, oculto);
}

describe("o PAR (nome, cidade) colide, e o endereço também (Tarefa 11b)", () => {
  const OUTRO_SLUG = "marcador-endereco-que-nao-sai-do-nome";
  const OUTRO_NOME = "Lugar Marcador Dois";

  it("POST com nome e cidade de um lugar no ar cujo endereço é outro: 409 com o nome e a cidade DELE", async () => {
    await lugarMarcador(OUTRO_SLUG, OUTRO_NOME, CIDADE);
    for (const [nome, cidade] of [
      [OUTRO_NOME, CIDADE],
      ["  lugar   MARCADOR dóis ", "cidade marcador úm"],
    ]) {
      const res = await criar(nome, cidade);
      expect(res.status, nome).toBe(409);
      expect(await res.text(), nome).toBe(parDeLugar(`${OUTRO_NOME} (${CIDADE})`));
    }
    expect(await listarRascunhos(c)).toEqual([]);
    expect(await historico(c, OUTRO_SLUG)).toHaveLength(1);
  });

  it("o mesmo nome, em OUTRA cidade: nasce — um lugar no ar e um ESCONDIDO de mesmo nome não travam", async () => {
    await lugarMarcador(OUTRO_SLUG, OUTRO_NOME, CIDADE);
    await lugarMarcador("marcador-escondido-de-mesmo-nome", OUTRO_NOME, "Cidade Marcador Tres", true);
    const res = await criar(OUTRO_NOME, OUTRA_CIDADE);
    expect(res.status, await res.clone().text()).toBe(201);
    expect(await res.json()).toEqual({ slug: "lugar-marcador-dois-cidade-marcador-dois" });
  });

  it("POST com nome e cidade de um lugar ESCONDIDO: 409, e ele continua escondido", async () => {
    await lugarMarcador(OUTRO_SLUG, OUTRO_NOME, CIDADE);
    await esconder(OUTRO_SLUG);
    expect((await versoesAtuais(c)).has(OUTRO_SLUG), "a premissa: o público não o vê").toBe(false);
    const res = await criar(OUTRO_NOME, CIDADE);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(`${OUTRO_NOME} (${CIDADE})`));
    expect(await listarRascunhos(c)).toEqual([]);
    const h = await historico(c, OUTRO_SLUG);
    expect(h).toHaveLength(2);
    expect(h[0].oculto).toBe(true);
  });

  // 🔴 11b-I4, COM O LUGAR REAL DO ACERVO cujo endereço não sai do nome. Sem
  // cidade nele (como está no ar), o gêmeo espera a cidade DELE (X2 da onda de
  // fix — até 04/10 nascia). Com uma cidade gravada NELE (marcador, só neste
  // banco de teste — nunca na ficha real), o par decide: na mesma cidade 409, em
  // outra nasce. É a mesma conferência, e a espera some sozinha quando ele
  // responde a cidade.
  it("o gêmeo de um lugar do acervo cujo endereço não sai do nome: espera a cidade dele, e depois o par decide", async () => {
    const real = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) !== f.slug);
    expect(real, "a premissa: um lugar do acervo tem endereço que não sai do nome").toBeDefined();
    const nome = real!.trajeto.waypoints[0].nome;
    expect(real!.cidade, "a premissa: nenhum lugar de hoje tem cidade").toBeUndefined();

    // sem cidade nele: 409 pedindo a cidade dele
    const espera = await criar(nome, CIDADE);
    expect(espera.status).toBe(409);
    expect(await espera.text()).toBe(gemeoSemCidade(nome));
    expect(await listarRascunhos(c)).toEqual([]);

    // com a cidade-marcador gravada nele: o par colide na mesma cidade…
    await gravarVersao(c, real!.slug, JSON.stringify({ ...real, cidade: CIDADE }), "painel", AGORA);
    const res = await criar(nome, CIDADE);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(`${nome} (${CIDADE})`));
    expect(await listarRascunhos(c)).toEqual([]);
    // …e em outra, nasce
    const outro = await criar(nome, OUTRA_CIDADE);
    expect(outro.status, await outro.clone().text()).toBe(201);
  });

  // 🔴 A PORTA DO ENDEREÇO, SOZINHA: nome DIFERENTE, mesmo endereço. A frase
  // nomeia quem JÁ OCUPA (o nome e a cidade DELE, lidos do dado) e nunca diz que
  // o nome digitado é igual — porque não é (11b-I5).
  it("a porta do endereço continua sozinha: slug igual com NOME diferente, 409 nomeando quem ocupa", async () => {
    await lugarMarcador(S, "Nome Marcador Diferente", OUTRA_CIDADE);
    const res = await criar(NOME, CIDADE);
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(enderecoDeLugar(`Nome Marcador Diferente (${OUTRA_CIDADE})`));
    expect(frase, "a frase repetiu o nome digitado, como se fosse igual").not.toContain(NOME);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // Um rascunho mora sempre no endereço do nome e da cidade de AGORA (onda de
  // fix 2 da 11b), então dois RASCUNHOS de pares diferentes só caem no mesmo
  // endereço quando a fronteira entre o nome e a cidade anda: "Lugar Marcador"
  // em "Cidade Marcador" e "Lugar Marcador Cidade" em "Marcador". (Um lugar NO
  // AR guarda o endereço com que nasceu — ver os casos de lugar acima.)
  it("endereço ocupado por um RASCUNHO de nome diferente: 409 com a frase do rascunho", async () => {
    expect((await criar("Lugar Marcador", "Cidade Marcador")).status).toBe(201);
    const res = await criar("Lugar Marcador Cidade", "Marcador");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeRascunho("Lugar Marcador (Cidade Marcador)"));
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual(["lugar-marcador-cidade-marcador"]);
  });

  // 🔴 11b-I5 e I-2 DA REVISÃO: "Mirante" e "Mirante <cidade>", na mesma cidade,
  // são dois lugares e os dois nascem — NAS DUAS ORDENS. Com a forma encurtada,
  // a ordem B (o longo primeiro) recusava o segundo e mandava o dono mudar o
  // nome real dele.
  it("os dois Mirantes nascem nas duas ordens, cada um no seu endereço", async () => {
    // ordem A: o curto primeiro
    const a1 = await criar("Mirante", "Cidade Marcador");
    const a2 = await criar("Mirante Cidade Marcador", "Cidade Marcador");
    expect([a1.status, a2.status], await a2.clone().text()).toEqual([201, 201]);
    expect(await a1.json()).toEqual({ slug: "mirante-cidade-marcador" });
    expect(await a2.json()).toEqual({ slug: "mirante-cidade-marcador-cidade-marcador" });
    // ordem B: o longo primeiro (a do contraexemplo da auditoria)
    const b1 = await criar("Mirante Cidade Marcador Seis", "Cidade Marcador Seis");
    const b2 = await criar("Mirante", "Cidade Marcador Seis");
    expect([b1.status, b2.status], await b2.clone().text()).toEqual([201, 201]);
    expect(await b1.json()).toEqual({ slug: "mirante-cidade-marcador-seis-cidade-marcador-seis" });
    expect(await b2.json()).toEqual({ slug: "mirante-cidade-marcador-seis" });
  });

  // E quem ocupa SEM cidade (como os lugares de hoje) é nomeado só pelo nome —
  // nenhum parêntese vazio, nenhum "sem cidade".
  it("endereço ocupado por um lugar SEM cidade, de nome diferente: 409 nomeando-o só pelo nome", async () => {
    await lugarMarcador("lugar-marcador-tres-tres", "Nome Marcador A");
    const res = await criar("Lugar Marcador Tres", "Tres");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeLugar("Nome Marcador A"));
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // 🔴 F2 — O LUGAR NASCIDO ESCONDIDO: a única versão dele foi gravada com
  // `oculto`. Fecha a M16′ (`NOT EXISTS … AND oculto <> 1`): sem versão visível
  // nenhuma no histórico, aquele filtro não acharia o lugar.
  it("lugar NASCIDO escondido: o endereço e o par colidem os dois, e ele continua intacto", async () => {
    await lugarMarcador(S, "Nome Marcador Escondido", OUTRA_CIDADE, true);
    await lugarMarcador("marcador-par-escondido", "Marcador Nascido Escondido", CIDADE, true);
    const h0 = await historico(c, S);
    expect(h0.map((v) => v.oculto), "a premissa: nenhuma versão visível").toEqual([true]);
    const peloEndereco = await criar(NOME, CIDADE);
    expect(peloEndereco.status).toBe(409);
    expect(await peloEndereco.text()).toBe(enderecoDeLugar(`Nome Marcador Escondido (${OUTRA_CIDADE})`));
    const peloPar = await criar("Marcador Nascido Escondido", CIDADE);
    expect(peloPar.status).toBe(409);
    expect(await peloPar.text()).toBe(parDeLugar(`Marcador Nascido Escondido (${CIDADE})`));
    expect(await listarRascunhos(c)).toEqual([]);
    expect(await historico(c, S)).toEqual(h0);
  });

  it("POST com o nome que OUTRO rascunho tem agora, na cidade dele: 409 do rascunho; o nome que ele largou nasce", async () => {
    expect((await criar(NOME)).status).toBe(201);
    const ren = await mudar({ slug: S, campo: "trajeto.waypoints.0.nome", valor: "Nome Marcador Novo" });
    expect(ren.status).toBe(200);
    expect(await ren.json()).toEqual({ slug: "nome-marcador-novo-cidade-marcador-um" });
    const res = await criar("Nome Marcador Novo", CIDADE);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeRascunho(`Nome Marcador Novo (${CIDADE})`));
    // 🔴 I-N2 DA RE-REVISÃO: o nome de ANTES, que ele largou, não colide por
    // par NEM por endereço — o rascunho levou o endereço junto com o nome.
    // Até a onda de fix 2 isto era 409 mandando "mudar um pouco o nome".
    const antigo = await criar(NOME, CIDADE);
    expect(antigo.status, await antigo.clone().text()).toBe(201);
    expect(await antigo.json()).toEqual({ slug: S });
    expect((await listarRascunhos(c)).map((r) => r.slug).sort()).toEqual([
      S,
      "nome-marcador-novo-cidade-marcador-um",
    ]);
  });

  // 🔴 Y2 DA ONDA DE FIX 2, O CENÁRIO DO BRIEF: ele começa um lugar numa cidade,
  // percebe que era outra e corrige. O rascunho passa a morar no endereço da
  // cidade certa (o documento diz o mesmo endereço), e o lugar da primeira
  // cidade — outro lugar, de mesmo nome — nasce depois. Desde 17/10 corrigir a
  // cidade é corrigir o PONTO (§2.3): o ponto novo cai em Cidade Marcador Dois.
  it("corrigir o ponto pra outra cidade: a chave anda pro nome-cidade novo, e o de Um nasce depois", async () => {
    expect((await criar(NOME, CIDADE)).status).toBe(201);
    const res = await marcarPonto(S, OUTRA_CIDADE);
    expect(res.status, await res.clone().text()).toBe(200);
    const novo = "lugar-marcador-um-cidade-marcador-dois";
    expect(await res.json()).toEqual({ slug: novo });
    expect(await lerRascunho(c, S), "o endereço velho ficou").toBeNull();
    const doc = await docDe(novo);
    expect(doc.slug, "o documento ficou com o endereço velho").toBe(novo);
    expect(doc.cidade).toBe(OUTRA_CIDADE);
    expect(await versaoAtual(c, novo), "o rascunho foi parar no ar").toBeNull();

    const depois = await criar(NOME, CIDADE);
    expect(depois.status, await depois.clone().text()).toBe(201);
    expect(await depois.json()).toEqual({ slug: S });
    expect((await listarRascunhos(c)).map((r) => r.slug).sort()).toEqual([S, novo].sort());
  });

  // O endereço novo já é de OUTRO (um par diferente que cai no mesmo endereço,
  // pela fronteira que anda): 409 com a frase de quem ocupa, e o rascunho fica
  // onde estava, intacto. Contra um RASCUNHO e contra um lugar NO AR.
  it("mudar nome ou cidade pra um endereço que já é de outro: 409 nomeando quem ocupa, e o rascunho não sai do lugar", async () => {
    expect((await criar(NOME, CIDADE)).status).toBe(201);
    const marcador = "lugar-marcador-um-marcador";
    const r1 = await marcarPonto(S, "Marcador");
    expect(await r1.json()).toEqual({ slug: marcador });

    // contra um RASCUNHO: "Lugar Marcador" em "Cidade Marcador"
    expect((await criar("Lugar Marcador", "Cidade Marcador")).status).toBe(201);
    const antes = (await lerRascunho(c, marcador))!.doc;
    const res = await mudar({ slug: marcador, campo: "trajeto.waypoints.0.nome", valor: "Lugar Marcador Cidade" });
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeRascunho("Lugar Marcador (Cidade Marcador)"));
    expect((await lerRascunho(c, marcador))!.doc).toBe(antes);

    // contra um lugar NO AR, de outro par, no endereço que sairia
    await lugarMarcador("lugar-marcador-dois-marcador", "Nome Marcador Diferente", OUTRA_CIDADE);
    const res2 = await mudar({ slug: marcador, campo: "trajeto.waypoints.0.nome", valor: "Lugar Marcador Dois" });
    expect(res2.status).toBe(409);
    expect(await res2.text()).toBe(enderecoDeLugar(`Nome Marcador Diferente (${OUTRA_CIDADE})`));
    expect((await lerRascunho(c, marcador))!.doc).toBe(antes);
    expect((await listarRascunhos(c)).map((r) => r.slug).sort()).toEqual(
      ["lugar-marcador-cidade-marcador", marcador].sort(),
    );
    expect(await historico(c, "lugar-marcador-dois-marcador")).toHaveLength(1);
  });

  // O endereço precisa de letra nas duas metades — é o que garante o hífen que
  // nunca deixa um lugar cair numa tela do app. Renomear o rascunho pra um nome
  // sem letra é recusado com a frase do POST; e um rascunho sem cidade (o estado
  // normal desde 17/10) renomeia sem pedir cidade (M5): só regrava, a chave e o
  // `slug` de dentro ficam.
  it("renomear o rascunho pra nome sem letra: 400 com a frase do POST; renomear antes do ponto regrava, sem CIDADE_VAZIA", async () => {
    expect((await criar(NOME, CIDADE)).status).toBe(201);
    const antes = (await lerRascunho(c, S))!.doc;
    for (const valor of ["--", " ... "]) {
      const res = await mudar({ slug: S, campo: "trajeto.waypoints.0.nome", valor });
      expect(res.status, valor).toBe(400);
      expect(await res.text(), valor).toBe(NOME_SEM_LETRA);
    }
    expect((await lerRascunho(c, S))!.doc).toBe(antes);

    const sem = (await (await rota.POST(pedido("POST", { nome: "Novo" }, cookieBom))).json()).slug as string;
    expect(ehChaveDeRascunho(sem), "a premissa: nasceu sem cidade, na chave provisória").toBe(true);
    const res = await mudar({ slug: sem, campo: "trajeto.waypoints.0.nome", valor: "Admin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: sem });
    expect(await docDe(sem)).toEqual({ slug: sem, modos: [], trajeto: { waypoints: [{ nome: "Admin" }] } });
    expect(await lerRascunho(c, "admin")).toBeNull();
    // e nome sem letra continua recusado antes do ponto
    const semLetra = await mudar({ slug: sem, campo: "trajeto.waypoints.0.nome", valor: "--" });
    expect(semLetra.status).toBe(400);
    expect(await semLetra.text()).toBe(NOME_SEM_LETRA);
  });

  // 🔴 CIDADE SEM LETRA NO RENOMEAR (prova-que-trava, revisão final de 18/10):
  // trocar `cidade !== undefined && slugDoNome(cidade) !== ""` por só
  // `cidade !== undefined` sobrevivia à suíte inteira. Só DADO ANTIGO chega
  // assim — um rascunho gravado antes de as portas recusarem cidade sem letra;
  // hoje a cidade só entra pelo ponto, e o ponto sem letra é 503. Sem a metade
  // de letra, o "destino" seria `slugDoNome("Novo --")` = "novo", um endereço
  // RESERVADO, e o rascunho se mudaria pra lá.
  it("rascunho antigo com cidade sem letra: renomear só regrava, a chave não anda, nada nasce em 'novo'", async () => {
    const chave = novaChaveDeRascunho();
    await salvarRascunho(c, chave, JSON.stringify({ slug: chave, modos: [], cidade: "--", trajeto: { waypoints: [{ nome: "Lugar Marcador Antigo" }] } }), AGORA);
    expect(SLUGS_RESERVADOS, "a premissa: 'novo' é reservado").toContain(slugDoNome("Novo"));
    const res = await mudar({ slug: chave, campo: "trajeto.waypoints.0.nome", valor: "Novo" });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ slug: chave });
    expect(await docDe(chave)).toEqual({ slug: chave, modos: [], cidade: "--", trajeto: { waypoints: [{ nome: "Novo" }] } });
    expect(await lerRascunho(c, slugDoNome("Novo"))).toBeNull();
  });

  // 🔴 11b-M3: renomear um rascunho passa pelo MESMO par (409). Mudar a cidade
  // é marcar o ponto (17/10), e a colisão ali é a saída (b) ("a cidade sai do
  // ponto"). E o endereço do rascunho ACOMPANHA os dois (onda de fix 2, Y2):
  // ainda não há link circulando, e o endereço velho seria o de um par que não
  // é o dele.
  describe("PUT do nome e da cidade do rascunho", () => {
    const CAMPO_NOME = "trajeto.waypoints.0.nome";
    beforeEach(async () => {
      expect((await criar(NOME)).status).toBe(201);
    });

    it("renomear pro nome de um lugar no ar NA MESMA cidade: 409, o rascunho não muda", async () => {
      await lugarMarcador(OUTRO_SLUG, OUTRO_NOME, CIDADE);
      const antes = (await lerRascunho(c, S))!.doc;
      const res = await mudar({ slug: S, campo: CAMPO_NOME, valor: "lugar marcador DOIS" });
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(parDeLugar(`${OUTRO_NOME} (${CIDADE})`));
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
    });

    it("renomear pro nome de um lugar NASCIDO escondido, na mesma cidade: 409", async () => {
      await lugarMarcador("lugar-marcador-escondido", "Marcador Nascido Escondido", CIDADE, true);
      const antes = (await lerRascunho(c, S))!.doc;
      const res = await mudar({ slug: S, campo: CAMPO_NOME, valor: "Marcador Nascido Escondido" });
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(parDeLugar(`Marcador Nascido Escondido (${CIDADE})`));
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
    });

    it("renomear pro nome de OUTRO rascunho, na mesma cidade: 409 do rascunho", async () => {
      expect((await criar("Lugar Marcador Quatro")).status).toBe(201);
      const antes = (await lerRascunho(c, S))!.doc;
      const res = await mudar({ slug: S, campo: CAMPO_NOME, valor: "LUGAR MARCADOR QUATRO" });
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(parDeRascunho(`Lugar Marcador Quatro (${CIDADE})`));
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
    });

    // A inversão da onda 1: o nome de um lugar no ar, em OUTRA cidade, é livre.
    // 🔴 O PRÓPRIO par, noutra grafia, vem PRIMEIRO de propósito: é o caso
    // que só passa porque o rascunho não colide com ele mesmo (`exceto`). Com
    // outro nome já gravado antes, o rascunho não bateria consigo e o caso
    // ficaria verde sem o `exceto` (medido: a mutação sobreviveu assim).
    // 🔴 E O ENDEREÇO ACOMPANHA (onda de fix 2, Y2): cada resposta devolve o
    // endereço de AGORA — o mesmo quando o nome e a cidade normalizam igual, o
    // do par novo quando mudam —, e o rascunho é um só o tempo todo.
    it("renomear pro PRÓPRIO nome, pro de um lugar de OUTRA cidade, ou pra um livre: 200, e o endereço acompanha", async () => {
      await lugarMarcador(OUTRO_SLUG, OUTRO_NOME, OUTRA_CIDADE);
      let aqui = S;
      // `"ponto"`: o ponto 0 de novo, caindo na cidade `valor` (17/10: a cidade
      // sai do ponto).
      const passo = async (campo: string, valor: string, esperado: string) => {
        const res = campo === "ponto" ? await marcarPonto(aqui, valor) : await mudar({ slug: aqui, campo, valor });
        expect(res.status, `${campo}=${valor}: ${await res.clone().text()}`).toBe(200);
        expect(await res.json(), `${campo}=${valor}`).toEqual({ slug: esperado });
        aqui = esperado;
        expect((await listarRascunhos(c)).map((r) => r.slug), `${campo}=${valor}`).toEqual([esperado]);
        expect((await docDe(esperado)).slug, `${campo}=${valor}`).toBe(esperado);
      };
      await passo("ponto", "CIDADE marcador um", S);
      await passo(CAMPO_NOME, "Lugar Marcador UM", S);
      await passo(CAMPO_NOME, OUTRO_NOME, "lugar-marcador-dois-cidade-marcador-um");
      await passo(CAMPO_NOME, "Nome Marcador Livre", "nome-marcador-livre-cidade-marcador-um");
      expect(((await docDe(aqui)).trajeto as { waypoints: { nome: string }[] }).waypoints[0].nome).toBe(
        "Nome Marcador Livre",
      );
      await passo("ponto", "Cidade Marcador Cinco", "nome-marcador-livre-cidade-marcador-cinco");
      expect((await docDe(aqui)).cidade).toBe("Cidade Marcador Cinco");
    });

    // 🔴 17/10: a cidade SAI DO PONTO, e não é campo desta porta — nem valor,
    // nem "não sei", nem vazia. 400 MUDO (como todo campo que a tela não
    // pergunta), e nada grava. (Até 17/10 o "não sei" daqui era 400 com
    // `CIDADE_VAZIA`, e o "--" com `CIDADE_SEM_LETRA`: as duas frases ficam pra
    // ficha no ar, onde a cidade ainda se corrige à mão.)
    it("PUT do campo cidade é 400, nada gravado", async () => {
      const antes = (await lerRascunho(c, S))!.doc;
      for (const corpo of [
        { slug: S, campo: "cidade", valor: OUTRA_CIDADE },
        { slug: S, campo: "cidade", valor: "--" },
        { slug: S, campo: "cidade", valor: "" },
        { slug: S, campo: "cidade", naoSei: true },
      ]) {
        const res = await mudar(corpo);
        expect(res.status, JSON.stringify(corpo)).toBe(400);
        expect(await res.text(), JSON.stringify(corpo)).toBe("");
      }
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
      expect(await listarRascunhos(c)).toHaveLength(1);
    });

    // 🔴 X2 no PUT: renomear o rascunho pro nome de um lugar SEM cidade espera a
    // cidade dele, como o POST.
    it("renomear pro nome de um lugar SEM cidade: 409 pedindo a cidade dele, o rascunho não muda", async () => {
      await lugarMarcador(OUTRO_SLUG, OUTRO_NOME);
      const antes = (await lerRascunho(c, S))!.doc;
      const res = await mudar({ slug: S, campo: CAMPO_NOME, valor: "LUGAR marcador dois" });
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(gemeoSemCidade(OUTRO_NOME));
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
    });

    // 🔴 I-N1 DA RE-REVISÃO (Y1 da onda de fix 2): a espera do gêmeo é de quando
    // o NOME nasce ou muda. Responder a CIDADE (desde 17/10, marcar o ponto)
    // nunca esbarra nela — só no par —,
    // nem reescrever o mesmo nome noutra grafia. Aqui o estado de antes (um lugar
    // de mesmo nome e sem cidade, gravado direto no banco) já existe, e o
    // rascunho ainda recebe a cidade e a grafia nova.
    it("com um gêmeo SEM cidade já no banco: mudar a cidade, e o nome noutra grafia, passam (200)", async () => {
      await lugarMarcador(OUTRO_SLUG, NOME);
      const r1 = await marcarPonto(S, OUTRA_CIDADE);
      expect(r1.status, await r1.clone().text()).toBe(200);
      const aqui = ((await r1.json()) as { slug: string }).slug;
      expect((await docDe(aqui)).cidade).toBe(OUTRA_CIDADE);
      const r2 = await mudar({ slug: aqui, campo: CAMPO_NOME, valor: "LUGAR marcador UM" });
      expect(r2.status, await r2.clone().text()).toBe(200);
      // e o nome que MUDA, esse sim, espera
      const r3 = await mudar({ slug: aqui, campo: CAMPO_NOME, valor: "Nome Marcador Outro" });
      expect(r3.status).toBe(200);
      const aqui2 = ((await r3.json()) as { slug: string }).slug;
      const r4 = await mudar({ slug: aqui2, campo: CAMPO_NOME, valor: NOME });
      expect(r4.status).toBe(409);
      expect(await r4.text()).toBe(gemeoSemCidade(NOME));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 17/10 — A CIDADE SAI DO PONTO. Gravar o ponto 0 pergunta ao
// Nominatim (aqui, o dublê) o município dele; não saiu, 503 e nada grava. Saiu:
// o ponto e a cidade GRAVAM SEMPRE, e o rascunho se muda pro `nome-cidade`
// quando o par e o endereço estão livres — senão FICA numa chave provisória
// (a saída (b) do João, spec §2.3.0), e o publicar trava. A invariante que
// cada caso mede: a chave de um rascunho do painel é o `nome-cidade` do
// documento, ou uma chave provisória.
describe("a cidade sai do ponto", () => {
  it("o ponto grava a cidade do reverse e o rascunho se muda pro nome-cidade", async () => {
    const k = await nascer(NOME);
    const r = await mudar({ slug: k, ponto: 0, lat: -8.1, lng: -35.2 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ slug: S });
    expect(await lerRascunho(c, k)).toBeNull();
    expect(await docDe(S)).toMatchObject({ slug: S, cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME, lat: -8.1, lng: -35.2 }] } });
    expect(nominatimDeTeste.pontos).toEqual([{ lat: -8.1, lng: -35.2 }]);
  });

  it.each(["fora", "limite", "sem-municipio"])("cidade que não sai (%s): 503 com a frase, NADA gravado", async (falha) => {
    const k = await nascer(NOME);
    nominatimDeTeste.ponto = { falha };
    const antes = await lerRascunho(c, k);
    const r = await mudar({ slug: k, ponto: 0, lat: -8.1, lng: -35.2 });
    expect([r.status, await r.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
    expect(await lerRascunho(c, k)).toEqual(antes);
    expect(await listarRascunhos(c)).toHaveLength(1);
  });

  // Uma cidade sem letra nem número não faria endereço (o hífen do meio). O
  // `municipioDaResposta` só devolve texto com conteúdo, mas "--" é conteúdo:
  // é a mesma recusa da cidade que não saiu.
  it("a cidade do reverse sem letra nem número: 503 com a frase, NADA gravado", async () => {
    const k = await nascer(NOME);
    const antes = await lerRascunho(c, k);
    const r = await marcarPonto(k, "--");
    expect([r.status, await r.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
    expect(await lerRascunho(c, k)).toEqual(antes);
  });

  // M5: o lugar de MESMO par mora num endereço que NÃO é `S` (o do nome
  // sozinho), então `S` está LIVRE — só a regra "colidiu, nem tenta o
  // nome-cidade" deixa o rascunho na provisória.
  it("§2.3.0 colisão no ponto: o PONTO e a CIDADE gravam, na chave provisória", async () => {
    await lugarMarcador(slugDoNome(NOME), NOME, CIDADE);
    expect(await versaoAtual(c, S), "a premissa: S está livre").toBeNull();
    const k = await nascer(NOME);
    const r = await marcarPonto(k);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ slug: k });
    expect(await docDe(k)).toMatchObject({ slug: k, cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME, lat: LAT, lng: LNG }] } });
    expect(await lerRascunho(c, S), "o rascunho foi pro nome-cidade de um par que é de outro").toBeNull();
    expect(await travaDoPainel((await lerRascunho(c, k))!.doc, k)).toBe(parDeLugar(`${NOME} (${CIDADE})`));
  });

  // A outra metade da saída (b): o publicar recusa a chave provisória, com a
  // frase do que impede, e nada vai ao ar.
  it("§2.3.0 colisão no ponto: e o PUBLICAR trava", async () => {
    await lugarMarcador(slugDoNome(NOME), NOME, CIDADE);
    const k = await nascer(NOME);
    expect((await marcarPonto(k)).status).toBe(200);
    const doPonto = await docDe(k);
    await salvarRascunho(
      c,
      k,
      JSON.stringify({ ...rascunhoCompleto(k, NOME, CIDADE), trajeto: doPonto.trajeto, cidade: doPonto.cidade, slug: k }),
      AGORA,
    );
    const atualizadoEm = (await lerRascunho(c, k))!.atualizado_em;
    const publicar = await import("@/app/api/admin/publicar/route");
    const res = await publicar.POST(
      new Request("http://x/api/admin/publicar", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: JSON.stringify({ slug: k, atualizadoEm }),
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(parDeLugar(`${NOME} (${CIDADE})`));
    expect(await historico(c, k)).toEqual([]);
    expect(await historico(c, S)).toEqual([]);
    expect((await lerRascunho(c, k))?.atualizado_em).toBe(atualizadoEm);
  });

  // A fronteira entre o nome e a cidade que anda: o par é OUTRO, e o endereço
  // que sairia já é de um lugar. `moverRascunho` recusa, e o rascunho fica.
  it("endereço de um lugar de OUTRO par (a fronteira): o ponto grava e fica na provisória", async () => {
    await lugarMarcador(S, "Lugar Marcador Um Cidade", "Marcador Um");
    const h0 = await historico(c, S);
    const k = await nascer(NOME);
    const r = await marcarPonto(k);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ slug: k });
    expect((await docDe(k)).cidade).toBe(CIDADE);
    expect(await travaDoPainel((await lerRascunho(c, k))!.doc, k)).toBe(enderecoDeLugar("Lugar Marcador Um Cidade (Marcador Um)"));
    expect(await historico(c, S)).toEqual(h0);
  });

  // `travaDoPainel` é a MESMA régua do ponto (`nomeNovo: false`): o gêmeo sem
  // cidade é da tela do nome (§2.3.1) e não impede o rascunho de morar no
  // `nome-cidade`. Com `nomeNovo: true` ali, a frase da chave provisória
  // (no publicar) acusaria uma trava que o ponto não vê — e o ponto, de fato,
  // leva o rascunho ao endereço. (O rascunho é gravado cru: o POST, esse sim,
  // espera a cidade do gêmeo.) Medido: a régua trocada sobrevivia a toda a suíte.
  it("a trava é a régua do ponto: o gêmeo sem cidade não trava, e o ponto leva ao nome-cidade", async () => {
    await lugarMarcador("marcador-gemeo-sem-cidade", NOME);
    const k = novaChaveDeRascunho();
    const doc = JSON.stringify({ slug: k, modos: [], cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME, lat: LAT, lng: LNG }] } });
    await salvarRascunho(c, k, doc, AGORA - 10);
    expect(await travaDoPainel(doc, k)).toBeNull();
    const r = await marcarPonto(k);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ slug: S });
  });

  // E o rascunho que JÁ mora no `nome-cidade` não é trava de si mesmo: o
  // endereço é dele (`lerRascunho(S)` acha ELE). O publicar só pergunta a trava
  // fora do `nome-cidade`, mas a função promete `null` quando nada impede — e
  // quem a mostrar na tela do rascunho (Task 4) a chama em qualquer chave.
  // Medido: sem o `destino === slug`, a suíte inteira passava.
  it("o rascunho no próprio nome-cidade não trava a si mesmo", async () => {
    expect((await criar(NOME)).status).toBe(201);
    expect(await travaDoPainel((await lerRascunho(c, S))!.doc, S)).toBeNull();
  });

  // M6: o rascunho já morava no `nome-cidade` (S), e o ponto corrigido cai numa
  // cidade onde o par é de outro. Ficar em S deixaria a chave dizendo a cidade
  // velha: ele vai pra uma provisória NOVA — e não pro nome-cidade novo.
  it("corrigir o ponto pra uma cidade onde o par colide: sai do nome-cidade velho pra uma provisória", async () => {
    expect((await criar(NOME)).status).toBe(201);
    await lugarMarcador("marcador-par-noutra-cidade", NOME, OUTRA_CIDADE);
    const r = await marcarPonto(S, OUTRA_CIDADE);
    expect(r.status, await r.clone().text()).toBe(200);
    const { slug: nova } = (await r.json()) as { slug: string };
    expect(ehChaveDeRascunho(nova), nova).toBe(true);
    expect(await lerRascunho(c, S)).toBeNull();
    expect(await lerRascunho(c, "lugar-marcador-um-cidade-marcador-dois")).toBeNull();
    expect(await docDe(nova)).toMatchObject({ slug: nova, cidade: OUTRA_CIDADE });
    expect(await listarRascunhos(c)).toHaveLength(1);
  });

  // §2.3.2: o rascunho nascido do jeito antigo (cidade digitada, chave
  // nome-cidade). Gravar o ponto refaz a cidade, e a chave anda junto.
  it("§2.3.2 rascunho antigo (cidade digitada, chave nome-cidade): o ponto refaz a cidade", async () => {
    const velho = "lugar-marcador-um-cidade-marcador-velha";
    await salvarRascunho(c, velho, JSON.stringify({ slug: velho, modos: [], cidade: "Cidade Marcador Velha", trajeto: { waypoints: [{ nome: NOME }] } }), AGORA - 10);
    const r = await marcarPonto(velho);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ slug: S });
    expect(await lerRascunho(c, velho)).toBeNull();
    expect(await docDe(S)).toMatchObject({ slug: S, cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME, lat: LAT, lng: LNG }] } });
  });

  // Review Focus 1: o duplo toque no Salvar com o pin mexido — o segundo cai no
  // limite de 1/s. Nada grava, e o primeiro fica como estava.
  it("o segundo ponto no mesmo segundo (limite): 503 e o primeiro intacto", async () => {
    const k = await nascer(NOME);
    expect(await (await marcarPonto(k)).json()).toEqual({ slug: S });
    const primeiro = await lerRascunho(c, S);
    nominatimDeTeste.ponto = { falha: "limite" };
    const r = await mudar({ slug: S, ponto: 0, lat: -8.2, lng: -35.3 });
    expect([r.status, await r.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
    expect(await lerRascunho(c, S)).toEqual(primeiro);
    expect(await listarRascunhos(c)).toHaveLength(1);
  });

  // M10: só o ponto 0 é o lugar. A coordenada da chuva e um ponto a mais do
  // trajeto gravam sem perguntar a cidade a ninguém.
  it("o condicao.coords não consulta o reverse", async () => {
    const k = await nascer(NOME);
    expect((await mudar({ slug: k, campo: "condicao.coords", valor: { lat: -8.1, lng: -35.2 } })).status).toBe(200);
    const dois = "marcador-rascunho-de-dois-pontos";
    await salvarRascunho(c, dois, JSON.stringify({ slug: dois, modos: [], trajeto: { waypoints: [{ nome: NOME }, { nome: "Ponto Marcador Dois" }] } }), AGORA);
    const p1 = await mudar({ slug: dois, ponto: 1, lat: -8.3, lng: -35.4 });
    expect(p1.status, await p1.clone().text()).toBe(200);
    expect(nominatimDeTeste.pontos).toEqual([]);
    expect(await docDe(k)).not.toHaveProperty("cidade");
    expect(await docDe(dois)).not.toHaveProperty("cidade");
  });

  // Entre a leitura e a mudança de chave, o rascunho foi publicado, apagado ou
  // movido noutra aba: 409 com a frase, e nenhum rascunho renasce.
  it("o rascunho que sumiu no meio do ponto: 409 RASCUNHO_NAO_EXISTE_MAIS, nada renasce", async () => {
    const k = await nascer(NOME);
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      await apagarRascunho(c, k);
    });
    cli = corrida.cliente;
    const r = await marcarPonto(k);
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect([r.status, await r.text()]).toEqual([409, RASCUNHO_NAO_EXISTE_MAIS]);
    expect(await listarRascunhos(c)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 F3 — MEIA COORDENADA. A coordenada do ponto entra como PAR, pela forma
// `{slug, ponto, lat, lng}`; a forma `campo` de `.lat` ou `.lng` sozinha
// deixaria o rascunho com uma latitude sem longitude — a janela que a Tarefa 8
// (R1) fechou na ficha no ar.
describe("meia coordenada no rascunho (onda de conserto 1)", () => {
  beforeEach(async () => {
    expect((await criar(NOME)).status).toBe(201);
  });

  it("PUT só com `.lat` ou só com `.lng`: 400 com frase, e o rascunho não muda", async () => {
    const antes = (await lerRascunho(c, S))!.doc;
    for (const campo of ["trajeto.waypoints.0.lat", "trajeto.waypoints.0.lng"]) {
      const res = await mudar({ slug: S, campo, valor: -8.1 });
      expect(res.status, campo).toBe(400);
      expect(await res.text(), campo).toMatch(/a coordenada do ponto entra inteira/);
    }
    expect((await lerRascunho(c, S))!.doc).toBe(antes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 F4 — O 401 NÃO DIZ NADA: corpo VAZIO nos quatro métodos. Só o status não
// distingue um 401 mudo de um 401 que ecoa alguma coisa a quem não entrou.
describe("sem cookie, nos quatro métodos", () => {
  it("401 com corpo VAZIO", async () => {
    for (const [metodo, corpo] of [
      ["POST", { nome: NOME }],
      ["PUT", { slug: S, campo: "voz", valor: "x" }],
      ["GET", undefined],
      ["DELETE", { slug: S }],
    ] as const) {
      const fn = rota[metodo];
      const res = await fn(pedido(metodo, corpo));
      expect(res.status, metodo).toBe(401);
      expect(await res.text(), metodo).toBe("");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("GET e DELETE", () => {
  beforeEach(async () => {
    expect((await criar(NOME)).status).toBe(201);
  });

  it("GET lista os rascunhos; com ?slug= devolve o documento", async () => {
    const lista = await rota.GET(pedido("GET", undefined, cookieBom));
    expect(lista.status).toBe(200);
    expect(await lista.json()).toEqual({ rascunhos: [{ slug: S, nome: NOME, atualizado_em: (await lerRascunho(c, S))!.atualizado_em }] });
    const um = await rota.GET(pedido("GET", undefined, cookieBom, `?slug=${S}`));
    expect(await um.json()).toEqual({ slug: S, doc: await docDe(S) });
    expect((await rota.GET(pedido("GET", undefined, cookieBom, "?slug=nao-tem"))).status).toBe(404);
  });

  it("DELETE tira o rascunho, e nunca toca em ficha_versoes", async () => {
    const alvo = acervo[0];
    expect((await rota.DELETE(pedido("DELETE", { slug: S }, cookieBom))).status).toBe(200);
    expect(await lerRascunho(c, S)).toBeNull();
    // Lugar no ar SEM rascunho: nada a apagar — 404 (M1 da revisão da Tarefa
    // 15; antes era 200), e a versão dele fica.
    const vazio = await rota.DELETE(pedido("DELETE", { slug: alvo.slug }, cookieBom));
    expect(vazio.status).toBe(404);
    expect(await vazio.text()).toBe("");
    expect(await historico(c, alvo.slug)).toHaveLength(1);
  });

  it("DELETE de um endereço sem rascunho é 404, não sucesso: o 2º DELETE do mesmo, e o endereço VELHO de um rascunho movido", async () => {
    expect((await rota.DELETE(pedido("DELETE", { slug: S }, cookieBom))).status).toBe(200);
    expect((await rota.DELETE(pedido("DELETE", { slug: S }, cookieBom))).status, "o 2º DELETE do mesmo").toBe(404);
    // Um rascunho que mudou de endereço (o PUT do nome, noutra aba): o DELETE
    // no endereço velho não apaga nada, e o rascunho fica no novo.
    expect((await criar(NOME)).status).toBe(201);
    const ren = await mudar({ slug: S, campo: "trajeto.waypoints.0.nome", valor: "Nome Marcador Novo" });
    const NOVO = "nome-marcador-novo-cidade-marcador-um";
    expect(await ren.json(), "a premissa: o rascunho mudou de endereço").toEqual({ slug: NOVO });
    const res = await rota.DELETE(pedido("DELETE", { slug: S }, cookieBom));
    expect(res.status, "DELETE no endereço velho").toBe(404);
    expect(await lerRascunho(c, NOVO), "o rascunho movido sumiu").not.toBeNull();
  });

  it("sem cookie: GET e DELETE 401, e nada sai", async () => {
    expect((await rota.GET(pedido("GET", undefined))).status).toBe(401);
    expect((await rota.DELETE(pedido("DELETE", { slug: S }))).status).toBe(401);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });
});

// 🔴 TASK 17 (decisão do João de 13/10, "rascunho não deve bloquear", "Nenhum
// ocupa"): o rascunho de quem usa o app não recusa o João — nem pelo PAR, nem
// pelo ENDEREÇO que o par dele daria. Os dois existem; quem publicar primeiro
// fica com o endereço, e o segundo é recusado no publicar. (De 07/10 até a Task
// 17 a colisão o via — `todosOsRascunhos` —, e o painel respondia com frases
// próprias pra ele, apagadas com o estado que as alcançava.)
describe("o rascunho de quem usa o app, visto do painel", () => {
  async function rascunhoDela(endereco: string, nome: string, cidade: string): Promise<string> {
    const doc = JSON.stringify({ slug: endereco, modos: [], cidade, trajeto: { waypoints: [{ nome }] } });
    const chave = await criarRascunhoDaPessoa(c, endereco, doc, AGORA - 5, PESSOA_DE_TESTE);
    expect(chave, "a premissa: o rascunho dela nasceu").not.toBeNull();
    return chave!;
  }

  it("o PAR de um rascunho dela: o João cria, e o dela fica", async () => {
    const dela = await rascunhoDela(S, NOME, CIDADE);
    const res = await criar("lugar   marcador UM", " cidade marcador UM ");
    expect(res.status, await res.clone().text()).toBe(201);
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual([S]);
    expect((await rascunhoNoBanco(c, dela))?.contribuidor).toBe(PESSOA_DE_TESTE);
  });

  // A fronteira entre o nome e a cidade que anda: o par dela é outro, e o
  // endereço que ele daria é o do João.
  it("o ENDEREÇO que o par de um rascunho dela daria, de nome diferente: o João cria, e o dela fica", async () => {
    const dela = await rascunhoDela("lugar-marcador-cidade-marcador", "Lugar Marcador", "Cidade Marcador");
    const res = await criar("Lugar Marcador Cidade", "Marcador");
    expect(res.status, await res.clone().text()).toBe(201);
    expect(await lerRascunho(c, "lugar-marcador-cidade-marcador")).not.toBeNull();
    expect((await rascunhoNoBanco(c, dela))?.contribuidor).toBe(PESSOA_DE_TESTE);
  });
});
