# Spec — a home "Hoje" (sub-projeto 2, fatia 1)

**Data:** 2026-08-11
**Rodada:** primeira das três em que o sub-projeto 2 foi cortado.
**Estado do app na entrada:** `main` em `501ed45`, 195/195, no ar em https://bateperna.vercel.app, instalado e aprovado no iPhone do João.

---

## 1. O problema

O app hoje é uma ficha excelente com uma lista crua na frente. `/` não é tela: é um despachante que redireciona pra última ficha aberta. `/trilhas` existe como andaime, declarada no próprio código como "feita pra ser descartada, não refatorada".

Falta a tela que responde **"o que dá pra fazer hoje"**. Ela é a virada do app de *uma ficha* pra *um app de trilhas* — e muda o comportamento de um PWA que já está instalado no celular do João, o que a torna virada e não acréscimo.

## 2. Como a rodada foi cortada

O brainstorm acumulou sete coisas: home-veredito, acervo, barra de navegação, memória do aparelho ("Fui" guardado + "já conheço"), filtros por chip, distância em km com GPS e saída manual por cidade, e campos novos em toda ficha. Isso é três rodadas.

**Corte fechado com o João:**

| Fatia | O que entra |
|---|---|
| **1 — esta** | A home "Hoje" com mapa e carimbo por trilha, o acervo, a barra de navegação |
| 2 | A memória: "Fui" passa a ficar no aparelho, entra o "já conheço", nasce a aba "Minhas" |
| 3 | Os recortes: chips de filtro, campos novos nas fichas, km com GPS e cidade |

**Achado que o mockup produziu e que precisa estar registrado:** os itens das fatias 2 e 3 são **invisíveis com uma trilha só**. Um filtro de km que filtra um item; um "não conheço" numa lista de um. A segunda ficha deixou de ser preferência e virou **dependência** das fatias 2 e 3. Por isso esta rodada entrega junto o questionário (§10) — ele destrava as próximas sem travar esta.

A ordem "home antes da segunda ficha" foi decisão do João e se provou certa: foi a home desenhada que revelou a dependência.

## 3. Fora de escopo (explicitamente)

Nada disto entra nesta rodada, e o plano não deve inventá-los:

- Filtros por chip. Os chips aparecem nos mockups; **não são construídos aqui.**
- Distância em km, GPS, busca por cidade.
- Memória do aparelho, "já conheço", aba "Minhas".
- Campos novos no schema da ficha.
- Mapa interativo (arrastar/zoom com o dedo) e qualquer biblioteca de mapa.
- Segunda ficha de conteúdo. O questionário é entregue; as respostas são do João.

## 4. As telas e as rotas

### `/` — a home "Hoje" (era despachante, vira tela)

Mostra **as trilhas que têm carimbo**, agrupadas pelo veredito:

- **"Hoje o tempo deixa"** — as `fresco`
- **"Hoje não"** — as `frio`

O segundo grupo não é o acervo voltando pra tela: é a mesma pergunta com a outra resposta. Sem ele, o primeiro sábado de chuva devolveria uma home em branco.

### `/trilhas` — o acervo (era andaime, vira destino)

**Tudo**, sem carimbo, feito pra navegar e descobrir — inclusive trilhas que não dependem de chuva. A ordem passa a ser **por nome**, e não mais a ordem em que o sistema de arquivos devolveu os JSONs: ordem de `readdir` é estável por acaso, não por contrato.

Home e acervo não mostram o mesmo conjunto nem respondem a mesma pergunta:

| | Home | Acervo |
|---|---|---|
| Conjunto | só as que têm `condicao` | todas |
| Carimbo | sim, por trilha | não |
| Ordem | pelo veredito | por nome, estável |
| Pergunta | "o que dá hoje?" | "o que existe?" |

### `/[slug]` — a ficha

Inalterada.

### A barra embaixo

Dois destinos: **Hoje** e **Trilhas**. O terceiro ("Minhas") **não entra** — aba morta é mentira; nasce na fatia 2 junto com a memória.

Aparece **só nas duas telas de topo**. Na ficha a saída continua sendo a marca no canto, já construída e aprovada: a ficha é onde a decisão acontece, e uma barra fixa embaixo disputa espaço com o carimbo e com o "Fui".

