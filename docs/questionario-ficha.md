# O questionário que vira uma ficha

Este documento é pra você, João, responder. Uma pergunta por campo — sem jargão de
programação no meio, o nome técnico do campo aparece só no título de cada seção,
entre crases, pra quem for programar depois saber onde a resposta cai.

**Aviso:** as respostas são suas. Quem escreve o app (eu) não inventa geografia,
distância, hora, regra de chuva nem qualquer outro fato sobre um lugar que você não
tenha me passado. Se uma pergunta abaixo parecer estranha ou pedir uma informação que
você não tem na ponta da língua, é melhor deixar em branco e a gente conversar do que
eu chutar um valor plausível.

Todo exemplo abaixo é a resposta real que já existe pra Rampa do Pepê
(`content/fichas/rampa-do-pepe.json`) — não é ficção, é o dado que você já deu.

---

## O nome curto do lugar — `slug`

**Pergunta:** se essa trilha fosse um endereço na internet, o que viria depois da
barra? (letras minúsculas, sem acento, palavras separadas por hífen)

**Por que importa:** é o endereço da ficha (`bateperna.vercel.app/<slug>`) e também é
a chave interna que liga o cartão da home ao pin do mapa — o pin aponta pra `#<slug>`
no meio da folha de cartões. Depois que alguém salvar ou compartilhar o link, trocar
o slug quebra esse link.

**Exemplo (Rampa):** `rampa-do-pepe`

---

## O trajeto — `trajeto`

Hoje toda ficha tem um ponto só (o schema pede pelo menos um, mas aceita mais no
futuro). Pra esse ponto, três perguntas:

### O nome do ponto

**Pergunta:** como você chama esse lugar, do jeito que chamaria conversando com
alguém que já foi?

**Por que importa:** é o título grande da ficha (`<h1>`) e também o nome que aparece
no topo de cada cartão na home.

**Exemplo (Rampa):** `Rampa do Pepê`

### A coordenada

**Pergunta:** qual é a latitude e a longitude desse ponto? (dá pra pegar abrindo o
lugar no Google Maps e copiando os dois números que aparecem)

**Por que importa:** é o que planta o pin no mapa da ficha, o que abre o "Abrir no
mapa" pro Google Maps, e é a ÚNICA coordenada de onde sai a distância em linha reta
até onde a pessoa está agora — o km do cartão na home, o km na ficha e o filtro
"até 30/60 km" medem todos até este ponto. É de propósito que seja o mesmo ponto do
"Abrir no mapa": um app que diz "40 km" e depois manda a pessoa pra outro lugar está
mentindo em uma das duas telas. Errar a coordenada é errar o mapa da ficha e todo km
que o app mostra, sem nenhum aviso de que errou. (O pin do mapa da home é outra
coordenada — ver a seção da coordenada da condição, mais abaixo.)

**Exemplo (Rampa):** `lat -7.907889, lng -36.019222`

### A nota do ponto

**Pergunta:** tem alguma coisa que vale avisar sobre esse trecho específico — um
detalhe de como é chegar ali, o que se vê no caminho?

**Por que importa:** aparece como uma linha pequena embaixo do nome do ponto, na
ficha. É opcional — se não tiver nada a dizer, essa linha simplesmente não aparece.

**Exemplo (Rampa):** `A subida da serra pela mata, por dentro da estrada.`

---

## A promessa — `promessa`

**Pergunta:** em uma frase, por que alguém pegaria o carro pra ir até aí?

**Por que importa:** é a primeira frase que a pessoa lê, logo abaixo do título — na
ficha e também no resumo do cartão da home. É o gancho: se ela não convencer em uma
linha, a pessoa não desce a tela pra ler o resto.

**Exemplo (Rampa):** `A serra pela mata e a vista lá de cima — quando o tempo deixa.`

---

## O prêmio — `premio`

**Pergunta:** o que essa trilha entrega, especificamente, quando dá certo? Pode ser
mais detalhado que a promessa — é o parágrafo, não a frase de efeito.

**Por que importa:** vira o texto da seção "O prêmio" na ficha, logo abaixo do
carimbo. É onde a pessoa confirma que vale esperar o tempo abrir.

