# Respostas da 2ª ficha — Pedra Furada de Venturosa ✅ FICHA CRIADA

> **Sessões de 2026-08-24 e 2026-08-25.** O João respondeu o questionário **pela conversa**, não
> editando o `docs/questionario-ficha.md` — foi pedido dele ("coloque para eu ir respondendo por
> aqui").
>
> ✅ **`content/fichas/pedra-furada-de-venturosa.json` EXISTE** desde 2026-08-25. Este arquivo
> deixou de ser fila de trabalho e virou **procedência**: de onde veio cada campo, o que é
> palavra dele, o que é redação minha aprovada, e **o que é padrão meu que ele não escolheu**
> (só o `limiar_mm`). Antes de mexer em qualquer texto da ficha, leia aqui de quem é a frase.

---

## ▶ O QUE SOBROU (nada bloqueia a ficha)

**Perguntas de produto esperando decisão DELE — as três estão nas seções no fim deste arquivo:**
1. **o portão que fecha às 17h** e o app não sabe de horário;
2. **o filtro de piso** escondendo a Pedra Furada de quem o carro alcança;
3. **"o passeio leva ~2h"** — fato sem campo, e `duracao` foi apagado de propósito na v4.0.

**Não construa nenhuma das três por conta própria.**

✅ **A QUARTA — a dívida da voz da Rampa vazada pro código — FECHOU em 2026-08-26, por decisão
dele.** A frase *"Área alta, escorre rápido — a serra firmou"* estava **fixa em
`src/app/Carimbo.tsx`** e aparecia na ficha da Pedra Furada, que é **plana**. Ele escolheu, entre
três saídas, a **frase por ficha**: campo novo `secaRapido`, cada lugar com a sua.

**Procedência do campo novo, e ela é limpa:**

| ficha | `secaRapido` | de quem é a frase |
|---|---|---|
| Pedra Furada | *"Área plana — o chão batido retém menos água que o barro."* | 🟢 **dele** — e corrigida por ele em 2026-08-26, ver a nota abaixo |
| Rampa do Pepê | *"Área alta, escorre rápido — a serra firmou."* | 🟡 redação minha de rodada antiga, **preservada** — era verdadeira sobre a Rampa desde sempre; só estava no lugar errado |

⚠️ **A linha amarela é a que vale reler com ele um dia:** a frase da Rampa nunca foi conferida
como *palavra dele*, só como *frase verdadeira sobre o lugar dele*. Ela sobreviveu à mudança
porque a mudança foi de ENDEREÇO, não de texto — mas continua sendo redação minha.

🔴 **E a frase da Pedra Furada chegou ao ar INVERTIDA por uma redação minha — corrigida no mesmo
dia, por ele.** Ela subiu como *"o chão batido **absorve mais** que o barro"*, que se lê como
**segura mais água** — o oposto do que ele quis dizer. A palavra dele é **retém menos**. Foi ele
quem pegou, olhando a tela.

⚠️ **A lição, e ela é de PROCEDÊNCIA, não de código:** a frase veio dele por escrito, então eu a
tratei como palavra dele e copiei sem ler o que ela AFIRMA. Frase curta sobre física de terreno
inverte o sentido com uma palavra — **leia o significado antes de copiar, mesmo quando o texto é
dele.** Nenhum teste pega isto: o app estava certíssimo mostrando a frase errada.

🔴 **O que a decisão dele NÃO cobriu, e segue fixo no código:** o ramo **frio** do mesmo carimbo
(*"O barro segura água — risco de atolar"*, `Carimbo.tsx`) e as três menções a *"cheque o barro
no portão"*. Hoje as duas fichas são `barro`, então as quatro linhas são verdadeiras **por
sorte** — a 3ª ficha com asfalto quebra todas de uma vez. **Não construa: é a mesma família, e a
saída é a mesma pergunta feita a ele.**

---

## ▶ HISTÓRICO — como cada campo foi decidido

**Encerrado em 2026-08-25:** ✅ **TODOS OS BLOCOS RESPONDIDOS.** `modos` = `["condicional"]`, dele
— e ele acrescentou a diferença pra Rampa: *"só que a diferença é que não tem rampa, é só o chão
batido"*. A fila de "ok" foi zerada: itens 2 a 8 aprovados em bloco, o 9 com o *"confortáveis de
subir"* **incluído a pedido dele** (a régua de "só falar de LUGAR" foi explicada antes; a palavra
é dele e ele a quis dentro).

