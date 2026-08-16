# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** O ledger da execução vive em
> `.superpowers/sdd/2026-08-13-daqui-e-filtros/progress.md`, que é **scratch git-ignorado** —
> um `git clean -fdx` o apaga. O essencial dele está aqui.

**Última parada:** 2026-08-14, **encerrada a pedido dele** ("bora deixar para depois").
**Estado: RODADA EM ANDAMENTO, parada num ponto limpo.**
Branch **`daqui-e-filtros`**, saindo de `main` em `8c88415`.
**Tasks 1–8 de 12 fechadas**, todas com revisão (e re-revisão onde houve fix round).
Suíte em **426/426**, **`npm run build` passa**, árvore limpa.
**Nada em voo:** nenhum agente rodando, nenhum fix round aberto, nenhuma decisão pendurada.
**Faltam as Tasks 9, 10, 11 e 12** — os filtros e a barra fixa.

---

## ▶ SE O JOÃO DISSER SÓ "CONTINUA" — comece por aqui, sem perguntar nada antes

**O jeito dele de retomar é essa palavra só.** Não devolva menu nem peça contexto. Ele já disse
o que quer nesta rodada; a pauta está cravada. **Não repita a pergunta "o que faltou"** — ela já
foi respondida (é o §1 da spec).

1. **Confira o chão em silêncio** (sem narrar):
   - `git branch --show-current` → deve ser **`daqui-e-filtros`**. Se estiver em `main`, é só
     trocar; a branch existe e tem os commits.
   - `git status --short` → **limpo**.
   - `git log --oneline 8c88415..HEAD` → os commits da rodada.
   - `npm test` → **426/426** e **`npm run build` → passa** (os dois conferidos no fim da sessão).
     **Rode os DOIS.** Ver a lição 9 — o build já esteve quebrado por quatro commits com a
     suíte inteira verde.

2. **Leia o ledger:** `.superpowers/sdd/2026-08-13-daqui-e-filtros/progress.md`. Ele é a memória
   da execução — tem a varredura de pré-voo, o ruling da ordem, e o estado de cada task. **Se ele
   tiver sumido** (`git clean`), reconstrua pelo `git log` e por este arquivo.

   **Os briefs das tasks que faltam NÃO dependem dele.** Estão versionados em
   `docs/superpowers/briefs/` (com um `README.md` explicando o estado do pré-voo de cada uma),
   justamente porque as emendas do pré-voo são trabalho real e sumiriam com um `git clean`.

3. **Tasks 1 a 8 estão FECHADAS. Não as reabra.** A Task 2 custou dois fix rounds, os dois
   pela mesma causa (guard sem prova de mutação), e a segunda re-revisão devolveu ADDRESSED
   depois de rodar a mutação ela mesma. Fica o precedente, porque ele decide discussões
   futuras: o implementador argumentou que um guard não precisava de teste próprio porque
   "é o mesmo padrão já provado em outro caminho"; **a re-revisão removeu o guard, viu a
   suíte ficar 12/12 verde, e o argumento caiu.** A régua deste projeto é literal — *apagar
   a linha faz um teste falhar* — e não "existe prova parecida em outro lugar".

   **Precedente irmão, da Task 3:** um Important pode ser real e mesmo assim **não abrir fix
   round**, quando não há linha a consertar naquela camada. A revisão da Task 3 mostrou que
   nada em `tests/lib/mapa.test.ts` distingue a janela visível (350,5) da caixa de geração
   (480) — mas as funções recebem a largura como argumento, então isso é **improvável de
   provar na camada pura**. O achado foi transferido pra Task 4, onde virou teste que morde.
   **Quando transferir um achado assim, registre o ruling** em vez de deixá-lo sumir.

4. **Retome a execução em `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md`**, da **Task 9**
   em diante. As 7 e 8 já saíram (o ruling mandava 8 antes de 7). Faltam **9, 10, 11 e 12**. **A ordem de execução tem um ruling e NÃO é a numeração:**

   > **1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 11, 12**

   O ruling existia porque a Task 7 escreve `ficha.esforco`/`ficha.duracao`, que só nascem no
   schema na Task 8 — na ordem escrita o `tsc` quebrava. **Isso já passou:** de 9 a 12 a ordem
   é a numérica.

   **Os briefs de 9 a 12 estão em `docs/superpowers/briefs/`** (versionados). O
   `README.md` de lá diz, task a task, o que o pré-voo já emendou e o que falta — comece por
   ele. A cópia em `.superpowers/sdd/.../task-N-brief.md` é a mesma coisa, mas é scratch.

