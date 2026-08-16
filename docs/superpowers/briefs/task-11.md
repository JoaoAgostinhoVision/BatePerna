### Task 11: Filtro e agrupamento na MESMA passada

**Files:**
- Modify: `src/app/FolhaTrilhas.tsx`, `src/app/page.tsx`, `src/app/home.css`
- Test: `tests/app/FolhaTrilhas.test.tsx` (acrescentar)

**ESTA É A TASK DE MAIOR RISCO DA RODADA.** O Critical da rodada passada nasceu exatamente aqui: agrupar num lugar e repintar em outro. Filtro e agrupamento **têm que ser calculados na mesma passada, no mesmo componente, a partir da mesma leitura**. A `FolhaTrilhas` também passa a ser quem informa `visiveis` pro `PainelFiltros` — a contagem da linha e a lista na tela não podem sair de duas contas diferentes.

- [ ] **Step 1: Write the failing test**

```tsx
// acrescentar a tests/app/FolhaTrilhas.test.tsx
import FiltrosVivos from "@/app/filtros";
import LocalVivo from "@/app/local";
import { CHAVE_FILTROS, SEM_FILTRO } from "@/lib/filtros";

describe("filtro e agrupamento juntos", () => {
  afterEach(() => { localStorage.clear(); });

  const par = (slug: string, estado: "fresco" | "frio", over = {}) => ({
    ficha: { ...fichaFake(slug), ...over },
    leitura: { estado, erro: false, calculadoEm: agoraSeg() },
  });

  const monta = (pares: ParFolha[]) =>
    render(<LocalVivo><FiltrosVivos><FolhaTrilhas pares={pares} /></FiltrosVivos></LocalVivo>);

  it("sem filtro, a folha é a de hoje: agrupada e completa", () => {
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    expect(container.textContent).toContain("Hoje o tempo deixa");
    expect(container.textContent).toContain("Hoje não");
    expect(container.querySelectorAll(".cartao")).toHaveLength(2);
  });

  it('"dá hoje" tira as que não dão', async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
  });

  // O cabeçalho é uma AFIRMAÇÃO sobre o que está embaixo dele. Sobrando nada
  // embaixo, ele mente. Primo direto do Critical da rodada passada.
  it("grupo esvaziado pelo filtro perde o cabeçalho", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio")]);
    await waitFor(() => expect(container.textContent).not.toContain("Hoje não"));
    expect(container.textContent).toContain("Hoje o tempo deixa");
  });

  it("filtro que zera a lista mostra o aviso e o jeito de limpar", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  it("limpar traz tudo de volta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([par("a", "fresco", { custo: { tag: "pago", valor: "R$ 5" } })]);
    const b = await screen.findByRole("button", { name: /limpar/i });
    await act(async () => { b.click(); });
    expect(container.querySelectorAll(".cartao")).toHaveLength(1);
  });

  // A regra que já existe e não pode ser quebrada por esta task.
  it("sem leitura confiável, continua sem cabeçalho — e o filtro 'dá hoje' fica inerte", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(2));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // ——— pré-voo: SEM ESTE TESTE A PROVA DE MUTAÇÃO DO STEP 5 NÃO MORDE.
  //
  // O Step 5 manda o ramo `!confia` voltar a usar `pares` e ver algum teste
  // cair. Com o que estava escrito acima, NENHUM cai: o único filtro exercitado
  // no ramo `!confia` é o `daHoje`, que ali é inerte de propósito — então
  // `pares` e `visiveis` são a MESMA lista e a mutação passa despercebida.
  //
  // O ramo `!confia` desliga o AGRUPAMENTO, não o filtro. Quem ligou "só
  // grátis" continua querendo só as grátis, com ou sem carimbo confiável.
  it("sem leitura confiável, os OUTROS recortes continuam recortando", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: fichaFake("a"), leitura: vencido },
      par("b", "fresco", { custo: { tag: "pago", valor: "R$ 5" } }),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // ——— pré-voo: a folha vazia tem que valer NOS DOIS ramos.
  //
  // Se o `if (visiveis.length === 0)` for escrito depois do `if (!confia)`, o
  // caso "sem carimbo confiável + filtro que zera" cai no ramo de cima e
  // desenha uma `<div className="cartoes">` VAZIA: folha em branco, sem aviso e
  // sem o botão de limpar — que é exatamente o que a §7.4 da spec proíbe
  // ("nunca uma folha em branco"). O ramo `!confia` é o mais provável de estar
  // na tela num dia ruim, que é justamente quando a pessoa filtra mais.
  it("filtro que zera a lista avisa TAMBÉM quando não dá pra confiar no carimbo", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const vencido = { estado: "frio" as const, erro: false, calculadoEm: agoraSeg() - 99_999 };
    const { container } = monta([
      { ficha: { ...fichaFake("a"), custo: { tag: "pago", valor: "R$ 5" } }, leitura: vencido },
    ]);
    await waitFor(() => expect(container.textContent).toContain("Nenhuma trilha com esses filtros"));
    expect(screen.getByRole("button", { name: /limpar/i })).toBeTruthy();
  });

  // ——— pré-voo: `confia` é a pergunta sobre TODAS as trilhas, não só as
  // visíveis — e isso é decisão, não detalhe.
  //
  // Não dá pra ser diferente: `passaNoFiltro` RECEBE `confia`, então calcular
  // `confia` a partir de `visiveis` seria circular. Mas a consequência é
  // visível e alguém vai querer "consertar": uma trilha que o filtro escondeu,
  // com leitura estragada, derruba os cabeçalhos das que ficaram na tela.
  //
  // Está CERTO assim, e a razão é a invariante "tudo ou nada no clima": a
  // leitura vem numa busca só, pro lote inteiro. Uma leitura estragada não é
  // notícia sobre aquele morro, é notícia sobre a busca — e ela vale pra todos.
  // Fingir confiança nos que sobraram seria o app afirmando o que não sabe.
  it("trilha escondida pelo filtro ainda derruba o agrupamento se a leitura dela não presta", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    const { container } = monta([
      // Esta some da tela (é paga) — mas a leitura dela está com erro.
      {
        ficha: { ...fichaFake("a"), custo: { tag: "pago", valor: "R$ 5" } },
        leitura: { estado: "frio", erro: true, calculadoEm: agoraSeg() },
      },
      par("b", "fresco"),
    ]);
    await waitFor(() => expect(container.querySelectorAll(".cartao")).toHaveLength(1));
    expect(container.textContent).not.toContain("Hoje o tempo deixa");
  });

  // ——— TRANSFERIDO DO PRÉ-VOO DA TASK 10 (precedente da Task 3: achado real
  // sem linha pra consertar naquela camada vira ruling registrado, e o teste
  // nasce onde ele morde).
  //
  // Lá o `<FiltrosVivos>` entrou no page.tsx com prova só de FONTE, porque
  // nada consumia o provedor ainda. Aqui já consome — então a prova forte é
  // possível e é obrigatória: **renderizar o page.tsx DE VERDADE**, sem
  // embrulhar nada à mão, com um filtro guardado no aparelho.
  //
  // Todos os outros testes deste arquivo embrulham `<FiltrosVivos>` na mão.
  // Se o page.tsx esquecer o provedor, eles continuam TODOS verdes e a home
  // real não filtra nada. Foi exatamente assim com o `<LocalVivo>` na Task 4:
  // tirá-lo deixou os 16 testes do MapaHome.test.tsx verdes.
  //
  // Espelhe o teste que já existe em tests/app/home.test.tsx:190 ("a home de
  // verdade embrulha tudo no LocalVivo") — mesmo formato, mesmo arquivo de
  // página.
  it("a home de verdade embrulha tudo no FiltrosVivos: o filtro guardado recorta sem ninguém embrulhar na mão", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    // ... renderiza page.tsx de verdade e confere que a Rampa (paga) sumiu
    // e que o aviso "Nenhuma trilha com esses filtros" apareceu.
  });

  // A contagem da linha e a lista na tela SÃO a mesma conta. Se saírem de
  // dois lugares, a linha diz "4 trilhas" com 2 na tela — a mesma família do
  // cabeçalho verde sobre cartão vermelho.
  it("a contagem da linha bate com os cartões desenhados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    const { container } = monta([par("a", "fresco"), par("b", "frio"), par("c", "frio")]);
    await waitFor(() => {
      const n = container.querySelectorAll(".cartao").length;
      expect(container.textContent).toContain(n === 1 ? "1 trilha" : `${n} trilhas`);
    });
  });
});
```

