# A ficha sai do JSON e o painel ganha editor — desenho

**Data:** 2026-09-24
**Estado:** desenho aprovado em conversa, seção por seção. Nada implementado.
**Decidido por:** João, em seis escolhas explícitas de brainstorm — citadas abaixo, literais.
**Pedido que originou:** *"esse painel está muito simples, me ajude a fazer um painel do adm mais
funcional, inclusive modificar por completo os itens do app"*.

---

## 0. As seis escolhas dele, antes de qualquer desenho

Este documento não tem autoridade própria: ele transcreve decisões. Cada uma foi feita com o custo
à vista, e está registrada aqui para que qualquer discordância futura bata na escolha, não em mim.

| # | pergunta | escolha dele |
|---|---|---|
| 1 | o que falta no painel de hoje | **as quatro**: corrigir texto, corrigir número/regra, criar e apagar ficha, e ver melhor o que o app diz |
| 2 | em quanto tempo a edição vai ao ar | **"tem que ser na hora"** — a ficha sai do JSON versionado e passa a morar no banco |
| 3 | o que acontece com o texto antigo | **guardar tudo, com tela pra voltar** |
| 4 | o editor cobre campo que o app não mostra | **não** — só o que vira pixel hoje |
| 5 | como construir | **fatia vertical**, começando pela `voz` |
| 6 | o que fazer quando o Turso pendurar | **só memória** — erro honesto, nunca conteúdo possivelmente velho |

### A decisão de 09/09 foi reaberta por ele, de propósito

Em 09/09 ele fechou o acervo em 3 fichas: *"não queria acrescentar novos pontos… o mais importante
não seria preencher, mas a construção do app de fato"*. A escolha 1 inclui **criar e apagar ficha**,
e a opção dizia com todas as letras que isso reabre aquela decisão.

Não é contradição, e a diferença importa para quem ler isto depois: o que 09/09 proibiu foi **eu**
sair pesquisando lugar para preencher acervo. Construir a porta que deixa **ele** pôr um lugar é
"a construção do app de fato" — e faz a ficha nova nascer da boca dele, não da minha pesquisa.

---

## 1. O que isto é, e o que não é

Hoje a ficha é um `.json` em `content/fichas/`, lido do disco por `getAllFichas()` e validado por
`src/lib/ficha.ts`. Mudar uma vírgula na voz de um lugar exige **eu** editar um arquivo e commitar.
O painel de admin que subiu em 24/09 publica aviso e mostra estado, e não toca na ficha.

**Este documento desenha:** a ficha passando a morar no banco, versionada, e o painel virando
lista → lugar, com editor de campo e histórico.

### Não-objetivos, explícitos

- **Editor para campo que o app não mostra.** `modos` e `waypoints[1..]` são carregados, validados
  e **nunca renderizados** — conferido em 24/09: `modos` não aparece em `src/` fora do schema, e
  todo uso de `waypoints` é `[0]`. Eles continuam no dado, intocados. (Escolha 4.)
- **Fazer esses campos aparecerem na tela.** É o outro eixo do app ("o que só sabe quem já foi"),
  medido em 09/09 como quase inteiro por construir. Projeto próprio.
- **Commit de volta ao GitHub.** Foi oferecido como opção B da seção do banco pendurado e
  **recusado** (escolha 6). Não há token de GitHub neste desenho.
- **Passo de prévia antes de publicar.** Foi oferecido na escolha 2 e recusado: salvar é publicar.
- **Conta de usuário, moderação, múltiplos editores.** Uma pessoa escreve neste app.

---

## 2. Onde a ficha passa a morar

### 2.1 O dado migra inteiro; o editor é que cresce campo a campo

A escolha 5 foi "fatia vertical pela `voz`". **Migrar só a `voz`** deixaria o app lendo metade do
JSON e metade do banco — duas fontes para a mesma pergunta, que é exatamente o defeito que a opção
C daquela mesma pergunta tinha e que fez ele recusá-la.

Então a fatia vertical é **o caminho de escrita**, não o dado: a ficha inteira migra agora, e o
primeiro (e único, nesta rodada) campo editável é a `voz`.

🔵 **Meu, não dele — e é a maior das minhas:** a escolha 5 dele foi "fatia vertical pela `voz`", e
esta seção **reinterpreta** o que é a fatia. Eu apresentei o ajuste na conversa e ele seguiu
adiante sem objetar, mas não há um "sim" dele sobre esta linha especificamente. Se o ajuste estiver
errado, o conserto é migrar campo a campo e conviver com duas fontes durante a transição.

### 2.2 A tabela é append-only, como `avisos`

