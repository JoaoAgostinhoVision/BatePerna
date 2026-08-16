# Briefs das tasks que faltam — versionados de propósito

Os briefs de execução normalmente vivem em `.superpowers/sdd/<rodada>/task-N-brief.md`, que é
**scratch git-ignorado**. Um `git clean -fdx` apaga a pasta inteira.

Isso não era problema enquanto o brief fosse só uma cópia do plano. **Passou a ser** quando o
pré-voo começou a emendá-los: as emendas são trabalho real, achado por varredura, e sumiriam
sem deixar rastro. Por isso as **Tasks 9 a 12 desta rodada estão copiadas aqui**, já
emendadas até onde o pré-voo chegou.

| Arquivo | Task | Estado do pré-voo |
|---|---|---|
| `task-9-filtros-puros.md` | 9 — os filtros puros (`src/lib/filtros.ts`) | **COMPLETO** (2026-08-16) |
| `task-10.md` | 10 — a linha e o painel na tela | **COMPLETO** (2026-08-16) |
| `task-11.md` | 11 — filtro e agrupamento na mesma passada | **COMPLETO** (2026-08-16) |
| `task-12.md` | 12 — a barra fixa no rodapé | **COMPLETO** (2026-08-16) |

## Task 9 — o que já entrou no brief

1. **A BORDA, que era furo de ESPECIFICAÇÃO e não de teste.** "até 2h" com uma trilha de
   exatamente 120 min: passa ou não? O brief original só dava 90 e 300, e dois implementadores
   razoáveis decidiriam diferente — a pessoa que ligou "até 2h" veria a trilha de 2h sumir sem
   entender. **Cravado: o teto é INCLUSIVO nos dois recortes** (duração e distância). É como se
   lê em português, e o contrário esconde justamente o caso que ela tinha em mente.
2. O degrau de **240** min (só o 120 era exercitado).
3. As **três palavras de esforço uma a uma** (só "leve" e "puxada" eram testadas — um `===`
   trocado por comparação parcial passaria batido em "media").

## Task 9 — pré-voo FECHADO em 2026-08-16

Os quatro que estavam listados entraram, e a varredura achou **mais cinco**. O brief agora
pede **38 testes** e traz uma tabela de **10 mutações** com o teste que cada uma tem que
derrubar.

Os quatro que faltavam:

1. **`contarLigados` conta 5 recortes e o teste só provava 3** — apagar `esforco` e
   `duracaoMax` do array continuava devolvendo 3.
2. **`lerFiltros` valida 5 campos e o teste provava em bloco** — virou `it.each`, um caso por
   campo, pra falha dizer qual validação caiu.
3. **A borda da DISTÂNCIA** — ver o ruling abaixo, porque a resposta não foi a esperada.
4. **`confia: false` deixa os OUTROS recortes funcionando** — um `if (!confia) return true` no
   topo passava em tudo e desligava o app inteiro em silêncio.

Os cinco novos, todos da mesma família (**o E de duas sub-cláusulas com a ficha base
escondendo uma delas**):

5. **`filtros.esforco !== null &&`** e 6. **`filtros.duracaoMax !== null &&`** não tinham prova:
   a ficha base é a Rampa, que **não tem** esses campos preenchidos, então o curto-circuito da
   segunda sub-cláusula salvava o teste sozinho. Só uma ficha COM o campo e NENHUM filtro ligado
   faz o guarda ser o único a segurar — e isso vira caso real no dia em que o João responder o
   questionário.
7. **`lerFiltros` só provava 2 dos 5 campos preservados** — trocar a linha do `esforco` por
   `null` fixo passava em tudo, e o filtro "esqueceria" ao fechar o app.
8. **O guarda `typeof x !== "object" || x === null` é um OU de sub-cláusulas diferentes** —
   `"null"` estoura sem a segunda; `"5"` é segurado pela primeira. Um caso pra cada.
9. **O `if (!bruto)` parece morto pro vitest e é carregador de peso pro `tsc`** (estreita
   `string | null`). Ficou comentado no código pra ninguém apagar por prova de mutação parcial —
   e pra nenhuma revisão o filar como linha morta.

### Ruling da borda de distância — medido, não presumido

A regra cravada diz teto **inclusivo nos dois recortes**. Na duração isso é observável e está
provado (120 é inteiro, a pessoa acerta ele). **Na distância não é, e o pré-voo mediu antes de
escrever o teste:** o haversine com estas coordenadas **pula** o valor exato — perto de 30 km o
passo de saída é ~1e-13 e os vizinhos são `29.999999999999968` e `30.000000000000068`. Nenhuma
coordenada devolve 30 cravado, então `>` e `>=` são indistinguíveis ali, na suíte e na vida.

O teste prova o que É provável: que o corte acontece **no limite pedido** e não num número
parecido (km trocado por metro, degrau errado, constante errada), com o par por um triz nos dois
degraus. **Registrado aqui em vez de contorcido:** "não dá pra provar, e por isto" é resposta;
teste que finge provar não é.

