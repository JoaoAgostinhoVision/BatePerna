---
titulo: "Teste de padrão — Salvador de transporte público (4º roteiro, roteiro-MÉTODO / urbano)"
data: 2026-07-27
metodo: superpowers:brainstorming (4º roteiro real, escolhido para ESTENDER a taxonomia mirando o fork deferido "logística / perfil B sem carro")
status: DESCOBERTA ESTRUTURAL — não nasceu um modo #5; nasceu (1) a COMPOSABILIDADE da taxonomia R1 (modos empilham) e (2) uma ESPÉCIE NOVA de roteiro (o roteiro-método). Testou e MOVEU a fronteira urbana do produto. Campos do roteiro não exaustivamente preenchidos (cumpriu papel de TESTE, não de catálogo)
relacionado:
  - ./natuba-mecanica-de-confianca-2026-07-14.md       (1º roteiro, exploratório — gerou o modelo)
  - ./monte-das-tabocas-teste-de-padrao-2026-07-22.md   (2º roteiro, confirmatório — graduou R1/R2/R3)
  - ./rampa-do-pepe-modo-condicional-2026-07-26.md       (3º roteiro, extensão — modo de falha #4 condicional)
  - ../bateperna-modelo-e-requisitos.md                 (doc autoritativo — atualizado para v1.2 com este roteiro)
---

# Teste de padrão — Salvador de transporte público (Salvador, BA)

> **Como retomar:** Natuba foi EXPLORATÓRIO (gerou o modelo). Monte das Tabocas foi CONFIRMATÓRIO
> (graduou R1/R2/R3). Rampa do Pepe foi de EXTENSÃO (modo condicional #4). Este 4º roteiro foi
> escolhido para atacar o **fork deferido** — logística pesada / perfil (B) sem carro — e acabou
> fazendo algo maior que estender a lista de modos: revelou que a taxonomia R1 é **composável** e
> que existe uma **espécie nova de roteiro** (o roteiro-método). Também foi o **1º roteiro urbano**,
> e por isso o 1º a **testar a fronteira do produto** em vez de só empilhar catálogo.

**Por que este roteiro:** os três roteiros anteriores eram todos rurais/off-map ("a estrada que some
do mapa"), todos de carro particular. Faltava testar o fork que o Natuba deixou deferido — uma
viagem **sem carro seu**, onde a graça (e a cilada) mora na **malha de transporte**. Salvador
encaixa: João chegou de avião, tinha gastado muito na passagem, e fez a cidade inteira de
**metrô + BRT + estação da Lapa**, economizando ~R$400 de Uber.

---

## 🗺️ O roteiro em uma linha

Salvador de avião, orçamento apertado depois da passagem. Ibis Budget perto do Iguatemi (escolhido
**porque** está no metrô), metrô direto pro hotel (~R$70 de Uber poupados), metrô até a estação da
Lapa pra visitar o Centro (~R$50), BRT pela beira-mar da Pituba (R$2,90 — **melhor que qualquer city
tour**), todos os shoppings de metrô. No fim, ~R$400 economizados **só de mobilidade** — e uma
cidade vista pelo jeito que o morador vê, não pelo banco de trás de um Uber.

---

## 💡 A descoberta central: a taxonomia R1 é COMPOSÁVEL

Até aqui, cada roteiro tinha **um** modo de falha dominante (Natuba #1, MDT #2 e #3 em campos
separados, Rampa do Pepe #4). A pergunta natural era "qual é o **modo novo** de Salvador (#5)?".

**Não é modo novo. É a descoberta de que os modos EMPILHAM.** O forasteiro em Salvador falha por
**dois modos ao mesmo tempo**, na mesma ficha:

- **Modo #2 (desistência/permissão):** na dúvida se a malha funciona / é segura, o turista chama
  Uber "por garantia" — o falso-aborto do transporte. O fosso é **tranquilizar**: "dá pra fazer
  Salvador inteira de metrô/BRT, é tranquilo".
- **Modo #3 (chegada oca / significado):** o Google Maps enxerga o BRT da Pituba como um trecho
  A→B. Só quem foi sabe que **aquilo é o passeio** — a beira-mar por R$2,90. O fosso é
  **interpretação**: sem ela, você anda no BRT sem saber que está num city tour, ou nem pega.

Então a taxonomia R1 ganha uma propriedade nova: **modos se compõem.** E há uma **regra escondida
que vale ouro**:

> **A composição é LIMPA quando os toms alinham; é uma MINA quando se opõem.**
>
> #2 quer *acalmar* e #3 quer *dar significado* — os dois são a mesma família de mensagem: **"boa
> notícia que o forasteiro não sabe"** (segue que é tranquilo + olha que isto aqui é o prêmio). Por
> isso empilham sem atrito. Compare com **#2 + #4**: um quer acalmar, o outro quer avisar — **toms
> opostos** (ver Rampa do Pepe). Compor esses dois seria perigoso: a ficha teria que acalmar e
> avisar ao mesmo tempo. Isso **afia o REQ-3** de novo: declarar o *conjunto* de modos exige checar
> a **compatibilidade dos tons**.

---

## 🏙️ A fronteira do produto se moveu: nasce o ROTEIRO-MÉTODO

Salvador é **urbano** — capital, metrô, shopping. Os três anteriores eram off-map, e a alma deles
(R3) era a **remotidão** (P14: "jamais sanitizar o off-map"). Uma capital com metrô é o **oposto**
disso. Isso obrigou uma decisão de produto: **o BatePerna faz urbano?**

O problema concreto: os R$400 economizados são **fungíveis**. "Fazer uma capital de transporte
público" funciona no Rio, em SP, em Fortaleza. Pelo razor da alma (**R3**: a alma é o
**não-fungível**), Salvador *falharia* o teste — o hack é replicável, logo não teria alma.

**Decisão do João: A ancorado em C.** O produto admite uma **espécie nova de roteiro**, mas cada
instância continua obrigada a pousar no não-fungível:

- **Roteiro-lugar** (Natuba, MDT, Rampa do Pepe): *"vá AQUI"* — o valor é o lugar específico.
- **Roteiro-método** (Salvador): *"aplique ESTE padrão"* — o valor é uma **estrutura transferível**,
  mas **instanciada num lugar real e ancorada no que só ali existe** (BRT beira-mar da Pituba,
  metrô até a Lapa pro Pelourinho a pé, Ibis no Iguatemi como nó).

**R3 se generaliza sem afrouxar:** o não-fungível (a alma) pode ser o **método** OU o **lugar** — mas
**toda instância, das duas espécies, ainda precisa de uma âncora não-fungível**. Um "método" sem
âncora vira dica de blog = Nível A = **não entra**. A parte C vira um **guarda-corpo anti-fluff**: é
o que impede o roteiro-método de diluir em conteúdo genérico de agregador.

---

## 🔑 O fosso Nível B sobrevive ao Google Maps — em 3 pedaços

Teste adversarial (o mesmo que a gente fez com o Natuba): o Google Maps **já faz rota de transporte
público**. Ele te diz "pegue a Linha 1 até o Iguatemi, depois BRT". Isso é **Nível A** — não é
fosso. Se a viagem toda cabe no Maps, o BatePerna não agrega. O que sobra de Nível B:

1. **O hotel como nó de mobilidade (camada de planejamento).** Escolher o Ibis Budget *porque* ele
   está no metrô decide a economia da viagem **inteira**. O Maps te roteiriza *depois* que você já
   escolheu onde ficar; ele nunca diz "reserve aqui pra economizar a semana toda". Planejamento, não
   roteamento → **Nível B**.
2. **O BRT como city tour, não como transporte (camada de significado — ecoa #3).** O Maps vê um
   trecho A→B. Só quem foi sabe que aquilo é o prêmio. Interpretação → **Nível B**.
3. **A permissão pro forasteiro, com dentes (camada de segurança — ecoa #2).** Ver abaixo. É o
   pedaço mais forte e o que o João acrescentou por último → **Nível B**.

---

## 🛡️ O achado que amarra tudo: a permissão #2 ganha DENTES (segurança por baixo perfil)

O modo #2 (tranquilizar) tem um risco crônico: virar **platitude oca** — um "relaxa, confia em mim"
sem lastro. Salvador cura isso.

O método de transporte não só economiza e mostra a cidade — ele deixa o turista **menos visado** que
alugar carro e estacionar no centro histórico. **Carro alugado parado no Pelourinho grita "turista,
me assalta"; sumir no metrô/BRT é camuflagem.** O Google Maps nunca conta isso. Três desdobramentos:

1. **A ignorância estraga TRÊS pontas, não duas.** A leitura inicial ("carteira + experiência")
   subestimou: a mesma ignorância (não conhecer a malha local) custa **dinheiro** (carteira), **a
   melhor forma de ver a cidade** (experiência) e **te expõe ao crime** (segurança). O método é um
   **de-risk triplo**. (Paralelo estrutural com a Rampa do Pepe: lá **uma condição** — chuva —
   estragava **duas** pontas, acesso e vista; aqui **uma ignorância** estraga **três**.)
2. **A permissão #2 passa a ser MERECIDA, não afirmada.** "É tranquilo" sozinho é oco. "É mais
   seguro **porque** você fica menos visado" tem **mecanismo concreto**. O Nível B é o que **lastreia
   a tranquilização** — antídoto direto pro risco de platitude do modo #2.
3. **O urbano RESSUSCITA o eixo-crime que o rural tinha aposentado.** No Campo 4 (P10) o João
   definiu que o "dente 3" **não** era medo de crime ("não me senti ameaçado no caminho") — isso
   valia pro off-map. Na capital, o **alvo-turista volta a ser um eixo real**, e o método é o que o
   neutraliza. Achado **consistente com o escopo**: roteiro-urbano reabre a dimensão de segurança que
   o roteiro-rural dispensava.

---

## 💰 Custo: o 1º roteiro onde o dinheiro é PROTAGONISTA (aposta = placar)

Nos roteiros anteriores o custo era **raso** (Natuba: só de-risk da carteira + tag por parada). Em
Salvador ele é o protagonista — mas **não como fonte do fosso**. O fosso são os modos #2+#3; o
dinheiro é onde eles **viram número**:

- **Custo é a APOSTA e o PLACAR — a mesma moeda vista dos dois lados.** Você aposta R$400 (se falhar
  os modos, chama Uber e paga) e o placar mede se ganhou ("economizei R$400"). Aposta e placar são o
  **mesmo fato**.
- Isso **refina REQ-2/REQ-6:** o campo custo pode ser o **termômetro** do fosso sem ser o **lugar**
  dele. Relevo variável (R2) em ação: em Salvador o custo é o campo que **grita**, mesmo com o fosso
  morando em #2+#3.

---

## 🧩 O artefato que Salvador doa: a ficha de DUAS CAMADAS

Cada roteiro deixou um artefato concreto (Natuba: cadeia de waypoints; Rampa do Pepe: regra de
invalidação). O roteiro-método tem uma tensão nova — **o método é reusável entre cidades, mas a
âncora é local** — e a resolve com **duas camadas** (decisão do João, opção a):

- **Card de MÉTODO (herdável, transferível entre cidades).** Ex.: *"Capital de transporte público:
  (1) hospede-se num nó da malha — hotel econômico colado no metrô; (2) trate a linha cênica como
  passeio, não como deslocamento; (3) ande na malha local — economiza, é o passeio, e te tira do
  radar do crime (menos visado que carro alugado no centro histórico)."* Este card **se herda** para
  Rio, Fortaleza, Recife etc.
- **Card de ÂNCORA / instância (local, não-fungível).** Ex. Salvador: *Ibis Budget no Iguatemi (o
  nó); BRT beira-mar da Pituba (a linha-passeio); metrô até a Lapa → Pelourinho a pé (o
  não-fungível).* É o que prova a instância e a impede de virar dica genérica.

O card de método é uma peça de trust-data que **se herda**; o card de âncora é o que **aterra** cada
instância no razor da alma (R3).

---

## ✅ O que este roteiro fez com o modelo

| Item | Resultado |
|------|-----------|
| **R1** (taxonomia de modos de falha) | **NOVA PROPRIEDADE: composabilidade.** Modos empilham (Salvador = **#2 + #3**). Não nasce modo #5. Regra: composição **limpa quando os toms alinham**, **mina quando se opõem** (#2+#4). |
| **REQ-3** (declarar o modo) | **EVOLUÍDO** — de "declare *o* modo" para "declare o **conjunto** de modos" + checar **compatibilidade de tom** entre os modos compostos. |
| **R3** (razor da alma) | **GENERALIZADO** — nasce a espécie **roteiro-método** ao lado do **roteiro-lugar**. O não-fungível pode ser o **método** OU o **lugar**; toda instância ainda **exige âncora não-fungível** (guarda-corpo anti-fluff). |
| **REQ-1** (ficha) | **ARTEFATO NOVO** — ficha de **duas camadas** para roteiro-método: *card de método herdável* + *card de âncora/instância*. |
| **REQ-2 / REQ-6** (custo / tag grátis-pago) | **AFIADO** — 1º roteiro com **custo protagonista**; o custo pode ser o **termômetro** do fosso (aposta = placar), não a fonte. |
| **REQ-7** (camada que equipa) | **CONFIRMADO + AMPLIADO** — a camada que equipa agora inclui **segurança por baixo perfil** (andar na malha local reduz exposição ao crime). |
| **Eixo segurança / crime** | **REABERTO no urbano** — o alvo-turista, aposentado no rural (P10), volta a ser um eixo real na capital; a permissão #2 ganha **dentes** (mecanismo concreto, não platitude). |
| **Escopo do produto** | **FRONTEIRA MOVIDA** — o BatePerna passa a admitir **urbano**, na forma de roteiro-método ancorado. 1º roteiro que testou o limite em vez de estender o catálogo. |

---

## ▶️ Abertos / próximos

- **Composabilidade da taxonomia é nova e pouco explorada.** Só temos **um** exemplo de composição
  (#2+#3, toms compatíveis). Falta um roteiro que force a composição **perigosa** (toms opostos,
  ex.: #2+#4 — uma rota que precise acalmar E avisar ao mesmo tempo) pra ver como a ficha resolve o
  conflito de tom. **Candidato mais forte a próximo teste.**
- **A espécie roteiro-método precisa de um 2º exemplo pra confirmar** (como Natuba precisou do MDT).
  Uma 2ª capital instanciando o mesmo card de método (Recife? Fortaleza?) confirmaria que o card
  **realmente se herda** e que a âncora local basta pra passar o R3.
- **O fork original (perfil B / logística pesada) ficou só PARCIALMENTE tocado.** Salvador é sem
  carro, mas é **urbano e de baixo risco logístico** (malha densa, tudo conecta). A logística
  **pesada** de verdade — travessia com pernoite, casar barco+van em janela apertada, ficar preso se
  perder a conexão — **ainda não foi testada**. Continua candidato a um roteiro futuro.
- **Como as duas camadas (método + âncora) vivem no modelo/tela** entra na fila das decisões abertas
  de UX (irmã de L2/L3/L4/L5): como a ficha declara "isto instancia o método X" e linka as irmãs
  entre cidades.
- **Campos não-preenchidos de Salvador** (envelope temporal, alma detalhada da cidade além da
  mobilidade): não catalogados — o roteiro serviu de TESTE, não de ficha. Dá pra completar se virar
  roteiro real.
