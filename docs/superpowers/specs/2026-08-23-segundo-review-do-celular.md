# Spec — o segundo review do celular: a distância sem teto, a cidade que vence, e a extensão que sai

> Rodada nascida do **segundo review do João no iPhone**, em 2026-08-23 — o primeiro virou a
> rodada `review-do-celular`, mergeada em `5bfe76e` e no ar. Três pedidos dele, mais um dado real
> que ele entregou no meio da triagem.

## 1. O problema (as palavras dele)

1. *"o mapa em hoje, não tem opção de pedir para pegar a localização depois de escolher uma
   cidade, acho que seria válido, inclusive reparei que a cidade não está mudando toda vez que
   abre o app, que seria algo importante"*
2. *"remova o filtro tamanho da trilha, acho que não está para hoje"*
3. *"o filtro 'Distância daqui' deveria ser para qualquer distância, não faz sentido limitar no
   bate perna"*
4. *"a rampa do pepê é barro, então não entra no filtro"* — dito depois, e é **dado**, não pedido.

## 2. O que a triagem descobriu antes de virar campo

**O item 1 são DUAS coisas, e a segunda colide com uma decisão dele de 2026-08-21.**

A primeira metade é a pendência que a revisão da branch passada já tinha achado e deixado pra ele
(`§P-3` do RESUME): conferido no código, com uma cidade escolhida o toque na pílula abre a busca
de cidade (`BuscaLugar.tsx:32` faz `soGps` virar `false`), e **`pedirGps` não tem nenhum outro
chamador no repo**. Não existe caminho de volta pro GPS. Isso entra sem discussão.

A segunda metade — *"a cidade não está mudando toda vez que abre o app"* — **é** o comportamento
que ele cravou em 2026-08-21 sob o nome `a escolha à mão vence` (`local.tsx:116`,
`if (guardado.tipo !== "escolhido") buscarGps()`). Ele viu no celular e mudou de ideia. O fato que
tornou a conversa não-trivial: **este app não usa `next/link`**, então todo toque em cartão é
navegação completa e remonta o `<LocalVivo>` — "o GPS ganha a cada abertura" e "a cidade some
quando eu toco num cartão" seriam a mesma linha de código.

**O item 3 tem um fato contra-intuitivo que mudou a saída.** O teto de 100 km **não esconde nada
hoje**: o fim da barra já é uma parada extra que vale `null`. O que o teto impede é escolher um
corte *entre* 100 km e o infinito. Levado isso à mesa, ele escolheu tirar o teto — mas exigiu
*"algo simples e intuitivo"*, o que derrubou a saída óbvia (escala não-linear).

## 3. As decisões dele nesta conversa (não reabrir)

| Tema | Decisão |
|---|---|
| Voltar pro GPS | Entra um **"de onde eu estou"** no painel de busca. |
| Validade da escolha à mão | **Aba viva E no máximo 6h** — os dois, ele escolheu explicitamente o cinto-e-suspensório. |
| Tamanho da trilha | **O campo inteiro sai**: filtro, cartão, ficha, schema e questionário. |
| Teto da distância | **Vem do acervo**, não de um número inventado. |
| `piso` da Rampa | **`barro`, gravado agora.** |
| Filtro de piso | **Fica**, mesmo esvaziando a home com uma ficha só. |

Decisões minhas, de rotina, que ele pode vetar em uma palavra:

- **A cidade não pisca.** Vencida a escolha, o que está na tela continua na tela até o GPS
  responder; se ele falhar ou estiver negado, a cidade fica. Precedente já no ar, escrito em
  `local.tsx:79-81`: *"A localização que já existia NÃO é apagada"*.
- **O "de onde eu estou" some quando o GPS já foi negado.** Regra da casa: botão que não faz nada
  é pior que botão nenhum (é o mesmo argumento do `rotuloPilula`).
- **O piso de 30 km no teto da barra**, pra ela não degenerar em duas paradas num acervo todo
  perto.

## 4. Fora de escopo (explicitamente)

- **O `piso` não alimenta o motor.** Continua descritivo e filtrável. `avaliar()` segue sendo o
  único que decide se dá pra ir — invariante mais velha do app, e agora com uma ficha real de
  barro ela fica mais tentadora de quebrar, não menos.
- **Nada de distância por estrada.** Continua em linha reta, com o rótulo dizendo isso.
- **A 2ª ficha.** Continua pendente dele. Esta rodada só *reduz* o questionário.
- **O deferido do `contarLigados`** (conta a distância mesmo com o grupo escondido por falta de
  localização) fica onde está.
