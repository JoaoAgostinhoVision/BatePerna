# Cidade que sai do ponto, revisão antes de publicar, e cinco consertos do celular — desenho

**Data:** 17/10/2026 · **Branch de partida:** `painel-completo` (código `f5c14de`, no ar como `dpl_b89kejYz`)
**Origem:** conversa de 17/10 com o João, que foi dizendo os pontos "aos poucos". Tudo marcado **(dele)** é
palavra ou escolha dele; tudo marcado **(meu)** é decisão minha, pra ele conferir lendo. Nada aqui está construído.

Vale pros **dois** caminhos de lugar novo, que dividem o mesmo código: o painel dele (`/admin/novo`) e o de
quem usa (`/contribuir/novo`). Fora do escopo: o **perfil de cada pessoa** (ponto 1 dele, ainda aberto).

---

## 1. Por quê

Testando o caminho de mandar lugar, o João achou três coisas:

1. *"a pessoa além de mandar a localização tem que colocar a cidade do local, isso não deveria ser automático
   com a localização?"* e depois *"se a pessoa coloca a localização do local, não há necessidade de preencher
   na mão"* **(dele)**.
2. Na tela de publicar: *"queria revisar tudo antes de mandar, ou se errei poder voltar para ajustar, sem isso
   não tem como"* **(dele)**; e *"o nome também deve ter corrigir"* **(dele)**.
3. Pediu que eu propusesse melhorias junto. De seis propostas, ele escolheu **as cinco que eu recomendei pra
   agora** **(dele)** — §5.

**Sucesso:** no celular, sem GPS (ele bloqueia localização por padrão), uma pessoa manda um lugar sem digitar
cidade, acha a região pela busca, marca o ponto, vê tudo que respondeu numa tela só, corrige o que quiser —
inclusive o nome — e publica, sem perder texto no caminho.

**Anti-objetivo:** a busca virar a fonte da coordenada. Ver §3.4.

---

## 2. A fila nova (ponto 2 dele)

Hoje: tela 1 = **nome + cidade** (`ComecarLugarNovo`, `src/app/admin/FormularioDeLugar.tsx:251-308`) →
o rascunho nasce com endereço `slugDoNome("nome cidade")` → perguntas na `ORDEM` (nome, cidade, ponto, …).

Nova **(dele)**:

1. Tela 1 pede **só o nome**.
2. O rascunho nasce.
3. Pergunta do **ponto** no mapa, logo em seguida (já é a 3ª hoje; passa a 2ª).
4. Ao gravar o ponto do waypoint 0, **o servidor descobre a cidade** pelo Nominatim reverse e grava em
   `doc.cidade`. A pessoa **não digita cidade** — não existe mais a pergunta `cidade` nesses dois caminhos.
5. **Só então** roda a checagem nome+cidade (as regras de hoje, `src/lib/par-de-lugar.ts`, sem mudança de
   regra: lugar existente e endereço antigo ocupam; rascunho não ocupa).
6. O resto das perguntas segue igual.

### 2.1 O rascunho sem cidade

O endereço hoje nasce de nome+cidade. Com a cidade chegando depois:

- **Quem usa:** a chave do rascunho já é opaca (`rascunho_<hex>`, `db-contribuidor.ts:113`); o endereço só
  mora em `doc.slug`. Sem cidade, `doc.slug` fica sem valor definitivo até o ponto; o publicar já recalcula o
  endereço de nome+cidade (`api/contribuir/publicar/route.ts:103`).
