# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** Antes ele vivia em `.superpowers/sdd/.../RESUME.md`, que tem `.gitignore` com `*` — era scratch, e um `git clean -fdx` teria apagado justamente o mapa de retomada. Mantenha aqui.

**Última parada:** 2026-08-10. **Estado: duas rodadas fechadas hoje, as duas MERGEADAS e NO AR. `main` em `9c3dcf8`, 195/195.**

## Onde parou exatamente

**Rodada A — a moldura de app** (merge `6ef0fdc`): revisão final → leva única de correção (`d5d8987`) → merge → deploy.

**Rodada B — o carimbo busca leitura nova** (merge `9c3dcf8`): SDD com 5 tasks por subagente + revisão por task, revisão da branch inteira (opus) → leva única de correção (`026bf0a`) → re-revisão que reproduziu as 5 mutações à mão → merge → deploy.

Produção verificada no domínio real depois de cada uma: `/` despacha 307, `/api/carimbo` devolve o trio com `no-store` e 404 pra slug inventado, o carimbo chega no primeiro paint server-rendered **já pintado**, e as quatro metas de iOS saem no HTML.

**O único passo que sobrou é do João: instalar na tela inicial do iPhone.** É o aparelho-alvo e **segue sendo o único ambiente que nenhuma verificação cobriu** — tudo foi provado no Chrome e por curl.

## Rodada B — o que entrou, e o que ela ensinou

No portão do morro, às 11h, o celular sai do bolso com uma leitura das 7h. O app reconhecia honestamente que não sabia — e se calava justamente na hora da decisão. Agora ele busca a resposta de agora.

- **Rota `GET /api/carimbo?slug=`** devolve `{estado, erro, calculadoEm}`, calculado pela **mesma** função que a página usa (`resolverEstado`, extraída pra `src/lib/carimbo-estado.ts`). Duas fontes pro mesmo carimbo seriam a semente de duas respostas pro mesmo morro.
- **Três fases** no `Carimbo`: afirmando / conferindo / sem informações. A busca dispara em `visibilitychange`, em `pageshow` e no toque, com regras diferentes por gatilho (`src/lib/carimbo-fase.ts`, lib pura e testada sozinha). 3s tiram o "Conferindo…" da tela **sem cancelar a requisição**; piso de 30s entre buscas automáticas, que o toque ignora.
- **Mudança de postura, decisão do João:** sem leitura, o app não manda mais. Diz `SEM INFORMAÇÕES · tome cuidado` e devolve a decisão. **`Não suba` ficou reservado pro barro que o motor MEDIU** — ordem com dado por trás, em vez de resposta padrão pra ignorância. O carimbo sem informação vira `<button>` de verdade (`toque pra conferir`).
- Junto, três deferidos da rodada anterior: reavaliação em `visibilitychange`/`pageshow`; o **middleware saiu** e quem grava a última ficha é `LembrarUltima`, dentro da ficha que renderizou; e o service worker **aquece `/trilhas` na instalação**.

**O defeito que a rodada criou, e que só a revisão da branch inteira pegou:** a decisão passou pro cliente e a **cor** ficou no servidor. `data-state` no `<main>` vinha do render e pintava selo e pin. Sair de casa com sol e chegar no portão com chuva mostrava **"Não suba" dentro de um selo verde**. A cor é o que se lê primeiro. Conserto (`026bf0a`): o `<main>` virou `src/app/Moldura.tsx` (client) e a cor viaja por contexto **no mesmo lote** do `setLeitura` — escrever no DOM por efeito teria reintroduzido um quadro contraditório.

**Duas lições de método desta rodada:**
- **Teste de mutação decide discussão sobre teste.** Um teste "provava" que `setVenceu` era independente da busca; apagar a linha não quebrava nada. A conclusão certa não foi escrever outro teste, foi descobrir que a linha é redundante hoje, mantê-la como cinto (vira load-bearing se `podeBuscar` passar a barrar algum caso vencido), e corrigir o teste que mentia.
- **`next dev` roda StrictMode e mentia.** `vivo.current` nunca era rearmado, então no segundo mount a tela travava em "CONFERINDO…" pra sempre — só em dev, exatamente onde a gente confere com o olho.

### O que a revisão final achou (e o que virou de cada um)

