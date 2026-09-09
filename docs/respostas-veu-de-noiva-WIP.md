# Respostas da 3ª ficha — Cachoeira Véu de Noiva (Bonito-PE) 🟡 EM ANDAMENTO

> **Sessão iniciada em 2026-09-03.** O João responde o questionário **pela conversa**, não editando
> `docs/questionario-ficha.md` — pedido dele desde a 2ª ficha.
>
> Este arquivo é **procedência**: de onde veio cada campo, o que é palavra dele, o que é redação
> minha aprovada por ele, e o que é padrão meu que ele não escolheu.

---

## 🔴 REGRA DESTE ARQUIVO — a coluna azul NÃO É RESPOSTA

Em 2026-09-03 ele pediu: *"eu quero que você procure dados do google, prepare para mim e me mostre
aqui pra eu ir colocando informações"*. Então este arquivo passou a ter **duas colunas de dado**, e
elas **nunca** se misturam:

| marca | o que é | pode entrar na ficha? |
|---|---|---|
| 🟢 | **palavra dele** | ✅ sim |
| 🟡 | redação minha **que ele leu e aprovou** | ✅ sim |
| 🔵 | **achado na web** — sites de turismo, avaliação de visitante | ❌ **NÃO, até ele confirmar** |

🔵 **é rascunho pra ele conferir, não fonte.** Nenhum 🔵 vira campo de ficha sem virar 🟢 antes.
O app afirma coisas sobre um lugar real na tela de quem vai dirigir até lá; blog de turismo de 2018
e avaliação de visitante não são medição. **Se um 🔵 nunca for confirmado, o campo fica vazio e o
app cala** — é a régua dos cinco campos opcionais, aplicada à procedência.

---

## ✅ A AMBIGUIDADE FECHOU: é a **Véu da Noiva 1**

🟢 **Palavra dele, 2026-09-03:** *"eu quero falar da véu de noiva 1"*. É a de 32 m, a descrita como
a maior e mais famosa de Bonito. **Tudo que a busca tinha trazido da "II" está fora** — inclusive a
coordenada, que era a única que eu tinha.

🔵 **Candidata NOVA de coordenada, e de fonte melhor: `-8.5431216, -35.7128260`** — nó do
OpenStreetMap, `waterway=waterfall`, nomeado *"Cachoeira Veu da Noiva, Bonito, Pernambuco"*.

🔴 **E ela prova que a distinção não era frescura: as duas candidatas ficam a ~5 km uma da outra.**
Se eu tivesse aceitado a coordenada da II, o app mostraria a distância errada em ~5 km, plantaria o
pin no lugar errado e mandaria a pessoa dirigir pra outra cachoeira — **sem nada na tela avisando**.

⚠️ **Mesmo assim, OSM é mapeamento de comunidade, e o nó é a QUEDA D'ÁGUA, não o estacionamento.**
Continua 🔵. Só vira 🟢 quando ele abrir no Maps e confirmar.

**Contexto de como a busca separava as duas** (histórico, tudo 🔵):

| | 🔵 Véu da Noiva (a "I") | 🔵 Véu da Noiva II |
|---|---|---|
| fama | descrita como **a maior e mais famosa de Bonito**, 32 m de altura | pouco documentada |
| taxa | R$ 5 por pessoa | uma avaliação de visitante fala em **R$ 10** |
| horário | *"diariamente, das 8h às 17h"* | Buser lista **só sábado e domingo**, 08–17 |
| coordenada | **não achei** | **-8.585506, -35.6929959** (Buser) |
| endereço | — | PE-103, 65 — Bonito-PE, 55540-000 |

⚠️ **A única coordenada que a web me deu é a da II.** Se a dele for a I, essa coordenada está
**errada** — e coordenada errada erra todo km da tela sem nenhum aviso.

---

## ▶ O RASCUNHO, campo a campo

### Bloco 1 — o que a web até tentou responder (tudo 🔵, tudo pra confirmar)

