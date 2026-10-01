import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA } from "@/lib/campos-da-ficha";
import { ensureSchema, getFreshness, gravarVersao, historico, upsertFreshness } from "@/lib/db";
import type { Ficha } from "@/types/ficha";
import { semearAcervo } from "../banco";

/** A PRÉVIA DO CARIMBO (Task 7, 2026-09-30) — o que a tela do lugar diria com o
 *  número novo, sem gravar nada e sem tocar o provedor externo.
 *
 *  Molde: `tests/api/route-admin-visibilidade.test.ts` — `Request` à mão,
 *  `process.env` por `vi.stubEnv`, `criarSessao` de verdade, acervo do BANCO por
 *  `semearAcervo`.
 *
 *  🔴 A CHUVA É INJETADA, NUNCA BUSCADA, e é isso que torna este arquivo uma
 *  prova. A versão deste teste que o plano escrevia (*"limiar 999 e limiar 0.1
 *  dão carimbos diferentes"*, sem dizer de onde vinha a chuva) só é verdadeira
 *  numa semana de chuva: numa semana seca os dois dariam `fresco` e ela ficaria
 *  vermelha — ou verde por sorte, que é pior. Prova que passa ou falha pelo clima
 *  não prova nada sobre o código. Aqui a chuva entra em `freshness.previsao_bruta`
 *  pelo mesmo `upsertFreshness` que o motor usa, e o relógio é falso.
 *
 *  🔴 E "NÃO GRAVA NADA" É MEDIDO EM TRÊS LUGARES, porque pelo tamanho do
 *  histórico não basta: a implementação honesta LÊ `freshness`, e uma descuidada
 *  chamaria `upsertFreshness` (é o que o `runMotor` faz). Então cada prova de
 *  "não gravou" confere `ficha_versoes`, `freshness` (estado E `calculado_em`) e
 *  a espiã no `fetch` global. */

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

/** Uma série horária como a Open-Meteo a devolve: `time` em ISO ingênuo de GMT
 *  (é o que `parsePrecip` espera) e `precipitation` do mesmo tamanho.
 *
 *  As horas vão de −12h a +12h em volta do `AGORA` falso, pra toda janela que
 *  este arquivo usa caber dentro da série — uma série mais curta que a janela
 *  mediria a borda da série em vez da regra. */
function serie(mmPorHora: Record<number, number>): string {
  const time: string[] = [];
  const precipitation: number[] = [];
  for (let h = -12; h <= 12; h++) {
    time.push(new Date((AGORA + h * H) * 1000).toISOString().slice(0, 16));
    precipitation.push(mmPorHora[h] ?? 0);
  }
  return JSON.stringify({ hourly: { time, precipitation } });
}

/** 5 mm UMA hora atrás: dentro de qualquer janela de passado que este arquivo
 *  usa, e fora de qualquer janela de previsão. */
const CHUVA_ATRAS = serie({ [-1]: 5 });
/** Nada, em hora nenhuma. */
const SECA = serie({});

