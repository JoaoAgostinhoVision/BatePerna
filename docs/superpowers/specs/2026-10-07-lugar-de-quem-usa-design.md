# Lugar mandado por quem usa o app — desenho

> 2026-10-07. Brainstorm com o João depois do deploy do painel completo (`f779f8c`). Cada decisão abaixo foi
> respondida ou aprovada por ele nesta data; as frases entre aspas são escolhas dele ou redação minha marcada.
> Pedido de origem, palavra dele: *"faltou também a parte de como o usuário comum vai poder inserir os locais que
> ele quer publicar"*.

## Decisões dele (07/10)

| Pergunta | Resposta dele |
|---|---|
| O que acontece com o lugar mandado? | **"Vai ao ar direto, marcado"** — sem passar pela fila dele |
| Quem pode mandar? | **"Só com login simples"** |
| O que a pessoa preenche? | **"Curto, com veredito padrão"** |
| Quem mexe depois? | **"A pessoa também edita o dela"** enquanto não conferido; marca some quando ele confere |
| Login e arquitetura | **Clerk + caminho A** ("sim") |
| Partes 1–4 do desenho | aprovadas uma a uma ("está certo, pode seguir") |
| Números da regra padrão | **"use a sua sugestão"**: 3 h pra frente, 6 h pra trás, 0,2 mm, força "cuidado" |

🔴 **A exceção à linha vermelha, dita por extenso.** Até aqui o app só afirmava o que veio do João. A partir
daqui ele mostra, no ar, o que uma pessoa qualquer (logada) escreveu, sem ninguém conferir. Foi escolha dele. **O
que segura a honestidade é a MARCA**: nenhum lugar não conferido pode aparecer em tela pública sem ela. Essa é a
invariante central da rodada e a prova mais vigiada.

## Arquitetura (caminho A)

O lugar da pessoa mora nas **mesmas tabelas** que os do João (`ficha_versoes`, `ficha_rascunhos`, visibilidade,
endereços antigos), com três dados a mais **por lugar** (não por versão):

- `autor` — quem mandou: id do usuário Clerk (nulo = do João / acervo original).
- `conferido` — booleano; lugares do João nascem conferidos (migração: todos os existentes = conferido).
- `regra_propria` — booleano; falso = o carimbo usa a regra padrão do banco.

E uma tabela pequena:
- `regra_padrao` — uma linha: `janela_previsao_horas`, `janela_passado_horas`, `limiar_mm`, `severidade`.
  Semente inicial **3 / 6 / 0,2 / "cuidado"** (decisão dele). Editável pelo painel.
- `contribuidores` — id Clerk, nome, e-mail, `bloqueado`, criado_em. Nome e e-mail SÓ pro painel dele.

**Login.** Clerk (integração nativa do Vercel Marketplace, `vercel integration add clerk`), com "Entrar com
Google". Clerk cuida SÓ de quem contribui; o painel do João continua com a senha de hoje (`lerConfigAdmin`), sem
mudança. Rotas públicas continuam sem login. A instalação pode pedir passo no navegador/conta dele — isso é do
João, e o plano para ali e pede.

**Gravação.** As rotas de escrita da pessoa são NOVAS (`/api/contribuir/...`), separadas das `/api/admin/...`: cada
uma confere sessão Clerk, `bloqueado = false`, e que o lugar é DELA e está `conferido = false`. Por dentro, reusam
as mesmas funções de banco e as mesmas portas (`porta-de-publicar`, `porta-de-coerencia`) que o painel usa.

## Parte 1 — o que a pessoa vê e preenche

- Entrada: **"+ mandar um lugar"** na barra de baixo. Sem login → tela do Clerk; com login → formulário.
- Formulário curto, uma pergunta por tela, com os editores de `src/app/admin/campos/` reaproveitados:
  1. nome *(obrig.)* 2. cidade *(obrig.)* 3. ponto no mapa *(obrig.; é a coordenada da chuva E o ponto 1 do
  trajeto)* 4. o que é, em uma frase *(obrig.; vira a `promessa`)* 5. como se chega *(obrig.; `acesso`)*
  6. o que pode dar errado *(opcional; `avisos`)* 7. custa ou é grátis *(obrig.)* + quanto *(opcional)*
  8. horário e dias *(opcional)*. Depois, **"Publicar"** → no ar na hora, com a marca.
- Rascunho no mesmo `ficha_rascunhos`, com `autor`. O "Desistir deste lugar" da Tarefa 15 vale aqui também.
- Endereço: a mesma regra de nascer (`nome-cidade`) e a mesma colisão (nome repetido, a cidade separa).
- **"Meus lugares"**: lista do que a pessoa mandou; edita com os mesmos editores enquanto não conferido. Depois de
  conferido, o editar some pra ela.
- 🔴 **O que NÃO se pergunta, a página CALA** (não mostra o bloco, nunca preenche com texto genérico): voz, prêmio,
  rótulo de escaneio, regra/texto da regra, ressalva, discriminador (o que olhar na entrada), piso, carro comum,
  secaRapido. Consequência no schema: esses campos passam a ser **opcionais no `fichaSchema`** (um schema só,
  sem ramo por origem). Quem continua EXIGINDO cada um nos lugares do João é a porta de publicar dele
  (`porta-de-publicar`, como já faz com as obrigatórias do formulário); a porta da pessoa exige só as 5
  obrigatórias dela. A página pública aprende a calar cada campo ausente.
