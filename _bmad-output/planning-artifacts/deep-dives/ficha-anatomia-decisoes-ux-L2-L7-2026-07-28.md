---
titulo: "Anatomia da ficha — fechamento das decisões de UX/modelo L2–L7"
data: 2026-07-28
metodo: superpowers:brainstorming (sessão de CONSOLIDAÇÃO — não é um 7º roteiro; fecha as abertas de UX que o modelo v2.0 deixou)
status: L2–L7 FECHADAS. As seis abertas de "como o trust-data aparece" foram resolvidas projetando a FICHA como um artefato único (não seis decisões soltas). Alimenta o modelo → v2.1
relacionado:
  - ../bateperna-modelo-e-requisitos.md                  (doc autoritativo — atualizado para v2.1 com estas decisões)
  - ./recife-jaboatao-roteiro-metodo-confirmatorio-2026-07-27.md (6º roteiro — apontou "hora de consolidar")
  - ./salvador-roteiro-metodo-2026-07-27.md              (origem do L6 — espécie roteiro-método, 2 camadas)
  - ./praia-do-sossego-composicao-perigosa-2026-07-27.md (origem do L7 — discriminador, proxy falível)
  - ./rampa-do-pepe-modo-condicional-2026-07-26.md       (origem do L5 — condição de invalidação)
---

# Anatomia da ficha — fechamento das decisões L2–L7

> **Como retomar:** o modelo v2.0 encerrou a variedade de roteiros (6 rotas, 4 modos, 2 espécies) e
> deixou como próximo passo natural **fechar as 6 decisões de UX/modelo abertas** (L2–L7): "como o
> trust-data aparece na ficha/tela". Esta sessão fez isso. O pulo que organizou tudo: **L2–L7 não são
> seis decisões soltas — são seis facetas de projetar UM artefato, a ficha do roteiro.** Decididas em
> ordem de dependência, com o **modo de falha (L4)** como espinha (ele define o tom, e o tom governa
> as outras).

**Por que agora:** o 6º roteiro (Recife→Jaboatão) rendeu confirmação + refino + princípio, não
reviravolta — sinal de modelo estabilizando. João pediu parar de empilhar roteiros e consolidar. Esta
é a sessão de consolidação: fechar as abertas de UX antes de pensar em escopo/plano. Continua valendo
a regra **maturar antes de codar** — o resultado é um **contrato de comportamento da ficha**, não um
plano de build nem telas.

---

## 🔑 O enquadramento que destravou tudo

Relendo L2–L7, todas respondem a mesma pergunta ("como *isto* aparece na ficha"), e há uma **espinha
de dependência**:

