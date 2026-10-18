# O painel completo — o app cumpre a lei — desenho

> **Desenho de 2026-09-26.** O plano que sai daqui é
> `docs/superpowers/plans/2026-09-26-painel-completo.md`.
> Estado do app quando este documento foi escrito: `main`, no ar, 1193/1193 em 79 arquivos.

---

## 0. A LEI — e ela é a única coisa aqui que não é minha

> *"o normal de todo app é que os dados fiquem no banco, que possa ser incluso novos lugares e que
> não seja sempre necessário mexer no código para atualizar dados mutáveis, era essa máxima que eu
> preciso nesse app"* — João, 2026-09-26

Três cláusulas:

1. **Dado mutável mora no BANCO.** Não em arquivo do repositório, não em constante do código, não em
   número cravado num teste.
2. **Lugar novo entra pelo APP.**
3. **Atualizar dado não passa por código** — nem `git`, nem build, nem deploy, nem eu.

### 0.1 A forma de entrega, e ela também é dele

> *"eu quero que organize para fazer tudo isso junto, acredito que essa tela deve ser tudo
> programado junto para evitar conflito ou problemas"*

**Uma branch, um desenho, um deploy.** As tarefas existem por dentro — é assim que este projeto acha
defeito, cada uma com prova e revisão próprias — mas **nada sobe pela metade**. Não há release
intermediário, não há tela publicada faltando o editor dela, não há campo visível e não editável.

### 0.2 A régua de custo

**Custo se mede na AUTONOMIA dele, não no meu esforço.** O número desta rodada:

> **Hoje ele faz 4 e precisa de mim para 40. No fim desta rodada ele faz 43 e precisa de mim para 1.**

O 1 que sobra é a senha do painel — ver §7.4.

---

## 1. O que isto é, e o que não é

**É:** o painel de admin passa a **mostrar e editar os 17 campos** da ficha, **criar** lugar novo e
**esconder** lugar existente, tudo do celular, sem código, sem deploy e sem mim.

### Não-objetivos, explícitos

- **Não é conta de usuário.** Continua 1 pessoa (ele). A porta é a mesma `ADMIN_SENHA`/`ADMIN_SEGREDO`.
- **Não é editor de JSON.** Nem uma caixa de JSON cru, nem um formulário de 17 caixas de texto. Cada
  espécie de campo ganha o instrumento dela (§3). 🔴 *Cumprir a letra da lei e perder o app é
  possível: um editor genérico é exatamente isso.*
- **Não muda uma vírgula da tela pública.** Nenhum arquivo de `src/app/` fora de `admin/` muda de
  comportamento, exceto os oito que aprendem a ler cadeia de waypoints (§6) e o filtro de ocultos
  (§5). A ficha que o visitante vê hoje é a que ele vê depois.
- **Não apaga nada.** Nem versão, nem lugar, nem campo. Ver §5.
- **Não escreve palavra nova aprovada.** Toda copy nova nasce `// PENDENTE` (§8).
- **Não reabre o acervo por conta própria.** A lei exige a **capacidade** de criar; quantos lugares
  existem segue sendo escolha dele.

---

## 2. A espinha: a ficha deixa de ter "um campo editável" e passa a ter uma TABELA DE CAMPOS

Hoje: `CAMPOS_EDITAVEIS = ["voz"]` (`src/lib/editar-ficha.ts:9`) — um array de um elemento, e
`aplicarCampo` faz `{...atual, [campo]: valor}`, que só alcança chave de primeiro nível e só grava
`string`.

**Passa a ser um registro declarado**, em `src/lib/campos-da-ficha.ts`, com uma entrada por campo
editável. Cada entrada diz: o **caminho** (`"custo.valor"`, `"trajeto.waypoints.0.nome"`), a
**espécie** (§3), se é **obrigatório**, e o **grupo** em que aparece na tela.

Por que registro e não `if`: é a mesma doença que a lista escrita à mão já causou três vezes neste
projeto — lista cega ao que cresceu. Com o registro, **um teste compara o registro contra as chaves
do `fichaSchema`** e falha se um campo novo entrar no schema sem entrar no painel. Campo novo passa a
nascer editável ou nascer justificado, nunca esquecido.

### 2.1 O que NÃO entra no registro, e por quê

| campo | por quê |
|---|---|
| `slug` | é o endereço do lugar. Trocar quebra link, cache offline e as 247 referências dos testes. Renomear lugar é outra rodada |
| `modos` | 🔴 **campo morto** — uma única ocorrência em todo o `src/`, a linha que o declara (`src/types/ficha.ts:47`). Ver ruling R3 (§9) |
| `condicao.regra.tipo` | é `z.literal("chuva_binaria")` — não tem segundo valor pra escolher |