- **Nada de camada flutuante.** O painel de busca continua o que é.

---

## 5. A distância sem teto inventado

### 5.1 De onde o teto passa a vir

`DIST_MAX_KM = 100` **morre**. No lugar dele, uma função pura em `src/lib/filtros.ts`:

```ts
export const DIST_PASSO_KM = 5;          // fica
export const DIST_TETO_MINIMO_KM = 30;   // novo — o piso do teto, não o teto

export function tetoDaBarraDistancia(
  fichas: Ficha[], voce: Coord | null, valorAtual: number | null,
): number
```

O resultado é o **maior** entre três candidatos, arredondado **pra cima no passo**:

1. `DIST_TETO_MINIMO_KM`;
2. `valorAtual ?? 0`;
3. a trilha mais longe do acervo — `kmNaTelaDistancia(distanciaKm(voce, coordDaDistancia(f)))`
   pra cada ficha, com `null` (abaixo de 1 km) valendo 0. Sem `voce`, a lista não entra.

**O candidato 2 é o que impede a tela de mentir**, e não é hipótese: com `distanciaKm: 500`
guardado e a trilha mais longe a 27 km, um teto de 30 poria o pegador na parada "qualquer"
enquanto a leitura ao lado diz *"até 500 km"* — o elemento `range` prende sozinho o valor acima do
`max`. A barra **estica pra conter o pegador**.

**O candidato 3 usa `kmNaTelaDistancia`, não o km cru**, e isso é `o filtro segue a tela` aplicado
ao teto: a barra tem que oferecer uma parada capaz de alcançar o número que o cartão anuncia. Com
o km cru, uma trilha a 30,4 km (cartão: `~30 km`) empurraria o teto pra 35 e sobraria uma parada
que não esconde ninguém.

⚠️ **O candidato 2 resolve o valor ACIMA do teto, não o valor FORA do passo.** Um corte de 7 km
com passo 5 continua pondo o pegador na parada de 5 enquanto o campo diz `7` e a leitura diz
*"até 7 km"* — é o custo já aceito e registrado na rodada passada (só o controle grosso discorda;
os dois portadores de texto dizem a verdade), e esta rodada **não** o reabre.

### 5.2 Onde a conta mora, e por que não no painel

O `MioloHome` já tem as três entradas no mesmo escopo — `pares`, `voce` e `filtros`. **A chamada
acontece lá, uma vez**, e o `PainelFiltros` recebe `tetoDistanciaKm: number` pronto. O painel
continua sem fazer conta de km, que é o que a asserção de fonte dele protege hoje.

🔴 **O teto sai de `pares`, NUNCA de `visiveis`.** Com `visiveis`, ligar "até 10 km" esconderia a
trilha mais longe, o teto encolheria pra 30, e a barra se reescreveria embaixo do dedo — e o
caminho de volta pra 50 km deixaria de existir na tela. É circular pelo mesmo motivo pelo qual o
`confia` já sai de `pares` naquele arquivo, e o comentário de lá deve ganhar a segunda razão.

### 5.3 `lerFiltros` sem teto

Sem teto não existe valor "grande demais": um `distanciaKm` absurdo guardado produz um filtro
**inerte**, não um filtro que esconde. Então a validação da distância vira **inteiro ≥ 1** e ponto.

Como a extensão sai na mesma rodada (§7), `kmGuardado` fica com **um chamador só** e perde o
parâmetro `max`. O comentário dele — que hoje justifica o parâmetro dizendo *"um só pros dois
recortes de propósito"* — vira mentira no mesmo instante e tem que ser reescrito.

### 5.4 O custo aceito

Quando a pessoa arrasta até a parada "qualquer", o valor vira `null`, o candidato 2 sai da conta e
**a barra encolhe de volta pro teto do acervo**. O pegador termina no fim de uma barra mais curta.
É honesto (nada está escondido, e a leitura diz "qualquer"), mas é um salto visível. As
alternativas são piores: manter o teto esticado guardaria em memória um número que a pessoa acabou
de desligar.

---

## 6. A localização: a escolha que vence, e o caminho de volta

### 6.1 Uma pergunta pura, em `src/lib/local.ts`

```ts
export const VALIDADE_ESCOLHA_S = 6 * 60 * 60;
export const CHAVE_SESSAO = "bp.sessao";

export function escolhaAindaVale(
  local: Local, agoraSeg: number, marcadorDaSessao: string | null,
): boolean
```

Verdadeira **só** se as três valerem: `local.tipo === "escolhido"`, **e** o marcador está presente,
**e** `agoraSeg - local.em < VALIDADE_ESCOLHA_S`. O `em` já existe no dado guardado e já é validado
como número finito pelo `lerLocal` — não há campo novo no `localStorage`.