---

## 🔴 A FILA DE "OK" — apresentada a ele inteira em 2026-08-25

**Não crie o JSON antes de zerá-la.** `fichaSchema` aceitaria qualquer string; o que não se
recupera depois é uma frase minha entrando na ficha como se fosse dele.

✅ **ZERADA em 2026-08-25.** Fica aqui como registro de **de quem é cada frase da ficha** — que é
o que não se recupera depois de o JSON existir.

| # | campo | de quem é |
|---|---|---|
| 1 | `modos` = `["condicional"]` | ✅ **dele** |
| 2 | `discriminador.formato` = `estrada` | 🔵 minha, aprovada (`entrada` seria espelhar a Rampa) |
| 3 | `discriminador.como_ler` | 🔵 minha, sobre palavras dele (a **poça** é dele) |
| 4 | `acesso` | 🔵 minha, aprovada |
| 5 | `avisos` | 🔵 minha, aprovada — alívio ANTES do aviso do arco |
| 6 | `condicao.ressalva_proxy` | 🔵 minha, aprovada |
| 7 | `voz` | 🔵 minha, aprovada |
| 8 | `rotulo_escaneio` = `Sem chuva há 3h` | 🔵 minha, aprovada |
| 9 | `waypoints[0].nota` | 🔵 minha + **"confortáveis de subir" é palavra DELE, que ele quis dentro** |
| 10 | `slug` | ✅ **dele** — "o longo" |
| 11 | coordenada | 🔵 **conversão minha**, liberada por ele (autorização, não recálculo) |
| — | `condicao.regra_texto` | 🔵 minha — documentação, nunca vai pra tela |
| — | `condicao.regra.limiar_mm` = `0.2` | 🔴 **padrão meu — ele disse "não tenho opinião"** |

🔴 **A única linha vermelha da tabela é o `limiar_mm`.** Todo o resto ou é dele, ou é meu **com
aprovação explícita**. Se um dia alguém precisar afrouxar o carimbo desta ficha, é ali que se
mexe sem contrariar dado de ninguém.

⚠️ **O item 9 tem uma linha fina:** *"360 degraus"* é fato de LUGAR e cabe; *"confortável de
subir"* é julgamento sobre o corpo, e é o tipo de frase que a v4.0 apagou do app junto com
`esforco`. A palavra é dele — mas ela está do lado de fora da régua, e isso foi dito a ele.

🔴 **E uma decisão de produto dele continua parada:** o filtro de piso vai esconder a Pedra
Furada de quem pede piso melhor que barro, **mesmo sendo lugar que carro comum alcança** — ver a
seção no fim deste arquivo. Não construa.

| bloco | estado |
|---|---|
| 1 — nome, coordenada, nota | ✅ respondido |
| 2 — promessa, prêmio, voz, rótulo | ✅ respondido (3 redações minhas aguardando o "ok" dele) |
| 3 — acesso, avisos, **piso** | ✅ completo em conteúdo (redações aguardando "ok") |
| 4 — condição (chuva) | ✅ completo — 3h/2h dele, coords dele, `limiar_mm` padrão meu |
| 5 — discriminador | 🟠 `como_ler` e `permissao_abortar` ✅ / **`formato` depende de "onde"** |
| 6 — custo, modos | 🟢 custo ✅ `gratis`; **`modos` ainda não perguntado** |

---

## O que ele JÁ respondeu

### `trajeto.waypoints[0]`

- **nome:** `Pedra Furada de Venturosa`
- **lat / lng:** `-8.5725` / `-36.825556` — ✅ **LIBERADO POR ELE** (2026-08-25: *"pode seguir"*).
  🔴 **Convertido POR MIM** do que ele deu — `8°34'21" S` e `36°49'32" W`. A conta:
  `8 + 34/60 + 21/3600 = 8,5725` e `36 + 49/60 + 32/3600 = 36,825556`; S e W viram negativo.
  ⚠️ **"Pode seguir" é AUTORIZAÇÃO, não conferência independente.** Ele não recalculou — ele
  liberou. A aritmética continua sendo minha, e foi refeita e bate. **Se algum dia o pin cair no
  lugar errado, o suspeito é esta conversão, não um dado ruim dele.**
