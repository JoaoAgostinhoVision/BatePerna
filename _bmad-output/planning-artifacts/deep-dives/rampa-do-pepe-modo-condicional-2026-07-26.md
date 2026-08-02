---
titulo: "Teste de padrão — Rampa do Pepe (3º roteiro, modo de falha CONDICIONAL)"
data: 2026-07-26
metodo: superpowers:brainstorming (3º roteiro real, escolhido para ESTENDER a taxonomia de modos de falha do R1)
status: MODO NOVO CONFIRMADO — nasce o modo de falha #4 (janela condicional / armadilha intermitente), o 1º DINÂMICO. Evolui REQ-8/9, afia REQ-5/REQ-10, reforça R1/REQ-3. Campos do roteiro não exaustivamente preenchidos (cumpriu papel de TESTE, não de catálogo)
relacionado:
  - ./natuba-mecanica-de-confianca-2026-07-14.md      (1º roteiro, exploratório — gerou o modelo)
  - ./monte-das-tabocas-teste-de-padrao-2026-07-22.md  (2º roteiro, confirmatório — graduou R1/R2/R3)
  - ../bateperna-modelo-e-requisitos.md                (doc autoritativo — atualizado com este roteiro)
---

# Teste de padrão — Rampa do Pepe (Taquaritinga do Norte, PE)

> **Como retomar:** Natuba foi EXPLORATÓRIO (gerou o modelo). Monte das Tabocas foi
> CONFIRMATÓRIO (graduou R1/R2/R3). Este 3º roteiro foi de EXTENSÃO: escolhido de propósito
> para atacar um modo de falha que os dois anteriores não tocam — a **sazonalidade do acesso**.
> Ele estendeu a taxonomia do R1 com o **primeiro modo dinâmico** e evoluiu a mecânica de
> confiança. Um 4º roteiro, se vier, deveria mirar outro modo ainda ausente (ex.: logística
> pesada / perfil (B) sem carro — o fork deferido do Natuba).

**Por que este roteiro:** os três modos de falha que já tínhamos são **estáticos** — propriedades
fixas da rota (Machados é sempre a curva errada; a estrada do MDT sempre parece abandono; a batalha
sempre precisa de contexto). Faltava testar uma rota cujo perigo **liga e desliga no tempo**. A
Rampa do Pepe é exatamente isso: uma estrada de barro que **só dá pra ir quando não choveu**.

---

## 🗺️ O roteiro em uma linha

Rampa do Pepe (Taquaritinga do Norte, PE) — mirante/rampa de voo com **vista maravilhosa**, no fim
de uma **estrada de barro triste** que **só é segura na seca**. Vai-se **de carro**. Você **não se
perde** (o caminho é o caminho) e **não duvida** — mas se chover, o barro **te engole**: o carro do
João **atolou**, e ele só saiu porque **uns pedreiros apareceram e empurraram** (sorte, não
infraestrutura). E, no mesmo golpe, **quando chove a vista some**. Uma condição só (chuva recente)
estraga **as duas pontas**: o acesso *e* o prêmio.

---

## 💡 A descoberta central: o modo de falha #4 é DINÂMICO

