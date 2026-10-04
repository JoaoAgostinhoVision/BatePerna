import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/** 🔴 O HORÁRIO COM INTERVALO, DE PONTA A PONTA, NA FICHA NO AR (Tarefa 11d, D2).
 *
 *  O dono abre a ficha inteira do lugar, transforma o horário de uma faixa no
 *  do almoço (8–10 e 14–17) pelo editor — "+ outra faixa", as quatro horas, UM
 *  Salvar —, e a ficha PÚBLICA, lida da fonte de verdade, diz às 11h "fechado,
 *  abre às 14h". Se o editor, a porta e a leitura pública discordassem em
 *  qualquer ponto, ele salvaria 8–10 e 14–17 e a ficha pública mostraria outra
 *  coisa — é isto que este arquivo prova que não acontece.
 *
 *  Nenhuma peça do caminho é dublada além do que não existe num teste: o
 *  `fetch` do editor é entregue à ROTA de verdade (`PUT /api/admin/ficha`, com a
 *  sessão de verdade), o banco é o `:memory:` que o `getClient` de produção abre
 *  (`bancoDeProducao`), e a leitura é `getFicha` → `[slug]/page.tsx`. O lugar é
 *  o MARCADOR da `ficha-de-tres-pontos` — nenhum lugar real ganha horário
 *  inventado. A mesma prova pelo RASCUNHO (M1 da auditoria) está em
 *  `admin-formulario-de-lugar.test.tsx`. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-horario";
vi.stubEnv("ADMIN_SENHA", SENHA);
vi.stubEnv("ADMIN_SEGREDO", SEGREDO);

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { getFicha } = await import("@/lib/ficha");
const { gravarVersao, historico } = await import("@/lib/db");
const { esquecerMemoria } = await import("@/lib/ficha-fonte");
const { COOKIE_ADMIN } = await import("@/lib/admin-guarda");
const { criarSessao, DURACAO_SESSAO_S } = await import("@/lib/admin-sessao");
const { aberturaDaFicha, agoraRecife, fechadoAgora, rotuloAbertura } = await import("@/lib/horario");
const rota = await import("@/app/api/admin/ficha/route");
const FichaInteira = (await import("@/app/admin/FichaInteira")).default;
const Ficha = (await import("@/app/[slug]/page")).default;
const { bancoDeProducao, AGORA_SEMENTE } = await import("../banco");
const { TRES_PONTOS } = await import("../ficha-de-tres-pontos");

const banco = await bancoDeProducao();
const MARCADOR = TRES_PONTOS.slug;
const ALMOCO = [
  { abre: "08:00", fecha: "10:00" },
  { abre: "14:00", fecha: "17:00" },
];

/** O relógio em Recife (UTC-3), numa sexta qualquer — o marcador não tem `dias`. */
const as = (h: number, m = 0) => vi.setSystemTime(Date.UTC(2027, 0, 15, h + 3, m));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  as(11);
  await gravarVersao(
    banco,
    MARCADOR,
    JSON.stringify({ ...TRES_PONTOS, horario: [{ abre: "05:00", fecha: "17:00" }] }),
    "semente",
    AGORA_SEMENTE + 3,
  );
  esquecerMemoria();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(resolverEstado).mockReset();
});

/** O `fetch` do editor entregue à rota de VERDADE, com o cookie da sessão; e o
 *  `location.reload` dublado (é o que a ficha no ar faz depois de gravar — a
 *  prova G1 da onda 2 continua valendo: nada de navegar). */
function comRotaDeVerdade() {
  const token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  const corpos: unknown[] = [];
  const respostas: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method: string; body: string }) => {
      corpos.push(JSON.parse(init.body));
      const r = await rota.PUT(
        new Request(`http://x${url}`, { method: init.method, headers: { cookie: `${COOKIE_ADMIN}=${token}` }, body: init.body }),
      );
      respostas.push(r.status);
      return r;
    }),
  );
  const reload = vi.fn();
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload, assign });
  return { corpos, respostas, reload, assign };
}

describe("o almoço pelo editor da ficha no ar, lido pela fonte pública", () => {
  it("a premissa: o marcador está no ar com UMA faixa, e às 11h está aberto", async () => {
    const f = (await getFicha(MARCADOR))!;
    expect(f.horario).toEqual([{ abre: "05:00", fecha: "17:00" }]);
    expect(fechadoAgora(aberturaDaFicha(f), agoraRecife(Math.floor(Date.now() / 1000)))).toBe(false);
  });

  it("'+ outra faixa', as quatro horas, UM Salvar → a fonte pública diz às 11h: fechado, abre às 14h", async () => {
    const { corpos, respostas, reload, assign } = comRotaDeVerdade();
    const antes = (await historico(banco, MARCADOR)).length;
    render(<FichaInteira ficha={(await getFicha(MARCADOR))!} />);
    const h = screen.getByTestId("campo-horario");
    fireEvent.click(h.querySelector("[data-mais-faixa]")!);
    const caixa = (i: number, chave: string) => h.querySelector<HTMLInputElement>(`[data-hora="horario.${i}.${chave}"]`)!;
    fireEvent.change(caixa(0, "abre"), { target: { value: "08:00" } });
    fireEvent.change(caixa(0, "fecha"), { target: { value: "10:00" } });
    fireEvent.change(caixa(1, "abre"), { target: { value: "14:00" } });
    fireEvent.change(caixa(1, "fecha"), { target: { value: "17:00" } });
    fireEvent.click(h.querySelector('[data-salvar="horario"]')!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(assign, "a ficha no ar navegou: o padrão é recarregar").not.toHaveBeenCalled();

    // UMA requisição, com a lista inteira, aceita pela porta — e UMA versão nova.
    expect(corpos).toEqual([{ slug: MARCADOR, campo: "horario", valor: ALMOCO }]);
    expect(respostas).toEqual([200]);
    expect(await historico(banco, MARCADOR)).toHaveLength(antes + 1);

    // A FONTE PÚBLICA, relida do banco.
    esquecerMemoria();
    const f = (await getFicha(MARCADOR))!;
    expect(f.horario).toEqual(ALMOCO);
    const agora = agoraRecife(Math.floor(Date.now() / 1000));
    expect(agora.minutos, "o relógio do teste não está nas 11h de Recife").toBe(11 * 60);
    expect(fechadoAgora(aberturaDaFicha(f), agora)).toBe(true);
    expect(rotuloAbertura(aberturaDaFicha(f), agora)).toBe("abre às 14h");

    // E A PÁGINA PÚBLICA, renderizada.
    cleanup();
    vi.mocked(resolverEstado).mockResolvedValue({
      estado: "fresco",
      erro: false,
      calculadoEm: Math.floor(Date.now() / 1000),
      aviso: null,
    });
    const { container } = render(
      await Ficha({ params: Promise.resolve({ slug: MARCADOR }), searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector(".mark")?.textContent).toBe("Fechado agora");
    expect(container.querySelector(".reason")?.textContent).toBe("Abre das 8h às 10h e das 14h às 17h.");
    expect(container.querySelector(".tk.hora")?.textContent).toBe("8h–10h · 14h–17h");
  });
});
