import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import HistoricoDaFicha from "@/app/admin/HistoricoDaFicha";

// 🔴 C3 da revisão do controlador: este arquivo (teste de TELA) fica em
// `tests/app/`; o teste de ROTA acrescentado na Task 7 mora em
// `tests/api/route-admin-ficha.test.ts`, junto dos irmãos da Task 6.

const SLUG = "rampa-do-pepe";
const AGORA = 1_758_200_000;

const VERSOES = [
  { id: 2, ficha_slug: SLUG, doc: JSON.stringify({ voz: "nova" }), autor: "painel" as const, criado_em: AGORA + 10, oculto: false, mudou: [], ato: null },
  { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente" as const, criado_em: AGORA, oculto: false, mudou: [], ato: null },
];

// 🔴 M4 DA REVISÃO FINAL (2026-09-26): `vi.restoreAllMocks()` NÃO desfaz
// `vi.stubGlobal` (várias abaixo dublam `fetch`/`location`) — o par certo é
// `vi.unstubAllGlobals()`. Sem ele, um teste que ficasse depois de um que
// dublasse `location` herdaria o `reload` falso, e o vazamento só apareceria
// se a ORDEM dos testes mudasse.
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("HistoricoDaFicha", () => {
  // 🔴 O autor é por LINHA, não fixo. Com rótulo fixo o João leria "você, pelo
  // painel" na frase que eu transcrevi em agosto — e a procedência, que é a
  // razão desta tabela existir, viraria decoração.
  it("mostra quem escreveu cada versão", () => {
    render(<HistoricoDaFicha versoes={VERSOES} />);
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
    render(<HistoricoDaFicha versoes={VERSOES} />);
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
      { id: 2, ficha_slug: SLUG, doc: "{ isto não é JSON", autor: "painel" as const, criado_em: AGORA + 10, oculto: false, mudou: [], ato: null },
      { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente" as const, criado_em: AGORA, oculto: false, mudou: [], ato: null },
    ];
    render(<HistoricoDaFicha versoes={versoes} />);
    expect(screen.getByText(/você, pelo painel/i), "a linha corrompida sumiu da lista").toBeTruthy();
    expect(screen.getByText(/acervo original/i), "a versão boa sumiu junto da corrompida").toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /você, pelo painel/i }));
    const item = screen.getByRole("button", { name: /você, pelo painel/i }).closest("li")!;
    expect(item.querySelector("p")!.textContent, "doc podre tem que virar vazio, não estourar").toBe("");
  });

  // 🔴 FIX ROUND 1 (2026-09-26): o `voltar()` — a superfície mais complexa do
  // componente — estava inteiramente sem prova. O molde era o do
  // `editor-de-voz.test.tsx`, que a Task 6 APAGOU junto com o componente (nome
  // sem caminho: não há arquivo pra abrir); hoje ele vive em
  // `tests/app/admin-editores-de-campo.test.tsx`
  // (o `comRota`, com o `location.reload` dublado): abre a versão, clica em
  // voltar, prova o PUT exato e o `location.reload()` (nunca estado otimista).
  it("voltar manda slug e versaoId em PUT, e recarrega a página", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 3 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reloadFalso = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadFalso });

    const { container } = render(<HistoricoDaFicha versoes={VERSOES} />);
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

    const { container } = render(<HistoricoDaFicha versoes={VERSOES} />);
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
    const { container } = render(<HistoricoDaFicha versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/não consegui voltar/i);
  });

  it("409 com frase (o lugar mudou de endereço no meio): a frase da porta vai pra tela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("frase marcadora da porta", { status: 409 })));
    const { container } = render(<HistoricoDaFicha versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toBe("frase marcadora da porta");
  });

  it("fetch que rejeita mostra a mensagem de erro ao voltar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("falhou")));
    const { container } = render(<HistoricoDaFicha versoes={VERSOES} />);
    fireEvent.click(container.querySelector('button[data-abrir-versao="1"]')!);
    fireEvent.click(container.querySelector('button[data-voltar-versao="1"]')!);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toMatch(/não consegui voltar/i);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Task 9 (2026-10-01): o histórico mostra QUAL CAMPO mudou, não só a voz.
  //
  // 🔴 O COMPONENTE RECEBE OS RÓTULOS PRONTOS (`mudou`), e não os calcula — B2
  // da auditoria: ele é `"use client"` e o diff precisa do registro de campos
  // (zod). As mutações do DIFF (M1, M2, M7) morrem em
  // `tests/lib/campos-mudados.test.ts`; as daqui provam que a TELA põe cada
  // rótulo NA LINHA DA VERSÃO certa, e nenhum na linha errada.
  // ───────────────────────────────────────────────────────────────────────────
  const vSemente = { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente" as const, criado_em: AGORA, oculto: false, mudou: [], ato: null };
  const vComVozNova = { ...vSemente, id: 2, autor: "painel" as const, criado_em: AGORA + 10, mudou: ["A voz"] };
  const vComCustoNovo = { ...vSemente, id: 3, autor: "painel" as const, criado_em: AGORA + 20, mudou: ["O custo em três ou quatro palavras"] };
  const vComVozECustoNovos = { ...vSemente, id: 4, autor: "painel" as const, criado_em: AGORA + 30, mudou: ["A voz", "O custo em três ou quatro palavras"] };

  it("mostra o campo que mudou em cada versão, cada um NA LINHA da sua versão", () => {
    render(<HistoricoDaFicha versoes={[vComCustoNovo, vComVozNova, vSemente]} />);
    const linhaCusto = screen.getByTestId(`versao-${vComCustoNovo.id}`);
    const linhaVoz = screen.getByTestId(`versao-${vComVozNova.id}`);
    expect(within(linhaCusto).getByText(/custo/i)).toBeTruthy();
    expect(within(linhaVoz).getByText(/a voz/i)).toBeTruthy();
    // e não trocados: "está na tela" não basta, tem de estar na linha CERTA
    expect(within(linhaCusto).queryByText(/a voz/i), "a voz apareceu na linha do custo").toBeNull();
    expect(within(linhaVoz).queryByText(/custo/i), "o custo apareceu na linha da voz").toBeNull();
  });

  it("versão que mudou DOIS campos lista os dois", () => {
    render(<HistoricoDaFicha versoes={[vComVozECustoNovos, vSemente]} />);
    const linha = screen.getByTestId(`versao-${vComVozECustoNovos.id}`);
    expect(within(linha).getByText(/a voz/i)).toBeTruthy();
    expect(within(linha).getByText(/custo/i)).toBeTruthy();
  });

  // 🔴 O componente de antes só sabia da `voz`: uma versão que mudou o preço
  // aparecia SEM NADA na linha, que é o mesmo que "nada mudou". A frase "nada
  // mudou" nunca existiu na tela — então o `queryByText(/nada mudou/)` do plano
  // seria vácuo (passaria com o defeito); a prova é o rótulo NA LINHA dela.
  it("versão que mudou só o preço mostra o preço na linha dela", () => {
    render(<HistoricoDaFicha versoes={[vComCustoNovo, vSemente]} />);
    expect(within(screen.getByTestId(`versao-${vComCustoNovo.id}`)).getByText(/custo/i)).toBeTruthy();
    expect(screen.queryByText(/nada mudou/i)).toBeNull();
  });

  // 🔴 R2 DA ONDA DE CONSERTO 1: a marca é do ATO (`ato`, resolvido no
  // servidor por `atoDeVisibilidade`), NUNCA do estado (`oculto`). A versão de
  // id 10 tem `oculto: true` e nenhum ato — é uma edição feita com o lugar já
  // escondido —, e não pode levar marca: é ela que prova que o componente não
  // voltou a ler `v.oculto`.
  it("a versão que escondeu diz 'escondido', a que mostrou diz 'de volta ao ar', e a edição com ele escondido não diz nada", () => {
    render(
      <HistoricoDaFicha
        versoes={[
          { ...vSemente, id: 11, oculto: false, ato: "mostrou" },
          { ...vSemente, id: 10, oculto: true, ato: null },
          { ...vSemente, id: 9, oculto: true, ato: "escondeu" },
          vSemente,
        ]}
      />,
    );
    expect(within(screen.getByTestId("versao-9")).getByText(/escondid/i)).toBeTruthy();
    expect(within(screen.getByTestId("versao-9")).queryByText(/de volta ao ar/i)).toBeNull();
    expect(within(screen.getByTestId("versao-11")).getByText(/de volta ao ar/i)).toBeTruthy();
    expect(within(screen.getByTestId("versao-11")).queryByText(/escondid/i)).toBeNull();
    expect(within(screen.getByTestId("versao-10")).queryByText(/escondid|de volta ao ar/i), "edição com o lugar escondido levou marca de ato").toBeNull();
    expect(within(screen.getByTestId(`versao-${vSemente.id}`)).queryByText(/escondid|de volta ao ar/i)).toBeNull();
  });

  it("documento que não parseia mostra vazio em vez de derrubar a lista", () => {
    render(<HistoricoDaFicha versoes={[{ ...vSemente, id: 7, doc: "{lixo" }, vSemente]} />);
    expect(screen.getByTestId("versao-7")).toBeTruthy();
    expect(screen.getByTestId(`versao-${vSemente.id}`)).toBeTruthy();
  });

  it("o título diz ficha, não voz", () => {
    render(<HistoricoDaFicha versoes={[vSemente]} />);
    expect(screen.getByRole("heading", { name: /histórico da ficha/i })).toBeTruthy();
  });

  it("a versão gravada por quem usa o app diz 'quem mandou', e nenhuma outra diz", () => {
    const { container } = render(
      <HistoricoDaFicha versoes={[{ id: 9, ficha_slug: "x", doc: "{}", autor: "contribuidor", criado_em: 1_758_000_000, oculto: false, mudou: [], ato: null }]} />,
    );
    expect(container.textContent).toContain("quem mandou");
    cleanup();
    // A metade "nenhuma outra diz": as versões do painel e da semente não
    // ganham o rótulo de quem usa.
    const outras = render(<HistoricoDaFicha versoes={VERSOES} />);
    expect(outras.container.textContent).not.toContain("quem mandou");
  });
});
