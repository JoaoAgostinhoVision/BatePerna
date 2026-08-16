import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import PainelFiltros from "@/app/PainelFiltros";
import FiltrosVivos, { useFiltros, useMexerFiltros } from "@/app/filtros";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO, type Filtros } from "@/lib/filtros";
import { CHAVE_LOCAL } from "@/lib/local";

afterEach(() => { cleanup(); localStorage.clear(); });

const monta = (visiveis = 4) =>
  render(<LocalVivo><FiltrosVivos><PainelFiltros visiveis={visiveis} /></FiltrosVivos></LocalVivo>);

describe("a linha de resumo", () => {
  it("diz quantas trilhas estão APARECENDO", () => {
    monta(4);
    expect(screen.getByText(/4 trilhas/)).toBeTruthy();
  });

  it("no singular quando é uma só", () => {
    monta(1);
    expect(screen.getByText(/1 trilha\b/)).toBeTruthy();
  });

  it("sem filtro ligado, não fala de filtro", () => {
    monta();
    expect(screen.queryByText(/filtro ligado/)).toBeNull();
  });

  it("com filtros ligados, diz quantos", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true, soGratis: true }));
    monta();
    expect(await screen.findByText(/2 filtros ligados/)).toBeTruthy();
  });

  // ——— pré-voo: o singular do FILTRO, irmão do singular da trilha logo acima.
  // O `\b` do teste de "1 trilha" é load-bearing (sem ele, "1 trilhas" casaria
  // e o ternário poderia sumir); o plural dos filtros não tinha o par.
  it("um filtro só também fala no singular", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    monta();
    expect(await screen.findByText(/1 filtro ligado\b/)).toBeTruthy();
  });
});

describe("o painel", () => {
  it("nasce fechado", () => {
    monta();
    expect(screen.queryByRole("group", { name: /esforço/i })).toBeNull();
  });

  it("abre no toque e fecha no toque de novo", async () => {
    monta();
    const b = screen.getByRole("button", { name: /filtrar/i });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { b.click(); });
    expect(screen.getByRole("group", { name: /esforço/i })).toBeTruthy();
    // O `aria-expanded` é o ÚNICO sinal que quem usa leitor de tela recebe de
    // que aquele toque abriu alguma coisa — a sanfona é puramente visual.
    // Apagá-lo não derruba nenhuma outra asserção deste arquivo.
    expect(b.getAttribute("aria-expanded")).toBe("true");
    await act(async () => { b.click(); });
    expect(screen.queryByRole("group", { name: /esforço/i })).toBeNull();
  });

  // Filtro que não tem como filtrar não entra na tela.
  it("sem localização, o recorte de distância não aparece", async () => {
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    expect(screen.queryByRole("group", { name: /distância/i })).toBeNull();
  });

  it("com localização, o recorte de distância aparece", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    expect(await screen.findByRole("group", { name: /distância/i })).toBeTruthy();
  });

  it("ligar um recorte grava no aparelho", async () => {
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    const leve = screen.getByRole("button", { name: /^leve$/i });
    await act(async () => { leve.click(); });
    expect(localStorage.getItem(CHAVE_FILTROS)).toContain("leve");
    // O `aria-pressed` é o estado do chip. Sem ele o chip só muda de cor, e
    // quem não vê cor não sabe o que está ligado.
    expect(leve.getAttribute("aria-pressed")).toBe("true");
  });

  // ——— pré-voo: ligar um recorte não pode DESLIGAR os outros.
  //
  // O `trocar` espalha `{...filtros, ...p}`. Trocado por `{...SEM_FILTRO, ...p}`
  // — que é como alguém escreveria "reinicia e aplica" — nenhum teste acima
  // cai, porque todos ligam um recorte só. Na tela: a pessoa liga "só grátis",
  // depois toca "leve", e o "só grátis" se apaga sozinho enquanto ela olha.
  it("ligar um recorte preserva os que já estavam ligados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    await act(async () => { screen.getByRole("button", { name: /^leve$/i }).click(); });
    const guardado = JSON.parse(localStorage.getItem(CHAVE_FILTROS)!);
    expect(guardado).toMatchObject({ soGratis: true, esforco: "leve" });
  });

  // ——— pré-voo: o segundo toque no chip de esforço é o ÚNICO jeito de
  // desligar aquele recorte.
  //
  // Distância e duração têm chip "qualquer"; **esforço não tem**. Se o
  // `filtros.esforco === e ? null : e` virar só `e`, a pessoa que tocou "leve"
  // por engano fica presa nele — e nenhum outro teste percebe, porque nenhum
  // toca duas vezes no mesmo chip. É o mesmo raciocínio do "fecha no toque de
  // novo" da pílula de busca, que já mordeu nesta rodada.
  it("tocar o mesmo esforço de novo desliga — é a única saída dele", async () => {
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    const leve = screen.getByRole("button", { name: /^leve$/i });
    await act(async () => { leve.click(); });
    await act(async () => { leve.click(); });
    expect(leve.getAttribute("aria-pressed")).toBe("false");
    expect(JSON.parse(localStorage.getItem(CHAVE_FILTROS)!).esforco).toBeNull();
  });

  // Mesma regra da localização: o HTML do servidor não tem filtro nenhum.
  it("o PRIMEIRO render ignora o que está guardado", () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    let primeiro = "";
    function Espia() {
      const f = useFiltros();
      primeiro ||= String(f.daHoje);
      return null;
    }
    render(<FiltrosVivos><Espia /></FiltrosVivos>);
    expect(primeiro).toBe("false");
  });
});

