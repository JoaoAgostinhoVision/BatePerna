# Pesquisa externa sobre as três fichas — 2026-09-11

> 🔵 **TUDO NESTE ARQUIVO É RASCUNHO AZUL.** Nada aqui é fato, nada vai pra tela, e nada entra em
> ficha antes de ele confirmar. Quando fonte externa discorda dele, o registro é **"conflito"** —
> nunca "correção". A palavra dele continua ganhando da internet; o que a pesquisa faz é dizer
> **onde perguntar**.
>
> **Pedido dele, literal:** *"tenta verificar as informações e tente formular de uma forma melhor,
> procura isso em sites e outros conhecimentos ao invés de somente meu conhecimento empírico"*.

---

## 0. ✅ AS RESPOSTAS DELE — 2026-09-11, no mesmo dia

> 🔴 **E A FRASE QUE EXPLICA O RESTO, e é dele:** ***"a rampa está em reforma, por isso acho que
> as coisas tão mudando"***.
>
> Isso reorganiza a pesquisa inteira. Os sinais que eu tinha tratado como **conflito entre fontes**
> — o guia de 2014 dizendo "fase final de pavimentação", o CNPJ novo, a marca "Eco Park", os
> sábados e domingos — não são fontes discordando. São **o mesmo lugar mudando ao longo de dez
> anos**, e ele sabe disso porque conhece o lugar.
>
> ⚠️ **"acho que as coisas tão mudando" é HEDGE, e não vira veredito meu.** O que é FATO DELE aqui
> é *"a rampa está em reforma"*. Nada disso foi à tela: o app não diz uma palavra sobre reforma.

| pergunta | resposta dele | o que foi feito |
|---|---|---|
| 1. A Rampa abre a semana toda ou só sáb/dom? | *"pode atualizar a hora pela internet"* | ✅ `dias: ["sab","dom"]` entrou na ficha, com a procedência declarada |
| 2. A subida da serra é barro ou já tem asfalto? | ***"a rampa ainda é de barro"*** | ✅ nada muda — `piso: barro` confirmado por ele, a fonte de 2014 estava velha |
| 3. "Chão batido" vira valor da escala de piso? | — | ⏳ **não respondida.** Continua na mesa |
| 4. O trecho de terra da Véu firma rápido? | — | ⏳ **não respondida.** Continua na mesa |
| 5. O portão da Pedra Furada: 5h ou 7h? | ***"a pedra furada pode seguir o meu mesmo"*** | ✅ nada muda — a ficha fica com **5h**, palavra dele ganhando do site |

🔵 **A consequência da reforma, e ela é do app, não dele:** o `dias` da Rampa é, por definição
dele, **um dado em movimento**. O app não tem como dizer "isto pode estar mudando", e inventar essa
frase seria prosa minha sobre um lugar real. Fica anotado: **se a Rampa reabrir com outro regime,
é uma linha no JSON.**

## 1. A contradição da Pedra Furada — a pergunta antiga era ruim, e dá pra provar

**A pergunta que estava na mesa:** *"num dia de chuva, o que aquele chão batido faz? A frase do
barro serve, ou mente?"*

🔴 **Ele já respondeu isso três vezes, na própria ficha:**

| campo | o que já está escrito |
|---|---|
| `acesso` | "Se choveu, espera passar umas 3 horas — **molhado, o chão batido escorrega e dá pra atolar**." |
| `condicao.regra_texto` | "**o chão batido molhado escorrega e dá pra atolar carro comum**" |
| `voz` | "É estrada de chão batido e plana. Se choveu, espera passar umas 3 horas." |

A pergunta pedia de volta o que já estava dado. **A causa real está no código, e se mede sem ele.**

### A escala de piso não tem valor pra "chão batido"

`src/lib/piso.ts`: `PISOS = ["barro", "paralelepipedo", "asfalto-esburacado", "asfalto-tapete"]`.
**Não existe opção pra estrada de terra não-argilosa.** A Pedra Furada foi marcada `barro` porque era
a única opção não pavimentada da lista. Daí a tela dizer, no dia de chuva, *"O barro segura água"*
(`CHUVA_NO_PISO`, frase de MATERIAL) contra o *"o chão batido retém menos água que o barro"*
(`secaRapido`, frase do LUGAR) que ela mesma diz no dia seco.

