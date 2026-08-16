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
| `task-10.md` | 10 | não pré-voado |
| `task-11.md` | 11 | não pré-voado |
| `task-12.md` | 12 | não pré-voado |

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
