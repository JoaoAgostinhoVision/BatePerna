### Task 10: O painel de filtros na tela

**Files:**
- Create: `src/app/filtros.tsx`, `src/app/PainelFiltros.tsx`
- Modify: `src/app/home.css`, `src/app/page.tsx`, `src/lib/home-layout.ts`
- Test: `tests/app/PainelFiltros.test.tsx`, `tests/lib/home-layout.test.ts`

**Interfaces:**
- Consumes: Task 9, `useLocal` (Task 2)
- Produces: `<FiltrosVivos>`, `useFiltros(): Filtros`, `useMexerFiltros(): (f: Filtros) => void`, `<PainelFiltros visiveis={n} />`, `ALTURA_LINHA_FILTRO_PX = 36`

- [ ] **Step 1: Write the failing tests**

```ts
// acrescentar a tests/lib/home-layout.test.ts
import { ALTURA_LINHA_FILTRO_PX } from "@/lib/home-layout";

it("appbar + mapa + LINHA DO FILTRO + cabeçalho ainda cabem no teto", () => {
  const soma =
    ALTURA_APPBAR_PX + MAPA_ALTURA_HOME_PX + ALTURA_LINHA_FILTRO_PX + ALTURA_CABECALHO_GRUPO_PX;
  expect(soma).toBeLessThanOrEqual(TETO_ANTES_DO_CARTAO_PX);
});

it("o CSS usa a MESMA altura da constante da linha", () => {
  const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
  const regra = css.match(/\.filtro-linha\s*\{[^}]*\}/s);
  expect(regra, "faltou a regra .filtro-linha").not.toBeNull();
  expect(regra![0]).toContain(`min-height: ${ALTURA_LINHA_FILTRO_PX}px`);
});
```

```tsx
// tests/app/PainelFiltros.test.tsx
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import PainelFiltros from "@/app/PainelFiltros";
import FiltrosVivos, { useFiltros } from "@/app/filtros";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/PainelFiltros.test.tsx tests/lib/home-layout.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

`src/app/filtros.tsx` — **espelho exato do `local.tsx`; abra-o e copie a estrutura**, não a reinvente: `"use client"` na primeira linha, `useState(SEM_FILTRO)` (nunca `useState(() => lerFiltros(...))`), efeito que lê `localStorage` na montagem, setter que grava. Exporta `FiltrosVivos` (default), `useFiltros`, `useMexerFiltros`.

Três detalhes do espelho que **não são enfeite**, e cada um tem teste no Step 1:

- **Os dois `try/catch` em volta do `localStorage`** (ler na montagem, gravar no setter). Em aba anônima do Safari o acesso **estoura**, e sem eles a home inteira cai na tela de erro por causa de um filtro. Foi a ausência desses guardas — e da prova deles — que custou os dois fix rounds da Task 2.
- **Fora de provedor, `useFiltros` devolve `SEM_FILTRO`** e `useMexerFiltros` devolve um objeto inerte (como o `INERTE` do `local.tsx`). Nada de `useContext(Ctx)!`: é o servidor que renderiza esse caso.
- **Dois contextos separados** (estado e mexer), como lá — quem só mexe não repinta a cada mudança de estado.

`src/app/PainelFiltros.tsx` — a linha e o painel:

```tsx
"use client";
import { useState } from "react";
import { contarLigados, type Filtros } from "@/lib/filtros";
import { coordDe } from "@/lib/local";
import { useFiltros, useMexerFiltros } from "./filtros";
import { useLocal } from "./local";

/** A linha de resumo e o painel que ela abre.
 *
 *  O painel DESCE EMPURRANDO a lista (sanfona), não é cortina por cima do
 *  mapa: decisão do João, e ela vale além desta tela — este app não tem
 *  nenhuma camada flutuante, e uma cortina puxaria junto fechar-tocando-fora,
 *  prender o foco atrás dela e Esc, três coisas que hoje não existem aqui. */
export default function PainelFiltros({ visiveis }: { visiveis: number }) {
  const filtros = useFiltros();
  const mexer = useMexerFiltros();
  const temLocal = coordDe(useLocal()) !== null;
  const [aberto, setAberto] = useState(false);
  const ligados = contarLigados(filtros);
  const trocar = (p: Partial<Filtros>) => mexer({ ...filtros, ...p });

  return (
    <>
      <div className="filtro-linha">
        <span className="filtro-conta">
          {visiveis === 1 ? "1 trilha" : `${visiveis} trilhas`}
          {ligados > 0 && ` · ${ligados === 1 ? "1 filtro ligado" : `${ligados} filtros ligados`}`}
        </span>
        <button className="filtro-abrir" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          FILTRAR {aberto ? "▴" : "▾"}
        </button>
      </div>
      {aberto && (
        <div className="filtro-painel">
          {/* O recorte de distância só existe quando há de onde medir. */}
          {temLocal && (
            <fieldset className="filtro-grupo" aria-label="Distância">
              <legend>Distância</legend>
              {([30, 60, null] as const).map((v) => (
                <button key={String(v)} className="chip" aria-pressed={filtros.distanciaKm === v}
                  onClick={() => trocar({ distanciaKm: v })}>
                  {v === null ? "qualquer" : `até ${v} km`}
                </button>
              ))}
            </fieldset>
          )}
          <fieldset className="filtro-grupo" aria-label="Hoje">
            <legend>Hoje</legend>
            <button className="chip" aria-pressed={filtros.daHoje}
              onClick={() => trocar({ daHoje: !filtros.daHoje })}>só as que dá hoje</button>
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Custo">
            <legend>Custo</legend>
            <button className="chip" aria-pressed={filtros.soGratis}
              onClick={() => trocar({ soGratis: !filtros.soGratis })}>só grátis</button>
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Esforço">
            <legend>Esforço</legend>
            {(["leve", "media", "puxada"] as const).map((e) => (
              <button key={e} className="chip" aria-pressed={filtros.esforco === e}
                onClick={() => trocar({ esforco: filtros.esforco === e ? null : e })}>{e}</button>
            ))}
          </fieldset>
          <fieldset className="filtro-grupo" aria-label="Duração">
            <legend>Duração</legend>
            {([120, 240, null] as const).map((v) => (
              <button key={String(v)} className="chip" aria-pressed={filtros.duracaoMax === v}
                onClick={() => trocar({ duracaoMax: v })}>
                {v === 120 ? "até 2h" : v === 240 ? "até meio dia" : "qualquer"}
              </button>
            ))}
          </fieldset>
        </div>
      )}
    </>
  );
}
```

Em `src/lib/home-layout.ts`:

```ts
/** `.filtro-linha`: a linha de resumo dos filtros, entre o mapa e a folha.
 *  MEDIDA do CSS, não desejo — ver o teste que lê a folha.
 *
 *  36px é o que cabe: com os 52 da appbar, os 168 do mapa e os 34 do
 *  cabeçalho de grupo, a soma dá 290 contra o teto de 320. Uma faixa de chips
 *  permanentes custaria 44 e deixaria o primeiro cartão colado no teto. */
