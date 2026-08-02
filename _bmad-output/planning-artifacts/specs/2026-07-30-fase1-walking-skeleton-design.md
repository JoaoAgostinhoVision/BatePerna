---
titulo: "BatePerna Fase 1 — Walking-skeleton (thread 1: Rampa do Pepe) — DESIGN/SPEC"
data: 2026-07-30
status: SPEC — design aprovado seção a seção (brainstorming). 2 perguntas abertas RESOLVIDAS (2026-08-02): motor inclui chuva passada; Confirmar sem login. Próximo passo: git init → conteúdo real da Rampa → writing-plans.
metodo: superpowers:brainstorming
relacionado:
  - ../bateperna-modelo-e-requisitos.md          # modelo v2.5 — contrato de comportamento (FONTE dos REQ)
  - ../fase-1-forma-do-plano-WIP.md              # build-shaping — decisões de veículo/quem/plano
  - ../deep-dives/ficha-anatomia-decisoes-ux-L2-L7-2026-07-28.md  # anatomia L2–L7 da ficha
  - ../deep-dives/rampa-do-pepe-teste-logistica-pesada-2026-07-29.md  # a ficha do fio 1
---

# BatePerna Fase 1 — Walking-skeleton (thread 1)

> **O que este doc é:** o design da PRIMEIRA fatia executável do BatePerna — um walking-skeleton que
> atravessa TODA a arquitetura com o coração (motor→frescor→offline) já real, só que raso. Não é o
> sistema completo da Fase 1; é o fio 1, desenhado pra que os passos seguintes **engrossem** cada
> camada sem re-arquitetar. Feeds `superpowers:writing-plans`.

## 1. Escopo do thread 1 (a keystone)

O fio mais fino que ainda atravessa toda camada: **1 ficha (Rampa do Pepe) ponta-a-ponta, publicada,
com motor→frescor→offline reais mas rasos.**

### Dentro

| Camada | O que entra |
|---|---|
| Autoria | Rampa do Pepe como **conteúdo-no-repositório** (JSON) |
| Browse | Lista estilo Booking com **1 card** (+ bandeira de frescor) |
| Ficha | Ficha aberta renderizando a **anatomia L2–L7** já desenhada |
| Motor | Vercel Cron lê Open-Meteo (previsão **+ chuva passada**) → regra **binária** (chuva no passado recente OU na janela à frente → `frio`) → grava **1 estado de frescor** no Turso |
| Frescor na tela | L5 semáforo (fresco/frio) + ressalva de "proxy falível" |
| Confirmar | Botão grava **1 sinal** em `confirmacoes`; UI mostra contagem |
| Offline | Service worker cacheia a **parte acionável** + último frescor com carimbo "visto há Xh" |
| Deploy | Publicado na Vercel, instalável como PWA |

### Fora — adiado pros passos de "engrossar" (slots ficam prontos)

- Motor completo REQ-10/11/12: **decaimento no tempo · 2 sinais separados · invalidação por evento**
  (não só previsão). Fio 1 = só *previsão→binário*.
- Multi-confirmador com 2 sinais e pontuação. Fio 1 grava e mostra contagem simples.
- **Ramificar** (Marinho, `caminho = f(condição)`, motor que rerota). Fio 1 liga/desliga.
- Roteiro-método como entidade-mãe/hub (L6 formal). Fio 1 nem precisa — Rampa é roteiro-**lugar**.
- Discriminador generalizado. Fio 1 usa o editorial sob medida da Rampa (formato "entrada").
- Rota-armadilha (L2). Não se aplica — Rampa é modo **#4 condicional**, não #1.
- CMS de verdade. Fio 1 = conteúdo-no-repo (Git-as-CMS).
- Demais fichas da cesta (5–10). Entram no *crescer*, depois do esqueleto publicado.
- **Condição de PRÊMIO (não de segurança)** — na Rampa, céu aberto vs. nuvem/nevoeiro modula a
  *qualidade da vista* (dado real do João, 2026-08-02). Distinta do hazard de acesso (chuva→atola).
  Fio 1: registrada só como **fricção honesta** (texto em `avisos`); NÃO lida pelo motor. Slot p/
  engrossar: 2º sinal (Open-Meteo tem cobertura de nuvem) que modula o payoff, não o go/no-go.