async function porChuva(slug: string, bruta: string | null): Promise<void> {
  await upsertFreshness(c, {
    slug,
    estado: "fresco",
    calculadoEm: AGORA - 600,
    fonte: "open-meteo",
    previsaoBruta: bruta as string,
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);

  c = createClient({ url: ":memory:" });
  await ensureSchema(c);
  acervo = await semearAcervo(c);

  // 🔴 A ESPIÃ NO `fetch` GLOBAL É A PROVA DO "DE GRAÇA": se esta rota voltar a
  // buscar previsão (é o que `runMotor` faz, uma vez por ficha), ela aparece
  // aqui. O `@libsql/client` em `:memory:` não usa `fetch`, então qualquer
  // chamada é da rota.
  espiaoFetch = vi.fn(() => Promise.reject(new Error("a prévia NÃO pode tocar o provedor externo")));
  vi.stubGlobal("fetch", espiaoFetch);

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

type Corpo = { estado?: string; marca?: string; sub?: string; semLeitura?: boolean };

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
    await porChuva(RAMPA, CHUVA_ATRAS);

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.estado).toBe("frio");
    // 🔴 A FALA, não o nome do parâmetro nem o estado cru: é a única razão desta
    // rota existir. "Não vá" é a `voz` da Rampa (severidade `nao-va`), e sai de
    // `src/lib/severidade.ts` — as MESMAS palavras da ficha pública.
    expect(corpo.marca).toBe("Não vá");
    expect(corpo.sub).toBe("barro · dá um tempo");
  });

  // 🔴 O CASO DO PLANO, agora determinístico: a MESMA chuva, dois limiares, dois
  // carimbos. Se os dois dessem o mesmo, a tela estaria mentindo sobre a
  // consequência — e a mutação "a prévia ignora o valor recebido" morre aqui.
  it("limiar diferente muda o carimbo, com a MESMA chuva", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);

    const seco = await prever(RAMPA, "limiar_mm", 999);
    const molhado = await prever(RAMPA, "limiar_mm", 0.1);

    expect(seco.status).toBe(200);
    expect(molhado.status).toBe(200);
    expect(seco.corpo.estado).toBe("fresco");
    expect(molhado.corpo.estado).toBe("frio");
    // e a PALAVRA muda junto — estado diferente com a mesma fala seria a tela
    // dizendo a mesma coisa sobre duas regras diferentes.
    expect(seco.corpo.marca).toBe("Pode ir");
    expect(molhado.corpo.marca).toBe("Não vá");
    expect(seco.corpo.marca).not.toBe(molhado.corpo.marca);
  });

  it("a janela do passado diferente muda o carimbo, com a MESMA chuva", async () => {
    // 5 mm SETE horas atrás: dentro de uma janela de 12h, fora de uma de 3h.
    await porChuva(RAMPA, serie({ [-7]: 5 }));

    const curta = await prever(RAMPA, "janela_passado_horas", 3);
    const longa = await prever(RAMPA, "janela_passado_horas", 12);

    expect(curta.corpo.estado, "3h não alcança uma chuva de 7h atrás").toBe("fresco");
    expect(longa.corpo.estado, "12h alcança").toBe("frio");
  });

  it("a janela de previsão diferente muda o carimbo, com a MESMA chuva", async () => {
    await porChuva(RAMPA, serie({ 7: 5 }));

    const curta = await prever(RAMPA, "janela_previsao_horas", 3);
    const longa = await prever(RAMPA, "janela_previsao_horas", 12);

    expect(curta.corpo.estado).toBe("fresco");
    expect(longa.corpo.estado).toBe("frio");
  });

  // 🔴 A4 DO BRIEF: A FALA SAI DA REGRA NOVA, NÃO DA GRAVADA. `vozDaFicha`
  // devolve `horasPassado: regra.janela_passado_horas`, e a fala do nível
  // `espera` é literalmente `Espera {n}h`. Montada a partir da ficha do banco, o
  // dono digitaria 12 e leria "Espera 3h" ao lado de um estado calculado com 12:
  // a tela se contradizendo numa frase só. DOIS valores, pra colapsar a fala numa
  // constante também morrer.
  it("a fala leva o número NOVO, não o que está gravado", async () => {
    const pedra = exigir(PEDRA);
    expect(pedra.condicao.severidade, "esta ficha deixou de ser a do `espera`").toBe("espera");
    expect(pedra.condicao.regra.janela_passado_horas, "o valor gravado mudou").toBe(3);
    await porChuva(PEDRA, CHUVA_ATRAS);

    const doze = await prever(PEDRA, "janela_passado_horas", 12);
    const nove = await prever(PEDRA, "janela_passado_horas", 9);

    expect(doze.corpo.estado, "a premissa: com chuva atrás o ramo molhado é o que fala").toBe("frio");
    expect(doze.corpo.marca).toBe("Espera 12h");
    expect(nove.corpo.marca).toBe("Espera 9h");
    expect(doze.corpo.marca, "a fala não leva o número gravado").not.toBe("Espera 3h");
  });

  // 🔴 E a fala do OUTRO número não se mexe: trocar o limiar não pode mudar o
  // "Espera 3h" pra outro número, porque aquele número é a janela do passado.
  // Sem este caso, montar a `voz` com o valor editado em QUALQUER campo passaria
  // verde no caso de cima.
  it("trocar o limiar não troca o número da fala", async () => {
    await porChuva(PEDRA, CHUVA_ATRAS);

    const { corpo } = await prever(PEDRA, "limiar_mm", 1);

    expect(corpo.estado).toBe("frio");
    expect(corpo.marca, "o número da fala é a janela do passado GRAVADA, que não mudou").toBe("Espera 3h");
  });
});

