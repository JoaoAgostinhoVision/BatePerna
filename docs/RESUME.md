# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** O ledger da execução vive em
> `.superpowers/sdd/2026-08-13-daqui-e-filtros/progress.md`, que é **scratch git-ignorado** —
> um `git clean -fdx` o apaga. O essencial dele está aqui.

**Última parada:** 2026-08-13. **Estado: RODADA EM ANDAMENTO, parada no meio a pedido do João.**
Branch **`daqui-e-filtros`**, saindo de `main` em `8c88415`. **Task 1 de 12 fechada**; a Task 2
estava com um conserto em voo quando a sessão acabou.

---

## ▶ SE O JOÃO DISSER SÓ "CONTINUA" — comece por aqui, sem perguntar nada antes

**O jeito dele de retomar é essa palavra só.** Não devolva menu nem peça contexto. Ele já disse
o que quer nesta rodada; a pauta está cravada. **Não repita a pergunta "o que faltou"** — ela já
foi respondida (é o §1 da spec).

1. **Confira o chão em silêncio** (sem narrar):
   - `git branch --show-current` → deve ser **`daqui-e-filtros`**. Se estiver em `main`, é só
     trocar; a branch existe e tem os commits.
   - `git status --short` → **limpo**.
   - `git log --oneline 8c88415..HEAD` → os commits da rodada.
   - `npm test` → **317/317** (conferido no fim da sessão).

2. **Leia o ledger:** `.superpowers/sdd/2026-08-13-daqui-e-filtros/progress.md`. Ele é a memória
   da execução — tem a varredura de pré-voo, o ruling da ordem, e o estado de cada task. **Se ele
   tiver sumido** (`git clean`), reconstrua pelo `git log` e por este arquivo.

3. **Feche a Task 2 antes de qualquer coisa: falta UMA coisa nela — a re-revisão escopada.**

   O conserto do fix round 1/5 **foi entregue e commitado** (`ee28635`, 317/317). O achado era:
   > Os três `try/catch` de `localStorage` em `src/app/local.tsx` (em `escolher`, no ramo de erro
   > do `buscarGps`, e no efeito de montagem) não tinham teste nenhum — apagar os três não
   > derrubava nada.

   O implementador acrescentou dois testes (`setItem` estourando e `getItem` estourando), provou
   cada um por mutação de um guard por vez, e diz que o `local.tsx` ficou **byte-idêntico** ao
   `e4dbae2`.

   **Ele levantou uma ressalva que a re-revisão precisa julgar** (não decida por conta própria):
   ele cobriu **2 dos 3 lugares** que o revisor nomeou — deixou de fora o guard de escrita no ramo
   de erro do `buscarGps`, argumentando que é o mesmo padrão `setItem`-estoura já provado pelo
   teste do `escolher`, e que duplicar seria repetição. **Pode ser razoável, mas quem decide é a
   re-revisão**, não ele e não você de cabeça — é exatamente o tipo de "eu me dou nota" que o
   processo não aceita.

   **O que fazer:** gerar o pacote (`review-package` do plano, de `e4dbae2` até HEAD) e despachar
   a re-revisão escopada com os quatro achados originais + essa ressalva, pedindo veredicto
   explícito sobre o terceiro guard. Se vier ADDRESSED, a Task 2 fecha; se vier NOT ADDRESSED, é
   um fix round 2/5 de um teste só.

4. **Retome a execução em `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md`**, da Task 3 em
   diante. **A ordem de execução tem um ruling e NÃO é a numeração:**

   > **1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12**

   A Task 7 (km no cartão) escreve `ficha.esforco` e `ficha.duracao`, que só nascem no schema na
   Task 8; na ordem escrita o `tsc` quebra. **Os 12 briefs já estão extraídos** em
   `.superpowers/sdd/2026-08-13-daqui-e-filtros/task-N-brief.md` — se sumiram, o script é
   `scripts/task-brief` da skill `subagent-driven-development`.

5. **Método: SDD com subagentes, e o João já autorizou nesta rodada** (ele escolheu a opção 1
   quando ofereci). Implementador → revisão por task com dois veredictos → conserto pelo mesmo
   implementador → re-revisão escopada → **revisão da branch inteira no fim, sem exceção.**