// ——————— pré-voo: o que o jsdom NÃO enxerga ———————
//
// Estes testes são feios e são os que separam "passou" de "funciona no
// celular". Ver a lição 5 do docs/RESUME.md: apagar o `"use client"` do
// MapaHome deixou 26 de 27 testes verdes e o mapa parado no aparelho.
describe("o que o jsdom não vê", () => {
  const fonte = (arq: string) =>
    readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8");

  // Sem a diretiva, `useState`/`onClick`/`localStorage` não existem em
  // produção: o painel nasce fechado e nunca abre. O jsdom renderiza tudo
  // como cliente e não acusa nada.
  it("PainelFiltros é client component", () => {
    expect(fonte("PainelFiltros.tsx").trimStart().startsWith('"use client"')).toBe(true);
  });
  it("filtros.tsx é client component", () => {
    expect(fonte("filtros.tsx").trimStart().startsWith('"use client"')).toBe(true);
  });

  // Todos os testes acima embrulham `<FiltrosVivos>` na mão. Se o page.tsx
  // esquecer o provedor, eles continuam TODOS verdes e a home real não tem
  // filtro nenhum — foi exatamente assim com o `<LocalVivo>` na Task 4.
  //
  // Aqui a prova é de FONTE, e ela é fraca de propósito: nesta task nada
  // consome o provedor ainda (o `<PainelFiltros>` só entra no fluxo da home na
  // Task 11), então não há render real pra observar. **A prova forte está
  // transferida pra Task 11**, que renderiza o page.tsx de verdade com um
  // filtro guardado. Precedente da Task 3: achado real que não tem linha pra
  // consertar naquela camada vira ruling registrado, não teste de mentirinha.
  it("o page.tsx da home embrulha tudo no FiltrosVivos", () => {
    expect(fonte("page.tsx")).toContain("<FiltrosVivos>");
  });
});

// ——————— pré-voo: os guardas do armazenamento ———————
//
// Esta é a família que custou DOIS fix rounds na Task 2, pela mesma causa nas
// duas vezes: guarda de localStorage sem prova de mutação. O `filtros.tsx` é
// espelho do `local.tsx` e herda os dois try/catch — e herdaria também a
// ausência de prova se este bloco não existisse.
//
// Em aba anônima do Safari (e com armazenamento cheio) `localStorage` ESTOURA.
// Sem os guardas, a home inteira cai na tela de erro por causa de um filtro.
describe("armazenamento que estoura não derruba a home", () => {
  it("leitura que estoura na montagem: segue sem filtro, sem quebrar", async () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
    try {
      monta();
      expect(await screen.findByText(/4 trilhas/)).toBeTruthy();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  it("escrita que estoura ao ligar um recorte: o filtro vale nesta sessão", async () => {
    monta();
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      const leve = screen.getByRole("button", { name: /^leve$/i });
      await act(async () => { leve.click(); });
      // Não gravou, mas a tela obedeceu: o recorte vale enquanto o app estiver
      // aberto. Perder a preferência é aceitável; travar a home não é.
      expect(leve.getAttribute("aria-pressed")).toBe("true");
      expect(await screen.findByText(/1 filtro ligado/)).toBeTruthy();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  // ——— achado desta task, não teoria: o teste acima NÃO prova o guarda.
  //
  // Com o `try/catch` da escrita apagado ele passa verde, isolado e tudo:
  // `setFiltros(f)` roda ANTES do `setItem`, então a tela obedece do mesmo
  // jeito, e a exceção do handler não chega ao chamador — o despacho sintético
  // de evento do React a transforma em erro global do jsdom (a suíte fica
  // vermelha por "Unhandled Error", sem nenhuma asserção cair).
  //
  // É a MESMA pegadinha já documentada em tests/app/local.test.tsx, e a mesma
  // saída: chamando o setter DIRETO, dentro de `act`, a exceção estoura na
  // cara do teste. Este é o teste que morre quando o guarda morre.
  it("escrita que estoura chamada direto: o guarda é quem segura", () => {
    let mexerCaptado: ((f: Filtros) => void) | null = null;
    function Capta() {
      mexerCaptado = useMexerFiltros();
      return null;
    }
    render(<FiltrosVivos><Capta /></FiltrosVivos>);
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      expect(() => act(() => { mexerCaptado!({ ...SEM_FILTRO, daHoje: true }); })).not.toThrow();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

// ——————— pré-voo: fora de provedor ———————
//
// É o que o SERVIDOR renderiza. O `local.tsx` devolve NAO_SEI e um objeto
// inerte fora de provedor, de propósito; se o `useFiltros` fizer
// `useContext(Ctx)!`, a home estoura no servidor — e nenhum teste acima
// percebe, porque todos montam dentro do provedor.
describe("fora de provedor", () => {
  it("useFiltros devolve SEM_FILTRO e não estoura", () => {
    let visto: unknown = null;
    function Espia() { visto = useFiltros(); return null; }
    expect(() => render(<Espia />)).not.toThrow();
    expect(visto).toEqual(SEM_FILTRO);
  });
});
