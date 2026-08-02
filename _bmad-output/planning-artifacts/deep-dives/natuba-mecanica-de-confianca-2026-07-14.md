---
titulo: "Deep-dive Natuba — a mecânica de confiança do BatePerna"
data: 2026-07-14
metodo: superpowers:brainstorming (roteiro-cobaia real para expor lacunas)
status: NATUBA FECHADO (7/7 campos) em 2026-07-22 — Campo 4 (21/07), Campos 5 e 7 (22/07). Abertas só as decisões de UX/negócio L2/L3 e o fork deferido do perfil (B). Próximo passo: 2º roteiro real pra confirmar as hipóteses P13/P15
relacionado:
  - ../briefs/brief-BatePerna2.0-2026-07-11/brief.md  (o brief 9/9 que esta sessão evolui)
---

# Deep-dive Natuba — a mecânica de confiança do BatePerna

> **Como retomar:** leia o "Fio da sessão" (30s de leitura, dá o arco inteiro). Depois vá em
> "Retomar aqui" no fim — tem o menu do que falta e as questões abertas. Este doc é a versão
> durável do rascunho de trabalho; o original ficou em scratchpad (temporário).

**Por que existe:** o João decidiu aprofundar o NEGÓCIO antes de qualquer plano/código (o v1 foi
construído com a ideia verde demais). Método: em vez de teorizar, materializamos UM roteiro real
— Natuba, um bate-e-volta de Recife — e a cada campo de "confiança" pressionamos até uma lacuna
aparecer. Entramos pela cachoeira; saímos com a espinha dorsal do negócio.

---

## 🧵 O fio da sessão (o arco, em 9 passos encadeados)

Partida: *"Natuba tem uma cachoeira que quase ninguém conhece, e a estrada é emocionante."*

1. **Emoção e segurança não brigam** → PRINCÍPIO: *BatePerna vende a aventura, entregue pela via
   segura.* O curador não sanitiza (não vira "100% asfalto sem graça") — ele acha o caminho
   seguro pro lugar selvagem. Orobó, não Machados.
2. **Um roteiro não é um LUGAR — é o CAMINHO CERTO, escolhido contra os errados.** Natuba não vale
   por "existe cachoeira"; vale por "Machados parece boa e é cilada, Orobó é a via segura". Esse é
   o fosso contra o Google Maps, que manda pela rota óbvia = a cilada.
3. **Trust-data tem DOIS níveis.** Nível A = verificável remoto (Street View) = qualquer um faz =
   NÃO é fosso. Nível B = só quem foi sabe (gem sem cobertura, acesso sem guia) = 100% do fosso.
   O app tem que destacar o Nível B, senão parece "um cara que checou Street View por você".
4. **O artefato central é uma CADEIA DE WAYPOINTS** (Recife → Orobó → Umbuzeiro → Natuba, forçando
   asfalto) que o Maps não gera sozinho. Forma concreta do "dono-da-confiança-delega-execução":
   BatePerna monta a rota, o Waze navega. "Só asfalto" = o filtro que recomputa a rota (Golpe A).
5. **Toda fonte de acesso ENVELHECE** (João confiou num vídeo velho e deu certo por sorte). Daí a
   MECÂNICA: a confiança **esfria sozinha com o tempo, com opção de Confirmar** (reesquenta).
6. **Isso resolve a assimetria mortal do feedback**: quem passa perrengue ABANDONA o app, não
   reporta. Solução: coletar só o sinal FÁCIL (confirmação positiva); a *ausência* de confirmação
   já faz a segurança sozinha (a rota esfria → cai de confiança sem precisar de má notícia).
7. **No cold start, o motor de confirmação é o João** — a cadência semanal do canal mantém as
   rotas quentes. Significado operacional do Risco nº1: quando o João para, as rotas esfriam.
8. **Existe uma JANELA DE BOOTSTRAP (~3 meses)** onde solo é aceitável (nada a proteger ainda).
   Depois dela, o **2º confirmador vira SEGURO DE VIDA**, não luxo de Fase 2. Traz os amigos raiz
   pra cedo.
9. **"Engrenou" = confirmações dos OUTROS vencerem o decaimento em ≥3 rotas, sem o João empurrar**
   (= o próprio Risco nº1 se dissolvendo). Cuidado que o João levantou: não confundir o 1º sinal
   com "posso parar" — a saída do fundador é RAMPA vigiada com histerese, nunca penhasco.

---

## ✅ Decisões travadas nesta sessão (evoluem o brief)

