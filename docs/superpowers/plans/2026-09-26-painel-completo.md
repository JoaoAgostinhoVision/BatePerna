# O painel completo — o app cumpre a lei — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O João passa a ver e editar os 17 campos de qualquer lugar, criar lugar novo e esconder lugar existente — tudo do celular, sem código, sem deploy e sem mim.

**Architecture:** A lista de um elemento `CAMPOS_EDITAVEIS = ["voz"]` vira um **registro declarado** de campos (caminho, espécie, obrigatoriedade, grupo), travado contra o `fichaSchema` por teste. `aplicarCampo` aprende caminho aninhado, tipo e o estado **"não sei"** (que remove a chave em vez de gravar `""`). As 15 regras de coerência do acervo saem do arquivo de teste e viram **módulo de produção** consumido por dois lados: a porta de escrita do painel e o próprio teste. Esconder um lugar é uma **versão nova** com `oculto = 1`, nunca um `DELETE`. Criar mora numa tabela de rascunho fora de `ficha_versoes`, porque ficha meio preenchida não é ficha e o que entra em `ficha_versoes` já está no ar.

**Tech Stack:** Next.js 15 App Router (server components, `force-dynamic`), TypeScript, Zod (`fichaSchema`), libSQL/Turso (`@libsql/client`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-painel-completo-design.md`

---

## Global Constraints

- 🔴 **NADA SOBE PELA METADE.** Uma branch, um desenho, um deploy. Ordem dele: *"essa tela deve ser tudo programado junto para evitar conflito ou problemas"*. **Nenhuma tarefa deste plano roda `vercel`.** O deploy acontece uma vez, depois da revisão final da branch inteira.
- 🔴 **`npm run build` em TODA tarefa que tocar `src/app/`.** Na rodada passada a branch ficou **sem compilar** com a suíte verde e o `tsc` limpo, e dois assentos de revisão passaram por cima, porque nenhum dispatch pedia build. Não repetir.
- **Toda página que lê banco declara `export const dynamic = "force-dynamic"`.** Foi exatamente o `not-found.tsx` sem isso que quebrou o build da rodada passada.
- **Append-only, sempre.** Nada em `ficha_versoes` é atualizado ou apagado. Esconder grava versão nova. Voltar grava versão nova. A **única** tabela que sobrescreve é `ficha_rascunhos`, e o motivo está na spec §7.2: rascunho nunca afirmou nada.
- **Validação na porta de escrita.** Toda gravação passa pelo `fichaSchema` **e** pelo módulo de coerência (Task 2) antes de virar linha.
- 🔴 **`""` NUNCA chega ao documento.** Caixa vazia é erro de preenchimento; "não sei" é uma ação separada que **remove a chave**. Motivo medido: `src/app/[slug]/page.tsx:105` usa `ficha.custo.curto ?? precoCurto`, e `??` não pega string vazia — gravar `""` deixaria o chip em branco na ficha pública. Spec §4.1.
- 🔴 **Nada é pré-preenchido.** Campo em branco não herda de lugar vizinho, não vem de busca externa, não é redigido por mim nem por IA, e placeholder nunca é uma resposta de exemplo. Spec §4.4.
- 🔴 **Sem busca de endereço em lugar nenhum.** Coordenada entra por pin arrastado à mão. A mesma busca externa já errou um preço pela metade e ofereceu a coordenada de outra cachoeira a 5 km.
- **Banco pendurado não segura o portão.** Toda leitura de banco usa `comPrazo` (`src/lib/cache-rotas.ts`) com **constante nomeada e justificativa escrita**. O molde é `lerAviso` em `src/lib/carimbo-estado.ts:79`.
- **Falha fechada no admin.** Toda rota e página sob `/admin` e `/api/admin/*` devolve **404** quando `lerConfigAdmin(process.env).ligado` é falso, **antes** de olhar sessão. Sessão ruim com painel ligado é **401**. Use os helpers de `@/lib/admin-guarda`.
- **Palavra de tela é escolha do João.** Todo texto novo entra com `// PENDENTE: redação minha, o João ainda não leu` na linha de cima e é listado no relatório da tarefa. Doze frases já esperam a leitura dele; esta rodada **acrescenta** à fila e não apaga marcador nenhum.
- **A voz é de um lugar só.** Nenhum texto literal sobre um lugar específico pode morar num componente que serve os três. Todo componente desta rodada serve os três.
- **Mutação medida.** Toda tarefa lista suas mutações e prova que cada uma **aplicou** com `diff -u` não-vazio antes de rodar a suíte. Mutação que não aplica fica verde e é indistinguível de mutação que sobreviveu.
- **`git add` por caminho, nunca `git add -A`.**

---

## Review Focus

Cinco classes de entrada que a spec implica, que a suíte de hoje não exercita, e que mordem uma pessoa de verdade. Cada uma tem o teste que a prende, na tarefa dona:

1. **Campo opcional esvaziado com `""` em vez de "não sei"** → o chip/piso/horário fica em branco na ficha pública em vez de cair no fallback. A porta tem que **recusar** `""` e oferecer "não sei" como ação distinta. *(Task 1, Step 1; Task 3, Step 1)*
2. **Gravação que passa no `fichaSchema` e mente sobre o lugar** — chip "R$ 5" com valor "R$ 10", prosa dizendo "barro" com `piso: "asfalto"`. O schema aceita os dois; só a coerência pega. *(Task 2, Step 1; Task 3, Step 4)*
3. **Lugar criado do celular com campo obrigatório faltando, ou slug que já existe** → hoje `versoesAtuais` não filtra nada, então a primeira linha gravada vai ao ar. Publicar tem que validar antes de gravar, e recusar slug repetido. *(Task 12, Step 1)*
4. **Esconder o último lugar visível** → a home ficaria afirmando, em silêncio, que não existe trilha nenhuma em Pernambuco. É o mesmo defeito que o C1 da revisão de 26/09 consertou para a tabela vazia, e ele volta por uma porta nova. *(Task 4, Step 1)*
5. **Número de motor gravado como `0`** → janela de chuva zerada é regra que nunca fecha, e o guarda que pega isso hoje é um teste que não roda quando ele edita do celular. *(Task 2, Step 1; Task 7, Step 1)*

---

### Task 1: O registro de campos, e `aplicarCampo` aprende caminho, tipo e "não sei"

**Files:**
- Create: `src/lib/campos-da-ficha.ts`
- Modify: `src/lib/editar-ficha.ts` (reescrita — hoje tem 24 linhas)
- Test: `tests/lib/campos-da-ficha.test.ts` (criar), `tests/lib/editar-ficha.test.ts` (reescrever)

**Interfaces:**
- Consumes: `fichaSchema`, `PISOS`, `SEVERIDADES`, `DIAS` de `@/types/ficha` e irmãos; `loadAll` de `@/lib/ficha` (só em teste).
- Produces:
  - `export type EspecieCampo = "prosa" | "lista" | "booleano" | "hora" | "numero" | "coord"`
  - `export type CampoDaFicha = { caminho: string; especie: EspecieCampo; obrigatorio: boolean; grupo: GrupoDaFicha; opcoes?: readonly string[] }`
  - `export type GrupoDaFicha = "voz" | "chegar" | "custo" | "quando" | "condicao" | "discriminador"`
  - `export const CAMPOS_DA_FICHA: readonly CampoDaFicha[]`
  - `export function campoPorCaminho(c: string): CampoDaFicha | undefined`
  - `export function aplicarCampo(docAtual: string, caminho: string, valor: ValorDeCampo): string`
  - `export function removerCampo(docAtual: string, caminho: string): string` — o "não sei"
  - `export type ValorDeCampo = string | number | boolean | readonly string[] | { lat: number; lng: number }`

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/campos-da-ficha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAMPOS_DA_FICHA, campoPorCaminho } from "@/lib/campos-da-ficha";
import { fichaSchema } from "@/types/ficha";

// 🔴 O GUARDA DESTA TAREFA, e a razão de o registro existir em vez de um `if`.
// Três vezes neste projeto uma lista escrita à mão ficou cega ao que cresceu.
// Aqui o registro é comparado contra a FONTE (o schema), não contra outra
// lista minha: campo novo no schema nasce editável ou nasce justificado.
const FORA_DE_PROPOSITO = new Set(["slug", "modos"]);

describe("o registro cobre o schema", () => {
  it("todo campo de 1º nível do fichaSchema está no registro ou na lista de exceções", () => {
    const doSchema = Object.keys(fichaSchema.shape);
    const cobertos = new Set(CAMPOS_DA_FICHA.map((c) => c.caminho.split(".")[0]));
    const descobertos = doSchema.filter((k) => !cobertos.has(k) && !FORA_DE_PROPOSITO.has(k));
    expect(
      descobertos,
      "campo no schema e fora do painel: ou entra no registro, ou entra em " +
        "FORA_DE_PROPOSITO com o motivo escrito na spec §2.1",
    ).toEqual([]);
  });

  it("nenhuma exceção é fantasma — tudo em FORA_DE_PROPOSITO existe no schema", () => {
    const doSchema = new Set(Object.keys(fichaSchema.shape));
    expect([...FORA_DE_PROPOSITO].filter((k) => !doSchema.has(k))).toEqual([]);
  });

  it("o registro não está vazio nem é só a voz — senão os guardas acima passam ocos", () => {
    expect(CAMPOS_DA_FICHA.length).toBeGreaterThan(12);
    expect(new Set(CAMPOS_DA_FICHA.map((c) => c.especie)).size).toBeGreaterThan(4);
  });

  it("toda lista fechada declara opções, e nenhuma outra espécie declara", () => {
    for (const c of CAMPOS_DA_FICHA) {
      if (c.especie === "lista") expect(c.opcoes, c.caminho).toBeDefined();
      else expect(c.opcoes, c.caminho).toBeUndefined();
    }
  });

  it("campoPorCaminho acha o que existe e devolve undefined pro que não", () => {
    expect(campoPorCaminho("voz")?.especie).toBe("prosa");
    expect(campoPorCaminho("custo.valor")?.especie).toBe("prosa");
    expect(campoPorCaminho("piso")?.opcoes).toContain("barro");
    expect(campoPorCaminho("slug")).toBeUndefined();
    expect(campoPorCaminho("modos")).toBeUndefined();
  });
});
```

`tests/lib/editar-ficha.test.ts` (reescrever; o arquivo de hoje tem 5 casos sobre `voz`):

```ts
import { describe, expect, it } from "vitest";
import { aplicarCampo, removerCampo } from "@/lib/campos-da-ficha";
import { loadAll } from "@/lib/ficha";

const DOC = JSON.stringify(loadAll().find((f) => f.slug === "rampa-do-pepe"));

describe("aplicarCampo", () => {
  it("alcança chave de 1º nível", () => {
    expect(JSON.parse(aplicarCampo(DOC, "voz", "a serra firmou")).voz).toBe("a serra firmou");
  });

  // 🔴 O `{...atual, [campo]: valor}` de hoje NÃO faz isto — é a mudança
  // que destrava preço, horário e a regra da chuva.
  it("alcança caminho ANINHADO sem derrubar os irmãos", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "custo.valor", "R$ 12,00"));
    expect(depois.custo.valor).toBe("R$ 12,00");
    expect(depois.custo.tag).toBe(antes.custo.tag);
    expect(depois.custo.curto).toBe(antes.custo.curto);
  });

  it("alcança índice de array", () => {
    const depois = JSON.parse(aplicarCampo(DOC, "trajeto.waypoints.0.nome", "Outro nome"));
    expect(depois.trajeto.waypoints[0].nome).toBe("Outro nome");
  });

  it("grava número, booleano, lista e coordenada — não só string", () => {
    expect(JSON.parse(aplicarCampo(DOC, "condicao.regra.limiar_mm", 12)).condicao.regra.limiar_mm).toBe(12);
    expect(JSON.parse(aplicarCampo(DOC, "carroComum", false)).carroComum).toBe(false);
    expect(JSON.parse(aplicarCampo(DOC, "dias", ["sab", "dom"])).dias).toEqual(["sab", "dom"]);
    const c = JSON.parse(aplicarCampo(DOC, "condicao.coords", { lat: -8.5, lng: -36.1 }));
    expect(c.condicao.coords).toEqual({ lat: -8.5, lng: -36.1 });
  });

  // 🔴 A REGRA MAIS IMPORTANTE DESTA TAREFA. Medida em `[slug]/page.tsx:105`:
  // `ficha.custo.curto ?? precoCurto` — o `??` não pega "", então gravar ""
  // deixaria o chip EM BRANCO na ficha pública em vez de cair no preço.
  it('string vazia é RECUSADA, em campo opcional e em obrigatório', () => {
    expect(() => aplicarCampo(DOC, "custo.curto", "")).toThrow();
    expect(() => aplicarCampo(DOC, "voz", "")).toThrow();
    expect(() => aplicarCampo(DOC, "secaRapido", "   ")).toThrow();
  });

  it("valor do tipo errado estoura, e NÃO devolve documento", () => {
    expect(() => aplicarCampo(DOC, "voz", 42 as never)).toThrow();
    expect(() => aplicarCampo(DOC, "condicao.regra.limiar_mm", "doze" as never)).toThrow();
  });

  it("caminho fora do registro é recusado", () => {
    expect(() => aplicarCampo(DOC, "slug", "outro")).toThrow();
    expect(() => aplicarCampo(DOC, "modos", ["x"])).toThrow();
    expect(() => aplicarCampo(DOC, "inventado", "x")).toThrow();
  });

  it("documento já podre no banco não passa por ser editado num campo bom", () => {
    expect(() => aplicarCampo('{"slug":"x"}', "voz", "qualquer")).toThrow();
  });

  // 🔴 Sem este teste, trocar o caminhar-por-caminho por `{[c]: v}` passa
  // verde no teste de cima (o campo muda mesmo) e apaga a ficha inteira.
  it("só o campo pedido muda; todo o resto sai idêntico", () => {
    const antes = JSON.parse(DOC);
    const depois = JSON.parse(aplicarCampo(DOC, "voz", "outra coisa"));
    expect({ ...depois, voz: antes.voz }).toEqual(antes);
  });
});

describe("removerCampo — o 'não sei'", () => {
  it("tira a chave do documento em vez de gravar vazio", () => {
    const depois = JSON.parse(removerCampo(DOC, "piso"));
    expect("piso" in depois).toBe(false);
  });

  it("campo OBRIGATÓRIO não pode virar 'não sei'", () => {
    expect(() => removerCampo(DOC, "voz")).toThrow();
    expect(() => removerCampo(DOC, "custo.tag")).toThrow();
    expect(() => removerCampo(DOC, "trajeto.waypoints.0.nome")).toThrow();
  });

  it("o documento continua válido depois de remover", () => {
    expect(() => JSON.parse(removerCampo(DOC, "secaRapido"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run tests/lib/campos-da-ficha.test.ts tests/lib/editar-ficha.test.ts`
Expected: FAIL — `Cannot find module '@/lib/campos-da-ficha'`.

- [ ] **Step 3: Escrever `src/lib/campos-da-ficha.ts`**

O registro, uma entrada por campo. Percorra `src/types/ficha.ts:45-189` campo a campo e não vá pela memória. As espécies estão na spec §3. Exemplo da forma (não é a lista completa — escreva as 16 famílias):

```ts
export const CAMPOS_DA_FICHA = [
  { caminho: "voz", especie: "prosa", obrigatorio: true, grupo: "voz" },
  { caminho: "promessa", especie: "prosa", obrigatorio: true, grupo: "voz" },
  { caminho: "custo.tag", especie: "lista", obrigatorio: true, grupo: "custo",
    opcoes: ["gratis", "pago"] },
  { caminho: "custo.valor", especie: "prosa", obrigatorio: false, grupo: "custo" },
  { caminho: "piso", especie: "lista", obrigatorio: false, grupo: "chegar", opcoes: PISOS },
  { caminho: "carroComum", especie: "booleano", obrigatorio: false, grupo: "chegar" },
  { caminho: "horario.abre", especie: "hora", obrigatorio: false, grupo: "quando" },
  { caminho: "condicao.regra.limiar_mm", especie: "numero", obrigatorio: true, grupo: "condicao" },
  { caminho: "condicao.coords", especie: "coord", obrigatorio: true, grupo: "condicao" },
  // … as demais
] as const satisfies readonly CampoDaFicha[];
```

E as três funções. `aplicarCampo` caminha o caminho com `split(".")`, clona em profundidade o trecho que toca (nunca muta o objeto de entrada), recusa `""`/só-espaços **antes** de aplicar, e termina em `fichaSchema.parse(...)` do documento inteiro — a porta que já existe e que não sai. `removerCampo` recusa obrigatório, faz `delete` na folha e revalida igual.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/lib/campos-da-ficha.test.ts tests/lib/editar-ficha.test.ts`
Expected: PASS.

- [ ] **Step 5: Manter `editar-ficha.ts` compilando**

`src/lib/editar-ficha.ts` passa a reexportar do módulo novo (`CAMPOS_EDITAVEIS` some; quem importava vira import do registro). Rode `npx tsc --noEmit` e conserte os chamadores — hoje são `src/app/api/admin/ficha/route.ts` e `src/app/admin/EditorDeVoz.tsx`.

⚠️ **Dois testes existentes usam `piso` como isca para provar "campo fora da lista é recusado"**: `tests/api/route-admin-ficha.test.ts:121` e o caso antigo de `editar-ficha.test.ts`. `piso` **passa a ser editável** nesta tarefa, então a trava contra o `slug` precisa ser **reancorada**: use `slug` direto nos dois, e mantenha o comentário de `route-admin-ficha.test.ts:116-119` atualizado dizendo qual campo guarda o quê agora.

- [ ] **Step 6: Mutações, com `diff -u` provando que aplicaram**

| # | mutação | morre em |
|---|---|---|
| M1 | `aplicarCampo` volta a `{...atual, [caminho]: valor}` | "alcança caminho ANINHADO" |
| M2 | tira a recusa de `""` | "string vazia é RECUSADA" |
| M3 | `removerCampo` deixa de checar `obrigatorio` | "campo OBRIGATÓRIO não pode virar 'não sei'" |
| M4 | tira `fichaSchema.parse` do fim de `aplicarCampo` | "valor do tipo errado estoura" |
| M5 | acrescenta `piso` a `FORA_DE_PROPOSITO` no teste | "nenhuma exceção é fantasma" **não** pega (é do schema) — **então acrescente também**: um caso que prove que `piso` está no registro. Se M5 sobreviver, escreva o teste que mata **nesta tarefa** |

- [ ] **Step 7: Suíte inteira, tipos e build**

Run: `npm test -- --run && npx tsc --noEmit && npm run build`
Expected: tudo verde; build exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/campos-da-ficha.ts src/lib/editar-ficha.ts tests/lib/campos-da-ficha.test.ts tests/lib/editar-ficha.test.ts tests/api/route-admin-ficha.test.ts
git commit -m "feat(painel): o registro de campos, e aplicarCampo aprende caminho, tipo e nao-sei"
```

---

### Task 2: As 15 regras de coerência saem dos testes e viram porta de produção

**Files:**
- Create: `src/lib/coerencia.ts`
- Modify: `tests/lib/coerencia-acervo.test.ts` (passa a consumir o módulo)
- Test: `tests/lib/coerencia.test.ts` (criar — o teste do módulo em si)

**Interfaces:**
- Consumes: `Ficha` de `@/types/ficha`; os mesmos regex e constantes que o teste de hoje usa (leia o arquivo inteiro antes de escrever nada).
- Produces:
  - `export type Violacao = { regra: string; slug: string; frase: string }` — `frase` é a que vai pra tela do dono, em português, dizendo **o que está incoerente**
  - `export function violacoesDoAcervo(fichas: readonly Ficha[]): Violacao[]`
  - `export const REGRAS: readonly string[]` — os identificadores das 15, para o teste de não-vacuidade

🔴 **Leia `tests/lib/coerencia-acervo.test.ts` inteiro antes de começar.** São 15 `it(` e cada um carrega um comentário explicando o defeito real que o motivou. **Nenhum comentário se perde:** ele viaja junto com a regra para o módulo.

- [ ] **Step 1: Escrever o teste do módulo**

`tests/lib/coerencia.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REGRAS, violacoesDoAcervo } from "@/lib/coerencia";
import { loadAll } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";

const ACERVO = loadAll();
const rampa = () => structuredClone(ACERVO.find((f) => f.slug === "rampa-do-pepe")!) as Ficha;

describe("violacoesDoAcervo", () => {
  it("o acervo real de hoje não tem violação nenhuma", () => {
    expect(violacoesDoAcervo(ACERVO)).toEqual([]);
  });

  // 🔴 NÃO-VACUIDADE, e é o guarda desta tarefa. Sem ele, um módulo que
  // devolve [] pra tudo passa no teste de cima e a porta fica escancarada.
  // Uma violação por REGRA, e o teste falha se alguma regra nunca disparar.
  it("cada uma das 15 regras dispara pelo menos uma vez", () => {
    const disparadas = new Set<string>();
    for (const quebrar of QUEBRAS) {
      const v = violacoesDoAcervo(quebrar(ACERVO));
      v.forEach((x) => disparadas.add(x.regra));
    }
    expect([...REGRAS].filter((r) => !disparadas.has(r)), "regra que nunca disparou").toEqual([]);
  });

  it("o chip que não bate com o preço é pego", () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "R$ 10,00", curto: "R$ 5" };
    const v = violacoesDoAcervo([f, ...ACERVO.filter((x) => x.slug !== f.slug)]);
    expect(v.map((x) => x.regra)).toContain("chip-bate-com-preco");
    expect(v[0].frase).toMatch(/R\$ 5/);
    expect(v[0].slug).toBe(f.slug);
  });

  it("a prosa que nomeia piso diferente do campo é pega", () => {
    const f = rampa();
    f.piso = "asfalto";
    f.acesso = "a estrada é de barro até o portão";
    const v = violacoesDoAcervo([f, ...ACERVO.filter((x) => x.slug !== f.slug)]);
    expect(v.map((x) => x.regra)).toContain("prosa-bate-com-piso");
  });

  it("uma ficha que empresta a frase de outra é pega", () => {
    const [a, b] = ACERVO;
    const f = structuredClone(a);
    f.secaRapido = b.secaRapido ?? "qualquer";
    const v = violacoesDoAcervo([f, ...ACERVO.filter((x) => x.slug !== f.slug)]);
    expect(v.map((x) => x.regra)).toContain("frase-emprestada");
  });

  it("janela de chuva zerada é pega", () => {
    const f = rampa();
    f.condicao.regra.janela_previsao_horas = 0;
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).toContain("janela-nao-zerada");
  });

  it("a frase da violação nomeia o lugar e não é o identificador da regra", () => {
    const f = rampa();
    f.condicao.regra.limiar_mm = 0;
    const v = violacoesDoAcervo([f]);
    expect(v[0].frase.length).toBeGreaterThan(20);
    expect(v[0].frase).not.toBe(v[0].regra);
  });
});
```

`QUEBRAS` é um array de funções, uma por regra, cada uma devolvendo um acervo que quebra aquela regra. **Escreva as 15**, uma por `it(` do arquivo antigo. É trabalhoso e é o ponto: é a prova de que nenhuma regra se perdeu na extração.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/lib/coerencia.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever `src/lib/coerencia.ts`**

Uma função por regra, cada uma recebendo o acervo e devolvendo `Violacao[]`. `violacoesDoAcervo` concatena. 🔴 **O comentário que explica o defeito real vai junto com cada regra** — é ele que impede alguém de "simplificar" a regra sem saber o que ela pegou uma vez.

Quatro das quinze comparam **uma ficha com as outras** (frase emprestada), então a assinatura é do **acervo**, não da ficha — e é por isso que a porta de escrita precisa ler o acervo inteiro (spec §5.1).

- [ ] **Step 4: Reescrever `tests/lib/coerencia-acervo.test.ts` para consumir o módulo**

🔴 **Os mesmos 15 casos, os mesmos nomes, as mesmas mensagens.** Cada um vira:

```ts
it("em toda ficha paga, o preço do CHIP é o mesmo preço da linha completa", () => {
  expect(
    violacoesDoAcervo(fichas).filter((v) => v.regra === "chip-bate-com-preco"),
  ).toEqual([]);
});
```

Os dois casos de não-vacuidade que o arquivo já tem (`:65` e `:267`) **ficam onde estão** — eles provam que há acervo pra varrer, e isso continua sendo verdade e continua sendo necessário.

⚠️ **Dois casos NÃO migram, porque mudam de natureza na Task 10** (spec §5.2): `:356` ("o `src/` continua cego ao waypoint 2") e `:375` ("nenhuma ficha tem 2º waypoint"). **Deixe os dois exatamente como estão nesta tarefa** — a Task 10 mexe neles, e mexer aqui esconderia a mudança.

- [ ] **Step 5: Rodar os dois arquivos**

Run: `npx vitest run tests/lib/coerencia.test.ts tests/lib/coerencia-acervo.test.ts`
Expected: PASS nos dois, **15 casos** ainda no arquivo de acervo.

- [ ] **Step 6: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `violacoesDoAcervo` devolve `[]` sempre | "cada uma das 15 regras dispara" |
| M2 | tira **uma** regra do módulo (escolha a do chip) | "o chip que não bate com o preço é pego" **e** o caso homônimo em `coerencia-acervo.test.ts` |
| M3 | a regra do piso passa a comparar só a própria ficha, ignorando prosa | "a prosa que nomeia piso diferente do campo" |
| M4 | `frase` passa a ser `regra` | "a frase da violação nomeia o lugar" |
| M5 | a comparação de frase emprestada passa a comparar a ficha consigo mesma | "uma ficha que empresta a frase de outra" |

- [ ] **Step 7: Suíte, tipos, build**

Run: `npm test -- --run && npx tsc --noEmit && npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/lib/coerencia.ts tests/lib/coerencia.test.ts tests/lib/coerencia-acervo.test.ts
git commit -m "feat(painel): as 15 regras de coerencia viram porta de producao, nao so teste"
```

---

### Task 3: A porta de escrita aceita qualquer campo do registro, e passa pela coerência

**Files:**
- Modify: `src/app/api/admin/ficha/route.ts`
- Test: `tests/api/route-admin-ficha.test.ts` (acrescentar; **não** reescrever os casos que já existem)

**Interfaces:**
- Consumes: `aplicarCampo`, `removerCampo`, `campoPorCaminho` de `@/lib/campos-da-ficha`; `violacoesDoAcervo` de `@/lib/coerencia`; `versaoAtual`, `versoesAtuais`, `gravarVersao` de `@/lib/db`; guardas de `@/lib/admin-guarda`.
- Produces: `PUT /api/admin/ficha` passa a aceitar **três** corpos mutuamente exclusivos:
  - `{ slug, campo, valor }` — grava (o `campo` agora é caminho, e `valor` é tipado)
  - `{ slug, campo, naoSei: true }` — remove a chave
  - `{ slug, versaoId }` — volta a uma versão (já existe, **não mexer**)

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `tests/api/route-admin-ficha.test.ts`, no molde dos que já estão lá (que montam `Request` à mão, injetam `process.env` e usam `criarSessao` de verdade). **Asserção dupla em todos — o código E o efeito:**

```ts
it("grava campo aninhado: 200, e só ele muda", async () => {
  const res = await PUT(pedido({ slug: SLUG, campo: "custo.valor", valor: "R$ 12,00" }, cookieBom));
  expect(res.status).toBe(200);
  const doc = JSON.parse((await versaoAtual(c, SLUG))!.doc);
  expect(doc.custo.valor).toBe("R$ 12,00");
  expect(doc.voz).toBe(VOZ_ORIGINAL);
  expect(await historico(c, SLUG)).toHaveLength(2);
});

it("grava número e booleano, não só string", async () => {
  expect((await PUT(pedido({ slug: SLUG, campo: "carroComum", valor: false }, cookieBom))).status).toBe(200);
  expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).carroComum).toBe(false);
});

// 🔴 Review Focus 1.
it("string vazia: 400, e NADA é gravado", async () => {
  const res = await PUT(pedido({ slug: SLUG, campo: "custo.curto", valor: "" }, cookieBom));
  expect(res.status).toBe(400);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

it("naoSei tira a chave, e o histórico ganha versão", async () => {
  const res = await PUT(pedido({ slug: SLUG, campo: "piso", naoSei: true }, cookieBom));
  expect(res.status).toBe(200);
  expect("piso" in JSON.parse((await versaoAtual(c, SLUG))!.doc)).toBe(false);
  expect(await historico(c, SLUG)).toHaveLength(2);
});

it("naoSei em campo obrigatório: 400, e nada gravado", async () => {
  expect((await PUT(pedido({ slug: SLUG, campo: "voz", naoSei: true }, cookieBom))).status).toBe(400);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

// 🔴 Review Focus 2 — o schema aceita, só a coerência pega.
it("gravação que passa no schema e mente sobre o lugar: 409, nada gravado, e a frase volta", async () => {
  const res = await PUT(pedido({ slug: SLUG, campo: "custo.curto", valor: "R$ 1" }, cookieBom));
  expect(res.status).toBe(409);
  expect(await res.text()).toMatch(/R\$ 1/);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

it("campo fora do registro: 400 (slug é a isca agora, piso virou editável)", async () => {
  expect((await PUT(pedido({ slug: SLUG, campo: "slug", valor: "outro" }, cookieBom))).status).toBe(400);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

it("corpo com valor E naoSei juntos: 400", async () => {
  expect((await PUT(pedido({ slug: SLUG, campo: "voz", valor: "x", naoSei: true }, cookieBom))).status).toBe(400);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/api/route-admin-ficha.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implementar**

A rota passa a: exigir os três formatos mutuamente exclusivos (o `"campo" in corpo` que já está lá em `:56` é o molde — `!== undefined` não serve); montar o documento novo com `aplicarCampo`/`removerCampo`; **ler o acervo inteiro** (`versoesAtuais`, com `comPrazo` e constante nomeada) e rodar `violacoesDoAcervo` com o documento novo no lugar do antigo; **409** com a `frase` da primeira violação se houver; só então `gravarVersao`.

⚠️ O caminho `{slug, versaoId}` (voltar) **grava verbatim** e não revalida — está assim de propósito desde a Task 7 da rodada passada, e o comentário em `route.ts:87-95` explica. **Não mexer**, e **não** rodar coerência nele: voltar a uma versão que o acervo de hoje reprova é decisão dele, não erro novo.

- [ ] **Step 4: Rodar e confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | tira a chamada de `violacoesDoAcervo` | "gravação que mente sobre o lugar: 409" |
| M2 | 409 vira 200 com a gravação feita | o mesmo, no `historico` |
| M3 | aceita `valor` e `naoSei` juntos | "corpo com valor E naoSei juntos" |
| M4 | `naoSei` deixa de checar obrigatório na rota | "naoSei em campo obrigatório" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/app/api/admin/ficha/route.ts tests/api/route-admin-ficha.test.ts
git commit -m "feat(painel): a porta de escrita aceita todo campo do registro e passa pela coerencia"
```

---

### Task 4: `oculto` — esconder um lugar sem apagar nada

**Files:**
- Modify: `src/lib/db.ts` (`ensureSchema`, `gravarVersao`, `versoesAtuais`, `FichaVersao`)
- Modify: `src/lib/ficha-fonte.ts` (o caminho público pede só visíveis)
- Create: `src/app/api/admin/visibilidade/route.ts`
- Test: `tests/lib/db.test.ts` (acrescentar), `tests/api/route-admin-visibilidade.test.ts` (criar), `tests/lib/ficha-fonte.test.ts` (acrescentar)

**Interfaces:**
- Produces:
  - coluna `oculto INTEGER NOT NULL DEFAULT 0` em `ficha_versoes`
  - `FichaVersao` ganha `oculto: boolean`
  - `gravarVersao(client, slug, doc, autor, criadoEm, oculto = false)`
  - `versoesAtuais(client, opts?: { incluirOcultos?: boolean })` — **o padrão continua sendo só visíveis**
  - `POST /api/admin/visibilidade` com `{ slug, oculto: boolean }`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// tests/lib/db.test.ts
it("esconder é uma VERSÃO NOVA, e a antiga continua lá", async () => {
  const antes = await historico(c, SLUG);
  await gravarVersao(c, SLUG, docAtual, "painel", agora, true);
  const depois = await historico(c, SLUG);
  expect(depois).toHaveLength(antes.length + 1);
  expect(depois[0].oculto).toBe(true);
  expect(depois[1].oculto).toBe(false);
});

it("versoesAtuais esconde o oculto por padrão, e mostra quando pedido", async () => {
  await gravarVersao(c, SLUG, docAtual, "painel", agora, true);
  expect((await versoesAtuais(c)).has(SLUG)).toBe(false);
  expect((await versoesAtuais(c, { incluirOcultos: true })).has(SLUG)).toBe(true);
});

// 🔴 Review Focus 4. O C1 da revisão de 26/09 consertou exatamente este
// defeito pra tabela vazia; ele volta por uma porta nova.
it("esconder o ÚLTIMO lugar visível faz a fonte estourar, não devolver lista vazia", async () => {
  for (const s of TODOS_OS_SLUGS) await gravarVersao(c, s, docDe(s), "painel", agora, true);
  await expect(buscarFichas()).rejects.toThrow();
});

// tests/api/route-admin-visibilidade.test.ts
// Molde: `tests/api/route-admin-aviso.test.ts`, que já monta `Request` à mão,
// injeta `process.env` e usa `criarSessao` de verdade. Asserção DUPLA em
// todos — o código E o efeito no banco.
it("esconder: 200, some do público, continua no painel", async () => {
  expect((await POST(pedido({ slug: SLUG, oculto: true }, cookieBom))).status).toBe(200);
  expect((await versoesAtuais(c)).has(SLUG)).toBe(false);
  expect((await versoesAtuais(c, { incluirOcultos: true })).has(SLUG)).toBe(true);
});

it("mostrar de novo: 200, volta ao público, e são TRÊS versões", async () => {
  await POST(pedido({ slug: SLUG, oculto: true }, cookieBom));
  expect((await POST(pedido({ slug: SLUG, oculto: false }, cookieBom))).status).toBe(200);
  expect((await versoesAtuais(c)).has(SLUG)).toBe(true);
  expect(await historico(c, SLUG)).toHaveLength(3);  // ⬅ semente + esconder + mostrar
});

it("sem cookie: 401, e nada mudou", async () => {
  expect((await POST(pedido({ slug: SLUG, oculto: true }, undefined))).status).toBe(401);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

it("painel desligado: 404, e nada mudou", async () => {
  semSenhaNoEnv();
  expect((await POST(pedido({ slug: SLUG, oculto: true }, cookieBom))).status).toBe(404);
  expect(await historico(c, SLUG)).toHaveLength(1);
});

it("esconder slug que não existe: 400, e nada gravado", async () => {
  expect((await POST(pedido({ slug: "nao-existe", oculto: true }, cookieBom))).status).toBe(400);
  expect(await versaoAtual(c, "nao-existe")).toBeNull();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

`ensureSchema` ganha a coluna. ⚠️ **`ficha_versoes` já existe em produção**, então é `ALTER TABLE ... ADD COLUMN` guardado (SQLite não tem `IF NOT EXISTS` em `ADD COLUMN`; leia `PRAGMA table_info` antes, ou capture o erro de coluna duplicada — e **escreva no código por que**). `DEFAULT 0` faz toda linha existente nascer visível, que é o comportamento de hoje.

`buscarFichas` estoura com acervo visível vazio pela **mesma** porta que já estoura com tabela vazia — o conserto do C1 está em `src/lib/ficha-fonte.ts` e é onde este caso entra.

- [ ] **Step 4: Confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `versoesAtuais` ignora `oculto` | "versoesAtuais esconde o oculto por padrão" |
| M2 | esconder faz `UPDATE` em vez de `INSERT` | "esconder é uma VERSÃO NOVA" |
| M3 | `incluirOcultos` vira o padrão | "esconder: some do público" |
| M4 | acervo visível vazio devolve `[]` | "esconder o ÚLTIMO lugar visível" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/ficha-fonte.ts src/app/api/admin/visibilidade/route.ts tests/lib/db.test.ts tests/lib/ficha-fonte.test.ts tests/api/route-admin-visibilidade.test.ts
git commit -m "feat(painel): esconder lugar e uma versao nova, nunca um DELETE"
```

---

### Task 5: A tela do lugar mostra a ficha inteira, em grupos

**Files:**
- Create: `src/app/admin/FichaInteira.tsx`
- Modify: `src/app/admin/[slug]/page.tsx`
- Modify: `src/app/admin/admin.css`
- Test: `tests/app/admin/ficha-inteira.test.tsx` (criar)

**Interfaces:**
- Consumes: `CAMPOS_DA_FICHA`, `GrupoDaFicha` de `@/lib/campos-da-ficha`; `Ficha` de `@/types/ficha`.
- Produces: `export default function FichaInteira({ ficha }: { ficha: Ficha })` — render puro, **sem editor ainda** (os editores chegam na Task 6 e encaixam aqui).

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it("mostra TODOS os campos do registro, nenhum a menos", () => {
  render(<FichaInteira ficha={rampa} />);
  for (const c of CAMPOS_DA_FICHA) {
    expect(screen.getByTestId(`campo-${c.caminho}`), c.caminho).toBeInTheDocument();
  }
});

// 🔴 Sem isto, um componente que renderiza uma caixa vazia passa no teste
// de cima e não mostra nada. É a espécie "prova que está em algum lugar da
// tela" que o catálogo pegou em 25/09.
it("o VALOR de cada campo preenchido aparece dentro do bloco dele", () => {
  render(<FichaInteira ficha={rampa} />);
  expect(within(screen.getByTestId("campo-voz")).getByText(rampa.voz)).toBeInTheDocument();
  expect(within(screen.getByTestId("campo-custo.valor")).getByText(rampa.custo.valor!)).toBeInTheDocument();
});

it("campo ausente é marcado como ausente, não some nem finge vazio", () => {
  const semPiso = { ...rampa, piso: undefined };
  render(<FichaInteira ficha={semPiso} />);
  const bloco = screen.getByTestId("campo-piso");
  expect(bloco).toBeInTheDocument();
  expect(bloco.textContent).toMatch(/não sei|não diz/i);
});

it("os campos aparecem agrupados, e nenhum grupo fica órfão", () => {
  render(<FichaInteira ficha={rampa} />);
  const grupos = new Set(CAMPOS_DA_FICHA.map((c) => c.grupo));
  for (const g of grupos) expect(screen.getByTestId(`grupo-${g}`)).toBeInTheDocument();
});

// 🔴 A voz é de um lugar só — o componente serve os três.
it("serve as três fichas sem nenhuma frase de uma aparecer na outra", () => {
  for (const f of ACERVO) {
    const { unmount } = render(<FichaInteira ficha={f} />);
    for (const outra of ACERVO.filter((x) => x.slug !== f.slug)) {
      expect(screen.queryByText(outra.voz)).not.toBeInTheDocument();
    }
    unmount();
  }
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

Blocos por grupo, na ordem da spec §3. Cada bloco com `data-testid={`campo-${caminho}`}`. **Rótulo de cada bloco e a frase de ausente são copy nova** — `// PENDENTE` em cada uma, e todas no relatório.

CSS: **mínimo estrutural**, reusando valor que já existe no `admin.css`. Zero cor nova, zero fonte nova, zero animação — a régua da rodada passada, e o revisor confere regra a regra.

- [ ] **Step 4: Confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | o laço de campos pula os aninhados | "mostra TODOS os campos do registro" |
| M2 | o bloco renderiza o rótulo mas não o valor | "o VALOR de cada campo preenchido" |
| M3 | campo ausente não renderiza o bloco | "campo ausente é marcado como ausente" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/app/admin/FichaInteira.tsx "src/app/admin/[slug]/page.tsx" src/app/admin/admin.css tests/app/admin/ficha-inteira.test.tsx
git commit -m "feat(painel): a tela do lugar mostra a ficha inteira, em grupos"
```

---

### Task 6: Os editores por espécie — prosa, lista fechada, booleano, hora

**Files:**
- Create: `src/app/admin/campos/EditorProsa.tsx`, `EditorLista.tsx`, `EditorBooleano.tsx`, `EditorHora.tsx`, `BotaoNaoSei.tsx`
- Modify: `src/app/admin/FichaInteira.tsx` (monta o editor de cada bloco)
- Delete: `src/app/admin/EditorDeVoz.tsx` — **absorvido pelo `EditorProsa`**
- Modify: `src/app/admin/admin.css`
- Test: `tests/app/admin/editores-de-campo.test.tsx` (criar), `tests/app/admin/editor-de-voz.test.tsx` (migrar os casos, não apagar o que provam)

**Interfaces:**
- Consumes: `PUT /api/admin/ficha` (Task 3); `CampoDaFicha`.
- Produces: cada editor recebe `{ campo: CampoDaFicha; valor: ValorDeCampo | undefined; slug: string }` e grava sozinho. Mesmo padrão do `EditorDeVoz` de hoje: estado local, `PUT`, `location.reload()` no sucesso — **a tela vem da fonte nova, nunca de estado otimista**.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it("prosa: grava o que foi digitado, no caminho certo", async () => { /* fetch mock, confere body */ });

