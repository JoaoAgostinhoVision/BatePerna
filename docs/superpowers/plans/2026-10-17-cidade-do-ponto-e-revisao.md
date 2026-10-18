# Cidade que sai do ponto, revisão antes de publicar, e cinco consertos do celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No celular e sem GPS, quem manda um lugar (o João em `/admin/novo`, quem usa em `/contribuir/novo`) digita só o nome, acha a região por uma busca com botão, marca o ponto com o dedo, e o servidor descobre a cidade pelo Nominatim; antes de publicar ela vê tudo numa revisão, corrige qualquer resposta (o nome inclusive), e nenhum toque joga fora texto não salvo.

**Architecture:** O Nominatim mora atrás de UM módulo de servidor (`src/lib/nominatim-servico.ts`), com as respostas guardadas numa tabela do banco e o limite de 1 consulta/s decidido por UMA linha do banco num `UPDATE` condicional — vale entre instâncias e entre recargas. O reverse roda DENTRO do `PUT` do ponto 0 das duas rotas de rascunho: sem cidade o ponto não grava; com cidade, o ponto grava SEMPRE (saída (b) do João), e o par nome+cidade que colide só trava o publicar e vira aviso na tela. No painel, o rascunho nasce numa chave provisória (`rascunho_<hex>`, o formato que já existe pra quem usa) e se muda pra `nome-cidade` quando dá; o publicar do painel recusa toda chave que não seja o `nome-cidade` do documento. A busca só MOVE o mapa. A revisão é um componente de SERVIDOR novo que recebe as linhas prontas; a `TelaDePublicar` (cliente) fica só com o botão e a lista do que o app cala.

**Tech Stack:** Next.js 15.5 App Router (server components, `force-dynamic`), TypeScript, Zod, libSQL/Turso (`@libsql/client` 0.14), Nominatim (OSM) jsonv2, Clerk (só em `/contribuir`), Vitest 2.1.9 + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-17-cidade-do-ponto-e-revisao-design.md`

---

## Global Constraints

- 🔴 **NADA DE PRODUÇÃO.** Nenhuma tarefa roda `npm run semear`, toca o Turso remoto, faz `git push`, `vercel`, `vercel --prod` ou `gh`. Deploy é depois do pacote de frases lido pelo João (Task 9), FORA deste plano: `npm run semear` (cria as DUAS tabelas novas, `nominatim_respostas` e `nominatim_vez` — sem isso todo ponto salvo responde "não consegui achar a cidade") → UM `vercel --prod --yes` → `conferir-no-ar`. Push no GitHub não deploya neste repo.
- 🔴 **Todo dispatch roda e cola a saída de quatro portões**, nesta ordem, e só fecha com os quatro verdes:
  1. `npx vitest run` — o flake `Worker exited unexpectedly` se resolve rodando de novo; **relate que aconteceu**.
  2. `npx tsc --noEmit`
  3. **`npm run build`** — a branch já ficou sem compilar com a suíte verde (25/09). Sem chave do Clerk; se exigir, PARE.
  4. `node scripts/mutar.mjs` → **42/0/0**, com a árvore limpa, DEPOIS do commit. Ele ancora por linha só em `src/lib/coerencia.ts` e `src/app/[slug]/page.tsx` (`grep -n "@[0-9]" scripts/mutar.mjs`); este plano não toca nenhum dos dois — se tocar, reancore e prove.
- 🔴 **A suíte nunca bate no Nominatim de verdade** (spec §7). A Task 1 instala `tests/setup-sem-rede.ts` em `setupFiles`, que faz todo `fetch` pra `nominatim.openstreetmap.org` estourar. Rota que chama o reverse é testada com o dublê `tests/nominatim.ts` (estado em `globalThis`, regra do dublê do Clerk); o módulo de serviço é testado com fixture em `tests/fixtures/nominatim-*.json`.
- 🔴 **A política do Nominatim** (lida em 17/10): nunca busca-enquanto-digita (só o botão Buscar, ou Enter no mesmo formulário); no máximo 1 consulta por segundo no TOTAL; `User-Agent` fixo do app (`USER_AGENT_DO_APP`); respostas guardadas; atribuição "© OpenStreetMap" já visível no mapa; nenhuma consulta sistemática (nada de grade, nada de pré-carregar). Só servidor chama o Nominatim, e só pra quem tem login (painel ou Clerk).
- 🔴 **A busca nunca grava ponto** (spec §3.4): escolher um resultado não põe pin, não liga o Salvar, não preenche nada. **Nada é pré-preenchido** pelo Nominatim: a ÚNICA coisa que vem dele e é gravada é a `cidade` do ponto que a pessoa marcou (spec §7).
- **Toda condição de corrida mora NO MESMO statement que grava** — inclusive o limite de 1/s (`UPDATE … WHERE ultima_ms <= ?`), nunca "ler e depois gravar".
- **Toda frase de tela nova** nasce `export const NOME = "…"` num módulo de palavras ou componente, com `// PENDENTE: redação minha, o João ainda não leu` na linha de cima, e é listada no relatório da tarefa. Frase em função, objeto ou JSX solto o guarda `tests/lib/frases-da-rodada-marcadas.test.ts` NÃO vê: proibido nesta rodada, salvo as que a Task 9 lista por nome. Nenhum marcador `LIDA:`/`PENDENTE` existente é apagado de frase que fica.
- **Frase exportada sob `src/app/admin/**` entra em `CUNHADAS_AQUI`** (`tests/app/admin-editores-de-campo.test.tsx:1429`) NO MESMO commit. Tarefas que fazem: 4, 5, 7, 8.
- **O guarda do questionário** (`tests/app/admin-formulario-de-lugar.test.tsx:316-358`): todo texto de `PERGUNTAS` que está em `ORDEM` é trecho de `docs/questionario-ficha.md`, na mesma ordem. Tirar a cidade da ordem mexe no doc junto (Task 3); o guarda não afrouxa.
- **A `TelaDePublicar` não alcança registro, schema, zod** (`tests/app/admin-tela-de-publicar.test.tsx:400-420`). A revisão é montada na página de servidor e desenhada por um componente de SERVIDOR (Task 8).
- **Arquivo `route.ts`/`page.tsx` não exporta nada além do que o Next aceita** (`tests/deploy/exports-de-rota.test.ts`). Constante, frase e helper moram em `src/lib/*` ou num componente.
- **Toda página que lê banco declara `export const dynamic = "force-dynamic"`.**
- **Falha fechada**, como hoje: rotas `/api/admin/*` → 404 painel desligado, 401 sem sessão, ANTES de qualquer leitura; rotas `/api/contribuir/*` → a `portaDaPessoa` de sempre (503/401/403). A pessoa nunca recebe frase do painel nem o nome de outro lugar (I3 de 07/10).
- **O Clerk é dublado em todo teste** (`vi.mock("@/lib/contribuidor-sessao", …)`, estado em `globalThis`, a SONDA 2 de `tests/api/route-contribuir-rascunho.test.ts` copiada em rota nova da pessoa).
- **Mutação medida.** Cada tarefa lista as mutações à mão que as provas dela têm de matar; aplique cada uma (`git diff --stat` não-vazio), rode, mostre o teste que morreu, desfaça, `git status` limpo. Sobrevivente = prova que falta, escrita NA tarefa.
- **`git add` por caminho, nunca `-A`. `docs/RESUME.md` nunca entra em commit de tarefa.** Nomes e cidades de teste são MARCADORES (`Lugar Marcador …`, `Cidade Marcador …`); nenhuma cidade real em teste nem em fixture.
- **Comentários em português, no estilo do vizinho; nenhuma frase de comentário fica falsa** por causa do commit (procure: "nome e cidade", "a cidade é obrigatória no POST", "NÃO EXISTE BUSCA", "o endereço é sempre nome + cidade").

---

## Review Focus

Cinco condições que a spec implica, que nenhuma prova da spec cobre, e que mordem quem usa. Cada uma tem caso na tarefa dona:

1. **Dois pontos salvos no mesmo segundo** (duplo toque no Salvar com o pin mexido, ou duas abas): o segundo cai no limite de 1/s. Esperado: 503 com `CIDADE_DO_PONTO_NAO_SAIU`, **nada gravado**, o primeiro intacto; o mesmo ponto de novo é resposta guardada e não espera. *(Task 1, "o limite"; Task 3, "o segundo ponto no mesmo segundo")*
2. **Busca vazia, só de espaços, longa demais, ou disparada pelo Enter.** Esperado: vazio/espaços não pedem nada; acima de `TETO_DA_BUSCA` é 400 sem pedir; Enter dispara UMA busca, igual ao botão; digitar não pede nada. *(Task 5, "digitar não busca" e "o teto")*
3. **A sessão do Clerk vence no meio da busca.** Esperado: o 401 da rota de busca dela recarrega a tela (`recarregarSe401`), como o resto do formulário; no painel é a frase de falha. *(Task 5, "401 na busca dela recarrega")*
4. **Rascunho do painel na chave provisória aberto pela lista do painel e pelo "publicar" de lá.** Esperado: a lista mostra o nome (sem "sem cidade"); a tela de publicar abre e a porta recusa com frase — nunca um lugar no ar em `/rascunho_…`. *(Task 2, "a lista mostra o rascunho sem cidade"; Task 3, "chave provisória nunca vai ao ar")*
5. **Texto digitado e "Pular" ou "Anterior" tocado** (não só o "Próxima"). Esperado: o mesmo segundo toque de confirmação; sem ele, nada sai da tela. *(Task 7, "pular com texto não salvo pede o segundo toque")*

---

## Mapa de arquivos

| Arquivo | Papel | Tarefa |
|---|---|---|
| `src/lib/nominatim.ts` (novo) | URLs, chaves de cache, leitura do reverse e da busca — puro | 1 |
| `src/lib/db-nominatim.ts` (novo), `src/lib/db.ts` (`ensureSchema`) | as respostas guardadas e a vez de 1/s | 1 |
| `src/lib/nominatim-servico.ts` (novo) | `cidadeDoPonto`, `buscarNoMapa` — SÓ servidor | 1 |
| `tests/setup-sem-rede.ts`, `tests/nominatim.ts`, `vitest.config.ts` | a suíte sem rede; o dublê | 1 |
| `src/lib/rascunho.ts`, `src/lib/par-de-lugar.ts`, `src/lib/db-contribuidor.ts` | o lugar nasce do nome; chave provisória; trava do par | 2, 3, 4 |
| `src/app/api/admin/rascunho/route.ts`, `src/app/api/contribuir/rascunho/route.ts` | POST só nome (2); PUT do ponto com reverse (3) | 2, 3 |
| `src/app/api/admin/publicar/route.ts`, `src/lib/porta-de-publicar.ts` | a chave tem de ser o `nome-cidade` | 3 |
| `src/lib/campos-da-ficha.ts`, `src/lib/campos-da-pessoa.ts`, `src/app/admin/novo/perguntas.ts`, `src/app/contribuir/perguntas.ts`, `docs/questionario-ficha.md` | a cidade deixa de ser pergunta | 3 |
| `src/app/api/contribuir/lugar/route.ts` | o ponto do lugar no ar dela regrava a cidade sem travar | 4 |
| `src/app/admin/AvisoDoPar.tsx` (novo), `src/app/admin/novo/page.tsx`, `src/app/contribuir/novo/page.tsx` | o aviso "esse nome já existe nessa cidade" | 4 |
| `src/app/api/{admin,contribuir}/buscar-no-mapa/route.ts` (novos), `src/app/admin/campos/BuscaNoMapa.tsx` (novo), `EditorCoordenada.tsx`, `gravar.ts`, `tipos.ts`, `src/lib/vista-do-mapa.ts`, `novo/enderecos.ts` | a busca e a cidade embaixo do mapa | 5 |
| `src/lib/rotulos-das-opcoes.ts` (novo), `src/lib/semana.ts`, `EditorLista.tsx`, `FichaInteira.tsx`, `admin.css` | rótulos de gente; sem zoom no iPhone | 6 |
| `src/app/admin/FormularioDeLugar.tsx`, `campos/BotaoDesfazer.tsx` | pergunta primeiro; "Próxima" não perde texto; volta à revisão | 7 |
| `src/app/admin/novo/revisao.ts` (novo), `RevisaoDoLugar.tsx` (novo), `MapinhaDoPonto.tsx` (novo), `TelaDePublicar.tsx`, as duas páginas de publicar | a revisão | 8 |
| `tests/lib/frases-da-rodada-marcadas.test.ts` | a lista da rodada; PARADA | 9 |

