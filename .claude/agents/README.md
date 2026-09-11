# Os agentes deste projeto

Dez agentes, em **duas famílias**. Chame por nome.

## 1. Os seis que ACHAM — análises que se repetiram em toda rodada

| agente | quando | por que existe |
|---|---|---|
| **`voz-do-lugar`** | antes de acrescentar ficha nova; depois de mexer em texto de tela | 6 vezes o app afirmou sobre UM lugar num componente que serve TODOS. Nenhum teste pega |
| **`prova-que-trava`** | antes de fechar rodada; ao revisar teste novo | 36 espécies catalogadas de prova que passa verde sem travar nada. **O código chegou certo 8/8; o que erra é a prova** |
| **`procedencia`** | antes de subir ficha; ao redigir copy; sempre que o dado vier de fora | a linha vermelha. A web disse R$ 5, ele disse R$ 10 — e nenhum teste veria o app cobrando metade |
| **`contracao-honesta`** | depois de task que apaga campo, símbolo, teste ou tela | uma contração apagou 10 testes fora do alvo **com a suíte verde** |
| **`conferir-no-ar`** | depois de todo deploy | `● Ready` não prova conteúdo, e marcador com acento dá o mesmo quadro de um deploy que não subiu |
| **`pesquisa-de-lugar`** | quando ele pedir "procura no Google"; ao preparar ficha nova | a mesma busca que ajudou errou o **preço pela metade**, ofereceu a coordenada de **outra cachoeira a 5 km**, e o horário dela junto |

## 2. Os quatro que ACHAM **e PROPÕEM** — criados em 2026-09-10, a pedido dele

> *"quero que você gere agentes completos que consigam analisar essas dúvidas e dar sugestões
> também, tem coisas que sou leigo"* — João, 10/09.

A família 1 devolve o achado e cala, porque o achado já é a resposta. Estes quatro devolvem
**achado + menu de saídas + uma recomendação explícita**, porque a dúvida é de um domínio em que
ele não tem como julgar sozinho — tipografia, custo de código, gradação de risco, redação.

| agente | a dúvida que ele resolve | a trava que ele não pode cruzar |
|---|---|---|
| **`calibrar-veredito`** | a tela grita mais do que ele falou? (*"pode ir com cuidado"* × carimbo **"Não vá"**) | separa **PALAVRA × VOCABULÁRIO × MOTOR**. Confirmar a premissa ≠ escolher o remédio |
| **`olho-de-tela`** | como a tela FICA — hierarquia, tipografia, 375px — e o que ele deve olhar no celular | especificidade calculada e `arquivo:linha`; *"fica mais bonito"* é proibido |
| **`tres-redacoes`** | falta palavra na tela; quais são as opções? | **três** redações, a 1ª sempre SUBTRAÇÃO, procedência palavra por palavra. Nenhuma está aprovada |
| **`escolha-de-produto`** | ordem da ficha, ficha × waypoint, qual eixo construir | primeiro pergunta se **a pergunta é a certa**. Custo em arquivos e testes, não em story points |

## O que os DEZ têm em comum, e é de propósito

- **Nenhum conserta, e nenhum tem `Edit` ou `Write`.** Auditor que conserta para de auditar — e
  quem escreve o texto é o pior auditor dele. Recomendar é permitido; executar não.
- **Sugestão nunca vira publicação.** Os quatro da família 2 recomendam; a recomendação entra na
  tela quando **ele** escolher. *"pode seguir"* nunca foi *"li e aprovei"* — este projeto já pagou
  por essa confusão com prosa minha seis dias no ar assinada como a voz dele.
- **Todos exigem evidência, não impressão** — mutação nomeada, número de varredura, `arquivo:linha`,
  especificidade calculada.
- **Todos marcam o que já é escolha registrada dele** (o selo *"barro · dá um tempo"*, o rodapé
  `BatePerna · PE`, *"1 agora, 3 depois"*). Isso não é achado, é decisão — reabrir por conta
  própria é erro.
- **Todos se passam a bola:** achado de CSS que virou ordem de blocos vai pro `escolha-de-produto`;
  achado que precisa de frase nova vai pro `tres-redacoes`; qualquer proposta que suba ao ar passa
  depois pelo `conferir-no-ar`.

As fontes de onde eles saíram: `docs/RESUME.md`,
`_bmad-output/planning-artifacts/bateperna-modelo-e-requisitos.md` e a memória do projeto
(`testes-que-nao-travam-nada`, `bateperna-diario-de-rodadas`, `trava-removida-por-quem-escreveu`,
`nao-inventar-fatos-de-roteiros`).
