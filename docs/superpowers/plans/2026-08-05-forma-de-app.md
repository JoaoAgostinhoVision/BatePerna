# Forma de app (a moldura) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O BatePerna deixa de ser uma aba do Chrome e vira app instalado no celular — ícone próprio, tela cheia, rota por slug, e que continua servindo quando o sinal acaba sem nunca mentir sobre o carimbo.

**Architecture:** A ficha sai de `/` e vira `/[slug]`; `/` passa a despachar pra última ficha vista. A memória do "onde você estava" se divide por capacidade — o middleware **grava** o cookie (não tem `fs`), o server component de `/` **lê e valida** contra `getAllFichas()` (tem `fs`, mas não pode gravar). Por cima vem a casca de PWA (manifest, ícone gerado por `ImageResponse` em rota estática, safe areas) e um service worker. O carimbo ganha prazo de validade — sem isso, cachear a página seria cachear um "Pode subir" de três horas atrás.

**Tech Stack:** Next.js 15.5.22 (App Router, `src/`), React 19, TypeScript, Vitest + Testing Library (jsdom), serwist 9, Zod. Deploy na Vercel.

**Spec:** `docs/superpowers/specs/2026-08-05-forma-de-app-design.md`

## Global Constraints

- **A decisão nunca depende das peças novas.** O carimbo continua server-rendered no primeiro paint, só-clima, sem tocar no banco. Middleware, service worker e validade são camadas por fora — cada uma cai sozinha sem derrubar a ficha.
- **Português no código do produto**: nomes de função, variável, arquivo e texto de UI em português, como todo o resto do repo (`avaliar`, `tilesParaCaixa`, `formatarDistancia`). Comentários explicam *por quê*, não *o quê*.
- **Testes em `tests/`, espelhando `src/`.** Rodar com `npm test`. Nenhuma task termina com teste vermelho.
- **Nada de `next/link`** nas páginas novas: âncora `<a href>` pura. `Link` exige contexto de router e quebra em Testing Library, e navegação cheia é mais robusta com service worker.
- **Não mexer** em `src/lib/motor.ts`, `weather.ts`, `geo.ts`, `mapa.ts`, `db.ts`, `confirmar.ts`, nem em `MapaEstatico.tsx` / `DistanciaDaqui.tsx`.
- **Cores e tokens vêm de `ficha.css`.** Accent `#A5522A`, creme `#F8F2E6`, ground claro `#E7DFD0`, ground escuro `#100D08`.
- **Commit ao fim de cada task**, mensagem em português, corpo explicando o porquê.

---

### Task 1: `/trilhas` e o cadeado de deploy

A saída que impede o app instalado de trancar você numa ficha só. Vem primeiro porque é puramente aditiva — nada existente muda de lugar — e porque as tasks seguintes vão linkar pra ela.

Junto vem o teste-cadeado do `outputFileTracingIncludes`: o tracer estático do Next não enxerga o `readdirSync` de `src/lib/ficha.ts`, então toda rota que lê ficha precisa declarar `content/**`. Isso já quebrou o deploy uma vez (o comentário está no `next.config.mjs`) e **só aparece em produção**.

**Files:**
- Create: `src/app/trilhas/page.tsx`
- Create: `tests/app/trilhas.test.tsx`
- Create: `tests/deploy/tracing.test.ts`
- Modify: `src/app/ficha.css` (acrescenta bloco `.lista` no fim)
- Modify: `next.config.mjs:6-8` (a chave `outputFileTracingIncludes`)

**Interfaces:**
- Consumes: `getAllFichas(): Ficha[]` de `@/lib/ficha` (já existe). `Ficha` tem `slug`, `rotulo_escaneio`, `promessa`, `trajeto.waypoints[0].nome`.
- Produces: a rota `/trilhas`. Tasks 2, 3 e 4 dependem dela existir.

- [ ] **Step 1: Escrever o teste da lista, falhando**

Criar `tests/app/trilhas.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Trilhas from "@/app/trilhas/page";
import { getAllFichas } from "@/lib/ficha";

afterEach(() => { cleanup(); });

describe("/trilhas", () => {
  it("dá um link pra cada ficha de content/fichas", () => {
    const { container } = render(<Trilhas />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    const fichas = getAllFichas();
    expect(fichas.length).toBeGreaterThan(0);
    for (const f of fichas) expect(hrefs).toContain(`/${f.slug}`);
  });

  it("mostra o nome do lugar e o rótulo de escaneio de cada ficha", () => {
    const { container } = render(<Trilhas />);
    for (const f of getAllFichas()) {
      expect(container.textContent).toContain(f.trajeto.waypoints[0].nome);
      expect(container.textContent).toContain(f.rotulo_escaneio);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/app/trilhas.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/trilhas/page"`.

- [ ] **Step 3: Escrever a página**

Criar `src/app/trilhas/page.tsx`:

```tsx
import "../ficha.css";
import { getAllFichas } from "@/lib/ficha";

export const dynamic = "force-dynamic";

/** A lista é crua de propósito: sem carimbo, sem filtro. Carimbo aqui seria
 *  uma chamada ao Open-Meteo por trilha a cada abertura — isso é a home rica,
 *  sub-projeto 2. Esta tela é andaime, feita pra ser descartada, não refatorada. */
export default function Trilhas() {
  const fichas = getAllFichas();
  return (
    <main className="bp">
      <div className="screen">
        <div className="appbar">
          <div className="brand"><span className="mk">🥾</span> BatePerna</div>
        </div>
        <div className="lista">
          <div className="lista-k">Trilhas</div>
          {fichas.map((f) => (
            <a key={f.slug} className="lista-item" href={`/${f.slug}`}>
              <span className="scan">{f.rotulo_escaneio}</span>
              <span className="lista-t">{f.trajeto.waypoints[0].nome}</span>
              <span className="lista-p">{f.promessa}</span>
            </a>
          ))}
        </div>
        <div className="foot">BatePerna · Agreste · PE</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/app/trilhas.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Estilar a lista**

Acrescentar no fim de `src/app/ficha.css`:

```css
/* Lista de trilhas — andaime até a home rica. Reusa os tokens da ficha. */
.bp .lista { padding: 1.1rem 1.2rem 1.3rem; display: flex; flex-direction: column; gap: .7rem; }
.bp .lista-k { font-family: var(--type); font-size: .7rem; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: var(--ink-faint); margin-bottom: .2rem; }
.bp .lista-item { display: flex; flex-direction: column; gap: .15rem; text-decoration: none; color: inherit;
  background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px;
  padding: .8rem .9rem .9rem; box-shadow: var(--shadow-card); }
.bp .lista-t { font-family: var(--serif); font-size: 1.2rem; font-weight: 600; line-height: 1.15; }
.bp .lista-p { color: var(--ink-soft); font-size: .88rem; font-style: italic; }
```

- [ ] **Step 6: Escrever o teste-cadeado do tracing, falhando**

Criar `tests/deploy/tracing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import cfg from "../../next.config.mjs";

const RAIZ = process.cwd();
const APP = path.join(RAIZ, "src", "app");
const LIB = path.join(RAIZ, "src", "lib");

function arquivosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const p = path.join(dir, entrada);
    if (statSync(p).isDirectory()) return arquivosDeRota(p);
    return entrada === "page.tsx" || entrada === "route.ts" || entrada === "route.tsx" ? [p] : [];
  });
}

