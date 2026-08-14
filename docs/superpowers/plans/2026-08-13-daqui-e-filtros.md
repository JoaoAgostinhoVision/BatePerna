# "De onde eu estou" e os filtros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home passa a saber de onde a pessoa está — e usa isso no mapa, no km do cartão e num filtro — com a barra do menu presa no rodapé.

**Architecture:** Uma fonte única de localização no cliente (contexto React alimentado por `localStorage` + GPS), lida **só depois do primeiro render**, exatamente como `useVenceu` já faz. Toda decisão que dependa dela (enquadramento do mapa, km, filtro de distância) bebe desse contexto. Os filtros seguem o mesmo padrão: estado no cliente, aplicado na MESMA passada em que a folha agrupa, pra não repetir o defeito de junção que gerou o último Critical.

**Tech Stack:** Next.js 15 (App Router, `force-dynamic`), React client components, Vitest + Testing Library + jsdom, Zod para o schema da ficha, Open-Meteo (clima e geocoding), tiles do OpenStreetMap. Sem bibliotecas novas.

**Spec:** `docs/superpowers/specs/2026-08-13-daqui-e-filtros-design.md` — leia junto; o plano argumenta a partir dela.

## Global Constraints

Valem em TODAS as tasks. Copiadas da spec:

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Vale pro mosaico do mapa também. Nada nesta rodada pode transformar o mapa ou o carimbo em algo que só existe depois do JS.
- **Primeiro render sem localização e sem filtro, SEMPRE**, mesmo com dado guardado. Ler `localStorage` durante o render quebra a hidratação de uma página vinda do cache do service worker. É a mesma regra do `useVenceu`.
- **Uma pessoa, uma fonte:** mapa, cartão e filtro leem a MESMA localização. Nunca dois `navigator.geolocation` na árvore.
- **Uma trilha, uma fonte:** cartão, selo, pin, cabeçalho e agora o km leem a mesma leitura de carimbo.
- **Sem leitura o app INFORMA, não manda.** O filtro "dá hoje" não pode virar um jeito de sumir com o que não se sabe.
- **Não inventar geografia.** Nome de cidade só quando o serviço devolveu. `esforco`/`duracao` só quando o João disse — por isso são **opcionais** no schema.
- **"em linha reta" não é droppável** em nenhum texto de distância.
- **Sem `next/link`**; toda navegação é âncora pura. **`© OpenStreetMap` em todo mapa** (ODbL).
- `avaliar` (`src/lib/motor.ts`) segue sendo o único lugar que decide se dá pra subir.
- **Rodar `npm test` inteiro antes de cada commit**, não só o arquivo da task. A suíte começa em **278/278**.
- **Toda constante numérica nova entra com a derivação escrita no comentário** e com teste. Número mandado sem derivação vira duas conferências que compartilham a mesma suposição.
- **Prova de mutação obrigatória** em toda regra e todo número: apague a linha, rode, veja falhar, devolva, cole a saída no relatório. Esta suíte já produziu oito testes que passavam com o código apagado.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/local.ts` | Puro: o tipo `Local`, ler/gravar tolerante, rótulo da pílula |
| `src/app/local.tsx` | Cliente: contexto + provedor, GPS, `localStorage` (nunca no render) |
| `src/lib/lugares.ts` | Puro: URL do geocoding e leitura da resposta |
| `src/app/api/lugares/route.ts` | A rota `GET /api/lugares?q=` |
| `src/app/BuscaLugar.tsx` | A tela de busca de cidade |
| `src/lib/filtros.ts` | Puro: o tipo `Filtros`, ler/gravar, `passaNoFiltro`, `contarLigados` |
| `src/app/filtros.tsx` | Cliente: contexto + provedor dos filtros |
| `src/app/PainelFiltros.tsx` | A linha de resumo e o painel sanfona |

**Modificar:** `src/lib/mapa.ts`, `src/lib/geo.ts`, `src/lib/home-layout.ts`, `src/types/ficha.ts`, `src/app/MapaHome.tsx`, `src/app/CartaoTrilha.tsx`, `src/app/FolhaTrilhas.tsx`, `src/app/DistanciaDaqui.tsx`, `src/app/page.tsx`, `src/app/trilhas/page.tsx`, `src/app/home.css`, `docs/questionario-ficha.md`.

---

### Task 1: A localização pura

**Files:**
- Create: `src/lib/local.ts`
- Test: `tests/lib/local.test.ts`

**Interfaces:**
- Consumes: `Coord` de `@/lib/geo`
- Produces:
  - `type Local = { tipo: "nao-sei" } | { tipo: "gps"; coord: Coord; em: number } | { tipo: "escolhido"; coord: Coord; em: number; nome: string; regiao: string }`
  - `type EstadoGps = "nunca" | "negado"`
  - `const CHAVE_LOCAL = "bp.local"`, `const CHAVE_GPS = "bp.gps"`, `const NAO_SEI: Local`
  - `lerLocal(bruto: string | null): Local`
  - `lerEstadoGps(bruto: string | null): EstadoGps`
  - `coordDe(l: Local): Coord | null`
  - `rotuloPilula(l: Local, gps: EstadoGps): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/local.test.ts
import { describe, expect, it } from "vitest";
import {
  CHAVE_LOCAL,
  NAO_SEI,
  coordDe,
  lerEstadoGps,
  lerLocal,
  rotuloPilula,
  type Local,
} from "@/lib/local";

const GPS: Local = { tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000 };
const ESCOLHIDO: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

