import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FaixaKm from "@/app/FaixaKm";
import { regraDe, semComentarios, valorDe } from "../css";

afterEach(cleanup);

// Os números do palco são DELE, não do app: este componente não conhece as
// constantes de `src/lib/filtros.ts` (quem as passa é o painel, na Task 5).
// Por isso as asserções daqui são de RELAÇÃO — `max + passo`, e não `105`. Os
// literais estão presos em tests/lib/filtros.test.ts.
const MAX = 100;
const PASSO = 5;
const QUALQUER = MAX + PASSO;

// 🔴 O PALCO CONTROLADO, e ele é o que torna as provas possíveis.
//
// Com um espião pelado no `onChange`, a prop `valor` nunca mudaria e o campo
// nunca poderia "passar a mostrar 100" — num componente sem estado local o
// `value` sai da prop. O teste estaria EXIGINDO o estado local que a prova de
// mutação proíbe. Com o palco devolvendo o valor, "mexer na barra atualiza o
// campo" volta a morder: com estado local no campo, ele não se mexeria.
let visto: number | null | undefined;

function Palco({
  inicial = null,
  max = MAX,
  passo = PASSO,
}: {
  inicial?: number | null;
  max?: number;
  passo?: number;
}) {
  const [v, setV] = useState<number | null>(inicial);
  visto = v;
  return <FaixaKm rotulo="Distância daqui" valor={v} max={max} passo={passo} onChange={setV} />;
}

const monta = (props: { inicial?: number | null; max?: number; passo?: number } = {}) => {
  visto = undefined;
  render(<Palco {...props} />);
};

// Por ROLE, que já distingue os dois sem discussão de rótulo.
const barra = () => screen.getByRole("slider") as HTMLInputElement;
const campo = () => screen.getByRole("spinbutton") as HTMLInputElement;

describe("a anatomia que a Task 5 vai consumir", () => {
  it("o rótulo vira a legenda do grupo, com a barra e o campo dentro", () => {
    monta();
    expect(screen.getByRole("group", { name: /distância daqui/i })).toBeTruthy();
    expect(barra()).toBeTruthy();
    expect(campo()).toBeTruthy();
  });
});

describe("a barra", () => {
  // Sem `step`, a barra cai no padrão 1 e passa a oferecer 101…104 — valores
  // que o `lerFiltros` (`v <= max`) joga fora na abertura seguinte: o filtro
  // se desligando sozinho entre duas aberturas do app.
  it("a barra vai de passo até max+passo, de passo em passo", () => {
    monta();
    expect(barra().getAttribute("min")).toBe(String(PASSO));
    expect(barra().getAttribute("max")).toBe(String(MAX + PASSO));
    expect(barra().getAttribute("step")).toBe(String(PASSO));
  });

  it("arrastar até a última parada devolve null, não o máximo", () => {
    monta({ inicial: 40 });
    fireEvent.change(barra(), { target: { value: String(QUALQUER) } });
    // `toBeNull`, e não um número: a última parada é um ESTADO. Se a barra
    // parasse em `max`, o jsdom prenderia o 105 em 100 e o que subiria aqui
    // seria 100 — "qualquer" na tela cortando em 100 de verdade.
    expect(visto).toBeNull();
    expect(campo().value).toBe("");
    expect(screen.getByText("qualquer")).toBeTruthy();
  });

  it("arrastar pra dentro do intervalo devolve o número", () => {
    monta();
    fireEvent.change(barra(), { target: { value: "40" } });
    expect(visto).toBe(40);
  });

  it("com valor null, a barra fica na última parada e o texto diz 'qualquer'", () => {
    monta();
    expect(barra().value).toBe(String(QUALQUER));
    expect(screen.getByText("qualquer")).toBeTruthy();
  });

  it("com corte ligado, o texto de leitura diz até quanto", () => {
    monta({ inicial: 40 });
    expect(screen.getByText("até 40 km")).toBeTruthy();
  });

  // Um `Math.round(v / passo) * passo` na posição deixaria a barra em 5 e o
  // campo em 7 — dois números pra uma verdade só.
  //
  // ⚠️ O valor é 7, e não o `4` que o plano pedia, porque com `4` as duas
  // versões COINCIDEM e a prova seria oca: MEDIDO no jsdom, `min="5"` prende
  // o `4` em `"5"` sozinho, com ou sem arredondamento nosso — e o navegador
  // faz o mesmo. Abaixo do passo quem manda é o `min` da barra; fora do passo,
  // e é só aí, dá pra separar as versões.
  it("com valor 7 — fora do passo — a barra mostra 7 e o campo mostra 7", () => {
    monta({ inicial: 7 });
    expect(barra().value).toBe("7");
    expect(campo().value).toBe("7");
  });
});