5. **Método: SDD com subagentes, e o João já autorizou nesta rodada** (ele escolheu a opção 1
   quando ofereci). Implementador → revisão por task com dois veredictos → conserto pelo mesmo
   implementador → re-revisão escopada → **revisão da branch inteira no fim, sem exceção.**

   **A Task 9 já tem meio pré-voo feito** — o detalhe completo está em
   `docs/superpowers/briefs/README.md`. Em resumo, o brief já recebeu:
   - **A BORDA — era furo de ESPECIFICAÇÃO, não de teste.** "até 2h" com uma trilha de
     exatamente 120min: passa ou não? Eu só tinha dado 90 e 300, e dois implementadores
     razoáveis decidiriam diferente. **CRAVADO: o teto é INCLUSIVO nos dois recortes**
     (duração e distância) — é como se lê em português, e o contrário esconde justamente o
     caso que a pessoa tinha em mente. Testes de 120/121 já escritos.
   - O degrau de 240 (só o 120 era exercitado) e as três palavras de esforço uma a uma.

   **O que FALTA pré-voar na Task 9** (varrido, ainda NÃO escrito no brief):
   1. **`contarLigados` conta 5 recortes e o teste só prova 3** — apagar `esforco` e
      `duracaoMax` do array continua devolvendo 3. Falta o caso com os cinco ligados.
   2. **`lerFiltros` valida 5 campos, e o teste prova em bloco, não campo a campo** — mesma
      família do OU. `lerFiltros({soGratis: "sim"})` deve virar `false` e nada prova isso.
   3. **A borda da DISTÂNCIA** (o teste novo cobre a da duração; falta o par exato de 30 km).
   4. Conferir se `confia: false` deixa os OUTROS recortes funcionando — hoje só se prova que
      ele torna o `daHoje` inerte.

   (Nada disso se perde num `git clean`: o brief emendado está versionado em
   `docs/superpowers/briefs/task-9-filtros-puros.md`.)

6. **A lição que as duas primeiras tasks já ensinaram, e que muda os briefs seguintes:** os
   implementadores estão **acertando o código e errando onde o meu plano deixou o teste fraco**.
   Task 1 teve 4 Important, Task 2 teve 1 — **todos rotulados plan-mandated**, todos da mesma
   família: um guard ou uma regra sem teste que o prove. **Antes de despachar cada task, releia a
   lista de testes do brief perguntando "que linha do código eu posso apagar sem isto falhar?"** e
   mande o complemento junto no despacho.

   **Isso virou rotina em 2026-08-14 e paga sozinho.** Os briefs das Tasks 3, 4 e 5 já foram
   emendados no disco (`.superpowers/sdd/.../task-N-brief.md`) antes de qualquer despacho, e o
   pré-voo achou **onze furos meus**. A forma que mais se repete: **um `if` que é um OU de
   várias sub-cláusulas, com um teste só — e num OU a cláusula que dispara primeiro esconde
   todas as outras.** Aconteceu duas vezes:
   - `foraDaJanela` (Task 3): as trilhas "longe" dos meus testes caíam a oeste **e** ao sul, e
     3 das 4 bordas podiam ser apagadas com a suíte verde.
   - `lerLugares` (Task 5): o meu item de teste vinha sem latitude **e** sem longitude, e 4 das
     5 cláusulas de descarte ficavam sem prova. Pior: `typeof NaN === "number"`, então os dois
     `Number.isFinite` eram os únicos capazes de pegar NaN — o caso que o comentário da
     implementação promete tratar.

   **O achado mais grave do pré-voo até agora** (Task 5): a rota `/api/lugares` devolveria
   **200 com lista vazia** quando o serviço respondesse 429 ou 500 com corpo JSON — meu único
   teste de falha cobria o `fetch` *rejeitando*, não o serviço *respondendo mal*. A tela diria
   "não achei essa cidade" quando a verdade é "estourei a cota", e a pessoa reescreveria o nome
   dez vezes achando que digitou errado. O geocoding da Open-Meteo tem cota; não é hipótese.

   **Duas outras formas que o pré-voo pega e a revisão de task não pega**, porque o jsdom não
   as enxerga (Task 4): apagar o `"use client"` do `MapaHome` deixa a suíte inteira verde e o
   mapa parado no celular — o jsdom renderiza tudo como cliente; e esquecer o `<LocalVivo>` no
   `page.tsx` também deixa tudo verde, porque os testes embrulham na mão. Nos dois casos a
   prova é asserção de fonte / render do ponto de uso real.

   **Quarta forma, do pré-voo da Task 6: o que só aparece com o RELÓGIO.** A espera de
   digitação (`ESPERA_MS`) e o guarda da corrida (`meu === pedido.current`) tinham comentário
   justificando e zero teste. Os outros testes usam `findByText`, que espera até 1000ms — por
   isso não percebem se a busca dispara a cada tecla; e nenhum deles tinha **duas requisições
   em voo**, que é a única situação em que o guarda faz algo. Sem ele, a resposta de "Gravatá"
   chegando depois da de "Recife" repinta a lista com o lugar errado, e a pessoa toca no que
   está na tela achando que é o que pediu. **Guarda de concorrência exige relógio falso e duas
   respostas fora de ordem; não há atalho.**

   **E um erro meu que quase virou teste inútil, pego relendo o que eu tinha acabado de
   escrever:** a asserção do teste de corrida olhava `/Pernambuco/` — mas Recife e Gravatá são
   **as duas** de Pernambuco, então ela passaria com qualquer uma na tela. **Num teste que
   distingue A de B, asserte no que os diferencia**, não num campo que os dois compartilham.