**Por que a Rampa é o fio 1:** hazard **binário** (qualquer chuva → não vá) mapeia perfeito no motor
de um-estado; é experiência real do João (já tem deep-dive); roteiro-lugar + modo #4 ⇒ **não** toca as
duas camadas mais pesadas da ficha (hub L6, armadilha L2).

## 2. Arquitetura

Tudo dentro de um projeto **Next.js (App Router) na Vercel**.

```
content/fichas/rampa-do-pepe.json   →  lido no build/server (estático)
        │
   Next.js App Router (Vercel)
     • /                 browse (lista)
     • /ficha/[slug]     ficha aberta
     • /api/confirmar    POST  → grava sinal
     • /api/cron/motor   GET   → chamado pela Vercel Cron
        │                        │
   Turso (libSQL)          Open-Meteo (previsão, grátis, sem chave)
   (estado mutável)
        ▲
   Service Worker (next-pwa)  → cacheia parte acionável + último frescor
```

**Imutável vs mutável:**
- **Conteúdo da ficha = imutável no runtime, mora no repo.** Edita → commit → Vercel rebuilda. É o
  "CMS pobre". Zero DB pra ler a ficha.
- **Estado = mutável, mora no Turso.** Só duas coisas: **frescor** (cron escreve) e **confirmações**
  (botão escreve).

**Motor empurra / ficha puxa:** o cron **empurra** estado pro DB; a ficha **puxa** ao ser aberta. Esse
desacoplamento é o que deixa o motor engrossar (decaimento, 2 sinais, evento) **sem tocar na tela** —
a tela só passa a ler um estado mais rico.

**Stack travada:** Next.js + Vercel · Vercel Cron (motor) · Open-Meteo (previsão) · **Turso/libSQL**
(estado) · conteúdo-no-repo (fichas) · next-pwa/Serwist (offline).

## 3. Modelo de dados

### A) Conteúdo-no-repo — `content/fichas/rampa-do-pepe.json`

```jsonc
{
  "slug": "rampa-do-pepe",
  "modos": ["condicional"],           // → deriva tom "avisar" + checagem de consistência (L4 interno)
  "rotulo_escaneio": "Só sem chuva",  // L4 camada-escaneio (card)
  "promessa": "Uma descida de tirar o fôlego — quando o tempo deixa.",
  "voz": "O pepê é emoção pura. Mas é barro: molhou, não desce.",       // L4 leitura (define tom)
  "premio": "…",                      // campo 1 / alma — o não-fungível
  "trajeto": {
    "waypoints": [ { "nome":"…", "lat":0, "lng":0, "nota":"…" } ]        // cadeia REQ-4 (rota certa)
  },
  "acesso": "…",                      // o COMO que equipa (Nível B → brilha, L3)
  "avisos": "…",                      // encaixe honesto / fricção declarada (REQ-6)
  "condicao": {                       // L5 — o que o MOTOR lê
    "coords": { "lat":0, "lng":0 },
    "regra": {
      "tipo": "chuva_binaria",
      "janela_previsao_horas": 48,    // olha à frente (chuva prevista)
      "janela_passado_horas": 48,     // olha atrás (barro segura água — decisão 2026-08-02)
      "limiar_mm": 0.2
    },
    "regra_texto": "Choveu nas últimas horas OU há chuva na janela → não desça de carro.",  // Nível B (brilha)
    "ressalva_proxy": "Chuva medida ≠ barro na entrada — a grade do modelo não vê a rampa. Confirme na entrada."
  },
  "discriminador": {                  // L7 formato "rota-que-degrada na entrada"
    "formato": "entrada",
    "como_ler": "Na entrada da rampa: barro brilhando/pegajoso = não desce.",
    "permissao_abortar": "Dar meia-volta aqui é sabedoria, não fracasso."  // default cauteloso, REQ-8
  },
  "custo": { "tag": "gratis" }        // REQ-7
}
```