| # | Decisão | Status |
|---|---------|--------|
| P1 | Princípio "aventura pela via segura" (curador acha o caminho seguro, não sanitiza) | travado · **afiado 2026-07-22 (P14):** "não sanitiza" tem alvo — pode domar o *perigo de dirigir* à vontade (fungível); **jamais sanitizar a remotidão / o off-map** (é a alma) |
| P2 | Roteiro = caminho certo escolhido contra os errados (mostra a via + educa contra a cilada) | travado |
| P3 | Trust-data em 2 níveis (A remoto / B pé-no-chão); Nível B é o fosso e deve ser explícito | travado |
| P4 | Artefato de entrega = cadeia de waypoints pré-montada, delegada ao Waze/Maps | travado |
| P5 | Confiança decai com o tempo + ação "Confirmar" reesquenta | travado |
| P6 | Coletar só o sinal fácil (confirmação); ausência de confirmação = rebaixamento automático | travado |
| P7 | Janela de bootstrap ~3 meses (solo OK); 2º confirmador obrigatório cedo, não Fase 2 | travado |
| P8 | Métrica-farol "engrenou" = confirmações de outros > decaimento em ≥3 rotas, sem o João | travado |
| P9 | Saída do fundador = rampa vigiada com histerese (sustentar por semanas), nunca penhasco | travado |
| P10 | Campo 4 (dente 3) NÃO é "aviso de crime/golpe" — é **condições de encaixe** em 3 eixos: **QUANDO** (janela dura, só de dia) · **QUEM/COM QUÊ** (encaixe honesto, informa mas não barra) · **COMO** (equipa — coração do P1) | travado (2026-07-21) |
| P11 | "Hora limite de sair" = **artefato temporal**, gêmeo da cadeia de waypoints (que era só espacial). A rota tem um envelope de tempo calculável, não só um caminho no espaço | travado (2026-07-21) |
| P12 | Campo 5 (custo) tem **peso variável por rota**. Pra bate-e-volta barato tipo Natuba desidrata em duas coisas, não num total: (1) **de-risk da carteira** ("relaxa, é barato, o principal é grátis, leve R$X em dinheiro") e (2) **tag grátis/pago por parada** (o custo age como filtro que compõe o dia, ex: pular a fazenda paga, ficar no grátis). A "régua multimodal pesada" pertence a OUTRO tipo de rota — perfil (B) sem carro, ou rota cara/longe/pernoite — e fica **deferida** (o Natuba foi de carro, não temos o dado). Fino separar: no Natuba o "leve dinheiro" é do **sinal** (Campo 4/equip), não do preço | travado (2026-07-22) |
| P13 | **HIPÓTESE (a confirmar no 2º roteiro):** os 7 campos não têm peso uniforme — cada roteiro tem um **relevo** próprio (Natuba: prêmio alto, confiança-do-trajeto altíssima = o fosso, custo raso). O produto não é ficha fixa e chapada; a UI editorial "browse-first" destaca o que pesa naquela rota, não preenche 7 caixas iguais | hipótese (2026-07-22) |
| P14 | **Alma do Natuba = a JORNADA:** a paisagem se abrindo (o agreste) + o mergulho no desconhecido (Recife fica pra trás, cidade vira mato, mais remoto a cada waypoint). O desafio de dirigir é **fungível** ("poderia ser em qualquer lugar") — não é a alma. Consequência forte: **fosso e alma são o MESMO artefato** — a cadeia de waypoints entrega segurança E a progressão-mergulho; a paisagem é o que se vê pela via segura. São aliados, não inimigos | travado (2026-07-22) |
| P15 | **HIPÓTESE (irmã da P13, a confirmar no 2º roteiro) — "o razor da alma":** a alma de um roteiro é o que é **não-fungível** nele — *o que SÓ aquela rota entrega.* Vira teste editorial pra achar a alma de qualquer roteiro (no Natuba: o razor reprova o desafio de dirigir e aprova a paisagem+mergulho) | hipótese (2026-07-22) |

---

## 🕳️ As 9 lacunas (registro completo, resolvidas e abertas)