O arquivo continua puro: sem React, sem `navigator`, sem `localStorage`. Quem lê o aparelho é o
`local.tsx`, e é ele quem passa `Date.now()` e o `sessionStorage.getItem`.

### 6.2 O que muda no `local.tsx`

Uma linha no efeito de montagem:

```
antes:  if (guardado.tipo !== "escolhido") buscarGps();
depois: if (!escolhaAindaVale(guardado, agoraSeg, marcador)) buscarGps();
```

🔴 **A troca preserva os dois ramos que já estão no ar**, e isso não é sorte: pra `tipo: "gps"` e
pra `nao-sei` a função é falsa pela primeira cláusula, então o GPS continua sendo pedido sozinho na
abertura, exatamente como a Task 1 da rodada passada entregou.

E o marcador é escrito no `escolher`, **guardado por `l.tipo === "escolhido"`** — o `escolher`
também é o caminho de sucesso do GPS, e marcar sessão ali faria uma leitura de GPS se disfarçar de
escolha manual. Gravação em `try/catch`, como todas as outras deste arquivo (aba anônima não é
motivo pra tela de erro).

### 6.3 O que a pessoa vê

| Momento | Tela |
|---|---|
| Escolheu Gravatá às 14h | `de Gravatá · trocar` |
| Tocou num cartão e voltou, 14h05 | `de Gravatá · trocar` — a navegação remonta o provedor, e o marcador sobrevive |
| Reabriu às 17h, mesma aba | `de Gravatá · trocar` — dentro das 6h |
| Reabriu às 21h | pede GPS; vira `daqui · trocar` quando ele responde |
| Fechou o Safari e reabriu às 14h30 | pede GPS — o marcador morreu com a aba |
| Escolha vencida **e** GPS negado | `de Gravatá · trocar` — a cidade **fica** |

**Nada pisca em nenhuma linha dessa tabela:** o `setLocal(guardado)` continua acontecendo antes do
pedido de GPS, e só o sucesso do GPS sobrescreve.

⚠️ **O buraco conhecido, e ele é do relógio, não do desenho:** com o relógio do aparelho atrasado,
`agoraSeg - em` fica negativo e a escolha continua valendo. Não vale código: a saída é a pessoa
tocar em "trocar", que é a mesma de sempre.

### 6.4 O "de onde eu estou"

Primeiro elemento do painel de busca, **fora do `.busca-rolo`** — entre o campo e a caixa que rola,
pelo mesmo motivo medido que pôs o crédito do GeoNames fora dela: o que está dentro do rolo some
de vista assim que a lista de cidades cresce, e este é o item que precisa estar sempre alcançável.

Aparece quando `gps !== "negado"`. Toque: chama `pedirGps()` e fecha o painel, igual ao que
escolher uma cidade já faz.

🔴 **Isto conserta um beco que JÁ ESTÁ EM PRODUÇÃO** — não é dívida desta rodada nem da passada.
Hoje, no app instalado no celular dele, quem escolhe uma cidade fica sem caminho de volta.

---

## 7. O tamanho da trilha sai inteiro

`extensaoKm` deixa de existir. **A ordem é obrigatória — consumidores primeiro, schema por
último** —; apagar o campo antes deixa o `tsc` vermelho no meio da rodada. É a contração da rodada
passada de novo, e ela já foi ensaiada com sucesso na Task 8.

O inventário, conferido no repo (não deduzido):

| Onde | O que sai |
|---|---|
| `src/app/PainelFiltros.tsx` | o `<FaixaKm rotulo="Tamanho da trilha">` e os imports `EXT_*` |
| `src/app/CartaoTrilha.tsx:55` | a linha do cartão |
| `src/app/[slug]/page.tsx:52` | o item de `fatosDaVia` |
| `src/lib/filtros.ts` | `extensaoMaxKm` do tipo, do `SEM_FILTRO`, do `contarLigados`, do `lerFiltros` e o bloco do `passaNoFiltro`; `EXT_MAX_KM`, `EXT_PASSO_KM` |
| `src/lib/geo.ts` | `kmNaTelaExtensao` e `formatarExtensao` |
| `src/types/ficha.ts:61` | o campo do schema — **por último** |
| `docs/questionario-ficha.md` | a pergunta da extensão |

### 7.1 O filtro fantasma, de novo — e agora há precedente

