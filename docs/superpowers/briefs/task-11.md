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

Daí pra frente, **toda** a montagem usa `visiveis` no lugar de `pares` — inclusive o ramo `!confia`. E acrescente, antes dos grupos:

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

A função `grupo()` já devolve `null` pra lista vazia — é o que faz o cabeçalho sumir junto com o grupo esvaziado. **Confirme isso no código em vez de assumir**, e deixe um comentário apontando o teste que prova.

Em `src/app/page.tsx`: mova o `<PainelFiltros />` pra dentro do fluxo entre o mapa e a folha, e faça a `FolhaTrilhas` renderizá-lo com a contagem — ou eleve o cálculo pra um componente único que renderiza os dois. **O que não pode é a contagem sair de outra conta.** Registre no relatório qual das duas formas você escolheu e por quê.

Em `src/app/home.css`, acrescente `.folha-vazia` (centralizado, `color: var(--ink-faint)`, respiro vertical).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/FolhaTrilhas.test.tsx tests/app/home.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

Faça o ramo `!confia` voltar a usar `pares` em vez de `visiveis` e confirme que algum teste falha. Se **nenhum** falhar, o teste está fraco — escreva o que falta antes de seguir. Cole a saída.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/FolhaTrilhas.tsx src/app/page.tsx src/app/home.css tests/app/FolhaTrilhas.test.tsx
git commit -m "feat(folha): filtro e agrupamento na mesma passada, com estado vazio"
```

---