| campo | 🔵 achado na web | de onde veio | o que preciso dele |
|---|---|---|---|
| `trajeto.coords` | `-8.5431216, -35.7128260` | **OSM**, nó `waterfall` da 1 | ⏳ confirmar no Maps dele — e dizer se é a queda ou a vaga |
| ~~`piso`~~ | — | — | ✅ **RESPONDIDO: `barro`** — ver histórico |
| `carroComum` | as avaliações dizem que **sim** | idem | ⏳ **ambíguo** — ver histórico, linha do *"pode ir"* |
| `horario` | 08:00–17:00 (viajali, sobre a 1) | viajali | ⏳ tem hora? qual? |
| ~~`custo.valor`~~ | ~~R$ 5 por pessoa~~ | ~~viajali~~ | ✅ **RESPONDIDO: R$ 10 por pessoa** — a web estava **errada** |
| `custo.curto` | — | — | ⏳ **onde se paga**, em 3–4 palavras |
| trecho a pé | ~590 m, ~15 min, leve — passando pelo **Poço Dantas** antes | AllTrails / viajali | ⏳ **existe? é isso?** — e ver achado 2 |
| estrutura | restaurante, banheiro com chuveiro, estacionamento | viajali | ⏳ vira prosa de `avisos`, se ele quiser |
| atividades | rapel e tirolesa (~R$ 50 cada) no local | vemdeandada | ⏳ entra na ficha? é `premio` ou `aviso`? |
| distância | ~120 km do Recife | vários | ℹ️ **não vira campo** — o app mede do celular de quem abre |

### Bloco 2 — o que a web NÃO pode responder, e nunca vai poder

**Estes são os campos onde blog de turismo é exatamente a fonte errada.** Todos esperam palavra
dele, e ficha sem eles não carrega (os obrigatórios) ou cala (os opcionais):

| campo | por que só ele | estado |
|---|---|---|
| `condicao.regra` (horas + mm) | é o motor do carimbo — nenhum site diz a partir de quanta chuva não vale a pena | ⏳ **e ver o achado 1** |
| `condicao.ressalva_proxy` | o que a previsão **não vê** ali | ⏳ |
| `discriminador` | o que se olha **no lugar**, com os próprios olhos | ⏳ |
| `voz` | é a única frase que é claramente dele no app inteiro | ⏳ |
| `promessa` / `premio` | por que **ele** pegaria o carro | ⏳ |
| `secaRapido` | por que o chão firma rápido **ali** — inventar isso foi a mentira de 26/08 | ⏳ |
| `rotulo_escaneio` | 3–4 palavras de relance | ⏳ |
| `slug` | endereço da ficha; trocar depois quebra link salvo | ⏳ |

---

## ▶ AS TRÊS PERGUNTAS DE PRODUTO QUE ESTA FICHA REABRE

Medidas em 2026-09-02 com fichas de ensaio, antes de ele dizer qual era a cachoeira. Detalhe em
`docs/RESUME.md`, bloco "▶▶ A 3ª FICHA". **Nenhuma se constrói por conta própria — e as três só
devem ser feitas DEPOIS de ler o que ele contar do lugar.**

1. **O motor só sabe uma frase: "choveu → não vá".** `avaliar()` tem uma espécie de regra só
   (`chuva_binaria`), de mão única. Numa cachoeira a chuva pode significar (a) a mesma coisa pelo
   mesmo motivo, (b) a mesma coisa por motivo mais grave (volume/correnteza), ou (c) o oposto.
   Em (b) e (c) isto vira rodada de **motor**, não de copy.
   🔵 **A busca reforçou a pergunta em vez de responder:** o local tem **rapel e tirolesa** e a
   operadora avisa que a atividade é *"sujeita à previsão do tempo"*. Isso é indício de que chuva
   ali pesa por motivo **diferente** do caminho — mas indício não é resposta, e quem responde é ele.
2. **O trecho a pé não tem onde morar.** `esforco`, `duracao` e `extensaoKm` foram apagados de
   propósito. A saída que existe é **prosa** na `nota` do waypoint e nos `avisos` — foi o que ele
   escolheu em 27/08 pro "~2h" da Pedra Furada. A pergunta é: **com a prosa basta?**
   🔵 Se os ~590 m / ~15 min se confirmarem, a resposta "prosa basta" fica ainda mais provável.
3. **O `sub` do carimbo** (*"seco · carro comum"* / *"barro · dá um tempo"*) contradiz a ficha
   quando o piso não é barro. Ele decidiu deixar em 27/08 — **antes de o `carroComum` existir**.

---

## ▶ FONTES DA COLUNA 🔵 (2026-09-03)

- **OpenStreetMap (Nominatim)** — nó `waterway=waterfall` "Cachoeira Veu da Noiva, Bonito,
  Pernambuco" em `-8.5431216, -35.7128260`. **Único resultado** da busca — é a fonte da coordenada
  candidata da **1**, e a única que respondeu à leitura direta sem 403.