---

### Task 1: O Nominatim atrás de uma porta só — guardado, um por segundo, e a suíte sem rede

**Files:**
- Create: `src/lib/nominatim.ts`, `src/lib/db-nominatim.ts`, `src/lib/nominatim-servico.ts`
- Modify: `src/lib/db.ts:37-160` (`ensureSchema`: duas tabelas e a semente da linha da vez, no molde de `regra_padrao`)
- Create: `tests/setup-sem-rede.ts`, `tests/nominatim.ts`; Modify: `vitest.config.ts` (`setupFiles: ["tests/setup-sem-rede.ts"]`)
- Create: `tests/fixtures/nominatim-reverso-town.json`, `nominatim-reverso-municipality.json`, `nominatim-reverso-village.json`, `nominatim-reverso-mar.json`, `nominatim-busca.json`
- Test: `tests/lib/nominatim.test.ts`, `tests/lib/nominatim-servico.test.ts`

**Interfaces:**
- Consumes: `ESTADO_DO_APP` (`src/lib/lugares.ts:51`), `getClient`, `ensureSchema`.
- Produces:
  ```ts
  // src/lib/nominatim.ts — puro, sem fetch
  export const USER_AGENT_DO_APP = "BatePerna/1.0 (+https://github.com/JoaoAgostinhoVision/BatePerna)";
  export const PRAZO_NOMINATIM_MS = 3_000;      // o molde de PRAZO_BUSCA_MS
  export const INTERVALO_NOMINATIM_MS = 1_000;
  export const VALIDADE_DA_RESPOSTA_S = 30 * 24 * 3600;
  export const QUANTOS_NA_BUSCA = 10;
  export const TETO_DA_BUSCA = 120;             // caracteres
  export type AchadoNoMapa = { nome: string; lat: number; lng: number };
  export function pontoArredondado(lat: number, lng: number): { lat: number; lng: number }; // 4 casas
  export function urlBuscaNoMapa(q: string): string;
  export function urlCidadeDoPonto(lat: number, lng: number): string; // já com o ponto arredondado
  export function chaveDaBusca(q: string): string;   // "busca:" + trim + minúsculas + espaços colapsados
  export function chaveDoPonto(lat: number, lng: number): string; // "ponto:<lat4>,<lng4>"
  export function municipioDaResposta(raw: unknown): string | null;
  export function achadosDaResposta(raw: unknown): AchadoNoMapa[];
  // src/lib/db-nominatim.ts
  export async function respostaGuardada(client: Client, chave: string, agoraS: number): Promise<string | null>;
  export async function guardarResposta(client: Client, chave: string, resposta: string, agoraS: number): Promise<void>;
  export async function tomarVezDoNominatim(client: Client, agoraMs: number): Promise<boolean>;
  // src/lib/nominatim-servico.ts — SÓ servidor
  export type FontesDoNominatim = { pedir: (url: string) => Promise<unknown>; client: () => Client; agoraMs: () => number };
  export const FONTES_NOMINATIM: FontesDoNominatim;
  export type FalhaDoNominatim = "fora" | "limite";
  export async function cidadeDoPonto(lat: number, lng: number, f?: FontesDoNominatim):
    Promise<{ cidade: string } | { falha: FalhaDoNominatim | "sem-municipio" }>;
  export async function buscarNoMapa(q: string, f?: FontesDoNominatim):
    Promise<{ achados: AchadoNoMapa[] } | { falha: FalhaDoNominatim }>;
  // tests/nominatim.ts — o dublê das rotas
  export type EstadoDoNominatim = { ponto: { cidade: string } | { falha: string }; busca: { achados: AchadoNoMapa[] } | { falha: string }; pontos: { lat: number; lng: number }[]; buscas: string[] };
  export const nominatimDeTeste: EstadoDoNominatim; // em globalThis.__nominatim ??= {…}
  export function dubleDoNominatim(): Pick<typeof import("@/lib/nominatim-servico"), "cidadeDoPonto" | "buscarNoMapa">;
  ```

Decisões do planejador (spec §8, "fica pro construtor"):
- **Onde guardar:** tabela `nominatim_respostas (chave TEXT PRIMARY KEY, resposta TEXT NOT NULL, em INTEGER NOT NULL)` — vale entre recargas E entre instâncias da Vercel (memória do processo não vale). Guarda o JSON CRU (`JSON.stringify(raw)`) e relê com as mesmas funções puras. **30 dias**; mais velho conta como ausente e é sobrescrito. Falha de rede/HTTP nunca é guardada; resposta válida sem município (o mar) é.
- **Como esperar o 1/s:** NÃO espera — recusa. Tabela `nominatim_vez (id INTEGER PRIMARY KEY CHECK (id = 1), ultima_ms INTEGER NOT NULL)`, semeada `INSERT OR IGNORE (1, 0)`; `tomarVezDoNominatim` é UM `UPDATE nominatim_vez SET ultima_ms = ? WHERE id = 1 AND ultima_ms <= ?` com `[agoraMs, agoraMs - INTERVALO_NOMINATIM_MS]`, e só `rowsAffected === 1` é a vez. Resposta guardada não gasta a vez. Sem vez → `{ falha: "limite" }`, e a tela diz "tente de novo" (dormir numa função da Vercel custa e não prova nada).
- **Ordem de leitura do reverse:** `address.municipality` → `address.city` → `address.town` → `address.village`; o primeiro texto não vazio (aparado). `municipality` primeiro porque, onde o Nominatim o devolve, é ele o município e as outras chaves podem ser o povoado (spec §2.2: "o que conta é o município"). `{"error": …}`, sem `address`, ou nenhuma das quatro → `null`. URL do reverse: `/reverse?lat=&lon=&format=jsonv2&zoom=10` com o ponto arredondado a 4 casas (≈11 m — a chave do guardado e a consulta são o MESMO ponto).
- **Fora de Pernambuco:** o app hoje aceita qualquer cidade digitada (só a VISTA confere o estado). Mantido: o município que o reverse der é gravado, sem portão de estado.
- **Pernambuco primeiro na busca:** `search?q=&countrycodes=br&format=jsonv2&limit=10&addressdetails=1`; `achadosDaResposta` ordena de forma ESTÁVEL os de `address.state === ESTADO_DO_APP` antes, sem tirar nenhum. Nome do achado = `display_name` (só pra escolher; nunca gravado). Item sem `display_name` texto ou com `lat`/`lon` que não viram número finito sai.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/nominatim.test.ts` (puro, fixtures):
```ts
it("o reverse lê o município: town", () => expect(municipioDaResposta(fx("nominatim-reverso-town"))).toBe("Cidade Marcador Um"));
it("municipality ganha de village (o povoado não é o município)", () =>
  expect(municipioDaResposta(fx("nominatim-reverso-municipality"))).toBe("Cidade Marcador Dois")); // fixture tem as duas chaves
