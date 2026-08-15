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
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import PainelFiltros from "@/app/PainelFiltros";
import FiltrosVivos from "@/app/filtros";
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
});

describe("o painel", () => {
  it("nasce fechado", () => {
    monta();
    expect(screen.queryByRole("group", { name: /esforço/i })).toBeNull();
  });

  it("abre no toque e fecha no toque de novo", async () => {
    monta();
    const b = screen.getByRole("button", { name: /filtrar/i });
    await act(async () => { b.click(); });
    expect(screen.getByRole("group", { name: /esforço/i })).toBeTruthy();
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
    await act(async () => { screen.getByRole("button", { name: /^leve$/i }).click(); });
    expect(localStorage.getItem(CHAVE_FILTROS)).toContain("leve");
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
```

(o teste acima importa `useFiltros` de `@/app/filtros`)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/PainelFiltros.test.tsx tests/lib/home-layout.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

`src/app/filtros.tsx` — espelho exato do `local.tsx`: `useState(SEM_FILTRO)` (nunca `useState(() => lerFiltros(...))`), efeito que lê `localStorage` na montagem, setter que grava. Exporta `FiltrosVivos` (default), `useFiltros`, `useMexerFiltros`.

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

- [ ] **Step 5: Prova de mutação**

Troque `useState(SEM_FILTRO)` por `useState(() => lerFiltros(localStorage.getItem(CHAVE_FILTROS)))` em `filtros.tsx` → "o PRIMEIRO render ignora o que está guardado" tem que falhar. Devolva. Cole a saída.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/filtros.tsx src/app/PainelFiltros.tsx src/app/home.css src/app/page.tsx src/lib/home-layout.ts tests/app/PainelFiltros.test.tsx tests/lib/home-layout.test.ts
git commit -m "feat(filtros): a linha de resumo e o painel sanfona na home"
```

---

