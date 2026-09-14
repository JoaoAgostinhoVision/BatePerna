# Acesso de admin — a porta e o aviso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao João uma porta de admin (senha → cookie assinado) e, atrás dela, publicar um aviso do dono num lugar — com efeito sobre o veredito do carimbo — sem sair do celular.

**Architecture:** Uma senha em variável de ambiente vira um cookie HMAC-assinado; a lógica pura mora em `src/lib/admin-sessao.ts` com segredo e relógio injetados, e as rotas só fazem IO. O aviso é uma linha append-only no Turso, aplicada sobre a leitura do carimbo por uma função pura (`aplicarAviso`) dentro de `resolverEstado`/`resolverEstados` — o mesmo ponto de decisão onde o `?debug=` já entra.

**Tech Stack:** Next.js 15 (App Router, rotas `force-dynamic`), React 19, `@libsql/client` (Turso), `node:crypto` (HMAC + `timingSafeEqual`), zod, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-13-acesso-de-admin-design.md`

## Global Constraints

- **Nenhuma dependência nova.** HMAC via `node:crypto`, que já vem com o runtime.
- **Falha fechada:** sem `ADMIN_SENHA` no ambiente, `/admin` e todo `/api/admin/*` respondem **404**. Nunca 401, nunca 200.
- **Senha curta desliga o admin:** `ADMIN_SENHA` com menos de **24** caracteres → admin desligado, com motivo na tela.
- **Comparação de segredo é sempre de tempo constante** (`crypto.timingSafeEqual`). Nunca `===`.
- **Cookie:** nome `bp_admin`; `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age` = 7 dias (`604800`).
- **Lógica pura fora dos handlers.** Rota faz IO; decisão mora em `src/lib/`. (Lição paga duas vezes: código no handler é código sem prova.)
- **Aviso exige prazo.** `vence_em` é obrigatório; não existe aviso sem validade.
- **Aviso nunca é apagado.** Retirar é `UPDATE retirado = 1`. Nunca `DELETE`.
- **Vocabulário existente, nunca paralelo:** `Estado = "fresco" | "frio"` (`src/lib/motor.ts`); `Fase = "afirmando" | "conferindo" | "sem-informacoes" | "fechado"` (`src/lib/carimbo-fase.ts`).
- **Marcadores de varredura sem acento**, sempre (lição de 09/09).
- **Todo commit roda:** `npx vitest run` verde, `npx tsc --noEmit` limpo.
- **Cada tarefa fecha com mutação medida** — o script prova que mutou antes de rodar a suíte; mutação não aplicada é indistinguível de mutação sobrevivente.

---

## Estrutura de arquivos

**Criar:**

| arquivo | responsabilidade |
|---|---|
| `src/lib/admin-sessao.ts` | assinar/verificar token, comparar senha. Puro, sem env, sem `next/headers`. |
| `src/lib/admin-config.ts` | ler o ambiente e dizer se o admin está LIGADO, DESLIGADO ou AUSENTE. Puro, env injetado. |
| `src/lib/aviso.ts` | o tipo `Aviso`, a vigência e `aplicarAviso`. Puro, relógio injetado. |
| `src/app/api/admin/entrar/route.ts` | POST senha → cookie |
| `src/app/api/admin/sair/route.ts` | POST → limpa cookie |
| `src/app/api/admin/aviso/route.ts` | POST publicar / DELETE retirar |
| `src/app/admin/page.tsx` | o painel (server component) |
| `src/app/admin/PainelAdmin.tsx` | a interação do painel (client component) |
| `src/app/admin/CaixaDeSenha.tsx` | a caixa de senha (client component) |
| `src/app/admin/admin.css` | estilo do painel, isolado do `bp` |
| `src/app/AvisoDoDono.tsx` | o bloco do aviso na ficha |

**Modificar:**

| arquivo | mudança |
|---|---|
| `src/lib/despacho.ts:2` | `RESERVADOS` ganha `"admin"` |
| `src/lib/db.ts` | `ensureSchema` ganha a tabela `avisos`; funções `inserirAviso`, `avisoVigente`, `retirarAviso` |
| `src/lib/carimbo-estado.ts` | `LeituraCarimbo` ganha `aviso`; `resolverEstado`/`resolverEstados` aplicam |
| `src/lib/carimbo-fase.ts` | `Situacao` ganha `fechadoPeloDono: boolean` **obrigatório** |
| `src/app/Carimbo.tsx`, `MioloHome.tsx`, `PinTrilha.tsx`, `SeloTrilha.tsx`, `[slug]/page.tsx` | passar `fechadoPeloDono` (o `tsc` aponta todos) |
| `src/app/[slug]/page.tsx` | renderizar `<AvisoDoDono>` |

**Por que `fechadoPeloDono` é obrigatório e não opcional:** `Situacao.fechado` é opcional hoje, com razão documentada. Se o campo novo também fosse, esquecer um dos cinco pontos de construção passaria em silêncio — e o lugar ficaria aberto na tela com o dono tendo dito que está fechado. **Obrigatório faz o `tsc` ser o guarda**, sem grep e sem disciplina.

---

## Task 1: O módulo puro da sessão

**Files:**
- Create: `src/lib/admin-sessao.ts`
- Test: `tests/lib/admin-sessao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `criarSessao(segredo: string, agora: number, duracaoS: number): string`
  - `lerSessao(segredo: string, token: string, agora: number): ResultadoSessao`
  - `type ResultadoSessao = { valida: true } | { valida: false; motivo: "formato" | "assinatura" | "expirada" }`
  - `senhaConfere(esperada: string, recebida: string): boolean`
  - `DURACAO_SESSAO_S: number` (`604800`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/admin-sessao.test.ts
import { describe, expect, it } from "vitest";
import {
  DURACAO_SESSAO_S,
  criarSessao,
  lerSessao,
  senhaConfere,
} from "@/lib/admin-sessao";

const SEGREDO = "segredo-de-teste-com-tamanho-decente";
const AGORA = 1_757_000_000;

describe("criarSessao / lerSessao", () => {
  it("um token recém-criado é válido", () => {
    const t = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
    expect(lerSessao(SEGREDO, t, AGORA)).toEqual({ valida: true });
  });

  // 🔴 O ponto inteiro da assinatura: o payload diz quando expira, e sem HMAC
  // qualquer um estende a própria sessão editando o cookie.
  it("payload adulterado é recusado", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    const [, hmac] = t.split(".");
    const outroPayload = Buffer.from(JSON.stringify({ exp: AGORA + 999_999 })).toString("base64url");
    expect(lerSessao(SEGREDO, `${outroPayload}.${hmac}`, AGORA)).toEqual({
      valida: false,
      motivo: "assinatura",
    });
  });

  it("assinatura adulterada é recusada", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    const [payload, hmac] = t.split(".");
    const trocado = (hmac[0] === "a" ? "b" : "a") + hmac.slice(1);
    expect(lerSessao(SEGREDO, `${payload}.${trocado}`, AGORA)).toEqual({
      valida: false,
      motivo: "assinatura",
    });
  });

  it("token assinado com OUTRO segredo é recusado", () => {
    const t = criarSessao("outro-segredo-qualquer-aqui", AGORA, 60);
    expect(lerSessao(SEGREDO, t, AGORA)).toEqual({ valida: false, motivo: "assinatura" });
  });

  // A borda decide de UM jeito só: no instante exato da expiração, fora.
  it("expira, e o instante exato do prazo já está fora", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    expect(lerSessao(SEGREDO, t, AGORA + 59)).toEqual({ valida: true });
    expect(lerSessao(SEGREDO, t, AGORA + 60)).toEqual({ valida: false, motivo: "expirada" });
  });

  it("lixo no lugar do token não estoura — devolve formato", () => {
    for (const lixo of ["", "semponto", "a.b.c", "...", "a."]) {
      expect(lerSessao(SEGREDO, lixo, AGORA).valida).toBe(false);
    }
  });

  it("a duração padrão é de 7 dias", () => {
    expect(DURACAO_SESSAO_S).toBe(7 * 24 * 60 * 60);
  });
});

describe("senhaConfere", () => {
  it("igual passa, diferente não", () => {
    expect(senhaConfere("abcdefgh", "abcdefgh")).toBe(true);
    expect(senhaConfere("abcdefgh", "abcdefgi")).toBe(false);
  });

  // 🔴 Tamanhos diferentes NÃO podem estourar o timingSafeEqual (ele exige
  // buffers do mesmo tamanho). Sem isto, uma senha de outro comprimento derruba
  // a rota com 500 em vez de recusar.
  it("tamanhos diferentes recusam sem estourar", () => {
    expect(senhaConfere("abcdefgh", "abc")).toBe(false);
    expect(senhaConfere("abc", "abcdefghijk")).toBe(false);
    expect(senhaConfere("", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/admin-sessao.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-sessao"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/admin-sessao.ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Quanto tempo a sessão do painel vale. Sete dias: ele entra do celular na
 *  estrada e não pode ser expulso no meio de um aviso; e um cookie eterno num
 *  celular perdido é o app inteiro na mão de quem achou. */