- Fora desta rodada: foto, comentário, trajeto com mais de um ponto.

## Parte 2 — a marca

- Aparece em **toda** superfície pública que mostra lugar: lista da home (etiqueta junto do nome), pin do mapa
  (contorno diferente), topo da página do lugar (faixa abaixo do nome), carimbo (meia-linha da regra padrão). E em
  qualquer superfície futura — por isso a prova é uma varredura, não uma lista.
- Palavras (redação minha, `PENDENTE`, ele lê antes de subir): etiqueta **"não conferido"**; faixa **"Mandado por
  alguém que usa o app. O BatePerna ainda não conferiu."**; carimbo **"regra padrão — ninguém calibrou a chuva
  aqui"**.
- O nome de quem mandou **não aparece** pro público.
- "Conferi" tira etiqueta + faixa. A meia-linha do carimbo só sai quando o lugar tem regra própria
  (`regra_propria = true`) — conferir sem calibrar deixa a meia-linha, porque continua verdade.
- 🔴 **Prova central:** varredura de toda tela pública que renderiza lugar; um lugar `conferido = false` sem a
  marca → vermelho. Mutação obrigatória: tirar a marca de UMA superfície → vermelho.

## Parte 3 — o painel do João

- `/admin` ganha no topo **"Mandados por quem usa o app, ainda não conferidos"** (mais novo primeiro; nome, e-mail,
  data). Conferidos voltam pra lista normal.
- No lugar mandado: tudo o que os dele têm (ficha inteira, editar, esconder, histórico) +
  - **"Conferi"** (dois toques): `conferido = true`; a pessoa perde a edição.
  - **"Bloquear quem mandou"** (dois toques): `bloqueado = true` + esconde TODOS os lugares dela; ela não manda nem
    edita mais. **"Desbloquear"** desfaz o bloqueio (os lugares continuam escondidos até ele mostrar de novo).
- Edição concorrente: última gravação vale (como hoje). O histórico diz quem gravou ("você, pelo painel" / "quem
  mandou"); "voltar a esta" desfaz qualquer uma.
- Portões de coerência valem pra pessoa; as frases de recusa ganham versão pra ela (pacote de copy da rodada).

## Parte 4 — a regra padrão da chuva

- Mora em `regra_padrao` no banco; tela **"Regra padrão da chuva"** no painel. Mudar não pede código nem deploy.
- Vale pra todo lugar com `regra_propria = false`. Calibrar um lugar (preencher a regra pelo painel) liga
  `regra_propria`.
- Inicial: **3 h / 6 h / 0,2 mm / "cuidado"** (decisão dele, 07/10).
- 🔴 **"seco · carro comum" deixa de ser universal:** em lugar sem regra própria, a linha seca diz só **"seco"** —
  ninguém conferiu que carro comum chega. (A rodada "como se chega", já pedida por ele, depois alimenta essa linha.)

## Erros e bordas

- Sessão Clerk expirada no meio do formulário: o rascunho fica; o próximo gravar pede login de novo e volta à
  mesma pergunta.
- Pessoa bloqueada tentando gravar: recusa com frase (pacote de copy), nada grava.
- Clerk fora do ar: só a contribuição para; o app público e o painel do João não dependem dele.
- Banco fora: igual ao resto do app (erro honesto, sem memória — decisão de 07/10).

## Testes (o que tem de travar)

- A marca em toda superfície (varredura + mutação por superfície).
- Rotas `/api/contribuir/*`: sem sessão → 401; bloqueado → recusa; lugar de OUTRA pessoa → recusa; lugar conferido
  → recusa; nunca alcançam lugar do João.
- Regra padrão: lugar sem regra própria usa a do banco; mudar a do banco muda o carimbo; calibrar desliga.
- "seco" sem "carro comum" em lugar sem regra própria; com regra própria, como hoje.
- Página cala cada bloco ausente (um teste por campo opcionalizado).
- Bloquear esconde todos os lugares da pessoa; conferir tira a marca e a edição.
- Migração: todo lugar existente nasce `conferido = true`, `regra_propria = true`, `autor = null`.
- Portões de sempre em todo dispatch: vitest, tsc, **build**, `mutar.mjs` 42/0/0.

## Fora de escopo

Foto, comentários, trajeto multiponto, limite de envios por pessoa (o "Bloquear" é a saída por ora), "como se
chega" e cidade/endereço automáticos (rodadas próprias, já pedidas).

## Ordem sugerida pro plano

1. Migração + `regra_padrao` + regra padrão no carimbo + "seco" sem "carro comum" (sem login ainda; testável sozinho).
2. Página cala blocos ausentes + a marca em todas as superfícies (com lugar de usuário semeado só em teste).
3. Painel: seção de não conferidos, "Conferi", tela da regra padrão.
4. Clerk instalado (passo dele) + rotas `/api/contribuir` + formulário curto + "Meus lugares".
5. Bloquear/desbloquear.
6. Pacote de copy → leitura dele → deploy.