**Exemplo (Rampa):** `A vista. E a subida da serra pela mata — a estrada vai subindo
por dentro da mata, e é lindo.`

---

## A voz — `voz`

**Pergunta:** se você tivesse que avisar um amigo sobre essa trilha em uma frase
direta, sem meias palavras, o que você diria?

**Por que importa:** aparece como citação na ficha, assinada "a voz de quem conhece".
É o único lugar onde o tom é claramente o seu, não o do app — por isso a frase deve
soar como fala, não como texto de guia turístico.

**Exemplo (Rampa):** `O pepê é emoção pura. Mas é barro: molhou, não vá.`

---

## O rótulo de escaneio — `rotulo_escaneio`

**Pergunta:** se essa trilha tivesse uma etiqueta de três ou quatro palavras — o tipo
de coisa que dá pra ler de relance, sem parar pra pensar — o que ela diria?

**Por que importa:** é a etiqueta pequena que fica acima do título na ficha, o
primeiro texto que os olhos pegam antes mesmo da promessa. Curto demais e não diz
nada; longo demais e deixa de ser "de relance".

**Exemplo (Rampa):** `Só sem chuva`

---

## Os modos — `modos`

**Pergunta:** pense nisso como etiquetas de classificação, não como texto pra
ninguém ler — que categoria(s) você diria que essa trilha se encaixa? Não tem lista
fechada; se não tiver certeza do que colocar aqui, me avise em vez de forçar uma
resposta.

**Por que importa:** hoje esse campo ainda não pinta nada na tela — não aparece na
ficha nem no cartão. É uma lista de etiquetas que existe pra classificar a trilha
internamente (na Rampa, hoje, a única etiqueta usada é "condicional" — o tipo de
trilha cujo "pode ir" depende da condição do tempo). Por isso é a pergunta mais
aberta do questionário: melhor deixar em aberto do que eu supor a categoria certa.

**Exemplo (Rampa):** `["condicional"]`

---

## O acesso — `acesso`

**Pergunta:** como alguém chega até lá — que tipo de carro serve, tem algum trecho
que exige cuidado?

**Por que importa:** vira a seção "🚗 Acesso" na ficha, com o ícone de carro. É a
informação prática de "como eu chego", separada do aviso de segurança.

**Exemplo (Rampa):** `Dá pra ir de carro comum — mas só quando não estiver chovendo.
Molhado, o risco é atolar.`

---

## O piso da via — `piso`

**Pergunta:** pensando no caminho INTEIRO até lá, da estrada principal até o
ponto final — qual é o PIOR trecho? Vale o pior pedaço mesmo que ele seja
curto, e mesmo que ele seja justamente o último: não é a média dos trechos, e
não é o piso que predomina no caminho. É o pior pedaço que qualquer carro
precisa passar. Responda com uma destas quatro palavras exatamente, sem
sinônimo:

- **barro** — terra que vira lama e segura água quando molha; o pior piso da
  escala.
- **paralelepipedo** — pedra irregular; sacoleja, mas não atola.
- **asfalto-esburacado** — é asfalto, mas tem buraco.
- **asfalto-tapete** — asfalto liso, sem buraco — o melhor piso da escala.

**Por que importa:** é um dos filtros da tela inicial — quem só topa ir de carro
comum em piso bom pode esconder trilhas com piso pior que isso.

**Exemplo (Rampa):** a estrada até o pé da serra é asfalto, e só a subida da
serra é barro. Mesmo com a maior parte do caminho asfaltada, o PIOR trecho
manda — a resposta certa pra Rampa é `barro`.

**Pular é permitido:** sem resposta, a trilha simplesmente nunca é escondida por
esse filtro — ela aparece pra qualquer piso mínimo que a pessoa escolher.

---

## Quantos km — `extensaoKm`

**Pergunta:** quantos quilômetros tem o trajeto em si, contando **só a ida**
— não conte a volta, mesmo que a volta seja pelo mesmo caminho de ida.
Responda em número (pode ter casa decimal): `4` ou `4.2`, não `4 km` nem
"4 km ida e volta".

**Por que importa:** é o outro filtro numérico da tela inicial — quem só quer
uma caminhada curta pode esconder trajetos mais longos que isso. É também o
número que aparece no cartão da home e na ficha — a mesma função escreve os
dois textos, pra nunca discordarem entre si.

