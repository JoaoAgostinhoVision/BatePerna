---
titulo: "Teste de padrão — Monte das Tabocas (2º roteiro confirmatório)"
data: 2026-07-22
metodo: superpowers:brainstorming (2º roteiro real, escolhido para ESTRESSAR o que o Natuba travou)
status: PADRÃO CONFIRMADO — P13 e P15 confirmados em 2 rotas; nasceu o P16 (modos de falha). Campos do MDT não foram exaustivamente preenchidos (o roteiro cumpriu o papel de TESTE, não de catálogo)
relacionado:
  - ./natuba-mecanica-de-confianca-2026-07-14.md   (o 1º roteiro, exploratório, que gerou o modelo)
  - ../briefs/brief-BatePerna2.0-2026-07-11/brief.md
---

# Teste de padrão — Monte das Tabocas

> **Como retomar:** o Natuba foi EXPLORATÓRIO (gerou o modelo). Este roteiro foi CONFIRMATÓRIO:
> escolhido de propósito por ser DIFERENTE do Natuba, pra ver o que quebra. O que sobreviveu virou
> requisito do produto (seção "Padrões graduados"). Se for pegar um 3º roteiro, o alvo é estender
> a taxonomia de modos de falha (P16).

**Por que este roteiro:** a regra do 2º roteiro é só valer se for diferente. O Monte das Tabocas
bate o Natuba em dois eixos opostos: **(1) o GPS pega direito** (no Natuba o fosso ERA a falha do
Maps) e **(2) a alma é a história/o lugar**, não a jornada. Se os padrões aguentassem uma rota
assim, seriam padrões de verdade — não coisas do Natuba.

---

## 🗺️ O roteiro em uma linha

Monte das Tabocas (Vitória de Santo Antão, PE) — **palco da batalha histórica**, com **vista
panorâmica** no alto e uma **trilha linda até a beira do rio**. Vai-se **de carro** (só dá de
carro), o **GPS leva certo**, mas a **estrada é terrível** e tem um **trecho extremamente vazio**;
parece que se está indo a um lugar abandonado. **Dentro é tranquilo** — tem gente da prefeitura pra
ajudar. Alma: a **história da batalha** (100% não-fungível) + a vista + os **campos de taboca
varridos pelo vento** na estrada (assinatura sensorial do caminho).

---

## 💡 A descoberta central: o fosso MUDA DE CAMPO

No Natuba, o fosso era **navegação** — o Maps mandava pela cilada, e o segredo era a cadeia de
waypoints. No Monte das Tabocas o GPS funciona, então o valor do BatePerna **se mudou de lugar**:

1. **Desistência por dúvida (o falso-aborto):** a pessoa não se perde no mapa — ela **desiste**,
   porque o caminho certo *parece* errado demais ("estrada horrível, não pode ser o caminho de um
   monumento, vou voltar"). O trust-data Nível B aqui é **permissão psicológica**: *"a estrada é
   péssima e parece abandono — segue mesmo assim, é assim que é; lá em cima é tranquilo e tem quem
   te ajude."* Nenhum Street View diz isso — o Street View **assustaria mais**.
2. **Chegada oca:** quem chega sem contexto vê "só um morro com vista" e **perde a história
   inteira**. O fosso aqui é **interpretação/significado**, não caminho.

---

## ✅ O que este roteiro fez com o modelo

| Item | Resultado |
|------|-----------|
| **P3** (trust-data Nível B é o fosso) | **CONFIRMADO** forte, numa rota de tipo oposto |
| **P13** (relevo variável por campo) | **CONFIRMADO** — e no nível mais fundo: não é só o peso dos campos que muda, **o próprio fosso muda de campo** (Natuba=navegação; MDT=tranquilização + significado) |
| **P15** (razor da alma = o não-fungível) | **CONFIRMADO** numa alma de tipo oposto: a história da batalha é 100% não-fungível; a vista é semi-fungível; a taboca ao vento é assinatura específica |
| **P2** (roteiro = caminho certo contra os errados) | **GENERALIZADO** — nem sempre há "caminho errado"; às vezes o inimigo é a **decisão errada** (desistir). Roteiro = o julgamento certo contra o instinto errado |

---

## ⭐ Padrões graduados a REQUISITO do BatePerna (o produto da confirmação)

Estes deixaram de ser "insights do Natuba" e viraram verdades do produto (sustentadas em 2 rotas):

- **R1 (era P16) — O roteiro protege contra o MODO DE FALHA daquela rota, e o modo varia.**
  O BatePerna não "dá a via segura" — ele **neutraliza o que arruinaria aquela viagem específica
  pra quem não sabe.** Taxonomia inicial de modos de falha (ABERTA — cresce com novas rotas):
  1. **Desorientação / cilada** — o mapa manda pro caminho errado (Natuba) → fosso = a rota certa.
  2. **Desistência por dúvida / falso-aborto** — o caminho certo parece tão errado que você volta
     (estrada do MDT) → fosso = tranquilização ("segue, é assim mesmo, tem apoio lá").
  3. **Chegada oca** — você chega mas perde o significado (a batalha do MDT) → fosso = interpretação.
  > Implicação de UX/curadoria: cada roteiro deveria **declarar seu modo de falha** — é o que diz
  > qual campo carrega o fosso e o que a ficha editorial precisa destacar.

- **R2 (era P13) — Relevo variável por campo.** Os 7 campos não têm peso uniforme; a UI editorial
  "browse-first" destaca o que pesa naquela rota, não preenche 7 caixas iguais. **O fosso pode
  morar em campos diferentes por rota.**

- **R3 (era P15) — Razor da alma.** A alma de um roteiro é o que é **não-fungível** nele (o que só
  aquela rota entrega). Serve de teste editorial pra achar o ângulo de qualquer roteiro.

---

## ▶️ Abertos / próximos

- **Extensão do R1:** a taxonomia de modos de falha está aberta. Um 3º roteiro deveria mirar um
  **modo de falha novo** (ex: sazonalidade — "só vale na cheia"; ou custo/logística pesada — o
  perfil (B) sem carro ainda deferido do Natuba).
- **Campos não-preenchidos do MDT** (custo, envelope temporal, etc.): não foram catalogados porque
  o roteiro serviu de teste, não de ficha. Dá pra completar se um dia o MDT virar roteiro real.
- **Decisões de UX/negócio ainda abertas do Natuba:** L2 (mostrar a rota-armadilha?), L3 (como
  sinalizar Nível A vs B na tela) — agora com R1 no colo, ganham um irmão: **como a ficha declara o
  modo de falha da rota.**
