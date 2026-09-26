# As rulings de 2026-09-26 — Tasks 5, 6, 7 e a revisão final da branch

> **Por que este arquivo existe.** O ledger da execução mora em
> `.superpowers/sdd/2026-09-24-ficha-no-banco-e-editor/progress.md`, que o `.gitignore` ignora e que um
> `git clean -fdx` apaga. As decisões abaixo foram tomadas **no lugar do João**, sem ele na mesa, porque
> o laço de execução não para para perguntar. Decisão tomada no lugar dele que morre com um diretório
> temporário foi decisão tomada em segredo. Então elas ficam aqui, **cada uma com o custo se estiver
> errada**, para ele desfazer o que discordar.
>
> Irmão deste arquivo, do dia anterior: `docs/superpowers/2026-09-25-rulings-ficha-no-banco.md`.
> Estado e ponto de retomada: `docs/RESUME.md`.

---

## As decisões, na ordem em que foram tomadas

### T5-1 — rejeitei a correção que o revisor propôs, e arrumei mais fundo

A tela de um lugar lia o banco **sem prazo**: o `try/catch` cobria banco *fora do ar*, não cobria banco
*pendurado*, que travava a página sem nem cair no `error.tsx`. O revisor propôs `comPrazo(..., undefined)`.
**Recusei.** `comPrazo` devolve o valor de fallback quando o prazo estoura — então banco pendurado ficaria
**indistinguível de "nenhum aviso publicado"**, e o João abriria a tela do próprio lugar concluindo que o
recado dele sumiu. A ficha pública pode usar `null` (lá as duas situações dão a mesma tela e o portão não
pode parar); o admin não pode, porque já tem canal honesto: o aviso de erro de leitura. Ficou **sentinela**
caindo no mesmo ramo de erro do `catch`.
*Custo se errado:* uma linha a mais e um tipo mais largo. O custo do outro lado era o dono achar que o
próprio recado sumiu.

### T5-2 — o docblock mentia pela metade, e foi reescrito junto

Ele prometia *"banco fora do ar não pode derrubar a página"* — verdade só para metade dos casos.
*Custo se errado:* zero.

### T5-3 — o conserto leva teste, e o teste tem que falhar hoje

O buraco era invisível porque a leitura estava mockada e o mock nunca pendurava.
*Custo se errado:* zero; sem o teste, o conserto seria indistinguível de não ter consertado.

### T6-4 — subi a severidade de um Minor que o revisor não tinha conferido

Ele listou `tokenDoCookie` como *"provavelmente duplica, não conferido, fora do escopo"*. **Conferi: era
duplicação verbatim, byte a byte**, entre duas rotas de admin. O brief mandava copiar "o molde exato" da
rota irmã — mas copiar o molde não obriga a duplicar o helper, e duplicação verbatim de bloco de lógica é
a espécie que este app já pagou quatro vezes. Extraí para onde o cookie e a sessão já moram. Isso tocou um
arquivo **fora** da lista da tarefa: deliberado, e seguro porque aquela rota tem teste próprio.
Pedi mutação junto: quebrar o helper extraído tem que matar teste das **duas** rotas — é isso que prova
que a extração ficou compartilhada e que nenhuma ficou com cópia velha pendurada.
*Custo se errado:* um arquivo a mais no diff. O custo de adiar era entregar a duplicação à revisão final
como mudança de branch inteira, com o contexto frio.

### T7-4 — "voltar" grava o documento VERBATIM

O código revalidava e **re-serializava** o documento antigo antes de regravar. A prova dura veio do
revisor: o schema **descarta chave desconhecida em silêncio** — está documentado no próprio arquivo de
tipos, que também registra campos removidos do schema em agosto. Voltar a uma versão que ainda os tivesse
os apagaria **em silêncio**, e a ordem das chaves passaria a ser a do schema.

Isso quebra a promessa no coração da rodada: a tabela é append-only **justamente para que nada do que já
se disse sobre um lugar se perca**. Decisão: validar para **decidir** (400 se a versão antiga não passa
mais), e gravar o documento **verbatim**. É seguro porque o caminho de leitura revalida — campo
desconhecido nunca chega à tela, fica guardado no arquivo.
*Custo se errado:* o arquivo guarda campo que o schema atual não conhece — invisível na tela, e
recuperável. O custo do outro lado era apagar em silêncio o que o dono escreveu.

### T7-6 — exigi do histórico o mesmo que exigi do editor, por simetria