O celular dele tem `extensaoMaxKm` **gravado de verdade** (ele usou o recorte). Se o `lerFiltros`
continuar lendo o campo, a linha de resumo dirá *"1 filtro ligado"* sem chip pra desligar — o
defeito que ele mesmo reclamou e que a Task 8 fechou pro `esforco`/`duracaoMax`.

Fecha por construção (o objeto de saída é montado campo a campo, nunca espalhado do que veio), e a
prova é a mesma de lá: **`contarLigados(lerFiltros(<json com extensaoMaxKm>)) === 0`**.

### 7.2 Os comentários que viram mentira no mesmo instante

Esta é a família que já custou três achados na rodada passada; desta vez ela está mapeada **antes**,
e todos caem no balde (a) da Task 8 — *afirma um consumidor desfeito → corrigir a oração agora*:

- **`CartaoTrilha.tsx:53-54`** fala dos *"DOIS números em km desta linha"* pra justificar o sufixo
  "de trilha". Com um número só, a frase é falsa **e** a justificativa some.
- **`filtros.ts:205-208`** afirma *"os DOIS campos opcionais que sobraram (`extensaoKm` e `piso`):
  a única ficha real não tem nenhum dos dois"*. Depois desta rodada **as duas metades** são falsas
  — o campo não existe e a Rampa tem `piso`.
- **`piso.ts:3`** manda ver `formatarExtensao` em `geo.ts`, função que deixa de existir.
- **`geo.ts:42-44`**, na documentação de `kmNaTelaDistancia`: *"Ela e a irmã `kmNaTelaExtensao` NÃO
  arredondam igual"* — a irmã some, e some junto a razão de aquela função ter um nome tão
  específico.
- **`contarLigados`**, cujo comentário crava **"CINCO"** e passa a valer quatro.
- **`kmGuardado`**, que se justifica dizendo *"um só pros dois recortes de propósito"* (§5.3).

🔴 A busca que os encontra usa **termos copiados do diff** e `-i` — não digitados de memória. Foi
assim que a Task 8 falhou uma vez: `duracao` não acha `formatarDuracao`.

### 7.3 O que sobra mais magro

O `FaixaKm` fica com **um consumidor**. Ele continua genérico (não conhece as constantes), mas o
teste que provava *"as duas faixas leem limites diferentes"* perde o par e tem que ser reescrito
pro que ainda tem dono: que o painel não escreve km à mão.

---

## 8. `piso: "barro"` na Rampa

Uma linha em `content/fichas/rampa-do-pepe.json`. **É dado do João**, e a ficha real o sustenta em
três lugares independentes — `"Mas é barro: molhou, não vá"`, `"o barro segura água"`,
`"barro brilhando/pegajoso = não vá"`. Nada inventado, que é a regra que esta rodada herda de um
Critical passado.

**Três consequências, todas desejadas:**

1. O cartão da home e o bloco 📍 Trajeto da ficha passam a mostrar **"barro"**. É a primeira vez
   que o campo criado na rodada passada aparece na tela dele.
2. O filtro de piso **deixa de ser inerte**. Hoje ele não esconde nada (Regra de Honestidade 2 —
   ficha sem o campo nunca some). A partir daqui, **qualquer chip esvazia a home**, e a tela
   explica: *"Nenhuma trilha com esses filtros"* + `limpar filtros`.
3. **A Regra de Honestidade 2 do `piso` perde o exemplo real.** Ela continua valendo e continua
   provada — mas só por fixture. O teste que a prova **não pode** passar a carregar a Rampa pelo
   loader; ele precisa de uma ficha sem `piso`.

⚠️ E a recíproca: o teste *"a Rampa REAL"* — o que carrega o JSON **pelo loader**, não um fixture
parecido, porque é ele que fala de produção — hoje afirma que o cartão **não** inventa piso. Essa
asserção **inverte de sentido** e passa a exigir "barro" na tela.

---

## 9. Invariantes que esta rodada não pode quebrar

1. **Primeiro render sem localização e sem filtro, SEMPRE.** Tudo do §6 acontece em efeito, nunca
   durante o render — a home chega do cache do service worker com HTML velho.
2. **Uma pessoa, uma fonte.** Nada de um segundo `navigator.geolocation` fora do `LocalVivo`.
3. **Um array só, num escopo léxico só** no `MioloHome` — o teto novo não pode virar uma segunda
   passada sobre outra lista.
4. **O filtro segue a tela.** `kmNaTelaDistancia` continua sendo a fonte do número comparado, e
   agora também do teto.
5. **Regra de Honestidade 1 e 2** intactas.
6. **Teto inclusivo:** "até 30 km" inclui a trilha de 30.
7. **O `piso` não alimenta o motor.**

