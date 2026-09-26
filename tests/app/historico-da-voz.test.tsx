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

// 🔴 M4 DA REVISÃO FINAL (2026-09-26): `vi.restoreAllMocks()` NÃO desfaz
// `vi.stubGlobal` (várias abaixo dublam `fetch`/`location`) — o par certo é
// `vi.unstubAllGlobals()`. Sem ele, um teste que ficasse depois de um que
// dublasse `location` herdaria o `reload` falso, e o vazamento só apareceria
// se a ORDEM dos testes mudasse.
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("HistoricoDaVoz", () => {
  // 🔴 O autor é por LINHA, não fixo. Com rótulo fixo o João leria "você, pelo
  // painel" na frase que eu transcrevi em agosto — e a procedência, que é a
  // razão desta tabela existir, viraria decoração.
  it("mostra quem escreveu cada versão", () => {
    render(<HistoricoDaVoz versoes={VERSOES} />);
    expect(screen.getByText(/você, pelo painel/i)).toBeTruthy();
    expect(screen.getByText(/acervo original/i)).toBeTruthy();
  });

  // 🔴 I3 DA REVISÃO FINAL (2026-09-26): nenhum teste desta suíte asseria o
  // TEXTO da versão — só o caminho até o botão de voltar. A spec é explícita
  // ("toca numa linha, VÊ AQUELE TEXTO, e tem voltar a esta"): apagar o `<p>`
  // que mostra a voz, ou fazer a extração devolver `""` sempre, passava
  // verde. O texto só pode aparecer DEPOIS do clique que abre a linha —
  // antes, nem ele nem o da outra versão estão na tela.
  it("mostra o texto daquela versão só depois de abrir a linha, e é o texto CERTO", () => {
    render(<HistoricoDaVoz versoes={VERSOES} />);
    expect(screen.queryByText("velha"), "o texto apareceu ANTES do clique").toBeNull();
    expect(screen.queryByText("nova"), "o texto apareceu ANTES do clique").toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /acervo original/i }));
    expect(screen.getByText("velha")).toBeTruthy();
    expect(screen.queryByText("nova"), "abrir a versão velha mostrou o texto da NOVA").toBeNull();
  });

  // 🔴 O `catch` de `vozDaVersao` (doc que não parseia → "" em vez de
  // derrubar a lista) também estava sem teste — uma linha antiga corrompida
  // não pode tirar as OUTRAS versões da tela.
  it("versão com doc que não parseia não derruba a lista — mostra vazio só para ela", () => {
    const versoes = [
      { id: 2, ficha_slug: SLUG, doc: "{ isto não é JSON", autor: "painel" as const, criado_em: AGORA + 10 },
      { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente" as const, criado_em: AGORA },
    ];
    render(<HistoricoDaVoz versoes={versoes} />);
    expect(screen.getByText(/você, pelo painel/i), "a linha corrompida sumiu da lista").toBeTruthy();
    expect(screen.getByText(/acervo original/i), "a versão boa sumiu junto da corrompida").toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /você, pelo painel/i }));
    const item = screen.getByRole("button", { name: /você, pelo painel/i }).closest("li")!;
    expect(item.querySelector("p")!.textContent, "doc podre tem que virar vazio, não estourar").toBe("");
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
