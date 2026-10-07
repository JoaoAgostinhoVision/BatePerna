# O lugar mandado por quem usa o app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma pessoa qualquer, logada com Google pelo Clerk, manda um lugar pelo celular em oito perguntas curtas; ele vai ao ar na hora, **marcado** em toda tela pública, com a regra padrão da chuva que o João edita pelo painel; o João confere, calibra, ou bloqueia quem mandou — sem código e sem deploy.

**Architecture:** O lugar da pessoa mora nas MESMAS tabelas dos lugares do João (`ficha_versoes`, `ficha_rascunhos`), e o que é DELE por lugar mora numa tabela nova, `origem_do_lugar`, chaveada pela IDENTIDADE do lugar (o menor `id` das versões dele — a mesma de `identidadeSql`, estável na troca de endereço). **Linha ausente = lugar do João**, e a ÚNICA porta que faz nascer linha é o publicar da pessoa, dentro do MESMO batch que põe a versão 1 no ar. A leitura do público passa a devolver `FichaNoAr` — o documento + a regra efetiva (a própria, ou a padrão do banco) + `origem` —, montada num lugar só (`noAr`), e é dessa `origem` que toda superfície pública tira a marca. A regra própria **não é coluna**: é "o documento tem `condicao.regra`" (ver a escolha 1 no fim). As rotas da pessoa são novas (`/api/contribuir/*`), conferem a sessão do Clerk por um adaptador só (`src/lib/contribuidor-sessao.ts`, dublado nos testes) e reusam as funções de banco e as portas do painel.

**Tech Stack:** Next.js 15.5 App Router (server components, `force-dynamic`, `src/middleware.ts`), TypeScript, Zod (`fichaSchema`), libSQL/Turso (`@libsql/client` 0.14), `@clerk/nextjs` (Core 3: `await auth()`, `currentUser()`, `clerkMiddleware`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-07-lugar-de-quem-usa-design.md`

---

## Global Constraints

- 🔴 **NADA DE PRODUÇÃO.** Nenhuma tarefa roda `npm run semear`, toca o Turso remoto, faz `git push`, `vercel`, `vercel --prod` ou `gh`. O deploy é depois do pacote de copy lido por ele (spec, "Ordem sugerida", item 6), FORA deste plano.
- 🔴 **Todo dispatch roda e cola a saída de quatro portões**, nesta ordem, e só fecha com os quatro verdes:
  1. `npx vitest run` — o flake conhecido `Worker exited unexpectedly` se resolve rodando de novo; **relate que aconteceu**, não esconda.
  2. `npx tsc --noEmit`
  3. **`npm run build`** — a branch já ficou SEM COMPILAR com a suíte verde e o `tsc` limpo, e dois assentos de revisão passaram por cima. O build roda **sem** chave do Clerk (o `next build` não lê `.env.development.local`): se ele exigir a chave, PARE e relate — nunca invente chave.
  4. `node scripts/mutar.mjs` → **42/0/0** (42 morreram, 0 sobreviveram, 0 sem alvo/diff/medição). Ele roda com a **árvore limpa** — rode DEPOIS do commit da tarefa; se acusar, conserte e faça commit novo.
- 🔴 **`scripts/mutar.mjs` acha alvo POR LINHA** em `src/lib/coerencia.ts` (≈40 entradas) e em `src/app/[slug]/page.tsx` (N12, a linha do `const precoCurto`). Confira com `grep -n "@[0-9]" scripts/mutar.mjs`. Em `coerencia.ts` este plano só faz **edições NA MESMA LINHA** (nenhuma linha nasce nem morre). Em `[slug]/page.tsx`, quem mudar a contagem de linhas ACIMA do `const precoCurto` **reancora a N12**: o `inicio`/`fim` da entrada `id: "N12"` (≈linha 859 do harness) e o texto `src/app/[slug]/page.tsx@125-125` do mapa cravado (≈linha 1613), os dois para o número que `grep -n "const precoCurto" "src/app/[slug]/page.tsx"` der; depois `node scripts/mutar.mjs N12` → "morreu".
- 🔴 **A INVARIANTE CENTRAL DA RODADA:** nenhum lugar com `conferido = false` aparece numa superfície pública sem a marca. Ela é provada por **VARREDURA** (Task 5: toda página pública enumerada do DISCO, toda ocorrência do nome do lugar) e por **mutação por superfície**. Superfície nova que mostre lugar entra na varredura ou deixa a suíte vermelha.
- **Toda frase de tela nova** entra com `// PENDENTE: redação minha, o João ainda não leu` na linha de cima e é listada no relatório da tarefa. Nenhum marcador existente (`LIDA:` / `PENDENTE`) é apagado.
- **A voz é de um lugar só.** Nenhum texto que afirme coisa sobre UM lugar mora num componente que serve todos. A marca afirma coisa sobre a ORIGEM ("o BatePerna não conferiu"), e é verdade em todo lugar que a recebe.
- **O nome e o e-mail de quem mandou NUNCA chegam a superfície pública** (spec, Parte 2). Só o painel do João os lê.
- **Toda página que lê banco declara `export const dynamic = "force-dynamic"`.**
- **Append-only em `ficha_versoes`.** Esconder, bloquear, voltar, calibrar: versão nova. `origem_do_lugar`, `contribuidores` e `regra_padrao` sobrescrevem — não afirmam nada que já foi à tela (mesma régua de `ficha_rascunhos`).
- **Toda condição de corrida mora NO MESMO statement que grava** (`WHERE EXISTS` / batch `write`), nunca numa leitura antes. É a régua de `gravarEdicao`, `publicarRascunho` e `trocarEndereco`.
- **Falha fechada no admin**, como hoje: rota/página sob `/admin` e `/api/admin/*` → **404** com o painel desligado, **401** sem sessão, ANTES de qualquer leitura. Use `lerConfigAdmin` + `avisarDesligado` + `sessaoValida` + `tokenDoCookie`.
- **As rotas da pessoa** (`/api/contribuir/*`): **401** sem sessão Clerk; **503** com frase quando o Clerk não responde; **403** com frase quando ela está bloqueada; **404** quando o lugar/rascunho não é DELA (nunca revela que existe); **409** quando o lugar dela já foi conferido. Nenhuma alcança lugar do João.
- 🔴 **A pessoa NUNCA recebe frase do painel nem o nome do que é de outro** (I3 da pré-auditoria). Toda colisão dela — par, gêmeo sem cidade, endereço ocupado, endereço antigo — responde **409 com `NOME_JA_EM_USO`** (`src/lib/porta-da-pessoa.ts`, PENDENTE), que não nomeia lugar nem rascunho de ninguém. As rotas dela leem a colisão ESTRUTURADA (`colisaoDoPar`/`colisaoDaMudanca`, Task 1) e nunca as funções que devolvem frase do painel (`parOcupado`, `parDaMudanca`, `enderecoDeLugar`, `enderecoDeRascunho`).
- 🔴 **O painel do João não lista nem age sobre rascunho de quem usa** (ruling de produto da pré-auditoria): `listarRascunhos`, `lerRascunho`, `regravarRascunho`, `moverRascunho` e `apagarRascunho` são SÓ do João (`contribuidor IS NULL`). A colisão por par lê TODO rascunho (`todosOsRascunhos`), e a frase "continue por ele, na lista do painel" só sai quando o rascunho que colide é do João.
- 🔴 **O lugar dela nunca toma o endereço antigo de outro lugar** (ruling de produto da pré-auditoria): o link velho do João continua levando ao lugar dele. Recusado no rascunho (`criarRascunhoDaPessoa`/`moverRascunhoDaPessoa`) e, por corrida, no próprio batch do publicar (`publicarRascunho` com contribuidor).
- **Nada é pré-preenchido** (spec do painel §4.4): nenhum campo herda de outro lugar, de busca externa, de mim ou da regra padrão.
- **Mutação medida.** Cada tarefa lista as mutações à mão que as provas dela têm de matar, e prova que cada uma APLICOU (`git diff --stat` não-vazio) antes de rodar a suíte. Mutação que sobrevive = prova que falta, escrita NA tarefa.
- **Arquivo de rota ou de página do Next não exporta nada além do que o Next aceita** (`tests/deploy/exports-de-rota.test.ts` trava as rotas; o `next build` trava as páginas). Frase de tela mora num módulo de palavras ou num componente, nunca em `route.ts`/`page.tsx`.
- **`git add` por caminho, nunca `git add -A`.** **`docs/RESUME.md` nunca entra em commit de tarefa.**
- **O Clerk é dublado em todo teste**: `vi.mock("@/lib/contribuidor-sessao", ...)` nas rotas e páginas; `vi.mock("@clerk/nextjs/server", ...)` só no teste do próprio adaptador e do middleware. Nenhuma chave real em teste.
- 🔴 **O estado do dublê do Clerk mora em `globalThis`, nunca num `const` de módulo** (C2 da pré-auditoria, MEDIDO em 07/10 com o vitest 2.1.9 do repo). As rotas da pessoa são testadas com `vi.resetModules()` no `beforeEach`; a fábrica do `vi.mock` reimporta `tests/sessao-da-pessoa.ts` depois do reset, e com o estado num `const` a rota lê uma instância e o teste muda OUTRA — medido: "sem sessão" esperava 401 e recebeu 200, "Clerk fora" esperava 503 e recebeu 200. Com `globalThis.__sessaoDaPessoa ??= {…}`, as duas sondas passaram. A sonda da Task 10 trava isto; ninguém "conserta" a rota nem afrouxa o caso por causa do dublê.
- **Frase exportada sob `src/app/admin/**` entra em `CUNHADAS_AQUI`** (`tests/app/admin-editores-de-campo.test.tsx`) NO MESMO commit (I1 da pré-auditoria): o caso "toda frase que o painel EXPORTA está no controle de completude do cerco" fica vermelho sem isso. Tarefas que fazem: 6, 7, 8, 13, 15.

---

## Review Focus

Cinco classes de entrada que a spec implica, que nenhuma prova da spec cobre, e que mordem uma pessoa de verdade. Cada uma tem o teste que a prende, na tarefa dona:

1. **A pessoa manda pela API um campo que a tela dela não pergunta** — `voz`, `condicao.regra.limiar_mm`, `discriminador.como_ler`, `condicao.severidade` — pra escrever com a voz do app ou se autocalibrar. Esperado: **400, nada gravado**; e a porta de publicar da pessoa recusa documento com chave fora da lista dela mesmo que ele tenha entrado por outro caminho. *(Task 10, Step 1 "campo fora da lista dela"; Task 11, Step 1 "documento com chave fora da lista")*
2. **A aba velha da pessoa grava DEPOIS que o João tocou "Conferi" ou "Bloquear"** (ou ele confere no meio do PUT dela). Esperado: **409/403, nada gravado**, decidido no MESMO `INSERT` — o lugar conferido nunca volta a ser editado por ela. *(Task 12, Step 1 "a corrida com o Conferi"; Task 15, Step 1 "bloqueada no meio do formulário")*
3. **Nome + cidade iguais a um lugar do João, ou a um endereço antigo dele.** Esperado: **409 com a frase DELA (`NOME_JA_EM_USO`), que não nomeia ninguém** — nunca a do painel —, e nunca uma versão nova do lugar do João no endereço dele. Endereço antigo de outro lugar **nunca é tomado por lugar dela** (ruling de produto da pré-auditoria): o rascunho dela não nasce nem se muda pra lá, e o publicar dela recusa no próprio batch; o publicar do JOÃO continua retomando, com a régua de hoje. *(Task 1, Step 1 "quem usa não publica num endereço antigo"; Task 10, Step 1 "o par de um lugar do João" e "um endereço antigo de um lugar do João"; Task 11, Step 1 "o endereço virou endereço antigo")*
4. **Sessão do Clerk vence no meio do formulário.** Esperado: o PUT responde **401 sem tocar o rascunho**; a tela recarrega, o Clerk pede login e devolve à MESMA pergunta (`?p=N` na URL). *(Task 10, Step 1 "401 não toca o rascunho"; Task 13, Step 1 "com recarregarSe401, o 401 recarrega")*
5. **`regra_padrao` sem linha, com severidade torta, ou gravada pelo painel como 0/0 ou limiar 0.** Esperado: leitura sem linha/torta **estoura** (erro honesto — nunca um carimbo com número inventado); gravação 0/0 ou limiar ≤ 0 **recusada com frase**, nada gravado. *(Task 1, Step 1 "severidade torta estoura"; Task 7, Step 1 "zera as duas janelas")*

---

## Mapa de arquivos

| Arquivo | Papel | Tarefa |
|---|---|---|
| `src/lib/regra-padrao.ts` (novo) | tipo `RegraPadrao`, `REGRA_PADRAO_INICIAL`, `noAr` — puro, sem zod | 1, 2 |
| `src/lib/porta-da-regra-padrao.ts` (novo) | `formaDaRegra`, `lerRegraDoCorpo` e as frases da recusa — SÓ servidor | 7, 8 |
| `src/lib/db.ts` | tabelas novas, `lerRegraPadrao`/`gravarRegraPadrao`, `lerAcervoComOrigem`, `lugarDoDono`, `publicarRascunho(…, contribuidor)` (recusa endereço antigo pra ela), `listarRascunhos`/`lerRascunho`/`regravarRascunho`/`moverRascunho`/`apagarRascunho` só do João, `todosOsRascunhos`/`rascunhoDeQualquerUm` (só colisão) | 1 |
| `src/lib/par-de-lugar.ts`, `src/lib/rascunho.ts`, `src/app/api/admin/rascunho/route.ts`, `src/app/api/admin/endereco/route.ts` | a colisão ESTRUTURADA (`colisaoDoPar` & cia., `fraseDoPainel`) lendo todo rascunho; as duas frases do painel pro rascunho de quem usa | 1 |
| `tests/app/admin-editores-de-campo.test.tsx` | `CUNHADAS_AQUI` ganha cada frase nova exportada sob `src/app/admin` | 6, 7, 8, 13, 15 |
| `src/types/ficha.ts` | os campos que a pessoa não responde viram opcionais; `FichaNoAr` | 2 |
| `src/lib/ficha-fonte.ts`, `src/lib/ficha.ts` | leitura pública devolve `FichaNoAr` | 2 |
| `src/lib/severidade.ts`, `src/lib/carimbo-fase.ts`, `src/app/Carimbo.tsx` | `Voz.regraPropria`, "seco" sem "carro comum", meia-linha | 3 |
| `src/lib/origem.ts` (novo) | as palavras da marca — puro, lido por client component | 3, 5 |
| `src/app/[slug]/page.tsx`, `src/app/ListaDoAcervo.tsx` | cala bloco ausente; faixa | 4, 5 |
| `src/app/CartaoTrilha.tsx`, `src/app/PinTrilha.tsx`, `src/app/MapaHome.tsx` | etiqueta e contorno | 5 |
| `src/lib/db-contribuidor.ts` (novo) | tudo de banco que é só da pessoa e do "Conferi"/"Bloquear" | 6, 10, 12, 15 |
| `src/app/admin/*`, `src/app/api/admin/{conferir,regra-padrao,calibrar,contribuidor}` | o painel | 6, 7, 8, 15 |
| `src/lib/contribuidor-sessao.ts` (novo), `src/middleware.ts` (novo) | a ÚNICA porta do Clerk | 9 |
| `src/lib/campos-da-pessoa.ts`, `src/lib/porta-da-pessoa.ts` (novos) | a lista dela e a porta de publicar dela | 10, 11 |
| `src/app/api/contribuir/{rascunho,publicar,lugar}/route.ts` (novos) | as rotas dela | 10, 11, 12 |
| `src/app/admin/FormularioDeLugar.tsx`, `TelaDePublicar.tsx`, `BotaoDesistir.tsx`, `novo/enderecos.ts`, `campos/gravar.ts` | o formulário do painel aprende a servir quem usa | 13 |
| `src/app/contribuir/**` (novo), `src/app/BarraNavegacao.tsx`, `src/app/sw.ts` | as telas dela e a entrada | 14 |
| `tests/lib/frases-da-rodada-marcadas.test.ts` (novo) | toda frase nova nasce marcada | 16 |

---

### Task 1: O banco aprende a origem do lugar, a regra padrão, e o publicar de quem usa

**Files:**
- Create: `src/lib/regra-padrao.ts`
- Modify: `src/lib/db.ts` — `ensureSchema` (fim, logo depois da CHAMADA `await migrarColunaEnderecoAnterior(client);`, que está em `:105`; a função mora em `:119`), `AutorVersao` (:394), `publicarRascunho` (:957-993), `regravarRascunho` (:689), `moverRascunho` (:737), `lerRascunho` (:749), `listarRascunhos` (:759-764), `apagarRascunho` (:776); funções novas no fim do arquivo
- Modify: `src/lib/par-de-lugar.ts` — a colisão por par passa a ser ESTRUTURADA (`colisaoDoPar`, `colisaoDaTroca`, `colisaoDaMudanca`, `fraseDoPainel`) e a ler `todosOsRascunhos`; `parOcupado`/`parDaTroca`/`parDaMudanca` ficam, com a mesma assinatura, como as portas do painel (I3, I4)
- Modify: `src/lib/rascunho.ts` — duas frases do painel pro rascunho de quem usa: `parDeRascunhoDeQuemUsa`, `enderecoDeRascunhoDeQuemUsa` (I4)
- Modify: `src/app/api/admin/rascunho/route.ts` — `quemOcupa` (:116-122) lê `rascunhoDeQualquerUm` (I4)
- Modify: `src/app/api/admin/endereco/route.ts` — a leitura do rascunho que ocupa o endereço novo (:89) passa a `rascunhoDeQualquerUm` (M11: a `lerRascunho` filtrada não o veria)
- Modify: `src/app/admin/HistoricoDaFicha.tsx:11` (o rótulo do autor novo)
- Modify: `tests/banco.ts` — `semearAcervo` (:84-100) limpa as tabelas novas; helper `semearLugarDaPessoa`
- Test: `tests/lib/db-origem.test.ts` (criar), `tests/app/historico-da-ficha.test.tsx` (acrescentar um caso), `tests/api/route-admin-rascunho.test.ts` (acrescentar dois casos), `tests/api/route-admin-endereco.test.ts` (acrescentar um caso)

**Interfaces:**
- Consumes: `SEVERIDADES`, `Severidade` de `@/lib/severidade`; o `publicarRascunho` de hoje.
- Produces:
  - `src/lib/regra-padrao.ts`: `export type RegraPadrao = { janela_previsao_horas: number; janela_passado_horas: number; limiar_mm: number; severidade: Severidade }` e `export const REGRA_PADRAO_INICIAL: RegraPadrao` (3 / 6 / 0.2 / `"cuidado"`).
  - `src/lib/db.ts`:
    - `export type AutorVersao = "painel" | "semente" | "contribuidor"`
    - `export type OrigemDoLugar = { contribuidor: string | null; conferido: boolean }`
    - `export type LinhaDoAcervo = { doc: string; oculto: boolean } & OrigemDoLugar`
    - `export type AcervoComOrigem = { linhas: Map<string, LinhaDoAcervo>; padrao: RegraPadrao }`
    - `export async function lerRegraPadrao(client: Client): Promise<RegraPadrao>` — estoura sem linha ou com severidade torta
    - `export async function gravarRegraPadrao(client: Client, r: RegraPadrao, agora: number): Promise<void>`
    - `export async function lerAcervoComOrigem(client: Client): Promise<AcervoComOrigem>` — a versão atual de TODO lugar (escondidos inclusive) + a origem + a regra padrão, num batch `read` só
    - `export async function lugarDoDono(client: Client, slug: string): Promise<{ versao: FichaVersao; origem: OrigemDoLugar; padrao: RegraPadrao } | null>`
    - `export async function publicarRascunho(client, slug, doc, agora, atualizadoEm, contribuidor: string | null = null): Promise<boolean>` — `null` é o João, como hoje; com contribuidor, recusa `slug` que é endereço antigo de outro lugar
    - `listarRascunhos`, `lerRascunho`, `regravarRascunho`, `moverRascunho`, `apagarRascunho` passam a alcançar SÓ os rascunhos do João (`contribuidor IS NULL`) — mesmas assinaturas
    - `export type RascunhoComDono = Rascunho & { contribuidor: string | null }`
    - `export async function todosOsRascunhos(client: Client): Promise<RascunhoComDono[]>` — SÓ pra colisão
    - `export async function rascunhoDeQualquerUm(client: Client, slug: string): Promise<RascunhoComDono | null>` — SÓ pra escolher a frase de quem ocupa
  - `src/lib/par-de-lugar.ts`:
    - `export type Colisao = { de: "lugar" | "rascunho-do-joao" | "rascunho-de-quem-usa"; semCidade: boolean; quem: string }`
    - `export async function colisaoDoPar(nome: string, cidade: string, o: { exceto: string | null; nomeNovo: boolean }): Promise<Colisao | null>`
    - `export async function colisaoDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<Colisao | null>`
    - `export async function colisaoDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<Colisao | null>`
    - `export function fraseDoPainel(c: Colisao): string`
    - `parOcupado`, `parDaTroca`, `parDaMudanca`: mesmas assinaturas de hoje (`Promise<string | null>`), agora `fraseDoPainel` da colisão
  - `src/lib/rascunho.ts`: `export const parDeRascunhoDeQuemUsa = (quem: string): string`, `export const enderecoDeRascunhoDeQuemUsa = (quem: string): string`
  - `tests/banco.ts`: `export const PESSOA_DE_TESTE = "user_pessoa_de_teste"` e `export async function semearLugarDaPessoa(client: Client, o: { nome: string; cidade: string; contribuidor?: string; agora?: number }): Promise<string>` (devolve o slug)

🔴 **O desenho da tabela de origem, e por que linha AUSENTE é o João.** `origem_do_lugar` só tem linha de lugar mandado por quem usa. A alternativa (linha pra todo lugar, ausente = não conferido) obrigaria a semente, o publicar do João e `tests/banco.ts` a escreverem linha — três portas que podem esquecer, e o esquecimento poria "Mandado por alguém que usa o app" num lugar DELE. Aqui só uma porta faz nascer linha, e ela mora no MESMO batch que põe a versão 1 da pessoa no ar: ou os dois, ou nenhum. A Task 5 prova o outro lado (lugar da pessoa sem marca = vermelho).

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/db-origem.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apagarRascunho,
  criarRascunho,
  enderecoNovoDe,
  ensureSchema,
  gravarRegraPadrao,
  gravarVersao,
  lerAcervoComOrigem,
  lerRascunho,
  lerRegraPadrao,
  listarRascunhos,
  lugarDoDono,
  moverRascunho,
  publicarRascunho,
  rascunhoDeQualquerUm,
  regravarRascunho,
  todosOsRascunhos,
  versaoAtual,
} from "@/lib/db";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { AGORA_SEMENTE, PESSOA_DE_TESTE, semearAcervo, semearLugarDaPessoa } from "../banco";

let c: Client;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
});
afterEach(() => c.close());

const contarOrigens = async () =>
  Number((await c.execute("SELECT COUNT(*) AS n FROM origem_do_lugar")).rows[0].n);

describe("a regra padrão da chuva mora no banco", () => {
  it("nasce 3 h pra frente, 6 h pra trás, 0,2 mm, cuidado — a decisão dele de 07/10", async () => {
    expect(await lerRegraPadrao(c)).toEqual({
      janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado",
    });
    expect(REGRA_PADRAO_INICIAL).toEqual(await lerRegraPadrao(c));
  });

  it("gravar muda a leitura", async () => {
    await gravarRegraPadrao(c, { janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" }, AGORA_SEMENTE + 5);
    expect(await lerRegraPadrao(c)).toEqual({ janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" });
  });

  // 🔴 `ensureSchema` roda a cada `npm run semear`. Se a semente da regra fosse
  // um upsert, o deploy seguinte desfaria em silêncio o que o João mudou pelo
  // painel — a família do "semente regrava o que o dono escondeu".
  it("rodar o schema de novo NÃO devolve a regra ao valor inicial", async () => {
    await gravarRegraPadrao(c, { janela_previsao_horas: 5, janela_passado_horas: 9, limiar_mm: 1, severidade: "espera" }, AGORA_SEMENTE + 5);
    await ensureSchema(c);
    await ensureSchema(c);
    expect((await lerRegraPadrao(c)).janela_passado_horas).toBe(9);
  });

  // Review Focus 5: sem linha, ou com severidade torta, é ERRO — nunca um
  // carimbo com número que ninguém escolheu.
  it("sem linha, a leitura estoura", async () => {
    await c.execute("DELETE FROM regra_padrao");
    await expect(lerRegraPadrao(c)).rejects.toThrow(/regra padrão/);
    await expect(lerAcervoComOrigem(c)).rejects.toThrow(/regra padrão/);
  });

  it("severidade torta estoura, e não vira 'cuidado' por padrão", async () => {
    await c.execute("UPDATE regra_padrao SET severidade = 'talvez' WHERE id = 1");
    await expect(lerRegraPadrao(c)).rejects.toThrow(/talvez/);
  });
});

describe("a migração: o acervo de antes é do João", () => {
  it("todo lugar existente sai conferido e sem contribuidor, e nenhuma linha de origem nasce", async () => {
    await ensureSchema(c);
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.size, "a premissa: o acervo foi semeado").toBeGreaterThan(2);
    for (const [slug, l] of linhas) {
      expect({ slug, conferido: l.conferido, contribuidor: l.contribuidor }).toEqual({ slug, conferido: true, contribuidor: null });
    }
    expect(await contarOrigens()).toBe(0);
  });
});

describe("publicar de quem usa", () => {
  it("o lugar vai ao ar NÃO conferido, com o contribuidor, e a versão diz 'contribuidor'", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get(slug)).toMatchObject({ oculto: false, conferido: false, contribuidor: PESSOA_DE_TESTE });
    expect((await versaoAtual(c, slug))!.autor).toBe("contribuidor");
    expect(await contarOrigens()).toBe(1);
  });

  it("os lugares do João continuam conferidos depois que um da pessoa entra", async () => {
    await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get("rampa-do-pepe")).toMatchObject({ conferido: true, contribuidor: null });
  });

  // 🔴 A ARMADILHA DO `INTEGER PRIMARY KEY`: `INSERT … SELECT MIN(id) …` com o
  // portão fechado devolve UMA linha com NULL, e NULL numa chave inteira vira
  // um rowid NOVO — uma origem órfã apontando pra um lugar que não é o dela.
  it("publicar recusado (rascunho mudou) não deixa linha de origem nenhuma", async () => {
    const slug = "pedra-mandada-cidade-teste";
    const doc = JSON.stringify({ slug, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, doc, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE - 1, PESSOA_DE_TESTE)).toBe(false);
    expect(await contarOrigens()).toBe(0);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("o publicar do painel não leva ao ar rascunho de quem usa", async () => {
    const slug = "pedra-mandada-cidade-teste";
    const doc = JSON.stringify({ slug, modos: [] });
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, doc, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE)).toBe(false);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("e quem usa não leva ao ar rascunho do João", async () => {
    const slug = "lugar-do-joao-cidade";
    const doc = JSON.stringify({ slug, modos: [] });
    expect(await criarRascunho(c, slug, doc, AGORA_SEMENTE)).toBe(true);
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE, PESSOA_DE_TESTE)).toBe(false);
    expect(await versaoAtual(c, slug)).toBeNull();
  });

  it("pessoa bloqueada não publica", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, NULL, NULL, 1, ?)",
      args: [PESSOA_DE_TESTE, AGORA_SEMENTE],
    });
    await expect(semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" })).rejects.toThrow(/não publicou/);
    expect(await contarOrigens()).toBe(0);
  });

  // 🔴 RULING DE PRODUTO DA PRÉ-AUDITORIA (07/10): o lugar dela NUNCA toma o
  // endereço antigo de outro lugar — o link velho que circula (WhatsApp)
  // continua levando ao lugar de onde ele veio. A recusa mora no 1º passo do
  // batch: a corrida (o João troca um endereço DEPOIS que o rascunho dela
  // nasceu) não passa.
  it("quem usa não publica num endereço antigo de outro lugar, e o link velho continua", async () => {
    const slug = "pedra-mandada-cidade-teste";
    await c.execute({
      sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)",
      args: [slug, AGORA_SEMENTE],
    });
    await expect(semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" })).rejects.toThrow(/não publicou/);
    expect(await versaoAtual(c, slug)).toBeNull();
    expect(await enderecoNovoDe(c, slug)).toBe("rampa-do-pepe");
    expect(await contarOrigens()).toBe(0);
  });

  // O controle do caso de cima: a recusa é SÓ de quem usa. O publicar do JOÃO
  // continua retomando o endereço antigo (E5 da Tarefa 11e, a régua de hoje).
  it("o publicar do JOÃO continua retomando o endereço antigo", async () => {
    const slug = "lugar-do-joao-cidade";
    const doc = JSON.stringify({ slug, modos: [] });
    await c.execute({
      sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)",
      args: [slug, AGORA_SEMENTE],
    });
    expect(await criarRascunho(c, slug, doc, AGORA_SEMENTE)).toBe(true);
    expect(await publicarRascunho(c, slug, doc, AGORA_SEMENTE + 1, AGORA_SEMENTE)).toBe(true);
    expect(await enderecoNovoDe(c, slug)).toBeNull();
  });
});

describe("a lista de rascunhos do painel é só do João", () => {
  it("o rascunho de quem usa não aparece em listarRascunhos", async () => {
    await criarRascunho(c, "do-joao-cidade", JSON.stringify({ slug: "do-joao-cidade" }), AGORA_SEMENTE);
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: ["da-pessoa-cidade", JSON.stringify({ slug: "da-pessoa-cidade" }), AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
    expect((await listarRascunhos(c)).map((r) => r.slug)).toEqual(["do-joao-cidade"]);
  });
});

// 🔴 M11 E I4 DA PRÉ-AUDITORIA, e o ruling de produto: o painel do João NÃO
// age sobre rascunho de quem usa (nem lê, nem regrava, nem move, nem apaga —
// um caso por porta), mas a COLISÃO o vê, com o dono.
describe("o rascunho de quem usa: o painel não alcança, a colisão vê", () => {
  const DELA = "da-pessoa-cidade";
  const DOC_DELA = JSON.stringify({ slug: DELA });
  beforeEach(async () => {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [DELA, DOC_DELA, AGORA_SEMENTE, PESSOA_DE_TESTE],
    });
  });

  it("lerRascunho do painel não o lê", async () => {
    expect(await lerRascunho(c, DELA)).toBeNull();
    expect(await rascunhoDeQualquerUm(c, DELA), "a premissa: o rascunho dela está no banco").not.toBeNull();
  });

  it("regravarRascunho do painel não o regrava", async () => {
    expect(await regravarRascunho(c, DELA, '{"x":1}', AGORA_SEMENTE + 1)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, DELA))?.doc).toBe(DOC_DELA);
  });

  it("moverRascunho do painel não o move", async () => {
    expect(await moverRascunho(c, DELA, "outro-cidade", '{"slug":"outro-cidade"}', AGORA_SEMENTE + 1)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, DELA))?.slug).toBe(DELA);
  });

  it("apagarRascunho do painel não o apaga", async () => {
    expect(await apagarRascunho(c, DELA)).toBe(false);
    expect(await rascunhoDeQualquerUm(c, DELA)).not.toBeNull();
  });

  it("todosOsRascunhos e rascunhoDeQualquerUm o veem, com o dono — e os do João com dono nulo", async () => {
    await criarRascunho(c, "do-joao-cidade", JSON.stringify({ slug: "do-joao-cidade" }), AGORA_SEMENTE + 1);
    expect((await todosOsRascunhos(c)).map((r) => [r.slug, r.contribuidor])).toEqual([
      ["do-joao-cidade", null],
      [DELA, PESSOA_DE_TESTE],
    ]);
    expect(await rascunhoDeQualquerUm(c, DELA)).toMatchObject({ slug: DELA, contribuidor: PESSOA_DE_TESTE });
    expect(await rascunhoDeQualquerUm(c, "ninguem-cidade")).toBeNull();
  });
});

describe("lerAcervoComOrigem e lugarDoDono", () => {
  it("traz os escondidos, marcados, e a regra padrão da mesma leitura", async () => {
    await c.execute("UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = 'rampa-do-pepe'");
    const { linhas, padrao } = await lerAcervoComOrigem(c);
    expect(linhas.get("rampa-do-pepe")?.oculto).toBe(true);
    expect(padrao).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("lugarDoDono diz a origem de um lugar da pessoa e de um do João, e null pra ninguém", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect((await lugarDoDono(c, slug))!.origem).toEqual({ contribuidor: PESSOA_DE_TESTE, conferido: false });
    expect((await lugarDoDono(c, "rampa-do-pepe"))!.origem).toEqual({ contribuidor: null, conferido: true });
    expect(await lugarDoDono(c, "ninguem-mora-aqui")).toBeNull();
  });

  // 🔴 A origem é do LUGAR, não do endereço nem da versão: a identidade (menor
  // id) anda com ele na troca de endereço, e a versão ATUAL não é a 1ª.
  it("a origem acompanha o lugar com 2 versões e endereço novo", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    const atual = await versaoAtual(c, slug);
    await gravarVersao(c, slug, atual!.doc, "contribuidor", AGORA_SEMENTE + 99);
    await c.execute({ sql: "UPDATE ficha_versoes SET ficha_slug = 'endereco-novo-cidade' WHERE ficha_slug = ?", args: [slug] });
    expect((await lerAcervoComOrigem(c)).linhas.get("endereco-novo-cidade")).toMatchObject({ conferido: false, contribuidor: PESSOA_DE_TESTE });
  });

  // 🔴 Valor torto na coluna sai NÃO conferido — o lado que mostra a marca.
  it("conferido torto numa linha de origem é lido como não conferido", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    await c.execute("UPDATE origem_do_lugar SET conferido = 'sim'");
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(false);
  });
});
```

E em `tests/app/historico-da-ficha.test.tsx`, um caso no molde dos que já estão lá (leia o arquivo antes; ele monta `VersaoNaTela` à mão — siga a forma de um caso vizinho e troque só o `autor`):

```ts
it("a versão gravada por quem usa o app diz 'quem mandou', e nenhuma outra diz", () => {
  const { container } = render(
    <HistoricoDaFicha versoes={[{ id: 9, ficha_slug: "x", doc: "{}", autor: "contribuidor", criado_em: 1_758_000_000, oculto: false, mudou: [], ato: null }]} />,
  );
  expect(container.textContent).toContain("quem mandou");
});
```

Em `tests/api/route-admin-rascunho.test.ts` (I4 da pré-auditoria), um `describe` novo no fim do arquivo — importe `PESSOA_DE_TESTE` de `../banco`, `rascunhoDeQualquerUm` de `@/lib/db` e `enderecoDeRascunhoDeQuemUsa`, `parDeRascunhoDeQuemUsa` de `@/lib/rascunho`; `criar`, `NOME`, `CIDADE`, `S` e `listarRascunhos` já existem no arquivo:

```ts
// 🔴 I4 DA PRÉ-AUDITORIA (07/10): o rascunho de quem usa o app não está na lista
// do painel — então a frase "continue por ele, na lista do painel" seria
// MENTIRA quando é ele que colide. E a colisão tem de VÊ-LO (`todosOsRascunhos`),
// senão dois rascunhos de mesmo par virariam dois lugares no mesmo par.
describe("o rascunho de quem usa o app, visto do painel", () => {
  async function rascunhoDela(slug: string, nome: string, cidade: string): Promise<void> {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [slug, JSON.stringify({ slug, modos: [], cidade, trajeto: { waypoints: [{ nome }] } }), AGORA - 5, PESSOA_DE_TESTE],
    });
  }

  it("o PAR de um rascunho dela: 409 com a frase de quem usa — nunca 'na lista do painel' —, e nada nasce", async () => {
    await rascunhoDela(S, NOME, CIDADE);
    const res = await criar("lugar   marcador UM", " cidade marcador UM ");
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(parDeRascunhoDeQuemUsa(`${NOME} (${CIDADE})`));
    expect(frase).not.toMatch(/lista do painel/);
    expect(await listarRascunhos(c)).toEqual([]);
    expect((await rascunhoDeQualquerUm(c, S))?.contribuidor).toBe(PESSOA_DE_TESTE);
  });

  // A fronteira entre o nome e a cidade que anda (o molde do caso "endereço
  // ocupado por um RASCUNHO de nome diferente", lá em cima).
  it("o ENDEREÇO de um rascunho dela, de nome diferente: 409 com a frase de quem usa, e ele não muda", async () => {
    await rascunhoDela("lugar-marcador-cidade-marcador", "Lugar Marcador", "Cidade Marcador");
    const res = await criar("Lugar Marcador Cidade", "Marcador");
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoDeRascunhoDeQuemUsa("Lugar Marcador (Cidade Marcador)"));
    expect(await rascunhoDeQualquerUm(c, "lugar-marcador-cidade-marcador")).toMatchObject({ contribuidor: PESSOA_DE_TESTE });
  });
});
```

(Os controles já existem no mesmo arquivo: "nome E cidade de um rascunho que já existe: 409" espera `parDeRascunho` e "endereço ocupado por um RASCUNHO de nome diferente" espera `enderecoDeRascunho` — com rascunho do JOÃO, a frase dele não muda.)

Em `tests/api/route-admin-endereco.test.ts`, logo depois do caso "novo ocupado por um rascunho: 409 dizendo quem, e nada muda", um irmão com o MESMO arranjo, trocando só o dono do rascunho (importe `PESSOA_DE_TESTE` de `../banco`):

```ts
  // M11 da pré-auditoria: a `lerRascunho` do painel não vê rascunho de quem usa;
  // a frase de quem ocupa lê `rascunhoDeQualquerUm`. Sem isso, a troca seria
  // recusada pelo batch e a resposta seria "nada mudou", sem dizer por quê.
  it("novo ocupado por um rascunho de QUEM USA: 409 dizendo quem, e nada muda", async () => {
    await c.execute({
      sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
      args: [B, JSON.stringify({ slug: B, cidade: "Outra Marcadora", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), AGORA - 5, PESSOA_DE_TESTE],
    });
    const antes = await retrato();
    const res = await POST(pedido({ slug: A }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(enderecoOcupadoPorRascunho(B, "Lugar Marcador (Outra Marcadora)"));
    expect(await retrato()).toEqual(antes);
  });
```

(Se o caso vizinho preparar `A` com uma linha antes de `criarRascunho`, repita a mesma preparação aqui — o que muda é SÓ o `contribuidor` do rascunho.)

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/db-origem.test.ts tests/app/historico-da-ficha.test.tsx tests/api/route-admin-rascunho.test.ts tests/api/route-admin-endereco.test.ts`
Expected: FAIL — `lerRegraPadrao`/`lerAcervoComOrigem`/`todosOsRascunhos`/`rascunhoDeQualquerUm` não exportados; `semearLugarDaPessoa` e as duas frases de quem usa não existem.

- [ ] **Step 3: Escrever `src/lib/regra-padrao.ts`**

```ts
import type { Severidade } from "@/lib/severidade";

/** A REGRA PADRÃO DA CHUVA (spec de 07/10, Parte 4): o que o carimbo usa em
 *  todo lugar que não tem regra própria — hoje, todo lugar mandado por quem usa
 *  o app. Mora no BANCO (`regra_padrao`), e a tela dele é `/admin/chuva`:
 *  mudar não pede código nem deploy.
 *
 *  Puro e sem zod, pela régua de `severidade.ts`: client component pode ler. */
export type RegraPadrao = {
  janela_previsao_horas: number;
  janela_passado_horas: number;
  limiar_mm: number;
  severidade: Severidade;
};

/** A semente da linha, e SÓ a semente: `ensureSchema` a grava com
 *  `INSERT OR IGNORE`, então ela nunca desfaz o que o João mudou depois.
 *  Os números são a decisão dele de 07/10: *"use a sua sugestão"*. */
export const REGRA_PADRAO_INICIAL: RegraPadrao = {
  janela_previsao_horas: 3,
  janela_passado_horas: 6,
  limiar_mm: 0.2,
  severidade: "cuidado",
};
```

- [ ] **Step 4: O schema novo, em `src/lib/db.ts`**

No topo, junto dos imports:

```ts
import { REGRA_PADRAO_INICIAL, type RegraPadrao } from "@/lib/regra-padrao";
import { SEVERIDADES, type Severidade } from "@/lib/severidade";
```

No FIM de `ensureSchema`, depois de `await migrarColunaEnderecoAnterior(client);`:

```ts
  // 🔴 A ORIGEM DO LUGAR (spec de 07/10): quem mandou e se o João conferiu.
  // Chave = a IDENTIDADE do lugar (menor `id` das versões, `identidadeSql`),
  // que anda com ele na troca de endereço. SÓ lugar mandado por quem usa tem
  // linha: ausente = lugar do João, conferido por definição. A única porta que
  // faz nascer linha é `publicarRascunho` com contribuidor, no MESMO batch da
  // versão 1. Sobrescreve (o "Conferi" é UPDATE): não afirma nada que já foi
  // à tela — o que foi à tela está em `ficha_versoes`.
  await client.execute(`CREATE TABLE IF NOT EXISTS origem_do_lugar (
    lugar INTEGER PRIMARY KEY, contribuidor TEXT NOT NULL,
    conferido INTEGER NOT NULL DEFAULT 0, conferido_em INTEGER)`);
  // Quem contribui. Nome e e-mail SÓ pro painel dele — nunca pra tela pública.
  await client.execute(`CREATE TABLE IF NOT EXISTS contribuidores (
    id TEXT PRIMARY KEY, nome TEXT, email TEXT,
    bloqueado INTEGER NOT NULL DEFAULT 0, criado_em INTEGER NOT NULL)`);
  // Uma linha só (`CHECK (id = 1)`). `INSERT OR IGNORE`: a semente desta linha
  // NUNCA desfaz o que o João mudou pelo painel — `ensureSchema` roda a cada
  // `npm run semear`.
  await client.execute(`CREATE TABLE IF NOT EXISTS regra_padrao (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    janela_previsao_horas REAL NOT NULL, janela_passado_horas REAL NOT NULL,
    limiar_mm REAL NOT NULL, severidade TEXT NOT NULL, atualizado_em INTEGER NOT NULL)`);
  await client.execute({
    sql: `INSERT OR IGNORE INTO regra_padrao
            (id, janela_previsao_horas, janela_passado_horas, limiar_mm, severidade, atualizado_em)
          VALUES (1, ?, ?, ?, ?, 0)`,
    args: [
      REGRA_PADRAO_INICIAL.janela_previsao_horas,
      REGRA_PADRAO_INICIAL.janela_passado_horas,
      REGRA_PADRAO_INICIAL.limiar_mm,
      REGRA_PADRAO_INICIAL.severidade,
    ],
  });
  await migrarColunaContribuidorDoRascunho(client);
```

E a migração, logo depois de `migrarColunaOculto` e no molde dela:

```ts
/** A coluna `contribuidor` de `ficha_rascunhos` (spec de 07/10): de quem é o
 *  rascunho. NULL = do João — toda linha que já existe, e é a verdade. Mesmo
 *  molde de `migrarColunaOculto`: a tabela já está em produção e `ADD COLUMN`
 *  não tem `IF NOT EXISTS`. */
async function migrarColunaContribuidorDoRascunho(client: Client): Promise<void> {
  const colunas = await client.execute(`PRAGMA table_info(ficha_rascunhos)`);
  if (colunas.rows.some((c) => String(c.name) === "contribuidor")) return;
  await client.execute(`ALTER TABLE ficha_rascunhos ADD COLUMN contribuidor TEXT`);
}
```

- [ ] **Step 5: `AutorVersao`, a regra padrão e a leitura com origem**

Troque `:394`:

```ts
export type AutorVersao = "painel" | "semente" | "contribuidor";
```

E acrescente no FIM de `db.ts`:

```ts
/** De onde veio o lugar. `contribuidor: null` = do João, e aí `conferido` é
 *  sempre `true`. */
export type OrigemDoLugar = { contribuidor: string | null; conferido: boolean };

/** 🔴 `Number(...) === 1` pela régua de `versaoDaLinha`, e o lado escolhido é
 *  o que MOSTRA a marca: valor torto numa linha de origem sai NÃO conferido.
 *  Sem linha (`o_contribuidor` nulo) é lugar do João. */
function origemDaLinha(r: Record<string, unknown>): OrigemDoLugar {
  if (r.o_contribuidor == null) return { contribuidor: null, conferido: true };
  return { contribuidor: String(r.o_contribuidor), conferido: Number(r.o_conferido) === 1 };
}

const SQL_REGRA_PADRAO = `SELECT janela_previsao_horas, janela_passado_horas, limiar_mm, severidade
                          FROM regra_padrao WHERE id = 1`;

/** 🔴 Sem linha, ou com severidade fora de `SEVERIDADES`, ESTOURA — nunca cai
 *  num padrão escrito aqui. Um carimbo com número que ninguém escolheu é a
 *  linha vermelha do projeto; a página cai no `error.tsx`, como banco fora. */
function regraDaLinha(r: Record<string, unknown> | undefined): RegraPadrao {
  if (!r) throw new Error("A regra padrão da chuva não está no banco: rode o schema (npm run semear).");
  const severidade = String(r.severidade);
  if (!(SEVERIDADES as readonly string[]).includes(severidade)) {
    throw new Error(`A regra padrão da chuva tem uma severidade que o app não conhece: "${severidade}".`);
  }
  return {
    janela_previsao_horas: Number(r.janela_previsao_horas),
    janela_passado_horas: Number(r.janela_passado_horas),
    limiar_mm: Number(r.limiar_mm),
    severidade: severidade as Severidade,
  };
}

export async function lerRegraPadrao(client: Client): Promise<RegraPadrao> {
  const r = await client.execute(SQL_REGRA_PADRAO);
  return regraDaLinha(r.rows[0] as unknown as Record<string, unknown> | undefined);
}

/** Quem confere os números é a rota, por `lerRegraDoCorpo`
 *  (`src/lib/porta-da-regra-padrao.ts`, Task 7). */
export async function gravarRegraPadrao(client: Client, r: RegraPadrao, agora: number): Promise<void> {
  await client.execute({
    sql: `UPDATE regra_padrao SET janela_previsao_horas = ?, janela_passado_horas = ?,
            limiar_mm = ?, severidade = ?, atualizado_em = ? WHERE id = 1`,
    args: [r.janela_previsao_horas, r.janela_passado_horas, r.limiar_mm, r.severidade, agora],
  });
}

export type LinhaDoAcervo = { doc: string; oculto: boolean } & OrigemDoLugar;
export type AcervoComOrigem = { linhas: Map<string, LinhaDoAcervo>; padrao: RegraPadrao };

/** O JOIN da origem: a linha de `origem_do_lugar` cuja chave é a identidade do
 *  lugar onde a versão `v` mora — a mesma conta de `identidadeSql`. */
const JOIN_ORIGEM = `LEFT JOIN origem_do_lugar o
  ON o.lugar = (SELECT MIN(i.id) FROM ficha_versoes i WHERE i.ficha_slug = v.ficha_slug)`;

/** A versão atual de TODO lugar (escondidos inclusive, marcados), a ORIGEM de
 *  cada um e a regra padrão — numa transação de leitura só.
 *
 *  🔴 POR QUE NUM BATCH: em duas leituras, um lugar da pessoa publicado entre
 *  a primeira e a segunda sairia com versão e SEM origem — lido como do João,
 *  sem marca, na tela pública. O batch `read` é um retrato só do banco.
 *  (`client.transaction()` continua proibido: ver `trocarEndereco`.)
 *
 *  Os escondidos vêm junto pela razão de `buscarFichas` ("banco sem semente"
 *  se decide pelo acervo inteiro); quem filtra é quem devolve ao público. */
export async function lerAcervoComOrigem(client: Client): Promise<AcervoComOrigem> {
  const [acervo, regra] = await client.batch(
    [
      `SELECT v.ficha_slug, v.doc, v.oculto, o.contribuidor AS o_contribuidor, o.conferido AS o_conferido
         FROM ficha_versoes v ${JOIN_ORIGEM}
        WHERE v.id IN (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)`,
      SQL_REGRA_PADRAO,
    ],
    "read",
  );
  const linhas = new Map<string, LinhaDoAcervo>();
  for (const l of acervo.rows) {
    const r = l as unknown as Record<string, unknown>;
    linhas.set(String(r.ficha_slug), { doc: String(r.doc), oculto: Number(r.oculto) === 1, ...origemDaLinha(r) });
  }
  return { linhas, padrao: regraDaLinha(regra.rows[0] as unknown as Record<string, unknown> | undefined) };
}

/** UM lugar, pro painel: a versão atual (escondida ou não), a origem e a regra
 *  padrão — no mesmo retrato. `null` = ninguém mora em `slug`. */
export async function lugarDoDono(
  client: Client, slug: string,
): Promise<{ versao: FichaVersao; origem: OrigemDoLugar; padrao: RegraPadrao } | null> {
  const [atual, regra] = await client.batch(
    [
      {
        sql: `SELECT v.*, o.contribuidor AS o_contribuidor, o.conferido AS o_conferido
                FROM ficha_versoes v ${JOIN_ORIGEM}
               WHERE v.ficha_slug = ? ORDER BY v.id DESC LIMIT 1`,
        args: [slug],
      },
      SQL_REGRA_PADRAO,
    ],
    "read",
  );
  if (!atual.rows.length) return null;
  const r = atual.rows[0] as unknown as Record<string, unknown>;
  return {
    versao: versaoDaLinha(r),
    origem: origemDaLinha(r),
    padrao: regraDaLinha(regra.rows[0] as unknown as Record<string, unknown> | undefined),
  };
}
```

- [ ] **Step 6: `publicarRascunho` aprende o contribuidor, e `listarRascunhos` fica só do João**

Em `publicarRascunho` (`:957`), o docblock fica e ganha no fim:

```ts
 *
 *  🔴 E DESDE 07/10 ELA PUBLICA TAMBÉM O LUGAR DE QUEM USA (`contribuidor` não
 *  nulo): a versão nasce com `autor = 'contribuidor'`, e um passo a mais — o
 *  penúltimo, ANTES de o rascunho sair, porque a porta depende dele — faz
 *  nascer a linha de `origem_do_lugar` com `conferido = 0`. Os dois na mesma
 *  transação: lugar da pessoa no ar sem origem seria lido como do João, SEM
 *  MARCA. O 1º passo confere também que o rascunho é de quem publica
 *  (`contribuidor IS ?`: o painel não publica rascunho dela, ela não publica o
 *  dele), que ela não está bloqueada (`id = NULL` nunca casa: o João passa) e
 *  — ruling de produto da pré-auditoria de 07/10 — que o endereço NÃO é
 *  endereço antigo de outro lugar quando quem publica é ela (`? IS NULL OR …`:
 *  o João continua retomando, com a régua de hoje). O link velho do João
 *  continua levando ao lugar dele. */
```

E a função inteira passa a ser:

```ts
export async function publicarRascunho(
  client: Client, slug: string, doc: string, agora: number, atualizadoEm: number,
  contribuidor: string | null = null,
): Promise<boolean> {
  const autor: AutorVersao = contribuidor === null ? "painel" : "contribuidor";
  const porta = `EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ? AND atualizado_em = ?)
              AND EXISTS (SELECT 1 FROM ficha_versoes
                          WHERE ficha_slug = ? AND doc = ? AND criado_em = ? AND autor = ? AND oculto = 0)`;
  const p = [slug, atualizadoEm, slug, doc, agora, autor];
  const rs = await client.batch(
    [
      {
        sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
              SELECT ?, ?, ?, ?, 0
              WHERE NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
                AND EXISTS (SELECT 1 FROM ficha_rascunhos
                            WHERE slug = ? AND atualizado_em = ? AND contribuidor IS ?)
                AND NOT EXISTS (SELECT 1 FROM contribuidores WHERE id = ? AND bloqueado = 1)
                AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?))`,
        args: [slug, doc, autor, agora, slug, slug, atualizadoEm, contribuidor, contribuidor, contribuidor, slug],
      },
      {
        sql: `UPDATE avisos SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [slug, slug, slug, ...p],
      },
      {
        sql: `UPDATE confirmacoes SET ficha_slug = (SELECT e.novo FROM enderecos_antigos e WHERE e.velho = ?)
              WHERE ficha_slug = ? AND EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?) AND ${porta}`,
        args: [slug, slug, slug, ...p],
      },
      { sql: `DELETE FROM freshness WHERE ficha_slug = ? AND ${porta}`, args: [slug, ...p] },
      { sql: `DELETE FROM enderecos_antigos WHERE velho = ? AND ${porta}`, args: [slug, ...p] },
      // 🔴 `ORDER BY id LIMIT 1`, NUNCA `SELECT MIN(id)`: com a porta fechada o
      // agregado devolve UMA linha com NULL, e NULL numa `INTEGER PRIMARY KEY`
      // vira rowid novo — uma origem órfã. Sem linha, sem INSERT.
      ...(contribuidor === null
        ? []
        : [{
            sql: `INSERT INTO origem_do_lugar (lugar, contribuidor, conferido)
                  SELECT id, ?, 0 FROM ficha_versoes WHERE ficha_slug = ? AND ${porta}
                  ORDER BY id LIMIT 1`,
            args: [contribuidor, slug, ...p],
          }]),
      {
        sql: `DELETE FROM ficha_rascunhos WHERE slug = ? AND atualizado_em = ? AND ${porta}`,
        args: [slug, atualizadoEm, ...p],
      },
    ],
    "write",
  );
  return rs[0].rowsAffected === 1;
}
```

Em `listarRascunhos` (`:759`), o SQL vira o de baixo, e o docblock ganha: *"SÓ os do João (desde 07/10): o rascunho de quem usa o app é dela até publicar, e não entra na lista do painel."*

```ts
    `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE contribuidor IS NULL
     ORDER BY atualizado_em DESC, slug ASC`,
```

- [ ] **Step 7: O painel não alcança o rascunho dela, e a colisão o vê (M11, I4 e I3 da pré-auditoria)**

🔴 **Ruling de produto (07/10):** o painel do João NÃO lista nem age sobre rascunho de quem usa — só sobre lugar publicado. As quatro portas de rascunho do painel ganham `AND contribuidor IS NULL` no MESMO statement, com o docblock de cada uma acrescido de *"SÓ os do João (07/10): o rascunho de quem usa o app é dela até publicar, e o painel não age sobre ele."*:

- `lerRascunho` (`:749`): `` `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE slug = ? AND contribuidor IS NULL` ``
- `regravarRascunho` (`:689`): `` `UPDATE ficha_rascunhos SET doc = ?, atualizado_em = MAX(?, atualizado_em + 1) WHERE slug = ? AND contribuidor IS NULL` ``
- `moverRascunho` (`:737`): o `WHERE slug = ?` vira `WHERE slug = ? AND contribuidor IS NULL` (os dois `NOT EXISTS` do destino ficam como estão — o destino continua livre nas duas tabelas, de QUALQUER dono)
- `apagarRascunho` (`:776`): `` `DELETE FROM ficha_rascunhos WHERE slug = ? AND contribuidor IS NULL` ``

(`criarRascunho` NÃO muda: o `ON CONFLICT(slug) DO NOTHING` já recusa o endereço de um rascunho dela. `/admin/novo?slug=` e `/admin/novo/publicar` leem por `lerRascunho`, então o rascunho dela vira 404 lá sem linha nova.)

E no FIM de `db.ts`, as duas leituras que veem TODO rascunho — e que só a COLISÃO usa:

```ts
/** O rascunho e DE QUEM ele é (`contribuidor`: null = do João). */
export type RascunhoComDono = Rascunho & { contribuidor: string | null };

const comDono = (r: Record<string, unknown>): RascunhoComDono => ({
  slug: String(r.slug),
  doc: String(r.doc),
  atualizado_em: Number(r.atualizado_em),
  contribuidor: r.contribuidor == null ? null : String(r.contribuidor),
});

/** 🔴 TODO RASCUNHO, de quem for — e SÓ pra colisão (I4 da pré-auditoria de
 *  07/10). A lista do painel (`listarRascunhos`) é só do João; a colisão por
 *  par não pode ser: um rascunho do João e um de quem usa com o mesmo par,
 *  publicados, seriam dois lugares no mesmo par. */
export async function todosOsRascunhos(client: Client): Promise<RascunhoComDono[]> {
  const r = await client.execute(
    `SELECT slug, doc, atualizado_em, contribuidor FROM ficha_rascunhos ORDER BY atualizado_em DESC, slug ASC`,
  );
  return r.rows.map((l) => comDono(l as unknown as Record<string, unknown>));
}

/** O rascunho que mora em `slug`, de quem for — SÓ pra escolher a FRASE de uma
 *  colisão de endereço (quem ocupa). Nunca pra editar: as portas que editam são
 *  as do João (`lerRascunho` & cia.) e as dela (`*RascunhoDaPessoa`, Task 10). */
export async function rascunhoDeQualquerUm(client: Client, slug: string): Promise<RascunhoComDono | null> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em, contribuidor FROM ficha_rascunhos WHERE slug = ?`,
    args: [slug],
  });
  return r.rows.length ? comDono(r.rows[0] as unknown as Record<string, unknown>) : null;
}
```

`src/lib/rascunho.ts`, logo depois de `enderecoDeRascunho` — as duas frases do PAINEL quando quem colide é rascunho de quem usa (o João não o vê na lista, então "continue por ele na lista do painel" seria mentira). Elas nomeiam o rascunho: é o painel dele, que já lê nome e e-mail de quem manda.

```ts
// PENDENTE: redação minha, o João ainda não leu (I4 da pré-auditoria de 07/10)
export const parDeRascunhoDeQuemUsa = (quem: string): string =>
  `Alguém que usa o app está mandando um lugar com esse nome: ${quem}. Ele ainda não foi publicado; se for o mesmo lugar, espere ele ir ao ar e confira por lá.`;
// PENDENTE: redação minha, o João ainda não leu (I4 da pré-auditoria de 07/10)
export const enderecoDeRascunhoDeQuemUsa = (quem: string): string =>
  `O endereço que sairia desse nome e dessa cidade já é de um lugar que alguém que usa o app está mandando: ${quem}. Se for o mesmo lugar, espere ele ir ao ar e confira por lá; se não for, o painel ainda não sabe dar outro endereço a este.`;
```

(Nenhuma das duas diz "nessa cidade": o rascunho dela sempre tem cidade, mas a frase do par vale também no ramo do gêmeo, e lá não seria verdade.)

`src/lib/par-de-lugar.ts` — a colisão vira DADO, e a frase vira escolha de quem responde. O docblock de `parOcupado` vai inteiro pra `colisaoDoPar` (com "Contra: … todo rascunho" passando a "todo rascunho, de QUALQUER dono — `todosOsRascunhos`, I4 de 07/10"), e ganha ao fim: *"🔴 DESDE 07/10 DEVOLVE O QUE COLIDIU, NÃO A FRASE (I3 da pré-auditoria): o painel fala por `fraseDoPainel`; a rota de quem usa responde uma frase só dela, que não nomeia ninguém (`NOME_JA_EM_USO`, Task 10)."*:

```ts
import { getClient, todosOsRascunhos, versoesAtuais } from "@/lib/db";
import {
  cidadeDoDoc, gemeoSemCidade, nomeComCidade, nomeDoRascunho, parDeLugar, parDeRascunho, parDeRascunhoDeQuemUsa,
  slugDoNome,
} from "@/lib/rascunho";

/** O QUE COLIDIU — sem frase. `quem` é o nome (e a cidade, se houver) de quem
 *  JÁ EXISTE, lido do dado. */
export type Colisao = {
  de: "lugar" | "rascunho-do-joao" | "rascunho-de-quem-usa";
  semCidade: boolean;
  quem: string;
};

export async function colisaoDoPar(
  nome: string,
  cidade: string,
  { exceto, nomeNovo }: { exceto: string | null; nomeNovo: boolean },
): Promise<Colisao | null> {
  const n = slugDoNome(nome);
  const c = slugDoNome(cidade);
  if (n === "") return null;
  const bate = (doc: string, slug: string): { semCidade: boolean; quem: string } | null => {
    const nomeDeles = nomeDoRascunho(doc, slug);
    if (slug === exceto || slugDoNome(nomeDeles) !== n) return null;
    const deles = cidadeDoDoc(doc);
    if (deles === undefined || slugDoNome(deles) === "") return nomeNovo ? { semCidade: true, quem: nomeDeles } : null;
    return slugDoNome(deles) === c ? { semCidade: false, quem: nomeComCidade(nomeDeles, deles) } : null;
  };
  for (const v of (await versoesAtuais(getClient(), { incluirOcultos: true })).values()) {
    const achou = bate(v.doc, v.ficha_slug);
    if (achou !== null) return { de: "lugar", ...achou };
  }
  for (const r of await todosOsRascunhos(getClient())) {
    const achou = bate(r.doc, r.slug);
    if (achou !== null) return { de: r.contribuidor === null ? "rascunho-do-joao" : "rascunho-de-quem-usa", ...achou };
  }
  return null;
}

/** A FRASE DO PAINEL pra uma colisão — as de hoje, e a de quem usa quando o
 *  rascunho que colide é DELA (ele não está na lista do painel). */
export function fraseDoPainel(c: Colisao): string {
  if (c.de === "rascunho-de-quem-usa") return parDeRascunhoDeQuemUsa(c.quem);
  if (c.semCidade) return gemeoSemCidade(c.quem);
  return c.de === "lugar" ? parDeLugar(c.quem) : parDeRascunho(c.quem);
}

/** A porta do PAINEL: a colisão, na frase do painel. Mesma assinatura de hoje. */
export async function parOcupado(
  nome: string,
  cidade: string,
  o: { exceto: string | null; nomeNovo: boolean },
): Promise<string | null> {
  const c = await colisaoDoPar(nome, cidade, o);
  return c === null ? null : fraseDoPainel(c);
}

export async function colisaoDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<Colisao | null> {
  const nomeNovo = slugDoNome(nome) !== slugDoNome(nomeDoRascunho(atual, ""));
  return colisaoDoPar(nome, cidade, { exceto: slug, nomeNovo });
}

export async function parDaTroca(atual: string, slug: string, nome: string, cidade: string): Promise<string | null> {
  const c = await colisaoDaTroca(atual, slug, nome, cidade);
  return c === null ? null : fraseDoPainel(c);
}

export async function colisaoDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<Colisao | null> {
  if ((campo !== CAMPO_DO_NOME && campo !== CAMPO_DA_CIDADE) || typeof valor !== "string") return null;
  const nome = campo === CAMPO_DO_NOME ? valor : nomeDoRascunho(atual, "");
  const cidade = campo === CAMPO_DA_CIDADE ? valor : (cidadeDoDoc(atual) ?? "");
  return colisaoDaTroca(atual, slug, nome, cidade);
}

export async function parDaMudanca(atual: string, slug: string, campo: unknown, valor: unknown): Promise<string | null> {
  const c = await colisaoDaMudanca(atual, slug, campo, valor);
  return c === null ? null : fraseDoPainel(c);
}
```

(Os docblocks de `parDaTroca`, `CAMPO_DO_NOME`/`CAMPO_DA_CIDADE` e `parDaMudanca` ficam onde estão; `colisaoDaTroca`/`colisaoDaMudanca` ganham uma linha cada: *"O dado da colisão; a frase é de quem responde."* As duas constantes `CAMPO_DO_NOME`/`CAMPO_DA_CIDADE` sobem pra antes de `colisaoDaMudanca` se o `tsc` reclamar de uso antes da declaração.)

`src/app/api/admin/rascunho/route.ts`, `quemOcupa` (`:116-122`; importe `rascunhoDeQualquerUm` de `@/lib/db` e `enderecoDeRascunhoDeQuemUsa` de `@/lib/rascunho`; `lerRascunho` continua importado pelos outros usos do arquivo):

```ts
async function quemOcupa(slug: string): Promise<string> {
  const lugar = await versaoAtual(getClient(), slug);
  if (lugar !== null) return enderecoDeLugar(nomeComCidade(nomeDoRascunho(lugar.doc, slug), cidadeDoDoc(lugar.doc)));
  // `rascunhoDeQualquerUm`, NUNCA `lerRascunho` (só do João desde 07/10): o
  // rascunho de quem usa ocupa o endereço do mesmo jeito, e a frase é outra.
  const r = await rascunhoDeQualquerUm(getClient(), slug);
  const doc = r?.doc ?? "";
  const quem = nomeComCidade(nomeDoRascunho(doc, slug), cidadeDoDoc(doc));
  return r !== null && r.contribuidor !== null ? enderecoDeRascunhoDeQuemUsa(quem) : enderecoDeRascunho(quem);
}
```

`src/app/api/admin/endereco/route.ts:89`: `const rascunho = await lerRascunho(getClient(), novo);` vira `const rascunho = await rascunhoDeQualquerUm(getClient(), novo);` (importe-a de `@/lib/db`; tire `lerRascunho` do import se ficar sem uso). A frase (`enderecoOcupadoPorRascunho`) não fala de lista nenhuma e vale pro rascunho dela também.

- [ ] **Step 8: O rótulo do autor no histórico**

`src/app/admin/HistoricoDaFicha.tsx:11` (importe `type AutorVersao` de `@/lib/db`):

```ts
const AUTOR = {
  painel: "você, pelo painel",
  semente: "acervo original",
  // PENDENTE: redação minha, o João ainda não leu (as duas palavras vêm da spec de 07/10, Parte 3)
  contribuidor: "quem mandou",
} as const satisfies Record<AutorVersao, string>;
```

O `satisfies` é o guarda: autor novo sem rótulo não compila.

- [ ] **Step 9: `tests/banco.ts` limpa o que é novo e ganha o lugar da pessoa**

Em `semearAcervo`, depois de `DELETE FROM ficha_rascunhos`:

```ts
  // E as três da rodada de 07/10: a origem, quem contribui, e a regra padrão
  // de volta ao valor inicial — teste que mexeu na regra não atravessa.
  await client.execute("DELETE FROM origem_do_lugar");
  await client.execute("DELETE FROM contribuidores");
  await client.execute({
    sql: `UPDATE regra_padrao SET janela_previsao_horas = ?, janela_passado_horas = ?,
            limiar_mm = ?, severidade = ?, atualizado_em = 0 WHERE id = 1`,
    args: [
      REGRA_PADRAO_INICIAL.janela_previsao_horas, REGRA_PADRAO_INICIAL.janela_passado_horas,
      REGRA_PADRAO_INICIAL.limiar_mm, REGRA_PADRAO_INICIAL.severidade,
    ],
  });
```

E no fim do arquivo (importe `publicarRascunho` de `@/lib/db`, `slugDoNome` de `@/lib/rascunho`, `REGRA_PADRAO_INICIAL` de `@/lib/regra-padrao`):

```ts
/** O id do Clerk que os testes usam pra "quem usa o app". Não é de ninguém. */
export const PESSOA_DE_TESTE = "user_pessoa_de_teste";

/** Põe no ar um lugar MANDADO POR QUEM USA, pela porta de verdade
 *  (`publicarRascunho` com contribuidor) — o lugar de usuário "semeado só em
 *  teste" da spec. O documento tem SÓ o que a pessoa responde (as perguntas
 *  obrigatórias dela), nada da voz do app: é o caso que a página tem de calar.
 *  Estoura se não publicou — teste que não semeou mede o vazio. */
export async function semearLugarDaPessoa(
  client: Client,
  o: { nome: string; cidade: string; contribuidor?: string; agora?: number },
): Promise<string> {
  const contribuidor = o.contribuidor ?? PESSOA_DE_TESTE;
  const agora = o.agora ?? AGORA_SEMENTE + 30;
  const slug = slugDoNome(`${o.nome} ${o.cidade}`);
  const ponto = { lat: -8.31, lng: -35.97 };
  const doc = JSON.stringify({
    slug,
    modos: [],
    cidade: o.cidade,
    promessa: `O que é ${o.nome}, na palavra de quem mandou.`,
    trajeto: { waypoints: [{ nome: o.nome, ...ponto }] },
    acesso: `Como se chega a ${o.nome}, na palavra de quem mandou.`,
    condicao: { coords: ponto },
    custo: { tag: "gratis" },
  });
  await client.execute({
    sql: "INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor) VALUES (?, ?, ?, ?)",
    args: [slug, doc, agora, contribuidor],
  });
  if (!(await publicarRascunho(client, slug, doc, agora, agora, contribuidor))) {
    throw new Error(`semearLugarDaPessoa: "${slug}" não publicou — confira a porta de publicarRascunho.`);
  }
  return slug;
}
```

⚠️ O documento acima ainda NÃO passa no `fichaSchema` de hoje (faltam `voz`, `premio` etc.): nesta tarefa ele só é lido pelo SQL. Ele passa a abrir na Task 2, e é isso que a Task 2 prova.

- [ ] **Step 10: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/db-origem.test.ts tests/app/historico-da-ficha.test.tsx tests/lib/db-rascunho.test.ts tests/api/route-admin-publicar.test.ts tests/banco.test.ts tests/api/route-admin-rascunho.test.ts tests/api/route-admin-endereco.test.ts tests/api/route-admin-ficha.test.ts tests/lib/db-endereco.test.ts`
Expected: PASS. `db-rascunho`, `route-admin-publicar`, `banco`, `route-admin-ficha` e `db-endereco` provam que o publicar, os rascunhos, o par e o endereço do João não mudaram; os dois `route-admin-*` de rascunho e endereço, que o rascunho dela tem a frase dele.

- [ ] **Step 11: Mutações, com `git diff --stat` provando que aplicaram**

| # | mutação | morre em |
|---|---|---|
| M1 | tira o passo `INSERT INTO origem_do_lugar` do batch | "o lugar vai ao ar NÃO conferido" |
| M2 | troca o passo por `SELECT MIN(id), ?, 0 FROM ficha_versoes WHERE ficha_slug = ? AND ${porta}` (sem `ORDER BY … LIMIT 1`) | "publicar recusado … não deixa linha de origem nenhuma" |
| M3 | tira `AND contribuidor IS ?` do 1º passo | "o publicar do painel não leva ao ar rascunho de quem usa" **e** "quem usa não leva ao ar rascunho do João" |
| M4 | tira o `NOT EXISTS … bloqueado = 1` | "pessoa bloqueada não publica" |
| M5 | `origemDaLinha` devolve `conferido: true` sempre | "o lugar vai ao ar NÃO conferido" |
| M6 | `origemDaLinha` usa `Number(r.o_conferido) !== 0` | "conferido torto … é lido como não conferido" |
| M7 | `INSERT OR IGNORE` → `INSERT OR REPLACE` na semente da regra | "rodar o schema de novo NÃO devolve a regra" |
| M8 | `regraDaLinha` troca o `throw` da severidade por `"cuidado"` | "severidade torta estoura" |
| M9 | tira `WHERE contribuidor IS NULL` de `listarRascunhos` | "o rascunho de quem usa não aparece em listarRascunhos" |
| M10 | `JOIN_ORIGEM` usa `o.lugar = v.id` | "a origem acompanha o lugar com 2 versões e endereço novo" |
| M11 | tira `AND contribuidor IS NULL` de `lerRascunho` | "lerRascunho do painel não o lê" |
| M12 | tira `AND contribuidor IS NULL` de `regravarRascunho` | "regravarRascunho do painel não o regrava" |
| M13 | tira `AND contribuidor IS NULL` de `moverRascunho` | "moverRascunho do painel não o move" |
| M14 | tira `AND contribuidor IS NULL` de `apagarRascunho` | "apagarRascunho do painel não o apaga" |
| M15 | `colisaoDoPar` volta a ler `listarRascunhos` (a do painel) | "o PAR de um rascunho dela: 409 com a frase de quem usa" (o par não o vê; quem recusa é o endereço, com a frase do endereço) |
| M16 | `fraseDoPainel` devolve `parDeRascunho` pra todo rascunho (sem o ramo de quem usa) | "o PAR de um rascunho dela: 409 com a frase de quem usa" |
| M17 | `quemOcupa` (rota do rascunho do painel) volta a `lerRascunho` | "o ENDEREÇO de um rascunho dela, de nome diferente: 409 com a frase de quem usa" |
| M18 | a rota do endereço volta a `lerRascunho` | "novo ocupado por um rascunho de QUEM USA: 409 dizendo quem" |
| M19 | tira o `AND (? IS NULL OR NOT EXISTS (… enderecos_antigos …))` do 1º passo | "quem usa não publica num endereço antigo de outro lugar" |
| M20 | o mesmo passo vira `AND NOT EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?)` (a recusa vale pro João também) **e** o 10º arg (`contribuidor`) sai dos `args` — sem tirar o arg, o `velho = ?` casaria com o contribuidor e a mutação não mediria nada | "o publicar do JOÃO continua retomando o endereço antigo" |

- [ ] **Step 12: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo verde, build exit 0.

- [ ] **Step 13: Commit, e o harness com a árvore limpa**

```bash
git add src/lib/regra-padrao.ts src/lib/db.ts src/lib/par-de-lugar.ts src/lib/rascunho.ts src/app/api/admin/rascunho/route.ts src/app/api/admin/endereco/route.ts src/app/admin/HistoricoDaFicha.tsx tests/banco.ts tests/lib/db-origem.test.ts tests/app/historico-da-ficha.test.tsx tests/api/route-admin-rascunho.test.ts tests/api/route-admin-endereco.test.ts
git commit -m "feat(banco): origem do lugar, regra padrao da chuva e o publicar de quem usa"
node scripts/mutar.mjs
```
Expected: 42/0/0.

📝 **Frases novas desta tarefa, pro pacote de copy:** `"quem mandou"` (histórico), `parDeRascunhoDeQuemUsa`, `enderecoDeRascunhoDeQuemUsa` (painel, `src/lib/rascunho.ts`).

---

### Task 2: O que a pessoa não responde vira opcional, e a leitura do público devolve `FichaNoAr`

**Files:**
- Modify: `src/types/ficha.ts` — `condicaoSchema` (:92-109), `discriminadorSchema` (:111-115), `fichaSchema` (:134-140); tipos novos no fim (:290-293)
- Modify: `src/lib/regra-padrao.ts` — `noAr`
- Modify: `src/lib/ficha-fonte.ts` — `ordenarPorNome` (genérica), `buscarFichas`
- Modify: `src/lib/ficha.ts` — `getAllFichas`, `getFicha`, `getFichasComCondicao`, `fichaDoEnderecoAntigo`, `getAcervoDoDono`, `getFichaDoDono`
- Modify: `src/lib/coerencia.ts` — 🔴 **TRÊS edições NA MESMA LINHA, nenhuma linha a mais** (ver Step 5)
- Modify (tipo `Ficha` → `FichaNoAr`, sem mudar comportamento): `src/lib/carimbo-estado.ts`, `src/app/page.tsx`, `src/app/FolhaTrilhas.tsx`, `src/app/CartaoTrilha.tsx`, `src/app/ListaDoAcervo.tsx`, `src/app/MapaHome.tsx`, `src/app/admin/marca-agora.ts`, `src/app/admin/PainelAdmin.tsx`, `src/app/admin/ListaDeLugares.tsx`, `src/app/admin/page.tsx`, `src/app/admin/[slug]/page.tsx`
- Modify: `src/app/[slug]/page.tsx` — só o que o `tsc` exige (`?.`/`??`) nas linhas DEPOIS do `const precoCurto`; nenhuma linha nasce acima dele
- Modify: `src/app/api/admin/previsao-carimbo/route.ts` — recusa lugar sem regra própria
- Modify: `tests/lib/campos-da-ficha.test.ts` — `OBRIGATORIO_SO_NO_REGISTRO` (:42-49) ganha os campos novos; 🔴 o guarda "o schema não tem bloco opcional nenhum" (:233-246) é REESCRITO pra listar os dois blocos de 07/10 (C1 da pré-auditoria)
- Modify: `tests/lib/severidade.test.ts` — 🔴 o caso "o schema RECUSA ficha sem nível" (:124-132) é REESCRITO: o schema aceita, a porta do João recusa (C1 da pré-auditoria)
- Modify: `tests/lib/ficha-fonte.test.ts`, `tests/lib/db-rascunho.test.ts:53`, `tests/lib/ficha-do-dono.test.ts:34`, `tests/app/admin-page.test.tsx:261` (dublês e chamadas)
- Create: `tests/no-ar.ts` (helper `doJoao`)
- Test: `tests/lib/regra-padrao.test.ts` (criar), `tests/lib/ficha-da-pessoa.test.ts` (criar), `tests/lib/leitura-publica-da-pessoa.test.ts` (criar)

**Interfaces:**
- Consumes: `RegraPadrao`, `REGRA_PADRAO_INICIAL` (Task 1); `lerAcervoComOrigem`, `lugarDoDono`, `AcervoComOrigem`, `OrigemDoLugar` (Task 1).
- Produces:
  - `src/types/ficha.ts`: `export type OrigemNoAr = { conferido: boolean; regraPropria: boolean }` e `export type FichaNoAr = Omit<Ficha, "condicao"> & { condicao: Omit<Condicao, "regra" | "severidade"> & { regra: Regra; severidade: Severidade }; origem: OrigemNoAr }`
  - `src/lib/regra-padrao.ts`: `export function noAr(doc: Ficha, origem: { conferido: boolean }, padrao: RegraPadrao): FichaNoAr`
  - `src/lib/ficha-fonte.ts`: `export function ordenarPorNome<F extends Ficha>(fichas: F[]): F[]`; `export async function buscarFichas(ler: () => Promise<AcervoComOrigem>): Promise<FichaNoAr[]>`
  - `src/lib/ficha.ts`: `getAllFichas(): Promise<FichaNoAr[]>`, `getFicha(slug): Promise<FichaNoAr | null>`, `getFichasComCondicao(): Promise<FichaNoAr[]>`, `fichaDoEnderecoAntigo(velho): Promise<FichaNoAr | null>`, `getAcervoDoDono(): Promise<{ fichas: FichaNoAr[]; ocultos: Set<string> }>`, `getFichaDoDono(slug): Promise<{ ficha: Ficha; noAr: FichaNoAr; oculto: boolean; versaoId: number; origem: OrigemDoLugar } | null>`
  - `tests/no-ar.ts`: `export function doJoao(f: Ficha): FichaNoAr`

🔴 **Os campos que viram opcionais no SCHEMA, e só eles** (spec, Parte 1, "O que NÃO se pergunta"): `rotulo_escaneio`, `voz`, `premio`, `avisos` (é a pergunta 6, opcional, da pessoa), `condicao.regra` (o OBJETO — as folhas dele continuam obrigatórias dentro dele: a regra entra inteira ou não entra), `condicao.severidade`, `condicao.regra_texto`, `condicao.ressalva_proxy`, `discriminador` (o objeto **e as três folhas** — escolha 3 no fim do plano). `piso`, `carroComum` e `secaRapido` já eram opcionais. **Um schema só, sem ramo por origem.** Quem continua EXIGINDO cada um nos lugares do João é o REGISTRO (`obrigatorio: true` em `src/lib/campos-da-ficha.ts`, que NÃO muda), pela porta de publicar dele (`obrigatoriosFaltando`) e pelo "não sei" (`recusarNaoSeiObrigatorio`).

🔴 **A regra própria não é coluna** (escolha 1 no fim do plano): é `doc.condicao.regra !== undefined`. Calibrar escreve a regra no documento (Task 8), e "voltar a esta" leva junto o que a versão dizia — uma coluna separada divergiria do documento no primeiro "voltar".

- [ ] **Step 1: Escrever os testes que falham**

`tests/no-ar.ts` (helper, não é teste):

```ts
import { noAr } from "@/lib/regra-padrao";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import type { Ficha, FichaNoAr } from "@/types/ficha";

/** Uma ficha do JOÃO como a leitura do público a entrega: conferida, e com a
 *  regra dela (a padrão só entra se o documento não tiver regra). Pra testes
 *  que montam ficha à mão e a dão a um componente público. */
export function doJoao(f: Ficha): FichaNoAr {
  return noAr(f, { conferido: true }, REGRA_PADRAO_INICIAL);
}
```

`tests/lib/regra-padrao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { noAr, REGRA_PADRAO_INICIAL, type RegraPadrao } from "@/lib/regra-padrao";
import { loadAll } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";

const RAMPA = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
const OUTRA: RegraPadrao = { janela_previsao_horas: 2, janela_passado_horas: 11, limiar_mm: 0.7, severidade: "espera" };

function semRegra(f: Ficha): Ficha {
  const copia = structuredClone(f);
  delete copia.condicao.regra;
  delete copia.condicao.severidade;
  return copia;
}

describe("noAr — a regra efetiva, montada num lugar só", () => {
  it("lugar com regra própria fica com a dele, e a padrão não encosta", () => {
    const f = noAr(RAMPA, { conferido: true }, OUTRA);
    expect(f.condicao.regra).toEqual(RAMPA.condicao.regra);
    expect(f.condicao.severidade).toBe(RAMPA.condicao.severidade);
    expect(f.origem).toEqual({ conferido: true, regraPropria: true });
  });

  it("lugar SEM regra própria usa a padrão RECEBIDA — os quatro números, nenhum fixo", () => {
    const f = noAr(semRegra(RAMPA), { conferido: false }, OUTRA);
    expect(f.condicao.regra).toEqual({ tipo: "chuva_binaria", janela_previsao_horas: 2, janela_passado_horas: 11, limiar_mm: 0.7 });
    expect(f.condicao.severidade).toBe("espera");
    expect(f.origem).toEqual({ conferido: false, regraPropria: false });
  });

  it("a origem vem de quem chama, e não do documento", () => {
    expect(noAr(RAMPA, { conferido: false }, REGRA_PADRAO_INICIAL).origem.conferido).toBe(false);
  });

  it("noAr não muda o documento recebido", () => {
    const doc = semRegra(RAMPA);
    const antes = structuredClone(doc);
    noAr(doc, { conferido: false }, OUTRA);
    expect(doc).toEqual(antes);
  });
});
```

`tests/lib/ficha-da-pessoa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fichaSchema, type Ficha } from "@/types/ficha";
import { obrigatoriosFaltando } from "@/lib/porta-de-publicar";
import { violacoesDoAcervo } from "@/lib/coerencia";
import { loadAll } from "@/lib/ficha";

/** O documento como a pessoa o deixa: só as perguntas obrigatórias dela. */
const daPessoa = (nome: string): Ficha =>
  fichaSchema.parse({
    slug: `${nome.toLowerCase().replace(/ /g, "-")}-cidade-teste`,
    modos: [],
    cidade: "Cidade Teste",
    promessa: `O que é ${nome}.`,
    trajeto: { waypoints: [{ nome, lat: -8.31, lng: -35.97 }] },
    acesso: `Como se chega a ${nome}.`,
    condicao: { coords: { lat: -8.31, lng: -35.97 } },
    custo: { tag: "gratis" },
  });

/** Os caminhos que viram opcionais no SCHEMA nesta rodada. Fonte: a spec de
 *  07/10, Parte 1, "O que NÃO se pergunta" — mais `avisos`, que é a pergunta
 *  opcional 6 dela. */
const OPCIONAIS_NO_SCHEMA = [
  "rotulo_escaneio", "voz", "premio", "avisos",
  "condicao.regra", "condicao.severidade", "condicao.regra_texto", "condicao.ressalva_proxy",
  "discriminador", "discriminador.formato", "discriminador.como_ler", "discriminador.permissao_abortar",
] as const;

function semCaminho(f: Ficha, caminho: string): unknown {
  const copia = structuredClone(f) as unknown as Record<string, Record<string, unknown>>;
  const [a, b] = caminho.split(".");
  if (b === undefined) delete (copia as Record<string, unknown>)[a];
  else delete copia[a][b];
  return copia;
}

describe("o documento de quem usa o app", () => {
  it("abre no fichaSchema com só as perguntas dela", () => {
    expect(() => daPessoa("Pedra Mandada")).not.toThrow();
  });

  it.each(OPCIONAIS_NO_SCHEMA)("`%s` é opcional no schema (uma ficha do João sem ele abre)", (caminho) => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    expect(fichaSchema.safeParse(semCaminho(rampa, caminho)).success).toBe(true);
  });

  it("a regra entra INTEIRA ou não entra — meia regra é recusada", () => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    const meia = structuredClone(rampa) as unknown as { condicao: { regra: Record<string, unknown> } };
    delete meia.condicao.regra.limiar_mm;
    expect(fichaSchema.safeParse(meia).success).toBe(false);
  });

  // 🔴 A porta de publicar do JOÃO não afrouxa: cada campo que o schema soltou
  // continua faltando pra ela.
  it("a porta do JOÃO continua exigindo cada campo que o schema soltou", () => {
    const faltam = obrigatoriosFaltando(daPessoa("Pedra Mandada"));
    for (const c of [
      "rotulo_escaneio", "voz", "premio", "avisos",
      "condicao.regra.janela_previsao_horas", "condicao.regra.janela_passado_horas", "condicao.regra.limiar_mm",
      "condicao.severidade", "condicao.regra_texto", "condicao.ressalva_proxy",
      "discriminador.formato", "discriminador.como_ler", "discriminador.permissao_abortar",
    ]) {
      expect(faltam, c).toContain(c);
    }
  });
});

describe("a coerência diante do que a pessoa não respondeu", () => {
  // 🔴 Sem a guarda, `String(undefined)` dá "undefined" nas duas fichas e a
  // regra acusa "têm a voz exatamente igual" entre dois lugares SEM voz.
  it("duas fichas sem voz, prêmio e etiqueta não 'emprestam' texto uma da outra", () => {
    const v = violacoesDoAcervo([daPessoa("Pedra Um"), daPessoa("Pedra Dois")]);
    expect(v.filter((x) => x.regra === "texto-emprestado")).toEqual([]);
  });

  it("ficha sem regra e sem checagem não derruba nenhuma regra, nem acusa as de chuva", () => {
    let v: ReturnType<typeof violacoesDoAcervo> = [];
    expect(() => { v = violacoesDoAcervo([daPessoa("Pedra Um")]); }).not.toThrow();
    expect(v.filter((x) => x.regra.startsWith("janela-"))).toEqual([]);
  });

  // A guarda é por AUSÊNCIA, não por "a ficha é da pessoa": duas promessas
  // iguais continuam acusadas.
  it("duas fichas com a MESMA promessa continuam acusadas", () => {
    const a = daPessoa("Pedra Um");
    const b = { ...daPessoa("Pedra Dois"), promessa: a.promessa };
    expect(violacoesDoAcervo([a, b]).map((x) => x.regra)).toContain("texto-emprestado");
  });
});
```

`tests/lib/leitura-publica-da-pessoa.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { getAcervoDoDono, getAllFichas, getFicha, getFichaDoDono } from "@/lib/ficha";
import { gravarRegraPadrao } from "@/lib/db";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

const banco = await bancoDeProducao();
let SLUG: string;
beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});

describe("a leitura do público", () => {
  it("o lugar da pessoa chega NÃO conferido e com a regra padrão do banco", async () => {
    const f = (await getFicha(SLUG))!;
    expect(f.origem).toEqual({ conferido: false, regraPropria: false });
    expect(f.condicao.regra).toEqual({ tipo: "chuva_binaria", janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2 });
    expect(f.condicao.severidade).toBe(REGRA_PADRAO_INICIAL.severidade);
  });

  it("mudar a regra padrão no banco muda a dele, e não a dos lugares do João", async () => {
    const rampaAntes = (await getFicha("rampa-do-pepe"))!.condicao;
    await gravarRegraPadrao(banco, { janela_previsao_horas: 1, janela_passado_horas: 12, limiar_mm: 2, severidade: "nao-va" }, 1);
    const f = (await getFicha(SLUG))!;
    expect(f.condicao.regra.janela_passado_horas).toBe(12);
    expect(f.condicao.severidade).toBe("nao-va");
    expect((await getFicha("rampa-do-pepe"))!.condicao).toEqual(rampaAntes);
  });

  it("todo lugar do João chega conferido e com regra própria", async () => {
    const doJoao = (await getAllFichas()).filter((f) => f.slug !== SLUG);
    expect(doJoao.length).toBeGreaterThan(2);
    for (const f of doJoao) expect([f.slug, f.origem]).toEqual([f.slug, { conferido: true, regraPropria: true }]);
  });
});

describe("a leitura do dono", () => {
  it("getAcervoDoDono traz o lugar da pessoa com a origem", async () => {
    const { fichas } = await getAcervoDoDono();
    expect(fichas.find((f) => f.slug === SLUG)?.origem.conferido).toBe(false);
  });

  it("getFichaDoDono devolve o documento CRU (sem regra) e o noAr (com a padrão)", async () => {
    const d = (await getFichaDoDono(SLUG))!;
    expect(d.ficha.condicao.regra).toBeUndefined();
    expect(d.noAr.condicao.regra.limiar_mm).toBe(0.2);
    expect(d.origem).toEqual({ contribuidor: expect.any(String), conferido: false });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/regra-padrao.test.ts tests/lib/ficha-da-pessoa.test.ts tests/lib/leitura-publica-da-pessoa.test.ts`
Expected: FAIL — `noAr` não existe; o documento da pessoa é recusado pelo schema (`voz` Required).

- [ ] **Step 3: O schema, em `src/types/ficha.ts`**

`condicaoSchema` (o comentário 🔴 da severidade fica, e ganha a emenda de 07/10 ao fim — *"Desde 07/10 é OPCIONAL no schema: o lugar mandado por quem usa não tem severidade, e a leitura pública o completa com a regra padrão do banco (`noAr`). Quem continua exigindo nos lugares do João é o registro (`campos-da-ficha.ts`), pela porta de publicar dele — o defeito que o 'obrigatório' fechava (ficha nova herdando a voz da Rampa) continua fechado lá."*):

```ts
export const condicaoSchema = z.object({
  coords: z.object({ lat: latSchema, lng: lngSchema }),
  regra: regraSchema.optional(),
  severidade: z.enum(SEVERIDADES).optional(),
  regra_texto: z.string().optional(),
  ressalva_proxy: z.string().optional(),
});

export const discriminadorSchema = z.object({
  formato: z.string().optional(),
  como_ler: z.string().optional(),
  permissao_abortar: z.string().optional(),
});
```

No `fichaSchema`, com um comentário 🔴 de uma linha em cima do bloco (*"opcionais desde 07/10: o lugar mandado por quem usa não os tem, e a página CALA cada um (spec, Parte 1). O registro continua exigindo nos do João."*):

```ts
  rotulo_escaneio: z.string().optional(),
  promessa: z.string(),
  voz: z.string().optional(),
  premio: z.string().optional(),
  trajeto: z.object({ waypoints: z.array(waypointSchema).min(1) }),
  acesso: z.string(),
  avisos: z.string().optional(),
  condicao: condicaoSchema,
  discriminador: discriminadorSchema.optional(),
```

E no fim do arquivo:

```ts
import type { Severidade } from "@/lib/severidade";

/** De onde veio o lugar, como o PÚBLICO o vê. `regraPropria` é derivada do
 *  documento (`condicao.regra` presente), nunca coluna: ver `noAr`. */
export type OrigemNoAr = { conferido: boolean; regraPropria: boolean };

/** A ficha como a LEITURA DO PÚBLICO a entrega (`buscarFichas`): o documento,
 *  com a regra EFETIVA (a própria, ou a padrão do banco) e a origem. Toda tela
 *  pública recebe ESTA, e não a `Ficha` crua — é dela que sai a marca. */
export type FichaNoAr = Omit<Ficha, "condicao"> & {
  condicao: Omit<Condicao, "regra" | "severidade"> & { regra: Regra; severidade: Severidade };
  origem: OrigemNoAr;
};
```

(Ponha o `import type` junto dos imports do topo, não no fim.)

- [ ] **Step 4: `noAr`, em `src/lib/regra-padrao.ts`**

```ts
import type { Ficha, FichaNoAr } from "@/types/ficha";

/** A FICHA COMO O PÚBLICO A VÊ, montada num lugar só (`buscarFichas` e a
 *  leitura do dono usam esta, e nenhuma outra).
 *
 *  🔴 A REGRA EFETIVA: com `condicao.regra` no documento, a dele — e a padrão
 *  não encosta, nem na severidade (que cai na padrão só se o documento tiver
 *  regra e não tiver severidade, estado que nenhuma porta produz). Sem regra,
 *  os QUATRO números da padrão RECEBIDA — nunca `REGRA_PADRAO_INICIAL`: a
 *  padrão é dado do banco, e o João a muda pelo painel.
 *
 *  🔴 A REGRA PRÓPRIA É DERIVADA DO DOCUMENTO, NÃO COLUNA (escolha 1 do plano
 *  de 07/10): calibrar grava a regra no documento, e "voltar a esta" leva junto
 *  o que a versão dizia. Uma coluna separada divergiria no primeiro "voltar".
 *
 *  Não muda `doc`: devolve um objeto novo. */
export function noAr(doc: Ficha, origem: { conferido: boolean }, padrao: RegraPadrao): FichaNoAr {
  const propria = doc.condicao.regra;
  return {
    ...doc,
    condicao: {
      ...doc.condicao,
      regra: propria ?? {
        tipo: "chuva_binaria",
        janela_previsao_horas: padrao.janela_previsao_horas,
        janela_passado_horas: padrao.janela_passado_horas,
        limiar_mm: padrao.limiar_mm,
      },
      severidade: propria ? (doc.condicao.severidade ?? padrao.severidade) : padrao.severidade,
    },
    origem: { conferido: origem.conferido, regraPropria: propria !== undefined },
  };
}
```

- [ ] **Step 5: A coerência, NA MESMA LINHA (os alvos do harness são por linha)**

Três trocas em `src/lib/coerencia.ts`, cada uma substituindo UMA linha por UMA linha. Confira antes e depois com `wc -l src/lib/coerencia.ts` — o número NÃO muda.

1. Em `prosaDe` (`:127`):
   - antes: `    f.discriminador.como_ler].join(" \n ").toLowerCase();`
   - depois: `    f.discriminador?.como_ler].join(" \n ").toLowerCase();`
2. Em `texto-emprestado` (a linha `const k = String(f[campo]).trim().toLowerCase();`, ≈`:315`):
   - depois: `          if (f[campo] === undefined) continue; const k = String(f[campo]).trim().toLowerCase(); // ausente é silêncio (07/10): dois lugares sem voz não emprestam nada`
3. Em `janela-nao-zerada` (`:480`) e em `janela-dentro-do-provedor` (`:630`), a linha `        const r = f.condicao.regra;` vira:
   - `        const r = f.condicao.regra; if (!r) return []; // sem regra própria (07/10): a padrão é conferida na tela dela`

(`join` já trata `undefined` como texto vazio, então `prosaDe` não precisa de mais nada.)

- [ ] **Step 6: A leitura do público e a do dono**

`src/lib/ficha-fonte.ts`:

```ts
export function ordenarPorNome<F extends Ficha>(fichas: F[]): F[] {
  return [...fichas].sort(
    (a, b) =>
      a.trajeto.waypoints[0].nome.localeCompare(b.trajeto.waypoints[0].nome, "pt-BR") ||
      (a.cidade ?? "").localeCompare(b.cidade ?? "", "pt-BR"),
  );
}
```

`buscarFichas` (o docblock inteiro fica; acrescente ao fim um parágrafo 🔴: *"DESDE 07/10 ELA DEVOLVE `FichaNoAr`: cada lugar sai com a regra efetiva e a ORIGEM, lidas no MESMO batch das versões (`lerAcervoComOrigem`). É daqui que toda tela pública tira a marca de 'não conferido'."*):

```ts
export async function buscarFichas(ler: () => Promise<AcervoComOrigem>): Promise<FichaNoAr[]> {
  let lido: AcervoComOrigem | null;
  try {
    lido = await comPrazo(ler(), PRAZO_FICHA_MS, null);
  } catch {
    lido = null;
  }
  if (lido === null || lido.linhas.size === 0) {
    throw new Error("Não consegui ler as fichas: banco fora, ou sem nenhuma linha.");
  }
  const { linhas, padrao } = lido;
  const visiveis = [...linhas.entries()].filter(([, l]) => !l.oculto);
  return ordenarPorNome(visiveis.map(([slug, l]) => noAr(fichaDaVersao(slug, l.doc), l, padrao)));
}
```

(imports: `type AcervoComOrigem` de `@/lib/db` — só tipo, sem ciclo de valor; `noAr` de `@/lib/regra-padrao`; `type FichaNoAr` de `@/types/ficha`.)

`src/lib/ficha.ts`:

```ts
export const getAllFichas = cache(
  async (): Promise<FichaNoAr[]> => buscarFichas(() => lerAcervoComOrigem(getClient())),
);

export async function getFicha(slug: string): Promise<FichaNoAr | null> {
  return (await getAllFichas()).find((f) => f.slug === slug) ?? null;
}

export async function getFichasComCondicao(): Promise<FichaNoAr[]> {
  return (await getAllFichas()).filter((f) => f.condicao != null);
}

export async function getAcervoDoDono(): Promise<{ fichas: FichaNoAr[]; ocultos: Set<string> }> {
  const { linhas, padrao } = await lerNoPrazo(lerAcervoComOrigem(getClient()));
  const fichas = ordenarPorNome([...linhas.entries()].map(([slug, l]) => noAr(fichaDaVersao(slug, l.doc), l, padrao)));
  const ocultos = new Set([...linhas.entries()].filter(([, l]) => l.oculto).map(([slug]) => slug));
  return { fichas, ocultos };
}

/** 🔴 DUAS FICHAS, E CADA UMA TEM SEU USO (07/10): `ficha` é o DOCUMENTO cru —
 *  é o que a ficha inteira edita, e um lugar sem regra própria aparece SEM
 *  regra lá, pra o João calibrar (Task 8). `noAr` é o que o público vê — é o
 *  que o carimbo do painel mostra. Trocar uma pela outra faria o painel
 *  mostrar a regra padrão como se fosse do lugar. */
export async function getFichaDoDono(
  slug: string,
): Promise<{ ficha: Ficha; noAr: FichaNoAr; oculto: boolean; versaoId: number; origem: OrigemDoLugar } | null> {
  const l = await lerNoPrazo(lugarDoDono(getClient(), slug));
  if (l == null) return null;
  const ficha = fichaDaVersao(slug, l.versao.doc);
  return { ficha, noAr: noAr(ficha, l.origem, l.padrao), oculto: l.versao.oculto, versaoId: l.versao.id, origem: l.origem };
}

export async function fichaDoEnderecoAntigo(velho: string): Promise<FichaNoAr | null> {
  const novo = await lerNoPrazo(enderecoNovoDe(getClient(), velho));
  return novo === null ? null : getFicha(novo);
}
```

(Os docblocks de hoje ficam; o de `getAllFichas` troca "`versoesAtuais` com `incluirOcultos`" por "`lerAcervoComOrigem`, que traz os escondidos". `versoesAtuais` sai do import se ficar sem uso.)

- [ ] **Step 7: Os consumidores trocam de tipo — o `tsc` é a lista**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | cut -d"(" -f1 | sort -u`

A lista esperada, e o que cada um faz (nenhum muda o que desenha):
- `src/lib/carimbo-estado.ts` — `resolverEstado`, `semAviso`, `janelaMaxima`, `resolverEstados`, `climaDeTodas` recebem `FichaNoAr`.
- `src/app/page.tsx` (o par `{ ficha: FichaNoAr; leitura }`), `src/app/FolhaTrilhas.tsx` (`ParFolha`), `src/app/CartaoTrilha.tsx`, `src/app/ListaDoAcervo.tsx`, `src/app/MapaHome.tsx` — `Ficha` → `FichaNoAr`.
- `src/app/admin/marca-agora.ts`, `src/app/admin/PainelAdmin.tsx`, `src/app/admin/ListaDeLugares.tsx` — `FichaNoAr`.
- `src/app/admin/[slug]/page.tsx` — `const { ficha, noAr, oculto, versaoId } = doDono;`; `resolverEstado(noAr)`; `<PainelAdmin ficha={noAr} … />`; `FichaInteira`, `precisaDeVista`, `vistaDaCidade` e `avisoDoEndereco` continuam com `ficha` (o documento).
- `src/app/[slug]/page.tsx` — SÓ nas linhas depois do `const precoCurto`: `const formatoGate = (ficha.discriminador?.formato ?? "").trim();`, `const [ressalvaLead, ...ressalvaResto] = (ficha.condicao.ressalva_proxy ?? "").split("—");`, e `ficha.discriminador?.como_ler` / `ficha.discriminador?.permissao_abortar` no JSX. A página que CALA é a Task 4; aqui é só compilar. Confira: `grep -n "const precoCurto" "src/app/[slug]/page.tsx"` continua dando **125**.
- `src/app/api/admin/previsao-carimbo/route.ts` — logo depois de ler a ficha (≈`:195-216`): lugar sem regra própria não tem o que prever (a tela dele, Task 8, é o "Calibrar", não o editor de número):
  ```ts
  // Lugar sem regra própria (07/10) não tem número de motor pra prever: a tela
  // dele é "Calibrar" (Task 8), que não passa por aqui.
  if (ficha.condicao.regra === undefined || ficha.condicao.severidade === undefined) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  ```
  (use o nome de cabeçalho que a rota já usa; se ela não tiver `TEXTO`, use o objeto de cabeçalho da recusa 400 vizinha.)
- Outros arquivos que o `tsc` listar: a regra é a mesma — quem desenha pro PÚBLICO recebe `FichaNoAr`; quem EDITA recebe `Ficha`. Se a correção exigir mudar comportamento, PARE e relate.

- [ ] **Step 8: Os testes que já existiam, nas formas novas**

- `tests/lib/ficha-fonte.test.ts` — todo `ler` passa a devolver `{ linhas, padrao: REGRA_PADRAO_INICIAL }`, e cada linha ganha `contribuidor: null, conferido: true` (importe `REGRA_PADRAO_INICIAL` de `@/lib/regra-padrao` e `lerAcervoComOrigem` de `@/lib/db`). Os pontos, um a um (M3 da pré-auditoria — conferidos no arquivo de hoje):
  - o helper `umaLinha` (`:7`), que hoje é `new Map([["rampa-do-pepe", { doc, oculto: false }]])`, vira:
    ```ts
    const umaLinha = (doc: unknown) => ({
      linhas: new Map([["rampa-do-pepe", { doc: JSON.stringify(doc), oculto: false, contribuidor: null, conferido: true }]]),
      padrao: REGRA_PADRAO_INICIAL,
    });
    ```
  - os dois `Map` montados à mão — o de "ordena por nome do primeiro waypoint" (`:60`) e o de "chave do banco e slug de dentro do documento divergem" (`:85`) — viram `{ linhas: new Map([...as mesmas entradas, cada uma com contribuidor: null, conferido: true]), padrao: REGRA_PADRAO_INICIAL }`;
  - os dois `new Map()` vazios (`:72` e `:120`) viram `{ linhas: new Map(), padrao: REGRA_PADRAO_INICIAL }`;
  - o helper LOCAL `lerTudo` do bloco "contra o banco" (`:142`, hoje `versoesAtuais(c, { incluirOcultos: true })`) vira `const lerTudo = (c: Client) => lerAcervoComOrigem(c);` — todos os usos dele (`:156` a `:205`) ficam como estão; `versoesAtuais` sai do import se ficar sem uso.
  Nenhum caso muda de sentido.
- `tests/lib/db-rascunho.test.ts:53` — `buscarFichas(() => lerAcervoComOrigem(c))`.
- Os dublês de banco que só têm `execute` e chegam a uma leitura que agora é `batch` ganham `batch` do mesmo jeito — são DOIS (grep `execute: (` em `tests/`): `tests/lib/ficha-do-dono.test.ts:34` (o `pendurado`: `batch: () => new Promise<never>(() => {})`) e `tests/app/admin-page.test.tsx:261` (`batch: () => Promise.reject(new Error("turso fora"))`). Sem isto o caso mede um `TypeError` em vez do prazo/da recusa — vermelho pelo motivo errado. (O terceiro dublê, `tests/app/admin-tela-de-publicar.test.tsx:289`, NÃO muda: aquela página lê o rascunho por `lerRascunho`, que é `execute` — um `batch` lá seria inócuo.)
- Todo teste que monta `Ficha` à mão e a dá a um componente PÚBLICO ou a um dublê de `getFicha`/`getAllFichas`/`getFichasComCondicao`/`resolverEstado(s)` embrulha com `doJoao(...)` (de `tests/no-ar.ts`). Pela grep de hoje: `tests/app/{home,MioloHome,FolhaTrilhas,MapaHome,km-uma-fonte,ficha,CartaoTrilha}.test.tsx` e quem mais o `tsc` apontar. Dentro de `vi.hoisted`, importe o helper com `await import("../no-ar")` no corpo do `vi.mock`.
- `tests/lib/campos-da-ficha.test.ts:42` — `OBRIGATORIO_SO_NO_REGISTRO` ganha, com UM motivo compartilhado:
  ```ts
  const SO_DO_JOAO =
    "opcional no schema desde 07/10: o lugar mandado por quem usa o app não tem este campo, e a página " +
    "cala o bloco; obrigatório no registro porque é o registro que a porta de publicar do JOÃO lê";
  // … e no Map:
  ...["rotulo_escaneio", "voz", "premio", "avisos", "condicao.severidade", "condicao.regra_texto",
      "condicao.ressalva_proxy", "discriminador.formato", "discriminador.como_ler",
      "discriminador.permissao_abortar"].map((c) => [c, SO_DO_JOAO] as [string, string]),
  ```
  As folhas de `condicao.regra.*` NÃO entram: dentro do objeto `regra` elas continuam obrigatórias, e registro e schema concordam. Se o varredor do arquivo acusar alguma delas, é porque ele lê "opcional" pelo PAI — PARE e relate antes de acrescentar.
- 🔴 **`tests/lib/campos-da-ficha.test.ts:233-246` — o guarda dos blocos opcionais, REESCRITO, nunca apagado (C1 da pré-auditoria).** Com `condicao.regra` e `discriminador` OBJETOS opcionais, `BLOCOS_DO_SCHEMA` deixa de ser `[]` e o caso "o schema não tem bloco opcional nenhum — o `horario` virou lista" fica vermelho. A spec torna esses dois blocos opcionais; o guarda passa a listá-los EXPLICITAMENTE e continua travando o RESTO. O comentário 🔴 de cima do caso ganha, ao fim, o parágrafo de 07/10, e o caso inteiro vira:
  ```ts
  // 🔴 E DESDE 07/10 O SCHEMA TEM DOIS (C1 da pré-auditoria da rodada do lugar
  // de quem usa): `condicao.regra` e `discriminador` são OBJETOS opcionais, por
  // decisão da spec — o lugar mandado por quem usa não os tem. O "não sei" de
  // cada um, escrito, como a mensagem abaixo exige:
  //  - `condicao.regra`: não há "não sei" de folha. A regra entra INTEIRA pelo
  //    "Calibrar" (Task 8), e meia regra continua recusada pelo schema;
  //  - `discriminador`: nasce folha a folha pelo painel (`BLOCOS_QUE_NASCEM`,
  //    Task 8), e as três folhas são opcionais no schema.
  // Nos lugares do JOÃO, o "não sei" de cada folha dos dois continua recusado
  // pelo REGISTRO (`obrigatorio: true`; `OBRIGATORIO_SO_NO_REGISTRO`, acima).
  // A lista é EXATA: um terceiro bloco opcional continua vermelho aqui.
  it("o schema tem EXATAMENTE os dois blocos opcionais de 07/10 — `condicao.regra` e `discriminador`", () => {
    expect(
      [...BLOCOS_DO_SCHEMA].sort(),
      "bloco opcional novo no schema: decida como o \"não sei\" dele chega à tela, e escreva o motivo",
    ).toEqual(["condicao.regra", "discriminador"]);
  });
  ```
  O caso irmão do `horario` (logo abaixo) fica como está — ele continua verdade.
- 🔴 **`tests/lib/severidade.test.ts:124-132` — "o schema RECUSA ficha sem nível", REESCRITO, nunca apagado (C1 da pré-auditoria).** Com `condicao.severidade` opcional no schema o caso fica vermelho. O que ele trancava (ficha nova herdando calada a voz da Rampa) continua trancado um degrau acima, pela porta de publicar do JOÃO, que lê o registro. Importe `obrigatoriosFaltando` de `@/lib/porta-de-publicar`; o caso vira:
  ```ts
  // 🔴 REESCRITO EM 07/10 (C1 da pré-auditoria), nunca apagado. Desde a spec do
  // lugar de quem usa, o SCHEMA aceita ficha sem nível: o lugar mandado por
  // quem usa não tem, e a leitura pública o completa com a regra padrão do
  // banco (`noAr`). O defeito que este caso fechava — ficha nova entrando
  // calada com a severidade herdada — continua fechado pela porta de publicar
  // do JOÃO, que exige o nível (`obrigatorio: true` no registro).
  it("ficha sem nível: o schema aceita, e a porta do JOÃO a recusa", () => {
    const boa = JSON.parse(
      readFileSync(path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"),
    );
    expect(fichaSchema.safeParse(boa).success).toBe(true); // controle
    expect(obrigatoriosFaltando(boa)).not.toContain("condicao.severidade"); // controle: a Rampa responde
    const semNivel = { ...boa.condicao };
    delete semNivel.severidade;
    const sem = { ...boa, condicao: semNivel };
    expect(fichaSchema.safeParse(sem).success).toBe(true);
    expect(obrigatoriosFaltando(sem)).toContain("condicao.severidade");
  });
  ```
  O vizinho "o schema RECUSA nível inventado" fica como está (o `z.enum` continua lá).

- [ ] **Step 9: Rodar os testes novos e os vizinhos**

Run: `npx vitest run tests/lib/regra-padrao.test.ts tests/lib/ficha-da-pessoa.test.ts tests/lib/leitura-publica-da-pessoa.test.ts tests/lib/ficha-fonte.test.ts tests/lib/ficha-do-dono.test.ts tests/lib/campos-da-ficha.test.ts tests/lib/severidade.test.ts tests/lib/coerencia.test.ts tests/lib/coerencia-acervo.test.ts`
Expected: PASS — inclusive os dois guardas reescritos do C1 ("o schema tem EXATAMENTE os dois blocos opcionais de 07/10" e "ficha sem nível: o schema aceita, e a porta do JOÃO a recusa").

- [ ] **Step 10: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `noAr` usa `REGRA_PADRAO_INICIAL` em vez de `padrao` | "lugar SEM regra própria usa a padrão RECEBIDA" **e** "mudar a regra padrão no banco muda a dele" |
| M2 | `noAr` devolve `regraPropria: true` sempre | "lugar SEM regra própria usa a padrão RECEBIDA" |
| M3 | `noAr` devolve `conferido: true` sempre | "a origem vem de quem chama" **e** "chega NÃO conferido" |
| M4 | `buscarFichas` passa `{ conferido: true }` em vez de `l` | "o lugar da pessoa chega NÃO conferido" |
| M5 | `noAr` escreve em `doc.condicao` (`doc.condicao.regra = …`) em vez de copiar | "noAr não muda o documento recebido" |
| M6 | tira o `if (f[campo] === undefined) continue;` da coerência | "duas fichas sem voz … não 'emprestam'" |
| M7 | tira o `if (!r) return [];` de `janela-nao-zerada` | "ficha sem regra e sem checagem não derruba nenhuma regra" |
| M8 | `discriminador?.como_ler` → `discriminador.como_ler` em `prosaDe` | "ficha sem regra e sem checagem não derruba nenhuma regra" |
| M9 | `getFichaDoDono` devolve `ficha: noAr(…)` | "getFichaDoDono devolve o documento CRU" |
| M10 | `voz: z.string()` (volta a obrigatória) | "`voz` é opcional no schema" **e** "abre no fichaSchema com só as perguntas dela" |
| M11 | um TERCEIRO bloco opcional: o `custo: z.object({ … })` do `fichaSchema` (`src/types/ficha.ts:156`) ganha `.optional()` | "o schema tem EXATAMENTE os dois blocos opcionais de 07/10" (C1: o guarda continua travando o resto) |
| M12 | `condicao.severidade` volta a `obrigatorio: false` no registro (`src/lib/campos-da-ficha.ts:136`) | "ficha sem nível: o schema aceita, e a porta do JOÃO a recusa" |

- [ ] **Step 11: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 12: Commit e harness**

```bash
git add src/types/ficha.ts src/lib/regra-padrao.ts src/lib/ficha-fonte.ts src/lib/ficha.ts src/lib/coerencia.ts src/lib/carimbo-estado.ts src/app/page.tsx src/app/FolhaTrilhas.tsx src/app/CartaoTrilha.tsx src/app/ListaDoAcervo.tsx src/app/MapaHome.tsx "src/app/[slug]/page.tsx" src/app/admin/marca-agora.ts src/app/admin/PainelAdmin.tsx src/app/admin/ListaDeLugares.tsx src/app/admin/page.tsx "src/app/admin/[slug]/page.tsx" src/app/api/admin/previsao-carimbo/route.ts tests/no-ar.ts tests/lib/regra-padrao.test.ts tests/lib/ficha-da-pessoa.test.ts tests/lib/leitura-publica-da-pessoa.test.ts tests/lib/ficha-fonte.test.ts tests/lib/db-rascunho.test.ts tests/lib/ficha-do-dono.test.ts tests/lib/campos-da-ficha.test.ts tests/lib/severidade.test.ts tests/app/admin-page.test.tsx
# + cada arquivo de teste que o Step 8 embrulhou com doJoao, por caminho
git commit -m "feat(ficha): o que a pessoa nao responde vira opcional; o publico le FichaNoAr com a regra efetiva"
node scripts/mutar.mjs
```
Expected: 42/0/0 — as três trocas em `coerencia.ts` foram na mesma linha; "sem alvo" > 0 aqui quer dizer que uma linha nasceu ou morreu.

---

### Task 3: A regra padrão no carimbo — "seco" sem "carro comum", e a meia-linha

**Files:**
- Create: `src/lib/origem.ts` (as palavras da marca e da regra padrão; puro, lido por client component)
- Modify: `src/lib/severidade.ts` — `Voz` (:81), `vozDaFicha` (:89-93)
- Modify: `src/lib/carimbo-fase.ts` — `subDe` (:134-146) e o docblock dele (:129-133)
- Modify: `src/app/Carimbo.tsx` — a meia-linha, logo depois do `<p className="reason">…</p>` (≈:283-296)
- Modify: os chamadores de `vozDaFicha`: `src/app/[slug]/page.tsx:252`, `src/app/CartaoTrilha.tsx:70`, `src/app/admin/marca-agora.ts:44`, `src/app/admin/PainelAdmin.tsx:39`, `src/app/api/admin/previsao-carimbo/route.ts:242`
- Modify: `src/app/ficha.css` (a classe da meia-linha)
- Test: `tests/lib/carimbo-fase.test.ts`, `tests/lib/severidade.test.ts`, `tests/app/Carimbo.test.tsx` (acrescentar; os literais `{ severidade, horasPassado }` ganham `regraPropria: true`), `tests/app/carimbo-da-pessoa.test.tsx` (criar)

**Interfaces:**
- Consumes: `FichaNoAr` (Task 2), `semearLugarDaPessoa` (Task 1).
- Produces:
  - `src/lib/severidade.ts`: `export type Voz = { severidade: Severidade; horasPassado: number; regraPropria: boolean }`; `export function vozDaFicha(f: { condicao: { severidade: Severidade; regra: { janela_passado_horas: number } }; origem: { regraPropria: boolean } }): Voz`
  - `src/lib/origem.ts`: `ETIQUETA_NAO_CONFERIDO`, `FAIXA_NAO_CONFERIDO`, `MEIA_LINHA_REGRA_PADRAO`, `SECO_SEM_CARRO` (strings)

🔴 **Por que `regraPropria` mora na `Voz`.** Os QUATRO lugares que dizem a linha seca (o carimbo da ficha, o selo do cartão, o "na tela agora" do painel e a prévia do editor) já recebem a `Voz` montada por `vozDaFicha` — é o desenho do `severidade.ts` ("quatro montagens é a família de defeito que este projeto já pagou três vezes"). Pondo o fato na `Voz`, "seco" e "seco · carro comum" saem da MESMA conta nos quatro, e o `tsc` obriga todo literal de `Voz` a declarar o campo.

- [ ] **Step 1: Escrever os testes que falham**

`src/lib/origem.ts` nasce primeiro (é só texto, e os testes o importam):

```ts
/** AS PALAVRAS DA ORIGEM DE UM LUGAR (spec de 07/10, Parte 2) — e só elas.
 *
 *  🔴 Elas afirmam coisa sobre a ORIGEM ("o BatePerna não conferiu"), nunca
 *  sobre o lugar, e por isso podem morar num módulo que serve todos: são
 *  verdade em todo lugar que as recebe. O nome de quem mandou NUNCA entra aqui.
 *
 *  Puro, sem zod: client components (cartão, pin, carimbo) leem direto. */

// PENDENTE: redação minha, o João ainda não leu
export const ETIQUETA_NAO_CONFERIDO = "não conferido";

// PENDENTE: redação minha, o João ainda não leu
export const FAIXA_NAO_CONFERIDO = "Mandado por alguém que usa o app. O BatePerna ainda não conferiu.";

// PENDENTE: redação minha, o João ainda não leu
export const MEIA_LINHA_REGRA_PADRAO = "regra padrão — ninguém calibrou a chuva aqui";

/** A linha seca de um lugar SEM regra própria: a de sempre ("seco · carro
 *  comum", LIDA) com a metade que ninguém conferiu tirada — a spec de 07/10,
 *  Parte 4: "ninguém conferiu que carro comum chega". (A rodada "como se
 *  chega" depois alimenta esta linha.)
 *
 *  🔴 PENDENTE, e não LIDA (I6 da pré-auditoria): ele aprovou o DESENHO ("está
 *  certo, pode seguir"), não leu a frase na tela — e "pode seguir" nunca é "li
 *  e aprovei" (memória "trava removida por quem escreveu"). Vai pro pacote. */
// PENDENTE: subtração de "seco · carro comum" (LIDA); a palavra é da spec de 07/10, Parte 4 — o João ainda não leu a tela
export const SECO_SEM_CARRO = "seco";
```

Em `tests/lib/carimbo-fase.test.ts` (os literais `RAMPA` e afins ganham `regraPropria: true`):

```ts
describe("a linha seca depende de quem calibrou a chuva", () => {
  it("com regra própria, a de sempre: 'seco · carro comum'", () => {
    expect(subDe("afirmando", "fresco", { severidade: "nao-va", horasPassado: 6, regraPropria: true })).toBe("seco · carro comum");
  });

  it("sem regra própria, só 'seco' — ninguém conferiu que carro comum chega", () => {
    expect(subDe("afirmando", "fresco", { severidade: "cuidado", horasPassado: 6, regraPropria: false })).toBe("seco");
  });

  // O ramo molhado não muda: a fala é a da severidade, própria ou padrão.
  it("o ramo molhado é o mesmo com e sem regra própria", () => {
    const com = subDe("afirmando", "frio", { severidade: "cuidado", horasPassado: 6, regraPropria: true });
    const sem = subDe("afirmando", "frio", { severidade: "cuidado", horasPassado: 6, regraPropria: false });
    expect(sem).toBe(com);
  });
});
```

Em `tests/lib/severidade.test.ts`:

```ts
it("vozDaFicha leva a regra própria da origem", () => {
  const base = { condicao: { severidade: "espera" as const, regra: { janela_passado_horas: 3 } } };
  expect(vozDaFicha({ ...base, origem: { regraPropria: true } })).toEqual({ severidade: "espera", horasPassado: 3, regraPropria: true });
  expect(vozDaFicha({ ...base, origem: { regraPropria: false } }).regraPropria).toBe(false);
});
```

Em `tests/app/Carimbo.test.tsx` (o `VOZ_RAMPA` do arquivo ganha `regraPropria: true`):

```ts
describe("a meia-linha da regra padrão", () => {
  it("aparece no carimbo de lugar SEM regra própria", () => {
    const { container } = render(
      <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} aviso={null} pass={6} fut={3} slug="x"
        voz={{ severidade: "cuidado", horasPassado: 6, regraPropria: false }} />,
    );
    const linha = container.querySelector('[data-marca="regra-padrao"]');
    expect(linha?.textContent).toBe(MEIA_LINHA_REGRA_PADRAO);
  });

  it("NÃO aparece no carimbo de lugar com regra própria", () => {
    const { container } = render(
      <Carimbo estado="fresco" erro={false} calculadoEm={AGORA_S} aviso={null} pass={6} fut={3} slug="x" voz={VOZ_RAMPA} />,
    );
    expect(container.querySelector('[data-marca="regra-padrao"]')).toBeNull();
    expect(container.textContent).not.toContain(MEIA_LINHA_REGRA_PADRAO);
  });

  // 🔴 Ela é sobre a REGRA, não sobre o tempo: continua com o lugar fechado,
  // sem informação, ou conferindo.
  it("continua na fase 'sem informações'", () => {
    const { container } = render(
      <Carimbo estado="frio" erro={true} calculadoEm={AGORA_S} aviso={null} pass={6} fut={3} slug="x"
        voz={{ severidade: "cuidado", horasPassado: 6, regraPropria: false }} />,
    );
    expect(container.querySelector('[data-marca="regra-padrao"]')).not.toBeNull();
  });
});
```

(importe `MEIA_LINHA_REGRA_PADRAO` de `@/lib/origem`.)

`tests/app/carimbo-da-pessoa.test.tsx` — a ponta a ponta, pelo banco e pelas telas de verdade:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MEIA_LINHA_REGRA_PADRAO } from "@/lib/origem";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
  resolverEstados: vi.fn(),
}));

// Um SÁBADO às 8h de Recife, pela razão escrita em `tests/app/home.test.tsx`
// (a Rampa só abre sáb/dom; num dia útil a fase seria "fechado").
const AGORA_S = Math.floor(Date.UTC(2027, 0, 16, 11, 0) / 1000);
const SECO = { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null };

const banco = await bancoDeProducao();
const { resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
const Ficha = (await import("@/app/[slug]/page")).default;
const Home = (await import("@/app/page")).default;
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.mocked(resolverEstado).mockResolvedValue(SECO);
  vi.mocked(resolverEstados).mockImplementation(async (fichas) => new Map(fichas.map((f) => [f.slug, SECO])));
});
afterEach(() => cleanup());

const abrir = async (slug: string) =>
  render(await Ficha({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));

describe("o carimbo de um lugar sem regra própria", () => {
  it("a ficha da pessoa diz 'seco' sem 'carro comum', e mostra a meia-linha", async () => {
    const { container } = await abrir(SLUG);
    expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco");
    expect(container.querySelector('[data-marca="regra-padrao"]')?.textContent).toBe(MEIA_LINHA_REGRA_PADRAO);
  });

  it("a ficha da Rampa continua 'seco · carro comum', sem meia-linha", async () => {
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco · carro comum");
    expect(container.querySelector('[data-marca="regra-padrao"]')).toBeNull();
  });

  it("o selo do cartão da pessoa na home também diz só 'seco'", async () => {
    const { container } = render(await Home());
    const cartao = container.querySelector(`a.cartao[href="/${SLUG}"]`);
    expect(cartao, "a premissa: o cartão da pessoa está na home").not.toBeNull();
    expect(cartao!.querySelector(".selo .s")?.textContent).toBe("seco");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/carimbo-fase.test.ts tests/lib/severidade.test.ts tests/app/Carimbo.test.tsx tests/app/carimbo-da-pessoa.test.tsx`
Expected: FAIL — "seco" chega como "seco · carro comum"; nenhum `[data-marca="regra-padrao"]`.

- [ ] **Step 3: `Voz` e `vozDaFicha`**

`src/lib/severidade.ts`:

```ts
/** … (docblock de hoje) …
 *
 *  🔴 `regraPropria` (07/10): a linha SECA depende de alguém ter calibrado a
 *  chuva deste lugar — sem regra própria, ninguém conferiu que carro comum
 *  chega, e o carimbo diz só "seco". Mora aqui pela razão do docblock: os
 *  quatro que dizem a linha recebem ESTA `Voz`, montada num lugar só. */
export type Voz = { severidade: Severidade; horasPassado: number; regraPropria: boolean };

export function vozDaFicha(f: {
  condicao: { severidade: Severidade; regra: { janela_passado_horas: number } };
  origem: { regraPropria: boolean };
}): Voz {
  return {
    severidade: f.condicao.severidade,
    horasPassado: f.condicao.regra.janela_passado_horas,
    regraPropria: f.origem.regraPropria,
  };
}
```

E os chamadores: `vozDaFicha(ficha.condicao)` → `vozDaFicha(ficha)` em `[slug]/page.tsx:252`, `CartaoTrilha.tsx:70`, `marca-agora.ts:44`, `PainelAdmin.tsx:39`. Em `previsao-carimbo/route.ts:242` a prévia é de uma regra NOVA que o dono está escrevendo — por definição, regra própria:

```ts
  const voz = vozDaFicha({ condicao: { severidade: ficha.condicao.severidade, regra: nova }, origem: { regraPropria: true } });
```

- [ ] **Step 4: `subDe`**

`src/lib/carimbo-fase.ts`, o ramo seco (importe `SECO_SEM_CARRO` de `@/lib/origem`):

```ts
  return estado === "fresco"
    ? (voz.regraPropria ? "seco · carro comum" : SECO_SEM_CARRO)
    : falaMolhada(voz.severidade, voz.horasPassado).sub;
```

E o ⚠️ do docblock (`:129-133`) ganha a emenda: *"✅ 07/10: deixou de ser universal. Em lugar SEM regra própria a linha diz só 'seco' (decisão dele, spec de 07/10, Parte 4); com regra própria, segue como ele decidiu em 27/08."*

- [ ] **Step 5: A meia-linha no `Carimbo`**

`src/app/Carimbo.tsx`, logo depois do `</p>` que fecha o `<p className="reason">` (importe `MEIA_LINHA_REGRA_PADRAO` de `@/lib/origem`):

```tsx
      {/* 🔴 A MEIA-LINHA DA REGRA PADRÃO (spec de 07/10, Parte 2): o lugar não
          tem regra própria, e o carimbo está usando os números que o João
          escolheu pra todo lugar assim. Fica em TODA fase — é sobre a regra,
          não sobre a leitura. Só sai quando o lugar for calibrado (Task 8);
          "conferir" sem calibrar a deixa, porque continua verdade. */}
      {!voz.regraPropria && (
        <p className="regra-padrao" data-marca="regra-padrao">{MEIA_LINHA_REGRA_PADRAO}</p>
      )}
```

`src/app/ficha.css`, perto das regras do `.reason`:

```css
/* A meia-linha da regra padrão (07/10): menor e mais apagada que o motivo —
   é procedência, não veredito. */
.regra-padrao {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.75;
}
```

- [ ] **Step 6: Os literais de `Voz` dos testes**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | cut -d"(" -f1 | sort -u`
Todo literal `{ severidade, horasPassado }` em teste ganha `regraPropria: true` (o comportamento de hoje). Pela grep: `tests/api/route-admin-previsao-carimbo.test.ts`, `tests/app/Carimbo.test.tsx`, `tests/app/home.test.tsx`, `tests/app/painel-admin.test.tsx`, `tests/lib/carimbo-fase.test.ts`, `tests/lib/severidade.test.ts`.

- [ ] **Step 7: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/carimbo-fase.test.ts tests/lib/severidade.test.ts tests/app/Carimbo.test.tsx tests/app/carimbo-da-pessoa.test.tsx tests/app/home.test.tsx tests/app/painel-admin.test.tsx tests/api/route-admin-previsao-carimbo.test.ts`
Expected: PASS.

- [ ] **Step 8: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `subDe` volta a `"seco · carro comum"` sempre | "sem regra própria, só 'seco'" **e** "a ficha da pessoa diz 'seco'" **e** "o selo do cartão da pessoa" |
| M2 | `subDe` diz `SECO_SEM_CARRO` sempre | "com regra própria, a de sempre" **e** "a ficha da Rampa continua 'seco · carro comum'" |
| M3 | `vozDaFicha` devolve `regraPropria: true` | "vozDaFicha leva a regra própria da origem" **e** "a ficha da pessoa diz 'seco'" |
| M4 | o `Carimbo` mostra a meia-linha sempre | "NÃO aparece no carimbo de lugar com regra própria" **e** "a ficha da Rampa … sem meia-linha" |
| M5 | o `Carimbo` mostra a meia-linha só na fase `afirmando` | "continua na fase 'sem informações'" |

- [ ] **Step 9: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 10: Commit e harness**

```bash
git add src/lib/origem.ts src/lib/severidade.ts src/lib/carimbo-fase.ts src/app/Carimbo.tsx src/app/ficha.css "src/app/[slug]/page.tsx" src/app/CartaoTrilha.tsx src/app/admin/marca-agora.ts src/app/admin/PainelAdmin.tsx src/app/api/admin/previsao-carimbo/route.ts tests/lib/carimbo-fase.test.ts tests/lib/severidade.test.ts tests/app/Carimbo.test.tsx tests/app/carimbo-da-pessoa.test.tsx tests/app/home.test.tsx tests/app/painel-admin.test.tsx tests/api/route-admin-previsao-carimbo.test.ts
git commit -m "feat(carimbo): sem regra propria a linha seca diz so 'seco', e a meia-linha da regra padrao"
node scripts/mutar.mjs
```
Expected: 42/0/0 (`[slug]/page.tsx` mudou na linha 252, abaixo da N12).

📝 **Frases novas desta tarefa, pro pacote de copy:** `ETIQUETA_NAO_CONFERIDO`, `FAIXA_NAO_CONFERIDO`, `MEIA_LINHA_REGRA_PADRAO` (as duas primeiras só vão à tela na Task 5), e `SECO_SEM_CARRO` ("seco" — a subtração da linha LIDA, PENDENTE pelo I6).

---

### Task 4: A página cala cada bloco que o lugar não tem

**Files:**
- Modify: `src/app/[slug]/page.tsx` — os blocos `.scan` (:235), `.caveat` (:257-260), `.sec.premio` (:281-284), `.voz` (:291-294), o `.sec` dos Avisos (:389-392), `.gate` (:402-406). Todas as edições ficam ABAIXO do `const precoCurto` (:125): a N12 não se move.
- Modify: `src/app/ListaDoAcervo.tsx:50` (o `.scan` da lista)
- Test: `tests/app/ficha-que-cala.test.tsx` (criar)

**Interfaces:**
- Consumes: `FichaNoAr` com os campos opcionais (Task 2); `semearLugarDaPessoa` (Task 1); `gravarVersao` de `@/lib/db`.
- Produces: nada novo — a página passa a CALAR (não desenhar o bloco, nem o título dele) quando o campo falta.

🔴 **A régua (spec, Parte 1): o que não se pergunta, a página CALA** — não mostra o bloco, e NUNCA o preenche com texto genérico ("sem informação", "—", "não informado"). É a régua de sempre deste projeto pro `piso`, o `secaRapido` e o `horario`, estendida a seis blocos. Um teste POR CAMPO, porque uma guarda esquecida num bloco só passa verde num teste que olha a página inteira.

- [ ] **Step 1: Escrever os testes que falham**

`tests/app/ficha-que-cala.test.tsx`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gravarVersao } from "@/lib/db";
import { getFicha } from "@/lib/ficha";
import type { Ficha } from "@/types/ficha";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(async () => ({ estado: "fresco", erro: false, calculadoEm: 1_800_000_000, aviso: null })),
}));

const banco = await bancoDeProducao();
const Pagina = (await import("@/app/[slug]/page")).default;
const Trilhas = (await import("@/app/trilhas/page")).default;
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});
afterEach(() => cleanup());

const abrir = async (slug: string) =>
  render(await Pagina({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));

/** A Rampa com UM campo a menos, gravada como versão nova pelo banco de
 *  verdade. Cada caso tira um só — o bloco daquele campo cala, o resto fica.
 *
 *  ⚠️ `gravarVersao` direto, e NÃO o `gravarEdicao` de `tests/banco.ts`: aquele
 *  faz `{ ...ficha, ...mudanca }`, e espalhar não APAGA chave — o campo
 *  "tirado" voltaria da ficha original e o teste mediria a página inteira. */
async function rampaSem(tirar: (f: Ficha) => void): Promise<void> {
  const rampa = (await getFicha("rampa-do-pepe"))!;
  const { origem: _origem, ...doc } = structuredClone(rampa);
  tirar(doc as unknown as Ficha);
  await gravarVersao(banco, "rampa-do-pepe", JSON.stringify(doc), "painel", 1_759_000_000);
}

// Cada linha: o campo, como tirá-lo, e o seletor do bloco que tem de sumir.
const CASOS: [string, (f: Ficha) => void, string][] = [
  ["rotulo_escaneio", (f) => { delete f.rotulo_escaneio; }, ".hero .scan"],
  ["premio", (f) => { delete f.premio; }, ".sec.premio"],
  ["voz", (f) => { delete f.voz; }, ".voz"],
  ["condicao.ressalva_proxy", (f) => { delete f.condicao.ressalva_proxy; }, ".caveat"],
  ["avisos", (f) => { delete f.avisos; }, '[data-bloco="avisos"]'],
  ["discriminador", (f) => { delete f.discriminador; }, ".gate"],
];

describe("a ficha cala o bloco do campo que falta — um por campo", () => {
  it.each(CASOS)("sem `%s`, o bloco some", async (_campo, tirar, seletor) => {
    const { container: antes } = await abrir("rampa-do-pepe");
    expect(antes.querySelector(seletor), "a premissa: com o campo, o bloco existe").not.toBeNull();
    cleanup();
    await rampaSem(tirar);
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(seletor)).toBeNull();
  });

  it("checagem com SÓ o que olhar: o bloco fica, sem a frase de desistir", async () => {
    await rampaSem((f) => { delete f.discriminador!.permissao_abortar; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate .read")).not.toBeNull();
    expect(container.querySelector(".gate .perm")).toBeNull();
  });

  it("checagem com SÓ a frase de desistir: o bloco fica, sem o que olhar", async () => {
    await rampaSem((f) => { delete f.discriminador!.como_ler; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate .perm")).not.toBeNull();
    expect(container.querySelector(".gate .read")).toBeNull();
  });

  it("checagem com SÓ o formato (nada pra ler nem pra desistir): o bloco some", async () => {
    await rampaSem((f) => { f.discriminador = { formato: "entrada" }; });
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector(".gate")).toBeNull();
  });
});

describe("o lugar da pessoa, que não tem nenhum deles", () => {
  it("nenhum dos seis blocos aparece, e nenhum título deles sobra", async () => {
    const { container } = await abrir(SLUG);
    for (const [, , seletor] of CASOS) expect(container.querySelector(seletor), seletor).toBeNull();
    const texto = container.textContent ?? "";
    for (const titulo of ["O prêmio", "a voz de quem conhece", "⚠ Avisos", "a checagem é sua", "A checagem é sua"]) {
      expect(texto, titulo).not.toContain(titulo);
    }
  });

  // 🔴 "Nunca preenche com texto genérico": o que a pessoa ESCREVEU aparece, e
  // nada no lugar do que ela não escreveu.
  it("o que ela respondeu aparece: promessa e acesso", async () => {
    const { container } = await abrir(SLUG);
    expect(container.textContent).toContain("O que é Pedra Mandada, na palavra de quem mandou.");
    expect(container.textContent).toContain("Como se chega a Pedra Mandada, na palavra de quem mandou.");
  });

  it("na lista do acervo, sem etiqueta de escaneio", async () => {
    const { container } = render(await Trilhas());
    const item = container.querySelector(`a[href="/${SLUG}"]`);
    expect(item, "a premissa: o lugar dela está na lista").not.toBeNull();
    expect(item!.querySelector(".scan")).toBeNull();
  });
});
```

📝 **A cobertura de "um teste por campo opcionalizado" (spec, Testes), campo a campo** (M13 da pré-auditoria): `rotulo_escaneio`, `premio`, `voz`, `condicao.ressalva_proxy`, `avisos` e `discriminador` (e as folhas `como_ler`/`permissao_abortar`) têm caso AQUI; `condicao.regra` e `condicao.severidade` não têm bloco — a página não cala, ela usa a regra padrão, e quem prova é a Task 3 ("a ficha da pessoa diz 'seco'… e mostra a meia-linha"). **`condicao.regra_texto` não tem caso de "cala" porque nenhuma tela pública o mostra** — a prova é o grep, rodado na pré-auditoria e repetível: `grep -rn "regra_texto" src/app --include=*.tsx | grep -v "src/app/admin/"` → nada (os únicos leitores fora do painel são `src/lib/coerencia.ts:126`, onde o `join` trata `undefined` como texto vazio, e comentários de `src/lib/piso.ts`). Se um dia uma tela pública passar a mostrá-lo, o caso entra na tabela `CASOS` abaixo.

⚠️ O seletor dos Avisos é `[data-bloco="avisos"]`, que NÃO existe hoje — o bloco é um `.sec` igual ao do Acesso, sem identidade endereçável (a mesma razão do `data-bloco="trajeto"` que a página já tem). O Step 3 dá a ele o atributo; sem isso o teste mediria "algum `.sec` sumiu".

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/app/ficha-que-cala.test.tsx`
Expected: FAIL — os blocos aparecem vazios; `[data-bloco="avisos"]` não existe nem na premissa.

- [ ] **Step 3: A página cala, bloco a bloco**

Em `src/app/[slug]/page.tsx`:

```tsx
          {/* Calam (07/10): ausente é silêncio — nenhum "sem etiqueta". */}
          {ficha.rotulo_escaneio && <span className="scan">{ficha.rotulo_escaneio}</span>}
```

```tsx
        {/* A ressalva cala quando o lugar não tem (07/10): o lugar mandado por
            quem usa não respondeu o que a previsão não enxerga. */}
        {ficha.condicao.ressalva_proxy && (
          <div className="caveat">
            <span className="ic">⚠</span>
            <span><b>{ressalvaLead.trim()}.</b> {ressalvaResto.join("—").trim()}</span>
          </div>
        )}
```

```tsx
          {ficha.premio && (
            <div className="sec premio" data-nivel="b">
              <div className="k">O prêmio</div>
              <p>{ficha.premio}</p>
            </div>
          )}

          {/* (o comentário de hoje da voz fica aqui, intacto) */}
          {ficha.voz && (
            <div className="voz" data-nivel="b">
              “{ficha.voz}”
              <span className="who">— a voz de quem conhece</span>
            </div>
          )}
```

```tsx
          {ficha.avisos && (
            <div className="sec" data-nivel="b" data-bloco="avisos">
              <div className="k">⚠ Avisos</div>
              <div className="note"><span className="ic">⚠</span><p>{ficha.avisos}</p></div>
            </div>
          )}
```

E a checagem — o bloco existe se houver o que LER ou o que DIZER a quem desiste; o `formato` sozinho é só o título de um bloco vazio, e cala junto:

```tsx
        {(ficha.discriminador?.como_ler || ficha.discriminador?.permissao_abortar) && (
          <div className="gate" data-nivel="b">
            <div className="k">{tituloGate}</div>
            {ficha.discriminador.como_ler && <div className="read">{ficha.discriminador.como_ler}</div>}
            {ficha.discriminador.permissao_abortar && (
              <div className="perm">“{ficha.discriminador.permissao_abortar}”</div>
            )}
          </div>
        )}
```

(Se o `tsc` não estreitar `ficha.discriminador` dentro do bloco, leia-o numa constante logo acima do `return`: `const gate = ficha.discriminador;` — abaixo da N12, então sem reâncora.)

`src/app/ListaDoAcervo.tsx:50`:

```tsx
            {f.rotulo_escaneio && <span className="scan">{f.rotulo_escaneio}</span>}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run tests/app/ficha-que-cala.test.tsx tests/app/ficha.test.tsx tests/app/trilhas.test.tsx`
Expected: PASS. Confira `grep -n "const precoCurto" "src/app/[slug]/page.tsx"` → ainda **125**.

- [ ] **Step 5: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | tira o `ficha.premio &&` | "sem `premio`, o bloco some" |
| M2 | tira o `ficha.voz &&` | "sem `voz`, o bloco some" |
| M3 | tira o `ficha.condicao.ressalva_proxy &&` | "sem `condicao.ressalva_proxy`, o bloco some" |
| M4 | tira o `ficha.avisos &&` | "sem `avisos`, o bloco some" |
| M5 | o gate volta a aparecer com `ficha.discriminador &&` (só a presença do objeto) | "checagem com SÓ o formato … o bloco some" |
| M6 | tira o `como_ler &&` de dentro do gate | "checagem com SÓ a frase de desistir" |
| M7 | tira o `rotulo_escaneio &&` da `ListaDoAcervo` | "na lista do acervo, sem etiqueta de escaneio" |
| M8 | troca o `ficha.voz &&` por `<div className="voz">“{ficha.voz ?? "sem voz"}”…` | "nenhum dos seis blocos aparece" |

- [ ] **Step 6: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 7: Commit e harness**

```bash
git add "src/app/[slug]/page.tsx" src/app/ListaDoAcervo.tsx tests/app/ficha-que-cala.test.tsx
git commit -m "feat(ficha): a pagina cala cada bloco que o lugar nao tem"
node scripts/mutar.mjs
```
Expected: 42/0/0.

---

### Task 5: A marca em toda superfície pública — e a varredura que a prova

**Files:**
- Modify: `src/app/[slug]/page.tsx` — import de `@/lib/origem` (topo), o título do cartão do link (`:61`), `data-lugar` no `.screen` (:231), a faixa abaixo do nome (depois de `:239`). 🔴 **O import e qualquer linha nova no `generateMetadata` ficam ACIMA da N12: esta tarefa REANCORA a N12** (Step 5).
- Modify: `src/app/CartaoTrilha.tsx` (:59-73), `src/app/ListaDoAcervo.tsx` (:49-53), `src/app/PinTrilha.tsx` (as props e o `<a>`, que está em :61-68 — o arquivo tem 70 linhas), `src/app/MapaHome.tsx` (:248-258)
- Modify: `src/app/home.css`, `src/app/ficha.css` (as três classes da marca)
- Modify: `scripts/mutar.mjs` — a entrada `id: "N12"` (≈:855-861) e o texto cravado `src/app/[slug]/page.tsx@125-125` (≈:1613)
- Test: `tests/app/marca-em-toda-superficie.test.tsx` (criar)

**Interfaces:**
- Consumes: `FichaNoAr.origem.conferido` (Task 2); `ETIQUETA_NAO_CONFERIDO`, `FAIXA_NAO_CONFERIDO` (Task 3); `semearLugarDaPessoa` (Task 1).
- Produces:
  - **A convenção da marca, que a varredura lê e toda superfície futura segue:** o elemento que mostra UM lugar leva `data-lugar={slug}`; se o lugar não é conferido, ele **é ou contém** um elemento `data-marca="nao-conferido"`.
  - `PinTrilha` ganha a prop obrigatória `conferido: boolean`.

🔴 **POR QUE VARREDURA E NÃO LISTA.** A spec pede a marca "em qualquer superfície futura". Uma lista de componentes à mão é a doença que este projeto já pagou três vezes (lista cega ao que cresceu). A prova aqui tem DUAS metades, e as duas são enumeradas do que existe, não do que eu lembro:
1. **As páginas** saem do DISCO: todo `page.tsx`/`not-found.tsx` sob `src/app` fora de `admin/`, `contribuir/` e `api/`. Página pública nova sem entrada na tabela de renderização = vermelho.
2. **As ocorrências** saem da TELA: todo elemento cujo texto próprio, `aria-label`, `alt` ou `title` contém o nome do lugar da pessoa tem de morar dentro de um `[data-lugar]` DELE que tenha a marca. Componente novo que mostre o nome sem a caixa = vermelho.

- [ ] **Step 1: Escrever a varredura que falha**

`tests/app/marca-em-toda-superficie.test.tsx`:

```ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ETIQUETA_NAO_CONFERIDO, FAIXA_NAO_CONFERIDO } from "@/lib/origem";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
  resolverEstados: vi.fn(),
}));
vi.mock("next/navigation", async (real) => ({
  ...(await real<typeof import("next/navigation")>()),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));

const AGORA_S = Math.floor(Date.UTC(2027, 0, 16, 11, 0) / 1000);
const SECO = { estado: "fresco" as const, erro: false, calculadoEm: AGORA_S, aviso: null };
const NOME = "Pedra Mandada Marcador";

const banco = await bancoDeProducao();
const { resolverEstado, resolverEstados } = await import("@/lib/carimbo-estado");
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: NOME, cidade: "Cidade Teste" });
  vi.mocked(resolverEstado).mockResolvedValue(SECO);
  vi.mocked(resolverEstados).mockImplementation(async (fichas) => new Map(fichas.map((f) => [f.slug, SECO])));
});
afterEach(() => cleanup());

// ═══ METADE 1: as páginas, do DISCO ═══════════════════════════════════════

const APP = path.join(process.cwd(), "src", "app");
const FORA = new Set(["admin", "contribuir", "api"]);

function paginasPublicas(dir = APP, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) return base === "" && FORA.has(e.name) ? [] : paginasPublicas(path.join(dir, e.name), rel);
    return /^(page|not-found)\.tsx$/.test(e.name) ? [rel] : [];
  });
}

/** Como cada página pública é aberta com o lugar da pessoa no acervo. Página
 *  pública NOVA sem linha aqui deixa o primeiro caso vermelho. */
const RENDERIZAR: Record<string, () => Promise<HTMLElement>> = {
  "page.tsx": async () => render(await (await import("@/app/page")).default()).container,
  "trilhas/page.tsx": async () => render(await (await import("@/app/trilhas/page")).default()).container,
  "not-found.tsx": async () => render(await (await import("@/app/not-found")).default()).container,
  "[slug]/page.tsx": async () =>
    render(
      await (await import("@/app/[slug]/page")).default({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      }),
    ).container,
};

/** Quantas vezes, NO MÍNIMO, o nome tem de aparecer em cada página — a
 *  não-vacuidade: uma página que não mostrasse o lugar passaria a varredura
 *  sem medir nada. A home tem o cartão E o pin. */
const MINIMO: Record<string, number> = { "page.tsx": 2, "trilhas/page.tsx": 1, "not-found.tsx": 1, "[slug]/page.tsx": 2 };

// ═══ METADE 2: as ocorrências, da TELA ════════════════════════════════════

function ocorrencias(raiz: HTMLElement): Element[] {
  return [...raiz.querySelectorAll("*")].filter((el) => {
    const proprio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join("");
    const atributos = ["aria-label", "alt", "title"].map((a) => el.getAttribute(a) ?? "").join(" ");
    return proprio.includes(NOME) || atributos.includes(NOME);
  });
}

function semMarca(el: Element): string | null {
  const caixa = el.closest("[data-lugar]");
  if (caixa === null) return `<${el.tagName.toLowerCase()} class="${el.className}"> fora de qualquer [data-lugar]`;
  if (caixa.getAttribute("data-lugar") !== SLUG) return `dentro do [data-lugar="${caixa.getAttribute("data-lugar")}"], que não é o dele`;
  const marcada = caixa.matches('[data-marca="nao-conferido"]') || caixa.querySelector('[data-marca="nao-conferido"]') !== null;
  return marcada ? null : `[data-lugar="${SLUG}"] sem [data-marca="nao-conferido"]`;
}

describe("a invariante: lugar não conferido nunca aparece sem a marca", () => {
  it("toda página pública do disco está na varredura, e nenhuma entrada é fantasma", () => {
    const doDisco = paginasPublicas().sort();
    expect(doDisco, "a premissa: o disco foi lido").toContain("[slug]/page.tsx");
    expect(doDisco).toEqual(Object.keys(RENDERIZAR).sort());
  });

  it.each(Object.keys(RENDERIZAR))("em %s, toda ocorrência do nome mora numa caixa marcada", async (pagina) => {
    const tela = await RENDERIZAR[pagina]();
    const achadas = ocorrencias(tela);
    expect(achadas.length, `${pagina}: o lugar da pessoa nem apareceu`).toBeGreaterThanOrEqual(MINIMO[pagina]);
    expect(achadas.map(semMarca).filter((x) => x !== null)).toEqual([]);
  });

  // O outro lado: a marca não vaza pros lugares do João.
  it.each(Object.keys(RENDERIZAR))("em %s, nenhum lugar do João leva a marca", async (pagina) => {
    const tela = await RENDERIZAR[pagina]();
    for (const m of tela.querySelectorAll('[data-marca="nao-conferido"]')) {
      expect(m.closest("[data-lugar]")?.getAttribute("data-lugar")).toBe(SLUG);
    }
  });
});

describe("as palavras e o desenho de cada superfície", () => {
  it("o cartão da home: a etiqueta junto do nome", async () => {
    const tela = await RENDERIZAR["page.tsx"]();
    const cartao = tela.querySelector(`a.cartao[data-lugar="${SLUG}"]`)!;
    expect(cartao.querySelector(".cartao-topo [data-marca='nao-conferido']")?.textContent).toBe(ETIQUETA_NAO_CONFERIDO);
  });

  it("o pin: contorno diferente, e a etiqueta no nome que o leitor de tela lê", async () => {
    const tela = await RENDERIZAR["page.tsx"]();
    const pin = tela.querySelector(`a.pin-home[href="#${SLUG}"]`)!;
    expect(pin.getAttribute("data-conferido")).toBe("nao");
    expect(pin.getAttribute("aria-label")).toContain(ETIQUETA_NAO_CONFERIDO);
    const rampa = tela.querySelector('a.pin-home[href="#rampa-do-pepe"]')!;
    expect(rampa.hasAttribute("data-conferido")).toBe(false);
  });

  it("o contorno do pin existe no CSS", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(path.join(APP, "home.css"), "utf8");
    expect(css).toMatch(/\.pin-home\[data-conferido="nao"\]\s*\{[^}]*outline/);
  });

  it("a ficha: a faixa abaixo do nome, e o nome de quem mandou NÃO aparece", async () => {
    const tela = await RENDERIZAR["[slug]/page.tsx"]();
    const faixa = tela.querySelector(".hero [data-marca='nao-conferido']");
    expect(faixa?.textContent).toBe(FAIXA_NAO_CONFERIDO);
    expect(tela.textContent).not.toContain("user_pessoa_de_teste");
  });

  it("o cartão do link no WhatsApp leva a etiqueta; o da Rampa não", async () => {
    const { generateMetadata } = await import("@/app/[slug]/page");
    const dela = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });
    expect(String(dela.title)).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(String(dela.openGraph?.title)).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(String((dela.twitter as { title?: string }).title)).toContain(ETIQUETA_NAO_CONFERIDO);
    const rampa = await generateMetadata({ params: Promise.resolve({ slug: "rampa-do-pepe" }) });
    expect(String(rampa.title)).not.toContain(ETIQUETA_NAO_CONFERIDO);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/marca-em-toda-superficie.test.tsx`
Expected: FAIL — "fora de qualquer [data-lugar]" em toda página; a premissa do disco passa.

- [ ] **Step 3: A marca em cada superfície**

`src/app/CartaoTrilha.tsx` (importe `ETIQUETA_NAO_CONFERIDO` de `@/lib/origem`):

```tsx
    <a
      id={ficha.slug}
      className="cartao"
      data-lugar={ficha.slug}
      data-state={tomDe(leitura.estado, ficha.condicao.severidade)}
      href={`/${ficha.slug}`}
    >
      <span className="cartao-topo">
        <span className="cartao-nome">{ficha.trajeto.waypoints[0].nome}</span>
        {/* 🔴 A MARCA (spec de 07/10, Parte 2): junto do nome, porque é pelo
            nome que se escolhe. Sai quando o João confere. */}
        {!ficha.origem.conferido && (
          <span className="etiqueta-nao-conferido" data-marca="nao-conferido">{ETIQUETA_NAO_CONFERIDO}</span>
        )}
        <SeloTrilha … />
```

`src/app/ListaDoAcervo.tsx`:

```tsx
          <a key={f.slug} className="lista-item" href={`/${f.slug}`} data-lugar={f.slug}>
            {f.rotulo_escaneio && <span className="scan">{f.rotulo_escaneio}</span>}
            <span className="lista-t">{f.trajeto.waypoints[0].nome}</span>
            {!f.origem.conferido && (
              <span className="etiqueta-nao-conferido" data-marca="nao-conferido">{ETIQUETA_NAO_CONFERIDO}</span>
            )}
```

`src/app/PinTrilha.tsx` — prop nova, obrigatória (o `tsc` obriga o `MapaHome` a passá-la; opcional, um pin novo nasceria sem marca em silêncio):

```tsx
  /** O lugar foi conferido pelo João? Obrigatório pela razão do
   *  `fechadoPeloDono` de `Situacao`: opcional, um mapa novo esqueceria e o
   *  pin de um lugar não conferido sairia igual aos outros. */
  conferido: boolean;
```

e o `<a>`:

```tsx
    <a
      className="pin-home"
      href={`#${slug}`}
      data-lugar={slug}
      data-state={tomDe(leitura.estado, severidade)}
      data-fase={fase}
      {...(conferido ? {} : { "data-conferido": "nao", "data-marca": "nao-conferido" })}
      style={{ left, top }}
      aria-label={conferido ? `Ver ${nome}` : `Ver ${nome}, ${ETIQUETA_NAO_CONFERIDO}`}
    />
```

`src/app/MapaHome.tsx` (:248): `conferido={f.origem.conferido}` no `<PinTrilha>`.

`src/app/[slug]/page.tsx`:

```tsx
      <div className="screen" data-lugar={ficha.slug}>
```

e, logo depois da cidade (`{ficha.cidade && <p className="ficha-cidade">…}`):

```tsx
          {/* 🔴 A FAIXA (spec de 07/10, Parte 2): logo abaixo do nome, antes de
              qualquer coisa que a pessoa escreveu. O nome de quem mandou NÃO
              aparece. Sai quando o João confere. */}
          {!ficha.origem.conferido && (
            <p className="faixa-nao-conferido" data-marca="nao-conferido">{FAIXA_NAO_CONFERIDO}</p>
          )}
```

E o cartão do link (`generateMetadata`, `:61`), NA MESMA LINHA:

```ts
  const nome = ficha.trajeto.waypoints[0].nome + (ficha.cidade ? ` — ${ficha.cidade}` : "") + (ficha.origem.conferido ? "" : ` · ${ETIQUETA_NAO_CONFERIDO}`); // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Formato meu (" — Cidade"). PENDENTE: o " · não conferido" é redação minha (07/10), o João ainda não leu.
```

(O cartão do WhatsApp é superfície pública — ele sai do app pra conversa e fica lá. Sem a etiqueta, um link de lugar não conferido chegaria sem marca nenhuma: escolha 6 no fim do plano.)

⚠️ **Esta linha carrega DUAS marcas, e é de propósito** (M9 da pré-auditoria): o `LIDA:` é do formato de antes (`nome — Cidade`), o `PENDENTE` é do `· não conferido` novo. Ela NÃO se parte em duas: é alvo do cerco de `waypoints[0]` e mora acima da N12. Como o guarda da Task 16 não lê `[slug]/page.tsx`, esta frase entra no relatório da tarefa e na lista da Task 16 (Step 3) POR NOME — "o `· ${ETIQUETA_NAO_CONFERIDO}` do `const nome` do `generateMetadata`" —, não só pelo `grep`.

O import (`import { ETIQUETA_NAO_CONFERIDO, FAIXA_NAO_CONFERIDO } from "@/lib/origem";`) entra no topo — é a linha que desloca a N12.

- [ ] **Step 4: O CSS**

`src/app/home.css`:

```css
/* A MARCA DE LUGAR NÃO CONFERIDO (07/10). A etiqueta é texto (lê-se de
   relance, e o leitor de tela lê); o pin não tem texto, então a marca dele é
   o CONTORNO — tracejado, que nenhum outro estado do pin usa. */
.etiqueta-nao-conferido {
  font-size: 11px;
  letter-spacing: 0.02em;
  padding: 1px 6px;
  border: 1px dashed currentColor;
  border-radius: 999px;
  opacity: 0.8;
  white-space: nowrap;
}
.pin-home[data-conferido="nao"] {
  outline: 2px dashed currentColor;
  outline-offset: 2px;
}
```

`src/app/ficha.css`:

```css
/* A faixa de lugar não conferido (07/10): logo abaixo do nome. */
.faixa-nao-conferido {
  margin: 6px 0 0;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px dashed currentColor;
  border-radius: 8px;
}
```

(Se `ListaDoAcervo` estiver numa página que não importa `home.css`, confira: `/trilhas` e `not-found` importam os dois.)

- [ ] **Step 5: Reancorar a N12**

Run: `grep -n "const precoCurto" "src/app/[slug]/page.tsx"` → anote o número (126 com o import; confira).
Em `scripts/mutar.mjs`, na entrada `id: "N12"`, troque `inicio: 125, fim: 125` pelo número novo; e no mapa cravado (`"N12": "src/app/[slug]/page.tsx@125-125→…`) troque `125-125` pelo mesmo. Nada mais muda na entrada.

- [ ] **Step 6: Rodar e confirmar que passam**

Run: `npx vitest run tests/app/marca-em-toda-superficie.test.tsx tests/app/home.test.tsx tests/app/MapaHome.test.tsx tests/app/CartaoTrilha.test.tsx tests/app/trilhas.test.tsx tests/app/nao-achei.test.tsx tests/app/ficha.test.tsx tests/app/metadata-ficha.test.ts tests/lib/harness-de-mutacao.test.ts`
Expected: PASS. (Testes que montam `PinTrilha` à mão ganham `conferido` — o `tsc` aponta.)

- [ ] **Step 7: Mutações — UMA POR SUPERFÍCIE, é o que a spec manda**

| # | mutação | morre em |
|---|---|---|
| M1 | tira a etiqueta do `CartaoTrilha` | "em page.tsx, toda ocorrência…" **e** "o cartão da home: a etiqueta" |
| M2 | tira `data-marca` do `PinTrilha` (deixa o `data-conferido`) | "em page.tsx, toda ocorrência…" |
| M3 | tira `data-lugar` do `PinTrilha` | "em page.tsx, toda ocorrência…" ("fora de qualquer [data-lugar]") |
| M4 | tira a etiqueta da `ListaDoAcervo` | "em trilhas/page.tsx…" **e** "em not-found.tsx…" |
| M5 | tira a faixa da ficha | "em [slug]/page.tsx…" **e** "a ficha: a faixa abaixo do nome" |
| M6 | tira o `· não conferido` do `generateMetadata` | "o cartão do link no WhatsApp leva a etiqueta" |
| M7 | cria `src/app/sobre/page.tsx` com `export default function S() { return null; }` | "toda página pública do disco está na varredura" |
| M8 | põe `<p className="eco">{wp.nome}</p>` FORA do `.screen` da ficha | "em [slug]/page.tsx…" ("fora de qualquer [data-lugar]") |
| M9 | `MapaHome` passa `conferido={true}` | "em page.tsx…" **e** "o pin: contorno diferente" |
| M10 | a etiqueta do cartão passa a sair pra TODO lugar (sem o `!ficha.origem.conferido`) | "em page.tsx, nenhum lugar do João leva a marca" |
| M11 | tira o `outline` do CSS do pin | "o contorno do pin existe no CSS" |

Apague o `src/app/sobre/` da M7 depois de medir.

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add "src/app/[slug]/page.tsx" src/app/CartaoTrilha.tsx src/app/ListaDoAcervo.tsx src/app/PinTrilha.tsx src/app/MapaHome.tsx src/app/home.css src/app/ficha.css scripts/mutar.mjs tests/app/marca-em-toda-superficie.test.tsx
# + os testes que ganharam `conferido` no PinTrilha, por caminho
git commit -m "feat(marca): lugar nao conferido marcado em toda superficie publica, provado por varredura"
node scripts/mutar.mjs N12
node scripts/mutar.mjs
```
Expected: N12 "morreu"; depois 42/0/0.

📝 **Frase nova desta tarefa, pro pacote de copy:** o `" · não conferido"` do título do link (as outras três nasceram na Task 3 e vão à tela aqui).

---

### Task 6: O painel — "Mandados por quem usa o app, ainda não conferidos", e o "Conferi"

**Files:**
- Create: `src/lib/db-contribuidor.ts` (as funções de banco que são só da pessoa e dos atos do João sobre ela; cresce nas Tasks 10, 12 e 15)
- Create: `src/app/api/admin/conferir/route.ts`
- Modify: `src/app/admin/campos/palavras.ts` (a frase do 409 — arquivo de rota do Next não exporta nada além dos métodos: `tests/deploy/exports-de-rota.test.ts`)
- Create: `src/app/admin/SecaoNaoConferidos.tsx` (servidor), `src/app/admin/CaixaDaOrigem.tsx` (cliente: quem mandou + o botão de dois toques)
- Modify: `src/app/admin/page.tsx` (a seção no topo; a lista normal só com os conferidos), `src/app/admin/[slug]/page.tsx` (a caixa da origem, dentro do `ComVersaoDaTela`), `src/app/admin/admin.css`
- Test: `tests/lib/db-conferir.test.ts`, `tests/api/route-admin-conferir.test.ts`, `tests/app/admin-nao-conferidos.test.tsx` (criar os três); `tests/app/admin-page.test.tsx` (um caso); `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI` ganha as cinco frases — I1 da pré-auditoria)

**Interfaces:**
- Consumes: `origem_do_lugar`, `contribuidores` (Task 1); `getAcervoDoDono`/`getFichaDoDono` com `origem` (Task 2); `baseIdValido`, `LUGAR_MUDOU_DE_ENDERECO` de `@/lib/endereco`; `VersaoDaTela`, `comBase`, `ERRO_REDE` de `src/app/admin/campos/gravar.ts`.
- Produces (`src/lib/db-contribuidor.ts`):
  - `export type Contribuidor = { id: string; nome: string | null; email: string | null; bloqueado: boolean }`
  - `export type NaoConferido = { slug: string; doc: string; mandadoEm: number; contribuidor: Contribuidor }`
  - `export async function naoConferidos(client: Client): Promise<NaoConferido[]>` — mais novo primeiro
  - `export async function contribuidorPorId(client: Client, id: string): Promise<Contribuidor | null>`
  - `export async function conferirLugar(client: Client, slug: string, baseId: number, agora: number): Promise<boolean>`
  - `POST /api/admin/conferir` com corpo `{ slug, baseId }`: 200 `{slug}` · 400 · 401 · 404 (painel desligado) · 409 com frase

🔴 **"Conferi" tira a marca e a edição dela — e só isso.** A meia-linha da regra padrão FICA (spec, Parte 2: "conferir sem calibrar deixa a meia-linha, porque continua verdade"). A edição dela some porque toda gravação da pessoa confere `conferido = 0` NO MESMO statement (Task 12); aqui não há "tirar a permissão" separado que possa ficar pela metade.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/db-conferir.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { conferirLugar, contribuidorPorId, naoConferidos } from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, PESSOA_DE_TESTE, semearAcervo, semearLugarDaPessoa } from "../banco";

let c: Client;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
});
afterEach(() => c.close());

const base = async (slug: string) => (await versaoAtual(c, slug))!.id;

describe("naoConferidos", () => {
  it("lista os lugares de quem usa, ainda não conferidos, o mais novo primeiro, com quem mandou", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 0, ?)",
      args: [PESSOA_DE_TESTE, "Maria Teste", "maria@teste.invalid", AGORA_SEMENTE],
    });
    const velho = await semearLugarDaPessoa(c, { nome: "Pedra Velha", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 10 });
    const novo = await semearLugarDaPessoa(c, { nome: "Pedra Nova", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 20 });
    const lista = await naoConferidos(c);
    expect(lista.map((l) => l.slug)).toEqual([novo, velho]);
    expect(lista[0]).toMatchObject({ mandadoEm: AGORA_SEMENTE + 20, contribuidor: { id: PESSOA_DE_TESTE, nome: "Maria Teste", email: "maria@teste.invalid", bloqueado: false } });
  });

  it("nenhum lugar do João entra, e o conferido sai", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99)).toBe(true);
    expect(await naoConferidos(c)).toEqual([]);
  });

  it("quem mandou sem linha em contribuidores aparece só com o id — nada inventado", async () => {
    await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect((await naoConferidos(c))[0].contribuidor).toEqual({ id: PESSOA_DE_TESTE, nome: null, email: null, bloqueado: false });
  });
});

describe("conferirLugar", () => {
  it("liga o conferido do lugar, e a leitura do público vê", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99)).toBe(true);
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(true);
  });

  it("lugar do João não tem o que conferir — false, e nenhuma linha nasce", async () => {
    expect(await conferirLugar(c, "rampa-do-pepe", await base("rampa-do-pepe"), AGORA_SEMENTE + 99)).toBe(false);
    expect(Number((await c.execute("SELECT COUNT(*) AS n FROM origem_do_lugar")).rows[0].n)).toBe(0);
  });

  it("o segundo toque não confere de novo — false", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 99);
    expect(await conferirLugar(c, slug, await base(slug), AGORA_SEMENTE + 100)).toBe(false);
  });

  // 🔴 A aba velha: a versão que a tela abriu não mora mais neste endereço.
  it("baseId de outro lugar não confere este", async () => {
    const slug = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
    expect(await conferirLugar(c, slug, await base("rampa-do-pepe"), AGORA_SEMENTE + 99)).toBe(false);
    expect((await lerAcervoComOrigem(c)).linhas.get(slug)?.conferido).toBe(false);
  });

  it("conferir um lugar não confere OUTRO da mesma pessoa", async () => {
    const a = await semearLugarDaPessoa(c, { nome: "Pedra Um", cidade: "Cidade Teste" });
    const b = await semearLugarDaPessoa(c, { nome: "Pedra Dois", cidade: "Cidade Teste" });
    await conferirLugar(c, a, await base(a), AGORA_SEMENTE + 99);
    expect((await lerAcervoComOrigem(c)).linhas.get(b)?.conferido).toBe(false);
  });
});

describe("contribuidorPorId", () => {
  it("devolve a linha, e null pra quem não tem", async () => {
    await c.execute({
      sql: "INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 1, ?)",
      args: [PESSOA_DE_TESTE, "Maria Teste", null, AGORA_SEMENTE],
    });
    expect(await contribuidorPorId(c, PESSOA_DE_TESTE)).toEqual({ id: PESSOA_DE_TESTE, nome: "Maria Teste", email: null, bloqueado: true });
    expect(await contribuidorPorId(c, "user_ninguem")).toBeNull();
  });
});
```

`tests/api/route-admin-conferir.test.ts` (molde: `tests/api/route-admin-visibilidade.test.ts` — `Request` à mão, `vi.stubEnv`, `criarSessao` de verdade, `getClient` dublado; ASSERÇÃO DUPLA em todo caso: o código E o banco):

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { base, semearAcervo, semearLugarDaPessoa } from "../banco";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-conferir";
const AGORA = 1_758_300_000;
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/conferir/route").POST;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = (await import("@/app/api/admin/conferir/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/conferir", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const conferido = async () => (await lerAcervoComOrigem(c)).linhas.get(SLUG)?.conferido;

describe("POST /api/admin/conferir", () => {
  it("200, e o lugar passa a conferido", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }, cookieBom));
    expect(res.status, await res.text()).toBe(200);
    expect(await conferido()).toBe(true);
  });

  it("painel desligado: 404, antes de tudo, e nada muda", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }, cookieBom));
    expect(res.status).toBe(404);
    expect(await conferido()).toBe(false);
  });

  it("sem sessão: 401, e nada muda", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG) }));
    expect(res.status).toBe(401);
    expect(await conferido()).toBe(false);
  });

  it.each([
    [{ slug: SLUG }],
    [{ baseId: 1 }],
    [{ slug: 3, baseId: 1 }],
    [{ slug: "x", baseId: 0 }],
    [{ slug: "x", baseId: 1, extra: true }],
  ])("corpo torto %j: 400, e nada muda", async (corpo) => {
    expect((await POST(pedido(corpo, cookieBom))).status).toBe(400);
    expect(await conferido()).toBe(false);
  });

  it("lugar do João: 409 com frase, e nenhuma origem nasce", async () => {
    const res = await POST(pedido({ slug: "rampa-do-pepe", baseId: await base(c, "rampa-do-pepe") }, cookieBom));
    expect(res.status).toBe(409);
    expect((await res.text()).length).toBeGreaterThan(20);
    expect((await lerAcervoComOrigem(c)).linhas.get("rampa-do-pepe")?.contribuidor).toBeNull();
  });

  it("a versão da tela que não mora mais aqui: 409", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: (await versaoAtual(c, "rampa-do-pepe"))!.id }, cookieBom));
    expect(res.status).toBe(409);
    expect(await conferido()).toBe(false);
  });
});
```

`tests/app/admin-nao-conferidos.test.tsx` — a seção e a caixa, renderizadas puras (props), mais o botão:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import SecaoNaoConferidos, { TITULO_NAO_CONFERIDOS } from "@/app/admin/SecaoNaoConferidos";
import CaixaDaOrigem, { CONFERI, CONFERI_MESMO } from "@/app/admin/CaixaDaOrigem";
import { ComVersaoDaTela } from "@/app/admin/campos/gravar";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const UM = { slug: "pedra-mandada-cidade-teste", nome: "Pedra Mandada", cidade: "Cidade Teste", mandadoEm: 1_759_800_000, quem: "Maria Teste", email: "maria@teste.invalid" };

describe("a seção dos não conferidos", () => {
  it("sem nenhum, a seção não existe — nem o título", () => {
    const { container } = render(<SecaoNaoConferidos itens={[]} />);
    expect(container.textContent).toBe("");
  });

  it("com um: título, link pro lugar no painel, nome, e-mail e data", () => {
    const { container } = render(<SecaoNaoConferidos itens={[UM]} />);
    expect(container.querySelector("h2")?.textContent).toBe(TITULO_NAO_CONFERIDOS);
    const link = container.querySelector(`a[href="/admin/${UM.slug}"]`);
    expect(link?.textContent).toContain("Pedra Mandada");
    expect(container.textContent).toContain("Maria Teste");
    expect(container.textContent).toContain("maria@teste.invalid");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(UM.mandadoEm * 1000).toISOString());
  });

  it("quem mandou sem nome nem e-mail: a linha da pessoa cala", () => {
    const { container } = render(<SecaoNaoConferidos itens={[{ ...UM, quem: null, email: null }]} />);
    expect(container.querySelector(".adm-quem")).toBeNull();
  });
});

describe("a caixa da origem, no lugar", () => {
  it("o 'Conferi' pede o segundo toque, e só então grava, com o baseId da tela", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: UM.slug }), { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByRole } = render(
      <ComVersaoDaTela id={77}>
        <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={UM.mandadoEm} conferido={false} />
      </ComVersaoDaTela>,
    );
    fireEvent.click(getByRole("button", { name: CONFERI }));
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: CONFERI_MESMO }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/conferir");
    expect(JSON.parse(init.body)).toEqual({ slug: UM.slug, baseId: 77 });
  });

  it("lugar já conferido: a caixa diz quem mandou, e não tem botão", () => {
    const { container } = render(
      <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={UM.mandadoEm} conferido={true} />,
    );
    expect(container.textContent).toContain("Maria Teste");
    expect(container.querySelector("button")).toBeNull();
  });

  it("sem data (histórico ilegível), o <time> cala", () => {
    const { container } = render(
      <CaixaDaOrigem slug={UM.slug} quem="Maria Teste" email={null} mandadoEm={null} conferido={true} />,
    );
    expect(container.querySelector("time")).toBeNull();
  });

  it("409 mostra a frase da porta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Frase da porta.", { status: 409 })));
    const { getByRole, findByRole } = render(
      <CaixaDaOrigem slug={UM.slug} quem={null} email={null} mandadoEm={UM.mandadoEm} conferido={false} />,
    );
    fireEvent.click(getByRole("button", { name: CONFERI }));
    fireEvent.click(getByRole("button", { name: CONFERI_MESMO }));
    expect((await findByRole("alert")).textContent).toBe("Frase da porta.");
  });
});
```

E em `tests/app/admin-page.test.tsx`, no bloco que já renderiza a página com sessão (leia o arquivo; ele dubla `getClient` e semeia com `semearAcervo`), um caso:

```ts
it("o lugar não conferido sai da lista normal e entra na seção do topo", async () => {
  const slug = await semearLugarDaPessoa(cliente, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  // … renderize a página como os casos vizinhos fazem …
  expect(container.querySelector('[data-testid="nao-conferidos"]')?.textContent).toContain("Pedra Mandada");
  expect(container.querySelector(`[data-testid="lugares"] [data-lugar="${slug}"]`)).toBeNull();
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/db-conferir.test.ts tests/api/route-admin-conferir.test.ts tests/app/admin-nao-conferidos.test.tsx tests/app/admin-page.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: `src/lib/db-contribuidor.ts`**

```ts
import type { Client } from "@libsql/client";

/** O BANCO DE QUEM USA O APP, e dos atos do João sobre o que essa pessoa mandou
 *  (spec de 07/10). Mora fora de `db.ts` por tamanho, não por regra: as mesmas
 *  réguas valem — toda condição de corrida NO MESMO statement que grava, e
 *  `Number(...) === 1` pras colunas que decidem. */

export type Contribuidor = { id: string; nome: string | null; email: string | null; bloqueado: boolean };
export type NaoConferido = { slug: string; doc: string; mandadoEm: number; contribuidor: Contribuidor };

const texto = (v: unknown): string | null => (v == null ? null : String(v));

/** A identidade do lugar que mora em `slug` (menor `id`), em SQL — a mesma
 *  conta de `identidadeSql` em `db.ts`. */
const IDENTIDADE = (slug: string) => `(SELECT MIN(i.id) FROM ficha_versoes i WHERE i.ficha_slug = ${slug})`;

/** Os lugares de quem usa que o João ainda não conferiu, o mais novo primeiro.
 *  `mandadoEm` é o `criado_em` da versão 1 (a do publicar). Quem mandou vem
 *  de `contribuidores`; sem linha lá, só o id — nome e e-mail ficam `null`,
 *  nunca inventados. Inclui os ESCONDIDOS: esconder é tirar do público, não
 *  da fila dele. */
export async function naoConferidos(client: Client): Promise<NaoConferido[]> {
  const r = await client.execute(
    `SELECT v.ficha_slug AS slug, v.doc, o.contribuidor, k.nome, k.email, k.bloqueado,
            (SELECT criado_em FROM ficha_versoes WHERE id = o.lugar) AS mandado_em
       FROM origem_do_lugar o
       JOIN ficha_versoes v
         ON v.id = (SELECT MAX(j.id) FROM ficha_versoes j
                     WHERE j.ficha_slug = (SELECT f.ficha_slug FROM ficha_versoes f WHERE f.id = o.lugar))
       LEFT JOIN contribuidores k ON k.id = o.contribuidor
      WHERE o.conferido <> 1
      ORDER BY mandado_em DESC, slug ASC`,
  );
  return r.rows.map((l) => ({
    slug: String(l.slug),
    doc: String(l.doc),
    mandadoEm: Number(l.mandado_em),
    contribuidor: { id: String(l.contribuidor), nome: texto(l.nome), email: texto(l.email), bloqueado: Number(l.bloqueado) === 1 },
  }));
}

export async function contribuidorPorId(client: Client, id: string): Promise<Contribuidor | null> {
  const r = await client.execute({ sql: `SELECT id, nome, email, bloqueado FROM contribuidores WHERE id = ?`, args: [id] });
  if (!r.rows.length) return null;
  const l = r.rows[0];
  return { id: String(l.id), nome: texto(l.nome), email: texto(l.email), bloqueado: Number(l.bloqueado) === 1 };
}

/** "CONFERI": o lugar de `slug` passa a conferido — só se ele é de quem usa,
 *  ainda não foi conferido, e a versão `baseId` (a que a tela do painel abriu)
 *  mora em `slug`. Tudo no MESMO `UPDATE`. `false` = nada mudou.
 *
 *  🔴 Lugar do João não tem linha, então não há o que atualizar — e esta
 *  função NUNCA cria linha: conferir não é dizer de onde o lugar veio. */
export async function conferirLugar(client: Client, slug: string, baseId: number, agora: number): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE origem_do_lugar SET conferido = 1, conferido_em = ?
           WHERE conferido <> 1
             AND lugar = ${IDENTIDADE("?")}
             AND EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)`,
    args: [agora, slug, baseId, slug],
  });
  return r.rowsAffected === 1;
}
```

- [ ] **Step 4: A rota**

`src/app/api/admin/conferir/route.ts`:

```ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient } from "@/lib/db";
import { conferirLugar } from "@/lib/db-contribuidor";
import { baseIdValido } from "@/lib/endereco";
import { NAO_CONFERIU } from "@/app/admin/campos/palavras";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** "CONFERI" (spec de 07/10, Parte 3): o lugar mandado por quem usa perde a
 *  marca, e ela perde a edição. Falha fechada como toda rota do painel. A
 *  condição inteira mora em `conferirLugar`, num UPDATE só. */
export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) ||
    Object.keys(corpo).length !== 2 ||
    typeof (corpo as { slug?: unknown }).slug !== "string" ||
    !baseIdValido((corpo as { baseId?: unknown }).baseId)
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const { slug, baseId } = corpo as { slug: string; baseId: number };
  if (await conferirLugar(getClient(), slug, baseId, agora)) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  return new Response(NAO_CONFERIU, { status: 409, headers: TEXTO });
}
```

E em `src/app/admin/campos/palavras.ts`:

```ts
// PENDENTE: redação minha, o João ainda não leu
export const NAO_CONFERIU =
  "Nada mudou: este lugar já foi conferido, não foi mandado por quem usa o app, ou mudou de endereço enquanto você olhava. Recarregue a página.";
```

- [ ] **Step 5: A seção e a caixa**

`src/app/admin/SecaoNaoConferidos.tsx` (sem `"use client"`):

```tsx
import Link from "next/link";

// PENDENTE: redação minha, o João ainda não leu (o título é o da spec de 07/10, Parte 3)
export const TITULO_NAO_CONFERIDOS = "Mandados por quem usa o app, ainda não conferidos";

export type ItemNaoConferido = {
  slug: string;
  nome: string;
  cidade?: string;
  mandadoEm: number;
  quem: string | null;
  email: string | null;
};

/** A data e a hora de Recife, em números — nenhuma palavra. */
export const quandoRecife = (s: number): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(s * 1000));

/** O TOPO DO PAINEL (spec de 07/10, Parte 3): o que quem usa o app mandou e o
 *  João ainda não conferiu, o mais novo primeiro. Sem nenhum, a seção não
 *  existe. Nome e e-mail de quem mandou SÓ aqui e na caixa do lugar — nunca
 *  numa tela pública. */
export default function SecaoNaoConferidos({ itens }: { itens: readonly ItemNaoConferido[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="adm-nao-conferidos" data-testid="nao-conferidos">
      <h2>{TITULO_NAO_CONFERIDOS}</h2>
      <ul className="adm-lista">
        {itens.map((i) => (
          <li key={i.slug} className="adm-item" data-lugar={i.slug}>
            <Link href={`/admin/${i.slug}`} className="adm-item-link">
              <span className="adm-item-nome">
                {i.nome}
                {i.cidade && <span className="adm-item-cidade">{i.cidade}</span>}
              </span>
            </Link>
            {(i.quem || i.email) && (
              <span className="adm-quem">{[i.quem, i.email].filter(Boolean).join(" · ")}</span>
            )}
            <time dateTime={new Date(i.mandadoEm * 1000).toISOString()}>{quandoRecife(i.mandadoEm)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/app/admin/CaixaDaOrigem.tsx`:

```tsx
"use client";
import { useContext, useRef, useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE, VersaoDaTela, comBase } from "./campos/gravar";
import { quandoRecife } from "./SecaoNaoConferidos";

// PENDENTE: redação minha, o João ainda não leu
export const MANDADO_POR = "Mandado por quem usa o app";
// PENDENTE: redação minha, o João ainda não leu
export const CONFERI = "Conferi";
// PENDENTE: redação minha, o João ainda não leu
export const CONFERI_MESMO = "Conferi mesmo? A marca sai do ar, e quem mandou não edita mais.";

/** QUEM MANDOU ESTE LUGAR, e o "Conferi" em dois toques (spec de 07/10, Parte
 *  3). Mesmo molde do `BotaoDesistir`: o 1º toque pede confirmação, o 2º grava;
 *  no sucesso a tela se relê do banco (`location.reload()`), nunca estado
 *  otimista. O `baseId` é a versão que a página abriu (`VersaoDaTela`). */
export default function CaixaDaOrigem({
  slug, quem, email, mandadoEm, conferido,
}: { slug: string; quem: string | null; email: string | null; mandadoEm: number | null; conferido: boolean }) {
  const baseId = useContext(VersaoDaTela);
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  async function conferir(): Promise<void> {
    if (!confirmando) { setConfirmando(true); return; }
    if (emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/conferir", { method: "POST", body: JSON.stringify(comBase({ slug }, baseId)) });
      if (r.ok) { location.reload(); return; }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      emVoo.current = false;
      setIndo(false);
    }
  }

  return (
    <section className="adm-origem" data-origem={slug}>
      <p className="adm-origem-titulo">{MANDADO_POR}</p>
      {(quem || email) && <p className="adm-quem">{[quem, email].filter(Boolean).join(" · ")}</p>}
      {/* Sem a data (o histórico não foi lido), cala — nunca "01/01/1970". */}
      {mandadoEm !== null && <time dateTime={new Date(mandadoEm * 1000).toISOString()}>{quandoRecife(mandadoEm)}</time>}
      {!conferido && (
        <button type="button" disabled={indo} onClick={conferir}>
          {confirmando ? CONFERI_MESMO : CONFERI}
        </button>
      )}
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </section>
  );
}
```

⚠️ `CaixaDaOrigem` (cliente) importa `quandoRecife` de `SecaoNaoConferidos` (servidor, sem `"use client"`): é função pura, sem `next/link` no caminho dela — o bundler só leva o que é usado. Se o build reclamar do `Link`, mova `quandoRecife` pra `src/app/admin/quando.ts` e importe dos dois.

- [ ] **Step 6: As duas páginas**

`src/app/admin/page.tsx`, depois de `getAcervoDoDono()` (importe `naoConferidos` e o tipo; a leitura vai num `comPrazo` com a MESMA sentinela `ESTOUROU` e o MESMO `PRAZO_FICHA_MS` dos rascunhos — mesma razão):

```tsx
  const fila = await comPrazo<NaoConferido[] | typeof ESTOUROU>(naoConferidos(getClient()), PRAZO_FICHA_MS, ESTOUROU);
  if (fila === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura dos lugares não conferidos.");
  const itens = fila.map((l) => ({
    slug: l.slug,
    nome: nomeDoRascunho(l.doc, l.slug),
    cidade: cidadeDoDoc(l.doc),
    mandadoEm: l.mandadoEm,
    quem: l.contribuidor.nome,
    email: l.contribuidor.email,
  }));
  // Conferidos voltam pra lista normal (spec, Parte 3); os não conferidos moram
  // só na seção do topo.
  const daLista = fichas.filter((f) => f.origem.conferido);
```

e no JSX, antes da `ListaDeLugares` (que passa a receber `fichas={daLista}`):

```tsx
      <SecaoNaoConferidos itens={itens} />
```

`src/app/admin/[slug]/page.tsx`, dentro do `<ComVersaoDaTela>` e antes do `<PainelAdmin>` (importe `contribuidorPorId`, `CaixaDaOrigem`; `mandadoEm` é o `criado_em` da ÚLTIMA linha do histórico, que vem do mais novo pro mais velho — a versão 1):

```tsx
        {doDono.origem.contribuidor !== null && (
          <CaixaDaOrigem
            slug={slug}
            quem={quemMandou?.nome ?? null}
            email={quemMandou?.email ?? null}
            mandadoEm={historicoErro ? null : (linhas.at(-1)?.criado_em ?? null)}
            conferido={doDono.origem.conferido}
          />
        )}
```

com, antes do `return`:

```ts
  const quemMandou = doDono.origem.contribuidor === null ? null : await contribuidorPorId(getClient(), doDono.origem.contribuidor);
```

(Com o histórico ilegível, `linhas` vem vazio e não há data honesta: a caixa recebe `null` e cala o `<time>`.)

`src/app/admin/admin.css`: `.adm-nao-conferidos`, `.adm-origem` (molde de `.adm-visibilidade`), `.adm-quem` (fonte menor).

- [ ] **Step 7: O controle de completude do cerco do painel, e rodar**

🔴 **I1 da pré-auditoria.** `tests/app/admin-editores-de-campo.test.tsx` — o caso "toda frase que o painel EXPORTA está no controle de completude do cerco" lê, pelo parser do TypeScript, todo `export const X = "…"` sob `src/app/admin/**` e exige o texto em `CUNHADAS_AQUI`. As cinco frases desta tarefa moram lá; sem isto a suíte fecha VERMELHA. Importe cada uma do módulo onde mora (junte ao import que já existe de `@/app/admin/campos/palavras`, se houver) e acrescente ao FIM de `CUNHADAS_AQUI`, no molde dos blocos de lá:

```ts
import { NAO_CONFERIU } from "@/app/admin/campos/palavras";
import { TITULO_NAO_CONFERIDOS } from "@/app/admin/SecaoNaoConferidos";
import { CONFERI, CONFERI_MESMO, MANDADO_POR } from "@/app/admin/CaixaDaOrigem";
```

```ts
    // Rodada do lugar de quem usa (07/10), Task 6: a seção do topo do painel e
    // a caixa da origem no lugar. Nenhuma aparece no render das três fichas —
    // são de lugar mandado por quem usa, e o 409 só existe em recusa —, e é por
    // isso que é esta lista que as cerca.
    NAO_CONFERIU,
    TITULO_NAO_CONFERIDOS,
    MANDADO_POR,
    CONFERI,
    CONFERI_MESMO,
```

Run: `npx vitest run tests/lib/db-conferir.test.ts tests/api/route-admin-conferir.test.ts tests/app/admin-nao-conferidos.test.tsx tests/app/admin-page.test.tsx tests/app/admin-lugar.test.tsx tests/app/admin-lista.test.tsx tests/app/admin-editores-de-campo.test.tsx`
Expected: PASS — inclusive "toda frase que o painel EXPORTA está no controle de completude do cerco" e "nenhuma frase fixa do painel nomeia um lugar do acervo".

- [ ] **Step 8: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `conferirLugar` sem `AND conferido <> 1` | "o segundo toque não confere de novo" |
| M2 | `conferirLugar` sem o `EXISTS (… id = ? AND ficha_slug = ?)` | "baseId de outro lugar não confere este" **e** a rota "a versão da tela que não mora mais aqui" |
| M3 | `conferirLugar` com `lugar IN (SELECT lugar FROM origem_do_lugar WHERE contribuidor = …)` (todos da pessoa) | "conferir um lugar não confere OUTRO da mesma pessoa" |
| M4 | `naoConferidos` com `ORDER BY mandado_em ASC` | "o mais novo primeiro" |
| M5 | a rota sem a checagem de sessão | "sem sessão: 401" |
| M6 | a rota checa a sessão ANTES de `lerConfigAdmin` | "painel desligado: 404, antes de tudo" (com cookie bom e painel desligado, `sessaoValida` já dá falso → 401) |
| M7 | `CaixaDaOrigem` grava no 1º toque | "o 'Conferi' pede o segundo toque" |
| M8 | a página do painel passa `fichas` (todas) pra lista normal | o caso de `admin-page.test.tsx` |
| M9 | a seção mostra `"—"` quando não há quem | "quem mandou sem nome nem e-mail: a linha da pessoa cala" |

- [ ] **Step 9: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 10: Commit e harness**

```bash
git add src/lib/db-contribuidor.ts src/app/api/admin/conferir/route.ts src/app/admin/campos/palavras.ts src/app/admin/SecaoNaoConferidos.tsx src/app/admin/CaixaDaOrigem.tsx src/app/admin/page.tsx "src/app/admin/[slug]/page.tsx" src/app/admin/admin.css tests/lib/db-conferir.test.ts tests/api/route-admin-conferir.test.ts tests/app/admin-nao-conferidos.test.tsx tests/app/admin-page.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(painel): os lugares nao conferidos no topo, e o Conferi em dois toques"
node scripts/mutar.mjs
```

📝 **Frases novas:** `NAO_CONFERIU`, `TITULO_NAO_CONFERIDOS`, `MANDADO_POR`, `CONFERI`, `CONFERI_MESMO`.

---

### Task 7: A tela "Regra padrão da chuva", no painel

**Files:**
- Create: `src/lib/porta-da-regra-padrao.ts` (lê e confere o corpo; SÓ servidor)
- Create: `src/app/api/admin/regra-padrao/route.ts` (`PUT`)
- Create: `src/app/admin/chuva/page.tsx` (servidor), `src/app/admin/TelaDaRegraPadrao.tsx` (cliente)
- Modify: `src/app/admin/page.tsx` (o link pra tela, e os imports de `Link` e `TITULO_REGRA_PADRAO`), `src/app/admin/campos/palavras.ts` (o título), `src/lib/rascunho.ts:43` (`SLUGS_RESERVADOS` ganha `"chuva"`)
- Test: `tests/lib/porta-da-regra-padrao.test.ts`, `tests/api/route-admin-regra-padrao.test.ts`, `tests/app/admin-regra-padrao.test.tsx` (criar); `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI` — I1)

**Interfaces:**
- Consumes: `lerRegraPadrao`, `gravarRegraPadrao` (Task 1); `SEVERIDADES`; `TETO_PREVISAO_HORAS`, `TETO_PASSADO_HORAS` de `@/lib/weather`; `rotuloDe` de `src/app/admin/FichaInteira.tsx` (os rótulos JÁ LIDOS dos três números e da severidade).
- Produces:
  - `export function formaDaRegra(corpo: unknown): RegraPadrao | null` — só a forma (as quatro chaves, números finitos, severidade que existe)
  - `export function lerRegraDoCorpo(corpo: unknown): { regra: RegraPadrao } | { frase: string } | null` — `null` = corpo torto (400 vazio); `frase` = número que o app não aceita (400 com a frase)
  - `PUT /api/admin/regra-padrao` com corpo `{ janela_previsao_horas, janela_passado_horas, limiar_mm, severidade }`: 200 `RegraPadrao` · 400 · 401 · 404
  - a página `/admin/chuva`

🔴 **Por que `/admin/chuva` e não `/admin/regra-padrao`:** `/admin/[slug]` é a página de um lugar, e todo endereço de lugar tem hífen (`nome-cidade`). Segmento de tela sem hífen nunca colide com lugar — é a régua que `tests/api/route-admin-rascunho.test.ts` ("nenhuma tela do app tem hífen") já trava. E `"chuva"` entra em `SLUGS_RESERVADOS`, que o mesmo arquivo exige igual às pastas de `src/app/admin`.

🔴 **As recusas, e por que não reusam as do acervo:** as frases de `janela-nao-zerada`/`janela-dentro-do-provedor` (`coerencia.ts`) falam de UM lugar ("A regra de chuva de X…"); a padrão vale pra todo lugar sem regra própria, e a frase tem de dizer isso. Os LIMITES são os mesmos: cada janela pode ser 0 sozinha (decisões dele de 01/10), as duas juntas não; limiar > 0; teto do provedor.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/porta-da-regra-padrao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  JANELA_ALEM_DO_PASSADO, JANELA_ALEM_DA_PREVISAO, JANELA_NEGATIVA_PADRAO, JANELAS_ZERADAS, LIMIAR_SEM_CHUVA, lerRegraDoCorpo,
} from "@/lib/porta-da-regra-padrao";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";

const BOA = { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado" };

describe("lerRegraDoCorpo", () => {
  it("a regra boa passa, igual", () => {
    expect(lerRegraDoCorpo(BOA)).toEqual({ regra: BOA });
  });

  it.each([
    ["não é objeto", "x"],
    ["lista", [BOA]],
    ["chave a mais", { ...BOA, tipo: "chuva_binaria" }],
    ["chave a menos", { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2 }],
    ["número em texto", { ...BOA, limiar_mm: "0.2" }],
    ["infinito", { ...BOA, janela_passado_horas: Infinity }],
    ["NaN", { ...BOA, limiar_mm: Number.NaN }],
    ["severidade que não existe", { ...BOA, severidade: "talvez" }],
  ])("%s: torto, sem frase", (_nome, corpo) => {
    expect(lerRegraDoCorpo(corpo)).toBeNull();
  });

  // Decisões dele de 01/10: CADA janela pode ser zero sozinha.
  it("previsão 0 sozinha passa; passado 0 sozinho passa", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: 0 })).toEqual({ regra: { ...BOA, janela_previsao_horas: 0 } });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: 0 })).toEqual({ regra: { ...BOA, janela_passado_horas: 0 } });
  });

  // Review Focus 5.
  it("zera as duas janelas: recusada com a frase", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: 0, janela_passado_horas: 0 })).toEqual({ frase: JANELAS_ZERADAS });
  });

  it("janela negativa: recusada com a frase, em cada uma das duas", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: -1 })).toEqual({ frase: JANELA_NEGATIVA_PADRAO });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: -1 })).toEqual({ frase: JANELA_NEGATIVA_PADRAO });
  });

  it("limiar 0 ou negativo: recusado com a frase", () => {
    expect(lerRegraDoCorpo({ ...BOA, limiar_mm: 0 })).toEqual({ frase: LIMIAR_SEM_CHUVA });
    expect(lerRegraDoCorpo({ ...BOA, limiar_mm: -0.1 })).toEqual({ frase: LIMIAR_SEM_CHUVA });
  });

  it("além do provedor: recusada, e o teto exato passa", () => {
    expect(lerRegraDoCorpo({ ...BOA, janela_previsao_horas: TETO_PREVISAO_HORAS + 1 })).toEqual({ frase: JANELA_ALEM_DA_PREVISAO });
    expect(lerRegraDoCorpo({ ...BOA, janela_passado_horas: TETO_PASSADO_HORAS + 1 })).toEqual({ frase: JANELA_ALEM_DO_PASSADO });
    expect("regra" in lerRegraDoCorpo({ ...BOA, janela_previsao_horas: TETO_PREVISAO_HORAS })!).toBe(true);
  });
});
```

`tests/api/route-admin-regra-padrao.test.ts` (molde: `route-admin-conferir.test.ts` da Task 6):

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { lerRegraPadrao } from "@/lib/db";
import { JANELAS_ZERADAS } from "@/lib/porta-da-regra-padrao";
import { REGRA_PADRAO_INICIAL } from "@/lib/regra-padrao";
import { semearAcervo } from "../banco";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-regra-padrao";
const AGORA = 1_758_300_000;
let c: Client;
let cookieBom: string;
let PUT: typeof import("@/app/api/admin/regra-padrao/route").PUT;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  PUT = (await import("@/app/api/admin/regra-padrao/route")).PUT;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/regra-padrao", {
    method: "PUT",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const NOVA = { janela_previsao_horas: 2, janela_passado_horas: 12, limiar_mm: 1.5, severidade: "espera" };

describe("PUT /api/admin/regra-padrao", () => {
  it("200, devolve a regra, e o banco tem ela", async () => {
    const res = await PUT(pedido(NOVA, cookieBom));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual(NOVA);
    expect(await lerRegraPadrao(c)).toEqual(NOVA);
  });

  it("painel desligado: 404, e nada muda", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await PUT(pedido(NOVA, cookieBom))).status).toBe(404);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("sem sessão: 401, e nada muda", async () => {
    expect((await PUT(pedido(NOVA))).status).toBe(401);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("corpo torto: 400 sem frase, e nada muda", async () => {
    const res = await PUT(pedido({ ...NOVA, severidade: "talvez" }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("");
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });

  it("as duas janelas zeradas: 400 com a frase, e nada muda", async () => {
    const res = await PUT(pedido({ ...NOVA, janela_previsao_horas: 0, janela_passado_horas: 0 }, cookieBom));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(JANELAS_ZERADAS);
    expect(await lerRegraPadrao(c)).toEqual(REGRA_PADRAO_INICIAL);
  });
});
```

`tests/app/admin-regra-padrao.test.tsx` — a tela cliente e o link:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import TelaDaRegraPadrao, { SALVAR_REGRA } from "@/app/admin/TelaDaRegraPadrao";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ROTULOS = { previsao: "R1", passado: "R2", limiar: "R3", severidade: "R4" };
const ATUAL = { janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 0.2, severidade: "cuidado" as const };

describe("a tela da regra padrão", () => {
  it("mostra os quatro valores de AGORA, cada um com o rótulo já lido do painel", () => {
    const { getByLabelText } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    expect((getByLabelText("R1") as HTMLInputElement).value).toBe("3");
    expect((getByLabelText("R2") as HTMLInputElement).value).toBe("6");
    expect((getByLabelText("R3") as HTMLInputElement).value).toBe("0.2");
    expect((getByLabelText("R4") as HTMLSelectElement).value).toBe("cuidado");
  });

  it("salvar manda os quatro como NÚMEROS, num PUT só, e relê a tela", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByLabelText, getByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.change(getByLabelText("R2"), { target: { value: "12" } });
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/regra-padrao");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ ...ATUAL, janela_passado_horas: 12 });
  });

  it("a recusa com frase aparece na tela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Frase da porta.", { status: 400 })));
    const { getByRole, findByRole } = render(<TelaDaRegraPadrao atual={ATUAL} rotulos={ROTULOS} />);
    fireEvent.click(getByRole("button", { name: SALVAR_REGRA }));
    expect((await findByRole("alert")).textContent).toBe("Frase da porta.");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/porta-da-regra-padrao.test.ts tests/api/route-admin-regra-padrao.test.ts tests/app/admin-regra-padrao.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: `src/lib/porta-da-regra-padrao.ts`**

```ts
import { SEVERIDADES, type Severidade } from "@/lib/severidade";
import type { RegraPadrao } from "@/lib/regra-padrao";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";

// (`_PADRAO` no nome: `JANELA_NEGATIVA` já existe em `src/app/admin/campos/palavras.ts`, com outro texto — M10 da pré-auditoria)
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_NEGATIVA_PADRAO = "Nada foi gravado: uma janela de chuva não pode ser negativa. Escreva 0 ou mais horas.";
// PENDENTE: redação minha, o João ainda não leu
export const JANELAS_ZERADAS =
  "Nada foi gravado: com as duas janelas em 0 a regra nunca olha chuva nenhuma, e todo lugar sem regra própria ficaria 'seco' pra sempre.";
// PENDENTE: redação minha, o João ainda não leu
export const LIMIAR_SEM_CHUVA =
  "Nada foi gravado: o limite de chuva tem de ser maior que 0 mm. Com 0, qualquer orvalho fecharia todo lugar sem regra própria.";
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_ALEM_DA_PREVISAO = `Nada foi gravado: a previsão do tempo só vai até ${TETO_PREVISAO_HORAS} horas pra frente.`;
// PENDENTE: redação minha, o João ainda não leu
export const JANELA_ALEM_DO_PASSADO = `Nada foi gravado: o histórico de chuva só volta ${TETO_PASSADO_HORAS} horas.`;

const CHAVES = ["janela_previsao_horas", "janela_passado_horas", "limiar_mm", "severidade"] as const;

/** A FORMA dos quatro valores de uma regra (exatamente as quatro chaves,
 *  três números finitos, uma severidade que existe), ou `null`. Sem juízo
 *  sobre os números: quem julga é `lerRegraDoCorpo` (a padrão) ou a coerência
 *  (o "Calibrar" de um lugar, Task 8). */
export function formaDaRegra(corpo: unknown): RegraPadrao | null {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  if (Object.keys(c).length !== CHAVES.length || !CHAVES.every((k) => k in c)) return null;
  const { janela_previsao_horas: prev, janela_passado_horas: pass, limiar_mm: limiar, severidade } = c;
  if (![prev, pass, limiar].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (typeof severidade !== "string" || !(SEVERIDADES as readonly string[]).includes(severidade)) return null;
  return {
    janela_previsao_horas: prev as number,
    janela_passado_horas: pass as number,
    limiar_mm: limiar as number,
    severidade: severidade as Severidade,
  };
}

/** O CORPO DO `PUT /api/admin/regra-padrao`, lido e conferido. `null` = torto
 *  (a rota responde 400 vazio, como as outras portas do painel); `frase` = um
 *  número que o app não aceita, com o porquê. Os LIMITES são os do acervo
 *  (`janela-nao-zerada`, `janela-dentro-do-provedor` em `coerencia.ts`): cada
 *  janela pode ser 0 sozinha (decisões dele de 01/10), as duas juntas não. */
export function lerRegraDoCorpo(corpo: unknown): { regra: RegraPadrao } | { frase: string } | null {
  const regra = formaDaRegra(corpo);
  if (regra === null) return null;
  if (regra.janela_previsao_horas < 0 || regra.janela_passado_horas < 0) return { frase: JANELA_NEGATIVA_PADRAO };
  if (regra.janela_previsao_horas === 0 && regra.janela_passado_horas === 0) return { frase: JANELAS_ZERADAS };
  if (!(regra.limiar_mm > 0)) return { frase: LIMIAR_SEM_CHUVA };
  if (regra.janela_previsao_horas > TETO_PREVISAO_HORAS) return { frase: JANELA_ALEM_DA_PREVISAO };
  if (regra.janela_passado_horas > TETO_PASSADO_HORAS) return { frase: JANELA_ALEM_DO_PASSADO };
  return { regra };
}
```

(Confira em `coerencia.ts` se o teto é `>` ou `>=` — `janela-dentro-do-provedor` usa `>`; a mutação T3 do harness é justamente o `>=`. Use o MESMO operador.)

- [ ] **Step 4: A rota**

`src/app/api/admin/regra-padrao/route.ts`:

```ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient, gravarRegraPadrao } from "@/lib/db";
import { lerRegraDoCorpo } from "@/lib/porta-da-regra-padrao";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** A REGRA PADRÃO DA CHUVA, gravada pelo celular dele (spec de 07/10, Parte
 *  4). Mudar não pede código nem deploy: o próximo carimbo de todo lugar sem
 *  regra própria já lê a nova (`lerAcervoComOrigem`). Uma linha só, que
 *  sobrescreve — a regra padrão não afirma nada sobre um lugar. */
export async function PUT(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const lido = lerRegraDoCorpo(corpo);
  if (lido === null) return new Response("", { status: 400, headers: TEXTO });
  if ("frase" in lido) return new Response(lido.frase, { status: 400, headers: TEXTO });
  await gravarRegraPadrao(getClient(), lido.regra, agora);
  return Response.json(lido.regra, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 5: A tela**

`src/app/admin/TelaDaRegraPadrao.tsx`:

```tsx
"use client";
import { useState, type FormEvent } from "react";
import { SEVERIDADES, type Severidade } from "@/lib/severidade";
import type { RegraPadrao } from "@/lib/regra-padrao";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";
import { SALVANDO } from "./campos/palavras";

// PENDENTE: redação minha, o João ainda não leu
export const SALVAR_REGRA = "Salvar a regra padrão";
// PENDENTE: redação minha, o João ainda não leu
export const VALE_PARA = "Vale pra todo lugar que ainda não tem regra de chuva própria — hoje, os mandados por quem usa o app.";

type Rotulos = { previsao: string; passado: string; limiar: string; severidade: string };

/** A REGRA PADRÃO DA CHUVA (spec de 07/10, Parte 4). Os campos começam com os
 *  valores de AGORA, que são dele — não é pré-preencher, é a tela de editar o
 *  que já existe (a régua da ficha inteira). Os rótulos vêm do painel
 *  (`rotuloDe`), já lidos por ele; nenhuma palavra nova pros números. Um PUT
 *  só pros quatro: a regra é uma coisa, e meia regra gravada seria um estado
 *  que ninguém escolheu. */
export default function TelaDaRegraPadrao({ atual, rotulos }: { atual: RegraPadrao; rotulos: Rotulos }) {
  const [prev, setPrev] = useState(String(atual.janela_previsao_horas));
  const [pass, setPass] = useState(String(atual.janela_passado_horas));
  const [limiar, setLimiar] = useState(String(atual.limiar_mm));
  const [severidade, setSeveridade] = useState<Severidade>(atual.severidade);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const corpo = {
        janela_previsao_horas: Number(prev),
        janela_passado_horas: Number(pass),
        limiar_mm: Number(limiar),
        severidade,
      };
      const r = await fetch("/api/admin/regra-padrao", { method: "PUT", body: JSON.stringify(corpo) });
      if (r.ok) { location.reload(); return; }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-porta adm-regra-padrao" onSubmit={salvar}>
      <p className="adm-editor-ajuda">{VALE_PARA}</p>
      <label className="adm-rotulo">{rotulos.previsao}
        <input type="number" inputMode="decimal" step="any" value={prev} onChange={(e) => setPrev(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.passado}
        <input type="number" inputMode="decimal" step="any" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.limiar}
        <input type="number" inputMode="decimal" step="any" value={limiar} onChange={(e) => setLimiar(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.severidade}
        <select value={severidade} onChange={(e) => setSeveridade(e.target.value as Severidade)}>
          {SEVERIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="submit" disabled={indo}>{indo ? SALVANDO : SALVAR_REGRA}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
```

`src/app/admin/chuva/page.tsx` (molde de `src/app/admin/page.tsx`: 404 desligado, caixa de senha sem sessão, `robots` fora do índice, `comPrazo` na leitura):

```tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lerConfigAdmin } from "@/lib/admin-config";
import { COOKIE_ADMIN, avisarDesligado, sessaoValida } from "@/lib/admin-guarda";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, lerRegraPadrao } from "@/lib/db";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import type { RegraPadrao } from "@/lib/regra-padrao";
import CaixaDeSenha from "../CaixaDeSenha";
import { rotuloDe } from "../FichaInteira";
import TelaDaRegraPadrao from "../TelaDaRegraPadrao";
import { TITULO_REGRA_PADRAO } from "../campos/palavras";
import "../admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo da regra padrão");

export default async function Chuva() {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    notFound();
  }
  const token = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!sessaoValida(process.env, token, Math.floor(Date.now() / 1000))) {
    return (
      <main className="adm">
        <h1>Painel</h1>
        <CaixaDeSenha />
      </main>
    );
  }
  const atual = await comPrazo<RegraPadrao | typeof ESTOUROU>(lerRegraPadrao(getClient()), PRAZO_FICHA_MS, ESTOUROU);
  if (atual === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura da regra padrão.");
  return (
    <main className="adm">
      <h1>Painel</h1>
      <h2>{TITULO_REGRA_PADRAO}</h2>
      <TelaDaRegraPadrao
        atual={atual}
        rotulos={{
          previsao: rotuloDe("condicao.regra.janela_previsao_horas"),
          passado: rotuloDe("condicao.regra.janela_passado_horas"),
          limiar: rotuloDe("condicao.regra.limiar_mm"),
          severidade: rotuloDe("condicao.severidade"),
        }}
      />
    </main>
  );
}
```

Em `src/app/admin/campos/palavras.ts` (página do Next não exporta nada além do que o Next aceita — a frase mora no módulo de palavras):

```ts
// PENDENTE: redação minha, o João ainda não leu (o nome é o da spec de 07/10, Parte 4)
export const TITULO_REGRA_PADRAO = "Regra padrão da chuva";
```

Em `src/app/admin/page.tsx`, logo depois da `ListaDeLugares`: `<Link href="/admin/chuva" className="adm-novo-link">{TITULO_REGRA_PADRAO}</Link>` — com os dois imports que a página ainda NÃO tem (M8 da pré-auditoria; hoje ela não importa `next/link`):

```ts
import Link from "next/link";
import { TITULO_REGRA_PADRAO } from "./campos/palavras";
```

`src/lib/rascunho.ts:43`: `["admin", "api", "chuva", "icones", "trilhas", "novo"]` (e `"contribuir"` entra na Task 14, que é quem cria a pasta `src/app/contribuir/`).

- [ ] **Step 6: O controle de completude do cerco do painel, e rodar**

🔴 **I1 da pré-auditoria** (o porquê está na Task 6, Step 7). `SALVAR_REGRA` e `VALE_PARA` (`src/app/admin/TelaDaRegraPadrao.tsx`) e `TITULO_REGRA_PADRAO` (`src/app/admin/campos/palavras.ts`) entram em `CUNHADAS_AQUI` de `tests/app/admin-editores-de-campo.test.tsx`, importadas de onde moram. As frases de `src/lib/porta-da-regra-padrao.ts` NÃO entram: o portão lê só `src/app/admin/**`.

```ts
import { SALVAR_REGRA, VALE_PARA } from "@/app/admin/TelaDaRegraPadrao";
// e TITULO_REGRA_PADRAO no import que já existe de "@/app/admin/campos/palavras"
```

```ts
    // Task 7 (07/10): a tela da regra padrão. Moram em /admin/chuva, fora do
    // render das três fichas.
    SALVAR_REGRA,
    VALE_PARA,
    TITULO_REGRA_PADRAO,
```

Run: `npx vitest run tests/lib/porta-da-regra-padrao.test.ts tests/api/route-admin-regra-padrao.test.ts tests/app/admin-regra-padrao.test.tsx tests/api/route-admin-rascunho.test.ts tests/app/admin-editores-de-campo.test.tsx`
Expected: PASS (o `route-admin-rascunho` prova a reserva do `chuva`; o último, o cerco do painel com as três frases novas).

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | tira a recusa das duas janelas zeradas | "zera as duas janelas" (porta e rota) |
| M2 | recusa a previsão 0 sozinha (`=== 0 \|\|`) | "previsão 0 sozinha passa" |
| M3 | `limiar_mm > 0` → `>= 0` | "limiar 0 ou negativo" |
| M4 | teto com `>=` | "o teto exato passa" |
| M5 | tira a conferência de `CHAVES` (aceita chave a mais) | "chave a mais: torto" |
| M6 | a rota grava ANTES de conferir | "as duas janelas zeradas: 400 … e nada muda" |
| M7 | a tela manda `janela_passado_horas: pass` (texto) | "salvar manda os quatro como NÚMEROS" |
| M8 | tira `"chuva"` de `SLUGS_RESERVADOS` | "todo segmento estático de rota é reservado" (`route-admin-rascunho.test.ts`) |

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/lib/porta-da-regra-padrao.ts src/app/api/admin/regra-padrao/route.ts src/app/admin/chuva/page.tsx src/app/admin/TelaDaRegraPadrao.tsx src/app/admin/page.tsx src/app/admin/campos/palavras.ts src/lib/rascunho.ts tests/lib/porta-da-regra-padrao.test.ts tests/api/route-admin-regra-padrao.test.ts tests/app/admin-regra-padrao.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(painel): a regra padrao da chuva, editavel pelo celular"
node scripts/mutar.mjs
```

📝 **Frases novas:** `JANELA_NEGATIVA_PADRAO`, `JANELAS_ZERADAS`, `LIMIAR_SEM_CHUVA`, `JANELA_ALEM_DA_PREVISAO`, `JANELA_ALEM_DO_PASSADO`, `SALVAR_REGRA`, `VALE_PARA`, `TITULO_REGRA_PADRAO`.

---

### Task 8: O painel completa o lugar mandado — "Calibrar a chuva", e a checagem campo a campo

**Files:**
- Create: `src/lib/calibrar.ts`, `src/app/api/admin/calibrar/route.ts`, `src/app/admin/campos/EditorCalibrar.tsx`
- Modify: `src/app/admin/FichaInteira.tsx` (:486-556 — sem regra própria, o grupo da condição mostra o "Calibrar" no lugar dos quatro editores da regra)
- Modify: `src/lib/campos-da-ficha.ts` — `aplicarCampo` (:404-415): o `discriminador` ausente NASCE quando o João preenche uma folha dele
- Test: `tests/lib/calibrar.test.ts`, `tests/api/route-admin-calibrar.test.ts`, `tests/app/admin-calibrar.test.tsx` (criar); `tests/lib/aplicar-campo.test.ts` (acrescentar); `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI` — I1)

**Interfaces:**
- Consumes: `formaDaRegra` (Task 7); `violacaoIntroduzida` de `@/lib/porta-de-coerencia`; `gravarEdicao`, `versaoAtual`, `versoesAtuais` de `@/lib/db`; `LUGAR_MUDOU_DE_ENDERECO`, `baseIdValido` de `@/lib/endereco`.
- Produces:
  - `src/lib/calibrar.ts`: `export class JaTemRegra extends Error {}`; `export const JA_TEM_REGRA: string`; `export function calibrarDoc(docAtual: string, r: RegraPadrao): string`
  - `POST /api/admin/calibrar` com corpo `{ slug, baseId, regra: { janela_previsao_horas, janela_passado_horas, limiar_mm, severidade } }`: 200 · 400 · 401 · 404 · 409 com frase
  - `EditorCalibrar` (props `{ slug: string; rotulos: { previsao: string; passado: string; limiar: string; severidade: string } }`)

🔴 **Por que "Calibrar" é uma ação inteira, e não os quatro editores de sempre.** A regra entra INTEIRA ou não entra (Task 2: `condicao.regra` opcional, as folhas obrigatórias dentro dela). O editor de número grava UMA folha por vez — num lugar sem regra, `condicao.regra.limiar_mm` sozinho é uma regra pela metade, recusada pelo schema com um 400 mudo. Calibrar grava os quatro numa versão só, passa pela coerência (a frase de "janela zerada" é a do acervo, já lida por ele) e liga a regra própria pelo próprio documento — a meia-linha sai do carimbo, e um "voltar a esta" pra antes da calibração a traz de volta, coerente.

🔴 **Nada pré-preenchido**: os quatro campos do "Calibrar" começam VAZIOS, e a regra padrão NÃO aparece como referência — mostrá-la seria convidar a copiar os números de todo lugar pra este, que é exatamente "ninguém calibrou". Ele escreve os números DESTE lugar.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/calibrar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { JaTemRegra, calibrarDoc } from "@/lib/calibrar";
import { loadAll } from "@/lib/ficha";

const PESSOA = JSON.stringify({
  slug: "pedra-mandada-cidade-teste", modos: [], cidade: "Cidade Teste", promessa: "p",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] }, acesso: "a",
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
});
const R = { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" as const };

describe("calibrarDoc", () => {
  it("grava a regra inteira e a severidade, e nada mais muda", () => {
    const depois = JSON.parse(calibrarDoc(PESSOA, R));
    expect(depois.condicao).toEqual({
      coords: { lat: -8.31, lng: -35.97 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2 },
      severidade: "espera",
    });
    expect({ ...depois, condicao: undefined }).toEqual({ ...JSON.parse(PESSOA), condicao: undefined });
  });

  it("lugar que JÁ tem regra é recusado — calibrar não sobrescreve", () => {
    const rampa = JSON.stringify(loadAll().find((f) => f.slug === "rampa-do-pepe"));
    expect(() => calibrarDoc(rampa, R)).toThrow(JaTemRegra);
  });

  it("documento podre não vira calibrado", () => {
    expect(() => calibrarDoc('{"slug":"x"}', R)).toThrow();
  });
});
```

`tests/lib/aplicar-campo.test.ts` — dois casos a mais (leia o arquivo; use o documento-base dele, ou o `PESSOA` acima):

```ts
// 🔴 O discriminador do lugar mandado por quem usa não existe, e o João o
// preenche folha a folha: o objeto NASCE na primeira (Task 8).
it("preencher uma folha do discriminador ausente faz o objeto nascer só com ela", () => {
  const depois = JSON.parse(aplicarCampo(PESSOA, "discriminador.como_ler", "Olhe o chão."));
  expect(depois.discriminador).toEqual({ como_ler: "Olhe o chão." });
});

// …e SÓ ele: meia regra continua sem nascer.
it("uma folha da regra ausente continua recusada", () => {
  expect(() => aplicarCampo(PESSOA, "condicao.regra.limiar_mm", 1)).toThrow();
});
```

`tests/api/route-admin-calibrar.test.ts` (molde da Task 6):

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { historico, lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import { JA_TEM_REGRA } from "@/lib/calibrar";
import { base, semearAcervo, semearLugarDaPessoa } from "../banco";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-calibrar";
const AGORA = 1_758_300_000;
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/calibrar/route").POST;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = (await import("@/app/api/admin/calibrar/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const R = { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" };
const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/calibrar", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });
const versoes = async () => (await historico(c, SLUG)).length;

describe("POST /api/admin/calibrar", () => {
  it("200: o documento ganha a regra, numa versão nova, pelo painel", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect(res.status, await res.clone().text()).toBe(200);
    const atual = (await versaoAtual(c, SLUG))!;
    expect(JSON.parse(atual.doc).condicao.regra.limiar_mm).toBe(1.2);
    expect(atual.autor).toBe("painel");
    expect(await versoes()).toBe(2);
  });

  // 🔴 Calibrar NÃO confere: a marca de "não conferido" é outro ato (spec,
  // Parte 2 — e vice-versa: conferir não calibra).
  it("calibrar não confere o lugar", async () => {
    await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect((await lerAcervoComOrigem(c)).linhas.get(SLUG)?.conferido).toBe(false);
  });

  it("calibrar não muda a visibilidade (lugar escondido continua escondido)", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [SLUG] });
    await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom));
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("lugar que já tem regra: 409 com a frase, nada gravado", async () => {
    const antes = (await historico(c, "rampa-do-pepe")).length;
    const res = await POST(pedido({ slug: "rampa-do-pepe", baseId: await base(c, "rampa-do-pepe"), regra: R }, cookieBom));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_TEM_REGRA);
    expect((await historico(c, "rampa-do-pepe")).length).toBe(antes);
  });

  it("as duas janelas zeradas: 409 com a frase da coerência, nada gravado", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: { ...R, janela_previsao_horas: 0, janela_passado_horas: 0 } }, cookieBom));
    expect(res.status).toBe(409);
    expect((await res.text()).length).toBeGreaterThan(20);
    expect(await versoes()).toBe(1);
  });

  it("a aba velha (versão que não mora aqui): 409, nada gravado", async () => {
    const res = await POST(pedido({ slug: SLUG, baseId: await base(c, "rampa-do-pepe"), regra: R }, cookieBom));
    expect(res.status).toBe(409);
    expect(await versoes()).toBe(1);
  });

  it.each([
    [{ slug: "x", baseId: 1 }],
    [{ slug: "x", baseId: 1, regra: { ...R, severidade: "talvez" } }],
    [{ slug: "x", baseId: 1, regra: R, extra: 1 }],
  ])("corpo torto %j: 400", async (corpo) => {
    expect((await POST(pedido(corpo, cookieBom))).status).toBe(400);
  });

  it("sem sessão 401; painel desligado 404", async () => {
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }))).status).toBe(401);
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await POST(pedido({ slug: SLUG, baseId: await base(c, SLUG), regra: R }, cookieBom))).status).toBe(404);
    expect(await versoes()).toBe(1);
  });
});
```

`tests/app/admin-calibrar.test.tsx`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import EditorCalibrar, { CALIBRAR, FALTA_UM_DOS_QUATRO } from "@/app/admin/campos/EditorCalibrar";
import FichaInteira from "@/app/admin/FichaInteira";
import { ComVersaoDaTela } from "@/app/admin/campos/gravar";
import { fichaSchema } from "@/types/ficha";
import { loadAll } from "@/lib/ficha";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ROT = { previsao: "R1", passado: "R2", limiar: "R3", severidade: "R4" };
const PESSOA = fichaSchema.parse({
  slug: "pedra-mandada-cidade-teste", modos: [], cidade: "Cidade Teste", promessa: "p",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] }, acesso: "a",
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
});

describe("EditorCalibrar", () => {
  it("os quatro campos começam VAZIOS — nada pré-preenchido", () => {
    const { getByLabelText } = render(<EditorCalibrar slug="x" rotulos={ROT} />);
    for (const r of ["R1", "R2", "R3"]) expect((getByLabelText(r) as HTMLInputElement).value).toBe("");
    expect((getByLabelText("R4") as HTMLSelectElement).value).toBe("");
  });

  it("manda os quatro como números, com o baseId da tela, num POST só", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { getByLabelText, getByRole } = render(
      <ComVersaoDaTela id={5}><EditorCalibrar slug="x" rotulos={ROT} /></ComVersaoDaTela>,
    );
    fireEvent.change(getByLabelText("R1"), { target: { value: "2" } });
    fireEvent.change(getByLabelText("R2"), { target: { value: "5" } });
    fireEvent.change(getByLabelText("R3"), { target: { value: "1.2" } });
    fireEvent.change(getByLabelText("R4"), { target: { value: "espera" } });
    fireEvent.click(getByRole("button", { name: CALIBRAR }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/admin/calibrar");
    expect(JSON.parse(init.body)).toEqual({
      slug: "x", baseId: 5,
      regra: { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1.2, severidade: "espera" },
    });
  });
});

describe("EditorCalibrar com resposta faltando", () => {
  it("com uma caixa vazia, não chama a rota e diz o que falta", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const { getByLabelText, getByRole, findByRole } = render(<EditorCalibrar slug="x" rotulos={ROT} />);
    fireEvent.change(getByLabelText("R1"), { target: { value: "2" } });
    fireEvent.change(getByLabelText("R2"), { target: { value: "5" } });
    fireEvent.change(getByLabelText("R4"), { target: { value: "espera" } });
    fireEvent.click(getByRole("button", { name: CALIBRAR }));
    expect((await findByRole("alert")).textContent).toBe(FALTA_UM_DOS_QUATRO);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("a ficha inteira de um lugar sem regra própria", () => {
  it("mostra o Calibrar, e NÃO os editores de número da regra", () => {
    const { container, getByRole } = render(<FichaInteira ficha={PESSOA} />);
    expect(getByRole("button", { name: CALIBRAR })).not.toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.regra.limiar_mm"]')).toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.severidade"]')).toBeNull();
  });

  // É também o CONTROLE do caso de cima: o MESMO seletor acha o bloco na Rampa
  // — sem ele, o `toBeNull()` de lá passaria por vacuidade.
  it("a da Rampa (com regra) mostra os editores de sempre, e não o Calibrar", () => {
    const rampa = loadAll().find((f) => f.slug === "rampa-do-pepe")!;
    const { container, queryByRole } = render(<FichaInteira ficha={rampa} />);
    expect(queryByRole("button", { name: CALIBRAR })).toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.regra.limiar_mm"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="campo-condicao.severidade"]')).not.toBeNull();
  });
});
```

(O bloco de um campo na ficha inteira é `data-testid={\`campo-${campo.caminho}\`}` — `src/app/admin/FichaInteira.tsx:474`, conferido na pré-auditoria; NÃO existe `data-campo` — M4.)

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/calibrar.test.ts tests/lib/aplicar-campo.test.ts tests/api/route-admin-calibrar.test.ts tests/app/admin-calibrar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `src/lib/calibrar.ts`**

```ts
import type { RegraPadrao } from "@/lib/regra-padrao";
import { fichaSchema } from "@/types/ficha";

/** O lugar já tem regra própria: calibrar não sobrescreve (os números dela se
 *  mudam um a um, pelos editores de sempre). */
export class JaTemRegra extends Error {}

/** A frase do 409. Mora aqui, e não na rota: arquivo de rota do Next não
 *  exporta nada além dos métodos (`tests/deploy/exports-de-rota.test.ts`). */
// PENDENTE: redação minha, o João ainda não leu
export const JA_TEM_REGRA = "Nada foi gravado: este lugar já tem regra de chuva própria. Mude os números dela um a um, nos campos da regra.";

/** "CALIBRAR A CHUVA" DE UM LUGAR (spec de 07/10, Parte 4): o documento ganha a
 *  regra INTEIRA e a severidade, numa conta só. É isso que liga a regra
 *  própria — ela é derivada do documento (`noAr`), não coluna. A coerência é
 *  de quem chama (a rota). Não muda `docAtual`. */
export function calibrarDoc(docAtual: string, r: RegraPadrao): string {
  const atual = fichaSchema.parse(JSON.parse(docAtual));
  if (atual.condicao.regra !== undefined) throw new JaTemRegra();
  return JSON.stringify(
    fichaSchema.parse({
      ...atual,
      condicao: {
        ...atual.condicao,
        regra: {
          tipo: "chuva_binaria",
          janela_previsao_horas: r.janela_previsao_horas,
          janela_passado_horas: r.janela_passado_horas,
          limiar_mm: r.limiar_mm,
        },
        severidade: r.severidade,
      },
    }),
  );
}
```

- [ ] **Step 4: A rota**

`src/app/api/admin/calibrar/route.ts`:

```ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { JA_TEM_REGRA, JaTemRegra, calibrarDoc } from "@/lib/calibrar";
import { getClient, gravarEdicao, versaoAtual, versoesAtuais } from "@/lib/db";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";
import { violacaoIntroduzida } from "@/lib/porta-de-coerencia";
import { formaDaRegra } from "@/lib/porta-da-regra-padrao";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** CALIBRAR A CHUVA DE UM LUGAR que ainda usa a regra padrão (Task 8). Uma
 *  versão nova, pelo painel, com a regra inteira — pela MESMA coerência e pela
 *  MESMA gravação condicional (`gravarEdicao`: identidade pela versão da tela,
 *  `oculto` lido no próprio INSERT) que toda edição de campo usa. */
export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const c = corpo as { slug?: unknown; baseId?: unknown; regra?: unknown };
  const regra = typeof corpo === "object" && corpo !== null && !Array.isArray(corpo) && Object.keys(corpo).length === 3
    ? formaDaRegra(c.regra) : null;
  if (regra === null || typeof c.slug !== "string" || !baseIdValido(c.baseId)) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const slug = c.slug;
  const atual = await versaoAtual(getClient(), slug);
  if (atual === null) return new Response("", { status: 400, headers: TEXTO });

  let novo: string;
  try {
    novo = calibrarDoc(atual.doc, regra);
  } catch (erro) {
    if (erro instanceof JaTemRegra) return new Response(JA_TEM_REGRA, { status: 409, headers: TEXTO });
    return new Response("", { status: 400, headers: TEXTO });
  }
  const aDizer = violacaoIntroduzida(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, atual.doc, novo);
  if (aDizer !== null) return new Response(aDizer, { status: 409, headers: TEXTO });

  if ((await gravarEdicao(getClient(), slug, novo, agora, c.baseId)) === null) {
    return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 5: `aplicarCampo` deixa o `discriminador` nascer**

`src/lib/campos-da-ficha.ts`, perto de `aplicarCampo`:

```ts
/** 🔴 OS BLOCOS QUE NASCEM NA FICHA NO AR (07/10). O `escrever` recusa degrau
 *  ausente (o comentário de lá conta por quê: um objeto de UMA folha nunca
 *  passava no schema). O `discriminador` mudou isso: desde 07/10 ele e as três
 *  folhas são opcionais, então `{ como_ler }` sozinho É um documento válido — e
 *  é assim que o João completa, folha a folha, o lugar mandado por quem usa,
 *  que chega sem checagem nenhuma. SÓ ele: a `condicao.regra` entra inteira,
 *  pelo "Calibrar" (`src/lib/calibrar.ts`), e meia regra continua recusada. */
const BLOCOS_QUE_NASCEM: ReadonlySet<string> = new Set(["discriminador"]);
```

e, no corpo de `aplicarCampo`, a chamada de `escrever` do ramo comum (não o das faixas) passa a ser:

```ts
  return JSON.stringify(
    fichaSchema.parse(escrever(atual, caminho.split("."), valor, false, BLOCOS_QUE_NASCEM.has(caminho.split(".")[0]))),
  );
```

- [ ] **Step 6: O editor, e a ficha inteira**

`src/app/admin/campos/EditorCalibrar.tsx`:

```tsx
"use client";
import { useContext, useState, type FormEvent } from "react";
import { SEVERIDADES } from "@/lib/severidade";
import { ERRO_GRAVAR, ERRO_REDE, VersaoDaTela, comBase } from "./gravar";
import { SALVANDO } from "./palavras";

// PENDENTE: redação minha, o João ainda não leu
export const CALIBRAR = "Calibrar a chuva deste lugar";
// PENDENTE: redação minha, o João ainda não leu
export const CALIBRAR_AJUDA = "Este lugar usa a regra padrão. Responda os quatro pra ele ter a regra dele.";
// PENDENTE: redação minha, o João ainda não leu
export const FALTA_UM_DOS_QUATRO = "Faltou responder um dos quatro: nada foi gravado.";

type Rotulos = { previsao: string; passado: string; limiar: string; severidade: string };

/** O "CALIBRAR" (Task 8): os quatro valores de uma vez, VAZIOS no começo —
 *  ninguém calibrou este lugar ainda, e mostrar a regra padrão aqui seria
 *  convidar a copiá-la. Um POST só; no sucesso, a tela se relê do banco. */
export default function EditorCalibrar({ slug, rotulos }: { slug: string; rotulos: Rotulos }) {
  const baseId = useContext(VersaoDaTela);
  const [prev, setPrev] = useState("");
  const [pass, setPass] = useState("");
  const [limiar, setLimiar] = useState("");
  const [severidade, setSeveridade] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function calibrar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    // 🔴 Caixa vazia vira `Number("") === 0`: "vazio" chegaria à porta como
    // ZERO, e a coerência responderia sobre janela zerada — a frase certa pro
    // número errado. Vazio para aqui, sem chamar a rota.
    if ([prev, pass, limiar].some((v) => v.trim() === "") || severidade === "") {
      setErro(FALTA_UM_DOS_QUATRO);
      return;
    }
    setErro(null);
    setIndo(true);
    try {
      const regra = { janela_previsao_horas: Number(prev), janela_passado_horas: Number(pass), limiar_mm: Number(limiar), severidade };
      const r = await fetch("/api/admin/calibrar", { method: "POST", body: JSON.stringify(comBase({ slug, regra }, baseId)) });
      if (r.ok) { location.reload(); return; }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-campo adm-calibrar" onSubmit={calibrar} data-calibrar={slug}>
      <p className="adm-editor-ajuda">{CALIBRAR_AJUDA}</p>
      <label className="adm-rotulo">{rotulos.previsao}
        <input type="number" inputMode="decimal" step="any" value={prev} onChange={(e) => setPrev(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.passado}
        <input type="number" inputMode="decimal" step="any" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.limiar}
        <input type="number" inputMode="decimal" step="any" value={limiar} onChange={(e) => setLimiar(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.severidade}
        <select value={severidade} onChange={(e) => setSeveridade(e.target.value)}>
          <option value="" />
          {SEVERIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="submit" disabled={indo}>{indo ? SALVANDO : CALIBRAR}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
```

`src/app/admin/FichaInteira.tsx`, dentro do componente (importe `EditorCalibrar`):

```tsx
  // 🔴 SEM REGRA PRÓPRIA (07/10), a regra entra INTEIRA pelo "Calibrar": os
  // quatro editores de folha sairiam com 400 (meia regra não passa no schema).
  const semRegra = ficha.condicao.regra === undefined;
  const daRegra = (c: CampoDaFicha) => c.caminho.startsWith("condicao.regra.") || c.caminho === "condicao.severidade";
  const visiveis = semRegra ? campos.filter((c) => !daRegra(c)) : campos;
```

e o laço dos grupos passa a usar `visiveis` no lugar de `campos` (o `grupos` continua saindo de `campos`, pra o grupo da condição não sumir), com o editor no topo do grupo:

```tsx
          <h3>{TITULO_DO_GRUPO[g]}</h3>
          {g === "condicao" && semRegra && (
            <EditorCalibrar
              slug={ficha.slug}
              rotulos={{
                previsao: rotuloDe("condicao.regra.janela_previsao_horas"),
                passado: rotuloDe("condicao.regra.janela_passado_horas"),
                limiar: rotuloDe("condicao.regra.limiar_mm"),
                severidade: rotuloDe("condicao.severidade"),
              }}
            />
          )}
          {visiveis
            .filter((c) => c.grupo === g)
            …
```

- [ ] **Step 7: A ponta a ponta: calibrar tira a meia-linha**

Acrescente a `tests/app/carimbo-da-pessoa.test.tsx` (Task 3):

```ts
it("depois de calibrado, a ficha da pessoa volta a 'seco · carro comum' e a meia-linha sai", async () => {
  const { gravarEdicao, versaoAtual } = await import("@/lib/db");
  const { calibrarDoc } = await import("@/lib/calibrar");
  const atual = (await versaoAtual(banco, SLUG))!;
  await gravarEdicao(banco, SLUG, calibrarDoc(atual.doc, { janela_previsao_horas: 2, janela_passado_horas: 5, limiar_mm: 1, severidade: "espera" }), AGORA_S, atual.id);
  const { container } = await abrir(SLUG);
  expect(container.querySelector('[data-marca="regra-padrao"]')).toBeNull();
  expect(container.querySelector(".stamp .sub")?.textContent).toBe("seco · carro comum");
});
```

- [ ] **Step 8: O controle de completude do cerco do painel, e rodar**

🔴 **I1 da pré-auditoria** (o porquê está na Task 6, Step 7). `CALIBRAR`, `CALIBRAR_AJUDA` e `FALTA_UM_DOS_QUATRO` (`src/app/admin/campos/EditorCalibrar.tsx`) entram em `CUNHADAS_AQUI` de `tests/app/admin-editores-de-campo.test.tsx`. `JA_TEM_REGRA` mora em `src/lib/calibrar.ts` e fica fora do portão (ele lê só `src/app/admin/**`).

```ts
import { CALIBRAR, CALIBRAR_AJUDA, FALTA_UM_DOS_QUATRO } from "@/app/admin/campos/EditorCalibrar";
```

```ts
    // Task 8 (07/10): o "Calibrar" de um lugar sem regra própria. Só aparece na
    // ficha de lugar SEM regra — nenhuma das três fichas do acervo —, e a recusa
    // só depois de um toque.
    CALIBRAR,
    CALIBRAR_AJUDA,
    FALTA_UM_DOS_QUATRO,
```

Run: `npx vitest run tests/lib/calibrar.test.ts tests/lib/aplicar-campo.test.ts tests/api/route-admin-calibrar.test.ts tests/app/admin-calibrar.test.tsx tests/app/carimbo-da-pessoa.test.tsx tests/app/admin-ficha-inteira.test.tsx tests/api/route-admin-ficha.test.ts tests/app/admin-editores-de-campo.test.tsx`
Expected: PASS.

- [ ] **Step 9: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `calibrarDoc` sem o `throw new JaTemRegra()` | "lugar que JÁ tem regra é recusado" **e** a rota "lugar que já tem regra: 409" |
| M2 | a rota sem `violacaoIntroduzida` | "as duas janelas zeradas: 409 com a frase da coerência" |
| M3 | a rota grava com `gravarVersao(…, "painel", agora)` em vez de `gravarEdicao` | "a aba velha … 409" **e** "calibrar não muda a visibilidade" |
| M4 | `BLOCOS_QUE_NASCEM` vazio | "preencher uma folha do discriminador ausente" |
| M5 | `FichaInteira` sem o filtro `visiveis` | "mostra o Calibrar, e NÃO os editores de número da regra" (pelo seletor `data-testid="campo-…"`, que o caso da Rampa prova que acha) |
| M6 | `EditorCalibrar` começa com os valores da padrão | "os quatro campos começam VAZIOS" |
| M7 | tira a recusa da caixa vazia do editor | "com uma caixa vazia, não chama a rota" |

(Saiu da tabela — M5 da pré-auditoria — a mutação "`BLOCOS_QUE_NASCEM` com `"condicao"` também": ela é EQUIVALENTE. Com `criar` ligado, `condicao.regra.limiar_mm` faria nascer `{ limiar_mm }`, e o `regraSchema` recusa a regra sem `tipo` e sem as duas janelas — o mesmo `throw` de hoje. Nenhum caso pode matá-la, e a prova de que meia regra não nasce é o próprio schema, que o caso "uma folha da regra ausente continua recusada" exercita.)

- [ ] **Step 10: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 11: Commit e harness**

```bash
git add src/lib/calibrar.ts src/app/api/admin/calibrar/route.ts src/app/admin/campos/EditorCalibrar.tsx src/app/admin/FichaInteira.tsx src/lib/campos-da-ficha.ts tests/lib/calibrar.test.ts tests/lib/aplicar-campo.test.ts tests/api/route-admin-calibrar.test.ts tests/app/admin-calibrar.test.tsx tests/app/carimbo-da-pessoa.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(painel): calibrar a chuva de um lugar sem regra propria, e a checagem nasce folha a folha"
node scripts/mutar.mjs
```

📝 **Frases novas:** `JA_TEM_REGRA`, `CALIBRAR`, `CALIBRAR_AJUDA`, `FALTA_UM_DOS_QUATRO`.

---

### Task 9: 🛑 O Clerk entra (passo do João), e a ÚNICA porta do app pra ele

**Files:**
- Modify: `package.json`, `package-lock.json` (`@clerk/nextjs`)
- Create: `src/lib/contribuidor-sessao.ts` — o adaptador; NENHUM outro arquivo de `src/` importa `@clerk/*`
- Create: `src/middleware.ts` — `clerkMiddleware` SÓ em `/contribuir` e `/api/contribuir`
- Test: `tests/lib/contribuidor-sessao.test.ts`, `tests/deploy/middleware.test.ts`, `tests/lib/clerk-so-numa-porta.test.ts` (criar)

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces (`src/lib/contribuidor-sessao.ts`):
  - `export type QuemContribui = { id: string; nome: string | null; email: string | null }`
  - `export class ClerkFora extends Error {}`
  - `export async function lerContribuidor(): Promise<QuemContribui | null>` — `null` = sem sessão; estoura `ClerkFora` quando o Clerk não responde ou não está configurado
  - `export async function irPraEntrar(): Promise<never>` — manda pra tela de entrar do Clerk e volta pro mesmo endereço

🔴 **POR QUE UM ADAPTADOR SÓ.** (1) Teste sem chave: toda rota e página da pessoa importa `lerContribuidor` deste arquivo, e os testes o dublam com `vi.mock("@/lib/contribuidor-sessao", …)` — o Clerk nunca é carregado na suíte. (2) "Clerk fora do ar: só a contribuição para" (spec, "Erros e bordas"): o middleware só roda nas rotas da pessoa, e nenhuma tela pública nem do painel importa o Clerk — um guarda de FONTE (Step 1) trava isso. (3) Trocar de provedor um dia é um arquivo.

🔴 **Sem `<ClerkProvider>`.** Nenhuma tela desta rodada usa componente ou hook do Clerk no cliente: a entrada é a tela hospedada do Clerk (`redirectToSignIn`), e a sessão é lida no servidor. Sem o provider, o JavaScript do Clerk não vai pro celular de quem só abre o app — e o app público continua sem depender dele.

- [ ] **Step 1: 🛑 PARADA — o passo é do João, e o plano NÃO segue sem ele**

O controlador para aqui e pede ao João, por extenso:

1. `vercel integration add clerk` — abre o navegador; ele aceita os termos NA CONTA DELE e liga a integração ao projeto `bateperna`. (É o Marketplace do Vercel: as chaves `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` entram sozinhas nas variáveis do projeto.)
2. No painel do Clerk que a integração abre: ligar **"Google"** como forma de entrar (decisão dele de 07/10: *"Só com login simples"*).
3. `vercel env pull .env.development.local` — traz as chaves pro `npm run dev` local. **NÃO `.env.local`**: esse arquivo guarda o Turso da semente, e o `env pull` o sobrescreveria. (O `npm run build` não lê `.env.development.local`, e é de propósito: o build tem de passar SEM chave.)

O implementador NÃO roda nenhum dos três, NÃO cria conta, NÃO inventa chave. Quando o João disser que fez, siga. Os passos abaixo não dependem das chaves — os testes dublam o Clerk —, mas a ORDEM do plano é esta, pra a instalação do pacote e as chaves andarem juntas.

- [ ] **Step 2: Instalar o pacote e conferir a API**

Run: `npm install @clerk/nextjs`
Run: `node -p "require('@clerk/nextjs/package.json').version"`
Expected: uma versão da linha Core 3. Confira no `node_modules/@clerk/nextjs` (o `README` e os `.d.ts` de `server`) que `@clerk/nextjs/server` exporta `clerkMiddleware`, `auth` (assíncrona: `await auth()` devolve `{ userId, redirectToSignIn }`) e `currentUser`. Se a API instalada for outra, PARE e relate a versão e o que mudou — não adapte às cegas.

- [ ] **Step 3: Escrever os testes que falham**

`tests/lib/contribuidor-sessao.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => clerk);

const { ClerkFora, lerContribuidor } = await import("@/lib/contribuidor-sessao");

beforeEach(() => { clerk.auth.mockReset(); clerk.currentUser.mockReset(); });

describe("lerContribuidor", () => {
  it("sem sessão: null, e não pergunta quem é", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect(await lerContribuidor()).toBeNull();
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it("com sessão: o id, o nome e o e-mail principal", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ firstName: "Maria", lastName: "Teste", primaryEmailAddress: { emailAddress: "m@teste.invalid" } });
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: "Maria Teste", email: "m@teste.invalid" });
  });

  // O nome e o e-mail são só pro painel dele: sem eles, a pessoa ainda contribui.
  it("o perfil não vem: o id basta, nome e e-mail ficam null — nada inventado", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockRejectedValue(new Error("rede"));
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: null, email: null });
  });

  it("perfil sem nome: null, nunca string vazia", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ firstName: null, lastName: null, primaryEmailAddress: null });
    expect(await lerContribuidor()).toEqual({ id: "user_1", nome: null, email: null });
  });

  it("o Clerk não responde (ou sem middleware/chave): estoura ClerkFora", async () => {
    clerk.auth.mockRejectedValue(new Error("clerkMiddleware não rodou"));
    await expect(lerContribuidor()).rejects.toBeInstanceOf(ClerkFora);
  });
});
```

`tests/deploy/middleware.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => () => undefined }));
const { config } = await import("@/middleware");

describe("o Clerk só roda nas rotas de quem contribui", () => {
  it.each(["/contribuir", "/contribuir/novo", "/contribuir/pedra-mandada-cidade", "/api/contribuir/rascunho"])(
    "passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true),
  );

  // 🔴 "Clerk fora do ar: só a contribuição para" — o app público e o painel
  // do João não passam por ele.
  it.each(["/", "/trilhas", "/rampa-do-pepe", "/admin", "/admin/chuva", "/api/admin/ficha", "/api/carimbo", "/api/confirmar", "/contribuirx", "/sw.js"])(
    "NÃO passa pelo Clerk: %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false),
  );
});
```

(Se `next/experimental/testing/server` não existir nesta versão do Next, troque os dois `it.each` por `expect(config.matcher).toEqual(["/contribuir", "/contribuir/:path*", "/api/contribuir/:path*"])` e relate a troca — é uma prova mais fraca: trava a lista, não o casamento.)

`tests/lib/clerk-so-numa-porta.test.ts` — o guarda de FONTE, comparado contra o enumerador (todo arquivo de `src/`), com controle de não-vacuidade:

```ts
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const todos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? todos(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

/** As duas portas do Clerk: o adaptador e o middleware. */
const PORTAS = new Set([path.join(SRC, "lib", "contribuidor-sessao.ts"), path.join(SRC, "middleware.ts")]);

describe("o Clerk entra por uma porta só", () => {
  it("o enumerador leu src/ inteiro (não-vacuidade)", () => {
    const lidos = todos(SRC);
    expect(lidos.length).toBeGreaterThan(100);
    for (const p of PORTAS) expect(lidos).toContain(p);
  });

  it("nenhum outro arquivo de src/ importa @clerk", () => {
    const fora = todos(SRC).filter((f) => !PORTAS.has(f) && /from\s+["']@clerk\//.test(readFileSync(f, "utf8")));
    expect(fora.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });

  it("e as duas portas importam mesmo (o guarda não está cego)", () => {
    for (const p of PORTAS) expect(readFileSync(p, "utf8")).toMatch(/from\s+["']@clerk\/nextjs\/server["']/);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/contribuidor-sessao.test.ts tests/deploy/middleware.test.ts tests/lib/clerk-so-numa-porta.test.ts`
Expected: FAIL — os arquivos não existem.

- [ ] **Step 5: O adaptador**

`src/lib/contribuidor-sessao.ts`:

```ts
import { auth, currentUser } from "@clerk/nextjs/server";

/** 🔴 A ÚNICA PORTA DO APP PRO CLERK (spec de 07/10, "Login"). O Clerk cuida SÓ
 *  de quem contribui; o painel do João continua com a senha dele, e as telas
 *  públicas não têm login. Nenhum outro arquivo de `src/` importa `@clerk/*` —
 *  `tests/lib/clerk-so-numa-porta.test.ts` trava isso —, e os testes dublam
 *  ESTE módulo: nenhuma chave real roda na suíte. */

export type QuemContribui = { id: string; nome: string | null; email: string | null };

/** O Clerk não respondeu, ou não está configurado (sem chave, sem o
 *  middleware). A rota responde 503 com frase; nada do app público depende
 *  disto. */
export class ClerkFora extends Error {}

/** Quem está logado AGORA, ou `null`. O perfil (nome, e-mail) é só pro painel
 *  do João: se não vier, a pessoa contribui do mesmo jeito, e nada é
 *  inventado no lugar. */
export async function lerContribuidor(): Promise<QuemContribui | null> {
  let userId: string | null;
  try {
    ({ userId } = await auth());
  } catch (erro) {
    throw new ClerkFora(String(erro));
  }
  if (!userId) return null;
  let perfil: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    perfil = await currentUser();
  } catch {
    perfil = null;
  }
  const nome = [perfil?.firstName, perfil?.lastName].filter((p) => typeof p === "string" && p.trim() !== "").join(" ");
  return { id: userId, nome: nome === "" ? null : nome, email: perfil?.primaryEmailAddress?.emailAddress ?? null };
}

/** Manda pra tela de entrar do Clerk; depois de entrar, ela volta pro mesmo
 *  endereço — o `?p=N` da pergunta inclusive (Review Focus 4). */
export async function irPraEntrar(): Promise<never> {
  const { redirectToSignIn } = await auth();
  return redirectToSignIn();
}
```

- [ ] **Step 6: O middleware**

`src/middleware.ts`:

```ts
import { clerkMiddleware } from "@clerk/nextjs/server";

/** O CLERK SÓ NAS ROTAS DE QUEM CONTRIBUI (spec de 07/10). Ele não PROTEGE
 *  nada aqui — quem decide 401 é cada rota, por `lerContribuidor` —, só deixa
 *  a sessão legível. Fora deste `matcher`, o Clerk nem é chamado: com ele fora
 *  do ar, o app público e o painel do João seguem de pé. */
export default clerkMiddleware();

export const config = {
  matcher: ["/contribuir", "/contribuir/:path*", "/api/contribuir/:path*"],
};
```

- [ ] **Step 7: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/contribuidor-sessao.test.ts tests/deploy/middleware.test.ts tests/lib/clerk-so-numa-porta.test.ts tests/deploy/exports-de-rota.test.ts`
Expected: PASS. (O último é o guarda de exports de rota que já existe; confira que ele não reclama do `middleware.ts` — se reclamar, ele enumera `src/app` e não deveria ver o middleware; relate.)

- [ ] **Step 8: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `matcher` ganha `"/((?!_next).*)"` (o padrão da documentação, que pega TUDO) | "NÃO passa pelo Clerk: /" e os vizinhos |
| M2 | `lerContribuidor` sem o `try` do `auth()` | "o Clerk não responde … estoura ClerkFora" |
| M3 | `lerContribuidor` devolve `nome: ""` sem perfil | "perfil sem nome: null" |
| M4 | `import { auth } from "@clerk/nextjs/server"` em `src/app/page.tsx` | "nenhum outro arquivo de src/ importa @clerk" |

(Saiu da tabela — M5 da pré-auditoria — a mutação "o `matcher` perde `"/contribuir"`": no `path-to-regexp` do Next, `"/contribuir/:path*"` já casa `/contribuir` (o `*` aceita zero segmentos), então ela é EQUIVALENTE e nenhum caso a mata. A entrada `"/contribuir"` fica no `matcher` pela leitura — quem abre o arquivo vê a raiz da tela sem precisar saber do `*` —, e é declaradamente redundante.)

- [ ] **Step 9: Os portões — o build SEM chave**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: verde. O `next build` não lê `.env.development.local`, então isto prova que o build não depende da chave. Se ele exigir a chave (`Missing publishableKey`), PARE e relate.

- [ ] **Step 10: Commit e harness**

```bash
git add package.json package-lock.json src/lib/contribuidor-sessao.ts src/middleware.ts tests/lib/contribuidor-sessao.test.ts tests/deploy/middleware.test.ts tests/lib/clerk-so-numa-porta.test.ts
git commit -m "feat(clerk): o adaptador de sessao e o middleware, so nas rotas de quem contribui"
node scripts/mutar.mjs
```

---

### Task 10: `/api/contribuir/rascunho` — começar, responder, desistir; só o que é dela

**Files:**
- Create: `src/lib/campos-da-pessoa.ts` (a lista dela, e as gravações que só ela tem)
- Create: `src/lib/porta-da-pessoa.ts` (a porta de sessão das rotas dela, e as frases; a Task 11 acrescenta a de publicar)
- Modify: `src/lib/db-contribuidor.ts` — `registrarContribuidor`, `estaBloqueado` e as cinco funções de rascunho DELA
- Create: `src/app/api/contribuir/rascunho/route.ts` (`POST`, `PUT`, `GET`, `DELETE`)
- Test: `tests/lib/campos-da-pessoa.test.ts`, `tests/lib/db-rascunho-da-pessoa.test.ts`, `tests/api/route-contribuir-rascunho.test.ts` (criar); `tests/sessao-da-pessoa.ts` (helper de teste: o dublê do Clerk)

**Interfaces:**
- Consumes: `lerContribuidor`, `QuemContribui` (Task 9); `clienteQueIntercala` de `tests/banco.ts`; `aplicarNoRascunho`, `gravarPontoNoRascunho`, `lerCaminho` de `@/lib/campos-da-ficha`; `colisaoDoPar`, `colisaoDaMudanca`, `CAMPO_DO_NOME`, `CAMPO_DA_CIDADE` de `@/lib/par-de-lugar` (Task 1 — a colisão ESTRUTURADA; NUNCA `parOcupado`/`parDaMudanca`, que devolvem a frase do painel: I3); `slugDoNome`, `docDoLugarNovo`, `docNoEndereco`, `nomeDoRascunho`, `cidadeDoDoc`, `NOME_VAZIO`, `CIDADE_VAZIA`, `NOME_SEM_LETRA`, `CIDADE_SEM_LETRA` de `@/lib/rascunho`; `Rascunho`, `rascunhoDeQualquerUm` (Task 1; nos testes, pra olhar o banco sem o filtro do painel) de `@/lib/db`.
- Produces:
  - `src/lib/campos-da-pessoa.ts`:
    - `export const CAMPOS_DA_PESSOA: readonly string[]` — `trajeto.waypoints.0.nome`, `cidade`, `promessa`, `acesso`, `avisos`, `custo.tag`, `custo.valor`, `horario`, `dias`
    - `export const OPCIONAIS_DA_PESSOA: ReadonlySet<string>` — `avisos`, `custo.valor`, `horario`, `dias`
    - `export const PONTO = "ponto"` — o nome da pergunta do mapa na lista de obrigatórios
    - `export function ehCampoDaPessoa(c: unknown): c is string`
    - `export function pontoNoRascunhoDaPessoa(doc: string, lat: number, lng: number): string` — o ponto 0 E a `condicao.coords`, juntos
    - `export function tirarDoRascunhoDaPessoa(doc: string, caminho: string): string` — o "não sei" DELA (recusa obrigatório da lista dela, não do registro)
    - `export function obrigatoriosDaPessoaFaltando(doc: unknown): string[]`
    - `export function chavesForaDaPessoa(doc: unknown): string[]`
  - `src/lib/porta-da-pessoa.ts`: `export async function portaDaPessoa(agora: number): Promise<{ pessoa: QuemContribui } | { resposta: Response }>`; frases `CLERK_FORA`, `BLOQUEADA`, `RASCUNHO_DELA_SUMIU`, `NOME_JA_EM_USO` (o 409 de TODA colisão dela — I3)
  - `src/lib/db-contribuidor.ts`: `registrarContribuidor(client, p: QuemContribui, agora): Promise<void>`, `estaBloqueado(client, id): Promise<boolean>`, `criarRascunhoDaPessoa(client, slug, doc, agora, id): Promise<boolean>`, `lerRascunhoDaPessoa(client, slug, id): Promise<Rascunho | null>`, `rascunhosDaPessoa(client, id): Promise<Rascunho[]>`, `regravarRascunhoDaPessoa(client, slug, doc, agora, id): Promise<boolean>`, `moverRascunhoDaPessoa(client, de, para, doc, agora, id): Promise<boolean>`, `apagarRascunhoDaPessoa(client, slug, id): Promise<boolean>` — `criar` e `mover` recusam endereço antigo de outro lugar (ruling da pré-auditoria)
  - `tests/sessao-da-pessoa.ts`: `export const sessao: { atual: QuemContribui | null; fora: boolean }` — 🔴 o MESMO objeto em toda instância do módulo, guardado em `globalThis.__sessaoDaPessoa` (C2) — e `export const PESSOA: QuemContribui` / `OUTRA: QuemContribui`, `export const moduloFalso`

🔴 **A LISTA DELA, E POR QUE ELA É FECHADA NA PORTA** (Review Focus 1). A tela dela pergunta oito coisas; a API não pode aceitar uma nona. `voz`, `premio`, `condicao.regra.*`, `condicao.severidade`, `discriminador.*`, `custo.curto`, `piso`, `secaRapido`, `carroComum`, etapas do trajeto: tudo **400, nada gravado**. Se ela pudesse escrever `condicao.regra`, calibraria o próprio lugar e a meia-linha sumiria; se pudesse escrever `voz`, o app falaria com a voz dele na boca de qualquer um.

🔴 **O PONTO É UM SÓ** (spec, Parte 1, pergunta 3): "é a coordenada da chuva E o ponto 1 do trajeto". O corpo `{ slug, ponto: 0, lat, lng }` grava os dois juntos; `ponto` diferente de 0 é 400 (trajeto multiponto está fora de escopo).

- [ ] **Step 1: Escrever os testes que falham**

`tests/sessao-da-pessoa.ts` (helper; não é teste):

```ts
import type { QuemContribui } from "@/lib/contribuidor-sessao";

/** O DUBLÊ DO CLERK de todas as rotas e telas da pessoa. Quem o usa faz, no
 *  topo do arquivo:
 *
 *    vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
 *
 *  e muda `sessao.atual` / `sessao.fora` em cada caso. Nenhuma chave real.
 *
 *  🔴 O ESTADO MORA EM `globalThis`, NÃO NUM `const` DESTE MÓDULO (C2 da
 *  pré-auditoria de 07/10, MEDIDO com o vitest 2.1.9 do repo). Os testes de
 *  rota fazem `vi.resetModules()` no `beforeEach` e reimportam a rota; a
 *  fábrica do `vi.mock` roda de novo e reimporta ESTE arquivo. Com o estado
 *  num `const` aqui, nascia um `sessao` novo: a rota lia o novo e o teste
 *  mudava o velho — medido num experimento com este mesmo molde, "sem sessão"
 *  esperava 401 e recebeu 200, "Clerk fora" esperava 503 e recebeu 200. Com o
 *  `??=` em `globalThis`, toda instância deste módulo devolve o MESMO objeto, e
 *  as duas sondas passaram. A SONDA de `tests/api/route-contribuir-rascunho.test.ts`
 *  trava isto: volte a um `const` local e ela fica vermelha. */
export const PESSOA: QuemContribui = { id: "user_pessoa_de_teste", nome: "Maria Teste", email: "maria@teste.invalid" };
export const OUTRA: QuemContribui = { id: "user_outra_pessoa", nome: "Outra Pessoa", email: null };

type Sessao = { atual: QuemContribui | null; fora: boolean };
const g = globalThis as typeof globalThis & { __sessaoDaPessoa?: Sessao };
export const sessao: Sessao = (g.__sessaoDaPessoa ??= { atual: PESSOA, fora: false });

class ClerkFora extends Error {}
export const moduloFalso = {
  ClerkFora,
  lerContribuidor: async (): Promise<QuemContribui | null> => {
    if (sessao.fora) throw new ClerkFora("dublê: o Clerk caiu");
    return sessao.atual;
  },
  irPraEntrar: async (): Promise<never> => {
    throw new Error("NEXT_REDIRECT_PRA_ENTRAR");
  },
};
```

(O `PESSOA.id` é o mesmo `PESSOA_DE_TESTE` de `tests/banco.ts` — confira que batem.)

`tests/lib/campos-da-pessoa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA, PONTO, chavesForaDaPessoa, ehCampoDaPessoa, obrigatoriosDaPessoaFaltando,
  pontoNoRascunhoDaPessoa, tirarDoRascunhoDaPessoa,
} from "@/lib/campos-da-pessoa";
import { campoPorCaminho } from "@/lib/campos-da-ficha";

const NOVO = JSON.stringify({ slug: "pedra-cidade", modos: [], cidade: "Cidade", trajeto: { waypoints: [{ nome: "Pedra" }] } });
const COMPLETO = {
  slug: "pedra-cidade", modos: [], cidade: "Cidade", promessa: "p", acesso: "a",
  trajeto: { waypoints: [{ nome: "Pedra", lat: -8.3, lng: -35.9 }] }, condicao: { coords: { lat: -8.3, lng: -35.9 } },
  custo: { tag: "gratis" },
};

describe("a lista dela", () => {
  it("são exatamente os campos das oito perguntas da spec (o ponto mora à parte)", () => {
    expect([...CAMPOS_DA_PESSOA].sort()).toEqual(
      ["acesso", "avisos", "cidade", "custo.tag", "custo.valor", "dias", "horario", "promessa", "trajeto.waypoints.0.nome"],
    );
  });

  it("todo campo dela existe no registro (o mesmo instrumento do painel)", () => {
    for (const c of CAMPOS_DA_PESSOA) expect(campoPorCaminho(c), c).toBeDefined();
  });

  it("os opcionais dela são subconjunto da lista", () => {
    for (const c of OPCIONAIS_DA_PESSOA) expect(CAMPOS_DA_PESSOA).toContain(c);
  });

  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "condicao.coords",
    "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum", "trajeto.waypoints.1.nome", "slug", 42])(
    "`%s` não é campo dela",
    (c) => expect(ehCampoDaPessoa(c)).toBe(false),
  );
});

describe("o ponto é um só", () => {
  it("grava o ponto 0 E a coordenada da chuva, iguais", () => {
    const d = JSON.parse(pontoNoRascunhoDaPessoa(NOVO, -8.31, -35.97));
    expect(d.trajeto.waypoints[0]).toEqual({ nome: "Pedra", lat: -8.31, lng: -35.97 });
    expect(d.condicao.coords).toEqual({ lat: -8.31, lng: -35.97 });
  });

  it("coordenada fora do planeta é recusada", () => {
    expect(() => pontoNoRascunhoDaPessoa(NOVO, 200, 0)).toThrow();
  });
});

describe("o 'não sei' dela", () => {
  it("tira `avisos` (opcional PRA ELA, ainda que obrigatório no registro do João)", () => {
    const d = JSON.parse(tirarDoRascunhoDaPessoa(JSON.stringify({ ...COMPLETO, avisos: "x" }), "avisos"));
    expect("avisos" in d).toBe(false);
  });

  it("recusa obrigatório dela, e campo fora da lista", () => {
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "promessa")).toThrow();
    expect(() => tirarDoRascunhoDaPessoa(JSON.stringify(COMPLETO), "voz")).toThrow();
  });
});

describe("o que falta, e o que sobra", () => {
  it("o documento completo dela não falta nada", () => {
    expect(obrigatoriosDaPessoaFaltando(COMPLETO)).toEqual([]);
  });

  it("falta cada obrigatório, e o ponto conta como um", () => {
    expect(obrigatoriosDaPessoaFaltando(JSON.parse(NOVO)).sort()).toEqual(["acesso", "custo.tag", PONTO, "promessa"].sort());
  });

  it("ponto sem a coordenada da chuva (ou vice-versa) ainda falta", () => {
    expect(obrigatoriosDaPessoaFaltando({ ...COMPLETO, condicao: {} })).toContain(PONTO);
  });

  it("documento só com o que é dela: nada sobra", () => {
    expect(chavesForaDaPessoa({ ...COMPLETO, avisos: "a", custo: { tag: "pago", valor: "R$ 5" }, horario: [], dias: ["sab"] })).toEqual([]);
  });

  it.each([
    ["voz", { voz: "x" }],
    ["condicao.regra", { condicao: { coords: COMPLETO.condicao.coords, regra: {} } }],
    ["discriminador", { discriminador: {} }],
    ["custo.curto", { custo: { tag: "pago", curto: "R$ 5" } }],
    ["trajeto.waypoints.1", { trajeto: { waypoints: [...COMPLETO.trajeto.waypoints, { nome: "etapa", lat: 0, lng: 0 }] } }],
    ["trajeto.waypoints.0.nota", { trajeto: { waypoints: [{ ...COMPLETO.trajeto.waypoints[0], nota: "n" }] } }],
  ])("`%s` sobra", (caminho, mais) => {
    expect(chavesForaDaPessoa({ ...COMPLETO, ...mais })).toContain(caminho);
  });
});
```

`tests/lib/db-rascunho-da-pessoa.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarRascunho, listarRascunhos, rascunhoDeQualquerUm } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, estaBloqueado, lerRascunhoDaPessoa, moverRascunhoDaPessoa,
  rascunhosDaPessoa, regravarRascunhoDaPessoa, registrarContribuidor, contribuidorPorId,
} from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
beforeEach(async () => { c = createClient({ url: ":memory:" }); await semearAcervo(c); });
afterEach(() => c.close());
const A = AGORA_SEMENTE;
const doc = (slug: string) => JSON.stringify({ slug });

describe("registrarContribuidor", () => {
  it("nasce desbloqueado, e o perfil novo atualiza nome e e-mail", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await registrarContribuidor(c, { ...PESSOA, nome: "Maria Nova" }, A + 1);
    expect(await contribuidorPorId(c, PESSOA.id)).toEqual({ id: PESSOA.id, nome: "Maria Nova", email: PESSOA.email, bloqueado: false });
  });

  it("perfil que não veio (null) não apaga o que já havia", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await registrarContribuidor(c, { id: PESSOA.id, nome: null, email: null }, A + 1);
    expect(await contribuidorPorId(c, PESSOA.id)).toMatchObject({ nome: PESSOA.nome, email: PESSOA.email });
  });

  // 🔴 Registrar de novo NUNCA desbloqueia: só o João desbloqueia (Task 15).
  it("registrar de novo não desbloqueia", async () => {
    await registrarContribuidor(c, PESSOA, A);
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    await registrarContribuidor(c, PESSOA, A + 1);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
  });
});

describe("o rascunho dela é dela", () => {
  it("nasce com o contribuidor, e não entra na lista do painel", async () => {
    expect(await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id)).toBe(true);
    expect((await lerRascunhoDaPessoa(c, "pedra-cidade", PESSOA.id))?.slug).toBe("pedra-cidade");
    expect(await listarRascunhos(c)).toEqual([]);
  });

  it("OUTRA pessoa não lê, não regrava, não move, não apaga", async () => {
    await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id);
    expect(await lerRascunhoDaPessoa(c, "pedra-cidade", OUTRA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, "pedra-cidade", '{"x":1}', A + 1, OUTRA.id)).toBe(false);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "outro-cidade", doc("outro-cidade"), A + 1, OUTRA.id)).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, "pedra-cidade", OUTRA.id)).toBe(false);
    expect((await rascunhoDeQualquerUm(c, "pedra-cidade"))?.doc).toBe(doc("pedra-cidade"));
  });

  it("ela não alcança rascunho do João", async () => {
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await lerRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBeNull();
    expect(await regravarRascunhoDaPessoa(c, "do-joao-cidade", '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await apagarRascunhoDaPessoa(c, "do-joao-cidade", PESSOA.id)).toBe(false);
  });

  it("não nasce em endereço de lugar (escondido inclusive) nem de outro rascunho", async () => {
    expect(await criarRascunhoDaPessoa(c, "rampa-do-pepe", doc("rampa-do-pepe"), A, PESSOA.id)).toBe(false);
    await criarRascunho(c, "do-joao-cidade", doc("do-joao-cidade"), A);
    expect(await criarRascunhoDaPessoa(c, "do-joao-cidade", doc("do-joao-cidade"), A, PESSOA.id)).toBe(false);
  });

  // 🔴 Ruling de produto da pré-auditoria (07/10): endereço antigo de outro
  // lugar não é dela — o link velho continua levando ao lugar de onde veio.
  it("não nasce, nem se muda, pra um endereço antigo de outro lugar", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES ('velho-cidade', 'rampa-do-pepe', ?)", args: [A] });
    expect(await criarRascunhoDaPessoa(c, "velho-cidade", doc("velho-cidade"), A, PESSOA.id)).toBe(false);
    expect(await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id)).toBe(true);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "velho-cidade", doc("velho-cidade"), A + 1, PESSOA.id)).toBe(false);
    expect(await rascunhoDeQualquerUm(c, "velho-cidade")).toBeNull();
    expect((await rascunhoDeQualquerUm(c, "pedra-cidade"))?.contribuidor).toBe(PESSOA.id);
  });

  it("bloqueada: não cria, não regrava, não move", async () => {
    await criarRascunhoDaPessoa(c, "pedra-cidade", doc("pedra-cidade"), A, PESSOA.id);
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await criarRascunhoDaPessoa(c, "outra-cidade", doc("outra-cidade"), A, PESSOA.id)).toBe(false);
    expect(await regravarRascunhoDaPessoa(c, "pedra-cidade", '{"x":1}', A + 1, PESSOA.id)).toBe(false);
    expect(await moverRascunhoDaPessoa(c, "pedra-cidade", "nova-cidade", doc("nova-cidade"), A + 1, PESSOA.id)).toBe(false);
  });

  it("a lista dela tem só os dela, o mexido por último primeiro", async () => {
    await criarRascunhoDaPessoa(c, "um-cidade", doc("um-cidade"), A, PESSOA.id);
    await criarRascunhoDaPessoa(c, "dois-cidade", doc("dois-cidade"), A + 5, PESSOA.id);
    await criarRascunhoDaPessoa(c, "da-outra-cidade", doc("da-outra-cidade"), A + 9, OUTRA.id);
    expect((await rascunhosDaPessoa(c, PESSOA.id)).map((r) => r.slug)).toEqual(["dois-cidade", "um-cidade"]);
  });
});
```

`tests/api/route-contribuir-rascunho.test.ts` (molde das rotas do painel; o Clerk pelo dublê):

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rascunhoDeQualquerUm } from "@/lib/db";
import { contribuidorPorId, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { BLOQUEADA, CLERK_FORA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU } from "@/lib/porta-da-pessoa";
import { clienteQueIntercala, semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
let c: Client;
/** O cliente que a ROTA vê — `c`, ou um que intercala (o caso da corrida). */
let cli: Client;
let rota: typeof import("@/app/api/contribuir/rascunho/route");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  rota = await import("@/app/api/contribuir/rascunho/route");
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const pedido = (metodo: string, corpo?: unknown, busca = "") =>
  new Request(`http://x/api/contribuir/rascunho${busca}`, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
const SLUG = "pedra-mandada-cidade-teste";
const docDe = async (slug = SLUG) => JSON.parse((await rascunhoDeQualquerUm(c, slug))!.doc);
async function comecar(): Promise<void> {
  const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
  expect(res.status, await res.clone().text()).toBe(201);
}

describe("a porta: sessão, Clerk, bloqueio", () => {
  // 🔴 A SONDA DO DUBLÊ (C2 da pré-auditoria, MEDIDO em 07/10). Roda ANTES dos
  // outros casos da porta: se a rota não enxerga a sessão que o teste muda,
  // todo 401/503/404 abaixo mede o dublê, não a rota. Com o estado do dublê
  // num `const` de módulo, o `vi.resetModules()` do `beforeEach` dava à rota
  // OUTRA instância de `sessao` — e esta sonda fica vermelha (medido: 200 onde
  // se esperava 401). Ela muda a sessão nos TRÊS sentidos e exige que a rota
  // veja cada um.
  it("SONDA: a rota vê a sessão que o teste muda, nos três sentidos", async () => {
    sessao.atual = null;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.atual = null").toBe(401);
    sessao.atual = PESSOA;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.atual = PESSOA").toBe(200);
    sessao.fora = true;
    expect((await rota.GET(pedido("GET"))).status, "a rota não viu sessao.fora = true").toBe(503);
  });

  it("sem sessão: 401, e nada nasce", async () => {
    sessao.atual = null;
    expect((await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }))).status).toBe(401);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("Clerk fora: 503 com a frase, e nada nasce", async () => {
    sessao.fora = true;
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe(CLERK_FORA);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("bloqueada: 403 com a frase, e nada nasce", async () => {
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, AGORA] });
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("toda porta aberta registra quem contribui, com nome e e-mail (só pro painel)", async () => {
    await comecar();
    expect(await contribuidorPorId(c, PESSOA.id)).toMatchObject({ nome: PESSOA.nome, email: PESSOA.email });
  });
});

describe("POST — começar", () => {
  it("201, o slug do nome e da cidade, e o rascunho nasce DELA e sem nada a mais", async () => {
    await comecar();
    expect(await docDe()).toEqual({ slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    const linha = await c.execute({ sql: "SELECT contribuidor FROM ficha_rascunhos WHERE slug = ?", args: [SLUG] });
    expect(linha.rows[0].contribuidor).toBe(PESSOA.id);
  });

  // Review Focus 3: o par de um lugar do João. As fichas dele nasceram sem
  // cidade, então nome igual É colisão (o gêmeo sem cidade).
  // 🔴 I3 da pré-auditoria: a frase é a DELA — nunca "responda primeiro a cidade
  // dele, pela lista do painel" (ela não tem painel) —, e não nomeia ninguém.
  it("o par de um lugar do João: 409 com a frase DELA, e nada nasce", async () => {
    const res = await rota.POST(pedido("POST", { nome: "Rampa do Pepê", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    const frase = await res.text();
    expect(frase).toBe(NOME_JA_EM_USO);
    expect(frase).not.toMatch(/painel/i);
    expect((await c.execute("SELECT COUNT(*) AS n FROM ficha_rascunhos")).rows[0].n).toBe(0);
  });

  // I3: o rascunho de OUTRA pessoa não é revelado — nem o nome, nem a cidade.
  it("o par de um rascunho de OUTRA pessoa: 409 com a frase dela, sem o nome dele, e ele fica", async () => {
    const doc = JSON.stringify({ slug: SLUG, modos: [], cidade: "Cidade Teste", trajeto: { waypoints: [{ nome: "Pedra Mandada" }] } });
    await criarRascunhoDaPessoa(c, SLUG, doc, AGORA, OUTRA.id);
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toMatchObject({ doc, contribuidor: OUTRA.id });
  });

  // I3: o ENDEREÇO ocupado (nome diferente, mesmo endereço — a fronteira entre
  // o nome e a cidade que anda) também responde a frase dela, nunca a do painel
  // (`enderecoDeRascunho` mandaria "continuar por ele na lista do painel").
  it("o endereço de um rascunho de OUTRA pessoa, de nome diferente: 409 com a frase dela", async () => {
    const outro = "lugar-marcador-cidade-marcador";
    await criarRascunhoDaPessoa(c, outro, JSON.stringify({ slug: outro, modos: [], cidade: "Cidade Marcador", trajeto: { waypoints: [{ nome: "Lugar Marcador" }] } }), AGORA, OUTRA.id);
    const res = await rota.POST(pedido("POST", { nome: "Lugar Marcador Cidade", cidade: "Marcador" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect((await rascunhoDeQualquerUm(c, outro))?.contribuidor).toBe(OUTRA.id);
  });

  // Ruling de produto da pré-auditoria: endereço antigo de outro lugar não é dela.
  it("um endereço antigo de um lugar do João: 409 com a frase dela, nada nasce, e o link velho continua", async () => {
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const res = await rota.POST(pedido("POST", { nome: "Pedra Mandada", cidade: "Cidade Teste" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it.each([[{ nome: "", cidade: "C" }], [{ nome: "N", cidade: " " }], [{ nome: "N" }], [{ nome: "N", cidade: "C", voz: "x" }]])(
    "corpo %j: 400",
    async (corpo) => expect((await rota.POST(pedido("POST", corpo))).status).toBe(400),
  );
});

describe("PUT — responder", () => {
  beforeEach(comecar);

  it("um campo dela grava", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }))).status).toBe(200);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  // Review Focus 1.
  it.each(["voz", "premio", "rotulo_escaneio", "condicao.regra.limiar_mm", "condicao.severidade", "discriminador.como_ler", "custo.curto", "piso", "secaRapido", "carroComum"])(
    "campo fora da lista dela (`%s`): 400, e o rascunho não muda",
    async (campo) => {
      const antes = await docDe();
      const valor = campo === "condicao.regra.limiar_mm" ? 1 : campo === "carroComum" ? true : campo === "condicao.severidade" ? "cuidado" : campo === "piso" ? "barro" : "texto";
      expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo, valor }))).status).toBe(400);
      expect(await docDe()).toEqual(antes);
    },
  );

  it("o ponto grava o ponto 0 E a coordenada da chuva", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, ponto: 0, lat: -8.31, lng: -35.97 }))).status).toBe(200);
    const d = await docDe();
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.31, lng: -35.97 });
    expect(d.condicao.coords).toEqual({ lat: -8.31, lng: -35.97 });
  });

  it("ponto que não é o 0: 400 (trajeto de mais de um ponto está fora)", async () => {
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, ponto: 1, lat: -8.31, lng: -35.97 }))).status).toBe(400);
  });

  it("'não sei' em opcional dela tira a chave; em obrigatório dela, 400", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "avisos", valor: "Leve água." }));
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "avisos", naoSei: true }))).status).toBe(200);
    expect("avisos" in (await docDe())).toBe(false);
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", naoSei: true }))).status).toBe(400);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });

  it("trocar o nome muda o endereço do rascunho, e a resposta diz o novo", async () => {
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Pedra Nova" }));
    expect(await res.json()).toEqual({ slug: "pedra-nova-cidade-teste" });
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
    expect((await docDe("pedra-nova-cidade-teste")).slug).toBe("pedra-nova-cidade-teste");
  });

  // I3 da pré-auditoria: renomear pro nome de um lugar do João esbarra no par
  // (o gêmeo sem cidade) — e a frase é a DELA.
  it("renomear pro nome de um lugar do João: 409 com a frase dela, e o rascunho não muda", async () => {
    const antes = await docDe();
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await docDe()).toEqual(antes);
  });

  it("rascunho de OUTRA pessoa: 404, e ele não muda", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    expect((await rota.PUT(pedido("PUT", { slug: "da-outra-cidade", campo: "promessa", valor: "x" }))).status).toBe(404);
    expect(await docDe("da-outra-cidade")).toEqual({ slug: "da-outra-cidade" });
  });

  it("o rascunho que sumiu entre a leitura e a gravação: 409 com a frase DELA", async () => {
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      await c.execute({ sql: "DELETE FROM ficha_rascunhos WHERE slug = ?", args: [SLUG] });
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_DELA_SUMIU);
  });

  // Review Focus 4: a sessão venceu no meio — o rascunho fica.
  it("401 não toca o rascunho", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    sessao.atual = null;
    expect((await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Outra." }))).status).toBe(401);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });
});

describe("GET e DELETE", () => {
  beforeEach(comecar);

  it("GET lista só os rascunhos dela", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    const r = await (await rota.GET(pedido("GET"))).json();
    expect(r.rascunhos.map((x: { slug: string }) => x.slug)).toEqual([SLUG]);
  });

  it("DELETE do dela: 200 e some; do de outra: 404 e fica", async () => {
    await criarRascunhoDaPessoa(c, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), AGORA, OUTRA.id);
    expect((await rota.DELETE(pedido("DELETE", { slug: "da-outra-cidade" }))).status).toBe(404);
    expect(await rascunhoDeQualquerUm(c, "da-outra-cidade")).not.toBeNull();
    expect((await rota.DELETE(pedido("DELETE", { slug: SLUG }))).status).toBe(200);
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/campos-da-pessoa.test.ts tests/lib/db-rascunho-da-pessoa.test.ts tests/api/route-contribuir-rascunho.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: `src/lib/campos-da-pessoa.ts`**

```ts
import { aplicarNoRascunho, gravarPontoNoRascunho, lerCaminho } from "@/lib/campos-da-ficha";

/** AS PERGUNTAS DE QUEM USA O APP (spec de 07/10, Parte 1) — a lista FECHADA
 *  do que ela escreve. Os INSTRUMENTOS são os do painel (cada caminho daqui
 *  existe no registro, `CAMPOS_DA_FICHA`, e a gravação de cada folha passa
 *  pela mesma conferência de tipo), mas QUAIS caminhos e QUAIS são
 *  obrigatórios é desta lista, não do registro: o registro diz o que o lugar
 *  do JOÃO exige.
 *
 *  O que NÃO está aqui a pessoa não escreve — e a página cala (Task 4). */
export const CAMPOS_DA_PESSOA: readonly string[] = [
  "trajeto.waypoints.0.nome", // 1. nome
  "cidade", //                   2. cidade
  //                             3. o ponto no mapa — `PONTO`, gravado à parte
  "promessa", //                 4. o que é, em uma frase
  "acesso", //                   5. como se chega
  "avisos", //                   6. o que pode dar errado (opcional)
  "custo.tag", //                7. custa ou é grátis
  "custo.valor", //                 … e quanto (opcional)
  "horario", //                  8. horário (opcional)
  "dias", //                        e dias (opcional)
];

export const OPCIONAIS_DA_PESSOA: ReadonlySet<string> = new Set(["avisos", "custo.valor", "horario", "dias"]);

/** A pergunta do mapa, na lista do que falta. Não é caminho do documento: é o
 *  ponto 0 E a coordenada da chuva, juntos. */
export const PONTO = "ponto";

export function ehCampoDaPessoa(c: unknown): c is string {
  return typeof c === "string" && CAMPOS_DA_PESSOA.includes(c);
}

/** 🔴 O PONTO É UM SÓ (spec, pergunta 3): "a coordenada da chuva E o ponto 1
 *  do trajeto". Grava os dois, com os mesmos números, numa conta só. */
export function pontoNoRascunhoDaPessoa(doc: string, lat: number, lng: number): string {
  return aplicarNoRascunho(gravarPontoNoRascunho(doc, 0, lat, lng), "condicao.coords", { lat, lng });
}

/** O "não sei" DELA: só nos opcionais da lista dela (`avisos` inclusive, que
 *  é obrigatório no registro do João). Rascunho não passa pelo schema. */
export function tirarDoRascunhoDaPessoa(doc: string, caminho: string): string {
  if (!OPCIONAIS_DA_PESSOA.has(caminho)) throw new Error(`\`${caminho}\` não tem "não sei" aqui`);
  const atual = JSON.parse(doc) as Record<string, unknown>;
  if (caminho === "custo.valor") {
    const custo = atual.custo as Record<string, unknown> | undefined;
    if (custo) {
      const { valor: _valor, ...resto } = custo;
      return JSON.stringify({ ...atual, custo: resto });
    }
    return doc;
  }
  const { [caminho]: _fora, ...resto } = atual;
  return JSON.stringify(resto);
}

const OBRIGATORIOS = CAMPOS_DA_PESSOA.filter((c) => !OPCIONAIS_DA_PESSOA.has(c));

/** O que falta pra publicar, pela lista DELA. O ponto falta enquanto o ponto 0
 *  ou a coordenada da chuva não tiverem lat E lng. */
export function obrigatoriosDaPessoaFaltando(doc: unknown): string[] {
  const faltam = OBRIGATORIOS.filter((c) => lerCaminho(doc, c.split(".")) === undefined);
  const temPar = (p: unknown) =>
    typeof p === "object" && p !== null && Number.isFinite((p as { lat?: unknown }).lat) && Number.isFinite((p as { lng?: unknown }).lng);
  if (!temPar(lerCaminho(doc, ["trajeto", "waypoints", "0"])) || !temPar(lerCaminho(doc, ["condicao", "coords"]))) {
    faltam.push(PONTO);
  }
  return faltam;
}

/** 🔴 O QUE SOBRA no documento além do que ela escreve — a porta de publicar
 *  dela recusa qualquer sobra (Review Focus 1), mesmo que tenha entrado por um
 *  caminho que não as rotas dela. Devolve os caminhos que sobram. */
export function chavesForaDaPessoa(doc: unknown): string[] {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return ["(documento)"];
  const d = doc as Record<string, unknown>;
  const sobra: string[] = [];
  const PERMITIDAS = new Set(["slug", "modos", "cidade", "promessa", "acesso", "avisos", "trajeto", "condicao", "custo", "horario", "dias"]);
  for (const k of Object.keys(d)) if (!PERMITIDAS.has(k)) sobra.push(k);
  const sobraEm = (onde: string, obj: unknown, permitidas: readonly string[]) => {
    if (typeof obj !== "object" || obj === null) return;
    for (const k of Object.keys(obj)) if (!permitidas.includes(k)) sobra.push(`${onde}.${k}`);
  };
  sobraEm("trajeto", d.trajeto, ["waypoints"]);
  const pontos = (d.trajeto as { waypoints?: unknown } | undefined)?.waypoints;
  if (Array.isArray(pontos)) {
    pontos.slice(1).forEach((_, i) => sobra.push(`trajeto.waypoints.${i + 1}`));
    sobraEm("trajeto.waypoints.0", pontos[0], ["nome", "lat", "lng"]);
  }
  sobraEm("condicao", d.condicao, ["coords"]);
  sobraEm("custo", d.custo, ["tag", "valor"]);
  return sobra;
}
```

- [ ] **Step 4: As funções de banco dela, em `src/lib/db-contribuidor.ts`**

```ts
import type { Rascunho } from "@/lib/db";
import type { QuemContribui } from "@/lib/contribuidor-sessao";

/** Ela não está bloqueada — em SQL, pra morar NO statement que grava (o João
 *  pode bloquear entre a porta da rota e a gravação). */
const LIVRE = `NOT EXISTS (SELECT 1 FROM contribuidores WHERE id = ? AND bloqueado = 1)`;

/** 🔴 O endereço não é endereço ANTIGO de outro lugar (ruling de produto da
 *  pré-auditoria de 07/10): o link velho que circula continua levando ao lugar
 *  de onde veio, e o rascunho dela não nasce nem se muda pra lá. Em SQL, pra
 *  morar NO statement que grava; o `publicarRascunho` (Task 1) confere de novo,
 *  no batch, pra corrida. Um `?`: o endereço. */
const SEM_ENDERECO_ANTIGO = `NOT EXISTS (SELECT 1 FROM enderecos_antigos WHERE velho = ?)`;

const rascunho = (r: Record<string, unknown>): Rascunho => ({
  slug: String(r.slug), doc: String(r.doc), atualizado_em: Number(r.atualizado_em),
});

/** Quem contribui, a cada porta aberta. Perfil novo atualiza; perfil que não
 *  veio (`null`) NÃO apaga o de antes. 🔴 NUNCA mexe em `bloqueado`: só o João
 *  bloqueia e desbloqueia (Task 15). */
export async function registrarContribuidor(client: Client, p: QuemContribui, agora: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, ?, ?, 0, ?)
          ON CONFLICT(id) DO UPDATE SET nome = COALESCE(excluded.nome, contribuidores.nome),
                                        email = COALESCE(excluded.email, contribuidores.email)`,
    args: [p.id, p.nome, p.email, agora],
  });
}

export async function estaBloqueado(client: Client, id: string): Promise<boolean> {
  const r = await client.execute({ sql: `SELECT bloqueado FROM contribuidores WHERE id = ?`, args: [id] });
  return r.rows.length > 0 && Number(r.rows[0].bloqueado) === 1;
}

/** O rascunho DELA nasce — com a régua de `criarRascunho` (endereço livre nas
 *  duas tabelas, numa consulta só) e mais duas: é dela, e ela não está
 *  bloqueada. */
export async function criarRascunhoDaPessoa(client: Client, slug: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_rascunhos (slug, doc, atualizado_em, contribuidor)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
                             AND ${SEM_ENDERECO_ANTIGO} AND ${LIVRE}
          ON CONFLICT(slug) DO NOTHING`,
    args: [slug, doc, agora, id, slug, slug, id],
  });
  return r.rowsAffected === 1;
}

export async function lerRascunhoDaPessoa(client: Client, slug: string, id: string): Promise<Rascunho | null> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE slug = ? AND contribuidor = ?`,
    args: [slug, id],
  });
  return r.rows.length ? rascunho(r.rows[0] as unknown as Record<string, unknown>) : null;
}

export async function rascunhosDaPessoa(client: Client, id: string): Promise<Rascunho[]> {
  const r = await client.execute({
    sql: `SELECT slug, doc, atualizado_em FROM ficha_rascunhos WHERE contribuidor = ? ORDER BY atualizado_em DESC, slug ASC`,
    args: [id],
  });
  return r.rows.map((l) => rascunho(l as unknown as Record<string, unknown>));
}

/** A régua de `regravarRascunho` (UPDATE, nunca upsert; `atualizado_em` cresce
 *  estritamente), e só no rascunho DELA, livre. */
export async function regravarRascunhoDaPessoa(client: Client, slug: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET doc = ?, atualizado_em = MAX(?, atualizado_em + 1)
           WHERE slug = ? AND contribuidor = ? AND ${LIVRE}`,
    args: [doc, agora, slug, id, id],
  });
  return r.rowsAffected === 1;
}

/** A régua de `moverRascunho` (o destino livre nas duas tabelas, num UPDATE
 *  só), e só no rascunho DELA, livre — e o destino não é endereço antigo. */
export async function moverRascunhoDaPessoa(client: Client, de: string, para: string, doc: string, agora: number, id: string): Promise<boolean> {
  const r = await client.execute({
    sql: `UPDATE ficha_rascunhos SET slug = ?, doc = ?, atualizado_em = MAX(?, atualizado_em + 1)
           WHERE slug = ? AND contribuidor = ? AND ${LIVRE}
             AND NOT EXISTS (SELECT 1 FROM ficha_versoes WHERE ficha_slug = ?)
             AND NOT EXISTS (SELECT 1 FROM ficha_rascunhos WHERE slug = ?)
             AND ${SEM_ENDERECO_ANTIGO}`,
    args: [para, doc, agora, de, id, id, para, para, para],
  });
  return r.rowsAffected === 1;
}

export async function apagarRascunhoDaPessoa(client: Client, slug: string, id: string): Promise<boolean> {
  const r = await client.execute({ sql: `DELETE FROM ficha_rascunhos WHERE slug = ? AND contribuidor = ?`, args: [slug, id] });
  return r.rowsAffected === 1;
}
```

(A importação de `Rascunho` de `@/lib/db` é só de TIPO — sem ciclo de valor.)

- [ ] **Step 5: `src/lib/porta-da-pessoa.ts`**

```ts
import { getClient } from "@/lib/db";
import { estaBloqueado, registrarContribuidor } from "@/lib/db-contribuidor";
import { lerContribuidor, type QuemContribui } from "@/lib/contribuidor-sessao";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

// PENDENTE: redação minha, o João ainda não leu
export const CLERK_FORA = "Não deu pra conferir quem você é agora. Nada foi gravado: tente de novo daqui a pouco.";
// PENDENTE: redação minha, o João ainda não leu
export const BLOQUEADA = "Esta conta não pode mais mandar nem mudar lugares no BatePerna.";
/** A variante DELA do `RASCUNHO_NAO_EXISTE_MAIS` do painel — aquele manda
 *  "voltar pela lista do painel", que ela não tem. */
// PENDENTE: redação minha, o João ainda não leu
export const RASCUNHO_DELA_SUMIU =
  "Nada foi gravado: este rascunho não está mais neste endereço. Ele foi publicado, apagado, ou mudou de nome ou de cidade: volte pela sua lista de lugares.";
/** 🔴 O 409 DE TODA COLISÃO DELA (I3 da pré-auditoria de 07/10) — o par, o
 *  gêmeo sem cidade, o endereço ocupado por lugar ou rascunho de outro, e o
 *  endereço antigo de outro lugar. UMA frase, e de propósito: as do painel
 *  falam do painel ("pela lista do painel", "responda a cidade dele") e
 *  NOMEIAM quem ocupa — um rascunho de outra pessoa, ou um lugar escondido do
 *  João. Esta diz o que é verdade nos quatro casos e não nomeia ninguém.
 *
 *  📝 DECISÃO DO JOÃO, pro pacote de copy: em dois casos ela fica SEM saída —
 *  o gêmeo sem cidade (só o João responde a cidade do lugar dele) e um lugar
 *  real diferente com o mesmo nome na mesma cidade. A frase não inventa
 *  saída; o que fazer nesses dois é dele. */
// PENDENTE: redação minha, o João ainda não leu
export const NOME_JA_EM_USO =
  "Nada foi gravado: este nome já está em uso no BatePerna, por um lugar no ar ou por um que alguém está mandando. Se for o mesmo lugar, ele já está (ou logo estará) no app.";

/** A PORTA DE TODA ROTA DE QUEM CONTRIBUI, nesta ordem: o Clerk respondeu
 *  (senão 503 com frase), há sessão (senão 401 — e a tela recarrega e pede
 *  login, Review Focus 4), quem é fica registrado (nome e e-mail SÓ pro painel
 *  dele), e ela não está bloqueada (senão 403 com frase). O bloqueio também
 *  mora em cada gravação (`LIVRE`, em `db-contribuidor.ts`): esta checagem dá
 *  a frase, aquela fecha a corrida. */
export async function portaDaPessoa(agora: number): Promise<{ pessoa: QuemContribui } | { resposta: Response }> {
  let pessoa: QuemContribui | null;
  try {
    pessoa = await lerContribuidor();
  } catch {
    return { resposta: new Response(CLERK_FORA, { status: 503, headers: TEXTO }) };
  }
  if (pessoa === null) return { resposta: new Response("", { status: 401, headers: TEXTO }) };
  await registrarContribuidor(getClient(), pessoa, agora);
  if (await estaBloqueado(getClient(), pessoa.id)) {
    return { resposta: new Response(BLOQUEADA, { status: 403, headers: TEXTO }) };
  }
  return { pessoa };
}
```

- [ ] **Step 6: A rota**

`src/app/api/contribuir/rascunho/route.ts` — o molde é `src/app/api/admin/rascunho/route.ts`, e cada desvio dele está comentado:

```ts
import { aplicarNoRascunho, type ValorDeCampo } from "@/lib/campos-da-ficha";
import { ehCampoDaPessoa, pontoNoRascunhoDaPessoa, tirarDoRascunhoDaPessoa } from "@/lib/campos-da-pessoa";
import { getClient } from "@/lib/db";
import {
  apagarRascunhoDaPessoa, criarRascunhoDaPessoa, lerRascunhoDaPessoa, moverRascunhoDaPessoa, rascunhosDaPessoa,
  regravarRascunhoDaPessoa,
} from "@/lib/db-contribuidor";
import { CAMPO_DA_CIDADE, CAMPO_DO_NOME, colisaoDaMudanca, colisaoDoPar } from "@/lib/par-de-lugar";
import { NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, portaDaPessoa } from "@/lib/porta-da-pessoa";
import {
  CIDADE_SEM_LETRA, CIDADE_VAZIA, NOME_SEM_LETRA, NOME_VAZIO, cidadeDoDoc, docDoLugarNovo,
  docNoEndereco, nomeDoRascunho, slugDoNome,
} from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const SEM_CACHE = { "cache-control": "no-store" } as const;
const agoraS = () => Math.floor(Date.now() / 1000);

async function corpoDe(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Só `Error` NOSSO vira frase (as do registro, já lidas por ele); qualquer
 *  outro (ZodError) é 400 mudo — mesma régua da rota do painel. */
function recusar400(erro: unknown): Response {
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

const emUso = (): Response => new Response(NOME_JA_EM_USO, { status: 409, headers: TEXTO });

/** COMEÇAR: o nome e a cidade, como no painel (mesmas frases de campo, mesma
 *  colisão pelo par, mesmo endereço). O rascunho nasce DELA.
 *
 *  🔴 I3 da pré-auditoria: TODA colisão — o par, o gêmeo sem cidade, o
 *  endereço ocupado, o endereço antigo — responde `NOME_JA_EM_USO`. A rota lê a
 *  colisão ESTRUTURADA (`colisaoDoPar`) e nunca pergunta QUEM ocupa: nada do
 *  painel ("pela lista do painel") e nenhum nome de outro chega a ela. */
export async function POST(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;

  const corpo = await corpoDe(req);
  if (corpo === null || Object.keys(corpo).length !== 2 || typeof corpo.nome !== "string" || typeof corpo.cidade !== "string") {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const nome = corpo.nome.trim();
  const cidade = corpo.cidade.trim();
  if (nome === "") return new Response(NOME_VAZIO, { status: 400, headers: TEXTO });
  if (cidade === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
  if (slugDoNome(nome) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
  if (slugDoNome(cidade) === "") return new Response(CIDADE_SEM_LETRA, { status: 400, headers: TEXTO });

  if ((await colisaoDoPar(nome, cidade, { exceto: null, nomeNovo: true })) !== null) return emUso();

  const slug = slugDoNome(`${nome} ${cidade}`);
  if (await criarRascunhoDaPessoa(getClient(), slug, docDoLugarNovo(slug, nome, cidade), agora, porta.pessoa.id)) {
    return Response.json({ slug }, { status: 201, headers: SEM_CACHE });
  }
  // Endereço de um lugar, de um rascunho de outro, ou endereço antigo: o
  // banco recusou, e a frase é a dela. (A Task 15 põe antes daqui a
  // conferência do bloqueio.)
  return emUso();
}

/** RESPONDER uma pergunta dela. Três corpos, mutuamente exclusivos:
 *  `{slug, campo, valor}`, `{slug, campo, naoSei: true}`, `{slug, ponto: 0, lat, lng}`.
 *  🔴 Campo fora da lista dela é 400 ANTES de ler o banco (Review Focus 1). */
export async function PUT(req: Request): Promise<Response> {
  const agora = agoraS();
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  const { slug, campo, valor, naoSei, ponto, lat, lng } = corpo;
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  if (trazCampo === trazPonto) return new Response("", { status: 400, headers: TEXTO });

  let mudar: (doc: string) => string;
  if (trazPonto) {
    if (ponto !== 0 || typeof lat !== "number" || typeof lng !== "number") return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => pontoNoRascunhoDaPessoa(doc, lat, lng);
  } else {
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei || (trazNaoSei && naoSei !== true)) return new Response("", { status: 400, headers: TEXTO });
    if (!ehCampoDaPessoa(campo)) return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => (trazNaoSei ? tirarDoRascunhoDaPessoa(doc, campo) : aplicarNoRascunho(doc, campo, valor as ValorDeCampo));
  }

  const atual = await lerRascunhoDaPessoa(getClient(), slug, id);
  if (atual === null) return new Response("", { status: 404, headers: TEXTO });

  if ((await colisaoDaMudanca(atual.doc, slug, campo, valor)) !== null) return emUso();

  let novoDoc: string;
  try {
    novoDoc = mudar(atual.doc);
  } catch (erro) {
    return recusar400(erro);
  }

  if (trazCampo && (campo === CAMPO_DO_NOME || campo === CAMPO_DA_CIDADE)) {
    if (slugDoNome(nomeDoRascunho(novoDoc, "")) === "") return new Response(NOME_SEM_LETRA, { status: 400, headers: TEXTO });
    if (slugDoNome(cidadeDoDoc(novoDoc) ?? "") === "") return new Response(CIDADE_VAZIA, { status: 400, headers: TEXTO });
    const destino = slugDoNome(`${nomeDoRascunho(novoDoc, "")} ${cidadeDoDoc(novoDoc)}`);
    if (destino !== slug) {
      if (await moverRascunhoDaPessoa(getClient(), slug, destino, docNoEndereco(novoDoc, destino), agora, id)) {
        return Response.json({ slug: destino }, { headers: SEM_CACHE });
      }
      if ((await lerRascunhoDaPessoa(getClient(), slug, id)) === null) {
        return new Response(RASCUNHO_DELA_SUMIU, { status: 409, headers: TEXTO });
      }
      // O destino está ocupado (lugar, rascunho de outro, endereço antigo): a frase dela.
      return emUso();
    }
  }
  if (!(await regravarRascunhoDaPessoa(getClient(), slug, novoDoc, agora, id))) {
    return new Response(RASCUNHO_DELA_SUMIU, { status: 409, headers: TEXTO });
  }
  return Response.json({ slug }, { headers: SEM_CACHE });
}

export async function GET(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(agoraS());
  if ("resposta" in porta) return porta.resposta;
  const slug = new URL(req.url).searchParams.get("slug");
  if (slug !== null) {
    const r = await lerRascunhoDaPessoa(getClient(), slug, porta.pessoa.id);
    if (r === null) return new Response("", { status: 404, headers: TEXTO });
    return Response.json({ slug: r.slug, doc: JSON.parse(r.doc) }, { headers: SEM_CACHE });
  }
  const rascunhos = (await rascunhosDaPessoa(getClient(), porta.pessoa.id)).map((r) => ({
    slug: r.slug, nome: nomeDoRascunho(r.doc, r.slug), atualizado_em: r.atualizado_em,
  }));
  return Response.json({ rascunhos }, { headers: SEM_CACHE });
}

/** DESISTIR (o "Desistir deste lugar" da Tarefa 15 vale aqui também). */
export async function DELETE(req: Request): Promise<Response> {
  const porta = await portaDaPessoa(agoraS());
  if ("resposta" in porta) return porta.resposta;
  const corpo = await corpoDe(req);
  if (corpo === null || typeof corpo.slug !== "string") return new Response("", { status: 400, headers: TEXTO });
  if (!(await apagarRascunhoDaPessoa(getClient(), corpo.slug, porta.pessoa.id))) {
    return new Response("", { status: 404, headers: TEXTO });
  }
  return Response.json({ slug: corpo.slug }, { headers: SEM_CACHE });
}
```

(`RASCUNHO_DELA_SUMIU`, e não o `RASCUNHO_NAO_EXISTE_MAIS` do painel: aquele manda "voltar pela lista do painel", que ela não tem.)

- [ ] **Step 7: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/campos-da-pessoa.test.ts tests/lib/db-rascunho-da-pessoa.test.ts tests/api/route-contribuir-rascunho.test.ts`
Expected: PASS.

- [ ] **Step 8: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `ehCampoDaPessoa` aceita qualquer caminho do registro | "campo fora da lista dela (`voz`)…" e os vizinhos |
| M2 | o PUT confere `ehCampoDaPessoa` DEPOIS de gravar | idem (a gravação já aconteceu) |
| M3 | `pontoNoRascunhoDaPessoa` grava só o ponto 0 | "o ponto grava o ponto 0 E a coordenada da chuva" |
| M4 | o PUT aceita `ponto` qualquer | "ponto que não é o 0: 400" |
| M5 | `lerRascunhoDaPessoa` sem `AND contribuidor = ?` | "OUTRA pessoa não lê…" **e** "rascunho de OUTRA pessoa: 404" |
| M6 | `regravarRascunhoDaPessoa` sem `${LIVRE}` | "bloqueada: não cria, não regrava, não move" |
| M7 | `registrarContribuidor` com `bloqueado = 0` no `DO UPDATE` | "registrar de novo não desbloqueia" |
| M8 | `registrarContribuidor` sem `COALESCE` | "perfil que não veio (null) não apaga o que já havia" |
| M9 | `portaDaPessoa` sem o `try` | "Clerk fora: 503" **e** a SONDA |
| M10 | `tirarDoRascunhoDaPessoa` sem a guarda de opcional | "recusa obrigatório dela" |
| M11 | `chavesForaDaPessoa` sem o ramo das etapas | "`trajeto.waypoints.1` sobra" |
| M12 | o POST sem `colisaoDoPar` | "o par de um lugar do João: 409 com a frase DELA" (o endereço `rampa-do-pepe-cidade-teste` está livre: nasce, 201) |
| M13 | o POST volta a responder a frase do painel (`parOcupado`, com o `quemOcupa` de antes) | "o par de um lugar do João: 409 com a frase DELA" **e** "o endereço de um rascunho de OUTRA pessoa" |
| M14 | o PUT sem `colisaoDaMudanca` | "renomear pro nome de um lugar do João: 409 com a frase dela" (sem o par, o rascunho se muda: 200) |
| M15 | tira o `${SEM_ENDERECO_ANTIGO}` de `criarRascunhoDaPessoa` | "não nasce, nem se muda, pra um endereço antigo" **e** "um endereço antigo de um lugar do João: 409" |
| M16 | tira o `${SEM_ENDERECO_ANTIGO}` de `moverRascunhoDaPessoa` (e o último `para` dos args) | "não nasce, nem se muda, pra um endereço antigo" |
| M17 | `tests/sessao-da-pessoa.ts` volta ao estado num `const` do módulo (`export const sessao = { atual: PESSOA, fora: false }`, sem `globalThis`) — mutação do DUBLÊ, não da rota | a SONDA: "a rota vê a sessão que o teste muda" (medido na pré-auditoria: 200 onde se esperava 401) |

(Saiu da tabela — M5 da pré-auditoria — a mutação "`portaDaPessoa` confere o bloqueio ANTES da sessão": sem sessão não há `id` pra conferir, então ela não é uma reordenação aplicável — só um `TypeError` em `null.id`, que mataria o caso pelo motivo errado. A ordem sessão → bloqueio é imposta pelo tipo, não por prova.)

- [ ] **Step 9: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 10: Commit e harness**

```bash
git add src/lib/campos-da-pessoa.ts src/lib/porta-da-pessoa.ts src/lib/db-contribuidor.ts src/app/api/contribuir/rascunho/route.ts tests/sessao-da-pessoa.ts tests/lib/campos-da-pessoa.test.ts tests/lib/db-rascunho-da-pessoa.test.ts tests/api/route-contribuir-rascunho.test.ts
git commit -m "feat(contribuir): a rota do rascunho de quem usa, so com os campos dela"
node scripts/mutar.mjs
```

📝 **Frases novas:** `CLERK_FORA`, `BLOQUEADA`, `RASCUNHO_DELA_SUMIU`, `NOME_JA_EM_USO` — esta com a nota de decisão dele (os dois casos sem saída: o gêmeo sem cidade e o lugar real diferente de mesmo nome na mesma cidade).

---

### Task 11: `/api/contribuir/publicar` — a porta de publicar DELA, no ar na hora e marcado

**Files:**
- Modify: `src/lib/porta-da-pessoa.ts` — `prepararPublicacaoDaPessoa`, `fraseDaPessoa` e as frases
- Modify: `src/lib/porta-de-coerencia.ts:127-141` (a função `violacaoIntroduzida` de hoje; o arquivo tem 141 linhas) — `violacaoIntroduzidaInteira` (a mesma conta, devolvendo a `Violacao`); `violacaoIntroduzida` passa a chamá-la
- Create: `src/app/api/contribuir/publicar/route.ts`
- Test: `tests/lib/porta-da-pessoa.test.ts`, `tests/api/route-contribuir-publicar.test.ts` (criar)

**Interfaces:**
- Consumes: `portaDaPessoa`, `RASCUNHO_DELA_SUMIU`, `NOME_JA_EM_USO` (Task 10); `obrigatoriosDaPessoaFaltando`, `chavesForaDaPessoa` (Task 10); `lerRascunhoDaPessoa` (Task 10); `publicarRascunho(…, contribuidor)` (Task 1); `colisaoDoPar`, `rascunhoDeQualquerUm` (Task 1), `enderecoNovoDe` de `@/lib/db` — NUNCA `parOcupado` nem `enderecoDeLugar` (frases do painel, I3); `faixasDe`, `problemaDasFaixas` de `@/lib/horario`; `FORMA_ERRADA`, `SLUG_DE_DENTRO`, `RASCUNHO_ILEGIVEL`, `RASCUNHO_MUDOU` de `@/lib/porta-de-publicar` (já LIDAS por ele, e não falam de painel); `REGRAS`, `type Violacao` de `@/lib/coerencia`.
- Produces:
  - `src/lib/porta-de-coerencia.ts`: `export function violacaoIntroduzidaInteira(versoes, slug, antes, depois): Violacao | null`
  - `src/lib/porta-da-pessoa.ts`:
    - `export function prepararPublicacaoDaPessoa(texto: string, slug: string): { doc: string } | { frase: string }`
    - `export const FRASE_DA_PESSOA: Readonly<Record<string, string>>` (chave = id de regra de `REGRAS`)
    - `export function fraseDaPessoa(v: Violacao): string`
    - frases `FORA_DA_LISTA_DELA`, `FALTA_DA_PESSOA`, `JA_NO_AR_DA_PESSOA`, `RECUSA_DA_PESSOA`
  - `POST /api/contribuir/publicar` com corpo `{ slug, atualizadoEm }`: 200 `{slug}` · 400/409 com frase · 401 · 403 · 404 · 503

🔴 **As recusas da coerência ganham versão pra ela** (spec, Parte 3). As do João nomeiam OUTRO lugar e falam a língua do painel ("o chip", "a etiqueta", "deixe a lista vazia"). Pra ela, uma frase por REGRA que os campos dela alcançam — e uma de reserva pra o resto. Quais ela alcança (os campos dela: `promessa`, `acesso`, `avisos`, `custo.tag`/`custo.valor`, `horario`, `dias`; sem `piso` a regra do piso cala; sem `custo.curto` as três do chip calam E a `preco-legivel-no-custo` também — ela só examina ficha paga COM chip, `coerencia.ts:168`; sem `secaRapido` a da frase emprestada cala; sem regra as de janela calam — Task 2): `texto-emprestado`, `horario-invertido-sem-aviso`, `hora-de-fechar-sem-campo`, `prosa-bate-com-hora-de-fechar`, `dia-repetido-ou-inventado`, `semana-inteira-nao-declara`. **Antes de colar cada frase, leia a regra em `src/lib/coerencia.ts`**: a frase diz o que a regra confere; se a redação abaixo descrever outra coisa, ajuste a frase (continua PENDENTE) e relate.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/porta-da-pessoa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REGRAS } from "@/lib/coerencia";
import {
  FALTA_DA_PESSOA, FORA_DA_LISTA_DELA, FRASE_DA_PESSOA, RECUSA_DA_PESSOA, fraseDaPessoa, prepararPublicacaoDaPessoa,
} from "@/lib/porta-da-pessoa";
import { FORMA_ERRADA, RASCUNHO_ILEGIVEL, SLUG_DE_DENTRO } from "@/lib/porta-de-publicar";

const SLUG = "pedra-mandada-cidade-teste";
const COMPLETO = {
  slug: SLUG, modos: [], cidade: "Cidade Teste", promessa: "Uma pedra.", acesso: "De carro.",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] },
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
};
const preparar = (doc: unknown) => prepararPublicacaoDaPessoa(JSON.stringify(doc), SLUG);

describe("prepararPublicacaoDaPessoa", () => {
  // 🔴 I2 da pré-auditoria (MEDIDO com o zod do repo): o `fichaSchema.parse`
  // devolve as chaves na ordem da FORMA do schema (`promessa, trajeto,
  // acesso`), não na do documento (`promessa, acesso, trajeto`). Comparar o
  // TEXTO ficaria vermelho com a porta certa — e o "conserto" óbvio (devolver
  // o texto cru) desfaria a normalização. Compara-se o OBJETO: vai ao ar o
  // documento normalizado, com as mesmas respostas, e a ordem é irrelevante.
  it("o documento completo dela vai ao ar com as mesmas respostas (normalizado)", () => {
    const r = preparar(COMPLETO);
    expect("doc" in r, JSON.stringify(r)).toBe(true);
    expect(JSON.parse((r as { doc: string }).doc)).toEqual(COMPLETO);
  });

  it("ilegível: a frase de sempre", () => {
    expect(prepararPublicacaoDaPessoa("{", SLUG)).toEqual({ frase: RASCUNHO_ILEGIVEL });
  });

  it("faltando um obrigatório dela: a frase dela", () => {
    const { acesso: _a, ...sem } = COMPLETO;
    expect(preparar(sem)).toEqual({ frase: FALTA_DA_PESSOA });
  });

  // 🔴 Review Focus 1: o documento com chave fora da lista é recusado aqui,
  // venha de onde vier. A pessoa não publica voz nem regra.
  it.each([
    ["voz", { voz: "x" }],
    ["condicao.regra", { condicao: { coords: COMPLETO.condicao.coords, regra: { tipo: "chuva_binaria", janela_previsao_horas: 1, janela_passado_horas: 1, limiar_mm: 1 } } }],
    ["discriminador", { discriminador: { como_ler: "x" } }],
  ])("documento com chave fora da lista (`%s`): recusado", (_c, mais) => {
    expect(preparar({ ...COMPLETO, ...mais })).toEqual({ frase: FORA_DA_LISTA_DELA });
  });

  it("forma errada: a frase de sempre", () => {
    expect(preparar({ ...COMPLETO, custo: { tag: "caro" } })).toEqual({ frase: FORMA_ERRADA });
  });

  it("slug de dentro diferente do endereço: a frase de sempre", () => {
    expect(preparar({ ...COMPLETO, slug: "outro" })).toEqual({ frase: SLUG_DE_DENTRO });
  });
});

describe("fraseDaPessoa", () => {
  it("toda chave de FRASE_DA_PESSOA é uma regra que existe — nenhuma fantasma", () => {
    expect(Object.keys(FRASE_DA_PESSOA).length, "a tabela foi lida vazia").toBe(6);
    for (const k of Object.keys(FRASE_DA_PESSOA)) expect(REGRAS, k).toContain(k);
  });

  it("regra com frase dela: a dela, nunca a do painel", () => {
    expect(fraseDaPessoa({ regra: "texto-emprestado", slug: SLUG, frase: "frase do painel" })).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
  });

  it("regra sem frase dela: a de reserva, nunca a do painel", () => {
    expect(fraseDaPessoa({ regra: "janela-nao-zerada", slug: SLUG, frase: "frase do painel" })).toBe(RECUSA_DA_PESSOA);
  });
});
```

`tests/api/route-contribuir-publicar.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enderecoNovoDe, lerAcervoComOrigem, rascunhoDeQualquerUm, versaoAtual } from "@/lib/db";
import { criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { FALTA_DA_PESSOA, FRASE_DA_PESSOA, JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { RASCUNHO_MUDOU } from "@/lib/porta-de-publicar";
import { semearAcervo } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

const AGORA = 1_758_300_000;
const SLUG = "pedra-mandada-cidade-teste";
const COMPLETO = {
  slug: SLUG, modos: [], cidade: "Cidade Teste", promessa: "Uma pedra que ninguém mais descreveu assim.", acesso: "De carro.",
  trajeto: { waypoints: [{ nome: "Pedra Mandada", lat: -8.31, lng: -35.97 }] },
  condicao: { coords: { lat: -8.31, lng: -35.97 } }, custo: { tag: "gratis" },
};
let c: Client;
let POST: typeof import("@/app/api/contribuir/publicar/route").POST;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  POST = (await import("@/app/api/contribuir/publicar/route")).POST;
});
afterEach(() => { c.close(); vi.useRealTimers(); });

async function rascunho(doc: unknown = COMPLETO, dono = PESSOA.id): Promise<number> {
  await criarRascunhoDaPessoa(c, SLUG, JSON.stringify(doc), AGORA - 10, dono);
  return (await rascunhoDeQualquerUm(c, SLUG))!.atualizado_em;
}
const pedido = (corpo: unknown) => new Request("http://x/api/contribuir/publicar", { method: "POST", body: JSON.stringify(corpo) });

describe("POST /api/contribuir/publicar", () => {
  it("200: no ar NA HORA, não conferido, dela, e o rascunho some", async () => {
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho() }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await lerAcervoComOrigem(c)).linhas.get(SLUG)).toMatchObject({ oculto: false, conferido: false, contribuidor: PESSOA.id });
    expect(await rascunhoDeQualquerUm(c, SLUG)).toBeNull();
  });

  it("rascunho de OUTRA pessoa: 404, e nada vai ao ar", async () => {
    const em = await rascunho(COMPLETO, OUTRA.id);
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(404);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("faltando obrigatório dela: 400 com a frase, nada vai ao ar", async () => {
    const { promessa: _p, ...sem } = COMPLETO;
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho(sem) }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe(FALTA_DA_PESSOA);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("a promessa IGUAL à de um lugar do João: 409 com a frase DELA (não a do painel), nada vai ao ar", async () => {
    const rampa = JSON.parse((await versaoAtual(c, "rampa-do-pepe"))!.doc);
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho({ ...COMPLETO, promessa: rampa.promessa }) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["texto-emprestado"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // 🔴 I3 da pré-auditoria: a colisão do publicar responde a frase DELA, que
  // não nomeia ninguém (a Rampa nasceu sem cidade: nome igual é o gêmeo).
  it("o nome de um lugar do João: 409 com a frase DELA, que não nomeia ninguém, e nada vai ao ar", async () => {
    const comNomeDaRampa = { ...COMPLETO, trajeto: { waypoints: [{ ...COMPLETO.trajeto.waypoints[0], nome: "Rampa do Pepê" }] } };
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho(comNomeDaRampa) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  // Ruling de produto da pré-auditoria: o João troca um endereço DEPOIS que o
  // rascunho dela nasceu, e o endereço dela vira endereço antigo. O batch
  // recusa, e a frase é a dela — nunca o "Nada foi publicado. Recarregue" mudo.
  it("o endereço virou endereço antigo de outro lugar depois que ela começou: 409 com a frase dela, e o link velho continua", async () => {
    const em = await rascunho();
    await c.execute({ sql: "INSERT INTO enderecos_antigos (velho, novo, em) VALUES (?, 'rampa-do-pepe', ?)", args: [SLUG, AGORA] });
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versaoAtual(c, SLUG)).toBeNull();
    expect(await enderecoNovoDe(c, SLUG)).toBe("rampa-do-pepe");
  });

  it("o texto diz a hora de fechar e o horário não foi respondido: 409 com a frase dela", async () => {
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: await rascunho({ ...COMPLETO, avisos: "O portão fecha às 17h." }) }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(FRASE_DA_PESSOA["hora-de-fechar-sem-campo"]);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("o rascunho mudou desde que a tela abriu: 409, nada vai ao ar", async () => {
    const em = await rascunho();
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em - 1 }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(RASCUNHO_MUDOU);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });

  it("o duplo toque: o 2º responde 409 com a frase DELA, e há UMA versão", async () => {
    const em = await rascunho();
    await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    const res = await POST(pedido({ slug: SLUG, atualizadoEm: em }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_NO_AR_DA_PESSOA);
    expect((await c.execute({ sql: "SELECT COUNT(*) AS n FROM ficha_versoes WHERE ficha_slug = ?", args: [SLUG] })).rows[0].n).toBe(1);
  });

  it("sem sessão 401; bloqueada 403; corpo torto 400 — nada vai ao ar", async () => {
    const em = await rascunho();
    sessao.atual = null;
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(401);
    sessao.atual = PESSOA;
    expect((await POST(pedido({ slug: SLUG }))).status).toBe(400);
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    expect((await POST(pedido({ slug: SLUG, atualizadoEm: em }))).status).toBe(403);
    expect(await versaoAtual(c, SLUG)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/porta-da-pessoa.test.ts tests/api/route-contribuir-publicar.test.ts`
Expected: FAIL.

- [ ] **Step 3: `violacaoIntroduzidaInteira`**

Em `src/lib/porta-de-coerencia.ts`, a função de hoje vira `violacaoIntroduzidaInteira` com UMA troca — a última linha devolve a `Violacao`, não a frase —, e a de antes passa a delegar (o docblock fica na `Inteira`, e a outra ganha uma linha: *"A frase da `violacaoIntroduzidaInteira` — o painel só precisa dela."*):

```ts
export function violacaoIntroduzidaInteira(
  versoes: Map<string, FichaVersao>, slug: string, antes: string | null, depois: string,
): Violacao | null {
  const violacoesAntes = violacoesDoAcervo(acervoComo(versoes, slug, antes));
  const contaAntes = contarPares(violacoesAntes);
  const todasDepois = violacoesDoAcervo(acervoComo(versoes, slug, depois));
  const contaDepois = contarPares(todasDepois);
  const introduzidas = todasDepois.filter((v) => (contaDepois.get(par(v)) ?? 0) > (contaAntes.get(par(v)) ?? 0));
  if (introduzidas.length === 0) return null;
  const frasesAntes = new Set(violacoesAntes.map((v) => v.frase));
  return introduzidas.find((v) => !frasesAntes.has(v.frase)) ?? introduzidas[0];
}

export function violacaoIntroduzida(
  versoes: Map<string, FichaVersao>, slug: string, antes: string | null, depois: string,
): string | null {
  return violacaoIntroduzidaInteira(versoes, slug, antes, depois)?.frase ?? null;
}
```

- [ ] **Step 4: A porta de publicar dela**

Acrescente a `src/lib/porta-da-pessoa.ts` (imports: `chavesForaDaPessoa`, `obrigatoriosDaPessoaFaltando` de `@/lib/campos-da-pessoa`; `faixasDe`, `problemaDasFaixas` de `@/lib/horario`; `FORMA_ERRADA`, `RASCUNHO_ILEGIVEL`, `SLUG_DE_DENTRO` de `@/lib/porta-de-publicar`; `fichaSchema` de `@/types/ficha`; `type Violacao` de `@/lib/coerencia`):

```ts
// PENDENTE: redação minha, o João ainda não leu
export const FALTA_DA_PESSOA = "Nada foi publicado: ainda falta responder pergunta obrigatória. As que faltam estão listadas nesta tela.";
// PENDENTE: redação minha, o João ainda não leu
export const FORA_DA_LISTA_DELA = "Nada foi publicado: este rascunho tem resposta que não é das perguntas daqui.";
// PENDENTE: redação minha, o João ainda não leu
export const JA_NO_AR_DA_PESSOA =
  "Nada foi publicado agora: este endereço já é de um lugar do app, e o rascunho não está mais aqui. Se você tocou duas vezes, o lugar foi publicado no primeiro toque: confira na sua lista de lugares.";
// PENDENTE: redação minha, o João ainda não leu
export const RECUSA_DA_PESSOA = "Nada foi publicado: uma resposta não combina com outra. Confira as respostas e tente de novo.";

/** AS RECUSAS DA COERÊNCIA NA LÍNGUA DELA (spec de 07/10, Parte 3) — uma por
 *  regra que os campos dela alcançam (ver a lista no topo da Task 11). Regra
 *  fora daqui cai em `RECUSA_DA_PESSOA`; a frase do João (que nomeia outro
 *  lugar e fala do painel) nunca chega a ela. */
export const FRASE_DA_PESSOA: Readonly<Record<string, string>> = {
  // PENDENTE: redação minha, o João ainda não leu
  "texto-emprestado": "Nada foi publicado: outro lugar do app já tem exatamente esta frase do que é o lugar. Escreva com as suas palavras.",
  // PENDENTE: redação minha, o João ainda não leu
  "horario-invertido-sem-aviso": "Nada foi publicado: o horário fecha antes de abrir. Se o lugar fica aberto de noite, diga isso no que pode dar errado.",
  // PENDENTE: redação minha, o João ainda não leu
  "hora-de-fechar-sem-campo": "Nada foi publicado: o texto diz a que horas o lugar fecha, mas a pergunta do horário não foi respondida.",
  // PENDENTE: redação minha, o João ainda não leu
  "prosa-bate-com-hora-de-fechar": "Nada foi publicado: a hora de fechar escrita no texto não é a mesma da pergunta do horário.",
  // PENDENTE: redação minha, o João ainda não leu
  "dia-repetido-ou-inventado": "Nada foi publicado: um dia da semana aparece mais de uma vez nos dias.",
  // PENDENTE: redação minha, o João ainda não leu
  "semana-inteira-nao-declara": "Nada foi publicado: marcar os sete dias é o mesmo que não marcar nenhum. Se o lugar abre todo dia, pule a pergunta dos dias.",
};

export function fraseDaPessoa(v: Violacao): string {
  return FRASE_DA_PESSOA[v.regra] ?? RECUSA_DA_PESSOA;
}

/** A PORTA DE PUBLICAR DELA — irmã de `prepararPublicacao` (a do João), com a
 *  lista dela no lugar do registro. A ordem: abrir → 🔴 nada fora da lista
 *  dela (Review Focus 1) → os obrigatórios DELA → o horário pela regra de
 *  escrita → o `fichaSchema` → o `slug` de dentro. Vai ao ar o documento
 *  NORMALIZADO, como no do João. */
export function prepararPublicacaoDaPessoa(texto: string, slug: string): { doc: string } | { frase: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(texto);
  } catch {
    return { frase: RASCUNHO_ILEGIVEL };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return { frase: RASCUNHO_ILEGIVEL };
  if (chavesForaDaPessoa(doc).length > 0) return { frase: FORA_DA_LISTA_DELA };
  if (obrigatoriosDaPessoaFaltando(doc).length > 0) return { frase: FALTA_DA_PESSOA };
  if ("horario" in doc) {
    const problema = problemaDasFaixas(faixasDe((doc as { horario: unknown }).horario));
    if (problema !== null) return { frase: problema };
  }
  const lido = fichaSchema.safeParse(doc);
  if (!lido.success) return { frase: FORMA_ERRADA };
  if (lido.data.slug !== slug) return { frase: SLUG_DE_DENTRO };
  return { doc: JSON.stringify(lido.data) };
}
```

- [ ] **Step 5: A rota**

`src/app/api/contribuir/publicar/route.ts`:

```ts
import { enderecoNovoDe, getClient, publicarRascunho, rascunhoDeQualquerUm, versaoAtual, versoesAtuais } from "@/lib/db";
import { lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { colisaoDoPar } from "@/lib/par-de-lugar";
import { violacaoIntroduzidaInteira } from "@/lib/porta-de-coerencia";
import { NADA_PUBLICADO, RASCUNHO_MUDOU } from "@/lib/porta-de-publicar";
import {
  JA_NO_AR_DA_PESSOA, NOME_JA_EM_USO, RASCUNHO_DELA_SUMIU, fraseDaPessoa, portaDaPessoa, prepararPublicacaoDaPessoa,
} from "@/lib/porta-da-pessoa";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;
const recusa = (status: 400 | 409, frase: string) => new Response(frase, { status, headers: TEXTO });

/** Por que o banco recusou — a régua de `porQueRecusou` do painel, com as
 *  frases DELA onde a do painel falaria do painel ou NOMEARIA quem ocupa (I3
 *  da pré-auditoria: o endereço ocupado por um lugar é `NOME_JA_EM_USO`, nunca
 *  `enderecoDeLugar`, que diz o nome de um lugar talvez escondido).
 *  `rascunhoDeQualquerUm`, e NÃO `lerRascunho`: desde 07/10 aquela é só do
 *  João, e o rascunho daqui é dela. O último ramo é o ruling do endereço
 *  antigo: o batch recusou porque o endereço virou antigo depois que o
 *  rascunho nasceu. */
async function porQueRecusou(slug: string, atualizadoEm: number): Promise<string> {
  const lugar = await versaoAtual(getClient(), slug);
  const r = await rascunhoDeQualquerUm(getClient(), slug);
  if (r !== null && r.atualizado_em !== atualizadoEm) return RASCUNHO_MUDOU;
  if (lugar !== null && r === null) return JA_NO_AR_DA_PESSOA;
  if (lugar !== null) return NOME_JA_EM_USO;
  if (r === null) return RASCUNHO_DELA_SUMIU;
  if ((await enderecoNovoDe(getClient(), slug)) !== null) return NOME_JA_EM_USO;
  return NADA_PUBLICADO;
}

/** PUBLICAR O LUGAR DELA (spec de 07/10, Parte 1): "no ar na hora, com a
 *  marca". A marca não é desta rota: é a linha de `origem_do_lugar` que
 *  `publicarRascunho` faz nascer NO MESMO batch da versão 1 (Task 1). */
export async function POST(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const c = corpo as { slug?: unknown; atualizadoEm?: unknown };
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) || Object.keys(corpo).length !== 2 ||
    typeof c.slug !== "string" || !Number.isSafeInteger(c.atualizadoEm) || (c.atualizadoEm as number) < 0
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const slug = c.slug;
  const atualizadoEm = c.atualizadoEm as number;

  const rascunho = await lerRascunhoDaPessoa(getClient(), slug, id);
  if (rascunho === null) {
    // Nem dela, nem existe: 404 — a não ser que ela mesma acabou de publicar
    // (duplo toque) ou o rascunho mudou de endereço: aí a frase explica.
    const lugar = await versaoAtual(getClient(), slug);
    if (lugar === null) return new Response("", { status: 404, headers: TEXTO });
    return recusa(409, await porQueRecusou(slug, atualizadoEm));
  }
  if (rascunho.atualizado_em !== atualizadoEm) return recusa(409, RASCUNHO_MUDOU);

  const preparo = prepararPublicacaoDaPessoa(rascunho.doc, slug);
  if ("frase" in preparo) return recusa(400, preparo.frase);
  const { doc } = preparo;

  // I3: a colisão estruturada, e a frase dela — nunca `parOcupado` (a do painel).
  const colisao = await colisaoDoPar(nomeDoRascunho(doc, ""), cidadeDoDoc(doc) ?? "", { exceto: slug, nomeNovo: true });
  if (colisao !== null) return recusa(409, NOME_JA_EM_USO);

  const violacao = violacaoIntroduzidaInteira(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, null, doc);
  if (violacao !== null) return recusa(409, fraseDaPessoa(violacao));

  if (await publicarRascunho(getClient(), slug, doc, agora, atualizadoEm, id)) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  return recusa(409, await porQueRecusou(slug, atualizadoEm));
}
```

⚠️ O duplo toque: o 2º pedido acha o rascunho apagado E o lugar no ar — e um lugar no ar no endereço pode ser de OUTRA pessoa (ou do João). A frase `JA_NO_AR_DA_PESSOA` não afirma que é o dela ("este endereço já é de um lugar do app"), a mesma cautela da frase do painel (M4 da auditoria da Tarefa 12).

- [ ] **Step 6: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/porta-da-pessoa.test.ts tests/api/route-contribuir-publicar.test.ts tests/api/route-admin-publicar.test.ts tests/api/route-admin-ficha.test.ts`
Expected: PASS (os dois últimos provam que a refatoração da coerência não mudou o painel).

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `prepararPublicacaoDaPessoa` sem o `chavesForaDaPessoa` | "documento com chave fora da lista (`voz`)…" e vizinhos |
| M2 | a rota usa `prepararPublicacao` (a do João) | "200: no ar NA HORA, não conferido, dela" (o do João exige voz etc.: 400) **e** "faltando obrigatório dela: 400 com a frase" (a frase é a do João) |
| M3 | a rota devolve `violacao.frase` | "a promessa IGUAL à de um lugar do João: … a frase DELA" |
| M4 | `fraseDaPessoa` devolve `v.frase` quando não há entrada | "regra sem frase dela: a de reserva" |
| M5 | a rota chama `publicarRascunho(…)` SEM o `id` | "200: no ar NA HORA, não conferido, dela" (o publicar recusa: o rascunho é dela) |
| M6 | a rota sem `violacaoIntroduzidaInteira` | "a promessa IGUAL…" **e** "o texto diz a hora de fechar…" |
| M7 | `lerRascunhoDaPessoa` trocado por `lerRascunho` na rota | "rascunho de OUTRA pessoa: 404" |
| M8 | uma chave de `FRASE_DA_PESSOA` com typo (`"texto-emprestad"`) | "toda chave de FRASE_DA_PESSOA é uma regra que existe" |
| M9 | a rota responde a colisão com `fraseDoPainel(colisao)` | "o nome de um lugar do João: 409 com a frase DELA" |
| M10 | `porQueRecusou` sem o ramo do `enderecoNovoDe` | "o endereço virou endereço antigo de outro lugar…" (cai no `NADA_PUBLICADO`) |
| M11 | `porQueRecusou` volta a `lerRascunho` (a do João) | "o endereço virou endereço antigo de outro lugar…" (o rascunho dela some da leitura e a frase vira `RASCUNHO_DELA_SUMIU`) |
- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/lib/porta-da-pessoa.ts src/lib/porta-de-coerencia.ts src/app/api/contribuir/publicar/route.ts tests/lib/porta-da-pessoa.test.ts tests/api/route-contribuir-publicar.test.ts
git commit -m "feat(contribuir): publicar o lugar de quem usa, no ar na hora e marcado"
node scripts/mutar.mjs
```

📝 **Frases novas:** `FALTA_DA_PESSOA`, `FORA_DA_LISTA_DELA`, `JA_NO_AR_DA_PESSOA`, `RECUSA_DA_PESSOA`, e as seis de `FRASE_DA_PESSOA`. (A colisão usa `NOME_JA_EM_USO`, da Task 10.)

---

### Task 12: `/api/contribuir/lugar` — ela edita o dela no ar, enquanto não conferido

**Files:**
- Modify: `src/lib/db-contribuidor.ts` — `gravarEdicaoDaPessoa`, `lugaresDaPessoa`
- Modify: `src/lib/campos-da-pessoa.ts` — `pontoDaPessoa`, `tirarCampoDaPessoa` (as formas pro documento NO AR, que passa pelo schema)
- Modify: `src/lib/porta-da-pessoa.ts` — frase `JA_CONFERIDO`
- Create: `src/app/api/contribuir/lugar/route.ts` (`PUT`)
- Test: `tests/lib/db-lugar-da-pessoa.test.ts`, `tests/api/route-contribuir-lugar.test.ts` (criar); `tests/lib/campos-da-pessoa.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `portaDaPessoa`, `fraseDaPessoa`, `ehCampoDaPessoa`, `OPCIONAIS_DA_PESSOA` (Tasks 10-11); `aplicarCampo`, `gravarPonto` de `@/lib/campos-da-ficha`; `violacaoIntroduzidaInteira` (Task 11); `colisaoDaMudanca` (Task 1) e `NOME_JA_EM_USO` (Task 10) — nunca `parDaMudanca`, a frase do painel (I3); `lugarDoDono` (Task 1); `baseIdValido`, `LUGAR_MUDOU_DE_ENDERECO` de `@/lib/endereco`; `clienteQueIntercala` de `tests/banco.ts`; `conferirLugar` (Task 6).
- Produces:
  - `src/lib/db-contribuidor.ts`:
    - `export async function gravarEdicaoDaPessoa(client: Client, slug: string, doc: string, agora: number, baseId: number, id: string): Promise<number | null>`
    - `export type LugarDaPessoa = { slug: string; doc: string; oculto: boolean; conferido: boolean }`
    - `export async function lugaresDaPessoa(client: Client, id: string): Promise<LugarDaPessoa[]>` — os publicados dela, o mais novo primeiro
  - `src/lib/campos-da-pessoa.ts`: `export function pontoDaPessoa(doc: string, lat: number, lng: number): string`; `export function tirarCampoDaPessoa(doc: string, caminho: string): string`
  - `PUT /api/contribuir/lugar` — os mesmos três corpos do rascunho, mais `baseId`: 200 · 400 · 401 · 403 · 404 · 409 · 503

🔴 **AS TRÊS CONDIÇÕES MORAM NO MESMO `INSERT`** (Review Focus 2): o lugar é DELA, ainda NÃO conferido, e ela não está bloqueada — mais a identidade pela versão da tela (`baseId`, a régua de `gravarEdicao`) e o `oculto` lido no próprio INSERT (esconder é do João; editar não devolve ao ar). Uma checagem antes ("é dela? não conferido?") e um INSERT depois deixariam a janela em que o "Conferi" do João cabe — e a aba velha dela regravaria um lugar que ele já conferiu.

🔴 **Nome e cidade mudam o DOCUMENTO, não o endereço.** Lugar no ar muda de endereço só quando o JOÃO manda (decisão de 04/10, Tarefa 11e). Se ela trocar o nome, o endereço fica — o painel dele mostra o aviso de sempre ("o endereço ainda diz X"), e a decisão é dele.

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/campos-da-pessoa.test.ts` (acrescentar):

```ts
import { pontoDaPessoa, tirarCampoDaPessoa } from "@/lib/campos-da-pessoa";

const NO_AR = JSON.stringify({ ...COMPLETO, avisos: "Leve água." });

describe("no lugar NO AR (passa pelo schema)", () => {
  it("pontoDaPessoa troca o ponto 0 E a coordenada da chuva", () => {
    const d = JSON.parse(pontoDaPessoa(NO_AR, -8.4, -36.0));
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.4, lng: -36.0 });
    expect(d.condicao.coords).toEqual({ lat: -8.4, lng: -36.0 });
  });

  it("tirarCampoDaPessoa tira `avisos`, e recusa obrigatório dela", () => {
    expect("avisos" in JSON.parse(tirarCampoDaPessoa(NO_AR, "avisos"))).toBe(false);
    expect(() => tirarCampoDaPessoa(NO_AR, "acesso")).toThrow();
  });
});
```

`tests/lib/db-lugar-da-pessoa.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historico, versaoAtual } from "@/lib/db";
import { conferirLugar, gravarEdicaoDaPessoa, lugaresDaPessoa } from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
let SLUG: string;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
});
afterEach(() => c.close());
const A = AGORA_SEMENTE + 100;
const base = async (s = SLUG) => (await versaoAtual(c, s))!.id;
const outroDoc = async () => JSON.stringify({ ...JSON.parse((await versaoAtual(c, SLUG))!.doc), promessa: "Nova." });

describe("gravarEdicaoDaPessoa", () => {
  it("grava, com autor 'contribuidor'", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), PESSOA.id)).not.toBeNull();
    const v = (await versaoAtual(c, SLUG))!;
    expect(JSON.parse(v.doc).promessa).toBe("Nova.");
    expect(v.autor).toBe("contribuidor");
  });

  it("OUTRA pessoa não grava no lugar dela", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), OUTRA.id)).toBeNull();
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("ninguém de fora grava em lugar do João", async () => {
    const doc = (await versaoAtual(c, "rampa-do-pepe"))!.doc;
    expect(await gravarEdicaoDaPessoa(c, "rampa-do-pepe", doc, A, await base("rampa-do-pepe"), PESSOA.id)).toBeNull();
  });

  it("depois do Conferi, ela não grava mais", async () => {
    await conferirLugar(c, SLUG, await base(), A);
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A + 1, await base(), PESSOA.id)).toBeNull();
    expect(await historico(c, SLUG)).toHaveLength(1);
  });

  it("bloqueada, ela não grava", async () => {
    await c.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, ?)", args: [PESSOA.id, A] });
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A + 1, await base(), PESSOA.id)).toBeNull();
  });

  it("editar lugar escondido não o devolve ao ar", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [SLUG] });
    await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base(), PESSOA.id);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("a versão da tela que não mora aqui não grava", async () => {
    expect(await gravarEdicaoDaPessoa(c, SLUG, await outroDoc(), A, await base("rampa-do-pepe"), PESSOA.id)).toBeNull();
  });
});

describe("lugaresDaPessoa", () => {
  it("só os dela, com conferido e oculto, o mais novo primeiro", async () => {
    const novo = await semearLugarDaPessoa(c, { nome: "Pedra Nova", cidade: "Cidade Teste", agora: AGORA_SEMENTE + 60 });
    await semearLugarDaPessoa(c, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
    await conferirLugar(c, SLUG, await base(), A);
    const l = await lugaresDaPessoa(c, PESSOA.id);
    expect(l.map((x) => [x.slug, x.conferido, x.oculto])).toEqual([[novo, false, false], [SLUG, true, false]]);
  });
});
```

`tests/api/route-contribuir-lugar.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { historico, versaoAtual } from "@/lib/db";
import { conferirLugar } from "@/lib/db-contribuidor";
import { JA_CONFERIDO, NOME_JA_EM_USO } from "@/lib/porta-da-pessoa";
import { clienteQueIntercala, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => cli }));

const AGORA = 1_758_300_000;
let c: Client;
let cli: Client;
let SLUG: string;
let PUT: typeof import("@/app/api/contribuir/lugar/route").PUT;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  cli = c;
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  sessao.atual = PESSOA;
  sessao.fora = false;
  vi.resetModules();
  PUT = (await import("@/app/api/contribuir/lugar/route")).PUT;
});
afterEach(() => { c.close(); vi.useRealTimers(); });

const base = async (s = SLUG) => (await versaoAtual(c, s))!.id;
const pedido = (corpo: unknown) => new Request("http://x/api/contribuir/lugar", { method: "PUT", body: JSON.stringify(corpo) });
const versoes = async () => (await historico(c, SLUG)).length;

describe("PUT /api/contribuir/lugar", () => {
  it("um campo dela: 200, versão nova dela", async () => {
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "De moto também." }));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).acesso).toBe("De moto também.");
    expect(await versoes()).toBe(2);
  });

  it.each(["voz", "condicao.regra.limiar_mm", "discriminador.como_ler", "custo.curto"])(
    "campo fora da lista dela (`%s`): 400, nada gravado",
    async (campo) => {
      const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo, valor: campo.endsWith("limiar_mm") ? 1 : "x" }));
      expect(res.status).toBe(400);
      expect(await versoes()).toBe(1);
    },
  );

  it("o ponto troca o ponto 0 e a chuva juntos", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), ponto: 0, lat: -8.4, lng: -36.0 }));
    const d = JSON.parse((await versaoAtual(c, SLUG))!.doc);
    expect(d.condicao.coords).toEqual({ lat: -8.4, lng: -36.0 });
    expect(d.trajeto.waypoints[0]).toMatchObject({ lat: -8.4, lng: -36.0 });
  });

  it("trocar o nome muda o documento e NÃO o endereço", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Pedra Renomeada" }));
    expect(JSON.parse((await versaoAtual(c, SLUG))!.doc).trajeto.waypoints[0].nome).toBe("Pedra Renomeada");
    expect(await versaoAtual(c, "pedra-renomeada-cidade-teste")).toBeNull();
  });

  // I3 da pré-auditoria: renomear pro nome de um lugar do João (o gêmeo sem
  // cidade) é 409 com a frase DELA — nunca "responda a cidade dele, pela lista
  // do painel" —, e nada é gravado.
  it("renomear pro nome de um lugar do João: 409 com a frase dela, nada gravado", async () => {
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "trajeto.waypoints.0.nome", valor: "Rampa do Pepê" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(NOME_JA_EM_USO);
    expect(await versoes()).toBe(1);
  });

  it("lugar de OUTRA pessoa, ou do João: 404, nada gravado", async () => {
    sessao.atual = OUTRA;
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }))).status).toBe(404);
    sessao.atual = PESSOA;
    expect((await PUT(pedido({ slug: "rampa-do-pepe", baseId: await base("rampa-do-pepe"), campo: "acesso", valor: "x" }))).status).toBe(404);
    expect(await versoes()).toBe(1);
  });

  it("depois do Conferi: 409 com a frase, nada gravado", async () => {
    await conferirLugar(c, SLUG, await base(), AGORA - 1);
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(res.status).toBe(409);
    expect(await res.text()).toBe(JA_CONFERIDO);
    expect(await versoes()).toBe(1);
  });

  // 🔴 Review Focus 2: o João toca "Conferi" DEPOIS que a rota leu o lugar e
  // ANTES de gravar. A condição mora no INSERT, então nada grava.
  it("a corrida com o Conferi: 409, nada gravado", async () => {
    const corrida = clienteQueIntercala(c, /^INSERT INTO ficha_versoes/, async () => {
      await conferirLugar(c, SLUG, await base(), AGORA - 1);
    });
    cli = corrida.cliente;
    const res = await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }));
    expect(corrida.disparos(), "o dublê não disparou: o teste mediu o vazio").toBe(1);
    expect(res.status).toBe(409);
    expect(await versoes()).toBe(1);
  });

  it("sem baseId: 400; sem sessão: 401; bloqueada: 403 — nada gravado", async () => {
    expect((await PUT(pedido({ slug: SLUG, campo: "acesso", valor: "x" }))).status).toBe(400);
    sessao.atual = null;
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }))).status).toBe(401);
    sessao.atual = PESSOA;
    await c.execute({ sql: "UPDATE contribuidores SET bloqueado = 1 WHERE id = ?", args: [PESSOA.id] });
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", valor: "x" }))).status).toBe(403);
    expect(await versoes()).toBe(1);
  });

  it("'não sei' em `avisos` tira a chave; em `acesso`, 400", async () => {
    await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "avisos", valor: "Leve água." }));
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "avisos", naoSei: true }))).status).toBe(200);
    expect("avisos" in JSON.parse((await versaoAtual(c, SLUG))!.doc)).toBe(false);
    expect((await PUT(pedido({ slug: SLUG, baseId: await base(), campo: "acesso", naoSei: true }))).status).toBe(400);
  });
});
```

(Confira que o `semearAcervo` + `semearLugarDaPessoa` registrou a pessoa em `contribuidores` antes do `UPDATE … bloqueado = 1`: a porta da rota a registra no 1º pedido; se o `UPDATE` não pegar linha, troque por `INSERT … ON CONFLICT(id) DO UPDATE SET bloqueado = 1`.)

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/campos-da-pessoa.test.ts tests/lib/db-lugar-da-pessoa.test.ts tests/api/route-contribuir-lugar.test.ts`
Expected: FAIL.

- [ ] **Step 3: As formas do documento no ar**

`src/lib/campos-da-pessoa.ts` (importe `aplicarCampo`, `gravarPonto` de `@/lib/campos-da-ficha`; `fichaSchema` de `@/types/ficha`):

```ts
/** O ponto DELA no lugar NO AR: o ponto 0 e a coordenada da chuva juntos, e o
 *  documento inteiro passa pelo schema (as duas funções do registro já fazem). */
export function pontoDaPessoa(doc: string, lat: number, lng: number): string {
  return aplicarCampo(gravarPonto(doc, 0, lat, lng), "condicao.coords", { lat, lng });
}

/** O "não sei" DELA no lugar NO AR — os opcionais da lista DELA (o
 *  `removerCampo` do registro recusaria `avisos`, obrigatório pro João). */
export function tirarCampoDaPessoa(doc: string, caminho: string): string {
  return JSON.stringify(fichaSchema.parse(JSON.parse(tirarDoRascunhoDaPessoa(doc, caminho))));
}
```

- [ ] **Step 4: As funções de banco**

`src/lib/db-contribuidor.ts`:

```ts
/** A EDIÇÃO DELA, no lugar dela no ar — a régua de `gravarEdicao` (identidade
 *  pela versão da tela; `oculto` lido no próprio INSERT) e mais três condições,
 *  TODAS no mesmo statement (Review Focus 2): o lugar é dela, ainda não
 *  conferido, e ela não está bloqueada. `null` = nada gravado. */
export async function gravarEdicaoDaPessoa(
  client: Client, slug: string, doc: string, agora: number, baseId: number, id: string,
): Promise<number | null> {
  const r = await client.execute({
    sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
          SELECT ?, ?, 'contribuidor', ?,
                 (SELECT oculto FROM ficha_versoes WHERE ficha_slug = ? ORDER BY id DESC LIMIT 1)
          WHERE EXISTS (SELECT 1 FROM ficha_versoes WHERE id = ? AND ficha_slug = ?)
            AND EXISTS (SELECT 1 FROM origem_do_lugar
                         WHERE lugar = ${IDENTIDADE("?")} AND contribuidor = ? AND conferido <> 1)
            AND ${LIVRE}
          RETURNING id`,
    args: [slug, doc, agora, slug, baseId, slug, slug, id, id],
  });
  return r.rows.length ? Number(r.rows[0].id) : null;
}

export type LugarDaPessoa = { slug: string; doc: string; oculto: boolean; conferido: boolean };

/** Os lugares que ELA publicou, onde moram agora, o mais novo primeiro —
 *  escondidos inclusive (ela vê que estão fora do ar; quem os escondeu foi o
 *  João). */
export async function lugaresDaPessoa(client: Client, id: string): Promise<LugarDaPessoa[]> {
  const r = await client.execute({
    sql: `SELECT v.ficha_slug AS slug, v.doc, v.oculto, o.conferido
            FROM origem_do_lugar o
            JOIN ficha_versoes v
              ON v.id = (SELECT MAX(j.id) FROM ficha_versoes j
                          WHERE j.ficha_slug = (SELECT f.ficha_slug FROM ficha_versoes f WHERE f.id = o.lugar))
           WHERE o.contribuidor = ?
           ORDER BY o.lugar DESC`,
    args: [id],
  });
  return r.rows.map((l) => ({
    slug: String(l.slug), doc: String(l.doc), oculto: Number(l.oculto) === 1, conferido: Number(l.conferido) === 1,
  }));
}
```

- [ ] **Step 5: A frase e a rota**

`src/lib/porta-da-pessoa.ts`:

```ts
// PENDENTE: redação minha, o João ainda não leu
export const JA_CONFERIDO = "Nada foi gravado: o BatePerna já conferiu este lugar, e agora só ele muda o que o app diz daqui.";
```

`src/app/api/contribuir/lugar/route.ts`:

```ts
import { aplicarCampo, type ValorDeCampo } from "@/lib/campos-da-ficha";
import { ehCampoDaPessoa, pontoDaPessoa, tirarCampoDaPessoa } from "@/lib/campos-da-pessoa";
import { getClient, lugarDoDono, versoesAtuais } from "@/lib/db";
import { estaBloqueado, gravarEdicaoDaPessoa } from "@/lib/db-contribuidor";
import { LUGAR_MUDOU_DE_ENDERECO, baseIdValido } from "@/lib/endereco";
import { colisaoDaMudanca } from "@/lib/par-de-lugar";
import { violacaoIntroduzidaInteira } from "@/lib/porta-de-coerencia";
import { BLOQUEADA, JA_CONFERIDO, NOME_JA_EM_USO, fraseDaPessoa, portaDaPessoa } from "@/lib/porta-da-pessoa";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

function recusar400(erro: unknown): Response {
  const nossa = erro instanceof Error && erro.constructor === Error;
  return new Response(nossa ? erro.message : "", { status: 400, headers: TEXTO });
}

/** ELA EDITA O DELA, NO AR, ENQUANTO NÃO CONFERIDO (spec de 07/10, Parte 1).
 *  Os corpos são os do rascunho, mais `baseId` (a versão que a tela abriu). A
 *  leitura de antes ESCOLHE a frase (404 / 409); quem DECIDE é o INSERT de
 *  `gravarEdicaoDaPessoa` — e quando ele recusa, a rota relê pra dizer por quê. */
export async function PUT(req: Request): Promise<Response> {
  const agora = Math.floor(Date.now() / 1000);
  const porta = await portaDaPessoa(agora);
  if ("resposta" in porta) return porta.resposta;
  const id = porta.pessoa.id;

  let corpo: Record<string, unknown> | null;
  try {
    const b: unknown = await req.json();
    corpo = typeof b === "object" && b !== null && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    corpo = null;
  }
  if (corpo === null || typeof corpo.slug !== "string" || !baseIdValido(corpo.baseId)) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const { slug, baseId, campo, valor, naoSei, ponto, lat, lng } = corpo as Record<string, unknown> & { slug: string; baseId: number };
  const trazCampo = "campo" in corpo || "valor" in corpo || "naoSei" in corpo;
  const trazPonto = "ponto" in corpo || "lat" in corpo || "lng" in corpo;
  if (trazCampo === trazPonto) return new Response("", { status: 400, headers: TEXTO });

  let mudar: (doc: string) => string;
  if (trazPonto) {
    if (ponto !== 0 || typeof lat !== "number" || typeof lng !== "number") return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => pontoDaPessoa(doc, lat, lng);
  } else {
    const trazValor = "valor" in corpo;
    const trazNaoSei = "naoSei" in corpo;
    if (trazValor === trazNaoSei || (trazNaoSei && naoSei !== true)) return new Response("", { status: 400, headers: TEXTO });
    if (!ehCampoDaPessoa(campo)) return new Response("", { status: 400, headers: TEXTO });
    mudar = (doc) => (trazNaoSei ? tirarCampoDaPessoa(doc, campo) : aplicarCampo(doc, campo, valor as ValorDeCampo));
  }

  const lugar = await lugarDoDono(getClient(), slug);
  if (lugar === null || lugar.origem.contribuidor !== id) return new Response("", { status: 404, headers: TEXTO });
  if (lugar.origem.conferido) return new Response(JA_CONFERIDO, { status: 409, headers: TEXTO });

  // I3: a colisão estruturada, e a frase DELA (nunca a do painel, que nomeia quem ocupa).
  if ((await colisaoDaMudanca(lugar.versao.doc, slug, campo, valor)) !== null) {
    return new Response(NOME_JA_EM_USO, { status: 409, headers: TEXTO });
  }

  let novo: string;
  try {
    novo = mudar(lugar.versao.doc);
  } catch (erro) {
    return recusar400(erro);
  }
  const violacao = violacaoIntroduzidaInteira(await versoesAtuais(getClient(), { incluirOcultos: true }), slug, lugar.versao.doc, novo);
  if (violacao !== null) return new Response(fraseDaPessoa(violacao), { status: 409, headers: TEXTO });

  if ((await gravarEdicaoDaPessoa(getClient(), slug, novo, agora, baseId, id)) !== null) {
    return Response.json({ slug }, { headers: { "cache-control": "no-store" } });
  }
  // Recusou no INSERT: o que mudou entre a leitura e a gravação?
  const depois = await lugarDoDono(getClient(), slug);
  if (depois?.origem.conferido) return new Response(JA_CONFERIDO, { status: 409, headers: TEXTO });
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  return new Response(LUGAR_MUDOU_DE_ENDERECO, { status: 409, headers: TEXTO });
}
```

(`colisaoDaMudanca` recebe `exceto: slug` por dentro — confira que, num lugar NO AR, ela não acusa o próprio lugar; o teste "trocar o nome" prova.)

- [ ] **Step 6: Rodar e confirmar que passam**

Run: `npx vitest run tests/lib/campos-da-pessoa.test.ts tests/lib/db-lugar-da-pessoa.test.ts tests/api/route-contribuir-lugar.test.ts`
Expected: PASS.

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `gravarEdicaoDaPessoa` sem `AND conferido <> 1` | "depois do Conferi, ela não grava mais" **e** "a corrida com o Conferi" |
| M2 | `gravarEdicaoDaPessoa` sem `AND contribuidor = ?` | "OUTRA pessoa não grava no lugar dela" |
| M3 | `gravarEdicaoDaPessoa` sem `${LIVRE}` | "bloqueada, ela não grava" |
| M4 | `gravarEdicaoDaPessoa` com `oculto` literal `0` | "editar lugar escondido não o devolve ao ar" |
| M5 | a rota grava por `gravarEdicao` (a do painel) | "a corrida com o Conferi" **e** "OUTRA pessoa…" (rota: 404 vem da leitura; a corrida pega) |
| M6 | a rota sem `ehCampoDaPessoa` | "campo fora da lista dela (`voz`)…" |
| M7 | a rota troca o endereço quando o nome muda (chama `trocarEndereco`) | "trocar o nome muda o documento e NÃO o endereço" |
| M8 | `lugaresDaPessoa` com `ORDER BY o.lugar ASC` | "só os dela … o mais novo primeiro" |
| M9 | a rota sem `colisaoDaMudanca` | "renomear pro nome de um lugar do João: 409 com a frase dela" (sem o par, grava: 200) |
| M10 | a rota responde a colisão com `fraseDoPainel(colisao)` | "renomear pro nome de um lugar do João: 409 com a frase dela" |

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/lib/db-contribuidor.ts src/lib/campos-da-pessoa.ts src/lib/porta-da-pessoa.ts src/app/api/contribuir/lugar/route.ts tests/lib/campos-da-pessoa.test.ts tests/lib/db-lugar-da-pessoa.test.ts tests/api/route-contribuir-lugar.test.ts
git commit -m "feat(contribuir): ela edita o lugar dela no ar ate o Conferi, decidido no proprio INSERT"
node scripts/mutar.mjs
```

📝 **Frase nova:** `JA_CONFERIDO`.

---

### Task 13: O formulário do painel aprende a servir quem usa — sem mudar o do João

**Files:**
- Modify: `src/app/admin/novo/enderecos.ts` (a tabela de endereços por `onde`)
- Modify: `src/app/admin/campos/gravar.ts` (`PortaDoEditor` ganha `recarregarSe401`; `usarGravacao` o respeita)
- Modify: `src/app/admin/FormularioDeLugar.tsx` (`FormularioDeLugar`, `ComecarLugarNovo` e o `Pergunta` recebem `onde`; `INSTRUMENTO` e `Pergunta` passam a ser exportados)
- Modify: `src/app/admin/TelaDePublicar.tsx`, `src/app/admin/BotaoDesistir.tsx` (`onde`)
- Test: `tests/app/formulario-da-pessoa.test.tsx` (criar); `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI` ganha `AVISO_PUBLICAR_PESSOA` — I1)

**Interfaces:**
- Consumes: nada novo — são client components do painel.
- Produces:
  - `src/app/admin/novo/enderecos.ts`:
    - `export type Onde = "painel" | "contribuir"`
    - `export const ROTAS: Readonly<Record<Onde, { rascunhoApi: string; publicarApi: string; pergunta: (slug: string, n: number) => string; publicar: (slug: string) => string; comecou: (slug: string) => string; publicou: (slug: string) => string; desistiu: string; recarregarSe401: boolean }>>`
    - `enderecoDaPergunta`/`enderecoDePublicar` continuam, e são `ROTAS.painel.pergunta`/`.publicar`
  - `PortaDoEditor` value ganha `recarregarSe401: boolean` (padrão `false`)
  - `FormularioDeLugar`, `ComecarLugarNovo`, `TelaDePublicar`, `BotaoDesistir`: prop opcional `onde?: Onde` (padrão `"painel"`)
  - `export const AVISO_PUBLICAR_PESSOA` em `TelaDePublicar.tsx`

🔴 **Por que `onde` é uma STRING e não uma função de endereço.** Os quatro são client components, e a página que os monta é de servidor: props que atravessam essa fronteira têm de ser serializáveis — função não atravessa. A tabela mora no módulo cliente (`enderecos.ts`, que já é importado pelos dois lados), e a página só diz QUAL linha.

🔴 **401 recarrega, só pra ela** (Review Focus 4). Na tela da pessoa, sessão vencida no meio é o caminho normal (o Clerk expira); recarregar leva a página de servidor a chamar `irPraEntrar`, e o Clerk a devolve ao MESMO endereço — o `?p=N` da pergunta inclusive. O painel do João não muda: lá o 401 continua mostrando "Não consegui salvar.", como hoje.

- [ ] **Step 1: Escrever os testes que falham**

`tests/app/formulario-da-pessoa.test.tsx`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import FormularioDeLugar, { ComecarLugarNovo } from "@/app/admin/FormularioDeLugar";
import TelaDePublicar, { AVISO_PUBLICAR, AVISO_PUBLICAR_PESSOA, PUBLICAR } from "@/app/admin/TelaDePublicar";
import BotaoDesistir, { DESISTIR, DESISTIR_MESMO } from "@/app/admin/BotaoDesistir";
import { PortaDoEditor, usarGravacao } from "@/app/admin/campos/gravar";
import { ROTAS, enderecoDaPergunta, enderecoDePublicar } from "@/app/admin/novo/enderecos";
import type { PerguntaNaTela } from "@/app/admin/campos/tipos";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function navegacaoFalsa() {
  const assign = vi.fn();
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign, reload });
  return { assign, reload };
}

const PERGUNTA: PerguntaNaTela = {
  especie: "prosa",
  campo: { caminho: "promessa", rotulo: "A promessa", obrigatorio: true },
  texto: "Em uma frase, por que alguém pegaria o carro pra ir até aí?",
  valor: undefined,
};

describe("a tabela de endereços", () => {
  it("a linha do painel é a de sempre", () => {
    expect(ROTAS.painel.pergunta("a-b", 3)).toBe(enderecoDaPergunta("a-b", 3));
    expect(ROTAS.painel.publicar("a-b")).toBe(enderecoDePublicar("a-b"));
    expect(ROTAS.painel.rascunhoApi).toBe("/api/admin/rascunho");
    expect(ROTAS.painel.recarregarSe401).toBe(false);
  });

  it("a linha dela leva às rotas e telas DELA, e publicar leva à página pública", () => {
    expect(ROTAS.contribuir.rascunhoApi).toBe("/api/contribuir/rascunho");
    expect(ROTAS.contribuir.publicarApi).toBe("/api/contribuir/publicar");
    expect(ROTAS.contribuir.pergunta("a-b", 3)).toBe("/contribuir/novo?slug=a-b&p=3");
    expect(ROTAS.contribuir.publicar("a-b")).toBe("/contribuir/novo/publicar?slug=a-b");
    expect(ROTAS.contribuir.publicou("a-b")).toBe("/a-b");
    expect(ROTAS.contribuir.desistiu).toBe("/contribuir");
    expect(ROTAS.contribuir.recarregarSe401).toBe(true);
  });
});

describe("o formulário com onde='contribuir'", () => {
  it("o 'Próxima' da última pergunta leva à tela de publicar DELA", () => {
    const { container } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false]} onde="contribuir" />);
    expect(container.querySelector(".adm-novo-passo-proxima")?.getAttribute("href")).toBe("/contribuir/novo/publicar?slug=a-b");
  });

  it("os saltos levam às perguntas DELA", () => {
    const { container } = render(<FormularioDeLugar slug="a-b" pergunta={PERGUNTA} posicao={1} respondidas={[false, true]} onde="contribuir" />);
    expect(container.querySelector('[data-testid="saltos"] a')?.getAttribute("href")).toBe("/contribuir/novo?slug=a-b&p=1");
  });

  it("começar manda pra rota dela e abre a pergunta 1 dela", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "a-b" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<ComecarLugarNovo perguntas={{ nome: "N", cidade: "C" }} onde="contribuir" />);
    fireEvent.change(container.querySelectorAll("input")[0], { target: { value: "A" } });
    fireEvent.change(container.querySelectorAll("input")[1], { target: { value: "B" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contribuir/novo?slug=a-b"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });

  it("publicar manda pra rota dela, com o aviso DELA, e leva à página pública do lugar", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: "a-b" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container, getByRole } = render(<TelaDePublicar slug="a-b" atualizadoEm={1} frases={[]} onde="contribuir" />);
    expect(container.textContent).toContain(AVISO_PUBLICAR_PESSOA);
    expect(container.textContent).not.toContain(AVISO_PUBLICAR);
    fireEvent.click(getByRole("button", { name: PUBLICAR }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/a-b"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/publicar");
  });

  it("desistir apaga pela rota dela e volta à lista dela", async () => {
    const { assign } = navegacaoFalsa();
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { getByRole } = render(<BotaoDesistir slug="a-b" voltarAoPainel onde="contribuir" />);
    fireEvent.click(getByRole("button", { name: DESISTIR }));
    fireEvent.click(getByRole("button", { name: DESISTIR_MESMO }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/contribuir"));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/contribuir/rascunho");
  });
});

describe("401 — a sessão dela venceu no meio (Review Focus 4)", () => {
  function Gravador() {
    const g = usarGravacao();
    return <><button onClick={() => void g.gravar({ slug: "a-b", campo: "promessa", valor: "x" })}>gravar</button>{g.erro && <p role="alert">{g.erro}</p>}</>;
  }

  it("com recarregarSe401, o 401 recarrega a página (o Clerk pede login e devolve à mesma pergunta)", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole } = render(
      <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/rascunho", previa: false, depoisDeGravar: null, recarregarSe401: true }}>
        <Gravador />
      </PortaDoEditor.Provider>,
    );
    fireEvent.click(getByRole("button", { name: "gravar" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("no painel (padrão), o 401 continua sendo 'Não consegui salvar.' — nada muda pro João", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole, findByRole } = render(<Gravador />);
    fireEvent.click(getByRole("button", { name: "gravar" }));
    expect((await findByRole("alert")).textContent).toBe("Não consegui salvar.");
    expect(reload).not.toHaveBeenCalled();
  });

  it("a tela de publicar dela também recarrega no 401", async () => {
    const { reload } = navegacaoFalsa();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const { getByRole } = render(<TelaDePublicar slug="a-b" atualizadoEm={1} frases={[]} onde="contribuir" />);
    fireEvent.click(getByRole("button", { name: PUBLICAR }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/app/formulario-da-pessoa.test.tsx`
Expected: FAIL — `ROTAS` não existe; `onde` é ignorado.

- [ ] **Step 3: A tabela**

`src/app/admin/novo/enderecos.ts` (o comentário de hoje fica):

```ts
const e = encodeURIComponent;

export type Onde = "painel" | "contribuir";

/** OS ENDEREÇOS DO FORMULÁRIO DE LUGAR NOVO, por quem o usa (07/10). O
 *  formulário é UM (os mesmos editores, as mesmas perguntas); muda pra onde ele
 *  grava e pra onde ele leva. É uma tabela num módulo cliente porque quem a
 *  escolhe é uma página de SERVIDOR, e função não atravessa essa fronteira —
 *  a página passa só a CHAVE (`onde`). */
export const ROTAS = {
  painel: {
    rascunhoApi: "/api/admin/rascunho",
    publicarApi: "/api/admin/publicar",
    pergunta: (slug: string, n: number) => `/admin/novo?slug=${e(slug)}&p=${n}`,
    publicar: (slug: string) => `/admin/novo/publicar?slug=${e(slug)}`,
    comecou: (slug: string) => `/admin/novo?slug=${e(slug)}`,
    publicou: (slug: string) => `/admin/${e(slug)}`,
    desistiu: "/admin",
    recarregarSe401: false,
  },
  contribuir: {
    rascunhoApi: "/api/contribuir/rascunho",
    publicarApi: "/api/contribuir/publicar",
    pergunta: (slug: string, n: number) => `/contribuir/novo?slug=${e(slug)}&p=${n}`,
    publicar: (slug: string) => `/contribuir/novo/publicar?slug=${e(slug)}`,
    comecou: (slug: string) => `/contribuir/novo?slug=${e(slug)}`,
    // Publicou: a pessoa vê o lugar como o público vê — com a marca.
    publicou: (slug: string) => `/${e(slug)}`,
    desistiu: "/contribuir",
    recarregarSe401: true,
  },
} as const satisfies Record<Onde, unknown>;

export const enderecoDaPergunta = ROTAS.painel.pergunta;
export const enderecoDePublicar = ROTAS.painel.publicar;
```

- [ ] **Step 4: O 401 no `usarGravacao`**

`src/app/admin/campos/gravar.ts`:

```ts
export const PortaDoEditor = createContext<{
  gravarEm: string;
  previa: boolean;
  depoisDeGravar: ((slug: string) => string) | null;
  /** 07/10: na tela de QUEM USA, 401 é a sessão do Clerk que venceu — a tela
   *  recarrega, a página pede login e volta ao mesmo endereço. No painel do
   *  João fica `false`, e o 401 continua sendo "Não consegui salvar.". */
  recarregarSe401: boolean;
}>({
  gravarEm: "/api/admin/ficha",
  previa: true,
  depoisDeGravar: null,
  recarregarSe401: false,
});
```

e em `usarGravacao`, logo depois do `fetch` (lendo `recarregarSe401` do mesmo `useContext`):

```ts
      if (r.status === 401 && recarregarSe401) { location.reload(); return; }
```

(Os `PortaDoEditor.Provider` que já existem ganham `recarregarSe401: false` — o `tsc` aponta onde.)

- [ ] **Step 5: Os quatro componentes recebem `onde`**

`src/app/admin/FormularioDeLugar.tsx`:
- `export const INSTRUMENTO …` e `export function Pergunta …` (a Task 14 os usa na edição dela).
- `FormularioDeLugar({ slug, pergunta, posicao, respondidas, onde = "painel" }: { …; onde?: Onde })`, e dentro:
  ```tsx
  const rotas = ROTAS[onde];
  const ir = (n: number): string => rotas.pergunta(slug, n);
  …
  const porta = {
    gravarEm: rotas.rascunhoApi,
    previa: false,
    depoisDeGravar: (novo: string) => rotas.pergunta(novo, destino),
    recarregarSe401: rotas.recarregarSe401,
  };
  …
  <BotaoDesistir slug={slug} voltarAoPainel onde={onde} />
  …
  <a className="adm-novo-passo adm-novo-passo-proxima" href={proxima ?? rotas.publicar(slug)}>
  ```
- `ComecarLugarNovo({ perguntas, onde = "painel" })`: `fetch(ROTAS[onde].rascunhoApi, …)`; no sucesso `location.assign(ROTAS[onde].comecou(slug))`; e `if (r.status === 401 && ROTAS[onde].recarregarSe401) { location.reload(); return; }` antes de ler a frase.

`src/app/admin/TelaDePublicar.tsx`:

```tsx
// PENDENTE: redação minha, o João ainda não leu
export const AVISO_PUBLICAR_PESSOA =
  "Publicar põe este lugar no ar na hora, pra quem abrir o app — marcado como não conferido até o BatePerna conferir.";
```

e `TelaDePublicar({ …, onde = "painel" })`: `fetch(ROTAS[onde].publicarApi, …)`; sucesso → `location.assign(ROTAS[onde].publicou(slug))`; o mesmo `if (r.status === 401 && …) reload`; e `<p className="adm-publicar-aviso">{onde === "contribuir" ? AVISO_PUBLICAR_PESSOA : AVISO_PUBLICAR}</p>`.

`src/app/admin/BotaoDesistir.tsx`: `BotaoDesistir({ slug, voltarAoPainel = false, onde = "painel" })`: `fetch(ROTAS[onde].rascunhoApi, { method: "DELETE", … })`; sucesso com `voltarAoPainel` → `location.assign(ROTAS[onde].desistiu)`; e o `reload` no 401 como os outros.

- [ ] **Step 6: O controle de completude do cerco, e rodar — o do João não mudou**

🔴 **I1 da pré-auditoria** (o porquê está na Task 6, Step 7). `AVISO_PUBLICAR_PESSOA` mora em `src/app/admin/TelaDePublicar.tsx` e entra em `CUNHADAS_AQUI` de `tests/app/admin-editores-de-campo.test.tsx` — junte-a ao import que já existe de `@/app/admin/TelaDePublicar` (o que traz `AVISO_PUBLICAR`) e acrescente ao fim do arranjo:

```ts
    // Task 13 (07/10): o aviso da tela de publicar DE QUEM USA. Só aparece com
    // `onde="contribuir"` — nunca no painel do João, nunca nas três fichas.
    AVISO_PUBLICAR_PESSOA,
```

Run: `npx vitest run tests/app/formulario-da-pessoa.test.tsx tests/app/admin-formulario-de-lugar.test.tsx tests/app/admin-tela-de-publicar.test.tsx tests/app/admin-desistir.test.tsx tests/app/admin-editores-de-campo.test.tsx tests/app/admin-desfazer.test.tsx`
Expected: PASS — os arquivos do painel sem edição de asserção (só `recarregarSe401: false` onde montam um `Provider` à mão, e a frase nova em `CUNHADAS_AQUI`).

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `FormularioDeLugar` ignora `onde` (usa `ROTAS.painel`) | "o 'Próxima' da última pergunta leva à tela de publicar DELA" |
| M2 | `ROTAS.contribuir.publicou` leva a `/contribuir` | "publicar … leva à página pública do lugar" |
| M3 | `usarGravacao` recarrega no 401 sempre | "no painel (padrão), o 401 continua sendo 'Não consegui salvar.'" |
| M4 | `usarGravacao` nunca recarrega | "com recarregarSe401, o 401 recarrega" |
| M5 | `TelaDePublicar` mostra `AVISO_PUBLICAR` sempre | "publicar … com o aviso DELA" |
| M6 | `BotaoDesistir` apaga por `/api/admin/rascunho` sempre | "desistir apaga pela rota dela" |

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/app/admin/novo/enderecos.ts src/app/admin/campos/gravar.ts src/app/admin/FormularioDeLugar.tsx src/app/admin/TelaDePublicar.tsx src/app/admin/BotaoDesistir.tsx tests/app/formulario-da-pessoa.test.tsx tests/app/admin-editores-de-campo.test.tsx
# + os testes do painel que ganharam `recarregarSe401: false`, por caminho
git commit -m "feat(formulario): o formulario de lugar novo serve quem usa, sem mudar o do painel"
node scripts/mutar.mjs
```

📝 **Frase nova:** `AVISO_PUBLICAR_PESSOA`.

---

### Task 14: As telas dela — "+ mandar um lugar", as oito perguntas, "Meus lugares", editar o dela

**Files:**
- Create: `src/app/contribuir/sessao.ts` (a porta das PÁGINAS dela), `src/app/contribuir/perguntas.ts` (as perguntas dela, montadas das do painel), `src/app/contribuir/palavras.ts` (as palavras das telas dela — página do Next não exporta nada além do que o Next aceita)
- Create: `src/app/contribuir/page.tsx` ("Meus lugares"), `src/app/contribuir/novo/page.tsx`, `src/app/contribuir/novo/publicar/page.tsx`, `src/app/contribuir/[slug]/page.tsx` (editar o dela no ar)
- Create: `src/app/contribuir/EdicaoDaPessoa.tsx` (cliente)
- Modify: `src/app/BarraNavegacao.tsx` (a entrada "+ mandar um lugar")
- Modify: `src/lib/rascunho.ts:43` (`SLUGS_RESERVADOS` ganha `"contribuir"`), `src/lib/despacho.ts:2` (`RESERVADOS` ganha `"contribuir"`), `src/app/sw.ts` (`/contribuir` nunca vira cache)
- Test: `tests/app/contribuir-telas.test.tsx` (criar); `tests/app/BarraNavegacao.test.tsx`, `tests/app/sw.test.ts`, `tests/lib/despacho.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `lerContribuidor`, `irPraEntrar` (Task 9); `estaBloqueado`, `lerRascunhoDaPessoa`, `rascunhosDaPessoa`, `lugaresDaPessoa` (Tasks 10, 12); `CLERK_FORA`, `BLOQUEADA`, `JA_CONFERIDO` (Tasks 10, 12); `obrigatoriosDaPessoaFaltando`, `OPCIONAIS_DA_PESSOA`, `PONTO` (Task 10); `montarPerguntas`, `escolherPosicao`, `PERGUNTAS` de `src/app/admin/novo/perguntas.ts`; `FormularioDeLugar`, `ComecarLugarNovo`, `TelaDePublicar`, `Pergunta` (Task 13); `ComVersaoDaTela`, `PortaDoEditor`; `lugarDoDono`; `vistaDaCoordSemPonto`, `FONTES_DE_PRODUCAO`; `ETIQUETA_NAO_CONFERIDO`; `ESCONDIDO` de `src/app/admin/campos/palavras.ts`; `TITULO_RASCUNHOS` de `src/app/admin/ListaDeLugares.tsx`.
- Produces:
  - `src/app/contribuir/sessao.ts`: `export async function quemNaTela(): Promise<{ pessoa: QuemContribui } | { frase: string }>` (sem sessão → `irPraEntrar()`, que não volta)
  - `src/app/contribuir/perguntas.ts`: `export const ORDEM_DA_PESSOA: readonly string[]`; `export function montarPerguntasDaPessoa(doc: unknown): PerguntaNaTela[]`
  - as quatro páginas; `EdicaoDaPessoa` (props `{ slug: string; versaoId: number; perguntas: PerguntaNaTela[] }`)
  - `src/app/BarraNavegacao.tsx`: `export const MANDAR_UM_LUGAR` — o item da barra leva a **`/contribuir`** ("Meus lugares"), não a `/contribuir/novo` (I5)
  - `src/app/contribuir/palavras.ts`: `MANDAR_UM_LUGAR_NOVO` (o link do TOPO de "Meus lugares" pra `/contribuir/novo`), `TITULO_MEUS`, `CONFERIDO`, `MUDAR`, `TITULO_MANDAR`

🔴 **"+ mandar um lugar" leva a `/contribuir`, que É "Meus lugares", com "+ mandar um lugar novo" no topo** (I5 da pré-auditoria, ruling). Assim a lista dela tem entrada na tela — e toda frase que manda "voltar pela sua lista de lugares" (`RASCUNHO_DELA_SUMIU`) ou "conferir na sua lista de lugares" (`JA_NO_AR_DA_PESSOA`) tem destino: a barra. Uma tela faz as duas funções; quem nunca mandou nada vê a lista vazia e o link de mandar no topo. As duas palavras são DIFERENTES de propósito (M10): a barra diz "+ mandar um lugar" e leva à lista; o topo da lista diz "+ mandar um lugar novo" e leva às perguntas — a mesma palavra em duas fontes, levando a dois lugares, é o que o M10 apontou.

🔴 **NENHUMA PERGUNTA NOVA.** As oito perguntas dela são as do painel (`PERGUNTAS`, tiradas do questionário que ele já leu), escolhidas pela lista dela e na ordem da spec. O que muda é QUAIS e QUAIS são obrigatórias — a régua dela (`OPCIONAIS_DA_PESSOA`), não a do registro. A pergunta do mapa é a do ponto 0 (`trajeto.waypoints.0.lat`), que grava o ponto e a coordenada da chuva juntos (Task 10). (Escolha 5 no fim do plano: a spec descreve a pergunta 4 como "o que é, em uma frase"; a pergunta do painel pro mesmo campo, `promessa`, é *"Em uma frase, por que alguém pegaria o carro pra ir até aí?"* — e fica ela, já lida.)

- [ ] **Step 1: Escrever os testes que falham**

`tests/app/contribuir-telas.test.tsx`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ORDEM_DA_PESSOA, montarPerguntasDaPessoa } from "@/app/contribuir/perguntas";
import { CAMPOS_DA_PESSOA, OPCIONAIS_DA_PESSOA } from "@/lib/campos-da-pessoa";
import { PERGUNTAS } from "@/app/admin/novo/perguntas";
import { BLOQUEADA, CLERK_FORA, JA_CONFERIDO } from "@/lib/porta-da-pessoa";
import { conferirLugar, criarRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { versaoAtual } from "@/lib/db";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { MANDAR_UM_LUGAR_NOVO } from "@/app/contribuir/palavras";
import { bancoDeProducao, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA, sessao } from "../sessao-da-pessoa";

vi.mock("@/lib/contribuidor-sessao", async () => (await import("../sessao-da-pessoa")).moduloFalso);
vi.mock("next/navigation", async (real) => ({
  ...(await real<typeof import("next/navigation")>()),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/vista-do-mapa", async (real) => ({
  ...(await real<typeof import("@/lib/vista-do-mapa")>()),
  vistaDaCoordSemPonto: vi.fn(async () => null),
}));

const banco = await bancoDeProducao();
const Meus = (await import("@/app/contribuir/page")).default;
const Novo = (await import("@/app/contribuir/novo/page")).default;
const Editar = (await import("@/app/contribuir/[slug]/page")).default;
let SLUG: string;

beforeEach(async () => {
  await semearAcervo(banco);
  SLUG = await semearLugarDaPessoa(banco, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  sessao.atual = PESSOA;
  sessao.fora = false;
});
afterEach(() => cleanup());

describe("as perguntas dela", () => {
  it("são a lista dela, na ordem da spec, e o mapa no 3º lugar", () => {
    expect(ORDEM_DA_PESSOA).toEqual([
      "trajeto.waypoints.0.nome", "cidade", "trajeto.waypoints.0.lat", "promessa", "acesso", "avisos",
      "custo.tag", "custo.valor", "horario", "dias",
    ]);
    for (const c of CAMPOS_DA_PESSOA) expect(ORDEM_DA_PESSOA, c).toContain(c);
  });

  it("cada texto é a pergunta do painel, já lida — nenhuma redação nova", () => {
    for (const q of montarPerguntasDaPessoa({})) expect(q.texto, q.campo.caminho).toBe(PERGUNTAS[q.campo.caminho]);
  });

  it("obrigatoriedade é a DELA: avisos, valor, horário e dias podem ficar sem resposta", () => {
    for (const q of montarPerguntasDaPessoa({})) {
      expect(q.campo.obrigatorio, q.campo.caminho).toBe(!OPCIONAIS_DA_PESSOA.has(q.campo.caminho));
    }
  });
});

describe("a porta das páginas", () => {
  it("sem sessão: manda entrar (e não mostra nada)", async () => {
    sessao.atual = null;
    await expect(Meus()).rejects.toThrow("NEXT_REDIRECT_PRA_ENTRAR");
  });

  it("Clerk fora: a frase, e nada mais", async () => {
    sessao.fora = true;
    const { container } = render(await Meus());
    expect(container.textContent).toContain(CLERK_FORA);
    expect(container.querySelector("a[href='/contribuir/novo']")).toBeNull();
  });

  it("bloqueada: a frase, e nenhum caminho pra mandar nem editar", async () => {
    await banco.execute({ sql: "INSERT INTO contribuidores (id, bloqueado, criado_em) VALUES (?, 1, 0) ON CONFLICT(id) DO UPDATE SET bloqueado = 1", args: [PESSOA.id] });
    const { container } = render(await Meus());
    expect(container.textContent).toContain(BLOQUEADA);
    expect(container.querySelector("a[href^='/contribuir/']")).toBeNull();
  });
});

describe("Meus lugares", () => {
  // 🔴 I5 da pré-auditoria: "Meus lugares" é onde a barra leva, e é por aqui
  // que se manda um lugar novo. Quem nunca mandou nada (OUTRA, aqui) vê o link
  // no TOPO — o primeiro link da tela, antes de qualquer lista.
  it("quem nunca mandou nada: o primeiro link da tela é '+ mandar um lugar novo', pras perguntas", async () => {
    sessao.atual = OUTRA;
    const { container } = render(await Meus());
    const primeiro = container.querySelector("main a");
    expect(primeiro?.getAttribute("href")).toBe("/contribuir/novo");
    expect(primeiro?.textContent).toBe(MANDAR_UM_LUGAR_NOVO);
    expect(container.querySelector('[data-testid="meus-lugares"]')).toBeNull();
  });

  it("com lugares, o link do topo continua antes da lista", async () => {
    const { container } = render(await Meus());
    const links = [...container.querySelectorAll("main a")];
    expect(links[0]?.getAttribute("href")).toBe("/contribuir/novo");
    expect(container.querySelector('[data-testid="meus-lugares"]'), "a premissa: a lista dela existe").not.toBeNull();
  });

  it("mostra o dela, marcado como não conferido, com o link de editar; o de outra não aparece", async () => {
    await semearLugarDaPessoa(banco, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
    const { container } = render(await Meus());
    const item = container.querySelector(`[data-lugar="${SLUG}"]`);
    expect(item?.textContent).toContain(ETIQUETA_NAO_CONFERIDO);
    expect(item?.querySelector(`a[href="/contribuir/${SLUG}"]`)).not.toBeNull();
    expect(container.textContent).not.toContain("Pedra Da Outra");
  });

  it("conferido: o link de editar some", async () => {
    await conferirLugar(banco, SLUG, (await versaoAtual(banco, SLUG))!.id, 1);
    const { container } = render(await Meus());
    expect(container.querySelector(`a[href="/contribuir/${SLUG}"]`)).toBeNull();
  });

  it("os rascunhos dela aparecem, com o caminho de volta pras perguntas", async () => {
    await criarRascunhoDaPessoa(banco, "comecado-cidade", JSON.stringify({ slug: "comecado-cidade" }), 1, PESSOA.id);
    const { container } = render(await Meus());
    expect(container.querySelector('a[href="/contribuir/novo?slug=comecado-cidade"]')).not.toBeNull();
  });
});

describe("as perguntas na tela", () => {
  it("sem slug: começar (nome e cidade), pela rota dela", async () => {
    const { container } = render(await Novo({ searchParams: Promise.resolve({}) }));
    expect(container.querySelectorAll("input")).toHaveLength(2);
  });

  it("o rascunho de OUTRA pessoa é 404", async () => {
    await criarRascunhoDaPessoa(banco, "da-outra-cidade", JSON.stringify({ slug: "da-outra-cidade" }), 1, OUTRA.id);
    await expect(Novo({ searchParams: Promise.resolve({ slug: "da-outra-cidade" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("editar o dela no ar", () => {
  it("o dela, não conferido: as perguntas dela, gravando com a versão da tela", async () => {
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.querySelector('[data-testid="pergunta-promessa"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pergunta-voz"]')).toBeNull();
  });

  it("conferido: a frase, e nenhum editor", async () => {
    await conferirLugar(banco, SLUG, (await versaoAtual(banco, SLUG))!.id, 1);
    const { container } = render(await Editar({ params: Promise.resolve({ slug: SLUG }) }));
    expect(container.textContent).toContain(JA_CONFERIDO);
    expect(container.querySelector("[data-testid^='pergunta-']")).toBeNull();
  });

  it("de OUTRA pessoa, ou do João: 404", async () => {
    sessao.atual = OUTRA;
    await expect(Editar({ params: Promise.resolve({ slug: SLUG }) })).rejects.toThrow("NEXT_NOT_FOUND");
    sessao.atual = PESSOA;
    await expect(Editar({ params: Promise.resolve({ slug: "rampa-do-pepe" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
```

Em `tests/app/BarraNavegacao.test.tsx` (leia o arquivo; ele pode cravar DOIS itens — atualize pra três e acrescente; importe `MANDAR_UM_LUGAR` de `@/app/BarraNavegacao`):

```ts
// I5 da pré-auditoria: a barra leva à LISTA dela ("Meus lugares", que tem o
// "+ mandar um lugar novo" no topo) — e é por ela que as frases "volte pela sua
// lista de lugares" têm destino.
it("a entrada de quem quer mandar um lugar leva à lista dela, /contribuir", () => {
  const { container } = render(<BarraNavegacao aqui="hoje" />);
  const a = container.querySelector('a[href="/contribuir"]');
  expect(a?.textContent).toContain(MANDAR_UM_LUGAR);
  expect(container.querySelector('a[href="/contribuir/novo"]')).toBeNull();
});
```

Em `tests/app/sw.test.ts`, no molde dos dois casos do `/admin` (`:62-95`):

```ts
describe("service worker: /contribuir nunca vira cache", () => {
  it("a rota do /contribuir vem antes de ...defaultCache, e responde com NetworkOnly", () => {
    const bloco = SW.slice(SW.indexOf("runtimeCaching:"));
    expect(bloco.indexOf('"/contribuir"')).toBeGreaterThan(-1);
    expect(bloco.indexOf('"/contribuir"')).toBeLessThan(bloco.indexOf("...defaultCache"));
    expect(bloco).toMatch(
      /matcher: \(\{ url \}\) => url\.pathname\.startsWith\("\/contribuir"\),\s*handler: new NetworkOnly\(\),/,
    );
    expect(bloco.match(/startsWith\("\/contribuir"\)/g)).toHaveLength(1);
  });
});
```

Em `tests/lib/despacho.test.ts`: `expect(ehCaminhoDeFicha("/contribuir")).toBe(false);`

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/app/contribuir-telas.test.tsx tests/app/BarraNavegacao.test.tsx tests/app/sw.test.ts tests/lib/despacho.test.ts`
Expected: FAIL.

- [ ] **Step 3: A porta das páginas e as perguntas**

`src/app/contribuir/sessao.ts`:

```ts
import { getClient } from "@/lib/db";
import { estaBloqueado } from "@/lib/db-contribuidor";
import { irPraEntrar, lerContribuidor, type QuemContribui } from "@/lib/contribuidor-sessao";
import { BLOQUEADA, CLERK_FORA } from "@/lib/porta-da-pessoa";

/** A PORTA DAS PÁGINAS DELA — irmã de `portaDaPessoa` (rotas): Clerk fora →
 *  a frase; sem sessão → a tela de entrar do Clerk (que volta pro mesmo
 *  endereço); bloqueada → a frase. A página que recebe `frase` mostra só ela. */
export async function quemNaTela(): Promise<{ pessoa: QuemContribui } | { frase: string }> {
  let pessoa: QuemContribui | null;
  try {
    pessoa = await lerContribuidor();
  } catch {
    return { frase: CLERK_FORA };
  }
  if (pessoa === null) return irPraEntrar();
  if (await estaBloqueado(getClient(), pessoa.id)) return { frase: BLOQUEADA };
  return { pessoa };
}
```

`src/app/contribuir/perguntas.ts`:

```ts
import { OPCIONAIS_DA_PESSOA } from "@/lib/campos-da-pessoa";
import { montarPerguntas } from "../admin/novo/perguntas";
import type { PerguntaNaTela } from "../admin/campos/tipos";

/** A ORDEM DA SPEC (07/10, Parte 1): nome, cidade, o ponto no mapa, o que é,
 *  como se chega, o que pode dar errado, custa ou é grátis (+ quanto), horário
 *  e dias. A pergunta do mapa é a do ponto 0 — grava o ponto e a chuva juntos. */
export const ORDEM_DA_PESSOA: readonly string[] = [
  "trajeto.waypoints.0.nome", "cidade", "trajeto.waypoints.0.lat", "promessa", "acesso", "avisos",
  "custo.tag", "custo.valor", "horario", "dias",
];

/** As perguntas DELA: as do painel (mesmo texto, mesmo instrumento), só as da
 *  lista dela, e com a obrigatoriedade DELA. Pergunta da lista que o painel não
 *  monta é defeito de programa — estoura, nunca some calada. */
export function montarPerguntasDaPessoa(doc: unknown): PerguntaNaTela[] {
  const doPainel = new Map(montarPerguntas(doc).map((q) => [q.campo.caminho, q]));
  return ORDEM_DA_PESSOA.map((caminho) => {
    const q = doPainel.get(caminho);
    if (!q) throw new Error(`a pergunta "${caminho}" não existe no formulário do painel`);
    return { ...q, campo: { ...q.campo, obrigatorio: !OPCIONAIS_DA_PESSOA.has(caminho) } };
  });
}
```

- [ ] **Step 4: As páginas**

`src/app/contribuir/palavras.ts`:

```ts
/** As palavras das telas de quem manda um lugar. Moram aqui porque arquivo de
 *  página do Next não exporta nada além do que o Next aceita. */

// PENDENTE: redação minha, o João ainda não leu
export const TITULO_MEUS = "Os lugares que você mandou";
/** O link do TOPO de "Meus lugares", pras perguntas. Palavra DIFERENTE do item
 *  da barra (`MANDAR_UM_LUGAR`, "+ mandar um lugar", que leva a esta lista): a
 *  mesma palavra em duas fontes, levando a dois lugares, era o M10 da
 *  pré-auditoria. */
// PENDENTE: redação minha, o João ainda não leu
export const MANDAR_UM_LUGAR_NOVO = "+ mandar um lugar novo";
// PENDENTE: redação minha, o João ainda não leu
export const CONFERIDO = "conferido pelo BatePerna";
// PENDENTE: redação minha, o João ainda não leu
export const MUDAR = "mudar";
// PENDENTE: redação minha, o João ainda não leu
export const TITULO_MANDAR = "Mandar um lugar";
```

Todas as páginas: `export const dynamic = "force-dynamic";`, `metadata` com `robots: { index: false, follow: false }`, `import "../admin/admin.css"` (os editores são os do painel e usam aquelas classes; ajuste o caminho relativo de cada página), e a abertura:

```tsx
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { pessoa } = quem;
```

`src/app/contribuir/page.tsx` — "Meus lugares":

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { getClient } from "@/lib/db";
import { lugaresDaPessoa, rascunhosDaPessoa } from "@/lib/db-contribuidor";
import { ETIQUETA_NAO_CONFERIDO } from "@/lib/origem";
import { cidadeDoDoc, nomeDoRascunho } from "@/lib/rascunho";
import { ESCONDIDO } from "../admin/campos/palavras";
import { TITULO_RASCUNHOS } from "../admin/ListaDeLugares";
import { CONFERIDO, MANDAR_UM_LUGAR_NOVO, MUDAR, TITULO_MEUS } from "./palavras";
import { quemNaTela } from "./sessao";
import "../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MeusLugares() {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const [lugares, rascunhos] = await Promise.all([
    lugaresDaPessoa(getClient(), quem.pessoa.id),
    rascunhosDaPessoa(getClient(), quem.pessoa.id),
  ]);
  return (
    <main className="adm">
      <h1>{TITULO_MEUS}</h1>
      {/* 🔴 I5: o PRIMEIRO link da tela. A barra traz a pessoa pra cá, e é
          daqui que se manda um lugar novo — com ou sem lugares na lista. */}
      <Link href="/contribuir/novo" className="adm-novo-link">{MANDAR_UM_LUGAR_NOVO}</Link>
      {lugares.length > 0 && (
        <ul className="adm-lista" data-testid="meus-lugares">
          {lugares.map((l) => (
            <li key={l.slug} className="adm-item" data-lugar={l.slug}>
              <a href={`/${l.slug}`} className="adm-item-link">
                <span className="adm-item-nome">
                  {nomeDoRascunho(l.doc, l.slug)}
                  {cidadeDoDoc(l.doc) && <span className="adm-item-cidade">{cidadeDoDoc(l.doc)}</span>}
                </span>
              </a>
              <span className="adm-item-marca">{l.conferido ? CONFERIDO : ETIQUETA_NAO_CONFERIDO}</span>
              {l.oculto && <span className="adm-marca-escondido">{ESCONDIDO}</span>}
              {!l.conferido && <Link href={`/contribuir/${l.slug}`}>{MUDAR}</Link>}
            </li>
          ))}
        </ul>
      )}
      {rascunhos.length > 0 && (
        <section className="adm-rascunhos" data-testid="rascunhos">
          <h2 className="adm-rascunhos-titulo">{TITULO_RASCUNHOS}</h2>
          <ul className="adm-lista">
            {rascunhos.map((r) => (
              <li key={r.slug} className="adm-item" data-rascunho={r.slug}>
                <Link href={`/contribuir/novo?slug=${encodeURIComponent(r.slug)}`} className="adm-item-link">
                  <span className="adm-item-nome">{nomeDoRascunho(r.doc, r.slug)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

(O link do lugar vai pra página PÚBLICA dele — onde ela vê a marca, como todo mundo.)

`src/app/contribuir/novo/page.tsx` — o molde é `src/app/admin/novo/page.tsx`, trocando a porta e a leitura:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { comPrazo } from "@/lib/cache-rotas";
import { getClient, type Rascunho } from "@/lib/db";
import { lerRascunhoDaPessoa } from "@/lib/db-contribuidor";
import { PRAZO_FICHA_MS } from "@/lib/ficha-fonte";
import { FONTES_DE_PRODUCAO, vistaDaCoordSemPonto } from "@/lib/vista-do-mapa";
import FormularioDeLugar, { ComecarLugarNovo } from "../../admin/FormularioDeLugar";
import { PERGUNTAS, escolherPosicao } from "../../admin/novo/perguntas";
import { TITULO_MANDAR } from "../palavras";
import { montarPerguntasDaPessoa } from "../perguntas";
import { quemNaTela } from "../sessao";
import "../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const ESTOUROU = Symbol("prazo do rascunho dela");

export default async function NovoDaPessoa({
  searchParams,
}: { searchParams: Promise<{ slug?: string | string[]; p?: string | string[] }> }) {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { slug, p } = await searchParams;
  if (typeof slug !== "string") {
    return (
      <main className="adm">
        <h1>{TITULO_MANDAR}</h1>
        <ComecarLugarNovo perguntas={{ nome: PERGUNTAS["trajeto.waypoints.0.nome"], cidade: PERGUNTAS.cidade }} onde="contribuir" />
      </main>
    );
  }
  const r = await comPrazo<Rascunho | null | typeof ESTOUROU>(
    lerRascunhoDaPessoa(getClient(), slug, quem.pessoa.id), PRAZO_FICHA_MS, ESTOUROU,
  );
  if (r === ESTOUROU) throw new Error("O banco não respondeu a tempo à leitura do rascunho.");
  if (r === null) notFound();
  const doc: unknown = JSON.parse(r.doc);
  const perguntas = montarPerguntasDaPessoa(doc);
  const respondidas = perguntas.map((q) => q.valor !== undefined);
  const posicao = escolherPosicao(p, respondidas);
  const pergunta = perguntas[posicao - 1];
  const semPonto = pergunta.especie === "coord" && pergunta.valor === undefined;
  const vista = semPonto ? await vistaDaCoordSemPonto(doc, pergunta.campo.caminho, FONTES_DE_PRODUCAO) : null;
  return (
    <main className="adm">
      <h1>{TITULO_MANDAR}</h1>
      <FormularioDeLugar
        slug={slug}
        pergunta={vista ? { ...pergunta, campo: { ...pergunta.campo, vista } } : pergunta}
        posicao={posicao}
        respondidas={respondidas}
        onde="contribuir"
      />
    </main>
  );
}
```

`src/app/contribuir/novo/publicar/page.tsx` — o molde é `src/app/admin/novo/publicar/page.tsx` (leia-o): mesma leitura do rascunho DELA (`lerRascunhoDaPessoa`, 404 se não for dela), e:

```tsx
  const faltam = obrigatoriosDaPessoaFaltando(doc).map((c) => {
    const caminho = c === PONTO ? "trajeto.waypoints.0.lat" : c;
    const n = ORDEM_DA_PESSOA.indexOf(caminho) + 1;
    return { texto: PERGUNTAS[caminho] ?? caminho, href: ROTAS.contribuir.pergunta(slug, n) };
  });
  return (
    <main className="adm">
      <h1>{TITULO_MANDAR}</h1>
      <TelaDePublicar slug={slug} atualizadoEm={r.atualizado_em} frases={[]} faltam={faltam} onde="contribuir" />
    </main>
  );
```

(`frases={[]}`: o "o que o app vai calar" do painel fala de campos que ela nem viu — a página dela cala o que ela não respondeu, e o aviso de publicar dela já diz que o lugar vai marcado. `TITULO_MANDAR` vem de `../../palavras`.)

`src/app/contribuir/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClient, lugarDoDono } from "@/lib/db";
import { JA_CONFERIDO } from "@/lib/porta-da-pessoa";
import EdicaoDaPessoa from "../EdicaoDaPessoa";
import { montarPerguntasDaPessoa } from "../perguntas";
import { quemNaTela } from "../sessao";
import "../../admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** EDITAR O DELA, NO AR (spec, Parte 1): só o lugar DELA, e só enquanto não
 *  conferido — depois disso o editar some (aqui, e o INSERT recusaria de
 *  qualquer jeito: Task 12). Lugar de outra pessoa ou do João é o 404 de
 *  sempre: não revela que existe. */
export default async function EditarDaPessoa({ params }: { params: Promise<{ slug: string }> }) {
  const quem = await quemNaTela();
  if ("frase" in quem) return <main className="adm"><p className="adm-erro">{quem.frase}</p></main>;
  const { slug } = await params;
  const lugar = await lugarDoDono(getClient(), slug);
  if (lugar === null || lugar.origem.contribuidor !== quem.pessoa.id) notFound();
  if (lugar.origem.conferido) {
    return (
      <main className="adm">
        <p className="adm-erro">{JA_CONFERIDO}</p>
        <Link href={`/${slug}`}>{slug}</Link>
      </main>
    );
  }
  return (
    <main className="adm">
      <EdicaoDaPessoa slug={slug} versaoId={lugar.versao.id} perguntas={montarPerguntasDaPessoa(JSON.parse(lugar.versao.doc))} />
    </main>
  );
}
```

`src/app/contribuir/EdicaoDaPessoa.tsx`:

```tsx
"use client";
import { Pergunta } from "../admin/FormularioDeLugar";
import { ComVersaoDaTela, PortaDoEditor } from "../admin/campos/gravar";
import type { PerguntaNaTela } from "../admin/campos/tipos";

/** AS PERGUNTAS DELA SOBRE O LUGAR NO AR, todas numa tela (no rascunho é uma
 *  por tela; aqui ela volta pra mudar UMA coisa). Cada uma grava por
 *  `/api/contribuir/lugar` com a versão que a página leu (`ComVersaoDaTela`), e
 *  a tela se relê do banco. 401 recarrega (Review Focus 4). */
export default function EdicaoDaPessoa({ slug, versaoId, perguntas }: { slug: string; versaoId: number; perguntas: PerguntaNaTela[] }) {
  return (
    <ComVersaoDaTela id={versaoId}>
      <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/lugar", previa: false, depoisDeGravar: null, recarregarSe401: true }}>
        {perguntas.map((q) => <Pergunta key={q.campo.caminho} pergunta={q} slug={slug} proxima={null} />)}
      </PortaDoEditor.Provider>
    </ComVersaoDaTela>
  );
}
```

- [ ] **Step 5: A barra, as reservas e o service worker**

`src/app/BarraNavegacao.tsx`:

```tsx
// PENDENTE: redação minha, o João ainda não leu (o texto é o da spec de 07/10, Parte 1)
export const MANDAR_UM_LUGAR = "+ mandar um lugar";
```

e, depois do laço dos destinos (dentro do `<nav>`), um terceiro item — link comum, sem `aria-current` (não é uma "seção" do app; sem sessão, o Clerk pede login, spec Parte 1). Ele leva à LISTA dela, `/contribuir`, que tem o "+ mandar um lugar novo" no topo (I5 da pré-auditoria):

```tsx
      <a className="barra-item barra-mandar" href="/contribuir">{MANDAR_UM_LUGAR}</a>
```

(O docblock da barra diz "Dois destinos e só"; ganha ao fim: *"E desde 07/10 um terceiro item, que não é seção: a lista de quem manda um lugar (`/contribuir`), de onde ela manda um novo."*)

`src/lib/rascunho.ts:43`: `["admin", "api", "chuva", "contribuir", "icones", "trilhas", "novo"]`.
`src/lib/despacho.ts:2`: `new Set(["trilhas", "icones", "admin", "contribuir"])`.
`src/app/sw.ts`, logo DEPOIS do objeto do `/admin` em `runtimeCaching` (e antes do `...defaultCache`):

```ts
    {
      // 🔴 /contribuir também nunca vira cache (07/10): é a tela de quem
      // manda um lugar, logada pelo Clerk — uma cópia guardada mostraria a
      // lista de uma pessoa a quem abrir o celular dela depois de sair, e
      // perguntas de um rascunho que já foi publicado. Mesma razão e mesmo
      // lugar do /admin, logo acima.
      matcher: ({ url }) => url.pathname.startsWith("/contribuir"),
      handler: new NetworkOnly(),
    },
```

- [ ] **Step 6: Rodar e confirmar que passam**

Run: `npx vitest run tests/app/contribuir-telas.test.tsx tests/app/BarraNavegacao.test.tsx tests/app/sw.test.ts tests/lib/despacho.test.ts tests/api/route-admin-rascunho.test.ts tests/app/marca-em-toda-superficie.test.tsx`
Expected: PASS. A varredura da Task 5 continua verde: as páginas de `/contribuir` estão fora dela de propósito (não são superfície pública — exigem login, e são da pessoa sobre os lugares DELA).

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | `montarPerguntasDaPessoa` usa a obrigatoriedade do registro | "obrigatoriedade é a DELA" |
| M2 | `ORDEM_DA_PESSOA` ganha `"voz"` | "são a lista dela, na ordem da spec" **e** a página "editar … `pergunta-voz` é null" |
| M3 | "Meus lugares" mostra o link de editar sempre | "conferido: o link de editar some" |
| M4 | `rascunhosDaPessoa` trocado por `listarRascunhos` na página | "os rascunhos dela aparecem" (a lista do painel não tem os dela) |
| M5 | a página de editar sem a checagem de `contribuidor` | "de OUTRA pessoa, ou do João: 404" |
| M6 | `quemNaTela` sem a checagem de bloqueio | "bloqueada: a frase, e nenhum caminho" |
| M7 | tira o objeto `/contribuir` do `sw.ts` | "a rota do /contribuir vem antes de ...defaultCache" |
| M8 | tira `"contribuir"` de `SLUGS_RESERVADOS` | "todo segmento estático de rota é reservado" |
| M9 | a barra volta a levar a `/contribuir/novo` | "a entrada de quem quer mandar um lugar leva à lista dela, /contribuir" |
| M10 | "Meus lugares" sem o link do topo (só a lista) | "quem nunca mandou nada: o primeiro link da tela é '+ mandar um lugar novo'" |
| M11 | o link do topo desce pra depois da lista | "com lugares, o link do topo continua antes da lista" |

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/app/contribuir src/app/BarraNavegacao.tsx src/lib/rascunho.ts src/lib/despacho.ts src/app/sw.ts tests/app/contribuir-telas.test.tsx tests/app/BarraNavegacao.test.tsx tests/app/sw.test.ts tests/lib/despacho.test.ts
git commit -m "feat(contribuir): as telas de quem manda um lugar, e a entrada na barra"
node scripts/mutar.mjs
```

📝 **Frases novas:** `MANDAR_UM_LUGAR` (barra → `/contribuir`), `TITULO_MEUS`, `MANDAR_UM_LUGAR_NOVO` (topo da lista → `/contribuir/novo`), `CONFERIDO`, `MUDAR`, `TITULO_MANDAR`.

---

### Task 15: "Bloquear quem mandou" e "Desbloquear"

**Files:**
- Modify: `src/lib/db-contribuidor.ts` — `bloquearContribuidor`, `desbloquearContribuidor`
- Create: `src/app/api/admin/contribuidor/route.ts` (`POST`)
- Create: `src/app/admin/BotaoBloquear.tsx`
- Modify: `src/app/admin/CaixaDaOrigem.tsx` (o botão, e as props `contribuidor`/`bloqueado`), `src/app/admin/[slug]/page.tsx` (passa as duas), `src/app/admin/campos/palavras.ts` (as palavras)
- Modify: `src/app/api/contribuir/rascunho/route.ts`, `src/app/api/contribuir/publicar/route.ts` — quando o banco recusa, conferir se foi o bloqueio (a frase certa)
- Test: `tests/lib/db-bloquear.test.ts`, `tests/api/route-admin-contribuidor.test.ts`, `tests/app/admin-bloquear.test.tsx` (criar); `tests/api/route-contribuir-rascunho.test.ts` (acrescentar a corrida); `tests/app/admin-editores-de-campo.test.tsx` (`CUNHADAS_AQUI` — I1)

**Interfaces:**
- Consumes: `contribuidores`, `origem_do_lugar` (Task 1); `LIVRE` e as gravações dela (Tasks 10-12); `getAllFichas`; `clienteQueIntercala`; `CaixaDaOrigem` (Task 6).
- Produces:
  - `export async function bloquearContribuidor(client: Client, id: string, agora: number): Promise<number>` — quantos lugares saíram do ar
  - `export async function desbloquearContribuidor(client: Client, id: string): Promise<boolean>`
  - `POST /api/admin/contribuidor` com corpo `{ id, bloquear: boolean }`: 200 `{ escondidos: number }` · 400 · 401 · 404
  - `BotaoBloquear` (props `{ contribuidor: string; bloqueado: boolean }`)

🔴 **BLOQUEAR = UMA TRANSAÇÃO, DOIS ATOS** (spec, Parte 3): `bloqueado = 1` E uma versão nova `oculto = 1` em CADA lugar dela que está no ar — conferidos inclusive ("esconde TODOS os lugares dela"). Versão nova, nunca UPDATE: é o append-only de sempre, e o histórico de cada lugar mostra o ato. Os já escondidos não ganham versão repetida. **Desbloquear desfaz SÓ o bloqueio**: os lugares continuam escondidos até ele mostrar um a um (o botão de visibilidade de sempre).

- [ ] **Step 1: Escrever os testes que falham**

`tests/lib/db-bloquear.test.ts`:

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historico, lerAcervoComOrigem, versaoAtual } from "@/lib/db";
import {
  bloquearContribuidor, conferirLugar, contribuidorPorId, criarRascunhoDaPessoa, desbloquearContribuidor, estaBloqueado,
  registrarContribuidor,
} from "@/lib/db-contribuidor";
import { AGORA_SEMENTE, semearAcervo, semearLugarDaPessoa } from "../banco";
import { OUTRA, PESSOA } from "../sessao-da-pessoa";

let c: Client;
let A: string;
let B: string;
let DA_OUTRA: string;
beforeEach(async () => {
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  A = await semearLugarDaPessoa(c, { nome: "Pedra Um", cidade: "Cidade Teste" });
  B = await semearLugarDaPessoa(c, { nome: "Pedra Dois", cidade: "Cidade Teste" });
  DA_OUTRA = await semearLugarDaPessoa(c, { nome: "Pedra Da Outra", cidade: "Cidade Teste", contribuidor: OUTRA.id });
});
afterEach(() => c.close());
const T = AGORA_SEMENTE + 500;
const oculto = async (s: string) => (await versaoAtual(c, s))!.oculto;

describe("bloquearContribuidor", () => {
  it("bloqueia, e esconde TODOS os lugares dela — conferidos inclusive", async () => {
    await conferirLugar(c, B, (await versaoAtual(c, B))!.id, T - 1);
    expect(await bloquearContribuidor(c, PESSOA.id, T)).toBe(2);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
    expect([await oculto(A), await oculto(B)]).toEqual([true, true]);
  });

  it("não encosta nos lugares de outra pessoa nem nos do João", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await oculto(DA_OUTRA)).toBe(false);
    expect(await oculto("rampa-do-pepe")).toBe(false);
  });

  it("esconder é VERSÃO NOVA (append-only), com o documento intacto", async () => {
    const antes = (await versaoAtual(c, A))!.doc;
    await bloquearContribuidor(c, PESSOA.id, T);
    const h = await historico(c, A);
    expect(h).toHaveLength(2);
    expect(h[0].doc).toBe(antes);
    expect(h[0].autor).toBe("painel");
  });

  it("o lugar já escondido não ganha versão repetida", async () => {
    await c.execute({ sql: "UPDATE ficha_versoes SET oculto = 1 WHERE ficha_slug = ?", args: [A] });
    expect(await bloquearContribuidor(c, PESSOA.id, T)).toBe(1);
    expect(await historico(c, A)).toHaveLength(1);
  });

  it("quem nunca passou pela porta (sem linha em contribuidores) é bloqueado do mesmo jeito", async () => {
    expect(await contribuidorPorId(c, PESSOA.id)).toBeNull();
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
  });

  // 🔴 M6 da pré-auditoria: o caso de cima NÃO mata o `ON CONFLICT … DO
  // NOTHING` — sem linha prévia, o INSERT nasce bloqueado de qualquer jeito. É
  // ESTE que o mata: quem já passou pela porta TEM linha (`bloqueado = 0`), e
  // só o `DO UPDATE SET bloqueado = 1` a bloqueia.
  it("quem JÁ passou pela porta (com linha, desbloqueada) também é bloqueado — nome e e-mail ficam", async () => {
    await registrarContribuidor(c, PESSOA, T - 10);
    expect(await estaBloqueado(c, PESSOA.id), "a premissa: a linha existe, desbloqueada").toBe(false);
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await contribuidorPorId(c, PESSOA.id)).toEqual({ id: PESSOA.id, nome: PESSOA.nome, email: PESSOA.email, bloqueado: true });
  });

  it("e a leitura do público deixa de ver os lugares dela", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    const { linhas } = await lerAcervoComOrigem(c);
    expect(linhas.get(A)?.oculto).toBe(true);
    expect(linhas.get(DA_OUTRA)?.oculto).toBe(false);
  });
});

describe("desbloquearContribuidor", () => {
  it("desfaz o bloqueio e deixa os lugares escondidos", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    expect(await desbloquearContribuidor(c, PESSOA.id)).toBe(true);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect(await oculto(A)).toBe(true);
  });

  it("depois de desbloqueada, ela volta a gravar", async () => {
    await bloquearContribuidor(c, PESSOA.id, T);
    await desbloquearContribuidor(c, PESSOA.id);
    expect(await criarRascunhoDaPessoa(c, "nova-cidade", '{"slug":"nova-cidade"}', T, PESSOA.id)).toBe(true);
  });
});
```

`tests/api/route-admin-contribuidor.test.ts` (molde da Task 6):

```ts
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SENHA } from "@/lib/admin-config";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { versaoAtual } from "@/lib/db";
import { estaBloqueado } from "@/lib/db-contribuidor";
import { semearAcervo, semearLugarDaPessoa } from "../banco";
import { PESSOA } from "../sessao-da-pessoa";

const SENHA = "s".repeat(MIN_SENHA);
const SEGREDO = "segredo-de-assinatura-do-teste-contribuidor";
const AGORA = 1_758_300_000;
let c: Client;
let SLUG: string;
let cookieBom: string;
let POST: typeof import("@/app/api/admin/contribuidor/route").POST;

vi.mock("@/lib/db", async (io) => ({ ...(await io<typeof import("@/lib/db")>()), getClient: () => c }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA * 1000);
  c = createClient({ url: ":memory:" });
  await semearAcervo(c);
  SLUG = await semearLugarDaPessoa(c, { nome: "Pedra Mandada", cidade: "Cidade Teste" });
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  POST = (await import("@/app/api/admin/contribuidor/route")).POST;
  cookieBom = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
});
afterEach(() => { c.close(); vi.unstubAllEnvs(); vi.useRealTimers(); });

const pedido = (corpo: unknown, cookie?: string) =>
  new Request("http://x/api/admin/contribuidor", {
    method: "POST",
    headers: cookie ? { cookie: `${COOKIE_ADMIN}=${cookie}` } : undefined,
    body: JSON.stringify(corpo),
  });

describe("POST /api/admin/contribuidor", () => {
  it("bloquear: 200 com quantos saíram do ar, e o banco concorda", async () => {
    const res = await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom));
    expect(await res.json()).toEqual({ escondidos: 1 });
    expect(await estaBloqueado(c, PESSOA.id)).toBe(true);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("desbloquear: 200, e o lugar continua escondido", async () => {
    await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom));
    expect((await POST(pedido({ id: PESSOA.id, bloquear: false }, cookieBom))).status).toBe(200);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(true);
  });

  it("painel desligado 404; sem sessão 401; corpo torto 400 — nada muda", async () => {
    expect((await POST(pedido({ id: PESSOA.id, bloquear: true }))).status).toBe(401);
    expect((await POST(pedido({ id: PESSOA.id, bloquear: "sim" }, cookieBom))).status).toBe(400);
    expect((await POST(pedido({ id: "", bloquear: true }, cookieBom))).status).toBe(400);
    vi.stubEnv("ADMIN_SENHA", "");
    expect((await POST(pedido({ id: PESSOA.id, bloquear: true }, cookieBom))).status).toBe(404);
    expect(await estaBloqueado(c, PESSOA.id)).toBe(false);
    expect((await versaoAtual(c, SLUG))!.oculto).toBe(false);
  });
});
```

`tests/app/admin-bloquear.test.tsx`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import BotaoBloquear from "@/app/admin/BotaoBloquear";
import { BLOQUEAR, BLOQUEAR_MESMO, DESBLOQUEAR } from "@/app/admin/campos/palavras";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BotaoBloquear", () => {
  it("bloquear pede o segundo toque, e só então manda", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('{"escondidos":1}', { status: 200 }));
    const recarregar = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: recarregar });
    const { getByRole } = render(<BotaoBloquear contribuidor="user_x" bloqueado={false} />);
    fireEvent.click(getByRole("button", { name: BLOQUEAR }));
    expect(fetchFalso).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: BLOQUEAR_MESMO }));
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/admin/contribuidor");
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ id: "user_x", bloquear: true });
  });

  it("bloqueada: o botão é Desbloquear, num toque só", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const { getByRole } = render(<BotaoBloquear contribuidor="user_x" bloqueado={true} />);
    fireEvent.click(getByRole("button", { name: DESBLOQUEAR }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ id: "user_x", bloquear: false });
  });
});
```

E em `tests/api/route-contribuir-rascunho.test.ts` (Task 10), a corrida (Review Focus 2):

```ts
  it("bloqueada no meio do formulário: 403 com a frase, e o rascunho não muda", async () => {
    await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Uma pedra." }));
    const corrida = clienteQueIntercala(c, /^UPDATE ficha_rascunhos/, async () => {
      const { bloquearContribuidor } = await import("@/lib/db-contribuidor");
      await bloquearContribuidor(c, PESSOA.id, AGORA);
    });
    cli = corrida.cliente;
    const res = await rota.PUT(pedido("PUT", { slug: SLUG, campo: "promessa", valor: "Outra." }));
    expect(corrida.disparos()).toBe(1);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe(BLOQUEADA);
    expect((await docDe()).promessa).toBe("Uma pedra.");
  });
```

(O `rota.PUT` de dentro do `describe("PUT — responder")`, que já tem o `beforeEach(comecar)`.)

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run tests/lib/db-bloquear.test.ts tests/api/route-admin-contribuidor.test.ts tests/app/admin-bloquear.test.tsx tests/api/route-contribuir-rascunho.test.ts`
Expected: FAIL.

- [ ] **Step 3: O banco**

`src/lib/db-contribuidor.ts`:

```ts
/** BLOQUEAR QUEM MANDOU (spec de 07/10, Parte 3): numa transação, a pessoa
 *  passa a bloqueada E cada lugar DELA que está no ar ganha uma versão nova
 *  `oculto = 1` com o documento atual (append-only; conferidos inclusive).
 *  Devolve quantos lugares saíram do ar. Quem nunca passou pela porta (sem
 *  linha) nasce bloqueado. */
export async function bloquearContribuidor(client: Client, id: string, agora: number): Promise<number> {
  const rs = await client.batch(
    [
      {
        sql: `INSERT INTO contribuidores (id, nome, email, bloqueado, criado_em) VALUES (?, NULL, NULL, 1, ?)
              ON CONFLICT(id) DO UPDATE SET bloqueado = 1`,
        args: [id, agora],
      },
      {
        sql: `INSERT INTO ficha_versoes (ficha_slug, doc, autor, criado_em, oculto)
              SELECT v.ficha_slug, v.doc, 'painel', ?, 1
                FROM ficha_versoes v
               WHERE v.id IN (SELECT MAX(id) FROM ficha_versoes GROUP BY ficha_slug)
                 AND v.oculto <> 1
                 AND ${IDENTIDADE("v.ficha_slug")} IN (SELECT lugar FROM origem_do_lugar WHERE contribuidor = ?)`,
        args: [agora, id],
      },
    ],
    "write",
  );
  return rs[1].rowsAffected;
}

/** DESBLOQUEAR: só o bloqueio. Os lugares continuam escondidos até o João
 *  mostrar cada um (spec, Parte 3). */
export async function desbloquearContribuidor(client: Client, id: string): Promise<boolean> {
  const r = await client.execute({ sql: `UPDATE contribuidores SET bloqueado = 0 WHERE id = ?`, args: [id] });
  return r.rowsAffected === 1;
}
```

(O `rowsAffected` de um `INSERT … SELECT` SEM `RETURNING` conta as linhas certas no libsql 0.14 — MEDIDO na pré-auditoria de 07/10; o comentário de `gravarRelatoDoLugar` mediu que é COM `RETURNING` que ele mente. Não ponha `RETURNING` aqui. O teste "esconde TODOS" trava o número.)

- [ ] **Step 4: A rota e o botão**

`src/app/api/admin/contribuidor/route.ts`:

```ts
import { lerConfigAdmin } from "@/lib/admin-config";
import { avisarDesligado, sessaoValida, tokenDoCookie } from "@/lib/admin-guarda";
import { getClient } from "@/lib/db";
import { bloquearContribuidor, desbloquearContribuidor } from "@/lib/db-contribuidor";

export const dynamic = "force-dynamic";

const TEXTO = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } as const;

/** BLOQUEAR / DESBLOQUEAR quem mandou (spec de 07/10, Parte 3). Falha fechada
 *  como toda rota do painel. */
export async function POST(req: Request): Promise<Response> {
  const cfg = lerConfigAdmin(process.env);
  if (!cfg.ligado) {
    avisarDesligado(cfg);
    return new Response("", { status: 404 });
  }
  const agora = Math.floor(Date.now() / 1000);
  if (!sessaoValida(process.env, tokenDoCookie(req), agora)) return new Response("", { status: 401 });
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("", { status: 400, headers: TEXTO });
  }
  const c = corpo as { id?: unknown; bloquear?: unknown };
  if (
    typeof corpo !== "object" || corpo === null || Array.isArray(corpo) || Object.keys(corpo).length !== 2 ||
    typeof c.id !== "string" || c.id.trim() === "" || typeof c.bloquear !== "boolean"
  ) {
    return new Response("", { status: 400, headers: TEXTO });
  }
  if (c.bloquear) {
    const escondidos = await bloquearContribuidor(getClient(), c.id, agora);
    return Response.json({ escondidos }, { headers: { "cache-control": "no-store" } });
  }
  await desbloquearContribuidor(getClient(), c.id);
  return Response.json({ escondidos: 0 }, { headers: { "cache-control": "no-store" } });
}
```

`src/app/admin/campos/palavras.ts`:

```ts
// PENDENTE: redação minha, o João ainda não leu (o texto é o da spec de 07/10, Parte 3)
export const BLOQUEAR = "Bloquear quem mandou";
// PENDENTE: redação minha, o João ainda não leu
export const BLOQUEAR_MESMO = "Bloquear mesmo? Todos os lugares dessa pessoa saem do ar, e ela não manda nem muda mais nada.";
// PENDENTE: redação minha, o João ainda não leu (o texto é o da spec de 07/10, Parte 3)
export const DESBLOQUEAR = "Desbloquear";
```

`src/app/admin/BotaoBloquear.tsx` — molde do `CaixaDaOrigem` (Task 6): dois toques pra bloquear, um pra desbloquear, `location.reload()` no sucesso, `ERRO_GRAVAR`/`ERRO_REDE` no erro:

```tsx
"use client";
import { useRef, useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";
import { BLOQUEAR, BLOQUEAR_MESMO, DESBLOQUEAR } from "./campos/palavras";

export default function BotaoBloquear({ contribuidor, bloqueado }: { contribuidor: string; bloqueado: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  async function trocar(): Promise<void> {
    if (!bloqueado && !confirmando) { setConfirmando(true); return; }
    if (emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/contribuidor", { method: "POST", body: JSON.stringify({ id: contribuidor, bloquear: !bloqueado }) });
      if (r.ok) { location.reload(); return; }
      setErro(ERRO_GRAVAR);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      emVoo.current = false;
      setIndo(false);
    }
  }

  return (
    <>
      <button type="button" disabled={indo} onClick={trocar}>
        {bloqueado ? DESBLOQUEAR : confirmando ? BLOQUEAR_MESMO : BLOQUEAR}
      </button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </>
  );
}
```

`CaixaDaOrigem` ganha `contribuidor: string; bloqueado: boolean` e desenha `<BotaoBloquear contribuidor={contribuidor} bloqueado={bloqueado} />` depois do "Conferi"; `src/app/admin/[slug]/page.tsx` passa `contribuidor={doDono.origem.contribuidor}` e `bloqueado={quemMandou?.bloqueado ?? false}`. (Os testes da Task 6 que montam a caixa ganham as duas props.)

- [ ] **Step 5: A frase certa quando o banco recusa por bloqueio**

Nas duas rotas, os imports que ainda não estão lá (M8 da pré-auditoria): `estaBloqueado` de `@/lib/db-contribuidor` (junte ao import que já existe desse módulo) e `BLOQUEADA` de `@/lib/porta-da-pessoa` (idem).

Em `src/app/api/contribuir/rascunho/route.ts`, nos três pontos em que uma gravação devolve `false`, ANTES de escolher a frase de hoje. O `id` NÃO existe no `POST` (lá a pessoa é `porta.pessoa`) — use o nome que cada método tem (M8 da pré-auditoria):

- no `POST`, quando `criarRascunhoDaPessoa` devolve `false`, antes do `return emUso();`:
  ```ts
  if (await estaBloqueado(getClient(), porta.pessoa.id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  ```
- no `PUT`, quando `moverRascunhoDaPessoa` devolve `false` (antes do `lerRascunhoDaPessoa` que escolhe entre `RASCUNHO_DELA_SUMIU` e `emUso()`) e quando `regravarRascunhoDaPessoa` devolve `false` (antes do `RASCUNHO_DELA_SUMIU`):
  ```ts
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
  ```

E em `src/app/api/contribuir/publicar/route.ts`, antes do `return recusa(409, await porQueRecusou(slug, atualizadoEm))` final (lá o `id` existe: `const id = porta.pessoa.id`):

```ts
  if (await estaBloqueado(getClient(), id)) return new Response(BLOQUEADA, { status: 403, headers: TEXTO });
```

(A rota do lugar, Task 12, já faz.)

- [ ] **Step 6: O controle de completude do cerco do painel, e rodar**

🔴 **I1 da pré-auditoria** (o porquê está na Task 6, Step 7). `BLOQUEAR`, `BLOQUEAR_MESMO` e `DESBLOQUEAR` (`src/app/admin/campos/palavras.ts`) entram em `CUNHADAS_AQUI` de `tests/app/admin-editores-de-campo.test.tsx`, no import que já existe de `@/app/admin/campos/palavras`:

```ts
    // Task 15 (07/10): bloquear quem mandou. Só na caixa da origem de um lugar
    // mandado por quem usa — nenhuma das três fichas —, e o "mesmo?" só depois
    // do 1º toque.
    BLOQUEAR,
    BLOQUEAR_MESMO,
    DESBLOQUEAR,
```

Run: `npx vitest run tests/lib/db-bloquear.test.ts tests/api/route-admin-contribuidor.test.ts tests/app/admin-bloquear.test.tsx tests/api/route-contribuir-rascunho.test.ts tests/api/route-contribuir-publicar.test.ts tests/app/admin-nao-conferidos.test.tsx tests/app/admin-editores-de-campo.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mutações**

| # | mutação | morre em |
|---|---|---|
| M1 | o 2º passo do batch filtra também `o.conferido = 0` | "esconde TODOS os lugares dela — conferidos inclusive" |
| M2 | sem `AND v.oculto <> 1` | "o lugar já escondido não ganha versão repetida" |
| M3 | sem o filtro `contribuidor = ?` (esconde todos de quem usa) | "não encosta nos lugares de outra pessoa" |
| M4 | esconder por `UPDATE ficha_versoes SET oculto = 1` | "esconder é VERSÃO NOVA (append-only)" |
| M5 | `desbloquearContribuidor` também grava versão `oculto = 0` | "desfaz o bloqueio e deixa os lugares escondidos" |
| M6 | `ON CONFLICT … DO NOTHING` no 1º passo | "quem JÁ passou pela porta (com linha, desbloqueada) também é bloqueado" **e** "bloqueada no meio do formulário: 403 com a frase" (nos dois a pessoa já tem linha; sem o `DO UPDATE` ela fica `bloqueado = 0`). NÃO "bloqueia, e esconde…": sem linha prévia o INSERT nasce bloqueado com ou sem `DO UPDATE` (M6 da pré-auditoria) |
| M7 | a rota do rascunho sem o `estaBloqueado` depois da recusa | "bloqueada no meio do formulário: 403 com a frase" |
| M8 | `BotaoBloquear` bloqueia no 1º toque | "bloquear pede o segundo toque" |

- [ ] **Step 8: Os portões**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 9: Commit e harness**

```bash
git add src/lib/db-contribuidor.ts src/app/api/admin/contribuidor/route.ts src/app/admin/BotaoBloquear.tsx src/app/admin/CaixaDaOrigem.tsx "src/app/admin/[slug]/page.tsx" src/app/admin/campos/palavras.ts src/app/api/contribuir/rascunho/route.ts src/app/api/contribuir/publicar/route.ts tests/lib/db-bloquear.test.ts tests/api/route-admin-contribuidor.test.ts tests/app/admin-bloquear.test.tsx tests/api/route-contribuir-rascunho.test.ts tests/app/admin-nao-conferidos.test.tsx tests/app/admin-editores-de-campo.test.tsx
git commit -m "feat(painel): bloquear quem mandou esconde os lugares dela; desbloquear desfaz so o bloqueio"
node scripts/mutar.mjs
```

📝 **Frases novas:** `BLOQUEAR`, `BLOQUEAR_MESMO`, `DESBLOQUEAR`.

---

### Task 16: Toda frase nova marcada — e a PARADA pro pacote de copy

**Files:**
- Test: `tests/lib/frases-da-rodada-marcadas.test.ts` (criar)
- (nenhum arquivo de `src/` muda, a não ser que o teste ache frase sem marca)

**Interfaces:**
- Consumes: os módulos de palavras desta rodada.
- Produces: o guarda; e a LISTA das frases `PENDENTE` da rodada, no relatório, pro controlador montar o pacote de copy.

🔴 **POR QUE UM GUARDA, E POR QUE ELE MEDE POR ARQUIVO E NÃO POR LISTA DE FRASES.** A regra do projeto é "toda frase de tela nova nasce `PENDENTE`". Uma lista à mão das frases desta rodada ficaria cega à frase que o implementador da Task 14 acrescentou e esqueceu de marcar. O guarda lê os MÓDULOS onde frase mora, e exige marca em toda constante de texto exportada deles — frase nova num desses arquivos nasce marcada ou deixa a suíte vermelha.

- [ ] **Step 1: Escrever o guarda**

`tests/lib/frases-da-rodada-marcadas.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** A BASE DA RODADA: o commit de onde a execução partiu (07/10). Frase que já
 *  existia aqui pode ter `LIDA:`; frase que nasceu DEPOIS, não (I6). */
const BASE = "cc6c467";

/** Os módulos onde as palavras desta rodada (07/10) moram. Arquivo de palavras
 *  NOVO desta rodada entra aqui; os do painel que ganharam frase também. */
const ARQUIVOS = [
  "src/lib/origem.ts",
  "src/lib/porta-da-pessoa.ts",
  "src/lib/porta-da-regra-padrao.ts",
  "src/lib/calibrar.ts",
  "src/app/contribuir/palavras.ts",
  "src/app/admin/SecaoNaoConferidos.tsx",
  "src/app/admin/CaixaDaOrigem.tsx",
  "src/app/admin/TelaDaRegraPadrao.tsx",
  "src/app/admin/campos/EditorCalibrar.tsx",
  "src/app/BarraNavegacao.tsx",
];

/** As constantes de texto exportadas: `export const NOME = "..."` ou
 *  `` `...` `` (uma linha, ou a abertura de uma de várias). */
function frasesExportadas(fonte: string): { nome: string; linha: number }[] {
  const linhas = fonte.split(/\r?\n/);
  return linhas.flatMap((l, i) => {
    const m = /^export const ([A-Z][A-Z0-9_]*)\s*(?::\s*string\s*)?=\s*(["`]|$)/.exec(l);
    return m ? [{ nome: m[1], linha: i }] : [];
  });
}

/** A marca de uma constante: `PENDENTE` ou `LIDA:` num comentário nas 3
 *  linhas de cima (o docblock da constante pode ficar entre ela e a marca).
 *  `PENDENTE` ganha quando as duas aparecem. */
function marcaDe(linhas: string[], i: number): "PENDENTE" | "LIDA" | null {
  const acima = linhas.slice(Math.max(0, i - 3), i).filter((l) => /\/\//.test(l));
  if (acima.some((l) => /PENDENTE/.test(l))) return "PENDENTE";
  if (acima.some((l) => /LIDA:/.test(l))) return "LIDA";
  return null;
}

/** Os nomes das constantes de texto que o arquivo exportava na BASE. Arquivo
 *  que não existia lá = nenhum (toda frase dele é nova). */
function nomesNaBase(arquivo: string): Set<string> {
  let antes = "";
  try {
    antes = execFileSync("git", ["show", `${BASE}:${arquivo}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    antes = "";
  }
  return new Set(frasesExportadas(antes).map((f) => f.nome));
}

/** 🔴 I6 DA PRÉ-AUDITORIA: `LIDA:` só vale pra frase que JÁ EXISTIA na base.
 *  Frase que nasceu nesta rodada e diz `LIDA:` é marca escrita por mim — e
 *  "pode seguir" (aprovar o DESENHO) nunca é "li e aprovei" a frase (memória
 *  "trava removida por quem escreveu"). Foi o `SECO_SEM_CARRO` do plano
 *  original, e o guarda de antes o aceitava. */
function problemasDaMarca(fonte: string, base: Set<string>): string[] {
  const linhas = fonte.split(/\r?\n/);
  return frasesExportadas(fonte).flatMap((f) => {
    const marca = marcaDe(linhas, f.linha);
    if (marca === null) return [`${f.nome}: sem marca`];
    if (marca === "LIDA" && !base.has(f.nome)) return [`${f.nome}: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`];
    return [];
  });
}

describe("toda frase nova desta rodada nasce marcada", () => {
  it("o guarda leu frases (não-vacuidade): pelo menos 30 nos arquivos da rodada", () => {
    const total = ARQUIVOS.reduce((n, a) => n + frasesExportadas(readFileSync(path.join(process.cwd(), a), "utf8")).length, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });

  // Não-vacuidade da leitura da BASE: se o `git show` falhasse sempre, toda
  // frase pareceria nova — o guarda ficaria MAIS estrito, nunca mais frouxo;
  // mesmo assim, ele tem de saber ler a base de verdade.
  it("o guarda lê a base: um arquivo que já existia nela devolve as frases de lá", () => {
    expect(nomesNaBase("src/lib/porta-de-publicar.ts").has("RASCUNHO_MUDOU")).toBe(true);
    expect(nomesNaBase("src/lib/origem.ts").size, "origem.ts nasce nesta rodada").toBe(0);
  });

  it.each(ARQUIVOS)("%s: toda constante de texto exportada tem marca, e LIDA só em frase que já existia", (arquivo) => {
    const fonte = readFileSync(path.join(process.cwd(), arquivo), "utf8");
    expect(problemasDaMarca(fonte, nomesNaBase(arquivo))).toEqual([]);
  });

  // Os controles: o guarda SABE achar uma frase sem marca, e uma LIDA nova.
  it("controle: uma frase sem marca é achada", () => {
    const fonte = 'const x = 1;\nexport const FRASE = "sem marca";\n';
    expect(problemasDaMarca(fonte, new Set())).toEqual(["FRASE: sem marca"]);
  });

  it("controle: LIDA numa frase nova é achada; LIDA numa frase da base passa; PENDENTE sempre passa", () => {
    const fonte = '// LIDA: aprovada\nexport const NOVA = "x";\n// LIDA: aprovada\nexport const VELHA = "y";\n// PENDENTE: minha\nexport const OUTRA = "z";\n';
    expect(problemasDaMarca(fonte, new Set(["VELHA"]))).toEqual([
      `NOVA: LIDA numa frase que não existia em ${BASE} — nasce PENDENTE`,
    ]);
  });
});
```

⚠️ As frases que moram em arquivos que JÁ existiam (`src/app/admin/campos/palavras.ts`, `src/app/admin/TelaDePublicar.tsx`, `src/app/admin/HistoricoDaFicha.tsx`, `src/lib/rascunho.ts` — as duas arrow functions `parDeRascunhoDeQuemUsa`/`enderecoDeRascunhoDeQuemUsa`, que o regex de `export const NOME = "…"` não vê —, e o título do link em `src/app/[slug]/page.tsx`) não entram na lista acima porque esses arquivos têm frases antigas com outras marcas (ou formas que o regex não lê); elas entram na LISTA DO RELATÓRIO (Step 3), conferidas à mão com `git diff cc6c467 -- <arquivo> | grep -n "PENDENTE"`. As frases novas de `src/app/admin/**` estão, além disso, cercadas por `CUNHADAS_AQUI` (I1).

`FRASE_DA_PESSOA` (um objeto, não uma constante de texto) é conferida por um caso a mais, no mesmo arquivo:

```ts
it("cada frase de FRASE_DA_PESSOA tem PENDENTE na linha de cima", () => {
  const linhas = readFileSync(path.join(process.cwd(), "src/lib/porta-da-pessoa.ts"), "utf8").split(/\r?\n/);
  const entradas = linhas.flatMap((l, i) => (/^\s+"[a-z-]+": "/.test(l) ? [i] : []));
  expect(entradas.length).toBe(6);
  for (const i of entradas) expect(linhas[i - 1], linhas[i]).toMatch(/PENDENTE/);
});
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/lib/frases-da-rodada-marcadas.test.ts`
Expected: PASS. Se acusar frase sem marca, a correção é MARCAR (`// PENDENTE: redação minha, o João ainda não leu`), nunca tirar a frase do guarda.

Mutações: tire o `// PENDENTE` de cima de `FAIXA_NAO_CONFERIDO` → o caso de `src/lib/origem.ts` fica vermelho; troque o `// PENDENTE` de cima de `SECO_SEM_CARRO` por `// LIDA: aprovada na spec` (o I6) → o caso de `src/lib/origem.ts` fica vermelho com "LIDA numa frase que não existia"; tire o de uma entrada de `FRASE_DA_PESSOA` → o último caso fica vermelho.

- [ ] **Step 3: A lista das frases da rodada, pro relatório**

Run: `git diff cc6c467 -- src | grep -n "^+.*PENDENTE" `
Cole no relatório, por extenso, cada frase NOVA marcada `PENDENTE` nesta rodada, agrupada por tela (pública · painel · telas de quem contribui · recusas da porta dela), com o arquivo e a constante. É a matéria-prima do pacote de copy. Confira POR NOME, não só pelo `grep` (M9 da pré-auditoria), estas que moram fora do guarda ou dividem linha com marca antiga:
- o `· ${ETIQUETA_NAO_CONFERIDO}` do `const nome` do `generateMetadata` (`src/app/[slug]/page.tsx`) — o `PENDENTE` divide a linha com um `LIDA:` do formato antigo;
- `SECO_SEM_CARRO` ("seco") — a subtração de uma frase LIDA, PENDENTE pelo I6;
- `"quem mandou"` (`HistoricoDaFicha.tsx`), `parDeRascunhoDeQuemUsa`, `enderecoDeRascunhoDeQuemUsa` (`src/lib/rascunho.ts`);
- `NOME_JA_EM_USO`, com a nota de DECISÃO DELE: os dois casos em que a pessoa fica sem saída (o gêmeo sem cidade de um lugar do João; um lugar real diferente com o mesmo nome na mesma cidade).

- [ ] **Step 4: Os portões finais da branch**

Run: `npx vitest run && npx tsc --noEmit && npm run build && node scripts/mutar.mjs`
Expected: tudo verde; 42/0/0.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/frases-da-rodada-marcadas.test.ts
git commit -m "test(copy): toda frase nova da rodada nasce marcada"
```

- [ ] **Step 6: 🛑 PARADA — nada sobe daqui sem o João**

O plano TERMINA aqui. O que vem depois é da spec ("Ordem sugerida", item 6), e NÃO é de nenhum implementador:
1. a revisão final da branch inteira (`superpowers:requesting-code-review`), com a varredura da marca (Task 5) lida por um revisor;
2. o controlador monta o pacote de copy com a lista do Step 3 e o João LÊ — "pode seguir" não é "li e aprovei";
3. a onda de copy com as respostas dele;
4. só então: `npm run semear` (cria as três tabelas e a coluna no Turso — sem isso, o código novo estoura com "no such table") → UM `vercel --prod` → `conferir-no-ar`.

Nenhum desses quatro passos roda dentro deste plano.

---

## As escolhas onde a spec era ambígua

Cada uma está no código com o porquê; aqui, juntas, pra revisão dele.

1. **A regra própria NÃO é coluna.** A spec lista `regra_propria` como booleano por lugar. O plano a DERIVA do documento (`condicao.regra` presente — `noAr`, Task 2). Motivo: calibrar grava a regra no documento, e "voltar a esta" (que regrava um documento antigo) deixaria uma coluna separada dizendo "tem regra própria" num documento sem regra — e o carimbo sem regra nenhuma. Todo comportamento que a spec pede vale igual: o lugar sem regra própria usa a do banco, calibrar a liga, conferir não a liga.
2. **A origem mora numa tabela própria, só com os lugares de quem usa; linha ausente = lugar do João.** A migração "todo lugar existente nasce `conferido = true`, `autor = null`" sai por CONSTRUÇÃO (nenhuma linha nasce pra eles), e só UMA porta faz nascer linha — o publicar dela, no mesmo batch da versão 1 (Task 1). A coluna da spec chamada `autor` virou `contribuidor`: `ficha_versoes` já tem uma coluna `autor` (`painel`/`semente`), que ganhou o valor `contribuidor` pra a versão gravada por ela — é o "quem mandou" do histórico.
3. **`discriminador` opcional por inteiro E nas três folhas.** A spec solta o bloco; o plano solta também as folhas, pra o João completar o lugar dela folha a folha pelo painel (Task 8) — com as folhas obrigatórias dentro do bloco, a primeira folha nunca passaria no schema. A página cala cada folha ausente (Task 4). A `condicao.regra`, ao contrário, entra INTEIRA, pelo "Calibrar".
4. **`avisos` também vira opcional no schema.** A spec não o lista em "o que não se pergunta", mas a pergunta 6 dela ("o que pode dar errado") é opcional — sem isto o documento dela não abriria.
5. **"As 5 obrigatórias dela" são 6** na lista da própria spec: nome, cidade, ponto, o que é, como se chega, custa-ou-é-grátis. O plano exige as seis.
6. **O cartão do link no WhatsApp leva a etiqueta** (`· não conferido` no título). A spec lista quatro superfícies; o cartão do link é superfície pública que sai do app e fica na conversa — sem a marca, o lugar não conferido circularia sem ela. A palavra é PENDENTE.
7. **As oito perguntas dela usam o texto das perguntas do painel**, já lidas por ele. A pergunta 4 da spec ("o que é, em uma frase") cai no texto do painel pro mesmo campo (`promessa`: "Em uma frase, por que alguém pegaria o carro pra ir até aí?"). "Horário e dias" são duas telas (são dois campos, dois instrumentos).
8. **O painel do João não lista nem age sobre rascunho de quem usa — só sobre lugar publicado** (ruling de produto da pré-auditoria, 07/10). O rascunho dela não aparece na lista de rascunhos do painel, as portas de rascunho do painel (`lerRascunho`, `regravarRascunho`, `moverRascunho`, `apagarRascunho`, e por elas `/admin/novo?slug=`) não o alcançam, e o publicar do painel não o leva ao ar (nem ela o dele). A spec só dá a ele lugar no ar; o rascunho dela não afirma nada até publicar, e é dela. Se ele quiser ver rascunhos dela, é rodada futura. A COLISÃO, ao contrário, vê todo rascunho (`todosOsRascunhos`), e quando o que colide é rascunho dela o painel diz isso com frase própria (`parDeRascunhoDeQuemUsa`, `enderecoDeRascunhoDeQuemUsa`) — nunca "continue por ele na lista do painel".
9. **Clerk sem `<ClerkProvider>`**, entrada pela tela hospedada (`redirectToSignIn`), middleware SÓ em `/contribuir` e `/api/contribuir`: o app público não carrega Clerk nenhum. O `vercel env pull` vai pra `.env.development.local`, não `.env.local` (que guarda o Turso da semente).
10. **Mudar nome ou cidade de um lugar dela no ar muda o documento, não o endereço** — a régua de 04/10 (endereço de lugar publicado só muda quando o João manda).
11. **As recusas da coerência "ganham versão pra ela"** em seis regras — as que os campos dela alcançam — e uma frase de reserva pro resto; a frase do painel (que nomeia outro lugar) nunca chega a ela. `preco-legivel-no-custo` ficou de fora porque só examina ficha paga COM chip, e ela não escreve chip.
12. **"Bloquear" esconde também os conferidos** ("TODOS os lugares dela"), e "Desbloquear" é um toque só (não esconde nem mostra nada).
13. **A tela da regra padrão mora em `/admin/chuva`**: segmento de tela com hífen colidiria com o endereço de um lugar (régua que um teste já trava).
14. **O "Calibrar" começa vazio e não mostra a regra padrão como referência** — seria convidar a copiá-la, e "ninguém calibrou" continuaria verdade com outra roupa.
15. **Editar o lugar dela no ar é uma tela com as perguntas todas**, não uma por tela (no rascunho é uma por tela).
16. **O lugar dela nunca toma o endereço antigo de outro lugar** (ruling de produto da pré-auditoria, 07/10). A regra de 04/10 diz que o endereço antigo leva ao novo; um lugar novo tomando o link quebraria isso pro link que já circula. O rascunho dela não nasce nem se muda pra um endereço antigo, e o publicar dela recusa no batch (a corrida). O publicar do JOÃO continua retomando, como hoje. Custo: em caso raro, ela vê a recusa de colisão.
17. **Toda colisão dela responde UMA frase, que não nomeia ninguém** (`NOME_JA_EM_USO`; I3 da pré-auditoria). As do painel falam do painel e nomeiam quem ocupa — que pode ser o rascunho de outra pessoa ou um lugar escondido. Em dois casos ela fica sem saída (o gêmeo sem cidade de um lugar do João, e um lugar real diferente de mesmo nome na mesma cidade): a frase não inventa saída, e o que fazer é decisão dele, no pacote de copy.
18. **"+ mandar um lugar" leva à lista dela (`/contribuir`), com "+ mandar um lugar novo" no topo** (I5 da pré-auditoria, ruling): toda frase que manda "voltar pela sua lista de lugares" tem destino. A spec dizia "com login → formulário"; agora é um toque a mais.

---

## Self-review

**1. Cobertura da spec.**

| Spec | Tarefa |
|---|---|
| Arquitetura: mesmas tabelas; `autor`/`conferido`/`regra_propria` por lugar; `regra_padrao`; `contribuidores` | 1 (tabelas, origem), 2 (regra própria derivada) |
| Login: Clerk, Google, só quem contribui; painel com a senha; passo do João | 9 |
| Gravação: rotas `/api/contribuir/*` com sessão, bloqueio, posse, não conferido; mesmas portas | 10, 11, 12 |
| P1: entrada na barra; formulário curto, uma pergunta por tela, editores do painel; publicar no ar na hora | 13, 14 |
| P1: rascunho em `ficha_rascunhos` com autor; desistir; endereço `nome-cidade`; colisão do par | 1, 10, 13 |
| P1: "Meus lugares"; edita enquanto não conferido; o editar some depois | 12, 14 |
| P1: o que não se pergunta a página cala; campos opcionais num schema só; a porta do João continua exigindo | 2, 4 |
| P2: a marca em lista, pin, topo, carimbo; palavras; nome de quem mandou não aparece; varredura + mutação por superfície | 3, 5 |
| P2: "Conferi" tira etiqueta e faixa; meia-linha só sai com regra própria | 3, 6, 8 |
| P3: seção "não conferidos" (nome, e-mail, data); "Conferi"; "Bloquear"/"Desbloquear" | 6, 15 |
| P3: concorrência = última gravação vale; histórico diz quem gravou | 1 (rótulo), 12 |
| P3: portões de coerência valem pra ela, frases na versão dela | 11, 12 |
| P4: regra padrão no banco, tela no painel, 3/6/0,2/cuidado; calibrar liga a regra própria; "seco" sem "carro comum" | 1, 3, 7, 8 |
| Bordas: sessão expirada; bloqueada; Clerk fora; banco fora | 9, 10, 13, 14, 15; banco fora = régua de hoje (`buscarFichas` estoura) |
| Testes da spec: marca; rotas 401/bloqueio/de outra/conferido/nunca do João; regra padrão; "seco"; cala por campo; bloquear/conferir; migração; portões | 1-15 |
| Ordem item 6 (copy → leitura → deploy) | 16 (PARADA) |

**2. Placeholders.** Varri "TBD", "TODO", "implement later", "similar to". Dos três ⚠️ que mandavam CONFERIR algo, dois foram resolvidos pela pré-auditoria (o seletor da ficha inteira é `data-testid="campo-<caminho>"`; o `rowsAffected` de `INSERT…SELECT` sem `RETURNING` conta certo no libsql 0.14, medido); resta o operador do teto (Task 7), com o comportamento esperado escrito ao lado.

**3. Tipos.** `OrigemDoLugar`/`LinhaDoAcervo`/`AcervoComOrigem` (Task 1) → `buscarFichas`/`noAr` (Task 2); `OrigemNoAr` (`conferido`, `regraPropria`) → `Voz.regraPropria` (Task 3) e a marca (Task 5); `QuemContribui` (Task 9) ≠ `Contribuidor` (Task 6, tem `bloqueado`) — nomes diferentes de propósito; `RegraPadrao` em todo lugar; `publicarRascunho(…, contribuidor)`; `violacaoIntroduzidaInteira` (Task 11) usada nas Tasks 11-12; `IDENTIDADE` e `LIVRE` declarados nas Tasks 6 e 10 e usados depois; `ROTAS`/`Onde` (Task 13) → páginas (Task 14). Da pré-auditoria: `Colisao`/`colisaoDoPar`/`colisaoDaMudanca` (Task 1) → rotas da pessoa (Tasks 10, 11, 12) e `fraseDoPainel` → `parOcupado`/`parDaTroca`/`parDaMudanca` (assinaturas de hoje, painel intacto); `RascunhoComDono`/`todosOsRascunhos`/`rascunhoDeQualquerUm` (Task 1) → `colisaoDoPar`, os `quemOcupa`/`porQueRecusou` e os testes das Tasks 10-11; `NOME_JA_EM_USO` (Task 10) → Tasks 10, 11, 12; `SEM_ENDERECO_ANTIGO` (Task 10) ao lado de `LIVRE`; `MANDAR_UM_LUGAR_NOVO` (Task 14).

**4. Review Focus.** As cinco linhas têm caso na tarefa dona: campo fora da lista (10, 11), corrida com Conferi/Bloquear (12, 15), par do João e endereço antigo (1, 10, 11), sessão vencida (10, 13), regra padrão torta (1, 7).

---

## Emendas da pré-auditoria (07/10)

Fonte: `.superpowers/sdd/2026-10-07-lugar-de-quem-usa/preflight.md` (2 C · 6 I · 13 M) e as rulings no fim de `progress.md`. Aplicadas no texto das tarefas ANTES da Task 1. Cada linha: o achado → o que mudou, e onde.

**Critical**

- **C1** (T2 deixava dois guardas vermelhos) → Task 2, Files e Step 8: o guarda de `tests/lib/campos-da-ficha.test.ts` passa a exigir EXATAMENTE `["condicao.regra", "discriminador"]`, com o "não sei" de cada bloco escrito; o caso de `tests/lib/severidade.test.ts` vira "ficha sem nível: o schema aceita, e a porta do JOÃO a recusa" (`obrigatoriosFaltando`). Nenhum guarda apagado. Step 9 roda `severidade.test.ts`; Step 10 ganha M11 (terceiro bloco opcional) e M12 (`condicao.severidade` com `obrigatorio: false`); `severidade.test.ts` no `git add`.
- **C2** (dublê do Clerk cego ao `vi.resetModules()`) → MEDIDO de novo nesta emenda, com o vitest 2.1.9 do repo, num arquivo descartável (apagado): o molde de estado num `const` falhou as duas sondas (401 e 503 esperados, 200 recebidos); o molde `globalThis.__sessaoDaPessoa ??= {…}` passou as três. Global Constraints: regra nova do dublê. Task 10, Step 1: `tests/sessao-da-pessoa.ts` com o estado em `globalThis` e o porquê medido no docblock; o caso "SONDA: a rota vê a sessão que o teste muda, nos três sentidos" abre a `describe` da porta; Step 8 ganha M17 (o dublê volta ao `const` → a sonda fica vermelha) e M9 também mata pela sonda. Tasks 11, 12, 14 e 15 herdam o helper sem mudança de texto.

**Important**

- **I1** (frases novas sob `src/app/admin` fora de `CUNHADAS_AQUI`) → Global Constraints (regra) e Mapa de arquivos; Task 6 Step 7, Task 7 Step 6, Task 8 Step 8, Task 13 Step 6, Task 15 Step 6: cada uma importa as suas frases e as acrescenta a `CUNHADAS_AQUI`, roda `tests/app/admin-editores-de-campo.test.tsx`, e põe o arquivo no `git add` e em Files.
- **I2** (T11 comparava TEXTO contra a porta que normaliza) → Task 11, Step 1: o caso vira "o documento completo dela vai ao ar com as mesmas respostas (normalizado)" e compara o OBJETO (`JSON.parse(doc)` `toEqual` `COMPLETO`), com o porquê medido no comentário. Step 7: M2 aponta pros casos da ROTA que a matam.
- **I3** (a pessoa recebia frase do painel e o nome de rascunho alheio) → Global Constraints (regra); Task 1, Step 7: `par-de-lugar.ts` devolve a colisão ESTRUTURADA (`Colisao`, `colisaoDoPar`, `colisaoDaTroca`, `colisaoDaMudanca`) e `fraseDoPainel` fala pelo painel (as portas do painel mantêm a assinatura); Task 10: `NOME_JA_EM_USO` (PENDENTE, com a nota de decisão dele sobre os dois casos sem saída), a rota do rascunho sem `quemOcupa`/`parOcupado`/`parDaMudanca`, quatro casos novos no POST e um no PUT, mutações M12–M14; Task 11: a rota de publicar e o `porQueRecusou` respondem `NOME_JA_EM_USO`, caso "o nome de um lugar do João", M9; Task 12: a rota do lugar com `colisaoDaMudanca`, caso "renomear pro nome de um lugar do João", M9–M10. Escolha 17.
- **I4** (o filtro de `listarRascunhos` mudava em silêncio a colisão e uma frase do João mentia) → Task 1, Files/Interfaces/Step 7: `todosOsRascunhos` e `rascunhoDeQualquerUm`; `colisaoDoPar` lê todo rascunho; `fraseDoPainel` usa `parDeRascunhoDeQuemUsa` quando o rascunho é dela; `quemOcupa` do painel usa `rascunhoDeQualquerUm` e `enderecoDeRascunhoDeQuemUsa`; casos novos em `tests/api/route-admin-rascunho.test.ts` (par e endereço de rascunho dela); mutações M15–M17; frases no 📝 da tarefa e na lista da Task 16.
- **I5** ("Meus lugares" sem entrada na tela) → Task 14, Interfaces e Step 5: a barra leva a `/contribuir`; "Meus lugares" tem `MANDAR_UM_LUGAR_NOVO` como primeiro link; casos novos em `contribuir-telas.test.tsx` (quem nunca mandou nada; o link antes da lista) e o da barra reescrito pra `/contribuir`; mutações M9–M11. Escolha 18.
- **I6** (`SECO_SEM_CARRO` nascia `LIDA:`) → Task 3, Step 1: nasce `PENDENTE` com o porquê no docblock, e entra no 📝 da tarefa. Task 16, Step 1: o guarda só aceita `LIDA:` em frase que já existia em `cc6c467` (lido por `git show`), com controle de leitura da base e controle da `LIDA` nova; Step 2 ganha a mutação do I6.

**Minor**

- **M1** (`problemaDaRegraPadrao` fantasma) → Task 1, docblock de `gravarRegraPadrao` aponta `lerRegraDoCorpo` (`porta-da-regra-padrao.ts`, Task 7); Mapa de arquivos: `regra-padrao.ts` → tarefas 1, 2; linha nova `porta-da-regra-padrao.ts` → 7, 8.
- **M2** (âncoras de linha) → Task 5, Files: `PinTrilha.tsx` `<a>` em `:61-68` (70 linhas). Task 11, Files: `porta-de-coerencia.ts:127-141`. Task 1, Files: MEDIDO de novo — a CHAMADA `await migrarColunaEnderecoAnterior(client);` está mesmo em `:105` (o preflight dizia `:116`); o texto agora diz "a chamada em `:105`, a função em `:119`", pra não haver ambiguidade.
- **M3** (instruções do Step 8 da T2 apontando pro que não existe) → Task 2, Step 8: os pontos de `ficha-fonte.test.ts` listados um a um (`umaLinha` `:7`, os `Map` à mão `:60`/`:85`, os vazios `:72`/`:120`, o helper LOCAL `lerTudo` `:142` — que EXISTE, local ao bloco; o preflight o deu como fantasma); o "dublê que RECUSA" de `ficha-do-dono.test.ts` saiu (não existe); o `:289` de `admin-tela-de-publicar.test.tsx` saiu da lista, de Files e do `git add`, com a razão certa (a página lê por `execute`).
- **M4** (seletor `data-campo` fantasma) → Task 8, Step 1: `[data-testid="campo-condicao.regra.limiar_mm"]` (e o da severidade), com o caso da Rampa como controle do mesmo seletor; o ⚠️ saiu.
- **M5** (mutações que a tarefa esperava ver sobreviver) → Task 8: a do `BLOCOS_QUE_NASCEM` com `"condicao"` saiu da tabela como EQUIVALENTE (o `regraSchema` recusa a meia regra de qualquer jeito), tabela renumerada. Task 9: a do `matcher` sem `"/contribuir"` saiu como EQUIVALENTE (o `:path*` aceita zero segmentos; a entrada fica pela leitura, declarada redundante). Task 10: a "bloqueio antes da sessão" saiu (não é reordenação aplicável: sem sessão não há `id`, só um `TypeError`).
- **M6** (T15 M6 citava o caso errado) → Task 15: caso novo em `db-bloquear.test.ts` ("quem JÁ passou pela porta … também é bloqueado", com `registrarContribuidor` antes), e a M6 passa a morrer nele e em "bloqueada no meio do formulário: 403".
- **M7** (textos de ordem) → Task 6, Files: "cresce nas Tasks 10, 12 e 15". Task 7, Step 5: "`contribuir` entra na Task 14, que é quem cria a pasta".
- **M8** (nome não ligado / import omitido) → Task 15, Step 5: `porta.pessoa.id` no `POST`, `id` no `PUT` e no publicar, e os imports de `estaBloqueado`/`BLOQUEADA` nas duas rotas. Task 7, Step 5: `import Link from "next/link"` e o import de `TITULO_REGRA_PADRAO` em `admin/page.tsx`.
- **M9** (a marca do título do link na mesma linha de um `LIDA:`) → Task 5, Step 3: a linha fica (alvo do cerco, acima da N12), com o ⚠️ explicando as duas marcas; Task 16, Step 3: ela entra na lista POR NOME, com as outras que o guarda não lê.
- **M10** (palavra em duas fontes; nome repetido com textos diferentes) → Task 14: `MANDAR_OUTRO` virou `MANDAR_UM_LUGAR_NOVO` ("+ mandar um lugar novo"), palavra diferente da barra porque leva a outro lugar. Task 7: `JANELA_NEGATIVA` da porta virou `JANELA_NEGATIVA_PADRAO` (teste, código e 📝).
- **M11** (as portas de rascunho do painel alcançavam o rascunho dela) → ruling de produto aplicado: Task 1, Step 7, `AND contribuidor IS NULL` em `lerRascunho`/`regravarRascunho`/`moverRascunho`/`apagarRascunho`, um caso cada em `db-origem.test.ts` (M11–M14 da tabela); a rota do endereço do painel passa a `rascunhoDeQualquerUm` (caso novo em `route-admin-endereco.test.ts`, M18). Propagado: os testes das Tasks 10 e 11 que liam o rascunho dela por `lerRascunho(c, …)` passam a `rascunhoDeQualquerUm` (senão leriam `null` e passariam por vacuidade), e o `porQueRecusou` da Task 11 também. Escolha 8 reescrita.
- **M12** (endereço antigo decidido pelo plano) → ruling de produto aplicado: Global Constraints e Review Focus 3; Task 1: o 1º passo do `publicarRascunho` recusa endereço antigo quando quem publica é ela (`? IS NULL OR NOT EXISTS …`), dois casos (ela recusada; o João continua retomando), M19–M20; Task 10: `SEM_ENDERECO_ANTIGO` em `criarRascunhoDaPessoa`/`moverRascunhoDaPessoa`, caso de banco e caso de rota, M15–M16; Task 11: o `porQueRecusou` diz `NOME_JA_EM_USO` quando o endereço virou antigo depois, caso e M10. Escolha 16.
- **M13** (`condicao.regra_texto` sem caso de "cala") → Task 4: o 📝 de cobertura campo a campo, com o grep que prova que nenhuma tela pública mostra `regra_texto`.

**Também corrigido ao passar:** Task 5 citava "escolha 4" pro cartão do WhatsApp (é a escolha 6); Task 11 M2 citava um caso de `lib` pra uma mutação de rota; Task 15 trocou o ⚠️ do `rowsAffected` pelo resultado MEDIDO no preflight (conta certo sem `RETURNING`); o Self-review (Placeholders, Tipos, Review Focus) acompanha as emendas.

**Não resolvido no texto:** nada. Duas coisas ficam, de propósito, como DECISÃO DELE no pacote de copy (não são lacuna do plano): o que a pessoa faz nos dois casos em que `NOME_JA_EM_USO` a deixa sem saída (o gêmeo sem cidade de um lugar do João; um lugar real diferente de mesmo nome na mesma cidade), e se ele quer, numa rodada futura, ver os rascunhos de quem usa.
