# Spec — "de onde eu estou" e os filtros na home (sub-projeto 2, fatia 3)

**Data:** 2026-08-13
**Rodada:** a terceira do sub-projeto 2. A fatia 2 (memória: "Fui" no aparelho, "já conheço", aba Minhas) **fica pra depois** — o João pediu esta primeiro.
**Estado do app na entrada:** `main` em `db0fb1d`, 278/278, no ar em https://bateperna.vercel.app.

---

## 1. O problema

A home "Hoje" entrou no ar em 2026-08-12. Ao ver, o João disse: *"ficou legal, mas ainda faltou mais coisa."* Na sessão seguinte ele disse o quê — três coisas:

1. **O mapa deveria ser da localização dele**, e sem sinal ele deveria poder escolher onde está; a partir daí calcular as distâncias, **que poderiam aparecer nos cartões**.
2. **Faltaram os filtros na tela de hoje**, pra escolher o que é melhor pra ele.
3. **A barra do menu deveria estar fixa no fim do aparelho** — "não vi isso".

Os pontos 1 e 2 são a fatia 3 chegando antes da 2. O ponto 3 estava registrado como Minor deferido da rodada da home; a leitura do código confirma: a `BarraNavegacao` é renderizada em fluxo normal dentro do `.screen`, e o `home.css` não tem `position` nenhum nela.

**A virada de fundo:** a home passa a ter um conceito que ela não tem hoje — **onde a pessoa está**. Ele alimenta o mapa, o cartão e o filtro ao mesmo tempo, e é isso que faz desta rodada uma virada e não três ajustes.

## 2. O contexto que não dá pra esconder

**Existe uma ficha só** (`content/fichas/rampa-do-pepe.json`). Filtro que filtra um item e km num cartão só não mostram que funcionam. Isto foi levantado antes de qualquer desenho, e o João decidiu: **construir agora, respondendo o `docs/questionario-ficha.md` em paralelo.** A segunda ficha entra sozinha quando as respostas chegarem, e a tela já estará pronta pra ela.

Consequência pro plano: **nenhuma task pode depender de existir uma segunda ficha.** Onde a prova exigir duas ou mais trilhas, ela se faz com fixtures.

## 3. Fora de escopo (explicitamente)

- **Fatia 2 inteira:** memória do aparelho, "Fui" guardado, "já conheço", aba "Minhas".
- **Mapa interativo** (arrastar/zoom com o dedo) e qualquer biblioteca de mapa. O piso do §5 existe justamente porque não há como aproximar com o dedo.
- **Tempo de estrada real.** A distância é linha reta, e o texto diz isso.
- **Segunda ficha de conteúdo.** O questionário ganha duas perguntas; as respostas são do João.
- **Ordenar por distância.** A ordem da folha continua sendo a do veredito, cravada no servidor. Mexer nela é mexer no "um cartão não pula de lugar na tela", que é decisão fechada de outra rodada.

## 4. As decisões do brainstorm

Todas tomadas pelo João, com mockup no navegador onde a pergunta era visual.

| Tema | Decisão |
|---|---|
| Pedido de GPS | **Um toque na primeira vez** ("Ver daqui"), automático depois. Nunca pede sozinho na abertura. |
| O que o mapa enquadra | **Você e todas as trilhas juntos** (opção A), com piso de legibilidade. |
| Sem GPS | **Digitar a cidade e escolher na lista.** O app guarda a escolha. |
| Recortes | Distância, "dá hoje", custo, **esforço e duração** (os dois últimos são campos novos). |
| Forma do filtro | **Uma linha de resumo que abre um painel** (opção B), não chips permanentes. |
| De onde o painel abre | **Desce da própria linha e empurra a lista** (sanfona), não cortina por cima do mapa. |

O motivo de a sanfona ter ganhado da cortina está registrado porque vale além desta tela: este app não tem nenhuma camada flutuante, e uma cortina puxaria junto fechar-tocando-fora, prender o foco atrás dela e Esc — três coisas que hoje não existem aqui.