Todos os outros **16 campos**, abertos até a folha, entram — inclusive os aninhados
(`custo.*`, `condicao.*`, `discriminador.*`, `horario.*`, `trajeto.waypoints[].*`).

### 2.2 `aplicarCampo` aprende três coisas

1. **Caminho**, não só chave de primeiro nível.
2. **Tipo**, não só `string`: número, booleano, lista de dias, coordenada.
3. **"Não sei"** — ver §4.

E continua fazendo a coisa que já faz e que é a porta: **revalida o documento inteiro** contra o
`fichaSchema` a cada gravação. Estoura em vez de devolver algo meio certo.

---

## 3. As seis espécies de campo, e o instrumento de cada uma

Um formulário com 17 caixas de texto é editor de JSON com botão bonito. Cada espécie ganha o seu:

| espécie | campos | instrumento na tela |
|---|---|---|
| **prosa** | `voz`, `promessa`, `premio`, `acesso`, `avisos`, `rotulo_escaneio`, `secaRapido`, `condicao.regra_texto`, `condicao.ressalva_proxy`, `discriminador.formato`, `discriminador.como_ler`, `discriminador.permissao_abortar`, `trajeto.waypoints[].nome`, `trajeto.waypoints[].nota`, `custo.valor`, `custo.curto` | caixa de texto |
| **lista fechada** | `piso`, `dias`, `custo.tag`, `condicao.severidade` | escolher de lista. **Nunca digitar** — `PISOS`, `DIAS`, `SEVERIDADES` já existem no código |
| **booleano com ressalva** | `carroComum` | interruptor, **com a frase que ele vira na tela impressa ao lado** |
| **hora** | `horario.abre`, `horario.fecha` | seletor de hora `HH:MM`, nunca texto livre (o schema tem regex) |
| **número de motor** | `condicao.regra.limiar_mm`, `.janela_previsao_horas`, `.janela_passado_horas` | número **com a consequência ao vivo** (§3.1) |
| **coordenada** | `condicao.coords`, `trajeto.waypoints[].lat/lng` | **mapa com pin que se arrasta** (§3.2) |

### 3.1 Número de motor: a consequência antes de gravar

Mudar o limiar de 5 pra 10 muda o carimbo **de hoje**. A tela mostra, antes de gravar, o carimbo que
o lugar teria com o valor novo — o mesmo padrão que o `PainelAdmin` já usa para os efeitos de aviso
(`PainelAdmin.tsx:35-43`), e pela mesma razão: **o que vai pra tela, nunca o nome do parâmetro.**

O cálculo reusa o motor de verdade (`src/lib/runMotor.ts`), não uma cópia — cópia é a espécie de
defeito que este projeto catalogou como "duas fontes pra mesma pergunta".

### 3.2 O mapa: o pin se arrasta, e a busca de endereço só move a câmera (nota de 17/10)

🔴 **O mapa deste app não é biblioteca de mapa.** É mosaico de tiles estático, markup derivado de
funções puras, **zero JS pra desenhar** (`src/app/MapaEstatico.tsx`, `src/lib/mapa.ts`). Arrastar pin
exige o **inverso** de `posicaoNaCaixa`: pixel dentro da caixa → lat/lng. É componente novo e é o
pedaço mais caro desta rodada.

🔴 **E a busca de endereço nunca traz o ponto, de propósito** (até 17/10 não havia busca nenhuma). A mesma busca externa que já ajudou este projeto
errou um preço pela metade e ofereceu a coordenada de **outra cachoeira a 5 km**. Coordenada entra
por pin arrastado à mão, sobre o mapa, por quem sabe onde o lugar fica. *Ver a memória
`nao-inventar-fatos-de-roteiros`.*

> **Nota de 17/10 (rodada "cidade do ponto"): a regra mudou, o motivo fica.** A busca existe desde
> 17/10 e **só MOVE o mapa**: uma caixa em cima do mapa do lugar novo (Nominatim, só com o botão
> Buscar), que leva a câmera ao achado no zoom de pôr o pin. Escolher um achado **não põe pin, não
> liga o Salvar, não grava nada** — o ponto continua vindo do dedo de quem sabe. O motivo de 26/09
> (a cachoeira a 5 km) continua valendo, e é exatamente por ele que a busca nunca vira coordenada.