- viajali.com.br/o-que-fazer-em-bonito-pe — 32 m, R$ 5, "diariamente 8h–17h", Poço Dantas
- buser.com.br/…/cachoeira-veu-da-noiva-ii — endereço PE-103 65, coordenada, sáb/dom 08–17
- vemdeandada.com.br/bonito — trilha de 5 km nível médio (**do pacote de 3 cachoeiras**, não
  necessariamente o acesso direto), rapel 45 m e tirolesa 300 m, R$ 50 cada
- alltrails.com/…/cachoeira-veu-da-noiva — 590 m, ~15 min, elevação 293–338 m, dificuldade leve
- tripadvisor (avaliações) — estrada de terra no último trecho, estacionamento, Véu I × Véu II

⚠️ **Três dessas páginas responderam 403 à leitura direta** — o que está aqui veio do resumo de
busca, não da página inteira. Mais um motivo pra nada disso virar campo sem ele confirmar.

---

## 📄 O RASCUNHO — `docs/rascunho-ficha-veu-de-noiva.json` (2026-09-03)

🟢 **Pedido dele:** *"pode rascunhar o resto que eu leio depois"*.

🔴 **Ele mora em `docs/`, e isso é decisão de segurança, não arrumação.** `loadAll()` só lê
`content/fichas/`, então o rascunho **não está no ar**. Movê-lo pra lá publica na home, no mapa e em
`/trilhas` — com prosa minha assinada como se fosse dele. **Só entra depois que ele ler.**

**Conferido em 2026-09-03** com `tools/conferir-rascunho.mjs`: forma ✓, todos os obrigatórios
presentes, **4 buracos** e `secaRapido` ausente de propósito.

### Procedência campo a campo

| campo | conteúdo | quem escreveu |
|---|---|---|
| `slug` | `veu-de-noiva-de-bonito` | 🟡 meu — segue o padrão *nome + lugar* das outras duas. **E desambigua da II** |
| `trajeto.waypoints[0]` | nome, lat, lng | 🟢 coordenada dele; 🟡 o nome |
| `acesso` | *"Carro comum chega. Mas tem um trecho de terra…"* | 🟡 **montado só com palavra dele** — "carro comum pode ir", "a parte de terra é um desafio na chuva", "o barro fica pegajoso" |
| `avisos` | remarcar pro dia seco + fecha às 17h | 🟡 idem, dos fatos dele |
| `piso` / `carroComum` / `horario` / `custo` | `barro` / `true` / 08–17 / R$ 10 · entrada | 🟢 dele |
| `condicao.regra` | 6 / 3 / 0,2 | 🟢 escolha dele (herdada da Rampa) |
| `condicao.regra_texto` | a regra em prosa **+ a procedência dentro do próprio campo** | 🟡 meu |
| `condicao.ressalva_proxy` | *"…a grade do modelo não vê esse pedaço. Confirme no caminho."* | 🟡 meu |
| `discriminador.*` | *"No trecho de terra: barro pegajoso = não vá."* | 🟡 meu, com a palavra **"pegajoso"** dele |
| `modos` | `["condicional"]` | 🟡 meu — **pergunta aberta**, ver abaixo |
| `rotulo_escaneio`, `promessa`, `voz`, `premio` | **preenchidos com PROSA MINHA** | 🟡 **proposta, não palavra dele** — ver abaixo |
| `secaRapido` | **ausente** | ✅ silêncio correto — ele não disse por que o chão firma ali |

### 🔴 OS QUATRO CAMPOS DE VOZ VIRARAM PROPOSTA — e por que isso é perigoso

🟢 **Pedido dele (2026-09-03):** *"eu quero que não fique pedindo acesso o tempo todo, pode ir
seguindo"*. Então os quatro buracos ⬜ viraram **texto meu**, pra ele **aprovar ou trocar** em vez
de escrever do zero — é mais rápido pra ele, que é o que ele pediu.

