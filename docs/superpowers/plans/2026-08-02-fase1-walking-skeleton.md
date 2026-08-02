# BatePerna Fase 1 — Walking-Skeleton (fio 1: Rampa do Pepê) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one real BatePerna ficha (Rampa do Pepê) end-to-end as an installable PWA whose freshness is driven by a real (but shallow) engine: Vercel Cron reads Open-Meteo, applies a binary rain rule, writes one freshness state to Turso, and the ficha reads it.

**Architecture:** A single Next.js (App Router) project deployed on Vercel. Ficha content is **immutable, lives in the repo** as JSON (Git-as-CMS). Mutable state (freshness + confirmations) lives in **Turso/libSQL**. A cron route **pushes** freshness into the DB; pages **pull** it when rendered. Offline is handled by **Serwist** (service worker) precaching the app shell + actionable content; only the volatile freshness needs the network and degrades honestly.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Vitest + Testing Library · Tailwind CSS · `@libsql/client` (Turso) · Zod · Open-Meteo (no key) · Serwist (`@serwist/next`) · Vercel + Vercel Cron.

## Global Constraints

- **Node:** 20+ (Next 15 requirement). One line in `package.json` `engines`.
- **App location:** repo root `C:\BatePerna2.0`. Ficha content path is `content/fichas/*.json` (already committed). The v1 app `BatePerna/` is a separate git repo, gitignored — do not touch it.
- **Content is immutable at runtime:** the app never writes ficha content. It only reads `content/fichas/*.json`. The only writes are to Turso (`freshness`, `confirmacoes`).
- **Freshness rule lives in the data** (`condicao.regra`); the motor is generic per `regra.tipo`. Fio 1 implements only `tipo: "chuva_binaria"`.
- **Determinism for tests:** any function whose result depends on "now" takes an explicit `agora: number` (epoch **seconds**) parameter. Only route handlers call `Date.now()`.
- **No secrets in repo:** Turso `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` and `CRON_SECRET` come from env vars. Open-Meteo needs no key.
- **TypeScript strict mode** on. **Frequent commits** — one per task minimum.
- **Epoch unit:** seconds everywhere in our code (Turso columns are epoch seconds). Convert `Date.now()` (ms) → seconds at the boundary.

---

## File Structure

```
C:\BatePerna2.0\
  package.json                       # deps, scripts, engines
  tsconfig.json                      # strict TS, path alias @/*
  next.config.mjs                    # wrapped with withSerwist
  vitest.config.ts                   # jsdom env, @ alias
  tailwind.config.ts, postcss.config.mjs
  vercel.json                        # cron schedule for /api/cron/motor
  .env.local.example                 # documents required env vars
  db/schema.sql                      # the 2 Turso tables (run once, manually)
  content/fichas/rampa-do-pepe.json  # EXISTS — the real content
  public/                            # icons + manifest
  src/
    types/ficha.ts                   # Zod schema + inferred Ficha type
    lib/
      ficha.ts                       # load + validate fichas from content/
      motor.ts                       # pure rule engine (chuva_binaria)
      weather.ts                     # Open-Meteo URL build + parse + fetch
      db.ts                          # Turso client + freshness/confirmacoes queries
      time.ts                        # "visto há Xh" formatting
    app/
      layout.tsx                     # root layout, PWA meta, manifest link
      page.tsx                       # browse (/)
      globals.css                    # tailwind entry
      ficha/[slug]/page.tsx          # ficha (server component)
      api/confirmar/route.ts         # POST → insert confirmacao
      api/cron/motor/route.ts        # GET → run engine
      sw.ts                          # Serwist service-worker source
      manifest.ts                    # PWA manifest
    components/
      FrescorBadge.tsx               # semaphore flag (server-friendly, from estado)
      Card.tsx                       # browse card
      Semaforo.tsx                   # L5 block: estado + ressalva de proxy
      Discriminador.tsx              # L7 block: entrada + permissão de abortar
      Waypoints.tsx                  # static map embed + "abrir no Waze"
      ConfirmarButton.tsx            # client: POST + optimistic count + offline-disabled
      VistoHa.tsx                    # client: renders "visto há Xh" stamp
  tests/
    lib/motor.test.ts
    lib/weather.test.ts
    lib/db.test.ts
    lib/ficha.test.ts
    lib/time.test.ts
    api/motor.test.ts
    api/confirmar.test.ts
    components/Semaforo.test.tsx
    components/ConfirmarButton.test.tsx
  fixtures/open-meteo-sample.json    # canned Open-Meteo response for tests
```

---

### Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.local.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Next.js app at repo root, `npm test` wired to Vitest, path alias `@/*` → `src/*`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bateperna",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@libsql/client": "^0.14.0",
    "zod": "^3.24.0",
    "serwist": "^9.0.9",
    "@serwist/next": "^9.0.9"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^20.17.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022", "webworker"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "BatePerna"]
}
```

- [ ] **Step 3: Create config files**

`next.config.mjs` (Serwist added in Task 10 — start plain so the app boots):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:

```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

`.env.local.example`:

```
# Turso (create a DB at turso.tech; run db/schema.sql against it)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
# Shared secret the Vercel Cron request must send (Authorization: Bearer <CRON_SECRET>)
CRON_SECRET=choose-a-long-random-string
```

- [ ] **Step 4: Create minimal app shell**

`src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BatePerna",
  description: "Aventura pela via segura.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (placeholder, replaced in Task 8):

```tsx
export default function Home() {
  return <main className="p-6">BatePerna — em construção</main>;
}
```

- [ ] **Step 5: Write the smoke test**

`tests/smoke.test.ts`:

```typescript
import { expect, test } from "vitest";

test("test runner works", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Run: `npm test`
Expected: 1 passing test.
Run: `npm run dev` then open `http://localhost:3000`
Expected: page shows "BatePerna — em construção". Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .env.local.example src/app tests/smoke.test.ts
git commit -m "chore: scaffold Next.js + Vitest + Tailwind app shell"
```

---

### Task 2: Ficha schema + loader

**Files:**
- Create: `src/types/ficha.ts`, `src/lib/ficha.ts`, `tests/lib/ficha.test.ts`

**Interfaces:**
- Consumes: `content/fichas/rampa-do-pepe.json` (real content, committed).
- Produces:
  - `type Ficha` (Zod-inferred), `type Regra`, `type Condicao`, `type Waypoint`
  - `fichaSchema: z.ZodType<Ficha>`
  - `getFicha(slug: string): Ficha | null`
  - `getAllFichas(): Ficha[]`
  - `getFichasComCondicao(): Ficha[]` (all fichas whose `condicao` is present)

- [ ] **Step 1: Write the failing test**

`tests/lib/ficha.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getFicha, getAllFichas, getFichasComCondicao } from "@/lib/ficha";

