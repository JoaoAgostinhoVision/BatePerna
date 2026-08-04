# "Fui" de verdade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o botão "✓ Fui" da Rampa funcionar de verdade — registra presença + o que o cliente encontrou no portão (seco/barro) e devolve um placar do dia.

**Architecture:** Reusa o data-access libSQL já construído (`db.ts`, `confirmar.ts`, rota `confirmar`), só ampliando: `tipo` passa a ser `'seco'|'barro'`, nova query `contarHoje`, a rota ganha `GET`. Um componente cliente novo (`ConfirmarFui`) faz o POST/GET; a página troca o bloco estático por ele. O carimbo ao vivo continua só-clima e **nunca** toca o banco (invariante de fail-safe). Store = Turso provisionado via Vercel Marketplace.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `@libsql/client` (Turso), vitest + @testing-library/react (jsdom).

## Global Constraints

- Testes com libSQL `:memory:` + `ensureSchema` no `beforeEach` (padrão existente em `tests/lib/db.test.ts`). Imports via alias `@/`.
- TDD estrito: teste falha → implementação mínima → teste passa → commit. Um passo = uma ação.
- Confirmação é **anônima** (sem login).
- `tipo` do relato é exatamente `"seco" | "barro"`.
- Janela do placar = "hoje" no fuso **America/Recife (UTC−3, sem horário de verão)**. `OFFSET = -3*3600`.
- **Invariante:** o carimbo ao vivo (`src/app/page.tsx` render principal) NÃO chama o banco. O placar é buscado pelo cliente e é secundário.
- Sem placeholders de mensagem/código: usar os textos exatos deste plano.
- Fuso: `inicioDoDiaRecife(agora)=` `const OFFSET=-3*3600; return Math.floor((agora+OFFSET)/86400)*86400 - OFFSET;`

---

## File Structure

- `src/lib/db.ts` (modify) — tipo `TipoRelato`, `insertConfirmacao` com `tipo`, `contarHoje`, `inicioDoDiaRecife`.
- `src/lib/confirmar.ts` (modify) — `registrarConfirmacao` recebe `tipo`, devolve o placar.
- `src/app/api/confirmar/route.ts` (modify) — `GET ?slug` (placar) + `POST {slug,tipo}`.
- `src/app/ConfirmarFui.tsx` (create) — componente cliente do botão + placar.
- `src/app/page.tsx` (modify) — troca `.confirmar` estático por `<ConfirmarFui slug={SLUG}/>`.
- `src/app/ficha.css` (modify) — estilos dos estados do botão/placar.
- `scripts/apply-schema.ts` (create) — aplica o schema no Turso provisionado (roda uma vez).
- Testes: `tests/lib/db.test.ts` (modify), `tests/api/confirmar.test.ts` (modify), `tests/app/ConfirmarFui.test.tsx` (create).

---

### Task 1: Data layer — `tipo`, `inicioDoDiaRecife`, `contarHoje`

**Files:**
- Modify: `src/lib/db.ts`
- Test: `tests/lib/db.test.ts`

**Interfaces:**
- Consumes: `ensureSchema`, `createClient` (existentes).
- Produces:
  - `export type TipoRelato = "seco" | "barro";`
  - `insertConfirmacao(client: Client, slug: string, criadoEm: number, tipo: TipoRelato): Promise<void>`
  - `inicioDoDiaRecife(agora: number): number`
  - `contarHoje(client: Client, slug: string, agora: number): Promise<{ foram: number; barro: number }>`

- [ ] **Step 1: Write the failing tests**

Substituir o teste `inserts and counts confirmacoes` em `tests/lib/db.test.ts` (a assinatura de `insertConfirmacao` mudou) e adicionar os novos. Atualize o import para incluir `contarHoje, inicioDoDiaRecife, type TipoRelato`.

