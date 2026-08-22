# Spec — o review do celular: GPS sozinho, faixa de distância, e o piso do caminho

> Rodada nascida do **review do João depois de usar o app no iPhone**. Não é continuação de
> plano nenhum: são quatro pedidos dele, ditos em 2026-08-18, triados aqui.

## 1. O problema (as palavras dele)

1. *"a parte do mapa, eu pensei que ele já ia abrir pegando sua localização, só modificaria se o
   usuário quiser"*
2. *"acho o filtro duração deveria ser distância — cada navegador tem seu ritmo"*
3. *"com a chegada do esforço, isso deve ser inserido dentro das trilhas"*
4. *"o filtro quando selecionado não é possível deselecionar"* → **retirado por ele mesmo**, e
   substituído: *"é melhor o usuário conseguir digitar ou mover uma barra para ir escolhendo o
   raio de distância"*
5. *"esforço podia ser — barro, paralelepípedo, asfalto esburacado, asfalto tapete"*

## 2. A descoberta que reorganizou a rodada

O item 5 parecia vocabulário errado até a ficha real ser lida:

```
"acesso":      "Dá pra ir de carro comum — mas só quando não estiver chovendo.
                Molhado, o risco é atolar."
"regra_texto": "...não SUBA DE CARRO COMUM; o barro segura água."
```

**A Rampa do Pepê é um rolê de carro.** A "subida da serra pela mata" é estrada. A lista dele não
é vocabulário de perna: **é o piso da via**, e é o que decide se o carro chega.

Isso derruba o campo `esforco` (`leve | media | puxada`) por uma razão de produto, não de gosto:
**"leve/média/puxada" é sobre o corpo de quem vai; "barro/asfalto" é sobre o lugar.** Este app só
sabe falar de lugar — a ficha inteira é feita disso, e o único fato que ele mede (a chuva) é fato
de lugar. Um campo sobre o preparo de quem lê nunca teve de onde sair.

E fecha com o coração do app: **"barro" é exatamente o que o carimbo mede.** Ficha de barro é
ficha que depende da chuva; ficha de asfalto tapete pouco liga. O app passa a dizer **por que**
aquela trilha depende do tempo.

## 3. Fora de escopo (explicitamente)

- **O piso NÃO alimenta o motor.** `avaliar()` (`src/lib/motor.ts`) continua sendo o único lugar
  que decide se dá pra ir. O piso é descritivo e filtrável; barro *medido* segue sendo assunto
  exclusivo da regra de chuva. Quebrar isso é quebrar a invariante mais velha do app.
- **Nada de tempo de estrada real.** A distância daqui continua em linha reta, com o rótulo.
- **A segunda ficha.** Continua pendente do João; esta rodada só muda as perguntas.
- **O deferido do `contarLigados`** (conta distância mesmo com o grupo escondido por falta de
  localização) fica onde está.

## 4. As decisões dele nesta conversa (não reabrir)

| Tema | Decisão |
|---|---|
| GPS na 1ª abertura | **Pede sozinho.** Reafirmado depois de eu apresentar o custo. |
| Duração | **Some inteira** — do schema, do cartão, do filtro e do questionário. |
| Tamanho da trilha | Em km, **só ida**. |
| Recorte numérico | **Barra que arrasta + campo que digita**, não chips. |
| Esforço | Vira **piso da via**: `barro · paralelepípedo · asfalto esburacado · asfalto tapete` |
| Semântica do piso | **O pior trecho do caminho.** |
| Ordem | A que ele passou, do pior pro melhor. `asfalto duplicado` **cortado por ele**. |
| Onde na ficha | **Junto ao Trajeto.** |

Decisões minhas, de rotina, que ele pode vetar em uma palavra:

- **A frase livre do "chão" não existe.** A ficha já tem `acesso`, que na Rampa diz exatamente
  isso em prosa. Duas fontes pra mesma coisa é a família de defeito que já custou Criticals aqui.
- **O chip `barro` não aparece no filtro** (segue valendo como valor de ficha). Com a escala lida
  como *"no mínimo daqui pra cima"*, `barro` é o piso da escala: ligá-lo não esconderia nada —
  filtro aceso que não filtra, que é o problema que esta rodada existe pra matar.
- **Tetos das faixas: 100 km** (distância daqui) e **20 km** (tamanho da trilha).

## 5. O GPS na primeira abertura

### 5.1 O que muda

`src/app/local.tsx:98` hoje: `if (guardado.tipo === "gps") buscarGps();` — só busca quem **já**
concedeu. Passa a buscar sempre, na montagem.

**A invariante do primeiro render não é tocada:** `useState(NAO_SEI)` continua, o pedido acontece
no `useEffect`, depois da tela pintada. O HTML do servidor e o primeiro quadro do cliente
continuam idênticos.

### 5.2 O risco novo, e o remédio (isto é obrigatório, não enfeite)

Hoje qualquer falha do `getCurrentPosition` grava `bp.gps = "negado"` **pra sempre**, e a pílula
nunca mais oferece "Ver daqui". Isso era aceitável quando a falha só podia vir de um toque
deliberado. **Com o pedido automático, deixa de ser:** quem descarta o balão do iOS sem decidir,
ou está num prédio sem sinal, seria rebaixado permanentemente na primeira abertura.

