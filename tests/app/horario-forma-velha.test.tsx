import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/** 🔴 A FORMA VELHA DO HORÁRIO, LIDA DO BANCO PELO CAMINHO DE VERDADE (Tarefa
 *  11c, H1′ e 11c-I7 da auditoria).
 *
 *  O horário virou uma LISTA de faixas, e as fichas que já estão no banco —
 *  a Pedra Furada e o Véu de Noiva — foram gravadas no objeto de antes
 *  (`{"abre":"08:00","fecha":"17:00"}`). A semente não regrava slug existente,
 *  e o "voltar a uma versão" grava o documento antigo verbatim: a forma velha
 *  é PERMANENTE no banco. Se o schema de leitura não a aceitasse, a ficha das
 *  duas cachoeiras cairia — e, pior, `buscarFichas` derrubaria a home inteira.
 *
 *  🔴 POR QUE ESTE ARQUIVO EXISTE, se `content/fichas/*.json` também tem a forma
 *  velha: a suíte de hoje NÃO exercita a forma velha pelo BANCO. `semear` grava
 *  `JSON.stringify` do que `loadAll()` já passou pelo schema — depois da 11c,
 *  todo banco de teste semeado tem a forma LISTA. O documento aqui é a STRING
 *  LITERAL que a semente gravou para o Véu antes da 11c (gerada pelo código de
 *  `1de5d53`, `JSON.stringify(loadAll())`), entrando por `gravarVersao` — nunca
 *  um objeto montado, que passaria pela forma que eu acho que o banco tem, e
 *  não pela que ele tem.
 *
 *  O caminho medido é o da tela pública inteira — `[slug]/page.tsx` →
 *  `getFicha` → `buscarFichas` → `lerAcervoComOrigem` → SQL — e o do painel
 *  (`getAcervoDoDono`). A única peça trocada é para onde o `getClient` aponta. */

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getAcervoDoDono, getAllFichas, getFicha } = await import("@/lib/ficha");
const { gravarVersao } = await import("@/lib/db");
const Ficha = (await import("@/app/[slug]/page")).default;
const { bancoDeProducao, AGORA_SEMENTE } = await import("../banco");
const { aberturaDaFicha, rotuloFaixa, rotuloFaixaCurta } = await import("@/lib/horario");
const { TRES_PONTOS } = await import("../ficha-de-tres-pontos");

const banco = await bancoDeProducao();
const VEU = "veu-de-noiva-de-bonito";

/** O documento do Véu como a semente o gravou no banco ANTES da Tarefa 11c —
 *  byte a byte. Não editar: é a prova. */
const VEU_DE_HOJE = String.raw`{"slug":"veu-de-noiva-de-bonito","modos":["condicional"],"rotulo_escaneio":"Com chuva, com cuidado","promessa":"A maior cachoeira de Bonito.","voz":"Vale a ida. Mas o trecho de terra é um desafio na chuva: molhou, o barro fica pegajoso.","premio":"Um espetáculo natural do brejo pernambucano — a maior cachoeira de Bonito. É isso que espera no fim do trecho de terra.","trajeto":{"waypoints":[{"nome":"Cachoeira Véu de Noiva","lat":-8.5431216,"lng":-35.712826}]},"acesso":"Carro comum chega. Mas tem um trecho de terra no caminho, e é ele que manda: com chuva vira um desafio — o barro fica pegajoso.","avisos":"Se choveu, o trecho de terra fica pegajoso. E repare na hora: fecha às 17h, então chegar tarde é não entrar.","condicao":{"coords":{"lat":-8.5431216,"lng":-35.712826},"regra":{"tipo":"chuva_binaria","janela_previsao_horas":3,"janela_passado_horas":6,"limiar_mm":0.2},"severidade":"cuidado","regra_texto":"Choveu nas últimas ~6h OU vem chuva nas próximas ~3h → não vá: o trecho de terra fica pegajoso. Os três números são os da Rampa do Pepê, herdados por escolha dele em 2026-09-03 (\"acho que pode seguir a regra da chuva da rampa do pepê\") — e por enquanto são palpite, não medição daqui. Nada nesta regra afirma coisa alguma sobre a queda d'água: ele não tem registro de perigo ali e disse que não sabe opinar.","ressalva_proxy":"Chuva medida ≠ barro no trecho de terra — a grade do modelo não vê esse pedaço. Confirme no caminho."},"discriminador":{"formato":"trecho de terra","como_ler":"No trecho de terra: barro pegajoso = não vá.","permissao_abortar":"Voltar aqui é decisão boa. A cachoeira fica."},"custo":{"tag":"pago","valor":"R$ 10 por pessoa · pago na entrada","curto":"R$ 10 · entrada"},"piso":"barro","carroComum":true,"horario":{"abre":"08:00","fecha":"17:00"}}`;

async function pagina(slug = VEU) {
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco",
    erro: false,
    calculadoEm: Math.floor(Date.now() / 1000),
    aviso: null,
  });
  return render(await Ficha({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));
}

