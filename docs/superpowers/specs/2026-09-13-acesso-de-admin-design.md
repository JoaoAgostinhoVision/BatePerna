# Acesso de admin — desenho

**Data:** 2026-09-13
**Estado:** aprovado em conversa, seção por seção. Nada implementado.
**Decidido por:** João (as quatro escolhas do brainstorm estão citadas abaixo, literais).

---

## 1. O que isto é, e o que não é

O app não tem hoje **nenhuma** noção de usuário: zero login, zero sessão, zero cookie de
identidade. O `POST /api/confirmar` aceita qualquer um, quantas vezes quiser. O único estado por
pessoa é a fila offline no `localStorage`.

A conversa começou em "acesso de usuários" e separou-se em **dois sistemas diferentes**, que só se
parecem porque os dois se chamam "login":

| | **conta de admin** | **conta de usuário** |
|---|---|---|
| quantas pessoas | 1 (o João) | muitas |
| obrigatória? | pra ele, sim | **não** — *"seria algo não necessário para usar"* |
| pra quê | editar ficha, corrigir carimbo, publicar aviso — do celular | levar os dados pra outro celular + *"recursos que serão implementados futuramente"* |
| risco se vazar | **o app inteiro** | os dados de uma pessoa |
| depende de quê | de nada | **dos tais recursos futuros existirem** |

**Este documento desenha só a conta de admin.** A conta de usuário fica para depois, quando os
recursos que ela destrava tiverem nome — hoje ela não teria o que guardar, e construir a caixa
antes do conteúdo é exatamente como o v1 ficou verde demais.

Quando a conta de usuário chegar (com login social, que foi o pedido), ela entra como **sistema
separado**. Não é falta de reuso: é manter o que tem risco alto longe do que tem risco baixo, que
foi a razão de separar os dois em primeiro lugar.

### Não-objetivos, explícitos

- Contas para quem usa o app.
- Login social (Google/Instagram/Facebook) — pertence à conta de usuário.
- Qualquer parede entre a pessoa e a pergunta "dá pra ir hoje?".
- Métricas/analytics.
- Moderação de conteúdo de terceiros — ninguém além do João escreve.

---

## 2. A régua que decide a arquitetura

O projeto já tem a regra escrita, em `nuncaCachear`:

> *"Placar e cron nunca saem do cache. O resto da ficha é verdade parada; o placar não é."*

Os quatro itens que o João marcou caem exatamente nessa linha:

| o que ele quer mudar | natureza | onde cai | latência |
|---|---|---|---|
| publicar um aviso no lugar | apodrece | **Turso** | instantâneo |
| forçar/corrigir o carimbo | apodrece | **Turso** | instantâneo |
| editar o texto da ficha | verdade parada | **Git** (API do GitHub) | ~2 min |
| criar ficha nova | verdade parada | **Git** | ~2 min |

Verdade que apodrece precisa ser instantânea. Verdade parada é **afirmação sobre lugar real** e
precisa ser **versionada** — tem que dar pra saber quem disse o quê, quando, e voltar atrás.

As duas alternativas foram consideradas e recusadas:

- **Tudo no banco:** o acervo sai do repo. `loadAll` deixa de ser build-time, as fichas deixam de
  ser pré-renderizadas, boa parte da suíte muda de natureza, e **perde-se o histórico de quem
  escreveu o quê sobre um lugar real** — que neste projeto é a linha vermelha.
- **Tudo no Git:** um aviso de "ponte caiu" levaria ~2 min e um redeploy. Aviso urgente com
  latência de build é aviso que chega tarde.

---

## 3. O ganho que não é de conveniência

Hoje toda palavra que o app diz sobre um lugar ou é campo de ficha, ou é redação minha que o João
teve que ler e aprovar — e esse ciclo **já falhou uma vez**, em setembro, quando publiquei prosa
minha assinada como a voz dele.

