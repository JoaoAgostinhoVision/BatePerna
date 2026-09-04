# Os agentes deste projeto

Seis análises se repetiram em **toda** rodada do BatePerna. Cada uma virou um agente aqui, com o
histórico real dentro — não com boas práticas genéricas. Chame por nome.

| agente | quando | por que existe |
|---|---|---|
| **`voz-do-lugar`** | antes de acrescentar ficha nova; depois de mexer em texto de tela | 5 vezes o app afirmou sobre UM lugar num componente que serve TODOS. Nenhum teste pega |
| **`prova-que-trava`** | antes de fechar rodada; ao revisar teste novo | 34 espécies catalogadas de prova que passa verde sem travar nada. **O código chegou certo 8/8; o que erra é a prova** |
| **`procedencia`** | antes de subir ficha; ao redigir copy; sempre que o dado vier de fora | a linha vermelha. A web disse R$ 5, ele disse R$ 10 — e nenhum teste veria o app cobrando metade |
| **`contracao-honesta`** | depois de task que apaga campo, símbolo, teste ou tela | uma contração apagou 10 testes fora do alvo **com a suíte verde** |
| **`conferir-no-ar`** | depois de todo deploy | `● Ready` não prova conteúdo, e marcador com acento dá o mesmo quadro de um deploy que não subiu |
| **`pesquisa-de-lugar`** | quando ele pedir "procura no Google"; ao preparar ficha nova | a mesma busca que ajudou errou o **preço pela metade**, ofereceu a coordenada de **outra cachoeira a 5 km**, e o horário dela junto |

## O que os cinco têm em comum, e é de propósito

- **Nenhum conserta.** Todos devolvem achado + saídas. Texto de tela deste app é decisão do João —
  cinco vezes ele escolheu entre saídas apresentadas, e cinco vezes escolheu melhor que a proposta.
- **Nenhum tem `Edit` ou `Write`.** Auditor que conserta para de auditar.
- **Todos exigem evidência, não impressão** — mutação nomeada, número de varredura, `arquivo:linha`.
- **Todos marcam o que já é escolha registrada dele** (o selo *"barro · dá um tempo"*, por
  exemplo). Isso não é achado, é decisão — reabrir por conta própria é erro.

As fontes de onde eles saíram: `docs/RESUME.md` e a memória do projeto
(`testes-que-nao-travam-nada`, `bateperna-diario-de-rodadas`, `nao-inventar-fatos-de-roteiros`).
