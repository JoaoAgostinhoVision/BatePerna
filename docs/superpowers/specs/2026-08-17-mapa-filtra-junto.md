# Spec — o mapa filtra junto (emenda ao §6 da rodada "de onde eu estou")

**Decisão do João, 2026-08-16**, em resposta à pergunta que a revisão da branch levantou:
*"com filtro ligado, o mapa mostra só o que sobrou, ou continua mostrando o acervo inteiro?"*

> **O mapa esconde os pins junto.**

E, na pergunta de seguimento (mapa vazio):

> **Filtrou e não sobrou nada → o mapa mostra só você, na sua vizinhança.**

## 1. O que isso emenda

O **§6 da spec `2026-08-13-daqui-e-filtros-design.md`** dizia que o mapa enquadra "você e **todas**
as trilhas". **Passa a ser "você e as trilhas VISÍVEIS."** O resto do §6 (o piso de zoom 8, a
derivação dos ~212 km, o `MapaHome` como client component, a hidratação casando no primeiro
paint) continua valendo sem alteração.

## 2. Por que — o defeito que motivou

A revisão da branch mediu, com 3 trilhas e "até 30 km" ligado:

```
conta da linha: "1 trilha · 1 filtro ligado"
aviso do mapa:  "2 trilhas fora do mapa"
pins: 3   cartões: 1   âncoras mortas: 2
```

Três problemas, uma raiz (`page.tsx` entregava `fichas` — o acervo inteiro — ao `MapaHome`,
enquanto a folha desenhava `visiveis`):

1. **Pin morto.** `PinTrilha` é `<a href="#slug">` apontando pro `id` do cartão. Escondido o
   cartão, o toque no pin não faz nada.
2. **`.mapa-fora` MENTE.** "2 trilhas fora do mapa" a ~40px de "1 trilha" na linha de baixo. O pin
   morto era silencioso; **este afirma um número falso.**
3. **O enquadramento sai do acervo inteiro.** Com "até 30 km" ligado, o mapa continua se abrindo
   pra caber um morro a 700 km, cai no piso de zoom 8 (~212 km de largura) e a vizinhança da
   única trilha que sobrou vira um ponto.

## 3. A regra, e ela é uma só

**Os três respondem da MESMA lista de visíveis:** os pins desenhados, o enquadramento, e o texto
"N trilhas fora do mapa". Qualquer um deles saindo de outra conta é a família de defeito que esta
rodada inteira perseguiu.

## 4. O caso vazio (a pergunta de seguimento)

Filtro zera a lista:

| tem localização? | o mapa mostra |
|---|---|
| **sim** | **só você, na sua vizinhança** — `enquadrarComVoce([], voce, …)`, que já devolve zoom 11 (~26 km). Era um deferido "inalcançável"; passa a ser **decisão**. |
| **não** | **mantém o último enquadramento** em vez de saltar. Sem trilhas e sem você não há o que enquadrar, e um salto pra lugar nenhum é pior que ficar parado. |

A folha continua com "Nenhuma trilha com esses filtros" e o botão de limpar (§7.4 da spec
original) — isso não muda.

## 5. O que isso obriga na estrutura, e é o ponto de risco

Hoje `visiveis` e `confia` nascem **dentro da `FolhaTrilhas`**, e o `MapaHome` é irmão dela no
`page.tsx`. Pra o mapa ler a mesma lista, a conta tem que **subir** pra um lugar só que alimente
os dois.

🔴 **Não pode virar duas contas.** O Critical da rodada passada nasceu exatamente assim (agrupar
num lugar, repintar em outro), e a Task 11 desta rodada existiu pra impedir isso dentro da folha.
Subir a conta não pode desfazer o que ela garantiu: **um array só, num escopo léxico só**,
consumido pelo mapa, pela linha de resumo e pela folha.

`confia` continua saindo de **`pares`** (todas as trilhas), pelas três razões já registradas —
circularidade (`passaNoFiltro` recebe `confia`), `useAlgumVenceu` recebendo array de tamanho
estável, e a invariante "tudo ou nada no clima".

## 6. A consequência que o João precisa saber (e já sabe)

**O mapa vai reenquadrar quando o filtro carregar e a cada toque no filtro.** É o mesmo "piscar"
que ele viu desenhado e aprovou pra localização, agora também pros filtros: o HTML do servidor
chega **sem filtro** (invariante "primeiro render sem filtro, SEMPRE"), e o ajuste acontece no
cliente. Não há como filtrar o mapa sem isso.

## 7. O que NÃO muda

- **Primeiro render sem filtro e sem localização, SEMPRE.** O mapa do servidor mostra o acervo.
- **O carimbo chega no primeiro paint, sem JS.**
- **O pin continua plantado em `condicao.coords`** (o ponto do clima); o km continua saindo de
  `coordDaDistancia` (o waypoint). São duas coordenadas de propósito, documentadas no
  questionário.
- **`© OpenStreetMap` em todo mapa.**
- O acervo (`/trilhas`) não tem filtro e não muda.