describe("o campo", () => {
  it("digitar 45 devolve 45", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "45" } });
    expect(visto).toBe(45);
    expect(campo().value).toBe("45");
  });

  // O teto prende NA HORA, e a segunda asserção é a que importa: prender o
  // valor e deixar o campo mostrando o que a pessoa digitou é a tela mentindo
  // sobre o que está escondendo.
  it("digitar 150 devolve 100 E o campo passa a MOSTRAR 100", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "150" } });
    expect(visto).toBe(MAX);
    expect(campo().value).toBe(String(MAX));
  });

  it("digitar 4 devolve 4 — abaixo do passo da barra, e isso é válido", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "4" } });
    expect(visto).toBe(4);
    expect(campo().value).toBe("4");
  });

  // Vazio e zero querem dizer a mesma coisa ("não corta"), e o `lerFiltros`
  // recusa `0`: das duas saídas possíveis, só esta mantém tela e armazém
  // dizendo o mesmo.
  it("digitar 0 devolve null e o campo fica vazio", () => {
    monta({ inicial: 40 });
    fireEvent.change(campo(), { target: { value: "0" } });
    expect(visto).toBeNull();
    expect(campo().value).toBe("");
  });

  it("digitar número negativo devolve null", () => {
    monta({ inicial: 40 });
    fireEvent.change(campo(), { target: { value: "-3" } });
    expect(visto).toBeNull();
  });

  it("apagar o campo devolve null", () => {
    monta({ inicial: 40 });
    fireEvent.change(campo(), { target: { value: "" } });
    expect(visto).toBeNull();
    expect(screen.getByText("qualquer")).toBeTruthy();
  });

  // `type="number"` aceita ponto no teclado grande, e o `lerFiltros` só guarda
  // inteiro: sem truncar, o filtro voltaria `null` na abertura seguinte.
  it("digitar 4.5 devolve 4 — o guardado é inteiro, e o campo mostra 4", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "4.5" } });
    expect(visto).toBe(4);
    expect(campo().value).toBe("4");
  });

  // 🔴 O segundo evento é montado a partir do que o campo está MOSTRANDO.
  // Cravar `"45"` faria este teste passar TAMBÉM na versão que prende o `4` em
  // `5` no primeiro dígito — a string certa sobrescreveria o pulo.
  it("dá pra digitar 45 dígito a dígito: 4 depois 5, sem o campo pular", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "4" } });
    fireEvent.change(campo(), { target: { value: campo().value + "5" } });
    expect(campo().value).toBe("45");
    expect(visto).toBe(45);
  });
});

describe("um valor só: a barra e o campo mostram a mesma verdade", () => {
  it("mudar a barra atualiza o campo", () => {
    monta();
    fireEvent.change(barra(), { target: { value: "40" } });
    expect(campo().value).toBe("40");
  });

  it("mudar o campo atualiza a barra", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "40" } });
    expect(barra().value).toBe("40");
  });
});

// ——————— o que o jsdom não vê ———————
//
// Nenhum teste desta suíte mede geometria renderizada: o que se lê aqui é o
// alvo DECLARADO, e arrastar com o polegar continua sendo pergunta de iPhone.
describe("o CSS da faixa", () => {
  const regra = (seletor: string) => {
    const r = regraDe(semComentarios("home.css"), seletor);
    expect(r, `faltou a regra ${seletor} no home.css`).not.toBeNull();
    return r![0];
  };

  // Pelo `valorDe`, nunca por `toContain`: `font-size: 16px` casa dentro de
  // `--font-size: 16px; font-size: 13px`, e abaixo de 16px o Safari do iPhone
  // dá zoom sozinho ao focar o campo e a tela salta.
  it("o campo tem font-size 16px — abaixo disso o Safari dá zoom ao focar", () => {
    expect(valorDe(regra(".bp .faixa-campo"), "font-size")).toBe("16px");
  });

  it("a barra e o campo têm 44px de alvo de toque", () => {
    expect(valorDe(regra(".bp .faixa-arrasto"), "min-height")).toBe("44px");
    expect(valorDe(regra(".bp .faixa-campo"), "min-height")).toBe("44px");
  });
});
