# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** O ledger da execução vive em
> `.superpowers/sdd/2026-08-11-home-hoje/progress.md`, que é **scratch git-ignorado** — um
> `git clean -fdx` o apaga. O essencial dele está aqui.

**Última parada:** 2026-08-12. **Estado: a home "Hoje" está NO AR.** Rodada fechada, mergeada
em `main` (`645ebe1`, merge `--no-ff`) e deployada em produção. **278/278**, `tsc` e `build`
limpos, árvore limpa. A branch `home-hoje` já cumpriu o papel.

**Nada em aberto no código.** O que falta é do João — e tem uma pendência dele que **ainda
não foi dita**: ver o item 1 do bloco abaixo.

---

## ▶ SE O JOÃO DISSER SÓ "CONTINUA" — comece por aqui, sem perguntar nada antes

**O jeito dele de retomar é essa palavra só.** Não devolva menu nem peça contexto.

1. **Confira o chão em silêncio** (sem narrar): `git status --short` (limpo),
   `git branch --show-current` (`main`), `git log --oneline -1` (deve ser o commit de docs em
   cima do merge `645ebe1`), `npm test --silent` (278/278). Se algo divergir, **isso** vira o
   assunto.

2. **A PRIMEIRA PERGUNTA É ESTA, e ela tem precedência sobre todo o resto:**

   > No fim da sessão de 2026-08-12, quando entreguei a home no ar, o João respondeu:
   > **"ficou legal, mas ainda faltou mais coisa, mas só vou ver isso outra sessão."**
   > Ele **não disse o que faltou**, e eu **não sei se ele chegou a abrir no celular**.

   Então abra perguntando **o que faltou** — de forma aberta, sem sugerir uma lista e sem
   tentar adivinhar. O que ele disser é a pauta da sessão. **Não presuma que é algum dos
   deferidos registrados aqui**; a frase dele veio depois de ver o resultado, e provavelmente
   é sobre a tela, não sobre a lista técnica.

   Se a resposta dele for sobre a home no aparelho, aproveite pra fechar as duas incógnitas
   de "O que só o iPhone decide" (abaixo) — principalmente: **os pins estão dentro do mapa,
   com folga?**

3. **Depois, e só depois**, ofereça a coisa que destrava o resto do projeto: **responder o
   `docs/questionario-ficha.md`**. A segunda ficha é **dependência** das fatias 2 e 3, não
   preferência — elas são invisíveis com uma trilha só. Diga isso se ele quiser pular direto
   pra elas.

4. **Não recomece nada da rodada da home.** Ela está fechada, mergeada e no ar. A lista de
   deferidos vivos está abaixo, e nenhum bloqueia.

## O que está no ar agora

- **`/` é a home "Hoje"**: mapa em cima enquadrando as trilhas, folha com os cartões, barra
  embaixo. Carimbo server-rendered no primeiro paint, sem JS.
- **Os cartões se agrupam em "Hoje o tempo deixa" / "Hoje não"** — **mas só enquanto todas as
  trilhas têm leitura confiável.** Bastando uma sem leitura (clima fora do ar, ou leitura
  vencida com a tela aberta), **os cabeçalhos somem e a folha vira lista**. Decisão do João:
  a tela para de agrupar em vez de agrupar errado. A ordem dos cartões **não muda** quando
  isso acontece.
- **`/trilhas` é o acervo** — tudo, sem carimbo, ordenado por nome.
- **A home se renova** quando o app volta pra frente (`HomeViva` → `/api/carimbos`, uma
  chamada pra todas as trilhas).
- **Sem rede, `/` abre o acervo** (não cai mais dentro da última ficha). A home **nunca** é
  gravada em cache, nem quando responde 200.
- **O cookie `bp_ultima` morreu.** O ponteiro do service worker (`CHAVE_ULTIMA`/`/__ultima__`)
  é outro bicho e continua vivo.

## O que só o iPhone decide (a única coisa que ninguém verificou)

Tudo foi medido em Chrome headless emulando iPhone. **Duas coisas dependem do aparelho:**

