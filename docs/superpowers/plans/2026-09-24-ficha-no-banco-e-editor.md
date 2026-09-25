# A ficha no banco e o editor da voz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar a ficha do JSON em disco e pô-la no banco, versionada e append-only, e dar ao painel uma tela por lugar onde o João reescreve a `voz` do celular e volta atrás quando quiser.

**Architecture:** A ficha inteira migra para `ficha_versoes` (uma linha por versão, documento JSON completo); "a ficha de agora" é a versão de maior `id` de cada slug. A leitura passa por um módulo próprio com prazo (`comPrazo`) e cópia da última boa em memória; sem banco e sem memória, a página cai no `error.tsx` — nunca conteúdo velho, nunca conteúdo inventado. O painel vira lista → lugar, e a escrita valida o documento inteiro pelo `fichaSchema` antes de virar versão.

**Tech Stack:** Next.js 15 App Router (server components, `force-dynamic`), TypeScript, Zod (`fichaSchema`), libSQL/Turso (`@libsql/client`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-ficha-no-banco-e-editor-design.md`

## Global Constraints

- **Uma fonte por pergunta.** Depois da Task 4, **nenhum caminho de runtime lê `content/fichas/`**. O único leitor do diretório é o script de semente (Task 3). Isto é travado por teste, não por disciplina.
- **Append-only, sempre.** Nada em `ficha_versoes` é atualizado ou apagado. "Voltar a uma versão" **grava uma versão nova** com o conteúdo antigo. Mesma régua da tabela `avisos`.
- **Validação na porta de escrita.** Toda gravação passa pelo `fichaSchema` do `src/types/ficha.ts` **antes** de virar linha. Documento inválido não grava, e a tela diz o que está errado.
- **Banco pendurado não segura o portão.** Toda leitura de banco usa `comPrazo` (`src/lib/cache-rotas.ts`) com constante nomeada. O molde é o `lerAviso` de `src/lib/carimbo-estado.ts:79`.
- **Erro honesto é o `error.tsx`.** Sem banco e sem cópia em memória, a rota estoura e cai na tela de erro que o app já tem. **Não** é ficha pela metade, **não** é ficha com campos vazios, **não** é frase nova inventada para a ocasião.
- **Falha fechada no admin.** Toda rota e página sob `/admin` e `/api/admin/*` devolve **404** quando `lerConfigAdmin(process.env).ligado` é falso, **antes** de olhar sessão, e chama `avisarDesligado(cfg)`. Sessão ruim com painel ligado é **401**.
- **Palavra de tela é escolha do João.** Todo texto novo que aparece na tela entra com o comentário `// PENDENTE: redação minha, o João ainda não leu` na linha de cima, e é listado no relatório da tarefa. Nada de publicar redação minha como voz dele.
- **A voz é de um lugar só.** Nenhum texto literal sobre um lugar específico pode morar num componente que serve os três. O painel serve os três.
- **Mutação medida.** Toda tarefa lista suas mutações e prova que cada uma **aplicou** com `diff -u` não-vazio antes de rodar a suíte. Mutação que não aplica fica verde e é indistinguível de mutação que sobreviveu.
- **Sem deploy.** Nenhuma tarefa deste plano roda `vercel`. O deploy é decisão do João, depois da revisão final.

---

### Task 1: A tabela `ficha_versoes` e as funções de banco

**Files:**
- Modify: `src/lib/db.ts` (o `ensureSchema` está em `:35-53`; as funções novas vão ao fim do arquivo)
- Test: `tests/lib/db-fichas.test.ts` (criar)

**Interfaces:**
- Consumes: `getClient`, `ensureSchema` de `@/lib/db`; `Client` de `@libsql/client`.
- Produces:
  - `export type FichaVersao = { id: number; ficha_slug: string; doc: string; autor: AutorVersao; criado_em: number }`
  - `export type AutorVersao = "painel" | "semente"`
  - `export async function gravarVersao(client: Client, slug: string, doc: string, autor: AutorVersao, criadoEm: number): Promise<number>`
  - `export async function versaoAtual(client: Client, slug: string): Promise<FichaVersao | null>`
  - `export async function versoesAtuais(client: Client): Promise<Map<string, FichaVersao>>`
  - `export async function historico(client: Client, slug: string): Promise<FichaVersao[]>`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/db-fichas.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, historico, versaoAtual, versoesAtuais } from "@/lib/db";

let c: Client;
const AGORA = 1_758_000_000;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await ensureSchema(c); });
afterEach(() => c.close());

describe("ficha_versoes", () => {
  it("grava e lê a versão atual", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"slug":"rampa-do-pepe"}', "semente", AGORA);
    const v = await versaoAtual(c, "rampa-do-pepe");
    expect(v?.doc).toBe('{"slug":"rampa-do-pepe"}');
    expect(v?.autor).toBe("semente");
  });

  it("lugar sem versão devolve null", async () => {
    expect(await versaoAtual(c, "nao-existe")).toBeNull();
  });

  // 🔴 O ponto da tabela: a versão nova VENCE, e a antiga CONTINUA EXISTINDO.
  // Se `versaoAtual` lesse a primeira em vez da última, o painel salvaria e a
  // tela não mudaria — e o João concluiria que o app não gravou.
  it("a versão mais recente vence, e a antiga não some", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"antiga"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"nova"}', "painel", AGORA + 10);
    expect((await versaoAtual(c, "rampa-do-pepe"))?.doc).toBe('{"voz":"nova"}');
    expect(await historico(c, "rampa-do-pepe")).toHaveLength(2);
  });

  // 🔴 Empate de `criado_em` é real: duas gravações no mesmo segundo. Se o
  // desempate fosse por tempo, qual vence seria sorteio. É por `id`.
  it("mesmo segundo: desempata pelo id, não pelo relógio", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"primeira"}', "painel", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"segunda"}', "painel", AGORA);
    expect((await versaoAtual(c, "rampa-do-pepe"))?.doc).toBe('{"voz":"segunda"}');
  });

  it("o histórico vem do mais novo pro mais velho", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"v":1}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"v":2}', "painel", AGORA + 10);
    await gravarVersao(c, "rampa-do-pepe", '{"v":3}', "painel", AGORA + 20);
    expect((await historico(c, "rampa-do-pepe")).map((v) => v.doc)).toEqual(['{"v":3}', '{"v":2}', '{"v":1}']);
  });

  // 🔴 O histórico é de UM lugar. Sem o WHERE por slug, a tela da Rampa
  // mostraria as versões da Pedra Furada — a voz de um lugar na tela de outro,
  // que é a linha vermelha deste projeto.
  it("o histórico não mistura lugares", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"quem":"rampa"}', "painel", AGORA);
    await gravarVersao(c, "pedra-furada-de-venturosa", '{"quem":"pedra"}', "painel", AGORA + 10);
    const h = await historico(c, "rampa-do-pepe");
    expect(h).toHaveLength(1);
    expect(h[0].doc).toBe('{"quem":"rampa"}');
  });

  it("versoesAtuais devolve a última de cada lugar, uma consulta só", async () => {
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"antiga"}', "semente", AGORA);
    await gravarVersao(c, "rampa-do-pepe", '{"voz":"nova"}', "painel", AGORA + 10);
    await gravarVersao(c, "veu-de-noiva-de-bonito", '{"voz":"veu"}', "semente", AGORA);
    const m = await versoesAtuais(c);
    expect(m.get("rampa-do-pepe")?.doc).toBe('{"voz":"nova"}');
    expect(m.get("veu-de-noiva-de-bonito")?.doc).toBe('{"voz":"veu"}');
    expect(m.size).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/db-fichas.test.ts`
Expected: FAIL — `gravarVersao is not a function` (e irmãs).

- [ ] **Step 3: A tabela no `ensureSchema`**

Em `src/lib/db.ts`, dentro de `ensureSchema`, depois do bloco de `avisos` e antes do `}`:

```ts
  // 🔴 APPEND-ONLY, como `avisos`, e pela mesma razão: o que foi dito sobre um
  // lugar real, e quando, é a espinha deste projeto. A ficha saiu do git em
  // 2026-09-24, então ESTA tabela é a única procedência que existe — não há
  // `git blame` de socorro. Voltar a uma versão antiga GRAVA uma versão nova.
  //
  // `doc` é o JSON da ficha INTEIRA, não um campo. Versão de documento inteiro
  // torna "voltar" trivial e espelha o que o git fazia; o custo é não haver
  // diff por campo, que ninguém pediu.
  await client.execute(`CREATE TABLE IF NOT EXISTS ficha_versoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ficha_slug TEXT NOT NULL,
    doc TEXT NOT NULL, autor TEXT NOT NULL, criado_em INTEGER NOT NULL)`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS ficha_versoes_por_lugar ON ficha_versoes (ficha_slug, id)`,
  );
```

- [ ] **Step 4: As funções**

Ao fim de `src/lib/db.ts`:

```ts
export type AutorVersao = "painel" | "semente";

export type FichaVersao = {
  id: number;
  ficha_slug: string;
  doc: string;
  autor: AutorVersao;
  criado_em: number;
};

function versaoDaLinha(r: Record<string, unknown>): FichaVersao {
  return {
    id: Number(r.id),
    ficha_slug: String(r.ficha_slug),
    doc: String(r.doc),
    autor: String(r.autor) as AutorVersao,
    criado_em: Number(r.criado_em),
  };
}

export async function gravarVersao(
  client: Client, slug: string, doc: string, autor: AutorVersao, criadoEm: number,
): Promise<number> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em)
          VALUES (?, ?, ?, ?) RETURNING id`,
    args: [slug, doc, autor, criadoEm],
  });
  return Number(r.rows[0].id);
}

/** A ficha de AGORA daquele lugar: a versão de maior `id`.
 *
 *  🔴 ORDENA POR `id`, NÃO POR `criado_em`. Duas gravações no mesmo segundo
 *  são reais (salvar duas vezes seguidas), e por tempo o desempate viraria
 *  sorteio — o João salvaria e veria a versão anterior. O `id` é monotônico. */
export async function versaoAtual(client: Client, slug: string): Promise<FichaVersao | null> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1`,
    args: [slug],
  });
  return r.rows.length ? versaoDaLinha(r.rows[0]) : null;
}

/** A versão atual de TODOS os lugares, numa consulta só — irmão do
 *  `avisosVigentes`, e pela mesma razão: N consultas no portão é o que esta
 *  família evita. */
export async function versoesAtuais(client: Client): Promise<Map<string, FichaVersao>> {
  const r = await client.execute(
    `SELECT * FROM ficha_versoes WHERE id IN
       (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)`,
  );
  return new Map(r.rows.map((l) => { const v = versaoDaLinha(l); return [v.ficha_slug, v]; }));
}

/** Tudo que já foi dito sobre UM lugar, do mais novo pro mais velho. */
export async function historico(client: Client, slug: string): Promise<FichaVersao[]> {
  const r = await client.execute({
    sql: `SELECT * FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC`,
    args: [slug],
  });
  return r.rows.map(versaoDaLinha);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/lib/db-fichas.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 6: Medir as mutações**

Para cada uma: aplicar, provar com `git diff -u` **não-vazio**, rodar o arquivo de teste, reverter.

| # | mutação | arquivo | tem que MORRER em |
|---|---|---|---|
| M1 | `ORDER BY id DESC` → `ORDER BY id ASC` em `versaoAtual` | `db.ts` | "a versão mais recente vence" |
| M2 | `ORDER BY id DESC` → `ORDER BY criado_em DESC` em `versaoAtual` | `db.ts` | "mesmo segundo: desempata pelo id" |
| M3 | tirar `WHERE ficha_slug = ?` do `historico` | `db.ts` | "o histórico não mistura lugares" |
| M4 | `MAX(id)` → `MIN(id)` em `versoesAtuais` | `db.ts` | "versoesAtuais devolve a última de cada lugar" |

Se alguma **sobreviver**, escrever o teste que a mata **nesta tarefa** — previsão de plano é hipótese, não fato (quatro previsões erradas em 16/09).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts tests/lib/db-fichas.test.ts
git commit -m "feat(db): ficha_versoes -- append-only, a versao de maior id vence"
```

---

### Task 2: A semente — os três JSON viram versão 1

**Files:**
- Create: `scripts/semear-fichas.ts`
- Create: `src/lib/semente.ts` (a lógica, pura e testável; o script só a chama)
- Test: `tests/lib/semente.test.ts` (criar)

**Interfaces:**
- Consumes: `loadAll` de `@/lib/ficha` (ainda síncrono nesta tarefa — só vira async na Task 4); `gravarVersao`, `versoesAtuais` de `@/lib/db`.
- Produces: `export async function semear(client: Client, fichas: Ficha[], agora: number): Promise<{ semeados: string[]; pulados: string[] }>`

**Por que a lógica sai do script:** código que mora em `scripts/` não é importável em teste sem arrastar o processo inteiro — é a mesma razão pela qual a lógica saiu do `sw.ts` em 11/09. O script fica com três linhas.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/semente.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSchema, gravarVersao, historico, versaoAtual } from "@/lib/db";
import { semear } from "@/lib/semente";
import type { Ficha } from "@/types/ficha";