6. **A lição que as duas primeiras tasks já ensinaram, e que muda os briefs seguintes:** os
   implementadores estão **acertando o código e errando onde o meu plano deixou o teste fraco**.
   Task 1 teve 4 Important, Task 2 teve 1 — **todos rotulados plan-mandated**, todos da mesma
   família: um guard ou uma regra sem teste que o prove. **Antes de despachar cada task, releia a
   lista de testes do brief perguntando "que linha do código eu posso apagar sem isto falhar?"** e
   mande o complemento junto no despacho.

## O que esta rodada faz (a pauta do João, dita por ele)

Ao ver a home no ar, ele disse **"ficou legal, mas ainda faltou mais coisa"**. Na sessão seguinte
disse o quê — três coisas:

1. **O mapa deve ser da localização dele**; sem sinal, poder escolher onde está; e daí calcular as
   distâncias, **que também aparecem nos cartões**.
2. **Faltaram os filtros na tela de hoje.**
3. **A barra do menu deveria estar fixa no fim do aparelho** — "não vi isso". (Confirmado no
   código: ela estava em fluxo normal.)

**Spec:** `docs/superpowers/specs/2026-08-13-daqui-e-filtros-design.md` (aprovada por ele)
**Plano:** `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md` (12 tasks, aprovado)

### As decisões que ele tomou no brainstorm (não reabrir)

| Tema | Decisão |
|---|---|
| Pedido de GPS | **Um toque na primeira vez** ("Ver daqui"), automático depois. Nunca sozinho na abertura. |
| O que o mapa enquadra | **Você e todas as trilhas juntos**, com piso de legibilidade (zoom 8). |
| Sem GPS | **Digitar a cidade e escolher na lista.** O app guarda. |
| Recortes | Distância, "dá hoje", custo, **esforço e duração** (campos novos). |
| Forma do filtro | **Uma linha de resumo que abre um painel**, não chips permanentes. |
| De onde o painel abre | **Desce da linha e empurra a lista** (sanfona), não cortina por cima do mapa. |

O "piscar" (a home abre sem você e num instante se reenquadra com você) **ele viu desenhado e
disse que não incomoda**. É consequência inevitável da regra do primeiro render.

## Onde a rodada parou, commit a commit

| Task | Estado | Commits |
|---|---|---|
| 1 — localização pura (`src/lib/local.ts`) | **completa, revisão limpa** | `f07da0c`, `ecc0fc9` |
| 2 — contexto (`src/app/local.tsx`) | conserto feito, **falta só a re-revisão** | `e4dbae2`, `ee28635` |
| 3 a 12 | não começadas | — |

Suíte: **317/317** (a base da rodada era 278). Árvore limpa em `164774e`.

## Invariantes que não podem ser quebradas

Herdadas e ainda valendo:

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Depende de `force-dynamic` na
  home e na ficha. Vale pro mosaico do mapa também.
- **`useVenceu` devolve `false` no primeiro render, sempre.**
- **Uma trilha, uma fonte.** Cartão, selo, pin, cabeçalho do grupo — e agora o km. Sexta porta.
- **A regra de CSS da fase carrega `[data-state]` junto**, senão perde de especificidade e
  "SEM INFORMAÇÕES" sai em selo verde. Vale pro `.selo` e pro `.pin-home`.
- **Sem leitura o app INFORMA, não manda:** `SEM INFORMAÇÕES · tome cuidado`.
- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.**
- **Tudo ou nada no clima:** falha na busca → nenhuma trilha recebe carimbo.
- **A série de clima prova de que coordenada veio**; **slug repetido estoura no carregamento.**
- **Nenhuma URL de trilha responde com o corpo de outra**, online ou offline.
- **Sem `next/link`.** Âncora pura. **`© OpenStreetMap`** em todo mapa (ODbL).

Novas desta rodada:

- **Primeiro render sem localização e sem filtro, SEMPRE**, mesmo com dado guardado. Mesma razão
  do `useVenceu`: a home chega do cache do service worker com HTML velho.
- **Uma pessoa, uma fonte:** mapa, cartão e filtro leem a MESMA localização. Nada mais no app pode
  chamar `navigator.geolocation` por conta própria — o `DistanciaDaqui` da ficha ainda chama, e a
  Task 7 é quem o migra.
- **Não inventar geografia.** Nome de cidade só quando o serviço devolveu (o GPS não devolve nome,
  por isso a pílula diz só "daqui"). `esforco`/`duracao` só quando o João disser — por isso são
  **opcionais** no schema.
- **"em linha reta" não é droppável** em nenhum texto de distância.

