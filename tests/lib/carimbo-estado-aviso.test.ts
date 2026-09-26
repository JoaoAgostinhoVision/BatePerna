import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { faseDe } from "@/lib/carimbo-fase";
import { fechadoPeloDono } from "@/lib/aviso";
import { getFicha } from "@/lib/ficha";
import type { Client } from "@libsql/client";
import type { AvisoLinha } from "@/lib/db";

const base = { conferindo: false, erro: false, venceu: false, falhou: false, fechadoPeloDono: false };

describe("faseDe com o aviso do dono", () => {
  // 🔴 "A rampa esta em reforma" fecha o lugar, e nao e o calendario que diz.
  // Sem esta linha o app so sabe fechar por horario/dias — e a frase dele de
  // 11/09 continuaria sem ter onde morar.
  it("o dono fecha o lugar, mesmo sem horario e sem dias", () => {
    expect(faseDe({ ...base, fechadoPeloDono: true })).toBe("fechado");
  });

  it("o fechado do dono ganha de conferindo, igual ao do calendario", () => {
    expect(faseDe({ ...base, conferindo: true, fechadoPeloDono: true })).toBe("fechado");
  });

  it("sem aviso, nada muda no que ja existia", () => {
    expect(faseDe({ ...base })).toBe("afirmando");
    expect(faseDe({ ...base, conferindo: true })).toBe("conferindo");
    expect(faseDe({ ...base, erro: true })).toBe("sem-informacoes");
    expect(faseDe({ ...base, fechado: true })).toBe("fechado");
  });
});

// 🔴 O GUARDA DE FONTE DO CAMPO OBRIGATORIO.
//
// `fechadoPeloDono` opcional em `Situacao` NAO QUEBRA TESTE NENHUM — foi medido
// (mutacao M2 da Task 8). E e exatamente por isso que ele precisa deste guarda:
// opcional, esquecer o campo em UM dos pontos que montam uma `Situacao` compila
// em silencio, e o defeito que sai disso e o pior que este projeto tem — o
// lugar aparecendo ABERTO na tela com o dono tendo dito que esta fechado.
//
// A linha e casada INTEIRA, ancorada, e nao pela palavra solta: `fechadoPeloDono`
// tambem aparece na desestruturacao do `faseDe`, no `Omit` do `podeBuscar` e na
// prosa dos comentarios deste arquivo. `toContain("fechadoPeloDono")` passaria
// com a mutacao aplicada — e guarda que passa com a mutacao aplicada nao trava
// nada. Este projeto ja pagou essa especie quatro vezes.
describe("o campo fechadoPeloDono e OBRIGATORIO, e isso e travado na fonte", () => {
  const src = readFileSync(path.join(process.cwd(), "src", "lib", "carimbo-fase.ts"), "utf8")
    .replace(/\r\n/g, "\n");
  const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("a tira de comentarios nao comeu o arquivo", () => {
    // Sem esta guarda, um `codigo` vazio faria as duas asserções abaixo
    // passarem por vacuidade — a `not.toMatch` de graça e a `toMatch` ficaria
    // vermelha por outro motivo, o que já esconderia a intenção.
    expect(codigo).toContain("export type Situacao");
    expect(codigo).toContain("export function faseDe(");
  });

  it("a declaracao e `fechadoPeloDono: boolean;`, sem `?`", () => {
    expect(codigo).toMatch(/\n {2}fechadoPeloDono: boolean;\n/);
  });

  it("nao existe `fechadoPeloDono?` em lugar nenhum do modulo", () => {
    expect(codigo).not.toMatch(/fechadoPeloDono\?/);
  });
});

// ---------------------------------------------------------------------------
// O aviso entrando na LEITURA, que é o outro lado desta tarefa: `faseDe` só
// sabe ler o campo se alguém o preencher.

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);
const H = 3600;

vi.mock("@/lib/weather", () => ({ fetchPrecip: vi.fn(), fetchPrecipMulti: vi.fn() }));

// 🔴 O DUBLÊ DO BANCO FICOU PARCIAL EM 2026-09-25, e a mudança é obrigatória: a
// ficha passou a vir do banco, então `getFicha` precisa do `versoesAtuais` de
// verdade. O que continua dublado é só o que este arquivo mede — o aviso — e o
// `getClient`, que aponta pro `:memory:` daqui em vez do Turso.
let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
  avisoVigente: vi.fn(),
  avisosVigentes: vi.fn(),
}));