**A contradição não é dele. É da escala.**

### Fonte externa: "chão batido" é classe distinta e reconhecida

- **DNIT** classifica revestimento de rodovia como **leito natural**, **revestimento primário**
  (agregado granular — cascalho, saibro ou piçarra) ou **pavimentada**. São classes separadas, e
  nenhuma delas é "barro".
- **Serviço Geológico do Brasil (Geossit)**, descrevendo o acesso à própria Pedra Furada:
  *"3,8 Km em asfalto e depois de dobrar à direita, mais **3,4 Km em estrada carroçável**"*.
- **Guia de viagem:** *"3,5 km pela rodovia pavimentada PE-217 e o restante por uma **estrada de
  terra em boas condições** até a entrada do parque"*.
- ⚠️ **Nenhuma fonte externa chama o acesso da Pedra Furada de barro.**

### A afirmação empírica dele é corroborada por levantamento de solo independente

| lugar | solo levantado | comportamento |
|---|---|---|
| **Venturosa** (Depressão Sertaneja, semiárido; granito do Batólito Alagoinha) | **Neossolo Litólico** (raso, pedregoso) e **Neossolo Flúvico** (mais profundo, **textura arenosa**) | drena |
| **Bonito** (brejo de altitude, 443 m, 700–1200 mm/ano) | **Argissolos Vermelho-Amarelos e Latossolos** | seguram água |

E a física geral bate: solo argiloso tem partícula < 0,002 mm, poros pequenos, **baixa
permeabilidade e alta retenção**; solo arenoso tem poros amplos, **seca rápido, não é pegajoso nem
plástico**. O *"retém menos água que o barro"* dele está tecnicamente certo — **e os dois lugares
têm solos genuinamente diferentes, enquanto o app chama os dois de `barro`.**

✅ **PERGUNTA REFORMULADA:** *"'Chão batido' pode virar um valor da escala de piso, ao lado de barro
e asfalto? E a frase de chuva dele seria a sua — 'molhado, o chão batido escorrega e dá pra atolar'?"*

---

## 2. O `secaRapido` que falta na Véu — a pergunta antiga pressupunha resposta

**A pergunta que estava na mesa:** *"num dia seco, o que o trecho de terra da Véu tem de bom — como
'a serra firmou' é pra Rampa?"*

**O defeito dela:** pressupõe que **existe** algo de bom a dizer. O campo `secaRapido` é sobre
RELEVO — por que o chão firma rápido *naquele lugar*: "Área alta, escorre rápido — a serra firmou"
(Rampa), "Área plana — o chão batido retém menos água que o barro" (Pedra Furada).

As fontes apontam pro contrário na Véu: Bonito é **brejo de altitude**, chove muito mais que
Venturosa, e o solo do município é **argiloso** (Argissolo/Latossolo). É plausível que o chão de lá
**simplesmente não firme rápido** — e aí o campo vazio já está certo e a resposta é **não escrever
nada**.

✅ **PERGUNTA REFORMULADA, com a saída de subtração à vista:** *"Depois da chuva, o trecho de terra
da Véu firma rápido como os outros dois, ou fica pesado por mais tempo? Se ficar, a ficha fica
calada mesmo — não tem o que escrever."*

---

## 3. TRÊS FUROS QUE A PESQUISA ACHOU E QUE NÃO ESTAVAM NA MESA

### 🔴 3.1 A Rampa do Pepê pode abrir só sábado e domingo — e a ficha não tem horário nenhum

A "Rampa do Pepê Eco Park" é hoje empresa registrada (**CNPJ 52.756.263/0001-29**, Sítio Cafundó,
Taquaritinga do Norte) e a descrição do perfil diz **"aberta a visitação aos sábados e domingos"**,
com agendamento por telefone.

`content/fichas/rampa-do-pepe.json` **não tem campo `horario`**. Como `fechadoAgora` só age quando o
campo existe, **numa quarta-feira seca o app diz "Pode ir"** — e a pessoa dirige 178 km até um
portão fechado.

