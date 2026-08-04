# Design — "Fui" de verdade (presença + o que encontrou)

**Data:** 2026-08-03
**Contexto:** A Rampa do Pepê está no ar (https://bateperna.vercel.app), calculando fresco/frio ao vivo. João usou no celular, validou o design, e o botão "✓ Fui" — hoje um enfeite ("chega depois") — deu vontade de clicar. Este é o primeiro dos três pedaços que ele levantou (os outros: mapa de verdade; menu/forma de app).

## Objetivo

Fazer o "✓ Fui" funcionar de verdade: o cliente marca que foi **e diz o que encontrou no portão** (seco ou barro), o app registra e devolve um **placar leve do dia**. Fecha a alça que o modelo não enxerga — a chuva medida ≠ o barro na entrada.

## Escopo (cravado)

**Faz:**
- Botão "Fui" interativo → captura "como estava no portão": **seco** (deu pra subir) ou **barro** (não deu).
- Registra anônimo no banco.
- Mostra placar do dia: quantos foram · quantos acharam barro.

**NÃO faz (fica pra depois, de propósito):**
- **Não** deixa o relato influenciar/override o carimbo dos próximos. Isso é a mecânica de confiança inteira (recência, quórum, decaimento) e merece design próprio.
- **Não** tem login/identidade. Confirmação é anônima.
- **Não** liga o cron/freshness nem o motor persistido. Só a tabela `confirmacoes`.

## Decisões de produto

- **Sentido do "Fui":** presença + o que encontrou (não vaidade). O relato é ground-truth do portão.
- **Janela do placar:** "hoje" = desde a meia-noite no fuso America/Recife (UTC−3, sem horário de verão — determinístico). O que importa é a condição atual; "ontem tava barro" não ajuda hoje.
- **Anônimo**, com trava leve anti-duplo-toque no próprio dispositivo (localStorage), sem barreira dura (baixo risco).

## Arquitetura

Princípio load-bearing: **o carimbo ao vivo continua só-clima e não toca no banco.** O placar é um enfeite secundário buscado pelo cliente. Se o Turso cair, o "Fui" degrada sozinho e a decisão principal (o carimbo) nunca quebra.

```
Página / (server component, force-dynamic)
  └─ carimbo: getFicha → fetchPrecip → avaliar   [SÓ CLIMA, sem banco]
  └─ <ConfirmarFui slug/> (client component "use client")
        ├─ ao montar: GET /api/confirmar?slug=... → placar de hoje
        ├─ clica "Fui" → mostra "como estava?" [seco|barro]
        ├─ escolhe → POST /api/confirmar { slug, tipo } → placar atualizado
        └─ estados: idle → perguntando → enviando → contado(placar) | erro
```

### Componentes / unidades

1. **`src/lib/db.ts`** (existe) — adicionar `contarHoje(client, slug, agoraEpoch)` → `{ foram: number, barro: number }`.
   - `foram` = COUNT(*) de `confirmacoes` do slug com `criado_em >= inicioDoDiaRecife(agora)`.
   - `barro` = idem com `tipo = 'barro'`.
   - `inicioDoDiaRecife(agora)`: epoch (s) da meia-noite local em UTC−3. Determinístico, sem libs de fuso: `const OFFSET = -3*3600; const inicio = Math.floor((agora + OFFSET)/86400)*86400 - OFFSET;`. (Confere: agora=2026-08-03 01:00Z → local 2026-08-02 22:00 → início do dia local = 2026-08-02 03:00Z.)
   - `insertConfirmacao` passa a receber `tipo` explícito (`'seco' | 'barro'`) em vez do default `'foi'`.

2. **`src/lib/confirmar.ts`** (existe) — `registrarConfirmacao(client, slug, tipo, agora)` insere e devolve `contarHoje`.

3. **`src/app/api/confirmar/route.ts`** (existe) — dois métodos:
   - `GET ?slug=` → valida slug (`getFicha`), retorna `contarHoje`. Sem slug/ inválido → 400.
   - `POST { slug, tipo }` → valida slug e `tipo ∈ {seco,barro}` → registra → retorna placar. Corpo malformado → 400.
   - Ambos `force-dynamic`.

4. **`src/app/ConfirmarFui.tsx`** (novo, `"use client"`) — o pedaço interativo. Recebe `slug`. Máquina de estados idle→perguntando→enviando→contado|erro. Placar renderizado com o CSS da Versão D (classe `.confirmar`/nova). localStorage `bp:contou:<slug>:<diaRecife>` pra marcar "já contou hoje" (mostra o placar direto em vez do CTA).

5. **`src/app/page.tsx`** (existe) — troca o bloco estático `.confirmar` por `<ConfirmarFui slug={SLUG} />`. Nada mais muda; carimbo intocado.

### Dados

Tabela `confirmacoes` (já existe no schema): `id, ficha_slug, criado_em (epoch s), tipo`. `tipo` deixa de ser sempre `'foi'` e passa a ser `'seco' | 'barro'`.

## Infra (Vercel + Turso via Marketplace)

- **Provisionar:** `vercel integration add turso` → Vercel cria o banco e injeta `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` no projeto. **Passo do João:** autorizar/aceitar a integração no navegador que o CLI abrir.
- **Env local:** `vercel env pull .env.local --yes` (já gitignored via `.env*`).
- **Schema:** aplicar uma vez via script curto (`scripts/apply-schema.ts`) que chama `ensureSchema` (libSQL direto, sem ORM) contra as env puxadas. Scripts Node não auto-carregam `.env.local` (só o Next carrega) — rodar com `npx dotenv -e .env.local -- npx tsx scripts/apply-schema.ts` (ou equivalente). Só a `confirmacoes` é usada agora, mas `ensureSchema` cria as duas (idempotente, tudo bem).

## Erros / degradação

- Banco fora no `GET`: o componente não mostra placar (ou "—"), mas o CTA "Fui" ainda aparece; carimbo intocado.
- Banco fora no `POST`: componente mostra "não deu pra registrar agora, tenta de novo"; não trava a tela.
- `tipo`/slug inválidos: 400 texto simples (padrão já usado nas rotas).
- Carimbo ao vivo **nunca** depende do banco — é a invariante.

## Teste (TDD)

- `contarHoje`: red/green da borda do dia (um registro de ontem 23:59 Recife NÃO conta; hoje 00:01 conta); contagem por `tipo`.
- `insertConfirmacao` com `tipo` explícito.
- Rota: `GET` retorna placar; `POST` válido registra+conta; `POST` com `tipo` inválido → 400; slug inválido → 400.
- `ConfirmarFui`: renderiza CTA; clicar mostra as duas opções; escolher faz POST e mostra placar; caminho de erro mostra mensagem; respeita localStorage.
- Verificação final: ao vivo no celular (clicar Fui, ver placar subir), como feito com a Rampa.

## Fora de escopo / próximos

- Override do carimbo por relato humano (mecânica de confiança: recência/quórum/decaimento).
- Mapa de verdade.
- Menu / forma de app.
