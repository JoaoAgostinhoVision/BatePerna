# Horário diferente em alguns dias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um lugar pode ter, além do horário de sempre, até 3 grupos de dias com outro horário, e o carimbo, a ficha e o
cartão dizem a hora certa de cada dia.

**Architecture:** campo NOVO e opcional `horarioPorDia` no documento; `horario` e `dias` não mudam de formato. Toda
leitura de hora passa por `horarioDoDia(abertura, dia)` em `src/lib/horario.ts`. A regra de escrita dos grupos é uma
função pura (`problemaDosGrupos`) chamada pela porta do campo e pelas duas portas de publicar. Uma espécie nova no
registro (`"grupos"`) com um editor que reaproveita as faixas do `EditorFaixas` e as caixas dos dias.

**Tech Stack:** Next.js App Router, React client components, zod, vitest + Testing Library, Turso/libsql.

**Spec:** `docs/superpowers/specs/2026-10-18-horario-por-dia-design.md`

## Global Constraints

- `horario` e `dias` mantêm EXATAMENTE o formato e o significado de hoje; nenhuma ficha semente muda.
- Sem `horarioPorDia`, toda tela dos três lugares do acervo fica idêntica (veu-de-noiva-de-bonito, pedra-furada-de-venturosa, rampa-do-pepe).
- `horarioPorDia`: 1 a 3 grupos `{ dias: Dia[]; faixas: Faixa[] }`; `faixas` segue `problemaDasFaixas`.
- Toda frase de tela nova nasce com `// PENDENTE: redação minha, o João ainda não leu` na linha de cima; nunca `LIDA`.
- O guarda `tests/lib/frases-da-rodada-marcadas.test.ts` não se afrouxa; se um arquivo novo com frase não for varrido por ele, acrescente-o na lista `ARQUIVOS` dele.
- Comentários e nomes em português, no tom dos arquivos vizinhos (docblock com o porquê; 🔴/⚠️).
- Portões ao fim de cada task: `npx vitest run`, `npx tsc --noEmit`, `npm run build`, `node scripts/mutar.mjs` (42 morreu / 0 / 0).
- Commits na branch `horario-por-dia`; nunca incluir `docs/RESUME.md`; sem push, sem deploy.

## Review Focus

1. Domingo 18h num lugar "8h–17h, sáb e dom 7h–12h" com segunda aberta: o carimbo diz "abre amanhã às 8h" (a hora de SEGUNDA, não a de domingo) — teste na Task 1.
2. Sábado 7h30 nesse mesmo lugar: aberto (o grupo vale), e às 12h30 "Fechado agora" mesmo com o base indo até 17h — Task 1.
3. Lugar com `dias: ["sab","dom"]` e grupo com `"seg"`: recusado na escrita com frase, nunca gravado — Task 1 (regra) e Task 2 (porta).
4. Tirar o `horario` ("Não tem") com `horarioPorDia` presente: recusado com frase, o grupo não fica órfão — Task 2.
5. Documento antigo (objeto `horario` de forma velha, sem `horarioPorDia`) lido e regravado sem mudança falsa no histórico — Task 2 (`campos-mudados`).

---

### Task 1: O dado e a leitura (puro)

**Files:**
- Modify: `src/types/ficha.ts` (perto de `horario` :262 e `dias` :295)
- Modify: `src/lib/horario.ts`
- Test: `tests/lib/horario.test.ts`, `tests/lib/horario-por-dia.test.ts` (novo)

**Interfaces:**
- Produces:
  - `export type GrupoDeHorario = { dias: readonly Dia[]; faixas: Horario }` (em `horario.ts`)
  - `Abertura` ganha `porDia?: readonly GrupoDeHorario[]`
  - `export function horarioDoDia(abertura: Abertura, dia: number): Horario | undefined` — as faixas do grupo que contém `DIAS[dia]`, senão `abertura.horario`
  - `export function problemaDosGrupos(grupos: unknown, doc: { horario?: unknown; dias?: unknown }): string | null` — `null` = válido; senão a frase da recusa
  - `aberturaDaFicha(f)` passa a ler `f.horarioPorDia` para `porDia`
  - schema: `horarioPorDia: z.array(z.object({ dias: z.array(z.enum(DIAS)).min(1), faixas: z.array(faixaSchema).min(1).max(3) })).min(1).max(3).optional()`