**Exemplo (Rampa):** ainda não medido — quando você passar o número, ele entra
como só ida, do jeito que a pergunta pede.

**Pular é permitido:** sem resposta, a trilha simplesmente nunca é escondida por
esse filtro — ela aparece pra qualquer extensão que a pessoa escolher.

---

## Os avisos — `avisos`

**Pergunta:** o que pode dar errado, e o que a pessoa devia saber antes de decidir
ir?

**Por que importa:** vira a seção "⚠ Avisos" na ficha, com o ícone de alerta. É onde
mora o "se X, faça Y" — a orientação prática de segurança, separada do texto de
condição que já aparece no carimbo.

**Exemplo (Rampa):** `Só de carro comum em tempo seco: com chuva, risco de
atolamento — se choveu, remarque pro próximo dia seco. E a vista rende mais com céu
aberto — muita nuvem ou nevoeiro atrapalha o que você foi ver.`

---

## A condição — `condicao`

Esse é o bloco que faz o carimbo (fresco/frio) funcionar. Quatro perguntas.

### A coordenada da condição

**Pergunta:** qual é a latitude e a longitude do ponto certo pra medir a chuva dessa
trilha? (na Rampa é o mesmo ponto do trajeto, mas pode não ser — por exemplo, se o
trecho crítico for outro lugar diferente de onde a trilha começa)

**Por que importa:** é a coordenada que o app manda pro serviço de previsão do tempo
(Open-Meteo) pra saber se choveu ou vai chover ali. Escolher o ponto errado faz o
app ler a chuva de um lugar que não é o que decide se dá pra subir. **É também esta
coordenada — não a do trajeto — que planta o pin da trilha no mapa da home**: o mapa
que enquadra todas as trilhas do dia lê `condicao.coords` de cada ficha pra decidir
onde pôr cada pin. Se você der um ponto diferente do trajeto pra condição (por
exemplo, porque o trecho crítico é outro lugar), é este ponto que vai aparecer no
mapa da home. O que esta coordenada NÃO faz é distância: nenhum km da tela sai
daqui — todos saem da coordenada do trajeto. Então dar dois pontos bem distantes um
do outro é permitido e não deixa nenhum número errado: o pin da home marca a chuva,
o km marca o portão.

**Exemplo (Rampa):** `lat -7.907889, lng -36.019222`

### A regra em horas e milímetros

**Pergunta:** pra essa trilha virar "frio" (não suba), quanto tempo pra trás vale
olhar se choveu, quanto tempo pra frente vale olhar se vai chover, e a partir de
quantos milímetros de chuva isso conta?

