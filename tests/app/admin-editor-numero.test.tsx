import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FichaInteira from "@/app/admin/FichaInteira";
import { ESPERA_PREVIA_MS } from "@/app/admin/campos/EditorNumeroDeMotor";
import { ERRO_GRAVAR } from "@/app/admin/campos/gravar";
import {
  ALEM_DO_PROVEDOR,
  CAIXA_VAZIA,
  COM_ESTE_NUMERO,
  JANELA_NEGATIVA,
  JANELA_PASSADO_NEGATIVA,
  PREVENDO,
  PREVISAO_FALHOU,
  REGRA_QUE_MENTE,
  SALVAR,
} from "@/app/admin/campos/palavras";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";
import { avaliar } from "@/lib/motor";
import { CAMPOS_DA_FICHA, camposDaFicha } from "@/lib/campos-da-ficha";
import { getAllFichas } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao } from "../banco";

/** O NÚMERO DE MOTOR COM A CONSEQUÊNCIA AO VIVO (Task 7, 2026-09-30).
 *
 *  🔴 TODO CASO RENDERIZA A `FichaInteira` INTEIRA e mede DENTRO do bloco do
 *  campo, e isto é decisão, não hábito. O plano escrevia
 *  `<EditorNumeroDeMotor campo={campoPorCaminho(...)!} …>`, que **não compila**
 *  (o registro devolve `CampoDaFicha`, sem `rotulo`; o editor recebe
 *  `CampoNaTela`) — e, se compilasse, montar as props à mão esconderia defeito de
 *  FIAÇÃO: rótulo errado, número errado ou espécie errada passariam verdes. É o
 *  SERVIDOR que monta o `CampoNaTela`, então é o servidor que tem de ser medido.
 *
 *  🔴 A FALA DA PRÉVIA VEM DA ROTA COMO SENTINELA (`MARCA_DA_ROTA`), não com as
 *  palavras de verdade, e de propósito: assim este arquivo prova que o componente
 *  RENDERIZA O QUE A ROTA DISSE em vez de sintetizar a fala por conta própria — uma
 *  segunda cópia da fala aqui passaria verde com o editor montando as palavras
 *  sozinho. As palavras de verdade ("Não vá", `Espera {n}h`) são medidas onde elas
 *  nascem, em `tests/api/route-admin-previsao-carimbo.test.ts`.
 *
 *  🔴 E A TERCEIRA CAMADA NÃO MORA AQUI. A recusa do zero tem três camadas, e
 *  este arquivo prova só a PRIMEIRA — a que recusa antes de qualquer viagem, com a
 *  frase, e cravando que NENHUMA das duas rotas foi chamada. A segunda (a rota de
 *  prévia, 400) está no arquivo da rota. A terceira, que é a garantia, é a porta de
 *  escrita, e ela já existia antes desta tarefa: `PUT /api/admin/ficha` devolve 409
 *  com a frase da regra `janela-nao-zerada`, provado em
 *  `tests/api/route-admin-ficha.test.ts`. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// A prévia espera o dedo parar (`ESPERA_PREVIA_MS`) antes de perguntar: o
// `waitFor` padrão de 1 s ficaria a meio segundo da borda.
configure({ asyncUtilTimeout: 3_000 });

/** Espera de relógio de verdade maior que a pausa da prévia — pra separar duas
 *  digitações em duas perguntas. */
const pausa = (): Promise<void> => new Promise((ok) => setTimeout(ok, ESPERA_PREVIA_MS + 50));

await bancoDeProducao();
const ACERVO = await getAllFichas();

function exigir(slug: string): Ficha {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) throw new Error(`"${slug}" sumiu do acervo — este arquivo mede as fichas reais`);
  return f;
}

const FICHA = exigir("rampa-do-pepe");

const ROTA_PREVISAO = "/api/admin/previsao-carimbo";
const ROTA_FICHA = "/api/admin/ficha";

/** Os três caminhos de número DO REGISTRO, nunca escritos aqui: um campo novo na
 *  regra de chuva entra nos laços deste arquivo sozinho. */
const NUMEROS = CAMPOS_DA_FICHA.filter((c) => c.especie === "numero").map((c) => c.caminho);
const LIMIAR = "condicao.regra.limiar_mm";
const PASSADO = "condicao.regra.janela_passado_horas";
const PREVISAO = "condicao.regra.janela_previsao_horas";

const MARCA_DA_ROTA = "MARCA QUE SO A ROTA SABE";
const SUB_DA_ROTA = "sub que so a rota sabe";