## O que esta rodada faz (a pauta do João, dita por ele)

Ao ver a home no ar, ele disse **"ficou legal, mas ainda faltou mais coisa"**. Na sessão seguinte
disse o quê — três coisas:

1. **O mapa deve ser da localização dele**; sem sinal, poder escolher onde está; e daí calcular as
   distâncias, **que também aparecem nos cartões**.
2. **Faltaram os filtros na tela de hoje.**
3. **A barra do menu deveria estar fixa no fim do aparelho** — "não vi isso". (Confirmado no
   código: ela estava em fluxo normal.)

**Spec:** `docs/superpowers/specs/2026-08-13-daqui-e-filtros-design.md` (aprovada por ele)
**Plano:** `docs/superpowers/plans/2026-08-13-daqui-e-filtros.md` (12 tasks, aprovado)

### As decisões que ele tomou no brainstorm (não reabrir)

| Tema | Decisão |
|---|---|
| Pedido de GPS | **Um toque na primeira vez** ("Ver daqui"), automático depois. Nunca sozinho na abertura. |
| O que o mapa enquadra | **Você e todas as trilhas juntos**, com piso de legibilidade (zoom 8). |
| Sem GPS | **Digitar a cidade e escolher na lista.** O app guarda. |
| Recortes | Distância, "dá hoje", custo, **esforço e duração** (campos novos). |
| Forma do filtro | **Uma linha de resumo que abre um painel**, não chips permanentes. |
| De onde o painel abre | **Desce da linha e empurra a lista** (sanfona), não cortina por cima do mapa. |

O "piscar" (a home abre sem você e num instante se reenquadra com você) **ele viu desenhado e
disse que não incomoda**. É consequência inevitável da regra do primeiro render.

## Onde a rodada parou, commit a commit

| Task | Estado | Commits |
|---|---|---|
| 1 — localização pura (`src/lib/local.ts`) | **completa, revisão limpa** | `f07da0c`, `ecc0fc9` |
| 2 — contexto (`src/app/local.tsx`) | **completa**, 2 fix rounds, re-revisão limpa | `e4dbae2`, `ee28635`, `86e9658` |
| 3 — enquadrar com você (`src/lib/mapa.ts`) | **completa**, revisão Approved with comments | `6ae990a` |
| 4 — o mapa da home usa a localização | **completa**, 1 fix round, revisão **Approved** | `34f74bb`, `2feae91` |
| 5 — busca de cidade (lib + rota) | **completa**, 1 fix round, re-revisão limpa | `c1257ed`, `c1f01d4` |
| 6 — a pílula e a busca de cidade | **completa**, 2 fix rounds, re-revisão limpa | `2d48df0`, `280683e`, `fcb5875` |
| 8 — `esforco`/`duracao` no schema + questionário | **completa**, revisão limpa, zero fix rounds | `5d2f817` |
| 7 — km/duração/esforço/custo no cartão + invariante da ficha | **completa**, 2 fix rounds, re-revisão limpa | `ed4b38e`, `318231e`, `b7cb153`, `ff217df` |
| 9 a 12 | não começadas | — |

