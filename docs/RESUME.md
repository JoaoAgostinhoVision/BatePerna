# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** Antes ele vivia em `.superpowers/sdd/.../RESUME.md`, que tem `.gitignore` com `*` — era scratch, e um `git clean -fdx` teria apagado justamente o mapa de retomada. Mantenha aqui.

**Última parada:** 2026-08-06. **Estado: a moldura de app está construída e revisada, na branch `forma-de-app`. NÃO mergeada, NÃO deployada.**

## Onde parou exatamente

A branch `forma-de-app` tem **10 commits** (base `f07a1e9`, HEAD **`c02a5e2`**), working tree limpo, **133/133 testes**. As 7 tasks do plano estão implementadas e cada uma passou por revisão própria.

**A revisão da branch inteira (opus) foi disparada e a sessão acabou antes da resposta chegar.** É por aí que se retoma.

### Os 3 passos que faltam, nesta ordem

1. **Rodar a revisão final da branch inteira.** Pacote já gerado em `.superpowers/sdd/2026-08-05-forma-de-app/review-f07a1e9..c02a5e2.diff`. Foco pedido: as 7 tasks **juntas** — ninguém julgou a integração ainda. Em especial, hoje existem **três memórias independentes de "a última ficha"** (o cookie `bp_ultima`, a entrada do service worker, o histórico do navegador) e vale checar se podem discordar de um jeito que engane.
2. **Uma leva única de correção** com os achados da revisão final **+ este item já decidido pelo João:**
   > **(a) O "lido da chuva agora" mentiroso.** Quando a leitura de chuva falha e o carimbo ainda é recente (`erro=true`, não vencido — o caso comum de Open-Meteo fora do ar), a ficha diz "Não suba · sem leitura · cheque no portão" e logo abaixo a linha `.live` diz **"lido da chuva agora"** com o pulso piscando. Ela se contradiz. É o mesmo defeito de honestidade já corrigido no ramo vencido, só que no ramo mais provável. **Está no ar hoje**; não veio desta branch.

   Depois, **uma** re-revisão escopada só no diff da correção.
3. **Merge em `main` + deploy + instalar no celular.** João decidiu: `vercel --prod --yes` depois do merge, e ele instala na tela inicial. **O iPhone é o aparelho-alvo e é o único ambiente que nenhuma verificação cobriu** — tudo foi provado no Chrome.

### Decisões do João nesta sessão (não reabrir)

- **(a) entra antes do merge** (acima).
- **(b) fica pra rodada própria:** o carimbo só reavalia num `setInterval` de 60s, então aba em segundo plano corrige até um minuto tarde. Celular no bolso desde as 7h, desbloqueado no portão às 11h → carimbo velho por até 60s. `visibilitychange`/`pageshow` resolveria. O service worker tornou "página retomada do cache" o caso normal, então isso ficou **mais provável do que era**.
- **Merge direto em `main`** (padrão das 3 rodadas anteriores) + deploy em produção.

## O que esta branch construiu

Pedido original do João no celular: "menu / forma de app". O brainstorm separou em duas camadas e ele cravou a ordem — **moldura agora, arquitetura depois**.

| # | Task | O que entrou |
|---|---|---|
| 1 | `/trilhas` + cadeado | Lista crua das fichas (a **saída**) + teste que trava o `outputFileTracingIncludes` |
| 2 | `/[slug]` | `SLUG` cravado morreu; `/` virou despachante |
| 3 | Middleware | Grava o cookie `bp_ultima`; `/` lê e valida |
| 4 | Casca | Safe areas, `theme-color` nos 2 temas, a marca virou porta pra `/trilhas` |
| 5 | **Carimbo com prazo** | Vence em 30 min e cai em "sem leitura · cheque no portão" |
| 6 | Manifest + ícone | Pegada de bota, PNGs prerenderizados no build |
| 7 | Service worker | Offline honesto; `/api/*` nunca cacheado; tiles do OSM cacheados |

**A ordem tinha uma dependência de segurança:** a Task 5 (prazo) **precede** a Task 7 (SW). Invertida, o service worker viraria uma máquina de servir "Pode subir" de três horas atrás com cara de agora.

