### Task 9: Os filtros puros

**Files:**
- Create: `src/lib/filtros.ts`
- Test: `tests/lib/filtros.test.ts`

**Interfaces:**
- Consumes: `Ficha`, `Esforco` (Task 8), `LeituraCarimbo`, `Coord`, `distanciaKm`
- Produces:
  - `type Filtros = { distanciaKm: 30 | 60 | null; daHoje: boolean; soGratis: boolean; esforco: Esforco | null; duracaoMax: 120 | 240 | null }`
  - `const SEM_FILTRO: Filtros`, `const CHAVE_FILTROS = "bp.filtros"`
  - `lerFiltros(bruto: string | null): Filtros`
  - `contarLigados(f: Filtros): number`
  - `passaNoFiltro(args: { ficha: Ficha; leitura: LeituraCarimbo; filtros: Filtros; voce: Coord | null; confia: boolean }): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/filtros.test.ts
import { describe, expect, it } from "vitest";
import { SEM_FILTRO, contarLigados, lerFiltros, passaNoFiltro, type Filtros } from "@/lib/filtros";
import { getFichasComCondicao } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

const base = getFichasComCondicao()[0];
const RAMPA = base.condicao.coords;
const FRESCO: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: 1_800_000_000 };
const FRIO: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: 1_800_000_000 };

function passa(f: Partial<Filtros>, over: Partial<Ficha> = {}, extra: Partial<{
  leitura: LeituraCarimbo; voce: { lat: number; lng: number } | null; confia: boolean;
}> = {}) {
  return passaNoFiltro({
    ficha: { ...base, ...over },
    leitura: extra.leitura ?? FRESCO,
    filtros: { ...SEM_FILTRO, ...f },
    voce: extra.voce ?? null,
    confia: extra.confia ?? true,
  });
}

describe("sem filtro, tudo passa", () => {
  it("nenhuma trilha some da tela por acidente", () => {
    expect(passa({})).toBe(true);
    expect(passa({}, {}, { leitura: FRIO })).toBe(true);
  });
  it("contarLigados é zero", () => {
    expect(contarLigados(SEM_FILTRO)).toBe(0);
  });
});

describe('"dá hoje"', () => {
  it("esconde o que o motor mediu como não-vai", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRIO })).toBe(false);
  });
  it("mantém o que dá", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRESCO })).toBe(true);
  });

  // REGRA DE HONESTIDADE 1. Quando a folha não confia nas leituras, o filtro
  // fica INERTE: esconder o que não se sabe é o app fingindo que sabe, e
  // contradiz "sem leitura o app INFORMA, não manda".
  it("sem leitura confiável, não esconde nada", () => {
    expect(passa({ daHoje: true }, {}, { leitura: FRIO, confia: false })).toBe(true);
  });
  it("leitura com erro não é escondida", () => {
    expect(passa({ daHoje: true }, {}, { leitura: { ...FRIO, erro: true }, confia: false })).toBe(true);
  });
});

describe("distância", () => {
  const perto = { lat: RAMPA.lat + 0.05, lng: RAMPA.lng };      // ~5 km
  const longe = { lat: RAMPA.lat + 1.2, lng: RAMPA.lng };       // ~130 km

  it("dentro do limite passa", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: perto })).toBe(true);
  });
  it("fora do limite não passa", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: longe })).toBe(false);
  });
  // Sem localização o recorte nem aparece na tela; se chegar aqui ligado
  // (estado guardado de outra sessão), não pode esconder nada.
  it("sem localização, não filtra", () => {
    expect(passa({ distanciaKm: 30 }, {}, { voce: null })).toBe(true);
  });
});

describe("custo", () => {
  it("só grátis esconde a paga", () => {
    expect(passa({ soGratis: true }, { custo: { tag: "pago", valor: "R$ 5" } })).toBe(false);
  });
  it("só grátis mantém a grátis", () => {
    expect(passa({ soGratis: true }, { custo: { tag: "gratis" } })).toBe(true);
  });
});

describe("esforço e duração", () => {
  it("esforço igual passa, diferente não", () => {
    expect(passa({ esforco: "leve" }, { esforco: "leve" })).toBe(true);
    expect(passa({ esforco: "leve" }, { esforco: "puxada" })).toBe(false);
  });
  it("duração dentro do teto passa", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: 90 })).toBe(true);
    expect(passa({ duracaoMax: 120 }, { duracao: 300 })).toBe(false);
  });

  // ——— pré-voo: A BORDA, que este brief não especificava.
  //
  // "até 2h" com uma trilha de exatamente 120min: passa ou não? Eu tinha dado
  // só 90 e 300 — dois implementadores razoáveis decidiriam diferente, e a
  // pessoa que ligou "até 2h" veria a trilha de 2h sumir sem entender.
  // **A REGRA, cravada: o teto é INCLUSIVO nos dois recortes.** "até 2h"
  // inclui 2h; "até 30 km" inclui 30 km. É como se lê em português, e o
  // contrário esconde justamente o caso que a pessoa tinha em mente.
  it("o teto de duração é inclusivo — 'até 2h' inclui a trilha de 2h", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: 120 })).toBe(true);
    expect(passa({ duracaoMax: 120 }, { duracao: 121 })).toBe(false);
  });

  // Os outros dois degraus existem e nenhum teste os exercitava — só 120.
  it("o degrau de 240 também recorta", () => {
    expect(passa({ duracaoMax: 240 }, { duracao: 200 })).toBe(true);
    expect(passa({ duracaoMax: 240 }, { duracao: 260 })).toBe(false);
  });

  // As três palavras de esforço, uma a uma: com só "leve"/"puxada" testados,
  // um `===` trocado por comparação parcial passaria batido em "media".
  it("cada esforço recorta o seu, e só o seu", () => {
    for (const e of ["leve", "media", "puxada"] as const) {
      expect(passa({ esforco: e }, { esforco: e })).toBe(true);
      for (const outro of ["leve", "media", "puxada"] as const) {
        if (outro !== e) expect(passa({ esforco: e }, { esforco: outro })).toBe(false);
      }
    }
  });

  // REGRA DE HONESTIDADE 2. Sumir por dado que falta é mentira silenciosa —
  // e hoje TODAS as fichas estão nesse caso.
  it("ficha sem esforço nunca é escondida pelo filtro de esforço", () => {
    expect(passa({ esforco: "leve" }, { esforco: undefined })).toBe(true);
  });
  it("ficha sem duração nunca é escondida pelo filtro de duração", () => {
    expect(passa({ duracaoMax: 120 }, { duracao: undefined })).toBe(true);
  });
});

describe("filtros combinados", () => {
  it("todos têm que passar, não basta um", () => {
    expect(
      passa({ soGratis: true, daHoje: true }, { custo: { tag: "gratis" } }, { leitura: FRIO }),
    ).toBe(false);
  });
  it("contarLigados conta cada recorte ligado uma vez", () => {
    expect(contarLigados({ ...SEM_FILTRO, daHoje: true, soGratis: true, distanciaKm: 30 })).toBe(3);
  });
});

describe("lerFiltros: o que estiver guardado é conferido", () => {
  it("nada guardado é SEM_FILTRO", () => {
    expect(lerFiltros(null)).toEqual(SEM_FILTRO);
  });
  it("texto torto é SEM_FILTRO", () => {
    expect(lerFiltros("{{{")).toEqual(SEM_FILTRO);
  });
  // Um valor fora do conjunto viraria um filtro que esconde tudo pra sempre,
  // e a pessoa não teria como desligar o que não sabe que ligou.
  it("valor fora do conjunto cai pro padrão daquele recorte", () => {
    expect(lerFiltros(JSON.stringify({ distanciaKm: 999, esforco: "brutal" }))).toEqual(SEM_FILTRO);
  });
  it("preserva o que é válido", () => {
    expect(lerFiltros(JSON.stringify({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 })))
      .toEqual({ ...SEM_FILTRO, daHoje: true, distanciaKm: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/filtros.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/filtros"`