Suíte: **426/426** (a base da rodada era 278). **`npm run build` passa.**

**Briefs das Tasks 3–8 já emendados pelo pré-voo** (as 9–12 ainda NÃO) (ver item 6 acima). Eles vivem em
`.superpowers/sdd/2026-08-13-daqui-e-filtros/task-N-brief.md`, que é **scratch git-ignorado**
— um `git clean -fdx` apaga as emendas junto. Se isso acontecer, o essencial de cada uma está
no item 6; reextrair pelo `scripts/task-brief` devolve o brief ORIGINAL, com os furos.

## Invariantes que não podem ser quebradas

Herdadas e ainda valendo:

- **O carimbo chega no primeiro paint, server-rendered, sem JS.** Depende de `force-dynamic` na
  home e na ficha. Vale pro mosaico do mapa também.
- **`useVenceu` devolve `false` no primeiro render, sempre.**
- **Uma trilha, uma fonte.** Cartão, selo, pin, cabeçalho do grupo — e agora o km. Sexta porta.
- **A regra de CSS da fase carrega `[data-state]` junto**, senão perde de especificidade e
  "SEM INFORMAÇÕES" sai em selo verde. Vale pro `.selo` e pro `.pin-home`.
- **Sem leitura o app INFORMA, não manda:** `SEM INFORMAÇÕES · tome cuidado`.
- **`avaliar` (`motor.ts`) é o único lugar que decide se dá pra subir.**
- **Tudo ou nada no clima:** falha na busca → nenhuma trilha recebe carimbo.
- **A série de clima prova de que coordenada veio**; **slug repetido estoura no carregamento.**
- **Nenhuma URL de trilha responde com o corpo de outra**, online ou offline.
- **Sem `next/link`.** Âncora pura. **`© OpenStreetMap`** em todo mapa (ODbL).

Novas desta rodada:

- **Primeiro render sem localização e sem filtro, SEMPRE**, mesmo com dado guardado. Mesma razão
  do `useVenceu`: a home chega do cache do service worker com HTML velho.
- **Uma pessoa, uma fonte:** mapa, cartão e filtro leem a MESMA localização. Nada mais no app pode
  chamar `navigator.geolocation` por conta própria — o `DistanciaDaqui` da ficha ainda chama, e a
  Task 7 é quem o migra.
- **Não inventar geografia.** Nome de cidade só quando o serviço devolveu (o GPS não devolve nome,
  por isso a pílula diz só "daqui"). `esforco`/`duracao` só quando o João disser — por isso são
  **opcionais** no schema.
- **"em linha reta" não é droppável** em nenhum texto de distância.

## Deferidos vivos (registrados, nenhum bloqueia)

Desta rodada (estão no ledger, o revisor final vai triar):

- `src/lib/local.ts:53-54` — limites 90/180 sem comentário de derivação.
- `src/app/local.tsx` — os dois `Provider` recebem objeto literal novo a cada render.
- Sem de-dupe de `pedirGps()` em toque duplo.
- `src/app/page.tsx` — `Object.fromEntries(leituras)` computado duas vezes (desperdício; nenhum
  consumidor depende de identidade referencial).
- `.voce-pin` sem `aria-hidden` explícito (vive dentro do `role="img"` que já existia).
- Falta um `it("sem localização, a ficha mostra o BOTÃO")` renderizando `[slug]/page.tsx` de
  verdade. Hoje o caso oposto é coberto indiretamente (estrutura do componente + duas
  mutações), mas não por asserção explícita no ponto de uso.
- O comentário do `route.ts` afirma que o prazo da busca é menor que o `PRAZO_CLIMA_MS` e
  **essa relação não tem teste**, embora o padrão exista (`weather.test.ts` testa
  `PRAZO_CLIMA_MS < PRAZO_REDE_MS`). A constante virou `PRAZO_BUSCA_MS` em `src/lib/lugares.ts`.