**É a mesma família do caso das 18h da Véu, fechado em 2026-08-27.** ⚠️ A fonte é resumo de busca
sobre um perfil de rede social, não leitura direta — **confiança média**. Pede a palavra dele.

### 🟡 3.2 O portão da Pedra Furada: a ficha diz 5h, duas fontes dizem 7h

| fonte | horário |
|---|---|
| ficha (`acesso` + `horario.abre`) | **05:00**–17:00, "se estiver fechado quando você chegar, dá pra abrir tranquilamente" |
| guia de viagem | "O portão de acesso é aberto todos os dias, **das 7h às 17h**" |

**Não é erro dele necessariamente:** a própria frase ("dá pra abrir tranquilamente") descreve portão
sem guarita, e aí o horário de fato é o dele, não o do site. Mas hoje o app anuncia aberto às 5h30 e
vale ele saber que as fontes discordam.

### 🟡 3.3 A estrada da Rampa pode ter sido pavimentada — mas a fonte é de 2014

Guia de voo livre: *"a estrada de subida até a rampa está em **fase final de pavimentação**, e
qualquer carro em bom estado faz a subida"*. O texto de origem dessa descrição é de **26/11/2014** —
mais de dez anos.

Se hoje a subida for asfalto, a ficha **mais bem procedida do app** (`piso: barro`, *"molhou, não
vá"*, escolhida por ele entre três saídas em 27/08) estaria errada.

**A aposta é que a fonte está velha e ele está certo** — a fala dele é de agosto de 2026 e a dela é
de 2014, e pode ser outro trecho. Mas a pergunta é barata: *a subida da serra até a rampa é barro do
começo ao fim, ou já tem trecho asfaltado?*

---

## 4. O QUE BATEU CERTO

| ficha | fonte externa | veredito |
|---|---|---|
| Pedra Furada: entrada grátis | "A entrada é gratuita e livre, sem a necessidade de guia" | ✅ |
| Pedra Furada: 360 degraus | "escadaria de 360 degraus" | ✅ |
| Pedra Furada: "o passeio leva umas 2h" | "2 a 3h" | ✅ |
| Pedra Furada: chão batido plano até os pés da pedra | "estrada de terra em boas condições"; "estrada carroçável" (SGB) | ✅ |
| Pedra Furada: "pinturas rupestres e muita história de povos nativos" | "Pinturas rupestres da Tradição Agreste" (SGB) | ✅ |
| Véu de Noiva: R$ 10 por pessoa | "R$ 10,00 por pessoa" | ✅ |
| Véu de Noiva: "tem um trecho de terra no caminho" | "asfalto, com o último trecho em estrada de terra"; "~2 km" | ✅ |
| Véu de Noiva: fecha às 17h (abre 8h) | uma fonte diz **7h às 16h** | ⚠️ diverge |
| Véu de Noiva: `carroComum: true` | uma fonte diz "só com carro alto (e 4×4, dependendo da época)" | ⚠️ diverge |
| Véu de Noiva: "A maior cachoeira de Bonito" | fontes dizem "**a mais famosa**"; 32–33 m; Barra Azul tem 30 m; uma fonte diz 3 quedas, a maior de 15 m | ⚠️ não desmente, mas não é o que dizem |

---

## 5. O QUE EU **NÃO** ACHEI — e isso importa tanto quanto

- 🔴 **Nenhuma fonte menciona chuva, lama, barro ou atolamento na Pedra Furada.** Ele é a **única**
  fonte disso, e a ficha inteira se apoia nessa palavra. Certo pelas regras daqui — mas fica dito.
- Nenhum levantamento de solo **da estrada** de nenhum dos três. Os dados de solo são do
  **município**, não do trecho que se dirige.
- Nada sobre quanto tempo o chão leva pra firmar em lugar nenhum. **As 3h e as 6h continuam sendo só
  dele.**
- Preço atual da Rampa (a ficha diz R$ 5 no portão) — nenhuma fonte.
- Comprimento e condição do "trecho de terra" da Véu além de "~1 a 2 km".
- ⚠️ **Cinco páginas recusaram leitura direta (HTTP 403):** guia4ventos, recifepasseios, wikiloc,
  tripadvisor, pernambucoimortal. O que veio delas veio por **resumo de busca**, não por leitura da
  página — **confiança menor**, e está marcado onde importa (3.1 e 3.3).

---

## 6. O QUE SOBROU DAS CINCO PERGUNTAS

✅ Três fechadas em 11/09 (ver o bloco 0). **Duas continuam na mesa, e as duas são de PRODUTO, não
de logística** — nenhuma delas impede o app de funcionar hoje:

1. 🔵 **"Chão batido" vira um valor da escala de piso?** Fecha a contradição da Pedra Furada, e a
   frase de chuva do piso novo já é palavra dele: *"molhado, o chão batido escorrega e dá pra
   atolar"*.
2. 🔵 **O trecho de terra da Véu firma rápido, ou fica pesado?** — e **"fica pesado" significa não
   escrever nada**: a ficha continua calada, de propósito.

⚠️ **Ele pediu em 11/09 pra parar de ser entrevistado:** *"o principal, não é minhas informações
agora, o foco é o aplicativo"*. As duas acima ficam registradas **como opção dele quando quiser** —
não como pergunta pendente que trava rodada nenhuma.

---

## 7. FONTES

**Pedra Furada / Venturosa**
- Serviço Geológico do Brasil — Geossit, geossítio 1013: https://www.sgb.gov.br/geossit/geossitios/ver/1013
- Viagens e Caminhos: https://www.viagensecaminhos.com/pedra-furada-venturosa/
- Governo Municipal de Venturosa: https://venturosa.pe.gov.br/pontos-turisticos/

**Rampa do Pepê / Taquaritinga do Norte**
- Guia 4 Ventos: https://guia4ventos.com.br/taquaritinga-do-norte-rampa-do-pepe-pe/ *(403 — só resumo)*
- Imprensa Oficial de Taq. do Norte, 26/11/2014: https://imprensataqdonorte.blogspot.com/2014/11/rampa-do-pepe-atracao-turistica-de.html
- CNPJ 52.756.263/0001-29: https://cnpj.ohub.com.br/cnpj/52756263000129

**Véu de Noiva / Bonito**
- Trip.com: https://www.trip.com/travel-guide/attraction/bonito/cachoeira-veu-da-noiva-58307139/
- Pernambuco Imortal: https://pernambucoimortal.com/ecoturismo/cachoeira-veu-da-noiva *(403 — só resumo)*
- Ecosafari — cachoeiras de Bonito: https://ecosafari.com.br/2023/06/cachoeiras-de-bonito-7-maravilhas-de-pernambuco/

**Solos e estradas (o "outro conhecimento" que ele pediu)**
- DNIT ES 445/2023 — revestimento primário: https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/ipr/coletanea-de-normas/coletanea-de-normas/especificacao-de-servico-es/dnit_445_2023_es.pdf
- DNIT — classificação de revestimento (leito natural × revestimento primário × pavimentada): http://obahia.dea.ufv.br/layers/geonode:trecho_rodoviario_dnit/metadata_detail
- Embrapa — caracterização morfológica de solos, Venturosa-PE: https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1176712/1/Caracterizacao-morfologica-de-solos-em-um-agroecossistema-2025.pdf
- Embrapa — textura do solo: https://www.webambiente.cnptia.embrapa.br/webambiente/wiki/doku.php?id=webambiente%3Atextura
- Brejos de altitude no estado de Pernambuco: https://revistaaprogeomg.org.br/index.php/margaridapenteadorevista/article/download/37/36/162
- Neossolos regolíticos do semiárido de PE (RBCS/SciELO): http://www.scielo.br/j/rbcs/a/ZxHkzvpLng8Z53qXKJ9Csqz/?lang=pt
- USP — defeitos em estradas não pavimentadas: https://teses.usp.br/teses/disponiveis/18/18137/tde-14012005-161818/publico/diss_cap5_.pdf
