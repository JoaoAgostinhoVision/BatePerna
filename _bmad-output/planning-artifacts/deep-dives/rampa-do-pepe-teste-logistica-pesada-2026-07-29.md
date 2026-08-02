---
titulo: "Rampa do Pepe revisitada — teste de logística pesada / perfil-B (7º toque)"
data: 2026-07-29
metodo: superpowers:brainstorming (retomada dos testes de ideia deferidos; teste #1 = logística pesada / perfil-B, ancorado na experiência de campo real do João na Rampa do Pepe)
status: NENHUM modo #5 — a taxonomia segurou. Mas AFIA REQ-5/REQ-9/REQ-10/REQ-12 (sub-tipo de aborto + regra binária conservadora + proxy falso-seguro). Não cria REQ novo. Modelo → v2.3. O teste perfil-B / multimodal SEM CARRO segue NÃO testado (a Rampa é rota de carro).
relacionado:
  - ./rampa-do-pepe-modo-condicional-2026-07-26.md          (o deep-dive original da rota — modo #4; este aqui é a REVISITA como teste de logística)
  - ./praia-do-sossego-composicao-perigosa-2026-07-27.md    (perigo-ponto / discriminador in-situ — o contraste que revela o sub-tipo de aborto)
  - ../bateperna-modelo-e-requisitos.md                     (doc autoritativo — atualizado com estes achados → v2.3)
  - Regra de trabalho: não inventar fatos de roteiros reais (memória) — este teste rodou 100% na experiência de campo do João
---

# Rampa do Pepe revisitada — teste de logística pesada / perfil-B

> **Como retomar:** ao fechar o escopo da Fase 1 (v2.2), sobraram 3 testes de ideia deferidos. O #1
> (logística pesada / perfil-B) era o candidato mais forte a um modo de falha novo (#5) e o que
> quebraria o artefato "só asfalto pra carro" (REQ-4). Ao buscar uma rota-âncora, o João **freou**:
> não tinha um roteiro na manga e não quis que eu inventasse fatos de lugares que não conheço (virou
> regra de trabalho permanente). Ele então ancorou o teste na **própria experiência real** de ter se
> dado mal na Rampa do Pepe. Este documento registra o que essa revisita fez — e **não fez** — com o
> modelo.

---

## 🗺️ O que o João viveu (fonte: campo, não invenção)

Contado por ele, sem preenchimento meu:

- **Entrada:** a previsão dizia **chuva leve**. Ele **não imaginou que o carro atolaria no barro** —
  leu "chuva leve" como tranquilo e foi.
- **A virada:** o mau pressentimento começou **logo ao entrar**, mas a chuva **não parou até ele
  voltar** e o **lamaceiro só piorou**. Não houve um ponto discreto de meia-volta — a rota **degradou
  continuamente** embaixo dele.
- **O atolamento:** atolou **de vez**, o carro **não se mexia**. Precisou de ajuda — chamou **uns
  pedreiros perto**, que empurraram e tiraram o carro. **~1 hora** de sofrimento.
- **O que teria mudado o jogo:** *"simplesmente não iria."*
- **A regra Nível B que ficou:** *"se houver chuva, não vá — pelo menos não de carro."*

---

## 💡 O achado que NÃO veio: não nasce modo #5

A aposta ao escolher este teste era que "logística pesada" pariria uma dimensão nova — algo como
**falha de encadeamento / extração** (você se compromete, a cadeia quebra, o problema vira *sair do
sufoco*). **O próprio dado do João mata a hipótese:** ele não disse "faltou saber tirar o carro do
atoleiro"; disse *"simplesmente não iria"*. O ouro estava na **decisão de não entrar**, não na
extração. Os pedreiros e a 1h foram **consequência**, não o fosso.

Logo: **a taxonomia R1 segurou.** Isto **reconfirma o modo #4** (janela condicional), não gradua um
#5. E — importante para não nos enganarmos — **o teste perfil-B / multimodal de verdade continua NÃO
testado**: a Rampa é rota **de carro**, então ela não exercita "sem carro / barco+van / janela de
conexão / ficar preso sem plano B". Esse fork segue aberto para uma rota que o João conheça de campo.

---

## 🔑 Os 4 achados que VIERAM (afiam, não criam)

### 1. Um sub-tipo de aborto dentro do #4 (afia REQ-9/L7 e REQ-5)

Só deu pra ver isto porque agora existe o **Praia do Sossego** (27/07) para contrastar — o deep-dive
original da Rampa (26/07) não tinha esse par. Dois formatos de aborto, conforme a **estrutura do
fosso**:

| | **Perigo-ponto** (Sossego) | **Rota-que-degrada** (Rampa do Pepe) |
|---|---|---|
| Onde mora o hazard | num **ponto discreto** (a poça) | na **rota inteira**, que piora com o tempo |
| Como se lê | **in-situ**, na hora, no ponto | no **céu / no pé da trilha**, antes de comprometer |
| Janela de aborto | **no ponto** — dá pra chegar, olhar e voltar | **colapsa para a ENTRADA** — depois de comprometido não há meia-volta (a chuva não para, o barro só piora) |
| Discriminador | cascata in-situ (ver fundo → memória do ponto → abortar) | decisão binária na entrada |

**Consequência:** o "discriminador" do REQ-9 não tem forma única. Para rota-que-degrada ele **não** é
"leia o hazard na hora" — é *"leia a condição no ponto de partida e decida, porque comprometeu, foi."*
E o REQ-5 (envelope temporal) ganha nuance: em rota-que-degrada, a **janela de aborto é a própria
entrada**, não um instante lá dentro.

### 2. A forma da REGRA depende da estrutura do fosso + da confiabilidade do proxy (corrige REQ-10)

O deep-dive original modelou a condição de invalidação como um **limiar** ("choveu > X em N dias"). A
regra real do João é **mais crua e mais segura**: *"se houver chuva, não vá."* **Binária, tolerância
zero.** Não é afinar limiar — é **bluntness deliberada como segurança**.

Por quê? Porque nesta rota se juntam três coisas: **(a)** o proxy Nível A é ruim (previsão num ponto ≠
aquele barro específico), **(b)** a falha é cara (1h, dependência de sorte/pedreiros) e **(c)** não há
aborto no meio. Quando esses três se somam, a régua fina **não compensa** o risco — a regra Nível B
racionalmente **colapsa num binário conservador**. Contraste com o Sossego, onde dá pra ler fino
in-situ e decidir por instância.

**Correção ao REQ-10:** a ficha não deve **fingir precisão** ("invalida se > X mm em N dias") quando a
regra honesta do fundador é *"qualquer chuva = não"*. A forma da regra (binária vs. limiar fino) é ela
própria um dado Nível B, e depende do trio acima.

### 3. O proxy Nível A é falso-seguro no limiar baixo (afia REQ-12)

A previsão dizia **chuva leve** e chuva leve **já bastou** para atolar. O modelo já dizia "céu seco ≠
estrada seca" (Sossego). Isto adiciona: a própria **categoria** "chuva leve" **sub-sinaliza
brutalmente** — a ficha condicional deve gritar *"aqui, chuva leve JÁ atola; não espere chuva forte"*,
não só "o proxy atrasa". É a mesma razão pela qual a regra (achado 2) vira binária.

### 4. Um eixo de MODO escondido no go/no-go (ponte para o perfil-B)

A lição não foi "não vá", foi *"não vá **de carro**."* O go/no-go carrega um **qualificador de meio de
transporte** — o **carro é o elo frágil**, e o hazard é **específico do modo**. É uma ponte fininha
para o teste perfil-B que ficou de fora: talvez REQ-4/REQ-5 precisem, um dia, de um "por qual modo".
Anotado como pista, não desenvolvido (precisa de uma rota multimodal real).

---

## ✅ O que esta revisita fez com o modelo

| Item | Resultado |
|------|-----------|
| **R1** (taxonomia) | **SEGUROU** — nenhum modo #5; heavy-logistics-via-carro reconfirma o #4. Perfil-B/multimodal segue não testado |
| **REQ-9 / L7** (discriminador) | **AFIADO** — dois formatos: **perigo-ponto** (in-situ, Sossego) vs. **rota-que-degrada** (na entrada, Rampa) |
| **REQ-5** (envelope temporal) | **AFIADO** — em rota-que-degrada a **janela de aborto = a entrada** (não há meia-volta no meio) |
| **REQ-10** (decaimento + invalidação) | **CORRIGIDO** — regra pode ser **binária conservadora** ("qualquer chuva = não"), não limiar fino, quando proxy ruim + falha cara + sem meia-volta |
| **REQ-12** (procedência / proxy) | **AFIADO** — o proxy é **falso-seguro no limiar baixo**: a categoria "chuva leve" já é armadilha; a ficha declara *quão pouco basta* |
| **REQ-4 / perfil-B** | **PISTA** — eixo de modo no go/no-go ("não de carro"); o carro é o elo frágil. Teste real de multimodal ainda pendente |

---

## ▶️ Abertos / próximos

- **Perfil-B / multimodal SEM carro ainda não testado.** Este era o alvo do teste #1 e **não** foi
  atingido — a Rampa é de carro. Segue como o candidato mais forte a um modo #5, mas só com uma rota
  que o João conheça de campo (regra: não inventar).
- **Par de composição novo** (#1+#4 / #3+#4) e **modo atômico #5** — os outros dois testes deferidos,
  intocados.
- **Regra de trabalho gravada nesta sessão:** não preencher fatos de roteiros reais que o Claude não
  conhece; ancorar no campo do João ou rodar em placeholder explícito.
