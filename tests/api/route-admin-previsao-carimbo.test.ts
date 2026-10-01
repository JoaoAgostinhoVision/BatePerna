import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA } from "@/lib/campos-da-ficha";
import { ensureSchema, getFreshness, gravarVersao, historico, upsertFreshness } from "@/lib/db";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";
import type { Ficha } from "@/types/ficha";
import { semearAcervo } from "../banco";

/** A PRÉVIA DO CARIMBO (Task 7, 2026-09-30; onda de conserto 1, 2026-10-01) — o
 *  que a tela do lugar diria com o número novo, sem gravar nada.
 *
 *  Molde: `tests/api/route-admin-visibilidade.test.ts` — `Request` à mão,
 *  `process.env` por `vi.stubEnv`, `criarSessao` de verdade, acervo do BANCO por
 *  `semearAcervo`.
 *
 *  🔴 A CHUVA VEM DE UM PROVEDOR FALSO NO `fetch` GLOBAL, e é o MESMO caminho da
 *  tela pública: a rota chama `fetchPrecip`, que chama `fetch` com a URL de
 *  `buildUrl`. A primeira versão deste arquivo injetava a chuva em
 *  `freshness.previsao_bruta`, e TODA prova dele dependia de uma tabela que
 *  produção não enche (medido na revisão: zero linhas, cron nunca agendado). A
 *  suíte era verde sobre um estado que não existe no ar.
 *
 *  🔴 O PROVEDOR FALSO OBEDECE `past_days` E `forecast_days` DA URL, como o de
 *  verdade: a série que ele devolve cobre exatamente os dias pedidos. É isso que
 *  deixa este arquivo provar que a busca sai com a regra CANDIDATA — uma rota que
 *  buscasse com a regra gravada receberia uma série curta demais, e a chuva fora
 *  dela sumiria do carimbo. Uma série fixa larga (o que a versão anterior usava)
 *  esconderia exatamente esse defeito.
 *
 *  O relógio é falso só no `Date`; o caso do prazo falsifica o `setTimeout` por
 *  conta própria. */

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-previsao";
const AGORA = 1_758_300_000;
const H = 3600;

/** A ficha de severidade `nao-va` — a que prova o par seco/molhado. */
const RAMPA = "rampa-do-pepe";
/** 🔴 A ficha de severidade `espera`, e ela é a ÚNICA do acervo cuja fala leva um
 *  NÚMERO dentro (`Espera {n}h`, de `src/lib/severidade.ts`). É por isso que o
 *  caso da fala usa esta e não outra: nas outras duas, trocar
 *  `janela_passado_horas` não mudaria uma letra da fala e o caso ficaria oco. */
const PEDRA = "pedra-furada-de-venturosa";

let c: Client;
let acervo: Ficha[];
let cookieBom: string;
let POST: typeof import("@/app/api/admin/previsao-carimbo/route").POST;
let espiaoFetch: ReturnType<typeof vi.fn>;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => c };
});

const exigir = (slug: string): Ficha => {
  const f = acervo.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
};

/** As URLs que a rota pediu ao provedor, já abertas. */
const pedidos = (): URL[] => espiaoFetch.mock.calls.map((a) => new URL(String(a[0])));

/** O provedor falso: responde como a Open-Meteo, com a série cobrindo os dias que
 *  a URL pediu (`past_days` pra trás, `forecast_days` pra frente, de hora em hora
 *  a partir do `AGORA` falso), e `mm` nas horas dadas (relativas ao `AGORA`). */
function ceu(mmPorHora: Record<number, number>): void {
  espiaoFetch = vi.fn((url: string | URL) => {
    const u = new URL(String(url));
    const passado = Number(u.searchParams.get("past_days")) * 24;
    const futuro = Number(u.searchParams.get("forecast_days")) * 24;
    const time: string[] = [];
    const precipitation: number[] = [];
    for (let h = -passado; h <= futuro; h++) {
      time.push(new Date((AGORA + h * H) * 1000).toISOString().slice(0, 16));
      precipitation.push(mmPorHora[h] ?? 0);
    }
    const corpo = {
      latitude: Number(u.searchParams.get("latitude")),
      longitude: Number(u.searchParams.get("longitude")),
      hourly: { time, precipitation },
    };
    return Promise.resolve(Response.json(corpo));
  });
  vi.stubGlobal("fetch", espiaoFetch);
}