- `src/app/api/lugares/route.ts` — o comentário afirma que `PRAZO_MS` é menor que
  `PRAZO_CLIMA_MS` e **essa relação não tem teste**, embora o padrão já exista na suíte
  (`tests/lib/weather.test.ts:168-171` testa `PRAZO_CLIMA_MS < PRAZO_REDE_MS` pelo mesmo
  motivo). Barato e idiomático — achado da re-revisão da Task 5, fora do escopo dela.
- **Higiene de mock em `tests/lib/filtros.test.ts`** (achado da re-revisão da Task 9, Minor). O
  arquivo tem um espião de módulo (`vi.mock("@/lib/geo")` delegando pro real) e a config não tem
  cinto: `vitest.config.ts` está com `setupFiles: []` e sem `clearMocks`. Provado pelo revisor:
  um futuro `mockReturnValue` **sem** `Once` vaza em silêncio pros testes seguintes do arquivo e
  **nada** cai — hoje não morde porque o `Once` é consumido e a 2ª asserção do teste é rede.
  🔴 **Os DOIS remédios óbvios estão errados, e eu medi os dois** (arquivos de scratch, apagados):
  `clearMocks: true` **não cura** — `mockClear` não remove implementação, que é o mesmo motivo
  pelo qual o revisor o achou seguro; e `mockReset()` **quebra a delegação** — neste vitest
  (2.1.9) ele reseta pra função vazia, não pra impl passada em `vi.fn(impl)` (`expected undefined
  to be 2`). O remédio certo é restaurar explicitamente
  (`afterEach(() => vi.mocked(distanciaKm).mockImplementation(real))`, com o real vindo de
  `vi.importActual`), e isso é máquina demais pra um risco que hoje não morde. **Deferido de
  propósito, com a medição registrada** — o revisor final decide.
- **DECISÃO DE PRODUTO pendente, não é só limpeza:** `enquadrarComVoce([], voce, ...)` devolve
  zoom 11 (~26 km), enquanto uma trilha só, longe demais, cai no piso de zoom 8 (~212 km) —
  zero trilhas fica **mais apertado** que uma trilha distante. Assimetria herdada de reusar o
  `enquadrar`, que ninguém decidiu. Hoje é inalcançável, **mas as tasks de filtro desta mesma
  rodada podem zerar a lista.** Decidir de propósito ao pré-voar a task de filtro; se for
  pergunta pro João, é curta: *"filtrou e não sobrou nada — o mapa mostra a sua vizinhança ou
  a região toda?"*

(O `beforeEach` morto em `tests/app/local.test.tsx` saiu no fix round 1/5 da Task 2.)

Herdados:

- `useVenceu` duplica o relógio do `Carimbo.tsx`.
- `home.css` não tem a regra neutra de `data-fase="conferindo"` que o `ficha.css` tem.
- `HomeViva` usa `!== "hidden"` e `Carimbo` usa `=== "visible"`; nenhum teste cobre aba oculta.
- Cookie `bp_ultima` órfão até 1 ano nos celulares que já usavam o app.
- `ensureSchema` (`src/lib/db.ts`) declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte.
- Deploy no meio com a página aberta: chunks somem, o JS morre, a tela congela.
- A home não tem `<h1>`; sem `:focus-visible` em `.cartao`, `.pin-home`, `.barra-item`.
- A folha não sobrepõe a base do mapa como a spec da rodada anterior pedia.

## Lições que valem além desta rodada

1. **Teste de mutação decide qualquer discussão sobre teste.** Apague a linha, veja falhar,
   devolva, cole a saída. Esta suíte já produziu **nove** testes que passavam com o código
   apagado — e as revisões desta rodada já pegaram mais seis lacunas do mesmo tipo.
   **Corolário fechado em 2026-08-14:** "existe um teste parecido em outro caminho de código"
   **não é prova**. O implementador da Task 2 usou esse argumento pra pular um guard; a
   re-revisão apagou o guard, viu 12/12 verde, e o argumento morreu. A régua é literal.
2. **Mutação sub-cláusula a sub-cláusula, não a linha inteira.** Apagar a linha toda "provou" um
   `ehCoord` e deixou passar um `em` sem teste nenhum. **E cuidado especial com `if` que é um
   OU:** a cláusula que dispara primeiro esconde todas as outras, então o caso de teste tem
   que falhar em UMA coisa só. Dois briefs meus desta rodada caíram nisso.