describe("POST /api/admin/previsao-carimbo — não grava, e não toca o provedor", () => {
  it("não grava versão, não mexe no `freshness`, e não busca previsão", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);
    const antesHist = await historico(c, RAMPA);
    const antesFresh = (await getFreshness(c, RAMPA))!;

    const { status } = await prever(RAMPA, "limiar_mm", 42);

    expect(status).toBe(200);
    expect(await historico(c, RAMPA), "a prévia gravou uma versão").toHaveLength(antesHist.length);
    const depois = (await getFreshness(c, RAMPA))!;
    expect(depois.estado, "a prévia sobrescreveu o estado do motor").toBe(antesFresh.estado);
    expect(depois.calculado_em, "a prévia sobrescreveu a hora do motor").toBe(antesFresh.calculado_em);
    expect(depois.previsao_bruta).toBe(antesFresh.previsao_bruta);
    expect(espiaoFetch, "a prévia bateu no provedor externo").not.toHaveBeenCalled();
  });

  // 🔴 E O LUGAR QUE A PRÉVIA **NÃO** PEDIU TAMBÉM NÃO SE MEXE. `runMotor` lê
  // TODAS as fichas e grava TODAS: uma prévia que o chamasse gravaria estado dos
  // três lugares a cada toque de tecla, e o caso de cima — que olha só a Rampa —
  // não veria isso se a Rampa fosse gravada com o mesmo valor.
  it("o `freshness` dos OUTROS lugares não é criado nem tocado", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);
    expect(await getFreshness(c, PEDRA), "a premissa: este lugar não tem leitura").toBeNull();

    await prever(RAMPA, "limiar_mm", 42);

    expect(await getFreshness(c, PEDRA), "a prévia gravou leitura de um lugar que ninguém pediu").toBeNull();
    expect(await historico(c, PEDRA)).toHaveLength(1); // só a semente
  });
});

describe("POST /api/admin/previsao-carimbo — sem chuva lida, a prévia CALA", () => {
  it("lugar sem linha de `freshness`: `semLeitura`, e carimbo nenhum", async () => {
    expect(await getFreshness(c, RAMPA)).toBeNull();

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.semLeitura).toBe(true);
    // 🔴 O PONTO DO CASO: nem um carimbo inventado. Um `fresco` de reserva aqui
    // diria ao dono que o lugar está liberado, sem o app ter lido chuva nenhuma.
    expect(corpo.estado, "a prévia inventou um estado sem chuva lida").toBeUndefined();
    expect(corpo.marca, "a prévia inventou uma fala sem chuva lida").toBeUndefined();
  });

  it("linha com a coluna de chuva em branco: `semLeitura`", async () => {
    await porChuva(RAMPA, null);

    const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(200);
    expect(corpo.semLeitura).toBe(true);
    expect(corpo.estado).toBeUndefined();
  });

  for (const [nome, bruta] of [
    ["não é JSON", "isto nao e json"],
    ["é JSON sem `hourly`", '{"latitude":-8.2}'],
    // 🔴 Este é o estado que `parsePrecip` existe pra barrar: hora sem medida não
    // pode virar hora seca por acidente de índice. Ele estoura, e a prévia tem de
    // cair em "não sei" — nunca num carimbo montado com metade da série.
    ["tem menos medidas que horas", '{"hourly":{"time":["2025-09-19T18:00","2025-09-19T19:00"],"precipitation":[0]}}'],
  ] as const) {
    it(`chuva guardada que ${nome}: \`semLeitura\`, sem exceção`, async () => {
      await porChuva(RAMPA, bruta);

      const { status, corpo } = await prever(RAMPA, "limiar_mm", 1);

      expect(status).toBe(200);
      expect(corpo.semLeitura).toBe(true);
      expect(corpo.estado).toBeUndefined();
    });
  }
});

