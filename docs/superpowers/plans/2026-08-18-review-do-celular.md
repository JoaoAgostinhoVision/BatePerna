# Plano — o review do celular (8 tasks + revisão da branch)

**Spec:** `docs/superpowers/specs/2026-08-18-review-do-celular.md`
**Base:** `main` em `f10f075`, **539 testes em 47 arquivos**, `tsc` limpo, `npm run build` passa
(os três conferidos antes de abrir a rodada).
**Branch:** `review-do-celular`

---

## 🔴 A ORDEM É EXPANDIR → MIGRAR → CONTRAIR, e ela existe por um erro medido

Esta rodada **apaga campos** (`esforco`, `duracao`) que hoje têm consumidores em quatro arquivos.
Apagá-los cedo deixa o `tsc` vermelho no meio da rodada — foi exatamente o que forçou o ruling
"Task 8 antes da Task 7" na rodada passada.

Por isso:

1. **Tasks 2–3 EXPANDEM:** os campos novos entram e os velhos continuam de pé. Tudo verde.
2. **Tasks 4–7 MIGRAM** os consumidores, um por vez. Tudo verde.
3. **Task 8 CONTRAI:** os velhos são apagados quando ninguém mais os lê.

**Toda task termina com `npm test` + `npx tsc --noEmit` + `npm run build` verdes.** Nenhuma pode
deixar dívida de compilação pra próxima (lição 9: suíte verde não prova que o app constrói).

**Ordem obrigatória: 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8.** A 1 é independente e vai na frente por ser
a mais isolada; a 4 (`FaixaKm`) não depende da 3, mas vem antes da 5 porque a 5 a consome.

**Em todo despacho, as duas instruções que já pagaram cinco vezes:**
> *Se a prova de mutação não morder, **pare e diga** — não afrouxe a asserção.*
> *Se a contagem de testes não bater com a esperada, **não ajuste o relatório: descubra por quê**.*

---

## Task 1 — o GPS pede sozinho na primeira abertura

**Files:** Modify `src/app/local.tsx`, `src/app/DistanciaDaqui.tsx` (só comentário);
Test: `tests/app/local.test.tsx`

### O que muda

1. `src/app/local.tsx:98` — `if (guardado.tipo === "gps") buscarGps();` passa a **buscar sempre**
   na montagem.
2. **O ramo de erro deixa de ser cego.** Hoje qualquer falha grava `bp.gps = "negado"` pra sempre.
   Passa a gravar **só quando `err.code === 1`** (`PERMISSION_DENIED`). `2` (POSITION_UNAVAILABLE)
   e `3` (TIMEOUT) não gravam nada — o app segue sem localização e tenta na próxima abertura.
3. `DistanciaDaqui.tsx:7-9` — o comentário afirma que a distância fica atrás de um toque *"de
   propósito: prompt não solicitado é o jeito mais rápido de ser negado pra sempre"*. **Vira
   mentira nesta task.** Reescrever: o pedido agora é automático por decisão do João, o botão
   sobrou como caminho de quem ainda está sem posição, e o remédio pro risco é o item 2.

🔴 **O item 2 não é enfeite e não é "de brinde".** Ele existe porque o item 1 o cria: com pedido
automático, um balão descartado ou um prédio sem sinal rebaixariam o app **permanentemente** na
primeira abertura. Sem ele, esta task é uma regressão.

### O alcance, que o pré-voo mediu e o brief não deixaria adivinhar

`<LocalVivo>` é montado **em duas páginas**: a home (`page.tsx`) e a ficha (`[slug]/page.tsx:90`).
Então o pedido automático vale nas duas — abrir uma ficha direto pelo link também pede o GPS.
**Isso é o certo** ("uma pessoa, uma fonte": é o mesmo provedor, não dois pedidos), e é a razão de
o botão do `DistanciaDaqui` virar caminho de exceção em vez de porta principal. Não "conserte"
restringindo o pedido à home.

### A invariante que esta task chega perto de quebrar

**Primeiro render sem localização, SEMPRE.** `useState(NAO_SEI)` continua; a busca mora no
`useEffect`. O teste que trava isso já existe — ele não pode ser afrouxado pra caber a mudança.

### Os testes

