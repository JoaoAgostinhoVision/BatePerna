---
titulo: "BatePerna — Forma do plano da Fase 1 (build-shaping)"
data: 2026-07-29
status: WIP — enquadramento tomado + AGENDA DE DESIGN RODADA (via brainstorming). Item 6 (fatia do MVP) resolvido → SPEC do walking-skeleton escrito em ./specs/2026-07-30-fase1-walking-skeleton-design.md. Aguardando revisão do João + 2 perguntas abertas, depois writing-plans. Ver "PARADA 2026-07-30" no fim.
relacionado:
  - ./bateperna-modelo-e-requisitos.md   (modelo v2.5 — contrato de comportamento; a FONTE dos requisitos)
  - ./briefs/brief-BatePerna2.0-2026-07-11/brief.md
  - ./escopo-fase-1-WIP.md               (escopo da Fase 1 — quais REQs entram; CONCLUÍDO, virou Parte IV do modelo)
  - ./bateperna-decisoes.html            (Artifact — espelho visual das decisões; URL na memória artifact-decisoes-bateperna)
---

# BatePerna — Forma do plano da Fase 1

> **COMO RETOMAR (leia primeiro):** o modelo v2.5 está estável e a Parte III fechada. As duas decisões
> de enquadramento do build estão tomadas (ver tabela abaixo): **veículo = PWA**, **constrói = João +
> Claude Code**, **plano = executável por agente**. **O que falta:** rodar a **agenda de design da
> Fase 1** (6 itens abaixo, todos ABERTOS), item a item, por brainstorming. **Sugestão de ordem:**
> começar pelo item 6 (**fatia do MVP / walking-skeleton**), porque decidir "1 ficha ponta-a-ponta
> primeiro" enxuga radicalmente os outros 5. Depois da agenda: escrever o spec → `superpowers:writing-plans`
> → execução. Há um Artifact-espelho publicado (reancorar quando algo mudar — ver memória).
>
> **Onde isto se encaixa:** este doc segura as decisões de forma do build — que o modelo de ideia, por
> charter, não carrega — antes de escrever o plano executável. Mantém a regra: maturar a forma antes
> de codar.

## Decisões de enquadramento (tomadas 2026-07-29)

| Decisão | Escolha | Por quê |
|---|---|---|
| **Veículo** | **PWA** (web app instalável, mobile-first) + CMS simples pra autoria + backend fino pro motor + cache offline das fichas | Serve os DOIS momentos de uso (planejar no desktop/celular **e** consultar na estrada, inclusive sem sinal); conteúdo minúsculo (5–10 fichas) cacheia fácil; navegação é **delegada** ao Waze (REQ-4), então nativo = overkill; motor roda no servidor; sem app store, base única |
| **Quem constrói** | **João dirigindo o Claude Code** (AI-assisted) | Cabe no tamanho da Fase 1; João já opera nesse fluxo; casa com plano executável por agente |
| **Tipo de plano** | **Plano executável por agente** (cadeia superpowers: brainstorming → design/spec → writing-plans → executing-plans / subagent-driven-dev) | Consequência de "João + Claude Code" — NÃO é PRD pesado pra time externo |

## Momento de uso (input que fechou o veículo)

Os **dois** momentos são críticos igualmente: **planejar antes** (browse-first, montar o dia) **e
consultar na estrada** (a parte acionável do trust-data — cadeia de waypoints, discriminador in-situ,
regra de ramificação tipo "se choveu, vai por Queimadas", checklist que equipa — precisa estar no
celular, inclusive offline). Navegação em si é delegada ao Waze.

## Agenda de design da Fase 1 (ABERTA — o que falta decidir antes do plano)

O modelo diz O QUE o produto faz; falta desenhar COMO isso vira um PWA concreto:

1. **Stack** — o que o PWA/backend/CMS realmente são (framework, banco, hospedagem, API de previsão do tempo pro motor de invalidação).
2. **Modelo de dados** — como os 7 campos da ficha + as 2 camadas do roteiro-método + a cadeia condicional (`caminho = f(condição)`) + o substrato multi-confirmador + o estado de frescor viram tabelas/entidades.
3. **Superfície do produto (telas)** — lista/browse (estilo Booking) · ficha aberta (L2–L7 já desenhados) · mapa · ação Confirmar · área de autoria (você). Montar o shell do app a partir das decisões de UX já fechadas.
4. **Como o motor roda** — job agendado que lê a previsão e esfria/invalida rotas; a ação Confirmar; o decaimento no tempo; os 2 sinais separados.
5. **Estratégia offline** — o que é cacheado (service worker) e como a parte acionável fica disponível sem sinal.
6. **Fatia do MVP** — construir tudo de uma vez, ou um walking-skeleton primeiro (1 ficha ponta-a-ponta com o motor) e crescer?

## Próximo passo

Rodar a agenda de design (brainstorming, item a item), fechar o design da Fase 1, escrever o spec, e
só então `writing-plans` pra virar plano executável. Decisão do João de quando mergulhar.

---

## PARADA 2026-07-30 — RETOMAR AQUI

**O que rolou nesta sessão (brainstorming da agenda de design):** entramos pelo **item 6 (fatia do
MVP)** e ele colapsou os outros 5, como previsto. Fechamos, seção a seção (todas aprovadas pelo João),
o design de um **walking-skeleton, thread 1**. Decisões travadas:

- **Abordagem:** walking-skeleton (1 ficha ponta-a-ponta antes de crescer).
- **Thread 1 = Rampa do Pepe** — hazard binário (chuva→não vá) encaixa no motor de um-estado; roteiro-
  **lugar** + modo **#4** ⇒ nem toca hub L6 nem armadilha L2. É a ficha mais barata que ainda é real.
- **Motor fino-mas-real:** Vercel Cron lê Open-Meteo → regra binária → grava 1 estado (fresco/frio) no
  Turso → ficha lê (L5). Motor **empurra**, ficha **puxa** (desacoplamento que deixa engrossar depois).
- **Stack:** Next.js + Vercel · Vercel Cron · Open-Meteo (grátis) · **Turso/libSQL** · fichas
  conteúdo-no-repo (CMS pobre) · next-pwa/Serwist (offline).
- **Dados:** ficha = JSON no repo (imutável); Turso = 2 tabelas mutáveis (`freshness`, `confirmacoes`);
  slots abertos p/ decaimento, 2 sinais, hub, ramificação.
- **Telas:** browse (1 card + bandeira de frescor) · ficha (anatomia L2–L7) · Confirmar sem login ·
  offline degradado · mapa = embed estático + link Waze.
- **DoD** e **rastreabilidade aos REQ** no spec.

**→ SPEC completo:** `./specs/2026-07-30-fase1-walking-skeleton-design.md` — **ler primeiro amanhã.**

**PENDENTE (o que começa fazendo):**
1. ~~João revisa o spec e decide 2 perguntas abertas~~ **RESOLVIDO 2026-08-02:**
   - **(a)** Janela do motor → **incluir chuva passada** já no fio 1 (o barro segura água). Spec §3.A e
     §5 ajustados: `regra` ganha `janela_passado_horas`; motor usa `past_days` do Open-Meteo.
   - **(b)** **Confirmar sem login** → **mantido** (fricção mínima; anti-abuso engrossa depois). Sem mudança.
2. ~~Ajustar o spec~~ **FEITO** (edições acima).
3. **`git init`** neste diretório (não é repo; a cadeia superpowers/executing-plans assume git p/ os
   checkpoints de review). ← **PRÓXIMO PASSO CONCRETO**
4. Preencher o **conteúdo REAL da Rampa** no JSON (coords, waypoints, prêmio, textos) — só o João tem.
5. Então **`superpowers:writing-plans`** → plano executável por agente → execução com Claude Code.

**Itens 1–5 da agenda de design** (stack, dados, telas, motor, offline): foram resolvidos **dentro do
escopo do fio 1** pelo spec. Só voltam a abrir no "crescer" (as outras fichas / engrossar o motor).