## Deferidos vivos (registrados, nenhum bloqueia)

Desta rodada (estão no ledger, o revisor final vai triar):

- `src/lib/local.ts:53-54` — limites 90/180 sem comentário de derivação.
- `tests/app/local.test.tsx` — `beforeEach` importado e nunca usado (entrou no fix round da Task 2).
- `src/app/local.tsx` — os dois `Provider` recebem objeto literal novo a cada render.
- Sem de-dupe de `pedirGps()` em toque duplo.

Herdados:

- `useVenceu` duplica o relógio do `Carimbo.tsx`.
- `home.css` não tem a regra neutra de `data-fase="conferindo"` que o `ficha.css` tem.
- `HomeViva` usa `!== "hidden"` e `Carimbo` usa `=== "visible"`; nenhum teste cobre aba oculta.
- Cookie `bp_ultima` órfão até 1 ano nos celulares que já usavam o app.
- `ensureSchema` (`src/lib/db.ts`) declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte.
- Deploy no meio com a página aberta: chunks somem, o JS morre, a tela congela.
- A home não tem `<h1>`; sem `:focus-visible` em `.cartao`, `.pin-home`, `.barra-item`.
- A folha não sobrepõe a base do mapa como a spec da rodada anterior pedia.

## Lições que valem além desta rodada

1. **Teste de mutação decide qualquer discussão sobre teste.** Apague a linha, veja falhar,
   devolva, cole a saída. Esta suíte já produziu **oito** testes que passavam com o código
   apagado — e as revisões desta rodada já pegaram mais cinco lacunas do mesmo tipo.
2. **Mutação sub-cláusula a sub-cláusula, não a linha inteira.** Apagar a linha toda "provou" um
   `ehCoord` e deixou passar um `em` sem teste nenhum.
3. **Aponte o teste pro PONTO DE USO**, não pro arquivo de nome parecido.
4. **Para artefato que vira entrada de outra coisa, a prova é USÁ-LO** (o questionário: responder
   e rodar o JSON contra o schema).
5. **Nenhum teste desta suíte mede geometria renderizada.** Se um número de pixel importa, medir
   em navegador é a única prova. "Parece certo" não é resposta; "não medi" é.
6. **Defeito de junção não aparece na revisão de task** — por isso a revisão da branch inteira é
   obrigatória. Em três rodadas seguidas ela achou o que nenhuma revisão de task pegou.
7. **O plano é o elo fraco.** Quando o revisor rotula um achado "plan-mandated", quase sempre quer
   dizer que a lista de testes do plano tinha buraco — não que o revisor esteja errado.

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + **o celular** + **os fatos de
roteiro**. Código, deploy e verificação eu toco. **Agentes: autorizados nesta rodada.**

### Pendências dele, e nenhuma trava a rodada

1. **Esforço e duração da Rampa do Pepe** — quão puxada (leve/média/puxada) e quanto tempo leva
   (em minutos). Vira uma linha no cartão. Sem isso a Rampa só não mostra essa linha.
2. **Responder `docs/questionario-ficha.md`** — a segunda ficha. Filtro que filtra um item e km
   num cartão só não mostram que funcionam; ele sabe disso e escolheu construir em paralelo.
   **A Task 8 acrescenta duas perguntas ao questionário — ele deve responder DEPOIS dela**, senão
   responde duas vezes.
3. **Abrir a home no iPHONE.** A home nova **nunca foi vista em WebKit**. Quatro perguntas, na §15
   da spec: os pins estão dentro do mapa com folga? A barra fixa e a faixa de gesto convivem? O
   painel de filtros empurra a lista sem pular? O piso de zoom 8 orienta ou vira mancha?

## Registro histórico (não refazer)

- Rodada 1 (esqueleto): merge `a179e46`. Rampa ao vivo (Versão D): `7d4bd59`. "Fui": `4b6d9a7`.
  Mapa de verdade: `a671146`. Forma de app: `6ef0fdc`. Carimbo busca leitura nova: `9c3dcf8`.
  Home "Hoje": `645ebe1`.
- **iPhone provado em 2026-08-10** com a versão anterior à home. Da home pra cá, não.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute).
- Os mockups do brainstorm desta rodada estão em `.superpowers/brainstorm/2019-1786672214/content/`
  (git-ignorado): `mapa-centro.html`, `layout-filtros.html`, `folha-de-cima.html`.