### Invariantes que não podem ser quebradas

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** `Carimbo.tsx` é client component, mas client components são SSR-ados; o JS só **remove** a afirmação quando ela envelhece. `useState(false)` inicial é deliberado — faz o HTML do servidor e o primeiro render do cliente concordarem.
- **Isso depende de `force-dynamic` sobreviver** em `src/app/[slug]/page.tsx`. Se a página virar estática, `calculadoEm` congela no build e **todo visitante recebe carimbo já vencido**.
- **O carimbo é só-clima e não toca o banco.** O placar do "Fui" é client-fetched. Banco cai → botão degrada, decisão nunca quebra.
- **Nenhuma URL de ficha pode ser respondida com o corpo de outra ficha.** Foi o bug mais grave que o plano continha; está fechado e tem teste-guarda não-vazio.
- **Geolocalização só depois de um toque**; **"em linha reta" em todo ramo**; **atribuição `© OpenStreetMap`** (obrigação ODbL). Todos com teste.
- **Sem `next/link`** em lugar nenhum — âncora pura. Não existe navegação soft neste app.

## Três bugs que o meu próprio plano continha (e as revisões pegaram)

Vale lembrar porque calibra o quanto revisar: **o plano estava errado em três lugares**, todos pegos por revisão ou pelo implementador parando em vez de improvisar.

1. **`viewBox` do ícone** — `"-12 -12 100 100"` jogava a pegada no canto inferior direito nos tamanhos com margem. Os dois últimos valores são largura e altura, não o segundo canto. Os ícones 192/512 (margem 0) mascaravam.
2. **Cache de tiles era no-op silencioso** — tiles do OSM são opacos (status 0) e o `CacheFirst` do serwist os recusa por padrão. O mapa teria sumido offline, que era metade do ganho.
3. **Fallback offline serviria a ficha errada** — trilha A na URL da trilha B. Montanha errada, carimbo errado. O pior defeito possível neste produto.

E um quarto, de outra natureza: o `networkTimeoutSeconds: 6` que especifiquei **nunca se aplicava às fichas** — `respondWith` para a propagação antes do roteador do serwist rodar. Modo avião falha rápido e funcionava; **uma barrinha de sinal na serra travaria num spinner**. Provado com servidor TCP que aceita e nunca responde: ficha em 6023 ms depois do conserto.

## Deferidos (o ledger tem a lista completa)

`.superpowers/sdd/2026-08-05-forma-de-app/progress.md` — **é scratch git-ignorado**, some num `git clean -fdx`. O essencial dele está aqui.

Menores carregáveis: cadeado de tracing só varre `.ts` flat em `src/lib`; rodapé duplicado em `trilhas/page.tsx`; componente chamado `Ficha` sobrecarrega o substantivo do domínio; `resolverEstado` sem teste próprio; slug com barra final entraria torto no cookie; sem teste do `aria-label` da saída; `viewport.test.ts` crava os hex; sem teste HTTP da rota de ícones; `manifest.ts` crava os caminhos dos ícones.

Nunca exercitado: **iOS Safari**, o caminho de `QuotaExceededError`, e uma eviction real do cache.

## Depois desta branch

- **Sub-projeto 2 — a arquitetura:** home rica que responde "o que dá pra fazer hoje" com carimbo por trilha, descoberta, filtro por modo/espécie. Quando chegar, `/` deixa de despachar e vira ela, e `/trilhas` é **descartada, não refatorada**. Isso muda o comportamento do app já instalado — é virada, não acréscimo.
- **Produzir as fichas.** João tem material pra meia dúzia (Natuba, Monte das Tabocas, Salvador, Praia do Sossego, Recife→Jaboatão). Cada uma precisa de **dado real dele**: coords, custo, regra da condição, a voz. Eu não invento geografia. O app agora comporta várias — hoje ainda só existe `content/fichas/rampa-do-pepe.json`.
- **(b) `visibilitychange`** no carimbo.

## Documentos desta rodada

- Spec: `docs/superpowers/specs/2026-08-05-forma-de-app-design.md`
- Plano: `docs/superpowers/plans/2026-08-05-forma-de-app.md`

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + o celular. Código, deploy e verificação eu toco.

## Registro histórico (não refazer)

- Rodada 1 (esqueleto: ficha Zod, motor, weather, Turso data-access, cron, confirmar): merge `a179e46`.
- Rampa ao vivo (Versão D + deploy): merge `7d4bd59`.
- "Fui" de verdade: merge `4b6d9a7` + chore `80178f9`.
- Mapa de verdade: merge `a671146` (branch `mapa-de-verdade` preservada).
- **Forma de app: branch `forma-de-app`, HEAD `c02a5e2`, AINDA NÃO MERGEADA.**
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute; a rota cron existe mas não roda).
- `ensureSchema` (`src/lib/db.ts`) ainda declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte, inconsistente com `{seco,barro}`. Limpar em passada futura.