- [ ] **Step 1: Testes que falham** em `tests/lib/horario-por-dia.test.ts`, com o lugar `L = { horario: [{abre:"08:00",fecha:"17:00"}], porDia: [{ dias:["sab","dom"], faixas:[{abre:"07:00",fecha:"12:00"}] }] }` e `agoraRecife` montado por dia/minuto (índices de `DIAS`: dom=0 … sab=6):
  - `horarioDoDia(L, 6)` → as faixas 07–12; `horarioDoDia(L, 3)` → 08–17; sem `porDia` → `horario`.
  - `fechadoAgora(L, {dia:6, minutos:7*60+30})` → `false`; `{dia:6, minutos:12*60+30}` → `true`; `{dia:3, minutos:12*60+30}` → `false`.
  - `rotuloAbertura(L, {dia:0, minutos:18*60})` → `"abre amanhã às 8h"`; `{dia:5, minutos:18*60}` (sexta) → `"abre amanhã às 7h"`; `{dia:6, minutos:6*60}` → `"abre às 7h"`.
  - Com `dias: ["seg","sab"]` e o mesmo grupo só `["sab"]`: `{dia:1 (seg), minutos:18*60}` → `"abre sábado às 7h"`.
  - `rotuloFaixa(L, 6)` → `"Fecha às 12h, abre às 7h."`; `rotuloFaixa(L, 3)` e `rotuloFaixa(L)` → `"Fecha às 17h, abre às 8h."` (sem o dia, o base, como hoje).
  - `problemaDosGrupos` devolve frase (string não vazia) para cada caso, e `null` para `L.porDia` com `L.horario`:
    grupo sem dia; grupo sem faixa; faixa inválida (use `problemaDasFaixas` — a frase é a dela); mesmo dia em dois grupos; dia fora de `dias`; sem `horario`; grupo cobrindo todos os dias abertos (sem `dias`: os 7; com `dias`: todos eles); grupo com faixas iguais às do `horario`; mais de 3 grupos; não-lista.
  - Cada caso de recusa com frase DIFERENTE das outras (`new Set(frases).size === casos`), para nenhuma frase servir a duas causas.
- [ ] **Step 2: Rode** `npx vitest run tests/lib/horario-por-dia.test.ts` → FAIL (`horarioDoDia` não existe).
- [ ] **Step 3: Implemente** em `horario.ts`: `GrupoDeHorario`, `porDia` em `Abertura`, `horarioDoDia`; `fechadoAgora` usa `fechadoNaHora(horarioDoDia(abertura, agora.dia), agora.minutos)`; `rotuloAbertura` usa o horário de hoje para "abre às X" e, para o próximo dia, o primeiro dia aberto seguinte (respeitando `dias`) e as faixas DELE (`horarioDoDia`) — o rótulo do dia continua vindo de `rotuloDiaSeguinteAberto`/"abre amanhã" como hoje; `rotuloFaixa(abertura)` ganha um 2º parâmetro opcional `dia?: number` e, com ele, usa `horarioDoDia`; o Carimbo (`src/app/Carimbo.tsx:426`) passa o dia de agora. `problemaDosGrupos` com as frases da recusa como constantes exportadas `PENDENTE` (nomes livres, prefixo `GRUPO_`). O schema em `ficha.ts`, com a regra de escrita fora dele (mesmo motivo do `horario`: regra de leitura derrubaria a home — ver o comentário em :257).
- [ ] **Step 4: Rode** o arquivo novo e `tests/lib/horario.test.ts` → PASS; os testes antigos de horário passam sem mudança.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): o dado e a leitura do horario de cada dia`.

### Task 2: O registro e as portas de escrita

**Files:**
- Modify: `src/lib/campos-da-ficha.ts` (registro :136-137, `EspecieCampo` :49, conferência e `aplicarCampo`/`aplicarNoRascunho`/`removerCampo`)
- Modify: `src/lib/campos-da-pessoa.ts` (:26-33, :148)
- Modify: `src/lib/porta-de-publicar.ts` (:107-110), `src/lib/porta-da-pessoa.ts` (:217-220)
- Modify: `src/lib/campos-mudados.ts` (:49-50) se preciso
- Test: `tests/lib/aplicar-campo.test.ts`, `tests/lib/campos-da-ficha.test.ts`, `tests/lib/campos-mudados.test.ts`, os de porta de publicar das duas

**Interfaces:**
- Consumes: `problemaDosGrupos`, `GrupoDeHorario` (Task 1)
- Produces: entrada `{ caminho: "horarioPorDia", especie: "grupos", obrigatorio: false, grupo: "quando" }` logo depois de `dias`; `EspecieCampo` ganha `"grupos"`; o corpo da gravação é `{ slug, campo: "horarioPorDia", valor: GrupoDeHorario[] }` (lista inteira) ou `naoSei: true`; `export const TIRE_O_HORARIO_POR_DIA_ANTES: string` (PENDENTE) — a recusa de tirar o `horario` com grupos presentes.

- [ ] **Step 1: Testes que falham:**
  - `aplicarCampo(doc, "horarioPorDia", grupos)` com grupos válidos grava a lista com só `{dias, faixas}` (chave a mais some, como `conferirFaixas` faz); dias na ordem de `DIAS`; faixas na ordem do dia.
  - cada recusa de `problemaDosGrupos` chega como frase pela porta do campo (um caso por espécie de recusa basta aqui; a lista inteira é da Task 1).
  - `removerCampo(doc, "horario")` com `horarioPorDia` presente → recusa com `TIRE_O_HORARIO_POR_DIA_ANTES`; sem ele, como hoje.
  - `aplicarNoRascunho` aceita o mesmo; a pessoa (`campos-da-pessoa`) pode responder `horarioPorDia` (está em `OPCIONAIS_DA_PESSOA` e `PERMITIDAS`).
  - publicar (do João e dela) com `horarioPorDia` inválido → recusa com a frase de `problemaDosGrupos`; válido → publica.
  - `campos-mudados`: documento com `horario` na forma de objeto antigo + gravar `horarioPorDia` → só `horarioPorDia` aparece como mudado.
- [ ] **Step 2: Rode** → FAIL.
- [ ] **Step 3: Implemente** seguindo o ramo `faixas` existente (conferência → normaliza → `fichaSchema.parse`); a regra roda contra o documento JÁ com a mudança aplicada (pra `dias`/`horario` atuais valerem). E a gravação de `dias` e de `horario` também passa por `problemaDosGrupos` quando o documento tem `horarioPorDia` (mudar `dias` pode deixar um grupo num dia fechado) — recusa com a frase dela.
- [ ] **Step 4: Rode** → PASS.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): o registro e as portas`.