/** Um provedor que responde com o que o caso quiser — recusa, queda, série torta. */
function ceuQue(responder: () => Promise<Response>): void {
  espiaoFetch = vi.fn(responder);
  vi.stubGlobal("fetch", espiaoFetch);
}

/** 5 mm UMA hora atrás: dentro de qualquer janela de passado que este arquivo
 *  usa, e fora de qualquer janela de previsão. */
const CHUVA_ATRAS = { [-1]: 5 };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);

  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  acervo = await semearAcervo(c);

  ceu({});

  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  ({ POST } = await import("@/app/api/admin/previsao-carimbo/route"));

  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});

afterEach(() => {
  c.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function pedido(corpo: unknown, cookie?: string): Request {
  return new Request("http://x/api/admin/previsao-carimbo", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
}

type Corpo = { estado?: string; marca?: string; sub?: string };

const prever = async (
  slug: string,
  campo: string,
  valor: unknown,
): Promise<{ status: number; corpo: Corpo; texto: string }> => {
  const res = await POST(pedido({ slug, campo: `condicao.regra.${campo}`, valor }, cookieBom));
  const texto = await res.text();
  return { status: res.status, corpo: texto === "" ? {} : (JSON.parse(texto) as Corpo), texto };
};

describe("POST /api/admin/previsao-carimbo — a consequência do número", () => {
  it("devolve o carimbo que o lugar teria, nas palavras da tela pública", async () => {
    ceu(CHUVA_ATRAS);

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.estado).toBe("frio");
    // 🔴 A FALA, não o nome do parâmetro nem o estado cru: é a única razão desta
    // rota existir. "Não vá" é a `voz` da Rampa (severidade `nao-va`), e sai de
    // `src/lib/severidade.ts` — as MESMAS palavras da ficha pública.
    expect(corpo.marca).toBe("Não vá");
    expect(corpo.sub).toBe("barro · dá um tempo");
  });

  // 🔴 O CASO DO PLANO, determinístico: a MESMA chuva, dois limiares, dois
  // carimbos. Se os dois dessem o mesmo, a tela estaria mentindo sobre a
  // consequência — e a mutação "a prévia ignora o valor recebido" morre aqui.
  it("limiar diferente muda o carimbo, com a MESMA chuva", async () => {
    ceu(CHUVA_ATRAS);

    const seco = await prever(RAMPA, "limiar_mm", 999);
    const molhado = await prever(RAMPA, "limiar_mm", 0.1);

    expect(seco.status).toBe(200);
    expect(molhado.status).toBe(200);
    expect(seco.corpo.estado).toBe("fresco");
    expect(molhado.corpo.estado).toBe("frio");
    expect(seco.corpo.marca).toBe("Pode ir");
    expect(molhado.corpo.marca).toBe("Não vá");
  });

  it("a janela do passado diferente muda o carimbo, com a MESMA chuva", async () => {
    // 5 mm SETE horas atrás: dentro de uma janela de 12h, fora de uma de 3h.
    ceu({ [-7]: 5 });

    const curta = await prever(RAMPA, "janela_passado_horas", 3);
    const longa = await prever(RAMPA, "janela_passado_horas", 12);

    expect(curta.corpo.estado, "3h não alcança uma chuva de 7h atrás").toBe("fresco");
    expect(longa.corpo.estado, "12h alcança").toBe("frio");
  });

  it("a janela de previsão diferente muda o carimbo, com a MESMA chuva", async () => {
    ceu({ 7: 5 });

    const curta = await prever(RAMPA, "janela_previsao_horas", 3);
    const longa = await prever(RAMPA, "janela_previsao_horas", 12);

    expect(curta.corpo.estado).toBe("fresco");
    expect(longa.corpo.estado).toBe("frio");
  });

  // 🔴 A4 DO BRIEF: A FALA SAI DA REGRA NOVA, NÃO DA GRAVADA. `vozDaFicha`
  // devolve `horasPassado: regra.janela_passado_horas`, e a fala do nível
  // `espera` é literalmente `Espera {n}h`. DOIS valores, pra colapsar a fala numa
  // constante também morrer.
  it("a fala leva o número NOVO, não o que está gravado", async () => {
    const pedra = exigir(PEDRA);
    expect(pedra.condicao.severidade, "esta ficha deixou de ser a do `espera`").toBe("espera");
    expect(pedra.condicao.regra.janela_passado_horas, "o valor gravado mudou").toBe(3);
    ceu(CHUVA_ATRAS);

    const doze = await prever(PEDRA, "janela_passado_horas", 12);
    const nove = await prever(PEDRA, "janela_passado_horas", 9);

    expect(doze.corpo.estado, "a premissa: com chuva atrás o ramo molhado é o que fala").toBe("frio");
    expect(doze.corpo.marca).toBe("Espera 12h");
    expect(nove.corpo.marca).toBe("Espera 9h");
  });

  // E a fala do OUTRO número não se mexe: trocar o limiar não pode mudar o
  // "Espera 3h", porque aquele número é a janela do passado.
  it("trocar o limiar não troca o número da fala", async () => {
    ceu(CHUVA_ATRAS);

    const { corpo } = await prever(PEDRA, "limiar_mm", 1);

    expect(corpo.estado).toBe("frio");
    expect(corpo.marca, "o número da fala é a janela do passado GRAVADA, que não mudou").toBe("Espera 3h");
  });
});

describe("POST /api/admin/previsao-carimbo — a chuva vem AO VIVO, com a regra CANDIDATA", () => {
  // 🔴 F1(a) DA ONDA DE CONSERTO: a janela nova chega à URL. Com a regra GRAVADA
  // (passado 6 → `past_days=1`), a busca traria um dia só.
  it("a busca sai com os dias da regra NOVA e as coordenadas do lugar", async () => {
    const rampa = exigir(RAMPA);
    expect(rampa.condicao.regra.janela_passado_horas, "a premissa: o gravado cabe em 1 dia").toBeLessThanOrEqual(24);

    await prever(RAMPA, "janela_passado_horas", 72);
    await prever(RAMPA, "janela_previsao_horas", 48);

    const [passado, previsao] = pedidos();
    expect(pedidos()).toHaveLength(2);
    expect(passado.searchParams.get("past_days"), "a busca ignorou a janela nova do passado").toBe("3");
    expect(previsao.searchParams.get("forecast_days"), "a busca ignorou a janela nova de previsão").toBe("2");
    expect(passado.hostname).toBe("api.open-meteo.com");
    expect(Number(passado.searchParams.get("latitude"))).toBe(rampa.condicao.coords.lat);
    expect(Number(passado.searchParams.get("longitude"))).toBe(rampa.condicao.coords.lng);
  });

  // 🔴 E O EFEITO, não só a URL (o Important da `route.ts:218-223` da revisão):
  // chuva de 50h atrás só é vista por uma série de 3 dias. Uma rota que buscasse
  // com a regra gravada (1 dia) responderia "Pode ir" sobre uma chuva que ela não
  // viu — que é o defeito que a série guardada tinha.
  it("alargar a janela do passado VÊ a chuva que só a série alargada traz", async () => {
    ceu({ [-50]: 5 });

    const { status, corpo } = await prever(RAMPA, "janela_passado_horas", 72);

    expect(status).toBe(200);
    expect(corpo.estado, "a prévia disse 'pode ir' sobre chuva fora da série que ela pediu").toBe("frio");
  });
});

describe("POST /api/admin/previsao-carimbo — não grava, e não depende do que está guardado", () => {
  // 🔴 F1(b): NENHUMA INSTRUÇÃO DE ESCRITA sai da rota. Pela espiã do cliente, e
  // não só pelo tamanho do histórico: a implementação descuidada chamaria
  // `upsertFreshness` (é o que o `runMotor` faz), e isso não muda o histórico.
  it("toda instrução que a rota manda ao banco é leitura — nenhuma escrita", async () => {
    ceu(CHUVA_ATRAS);
    const real = c.execute.bind(c);
    const espiaoSql = vi.fn((...args: Parameters<typeof real>) => real(...args));
    c.execute = espiaoSql as unknown as typeof c.execute;
    const espiaoLote = vi.fn();
    c.batch = espiaoLote as unknown as typeof c.batch;

    const { status } = await prever(RAMPA, "limiar_mm", 42);

    expect(status).toBe(200);
    const sqls = espiaoSql.mock.calls.map((a) => {
      const x = a[0] as unknown;
      return (typeof x === "string" ? x : (x as { sql: string }).sql).trim();
    });
    expect(sqls.length, "a rota não consultou o banco nem pro número bom: a prova ficaria oca").toBeGreaterThan(0);
    for (const sql of sqls) expect(sql, "a prévia escreveu no banco").toMatch(/^SELECT\b/i);
    expect(espiaoLote, "a prévia escreveu em lote").not.toHaveBeenCalled();
  });

  it("não grava versão, e o `freshness` de nenhum lugar é criado", async () => {
    ceu(CHUVA_ATRAS);
    const antes = await historico(c, RAMPA);

    await prever(RAMPA, "limiar_mm", 42);

    expect(await historico(c, RAMPA), "a prévia gravou uma versão").toHaveLength(antes.length);
    for (const f of acervo) {
      expect(await getFreshness(c, f.slug), `a prévia gravou leitura de ${f.slug}`).toBeNull();
    }
  });

  // 🔴 F1(d): O ESTADO DE PRODUÇÃO — `freshness` vazia — dá CARIMBO. Era o caso
  // que a versão anterior respondia com "sem leitura", sempre.
  it("sem linha nenhuma em `freshness` (como em produção), a prévia responde com carimbo", async () => {
    for (const f of acervo) expect(await getFreshness(c, f.slug)).toBeNull();
    ceu(CHUVA_ATRAS);

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.marca).toBe("Não vá");
  });

  // 🔴 E UMA LINHA VELHA EM `freshness` NÃO MANDA NA PRÉVIA: no dia em que alguém
  // rodar o motor uma vez, a série guardada ficaria lá, congelada. Aqui ela diz
  // "choveu 50 mm agora mesmo" e o céu de verdade está seco.
  it("uma série guardada em `freshness` é IGNORADA: manda o céu de agora", async () => {
    const time = [-1, 0, 1].map((h) => new Date((AGORA + h * H) * 1000).toISOString().slice(0, 16));
    await upsertFreshness(c, {
      slug: RAMPA,
      estado: "frio",
      calculadoEm: AGORA - 40 * 24 * H,
      fonte: "open-meteo",
      previsaoBruta: JSON.stringify({ hourly: { time, precipitation: [50, 50, 50] } }),
    });
    ceu({});

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.estado, "a prévia leu a chuva guardada em vez da de agora").toBe("fresco");
  });
});