- **nota:** `Chão batido até os pés da pedra — curto e plano.`
  Ele aprovou cortar a comparação com a Rampa ("pode deixar sem a comparação") — a nota vive na
  ficha da Pedra Furada, onde quem lê pode não conhecer a outra.
  🟠 **Proposta minha ainda não aceita:** juntar aqui os **360 degraus** (ver "detalhes novos").

### `slug`

`pedra-furada-de-venturosa` — ✅ **ESCOLHIDO POR ELE** (2026-08-25: *"o longo"*). Foi oferecido
`pedra-furada` como alternativa curta, com o argumento de que o nome da cidade evita confusão com
outras Pedras Furadas do país. **Trocar depois de alguém salvar o link quebra o link** — está
cravado.

### `promessa` ✅ ESCOLHIDA POR ELE

`Um vão livre natural na pedra, com pinturas rupestres — e a vista lá de cima.`

A primeira resposta dele foi *"uma experiência fora do ordinário"* — a única do questionário que
não dizia **o quê**, e ela é o resumo do cartão na home, onde às vezes é a única linha que se lê.
Ofereci (a) manter e (b) emprestar o concreto do prêmio, **feita só com palavras dele**.
**Ele respondeu "b".**

### `premio`

`A vista é espetacular. A pedra é um grande vão livre natural, tem pinturas rupestres e muita
história de povos nativos.`

### `voz` — 🟠 REDAÇÃO MINHA, AGUARDANDO O "OK" DELE

`É estrada de chão batido e plana. Se choveu, espera passar umas 3 horas.`

🔴 **A pergunta da voz saiu torta e vale saber por quê.** Perguntei "o que você diria pra um
amigo" e ele respondeu **operação, não fala**: horário do portão, o portão fechado, a estrutura,
e que é de graça. Foi ouro — mas caiu em **quatro outros campos**, não na voz. Repartido em
`acesso`, `avisos` e `custo` (abaixo). Só na segunda pergunta veio a frase de fala.

### `rotulo_escaneio` — 🟠 PROPOSTA MINHA, NÃO CONFIRMADA

`Sem chuva há 3h`

A resposta crua foi *"melhor ir sem chuva pelas 3 horas"*, que tem **duas leituras** — janela de
chuva, ou ir por volta das 15h. **Não escolhi sozinho, perguntei** — e ele esclareceu: é
**janela de chuva**. O `5 às 17` é só o portão. (Ele também precisa caber "de relance": a
resposta crua tem 7 palavras.)

### `custo` ✅ COMPLETO

`{ "tag": "gratis" }` — dele: *"mas é de graça"*. Sem `valor`, e a ficha não mostra chip de preço
nem linha de cobrança.

---

## O que está PELA METADE

### `acesso` — 🟠 CONTEÚDO COMPLETO, redação aguardando o "ok" dele (2026-08-25)

Já dele: **portão aberto das 5h às 17h, todos os dias**; **pode estar fechado quando você
chegar, e dá pra abrir tranquilamente**.

Novo, respondendo a pergunta 8: **carro comum passa SEMPRE**, e o **pior trecho é o chão
batido** — ou seja, **não há trecho pior antes dele**. A pergunta oferecia "sempre, ou só em
tempo seco?" e ele escolheu **sempre**, com todas as letras.

🔴 **Isto é o oposto da Rampa e a prosa NÃO pode ser copiada de lá.** Na Rampa, `piso: "barro"`
vem junto de *"não suba de carro comum; o barro segura água"*. Aqui o piso é o mesmo e o carro
comum passa mesmo assim. **O campo `piso` descreve o CHÃO, não a exigência de veículo** — as
duas fichas provam isso ao discordarem com o mesmo valor.

🔴 **O "sempre" GANHOU UMA RESSALVA na resposta seguinte (mesma sessão), e ela não é detalhe.**
Perguntei se o "passa sempre" valia **inclusive molhado**, e ele respondeu que **evitar a chuva
é justamente pra se precaver com o chão molhado quando for de carro — evitar derrapar e
atolar**. Ou seja: *sempre* respondia **"que tipo de carro"** (carro comum dá conta, não precisa
de veículo alto), **não** *"em qualquer condição"*.