Cada gravação é **uma versão nova do documento inteiro**:

```
ficha_versoes(
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL,
  doc         TEXT NOT NULL,   -- o JSON da ficha inteira
  autor       TEXT NOT NULL,   -- "painel" | "semente"
  criado_em   INTEGER NOT NULL
)
```

"A ficha de agora" é a versão de maior `id` daquele `slug`. Voltar atrás **grava uma versão nova**
com o conteúdo de uma antiga — nada é apagado, nunca. É a régua que a tabela `avisos` já segue
(append-only, `retirado` em vez de `DELETE`), e pela mesma razão: o que foi dito sobre um lugar
real, e quando, é a espinha deste projeto.

🔵 **Meu, não dele:** o nome da tabela, o formato de documento inteiro (em vez de versionar campo a
campo) e os dois valores de `autor`. Documento inteiro porque torna "voltar" trivial e espelha o
que o git fazia; campo a campo daria diff mais fino e leitura mais complicada.

### 2.3 Os JSON ficam no repositório, e param de ser lidos

`content/fichas/*.json` viram **semente** da migração (versão 1 de cada slug, `autor: "semente"`) e
backup histórico. Depois disso, **nenhum caminho de runtime os lê** — e isso é travado por teste
(seção 5), porque duas fontes ressuscitando em silêncio é o modo de falha desta mudança.

### 2.4 Ler do banco não quebra o modelo de render

Conferido em 24/09: `src/app/[slug]/page.tsx:23` e `src/app/page.tsx:19` já declaram
`export const dynamic = "force-dynamic"`. As páginas já renderizam a cada pedido, então a ficha vir
do banco **não introduz rebuild, ISR nem invalidação de cache estático**.

O service worker guarda a **página navegada**, não o JSON — offline continua funcionando como hoje,
servindo a última versão que aquela pessoa viu.

### 2.5 O validador vira porta, não conferência

`src/lib/ficha.ts` hoje protege contra eu errar um arquivo. Depois desta mudança ele é o que impede
**um formulário** de gravar ficha quebrada. Toda gravação valida antes de virar versão; ficha
inválida não grava e a tela diz o que está errado.

---

## 3. Quando o banco pendura

**Escolha 6: só memória.** O servidor guarda a última ficha boa que leu e serve essa se o banco
falhar. Sem cópia em memória (instância fria) **e** banco fora ao mesmo tempo: **erro honesto na
tela**, nunca conteúdo possivelmente velho, nunca conteúdo inventado.

**"Erro honesto" é uma coisa só, e é esta:** a rota cai no `error.tsx` que o app já tem desde
11/09 — a tela que diz que não deu e oferece saída, em português, sem beco. **Não** é uma ficha
pela metade, **não** é uma ficha com campos vazios, e **não** é uma frase nova inventada para esta
situação. Se a `voz` não pôde ser lida, não existe ficha para mostrar.

Isto é mais estrito do que o app é hoje, e de propósito: hoje um Turso pendurado tira o aviso e a
ficha aparece; depois desta mudança a ficha não aparece. Ele foi informado desse custo antes de
escolher, e escolheu a opção **mais** conservadora das três — a que nunca mostra a voz antiga
depois de ele a ter reescrito.

**Consequência que fica dita:** a procedência passa a ser **inteiramente** o versionamento no
banco. Não há git de socorro. Se a tabela `ficha_versoes` se perder, o que volta é a semente.

🔵 **Meu, não dele:** o prazo da leitura (reusar `comPrazo` e a constante nomeada do padrão que o
I1 trouxe em 16/09) e o fato de a cópia em memória viver por instância, não compartilhada.

---

## 4. O painel

### 4.1 Lista → lugar

Escolha dele, com a maquete à vista:

```
/admin                        /admin/<slug>
┌──────────────────┐          ┌──────────────────┐
│ Painel           │          │ ‹ Rampa do Pepê  │
│ Rampa do Pepê    │          │ NA TELA AGORA    │
│ FECHADO AGORA  › │          │ Fechado agora    │
│ Pedra Furada     │          │ abre sábado      │
│ Pode ir        › │          │ sem aviso seu    │
│ Véu de Noiva     │          │ ──────────────   │
│ Cuidado        › │          │ AVISO            │
│ + lugar novo     │          │ A SUA VOZ      › │
└──────────────────┘          └──────────────────┘
```

O quarto pedido da escolha 1 ("ver melhor o que o app diz") **não é tela separada**: é o bloco
`NA TELA AGORA`, no topo da tela do lugar. O painel de hoje já calcula isso pela mesma pipeline do
selo público (`faseDe` + `marcaDe` + `vozDaFicha`), e esse trabalho é reaproveitado, não refeito.