const bloco = (caminho: string): HTMLElement => screen.getByTestId(`campo-${caminho}`);
const emCampo = (caminho: string) => within(bloco(caminho));
const caixa = (caminho: string): HTMLInputElement =>
  bloco(caminho).querySelector(`[data-numero="${caminho}"]`) as HTMLInputElement;
const previsaoDe = (caminho: string): HTMLElement =>
  bloco(caminho).querySelector(`[data-previsao="${caminho}"]`) as HTMLElement;

const digitar = (caminho: string, texto: string): void => {
  fireEvent.change(caixa(caminho), { target: { value: texto } });
};
const salvar = (caminho: string): void => {
  fireEvent.click(bloco(caminho).querySelector(`[data-salvar="${caminho}"]`)!);
};

type Chamada = [string, { method: string; body: string }];

/** As duas rotas dubladas, separadas por URL — porque metade das provas deste
 *  arquivo é sobre QUAL delas foi chamada, e um dublê único não distinguiria
 *  "previu" de "gravou". `previsao` deixa cada caso decidir a resposta da prévia
 *  pelo valor pedido. */
function comRotas(previsao?: (valor: number) => Response | Error | Promise<Response>) {
  const fetchFalso = vi.fn((url: string, init: { method: string; body: string }) => {
    if (url === ROTA_PREVISAO) {
      const r = previsao
        ? previsao(JSON.parse(init.body).valor as number)
        : Response.json({ estado: "frio", marca: MARCA_DA_ROTA, sub: SUB_DA_ROTA });
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(r);
    }
    return Promise.resolve(Response.json({ id: 99 }));
  });
  vi.stubGlobal("fetch", fetchFalso);
  const reloadFalso = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload: reloadFalso });
  return { fetchFalso, reloadFalso };
}

type Falso = ReturnType<typeof comRotas>["fetchFalso"];
const chamadas = (f: Falso, url: string): Chamada[] =>
  (f.mock.calls as Chamada[]).filter((c) => c[0] === url);
const corpoDe = (c: Chamada): Record<string, unknown> => JSON.parse(c[1].body);