### Task 3: Coerência

**Files:**
- Modify: `src/lib/coerencia.ts` (`horario-invertido-sem-aviso` :403, `prosa-bate-com-hora-de-fechar` :453, `hora-de-fechar-sem-campo` :432)
- Test: `tests/lib/coerencia.test.ts`

- [ ] **Step 1: Testes que falham:** faixa invertida só DENTRO de um grupo → a regra acusa; prosa "fecha às 12h" com `horario` 8–17 e grupo 7–12 → NÃO acusa (bate com o grupo); "fecha às 13h" → acusa; os três lugares do acervo seguem sem violação nova.
- [ ] **Step 2: Rode** → FAIL. **Step 3:** as regras percorrem `horario` + as faixas de cada grupo. **Step 4:** PASS.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): a coerencia olha os grupos`.

### Task 4: O editor

**Files:**
- Create: `src/app/admin/campos/EditorGrupos.tsx`
- Modify: `src/app/admin/campos/EditorFaixas.tsx` (extrair as caixas de faixas num componente reaproveitável, sem mudar o editor atual), `src/app/admin/campos/tipos.ts` (`EspecieNaTela` :103), `src/app/admin/FormularioDeLugar.tsx` (`INSTRUMENTO`), `src/app/admin/FichaInteira.tsx` (o `Record` por espécie e o bloco "quando")
- Test: `tests/app/admin-editor-grupos.test.tsx` (novo)

**Interfaces:**
- Consumes: Task 2 (corpo da gravação, registro). As palavras novas da tela (PENDENTE), nomes livres: o título de um grupo, `+ outro grupo`, `tirar este grupo`.
- Produces: `EditorGrupos` com `PropsDoEditor`; recebe os `dias` do documento por prop (decida o caminho: `campo.opcoes` filtradas pelo servidor, como `vista` do mapa, ou prop nova) para oferecer só os dias abertos.

- [ ] **Step 1: Testes que falham** (render da `FichaInteira` com uma ficha sintética que tem `horario`, como os testes vizinhos fazem):
  - sem resposta: um grupo vazio, com as 7 caixas (ou só os dias de `dias`, quando há), as caixas de faixa, Salvar e "+ outro grupo"; sem "Não tem".
  - marcar sáb e dom, faixa 07:00–12:00, Salvar → corpo `{ slug, campo: "horarioPorDia", valor: [{ dias:["dom","sab"], faixas:[{abre:"07:00",fecha:"12:00"}] }] }` (dias na ordem do registro).
  - dia marcado num grupo aparece desligado no outro.
  - "+ outro grupo" some no 3º; "tirar este grupo" tira; com grupos salvos aparece "Não tem" (`naoTem`).
  - Desfazer volta ao salvo; o segundo toque do formulário vale (o editor avisa `AvisoDeMudanca`).
  - largura: nenhum `min-width`/largura fixa > 343px nas classes novas (siga o teste de CSS vizinho, se houver um).
- [ ] **Step 2: Rode** → FAIL. **Step 3: Implemente.** **Step 4:** PASS, e os testes do `EditorFaixas` passam sem mudança.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): o editor dos grupos`.