- **L1 — RESOLVIDA →** virou princípio P1 (emoção vs segurança = os dois).
- **Campo 4 — RESOLVIDO (2026-07-21) →** P10/P11. Descoberta: o "dente 3" não era medo de crime;
  era condições de encaixe (quando/quem/como). Surgiu artefato novo: o envelope temporal ("hora
  limite de sair"), gêmeo da cadeia de waypoints espacial.
- **L2 — ABERTA (decisão de UX/negócio):** o roteiro deve MOSTRAR a rota-armadilha rejeitada
  ("não vá por Machados, porque…") pra provar valor e educar, ou só a rota certa pra ficar simples?
  Hipótese: mostrar o "não vá por X" pode ser o maior gerador de confiança do app.
- **L3 — parcial (P3):** falta definir COMO o app marca procedência (Nível A vs B) na interface e
  no modelo — como o usuário vê "isto aqui só quem foi sabe"?
- **L4 — RESOLVIDA →** artefato = cadeia de waypoints (P4). Aberto downstream: é feature da Fase 1?
- **L5 — RESOLVIDA →** mecânica de decaimento + confirmar (P5/P6).
- **L6 — RESOLVIDA →** "só asfalto" prova o filtro (incorporado em P4).
- **L7 — RESOLVIDA →** janela de bootstrap + 2º confirmador (P7).
- **L8 — RESOLVIDA →** métrica "engrenou" com piso (P8).
- **L9 — RESOLVIDA →** rampa de saída do fundador (P9).

---

## 🗺️ Estado do roteiro-cobaia Natuba (campos)

| Campo | Estado | Conteúdo |
|-------|--------|----------|
| 1. O prêmio | ✔️ | Cachoeira que quase ninguém de Recife conhece + mirante + uvas/bananas + a estrada emocionante |
| 2. Confiança do trajeto | ✔️ | Machados (curta) = cilada, chão batido pego no Street View; Orobó = via segura |
| 3. Acesso / tácito | ✔️ | Maps abandona após Orobó; fonte = vídeo velho de youtuber; puxadinho Recife→Orobó→Umbuzeiro→Natuba forçando asfalto |
| 4. Avisos | ✔️ (P10/P11) | Reformulado: NÃO é crime/golpe (João não se sentiu ameaçado). É **encaixe** em 3 eixos. QUANDO: só de dia — estrada sem acostamento + deserta após Umbuzeiro + não dirigir à noite → "hora limite de sair". QUEM: exige carro/motorista que aguente ladeira + barro do cruzeiro (câmbio manual sofre). COMO (Nível B rico): mapa offline (sinal ruim; wifi só no parque), siga sempre o asfalto, 1ª marcha olhando buraco no barro, papel higiênico (banheiros precários), agendar fazendas de uva/banana antes |
| 5. Régua de custo | ✔️ (P12/P13) | **Fino de propósito.** Natuba real: cachoeira e mirante GRÁTIS, tudo em conta; o único gasto "de verdade" é gasolina/pedágio (Nível A, chato). Trust-data que sobra: (a) **de-risk** — tirar o medo de cilada-de-dinheiro; (b) **ausência de serviço como info** — cidade minúscula, almoce em Umbuzeiro, não em Natuba; (c) **tag grátis/pago por parada** — a fazenda de uva cobra (portão que fez pular a parada), cachoeira/mirante grátis; (d) **leve dinheiro vivo** — mas por causa do SINAL, não do preço. Perfil (B) sem carro + régua pesada = deferido |
| 6. Verificado em [data] | ✔️ (via P5) | resolvido pela mecânica de decaimento+confirmar |
| 7. Alma temática | ✔️ (P14/P15) | **É a JORNADA, não o destino.** Paisagem do agreste se abrindo + mergulho no desconhecido (Recife fica pra trás, some do mapa). O desafio de dirigir é fungível, fora. Fosso e alma = mesmo artefato (a cadeia de waypoints). **Promessa editorial:** *"Natuba: a cachoeira no fim de uma estrada que some do mapa."* — Recife vai ficando pra trás, o agreste se abre, e a cada trecho você entra mais fundo num lugar que quase ninguém encara — pela via que a gente já achou segura pra você |

---

## ▶️ RETOMAR AQUI (menu da próxima sessão)

Escolher um destes ao voltar:

1. ~~Campo 4 — Avisos~~ **FECHADO 2026-07-21** (P10/P11).
2. ~~Campo 5 — Régua de custo multimodal~~ **FECHADO 2026-07-22** (P12/P13). Descoberta: é fino de propósito (de-risk + tag por parada); nasceu a hipótese "relevo por campo" (P13) e ficou deferido o perfil (B) sem carro / régua pesada.
3. ~~Campo 7 — Alma temática~~ **FECHADO 2026-07-22** (P14/P15). Descoberta: a alma é a JORNADA (paisagem+mergulho), não o destino; fosso e alma = mesmo artefato; nasceu a hipótese "razor da alma / não-fungível" (P15) e o P1 foi afiado. **→ NATUBA FECHADO 7/7.**
4. **Fechar L2/L3** (decisões de UX/negócio: mostrar a rota-armadilha? como sinalizar Nível B?).
5. **Pegar um SEGUNDO roteiro real** (ex: Vivência/Estrada Buenos Aires) pra testar se as 9 lacunas
   se repetem E confirmar as hipóteses P13 (relevo por campo) e P15 (razor da alma) — descobre se
   achamos PADRÕES do produto ou só coisas do Natuba. **← recomendado como próximo passo.**
6. **Explorar o envelope temporal (P11)** — a "hora limite de sair" como artefato: como se calcula,
   como o app mostra, se generaliza pra outras rotas. É a descoberta mais nova e ainda crua.

**Recomendação:** opção 5 (2º roteiro) logo após o Campo 7 — é o que confirma a hipótese P13
("relevo por campo") e testa o fork deferido do perfil (B) sem carro. Validar que o padrão se
repete é o que transforma "insights do Natuba" em "requisitos do BatePerna". Falta só 1 campo (7)
pra fechar o Natuba inteiro.