⚠️ **Se eu tivesse escrito `acesso` na primeira resposta, a ficha diria "carro comum passa
sempre" e estaria ERRADA sobre a única condição que o app mede.** O erro não estava na resposta
dele — a pergunta 8 juntava duas coisas ("que carro serve" e "em que condição") e ele respondeu
a primeira.

**Redação proposta, aguardando o "ok" dele:**

> Dá pra chegar de carro comum. Se choveu, espera passar umas 3 horas — molhado, o chão batido
> escorrega e dá pra atolar. O portão fica aberto das 5h às 17h todos os dias; se estiver
> fechado quando você chegar, dá pra abrir tranquilamente.

### `avisos` — 🟠 tem três, falta SÓ o arco

Já dele: **a estrutura não é muito boa**; e **existe uma trilha mais perigosa, que sobe o arco —
ele não foi** (*"não sou tão aventureiro"*).

Novo em 2026-08-25: **é bom levar papel higiênico, o banheiro não é dos melhores.**
Repare que isto **concretiza** o "estrutura não é muito boa" que já estava lá — não é um quinto
aviso solto. Na redação, os dois viram **uma** linha; duas linhas dizendo a mesma coisa em graus
diferentes fazem a seção de avisos parecer maior do que é.

Também novo, e este é **fato de LUGAR sobre a experiência, não sobre o chão**: *"com a chuva a
experiência pode não ser das melhores, seja por visibilidade ou por ser ao céu aberto"*. Ver
`condicao` — é o que abre a janela de **previsão**.

**O arco, respondido em 2026-08-25 — e respondido DENTRO do limite dele:**

> A trilha do arco precisa subir pela mata; quem não for preparado pode se deparar com cobra e
> bichos da região. Ir **embaixo** do arco é bem tranquilo — não tem trilha de fato, é só subir
> os degraus.

✅ **Repare que ele avisou sem falar por experiência que não tem.** "Precisa subir pela mata" é
observável de baixo; "cobra e bichos da região" é conhecimento do lugar, não relato de subida.
[[nao-inventar-fatos-de-roteiros]] cumprida por ele mesmo. **Não engorde isso** com detalhe
técnico de trilha na mata que ninguém mediu.

🔴 **E a segunda metade da frase é o achado: ela não é aviso, é ALÍVIO — e resolve outro campo.**
*"Embaixo do arco é bem tranquilo, não tem trilha de fato, só subir os degraus"* é a resposta
que faltava pra `nota` do ponto, e ela **casa com os 360 degraus** (ver "detalhes novos"). Sem
essa frase, os dois avisos juntos — estrutura ruim + cobra na mata — pintam um lugar mais bravo
do que ele é. **O aviso do arco precisa nascer colado ao alívio**, senão a ficha assusta quem
nunca ia subir o arco de todo jeito.

**Redação proposta (o campo é UMA string, não lista — `src/types/ficha.ts:40`):**

> A estrutura do lugar não é das melhores — leve papel higiênico. Ir embaixo do arco é
> tranquilo: não tem trilha de fato, é só subir os degraus. Já a trilha que sobe o arco é outra
> coisa — ela sobe pela mata, e quem não estiver preparado pode dar de cara com cobra e bichos
> da região.

🔴 **A ordem é deliberada: o alívio vem ANTES do aviso do arco.** Invertida, a seção abre com
banheiro ruim e fecha com cobra, e a ficha assusta quem nunca ia subir o arco.

### `condicao` — 🟠 só um dos quatro números

- `regra.janela_passado_horas` = **3** — de *"é melhor ir se não tiver chovido por 3 horas"*.
  ⚠️ **Diferente da Rampa, que é 6.** Não copie a Rampa por reflexo.
- **O PORQUÊ das 3h, respondido em 2026-08-25 — e ele tem DOIS motivos, não um:**
  1. **o carro** — *"se precaver com o chão molhado quando for de carro, evitar derrapar e
     atolar"*. Este é o motivo do **passado**: o que importa é a chuva que já caiu e deixou o
     chão molhado.
  2. **a experiência** — *"com a chuva a experiência pode não ser das melhores, seja por
     visibilidade ou por ser ao céu aberto"*. Este é motivo de chuva **enquanto você está lá**,
     e portanto é da **previsão**, não do passado.

  🔴 **Os dois motivos moram em janelas DIFERENTES, e é isso que impede copiar o 3 pra frente.**