⚠️ **Tiles são de terceiro e têm política de uso.** O uso aqui é uma pessoa, ocasional, dentro do
padrão de navegação — não é o caso que a política proíbe (o que ela proíbe é download em massa, e
foi o que matou a rodada dos tiles offline em 13/09). Nenhum tile novo é baixado em lote.

---

## 4. 🔴 "Não sei, e o app cala" — a procedência dentro do formulário

**Esta é a linha vermelha do projeto dentro desta rodada, e ela fica mais difícil, não mais fácil:**
se ele pode preencher tudo sozinho, nada de fora impede campo preenchido no chute.

A régua é a que o app já tem: **quando o app não pode afirmar, ele para de afirmar.**

### 4.1 Caixa vazia ≠ "não sei"

Todo campo **opcional** ganha dois estados distintos na tela, e eles não são a mesma coisa:

- **um valor** — o app afirma;
- **"não sei"** — a chave **sai do documento**, e o app cala sobre aquilo.

Caixa de texto vazia é **erro de preenchimento**, não é "não sei". Salvar com a caixa vazia é
recusado com a frase que diz qual dos dois ele quis.

🔴 **Por que isto não é detalhe:** `src/app/[slug]/page.tsx:105` faz `ficha.custo.curto ?? precoCurto`.
O `??` **não pega string vazia**. No dia em que o chip do custo virar editável, gravar `""` deixaria
o chip **em branco na ficha pública** em vez de cair no preço. O mesmo vale para todo campo
opcional. O remédio é de desenho, não de `if`: **`""` nunca chega ao documento.**

### 4.2 Campo obrigatório não tem "não sei"

Os obrigatórios (`voz`, `promessa`, `premio`, `acesso`, `avisos`, `rotulo_escaneio`, `condicao.*`,
`discriminador.*`, `custo.tag`, `trajeto.waypoints[0]`) não podem sair. Tentar esvaziar é recusado.

### 4.3 A tela de publicar lugar novo lista o que o app vai CALAR

Antes de publicar um lugar criado no celular, a tela mostra, **por extenso**, o que o app **deixará
de dizer** por causa dos campos em "não sei": *"este lugar não vai dizer que piso tem a via"*,
*"este lugar nunca vai fechar por horário"*. Não é aviso de erro: é o preço da honestidade, à vista.

### 4.4 Nada é pré-preenchido

Campo em branco **não** herda do lugar vizinho, **não** vem de busca externa, **não** é redigido por
mim nem por IA, **não** ganha placeholder plausível. Placeholder na caixa, quando houver, diz o que
a pergunta quer — nunca uma resposta de exemplo que possa ser salva sem querer.

---

## 5. 🔴 As regras de coerência saem dos testes e viram PORTA

**Este é o achado que reorganiza o resto do plano, e nenhuma análise anterior o pegou inteiro.**

Hoje, 15 guardas em `tests/lib/coerencia-acervo.test.ts` protegem o acervo: o chip de preço que não
bate com a linha completa, a ficha que empresta a frase de outra, a prosa que diz "barro" com o campo
dizendo asfalto, a janela de chuva zerada, o dia inventado.

🔴 **Eles são TESTES. Testes rodam no meu computador, antes do deploy. Um lugar que ele criar do
celular na terça de manhã nunca passa por nenhum deles.** "Migrar os guardas para o banco" — como se
dizia até aqui — **não resolve**: o problema não é de onde eles leem, é *quando* eles rodam.

**As regras viram um módulo de produção**, `src/lib/coerencia.ts`, que recebe o acervo e devolve a
lista de violações em português. E ele passa a ter **dois consumidores**:

1. **A porta de escrita** (`PUT`/`POST` de `/api/admin/ficha`): gravação que produz violação é
   **recusada**, com a frase da violação na tela. O dono lê *"o chip diz R$ 5 e o preço diz R$ 10"* e
   conserta.
2. **O teste que já existe**, reescrito para consumir o mesmo módulo. 🔴 **Isto é obrigatório e é a
   prova de que nenhuma regra se perdeu na mudança:** o arquivo de teste continua com os mesmos 15
   casos, os mesmos nomes e as mesmas mensagens, só que cada um chamando o módulo. Se uma regra sumir
   na extração, o teste dela fica vazio — e há um caso de não-vacuidade provando que o módulo devolve
   violação quando deve.

### 5.1 A coerência é do ACERVO, não da ficha

