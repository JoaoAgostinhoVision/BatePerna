# Design — Mapa de verdade (onde fica, e é longe daqui?)

**Data:** 2026-08-04
**Contexto:** A Rampa do Pepê está no ar (https://bateperna.vercel.app) com o carimbo ao vivo e o "Fui" de verdade funcionando. Este é o **segundo** dos três pedaços que o João levantou ao usar no celular. O terceiro — menu / forma de app — fica pra depois e merece brainstorm próprio.

Hoje o "mapa" da ficha é decorativo: uma faixa de 88px com degradê + hachura CSS (`.wp-map`) e um emoji 📍 no meio (`.wp-pin`). As coordenadas exibidas e o botão "Abrir no mapa" já são reais.

## Objetivo

O mapa passa a responder uma pergunta específica: **onde isso fica, e é longe de onde eu estou?** — a outra metade da decisão. O carimbo já diz *dá pra subir hoje*; isto diz *dá pra ir hoje*.

## Escopo (cravado)

**Faz:**
- Troca a hachura decorativa por um mapa real embutido (iframe OpenStreetMap), enquadrando a Rampa na região dela.
- Acrescenta uma linha de distância **sob demanda**: a pessoa toca, o navegador pede a localização, e aparece `~38 km em linha reta daqui`.
- Cálculo em módulo puro e testado, separado da UI.

**NÃO faz (de propósito):**
- **Não** pede a localização sozinho ao abrir a página. Prompt de GPS não solicitado é o jeito mais rápido de ser negado pra sempre — negado uma vez, o navegador não pergunta de novo.
- **Não** calcula tempo/distância de estrada real. Isso exige serviço de rotas (chave, chamada de rede, cache, mais um modo de falha) e entra como passo separado depois.
- **Não** mostra a posição da pessoa no mapa, nem enquadra os dois pontos juntos. Enquadrar origem+destino em escala de estado torna o mapa do destino inútil.
- **Não** desenha traçado de rota entre waypoints.
- **Não** mexe no carimbo, no motor, no "Fui" nem no banco.

## Decisões de produto

- **O trabalho do mapa é orientação, não navegação.** Quem quer navegar toca em "Abrir no mapa" e sai pro app de mapas do celular — isso já funciona e continua sendo o caminho pesado.
- **A distância é medida do celular da pessoa**, não de uma cidade âncora fixa. Âncora fixa só seria verdade pra quem sai de lá.
- **"Em linha reta" fica escrito, sempre.** No agreste, 40 km em linha reta pode ser 1h30 de serra. O rótulo é o que impede o número de mentir pra baixo. Não é detalhe de UI: é a mesma honestidade do `ressalva_proxy` ("chuva medida ≠ barro na entrada").
- **Permissão negada não é erro.** É um estado normal, dito uma vez, sem insistir e sem repetir o pedido.

## Arquitetura

Princípio load-bearing (o mesmo do "Fui"): **a ficha tem que ficar de pé inteira sem o mapa e sem a localização.** Nome, nota, coordenadas e "Abrir no mapa" são server-rendered e não dependem de nada disto. O iframe é moldura de terceiro; a distância é opcional e cliente.

```
Página / (server component, force-dynamic)
  └─ carimbo: getFicha → fetchPrecip → avaliar        [SÓ CLIMA, inalterado]
  └─ seção Trajeto
        ├─ <iframe> OSM embed, src derivado de bboxDoWaypoint(wp)   [server, sem JS]
        ├─ nome / nota / coordenadas / "Abrir no mapa"              [server, inalterado]
        └─ <DistanciaDaqui lat lng /> (client component)
              └─ toque → navigator.geolocation → distanciaKm() → formatarDistancia()
```

### Peça 1 — `src/lib/geo.ts` (novo, puro, testado)

Sem I/O, sem React. É a costura que faz o "estrada depois" sair barato: troca-se a fonte do número, a UI fica.

- `distanciaKm(a: Coord, b: Coord): number` — haversine, raio da Terra 6371 km.
- `formatarDistancia(km: number): string` — o texto que aparece:
  - `< 1` → `"menos de 1 km em linha reta daqui"`
  - `< 10` → uma casa decimal, vírgula decimal (`"~4,2 km em linha reta daqui"`)
  - `>= 10` → inteiro (`"~38 km em linha reta daqui"`)
- `bboxDoWaypoint(wp: {lat, lng}, spanGraus = MAPA_SPAN_GRAUS): string` — devolve `"minLon,minLat,maxLon,maxLat"` pronto pro parâmetro `bbox`, meio-span em cada direção.
- `urlMapaEmbed(wp): string` — monta a URL completa do embed.

`MAPA_SPAN_GRAUS = 0.25` (≈ 27 km de largura nesta latitude). Constante nomeada e exportada **de propósito**: o enquadramento certo só se descobre olhando no celular, e afinar tem que ser trocar um número.

### Peça 2 — o iframe (em `page.tsx` + `ficha.css`)

```
https://www.openstreetmap.org/export/embed.html?bbox=<bbox>&layer=mapnik&marker=<lat>,<lng>
```

- Altura ~200px (a faixa atual de 88px é curta demais pra ler nome de cidade).
- `loading="lazy"`, `title` descritivo pra leitor de tela, sem `sandbox` (quebraria o JS do próprio OSM).
- Wrapper com `overflow: hidden` + `border-radius` pra continuar parecendo parte do cartão.
- Atribuição: o embed do OSM já traz a sua própria barra. Nada a fazer.
- `.wp-map` e `.wp-pin` (degradê + hachura + emoji) **saem** do CSS. Não deixar código morto.

### Peça 3 — `src/app/DistanciaDaqui.tsx` (novo, client component)

Mesmo padrão do `ConfirmarFui.tsx`. Máquina de estados:

| estado | o que aparece |
|---|---|
| `idle` | botão/link `A que distância estou?` |
| `medindo` | `vendo…` (botão desabilitado) |
| `ok` | `~38 km em linha reta daqui` |
| `negado` | `sem localização — use o Abrir no mapa` |

- `navigator.geolocation.getCurrentPosition` com `timeout` (10s) e `maximumAge` generoso (5 min — a pessoa não anda muito entre dois toques).
- Todo caminho de falha (permissão negada, timeout, indisponível, `navigator.geolocation` ausente) cai no **mesmo** estado `negado`. Distinguir motivos não muda nada pro cliente.
- Estado terminal: uma vez em `ok` ou `negado`, para. Não re-pergunta, não repete o prompt.
- Não precisa de guarda de hidratação: `idle` é o estado inicial tanto no servidor quanto no cliente, e um botão sem JS é inerte, não quebrado.

## Testes

Vitest, como o resto (26 verdes hoje, todos devem continuar).

- `distanciaKm`: pares de coordenadas conhecidas, tolerância de ~1%; distância zero; simetria (a→b == b→a).
- `formatarDistancia`: os três ramos e as bordas exatas (0.9, 1, 9.9, 10); confere que a string contém `"em linha reta"` em todos.
- `bboxDoWaypoint`: ordem dos componentes (lon,lat,lon,lat), meio-span pra cada lado, span customizado.
- `urlMapaEmbed`: contém `bbox`, `marker` com as coordenadas certas, e aponta pro host do OSM.

`DistanciaDaqui` não ganha teste automatizado nesta rodada — é interação de navegador com permissão real. Verificação é o João no celular.

## Verificação (o que conta como pronto)

1. `npm test` verde (26 antigos + novos).
2. `npm run build` limpo.
3. Deploy prod e, **no celular do João**: o mapa mostra a Rampa com estrada/cidade em volta; tocar em "A que distância estou?" pede permissão e mostra um número plausível; negar a permissão deixa a ficha inteira e legível.
4. O afinamento de `MAPA_SPAN_GRAUS` sai desse olhar, não de adivinhação aqui.

## Riscos aceitos

- **Moldura de terceiro:** não dá pra estilizar por dentro, vem com a cara e a barra do OSM. Escolha consciente do João, sabendo das alternativas (imagem estática de tiles; Leaflet).
- **OSM fora do ar / rede ruim:** a área do mapa fica em branco. A ficha continua inteira e decidível. Aceito.
- **Geolocalização do navegador é grossa** (pode vir de Wi-Fi/IP, com centenas de metros — ou quilômetros — de erro). Como o número nunca é apresentado como exato (`~` nos dois ramos numéricos, "menos de" no ramo curto), o erro não distorce a decisão "é longe?".