Com o painel, as palavras passam a ser dele **por construção**, e o commit é autorado por ele: a
procedência deixa de ser disciplina minha e vira `git blame`. Dá pra perguntar *"quem escreveu isto,
e quando"* e obter resposta de máquina.

Isto é o motivo principal do projeto, não um efeito colateral.

---

## Seção 1 — A porta

### Desenho

Uma senha, virando um cookie de sessão assinado. **Sem tabela de usuários, sem dependência nova.**

Duas variáveis de ambiente, criadas pelo João com as próprias mãos no Vercel:

- `ADMIN_SENHA` — o que ele digita
- `ADMIN_SEGREDO` — a chave que assina o cookie

> ⚠️ Eu não manuseio, não escrevo e não peço credencial em texto. Ele gera e configura.

**Fluxo:**

1. `GET /admin` sem cookie válido → caixa de senha.
2. `POST /api/admin/entrar { senha }` → compara em **tempo constante** com `ADMIN_SENHA`.
3. Sucesso → `Set-Cookie: bp_admin=<payload>.<hmac>` com `HttpOnly; Secure; SameSite=Strict;
   Path=/; Max-Age=7d`.
4. Toda rota `/api/admin/*` e a página `/admin` exigem o cookie, verificado em tempo constante.
5. `POST /api/admin/sair` limpa o cookie.

`payload` é `{ exp }` (unix). Assinatura HMAC-SHA256 com `ADMIN_SEGREDO`, via `node:crypto`.

### Onde a lógica mora

`src/lib/admin-sessao.ts`, **puro**, com segredo e relógio **injetados**:

```ts
criarSessao(segredo: string, agora: number, duracaoS: number): string
lerSessao(segredo: string, token: string, agora: number): { valida: boolean; motivo?: Motivo }
senhaConfere(esperada: string, recebida: string): boolean   // tempo constante
```

A rota só faz IO (ler env, ler/gravar cookie). É a lição que este projeto já pagou duas vezes:
código dentro do handler é código sem prova — a mesma razão pela qual `resolverNavegacao` e
`aquecer` moram em `cache-rotas.ts` e não no `sw.ts`.

### Três decisões que são de segurança, não de estilo

1. **Falha fechada, sempre.** Sem `ADMIN_SENHA` configurada, o admin **não existe** — 404 em
   `/admin` e em todo `/api/admin/*`. Uma variável de ambiente que some não pode virar painel
   aberto.
2. **Senha curta desliga o admin**, com motivo explícito no log do servidor — nunca na tela:
   explicar na tela contradiria a decisão 1, e falha fechada vence (ruling da revisão final,
   2026-09-16). Menos de 24 caracteres e ele se
   recusa a funcionar. Isso torna a senha fraca **impossível** em vez de pedir cuidado — e esta
   senha é a chave do app inteiro. Mesmo formato do prazo obrigatório na Seção 2.
3. **`/admin` entra em `RESERVADOS`** (`src/lib/despacho.ts`).

   🔴 **Achado concreto, e teria virado defeito:** `ehCaminhoDeFicha("/admin")` devolve `true`
   hoje — um segmento, sem ponto, fora de `RESERVADOS`. O service worker trataria o painel como
   ficha: guardaria em `CACHE_ULTIMA_FICHA` **e sob `CHAVE_ULTIMA`**, o ponteiro da última ficha
   aberta. Abrir o app sem rede levaria ao **painel de admin** em vez da home. O próprio código já
   deixou o remédio escrito — *"Se nascer outra, entra aqui"* — mas é silencioso.

### Dois detalhes que somem se não forem escritos

- **`/admin` sai do índice**: `robots: { index: false, follow: false }` no metadata da página. Um
  painel de admin no Google é um convite.
- **`/admin` fora do precache do PWA**: ele não é parte do app offline, e guardar tela de admin no
  celular é superfície de risco sem contrapartida.

### Deliberadamente fora