3. **Aponte o teste pro PONTO DE USO**, não pro arquivo de nome parecido.
4. **Para artefato que vira entrada de outra coisa, a prova é USÁ-LO** (o questionário: responder
   e rodar o JSON contra o schema).
5. **Nenhum teste desta suíte mede geometria renderizada.** Se um número de pixel importa, medir
   em navegador é a única prova. "Parece certo" não é resposta; "não medi" é.
   **Corolário provado em 2026-08-14: o jsdom também não enxerga server vs client.** Apagar o
   `"use client"` do `MapaHome` deixa **26 dos 27** testes verdes — inclusive os que exercitam
   a localização de ponta a ponta — porque o jsdom renderiza tudo como cliente. Só a asserção
   de FONTE (ler o arquivo e conferir a primeira linha) acusa. Mesma coisa com o `<LocalVivo>`
   do `page.tsx`: tirá-lo deixa os 16 testes do `MapaHome.test.tsx` verdes, porque eles
   embrulham o provedor na mão. **Para o que o jsdom não vê, a prova é asserção de fonte ou
   render do ponto de uso real** — e esses testes "feios" são os que separam "passou" de
   "funciona no celular".
6. **Mandar o implementador PARAR quando a mutação não morde funciona — e duas vezes nesta
   rodada o erro era meu, não dele.** Na Task 4 ele provou com teste-sonda que uma mutação do
   meu brief não derrubava nada, e parou em vez de afrouxar a asserção; refiz a conta e ele
   estava certo. Duas outras vezes a instrução "se a contagem não bater, não ajuste o
   relatório, descubra por quê" pegou erros de aritmética meus. **Escreva as duas instruções
   em todo despacho.**
7. **Defeito de junção não aparece na revisão de task** — por isso a revisão da branch inteira é
   obrigatória. Em três rodadas seguidas ela achou o que nenhuma revisão de task pegou.
8. **O plano é o elo fraco.** Quando o revisor rotula um achado "plan-mandated", quase sempre quer
   dizer que a lista de testes do plano tinha buraco — não que o revisor esteja errado.
9. 🔴 **`npm test` VERDE NÃO PROVA QUE O APP CONSTRÓI.** O vitest roda por esbuild e nunca
   invoca o `next build`. Em 2026-08-14 o build ficou **quebrado por quatro commits** com a
   suíte inteira verde, e **três revisões e uma re-revisão passaram por cima** — a re-revisão
   inclusive aprovou por escrito a linha que o quebrava. Ninguém errou: a régua da rodada era
   `npm test` + `tsc`, e ninguém tinha motivo pra rodar o build. Quem achou foi um
   implementador, por acidente, investigando outra coisa. **O deploy teria falhado.**
   **`npm run build` entra na verificação de toda task e de toda revisão.**

   A causa foi um fix round que exportou uma constante de um `route.ts`, citando o precedente
   do `zoomDeTiles`. **O precedente é de módulo de LIB; route handler do Next tem superfície
   de export restrita** — qualquer nome fora da lista quebra com `Type 'X' is not assignable
   to type 'never'`. Consertado (`318231e`): a constante virou `PRAZO_BUSCA_MS` em
   `src/lib/lugares.ts`. **Guarda criado:** `tests/deploy/exports-de-rota.test.ts`.

   **E o guarda nasceu com ponto cego** — eu provei UMA forma (`export const X`) e presumi as
   outras; `const X; export { X }` passava verde com o build quebrado. Consertado em
   `ff217df`, com cada forma provada **pelas duas ferramentas**. A lista `PERMITIDOS` foi
   conferida contra o arquivo de tipos que o **próprio Next gera** (`.next/types/.../route.ts`),
   não contra documentação. **Moral dupla: escrever a rede de segurança não basta — a rede
   também precisa de prova de mutação, forma a forma.**

10. **Ficha sintética prova a FUNÇÃO; só a ficha REAL prova a integração com o conteúdo.**
    Meu brief afirmou que o custo da Rampa usa `—` como separador. Usa `·`. Os testes eram
    sintéticos, com o separador que eu SUPUS, e passavam — com a ficha real o cartão mostraria
    "R$ 5 por pessoa · cobrado no portão da entrada" inteiro, e como o cartão junta seus campos
    com `" · "`, a logística se disfarçaria de mais um metadado. A prova de mutação é a
    demonstração: restaurando o corte errado, **só o teste da ficha real falha**.