describe("POST /api/admin/previsao-carimbo — a camada da ROTA recusa a regra que mente", () => {
  // 🔴 ESTA É A CAMADA DO MEIO, e o caso existe pra provar QUEM recusou. O
  // cliente recusa antes (ver `tests/app/admin-editor-numero.test.tsx`, que prova
  // que a rota NÃO é chamada); isto é a recusa que vale pra qualquer cliente,
  // inclusive um bundle velho no celular dele. A garantia é a TERCEIRA camada, a
  // porta de escrita — e ela já existia: o portão de coerência de
  // `PUT /api/admin/ficha` devolve 409 com a frase da regra `janela-nao-zerada`.
  for (const campo of ["janela_previsao_horas", "janela_passado_horas", "limiar_mm"]) {
    for (const [nome, valor] of [
      ["zero", 0],
      ["negativo", -5],
      // `JSON.parse("1e999")` devolve `Infinity`, e `Infinity > 0` é verdadeiro:
      // sem `Number.isFinite`, uma janela infinita somaria TODA a série e a rota
      // responderia com cara de resposta.
      ["infinito", 1e999],
      ["texto", "6"],
      ["nulo", null],
    ] as const) {
      it(`${campo} ${nome}: 400, e nada previsto vaza`, async () => {
        await porChuva(RAMPA, CHUVA_ATRAS);

        const { status, texto } = await prever(RAMPA, campo, valor);

        expect(status).toBe(400);
        expect(texto, "um corpo de 400 que carrega carimbo").toBe("");
        expect(espiaoFetch).not.toHaveBeenCalled();
      });
    }
  }

  // 🔴 E A RECUSA BARATA É MEDIDA COMO BARATA — sem isto ela é uma PORTA EM SÉRIE
  // com a de baixo (a 47ª espécie: a mutação que arranca a de cima sobrevive
  // porque a de baixo estoura igual, e o teste nunca soube QUEM recusou). Medido:
  // arrancar a recusa de cima e deixar só `typeof valor !== "number"` deixava os
  // 15 casos de 400 acima VERDES, porque o exame dos três números, mais abaixo,
  // recusa o mesmo zero depois de duas consultas ao banco. O que distingue as duas
  // camadas é o CUSTO: a de cima acontece antes de o Turso ser tocado, e é por
  // isso que ela existe numa rede de interior.
  it("o número que mente é recusado ANTES de qualquer consulta ao banco", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);
    const real = c.execute.bind(c);
    const espiaoSql = vi.fn((...args: Parameters<typeof real>) => real(...args));
    c.execute = espiaoSql as unknown as typeof c.execute;

    const zero = await prever(RAMPA, "limiar_mm", 0);

    expect(zero.status).toBe(400);
    expect(espiaoSql, "o zero custou uma ida ao Turso antes de ser recusado").not.toHaveBeenCalled();

    // E a premissa, no mesmo caso: um número bom DE FATO consulta o banco — senão
    // esta prova passaria verde numa rota que nunca consulta nada.
    const bom = await prever(RAMPA, "limiar_mm", 1);
    expect(bom.status).toBe(200);
    expect(espiaoSql.mock.calls.length, "a rota não consultou o banco nem pro número bom").toBeGreaterThan(1);
  });

  // 🔴 A DIREÇÃO QUE IMPORTA MAIS NUMA PORTA: o que ela NÃO pode recusar. Janela
  // fracionária é valor que um dono pode querer de verdade — `avaliar` a usa sem
  // reclamar e `buildUrl` a arredonda pra cima em dias. Numa porta, falso positivo
  // é pior que falso negativo, porque trava o dono de gravar uma verdade. Este
  // caso fica vermelho no dia em que alguém puser `.int()` na recusa.
  for (const [campo, valor] of [
    ["janela_passado_horas", 2.5],
    ["janela_previsao_horas", 1.5],
    ["limiar_mm", 0.2],
    ["limiar_mm", 0.05],
    ["janela_passado_horas", 240],
  ] as const) {
    it(`${campo} = ${valor} NÃO é recusado: é número que um dono pode querer`, async () => {
      await porChuva(RAMPA, CHUVA_ATRAS);

      const { status } = await prever(RAMPA, campo, valor);

      expect(status, "a porta recusou um valor legítimo e trancaria o dono").toBe(200);
    });
  }

  // 🔴 E A REGRA GRAVADA QUE JÁ MENTE NÃO TRANCA O DONO. Herdado um limiar zero,
  // a prévia de OUTRO número não tem carimbo honesto a mostrar (400) — mas trocar
  // justamente o número que mente dá prévia na mesma tecla. Sem este par, a
  // recusa dos três números seria uma porta de mão única.
  it("regra gravada com limiar zero: prever outro número dá 400, e consertar o limiar dá 200", async () => {
    const rampa = exigir(RAMPA);
    const comLimiarZero = {
      ...rampa,
      condicao: { ...rampa.condicao, regra: { ...rampa.condicao.regra, limiar_mm: 0 } },
    };
    await gravarVersao(c, RAMPA, JSON.stringify(comLimiarZero), "semente", AGORA);
    await porChuva(RAMPA, CHUVA_ATRAS);

    expect((await prever(RAMPA, "janela_passado_horas", 8)).status).toBe(400);

    const conserto = await prever(RAMPA, "limiar_mm", 1);
    expect(conserto.status, "o dono ficou TRANCADO de consertar o número que mente").toBe(200);
    expect(conserto.corpo.marca).toBe("Não vá");
  });
});