- `regra.janela_previsao_horas` = **2** — dele, em 2026-08-25: *"acho que 2 horas de previsão,
  dá tempo de subir, tirar fotos, curtir e descer"*.
  ✅ **E o "não suponha que é 3" se pagou: ele disse 2, não 3.** As duas janelas desta ficha são
  **assimétricas** (3 pra trás, 2 pra frente), como as da Rampa também são (6 e 3).
  🔴 **O raciocínio dele é de outra natureza e vale guardar:** o número pra frente saiu de
  **quanto tempo o passeio dura** — se chove dentro dessas 2h, você é pego lá em cima. A janela
  de previsão é *tempo de exposição*, não *antecedência de alerta*. Nenhuma outra ficha foi
  respondida assim ainda.
  ⚠️ **Consequência: o "o passeio leva ~2h" é FATO NOVO e não tem campo.** `duracao` foi apagado
  do schema na v4.0 de propósito. **Não ressuscite o campo.** Se for entrar, entra como prosa
  (`nota` ou `voz`) — e mesmo aí, cuidado: "leva 2h" é sobre o corpo/o passeio, e este app fala
  de LUGAR. Os **360 degraus** passam nesse teste; "leva 2 horas" é mais discutível. **Pergunte,
  não decida.**
- `regra.limiar_mm` = **0.2** — 🟠 **PADRÃO MEU, NÃO CRAVADO POR ELE.** Perguntei e ele
  respondeu *"não tenho opinião"* (2026-08-25). O valor é **herdado da Rampa**, e a pergunta foi
  feita já dizendo que aqui talvez coubesse folga maior por causa da areia. **Ele não escolheu —
  ele abriu mão de escolher.** Se um dia o carimbo desta ficha ficar sensível demais (frio com
  garoa que não molha o chão batido), **este número é o primeiro suspeito**, e mexer nele não
  contraria dado dele.
- `condicao.coords` = **as mesmas do trajeto** (`-8.5725`, `-36.825556`) — ✅ **ESCOLHA DELE.**
  A pergunta oferecia o ponto da **pedra** ou o ponto da **estrada de chão batido** (o trecho que
  de fato decide o rolê de carro), e ele respondeu **"o ponto da pedra"** (2026-08-25).
  ⚠️ **O "não tenho opinião" que veio um minuto antes era só do `limiar_mm`** — ele voltou
  sozinho pra cravar a coordenada. **Não leia o "não tenho opinião" como se cobrisse as duas.**
  ✅ **Consequência visível:** é esta coordenada que planta o **pin da home**, e o pin cai sobre
  a pedra — aonde a pessoa vai. O km da tela sai do trajeto e não muda.