// ═══════════════════════════════════════════════════════════════════════════
describe("EditorNumeroDeMotor — a caixa do número", () => {
  it("a caixa de cada um dos três abre com o número que está no banco", () => {
    render(<FichaInteira ficha={FICHA} />);
    expect(NUMEROS.length, "o registro perdeu os campos de número: o caso ficaria oco").toBe(3);
    for (const caminho of NUMEROS) {
      const atual = caminho.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], FICHA);
      expect(caixa(caminho).value, `${caminho} não abriu com o valor do banco`).toBe(String(atual));
    }
    // 🔴 E NÃO É "ESTÁ EM ALGUM LUGAR DA TELA": os três são números diferentes
    // nesta ficha (3 / 6 / 0.2), então uma fiação trocada poria o número de um
    // campo na caixa do outro e isto ficaria vermelho.
    expect(new Set(NUMEROS.map((c) => caixa(c).value)).size, "os três mostram o mesmo número").toBe(3);
  });

  // 🔴 A ASSERÇÃO QUE SUSTENTA UMA DECISÃO: não há conferência de "é número?"
  // neste editor porque um `type="number"` que o navegador implementa não produz
  // texto solto. No dia em que o instrumento deixar de ser `number`, este caso
  // fica vermelho e a decisão precisa de outra — é a mesma trava que o
  // `EditorFaixas` tem pro `type="time"`.
  it("o instrumento é `type=number`, nos três", () => {
    render(<FichaInteira ficha={FICHA} />);
    for (const caminho of NUMEROS) {
      expect(caixa(caminho).type, `${caminho} deixou de ser um controle de número`).toBe("number");
    }
  });

  it("o rótulo do campo chega como `aria-label` do controle, e não como segundo rótulo visível", () => {
    render(<FichaInteira ficha={FICHA} />);
    const rotulo = bloco(LIMIAR).querySelector("[data-rotulo]")!.textContent!;
    expect(caixa(LIMIAR).getAttribute("aria-label")).toBe(rotulo);
    // o rótulo aparece UMA vez no bloco — o `aria-label` não é nó de texto
    expect(emCampo(LIMIAR).queryAllByText(rotulo)).toHaveLength(1);
  });

  // ⚠️ O CASO "não há `<p>` de leitura repetindo o número" (A7 do brief) SAIU
  // NA TAREFA 11d: o `<p>` de leitura da `FichaInteira` (`.adm-campo-valor`,
  // o `MOSTRAR`) foi apagado com o bloco `horario`, e o caso passaria por
  // construção. O editor continua sendo o número — é o caso de cima.

  // ⚠️ Os três são obrigatórios, e é por isso que não existe "não sei" aqui. O
  // caso mede o REGISTRO e a TELA: se um campo de número nascer opcional, ele sai
  // vermelho e alguém decide o botão em vez de o campo ficar sem saída.
  it("nenhum número é opcional no registro, e nenhum oferece `não sei`", () => {
    render(<FichaInteira ficha={FICHA} />);
    for (const caminho of NUMEROS) {
      const campo = CAMPOS_DA_FICHA.find((c) => c.caminho === caminho)!;
      expect(campo.obrigatorio, `${caminho} ficou opcional e o editor não oferece "não sei"`).toBe(true);
      expect(
        bloco(caminho).querySelector(`[data-nao-sei="${caminho}"]`),
        `${caminho} ganhou um "não sei" num campo obrigatório`,
      ).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("A prévia — a consequência antes de gravar", () => {
  // 🔴 O CASO DO PLANO: mudar o número mostra a FALA, e o PUT não saiu.
  it("mudar o número mostra a FALA do carimbo previsto, e NÃO grava", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(LIMIAR, "9");

    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
    expect(previsaoDe(LIMIAR).textContent).toContain(SUB_DA_ROTA);
    expect(previsaoDe(LIMIAR).textContent).toContain(COM_ESTE_NUMERO);
    // 🔴 NUNCA O NOME DO PARÂMETRO: o dono lê a consequência, não o campo do JSON.
    expect(previsaoDe(LIMIAR).textContent).not.toContain("limiar_mm");
    expect(previsaoDe(LIMIAR).textContent).not.toContain("frio");
    expect(chamadas(fetchFalso, ROTA_FICHA), "mudar o número gravou sozinho").toHaveLength(0);
  });

  it("a prévia pede ao servidor o CAMPO que ele está editando, e o número novo", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PASSADO, "12");

    await waitFor(() => expect(chamadas(fetchFalso, ROTA_PREVISAO)).toHaveLength(1));
    expect(corpoDe(chamadas(fetchFalso, ROTA_PREVISAO)[0])).toEqual({
      slug: FICHA.slug,
      campo: PASSADO,
      valor: 12,
    });
  });

  // 🔴 A FALA ENTRA NO BLOCO DAQUELE CAMPO, não "em algum lugar da tela" — a
  // espécie que este projeto pegou em 25/09. Com três campos de número na mesma
  // seção, uma prévia que pintasse no bloco errado é defeito de verdade.
  it("a fala aparece no bloco DAQUELE campo, e os outros dois seguem em branco", async () => {
    comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(LIMIAR, "9");

    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
    for (const outro of NUMEROS.filter((c) => c !== LIMIAR)) {
      expect(previsaoDe(outro).textContent, `${outro} pintou a prévia de outro campo`).toBe("");
    }
  });

  // 🔴 A PRÉVIA NÃO APARECE EM REPOUSO, e esta é a resposta ao A8 do brief: a
  // metade da TELA do cerco de nome de lugar varre todo nó de texto dentro de
  // `[data-editor]`, e a fala do motor vem de `src/lib/severidade.ts`, FORA da
  // árvore varrida. Renderizar em repouso poria copy de fora da cerca dentro do
  // corpus dela sem ninguém ter decidido isso. E a razão de produto decide junto:
  // em repouso o número é o gravado, e a consequência dele já está no carimbo do
  // topo do mesmo painel.
  it("em repouso a região da prévia está no DOM e VAZIA, nos três e nas três fichas", () => {
    for (const f of ACERVO) {
      const { unmount } = render(<FichaInteira ficha={f} />);
      for (const caminho of NUMEROS) {
        // No DOM: `aria-live` só anuncia mudança de região que já existia.
        expect(previsaoDe(caminho), `${caminho}: a região da prévia não está no DOM`).not.toBeNull();
        expect(previsaoDe(caminho).getAttribute("aria-live")).toBe("polite");
        expect(previsaoDe(caminho).textContent, `${caminho}: a prévia falou sem ninguém mudar nada`).toBe("");
      }
      unmount();
    }
  });

  it("em repouso a prévia não é nem PEDIDA: nenhuma rota é chamada no render", () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);
    expect(fetchFalso, "só abrir a ficha do lugar já bateu numa rota").not.toHaveBeenCalled();
  });

  // 🔴 E VOLTAR AO NÚMERO GRAVADO NÃO PEDE PRÉVIA: a consequência do número que
  // já está lá é o carimbo do topo do painel, e pedi-la de novo seria dizer a
  // mesma coisa duas vezes — além de uma viagem ao Turso por nada.
  it("digitar de volta o número que já está gravado não pede prévia, e apaga a que havia", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(LIMIAR, "9");
    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
    digitar(LIMIAR, String(FICHA.condicao.regra.limiar_mm));

    expect(chamadas(fetchFalso, ROTA_PREVISAO), "pediu prévia do número que já está no banco").toHaveLength(1);
    expect(previsaoDe(LIMIAR).textContent, "a prévia do número abandonado ficou na tela").toBe("");
  });

  it("enquanto a prévia não chega, a tela diz que está conferindo", async () => {
    let soltar!: (r: Response) => void;
    comRotas(() => new Promise<Response>((ok) => (soltar = ok)));
    render(<FichaInteira ficha={FICHA} />);

    digitar(LIMIAR, "9");

    expect(previsaoDe(LIMIAR).textContent).toBe(PREVENDO);
    await waitFor(() => expect(soltar).toBeDefined());
    expect(previsaoDe(LIMIAR).textContent).toBe(PREVENDO);
    soltar(Response.json({ estado: "frio", marca: MARCA_DA_ROTA, sub: SUB_DA_ROTA }));
    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
  });

  for (const [nome, resposta] of [
    // 🔴 O 503 é a rota dizendo que a chuva não veio (provedor recusou, caiu, ou
    // estourou o prazo) — onda de conserto 1. Nunca vira carimbo.
    ["a chuva não veio (503)", new Response("", { status: 503 })],
    ["a rota recusa", new Response("", { status: 400 })],
    ["a rota some", new Response("", { status: 500 })],
    ["a rede cai", new Error("sem rede")],
  ] as const) {
    it(`${nome}: a tela diz que não conseguiu conferir — e o Salvar continua de pé`, async () => {
      const { fetchFalso } = comRotas(() => resposta);
      render(<FichaInteira ficha={FICHA} />);

      digitar(LIMIAR, "9");

      await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toBe(PREVISAO_FALHOU));
      // 🔴 A PRÉVIA É AJUDA, NÃO PORTÃO. Travar o Salvar porque a prévia não veio
      // deixaria o dono sem gravar uma verdade por causa de uma rede ruim — e o
      // portão de verdade é a porta de escrita.
      const botao = emCampo(LIMIAR).getByRole("button", { name: SALVAR });
      expect((botao as HTMLButtonElement).disabled).toBe(false);
      salvar(LIMIAR);
      await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
    });
  }

  // 🔴 RESPOSTA ATRASADA DE UM NÚMERO ABANDONADO NÃO VIRA TELA. Ele digita `1`,
  // depois `12`, e as duas respostas podem voltar fora de ordem: sem comparar o
  // número pedido, a tela mostraria a consequência de um número que não está mais
  // na caixa — a prévia mentindo sobre o que ela mesma prevê.
  it("resposta fora de ordem: a prévia do número abandonado não pinta", async () => {
    const soltar = new Map<number, (r: Response) => void>();
    comRotas((valor) => new Promise<Response>((ok) => soltar.set(valor, ok)));
    render(<FichaInteira ficha={FICHA} />);

    // Uma PAUSA entre os dois: sem ela a espera do dedo junta os dois numa
    // pergunta só, e não haveria duas respostas pra chegarem fora de ordem.
    digitar(LIMIAR, "1");
    await waitFor(() => expect(soltar.size).toBe(1));
    digitar(LIMIAR, "12");
    await waitFor(() => expect(soltar.size).toBe(2));

    // a do 12 chega primeiro, a do 1 depois
    soltar.get(12)!(Response.json({ estado: "frio", marca: MARCA_DA_ROTA, sub: SUB_DA_ROTA }));
    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
    soltar.get(1)!(Response.json({ estado: "fresco", marca: "FALA VELHA", sub: "sub velha" }));

    await waitFor(() => expect(previsaoDe(LIMIAR).textContent).toContain(MARCA_DA_ROTA));
    expect(previsaoDe(LIMIAR).textContent, "a prévia de um número abandonado pintou").not.toContain(
      "FALA VELHA",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("A PRIMEIRA camada: o número que mente é recusado antes de qualquer viagem", () => {
  for (const [nome, texto] of [
    ["zero", "0"],
    ["negativo", "-5"],
    ["zero fracionário", "0.0"],
  ] as const) {
    // ⚠️ No LIMIAR, e não mais no passado: desde 2026-10-01 a janela do passado
    // zero vale (decisão do João, simétrica à da previsão).
    it(`${nome}: recusado na tela, e NENHUMA das duas rotas é chamada`, () => {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);

      digitar(LIMIAR, texto);
      salvar(LIMIAR);

      // 🔴 AS DUAS ROTAS, nomeadas: é isto que prova que a recusa é DAQUI e não da
      // rota. Um teste que só visse "não gravou" não saberia quem recusou.
      expect(chamadas(fetchFalso, ROTA_FICHA), "o número que mente foi mandado pra porta").toHaveLength(0);
      expect(chamadas(fetchFalso, ROTA_PREVISAO), "pediu prévia de uma regra que mente").toHaveLength(0);
      // E a FRASE, não só o `role=alert`: sem isto, qualquer recusa passa verde.
      expect(emCampo(LIMIAR).getByRole("alert").textContent).toBe(REGRA_QUE_MENTE);
      expect(emCampo(LIMIAR).getByRole("alert").textContent).not.toBe(CAIXA_VAZIA);
    });
  }

  // ⚠️ O NEGATIVO é recusado nos três; o ZERO, só no limiar (decisões do João,
  // 2026-10-01: cada janela vale zero sozinha). E cada janela negativa tem frase
  // própria: `REGRA_QUE_MENTE` fala de zero, e zero ali vale.
  it("nos três campos, não só num — cada um com a SUA frase", () => {
    const esperada: Record<string, string> = {
      [PREVISAO]: JANELA_NEGATIVA,
      [PASSADO]: JANELA_PASSADO_NEGATIVA,
      [LIMIAR]: REGRA_QUE_MENTE,
    };
    expect(Object.keys(esperada).sort(), "o registro ganhou ou perdeu um número").toEqual([...NUMEROS].sort());
    for (const caminho of NUMEROS) {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);
      digitar(caminho, "-5");
      salvar(caminho);
      expect(fetchFalso, `${caminho} mandou um negativo pra alguma rota`).not.toHaveBeenCalled();
      expect(emCampo(caminho).getByRole("alert").textContent, caminho).toBe(esperada[caminho]);
      cleanup();
    }
  });

  // 🔴 `REGRA_QUE_MENTE` SÓ SOBROU PRO LIMIAR, e a frase tem de ser verdade
  // sobre ele — MEDIDA no motor, não suposta. Ela dizia "…para sempre, ou nunca
  // avisa"; o "nunca avisa" era a medição da janela do passado negativa. Com o
  // limiar zero ou negativo o lugar SÓ diz não, mesmo sem chuva nenhuma.
  it("a frase do limiar é verdade no motor: zero ou menos só diz não", () => {
    for (const limiar_mm of [0, -1]) {
      const regra = { tipo: "chuva_binaria" as const, janela_previsao_horas: 6, janela_passado_horas: 6, limiar_mm };
      expect(avaliar(regra, [], 1_000_000), `limiar ${limiar_mm} sem chuva`).toBe("frio");
    }
    expect(REGRA_QUE_MENTE).toContain("dizer não para sempre");
    expect(REGRA_QUE_MENTE, "a metade que só valia pra janela negativa voltou").not.toContain("nunca avisa");
  });

  it("zero só no limiar: recusado com `REGRA_QUE_MENTE`", () => {
    for (const caminho of [LIMIAR]) {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);
      digitar(caminho, "0");
      salvar(caminho);
      expect(fetchFalso, `${caminho} mandou um zero pra alguma rota`).not.toHaveBeenCalled();
      expect(emCampo(caminho).getByRole("alert").textContent).toBe(REGRA_QUE_MENTE);
      cleanup();
    }
  });

  for (const [nome, texto] of [
    ["vazia", ""],
    ["só espaços", "   "],
    // ⚠️ MEDIDO EM JSDOM: um `<input type="number">` com texto solto. Qualquer que
    // seja o valor que o controle entregue, o editor cai no mesmo ramo de "não há
    // número" — é por isso que não existe uma conferência de formato aqui.
    ["texto solto", "abc"],
  ] as const) {
    it(`caixa ${nome}: recusada com a frase de caixa vazia, e rota nenhuma é chamada`, () => {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);

      digitar(LIMIAR, texto);
      salvar(LIMIAR);

      expect(fetchFalso).not.toHaveBeenCalled();
      expect(emCampo(LIMIAR).getByRole("alert").textContent).toBe(CAIXA_VAZIA);
      expect(emCampo(LIMIAR).getByRole("alert").textContent).not.toBe(REGRA_QUE_MENTE);
    });
  }

  // 🔴 A DIREÇÃO QUE IMPORTA MAIS: o que a tela NÃO pode recusar. Fracionário é
  // número que um dono pode querer de verdade (o limiar do acervo É `0.2`), e
  // recusá-lo trancaria a gravação de uma verdade. Este caso fica vermelho no dia
  // em que alguém puser "só inteiro" nesta tela.
  for (const [caminho, texto] of [
    [LIMIAR, "0.2"],
    [LIMIAR, "0.05"],
    [PASSADO, "2.5"],
    [PASSADO, "240"],
  ] as const) {
    it(`${caminho} = ${texto} NÃO é recusado, e vai pra porta como NÚMERO`, async () => {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);

      digitar(caminho, texto);
      salvar(caminho);

      await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
      expect(emCampo(caminho).queryByRole("alert"), "a tela recusou um valor legítimo").toBeNull();
      const corpo = corpoDe(chamadas(fetchFalso, ROTA_FICHA)[0]);
      expect(corpo).toEqual({ slug: FICHA.slug, campo: caminho, valor: Number(texto) });
      // 🔴 NÚMERO, NUNCA STRING: `aplicarCampo` confere o campo contra o
      // `fichaSchema`, e `"0.2"` é 400 com corpo vazio na mão dele.
      expect(typeof corpo.valor, "o número foi pra porta como texto").toBe("number");
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe("A gravação, e o que ele digitou não some em recusa nenhuma", () => {
  it("grava no caminho do campo e a tela vem da fonte nova", async () => {
    const { fetchFalso, reloadFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PASSADO, "12");
    salvar(PASSADO);

    await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
    const [url, init] = chamadas(fetchFalso, ROTA_FICHA)[0];
    expect(url).toBe(ROTA_FICHA);
    expect(init.method).toBe("PUT");
    expect(corpoDe(chamadas(fetchFalso, ROTA_FICHA)[0])).toEqual({
      slug: FICHA.slug,
      campo: PASSADO,
      valor: 12,
    });
    await waitFor(() => expect(reloadFalso).toHaveBeenCalledTimes(1));
  });

  // 🔴 A frase da porta é o CORPO da resposta, e o que ele digitou continua na
  // caixa. Perder no celular, por um sinal ruim, o número que acabou de escrever
  // é o defeito que faz alguém parar de usar o painel.
  for (const [nome, resposta, esperada] of [
    ["409 da coerência", new Response("A regra de chuva daqui olha 0 hora pra trás.", { status: 409 }), "A regra de chuva daqui olha 0 hora pra trás."],
    ["400 de corpo vazio", new Response("", { status: 400 }), ERRO_GRAVAR],
  ] as const) {
    it(`${nome}: a tela mostra a frase e o número digitado fica na caixa`, async () => {
      const fetchFalso = vi.fn((url: string) =>
        url === ROTA_FICHA
          ? Promise.resolve(resposta.clone())
          : Promise.resolve(Response.json({ estado: "frio", marca: MARCA_DA_ROTA, sub: SUB_DA_ROTA })),
      );
      vi.stubGlobal("fetch", fetchFalso);
      vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
      render(<FichaInteira ficha={FICHA} />);

      digitar(PASSADO, "12");
      salvar(PASSADO);

      await waitFor(() => expect(emCampo(PASSADO).getByRole("alert").textContent).toBe(esperada));
      expect(caixa(PASSADO).value, "o número que ele digitou sumiu na recusa").toBe("12");
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe("O editor de número serve os três lugares", () => {
  // 🔴 Irmão do caso do cerco em `admin-editores-de-campo.test.tsx`, apontado pro
  // editor novo: o que a tela escreve ao lado de um número é a FORMA do dado, e a
  // forma é igual em qualquer lugar do mundo. O que varia é o número, que vem da
  // prop.
  it("rótulo, botão e região de prévia de um mesmo número são iguais nas três fichas", () => {
    const porFicha = ACERVO.map((f) => {
      const { unmount } = render(<FichaInteira ficha={f} />);
      const mapa = NUMEROS.map((caminho) => {
        const el = bloco(caminho);
        const botoes = [...el.querySelectorAll("button")].map((b) => b.textContent).join("|");
        const rotulos = [...el.querySelectorAll("[aria-label]")]
          .map((x) => x.getAttribute("aria-label"))
          .join("|");
        return `${caminho}//${botoes}//${rotulos}//${previsaoDe(caminho).textContent}`;
      });
      unmount();
      return mapa;
    });
    expect(porFicha).toHaveLength(ACERVO.length);
    expect(porFicha[0].length, "nenhum número foi lido: o caso ficaria oco").toBe(3);
    for (const outra of porFicha.slice(1)) {
      expect(outra, "o texto em volta de um número muda de lugar pra lugar").toEqual(porFicha[0]);
    }
  });

  it("a caixa de cada ficha traz o número DELA, e a de nenhuma outra", () => {
    for (const f of ACERVO) {
      const { unmount } = render(<FichaInteira ficha={f} />);
      for (const c of camposDaFicha(f).filter((x) => x.especie === "numero")) {
        const atual = c.caminho.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], f);
        expect(caixa(c.caminho).value, `${f.slug}/${c.caminho} abriu com número de outra ficha`).toBe(
          String(atual),
        );
      }
      unmount();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("A espera do dedo — uma pergunta por PAUSA, não por tecla (onda de conserto 1)", () => {
  // 🔴 A PRÉVIA BUSCA CHUVA AO VIVO NO PROVEDOR EXTERNO, e o `onChange` do React
  // dispara a cada tecla. Digitar `240` não pode virar três buscas — duas delas
  // de números que ele nunca quis. O relógio falso mede a espera nos dois lados:
  // nada antes dela, UMA pergunta (a do último número) depois.
  it("digitar `2`, `24`, `240` depressa faz UMA pergunta só, com o último número, e só depois da espera", () => {
    vi.useFakeTimers();
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PASSADO, "2");
    digitar(PASSADO, "24");
    digitar(PASSADO, "240");
    act(() => {
      vi.advanceTimersByTime(ESPERA_PREVIA_MS - 1);
    });
    expect(chamadas(fetchFalso, ROTA_PREVISAO), "perguntou antes de o dedo parar").toHaveLength(0);
    // E enquanto espera, a tela já diz que está conferindo.
    expect(previsaoDe(PASSADO).textContent).toBe(PREVENDO);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(chamadas(fetchFalso, ROTA_PREVISAO), "uma pergunta por tecla").toHaveLength(1);
    expect(corpoDe(chamadas(fetchFalso, ROTA_PREVISAO)[0]).valor).toBe(240);
  });

  it("a espera é de pelo menos 400 ms", () => {
    expect(ESPERA_PREVIA_MS).toBeGreaterThanOrEqual(400);
  });

  // Voltar ao número gravado no meio da espera CANCELA a pergunta pendente.
  it("voltar ao número gravado durante a espera cancela a pergunta", () => {
    vi.useFakeTimers();
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(LIMIAR, "9");
    digitar(LIMIAR, String(FICHA.condicao.regra.limiar_mm));
    act(() => {
      vi.advanceTimersByTime(ESPERA_PREVIA_MS * 3);
    });

    expect(chamadas(fetchFalso, ROTA_PREVISAO), "a pergunta abandonada saiu mesmo assim").toHaveLength(0);
    expect(previsaoDe(LIMIAR).textContent).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Previsão ZERO vale — decisão do João, 2026-10-01 (\"só olhar a chuva que já caiu\")", () => {
  it("previsão 0 NÃO é recusada: vai pra porta como número 0", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PREVISAO, "0");
    salvar(PREVISAO);

    await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
    expect(emCampo(PREVISAO).queryByRole("alert"), "a tela recusou a previsão zero").toBeNull();
    expect(corpoDe(chamadas(fetchFalso, ROTA_FICHA)[0])).toEqual({ slug: FICHA.slug, campo: PREVISAO, valor: 0 });
  });

  it("previsão 0 PEDE prévia — a consequência dela existe e é mostrada", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PREVISAO, "0");

    await waitFor(() => expect(previsaoDe(PREVISAO).textContent).toContain(MARCA_DA_ROTA));
    expect(corpoDe(chamadas(fetchFalso, ROTA_PREVISAO)[0]).valor).toBe(0);
  });

  it("`REGRA_QUE_MENTE` nunca aparece pra previsão zero", () => {
    comRotas();
    render(<FichaInteira ficha={FICHA} />);
    digitar(PREVISAO, "0");
    salvar(PREVISAO);
    expect(bloco(PREVISAO).textContent).not.toContain(REGRA_QUE_MENTE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Passado ZERO vale — decisão do João, 2026-10-01 (simétrica à da previsão)", () => {
  it("passado 0 NÃO é recusado: vai pra porta como número 0", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PASSADO, "0");
    salvar(PASSADO);

    await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
    expect(emCampo(PASSADO).queryByRole("alert"), "a tela recusou o passado zero").toBeNull();
    expect(corpoDe(chamadas(fetchFalso, ROTA_FICHA)[0])).toEqual({ slug: FICHA.slug, campo: PASSADO, valor: 0 });
  });

  it("passado 0 PEDE prévia — a consequência dela existe e é mostrada", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);

    digitar(PASSADO, "0");

    await waitFor(() => expect(previsaoDe(PASSADO).textContent).toContain(MARCA_DA_ROTA));
    expect(corpoDe(chamadas(fetchFalso, ROTA_PREVISAO)[0]).valor).toBe(0);
  });

  // 🔴 O BRIEF DA ONDA 2: `REGRA_QUE_MENTE` não pode aparecer pro passado zero.
  it("`REGRA_QUE_MENTE` nunca aparece pro passado zero", () => {
    comRotas();
    render(<FichaInteira ficha={FICHA} />);
    digitar(PASSADO, "0");
    salvar(PASSADO);
    expect(bloco(PASSADO).textContent).not.toContain(REGRA_QUE_MENTE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("O teto do provedor (F2): recusado na tela, antes de qualquer viagem", () => {
  // 🔴 A FRASE CARREGA OS DOIS NÚMEROS, e eles são os de `src/lib/weather.ts`.
  // Ela é literal (o cerco de completude só lê literal simples); este caso é o
  // que a amarra às constantes.
  it("a frase do teto diz os dois tetos de `weather.ts`", () => {
    expect(ALEM_DO_PROVEDOR).toContain(`${TETO_PREVISAO_HORAS} horas pra frente`);
    expect(ALEM_DO_PROVEDOR).toContain(`${TETO_PASSADO_HORAS} pra trás`);
  });

  // 🔴 n3 da re-revisão (onda de conserto 2): a frase afirmava que a tela
  // inicial ficava sem informação "pra todos os lugares" — falso pra lugar
  // OCULTO, que a home não lê. Saiu por subtração; este caso não a deixa voltar.
  it("a frase do teto não afirma o que não vale pra lugar oculto", () => {
    expect(ALEM_DO_PROVEDOR).not.toContain("todos os lugares");
    expect(ALEM_DO_PROVEDOR).not.toContain("tela inicial");
  });

  for (const [caminho, texto] of [
    [PREVISAO, String(TETO_PREVISAO_HORAS + 1)],
    [PREVISAO, "480"],
    [PASSADO, String(TETO_PASSADO_HORAS + 1)],
  ] as const) {
    it(`${caminho} = ${texto}: recusado com a frase do teto, e NENHUMA rota é chamada`, async () => {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);

      digitar(caminho, texto);
      salvar(caminho);
      await pausa();

      expect(fetchFalso, "um número acima do teto saiu pra alguma rota").not.toHaveBeenCalled();
      expect(emCampo(caminho).getByRole("alert").textContent).toBe(ALEM_DO_PROVEDOR);
    });
  }

  for (const [caminho, texto] of [
    [PREVISAO, String(TETO_PREVISAO_HORAS)],
    [PASSADO, String(TETO_PASSADO_HORAS)],
  ] as const) {
    it(`${caminho} = ${texto} (o teto exato) NÃO é recusado`, async () => {
      const { fetchFalso } = comRotas();
      render(<FichaInteira ficha={FICHA} />);

      digitar(caminho, texto);
      salvar(caminho);

      await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
      expect(emCampo(caminho).queryByRole("alert")).toBeNull();
    });
  }

  // O limiar não tem teto nesta onda (o limiar enorme é decisão de produto que
  // ficou de fora): um limiar alto passa.
  it("o limiar NÃO tem teto: 3000 vai pra porta", async () => {
    const { fetchFalso } = comRotas();
    render(<FichaInteira ficha={FICHA} />);
    digitar(LIMIAR, "3000");
    salvar(LIMIAR);
    await waitFor(() => expect(chamadas(fetchFalso, ROTA_FICHA)).toHaveLength(1));
  });
});