describe("ficha loader", () => {
  it("loads and validates the real Rampa do Pepê ficha", () => {
    const f = getFicha("rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.slug).toBe("rampa-do-pepe");
    expect(f!.modos).toContain("condicional");
    expect(f!.condicao.regra.tipo).toBe("chuva_binaria");
    expect(typeof f!.condicao.coords.lat).toBe("number");
    expect(f!.trajeto.waypoints.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown slug", () => {
    expect(getFicha("nao-existe")).toBeNull();
  });

  it("lists all fichas and those with condicao", () => {
    expect(getAllFichas().length).toBeGreaterThan(0);
    expect(getFichasComCondicao().every((f) => f.condicao != null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/ficha.test.ts`
Expected: FAIL — cannot find module `@/lib/ficha`.

- [ ] **Step 3: Write the schema**

`src/types/ficha.ts`:

```typescript
import { z } from "zod";

export const waypointSchema = z.object({
  nome: z.string(),
  lat: z.number(),
  lng: z.number(),
  nota: z.string().optional(),
});

export const regraSchema = z.object({
  tipo: z.literal("chuva_binaria"),
  janela_previsao_horas: z.number(),
  janela_passado_horas: z.number(),
  limiar_mm: z.number(),
});

export const condicaoSchema = z.object({
  coords: z.object({ lat: z.number(), lng: z.number() }),
  regra: regraSchema,
  regra_texto: z.string(),
  ressalva_proxy: z.string(),
});

export const discriminadorSchema = z.object({
  formato: z.string(),
  como_ler: z.string(),
  permissao_abortar: z.string(),
});

export const fichaSchema = z.object({
  slug: z.string(),
  modos: z.array(z.string()),
  rotulo_escaneio: z.string(),
  promessa: z.string(),
  voz: z.string(),
  premio: z.string(),
  trajeto: z.object({ waypoints: z.array(waypointSchema).min(1) }),
  acesso: z.string(),
  avisos: z.string(),
  condicao: condicaoSchema,
  discriminador: discriminadorSchema,
  custo: z.object({ tag: z.enum(["gratis", "pago"]) }),
});

export type Waypoint = z.infer<typeof waypointSchema>;
export type Regra = z.infer<typeof regraSchema>;
export type Condicao = z.infer<typeof condicaoSchema>;
export type Ficha = z.infer<typeof fichaSchema>;
```

- [ ] **Step 4: Write the loader**

`src/lib/ficha.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { fichaSchema, type Ficha } from "@/types/ficha";

const FICHAS_DIR = path.join(process.cwd(), "content", "fichas");

function loadAll(): Ficha[] {
  if (!fs.existsSync(FICHAS_DIR)) return [];
  return fs
    .readdirSync(FICHAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(FICHAS_DIR, f), "utf8"));
      return fichaSchema.parse(raw); // throws on malformed content — fail loud at build/test
    });
}

export function getAllFichas(): Ficha[] {
  return loadAll();
}

export function getFicha(slug: string): Ficha | null {
  return loadAll().find((f) => f.slug === slug) ?? null;
}

export function getFichasComCondicao(): Ficha[] {
  return loadAll().filter((f) => f.condicao != null);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/ficha.test.ts`
Expected: PASS (all 3). If it fails on schema, the committed JSON and the schema disagree — reconcile the schema to the real content, do not edit the content.

- [ ] **Step 6: Commit**

```bash
git add src/types/ficha.ts src/lib/ficha.ts tests/lib/ficha.test.ts
git commit -m "feat: ficha Zod schema + content loader"
```

---

### Task 3: Motor — pure rule engine (`chuva_binaria`)

**Files:**
- Create: `src/lib/motor.ts`, `tests/lib/motor.test.ts`

**Interfaces:**
- Consumes: `Regra` from `@/types/ficha`.
- Produces:
  - `type Estado = "fresco" | "frio"`
  - `type Precip = { time: number; mm: number }` — `time` is epoch **seconds**, `mm` is precipitation for that hour
  - `avaliar(regra: Regra, precips: Precip[], agora: number): Estado`

- [ ] **Step 1: Write the failing test**

`tests/lib/motor.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { avaliar, type Precip } from "@/lib/motor";
import type { Regra } from "@/types/ficha";

const H = 3600;
const AGORA = 1_000_000; // arbitrary fixed epoch-seconds "now"
const regra: Regra = {
  tipo: "chuva_binaria",
  janela_previsao_horas: 48,
  janela_passado_horas: 48,
  limiar_mm: 0.2,
};

function precip(offsetHours: number, mm: number): Precip {
  return { time: AGORA + offsetHours * H, mm };
}

describe("motor chuva_binaria", () => {
  it("returns 'fresco' when dry in both windows", () => {
    const precips = [precip(-24, 0), precip(-1, 0), precip(12, 0), precip(40, 0)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("returns 'frio' when rain in the forecast window", () => {
    const precips = [precip(-1, 0), precip(10, 0.5)];
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });

  it("returns 'frio' when rain in the past window (mud holds water)", () => {
    const precips = [precip(-6, 0.9), precip(10, 0)];
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });

  it("ignores rain outside both windows", () => {
    const precips = [precip(-60, 5), precip(60, 5)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("respects the threshold (below limiar = fresco)", () => {
    const precips = [precip(-3, 0.1), precip(3, 0.1)];
    expect(avaliar(regra, precips, AGORA)).toBe("fresco");
  });

  it("threshold boundary: sum >= limiar = frio", () => {
    const precips = [precip(-3, 0.1), precip(-2, 0.1)]; // past sum 0.2 == limiar
    expect(avaliar(regra, precips, AGORA)).toBe("frio");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/motor.test.ts`
Expected: FAIL — cannot find module `@/lib/motor`.

- [ ] **Step 3: Write the implementation**

`src/lib/motor.ts`:

```typescript
import type { Regra } from "@/types/ficha";

export type Estado = "fresco" | "frio";
export type Precip = { time: number; mm: number }; // time = epoch seconds

const H = 3600;

/**
 * Binary rain rule: rain accumulated in the past window OR the forecast window
 * at/above the threshold => 'frio' (mud holds water; don't go). Otherwise 'fresco'.
 * Generic dispatch on regra.tipo leaves room for future rule types.
 */
export function avaliar(regra: Regra, precips: Precip[], agora: number): Estado {
  switch (regra.tipo) {
    case "chuva_binaria": {
      const pastStart = agora - regra.janela_passado_horas * H;
      const futEnd = agora + regra.janela_previsao_horas * H;
      const pastSum = precips
        .filter((p) => p.time >= pastStart && p.time <= agora)
        .reduce((s, p) => s + p.mm, 0);
      const futSum = precips
        .filter((p) => p.time > agora && p.time <= futEnd)
        .reduce((s, p) => s + p.mm, 0);
      return pastSum >= regra.limiar_mm || futSum >= regra.limiar_mm
        ? "frio"
        : "fresco";
    }
    default:
      // Exhaustiveness: unknown rule types are a programming error.
      throw new Error(`regra.tipo não suportada: ${(regra as { tipo: string }).tipo}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/motor.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/motor.ts tests/lib/motor.test.ts
git commit -m "feat: motor binário chuva (passado + previsão)"
```

---

### Task 4: Weather — Open-Meteo URL build + parse + fetch

**Files:**
- Create: `src/lib/weather.ts`, `tests/lib/weather.test.ts`, `fixtures/open-meteo-sample.json`

**Interfaces:**
- Consumes: `Condicao["coords"]`, `Regra` from `@/types/ficha`; `Precip` from `@/lib/motor`.
- Produces:
  - `type OpenMeteoResponse = { hourly: { time: string[]; precipitation: number[] } }`
  - `buildUrl(coords: { lat: number; lng: number }, regra: Regra): string`
  - `parsePrecip(resp: OpenMeteoResponse): Precip[]`
  - `fetchPrecip(coords, regra): Promise<{ precips: Precip[]; raw: OpenMeteoResponse }>`

- [ ] **Step 1: Create the fixture**

`fixtures/open-meteo-sample.json` (small, hand-made; UTC naive times under `timezone=GMT`):

```json
{
  "hourly": {
    "time": ["2026-08-01T00:00", "2026-08-01T01:00", "2026-08-02T00:00", "2026-08-02T01:00"],
    "precipitation": [0.0, 0.3, 0.0, 0.0]
  }
}
```

- [ ] **Step 2: Write the failing test**

`tests/lib/weather.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildUrl, parsePrecip, type OpenMeteoResponse } from "@/lib/weather";
import type { Regra } from "@/types/ficha";
import sample from "../../fixtures/open-meteo-sample.json";

const regra: Regra = {
  tipo: "chuva_binaria",
  janela_previsao_horas: 48,
  janela_passado_horas: 48,
  limiar_mm: 0.2,
};

describe("weather", () => {
  it("builds an Open-Meteo URL with coords, precipitation, past+forecast days, GMT", () => {
    const url = buildUrl({ lat: -7.907889, lng: -36.019222 }, regra);
    expect(url).toContain("latitude=-7.907889");
    expect(url).toContain("longitude=-36.019222");
    expect(url).toContain("hourly=precipitation");
    expect(url).toContain("past_days=2");
    expect(url).toContain("forecast_days=2");
    expect(url).toContain("timezone=GMT");
  });

  it("parses hourly time/precipitation into epoch-seconds Precip[]", () => {
    const precips = parsePrecip(sample as OpenMeteoResponse);
    expect(precips).toHaveLength(4);
    // 2026-08-01T01:00Z
    expect(precips[1].time).toBe(Date.parse("2026-08-01T01:00Z") / 1000);
    expect(precips[1].mm).toBe(0.3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/weather.test.ts`
Expected: FAIL — cannot find module `@/lib/weather`.

- [ ] **Step 4: Write the implementation**

`src/lib/weather.ts`:

```typescript
import type { Regra } from "@/types/ficha";
import type { Precip } from "@/lib/motor";

export type OpenMeteoResponse = {
  hourly: { time: string[]; precipitation: number[] };
};

const H_PER_DAY = 24;

export function buildUrl(
  coords: { lat: number; lng: number },
  regra: Regra,
): string {
  const pastDays = Math.max(1, Math.ceil(regra.janela_passado_horas / H_PER_DAY));
  const forecastDays = Math.max(1, Math.ceil(regra.janela_previsao_horas / H_PER_DAY));
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lng),
    hourly: "precipitation",
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    timezone: "GMT",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function parsePrecip(resp: OpenMeteoResponse): Precip[] {
  const { time, precipitation } = resp.hourly;
  return time.map((t, i) => ({
    time: Date.parse(`${t}Z`) / 1000, // GMT naive ISO -> epoch seconds
    mm: precipitation[i] ?? 0,
  }));
}

export async function fetchPrecip(
  coords: { lat: number; lng: number },
  regra: Regra,
): Promise<{ precips: Precip[]; raw: OpenMeteoResponse }> {
  const res = await fetch(buildUrl(coords, regra), { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const raw = (await res.json()) as OpenMeteoResponse;
  return { precips: parsePrecip(raw), raw };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/weather.test.ts`
Expected: PASS (both).

- [ ] **Step 6: Commit**

```bash
git add src/lib/weather.ts tests/lib/weather.test.ts fixtures/open-meteo-sample.json
git commit -m "feat: Open-Meteo fetch/parse (past + forecast precipitation)"
```

---

### Task 5: Turso data access

**Files:**
- Create: `src/lib/db.ts`, `tests/lib/db.test.ts`, `db/schema.sql`

**Interfaces:**
- Consumes: env `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Produces:
  - `type Freshness = { ficha_slug: string; estado: string; calculado_em: number; fonte: string; previsao_bruta: string | null }`
  - `getClient(): Client` (singleton from env)
  - `upsertFreshness(client, row: { slug: string; estado: string; calculadoEm: number; fonte: string; previsaoBruta: string }): Promise<void>`
  - `getFreshness(client, slug: string): Promise<Freshness | null>`
  - `insertConfirmacao(client, slug: string, criadoEm: number): Promise<void>`
  - `countConfirmacoes(client, slug: string): Promise<number>`
  - `ensureSchema(client): Promise<void>` (idempotent `CREATE TABLE IF NOT EXISTS` — used by tests and safe in prod)

  Note: query functions take an explicit `client` so tests can pass an in-memory client. `getClient()` is only used by routes.

- [ ] **Step 1: Write the schema file**

`db/schema.sql` (run once against the real Turso DB via `turso db shell`):

```sql
CREATE TABLE IF NOT EXISTS freshness (
  ficha_slug     TEXT PRIMARY KEY,
  estado         TEXT NOT NULL,
  calculado_em   INTEGER NOT NULL,
  fonte          TEXT NOT NULL,
  previsao_bruta TEXT
);

CREATE TABLE IF NOT EXISTS confirmacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_slug  TEXT NOT NULL,
  criado_em   INTEGER NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'foi'
);
```

- [ ] **Step 2: Write the failing test**

`tests/lib/db.test.ts`:

```typescript
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureSchema,
  upsertFreshness,
  getFreshness,
  insertConfirmacao,
  countConfirmacoes,
} from "@/lib/db";

let client: Client;

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("db", () => {
  it("upserts and reads freshness (idempotent)", async () => {
    await upsertFreshness(client, {
      slug: "rampa-do-pepe",
      estado: "frio",
      calculadoEm: 1000,
      fonte: "open-meteo",
      previsaoBruta: "{}",
    });
    await upsertFreshness(client, {
      slug: "rampa-do-pepe",
      estado: "fresco",
      calculadoEm: 2000,
      fonte: "open-meteo",
      previsaoBruta: "{}",
    });
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.estado).toBe("fresco");
    expect(f!.calculado_em).toBe(2000);
  });

  it("returns null freshness for unknown slug", async () => {
    expect(await getFreshness(client, "nope")).toBeNull();
  });

  it("inserts and counts confirmacoes", async () => {
    expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(0);
    await insertConfirmacao(client, "rampa-do-pepe", 1000);
    await insertConfirmacao(client, "rampa-do-pepe", 1001);
    expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: FAIL — cannot find module `@/lib/db`.

- [ ] **Step 4: Write the implementation**

`src/lib/db.ts`:

```typescript
import { createClient, type Client } from "@libsql/client";

export type Freshness = {
  ficha_slug: string;
  estado: string;
  calculado_em: number;
  fonte: string;
  previsao_bruta: string | null;
};

let singleton: Client | null = null;

export function getClient(): Client {
  if (singleton) return singleton;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL não configurada");
  singleton = createClient({ url, authToken });
  return singleton;
}

export async function ensureSchema(client: Client): Promise<void> {
  await client.execute(`CREATE TABLE IF NOT EXISTS freshness (
    ficha_slug TEXT PRIMARY KEY, estado TEXT NOT NULL, calculado_em INTEGER NOT NULL,
    fonte TEXT NOT NULL, previsao_bruta TEXT)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS confirmacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    criado_em INTEGER NOT NULL, tipo TEXT NOT NULL DEFAULT 'foi')`);
}

export async function upsertFreshness(
  client: Client,
  row: { slug: string; estado: string; calculadoEm: number; fonte: string; previsaoBruta: string },
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO freshness (ficha_slug, estado, calculado_em, fonte, previsao_bruta)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ficha_slug) DO UPDATE SET
            estado = excluded.estado,
            calculado_em = excluded.calculado_em,
            fonte = excluded.fonte,
            previsao_bruta = excluded.previsao_bruta`,
    args: [row.slug, row.estado, row.calculadoEm, row.fonte, row.previsaoBruta],
  });
}

export async function getFreshness(client: Client, slug: string): Promise<Freshness | null> {
  const rs = await client.execute({
    sql: `SELECT ficha_slug, estado, calculado_em, fonte, previsao_bruta
          FROM freshness WHERE ficha_slug = ?`,
    args: [slug],
  });
  const r = rs.rows[0];
  if (!r) return null;
  return {
    ficha_slug: String(r.ficha_slug),
    estado: String(r.estado),
    calculado_em: Number(r.calculado_em),
    fonte: String(r.fonte),
    previsao_bruta: r.previsao_bruta == null ? null : String(r.previsao_bruta),
  };
}

export async function insertConfirmacao(client: Client, slug: string, criadoEm: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO confirmacoes (ficha_slug, criado_em) VALUES (?, ?)`,
    args: [slug, criadoEm],
  });
}

export async function countConfirmacoes(client: Client, slug: string): Promise<number> {
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM confirmacoes WHERE ficha_slug = ?`,
    args: [slug],
  });
  return Number(rs.rows[0]?.n ?? 0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: PASS (all 3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts tests/lib/db.test.ts db/schema.sql
git commit -m "feat: Turso data access (freshness upsert/get, confirmacoes)"
```

---

### Task 6: Cron motor route

**Files:**
- Create: `src/app/api/cron/motor/route.ts`, `tests/api/motor.test.ts`
- Create: `src/lib/runMotor.ts` (the testable core, decoupled from the HTTP handler)

**Interfaces:**
- Consumes: `getFichasComCondicao`, `fetchPrecip`, `avaliar`, `upsertFreshness`, a `Client`.
- Produces:
  - `runMotor(deps: { client: Client; agora: number; fetchPrecipFn?: typeof fetchPrecip }): Promise<{ atualizadas: number }>`
  - `GET(req: Request): Promise<Response>` route handler (checks `CRON_SECRET`, calls `runMotor`)

- [ ] **Step 1: Write the failing test**

`tests/api/motor.test.ts`:

```typescript
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, getFreshness } from "@/lib/db";
import { runMotor } from "@/lib/runMotor";

let client: Client;
beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("runMotor", () => {
  it("writes 'frio' when the injected forecast has rain", async () => {
    const fakeFetch = async () => ({
      precips: [{ time: 1000 + 3600, mm: 1.0 }], // 1h ahead of agora=1000
      raw: { hourly: { time: [], precipitation: [] } },
    });
    const res = await runMotor({ client, agora: 1000, fetchPrecipFn: fakeFetch as never });
    expect(res.atualizadas).toBeGreaterThanOrEqual(1);
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f!.estado).toBe("frio");
    expect(f!.calculado_em).toBe(1000);
  });

  it("writes 'fresco' when the injected forecast is dry", async () => {
    const fakeFetch = async () => ({
      precips: [{ time: 1000 + 3600, mm: 0 }],
      raw: { hourly: { time: [], precipitation: [] } },
    });
    await runMotor({ client, agora: 1000, fetchPrecipFn: fakeFetch as never });
    const f = await getFreshness(client, "rampa-do-pepe");
    expect(f!.estado).toBe("fresco");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/motor.test.ts`
Expected: FAIL — cannot find module `@/lib/runMotor`.

- [ ] **Step 3: Write the testable core**

`src/lib/runMotor.ts`:

```typescript
import type { Client } from "@libsql/client";
import { getFichasComCondicao } from "@/lib/ficha";
import { fetchPrecip } from "@/lib/weather";
import { avaliar } from "@/lib/motor";
import { upsertFreshness } from "@/lib/db";

type Deps = {
  client: Client;
  agora: number; // epoch seconds
  fetchPrecipFn?: typeof fetchPrecip;
};

export async function runMotor(deps: Deps): Promise<{ atualizadas: number }> {
  const fetchPrecipFn = deps.fetchPrecipFn ?? fetchPrecip;
  const fichas = getFichasComCondicao();
  let atualizadas = 0;
  for (const ficha of fichas) {
    try {
      const { precips, raw } = await fetchPrecipFn(ficha.condicao.coords, ficha.condicao.regra);
      const estado = avaliar(ficha.condicao.regra, precips, deps.agora);
      await upsertFreshness(deps.client, {
        slug: ficha.slug,
        estado,
        calculadoEm: deps.agora,
        fonte: "open-meteo",
        previsaoBruta: JSON.stringify(raw),
      });
      atualizadas++;
    } catch (err) {
      // Fail gracefully: do NOT overwrite the good state on a provider error.
      console.error(`motor: falha em ${ficha.slug}:`, err);
    }
  }
  return { atualizadas };
}
```

- [ ] **Step 4: Write the route handler**

`src/app/api/cron/motor/route.ts`:

```typescript
import { getClient } from "@/lib/db";
import { runMotor } from "@/lib/runMotor";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const agora = Math.floor(Date.now() / 1000);
  const result = await runMotor({ client: getClient(), agora });
  return Response.json(result);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/motor.test.ts`
Expected: PASS (both).

- [ ] **Step 6: Commit**

```bash
git add src/lib/runMotor.ts src/app/api/cron/motor/route.ts tests/api/motor.test.ts
git commit -m "feat: cron motor route (fetch -> rule -> upsert freshness)"
```

---

### Task 7: Confirmar route

**Files:**
- Create: `src/app/api/confirmar/route.ts`, `tests/api/confirmar.test.ts`
- Create: `src/lib/confirmar.ts` (testable core)

**Interfaces:**
- Consumes: `insertConfirmacao`, `countConfirmacoes`, a `Client`.
- Produces:
  - `registrarConfirmacao(client, slug: string, agora: number): Promise<{ count: number }>`
  - `POST(req: Request): Promise<Response>` — body `{ slug: string }`, returns `{ count }`

- [ ] **Step 1: Write the failing test**

`tests/api/confirmar.test.ts`:

```typescript
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema } from "@/lib/db";
import { registrarConfirmacao } from "@/lib/confirmar";

let client: Client;
beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("registrarConfirmacao", () => {
  it("inserts a confirmation and returns the running count", async () => {
    const a = await registrarConfirmacao(client, "rampa-do-pepe", 1000);
    expect(a.count).toBe(1);
    const b = await registrarConfirmacao(client, "rampa-do-pepe", 1001);
    expect(b.count).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/confirmar.test.ts`
Expected: FAIL — cannot find module `@/lib/confirmar`.

- [ ] **Step 3: Write the core + route**

`src/lib/confirmar.ts`:

```typescript
import type { Client } from "@libsql/client";
import { insertConfirmacao, countConfirmacoes } from "@/lib/db";

export async function registrarConfirmacao(
  client: Client,
  slug: string,
  agora: number,
): Promise<{ count: number }> {
  await insertConfirmacao(client, slug, agora);
  return { count: await countConfirmacoes(client, slug) };
}
```

`src/app/api/confirmar/route.ts`:

```typescript
import { getClient } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let slug: unknown;
  try {
    slug = (await req.json())?.slug;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof slug !== "string" || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  const result = await registrarConfirmacao(getClient(), slug, agora);
  return Response.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/confirmar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/confirmar.ts src/app/api/confirmar/route.ts tests/api/confirmar.test.ts
git commit -m "feat: confirmar route (insert + running count)"
```

---

### Task 8: Browse page + freshness badge

**Files:**
- Create: `src/components/FrescorBadge.tsx`, `src/components/Card.tsx`
- Modify: `src/app/page.tsx`
- Create: `tests/components/FrescorBadge.test.tsx`

**Interfaces:**
- Consumes: `getAllFichas`, `getFreshness`, `getClient`.
- Produces:
  - `FrescorBadge({ estado }: { estado: string | null }): JSX.Element` — 🟢 fresco / 🔴 frio / ⚪ sem dado
  - `Card({ ficha, estado }): JSX.Element`
  - `Home` server component listing all fichas with their freshness.

- [ ] **Step 1: Write the failing test**

`tests/components/FrescorBadge.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FrescorBadge } from "@/components/FrescorBadge";

describe("FrescorBadge", () => {
  it("shows fresco", () => {
    render(<FrescorBadge estado="fresco" />);
    expect(screen.getByText(/fresco/i)).toBeTruthy();
  });
  it("shows frio", () => {
    render(<FrescorBadge estado="frio" />);
    expect(screen.getByText(/frio|não vá|nao va/i)).toBeTruthy();
  });
  it("shows sem-dado when null", () => {
    render(<FrescorBadge estado={null} />);
    expect(screen.getByText(/sem dado|verificando/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/FrescorBadge.test.tsx`
Expected: FAIL — cannot find module `@/components/FrescorBadge`.

- [ ] **Step 3: Write the badge**

`src/components/FrescorBadge.tsx`:

```tsx
export function FrescorBadge({ estado }: { estado: string | null }) {
  if (estado === "fresco") {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-800">🟢 fresco</span>;
  }
  if (estado === "frio") {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-800">🔴 frio — não vá</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">⚪ sem dado</span>;
}
```

- [ ] **Step 4: Write the card**

`src/components/Card.tsx`:

```tsx
import Link from "next/link";
import type { Ficha } from "@/types/ficha";
import { FrescorBadge } from "@/components/FrescorBadge";

export function Card({ ficha, estado }: { ficha: Ficha; estado: string | null }) {
  return (
    <Link href={`/ficha/${ficha.slug}`} className="block rounded-lg border p-4 hover:bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{ficha.rotulo_escaneio}</span>
        <FrescorBadge estado={estado} />
      </div>
      <p className="mt-2 font-medium">{ficha.promessa}</p>
    </Link>
  );
}
```

- [ ] **Step 5: Write the browse page**

`src/app/page.tsx`:

```tsx
import { getAllFichas } from "@/lib/ficha";
import { getClient, getFreshness } from "@/lib/db";
import { Card } from "@/components/Card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const fichas = getAllFichas();
  const client = getClient();
  const cards = await Promise.all(
    fichas.map(async (ficha) => ({
      ficha,
      estado: (await getFreshness(client, ficha.slug))?.estado ?? null,
    })),
  );
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-bold">BatePerna</h1>
      {cards.map(({ ficha, estado }) => (
        <Card key={ficha.slug} ficha={ficha} estado={estado} />
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Run test + manual check**

Run: `npx vitest run tests/components/FrescorBadge.test.tsx`
Expected: PASS (all 3).
Manual (needs `.env.local` + schema applied — see Task 11): `npm run dev`, open `/`, confirm the Rampa card shows with a freshness badge.

- [ ] **Step 7: Commit**

```bash
git add src/components/FrescorBadge.tsx src/components/Card.tsx src/app/page.tsx tests/components/FrescorBadge.test.tsx
git commit -m "feat: browse page with freshness badge"
```

---

### Task 9: Ficha page + L5/L7 blocks + Confirmar

**Files:**
- Create: `src/components/Semaforo.tsx`, `src/components/Discriminador.tsx`, `src/components/Waypoints.tsx`, `src/components/ConfirmarButton.tsx`
- Create: `src/app/ficha/[slug]/page.tsx`
- Create: `tests/components/Semaforo.test.tsx`, `tests/components/ConfirmarButton.test.tsx`

**Interfaces:**
- Consumes: `getFicha`, `getClient`, `getFreshness`, `countConfirmacoes`, `Ficha`, `Condicao`, `Discriminador`.
- Produces:
  - `Semaforo({ condicao, estado }): JSX.Element` — L5 flag + `ressalva_proxy`
  - `Discriminador({ discriminador }): JSX.Element` — L7 entrada + `permissao_abortar`
  - `Waypoints({ waypoints }): JSX.Element` — static map + Waze link
  - `ConfirmarButton({ slug, inicial }: { slug: string; inicial: number }): JSX.Element` — client component, POSTs, disabled offline
  - Ficha server page.

- [ ] **Step 1: Write the failing tests**

`tests/components/Semaforo.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Semaforo } from "@/components/Semaforo";
import type { Condicao } from "@/types/ficha";

const condicao: Condicao = {
  coords: { lat: -7.9, lng: -36.0 },
  regra: { tipo: "chuva_binaria", janela_previsao_horas: 48, janela_passado_horas: 48, limiar_mm: 0.2 },
  regra_texto: "Choveu → não suba.",
  ressalva_proxy: "Chuva medida ≠ barro na entrada.",
};

describe("Semaforo", () => {
  it("renders the estado and always shows the proxy caveat", () => {
    render(<Semaforo condicao={condicao} estado="frio" />);
    expect(screen.getByText(/frio|não vá|nao va/i)).toBeTruthy();
    expect(screen.getByText(/barro na entrada/i)).toBeTruthy();
  });
});
```

`tests/components/ConfirmarButton.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmarButton } from "@/components/ConfirmarButton";

afterEach(() => vi.restoreAllMocks());

describe("ConfirmarButton", () => {
  it("posts and updates the count on click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ count: 4 }) })));
    render(<ConfirmarButton slug="rampa-do-pepe" inicial={3} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/4/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/Semaforo.test.tsx tests/components/ConfirmarButton.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write Semaforo**

`src/components/Semaforo.tsx`:

```tsx
import type { Condicao } from "@/types/ficha";
import { FrescorBadge } from "@/components/FrescorBadge";

export function Semaforo({ condicao, estado }: { condicao: Condicao; estado: string | null }) {
  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden>🚦</span>
        <FrescorBadge estado={estado} />
      </div>
      <p className="mt-2 text-sm">{condicao.regra_texto}</p>
      <p className="mt-1 text-xs italic text-gray-600">{condicao.ressalva_proxy}</p>
    </section>
  );
}
```

- [ ] **Step 4: Write Discriminador + Waypoints**

`src/components/Discriminador.tsx`:

```tsx
import type { Ficha } from "@/types/ficha";

export function Discriminador({ discriminador }: { discriminador: Ficha["discriminador"] }) {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2 font-medium">
        <span aria-hidden>🧭</span> Na entrada
      </div>
      <p className="mt-2 text-sm">{discriminador.como_ler}</p>
      <p className="mt-1 text-sm font-medium text-amber-900">{discriminador.permissao_abortar}</p>
    </section>
  );
}
```

`src/components/Waypoints.tsx`:

```tsx
import type { Waypoint } from "@/types/ficha";

export function Waypoints({ waypoints }: { waypoints: Waypoint[] }) {
  const first = waypoints[0];
  const wazeHref = `https://waze.com/ul?ll=${first.lat}%2C${first.lng}&navigate=yes`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${first.lng - 0.02}%2C${first.lat - 0.02}%2C${first.lng + 0.02}%2C${first.lat + 0.02}&marker=${first.lat}%2C${first.lng}`;
  return (
    <section className="space-y-2">
      <iframe title="mapa" src={mapSrc} className="h-56 w-full rounded-lg border" loading="lazy" />
      <ol className="list-decimal pl-5 text-sm">
        {waypoints.map((w, i) => (
          <li key={i}>
            <span className="font-medium">{w.nome}</span>
            {w.nota ? ` — ${w.nota}` : null}
          </li>
        ))}
      </ol>
      <a href={wazeHref} className="inline-block rounded bg-blue-600 px-3 py-2 text-sm text-white">
        Abrir no Waze
      </a>
    </section>
  );
}
```

- [ ] **Step 5: Write ConfirmarButton (client)**

`src/components/ConfirmarButton.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";

export function ConfirmarButton({ slug, inicial }: { slug: string; inicial: number }) {
  const [count, setCount] = useState(inicial);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function confirmar() {
    setLoading(true);
    try {
      const res = await fetch("/api/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) setCount((await res.json()).count);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={confirmar}
        disabled={!online || loading}
        className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-40"
      >
        {online ? "Já fui / confirmar" : "Offline"}
      </button>
      <span className="text-sm text-gray-700">{count} confirmações</span>
    </div>
  );
}
```

- [ ] **Step 6: Write the ficha page**

`src/app/ficha/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getFicha } from "@/lib/ficha";
import { getClient, getFreshness, countConfirmacoes } from "@/lib/db";
import { Semaforo } from "@/components/Semaforo";
import { Discriminador } from "@/components/Discriminador";
import { Waypoints } from "@/components/Waypoints";
import { ConfirmarButton } from "@/components/ConfirmarButton";
import { VistoHa } from "@/components/VistoHa";

export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ficha = getFicha(slug);
  if (!ficha) notFound();

  const client = getClient();
  const fresh = await getFreshness(client, slug);
  const count = await countConfirmacoes(client, slug);

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <p className="text-lg font-semibold">{ficha.voz}</p>
      <p>{ficha.premio}</p>
      <Waypoints waypoints={ficha.trajeto.waypoints} />
      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Como ir</h2>
        <p className="mt-1 text-sm">{ficha.acesso}</p>
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="font-medium">Antes de ir</h2>
        <p className="mt-1 text-sm">{ficha.avisos}</p>
      </section>
      <Semaforo condicao={ficha.condicao} estado={fresh?.estado ?? null} />
      <Discriminador discriminador={ficha.discriminador} />
      <p className="text-xs text-gray-500">
        Custo: {ficha.custo.tag}
        {fresh ? <> · <VistoHa calculadoEm={fresh.calculado_em} /></> : null}
      </p>
      <ConfirmarButton slug={ficha.slug} inicial={count} />
    </main>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/components/Semaforo.test.tsx tests/components/ConfirmarButton.test.tsx`
Expected: PASS (both). (`VistoHa` is created in Task 10; if running the ficha page before then, temporarily omit the `VistoHa` import — but tests here don't import the page.)

- [ ] **Step 8: Commit**

```bash
git add src/components/Semaforo.tsx src/components/Discriminador.tsx src/components/Waypoints.tsx src/components/ConfirmarButton.tsx src/app/ficha tests/components/Semaforo.test.tsx tests/components/ConfirmarButton.test.tsx
git commit -m "feat: ficha page with L5 semaforo, L7 discriminador, waypoints, confirmar"
```

---

### Task 10: PWA / offline (Serwist) + "visto há Xh" stamp

**Files:**
- Create: `src/lib/time.ts`, `tests/lib/time.test.ts`, `src/components/VistoHa.tsx`
- Create: `src/app/sw.ts`, `src/app/manifest.ts`
- Modify: `next.config.mjs`, `src/app/layout.tsx`
- Create: PWA icons in `public/` (`icon-192.png`, `icon-512.png`)

**Interfaces:**
- Consumes: `Freshness.calculado_em`.
- Produces:
  - `formatVistoHa(calculadoEm: number, agora: number): string` — e.g. `"visto há 3h"`, `"visto agora"`
  - `VistoHa({ calculadoEm }): JSX.Element` (client, reads its own `Date.now()`)
  - a compiled service worker at `public/sw.js`, a web manifest, installable PWA.

- [ ] **Step 1: Write the failing test for time formatting**

`tests/lib/time.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatVistoHa } from "@/lib/time";

const AGORA = 100_000; // epoch seconds

describe("formatVistoHa", () => {
  it("says 'agora' under an hour", () => {
    expect(formatVistoHa(AGORA - 600, AGORA)).toMatch(/agora/);
  });
  it("says 'há 3h' for three hours", () => {
    expect(formatVistoHa(AGORA - 3 * 3600, AGORA)).toMatch(/3\s*h/);
  });
  it("says days for long gaps", () => {
    expect(formatVistoHa(AGORA - 50 * 3600, AGORA)).toMatch(/2\s*d/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: FAIL — cannot find module `@/lib/time`.

- [ ] **Step 3: Write the formatter + component**

`src/lib/time.ts`:

```typescript
export function formatVistoHa(calculadoEm: number, agora: number): string {
  const secs = Math.max(0, agora - calculadoEm);
  const horas = Math.floor(secs / 3600);
  if (horas < 1) return "visto agora";
  if (horas < 24) return `visto há ${horas}h`;
  return `visto há ${Math.floor(horas / 24)}d`;
}
```

`src/components/VistoHa.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { formatVistoHa } from "@/lib/time";

export function VistoHa({ calculadoEm }: { calculadoEm: number }) {
  const [txt, setTxt] = useState(`visto há ${"…"}`);
  useEffect(() => {
    setTxt(`${formatVistoHa(calculadoEm, Math.floor(Date.now() / 1000))} — pode ter mudado`);
  }, [calculadoEm]);
  return <span>{txt}</span>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/time.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Add Serwist service worker + manifest**

`src/app/sw.ts`:

```typescript
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (string | { url: string; revision: string | null })[] };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

`src/app/manifest.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BatePerna",
    short_name: "BatePerna",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 6: Wire Serwist into `next.config.mjs`**

```javascript
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSerwist(nextConfig);
```

- [ ] **Step 7: Add icons + verify build**

Create `public/icon-192.png` and `public/icon-512.png` (any solid-color PNGs of the right size — placeholders acceptable for the skeleton).
Run: `npm run build`
Expected: build succeeds and `public/sw.js` is generated.

- [ ] **Step 8: Commit**

```bash
git add src/lib/time.ts tests/lib/time.test.ts src/components/VistoHa.tsx src/app/sw.ts src/app/manifest.ts next.config.mjs public/icon-192.png public/icon-512.png
git commit -m "feat: PWA (Serwist) + manifest + 'visto há Xh' stamp"
```

---

### Task 11: Vercel deploy config + end-to-end verification

**Files:**
- Create: `vercel.json`
- Create/Modify: `README.md` (setup + run notes)

**Interfaces:**
- Consumes: everything above.
- Produces: a deployed, installable PWA whose freshness flips when it rains; the DoD is met.

- [ ] **Step 1: Add the cron schedule**

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/motor", "schedule": "0 */6 * * *" }]
}
```

> Vercel Cron sends the request with the project's `CRON_SECRET` as `Authorization: Bearer <CRON_SECRET>` when that env var is set — matching the check in Task 6.

- [ ] **Step 2: Provision Turso + env**

Manual (run once):
```bash
# create DB and apply schema
turso db create bateperna
turso db shell bateperna < db/schema.sql
turso db show bateperna --url        # -> TURSO_DATABASE_URL
turso db tokens create bateperna     # -> TURSO_AUTH_TOKEN
```
Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CRON_SECRET` in Vercel Project → Settings → Environment Variables (and in local `.env.local` for dev).

- [ ] **Step 3: Local end-to-end dry run**

Run: `npm run build && npm start`
- Open `/` → the Rampa card renders (badge may be ⚪ until the motor runs).
- Trigger the motor manually:
  `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/motor`
  Expected JSON: `{ "atualizadas": 1 }`.
- Reload `/` and `/ficha/rampa-do-pepe` → badge reflects real weather (🟢/🔴).
- **Force the state to flip:** temporarily lower `limiar_mm` to `0` in `content/fichas/rampa-do-pepe.json` (or point coords at a rainy place), re-run the motor, confirm 🔴; then revert. (Reverting keeps content honest — do not commit the forced value.)
- Click **Confirmar** → count increments.

- [ ] **Step 4: Deploy + verify on device**

- Push the branch and deploy to Vercel (`vercel --prod` or via Git integration).
- On a phone: open the URL, **install** the PWA (Add to Home Screen).
- Airplane mode → open the ficha → actionable content (voz, prêmio, trajeto, acesso, avisos, discriminador) still renders; freshness shows last value + "visto há Xh — pode ter mudado"; **Confirmar** is disabled.
- Back online → in Vercel dashboard confirm the cron ran (Deployments → Crons / function logs) and `previsao_bruta` is stored (inspect via `turso db shell bateperna "SELECT ficha_slug, estado, calculado_em FROM freshness"`).

- [ ] **Step 5: Full test suite green**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Write README + commit**

Add a `README.md` with: what this is, required env vars, `db/schema.sql` step, `npm run dev`, how the motor is triggered (cron in prod / curl locally), and the "force flip" verification recipe.

```bash
git add vercel.json README.md
git commit -m "chore: vercel cron config + README + e2e verification"
```

---

## Self-Review

**1. Spec coverage** (against `specs/2026-07-30-fase1-walking-skeleton-design.md`):

| Spec item | Task |
|---|---|
| Autoria = conteúdo-no-repo (JSON) | 2 (loader) |
| Browse = 1 card + bandeira de frescor | 8 |
| Ficha = anatomia L2–L7 | 9 |
| Motor = Cron→Open-Meteo→regra binária→estado no Turso | 3,4,5,6,11 |
| **Chuva passada + prevista** (decisão 2026-08-02) | 3 (windows), 4 (`past_days`) |
| Frescor na tela = L5 semáforo + ressalva de proxy | 9 (Semaforo) |
| Confirmar = 1 sinal + contagem, **sem login** | 7,9 |
| Offline = parte acionável + último frescor "visto há Xh" | 10 |
| Confirmar desabilitado offline | 9 (ConfirmarButton) |
| Mapa = embed estático + link Waze | 9 (Waypoints) |
| Deploy PWA na Vercel | 10,11 |
| Idempotência / falha graciosa / transparência (`previsao_bruta`) | 5 (upsert), 6 (try/catch), 5+6 (raw) |
| Rastreabilidade REQ-1,2,3,4,6,7,8,9,10/11/12 | 2,8,9 (content→UI), 3–6 (motor) |
| Slots de engrossar (decaimento, 2 sinais, hub, ramificar, condição-de-prêmio) | left as data/columns; no code needed in fio 1 |

No uncovered spec requirement found.

**2. Placeholder scan:** No "TBD"/"add error handling"/"write tests for the above" left. Motor failure handling is concrete (try/catch, don't overwrite). PWA icons are explicitly "solid-color placeholder PNGs" (a content asset, not a code placeholder).

**3. Type consistency:** `Estado`, `Precip` defined in Task 3 and reused (Task 4 imports `Precip`, Task 6 uses `avaliar`); `Freshness` defined Task 5, consumed 6/8/9; `Ficha`/`Condicao`/`Regra`/`Waypoint` from Task 2 used throughout; `runMotor`/`registrarConfirmacao` signatures match their route callers; `formatVistoHa(calculadoEm, agora)` consistent between Task 10 lib and component. `getClient()` vs test-injected `client` boundary is consistent (query fns always take `client`).

---

## Notes / risks for the executor

- **Next 15 `params` is async** — the ficha page awaits `params` (shown). Keep that if on Next 15; on 14 it's sync.
- **libSQL `:memory:` in tests** — each test file creates its own client + `ensureSchema`; no shared state.
- **Open-Meteo** returns `precipitation` in mm/h; `past_days`/`forecast_days` are whole days, so we fetch slightly wider than the hour windows and the motor trims to exact windows — correct by construction.
- **Do not commit forced test values** into `content/fichas/rampa-do-pepe.json` (the limiar/coords flip in Task 11 Step 3 is temporary).
