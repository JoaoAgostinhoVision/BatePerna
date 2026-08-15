### Task 12: A barra fixa no rodapé

**Files:**
- Modify: `src/app/home.css`, `src/app/trilhas/page.tsx` (se precisar de respiro próprio)
- Test: `tests/app/BarraNavegacao.test.tsx` (acrescentar)

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar a tests/app/BarraNavegacao.test.tsx
import { readFileSync } from "node:fs";
import path from "node:path";

const css = () => readFileSync(path.join(process.cwd(), "src", "app", "home.css"), "utf8");

describe("a barra fica presa no rodapé", () => {
  it("é fixa, não rola junto com a lista", () => {
    const regra = css().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .barra").not.toBeNull();
    expect(regra![0]).toMatch(/position:\s*fixed/);
    expect(regra![0]).toMatch(/bottom:\s*0/);
  });

  // Sem isso, em tela cheia a barra nasce debaixo da faixa do gesto do iPhone
  // e os rótulos ficam intocáveis. Já valia antes de ser fixa; vale mais agora.
  it("soma a área segura do iPhone", () => {
    const regra = css().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra![0]).toContain("env(safe-area-inset-bottom)");
  });

  // Barra fixa flutua sobre o conteúdo: sem respiro, o último cartão nasce
  // atrás dela e a pessoa nunca vê a última trilha da lista.
  it("a folha reserva o espaço da barra embaixo", () => {
    const regra = css().match(/\.bp \.folha\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .folha").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });

  it("a lista do acervo reserva o mesmo espaço", () => {
    const regra = css().match(/\.bp \.lista\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .lista").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/BarraNavegacao.test.tsx`
Expected: FAIL — a barra não é `fixed`

- [ ] **Step 3: Implement**

Em `src/app/home.css`, substitua a regra `.bp .barra` por:

```css
/* A altura da barra em um lugar só: quem a reserva embaixo (a folha, a lista)
   lê daqui. Dois números soltos discordariam no dia em que um mudasse. */
.bp { --barra-h: 62px; }

/* Fixa no rodapé, não em fluxo. Em fluxo ela só PARECE estar no fim quando o
   documento cabe na tela — com seis cartões ela desce junto com a lista, que
   foi o que o João viu e apontou.
   O padding-bottom soma a área segura do iPhone: sem isso, em tela cheia, a
   barra nasce debaixo da faixa do gesto e os rótulos ficam intocáveis. */
.bp .barra {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
  display: flex;
  border-top: 1px solid var(--line);
  background: var(--screen);
  padding-bottom: env(safe-area-inset-bottom);
}
```

E acrescente o respiro em quem rola por baixo dela:

```css
/* Barra fixa flutua sobre o conteúdo: sem este respiro o último cartão nasce
   atrás dela. Soma a área segura pelo mesmo motivo da barra. */
.bp .folha { padding-bottom: calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); }
.bp .lista { padding-bottom: calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); }
```

(ajuste as regras existentes de `.folha` e `.lista` em vez de duplicá-las)

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/BarraNavegacao.test.tsx tests/app/trilhas.test.tsx`
Expected: PASS

- [ ] **Step 5: MEDIR NO NAVEGADOR — jsdom não mede geometria**

Nenhum teste desta suíte mede pixel renderizado. Rode `npm run dev`, abra em 375×667 emulando iPhone e **meça**:

1. Com uma ficha: a barra está no rodapé da JANELA, e não logo abaixo do último cartão?
2. Role até o fim: o último cartão fica **inteiramente** visível acima da barra?
3. Abra o painel de filtros: a lista foi **empurrada** pra baixo (não coberta)?
4. `document.querySelector('.cartao').getBoundingClientRect().top` — **anote o número** e confirme que é ≤ 320.

**Cole os quatro resultados no relatório, com os números.** "Parece certo" não é resposta; "não medi" é.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
git add src/app/home.css tests/app/BarraNavegacao.test.tsx
git commit -m "fix(barra): presa no rodape, com respiro reservado na folha e no acervo"
```

---

## Depois das 12 tasks

1. **`npm test`** — a suíte inteira. Base: 278 + os novos.
2. **`npx tsc --noEmit`** e **`npm run build`** — os dois limpos.
3. **Revisão da branch inteira**, obrigatória. Em **três** rodadas seguidas ela achou defeito que nenhuma revisão de task pegou. As duas junções a atacar primeiro:
   - **filtro × agrupamento** (Tasks 9–11): o cabeçalho pode afirmar o que a lista filtrada não sustenta?
   - **localização × enquadramento** (Tasks 2–4): a localização chega depois do primeiro paint; alguma coisa lê ela durante o render?
   - E a terceira, que só aparece na branch inteira: **a mesma trilha mostra o mesmo km no cartão e na ficha?**
4. **Perguntar ao João** o esforço e a duração da Rampa; com a resposta, preencher `content/fichas/rampa-do-pepe.json` num commit próprio.
5. **iPhone**, e é dele: as quatro perguntas da §15 da spec.
6. Atualizar `docs/RESUME.md`.

## Self-review deste plano

**Cobertura da spec:** §5 → Tasks 1, 2; §5.4 → Task 7; §6 → Tasks 3, 4; §7 → Tasks 9, 10, 11; §8 → Task 7; §9 → Task 8; §10 → Tasks 5, 6; §11 → Task 12; §12 → Task 10; §13 → Global Constraints; §14 → passos de mutação e medição em cada task; §15 → Task 12 passo 5 e o fechamento.

**Ponto que o plano deixa em aberto de propósito:** a Task 11 permite duas formas de ligar a contagem da linha à lista filtrada (elevar o cálculo, ou a folha renderizar o painel). Quem implementa escolhe e **justifica no relatório** — o que o plano crava é a proibição de duas contas.
