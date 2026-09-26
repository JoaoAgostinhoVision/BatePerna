import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import PainelAdmin from "@/app/admin/PainelAdmin";
import { getAllFichas } from "@/lib/ficha";
import { bancoDeProducao } from "../banco";
import { vozDaFicha, falaMolhada } from "@/lib/severidade";
import { marcaAgora } from "@/app/admin/marca-agora";
import type { AvisoLinha } from "@/lib/db";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const AGORA = 1_757_000_000; // quinta-feira, ~09h33 Recife (ver Fix round 2)
const DIA = 24 * 3600;
// O acervo vem do BANCO desde 2026-09-25, e é semeado no TOPO: `fichas` é uma
// constante de módulo que todo teste daqui passa por prop pro painel, e
// `beforeEach` roda depois da avaliação do módulo.
await bancoDeProducao();
const fichas = await getAllFichas();
const leituraSeca: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: AGORA, aviso: null };

// 🔴 Fix round 2: sábado e quarta da MESMA semana, meio-dia em Recife — dentro
// da janela de horário de Pedra Furada (5h–17h) e Véu (8h–17h) nos dois dias;
// a Rampa do Pepê só abre sáb/dom (`content/fichas/rampa-do-pepe.json`), então
// SAB mantém o acervo INTEIRO aberto e QUA fecha só a Rampa pelo calendário.
const SAB_MEIODIA = 1_757_170_800;
const QUA_MEIODIA = 1_756_911_600;