| Aberta | O que decide | Papel na ficha |
|--------|--------------|----------------|
| **L4** | como a ficha declara o **modo de falha** | keystone — define o **tom** de tudo (REQ-3) |
| **L3** | sinalizar **Nível A vs B** | eixo transversal — atravessa todos os campos |
| **L2** | mostrar a **rota-armadilha** rejeitada | campo *confiança do trajeto* (só modo #1) |
| **L5** | **condição de invalidação** na ficha | campo *frescor/avisos* (rotas condicionais) |
| **L6** | as **2 camadas do roteiro-método** | estrutura de entidade (hub + instância) |
| **L7** | o **discriminador** sem causar falso-aborto | campo *avisos* (composição de tom oposto) |

Duas decisões são **transversais** (tom e procedência); as outras são específicas de campo/espécie.
Decidimos as transversais primeiro porque tingem todo o resto.

---

## L4 — Como a ficha declara o modo de falha *(o keystone)*

**Decisão-raiz: HÍBRIDO** — campo interno + expressão editorial. O modo não é jargão exposto nem puro
acaso de texto:

- **Campo interno (autoria):** o autor **declara** o(s) modo(s) de falha. Isso (a) garante o **tom**
  certo, (b) permite **curadoria/filtro**, (c) — recomendação travada — o **tom** vira um **atributo
  explícito derivado do modo** (acalmar ↔ avisar), pra o sistema poder **checar inconsistência de
  tom** (co-piloto até na autoria: errar o modo dá conselho invertido, REQ-3).
- **Metade voltada ao usuário: DUAS CAMADAS** (escolha do João):
  - **Camada de escaneio** — um **rótulo reutilizável**, leve, não-numérico, na lista/busca:
    `Cilada de GPS` · `Só na seca` · `Parece abandono, mas não é`. Dá poder de escanear e filtrar.
  - **Camada de leitura** — uma **frase editorial sob medida**, a voz de verdade na ficha aberta:
    *"A estrada assusta, mas é assim mesmo — segue que lá em cima é tranquilo."* Nunca jargão.

> **Rima estrutural:** essa dupla (rótulo herdável + voz da instância) é a **mesma gramática** do
> roteiro-método (L6). A ficha ganha consistência: escaneio reutilizável em cima, voz sob medida
> embaixo.

**Fio amarrado no L7:** modos **compostos** — tons **compatíveis FUNDEM** numa frase só (#2+#3);
tons **opostos COMUTAM** e renderizam como o **discriminador** (L7), não como escolha de um tom.

---

## L3 — Como sinalizar Nível A vs B *(eixo transversal)*

**Decisão: procedência por CONTRASTE — holofote no B, silêncio no A.** Em vez de "marcar
procedência" com selo simétrico em cada fato (que polui e dá peso igual a table-stakes e fosso), o
**Nível B brilha** ("só quem foi sabe: …") e o **Nível A fica texto plano, sem selo**. A distinção
nasce do contraste.

- Resolve o medo do REQ-12 (parecer "um cara que te checou o Street View"): o que **chama atenção** é
  exatamente o que o Street View **não** te dá.
- Casa com o diferencial do brief ("CRIA info, não agrega") e com REQ-2 (a ficha destaca o que pesa).
- **Coerência condicional:** numa rota condicional, o que brilha é a **regra/limiar** (Nível B) e o
  próprio **proxy-falível** ("céu seco ≠ estrada seca") — o valor ao vivo da previsão (Nível A) fica
  plano. Encaixa direto no L5.

---

## L2 — Mostrar a rota-armadilha rejeitada?

**Recorte:** a rota-armadilha só existe no **modo #1** (desorientação/cilada — Natuba manda por
Machados). No #2 não há rota errada a rejeitar. Então L2 = "nas rotas #1, como mostrar o caminho
rejeitado?". O **se** já estava quase respondido (o "não vá por X porque Z" é o Nível B mais puro →
brilha por L3; é candidato a maior gerador de confiança do app). A decisão foi **quão proeminente**:

**Decisão: REVELAÇÃO SOB DEMANDA.** O mapa mostra só a rota certa, limpa. A armadilha + o "porque Z"
vivem numa revelação a um toque: *"🤔 por que não pela rota óbvia? →"*.

- **Refino travado:** o **gatilho já vende** — a redação *"por que não pela óbvia?"* é, ela mesma, um
  sinal de que o app sabe de algo. Isso mitiga o risco de enterrar o maior gerador de confiança num
  clique, **sem** sujar o mapa.

---

## L6 — Como as 2 camadas do roteiro-método vivem na ficha

**Decisão: método como ENTIDADE-MÃE (hub).** Não é um template carimbado (que duplica e sofre drift);
é uma entidade de primeira classe:

```
[Método: Capital de transporte público]  ← hub, fonte única, herdável
   ├─ Salvador   (âncora: BRT Pituba, metrô-Lapa)
   ├─ Recife     (âncora: metrô até Jaboatão, casas históricas)
   └─ Fortaleza  (âncora: …)
```

- A **página de método** é fonte única e herdável (sem drift quando o método é refinado).
- Cada **ficha-instância** aponta *"↑ instancia este método"* e carrega sua **âncora não-fungível**
  (o guarda-corpo anti-fluff do R3 — método sem âncora = Nível A = não entra).