```ts
it("inserts confirmacoes com tipo e conta o total", async () => {
  await insertConfirmacao(client, "rampa-do-pepe", 1000, "seco");
  await insertConfirmacao(client, "rampa-do-pepe", 1001, "barro");
  expect(await countConfirmacoes(client, "rampa-do-pepe")).toBe(2);
});

it("inicioDoDiaRecife: meia-noite local em UTC-3", () => {
  // 2026-08-03 12:00Z → local 09:00 → início do dia local = 2026-08-03 03:00Z
  const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
  expect(inicioDoDiaRecife(agora)).toBe(Date.UTC(2026, 7, 3, 3, 0, 0) / 1000);
});

it("contarHoje: conta só o dia de Recife, separa barro", async () => {
  const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000; // hoje (Recife)
  const ontem = Date.UTC(2026, 7, 3, 2, 59, 0) / 1000; // 23:59 de ontem em Recife
  const hojeCedo = Date.UTC(2026, 7, 3, 3, 1, 0) / 1000; // 00:01 hoje em Recife
  await insertConfirmacao(client, "rampa-do-pepe", ontem, "barro");
  await insertConfirmacao(client, "rampa-do-pepe", hojeCedo, "seco");
  await insertConfirmacao(client, "rampa-do-pepe", agora, "barro");
  const p = await contarHoje(client, "rampa-do-pepe", agora);
  expect(p).toEqual({ foram: 2, barro: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: FAIL (`contarHoje`/`inicioDoDiaRecife` não existem; `insertConfirmacao` 4º arg).

- [ ] **Step 3: Implement in `src/lib/db.ts`**

Adicionar o tipo e as funções; alterar `insertConfirmacao`:

```ts
export type TipoRelato = "seco" | "barro";

export function inicioDoDiaRecife(agora: number): number {
  const OFFSET = -3 * 3600; // America/Recife = UTC-3, sem horário de verão
  return Math.floor((agora + OFFSET) / 86400) * 86400 - OFFSET;
}