**Limite de tentativas por IP.** Com uma senha de 24+ caracteres aleatórios, força bruta não é o
risco real, e o limite exigiria tabela e estado novos. Fica registrado como omissão consciente, não
como esquecimento. Se o João preferir ter, entra.

### Como se prova

- assinatura rejeita token adulterado (byte trocado no payload, byte trocado no hmac)
- cookie expirado não entra; cookie no limite exato do prazo decide de um jeito só
- `senhaConfere` é de tempo constante (não retorna cedo na primeira divergência)
- sem `ADMIN_SENHA` → 404, não 401 e não 200
- `ADMIN_SENHA` curta → admin desligado (404 igual), com motivo no log e não na tela
- `ehCaminhoDeFicha("/admin") === false`, e o service worker não guarda `/admin`

Cada um com mutação medida, pelo método de sempre (o script prova que mutou antes de rodar).

---

## Seção 2 — O aviso e o carimbo

### Dois achados que evitaram caminho paralelo

1. **O gancho do override já existe.** `resolverEstado(ficha, debug?)` já aceita estado forçado —
   é o `?debug=` que o João usa pra conferir cor no celular. O aviso do dono entra **no mesmo ponto
   de decisão**, vindo do banco em vez da URL.
2. **O vocabulário é estreito.** O motor só responde `fresco | frio` — ele só sabe de chuva.
   `fechado` não é estado, é **fase**, e hoje só nasce de `horario`/`dias`. *"A rampa está em
   reforma"* é exatamente um `fechado` que não vem do calendário, e **hoje o app não tem como
   dizer isso**.

### O modelo

Aviso e override são **a mesma coisa com um campo a mais**. O que o João digitaria:

| o que ele escreve | o que quer dizer |
|---|---|
| "a rampa está em reforma" | não vá — e não é a chuva |
| "choveu ontem mas o barro secou" | pode ir, apesar do motor |
| "a ponte caiu, tem desvio pela direita" | vá, mas saiba disso |

É sempre **uma frase dele + o que ela faz com o veredito**.

```sql
CREATE TABLE IF NOT EXISTS avisos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_slug TEXT    NOT NULL,
  texto      TEXT    NOT NULL,
  efeito     TEXT    NOT NULL,   -- nenhum | fresco | frio | fechado
  criado_em  INTEGER NOT NULL,
  vence_em   INTEGER NOT NULL,
  retirado   INTEGER NOT NULL DEFAULT 0
)
```

**Append-only.** O vigente é o mais recente do slug com `vence_em > agora` e `retirado = 0`.
Retirar é `UPDATE retirado = 1`, nunca `DELETE`. Histórico de graça — e num app cuja linha vermelha
é procedência, saber **o que foi dito sobre um lugar e quando** não é luxo.

Vai no `ensureSchema` de `src/lib/db.ts`, ao lado de `freshness` e `confirmacoes`.

### Quem ganha

**O aviso do dono ganha do motor, sempre.** Ele sabe mais que a chuva.

Uma função pura decide, longe de qualquer handler:

```ts
aplicarAviso(leitura: LeituraCarimbo, aviso: Aviso | null, agora: number): LeituraCarimbo
```

Aviso vencido ou retirado é `null` na entrada — a expiração é decidida em um lugar só.

### Três decisões, e o porquê

1. **Prazo obrigatório**, com atalhos (amanhã / 3 dias / 1 semana / 1 mês / 6 meses) e renovação
   num toque. O projeto já tem a regra: *"texto fixo com acervo pequeno é mentira agendada"*. Aviso
   sem validade é a mesma mentira agendada — *"em reforma"* ainda no ar em março. Prazo obrigatório
   torna isso **impossível** em vez de pedir que ele lembre.
2. **Um aviso vigente por lugar.** Dois ao mesmo tempo é conflito de efeito e confusão na tela.
3. **Bloco próprio na ficha, com a data** ("publicado há 2 dias"). Ele **não pode encostar** na
   *voz de quem conhece* — são procedências diferentes, e essa distinção é o app inteiro.

