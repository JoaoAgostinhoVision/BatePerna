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
  salvarRascunho,
  versaoAtual,
  versoesAtuais,
} from "@/lib/db";
import {
  JA_EXISTE_LUGAR,
  JA_EXISTE_RASCUNHO,
  NOME_DE_TELA,
  NOME_SEM_LETRA,
  NOME_VAZIO,
  SLUGS_RESERVADOS,
  slugDoNome,
} from "@/lib/rascunho";
import type { Ficha } from "@/types/ficha";
import { semearAcervo } from "../banco";

/** A PORTA DO RASCUNHO (Tarefa 11): `/api/admin/rascunho`.
 *
 *  Molde: `route-admin-visibilidade.test.ts` — `Request` à mão, `vi.stubEnv`,
 *  `criarSessao` de verdade, acervo do BANCO por `semearAcervo`.
 *
 *  🔴 ASSERÇÃO DUPLA EM TODO CASO QUE RECUSA: o código E o banco. "Recusou" sem
 *  olhar o banco não distingue de "gravou a coisa errada e devolveu 400", e aqui
 *  a coisa errada é um rascunho por cima de um lugar que está no ar.
 *
 *  Nenhum lugar real é inventado: os nomes novos são MARCADORES. O único nome
 *  real que aparece é o de um lugar que JÁ ESTÁ no banco, lido do banco — é a
 *  colisão que se quer provar. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-rascunho";
const AGORA = 1_758_400_000;
const NOME = "Lugar Marcador Um";
const S = "lugar-marcador-um";

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
const criar = (nome: string, cookie: string | null = cookieBom) =>
  rota.POST(pedido("POST", { nome }, cookie ?? undefined));
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

  // 🔴 O mesmo slug que a SEMENTE deu aos lugares de hoje sai do nome deles —
  // é isso que faz a colisão por nome funcionar contra o acervo real.
  // Nem todo slug do acervo sai só do nome (pode levar a cidade); o que se exige
  // é que o caso comum exista, pra a colisão por nome medir algo real.
  it("o nome de um lugar do acervo dá o slug dele", () => {
    expect(
      acervo.some((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug),
      "nenhum lugar do acervo tem o slug derivado do nome: a colisão abaixo não mediria o caso comum",
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
  it("201, o slug do nome, e o rascunho nasce", async () => {
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
  // disse (o nome), a identidade (`slug`) e o `modos: []` da ruling R3.
  it("rascunho novo nasce VAZIO — não herda de lugar nenhum", async () => {
    expect(acervo.length, "a premissa: há lugares no banco de onde copiar").toBeGreaterThan(1);
    expect((await criar(NOME)).status).toBe(201);
    const doc = await docDe(S);
    expect(doc).toEqual({ slug: S, modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
    for (const campo of CAMPOS_DA_FICHA) {
      const caminho = campo.caminho.replace("[]", ".0");
      if (caminho === "trajeto.waypoints.0.nome") continue;
      expect(lerCaminho(doc, caminho.split(".")), caminho).toBeUndefined();
    }
  });

  it("sem cookie: 401, e nada nasce", async () => {
    expect((await criar(NOME, null)).status).toBe(401);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("painel desligado: 404, e nada nasce", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await criar(NOME)).status).toBe(404);
    expect(await listarRascunhos(c)).toEqual([]);
  });

  // 🔴 E4: o nome de um lugar que JÁ ESTÁ no ar NUNCA vira rascunho — o rascunho
  // seria publicado como versão nova daquele lugar, por cima do que o app diz.
  it("nome de um lugar no ar: 409 com frase, e o lugar fica intacto", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    const res = await criar(alvo.trajeto.waypoints[0].nome);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_EXISTE_LUGAR);
    expect(await lerRascunho(c, alvo.slug)).toBeNull();
    expect(await historico(c, alvo.slug)).toHaveLength(1);
  });

  // 🔴 E O LUGAR ESCONDIDO É LUGAR. A leitura pública não o vê — se a colisão
  // usasse ela, o rascunho nasceria com o slug dele, e publicar gravaria versão
  // nova no histórico DELE com `oculto = 0`: desescondido sem ninguém pedir.
  it("nome de um lugar ESCONDIDO: 409, e ele continua escondido e intacto", async () => {
    const alvo = acervo.find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    await esconder(alvo.slug);
    expect((await versoesAtuais(c)).has(alvo.slug), "a premissa: o público não o vê").toBe(false);
    const res = await criar(alvo.trajeto.waypoints[0].nome);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_EXISTE_LUGAR);
    expect(await lerRascunho(c, alvo.slug)).toBeNull();
    const h = await historico(c, alvo.slug);
    expect(h).toHaveLength(2);
    expect(h[0].oculto).toBe(true);
  });

  it("nome de um rascunho que já existe: 409, e o primeiro não perde nada", async () => {
    expect((await criar(NOME)).status).toBe(201);
    await salvarRascunho(c, S, JSON.stringify({ slug: S, voz: "o que ele já respondeu" }), AGORA);
    const res = await criar("lugar   marcador UM");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_EXISTE_RASCUNHO);
    expect((await docDe(S)).voz).toBe("o que ele já respondeu");
  });

  it("nome que é tela do app: 409 com frase, nada nasce", async () => {
    for (const nome of ["Novo", "Trilhas", "ADMIN"]) {
      const res = await criar(nome);
      expect(res.status, nome).toBe(409);
      expect(await res.text()).toBe(NOME_DE_TELA);
    }
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("nome em branco, ou sem letra nem número: 400 com a frase de cada um", async () => {
    for (const [nome, frase] of [
      ["", NOME_VAZIO],
      ["   ", NOME_VAZIO],
      ["!!! ---", NOME_SEM_LETRA],
    ] as const) {
      const res = await criar(nome);
      expect(res.status, JSON.stringify(nome)).toBe(400);
      expect(await res.text()).toBe(frase);
    }
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("corpo malformado: 400 sem nada nascer", async () => {
    for (const corpo of [null, { nome: 7 }, {}, { nome: NOME, slug: "outro" }]) {
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

  it("o horário entra inteiro; uma hora sozinha recusa com a frase que diz o que fazer", async () => {
    const meia = await mudar({ slug: S, campo: "horario.abre", valor: "05:00" });
    expect(meia.status).toBe(400);
    expect(await meia.text()).toMatch(/horario/);
    expect((await mudar({ slug: S, campo: "horario", valor: { abre: "05:00", fecha: "17:00" } })).status).toBe(200);
    expect((await docDe(S)).horario).toEqual({ abre: "05:00", fecha: "17:00" });
    // presente, cada hora muda sozinha
    expect((await mudar({ slug: S, campo: "horario.fecha", valor: "16:00" })).status).toBe(200);
    expect((await docDe(S)).horario).toEqual({ abre: "05:00", fecha: "16:00" });
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
    expect((await rota.DELETE(pedido("DELETE", { slug: alvo.slug }, cookieBom))).status).toBe(200);
    expect(await historico(c, alvo.slug)).toHaveLength(1);
  });

  it("sem cookie: GET e DELETE 401, e nada sai", async () => {
    expect((await rota.GET(pedido("GET", undefined))).status).toBe(401);
    expect((await rota.DELETE(pedido("DELETE", { slug: S }))).status).toBe(401);
    expect(await lerRascunho(c, S)).not.toBeNull();
  });
});