let c: Client;
const AGORA = 1_758_000_000;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await ensureSchema(c); });
afterEach(() => c.close());

const fichaFalsa = (slug: string, voz: string) => ({ slug, voz }) as unknown as Ficha;

describe("semear", () => {
  it("grava uma versão por ficha, com autor semente", async () => {
    const r = await semear(c, [fichaFalsa("morro-a", "voz a"), fichaFalsa("morro-b", "voz b")], AGORA);
    expect(r.semeados.sort()).toEqual(["morro-a", "morro-b"]);
    expect((await versaoAtual(c, "morro-a"))?.autor).toBe("semente");
    expect(JSON.parse((await versaoAtual(c, "morro-a"))!.doc).voz).toBe("voz a");
  });

  // 🔴 O teste que mais importa desta tarefa. A semente roda uma vez em
  // produção, mas alguém vai rodá-la duas vezes — por engano, ou porque o
  // primeiro deploy falhou no meio. Se ela regravasse, a semente viraria a
  // versão MAIS NOVA e APAGARIA o que o João escreveu pelo painel: a régua
  // append-only intacta, e o texto dele perdido mesmo assim.
  it("rodar de novo NÃO regrava, e não atropela o que o painel escreveu", async () => {
    await semear(c, [fichaFalsa("morro-a", "voz original")], AGORA);
    await gravarVersao(c, "morro-a", JSON.stringify({ slug: "morro-a", voz: "voz do João" }), "painel", AGORA + 100);

    const r = await semear(c, [fichaFalsa("morro-a", "voz original")], AGORA + 200);

    expect(r.semeados).toEqual([]);
    expect(r.pulados).toEqual(["morro-a"]);
    expect(JSON.parse((await versaoAtual(c, "morro-a"))!.doc).voz).toBe("voz do João");
    expect(await historico(c, "morro-a")).toHaveLength(2);
  });

  it("ficha nova entra mesmo com as outras já semeadas", async () => {
    await semear(c, [fichaFalsa("morro-a", "a")], AGORA);
    const r = await semear(c, [fichaFalsa("morro-a", "a"), fichaFalsa("morro-b", "b")], AGORA + 10);
    expect(r.semeados).toEqual(["morro-b"]);
    expect(r.pulados).toEqual(["morro-a"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/semente.test.ts`
Expected: FAIL — `Cannot find module '@/lib/semente'`.

- [ ] **Step 3: Escrever `src/lib/semente.ts`**

```ts
import type { Client } from "@libsql/client";
import { gravarVersao, versoesAtuais } from "@/lib/db";
import type { Ficha } from "@/types/ficha";

/** Põe no banco as fichas que ainda não estão lá, e SÓ essas.
 *
 *  🔴 IDEMPOTENTE, e isto é a coisa inteira. A semente roda uma vez, mas
 *  alguém vai rodá-la de novo — por engano, ou porque o primeiro deploy morreu
 *  no meio. Regravar não violaria o append-only (nada seria apagado), e ainda
 *  assim o texto que o João escreveu pelo painel sumiria da tela: a semente
 *  viraria a versão de maior `id`, que é a que o app mostra. */
export async function semear(
  client: Client, fichas: Ficha[], agora: number,
): Promise<{ semeados: string[]; pulados: string[] }> {
  const jaTem = await versoesAtuais(client);
  const semeados: string[] = [];
  const pulados: string[] = [];
  for (const f of fichas) {
    if (jaTem.has(f.slug)) { pulados.push(f.slug); continue; }
    await gravarVersao(client, f.slug, JSON.stringify(f), "semente", agora);
    semeados.push(f.slug);
  }
  return { semeados, pulados };
}
```

- [ ] **Step 4: Escrever `scripts/semear-fichas.ts`**

```ts
import { ensureSchema, getClient } from "../src/lib/db";
import { loadAll } from "../src/lib/ficha";
import { semear } from "../src/lib/semente";

async function main() {
  const client = getClient();
  await ensureSchema(client);
  const r = await semear(client, loadAll(), Math.floor(Date.now() / 1000));
  console.log("semeados:", r.semeados.join(", ") || "(nenhum)");
  console.log("pulados (já no banco):", r.pulados.join(", ") || "(nenhum)");
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/lib/semente.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 6: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | tirar o `if (jaTem.has(...)) continue` | "rodar de novo NÃO regrava" |
| M2 | `"semente"` → `"painel"` no `gravarVersao` | "grava uma versão por ficha, com autor semente" |

- [ ] **Step 7: Commit**

```bash
git add src/lib/semente.ts scripts/semear-fichas.ts tests/lib/semente.test.ts
git commit -m "feat(semente): os tres JSON viram versao 1, e rodar de novo nao atropela o painel"
```

---

### Task 3: A fonte — ler do banco, com prazo, memória e erro honesto

**Files:**
- Create: `src/lib/ficha-fonte.ts`
- Test: `tests/lib/ficha-fonte.test.ts` (criar)

**Interfaces:**
- Consumes: `comPrazo` de `@/lib/cache-rotas`; `versoesAtuais` de `@/lib/db`; `fichaSchema` de `@/types/ficha`.
- Produces:
  - `export const PRAZO_FICHA_MS = 2_000`
  - `export async function buscarFichas(ler: () => Promise<Map<string, { doc: string }>>): Promise<Ficha[]>`
  - `export function esquecerMemoria(): void` (só para teste isolar)
  - `export function ordenarPorNome(fichas: Ficha[]): Ficha[]` — **mudou de casa nesta tarefa**

🔴 **`ordenarPorNome` MUDA DE ARQUIVO, e isto não é arrumação.** Ele mora hoje em `src/lib/ficha.ts`. Se `ficha-fonte.ts` o importasse de lá, teríamos `ficha.ts` → `ficha-fonte.ts` → `ficha.ts`: um ciclo **de valor**, não de tipo — e ciclo de valor quebra no navegador em runtime, como o comentário no topo de `src/lib/aviso.ts` já registra para o caso irmão. Então a função **vem para cá** (junto do único lugar que a usa em produção) e `ficha.ts` passa a **reexportá-la** (`export { ordenarPorNome } from "@/lib/ficha-fonte";`), para que os testes que já a importam de `@/lib/ficha` continuem valendo. O teste dela em `tests/lib/ficha.test.ts` não muda de conteúdo.

**Por que a leitura é injetada:** o mesmo molde do `resolverNavegacao` de 11/09 — a lógica que decide fica pura e testável, e o `getClient()` real só aparece no chamador (Task 4). Sem isso, testar "banco pendurado" exigiria um banco pendurado de verdade.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/ficha-fonte.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarFichas, esquecerMemoria, PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import rampa from "../../content/fichas/rampa-do-pepe.json";

beforeEach(() => esquecerMemoria());

const umaLinha = (doc: unknown) => new Map([["rampa-do-pepe", { doc: JSON.stringify(doc) }]]);

describe("buscarFichas", () => {
  it("lê do banco e valida pelo fichaSchema", async () => {
    const fichas = await buscarFichas(async () => umaLinha(rampa));
    expect(fichas).toHaveLength(1);
    expect(fichas[0].slug).toBe("rampa-do-pepe");
  });

  // 🔴 A porta de leitura também valida: documento podre no banco não vira
  // ficha na tela. O banco é escrito por formulário agora, não por mim.
  it("documento inválido no banco estoura, não vira ficha pela metade", async () => {
    await expect(buscarFichas(async () => umaLinha({ slug: "x" }))).rejects.toThrow();
  });

  // 🔴 O caso da escolha 6 dele: banco pendurado, memória quente.
  it("banco pendurado com cópia em memória: serve a última boa", async () => {
    vi.useFakeTimers();
    await buscarFichas(async () => umaLinha(rampa));
    const pendurado = buscarFichas(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    expect((await pendurado)[0].slug).toBe("rampa-do-pepe");
    vi.useRealTimers();
  });

  // 🔴 E o outro lado da MESMA escolha, que é o que ele pediu de propósito:
  // sem memória, a tela NÃO inventa e NÃO mostra semente — ela estoura, e o
  // `error.tsx` do app aparece. Este teste é o que impede alguém de "melhorar"
  // isso mais tarde caindo no JSON do repositório.
  it("banco pendurado SEM cópia em memória: estoura, nunca conteúdo velho", async () => {
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    await expect(pendurado).rejects.toThrow();
    vi.useRealTimers();
  });

  it("banco que RECUSA sem memória: estoura igual", async () => {
    await expect(buscarFichas(async () => { throw new Error("turso fora"); })).rejects.toThrow();
  });

  // 🔴 A memória guarda a ÚLTIMA boa, não a primeira: depois de o João salvar,
  // a cópia velha não pode ressuscitar no próximo pendurado.
  it("a memória é atualizada a cada leitura boa", async () => {
    await buscarFichas(async () => umaLinha({ ...rampa, voz: "voz velha" }));
    await buscarFichas(async () => umaLinha({ ...rampa, voz: "voz nova" }));
    vi.useFakeTimers();
    const pendurado = buscarFichas(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(PRAZO_FICHA_MS + 1);
    expect((await pendurado)[0].voz).toBe("voz nova");
    vi.useRealTimers();
  });

  it("ordena por nome do primeiro waypoint, como a home espera", async () => {
    const fichas = await buscarFichas(async () => new Map([
      ["b", { doc: JSON.stringify({ ...rampa, slug: "b", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Zebu" }] } }) }],
      ["a", { doc: JSON.stringify({ ...rampa, slug: "a", trajeto: { waypoints: [{ ...rampa.trajeto.waypoints[0], nome: "Abacate" }] } }) }],
    ]));
    expect(fichas.map((f) => f.trajeto.waypoints[0].nome)).toEqual(["Abacate", "Zebu"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/ficha-fonte.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ficha-fonte'`.

- [ ] **Step 3: Escrever `src/lib/ficha-fonte.ts`**

```ts
import { comPrazo } from "@/lib/cache-rotas";
import { fichaSchema, type Ficha } from "@/types/ficha";

/** A ordem em que o acervo aparece. Veio de `ficha.ts` em 2026-09-24 para não
 *  fechar um ciclo de VALOR entre os dois módulos (`ficha.ts` passou a importar
 *  daqui). Continua pura e com teste próprio, independente do que existe em
 *  `content/fichas`.
 *
 *  Ordem de leitura do banco é estável por acaso, não por contrato — como era
 *  a do `readdir` antes dela. O acervo e a home dependem de uma ordem que a
 *  pessoa reconheça, então ela é declarada, não herdada. */
export function ordenarPorNome(fichas: Ficha[]): Ficha[] {
  return [...fichas].sort((a, b) =>
    a.trajeto.waypoints[0].nome.localeCompare(b.trajeto.waypoints[0].nome, "pt-BR"),
  );
}

/** Quanto a página espera o BANCO pela ficha antes de desistir.
 *
 *  Mesmo número e mesma razão do `PRAZO_AVISO_MS` (`carimbo-estado.ts`): uma
 *  consulta indexada de poucas linhas num banco da mesma região. A diferença é
 *  o que acontece depois: sem aviso a ficha aparece sem aviso; sem FICHA não há
 *  o que mostrar. */
export const PRAZO_FICHA_MS = 2_000;

/** A última leitura boa. Vive por instância do servidor, não é compartilhada,
 *  e some quando a instância morre — é exatamente o que o João escolheu em
 *  2026-09-24 ("só memória"), sabendo que instância fria + banco fora = erro. */
let ultimaBoa: Ficha[] | null = null;

/** Só pra teste isolar uma leitura da outra. */
export function esquecerMemoria(): void {
  ultimaBoa = null;
}

/** As fichas de agora.
 *
 *  🔴 O QUE ESTA FUNÇÃO NUNCA FAZ: cair no `content/fichas/`. Se o banco não
 *  respondeu e não há cópia em memória, ela ESTOURA, e a página cai no
 *  `error.tsx`. Servir a semente mostraria a voz que o João já reescreveu —
 *  o app afirmando coisa falsa, que é a linha vermelha deste projeto. Foi
 *  escolha dele, com o custo à vista: "erro honesto, nunca conteúdo velho".
 *
 *  A leitura entra por parâmetro pelo molde do `resolverNavegacao` (11/09):
 *  sem isso não há como testar banco pendurado. */
export async function buscarFichas(
  ler: () => Promise<Map<string, { doc: string }>>,
): Promise<Ficha[]> {
  let linhas: Map<string, { doc: string }> | null;
  try {
    linhas = await comPrazo(ler(), PRAZO_FICHA_MS, null);
  } catch {
    linhas = null;
  }
  if (linhas === null) {
    if (ultimaBoa) return ultimaBoa;
    throw new Error("Não consegui ler as fichas: banco fora e sem cópia em memória.");
  }
  const fichas = ordenarPorNome([...linhas.values()].map((l) => fichaSchema.parse(JSON.parse(l.doc))));
  ultimaBoa = fichas;
  return fichas;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/ficha-fonte.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | `if (ultimaBoa) return ultimaBoa` → `if (false)` | "banco pendurado com cópia em memória" |
| M2 | trocar o `throw` por `return []` | "banco pendurado SEM cópia em memória" |
| M3 | `ultimaBoa = fichas` só quando `ultimaBoa === null` | "a memória é atualizada a cada leitura boa" |
| M4 | tirar o `fichaSchema.parse` (usar o JSON cru) | "documento inválido no banco estoura" |
| M5 | tirar o `ordenarPorNome` | "ordena por nome do primeiro waypoint" |

- [ ] **Step 6: Commit**

```bash
git add src/lib/ficha-fonte.ts tests/lib/ficha-fonte.test.ts
git commit -m "feat(ficha): a fonte le do banco com prazo e memoria -- sem cópia, erro honesto"
```

---

### Task 4: O carregador vira assíncrono e o disco sai de produção

**Files:**
- Modify: `src/lib/ficha.ts` (todo o arquivo: `loadAll` continua, os três getters mudam)
- Modify: `src/app/page.tsx:30`, `src/app/[slug]/page.tsx:54,81`, `src/app/ListaDoAcervo.tsx:24`, `src/app/admin/page.tsx:53`, `src/app/api/carimbo/route.ts:19`, `src/app/api/carimbos/route.ts:14`, `src/app/api/confirmar/route.ts:13,28`, `src/app/api/admin/aviso/route.ts:48`, `src/lib/runMotor.ts:15`
- Test: `tests/lib/ficha.test.ts` (adaptar), `tests/lib/sem-disco-em-producao.test.ts` (criar)

**Interfaces:**
- Consumes: `buscarFichas` de `@/lib/ficha-fonte`; `versoesAtuais`, `getClient` de `@/lib/db`.
- Produces (assinaturas novas, que TODA tarefa posterior usa):
  - `export async function getAllFichas(): Promise<Ficha[]>`
  - `export async function getFicha(slug: string): Promise<Ficha | null>`
  - `export async function getFichasComCondicao(): Promise<Ficha[]>`
  - `export function loadAll(dir?: string): Ficha[]` — **continua síncrona e lendo disco**, e passa a ser usada **só** pela semente (Task 2) e pelos testes.

- [ ] **Step 1: Escrever o guarda que falha**

Criar `tests/lib/sem-disco-em-producao.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** 🔴 O GUARDA DESTA RODADA INTEIRA.
 *
 *  A ficha saiu do disco e foi pro banco. Se um caminho de runtime voltar a ler
 *  `content/fichas/`, o app passa a ter DUAS fontes pra mesma pergunta — e essa
 *  é a espécie que este projeto já pagou três vezes (cabeçalho x cartão, HTML x
 *  cache, chip x carimbo). O pior é que ela não quebra nada: as duas fontes
 *  concordam no dia da migração e divergem na primeira edição.
 *
 *  Este guarda vale só pra `src/`. `scripts/` e `tests/` leem o disco de
 *  propósito: a semente e os fixtures.
 *
 *  Se esta lista precisar de exceção um dia, a exceção é uma LINHA AQUI, com o
 *  motivo escrito — nunca um `// eslint-disable` no arquivo que voltou a ler. */
const RAIZ = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

describe("nenhum caminho de produção lê content/fichas", () => {
  it("só `ficha.ts` conhece o diretório, e só pelo `loadAll` da semente", () => {
    const culpados = arquivos(RAIZ)
      .filter((p) => /content[/\\]+fichas|FICHAS_DIR/.test(fs.readFileSync(p, "utf8")))
      .map((p) => path.relative(process.cwd(), p).replace(/\\/g, "/"));
    expect(culpados).toEqual(["src/lib/ficha.ts"]);
  });

  it("nenhum componente ou rota importa `node:fs`", () => {
    const culpados = arquivos(path.join(RAIZ, "app"))
      .filter((p) => /from "node:fs"|require\("node:fs"\)/.test(fs.readFileSync(p, "utf8")))
      .map((p) => path.relative(process.cwd(), p).replace(/\\/g, "/"));
    expect(culpados).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver o estado de hoje**

Run: `npx vitest run tests/lib/sem-disco-em-producao.test.ts`
Expected: o primeiro teste PASSA hoje (só `ficha.ts` cita o diretório) e o segundo PASSA. **Este guarda é uma trava, não uma correção** — ele tem que continuar verde depois da Task 4, e é o que impede a volta do disco. Registre no relatório que ele já nasce verde e por quê.

- [ ] **Step 3: Reescrever os getters de `src/lib/ficha.ts`**

Substituir as três funções ao fim do arquivo (o `loadAll` e o `ordenarPorNome` ficam como estão):

```ts
import { cache } from "react";
import { getClient, versoesAtuais } from "@/lib/db";
import { buscarFichas } from "@/lib/ficha-fonte";

// `ordenarPorNome` mudou-se para `ficha-fonte.ts` (o único lugar que a usa em
// produção); fica reexportada aqui porque os testes e o acervo a importam deste
// caminho desde agosto. Importá-la de volta como valor fecharia o ciclo que o
// comentário da Task 3 explica.
export { ordenarPorNome } from "@/lib/ficha-fonte";

/** As fichas de agora, do BANCO — não do disco.
 *
 *  🔴 `cache()` do React, e não é otimização: `[slug]/page.tsx` chama
 *  `getFicha` DUAS vezes no mesmo pedido (no `generateMetadata` e na página).
 *  Sem isto seriam duas idas ao banco por visita, e — pior — duas leituras
 *  que podem discordar se o João salvar entre elas: o título do cartão de um
 *  lugar e o corpo do outro. `cache()` dura UM pedido, então continua
 *  instantâneo entre pedidos, que é o que ele escolheu. */
export const getAllFichas = cache(async (): Promise<Ficha[]> =>
  buscarFichas(() => versoesAtuais(getClient())),
);

export async function getFicha(slug: string): Promise<Ficha | null> {
  return (await getAllFichas()).find((f) => f.slug === slug) ?? null;
}

export async function getFichasComCondicao(): Promise<Ficha[]> {
  return (await getAllFichas()).filter((f) => f.condicao != null);
}
```

E acrescentar ao comentário do `loadAll`, no alto dele:

```ts
/** 🔴 DESDE 2026-09-24 ESTA É A ÚNICA FUNÇÃO QUE TOCA O DISCO, e ela roda SÓ
 *  na semente (`scripts/semear-fichas.ts`) e em teste. Produção lê o banco,
 *  pelos getters abaixo. Se você está prestes a chamar `loadAll` de um
 *  componente ou de uma rota, pare: é a volta das duas fontes, e o guarda em
 *  `tests/lib/sem-disco-em-producao.test.ts` existe por causa disso. */
```

- [ ] **Step 4: Aguardar os 11 pontos de produção**

Cada um vira `await`. Os arquivos e as linhas exatas:

| arquivo | hoje | fica |
|---|---|---|
| `src/app/page.tsx:30` | `const fichas = getFichasComCondicao();` | `const fichas = await getFichasComCondicao();` |
| `src/app/[slug]/page.tsx:54` | `const ficha = getFicha(slug);` | `const ficha = await getFicha(slug);` |
| `src/app/[slug]/page.tsx:81` | `const ficha = getFicha(slug);` | `const ficha = await getFicha(slug);` |
| `src/app/ListaDoAcervo.tsx:24` | `const fichas = getAllFichas();` | `const fichas = await getAllFichas();` — a função vira `async` |
| `src/app/admin/page.tsx:53` | `const fichas = getAllFichas();` | `const fichas = await getAllFichas();` |
| `src/app/api/carimbo/route.ts:19` | `const ficha = slug ? getFicha(slug) : null;` | `const ficha = slug ? await getFicha(slug) : null;` |
| `src/app/api/carimbos/route.ts:14` | `resolverEstados(getFichasComCondicao())` | `resolverEstados(await getFichasComCondicao())` |
| `src/app/api/confirmar/route.ts:13` | `if (!slug \|\| getFicha(slug) == null)` | `if (!slug \|\| (await getFicha(slug)) == null)` |
| `src/app/api/confirmar/route.ts:28` | `if (typeof slug !== "string" \|\| getFicha(slug) == null)` | `if (typeof slug !== "string" \|\| (await getFicha(slug)) == null)` |
| `src/app/api/admin/aviso/route.ts:48` | `if (typeof slug !== "string" \|\| getFicha(slug) == null)` | `if (typeof slug !== "string" \|\| (await getFicha(slug)) == null)` |
| `src/lib/runMotor.ts:15` | `const fichas = getFichasComCondicao();` | `const fichas = await getFichasComCondicao();` — a função que o contém vira `async` se já não for |

🔴 **`ListaDoAcervo.tsx` é o único que pode não ser server component.** Confira o topo do arquivo: se tiver `"use client"`, a função **não pode** virar `async` — nesse caso as fichas passam a chegar por prop de quem a renderiza, e isso entra no relatório como desvio do plano. Se não tiver, é só `async`.

- [ ] **Step 5: Adaptar `tests/lib/ficha.test.ts`**

Os testes que chamam `getAllFichas()`, `getFicha()` e `getFichasComCondicao()` passam a precisar de banco. Regra desta tarefa: **os testes desses três getters migram para um banco `:memory:` semeado** com `loadAll()` + `semear()` (Task 2), no molde do `beforeEach` do `tests/lib/db-fichas.test.ts`. Os testes de `loadAll(dir)` com diretório sintético **ficam como estão** — continuam provando o leitor de disco, que continua existindo pra semente.

O mesmo vale para `tests/app/ficha.test.tsx`, `tests/app/trilhas.test.tsx`, `tests/lib/severidade.test.ts`, `tests/lib/filtros.test.ts` e `tests/lib/coerencia-acervo.test.ts`.

🔴 **O que NÃO fazer:** transformar o teste em `expect(...).resolves` e parar aí. Um teste que só espera a promessa resolver não prova que veio do banco. Pelo menos um teste por arquivo tem que **gravar uma versão nova e ver a mudança chegar**.

- [ ] **Step 6: Rodar a suíte inteira e o tsc**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: verde. Se algum teste de componente quebrar por `async`, o conserto é no teste, não no componente.

- [ ] **Step 7: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | `getFicha` volta a usar `loadAll()` em vez de `getAllFichas()` | um teste da Task 4 que grava versão nova e espera o texto novo |
| M2 | tirar o `cache()` do `getAllFichas` | ⚠️ **previsão: SOBREVIVE** — nada hoje conta idas ao banco. Se sobreviver, escrever nesta tarefa o teste que conta as chamadas do `ler` injetado e exige **uma** por pedido |
| M3 | `.find((f) => f.slug === slug)` → `[0]` em `getFicha` | teste que pede a Pedra Furada e recebe a Pedra Furada |

- [ ] **Step 8: Commit**

```bash
git add -A src tests
git commit -m "feat(ficha): producao le do banco -- o disco fica so com a semente, e ha guarda"
```

---

### Task 5: `/admin` vira lista, e nasce a tela do lugar

**Files:**
- Modify: `src/app/admin/page.tsx` (vira a lista)
- Create: `src/app/admin/ListaDeLugares.tsx`
- Create: `src/app/admin/[slug]/page.tsx`
- Modify: `src/app/admin/PainelAdmin.tsx` (passa a servir UM lugar, não três)
- Modify: `src/app/admin/admin.css`
- Test: `tests/app/admin-lista.test.tsx` (criar), `tests/app/admin-lugar.test.tsx` (criar), `tests/app/admin-page.test.tsx` (adaptar)

**Interfaces:**
- Consumes: `getAllFichas`, `getFicha` (async, Task 4); `resolverEstados`, `resolverEstado` de `@/lib/carimbo-estado`; `sessaoValida`, `avisarDesligado`, `COOKIE_ADMIN` de `@/lib/admin-guarda`; `lerConfigAdmin` de `@/lib/admin-config`.
- Produces: a rota `/admin/<slug>`, e `PainelAdmin` com assinatura nova: `{ ficha, leitura, aviso, avisoErro, agora }` (singular).

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/app/admin-lista.test.tsx`. O componente é puro (recebe tudo por prop), então testa-se direto, sem mockar `next/headers`:

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import ListaDeLugares from "@/app/admin/ListaDeLugares";
import { loadAll } from "@/lib/ficha";
import { faseDe } from "@/lib/carimbo-fase";
import { marcaDe } from "@/lib/marca";
import { vozDaFicha } from "@/lib/severidade";

afterEach(() => cleanup());

const FICHAS = loadAll();
const leituraSeca = { estado: "fresco", erro: false, calculadoEm: 1_758_000_000, aviso: null } as const;

describe("ListaDeLugares", () => {
  // 🔴 O modo de falha que este teste tranca é o link do lugar errado: tocar na
  // Pedra Furada e cair na Rampa — e editar a voz de um lugar achando que é a
  // de outro é a pior coisa que este painel pode fazer.
  it("lista todos os lugares, cada um linkando pro próprio slug", () => {
    render(<ListaDeLugares fichas={FICHAS} leituras={Object.fromEntries(FICHAS.map((f) => [f.slug, leituraSeca]))} avisos={{}} agora={1_758_000_000} />);
    for (const f of FICHAS) {
      const link = screen.getByRole("link", { name: new RegExp(f.trajeto.waypoints[0].nome, "i") });
      expect(link.getAttribute("href")).toBe(`/admin/${f.slug}`);
    }
  });

  // 🔴 DERIVADO, nunca literal: o rótulo sai da mesma pipeline do selo público.
  // String fixa aqui é a voz de um lugar virando a língua dos três — a espécie
  // que este app pagou quatro vezes, a última em arquivo novo (16/09).
  it("o rótulo de cada lugar é o do selo público daquele lugar", () => {
    render(<ListaDeLugares fichas={FICHAS} leituras={Object.fromEntries(FICHAS.map((f) => [f.slug, leituraSeca]))} avisos={{}} agora={1_758_000_000} />);
    const marcas = FICHAS.map((f) =>
      marcaDe(faseDe({ conferindo: false, erro: false, venceu: false, falhou: false, fechado: false, fechadoPeloDono: false }), "fresco", vozDaFicha(f.condicao)).marca,
    );
    expect(new Set(marcas).size, "acervo sem variedade de voz não prova nada aqui").toBeGreaterThan(0);
    for (const m of marcas) expect(screen.getAllByText(new RegExp(m, "i")).length).toBeGreaterThan(0);
  });
});
```

Criar `tests/app/admin-lugar.test.tsx`, no molde de `tests/app/admin-page.test.tsx:148-224` (que já mocka `next/headers` e usa `criarSessao` de verdade). Os quatro testes, com a asserção de cada um explícita:

```tsx
// 1. Com cookie válido: o bloco do lugar aparece.
//    expect(container.querySelector(".adm-painel")).not.toBeNull();
//    expect(screen.getByText(new RegExp(ficha.trajeto.waypoints[0].nome))).toBeTruthy();
// 2. Slug fora do acervo: `notFound()` é chamado.
//    await expect(Lugar({ params: { slug: "nao-existe" } })).rejects.toThrow("NEXT_NOT_FOUND");
// 3. Sem cookie: caixa de senha, e NADA do lugar.
//    expect(container.querySelector('input[type="password"]')).not.toBeNull();
//    expect(container.querySelector(".adm-painel")).toBeNull();
//    expect(container.textContent).not.toContain(ficha.voz);   // ⬅ o que importa
// 4. Painel desligado (sem ADMIN_SENHA): 404, e a tela não explica.
//    await expect(Lugar({ params: { slug } })).rejects.toThrow("NEXT_NOT_FOUND");
```

🔴 **A asserção 3 é a que vale.** "Não mostra o painel" já era provado em 16/09; o que falta provar é que **o conteúdo do lugar não vaza** para quem não entrou — e `textContent` vazio não distingue caixa vazia de ausência, como a Task 11 de 16/09 descobriu.

🔴 **A asserção do primeiro teste é derivada, nunca literal.** Pra cada ficha do acervo, o rótulo esperado sai da mesma pipeline do selo público (`faseDe` + `marcaDe` + `vozDaFicha(ficha.condicao)`), como o `PainelAdmin` já faz desde 16/09. String fixa aqui é a voz de um lugar virando a língua dos três — a espécie que este app pagou quatro vezes, a última em arquivo novo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/admin-lista.test.tsx tests/app/admin-lugar.test.tsx`
Expected: FAIL — rota `/admin/[slug]` não existe.

- [ ] **Step 3: `/admin` vira lista**

`src/app/admin/page.tsx` mantém a guarda de config, a de sessão e o `metadata` como estão, e troca o corpo: em vez de `<PainelAdmin fichas=... />`, renderiza `<ListaDeLugares fichas={fichas} leituras={...} avisos={...} agora={agora} />`.

`src/app/admin/ListaDeLugares.tsx`: para cada ficha, um `<Link href={`/admin/${f.slug}`}>` com o nome (`f.trajeto.waypoints[0].nome`) e a marca do estado, derivada da mesma pipeline que o `PainelAdmin` usa hoje.

```tsx
// PENDENTE: redação minha, o João ainda não leu
const RODAPE_LISTA = "Toque num lugar pra ver e mudar o que o app diz dele.";
```

🔴 **NÃO renderizar o "+ lugar novo".** Ele aparece na maquete que o João aprovou, mas criar ficha é a rodada 4 da spec (§6). Um botão que não faz nada é pior que botão nenhum: ele promete, e a promessa quebrada é do app, não da tela. Quando a rodada 4 chegar, o botão nasce junto com o que ele abre.

- [ ] **Step 4: Nasce `/admin/[slug]`**

`src/app/admin/[slug]/page.tsx`: mesma guarda de config (404 + `avisarDesligado`) e de sessão (caixa de senha) da página irmã; depois `const ficha = await getFicha(slug); if (!ficha) notFound();`, e renderiza `<PainelAdmin ficha={ficha} ... />`.

🔴 **A guarda de config vem ANTES da de sessão e ANTES do `getFicha`** — painel desligado não anuncia que existe, nem gasta banco.

- [ ] **Step 5: `PainelAdmin` passa a servir um lugar**

O componente hoje mapeia as três fichas. Ele passa a receber **uma** e renderizar um bloco. O corpo do bloco (estado, formulário de aviso, botão de tirar) **não muda de comportamento** — é movido, não reescrito.

- [ ] **Step 6: Rodar tudo e o tsc**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: verde, com os testes novos passando e o `admin-page.test.tsx` adaptado.

- [ ] **Step 7: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | o `href` da lista vira `/admin/${fichas[0].slug}` pra todos | "cada um linkando pro próprio slug" |
| M2 | tirar o `notFound()` do slug inexistente | "slug que não existe no acervo: 404" |
| M3 | pôr a guarda de sessão antes da de config em `/admin/[slug]` | "painel desligado: 404" |
| M4 | trocar a marca derivada por `"Pode ir"` literal | "NA TELA AGORA com a marca daquele lugar" |

- [ ] **Step 8: Commit e listar a copy**

```bash
git add -A src/app/admin tests/app
git commit -m "feat(admin): lista -> lugar, e a tela do lugar nasce com o estado e o aviso"
```

No relatório, listar **toda** string nova de tela, literal, para o João ler.

---

### Task 6: Editar a voz

**Files:**
- Create: `src/app/api/admin/ficha/route.ts`
- Create: `src/lib/editar-ficha.ts` (a lógica pura)
- Create: `src/app/admin/EditorDeVoz.tsx`
- Modify: `src/app/admin/[slug]/page.tsx` (monta o editor)
- Test: `tests/lib/editar-ficha.test.ts`, `tests/app/route-admin-ficha.test.ts`, `tests/app/editor-de-voz.test.tsx` (criar os três)

**Interfaces:**
- Consumes: `fichaSchema` de `@/types/ficha`; `gravarVersao`, `versaoAtual` de `@/lib/db`; guardas de `@/lib/admin-guarda`.
- Produces:
  - `export const CAMPOS_EDITAVEIS = ["voz"] as const`
  - `export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number]`
  - `export function aplicarCampo(docAtual: string, campo: CampoEditavel, valor: string): string` — devolve o JSON novo, **validado**; estoura se inválido
  - `PUT /api/admin/ficha` com corpo `{ slug: string, campo: string, valor: string }`

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/editar-ficha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aplicarCampo, eCampoEditavel } from "@/lib/editar-ficha";
import { loadAll } from "@/lib/ficha";

const DOC = JSON.stringify(loadAll().find((f) => f.slug === "rampa-do-pepe"));

describe("aplicarCampo", () => {
  it("aplica o campo e devolve documento válido", () => {
    const novo = JSON.parse(aplicarCampo(DOC, "voz", "a serra firmou de novo"));
    expect(novo.voz).toBe("a serra firmou de novo");
  });

  // 🔴 O documento INTEIRO é revalidado, não só o campo — é esta porta que
  // impede um formulário de gravar ficha quebrada, e ela é a única que existe.
  it("valor que quebra o schema estoura, e NÃO devolve documento", () => {
    expect(() => aplicarCampo(DOC, "voz", 42 as unknown as string)).toThrow();
  });

  it("documento já podre no banco não passa por ser editado num campo bom", () => {
    expect(() => aplicarCampo('{"slug":"x"}', "voz", "qualquer")).toThrow();
  });

  it("campo fora da lista não é editável", () => {
    expect(eCampoEditavel("slug")).toBe(false);
    expect(eCampoEditavel("piso")).toBe(false);
    expect(eCampoEditavel("voz")).toBe(true);
  });

  // 🔴 Editar a voz não pode mexer no piso. O spread é o que garante isso, e
  // sem este teste trocá-lo por `{ [campo]: valor }` passa verde no teste de
  // cima (a voz muda mesmo) e apaga a ficha inteira.
  it("só o campo pedido muda; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "voz", "outra coisa"));
    expect({ ...depois, voz: antes.voz }).toEqual(antes);
  });
});
```

`tests/app/route-admin-ficha.test.ts`, no molde de `tests/app/route-admin-aviso.test.ts` (que já monta `Request` à mão, injeta `process.env` e usa `criarSessao` de verdade). Cada teste com a asserção dupla que 16/09 ensinou — **o código E o efeito**:

```ts
// 1. Sem ADMIN_SENHA no env:
//    expect(r.status).toBe(404);
//    expect(await versaoAtual(c, slug)).toBeNull();        // ⬅ nada gravado
// 2. Painel ligado, sem cookie:
//    expect(r.status).toBe(401);
//    expect((await historico(c, slug))).toHaveLength(1);   // ⬅ só a semente
// 3. Cookie válido:
//    expect(r.status).toBe(200);
//    expect(JSON.parse((await versaoAtual(c, slug))!.doc).voz).toBe("texto novo");
//    expect((await versaoAtual(c, slug))!.autor).toBe("painel");
//    expect(await historico(c, slug)).toHaveLength(2);     // ⬅ a antiga ficou
// 4. Valor inválido (número em vez de texto):
//    expect(r.status).toBe(400);
//    expect(await historico(c, slug)).toHaveLength(1);
// 5. Slug que não existe:   expect(r.status).toBe(400);
// 6. campo: "piso":         expect(r.status).toBe(400);
//    expect(await historico(c, slug)).toHaveLength(1);
```

🔴 **"e nada é gravado" é parte da asserção, não enfeite.** Em 16/09 um teste de 404 não provava que o aviso sobrevivia ao 404; só o irmão do POST provava. Aqui os dois provam.

🔴 **"e nada é gravado" é parte da asserção, não enfeite.** Em 16/09 um teste de 404 não provava que o aviso sobrevivia ao 404; o irmão provava. Aqui os dois provam.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/editar-ficha.test.ts tests/app/route-admin-ficha.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: `src/lib/editar-ficha.ts`**

```ts
import { fichaSchema } from "@/types/ficha";

/** Os campos que esta porta aceita mudar.
 *
 *  🔴 LISTA BRANCA, e é de propósito. Sem ela, um corpo com
 *  `{"campo":"slug"}` renomearia o lugar e quebraria todo link que já circula.
 *  A rodada de 2026-09-24 abre só a `voz`; as outras entram uma a uma, com a
 *  tela que cada uma precisa (número e regra pedem seletor, não texto livre). */
export const CAMPOS_EDITAVEIS = ["voz"] as const;
export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

export function eCampoEditavel(c: string): c is CampoEditavel {
  return (CAMPOS_EDITAVEIS as readonly string[]).includes(c);
}

/** Aplica UM campo sobre o documento atual e devolve o JSON novo.
 *
 *  🔴 REVALIDA O DOCUMENTO INTEIRO, não só o campo: esta é a porta que impede
 *  um formulário de gravar ficha quebrada, e ela é a única. Estoura em vez de
 *  devolver algo meio certo — quem chama traduz o estouro em 400. */
export function aplicarCampo(docAtual: string, campo: CampoEditavel, valor: string): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  return JSON.stringify(fichaSchema.parse({ ...atual, [campo]: valor }));
}
```

- [ ] **Step 4: A rota**

`src/app/api/admin/ficha/route.ts`, no molde exato de `src/app/api/admin/aviso/route.ts`: `lerConfigAdmin` → 404 + `avisarDesligado`; `sessaoValida` → 401; `req.json()` com catch → 400; corpo não-objeto → 400; `eCampoEditavel` → 400; `versaoAtual` nulo → 400; `aplicarCampo` em try/catch → 400; `gravarVersao(..., "painel", agora)` → 200.

- [ ] **Step 5: O editor na tela**

`src/app/admin/EditorDeVoz.tsx`: client component com `<textarea>` preenchido com `ficha.voz`, botão salvar, `PUT` na rota, e `location.reload()` no sucesso — o mesmo padrão da `CaixaDeSenha` e do formulário de aviso.

```tsx
// PENDENTE: redação minha, o João ainda não leu
const TITULO = "A sua voz";
const AJUDA = "É o que só quem já foi sabe. Aparece entre aspas na ficha.";
const ERRO_GRAVAR = "Não consegui salvar.";
const ERRO_REDE = "Sem rede.";
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: verde.

- [ ] **Step 7: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | `aplicarCampo` devolve sem o segundo `fichaSchema.parse` | "valor que quebra o schema estoura" |
| M2 | `CAMPOS_EDITAVEIS` ganha `"slug"` | "campo fora da lista estoura" |
| M3 | a rota grava antes de checar sessão | "sem cookie: 401, e nada é gravado" |
| M4 | `gravarVersao(..., "semente", ...)` | um teste que lê o autor da versão nova |
| M5 | `{ ...atual, [campo]: valor }` → `{ [campo]: valor }` | "só o campo pedido muda" |

- [ ] **Step 8: Commit e listar a copy**

```bash
git add -A src tests
git commit -m "feat(admin): editar a voz -- lista branca de campo, e o documento inteiro revalidado"
```

---

### Task 7: O histórico e o voltar

**Files:**
- Create: `src/app/admin/HistoricoDaVoz.tsx`
- Modify: `src/app/admin/[slug]/page.tsx` (lê o histórico e passa ao componente)
- Modify: `src/app/api/admin/ficha/route.ts` (aceita `{ slug, versaoId }` para voltar)
- Test: `tests/app/historico-da-voz.test.tsx`, `tests/app/route-admin-ficha.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `historico` de `@/lib/db` (Task 1); a rota da Task 6.
- Produces: `PUT /api/admin/ficha` passa a aceitar **ou** `{slug, campo, valor}` **ou** `{slug, versaoId}`.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/app/route-admin-ficha.test.ts`, acrescentar (mesmo `beforeEach` de banco `:memory:` dos irmãos):

```ts
// 🔴 O teste central da escolha 3 dele: voltar GRAVA, não apaga.
it("voltar a uma versão antiga grava versão nova, e a atual continua no histórico", async () => {
  const v1 = await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a primeira" }), "semente", AGORA);
  await gravarVersao(c, SLUG, JSON.stringify({ ...ficha, voz: "a segunda" }), "painel", AGORA + 10);

  const r = await PUT(pedido({ slug: SLUG, versaoId: v1 }, cookieBom));

  expect(r.status).toBe(200);
  expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).voz).toBe("a primeira");
  const h = await historico(c, SLUG);
  expect(h, "voltar tem que INSERIR, nunca apagar").toHaveLength(3);
  expect(JSON.parse(h[1].doc).voz, "a versão de onde voltamos continua lá").toBe("a segunda");
});

// 🔴 A LINHA VERMELHA EM FORMA DE TESTE. Sem conferir que a versão é DAQUELE
// lugar, um `versaoId` qualquer põe a voz da Rampa na ficha da Pedra Furada —
// exatamente o defeito que este projeto mais caça, agora com ajuda do banco.
it("versaoId de OUTRO lugar: 400, e a ficha não é tocada", async () => {
  const daRampa = await gravarVersao(c, "rampa-do-pepe", JSON.stringify({ ...ficha, voz: "voz da Rampa" }), "painel", AGORA);
  await gravarVersao(c, "pedra-furada-de-venturosa", JSON.stringify({ ...outra, voz: "voz da Pedra" }), "semente", AGORA);

  const r = await PUT(pedido({ slug: "pedra-furada-de-venturosa", versaoId: daRampa }, cookieBom));

  expect(r.status).toBe(400);
  expect(JSON.parse((await versaoAtual(c, "pedra-furada-de-venturosa"))!.doc).voz).toBe("voz da Pedra");
});

it("versaoId que não existe: 400", async () => {
  expect((await PUT(pedido({ slug: SLUG, versaoId: 99_999 }, cookieBom))).status).toBe(400);
});
```

E em `tests/app/historico-da-voz.test.tsx`, o componente puro:

```tsx
// 🔴 O autor é por LINHA, não fixo. Com rótulo fixo o João leria "você, pelo
// painel" na frase que eu transcrevi em agosto — e a procedência, que é a
// razão desta tabela existir, viraria decoração.
it("mostra quem escreveu cada versão", () => {
  render(<HistoricoDaVoz versoes={[
    { id: 2, ficha_slug: SLUG, doc: JSON.stringify({ voz: "nova" }), autor: "painel", criado_em: AGORA + 10 },
    { id: 1, ficha_slug: SLUG, doc: JSON.stringify({ voz: "velha" }), autor: "semente", criado_em: AGORA },
  ]} />);
  expect(screen.getByText(/você, pelo painel/i)).toBeTruthy();
  expect(screen.getByText(/acervo original/i)).toBeTruthy();
});
```

🔴 **O terceiro teste é a linha vermelha em forma de teste.** Sem a checagem de que a versão pertence àquele slug, um `versaoId` qualquer põe a voz de um lugar na ficha de outro — exatamente o defeito que este projeto mais caça, agora com ajuda do banco.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/historico-da-voz.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: O componente**

`HistoricoDaVoz.tsx`: lista de versões (data + autor), cada uma expansível pro texto, com botão de voltar.

```tsx
// PENDENTE: redação minha, o João ainda não leu
const AUTOR = { painel: "você, pelo painel", semente: "acervo original" } as const;
const VOLTAR = "voltar a esta";
```

- [ ] **Step 4: O ramo de voltar na rota**

No `PUT`, quando o corpo traz `versaoId`: buscar a versão, **conferir que `ficha_slug` bate com o `slug` do corpo** (senão 400), e `gravarVersao(client, slug, versaoEscolhida.doc, "painel", agora)`.

- [ ] **Step 5: Rodar tudo**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: verde.

- [ ] **Step 6: Medir as mutações**

| # | mutação | tem que MORRER em |
|---|---|---|
| M1 | tirar a checagem `versao.ficha_slug === slug` | "versaoId de OUTRO lugar: 400" |
| M2 | voltar faz `UPDATE` em vez de `INSERT` | "voltar grava versão nova, e a atual continua" |
| M3 | o rótulo de autor vira fixo `"você, pelo painel"` | "o histórico mostra quem escreveu cada versão" |

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat(admin): o historico da voz, e voltar grava versao nova"
```

---

## Depois da última tarefa

1. **Final review da branch inteira** (opus), com a lista de minors diferidos.
2. **A copy pendente vai pro João, por extenso**, antes de qualquer deploy — é o método de 10/09 que funcionou: escrevo, mostro, ele lê, ele decide.
3. **Trava de deploy nova:** `npx dotenv -e .env.local -- tsx scripts/semear-fichas.ts` **antes** do primeiro deploy desta branch. Sem a semente, o banco não tem ficha nenhuma e **o app inteiro cai no `error.tsx`** — é a diferença entre esta rodada e a de 16/09, onde deployar antes do schema só perdia o aviso.
4. **`conferir-no-ar` abrindo o navegador:** a lista, a tela do lugar, o editor e o histórico em 375px. Nenhuma dessas telas terá sido vista por olho humano.
