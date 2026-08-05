# RESUME — BatePerna (retomar aqui)

> **Este arquivo mora em `docs/RESUME.md` e é versionado.** Antes ele vivia em `.superpowers/sdd/.../RESUME.md`, que tem `.gitignore` com `*` — era scratch, e um `git clean -fdx` teria apagado justamente o mapa de retomada. Mantenha aqui.

**Última parada:** 2026-08-04. **Estado: a Rampa está viva no celular — carimbo, "Fui" de verdade e mapa de verdade.**

## Estado em uma olhada

- **Branch:** `main`. Working tree **limpo**. Tudo commitado.
- **HEAD:** `a671146` (merge do mapa de verdade). **62/62 testes.**
- **NO AR (público):** **https://bateperna.vercel.app** — projeto Vercel `bate-perna/bateperna` (login `joaoricardoagostinho285@gmail.com`). Só o domínio limpo é público; URLs específicas de deploy pedem login (deployment protection).
- **Repo é local** (sem remote git). Deploy: `vercel --prod --yes` (CLI 58.5.1 instalada).
- **Memória-chave:** [[cliente-primeiro-materializar]] (thread ativo), [[sessao-natuba-mecanica-confianca]] (a mecânica de confiança), [[mapa-orienta-onde-texto-nao-orienta]] (por que o mapa vale nos roteiros remotos).

## O que está construído e vivo

1. **Rampa ao vivo (Versão D):** `src/app/page.tsx` (server component `force-dynamic`) → `getFicha → fetchPrecip(Open-Meteo) → avaliar(6h/3h) → carimbo` PODE SUBIR / NÃO SUBA. `src/app/ficha.css` (design D escopado sob `.bp`). `?debug=fresco|frio` força estado. Falha de clima → lado seguro + aviso honesto.
2. **"Fui" de verdade:** `src/app/ConfirmarFui.tsx` (client) → botão Fui → "como estava? seco|barro" → registra anônimo → **placar do dia** (janela America/Recife UTC-3). É o **"confirmar" da mecânica de confiança** ao vivo.
   - Data: `src/lib/db.ts`, `src/lib/confirmar.ts`, rota `src/app/api/confirmar/route.ts`.
   - **INVARIANTE:** o carimbo é **só-clima, não toca o banco**; o placar é **client-fetched**. Banco cai → botão degrada, decisão nunca quebra.
3. **Mapa de verdade (2026-08-04):** mosaico de tiles do OpenStreetMap no lugar da hachura decorativa, **pin na cor do carimbo**, mais distância em linha reta sob demanda.
   - `src/lib/mapa.ts` (Web Mercator, `tilesParaCaixa`, `zoomDeTiles`, constantes de enquadramento) e `src/lib/geo.ts` (haversine + `formatarDistancia`) — puros e testados.
   - `src/app/MapaEstatico.tsx` (server, zero JS) e `src/app/DistanciaDaqui.tsx` (client).
   - **INVARIANTES:** geolocalização **só depois de um toque** (prompt não pedido = negação permanente; há teste guardando); **"em linha reta" em todo ramo** de `formatarDistancia` (a reta mente pra baixo no agreste); **atribuição `© OpenStreetMap`** é obrigação ODbL, com teste guardando.
   - Spec: `docs/superpowers/specs/2026-08-04-mapa-de-verdade-design.md`. Plano: `docs/superpowers/plans/2026-08-04-mapa-de-verdade.md`.

## PRÓXIMO PASSO — o pedaço que falta da lista do João

João pediu 3 coisas ao ver no celular. Fui ✅, mapa ✅. Falta:

**Menu / forma de app** — o maior. Hoje é uma tela única com slug fixo (`SLUG = "rampa-do-pepe"` em `page.tsx`). Abre a pergunta "o que mais tem no app": várias fichas, descoberta, navegação. **Merece brainstorm próprio.**

> Fluxo que funcionou 2×: brainstorming → spec (`docs/superpowers/specs/`) → plano (`docs/superpowers/plans/`) → subagent-driven-development (implementer + revisor por task, revisão final da branch inteira no opus, leva única de correção).

## A olhar no celular quando sobrar (não bloqueiam nada)

- **Modo escuro:** o mapa é um retângulo claro de 200px dentro da ficha escura — os tiles do OSM são sempre claros. Pode incomodar.
- **Tela estreita (320px):** "A que distância estou?" quebra em 2–3 linhas ao lado da pílula "Abrir no mapa" (`white-space: nowrap`). Sem overflow horizontal, só apertado.
- **Costura entre tiles:** offsets fracionários reduzidos por `scale(0.5)` podem gerar linha fina. Conserto: 1px de sobreposição ou arredondar no nível escalado.
- **Peso:** 15 tiles por abertura (grade 5×3 no z=12). `MAPA_ESCALA = 1` é a alavanca se pesar no 3G — cai pra 6 tiles, custa nitidez em retina.
- **Enquadramento:** `MAPA_ZOOM = 11` (~26 km num celular de 350px). Mudar quebra o teste de enquadramento **de propósito** — a faixa do teste tem que ser ajustada junto, pra a decisão ser consciente.

## Deferidos técnicos

- `ensureSchema` (`src/lib/db.ts`) ainda declara `confirmacoes.tipo ... DEFAULT 'foi'` — inerte (insert sempre passa tipo), inconsistente com `{seco,barro}`. Limpar em passada futura.
- Turso/cron/freshness da Rodada 1 seguem **de lado** (não usados no MVP live-compute; a rota cron existe mas não roda).

## Fronteira do João (o que só ele faz)

Login nas contas (Vercel, Turso via Marketplace) + consentir/aceitar termos + o celular. Código, deploy e verificação eu toco.

## Registro histórico (não refazer)

- Rodada 1 (esqueleto: ficha Zod, motor, weather, Turso data-access, cron, confirmar): mergeada em `a179e46`.
- Rampa ao vivo (Versão D + deploy): merge `7d4bd59`.
- "Fui" de verdade: merge `4b6d9a7` + chore `80178f9`.
- Mapa de verdade: merge `a671146` (branch `mapa-de-verdade` preservada). Revisão final no opus pegou um **laço infinito** em `tilesParaCaixa` para latitude ±90 (projeção devolvia ±Infinity) — corrigido com clamp no limite de Mercator.