const { fetchPrecip, fetchPrecipMulti } = await import("@/lib/weather");
const { avisoVigente, avisosVigentes } = await import("@/lib/db");
const { PRAZO_AVISO_MS, resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
const { bancoVazio, semearAcervo } = await import("../banco");

// A ficha é fixture deste arquivo (a pergunta aqui é o aviso), e é lida uma vez
// no topo: `ficha()` segue síncrona pros doze pontos que a chamam.
cliente = bancoVazio();
await semearAcervo(cliente);
const RAMPA = await getFicha("rampa-do-pepe");

function ficha() {
  if (!RAMPA) throw new Error("a ficha da Rampa sumiu do acervo");
  return RAMPA;
}

/** Sem chuva nenhuma na janela: o motor sozinho diria "fresco". */
function seco() {
  const precips = [];
  for (let i = -24; i <= 24; i++) precips.push({ time: AGORA_S + i * H, mm: 0 });
  return { precips, raw: { hourly: { time: [], precipitation: [] } } };
}

function serieSeca() {
  const p = [];
  for (let i = -48; i <= 48; i++) p.push({ time: AGORA_S + i * H, mm: 0 });
  return p;
}

function linha(efeito: AvisoLinha["efeito"], texto: string, slug = "rampa-do-pepe"): AvisoLinha {
  return {
    id: 1, ficha_slug: slug, texto, efeito,
    criado_em: AGORA_S - 3600, vence_em: AGORA_S + 3600,
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(fetchPrecip).mockReset();
  vi.mocked(fetchPrecipMulti).mockReset();
  vi.mocked(avisoVigente).mockReset();
  vi.mocked(avisosVigentes).mockReset();
});

describe("resolverEstado com a palavra do dono", () => {
  it("o aviso viaja na leitura, e 'em reforma' fecha o lugar", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockResolvedValue(linha("fechado", "a rampa está em reforma"));

    const r = await resolverEstado(ficha());

    expect(r.aviso?.texto).toBe("a rampa está em reforma");
    expect(fechadoPeloDono(r.aviso, AGORA_S)).toBe(true);
    // 🔴 E O ESTADO CONTINUA SENDO O DA CHUVA. "Em reforma" virando `frio` faria
    // o app dizer "não vá" com as palavras da CHUVA, que é obra virando tempo.
    expect(r.estado).toBe("fresco");
  });

  it("o dono ganha do motor: ele disse molhado, o motor tinha dito seco", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockResolvedValue(linha("frio", "choveu ontem à noite"));

    expect((await resolverEstado(ficha())).estado).toBe("frio");
  });

  it("sem aviso nenhum, a leitura é a de sempre — e o campo vem `null`", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockResolvedValue(null);

    expect(await resolverEstado(ficha())).toEqual({
      estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null,
    });
  });

  // 🔴 BANCO FORA DO AR NAO DERRUBA O CARIMBO. Sem aviso é o caso NORMAL: é
  // assim que o app roda hoje, e tem que continuar rodando assim se o Turso
  // cair. Um `throw` aqui trocaria "Pode ir" por uma tela de erro no portão,
  // por causa de um recado que talvez nem exista.
  it("o banco estourando não derruba o carimbo — a chuva continua respondendo", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockRejectedValue(new Error("Turso fora do ar"));

    expect(await resolverEstado(ficha())).toEqual({
      estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null,
    });
  });
});

describe("resolverEstados com a palavra do dono", () => {
  it("a home pergunta os avisos UMA vez, não uma por trilha", async () => {
    const f = ficha();
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serieSeca()]);
    vi.mocked(avisosVigentes).mockResolvedValue(new Map());

    await resolverEstados([f]);

    // 🔴 N consultas saindo do celular no portão é o defeito que `resolverEstados`
    // existe pra evitar — a versão singular NUNCA pode aparecer aqui.
    expect(avisosVigentes).toHaveBeenCalledTimes(1);
    expect(avisoVigente).not.toHaveBeenCalled();
  });

  it("cada trilha recebe o SEU aviso, e quem não tem fica com `null`", async () => {
    const f = ficha();
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serieSeca(), serieSeca()]);
    const outra = { ...f, slug: "outro-morro" };
    vi.mocked(avisosVigentes).mockResolvedValue(
      new Map([["rampa-do-pepe", linha("fechado", "em reforma")]]),
    );

    const r = await resolverEstados([f, outra]);

    expect(r.get("rampa-do-pepe")!.aviso?.texto).toBe("em reforma");
    expect(r.get("outro-morro")!.aviso).toBe(null);
  });

  it("o banco estourando não derruba a home inteira", async () => {
    const f = ficha();
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serieSeca()]);
    vi.mocked(avisosVigentes).mockRejectedValue(new Error("Turso fora do ar"));

    const r = await resolverEstados([f]);

    expect(r.get(f.slug)).toEqual({
      estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null,
    });
  });
});

