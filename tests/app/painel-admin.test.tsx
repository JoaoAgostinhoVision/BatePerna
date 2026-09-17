import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import PainelAdmin from "@/app/admin/PainelAdmin";
import { getAllFichas } from "@/lib/ficha";
import { vozDaFicha, falaMolhada } from "@/lib/severidade";
import type { AvisoLinha } from "@/lib/db";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const AGORA = 1_757_000_000;
const DIA = 24 * 3600;
const fichas = getAllFichas();
const leituras = Object.fromEntries(
  fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: AGORA, aviso: null }]),
);

describe("PainelAdmin", () => {
  // 🔴 Varre o ACERVO, nunca uma lista de slugs escrita a mao: guarda que
  // enumera o acervo a mao e cego a ele crescer — especie ja catalogada.
  it("lista TODAS as fichas do acervo", () => {
    render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    expect(fichas.length).toBeGreaterThanOrEqual(3);
    for (const f of fichas) {
      expect(screen.getByText(f.trajeto.waypoints[0].nome)).not.toBeNull();
    }
  });

  it("publicar manda slug, texto, efeito e prazo no corpo", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetchFalso);
    // r.ok dispara location.reload(); jsdom nao implementa navegacao de
    // verdade e poluiria o stderr com "Not implemented: navigation" — mesmo
    // ajuste que `CaixaDeSenha` ja precisou (tests/app/admin-page.test.tsx).
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const alvo = fichas[0].slug;
    fireEvent.change(container.querySelector(`textarea[data-slug="${alvo}"]`)!, {
      target: { value: "em reforma" },
    });
    fireEvent.click(container.querySelector(`button[data-publicar="${alvo}"]`)!);
    // O `waitFor` do testing-library (nao o do vitest) embrulha cada repique
    // em `act(...)` — sem isto o `setIndo`-equivalente deste componente
    // assenta fora de act e vaza warning pro stderr.
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const corpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(corpo.slug).toBe(alvo);
    expect(corpo.texto).toBe("em reforma");
    expect(typeof corpo.venceEm).toBe("number");
    expect(corpo.venceEm).toBeGreaterThan(AGORA);
  });

  // 🔴 CONSEQUENCIA A VISTA: escolher um efeito tem que mostrar o que vai a
  // tela, nao o nome do efeito. Numero sem consequencia e como se troca o
  // limiar de chuva de uma serra real sem perceber.
  it("escolher 'fechado' avisa que o lugar vai aparecer fechado", () => {
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const alvo = fichas[0].slug;
    fireEvent.change(container.querySelector(`select[data-efeito="${alvo}"]`)!, {
      target: { value: "fechado" },
    });
    expect(screen.getByText(/vai aparecer FECHADO/i)).not.toBeNull();
  });

  it("nao da pra publicar sem texto", () => {
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const botao = container.querySelector(`button[data-publicar="${fichas[0].slug}"]`) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  // 🔴 Ruling 2: M2 como escrito no brief sobreviveria — nenhum teste ali
  // seleciona `frio`. A consequencia de `frio` tem que vir de `falaMolhada`,
  // nunca escrita a mao aqui — mesma regra que fechou, em 10/09, a voz de UM
  // lugar virando a lingua de TODOS. Varre o acervo inteiro, e prova que as
  // severidades de hoje NAO sao todas iguais (anti-vacuidade): se o acervo
  // um dia colapsar pra uma severidade só, este teste avisa.
  it("escolher 'frio' mostra a fala de falaMolhada — a MESMA fala da ficha, nunca literal aqui", () => {
    const marcasEsperadas = new Set<string>();
    for (const f of fichas) {
      cleanup();
      const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
      fireEvent.change(container.querySelector(`select[data-efeito="${f.slug}"]`)!, {
        target: { value: "frio" },
      });
      const voz = vozDaFicha(f.condicao);
      const fala = falaMolhada(voz.severidade, voz.horasPassado);
      marcasEsperadas.add(fala.marca);
      expect(screen.getByText(new RegExp(fala.marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).not.toBeNull();
    }
    // Anti-vacuidade: as fichas de hoje tem severidades espera/nao-va/cuidado
    // — mais de uma marca distinta no acervo. Se isto falhar sozinho (sem
    // mutacao nenhuma), a premissa do teste morreu, nao o codigo.
    expect(marcasEsperadas.size).toBeGreaterThan(1);
  });

  // 🔴 Ruling 3: o botao de tirar manda DELETE com o id da linha vigente —
  // id que NAO existe em `Aviso` (o formato publico), so em `AvisoLinha`.
  it("tirar manda DELETE com o id da linha vigente, e recarrega", async () => {
    const alvo = fichas[0].slug;
    const avisos: Record<string, AvisoLinha> = {
      [alvo]: { id: 7, ficha_slug: alvo, texto: "em reforma", efeito: "fechado", criado_em: AGORA - DIA, vence_em: AGORA + DIA },
    };
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const recarregar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { container } = render(
      <PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} avisos={avisos} />,
    );
    fireEvent.click(container.querySelector(`button[data-tirar="${alvo}"]`)!);
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain("id=7");
    expect(init.method).toBe("DELETE");
  });

  // 🔴 Ruling 4: "abre destacando o que vence em breve" — limiar de 3 dias,
  // escolha do controlador (sem numero no brief). Presenca E ausencia, pra
  // nao passar so porque o atributo nunca aparece em lugar nenhum.
  it("marca data-vence-em-breve quando o aviso vence em <= 3 dias", () => {
    const alvo = fichas[0].slug;
    const avisos: Record<string, AvisoLinha> = {
      [alvo]: { id: 1, ficha_slug: alvo, texto: "x", efeito: "fechado", criado_em: AGORA - DIA, vence_em: AGORA + DIA },
    };
    const { container } = render(
      <PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} avisos={avisos} />,
    );
    expect(container.querySelector(`[data-ficha="${alvo}"][data-vence-em-breve]`)).not.toBeNull();
  });

  it("NAO marca data-vence-em-breve quando o aviso vence em 30 dias, nem quando nao ha aviso", () => {
    const alvo = fichas[0].slug;
    const outro = fichas[1].slug;
    const avisos: Record<string, AvisoLinha> = {
      [alvo]: { id: 1, ficha_slug: alvo, texto: "x", efeito: "fechado", criado_em: AGORA - DIA, vence_em: AGORA + 30 * DIA },
    };
    const { container } = render(
      <PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} avisos={avisos} />,
    );
    expect(container.querySelector(`[data-ficha="${alvo}"][data-vence-em-breve]`)).toBeNull();
    expect(container.querySelector(`[data-ficha="${outro}"][data-vence-em-breve]`)).toBeNull();
  });

  // 🔴 Ruling 1: leitura do banco falhando nao pode derrubar o painel — so
  // dizer isso na tela, numa linha curta.
  it("quando os avisos nao puderam ser lidos, diz isso numa linha curta e nao quebra a tela", () => {
    render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} avisosErro />);
    expect(screen.getByText(/não consegui ler os avisos/i)).not.toBeNull();
    // A tela continua utilizavel: o acervo aparece do mesmo jeito.
    for (const f of fichas) expect(screen.getByText(f.trajeto.waypoints[0].nome)).not.toBeNull();
  });

  // 🔴 Ruling 5: o motor diz o que esta NA TELA agora — nao o texto de
  // falaMolhada (que e so a consequencia de ESCOLHER frio no formulario).
  it("mostra o que o motor diz agora, e diz quando a leitura falhou", () => {
    const alvo = fichas[0].slug;
    const outro = fichas[1].slug;
    const leiturasComErro = {
      ...leituras,
      [outro]: { estado: "frio" as const, erro: true, calculadoEm: AGORA, aviso: null },
    };
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leiturasComErro} agora={AGORA} />);
    const blocoFresco = container.querySelector(`[data-ficha="${alvo}"]`);
    expect(blocoFresco?.textContent).toMatch(/na tela agora:.*pode ir/i);
    const blocoErro = container.querySelector(`[data-ficha="${outro}"]`);
    expect(blocoErro?.textContent).toMatch(/falhou/i);
  });
});