export async function insertConfirmacao(
  client: Client,
  slug: string,
  criadoEm: number,
  tipo: TipoRelato,
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO confirmacoes (ficha_slug, criado_em, tipo) VALUES (?, ?, ?)`,
    args: [slug, criadoEm, tipo],
  });
}

export async function contarHoje(
  client: Client,
  slug: string,
  agora: number,
): Promise<{ foram: number; barro: number }> {
  const inicio = inicioDoDiaRecife(agora);
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS foram,
                 SUM(CASE WHEN tipo = 'barro' THEN 1 ELSE 0 END) AS barro
          FROM confirmacoes
          WHERE ficha_slug = ? AND criado_em >= ?`,
    args: [slug, inicio],
  });
  const r = rs.rows[0];
  return { foram: Number(r?.foram ?? 0), barro: Number(r?.barro ?? 0) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/lib/db.test.ts
git commit -m "feat(db): tipo seco/barro + contarHoje (janela Recife)"
```

---

### Task 2: `registrarConfirmacao` com tipo e placar

**Files:**
- Modify: `src/lib/confirmar.ts`
- Test: `tests/api/confirmar.test.ts`

**Interfaces:**
- Consumes: `insertConfirmacao`, `contarHoje`, `type TipoRelato` (Task 1).
- Produces: `registrarConfirmacao(client: Client, slug: string, tipo: TipoRelato, agora: number): Promise<{ foram: number; barro: number }>`

- [ ] **Step 1: Write the failing test**

Substituir o conteúdo de `tests/api/confirmar.test.ts` (a assinatura e o retorno mudaram):

```ts
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
  it("registra com tipo e devolve o placar do dia", async () => {
    const agora = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
    const a = await registrarConfirmacao(client, "rampa-do-pepe", "seco", agora);
    expect(a).toEqual({ foram: 1, barro: 0 });
    const b = await registrarConfirmacao(client, "rampa-do-pepe", "barro", agora);
    expect(b).toEqual({ foram: 2, barro: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/confirmar.test.ts`
Expected: FAIL (assinatura antiga devolve `{count}`).

- [ ] **Step 3: Implement `src/lib/confirmar.ts`**

```ts
import type { Client } from "@libsql/client";
import { insertConfirmacao, contarHoje, type TipoRelato } from "@/lib/db";

export async function registrarConfirmacao(
  client: Client,
  slug: string,
  tipo: TipoRelato,
  agora: number,
): Promise<{ foram: number; barro: number }> {
  await insertConfirmacao(client, slug, agora, tipo);
  return contarHoje(client, slug, agora);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/confirmar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/confirmar.ts tests/api/confirmar.test.ts
git commit -m "feat(confirmar): registrar com tipo e devolver placar do dia"
```

---

### Task 3: Rota `confirmar` — GET (placar) + POST (registrar)

**Files:**
- Modify: `src/app/api/confirmar/route.ts`
- Test: `tests/api/route-confirmar.test.ts` (create)

**Interfaces:**
- Consumes: `getClient` (existente), `getFicha` (existente), `registrarConfirmacao` (Task 2), `contarHoje`, `getClient` (Task 1).
- Produces: HTTP `GET /api/confirmar?slug=` → `{foram,barro}`; `POST /api/confirmar {slug,tipo}` → `{foram,barro}`.

> Nota: os handlers usam `getClient()` (Turso via env). O teste injeta um client em memória chamando os handlers com um `getClient` mockado via `vi.mock`.

- [ ] **Step 1: Write the failing test**

Criar `tests/api/route-confirmar.test.ts`. Mockar `@/lib/db`'s `getClient` pra devolver um client `:memory:` compartilhado.

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchema } from "@/lib/db";

let client: Client;
vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
});
afterEach(() => client.close());

describe("route /api/confirmar", () => {
  it("POST válido registra e retorna placar; GET lê o placar", async () => {
    const { POST, GET } = await import("@/app/api/confirmar/route");
    const post = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "barro" }),
      }),
    );
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ foram: 1, barro: 1 });

    const get = await GET(new Request("http://x/api/confirmar?slug=rampa-do-pepe"));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ foram: 1, barro: 1 });
  });

  it("POST com tipo inválido → 400", async () => {
    const { POST } = await import("@/app/api/confirmar/route");
    const res = await POST(
      new Request("http://x/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", tipo: "molhado" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET sem slug → 400", async () => {
    const { GET } = await import("@/app/api/confirmar/route");
    const res = await GET(new Request("http://x/api/confirmar"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/route-confirmar.test.ts`
Expected: FAIL (não há `GET`; `POST` não valida `tipo`).

- [ ] **Step 3: Implement `src/app/api/confirmar/route.ts`**

```ts
import { getClient, contarHoje, type TipoRelato } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import { registrarConfirmacao } from "@/lib/confirmar";

export const dynamic = "force-dynamic";

function tiposValidos(t: unknown): t is TipoRelato {
  return t === "seco" || t === "barro";
}

export async function GET(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await contarHoje(getClient(), slug, agora));
}

export async function POST(req: Request): Promise<Response> {
  let body: { slug?: unknown; tipo?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { slug, tipo } = body;
  if (typeof slug !== "string" || getFicha(slug) == null) {
    return new Response("ficha inválida", { status: 400 });
  }
  if (!tiposValidos(tipo)) {
    return new Response("tipo inválido", { status: 400 });
  }
  const agora = Math.floor(Date.now() / 1000);
  return Response.json(await registrarConfirmacao(getClient(), slug, tipo, agora));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/route-confirmar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/confirmar/route.ts tests/api/route-confirmar.test.ts
git commit -m "feat(api): confirmar ganha GET (placar) e POST valida tipo"
```

---

### Task 4: Componente cliente `ConfirmarFui`

**Files:**
- Create: `src/app/ConfirmarFui.tsx`
- Test: `tests/app/ConfirmarFui.test.tsx`

**Interfaces:**
- Consumes: HTTP `GET`/`POST /api/confirmar` (Task 3).
- Produces: `export default function ConfirmarFui({ slug }: { slug: string })` — componente `"use client"`.

Comportamento: ao montar, `GET ?slug` → guarda placar. Botão "✓ Fui" → mostra "E no portão, como estava?" com "Deu pra subir" e "Tava barro" → escolha faz `POST {slug,tipo}` → mostra "Valeu — anotado 🙏" + placar. Erro de rede → "não deu pra registrar agora, tenta de novo". `localStorage["bp:contou:"+slug+":"+diaRecife]` marca "já contou hoje" (mostra estado contado direto).

- [ ] **Step 1: Write the failing test**

Criar `tests/app/ConfirmarFui.test.tsx`. Sem jest-dom (setupFiles vazio) — usar queries do testing-library + asserts com `queryByText`.

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ConfirmarFui from "@/app/ConfirmarFui";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
beforeEach(() => { localStorage.clear(); });

function mockFetch(seq: Array<unknown>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(seq[i++]) });
  }));
  return calls;
}

describe("ConfirmarFui", () => {
  it("carrega placar, clica Fui, escolhe barro, mostra agradecimento e placar novo", async () => {
    const calls = mockFetch([{ foram: 2, barro: 0 }, { foram: 3, barro: 1 }]);
    render(<ConfirmarFui slug="rampa-do-pepe" />);

    // placar inicial
    await screen.findByText(/2 foram/);

    // CTA
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    // pergunta + opções
    screen.getByText(/como estava/i);
    fireEvent.click(screen.getByRole("button", { name: /Tava barro/ }));

    // agradecimento + placar atualizado
    await screen.findByText(/anotado/i);
    await screen.findByText(/3 foram/);
    expect(calls[1].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ slug: "rampa-do-pepe", tipo: "barro" });
  });

  it("erro no POST mostra mensagem e não trava", async () => {
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(() => {
      i++;
      if (i === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ foram: 0, barro: 0 }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }));
    render(<ConfirmarFui slug="rampa-do-pepe" />);
    await waitFor(() => screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fui/ }));
    fireEvent.click(screen.getByRole("button", { name: /Deu pra subir/ }));
    await screen.findByText(/tenta de novo/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/ConfirmarFui.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implement `src/app/ConfirmarFui.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

type Placar = { foram: number; barro: number };
type Fase = "idle" | "perguntando" | "enviando" | "contado" | "erro";

function diaRecife(): number {
  const OFFSET = -3 * 3600;
  return Math.floor((Date.now() / 1000 + OFFSET) / 86400);
}

export default function ConfirmarFui({ slug }: { slug: string }) {
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const jaContouKey = `bp:contou:${slug}:${diaRecife()}`;

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(jaContouKey)) {
      setFase("contado");
    }
    fetch(`/api/confirmar?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPlacar(p))
      .catch(() => {});
  }, [slug, jaContouKey]);

  async function enviar(tipo: "seco" | "barro") {
    setFase("enviando");
    try {
      const r = await fetch("/api/confirmar", {
        method: "POST",
        body: JSON.stringify({ slug, tipo }),
      });
      if (!r.ok) throw new Error();
      setPlacar(await r.json());
      localStorage.setItem(jaContouKey, "1");
      setFase("contado");
    } catch {
      setFase("erro");
    }
  }

  return (
    <div className="confirmar">
      {fase === "idle" && (
        <button className="btn" onClick={() => setFase("perguntando")}>✓ Fui</button>
      )}
      {fase === "perguntando" && (
        <div className="perg">
          <div className="q">E no portão, como estava?</div>
          <div className="opts">
            <button className="opt seco" onClick={() => enviar("seco")}>Deu pra subir</button>
            <button className="opt barro" onClick={() => enviar("barro")}>Tava barro</button>
          </div>
        </div>
      )}
      {fase === "enviando" && <div className="soon">enviando…</div>}
      {fase === "contado" && <div className="obrigado">Valeu — anotado 🙏</div>}
      {fase === "erro" && (
        <div className="erro">
          não deu pra registrar agora, tenta de novo
          <button className="btn" onClick={() => setFase("perguntando")}>tentar de novo</button>
        </div>
      )}
      <PlacarLinha placar={placar} />
    </div>
  );
}