**Regra nova:** só grava `"negado"` quando o navegador disser `PERMISSION_DENIED`
(`GeolocationPositionError.code === 1`). `POSITION_UNAVAILABLE` (2) e `TIMEOUT` (3) **não são
permanentes** — o app segue sem localização e tenta de novo na próxima abertura.

### 5.3 O comentário que vira mentira

`src/app/DistanciaDaqui.tsx:7-9` afirma: *"A distância fica ATRÁS DE UM TOQUE de propósito:
prompt de GPS não solicitado é o jeito mais rápido de ser negado pra sempre"*. Depois desta
rodada isso é falso — o app passa a fazer exatamente o que a frase diz que evita. **Reescrever, e
registrar a decisão nova e o porquê** (a lição-título da rodada passada: comentário mentiroso é a
única coisa aqui que se propaga sozinha).

## 6. O piso da via

### 6.1 Uma fonte pro vocabulário E pra ordem

Módulo novo **`src/lib/piso.ts`**, puro, sem zod e sem `node:fs` — porque quem o lê inclui client
components (mesma razão que já exilou `formatarDuracao` e `coordDaDistancia`).

```ts
export const PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"] as const;
export type Piso = (typeof PISOS)[number];
```

- **A ordem do array É a escala**, do pior pro melhor. `ordemPiso(p)` é o índice.
- `PISOS_FILTRAVEIS` é **derivado** (`PISOS.slice(1)`), nunca uma segunda lista escrita à mão.
- `rotuloPiso()` devolve o texto de tela (`asfalto esburacado`, com espaço e acento).
- `src/types/ficha.ts` monta o zod **a partir daqui** (`z.enum(PISOS)`) — o vocabulário não pode
  existir em dois lugares.

### 6.2 O recorte

`pisoMinimo: Piso | null`. Passa quem for **igual ou melhor**:

```
ficha.piso && ordemPiso(ficha.piso) < ordemPiso(filtros.pisoMinimo) → esconde
```

**Regra de honestidade 2 continua valendo:** ficha **sem** `piso` nunca é escondida por ele.

Chips (os três de `PISOS_FILTRAVEIS`), já com o padrão que desliga no segundo toque — o mesmo que
o grupo Esforço usa hoje (`PainelFiltros.tsx:61`). A legenda do grupo tem que dizer que é piso
**mínimo**, senão o chip "asfalto tapete" parece dizer "só asfalto tapete".

## 7. O tamanho da trilha

`extensaoKm`, opcional, número positivo, **só ida**. Substitui `duracao` inteira; o módulo
`src/lib/duracao.ts` e o `formatarDuracao` reexportado por `ficha.ts` **são apagados**.

Recorte `extensaoMaxKm`, com **teto inclusivo** — precedente cravado na rodada passada: "até 4 km"
com uma trilha de exatamente 4 passa, porque é como se lê em português.

## 8. A faixa (a barra + o campo)

Componente novo **`FaixaKm`**, usado pelos **dois** recortes numéricos.

### 8.1 Dois controles, um valor

Barra e campo escrevem no **mesmo** estado do contexto de filtros. "Uma pessoa, uma fonte" vale
aqui: dois donos do mesmo número dariam duas respostas pra mesma pergunta.

### 8.2 A última parada é "qualquer", e ela é um estado, não um número

A barra vai de `passo` até `max`, **mais uma parada** depois do fim:

```
5 · 10 · 15 · … · 100 · qualquer          (distância daqui, passo 5, max 100)
1 · 2 · 3 · … · 20 · qualquer             (tamanho da trilha, passo 1, max 20)
```

**A última parada vale `null`** — sem limite nenhum. Isso não é enfeite: se o fim da barra fosse
"100" chamado de "qualquer", uma trilha a 130 km sumiria enquanto a tela dissesse "qualquer
distância". É a família de mentira que este app persegue.

Consequência: **o campo digitado pode ser preso em `[passo, max]` sem buraco de honestidade**,
porque acima do teto existe a parada "qualquer". O campo mostra imediatamente o valor que foi
aplicado — nunca aceita 150 na tela e filtra por 100.

### 8.3 O que o desligar virou

**Não há mais chip aceso que não apaga**: os dois recortes numéricos deixam de ter chip. Os três
grupos que sobram (Hoje, Custo, Piso) **já** desligam no segundo toque hoje — conferido em
`PainelFiltros.tsx:50,55,61`. O pedido original do João morre resolvido por construção.

### 8.4 O que a faixa obriga na mão suja de barro

Esta é a **primeira coisa arrastável do app**, e o app inteiro foi feito ao contrário disso (o
cartão é alvo de toque gigante de propósito). Obrigatório: **faixa de toque com ≥44px de altura**
e pegador grande. O campo digitável é o caminho preciso pra quem não acerta arrastando.

**Isto não é verificável daqui** (nenhum teste desta suíte mede geometria renderizada — lição 5).
Entra na lista do iPhone.

## 9. `lerFiltros` com número livre