### Task 5: A pergunta, a revisão e o questionário

**Files:**
- Modify: `src/app/admin/novo/perguntas.ts` (TEXTO :118-120, ORDEM :162-163), `src/app/contribuir/perguntas.ts` (:12), `src/app/admin/novo/revisao.ts` (:79-80), `docs/questionario-ficha.md` (seção nova depois de "Os dias da semana", ~:482)
- Test: `tests/app/admin-formulario-de-lugar.test.tsx`, `tests/app/revisao-do-lugar.test.tsx`, o teste do questionário

- [ ] **Step 1: Testes que falham:** `ORDEM` termina em `"horario", "dias", "horarioPorDia"`; o texto da pergunta é exatamente `"Algum dia esse lugar abre ou fecha em outra hora? Se tiver, quais dias e que horas?"` (PENDENTE); a pessoa também tem a pergunta, na mesma posição relativa; a revisão mostra uma linha por grupo (os dias por extenso via `rotuloDias` + as faixas via `rotuloFaixaCurta`), e "Pulada"/"Sem resposta" como as outras; o questionário tem a seção `horarioPorDia` marcada `<!-- PENDENTE ... 2026-10-18 -->` no molde das outras.
- [ ] **Step 2–4:** FAIL → implementar → PASS. A seção do `dias` ganha uma linha apontando a nova; o "independente do `horario`" continua.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): a pergunta, a revisao e o questionario`.

### Task 6: A tela pública

**Files:**
- Modify: `src/app/[slug]/page.tsx` (:192-199 e :265), `src/lib/fatos-da-trilha.ts` (:34, :86-90), `src/lib/horario.ts` (rótulo das linhas)
- Test: `tests/app/ficha.test.tsx`, `tests/lib/fatos-da-trilha.test.ts`

**Interfaces:**
- Produces: `export function linhasDoHorario(f: { horario?: Horario; dias?: readonly Dia[]; horarioPorDia?: readonly GrupoDeHorario[] }): { dias: string; faixas: string }[]` em `horario.ts` — com grupos: uma linha pro base (dias abertos menos os dos grupos, por `rotuloDias`) e uma por grupo; sem grupos: `[]` (a ficha segue mostrando como hoje).

- [ ] **Step 1: Testes que falham:**
  - `linhasDoHorario(L)` → `[{ dias: "segunda, terça, quarta, quinta e sexta" (o que `rotuloDias` der), faixas: "8h–17h" }, { dias: <sáb e dom>, faixas: "7h–12h" }]`; sem `horarioPorDia` → `[]`.
  - a ficha de uma trilha sintética com grupos mostra as linhas no ticket no lugar do fato único de hora/dias; as três fichas do acervo renderizam o ticket IDÊNTICO ao de antes (compare com o texto atual que os testes de ficha já cravam).
  - a pílula do cartão (`fatos-da-trilha`) com grupos: o base + a marca curta (constante nova, PENDENTE); sem grupos, igual a hoje.
  - `aberturaDaFicha` recebe `horarioPorDia` no page e nos cartões (o carimbo do cartão fecha certo no sábado 12h30 — um teste no nível de `fatos`/cartão basta).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Portões e commit** `feat(horario-por-dia): a ficha e o cartao dizem a hora de cada dia`.

---

Depois da Task 6: revisão final da branch; o controlador monta o pacote de frases (todas as `PENDENTE` da rodada) para o
João ler antes de qualquer deploy.