describe("lerLocal: nada guardado, ou guardado torto, é 'não sei'", () => {
  it("sem nada guardado", () => {
    expect(lerLocal(null)).toEqual(NAO_SEI);
  });

  it("texto que não é JSON não derruba a home", () => {
    expect(lerLocal("{isso não é json")).toEqual(NAO_SEI);
  });

  // Uma versão antiga do app pode ter gravado outra forma aqui. Aceitar
  // qualquer objeto faria coordDe devolver {lat: undefined} e o mapa
  // enquadrar contra NaN — mapa em branco, sem erro nenhum.
  it("objeto com tipo desconhecido", () => {
    expect(lerLocal(JSON.stringify({ tipo: "satelite", coord: { lat: 1, lng: 2 } }))).toEqual(NAO_SEI);
  });

  it("gps sem coordenada numérica", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: "-8", lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("escolhido sem nome não vira escolhido — a pílula ficaria sem o que dizer", () => {
    expect(
      lerLocal(JSON.stringify({ tipo: "escolhido", coord: { lat: -8, lng: -35 }, em: 1, regiao: "PE" })),
    ).toEqual(NAO_SEI);
  });

  it("coordenada fora do mundo é recusada", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: 99, lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("ida e volta preserva o gps", () => {
    expect(lerLocal(JSON.stringify(GPS))).toEqual(GPS);
  });

  it("ida e volta preserva o escolhido, com nome e região", () => {
    expect(lerLocal(JSON.stringify(ESCOLHIDO))).toEqual(ESCOLHIDO);
  });
});

describe("coordDe", () => {
  it("'não sei' não tem coordenada — quem chama decide o que fazer", () => {
    expect(coordDe(NAO_SEI)).toBeNull();
  });
  it("gps e escolhido têm", () => {
    expect(coordDe(GPS)).toEqual(GPS.coord);
    expect(coordDe(ESCOLHIDO)).toEqual(ESCOLHIDO.coord);
  });
});

describe("rotuloPilula: a pílula é o único lugar de onde a localização se mexe", () => {
  it("nunca perguntou: convida", () => {
    expect(rotuloPilula(NAO_SEI, "nunca")).toBe("Ver daqui");
  });

  // Negado uma vez, o navegador não pergunta de novo. Continuar oferecendo
  // "Ver daqui" seria um botão que não faz nada.
  it("negado: oferece o caminho manual, sem insistir no GPS", () => {
    expect(rotuloPilula(NAO_SEI, "negado")).toBe("escolher onde estou");
  });

  // O GPS não devolve nome de cidade. Inventar um seria inventar geografia.
  it("gps: diz 'daqui', sem nome de lugar", () => {
    expect(rotuloPilula(GPS, "nunca")).toBe("daqui · trocar");
  });

  it("escolhido: diz o nome que o serviço devolveu", () => {
    expect(rotuloPilula(ESCOLHIDO, "nunca")).toBe("de Gravatá · trocar");
  });

  // Já teve localização = já permitiu, ou escolheu na mão. O texto não pode
  // regredir pro convite só porque a flag de gps diz "negado".
  it("com localização, o estado do gps não muda o rótulo", () => {
    expect(rotuloPilula(ESCOLHIDO, "negado")).toBe("de Gravatá · trocar");
  });
});

describe("lerEstadoGps", () => {
  it("sem nada guardado é 'nunca'", () => {
    expect(lerEstadoGps(null)).toBe("nunca");
  });
  it("qualquer coisa que não seja 'negado' é 'nunca'", () => {
    expect(lerEstadoGps("talvez")).toBe("nunca");
  });
  it("'negado' se mantém", () => {
    expect(lerEstadoGps("negado")).toBe("negado");
  });
});

describe("a chave de armazenamento", () => {
  it("tem prefixo do app — o localStorage é compartilhado com todo o domínio", () => {
    expect(CHAVE_LOCAL.startsWith("bp.")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/local.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/local"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/local.ts
/** "De onde eu estou" — a fonte única da localização da pessoa.
 *
 *  Puro de propósito: sem React, sem `navigator`, sem `localStorage`. Quem lê
 *  o aparelho é `src/app/local.tsx`; aqui só mora a forma do dado e o que se
 *  decide a partir dela, que é o que precisa de teste.
 *
 *  O rótulo da pílula vive aqui, e não no componente, porque ele é uma
 *  DECISÃO (o que o app diz quando não sabe, quando o GPS foi negado, quando
 *  a pessoa escolheu na mão), não uma formatação. */

import type { Coord } from "@/lib/geo";

export type Local =
  | { tipo: "nao-sei" }
  | { tipo: "gps"; coord: Coord; em: number }
  | { tipo: "escolhido"; coord: Coord; em: number; nome: string; regiao: string };

/** Se o navegador já negou o GPS uma vez. Não é um `Local`: é sobre a
 *  PERMISSÃO, não sobre a posição — dá pra ter posição escolhida na mão e o
 *  GPS negado ao mesmo tempo. */
export type EstadoGps = "nunca" | "negado";

/** `localStorage` é do domínio inteiro. Prefixo pra não colidir com nada. */
export const CHAVE_LOCAL = "bp.local";
export const CHAVE_GPS = "bp.gps";

export const NAO_SEI: Local = { tipo: "nao-sei" };

function ehCoord(x: unknown): x is Coord {
  const c = x as Coord | null;
  return (
    typeof c?.lat === "number" &&
    typeof c?.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/** O que estiver guardado no aparelho, conferido antes de virar decisão.
 *
 *  Qualquer coisa que não tenha exatamente a forma esperada vira "não sei".
 *  Uma versão anterior do app pode ter gravado outra coisa nesta chave, e
 *  aceitar de olhos fechados daria `{lat: undefined}` no enquadramento do
 *  mapa — que não estoura, só desenha um mapa em branco sem erro nenhum. */
export function lerLocal(bruto: string | null): Local {
  if (!bruto) return NAO_SEI;
  let x: unknown;
  try {
    x = JSON.parse(bruto);
  } catch {
    return NAO_SEI;
  }
  const o = x as Record<string, unknown> | null;
  if (typeof o !== "object" || o === null) return NAO_SEI;
  if (!ehCoord(o.coord) || typeof o.em !== "number" || !Number.isFinite(o.em)) return NAO_SEI;

  if (o.tipo === "gps") return { tipo: "gps", coord: o.coord, em: o.em };
  if (o.tipo === "escolhido" && typeof o.nome === "string" && typeof o.regiao === "string") {
    return { tipo: "escolhido", coord: o.coord, em: o.em, nome: o.nome, regiao: o.regiao };
  }
  return NAO_SEI;
}

export function lerEstadoGps(bruto: string | null): EstadoGps {
  return bruto === "negado" ? "negado" : "nunca";
}

export function coordDe(l: Local): Coord | null {
  return l.tipo === "nao-sei" ? null : l.coord;
}

/** O texto da pílula no canto do mapa — o único lugar de onde a localização
 *  se mexe. */
export function rotuloPilula(l: Local, gps: EstadoGps): string {
  if (l.tipo === "escolhido") return `de ${l.nome} · trocar`;
  if (l.tipo === "gps") return "daqui · trocar";
  // Negado uma vez, o navegador não pergunta de novo: continuar oferecendo
  // "Ver daqui" seria um botão que não faz nada. O app não insiste e não pede
  // desculpa — só troca o caminho.
  return gps === "negado" ? "escolher onde estou" : "Ver daqui";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/local.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Prova de mutação**

Apague a linha `if (!ehCoord(o.coord) || ...) return NAO_SEI;` e rode. Deve falhar em "gps sem coordenada numérica" e "coordenada fora do mundo é recusada". Devolva. Cole a saída no relatório.

- [ ] **Step 6: Rodar a suíte inteira e commitar**

```bash
npm test
git add src/lib/local.ts tests/lib/local.test.ts
git commit -m "feat(local): a forma da localizacao e o rotulo da pilula, puros"
```

---

### Task 2: O contexto da localização (o cliente)

**Files:**
- Create: `src/app/local.tsx`
- Test: `tests/app/local.test.tsx`

**Interfaces:**
- Consumes: tudo da Task 1.
- Produces:
  - `<LocalVivo>{children}</LocalVivo>` — provedor client component
  - `useLocal(): Local` — `NAO_SEI` fora do provedor e no primeiro render
  - `useGps(): EstadoGps`
  - `useMexerLocal(): { pedirGps: () => void; escolher: (l: Local) => void }`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/local.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import LocalVivo, { useGps, useLocal, useMexerLocal } from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL, type Local } from "@/lib/local";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const GRAVATA: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

function Espia() {
  const l = useLocal();
  const gps = useGps();
  return <div data-testid="espia">{`${l.tipo}|${gps}`}</div>;
}

describe("LocalVivo", () => {
  it("fora de um provedor, é 'não sei' — nunca estoura", () => {
    render(<Espia />);
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|nunca");
  });

  // ESTA É A REGRA DURA. A home chega do cache do service worker com HTML
  // velho; ler o aparelho durante o render quebraria a hidratação exatamente
  // no elemento que carrega a decisão. Mesma disciplina do useVenceu.
  it("com localização guardada, o PRIMEIRO render ainda é 'não sei'", () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    let noPrimeiroRender = "";
    function Grava() {
      const l = useLocal();
      noPrimeiroRender ||= l.tipo;
      return null;
    }
    render(<LocalVivo><Grava /></LocalVivo>);
    expect(noPrimeiroRender).toBe("nao-sei");
  });

  it("depois de montar, a localização guardada entra", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
  });

  it("guardado torto não derruba nada: fica 'não sei'", async () => {
    localStorage.setItem(CHAVE_LOCAL, "{lixo");
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("nao-sei|nunca")).toBeTruthy();
  });

  it("escolher grava no aparelho e aparece na tela", async () => {
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });
});

describe("o GPS", () => {
  function aparelhoComGps(impl: (ok: PositionCallback, erro: PositionErrorCallback) => void) {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: impl },
    });
  }

  // Nunca sozinho na abertura: negado por reflexo, o navegador não pergunta
  // mais nunca e o GPS morre naquele aparelho.
  it("não pede GPS sozinho ao montar", async () => {
    const pediu = vi.fn();
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(pediu).not.toHaveBeenCalled();
  });

  it("pedirGps aceito vira localização de gps", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -8.1, longitude: -35.5 } } as GeolocationPosition),
    );
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("gps|nunca");
  });

  it("negado fica marcado no aparelho — o app não pergunta de novo", async () => {
    aparelhoComGps((_ok, erro) => erro({ code: 1 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("nao-sei|negado");
    expect(localStorage.getItem(CHAVE_GPS)).toBe("negado");
  });

  // Estourou o prazo com uma posição guardada em mãos: a guardada continua.
  // Trocar por "não sei" apagaria da tela um km que estava certo.
  it("gps que falha não apaga a localização que já existia", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(GRAVATA));
    aparelhoComGps((_ok, erro) => erro({ code: 3 } as GeolocationPositionError));
    function Botao() {
      const { pedirGps } = useMexerLocal();
      return <button onClick={pedirGps}>pedir</button>;
    }
    render(<LocalVivo><Espia /><Botao /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => { screen.getByText("pedir").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|negado");
  });

  // Concedido uma vez, o navegador não pergunta mais. A partir daí toda
  // abertura já vem com a posição, sem toque nenhum — é a promessa que o João
  // aprovou ("um toque na vida").
  it("com gps já concedido antes, busca sozinho ao montar", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.3, lng: -35.4 }, em: 1_800_000_000,
    }));
    const pediu = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -8.31, longitude: -35.41 } } as GeolocationPosition),
    );
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(pediu).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/local.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/local"`

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/local.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  CHAVE_GPS,
  CHAVE_LOCAL,
  NAO_SEI,
  lerEstadoGps,
  lerLocal,
  type EstadoGps,
  type Local,
} from "@/lib/local";

/** Onde a pessoa está, pra tela inteira.
 *
 *  Irmão do `leituras.tsx`: existe pela mesma razão. O mapa, o km do cartão e
 *  o filtro de distância são elementos distantes um do outro no DOM — se cada
 *  um chamasse `navigator.geolocation` por conta própria, o app pediria GPS
 *  três vezes e poderia mostrar três respostas diferentes pra mesma pergunta.
 *  Uma pessoa, uma fonte.
 *
 *  Fora de um provedor devolve "não sei", que é exatamente o que o servidor
 *  renderiza. */
const Ctx = createContext<{ local: Local; gps: EstadoGps } | null>(null);
const Mexer = createContext<{ pedirGps: () => void; escolher: (l: Local) => void } | null>(null);

const INERTE = { pedirGps: () => {}, escolher: () => {} };

export function useLocal(): Local {
  return useContext(Ctx)?.local ?? NAO_SEI;
}

export function useGps(): EstadoGps {
  return useContext(Ctx)?.gps ?? "nunca";
}

export function useMexerLocal() {
  return useContext(Mexer) ?? INERTE;
}

/** Prazo e idade máxima iguais aos do `DistanciaDaqui`, que já roda em
 *  produção: 10s é o que se aguenta olhando pra tela, 5min de idade evita
 *  ligar o rádio de novo a cada abertura. */
const PRAZO_GPS_MS = 10_000;
const IDADE_GPS_MS = 300_000;