export const DURACAO_SESSAO_S = 7 * 24 * 60 * 60;

export type ResultadoSessao =
  | { valida: true }
  | { valida: false; motivo: "formato" | "assinatura" | "expirada" };

function assinar(segredo: string, payload: string): string {
  return createHmac("sha256", segredo).update(payload).digest("base64url");
}

/** Compara sem vazar, pelo TEMPO, onde as cadeias divergem.
 *
 *  🔴 `timingSafeEqual` exige buffers do mesmo tamanho — passar tamanhos
 *  diferentes ESTOURA. Por isso o comprimento é checado antes, e sim: isto
 *  vaza o comprimento. Vazar "a senha tem 31 caracteres" é inofensivo; vazar
 *  "o primeiro caractere está certo" é o que permite extrair byte a byte. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export function criarSessao(segredo: string, agora: number, duracaoS: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: agora + duracaoS })).toString("base64url");
  return `${payload}.${assinar(segredo, payload)}`;
}

/** A sessão é boa? Verifica ASSINATURA antes de olhar o conteúdo — um payload
 *  adulterado não pode nem chegar ao `JSON.parse`. */
export function lerSessao(segredo: string, token: string, agora: number): ResultadoSessao {
  const partes = token.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return { valida: false, motivo: "formato" };
  }
  const [payload, hmac] = partes;
  if (!iguaisEmTempoConstante(hmac, assinar(segredo, payload))) {
    return { valida: false, motivo: "assinatura" };
  }
  let exp: unknown;
  try {
    exp = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp;
  } catch {
    return { valida: false, motivo: "formato" };
  }
  if (typeof exp !== "number") return { valida: false, motivo: "formato" };
  return agora < exp ? { valida: true } : { valida: false, motivo: "expirada" };
}

/** A senha digitada bate com a configurada? Tempo constante, sempre. */
export function senhaConfere(esperada: string, recebida: string): boolean {
  return iguaisEmTempoConstante(esperada, recebida);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/lib/admin-sessao.test.ts && npx tsc --noEmit`
Expected: PASS, e `tsc` sem saída.

- [ ] **Step 5: Medir mutação**

Aplicar cada uma, confirmar que o arquivo mudou, rodar a suíte, restaurar. Todas devem MORRER:

| # | mutação | onde |
|---|---|---|
| M1 | `timingSafeEqual(ba, bb)` → `a === b` | `iguaisEmTempoConstante` |
| M2 | apagar a checagem de assinatura em `lerSessao` | `lerSessao` |
| M3 | `agora < exp` → `agora <= exp` | `lerSessao` |
| M4 | `ba.length === 0` → remover a guarda | `iguaisEmTempoConstante` |
| M5 | `DURACAO_SESSAO_S` → `30 * 24 * 60 * 60` | topo |

M1 é a única que precisa de olho: ela **não** é pega por igualdade de valor (o `===` também devolve o resultado certo). Ela é pega pelo teste de tamanhos diferentes **só se** a implementação com `===` for escrita sem a guarda de tamanho. Se M1 sobreviver, o teste que falta é o que lê o CÓDIGO: `expect(fonte).toContain("timingSafeEqual")` em `src/lib/admin-sessao.ts` — anotar que é um guarda de fonte, e por quê.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-sessao.ts tests/lib/admin-sessao.test.ts
git commit -m "feat(admin): o modulo puro da sessao -- assinar, verificar, comparar em tempo constante"
```

---

## Task 2: `/admin` deixa de parecer ficha

**Files:**
- Modify: `src/lib/despacho.ts:2`
- Test: `tests/lib/despacho.test.ts` (existente)

**Interfaces:**
- Consumes: nada.
- Produces: `ehCaminhoDeFicha("/admin") === false`.

- [ ] **Step 1: Write the failing test**

Acrescentar ao `tests/lib/despacho.test.ts`:

```ts
  // 🔴 O DEFEITO QUE ISTO TRANCA, achado no levantamento de 2026-09-13 e nunca
  // chegou ao ar. `/admin` é um segmento, sem ponto — então `ehCaminhoDeFicha`
  // o aprovava, e `ehNavegacaoNossa` junto. O service worker trataria o PAINEL
  // DE ADMIN como ficha: guardaria em CACHE_ULTIMA_FICHA **e sob CHAVE_ULTIMA**,
  // o ponteiro da última ficha aberta. Abrir o app sem rede cairia no painel de
  // admin em vez da home.
  //
  // O próprio RESERVADOS já avisava: "Se nascer outra, entra aqui."
  it("o painel de admin NAO e ficha — senao o service worker o guarda offline", () => {
    expect(ehCaminhoDeFicha("/admin")).toBe(false);
    expect(ehNavegacaoNossa("/admin")).toBe(false);
  });
```

> `ehNavegacaoNossa` vem de `@/lib/cache-rotas`; se o arquivo de teste ainda não o importa, acrescentar ao import existente.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/despacho.test.ts`
Expected: FAIL — `expected true to be false`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/despacho.ts:2
/** Rotas de um segmento que NÃO são ficha. Se nascer outra, entra aqui. */
const RESERVADOS = new Set(["trilhas", "icones", "admin"]);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo verde.

- [ ] **Step 5: E a segunda metade — tirar `/admin` do cache de páginas**

`RESERVADOS` tira `/admin` do listener das fichas, mas **não** da estratégia
`NetworkFirst` genérica do serwist, que guarda toda navegação em `CACHE_PAGINAS`.
Painel de admin guardado no celular é superfície de risco sem contrapartida.

O predicado mora em `cache-rotas.ts`, e **não** no `sw.ts` — código no `sw.ts` é
código sem prova (o arquivo não é importável em teste).

Teste, em `tests/lib/cache-rotas.test.ts`:

```ts
describe("podeGuardarPagina", () => {
  // 🔴 O painel nao e parte do app offline. Guardar tela de admin no celular
  // e superficie de risco sem nada em troca — offline ele nao funciona mesmo,
  // porque toda acao dele e uma escrita no servidor.
  it("o painel de admin nunca e guardado", () => {
    expect(podeGuardarPagina("/admin")).toBe(false);
    expect(podeGuardarPagina("/admin/qualquer-coisa")).toBe(false);
  });

  it("e as paginas de verdade continuam sendo", () => {
    expect(podeGuardarPagina("/trilhas")).toBe(true);
    expect(podeGuardarPagina("/")).toBe(true);
  });
});
```

Implementação, em `src/lib/cache-rotas.ts`:

```ts
/** Esta navegação pode virar cópia guardada?
 *
 *  🔴 O PAINEL NÃO. Ele não é parte do app offline — toda ação dele é uma
 *  escrita no servidor, então guardado ele só existe pra enganar. E tela de
 *  admin parada no cache de um celular é superfície de risco sem contrapartida.
 *  `RESERVADOS` já o tirou do listener das fichas; isto o tira da estratégia
 *  genérica de navegação do serwist, que é o outro caminho. */
export function podeGuardarPagina(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}
```

E no `src/app/sw.ts`, o matcher do `NetworkFirst`:

```ts
      matcher: ({ request, url }) =>
        request.mode === "navigate" && podeGuardarPagina(url.pathname),
```

- [ ] **Step 6: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | remover `"admin"` de `RESERVADOS` | MORRE |
| M2 | `podeGuardarPagina` devolvendo sempre `true` | MORRE |
| M3 | `startsWith("/admin")` → `=== "/admin"` | MORRE (`/admin/x`) |

- [ ] **Step 7: Commit**

```bash
git add src/lib/despacho.ts src/lib/cache-rotas.ts src/app/sw.ts tests/lib/despacho.test.ts tests/lib/cache-rotas.test.ts
git commit -m "fix(admin): /admin nao parece ficha e nao vai pro cache -- os dois caminhos, nao um"
```

---

## Task 3: Ligado, desligado, ou ausente

**Files:**
- Create: `src/lib/admin-config.ts`
- Test: `tests/lib/admin-config.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type EstadoAdmin = { ligado: true; senha: string; segredo: string } | { ligado: false; motivo: "ausente" | "senha-curta" | "sem-segredo" }`
  - `lerConfigAdmin(env: Record<string, string | undefined>): EstadoAdmin`
  - `MIN_SENHA: number` (`24`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/admin-config.test.ts
import { describe, expect, it } from "vitest";
import { MIN_SENHA, lerConfigAdmin } from "@/lib/admin-config";

const SENHA_BOA = "x".repeat(MIN_SENHA);
const SEGREDO = "um-segredo-de-assinatura-qualquer";

describe("lerConfigAdmin", () => {
  it("com senha longa e segredo, o admin está ligado", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA, ADMIN_SEGREDO: SEGREDO })).toEqual({
      ligado: true,
      senha: SENHA_BOA,
      segredo: SEGREDO,
    });
  });

  // 🔴 FALHA FECHADA. Uma variável de ambiente que some — deploy novo, projeto
  // clonado, ambiente de preview — não pode virar painel aberto. "Ausente" é o
  // caso NORMAL enquanto ele não configurar, e o app tem que rodar assim.
  it("sem senha nenhuma, o admin não existe", () => {
    expect(lerConfigAdmin({}).ligado).toBe(false);
    expect(lerConfigAdmin({})).toEqual({ ligado: false, motivo: "ausente" });
    expect(lerConfigAdmin({ ADMIN_SENHA: "" })).toEqual({ ligado: false, motivo: "ausente" });
    expect(lerConfigAdmin({ ADMIN_SENHA: "   " })).toEqual({ ligado: false, motivo: "ausente" });
  });

  // 🔴 Senha fraca é a chave do app inteiro. Recusar DESLIGA o painel em vez de
  // pedir cuidado: o erro fica impossível, não improvável.
  it("senha curta desliga o admin, e a borda decide de um jeito só", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: "x".repeat(MIN_SENHA - 1), ADMIN_SEGREDO: SEGREDO })).toEqual({
      ligado: false,
      motivo: "senha-curta",
    });
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA, ADMIN_SEGREDO: SEGREDO }).ligado).toBe(true);
  });

  it("senha boa sem segredo de assinatura também desliga", () => {
    expect(lerConfigAdmin({ ADMIN_SENHA: SENHA_BOA })).toEqual({
      ligado: false,
      motivo: "sem-segredo",
    });
  });

  it("o mínimo é 24 — abaixo disso força bruta deixa de ser teoria", () => {
    expect(MIN_SENHA).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/admin-config.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-config"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/admin-config.ts

/** O comprimento mínimo da senha do painel.
 *
 *  🔴 Não é conselho, é GUARDA: abaixo disto o painel não liga. Esta senha é a
 *  chave do app inteiro — quem a tem edita o que o app afirma sobre lugares
 *  reais. 24 caracteres aleatórios põem força bruta fora do mundo físico, e
 *  recusar o que é menor torna a senha fraca impossível em vez de pedir
 *  cuidado. Mesma família do prazo obrigatório do aviso. */
export const MIN_SENHA = 24;

export type EstadoAdmin =
  | { ligado: true; senha: string; segredo: string }
  | { ligado: false; motivo: "ausente" | "senha-curta" | "sem-segredo" };

/** O admin está ligado?
 *
 *  🔴 FALHA FECHADA, e é a linha que mais importa aqui: sem `ADMIN_SENHA` o
 *  painel NÃO EXISTE — quem chama devolve 404, não 401. "Ausente" é o estado
 *  normal de qualquer ambiente que ele não configurou (preview, clone, o
 *  próprio deploy antes de ele criar a variável), e o app roda inteiro assim.
 *
 *  O env vem por parâmetro, e não de `process.env` aqui dentro, pra esta
 *  decisão ter teste — mesma disciplina de `resolverNavegacao` e `aquecer`. */
export function lerConfigAdmin(env: Record<string, string | undefined>): EstadoAdmin {
  const senha = env.ADMIN_SENHA?.trim() ?? "";
  const segredo = env.ADMIN_SEGREDO?.trim() ?? "";
  if (senha === "") return { ligado: false, motivo: "ausente" };
  if (senha.length < MIN_SENHA) return { ligado: false, motivo: "senha-curta" };
  if (segredo === "") return { ligado: false, motivo: "sem-segredo" };
  return { ligado: true, senha, segredo };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/lib/admin-config.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | `senha === ""` → `false` (nunca ausente) | MORRE |
| M2 | `senha.length < MIN_SENHA` → `senha.length < 8` | MORRE |
| M3 | `MIN_SENHA = 24` → `MIN_SENHA = 12` | MORRE |
| M4 | apagar a checagem de `segredo` | MORRE |
| M5 | `?.trim()` → `??` sem trim (senha só de espaços liga) | MORRE |

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-config.ts tests/lib/admin-config.test.ts
git commit -m "feat(admin): ligado, desligado ou ausente -- e sem senha o painel nao existe"
```

---

## Task 4: Entrar e sair

**Files:**
- Create: `src/app/api/admin/entrar/route.ts`, `src/app/api/admin/sair/route.ts`
- Create: `src/lib/admin-guarda.ts`
- Test: `tests/api/route-admin-entrar.test.ts`

**Interfaces:**
- Consumes: `lerConfigAdmin`, `MIN_SENHA` (Task 3); `criarSessao`, `lerSessao`, `senhaConfere`, `DURACAO_SESSAO_S` (Task 1).
- Produces:
  - `COOKIE_ADMIN: string` (`"bp_admin"`), em `src/lib/admin-guarda.ts`
  - `sessaoValida(env: Record<string, string | undefined>, token: string | undefined, agora: number): boolean`
  - `cookieDeSessao(token: string, maxAgeS: number): string` — o valor do header `Set-Cookie`
  - rotas `POST /api/admin/entrar`, `POST /api/admin/sair`

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/route-admin-entrar.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste";

beforeEach(() => {
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

const pedido = (body: unknown) =>
  new Request("http://x/api/admin/entrar", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/admin/entrar", () => {
  it("senha certa devolve um cookie httpOnly, secure e sameSite=strict", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: SENHA }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_ADMIN}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
  });

  it("senha errada não devolve cookie nenhum", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: "e".repeat(MIN_SENHA) }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("corpo sem senha, ou lixo, não estoura", async () => {
    const { POST } = await import("@/app/api/admin/entrar/route");
    expect((await POST(pedido({}))).status).toBe(401);
    expect((await POST(pedido({ senha: 42 }))).status).toBe(401);
    const cru = new Request("http://x/api/admin/entrar", { method: "POST", body: "nao-e-json" });
    expect((await POST(cru)).status).toBe(401);
  });

  // 🔴 FALHA FECHADA. Sem ADMIN_SENHA o painel não existe — 404, não 401.
  // 401 diria "existe um admin aqui, tente de novo". 404 não diz nada.
  it("sem ADMIN_SENHA configurada, a rota é 404", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/entrar/route");
    const res = await POST(pedido({ senha: SENHA }));
    expect(res.status).toBe(404);
  });

  it("com ADMIN_SENHA curta, a rota também é 404 — o painel está desligado", async () => {
    vi.stubEnv("ADMIN_SENHA", "curta");
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/entrar/route");
    expect((await POST(pedido({ senha: "curta" }))).status).toBe(404);
  });
});