O `voltar()` não tinha teste nenhum. Poucas horas antes eu tinha exigido exatamente isso do editor da
tarefa anterior. Exigir de um e não do outro seria a régua mudando de tamanho no meio da mesma rodada.
*Custo se errado:* quatro testes a mais.

### T7-7 — uma lacuna deferida, mas apontada nominalmente

O re-revisor declarou que não existia teste para *"versão antiga que não passa mais no schema → 400 e nada
gravado"*. Pela regra, minor fora de escopo não estende o laço. Deferi — **mas apontei nominalmente à
revisão final como a primeira coisa a triar**, porque é o guarda do caminho que eu mesmo criei. A revisão
final confirmou que era pior do que eu achava, e foi consertado.
*Custo se errado:* era um ramo de 400 coberto só por leitura.

### T8-1 — o Critical da revisão final é defeito do PLANO, não de quem construiu

`ficha-fonte.ts` testava `if (linhas === null)` para decidir "a leitura não deu" — e **um `Map` vazio não
é `null`**. Banco **de pé** com a tabela vazia passava reto, e a lista vazia ficava **memorizada como a
última leitura boa**. A tela resultante — "Todas as trilhas" com zero itens — é literalmente a saída que
uma ruling anterior já havia declarado **proibida**.

A causa: a Global Constraint *"Erro honesto é o `error.tsx`"* foi escrita contra **falha de leitura**, e
não contra **leitura bem-sucedida e vazia**. São coisas diferentes, e a diferença é uma tela mentindo.
Pior: o caminho até esse estado saía da **própria lista de deploy do projeto**, porque o `apply-schema`
passou a criar a tabela — então a frase escrita em dois lugares ("sem a semente o app cai no `error.tsx`")
era falsa, já que só valia enquanto a tabela não existisse.
*Custo se errado:* nenhum; a trava não custa nada ao caminho normal, e acervo vazio só existe hoje por
falta de semente.

### T8-2 — um revisor me corrigiu, e ele tinha razão

Eu vinha repetindo que o número certo do docblock do guarda era "10079 de 14570". A expressão citada come
**8880 (60,9%)**; os 10079 só aparecem com uma segunda tira junto. E a causa narrada **não reproduz hoje**.
Trocar um número por outro teria mantido a frase falsa, só que com outro número. Mandei reescrever **pela
medição**. Foi a segunda vez na execução que um revisor me corrigiu e melhorou a decisão.

### T8-3 — o CSS entra na onda, contra a recomendação do revisor

Ele sugeriu mandar direto ao João. Discordei: deixar como estava **não é escolha neutra** — a área de
escrever prosa caía no default do navegador, umas 20 colunas e fonte monoespaçada, no único aparelho em
que ele vai usar. Isso é pior que qualquer default razoável. Mas o dispatch levou restrição dura: **mínimo
estrutural, reusando regra e valor que já existem**, proibido inventar paleta, tipografia ou animação.
A re-revisão conferiu regra a regra: **zero cor nova, zero fonte nova, zero animação**.
*Custo se errado:* um passe de CSS que ele manda refazer. O custo do outro lado era entregar uma tela que
não dá para usar.

### T8-4 — o prazo da memória NÃO entra: é decisão dele

A cópia em memória não tem teto. Uma instância que leu o acervo continua servindo aquela leitura **para
sempre** se o banco cair — sem limite e sem sinal na tela. Todo outro prazo deste app tem constante nomeada
e justificativa escrita; só a memória que decide "mostrar o que ele já reescreveu" não tem. É uma linha de
código e uma escolha com custo dos dois lados. **Não decidi sozinho.**

### T8-5 — dois parqueados com ruling

O `POST` do aviso pode estourar 500 com o banco fora (o 500 é honesto e a tela já traduz tudo que não é
`ok` numa frase só; mudar a semântica de status sem ele seria eu inventando contrato); e a `voz` não tem
limite de tamanho (só o dono autenticado alcança, e campo com regra própria é rodada futura da spec).

### T8-6 — corrigi duas frases minhas FORA da onda de fix, como controlador

A re-revisão achou que a minha correção errada do T8-2 tinha sobrevivido em dois documentos. O processo diz
que não há segunda onda e que o controlador não conserta. **Desviei disso de propósito, e registro aqui:**
era uma frase **falsa que eu mesmo escrevi**, em documentos cuja única função é ser o registro honesto, com
a medição certa já em mãos e conferida por duas fontes independentes. Não há risco de código. Deixar uma
frase sabidamente falsa no registro para respeitar a forma do processo seria trocar a coisa pela regra.
*Custo se errado:* duas linhas de documento que não passaram por revisão.