- **Navegação irmã↔irmã** nativa (Salvador ↔ Recife ↔ Fortaleza) e o método vira uma **lente de
  browse**.
- **Escopo** (quantos métodos entram na Fase 1) fica pra decisão de fatia — é raro cedo, mas o modelo
  de como ele vive está definido.

---

## L5 — Como a condição de invalidação vive na ficha

Rotas condicionais (Rampa do Pepe) têm regra máquina-checável — *"só na seca; invalida se choveu > X
em N dias"* (regra = Nível B; valor "choveu?" = Nível A). O **Sossego** jogou a bomba: o proxy Nível A
é **falível** — "uma semana sem chuva" deu verde e a estrada ainda estava empoçada. **Um farol verde
computado pode mentir.**

**Decisão: SEMÁFORO CO-PILOTO + ressalva de falha do proxy.** O app **computa** um sinal (regra ×
previsão) mas **nunca como veredito**:

> *"Última chuva há 9 dias — provavelmente ok. Mas atenção: aqui o barro segura água; céu seco ≠
> estrada seca. Confirme a poça no lugar."*

- A **ressalva de falha do proxy** vira **cidadã de primeira classe** da ficha condicional (não é
  rodapé): a ficha declara **como o proxy falha ali**.
- Aplica o REQ-12 híbrido (app sinaliza, não decide) já ciente do recuo do Sossego (o Nível A é sinal
  ruidoso, não verdade). Co-piloto até no clima.

---

## L7 — O discriminador sem causar o falso-aborto *(a mais delicada)*