Quatro das quinze regras comparam **uma ficha com as outras** ("nenhuma ficha empresta o `secaRapido`
de outra"). Então a porta de escrita lê o acervo inteiro antes de aceitar. São poucas linhas por
lugar; o custo é uma consulta, e ela já existe (`versoesAtuais`).

### 5.2 Duas regras mudam de natureza nesta rodada, e é de propósito

- **"nenhuma ficha do acervo tem 2º waypoint"** (`:375`) — ela existe porque o `src/` é cego ao
  waypoint 2. §6 tira a cegueira, então **esta regra cai a mão**, junto com o comentário dela. O
  próprio teste vizinho (`:356`) manda fazer exatamente isso quando o dia chegar.
- **"o `src/` continua cego ao waypoint 2 em diante"** (`:356`) — **inverte**: passa a provar que o
  `src/` **enxerga** a cadeia.

---

## 6. A cadeia de waypoints

O schema aceita `min(1)` sem teto desde sempre; **8 arquivos do `src/` leem só `waypoints[0]`**
(10 acessos): `admin/ListaDeLugares.tsx`, `admin/PainelAdmin.tsx`, `CartaoTrilha.tsx`,
`ListaDoAcervo.tsx`, `MapaHome.tsx`, `[slug]/page.tsx` (×2), `lib/ficha-fonte.ts`, `lib/geo.ts`.

**A distinção que decide tudo:** `waypoints[0]` é **o lugar**; `waypoints[1..]` são **as etapas do
trajeto até ele**. Então:

- **continua `[0]`, e está certo:** o nome na home, o pin do mapa da home, a ordem alfabética do
  acervo, a distância "daqui" — todos falam **do lugar**;
- **passa a ler a cadeia:** o bloco Trajeto da ficha, que é o único que fala **do caminho**.

Escrito assim, a cadeia é **um arquivo de tela** mais o registro de campos — não oito.

---

## 7. Criar, esconder, e o que não existe

### 7.1 Esconder é uma versão nova, nunca um `DELETE`

`ficha_versoes` ganha a coluna **`oculto INTEGER NOT NULL DEFAULT 0`**. Esconder um lugar é **gravar
uma versão nova** com o mesmo documento e `oculto = 1`; mostrar de novo é outra versão com `0`.

**Nada se perde, e é a mesma promessa da tabela.** Não existe apagar lugar neste app — e a palavra
"apagar" não aparece em tela nenhuma.

`versoesAtuais` ganha um parâmetro: o caminho **público** pede só visíveis; o **painel** pede todos,
e mostra o escondido marcado como escondido.

### 7.2 Criar: o rascunho mora fora de `ficha_versoes`

Um lugar meio preenchido **não é uma ficha** — não passa no `fichaSchema`. E hoje **o que está em
`ficha_versoes` está no ar**, porque `versoesAtuais` não filtra nada (`db.ts:261-267`): a primeira
linha gravada já apareceria na home.

Então o rascunho mora numa tabela própria, **`ficha_rascunhos`** (`slug`, `doc` parcial, `atualizado_em`),
uma linha por rascunho, sobrescrita a cada toque. Ela é a única tabela deste projeto que **não** é
append-only, e o motivo é que **rascunho nunca afirmou nada**: o histórico existe pra guardar o que o
app já disse sobre um lugar, e um rascunho não disse.

**Publicar** = validar contra o `fichaSchema` → passar pela coerência (§5) → `gravarVersao(..., "painel", ...)`
→ apagar a linha de rascunho. A partir daí o lugar tem histórico como qualquer outro.

### 7.3 As 24 perguntas já estão escritas

`docs/questionario-ficha.md` tem **24 perguntas em português, feitas pra ele responder**, com "pular
é permitido" já decidido campo a campo (linhas 467-483). **É o desenho do formulário, e foi testado
no uso** — foi por ele que a Pedra Furada e a Véu de Noiva entraram. O formulário de criar é esse
questionário na tela, uma pergunta por vez, na ordem dele.

### 7.4 A senha fica no Vercel, e é o único item que a lei não alcança

`ADMIN_SENHA` e `ADMIN_SEGREDO` continuam variáveis de ambiente. **Senha não é dado, é chave** — e a
chave do app inteiro morar dentro do painel que ela protege é ruim. É o **1** que sobra no número da
autonomia, e é desvio consciente da cláusula 3. Ver ruling R4 (§9).

---

## 8. A copy

Esta rodada escreve **muita** palavra de tela nova: rótulo de 16 blocos, as frases de "não sei", as
recusas de coerência, o formulário de 24 perguntas, o esconder.

**Toda ela nasce `// PENDENTE: redação minha, o João ainda não leu`**, como as doze que já estão no
ar. Publicar não é aprovar. O marcador sai frase a frase, quando ele ler e disser qual serve.

🔴 **E as frases de recusa da coerência são as mais delicadas:** elas aparecem quando ele erra, no
celular, com o dedo no meio de uma edição. Elas dizem **o que está incoerente**, nunca "inválido".

---

## 9. As rulings — o que eu decidi no lugar dele, e o custo se estiver errado

| # | decisão | custo se errada |
|---|---|---|
| **R1** | **Rascunho em tabela própria**, não uma coluna de estado em `ficha_versoes` | Se errada, duplicamos o conceito de "documento de lugar" em dois lugares. Barato de desfazer: a tabela morre e vira coluna. O inverso — rascunho inválido dentro de `ficha_versoes` — obrigaria a adiar o `parse`, que é a única porta que hoje impede ficha quebrada |
| **R2** | **`oculto` como coluna nova em `ficha_versoes`**, escondida por versão nova | Se errada, cada esconder/mostrar cria uma versão que "não disse nada de novo" e polui o histórico. O contrário (coluna mutável) quebraria append-only, que é o eixo da rodada passada |
| **R3** | **`modos` fica no schema e sai do formulário** (criar grava `[]`) | Se errada, o formulário deixa de perguntar algo que ele queria responder. Matar o campo é **subtração** e exige a palavra dele — nunca minha |
| **R4** | **A senha fica no Vercel** | Se errada, ele continua precisando de mim para trocar a senha. Ficar sem chave fora do painel é pior: perder o segredo tranca o app |
| **R5** | **Coerência vira porta de produção** (§5), em vez de "migrar os guardas pro banco" | Se errada, gastamos uma tarefa extraindo regra que poderia ter ficado em teste. Se **não** fizermos, todo lugar criado do celular nasce sem a auditoria que os três de hoje têm — e essa é a linha vermelha |
| **R6** | **A busca de endereço no mapa só move a câmera, nunca grava o ponto** (§3.2; até 17/10 não havia busca nenhuma) | Se errada, arrastar pin é mais trabalhoso que digitar um nome. É o trabalho certo: coordenada errada põe o app mandando gente pro lugar errado |
| **R7** | **`waypoints[0]` continua sendo "o lugar"** em home, mapa, ordem e distância (§6) | Se errada, a home mostraria o nome de uma etapa do caminho em vez do nome do destino |
| **R8** | **Zero mudança na tela pública** além da cadeia e do filtro de ocultos | Se errada, perdemos a chance de arrumar algo de passagem. É de propósito: uma rodada, uma mudança de natureza |

---

## 10. O que trava, e o que NÃO fecha esta rodada

### Trava (nada sobe sem)

1. **A suíte verde**, `npx tsc --noEmit` limpo e **`npm run build` exit 0** — a rodada passada ficou
   sem compilar com a suíte verde porque nenhum dispatch pedia build. Todo dispatch que tocar
   `src/app/` pede.
2. **O teste que compara o registro de campos contra o `fichaSchema`** (§2).
3. **O teste de não-vacuidade do módulo de coerência** (§5).
4. **A coluna `oculto` e a tabela `ficha_rascunhos` criadas por `ensureSchema`** antes do deploy —
   `npm run semear` já chama `ensureSchema` por dentro.
5. **Toda página nova que lê banco declara `force-dynamic`.**
6. **`conferir-no-ar` depois de subir**, com marcador que só existe no código novo — checksum de
   página não prova deploy neste repo.

### Não fecha esta rodada, e está escrito para não ser esquecido

- **Renomear lugar** (trocar `slug`) — quebra link, cache offline e 247 referências de teste.
- **Conta de usuário** — segue fora; hoje não teria o que guardar.
- **Matar o `modos`** — subtração, precisa da palavra dele (R3).
- **As doze palavras de tela que já estão no ar** seguem `PENDENTE`, e esta rodada **acrescenta**
  à fila.

---

## 11. O que este documento decidiu que ele NÃO decidiu

Sete perguntas do relatório do `painel-que-cresce` seguem abertas, e **nenhuma bloqueia o plano**:

1. **Quantos lugares o acervo vai ter.** A lei exige a *capacidade* de criar; o número segue dele.
2. **Se existe um lugar esperando na fila.** Se existir, ele entra pelo painel novo no dia em que
   subir — que é o ponto.
3. **Qual campo mais o incomoda.** Como tudo sobe junto, a ordem interna das tarefas não muda o que
   ele recebe.
4. **A senha** — decidida como R4, e ele pode derrubar.
5. **`modos`** — R3.
6. **Se ele quer trajeto em etapas.** §6 dá a capacidade; usar é dele.
7. **As doze palavras** — seguem esperando, e a fila cresce.