Se `fichaFake` / `agoraSeg` ainda não existirem em `tests/app/FolhaTrilhas.test.tsx`, copie `fichaFake` de `tests/app/home.test.tsx` e defina `const agoraSeg = () => Math.floor(Date.now() / 1000)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/FolhaTrilhas.test.tsx`
Expected: FAIL — a folha ainda não filtra

- [ ] **Step 3: Implement**

Em `src/app/FolhaTrilhas.tsx`, depois de calcular `confia` (que já existe), **na mesma passada**:

```tsx
const filtros = useFiltros();
const mexer = useMexerFiltros();
const voce = coordDe(useLocal());

// Filtro e agrupamento saem da MESMA leitura, no MESMO componente. Separá-los
// em duas etapas em dois lugares é exatamente como nasceu o Critical da
// rodada passada: o servidor agrupava, o cliente repintava, e o cabeçalho
// afirmava o contrário do cartão embaixo dele.
const visiveis = pares.filter((p) =>
  passaNoFiltro({ ficha: p.ficha, leitura: atual(p), filtros, voce, confia }),
);
```

🔴 **`confia`, `algumErro` e `useAlgumVenceu` continuam sendo calculados sobre `pares` — TODAS as trilhas, não as visíveis.** Não é descuido e não é "otimizável":