describe("POST /api/admin/sair", () => {
  it("apaga o cookie", async () => {
    const { POST } = await import("@/app/api/admin/sair/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_ADMIN}=;`);
    expect(cookie).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/route-admin-entrar.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-guarda"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/admin-guarda.ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { lerSessao } from "@/lib/admin-sessao";

/** O nome do cookie da sessão do painel. Mora aqui porque três lugares
 *  precisam dele — as duas rotas e a página — e três cópias de uma string é
 *  como uma delas fica para trás. */
export const COOKIE_ADMIN = "bp_admin";

/** O header `Set-Cookie` completo.
 *
 *  `HttpOnly`: o JS da página não lê a sessão. `Secure`: só por HTTPS.
 *  `SameSite=Strict`: mata CSRF nas rotas que MUDAM coisa — e todas as rotas
 *  do painel mudam. */
export function cookieDeSessao(token: string, maxAgeS: number): string {
  return `${COOKIE_ADMIN}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeS}`;
}

/** Esta requisição tem sessão boa? Falso também quando o admin está desligado —
 *  painel desligado não tem sessão válida nenhuma. */
export function sessaoValida(
  env: Record<string, string | undefined>,
  token: string | undefined,
  agora: number,
): boolean {
  const cfg = lerConfigAdmin(env);
  if (!cfg.ligado || !token) return false;
  return lerSessao(cfg.segredo, token, agora).valida;
}
```

```ts
// src/app/api/admin/entrar/route.ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { cookieDeSessao } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao, senhaConfere } from "@/lib/admin-sessao";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  // 🔴 404, não 401: painel desligado não anuncia que existe.
  if (!cfg.ligado) return new Response("", { status: 404 });

  let senha: unknown;
  try {
    senha = (await req.json())?.senha;
  } catch {
    senha = undefined;
  }
  if (typeof senha !== "string" || !senhaConfere(cfg.senha, senha)) {
    return new Response("", { status: 401 });
  }

  const agora = Math.floor(Date.now() / 1000);
  const token = criarSessao(cfg.segredo, agora, DURACAO_SESSAO_S);
  return new Response("", {
    status: 200,
    headers: {
      "set-cookie": cookieDeSessao(token, DURACAO_SESSAO_S),
      "cache-control": "no-store",
    },
  });
}
```

```ts
// src/app/api/admin/sair/route.ts
import { COOKIE_ADMIN } from "@/lib/admin-guarda";

export const dynamic = "force-dynamic";

/** Sair sempre funciona, inclusive com o painel desligado: apagar um cookie
 *  não revela nada e não pode depender de configuração. */
export async function POST(): Promise<Response> {
  return new Response("", {
    status: 200,
    headers: {
      "set-cookie": `${COOKIE_ADMIN}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      "cache-control": "no-store",
    },
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/api/route-admin-entrar.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | `if (!cfg.ligado)` → `status: 401` | MORRE |
| M2 | apagar o `if (!cfg.ligado)` inteiro | MORRE |
| M3 | `senhaConfere(cfg.senha, senha)` → `cfg.senha === senha` | sobrevive por valor — anotar, é o par do M1 da Task 1 |
| M4 | tirar `HttpOnly` do cookie | MORRE |
| M5 | `SameSite=Strict` → `SameSite=Lax` | MORRE |
| M6 | `typeof senha !== "string"` → remover | MORRE (corpo com `senha: 42`) |

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin-guarda.ts src/app/api/admin tests/api/route-admin-entrar.test.ts
git commit -m "feat(admin): entrar e sair -- e sem senha configurada a rota e 404, nao 401"
```

---

## Task 5: A tela da porta

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/CaixaDeSenha.tsx`, `src/app/admin/admin.css`
- Test: `tests/app/admin-page.test.tsx`

**Interfaces:**
- Consumes: `lerConfigAdmin` (Task 3); `COOKIE_ADMIN`, `sessaoValida` (Task 4).
- Produces: a página `/admin`; o componente `CaixaDeSenha` (client), que faz `POST /api/admin/entrar` e recarrega.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/admin-page.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CaixaDeSenha from "@/app/admin/CaixaDeSenha";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CaixaDeSenha", () => {
  it("mostra um campo de senha, e ele é do tipo password", () => {
    const { container } = render(<CaixaDeSenha />);
    const campo = container.querySelector('input[type="password"]');
    expect(campo, "a senha do painel nao pode ser um campo de texto aberto").not.toBeNull();
  });

  // 🔴 A senha NUNCA pode virar query string: ela entraria no log do servidor,
  // no histórico do navegador e no Referer de qualquer link seguinte.
  it("a senha vai no CORPO de um POST, nunca na URL", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<CaixaDeSenha />);
    const campo = container.querySelector('input[type="password"]') as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(campo, { target: { value: "uma-senha-qualquer" } });
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(String(url)).not.toContain("uma-senha-qualquer");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("uma-senha-qualquer");
  });

  it("senha recusada vira recado na tela, e o campo continua lá", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { container } = render(<CaixaDeSenha />);
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "x" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Senha não confere.")).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/admin-page.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/admin/CaixaDeSenha"`

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/admin/CaixaDeSenha.tsx
"use client";
import { useState } from "react";

/** A caixa de senha do painel.
 *
 *  🔴 POST com a senha no CORPO, nunca na URL: query string entra no log do
 *  servidor, no histórico do navegador e no `Referer` do próximo link. */
export default function CaixaDeSenha() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/entrar", {
        method: "POST",
        body: JSON.stringify({ senha }),
      });
      if (r.ok) { location.reload(); return; }
      setErro(r.status === 404 ? "O painel não está configurado." : "Senha não confere.");
    } catch {
      setErro("Sem rede.");
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-porta" onSubmit={entrar}>
      <label className="adm-rotulo" htmlFor="adm-senha">Senha do painel</label>
      <input
        id="adm-senha"
        type="password"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <button type="submit" disabled={indo}>{indo ? "Entrando…" : "Entrar"}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
```

```tsx
// src/app/admin/page.tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, sessaoValida } from "@/lib/admin-guarda";
import CaixaDeSenha from "./CaixaDeSenha";
import "./admin.css";

export const dynamic = "force-dynamic";

/** 🔴 Fora do índice. Painel de admin no Google é convite. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Admin() {
  // 🔴 Painel desligado NÃO EXISTE — 404, nunca uma tela dizendo "配ure-me".
  if (!lerConfigAdmin(process.env).ligado) notFound();

  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  const dentro = sessaoValida(process.env, token, Math.floor(Date.now() / 1000));

  return (
    <main className="adm">
      <h1>Painel</h1>
      {dentro ? <p>Em construção — o aviso entra na próxima tarefa.</p> : <CaixaDeSenha />}
    </main>
  );
}
```

> ⚠️ Ao escrever o arquivo, conferir que não sobrou nenhum caractere fora do português no comentário acima (a frase é *"nunca uma tela dizendo 'configure-me'"*).

```css
/* src/app/admin/admin.css — estilo próprio, isolado do `.bp`. O painel não é o
   app: ele não precisa da tipografia da ficha nem herda o tema do carimbo. */
.adm { max-width: 30rem; margin: 0 auto; padding: 1.5rem 1rem; font-family: system-ui, sans-serif; }
.adm h1 { font-size: 1.3rem; margin-bottom: 1rem; }
.adm-porta { display: grid; gap: .6rem; }
.adm-rotulo { font-size: .85rem; }
.adm-porta input { padding: .6rem; font-size: 1rem; border: 1px solid #999; border-radius: 8px; }
.adm-porta button { padding: .7rem; font-size: 1rem; border-radius: 8px; }
.adm-erro { color: #b3261e; font-size: .9rem; }
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo verde; no build, `/admin` aparece como `ƒ`.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | `type="password"` → `type="text"` | MORRE |
| M2 | mandar a senha na URL (`?senha=`) em vez do corpo | MORRE |
| M3 | apagar o `notFound()` da página | precisa de teste próprio — ver abaixo |
| M4 | apagar o `metadata` de robots | precisa de teste próprio — ver abaixo |

M3 e M4 pedem um teste que importe `@/app/admin/page` e leia `metadata`, e outro que rode a página com env vazio esperando `notFound`. Escrevê-los nesta tarefa, não depois: mutação sem guarda é buraco conhecido.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin tests/app/admin-page.test.tsx
git commit -m "feat(admin): a tela da porta -- senha no corpo, fora do indice, e 404 com o painel desligado"
```

---

## Task 6: A tabela do aviso

**Files:**
- Modify: `src/lib/db.ts`
- Test: `tests/lib/db-avisos.test.ts`

**Interfaces:**
- Consumes: `getClient`, `ensureSchema` (existentes).
- Produces:
  - `type EfeitoAviso = "nenhum" | "fresco" | "frio" | "fechado"`
  - `type AvisoLinha = { id: number; ficha_slug: string; texto: string; efeito: EfeitoAviso; criado_em: number; vence_em: number }`
  - `inserirAviso(client, slug, texto, efeito, criadoEm, venceEm): Promise<number>` (devolve o id)
  - `avisoVigente(client, slug, agora): Promise<AvisoLinha | null>`
  - `avisosVigentes(client, agora): Promise<Map<string, AvisoLinha>>`
  - `retirarAviso(client, id): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/db-avisos.test.ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { avisoVigente, avisosVigentes, ensureSchema, inserirAviso, retirarAviso } from "@/lib/db";

let c: Client;
const AGORA = 1_757_000_000;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await ensureSchema(c); });
afterEach(() => c.close());

describe("avisos", () => {
  it("grava e lê o vigente", async () => {
    await inserirAviso(c, "rampa-do-pepe", "em reforma", "fechado", AGORA, AGORA + 3600);
    const a = await avisoVigente(c, "rampa-do-pepe", AGORA);
    expect(a?.texto).toBe("em reforma");
    expect(a?.efeito).toBe("fechado");
  });

  it("lugar sem aviso devolve null", async () => {
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA)).toBeNull();
  });

  // 🔴 O prazo é o ponto do campo: aviso sem validade é mentira agendada — "em
  // reforma" ainda no ar em março. A borda decide de um jeito só.
  it("vencido não é vigente, e o instante exato do vencimento já venceu", async () => {
    await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 60);
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA + 59)).not.toBeNull();
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA + 60)).toBeNull();
  });

  it("dois avisos no mesmo lugar: vence o mais recente", async () => {
    await inserirAviso(c, "rampa-do-pepe", "velho", "frio", AGORA, AGORA + 3600);
    await inserirAviso(c, "rampa-do-pepe", "novo", "fresco", AGORA + 10, AGORA + 3600);
    expect((await avisoVigente(c, "rampa-do-pepe", AGORA + 20))?.texto).toBe("novo");
  });

  // 🔴 APPEND-ONLY. Retirar não apaga: num app cuja linha vermelha é
  // procedência, saber o que foi dito sobre um lugar e quando não é luxo.
  it("retirar tira da tela mas NAO apaga a linha", async () => {
    const id = await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 3600);
    await retirarAviso(c, id);
    expect(await avisoVigente(c, "rampa-do-pepe", AGORA)).toBeNull();
    const todas = await c.execute("SELECT COUNT(*) AS n FROM avisos");
    expect(Number(todas.rows[0].n), "a linha foi APAGADA — o historico morreu").toBe(1);
  });

  it("o aviso de um lugar não vaza para outro", async () => {
    await inserirAviso(c, "rampa-do-pepe", "obra", "frio", AGORA, AGORA + 3600);
    expect(await avisoVigente(c, "veu-de-noiva-de-bonito", AGORA)).toBeNull();
  });

  it("avisosVigentes traz todos de uma vez, sem os vencidos nem os retirados", async () => {
    await inserirAviso(c, "rampa-do-pepe", "a", "frio", AGORA, AGORA + 3600);
    await inserirAviso(c, "veu-de-noiva-de-bonito", "b", "nenhum", AGORA, AGORA + 10);
    const m = await avisosVigentes(c, AGORA + 20);
    expect([...m.keys()]).toEqual(["rampa-do-pepe"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/db-avisos.test.ts`
Expected: FAIL — `inserirAviso is not a function`

- [ ] **Step 3: Write the implementation**

Acrescentar ao `src/lib/db.ts`:

```ts
export type EfeitoAviso = "nenhum" | "fresco" | "frio" | "fechado";

export type AvisoLinha = {
  id: number;
  ficha_slug: string;
  texto: string;
  efeito: EfeitoAviso;
  criado_em: number;
  vence_em: number;
};
```

No `ensureSchema`, depois das duas tabelas existentes:

```ts
  // 🔴 APPEND-ONLY, e `retirado` em vez de DELETE: o aviso é afirmação do dono
  // sobre um lugar real. Saber o que foi dito e quando é a régua deste projeto.
  // `vence_em` é NOT NULL de propósito — aviso sem prazo é mentira agendada.
  await client.execute(`CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    texto TEXT NOT NULL, efeito TEXT NOT NULL,
    criado_em INTEGER NOT NULL, vence_em INTEGER NOT NULL,
    retirado INTEGER NOT NULL DEFAULT 0)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS avisos_por_lugar ON avisos (ficha_slug, retirado, vence_em)`,
  );
```

E as funções:

```ts
export async function inserirAviso(
  client: Client, slug: string, texto: string, efeito: EfeitoAviso,
  criadoEm: number, venceEm: number,
): Promise<number> {
  const r = await client.execute({
    sql: `INSERT INTO avisos (ficha_slug, texto, efeito, criado_em, vence_em)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [slug, texto, efeito, criadoEm, venceEm],
  });
  return Number(r.rows[0].id);
}

function linha(r: Record<string, unknown>): AvisoLinha {
  return {
    id: Number(r.id), ficha_slug: String(r.ficha_slug), texto: String(r.texto),
    efeito: String(r.efeito) as EfeitoAviso,
    criado_em: Number(r.criado_em), vence_em: Number(r.vence_em),
  };
}

/** O aviso que vale AGORA pra este lugar: o mais recente que não venceu e não
 *  foi retirado. `vence_em > agora` — no instante exato do prazo, já venceu. */
export async function avisoVigente(
  client: Client, slug: string, agora: number,
): Promise<AvisoLinha | null> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE ficha_slug = ? AND retirado = 0 AND vence_em > ?
          ORDER BY criado_em DESC, id DESC LIMIT 1`,
    args: [slug, agora],
  });
  return r.rows.length ? linha(r.rows[0] as unknown as Record<string, unknown>) : null;
}

/** Todos os vigentes de uma vez — a home tem N lugares, e N consultas saindo
 *  do celular no portão é o que `resolverEstados` já existe pra evitar. */
export async function avisosVigentes(
  client: Client, agora: number,
): Promise<Map<string, AvisoLinha>> {
  const r = await client.execute({
    sql: `SELECT id, ficha_slug, texto, efeito, criado_em, vence_em FROM avisos
          WHERE retirado = 0 AND vence_em > ? ORDER BY criado_em ASC, id ASC`,
    args: [agora],
  });
  const fora = new Map<string, AvisoLinha>();
  // ASC + set = o último a entrar vence, que é o mais recente. Um por lugar.
  for (const row of r.rows) {
    const a = linha(row as unknown as Record<string, unknown>);
    fora.set(a.ficha_slug, a);
  }
  return fora;
}

/** Tirar da tela. NUNCA apaga a linha — ver o comentário da tabela. */
export async function retirarAviso(client: Client, id: number): Promise<void> {
  await client.execute({ sql: `UPDATE avisos SET retirado = 1 WHERE id = ?`, args: [id] });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/lib/db-avisos.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | `vence_em > ?` → `vence_em >= ?` | MORRE |
| M2 | tirar `AND retirado = 0` | MORRE |
| M3 | `retirarAviso` vira `DELETE FROM avisos` | MORRE |
| M4 | `ORDER BY criado_em DESC` → `ASC` | MORRE |
| M5 | tirar `AND ficha_slug = ?` | MORRE |
| M6 | em `avisosVigentes`, `ORDER BY criado_em ASC` → `DESC` | MORRE |

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts tests/lib/db-avisos.test.ts
git commit -m "feat(aviso): a tabela append-only do aviso do dono -- retirar nunca apaga"
```

---

## Task 7: `aplicarAviso`, a decisão pura

**Files:**
- Create: `src/lib/aviso.ts`
- Test: `tests/lib/aviso.test.ts`

**Interfaces:**
- Consumes: `EfeitoAviso`, `AvisoLinha` (Task 6); `LeituraCarimbo` (`@/lib/carimbo-estado`).
- Produces:
  - `type Aviso = { texto: string; efeito: EfeitoAviso; criadoEm: number; venceEm: number }`
  - `daLinha(l: AvisoLinha): Aviso`
  - `aplicarAviso(leitura: LeituraCarimbo, aviso: Aviso | null): LeituraCarimbo`
  - `fechadoPeloDono(aviso: Aviso | null): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/aviso.test.ts
import { describe, expect, it } from "vitest";
import { aplicarAviso, fechadoPeloDono, type Aviso } from "@/lib/aviso";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

const AGORA = 1_757_000_000;
const chuvosa: LeituraCarimbo = { estado: "frio", erro: false, calculadoEm: AGORA, aviso: null };
const seca: LeituraCarimbo = { estado: "fresco", erro: false, calculadoEm: AGORA, aviso: null };
const av = (efeito: Aviso["efeito"], texto = "t"): Aviso => ({
  texto, efeito, criadoEm: AGORA, venceEm: AGORA + 3600,
});

describe("aplicarAviso", () => {
  it("sem aviso, a leitura passa intacta", () => {
    expect(aplicarAviso(chuvosa, null)).toEqual(chuvosa);
  });

  // 🔴 O DONO GANHA DO MOTOR. Ele sabe mais que a chuva — foi pra isso que o
  // campo existe. O motor dizendo "frio" e ele dizendo "secou" resolve nele.
  it("efeito fresco ganha de um motor que disse frio", () => {
    expect(aplicarAviso(chuvosa, av("fresco")).estado).toBe("fresco");
  });

  it("efeito frio ganha de um motor que disse fresco", () => {
    expect(aplicarAviso(seca, av("frio")).estado).toBe("frio");
  });

  // 🔴 `nenhum` é o caso do recado PURO: "a ponte caiu, tem desvio pela
  // direita" — vá, mas saiba disso. Mexer no estado aqui faria o app atribuir
  // ao aviso um veredito que o dono não deu.
  it("efeito nenhum NAO mexe no estado — só acrescenta o recado", () => {
    const r = aplicarAviso(chuvosa, av("nenhum", "ponte caiu"));
    expect(r.estado).toBe("frio");
    expect(r.aviso?.texto).toBe("ponte caiu");
  });

  // 🔴 `fechado` NAO e estado: o motor so responde fresco|frio. "Em reforma"
  // nao pode virar "frio", senao o app diz NAO VA com as palavras da CHUVA —
  // atribuindo ao tempo uma coisa que e obra. Quem le o fechado e a fase.
  it("efeito fechado nao vira estado de chuva", () => {
    const r = aplicarAviso(seca, av("fechado", "em reforma"));
    expect(r.estado).toBe("fresco");
    expect(fechadoPeloDono(r.aviso)).toBe(true);
  });

  it("o aviso viaja junto na leitura, sempre", () => {
    expect(aplicarAviso(seca, av("frio", "molhou")).aviso?.texto).toBe("molhou");
  });

  it("o erro da leitura nunca é mascarado pelo aviso", () => {
    const semLeitura: LeituraCarimbo = { estado: "frio", erro: true, calculadoEm: AGORA, aviso: null };
    expect(aplicarAviso(semLeitura, av("fresco")).erro).toBe(true);
  });
});

describe("fechadoPeloDono", () => {
  it("só o efeito fechado fecha", () => {
    expect(fechadoPeloDono(null)).toBe(false);
    expect(fechadoPeloDono(av("nenhum"))).toBe(false);
    expect(fechadoPeloDono(av("frio"))).toBe(false);
    expect(fechadoPeloDono(av("fresco"))).toBe(false);
    expect(fechadoPeloDono(av("fechado"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/aviso.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/aviso"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/aviso.ts
import type { AvisoLinha, EfeitoAviso } from "@/lib/db";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";

/** O aviso como ele viaja pra tela: sem `id`, sem `retirado`. */
export type Aviso = {
  texto: string;
  efeito: EfeitoAviso;
  criadoEm: number;
  venceEm: number;
};

export function daLinha(l: AvisoLinha): Aviso {
  return { texto: l.texto, efeito: l.efeito, criadoEm: l.criado_em, venceEm: l.vence_em };
}

/** O lugar está fechado porque o DONO disse, não porque o calendário disse.
 *
 *  🔴 POR QUE `fechado` NÃO É ESTADO: o motor só responde `fresco | frio` — ele
 *  só sabe de chuva. Transformar "em reforma" em `frio` faria o app dizer "não
 *  vá" **com as palavras da chuva** (`falaMolhada`), atribuindo ao tempo uma
 *  coisa que é obra. O app afirmando causa falsa é a linha vermelha deste
 *  projeto. Quem lê isto é `faseDe`, pelo campo `fechadoPeloDono`. */
export function fechadoPeloDono(aviso: Aviso | null | undefined): boolean {
  return aviso?.efeito === "fechado";
}

/** A leitura do carimbo depois da palavra do dono.
 *
 *  🔴 O DONO GANHA DO MOTOR, sempre. Ele esteve lá; a previsão não. Só os
 *  efeitos `fresco` e `frio` mexem no estado — `nenhum` é recado puro e
 *  `fechado` não é estado (ver acima).
 *
 *  `erro` NUNCA é mascarado: se o servidor não conseguiu ler a chuva, isso
 *  continua verdade, e a tela continua tendo que dizer. Um aviso não é uma
 *  leitura de chuva. */
export function aplicarAviso(leitura: LeituraCarimbo, aviso: Aviso | null): LeituraCarimbo {
  if (!aviso) return leitura;
  const estado =
    aviso.efeito === "fresco" || aviso.efeito === "frio" ? aviso.efeito : leitura.estado;
  return { ...leitura, estado, aviso };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/lib/aviso.test.ts && npx tsc --noEmit`
Expected: `tsc` vai reclamar de `aviso` não existir em `LeituraCarimbo` — isso é esperado e a Task 8 resolve. Rodar mesmo assim e anotar o erro.

> ⚠️ Task 7 e Task 8 compartilham um commit se o `tsc` não fechar sozinho. É a única exceção do plano: o tipo e quem o preenche nascem juntos.

- [ ] **Step 5: Commit (junto com a Task 8)**

---

## Task 8: O aviso entra na leitura

**Files:**
- Modify: `src/lib/carimbo-estado.ts`
- Modify: `src/lib/carimbo-fase.ts` (`Situacao` ganha `fechadoPeloDono: boolean`)
- Modify: `src/app/Carimbo.tsx`, `src/app/MioloHome.tsx`, `src/app/PinTrilha.tsx`, `src/app/SeloTrilha.tsx`, `src/app/[slug]/page.tsx`
- Test: `tests/lib/carimbo-estado-aviso.test.ts`, e o `tests/lib/carimbo-fase.test.ts` existente

**Interfaces:**
- Consumes: `aplicarAviso`, `daLinha`, `fechadoPeloDono`, `Aviso` (Task 7); `avisoVigente`, `avisosVigentes`, `getClient` (Task 6).
- Produces:
  - `LeituraCarimbo = { estado: Estado; erro: boolean; calculadoEm: number; aviso: Aviso | null }`
  - `Situacao` com `fechadoPeloDono: boolean` **obrigatório**
  - `faseDe` devolve `"fechado"` quando `fechado || fechadoPeloDono`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/carimbo-estado-aviso.test.ts
import { describe, expect, it } from "vitest";
import { faseDe } from "@/lib/carimbo-fase";

const base = { conferindo: false, erro: false, venceu: false, falhou: false, fechadoPeloDono: false };

describe("faseDe com o aviso do dono", () => {
  // 🔴 "A rampa esta em reforma" fecha o lugar, e nao e o calendario que diz.
  // Sem esta linha o app so sabe fechar por horario/dias — e a frase dele de
  // 11/09 continuaria sem ter onde morar.
  it("o dono fecha o lugar, mesmo sem horario e sem dias", () => {
    expect(faseDe({ ...base, fechadoPeloDono: true })).toBe("fechado");
  });

  it("o fechado do dono ganha de conferindo, igual ao do calendario", () => {
    expect(faseDe({ ...base, conferindo: true, fechadoPeloDono: true })).toBe("fechado");
  });

  it("sem aviso, nada muda no que ja existia", () => {
    expect(faseDe({ ...base })).toBe("afirmando");
    expect(faseDe({ ...base, conferindo: true })).toBe("conferindo");
    expect(faseDe({ ...base, erro: true })).toBe("sem-informacoes");
    expect(faseDe({ ...base, fechado: true })).toBe("fechado");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/carimbo-estado-aviso.test.ts`
Expected: FAIL — `expected 'afirmando' to be 'fechado'`

- [ ] **Step 3: Write the implementation**

Em `src/lib/carimbo-fase.ts`, dentro de `Situacao`:

```ts
  /** O DONO disse que está fechado, e não o calendário.
   *
   *  🔴 OBRIGATÓRIO, e é o ponto do campo. `fechado` (acima) é opcional porque
   *  o primeiro render não sabe a hora ainda. Este não tem essa desculpa: ele
   *  vem do servidor junto com a leitura. Opcional, esquecer um dos CINCO
   *  pontos que montam `Situacao` passaria em silêncio — e o lugar apareceria
   *  ABERTO na tela com o dono tendo dito que está fechado. Obrigatório, o
   *  `tsc` é o guarda, sem grep e sem disciplina. */
  fechadoPeloDono: boolean;
```

E em `faseDe`:

```ts
export function faseDe({ conferindo, erro, venceu, falhou, fechado, fechadoPeloDono }: Situacao): Fase {
  if (fechado || fechadoPeloDono) return "fechado";
  if (conferindo) return "conferindo";
  return erro || venceu || falhou ? "sem-informacoes" : "afirmando";
}
```

Em `src/lib/carimbo-estado.ts`:

```ts
export type LeituraCarimbo = {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  /** A palavra do dono sobre este lugar, se houver uma valendo agora.
   *  `null` explícito (e não opcional) para que o guarda `ehLeitura` da tela
   *  possa exigir a chave — leitura sem a chave é leitura de uma versão velha
   *  do servidor, e tratar isso como "sem aviso" esconderia um aviso real. */
  aviso: Aviso | null;
};
```

`resolverEstado` passa a ler o banco e aplicar:

```ts
export async function resolverEstado(ficha: Ficha, debug?: string): Promise<LeituraCarimbo> {
  const agora = Math.floor(Date.now() / 1000);
  const aviso = await lerAviso(ficha.slug, agora);
  const base = await semAviso(ficha, debug, agora);
  return aplicarAviso(base, aviso);
}

/** O aviso, e nunca uma exceção: banco fora do ar não pode derrubar o carimbo.
 *  Sem aviso é o caso NORMAL — é assim que o app roda hoje. */
async function lerAviso(slug: string, agora: number): Promise<Aviso | null> {
  try {
    const l = await avisoVigente(getClient(), slug, agora);
    return l ? daLinha(l) : null;
  } catch {
    return null;
  }
}
```

> `semAviso` é o corpo atual de `resolverEstado`, extraído, devolvendo `aviso: null`. Mesmo tratamento em `resolverEstados`, usando `avisosVigentes` numa consulta só.

Depois disso, rodar `npx tsc --noEmit`: ele aponta os **cinco** pontos que montam `Situacao`. Em cada um, passar `fechadoPeloDono: fechadoPeloDono(leitura.aviso)`.

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo verde. Se algum teste existente quebrar por falta de `aviso`/`fechadoPeloDono` nos fixtures, **acrescentar o campo ao fixture** — nunca tornar o campo opcional pra calar o `tsc`.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | `fechado \|\| fechadoPeloDono` → `fechado` | MORRE |
| M2 | `fechadoPeloDono` vira opcional em `Situacao` | não quebra teste — é por isso que é obrigatório; anotar |
| M3 | em `aplicarAviso`, tratar `fechado` como estado `frio` | MORRE (Task 7) |
| M4 | `lerAviso` devolvendo sempre `null` | MORRE |
| M5 | tirar o `try/catch` de `lerAviso` | precisa de teste: banco estourando não pode derrubar o carimbo. Escrever. |

- [ ] **Step 6: Commit**

```bash
git add src/lib/aviso.ts src/lib/carimbo-estado.ts src/lib/carimbo-fase.ts src/app tests/lib/aviso.test.ts tests/lib/carimbo-estado-aviso.test.ts
git commit -m "feat(aviso): a palavra do dono ganha do motor -- e 'em reforma' fecha sem ser chuva"
```

---

## Task 9: A rota que publica e retira

**Files:**
- Create: `src/app/api/admin/aviso/route.ts`
- Test: `tests/api/route-admin-aviso.test.ts`

**Interfaces:**
- Consumes: `sessaoValida`, `COOKIE_ADMIN` (Task 4); `inserirAviso`, `retirarAviso`, `avisoVigente`, `getClient` (Task 6); `getFicha` (`@/lib/ficha`).
- Produces: `POST /api/admin/aviso` `{ slug, texto, efeito, venceEm }`; `DELETE /api/admin/aviso?id=N`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/route-admin-aviso.test.ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { avisoVigente, ensureSchema } from "@/lib/db";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste";
let client: Client;

vi.mock("@/lib/db", async (io) => {
  const mod = await io<typeof import("@/lib/db")>();
  return { ...mod, getClient: () => client };
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await ensureSchema(client);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
});
afterEach(() => { client.close(); vi.unstubAllEnvs(); });

const comSessao = (body: unknown) => {
  const t = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  return new Request("http://x/api/admin/aviso", {
    method: "POST",
    headers: { cookie: `${COOKIE_ADMIN}=${t}` },
    body: JSON.stringify(body),
  });
};

const daquiAUmaHora = () => Math.floor(Date.now() / 1000) + 3600;

describe("POST /api/admin/aviso", () => {
  it("com sessão, publica o aviso", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      comSessao({ slug: "rampa-do-pepe", texto: "em reforma", efeito: "fechado", venceEm: daquiAUmaHora() }),
    );
    expect(res.status).toBe(200);
    const a = await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000));
    expect(a?.texto).toBe("em reforma");
  });

  // 🔴 A rota que MUDA o que o app afirma sobre um lugar real nao pode aceitar
  // ninguem sem sessao. Este e o teste mais importante do arquivo.
  it("sem cookie, 401 — e nada e gravado", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(
      new Request("http://x/api/admin/aviso", {
        method: "POST",
        body: JSON.stringify({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }),
      }),
    );
    expect(res.status).toBe(401);
    expect(await avisoVigente(client, "rampa-do-pepe", Math.floor(Date.now() / 1000))).toBeNull();
  });

  it("cookie assinado com outro segredo é recusado", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const t = criarSessao("outro-segredo-qualquer", Math.floor(Date.now() / 1000), 3600);
    const res = await POST(
      new Request("http://x/api/admin/aviso", {
        method: "POST",
        headers: { cookie: `${COOKIE_ADMIN}=${t}` },
        body: JSON.stringify({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("slug que não existe no acervo → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "morro-inventado", texto: "x", efeito: "frio", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  it("efeito fora do vocabulário → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "molhado", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  it("texto vazio → 400: aviso sem palavra não é aviso", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const res = await POST(comSessao({ slug: "rampa-do-pepe", texto: "   ", efeito: "frio", venceEm: daquiAUmaHora() }));
    expect(res.status).toBe(400);
  });

  // 🔴 O PRAZO E OBRIGATORIO, e no passado nao e prazo: seria publicar um
  // aviso que ja nasce vencido, invisivel, com o dono achando que publicou.
  it("prazo ausente ou no passado → 400", async () => {
    const { POST } = await import("@/app/api/admin/aviso/route");
    const agora = Math.floor(Date.now() / 1000);
    expect((await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio" }))).status).toBe(400);
    expect((await POST(comSessao({ slug: "rampa-do-pepe", texto: "x", efeito: "frio", venceEm: agora - 1 }))).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/route-admin-aviso.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/admin/aviso/route.ts
import { COOKIE_ADMIN, sessaoValida } from "@/lib/admin-guarda";
import { getClient, inserirAviso, retirarAviso, type EfeitoAviso } from "@/lib/db";
import { getFicha } from "@/lib/ficha";

export const dynamic = "force-dynamic";

const EFEITOS: readonly EfeitoAviso[] = ["nenhum", "fresco", "frio", "fechado"];

function tokenDoCookie(req: Request): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_ADMIN}=`))
    ?.slice(COOKIE_ADMIN.length + 1);
}

export async function POST(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }

  let body: { slug?: unknown; texto?: unknown; efeito?: unknown; venceEm?: unknown };
  try { body = await req.json(); } catch { return new Response("", { status: 400 }); }

  const { slug, texto, efeito, venceEm } = body;
  if (typeof slug !== "string" || getFicha(slug) == null) return new Response("", { status: 400 });
  if (typeof texto !== "string" || texto.trim() === "") return new Response("", { status: 400 });
  if (typeof efeito !== "string" || !EFEITOS.includes(efeito as EfeitoAviso)) {
    return new Response("", { status: 400 });
  }
  // 🔴 Prazo no passado nasce vencido: o dono acha que publicou e a tela não
  // mostra nada. Recusar aqui é o que torna isso impossível.
  if (typeof venceEm !== "number" || venceEm <= agora) return new Response("", { status: 400 });

  const id = await inserirAviso(getClient(), slug, texto.trim(), efeito as EfeitoAviso, agora, venceEm);
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) {
    return new Response("", { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("", { status: 400 });
  await retirarAviso(getClient(), id);
  return new Response("", { status: 200, headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/api/route-admin-aviso.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | apagar o `if (!sessaoValida(...))` do POST | MORRE |
| M2 | apagar o `if (!sessaoValida(...))` do DELETE | precisa de teste do DELETE sem cookie — escrever |
| M3 | `venceEm <= agora` → `venceEm < agora` | MORRE |
| M4 | tirar a validação de `efeito` | MORRE |
| M5 | tirar a validação de `getFicha(slug)` | MORRE |
| M6 | `texto.trim() === ""` → remover | MORRE |

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/aviso tests/api/route-admin-aviso.test.ts
git commit -m "feat(aviso): a rota que publica e retira -- sessao obrigatoria e prazo que nao nasce vencido"
```

---

## Task 10: O painel

**Files:**
- Create: `src/app/admin/PainelAdmin.tsx`
- Modify: `src/app/admin/page.tsx`, `src/app/admin/admin.css`
- Test: `tests/app/painel-admin.test.tsx`

**Interfaces:**
- Consumes: rota da Task 9; `getAllFichas` (`@/lib/ficha`); `resolverEstados` (Task 8); `falaMolhada` (`@/lib/severidade`).
- Produces: `PainelAdmin({ fichas, leituras })`, client component.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/painel-admin.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import PainelAdmin from "@/app/admin/PainelAdmin";
import { getAllFichas } from "@/lib/ficha";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const AGORA = 1_757_000_000;
const fichas = getAllFichas();
const leituras = Object.fromEntries(
  fichas.map((f) => [f.slug, { estado: "fresco" as const, erro: false, calculadoEm: AGORA, aviso: null }]),
);

describe("PainelAdmin", () => {
  // 🔴 Varre o ACERVO, nunca uma lista de slugs escrita a mao: guarda que
  // enumera o acervo a mao e cego a ele crescer — especie ja catalogada.
  it("lista TODAS as fichas do acervo", () => {
    render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    expect(fichas.length).toBeGreaterThanOrEqual(3);
    for (const f of fichas) {
      expect(screen.getByText(f.trajeto.waypoints[0].nome)).not.toBeNull();
    }
  });

  it("publicar manda slug, texto, efeito e prazo no corpo", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const alvo = fichas[0].slug;
    fireEvent.change(container.querySelector(`textarea[data-slug="${alvo}"]`)!, {
      target: { value: "em reforma" },
    });
    fireEvent.click(container.querySelector(`button[data-publicar="${alvo}"]`)!);
    await vi.waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const corpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(corpo.slug).toBe(alvo);
    expect(corpo.texto).toBe("em reforma");
    expect(typeof corpo.venceEm).toBe("number");
    expect(corpo.venceEm).toBeGreaterThan(AGORA);
  });

  // 🔴 CONSEQUENCIA A VISTA: escolher um efeito tem que mostrar o que vai a
  // tela, nao o nome do efeito. Numero sem consequencia e como se troca o
  // limiar de chuva de uma serra real sem perceber.
  it("escolher 'fechado' avisa que o lugar vai aparecer fechado", () => {
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const alvo = fichas[0].slug;
    fireEvent.change(container.querySelector(`select[data-efeito="${alvo}"]`)!, {
      target: { value: "fechado" },
    });
    expect(screen.getByText(/vai aparecer FECHADO/i)).not.toBeNull();
  });

  it("nao da pra publicar sem texto", () => {
    const { container } = render(<PainelAdmin fichas={fichas} leituras={leituras} agora={AGORA} />);
    const botao = container.querySelector(`button[data-publicar="${fichas[0].slug}"]`) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/painel-admin.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/admin/PainelAdmin"`

- [ ] **Step 3: Write the implementation**

`PainelAdmin` é um client component com, por ficha: o nome, o que o motor diz agora, o aviso vigente (se houver, com "publicado há N dias" e botão de tirar), um `<textarea data-slug>`, um `<select data-efeito>` com os quatro efeitos, um `<select data-prazo>` com os atalhos (`amanhã`, `3 dias`, `1 semana`, `1 mês`, `6 meses`), a linha de consequência, e `<button data-publicar>`.

A linha de consequência, que é o ponto da tela:

```tsx
function consequencia(efeito: EfeitoAviso, ficha: Ficha): string {
  if (efeito === "fechado") return "O lugar vai aparecer FECHADO, e não por causa de chuva.";
  if (efeito === "frio") {
    const voz = vozDaFicha(ficha.condicao);
    return `O carimbo vai dizer “${falaMolhada(voz.severidade, voz.horasPassado).marca}”.`;
  }
  if (efeito === "fresco") return "O carimbo vai dizer “Pode ir”, mesmo se tiver chovido.";
  return "O carimbo não muda — só o recado aparece na ficha.";
}
```

> 🔴 As palavras de `frio` saem de `falaMolhada`, nunca escritas aqui. É a mesma língua da ficha, e foi ela que resolveu, em 10/09, a voz de um lugar ter virado a língua de todos.

E `src/app/admin/page.tsx` passa a montar `PainelAdmin` quando `dentro === true`, com `getAllFichas()` e `await resolverEstados(...)`.

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | listar só `fichas[0]` | MORRE |
| M2 | `consequencia` do `frio` virar string fixa "Não vá" | MORRE (o texto tem que vir de `falaMolhada`) |
| M3 | o botão nunca ficar `disabled` | MORRE |
| M4 | `venceEm` virar `agora` | MORRE |

- [ ] **Step 6: Commit**

```bash
git add src/app/admin tests/app/painel-admin.test.tsx
git commit -m "feat(admin): o painel -- o acervo inteiro, e o efeito mostrando a palavra que vai ao ar"
```

---

## Task 11: O aviso na ficha

**Files:**
- Create: `src/app/AvisoDoDono.tsx`
- Modify: `src/app/[slug]/page.tsx`, `src/app/ficha.css`
- Test: `tests/app/aviso-do-dono.test.tsx`

**Interfaces:**
- Consumes: `Aviso` (Task 7).
- Produces: `AvisoDoDono({ aviso, agora })`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/app/aviso-do-dono.test.tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import AvisoDoDono from "@/app/AvisoDoDono";
import { semComentarios, regraDe } from "../css";

afterEach(() => { cleanup(); });
const AGORA = 1_757_000_000;
const aviso = { texto: "A rampa está em reforma", efeito: "fechado" as const, criadoEm: AGORA - 2 * 86400, venceEm: AGORA + 86400 };

describe("AvisoDoDono", () => {
  it("mostra a frase do dono", () => {
    render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(screen.getByText("A rampa está em reforma")).not.toBeNull();
  });

  it("sem aviso, não desenha nada", () => {
    const { container } = render(<AvisoDoDono aviso={null} agora={AGORA} />);
    expect(container.textContent).toBe("");
  });

  // 🔴 A DATA NAO E ENFEITE: um recado sem quando e um recado que a pessoa nao
  // sabe se ainda vale. "Publicado ha 2 dias" e o que deixa ela julgar.
  it("diz quando foi publicado", () => {
    render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(screen.getByText(/há 2 dias/i)).not.toBeNull();
  });

  // 🔴 A LINHA VERMELHA DO PROJETO. O aviso e do DONO; a `voz` e de quem
  // conhece o lugar. Sao procedencias diferentes, e o app inteiro se apoia
  // nessa distincao. Mesma classe do defeito de setembro, quando prosa minha
  // foi ao ar assinada como a voz dele.
  it("nao usa a marca da voz de quem conhece", () => {
    const { container } = render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(container.querySelector(".voz")).toBeNull();
    expect(container.querySelector('[data-nivel="b"]')).toBeNull();
    expect(container.textContent).not.toContain("a voz de quem conhece");
  });

  it("o bloco tem estilo proprio no ficha.css", () => {
    expect(regraDe(semComentarios("ficha.css"), ".bp .aviso-dono")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/aviso-do-dono.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/AvisoDoDono.tsx
import type { Aviso } from "@/lib/aviso";

/** Quantos dias inteiros separam os dois instantes. */
function diasDesde(criadoEm: number, agora: number): number {
  return Math.floor((agora - criadoEm) / 86400);
}

function quando(dias: number): string {
  if (dias <= 0) return "publicado hoje";
  if (dias === 1) return "publicado há 1 dia";
  return `publicado há ${dias} dias`;
}

/** O recado do DONO sobre este lugar.
 *
 *  🔴 BLOCO PRÓPRIO, e nunca a marca da `voz`: a voz é de quem conhece o lugar
 *  e é verdade parada; isto é o dono falando de AGORA, e vence. Misturar as
 *  duas apagaria a distinção de procedência sobre a qual este app inteiro se
 *  apoia — a mesma que já falhou uma vez, em setembro.
 *
 *  A data não é enfeite: recado sem quando é recado que a pessoa não sabe se
 *  ainda vale. */
export default function AvisoDoDono({ aviso, agora }: { aviso: Aviso | null; agora: number }) {
  if (!aviso) return null;
  return (
    <div className="aviso-dono">
      <p className="aviso-dono-txt">{aviso.texto}</p>
      <span className="aviso-dono-quando">{quando(diasDesde(aviso.criadoEm, agora))}</span>
    </div>
  );
}
```

Em `src/app/[slug]/page.tsx`, logo abaixo do carimbo e **acima** do bloco da voz:

```tsx
<AvisoDoDono aviso={leitura.aviso} agora={Math.floor(Date.now() / 1000)} />
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 5: Medir mutação**

| # | mutação | esperado |
|---|---|---|
| M1 | apagar o `<span>` da data | MORRE |
| M2 | `className="aviso-dono"` → `className="voz"` | MORRE |
| M3 | `if (!aviso) return null` → renderizar caixa vazia | MORRE |
| M4 | `dias === 1` → sempre plural | MORRE |

- [ ] **Step 6: Commit e fechamento da rodada**

```bash
git add src/app/AvisoDoDono.tsx "src/app/[slug]/page.tsx" src/app/ficha.css tests/app/aviso-do-dono.test.tsx
git commit -m "feat(aviso): o recado do dono na ficha -- bloco proprio, com data, longe da voz"
npx --yes vercel@latest --prod --yes --scope bate-perna
```

Depois do deploy, o ritual completo: conferir no domínio real, marcadores **sem acento**, e **abrir o navegador** — entrar no painel, publicar um aviso numa ficha, ver ele aparecer, ver o efeito `fechado` mudar o carimbo, e retirar.

---

## Auto-revisão do plano

**Cobertura da spec:**

| requisito da spec | tarefa |
|---|---|
| senha → cookie assinado, tempo constante | 1, 4 |
| lógica pura fora do handler | 1, 3, 7 |
| falha fechada sem `ADMIN_SENHA` | 3, 4, 5 |
| senha curta desliga | 3, 4 |
| `/admin` em `RESERVADOS` | 2 |
| `/admin` fora do índice | 5 |
| `/admin` fora do cache do PWA | 2 |
| tabela `avisos` append-only | 6 |
| `aplicarAviso`, dono ganha do motor | 7 |
| efeito `fechado` sem virar chuva | 7, 8 |
| prazo obrigatório | 6, 9, 10 |
| um aviso vigente por lugar | 6 |
| bloco próprio na ficha, com data, longe da voz | 11 |
| consequência à vista nos campos de máquina | 10 |
| mesma validade offline do carimbo | herdado — o aviso viaja na `LeituraCarimbo` |

**Lacunas conhecidas, ditas em voz alta:**

1. ~~`/admin` fora do precache do PWA não tem tarefa.~~ **Fechada na própria revisão:** a Task 2 ganhou a segunda metade (`podeGuardarPagina`), porque `RESERVADOS` só fecha um dos dois caminhos — o listener das fichas. O `NetworkFirst` genérico de navegação é o outro, e ele guardaria o painel.
2. **A mutação M3 da Task 4** (`senhaConfere` → `===`) sobrevive por valor. É o par conhecido da M1 da Task 1, e o remédio é o guarda de fonte descrito lá. Está anotado nos dois lugares de propósito.
3. **`ensureSchema` precisa rodar em produção** com a tabela nova. Conferir `scripts/apply-schema.ts` antes do deploy da Task 6 — se ele for o caminho, rodá-lo; se o schema nasce sozinho, confirmar que nasce.

**Consistência de tipos:** `LeituraCarimbo.aviso: Aviso | null` (Task 8) é o que a Task 7 assume e o que a Task 11 consome. `EfeitoAviso` nasce em `db.ts` (Task 6) e é usado nas Tasks 7, 9, 10. `Situacao.fechadoPeloDono: boolean` (Task 8) é obrigatório, e é o `tsc` que encontra os cinco pontos.