11. **`git checkout -- <arquivo>` durante prova de mutação só é seguro se o arquivo estiver
    COMMITADO.** Com trabalho não-commitado dentro, ele reverte tudo. Mordeu um implementador
    (Task 8) e **mordeu a mim** no mesmo dia, uma hora depois de eu escrever a lição.
    **Restaure com edição pontual.** E a conferência que fecha a dúvida sobre perda silenciosa
    é `git diff <base-da-task> HEAD -- <arquivo>`, não `git diff HEAD`.

12. **Mandar o implementador PARAR quando a mutação não morde funciona.** Nesta rodada isso
    aconteceu três vezes e **nas três o erro era do plano, não dele**. Some a isso "se a
    contagem não bater, não ajuste o relatório — descubra por quê", que pegou **cinco** erros
    de aritmética meus. **As duas instruções entram em todo despacho.**

14. 🔴 **Com subagente em voo, `git add -A` não é meu direito.** Em 2026-08-16 commitei uma
    mudança de DOCUMENTAÇÃO com `git add -A` enquanto um implementador trabalhava na mesma
    árvore, e o `-A` varreu o conserto dele pra dentro de um commit com mensagem de docs. Saiu
    coerente **por sorte**: conferi depois e o arquivo estava num estado completo. Se eu tivesse
    pego no meio de uma prova de mutação, teria commitado **código mutado**, e a mensagem do
    commit não daria pista nenhuma disso pra quem lesse o `git log` depois. **Irmã da lição 11:
    a árvore não é minha sozinho enquanto há agente rodando. `git add <caminho explícito>`,
    sempre.**

13. **"A mutação não mordeu" tem TRÊS respostas, não duas.** Além de "falta teste" e "a linha
    é redundante mesmo", existe **"a linha é provada por OUTRA ferramenta"**. Duas linhas que
    o vitest dizia mortas eram carregadoras de peso pro `tsc` (`Number.isFinite` não é type
    guard; quem estreita `unknown` pra `number` é o `typeof`). **Rode `tsc --noEmit` antes de
    declarar uma linha morta.**

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso) + consentir/aceitar termos + **o celular** + **os fatos de
roteiro**. Código, deploy e verificação eu toco. **Agentes: autorizados nesta rodada.**

### Pendências dele, e nenhuma trava a rodada

1. **Esforço e duração da Rampa do Pepe** — quão puxada (leve/média/puxada) e quanto tempo leva
   (em minutos). Vira uma linha no cartão. Sem isso a Rampa só não mostra essa linha.
2. **Responder `docs/questionario-ficha.md`** — a segunda ficha. Filtro que filtra um item e km
   num cartão só não mostram que funcionam; ele sabe disso e escolheu construir em paralelo.
   **A Task 8 acrescenta duas perguntas ao questionário — ele deve responder DEPOIS dela**, senão
   responde duas vezes.
3. **Abrir a home no iPHONE.** A home nova **nunca foi vista em WebKit**. Quatro perguntas, na §15
   da spec: os pins estão dentro do mapa com folga? A barra fixa e a faixa de gesto convivem? O
   painel de filtros empurra a lista sem pular? O piso de zoom 8 orienta ou vira mancha?

## Registro histórico (não refazer)

- Rodada 1 (esqueleto): merge `a179e46`. Rampa ao vivo (Versão D): `7d4bd59`. "Fui": `4b6d9a7`.
  Mapa de verdade: `a671146`. Forma de app: `6ef0fdc`. Carimbo busca leitura nova: `9c3dcf8`.
  Home "Hoje": `645ebe1`.
- **iPhone provado em 2026-08-10** com a versão anterior à home. Da home pra cá, não.
- Turso/cron/freshness da Rodada 1 seguem de lado (não usados no MVP live-compute).
- Os mockups do brainstorm desta rodada estão em `.superpowers/brainstorm/2019-1786672214/content/`
  (git-ignorado): `mapa-centro.html`, `layout-filtros.html`, `folha-de-cima.html`.
