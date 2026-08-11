# Carimbo busca leitura nova — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando a tela volta e a leitura de chuva está velha, o carimbo busca uma nova em vez de só se declarar ignorante — e um toque pede outra tentativa.

**Architecture:** Uma rota `GET /api/carimbo?slug=` devolve o mesmo trio `{estado, erro, calculadoEm}` que a página já entrega ao componente, calculado pela **mesma** função (`resolverEstado`, extraída da página pra `src/lib/carimbo-estado.ts`). O componente `Carimbo` passa a ter a leitura como estado próprio, iniciado pelas props do servidor — o primeiro paint continua server-rendered, sem JS. A lógica de "que fase mostrar" e "vale buscar agora?" mora numa lib pura (`src/lib/carimbo-fase.ts`), no mesmo padrão de `cache-rotas.ts`/`sw.ts`: o difícil é testável sem DOM, o componente fica fino.

**Tech Stack:** Next.js 15 App Router (server components + `force-dynamic`), React 19, TypeScript, Vitest + Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-08-10-carimbo-leitura-nova-design.md`

## Global Constraints

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** `Carimbo.tsx` é client component, mas client components são SSR-ados. O JS só corrige depois. Todo estado inicial tem que fazer o HTML do servidor e o primeiro render do cliente concordarem — é por isso que `useState(false)` do `venceu` é deliberado, e é por isso que a leitura inicial é exatamente a prop.
- **`export const dynamic = "force-dynamic"` não sai de `src/app/[slug]/page.tsx`.** Se a página virar estática, `calculadoEm` congela no build e todo visitante recebe carimbo vencido.
- **Toda rota que lê ficha declara `content/**` em `outputFileTracingIncludes` (`next.config.mjs`).** `tests/deploy/tracing.test.ts` é o cadeado e quebra o build se esquecer.
- **Sem `next/link` em lugar nenhum** — âncora pura. Não existe navegação soft neste app.
- **Um atributo só pra fase.** O componente expõe `data-fase="afirmando|conferindo|sem-informacoes"` e **mais nenhum**. O `data-venceu` e o `data-sem-leitura` de hoje saem: dois atributos codificando o mesmo fato foi exatamente o que deixou o pulso piscando ao lado de "sem leitura" (`d5d8987`).
- **Textos exatos, copiados do spec** (`.mark` já é `text-transform: uppercase` no CSS; as maiúsculas na fonte são pra as duas fases sem leitura saltarem à vista de quem lê o arquivo):
  - sem informação: marca `SEM INFORMAÇÕES`, sub `tome cuidado`
  - conferindo: marca `CONFERINDO…` (reticências no caractere único `…`), sub `lendo a chuva agora`
  - afirmando: marca `Pode subir` / `Não suba`, sub `seco · carro comum` / `barro · dá um tempo`
- **Prazos:** `PRAZO_CONFERINDO_MS = 3000`, `PISO_AUTO_MS = 30_000`. `VALIDADE_S = 30 * 60` já existe em `src/lib/validade.ts` e não muda.
- **Comentários em português**, explicando *por que*, no tom do código existente.
- Rodar `npm test --silent` antes de cada commit. Estado inicial: **145/145** na branch `carimbo-na-retomada`.

---

### Task 1: `resolverEstado` vira lib compartilhada

Hoje `resolverEstado` mora dentro de `src/app/[slug]/page.tsx` e não tem teste. A rota da Task 2 precisa da mesma função — duas fontes pro mesmo carimbo seria a semente de duas respostas diferentes pro mesmo morro.

**Files:**
- Create: `src/lib/carimbo-estado.ts`
- Create: `tests/lib/carimbo-estado.test.ts`
- Modify: `src/app/[slug]/page.tsx`

**Interfaces:**
- Consumes: `avaliar`, `Estado` de `@/lib/motor`; `fetchPrecip` de `@/lib/weather`; `Ficha` de `@/types/ficha`.
- Produces: `type LeituraCarimbo = { estado: Estado; erro: boolean; calculadoEm: number }` e `resolverEstado(ficha: Ficha, debug?: string): Promise<LeituraCarimbo>`. Tasks 2, 4 e 5 dependem desses nomes.

- [ ] **Step 1: Write the failing test**

Criar `tests/lib/carimbo-estado.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);
const H = 3600;

vi.mock("@/lib/weather", () => ({ fetchPrecip: vi.fn() }));
const { fetchPrecip } = await import("@/lib/weather");

function ficha() {
  const f = getFicha("rampa-do-pepe");
  if (!f) throw new Error("a ficha da Rampa sumiu do content/");
  return f;
}

/** Série horária cobrindo a janela inteira, com o mesmo mm em toda hora. */
function chuvaConstante(mm: number) {
  const precips = [];
  for (let i = -24; i <= 24; i++) precips.push({ time: AGORA_S + i * H, mm });
  return { precips, raw: { hourly: { time: [], precipitation: [] } } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { vi.useRealTimers(); vi.mocked(fetchPrecip).mockReset(); });

describe("resolverEstado", () => {
  it("sem chuva na janela, a serra está fresca", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(0));
    expect(await resolverEstado(ficha())).toEqual({
      estado: "fresco", erro: false, calculadoEm: AGORA_S,
    });
  });

  it("chovendo, o barro segura água", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(5));
    const r = await resolverEstado(ficha());
    expect(r.estado).toBe("frio");
    expect(r.erro).toBe(false);
  });

  it("Open-Meteo fora do ar cai pro lado seguro E admite que não leu", async () => {
    // Os dois juntos são o ponto: 'frio' sem 'erro' seria o app afirmando
    // barro que ele não mediu.
    vi.mocked(fetchPrecip).mockRejectedValue(new Error("503"));
    expect(await resolverEstado(ficha())).toEqual({
      estado: "frio", erro: true, calculadoEm: AGORA_S,
    });
  });

  it("o debug da URL curto-circuita sem tocar a rede", async () => {
    expect((await resolverEstado(ficha(), "fresco")).estado).toBe("fresco");
    expect((await resolverEstado(ficha(), "frio")).estado).toBe("frio");
    expect(fetchPrecip).not.toHaveBeenCalled();
  });

  it("debug inventado é ignorado — só 'fresco' e 'frio' valem", async () => {
    vi.mocked(fetchPrecip).mockResolvedValue(chuvaConstante(0));
    expect((await resolverEstado(ficha(), "nublado")).estado).toBe("fresco");
    expect(fetchPrecip).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/carimbo-estado.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/carimbo-estado"`.

- [ ] **Step 3: Write the implementation**

Criar `src/lib/carimbo-estado.ts`:

```ts
import type { Ficha } from "@/types/ficha";
import { avaliar, type Estado } from "@/lib/motor";
import { fetchPrecip } from "@/lib/weather";

/** O trio que descreve um carimbo. A página entrega isto ao componente; a rota
 *  /api/carimbo devolve isto no corpo. Mesmo formato de propósito: são a mesma
 *  informação chegando por dois caminhos. */
export type LeituraCarimbo = { estado: Estado; erro: boolean; calculadoEm: number };

/** Lê a chuva de agora e decide. Mora aqui, e não dentro da página, porque a
 *  rota precisa da MESMA função: duas fontes pro mesmo carimbo seriam a semente
 *  de duas respostas diferentes pro mesmo morro. */
export async function resolverEstado(ficha: Ficha, debug?: string): Promise<LeituraCarimbo> {
  const agora = Math.floor(Date.now() / 1000);
  if (debug === "fresco" || debug === "frio") return { estado: debug, erro: false, calculadoEm: agora };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    return { estado: avaliar(regra, precips, agora), erro: false, calculadoEm: agora };
  } catch {
    // Sem leitura de chuva → lado seguro, e diz a verdade (não finge verde).
    return { estado: "frio", erro: true, calculadoEm: agora };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/carimbo-estado.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Trocar a página pra usar a lib**

Em `src/app/[slug]/page.tsx`:

1. Apagar o `type Render` e a função `resolverEstado` inteira (hoje linhas 15–31).
2. Remover os imports que ficaram órfãos — `import { fetchPrecip } from "@/lib/weather";` e `import { avaliar, type Estado } from "@/lib/motor";` — e acrescentar:

```tsx
import { resolverEstado } from "@/lib/carimbo-estado";
```

3. Trocar a desestruturação e os três usos de `state` por `estado`:

```tsx
  const { debug } = await searchParams;
  const { estado, erro, calculadoEm } = await resolverEstado(ficha, debug);
```

```tsx
    <main className="bp" data-state={estado}>
```

```tsx
          <Carimbo estado={estado} erro={erro} calculadoEm={calculadoEm} pass={pass} fut={fut} />
```

```tsx
                <MapaEstatico lat={wp.lat} lng={wp.lng} nome={wp.nome} estado={estado} />
```

**O atributo do DOM continua `data-state`** — o `ficha.css` seleciona por ele (`.bp[data-state="fresco"] .stamp`). Só o nome da variável muda.

- [ ] **Step 6: Rodar a suíte inteira e o build**

Run: `npm test --silent` → Expected: PASS, **150/150**.
Run: `npm run build` → Expected: `✓ Compiled successfully` e `/[slug]` listado como `ƒ (Dynamic)`. Se aparecer `○ (Static)`, o `force-dynamic` se perdeu — pare e conserte antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add src/lib/carimbo-estado.ts tests/lib/carimbo-estado.test.ts "src/app/[slug]/page.tsx"
git commit -m "refactor(carimbo): resolverEstado vira lib, com teste próprio"
```

---

### Task 2: A rota `/api/carimbo`

**Files:**
- Create: `src/app/api/carimbo/route.ts`
- Create: `tests/api/route-carimbo.test.ts`
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: `resolverEstado`, `LeituraCarimbo` da Task 1; `getFicha` de `@/lib/ficha`.
- Produces: `GET /api/carimbo?slug=<slug>` → `200` com corpo `LeituraCarimbo` e cabeçalho `cache-control: no-store`; `404` com `{"erro":"ficha não encontrada"}`. A Task 5 consome esta URL.

- [ ] **Step 1: Write the failing test**

Criar `tests/api/route-carimbo.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 0);
const AGORA_S = Math.floor(AGORA_MS / 1000);

vi.mock("@/lib/carimbo-estado", () => ({ resolverEstado: vi.fn() }));
const { resolverEstado } = await import("@/lib/carimbo-estado");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA_MS);
  vi.mocked(resolverEstado).mockResolvedValue({
    estado: "fresco", erro: false, calculadoEm: AGORA_S,
  });
});
afterEach(() => { vi.useRealTimers(); vi.mocked(resolverEstado).mockReset(); });

describe("route /api/carimbo", () => {
  it("devolve o trio da leitura", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estado: "fresco", erro: false, calculadoEm: AGORA_S });
  });

  it("nunca é guardada — leitura de chuva vinda de cache é leitura mentirosa", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("slug que não existe → 404, e não inventa leitura", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=morro-inventado"));
    expect(res.status).toBe(404);
    expect(resolverEstado).not.toHaveBeenCalled();
  });

  it("sem slug → 404", async () => {
    const { GET } = await import("@/app/api/carimbo/route");
    expect((await GET(new Request("http://x/api/carimbo"))).status).toBe(404);
  });

  it("falha na leitura NÃO vira 5xx — 'não consegui ler' é resposta do domínio", async () => {
    // O cliente precisa distinguir 'não consegui ler a chuva' de 'a requisição
    // nem chegou'. As duas coisas viram telas diferentes.
    vi.mocked(resolverEstado).mockResolvedValue({
      estado: "frio", erro: true, calculadoEm: AGORA_S,
    });
    const { GET } = await import("@/app/api/carimbo/route");
    const res = await GET(new Request("http://x/api/carimbo?slug=rampa-do-pepe"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ erro: true, estado: "frio" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/route-carimbo.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/carimbo/route"`.

- [ ] **Step 3: Write the implementation**

Criar `src/app/api/carimbo/route.ts`:

```ts
import { getFicha } from "@/lib/ficha";
import { resolverEstado } from "@/lib/carimbo-estado";

export const dynamic = "force-dynamic";

/** A leitura de agora, sozinha, pra quem já tem a ficha na tela.
 *
 *  Existe porque o carimbo apodrece e o resto da ficha não: quando você volta
 *  pro app no portão, é isto que busca a resposta de agora em vez de o app dar
 *  de ombros. Só-clima — não toca o banco, igual à página. */
export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  const ficha = slug ? getFicha(slug) : null;
  if (!ficha) return Response.json({ erro: "ficha não encontrada" }, { status: 404 });

  // no-store explícito: o service worker já trata /api/* como NetworkOnly, mas
  // ele não é o único cache no caminho (navegador, CDN). Leitura de chuva
  // guardada é leitura mentirosa.
  return Response.json(await resolverEstado(ficha), {
    headers: { "cache-control": "no-store" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/route-carimbo.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Ver o cadeado do tracing pegar a rota nova**

Run: `npx vitest run tests/deploy/tracing.test.ts`
Expected: **FAIL**, com a mensagem dizendo que `/api/carimbo` lê ficha por fs e precisa estar em `outputFileTracingIncludes`. Este teste falhando aqui é o cadeado funcionando; se ele passar, algo está errado nele.

- [ ] **Step 6: Declarar a rota no tracing**

Em `next.config.mjs`, dentro de `outputFileTracingIncludes`, na linha seguinte à de `/api/confirmar`:

```js
    "/api/carimbo": ["./content/**/*"],
```

- [ ] **Step 7: Rodar a suíte inteira e o build**

Run: `npm test --silent` → Expected: PASS, **155/155**.
Run: `npm run build` → Expected: `✓ Compiled successfully`, com `/api/carimbo` na lista de rotas como `ƒ`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/carimbo/route.ts tests/api/route-carimbo.test.ts next.config.mjs
git commit -m "feat(api): rota /api/carimbo devolve a leitura de agora"
```

---

### Task 3: A lib pura das fases e dos gatilhos

O difícil desta rodada não é buscar — é *quando* buscar e *o que mostrar*. Isso vira função pura, testável sem DOM, no mesmo padrão de `cache-rotas.ts` (lógica) / `sw.ts` (casca fina).

**Files:**
- Create: `src/lib/carimbo-fase.ts`
- Create: `tests/lib/carimbo-fase.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type Fase`, `type Sintoma`, `type Situacao`, `type Gatilho`, `faseDe`, `sintomaDe`, `podeBuscar`, `PRAZO_CONFERINDO_MS`, `PISO_AUTO_MS`. Tasks 4 e 5 consomem tudo isso.

- [ ] **Step 1: Write the failing test**

Criar `tests/lib/carimbo-fase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PISO_AUTO_MS,
  PRAZO_CONFERINDO_MS,
  faseDe,
  podeBuscar,
  sintomaDe,
} from "@/lib/carimbo-fase";

const OK = { conferindo: false, erro: false, venceu: false, falhou: false };

describe("faseDe", () => {
  it("leitura boa, o carimbo afirma", () => {
    expect(faseDe(OK)).toBe("afirmando");
  });

  it("conferindo ganha de tudo — é o que está acontecendo agora", () => {
    expect(faseDe({ conferindo: true, erro: true, venceu: true, falhou: true }))
      .toBe("conferindo");
  });

  it("erro, vencido e falha caem todos na mesma fase", () => {
    expect(faseDe({ ...OK, erro: true })).toBe("sem-informacoes");
    expect(faseDe({ ...OK, venceu: true })).toBe("sem-informacoes");
    expect(faseDe({ ...OK, falhou: true })).toBe("sem-informacoes");
  });
});

describe("sintomaDe", () => {
  it("a falha da busca é a notícia mais recente, então ela manda", () => {
    expect(sintomaDe({ ...OK, falhou: true, erro: true, venceu: true })).toBe("falhou");
  });

  it("sem falha, o erro do servidor ganha do vencimento", () => {
    // Não houve leitura nenhuma: não há hora pra citar, então não se cita.
    expect(sintomaDe({ ...OK, erro: true, venceu: true })).toBe("erro");
  });

  it("só vencido, o sintoma é o vencimento", () => {
    expect(sintomaDe({ ...OK, venceu: true })).toBe("venceu");
  });

  it("leitura boa não tem sintoma", () => {
    expect(sintomaDe(OK)).toBe(null);
  });
});

describe("podeBuscar", () => {
  const base = { erro: false, venceu: false, conferindo: false, desdeUltimaMs: Infinity };

  it("o toque sempre busca, mesmo com leitura boa na tela", () => {
    expect(podeBuscar("toque", base)).toBe(true);
  });

  it("o toque atravessa o piso de 30s — quem tocou está pedindo", () => {
    expect(podeBuscar("toque", { ...base, desdeUltimaMs: 1_000 })).toBe(true);
  });

  it("carregar só busca se a leitura já está vencida", () => {
    expect(podeBuscar("carregou", { ...base, venceu: true })).toBe(true);
    expect(podeBuscar("carregou", base)).toBe(false);
  });

  it("carregar NÃO retenta o erro do servidor", () => {
    // A página acabou de tentar, do servidor, milissegundos atrás. Repetir da
    // mão do usuário trocaria a mensagem honesta por 3s de "Conferindo…" em
    // todo carregamento enquanto o Open-Meteo estivesse fora do ar.
    expect(podeBuscar("carregou", { ...base, erro: true })).toBe(false);
  });

  it("voltar à tela retenta o erro — o tempo passou", () => {
    expect(podeBuscar("voltou", { ...base, erro: true })).toBe(true);
    expect(podeBuscar("voltou", { ...base, venceu: true })).toBe(true);
  });

  it("voltar com leitura boa não gasta rede", () => {
    expect(podeBuscar("voltou", base)).toBe(false);
  });

  it("o piso de 30s segura o gatilho automático", () => {
    expect(podeBuscar("voltou", { ...base, venceu: true, desdeUltimaMs: 5_000 })).toBe(false);
    expect(podeBuscar("voltou", { ...base, venceu: true, desdeUltimaMs: 31_000 })).toBe(true);
  });

  it("busca em andamento barra qualquer gatilho, inclusive o toque", () => {
    expect(podeBuscar("toque", { ...base, conferindo: true })).toBe(false);
    expect(podeBuscar("voltou", { ...base, venceu: true, conferindo: true })).toBe(false);
  });
});

describe("prazos", () => {
  it("o 'Conferindo…' sai da tela em 3s, bem antes dos 6s do service worker", () => {
    // Lá a tela está em branco; aqui ela já tem conteúdo, e o que está em jogo
    // é por quanto tempo o app fica sem afirmar nada — na hora da decisão.
    expect(PRAZO_CONFERINDO_MS).toBe(3_000);
  });

  it("o piso entre buscas automáticas é de 30s", () => {
    expect(PISO_AUTO_MS).toBe(30_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/carimbo-fase.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/carimbo-fase"`.

- [ ] **Step 3: Write the implementation**

Criar `src/lib/carimbo-fase.ts`:

```ts
/** Quanto tempo o "Conferindo…" pode ficar na tela.
 *
 *  Três segundos, e não os seis do service worker, porque os contextos são
 *  opostos: lá é o que se espera antes de servir uma cópia guardada, com a tela
 *  em branco; aqui a tela já tem conteúdo, e o que está em jogo é por quanto
 *  tempo o app fica sem afirmar nada — bem na hora da decisão.
 *
 *  Estourar não cancela a busca: a resposta que chega depois ainda repinta. */
export const PRAZO_CONFERINDO_MS = 3_000;

/** Piso entre duas buscas automáticas. Sem ele, alternar de app dez vezes vira
 *  dez chamadas. O toque não obedece a este piso — quem tocou está pedindo. */
export const PISO_AUTO_MS = 30_000;

/** O que o carimbo está mostrando agora. */
export type Fase = "afirmando" | "conferindo" | "sem-informacoes";

/** Por que não há leitura. Vira o texto do motivo; `null` quando há leitura. */
export type Sintoma = "falhou" | "erro" | "venceu" | null;

export type Situacao = {
  /** Há uma busca em andamento e ainda dentro do prazo de tela. */
  conferindo: boolean;
  /** O servidor não conseguiu ler a chuva quando montou esta leitura. */
  erro: boolean;
  /** A leitura na tela passou dos 30 minutos. */
  venceu: boolean;
  /** A última busca estourou o prazo de tela ou falhou de vez. */
  falhou: boolean;
};

export function faseDe({ conferindo, erro, venceu, falhou }: Situacao): Fase {
  if (conferindo) return "conferindo";
  return erro || venceu || falhou ? "sem-informacoes" : "afirmando";
}

/** Qual dos motivos contar. A ordem é cronológica ao contrário: a notícia mais
 *  recente é a que explica a tela. E `erro` ganha de `venceu` porque, sem
 *  leitura nenhuma, não existe hora de leitura pra citar. */
export function sintomaDe({ erro, venceu, falhou }: Situacao): Sintoma {
  if (falhou) return "falhou";
  if (erro) return "erro";
  if (venceu) return "venceu";
  return null;
}

export type Gatilho = "carregou" | "voltou" | "toque";

/** Vale buscar agora?
 *
 *  `carregou` não retenta o erro do servidor de propósito: a página acabou de
 *  tentar, do servidor, milissegundos atrás. E página recém-renderizada nunca
 *  está vencida — `calculadoEm` é agora —, então na prática este gatilho só
 *  dispara pra página vinda do cache do service worker, que é exatamente onde
 *  buscar é o certo. */
export function podeBuscar(
  gatilho: Gatilho,
  { erro, venceu, conferindo, desdeUltimaMs }: Omit<Situacao, "falhou"> & { desdeUltimaMs: number },
): boolean {
  if (conferindo) return false;
  if (gatilho === "toque") return true;
  if (desdeUltimaMs < PISO_AUTO_MS) return false;
  return gatilho === "voltou" ? erro || venceu : venceu;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/carimbo-fase.test.ts`
Expected: PASS (16 testes).
Run: `npm test --silent` → Expected: PASS, **171/171**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carimbo-fase.ts tests/lib/carimbo-fase.test.ts
git commit -m "feat(carimbo): lib pura das fases e dos gatilhos de busca"
```

---

### Task 4: As três fases na tela

Ainda sem buscar nada: `conferindo` e `falhou` entram como constantes `false`, e a Task 5 as transforma em estado. Esta task fica revisável sozinha — é a mudança de texto e de postura que o João aprovou, mais a troca de dois atributos por um.

**Files:**
- Modify: `src/app/Carimbo.tsx` (substituição integral)
- Modify: `src/app/ficha.css`
- Modify: `src/app/[slug]/page.tsx` (passa `slug`)
- Modify: `tests/app/Carimbo.test.tsx`

**Interfaces:**
- Consumes: `Fase`, `Sintoma`, `faseDe`, `sintomaDe` da Task 3; `carimboVenceu`, `horaCurtaRecife` de `@/lib/validade`.
- Produces: `Carimbo` passa a exigir a prop `slug: string` (usada só na Task 5, mas entra agora pra a página não mudar duas vezes) e a expor `data-fase`. `data-venceu` e `data-sem-leitura` deixam de existir.

- [ ] **Step 1: Atualizar os testes que cravam os textos e os atributos antigos**

Em `tests/app/Carimbo.test.tsx`. **Atenção:** `"Não suba"` continua existindo pro barro medido — só troque onde ele significava *ausência* de leitura.

Acrescentar `slug` ao utilitário de montagem:

```tsx
type Props = { estado: "fresco" | "frio"; erro: boolean; calculadoEm: number; pass: number; fut: number; slug: string };

function montar(props: Partial<Props> = {}) {
  return render(
    <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} slug="rampa-do-pepe" {...props} />,
  );
}
```

Substituir estes cinco testes:

```tsx
  it("leitura vencida para de afirmar e devolve a decisão pra você", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector(".sub")?.textContent).toBe("tome cuidado");
  });

  it("vencida, marca a fase pro CSS pintar de parada mesmo com estado fresco", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".decision")?.getAttribute("data-fase")).toBe("sem-informacoes");
  });

  it("volta do bolso já vencido, sem esperar o intervalo de 60s", () => {
    // O celular passou 4h no bolso. O relógio andou; o setInterval não — o
    // navegador estrangula timer de aba escondida.
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("volta do cache do navegador (pageshow) também reavalia", () => {
    const { container } = montar({ calculadoEm: AGORA_S });
    vi.setSystemTime(AGORA_MS + 4 * 60 * 60 * 1000);
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
  });

  it("sem leitura, marca a fase pro CSS parar o pulso", () => {
    const semLeitura = montar({ estado: "frio", erro: true });
    expect(semLeitura.container.querySelector(".decision")?.getAttribute("data-fase")).toBe("sem-informacoes");
    cleanup();
    expect(montar().container.querySelector(".decision")?.getAttribute("data-fase")).toBe("afirmando");
  });
```

Trocar as duas asserções do `.live` no teste `"sem leitura e ainda no prazo…"`:

```tsx
    expect(live).not.toContain("lido da chuva");
    expect(live).toContain("toque pra conferir");
```

Trocar o regex do teste do CSS (o par agora é `data-fase`):

```tsx
    expect(css).toMatch(/\[data-fase="sem-informacoes"\][^{]*\.pulse\s*\{[^}]*animation:\s*none/);
```

Acrescentar dois testes novos:

```tsx
  it("sem informação, o carimbo é botão de verdade", () => {
    // Alvo do tamanho do bloco, que a mão suja acerta — e <button> em vez de
    // div com clique dá teclado e leitor de tela sem código extra.
    const { container } = montar({ estado: "frio", erro: true });
    const bloco = container.querySelector(".decision");
    expect(bloco?.tagName).toBe("BUTTON");
    expect(bloco?.getAttribute("type")).toBe("button");
  });

  it("com leitura boa não há botão nenhum", () => {
    // Botão que não serve pra nada é ruído no meio da decisão.
    expect(montar().container.querySelector(".decision")?.tagName).toBe("DIV");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/Carimbo.test.tsx`
Expected: FAIL — textos antigos, `data-fase` inexistente, `.decision` ainda é `DIV`.

- [ ] **Step 3: Substituir `src/app/Carimbo.tsx` inteiro**

```tsx
"use client";
import { useEffect, useState } from "react";
import type { Estado } from "@/lib/motor";
import { type Fase, type Sintoma, faseDe, sintomaDe } from "@/lib/carimbo-fase";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe e devolve a
 *  decisão. "Não suba" ficou reservado pro barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  pass,
  fut,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  pass: number;
  fut: number;
  slug: string;
}) {
  // Começa sempre válido pra o HTML do servidor e o do cliente baterem na
  // hidratação. Se já nasceu velho, o efeito corrige no mesmo instante.
  const [venceu, setVenceu] = useState(false);

  useEffect(() => {
    const checar = () => setVenceu(carimboVenceu(calculadoEm, Math.floor(Date.now() / 1000)));
    checar();

    // O intervalo é pra tela aberta na mão. Ele não basta: navegador estrangula
    // timer de aba escondida, e o celular passou as últimas quatro horas no
    // bolso. O instante que importa é quando a tela volta a ser olhada — que é
    // o instante do portão. `pageshow` vai junto porque restauração de bfcache
    // não dispara visibilitychange em todo navegador, e o service worker
    // tornou "página retomada do cache" o caso normal.
    const id = setInterval(checar, 60_000);
    document.addEventListener("visibilitychange", checar);
    window.addEventListener("pageshow", checar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", checar);
      window.removeEventListener("pageshow", checar);
    };
  }, [calculadoEm]);

  // `conferindo` e `falhou` entram como literais: nesta task ainda não existe
  // busca pra ligá-los. A Task 5 os troca por estado de verdade.
  const situacao = { conferindo: false, falhou: false, erro, venceu };
  const fase = faseDe(situacao);
  const sintoma = sintomaDe(situacao);

  const marca =
    fase === "conferindo" ? "CONFERINDO…"
    : fase === "sem-informacoes" ? "SEM INFORMAÇÕES"
    : estado === "frio" ? "Não suba"
    : "Pode subir";

  const sub =
    fase === "conferindo" ? "lendo a chuva agora"
    : fase === "sem-informacoes" ? "tome cuidado"
    : estado === "fresco" ? "seco · carro comum"
    : "barro · dá um tempo";

  const linhaViva =
    fase === "conferindo" ? "conferindo a chuva agora"
    : fase === "sem-informacoes" ? "toque pra conferir"
    : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`;

  const miolo = (
    <>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">{motivo(fase, sintoma, estado, calculadoEm, pass, fut)}</p>
      <div className="live">
        <span className="pulse"></span>
        <span>{linhaViva}</span>
      </div>
    </>
  );

  // Um atributo só. Dois codificando o mesmo fato foi o que deixou o pulso
  // piscando ao lado de "sem leitura" até hoje de manhã.
  const atributos = {
    className: "decision",
    role: "status" as const,
    "aria-live": "polite" as const,
    "data-fase": fase,
  };

  // Só vira botão quando tocar serve pra alguma coisa. A Task 5 liga o onClick.
  return fase === "sem-informacoes" ? (
    <button type="button" {...atributos}>{miolo}</button>
  ) : (
    <div {...atributos}>{miolo}</div>
  );
}

/** A frase que explica a marca. A hora só aparece quando existiu leitura: sem
 *  leitura nenhuma, não há hora pra citar. */
function motivo(
  fase: Fase,
  sintoma: Sintoma,
  estado: Estado,
  calculadoEm: number,
  pass: number,
  fut: number,
) {
  if (fase === "conferindo") {
    return sintoma === "venceu" ? (
      <>
        A leitura das <b>{horaCurtaRecife(calculadoEm)}</b> passou do prazo. Buscando a de agora.
      </>
    ) : (
      <>Buscando a leitura de agora.</>
    );
  }
  if (sintoma === "falhou") {
    return <>Não deu tempo de ler a chuva. Na dúvida, cheque o barro no portão.</>;
  }
  if (sintoma === "erro") {
    return <>Não deu pra ler a chuva agora. Na dúvida, cheque o barro no portão.</>;
  }
  if (sintoma === "venceu") {
    return (
      <>
        Essa leitura é das <b>{horaCurtaRecife(calculadoEm)}</b> e já passou do prazo. O barro muda
        rápido — cheque no portão antes de decidir.
      </>
    );
  }
  return estado === "fresco" ? (
    <>
      Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>. Área alta,
      escorre rápido — a serra firmou.
    </>
  ) : (
    <>
      Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>). O barro segura
      água — risco de atolar.
    </>
  );
}
```

- [ ] **Step 4: Trocar o CSS**

Em `src/app/ficha.css`, **substituir** o bloco de duas regras que hoje começa em `/* Carimbo vencido pinta de parada… */` (as duas regras com `[data-venceu="1"]` e a com `[data-sem-leitura="1"]`) por:

```css
/* Sem leitura pinta de parada mesmo numa página que abriu fresca: a cor tem
   que dizer a mesma coisa que a palavra. */
.bp .decision[data-fase="sem-informacoes"] .stamp { --st-ink: var(--stop-ink); --st-bg: var(--stop-bg); }
/* Conferindo é neutro de propósito: enquanto ele não sabe, a cor também não
   pode afirmar. Verde ou vermelho aqui seria o estado anterior fingindo valer. */
.bp .decision[data-fase="conferindo"] .stamp { --st-ink: var(--ink-soft); --st-bg: var(--screen); }
/* Sem leitura, o pulso para: ele é o que diz "isto é de agora". Piscando ao
   lado de "sem informações" ele desmente o carimbo. Em "conferindo" ele pisca,
   porque ali a leitura ESTÁ sendo buscada agora. */
.bp .decision[data-fase="sem-informacoes"] .live .pulse { animation: none; }

/* O carimbo sem informação é o botão de tentar de novo: alvo do tamanho do
   bloco, que a mão suja acerta. <button> traz estilo de formulário junto —
   zerar aqui pra ele continuar sendo o carimbo, não um botão. */
.bp button.decision { display: block; width: 100%; font: inherit; color: inherit;
  text-align: inherit; border: 1px solid var(--line); padding: inherit; margin-top: 1.25rem;
  cursor: pointer; -webkit-tap-highlight-color: transparent; }
.bp button.decision:active { opacity: .7; }
```

**Confira no arquivo:** a regra base `.bp .decision` (hoje na linha 63) já define `margin-top`, `background`, `border`, `border-radius` e `padding`. `button.decision` herda tudo por ter a mesma classe; as propriedades acima existem só pra desfazer o que o navegador impõe a `<button>`. Se a regra base mudar, esta acompanha.

- [ ] **Step 5: Passar o slug pela página**

Em `src/app/[slug]/page.tsx`:

```tsx
          <Carimbo estado={estado} erro={erro} calculadoEm={calculadoEm} pass={pass} fut={fut} slug={slug} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/app/Carimbo.test.tsx` → Expected: PASS (15 testes).
Run: `npm test --silent` → Expected: PASS, **173/173**.

- [ ] **Step 7: Olhar com o olho, não só com o teste**

Run: `npm run dev` e abrir `http://localhost:3000/rampa-do-pepe`.
Conferir: com leitura boa, o carimbo está como sempre esteve e **não** é botão (o cursor não vira mãozinha). Depois `http://localhost:3000/rampa-do-pepe?debug=frio` — "Não suba · barro" continua vermelho.

- [ ] **Step 8: Commit**

```bash
git add src/app/Carimbo.tsx src/app/ficha.css "src/app/[slug]/page.tsx" tests/app/Carimbo.test.tsx
git commit -m "feat(carimbo): sem leitura, informa em vez de mandar — e vira botão"
```

---

### Task 5: A busca

**Files:**
- Modify: `src/app/Carimbo.tsx` (substituição integral)
- Modify: `tests/app/Carimbo.test.tsx`

**Interfaces:**
- Consumes: `GET /api/carimbo?slug=` da Task 2; `podeBuscar`, `PRAZO_CONFERINDO_MS`, `Gatilho` da Task 3; `LeituraCarimbo` da Task 1.
- Produces: nada que outra task consuma. Última da rodada.

- [ ] **Step 1: Write the failing tests**

Em `tests/app/Carimbo.test.tsx`, acrescentar o utilitário de rede logo abaixo dos imports:

```tsx
/** Uma rede que o teste controla: cada chamada devolve uma promessa que o teste
 *  resolve na hora que quiser. É o que permite testar o prazo de 3s. */
function redeFalsa() {
  const pendentes: { ok: (corpo: unknown) => void; falhar: () => void }[] = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve, reject) => {
        pendentes.push({
          ok: (corpo) => resolve(new Response(JSON.stringify(corpo), { status: 200 })),
          falhar: () => reject(new Error("offline")),
        });
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, pendentes };
}

function tocar(container: HTMLElement) {
  const botao = container.querySelector("button.decision");
  if (!botao) throw new Error("o carimbo não virou botão");
  act(() => { botao.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
```

Acrescentar `vi.unstubAllGlobals()` ao `afterEach` que já existe no arquivo:

```tsx
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
```

E acrescentar o bloco de testes no fim do arquivo:

```tsx
describe("Carimbo — a busca", () => {
  const QUATRO_H_MS = 4 * 60 * 60 * 1000;

  it("volta pra tela com leitura vencida e busca a de agora", async () => {
    const { fetchMock, pendentes } = redeFalsa();
    const { container } = montar({ calculadoEm: AGORA_S });
    vi.setSystemTime(AGORA_MS + QUATRO_H_MS);

    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/carimbo?slug=rampa-do-pepe",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    await act(async () => {
      pendentes[0].ok({
        estado: "fresco", erro: false, calculadoEm: Math.floor((AGORA_MS + QUATRO_H_MS) / 1000),
      });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("leitura boa na tela não gasta rede ao voltar", () => {
    const { fetchMock } = redeFalsa();
    montar({ calculadoEm: AGORA_S });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passados 3s sem resposta volta a responder — e a resposta atrasada ainda repinta", async () => {
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });

    tocar(container);
    expect(container.querySelector(".mark")?.textContent).toBe("CONFERINDO…");

    act(() => { vi.advanceTimersByTime(3_001); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector(".reason")?.textContent).toContain("Não deu tempo");

    // A requisição não foi cancelada: aos 7s ela chega e ainda vale.
    await act(async () => {
      pendentes[0].ok({ estado: "fresco", erro: false, calculadoEm: AGORA_S });
    });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("rede caída mostra que não deu, com o toque ainda disponível", async () => {
    const { pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });
    tocar(container);
    await act(async () => { pendentes[0].falhar(); });
    expect(container.querySelector(".mark")?.textContent).toBe("SEM INFORMAÇÕES");
    expect(container.querySelector("button.decision")).not.toBeNull();
  });

  it("uma busca por vez — gatilho durante o Conferindo não dispara outra", () => {
    const { fetchMock } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true });
    tocar(container);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("o piso de 30s segura a segunda busca automática, mas não o toque", async () => {
    const { fetchMock, pendentes } = redeFalsa();
    const { container } = montar({ estado: "frio", erro: true, calculadoEm: AGORA_S });

    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { pendentes[0].falhar(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(5_000); });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // barrada pelo piso

    tocar(container);
    expect(fetchMock).toHaveBeenCalledTimes(2); // o toque passa por cima
  });

  it("página com erro do servidor não busca ao carregar", () => {
    // pageshow dispara em todo carregamento. Retentar aqui trocaria a mensagem
    // honesta por 3s de "Conferindo…" em toda abertura, durante uma queda.
    const { fetchMock } = redeFalsa();
    montar({ estado: "frio", erro: true, calculadoEm: AGORA_S });
    act(() => { window.dispatchEvent(new Event("pageshow")); });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/Carimbo.test.tsx`
Expected: FAIL — nenhum `fetch` acontece e a marca nunca vira `CONFERINDO…`.

- [ ] **Step 3: Substituir `src/app/Carimbo.tsx` inteiro**

Só o topo do componente muda em relação à Task 4; `motivo()` e o JSX do miolo ficam iguais, com os valores vindo de `leitura` em vez das props.

```tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Estado } from "@/lib/motor";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import {
  PRAZO_CONFERINDO_MS,
  type Fase,
  type Gatilho,
  type Sintoma,
  faseDe,
  podeBuscar,
  sintomaDe,
} from "@/lib/carimbo-fase";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe, devolve a
 *  decisão, e se oferece pra ir buscar de novo. "Não suba" ficou reservado pro
 *  barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  pass,
  fut,
  slug,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  pass: number;
  fut: number;
  slug: string;
}) {
  // A leitura do servidor é só o ponto de partida: daqui pra frente o
  // componente pode trocá-la por uma mais nova. O primeiro render usa
  // exatamente o que veio no HTML, pra a hidratação bater.
  const [leitura, setLeitura] = useState<LeituraCarimbo>({ estado, erro, calculadoEm });
  const [venceu, setVenceu] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  // Refs, e não estado: os ouvintes são registrados uma vez e leriam um estado
  // congelado no valor daquele render.
  const leituraRef = useRef(leitura);
  leituraRef.current = leitura;
  const naTela = useRef(false);          // há um "Conferindo…" na tela agora
  const ultimaTentativa = useRef(Number.NEGATIVE_INFINITY);
  const geracao = useRef(0);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  // O relógio da validade. Serve a tela aberta na mão; quem cobre o celular no
  // bolso são os gatilhos lá embaixo, porque navegador estrangula timer de aba
  // escondida.
  useEffect(() => {
    const checar = () =>
      setVenceu(carimboVenceu(leitura.calculadoEm, Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [leitura.calculadoEm]);

  const buscar = useCallback(async () => {
    naTela.current = true;
    ultimaTentativa.current = Date.now();
    const minha = ++geracao.current;
    setConferindo(true);
    setFalhou(false);

    // O prazo tira o "Conferindo…" da tela, mas NÃO cancela a requisição: se a
    // resposta chegar aos 7s, ela ainda vale. Libera o toque junto — prender o
    // botão esperando uma resposta que já saiu da tela seria travar por nada.
    const relogio = setTimeout(() => {
      if (geracao.current !== minha || !vivo.current) return;
      naTela.current = false;
      setConferindo(false);
      setFalhou(true);
    }, PRAZO_CONFERINDO_MS);

    try {
      const res = await fetch(`/api/carimbo?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const nova = (await res.json()) as LeituraCarimbo;
      if (geracao.current !== minha || !vivo.current) return;
      setLeitura(nova);
      setFalhou(false);
    } catch {
      if (geracao.current !== minha || !vivo.current) return;
      setFalhou(true);
    } finally {
      clearTimeout(relogio);
      if (geracao.current === minha) {
        naTela.current = false;
        if (vivo.current) setConferindo(false);
      }
    }
  }, [slug]);

  const tentar = useCallback(
    (gatilho: Gatilho) => {
      const jaVenceu = carimboVenceu(leituraRef.current.calculadoEm, Math.floor(Date.now() / 1000));
      // Primeiro a verdade sobre o que JÁ está na tela. Se venceu, o carimbo
      // tem que parar de afirmar agora mesmo — a busca a seguir pode nem sair
      // (piso, sem rede), e sem isto a tela continuaria afirmando leitura velha.
      setVenceu(jaVenceu);
      const pode = podeBuscar(gatilho, {
        erro: leituraRef.current.erro,
        venceu: jaVenceu,
        conferindo: naTela.current,
        desdeUltimaMs: Date.now() - ultimaTentativa.current,
      });
      if (pode) void buscar();
    },
    [buscar],
  );

  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") tentar("voltou"); };
    const aoCarregar = () => tentar("carregou");
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoCarregar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoCarregar);
    };
  }, [tentar]);

  const { estado: estadoAtual, erro: erroAtual, calculadoEm: calculadoEmAtual } = leitura;
  const situacao = { conferindo, erro: erroAtual, venceu, falhou };
  const fase = faseDe(situacao);
  const sintoma = sintomaDe(situacao);

  const marca =
    fase === "conferindo" ? "CONFERINDO…"
    : fase === "sem-informacoes" ? "SEM INFORMAÇÕES"
    : estadoAtual === "frio" ? "Não suba"
    : "Pode subir";

  const sub =
    fase === "conferindo" ? "lendo a chuva agora"
    : fase === "sem-informacoes" ? "tome cuidado"
    : estadoAtual === "fresco" ? "seco · carro comum"
    : "barro · dá um tempo";

  const linhaViva =
    fase === "conferindo" ? "conferindo a chuva agora"
    : fase === "sem-informacoes" ? "toque pra conferir"
    : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`;

  const miolo = (
    <>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">{motivo(fase, sintoma, estadoAtual, calculadoEmAtual, pass, fut)}</p>
      <div className="live">
        <span className="pulse"></span>
        <span>{linhaViva}</span>
      </div>
    </>
  );

  // Um atributo só. Dois codificando o mesmo fato foi o que deixou o pulso
  // piscando ao lado de "sem leitura" até hoje de manhã.
  const atributos = {
    className: "decision",
    role: "status" as const,
    "aria-live": "polite" as const,
    "data-fase": fase,
  };

  // Só vira botão quando tocar serve pra alguma coisa.
  return fase === "sem-informacoes" ? (
    <button type="button" {...atributos} onClick={() => tentar("toque")}>{miolo}</button>
  ) : (
    <div {...atributos}>{miolo}</div>
  );
}
```

