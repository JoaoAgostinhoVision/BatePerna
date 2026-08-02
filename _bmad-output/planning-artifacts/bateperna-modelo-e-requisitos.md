---
titulo: "BatePerna — Modelo do produto e requisitos"
data: 2026-07-29
status: v2.5 — v2.4 + o teste de composição (Marinho PB, #1+#4): reframe da regra de composição ("mesma decisão", não "tom oposto") + nasce o 3º regime RAMIFICAR (a condição escolhe o artefato), que unifica a Rampa do Pepe como caso particular. Afia REQ-3/R1, REQ-4, REQ-5. Fecha o ÚLTIMO teste de ideia deferido → Parte III fechada, núcleo estável. Destila o brief 9/9 + 6 roteiros reais + Marinho (7º toque, teste de composição) + a consolidação da ficha + a sessão de escopo da Fase 1 + o teste de logística pesada + o teto de aventura. Trabalho de IDEIA, NÃO plano de build (João mantém a regra: maturar antes de codar)
fontes:
  - ./briefs/brief-BatePerna2.0-2026-07-11/brief.md                          (brief 9/9)
  - ./deep-dives/natuba-mecanica-de-confianca-2026-07-14.md                  (1º roteiro, exploratório)
  - ./deep-dives/monte-das-tabocas-teste-de-padrao-2026-07-22.md             (2º roteiro, confirmatório)
  - ./deep-dives/rampa-do-pepe-modo-condicional-2026-07-26.md                (3º roteiro, extensão — modo condicional)
  - ./deep-dives/salvador-roteiro-metodo-2026-07-27.md                       (4º roteiro, urbano — composabilidade + roteiro-método)
  - ./deep-dives/praia-do-sossego-composicao-perigosa-2026-07-27.md          (5º roteiro, composição perigosa #2+#4 — discriminador)
  - ./deep-dives/recife-jaboatao-roteiro-metodo-confirmatorio-2026-07-27.md  (6º roteiro, roteiro-método confirmatório — fricção + princípio co-piloto)
  - ./deep-dives/ficha-anatomia-decisoes-ux-L2-L7-2026-07-28.md              (consolidação — fecha as decisões de UX L2–L7 / anatomia da ficha)
  - ./deep-dives/rampa-do-pepe-teste-logistica-pesada-2026-07-29.md          (revisita da Rampa como teste de logística pesada — afia REQ-5/9/10/12, sem modo #5)
  - ./deep-dives/marinho-composicao-ramificar-2026-07-29.md                  (teste de composição #1+#4 — reframe "mesma decisão" + 3º regime RAMIFICAR)
rastreio: cada requisito aponta a origem (P# = decisão do Natuba · R# = padrão graduado · rota)
nota-de-renumeração: "v2.0 renumerou os requisitos por tema para lerem em ordem. Os deep-dives são fotos datadas e citam a numeração da época (ex.: o 'REQ-15 discriminador' do Sossego é o REQ-9 aqui; o 'REQ-16 fricção' do Recife é o REQ-6). Este doc é a autoridade viva."
---

# BatePerna — Modelo do produto e requisitos

> **O que é este doc:** a versão autoritativa e enxuta de "o que o BatePerna é", somando o brief e
> os seis roteiros reais. Divide-se em **Princípios** (o porquê, estável) → **Requisitos** (o que o
> produto tem que fazer) → **Aberto** (o que ainda não foi decidido). É a ponte para um futuro
> plano/PRD — que só começa quando o João sinalizar que a ideia está madura o bastante.

---

## Parte I — Princípios (o porquê)

### 1. O princípio-mãe

**BatePerna vende a aventura, entregue pela via segura.** O curador não sanitiza (não vira "100%
asfalto sem graça") — ele acha o caminho seguro pro lugar selvagem. O produto real é o
**trust-data**, e o que vale é o **Nível B**: o que **só quem foi sabe** (gem sem cobertura de
mapa, acesso sem guia, "a estrada feia é normal"). O **Nível A** (verificável remoto, tipo Street
View) qualquer um faz — não é fosso.
*(origem: P1 afiado · P3)*

> **Afiação do "não sanitiza" (P14):** dá pra domar o **perigo de dirigir** à vontade (é fungível);
> o que **jamais** se sanitiza é a **remotidão / o off-map** — é ali que mora a alma.

### 2. A tese central — o produto neutraliza o MODO DE FALHA da rota (R1)

O BatePerna **não** "dá a via segura" como slogan único. Ele **neutraliza o que arruinaria aquela
viagem específica pra quem não sabe** — e o modo de falha **varia por rota**. Taxonomia (ABERTA,
cresce com novas rotas), com **duas famílias** e — desde o 4º roteiro — **composável** (os modos
empilham numa mesma rota):

**Estáticos** — leia a rota certa **uma vez**; o trust-data é permanente:

| # | Modo de falha | Exemplo | Onde mora o fosso |
|---|---------------|---------|-------------------|
| 1 | **Desorientação / cilada** | Natuba: o Maps manda por Machados (curta, cilada) | a rota certa (cadeia de waypoints) |
| 2 | **Desistência por dúvida / falso-aborto** | Monte das Tabocas: a estrada é péssima e parece abandono; a pessoa volta achando que errou | tranquilização ("segue, é assim mesmo, tem apoio lá") |
| 3 | **Chegada oca** | Monte das Tabocas: sem a história da batalha vê "só um morro" | interpretação / significado |

**Condicionais** — leia a **condição toda vez, antes de ir**; o trust-data é uma **regra** que se
reavalia contra o mundo a cada viagem:

| # | Modo de falha | Exemplo | Onde mora o fosso |
|---|---------------|---------|-------------------|
| 4 | **Janela condicional / armadilha intermitente** | Rampa do Pepe: estrada de barro que atola na chuva (e a vista some junto); a mesma rota é boa na seca e uma cilada molhada | a **regra** de leitura da condição ("só na seca; se choveu > X em N dias, não vá") |

> **Distinção de família (achado do 3º roteiro):** nos modos 1–3 o inimigo é **estático** (o
> espaço, a cabeça, o significado). No modo 4 o inimigo é o **tempo/condição** — a rota **liga e
> desliga** conforme um sinal externo (chuva) que só quem é de lá sabe ler. Isso muda a mecânica de
> confiança (ver REQ-10/11) e o que a ficha precisa carregar.

> **Composabilidade (aberta em Salvador → completada em Sossego → GENERALIZADA no teste de Marinho):**
> os modos **empilham**. O que decide o regime **não é o "tom" em abstrato** — é a **relação entre os
> dois modos** (reframe do teste de Marinho #1+#4): eles são independentes, colidem, ou um alimenta o
> outro? Daí **três regimes**:
> - **FUNDIR** (modos em decisões **diferentes**). Salvador = #2 + #3 (permissão + significado): dois
>   "boa notícia que o forasteiro não sabe", sobre objetos distintos; a ficha diz os dois de uma vez,
>   sem atrito.
> - **COMUTAR** (modos que **colidem na MESMA decisão**, com puxões opostos). Praia do Sossego = #2 +
>   #4 (acalmar vs. avisar) **no mesmo go/no-go, no mesmo sinal físico** (a poça): acalmar mandaria pro
>   atoleiro, avisar causaria o falso-aborto. A ficha carrega um **discriminador** (REQ-9, teste Nível
>   B) que **alterna** o tom na hora, com **default cauteloso** quando o sinal é ilegível.
> - **RAMIFICAR** (um modo **alimenta** o outro — a condição **escolhe o artefato**). Marinho = #1 +
>   #4: na seca o atalho de barro, na chuva o desvio por Queimadas. Não é aviso independente (não
>   funde) nem go/no-go de tom oposto no mesmo ponto (não comuta): a condição **troca o caminho**, de
>   antemão, sem drama — a alternativa é a rota **segura**. A cadeia de waypoints vira **condicional**
>   (`caminho = f(condição)`; ver REQ-4).
>
> A composição não é média de tons. **"Tom oposto" era só o sintoma da colisão; o mecanismo é a
> relação entre os modos.** Consequência no REQ-3: declarar o **conjunto** de modos exige identificar a
> relação (independentes → fundir · colidem → comutar+discriminador · um alimenta o outro → ramificar).

*(origem: R1 = ex-P16 · confirmado em 2 rotas, ESTENDIDO na Rampa do Pepe (família condicional),
COMPOSABILIDADE aberta em Salvador (#2+#3 fundem), completada em Praia do Sossego (#2+#4 comutam),
GENERALIZADA no teste de Marinho (#1+#4 ramificam; reframe "mesma decisão"); taxonomia aberta)*

### 3. A alma — o razor do não-fungível (R3)

A alma de um roteiro é **o que é não-fungível nele** — o que só aquela rota entrega. É o teste
editorial pra achar o ângulo de qualquer roteiro. Ela pode estar na **jornada** (Natuba: a paisagem
do agreste se abrindo + o mergulho no desconhecido) ou no **destino/lugar** (Monte das Tabocas: a
história da batalha). O desafio de dirigir **falha** o razor ("poderia ser em qualquer lugar").
Liga direto no "browse-first editorial" do brief: a ficha vende o não-fungível.

> **Generalização (achado do 4º roteiro — Salvador): duas ESPÉCIES de roteiro.** Além do
> **roteiro-lugar** ("vá AQUI" — o valor é o lugar específico: Natuba, MDT, Rampa do Pepe), nasce o
> **roteiro-método** ("aplique ESTE padrão" — o valor é uma estrutura **transferível entre lugares**:
> Salvador = "fazer uma capital de transporte público"). O razor R3 se generaliza: o não-fungível
> (a alma) pode ser o **método** OU o **lugar**. **Mas não afrouxa:** toda instância, das duas
> espécies, **ainda precisa de âncora não-fungível** (Salvador ancora no BRT beira-mar da Pituba, no
> metrô até a Lapa). Um método sem âncora vira dica de blog = Nível A = **não entra**. A âncora é o
> **guarda-corpo anti-fluff** que separa roteiro-método de conteúdo de agregador.

> **Confirmação (6º roteiro — Recife→Jaboatão):** o roteiro-método sai de **hipótese** (1 exemplo,
> Salvador) para **espécie confirmada** (2 exemplos): o card de método **herdou ponto a ponto** numa
> 2ª capital (economia de gasolina, sem aperreio de estacionar, sem perigo de estrada, a cidade que o
> turista não vê). Como o padrão de falha graduou de Natuba → MDT.

*(origem: R3 = ex-P15 · confirmado em 2 rotas · GENERALIZADO em Salvador para duas espécies ·
roteiro-método CONFIRMADO em Recife→Jaboatão)*

### 4. Co-piloto, nunca piloto — em TODO eixo (princípio emergente)

**O BatePerna informa + equipa; o humano calibra e decide. Sempre.** O que começou como uma regra só
para a **condição** dinâmica (REQ-12, Rampa do Pepe: "app sinaliza o Nível A, humano decide com a
regra Nível B") revelou-se, olhando os 6 roteiros juntos, a **postura do produto** em **todo eixo do
trust-data**:

| Eixo | Rota / requisito | Como resolve |
|------|------------------|--------------|
| **Condição** (choveu?) | Rampa do Pepe / REQ-12 | app sinaliza, humano decide com regra Nível B |
| **Go/no-go** (passa a poça?) | Praia do Sossego / REQ-9 | discriminador informa, humano decide, default cauteloso |
| **Permissão** (ir / abortar) | Salvador, Sossego / REQ-8 | equipa a decisão nos dois sentidos, não decide |
| **Conforto** (aguento a fricção?) | Recife→Jaboatão / REQ-6 | declara a fricção, viajante se auto-seleciona |

Nunca decide **por** você — nem no melhor sinal remoto (Nível A é falível), nem no conselho. É o que
mantém a confiança: o produto é um **dono-da-confiança que delega a execução** (o mesmo espírito do
"BatePerna monta a rota, Waze navega").
*(origem: REQ-12 generalizado · nomeado em Recife→Jaboatão)*

### 5. Teto de aventura + porta de expansão

O coração do BatePerna é a aventura **bate-e-volta**, com o **teto de dificuldade/risco em torno da
Rampa do Pepe** (chegável de carro, hazard condicional que engole o carro na chuva) — *isso já é
emoção suficiente*. Perfis mais pesados — **expedição, multimodal sem carro, pernoite, risco de ficar
preso** — **não são o núcleo**, mas são **expansão futura possível**: o modelo deve permanecer
**aberto** a eles (não fecha a porta), **sem ser desenhado em torno** deles. É o mesmo espírito
"**costura, não máquina**" que guiou o escopo da Fase 1 (Parte IV) — deixa-se o encaixe pronto pra
crescer, não se constrói a máquina agora.

> **Consequência (fecha um deferido):** o teste de perfil-B / logística pesada deixa de ser "a lacuna
> mais forte / candidato a modo #5 que falta" e passa a ser um **eixo de expansão** — parqueado como
> direção futura, não como buraco a preencher. A caça a um modo #5 pelo lado da logística sai do radar
> do núcleo (a taxonomia R1 segue aberta em princípio, mas isso não é mais uma pendência).

*(origem: decisão do João 2026-07-29 — "o pepê é emoção suficiente"; casa com o brief, que já punha
*pernoite* fora da Fase 1)*

---

## Parte II — Requisitos (o que o produto tem que fazer)

> Numerados e rastreados. "Deve" = requisito; "deveria" = forte candidato ainda dependente de
> decisão aberta. Sem schema/telas aqui — isto é o **contrato de comportamento**, não o build.
> *(v2.0 renumerou por tema; a numeração é agora um identificador permanente.)*

### Como os 7 campos da ficha se ligam aos requisitos

A ficha (REQ-1) descreve todo roteiro por 7 campos. Este mapa mostra qual requisito serve cada campo
— e **expõe onde a cobertura é fina**:

| # | Campo da ficha | Requisito(s) que o servem |
|---|----------------|---------------------------|
| 1 | **Prêmio** (o que a rota entrega) | *sem REQ próprio* — hoje implícito (o destino); a alma (R3 / REQ-3) dá o ângulo. **Buraco conhecido.** |
| 2 | **Confiança do trajeto** | REQ-4 (waypoints) · REQ-10/11/12 (mecânica de confiança + procedência) |
| 3 | **Acesso / tácito** | REQ-8 (camada que equipa — o "COMO") |
| 4 | **Avisos / encaixe** | REQ-5 (o "QUANDO") · REQ-6 (o "QUEM" / fricção) · REQ-9 (discriminador, quando há tom oposto) |
| 5 | **Régua de custo** | REQ-2 (relevo / termômetro) · REQ-7 (tag grátis-pago) |
| 6 | **Frescor** (verificado em) | REQ-10 (decaimento + Confirmar) · REQ-11 (sinal fácil) |
| 7 | **Alma temática** | R3 (princípio) · REQ-3 (declarar o modo dá o ângulo editorial) |

### Anatomia de um roteiro

- **REQ-1 — Ficha de roteiro com 7 campos (e, para roteiro-método, DUAS camadas).** Todo roteiro se
  descreve por: (1) o prêmio, (2) confiança do trajeto, (3) acesso/tácito, (4) avisos/encaixe, (5)
  régua de custo, (6) frescor (verificado em), (7) alma temática. **Roteiro-método (Salvador)
  acrescenta uma estrutura de duas camadas:** um **card de MÉTODO herdável** (a estrutura
  transferível entre cidades — ex.: "capital de transporte público: hotel-nó + linha-que-é-passeio +
  ande na malha local") **+** um **card de ÂNCORA/instância** (o não-fungível daquela cidade — ex.
  Salvador: Ibis no Iguatemi, BRT Pituba, metrô-Lapa). O card de método **se herda** entre irmãs; o
  card de âncora aterra cada instância no razor R3. *(P1 · duas camadas: Salvador)*
- **REQ-2 — Relevo variável (R2).** A ficha **não** preenche 7 caixas iguais; ela **destaca o que
  pesa naquela rota** e desidrata o que é raso. *Ex.: no Natuba o custo é fino (só de-risk + tag por
  parada); no MDT o fosso está no campo 4 e na alma; em Salvador o custo é o campo que grita.* O
  fosso **pode morar em campos diferentes por rota**. **Afiação de Salvador — o campo que grita não
  é necessariamente onde mora o fosso:** em Salvador o custo é protagonista (R$400) mas o fosso mora
  em #2+#3; o custo é o **termômetro** do fosso (a **aposta** que você faz e o **placar** que mede se
  ganhou — mesma moeda), não a fonte dele. *(R2 · afiado em Salvador)*
- **REQ-3 — Declarar o(s) modo(s) de falha (R1).** Cada roteiro **deve** declarar qual(is) modo(s)
  de falha ele neutraliza (tabela da §I.2) — é isso que diz qual campo carrega o fosso e o que a
  ficha editorial precisa gritar. **O modo também define o TOM da ficha, e os tons podem ser
  opostos:** o modo #2 pede **acalmar** ("segue, é assim mesmo"); o modo #4 pede **avisar** ("se
  choveu, não vá, e não vá sozinho"). O mesmo instinto de tranquilizar que salva no #2 é mentira
  perigosa no #4 — por isso declarar o modo não é burocracia: errar o modo dá o **conselho
  invertido**. **Modos compostos — três regimes, decididos pela RELAÇÃO entre os modos, não pelo "tom"
  em abstrato** (reframe do teste de Marinho): quando um roteiro neutraliza **mais de um modo**, a
  ficha declara o **conjunto** e identifica a relação:
  - **FUNDIR** — modos em **decisões diferentes** (Salvador #2+#3): a ficha diz os dois de uma vez.
  - **COMUTAR** — modos que **colidem na mesma decisão** (Praia do Sossego #2+#4, acalmar vs. avisar
    no mesmo go/no-go): a ficha entrega o **discriminador** (REQ-9) em vez de escolher um lado.
  - **RAMIFICAR** — um modo **alimenta** o outro, a condição **escolhe o artefato** (Marinho #1+#4:
    seca → atalho, chuva → desvio): a cadeia de waypoints vira **condicional** (REQ-4), sem colisão de
    tom (a alternativa é a rota segura).

  **"Tom oposto" era o sintoma da colisão; o mecanismo é a relação.** Declarar o modo não é
  burocracia: erra o modo → dá o conselho invertido; erra o regime → funde o que devia ramificar (ou
  vice-versa). *(R1 · reforçado na Rampa do Pepe · FUNDIR em Salvador, COMUTAR em Praia do Sossego,
  RAMIFICAR + reframe "mesma decisão" no teste de Marinho)*

### Os artefatos concretos de entrega

- **REQ-4 — Cadeia de waypoints (artefato espacial), possivelmente CONDICIONAL.** Quando o modo de
  falha é desorientação (#1), o roteiro entrega uma **cadeia de waypoints pré-montada** (ex.:
  Recife→Orobó→Umbuzeiro→Natuba, forçando asfalto) que o Maps não gera sozinho, **delegável ao
  Waze/Maps** pra navegar. "Só asfalto" é o filtro que recomputa a rota. **Afiação do teste de Marinho
  (#1+#4 ramificam):** quando o #1 se compõe com uma condição (#4), a cadeia deixa de ser única e vira
  **condicional** — **`caminho = f(condição)`** (ex.: seca → atalho de barro; chuva → desvio por
  Queimadas). O galho alternativo pode ser **um desvio** (Marinho — rota segura mais rodada) ou **o
  conjunto vazio / "não vá"** (Rampa do Pepe) — os dois são o mesmo mecanismo. A ficha entrega, então,
  **uma cadeia por galho** + a regra que seleciona. *(P4 · cadeia condicional no teste de Marinho)*
- **REQ-5 — Envelope temporal (artefato temporal, o "QUANDO", em DUAS escalas).** O "QUANDO" da rota
  vive em dois níveis: **micro** = a **hora limite de sair** dentro do dia (quando há trecho
  deserto/sem acostamento — Natuba após Umbuzeiro, trecho vazio do MDT — não dirigir à noite);
  **macro** = a **condição/estação de encaixe** ("só na seca") quando a viabilidade da rota depende
  de uma condição que muda no tempo (Rampa do Pepe: só quando não choveu). O micro é gêmeo da cadeia
  espacial (REQ-4); o macro se liga à mecânica de confiança condicional (REQ-10/11). **Afiação da
  revisita da Rampa do Pepe (logística pesada):** em rota condicional que **degrada continuamente** (a
  chuva não para, o barro só piora), **não há aborto no meio** — a **janela de aborto colapsa para a
  ENTRADA** ("decida no pé da trilha, porque comprometeu, foi"), o oposto do perigo-ponto (Sossego),
  onde dá pra chegar, ler in-situ e voltar. **Afiação do teste de Marinho — a condição macro pode
  REROTEAR, não só barrar:** além de gatear ("só na seca") e de invalidar ("choveu → não vá"), a
  condição pode **selecionar entre caminhos** (seca → atalho; chuva → desvio por Queimadas). Aí o
  "QUANDO" macro se enlaça com o artefato espacial (REQ-4) num **ramificar**: a mesma condição que
  barraria a rota-atalho **abre a rota-desvio**. *(P11 · escala macro da Rampa do Pepe ·
  janela-de-aborto-na-entrada na revisita de logística · rerroteamento no teste de Marinho)*
- **REQ-6 — Encaixe honesto / fricção declarada (o "QUEM", campo 4).** Complemento do "QUANDO"
  (REQ-5): a ficha **deve declarar o encaixe** — pra QUEM a rota serve e o que ela cobra — e o custo
  **não-monetário** entra aqui: barulho, aglomeração, ambulante, pregador, desconforto do modo local
  (Recife→Jaboatão). Regra do encaixe: **informa mas não barra.** A fricção é enquadrada como
  **textura** (é a cidade de verdade, o oposto do Uber higienizado — princípio "não sanitiza"), mas
  **sinalizada pra quem é sensível se auto-selecionar**. Isso mantém a permissão do #2 **crível**: um
  card que só lista vantagens vira folder de vendas; admitir a fricção é o que faz confiar no resto.
  *(Campo 4 do Natuba — "encaixe honesto" — ganha requisito próprio em Recife→Jaboatão · aplica o
  princípio §I.4 ao eixo conforto)*
- **REQ-7 — Tag grátis/pago por parada.** O custo age como **filtro que compõe o dia**, não como um
  total. Cada parada **deve** marcar grátis vs. pago (ex.: cachoeira/mirante grátis, fazenda de uva
  cobra) pra o usuário montar o próprio dia. *(P12)*
- **REQ-8 — Camada que EQUIPA (o "COMO", Nível B rico) — e a permissão BIDIRECIONAL.** O roteiro
  **deve** carregar o preparo tácito: mapa offline onde o sinal cai, "siga sempre o asfalto", 1ª
  marcha no barro, levar papel higiênico, levar **dinheiro vivo** (distinguir o motivo: **sinal** vs.
  **preço**), agendar fazendas antes. **Ampliação de Salvador — segurança por baixo perfil:** a
  camada que equipa inclui **como não virar alvo** (na capital, andar na malha local deixa o turista
  **menos visado** que alugar carro e estacionar no centro histórico). Isso dá **dentes à permissão
  do modo #2**: "é tranquilo" deixa de ser platitude oca e passa a ter **mecanismo concreto** ("é
  mais seguro *porque* você fica menos visado"). Nota de escopo: o **eixo-crime**, aposentado no
  rural (P10 — "não me senti ameaçado no caminho"), **reabre no urbano**. **A permissão é
  BIDIRECIONAL** (Praia do Sossego): além de permissão de **ir** (Salvador: "é seguro, pode"), a
  camada equipa com permissão de **abortar** ("se a poça está cheia, opaca e você está sozinho, virar
  é a decisão certa, não fracasso"). O instinto #2 não é "sempre empurrar pra frente" — é **remover a
  dúvida infundada**, e às vezes isso se faz **autorizando o recuo**. *(P10 · ampliado em Salvador e
  Praia do Sossego. Esta é a casa canônica da "permissão"; o REQ-9 a usa como etapa final.)*
- **REQ-9 — Discriminador (artefato para composição de tom oposto).** Quando um roteiro compõe modos
  de **tons opostos** (#2 acalmar + #4 avisar), a ficha **não escolhe um tom** — ela carrega um
  **discriminador**: um teste que separa **alarme-falso** de **alarme-real** no mesmo sinal físico
  (a poça que ou é normal ou é armadilha). Funciona **em cascata**: (1) **teste in-situ** ("dá pra ver
  o fundo / fundo firme = passa; opaco / barro mole = não"); (2) quando o in-situ falha (sinal
  ilegível — água opaca, ocupa a estrada toda), **memória Nível B do ponto exato** (o Nível B mais
  fundo: não uma regra, a lembrança daquele hazard — "*essa* poça é laje / é buraco"); (3)
  **permissão de abortar** com default cauteloso (a permissão vem do REQ-8). Espelha o híbrido do
  REQ-12 (app sinaliza, humano decide). **Afiação da revisita da Rampa do Pepe — o discriminador tem
  DOIS formatos, conforme a estrutura do fosso:** **(a) perigo-ponto** (Sossego): hazard **discreto**,
  lido **in-situ** — é a cascata acima; **(b) rota-que-degrada** (Rampa do Pepe): o hazard é a **rota
  inteira piorando**, sem meia-volta no meio — o discriminador **não** é "leia na hora", é **decisão
  na ENTRADA** e tende ao **binário conservador** (ver REQ-10). O que dispara o formato é *onde mora o
  hazard* (num ponto vs. na rota toda) e *se dá pra ler in-situ* (proxy legível vs. proxy ruim).
  *(R1 · Praia do Sossego · dois formatos na revisita da Rampa do Pepe)*

### A mecânica de confiança

- **REQ-10 — Decaimento + Confirmar (agora CONDIÇÃO-ciente).** A confiança de um roteiro **esfria
  sozinha com o tempo**; uma ação **"Confirmar"** a reesquenta. Toda fonte de acesso envelhece
  (Nível A auto-envelhece). **Rotas condicionais evoluem a mecânica:** a confiança deixa de ser
  `f(tempo desde a confirmação)` e vira **`f(tempo, E a condição sob a qual foi confirmada ainda
  vale)`**. As rotas estáticas são só o caso particular sem condição. Duas peças novas: (1) a
  **confirmação carrega a condição** — não é selo genérico, é *"confirmado, e estava seco"*
  ("confiável **se** seco"); (2) a rota declara uma **condição de invalidação** (ex.: "choveu > X em
  N dias") que **derruba a confiança na hora**, por cima do decaimento lento — porque o gatilho real
  é o **evento** (a chuva), não o calendário. **Recuo de Praia do Sossego — o proxy Nível A é
  FALÍVEL:** "uma semana sem chuva" deu **verde** e a estrada ainda estava empoçada (o barro segura
  água). O valor Nível A é **sinal ruidoso**, não verdade; a confiança condicional não pode confiar
  cegamente nele. **Correção da revisita da Rampa do Pepe — a FORMA da regra pode ser BINÁRIA
  conservadora, não limiar fino.** O "choveu > X em N dias" acima sugere falsa precisão; a regra real
  do fundador na Rampa é *"se houver chuva, não vá"* — tolerância zero. É **bluntness deliberada como
  segurança**, e ela é racional quando três coisas se somam: **(a)** o proxy Nível A é ruim, **(b)** a
  falha é cara (atolar, depender de sorte pra sair) e **(c)** não há aborto no meio (rota-que-degrada,
  REQ-5). A ficha **não deve fingir precisão** quando a regra honesta é um binário; a *forma* da regra
  (binária vs. limiar) é ela própria um dado Nível B. Contraste com Sossego, onde o proxy é legível
  in-situ e cabe régua fina. *(P5 · evoluído na Rampa do Pepe · proxy falível em Praia do Sossego ·
  regra binária conservadora na revisita de logística)*
- **REQ-11 — Coletar só o sinal fácil.** O app coleta **apenas a confirmação positiva**; a
  **ausência** de confirmação já rebaixa a rota automaticamente. Isso converte a assimetria mortal
  do feedback (quem passa perrengue abandona, não reporta) em feature: a segurança se faz pela
  ausência, não exige má notícia. *(P6)*
- **REQ-12 — Marcar procedência A vs B (e a condição se PARTE entre A e B).** A interface **deve**
  deixar explícito o que é Nível A (verificável remoto) vs. Nível B (só quem foi sabe) — senão o app
  parece "um cara que checou Street View por você". **Afiação da Rampa do Pepe:** numa rota
  condicional, A e B se **combinam num só campo** — o **valor** da condição é Nível A ("choveu?"
  qualquer um checa na previsão) mas a **regra** (qual condição importa + o limiar) é Nível B (só
  quem atolou ali sabe). **O fosso é a regra, não a leitura.** Consequência operacional
  (**híbrido**, ligado ao REQ-8): o app **puxa o Nível A e sinaliza/alerta**, mas **não decide** — a
  régua fina e o go/no-go final ficam com o usuário, guiados pela regra Nível B. Co-piloto, nunca
  piloto automático. **Promoção de Praia do Sossego — o erro do proxy vira requisito:** a ressalva do
  microclima (previsão num ponto ≠ aquela estrada encharcou) deixa de ser rodapé; a ficha de uma rota
  condicional **deve declarar como o proxy Nível A falha ali** ("aqui, seca no céu ≠ estrada seca — o
  barro segura água por dias"). E o Nível B ganha um grau mais fundo: de "a regra/limiar" para **a
  memória do ponto exato** (aquela poça específica). **Afiação da revisita da Rampa do Pepe — o proxy
  é FALSO-SEGURO no limiar baixo:** a previsão dizia **chuva leve** e chuva leve **já** atolou. Não é
  só que o proxy atrasa (Sossego) — a própria **categoria** "chuva leve" sub-sinaliza brutalmente. A
  ficha condicional deve gritar *quão pouco basta* ("aqui, chuva leve JÁ atola; não espere chuva
  forte") — é a mesma razão pela qual a regra vira binária (REQ-10). *(P3 · afiado na Rampa do Pepe ·
  proxy falível + Nível B do ponto em Praia do Sossego · proxy falso-seguro no limiar baixo na
  revisita de logística · detalhamento pendente em L3)*

### Cold start, negócio e risco do fundador

- **REQ-13 — Motor de confirmação inicial = o fundador.** Na Fase 1 a cadência semanal do canal do
  João é o que mantém as rotas quentes. Significado operacional do Risco nº1: quando ele para, as
  rotas esfriam. **Exceção parcial (Rampa do Pepe):** rotas **condicionais** podem **auto-esfriar**
  lendo o Nível A (a chuva invalida a confiança sozinha, sem humano) → afrouxam a dependência do
  fundador **pra essa classe** de rota. Mas o **limiar** Nível B ainda precisa de humano pra
  calibrar, e o auto-esfriamento cria uma dependência nova de dados de previsão. *(P7 · Rampa do
  Pepe)*
- **REQ-14 — 2º confirmador como seguro de vida, cedo.** Existe uma janela de bootstrap (~3 meses)
  onde solo é aceitável (nada a proteger). Depois dela, um **2º confirmador é obrigatório** — não
  luxo de Fase 2. *(P7)*
- **REQ-15 — Métrica-farol "engrenou".** = confirmações de OUTROS vencerem o decaimento em **≥3
  rotas**, sem o João empurrar (= o Risco nº1 se dissolvendo). *(P8)*
- **REQ-16 — Saída do fundador em rampa com histerese.** A retirada do João é uma **rampa vigiada**
  (condição sustentada por semanas enquanto recua gradual), **nunca um penhasco**. "Engrenou" não
  autoriza parar cedo. *(P9)*

---

## Parte III — Aberto (ainda não decidido)

### Decisões de UX / modelo (como o trust-data aparece) — FECHADAS na v2.1

> Resolvidas projetando a **ficha como um artefato único** (não 6 decisões soltas), com o modo de
> falha (L4) como espinha. Detalhe e percurso em
> `./deep-dives/ficha-anatomia-decisoes-ux-L2-L7-2026-07-28.md`. Nenhuma criou requisito novo — todas
> **detalham** REQ-1/2/3/6/7/8/9/10/11/12 e o princípio §I.4.

- **L4 — declarar o modo de falha (keystone):** **HÍBRIDO** — campo interno (autor declara → **tom =
  atributo explícito derivado do modo, checável** pelo sistema) + **duas camadas** ao usuário
  (**rótulo reutilizável escaneável** na lista + **frase editorial sob medida** na ficha aberta).
  Compostos: tons compatíveis **fundem** (1 frase), opostos **comutam** (→ discriminador, L7).
- **L3 — Nível A vs B:** procedência por **CONTRASTE** — o **Nível B brilha** ("só quem foi sabe"), o
  **Nível A é texto plano** sem selo. Sem etiqueta simétrica. Resolve o medo do REQ-12
  (Street-View-checker) porque o que chama atenção é o que o mapa não dá.
- **L2 — rota-armadilha (só modo #1):** **revelação sob demanda** — mapa mostra só a rota certa; a
  armadilha + o "porque Z" abrem num gatilho *"por que não pela rota óbvia? →"* **redigido pra vender
  valor** (o gatilho já sinaliza que o app sabe de algo).
- **L5 — condição de invalidação:** **semáforo co-piloto** — app computa regra(B) × previsão(A), mas
  **nunca como veredito**, sempre colado à **ressalva de falha do proxy** ("céu seco ≠ estrada seca;
  confirme no ponto"), que vira cidadã de 1ª classe da ficha condicional (Nível A é sinal falível).
- **L6 — 2 camadas do roteiro-método:** método como **entidade-mãe (hub)** — fonte única herdável,
  cada instância aponta pra cima + carrega sua **âncora** não-fungível, navegação irmã↔irmã, lente de
  browse. (Quantos métodos na Fase 1 = decisão de escopo.)
- **L7 — discriminador sem falso-aborto:** **proeminente + equipador + seguro** — aparece cedo e com
  destaque (nada escondido), enquadrado como *equipar* ("você vai saber ler a poça na hora"), não
  alarmar, com **default cauteloso** (sinal ilegível / sozinho → abortar sem culpa, REQ-8). Materializa
  a comutação #2+#4.

### Testes de ideia que ainda faltam (roteiros)

- ~~**Par de composição NOVO**~~ ✅ **FEITO (2026-07-29 — teste de Marinho #1+#4).** Resultado melhor
  que confirmar: a regra **não** depende do par, e o critério não era "tom" — era a **relação entre os
  modos**. Nasceu o **3º regime RAMIFICAR** (a condição escolhe o artefato) e o reframe "mesma
  decisão". Detalhe: `./deep-dives/marinho-composicao-ramificar-2026-07-29.md`. **Curiosidade não
  testada (não é pendência):** um ramificar cujo galho alternativo **também** traz perigo (aí
  ramificar + comutar se combinariam) — só com rota real.
- **Perfil (B) / logística pesada — RECLASSIFICADO como eixo de expansão (não mais lacuna).** Já foi
  **parcialmente tocado**: Salvador (sem carro, urbano/baixo-risco), Praia do Sossego (acesso difícil,
  de carro) e a **revisita da Rampa do Pepe (2026-07-29)** — que rodou o teste na experiência real do
  João e **não** pariu modo #5 (*"simplesmente não iria"* mantém o fosso na decisão #4), só afiou
  REQ-5/9/10/12. A logística **pesada de verdade** (sem carro, barco+van em janela apertada, pernoite,
  ficar preso) **não foi testada** — mas, pela decisão de escopo do §I.5, **isso deixou de ser
  pendência**: é **expansão futura**, não buraco a preencher. Quando/se um dia entrar, precisa de rota
  real que o João conheça (regra: não inventar). Detalhe do teste:
  `./deep-dives/rampa-do-pepe-teste-logistica-pesada-2026-07-29.md`.
- **Modo atômico #5** ainda não apareceu — a lista de modos segue aberta em princípio, mas os ângulos
  óbvios (desorientação, desistência, chegada-oca, condicional) e as duas espécies já estão cobertos,
  e o candidato mais forte (logística pesada) saiu do radar do núcleo pelo §I.5. Deixou de ser uma
  pendência ativa.

### Escopo

- **Escopo de Fase 1.** ✅ **CRAVADO na v2.2 → ver Parte IV.** (Era o último item aberto: quais dos
  REQ-1..16 entram na Fase 1 vs. depois. Resolvido reconciliando os 16 REQs contra a linha do brief +
  4 forks decididos.)

---

## Parte IV — Escopo da Fase 1 (decidido)

> **O que é:** a linha de corte da Fase 1, cravada em 2026-07-29. **Não** foi "começar do zero" — o
> brief já traçou a linha (coração = trust-data estruturado, ~5–10 roteiros temáticos do NE); o
> trabalho foi **reconciliar os 16 REQs** (que nasceram dos 6 roteiros, *depois* do brief) contra
> essa linha. A maioria encaixou direto; o valor esteve nos **4 forks** onde um REQ empurrava além do
> brief. Continua sendo trabalho de IDEIA — vira plano/PRD só quando o João sinalizar. Percurso da
> sessão: `./escopo-fase-1-WIP.md`.

**Padrão que emergiu:** três dos quatro forks caíram em **"construir a costura, não a máquina"** —
preparar o substrato/costura na Fase 1 e adiar o maquinário generalizado até haver evidência (2ª
instância). O único fork onde se foi ao caro é o **motor de confiança**, justamente porque é o
**coração** do produto — o trust-data não pode ser fingido com um carimbo.

### Dentro da Fase 1 (o mapa-base — brief já pede, REQs detalham)

| REQ | Entra porque |
|-----|--------------|
| **1** ficha 7 campos | o trust-data estruturado (coração) |
| **2** relevo variável | editorial destaca o que pesa |
| **3** declarar modo | dá o ângulo/tom editorial |
| **4** cadeia de waypoints | o artefato anti-cilada |
| **6** encaixe honesto / fricção | declarar; informa, não barra |
| **7** tag grátis/pago | custo como filtro |
| **8** camada que equipa (o COMO) | o Nível B rico, o fosso |
| **12** procedência A/B | "cria info, não agrega" (holofote no B) |
| **13** motor de confirmação = fundador | realidade operacional, não feature |

### Resolvido pelos 4 forks

| Fork | Decisão | Entra na Fase 1 | Fica pra depois |
|------|---------|-----------------|-----------------|
| **1 · Frescor** (REQ-10/11) | **Motor completo** | A mecânica de confiança **inteira** (REQ-10/11/12): decaimento + Confirmar + **invalidação por condição/evento** (a chuva derruba a confiança na hora, por cima do decaimento lento) | — (é o coração; construído real, não fingido com carimbo) |
| **2 · Roteiro-método** (REQ-1 / L6) | **Hub pobre** | Card de método escrito **1×**; as 2 instâncias (Salvador, Recife→Jaboatão) apontam por **link/referência** | A entidade-mãe formal do L6 (herança, nav irmã↔irmã, lente de browse) → quando surgir um **2º tipo** de método (abstração vem de 2+ métodos, não de 1) |
| **3 · Reputação** (REQ-14) | **Só o substrato** | Modelo **multi-confirmador** + os **2 sinais separados** (frescor ≠ reputação/quem confirmou); pronto pro 2º confirmador **plugar** quando a janela de bootstrap (~3 meses) fechar — REQ-14 entra como **capacidade** | A pontuação/escada: crédito emprestado, rank→curador — **a ponte Fase1→Fase2** (o brief já manda o ranking pra lá) |
| **4 · Condicional** (REQ-5 macro / REQ-9 / L5 / L7) | **Discriminador pobre** | **Semáforo co-piloto (L5)** — a cara do motor do Fork 1 · **1 rota condicional #4** (Rampa do Pepe) · **1 rota de tom oposto #2+#4** (Praia do Sossego) com o **discriminador escrito como editorial sob medida + a ênfase do L7** (proeminente/equipador/seguro, default cauteloso) | O **componente generalizado** de discriminador em cascata → quando surgir uma **2ª** rota de tom oposto |

### Fora / adiado (inalterado do mapa-base)

| REQ | Por quê |
|-----|---------|
| **15** métrica-farol "engrenou" | instrumentação / norte, não feature de build |
| **16** saída do fundador em rampa | futuro distante |

### Nota sobre a cesta inicial (~5–10 roteiros)

A cesta **não** é só de rotas fáceis: inclui deliberadamente **1 condicional** (Rampa do Pepe) e **1
de tom oposto** (Praia do Sossego), pra exercer o motor de confiança e o discriminador na prática. Os
roteiros-método (Salvador, Recife→Jaboatão) entram como par do "hub pobre". O resto completa com
roteiros-lugar de modo estático/tom único.

---

## Apêndice — Rastreio rápido

- **Princípios/decisões travadas:** P1(afiado)–P15 no doc do Natuba. **Princípio §I.4 "co-piloto em
  todo eixo"** (emergente, nomeado em Recife→Jaboatão). **Princípio §I.5 "teto de aventura + porta de
  expansão"** (decisão do João 2026-07-29: coração = bate-e-volta ~Rampa; expedição/multimodal =
  expansão futura, não núcleo).
- **Padrões graduados a requisito:** R1 (modo de falha, ex-P16 · +famílias · composabilidade em **3
  regimes**: fundir/comutar/ramificar) · R2 (relevo, ex-P13) · R3 (razor da alma, ex-P15 · +duas
  espécies · roteiro-método CONFIRMADO).
- **Roteiros-fonte (o que cada um doou):**
  - **Natuba** — exploratório, gerou o modelo (7/7 fechado).
  - **Monte das Tabocas** — confirmatório, graduou R1/R2/R3.
  - **Rampa do Pepe** — modo #4 condicional; evoluiu a mecânica de confiança e o envelope temporal.
    **Revisita (2026-07-29, teste de logística pesada):** sem modo #5; afiou REQ-5 (aborto na entrada em
    rota-que-degrada), REQ-9 (dois formatos de discriminador), REQ-10 (regra binária conservadora),
    REQ-12 (proxy falso-seguro no limiar baixo). Perfil-B/multimodal sem carro segue não testado.
  - **Salvador** — urbano; composabilidade (#2+#3 fundem), espécie roteiro-método, custo protagonista,
    segurança por baixo perfil.
  - **Praia do Sossego** — composição perigosa (#2+#4 comutam); discriminador, Nível A falível,
    permissão bidirecional.
  - **Recife→Jaboatão** — roteiro-método confirmado; fricção/encaixe honesto; princípio co-piloto.
  - **Marinho (PB)** — teste de composição #1+#4; reframe "mesma decisão" + 3º regime **RAMIFICAR**
    (condição escolhe o artefato); cadeia de waypoints condicional; unifica a Rampa como caso de galho
    vazio.
- **Nota de numeração (v2.0):** os requisitos foram renumerados por tema. Os deep-dives são fotos
  datadas e citam os números da época — em especial "REQ-15 (discriminador)" do Sossego = **REQ-9**
  aqui, e "REQ-16 (fricção)" do Recife = **REQ-6** aqui. Este doc é a autoridade viva.