describe("POST /api/admin/previsao-carimbo — a chuva não veio: 503, e carimbo NENHUM", () => {
  // 🔴 F1(c). Toda falha cai no mesmo lado: o cliente diz que não conseguiu
  // conferir. Um `fresco` de reserva diria ao dono que o lugar está liberado sem o
  // app ter lido chuva nenhuma.
  for (const [nome, responder] of [
    ["o provedor recusa (400)", () => Promise.resolve(new Response('{"error":true}', { status: 400 }))],
    ["o provedor cai (500)", () => Promise.resolve(new Response("", { status: 500 }))],
    ["a rede cai", () => Promise.reject(new Error("sem rede"))],
    ["a resposta não é JSON", () => Promise.resolve(new Response("isto nao e json"))],
    ["a resposta vem sem `hourly`", () => Promise.resolve(Response.json({ latitude: -8 }))],
    // O estado que `parsePrecip` existe pra barrar: hora sem medida não pode
    // virar hora seca por acidente de índice.
    [
      "a série tem menos medidas que horas",
      () =>
        Promise.resolve(
          Response.json({ hourly: { time: ["2025-09-19T18:00", "2025-09-19T19:00"], precipitation: [0] } }),
        ),
    ],
  ] as const) {
    it(`${nome}: 503 de corpo vazio`, async () => {
      ceuQue(responder);

      const { status, texto } = await prever(RAMPA, "limiar_mm", 1);

      expect(espiaoFetch, "a premissa: a rota perguntou ao provedor").toHaveBeenCalledTimes(1);
      expect(status).toBe(503);
      expect(texto, "um 503 que carrega carimbo").toBe("");
    });
  }

  it("o provedor pendura: no prazo, 503 — e não antes dele", async () => {
    ceuQue(() => new Promise<Response>(() => {}));
    // ⚠️ `useRealTimers` antes: um segundo `useFakeTimers` por cima do do
    // `beforeEach` NÃO troca a lista do que é falso (medido: o caso levava 4 s
    // de relógio de verdade e passava verde sem medir o prazo).
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(AGORA * 1000);

    let saiu: Response | null = null;
    const resposta = POST(pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom)).then(
      (r) => (saiu = r),
    );
    // Espera a rota chegar ao provedor (o banco em memória não usa o relógio falso).
    for (let i = 0; i < 200 && espiaoFetch.mock.calls.length === 0; i++) {
      await new Promise((ok) => setImmediate(ok));
    }
    expect(espiaoFetch, "a rota não chegou a perguntar ao provedor").toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_999);
    expect(saiu, "a prévia desistiu antes do prazo").toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    await resposta;

    expect(saiu).not.toBeNull();
    expect(saiu!.status).toBe(503);
    expect(await saiu!.text()).toBe("");
  });
});