/** O relógio em Recife (UTC-3), num dia útil qualquer. */
const as = (h: number, m = 0) => vi.setSystemTime(Date.UTC(2027, 0, 15, h + 3, m));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  as(12);
  await gravarVersao(banco, VEU, VEU_DE_HOJE, "semente", AGORA_SEMENTE + 1);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(resolverEstado).mockReset();
});

describe("a ficha gravada na forma VELHA do horário, lida do banco", () => {
  // A premissa, medida: o documento é mesmo o objeto de antes. Sem isto, um
  // literal reescrito em lista passaria todos os casos abaixo sem provar nada.
  it("a premissa: o documento no banco tem o horário como OBJETO", () => {
    expect(JSON.parse(VEU_DE_HOJE).horario).toEqual({ abre: "08:00", fecha: "17:00" });
  });

  it("o getter público a lê, e o horário chega em LISTA", async () => {
    const f = await getFicha(VEU);
    expect(f, "a ficha do Véu caiu na leitura").not.toBeNull();
    expect(f!.horario).toEqual([{ abre: "08:00", fecha: "17:00" }]);
  });

  // 🔴 O PIOR CASO, e é por isso que ele tem caso próprio: `buscarFichas` faz um
  // `parse` só pra lista inteira — se a forma velha estourasse, a HOME perderia
  // os três lugares, não só o Véu.
  it("a lista da home continua com os três lugares", async () => {
    const slugs = (await getAllFichas()).map((f) => f.slug).sort();
    expect(slugs).toContain(VEU);
    expect(slugs.length, "a forma velha derrubou outros lugares junto").toBeGreaterThanOrEqual(3);
  });

  it("o painel do dono a lê também", async () => {
    const { fichas } = await getAcervoDoDono();
    expect(fichas.find((f) => f.slug === VEU)?.horario).toEqual([{ abre: "08:00", fecha: "17:00" }]);
  });

  // 🔴 A TELA PÚBLICA, com o veredito — byte a byte o que ela dizia antes da 11c.
  it("às 18h a página diz 'Fechado agora' e a frase de sempre", async () => {
    as(18);
    const { container } = await pagina();
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".reason")?.textContent).toBe("Fecha às 17h, abre às 8h.");
    expect(container.querySelector(".tk.hora")?.textContent).toBe("8h–17h");
  });

  it("ao meio-dia a página não diz que fechou", async () => {
    as(12);
    const { container } = await pagina();
    expect(container.querySelector(".mark")?.textContent).not.toBe("Fechado agora");
    expect(container.querySelector(".tk.hora")?.textContent).toBe("8h–17h");
  });
});

/** 🔴 A LISTA FORA DE ORDEM, LIDA DO BANCO (I-1 da revisão da 11c). O schema de
 *  leitura só confere FORMA, e o "voltar a uma versão" grava verbatim: uma lista
 *  `[14–17, 08–10]` chega à tela como está. O motivo ordenava e o tíquete não —
 *  a mesma página dizia as faixas em duas ordens. O lugar é o MARCADOR da
 *  `ficha-de-tres-pontos` (nenhum lugar real ganha horário inventado), e o
 *  documento entra como STRING por `gravarVersao`, nunca pela semente. */
describe("a lista de faixas FORA DE ORDEM, lida do banco", () => {
  const MARCADOR = TRES_PONTOS.slug;
  const INVERTIDA = JSON.stringify({
    ...TRES_PONTOS,
    horario: [
      { abre: "14:00", fecha: "17:00" },
      { abre: "08:00", fecha: "10:00" },
    ],
  });

  beforeEach(async () => {
    await gravarVersao(banco, MARCADOR, INVERTIDA, "painel", AGORA_SEMENTE + 2);
  });

  it("a premissa: o documento no banco tem as faixas na ordem INVERTIDA", async () => {
    expect(JSON.parse(INVERTIDA).horario[0].abre).toBe("14:00");
    expect((await getFicha(MARCADOR))!.horario![0].abre, "o getter reordenou: o caso não mede a tela").toBe("14:00");
  });

  it("o motivo diz as faixas na ordem do dia", async () => {
    const f = (await getFicha(MARCADOR))!;
    expect(rotuloFaixa(aberturaDaFicha(f))).toBe("Abre das 8h às 10h e das 14h às 17h.");
  });

  it("o tíquete diz as faixas na ordem do dia", async () => {
    const f = (await getFicha(MARCADOR))!;
    expect(rotuloFaixaCurta(f.horario!)).toBe("8h–10h · 14h–17h");
  });

  it("na página, às 11h: fechado, abre às 14h — e motivo e tíquete na mesma ordem", async () => {
    as(11);
    const { container } = await pagina(MARCADOR);
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".reason")?.textContent).toBe("Abre das 8h às 10h e das 14h às 17h.");
    expect(container.querySelector(".tk.hora")?.textContent).toBe("8h–10h · 14h–17h");
  });
});