export const ALTURA_LINHA_FILTRO_PX = 36;
```

Em `src/app/home.css`: `.filtro-linha` (flex, `min-height: 36px`, borda embaixo), `.filtro-abrir`, `.filtro-conta`, `.filtro-painel` (fundo `var(--surface-2)`, em fluxo normal — **não** `position: absolute`, senão não empurra), `.filtro-grupo` (sem borda de fieldset, `legend` como rótulo pequeno), `.chip` (`min-height: 36px`, `border-radius: 20px`, `[aria-pressed="true"]` invertido).

Em `src/app/page.tsx`: envolva com `<FiltrosVivos>` por dentro do `<LocalVivo>`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/PainelFiltros.test.tsx tests/lib/home-layout.test.ts`
Expected: PASS

- [ ] **Step 5: Prova de mutação, sub-cláusula a sub-cláusula**

A régua deste projeto é literal: *apagar a linha faz um teste falhar*. "Existe um teste parecido em outro caminho de código" **não é prova** — o argumento já foi derrubado nesta rodada apagando o guard e vendo a suíte verde.

| # | Mutação | Teste que TEM que falhar |
|---|---|---|
| 1 | `useState(SEM_FILTRO)` → `useState(() => lerFiltros(localStorage.getItem(CHAVE_FILTROS)))` | "o PRIMEIRO render ignora o que está guardado" |
| 2 | apagar o `"use client"` do `PainelFiltros.tsx` | "PainelFiltros é client component" — **e mais nenhum** |
| 3 | apagar o `"use client"` do `filtros.tsx` | "filtros.tsx é client component" |
| 4 | tirar o `<FiltrosVivos>` do `page.tsx` | "o page.tsx da home embrulha tudo no FiltrosVivos" |
| 5 | apagar o `try/catch` da LEITURA em `filtros.tsx` | "leitura que estoura na montagem" |
| 6 | apagar o `try/catch` da ESCRITA em `filtros.tsx` | "escrita que estoura ao ligar um recorte" |
| 7 | `useContext(Ctx) ?? SEM_FILTRO` → `useContext(Ctx)!` | "useFiltros devolve SEM_FILTRO e não estoura" |
| 8 | `{...filtros, ...p}` → `{...SEM_FILTRO, ...p}` no `trocar` | "ligar um recorte preserva os que já estavam ligados" |
| 9 | `filtros.esforco === e ? null : e` → `e` | "tocar o mesmo esforço de novo desliga" |
| 10 | apagar o `aria-expanded` do botão FILTRAR | "abre no toque e fecha no toque de novo" |
| 11 | trocar `min-height: 36px` do `.filtro-linha` no CSS | "o CSS usa a MESMA altura da constante da linha" |

**Na #2 e na #3, confira também quantos OUTROS testes caem.** A resposta esperada é zero — é isso que torna a asserção de fonte necessária, e é o número que prova a lição.

🔴 **Se alguma mutação NÃO morder, PARE e relate.** Não afrouxe a asserção. Antes de declarar uma linha morta, rode `npx tsc --noEmit`: duas linhas que o vitest deu como mortas nesta suíte eram carregadoras de peso pro `tsc`. Três vezes nesta rodada, quando a mutação não mordeu, o erro estava no plano — e quem parou e mostrou a conta estava certo nas três.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
npx tsc --noEmit
npm run build
git add src/app/filtros.tsx src/app/PainelFiltros.tsx src/app/home.css src/app/page.tsx src/lib/home-layout.ts tests/app/PainelFiltros.test.tsx tests/lib/home-layout.test.ts
git commit -m "feat(filtros): a linha de resumo e o painel sanfona na home"
```

🔴 **`npm run build` entra na verificação, não é opcional.** `npm test` verde não prova que o app constrói: o vitest roda por esbuild e nunca chama o `next build`. Nesta mesma rodada o build ficou quebrado por quatro commits com a suíte inteira verde, e três revisões passaram por cima.

---

