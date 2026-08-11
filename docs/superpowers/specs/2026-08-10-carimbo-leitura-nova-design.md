# Design — O carimbo busca leitura nova quando a tela volta

**Data:** 2026-08-10
**Contexto:** A moldura de app está no ar (merge `6ef0fdc`). Nesta mesma sessão, o carimbo passou a reavaliar em `visibilitychange`/`pageshow` (`fd5b3d1`) — antes ele dependia de um `setInterval` de 60s, que o navegador estrangula em aba escondida. Era o item **(b)** do RESUME.

Consertar (b) expôs a pergunta que este spec responde. Com (b), você desbloqueia o celular no portão às 11h e a ficha diz honestamente *"não tenho leitura"*. Mas se há sinal ali, o app **poderia** ir buscar a resposta de agora em vez de dar de ombros. Do jeito que está, **a hora em que a decisão mais importa é a hora em que ele para de responder.**

## Objetivo

Quando a tela volta e a leitura de chuva está velha, o app busca uma nova em vez de só se declarar ignorante. No portão com sinal, você vê a resposta de agora; sem sinal, você vê que ele não sabe.

## Escopo

**Faz:**
- Rota `GET /api/carimbo?slug=…` que devolve a leitura de agora.
- O componente `Carimbo` passa a ter a leitura como estado próprio, e a buscar sozinho quando a que está na tela não vale mais.
- Um toque no carimbo sem informação pede outra tentativa.
- Unifica as frases de "não tenho leitura" numa só (ver Decisões).
- Extrai `resolverEstado` da página pra uma lib compartilhada, com teste próprio (fecha um deferido do ledger).

**NÃO faz (de propósito):**
- **Não** busca quando a leitura na tela ainda vale. Voltar pra tela com uma leitura de 5 minutos não gasta rede: os 30 minutos são a regra, e ela já está decidida.
- **Não** implementa *pull-to-refresh*. Gesto que compete com a rolagem da página e some no meio dela; o carimbo tocável é alvo maior e visível.
- **Não** retenta sozinho em laço. Falhou, para e espera o toque — no portão, tentar em segundo plano gasta bateria e dado sem dizer a você se vale esperar.
- **Não** mexe no motor (`avaliar`), no `fetchPrecip`, no banco, no mapa nem no placar do "Fui".
- **Não** toca no service worker. `/api/*` já é `NetworkOnly` (`nuncaCachear`), então leitura nova nunca pode vir de cache — a garantia já existe.

## Decisões de produto

- **Uma frase só pra "não tenho leitura": `SEM INFORMAÇÕES · tome cuidado`.** Substitui o `Não suba · sem leitura · cheque no portão` de hoje nos três casos: servidor não conseguiu ler, leitura venceu, busca falhou.

  A decisão veio do João e mudou a postura do app. Hoje, ignorância vira ordem: sem saber nada sobre o morro, a ficha manda não subir. Passa a informar o estado e devolver a decisão — que é o princípio de co-piloto que o modelo já cravava em todo eixo. **`Não suba` continua existindo**, mas só quando o motor *leu* a chuva e o barro está ruim: vira uma ordem com dado por trás, em vez da resposta padrão pra ausência de dado. A cor de parada fica nos dois.

  O desenho original tinha **duas** frases — uma pra "ainda não tentei", outra pra "tentei e falhei". Caiu no brainstorm: com a busca disparando também no carregamento da página, "ainda não tentei" só sobreviveria na tela de quem fica trinta minutos seguidos olhando pra ficha sem bloquear o celular. Duas frases pra dizer a mesma coisa, uma delas quase invisível — quando aparecesse, leria como inconsistência.

- **Durante a busca, o carimbo fica neutro: `CONFERINDO… · lendo a chuva agora`.** Escolhido pelo João contra a minha recomendação (que era segurar o texto anterior e avisar embaixo). É o único momento em que o app não responde à pergunta, e é o que motiva o prazo curto abaixo.