describe("POST /api/admin/previsao-carimbo — a camada da ROTA recusa a regra que mente", () => {
  // 🔴 ESTA É A CAMADA DO MEIO. O cliente recusa antes (ver
  // `tests/app/admin-editor-numero.test.tsx`, que prova que a rota NÃO é
  // chamada); isto é a recusa que vale pra qualquer cliente, inclusive um bundle
  // velho no celular dele. A garantia é a porta de escrita (409 com frase).
  //
  // ⚠️ A janela de PREVISÃO zero NÃO está aqui: desde 2026-10-01 ela vale (ver
  // o bloco da previsão zero, abaixo).
  const MENTEM: [string, unknown][] = [
    ["janela_previsao_horas", -5],
    ["janela_previsao_horas", -0.5],
    ["janela_passado_horas", 0],
    ["janela_passado_horas", -5],
    ["limiar_mm", 0],
    ["limiar_mm", -5],
  ];
  for (const campo of ["janela_previsao_horas", "janela_passado_horas", "limiar_mm"]) {
    // `JSON.parse("1e999")` devolve `Infinity`.
    MENTEM.push([campo, 1e999], [campo, "6"], [campo, null]);
  }
  for (const [campo, valor] of MENTEM) {
    it(`${campo} = ${JSON.stringify(valor)}: 400, e nada previsto vaza`, async () => {
      const { status, texto } = await prever(RAMPA, campo, valor);

      expect(status).toBe(400);
      expect(texto, "um corpo de 400 que carrega carimbo").toBe("");
      expect(espiaoFetch, "um número que mente custou uma busca no provedor").not.toHaveBeenCalled();
    });
  }

  // 🔴 E A RECUSA BARATA É MEDIDA COMO BARATA — sem isto ela é uma PORTA EM SÉRIE
  // com a de baixo (a 47ª espécie). O que distingue as duas camadas é o CUSTO: a
  // de cima acontece antes de o Turso ser tocado.
  it("o número que mente é recusado ANTES de qualquer consulta ao banco", async () => {
    const real = c.execute.bind(c);
    const espiaoSql = vi.fn((...args: Parameters<typeof real>) => real(...args));
    c.execute = espiaoSql as unknown as typeof c.execute;

    for (const [campo, valor] of [
      ["limiar_mm", 0],
      ["janela_previsao_horas", TETO_PREVISAO_HORAS + 1],
      ["janela_passado_horas", TETO_PASSADO_HORAS + 1],
    ] as const) {
      const r = await prever(RAMPA, campo, valor);
      expect(r.status, `${campo} = ${valor}`).toBe(400);
      expect(espiaoSql, `${campo} = ${valor} custou uma ida ao Turso antes de ser recusado`).not.toHaveBeenCalled();
    }

    // E a premissa, no mesmo caso: um número bom DE FATO consulta o banco.
    const bom = await prever(RAMPA, "limiar_mm", 1);
    expect(bom.status).toBe(200);
    expect(espiaoSql.mock.calls.length, "a rota não consultou o banco nem pro número bom").toBeGreaterThan(0);
  });

  // 🔴 A DIREÇÃO QUE IMPORTA MAIS NUMA PORTA: o que ela NÃO pode recusar.
  for (const [campo, valor] of [
    ["janela_passado_horas", 2.5],
    ["janela_previsao_horas", 1.5],
    ["limiar_mm", 0.2],
    ["limiar_mm", 0.05],
    ["janela_passado_horas", 240],
  ] as const) {
    it(`${campo} = ${valor} NÃO é recusado: é número que um dono pode querer`, async () => {
      const { status } = await prever(RAMPA, campo, valor);

      expect(status, "a porta recusou um valor legítimo e trancaria o dono").toBe(200);
    });
  }

  // 🔴 E A REGRA GRAVADA QUE JÁ MENTE NÃO TRANCA O DONO. Herdado um limiar zero,
  // a prévia de OUTRO número não tem carimbo honesto a mostrar (400) — mas trocar
  // justamente o número que mente dá prévia.
  it("regra gravada com limiar zero: prever outro número dá 400, e consertar o limiar dá 200", async () => {
    const rampa = exigir(RAMPA);
    const comLimiarZero = {
      ...rampa,
      condicao: { ...rampa.condicao, regra: { ...rampa.condicao.regra, limiar_mm: 0 } },
    };
    await gravarVersao(c, RAMPA, JSON.stringify(comLimiarZero), "semente", AGORA);
    ceu(CHUVA_ATRAS);

    expect((await prever(RAMPA, "janela_passado_horas", 8)).status).toBe(400);

    const conserto = await prever(RAMPA, "limiar_mm", 1);
    expect(conserto.status, "o dono ficou TRANCADO de consertar o número que mente").toBe(200);
    expect(conserto.corpo.marca).toBe("Não vá");
  });

  // 🔴 O EXAME DA REGRA INTEIRA OLHA OS TRÊS NÚMEROS, cada um por si — com a
  // janela do passado gravada zero e com o teto estourado na janela de previsão
  // gravada. Sem estes, o exame podia olhar só o limiar e o caso de cima passaria.
  for (const [nome, regraGravada] of [
    ["janela do passado gravada zero", { janela_passado_horas: 0 }],
    ["janela de previsão gravada acima do teto", { janela_previsao_horas: TETO_PREVISAO_HORAS + 24 }],
    ["janela do passado gravada acima do teto", { janela_passado_horas: TETO_PASSADO_HORAS + 24 }],
  ] as const) {
    it(`${nome}: prever o limiar dá 400`, async () => {
      const rampa = exigir(RAMPA);
      const torta = {
        ...rampa,
        condicao: { ...rampa.condicao, regra: { ...rampa.condicao.regra, ...regraGravada } },
      };
      await gravarVersao(c, RAMPA, JSON.stringify(torta), "semente", AGORA);

      expect((await prever(RAMPA, "limiar_mm", 1)).status).toBe(400);
      expect(espiaoFetch, "a regra que mente custou uma busca").not.toHaveBeenCalled();
    });
  }
});