> 🔴 **CORREÇÃO, no fix round da Task 9 (mesmo dia):** o ruling acima está certo sobre a
> aritmética e **errado sobre a conclusão que eu tirei dela**. Coordenada nenhuma devolve 30
> cravado — mas daí eu concluí que não havia o que provar, e **a linha de código continuava
> mutável**: com `>` trocado por `>=` a suíte ficava **verde**, e o recorte "até 30 km" passaria
> a esconder a trilha de 30 km sem nada reclamar.
>
> Fechado com um `vi.mock("@/lib/geo")` que **delega pro real** (`vi.fn(real.distanciaKm)`) e só
> num teste aplica `mockReturnValueOnce(30)`. O caminho real segue exercitado em todos os outros
> — inclusive pela auto-conferência do `aoNorte`, que é o que prova que a delegação existe.
>
> **A lição, e ela é nova:** "o valor exato é inalcançável pelo dado real" **não é** o mesmo que
> "a linha não precisa de prova". Quando a aritmética não alcança a borda, a borda ainda é
> alcançável **pela costura** — um espião que delega e mente uma vez só. O ruling honesto sobre
> a medição não me dispensava de perguntar se a LINHA morria.

### Ruling do deferido do mapa vazio — não vira pergunta pro João

O `docs/RESUME.md` deixou pendente decidir, ao pré-voar os filtros, o que o mapa faz quando o
filtro zera a lista (`enquadrarComVoce([], voce, ...)` devolve zoom 11 enquanto uma trilha
distante cai no piso de zoom 8). **Conferido na spec e no plano: o mapa NÃO é filtrado.** A §7
recorta a folha, a contagem da linha é "das trilhas que estão APARECENDO", e a Task 11 mexe em
`FolhaTrilhas`/`page.tsx`/`home.css` — `MapaHome` continua recebendo `fichas` inteiras. Então o
caso da lista vazia **não alcança o mapa** e a assimetria segue inalcançável. Sem pergunta.

O que sobra dali é outra coisa, e vai pra revisão da branch inteira, não pra cá: **com "até 30 km"
ligado, o mapa mostra pin de trilha que a lista escondeu.** Não quebra "uma trilha, uma fonte"
(que é sobre veredito e km, não sobre visibilidade), e é defensável — o mapa é a geografia do
acervo. Mas é junção entre tasks certas, que é exatamente a família que só a revisão final pega.

## Task 10 — pré-voo FECHADO em 2026-08-16

Dez furos, e **três deles são da família que custou os dois fix rounds da Task 2**. O brief agora
traz uma tabela de **11 mutações**.

O que o jsdom não vê (a lição 5 do `docs/RESUME.md`, e a task cria DOIS client components):

1. **`"use client"` no `PainelFiltros.tsx`** e 2. **no `filtros.tsx`** — sem asserção de fonte,
   apagar a diretiva deixa a suíte inteira verde e o painel morto no celular. A mutação pede
   pra conferir **quantos outros testes caem** (esperado: zero — é o número que prova a lição).
3. **`<FiltrosVivos>` no `page.tsx`** — todos os testes embrulham o provedor na mão. Prova de
   fonte aqui, **prova forte transferida pra Task 11** (ver o ruling abaixo).

Os guardas do armazenamento (a família da Task 2):

4. **`try/catch` da LEITURA** e 5. **da ESCRITA** no `filtros.tsx`. Em aba anônima do Safari o
   `localStorage` **estoura**, e sem eles a home inteira cai na tela de erro por causa de um
   filtro. O brief manda espelhar o `local.tsx` — e o espelho herdaria a falta de prova junto.
6. **Fora de provedor**: `useContext(Ctx)!` estoura no servidor, e nenhum teste percebia porque
   todos montam dentro do provedor.

Os de comportamento, que só aparecem no segundo toque:

7. **`trocar` com `{...SEM_FILTRO, ...p}`** passa em tudo, porque todo teste ligava um recorte
   só. Na tela: liga "só grátis", toca "leve", e o "só grátis" se apaga sozinho.
8. **O segundo toque no chip de esforço é a ÚNICA saída dele** — distância e duração têm chip
   "qualquer", esforço não tem. Sem o toggle, quem tocou por engano fica preso.
9. **Singular de "1 filtro ligado"** — o par do "1 trilha", que já existia.
10. **`aria-expanded`** e **`aria-pressed`** — os únicos sinais que sobram quando não se vê cor;
    apagá-los não derrubava nada.

### Ruling do provedor no `page.tsx` — prova fraca agora, forte na 11

Na Task 10 **nada consome** o `<FiltrosVivos>` ainda: o `<PainelFiltros>` só entra no fluxo da
home na Task 11. Não há render real pra observar, então ali a prova é de fonte, e o brief diz
isso com todas as letras em vez de fingir. **A prova forte já está escrita no `task-11.md`**:
renderizar o `page.tsx` de verdade, com filtro guardado, e ver a Rampa sumir. Precedente da
Task 3 — achado real sem linha pra consertar naquela camada vira ruling registrado e teste na
camada onde morde.