export default function LocalVivo({ children }: { children: ReactNode }) {
  // `useState(NAO_SEI)`, não `useState(() => lerLocal(...))`: o primeiro
  // render TEM que ser "não sei", igual ao do servidor. A home chega do cache
  // do service worker com HTML velho, e ler o aparelho durante o render
  // quebraria a hidratação bem no elemento que carrega a decisão. Mesma razão
  // do useVenceu devolver false no primeiro quadro.
  const [local, setLocal] = useState<Local>(NAO_SEI);
  const [gps, setGps] = useState<EstadoGps>("nunca");

  const escolher = useCallback((l: Local) => {
    setLocal(l);
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(l));
    } catch {
      // Aba anônima ou armazenamento cheio: a escolha vale nesta sessão e
      // pronto. Não é motivo pra tela de erro.
    }
  }, []);

  const buscarGps = useCallback(() => {
    const geo = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geo) return;
    geo.getCurrentPosition(
      (pos) =>
        escolher({
          tipo: "gps",
          coord: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          em: Math.floor(Date.now() / 1000),
        }),
      // Negado, sem sinal, estourou o prazo: pro app dá tudo no mesmo — não
      // insiste. A localização que já existia NÃO é apagada; trocá-la por
      // "não sei" tiraria da tela um km que estava certo.
      () => {
        setGps("negado");
        try {
          localStorage.setItem(CHAVE_GPS, "negado");
        } catch { /* mesmo caso acima */ }
      },
      { timeout: PRAZO_GPS_MS, maximumAge: IDADE_GPS_MS },
    );
  }, [escolher]);

  useEffect(() => {
    let guardado: Local = NAO_SEI;
    try {
      guardado = lerLocal(localStorage.getItem(CHAVE_LOCAL));
      setGps(lerEstadoGps(localStorage.getItem(CHAVE_GPS)));
    } catch { /* sem armazenamento: segue como "não sei" */ }
    if (guardado.tipo !== "nao-sei") setLocal(guardado);
    // Já usou GPS antes = já concedeu, e o navegador não pergunta de novo.
    // Buscar aqui é o que cumpre "um toque na vida": das próximas vezes a
    // posição chega sozinha e atualizada.
    if (guardado.tipo === "gps") buscarGps();
  }, [buscarGps]);

  return (
    <Ctx.Provider value={{ local, gps }}>
      <Mexer.Provider value={{ pedirGps: buscarGps, escolher }}>{children}</Mexer.Provider>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/local.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 5: Prova de mutação da regra dura**

Troque `useState<Local>(NAO_SEI)` por `useState<Local>(() => lerLocal(localStorage.getItem(CHAVE_LOCAL)))` e rode. Deve falhar em "com localização guardada, o PRIMEIRO render ainda é 'não sei'". Devolva. Cole a saída.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/local.tsx tests/app/local.test.tsx
git commit -m "feat(local): contexto unico da localizacao, lido so depois do primeiro render"
```

---

### Task 3: O enquadramento com você junto (funções puras)

**Files:**
- Modify: `src/lib/mapa.ts`
- Test: `tests/lib/mapa.test.ts` (acrescentar; não reescrever o que existe)

**Interfaces:**
- Consumes: `enquadrar`, `posicaoNaCaixa`, `MAPA_JANELA_VISIVEL_HOME_PX`, `MAPA_ALTURA_HOME_PX`, `RAIO_ALVO_TOQUE_PX` (já existem)
- Produces:
  - `const ZOOM_MINIMO_HOME_COM_VOCE = 8`
  - `enquadrarComVoce(trilhas: Coord[], voce: Coord | null, larguraPx: number, alturaPx: number): { centro: Coord; z: number }`
  - `foraDaJanela(coords: Coord[], centro: Coord, z: number, larguraPx: number, alturaPx: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar ao fim de tests/lib/mapa.test.ts
import {
  ZOOM_MINIMO_HOME_COM_VOCE,
  enquadrarComVoce,
  foraDaJanela,
  MAPA_ALTURA_HOME_PX,
  MAPA_JANELA_VISIVEL_HOME_PX,
  MAPA_ZOOM,
  metrosPorPixel,
  posicaoNaCaixa,
} from "@/lib/mapa";

describe("enquadrarComVoce", () => {
  const RAMPA = { lat: -7.907889, lng: -36.019222 };
  const L = MAPA_JANELA_VISIVEL_HOME_PX;
  const A = MAPA_ALTURA_HOME_PX;

  it("sem localização, é exatamente o enquadramento de hoje", () => {
    const so = enquadrar([RAMPA], L, A);
    expect(enquadrarComVoce([RAMPA], null, L, A)).toEqual(so);
  });

  it("com localização, você entra na conta: o centro se desloca na sua direção", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const semVoce = enquadrarComVoce([RAMPA], null, L, A);
    const comVoce = enquadrarComVoce([RAMPA], voce, L, A);
    expect(comVoce.centro.lat).not.toBeCloseTo(semVoce.centro.lat, 4);
    // O centro fica ENTRE os dois pontos, não em cima de nenhum.
    expect(comVoce.centro.lat).toBeLessThan(Math.max(RAMPA.lat, voce.lat));
    expect(comVoce.centro.lat).toBeGreaterThan(Math.min(RAMPA.lat, voce.lat));
  });

  // O piso: abaixo do zoom 8 o mosaico do OSM vira mancha sem nome de cidade.
  // Aí o mapa para de tentar caber tudo e vira "onde eu estou".
  it("trilha longe demais: para no piso e centra em VOCÊ, não no meio do caminho", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const longe = { lat: -15.8, lng: -47.9 }; // ~1400 km
    const { centro, z } = enquadrarComVoce([longe], voce, L, A);
    expect(z).toBe(ZOOM_MINIMO_HOME_COM_VOCE);
    expect(centro.lat).toBeCloseTo(voce.lat, 6);
    expect(centro.lng).toBeCloseTo(voce.lng, 6);
  });

  it("sem localização o piso NÃO vale — o mapa de hoje não muda de comportamento", () => {
    const a = { lat: -8.2, lng: -35.56 };
    const b = { lat: -15.8, lng: -47.9 };
    expect(enquadrarComVoce([a, b], null, L, A).z).toBeLessThan(ZOOM_MINIMO_HOME_COM_VOCE);
  });

  it("nunca aproxima mais que o zoom da ficha", () => {
    const voce = { lat: RAMPA.lat + 0.0001, lng: RAMPA.lng };
    expect(enquadrarComVoce([RAMPA], voce, L, A).z).toBeLessThanOrEqual(MAPA_ZOOM);
  });

  // A derivação do 8, conferida em vez de afirmada: ~605 m/px nesta latitude,
  // que na janela de 350,5px dá ~212 km de largura. Se alguém trocar o 8 por
  // 6, esta conta denuncia — o mapa passaria de 212 pra 850 km de largura.
  it("o piso corresponde a uma largura de mapa entre 150 e 300 km", () => {
    const kmDeLargura = (metrosPorPixel(-8, ZOOM_MINIMO_HOME_COM_VOCE) * L) / 1000;
    expect(kmDeLargura).toBeGreaterThan(150);
    expect(kmDeLargura).toBeLessThan(300);
  });
});

