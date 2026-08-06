# Design — Forma de app (a moldura)

**Data:** 2026-08-05
**Contexto:** A Rampa do Pepê está no ar (https://bateperna.vercel.app) com carimbo ao vivo, "Fui" de verdade e mapa de tiles. Este é o **terceiro e último** dos pedaços que o João levantou ao usar no celular — o que o spec do mapa deixou anotado como "merece brainstorm próprio".

O pedido original foi "menu / forma de app". O brainstorm separou o pedido em duas camadas, e o João escolheu a ordem **moldura primeiro, arquitetura depois**:

- **A moldura** — a casca do navegador. Hoje não existe `public/`, nem manifest, nem ícone, nem `theme-color`: no celular aquilo é uma aba do Chrome, com barra de URL por cima da ficha, sem ícone na tela inicial, que some quando a aba fecha. É *literalmente* uma página. **É este spec.**
- **A arquitetura** — o beco por dentro: home rica que responde "o que dá pra fazer hoje" com carimbo de cada trilha, descoberta, filtro por modo/espécie. **Sub-projeto 2, spec próprio.**

A decisão "veículo = PWA" já estava tomada desde o build-shaping da Fase 1 e nunca foi executada. `@serwist/next` e `serwist` estão no `package.json` desde a Rodada 1, instalados e nunca cabeados.

## Objetivo

O BatePerna deixa de ser uma página aberta no navegador e passa a ser **um app instalado no celular** — ícone próprio na tela inicial, tela cheia, e que **continua servindo quando o sinal acaba**. Instalar muda o contexto de uso: o app passa a ser aberto no mato, que é exatamente onde ele serve e exatamente onde não tem rede.

## Escopo (cravado)

**Faz:**
- Manifest, ícone próprio (marca geométrica, não emoji), `theme-color` nas duas variantes de tema, `display: standalone` e respeito às *safe areas*.
- Mata o `SLUG` cravado: a ficha vira `/[slug]`, e passam a caber as ~6 fichas que o João tem material pra produzir.
- `/` deixa de renderizar e vira **despachante**: manda pra última ficha que você abriu.
- `/trilhas` — lista crua das fichas, a **saída** que impede o app instalado de te trancar numa ficha só.
- Service worker: offline serve a ficha inteira, com o carimbo caindo no ramo honesto que já existe.
- **Validade do carimbo** — a correção de um bug que já existe hoje (ver "Decisões de produto").

**NÃO faz (de propósito):**
- **Não** faz a home rica com carimbo por trilha. Carimbo na lista = N chamadas ao Open-Meteo por abertura. É o sub-projeto 2, e é o motivo de `/trilhas` ser feia de propósito: ela é andaime, não dívida.
- **Não** faz filtro, busca, nem agrupamento por modo/espécie. Com 1 ficha no repo hoje, seria estrutura pra conteúdo que não existe.
- **Não** constrói botão/convite de "instalar". No Android o Chrome oferece sozinho com manifest + SW de pé; no iPhone é Compartilhar → Adicionar à Tela de Início, uma vez, na mão. Convite de instalação pra um usuário é desperdício.
- **Não** deixa o placar do "Fui" funcionar offline. Placar velho é número inventado; o botão degrada como já degrada.
- **Não** mexe no motor, no `avaliar`, no `fetchPrecip`, no banco nem no mapa.

## Decisões de produto

- **O ícone abre na última ficha que você viu.** Escolhido contra a recomendação inicial (que era "sempre a Rampa"), e a escolha se sustenta: no sábado da ida você abre o app cinco vezes seguidas pra mesma trilha. Mas ela **cobra uma saída** — instalado em tela cheia não há barra de URL pra digitar outro slug, então sem `/trilhas` o app te tranca. Seria o mesmo beco de hoje, só que sem porta. Por isso `/trilhas` entra nesta rodada e não na seguinte.
- **`/` redireciona de verdade, não renderiza a ficha no lugar dela.** Efeito colateral que vale por si: a URL na tela vira `/rampa-do-pepe`, então mandar o link pra alguém leva a pessoa pra ficha certa — e não pra *sua* última ficha.
- **A memória do "onde você estava" se divide por capacidade, não por gosto.** O desenho original era "um middleware faz os dois lados"; o planejamento derrubou isso. O middleware **não enxerga `content/fichas`** — ele roda fora do runtime que tem `fs`, então não tem como validar se o cookie aponta pra uma ficha que ainda existe. Server component, por outro lado, lê `fs` e lê cookie, mas **não pode gravar** cookie durante o render no Next 15. Então cada metade fica onde ela é possível:
  - `src/middleware.ts` **grava** o cookie ao servir uma ficha. É só string, não precisa de `fs`.
  - `src/app/page.tsx` **lê** o cookie, valida contra `getAllFichas()` e redireciona. Precisa de `fs`, e tem.

  Cookie inválido é inofensivo por construção: quem valida é o lado que sabe. E gravar via `document.cookie` num `useEffect` continua descartado — sobraria JS no cliente pra fazer o que o servidor já faz.
- **O cookie chama `bp_ultima`, com sublinhado.** Dois-pontos é separador na RFC 6265 e não vale em nome de cookie — os `bp:` que existem hoje no código são chaves de `localStorage` (`ConfirmarFui.tsx:15`), onde qualquer string serve.
- **O carimbo tem validade.** Este é o achado do brainstorm. A ficha é renderizada no servidor **com o carimbo embutido no HTML** (`page.tsx:63`), então cachear a página é cachear o carimbo — e o service worker ingênuo entregaria offline um *"Pode subir"* de três horas atrás com cara de agora. É exatamente a mentira que foi recusada quando "último carimbo com hora" foi oferecido como opção. Ligar o offline sem tratar isso transformaria a opção escolhida na opção rejeitada.

  Pior: **o bug já existe hoje, sem offline nenhum.** Aba aberta às 7h, olhada às 11h — o carimbo continua dizendo "Pode subir". Ele nunca teve prazo.

  Correção: o carimbo carrega a hora em que foi calculado, e um pedaço mínimo de JS o **desqualifica aos 30 minutos**, caindo no ramo honesto que já existe (`sem leitura · cheque no portão`), acrescido de "última leitura às 8h12".
- **Desqualificar cai pro lado seguro, e isso é coerente.** "Não suba" quando na verdade é "não sei" já é o comportamento do ramo de erro de hoje (`page.tsx:27`), aprovado no design da Rampa ao vivo. O subtexto é que carrega a verdade: *sem leitura, cheque no portão*.
- **Os tiles do OSM entram no cache.** É o ganho offline mais concreto depois da própria ficha: o mapa continua aparecendo na estrada, que é onde você quer olhar pra ele. Cachear tile visitado é uso normal e previsto; o que a política do OSM proíbe é download em massa, que não é o que acontece aqui.
- **O ícone é uma pegada de bota**, escolhido entre pegada / carimbo / serra / trilha com as quatro julgadas recortadas em círculo e a 48px. "Bate perna" é andar: é a única opção em que o nome do app e o desenho são a mesma coisa, e a simetria faz o corte maskable não tirar nada. O carimbo era o mais fiel ao produto e perdeu por geometria — retângulo dentro de círculo perde os cantos, e a 48px vira borrão. Ele continua brilhando onde já está, dentro da ficha.
- **Emoji não vira ícone de app.** 🥾 vira quadrado tofu em boa parte dos aparelhos, e o Android exige uma versão *maskable* de qualquer jeito.

## Arquitetura

Princípio load-bearing, herdado do "Fui" e do mapa: **a decisão nunca depende das peças novas.** O carimbo continua sendo server-rendered no primeiro paint, sem JS, só-clima, sem tocar no banco. Middleware, service worker e validade são camadas por fora — cada uma cai sozinha sem derrubar a ficha.

```
/  (server component — tem fs, lê cookie, não grava)
   └─ lê cookie bp_ultima → valida contra getAllFichas() → redirect /[slug]
      cookie ausente ou apontando pra ficha que não existe → /trilhas

middleware (não tem fs, só grava)
   └─ ao servir /[slug], grava bp_ultima na resposta

/[slug]  (server component, force-dynamic)   ← todo o page.tsx de hoje, sem o SLUG cravado
   └─ carimbo: getFicha → fetchPrecip → avaliar        [SÓ CLIMA, inalterado]
   └─ carimbo carrega calculado_em                     [NOVO]
   └─ <CarimboValidade> (client, ~20 linhas)           [NOVO — desqualifica aos 30min]
   └─ mapa, Fui, distância                             [inalterados]
   ← middleware grava bp:ultima na resposta

/trilhas  (server component)
   └─ getAllFichas() → nome + rótulo de escaneio + link

src/app/manifest.ts · icon.tsx · apple-icon.tsx        [NOVOS]
src/app/sw.ts (serwist)                                [NOVO]
```

**Peças novas e suas fronteiras:**

| Peça | Faz | Depende de |
|---|---|---|
| `src/lib/despacho.ts` | Puras: `(cookie, slugsExistentes) → destino` e `(pathname) → é ficha?`. | nada |
| `src/app/page.tsx` | Lê cookie, valida, redireciona. | `despacho.ts`, `getAllFichas` |
| `src/middleware.ts` | Grava o cookie nas respostas de ficha. | `despacho.ts` |
| `src/lib/validade.ts` | Função pura: `(calculadoEm, agora) → válido?`. | nada |
| `src/app/CarimboValidade.tsx` | Client, troca o carimbo quando vence. | `validade.ts` |
| `src/app/trilhas/page.tsx` | Lista. | `getAllFichas` (já existe) |
| `app/manifest.ts` | Manifest tipado do Next. | nada |
| `src/app/sw.ts` | Estratégias de cache. | serwist |

**Estratégias do service worker:**

| O quê | Estratégia | Por quê |
|---|---|---|
| Navegação (`/[slug]`, `/trilhas`) | Rede primeiro, cache como rede de segurança | Carimbo fresco quando dá; cache só quando a rede falha |
| Estáticos do build | Precache | A casca |
| Tiles do OpenStreetMap | Cache primeiro, com validade | O mapa na estrada |
| `/api/confirmar` | Só rede | Placar velho é número inventado |

## A moldura, em detalhe

- **`src/app/manifest.ts`** — código tipado, não JSON solto em `public/`. `display: "standalone"`, `scope: "/"`, `start_url: "/"` (o despachante, então o manifest não precisa saber qual é a última ficha), `lang: "pt-BR"`. Sem travar orientação.
- **`theme-color` em duas variantes** — `#E7DFD0` no claro, `#100D08` no escuro: os dois `--ground` que já existem em `ficha.css:6` e `ficha.css:26`. Sem isso a barra de status fica branca por cima de ficha escura.
- **Safe areas** — `viewport-fit=cover` e `env(safe-area-inset-*)` no `.bp`. Em tela cheia não existe mais barra do navegador segurando o conteúdo, e no iPhone o topo da ficha vai parar debaixo do relógio. É o detalhe que mais denuncia PWA mal feito.
- **O ícone vira PNG por código, em rota estática.** `src/app/icones/[nome]/route.tsx` com `ImageResponse` (`next/og`), `dynamic = "force-static"` + `generateStaticParams` — os PNGs são prerenderizados no build, não gerados por request, e ficam em URLs fixas (`/icones/192`, `/icones/512`, `/icones/maskable`, `/icones/apple`) que o manifest pode citar sem depender de hash. A pegada é desenhada em **formas geométricas apenas**: texto em `ImageResponse` exigiria embutir arquivo de fonte no bundle. A maskable ganha margem interna pra sobreviver ao corte (zona segura de 80%). Fundo `--accent` `#A5522A`, glifo em creme `#F8F2E6` — a mesma lógica do `.brand .mk` de hoje (`ficha.css:50`).

  Descartado gerar os PNGs por script e commitar em `public/`: `next/og` **não está no mapa de `exports`** do `next@15.5.22`, então um script Node só o alcança importando `./node_modules/next/og.js` por caminho — que quebra em qualquer upgrade. Dentro do app o bundler resolve normalmente. (Verificado nos dois sentidos durante o planejamento.)
- **A saída** — o `🥾 BatePerna` da appbar vira link pra `/trilhas`, com alvo de toque ≥44px e cara de tocável; hoje é texto morto (`page.tsx:74`). Em `/trilhas` ele não leva a lugar nenhum.
- **`/trilhas`** reusa a casca e os tokens de `ficha.css` — mesma appbar, título, lista de rótulo de escaneio + nome.

## Testes

Vitest, `tests/` espelhando `src/`, como o resto do projeto.

- **Despacho** — cookie válido → aquela ficha; cookie apontando pra ficha apagada → `/trilhas`; sem cookie → `/trilhas`.
- **Validade** — desqualifica aos 30min, não desqualifica aos 29.
- **`/trilhas`** — lista todas as fichas de `content/fichas`, cada uma com link.
- **Manifest** — tem `start_url`, `display: "standalone"` e um ícone maskable. Teste-cadeado: sem ele, o app deixa de ser instalável em silêncio.
- **Cadeado de deploy** — toda rota que lê ficha está declarada em `outputFileTracingIncludes`.

## Riscos aceitos e armadilhas

1. **`outputFileTracingIncludes` mapeia só `"/"`** (`next.config.mjs`). O comentário no arquivo registra que essa exata armadilha já quebrou o deploy uma vez, e ela **só aparece em produção** — o tracer estático do Next não enxerga o `readdirSync` de `ficha.ts`. Com `/[slug]` e `/trilhas` nascendo, a chave tem que crescer junto. Mitigado pelo teste-cadeado; é feio de propósito.

   O planejamento achou que **`/api/confirmar` já lê ficha** (`route.ts:13`, pra validar o slug) e **nunca foi declarado** — e mesmo assim funciona em produção (verificado: `GET /api/confirmar?slug=rampa-do-pepe` devolve `200 {"foram":0,"barro":0}`). O tracer leva `content/` pra lá por conta própria. Isso é sorte, não garantia. Em vez de afrouxar a regra do cadeado pra caber a exceção, as rotas que faltam passam a ser **declaradas** — a invariante fica verdadeira em vez de sortuda, e o custo é alguns KB de JSON no bundle.
2. **Service worker grudado é veneno.** Uma versão ruim no celular serve conteúdo velho por tempo indeterminado e é chata de desinstalar. Mitigação: assume o controle assim que baixa (`skipWaiting` + `clientsClaim`), e desligado em `dev`.
3. **A desqualificação do carimbo depende de JS.** Se o JS não rodar, o pior caso é o carimbo velho — exatamente onde já estamos hoje. Nunca é pior que o estado atual, e o caminho normal (carimbo fresco no primeiro paint, sem JS) não muda.
4. **`/trilhas` é feia.** Lista crua, sem carimbo, sem filtro. É andaime até a home rica; quando o sub-projeto 2 chegar, ela é descartada, não refatorada.
5. **A virada futura de `/`.** Quando a home rica existir, `/` deixa de despachar e vira ela. Isso muda o comportamento do app já instalado. Com um usuário, a virada é de graça — mas fica registrado que ela é uma virada, não um acréscimo.
6. **`.superpowers/` não está no `.gitignore`** — os mockups desta sessão iriam pro repo. Entra junto.

## Fronteira do João

Instalar no celular (Compartilhar → Adicionar à Tela de Início, no iPhone) e olhar. O resto — código, deploy, verificação — é meu.