describe("POST /api/admin/previsao-carimbo — o teto do provedor (F2)", () => {
  // 🔴 O LIMITE É O DA OPEN-METEO, MEDIDO: 16 dias pra frente, 93 pra trás. No
  // teto a busca sai com o máximo que o provedor aceita; um acima, a prévia nem
  // pergunta — o provedor recusaria com 400 e a prévia não tem nada a mostrar.
  it("no teto, a busca sai com 16 dias pra frente e 93 pra trás", async () => {
    expect((await prever(RAMPA, "janela_previsao_horas", TETO_PREVISAO_HORAS)).status).toBe(200);
    expect((await prever(RAMPA, "janela_passado_horas", TETO_PASSADO_HORAS)).status).toBe(200);

    const [frente, tras] = pedidos();
    expect(frente.searchParams.get("forecast_days")).toBe("16");
    expect(tras.searchParams.get("past_days")).toBe("93");
  });

  for (const [campo, valor] of [
    ["janela_previsao_horas", TETO_PREVISAO_HORAS + 1],
    ["janela_previsao_horas", TETO_PREVISAO_HORAS + 0.5],
    ["janela_previsao_horas", 480],
    ["janela_passado_horas", TETO_PASSADO_HORAS + 1],
    ["janela_passado_horas", 3000],
  ] as const) {
    it(`${campo} = ${valor}: 400, sem perguntar ao provedor`, async () => {
      const { status, texto } = await prever(RAMPA, campo, valor);

      expect(status).toBe(400);
      expect(texto).toBe("");
      expect(espiaoFetch).not.toHaveBeenCalled();
    });
  }
});