- `regra.tipo` = `"chuva_binaria"` — fixo em toda ficha, não é pergunta (questionário, §condição).
- `regra_texto` — 🟠 **REDAÇÃO MINHA. É documentação, não vai pra tela** (questionário, §"O texto
  da regra"), então **não precisa do "ok" dele** — precisa é bater com os números:

  > Choveu nas últimas ~3h OU vem chuva nas próximas ~2h → o chão batido molhado escorrega e dá
  > pra atolar carro comum; e lá em cima, ao céu aberto, a chuva tira a visibilidade e a vista.
  > As 2h à frente são o tempo do passeio: subir os degraus, ficar e descer.

  ✅ Confere com `3` / `2` / os dois motivos que ele deu.
- `ressalva_proxy` — 🟠 **REDAÇÃO MINHA, AGUARDANDO O "OK" DELE. Esta VAI pra tela** (o ⚠ logo
  abaixo do carimbo):

  > Chuva medida ≠ chão molhado na estrada — a grade do modelo não vê o trecho de chão batido.
  > Confirme quando pegar a terra.

**`condicao` está COMPLETA** — dois valores dele, dois padrões meus declarados, dois textos meus.

### `piso` — ✅ `barro`, CRAVADO POR ELE (2026-08-25)

`"barro"`.

**A palavra é dele, não encaixe meu.** A pergunta foi feita dizendo que *chão batido* não é
nenhuma das quatro e que **quem crava é ele**; ele respondeu *"chão batido é uma espécie de
barro mas com areia, pode se enquadrar como o mesmo"*. Ele **classificou** — não aceitou uma
sugestão minha. Ver [[nao-inventar-fatos-de-roteiros]].

⚠️ **Guarde o "com areia", porque ele não é decoração.** É provavelmente o motivo de o carro
comum passar sempre aqui e não passar na Rampa: areia dá firmeza onde o barro puro segura água.
Se um dia a escala de piso ganhar uma quinta palavra, este é o caso que a pede.

Os dois avisos que acompanhavam a pergunta, **os dois resolvidos**:
1. o pior trecho **é** o chão batido — não há coisa pior antes (ele respondeu junto com a 8);
2. as duas únicas fichas ficam **iguais** neste campo, então **o filtro de piso só ganha vida
   na 3ª ficha**. Ele foi avisado disso ANTES de responder e respondeu assim mesmo.

---

### `discriminador` — 🟠 respondido em 2026-08-25, com UMA coisa por desempatar

- **`como_ler`** — dele: *"vejo se o barro está brilhando ou tem poça"*.
  ✅ **A poça é contribuição dele e é o melhor pedaço da resposta:** poça é justamente o que a
  previsão **não** enxerga (chove 2mm e não empoça; chove 2mm num trecho já saturado e empoça).
  Ela reforça a `ressalva_proxy` — considere puxá-la pra lá também.
  🔴 **MAS ATENÇÃO À CONTAMINAÇÃO PELO EXEMPLO.** A pergunta foi feita **citando a Rampa**
  (*"barro brilhando/pegajoso = não vá"*) e a resposta dele voltou com **as mesmas palavras**
  mais a poça. Isso **não** invalida a resposta — ele já tinha dito por conta própria, duas
  levas antes, que *molhado o chão batido escorrega e dá pra atolar*, então o conteúdo é
  coerente e independente. **Mas o vício de método fica registrado: citar a Rampa dentro da
  pergunta convida o eco.** Nas próximas fichas, pergunte **antes** de mostrar o exemplo.
- **`permissao_abortar`** = ✅ **FECHADO, palavras dele:**

  > Voltar sem ir é decisão, não desperdício — a chuva pode atrapalhar o caminho do carro e a
  > experiência.

  Primeiro ele aprovou a frase da Rampa (*"gostei da afirmação"*); avisei que repetir a mesma
  linha nas duas únicas fichas vira bordão de app e ofereci uma do lugar; **ele encurtou a
  minha** e emendou o rabo da chuva. O texto é edição dele em cima da minha, não a minha aceita.
  ⚠️ **Não "conserte" a concisão dele.** *"Voltar sem ir"* é seco de propósito.
  ⚠️ **A ressalva foi feita e ele decidiu contra ela — está encerrada.** Eu avisei que esse rabo
  **repete o que o carimbo já diz** poucas linhas acima, e perguntei se era frase ou `modos`;
  ele respondeu **"é a frase"**. **Não reabra** nem "otimize" cortando a repetição depois.
- **`formato`** — ⬜ **AINDA SEM ETIQUETA, e não invente.** Ele respondeu *"só olhe o barro, de
  resto é ok"* — **conteúdo**, não a etiqueta curta que o campo pede.
  ✅ **Mas o "onde" ficou resolvido:** perguntei se o barro se olha **dirigindo**, sem ponto onde
  parar e decidir (diferente da Rampa, onde se olha **parado na entrada da rampa**), e ele
  respondeu **"ok"** — é assim. **Logo `entrada` é etiqueta ERRADA aqui**, e o `como_ler` não
  pode começar com "na entrada". Falta só a palavra; ela sai fácil agora, mas é dele.
  🟠 **Proposta minha: `estrada`.** Redação do `como_ler` junto:

  > No trecho de chão batido, olhando da estrada: barro brilhando ou poça d'água = melhor voltar.
  ✅ **O "de resto é ok" resolveu OUTRA pergunta, essa sim:** o **portão** *não* vira checagem
  do discriminador. Fica só em `acesso`, como prosa. **Estava explicitamente na mesa e ele
  descartou** — não reabra.

## O que NÃO foi perguntado ainda

- **`modos`** = ✅ **`["condicional"]`, dele** (2026-08-25). A pergunta foi feita depois de ele
  esclarecer que a frase da chuva era da meia-volta, **não** resposta ao `modos` — então o campo
  chegou a ficar virgem por uma leva, de propósito.
  🔴 **E a resposta dele não foi só "sim":** *"é sim, só que a diferença é que não tem rampa, é
  só o chão batido"*. Ele **recusou a cópia** enquanto concordava com a categoria — o modo é o
  mesmo, o objeto da condição não. É a razão de `como_ler`, `acesso` e `ressalva_proxy` desta
  ficha não poderem herdar uma palavra da Rampa.

---

## Detalhes novos que ele lembrou fora de ordem — 🔴 NÃO PERCA

Vieram soltos no fim de uma resposta, e **nenhum tem campo óbvio**. As duas propostas abaixo
foram feitas a ele e **ele ainda não respondeu**:

1. **São 360 degraus de escada de pedra, e é confortável subir.** Proposto pra `nota` do ponto.
   ✅ **Reforçado em 2026-08-25 por conta própria:** *"não tem uma trilha de fato, só subir os
   degraus"*. Ele voltou ao mesmo fato de outro ângulo, num contexto diferente (falando do
   arco) — isso é confirmação, não repetição.
   ⚠️ Repare que isto é **fato de LUGAR** (quantos degraus existem), não de corpo — por isso
   cabe neste app mesmo depois de `esforco` ter sido apagado. Se virar frase de esforço
   ("cansativo", "puxado"), saiu do que este app sabe dizer.
