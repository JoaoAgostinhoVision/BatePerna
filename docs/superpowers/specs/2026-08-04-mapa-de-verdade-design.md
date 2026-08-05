# Design — Mapa de verdade (onde fica, e é longe daqui?)

**Data:** 2026-08-04
**Contexto:** A Rampa do Pepê está no ar (https://bateperna.vercel.app) com o carimbo ao vivo e o "Fui" de verdade funcionando. Este é o **segundo** dos três pedaços que o João levantou ao usar no celular. O terceiro — menu / forma de app — fica pra depois e merece brainstorm próprio.

Hoje o "mapa" da ficha é decorativo: uma faixa de 88px com degradê + hachura CSS (`.wp-map`) e um emoji 📍 no meio (`.wp-pin`). As coordenadas exibidas e o botão "Abrir no mapa" já são reais.

## Objetivo

O mapa passa a responder uma pergunta específica: **onde isso fica, e é longe de onde eu estou?** — a outra metade da decisão. O carimbo já diz *dá pra subir hoje*; isto diz *dá pra ir hoje*.

## Escopo (cravado)

**Faz:**
- Troca a hachura decorativa por um mapa real montado com tiles do OpenStreetMap, enquadrando a Rampa na região dela.
- Desenha o pin **na cor do carimbo** — verde no *pode subir*, cor do *não suba* no frio.
- Acrescenta uma linha de distância **sob demanda**: a pessoa toca, o navegador pede a localização, e aparece `~38 km em linha reta daqui`.
- Toda a matemática em módulos puros e testados, separados da UI.

**NÃO faz (de propósito):**
- **Não** pede a localização sozinho ao abrir a página. Prompt de GPS não solicitado é o jeito mais rápido de ser negado pra sempre — negado uma vez, o navegador não pergunta de novo.
- **Não** calcula tempo/distância de estrada real. Isso exige serviço de rotas (chave, chamada de rede, cache, mais um modo de falha) e entra como passo separado depois.
- **Não** mostra a posição da pessoa no mapa, nem enquadra os dois pontos juntos. Enquadrar origem+destino em escala de estado torna o mapa do destino inútil.
- **Não** desenha traçado de rota entre waypoints.
- **Não** arrasta nem dá zoom dentro do cartão. Explorar é trabalho do "Abrir no mapa", que já existe.
- **Não** traz biblioteca de mapa (Leaflet/MapLibre) nem provedor de tiles com chave.
- **Não** mexe no carimbo, no motor, no "Fui" nem no banco.

## Decisões de produto

- **O trabalho do mapa é orientação, não navegação.** Quem quer navegar toca em "Abrir no mapa" e sai pro app de mapas do celular — isso já funciona e continua sendo o caminho pesado.
- **Mosaico de tiles, não iframe.** Considerado e descartado o embed oficial do OSM (`export/embed.html`): funciona e é uma linha, mas traz moldura e barra de terceiro, pesa ~5× mais na rede, não deixa colorir o pin e não tem nada testável. Ver "Riscos aceitos" pro preço dessa escolha.
- **O pin repete a decisão.** Sendo desenhado por nós, ele herda a cor do carimbo. O mapa deixa de ser ilustração e passa a dizer a mesma coisa que o resto da ficha.
- **A distância é medida do celular da pessoa**, não de uma cidade âncora fixa. Âncora fixa só seria verdade pra quem sai de lá.
- **"Em linha reta" fica escrito, sempre.** No agreste, 40 km em linha reta pode ser 1h30 de serra. O rótulo é o que impede o número de mentir pra baixo. Não é detalhe de UI: é a mesma honestidade do `ressalva_proxy` ("chuva medida ≠ barro na entrada").
- **Permissão negada não é erro.** É um estado normal, dito uma vez, sem insistir e sem repetir o pedido.

## Arquitetura

Princípio load-bearing (o mesmo do "Fui"): **a ficha tem que ficar de pé inteira sem o mapa e sem a localização.** Nome, nota, coordenadas e "Abrir no mapa" são server-rendered e não dependem de nada disto. Os tiles são imagens externas; a distância é opcional e cliente.

```
Página / (server component, force-dynamic)
  └─ carimbo: getFicha → fetchPrecip → avaliar        [SÓ CLIMA, inalterado]
  └─ seção Trajeto
        ├─ <MapaEstatico wp estado />                 [server, sem JS]
        │     └─ tilesParaCaixa() → <img> posicionados + pin na cor do estado
        ├─ nome / nota / coordenadas / "Abrir no mapa" [server, inalterado]
        └─ <DistanciaDaqui lat lng />                  [client]
              └─ toque → navigator.geolocation → distanciaKm() → formatarDistancia()
```

Dois módulos puros, com uma preocupação cada — "onde fica" e "é longe":

### Peça 1 — `src/lib/mapa.ts` (novo, puro, testado)

Web Mercator, sem I/O, sem React.

- `pontoNoMundo(coord, z): {x, y}` — projeção pra pixels do mundo naquele zoom:
  `x = (lng + 180)/360 · 256 · 2^z`
  `y = (1 − ln(tan φ + sec φ)/π)/2 · 256 · 2^z`
- `metrosPorPixel(lat, z): number` — `156543.03392 · cos(lat) / 2^z`. Existe pra que o enquadramento seja **verificável em teste**, não afirmado de boca.
- `tilesParaCaixa(centro, z, larguraPx, alturaPx)` — devolve a lista de tiles que cobrem a caixa centrada no ponto, cada um com `{z, x, y, left, top}` já em pixels de CSS. Envolve `x` no antimeridiano (`mod 2^z`) e descarta `y` fora do intervalo válido.
- `urlTile({z, x, y}): string` — `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.

Constantes exportadas, que são os botões de afinação:

- `MAPA_ZOOM = 11` — nesta latitude dá 75,7 m/px, ou seja **~26 km** de largura num cartão de 350px. É o enquadramento que responde "onde fica". Único número a mexer depois de ver no celular.
- `MAPA_ALTURA_PX = 200` — a faixa atual de 88px é curta demais pra ler nome de cidade.
- `MAPA_LARGURA_PX = 480` — **largura de geração**, não de exibição. O cartão é fluido e o mosaico precisa de um número; geramos tiles pra 480px (~36 km) e o cartão corta o excesso. Assim nenhum celular largo fica com faixa vazia na borda, e um estreito só vê menos mapa — nunca menos pin.
- `MAPA_ESCALA = 2` — puxa tiles de `MAPA_ZOOM + 1` e desenha em metade do tamanho, pra não ficar mole em tela retina. Vira `1` se algum dia o peso incomodar mais que a nitidez.

### Peça 2 — `src/lib/geo.ts` (novo, puro, testado)

É a costura que faz o "estrada depois" sair barato: troca-se a fonte do número, a UI fica.

- `distanciaKm(a, b): number` — haversine, raio 6371 km.
- `formatarDistancia(km): string` — o texto que aparece:
  - `< 1` → `"menos de 1 km em linha reta daqui"`
  - `< 10` → uma casa decimal, vírgula decimal (`"~4,2 km em linha reta daqui"`)
  - `>= 10` → inteiro (`"~38 km em linha reta daqui"`)

### Peça 3 — `src/app/MapaEstatico.tsx` (novo, server component)

Sem `"use client"` — é só cálculo e markup.

- Recebe `wp` e o `estado` do carimbo (`fresco` | `frio`), que a página já tem em mãos.
- Camada externa: largura 100% (fluida), `MAPA_ALTURA_PX` de altura, `overflow: hidden`, cantos arredondados pra continuar parecendo parte do cartão.
- Camada interna: `MAPA_LARGURA_PX` × `MAPA_ALTURA_PX`, **centrada horizontalmente** na externa — é o que garante que o pin caia no meio do cartão em qualquer largura de tela. Os `<img>` de tile entram posicionados em absoluto dentro dela.
- Nitidez em retina: os tiles vêm de `MAPA_ZOOM + 1` e a camada de tiles é desenhada em `1/MAPA_ESCALA` do tamanho (`transform-origin` no topo-centro, pra o centro não escorregar).
- Tiles: `<img>` puro (não `next/image` — são externos, já otimizados, e passar pelo otimizador só adicionaria configuração e custo), `alt=""`, `loading="eager"` (o mapa não é conteúdo de rodapé), `referrerPolicy="no-referrer-when-downgrade"`.
- Acessibilidade: a camada externa leva `role="img"` + `aria-label` com o nome do lugar. Os tiles individuais não têm significado sozinhos.
- Pin desenhado por cima (CSS, no centro exato), na cor do estado.
- **Atribuição** `© OpenStreetMap` com link, canto inferior. É licença (ODbL), não enfeite — não pode sumir numa refatoração de estilo.
- `.wp-map` e `.wp-pin` (degradê + hachura + emoji) **saem** do CSS. Não deixar código morto.

### Peça 4 — `src/app/DistanciaDaqui.tsx` (novo, client component)

Mesmo padrão do `ConfirmarFui.tsx`. Máquina de estados:

| estado | o que aparece |
|---|---|
| `idle` | botão `A que distância estou?` |
| `medindo` | `vendo…` (botão desabilitado) |
| `ok` | `~38 km em linha reta daqui` |
| `negado` | `sem localização — use o Abrir no mapa` |

- `navigator.geolocation.getCurrentPosition` com `timeout` 10s e `maximumAge` 5 min (a pessoa não anda muito entre dois toques).
- Todo caminho de falha (permissão negada, timeout, indisponível, `navigator.geolocation` ausente) cai no **mesmo** estado `negado`. Distinguir motivos não muda nada pro cliente.
- Estado terminal: uma vez em `ok` ou `negado`, para. Não re-pergunta, não repete o prompt.
- Não precisa de guarda de hidratação: `idle` é o estado inicial no servidor e no cliente, e um botão sem JS é inerte, não quebrado.

## Testes

Vitest, como o resto (26 verdes hoje, todos devem continuar).

**`mapa.ts`:**
- `pontoNoMundo`: âncoras conhecidas — (0,0) em z=0 → (128,128); lng −180 → x=0; lng +180 → x=256·2^z; simetria do equador.
- `metrosPorPixel`: na latitude da Rampa, z=11 → ~75,7 m/px (tolerância 1%); dobra a cada zoom a menos.
- **Enquadramento:** um teste que multiplica `metrosPorPixel` por uma largura de celular típica (350px) e afirma que a vista fica na casa dos ~26 km. É o teste que impede o enquadramento de mudar sem alguém perceber.
- `tilesParaCaixa`: os tiles cobrem a caixa inteira (o primeiro começa em offset ≤ 0, o último termina em ≥ largura) — inclusive na largura de geração de 480px; contagem plausível; envolvimento do `x` no antimeridiano.
- `urlTile`: formato e host.

**`geo.ts`:**
- `distanciaKm`: pares de coordenadas conhecidas (tolerância ~1%), distância zero, simetria a→b == b→a.
- `formatarDistancia`: os três ramos e as bordas exatas (0.9, 1, 9.9, 10); todos contêm `"em linha reta"`.

`MapaEstatico` e `DistanciaDaqui` não ganham teste automatizado nesta rodada — um é markup derivado de funções já testadas, o outro é interação de navegador com permissão real. A verificação é o João no celular.

## Verificação (o que conta como pronto)

1. `npm test` verde (26 antigos + novos).
2. `npm run build` limpo.
3. Deploy prod e, **no celular do João**: o mapa mostra a Rampa com estrada/cidade em volta e o pin na cor do carimbo do dia; tocar em "A que distância estou?" pede permissão e mostra um número plausível; negar a permissão deixa a ficha inteira e legível.
4. O afinamento do `MAPA_ZOOM` sai desse olhar, não de adivinhação aqui.

## Riscos aceitos

- **Servidor de tiles doado.** `tile.openstreetmap.org` tem política de uso: puxar um punhado de tiles pra um app de pouco tráfego é prática comum e tolerada, mas é *tolerada*, não abençoada. Se o BatePerna crescer, isto vira uma conta a pagar (provedor de tiles com chave). **Dívida datada, conhecida, não vencida.**
- **Atribuição é obrigação nossa.** O embed trazia sozinho; aqui é código que escrevemos e que não pode ser removido por engano.
- **Sem arrastar nem dar zoom no cartão.** O "Abrir no mapa" passa a carregar sozinho o trabalho de explorar.
- **Tiles que não carregam** deixam a área em branco. A ficha continua inteira e decidível. Aceito.
- **Geolocalização do navegador é grossa** (pode vir de Wi-Fi/IP, com centenas de metros — ou quilômetros — de erro). Como o número nunca é apresentado como exato (`~` nos dois ramos numéricos, "menos de" no ramo curto), o erro não distorce a decisão "é longe?".