## 5. A localização

### 5.1 Uma peça só

Todo consumidor de "onde a pessoa está" — o mapa, o km do cartão, o filtro de distância — bebe da **mesma fonte**. É a quinta porta da invariante "uma trilha, uma fonte", e ela nasce com o mesmo risco de as portas discordarem que já custou um Critical.

```
Local =
  | { tipo: "nao-sei" }
  | { tipo: "gps",       coord: Coord, em: number }
  | { tipo: "escolhido", coord: Coord, em: number, nome: string, regiao: string }
```

`nome`/`regiao` existem só no caso escolhido porque só ali há um rótulo de verdade pra mostrar ("de Gravatá"). O GPS não devolve nome de cidade, e **inventar um seria inventar geografia** — com GPS a pílula diz "daqui", sem nome.

Guardada no aparelho (`localStorage`, chave `bp.local`). Leitura corrompida ou de formato desconhecido → `nao-sei`, sem estourar: dado guardado por uma versão antiga do app não pode derrubar a home.

### 5.2 A regra dura do primeiro render

**No primeiro render a localização é SEMPRE `nao-sei`**, ainda que esteja guardada. Ela entra depois, num efeito.

Motivo, e ele é o mesmo do `useVenceu`, que já é invariante escrita: a home chega do cache do service worker com HTML velho, e ler o aparelho durante o render quebraria a hidratação exatamente no elemento que carrega a decisão. Foi assim que o carimbo já quebrou uma vez.

**O que se vê no celular:** a home abre igual à de hoje (mapa das trilhas, sem você, sem km) e num piscar se reenquadra com você e os km aparecem. **O João viu isso desenhado e disse que não incomoda.** Não há como evitar sem cookie, e o cookie deste app foi morto de propósito.

O mesmo vale pros filtros (§7): primeiro paint sem filtro nenhum.

### 5.3 Como ela é obtida

| Situação | O que a pílula do mapa diz | O toque faz |
|---|---|---|
| `nao-sei`, nunca perguntou | **"Ver daqui"** | pede o GPS ao navegador |
| GPS concedido | **"📍 daqui · trocar"** | abre a busca de cidade |
| Escolhido na mão | **"📍 de Gravatá · trocar"** | abre a busca de cidade |
| GPS negado | **"escolher onde estou"** | abre a busca de cidade |

Negado uma vez, **o app não pede de novo nunca** — o navegador também não perguntaria. Não há mensagem de erro nem pedido de desculpa: a pílula simplesmente vira o caminho manual.

Concedido uma vez, toda abertura seguinte busca a posição **sem prompt** (o navegador já não pergunta). Prazo de 10s e `maximumAge` de 5min, como o `DistanciaDaqui` já faz. Estourou o prazo com uma posição guardada em mãos → **usa a guardada**; sem nenhuma → `nao-sei`.

### 5.4 O `DistanciaDaqui` da ficha

A ficha continua com o botão "A que distância estou?", **mas passa a ler a mesma fonte**: se a home já sabe onde você está, a ficha mostra o km direto, sem botão. Não fazer isso deixaria duas verdades sobre a mesma pergunta em duas telas do mesmo app.

## 6. O mapa

### 6.1 Enquadrar com você junto

`enquadrar()` passa a receber a coordenada da pessoa junto das trilhas. É uma coordenada a mais no array; a conta e o teste já existem.

Sem localização, o mapa é **exatamente o de hoje** — nada muda no caminho que já está no ar e aprovado.

### 6.2 O piso de legibilidade

Se pra caber tudo o zoom tiver que cair abaixo de **`ZOOM_MINIMO_HOME_COM_VOCE = 8`**, o mapa **para de afastar**, centra em você no zoom 8, e escreve no canto **"2 trilhas fora do mapa"**.