it("só village também serve", () => expect(municipioDaResposta(fx("nominatim-reverso-village"))).toBe("Cidade Marcador Três"));
it("o mar não tem município", () => expect(municipioDaResposta(fx("nominatim-reverso-mar"))).toBeNull()); // {"error":"Unable to geocode"}
it("município só de espaços é nenhum", () => expect(municipioDaResposta({ address: { town: "  " } })).toBeNull());
it("Pernambuco primeiro, sem tirar os outros, na ordem estável", () => {
  const a = achadosDaResposta(fx("nominatim-busca")); // 3 itens: SC, PE, BA (marcadores)
  expect(a.map((x) => x.nome)).toEqual([PE, SC, BA]);
  expect(a[0]).toEqual({ nome: PE, lat: -8.1, lng: -35.2 }); // números do fixture, parseados
});
it("item sem coordenada finita sai", …);
it("as URLs: jsonv2, Brasil, sem pedir mais do que 10, zoom 10 no reverse, ponto arredondado", () => {
  const b = new URL(urlBuscaNoMapa("  Lugar  Marcador "));
  expect(Object.fromEntries(b.searchParams)).toEqual({ q: "Lugar  Marcador", countrycodes: "br", format: "jsonv2", limit: "10", addressdetails: "1" });
  const r = new URL(urlCidadeDoPonto(-8.123456, -35.987654));
  expect(Object.fromEntries(r.searchParams)).toEqual({ lat: "-8.1235", lon: "-35.9877", format: "jsonv2", zoom: "10" });
});
it("a chave: caixa e espaço não contam; acento conta", () => {
  expect(chaveDaBusca(" Lugar   MARCADOR ")).toBe(chaveDaBusca("lugar marcador"));
  expect(chaveDaBusca("lugar marcador")).not.toBe(chaveDaBusca("lugár marcador"));
  expect(chaveDoPonto(-8.12341, -35.1)).toBe(chaveDoPonto(-8.12344, -35.10002));
});
```

`tests/lib/nominatim-servico.test.ts` (banco `:memory:` com `ensureSchema`; `pedir` é `vi.fn` que devolve fixture; `agoraMs` controlado):
```ts
it("acha a cidade e guarda: o mesmo ponto de novo não pede", async () => {
  expect(await cidadeDoPonto(-8.1, -35.2, f)).toEqual({ cidade: "Cidade Marcador Um" });
  agora += 10; // dentro do mesmo segundo, e mesmo assim responde: é guardado
  expect(await cidadeDoPonto(-8.10001, -35.2, f)).toEqual({ cidade: "Cidade Marcador Um" });
  expect(pedir).toHaveBeenCalledTimes(1);
  expect(pedir.mock.calls[0][0]).toBe(urlCidadeDoPonto(-8.1, -35.2));
});
it("o limite: um ponto NOVO no mesmo segundo não pede, e diz limite", async () => {
  await cidadeDoPonto(-8.1, -35.2, f); agora += 999;
  expect(await cidadeDoPonto(-8.3, -35.4, f)).toEqual({ falha: "limite" });
  expect(pedir).toHaveBeenCalledTimes(1);
  agora += 1;
  expect(await cidadeDoPonto(-8.3, -35.4, f)).toEqual({ cidade: expect.any(String) });
});
it("o limite é do banco: duas fontes com o MESMO banco dividem a vez", …); // dois FontesDoNominatim, um client
it("fora do ar: falha 'fora', e nada guardado", async () => { pedir.mockRejectedValueOnce(new Error("503")); … expect(await respostaGuardada(c, chaveDoPonto(...), s)).toBeNull(); });
it("o mar: 'sem-municipio', guardado (não pede de novo)", …);
it("resposta de mais de 30 dias conta como ausente", …);
it("a busca vazia/espaços não pede nem gasta a vez", async () => { expect(await buscarNoMapa("   ", f)).toEqual({ achados: [] }); expect(pedir).not.toHaveBeenCalled(); });
it("a busca guarda pela chave da busca", …);
it("banco fora (tabela ausente): falha 'fora', nunca estoura", …); // client sem ensureSchema
it("FONTES_NOMINATIM manda o User-Agent do app e o prazo", async () => {
  const f = vi.fn(async () => Response.json({}));
  vi.stubGlobal("fetch", f);
  await FONTES_NOMINATIM.pedir("https://nominatim.openstreetmap.org/x");
  expect(new Headers(f.mock.calls[0][1].headers).get("user-agent")).toBe(USER_AGENT_DO_APP);
  expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it("controle do setup: a suíte não alcança o Nominatim de verdade", async () => {
  await expect(fetch("https://nominatim.openstreetmap.org/search?q=x")).rejects.toThrow(/nunca bate no Nominatim/);
});
it("SONDA do dublê: o módulo dublado vê o estado que o teste muda", …); // molde da SONDA 2 do Clerk
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/lib/nominatim.test.ts tests/lib/nominatim-servico.test.ts` → FAIL (módulos não existem).

- [ ] **Step 3: Implementar** os três módulos com as assinaturas acima, as tabelas em `ensureSchema` (comentário no molde de `regra_padrao`: "sobrescreve, não afirma nada que foi à tela"), o setup (embrulha `globalThis.fetch`; URL com host `nominatim.openstreetmap.org` → `throw new Error("a suíte nunca bate no Nominatim de verdade")`) e o dublê. `cidadeDoPonto`/`buscarNoMapa`: guardado fresco → lê; senão `tomarVezDoNominatim` → `pedir` → guarda → lê; qualquer exceção de banco ou de rede → `{ falha: "fora" }`. `FONTES_NOMINATIM.pedir`: `fetch(url, { headers: { "user-agent": USER_AGENT_DO_APP, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(PRAZO_NOMINATIM_MS) })`, `!ok` → throw.

- [ ] **Step 4: Rodar e ver passar** — o mesmo comando → PASS.

- [ ] **Step 5: Mutações (cada uma tem de morrer)**

| # | Mutação | Morre em |
|---|---|---|
| M1 | `tomarVezDoNominatim` devolve sempre `true` | "o limite: um ponto NOVO no mesmo segundo…" |
| M2 | o `WHERE … ultima_ms <= ?` sai do `UPDATE` (passa a ler-e-gravar: `SELECT` antes) | "o limite é do banco: duas fontes…" (rode as duas em `Promise.all`) |
| M3 | `municipioDaResposta` lê `village` antes de `municipality` | "municipality ganha de village" |
| M4 | resposta guardada não é lida (sempre pede) | "acha a cidade e guarda…" |
| M5 | `catch` guarda a falha | "fora do ar: … nada guardado" |
| M6 | ordenação de PE removida | "Pernambuco primeiro…" |
| M7 | `setup-sem-rede.ts` tirado de `setupFiles` | "controle do setup…" |
| M8 | dublê com estado num `const` de módulo | "SONDA do dublê" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/lib/nominatim.ts src/lib/db-nominatim.ts src/lib/nominatim-servico.ts src/lib/db.ts tests/setup-sem-rede.ts tests/nominatim.ts vitest.config.ts tests/fixtures/nominatim-*.json tests/lib/nominatim.test.ts tests/lib/nominatim-servico.test.ts
git commit -m "feat(nominatim): a cidade do ponto e a busca, guardadas e uma por segundo, atras de uma porta so"
```

---

### Task 2: O lugar nasce só do nome — os dois POSTs, a chave provisória do painel, a tela 1

**Files:**
- Modify: `src/app/api/admin/rascunho/route.ts:114-185` (`quemOcupa` sai pra lib; POST), `:233-276` (o PUT do nome sem cidade)
- Modify: `src/app/api/contribuir/rascunho/route.ts:48-92` (POST), `:145-155` (renomear sem cidade)
- Modify: `src/lib/rascunho.ts:111-125` (`docDoLugarNovo`), novo `ehChaveDeRascunho`
- Modify: `src/lib/db-contribuidor.ts:97-114` (docblock de `novaChaveDeRascunho`: agora também do painel), `:182-196` (`criarRascunhoDaPessoa` com `endereco: string | null`)
- Modify: `src/lib/par-de-lugar.ts:96-113` (rascunho do João sem cidade não é gêmeo), novo `quemOcupaNoPainel`
- Modify: `src/app/admin/FormularioDeLugar.tsx:241-308` (`ComecarLugarNovo` só com o nome), `src/app/admin/novo/page.tsx:64-72`, `src/app/contribuir/novo/page.tsx:31-38`
- Test: `tests/api/route-admin-rascunho.test.ts`, `tests/api/route-contribuir-rascunho.test.ts`, `tests/lib/colisao-do-par.test.ts`, `tests/lib/db-rascunho-da-pessoa.test.ts`, `tests/app/admin-formulario-de-lugar.test.tsx` (describe `:1090` e `:1170`), `tests/app/formulario-da-pessoa.test.tsx:73,137-141`, `tests/api/rascunho-nao-ocupa.test.ts`

**Interfaces:**
- Consumes: `novaChaveDeRascunho()` (`db-contribuidor.ts:113`), `colisaoDoPar`, `criarRascunho`.
- Produces:
  ```ts
  // src/lib/rascunho.ts
  export function docDoLugarNovo(slug: string, nome: string): string; // {slug, modos: [], trajeto:{waypoints:[{nome}]}} — SEM cidade
  export function ehChaveDeRascunho(slug: string): boolean;           // /^rascunho_[0-9a-f]{32}$/
  // src/lib/par-de-lugar.ts
  export async function quemOcupaNoPainel(endereco: string): Promise<string>; // o `quemOcupa` de hoje, movido sem mudar
  // src/lib/db-contribuidor.ts
  export async function criarRascunhoDaPessoa(client: Client, endereco: string | null, doc: string, agora: number, id: string): Promise<string | null>;
  // FormularioDeLugar.tsx
  export function ComecarLugarNovo(p: { pergunta: string; onde?: Onde }): JSX.Element;
  ```
  Corpos: `POST /api/admin/rascunho {nome}` → 201 `{slug: "rascunho_<hex>"}`; `POST /api/contribuir/rascunho {nome}` → 201 `{slug: chave}`.

Decisões do planejador:
- **Forma da chave provisória do painel (spec §2.1, §8):** a MESMA de quem usa, `novaChaveDeRascunho()` = `rascunho_` + 32 hex. Garantia própria: o `_` nunca sai de `slugDoNome` (só `[a-z0-9-]`) nem da semente, e nenhuma pasta de `SLUGS_RESERVADOS` tem `_` — a chave nunca coincide com endereço nem com tela. "Nunca vai ao ar" é a porta da Task 3.
- **No painel, o `slug` de dentro do documento é sempre a CHAVE** (a régua de `docNoEndereco`: "o documento não pode dizer um endereço e morar noutro"). Pra quem usa, nasce `""` — a chave dela só existe dentro do `INSERT`, e o `slug` de dentro só vale no publicar, que o recalcula (`SLUG_DE_DENTRO`).
- **O gêmeo sem cidade continua na tela do nome** (spec §2.3.1): `colisaoDoPar(nome, "", {exceto: null, nomeNovo: true, …})` — com cidade vazia só o gêmeo dispara. 🔴 **Rascunho DO JOÃO sem cidade não conta como gêmeo** (só lugar conta): até hoje todo rascunho dele tinha cidade, então isto MANTÉM o comportamento de agora; sem isto, o segundo rascunho "Pedra do Navio" dele seria recusado com `gemeoSemCidade`, que manda "responder a cidade dele" — pergunta que não existe mais (contradição achada, ver o fim). Rascunho do João COM cidade continua contando no par, como hoje.
- **Renomear antes do ponto** (os dois PUTs): sem cidade no documento, só regrava — nada de `CIDADE_VAZIA`, nada de mudar chave nem `slug` de dentro. Com cidade, a régua de hoje (muda chave no painel / confere `endereco` dela).
- **`criarRascunhoDaPessoa(…, null, …)`:** `endereco === null` pula `ENDERECO_LIVRE` (`? IS NULL OR (…)`, o molde de `regravarRascunhoDaPessoa`). Não há endereço sem cidade.

- [ ] **Step 1: Testes que falham** (reescreva os casos `{nome, cidade}` existentes; a cidade de teste agora só chega pelo PUT de campo `cidade`, que ainda existe até a Task 3)

```ts
// route-admin-rascunho.test.ts
it("POST {nome} nasce numa chave provisória, com o documento exato", async () => {
  const r = await rota.POST(pedido("POST", { nome: NOME }, cookieBom));
  expect(r.status).toBe(201);
  const { slug } = await r.json();
  expect(ehChaveDeRascunho(slug)).toBe(true);
  expect(JSON.parse((await lerRascunho(c, slug))!.doc)).toEqual({ slug, modos: [], trajeto: { waypoints: [{ nome: NOME }] } });
});
it("POST com cidade é 400, nada nasce", async () => { expect((await rota.POST(pedido("POST", { nome: NOME, cidade: CIDADE }, cookieBom))).status).toBe(400); expect(await listarRascunhos(c)).toEqual([]); });
it("dois rascunhos do João com o MESMO nome, sem cidade, nascem os dois", …);
it("o gêmeo de um LUGAR sem cidade continua recusado na tela do nome", …); // lugar do acervo sem cidade; 409 gemeoSemCidade(...)
it("renomear antes do ponto: regrava, a chave não muda, sem CIDADE_VAZIA", …);
it("a chave provisória nunca é uma tela nem um endereço", () => {
  const k = novaChaveDeRascunho();
  expect(SLUGS_RESERVADOS).not.toContain(k); expect(slugDoNome(k)).not.toBe(k);
});
// route-contribuir-rascunho.test.ts
it("POST {nome} dela nasce, sem cidade e sem conferir endereço", …); // doc {slug:"", modos:[], trajeto…}
it("POST dela com cidade é 400", …);
it("o gêmeo sem cidade de um lugar responde NOME_JA_EM_USO", …);
// admin-formulario-de-lugar.test.tsx
it("a tela 1 tem UMA caixa, a do nome, e manda {nome}", …); // getAllByRole("textbox").length === 1; corpo do fetch === {nome}
it("a lista mostra o rascunho sem cidade pelo nome, sem 'sem cidade'", …); // Review Focus 4
```

- [ ] **Step 2: Rodar** — `npx vitest run tests/api/route-admin-rascunho.test.ts tests/api/route-contribuir-rascunho.test.ts tests/app/admin-formulario-de-lugar.test.tsx tests/app/formulario-da-pessoa.test.tsx tests/lib/colisao-do-par.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — POST do painel: exatamente `{nome}`; `NOME_VAZIO`/`NOME_SEM_LETRA`; `parOcupado(nome, "", {exceto: null, nomeNovo: true})` → 409; `criarRascunho(c, chave, docDoLugarNovo(chave, nome), agora)`. POST dela: exatamente `{nome}`, teto, as mesmas frases, `colisaoDoPar(…, quem: "pessoa")` → `NOME_JA_EM_USO`, `criarRascunhoDaPessoa(c, null, docDoLugarNovo("", nome), agora, id)`. `ComecarLugarNovo` perde a caixa e o estado da cidade; as páginas passam `pergunta={PERGUNTAS["trajeto.waypoints.0.nome"]}`. Comentários de `SLUGS_RESERVADOS`, `docDoLugarNovo`, do POST e do `ComecarLugarNovo` reescritos (nenhum diz mais "nasce de nome e cidade").

- [ ] **Step 4: Rodar** — o mesmo → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | POST do painel volta a aceitar 2 chaves | "POST com cidade é 400" |
| M2 | chave do painel = `slugDoNome(nome)` | "POST {nome} nasce numa chave provisória…" |
| M3 | `colisaoDoPar` conta rascunho do João sem cidade como gêmeo | "dois rascunhos do João com o MESMO nome…" |
| M4 | `colisaoDoPar` tira o gêmeo de LUGAR | "o gêmeo de um LUGAR sem cidade…" |
| M5 | renomear sem cidade volta a dar `CIDADE_VAZIA` | "renomear antes do ponto…" |
| M6 | o POST dela passa `slugDoNome(nome)` como `endereco` (em vez de `null`) | "POST {nome} dela nasce…", com um lugar do acervo morando em `slugDoNome(NOME)` (o caso o semeia) |
| M7 | `ComecarLugarNovo` manda `{nome, cidade: ""}` | "a tela 1 tem UMA caixa…" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/api/admin/rascunho/route.ts src/app/api/contribuir/rascunho/route.ts src/lib/rascunho.ts src/lib/db-contribuidor.ts src/lib/par-de-lugar.ts src/app/admin/FormularioDeLugar.tsx src/app/admin/novo/page.tsx src/app/contribuir/novo/page.tsx tests/api/route-admin-rascunho.test.ts tests/api/route-contribuir-rascunho.test.ts tests/lib/colisao-do-par.test.ts tests/lib/db-rascunho-da-pessoa.test.ts tests/app/admin-formulario-de-lugar.test.tsx tests/app/formulario-da-pessoa.test.tsx tests/api/rascunho-nao-ocupa.test.ts
git commit -m "feat(lugar-novo): o lugar nasce so do nome; o rascunho do painel numa chave provisoria"
```

---

### Task 3: A cidade sai do ponto — os dois PUTs do ponto, a saída (b), e a cidade deixa de ser pergunta

**Files:**
- Modify: `src/app/api/admin/rascunho/route.ts:187-286` (PUT), `src/app/api/contribuir/rascunho/route.ts:97-166` (PUT)
- Modify: `src/app/api/admin/publicar/route.ts:107-116` (a chave tem de ser o `nome-cidade`), `src/lib/porta-de-publicar.ts` (frase nova)
- Modify: `src/lib/rascunho.ts` (frase nova), `src/lib/par-de-lugar.ts` (novo `travaDoPainel`)
- Modify: `src/lib/campos-da-ficha.ts:56-66,101` (propriedade `saiDoPonto`), `src/app/admin/novo/perguntas.ts:53,135-137,176-178` (ORDEM sem `cidade`; `PERGUNTAS.cidade` apagada), `src/app/contribuir/perguntas.ts:7-10`, `src/lib/campos-da-pessoa.ts:12-27,113-125`, `src/app/contribuir/novo/publicar/page.tsx:47-55` (a falta da cidade leva ao ponto), `docs/questionario-ficha.md:47-67`
- Test: `tests/api/route-admin-rascunho.test.ts`, `tests/api/route-contribuir-rascunho.test.ts`, `tests/api/route-admin-publicar.test.ts`, `tests/api/route-contribuir-publicar.test.ts`, `tests/lib/campos-da-pessoa.test.ts`, `tests/app/admin-formulario-de-lugar.test.tsx`, `tests/app/formulario-da-pessoa.test.tsx`, `tests/app/admin-tela-de-publicar.test.tsx`, `tests/lib/questionario.test.ts`

**Interfaces:**
- Consumes: `cidadeDoPonto` (Task 1; nos testes, `dubleDoNominatim` + `nominatimDeTeste`), `ehChaveDeRascunho`, `quemOcupaNoPainel`, `novaChaveDeRascunho` (Task 2).
- Produces:
  ```ts
  // src/lib/rascunho.ts
  // PENDENTE
  export const CIDADE_DO_PONTO_NAO_SAIU = "Nada foi gravado: não consegui achar a cidade deste ponto. Tente de novo daqui a pouco, ou mexa o ponto.";
  // src/lib/porta-de-publicar.ts
  // PENDENTE
  export const ENDERECO_AINDA_NAO_SAIU = "Nada foi publicado: o endereço deste lugar ainda não saiu do nome e da cidade. Corrija o nome e salve de novo.";
  // src/lib/par-de-lugar.ts — a frase do PAINEL do que impede o rascunho de morar no `nome-cidade`, ou null
  export async function travaDoPainel(doc: string, slug: string): Promise<string | null>;
  // src/lib/campos-da-ficha.ts
  export type CampoDaFicha = { …; saiDoPonto?: true }; // só a entrada `cidade`
  ```
  Respostas: `PUT {slug, ponto: 0, lat, lng}` → 200 `{slug}` (o endereço de agora — no painel pode ser outro), ou **503** `CIDADE_DO_PONTO_NAO_SAIU` com nada gravado; `PUT {slug, campo: "cidade", …}` → 400 mudo nos dois.

Decisões do planejador:
- **Status da cidade que não sai:** 503 com a frase, pras três falhas (`fora`, `limite`, `sem-municipio`): a tela mostra o corpo em qualquer recusa, e a frase serve às três (spec §2.2: "tentar de novo ou mexer o ponto").
- **O ponto do painel, na ordem:** reverse (falha → 503, nada lido do banco além do rascunho) → `gravarPontoNoRascunho` + `cidade` → par por `colisaoDoPar(nome, cidade, {exceto: slug, nomeNovo: false, quem: "joao"})` (`nomeNovo: false`: o gêmeo nunca dispara no ponto, §2.3.1) → **colidiu: NUNCA tenta o `nome-cidade`**; fica (ver abaixo) → livre: `moverRascunho(slug, destino, docNoEndereco(doc, destino))`; recusou (endereço de um lugar de outro par, ou de outro rascunho dele) → fica. **"Ficar":** já na chave provisória → `regravarRascunho` ali (`docNoEndereco(doc, slug)`); numa chave `nome-cidade` que o ponto tornou falsa (corrigir o ponto pra outra cidade) → `moverRascunho(slug, novaChaveDeRascunho(), …)`. Invariante, provada: **a chave do rascunho do painel é o `nome-cidade` do documento, ou uma chave provisória.** Sumido entre a leitura e a gravação → 409 `RASCUNHO_NAO_EXISTE_MAIS`, como hoje.
- **O ponto dela:** reverse (falha → 503) → `pontoNoRascunhoDaPessoa` + `cidade` + `docNoEndereco(doc, nome-cidade)` → `regravarRascunhoDaPessoa(…, endereco = null)`: o ponto grava SEMPRE; a colisão é do publicar (que já recusa par e endereço, `api/contribuir/publicar/route.ts:107-118`).
- **Só o ponto 0** chama o reverse; o `condicao.coords` do painel não.
- **Renomear com cidade** no painel segue a régua de hoje (`parDaMudanca` → 409; destino ocupado → 409 `quemOcupaNoPainel`); só o PONTO tem a saída (b) — renomear é a pessoa escolhendo, e a recusa deixa o texto na caixa.
- **A cidade sai das perguntas por PROPRIEDADE do registro:** `saiDoPonto: true` na entrada `cidade`; `camposQueSaoPergunta` a filtra (o comentário de lá diz "por propriedade, nunca por nome"). A `FichaInteira` não usa `camposQueSaoPergunta` e continua com a cidade editável à mão (spec §2.4). `CAMPOS_DA_PESSOA` perde `"cidade"` (ela nunca a escreve à mão, nem no lugar no ar), e `obrigatoriosDaPessoaFaltando` passa a pôr `"cidade"` na lista quando ela falta (antes vinha de `CAMPOS_DA_PESSOA`); `chavesForaDaPessoa` continua aceitando `cidade`.
- **O publicar do painel:** depois de `prepararPublicacao`, antes do par: `slug !== slugDoNome(nome + " " + cidade)` → 409 `(await travaDoPainel(doc, slug)) ?? ENDERECO_AINDA_NAO_SAIU`.
- **O doc do questionário:** a seção "A cidade — `cidade`" passa a dizer que, num lugar NOVO, a cidade sai do ponto marcado (pelo Nominatim) e não se pergunta; e que no painel do lugar publicado ela continua corrigível à mão. O `<!-- PENDENTE -->` da seção fica. `PERGUNTAS.cidade` é apagada (sem uso; a linha da revisão usa `rotuloDe("cidade")`).

- [ ] **Step 1: Testes que falham** (todo teste que manda `ponto: 0` passa a `vi.mock("@/lib/nominatim-servico", …dubleDoNominatim)`, com `nominatimDeTeste.ponto = { cidade: CIDADE }` no `beforeEach`)

```ts
// route-admin-rascunho.test.ts — "a cidade sai do ponto"
it("o ponto grava a cidade do reverse e o rascunho se muda pro nome-cidade", async () => {
  const k = await nascer(NOME);
  const r = await mudar({ slug: k, ponto: 0, lat: -8.1, lng: -35.2 });
  expect(await r.json()).toEqual({ slug: S });
  expect(await lerRascunho(c, k)).toBeNull();
  expect(await docDe(S)).toMatchObject({ slug: S, cidade: CIDADE, trajeto: { waypoints: [{ nome: NOME, lat: -8.1, lng: -35.2 }] } });
  expect(nominatimDeTeste.pontos).toEqual([{ lat: -8.1, lng: -35.2 }]);
});
it.each(["fora", "limite", "sem-municipio"])("cidade que não sai (%s): 503 com a frase, NADA gravado", async (falha) => {
  nominatimDeTeste.ponto = { falha };
  const antes = await lerRascunho(c, k);
  const r = await mudar({ slug: k, ponto: 0, lat: -8.1, lng: -35.2 });
  expect([r.status, await r.text()]).toEqual([503, CIDADE_DO_PONTO_NAO_SAIU]);
  expect(await lerRascunho(c, k)).toEqual(antes);
});
it("§2.3.0 colisão no ponto: o PONTO e a CIDADE gravam, na chave provisória", …); // lugar NOME em CIDADE no acervo
it("§2.3.0 colisão no ponto: e o PUBLICAR trava", …); // completa o rascunho; POST publicar → 409; ficha_versoes sem a chave
it("endereço de um lugar de OUTRO par (a fronteira): o ponto grava e fica na provisória", …);
it("corrigir o ponto pra outra cidade: a chave anda pro nome-cidade novo", …);
it("corrigir o ponto pra uma cidade onde o par colide: sai do nome-cidade velho pra uma provisória", …); // ehChaveDeRascunho(nova) && lerRascunho(S) null
it("§2.3.2 rascunho antigo (cidade digitada, chave nome-cidade): o ponto refaz a cidade", …); // rascunhoNoBanco com cidade velha
it("o segundo ponto no mesmo segundo (limite): 503 e o primeiro intacto", …); // Review Focus 1
it("PUT do campo cidade é 400, nada gravado", …);
it("o condicao.coords não consulta o reverse", …); // nominatimDeTeste.pontos === []
// route-admin-publicar.test.ts
it("chave provisória nunca vai ao ar: 409 com a frase da trava, nada em ficha_versoes", …); // Review Focus 4
it("chave provisória sem trava nenhuma: 409 ENDERECO_AINDA_NAO_SAIU", …); // ocupante sumiu depois
// route-contribuir-rascunho.test.ts
it("o ponto dela grava ponto, chuva, cidade e o slug de dentro nome-cidade", …);
it("cidade que não sai: 503, nada gravado", …);
it("§2.3.0 dela: colisão no ponto grava; o publicar dela responde NOME_JA_EM_USO", …);
// campos-da-pessoa.test.ts
it("a cidade falta pra publicar mesmo fora da lista que ela escreve", () => expect(obrigatoriosDaPessoaFaltando({ … sem cidade })).toContain("cidade"));
// admin-formulario-de-lugar.test.tsx
it("a cidade não é pergunta, e o ponto é a 2ª", () => { expect(ORDEM[1]).toBe("trajeto.waypoints.0.lat"); expect(ORDEM).not.toContain("cidade"); });
// (o caso existente "ORDEM é exatamente o conjunto de perguntas do registro" continua, sem mudar)
// formulario-da-pessoa.test.tsx / admin-tela-de-publicar.test.tsx
it("a falta da cidade, na tela de publicar dela, leva à pergunta do ponto (posição 2)", …);
```

- [ ] **Step 2: Rodar** — os arquivos acima → FAIL.

- [ ] **Step 3: Implementar** as decisões acima. No PUT do painel, as saídas de "ficar/mudar" vivem numa função local da rota (não exportada). Atualize os docblocks dos dois PUTs, do `moverRascunho` ("acompanha o nome e a cidade" → "o nome e a cidade do PONTO"), de `camposQueSaoPergunta`, de `ORDEM` e de `ORDEM_DA_PESSOA`.

- [ ] **Step 4: Rodar** — os mesmos → PASS; e `npx vitest run tests/app/admin-formulario-de-lugar.test.tsx -t "questionário"` → PASS (o guarda do doc).

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | cidade que não sai grava o ponto mesmo assim (painel) | "cidade que não sai (%s)…" |
| M2 | idem, dela | "cidade que não sai: 503, nada gravado" (dela) |
| M3 | colisão no ponto volta a 409 (painel) | "§2.3.0 … o PONTO e a CIDADE gravam" |
| M4 | o publicar do painel sem o portão da chave | "chave provisória nunca vai ao ar" |
| M5 | colisão no ponto tenta o `nome-cidade` mesmo assim | "§2.3.0 … na chave provisória" — o caso põe o lugar de MESMO par morando num endereço que NÃO é `S` (ex.: `slugDoNome(NOME)`), então `S` está livre e só a regra "colidiu, não tenta" deixa o rascunho na provisória |
| M6 | "ficar" numa chave `nome-cidade` falsa regrava ali | "corrigir o ponto pra uma cidade onde o par colide…" |
| M7 | ponto dela confere `ENDERECO_LIVRE` | "§2.3.0 dela: colisão no ponto grava" |
| M8 | `saiDoPonto` ignorado em `camposQueSaoPergunta` | "a cidade não é pergunta…" e "ORDEM é exatamente…" |
| M9 | `obrigatoriosDaPessoaFaltando` sem a cidade | "a cidade falta pra publicar…" |
| M10 | o reverse roda em todo ponto (e no `condicao.coords`) | "o condicao.coords não consulta o reverse" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/api/admin/rascunho/route.ts src/app/api/contribuir/rascunho/route.ts src/app/api/admin/publicar/route.ts src/lib/porta-de-publicar.ts src/lib/rascunho.ts src/lib/par-de-lugar.ts src/lib/campos-da-ficha.ts src/app/admin/novo/perguntas.ts src/app/contribuir/perguntas.ts src/lib/campos-da-pessoa.ts src/app/contribuir/novo/publicar/page.tsx docs/questionario-ficha.md tests/api/route-admin-rascunho.test.ts tests/api/route-contribuir-rascunho.test.ts tests/api/route-admin-publicar.test.ts tests/api/route-contribuir-publicar.test.ts tests/lib/campos-da-pessoa.test.ts tests/app/admin-formulario-de-lugar.test.tsx tests/app/formulario-da-pessoa.test.tsx tests/app/admin-tela-de-publicar.test.tsx tests/lib/questionario.test.ts
git commit -m "feat(lugar-novo): a cidade sai do ponto pelo Nominatim; colisao no ponto grava e trava o publicar"
```

---

### Task 4: O aviso do par nas perguntas, e o ponto do lugar no ar dela

**Files:**
- Create: `src/app/admin/AvisoDoPar.tsx` (servidor — sem `"use client"`)
- Modify: `src/lib/par-de-lugar.ts` (novo `travaDaPessoa`), `src/lib/porta-da-pessoa.ts` (frase nova)
- Modify: `src/app/admin/novo/page.tsx:74-109`, `src/app/contribuir/novo/page.tsx:40-69`, `src/app/admin/FormularioDeLugar.tsx:162-239` (prop `aviso`, desenhada logo depois da `Pergunta`)
- Modify: `src/app/api/contribuir/lugar/route.ts:62-65` (o ponto regrava a cidade sem travar)
- Test: `tests/app/admin-formulario-de-lugar.test.tsx`, `tests/app/contribuir-telas.test.tsx`, `tests/api/route-contribuir-lugar.test.ts`, `tests/api/route-admin-ficha.test.ts`, `tests/lib/colisao-do-par.test.ts`, `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI`)

**Interfaces:**
- Consumes: `travaDoPainel` (Task 3), `cidadeDoPonto`, `colisaoDoPar`, `versaoAtual`, `enderecoNovoDe`.
- Produces:
  ```ts
  // src/lib/par-de-lugar.ts — o par dela colide com LUGAR, ou o endereço é de um lugar / antigo
  export async function travaDaPessoa(doc: string): Promise<boolean>;
  // src/lib/porta-da-pessoa.ts — PENDENTE; não nomeia ninguém (I3)
  export const NOME_EXISTE_NA_CIDADE = "Já existe no BatePerna um lugar com esse nome nessa cidade. Você pode seguir respondendo, mas pra publicar o nome precisa ser outro.";
  // src/app/admin/AvisoDoPar.tsx — PENDENTE
  export const CORRIGIR_O_NOME = "Corrigir o nome";
  export default function AvisoDoPar(p: { frase: string; corrigir: string }): JSX.Element; // <p role="status"> + <a href={corrigir}>
  // FormularioDeLugar — a página de servidor passa o <AvisoDoPar> pronto (ReactNode atravessa a fronteira; função não)
  FormularioDeLugar(p: { …; aviso?: ReactNode })
  ```

Decisões do planejador:
- **Onde o aviso mora:** em TODA tela de pergunta enquanto a trava existe, DEPOIS da pergunta (a pergunta fica no topo, melhoria 5), calculado na página de servidor a cada carga — nada volta no corpo do PUT. Painel: a frase do painel (`travaDoPainel`, que nomeia quem ocupa, como toda frase do painel); dela: `NOME_EXISTE_NA_CIDADE`. O link leva à pergunta do nome (posição 1) — na Task 7 ele passa a `ROTAS[onde].corrigir(slug, 1)`.
- **O lugar no ar dela (spec §2.4):** depois de `pontoDaPessoa`, `cidadeDoPonto`; achou → `aplicarCampo(novo, "cidade", cidade)`; falhou → o ponto grava e a cidade de antes fica. Sem checagem de par ali. A `FichaInteira` do João (`/api/admin/ficha`) não consulta nada — há caso provando.

- [ ] **Step 1: Testes que falham**

```ts
it("painel: com o par colidindo, a pergunta mostra a frase de quem ocupa e o link do nome, DEPOIS da pergunta", …);
// texto = parDeLugar(nomeComCidade(NOME, CIDADE)); href = /admin/novo?slug=<k>&p=1;
// compareDocumentPosition: pergunta antes do aviso
it("painel: sem colisão, nenhum aviso", …);
it("dela: a frase dela, que não nomeia o lugar que já existe", …); // not.toContain(nome do lugar do acervo)
it("travaDaPessoa: endereço antigo de outro lugar também trava", …);
it("o ponto do lugar no ar dela regrava a cidade", …);
it("o ponto do lugar no ar dela com o reverse fora: grava o ponto, a cidade de antes fica", …);
it("o ponto da FichaInteira do João não consulta o Nominatim", …); // route-admin-ficha: nominatimDeTeste.pontos === []
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Frases exportadas em `CUNHADAS_AQUI`. **Step 4: Rodar** → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | o aviso da pessoa usa `travaDoPainel` | "dela: a frase dela, que não nomeia…" |
| M2 | `travaDaPessoa` sem o endereço antigo | "travaDaPessoa: endereço antigo…" |
| M3 | reverse que falha no lugar no ar dela responde 503 | "…com o reverse fora: grava o ponto…" |
| M4 | aviso antes da pergunta | "…DEPOIS da pergunta" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/admin/AvisoDoPar.tsx src/app/admin/FormularioDeLugar.tsx src/lib/par-de-lugar.ts src/lib/porta-da-pessoa.ts src/app/admin/novo/page.tsx src/app/contribuir/novo/page.tsx src/app/api/contribuir/lugar/route.ts tests/app/admin-formulario-de-lugar.test.tsx tests/app/contribuir-telas.test.tsx tests/api/route-contribuir-lugar.test.ts tests/api/route-admin-ficha.test.ts tests/lib/colisao-do-par.test.ts tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(lugar-novo): o aviso de nome que ja existe na cidade, e o ponto do lugar dela regrava a cidade"
```

---

### Task 5: A busca no mapa — move o mapa, nunca grava; e a cidade embaixo do mapa

**Files:**
- Create: `src/app/api/admin/buscar-no-mapa/route.ts`, `src/app/api/contribuir/buscar-no-mapa/route.ts`, `src/app/admin/campos/BuscaNoMapa.tsx`
- Modify: `src/app/admin/campos/gravar.ts:31-49` (`PortaDoEditor` ganha `buscarEm`), `src/app/admin/campos/tipos.ts` (`CampoNaTela.cidade?`, `VistaNaTela.origem`), `src/app/admin/campos/EditorCoordenada.tsx:88-91,467-548`, `src/app/admin/campos/palavras.ts`, `src/app/admin/novo/enderecos.ts` (`buscaApi`), `src/app/admin/FormularioDeLugar.tsx:194-199`, `src/app/contribuir/EdicaoDaPessoa.tsx:13`, `src/app/admin/novo/perguntas.ts:191-212` (`naTela` põe `cidade` no `.lat` do ponto 0)
- Modify: `src/lib/vista-do-mapa.ts:43,170-188` (origem `cidade-nao-achada`), `docs/superpowers/specs/2026-09-26-painel-completo-design.md` (§3.2 e R6: nota de 17/10)
- Modify: `src/app/admin/admin.css` (a caixa e a lista da busca)
- Test: `tests/api/route-buscar-no-mapa.test.ts` (novo), `tests/app/admin-editor-coordenada.test.tsx`, `tests/lib/vista-do-mapa.test.ts`, `tests/deploy/exports-de-rota.test.ts`, `tests/app/admin-editores-de-campo.test.tsx`

**Interfaces:**
- Consumes: `buscarNoMapa`, `TETO_DA_BUSCA`, `AchadoNoMapa` (Task 1), `MAPA_ZOOM_EDITOR`.
- Produces:
  ```ts
  // GET /api/admin/buscar-no-mapa?q=  e  GET /api/contribuir/buscar-no-mapa?q=
  //   200 AchadoNoMapa[]  ·  q vazio/espaços → 200 [] sem pedir  ·  q > TETO_DA_BUSCA → 400 mudo
  //   falha → 503 com BUSCA_NAO_SAIU  ·  admin: 404/401 de sempre  ·  dela: portaDaPessoa(agora, "abrir")
  // gravar.ts
  PortaDoEditor: { gravarEm; previa; depoisDeGravar; recarregarSe401; buscarEm: string | null } // padrão null
  // tipos.ts
  CampoNaTela.cidade?: string;                       // só no `.lat` do ponto 0, o que o doc tem
  VistaNaTela.origem: "ponto" | "cidade" | "acervo" | "cidade-ambigua" | "cidade-nao-achada";
  // BuscaNoMapa.tsx
  export default function BuscaNoMapa(p: { buscarEm: string; recarregarSe401: boolean; aoEscolher: (centro: { lat: number; lng: number }) => void }): JSX.Element;
  // enderecos.ts: ROTAS.painel.buscaApi = "/api/admin/buscar-no-mapa"; ROTAS.contribuir.buscaApi = "/api/contribuir/buscar-no-mapa"
  // palavras.ts — todas PENDENTE
  export const BUSCAR = "Buscar";
  export const BUSCANDO = "Buscando…";
  export const ROTULO_DA_BUSCA = "Cidade ou nome do lugar";
  export const NENHUM_ACHADO = "Não achei nada com esse nome. Tente a cidade.";
  export const BUSCA_NAO_SAIU = "Não consegui buscar agora. Tente de novo daqui a pouco, ou ache o lugar mexendo no mapa.";
  export const CIDADE_DEPOIS_DE_SALVAR = "A cidade sai do ponto quando você salvar.";
  // EditorCoordenada.tsx — PENDENTE (o rótulo da cidade embaixo do mapa)
  export const EM_CIDADE = "Fica em:";
  ```
  (`BUSCA_NAO_SAIU` mora em `palavras.ts` e é importada pelas duas rotas — `palavras.ts` é puro.)

Decisões do planejador:
- **Quando a caixa aparece:** `buscarEm !== null` E o documento não tem ponto (`inicial === null`) — fica enquanto a pergunta não tem ponto salvo, mesmo depois de um toque. `FichaInteira` não monta provedor (padrão `null`) e a edição dela no ar passa `null`: sem busca nos dois.
- **A caixa é um `<form>`** com `<input type="search">` e o botão: o Enter e o botão disparam UMA busca; `onChange` só muda estado. Lista de botões, um por achado (`display_name`); escolher → `aoEscolher` → `setVista({centro, z: MAPA_ZOOM_EDITOR})` — nunca `setAtual`, nunca `setZDoPin`. A lista some ao escolher.
- **A vista sem cidade não diz "não achei":** `vistaDaCidade` devolve `origem: "acervo"` quando o documento não TEM cidade (nada foi procurado) e `"cidade-nao-achada"` quando procurou e não achou; `VISTA_SEM_CIDADE` (LIDA, texto sem mudança) só aparece na segunda. Rascunho novo nunca tem cidade antes do ponto — sem isto, toda pergunta do ponto diria "Não achei a cidade no mapa".
- **A cidade embaixo do mapa (melhoria 4b):** com `campo.cidade` presente (só as telas de lugar novo e a edição dela) o `coord-atual` mostra `${EM_CIDADE} ${cidade}` enquanto o pin é o ponto salvo (`!mudou`), e `CIDADE_DEPOIS_DE_SALVAR` quando o pin mudou ou é novo; sem `campo.cidade` (a `FichaInteira` do João), os números de hoje — é lá que ele confere o número contra o que sabe (docblock `:85-86`).
- **Comentário `EditorCoordenada.tsx:88-91`** e a nota no desenho de 26/09: "a busca existe desde 17/10 e só MOVE o mapa; o ponto continua vindo do dedo de quem sabe — o motivo de 26/09 (a cachoeira a 5 km) fica, a regra muda".

- [ ] **Step 1: Testes que falham**

```ts
// tests/api/route-buscar-no-mapa.test.ts (dublê do Nominatim; SONDA 2 do Clerk pra rota dela)
it("painel: 404 desligado, 401 sem sessão, sem chamar a busca", …); // nominatimDeTeste.buscas === []
it("dela: 401 sem sessão do Clerk, sem chamar a busca", …);
it("q vazio ou só espaços: [] sem chamar", …);
it("o teto: q acima de TETO_DA_BUSCA é 400 sem chamar", …); // Review Focus 2
it("os achados, como o serviço deu", …);
it("falha: 503 com BUSCA_NAO_SAIU", …);
// admin-editor-coordenada.test.tsx
it("digitar não busca: só o botão (ou o Enter) chama a rota, uma vez", async () => {
  fireEvent.change(caixa, { target: { value: "Lugar Marcador" } });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.submit(caixa.closest("form")!);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toBe("/api/admin/buscar-no-mapa?q=Lugar%20Marcador");
});
it("🔴 escolher um achado move o mapa e NÃO grava ponto", async () => {
  … clicar no achado
  expect(container.querySelector("[data-pin]")).toBeNull();
  expect(container.querySelector("[data-salvar]")).toBeNull();
  expect(fetch.mock.calls.filter(([, i]) => i?.method === "PUT")).toEqual([]);
  // os tiles agora são do zoom de pôr o pin, em volta do achado:
  expect(urlsDosTiles()).toEqual(tilesEsperados({ lat: -8.1, lng: -35.2 }, MAPA_ZOOM_EDITOR));
});
it("depois de escolher, um toque no mapa liga o Salvar (o zoom em que o toque vale)", …);
it("sem achado: NENHUM_ACHADO; serviço fora: BUSCA_NAO_SAIU — frases diferentes", …);
it("401 na busca dela recarrega; no painel é a frase de falha", …); // Review Focus 3
it("sem buscarEm (a FichaInteira), não há caixa", …);
it("com ponto salvo, não há caixa", …);
it("a cidade embaixo do mapa: Fica em: <cidade> com o pin salvo; a frase de salvar depois de mexer", …);
it("sem campo.cidade, os números de hoje", …);
// vista-do-mapa.test.ts
it("documento sem cidade: origem acervo; cidade não achada: cidade-nao-achada", …);
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Frases exportadas em `CUNHADAS_AQUI`; as duas rotas entram no enumerador de `tests/deploy/exports-de-rota.test.ts` (se ele lê do disco, conferir que leu). **Step 4: Rodar** → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | `aoEscolher` também chama `aoMover(centro, MAPA_ZOOM_EDITOR)` | "🔴 escolher um achado … NÃO grava ponto" |
| M2 | a busca no `onChange` | "digitar não busca…" |
| M3 | a rota sem o teto | "o teto…" |
| M4 | escolher abre no zoom da vista de antes | "depois de escolher, um toque … liga o Salvar" |
| M5 | `vistaDaCidade` volta a `acervo` nas duas | "documento sem cidade: origem acervo…" |
| M6 | a rota dela usa `portaDaPessoa` depois de chamar a busca | "dela: 401 … sem chamar a busca" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/api/admin/buscar-no-mapa/route.ts src/app/api/contribuir/buscar-no-mapa/route.ts src/app/admin/campos/BuscaNoMapa.tsx src/app/admin/campos/gravar.ts src/app/admin/campos/tipos.ts src/app/admin/campos/EditorCoordenada.tsx src/app/admin/campos/palavras.ts src/app/admin/novo/enderecos.ts src/app/admin/FormularioDeLugar.tsx src/app/contribuir/EdicaoDaPessoa.tsx src/app/admin/novo/perguntas.ts src/lib/vista-do-mapa.ts src/app/admin/admin.css docs/superpowers/specs/2026-09-26-painel-completo-design.md tests/api/route-buscar-no-mapa.test.ts tests/app/admin-editor-coordenada.test.tsx tests/lib/vista-do-mapa.test.ts tests/deploy/exports-de-rota.test.ts tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(mapa): busca com botao que so move o mapa, e a cidade do ponto embaixo dele"
```

---

### Task 6: Opção com nome de gente, e o iPhone sem zoom sozinho (melhorias 2 e 3)

**Files:**
- Create: `src/lib/rotulos-das-opcoes.ts`
- Modify: `src/lib/semana.ts:56-64` (`NOME` exportado como `NOME_DO_DIA`), `src/app/admin/campos/tipos.ts` (`CampoNaTela.rotulos?`), `src/app/admin/campos/EditorLista.tsx:92,109`, `src/app/admin/novo/perguntas.ts:191-200`, `src/app/admin/FichaInteira.tsx:462`, `src/app/admin/admin.css:141-183`
- Test: `tests/lib/rotulos-das-opcoes.test.ts` (novo), `tests/app/admin-editores-de-campo.test.tsx`, `tests/app/admin-formulario-de-lugar.test.tsx` (describe `:1311`, CSS)

**Interfaces:**
- Produces:
  ```ts
  // src/lib/rotulos-das-opcoes.ts — puro, sem zod
  // PENDENTE
  export const ROTULO_GRATIS = "Grátis";
  // PENDENTE
  export const ROTULO_PAGO = "Pago";
  export function rotulosDe(caminho: string): Readonly<Record<string, string>> | undefined; // custo.tag → {gratis, pago}; dias → NOME_DO_DIA; resto undefined
  // tipos.ts
  CampoNaTela.rotulos?: Readonly<Record<string, string>>; // valor gravado → palavra da tela
  ```

Decisões do planejador:
- **Rótulos dos dias = `NOME_DO_DIA`** (`semana.ts`), o "domingo…sábado" que o carimbo público já mostra: uma fonte só pro nome do dia. Vão ao pacote como uso NOVO de palavra existente. Grátis/Pago são frases novas. Piso e severidade ficam como estão (fora da spec).
- **O valor gravado não muda:** `<option value={o}>{rotulos?.[o] ?? o}</option>` e `<input value={o}>` com o rótulo no texto do `<label>`.
- **Montado no servidor nos dois lugares que montam `CampoNaTela`** (`naTela` e `FichaInteira`), pra a ficha no ar não falar outra língua.
- **CSS:** `.adm-editor-caixa`, `.adm-editor-escolha`, `.adm-editor-hora`, `.adm-editor-numero`: `font-size: 1rem` (o iOS dá zoom abaixo de 16px). `.adm-editor-opcao`: `min-height: 44px` (o dos botões de zoom, `:222`). Também a caixa nova da busca (Task 5) — confira.

- [ ] **Step 1: Testes que falham**

```ts
it("custo.tag mostra Grátis/Pago e grava gratis/pago", async () => {
  render(<EditorLista campo={{ …, opcoes: ["gratis", "pago"], rotulos: rotulosDe("custo.tag") }} … />);
  expect(screen.getByRole("option", { name: ROTULO_GRATIS })).toHaveValue("gratis");
  … escolher "Pago", Salvar → corpo { campo: "custo.tag", valor: "pago" }
});
it("dias mostram o nome do dia e gravam dom…sab na ordem do registro", …);
it("toda opção de custo.tag e de dias tem rótulo (nenhuma cai no valor cru)", () => {
  for (const c of ["custo.tag", "dias"]) for (const o of campoPorCaminho(c)!.opcoes!) expect(rotulosDe(c)![o]).toBeTruthy();
});
it("a pergunta de dias do lugar novo desce com os rótulos", …); // montarPerguntas
it("as caixas de responder têm letra de 1rem (sem zoom no iPhone)", () => {
  for (const s of [".adm-editor-caixa", ".adm-editor-escolha", ".adm-editor-hora", ".adm-editor-numero"]) expect(valorDe(css, s, "font-size")).toBe("1rem");
});
it("a linha de opção tem 44px de toque", () => expect(valorDe(css, ".adm-editor-opcao", "min-height")).toBe("44px"));
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** `ROTULO_GRATIS`/`ROTULO_PAGO` moram em `src/lib` (não entram em `CUNHADAS_AQUI`, que é de `src/app/admin`); confira se o caso de completude do cerco os exige mesmo assim e siga o que ele disser. **Step 4: Rodar** → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | `value={rotulos[o]}` (grava a palavra) | "custo.tag mostra Grátis/Pago e grava gratis/pago" |
| M2 | `rotulosDe("dias")` sem `sab` | "toda opção … tem rótulo" |
| M3 | `naTela` sem `rotulos` | "a pergunta de dias … desce com os rótulos" |
| M4 | `.adm-editor-hora` volta a `.95rem` | "as caixas … 1rem" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/lib/rotulos-das-opcoes.ts src/lib/semana.ts src/app/admin/campos/tipos.ts src/app/admin/campos/EditorLista.tsx src/app/admin/novo/perguntas.ts src/app/admin/FichaInteira.tsx src/app/admin/admin.css tests/lib/rotulos-das-opcoes.test.ts tests/app/admin-editores-de-campo.test.tsx tests/app/admin-formulario-de-lugar.test.tsx
git commit -m "feat(painel): opcao com nome de gente, e letra de 1rem nas caixas do celular"
```

---

### Task 7: O formulário — a pergunta primeiro, nenhum toque perde texto, e o corrigir volta à revisão (melhorias 1 e 5)

**Files:**
- Modify: `src/app/admin/FormularioDeLugar.tsx:120-239`, `src/app/admin/campos/BotaoDesfazer.tsx`, `src/app/admin/campos/gravar.ts` (contexto novo), `src/app/admin/novo/enderecos.ts` (`corrigir`), `src/app/admin/novo/page.tsx`, `src/app/contribuir/novo/page.tsx` (lê `volta`), `src/app/admin/AvisoDoPar.tsx` (link por `corrigir`), `src/app/admin/admin.css`
- Test: `tests/app/admin-formulario-de-lugar.test.tsx` (describes `:638`, `:701`, `:762`), `tests/app/formulario-da-pessoa.test.tsx`, `tests/app/contribuir-telas.test.tsx`, `tests/app/admin-editores-de-campo.test.tsx`

**Interfaces:**
- Consumes: `ROTAS` (Task 5 já pôs `buscaApi`).
- Produces:
  ```ts
  // gravar.ts
  export const AvisoDeMudanca: React.Context<((mudou: boolean) => void) | null>; // padrão null
  // BotaoDesfazer.tsx: useEffect(() => avisar?.(mudou), [mudou, avisar]) ANTES do `return null`
  // enderecos.ts
  ROTAS[onde].corrigir: (slug: string, n: number) => string; // a pergunta N com `&volta=revisao`
  // FormularioDeLugar
  export default function FormularioDeLugar(p: { slug; pergunta; posicao; respondidas; onde?; voltaARevisao?: boolean; aviso?: ReactNode }): JSX.Element;
  // PENDENTE
  export const SEGUIR_SEM_SALVAR = "Seguir sem salvar? O que você escreveu aqui some.";
  // PENDENTE
  export const VOLTAR_A_REVISAO = "Voltar à revisão";
  ```

Decisões do planejador:
- **Melhoria 1, saída (a)** — a (b) não cumpre o requisito: um "Próxima" discreto continua levando embora o texto. Toda edição chega a `BotaoDesfazer` com `mudou` (os sete editores o usam), então ele avisa o formulário por `AvisoDeMudanca` — um lugar só. Com algo não salvo, **"Anterior", "Próxima", "Voltar à revisão" e "Pular"** pedem o segundo toque no molde do `BotaoDesistir` (o rótulo do toque vira `SEGUIR_SEM_SALVAR`; o segundo toque navega). Sem nada não salvo, um toque, como hoje. Fora do provedor (a `FichaInteira`), nada muda.
- **Melhoria 5:** ordem nova = `posicaoNaTela` ("Pergunta N de M", LIDA) → a pergunta → o aviso do par (Task 4) → a navegação → `AVISO_RASCUNHO` (**no rodapé**, em toda pergunta — some do topo) → `BotaoDesistir` no fim. A fileira de saltos (`data-testid="saltos"`) é APAGADA. `SEM_RESPOSTA` fica (a revisão da Task 8 o usa); `RESPONDIDA` é apagada se nada mais a usar (`grep -rn RESPONDIDA src tests`), e o relatório diz qual dos dois.
- **"Depois de corrigir, o seguir volta pra revisão":** com `voltaARevisao`, `depoisDeGravar` dá `rotas.publicar(slugDevolvido)`, o "Pular" leva à revisão, e a navegação mostra só `VOLTAR_A_REVISAO` (sem Anterior/Próxima). As páginas leem `volta === "revisao"` da URL.

- [ ] **Step 1: Testes que falham**

```ts
it("🔴 texto digitado e Próxima: o 1º toque não sai e pede; o 2º sai", async () => {
  digitar("promessa", "texto");
  fireEvent.click(screen.getByRole("link", { name: PROXIMA }));
  expect(location.assign).not.toHaveBeenCalled();           // e o clique teve preventDefault
  expect(screen.getByRole("link", { name: SEGUIR_SEM_SALVAR })).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: SEGUIR_SEM_SALVAR }));
  expect(navegou()).toBe(ir(posicao + 1));
});
it("sem texto mudado, Próxima sai num toque só", …);
it("pular com texto não salvo pede o segundo toque", …);  // Review Focus 5
it("Anterior com o pin mexido e não salvo pede o segundo toque", …); // a mudança do mapa também conta
it("Desfazer tira o pedido: Próxima volta a sair num toque", …);
it("a pergunta vem primeiro; o aviso de rascunho e o Desistir, no fim", () => {
  const [pergunta, aviso, desistir] = [q("pergunta-…"), screen.getByText(AVISO_RASCUNHO), screen.getByRole("button", { name: DESISTIR })];
  expect(pergunta.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(aviso.compareDocumentPosition(desistir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it("não há mais fileira de saltos, só 'Pergunta N de M'", () => expect(screen.queryByTestId("saltos")).toBeNull());
it("com volta=revisao, salvar leva à revisão pelo slug devolvido (o do painel pode mudar)", …);
it("com volta=revisao, a navegação é só 'Voltar à revisão'", …);
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Frases novas em `CUNHADAS_AQUI`. **Step 4: Rodar** → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | `BotaoDesfazer` não avisa (`useEffect` apagado) | "🔴 texto digitado e Próxima…" |
| M2 | o pedido só no "Próxima" | "pular com texto não salvo…" e "Anterior com o pin mexido…" |
| M3 | o 1º toque navega e mostra o pedido depois | "🔴 texto digitado e Próxima…" (`assign` não chamado) |
| M4 | `voltaARevisao` ignorado no `depoisDeGravar` | "com volta=revisao, salvar leva à revisão…" |
| M5 | `depoisDeGravar` da revisão usa o `slug` da tela | idem (no painel, o ponto muda a chave) |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/admin/FormularioDeLugar.tsx src/app/admin/campos/BotaoDesfazer.tsx src/app/admin/campos/gravar.ts src/app/admin/novo/enderecos.ts src/app/admin/novo/page.tsx src/app/contribuir/novo/page.tsx src/app/admin/AvisoDoPar.tsx src/app/admin/admin.css tests/app/admin-formulario-de-lugar.test.tsx tests/app/formulario-da-pessoa.test.tsx tests/app/contribuir-telas.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(lugar-novo): a pergunta primeiro, nenhum toque perde texto, e corrigir volta a revisao"
```

---

### Task 8: A revisão antes de publicar — toda pergunta, uma por linha, com Corrigir (ponto 3 dele)

**Files:**
- Create: `src/app/admin/novo/revisao.ts` (servidor), `src/app/admin/RevisaoDoLugar.tsx` (servidor), `src/app/admin/MapinhaDoPonto.tsx` (servidor)
- Modify: `src/app/admin/TelaDePublicar.tsx:56-139` (sai `faltam`/`Falta`/`TITULO_FALTA`), `src/app/admin/novo/publicar/page.tsx:67-86`, `src/app/contribuir/novo/publicar/page.tsx:41-69`, `src/app/admin/admin.css`
- Test: `tests/app/admin-tela-de-publicar.test.tsx`, `tests/app/revisao-do-lugar.test.tsx` (novo), `tests/app/contribuir-telas.test.tsx`, `tests/app/admin-editores-de-campo.test.tsx`

**Interfaces:**
- Consumes: `montarPerguntas`/`montarPerguntasDaPessoa`, `ROTAS[onde].corrigir` (Task 7), `travaDoPainel`/`travaDaPessoa` (Tasks 3-4), `rotulos` (Task 6), `rotuloDe`, `rotuloFaixaCurta`, `faixasDe`, `SIM`/`NAO`, `PULADA`, `SEM_RESPOSTA`, `tilesParaCaixa`/`urlTile` (`src/lib/mapa.ts`).
- Produces:
  ```ts
  // src/app/admin/novo/revisao.ts — dado simples, nada de função na linha
  export type LinhaDaRevisao = {
    caminho: string; pergunta: string;
    estado: "respondida" | "falta" | "pulada";
    resposta: string | null;              // texto pronto; null no ponto e sem resposta
    ponto: { lat: number; lng: number } | null;
    corrigir: string;                     // ROTAS[onde].corrigir(slug, n)
    aviso: string | null;                 // só na linha do nome, com a trava
  };
  export function respostaNaTela(p: PerguntaNaTela): string | null;
  export function montarRevisao(perguntas: readonly PerguntaNaTela[], doc: unknown,
    o: { corrigir: (n: number) => string; aviso: string | null }): LinhaDaRevisao[];
  // RevisaoDoLugar.tsx — PENDENTE nas duas
  export const TITULO_REVISAO = "Confira tudo antes de publicar:";
  export const CORRIGIR = "Corrigir";
  export default function RevisaoDoLugar(p: { linhas: readonly LinhaDaRevisao[] }): JSX.Element;
  // MapinhaDoPonto.tsx
  export default function MapinhaDoPonto(p: { lat: number; lng: number }): JSX.Element;
  ```

Decisões do planejador (spec §8, "o desenho das linhas"):
- **Um componente de SERVIDOR desenha a revisão**, acima da `TelaDePublicar`; ela fica de cliente só com o botão, o aviso de publicar e a lista do que o app cala (que fica: é o preço da honestidade, e a spec não a tira). A lista "falta responder" da `TelaDePublicar` sai — a revisão destaca as linhas `falta` com o mesmo destino. O guarda de `:400-420` fica intocado e verde.
- **As linhas, na ordem das perguntas da tela;** a **cidade** entra logo depois da linha do ponto, com `pergunta = rotuloDe("cidade")` ("A cidade", LIDA), `corrigir` = o do ponto, e `falta` quando ausente.
- **Estados:** obrigatória sem resposta → `falta`, marcada com `SEM_RESPOSTA` (LIDA) e destacada; opcional sem resposta → `pulada`, com `PULADA` (LIDA) — no documento pular e nunca responder são a mesma ausência, e é isso que a pessoa precisa ler.
- **A resposta na tela:** prosa → o texto; lista → os `rotulos` (Task 6) juntados com ", "; booleano → `SIM`/`NAO`; número → o número; faixas → `rotuloFaixaCurta(faixasDe(valor))`; coord → `ponto` (mapinha, nunca número).
- **O mapinha é componente novo, não o `MapaEstatico`:** o de lá é estilizado só debaixo de `.bp` em `ficha.css` (que o painel não carrega) e diz "Sem o mapa, vale a coordenada abaixo." — falso numa linha sem coordenada. `MapinhaDoPonto` usa as mesmas funções de `src/lib/mapa.ts`, um pin fixo no meio, o crédito "© OpenStreetMap", nenhum JS, só os tiles da sua vista.
- **O Publicar segue a régua de hoje:** nunca some nem trava por falta; a porta recusa com frase.

- [ ] **Step 1: Testes que falham**

```ts
it("toda pergunta da tela vira uma linha, na ordem, e a cidade logo depois do ponto", () => {
  const l = montarRevisao(montarPerguntas(DOC), DOC, { corrigir: (n) => `/c/${n}`, aviso: null });
  expect(l.map((x) => x.caminho)).toEqual([ORDEM[0], ORDEM[1], "cidade", ...ORDEM.slice(2)]);
  expect(l.find((x) => x.caminho === "cidade")!.corrigir).toBe(l[1].corrigir);
});
it("o nome tem Corrigir pra pergunta 1", …);
it("o ponto é mapinha, nunca número", () => {
  render(<RevisaoDoLugar linhas={…} />);
  expect(linha("trajeto.waypoints.0.lat").textContent).not.toMatch(/-?\d+\.\d{3,}/);
  expect(linha("trajeto.waypoints.0.lat").querySelector("img")).toBeTruthy();
});
it("obrigatória sem resposta: falta, destacada, com o destino de hoje; opcional: pulada", …);
it("custo.tag e dias aparecem pelo rótulo, nunca pelo valor cru", …);
it("com a trava, o aviso vai na linha do nome", …);
it("a página do painel: a revisão e o botão; a lista 'falta responder' saiu", …);
it("a página dela: as linhas dela, cada Corrigir pelas ROTAS dela com volta=revisao", …);
it("o Publicar continua lá com perguntas faltando", …);
// e o caso existente "a TelaDePublicar não alcança o registro…" continua verde, sem mudança
```

- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** Frases novas em `CUNHADAS_AQUI`; `contracao-honesta` sobre `TITULO_FALTA`, `Falta`, `faltam`. **Step 4: Rodar** → PASS.

- [ ] **Step 5: Mutações**

| # | Mutação | Morre em |
|---|---|---|
| M1 | a linha da cidade some | "…e a cidade logo depois do ponto" |
| M2 | o `corrigir` da cidade aponta pra posição da cidade (n+1) | idem |
| M3 | o ponto mostra `${lat}, ${lng}` | "o ponto é mapinha, nunca número" |
| M4 | `respostaNaTela` da lista sem `rotulos` | "custo.tag e dias aparecem pelo rótulo…" |
| M5 | a página dela usa `ROTAS.painel.corrigir` | "a página dela: … ROTAS dela" |
| M6 | a `TelaDePublicar` volta a receber e mostrar `faltam` | "a página do painel: … a lista 'falta responder' saiu" |

- [ ] **Step 6: Portões e commit**

```bash
git add src/app/admin/novo/revisao.ts src/app/admin/RevisaoDoLugar.tsx src/app/admin/MapinhaDoPonto.tsx src/app/admin/TelaDePublicar.tsx src/app/admin/novo/publicar/page.tsx src/app/contribuir/novo/publicar/page.tsx src/app/admin/admin.css tests/app/admin-tela-de-publicar.test.tsx tests/app/revisao-do-lugar.test.tsx tests/app/contribuir-telas.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(lugar-novo): a revisao antes de publicar, toda pergunta com Corrigir"
```

---

### Task 9: Toda frase nova marcada — e a PARADA pro pacote de frases

**Files:**
- Modify: `tests/lib/frases-da-rodada-marcadas.test.ts` (a lista à mão `ARQUIVOS` ganha os módulos NOVOS desta rodada que têm frase: `src/app/admin/AvisoDoPar.tsx`, `src/app/admin/RevisaoDoLugar.tsx`, `src/lib/rotulos-das-opcoes.ts`)
- (nenhum `src/` muda, a não ser frase que o guarda ache sem marca)

**Interfaces:**
- Consumes: as frases das Tasks 3-8.
- Produces: a LISTA das frases `PENDENTE` desta rodada, no relatório, pro controlador montar o pacote.

- [ ] **Step 1: Ampliar o guarda** e rodar `npx vitest run tests/lib/frases-da-rodada-marcadas.test.ts` → PASS. A varredura por git que ele já tem (`arquivosDaRodada`, base `cc6c467`) pega frase nova em qualquer arquivo de `src/`; se acusar, a correção é MARCAR, nunca tirar a frase do guarda.

Mutação: tire o `// PENDENTE` de cima de `CORRIGIR` → o caso de `RevisaoDoLugar.tsx` fica vermelho; troque o de `BUSCAR` por `// LIDA: palavra dele na conversa` → a varredura acusa "LIDA numa frase que não existia".

- [ ] **Step 2: A lista, pro relatório**

Run: `git diff 70797e6 -- src | grep -n "^+.*PENDENTE"`
Cole, por extenso e agrupado por tela (tela 1 · pergunta do ponto e busca · aviso do par · formulário · revisão · rótulos), cada frase nova com arquivo e constante. Confira POR NOME as que o guarda não lê como constante:
- os rótulos dos dias — uso NOVO de `NOME_DO_DIA` (palavras já no ar no carimbo, agora como opção de resposta);
- `"Buscar"` e `"Corrigir"` — palavras DELE na conversa de 17/10, mas PENDENTE até o pacote (spec §6);
- `NOME_EXISTE_NA_CIDADE` e a frase do painel no aviso do par (que reusa `parDeLugar`/`enderecoDeLugar`, LIDAS, num lugar novo);
- a seção "A cidade" de `docs/questionario-ficha.md`, reescrita (o `<!-- PENDENTE -->` dela).

- [ ] **Step 3: Os portões finais da branch** — `npx vitest run && npx tsc --noEmit && npm run build && node scripts/mutar.mjs` → tudo verde; 42/0/0.

- [ ] **Step 4: Commit**

```bash
git add tests/lib/frases-da-rodada-marcadas.test.ts
git commit -m "test(copy): as frases da rodada de 17/10 nascem marcadas"
```

- [ ] **Step 5: 🛑 PARADA — nada sobe daqui sem o João**

O plano TERMINA aqui. Depois, e fora de qualquer implementador:
1. a revisão final da branch (`superpowers:requesting-code-review`), com `prova-que-trava` e `contracao-honesta` sobre as Tasks 2, 3 e 7;
2. o controlador monta o pacote de frases (artifact, no molde de "Frases de quem manda") com a lista do Step 2, e o João LÊ — "pode seguir" não é "li e aprovei";
3. a onda de copy com as respostas dele;
4. só com o ok dele: `npm run semear` (cria `nominatim_respostas` e `nominatim_vez`) → UM `vercel --prod --yes` → `conferir-no-ar`, com marcador de deploy numa rota que só existe no código novo (`/api/admin/buscar-no-mapa` sem sessão: 404→401 com o painel ligado).

---

## Escolhas do planejador onde a spec deixava ao construtor (§8) ou calava

1. **Chave provisória do painel** = `novaChaveDeRascunho()` (`rascunho_` + 32 hex), a de quem usa: o `_` nunca sai de `slugDoNome` nem existe em `SLUGS_RESERVADOS`. No painel, o `slug` de dentro é sempre a chave. (Task 2)
2. **Invariante nova:** a chave do rascunho do painel é o `nome-cidade` do documento OU provisória; o publicar do painel recusa o resto (`ENDERECO_AINDA_NAO_SAIU` ou a frase da trava). A spec diz "nunca vá ao ar"; o código publicaria NA CHAVE. (Task 3)
3. **Guardar as respostas no banco** (`nominatim_respostas`, 30 dias, JSON cru); falha nunca guardada; "sem município" guardado. (Task 1)
4. **1/s por uma linha do banco num `UPDATE` condicional, e recusa em vez de espera** — vale entre instâncias; a tela diz "tente de novo". (Task 1)
5. **Ordem do reverse:** `municipality` → `city` → `town` → `village`; ponto arredondado a 4 casas na chave E na consulta. (Task 1)
6. **Fora de Pernambuco:** grava o município que vier, sem portão — é o que o app faz hoje com cidade digitada. (Task 1)
7. **Pernambuco primeiro:** `addressdetails=1` e ordenação estável no servidor por `address.state`, em vez de `viewbox` (que exigiria uma caixa de coordenadas escrita no código). (Task 1)
8. **A cidade que não sai: 503 com uma frase só** pras três falhas. (Task 3)
9. **No ponto que colide, nunca tentar o `nome-cidade`**; e sair de uma chave `nome-cidade` que o ponto tornou falsa pra uma provisória. Renomear continua com a régua de hoje (409). (Task 3)
10. **Rascunho do João sem cidade não é gêmeo** — mantém o comportamento efetivo de hoje. (Task 2)
11. **A cidade sai das perguntas por propriedade do registro** (`saiDoPonto`), e sai também de `CAMPOS_DA_PESSOA` (ela não escreve cidade nem no lugar no ar); `PUT campo: "cidade"` vira 400 nas duas rotas de rascunho. (Task 3)
12. **O aviso do par é calculado na página a cada carga**, em toda pergunta, depois da pergunta. (Task 4)
13. **A caixa de busca** só com `buscarEm` no provedor e sem ponto salvo; `<form>` (Enter = botão); achado = `display_name`. (Task 5)
14. **Origem `cidade-nao-achada`** separada de `acervo`, pra a pergunta do ponto não dizer "não achei a cidade" quando nenhuma cidade foi procurada. (Task 5)
15. **A cidade embaixo do mapa** só nas telas de lugar novo e na edição dela; a `FichaInteira` do João mantém os números. (Task 5)
16. **Rótulos dos dias = `NOME_DO_DIA`** (os do carimbo); Grátis/Pago novos; montados nos dois que constroem `CampoNaTela`. (Task 6)
17. **Melhoria 1: saída (a)**, com o segundo toque do `BotaoDesistir`, detectada por `BotaoDesfazer` → `AvisoDeMudanca`, valendo pra Anterior, Próxima, Voltar à revisão e Pular. (Task 7)
18. **Aviso de rascunho no rodapé**, em toda pergunta. (Task 7)
19. **A revisão é um componente de servidor** acima da `TelaDePublicar`; o mapinha é componente novo, não o `MapaEstatico`; obrigatória sem resposta = "sem resposta", opcional = "Pulada". (Task 8)

## Contradições entre a spec e o código, achadas ao planejar

- **O publicar do painel publica NA CHAVE** (`publicarRascunho(getClient(), slug, …)`, `api/admin/publicar/route.ts:113`): com a chave provisória ele poria um lugar no ar em `/rascunho_…`. A spec diz "nunca vá ao ar" sem dizer por qual porta — é a escolha 2.
- **`gemeoSemCidade` diz "Responda primeiro a cidade dele"** (`rascunho.ts:89-90`): contra os rascunhos novos do João (todos sem cidade até o ponto) ela dispararia mandando responder uma pergunta que não existe mais — escolha 10.
- **`VISTA_SEM_CIDADE` ("Não achei a cidade no mapa…", `EditorCoordenada.tsx:150`)** sairia em TODA pergunta do ponto, porque rascunho novo não tem cidade pra achar — escolha 14.
- **`MapaEstatico`** (spec §4 aponta pra ele) só tem estilo debaixo de `.bp` em `ficha.css`, e a linha de reserva dele promete "a coordenada abaixo", que a revisão não mostra — escolha 19.
- **`criarRascunhoDaPessoa` exige endereço** (`db-contribuidor.ts:186-196`, `ENDERECO_LIVRE`) e não há endereço sem cidade — muda pra `string | null`.
- **`CAMPOS_DA_PESSOA` contém `cidade`** e é dela que `obrigatoriosDaPessoaFaltando` tira os obrigatórios: tirar a cidade da lista (ela não digita mais) deixaria de exigir a cidade pra publicar — a Task 3 a exige à parte. E a tela de publicar dela posiciona as faltas por `ORDEM_DA_PESSOA.indexOf`, que daria `0` pra cidade.
- **`docs/questionario-ficha.md:47-67`** diz que a cidade "não é deduzida" e "quem responde é você, pelo painel" — falso pro lugar novo; reescrito na Task 3.
- **"Máximo 1 consulta por segundo no total"** não cabe em memória de processo na Vercel (várias instâncias) — escolha 4.
- **Melhoria 1, saída (b)**: um "Próxima" discreto continua levando o texto embora; só a (a) cumpre o requisito da própria spec — escolha 17.

---

## Self-review

**1. Cobertura da spec.**

| Spec | Tarefa |
|---|---|
| §2 fila nova: tela 1 só nome; ponto 2º; reverse no ponto 0; checagem nome+cidade depois | 2, 3 |
| §2.1 rascunho sem cidade: chave dela opaca; chave provisória do painel e mudança; publicar sem cidade impossível | 2, 3 |
| §2.2 cidade que não sai: não grava; ordem das chaves; fora de PE | 1, 3 |
| §2.3 corrigir o ponto refaz cidade e chave | 3 |
| §2.3.0 saída (b): grava, aviso com corrigir o nome, publicar travado, chave provisória, mutação das duas metades | 3, 4 |
| §2.3.1 gêmeo sem cidade na tela do nome | 2 |
| §2.3.2 rascunhos antigos | 3 |
| §2.4 o que não muda: FichaInteira sem Nominatim; endereço publicado; lugar no ar dela sem travar | 3, 4 |
| §3 busca: caixa + botão, cidade ou lugar, lista, PE primeiro, zoom do toque, sem busca = vista de hoje | 1, 5 |
| §3.2 política: servidor, login, UA, prazo, guardado, 1/s | 1, 5 |
| §3.3 comentário e nota no desenho antigo | 5 |
| §3.4 anti-objetivo | 5 (M1) |
| §4 revisão: todas, em ordem, Corrigir (nome inclusive), cidade → ponto, mapinha, falta/pulada, volta à revisão, servidor monta | 7, 8 |
| §5.1 Próxima | 7 · §5.2 CSS | 6 · §5.3 rótulos | 6 · §5.4 zoom e cidade embaixo | 5 · §5.5 pergunta primeiro | 7 |
| §6 frases PENDENTE, pacote, guarda do questionário | 3, 9 (e cada tarefa) |
| §7 portões, fixtures, mutações nas portas, deploy só com ok | Global Constraints, 1, 3, 5, 7, 9 |

**2. Passos.** Varri "TBD", "tratar bordas", "testes pro resto": nenhum. Os dois pontos que dependem de leitura do implementador estão ditos com o que fazer em cada saída (o enumerador de `exports-de-rota.test.ts`, Task 5; o caso de completude de `CUNHADAS_AQUI` pra frase de `src/lib`, Task 6).

**3. Tipos.** `cidadeDoPonto`/`buscarNoMapa`/`AchadoNoMapa`/`TETO_DA_BUSCA` (1) → 3, 4, 5; `nominatimDeTeste`/`dubleDoNominatim` (1) → 3, 4, 5; `docDoLugarNovo(slug, nome)`, `ehChaveDeRascunho`, `quemOcupaNoPainel`, `criarRascunhoDaPessoa(…, string | null, …)` (2) → 3; `travaDoPainel` (3) → 4, 8; `travaDaPessoa`, `NOME_EXISTE_NA_CIDADE`, `AvisoDoPar` (4) → 7, 8; `PortaDoEditor.buscarEm`, `ROTAS.*.buscaApi`, `CampoNaTela.cidade`, `VistaNaTela.origem` (5); `CampoNaTela.rotulos`, `rotulosDe`, `NOME_DO_DIA` (6) → 8; `AvisoDeMudanca`, `ROTAS.*.corrigir`, `voltaARevisao` (7) → 8; `LinhaDaRevisao`, `montarRevisao` (8). `CIDADE_DO_PONTO_NAO_SAIU` (3) é a mesma nas três rotas que gravam ponto de rascunho.

**4. Review Focus.** As cinco linhas têm caso na tarefa dona: limite no mesmo segundo (1, 3), busca vazia/longa/Enter (5), 401 na busca dela (5), chave provisória na lista e no publicar (2, 3), Pular/Anterior com texto (7).

**5. Proporção.** Spec de 244 linhas; plano de assinaturas, decisões e asserções, sem corpo de função além do SQL da vez de 1/s (o único algoritmo que o teste não determina sozinho).
