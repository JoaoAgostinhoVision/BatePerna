import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
const ROTULO = "Distância daqui";

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
  return <FaixaKm rotulo={ROTULO} valor={v} max={max} passo={passo} onChange={setV} />;
}

const monta = (props: { inicial?: number | null; max?: number; passo?: number } = {}) => {
  visto = undefined;
  render(<Palco {...props} />);
};

// 🔴 TUDO é procurado DENTRO do grupo, e o grupo é achado pelo nome que sai da
// `<legend>` — as duas coisas são prova, não conveniência (achado I-4 da
// revisão):
//   • um `getByRole("slider")` solto passa verde com a barra, o campo e a
//     leitura FORA do `<fieldset>` — e a Task 5 esconde o grupo de Distância
//     quando não há localização: com os controles fora, esconder o grupo
//     esconderia só a legenda.
//   • o nome ancorado (`^…$`) obriga a legenda a existir e a ser o título. Um
//     `aria-label` no `<fieldset>` daria o mesmo nome sem título nenhum na
//     tela, e foi assim que a versão anterior deste arquivo ficou verde com a
//     legenda apagada.
const grupo = () => screen.getByRole("group", { name: new RegExp(`^${ROTULO}$`, "i") });
const barra = () => within(grupo()).getByRole("slider") as HTMLInputElement;
const campo = () => within(grupo()).getByRole("spinbutton") as HTMLInputElement;
const leituraNaTela = (txt: string) => within(grupo()).getByText(txt);

describe("a anatomia que a Task 5 vai consumir", () => {
  it("a legenda é o título do grupo, e a barra, o campo e a leitura moram DENTRO dele", () => {
    monta();
    const g = grupo();
    expect(within(g).getByRole("slider")).toBeTruthy();
    expect(within(g).getByRole("spinbutton")).toBeTruthy();
    expect(within(g).getByText("qualquer")).toBeTruthy();
    // O nome do grupo tem que sair da legenda — o título que se VÊ — e não de
    // um atributo. Segunda fonte pro mesmo nome mascara o sumiço da primeira.
    expect(g.querySelector("legend")?.textContent).toBe(ROTULO);
    expect(g.getAttribute("aria-label")).toBeNull();
  });

  // É ele que decide qual teclado o iPhone abre. Sem ele vem o teclado de
  // texto inteiro, com letras, pra um campo que só aceita número.
  it("o campo pede o teclado numérico do aparelho", () => {
    monta();
    expect(campo().getAttribute("inputmode")).toBe("numeric");
  });
});

describe("a barra", () => {
  // O `step` aqui é DESENHO (sem ele a barra fica granular de 1 km e sobram
  // ~4px de zona morta acima do teto), não honestidade: nenhum valor acima do
  // `max` escapa com ou sem ele, porque o componente converte antes de subir.
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
    expect(leituraNaTela("qualquer")).toBeTruthy();
  });

  // 🔴 A FRONTEIRA DE CIMA, e ela é a única onde `>` e `>=` se separam (achado
  // I-1). Com `n >= max`, arrastar até o último km REAL desliga o recorte na
  // cara de quem acabou de escolhê-lo — e na faixa de tamanho, onde o teto é
  // 20, o topo inteiro do controle fica inalcançável.
  it("arrastar até a última parada de km REAL devolve o número, não null", () => {
    monta();
    fireEvent.change(barra(), { target: { value: String(MAX) } });
    expect(visto).toBe(MAX);
    expect(leituraNaTela(`até ${MAX} km`)).toBeTruthy();
  });

  it("arrastar pra dentro do intervalo devolve o número", () => {
    monta();
    fireEvent.change(barra(), { target: { value: "40" } });
    expect(visto).toBe(40);
  });

  it("com valor null, a barra fica na última parada e o texto diz 'qualquer'", () => {
    monta();
    expect(barra().value).toBe(String(QUALQUER));
    expect(leituraNaTela("qualquer")).toBeTruthy();
    // Quem ouve a tela ouviria o número da parada extra — um km A MAIS que o
    // teto — na posição que quer dizer justamente "não corto nada".
    expect(barra().getAttribute("aria-valuetext")).toBe("qualquer");
  });

  it("com corte ligado, o texto de leitura diz até quanto", () => {
    monta({ inicial: 40 });
    expect(leituraNaTela("até 40 km")).toBeTruthy();
    expect(barra().getAttribute("aria-valuetext")).toBe("até 40 km");
  });

  // Um `Math.round(v / passo) * passo` na posição deixaria a barra em 5 e o
  // campo em 7 — dois números pra uma verdade só.
  //
  // ⚠️ O valor é 7, e não o `4` que o plano pedia, porque com `4` as duas
  // versões COINCIDEM e a prova seria oca: MEDIDO no jsdom, `min="5"` prende
  // o `4` em `"5"` sozinho, com ou sem arredondamento nosso — e o navegador
  // faz o mesmo. Abaixo do passo quem manda é o `min` da barra; fora do passo,
  // e é só aí, dá pra separar as versões. (O custo aceito está escrito na
  // emenda 2, item 6, do plano desta rodada.)
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

  // 🔴 A FRONTEIRA DE BAIXO, e ela é a única onde `< 1` e `<= 1` se separam
  // (achado I-2). Com `<= 1`, digitar `1` esvazia o campo — e como o campo
  // mostra a prop, TODO número que começa por 1 (`1`, `10`, `15`, `100`) fica
  // inalcançável pelo teclado. É o "campo indigitável" da emenda 1 de volta,
  // com um `=` de diferença. O `1` é o piso que o `lerFiltros` aceita.
  it("digitar 1 devolve 1 — é o piso do intervalo, e o lerFiltros o aceita", () => {
    monta();
    fireEvent.change(campo(), { target: { value: "1" } });
    expect(visto).toBe(1);
    expect(campo().value).toBe("1");
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
    expect(leituraNaTela("qualquer")).toBeTruthy();
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

  // Os 44px acima são a CAIXA; o que o dedo agarra é o pegador. Enquanto o
  // controle tem aparência nativa o `::-webkit-slider-thumb` não pinta, então
  // as duas declarações de `-webkit-appearance: none` e o tamanho do pegador
  // são uma corrente só — e o trilho tem 4px.
  it("o pegador é desenhável e tem 28px no Safari", () => {
    expect(valorDe(regra(".bp .faixa-arrasto"), "-webkit-appearance")).toBe("none");
    const pegador = regra(".bp .faixa-arrasto::-webkit-slider-thumb");
    expect(valorDe(pegador, "-webkit-appearance")).toBe("none");
    expect(valorDe(pegador, "width")).toBe("28px");
    expect(valorDe(pegador, "height")).toBe("28px");
  });
});