**O piso só existe quando você está no enquadramento.** Sem localização o mapa é o de hoje, com o `ZOOM_MINIMO = 2` que já está no ar — esta rodada não mexe no comportamento já aprovado.

Derivação do 8, pra ele ser discutível em vez de mágico: em `metrosPorPixel(−8°, 8)` dá ~605 m/px; na janela visível de 350,5px isso é **~212 km de largura**. Abaixo disso o mosaico do OSM vira mancha sem nome de cidade, e um mapa que não orienta é pior que nenhum.

**Este número é um julgamento meu, não uma medida.** Ele decide o que o João vê, e é o primeiro candidato a mudar depois do iPhone. Vai no código com esta derivação escrita e com teste — pelas lições da rodada passada, um número mandado pro implementador sem derivação vira duas conferências que compartilham a mesma suposição.

A contagem de "quantas ficaram fora" é uma função pura sobre `posicaoNaCaixa`: está fora quem cai além da janela visível (`MAPA_JANELA_VISIVEL_HOME_PX` × `MAPA_ALTURA_HOME_PX`) descontada a margem do alvo de toque. Pura porque precisa de teste — o texto "2 trilhas fora" mentindo é pior que não existir.

### 6.3 O que isso obriga no componente

`MapaHome` vira **client component**. Não pode continuar server component recebendo o resultado pronto: `children` de server component não re-renderiza, e foi exatamente assim que "a decisão foi pro cliente e a cor ficou no servidor" virou Critical em duas rodadas seguidas. Como a conta do enquadramento é pura e determinística, o primeiro render do cliente (com `nao-sei`) é idêntico ao do servidor — a hidratação casa, e o mosaico continua chegando **no primeiro paint sem JS**.

O `Map` de leituras vira objeto simples na travessia do limite servidor→cliente, como o `HomeViva` já faz.

## 7. Os filtros

### 7.1 A linha e o painel

Abaixo do mapa, uma linha: **`4 trilhas · 2 filtros ligados`** à esquerda, **`FILTRAR ▾`** à direita. O toque desce o painel empurrando a lista; o toque de novo o recolhe. Sem filtro ligado, a linha diz só a contagem.

**A contagem é das trilhas que estão APARECENDO**, não do acervo: é ela que responde "por que sumiu tanta coisa?" quando um filtro está ligado. Sem filtro nenhum, as duas contas coincidem.

Estado guardado no aparelho (`localStorage`, chave `bp.filtros`), aplicado **depois do primeiro paint** (§5.2).

### 7.2 Os recortes

| Recorte | Opções | Dado |
|---|---|---|
| Distância | até 30 km · até 60 km · qualquer | linha reta, do §5 |
| Dá hoje | ligado/desligado | o carimbo que a home já tem |
| Custo | só grátis · tanto faz | `custo.tag`, já existe |
| Esforço | leve · média · puxada | **campo novo** |
| Duração | até 2h (120min) · até meio dia (240min) · qualquer | **campo novo** |

**O recorte de distância só aparece na tela quando há localização.** Filtro que não tem como filtrar não entra.

### 7.3 As duas regras de honestidade

Decididas no brainstorm, e elas são a razão de este parágrafo existir:

1. **"Dá hoje" esconde só o que o motor MEDIU como não-vai.** Trilha **sem leitura** continua na lista com o `SEM INFORMAÇÕES`. Esconder o que não se sabe é o app fingindo que sabe, e contradiz a postura cravada pelo João: sem leitura ele **informa**, não manda.
2. **Ficha sem esforço/duração preenchidos nunca é escondida por esses filtros.** Sumir por dado que falta é mentira silenciosa.

### 7.4 Quando o filtro zera

Lista vazia → **"Nenhuma trilha com esses filtros"** e um toque pra limpar. Nunca uma folha em branco.

### 7.5 O cruzamento com o agrupamento (o ponto de risco)