## Task 11 — pré-voo FECHADO em 2026-08-16

É a task de maior risco da rodada, e o achado mais importante foi **contra o próprio brief**.

1. 🔴 **A prova de mutação que o brief prescrevia NÃO MORDIA.** O Step 5 mandava o ramo
   `!confia` voltar a usar `pares` e "confirmar que algum teste falha". Nenhum falharia: o único
   filtro exercitado naquele ramo era o `daHoje`, que ali é **inerte de propósito**, então
   `pares` e `visiveis` eram a mesma lista. O brief até dizia "se nenhum falhar, o teste está
   fraco" — e estava. Entrou o teste que faz a mutação morder: no ramo `!confia`, "só grátis"
   continua recortando. O ramo desliga o AGRUPAMENTO, não o filtro.
2. **A folha vazia tem que valer nos DOIS ramos.** Com o `if (visiveis.length === 0)` escrito
   depois do `if (!confia)`, o caso "carimbo não confiável + filtro que zera" desenha uma
   `.cartoes` vazia: folha em branco, sem aviso e sem botão de limpar — o que a §7.4 proíbe. E é
   o ramo mais provável num dia ruim, que é quando a pessoa mais filtra. Virou ordem explícita
   no Step 3 e teste no Step 1.
3. **`confia` é sobre TODAS as trilhas, não as visíveis — e isso é decisão, não detalhe.** Não
   dá pra ser diferente (`passaNoFiltro` *recebe* `confia`; calcular de `visiveis` seria
   circular, e `useAlgumVenceu` receberia um array de tamanho variável). Mas a consequência é
   visível e alguém vai querer "consertar": uma trilha escondida pelo filtro, com leitura
   estragada, derruba os cabeçalhos das que ficaram. **Está certo** — invariante "tudo ou nada
   no clima": a leitura vem numa busca só, pro lote inteiro, e leitura estragada é notícia sobre
   a BUSCA, não sobre aquele morro. Ficou com teste e com o "não conserte" escrito.
4. Recebeu a **prova forte transferida da Task 10**: renderizar o `page.tsx` de verdade, com
   filtro guardado, e ver a Rampa sumir.

A tabela do Step 5 foi de uma mutação solta pra **seis**.

## Task 12 — pré-voo FECHADO em 2026-08-16

Quatro achados, e **dois deles fariam o teste falhar por erro meu**, não de quem implementa.

1. 🔴 **`.bp .lista` não mora no `home.css`** — mora em `src/app/ficha.css:202`, e o `/trilhas`
   importa os dois arquivos. Meu teste lia o arquivo errado e falharia com "faltou a regra"; o
   conserto natural (duplicar a regra no `home.css`) criaria **duas fontes pro mesmo seletor**.
   Corrigido: cada regra é lida no arquivo onde vive.
2. 🔴 **`position: fixed` escapa da moldura.** O app inteiro vive dentro de `.bp .screen`
   (`max-width: 25.5rem`, borda, `border-radius: 24px`), e **nenhum ancestral tem
   `transform`/`filter`/`perspective`** — então elemento fixo se posiciona pela JANELA. Com
   `left: 0; right: 0`, a barra atravessa um monitor inteiro por fora da moldura. No celular
   passa despercebido (a janela É a moldura); em tela larga fica visivelmente quebrado, inclusive
   na hora de conferir. Virou `left: 50%` + `translateX(-50%)` + o **mesmo** `max-width` do
   `.screen`, com teste conferindo que os dois números não se separam.
3. **`--barra-h: 62px` era chute meu, não medida.** A conta a partir do CSS dá ~56px. Se a barra
   for mais ALTA que a constante, o respiro é curto e o último cartão fica atrás dela — o defeito
   que a task existe pra tirar. Entrou na lista de medição do Step 5, com a ordem de ajustar a
   constante pro valor medido (o padrão do `home-layout.ts`: alturas são medidas, não desejos).
4. **A regex do `.folha` casa a PRIMEIRA ocorrência, de propósito** — acrescentar uma segunda
   regra mais abaixo funcionaria pela cascata e deixaria o teste vermelho, que é o certo. Ficou
   escrito "não conserte a regex", porque esse é o reflexo errado.

A medição do Step 5 foi de quatro perguntas pra sete.

## E antes de despachar qualquer uma delas

Releia a lista de testes perguntando **"que linha eu apago sem isto falhar?"**. Numa rodada só,
isso achou quinze furos meus, e os achados dos revisores vieram quase todos rotulados
*plan-mandated* — o código estava certo; o teste do plano é que era fraco.

Mande junto no despacho as duas instruções que pegaram oito erros meus:

- **"se a mutação não morder, PARE e relate"** — três vezes o erro era do plano, não de quem
  implementou;
- **"se a contagem não bater, não ajuste o relatório — descubra por quê"** — cinco erros de
  aritmética.

E **`npm run build` entra na verificação**, junto do `npm test`. Ver a lição 9 do
`docs/RESUME.md`: o build já esteve quebrado por quatro commits com a suíte inteira verde.