function PlacarLinha({ placar }: { placar: { foram: number; barro: number } | null }) {
  if (!placar || placar.foram === 0) {
    return <div className="placar vazio">Ninguém contou ainda hoje — seja o primeiro a dizer como tá.</div>;
  }
  const barroTxt = placar.barro > 0 ? ` · ${placar.barro} achou barro` : "";
  return <div className="placar">Hoje: {placar.foram} {placar.foram === 1 ? "foi" : "foram"}{barroTxt}</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/ConfirmarFui.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/ConfirmarFui.tsx tests/app/ConfirmarFui.test.tsx
git commit -m "feat(ui): ConfirmarFui — botão Fui + seco/barro + placar client-fetched"
```

---

### Task 5: Ligar o componente na página + estilos + build

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/ficha.css`

**Interfaces:**
- Consumes: `ConfirmarFui` (Task 4).

> Sem teste unitário (server component que busca clima). Deliverable = build limpo + render local com o botão no lugar do bloco estático. O carimbo continua só-clima (invariante): NÃO adicionar chamada de banco em `page.tsx`.

- [ ] **Step 1: Trocar o bloco `.confirmar` estático**

Em `src/app/page.tsx`, adicionar o import no topo:
```tsx
import ConfirmarFui from "./ConfirmarFui";
```
Substituir o bloco:
```tsx
        <div className="confirmar">
          <div className="btn">✓ Fui</div>
          <div className="soon">confirmar — chega depois</div>
        </div>
```
por:
```tsx
        <ConfirmarFui slug={SLUG} />
```

- [ ] **Step 2: Estilos dos novos estados em `src/app/ficha.css`**

Acrescentar (a classe `.confirmar` já existe; adicionar os filhos novos):
```css
.bp .confirmar .perg .q { font-size: .96rem; color: var(--ink-soft); margin-bottom: .55rem; }
.bp .confirmar .opts { display: flex; gap: .5rem; justify-content: center; }
.bp .confirmar .opt { font-weight: 650; border-radius: 99px; padding: .5rem 1rem; border: 1px solid var(--line); cursor: pointer; background: var(--surface-2); color: var(--ink); }
.bp .confirmar .opt.seco { border-color: var(--go-line); color: var(--go-ink); }
.bp .confirmar .opt.barro { border-color: var(--stop-line); color: var(--stop-ink); }
.bp .confirmar .obrigado { font-weight: 650; color: var(--ink); }
.bp .confirmar .erro { color: var(--stop-ink); display: flex; flex-direction: column; gap: .4rem; align-items: center; }
.bp .confirmar .placar { margin-top: .55rem; font-family: var(--type); font-size: .72rem; color: var(--ink-faint); }
.bp .confirmar .placar.vazio { font-style: italic; }
.bp .confirmar button.btn { cursor: pointer; background: transparent; }
```

- [ ] **Step 3: Build + typecheck**

Run: `npx tsc --noEmit && npx next build`
Expected: sucesso; rota `/` continua `ƒ (Dynamic)`.

- [ ] **Step 4: Verificar local (opcional mas recomendado)**

Run: `npx next dev -p 3311` e abrir `http://localhost:3311`. O botão "✓ Fui" aparece; clicar mostra as opções. (O POST/GET vai falhar sem Turso local — o placar mostra o empty-state e o POST cai no "tenta de novo". Isso confirma a degradação graciosa. Dado real vem na Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/ficha.css
git commit -m "feat(rampa): liga ConfirmarFui na ficha + estilos dos estados"
```

---

### Task 6: Provisionar Turso (Vercel Marketplace) + schema + deploy + verificação ao vivo

**Files:**
- Create: `scripts/apply-schema.ts`

**Interfaces:**
- Consumes: `getClient`, `ensureSchema` (existentes).

> Esta tarefa tem um **passo do João** (autorizar a integração no navegador). O resto (schema, env, deploy, verificação) é do agente. As Tasks 1–5 já estão testadas com `:memory:`, então nada aqui é bloqueante pro código.

- [ ] **Step 1: Provisionar Turso via Marketplace (João autoriza)**

Run: `vercel integration add turso`
João aceita/provisiona no navegador que abrir. Isso cria o banco e injeta `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` nas env vars do projeto.

- [ ] **Step 2: Puxar env local**

Run: `vercel env pull .env.local --yes`
(`.env.local` já é gitignored via `.env*`.)

- [ ] **Step 3: Criar `scripts/apply-schema.ts`**

```ts
import { getClient, ensureSchema } from "../src/lib/db";

async function main() {
  const client = getClient();
  await ensureSchema(client);
  console.log("schema aplicado");
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Instalar tsx/dotenv-cli e aplicar o schema**

Run:
```bash
npm i -D tsx dotenv-cli
npx dotenv -e .env.local -- npx tsx scripts/apply-schema.ts
```
Expected: `schema aplicado`.

- [ ] **Step 5: Deploy de produção**

Run: `vercel --prod --yes`
Expected: `READY`.

- [ ] **Step 6: Verificação ao vivo (no celular do João + curl)**

- `curl -s "https://bateperna.vercel.app/api/confirmar?slug=rampa-do-pepe"` → `{"foram":0,"barro":0}` (ou o real).
- No celular: abrir `https://bateperna.vercel.app`, tocar "✓ Fui" → "Tava barro" → ver "Valeu — anotado 🙏" e o placar subir. Recarregar: placar persiste; localStorage mostra estado contado.

- [ ] **Step 7: Commit**

```bash
git add scripts/apply-schema.ts package.json package-lock.json
git commit -m "chore: script de schema + Turso via Marketplace (Fui ao vivo)"
```

---

## Self-Review (preenchido)

**Spec coverage:** experiência (T4/T5) ✓; placar janela-hoje (T1 `contarHoje`/`inicioDoDiaRecife`, T4 render) ✓; anônimo+localStorage (T4) ✓; rota GET+POST+tipo (T3) ✓; Turso via Marketplace + schema (T6) ✓; carimbo só-clima/fail-safe (invariante em T5 + degradação em T4) ✓; testes TDD (T1–T4) ✓; fora-de-escopo (override/mapa/menu) não vira tarefa ✓.

**Placeholder scan:** sem TBD/TODO; todo código e mensagem estão literais.

**Type consistency:** `TipoRelato = "seco"|"barro"` usado em db/confirmar/route; `contarHoje`/`registrarConfirmacao` retornam `{foram,barro}` de ponta a ponta; `inicioDoDiaRecife` mesma fórmula em db.ts (server) e no componente (client). `insertConfirmacao(client,slug,criadoEm,tipo)` — ordem consistente T1↔T2.
