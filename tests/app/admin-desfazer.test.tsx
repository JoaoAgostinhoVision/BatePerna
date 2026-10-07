import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import EditorCoordenada from "@/app/admin/campos/EditorCoordenada";
import { ACRESCENTAR_PONTO, NOME_DO_PONTO_NOVO } from "@/app/admin/campos/EditorWaypoints";
import { CAIXA_VAZIA, DESFAZER, HORA_VAZIA, NADA_ESCOLHIDO, NAO, REGRA_QUE_MENTE, SALVAR, SIM } from "@/app/admin/campos/palavras";
import type { CampoNaTela } from "@/app/admin/campos/tipos";
import { MAPA_ALTURA_PX, MAPA_LARGURA_PX, MAPA_ZOOM_EDITOR } from "@/lib/mapa";
import { PISOS } from "@/lib/piso";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { doisPontos } from "../ficha-de-tres-pontos";
import { bancoDeProducao } from "../banco";

/** DESFAZER UMA EDIÇÃO — voltar ao SALVO, sem gravar (Tarefa 15, 07/10: o
 *  segundo dos "dois cancelar" que o João pediu olhando o painel no ar).
 *
 *  🔴 AS SEIS PROVAS, EDITOR POR EDITOR: escondido sem mudança; aparece com
 *  mudança; um toque volta ao salvo; ZERO fetch; some depois de desfazer; e
 *  salvar → mudar → desfazer volta ao valor SALVO POR ÚLTIMO, não ao de antes
 *  do primeiro Salvar.
 *
 *  🔴 O "SALVO" É A PROP `valor`, LIDA A CADA RENDER — nunca uma cópia guardada
 *  na montagem. No ar, o Salvar bem-sucedido faz `location.reload()` (ou
 *  `location.assign`, no formulário de lugar novo) e o editor nasce de novo com
 *  o valor novo do banco; uma cópia da montagem passaria igual por esse
 *  caminho. Por isso o caso salvar→mudar→desfazer aqui usa `rerender` com a
 *  ficha NOVA no MESMO componente montado — o caso mais exigente: só passa se a
 *  referência for a prop de agora (e continua certo se um dia o painel trocar o
 *  reload por um `router.refresh()`, que entrega a prop nova sem remontar).
 *
 *  Molde de `admin-editores-de-campo.test.tsx`: a `FichaInteira` INTEIRA, medida
 *  DENTRO do bloco do campo, contra as fichas REAIS do acervo (a fiação do
 *  servidor é o que monta o `valor`). Só a coordenada SEM ponto é montada solta,
 *  porque nenhuma ficha no ar tem coordenada vazia — é o caso do lugar novo. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

await bancoDeProducao();
const ACERVO = await getAllFichas();
function exigir(slug: string): Ficha {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
}
const RAMPA = exigir("rampa-do-pepe");
const COM_HORARIO = exigir("pedra-furada-de-venturosa");
if (!COM_HORARIO.horario || COM_HORARIO.horario.length === 0) throw new Error("a premissa: a Pedra Furada tem horário");

function comRota() {
  const fetchFalso = vi.fn(async (_url: string, _init: { method: string; body: string }) => Response.json({ id: 99 }));
  vi.stubGlobal("fetch", fetchFalso);
  const reloadFalso = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
  return { fetchFalso, reloadFalso };
}

const bloco = (caminho: string): HTMLElement => screen.getByTestId(`campo-${caminho}`);
const desfazerEm = (el: HTMLElement): HTMLElement | null => within(el).queryByRole("button", { name: DESFAZER });
const desfazer = (el: HTMLElement): void => {
  const b = desfazerEm(el);
  expect(b, "o Desfazer não está no bloco").not.toBeNull();
  fireEvent.click(b!);
};
const salvarEm = (caminho: string): void => {
  fireEvent.click(bloco(caminho).querySelector(`[data-salvar="${caminho}"]`)!);
};

/** UM EDITOR NA TABELA: como ler o que está na tela (em texto), como mudar, e
 *  a ficha com um valor salvo novo — o que o banco devolveria depois do Salvar.
 *  `salvo`, `x` e `y` são três valores DIFERENTES, conferidos abaixo: com dois
 *  iguais, "voltou ao salvo" não se distingue de "não mudou". */