- **3 segundos pra tirar o "Conferindo…" da tela — sem cancelar a requisição.** Estourou, o carimbo volta a dizer `SEM INFORMAÇÕES`. Mas a busca continua viva: se a resposta chegar aos 7s, o carimbo repinta com ela. Você nunca fica mais de 3s sem resposta na tela e ainda assim ganha a leitura quando ela vem.

  Três, e não os seis do service worker, porque os contextos são opostos: lá, seis segundos é o que se espera antes de servir uma cópia guardada, com a tela em branco; aqui a tela já tem conteúdo e o que está em jogo é por quanto tempo o app fica sem afirmar nada — bem na hora da decisão.

- **O carimbo sem informação é o botão.** Sem leitura, o bloco inteiro fica tocável, com um `toque pra conferir` discreto embaixo. Alvo enorme, que a mão suja acerta sem raiva, e que **só existe quando serve pra alguma coisa**: com leitura boa na tela não há botão nenhum. Nada de botãozinho de "atualizar" permanente.

## Arquitetura

Princípio load-bearing, herdado das três rodadas anteriores: **a decisão nunca depende das peças novas.** O carimbo continua chegando server-rendered no primeiro paint, sem JS. A busca é camada por fora — cai sozinha sem derrubar a ficha.

```
/[slug]  (server component, force-dynamic)
   └─ resolverEstado(ficha, debug) ─┐
                                    ├─ src/lib/carimbo-estado.ts  (a mesma verdade)
GET /api/carimbo?slug=… ────────────┘
   └─ { estado, erro, calculadoEm }

<Carimbo>  (client, SSR-ado — o HTML do servidor já traz a afirmação)
   estado inicial = as props do servidor
   gatilhos: pageshow · visibilitychange · toque
   guarda: uma busca por vez; piso de 30s entre buscas automáticas
```

### Quando busca, exatamente

Três gatilhos, com condições diferentes — e a diferença tem motivo:

| Gatilho | Busca quando |
|---|---|
| `pageshow` (carregou ou voltou do bfcache) | a leitura já está **vencida** |
| `visibilitychange` → visível | **vencida ou erro** |
| toque | **sempre** |

`pageshow` não busca no caso de erro porque uma página recém-renderizada acabou de tentar, do servidor, milissegundos atrás — repetir da mão do usuário é improvável de ajudar e trocaria a mensagem honesta por 3 segundos de "Conferindo…" em **todo** carregamento enquanto o Open-Meteo estivesse fora do ar.

E a página recém-renderizada nunca tem leitura vencida: `calculadoEm` é agora. Então esse gatilho na prática só dispara pra página que veio do **cache do service worker** — que é exatamente onde buscar é o certo.

No retorno à visibilidade o tempo passou, então erro também merece nova tentativa. O piso de 30s entre buscas automáticas evita que alternar de app dez vezes vire dez chamadas; **o toque ignora o piso** — quem tocou está pedindo.

### A rota

`GET /api/carimbo?slug=<slug>` → `200 {"estado":"fresco"|"frio","erro":boolean,"calculadoEm":number}`

- `calculadoEm` em **epoch de segundos**, igual ao que a página já passa pro componente e ao que `carimboVenceu` espera.
- `erro: true` com `estado: "frio"` quando a leitura falhou no servidor — o mesmo par que `resolverEstado` já devolve hoje no `catch`. A rota **não** responde 5xx nesse caso: "não consegui ler a chuva" é uma resposta válida do domínio, não uma falha de transporte, e o cliente precisa distinguir isso de "a requisição nem chegou".
- `404` com corpo `{"erro":"ficha não encontrada"}` se o slug não existe.
- `Cache-Control: no-store`.
- Entra em `outputFileTracingIncludes` no `next.config.mjs` — `tests/deploy/tracing.test.ts` é o cadeado e quebra o build se eu esquecer.

### `src/lib/carimbo-estado.ts`

`resolverEstado` sai de `src/app/[slug]/page.tsx` pra cá, sem mudança de comportamento. Página e rota passam a chamar a mesma função: **duas fontes pro mesmo carimbo seria a semente de duas respostas diferentes pro mesmo morro.** Fecha de passagem o deferido "`resolverEstado` sem teste próprio".

### Os três estados do carimbo