/** src/app/[slug]/page.tsx -> "/[slug]" ; src/app/page.tsx -> "/" */
function rotaDe(arquivo: string): string {
  const partes = path.relative(APP, path.dirname(arquivo)).split(path.sep).filter(Boolean);
  return "/" + partes.join("/");
}

/** Módulos de src/lib que leem ficha. Sem isso, a rota do cron passa batida:
 *  ela não importa @/lib/ficha direto, importa runMotor, que importa. */
function libsQueLeemFicha(): string[] {
  return readdirSync(LIB)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => readFileSync(path.join(LIB, f), "utf8").includes("@/lib/ficha"))
    .map((f) => "@/lib/" + f.replace(/\.ts$/, ""));
}

describe("cadeado de deploy", () => {
  it("toda rota que lê ficha declara content/** em outputFileTracingIncludes", () => {
    const declaradas = Object.keys(cfg.outputFileTracingIncludes ?? {});
    const alvos = ["@/lib/ficha", ...libsQueLeemFicha()];

    for (const arquivo of arquivosDeRota(APP)) {
      const fonte = readFileSync(arquivo, "utf8");
      if (!alvos.some((a) => fonte.includes(a))) continue;
      expect(
        declaradas,
        `${rotaDe(arquivo)} lê ficha por fs e precisa estar em outputFileTracingIncludes — ` +
          `senão o deploy quebra só em produção`,
      ).toContain(rotaDe(arquivo));
    }
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npm test -- tests/deploy/tracing.test.ts`
Expected: FAIL — `/trilhas`, `/api/confirmar` e `/api/cron/motor` lêem ficha e não estão declaradas. (`/api/confirmar` funciona em produção hoje por conta do tracer, não por garantia — declarar troca sorte por invariante.)

- [ ] **Step 8: Declarar as rotas**

Substituir a chave `outputFileTracingIncludes` em `next.config.mjs`:

```js
  // A ficha é lida de content/fichas em tempo de request (src/lib/ficha.ts via fs).
  // O tracer estático do Next não enxerga readdirSync dinâmico, então incluímos a
  // pasta explicitamente no bundle serverless — senão o deploy quebra ("ficha não
  // encontrada"), e só em produção. tests/deploy/tracing.test.ts é o cadeado:
  // ele falha se nascer rota que lê ficha sem declarar aqui.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/trilhas": ["./content/**/*"],
    "/api/confirmar": ["./content/**/*"],
    "/api/cron/motor": ["./content/**/*"],
  },
```

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — os 62 testes que já existiam + 3 novos.

- [ ] **Step 10: Commit**

```bash
git add src/app/trilhas/page.tsx src/app/ficha.css tests/app/trilhas.test.tsx tests/deploy/tracing.test.ts next.config.mjs
git commit -m "feat(trilhas): lista crua das fichas + cadeado do tracing

A lista é a saída: sem ela, o app instalado em tela cheia tranca você na
última ficha, porque não há barra de URL pra digitar outro slug.

O cadeado do tracing pega a armadilha que já quebrou o deploy uma vez e só
aparece em produção. Ele revelou que /api/confirmar lê ficha e nunca foi
declarada — funciona hoje porque o tracer resolve sozinho, o que é sorte.
Declarada junto."
```

---

### Task 2: `/[slug]` e o despachante

O `SLUG` cravado morre. A ficha passa a morar em `/[slug]`, e `/` deixa de renderizar: vira um redirecionador que lê o cookie da última ficha e valida contra as fichas que existem de verdade.

Ao fim desta task o cookie ainda não é gravado por ninguém — então `/` sempre cai em `/trilhas`. Isso é um estado coerente e testável; a Task 3 liga a outra metade.

**Files:**
- Create: `src/app/[slug]/page.tsx` (todo o conteúdo de `src/app/page.tsx` de hoje)
- Create: `src/lib/despacho.ts`
- Create: `tests/lib/despacho.test.ts`
- Rewrite: `src/app/page.tsx` (de ficha para despachante)
- Modify: `next.config.mjs` (acrescenta `"/[slug]"`)

**Interfaces:**
- Consumes: `getAllFichas()`, `getFicha(slug)` de `@/lib/ficha`; `fetchPrecip`, `avaliar`, `Estado` como já usados hoje em `src/app/page.tsx`.
- Produces:
  - `COOKIE_ULTIMA: string` (valor `"bp_ultima"`) — Task 3 usa.
  - `destinoDe(ultima: string | undefined, slugsExistentes: string[]): string` — devolve `"/<slug>"` ou `"/trilhas"`.
  - A rota `/[slug]`. Tasks 4 e 5 modificam esse arquivo.

- [ ] **Step 1: Escrever o teste do despacho, falhando**

Criar `tests/lib/despacho.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COOKIE_ULTIMA, destinoDe } from "@/lib/despacho";

const EXISTENTES = ["rampa-do-pepe", "monte-das-tabocas"];

describe("destinoDe", () => {
  it("manda pra última ficha quando ela ainda existe", () => {
    expect(destinoDe("rampa-do-pepe", EXISTENTES)).toBe("/rampa-do-pepe");
  });

  it("manda pra lista quando não há cookie", () => {
    expect(destinoDe(undefined, EXISTENTES)).toBe("/trilhas");
  });

  it("manda pra lista quando o cookie aponta pra ficha que não existe mais", () => {
    expect(destinoDe("ficha-apagada", EXISTENTES)).toBe("/trilhas");
  });

  it("manda pra lista quando não existe ficha nenhuma", () => {
    expect(destinoDe("rampa-do-pepe", [])).toBe("/trilhas");
  });
});

describe("COOKIE_ULTIMA", () => {
  it("não usa dois-pontos — é separador na RFC 6265 e não vale em nome de cookie", () => {
    expect(COOKIE_ULTIMA).not.toContain(":");
    expect(COOKIE_ULTIMA).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/despacho.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/despacho"`.

- [ ] **Step 3: Escrever o módulo puro**

Criar `src/lib/despacho.ts`:

```ts
/** Nome do cookie que lembra a última ficha aberta. Sublinhado, não
 *  dois-pontos: `:` é separador na RFC 6265 e não vale em nome de cookie.
 *  (Os `bp:` que existem no código são chaves de localStorage, onde vale.) */
export const COOKIE_ULTIMA = "bp_ultima";

/** Pra onde mandar quem chega em "/".
 *
 *  Pura de propósito: quem chama é o server component de "/", que tem fs e
 *  sabe quais fichas existem. O middleware nunca chama isto — ele roda fora
 *  do runtime que enxerga content/fichas e não teria como validar nada. */
export function destinoDe(ultima: string | undefined, slugsExistentes: string[]): string {
  return ultima && slugsExistentes.includes(ultima) ? `/${ultima}` : "/trilhas";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/despacho.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Mover a ficha pra `/[slug]`**

Criar `src/app/[slug]/page.tsx` com **exatamente** o conteúdo de `src/app/page.tsx` de hoje, com estas quatro mudanças e nada mais:

1. Os imports relativos ganham um nível: `import "../ficha.css"`, `import ConfirmarFui from "../ConfirmarFui"`, `import MapaEstatico from "../MapaEstatico"`, `import DistanciaDaqui from "../DistanciaDaqui"`.
2. Apagar a linha `const SLUG = "rampa-do-pepe";` e acrescentar `import { notFound } from "next/navigation";`.
3. A assinatura e a resolução da ficha viram:

```tsx
export default async function Ficha({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const { slug } = await params;
  const ficha = getFicha(slug);
  if (!ficha) notFound();
```

   — o bloco `if (!ficha) { return (<main className="bp">…Ficha não encontrada…</main>); }` que existe hoje some junto: `notFound()` já é a resposta 404 do Next.
4. `<ConfirmarFui slug={SLUG} />` vira `<ConfirmarFui slug={slug} />`.

Tudo o mais — `resolverEstado`, `dynamic = "force-dynamic"`, carimbo, ressalva, mapa, ticket, rodapé — fica **idêntico**.

- [ ] **Step 6: Trocar `/` pelo despachante**

Substituir o conteúdo inteiro de `src/app/page.tsx` por:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllFichas } from "@/lib/ficha";
import { COOKIE_ULTIMA, destinoDe } from "@/lib/despacho";

export const dynamic = "force-dynamic";

/** "/" não renderiza nada: despacha pra última ficha que você abriu.
 *
 *  Aqui é o único lugar que pode fazer as duas coisas de uma vez — ler o
 *  cookie e saber quais fichas existem (fs). O middleware grava o cookie mas
 *  não enxerga content/fichas; server component enxerga mas não pode gravar
 *  cookie durante o render. Por isso a validação mora deste lado.
 *
 *  Efeito de brinde: como é redirect de verdade, a URL na tela vira
 *  /rampa-do-pepe — mandar o link leva a pessoa pra ficha certa, não pra
 *  "a última ficha de quem abrir". */
export default async function Raiz() {
  const ultima = (await cookies()).get(COOKIE_ULTIMA)?.value;
  const slugs = getAllFichas().map((f) => f.slug);
  redirect(destinoDe(ultima, slugs));
}
```

- [ ] **Step 7: Declarar a rota nova no tracing**

Em `next.config.mjs`, acrescentar dentro de `outputFileTracingIncludes`:

```js
    "/[slug]": ["./content/**/*"],
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. O cadeado de tracing agora enxerga `/[slug]` e a acha declarada.

- [ ] **Step 9: Conferir no navegador**

Run: `npm run dev`
Conferir, nesta ordem:
- `http://localhost:3000/rampa-do-pepe` → a ficha inteira, igual à de antes (carimbo, mapa, Fui).
- `http://localhost:3000/` → redireciona pra `/trilhas` (ainda não há cookie).
- `http://localhost:3000/trilhas` → a lista, com link que abre a Rampa.
- `http://localhost:3000/nao-existe` → 404 do Next.
- `http://localhost:3000/rampa-do-pepe?debug=frio` → carimbo "Não suba".

- [ ] **Step 10: Commit**

```bash
git add src/app/[slug]/page.tsx src/app/page.tsx src/lib/despacho.ts tests/lib/despacho.test.ts next.config.mjs
git commit -m "feat(rotas): ficha vira /[slug] e / passa a despachar

Com meia dúzia de fichas vindo, SLUG cravado no page.tsx era insustentável —
e o app instalado ficaria preso numa trilha pra sempre.

A validação do cookie mora em /, não no middleware: middleware não enxerga
content/fichas (sem fs), então não teria como saber se a última ficha ainda
existe. Nesta task ninguém grava o cookie ainda, então / sempre cai na lista."
```

---

### Task 3: O middleware que grava a memória

A outra metade do despacho. O middleware só escreve — é a única peça que roda em toda resposta e pode setar cookie, e é a metade que não precisa de `fs`.

**Files:**
- Create: `src/middleware.ts`
- Create: `tests/middleware.test.ts`
- Modify: `src/lib/despacho.ts` (acrescenta `ehCaminhoDeFicha`)
- Modify: `tests/lib/despacho.test.ts` (acrescenta o describe novo)

**Interfaces:**
- Consumes: `COOKIE_ULTIMA` da Task 2.
- Produces: `ehCaminhoDeFicha(pathname: string): boolean`. O arquivo `src/middleware.ts` exporta `middleware(req: NextRequest): NextResponse` e `config`.

- [ ] **Step 1: Escrever o teste do reconhecedor de caminho, falhando**

Acrescentar em `tests/lib/despacho.test.ts` (e o import vira `import { COOKIE_ULTIMA, destinoDe, ehCaminhoDeFicha } from "@/lib/despacho";`):

```ts
describe("ehCaminhoDeFicha", () => {
  it("reconhece um slug de um segmento só", () => {
    expect(ehCaminhoDeFicha("/rampa-do-pepe")).toBe(true);
  });

  it("não confunde a lista com uma ficha", () => {
    expect(ehCaminhoDeFicha("/trilhas")).toBe(false);
  });

  it("não confunde a raiz com uma ficha", () => {
    expect(ehCaminhoDeFicha("/")).toBe(false);
  });

  it("ignora rotas de mais de um segmento", () => {
    expect(ehCaminhoDeFicha("/api/confirmar")).toBe(false);
    expect(ehCaminhoDeFicha("/icones/512")).toBe(false);
  });

  it("ignora arquivo com extensão", () => {
    expect(ehCaminhoDeFicha("/favicon.ico")).toBe(false);
    expect(ehCaminhoDeFicha("/sw.js")).toBe(false);
    expect(ehCaminhoDeFicha("/manifest.webmanifest")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/despacho.test.ts`
Expected: FAIL — `ehCaminhoDeFicha is not a function`.

- [ ] **Step 3: Implementar o reconhecedor**

Acrescentar em `src/lib/despacho.ts`:

```ts
/** Rotas de um segmento que NÃO são ficha. Se nascer outra, entra aqui —
 *  senão o middleware grava o nome dela como se fosse trilha. */
const RESERVADOS = new Set(["trilhas", "icones"]);

/** O caminho parece uma ficha? Puro string: é o que o middleware consegue
 *  saber sem fs. Se o slug for inventado, o cookie fica inválido e quem
 *  descarta é "/" — que sabe quais fichas existem. */
export function ehCaminhoDeFicha(pathname: string): boolean {
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length !== 1) return false;
  const [seg] = partes;
  return !RESERVADOS.has(seg) && !seg.includes(".");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/despacho.test.ts`
Expected: PASS (5 anteriores + 5 novos = 10).

- [ ] **Step 5: Escrever o teste do middleware, falhando**

Criar `tests/middleware.test.ts`. A primeira linha escolhe o ambiente **node**: `NextRequest` precisa das Web APIs do Node, e o jsdom padrão do projeto as substitui por versões incompletas.

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { COOKIE_ULTIMA } from "@/lib/despacho";

function req(caminho: string): NextRequest {
  return new NextRequest(new URL(caminho, "https://bateperna.vercel.app"));
}

describe("middleware", () => {
  it("grava a ficha aberta no cookie", () => {
    const res = middleware(req("/rampa-do-pepe"));
    expect(res.cookies.get(COOKIE_ULTIMA)?.value).toBe("rampa-do-pepe");
  });

  it("não grava nada quando a rota não é ficha", () => {
    expect(middleware(req("/trilhas")).cookies.get(COOKIE_ULTIMA)).toBeUndefined();
    expect(middleware(req("/")).cookies.get(COOKIE_ULTIMA)).toBeUndefined();
  });

  it("o cookie sobrevive a fechar o app — tem prazo longo e vale no site todo", () => {
    const c = middleware(req("/rampa-do-pepe")).cookies.get(COOKIE_ULTIMA);
    expect(c?.path).toBe("/");
    expect(c?.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test -- tests/middleware.test.ts`
Expected: FAIL — `Failed to resolve import "@/middleware"`.

- [ ] **Step 7: Escrever o middleware**

Criar `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ULTIMA, ehCaminhoDeFicha } from "@/lib/despacho";

const UM_ANO = 60 * 60 * 24 * 365;

/** Metade escrita da memória do "onde você estava".
 *
 *  Só grava — nunca decide. Validar o cookie exigiria saber quais fichas
 *  existem, e middleware não enxerga content/fichas. Quem valida é "/". */
export function middleware(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;
  if (ehCaminhoDeFicha(pathname)) {
    res.cookies.set(COOKIE_ULTIMA, pathname.slice(1), {
      path: "/",
      maxAge: UM_ANO,
      sameSite: "lax",
    });
  }
  return res;
}

// Fora: assets do Next, API, ícones e qualquer coisa com extensão. O que sobra
// são as navegações de página, que é onde a memória faz sentido.
export const config = {
  matcher: ["/((?!_next/|api/|icones/|.*\\.).*)"],
};
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- tests/middleware.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 9: Conferir o ciclo completo no navegador**

Run: `npm run dev`
- Abrir `http://localhost:3000/trilhas` e clicar na Rampa.
- Ir em `http://localhost:3000/` → **agora redireciona pra `/rampa-do-pepe`**, não pra lista.
- Nas ferramentas do navegador, Application → Cookies: existe `bp_ultima=rampa-do-pepe`.
- Apagar o cookie e abrir `/` de novo → volta pra `/trilhas`.

- [ ] **Step 10: Rodar tudo e commitar**

Run: `npm test`
Expected: PASS.

```bash
git add src/middleware.ts src/lib/despacho.ts tests/middleware.test.ts tests/lib/despacho.test.ts
git commit -m "feat(despacho): middleware lembra a última ficha aberta

Fecha o ciclo: o middleware grava o cookie (só string, não precisa de fs) e
/ lê, valida contra as fichas que existem e redireciona.

Cookie de slug inventado é inofensivo por construção — quem valida é o lado
que sabe quais fichas existem."
```

---

### Task 4: A casca em tela cheia

O que faz a diferença entre "site aberto em tela cheia" e "app": o conteúdo não some debaixo do relógio do iPhone, a barra de status combina com a ficha, e a marca vira uma porta em vez de texto morto.

A appbar sai das duas páginas e vira componente — não por elegância, mas porque é o que torna a saída testável: as páginas de ficha são async e não renderizam em Testing Library.

**Files:**
- Create: `src/app/Appbar.tsx`
- Create: `tests/app/Appbar.test.tsx`
- Create: `tests/app/viewport.test.ts`
- Modify: `src/app/layout.tsx` (export `viewport`)
- Modify: `src/app/ficha.css` (safe areas + `.brand` como link)
- Modify: `src/app/[slug]/page.tsx` (usa `Appbar`)
- Modify: `src/app/trilhas/page.tsx` (usa `Appbar`)

**Interfaces:**
- Produces: `Appbar({ chip, comSaida }: { chip?: string; comSaida?: boolean })`. `chip` é o texto da pílula de custo (`undefined` = sem pílula). `comSaida` (padrão `true`) faz a marca virar link pra `/trilhas`.
- `src/app/layout.tsx` passa a exportar `viewport: Viewport` além de `metadata`.

- [ ] **Step 1: Escrever o teste da appbar, falhando**

Criar `tests/app/Appbar.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Appbar from "@/app/Appbar";

afterEach(() => { cleanup(); });

describe("Appbar", () => {
  it("a marca é a saída: leva pra lista de trilhas", () => {
    const { container } = render(<Appbar />);
    const marca = container.querySelector(".brand");
    expect(marca?.tagName).toBe("A");
    expect(marca?.getAttribute("href")).toBe("/trilhas");
  });

  it("na própria lista a marca não leva a lugar nenhum", () => {
    const { container } = render(<Appbar comSaida={false} />);
    expect(container.querySelector(".brand")?.tagName).toBe("DIV");
  });

  it("mostra a pílula de custo quando recebe uma", () => {
    const { container } = render(<Appbar chip="R$ 5 · portão" />);
    expect(container.querySelector(".cost-chip")?.textContent).toBe("R$ 5 · portão");
  });

  it("sem custo, não inventa pílula", () => {
    const { container } = render(<Appbar />);
    expect(container.querySelector(".cost-chip")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/app/Appbar.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/Appbar"`.

- [ ] **Step 3: Escrever o componente**

Criar `src/app/Appbar.tsx`:

```tsx
/** A marca é a única saída do app instalado. Em tela cheia não existe barra
 *  de URL: sem esta porta, "abrir na última ficha" vira cárcere. */
export default function Appbar({
  chip,
  comSaida = true,
}: {
  chip?: string;
  comSaida?: boolean;
}) {
  const miolo = (
    <>
      <span className="mk">🥾</span> BatePerna
    </>
  );
  return (
    <div className="appbar">
      {comSaida ? (
        <a className="brand" href="/trilhas" aria-label="Ver todas as trilhas">
          {miolo}
        </a>
      ) : (
        <div className="brand">{miolo}</div>
      )}
      {chip && <span className="cost-chip">{chip}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/app/Appbar.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Usar a appbar nas duas páginas**

Em `src/app/[slug]/page.tsx`: acrescentar `import Appbar from "../Appbar";` e substituir o bloco `<div className="appbar">…</div>` inteiro por:

```tsx
        <Appbar chip={ficha.custo.tag === "pago" ? `${precoCurto} · portão` : undefined} />
```

Em `src/app/trilhas/page.tsx`: acrescentar `import Appbar from "../Appbar";` e substituir o bloco `<div className="appbar">…</div>` por `<Appbar comSaida={false} />`.

- [ ] **Step 6: Escrever o teste do viewport, falhando**

Criar `tests/app/viewport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { viewport } from "@/app/layout";

describe("viewport", () => {
  it("cobre o entalhe — sem isso o topo da ficha some debaixo do relógio", () => {
    expect(viewport.viewportFit).toBe("cover");
  });

  it("tem theme-color nos dois temas: a barra de status acompanha a ficha", () => {
    const cores = viewport.themeColor;
    expect(Array.isArray(cores)).toBe(true);
    const midias = (cores as { media: string; color: string }[]).map((c) => c.media);
    expect(midias).toContain("(prefers-color-scheme: light)");
    expect(midias).toContain("(prefers-color-scheme: dark)");
  });

  it("as cores são os mesmos --ground do ficha.css", () => {
    const cores = viewport.themeColor as { media: string; color: string }[];
    const porMidia = Object.fromEntries(cores.map((c) => [c.media, c.color.toUpperCase()]));
    expect(porMidia["(prefers-color-scheme: light)"]).toBe("#E7DFD0");
    expect(porMidia["(prefers-color-scheme: dark)"]).toBe("#100D08");
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npm test -- tests/app/viewport.test.ts`
Expected: FAIL — `viewport` não é exportado por `@/app/layout`.

- [ ] **Step 8: Exportar o viewport**

Em `src/app/layout.tsx`, trocar o import de tipo por `import type { Metadata, Viewport } from "next";` e acrescentar, depois de `metadata`:

```tsx
/** --ground do ficha.css nos dois temas: a barra de status do celular passa a
 *  ser a mesma cor do fundo da ficha em vez de uma faixa branca por cima.
 *  viewportFit cover é o que deixa o CSS alcançar as safe areas. */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E7DFD0" },
    { media: "(prefers-color-scheme: dark)", color: "#100D08" },
  ],
};
```

- [ ] **Step 9: Safe areas e alvo de toque no CSS**

Em `src/app/ficha.css`, substituir a linha `padding:` da regra `.bp` (linha 43) por:

```css
  padding:
    calc(clamp(0px, 4vw, 2.5rem) + env(safe-area-inset-top)) 
    calc(clamp(0px, 3vw, 1rem) + env(safe-area-inset-right)) 
    calc(2rem + env(safe-area-inset-bottom)) 
    calc(clamp(0px, 3vw, 1rem) + env(safe-area-inset-left));
```

E acrescentar no fim do arquivo:

```css
/* A marca é botão de verdade quando é saída: alvo de toque de 44px, o mínimo
   que a mão acerta sem raiva. */
.bp a.brand { text-decoration: none; color: inherit; min-height: 44px; margin: -.35rem 0; }
.bp a.brand:active { opacity: .6; }
```

- [ ] **Step 10: Rodar tudo e conferir no navegador**

Run: `npm test`
Expected: PASS.

Run: `npm run dev` — conferir que a Rampa continua igual, que tocar em "🥾 BatePerna" leva pra `/trilhas`, e que na lista a marca não é clicável.

- [ ] **Step 11: Commit**

```bash
git add src/app/Appbar.tsx src/app/layout.tsx src/app/ficha.css src/app/[slug]/page.tsx src/app/trilhas/page.tsx tests/app/Appbar.test.tsx tests/app/viewport.test.ts
git commit -m "feat(casca): safe areas, theme-color e a marca como saída

Em tela cheia não há barra do navegador segurando o conteúdo — sem safe
areas o topo da ficha vai parar debaixo do relógio do iPhone. É o detalhe
que mais denuncia PWA mal feito.

A appbar virou componente porque as páginas de ficha são async e não
renderizam em Testing Library: sem extrair, a saída ficaria sem teste."
```

---

### Task 5: O carimbo ganha prazo

O achado do brainstorm, e a task que **precisa vir antes do service worker**. A ficha é renderizada no servidor com o carimbo embutido no HTML, então cachear a página é cachear o carimbo — o SW entregaria offline um "Pode subir" de três horas atrás com cara de agora.

O bug já existe hoje sem offline nenhum: aba aberta às 7h, olhada às 11h, o carimbo continua verde.

**Files:**
- Create: `src/lib/validade.ts`
- Create: `tests/lib/validade.test.ts`
- Create: `src/app/Carimbo.tsx`
- Create: `tests/app/Carimbo.test.tsx`
- Modify: `src/app/[slug]/page.tsx` (o bloco `.decision` vira `<Carimbo>`)
- Modify: `src/app/ficha.css` (regra do carimbo vencido)

**Interfaces:**
- Consumes: `Estado` de `@/lib/motor`.
- Produces:
  - `VALIDADE_S: number` (1800)
  - `carimboVenceu(calculadoEm: number, agora: number): boolean` — epoch em **segundos**
  - `horaCurtaRecife(epochS: number): string` — `"8h12"`
  - `Carimbo({ estado, erro, calculadoEm, pass, fut }: { estado: Estado; erro: boolean; calculadoEm: number; pass: number; fut: number })`

- [ ] **Step 1: Escrever o teste da validade, falhando**

Criar `tests/lib/validade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VALIDADE_S, carimboVenceu, horaCurtaRecife } from "@/lib/validade";

const BASE = 1_800_000_000; // epoch em segundos, qualquer

describe("carimboVenceu", () => {
  it("leitura de agora vale", () => {
    expect(carimboVenceu(BASE, BASE)).toBe(false);
  });

  it("aos 29 minutos ainda vale", () => {
    expect(carimboVenceu(BASE, BASE + 29 * 60)).toBe(false);
  });

  it("aos 30 minutos vence", () => {
    expect(carimboVenceu(BASE, BASE + 30 * 60)).toBe(true);
  });

  it("muito depois, vence", () => {
    expect(carimboVenceu(BASE, BASE + 5 * 3600)).toBe(true);
  });

  it("relógio do celular atrasado não faz o carimbo vencer", () => {
    expect(carimboVenceu(BASE, BASE - 3600)).toBe(false);
  });

  it("a validade é de 30 minutos", () => {
    expect(VALIDADE_S).toBe(1800);
  });
});

describe("horaCurtaRecife", () => {
  it("formata no fuso de Recife (UTC-3), não em UTC", () => {
    // 2027-01-15T11:12:00Z = 08h12 em Recife
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 11, 12) / 1000)).toBe("8h12");
  });

  it("preenche o minuto com zero", () => {
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 11, 5) / 1000)).toBe("8h05");
  });

  it("atravessa a meia-noite pra trás sem quebrar", () => {
    // 01h30 UTC = 22h30 do dia anterior em Recife
    expect(horaCurtaRecife(Date.UTC(2027, 0, 15, 1, 30) / 1000)).toBe("22h30");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/validade.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/validade"`.

- [ ] **Step 3: Escrever o módulo puro**

Criar `src/lib/validade.ts`:

```ts
/** Quanto tempo uma leitura de chuva ainda vale. Passou disso, o carimbo
 *  para de afirmar: a regra da Rampa olha 3h à frente, e previsão vira. */
export const VALIDADE_S = 30 * 60;

const OFFSET_RECIFE_S = -3 * 3600;

/** Epoch em SEGUNDOS nos dois argumentos.
 *  Relógio adiantado do lado do cliente não vence carimbo — na dúvida, vale. */
export function carimboVenceu(calculadoEm: number, agora: number): boolean {
  return agora - calculadoEm >= VALIDADE_S;
}

/** "8h12" no fuso de Recife. Mesmo offset fixo que ConfirmarFui usa pro
 *  placar do dia: o agreste não tem horário de verão. */
export function horaCurtaRecife(epochS: number): string {
  const local = new Date((epochS + OFFSET_RECIFE_S) * 1000);
  const h = local.getUTCHours();
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/validade.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Escrever o teste do componente, falhando**

Criar `tests/app/Carimbo.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import Carimbo from "@/app/Carimbo";

const AGORA_MS = Date.UTC(2027, 0, 15, 11, 42); // 08h42 em Recife
const AGORA_S = AGORA_MS / 1000;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(AGORA_MS); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

type Props = { estado: "fresco" | "frio"; erro: boolean; calculadoEm: number; pass: number; fut: number };

function montar(props: Partial<Props> = {}) {
  return render(
    <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} pass={6} fut={3} {...props} />,
  );
}

describe("Carimbo", () => {
  it("leitura fresca afirma", () => {
    const { container } = montar();
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
  });

  it("leitura vencida para de afirmar e manda checar no portão", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
    expect(container.textContent).toContain("sem leitura");
  });

  it("vencida, diz de que hora era a leitura", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 }); // 08h02
    expect(container.textContent).toContain("8h02");
  });

  it("vencida, marca o bloco pro CSS pintar de parada mesmo com estado fresco", () => {
    const { container } = montar({ calculadoEm: AGORA_S - 40 * 60 });
    expect(container.querySelector(".decision")?.getAttribute("data-venceu")).toBe("1");
  });

  it("vence sozinho com o app aberto, sem recarregar", () => {
    const { container } = montar({ calculadoEm: AGORA_S });
    expect(container.querySelector(".mark")?.textContent).toBe("Pode subir");
    act(() => { vi.advanceTimersByTime(31 * 60 * 1000); });
    expect(container.querySelector(".mark")?.textContent).toBe("Não suba");
  });

  it("sem leitura de chuva, é honesto desde o começo", () => {
    const { container } = montar({ estado: "frio", erro: true });
    expect(container.textContent).toContain("Não deu pra ler a chuva agora");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test -- tests/app/Carimbo.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/Carimbo"`.

- [ ] **Step 7: Escrever o componente**

Criar `src/app/Carimbo.tsx`. Ele é client, mas **é renderizado no HTML do servidor também** — o primeiro paint continua trazendo o carimbo pronto, sem esperar JS. O JS só serve pra tirar a afirmação depois que ela envelhece.

```tsx
"use client";
import { useEffect, useState } from "react";
import type { Estado } from "@/lib/motor";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Sem prazo, uma aba aberta às 7h ainda diz "Pode subir" às 11h; e com o
 *  service worker guardando a página, o offline mostraria clima de três horas
 *  atrás com cara de agora. Vencido, cai no mesmo texto honesto que já existe
 *  pro caso de não conseguir ler a chuva. */
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
}) {
  // Começa sempre válido pra o HTML do servidor e o do cliente baterem na
  // hidratação. Se já nasceu velho, o efeito corrige no mesmo instante.
  const [venceu, setVenceu] = useState(false);

  useEffect(() => {
    const checar = () => setVenceu(carimboVenceu(calculadoEm, Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [calculadoEm]);

  const semLeitura = erro || venceu;
  const marca = semLeitura || estado === "frio" ? "Não suba" : "Pode subir";
  const sub = semLeitura
    ? "sem leitura · cheque no portão"
    : estado === "fresco"
      ? "seco · carro comum"
      : "barro · dá um tempo";

  return (
    <div className="decision" role="status" aria-live="polite" data-venceu={venceu ? "1" : undefined}>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">
        {venceu ? (
          <>
            Essa leitura é das <b>{horaCurtaRecife(calculadoEm)}</b> e já passou do prazo. O barro
            muda rápido — na dúvida, <b>não suba</b> sem olhar no portão.
          </>
        ) : erro ? (
          <>
            Não deu pra ler a chuva agora. Na dúvida, <b>não suba</b> — cheque o barro no portão.
          </>
        ) : estado === "fresco" ? (
          <>
            Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>. Área
            alta, escorre rápido — a serra firmou.
          </>
        ) : (
          <>
            Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>). O barro
            segura água — risco de atolar.
          </>
        )}
      </p>
      <div className="live">
        <span className="pulse"></span>
        <span>
          {venceu
            ? `leitura das ${horaCurtaRecife(calculadoEm)} · vencida`
            : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- tests/app/Carimbo.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 9: Ligar na ficha**

Em `src/app/[slug]/page.tsx`:

1. Acrescentar `import Carimbo from "../Carimbo";`
2. Fazer `resolverEstado` devolver também quando a leitura foi feita. A função vira:

```tsx
type Render = { state: Estado; erro: boolean; calculadoEm: number };

async function resolverEstado(
  ficha: NonNullable<ReturnType<typeof getFicha>>,
  debug: string | undefined,
): Promise<Render> {
  const agora = Math.floor(Date.now() / 1000);
  if (debug === "fresco" || debug === "frio") return { state: debug, erro: false, calculadoEm: agora };
  try {
    const { coords, regra } = ficha.condicao;
    const { precips } = await fetchPrecip(coords, regra);
    return { state: avaliar(regra, precips, agora), erro: false, calculadoEm: agora };
  } catch {
    // Sem leitura de chuva → lado seguro: "não suba", e diz a verdade (não finge verde).
    return { state: "frio", erro: true, calculadoEm: agora };
  }
}
```

3. Trocar a desestruturação: `const { state, erro, calculadoEm } = await resolverEstado(ficha, debug);`
4. Apagar o objeto `const carimbo = …` inteiro (ele mudou de casa).
5. Substituir o bloco `<div className="decision" …>…</div>` inteiro por:

```tsx
          <Carimbo estado={state} erro={erro} calculadoEm={calculadoEm} pass={pass} fut={fut} />
```

- [ ] **Step 10: Pintar o carimbo vencido**

O `.stamp` herda a cor de `.bp[data-state]` (`ficha.css:69-70`), então um carimbo vencido numa página `fresco` sairia verde dizendo "Não suba". Acrescentar no fim de `src/app/ficha.css` — a especificidade é maior que a das duas regras de `data-state`, então ganha nas duas:

```css
/* Carimbo vencido pinta de parada mesmo numa página que abriu fresco:
   a cor tem que dizer a mesma coisa que a palavra. */
.bp .decision[data-venceu="1"] .stamp { --st-ink: var(--stop-ink); --st-bg: var(--stop-bg); }
```

- [ ] **Step 11: Rodar tudo e conferir no navegador**

Run: `npm test`
Expected: PASS.

Run: `npm run dev` — abrir `/rampa-do-pepe`, confirmar que o carimbo aparece normal. Não dá pra esperar 30 minutos: confirmar o caminho vencido pelos testes.

- [ ] **Step 12: Commit**

```bash
git add src/lib/validade.ts src/app/Carimbo.tsx src/app/[slug]/page.tsx src/app/ficha.css tests/lib/validade.test.ts tests/app/Carimbo.test.tsx
git commit -m "fix(carimbo): leitura de chuva passa a ter prazo de 30 minutos

Sem prazo, aba aberta às 7h ainda diz 'Pode subir' às 11h. O bug já existia
sem offline nenhum — o service worker da próxima task só ia amplificar,
servindo clima de três horas atrás com cara de agora.

Vencido cai no texto honesto que já existia pro erro de leitura, agora com a
hora da última leitura. O primeiro paint continua vindo do servidor: o JS só
tira a afirmação depois que ela envelhece."
```

---

### Task 6: Manifest e ícone

O que faz o Chrome oferecer "instalar" e o que aparece na tela inicial. Os PNGs são prerenderizados no build por rota estática — nada é gerado por request.

**Files:**
- Create: `src/lib/marca.ts`
- Create: `src/app/icones/[nome]/route.tsx`
- Create: `src/app/manifest.ts`
- Create: `tests/app/manifest.test.ts`
- Modify: `src/app/layout.tsx` (metadata aponta pros ícones)

**Interfaces:**
- Produces:
  - `TAMANHOS: Record<string, { px: number; margem: number }>` em `@/lib/marca` — chaves `"192"`, `"512"`, `"maskable"`, `"apple"`.
  - `ACCENT`, `CREME` — as duas cores.
  - `src/app/manifest.ts` default export → objeto `MetadataRoute.Manifest`.

- [ ] **Step 1: Escrever o teste do manifest, falhando**

Criar `tests/app/manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { TAMANHOS } from "@/lib/marca";
import { generateStaticParams } from "@/app/icones/[nome]/route";

describe("manifest", () => {
  const m = manifest();

  it("abre em tela cheia — é o que tira a barra de URL", () => {
    expect(m.display).toBe("standalone");
  });

  it("o ícone abre na raiz, que é o despachante da última ficha", () => {
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
  });

  it("tem ícone maskable — o Android recorta em círculo e exige um", () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThan(0);
  });

  it("tem ícone de 512 pra tela de abertura", () => {
    expect((m.icons ?? []).some((i) => i.sizes === "512x512")).toBe(true);
  });

  it("todo ícone citado é de fato gerado no build", () => {
    const gerados = new Set(generateStaticParams().map((p) => `/icones/${p.nome}`));
    for (const icone of m.icons ?? []) {
      expect(gerados, `${icone.src} não é gerado por generateStaticParams`).toContain(icone.src);
    }
  });

  it("gera exatamente os tamanhos declarados em marca.ts", () => {
    expect(generateStaticParams().map((p) => p.nome).sort()).toEqual(Object.keys(TAMANHOS).sort());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/app/manifest.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/manifest"`.

- [ ] **Step 3: Escrever a marca**

Criar `src/lib/marca.ts`. Só dados — a geometria fica fora do componente pra o teste poder falar dela sem renderizar PNG.

```ts
/** A pegada de bota. Escolhida entre pegada / carimbo / serra / trilha com as
 *  quatro julgadas recortadas em círculo e a 48px: "bate perna" é andar, então
 *  é a única em que o nome do app e o desenho são a mesma coisa — e simétrica,
 *  o corte maskable não tira nada dela. */
export const ACCENT = "#A5522A";
export const CREME = "#F8F2E6";

/** Traçados num viewBox 0 0 100 100. Sem texto: texto em ImageResponse
 *  exigiria embutir arquivo de fonte no bundle. */
export const ANTEPE =
  "M50 14c13 0 20 9 20 20 0 8-3 13-3 18 0 4-6 6-17 6s-17-2-17-6c0-5-3-10-3-18 0-11 7-20 20-20Z";
export const CALCANHAR = "M50 64c9 0 15 4.5 15 11s-6 11-15 11-15-4.5-15-11 6-11 15-11Z";

/** Barras do piso, em coordenadas do mesmo viewBox. */
export const PISO = [
  { x: 28, y: 33, w: 44 },
  { x: 28, y: 43, w: 44 },
  { x: 34, y: 72, w: 32 },
];

/** `margem` é o respiro em porcentagem do lado. A maskable precisa dele: o
 *  Android recorta num círculo e só a área central de ~80% é garantida. */
export const TAMANHOS: Record<string, { px: number; margem: number }> = {
  "192": { px: 192, margem: 0 },
  "512": { px: 512, margem: 0 },
  maskable: { px: 512, margem: 12 },
  apple: { px: 180, margem: 6 },
};
```

- [ ] **Step 4: Escrever a rota dos ícones**

Criar `src/app/icones/[nome]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { ACCENT, ANTEPE, CALCANHAR, CREME, PISO, TAMANHOS } from "@/lib/marca";

// Prerenderizados no build: os PNGs viram arquivo estático, não trabalho por
// request. URLs fixas (/icones/192, ...) pra o manifest poder citá-las.
export const dynamic = "force-static";

export function generateStaticParams(): { nome: string }[] {
  return Object.keys(TAMANHOS).map((nome) => ({ nome }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nome: string }> },
): Promise<Response> {
  const { nome } = await params;
  const medida = TAMANHOS[nome];
  if (!medida) return new Response("ícone desconhecido", { status: 404 });

  const { px, margem } = medida;
  const lado = 100 - margem * 2;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: ACCENT }}>
        {/* viewBox fixo em [0,100]: os dois últimos valores são largura e
            altura, não um segundo canto — deslocar a origem por -margem jogaria
            o desenho no canto em vez de centralizar. A margem quem dá é o
            translate abaixo. */}
        <svg width={px} height={px} viewBox="0 0 100 100">
          <g transform={`translate(${margem} ${margem}) scale(${lado / 100})`}>
            <path d={ANTEPE} fill={CREME} />
            <path d={CALCANHAR} fill={CREME} />
            {PISO.map((b) => (
              <rect key={b.y} x={b.x} y={b.y} width={b.w} height={4.5} rx={2.25} fill={ACCENT} />
            ))}
          </g>
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
```

- [ ] **Step 5: Escrever o manifest**

Criar `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BatePerna",
    short_name: "BatePerna",
    description: "Aventura pela via segura.",
    lang: "pt-BR",
    // A raiz despacha pra última ficha aberta — então o manifest não precisa
    // saber qual é, e o comportamento acompanha você sem redeploy.
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E7DFD0",
    theme_color: "#E7DFD0",
    icons: [
      { src: "/icones/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- tests/app/manifest.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 7: Apontar favicon e ícone do iPhone**

Em `src/app/layout.tsx`, acrescentar dentro do objeto `metadata`:

```tsx
  icons: {
    icon: "/icones/192",
    apple: "/icones/apple",
  },
```

- [ ] **Step 8: Conferir que os PNGs saem de verdade**

Run: `npm run build`
Expected: build passa sem erro.

Run: `npm run start` e, em outro terminal:

```bash
curl -s -o /dev/null -w "192=%{http_code} %{content_type}\n" http://localhost:3000/icones/192
curl -s -o /dev/null -w "maskable=%{http_code} %{content_type}\n" http://localhost:3000/icones/maskable
curl -s http://localhost:3000/manifest.webmanifest | head -c 200
```

Expected: os dois `200 image/png`, e o manifest volta JSON com `"display":"standalone"`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/marca.ts src/app/icones src/app/manifest.ts src/app/layout.tsx tests/app/manifest.test.ts
git commit -m "feat(pwa): manifest e ícone da pegada

Ícone gerado por ImageResponse em rota estática — prerenderizado no build,
URL fixa que o manifest pode citar sem depender de hash. Descartado gerar por
script: next/og não está no mapa de exports do next 15, então script só
alcança por caminho de arquivo e quebra em upgrade.

A pegada é geométrica porque texto em ImageResponse exigiria embutir fonte.
Emoji não serve: vira tofu em boa parte dos aparelhos e o Android quer
maskable de qualquer jeito."
```

---

### Task 7: Service worker

A última camada, e a que só é segura porque a Task 5 existe. Offline, a ficha aparece inteira — trajeto, coordenada, avisos, o que ler no portão — com o carimbo já desqualificado pelo prazo.

**Files:**
- Create: `src/lib/cache-rotas.ts`
- Create: `tests/lib/cache-rotas.test.ts`
- Create: `src/app/sw.ts`
- Modify: `next.config.mjs` (embrulha com `withSerwist`)
- Modify: `.gitignore` (o `sw.js` gerado)

**Interfaces:**
- Consumes: `ehCaminhoDeFicha` de `@/lib/despacho` (Task 3).
- Produces: `ehTileOsm(url: string): boolean`, `nuncaCachear(url: string): boolean`, `CACHE_ULTIMA_FICHA: string`.

- [ ] **Step 1: Escrever o teste das regras de cache, falhando**

Criar `tests/lib/cache-rotas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CACHE_ULTIMA_FICHA, ehTileOsm, nuncaCachear } from "@/lib/cache-rotas";

describe("ehTileOsm", () => {
  it("reconhece tile do OSM", () => {
    expect(ehTileOsm("https://tile.openstreetmap.org/12/1234/2345.png")).toBe(true);
  });

  it("não confunde com a própria página", () => {
    expect(ehTileOsm("https://bateperna.vercel.app/rampa-do-pepe")).toBe(false);
  });
});

describe("nuncaCachear", () => {
  it("placar do Fui nunca vem do cache — número velho é número inventado", () => {
    expect(nuncaCachear("https://bateperna.vercel.app/api/confirmar?slug=rampa-do-pepe")).toBe(true);
  });

  it("o cron também não", () => {
    expect(nuncaCachear("https://bateperna.vercel.app/api/cron/motor")).toBe(true);
  });

  it("a ficha pode ser cacheada", () => {
    expect(nuncaCachear("https://bateperna.vercel.app/rampa-do-pepe")).toBe(false);
  });
});

describe("CACHE_ULTIMA_FICHA", () => {
  it("tem nome próprio pra poder ser limpo sozinho", () => {
    expect(CACHE_ULTIMA_FICHA).toMatch(/^bp-/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/lib/cache-rotas.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/cache-rotas"`.

- [ ] **Step 3: Escrever as regras**

Criar `src/lib/cache-rotas.ts`:

```ts
/** Guarda a última ficha navegada com sucesso, numa chave fixa. É o espelho
 *  offline do cookie bp_ultima: o service worker não lê cookie, então mantém
 *  a própria memória — e é ela que responde quando "/" abre sem rede. */
export const CACHE_ULTIMA_FICHA = "bp-ultima-ficha";
export const CHAVE_ULTIMA = "/__ultima__";

export function ehTileOsm(url: string): boolean {
  return new URL(url).hostname === "tile.openstreetmap.org";
}

/** Placar e cron nunca saem do cache. O resto da ficha é verdade parada;
 *  o placar não é. */
export function nuncaCachear(url: string): boolean {
  return new URL(url).pathname.startsWith("/api/");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- tests/lib/cache-rotas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Escrever o service worker**

Criar `src/app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, NetworkOnly, CacheFirst, ExpirationPlugin } from "serwist";
import { CACHE_ULTIMA_FICHA, CHAVE_ULTIMA, ehTileOsm, nuncaCachear } from "@/lib/cache-rotas";
import { ehCaminhoDeFicha } from "@/lib/despacho";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Assume o controle assim que baixa: service worker grudado servindo versão
  // velha é veneno, e é chato de desinstalar de um celular.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Placar do Fui e cron: só rede. Número velho é número inventado.
      matcher: ({ url }) => nuncaCachear(url.href),
      handler: new NetworkOnly(),
    },
    {
      // Tiles do mapa: o que já foi visto continua aparecendo na estrada.
      matcher: ({ url }) => ehTileOsm(url.href),
      handler: new CacheFirst({
        cacheName: "bp-tiles-osm",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      // Páginas: rede primeiro, sempre. O cache é rede de segurança, não atalho.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "bp-paginas", networkTimeoutSeconds: 6 }),
    },
    ...defaultCache,
  ],
});

/** Guarda a ficha aberta como "a última", e responde com ela quando "/" abrir
 *  sem rede — o redirect de "/" precisa de servidor, e offline não há. */
self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.mode !== "navigate") return;
  const url = new URL(req.url);

  if (ehCaminhoDeFicha(url.pathname)) {
    evento.respondWith(
      (async () => {
        const resposta = await fetch(req).catch(() => null);
        if (resposta?.ok) {
          const cache = await caches.open(CACHE_ULTIMA_FICHA);
          await cache.put(CHAVE_ULTIMA, resposta.clone());
          return resposta;
        }
        return (await caches.match(req)) ?? (await caches.match(CHAVE_ULTIMA)) ?? Response.error();
      })(),
    );
    return;
  }

  if (url.pathname === "/") {
    evento.respondWith(
      (async () => {
        const resposta = await fetch(req).catch(() => null);
        if (resposta) return resposta;
        const cache = await caches.open(CACHE_ULTIMA_FICHA);
        return (await cache.match(CHAVE_ULTIMA)) ?? (await caches.match("/trilhas")) ?? Response.error();
      })(),
    );
  }
});

serwist.addEventListeners();
```

- [ ] **Step 6: Cabear o serwist no build**

Substituir `next.config.mjs` inteiro, preservando a chave `outputFileTracingIncludes` como está:

```js
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Em dev o SW só atrapalha: serve build velho e confunde depuração.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A ficha é lida de content/fichas em tempo de request (src/lib/ficha.ts via fs).
  // O tracer estático do Next não enxerga readdirSync dinâmico, então incluímos a
  // pasta explicitamente no bundle serverless — senão o deploy quebra ("ficha não
  // encontrada"), e só em produção. tests/deploy/tracing.test.ts é o cadeado:
  // ele falha se nascer rota que lê ficha sem declarar aqui.
  outputFileTracingIncludes: {
    "/": ["./content/**/*"],
    "/[slug]": ["./content/**/*"],
    "/trilhas": ["./content/**/*"],
    "/api/confirmar": ["./content/**/*"],
    "/api/cron/motor": ["./content/**/*"],
  },
};

export default withSerwist(nextConfig);
```

Atenção: `tests/deploy/tracing.test.ts` importa esse arquivo e lê `cfg.outputFileTracingIncludes`. Com o export virando `withSerwist(nextConfig)`, o objeto exportado continua carregando a chave — rodar o teste confirma. Se falhar, o conserto é o teste importar a chave de um módulo próprio; **não** afrouxar o cadeado.

- [ ] **Step 7: Ignorar o `sw.js` gerado**

Acrescentar em `.gitignore`:

```
# Gerado pelo serwist a cada build
public/sw.js
public/swe-worker-*.js
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — tudo, incluindo o cadeado de tracing lendo o config novo.

- [ ] **Step 9: Provar o offline de verdade**

Run: `npm run build && npm run start`

No Chrome, em `http://localhost:3000`:
1. Abrir `/rampa-do-pepe` e deixar carregar (mapa incluso).
2. DevTools → Application → Service Workers: confirmar que está `activated`.
3. DevTools → Network → marcar **Offline**.
4. Recarregar `/rampa-do-pepe` → a ficha aparece inteira, os tiles do mapa aparecem, e o carimbo está em **"Não suba · sem leitura · cheque no portão"** (a página cacheada tem leitura velha, e o prazo da Task 5 a desqualifica).
5. Ir em `/` → cai na última ficha, ainda offline.
6. Confirmar que o placar do "Fui" degrada sem quebrar a página.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cache-rotas.ts src/app/sw.ts next.config.mjs .gitignore tests/lib/cache-rotas.test.ts
git commit -m "feat(offline): service worker que não mente

A ficha inteira funciona sem sinal — trajeto, coordenada, avisos, o que ler
no portão, e os tiles do mapa já vistos. É o caso de uso principal, não de
borda: o app serve pra ir pro mato, e é lá que não tem rede.

O carimbo cacheado cai sozinho em 'sem leitura' pelo prazo da task anterior.
Sem aquilo, isto aqui seria uma máquina de mostrar clima velho com cara de
agora.

O SW mantém a própria memória da última ficha (não lê cookie) porque o
redirect de / precisa de servidor, e offline não há."
```

---

## Depois do plano

Fora de escopo aqui, e cada um com seu próprio ciclo:

- **Sub-projeto 2 — a arquitetura:** home rica que responde "o que dá pra fazer hoje" com carimbo por trilha, descoberta, filtro por modo/espécie. Quando ela chegar, `/` deixa de despachar e vira ela, e `/trilhas` é descartada.
- **Produzir as fichas.** O João tem material pra meia dúzia; cada uma precisa de dado real dele (coords, custo, regra da condição, a voz). O app agora comporta.
- **Instalar e olhar.** No iPhone: Compartilhar → Adicionar à Tela de Início.