```tsx
// tests/app/local.test.tsx

// O pedido do João, e o oposto exato do que o app faz hoje.
it("sem nada guardado, monta e JÁ chama getCurrentPosition", ...)

// Herdado, e é a invariante: a busca é do efeito, não do render.
it("o primeiro render é 'não sei', mesmo com posição guardada", ...)

// O remédio. Três testes, um por código — em bloco não prova nada.
it("erro code 1 (permissão negada) grava bp.gps = negado", ...)
it("erro code 2 (posição indisponível) NÃO grava nada", ...)
it("erro code 3 (timeout) NÃO grava nada", ...)

// Herdado: falha não apaga a posição que já estava certa.
it("erro não apaga a localização que já existia", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | volta o `if (guardado.tipo === "gps")` | "monta e JÁ chama getCurrentPosition" |
| 2 | o ramo de erro grava `"negado"` sem olhar o `code` | "code 2 NÃO grava" **e** "code 3 NÃO grava" |
| 3 | `err.code === 1` vira `err.code !== 1` | "code 1 grava negado" |
| 4 | `useState(NAO_SEI)` → lê o storage no render | "o primeiro render é 'não sei'" |

⚠️ **Sobre a #2:** um teste só, com um `code` só, aprova o mutante. São **três** casos porque são
três códigos, e dois deles mudam de comportamento nesta task.

---

## Task 2 — `piso.ts`, o schema expandido e o questionário reescrito

**Files:** Create `src/lib/piso.ts`; Modify `src/types/ficha.ts`, `src/lib/geo.ts`,
`docs/questionario-ficha.md`; Test: `tests/lib/piso.test.ts` (novo), `tests/lib/ficha.test.ts`,
`tests/lib/geo.test.ts`

### O que muda

**`src/lib/piso.ts`** — puro, **sem zod e sem `node:fs`** (client components vão lê-lo; é a mesma
razão que exilou `formatarDuracao` e `coordDaDistancia`):

```ts
export const PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"] as const;
export type Piso = (typeof PISOS)[number];
export const PISOS_FILTRAVEIS = PISOS.slice(1);   // DERIVADO. Nunca uma segunda lista.
export function ordemPiso(p: Piso): number
export function rotuloPiso(p: Piso): string       // "asfalto esburacado"
```

**A ordem do array É a escala**, do pior pro melhor. Isso vai escrito no módulo, porque é a única
coisa que faz `ordemPiso` significar alguma coisa.

**`src/types/ficha.ts`:**
- `piso: z.enum(PISOS).optional()` — **montado a partir do `PISOS`**, não uma lista repetida.
- `extensaoKm: z.number().positive().optional()` — km, **só ida**.
- `esforco` e `duracao` **continuam** (a contração é a Task 8). Comentar que estão de saída.

**`src/lib/geo.ts`** ganha `formatarExtensao(km: number): string` → **`"4 km de trilha"`**, a
frase inteira, sufixo incluído.

🔴 **Ruling do pré-voo, e a razão importa:** o cartão (Task 6) e a ficha (Task 7) mostram o MESMO
número, e duas formatações escritas em dois arquivos é a invariante "uma trilha, uma fonte"
quebrada por dentro — foi exatamente assim que a mesma trilha chegou a ter **dois km** na rodada
passada. O sufixo mora **dentro** da função pra que nenhum chamador possa deixá-lo cair. Mora em
`geo.ts` porque lá já é a casa client-safe do "km virando texto"; um módulo novo de uma função só
repetiria o `duracao.ts` que esta rodada está apagando.

**`docs/questionario-ficha.md`:** as perguntas de `esforco` e `duracao` são **substituídas** por:
- **`piso`** — *"o pior trecho do caminho"*, com as quatro opções e o que cada uma quer dizer.
- **`extensaoKm`** — *"quantos km, **só ida**"*.

O texto tem que dizer que os dois são **opcionais** e que ficha sem eles nunca é escondida.

### Os testes

```ts
// tests/lib/piso.test.ts

// A escala existe pra ser comparada; sem isto, ordemPiso é decoração.
it("a ordem vai do pior pro melhor: barro < paralelepipedo < esburacado < tapete", ...)

// 🔴 O teste que impede a segunda lista escrita à mão.
it("PISOS_FILTRAVEIS é PISOS sem o primeiro — derivado, não copiado", ...)

it("rotuloPiso troca o hífen por espaço: asfalto-esburacado → 'asfalto esburacado'", ...)