// 🔴 TASK 5 (2026-09-25): `/admin` virou lista, e `PainelAdmin` passou a
// servir UM lugar (assinatura `{ ficha, leitura, aviso, avisoErro, agora }`,
// singular) — antes recebia o acervo inteiro (`{ fichas, leituras, avisos,
// avisosErro, agora }`) e desenhava uma seção por ficha. Este arquivo testa o
// componente NOVO: cada teste monta com UMA ficha, e o teste "lista TODAS as
// fichas do acervo" (que media a responsabilidade de listar) morreu porque a
// responsabilidade MUDOU DE DONO — quem lista hoje é `ListaDeLugares`, medida
// em `tests/app/admin-lista.test.tsx`.
describe("PainelAdmin", () => {
  it("mostra o nome do lugar e o que o motor diz agora, pra UMA ficha", () => {
    const f = fichas[0];
    render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
    expect(screen.getByText(f.trajeto.waypoints[0].nome)).not.toBeNull();
  });

  it("publicar manda slug, texto, efeito e prazo no corpo", async () => {
    const f = fichas[0];
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetchFalso);
    // r.ok dispara location.reload(); jsdom nao implementa navegacao de
    // verdade e poluiria o stderr com "Not implemented: navigation" — mesmo
    // ajuste que `CaixaDeSenha` ja precisou (tests/app/admin-page.test.tsx).
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { container } = render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
    fireEvent.change(container.querySelector(`textarea[data-slug="${f.slug}"]`)!, {
      target: { value: "em reforma" },
    });
    fireEvent.click(container.querySelector(`button[data-publicar="${f.slug}"]`)!);
    // O `waitFor` do testing-library (nao o do vitest) embrulha cada repique
    // em `act(...)` — sem isto o `setIndo`-equivalente deste componente
    // assenta fora de act e vaza warning pro stderr.
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const corpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(corpo.slug).toBe(f.slug);
    expect(corpo.texto).toBe("em reforma");
    expect(typeof corpo.venceEm).toBe("number");
    expect(corpo.venceEm).toBeGreaterThan(AGORA);
  });

  // 🔴 CONSEQUENCIA A VISTA: escolher um efeito tem que mostrar o que vai a
  // tela, nao o nome do efeito. Numero sem consequencia e como se troca o
  // limiar de chuva de uma serra real sem perceber.
  it("escolher 'fechado' avisa que o lugar vai aparecer fechado", () => {
    const f = fichas[0];
    const { container } = render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
    fireEvent.change(container.querySelector(`select[data-efeito="${f.slug}"]`)!, {
      target: { value: "fechado" },
    });
    expect(screen.getByText(/vai aparecer FECHADO/i)).not.toBeNull();
  });

  it("nao da pra publicar sem texto", () => {
    const f = fichas[0];
    const { container } = render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
    const botao = container.querySelector(`button[data-publicar="${f.slug}"]`) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  // 🔴 Ruling 2 (16/09): M2 como escrito no brief sobreviveria — nenhum teste
  // ali seleciona `frio`. A consequencia de `frio` tem que vir de
  // `falaMolhada`, nunca escrita a mao aqui. Varre o acervo inteiro (uma
  // montagem por ficha, agora que o componente é singular), e prova que as
  // severidades de hoje NAO sao todas iguais (anti-vacuidade).
  it("escolher 'frio' mostra a fala de falaMolhada — a MESMA fala da ficha, nunca literal aqui", () => {
    const marcasEsperadas = new Set<string>();
    for (const f of fichas) {
      cleanup();
      const { container } = render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
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
    const f = fichas[0];
    const aviso: AvisoLinha = {
      id: 7, ficha_slug: f.slug, texto: "em reforma", efeito: "fechado",
      criado_em: AGORA - DIA, vence_em: AGORA + DIA,
    };
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const recarregar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { container } = render(
      <PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} aviso={aviso} />,
    );
    fireEvent.click(container.querySelector(`button[data-tirar="${f.slug}"]`)!);
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain("id=7");
    expect(init.method).toBe("DELETE");
  });

  // 🔴 Ruling 4: "abre destacando o que vence em breve" — limiar de 3 dias,
  // escolha do controlador (sem numero no brief). Presenca E ausencia, pra
  // nao passar so porque o atributo nunca aparece em lugar nenhum.
  it("marca data-vence-em-breve quando o aviso vence em <= 3 dias", () => {
    const f = fichas[0];
    const aviso: AvisoLinha = {
      id: 1, ficha_slug: f.slug, texto: "x", efeito: "fechado",
      criado_em: AGORA - DIA, vence_em: AGORA + DIA,
    };
    const { container } = render(
      <PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} aviso={aviso} />,
    );
    expect(container.querySelector(`[data-ficha="${f.slug}"][data-vence-em-breve]`)).not.toBeNull();
  });

  it("NAO marca data-vence-em-breve quando o aviso vence em 30 dias, nem quando nao ha aviso", () => {
    const f = fichas[0];
    const aviso: AvisoLinha = {
      id: 1, ficha_slug: f.slug, texto: "x", efeito: "fechado",
      criado_em: AGORA - DIA, vence_em: AGORA + 30 * DIA,
    };
    const { container: comVencimentoLongo } = render(
      <PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} aviso={aviso} />,
    );
    expect(comVencimentoLongo.querySelector(`[data-ficha="${f.slug}"][data-vence-em-breve]`)).toBeNull();

    cleanup();
    const { container: semAviso } = render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} />);
    expect(semAviso.querySelector(`[data-ficha="${f.slug}"][data-vence-em-breve]`)).toBeNull();
  });

  // 🔴 Ruling 1: leitura do aviso vigente falhando nao pode derrubar a
  // pagina — so dizer isso na tela, numa linha curta.
  it("quando o aviso nao pode ser lido, diz isso numa linha curta e nao quebra a tela", () => {
    const f = fichas[0];
    render(<PainelAdmin ficha={f} leitura={leituraSeca} agora={AGORA} avisoErro />);
    expect(screen.getByText(/não consegui ler o aviso/i)).not.toBeNull();
    // A tela continua utilizavel: o lugar aparece do mesmo jeito.
    expect(screen.getByText(f.trajeto.waypoints[0].nome)).not.toBeNull();
  });

  // 🔴 Fix round 1 — Ruling 5 corrigida: "na tela agora" e a MESMA palavra do
  // selo publico (`SeloTrilha`), tirada de `marcaAgora` (Task 5: extraída de
  // `carimbo-fase.ts` + `horario.ts` + `aviso.ts` pro módulo compartilhado com
  // `ListaDeLugares`) — nunca uma tabela paralela. A versao anterior fixava
  // "Nao va" pra todo `frio`, certa por sorte na Rampa (severidade `nao-va`)
  // e falsa na Pedra Furada (`espera`, "Espera 3h") e na Veu de Noiva
  // (`cuidado`, "Va com cuidado") — a mesma "voz de um lugar virou a lingua
  // de todos" de 10/09, recorrendo num arquivo novo.
  //
  // Varre o acervo INTEIRO com leitura `frio`, deriva a marca esperada da
  // MESMA funcao que o componente usa (calendario incluso — Fix round 2), e
  // prova anti-vacuidade (mais de uma marca distinta — se cair pra uma so, a
  // premissa do teste morreu).
  it("'na tela agora' com frio mostra a MESMA marca do selo publico, ficha a ficha", () => {
    const marcasEsperadas = new Set<string>();
    for (const f of fichas) {
      cleanup();
      const leituraFrio: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: AGORA, aviso: null };
      const { container } = render(<PainelAdmin ficha={f} leitura={leituraFrio} agora={AGORA} />);
      const marcaEsperada = marcaAgora(f, leituraFrio, AGORA);
      marcasEsperadas.add(marcaEsperada);
      const bloco = container.querySelector(`[data-ficha="${f.slug}"]`);
      expect(bloco?.textContent).toContain(marcaEsperada);
    }
    expect(marcasEsperadas.size).toBeGreaterThan(1);
  });

  // (b) O dono fechou (aviso.efeito === "fechado") — a fase e a marca vem de
  // `marcaAgora`, derivadas, nunca "Fechado agora" digitado tambem aqui por
  // coincidencia com o literal do lib.
  it("'na tela agora' com o dono fechando mostra a fase 'fechado' do selo", () => {
    const f = fichas[0];
    const leituraFechado: LeituraCarimbo = {
      estado: "fresco", erro: false, calculadoEm: AGORA,
      aviso: { texto: "em reforma", efeito: "fechado", criadoEm: AGORA, venceEm: AGORA + DIA },
    };
    const { container } = render(<PainelAdmin ficha={f} leitura={leituraFechado} agora={AGORA} />);
    const marcaEsperada = marcaAgora(f, leituraFechado, AGORA);
    const bloco = container.querySelector(`[data-ficha="${f.slug}"]`);
    expect(bloco?.textContent).toContain(marcaEsperada);
  });

  // (c) `erro: true` — a fase vira `sem-informacoes` dentro de `faseDe`, e a
  // palavra e a de `marcaDe` pra essa fase — nunca um "falhou" escrito aqui.
  it("'na tela agora' com erro mostra a fase que faseDe/marcaDe dao pra erro", () => {
    const f = fichas[0];
    const leituraErro: LeituraCarimbo = { estado: "frio", erro: true, calculadoEm: AGORA, aviso: null };
    const { container } = render(<PainelAdmin ficha={f} leitura={leituraErro} agora={AGORA} />);
    const marcaEsperada = marcaAgora(f, leituraErro, AGORA);
    const bloco = container.querySelector(`[data-ficha="${f.slug}"]`);
    expect(bloco?.textContent).toContain(marcaEsperada);
  });

  // 🔴 Fix round 2 — o calendario tinha sumido da fase por um comentario
  // errado ("o servidor nao tem relogio de tela"): `agora` ja chega por prop
  // e `horario.ts` tem `agoraRecife`/`aberturaDaFicha`/`fechadoAgora` puros.
  //
  // (a-restauro) fresco + acervo INTEIRO aberto (SAB_MEIODIA, ver comentario
  // no topo do arquivo) mostra a fase "afirmando" do selo — "Pode ir",
  // derivado de `marcaAgora`, nunca literal.
  it("'na tela agora' com fresco e o acervo inteiro aberto mostra a fase 'afirmando'", () => {
    for (const f of fichas) {
      cleanup();
      const leituraAberta: LeituraCarimbo = {
        estado: "fresco", erro: false, calculadoEm: SAB_MEIODIA, aviso: null,
      };
      const { container } = render(<PainelAdmin ficha={f} leitura={leituraAberta} agora={SAB_MEIODIA} />);
      const marcaEsperada = marcaAgora(f, leituraAberta, SAB_MEIODIA);
      const bloco = container.querySelector(`[data-ficha="${f.slug}"]`);
      expect(bloco?.textContent).toContain(marcaEsperada);
    }
  });

  // (b) calendario fechando: a Rampa do Pepê (só sáb/dom) numa quarta mostra
  // a fase "fechado" do selo — e a MESMA ficha, no sábado, não mostra.
  it("a Rampa numa quarta mostra a fase 'fechado' do calendario; no sabado, nao", () => {
    const rampa = fichas.find((f) => f.slug === "rampa-do-pepe")!;

    const leituraQua: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: QUA_MEIODIA, aviso: null };
    const marcaFechado = marcaAgora(rampa, leituraQua, QUA_MEIODIA);
    const { container: emQuarta } = render(<PainelAdmin ficha={rampa} leitura={leituraQua} agora={QUA_MEIODIA} />);
    const blocoQuarta = emQuarta.querySelector(`[data-ficha="${rampa.slug}"]`);
    expect(blocoQuarta?.textContent).toContain(marcaFechado);

    cleanup();
    const leituraSab: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: SAB_MEIODIA, aviso: null };
    const { container: emSabado } = render(<PainelAdmin ficha={rampa} leitura={leituraSab} agora={SAB_MEIODIA} />);
    const blocoSabado = emSabado.querySelector(`[data-ficha="${rampa.slug}"]`);
    expect(blocoSabado?.textContent).not.toContain(marcaFechado);
  });
});
