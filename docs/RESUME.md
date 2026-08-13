# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** O ledger da execução vive em
> `.superpowers/sdd/2026-08-11-home-hoje/progress.md`, que é **scratch git-ignorado** — um
> `git clean -fdx` o apaga. O essencial dele está aqui.

**Última parada:** 2026-08-11. **Estado: rodada da home "Hoje" em andamento, 7 de 11 tasks
entregues.** Branch **`home-hoje`** em `3f1ce6a`, **250/250**, árvore limpa, `tsc` limpo,
**14 commits à frente de `main` e NÃO mergeada.** `main` segue em `501ed45`, no ar e intocado.

---

## ▶ SE O JOÃO DISSER SÓ "CONTINUA" — comece por aqui, sem perguntar nada antes

**O jeito dele de retomar é essa palavra só.** Não devolva menu nem peça contexto. Faça nesta ordem:

1. **Confira o chão em silêncio** (sem narrar): `git status --short` (limpo), `git branch --show-current`
   (tem que ser `home-hoje`), `git log --oneline -1` (`3f1ce6a`), `npm test --silent` (250/250).
   Se algo divergir, **isso** vira o assunto.
2. **Retome a execução por subagentes na Task 8.** João autorizou os agentes explicitamente
   nesta sessão, e pediu a branch `home-hoje` — as duas coisas seguem valendo.
3. **Não refaça as Tasks 1–7.** Elas estão commitadas e revisadas. A lista do que cada uma
   entregou está abaixo.

O ciclo por task é sempre o mesmo (detalhado em "Como tocar cada task").

## Onde exatamente parou

| Task | O que entrega | Estado |
|---|---|---|
| 1 | `enquadrar`/`posicaoNaCaixa` em `mapa.ts` + `home-layout.ts` | ✅ `d15839d` |
| 2 | `fetchPrecipMulti` — uma chamada de clima pra N coordenadas | ✅ `f289808` |
| 3 | `resolverEstados` — veredito de N trilhas, tudo ou nada | ✅ `3165acc` |
| 4 | `GET /api/carimbos` | ✅ `6e35069` |
| 5 | Barra de navegação + `/trilhas` promovida a acervo | ✅ `50f5929` |
| 6 | A home server-rendered: cartões agrupados por veredito | ✅ `41e9a59` |
| 7 | O mapa da home, pin ancorado no cartão | ✅ `3f1ce6a` |
| **8** | **`HomeViva` — a home busca leituras novas ao voltar pra frente** | ⬅ **PRÓXIMA** |
| 9 | Offline: `/` passa a abrir o acervo | pendente |
| 10 | O cookie `bp_ultima` morre | pendente |
| 11 | `docs/questionario-ficha.md` | pendente |

Depois da 11: **revisão da branch inteira** (modelo mais capaz) → **uma** leva de correção →
uma re-revisão escopada → merge `--no-ff` → `npx vercel --prod --yes` → conferir por `curl` →
**abrir no iPhone**.

## Documentos desta rodada

- **Spec:** `docs/superpowers/specs/2026-08-11-home-hoje-design.md`
- **Plano:** `docs/superpowers/plans/2026-08-11-home-hoje.md` — **já corrigido três vezes**
  (`8643453`, `5e2c5e1`); o texto atual é o que vale.
- Ledger (git-ignorado): `.superpowers/sdd/2026-08-11-home-hoje/progress.md`
- Mockups do brainstorm (git-ignorados): `.superpowers/brainstorm/754-1786493110/content/`

## Como tocar cada task (o ciclo que está funcionando)

1. `git rev-parse HEAD` → guarde como BASE.
2. `bash <skills>/subagent-driven-development/scripts/task-brief docs/superpowers/plans/2026-08-11-home-hoje.md N`
3. Despache **um** implementador (sonnet basta; haiku pra transcrição pura). No prompt: onde a
   task se encaixa, o caminho do brief como fonte única de requisitos, as interfaces que ele
   consome, as cicatrizes que não pode reabrir, e o caminho do arquivo de relatório.
4. `scripts/review-package <plano> BASE HEAD` → despache o revisor com o caminho impresso.
   **Exija dois veredictos: conformidade com o spec E qualidade.**
5. Achado Important/Critical → mande de volta pro **mesmo** implementador (`SendMessage`), que
   ainda tem o contexto. Depois `review-package FIX_BASE HEAD` + re-revisão **escopada**.
6. Minors vão pro ledger, não pro laço.

**Não pule a revisão da branch inteira no fim.** Nas duas rodadas anteriores ela achou defeito
que nenhuma revisão de task pegou.

## O que a home é hoje (para não redesenhar por engano)

Decidido com o João por brainstorm, com mockups no navegador:

- **`/` é a home "Hoje"**: mapa em cima enquadrando as trilhas, folha com os cartões agrupados
  em "Hoje o tempo deixa" / "Hoje não", barra embaixo. Layout **A** dos mockups.
- **`/trilhas` é o acervo** — tudo, sem carimbo, ordenado por nome.
- **Barra embaixo com dois destinos**, Hoje e Trilhas. "Minhas" só nasce com a memória (fatia 2).
- **O pin é âncora** (`<a href="#slug">`) — toca e rola até o cartão **sem JavaScript**.
- **Uma trilha, uma fonte de cor:** `CartaoTrilha` é client component e lê o contexto **uma vez**,
  alimentando o `data-state` do cartão E a prop do selo. `SeloTrilha` é apresentacional.