describe("foraDaJanela: quantas trilhas o mapa não mostra", () => {
  const L = MAPA_JANELA_VISIVEL_HOME_PX;
  const A = MAPA_ALTURA_HOME_PX;

  it("tudo dentro: zero", () => {
    const a = { lat: -8.2, lng: -35.56 };
    const b = { lat: -8.25, lng: -35.6 };
    const { centro, z } = enquadrarComVoce([a, b], null, L, A);
    expect(foraDaJanela([a, b], centro, z, L, A)).toBe(0);
  });

  it("no piso, a trilha distante conta como fora", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const longe = { lat: -15.8, lng: -47.9 };
    const { centro, z } = enquadrarComVoce([longe], voce, L, A);
    expect(foraDaJanela([longe], centro, z, L, A)).toBe(1);
  });

  it("conta cada trilha uma vez, e só as que estão fora", () => {
    const voce = { lat: -8.2, lng: -35.56 };
    const perto = { lat: -8.21, lng: -35.57 };
    const longe1 = { lat: -15.8, lng: -47.9 };
    const longe2 = { lat: -23.5, lng: -46.6 };
    const { centro, z } = enquadrarComVoce([perto, longe1, longe2], voce, L, A);
    expect(foraDaJanela([perto, longe1, longe2], centro, z, L, A)).toBe(2);
  });

  // O alvo de toque é de 44px centrado na coordenada: um pin cujo CENTRO está
  // dentro mas cuja metade sai da janela não é tocável inteiro. Contar como
  // dentro faria o texto "1 trilha fora" mentir pra menos.
  it("pin com o centro na borda conta como fora — o alvo de toque não cabe", () => {
    const centro = { lat: -8.2, lng: -35.56 };
    const z = 11;
    // Uma coordenada exatamente na borda esquerda da janela visível.
    const borda = { lat: -8.2, lng: -35.56 - (metrosPorPixel(-8.2, z) * (L / 2)) / 111320 };
    expect(foraDaJanela([borda], centro, z, L, A)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/mapa.test.ts`
Expected: FAIL — `ZOOM_MINIMO_HOME_COM_VOCE is not exported`

- [ ] **Step 3: Write the implementation (acrescentar ao fim de `src/lib/mapa.ts`)**

```ts
/** O zoom abaixo do qual o mapa da home para de afastar quando VOCÊ está na
 *  conta.
 *
 *  Sem este piso, uma trilha em outro estado faria `enquadrar()` cair até o
 *  ZOOM_MINIMO (2) pra caber os dois pontos — e um mosaico do OSM nesse zoom
 *  é mancha sem nome de cidade nem estrada. Mapa que não orienta é pior que
 *  mapa nenhum, e este app não tem como aproximar com o dedo.
 *
 *  Derivação: metrosPorPixel(−8°, 8) ≈ 605 m/px; na janela visível de
 *  350,5px isso dá ~212 km de largura de mapa — ainda com cidade nomeada.
 *  O teste em tests/lib/mapa.test.ts confere essa largura, não o número: é
 *  ela que importa, e é ela que denuncia quem trocar o 8 sem refazer a conta.
 *
 *  É um JULGAMENTO, não uma medida de aparelho. Primeiro candidato a mudar
 *  depois de ver no iPhone. */
export const ZOOM_MINIMO_HOME_COM_VOCE = 8;

/** O enquadramento da home quando existe uma pessoa na tela.
 *
 *  `voce = null` devolve exatamente `enquadrar(trilhas, ...)` — o mapa que já
 *  está no ar e aprovado, piso incluído: sem alguém na conta, não há "centrar
 *  em você", e forçar o piso mudaria um comportamento que ninguém pediu pra
 *  mudar. */
export function enquadrarComVoce(
  trilhas: Coord[],
  voce: Coord | null,
  larguraPx: number,
  alturaPx: number,
): { centro: Coord; z: number } {
  if (!voce) return enquadrar(trilhas, larguraPx, alturaPx);

  const cabe = enquadrar([...trilhas, voce], larguraPx, alturaPx);
  if (cabe.z >= ZOOM_MINIMO_HOME_COM_VOCE) return cabe;

  // Não cabe legível: o mapa vira "onde eu estou". Centrado em VOCÊ, não no
  // meio do caminho — o meio do caminho entre você e um morro a 1400 km é um
  // lugar que não interessa a ninguém.
  return { centro: voce, z: ZOOM_MINIMO_HOME_COM_VOCE };
}

/** Quantas das coordenadas caem fora da janela que a tela realmente mostra.
 *
 *  Vira o texto "2 trilhas fora do mapa", então precisa estar certo: um
 *  número mentindo aqui é pior que não ter o aviso. Usa a MARGEM DO ALVO DE
 *  TOQUE porque um pin cujo centro está dentro mas cuja metade sai da janela
 *  não é tocável inteiro — pra quem olha, ele não está no mapa. */
export function foraDaJanela(
  coords: Coord[],
  centro: Coord,
  z: number,
  larguraPx: number,
  alturaPx: number,
): number {
  return coords.filter((c) => {
    const { left, top } = posicaoNaCaixa(c, centro, z, larguraPx, alturaPx);
    return (
      left < RAIO_ALVO_TOQUE_PX ||
      left > larguraPx - RAIO_ALVO_TOQUE_PX ||
      top < RAIO_ALVO_TOQUE_PX ||
      top > alturaPx - RAIO_ALVO_TOQUE_PX
    );
  }).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/mapa.test.ts`
Expected: PASS (os que já existiam + 9 novos)

- [ ] **Step 5: Prova de mutação**

Troque `if (cabe.z >= ZOOM_MINIMO_HOME_COM_VOCE) return cabe;` por `return cabe;`. Deve falhar em "trilha longe demais: para no piso e centra em VOCÊ". Devolva. Depois troque `RAIO_ALVO_TOQUE_PX` por `0` em `foraDaJanela` e confirme que "pin com o centro na borda conta como fora" falha. Devolva. Cole as duas saídas.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/lib/mapa.ts tests/lib/mapa.test.ts
git commit -m "feat(mapa): enquadrar com voce junto, com piso de legibilidade, e a conta de quem ficou fora"
```

---

### Task 4: O mapa da home usa a localização

**Files:**
- Modify: `src/app/MapaHome.tsx`, `src/app/page.tsx`, `src/app/home.css`
- Test: `tests/app/MapaHome.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `useLocal` (Task 2), `enquadrarComVoce`/`foraDaJanela` (Task 3)
- Produces: `MapaHome` passa a ser client component e a receber `leituras` como `Record<string, LeituraCarimbo>`; renderiza `.voce-pin`, `.mapa-fora` e um slot `.mapa-pilula` para a Task 6.

**ATENÇÃO — o defeito que esta task pode reintroduzir:** `children` de server component não re-renderiza. Se `MapaHome` continuar server component recebendo o resultado pronto, a localização chega no cliente e o mapa **não se move** — é a mesma classe de bug que já custou dois Criticals ("a decisão foi pro cliente e a cor ficou no servidor"). Por isso `MapaHome` vira `"use client"`.

- [ ] **Step 1: Write the failing test**

```tsx
// acrescentar ao fim de tests/app/MapaHome.test.tsx
import LocalVivo from "@/app/local";
import { CHAVE_LOCAL } from "@/lib/local";
import { ZOOM_MINIMO_HOME_COM_VOCE } from "@/lib/mapa";

describe("MapaHome com a localização da pessoa", () => {
  afterEach(() => { localStorage.clear(); });

  const leiturasObj = Object.fromEntries(
    fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 }]),
  );

  it("sem localização, não desenha o ponto 'você' — e o mapa é o de hoje", () => {
    const { container } = render(<MapaHome fichas={fichas} leituras={leiturasObj} />);
    expect(container.querySelector(".voce-pin")).toBeNull();
  });

  // O ponto de uso: não basta enquadrarComVoce existir e ter teste — é
  // MapaHome quem tem que passar a coordenada da pessoa pra ela. Revertendo
  // essa ligação, a suíte de tests/lib/mapa.test.ts fica toda verde.
  it("com localização, aparece o ponto 'você' e os tiles mudam de lugar", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const semLocal = render(<MapaHome fichas={fichas} leituras={leiturasObj} />);
    const tilesAntes = Array.from(semLocal.container.querySelectorAll("img"))
      .map((i) => i.getAttribute("src")).join("|");
    cleanup();

    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    const tilesDepois = Array.from(container.querySelectorAll("img"))
      .map((i) => i.getAttribute("src")).join("|");
    expect(tilesDepois).not.toBe(tilesAntes);
  });

  it("trilha longe demais: avisa quantas ficaram fora do mapa", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -23.5, lng: -46.6 },
      em: 1_800_000_000, nome: "São Paulo", regiao: "São Paulo",
    }));
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    expect(container.querySelector(".mapa-fora")?.textContent).toBe("1 trilha fora do mapa");
  });

  it("continua creditando o OpenStreetMap com a localização ligada", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
    }));
    const { container, findByTestId } = render(
      <LocalVivo><MapaHome fichas={fichas} leituras={leiturasObj} /></LocalVivo>,
    );
    await findByTestId("voce");
    expect(container.textContent).toContain("OpenStreetMap");
  });
});
```

Além disso, **atualize as chamadas existentes** no mesmo arquivo de teste: `leituras` deixa de ser `Map` e passa a ser `Record`. Troque `new Map<string, LeituraCarimbo>(...)` por `Object.fromEntries(...)` em todos os `render(<MapaHome .../>)` já existentes, mantendo as asserções como estão.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/MapaHome.test.tsx`
Expected: FAIL — nenhum `.voce-pin` / `data-testid="voce"` no DOM

- [ ] **Step 3: Implement**

Em `src/app/MapaHome.tsx`: acrescente `"use client";` na primeira linha, troque a prop `leituras: Map<string, LeituraCarimbo>` por `leituras: Record<string, LeituraCarimbo>` (e o `leituras.get(f.slug)` por `leituras[f.slug]`), e:

```tsx
// dentro do componente, depois de montar `comLeitura`
const local = useLocal();
const voce = coordDe(local);

const coords = comLeitura.map((x) => x.ficha.condicao.coords);
const { centro, z } = enquadrarComVoce(coords, voce, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_HOME_PX);
const fora = foraDaJanela(coords, centro, z, MAPA_JANELA_VISIVEL_HOME_PX, MAPA_ALTURA_HOME_PX);
```

E, dentro de `.mapa-home-tiles`, depois dos pins:

```tsx
{voce && (() => {
  const p = posicaoNaCaixa(voce, centro, z, MAPA_LARGURA_PX, MAPA_ALTURA_HOME_PX);
  return <span className="voce-pin" data-testid="voce" style={{ left: p.left, top: p.top }} />;
})()}
```

E, dentro de `.mapa-home`, depois do bloco de tiles:

```tsx
{fora > 0 && (
  <span className="mapa-fora">
    {fora === 1 ? "1 trilha fora do mapa" : `${fora} trilhas fora do mapa`}
  </span>
)}
```

Em `src/app/page.tsx`: envolva o conteúdo com `<LocalVivo>` (por fora do `HomeViva`) e passe `leituras={Object.fromEntries(leituras)}` pro `MapaHome`.

Em `src/app/home.css`, acrescente:

```css
/* O ponto "você": círculo, nunca losango. O losango é vocabulário de TRILHA
   neste app (pin do mapa, ficha, home) — usar a mesma forma pra pessoa faria
   você virar mais uma trilha na tela. */
.bp .voce-pin {
  position: absolute; width: 13px; height: 13px; margin: -6px 0 0 -6px;
  border-radius: 50%; background: var(--voce, #4a8fd6); border: 3px solid var(--screen);
  box-shadow: 0 0 0 6px rgba(74, 143, 214, .22);
}
.bp .mapa-fora {
  position: absolute; right: 6px; top: 6px; z-index: 2;
  font-family: var(--type); font-size: .6rem; font-weight: 650;
  background: rgba(0, 0, 0, .62); color: #e6e0d4; padding: .25rem .4rem; border-radius: 6px;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/MapaHome.test.tsx tests/app/home.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

Troque `enquadrarComVoce(coords, voce, ...)` por `enquadrarComVoce(coords, null, ...)`. Deve falhar em "com localização, aparece o ponto 'você' e os tiles mudam de lugar". Devolva. Cole a saída — este é exatamente o engano que passou na revisão da rodada passada.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/MapaHome.tsx src/app/page.tsx src/app/home.css tests/app/MapaHome.test.tsx
git commit -m "feat(mapa): a home enquadra voce junto das trilhas e avisa quem ficou fora"
```