### A tela

`/admin` lista as 3 fichas, cada uma com o que o motor está dizendo **agora** e o aviso vigente, se
houver. Toca numa → texto, efeito, prazo, publicar. Botão de tirar. Abre destacando o que vence em
breve.

### O limite honesto

O aviso viaja pelo `/api/carimbo` e `/api/carimbos`, junto com o carimbo — então tem a **mesma
validade offline que o carimbo já tem**. Quem abriu a ficha depois do aviso publicado o leva
guardado; quem abriu antes, não. Não dá pra fazer melhor sem mentir sobre frescor.

Um aviso `fechado` guardado offline vale até o próprio `venceEm` — o relógio do celular o
encerra sozinho no prazo que o dono deu; já uma retirada ANTECIPADA só alcança o celular na
próxima busca ao `/api/carimbo` que der certo.

### Como se prova

- `aplicarAviso` com cada um dos quatro efeitos, e o motor perdendo em todos
- aviso vencido não aplica; aviso retirado não aplica; o limite exato do `vence_em` decide de um
  jeito só
- dois avisos no mesmo slug → vence o mais recente
- `DELETE` nunca acontece (o histórico sobrevive a uma retirada)
- a ficha renderiza o aviso em bloco separado da `voz`, e com data
- o efeito `fechado` produz a mesma fase que o horário produz, sem duplicar vocabulário

---

## Seção 3 — Editar a ficha, via Git

### Não é um editor de JSON

Os campos se dividem em dois tipos com riscos opostos:

- **Prosa** — `voz`, `promessa`, `premio`, `acesso`, `avisos`, `secaRapido`, `regra_texto`,
  `ressalva_proxy`, `rotulo_escaneio`, `custo.valor`, `custo.curto`, `waypoints[].nome`/`.nota`,
  `discriminador.*`. Palavra dele sobre o lugar. Risco baixo, valor alto.
- **Máquina** — `condicao.regra` (`limiar_mm`, `janela_previsao_horas`, `janela_passado_horas`),
  `condicao.coords`, `severidade`, `dias`, `horario`, `piso`, `carroComum`, `custo.tag`, `modos`.
  **Mudam o veredito em silêncio.**

Trocar `limiar_mm` de 5 pra 15 muda o que o app diz sobre uma serra real, e nada na tela avisa.

**Por isso os campos de máquina ganham consequência à vista:**

- escolher `severidade` mostra **as palavras exatas** que vão ao ar — reusando `falaMolhada`
- mexer em `dias` mostra *"isto vai FECHAR a trilha de segunda a sexta"*
- mexer na `regra` mostra o veredito que ela produziria **com a chuva das últimas horas**

Ele decide vendo o efeito, não o número.

### O caminho de uma edição

1. Lê o JSON atual **do GitHub** (não do disco do build — senão duas edições se atropelam).
2. Aplica a mudança.
3. **Valida** com `fichaSchema.parse` **e** com as regras de coerência do acervo.
4. `PUT /repos/{owner}/{repo}/contents/content/fichas/{slug}.json` com o `sha` do arquivo atual —
   se alguém mexeu no meio, **falha** em vez de sobrescrever.
5. Vercel redeploya. ~2 min.

O commit é **autorado pelo João** (campo `author` da API), com mensagem dizendo o que mudou.

### 🔴 A mudança de casa que o passo 3 exige

As regras de coerência do acervo **só existem como teste**: `tests/lib/coerencia-acervo.test.ts` é
quem barra janela de chuva zerada, chip que não bate com o preço, ficha emprestando a voz de outra,
prosa citando piso diferente do campo. **Não há módulo em `src/` que faça isso.**

Uma edição pelo painel passaria por cima de todas elas, e só quebraria depois, na suíte — longe de
quem editou.