| Estado | Marca | Sub | Motivo | Pulso | Tocável |
|---|---|---|---|---|---|
| **afirmando** | `Pode subir` / `Não suba` | `seco · carro comum` / `barro · dá um tempo` | o de hoje, do motor | pisca | não |
| **conferindo** | `CONFERINDO…` | `lendo a chuva agora` | "Buscando a leitura de agora." (+ "A das 7h12 passou do prazo." se havia leitura) | pisca | não |
| **sem informações** | `SEM INFORMAÇÕES` | `tome cuidado` | varia com o caso (abaixo) | parado | **sim** |

Motivos de "sem informações":
- servidor não leu → "Não deu pra ler a chuva agora. Na dúvida, cheque o barro no portão."
- leitura venceu, sem tentativa → "Essa leitura é das 7h12 e já passou do prazo. O barro muda rápido — cheque no portão."
- busca estourou ou falhou → "Não deu tempo de ler a chuva. Na dúvida, cheque o barro no portão."

A hora só é citada quando existiu leitura. Quando o servidor não conseguiu ler, não há hora nenhuma pra citar — a mesma regra que `d5d8987` cravou e que já tem teste (`erro` ganha de `venceu`).

O atributo `data-sem-leitura` criado hoje de manhã (`d5d8987`) já é o interruptor do pulso: fica em "sem informações", sai em "conferindo" — ali a leitura *é* de agora.

O bloco tocável vira `<button type="button">` de verdade, não `div` com `onClick`. Mesmo padrão do `Appbar`, que já troca entre `<a>` e `<div>` conforme sirva de saída: ganha teclado e leitor de tela sem código extra.

### Erros e casos de borda

- **Offline:** `fetch` falha na hora → "sem informações", com o toque disponível. O service worker não intercepta (`/api/*` é `NetworkOnly`), então não há risco de leitura velha.
- **Rede pendurada:** os 3s tiram o "Conferindo…"; a resposta tardia ainda repinta.
- **Resposta tardia de uma busca antiga:** ignorada se outra busca já começou. Sem isso, uma leitura de 40s atrás poderia sobrescrever uma de 2s atrás.
- **Sucesso reinicia o relógio:** `calculadoEm` novo, e os 30 minutos contam de novo a partir dali.
- **`visibilitychange` dispara ao esconder também.** Só o retorno à visibilidade conta (`document.visibilityState === "visible"`).
- **Desmontagem:** ouvintes removidos e resposta em voo descartada — nada de `setState` em componente morto.
- **Ficha aberta em `?debug=fresco`:** o parâmetro é da página. A rota não o aceita, então uma busca substituiria o estado forçado pelo real. É ferramenta de desenvolvimento; não vale código pra preservar.

## Testes

- **`carimbo-estado`** (novo): fresco, frio, e o `catch` devolvendo `{frio, erro:true}`. `fetchPrecip` mockado.
- **Rota:** 200 com o trio; 404 pra slug inexistente; `no-store` no cabeçalho; cadeado do tracing continua verde.
- **Componente:**
  - retomada com leitura vencida busca e repinta com a leitura nova;
  - leitura válida na tela **não** busca ao voltar;
  - estouro de 3s mostra "Sem informações", e a resposta que chega aos 7s ainda repinta;
  - falha de rede mostra "Sem informações";
  - toque busca;
  - uma busca por vez — segundo gatilho durante "Conferindo…" não dispara nada;
  - página com erro do servidor **não** busca ao carregar, mas busca ao voltar a visibilidade;
  - o piso de 30s segura a segunda busca automática, e o toque passa por cima dele;
  - sem informação, o carimbo é `<button>`; com leitura boa, não é.

## O que este spec supersede

O spec de `2026-08-05-forma-de-app` descreve a memória do "onde você estava" dividida entre `src/middleware.ts` (grava) e `/` (valida). **O middleware não existe mais** — foi removido em `68c4edb`, porque gravava o cookie antes de saber se a rota existia e um link torto apagava a memória boa. Quem grava agora é `LembrarUltima`, dentro da ficha que renderizou. Não tem relação com este spec, mas quem ler aquele documento depois precisa saber.