// tests/lib/geo.test.ts — o sufixo é da FUNÇÃO, não do chamador.
it("formatarExtensao(4) devolve '4 km de trilha', com o sufixo", ...)
it("formatarExtensao não devolve o mesmo formato de formatarDistanciaCurta", ...)

// tests/lib/ficha.test.ts
it("ficha com piso inválido ('terra') não valida", ...)
it("ficha SEM piso e SEM extensaoKm valida — os dois são opcionais", ...)
it("extensaoKm zero ou negativa não valida", ...)
// A ficha REAL. Sintética prova a função; só a real prova o conteúdo (lição 10).
it("a Rampa continua carregando, sem piso e sem extensão", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | trocar dois vizinhos na ordem de `PISOS` | "a ordem vai do pior pro melhor" |
| 2 | `PISOS_FILTRAVEIS` vira lista literal com os 3 nomes | "derivado, não copiado" — **se não cair, o teste está comparando com outra lista literal minha, e é inútil** |
| 3 | `.optional()` sai do `piso` | "ficha SEM piso… valida" **e** "a Rampa continua carregando" |
| 4 | `.positive()` sai do `extensaoKm` | "zero ou negativa não valida" |

⚠️ **A #2 é a razão desta task existir com teste próprio.** O jeito errado de escrever esse teste
é `expect(PISOS_FILTRAVEIS).toEqual(["paralelepipedo", ...])` — passa igual com a lista copiada à
mão. Tem que ser comparado **contra `PISOS`**.

> 🔴 **EMENDA DO PRÉ-VOO (2026-08-19) — a #2 é IMPOSSÍVEL na camada que eu escolhi. MEDIDA.**
> Apliquei a mutação (`PISOS_FILTRAVEIS` virando lista literal com os três nomes) e rodei:
> **`tests/lib/piso.test.ts` fecha 3/3 VERDE.** Comparar contra `PISOS` não resolve — em runtime,
> lista derivada e lista copiada à mão com o mesmo conteúdo **são o mesmo valor**, e nenhuma
> asserção de valor as distingue. O meu plano pediu uma coisa que a camada não pode dar.
> **O remédio é asserção de FONTE**, o mesmo precedente do `"use client"` que o jsdom não enxerga
> (`tests/app/DistanciaDaqui.test.tsx:120-125`, `tests/app/MapaHome.test.tsx:393-399`):
> `expect(fonte).toMatch(/PISOS_FILTRAVEIS\s*=\s*PISOS\.slice\(/)`.
> **O teste de valor FICA como cinto** — ele é o que morde quando alguém acrescenta um 5º piso a
> `PISOS` e a cópia não acompanha. São coisas diferentes, e a diferença vai no comentário.

---

## Task 3 — os recortes novos em `filtros.ts` (convivendo com os velhos)

**Files:** Modify `src/lib/filtros.ts`; Test: `tests/lib/filtros.test.ts`

### O que muda

`Filtros` ganha, **sem perder nada ainda**:

```ts
distanciaKm: number | null      // era 30 | 60 | null — agora número livre
extensaoMaxKm: number | null    // novo
pisoMinimo: Piso | null         // novo
esforco / duracaoMax            // continuam, saem na Task 8
```

**Limites, e eles moram aqui** (a faixa da Task 4 os lê; escrever de novo lá seria duas fontes):

```ts
export const DIST_MAX_KM = 100, DIST_PASSO_KM = 5;
export const EXT_MAX_KM  = 20,  EXT_PASSO_KM  = 1;
```

**`lerFiltros`** — a validação de `distanciaKm` deixa de ser "está no conjunto?" e vira intervalo:
inteiro finito, `>= passo`, `<= max`. Qualquer outra coisa → `null`. Idem `extensaoMaxKm`.
`pisoMinimo` valida contra `PISOS`.

**`passaNoFiltro`** ganha os dois recortes:

```ts
// Teto INCLUSIVO nos dois — precedente cravado na rodada passada.
if (f.extensaoMaxKm !== null && ficha.extensaoKm && ficha.extensaoKm > f.extensaoMaxKm) return false;
if (f.pisoMinimo !== null && ficha.piso && ordemPiso(ficha.piso) < ordemPiso(f.pisoMinimo)) return false;
```

**`contarLigados`** passa a contar os recortes novos.

### 🔴 O pré-voo (não descubra isto sozinho no meio)

- **`typeof NaN === "number"`.** `Number.isFinite` é o único que pega `NaN`, e foi assim que a
  Task 5 da rodada passada quase entrou furada. **Caso de teste próprio.**
- **`lerFiltros` valida cinco campos** e um teste em bloco não prova nenhum: cada campo precisa do
  seu caso, com **um** valor errado por vez (lição 2 — num OU, a cláusula que dispara primeiro
  esconde as outras).
- **A regra de honestidade 2 é a razão de `ficha.piso &&` estar ali.** Ficha sem o campo nunca é
  escondida. Apagar esse `&&` tem que derrubar um teste nomeado.

### Os testes

```ts
// A escala, e ela precisa dos TRÊS resultados na mesma pergunta.
it("pisoMinimo 'asfalto-esburacado': esconde barro e paralelepípedo, mostra esburacado e tapete", ...)
it("ficha SEM piso passa com qualquer pisoMinimo ligado", ...)     // honestidade 2
it("ficha SEM extensaoKm passa com qualquer extensaoMaxKm ligado", ...)

// Teto inclusivo, o par exato.
it("extensão 4 com corte 4 PASSA; extensão 5 com corte 4 não", ...)

// lerFiltros, campo a campo, um erro por vez.
it("distanciaKm 0 → null", ...)
it("distanciaKm 101 (acima do teto) → null", ...)
it("distanciaKm NaN → null", ...)          // o typeof mentiroso
it("distanciaKm '30' (texto) → null", ...)
it("distanciaKm 7 (fora do passo, dentro do intervalo) → 7", ...)  // decisão: passo é da UI
it("pisoMinimo 'terra' → null", ...)
it("filtro guardado da versão VELHA ({duracaoMax:120, esforco:'media'}) não estoura e não filtra", ...)

// contarLigados com TODOS ligados — apagar um do array tem que doer.
// 🔴 SETE, não cinco: durante a EXPANSÃO o `Filtros` carrega os dois velhos
// (esforco, duracaoMax) junto dos novos. Vira 5 só depois da Task 8. Se a sua
// contagem não bater com esta, NÃO ajuste o teste — descubra por quê.
it("com os sete recortes ligados, conta 7", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | `<` vira `<=` na comparação de piso | "esconde barro e paralelepípedo, mostra esburacado" |
| 2 | `ficha.piso &&` some | "ficha SEM piso passa" |
| 3 | `ficha.extensaoKm &&` some | "ficha SEM extensaoKm passa" |
| 4 | `>` vira `>=` na extensão | "extensão 4 com corte 4 PASSA" |
| 5 | `Number.isFinite` sai da validação | "distanciaKm NaN → null" |
| 6 | o teto `<= DIST_MAX_KM` sai | "distanciaKm 101 → null" |
| 7 | tirar `pisoMinimo` do array do `contarLigados` | "com os sete recortes ligados, conta 7" |

**Antes de declarar qualquer linha morta, rode `npx tsc --noEmit`** — lição 13: há linhas que o
vitest diz mortas e o `tsc` carrega (foi o caso do guarda do `lerFiltros`).

> 🔴 **EMENDAS DO PRÉ-VOO (2026-08-19) — quatro furos meus. As detalhadas estão em
> `.superpowers/sdd/2026-08-18-review-do-celular/task-3-brief.md`; o essencial fica aqui porque
> aquele arquivo é scratch.**
>
> 1. **A mutação #5 é impossível como escrita — MEDIDA.** `Number.isInteger` já recusa `NaN`,
>    `Infinity`, texto e fracionário sozinho (medido em node), então `Number.isFinite` ao lado é
>    redundante e **inprovável**: nenhuma mutação o mata. A validação é
>    `Number.isInteger(v) && v >= PASSO && v <= MAX`, e a mutação vira **"`Number.isInteger` sai"**,
>    que tem que derrubar **três** testes: NaN, `"30"` texto e **7,5 (novo)**. Sem `isInteger`,
>    `"30" >= 5` é `true` por coerção e `distanciaKm` viraria uma **string** no estado do app.
>    Mutação irmã, separada: **o piso `>= DIST_PASSO_KM` sai** → "distanciaKm 0 → null".
> 2. **`pisoMinimo` valida contra `PISOS_FILTRAVEIS`, não contra `PISOS`.** `barro` é o piso da
>    escala: aceso, não esconde nada, **e o painel da Task 5 não desenha chip de barro** — a linha
>    diria "1 filtro ligado" sem nenhum controle na tela pra desligar. É irmão exato do deferido já
>    registrado no RESUME (o `contarLigados` contando `distanciaKm` sem o grupo Distância na tela).
>    Teste: `it("pisoMinimo 'barro' → null …")`; mutação: "a validação volta a olhar `PISOS`".
> 3. **O teste do filtro guardado velho tem o nome errado PARA ESTA FASE.** Na expansão, `esforco`
>    e `duracaoMax` continuam sendo lidos e continuam recortando — um filtro velho **filtra sim**.
>    Aqui o teste é *"não estoura, e os campos novos vêm null"*; o *"não filtra"* é da Task 8.
>    Junto: `it("os valores guardados 30 e 60 da versão velha continuam válidos no intervalo novo")`
>    — o celular dele tem `bp.filtros` gravado de verdade.
> 4. **Dois testes existentes ficam com o nome mentindo e o brief não os citava:**
>    `"contarLigados conta os CINCO recortes"` (l. 253) e `"preserva os CINCO campos válidos"`
>    (l. 289). Viram SETE. **Estender os dois, não criar um terceiro ao lado** — e é o segundo que
>    importa: sem estendê-lo, os dois campos novos ficam sem prova de que sobrevivem ao `lerFiltros`.

---

## Task 4 — `FaixaKm`: a barra e o campo

**Files:** Create `src/app/FaixaKm.tsx`; Modify `src/app/home.css`;
Test: `tests/app/FaixaKm.test.tsx` (novo)

### O que muda

Componente genérico (serve aos dois recortes), **sem saber o que é distância**:

```tsx
<FaixaKm rotulo="Distância daqui" valor={n|null} max={100} passo={5} onChange={fn} />
```

1. **Barra** (`<input type="range">`) de `passo` até **`max + passo`**. A parada extra vale
   **`null`** — "qualquer".
2. **Campo** (`<input type="number" inputMode="numeric">`) — o caminho preciso. Vazio = qualquer.
3. **Um valor só:** os dois escrevem no mesmo `onChange`. Nenhum estado local espelhando o valor.
4. **O campo prende no intervalo `[passo, max]` e mostra o valor preso**, na hora. Nunca aceita
   150 na tela e filtra por 100.
5. **Alvo de toque ≥44px de altura** na faixa (`home.css`), com pegador grande.

🔴 **Por que a parada extra, e não "o fim da barra é qualquer":** se o fim fosse `100` chamado de
"qualquer", uma trilha a 130 km sumiria com a tela dizendo "qualquer distância". É a família de
mentira que este app inteiro persegue. **A última parada é um estado (`null`), não um número.**

### Os testes

```tsx
it("arrastar até a última parada devolve null, não o máximo", ...)
it("com valor null, a barra fica na última parada e o texto diz 'qualquer'", ...)
it("digitar 45 devolve 45", ...)
it("digitar 150 devolve 100 E o campo passa a MOSTRAR 100", ...)   // preso e visível
it("digitar 0 devolve o passo (5), e o campo mostra 5", ...)
it("apagar o campo devolve null", ...)
it("mudar a barra atualiza o campo — um valor só", ...)
it("mudar o campo atualiza a barra — um valor só", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | `max` da barra vira `max` (sem a parada extra) | "arrastar até a última parada devolve null" |
| 2 | a conversão "posição > max → null" some | idem |
| 3 | o `clamp` do campo some | "digitar 150 devolve 100" |
| 4 | o campo prende o valor mas **não** re-exibe o preso | "**E o campo passa a MOSTRAR 100**" |
| 5 | o campo passa a ter estado local próprio | "mudar a barra atualiza o campo" |

⚠️ **A #4 é a que quase sempre falta:** prender o valor e deixar o `input` mostrando o que a
pessoa digitou é a tela mentindo sobre o que está filtrando. **A asserção tem que ler o `value` do
campo depois**, não só o argumento do `onChange`.

🔴 **Ao acrescentar regras no `home.css`, releia quem lê esse arquivo por TEXTO** (lição 20): uma
asserção que casa "a regra `.bp` inteira" muda de significado sem uma linha de diff no teste, e a
suíte fica verde com a constante que ela protegia invalidada. Já aconteceu aqui, com o
`tests/lib/mapa.test.ts`. **Confira nominalmente**: `npx vitest run tests/lib/mapa.test.ts` antes
e depois, e leia se as asserções de CSS ainda casam o que diziam casar.

⚠️ **O que este teste NÃO prova:** que dá pra arrastar com o polegar. Nenhum teste desta suíte
mede geometria renderizada (lição 5). A altura de toque vira asserção de CSS pela régua central
(`tests/css.ts`, `valorDe` + `toBe`), e o resto é iPhone.

---

## Task 5 — o painel: duas faixas e os chips de piso

**Files:** Modify `src/app/PainelFiltros.tsx`; Test: `tests/app/PainelFiltros.test.tsx`

### O que muda

- **Sai** o grupo `Duração` inteiro. **Sai** o grupo `Esforço`.
- **Distância** deixa de ser chips e vira `<FaixaKm>`; a legenda passa a **"Distância daqui"**.
- **Tamanho da trilha** — `<FaixaKm>` novo.
- **Piso** — chips dos **três** de `PISOS_FILTRAVEIS`, com `rotuloPiso`, no padrão que já desliga
  no segundo toque (`x === v ? null : v`, o mesmo do grupo Esforço de hoje).
- A legenda do grupo tem que dizer **mínimo** ("Piso, no mínimo"), senão "asfalto tapete" lê como
  "só asfalto tapete".
- O grupo de distância continua só aparecendo **quando há localização** (regra herdada).

### Os testes

```tsx
it("não existe mais grupo Duração nem grupo Esforço", ...)
it("o chip 'barro' NÃO aparece — é o piso da escala, filtraria nada", ...)
it("tocar duas vezes no mesmo chip de piso desliga", ...)     // o pedido original do João
it("sem localização, o grupo Distância daqui não aparece", ...)
it("a faixa de distância escreve no contexto de filtros", ...)
it("a faixa de tamanho escreve no contexto de filtros", ...)
it("a legenda do piso diz que é mínimo", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | os chips passam a mapear `PISOS` (com barro) | "o chip 'barro' NÃO aparece" |
| 2 | o chip de piso vira `trocar({pisoMinimo: p})` sem o ternário | "tocar duas vezes… desliga" |
| 3 | o `temLocal &&` some | "sem localização, o grupo… não aparece" |
| 4 | a faixa de tamanho passa o valor pro `distanciaKm` | "a faixa de tamanho escreve no contexto" — **a asserção tem que nomear o CAMPO, não só 'mudou'** |

---

## Task 6 — o cartão

**Files:** Modify `src/app/CartaoTrilha.tsx`; Test: `tests/app/CartaoTrilha.test.tsx`

### O que muda

`~27 km em linha reta · 1h30 · média · R$ 5` → `~27 km em linha reta · 4 km de trilha · barro · R$ 5`

- Sai `formatarDuracao(ficha.duracao)`; entra **`formatarExtensao(ficha.extensaoKm)`** — a função
  criada na Task 2, que já traz o sufixo. **Não escreva o sufixo aqui**: a ficha (Task 7) chama a
  mesma função, e duas formatações do mesmo número é o defeito dos dois km com outra roupa.
- `ficha.esforco` vira `rotuloPiso(ficha.piso)`.
- Campos ausentes continuam simplesmente não aparecendo (a linha some inteira se nada sobrar).

🔴 **O sufixo "de trilha" é load-bearing**, não estilo: sem ele o cartão mostra **dois números em
km** lado a lado — "quão longe daqui" e "quão longa a trilha" — e nada na tela os distingue. É o
defeito dos dois km da rodada passada com outra roupa.

### Os testes

```tsx
// A asserção lê o TEXTO INTEIRO da linha. /km/ casa nos dois números e não prova nada.
it("com localização e extensão, a linha é '~X km em linha reta · N km de trilha · …'", ...)
it("sem extensaoKm, a linha não inventa e não deixa separador solto", ...)
it("sem piso, idem", ...)
it("a Rampa REAL (sem piso, sem extensão) mostra só distância e custo", ...)   // lição 10
it("'em linha reta' continua no texto", ...)                                   // invariante
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | o sufixo "de trilha" some | "a linha é '~X km em linha reta · N km de trilha…'" |
| 2 | a extensão é mostrada mesmo ausente (`?? 0`) | "sem extensaoKm, a linha não inventa" |
| 3 | `formatarDistanciaCurta` → número cru | "'em linha reta' continua no texto" |

---

## Task 7 — a ficha: piso e extensão junto ao Trajeto

**Files:** Modify `src/app/[slug]/page.tsx`, `src/app/ficha.css`;
Test: `tests/app/ficha.test.tsx` (ou o arquivo que hoje renderiza a página)

### O que muda

Dentro do bloco **📍 Trajeto**, junto da distância daqui: **o piso** e **a extensão**. Nada de
frase nova — a prosa já é o `acesso`, logo abaixo.

**Use `formatarExtensao` e `rotuloPiso`** — as mesmas funções que o cartão usa. Formatar de novo
aqui é a mesma trilha ganhando duas caras.

Campos ausentes: a linha não aparece. Nada de "—" nem "não informado".

### Os testes

```tsx
// 🔴 Renderizando [slug]/page.tsx DE VERDADE — não um componente vizinho (lição 3).
it("ficha com piso e extensão mostra os dois dentro do bloco Trajeto", ...)
it("ficha sem os dois não mostra linha vazia nem separador solto", ...)
it("a Rampa real continua abrindo", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | mover o piso pra fora do bloco Trajeto | "mostra os dois **dentro do bloco Trajeto**" — a asserção tem que ser sobre a posição, não sobre existir |
| 2 | o guarda de ausência some | "não mostra linha vazia" |
| 3 | trocar `formatarExtensao(n)` por `` `${n} km` `` escrito à mão | "cartão e ficha mostram o MESMO texto de extensão" |

---

## Task 8 — A CONTRAÇÃO: apagar o que ninguém mais lê

**Files:** Modify `src/types/ficha.ts`, `src/lib/filtros.ts`, `src/lib/ficha.ts`;
Delete `src/lib/duracao.ts`; Test: apagar `tests/lib/duracao.test.ts` e o que restar

### O que muda

- `esforco` e `duracao` **saem do schema**; `esforcoSchema`/`type Esforco` somem.
- `esforco` e `duracaoMax` **saem do `Filtros`**, do `SEM_FILTRO`, do `lerFiltros` e do
  `contarLigados`.
- `src/lib/duracao.ts` é **apagado**, junto do reexport em `src/lib/ficha.ts:69`.

**Só entre nesta task depois de `rg "esforco|duracao|Esforco|Duração"` voltar limpo em `src/`.**
Se voltar sujo, a task anterior não terminou — não contorne.

### Os testes

```ts
it("filtro guardado com duracaoMax e esforco continua não estourando", ...)  // o iPhone dele
// CINCO: distanciaKm, daHoje, soGratis, extensaoMaxKm, pisoMinimo. Eram sete
// durante a expansão. Contagem que não bate = descubra por quê, não ajuste.
it("contarLigados agora conta 5 recortes, todos ligados", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | tirar um dos 5 do array do `contarLigados` | "conta 5 recortes, todos ligados" |
| 2 | `lerFiltros` estourar em chave desconhecida | "filtro guardado… continua não estourando" |

**A verificação desta task é o `npm run build`**, não o vitest: apagar um módulo reexportado é
exatamente o tipo de coisa que a suíte não vê (lição 9).

---

## Depois das oito

1. `npm test` + `npx tsc --noEmit` + **`npm run build`** — os três, na branch.
2. **Medir no navegador** com `npm run build` + `next start` (nunca junto do `next dev` —
   compartilham o `.next/`, lição 21): a faixa arrasta? o campo mostra o valor preso? o painel
   ainda empurra a lista sem pular?
3. 🔴 **Revisão da branch inteira** — 7ª rodada seguida em que ela é obrigatória; nas seis
   anteriores ela achou o que nenhuma revisão de task pegou, e nas duas últimas o achado foi de
   **junção**. Assunto desta vez: *o vocabulário do piso está mesmo num lugar só?* e *o cartão e a
   ficha mostram o MESMO número de extensão?*
4. Merge `--no-ff`, deploy (`npx --yes vercel@latest --prod --yes`), conferir com `curl`.
5. Atualizar `docs/RESUME.md`: o que foi entregue, o que o iPhone ainda decide, e a pendência do
   questionário — que agora vale mais, porque as perguntas mudaram.