Respeita `env(safe-area-inset-bottom)` — a moldura já tem o tratamento, é reuso.

### O que morre

O cookie `bp_ultima`, `destinoDe`/`COOKIE_ULTIMA` em `despacho.ts` e o componente `LembrarUltima`. Existiam só pra `/` saber pra onde redirecionar; com a home no lugar, ficam sem consumidor no servidor.

**Não confundir com o ponteiro offline:** `CHAVE_ULTIMA` (`/__ultima__`) é do service worker, é gravado pelo próprio SW na navegação, e **continua** — ver §8. `ehCaminhoDeFicha` também continua (o SW usa).

## 5. A home por dentro

Do topo pra baixo:

1. **Appbar** — a marca, sem saída: aqui já é a casa. **Sem relógio.** Os mockups mostravam "sáb · 11h"; fica de fora de propósito — é decoração que envelhece na tela, e a home já tem uma coisa que diz a hora com significado, que é o carimbo.
2. **Mapa** — mosaico de tiles do OSM, **imagem, sem arrastar**, com um pin por trilha.
3. **Folha** — cartão arredondado sobrepondo a base do mapa, contendo os grupos e os cartões.
4. **Barra** — Hoje · Trilhas.

### O mapa

Reusa `MapaEstatico`/`mapa.ts`. O que é novo: hoje o mapa **centra num ponto**; a home precisa **enquadrar N pontos**.

Entra uma função pura em `mapa.ts`:

```
enquadrar(coords: Coord[], larguraPx, alturaPx) -> { centro: Coord, z: number }
```

Maior zoom em que a caixa envolvente de todas as coordenadas cabe na área, com margem pros pins não colarem na borda. Casos que a função tem que tratar sem quebrar: **uma coordenada só** (cai no zoom da ficha, `MAPA_ZOOM`), **coordenadas iguais**, e **zoom mínimo** (não descer abaixo de z=1). Pura e testada sozinha, como o resto de `mapa.ts`.

### O pin

**É uma âncora, não um botão de JavaScript:** `<a href="#<slug>">` que rola até o cartão daquela trilha na folha. Assim o toque funciona **sem JS nenhum** — regra da casa neste app, que não tem `next/link` em lugar algum e não faz navegação soft. O JavaScript só acrescenta o destaque visual do cartão alvo; nada essencial depende dele.

**A cor do pin sai da mesma fonte da cor do selo daquele cartão.** Isto é cicatriz da rodada passada: o pin do mapa guardou a leitura do servidor e ficou verde ao lado de um selo que já tinha virado vermelho. Uma trilha, uma fonte de cor.

### Regra de layout não-negociável

**O primeiro cartão da home aparece sem rolar.** O mapa é orientação; o carimbo é a decisão. Mapa que empurra o primeiro veredito pra baixo da dobra está grande demais — o número do mapa cede, não o cartão.

Pra isso ser verificável e não opinião: **appbar + mapa + cabeçalho do grupo somam no máximo 320px**, o que deixa o primeiro cartão começar inteiro acima da dobra num iPhone de 667px de viewport (o menor ainda em uso). O mapa da home é mais baixo que o da ficha — `MAPA_ALTURA_PX` é 200 lá; aqui entra uma constante própria, na casa dos 170. O teste lê o CSS, no mesmo formato do teste que já trava o par de regras do `.live` em `ficha.css`.

### O cartão

Nome (serifada), promessa (itálico), e o selo do carimbo à direita, com o mesmo vocabulário visual da ficha: `Pode subir` / `Não suba` / `SEM INFORMAÇÕES`. O cartão inteiro é âncora `<a href="/<slug>">`.

## 6. O carimbo por trilha

### Uma chamada, não N

O medo registrado no comentário da `/trilhas` era "uma chamada ao Open-Meteo por trilha a cada abertura". **Não se confirma.** A Open-Meteo aceita várias coordenadas na mesma requisição (`latitude=a,b,c&longitude=x,y,z`) e devolve uma lista de resultados: **uma chamada de rede por abertura**, tenha a home 2 ou 20 trilhas.