type Caso = {
  nome: string;
  caminho: string;
  ficha: Ficha;
  ler: () => string;
  mudar: (v: string) => void;
  salvo: string;
  x: string;
  y: string;
  fichaCom: (v: string) => Ficha;
};

const caixa = (caminho: string) => bloco(caminho).querySelector<HTMLTextAreaElement>(`[data-caixa="${caminho}"]`)!;
const numero = (caminho: string) => bloco(caminho).querySelector<HTMLInputElement>(`[data-numero="${caminho}"]`)!;
const escolha = (caminho: string) => bloco(caminho).querySelector<HTMLSelectElement>(`[data-escolha="${caminho}"]`)!;
const horas = () => [...bloco("horario").querySelectorAll<HTMLInputElement>("[data-hora]")];

const LIMIAR = "condicao.regra.limiar_mm";
const limiarDe = (f: Ficha): number => f.condicao.regra.limiar_mm;
const comLimiar = (f: Ficha, n: number): Ficha => ({
  ...f,
  condicao: { ...f.condicao, regra: { ...f.condicao.regra, limiar_mm: n } },
});
const outrosPisos = PISOS.filter((p) => p !== RAMPA.piso);
const h0 = COM_HORARIO.horario![0];

const CASOS: Caso[] = [
  {
    nome: "EditorProsa",
    caminho: "voz",
    ficha: RAMPA,
    ler: () => caixa("voz").value,
    mudar: (v) => fireEvent.change(caixa("voz"), { target: { value: v } }),
    salvo: RAMPA.voz,
    x: "voz marcadora X",
    y: "voz marcadora Y",
    fichaCom: (v) => ({ ...RAMPA, voz: v }),
  },
  {
    nome: "EditorBooleano",
    caminho: "carroComum",
    ficha: { ...RAMPA, carroComum: true },
    ler: () => {
      const marcada = within(bloco("carroComum"))
        .getAllByRole("radio")
        .find((r) => (r as HTMLInputElement).checked);
      return marcada?.parentElement?.textContent ?? "";
    },
    mudar: (v) => fireEvent.click(within(bloco("carroComum")).getByLabelText(v)),
    salvo: SIM,
    x: NAO,
    // 🔴 O `y` é o valor de ANTES do primeiro Salvar, de propósito: o
    // interruptor só tem dois, e "voltou ao da montagem" dá `SIM`, não `NAO`.
    y: SIM,
    fichaCom: (v) => ({ ...RAMPA, carroComum: v === SIM }),
  },
  {
    nome: "EditorLista (uma escolha)",
    caminho: "piso",
    ficha: RAMPA,
    ler: () => escolha("piso").value,
    mudar: (v) => fireEvent.change(escolha("piso"), { target: { value: v } }),
    salvo: String(RAMPA.piso),
    x: outrosPisos[0],
    y: outrosPisos[1],
    fichaCom: (v) => ({ ...RAMPA, piso: v as Ficha["piso"] }),
  },
  {
    nome: "EditorFaixas",
    caminho: "horario",
    ficha: COM_HORARIO,
    ler: () => horas()[0].value,
    mudar: (v) => fireEvent.change(horas()[0], { target: { value: v } }),
    salvo: h0.abre,
    x: h0.abre === "06:15" ? "06:20" : "06:15",
    y: h0.abre === "06:45" ? "06:50" : "06:45",
    fichaCom: (v) => ({ ...COM_HORARIO, horario: [{ ...h0, abre: v }, ...COM_HORARIO.horario!.slice(1)] }),
  },
  {
    nome: "EditorNumeroDeMotor",
    caminho: LIMIAR,
    ficha: RAMPA,
    ler: () => numero(LIMIAR).value,
    mudar: (v) => fireEvent.change(numero(LIMIAR), { target: { value: v } }),
    salvo: String(limiarDe(RAMPA)),
    x: String(limiarDe(RAMPA) + 3),
    y: String(limiarDe(RAMPA) + 5),
    fichaCom: (v) => comLimiar(RAMPA, Number(v)),
  },
];