1. `passaNoFiltro` **recebe** `confia`. Calcular `confia` a partir de `visiveis` seria circular.
2. `useAlgumVenceu(pares.map(...))` é um hook que recebe um array; alimentá-lo com uma lista que muda de tamanho a cada toque no filtro é convite pra defeito de hook.
3. E é o CERTO pelo produto: a invariante **"tudo ou nada no clima"** diz que a leitura vem numa busca só, pro lote inteiro. Leitura estragada não é notícia sobre aquele morro, é notícia sobre a busca — vale pra todos, inclusive pros que o filtro escondeu.

A consequência é visível e tem teste próprio no Step 1 ("trilha escondida pelo filtro ainda derruba o agrupamento"): **não a 'conserte'.**

Daí pra frente, **toda** a montagem usa `visiveis` no lugar de `pares` — inclusive o ramo `!confia`. E acrescente **antes de tudo, inclusive antes do `if (!confia)`**:

```tsx
if (visiveis.length === 0) {
  return (
    <div className="folha-vazia">
      <p>Nenhuma trilha com esses filtros</p>
      <button className="chip" onClick={() => mexer(SEM_FILTRO)}>limpar filtros</button>
    </div>
  );
}
```

**A ordem dos dois `if` importa.** Com o vazio depois do `!confia`, o caso "carimbo não confiável + filtro que zera" cai no ramo de cima e desenha uma `.cartoes` VAZIA — folha em branco, sem aviso e sem o botão de limpar, que é o que a §7.4 da spec proíbe. E é o ramo mais provável de estar na tela num dia ruim, que é justamente quando a pessoa filtra mais. Tem teste próprio no Step 1.

A função `grupo()` já devolve `null` pra lista vazia (`src/app/FolhaTrilhas.tsx:73`) — é o que faz o cabeçalho sumir junto com o grupo esvaziado. **Confirme no código em vez de assumir**, e deixe um comentário apontando o teste que prova.

Em `src/app/page.tsx`: mova o `<PainelFiltros />` pra dentro do fluxo entre o mapa e a folha, e faça a `FolhaTrilhas` renderizá-lo com a contagem — ou eleve o cálculo pra um componente único que renderiza os dois. **O que não pode é a contagem sair de outra conta.** Registre no relatório qual das duas formas você escolheu e por quê.

Em `src/app/home.css`, acrescente `.folha-vazia` (centralizado, `color: var(--ink-faint)`, respiro vertical).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/FolhaTrilhas.test.tsx tests/app/home.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

| # | Mutação | Teste que TEM que falhar |
|---|---|---|
| 1 | o ramo `!confia` volta a usar `pares` | "sem leitura confiável, os OUTROS recortes continuam recortando" |
| 2 | mover o `if (visiveis.length === 0)` pra depois do `if (!confia)` | "filtro que zera a lista avisa TAMBÉM quando não dá pra confiar" |
| 3 | `confia`/`algumErro` calculados sobre `visiveis` em vez de `pares` | "trilha escondida pelo filtro ainda derruba o agrupamento" |
| 4 | `grupo()` devolvendo o cabeçalho com lista vazia | "grupo esvaziado pelo filtro perde o cabeçalho" |
| 5 | a contagem do painel virar `pares.length` | "a contagem da linha bate com os cartões desenhados" |
| 6 | tirar o `<FiltrosVivos>` do `page.tsx` | "a home de verdade embrulha tudo no FiltrosVivos" |

**A #1 é a razão do teste novo.** O brief original prescrevia essa mutação e o pré-voo descobriu que ela **não mordia**: o único filtro exercitado no ramo `!confia` era o `daHoje`, inerte ali de propósito, então `pares` e `visiveis` eram a mesma lista.

🔴 **Se alguma mutação NÃO morder, PARE e relate** — não afrouxe a asserção nem "conserte" o teste. Três vezes nesta rodada o erro estava no plano, e quem parou e mostrou a conta estava certo nas três. Rode `npx tsc --noEmit` antes de declarar qualquer linha morta.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
npx tsc --noEmit
npm run build
git add src/app/FolhaTrilhas.tsx src/app/page.tsx src/app/home.css tests/app/FolhaTrilhas.test.tsx
git commit -m "feat(folha): filtro e agrupamento na mesma passada, com estado vazio"
```

🔴 **`npm run build` entra na verificação.** `npm test` verde não prova que o app constrói — o vitest roda por esbuild e nunca chama o `next build`. Nesta rodada o build ficou quebrado por quatro commits com a suíte inteira verde.

---