Então as regras **saem do teste pra `src/lib/coerencia-acervo.ts`**, puras, sobre uma lista de
fichas, devolvendo os problemas encontrados. O teste passa a chamar o módulo (continua varrendo o
acervo real) e o painel chama o mesmo módulo antes de commitar. **Uma régua, dois consumidores.**

É a mesma espécie que este projeto já catalogou: regra que mora no lugar errado é regra que um
caminho novo não vê.

### O pior caso é brando

Se um JSON inválido escapar, o build falha e a Vercel **não promove** — a produção anterior
continua no ar. O estrago é *"a mudança não apareceu"*, não *"o site caiu"*. As duas validações do
passo 3 existem pra que nem isso aconteça.

### Credencial

O João cria um token do GitHub de escopo mínimo (só este repositório, só escrita de conteúdo) e o
põe no Vercel como `BP_GITHUB_TOKEN`. Eu não manuseio.

### Ficha nova

Mesma máquina, formulário bem maior: o schema tem 15+ campos obrigatórios e vários pedem decisão
dele (`severidade`, `regra`, `discriminador`). **Fica por último.**

⚠️ Ressalva registrada, e a decisão é dele: criar ficha pelo app colide com a regra que ele mesmo
deu em 09/09 — *"não queria acrescentar novos pontos… o mais importante não seria preencher, mas a
construção do app de fato"*. Construo a capacidade; só não quero que ela vire convite pra encher o
acervo em vez de terminar o app.

### Como se prova

- a validação recusa `fichaSchema` inválido **antes** de qualquer chamada ao GitHub
- a validação recusa o que as regras de coerência barram (ex.: janela de chuva zerada)
- `sha` divergente → falha, e **não** sobrescreve
- o módulo de coerência extraído produz, no acervo real, exatamente o que o teste antigo produzia
- a chamada ao GitHub é injetada (o teste nunca toca a rede)
- campo de máquina alterado → a tela mostra a consequência correta (as palavras de `falaMolhada`,
  os dias que fecham)

---

## 4. Ordem de construção

1. **Seção 1 — a porta.** Nada funciona sem ela, e ela é a de maior risco.
2. **Seção 2 — aviso + carimbo.** Valor no mesmo dia, e já fez falta uma vez (11/09, *"a rampa está
   em reforma"*, que virou "conflito entre fontes" por não ter onde morar).
3. **Seção 3a — mudança de casa da coerência.** Refatoração pura, com a suíte verde antes e depois.
4. **Seção 3b — editar prosa.** O grosso do valor da Seção 3, com o menor risco.
5. **Seção 3c — editar campos de máquina**, com consequência à vista.
6. **Seção 3d — ficha nova.** Por último, e só se ele quiser.

Cada etapa fecha com suíte verde, `tsc` limpo, build, mutação medida, deploy e conferência nas três
camadas — inclusive **abrir o navegador**, que já achou três defeitos que teste nenhum acharia.

⚠️ **Seis etapas não cabem num plano de implementação só.** O primeiro plano cobre **1 e 2** — a
porta e o aviso —, que juntas já entregam algo usável e não dependem de nada do Git. As etapas 3 a 6
ganham o próprio plano depois, quando 1 e 2 estiverem no ar e ele tiver usado o painel de verdade
por alguns dias. Usar antes de planejar o resto é o que evita construir a tela errada.

## 5. O que depende do João, e só dele

| item | quando |
|---|---|
| gerar `ADMIN_SENHA` (24+ caracteres) e pôr no Vercel | antes da etapa 1 ir ao ar |
| gerar `ADMIN_SEGREDO` e pôr no Vercel | antes da etapa 1 ir ao ar |
| criar o token do GitHub de escopo mínimo | antes da etapa 4 |
| decidir se quer limite de tentativas por IP | etapa 1 |
| decidir se quer "ficha nova pelo app" | etapa 6 |