`distanciaKm` deixa de ser `30 | 60 | null` e vira `number | null`. A validação do que vem do
`localStorage` deixa de ser "está no conjunto?" e passa a ser um intervalo:

- número finito, **inteiro**, `>= passo`, `<= max` → vale;
- **qualquer outra coisa** (texto, `NaN`, `0`, negativo, acima do teto) → `null`.

Cuidado registrado: `typeof NaN === "number"`, então `Number.isFinite` é o único que o pega — foi
assim que a Task 5 da rodada passada quase entrou furada.

**Filtro guardado da versão velha** (`duracaoMax: 120`, `esforco: "media"`) degrada limpo: as
chaves somem da leitura e os recortes novos nascem `null`. Precisa de teste — é o estado real do
iPhone dele agora.

## 10. O cartão

Hoje: `~27 km em linha reta · 1h30 · média · R$ 5`
Depois: `~27 km em linha reta · 4 km de trilha · barro · R$ 5`

🔴 **O sufixo "de trilha" não é enfeite:** sem ele o cartão mostra **dois números em km** lado a
lado — um "quão longe daqui", outro "quão longa a trilha" — e nada na tela os distingue. É o
mesmo defeito que a rodada passada consertou com `coordDaDistancia` (dois km pra mesma trilha),
com outra roupa.

E o **"em linha reta" continua não-droppável** no primeiro (invariante herdada).

## 11. A ficha

O bloco **📍 Trajeto** ganha, junto da distância daqui, o **piso** e a **extensão**. As quatro
coisas medíveis da trilha passam a viver no mesmo lugar — que é o pedido 3 do João.

Nada de frase nova: a prosa do piso já é o campo `acesso`, logo abaixo.

## 12. Invariantes que esta rodada não pode quebrar

Herdadas, todas ainda valendo:

- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.** O piso não encosta nele.
- **O carimbo chega no primeiro paint, server-rendered, sem JS** (`force-dynamic`).
- **Primeiro render sem localização e sem filtro, SEMPRE.**
- **`useVenceu` devolve `false` no primeiro render, sempre.**
- **Uma trilha, uma fonte** — cartão, selo, pin, cabeçalho, km. Agora também: piso e extensão.
- **Uma pessoa, uma fonte** — ninguém além do `local.tsx` chama `navigator.geolocation`.
- **Um array só, num escopo léxico só** (`MioloHome`): mapa, linha e folha da MESMA lista.
- **Sem leitura o app INFORMA, não manda.**
- **"em linha reta" não é droppável.**
- **Ficha sem o campo nunca é escondida por ele** (regra de honestidade 2).
- **Sem `next/link`; `© OpenStreetMap` em todo mapa.**

Nova desta rodada:

- **O vocabulário do piso e a sua ORDEM existem num lugar só** (`src/lib/piso.ts`), e o zod, os
  chips e o filtro leem de lá. Uma segunda lista escrita à mão é a escala podendo discordar de si
  mesma.

## 13. O que precisa ser provado, e como

| O quê | A prova |
|---|---|
| A escala do piso | "no mínimo asfalto esburacado" esconde barro e paralelepípedo, mostra tapete |
| `barro` fora dos chips | `PISOS_FILTRAVEIS` derivado; teste que ele é `PISOS.slice(1)` |
| Ficha sem piso | nunca escondida, com qualquer chip ligado |
| Teto inclusivo | extensão exatamente igual ao corte **passa**; +1 não passa |
| A última parada | posição além do `max` produz `null`, e `null` não esconde nada |
| Campo digitado | valor fora do intervalo é preso **e mostrado preso** |
| Barra + campo | mexer num muda o outro (um valor só) |
| Filtro velho no storage | `{duracaoMax:120, esforco:"media"}` → sem filtro nenhum, sem estourar |
| GPS automático | monta sem `bp.local` guardado → `getCurrentPosition` chamado |
| Erro 1 vs 2 e 3 | code 1 grava `"negado"`; codes 2 e 3 **não** gravam |
| Dois km no cartão | asserção no texto inteiro, não em `/km/` — senão casa nos dois |
| Ficha mostra piso | render de `[slug]/page.tsx` de verdade, não do componente vizinho |

**Régua da casa, em toda task:** prova de mutação **sub-cláusula a sub-cláusula**; `npm test` +
`npx tsc --noEmit` + **`npm run build`** (lição 9); e "a mutação não mordeu" tem três respostas,
não duas (lição 13).

## 14. O que só o iPhone decide

Some das perguntas antigas a do painel de filtros empurrando a lista (segue valendo) e entram:

1. **A barra dá pra arrastar com o polegar?** É a primeira coisa arrastável do app.
2. **O campo numérico abre o teclado certo** (`inputMode="numeric"`) e não empurra a tela toda?
3. **O balão de GPS na primeira abertura** aparece antes ou depois da home pintar?

## 15. Tamanho

7 tasks + revisão da branch inteira. Toca schema, uma lib nova, dois componentes novos, três
existentes, o questionário e a ficha. Nenhuma migração de conteúdo: a Rampa não tem `esforco` nem
`duracao` hoje.