// 🔴 I1 DA REVISÃO FINAL (2026-09-16): o `catch` segura ERRO, não DEMORA. Um
// Turso PENDURADO — sem responder e sem recusar — travaria a ficha, a home e
// o `/api/carimbo(s)`, que são o portão; antes desta branch nenhum desses
// caminhos dependia do banco. Quem fecha isto é `comPrazo(..., PRAZO_AVISO_MS)`
// em `lerAviso`/`lerAvisos`.
//
// Relógio FALSO e uma promessa que NUNCA resolve: sem o prazo, o `await` fica
// pendurado e o `it` só termina pelo timeout do vitest — por isso ele é curto
// (1 s) e menor que o prazo real (2 s): uma implementação sem `comPrazo`
// estoura o teste, e uma com o prazo passa porque o relógio falso é avançado
// à mão. `advanceTimersByTimeAsync` deixa as microtarefas do `Promise.race`
// assentarem entre um tique e outro.
describe("banco PENDURADO não segura o carimbo", () => {
  const pendurada = <T,>() => new Promise<T>(() => {});

  it("resolverEstado segue sem aviso quando o banco nunca responde", { timeout: 1_000 }, async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockReturnValue(pendurada());

    const r = resolverEstado(ficha());
    await vi.advanceTimersByTimeAsync(PRAZO_AVISO_MS + 1);

    expect(await r).toEqual({ estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null });
  });

  it("resolverEstados segue sem avisos quando o banco nunca responde", { timeout: 1_000 }, async () => {
    const f = ficha();
    vi.mocked(fetchPrecipMulti).mockResolvedValue([serieSeca()]);
    vi.mocked(avisosVigentes).mockReturnValue(pendurada());

    const r = resolverEstados([f]);
    await vi.advanceTimersByTimeAsync(PRAZO_AVISO_MS + 1);

    expect((await r).get(f.slug)).toEqual({ estado: "fresco", erro: false, calculadoEm: AGORA_S, aviso: null });
  });

  // Controle: o prazo não come um aviso que CHEGA a tempo. Sem este, um
  // `comPrazo(…, 0)` passaria os dois de cima e apagaria todo aviso do app.
  it("um aviso que responde antes do prazo continua entrando", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(seco());
    vi.mocked(avisoVigente).mockImplementation(
      () => new Promise((ok) => setTimeout(() => ok(linha("fechado", "em reforma")), PRAZO_AVISO_MS - 1)),
    );

    const r = resolverEstado(ficha());
    await vi.advanceTimersByTimeAsync(PRAZO_AVISO_MS);

    expect((await r).aviso?.texto).toBe("em reforma");
  });

  // O clima e o aviso saem JUNTOS: em série, o pior caso somaria os dois
  // prazos (2 s + 4 s) e encostaria nos 6 s do service worker. Prova pelo
  // relógio: com o clima levando 4 s e o banco pendurado, o carimbo sai em
  // ~4 s, não em ~6 s.
  it("o aviso pendurado não SOMA ao tempo do clima — as buscas correm em paralelo", { timeout: 1_000 }, async () => {
    vi.mocked(fetchPrecip).mockImplementation(
      () => new Promise((ok) => setTimeout(() => ok(seco()), 4_000)),
    );
    vi.mocked(avisoVigente).mockReturnValue(pendurada());

    let pronto = false;
    const r = resolverEstado(ficha()).then((x) => { pronto = true; return x; });
    await vi.advanceTimersByTimeAsync(4_000 + 10);

    expect(pronto, "em série, o carimbo só sairia aos 6 s").toBe(true);
    expect((await r).estado).toBe("fresco");
  });
});