1. **`MAPA_JANELA_VISIVEL_HOME_PX = 350,5px`** (`src/lib/mapa.ts`) é derivada do
   `clamp(0px, 3vw, 1rem)` do CSS e foi medida no Chrome. O WebKit pode arredondar `vw`
   diferente, e as safe areas do modo standalone entram na conta. **É a constante em que o
   enquadramento inteiro se apoia.** Pergunta pro João: os pins estão dentro do mapa, com
   folga?
2. **A barra embaixo está em fluxo normal, não fixa** (`src/app/home.css`). Com uma ficha o
   documento cabe na tela; com 6 ou 8 cartões o "Hoje · Trilhas" fica abaixo da dobra.
   Registrado como Minor pela revisão; **o olho dele no aparelho decide** se incomoda.

Instalar é **pelo Safari** (Compartilhar → Adicionar à Tela de Início), não pelo Chrome.

## O que vem depois, e em que ordem

**A segunda ficha é a próxima parada, e ela destrava tudo.** As fatias 2 e 3 são invisíveis
com uma trilha só na tela — foi o achado do brainstorm que originou o questionário.

1. **João responde `docs/questionario-ficha.md`.** Uma pergunta por campo, em linguagem de
   gente. As respostas viram um JSON em `content/fichas/` e a ficha aparece sozinha na home e
   no acervo. **Eu não invento geografia; as respostas são dele.**
2. **Fatia 2 — memória:** "Fui" no aparelho + "já conheço" + aba Minhas na barra.
3. **Fatia 3 — filtros:** chips, campos novos na ficha, km com GPS, saída manual por cidade.

## Documentos desta rodada

- Spec: `docs/superpowers/specs/2026-08-11-home-hoje-design.md`
- Plano: `docs/superpowers/plans/2026-08-11-home-hoje.md`
- Questionário (o entregável que espera o João): `docs/questionario-ficha.md`
- Ledger git-ignorado: `.superpowers/sdd/2026-08-11-home-hoje/progress.md` + os
  `task-N-report.md` e `fix-*-report.md`

## Invariantes que não podem ser quebradas

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Depende de `force-dynamic`
  na home e na ficha. Página estática congela `calculadoEm` no build e todo visitante recebe
  carimbo vencido.
- **`useVenceu` devolve `false` no primeiro render, sempre.** A home também chega do cache do
  service worker com HTML velho; calcular `Date.now()` no render quebra a hidratação no
  elemento que carrega a decisão. **O agrupamento da folha agora depende disso também.**
- **Uma trilha, uma fonte.** Cartão, selo, pin **e o cabeçalho do grupo** leem o mesmo
  contexto. Foram quatro portas até aqui; a quinta nasce com o mesmo risco.
- **A regra de CSS da fase carrega `[data-state]` junto**, senão perde de especificidade e
  "SEM INFORMAÇÕES" sai em selo verde. Vale pro `.selo` e pro `.pin-home`.
- **Sem leitura o app INFORMA, não manda:** `SEM INFORMAÇÕES · tome cuidado`. `Não suba` é só
  pro barro que o motor MEDIU.
- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.**
- **Tudo ou nada no clima:** falha na busca → nenhuma trilha recebe carimbo.
- **A série de clima prova de que coordenada veio** (tolerância 0,1°, contra o arredondamento
  real de grade de 0,023°). **Slug repetido estoura no carregamento.** Os dois fecham a mesma
  coisa: o veredito de um morro no cartão de outro.
- **Nenhuma URL de trilha responde com o corpo de outra**, online ou offline.
- **Sem `next/link`.** Âncora pura. **Atribuição `© OpenStreetMap`** em todo mapa (ODbL).

## Deferidos vivos (registrados, nenhum bloqueia)

- `useVenceu` duplica o relógio do `Carimbo.tsx` (follow-up de 3 linhas).
- `home.css` não tem a regra neutra de `data-fase="conferindo"` que o `ficha.css` tem —
  inerte hoje, **bloqueia a fatia 2** se o selo da home chegar nessa fase.