// 🔴 Global constraint: "" nunca chega ao documento.
it("prosa: caixa esvaziada NÃO grava — oferece o 'não sei'", async () => {
  // digita "", clica salvar
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /não sei/i })).toBeInTheDocument();
});

it("lista fechada: só as opções do registro aparecem, e não dá pra digitar", () => {
  render(<EditorLista campo={campoPorCaminho("piso")!} valor="barro" slug={SLUG} />);
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([...PISOS]);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

// 🔴 Spec §3: interruptor COM a frase que ele vira na tela ao lado.
it("booleano: mostra a frase que o valor vira na ficha, não o nome do campo", () => {
  render(<EditorBooleano campo={campoPorCaminho("carroComum")!} valor={true} slug={SLUG} />);
  expect(screen.getByText(/carro comum/i)).toBeInTheDocument();
  expect(screen.queryByText("carroComum")).not.toBeInTheDocument();
});

it("hora: recusa texto que não é HH:MM antes de chamar a rota", async () => {
  render(<EditorHora campo={campoPorCaminho("horario.fecha")!} valor="17:00" slug={SLUG} />);
  await digitar("17h");
  await clicar(/salvar/i);
  expect(putMock).not.toHaveBeenCalled();     // ⬅ nem chega na rota
  expect(screen.getByText(/hora|HH:MM/i)).toBeInTheDocument();
});

it("não sei: manda naoSei:true, e só aparece em campo opcional", () => {
  render(<EditorProsa campo={campoPorCaminho("voz")!} valor="x" slug={SLUG} />);
  expect(screen.queryByRole("button", { name: /não sei/i })).not.toBeInTheDocument();
});

it("409 da coerência mostra a FRASE que voltou, não 'erro'", async () => {
  fetchMock.mockResolvedValue(new Response("o chip diz R$ 5 e o preço diz R$ 10", { status: 409 }));
  // … clica salvar
  expect(await screen.findByText(/o chip diz R\$ 5/)).toBeInTheDocument();
});

// 🔴 A segunda metade importa mais que a primeira: perder o que ele
// acabou de escrever, no celular, por causa de um sinal ruim, é o defeito
// que faz alguém parar de usar o painel.
it("sem rede mostra a frase de sem rede, e não some com o que foi digitado", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  render(<EditorProsa campo={campoPorCaminho("voz")!} valor="antigo" slug={SLUG} />);
  await digitar("texto novo que não pode sumir");
  await clicar(/salvar/i);
  expect(await screen.findByText(/sem rede/i)).toBeInTheDocument();
  expect(screen.getByDisplayValue("texto novo que não pode sumir")).toBeInTheDocument();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

⚠️ **Ao apagar `EditorDeVoz.tsx`, os casos de `editor-de-voz.test.tsx` migram — não somem.** Rode o agente `contracao-honesta` depois: suíte verde não prova contração, teste apagado não falha.

- [ ] **Step 4: Confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | prosa grava `""` | "caixa esvaziada NÃO grava" |
| M2 | lista vira `<input>` livre | "só as opções do registro aparecem" |
| M3 | booleano mostra o nome do campo | "mostra a frase que o valor vira" |
| M4 | 409 mostra frase genérica | "409 mostra a FRASE que voltou" |
| M5 | "não sei" aparece em campo obrigatório | "só aparece em campo opcional" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/app/admin/campos src/app/admin/FichaInteira.tsx src/app/admin/admin.css tests/app/admin
git rm src/app/admin/EditorDeVoz.tsx
git commit -m "feat(painel): um editor por especie de campo, e o nao-sei separado da caixa vazia"
```

---

### Task 7: O número de motor com a consequência ao vivo

**Files:**
- Create: `src/app/admin/campos/EditorNumeroDeMotor.tsx`
- Create: `src/app/api/admin/previsao-carimbo/route.ts`
- Modify: `src/app/admin/FichaInteira.tsx`
- Test: `tests/app/admin/editor-numero-de-motor.test.tsx` (criar), `tests/api/route-admin-previsao-carimbo.test.ts` (criar)

**Interfaces:**
- Consumes: o motor de verdade (`src/lib/runMotor.ts`) — 🔴 **nunca uma cópia da regra.** Duas fontes pra mesma pergunta é espécie catalogada neste projeto.
- Produces: `POST /api/admin/previsao-carimbo` com `{ slug, regra: { limiar_mm, janela_previsao_horas, janela_passado_horas } }` → `{ estado, fala }` — **o que a tela diria hoje com esse valor**, sem gravar nada.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// tests/api/route-admin-previsao-carimbo.test.ts
it("devolve o carimbo que o lugar teria com a regra nova, e NÃO grava", async () => {
  const antes = await historico(c, SLUG);
  const res = await POST(pedido({ slug: SLUG, regra: { ...REGRA, limiar_mm: 99 } }, cookieBom));
  expect(res.status).toBe(200);
  expect((await res.json()).fala.length).toBeGreaterThan(0);
  expect(await historico(c, SLUG)).toHaveLength(antes.length);
});

// 🔴 Se limiar 1 e limiar 99 derem o mesmo carimbo com a mesma chuva, a
// tela está mentindo sobre a consequência — que é a única razão dela existir.
it("limiar diferente muda o carimbo, com a MESMA chuva", async () => {
  const seco = await (await POST(pedido({ slug: SLUG, regra: { ...REGRA, limiar_mm: 999 } }, cookieBom))).json();
  const molhado = await (await POST(pedido({ slug: SLUG, regra: { ...REGRA, limiar_mm: 0.1 } }, cookieBom))).json();
  expect(seco.estado).not.toBe(molhado.estado);
});

it("janela zerada: 400 — regra que nunca fecha não é regra", async () => {
  expect((await POST(pedido({ slug: SLUG, regra: { ...REGRA, janela_previsao_horas: 0 } }, cookieBom))).status).toBe(400);
});

it("sem cookie: 401, e nada previsto vaza", async () => {
  const res = await POST(pedido({ slug: SLUG, regra: REGRA }, undefined));
  expect(res.status).toBe(401);
  expect(await res.text()).toBe("");
});

it("painel desligado: 404", async () => {
  semSenhaNoEnv();
  expect((await POST(pedido({ slug: SLUG, regra: REGRA }, cookieBom))).status).toBe(404);
});
```

```tsx
// tests/app/admin/editor-numero-de-motor.test.tsx
it("mostra a FALA do carimbo previsto, nunca o nome do parâmetro", async () => {
  // muda o número, espera a previsão
  expect(await screen.findByText(/pode ir|não vá|dá um tempo/i)).toBeInTheDocument();
  expect(screen.queryByText("limiar_mm")).not.toBeInTheDocument();
});

it("só grava depois que o dono confirma, vendo a consequência", async () => {
  // digita 12, a previsão aparece, PUT ainda não foi chamado
  expect(putMock).not.toHaveBeenCalled();
});

// 🔴 Review Focus 5. Janela zerada é regra que nunca fecha — e o guarda
// que pega isso hoje é um teste, que não roda quando ele edita do celular.
it("zero é recusado na tela, antes de qualquer rota", async () => {
  render(<EditorNumeroDeMotor campo={campoPorCaminho("condicao.regra.janela_previsao_horas")!}
                              valor={24} slug={SLUG} />);
  await digitar("0");
  await clicar(/salvar/i);
  expect(putMock).not.toHaveBeenCalled();
  expect(screen.getByText(/nunca fecha|não pode ser zero/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

A rota monta uma ficha em memória com a regra nova e roda o motor. **Não grava nada** e não toca `ficha_versoes`. `comPrazo` com constante nomeada e justificativa própria — a consulta aqui é do motor, não uma linha indexada, então **não empreste a justificativa do `PRAZO_AVISO_MS`**; foi exatamente esse empréstimo que a revisão de 26/09 mandou desfazer em `[slug]/page.tsx:35-41`.

- [ ] **Step 4: Confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | a rota grava além de prever | "NÃO grava" |
| M2 | a previsão ignora o `limiar_mm` recebido | "limiar diferente muda o carimbo" |
| M3 | aceita janela 0 | "janela zerada: 400" |
| M4 | a tela mostra o número em vez da fala | "mostra a FALA do carimbo previsto" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/app/admin/campos/EditorNumeroDeMotor.tsx src/app/api/admin/previsao-carimbo src/app/admin/FichaInteira.tsx tests/app/admin/editor-numero-de-motor.test.tsx tests/api/route-admin-previsao-carimbo.test.ts
git commit -m "feat(painel): o numero de motor mostra a consequencia antes de gravar"
```

---

### Task 8: O mapa que arrasta o pin

**Files:**
- Modify: `src/lib/mapa.ts` (o inverso de `posicaoNaCaixa`)
- Create: `src/app/admin/campos/EditorCoordenada.tsx`
- Modify: `src/app/admin/FichaInteira.tsx`, `src/app/admin/admin.css`
- Test: `tests/lib/mapa.test.ts` (acrescentar), `tests/app/admin/editor-coordenada.test.tsx` (criar)

**Interfaces:**
- Produces: `export function coordDaPosicao(left: number, top: number, centro: Coord, z: number, larguraPx: number, alturaPx: number): Coord` — o inverso exato de `posicaoNaCaixa`, cuja assinatura real é `posicaoNaCaixa(c, centro, z, larguraPx, alturaPx) => { left, top }` (`src/lib/mapa.ts:222`).

🔴 **Leia `src/lib/mapa.ts` inteiro antes de escrever.** O mapa deste app **não é biblioteca de mapa**: é mosaico de tiles, markup derivado de funções puras, zero JS pra desenhar. Você está acrescentando a primeira interação de ponteiro que ele tem.

🟢 **E metade do trabalho já existe:** `latDoMundo(y, z)` e `lngDoMundo(x, z)` (`mapa.ts:161` e `:166`) já são as inversas de `pontoNoMundo`, com a dedução escrita no comentário. `coordDaPosicao` **compõe as duas** com o deslocamento do centro — não reimplemente Mercator.

🔴 **Não existe busca de endereço, e não invente uma.** Spec §3.2 e a memória `nao-inventar-fatos-de-roteiros`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// tests/lib/mapa.test.ts — a prova é a IDA-E-VOLTA, nunca um valor cravado
const CENTRO = { lat: -8.52, lng: -36.87 };
const Z = MAPA_ZOOM;
const L = MAPA_LARGURA_PX;
const A = MAPA_ALTURA_PX;

it("coordDaPosicao é o inverso exato de posicaoNaCaixa", () => {
  for (const c of [CENTRO, { lat: -8.50, lng: -36.90 }, { lat: -8.55, lng: -36.84 }]) {
    const p = posicaoNaCaixa(c, CENTRO, Z, L, A);
    const volta = coordDaPosicao(p.left, p.top, CENTRO, Z, L, A);
    expect(volta.lat).toBeCloseTo(c.lat, 6);
    expect(volta.lng).toBeCloseTo(c.lng, 6);
  }
});

// 🔴 Sem isto, uma função que devolve sempre o centro passa no teste de
// cima no caso em que o ponto de prova É o centro.
it("posições diferentes dão coordenadas diferentes", () => {
  const a = coordDaPosicao(10, 10, CENTRO, Z, L, A);
  const b = coordDaPosicao(200, 150, CENTRO, Z, L, A);
  expect(a.lat).not.toBeCloseTo(b.lat, 6);
  expect(a.lng).not.toBeCloseTo(b.lng, 6);
});

it("top maior é latitude MENOR, left maior é longitude MAIOR — o norte fica em cima", () => {
  expect(coordDaPosicao(50, 10, CENTRO, Z, L, A).lat)
    .toBeGreaterThan(coordDaPosicao(50, 190, CENTRO, Z, L, A).lat);
  expect(coordDaPosicao(400, 50, CENTRO, Z, L, A).lng)
    .toBeGreaterThan(coordDaPosicao(10, 50, CENTRO, Z, L, A).lng);
});

// 🔴 O centro da caixa é o centro do mapa, por definição. Se isto falhar,
// o deslocamento está trocado de sinal e todo pin arrastado cai espelhado.
it("o centro da caixa devolve o centro do mapa", () => {
  const c = coordDaPosicao(L / 2, A / 2, CENTRO, Z, L, A);
  expect(c.lat).toBeCloseTo(CENTRO.lat, 9);
  expect(c.lng).toBeCloseTo(CENTRO.lng, 9);
});
```

```tsx
// tests/app/admin/editor-coordenada.test.tsx
it("arrastar o pin muda a coordenada mostrada", async () => {
  render(<EditorCoordenada campo={campoPorCaminho("condicao.coords")!} valor={CENTRO} slug={SLUG} />);
  const antes = screen.getByTestId("coord-atual").textContent;
  const mapa = screen.getByTestId("mapa-escolher");
  fireEvent.pointerDown(mapa, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(mapa, { clientX: 160, clientY: 60 });
  fireEvent.pointerUp(mapa, { clientX: 160, clientY: 60 });
  expect(screen.getByTestId("coord-atual").textContent).not.toBe(antes);
});

it("só grava quando o dono confirma — arrastar sozinho não chama a rota", async () => {
  // mesmo arrasto do teste acima, sem clicar em salvar
  expect(putMock).not.toHaveBeenCalled();
});

it("mostra a coordenada em número, pra ele conferir contra o que sabe", () => {
  render(<EditorCoordenada campo={campoPorCaminho("condicao.coords")!} valor={CENTRO} slug={SLUG} />);
  expect(screen.getByTestId("coord-atual").textContent).toMatch(/-?\d+[.,]\d{3,}/);
});
it("NÃO tem caixa de busca de endereço", () => {
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/buscar|endereço|procurar/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar** · **Step 4: Confirmar que passam**

- [ ] **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `coordDaPosicao` devolve o centro da caixa | "posições diferentes dão coordenadas diferentes" |
| M2 | inverte o sinal do eixo y | "y maior é latitude MENOR" |
| M3 | arrastar grava direto | "só grava quando o dono confirma" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/lib/mapa.ts src/app/admin/campos/EditorCoordenada.tsx src/app/admin/FichaInteira.tsx src/app/admin/admin.css tests/lib/mapa.test.ts tests/app/admin/editor-coordenada.test.tsx
git commit -m "feat(painel): o pin se arrasta no mapa, e nao existe busca de endereco"
```

---

### Task 9: O histórico mostra qualquer campo, e o esconder aparece na lista

**Files:**
- Modify: `src/app/admin/HistoricoDaVoz.tsx` → renomear para `HistoricoDaFicha.tsx`
- Modify: `src/app/admin/ListaDeLugares.tsx` (marca o escondido), `src/app/admin/[slug]/page.tsx`
- Create: `src/app/admin/BotaoVisibilidade.tsx`
- Test: `tests/app/admin/historico-da-voz.test.tsx` → `historico-da-ficha.test.tsx`; `tests/app/admin/lista-de-lugares.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `FichaVersao` (agora com `oculto`); `POST /api/admin/visibilidade` (Task 4).
- Produces: `HistoricoDaFicha` mostra, por versão, **qual campo mudou** — não só a voz.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it("mostra o campo que mudou em cada versão, não só a voz", () => {
  render(<HistoricoDaFicha versoes={[vComCustoNovo, vComVozNova, vSemente]} />);
  expect(screen.getByText(/preço|custo/i)).toBeInTheDocument();
  expect(screen.getByText(/voz/i)).toBeInTheDocument();
});

it("versão que mudou DOIS campos lista os dois", () => {
  render(<HistoricoDaFicha versoes={[vComVozECustoNovos, vSemente]} />);
  const linha = screen.getByTestId(`versao-${vComVozECustoNovos.id}`);
  expect(within(linha).getByText(/voz/i)).toBeInTheDocument();
  expect(within(linha).getByText(/preço|custo/i)).toBeInTheDocument();
});

// 🔴 A regressão que este teste impede: o componente de hoje extrai só
// `voz` (`HistoricoDaVoz.tsx:20-27`), então uma versão que mudou o preço
// aparece como "nada mudou" e o dono não vê o próprio trabalho.
it("versão que mudou só o preço NÃO aparece como 'nada mudou'", () => {
  render(<HistoricoDaFicha versoes={[vComCustoNovo, vSemente]} />);
  expect(screen.queryByText(/nada mudou/i)).not.toBeInTheDocument();
});

it("linha de versão oculta é marcada como escondida", () => {
  render(<HistoricoDaFicha versoes={[{ ...vSemente, id: 9, oculto: true }, vSemente]} />);
  expect(within(screen.getByTestId("versao-9")).getByText(/escondid/i)).toBeInTheDocument();
});

// ⚠️ JÁ EXISTE em `historico-da-voz.test.tsx` — preservar, não reescrever.
// Uma linha antiga que não parseia mostra vazio em vez de derrubar a lista.
it("documento que não parseia mostra vazio em vez de derrubar a lista", () => {
  render(<HistoricoDaFicha versoes={[{ ...vSemente, id: 7, doc: "{lixo" }, vSemente]} />);
  expect(screen.getByTestId("versao-7")).toBeInTheDocument();
});

// lista-de-lugares.test.tsx
it("lugar escondido aparece na lista do painel, marcado", () => {
  render(<ListaDeLugares fichas={ACERVO} leituras={{}} ocultos={new Set([SLUG])} agora={AGORA} />);
  const item = screen.getByTestId(`lugar-${SLUG}`);
  expect(item).toBeInTheDocument();
  expect(within(item).getByText(/escondid/i)).toBeInTheDocument();
  // ⬅ e os outros dois NÃO ganham a marca — senão "marcado" prova nada
  for (const f of ACERVO.filter((x) => x.slug !== SLUG)) {
    expect(within(screen.getByTestId(`lugar-${f.slug}`)).queryByText(/escondid/i)).toBeNull();
  }
});
it("a palavra 'apagar' não existe em tela nenhuma do painel", () => {
  render(<BotaoVisibilidade slug={SLUG} oculto={false} />);
  expect(screen.queryByText(/apagar|excluir|deletar|remover/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

O diff por versão compara o documento de uma versão com o da anterior, **campo a campo pelo registro** (`CAMPOS_DA_FICHA`) — não por `JSON.stringify`, que acusaria mudança de ordem de chave como mudança de conteúdo.

⚠️ O teste de hoje usa `vi.restoreAllMocks()`, que **não desfaz `vi.stubGlobal`** (minor diferido da rodada passada). Conserte de passagem: `vi.unstubAllGlobals()`.

- [ ] **Step 4: Confirmar que passam** · **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | o diff volta a olhar só `voz` | "versão que mudou só o preço" |
| M2 | o diff usa `JSON.stringify` inteiro | "versão que mudou DOIS campos lista os dois" |
| M3 | a marca de oculto some da lista | "lugar escondido aparece na lista, marcado" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: `contracao-honesta`**

Rode o agente `contracao-honesta`: esta tarefa **renomeia** dois arquivos e dois testes. Renomear não é apagar, e a suíte verde não distingue os dois.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin tests/app/admin
git commit -m "feat(painel): o historico mostra qualquer campo, e o escondido aparece marcado"
```

---

### Task 10: A cadeia de waypoints

**Files:**
- Modify: `src/app/[slug]/page.tsx` (o bloco Trajeto — **o único que fala do caminho**)
- Modify: `src/lib/campos-da-ficha.ts` (campos de waypoint além do 0)
- Create: `src/app/admin/campos/EditorWaypoints.tsx`
- Modify: `tests/lib/coerencia-acervo.test.ts` (os dois guardas que mudam de natureza)
- Test: `tests/app/ficha-trajeto.test.tsx` (criar), `tests/app/admin/editor-waypoints.test.tsx` (criar)

🔴 **A distinção que decide tudo (spec §6):** `waypoints[0]` é **o lugar**; `waypoints[1..]` são **as etapas do caminho até ele**. Então **continua `[0]`, e está certo**: o nome na home, o pin do mapa da home, a ordem alfabética do acervo, a distância "daqui". **Passa a ler a cadeia:** só o bloco Trajeto da ficha.

**Não mexa** em `CartaoTrilha.tsx`, `ListaDoAcervo.tsx`, `MapaHome.tsx`, `lib/ficha-fonte.ts`, `lib/geo.ts`, `admin/ListaDeLugares.tsx`, `admin/PainelAdmin.tsx`. Eles falam do lugar.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it("o bloco Trajeto lista TODAS as etapas, na ordem", () => {
  render(await Pagina({ params: { slug: comTresPontos.slug } }));
  const trajeto = screen.getByTestId("bloco-trajeto");
  expect(within(trajeto).getByText("Segundo ponto")).toBeInTheDocument();
  expect(within(trajeto).getByText("Terceiro ponto")).toBeInTheDocument();
});

it("ficha com um ponto só continua igual — nada de lista de um item", () => {
  render(await Pagina({ params: { slug: "rampa-do-pepe" } }));
  const trajeto = screen.getByTestId("bloco-trajeto");
  expect(within(trajeto).queryByRole("list")).toBeNull();
});

// 🔴 O que a cadeia NÃO pode mudar. `waypoints[0]` é O LUGAR.
it("a home mostra o nome do DESTINO, não o da primeira etapa", () => {
  render(<CartaoTrilha ficha={comTresPontos} leitura={LEITURA} agora={AGORA} />);
  expect(screen.getByText(comTresPontos.trajeto.waypoints[0].nome)).toBeInTheDocument();
  expect(screen.queryByText(comTresPontos.trajeto.waypoints[1].nome)).toBeNull();
});

it("a ordem do acervo continua pelo nome do destino", () => {
  const fora = { ...comTresPontos };
  fora.trajeto.waypoints[1].nome = "AAA primeiro do alfabeto";
  const ordenado = ordenarPorNome([fora, ...ACERVO]);
  expect(ordenado[0].trajeto.waypoints[0].nome)
    .not.toBe("AAA primeiro do alfabeto");
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

- [ ] **Step 4: Virar os dois guardas de `coerencia-acervo.test.ts`** (spec §5.2)

`:375` — *"nenhuma ficha do acervo tem 2º waypoint"* — **cai a mão, junto com o comentário dela.** O teste vizinho em `:356` manda fazer exatamente isso quando o dia chegar; leia o comentário antes de apagar.

`:356` — *"o `src/` continua cego ao waypoint 2 em diante"` — **inverte**: passa a provar que o bloco Trajeto **enxerga** a cadeia, e que os arquivos que falam do lugar **continuam** em `[0]`. Escreva a lista dos sete arquivos que devem continuar cegos, e faça o teste falhar se um deles aprender a ler a cadeia sem alguém pensar no assunto.

- [ ] **Step 5: Confirmar que passam** · **Step 6: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | o bloco Trajeto volta a `waypoints[0]` | "lista TODAS as etapas, na ordem" |
| M2 | a home passa a mostrar `waypoints[1]` | "a home mostra o nome do DESTINO" |
| M3 | o guarda invertido aceita qualquer arquivo lendo a cadeia | acrescente o caso que mata, **nesta tarefa** |

- [ ] **Step 7: Suíte, tipos, build** · **Step 8: Commit**

```bash
git add "src/app/[slug]/page.tsx" src/lib/campos-da-ficha.ts src/app/admin/campos/EditorWaypoints.tsx tests/lib/coerencia-acervo.test.ts tests/app/ficha-trajeto.test.tsx tests/app/admin/editor-waypoints.test.tsx
git commit -m "feat(painel): o trajeto ganha cadeia, e o que fala do LUGAR continua no waypoint 0"
```

---

### Task 11: Criar lugar — o rascunho

**Files:**
- Modify: `src/lib/db.ts` (`ensureSchema` cria `ficha_rascunhos`; funções de rascunho)
- Create: `src/app/api/admin/rascunho/route.ts`
- Create: `src/app/admin/novo/page.tsx`, `src/app/admin/FormularioDeLugar.tsx`
- Modify: `src/app/admin/ListaDeLugares.tsx` (o `+ lugar novo` volta — ver `:25-27`)
- Test: `tests/lib/db-rascunho.test.ts`, `tests/api/route-admin-rascunho.test.ts`, `tests/app/admin/formulario-de-lugar.test.tsx` (criar os três)

**Interfaces:**
- Produces:
  - tabela `ficha_rascunhos (slug TEXT PRIMARY KEY, doc TEXT NOT NULL, atualizado_em INTEGER NOT NULL)`
  - `salvarRascunho(client, slug, doc, agora)` · `lerRascunho(client, slug)` · `listarRascunhos(client)` · `apagarRascunho(client, slug)`
  - `PUT /api/admin/rascunho` `{ slug, campo, valor | naoSei }` · `GET` · `DELETE`
  - `/admin/novo` — `export const dynamic = "force-dynamic"`

🔴 **O rascunho é a ÚNICA tabela deste projeto que sobrescreve**, e o motivo tem que estar escrito no código: *rascunho nunca afirmou nada sobre o lugar; o histórico existe pra guardar o que o app já disse.* Spec §7.2.

🔴 **As 24 perguntas já estão escritas** em `docs/questionario-ficha.md`, em português, feitas pra ele, com "pular é permitido" decidido campo a campo (linhas 467-483). **É o desenho do formulário e foi testado no uso.** Leia o documento inteiro; não invente pergunta nova nem reordene sem motivo escrito.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// 🔴 A razão de o rascunho existir: hoje `versoesAtuais` não filtra nada,
// então a primeira linha em `ficha_versoes` já estaria na home.
it("rascunho NÃO aparece no acervo público nem no painel de lugares", async () => {
  await salvarRascunho(c, "lugar-novo", '{"slug":"lugar-novo"}', agora);
  expect((await versoesAtuais(c, { incluirOcultos: true })).has("lugar-novo")).toBe(false);
  expect((await buscarFichas()).map((f) => f.slug)).not.toContain("lugar-novo");
});

it("salvar duas vezes sobrescreve — o rascunho não versiona", async () => {
  await salvarRascunho(c, S, '{"a":1}', 1); await salvarRascunho(c, S, '{"a":2}', 2);
  expect(await listarRascunhos(c)).toHaveLength(1);
  expect((await lerRascunho(c, S))!.doc).toBe('{"a":2}');
});

it("rascunho aceita documento INCOMPLETO — é o ponto", async () => {
  await expect(salvarRascunho(c, S, '{"slug":"x"}', 1)).resolves.not.toThrow();
});

// 🔴 Global constraint: nada é pré-preenchido.
it("rascunho novo nasce VAZIO — não herda de lugar nenhum", async () => {
  const r = JSON.parse((await lerRascunho(c, "zero"))?.doc ?? "{}");
  for (const k of ["voz", "promessa", "premio", "acesso", "piso"]) expect(r[k]).toBeUndefined();
});
```

```tsx
// 🔴 O questionário é a fonte; o teste lê o registro, não uma lista minha.
it("o formulário faz uma pergunta por campo do registro, e nenhuma a mais", () => {
  render(<FormularioDeLugar rascunho={{}} />);
  for (const c of CAMPOS_DA_FICHA) {
    expect(screen.getByTestId(`pergunta-${c.caminho}`), c.caminho).toBeInTheDocument();
  }
  expect(screen.getAllByTestId(/^pergunta-/)).toHaveLength(CAMPOS_DA_FICHA.length);
});

it("pular só aparece nos campos OPCIONAIS, nunca nos obrigatórios", () => {
  render(<FormularioDeLugar rascunho={{}} />);
  for (const c of CAMPOS_DA_FICHA) {
    const bloco = screen.getByTestId(`pergunta-${c.caminho}`);
    const pular = within(bloco).queryByRole("button", { name: /não sei|pular/i });
    if (c.obrigatorio) expect(pular, c.caminho).toBeNull();
    else expect(pular, c.caminho).not.toBeNull();
  }
});
it("nenhum campo vem com resposta de exemplo dentro da caixa", () => {
  render(<FormularioDeLugar rascunho={{}} />);
  for (const caixa of screen.getAllByRole("textbox")) expect((caixa as HTMLInputElement).value).toBe("");
});
it("sai da tela e volta: o que foi respondido continua lá", async () => {
  const { unmount } = render(<FormularioDeLugar rascunho={{}} />);
  await responder("voz", "o chao firma em dois dias");
  expect(putRascunhoMock).toHaveBeenCalled();
  unmount();
  render(<FormularioDeLugar rascunho={{ voz: "o chao firma em dois dias" }} />);
  expect(screen.getByDisplayValue("o chao firma em dois dias")).toBeInTheDocument();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar** · **Step 4: Confirmar que passam**

- [ ] **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | rascunho grava em `ficha_versoes` | "rascunho NÃO aparece no acervo" |
| M2 | `salvarRascunho` valida contra `fichaSchema` | "aceita documento INCOMPLETO" |
| M3 | rascunho novo copia a ficha de outro lugar | "nasce VAZIO" |
| M4 | salvar insere em vez de sobrescrever | "salvar duas vezes sobrescreve" |

- [ ] **Step 6: Suíte, tipos, build** · **Step 7: Commit**

```bash
git add src/lib/db.ts src/app/api/admin/rascunho src/app/admin/novo src/app/admin/FormularioDeLugar.tsx src/app/admin/ListaDeLugares.tsx tests/lib/db-rascunho.test.ts tests/api/route-admin-rascunho.test.ts tests/app/admin/formulario-de-lugar.test.tsx
git commit -m "feat(painel): o rascunho de lugar novo, que nao vai ao ar ate ele publicar"
```

---

### Task 12: Publicar o rascunho, e a lista do que o app vai CALAR

**Files:**
- Create: `src/app/api/admin/publicar/route.ts`, `src/app/admin/TelaDePublicar.tsx`
- Create: `src/lib/o-que-o-app-cala.ts`
- Modify: `tests/app/MapaHome.test.tsx` (o contador cravado)
- Test: `tests/api/route-admin-publicar.test.ts`, `tests/lib/o-que-o-app-cala.test.ts`, `tests/app/admin/tela-de-publicar.test.tsx` (criar)

**Interfaces:**
- Produces:
  - `export function oQueOAppCala(doc: unknown): string[]` — uma frase por campo em "não sei"
  - `POST /api/admin/publicar` `{ slug }` → valida `fichaSchema` → `violacoesDoAcervo` → `gravarVersao(..., "painel", ...)` → `apagarRascunho`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// 🔴 Review Focus 3.
it("rascunho com campo obrigatório faltando: 400, e NADA entra em ficha_versoes", async () => {
  await salvarRascunho(c, NOVO, '{"slug":"novo"}', agora);
  expect((await POST(pedido({ slug: NOVO }, cookieBom))).status).toBe(400);
  expect(await versaoAtual(c, NOVO)).toBeNull();
  expect(await lerRascunho(c, NOVO)).not.toBeNull();   // ⬅ o rascunho sobrevive
});

it("slug que já existe no acervo: 409, e o lugar antigo fica intacto", async () => {
  await salvarRascunho(c, SLUG_EXISTENTE, docCompleto, agora);
  expect((await POST(pedido({ slug: SLUG_EXISTENTE }, cookieBom))).status).toBe(409);
  expect(await historico(c, SLUG_EXISTENTE)).toHaveLength(1);
});

// 🔴 Review Focus 2, na porta de criar.
it("rascunho completo que MENTE sobre o lugar: 409, nada gravado, frase de volta", async () => {
  await salvarRascunho(c, NOVO, docComChipMentindo, agora);
  const res = await POST(pedido({ slug: NOVO }, cookieBom));
  expect(res.status).toBe(409);
  expect(await res.text()).toMatch(/R\$/);
  expect(await versaoAtual(c, NOVO)).toBeNull();
});

it("publicar de verdade: 200, vira versão 1 autorada 'painel', e o rascunho some", async () => {
  await salvarRascunho(c, NOVO, docCompleto, agora);
  expect((await POST(pedido({ slug: NOVO }, cookieBom))).status).toBe(200);
  const v = await versaoAtual(c, NOVO);
  expect(v!.autor).toBe("painel");
  expect(v!.oculto).toBe(false);
  expect(await lerRascunho(c, NOVO)).toBeNull();
  expect((await buscarFichas()).map((f) => f.slug)).toContain(NOVO);
});

it("sem cookie: 401, e nada gravado nem apagado", async () => {
  await salvarRascunho(c, NOVO, docCompleto, agora);
  expect((await POST(pedido({ slug: NOVO }, undefined))).status).toBe(401);
  expect(await versaoAtual(c, NOVO)).toBeNull();
  expect(await lerRascunho(c, NOVO)).not.toBeNull();
});
```

```ts
// tests/lib/o-que-o-app-cala.test.ts
it("nomeia, em português, o que o app deixa de dizer por cada campo ausente", () => {
  const frases = oQueOAppCala({ ...docCompleto, piso: undefined, horario: undefined });
  expect(frases.some((f) => /piso|chão|via/i.test(f))).toBe(true);
  expect(frases.some((f) => /horário|fecha/i.test(f))).toBe(true);
});

// 🔴 Não-vacuidade: uma função que devolve [] sempre passaria no inverso.
it("ficha completa não cala nada", () => {
  expect(oQueOAppCala(docCompleto)).toEqual([]);
});

it("nenhuma frase é o nome do campo cru", () => {
  for (const f of oQueOAppCala({ ...docCompleto, secaRapido: undefined })) {
    expect(f).not.toBe("secaRapido");
    expect(f.length).toBeGreaterThan(15);
  }
});
```

```tsx
it("a tela de publicar mostra, por extenso, o que o app vai calar", async () => {
  render(<TelaDePublicar rascunho={{ ...docCompleto, piso: undefined }} />);
  for (const frase of oQueOAppCala({ ...docCompleto, piso: undefined })) {
    expect(screen.getByText(frase)).toBeInTheDocument();
  }
});

// 🔴 Calar é permitido — é a régua do app inteiro. A lista existe pra ele
// VER o preço da honestidade, não pra bloquear a publicação.
it("o botão de publicar não some por causa dos campos vazios", () => {
  render(<TelaDePublicar rascunho={{ ...docCompleto, piso: undefined, secaRapido: undefined }} />);
  expect(screen.getByRole("button", { name: /publicar/i })).toBeEnabled();
});
```

- [ ] **Step 2: Confirmar que falham** · **Step 3: Implementar**

- [ ] **Step 4: Reancorar o contador cravado de `MapaHome.test.tsx:354`**

Ele crava `"3 trilhas fora do mapa"` e **o 4º lugar derrubaria a suíte**. O comentário em `:343-351` diz que é tripwire deliberado — leia antes. 🔴 **Ele não some: ele deixa de cravar o número do acervo real.** O caso passa a derivar a contagem das fichas que o teste mesmo monta (o arquivo já tem fichas sintéticas pra isso, segundo o próprio comentário). O tripwire que importa — *"o texto no singular"* — continua provado.

Depois, varra o resto: `grep -rn "toHaveLength(3)\|\.length).toBe(3)" tests/` e decida caso a caso. **Cada um que ficar, fica com o motivo escrito.**

- [ ] **Step 5: Confirmar que passam** · **Step 6: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | publicar pula o `fichaSchema` | "campo obrigatório faltando: 400" |
| M2 | publicar pula a coerência | "rascunho que MENTE: 409" |
| M3 | publicar não apaga o rascunho | "o rascunho some" |
| M4 | publicar sobrescreve slug existente | "slug que já existe: 409" |
| M5 | `oQueOAppCala` devolve `[]` sempre | "nomeia o que o app deixa de dizer" |

- [ ] **Step 7: Suíte, tipos, build** · **Step 8: Commit**

```bash
git add src/app/api/admin/publicar src/app/admin/TelaDePublicar.tsx src/lib/o-que-o-app-cala.ts tests/api/route-admin-publicar.test.ts tests/lib/o-que-o-app-cala.test.ts tests/app/admin/tela-de-publicar.test.tsx tests/app/MapaHome.test.tsx
git commit -m "feat(painel): publicar lugar novo, com a lista do que o app vai calar a vista"
```

---

## Depois da última tarefa

- [ ] **1. A revisão final da branch inteira**, num contexto fresco e no modelo mais capaz. Escopo: `main..HEAD`. 🔴 **O dispatch do revisor pede `npm run build` explicitamente** — na rodada passada dois assentos de revisão passaram por cima de uma branch que não compilava porque nenhum dispatch pedia.

- [ ] **2. Os agentes do projeto, nesta ordem:**
  - `contracao-honesta` — esta rodada **apaga** `EditorDeVoz.tsx`, **renomeia** `HistoricoDaVoz`, e **derruba um guarda a mão** (`coerencia-acervo.test.ts:375`). Suíte verde não prova contração.
  - `prova-que-trava` — em cima dos testes novos, que são muitos.
  - `voz-do-lugar` — o painel inteiro serve os três lugares, e esta rodada escreve dezenas de rótulos.
  - `procedencia` — a porta de criar é a porta nova por onde um lugar que ele não visitou pode entrar.

- [ ] **3. A onda de fix**, numa leva só, com `diff -u` provando cada mutação.

- [ ] **4. A re-revisão escopada** da onda.

- [ ] **5. O relatório de copy pro João** — **todas** as frases novas desta rodada, por extenso, agrupadas por tela, somadas às **doze** que já esperam. Nenhum `// PENDENTE` sai sem ele ler.

- [ ] **6. O deploy, e é UM só.** `npm run semear` (a semente é idempotente e pula as três que já estão lá) e **`vercel --prod --yes`**. 🔴 **Push no GitHub NÃO publica neste repo** — nenhum commit daqui jamais teve status do Vercel, nem o PR mergeado.

- [ ] **7. `conferir-no-ar`**, com marcador que só existe no código novo (uma rota nova, ex.: `GET /api/admin/publicar` → 404 no build velho, 405 no novo). 🔴 **Checksum de página não prova deploy neste repo:** a semente põe no banco o mesmo conteúdo do disco, então a página renderiza idêntica vindo de qualquer fonte.

- [ ] **8. `olho-de-tela`, e depois os olhos DELE no celular.** Nenhuma das telas desta rodada foi vista por olho humano, e são muitas: a ficha inteira em 375px, seis espécies de editor, o mapa com pin arrastável, o formulário de 24 perguntas. **É o item que mais pode estar errado no fim desta rodada, e nenhum teste alcança.**

- [ ] **9. Copiar as rulings desta rodada** para `docs/superpowers/2026-09-26-rulings-painel-completo.md`. O ledger é git-ignored (`.gitignore:57`) e morre num `git clean -fdx`.