O que parecia impedir isso: `past_days`/`forecast_days` são parâmetros globais da requisição, e cada ficha tem sua própria janela. Mas `avaliar` (em `motor.ts`) **já recorta a própria janela** a partir das horas que recebe — filtra `precips` por `agora − janela_passado` e `agora + janela_previsao`. Então a home pede o **máximo** entre todas as regras e cada ficha fatia o que é seu. **O motor não muda.**

> O comportamento multi-coordenada precisa ser **provado contra a API real** durante a construção, antes de qualquer código depender dele. Se não se confirmar, o fallback é `Promise.all` de N chamadas — mais lento, mesma interface, e o resto do desenho continua de pé.

### Uma só função julga

Ganha versão plural o **transporte da chuva**, nunca o **julgamento**. `avaliar` continua sendo o único lugar onde se decide se dá pra subir. Home, ficha e `/api/carimbo` não podem divergir sobre o mesmo morro na mesma hora.

Forma esperada:

- `weather.ts` — `fetchPrecipMulti(coords[], janela)` devolvendo uma lista de séries, **na ordem pedida**. `janela` carrega o **maior `janela_passado_horas` e o maior `janela_previsao_horas` entre todas as regras, calculados de forma independente** — não a janela de nenhuma ficha em particular.
- `carimbo-estado.ts` — `resolverEstados(fichas[])` devolvendo `Map<slug, LeituraCarimbo>`, chamando `avaliar` por ficha. `resolverEstado` (singular) continua existindo para a ficha e para `/api/carimbo`.

### O defeito perigoso desta rodada

A resposta volta como **lista**, e a única coisa que liga o resultado 3 à trilha 3 é a **ordem**. Um item a menos, ou fora de ordem, e a chuva de uma trilha vira o veredito de outra. É a mesma família do "ficha A respondendo com o corpo da ficha B", que foi o pior defeito do plano da rodada anterior.

**Regra:** a resposta é conferida antes de virar carimbo. Tamanho diferente do pedido → **ninguém** recebe carimbo (todos "sem informações"). Nunca um casamento parcial.

### Tudo ou nada, de propósito

Com uma chamada só, se a Open-Meteo cair, a home inteira fica sem leitura de uma vez. **É a escolha certa:** home com metade dos carimbos preenchidos parece defeito e a pessoa não sabe quais confiar. Todos sem leitura é uma frase honesta.

Sem leitura, a home usa a postura já decidida na rodada passada: **informa, não manda.** `SEM INFORMAÇÕES · tome cuidado`. `Não suba` segue reservado pro barro que o motor mediu.

### Prazo no servidor

Hoje, se a Open-Meteo pendurar, a página pendura junto. Na ficha nunca incomodou; na home, que é a porta do app, incomoda. **Prazo de 4s** no fetch do servidor: estourou → home responde "sem informações" em vez de ficar em branco. Mesma ideia do `PRAZO_REDE_MS` do service worker (6s), e pelo mesmo motivo: **falha rápida é fácil; o que mata é o pendurado.** Menor que o do SW de propósito — este roda dentro do tempo de resposta da página, aquele já é o último recurso.

O prazo precisa ser provado como o do service worker foi: **servidor TCP que aceita e nunca responde**, não só modo avião. Modo avião falha na hora e passaria mesmo com o prazo quebrado.

### Vencimento e renovação

Os carimbos da home vencem em 30 minutos, igual aos da ficha (`validade.ts`). Quando o app volta pra frente, a home busca as leituras novas **de uma vez**, nos mesmos gatilhos que a ficha já usa (`visibilitychange`, `pageshow`, toque), reaproveitando `carimbo-fase.ts`.

Entra `GET /api/carimbos` devolvendo `slug -> LeituraCarimbo` pro conjunto da home, `no-store`, calculado pela **mesma** `resolverEstados`.

Existia uma versão mais barata (carimbo vence, vira "sem informações", só se resolve entrando na ficha). **Recusada pelo João**, com a razão dita por ele: dá mais trabalho, mas é o que é fiel ao usuário. E ela reintroduziria de propósito o defeito que a rodada anterior consertou.

## 7. Sem JavaScript

A home funciona: mapa, pins, pins tocáveis (âncoras), cartões e carimbos **chegam pintados do servidor no primeiro quadro**. O que não funciona sem JS é a renovação e o destaque do cartão — camada de cima, não piso.