> Os campos com `"…"`/`0` são placeholders de conteúdo a serem preenchidos pelo João com os dados
> REAIS da Rampa (ver [[nao-inventar-fatos-de-roteiros]]). A ESTRUTURA está fechada; o CONTEÚDO não.

### B) Turso — estado mutável (2 tabelas)

```sql
CREATE TABLE freshness (
  ficha_slug     TEXT PRIMARY KEY,
  estado         TEXT NOT NULL,        -- 'fresco' | 'frio'
  calculado_em   INTEGER NOT NULL,     -- epoch
  fonte          TEXT NOT NULL,        -- 'open-meteo'
  previsao_bruta TEXT                  -- JSON cru (transparência/debug)
);

CREATE TABLE confirmacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_slug  TEXT NOT NULL,
  criado_em   INTEGER NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'foi'  -- placeholder p/ os 2 sinais (engrossa depois)
);
```

### Slots deixados abertos (crescer sem re-arquitetar)
- **hub de método** (L6) — entra com a 1ª ficha-método
- **campos de decaimento** (idade→meia-vida, REQ-10/11) — frescor hoje binário → depois estado mais rico que a *mesma* tela lê
- **2 sinais separados** — coluna `tipo` já antecipa
- **ramificação** (`caminho = f(condição)`) — hoje `regra` produz 1 estado; depois um galho

## 4. Telas

Duas telas + uma ação. Autoria = editar arquivo + commit (sem tela).

**Browse (`/`)** — lista Booking com 1 card: rótulo de escaneio + **bandeira de frescor lida do Turso**
+ promessa (1 linha). O motor aparece já na lista.

**Ficha (`/ficha/[slug]`)** — renderiza a anatomia na ordem da síntese: voz (tom) · prêmio/alma ·
trajeto (mapa da rota certa + waypoints; **sem armadilha**) · acesso (Nível B, destacado) · avisos
(encaixe honesto) · **🚦 semáforo L5** (regra × previsão → bandeira hedge-ada + ressalva de proxy) ·
**🧭 discriminador de entrada L7** (como ler o barro + permissão de abortar) · custo · **frescor +
botão Confirmar**.

**Confirmar** — `POST /api/confirmar` → insere em `confirmacoes` → UI atualiza contagem. **Sem login**
no fio 1 (fricção mínima; anti-abuso + 2 sinais engrossam depois).

**Offline** — mesmo render degradado: parte acionável cacheada + último frescor com carimbo
*"visto há Xh — pode ter mudado"*. Confirmar **desabilitado** offline (sem fila).

**Mapa** — embed **estático** (marcadores dos waypoints) + link **"abrir no Waze"**. Navegação é
delegada ao Waze (REQ-4); nada de mapa interativo pesado agora.

## 5. O loop do motor

**Disparo:** `vercel.json` agenda `GET /api/cron/motor` de 6/6h (4×/dia).

```
1. Lê todas as fichas do repo com `condicao` (fio 1: só a Rampa).
2. Pra cada uma:
   a. Open-Meteo GET com condicao.coords, janela à frente (regra.janela_previsao_horas)
      E janela passada (regra.janela_passado_horas → parâmetro past_days/past_hours):
      https://api.open-meteo.com/v1/forecast?lat=..&lng=..&hourly=precipitation&past_days=2
   b. Aplica regra.tipo:
        chuva_binaria → precipitação acumulada na janela passada OU na janela à frente
                        ≥ regra.limiar_mm ?  sim→'frio'  não→'fresco'
   c. UPSERT em freshness { estado, calculado_em=agora, fonte, previsao_bruta }.
3. Responde 200 { atualizadas: N }.
```

**Propriedades:**
- **Idempotente** — mesma previsão ⇒ mesmo resultado (UPSERT). Seguro pra retry da Vercel.
- **Regra mora no dado** (`condicao.regra`); motor genérico pro tipo `chuva_binaria`. Novo tipo
  (ex.: `ramificar`) = novo branch **sem** tocar as fichas.