- `HomeViva` usa `!== "hidden"` e `Carimbo` usa `=== "visible"`; nenhum teste cobre o ramo da
  aba oculta em nenhum dos dois.
- `MapaHome` refaz o `flatMap` que o `page.tsx` já monta.
- Cookie `bp_ultima` órfão até 1 ano nos celulares que já usavam o app (uma linha resolve).
- `ensureSchema` (`src/lib/db.ts`) declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte,
  inconsistente com `{seco,barro}`.
- `TOLERANCIA_GRAU` calibrada de um fixture (validada ao vivo contra a API, margem de 25x).
- Deploy no meio com a página aberta: chunks somem, o JS morre, a tela congela no veredito do
  primeiro paint. Mesma classe de antes, **raio maior** agora que `/` é a porta do app.
- A home não tem `<h1>`; sem `:focus-visible` em `.cartao`, `.pin-home`, `.barra-item`; os
  pins ficam dentro de um `role="img"`, que poda a subárvore pro leitor de tela (o padrão
  certo já existe no `MapaEstatico`).
- A folha não sobrepõe a base do mapa como a spec §5.3 pede (encosta, sem raio).

## Como esta rodada foi tocada (o método que está funcionando)

**SDD com subagentes**, 11 tasks: brief por task → um implementador → revisão por task
exigindo **dois veredictos** (conformidade E qualidade) → achado Important/Critical volta pro
**mesmo** implementador → re-revisão escopada. Minors vão pro ledger, não pro laço.

**Não pule a revisão da branch inteira no fim.** Nas **três** rodadas ela achou defeito que
nenhuma revisão de task pegou — desta vez um Critical.

## Lições que valem além desta rodada

1. **Teste de mutação decide qualquer discussão sobre teste.** Apague a linha, veja falhar,
   devolva, cole a saída. Esta suíte já produziu **oito** testes que passavam com o código
   apagado — três descobertos nesta rodada, dois deles **auto-referentes** (a asserção
   comparava contra a própria constante que deveria validar).
2. **Aponte o teste pro PONTO DE USO**, não pro arquivo de nome parecido. O conserto do mapa
   passou na revisão com zero proteção: revertendo uma linha do `MapaHome`, o bug inteiro
   voltava e a suíte dava 275/275.
3. **Para artefato que vira entrada de outra coisa, a prova é USÁ-LO.** Os dois defeitos do
   questionário não seriam pegos pelo teste que varre os campos — quem os pegou foi responder
   o documento e rodar o JSON resultante contra o schema.
4. **Nenhum teste desta suíte mede geometria renderizada.** Se um número de pixel importa,
   medir em navegador é a única prova. "Parece certo" não é resposta; "não medi" é.
5. **Duas conferências que compartilham a suposição não são duas conferências.** Quando mandar
   um número pro implementador, mande a derivação e peça que discordem em vez de aplicar.
6. **Defeito de junção não aparece na revisão de task.** O Critical desta rodada nasceu entre
   a Task 6 (agrupa no servidor) e a Task 8 (repinta no cliente); as duas revisões estavam
   certas sobre o próprio pedaço.

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + **o celular** + **os fatos de
roteiro**. Código, deploy e verificação eu toco. **Agentes: ele autorizou nesta rodada**; a
instrução em vigor é não usar sem pedido, então em sessão nova pergunte antes.

## Registro histórico (não refazer)

- Rodada 1 (esqueleto): merge `a179e46`. Rampa ao vivo (Versão D): `7d4bd59`. "Fui": `4b6d9a7`.
  Mapa de verdade: `a671146`. Forma de app: `6ef0fdc`. Carimbo busca leitura nova: `9c3dcf8`.
  **Home "Hoje": `645ebe1`.**
- **iPhone provado em 2026-08-10** com a versão anterior — João instalou pelo Safari e
  aprovou. A home nova ainda **não** passou por esse teste, **até onde eu sei**: em
  2026-08-12 ele disse "ficou legal, mas ainda faltou mais coisa" sem dizer se tinha aberto
  no aparelho. Não registre como provado enquanto ele não confirmar.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute).