Depende de `force-dynamic` na home. Se ela virar estática, `calculadoEm` congela no build e **todo visitante recebe carimbo vencido** — a mesma armadilha que a ficha já tem travada por teste.

## 8. Offline e service worker

**A home nunca é gravada no cache.** É veredito do momento; guardada, viraria "pode subir" de três horas atrás com cara de agora. `/` já é tratado como coisa que não se grava (`resolverNavegacao`), então a regra continua valendo — o que muda é que agora `/` devolve HTML de verdade em vez de um 307.

**Mudança deliberada:** hoje `/` sem rede cai na **última ficha** e, não achando, na `/trilhas`. Isso fazia sentido enquanto `/` era despachante. Agora inverte — `planoDaRaiz()` procura **primeiro `/trilhas`**, depois a última ficha.

Razão: você toca no ícone esperando a tela de casa; cair dentro de uma trilha específica, que pode nem ser a que você queria, confunde mais do que ajuda. O acervo é a versão honesta da home quando não há clima pra ler. A última ficha continua guardada e continua abrindo pela URL dela.

`AQUECIMENTO` (`/trilhas` no `install`) já existe e passa a ser ainda mais load-bearing.

Os tiles do OSM continuam cacheados pela regra que já existe.

## 9. Testes não-negociáveis

1. **Alinhamento da lista.** Resposta curta, fora de ordem e vazia não podem virar carimbo trocado. Nenhum casamento parcial.
2. **Home e ficha não discordam** sobre o mesmo morro na mesma hora.
3. **Carimbo no primeiro quadro, sem JS**, e a home não é estática.
4. **A home nunca é gravada no cache**, provado pelas regras do SW.
5. **Offline, `/` abre o acervo**; nenhuma URL de trilha responde com o corpo de outra (guarda já existente, estendida).
6. **`enquadrar`**: uma coordenada, coordenadas iguais, coordenadas distantes, e o piso de zoom.
7. **Pin e selo da mesma trilha nunca saem em cores diferentes** no mesmo quadro.
8. **O primeiro cartão cabe acima da dobra** na altura de tela alvo.

## 10. Entregue junto: o questionário de ficha

`docs/questionario-ficha.md` — as perguntas que transformam o que o João sabe de um lugar numa ficha igual à da Rampa: coordenada, promessa, prêmio, a voz, custo, a regra da condição, o que se lê no portão, avisos, acesso. Formato: perguntas em português, respondíveis do celular, sem jargão de schema. Uma pergunta por campo do `fichaSchema`, sem sobrar campo nem sobrar pergunta.

**Eu não invento geografia nem logística.** Cada resposta vira um JSON em `content/fichas/`. É isto que destrava as fatias 2 e 3.

## 11. Riscos

- **O multi-coordenada da Open-Meteo.** Provado cedo; se falhar, `Promise.all` (§6).
- **Peso do mapa na home.** Um mosaico de tiles por abertura, mais tiles que a ficha se o enquadramento for largo. Se pesar, o zoom e a densidade (`MAPA_ESCALA`) são os números a mexer.
- **A home com uma trilha só.** Vai parecer vazia até a segunda ficha existir — é esperado, não é defeito, e o questionário é a resposta.

## 12. Decisões do João nesta rodada (não reabrir)

- Home antes da segunda ficha; **"um home bonito clareia as ideias"**.
- Acervo **fora** da home, em destino de menu — home com os dois na mesma tela é poluída.
- **Barra embaixo** (Hoje · Trilhas), não gaveta nem menu no título.
- **Distância em km**, não "bate-volta": bate-volta é relativo a quem pergunta, km é fato. (Fatia 3.)
- Distância sai do **GPS**, com saída manual por **cidade ou ponto de referência** quando o GPS estiver ruim. (Fatia 3.)
- Filtros são **controles na tela**, não tela de ajustes; o app lembra do último estado. (Fatia 3.)
- **"Fui" no aparelho *e* "já conheço" declarado** — os dois, porque são fatos diferentes. (Fatia 2.)
- Home no **layout A**: mapa em cima, folha com a lista embaixo, **pin tocável**. Nada de mapa interativo.
- **Renovação dos carimbos entra nesta fatia**, mesmo custando mais.
