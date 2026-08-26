# Respostas da 2ª ficha — Pedra Furada de Venturosa (EM ANDAMENTO)

> **Sessão de 2026-08-24.** O João respondeu o questionário **pela conversa**, não editando o
> `docs/questionario-ficha.md` — foi pedido dele ("coloque para eu ir respondendo por aqui").
> Ele parou no meio e pediu tudo pronto pra próxima sessão.
>
> 🔴 **NÃO EXISTE `content/fichas/pedra-furada-de-venturosa.json` AINDA, E É DE PROPÓSITO.**
> O `fichaSchema` exige `acesso`, `avisos`, `condicao` e `discriminador`, e os quatro estão
> incompletos. `loadAll` faz `fichaSchema.parse` e **estoura alto** (`src/lib/ficha.ts:37`) —
> um JSON pela metade em `content/fichas/` derruba o build e a suíte. **Só crie o arquivo
> quando os campos obrigatórios estiverem todos respondidos.**

---

## ▶ RETOMAR EXATAMENTE AQUI

**Atualizado em 2026-08-25:** ele fechou a **8 (acesso)** e a **10 (piso)**. A próxima é a
**9 (avisos)**, a única do bloco 3 que sobrou — o texto dela está no anexo, não reformule.
Depois dela vêm os blocos 4 (condição), 5 (discriminador) e `modos`.

Duas perguntas curtas nasceram da resposta dele de 2026-08-25 e **foram feitas junto com a 9**:
- **carro comum passa sempre INCLUSIVE molhado?** Ele disse "passa sempre", mas a regra dele é
  esperar 3h sem chuva — então falta saber se as 3h são pelo **carro** ou pela **pedra/escada**.
  Isso decide `regra_texto` e `ressalva_proxy` no bloco 4; não suponha.
- **o filtro de piso vai esconder a Pedra Furada de quem pede piso melhor que barro**, mesmo
  sendo lugar que carro comum alcança sempre. É consequência de produto, **decisão dele** —
  ver a seção nova no fim deste arquivo.

| bloco | estado |
|---|---|
| 1 — nome, coordenada, nota | ✅ respondido |
| 2 — promessa, prêmio, voz, rótulo | ✅ respondido (3 redações minhas aguardando o "ok" dele) |
| 3 — acesso, avisos, **piso** | 🟠 acesso ✅ / piso ✅ / **avisos ainda falta** |
| 4 — condição (chuva) | 🟠 só a janela de passado (3h); faltam 4 coisas |
| 5 — discriminador | ⬜ nem começou |
| 6 — custo, modos | 🟢 custo ✅ `gratis`; `modos` não perguntado |

---

## O que ele JÁ respondeu

### `trajeto.waypoints[0]`

- **nome:** `Pedra Furada de Venturosa`
- **lat / lng:** `-8.5725` / `-36.825556`
  🔴 **Convertido POR MIM** do que ele deu — `8°34'21" S` e `36°49'32" W`. A conta:
  `8 + 34/60 + 21/3600 = 8,5725` e `36 + 49/60 + 32/3600 = 36,825556`; S e W viram negativo.
  **Ele viu a tabela da conversão e não contestou, mas também não confirmou com todas as
  letras.** Como é a coordenada de onde sai **todo km da tela**, vale um "confere?" na volta.
- **nota:** `Chão batido até os pés da pedra — curto e plano.`
  Ele aprovou cortar a comparação com a Rampa ("pode deixar sem a comparação") — a nota vive na
  ficha da Pedra Furada, onde quem lê pode não conhecer a outra.
  🟠 **Proposta minha ainda não aceita:** juntar aqui os **360 degraus** (ver "detalhes novos").

### `slug`

`pedra-furada-de-venturosa` — derivado do nome por mim. Ofereci `pedra-furada` como alternativa
curta e argumentei que o nome da cidade evita confusão com outras Pedras Furadas do país.
🟠 **Ele não respondeu qual quer.** Trocar depois de alguém salvar o link quebra o link.

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

### `acesso` — ✅ COMPLETO (2026-08-25)

Já dele: **portão aberto das 5h às 17h, todos os dias**; **pode estar fechado quando você
chegar, e dá pra abrir tranquilamente**.

Novo, respondendo a pergunta 8: **carro comum passa SEMPRE**, e o **pior trecho é o chão
batido** — ou seja, **não há trecho pior antes dele**. A pergunta oferecia "sempre, ou só em
tempo seco?" e ele escolheu **sempre**, com todas as letras.

🔴 **Isto é o oposto da Rampa e a prosa NÃO pode ser copiada de lá.** Na Rampa, `piso: "barro"`
vem junto de *"não suba de carro comum; o barro segura água"*. Aqui o piso é o mesmo e o carro
comum passa mesmo assim. **O campo `piso` descreve o CHÃO, não a exigência de veículo** — as
duas fichas provam isso ao discordarem com o mesmo valor.

### `avisos` — 🟠 tem dois, falta o resto

Já dele: **a estrutura não é muito boa**; e **existe uma trilha mais perigosa, que sobe o arco —
ele não foi** (*"não sou tão aventureiro"*).

**Falta:** o que mais pode dar errado. E sobre o arco, pedi pra ele avisar **sem falar por
experiência que não tem** — ver [[nao-inventar-fatos-de-roteiros]]; a régua vale pra ele também,
e ele mesmo demarcou o limite.

### `condicao` — 🟠 só um dos quatro números

- `regra.janela_passado_horas` = **3** — de *"é melhor ir se não tiver chovido por 3 horas"*.
  ⚠️ **Diferente da Rampa, que é 6.** Não copie a Rampa por reflexo.
- **Faltam:** `janela_previsao_horas` (ele só falou do passado — **não suponha que é 3
  também**), `limiar_mm`, `coords` da condição (pode ser o mesmo ponto do trajeto, mas é
  pergunta dele: é essa coordenada que planta o pin da home), `regra_texto` e `ressalva_proxy`.

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

## O que NÃO foi perguntado ainda

- **`discriminador`** inteiro (`formato`, `como_ler`, `permissao_abortar`) — bloco 5.
  🟠 **Candidato já na mão:** *"o portão pode estar fechado, pode abrir tranquilamente"* é uma
  checagem de entrada, e pode ser `como_ler` em vez de (ou além de) `acesso`. Pergunte, não
  decida.
- **`modos`** — a pergunta mais aberta do questionário. Na Rampa é `["condicional"]`. A Pedra
  Furada também tem regra de chuva, então `condicional` é tentador — **e é exatamente por isso
  que não se preenche sozinho.**

---

## Detalhes novos que ele lembrou fora de ordem — 🔴 NÃO PERCA

Vieram soltos no fim de uma resposta, e **nenhum tem campo óbvio**. As duas propostas abaixo
foram feitas a ele e **ele ainda não respondeu**:

1. **São 360 degraus de escada de pedra, e é confortável subir.** Proposto pra `nota` do ponto.
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
