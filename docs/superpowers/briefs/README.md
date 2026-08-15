# Briefs das tasks que faltam — versionados de propósito

Os briefs de execução normalmente vivem em `.superpowers/sdd/<rodada>/task-N-brief.md`, que é
**scratch git-ignorado**. Um `git clean -fdx` apaga a pasta inteira.

Isso não era problema enquanto o brief fosse só uma cópia do plano. **Passou a ser** quando o
pré-voo começou a emendá-los: as emendas são trabalho real, achado por varredura, e sumiriam
sem deixar rastro. Por isso as **Tasks 9 a 12 desta rodada estão copiadas aqui**, já
emendadas até onde o pré-voo chegou.

| Arquivo | Task | Estado do pré-voo |
|---|---|---|
| `task-9-filtros-puros.md` | 9 — os filtros puros (`src/lib/filtros.ts`) | **PARCIAL** — ver abaixo |
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

## Task 9 — o que FALTA pré-voar

Varrido e não escrito. Aplicar antes de despachar:

1. **`contarLigados` conta 5 recortes e o teste só prova 3** (`daHoje`, `soGratis`,
   `distanciaKm`). Apagar `esforco` e `duracaoMax` do array continua devolvendo 3. Falta o caso
   com os cinco ligados esperando 5.
2. **`lerFiltros` valida 5 campos e o teste prova em bloco, não campo a campo** — a família do
   OU, que já mordeu duas vezes nesta rodada. Ex.: `lerFiltros(JSON.stringify({soGratis: "sim"}))`
   deve virar `false`, e nada prova isso hoje. Um caso por campo inválido.
3. **A borda da DISTÂNCIA** — o teste novo cobre a da duração; falta o par exato de 30 km
   (dentro e fora por um triz).
4. **`confia: false` deixa os OUTROS recortes funcionando?** Hoje só se prova que ele torna o
   `daHoje` inerte. Se ele desligar tudo, é bug de honestidade ao contrário: a pessoa filtra por
   distância e nada acontece.

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
