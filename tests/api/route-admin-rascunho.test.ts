import { readdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA, lerCaminho } from "@/lib/campos-da-ficha";
import {
  ensureSchema,
  gravarVersao,
  historico,
  lerRascunho,
  listarRascunhos,
  rascunhoDeQualquerUm,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import {
  CIDADE_SEM_LETRA,
  CIDADE_VAZIA,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  SLUGS_RESERVADOS,
  enderecoDeLugar,
  enderecoDeRascunho,
  enderecoDeRascunhoDeQuemUsa,
  gemeoSemCidade,
  parDeLugar,
  parDeRascunho,
  parDeRascunhoDeQuemUsa,
  slugDoNome,
} from "@/lib/rascunho";
import type { Ficha } from "@/types/ficha";
import { PESSOA_DE_TESTE, salvarRascunho, semearAcervo } from "../banco";

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
let acervo: Ficha[];
let cookieBom: string;
let rota: typeof import("@/app/api/admin/rascunho/route");

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  acervo = await semearAcervo(c);
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
const criar = (nome: string, cidade: string = CIDADE, cookie: string | null = cookieBom) =>
  rota.POST(pedido("POST", { nome, cidade }, cookie ?? undefined));
const mudar = (corpo: unknown, cookie: string | null = cookieBom) => rota.PUT(pedido("PUT", corpo, cookie ?? undefined));
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
  // slug alcançaria (`/<slug>` e `/admin/<slug>`) tem de estar reservado. Um
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
    const rotas = [...new Set([...estaticos(""), ...estaticos("admin")])];
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
  // disse (o nome e a cidade), a identidade (`slug`) e o `modos: []` da R3.
  it("rascunho novo nasce VAZIO — não herda de lugar nenhum", async () => {
    expect(acervo.length, "a premissa: há lugares no banco de onde copiar").toBeGreaterThan(1);
    expect((await criar(NOME)).status).toBe(201);
    const doc = await docDe(S);
    expect(doc).toEqual({ slug: S, modos: [], cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME }] } });
    for (const campo of CAMPOS_DA_FICHA) {
      const caminho = campo.caminho.replace("[]", ".0");
      if (caminho === "trajeto.waypoints.0.nome" || caminho === "cidade") continue;
      expect(lerCaminho(doc, caminho.split(".")), caminho).toBeUndefined();
    }
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

  // Um rascunho começado ANTES da 11b não tem cidade: o gêmeo dele também espera.
  // E a cidade sem letra nem número (`"--"`, gravada antes de as portas a
  // recusarem — o schema a aceita) não separa nada: conta como sem cidade.
  it("nome de um RASCUNHO sem cidade, ou com cidade sem letra: 409 pedindo a cidade dele, e ele não muda", async () => {
    const doc = JSON.stringify({ slug: "marcador-rascunho-antigo", modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
    await salvarRascunho(c, "marcador-rascunho-antigo", doc, AGORA);
    const res = await criar(NOME, CIDADE);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(gemeoSemCidade(NOME));
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual(["marcador-rascunho-antigo"]);
    expect((await lerRascunho(c, "marcador-rascunho-antigo"))!.doc).toBe(doc);

    const tracos = JSON.stringify({ slug: "marcador-rascunho-tracos", modos: [], cidade: "--", trajeto: { waypoints: [{ nome: "Lugar Marcador Nove" }] } });
    await salvarRascunho(c, "marcador-rascunho-tracos", tracos, AGORA);
    const res2 = await criar("Lugar Marcador Nove", CIDADE);
    expect(res2.status).toBe(409);
    expect(await res2.text()).toBe(gemeoSemCidade("Lugar Marcador Nove"));
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

  it("nome ou cidade em branco, ou sem letra nem número: 400 com a frase de cada um", async () => {
    for (const [nome, cidade, frase] of [
      ["", CIDADE, NOME_VAZIO],
      ["   ", CIDADE, NOME_VAZIO],
      ["!!! ---", CIDADE, NOME_SEM_LETRA],
      [NOME, "", CIDADE_VAZIA],
      [NOME, "   ", CIDADE_VAZIA],
      [NOME, "--", CIDADE_SEM_LETRA],
    ] as const) {
      const res = await criar(nome, cidade);
      expect(res.status, JSON.stringify([nome, cidade])).toBe(400);
      expect(await res.text(), JSON.stringify([nome, cidade])).toBe(frase);
    }
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // Exatamente `{nome, cidade}`: chave a menos (o corpo de antes da 11b, só com
  // o nome) ou a mais (um `slug` escolhido por fora) é corpo malformado.
  it("corpo malformado: 400 sem nada nascer", async () => {
    for (const corpo of [
      null,
      { nome: 7, cidade: CIDADE },
      { nome: NOME, cidade: 7 },
      {},
      { nome: NOME },
      { cidade: CIDADE },
      { nome: NOME, cidade: CIDADE, slug: "outro" },
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
  // cidade — outro lugar, de mesmo nome — nasce depois.
  it("criar em Cidade Marcador Um, corrigir pra Cidade Marcador Dois: o rascunho muda de endereço, e o de Um nasce depois", async () => {
    expect((await criar(NOME, CIDADE)).status).toBe(201);
    const res = await mudar({ slug: S, campo: "cidade", valor: OUTRA_CIDADE });
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
    const r1 = await mudar({ slug: S, campo: "cidade", valor: "Marcador" });
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
  // sem letra é recusado com a frase do POST; e um rascunho sem cidade (nenhum
  // nasce assim desde a 11b) não muda de nome antes de ganhá-la.
  it("renomear o rascunho pra nome sem letra, ou um rascunho sem cidade: 400 com a frase do POST, e nada muda", async () => {
    expect((await criar(NOME, CIDADE)).status).toBe(201);
    const antes = (await lerRascunho(c, S))!.doc;
    for (const valor of ["--", " ... "]) {
      const res = await mudar({ slug: S, campo: "trajeto.waypoints.0.nome", valor });
      expect(res.status, valor).toBe(400);
      expect(await res.text(), valor).toBe(NOME_SEM_LETRA);
    }
    expect((await lerRascunho(c, S))!.doc).toBe(antes);

    const sem = "lugar-marcador-sem-cidade";
    await salvarRascunho(c, sem, JSON.stringify({ slug: sem, modos: [], trajeto: { waypoints: [{ nome: "Novo" }] } }), AGORA);
    const semAntes = (await lerRascunho(c, sem))!.doc;
    const res = await mudar({ slug: sem, campo: "trajeto.waypoints.0.nome", valor: "Admin" });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(CIDADE_VAZIA);
    expect((await lerRascunho(c, sem))!.doc).toBe(semAntes);
    expect(await lerRascunho(c, "admin")).toBeNull();
  });

  // 🔴 11b-M3: renomear, ou mudar a cidade, de um rascunho passa pelo MESMO par.
  // E o endereço do rascunho ACOMPANHA os dois (onda de fix 2, Y2): ainda não
  // há link circulando, e o endereço velho seria o de um par que não é o dele.
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

    it("mudar a cidade pra a de um lugar no ar de mesmo nome: 409, o rascunho não muda", async () => {
      await lugarMarcador(OUTRO_SLUG, NOME, OUTRA_CIDADE);
      const antes = (await lerRascunho(c, S))!.doc;
      const res = await mudar({ slug: S, campo: "cidade", valor: "cidade marcador DOIS" });
      expect(res.status).toBe(409);
      expect(await res.text()).toBe(parDeLugar(`${NOME} (${OUTRA_CIDADE})`));
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
      const passo = async (campo: string, valor: string, esperado: string) => {
        const res = await mudar({ slug: aqui, campo, valor });
        expect(res.status, `${campo}=${valor}: ${await res.clone().text()}`).toBe(200);
        expect(await res.json(), `${campo}=${valor}`).toEqual({ slug: esperado });
        aqui = esperado;
        expect((await listarRascunhos(c)).map((r) => r.slug), `${campo}=${valor}`).toEqual([esperado]);
        expect((await docDe(esperado)).slug, `${campo}=${valor}`).toBe(esperado);
      };
      await passo("cidade", "CIDADE marcador um", S);
      await passo(CAMPO_NOME, "Lugar Marcador UM", S);
      await passo(CAMPO_NOME, OUTRO_NOME, "lugar-marcador-dois-cidade-marcador-um");
      await passo(CAMPO_NOME, "Nome Marcador Livre", "nome-marcador-livre-cidade-marcador-um");
      expect(((await docDe(aqui)).trajeto as { waypoints: { nome: string }[] }).waypoints[0].nome).toBe(
        "Nome Marcador Livre",
      );
      await passo("cidade", "Cidade Marcador Cinco", "nome-marcador-livre-cidade-marcador-cinco");
      expect((await docDe(aqui)).cidade).toBe("Cidade Marcador Cinco");
    });

    // A cidade é obrigatória: não tem "não sei", nem no rascunho.
    it("'não sei' na cidade: 400 com frase, e ela fica", async () => {
      const res = await mudar({ slug: S, campo: "cidade", naoSei: true });
      expect(res.status).toBe(400);
      expect(await res.text()).toBe(CIDADE_VAZIA);
      expect((await docDe(S)).cidade).toBe(CIDADE);
    });

    // 🔴 X3 DA ONDA DE FIX: a cidade sem letra nem número é recusada aqui com a
    // MESMA frase do POST. Antes entrava, e o rascunho parava de colidir por par.
    it("cidade sem letra nem número: 400 com a frase do POST, e ela fica", async () => {
      const antes = (await lerRascunho(c, S))!.doc;
      for (const valor of ["--", " ... ", "—"]) {
        const res = await mudar({ slug: S, campo: "cidade", valor });
        expect(res.status, valor).toBe(400);
        expect(await res.text(), valor).toBe(CIDADE_SEM_LETRA);
      }
      expect((await lerRascunho(c, S))!.doc).toBe(antes);
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
    // o NOME nasce ou muda. Responder a CIDADE nunca esbarra nela — só no par —,
    // nem reescrever o mesmo nome noutra grafia. Aqui o estado de antes (um lugar
    // de mesmo nome e sem cidade, gravado direto no banco) já existe, e o
    // rascunho ainda recebe a cidade e a grafia nova.
    it("com um gêmeo SEM cidade já no banco: mudar a cidade, e o nome noutra grafia, passam (200)", async () => {
      await lugarMarcador(OUTRO_SLUG, NOME);
      const r1 = await mudar({ slug: S, campo: "cidade", valor: OUTRA_CIDADE });
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
      ["POST", { nome: NOME, cidade: CIDADE }],
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
    expect(await lista.json()).toEqual({ rascunhos: [{ slug: S, nome: NOME, atualizado_em: AGORA }] });
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

// 🔴 I4 DA PRÉ-AUDITORIA (07/10): o rascunho de quem usa o app não está na lista
// do painel — então a frase "continue por ele, na lista do painel" seria
// MENTIRA quando é ele que colide. E a colisão tem de VÊ-LO (`todosOsRascunhos`),
// senão dois rascunhos de mesmo par virariam dois lugares no mesmo par.
describe("o rascunho de quem usa o app, visto do painel", () => {
  async function rascunhoDela(slug: string, nome: string, cidade: string): Promise<void> {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, JSON.stringify({ slug, modos: [], cidade, trajeto: { waypoints: [{ nome }] } }), AGORA - 5, PESSOA_DE_TESTE],
    });
  }

  it("o PAR de um rascunho dela: 409 com a frase de quem usa — nunca 'na lista do painel' —, e nada nasce", async () => {
    await rascunhoDela(S, NOME, CIDADE);
    const res = await criar("lugar   marcador UM", " cidade marcador UM ");
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(parDeRascunhoDeQuemUsa(`${NOME} (${CIDADE})`));
    expect(frase).not.toMatch(/lista do painel/);
    expect(await listarRascunhos(c)).toEqual([]);
    expect((await rascunhoDeQualquerUm(c, S))?.contribuidor).toBe(PESSOA_DE_TESTE);
  });

  // A fronteira entre o nome e a cidade que anda (o molde do caso "endereço
  // ocupado por um RASCUNHO de nome diferente", lá em cima).
  it("o ENDEREÇO de um rascunho dela, de nome diferente: 409 com a frase de quem usa, e ele não muda", async () => {
    await rascunhoDela("lugar-marcador-cidade-marcador", "Lugar Marcador", "Cidade Marcador");
    const res = await criar("Lugar Marcador Cidade", "Marcador");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeRascunhoDeQuemUsa("Lugar Marcador (Cidade Marcador)"));
    expect(await rascunhoDeQualquerUm(c, "lugar-marcador-cidade-marcador")).toMatchObject({ contribuidor: PESSOA_DE_TESTE });
  });
});
