### Task 12: A barra fixa no rodapé

**Files:**
- Modify: `src/app/home.css`, `src/app/trilhas/page.tsx` (se precisar de respiro próprio)
- Test: `tests/app/BarraNavegacao.test.tsx` (acrescentar)

- [ ] **Step 1: Write the failing test**

🔴 **Duas correções do pré-voo antes de escrever qualquer coisa, e as duas são erro MEU:**

1. **`.bp .lista` NÃO mora no `home.css`.** Mora em `src/app/ficha.css:202` — o `/trilhas` importa os dois arquivos. O teste que eu tinha escrito lia o `home.css` e falharia com "faltou a regra .bp .lista", e o conserto natural (duplicar a regra no `home.css`) criaria **duas fontes pro mesmo seletor**, que é a família de defeito que este app persegue. O teste abaixo lê **cada regra no arquivo onde ela vive**.
2. **`position: fixed` ESCAPA do `.screen`.** O app inteiro vive dentro de `.bp .screen`, que é `max-width: 25.5rem` com borda, `border-radius: 24px` e `overflow: hidden` — a moldura de celular. Nenhum ancestral tem `transform`/`filter`/`perspective`, então elemento fixo se posiciona pela **janela**, não por ela: `left: 0; right: 0` faz a barra atravessar a tela inteira num monitor, por fora da moldura e por cima da borda arredondada. No celular passa despercebido (a janela É a moldura) — em qualquer tela larga fica visivelmente quebrado, inclusive na hora de conferir. A barra tem que ser **presa ao mesmo max-width, centrada**.

```ts
// acrescentar a tests/app/BarraNavegacao.test.tsx
import { readFileSync } from "node:fs";
import path from "node:path";

const folha = (arq: string) =>
  readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8");
const home = () => folha("home.css");

describe("a barra fica presa no rodapé", () => {
  it("é fixa, não rola junto com a lista", () => {
    const regra = home().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .barra").not.toBeNull();
    expect(regra![0]).toMatch(/position:\s*fixed/);
    expect(regra![0]).toMatch(/bottom:\s*0/);
  });

  // Sem isso, em tela cheia a barra nasce debaixo da faixa do gesto do iPhone
  // e os rótulos ficam intocáveis. Já valia antes de ser fixa; vale mais agora.
  it("soma a área segura do iPhone", () => {
    const regra = home().match(/\.bp \.barra\s*\{[^}]*\}/s);
    expect(regra![0]).toContain("env(safe-area-inset-bottom)");
  });

  // ——— pré-voo: elemento fixo se posiciona pela JANELA, não pela moldura.
  // Sem prender no mesmo max-width do `.screen`, a barra atravessa o monitor
  // inteiro por fora da moldura. E os dois números têm que ser o MESMO número:
  // duas larguras soltas discordam no dia em que uma mudar.
  it("a barra tem a largura da moldura, não a da janela", () => {
    const barra = home().match(/\.bp \.barra\s*\{[^}]*\}/s)![0];
    const screen = folha("ficha.css").match(/\.bp \.screen\s*\{[^}]*\}/s);
    expect(screen, "faltou a regra .bp .screen").not.toBeNull();
    const largura = screen![0].match(/max-width:\s*([^;]+);/)![1].trim();
    expect(barra).toContain(`max-width: ${largura}`);
    expect(barra).toMatch(/left:\s*50%/);
    expect(barra).toMatch(/translateX\(-50%\)/);
  });

  // Barra fixa flutua sobre o conteúdo: sem respiro, o último cartão nasce
  // atrás dela e a pessoa nunca vê a última trilha da lista.
  //
  // `match` sem /g devolve a PRIMEIRA ocorrência — de propósito. Acrescentar
  // uma segunda regra `.bp .folha` mais abaixo no arquivo funcionaria pela
  // cascata e deixaria este teste vermelho, o que é o certo: a medida tem que
  // entrar na regra que já existe. **Não "conserte" a regex.**
  it("a folha reserva o espaço da barra embaixo", () => {
    const regra = home().match(/\.bp \.folha\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .folha").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });

  // O acervo tem a MESMA barra por cima e a regra dele mora no ficha.css.
  it("a lista do acervo reserva o mesmo espaço", () => {
    const regra = folha("ficha.css").match(/\.bp \.lista\s*\{[^}]*\}/s);
    expect(regra, "faltou a regra .bp .lista").not.toBeNull();
    expect(regra![0]).toMatch(/padding-bottom:[^;]*var\(--barra-h\)/);
  });

  // A altura reservada não pode ser MENOR que a barra, senão o último cartão
  // fica atrás dela — que é o defeito que esta task existe pra tirar. O número
  // vem medido no navegador (Step 5), não do desejo.
  it("--barra-h é declarado num lugar só, no .bp", () => {
    expect(home().match(/--barra-h:/g)!).toHaveLength(1);
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
/* `left: 50%` + `translateX(-50%)` e não `left: 0; right: 0`: elemento fixo se
   posiciona pela JANELA, e o app vive dentro de `.bp .screen`, uma moldura de
   25.5rem com borda arredondada. Esticada de ponta a ponta, a barra atravessa
   um monitor inteiro por fora da moldura. O max-width é o MESMO do `.screen`
   (ficha.css) — tem teste conferindo que os dois números não se separam. */
.bp .barra {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 5;
  width: 100%; max-width: 25.5rem;
  display: flex;
  border-top: 1px solid var(--line);
  background: var(--screen);
  padding-bottom: env(safe-area-inset-bottom);
}
```