---

### Task 5: A busca de cidade — a lib pura e a rota

**Files:**
- Create: `src/lib/lugares.ts`, `src/app/api/lugares/route.ts`, `tests/fixtures/geocoding-gravata.json`
- Test: `tests/lib/lugares.test.ts`, `tests/api/route-lugares.test.ts`

**Interfaces:**
- Produces:
  - `type Lugar = { nome: string; regiao: string; pais: string; lat: number; lng: number }`
  - `urlBusca(q: string): string`
  - `lerLugares(raw: unknown): Lugar[]`
  - `GET(req: Request): Promise<Response>` em `/api/lugares?q=`

- [ ] **Step 1: Grave o fixture real**

```bash
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=Gravat%C3%A1&count=5&language=pt&format=json" -o tests/fixtures/geocoding-gravata.json
```

Confira que o arquivo tem `results` com ao menos um item com `name`, `admin1`, `country`, `latitude`, `longitude`.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/lib/lugares.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lerLugares, urlBusca } from "@/lib/lugares";

const bruto = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "fixtures", "geocoding-gravata.json"), "utf8"),
);

describe("urlBusca", () => {
  it("escapa o que a pessoa digitou", () => {
    expect(urlBusca("São José")).toContain("name=S%C3%A3o+Jos%C3%A9");
  });
  it("pede em português", () => {
    expect(urlBusca("Recife")).toContain("language=pt");
  });
});

describe("lerLugares: sobre a resposta REAL do serviço", () => {
  it("o primeiro resultado de 'Gravatá' vem com nome, região e coordenada", () => {
    const [primeiro] = lerLugares(bruto);
    expect(primeiro.nome).toBe("Gravatá");
    expect(primeiro.regiao).toBe("Pernambuco");
    expect(typeof primeiro.lat).toBe("number");
    expect(typeof primeiro.lng).toBe("number");
  });

  // A resposta real traz Gravatal/SC e um Novo Cruzeiro/MG junto. Sem a
  // região na tela, o dedo acerta o lugar errado e todo km da home fica errado.
  it("traz mais de um resultado, e cada um com sua região", () => {
    const lista = lerLugares(bruto);
    expect(lista.length).toBeGreaterThan(1);
    for (const l of lista) expect(l.regiao.length).toBeGreaterThan(0);
  });

  it("busca sem resultado devolve lista vazia, não estoura", () => {
    expect(lerLugares({})).toEqual([]);
    expect(lerLugares({ results: [] })).toEqual([]);
  });

  it("item sem coordenada é descartado, não vira NaN na tela", () => {
    const lista = lerLugares({ results: [{ name: "X", admin1: "Y", country: "Z" }] });
    expect(lista).toEqual([]);
  });

  it("item sem região ainda serve — vira string vazia, não 'undefined'", () => {
    const lista = lerLugares({
      results: [{ name: "X", country: "Brasil", latitude: -8, longitude: -35 }],
    });
    expect(lista[0].regiao).toBe("");
  });

  it("resposta que não é objeto não derruba a rota", () => {
    expect(lerLugares(null)).toEqual([]);
    expect(lerLugares("erro")).toEqual([]);
  });
});
```

```ts
// tests/api/route-lugares.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/lugares/route";

afterEach(() => { vi.restoreAllMocks(); });

function pedido(q: string) {
  return new Request(`http://x/api/lugares?q=${encodeURIComponent(q)}`);
}

describe("GET /api/lugares", () => {
  it("busca vazia não chama o serviço — devolve lista vazia", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await GET(pedido("  "));
    expect(await res.json()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("devolve os lugares em JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        results: [{ name: "Gravatá", admin1: "Pernambuco", country: "Brasil", latitude: -8.2, longitude: -35.56 }],
      }),
    );
    const res = await GET(pedido("Gravatá"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { nome: "Gravatá", regiao: "Pernambuco", pais: "Brasil", lat: -8.2, lng: -35.56 },
    ]);
  });

  // Resultado de busca guardado é resultado errado depois. `nuncaCachear` já
  // trata /api/* no service worker, mas ele não é o único cache no caminho.
  it("nunca é guardado em cache", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ results: [] }));
    const res = await GET(pedido("Recife"));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serviço fora do ar vira 503, não uma lista vazia mentirosa", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("rede"));
    const res = await GET(pedido("Recife"));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/lib/lugares.test.ts tests/api/route-lugares.test.ts`
Expected: FAIL — módulos não existem

- [ ] **Step 4: Implement**

```ts
// src/lib/lugares.ts
/** "Onde eu estou?" quando não há GPS — o serviço de geocoding e a leitura
 *  da resposta dele.
 *
 *  Puro, sem fetch: quem busca é a rota. Aqui mora o que precisa de teste —
 *  a forma da URL e o que se aceita como um lugar de verdade. */

export type Lugar = { nome: string; regiao: string; pais: string; lat: number; lng: number };

/** Quantos resultados. Cinco cabem na tela sem rolar e já bastam pra
 *  desambiguar homônimos (Gravatá/PE vs Gravatal/SC). */
const QUANTOS = 5;

