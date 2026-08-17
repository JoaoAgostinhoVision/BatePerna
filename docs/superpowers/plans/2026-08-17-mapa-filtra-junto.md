# Plano — o mapa filtra junto (2 tasks)

**Spec:** `docs/superpowers/specs/2026-08-17-mapa-filtra-junto.md`
**Base:** `main` em `a21c511`, **523 testes em 46 arquivos**, `tsc` limpo, build passa.

**Ordem obrigatória: A → B.** A B depende da estrutura que a A cria.

---

## Task A — a conta sobe, e continua sendo UMA

**Files:**
- Create: `src/app/MioloHome.tsx`
- Modify: `src/app/page.tsx`, `src/app/FolhaTrilhas.tsx`, `src/app/MapaHome.tsx`
- Test: `tests/app/MioloHome.test.tsx` (novo), `tests/app/FolhaTrilhas.test.tsx` (ajustar)

### O que muda

Hoje `confia` e `visiveis` nascem **dentro** da `FolhaTrilhas`, e o `MapaHome` é irmão dela no
`page.tsx`. A conta sobe pra um dono único — `MioloHome`, client component — que:

1. recebe `pares` (ficha+leitura, ordem já decidida pelo servidor) e as `leituras` do mapa;
2. calcula `confia` a partir de **`pares`** (todas — as três razões estão na spec §5) e
   `visiveis = pares.filter(passaNoFiltro(...))`, **uma vez, num escopo léxico só**;
3. renderiza, nesta ordem, `<MapaHome>` (com as **visíveis**), `<PainelFiltros visiveis={n}>` e a
   folha.

A `FolhaTrilhas` **para de calcular** e passa a receber `visiveis` e `confia` por prop. Ela
continua dona do agrupamento e do estado vazio.

🔴 **A regra que não pode ser quebrada, e é a razão desta task existir:** o array é **um só**.
Nada de o mapa refazer o `filter` "porque é barato". Se duas expressões produzirem a lista, é o
Critical de duas rodadas atrás com outra roupa.

### Os testes (o pré-voo já está aplicado — leia os comentários)

```tsx
// tests/app/MioloHome.test.tsx

// A JUNÇÃO, e é o teste que esta task existe pra ter. Os três desenham da
// mesma lista: os PINS do mapa, a CONTAGEM da linha e os CARTÕES da folha.
// Asserta os três NA MESMA renderização — comparar cada um com um número que
// eu escrevi no teste provaria três vezes a mesma suposição minha.
it("com filtro ligado, pins, contagem e cartões são a MESMA lista", ...)

// O quadro que o Critical de duas rodadas atrás produziu: uma leitura nova
// chega pelo contexto DEPOIS do primeiro paint, e algo repinta e algo não.
it("leitura nova chegando com filtro ligado: os três continuam concordando", ...)

// A invariante herdada, que subir a conta pode quebrar sem ninguém ver.
it("o PRIMEIRO render mostra TODOS os pins, mesmo com filtro guardado", ...)

// `confia` sai de `pares`, não de `visiveis` — decisão registrada, não
// otimizável. Trilha escondida pelo filtro, com leitura estragada, ainda
// derruba os cabeçalhos das que ficaram.
it("trilha escondida pelo filtro ainda derruba o agrupamento", ...)
```

### Prova de mutação — cada uma tem que derrubar ASSERÇÃO, não deixar a suíte vermelha por erro global

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | `<MapaHome>` recebe `pares` em vez de `visiveis` | "pins, contagem e cartões são a MESMA lista" |
| 2 | o mapa refaz o `filter` por conta própria (mesma expressão, segundo array) | idem — **e se NÃO cair, o teste está fraco: ele tem que comparar identidade de conteúdo, não dois números que eu escrevi** |
| 3 | `confia` passa a sair de `visiveis` | "trilha escondida pelo filtro ainda derruba o agrupamento" |
| 4 | `useState(SEM_FILTRO)` → ler o `localStorage` no render | "o PRIMEIRO render mostra TODOS os pins" |
| 5 | a contagem da linha vira `pares.length` | "pins, contagem e cartões…" |

---

## Task B — o caso vazio