O agrupamento "Hoje o tempo deixa" / "Hoje não" tem regra própria e fechada: **some inteiro se qualquer trilha estiver sem leitura confiável**, e a folha vira lista. Isso não muda.

O que se acrescenta: **se o filtro esvazia um grupo, o cabeçalho daquele grupo some junto.** Cabeçalho em cima de nada é primo direto do Critical da rodada passada ("Hoje o tempo deixa" acima de um "Não suba").

Filtro e agrupamento são calculados **na mesma passada, no mesmo componente**, a partir da mesma leitura. Não podem ser duas etapas em dois lugares — foi um defeito de junção entre duas tasks certas que produziu aquele Critical.

## 8. O cartão

Ganha uma linha de metadados abaixo da promessa:

```
~41 km em linha reta · ~1h30 · leve · R$5
```

Mostra **só o que existe**: sem localização não há km; ficha sem esforço não mostra esforço. Nada inventado, nada com traço no lugar.

**"em linha reta" não é droppável.** Está escrito no `geo.ts` por quê: no agreste, 40 km em reta podem ser 1h30 de serra, e sem o rótulo o número mente pra baixo. Entra um `formatarDistanciaCurta` que solta só o "daqui" (a pílula do mapa já diz de onde) e mantém o "em linha reta".

## 9. Os campos novos e o questionário

`esforco` e `duracao` entram no `fichaSchema` como **opcionais**, porque a Rampa não os tem e **eu não invento fato de roteiro**.

- `esforco`: `"leve" | "media" | "puxada"`
- `duracao`: minutos (número), pra o filtro comparar sem interpretar texto. O cartão formata.

**Duas perguntas novas no `docs/questionario-ficha.md`**, na linguagem dele, entregues **antes** de o João sentar pra responder — depois sairia caro, ele responderia duas vezes.

**Pedido direto ao João, e ele não bloqueia nada:** esforço e duração da Rampa do Pepe. Enquanto não vierem, a Rampa fica sem essa linha no cartão e nunca é escondida por esses dois filtros.

## 10. A busca de cidade

Rota nossa: **`GET /api/lugares?q=`** → `[{ nome, regiao, pais, lat, lng }]`. O celular não fala direto com o serviço — mesma disciplina das outras chamadas, e é o que deixa testar sem internet.

Fonte: **serviço de geocoding da Open-Meteo** (`geocoding-api.open-meteo.com/v1/search`), a mesma casa de onde já vem a chuva. Sem chave, sem cadastro. **Conferido ao vivo nesta sessão**: `Gravatá` devolve `Gravatá · Pernambuco · Brasil` com lat/lng, e junto vêm `Gravatal/SC` e um `Novo Cruzeiro/MG` — **por isso a lista mostra a região**, senão o dedo acerta o lugar errado.

- Prazo curto e uma mensagem honesta quando falha ("não consegui buscar agora"), nunca uma lista vazia silenciosa.
- **Sem internet a busca não funciona** — e não precisa: a localização guardada continua valendo, que é o caso real de quem já escolheu uma vez.
- A rota **não entra no cache do service worker**. Resultado de busca guardado é resultado errado depois.
- **A conferir na implementação:** a base do serviço é o GeoNames (CC BY 4.0). Se a licença exigir atribuição visível, ela vai junto da lista — o app já trata atribuição como obrigação, não enfeite (© OpenStreetMap).

## 11. A barra fixa

`position: fixed` no rodapé, somando `env(safe-area-inset-bottom)` como já faz. A folha ganha um respiro embaixo do tamanho da barra, senão o último cartão nasce atrás dela.

Vale nas duas telas de topo (Hoje e Trilhas). **A ficha continua sem barra** — lá a decisão é a tela inteira, e isso é decisão fechada.

O modo standalone (o app instalado, que é como o João usa) não tem barra de endereço que aparece e some, então a barra fixa é estável ali. No Safari com barra de endereço ela conviverá com a barra do navegador — aceito.