O enunciado carrega o paradoxo: o discriminador é um **aviso (#4)** que **não pode disparar o
falso-aborto (#2)**. É o caso de **tom oposto que COMUTA** (#2+#4, Sossego) — e portanto **amarra o
fio pendente do L4**.

**Percurso da decisão (registro honesto):** minha recomendação inicial era *heads-up calmo no browse +
detalhe in-situ* (esconder o susto até o ponto onde é acionável). João escolheu o oposto — **aviso
adiantado e proeminente** — o que bate de frente com o objetivo declarado do L7 (não espantar de uma
rota que quase sempre passa; foi a própria história dele no Sossego: desistiu na hora e até hoje não
sabe se dava pra passar). Devolvi a tensão. A reconciliação:

**Decisão: PROEMINENTE + EQUIPADOR + SEGURO** (as três juntas). O discriminador aparece **cedo e com
destaque** (nada escondido → resolve o "emboscado", honra o encaixe honesto REQ-6), mas enquadrado
como **equipar, não alarmar**:

1. **Proeminente** — nada de esconder o risco; o ponto de decisão aparece no browse.
2. **Equipador** — a proeminência **educa**: mostra *como ler a poça na hora* (teste in-situ →
   memória Nível B do ponto exato → "essa poça é laje / é buraco"). O destaque é sobre a **sua
   capacidade de decidir**, não sobre o perigo cru. É isso que blinda contra o falso-aborto: a pessoa
   não fica com medo, fica **preparada**.
3. **Seguro** — **default cauteloso explícito**: sinal ilegível ou você sozinho → a ficha empurra pro
   **abortar sem culpa** (permissão bidirecional, REQ-8: "virar aqui é sabedoria, não fracasso").

> **A comutação #2+#4 materializada:** não é um flip escondido calmo→alarme. É uma apresentação
> **franca que carrega as duas coisas de uma vez** — *como ler* (equipa) **e** *na dúvida, virar*
> (default seguro). O discriminador (REQ-9) é o que "alterna o tom na hora" conforme a leitura real,
> com default cauteloso quando o sinal é ilegível.

---

## 🧬 Síntese — a anatomia da ficha

Duas **camadas de vida** (card na lista / ficha aberta) e dois **eixos transversais** (tom, procedência):

```
┌─ CARD NA LISTA (escaneio) ───────────────────────────┐
│  Rótulo(s) de modo reutilizável  →  "Cilada de GPS"  │  ← L4 camada-escaneio
│  Promessa editorial (1 linha)                        │  ← R3 / alma
│  [se método] "↑ instancia: Capital de transp. púb."  │  ← L6 hub
└──────────────────────────────────────────────────────┘

┌─ FICHA ABERTA (leitura) ─────────────────────────────┐
│  Frase editorial sob medida (a voz; define o TOM)    │  ← L4 camada-leitura
│  ▸ Prêmio / alma (o não-fungível)                    │
│  ▸ Trajeto: mapa da rota certa (limpo)               │  ← L2
│       "🤔 por que não pela rota óbvia? →" revela a   │     revelação sob demanda,
│        armadilha + porquê (insight B, brilha)        │     gatilho que vende
│  ▸ Acesso / o COMO que equipa (Nível B → brilha)     │  ← L3 holofote no B
│  ▸ Avisos / encaixe honesto (fricção declarada)      │  ← REQ-6
│  ▸ [se condicional] Semáforo co-piloto:              │  ← L5
│       regra(B) × previsão(A) → bandeira hedge-ada    │
│       + ressalva "aqui o proxy falha assim"          │
│  ▸ [se tom oposto #2+#4] Discriminador proeminente:  │  ← L7
│       como ler in-situ + memória do ponto +          │
│       permissão de abortar (default cauteloso)       │
│  ▸ Custo: tag grátis/pago por parada (termômetro)    │  ← REQ-7 / REQ-2
│  ▸ Frescor: decai + "Confirmar" (carrega a condição) │  ← REQ-10 / REQ-11
│  [se método] card de método herdado + âncora local  │  ← L6
└──────────────────────────────────────────────────────┘

EIXOS TRANSVERSAIS:
  • TOM (L4): atributo explícito derivado do(s) modo(s); sistema pode
    checar inconsistência. Compostos → FUNDEM (compatíveis) ou COMUTAM
    (opostos → discriminador L7).
  • PROCEDÊNCIA (L3): Nível B brilha, Nível A é plano. Sem selo simétrico.
```

---

## ✅ O que esta sessão fez com o modelo

| Aberta | Decisão travada |
|--------|-----------------|
| **L2** | Rota-armadilha (só modo #1) em **revelação sob demanda**, com **gatilho que vende**. |
| **L3** | Procedência por **contraste**: holofote no B, silêncio no A. Sem selo simétrico. |
| **L4** | **Híbrido**: campo interno (declara modo → tom explícito checável) + **2 camadas** ao usuário (rótulo escaneável + frase sob medida). |
| **L5** | **Semáforo co-piloto** + **ressalva de falha do proxy** como cidadã de 1ª classe. |
| **L6** | Roteiro-método como **entidade-mãe (hub)**: fonte única herdável + âncora na instância + navegação irmã + lente de browse. |
| **L7** | Discriminador **proeminente + equipador + seguro** (default cauteloso). Materializa a comutação #2+#4 e amarra o fio do L4. |

Nenhuma decisão criou requisito novo — todas **detalham** requisitos existentes (REQ-1/2/3/6/7/8/9/
10/11/12) e o princípio §I.4 (co-piloto em todo eixo). O modelo passa a **v2.1**.

---

## ▶️ Abertos / próximos

- **Escopo da Fase 1** — quais dos REQ-1..16 (e quais camadas da ficha) entram já vs. depois. É o
  próximo passo natural, agora que a UX está fechada. Só quando a ideia maturar pro plano.
- **Buraco conhecido do campo 1 (prêmio)** — segue sem REQ próprio (hoje implícito no destino + alma).
  Ainda não endereçado.
- **Testes de ideia deferidos** (não bloqueiam o escopo): par de composição novo (#1+#4 / #3+#4);
  fork perfil-B / logística pesada de verdade (nunca testado); modo atômico #5.
- **Nota de método:** esta foi uma sessão de **consolidação**, não um roteiro. Confirma o sinal de
  estabilização — o trabalho migra de "descobrir o modelo" para "cravar o que se constrói".