## 10. O que precisa ser provado, e como

Sub-cláusula a sub-cláusula, no molde que a rodada passada consolidou. Os casos que **separam** as
versões, não os que ambas rejeitam:

**Teto da distância**
- teto = acervo, com a trilha mais longe **arredondada pra cima no passo** (uma ficha a 27 → 30);
- teto = `DIST_TETO_MINIMO_KM` quando tudo é perto (mata o candidato 1);
- teto **estica** pro valor atual acima do acervo (mata o candidato 2 — e o caso tem que ser um
  valor que a barra do acervo não alcançaria);
- teto sai de `pares`, não de `visiveis`: com um filtro que esconde a trilha mais longe, o teto
  **não** encolhe. É teste de **junção**, e é o único capaz de pegar a troca de uma palavra;
- o número comparado é o da tela: uma trilha a 30,4 km não empurra o teto pra 35.

**`lerFiltros`**
- inteiro grande é aceito (não há mais teto) — o caso que separa a versão nova da velha;
- `0` e fracionário continuam virando `null`;
- `contarLigados(lerFiltros(<json com extensaoMaxKm e esforco>)) === 0`.

**A escolha e a sessão** — as três cláusulas medidas **separadas**, porque num E a primeira esconde
as outras:
- escolha fresca **com** marcador → **não** pede GPS (e a prova é que `getCurrentPosition` **não é
  chamado**: o guarda impede o pedido, não só a gravação);
- escolha fresca **sem** marcador → pede;
- escolha de 7h **com** marcador → pede;
- `tipo: "gps"` guardado → pede (o ramo que já está no ar não pode ter mudado);
- vencida + GPS responde → a cidade é substituída;
- vencida + GPS erra → **a cidade fica na tela**;
- o marcador **não** é escrito quando o `escolher` recebe `tipo: "gps"`.

**O "de onde eu estou"**
- existe no painel com `gps !== "negado"`, some com `"negado"`;
- o toque chama `pedirGps` **e** fecha o painel;
- está **fora** do `.busca-rolo` — asserção posicional escopada pela mesma cadeia que o CSS usa,
  não por um ancestral qualquer (lição do DOM que escorrega de baixo do próprio seletor).

**A contração**
- nenhum `EXT_`, `extensaoMaxKm`, `extensaoKm`, `formatarExtensao` ou `kmNaTelaExtensao` sobra em
  `src/`, com termos **copiados do diff** e busca `-i`, classificando em três baldes (afirma
  consumidor desfeito / história / código);
- 🔴 **quem prova o quê, e a repartição é declarada, não suposta.** Ao contrário da Task 8, aqui
  não há módulo apagado nem re-export: `geo.ts` continua existindo e só perde duas funções. Uma
  função exportada que sobrasse sem chamador **não tem dono** — não renderiza, não computa, não
  entra no bundle, e o `tsc` fica limpo. Quem a pega é a varredura acima, e isso vale escrito.
  Já `extensaoKm` de volta ao schema, ou `extensaoMaxKm` de volta ao `Filtros`, **têm** dono no
  vitest, e cada ressurreição precisa ser medida uma a uma;
- e o `npm run build`, porque **o vitest não vê o bundle** — é ele que prova que a contração
  chegou aos chunks, do jeito que o `curl` conferiu em produção na rodada passada.

**A Rampa**
- carregada **pelo loader**: o cartão mostra "barro" e a ficha mostra "barro" no Trajeto;
- um chip de piso esvazia a home e desenha `limpar filtros`;
- Honestidade 2 do `piso` provada por **fixture sem o campo**, não pela Rampa.

## 11. O que só o iPhone decide

- A barra com teto **dinâmico**: quando o teto muda (o dedo solta em "qualquer" e a barra encolhe),
  o pegador salta de um jeito que assusta?
- O item "de onde eu estou" no painel de busca — alvo de toque e distância do campo de digitação,
  que abre teclado.
- O cartão com **"barro"** junto do `~27 km em linha reta · R$ 5`: cabe na linha a ~360px?
- E as pendências que **continuam abertas do review anterior** e nunca foram vistas em WebKit.

## 12. Tamanho

Menor que a rodada passada, e na mesma ordem **expandir → migrar → contrair**, pelo mesmo motivo:
a contração do §7 tem consumidores em cinco arquivos, e apagá-los cedo deixa o `tsc` vermelho no
meio. O `piso: "barro"` (§8) vai **depois** da contração, porque é ele que muda o sentido de
testes que a contração ainda vai tocar. O número exato de tasks é do plano, não desta spec.