describe("POST /api/admin/previsao-carimbo — previsão ZERO vale (decisão do João, 2026-10-01)", () => {
  // 🔴 "SÓ OLHAR A CHUVA QUE JÁ CAIU." Com a previsão zero, a janela do passado
  // continua fechando o lugar: chuva caída → "Não vá"; chuva só prevista → "Pode
  // ir"; e seco → "Pode ir".
  it("previsão 0: carimbo de verdade, que fecha com chuva caída e ignora a prevista", async () => {
    ceu(CHUVA_ATRAS);
    const caida = await prever(RAMPA, "janela_previsao_horas", 0);
    expect(caida.status, "a prévia recusou a previsão zero").toBe(200);
    expect(caida.corpo.estado, "com chuva caída, a previsão zero deixou de fechar").toBe("frio");
    // `buildUrl` arredonda pra 1 dia no mínimo — o provedor não recebe 0.
    expect(pedidos()[0].searchParams.get("forecast_days")).toBe("1");

    ceu({ 1: 5 });
    const prevista = await prever(RAMPA, "janela_previsao_horas", 0);
    expect(prevista.status).toBe(200);
    expect(prevista.corpo.estado, "a previsão zero olhou chuva prevista").toBe("fresco");
  });
});

describe("POST /api/admin/previsao-carimbo — as guardas", () => {
  it("sem ADMIN_SENHA no env: 404, e nada previsto vaza", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST: semSenha } = await import("@/app/api/admin/previsao-carimbo/route");

    const res = await semSenha(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(espiaoFetch).not.toHaveBeenCalled();
  });

  it("painel ligado, sem cookie: 401, e nada previsto vaza", async () => {
    const res = await POST(pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }));

    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
    expect(espiaoFetch).not.toHaveBeenCalled();
  });

  it("cookie assinado com outro segredo: 401", async () => {
    const forjado = criarSessao("outro-segredo-qualquer", AGORA, DURACAO_SESSAO_S);
    const res = await POST(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, forjado),
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("slug que não existe no acervo: 400", async () => {
    const { status } = await prever("morro-inventado", "limiar_mm", 1);
    expect(status).toBe(400);
    expect(espiaoFetch).not.toHaveBeenCalled();
  });

  // 🔴 F3 DA ONDA DE CONSERTO: LUGAR ESCONDIDO CONTINUA SENDO LUGAR QUE ELE EDITA.
  // A existência sai de `versaoAtual`, que não filtra `oculto`; `getFicha` filtra.
  // Sem este caso, a mutação "a prévia recusa lugar oculto" sobrevivia (medido na
  // revisão: 47/47 verdes) — o mesmo regresso que a rota de visibilidade já pagou.
  it("lugar ESCONDIDO: a prévia responde com carimbo, como pra qualquer lugar", async () => {
    const rampa = exigir(RAMPA);
    await gravarVersao(c, RAMPA, JSON.stringify(rampa), "painel", AGORA, true);
    ceu(CHUVA_ATRAS);

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status, "a prévia tratou o lugar escondido como lugar que não existe").toBe(200);
    expect(corpo.marca).toBe("Não vá");
  });

  it("slug que não é string: 400", async () => {
    const res = await POST(pedido({ slug: 42, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom));
    expect(res.status).toBe(400);
  });

  it("corpo que não é JSON: 400", async () => {
    const res = await POST(
      new Request("http://x/api/admin/previsao-carimbo", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${cookieBom}` },
        body: "isto nao e json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("corpo JSON `null`: 400, sem exceção", async () => {
    expect((await POST(pedido(null, cookieBom))).status).toBe(400);
  });

  // 🔴 DOCUMENTO QUE NÃO ABRE NÃO TEM CARIMBO A PREVER.
  it("documento que nem abre: 400, sem exceção", async () => {
    await gravarVersao(c, RAMPA, JSON.stringify({ slug: RAMPA }), "painel", AGORA);

    const { status } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(400);
    expect(espiaoFetch).not.toHaveBeenCalled();
  });

  // 🔴 O GUARDA DAS DUAS DIREÇÕES SOBRE **QUAIS** CAMPOS SÃO NÚMERO DE MOTOR, e
  // ele mede o COMPORTAMENTO da rota contra o REGISTRO DE CAMPOS.
  it("a rota aceita exatamente os campos `numero` do registro, e recusa os outros", async () => {
    const numeros = CAMPOS_DA_FICHA.filter((x) => x.especie === "numero");
    expect(numeros.length, "o registro perdeu os campos de número: o guarda ficaria oco").toBe(3);

    for (const campo of numeros) {
      const res = await POST(pedido({ slug: RAMPA, campo: campo.caminho, valor: 4 }, cookieBom));
      expect(res.status, `${campo.caminho} é \`numero\` no registro e a rota o recusou`).toBe(200);
    }

    const outros = CAMPOS_DA_FICHA.filter((x) => x.especie !== "numero");
    expect(outros.length, "o registro perdeu os outros campos").toBeGreaterThan(20);
    for (const campo of outros) {
      const res = await POST(pedido({ slug: RAMPA, campo: campo.caminho, valor: 4 }, cookieBom));
      expect(res.status, `${campo.caminho} NÃO é número e a rota aceitou prever sobre ele`).toBe(400);
    }
  });

  it("campo que não existe em registro nenhum: 400", async () => {
    for (const campo of ["condicao.regra.tipo", "condicao.regra", "limiar_mm", "", "slug"]) {
      const res = await POST(pedido({ slug: RAMPA, campo, valor: 4 }, cookieBom));
      expect(res.status, `a rota aceitou prever sobre \`${campo}\``).toBe(400);
    }
  });

  it("campo ausente do corpo: 400", async () => {
    expect((await POST(pedido({ slug: RAMPA, valor: 4 }, cookieBom))).status).toBe(400);
    expect((await POST(pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm" }, cookieBom))).status).toBe(
      400,
    );
  });

  it("a resposta nunca é guardável: `no-store` no 200 e no 503", async () => {
    const comFala = await POST(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );
    expect(comFala.status).toBe(200);
    expect(comFala.headers.get("cache-control")).toBe("no-store");

    ceuQue(() => Promise.reject(new Error("sem rede")));
    const semChuva = await POST(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );
    expect(semChuva.status).toBe(503);
    expect(semChuva.headers.get("cache-control")).toBe("no-store");
  });
});