describe.each(CASOS)("$nome — o Desfazer", (c) => {
  it("a premissa: três valores diferentes, e a tela abre no salvo", () => {
    expect(new Set([c.salvo, c.x]).size).toBe(2);
    expect(c.x).not.toBe(c.y);
    comRota();
    render(<FichaInteira ficha={c.ficha} />);
    expect(c.ler()).toBe(c.salvo);
  });

  it("escondido sem mudança; aparece com a mudança; um toque volta ao salvo, sem fetch; e some", () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={c.ficha} />);
    expect(desfazerEm(bloco(c.caminho)), "Desfazer sem mudança nenhuma").toBeNull();
    c.mudar(c.x);
    expect(c.ler(), "a premissa: a mudança chegou à tela").toBe(c.x);
    desfazer(bloco(c.caminho));
    expect(c.ler(), "o Desfazer não voltou ao salvo").toBe(c.salvo);
    expect(fetchFalso, "o Desfazer gravou").not.toHaveBeenCalled();
    expect(reloadFalso).not.toHaveBeenCalled();
    expect(desfazerEm(bloco(c.caminho)), "o Desfazer ficou na tela depois de desfazer").toBeNull();
  });

  it("voltar à mão ao valor salvo também esconde o Desfazer — ele mede a DIFERENÇA, não o toque", () => {
    comRota();
    render(<FichaInteira ficha={c.ficha} />);
    c.mudar(c.x);
    expect(desfazerEm(bloco(c.caminho))).not.toBeNull();
    c.mudar(c.salvo);
    expect(desfazerEm(bloco(c.caminho))).toBeNull();
  });

  it("salvar X, mudar pra Y, desfazer: volta a X, o salvo de AGORA — não ao de antes do Salvar", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    const { rerender } = render(<FichaInteira ficha={c.ficha} />);
    c.mudar(c.x);
    salvarEm(c.caminho);
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    // O banco agora diz X: a prop nova chega ao MESMO editor montado.
    rerender(<FichaInteira ficha={c.fichaCom(c.x)} />);
    expect(desfazerEm(bloco(c.caminho)), "com a tela igual ao salvo novo, nada a desfazer").toBeNull();
    c.mudar(c.y);
    desfazer(bloco(c.caminho));
    expect(c.ler()).toBe(c.x);
    expect(fetchFalso, "o Desfazer gravou").toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorLista (várias) — a diferença é de CONJUNTO, não de ordem de toque", () => {
  const COM_DIAS: Ficha = { ...RAMPA, dias: ["sab", "dom"] };
  const marcados = () =>
    within(bloco("dias"))
      .getAllByRole("checkbox")
      .filter((b) => (b as HTMLInputElement).checked)
      .map((b) => (b as HTMLInputElement).value);
  const alternar = (dia: string) => fireEvent.click(within(bloco("dias")).getByRole("checkbox", { name: dia }));

  it("desmarcar e marcar de novo o mesmo dia não é mudança; marcar outro é, e o Desfazer volta aos dias salvos", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={COM_DIAS} />);
    expect(marcados().sort()).toEqual(["dom", "sab"]);
    alternar("sab");
    alternar("sab"); // volta, no FIM da lista dos toques
    expect(desfazerEm(bloco("dias")), "mesmos dias em outra ordem contou como mudança").toBeNull();
    alternar("seg");
    desfazer(bloco("dias"));
    expect(marcados().sort()).toEqual(["dom", "sab"]);
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(desfazerEm(bloco("dias"))).toBeNull();
  });

  it("só DESMARCAR um dia salvo já é mudança: o Desfazer aparece e volta aos dois dias", () => {
    // I1 da revisão da Tarefa 15: o arrependimento mais comum numa lista
    // múltipla. Desmarcar deixa um subconjunto do salvo — "algum marcado que
    // não está no salvo" é falso, e só a CONTAGEM acusa a diferença.
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={COM_DIAS} />);
    alternar("sab");
    expect(marcados(), "a premissa: só o domingo ficou").toEqual(["dom"]);
    expect(desfazerEm(bloco("dias")), "desmarcar um dia salvo não contou como mudança").not.toBeNull();
    desfazer(bloco("dias"));
    expect(marcados().sort()).toEqual(["dom", "sab"]);
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(desfazerEm(bloco("dias"))).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Desfazer desligado enquanto o editor grava", () => {
  it("EditorProsa: mudar, Salvar (a porta ainda não respondeu) — o Desfazer está desligado e o toque não volta a caixa", async () => {
    // M3 da revisão da Tarefa 15: voltar a caixa no meio de um Salvar mostraria
    // uma coisa na tela enquanto outra vai pra porta.
    let soltar: (r: Response) => void = () => {};
    const fetchFalso = vi.fn(() => new Promise<Response>((ok) => (soltar = ok)));
    vi.stubGlobal("fetch", fetchFalso);
    const reloadFalso = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
    render(<FichaInteira ficha={RAMPA} />);
    fireEvent.change(caixa("voz"), { target: { value: "voz marcadora X" } });
    salvarEm("voz");
    expect(fetchFalso, "a premissa: o Salvar foi à porta").toHaveBeenCalledTimes(1);
    const botao = desfazerEm(bloco("voz")) as HTMLButtonElement | null;
    expect(botao, "a premissa: a mudança continua na tela, com o Desfazer").not.toBeNull();
    expect(botao!.disabled, "o Desfazer ficou ligado no meio do Salvar").toBe(true);
    fireEvent.click(botao!);
    expect(caixa("voz").value, "o Desfazer voltou a caixa no meio do Salvar").toBe("voz marcadora X");
    await act(async () => {
      soltar(Response.json({ id: 99 }));
    });
    expect(reloadFalso).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorFaixas — uma faixa a mais também é mudança", () => {
  it("'+ outra faixa' faz o Desfazer aparecer, e ele volta às faixas salvas", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={COM_HORARIO} />);
    const antes = horas().length;
    fireEvent.click(bloco("horario").querySelector("[data-mais-faixa]")!);
    expect(horas()).toHaveLength(antes + 2);
    desfazer(bloco("horario"));
    expect(horas()).toHaveLength(antes);
    expect(horas()[0].value).toBe(h0.abre);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Desfazer limpa a frase de recusa daqui", () => {
  it("EditorProsa: caixa vazia recusada, desfazer — a frase some e o texto salvo volta", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    fireEvent.change(caixa("voz"), { target: { value: "" } });
    salvarEm("voz");
    expect(within(bloco("voz")).getByRole("alert").textContent).toBe(CAIXA_VAZIA);
    desfazer(bloco("voz"));
    expect(within(bloco("voz")).queryByRole("alert")).toBeNull();
    expect(caixa("voz").value).toBe(RAMPA.voz);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("EditorNumeroDeMotor: zero recusado, desfazer — a frase some e o número salvo volta", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    fireEvent.change(numero(LIMIAR), { target: { value: "0" } });
    salvarEm(LIMIAR);
    expect(within(bloco(LIMIAR)).getByRole("alert").textContent).toBe(REGRA_QUE_MENTE);
    desfazer(bloco(LIMIAR));
    expect(within(bloco(LIMIAR)).queryByRole("alert")).toBeNull();
    expect(numero(LIMIAR).value).toBe(String(limiarDe(RAMPA)));
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

// 🔴 E NOS OUTROS CINCO, cada um pela recusa que ele tem: sem isto, tirar o
// `limparErro()` de um editor só sobrevivia à suíte (medido, Tarefa 15).
describe("Desfazer limpa a frase de recusa — nos outros cinco editores", () => {
  const semCampo = (chave: "carroComum" | "piso"): Ficha => {
    const f = { ...RAMPA } as Record<string, unknown>;
    delete f[chave];
    return f as Ficha;
  };

  it("EditorBooleano: nada escolhido recusado, marcar, desfazer — a frase some e nada fica marcado", () => {
    comRota();
    render(<FichaInteira ficha={semCampo("carroComum")} />);
    salvarEm("carroComum");
    expect(within(bloco("carroComum")).getByRole("alert").textContent).toBe(NADA_ESCOLHIDO);
    fireEvent.click(within(bloco("carroComum")).getByLabelText(SIM));
    desfazer(bloco("carroComum"));
    expect(within(bloco("carroComum")).queryByRole("alert")).toBeNull();
    expect(within(bloco("carroComum")).getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
  });

  it("EditorLista: nada escolhido recusado, escolher, desfazer — a frase some e a escolha volta ao branco", () => {
    comRota();
    render(<FichaInteira ficha={semCampo("piso")} />);
    salvarEm("piso");
    expect(within(bloco("piso")).getByRole("alert").textContent).toBe(NADA_ESCOLHIDO);
    fireEvent.change(escolha("piso"), { target: { value: PISOS[0] } });
    desfazer(bloco("piso"));
    expect(within(bloco("piso")).queryByRole("alert")).toBeNull();
    expect(escolha("piso").value).toBe("");
  });

  it("EditorFaixas: hora vazia recusada, desfazer — a frase some e a hora salva volta", () => {
    comRota();
    render(<FichaInteira ficha={COM_HORARIO} />);
    fireEvent.change(horas()[0], { target: { value: "" } });
    salvarEm("horario");
    expect(within(bloco("horario")).getByRole("alert").textContent).toBe(HORA_VAZIA);
    desfazer(bloco("horario"));
    expect(within(bloco("horario")).queryByRole("alert")).toBeNull();
    expect(horas()[0].value).toBe(h0.abre);
  });

  it("EditorCoordenada: a porta recusou o ponto, desfazer — a frase dela some e o pin volta", async () => {
    const FRASE = "Frase marcadora da recusa.";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(FRASE, { status: 400 })));
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    render(<FichaInteira ficha={RAMPA} />);
    tocarNoMapa(bloco("condicao.coords"), L / 2 + 60, A / 2 - 30);
    salvarEm("condicao.coords");
    expect((await within(bloco("condicao.coords")).findByRole("alert")).textContent).toBe(FRASE);
    desfazer(bloco("condicao.coords"));
    expect(within(bloco("condicao.coords")).queryByRole("alert")).toBeNull();
    expect(coordEm(bloco("condicao.coords"))).toBe(`${RAMPA.condicao.coords.lat}, ${RAMPA.condicao.coords.lng}`);
  });

  it("EditorWaypoints: ponto novo sem nome recusado, desfazer — a frase some com o ponto novo", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    const editor = screen.getByTestId("editor-waypoints");
    fireEvent.click(within(editor).getByRole("button", { name: ACRESCENTAR_PONTO }));
    tocarNoMapa(editor, L / 2, A / 2);
    fireEvent.click(within(editor).getByRole("button", { name: SALVAR }));
    expect(within(editor).getByRole("alert").textContent).toBe(CAIXA_VAZIA);
    desfazer(editor);
    expect(within(editor).queryByRole("alert")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorNumeroDeMotor — desfazer cancela a prévia que estava esperando o dedo", () => {
  it("mudar pede prévia (depois da espera); desfazer antes dela: nenhuma ida à rede, e a região da prévia vazia", async () => {
    vi.useFakeTimers();
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    fireEvent.change(numero(LIMIAR), { target: { value: String(limiarDe(RAMPA) + 3) } });
    expect(bloco(LIMIAR).querySelector("[data-previsao]")!.textContent, "a premissa: a prévia está esperando").not.toBe("");
    desfazer(bloco(LIMIAR));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchFalso, "a prévia do número desfeito foi pedida").not.toHaveBeenCalled();
    expect(bloco(LIMIAR).querySelector("[data-previsao]")!.textContent).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// O MAPA. O ponteiro como em `admin-editor-coordenada.test.tsx`: `MouseEvent` de
// tipo `pointer*` (o jsdom não tem `PointerEvent`), caixa e moldura dubladas.
const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;
const RECT = { left: 10, top: 20, width: L, height: A };
function dublarRect(el: HTMLElement): void {
  el.getBoundingClientRect = () =>
    ({ ...RECT, x: RECT.left, y: RECT.top, right: RECT.left + L, bottom: RECT.top + A, toJSON: () => ({}) }) as DOMRect;
}
function tocarNoMapa(onde: HTMLElement, x: number, y: number): void {
  const mapa = onde.querySelector<HTMLElement>('[data-testid="mapa-escolher"]')!;
  dublarRect(mapa);
  dublarRect(mapa.parentElement!);
  for (const tipo of ["pointerdown", "pointerup"]) {
    fireEvent(mapa, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: RECT.left + x, clientY: RECT.top + y }));
  }
}
/** Arrasta o FUNDO do mapa (mais que o `TOQUE_MAX_PX`): a vista anda, nenhum pin é posto. */
function arrastarFundo(onde: HTMLElement, x0: number, y0: number, x1: number, y1: number): void {
  const mapa = onde.querySelector<HTMLElement>('[data-testid="mapa-escolher"]')!;
  dublarRect(mapa);
  dublarRect(mapa.parentElement!);
  const em = (tipo: string, x: number, y: number) =>
    fireEvent(mapa, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: RECT.left + x, clientY: RECT.top + y }));
  em("pointerdown", x0, y0);
  em("pointermove", x1, y1);
  em("pointerup", x1, y1);
}
const coordEm = (onde: HTMLElement): string => onde.querySelector('[data-testid="coord-atual"]')!.textContent ?? "";
const parDe = (texto: string) => {
  const [lat, lng] = texto.split(", ").map(Number);
  return { lat, lng };
};

describe("EditorCoordenada — o pin volta ao ponto salvo", () => {
  const PAR = "condicao.coords";
  const salvoTexto = `${RAMPA.condicao.coords.lat}, ${RAMPA.condicao.coords.lng}`;

  it("escondido sem mexer; o toque muda o pin e o Desfazer aparece; um toque volta o pin, sem fetch, e some", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    expect(coordEm(bloco(PAR)), "a premissa: o pin abre no ponto salvo").toBe(salvoTexto);
    expect(desfazerEm(bloco(PAR))).toBeNull();
    tocarNoMapa(bloco(PAR), L / 2 + 60, A / 2 - 30);
    expect(coordEm(bloco(PAR)), "a premissa: o toque mexeu o pin").not.toBe(salvoTexto);
    desfazer(bloco(PAR));
    expect(coordEm(bloco(PAR))).toBe(salvoTexto);
    expect(bloco(PAR).querySelector("[data-pin]"), "o pin sumiu de um ponto que tem coordenada").not.toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(desfazerEm(bloco(PAR))).toBeNull();
  });

  it("um toque na MESMA linha do pin muda só a longitude — e isso também é mudança", () => {
    // M4 da revisão da Tarefa 15: a latitude sai do `top` em pixel, e um toque
    // na linha horizontal do pin dá a MESMA latitude exata.
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    const pin = bloco(PAR).querySelector<HTMLElement>("[data-pin]")!;
    const yDoPin = Number.parseFloat(pin.style.top);
    tocarNoMapa(bloco(PAR), L / 2 + 60, yDoPin);
    const agora = parDe(coordEm(bloco(PAR)));
    expect(agora.lat, "a premissa: a latitude é a mesma").toBe(RAMPA.condicao.coords.lat);
    expect(agora.lng, "a premissa: a longitude mudou").not.toBe(RAMPA.condicao.coords.lng);
    expect(desfazerEm(bloco(PAR)), "mudar só a longitude não contou como mudança").not.toBeNull();
    desfazer(bloco(PAR));
    expect(coordEm(bloco(PAR))).toBe(salvoTexto);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a vista volta junto: o pin desfeito aparece no MEIO do mapa, onde a vista do ponto salvo o põe", () => {
    comRota();
    render(<FichaInteira ficha={RAMPA} />);
    const pin = () => bloco(PAR).querySelector<HTMLElement>("[data-pin]")!;
    const noMeio = { left: pin().style.left, top: pin().style.top };
    // afasta a vista (o −), ARRASTA o fundo (a vista anda, o pin vai junto pra
    // fora do meio) e toca: a vista, o zoom e o pin mudam. 🔴 O arrasto é o que
    // separa "a vista voltou" de "o pin voltou": o − sozinho mantém o pin no
    // mesmo pixel (zoom em volta do pin), e a vista velha o mostraria no meio
    // igual — medido, a mutação "a vista não volta" sobrevivia sem ele.
    fireEvent.click(within(bloco(PAR)).getByRole("button", { name: /afastar/i }));
    arrastarFundo(bloco(PAR), 100, 60, 170, 100);
    tocarNoMapa(bloco(PAR), L / 2 + 60, A / 2 - 30);
    expect({ left: pin().style.left, top: pin().style.top }, "a premissa: o pin saiu do meio").not.toEqual(noMeio);
    desfazer(bloco(PAR));
    expect({ left: pin().style.left, top: pin().style.top }).toEqual(noMeio);
    // e o Salvar não fica preso no portão de "posto de longe": o ponto salvo vale de perto
    expect((bloco(PAR).querySelector(`[data-salvar="${PAR}"]`) as HTMLButtonElement).disabled).toBe(false);
  });

  it("salvar P1, tocar P2, desfazer: volta a P1, o salvo de AGORA", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    const { rerender } = render(<FichaInteira ficha={RAMPA} />);
    tocarNoMapa(bloco(PAR), L / 2 + 60, A / 2 - 30);
    const p1 = coordEm(bloco(PAR));
    salvarEm(PAR);
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
    rerender(<FichaInteira ficha={{ ...RAMPA, condicao: { ...RAMPA.condicao, coords: parDe(p1) } }} />);
    expect(desfazerEm(bloco(PAR))).toBeNull();
    tocarNoMapa(bloco(PAR), L / 2 - 50, A / 2 + 20);
    expect(coordEm(bloco(PAR))).not.toBe(p1);
    desfazer(bloco(PAR));
    expect(coordEm(bloco(PAR))).toBe(p1);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("sem coordenada salva (o lugar novo): o toque põe o pin, e o Desfazer o TIRA — sem Salvar de volta", () => {
    const { fetchFalso } = comRota();
    const campo: CampoNaTela = {
      caminho: PAR,
      rotulo: "A coordenada marcadora",
      obrigatorio: true,
      vista: { centro: RAMPA.condicao.coords, z: MAPA_ZOOM_EDITOR, origem: "cidade" },
    };
    const { container } = render(<EditorCoordenada campo={campo} valor={undefined} slug="lugar-marcador" />);
    expect(container.querySelector("[data-pin]"), "a premissa: nasce sem pin").toBeNull();
    expect(desfazerEm(container)).toBeNull();
    tocarNoMapa(container, L / 2 + 10, A / 2 + 10);
    expect(container.querySelector("[data-pin]")).not.toBeNull();
    desfazer(container);
    expect(container.querySelector("[data-pin]"), "o pin ficou depois de desfazer").toBeNull();
    expect(coordEm(container)).toBe("");
    expect(within(container).queryByRole("button", { name: SALVAR })).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(desfazerEm(container)).toBeNull();
  });

  it("a metade .lng do ponto não tem estado, e não tem Desfazer", () => {
    comRota();
    render(<FichaInteira ficha={RAMPA} />);
    expect(desfazerEm(bloco("trajeto.waypoints.0.lng"))).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorWaypoints — o Desfazer limpa o ponto novo que ainda não foi gravado", () => {
  const editor = (): HTMLElement => screen.getByTestId("editor-waypoints");
  const abrir = () => fireEvent.click(within(editor()).getByRole("button", { name: ACRESCENTAR_PONTO }));
  const nome = () => within(editor()).queryByLabelText(NOME_DO_PONTO_NOVO) as HTMLInputElement | null;

  it("aberto e vazio não tem nada a desfazer; com nome ou pin, tem — e desfazer limpa e fecha, sem fetch", () => {
    const { fetchFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    expect(desfazerEm(editor())).toBeNull();
    abrir();
    expect(desfazerEm(editor()), "abrir não é mudar").toBeNull();
    fireEvent.change(nome()!, { target: { value: "Ponto marcador" } });
    tocarNoMapa(editor(), L / 2, A / 2);
    expect(editor().querySelector("[data-pin]")).not.toBeNull();
    desfazer(editor());
    expect(nome(), "o ponto novo continuou aberto").toBeNull();
    expect(desfazerEm(editor())).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
    // reaberto, nada sobrou: nem o nome, nem o pin
    abrir();
    expect(nome()!.value).toBe("");
    expect(editor().querySelector("[data-pin]")).toBeNull();
  });

  it("a vista volta ao último ponto: reaberto, o toque no MEIO do mapa cai nele, não onde a vista tinha ido", () => {
    comRota();
    render(<FichaInteira ficha={RAMPA} />);
    const ultimo = RAMPA.trajeto.waypoints[RAMPA.trajeto.waypoints.length - 1];
    abrir();
    arrastarFundo(editor(), 100, 60, 220, 140);
    tocarNoMapa(editor(), L / 2, A / 2);
    expect(parDe(coordEm(editor())).lat, "a premissa: o arrasto levou a vista pra longe do último ponto").not.toBeCloseTo(ultimo.lat, 4);
    desfazer(editor());
    abrir();
    tocarNoMapa(editor(), L / 2, A / 2);
    const tocado = parDe(coordEm(editor()));
    expect(tocado.lat).toBeCloseTo(ultimo.lat, 5);
    expect(tocado.lng).toBeCloseTo(ultimo.lng, 5);
  });

  it("só o pin (sem nome) também é rascunho do ponto novo", () => {
    comRota();
    render(<FichaInteira ficha={RAMPA} />);
    abrir();
    tocarNoMapa(editor(), L / 2, A / 2);
    desfazer(editor());
    abrir();
    expect(editor().querySelector("[data-pin]")).toBeNull();
  });

  it("gravado o ponto, a tela relida tem um ponto a mais; o Desfazer do PRÓXIMO não toca no gravado", async () => {
    const { fetchFalso, reloadFalso } = comRota();
    render(<FichaInteira ficha={RAMPA} />);
    abrir();
    fireEvent.change(nome()!, { target: { value: "Ponto marcador" } });
    tocarNoMapa(editor(), L / 2, A / 2);
    fireEvent.click(within(editor()).getByRole("button", { name: SALVAR }));
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
    // O banco agora tem dois pontos, e o reload REMONTA a tela inteira: aqui é
    // render novo, não `rerender` — o ponto novo não tem "salvo" a voltar, a
    // referência dele é sempre "nenhum ponto novo".
    const DOIS = doisPontos();
    cleanup();
    render(<FichaInteira ficha={DOIS} />);
    const nomeDoGravado = DOIS.trajeto.waypoints[1].nome;
    abrir();
    fireEvent.change(nome()!, { target: { value: "Outro marcador" } });
    desfazer(editor());
    expect(
      (within(bloco("trajeto.waypoints.1.nome")).getByRole("textbox") as HTMLTextAreaElement).value,
      "o Desfazer do ponto novo mexeu no ponto gravado",
    ).toBe(nomeDoGravado);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