Corrigidos em `d5d8987`, antes do merge:

1. **(a) O "lido da chuva agora" mentiroso** — já era decisão do João. Com `erro=true` e carimbo no prazo (Open-Meteo fora do ar, o ramo mais provável), a ficha dizia "Não suba · sem leitura" e logo abaixo `.live` dizia "lido da chuva agora". **Metade do defeito era CSS:** a regra que para o pulso existia, mas presa a `data-venceu`, e o ramo de erro não tem esse atributo. As duas pontas agora penduram em `data-sem-leitura`, com teste lendo o `ficha.css` pra o par não desemparelhar. Estava no ar; não veio desta branch.
2. **`/__ultima__` respondia com o corpo da última ficha.** A chave do ponteiro do SW tem cara de slug (um segmento, sem ponto), então `ehCaminhoDeFicha` a aprovava: virava "navegação nossa", o 404 da rede não é `ok`, e a busca no cache achava o ponteiro. **Valia online também.** Mesma classe do defeito que já tínhamos fechado offline.
3. **Faltava a meta de iOS.** O Next 15 traduz `appleWebApp.capable` pra `mobile-web-app-capable`, a tag padrão — que o **WebKit só lê do iOS 17.4 em diante**. A antiga com prefixo `apple-` vai junto, provada lendo o HTML do build.

Achados e **não** corrigidos (decisão do João: registrar, não consertar agora):

4. **Instalar e sair sem nunca ter navegado = ícone morto.** Se o SW não guardou nada e a pessoa abre offline, `planoDaRaiz()` não acha ficha nem `/trilhas` e volta `Response.error()` — a tela de erro do Safari, **em standalone, sem barra de URL**. Fecha aquecendo `/trilhas` no `install` do SW (~5 linhas).
5. **Deploy no meio → ficha offline sem JS → carimbo que nunca vence.** Sequência estreita: você abre só `/trilhas` online (o SW sobe pra v2 e poda o precache v1), o HTML da ficha em `bp-ultima-ficha` continua v1, e offline ele carrega sem os chunks — **sem hidratação, o carimbo fica congelado afirmando "Pode subir"**. O conserto óbvio (limpar `bp-ultima-ficha` no `activate`) tem regressão própria: troca a mentira por um beco justamente quando você está na serra.
6. **Middleware grava o cookie mesmo em 404** — link quebrado apaga a memória boa. Degrada pra `/trilhas` e se cura sozinho no próximo acesso real.

### Decisões do João (não reabrir)

- **(b) fica pra rodada própria:** o carimbo só reavalia num `setInterval` de 60s, então aba em segundo plano corrige até um minuto tarde. Celular no bolso desde as 7h, desbloqueado no portão às 11h → carimbo velho por até 60s. `visibilitychange`/`pageshow` resolveria. O service worker tornou "página retomada do cache" o caso normal, então isso ficou **mais provável do que era**.
- **Merge direto em `main`** (padrão das rodadas anteriores) + deploy em produção. Feito.

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
- **O achado 5** da revisão final da Rodada A (acima): deploy no meio → ficha offline sem os chunks novos → sem JS → carimbo não vence sozinho.
- **Follow-ups opcionais da Rodada B:** travar por teste que palavra e cor caem no mesmo quadro commitado; cadeado de grep contra `next/link` sem `key={slug}` (`Moldura` e `Carimbo` guardam estado semeado por prop, o que só é correto enquanto a navegação for recarga inteira); a fatia larga demais no teste 1 do `sw.test.ts`.
- **Pergunta de design, não dívida:** o pin do mapa acompanha o *estado* mas não a *fase* — com "sem informações" ele fica na cor da última leitura enquanto o selo vira parada. É anterior a estas rodadas.

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
- Forma de app: merge `6ef0fdc` (branch `forma-de-app` preservada, HEAD `d5d8987`) + deploy em produção.
- Carimbo busca leitura nova: merge `9c3dcf8` (branch `carimbo-na-retomada` preservada, HEAD `026bf0a`) + deploy em produção. Spec e plano em `docs/superpowers/`.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute; a rota cron existe mas não roda).
- `ensureSchema` (`src/lib/db.ts`) ainda declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte, inconsistente com `{seco,barro}`. Limpar em passada futura.