describe("POST /api/admin/previsao-carimbo — as guardas", () => {
  it("sem ADMIN_SENHA no env: 404, e nada previsto vaza", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST: semSenha } = await import("@/app/api/admin/previsao-carimbo/route");
    await porChuva(RAMPA, CHUVA_ATRAS);

    const res = await semSenha(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("painel ligado, sem cookie: 401, e nada previsto vaza", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);

    const res = await POST(pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }));

    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
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

  // 🔴 DOCUMENTO QUE NÃO ABRE NÃO TEM CARIMBO A PREVER. Um `fichaSchema.parse`
  // sem `try` aqui seria uma exceção não tratada numa rota que devolve 400
  // controlado em todo outro ponto — e um carimbo montado por cima de uma ficha
  // que o app não consegue ler seria pior ainda.
  it("documento que nem abre: 400, sem exceção", async () => {
    await gravarVersao(c, RAMPA, JSON.stringify({ slug: RAMPA }), "painel", AGORA);
    await porChuva(RAMPA, CHUVA_ATRAS);

    const { status } = await prever(RAMPA, "limiar_mm", 1);

    expect(status).toBe(400);
  });

  // 🔴 O GUARDA DAS DUAS DIREÇÕES SOBRE **QUAIS** CAMPOS SÃO NÚMERO DE MOTOR, e
  // ele mede o COMPORTAMENTO da rota contra o REGISTRO DE CAMPOS — nunca uma
  // lista escrita aqui. Um parâmetro novo na regra de chuva entra pelos dois
  // lados sozinho; um campo de PROSA que a rota passasse a aceitar sai vermelho.
  it("a rota aceita exatamente os campos `numero` do registro, e recusa os outros", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);
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
    await porChuva(RAMPA, CHUVA_ATRAS);
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

  it("a resposta nunca é guardável: `no-store` nas duas formas do 200", async () => {
    await porChuva(RAMPA, CHUVA_ATRAS);
    const comFala = await POST(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );
    expect(comFala.headers.get("cache-control")).toBe("no-store");

    await porChuva(RAMPA, null);
    const semFala = await POST(
      pedido({ slug: RAMPA, campo: "condicao.regra.limiar_mm", valor: 1 }, cookieBom),
    );
    expect((await semFala.json()).semLeitura).toBe(true);
    expect(semFala.headers.get("cache-control")).toBe("no-store");
  });
});