E acrescente o respiro em quem rola por baixo dela — **editando as regras que já existem**, não criando outras:

```css
/* Barra fixa flutua sobre o conteúdo: sem este respiro o último cartão nasce
   atrás dela. Soma a área segura pelo mesmo motivo da barra. */
/* home.css, na regra que já está lá (`.bp .folha { padding: .2rem .9rem 1rem; }`) */
.bp .folha { padding: .2rem .9rem calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); }

/* ficha.css:202, na regra que já está lá — é ali que `.bp .lista` mora, e o
   /trilhas importa os dois arquivos. Duplicar a regra no home.css criaria duas
   fontes pro mesmo seletor. */
.bp .lista { padding: 1.1rem 1.2rem calc(var(--barra-h) + env(safe-area-inset-bottom) + 1rem); ... }
```

O `--barra-h` fica declarado **no `.bp` do `home.css`, num lugar só** (tem teste), e o `/trilhas` o enxerga porque importa o `home.css` também — confira essa importação em vez de assumir (`src/app/trilhas/page.tsx:2`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/BarraNavegacao.test.tsx tests/app/trilhas.test.tsx`
Expected: PASS

- [ ] **Step 5: MEDIR NO NAVEGADOR — jsdom não mede geometria**

Nenhum teste desta suíte mede pixel renderizado. Rode `npm run dev`, abra em 375×667 emulando iPhone e **meça**:

1. Com uma ficha: a barra está no rodapé da JANELA, e não logo abaixo do último cartão?
2. Role até o fim: o último cartão fica **inteiramente** visível acima da barra?
3. Abra o painel de filtros: a lista foi **empurrada** pra baixo (não coberta)?
4. `document.querySelector('.cartao').getBoundingClientRect().top` — **anote o número** e confirme que é ≤ 320.

E mais três que o pré-voo acrescentou:

5. 🔴 **`document.querySelector('.barra').getBoundingClientRect().height` — anote o número e confirme que é ≤ 62.** O `--barra-h: 62px` do meu brief é **chute meu**, não medida: a conta a partir do CSS dá ~56px (`.barra-item` com `box-sizing: border-box`, padding .55/.7rem e conteúdo de ~35px, mais 1px de borda). Se a barra for **mais alta** que o `--barra-h`, o respiro é curto e o último cartão fica parcialmente atrás dela — o defeito que esta task existe pra tirar. **Se não bater, ajuste a constante pro valor medido e diga isso no relatório**, seguindo o padrão do `home-layout.ts`: essas alturas são MEDIDAS, não desejos.
6. **Numa janela LARGA (1200px, sem emulação):** a barra fica dentro da moldura, com a mesma largura do `.screen`, ou atravessa a tela? É o achado 2 do pré-voo, e o teste de CSS não prova geometria — só que as regras estão escritas.
7. **No `/trilhas`:** o último item do acervo fica inteiramente visível acima da barra? A regra dele mora noutro arquivo, e é o jeito mais fácil de o respiro entrar só na home.

**Cole os sete resultados no relatório, com os números.** "Parece certo" não é resposta; "não medi" é.

- [ ] **Step 6: Rodar a suíte e commitar**

```bash
npm test
npx tsc --noEmit
npm run build
git add src/app/home.css src/app/ficha.css tests/app/BarraNavegacao.test.tsx
git commit -m "fix(barra): presa no rodape, com respiro reservado na folha e no acervo"
```

(o `ficha.css` entra no `git add` porque é onde `.bp .lista` e `.bp .screen` moram)

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