Os três modos anteriores são estáticos — leia a rota certa **uma vez** e está resolvido. A Rampa do
Pepe é o primeiro **condicional**: a mesma estrada é tranquila na seca e uma armadilha na chuva. O
inimigo não é o **espaço** (você não se perde, modo #1) nem a **sua cabeça** (você não duvida, modo
#2) — é o **tempo/condição**: você foi na hora errada da *semana/estação*, e o sinal que denuncia
isso (choveu? o barro tá mole?) só quem é de lá sabe ler.

Isso parte a taxonomia do R1 em **duas famílias**:

- **Armadilhas estáticas** (#1, #2, #3) — leia a rota **uma vez**; o trust-data é permanente.
- **Armadilhas condicionais** (#4) — leia a **condição toda vez, antes de ir**; o trust-data é uma
  **regra** que você reavalia contra o mundo a cada viagem.

---

## 🔑 O achado mais forte: a condição se PARTE em Nível A e Nível B

Aqui o Nível A e o Nível B, que antes moravam em campos separados, se **combinam num só campo** pela
primeira vez:

- **O VALOR da condição é Nível A** — "choveu nos últimos 3 dias?" qualquer um checa num app de
  tempo. Verificável remoto. **Não é fosso.**
- **A REGRA (qual condição importa + onde fica o corte) é Nível B** — só quem atolou ali sabe que
  *aquele* barro específico vira armadilha, e sabe o limiar ("1 dia de sol já seca" vs. "precisa de
  uma semana firme"). Nenhum app de tempo conta isso. **É 100% fosso.**

**O fosso não é ler a condição — é saber qual condição importa e onde fica o corte.**

---

## ⚙️ O que isso faz com a mecânica de confiança (evolui REQ-8/9)

A mecânica atual assume que a confiança esfria **devagar, com o tempo**, e "Confirmar" a reesquenta.
Uma rota condicional **fura** essa premissa: alguém Confirma na terça (seco); chove na quinta; na
sexta a confirmação está **fresca pelo relógio (2 dias!)** e **mentirosa na prática**. O decaimento
lento não protege ninguém — o gatilho que devia esfriar a rota é a **chuva**, não o calendário.

**Decisão (híbrida, escolhida pelo João):**

1. **A confirmação carrega a condição** — não é um selo genérico, é *"confirmado, e estava seco"*.
   Vira dado condicional: "confiável **se** seco".
2. **O decaimento ganha um gatilho rápido** — a rota declara uma **condição de invalidação**
   (ex.: "choveu > X em N dias") que **derruba a confiança na hora**, por cima do decaimento lento.
3. Generalização: a confiança deixa de ser `f(tempo desde a confirmação)` e vira
   **`f(tempo, E a condição sob a qual foi confirmada ainda vale)`**. As rotas estáticas são só o
   caso particular em que não há condição — o decaimento lento sozinho basta.

---

## 🤝 Responsabilidade da checagem: HÍBRIDO (REQ-7 aplicado a uma condição que se move)

Escolhido pelo João entre "app decide sozinho" / "app só ensina" / **híbrido**:

- O app **puxa a previsão (Nível A) e dá um sinal/alerta** ("choveu por aí, cuidado"), mas
  **não decide** por você.
- A **régua fina e o go/no-go final ficam com o usuário**, guiados pela regra Nível B que a ficha
  ensinou.
- Isso **não** é um mecanismo novo: é o **próprio REQ-7 (a camada que equipa)** aplicado a uma
  condição dinâmica. Igual ao "BatePerna monta a rota, Waze navega" → aqui "BatePerna sinaliza a
  condição e ensina a régua, o usuário decide". **Co-piloto, nunca piloto automático** — o que
  mantém a Rampa do Pepe **coerente** com os outros três modos, não um caso especial.
- **Ressalva assumida:** previsão num ponto ≠ "aquela estrada específica encharcou" (microclima,
  drenagem). Por isso o app **sinaliza** mas não **crava** — e o limiar Nível B ainda precisa de um
  humano pra calibrar.

---

## 🗣️ A ficha ou ACALMA ou ALERTA — e são OPOSTOS (reforça R1/REQ-3)

O achado que amarra tudo:

- No **Monte das Tabocas** (modo #2), o fosso era **tranquilizar**: *"a estrada é feia, mas segue —
  é assim mesmo, lá em cima é tranquilo, tem quem te ajude."* Acalmar impede o falso-aborto.
- Na **Rampa do Pepe** (modo #4), tranquilizar seria uma **mentira perigosa**. O João só se salvou
  porque uns pedreiros apareceram — **sorte, não infraestrutura**. A mensagem honesta é o oposto:
  *"se choveu, não vá; e se for, não vá sozinho, não conte com ajuda."*

O **mesmo instinto editorial** ("deixa eu acalmar o leitor") que é **certo** no modo #2 é **mortal**
no modo #4. Prova operacional de que **declarar o modo (REQ-3) não é burocracia**: o modo decide se
o texto deve **acalmar ou avisar** — e escolher errado dá o **conselho contrário** ao que salva.

---

## ✅ O que este roteiro fez com o modelo

| Item | Resultado |
|------|-----------|
| **R1** (taxonomia de modos de falha) | **ESTENDIDA** — nasce o modo **#4 (janela condicional)**, o 1º **dinâmico**; a taxonomia ganha **duas famílias** (estático vs. condicional) |
| **REQ-8/9** (decaimento + Confirmar) | **EVOLUÍDO** — confirmação **condicional** + **gatilho de invalidação** por evento; confiança = `f(tempo, condição-ainda-vale)` |
| **REQ-10** (Nível A vs B) | **AFIADO** — 1ª vez que A e B se **combinam num campo**: valor da condição = A, regra/limiar = B; o fosso é a **regra** |
| **REQ-5** (envelope temporal) | **AFIADO** — o "QUANDO" tem **duas escalas**: micro (hora de sair, dentro do dia) + **macro** (condição/estação — "só na seca") |
| **REQ-7** (camada que equipa) | **CONFIRMADO** — o híbrido é o REQ-7 aplicado a condição dinâmica; app equipa, não decide |
| **R1/REQ-3** (declarar o modo) | **REFORÇADO** — o modo declarado define o **tom** da ficha (acalmar vs. avisar); são opostos |
| **REQ-11/12** (risco do fundador) | **TOCADO** — rotas condicionais podem **auto-esfriar** lendo o Nível A (a chuva confirma sozinha) → afrouxam a dependência do fundador pra essa classe; o limiar B ainda precisa de humano |

---

## ▶️ Abertos / próximos

- **Taxonomia do R1 segue aberta.** Já temos 4 modos (3 estáticos + 1 condicional). Um 4º roteiro
  deveria mirar um modo ainda ausente — o candidato mais forte é **logística pesada / perfil (B) sem
  carro** (fork deferido do Natuba, que quebraria o artefato "só asfalto pra carro" do REQ-4).
- **A "condição de invalidação" como artefato declarável.** Cada rota condicional passa a ter uma
  regra máquina-checável (ex.: "invalida se chuva > X em N dias"). Ainda não decidido como isso vive
  na ficha/modelo — vira irmão das decisões abertas L2/L3/L4.
- **Auto-esfriamento pode criar dependência de dados** (fonte de previsão confiável, microclima).
  Levantado, não aprofundado — dá pra testar se um dia virar plano.
- **Campos não-preenchidos da Rampa do Pepe** (custo, alma temática detalhada, envelope micro): não
  catalogados — o roteiro serviu de TESTE do modo condicional, não de ficha. Dá pra completar se
  virar roteiro real.