O `+ lugar novo` aparece na maquete que ele aprovou, mas **criar ficha não entra nesta rodada** —
ver seção 6.

### 4.2 Editar a voz

Toca em `A SUA VOZ` → campo com o texto atual → reescreve → salva. Salvar valida, grava versão
nova, e a próxima pessoa que abrir a ficha vê o novo texto. Sem passo de confirmação: salvar é
publicar (escolha 2), e o erro é desfazível pelo histórico (escolha 3).

Quem já tem a ficha guardada no celular continua vendo a versão antiga até o app buscar de novo —
o mesmo limite honesto que o aviso já tem, escrito na spec de 13/09, e pela mesma razão.

### 4.3 O histórico

Abaixo do campo, uma linha por versão: **quando** e **quem** (`você, pelo painel` / `acervo
original`). Toca numa linha, vê aquele texto, e tem **voltar a esta** — que grava versão nova com o
conteúdo antigo.

🔵 **Meu, não dele:** as duas palavras de tela (`você, pelo painel` e `acervo original`) e a
ausência de confirmação no botão "voltar a esta". Palavra de tela é escolha dele, e estas duas
entram marcadas como pendentes de leitura, no método que funcionou em 10/09: escrevo, mostro por
extenso, ele lê antes de subir.

### 4.4 O que este editor conserta, de graça

A `voz` de cada lugar é dele, mas quem a digitou fui eu — e foi exatamente aí que, em 03/09, eu
publiquei prosa minha assinada como a voz dele. Com ele escrevendo direto no painel, a procedência
deixa de depender da minha disciplina e vira **fato do dado**: a linha do histórico diz `painel`.

---

## 5. O que tem que travar

A suíte está em 1110 testes e esta mudança mexe no coração do app. As provas obrigatórias:

1. **Ninguém lê o JSON em produção.** Guarda que falha se qualquer caminho de runtime voltar a ler
   `content/fichas/`. Sem ele, as duas fontes ressuscitam em silêncio.
2. **Validador na porta de escrita**, com corpos podres de verdade — e cada corpo tem que ser
   barrado **pela guarda que o teste diz estar testando**. (Em 10/09 um fixture era rejeitado pela
   guarda errada e o teste provava outra coisa; só a mutação medida mostrou.)
3. **Banco pendurado = erro honesto.** Teste com promessa que nunca resolve, no molde do `comPrazo`
   do I1. Nunca conteúdo velho, nunca conteúdo inventado.
4. **Voltar a uma versão grava versão nova**, e a atual continua existindo no histórico.
5. **A voz continua sendo de um lugar só.** O painel serve os três; texto literal de um lugar
   vazando para outro é a espécie que este app já pagou quatro vezes — a última em 16/09, em
   arquivo novo.
6. **Mutação medida com `diff -u` não-vazio** em tudo acima. Mutação que não aplica fica verde e é
   indistinguível de mutação que sobreviveu.

---

## 6. O que fica para as próximas rodadas

Esta rodada entrega a ficha no banco, versionada, com **um** campo editável de ponta a ponta. O
resto do pedido dele é real e vem depois, nesta ordem:

| rodada | o que |
|---|---|
| **esta** | ficha no banco + versionamento + painel lista→lugar + editar a `voz` |
| 2 | os outros campos de texto (promessa, prêmio, acesso, avisos, secaRapido) |
| 3 | os campos de regra e número, com seletor em vez de texto livre (piso, dias, horário, custo, severidade) |
| 4 | **criar e apagar ficha** — o acervo muda de tamanho, e isso mexe em mapa, cache, 404 e service worker |

A ordem não é arbitrária: cada uma depende da anterior, e a 4 é a que mexe em mais lugares fora do
painel.

---

## 7. O que este documento decidiu que ele não decidiu

Recolhido para leitura rápida, porque ele disse *"pode seguir para o plano"* sem ter lido a spec:

- **a maior: reinterpretar "fatia vertical" como caminho de escrita, migrando o dado inteiro de uma
  vez** (§2.1) — apresentado na conversa, seguido sem objeção, nunca aprovado em voz alta
- nome e formato da tabela `ficha_versoes`, e versionar o **documento inteiro** (§2.2)
- os dois valores de `autor` (`painel`, `semente`) (§2.2)
- reusar `comPrazo` e cópia em memória por instância (§3)
- as palavras de tela `você, pelo painel` e `acervo original` (§4.3)
- "voltar a esta" não pede confirmação (§4.3)
- a ordem das rodadas 2, 3 e 4 (§6)

Qualquer uma delas é reversível por uma frase dele.