- **Painel:** a chave **é** o endereço (`ficha_rascunhos.slug`). O rascunho nasce com uma chave provisória e
  se **muda** (`moverRascunho`, `db.ts:792`, que já existe e já é usado ao corrigir nome/cidade) para
  `nome-cidade` quando a cidade chega. **(meu)** — o construtor escolhe a forma da chave provisória, desde que
  ela nunca colida com rota (`SLUGS_RESERVADOS`, `rascunho.ts:35-44`: hoje a garantia é "nome+cidade sempre
  tem hífen"; a provisória precisa de garantia própria) e nunca vá ao ar.
- **Publicar sem cidade é impossível:** `cidade` continua obrigatória no registro (`campos-da-ficha.ts:101`);
  só deixa de ser *pergunta*. A tela de revisão mostra a cidade como linha da revisão, derivada do ponto.

### 2.2 Quando a cidade não sai

- Nominatim fora do ar, demorou, ou o ponto não tem município (mar): **o ponto não grava** e a tela diz pra
  tentar de novo ou mexer o ponto. **(meu)** Nada de abrir caixa de digitar cidade.
- O reverse devolve a cidade em chaves diferentes conforme o lugar (`town`, `city`, `village`,
  `municipality`…). Testado 17/10: um ponto perto de Bom Jardim devolveu `town: "Bom Jardim"`. O construtor
  define a ordem de leitura; o que conta é **o município**, não o povoado. **(meu)**
- Ponto fora de Pernambuco (`ESTADO_DO_APP`, `lugares.ts:51`): o construtor confere o que o app já faz hoje
  com cidade fora do estado e mantém o mesmo comportamento. **(meu)**

### 2.3 Corrigir o ponto muda a cidade

Mexer o ponto do waypoint 0 refaz o reverse, regrava `doc.cidade` e refaz a checagem nome+cidade. No painel, o
rascunho muda de chave se o endereço mudou.

### 2.3.0 Nome+cidade que já existe, descoberto no ponto — **saída (b), escolha dele**

Exemplo: nome "Pedra do Navio", ponto marcado em Bom Jardim, e "Pedra do Navio — Bom Jardim" já existe.

- **O ponto e a cidade GRAVAM.** A pessoa não perde o ponto que marcou.
- A tela mostra que esse nome já existe nessa cidade, com um caminho pra **corrigir o nome**. Ela pode seguir
  respondendo as outras perguntas.
- **Publicar fica travado** enquanto o par colidir — a porta de publicar já recusa colisão hoje
  (`parOcupado`/`colisaoDoPar` nas rotas de publicar); continua sendo ela a trava.
- A revisão (§4) mostra o aviso na linha do nome.
- No painel, se a chave `nome-cidade` estiver tomada, o rascunho **fica na chave provisória** até o nome mudar;
  a chave provisória tem que valer pra todo o resto do caminho (perguntas, revisão, publicar).
- Prova por mutação: colisão no ponto **grava o ponto e trava o publicar** (as duas metades).

### 2.3.1 O "gêmeo sem cidade" fica na tela do nome **(meu)**

`par-de-lugar.ts` também recusa nome novo igual ao de um lugar publicado **sem cidade** (`gemeoSemCidade`,
só com `nomeNovo`). Essa é a única checagem que roda sem cidade, então ela **continua no nascimento do rascunho**
(tela 1, só nome) e ao corrigir o nome, como hoje. A checagem nome+cidade completa vai pro ponto.

### 2.3.2 Rascunhos que já existiam no deploy **(meu)**

Rascunho nascido do jeito antigo tem cidade digitada. Ele segue a regra nova: **gravar o ponto refaz o reverse e
regrava a cidade**, como em qualquer rascunho. Ninguém perde o ponto já gravado; a cidade digitada só muda se o
ponto for gravado de novo.

### 2.4 O que NÃO muda

- **Editar lugar já publicado no painel** (`src/app/admin/[slug]/page.tsx`, `FichaInteira`): mantém o campo
  cidade editável à mão, como válvula pra quando o município do Nominatim não for o nome certo, e **mover o ponto
  ali não consulta o Nominatim**. **(meu)**
- **Endereço de lugar publicado nunca muda** por esta rodada (regra de hoje, `api/contribuir/lugar/route.ts:38`).
- **Editar lugar publicado por quem usa** (`/contribuir/[slug]`) usa `montarPerguntasDaPessoa`, então perde a
  pergunta cidade junto; ali o ponto passa a regravar a cidade **sem travar**: se o reverse falhar, o ponto grava
  e a cidade de antes fica. Sem checagem nome+cidade ali (o endereço não muda). **(meu)** — a regra "sem cidade
  não grava" (§2.2) é só do lugar novo, onde a cidade ainda não existe.
  > **Nota de 18/10 (decisão do João no pacote de frases, `d-cidade-no-ar`):** a frase "Sem checagem nome+cidade
  > ali" deixou de valer. Quando o ponto muda a cidade de um lugar dela já no ar, o par é conferido; se colide, é
  > 409 `NOME_JA_EM_USO` e nada grava, nem o ponto. Reverse que falha e mesma cidade seguem como acima.

---

## 3. O mapa com busca (ponto 2 dele)

### 3.1 O que é

Na pergunta do ponto **sem ponto ainda**, em cima do mapa: uma caixinha de texto e um botão **Buscar** **(dele)**.
A pessoa digita uma **cidade ou o nome do lugar** **(dele: "busca pelos dois")**, toca Buscar, vê uma **lista**
de resultados e escolhe um; o mapa vai até lá. **Ela marca o ponto com o dedo**, como hoje.

- Lista, e não pular pro primeiro: "Praia do Sossego" devolveu três (Niterói, Bahia, Itamaracá).
- Resultados de Pernambuco primeiro. **(meu)** (o app é de Pernambuco; o construtor usa os parâmetros do
  Nominatim que preferem uma área sem excluir o resto.)
- Ao escolher um resultado, o mapa abre já no zoom em que o toque vale (hoje o Salvar só liga com zoom ≥ 13,
  `EditorCoordenada.tsx:452,489`) — é a melhoria 4a (§5).
- Sem busca feita, o mapa abre como hoje abre sem cidade: o quadro dos lugares publicados (`vistaDoAcervo`) ou
  o que `vistaDaCoordSemPonto` já devolve sem cidade.

### 3.2 O serviço: Nominatim, com botão **(dele)**

Política lida em 17/10 (operations.osmfoundation.org/policies/nominatim):
- **Proibido** busca-enquanto-digita. Por isso o botão. (A busca pública "Onde eu estou?", `BuscaLugar.tsx`,
  busca enquanto digita, mas usa o Open-Meteo, não o Nominatim — não muda.)
- **Máximo 1 consulta por segundo** no total, **User-Agent** que identifica o app, **guardar as respostas**,
  e **mostrar atribuição** (o mapa já mostra "© OpenStreetMap", `EditorCoordenada.tsx:438-446`).

Como **(meu)**:
- Busca e reverse passam por **rotas do servidor** do app (como `src/app/api/lugares/route.ts` faz pro
  Open-Meteo), nunca do navegador direto pro Nominatim. Só para quem tem login (painel ou Clerk).
- User-Agent fixo do app. Prazo com `AbortSignal.timeout`, no molde de `PRAZO_BUSCA_MS`.
- Respostas guardadas: o mesmo texto de busca e o mesmo ponto (arredondado) não consultam de novo. O
  construtor escolhe onde guardar; tem que valer entre recargas da página.
- O limite de 1/s é respeitado no servidor; uma segunda consulta dentro do mesmo segundo espera ou recebe
  "tente de novo" — escolha do construtor.

### 3.3 Mudança de decisão antiga

O desenho de 26/09 (`2026-09-26-painel-completo-design.md` §3.2 e risco R6) diz **"não existe busca de
endereço, de propósito"**, e o comentário de `EditorCoordenada.tsx:88-91` repete. O motivo de lá: uma busca
externa já deu a coordenada de outra cachoeira a 5 km. **Esta rodada mantém o motivo e muda a regra:** a busca
só **move o mapa**; a coordenada continua vindo do dedo de quem sabe onde fica. O comentário do código e uma
nota no desenho antigo são atualizados.

### 3.4 Anti-objetivo

A busca **nunca grava ponto**. Escolher um resultado não marca pin, não liga o Salvar, e não preenche nada.

---

## 4. A revisão antes de publicar (ponto 3 dele)

A tela de publicar (`TelaDePublicar.tsx`; páginas `admin/novo/publicar/page.tsx` e
`contribuir/novo/publicar/page.tsx`) hoje mostra só o que **falta** e a lista "o app vai calar". Passa a ser
**revisão** **(dele)**:

- **Todas as perguntas, em ordem, uma por linha:** a pergunta e a resposta. **(dele)**
- Cada linha tem **Corrigir** → aquela pergunta. **Inclusive o nome** **(dele)**. Corrigir o nome já funciona
  no servidor hoje (PUT do rascunho com o campo do nome muda o endereço e checa colisão — os dois caminhos);
  falta só a tela levar até lá.
- A **cidade** aparece como linha, e o Corrigir dela leva à pergunta do **ponto** (§2.3). **(meu)**
- O **ponto** aparece como um mapinha pequeno, não como número. **(meu)** (o app já desenha mapa estático,
  `src/app/MapaEstatico.tsx`.)
- Pergunta sem resposta: aparece destacada, com o mesmo destino de hoje. Pergunta pulada ("não sei, o app
  cala"): aparece como pulada. O botão Publicar segue com a regra de hoje.
- **Depois de corrigir, o seguir da pergunta volta pra revisão**, não pra pergunta seguinte. **(meu)**
- A forma de mostrar cada resposta (texto, lista, hora, dias, preço) é do construtor, usando os rótulos da
  melhoria 3 (§5).

Restrição: `TelaDePublicar` hoje **não** pode importar o registro nem zod (guarda em
`tests/app/admin-tela-de-publicar.test.tsx:400-420`). As linhas da revisão são montadas na página de servidor e
passadas prontas, em dado simples.

---

## 5. As cinco melhorias que ele escolheu **(dele: "as 5 que você recomendou para agora")**

Vindas da leitura de código de 17/10 (ninguém viu no celular ainda).

1. **"Próxima" não pode apagar texto.** Hoje `Próxima` (`FormularioDeLugar.tsx:217`) é link que não grava;
   quem digita e toca nele perde o texto sem aviso. Saída a escolher pelo construtor entre: (a) com texto não
   salvo, "Próxima" some ou pede confirmação; (b) na tela de lugar novo, Salvar vira o botão de seguir e
   "Próxima" vira link discreto. **Requisito:** nenhum caminho de toque leva pra outra tela com texto digitado
   e não gravado sem a pessoa ter escolhido isso. **(meu, sobre a proposta escolhida)**
2. **Sem zoom sozinho no iPhone:** letra das caixas de responder em 1rem (`admin.css` — `.adm-editor-caixa`,
   `-escolha`, `-hora`, `-numero`) e linhas de opção (dias) com área de toque ≥ 44px, a mesma do + e − do mapa.
3. **Opção com nome de gente, não de sistema:** `gratis`/`pago`, `dom`…`sab` ganham rótulo na tela
   (`EditorLista.tsx:92,109`), montado no servidor, **sem mudar o valor gravado**. As palavras dos rótulos são
   do João (§6).
4. **Mapa:** (a) escolher resultado da busca abre no zoom em que o toque vale (§3.1); (b) embaixo do mapa, no
   lugar de `-8.12, -35.29` (`EditorCoordenada.tsx:516-518`), a **cidade** que saiu do ponto. (Mapa mais alto
   fica pra depois de ele ver a tela.)
5. **A pergunta primeiro:** hoje a ordem é título → aviso de rascunho → **"Desistir deste lugar"** → "Pergunta
   N de M" → pergunta (`FormularioDeLugar.tsx:203-210`). Passa a: **pergunta no topo**, Desistir no fim da
   tela, aviso de rascunho só na primeira pergunta ou no rodapé (escolha do construtor), e a fileira de números
   de pular (28 no painel) vira só "N de M", porque a revisão cumpre esse papel. **(meu, sobre a proposta escolhida)**

---

## 6. Palavras de tela

Toda frase nova (o botão Buscar, "nenhum resultado", "não consegui achar a cidade deste ponto", "Corrigir", os
títulos da revisão, os rótulos das opções, a cidade embaixo do mapa, o que "Próxima" diz quando há texto não
salvo) nasce **`// PENDENTE`**, no molde do guarda `tests/lib/frases-da-rodada-marcadas.test.ts`, e vai num
**pacote de frases** pro João ler antes do deploy — como "Frases de quem manda". **Publicar não é aprovar copy.**
"Buscar" e "Corrigir" são palavras dele nesta conversa, mas ainda passam pelo pacote.

As perguntas do questionário têm guarda: o texto de cada uma em `PERGUNTAS` tem que existir em
`docs/questionario-ficha.md`, na mesma ordem (`tests/app/admin-formulario-de-lugar.test.tsx:316-358`). Tirar a
pergunta da cidade da ordem exige mexer nesse doc junto, sem afrouxar o guarda.

---

## 7. Restrições do projeto (vêm do histórico, não negociar)

- Todo dispatch roda **`npm test`, `npx tsc --noEmit` e `npm run build`** (branch já ficou sem compilar com suíte
  verde, 25/09).
- Testes de chamada externa usam fixture (já há `tests/fixtures/geocoding-gravata.json`); a suíte nunca bate no
  Nominatim de verdade.
- Prova por mutação nos pontos que viram porta: o reverse que não acha cidade **não grava**; a busca **não grava
  ponto**; o limite de 1/s; o "Próxima" que não perde texto.
- **Deploy só com o ok dele.** Ordem do runbook: `npm run semear` (se houver tabela nova) → UM
  `vercel --prod --yes` → `conferir-no-ar`. Push no GitHub não deploya neste repo.
- Nada de inventar fato de lugar: a cidade gravada é a que o Nominatim devolveu pro ponto que a pessoa marcou;
  nenhuma outra informação de lugar vem do Nominatim.

## 8. Fica pro construtor

Forma da chave provisória do rascunho do painel (§2.1, com as garantias ditas); onde e por quanto tempo guardar
respostas do Nominatim; como esperar o 1/s; a ordem de leitura das chaves do reverse; o desenho das linhas da
revisão; qual das duas saídas da melhoria 1; onde fica o aviso de rascunho (melhoria 5).