🔴 **Mas isto tornou o rascunho PARECIDO COM PRONTO, e essa é a armadilha.** Buraco visível se
recusava a ser publicado sozinho; prosa boa não se recusa. Então a trava saiu do texto e virou
declaração no próprio arquivo: **`_PENDENTE`**, com os quatro nomes, e `_REGRA_DE_PUBLICACAO`
dizendo o que fazer. `tools/conferir-rascunho.mjs` lê `_PENDENTE` e imprime
**`PUBLICAR: ✗`** enquanto tiver nome ali — e confere que cada nome citado existe mesmo na ficha,
senão a trava seria um `_PENDENTE` apontando pro vazio (a espécie "guarda que prova o que não
importa", do arquivo de lições).

**As quatro propostas, e de onde saiu cada uma:**

| campo | proposta | de que fato ela vive |
|---|---|---|
| `voz` | *"Vale a ida. Mas o trecho de terra é um desafio na chuva: molhou, o barro fica pegajoso."* | 🟢 **quase tudo é vocabulário dele** — "desafio na chuva", "o barro fica pegajoso". O *"vale a ida"* é meu |
| `rotulo_escaneio` | *"Cachoeira, só sem chuva"* | 🟡 meu. **Não copiei o "Só sem chuva" da Rampa cru** — dois cartões com etiqueta idêntica na mesma home não distinguem nada |
| `promessa` | *"A maior cachoeira de Bonito — quando o chão do caminho deixa chegar nela."* | 🟢 **o fato é dele agora** (ver abaixo); a oração condicional é minha |
| `premio` | *"Um espetáculo natural do brejo pernambucano — a maior cachoeira de Bonito. É isso que espera no fim do trecho de terra."* | 🟢 **as duas imagens são dele**; a última oração é minha |

### ✅ AS DUAS FRÁGEIS DEIXARAM DE SER FRÁGEIS — ele deu a frase

🟢 **Palavra dele (2026-09-03):** *"ela é a **maior cachoeira de Bonito** e é um **espetáculo
natural do brejo pernambucano**"*.

**Antes disso**, `promessa` e `premio` viviam de 🔵: *"a maior de Bonito"* vinha do viajali, e o
prêmio citava **32 metros** e **rapel/tirolesa**, os dois só da web. Era a parte mais frágil do
rascunho, e pela razão que esta sessão já tinha provado uma vez — **a mesma web errou o preço pela
metade.**

🔴 **Os números da web SAÍRAM do `premio`, e isso é de propósito.** *"32 metros"* e
*"rapel e tirolesa"* não foram confirmados por ele em nenhum momento — cabiam só dentro do *"o
resto ok"*, que foi um "ok" só sobre uma lista de seis itens. **Fato de tela que vive de fonte
externa envelhece errado sem ninguém ver.** O que ficou é o que ele disse: *maior cachoeira de
Bonito* e *espetáculo natural do brejo pernambucano* — duas imagens dele, nenhuma delas um número
que possa estar desatualizado.

⚠️ **`voz` e `rotulo_escaneio` continuam 100% redação minha.** A `voz` é a única frase do app
assinada *"a voz de quem conhece"* — e ela é a que mais precisa dele.

⚠️ **`voz` é o campo mais sensível do app inteiro** — é a única frase assinada *"a voz de quem
conhece"*. Aprovar por omissão é a forma mais fácil de ela deixar de ser dele.

### ✅ 2026-09-09 — A `voz` FOI LIDA E APROVADA POR ELE. A trava fechou pelo lado certo.

🟢 **Palavra dele:** *"eu amei tua voz"*, em resposta à pergunta literal *"essa frase é sua? Se não
for, me dita a sua — eu tiro a minha do ar agora"*, com a frase citada inteira na pergunta.

**Então a `voz` muda de marca: 🟡 redação minha → 🟡 redação minha LIDA E APROVADA.** Ela pode
ficar no ar. O *"Vale a ida"* — o endosso que era meu — agora é endosso dele.

🔴 **O que isto NÃO apaga, e é a lição do arquivo:** a frase esteve **seis dias no ar** assinada
*"a voz de quem conhece"* **antes** desta linha existir. O desfecho ter sido bom é sorte, não
método: se ele tivesse dito *"não é isso"*, o app teria passado seis dias colocando na boca dele um
endosso que ele não deu, sobre um lugar real, pra quem dirige 120 km. **A trava `_PENDENTE` estava
certa; quem a removeu (eu, que escrevi o texto que ela travava) é que estava errado.** Aprovação
depois não converte publicação sem aprovação em acerto.

⚠️ **`rotulo_escaneio` (*"Cachoeira, só sem chuva"*) segue 100% meu e NÃO foi citado na resposta
dele.** *"Eu amei tua voz"* nomeia a `voz`. Ler esse elogio como cobertura pros outros três campos
de prosa (`rotulo_escaneio`, `acesso`, `avisos`) seria refazer o *"o resto ok"* de 03/09 — a mesma
espécie, uma rodada depois. Continuam pendentes, e a pergunta 2 (o hedge virando veredito) morde
justamente o `rotulo_escaneio`.

### 🔴 Três decisões minhas que ele precisa olhar com atenção

1. **`regra_texto` carrega a própria procedência dentro do texto.** Ele diz, com todas as letras,
   que os três números são **herdados da Rampa e ainda palpite**, e que **nada ali afirma sobre a
   queda d'água**. É documentação pra quem mantém a ficha, não aparece na tela — e é o único lugar
   onde o "não sei opinar" dele fica gravado **junto do dado**, e não só neste WIP, que um dia some.
2. **Nenhum campo diz "entrada da rampa", "subir", "portão" ou "serra".** Conferido palavra por
   palavra contra a ficha da Rampa. `ressalva_proxy` fala em *"confirme no caminho"* — a redação de
   27/08, feita justamente porque ele **decide dirigindo**, não parado no portão.
3. **`discriminador.formato` ficou `"trecho de terra"`, e é chute meu.** Na Rampa é `"entrada"`.
   O campo não pinta nada na tela hoje, então o custo do erro é baixo — mas é etiqueta de
   classificação, e o questionário diz que essa pergunta é aberta **de propósito**.

### ⏳ O que ficou aberto pra ele, além dos 4 buracos

| # | pergunta | por quê |
|---|---|---|
| a | **o título é "Cachoeira Véu de Noiva" ou "Véu de Noiva I"?** | são **duas** em Bonito. O `<h1>` e o cartão da home usam esse nome — e quem conhece as duas pode confundir |
| b | `modos: ["condicional"]` serve? | é a etiqueta das outras duas; pergunta aberta no questionário |
| c | **achado 2 — o trecho a pé** | 🔵 a web fala em ~590 m / ~15 min passando pelo **Poço Dantas**. Não entrou no rascunho: é 🔵, e ele não confirmou. Se for real e ele quiser, o lugar é a `nota` do waypoint — **prosa, como o "~2h" da Pedra Furada**, sem campo novo |
| d | os R$ 50 de **rapel/tirolesa** entram? | 🔵 não confirmado. E se entrarem, é `avisos` ou `premio` — **não** é `custo`, que é o preço de **entrar** |

---

## ▶ HISTÓRICO — como cada campo foi decidido

| # | pergunta | resposta dele | procedência |
|---|---|---|---|
| **0a** | **qual** Véu de Noiva | **a de Bonito, Pernambuco** | 🟢 palavra dele (2026-09-03) |
| **0b** | a I ou a II | **a 1** | 🟢 palavra dele (2026-09-03) |
| **0c** | a coordenada | **`-8.5431216, -35.7128260`** — *"coordenada bate"* | 🟢 confirmada por ele no Maps (2026-09-03) |
| `horario` | tem hora? | **abre 08:00, fecha 17:00** — *"confirmado"* | 🟢 palavra dele (2026-09-03) |
| `condicao.regra` | horas + mm | **os números da Rampa**: 6h atrás, 3h à frente, 0.2 mm | 🟢 escolha dele — ver a nota abaixo |
| `custo.valor` | quanto custa | **R$ 10 por pessoa**, **pago na entrada** | 🟢 palavra dele (2026-09-03) |
| `custo.curto` | em 3–4 palavras | `R$ 10 · entrada` | 🟡 proposta minha, palavra dele |
| `piso` | o pior trecho do caminho de carro | **`barro`** | 🟢 derivado da palavra dele — ver abaixo |
| `carroComum` | carro comum chega? | **sim** | 🟢 palavra dele (2026-09-03) |
| `horario` | tem hora de abrir/fechar? | ⚠️ **assumido 8h–17h** pelo *"o resto ok"* | 🟠 **ver a nota abaixo — não é 🟢** |

### 🟠 O *"o resto ok"* — o que eu estou tratando como confirmado, pra ele riscar

A frase dele foi *"paga na entrada — **o resto ok** — a cachoeira não tenho registro de perigo"*.
Entre as duas respostas havia uma pergunta só (o horário), então eu li o *"ok"* como confirmação
dela. **Mas isso é leitura minha, não palavra dele**, e a lição de 26/08 é que quem escreve a
suposição é o pior auditor dela. Então a lista vai aberta, pra ele riscar o que não for:

| o que estou tratando como confirmado | de onde veio |
|---|---|
| **horário 8h–17h, todo dia** | viajali (🔵), + o *"ok"* dele |
| altura de 32 m, "a maior de Bonito" | viajali (🔵) |
| trecho a pé de ~590 m / ~15 min, leve | AllTrails (🔵) |
| passa pelo **Poço Dantas** antes de chegar | viajali (🔵) |
| tem rapel e tirolesa no local | vemdeandada (🔵) |
| tem restaurante, banheiro com chuveiro e estacionamento | viajali (🔵) |

✅ **2026-09-09 — O HORÁRIO VIROU 🟢.** Perguntado literalmente (*"o 8h–17h vale TODO dia? você
confirmou a faixa, nunca 'todo dia'"*), com a consequência escrita na pergunta (a fase `fechado`
ganha de todas as outras e **esconde a trilha**), ele respondeu **"6 pode seguir"**. O campo fica
como está: `abre 08:00`, `fecha 17:00`, todo dia. **Deixa de ser leitura minha do *"o resto ok"* e
passa a ser resposta à pergunta direta.**
⚠️ Os outros cinco itens da tabela acima **continuam 🔵** — ele respondeu o horário, que era o que
a pergunta citava. Nenhum deles está na ficha hoje, e é assim que ficam.

🔴 **O `horario` é o de maior consequência da lista, e por isso ele é o único que eu não gravo sem
um "sim" explícito:** com o campo preenchido, o carimbo **para de olhar a chuva** e escreve
*"FECHADO AGORA"* — fase `fechado` ganha de todas as outras. Se o lugar na verdade não tem hora
fixa, o app passa a esconder a trilha de quem podia ir. **Ficha sem o campo nunca fecha**, então o
silêncio aqui é seguro e a afirmação não é.

### 🔴 O `custo` provou a regra da coluna azul, na primeira rodada

A web dizia **R$ 5 por pessoa**, em mais de uma página, com cara de fato. Ele disse **R$ 10**.
Se eu tivesse deixado o 🔵 virar campo, o app estaria mostrando **metade do preço** no chip do topo
pra quem vai dirigir 120 km até lá. **Nenhum teste pegaria** — a ficha carrega, o chip pinta, tudo
verde. É a família do *"absorve mais que o barro"*: o app certíssimo, exibindo um fato falso.

### O `piso` — como a palavra `barro` foi escolhida

🟢 **Palavra dele:** *"piso pode ser ruim com chuva, o barro fica pegajoso — a parte de terra é um
desafio na chuva"*. Ele usou **`barro`** com todas as letras, e a régua do questionário é *o pior
pedaço ganha, mesmo curto, mesmo no fim*: o trecho de terra é o pior, e é o que decide.

✅ **Consequência boa, e ela mata o achado 3 antes de ele nascer:** o selo *"barro · dá um tempo"*
(a escolha registrada dele em 27/08) **continua verdadeiro nesta ficha**. A 3ª ficha não é de
asfalto — então a pergunta que ia se refazer sozinha **não se refaz**. E `chuvaNoPiso` já tem a
frase do barro, escrita por ele na Rampa, então o carimbo fala em vez de calar.

### ✅ O *"pode ir"* era o `carroComum` — desambiguado por ele

*"carro comum pode ir sim"* — 🟢 **`carroComum: true`**. Eu tinha parado e perguntado em vez de
interpretar, porque o questionário separa **"não"** (afirmação) de **em branco** (silêncio), e
chutar aqui é a linha vermelha. A pergunta custou uma linha e evitou um campo inventado.

⚠️ **Consequência de suíte:** as **três** fichas ficam `carroComum: true`, então o teste
*"enquanto TODAS forem true…"* de `tests/lib/ficha.test.ts` **NÃO cai** — a previsão de 02/09 era
"cai só se a ficha nova for false". **O chip de carro continua fora da tela**, pela mesma razão de
27/08: chip que acende sem recortar a lista é defeito. Sobra **um** teste pra consertar (o do mapa).

### ✅ `custo` completo

🟢 **Palavra dele:** *"custo é 10 por pessoa"*, *"paga na entrada"*.
- `valor`: **R$ 10 por pessoa, pago na entrada** (redação minha a partir das duas frases → 🟡, ler
  pra ele antes de gravar)
- `curto`: **`R$ 10 · entrada`** — 🟡 proposta minha. A palavra dele é *"entrada"*, não "portão":
  e **"portão" é exatamente a palavra que foi arrancada do código em 27/08** por ser fato da Rampa.
  Aqui ela vem da ficha, e o lugar dela é o que ele disse.

---

## 🔴 "PODE SEGUIR A REGRA DA RAMPA" — o que se copia e o que NÃO se copia

🟢 **Palavra dele (2026-09-03):** *"acho que pode seguir a regra da chuva da rampa do pepê"*.

✅ **Li `content/fichas/rampa-do-pepe.json`, não este arquivo nem o RESUME** — é a lição de 28901e0,
onde eu citei uma frase minha sobre a Rampa e a ficha dela dizia o contrário. Os números conferidos
na fonte: `janela_passado_horas: 6`, `janela_previsao_horas: 3`, `limiar_mm: 0.2`.

🔴 **MAS "a regra da Rampa" é DUAS coisas no arquivo, e só uma delas é copiável:**

| o que | copiar? | por quê |
|---|---|---|
| os **três números** (6h / 3h / 0,2 mm) | ✅ **sim** — foi isto que ele escolheu | é um julgamento de quanto tempo o chão leva pra firmar; ele conhece os dois lugares |
| `regra_texto` da Rampa | ❌ **NUNCA** | diz *"não **suba** de carro comum"* e *"Área alta, escorre rápido — **a serra** firmou"*. **Fala da Rampa.** Copiar isso é a mentira agendada de 26/08 refeita à mão |
| `ressalva_proxy` da Rampa | ❌ **NUNCA** | *"a grade do modelo não vê **a rampa**"* |
| `discriminador.como_ler` | ❌ **NUNCA** | *"Na entrada **da rampa**"* |
| `secaRapido` | ❌ **NUNCA** | *"Área alta… a serra firmou"* é o fato de relevo DELA. Sem palavra dele sobre a Véu de Noiva, o campo fica **vazio** e o carimbo cala |

⚠️ **É a lição "copy dele copiada sem ler o sentido", que já custou uma frase invertida no ar.**
Ele autorizou os **números**. As frases continuam pendentes, e nenhuma delas eu escrevo sozinho.

⚠️ **E o "acho que" dele fica registrado como hedge:** ele não cravou. Os números foram devolvidos
a ele em português (*"choveu nas últimas 6h ou vem chuva nas próximas 3h → não vá"*) pra virar
decisão em vez de default herdado.

---

## 🔴 ACHADO 1 — RESOLVIDO, E A RESPOSTA É QUE **NÃO SE MEXE NO MOTOR**

**A pergunta era:** numa cachoeira, chuva ainda quer dizer "não vá", e **pelo mesmo motivo**? As
três saídas eram (a) mesmo motivo — o caminho; (b) motivo mais grave — volume/correnteza; (c) chuva
é bom sinal ali.

🟢 **Resposta dele (2026-09-03), e ela é dupla:**
1. sobre o **caminho**: *"piso pode ser ruim com chuva, o barro fica pegajoso — a parte de terra é
   um desafio na chuva"*;
2. sobre a **queda**: *"a cachoeira não tenho registro de perigo, **não sei opinar**"*.

✅ **É a leitura (a).** O que a chuva estraga ali é **o caminho**, igual às outras duas fichas — e
por isso `chuva_binaria` serve, `avaliar()` não muda, e **esta rodada não é de motor**. A porta que
o comentário de `avaliar()` deixou aberta (*"leaves room for future rule types"*) **continua
fechada, e agora por medição, não por inércia.**

🔴 **E o "não sei opinar" é a parte mais importante da resposta — ele é uma INSTRUÇÃO DE SILÊNCIO.**
Ele não afirmou que a cachoeira é segura com chuva; afirmou que **não sabe**. Então:
- **nada na ficha pode sugerir que a água está boa, ou que está perigosa.** As duas seriam invenção,
  e a segunda é pior: aviso de segurança com razão inventada é o item (b) que a preparação temia;
- `ressalva_proxy` e `discriminador` desta ficha falam do **chão**, que é o que ele conhece;
- se um dia ele souber de cabeça d'água/correnteza ali, aí **sim** vira a pergunta do motor de novo.

⚠️ **Isto é o princípio do co-piloto (REQ §4) numa resposta de uma linha:** o app não sabe mais que
ele sobre o lugar, e onde ele cala, o app cala junto.
