# Horário diferente em alguns dias — desenho

**Data:** 18/10/2026 · **Pedido do João:** *"as vezes a hora de abertura pode mudar dependendo do dia"* → escolheu a
**opção 1, horário por grupo de dias**, com a condição *"tenta fazer para que exija menos do usuário"*, e pediu o
desenho direto, sem perguntas. Tudo abaixo que não é fala dele é **decisão minha**, marcada como tal.

## 1. A intenção

Hoje o lugar tem UM horário (1 a 3 faixas, ex. 8h–12h e 14h–17h) que vale igual em todo dia aberto. Num lugar que abre
8h na semana e 7h no sábado, o carimbo erra num dos dois: diz "Pode ir" com o portão fechado, ou "Fechado agora" com
ele aberto. O horário é, junto com a chuva, a única coisa que o carimbo olha — errar aqui é o defeito mais caro do app
(mandar alguém dirigir até um portão trancado).

**Sucesso:** um lugar com horário que muda em alguns dias é descrito em poucos toques, e o carimbo, a ficha e o cartão
dizem a hora certa EM CADA DIA.

## 2. A forma que exige menos (decisão minha, a partir da condição dele)

O caso comum é "o mesmo horário todo dia", e o caso que motivou o pedido é "igual na semana, diferente em um ou dois
dias". Então **nada muda pra quem tem um horário só**, e quem tem diferença descreve SÓ a diferença:

1. A pergunta do horário continua igual: *as horas de sempre* (o horário de agora, `horario`).
2. A pergunta dos dias continua igual: *em que dias abre* (`dias`, ausente = todo dia).
3. **UMA pergunta nova, opcional, logo depois dos dias:** *"algum dia tem horário diferente?"* — quem não tem, toca em
   Pular (um toque). Quem tem, marca os dias e põe as horas daquele grupo. Pode acrescentar até **3 grupos**.

Ex.: "seg a sex 8h–17h, sáb e dom 7h–12h" vira: horário = 8h–17h; dias = (sem resposta); diferente = [sáb + dom:
7h–12h]. Dois grupos digitados, nenhum dia marcado à toa.

**Por que não "grupos desde o começo" (cada grupo com dias + horas, sem horário-base):** obrigaria TODO lugar a marcar
dias, inclusive os que abrem igual todo dia — mais toques no caso comum, que é o que ele pediu pra evitar. E mudaria o
formato do `horario` que já está no banco e no histórico (três formatos pra ler), que é o maior risco técnico da mudança.

## 3. O dado

Campo novo, opcional, no documento da ficha:

```
horarioPorDia?: Array<{ dias: Dia[]; faixas: Faixa[] }>   // 1 a 3 grupos
```

- `dias` do grupo: 1+ das sete palavras (`dom`…`sab`), sem repetir; `faixas`: a mesma regra do `horario`
  (`problemaDasFaixas`: 1 a 3 faixas, "HH:MM", em ordem, sem sobrepor, 24h só sozinha).
- `horario` e `dias` ficam **exatamente como estão** — nenhum formato velho muda, a semente não muda, o histórico não
  muda, e o "voltar versão" segue gravando o documento antigo como ele era.
- Nome do campo: decisão minha; o construtor pode trocar se o projeto tiver convenção melhor.

**Regras de escrita (porta, com frase — todas PENDENTE até o João ler):**
- grupo sem dia, ou sem faixa → recusa;
- o mesmo dia em dois grupos → recusa;
- dia de um grupo que o lugar NÃO abre (há `dias` e o dia não está lá) → recusa (seria horário pra dia fechado);
- `horarioPorDia` sem `horario` → recusa ("diferente" de quê?). ⚠️ Decisão minha: um lugar com hora só em alguns dias
  (sem hora nos outros) fica de fora desta rodada; quem tem hora em todo dia aberto é o caso pedido;
- um grupo que cobre TODOS os dias abertos → recusa (o horário-base nunca valeria; o certo é mudar o horário);
- um grupo com as mesmas faixas do horário-base → recusa (não é diferente).
Tirar o `horario` (o "Não tem") com `horarioPorDia` presente: a porta recusa com frase pedindo tirar primeiro o
horário diferente — decisão minha, pra nunca sobrar um "diferente" órfão.

## 4. O que o app diz (leitura)

**Horário do dia D** = as faixas do grupo que contém D, senão o `horario`. Toda leitura de hora passa por aí:
- **carimbo** ("Fechado agora", "abre às X", "abre amanhã às X", "abre sábado às X"): `fechadoAgora`, `rotuloAbertura`,
  `rotuloFaixa` usam o horário DO DIA. Em particular, "abre amanhã às X" usa as faixas do PRÓXIMO dia aberto, não as de
  hoje (hoje o código usa a primeira faixa do horário único — com grupos isso mentiria).
