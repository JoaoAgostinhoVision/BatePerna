import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import HistoricoDaVoz from "@/app/admin/HistoricoDaVoz";

// 🔴 C3 da revisão do controlador: este arquivo (teste de TELA) fica em
// `tests/app/`; o teste de ROTA acrescentado na Task 7 mora em
// `tests/api/route-admin-ficha.test.ts`, junto dos irmãos da Task 6.

const SLUG = "rampa-do-pepe";
const AGORA = 1_758_200_000;

const VERSOES = [
  { id: 2, ficha_slug: SLUG, doc: JSON.stringify({ voz: "nova" }), autor: "painel" as const, criado_em: AGORA + 10 },
  { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente" as const, criado_em: AGORA },
];

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("HistoricoDaVoz", () => {
  // 🔴 O autor é por LINHA, não fixo. Com rótulo fixo o João leria "você, pelo
  // painel" na frase que eu transcrevi em agosto — e a procedência, que é a
  // razão desta tabela existir, viraria decoração.
  it("mostra quem escreveu cada versão", () => {
    render(<HistoricoDaVoz versoes={VERSOES} />);
    expect(screen.getByText(/você, pelo painel/i)).toBeTruthy();
    expect(screen.getByText(/acervo original/i)).toBeTruthy();
  });

  // 🔴 FIX ROUND 1 (2026-09-26): o `voltar()` — a superfície mais complexa do
  // componente — estava inteiramente sem prova. Mesmo molde de
  // `tests/app/editor-de-voz.test.tsx`: abre a versão, clica em voltar, prova
  // o PUT exato e o `location.reload()` (nunca estado otimista).
  it("voltar manda slug e versaoId em PUT, e recarrega a página", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 3 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reloadFalso = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadFalso });

    const { container } = render(<HistoricoDaVoz versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/ficha");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ slug: SLUG, versaoId: 1 });
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
  });

  // 🔴 O botão mostra "Voltando…" e fica desabilitado ENQUANTO o pedido está
  // no ar — sem isto um dono impaciente clicaria duas vezes e voltaria a
  // versão errada, ou voltaria duas vezes (duas versões novas na fila).
  it("desabilita o botão e mostra 'Voltando…' enquanto o pedido está no ar", async () => {
    let liberar!: () => void;
    const pendurado = new Promise<Response>((ok) => { liberar = () => ok(Response.json({ id: 3 })); });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendurado));
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });

    const { container } = render(<HistoricoDaVoz versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);

    const botao = container.querySelector('button[data-voltar-versao="1"]') as HTMLButtonElement;
    await waitFor(() => expect(botao.textContent).toMatch(/voltando/i));
    expect(botao.disabled).toBe(true);

    liberar();
    await waitFor(() => expect(botao.disabled).toBe(false));
  });

  it("resposta que não é ok mostra a mensagem de erro ao voltar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 400 })));
    const { container } = render(<HistoricoDaVoz versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/não consegui voltar/i);
  });

  it("fetch que rejeita mostra a mensagem de erro ao voltar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("falhou")));
    const { container } = render(<HistoricoDaVoz versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/não consegui voltar/i);
  });
});