2. **Tem uma trilha mais perigosa que sobe o arco; ele não foi.** Proposto pra `avisos`.

---

## 🔴 UMA PERGUNTA DE PRODUTO QUE NASCEU AQUI — é dele, não minha

**O app não tem campo de horário.** Conferido no `src/types/ficha.ts`: não existe. O
`5h às 17h` do portão só pode virar **prosa** dentro de `acesso` — texto que a pessoa lê, não
regra que o app aplique.

**A consequência:** o carimbo (fresco/frio) só olha **chuva**. Às 18h, com céu limpo, esta ficha
diz *"hoje o tempo deixa"* — e o portão está fechado há uma hora. É a mesma família do
`SEM INFORMAÇÕES · tome cuidado` da v3.4: o app afirmando mais do que sabe.

**Se um portão que fecha decide o rolê tanto quanto a chuva, isso é rodada nova.** Já foi dito a
ele, com essas palavras, e **está esperando decisão dele — não construa por conta própria.**

---

## 🔴 SEGUNDA PERGUNTA DE PRODUTO — nasceu do `piso` da Pedra Furada (2026-08-25)

**O filtro de piso da home é usado como proxy de "meu carro chega lá?" — e nesta ficha ele
erraria contra a pessoa.**

O dado agora é: Pedra Furada tem `piso: "barro"` **e** carro comum passando **sempre**. Rampa tem
`piso: "barro"` **e** carro comum **não** subindo. Mesmo valor, exigências opostas. Quem arrastar
a barra pedindo piso melhor que barro perde as duas — e perde a Pedra Furada **por engano**,
porque o carro dele chegava.

**O que NÃO fazer sozinho:** inventar quinta palavra na escala, ou um campo novo de "que carro
serve". Ver [[nao-inventar-fatos-de-roteiros]] e a regra de que este app só fala de LUGAR.

**Está esperando decisão dele.** Foi dito a ele em 2026-08-25, junto com a pergunta 9. É irmã da
pergunta do portão (seção acima): as duas são o app afirmando mais do que sabe.

---

## Anexo — as perguntas 8, 9 e 10 como foram feitas a ele

**8. O acesso.** Já tenho *portão aberto das 5h às 17h, todos os dias; pode estar fechado quando
você chegar e dá pra abrir tranquilamente*. Falta o de carro: **que tipo de carro serve pra
chegar até lá, e tem trecho que exige cuidado?** Carro comum passa sempre, ou só em tempo seco?

**9. Os avisos.** Já tenho *estrutura não é muito boa* e *a trilha que sobe o arco é mais
perigosa — você não foi*. Falta: **o que mais pode dar errado?** E sobre o arco — o que você sabe
pra avisar quem for tentar, sem falar por experiência que você não tem?

**10. O piso da via** — a escala de quatro palavras (`barro`, `paralelepipedo`,
`asfalto-esburacado`, `asfalto-tapete`), a pergunta do **pior trecho**, e o aviso das duas fichas
iguais. Texto completo em `docs/questionario-ficha.md`, seção "O piso da via — `piso`".
