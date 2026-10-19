import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import { ORDEM, PERGUNTAS, montarPerguntas } from "@/app/admin/novo/perguntas";
import { montarPerguntasDaPessoa } from "@/app/contribuir/perguntas";
import { rotulosDe } from "@/lib/rotulos-das-opcoes";
import { MAIS_GRUPO, RESPONDA_O_HORARIO_PRIMEIRO, TIRAR_GRUPO, TITULO_DO_GRUPO } from "@/app/admin/campos/EditorGrupos";
import FormularioDeLugar, { PROXIMA, PULAR } from "@/app/admin/FormularioDeLugar";
import { NAO_TEM } from "@/app/admin/campos/BotaoNaoSei";
import { AvisoDeMudanca } from "@/app/admin/campos/gravar";
import { DESFAZER, HORA_VAZIA, SALVAR } from "@/app/admin/campos/palavras";
import { getAllFichas } from "@/lib/ficha";
import { DIAS, NOME_DO_DIA } from "@/lib/semana";
import { type Ficha, fichaSchema } from "@/types/ficha";
import { bancoDeProducao } from "../banco";
import { regraDe, semComentarios, valorDe } from "../css";

/** O EDITOR DOS GRUPOS DO HORÁRIO DIFERENTE (T2 da rodada de 18/10). Como os
 *  vizinhos (`admin-editores-de-campo.test.tsx`), renderiza a `FichaInteira`
 *  INTEIRA e mede dentro do bloco do campo: é o servidor que monta o
 *  `CampoNaTela` (os dias oferecidos são os ABERTOS do lugar), e um editor
 *  testado solto com props à mão esconderia o defeito de fiação. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

await bancoDeProducao();
const ACERVO: Ficha[] = (await getAllFichas()).map((f) => fichaSchema.parse(f));
// A ficha com horário: a Pedra Furada (05:00–17:00, todo dia).
const PEDRA = ACERVO.find((f) => f.slug === "pedra-furada-de-venturosa");
if (!PEDRA || PEDRA.horario === undefined || PEDRA.dias !== undefined) {
  throw new Error("a premissa mudou: a Pedra Furada tinha horário e não tinha dias");
}

const CAMPO = "horarioPorDia";
const bloco = (): HTMLElement => screen.getByTestId(`campo-${CAMPO}`);
const grupo = (i: number): HTMLElement => bloco().querySelector<HTMLElement>(`[data-grupo="${i}"]`)!;
const grupos = (): number => bloco().querySelectorAll("[data-grupo]").length;
const caixaDeDia = (i: number, dia: string): HTMLInputElement =>
  within(grupo(i)).getByRole("checkbox", { name: NOME_DO_DIA[dia as keyof typeof NOME_DO_DIA] }) as HTMLInputElement;
const diasNaTela = (i: number): string[] =>
  [...grupo(i).querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map((c) => c.value);
const hora = (g: number, f: number, chave: "abre" | "fecha"): HTMLInputElement =>
  bloco().querySelector<HTMLInputElement>(`[data-hora="${CAMPO}.${g}.faixas.${f}.${chave}"]`)!;
const botao = (sel: string): HTMLButtonElement | null => bloco().querySelector<HTMLButtonElement>(sel);
const salvar = (): void => void fireEvent.click(botao(`[data-salvar="${CAMPO}"]`)!);

type Requisicao = { method: string; body: string };
function comRota() {
  const fetchFalso = vi.fn((_url: string, _init: Requisicao) => Promise.resolve(Response.json({ id: 99 })));
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
  return fetchFalso;
}
const corpo = (f: ReturnType<typeof comRota>): Record<string, unknown> => JSON.parse(f.mock.calls[0][1].body);

const SALVOS = [
  { dias: ["dom", "sab"] as ("dom" | "sab")[], faixas: [{ abre: "07:00", fecha: "12:00" }] },
];

describe("EditorGrupos — sem resposta", () => {
  it("um grupo vazio: as 7 caixas de dia, as caixas de hora, Salvar e '+ outro grupo'; sem 'Não tem'", () => {
    render(<FichaInteira ficha={PEDRA} />);
    expect(grupos()).toBe(1);
    expect(within(grupo(0)).getByText(`${TITULO_DO_GRUPO} 1`)).toBeTruthy();
    expect(diasNaTela(0), "os dias, na ordem da semana").toEqual([...DIAS]);
    expect(diasNaTela(0).map((d) => caixaDeDia(0, d).checked), "nada pré-marcado").toEqual(DIAS.map(() => false));
    expect([hora(0, 0, "abre").value, hora(0, 0, "fecha").value], "nada pré-preenchido").toEqual(["", ""]);
    expect(botao(`[data-salvar="${CAMPO}"]`)?.textContent).toBe(SALVAR);
    expect(botao("[data-mais-grupo]")?.textContent).toBe(MAIS_GRUPO);
    expect(botao(`[data-nao-sei="${CAMPO}"]`), "sem resposta, o 'não tem' não faria nada").toBeNull();
    expect(botao("[data-tirar-grupo]"), "com um grupo só, não há 'tirar'").toBeNull();
  });

  // 🔴 OS DIAS OFERECIDOS SÃO OS QUE O LUGAR ABRE (spec §6): o servidor filtra.
  it("com `dias` respondido, só os dias abertos aparecem", () => {
    render(<FichaInteira ficha={{ ...PEDRA, dias: ["seg", "sex", "sab"] }} />);
    expect(diasNaTela(0)).toEqual(["seg", "sex", "sab"]);
  });
});

describe("EditorGrupos — o Salvar", () => {
  it("marcar sáb e dom + 07:00–12:00 → a lista inteira, os dias na ordem do registro", async () => {
    const fetchFalso = comRota();
    render(<FichaInteira ficha={PEDRA} />);
    fireEvent.click(caixaDeDia(0, "sab"));
    fireEvent.click(caixaDeDia(0, "dom"));
    fireEvent.change(hora(0, 0, "abre"), { target: { value: "07:00" } });
    fireEvent.change(hora(0, 0, "fecha"), { target: { value: "12:00" } });
    salvar();
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpo(fetchFalso)).toEqual({
      slug: PEDRA.slug,
      campo: CAMPO,
      valor: [{ dias: ["dom", "sab"], faixas: [{ abre: "07:00", fecha: "12:00" }] }],
    });
  });

  it("hora vazia não viaja: a frase do formato", () => {
    const fetchFalso = comRota();
    render(<FichaInteira ficha={PEDRA} />);
    fireEvent.click(caixaDeDia(0, "sab"));
    fireEvent.change(hora(0, 0, "abre"), { target: { value: "07:00" } });
    salvar();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(bloco().querySelector('[role="alert"]')?.textContent).toBe(HORA_VAZIA);
  });

  it("dois grupos, cada um com as faixas na ordem do dia", async () => {
    const fetchFalso = comRota();
    render(<FichaInteira ficha={PEDRA} />);
    fireEvent.click(caixaDeDia(0, "sab"));
    fireEvent.change(hora(0, 0, "abre"), { target: { value: "14:00" } });
    fireEvent.change(hora(0, 0, "fecha"), { target: { value: "16:00" } });
    fireEvent.click(within(grupo(0)).getByRole("button", { name: /outra faixa/ }));
    fireEvent.change(hora(0, 1, "abre"), { target: { value: "07:00" } });
    fireEvent.change(hora(0, 1, "fecha"), { target: { value: "12:00" } });
    fireEvent.click(botao("[data-mais-grupo]")!);
    fireEvent.click(caixaDeDia(1, "qua"));
    fireEvent.change(hora(1, 0, "abre"), { target: { value: "09:00" } });
    fireEvent.change(hora(1, 0, "fecha"), { target: { value: "13:00" } });
    salvar();
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpo(fetchFalso).valor).toEqual([
      { dias: ["sab"], faixas: [{ abre: "07:00", fecha: "12:00" }, { abre: "14:00", fecha: "16:00" }] },
      { dias: ["qua"], faixas: [{ abre: "09:00", fecha: "13:00" }] },
    ]);
  });
});

describe("EditorGrupos — a lista de grupos", () => {
  // 🔴 Pra exigir menos (spec §6): um dia já usado por outro grupo aparece
  // desligado — a regra da porta (o mesmo dia em dois grupos) nem chega a ser
  // alcançável pela tela.
  it("dia marcado num grupo aparece desligado no outro, e volta quando desmarcado", () => {
    render(<FichaInteira ficha={PEDRA} />);
    fireEvent.click(caixaDeDia(0, "sab"));
    fireEvent.click(botao("[data-mais-grupo]")!);
    expect(caixaDeDia(1, "sab").disabled).toBe(true);
    expect(caixaDeDia(1, "dom").disabled).toBe(false);
    expect(caixaDeDia(0, "sab").disabled, "no próprio grupo ele continua mexível").toBe(false);
    fireEvent.click(caixaDeDia(0, "sab"));
    expect(caixaDeDia(1, "sab").disabled).toBe(false);
  });

  it("'+ outro grupo' até 3 (e some no 3º); 'tirar este grupo' tira o certo; nada disso grava", () => {
    const fetchFalso = comRota();
    render(<FichaInteira ficha={PEDRA} />);
    fireEvent.click(botao("[data-mais-grupo]")!);
    fireEvent.click(botao("[data-mais-grupo]")!);
    expect(grupos()).toBe(3);
    expect(botao("[data-mais-grupo]"), "com 3 grupos o '+ outro grupo' continua oferecido").toBeNull();
    fireEvent.click(caixaDeDia(2, "qui"));
    const tirar = within(grupo(1)).getByRole("button", { name: TIRAR_GRUPO });
    fireEvent.click(tirar);
    expect(grupos()).toBe(2);
    expect(caixaDeDia(1, "qui").checked, "tirou o grupo errado").toBe(true);
    expect(botao("[data-mais-grupo]")).not.toBeNull();
    for (const b of bloco().querySelectorAll("[data-mais-grupo], [data-tirar-grupo]")) {
      expect((b as HTMLButtonElement).type).toBe("button");
    }
    expect(fetchFalso, "mexer na lista foi à porta").not.toHaveBeenCalled();
  });

  it("com grupos salvos: aparecem marcados e preenchidos, e há o 'Não tem' (que tira o campo)", async () => {
    const fetchFalso = comRota();
    render(<FichaInteira ficha={{ ...PEDRA, horarioPorDia: SALVOS }} />);
    expect(caixaDeDia(0, "sab").checked && caixaDeDia(0, "dom").checked).toBe(true);
    expect(caixaDeDia(0, "seg").checked).toBe(false);
    expect([hora(0, 0, "abre").value, hora(0, 0, "fecha").value]).toEqual(["07:00", "12:00"]);
    const naoTem = botao(`[data-nao-sei="${CAMPO}"]`)!;
    expect(naoTem.textContent).toBe(NAO_TEM);
    fireEvent.click(naoTem);
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpo(fetchFalso)).toEqual({ slug: PEDRA.slug, campo: CAMPO, naoSei: true });
  });
});

describe("EditorGrupos — Desfazer e o segundo toque", () => {
  it("Desfazer volta ao salvo: dias, horas e grupos acrescentados", () => {
    render(<FichaInteira ficha={{ ...PEDRA, horarioPorDia: SALVOS }} />);
    expect(within(bloco()).queryByRole("button", { name: DESFAZER }), "sem mudança, sem Desfazer").toBeNull();
    fireEvent.click(caixaDeDia(0, "seg"));
    fireEvent.change(hora(0, 0, "fecha"), { target: { value: "13:00" } });
    fireEvent.click(botao("[data-mais-grupo]")!);
    fireEvent.click(within(bloco()).getByRole("button", { name: DESFAZER }));
    expect(grupos()).toBe(1);
    expect(caixaDeDia(0, "seg").checked).toBe(false);
    expect(caixaDeDia(0, "sab").checked).toBe(true);
    expect(hora(0, 0, "fecha").value).toBe("12:00");
    expect(within(bloco()).queryByRole("button", { name: DESFAZER })).toBeNull();
  });

  // A ordem dos toques não é mudança: desmarcar e marcar o mesmo dia de novo.
  it("desmarcar e marcar de novo o mesmo dia não conta como mudança", () => {
    render(<FichaInteira ficha={{ ...PEDRA, horarioPorDia: SALVOS }} />);
    fireEvent.click(caixaDeDia(0, "dom"));
    fireEvent.click(caixaDeDia(0, "dom"));
    expect(within(bloco()).queryByRole("button", { name: DESFAZER })).toBeNull();
  });

  // 🔴 O SEGUNDO TOQUE DO FORMULÁRIO (17/10) depende do aviso: todo editor
  // avisa por `AvisoDeMudanca` — este também, e desavisa ao desfazer.
  it("avisa o formulário quando há mudança não salva, e desavisa ao voltar", () => {
    const avisos: boolean[] = [];
    render(
      <AvisoDeMudanca.Provider value={(m) => void avisos.push(m)}>
        <FichaInteira ficha={PEDRA} />
      </AvisoDeMudanca.Provider>,
    );
    fireEvent.click(caixaDeDia(0, "sab"));
    expect(avisos.at(-1)).toBe(true);
    fireEvent.click(caixaDeDia(0, "sab"));
    expect(avisos.at(-1)).toBe(false);
  });
});

describe("EditorGrupos — cabe no celular", () => {
  // 🔴 A 375 px (343 de miolo, com o gutter de 16): nenhuma classe nova tem
  // largura fixa ou mínima maior que isso. As que existem estão aqui por NOME —
  // e cada uma tem regra (senão o elemento cai no default do navegador).
  const NOVAS = [".adm-editor-grupo", ".adm-editor-grupo-titulo", ".adm-editor-mais-grupo", ".adm-editor-tirar-grupo"];
  it("as classes novas têm regra no admin.css, sem largura acima de 343px", () => {
    const css = semComentarios("admin/admin.css");
    for (const sel of NOVAS) {
      const regra = regraDe(css, sel);
      expect(regra, `faltou a regra ${sel}`).not.toBeNull();
      for (const prop of ["width", "min-width"]) {
        const v = valorDe(regra![0], prop);
        if (v === null || v === undefined) continue;
        // Só o que não pode passar da tela: 0, auto, porcentagem ou px ≤ 343
        // (rem/em/vw fixos ficam de fora — a conta depende da fonte).
        const px = /^(\d+(?:\.\d+)?)px$/.exec(v);
        const solta = v === "0" || v === "auto" || /^\d+(?:\.\d+)?%$/.test(v);
        expect(solta || (px !== null && Number(px[1]) <= 343), `${sel} { ${prop}: ${v} }`).toBe(true);
      }
    }
  });
  it("e o editor usa essas classes (a lista acima não é fantasma)", () => {
    render(<FichaInteira ficha={{ ...PEDRA, horarioPorDia: SALVOS }} />);
    fireEvent.click(botao("[data-mais-grupo]")!);
    for (const sel of NOVAS) expect(bloco().querySelector(sel), sel).not.toBeNull();
  });
});

describe("a pergunta no lugar novo e na tela de quem usa", () => {
  it("a pergunta é a do questionário, e vem logo depois de horário e dias", () => {
    expect(PERGUNTAS.horarioPorDia).toBe(
      "Algum dia esse lugar abre ou fecha em outra hora? Se tiver, quais dias e que horas?",
    );
    expect(ORDEM.slice(-3)).toEqual(["horario", "dias", "horarioPorDia"]);
  });

  // 🔴 ONDE O FILTRO DOS DIAS ABERTOS MORA NO LUGAR NOVO: no servidor que monta a
  // pergunta, a partir dos `dias` que o RASCUNHO já respondeu (a pergunta dos
  // dias vem antes, e cada tela é montada de novo pelo servidor).
  const grupos = (doc: unknown) => montarPerguntas(doc).find((q) => q.campo.caminho === CAMPO)!;
  it("o lugar novo oferece os dias abertos do rascunho, com o nome de cada um", () => {
    const sem = grupos({ slug: "x" });
    expect(sem.especie).toBe("grupos");
    expect(sem.campo.obrigatorio).toBe(false);
    expect(sem.campo.opcoes, "sem dias respondidos: os sete").toEqual([...DIAS]);
    expect(sem.campo.rotulos).toEqual(rotulosDe("dias"));
    expect(grupos({ slug: "x", dias: ["sab", "seg"] }).campo.opcoes, "na ordem da semana").toEqual(["seg", "sab"]);
  });

  it("quem usa tem a mesma pergunta, opcional, depois dos dias", () => {
    const dela = montarPerguntasDaPessoa({ dias: ["dom", "sab"] });
    const caminhos = dela.map((q) => q.campo.caminho);
    expect(caminhos.indexOf(CAMPO)).toBe(caminhos.indexOf("dias") + 1);
    const q = dela.find((x) => x.campo.caminho === CAMPO)!;
    expect(q.texto).toBe(PERGUNTAS.horarioPorDia);
    expect(q.campo.obrigatorio).toBe(false);
    expect(q.campo.opcoes).toEqual(["dom", "sab"]);
  });
});

// 🔴 SEM O HORÁRIO DE SEMPRE, NADA DE EDITOR (T5c, spec §6: "exija menos do
// usuário"): um grupo é "diferente" do horário de sempre, e sem ele o Salvar
// só recusaria com `GRUPO_SEM_HORARIO`. No lugar das caixas, uma linha curta.
describe("sem horário, a linha no lugar do editor", () => {
  const RAMPA = ACERVO.find((f) => f.slug === "rampa-do-pepe");
  if (!RAMPA || RAMPA.horario !== undefined || RAMPA.horarioPorDia !== undefined) {
    throw new Error("a premissa mudou: a Rampa não tinha horário nem horário diferente");
  }
  const grupos0 = (doc: unknown) => montarPerguntas(doc).find((q) => q.campo.caminho === CAMPO)!;
  const SEM_HORARIO_NO_FORM = (q: { campo: { semHorario?: boolean } }) => q.campo.semHorario === true;

  it("a ficha sem horário: a linha, sem caixas, sem Salvar, sem '+ outro grupo'", () => {
    render(<FichaInteira ficha={RAMPA} />);
    expect(bloco().textContent).toContain(RESPONDA_O_HORARIO_PRIMEIRO);
    expect(bloco().querySelectorAll("input, button")).toHaveLength(0);
    expect(grupos()).toBe(0);
  });

  it("a ficha com horário: o editor, e a linha não aparece", () => {
    render(<FichaInteira ficha={PEDRA} />);
    expect(bloco().textContent).not.toContain(RESPONDA_O_HORARIO_PRIMEIRO);
    expect(grupos()).toBe(1);
    expect(botao(`[data-salvar="${CAMPO}"]`)).not.toBeNull();
  });

  // Dado gravado não se esconde: as portas já recusam criar este estado, mas um
  // documento pode chegar assim.
  it("tem horário diferente e perdeu o horário: o editor aparece, com o que está gravado", () => {
    render(<FichaInteira ficha={{ ...RAMPA, horarioPorDia: SALVOS }} />);
    expect(bloco().textContent).not.toContain(RESPONDA_O_HORARIO_PRIMEIRO);
    expect(grupos()).toBe(1);
    expect(caixaDeDia(0, "dom").checked).toBe(true);
  });

  it("o lugar novo, painel e quem usa: o servidor manda `semHorario` só quando falta o horário", () => {
    const sem = { slug: "x" };
    const com = { slug: "x", horario: [{ abre: "08:00", fecha: "17:00" }] };
    const pelaPessoa = (doc: object) => montarPerguntasDaPessoa(doc).find((q) => q.campo.caminho === CAMPO)!;
    expect(SEM_HORARIO_NO_FORM(grupos0(sem)), "painel, sem horário").toBe(true);
    expect(SEM_HORARIO_NO_FORM(grupos0(com)), "painel, com horário").toBe(false);
    expect(SEM_HORARIO_NO_FORM(pelaPessoa(sem)), "quem usa, sem horário").toBe(true);
    expect(SEM_HORARIO_NO_FORM(pelaPessoa(com)), "quem usa, com horário").toBe(false);
    expect(SEM_HORARIO_NO_FORM(grupos0({ ...sem, horarioPorDia: SALVOS })), "dado gravado não se esconde").toBe(false);
  });

  it("no formulário do lugar novo: a linha no lugar do editor, e Pular e Próxima seguem", () => {
    for (const onde of ["painel", "contribuir"] as const) {
      cleanup();
      const montar = onde === "painel" ? montarPerguntas : montarPerguntasDaPessoa;
      const todas = montar({ slug: "x" });
      const pergunta = todas.find((q) => q.campo.caminho === CAMPO)!;
      const { container, getByRole } = render(
        <FormularioDeLugar slug="x" pergunta={pergunta} posicao={todas.length} respondidas={todas.map(() => false)} onde={onde} />,
      );
      expect(container.textContent, onde).toContain(RESPONDA_O_HORARIO_PRIMEIRO);
      expect(container.querySelectorAll('input[type="checkbox"]'), onde).toHaveLength(0);
      expect(container.querySelector(`[data-salvar="${CAMPO}"]`), onde).toBeNull();
      expect(getByRole("button", { name: PULAR }), onde).toBeTruthy();
      expect(getByRole("link", { name: PROXIMA }), onde).toBeTruthy();
    }
  });

  it("no formulário do lugar novo COM horário: o editor", () => {
    const todas = montarPerguntas({ slug: "x", horario: [{ abre: "08:00", fecha: "17:00" }] });
    const pergunta = todas.find((q) => q.campo.caminho === CAMPO)!;
    const { container } = render(
      <FormularioDeLugar slug="x" pergunta={pergunta} posicao={todas.length} respondidas={todas.map(() => false)} />,
    );
    expect(container.textContent).not.toContain(RESPONDA_O_HORARIO_PRIMEIRO);
    expect(container.querySelector(`[data-salvar="${CAMPO}"]`)).not.toBeNull();
  });
});