Manter a função `motivo(...)` exatamente como ficou na Task 4, no fim do arquivo.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/Carimbo.test.tsx` → Expected: PASS (22 testes).

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm test --silent` → Expected: PASS, **180/180**.
Run: `npm run build` → Expected: `✓ Compiled successfully`, `/[slug]` como `ƒ (Dynamic)`, `/api/carimbo` na lista.

- [ ] **Step 6: Provar no navegador**

Run: `npm run dev`, abrir `http://localhost:3000/rampa-do-pepe`, trocar de aba, esperar, voltar. Com leitura fresca, nada acontece (é o certo). Pra ver a busca: parar o `npm run dev`, esperar 31 minutos não é razoável — em vez disso, na aba do DevTools, rodar `document.querySelector('.decision')` pra confirmar `data-fase="afirmando"`, e usar `?debug=frio` pra conferir que o vermelho medido continua vermelho. O caminho vencido está coberto por teste; o que o navegador prova aqui é que o botão e as cores estão certos.

- [ ] **Step 7: Commit**

```bash
git add src/app/Carimbo.tsx tests/app/Carimbo.test.tsx
git commit -m "feat(carimbo): a tela volta e ele busca a leitura de agora"
```

---

## Verificação final da rodada (antes do merge)

- [ ] **Revisão da branch inteira**, não commit a commit. Foco: as cinco tasks juntas. Em especial — o componente passou a ter **duas fontes de leitura** (a prop do servidor e o estado interno) e **três relógios** (o intervalo de 60s, o prazo de 3s, o piso de 30s). Vale checar se podem discordar de um jeito que engane.
- [ ] Uma leva única de correção com os achados + re-revisão escopada só no diff da correção.
- [ ] Merge `--no-ff` em `main` + `npx vercel --prod --yes` + conferir no domínio real (`/api/carimbo?slug=rampa-do-pepe` responde o trio; a ficha continua com o carimbo no primeiro paint).
- [ ] Atualizar `docs/RESUME.md`: esta rodada, e o que sobra dos deferidos.