> **EMENDADA depois da Task A** — o item 1 já está satisfeito e duas mutações viraram no-op.
> Ver "O que a Task A mudou nesta task", abaixo.

**Files:** Modify `src/app/MapaHome.tsx`; Test: `tests/app/MapaHome.test.tsx`

### O que muda

1. ~~Pins, enquadramento e `.mapa-fora` saem todos das visíveis.~~ **JÁ FEITO na Task A**: o
   `MioloHome` entrega `fichas={visiveis}`, então dentro do `MapaHome` **`fichas` já É a lista
   visível**. Não há nada a mudar aqui.
2. **Vazio com localização:** `enquadrarComVoce([], voce, …)` já devolve zoom 11 (~26 km em volta
   de você) — o que era deferido "inalcançável" vira **decisão**, e ganha teste.
3. **Vazio sem localização:** **mantém o último enquadramento**. Não some, não salta.

### 🔴 O que a Task A mudou nesta task (leia antes de escrever)

- **As mutações #1 e #2 da tabela abaixo viraram no-op.** "`foraDaJanela`/`enquadrarComVoce`
  recebem as coords de `fichas`" não muta nada: dentro do `MapaHome`, `fichas` *é* a lista
  visível. **O veículo certo passou a ser mutar o `MioloHome` pra passar `pares`** — reescreva-as
  assim, ou renomeie a prop pra `visiveis` (16 call sites em `MapaHome.test.tsx`; esta task já
  toca o arquivo).
- **Restrição nova, achada pela revisão da Task A, e ela pesa na decisão:** o `BuscaLugar` mora
  **dentro** do `MapaHome`. Com o mapa devolvendo `null`, **some junto a caixa de digitar
  cidade** — e quem não tem GPS e zerou a lista por "só grátis" perde, naquele instante, o único
  jeito de dizer onde está. **O ramo do vazio não pode simplesmente devolver `null`**, e "mantém
  o último enquadramento" tem que manter a busca alcançável.
- **Salto de layout:** o mapa some/volta com 168px. O vazio precisa ocupar a mesma altura.

### Os testes

```tsx
// O que motivou a rodada: o aviso mentia.
it("'N fora do mapa' conta só as VISÍVEIS — com 3 trilhas e filtro deixando 1, não diz 2", ...)

it("filtro zera + com localização: mostra você, sem pin nenhum, e sem aviso de 'fora'", ...)

// Sem trilhas e sem você não há o que enquadrar; saltar pra lugar nenhum é
// pior que ficar parado.
it("filtro zera + SEM localização: mantém o enquadramento que tinha", ...)

// Herdada, não pode quebrar: o mapa some quando não há leitura nenhuma —
// que é diferente de "o filtro escondeu todas".
it("sem NENHUMA leitura o mapa continua sumindo (é outro caso)", ...)
```

### Prova de mutação

| # | Mutação | Teste que TEM que cair |
|---|---|---|
| 1 | **o `MioloHome` passa `pares`** (não mute dentro do `MapaHome` — vira no-op) | "'N fora do mapa' conta só as VISÍVEIS" |
| 2 | idem, com o recorte mordendo o enquadramento | "filtro zera + com localização" |
| 3 | o ramo do vazio-sem-localização volta a `return null` | "mantém o enquadramento que tinha" |
| 4 | o `if (comLeitura.length === 0) return null` some | "sem NENHUMA leitura o mapa continua sumindo" |
| 5 | o ramo do vazio deixa de renderizar o `BuscaLugar` | "com o filtro zerando, ainda dá pra dizer onde estou" |

---

## Depois das duas

1. `npm test` + `npx tsc --noEmit` + **`npm run build`** — os três.
2. **Medir no navegador**, com `npm run build` + `next start` (o dev compartilha o `.next`; ver a
   lição 21): com filtro ligado, o mapa reenquadra e nenhum pin sobra sem cartão? O caso vazio
   mostra você? **Colar os números.**
3. **Revisão da branch inteira** — a junção é o assunto, e é a 6ª vez que ela é obrigatória.
4. Atualizar `docs/RESUME.md` e fechar o deferido do `enquadrarComVoce([], …)`.