- [ ] **Step 3: Implement**

```ts
// src/lib/filtros.ts
/** Os recortes da home: "o que é melhor pra mim hoje".
 *
 *  Puro, sem React: a folha aplica, a tela desenha, e as duas REGRAS DE
 *  HONESTIDADE abaixo vivem aqui, onde podem ser provadas. */

import { distanciaKm, type Coord } from "@/lib/geo";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import type { Esforco, Ficha } from "@/types/ficha";

export type Filtros = {
  distanciaKm: 30 | 60 | null;
  daHoje: boolean;
  soGratis: boolean;
  esforco: Esforco | null;
  duracaoMax: 120 | 240 | null;
};

export const CHAVE_FILTROS = "bp.filtros";

export const SEM_FILTRO: Filtros = {
  distanciaKm: null,
  daHoje: false,
  soGratis: false,
  esforco: null,
  duracaoMax: null,
};

export function contarLigados(f: Filtros): number {
  return [f.distanciaKm, f.daHoje || null, f.soGratis || null, f.esforco, f.duracaoMax].filter(
    (x) => x !== null && x !== false,
  ).length;
}

export function lerFiltros(bruto: string | null): Filtros {
  if (!bruto) return SEM_FILTRO;
  let x: Record<string, unknown>;
  try {
    x = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    return SEM_FILTRO;
  }
  if (typeof x !== "object" || x === null) return SEM_FILTRO;
  // Cada recorte cai pro próprio padrão se vier fora do conjunto. Um valor
  // estranho que passasse viraria um filtro escondendo tudo pra sempre, sem a
  // pessoa saber o que desligar.
  return {
    distanciaKm: x.distanciaKm === 30 || x.distanciaKm === 60 ? x.distanciaKm : null,
    daHoje: x.daHoje === true,
    soGratis: x.soGratis === true,
    esforco:
      x.esforco === "leve" || x.esforco === "media" || x.esforco === "puxada" ? x.esforco : null,
    duracaoMax: x.duracaoMax === 120 || x.duracaoMax === 240 ? x.duracaoMax : null,
  };
}

/** Uma trilha passa se passar em TODOS os recortes ligados.
 *
 *  `confia` é a MESMA pergunta que a `FolhaTrilhas` já faz pra decidir se
 *  agrupa — recebida pronta de propósito. Escrever aqui uma segunda regra pra
 *  "confiável" seria criar duas fontes que podem discordar, que é a família
 *  de defeito que já custou dois Criticals a este app. */
export function passaNoFiltro({
  ficha,
  leitura,
  filtros,
  voce,
  confia,
}: {
  ficha: Ficha;
  leitura: LeituraCarimbo;
  filtros: Filtros;
  voce: Coord | null;
  confia: boolean;
}): boolean {
  // REGRA DE HONESTIDADE 1: "dá hoje" só esconde o que o motor MEDIU. Sem
  // leitura confiável o recorte fica inerte — esconder o que não se sabe é o
  // app fingindo que sabe, e ele foi construído pra informar, não pra mandar.
  if (filtros.daHoje && confia && leitura.estado !== "fresco") return false;

  // Sem localização o recorte de distância nem aparece na tela. Se chegar
  // ligado (guardado de outra sessão), não esconde nada.
  if (filtros.distanciaKm !== null && voce) {
    if (distanciaKm(voce, ficha.condicao.coords) > filtros.distanciaKm) return false;
  }

  if (filtros.soGratis && ficha.custo.tag !== "gratis") return false;

  // REGRA DE HONESTIDADE 2: ficha sem o campo NUNCA é escondida por ele.
  // Sumir por dado que falta é mentira silenciosa — e hoje todas as fichas
  // estão nesse caso.
  if (filtros.esforco !== null && ficha.esforco && ficha.esforco !== filtros.esforco) return false;
  if (filtros.duracaoMax !== null && ficha.duracao && ficha.duracao > filtros.duracaoMax) {
    return false;
  }

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/filtros.test.ts`
Expected: PASS (22 tests)

- [ ] **Step 5: Prova de mutação das duas regras**

1. Tire o `&& confia` da primeira regra → "sem leitura confiável, não esconde nada" tem que falhar.
2. Troque `ficha.esforco &&` por `true &&` → "ficha sem esforço nunca é escondida" tem que falhar.

Devolva as duas e cole as saídas.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/lib/filtros.ts tests/lib/filtros.test.ts
git commit -m "feat(filtros): os recortes da home, com as duas regras de honestidade"
```

---