## 12. O orçamento da dobra

A regra não-negociável continua: **o primeiro cartão nasce sem rolar.**

| Peça | px |
|---|---|
| `.appbar` | 52 |
| mapa da home | 168 |
| **linha do filtro (nova)** | **36** |
| cabeçalho de grupo | 34 |
| **soma** | **290** |
| teto (`TETO_ANTES_DO_CARTAO_PX`) | 320 |

Cabe com 30px de sobra. `home-layout.ts` ganha a constante da linha nova e **o teste que soma passa a incluí-la** — é ele, não este parágrafo, que impede alguém de crescer a linha sem perceber.

Nota: a forma escolhida (linha + painel) é a que cabe. A faixa de chips permanentes custava 44px e deixaria o cartão colado no teto.

## 13. Invariantes que esta rodada não pode quebrar

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Vale pro mosaico do mapa também.
- **Primeiro render sem localização e sem filtro, sempre.** É a mesma regra do `useVenceu`, agora com duas fontes novas.
- **Uma trilha, uma fonte** — cartão, selo, pin, cabeçalho **e agora o km**. Sexta porta.
- **Uma pessoa, uma fonte** — mapa, cartão e filtro leem a mesma localização.
- **Sem leitura o app INFORMA, não manda.** O filtro "dá hoje" não pode virar um jeito de sumir com o que não se sabe.
- `avaliar` (`motor.ts`) segue sendo o único lugar que decide se dá pra subir.
- **Sem `next/link`**; âncora pura. **© OpenStreetMap em todo mapa.**
- **Não inventar geografia.** Nome de cidade só quando o serviço devolveu; esforço e duração só quando o João disse.

## 14. O que precisa ser provado (e como)

As lições das rodadas anteriores viram exigências:

1. **Teste de mutação em tudo que for número ou regra.** Esta suíte já produziu oito testes que passavam com o código apagado. Apaga a linha, vê falhar, devolve, cola a saída.
2. **Teste no ponto de uso.** O piso do zoom e a contagem de "fora do mapa" se provam contra o `MapaHome`, não contra o `mapa.ts` de nome parecido — foi exatamente esse engano que deixou o conserto do mapa passar com zero proteção.
3. **Geometria se mede em navegador.** A barra fixa não cobrindo o último cartão e o painel empurrando a lista **não são mensuráveis em jsdom**. Ou se mede no navegador, ou se declara não medido.
4. **O questionário se prova respondendo.** Ele ganha duas perguntas; alguém precisa **responder as duas** e rodar o JSON resultante contra o schema. Os dois defeitos do questionário original só apareceram assim.
5. **Casos que exigem duas trilhas** (piso do zoom, "N fora do mapa", filtro esvaziando grupo) se provam com fixtures — não podem esperar a segunda ficha.
6. **Revisão da branch inteira no fim, sem exceção.** Em três rodadas seguidas ela achou defeito que nenhuma revisão de task pegou. Esta rodada tem duas junções do mesmo tipo que produziu o último Critical: filtro × agrupamento, e localização × enquadramento.

## 15. O que só o iPhone decide

Herdado e ainda em aberto da rodada passada — **a home nova nunca foi vista em WebKit**:

1. `MAPA_JANELA_VISIVEL_HOME_PX = 350,5` foi medida em Chrome emulado. **Os pins estão dentro do mapa, com folga?**
2. A barra fixa e a faixa de gesto: os rótulos estão tocáveis?
3. O painel de filtros aberto empurra a lista pra onde se espera, sem pular?
4. O piso de zoom 8 produz um mapa que orienta ou uma mancha?

## 16. Tamanho

Rodada cheia, na casa de 10 a 12 tasks — comparável à da home. Método: SDD com subagentes, revisão por task exigindo dois veredictos, revisão da branch inteira no fim. **Os agentes dependem de autorização do João nesta sessão.**