**Por que importa:** são os três números que o motor usa pra decidir fresco ou frio,
e que também aparecem escritos na ficha (o "lido da chuva agora · Xh atrás + Yh à
frente" embaixo do carimbo, e nas frases que explicam a marca).

**Exemplo (Rampa):** `janela_passado_horas: 6, janela_previsao_horas: 3,
limiar_mm: 0.2`

**Nota pra quem monta o JSON:** além desses três números, o arquivo também leva um
quarto valor, `"tipo": "chuva_binaria"`, sempre igual, em toda ficha — não é uma
pergunta pro João responder, porque hoje só existe uma espécie de regra (o motor só
sabe avaliar chuva binária: choveu/não choveu acima de um limiar). Quando existir uma
segunda espécie de regra, este documento ganha uma pergunta nova; até lá, o valor é
fixo.

### O texto da regra

**Pergunta:** escreva a mesma regra acima, mas como frase — do jeito que você
explicaria pra alguém por que a trilha está fechada ou aberta hoje.

**Por que importa:** é a versão em português da regra, pra quem olhar o arquivo da
ficha (ou revisar os números) conseguir conferir se a frase e os números batem. Não
aparece na tela hoje — é documentação de quem mantém a ficha, não texto pro
visitante.

**Exemplo (Rampa):** `Choveu nas últimas ~6h OU vem chuva nas próximas ~3h → não suba
de carro comum; o barro segura água. Área alta, escorre rápido — passou disso,
firma.`

### A ressalva do proxy

**Pergunta:** o que a previsão do tempo não enxerga, que só quem está no lugar
enxerga?

**Por que importa:** vira o aviso destacado logo abaixo do carimbo na ficha (o texto
com o ícone ⚠, em negrito na primeira frase). É o lembrete de que o número que o app
mostrou é uma estimativa de satélite, não uma inspeção do barro — por isso a checagem
na entrada continua sendo da pessoa.

**Exemplo (Rampa):** `Chuva medida ≠ barro na entrada — a grade do modelo não vê a
rampa. Confirme na entrada.`

---

## O discriminador — `discriminador`

Esse é o texto de quem chega no portão e precisa decidir na hora. Três perguntas.

### O formato

**Pergunta:** em uma ou duas palavras, que tipo de checagem é essa — o que ela
descreve? (por exemplo, se é algo que se olha bem na entrada da trilha, ou outra
coisa — me diga com suas palavras)

**Por que importa:** hoje esse campo não aparece em nenhum texto da tela — é uma
etiqueta curta que classifica o tipo de checagem, junto com o "como ler" que vem a
seguir. É uma pergunta aberta de propósito: melhor você descrever com suas palavras
do que eu supor uma categoria.

**Exemplo (Rampa):** `entrada`

### O que se lê no lugar

**Pergunta:** já na entrada, o que a pessoa deve olhar pra confirmar se dá pra ir —
não a previsão, a coisa concreta que ela vê com os próprios olhos?

**Por que importa:** vira a linha principal da seção "Na entrada — a checagem é sua",
no fim da ficha. É a última palavra antes da decisão, por isso precisa ser algo
observável ali mesmo, não uma repetição da regra de chuva.

**Exemplo (Rampa):** `Na entrada da rampa: barro brilhando/pegajoso = não vá.`

### A permissão de dar meia-volta

**Pergunta:** o que você diria pra alguém que chegou até ali e decidiu não seguir?

**Por que importa:** vira a frase entre aspas, logo abaixo do "o que se lê no
lugar". Existe pra deixar claro que desistir na entrada é uma escolha válida, não uma
derrota — o app não empurra ninguém a continuar depois que a pessoa já fez o esforço
de chegar até lá.

**Exemplo (Rampa):** `Dar meia-volta aqui é sabedoria, não fracasso.`

---

## O custo — `custo`

**Pergunta:** entrar nessa trilha custa alguma coisa? Se custar, quanto, e como é
cobrado (no portão, antecipado, por pessoa, por carro)?

**Por que importa:** se for pago, aparece duas vezes na ficha: um chip curto com o
preço no topo da tela, ao lado do nome do app, e uma linha completa perto do fim com
o valor e onde é cobrado. Se for grátis, nenhuma das duas aparece.

**Exemplo (Rampa):** `tag: pago, valor: "R$ 5 por pessoa · cobrado no portão da
entrada"`

---

## O que acontece depois de responder

Cada conjunto de respostas vira um arquivo JSON novo em `content/fichas/` (um arquivo
por trilha, do jeito que `rampa-do-pepe.json` já existe). O arquivo é validado pelo
`fichaSchema` — se faltar um campo obrigatório ou o formato estiver errado, o app
recusa carregar em vez de mostrar algo quebrado. Depois de validado, a ficha nova
aparece sozinha na home (agrupada por "hoje dá" ou "hoje não dá", junto com o pin no
mapa) e no acervo em `/trilhas` — sem precisar mexer em mais nada.

`piso` e `extensaoKm` são os dois únicos campos opcionais deste questionário: se você
pulou uma das duas perguntas acima, a ficha carrega igual, só que essa trilha nunca
fica escondida pelo filtro correspondente (piso ou extensão) na tela inicial — ela
aparece pra qualquer valor que a pessoa escolher no filtro.

**Nota pra quem mantém o schema:** duas perguntas antigas, `esforco` (quão puxada é,
pensando no corpo de quem vai) e `duracao` (quanto tempo dura, em minutos), saíram
deste questionário — este app só sabe falar do LUGAR, não do corpo de quem vai, e
`piso` cobre o mesmo papel de filtro. As fichas antigas que já tinham `esforco` e
`duracao` continuam válidas; este documento só não pergunta mais por eles em fichas
novas.