export function urlBusca(q: string): string {
  const params = new URLSearchParams({
    name: q,
    count: String(QUANTOS),
    language: "pt",
    format: "json",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

/** Só vira lugar o que tem coordenada numérica.
 *
 *  Item sem `latitude` viraria `{lat: undefined}`, e daí todo km da home sai
 *  NaN — sem erro nenhum, só números sumindo da tela. A região pode faltar
 *  (vira ""), porque ela é rótulo, não decisão. */
export function lerLugares(raw: unknown): Lugar[] {
  const results = (raw as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const fora: Lugar[] = [];
  for (const r of results) {
    const o = r as Record<string, unknown>;
    if (
      typeof o?.name !== "string" ||
      typeof o.latitude !== "number" ||
      typeof o.longitude !== "number" ||
      !Number.isFinite(o.latitude) ||
      !Number.isFinite(o.longitude)
    ) {
      continue;
    }
    fora.push({
      nome: o.name,
      regiao: typeof o.admin1 === "string" ? o.admin1 : "",
      pais: typeof o.country === "string" ? o.country : "",
      lat: o.latitude,
      lng: o.longitude,
    });
  }
  return fora;
}
```

```ts
// src/app/api/lugares/route.ts
import { lerLugares, urlBusca } from "@/lib/lugares";

export const dynamic = "force-dynamic";

/** Quanto se espera o serviço antes de desistir. Menor que o PRAZO_CLIMA_MS
 *  (4s): aqui a pessoa está digitando e olhando pra tela, não abrindo o app. */
const PRAZO_MS = 3_000;

/** A busca de cidade passa por aqui, e não direto do celular pro serviço:
 *  mesma disciplina de toda chamada externa deste app, e é o que deixa testar
 *  a tela sem internet. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const cabecalho = { "cache-control": "no-store" };
  // Campo vazio não é busca: nem chama o serviço.
  if (q === "") return Response.json([], { headers: cabecalho });

  try {
    const res = await fetch(urlBusca(q), {
      cache: "no-store",
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json(lerLugares(await res.json()), { headers: cabecalho });
  } catch {
    // Lista vazia aqui seria mentira: "não achei nada" e "não consegui
    // buscar" são coisas diferentes, e a tela diz coisas diferentes pra cada.
    return new Response("", { status: 503, headers: cabecalho });
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/lib/lugares.test.ts tests/api/route-lugares.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Conferir a atribuição da fonte**

Abra `https://open-meteo.com/en/docs/geocoding-api` e verifique qual atribuição a base (GeoNames) exige. **Registre no relatório da task o que a licença pede.** Se exigir atribuição visível, ela entra na tela da Task 6 junto da lista — este app trata atribuição como obrigação, não enfeite.

- [ ] **Step 7: Rodar a suíte e commitar**

```bash
npm test
git add src/lib/lugares.ts src/app/api/lugares/route.ts tests/lib/lugares.test.ts tests/api/route-lugares.test.ts tests/fixtures/geocoding-gravata.json
git commit -m "feat(lugares): rota de busca de cidade sobre o geocoding da Open-Meteo"
```

---

### Task 6: A pílula e a tela de busca

**Files:**
- Create: `src/app/BuscaLugar.tsx`
- Modify: `src/app/MapaHome.tsx`, `src/app/home.css`
- Test: `tests/app/BuscaLugar.test.tsx`

**Interfaces:**
- Consumes: `useLocal`/`useGps`/`useMexerLocal` (Task 2), `rotuloPilula` (Task 1), `Lugar` (Task 5)
- Produces: `<BuscaLugar />` — renderiza a pílula e, aberta, o campo e a lista.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/BuscaLugar.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import BuscaLugar from "@/app/BuscaLugar";
import LocalVivo from "@/app/local";
import { CHAVE_GPS, CHAVE_LOCAL } from "@/lib/local";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const GRAVATA = { nome: "Gravatá", regiao: "Pernambuco", pais: "Brasil", lat: -8.2, lng: -35.56 };

function comLocalVivo() {
  return render(<LocalVivo><BuscaLugar /></LocalVivo>);
}

describe("a pílula", () => {
  it("sem localização e sem gps negado, convida", () => {
    comLocalVivo();
    expect(screen.getByRole("button", { name: /Ver daqui/ })).toBeTruthy();
  });

  it("com gps negado, oferece o caminho manual", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /escolher onde estou/ })).toBeTruthy();
  });

  it("com lugar escolhido, diz o nome dele", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    comLocalVivo();
    expect(await screen.findByRole("button", { name: /de Gravatá/ })).toBeTruthy();
  });

  // "Ver daqui" é o toque que pede o GPS — a promessa do "um toque na vida".
  it("'Ver daqui' pede o GPS, não abre a busca", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    await act(async () => { screen.getByRole("button", { name: /Ver daqui/ }).click(); });
    expect(pediu).toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("com gps negado, o toque abre a busca em vez de pedir de novo", async () => {
    localStorage.setItem(CHAVE_GPS, "negado");
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { b.click(); });
    expect(pediu).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("a busca", () => {
  async function abrir() {
    localStorage.setItem(CHAVE_GPS, "negado");
    comLocalVivo();
    const b = await screen.findByRole("button", { name: /escolher onde estou/ });
    await act(async () => { b.click(); });
  }

  it("mostra a região de cada resultado — sem ela o dedo acerta o lugar errado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    expect(await screen.findByText(/Pernambuco/)).toBeTruthy();
  });

  it("escolher um resultado guarda a localização e fecha a busca", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([GRAVATA]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    const item = await screen.findByText(/Pernambuco/);
    await act(async () => { (item.closest("button") as HTMLButtonElement).click(); });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(localStorage.getItem(CHAVE_LOCAL)).toContain("Gravatá");
  });

  it("serviço fora do ar: diz que não conseguiu buscar, não 'nada encontrado'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Recife" } });
    expect(await screen.findByText(/não consegui buscar/i)).toBeTruthy();
  });

  it("busca sem resultado diz que não achou", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));
    await abrir();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Xyzabc" } });
    expect(await screen.findByText(/não achei/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/BuscaLugar.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/BuscaLugar"`

- [ ] **Step 3: Implement**

```tsx
// src/app/BuscaLugar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { rotuloPilula } from "@/lib/local";
import type { Lugar } from "@/lib/lugares";
import { useGps, useLocal, useMexerLocal } from "./local";

type Fase = "fechado" | "aberto";
type Resultado = { tipo: "vazio" } | { tipo: "lista"; lugares: Lugar[] } | { tipo: "falhou" };

/** Espera de digitação: busca a cada letra seria uma requisição por tecla. */
const ESPERA_MS = 350;

/** A pílula no canto do mapa e a busca que ela abre — o único lugar de onde a
 *  localização se mexe.
 *
 *  Quem nunca permitiu o GPS vê "Ver daqui", e o toque PEDE o GPS: é o toque
 *  único que o João aprovou. Quem já negou vê "escolher onde estou", e o
 *  toque abre a busca — insistir no GPS ali seria um botão que não faz nada,
 *  porque o navegador não pergunta duas vezes. */
export default function BuscaLugar() {
  const local = useLocal();
  const gps = useGps();
  const { pedirGps, escolher } = useMexerLocal();
  const [fase, setFase] = useState<Fase>("fechado");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado>({ tipo: "vazio" });
  const pedido = useRef(0);

  const soGps = local.tipo === "nao-sei" && gps === "nunca";

  useEffect(() => {
    if (fase !== "aberto" || q.trim() === "") {
      setRes({ tipo: "vazio" });
      return;
    }
    const meu = ++pedido.current;
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lugares?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const lugares = (await r.json()) as Lugar[];
        // Resposta de uma busca antiga chegando depois da nova sobrescreveria
        // a lista certa pela errada.
        if (meu === pedido.current) setRes({ tipo: "lista", lugares });
      } catch {
        if (meu === pedido.current) setRes({ tipo: "falhou" });
      }
    }, ESPERA_MS);
    return () => clearTimeout(id);
  }, [q, fase]);

  return (
    <>
      <button
        className="mapa-pilula"
        onClick={() => (soGps ? pedirGps() : setFase(fase === "aberto" ? "fechado" : "aberto"))}
      >
        {rotuloPilula(local, gps)}
      </button>

      {fase === "aberto" && (
        <div className="busca">
          <input
            className="busca-campo"
            type="text"
            autoFocus
            placeholder="digite a cidade"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {res.tipo === "falhou" && <p className="busca-aviso">não consegui buscar agora</p>}
          {res.tipo === "lista" && res.lugares.length === 0 && (
            <p className="busca-aviso">não achei esse lugar</p>
          )}
          {res.tipo === "lista" &&
            res.lugares.map((l) => (
              <button
                key={`${l.nome}-${l.lat}-${l.lng}`}
                className="busca-item"
                onClick={() => {
                  escolher({
                    tipo: "escolhido",
                    coord: { lat: l.lat, lng: l.lng },
                    em: Math.floor(Date.now() / 1000),
                    nome: l.nome,
                    regiao: l.regiao,
                  });
                  setFase("fechado");
                  setQ("");
                }}
              >
                <span className="busca-nome">{l.nome}</span>
                <span className="busca-reg">{[l.regiao, l.pais].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
        </div>
      )}
    </>
  );
}
```

Em `src/app/MapaHome.tsx`, dentro de `.mapa-home` (depois do bloco de tiles), renderize `<BuscaLugar />`.

Em `src/app/home.css`, acrescente as regras de `.mapa-pilula` (pílula escura no canto inferior esquerdo do mapa, `min-height: 32px`, `border-radius: 20px`), `.busca` (painel sobre o mapa, fundo `var(--screen)`), `.busca-campo` (`font-size: 16px` — abaixo disso o Safari dá zoom sozinho ao focar), `.busca-item` (bloco, `min-height: 44px`), `.busca-nome`, `.busca-reg`, `.busca-aviso`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/BuscaLugar.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 5: Guarda do zoom do Safari**

Acrescente a `tests/app/BuscaLugar.test.tsx`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";

it("o campo tem 16px — abaixo disso o Safari dá zoom sozinho ao focar e a tela salta", () => {
  const css = readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");
  const regra = css.match(/\.busca-campo\s*\{[^}]*\}/s);
  expect(regra, "faltou a regra .busca-campo").not.toBeNull();
  expect(regra![0]).toMatch(/font-size:\s*16px/);
});
```

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/BuscaLugar.tsx src/app/MapaHome.tsx src/app/home.css tests/app/BuscaLugar.test.tsx
git commit -m "feat(local): a pilula do mapa e a busca de cidade"
```

---

### Task 7: O km no cartão (e a ficha lendo a mesma fonte)

**Files:**
- Modify: `src/lib/geo.ts`, `src/app/CartaoTrilha.tsx`, `src/app/DistanciaDaqui.tsx`, `src/app/home.css`
- Test: `tests/lib/geo.test.ts`, `tests/app/CartaoTrilha.test.tsx` (criar), `tests/app/DistanciaDaqui.test.tsx`

**Interfaces:**
- Produces: `formatarDistanciaCurta(km: number): string`; `CartaoTrilha` passa a renderizar `.cartao-meta`.

- [ ] **Step 1: Write the failing tests**

```ts
// acrescentar a tests/lib/geo.test.ts
import { formatarDistanciaCurta } from "@/lib/geo";

describe("formatarDistanciaCurta: a linha do cartão", () => {
  // "em linha reta" é load-bearing: no agreste, 40km em reta podem ser 1h30
  // de serra. Sem o rótulo, o número mente pra baixo. Só o "daqui" sai — a
  // pílula do mapa já diz de onde se está medindo.
  it("mantém o 'em linha reta'", () => {
    expect(formatarDistanciaCurta(41)).toBe("~41 km em linha reta");
  });
  it("não repete o 'daqui' que a pílula já diz", () => {
    expect(formatarDistanciaCurta(41)).not.toContain("daqui");
  });
  it("abaixo de 1 km", () => {
    expect(formatarDistanciaCurta(0.4)).toBe("menos de 1 km em linha reta");
  });
  it("uma casa decimal abaixo de 10, com vírgula", () => {
    expect(formatarDistanciaCurta(4.25)).toBe("~4,3 km em linha reta");
  });
});
```

```tsx
// tests/app/CartaoTrilha.test.tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CartaoTrilha from "@/app/CartaoTrilha";
import LocalVivo from "@/app/local";
import { CHAVE_LOCAL } from "@/lib/local";
import { getFichasComCondicao } from "@/lib/ficha";

afterEach(() => { cleanup(); localStorage.clear(); });

const ficha = getFichasComCondicao()[0];
const leitura = { estado: "fresco" as const, erro: false, calculadoEm: 1_800_000_000 };

describe("a linha de metadados do cartão", () => {
  it("sem localização, não inventa km", () => {
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    expect(container.textContent).not.toContain("linha reta");
  });

  it("com localização, mostra o km em linha reta", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    render(<LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>);
    expect(await screen.findByText(/km em linha reta/)).toBeTruthy();
  });

  it("mostra o custo quando a ficha cobra", () => {
    const { container } = render(<CartaoTrilha ficha={ficha} inicial={leitura} />);
    if (ficha.custo.tag === "pago") expect(container.textContent).toContain("R$");
  });

  // Não inventar: ficha sem esforço não ganha traço nem "—" no lugar.
  it("ficha sem esforço/duração não mostra campo vazio", () => {
    const semCampos = { ...ficha, esforco: undefined, duracao: undefined };
    const { container } = render(<CartaoTrilha ficha={semCampos} inicial={leitura} />);
    expect(container.textContent).not.toContain("undefined");
    expect(container.querySelector(".cartao-meta")?.textContent ?? "").not.toContain("·  ·");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/geo.test.ts tests/app/CartaoTrilha.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement**

Em `src/lib/geo.ts`, extraia o miolo comum e acrescente:

```ts
/** A distância como o CARTÃO a mostra: sem o "daqui", porque a pílula do mapa
 *  logo acima já diz de onde se está medindo. O "em linha reta" fica — ele é
 *  a parte honesta do texto, não enfeite. */
export function formatarDistanciaCurta(km: number): string {
  return formatarDistancia(km).replace(" daqui", "");
}
```

Em `src/app/CartaoTrilha.tsx`, depois da promessa:

```tsx
const voce = coordDe(useLocal());
const partes = [
  voce ? formatarDistanciaCurta(distanciaKm(voce, ficha.condicao.coords)) : null,
  ficha.duracao ? formatarDuracao(ficha.duracao) : null,
  ficha.esforco ?? null,
  ficha.custo.tag === "pago" && ficha.custo.valor ? ficha.custo.valor.split(" — ")[0] : null,
].filter(Boolean);

{partes.length > 0 && <span className="cartao-meta">{partes.join(" · ")}</span>}
```

`formatarDuracao(min: number)` vive em `src/lib/geo.ts`? **Não** — põe em `src/lib/ficha.ts`, junto do resto do que descreve uma ficha: `export function formatarDuracao(min: number): string` devolve `"~1h30"`, `"~45min"`, `"~2h"`.

Em `src/app/DistanciaDaqui.tsx`: se `coordDe(useLocal())` não for `null`, mostre a distância direto (sem botão), usando `formatarDistancia` (a versão com "daqui", que é o texto da ficha). O botão continua pra quem não tem localização, e ao ser tocado chama `pedirGps()` do contexto — **não** um `navigator.geolocation` próprio. Duas verdades sobre a mesma pergunta em duas telas do mesmo app é exatamente o que a invariante "uma pessoa, uma fonte" proíbe.

Em `src/app/home.css`, acrescente `.bp .cartao-meta { font-family: var(--type); font-size: .68rem; font-weight: 650; color: var(--ink-faint); margin-top: .35rem; }`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/geo.test.ts tests/app/CartaoTrilha.test.tsx tests/app/DistanciaDaqui.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

Apague o `.replace(" daqui", "")` e confirme que "não repete o 'daqui'" falha. Devolva. Depois troque o `voce ? ... : null` por sempre calcular e confirme que "sem localização, não inventa km" falha. Devolva. Cole as saídas.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/lib/geo.ts src/lib/ficha.ts src/app/CartaoTrilha.tsx src/app/DistanciaDaqui.tsx src/app/home.css tests/lib/geo.test.ts tests/app/CartaoTrilha.test.tsx tests/app/DistanciaDaqui.test.tsx
git commit -m "feat(cartao): km em linha reta no cartao, e a ficha lendo a mesma localizacao"
```

---

### Task 8: Os campos novos da ficha e as perguntas novas do questionário

**Files:**
- Modify: `src/types/ficha.ts`, `docs/questionario-ficha.md`
- Test: `tests/lib/ficha.test.ts`, `tests/lib/questionario.test.ts`

**Interfaces:**
- Produces: `esforco?: "leve" | "media" | "puxada"` e `duracao?: number` (minutos) no `fichaSchema`; `type Esforco`.

**Por que opcionais:** a Rampa não tem esses dados, e eles são **fato do João**. Obrigatórios, o app não carregaria a única ficha que existe.

- [ ] **Step 1: Write the failing tests**

```ts
// acrescentar a tests/lib/ficha.test.ts
describe("esforço e duração", () => {
  const base = JSON.parse(readFileSync(
    path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"));

  it("são opcionais — a ficha que existe hoje não os tem e tem que carregar", () => {
    expect(() => fichaSchema.parse(base)).not.toThrow();
  });

  it("aceita os três esforços", () => {
    for (const e of ["leve", "media", "puxada"]) {
      expect(() => fichaSchema.parse({ ...base, esforco: e })).not.toThrow();
    }
  });

  it("recusa esforço inventado — o filtro compara contra estes três e mais nenhum", () => {
    expect(() => fichaSchema.parse({ ...base, esforco: "moderada" })).toThrow();
  });

  // Minutos, não texto: o filtro compara número. "1h30" obrigaria a
  // interpretar português na hora de filtrar.
  it("duração é número de minutos, positivo", () => {
    expect(() => fichaSchema.parse({ ...base, duracao: 90 })).not.toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: "1h30" })).toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: 0 })).toThrow();
    expect(() => fichaSchema.parse({ ...base, duracao: -30 })).toThrow();
  });
});
```

```ts
// acrescentar a tests/lib/questionario.test.ts
it("o questionário pergunta os dois campos novos, com o nome do campo", () => {
  const doc = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");
  expect(doc).toContain("`esforco`");
  expect(doc).toContain("`duracao`");
});

it("a pergunta da duração pede minutos — senão a resposta vem em texto e o schema recusa", () => {
  const doc = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");
  const secao = doc.slice(doc.indexOf("`duracao`"));
  expect(secao.slice(0, 900)).toMatch(/minuto/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/ficha.test.ts tests/lib/questionario.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Em `src/types/ficha.ts`:

```ts
/** Quanto o corpo sofre. Três degraus e só: mais que isso e ninguém sabe a
 *  diferença entre o segundo e o terceiro. */
export const esforcoSchema = z.enum(["leve", "media", "puxada"]);
export type Esforco = z.infer<typeof esforcoSchema>;
```

E dentro do `fichaSchema`:

```ts
  // Opcionais porque são FATO DE ROTEIRO — quem responde é quem conhece o
  // lugar, não quem escreve o código. A ficha que existe hoje não os tem, e
  // obrigatórios eles derrubariam o carregamento dela.
  esforco: esforcoSchema.optional(),
  // Minutos, não texto: é o filtro que compara. `duracao: "1h30"` obrigaria a
  // interpretar português na hora de decidir se cabe numa manhã.
  duracao: z.number().int().positive().optional(),
```

Em `docs/questionario-ficha.md`, acrescente duas seções no mesmo tom das existentes (uma pergunta por campo, linguagem de gente), posicionadas depois de `## O acesso — acesso`:

- `## Quão puxada é — esforco` — explica os três degraus com um exemplo concreto de cada, e diz que **pular a pergunta é permitido**: sem resposta, a trilha simplesmente nunca é escondida por esse filtro.
- `## Quanto tempo leva — duracao` — pede **em minutos** (com exemplos: "1h30 → 90"), esclarece que é o tempo do trajeto em si, e também permite pular.

Atualize a seção `## O que acontece depois de responder` mencionando os dois campos novos.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/ficha.test.ts tests/lib/questionario.test.ts`
Expected: PASS

- [ ] **Step 5: USAR o artefato — a prova que os testes não dão**

Os dois defeitos do questionário original só apareceram porque alguém o **respondeu**. Faça o mesmo com as duas seções novas:

1. Responda as duas perguntas como se fosse o João, sobre um lugar inventado (é rascunho, não vai pro `content/`).
2. Monte o JSON a partir das suas respostas, do jeito que o documento manda.
3. Rode contra o schema: `npx tsx -e "import {fichaSchema} from './src/types/ficha'; fichaSchema.parse(require('./rascunho.json')); console.log('ok')"`.
4. **Se a resposta natural não produzir um JSON válido, o defeito é do questionário, não da resposta** — conserte o texto e repita.
5. Apague o rascunho. Cole no relatório o que você respondeu e o resultado.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/types/ficha.ts docs/questionario-ficha.md tests/lib/ficha.test.ts tests/lib/questionario.test.ts
git commit -m "feat(ficha): esforco e duracao opcionais, com as perguntas no questionario"
```

---

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

### Task 11: Filtro e agrupamento na MESMA passada

**Files:**
- Modify: `src/app/FolhaTrilhas.tsx`, `src/app/page.tsx`, `src/app/home.css`
- Test: `tests/app/FolhaTrilhas.test.tsx` (acrescentar)

**ESTA É A TASK DE MAIOR RISCO DA RODADA.** O Critical da rodada passada nasceu exatamente aqui: agrupar num lugar e repintar em outro. Filtro e agrupamento **têm que ser calculados na mesma passada, no mesmo componente, a partir da mesma leitura**. A `FolhaTrilhas` também passa a ser quem informa `visiveis` pro `PainelFiltros` — a contagem da linha e a lista na tela não podem sair de duas contas diferentes.

- [ ] **Step 1: Write the failing test**

```tsx
// acrescentar a tests/app/FolhaTrilhas.test.tsx
import FiltrosVivos from "@/app/filtros";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";

describe("filtro e agrupamento juntos", () => {
  afterEach(() => { localStorage.clear(); });

  const par = (slug: string, estado: "fresco" | "frio", over = {}) => ({
    ficha: { ...fichaFake(slug), ...over },
    leitura: { estado, erro: false, calculadoEm: agoraSeg() },
  });

  const monta = (pares: ParFolha[]) =>
    render(<LocalVivo><FiltrosVivos><FolhaTrilhas pares={pares} /></FiltrosVivos></LocalVivo>);

  it("sem filtro, a folha é a de hoje: agrupada e completa", () => {
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    expect(container.textContent).toContain("Hoje o tempo deixa");
    expect(container.textContent).toContain("Hoje não");
    expect(container.querySelectorAll(".cartao")).toHaveLength(2);
  });

  it('"dá hoje" tira as que não dão', async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
  });

  // O cabeçalho é uma AFIRMAÇÃO sobre o que está embaixo dele. Sobrando nada
  // embaixo, ele mente. Primo direto do Critical da rodada passada.
  it("grupo esvaziado pelo filtro perde o cabeçalho", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.textContent).not.toContain("Hoje não"));
    expect(container.textContent).toContain("Hoje o tempo deixa");
  });

  it("filtro que zera a lista mostra o aviso e o jeito de limpar", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  it("limpar traz tudo de volta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    const b = await screen.findByRole("button", { name: /limpar/i });
    await act(async () => { b.click(); });
    expect(container.querySelectorAll(".cartao")).toHaveLength(1);
  });

  // A regra que já existe e não pode ser quebrada por esta task.
  it("sem leitura confiável, continua sem cabeçalho — e o filtro 'dá hoje' fica inerte", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(2));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // A contagem da linha e a lista na tela SÃO a mesma conta. Se saírem de
  // dois lugares, a linha diz "4 trilhas" com 2 na tela — a mesma família do
  // cabeçalho verde sobre cartão vermelho.
  it("a contagem da linha bate com os cartões desenhados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio"), par("c", "frio")]);
    await waitFor(() => {
      const n = container.querySelectorAll(".cartao").length;
      expect(container.textContent).toContain(n === 1 ? "1 trilha" : `${n} trilhas`);
    });
  });
});
```

Se `fichaFake` / `agoraSeg` ainda não existirem em `tests/app/FolhaTrilhas.test.tsx`, copie `fichaFake` de `tests/app/home.test.tsx` e defina `const agoraSeg = () => Math.floor(Date.now() / 1000)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/FolhaTrilhas.test.tsx`
Expected: FAIL — a folha ainda não filtra

- [ ] **Step 3: Implement**

Em `src/app/FolhaTrilhas.tsx`, depois de calcular `confia` (que já existe), **na mesma passada**:

```tsx
const filtros = useFiltros();
const mexer = useMexerFiltros();
const voce = coordDe(useLocal());

// Filtro e agrupamento saem da MESMA leitura, no MESMO componente. Separá-los
// em duas etapas em dois lugares é exatamente como nasceu o Critical da
// rodada passada: o servidor agrupava, o cliente repintava, e o cabeçalho
// afirmava o contrário do cartão embaixo dele.
const visiveis = pares.filter((p) =>
  passaNoFiltro({ ficha: p.ficha, leitura: atual(p), filtros, voce, confia }),
);
```

Daí pra frente, **toda** a montagem usa `visiveis` no lugar de `pares` — inclusive o ramo `!confia`. E acrescente, antes dos grupos:

```tsx
if (visiveis.length === 0) {
  return (
    <div className="folha-vazia">
      <p>Nenhuma trilha com esses filtros</p>
      <button className="chip" onClick={() => mexer(SEM_FILTRO)}>limpar filtros</button>
    </div>
  );
}
```

A função `grupo()` já devolve `null` pra lista vazia — é o que faz o cabeçalho sumir junto com o grupo esvaziado. **Confirme isso no código em vez de assumir**, e deixe um comentário apontando o teste que prova.

Em `src/app/page.tsx`: mova o `<PainelFiltros />` pra dentro do fluxo entre o mapa e a folha, e faça a `FolhaTrilhas` renderizá-lo com a contagem — ou eleve o cálculo pra um componente único que renderiza os dois. **O que não pode é a contagem sair de outra conta.** Registre no relatório qual das duas formas você escolheu e por quê.

Em `src/app/home.css`, acrescente `.folha-vazia` (centralizado, `color: var(--ink-faint)`, respiro vertical).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/FolhaTrilhas.test.tsx tests/app/home.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

Faça o ramo `!confia` voltar a usar `pares` em vez de `visiveis` e confirme que algum teste falha. Se **nenhum** falhar, o teste está fraco — escreva o que falta antes de seguir. Cole a saída.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/FolhaTrilhas.tsx src/app/page.tsx src/app/home.css tests/app/FolhaTrilhas.test.tsx
git commit -m "feat(folha): filtro e agrupamento na mesma passada, com estado vazio"
```

---

### Task 12: A barra fixa no rodapé

**Files:**
- Modify: `src/app/home.css`, `src/app/trilhas/page.tsx` (se precisar de respiro próprio)
- Test: `tests/app/BarraNavegacao.test.tsx` (acrescentar)

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar a tests/app/BarraNavegacao.test.tsx
import { readFileSync } from "node:fs";
import path from "node:path";

const css = () => readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");

describe("a barra fica presa no rodapé", () => {
  it("é fixa, não rola junto com a lista", () => {
    const regra = css().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .barra").not.toBeNull();
    expect(regra![0]).toMatch(/position:\s*fixed/);
    expect(regra![0]).toMatch(/bottom:\s*0/);
  });

  // Sem isso, em tela cheia a barra nasce debaixo da faixa do gesto do iPhone
  // e os rótulos ficam intocáveis. Já valia antes de ser fixa; vale mais agora.
  it("soma a área segura do iPhone", () => {
    const regra = css().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra![0]).toContain("env(safe-area-inset-bottom)");
  });

  // Barra fixa flutua sobre o conteúdo: sem respiro, o último cartão nasce
  // atrás dela e a pessoa nunca vê a última trilha da lista.
  it("a folha reserva o espaço da barra embaixo", () => {
    const regra = css().match(/\.bp \.folha\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .folha").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });

  it("a lista do acervo reserva o mesmo espaço", () => {
    const regra = css().match(/\.bp \.lista\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .lista").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/BarraNavegacao.test.tsx`
Expected: FAIL — a barra não é `fixed`

- [ ] **Step 3: Implement**

Em `src/app/home.css`, substitua a regra `.bp .barra` por:

```css
/* A altura da barra em um lugar só: quem a reserva embaixo (a folha, a lista)
   lê daqui. Dois números soltos discordariam no dia em que um mudasse. */
.bp { --barra-h: 62px; }

/* Fixa no rodapé, não em fluxo. Em fluxo ela só PARECE estar no fim quando o
   documento cabe na tela — com seis cartões ela desce junto com a lista, que
   foi o que o João viu e apontou.
   O padding-bottom soma a área segura do iPhone: sem isso, em tela cheia, a
   barra nasce debaixo da faixa do gesto e os rótulos ficam intocáveis. */
.bp .barra {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
  display: flex;
  border-top: 1px solid var(--line);
  background: var(--screen);
  padding-bottom: env(safe-area-inset-bottom);
}
```

E acrescente o respiro em quem rola por baixo dela:

```css
/* Barra fixa flutua sobre o conteúdo: sem este respiro o último cartão nasce
   atrás dela. Soma a área segura pelo mesmo motivo da barra. */
.bp .folha { padding-bottom: calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); }
.bp .lista { padding-bottom: calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); }
```

(ajuste as regras existentes de `.folha` e `.lista` em vez de duplicá-las)

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/BarraNavegacao.test.tsx tests/app/trilhas.test.tsx`
Expected: PASS

- [ ] **Step 5: MEDIR NO NAVEGADOR — jsdom não mede geometria**

Nenhum teste desta suíte mede pixel renderizado. Rode `npm run dev`, abra em 375×667 emulando iPhone e **meça**:

1. Com uma ficha: a barra está no rodapé da JANELA, e não logo abaixo do último cartão?
2. Role até o fim: o último cartão fica **inteiramente** visível acima da barra?
3. Abra o painel de filtros: a lista foi **empurrada** pra baixo (não coberta)?
4. `document.querySelector('.cartao').getBoundingClientRect().top` — **anote o número** e confirme que é ≤ 320.

**Cole os quatro resultados no relatório, com os números.** "Parece certo" não é resposta; "não medi" é.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/home.css tests/app/BarraNavegacao.test.tsx
git commit -m "fix(barra): presa no rodape, com respiro reservado na folha e no acervo"
```

---

## Depois das 12 tasks

1. **`npm test`** — a suíte inteira. Base: 278 + os novos.
2. **`npx tsc --noEmit`** e **`npm run build`** — os dois limpos.
3. **Revisão da branch inteira**, obrigatória. Em **três** rodadas seguidas ela achou defeito que nenhuma revisão de task pegou. As duas junções a atacar primeiro:
   - **filtro × agrupamento** (Tasks 9–11): o cabeçalho pode afirmar o que a lista filtrada não sustenta?
   - **localização × enquadramento** (Tasks 2–4): a localização chega depois do primeiro paint; alguma coisa lê ela durante o render?
   - E a terceira, que só aparece na branch inteira: **a mesma trilha mostra o mesmo km no cartão e na ficha?**
4. **Perguntar ao João** o esforço e a duração da Rampa; com a resposta, preencher `content/fichas/rampa-do-pepe.json` num commit próprio.
5. **iPhone**, e é dele: as quatro perguntas da §15 da spec.
6. Atualizar `docs/RESUME.md`.

## Self-review deste plano

**Cobertura da spec:** §5 → Tasks 1, 2; §5.4 → Task 7; §6 → Tasks 3, 4; §7 → Tasks 9, 10, 11; §8 → Task 7; §9 → Task 8; §10 → Tasks 5, 6; §11 → Task 12; §12 → Task 10; §13 → Global Constraints; §14 → passos de mutação e medição em cada task; §15 → Task 12 passo 5 e o fechamento.

**Ponto que o plano deixa em aberto de propósito:** a Task 11 permite duas formas de ligar a contagem da linha à lista filtrada (elevar o cálculo, ou a folha renderizar o painel). Quem implementa escolhe e **justifica no relatório** — o que o plano crava é a proibição de duas contas.