**A rodada foi cortada em três fatias. Esta é a fatia 1.** Fatia 2 = memória ("Fui" no aparelho
+ "já conheço" + aba Minhas). Fatia 3 = filtros por chip, campos novos na ficha, km com GPS e
saída manual por cidade. **Nada disso entra agora.**

**Achado que o brainstorm produziu:** as fatias 2 e 3 são invisíveis com uma trilha só. A
segunda ficha deixou de ser preferência e virou dependência delas — por isso a Task 11 entrega
o questionário. **Eu não invento geografia; as respostas são do João.**

## Invariantes que não podem ser quebradas

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Depende de `force-dynamic` na
  home e na ficha. Página estática congela `calculadoEm` no build e todo visitante recebe
  carimbo vencido.
- **`useVenceu` devolve `false` no primeiro render, sempre.** A home também chega do cache do
  service worker com HTML velho; calcular `Date.now()` no render quebra a hidratação no
  elemento que carrega a decisão.
- **A regra de CSS da fase carrega `[data-state]` junto**, senão perde de especificidade e
  "SEM INFORMAÇÕES" sai em selo verde. Vale pro `.selo` e pro `.pin-home`; os dois têm guarda.
- **Sem leitura o app INFORMA, não manda:** `SEM INFORMAÇÕES · tome cuidado`. `Não suba` é só
  pro barro que o motor MEDIU.
- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.** Home, ficha e as duas
  rotas de carimbo não podem divergir sobre o mesmo morro.
- **Tudo ou nada no clima:** falha na busca → nenhuma trilha recebe carimbo. Meia home
  preenchida parece defeito e a pessoa não sabe em quais confiar.
- **Nenhuma URL de trilha responde com o corpo de outra**, online ou offline.
- **Sem `next/link`.** Âncora pura. **Atribuição `© OpenStreetMap`** em todo mapa (ODbL).

## Deferidos desta rodada (a revisão final tem que triar)

- **ENDURECIMENTO, o mais valioso:** a ordem da resposta multi-coordenada da Open-Meteo é hoje
  confiança validada empiricamente, não verificada em runtime. Mas a resposta **carrega
  `latitude`/`longitude` por série** — conferir que batem com o pedido (com tolerância de
  arredondamento) fecharia em runtime o pior defeito possível deste app: veredito de um morro
  no cartão de outro.
- `ehResposta` não confere se `hourly.time` e `hourly.precipitation` têm o mesmo comprimento.
- Duas fichas com o mesmo `slug` fariam a última sobrescrever a primeira, em silêncio.
- `useVenceu` duplica palavra por palavra o relógio do `Carimbo.tsx` (follow-up de 3 linhas).
- `home.css` não tem a regra neutra de `data-fase="conferindo"` que o `ficha.css` tem.
- `MARGEM_ENQUADRO_PX` (28px) foi dimensionada pro losango de 18px, não pro alvo de toque de
  44px — com mais de uma trilha, um pin na borda pode ter o alvo cortado.
- `MapaHome` refaz o `flatMap` de pares ficha+leitura que o `page.tsx` já monta.
- `enquadrar` tem um ramo redundante; o comentário sugere necessidade que não existe.

## Lições desta rodada (valem além dela)

1. **Três defeitos do plano foram pegos ANTES de qualquer código**, numa varredura de conflito
   pré-execução. Dois deles eram reincidência exata de bugs que a rodada anterior shipou.
   Essa varredura paga.
2. **Os dois primeiros achados Important foram defeitos MEUS, do plano** — testes que afirmam
   sobre o dado real (hoje uma ficha só) em vez de afirmar sobre a função. Teste de ordenação
   que passa com o `.sort()` apagado; teste de rota que não prova a fiação.
3. **Teste de mutação decide discussão sobre teste.** Virou exigência: apague a linha, veja o
   teste falhar, devolva — e cole a saída no relatório. Promessa não conta.
4. **Nenhum teste desta suíte mede geometria renderizada.** Um pin 6px fora do lugar passou por
   250 testes verdes e `tsc` limpo. Só apareceu quando o revisor abriu um Chrome headless e
   mediu. Se um número de pixel importa, medir é a única prova.
5. **Eu errei uma conta e o implementador "confirmou" refazendo — partindo da minha premissa
   errada.** Duas conferências que compartilham a suposição não são duas conferências. Quando
   mandar um número, mande a derivação e peça que discordem em vez de aplicar.

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + o celular. Código, deploy e
verificação eu toco. **Agentes: ele autorizou nesta sessão**; a instrução em vigor é não usar
sem pedido, então em sessão nova pergunte antes se não estiver retomando esta rodada.

## Registro histórico (não refazer)

- Rodada 1 (esqueleto): merge `a179e46`. Rampa ao vivo (Versão D): `7d4bd59`. "Fui": `4b6d9a7`.
  Mapa de verdade: `a671146`. Forma de app: `6ef0fdc`. Carimbo busca leitura nova: `9c3dcf8`.
- **iPhone provado em 2026-08-10** — João instalou pelo Safari (Compartilhar → Adicionar à Tela
  de Início) e aprovou. Instalar é pelo Safari, não pelo Chrome, e vale abrir a ficha uma vez
  no wi-fi depois de instalar: é a visita que guarda a cópia offline dela.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute).
- `ensureSchema` (`src/lib/db.ts`) ainda declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte,
  inconsistente com `{seco,barro}`. Limpar em passada futura.