- **Falha graciosa** — Open-Meteo fora do ar ⇒ **não** sobrescreve o estado bom; loga e mantém
  `calculado_em`. O carimbo "calculado há Xh" denuncia se ficar velho.
- **Transparência** — guarda `previsao_bruta` (auditar por que ficou frio).

**Gancho de engrossar:** hoje o passo 2b emite `'fresco'|'frio'`. O motor completo (REQ-10/11/12) troca
por estado mais rico (idade/meia-vida, 2 sinais, evento) e **a tela nem muda** — só lê mais campos.

## 6. Offline

**Ferramenta:** next-pwa (ou Serwist) → service worker + manifest → instalável.

| Balde | Estratégia | Conteúdo |
|---|---|---|
| Casca do app | precache no build | HTML/JS/CSS de `/` e `/ficha/[slug]` |
| Parte acionável | precache no build | Ficha é conteúdo-no-repo ⇒ **já estática** (trajeto, acesso, discriminador, avisos, regra_texto) |
| Frescor | stale-while-revalidate | último estado do Turso; offline mostra cacheado + carimbo "visto há Xh" |

**Sacada:** como as fichas são conteúdo-no-repo, a parte acionável (Nível B, durável) fica offline "de
graça". A **única** coisa que precisa de rede é o frescor (Nível A, volátil) — exatamente o que degrada
com honestidade. Espelha o modelo: Nível B durável fica; Nível A se anuncia como perecível.

**Confirmar offline:** desabilitado no fio 1 (sem fila).

## 7. Régua de pronto (definition of done)

1. **Deploy** — app no ar na Vercel, instalável como PWA no celular
2. **Browse** — `/` mostra o card da Rampa com rótulo + bandeira de frescor do Turso
3. **Ficha** — `/ficha/rampa-do-pepe` renderiza a anatomia inteira
4. **Motor** — Vercel Cron chama `/api/cron/motor`, lê Open-Meteo, aplica regra, UPSERT; dá pra **ver
   o estado virar** (forçar limiar → 🔴)
5. **Confirmar** — botão insere em `confirmacoes`; UI reflete contagem
6. **Offline** — modo avião → ficha abre com parte acionável + carimbo; Confirmar desabilitado
7. **Transparência** — `previsao_bruta` guardada

**Verificação ponta-a-ponta:** publicado → forçar regra pra frio → 🔴 no card e na ficha → voltar pra
fresco → confirmar → testar offline no avião.

## 8. Rastreabilidade aos requisitos (modelo v2.5)

| REQ | Como o fio 1 toca | Profundidade |
|---|---|---|
| REQ-1 (ficha) | anatomia renderizada | fina (Rampa só) |
| REQ-2 (destaca o que pesa) | Nível B brilha (L3) | fina |
| REQ-3 (declarar modo/tom) | `modos` no conteúdo → tom | fina |
| REQ-4 (cadeia de waypoints) | `trajeto.waypoints` + link Waze | fina |
| REQ-6 (encaixe honesto/fricção) | campo `avisos` | fina |
| REQ-7 (grátis/pago) | `custo.tag` | fina |
| REQ-8 (permissão bidirecional) | `discriminador.permissao_abortar` | fina |
| REQ-9 (discriminador) | discriminador formato "entrada" | fina (editorial sob medida) |
| REQ-10/11/12 (frescor/motor) | motor binário previsão→estado + Confirmar | **rasa de propósito** — engrossa depois |

## 9. Notas de execução

- **Git não inicializado** neste diretório. A cadeia superpowers (executing-plans, checkpoints)
  assume git. **Ação sugerida:** `git init` antes do plano, pra os checkpoints de review funcionarem.
- **Conteúdo real da Rampa** (coords, waypoints, prêmio, textos) precisa vir do João — os placeholders
  do §3.A são estrutura, não fato (ver [[nao-inventar-fatos-de-roteiros]]).
- **Segredos:** token do Turso; Open-Meteo não precisa de chave. Config via env vars da Vercel.

## 10. Próximo passo

`superpowers:writing-plans` — transformar este spec em plano executável por agente (tarefas + checkpoints
de review), que o João roda com o Claude Code.