- ⚠️ Faixa que atravessa a meia-noite (ex. 20h–02h): segue a regra de hoje, lida com o horário do dia corrente. Decisão
  minha: não modelar "a madrugada de sábado pertence à sexta" nesta rodada (nenhum lugar do acervo tem isso); o
  construtor deixa um comentário honesto dizendo o limite.
- **ficha (o ticket)**: as linhas por grupo, cada uma com os dias e as horas, ex. *"Segunda a sexta · 8h–17h"* e
  *"Sábado e domingo · 7h–12h"*. Os dias do horário-base são os dias abertos menos os dos grupos. A forma exata das
  linhas é redação nova → PENDENTE.
- **cartão / lista (a pílula curta)**: não cabe a semana. Decisão minha: mostra o horário-base seguido de uma marca
  curta de que varia (redação nova → PENDENTE). O carimbo do cartão já diz o certo pro AGORA.
- **revisão antes de publicar**: a pergunta nova aparece com as linhas dos grupos (ou "Pulada"/"Sem resposta" como as
  outras).
- O que é assinatura pública e muda é só isso; sem `horarioPorDia`, toda tela fica **idêntica** a hoje (é o teste que
  prova que nada quebrou nos três lugares do acervo).

## 5. Coerência (as regras que comparam campos)

- `horario-invertido-sem-aviso` e `prosa-bate-com-hora-de-fechar` passam a olhar as faixas de TODOS os grupos além do
  horário-base (uma hora de fechar na prosa vale se bater com qualquer uma).
- As regras novas da §3 entram no mesmo lugar que as de dias (`coerencia.ts` e/ou a porta de escrita — o construtor
  segue onde as irmãs moram), com frase pro painel E pra quem usa (`FRASE_DA_PESSOA`).

## 6. Onde se responde

- **Painel do João** (lugar novo, ficha no ar, revisão) e **quem usa** (`/contribuir`, lugar novo e edição do lugar
  dela): o campo entra nos dois, opcional, na ordem: `horario`, `dias`, `horarioPorDia`.
- **Editor** (no celular, a 375 px): uma lista de até 3 grupos; cada grupo tem as caixas de marcar dos dias (o mesmo
  instrumento dos `dias`, nome do dia por extenso) e as faixas (o mesmo instrumento do `horario`, reaproveitado, não
  copiado). "+ outro grupo" até 3; "tirar este grupo"; um Salvar que grava a lista inteira numa requisição; o "Não tem"
  de sempre tira o campo. Desfazer e segundo toque como todo editor.
- ⚠️ Pra exigir menos: os dias oferecidos no grupo são os dias em que o lugar abre (se `dias` respondido), e um dia já
  usado por outro grupo aparece desligado. Decisão minha.
- Pergunta nova no questionário (`docs/questionario-ficha.md`, seção nova depois de "Os dias da semana", e o texto da
  tela em `perguntas.ts`) — redação minha, PENDENTE, ex.: *"Algum dia esse lugar abre ou fecha em outra hora? Se
  tiver, quais dias e que horas?"*. A seção do `dias` que diz "independente do `horario`, de propósito" continua
  verdadeira e ganha uma linha apontando a seção nova.

## 7. Fora desta rodada (não-objetivos)

- Mudar o formato do `horario` ou do `dias`.
- Horário por data (feriado, temporada, "em janeiro abre até 18h") — é outra coisa; o aviso do dono já cobre o pontual.
- Hora só em alguns dias, sem horário-base (ver §3).
- Madrugada que pertence ao dia anterior (ver §4).
- Preencher horário de lugar real: nenhum dado do acervo muda por esta rodada.

## 8. Anti-objetivos (falharia mesmo funcionando)

- Lugar com horário único ficar com UM toque a mais que hoje, além do Pular da pergunta nova.
- Qualquer tela dos três lugares do acervo mudar.
- O carimbo afirmar hora de um dia usando a de outro.
- Frase nova no ar sem `PENDENTE` / sem o João ler (pacote de frases antes do deploy, como nas rodadas anteriores).

## 9. Restrições do projeto (as de sempre)

- Dado no banco, editável pelo celular, sem deploy pra atualizar ([[lei]]).
- Toda frase nova nasce `// PENDENTE: redação minha, o João ainda não leu`; o guarda `frases-da-rodada-marcadas` cobre
  a rodada (com a base desta rodada) e não se afrouxa.
- Portões: `npx vitest run`, `npx tsc --noEmit`, `npm run build`, `node scripts/mutar.mjs` (42/0/0, ou mais se a rodada
  cravar mutações novas). Deploy só com o ok dele: `npm run semear` antes de `vercel --prod --yes`.

## 10. Deixado ao construtor

Os nomes internos de funções; onde exatamente moram as regras novas (porta × coerência), seguindo as irmãs; a
espécie nova no registro de campos e o editor (reaproveitando `EditorFaixas` e as caixas do `EditorLista`); o rótulo
interno das linhas; a forma da marca curta da pílula (a frase vai PENDENTE pro pacote).
