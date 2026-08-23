# Segundo review do celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o teto inventado do recorte de distância, fazer a cidade escolhida à mão vencer por sessão (com caminho de volta pro GPS), apagar `extensaoKm` do app inteiro e gravar `piso: "barro"` na Rampa.

**Architecture:** Três frentes independentes numa branch só. A da localização é aditiva (uma função pura nova em `src/lib/local.ts`, consumida por `local.tsx` e `BuscaLugar.tsx`). A da distância troca uma constante por uma função pura calculada no `MioloHome` e passada como prop. A da extensão é **contração**, e por isso a ordem das tasks é **expandir → migrar → contrair**: a UI para de usar o campo antes de o campo sair do modelo, senão o `tsc` fica vermelho no meio da rodada.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Zod, Vitest + Testing Library + jsdom, CSS puro.

**Spec:** `docs/superpowers/specs/2026-08-23-segundo-review-do-celular.md` — leia junto. O plano argumenta a partir dela.

## Global Constraints

- **Branch:** `review-2-celular` (já criada, com a spec commitada em `d0672f8`).
- **Chão de partida:** `npm test` **662/662 em 49 arquivos**, `npx tsc --noEmit` limpo, `npm run build` passa.
- **Permissões:** editar, criar arquivo, rodar teste, build e commit estão liberados sem perguntar. `git push`, deploy do Vercel e `gh` **perguntam de propósito**. `git clean -fdx` está **negado**.
- **Deploy:** `npx --yes vercel@latest --prod --yes --scope bate-perna`. **Sem `--scope` dá `Not authorized`.**
- **Uma pessoa, uma fonte:** nenhum componente novo pode chamar `navigator.geolocation` fora do `<LocalVivo>`.
- **Primeiro render sem localização e sem filtro, SEMPRE:** tudo que lê o aparelho acontece em efeito, nunca durante o render. A home chega do cache do service worker com HTML velho.
- **Um array só, num escopo léxico só** no `MioloHome`: mapa, linha de resumo e folha desenham de `visiveis`, e nada refaz o `.filter`.
- **O filtro segue a tela:** o número comparado sai de `kmNaTelaDistancia`. Nunca reimplemente o arredondamento.
- **Regra de Honestidade 2:** ficha sem o campo nunca é escondida por ele.
- **O `piso` não alimenta o motor.** `avaliar()` em `src/lib/motor.ts` continua o único que decide se dá pra ir.
- **Teto inclusivo:** "até 30 km" inclui a trilha de 30 km.
- **Comentário não crava total absoluto de suíte** ("585/585" envelhece em duas horas) e o que foi medido antes de uma mudança se escreve **no passado**.
- **Encoding:** o código-fonte está em **CRLF** e os testes em **LF**. Toda âncora de mutação com quebra de linha tem que **abortar alto** se não casar — mutação não aplicada vira falso sobrevivente.

---

## Antes de despachar CADA task — o pré-voo

Já pagou oito vezes na rodada passada e todos os achados foram do **plano** e da **prova**, nunca da lógica dos implementadores. Antes de despachar:

1. Releia a lista de testes da task perguntando **"que linha do código eu posso apagar sem isto falhar?"**.
2. Para cada frase de comportamento escrita em **prosa** no brief, confira se ela tem **linha na tabela de mutação**. Se não tem dono, não existe.
3. Escolha o caso de teste que **SEPARA** as duas versões, não um que ambas rejeitam.
4. Antes de escrever *"X continua sendo a saída"* ou *"Y joga isso fora"*, **abra o arquivo e confira o RAMO em que a linha vive**.

---

## Task 1: `escolhaAindaVale` — a pergunta pura da sessão

**Files:**
- Modify: `src/lib/local.ts` (acrescenta ao fim, antes do `rotuloPilula` não importa — o arquivo é plano)
- Test: `tests/lib/local.test.ts`

**Interfaces:**
- Consumes: `type Local` (já existe neste arquivo)
- Produces:
  - `export const VALIDADE_ESCOLHA_S = 21600`
  - `export const CHAVE_SESSAO = "bp.sessao"`
  - `export const MARCA_SESSAO = "1"`
  - `export function escolhaAindaVale(local: Local, agoraSeg: number, marcadorDaSessao: string | null): boolean`

- [ ] **Step 1: Escreva os testes que falham**

Em `tests/lib/local.test.ts`, no fim do arquivo. Os imports do topo ganham `VALIDADE_ESCOLHA_S`, `MARCA_SESSAO` e `escolhaAindaVale`.

```ts
// ——————— a validade da escolha à mão ———————
//
// 🔴 AS TRÊS CLÁUSULAS SÃO MEDIDAS SEPARADAS. Num E, a primeira que falha
// esconde as outras: um teste só, com as três erradas ao mesmo tempo, passaria
// verde com duas das três cláusulas apagadas do código.
//
// A decisão do João (2026-08-23) foi cinto E suspensório: "aba viva E no
// máximo 6h". A de tempo sozinha não fecharia a leitura literal de sessão no
// navegador; a de aba sozinha não fecha o PWA do iPhone, que fica SUSPENSO e
// não fechado — reabrir amanhã continuaria mostrando a cidade de ontem.
describe("escolhaAindaVale", () => {
  const escolhida = (em: number): Local => ({
    tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 }, em,
    nome: "Gravatá", regiao: "Pernambuco",
  });
  const AGORA = 1_800_000_000;

  it("escolha fresca, na mesma aba, ainda vale", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, MARCA_SESSAO)).toBe(true);
  });

  // Mata a cláusula do marcador sozinha: idade idêntica à do teste acima, e a
  // ÚNICA diferença é a aba. Sem essa cláusula no código, este teste passa a
  // devolver `true` e cai.
  it("escolha fresca em ABA NOVA não vale — o marcador morre com a aba", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, null)).toBe(false);
  });

  // Mata a cláusula do tempo sozinha: marcador presente, e a única diferença é
  // a idade. É o caso do PWA suspenso.
  it("escolha de 7h, mesma aba, não vale mais", () => {
    const seteHoras = 7 * 60 * 60;
    expect(escolhaAindaVale(escolhida(AGORA - seteHoras), AGORA, MARCA_SESSAO)).toBe(false);
  });

  // A FRONTEIRA, nos dois lados, e ela é escrita contra o SÍMBOLO: prova a
  // relação (`<`, não `<=`) e é cega ao número.
  it("um segundo antes das 6h vale; exatamente 6h não vale mais", () => {
    expect(escolhaAindaVale(escolhida(AGORA - VALIDADE_ESCOLHA_S + 1), AGORA, MARCA_SESSAO)).toBe(true);
    expect(escolhaAindaVale(escolhida(AGORA - VALIDADE_ESCOLHA_S), AGORA, MARCA_SESSAO)).toBe(false);
  });

  // 🔴 A OUTRA METADE, e ela é ORTOGONAL à de cima: o teste da fronteira é
  // auto-referente quanto ao VALOR — trocar a constante pra 30 minutos o
  // deixaria verde, porque ele vira "29min59 vale, 30min não", correto com 30
  // minutos. Só uma asserção sobre o NÚMERO pega isso.
  it("a validade é de 6 horas em SEGUNDOS — o valor, não só a relação", () => {
    expect(VALIDADE_ESCOLHA_S).toBe(21600);
  });

  // A primeira cláusula. Sem ela, uma leitura de GPS herdaria a validade da
  // escolha à mão e o app pararia de se atualizar sozinho por 6h.
  it("gps e 'não sei' NUNCA valem como escolha — nem com marcador, nem frescos", () => {
    const gps: Local = { tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: AGORA };
    expect(escolhaAindaVale(gps, AGORA, MARCA_SESSAO)).toBe(false);
    expect(escolhaAindaVale({ tipo: "nao-sei" }, AGORA, MARCA_SESSAO)).toBe(false);
  });

  // Marcador com valor DESCONHECIDO não vale. Sem esta asserção, um
  // `marcadorDaSessao !== null` passaria — e a chave é do domínio inteiro:
  // qualquer coisa pode ter escrito nela.
  it("marcador com outro valor não conta", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, "sim")).toBe(false);
  });
});

// A chave é do domínio inteiro, como CHAVE_LOCAL e CHAVE_GPS.
describe("a chave da sessão", () => {
  it("tem prefixo do app", () => {
    expect(CHAVE_SESSAO.startsWith("bp.")).toBe(true);
  });
  it("CHAVE_SESSAO tem valor exato — contrato com o local.tsx", () => {
    expect(CHAVE_SESSAO).toBe("bp.sessao");
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/lib/local.test.ts`
Expected: FAIL — `escolhaAindaVale is not a function` / imports não existem.

- [ ] **Step 3: Implemente**

Em `src/lib/local.ts`, depois do `coordDe`:

```ts
/** Quanto tempo uma cidade escolhida à mão continua valendo.
 *
 *  Decisão do João em 2026-08-23, depois de ver no celular que a cidade não
 *  mudava nunca: a escolha vale por SESSÃO, e ele pediu cinto E suspensório —
 *  aba viva **e** no máximo 6h. A de aba sozinha não fecha o PWA do iPhone (o
 *  app fica SUSPENSO, não fechado, e reabrir amanhã continuaria mostrando a
 *  cidade de ontem); a de tempo sozinha não fecha "fechei o Safari e abri de
 *  novo em meia hora". */
export const VALIDADE_ESCOLHA_S = 6 * 60 * 60;

/** `sessionStorage` é do domínio inteiro, como o `localStorage`. */
export const CHAVE_SESSAO = "bp.sessao";

/** O valor gravado, escrito UMA vez: quem marca e quem confere leem daqui.
 *  Duas cópias literais poderiam divergir e a escolha nunca mais valeria. */
export const MARCA_SESSAO = "1";

/** A cidade escolhida à mão ainda manda? Puro de propósito: quem lê o relógio
 *  e o `sessionStorage` é o `src/app/local.tsx`.
 *
 *  ⚠️ Buraco conhecido, e é do relógio, não do desenho: com o relógio do
 *  aparelho atrasado, `agoraSeg - em` fica negativo e a escolha continua
 *  valendo. Não vale código — a saída é a pessoa tocar em "trocar", que é a
 *  mesma de sempre. */
export function escolhaAindaVale(
  local: Local,
  agoraSeg: number,
  marcadorDaSessao: string | null,
): boolean {
  if (local.tipo !== "escolhido") return false;
  if (marcadorDaSessao !== MARCA_SESSAO) return false;
  return agoraSeg - local.em < VALIDADE_ESCOLHA_S;
}
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npx vitest run tests/lib/local.test.ts`
Expected: PASS

- [ ] **Step 5: Prova de mutação — aplique uma de cada vez e RESTAURE**

| # | Mutação em `src/lib/local.ts` | Tem que derrubar |
|---|---|---|
| 1 | apagar `if (marcadorDaSessao !== MARCA_SESSAO) return false;` | "escolha fresca em ABA NOVA não vale" |
| 2 | `agoraSeg - local.em < VALIDADE_ESCOLHA_S` → `true` | "escolha de 7h" e "um segundo antes das 6h…" (a 2ª metade) |
| 3 | `<` → `<=` | "…exatamente 6h não vale mais" |
| 4 | `VALIDADE_ESCOLHA_S` → `30 * 60` | **só** "a validade é de 6 horas em SEGUNDOS" |
| 5 | apagar `if (local.tipo !== "escolhido") return false;` | "gps e 'não sei' NUNCA valem" |
| 6 | `!== MARCA_SESSAO` → `=== null` (negado) | "marcador com outro valor não conta" |

🔴 A #4 é a prova de que as duas asserções são **ortogonais**: ela derruba **só** a do valor literal, e a #3 derruba **só** a da relação. Se alguma das duas derrubar as duas, uma é redundante e vale dizer isso em vez de manter as duas.

- [ ] **Step 6: Commit**

```bash
git add src/lib/local.ts tests/lib/local.test.ts
git commit -m "feat(local): escolhaAindaVale -- a cidade a mao vale por aba viva E 6h"
```

---

## Task 2: `local.tsx` obedece — e marca a sessão

**Files:**
- Modify: `src/app/local.tsx` (o `escolher`, e o efeito de montagem)
- Test: `tests/app/local.test.tsx`

**Interfaces:**
- Consumes: `escolhaAindaVale`, `CHAVE_SESSAO`, `MARCA_SESSAO` (Task 1)
- Produces: nada de novo na API pública. `pedirGps` e `escolher` continuam com a mesma assinatura.

🔴 **O TESTE EXISTENTE `"com cidade escolhida na mão, a montagem não sobrescreve"` (linha ~139) PASSA A PRECISAR DO MARCADOR.** Sem ele, a escolha guardada deixa de valer e o teste cai — corretamente. Ele não é regressão: é o mesmo comportamento com a condição nova. Atualize-o, não o apague.

- [ ] **Step 1: Escreva os testes que falham**

Em `tests/app/local.test.tsx`. O `afterEach` do topo ganha `sessionStorage.clear();`. Os imports ganham `CHAVE_SESSAO`, `MARCA_SESSAO`, `VALIDADE_ESCOLHA_S`.

Primeiro, **conserte o teste existente** (dentro de `describe("o GPS")`), acrescentando o marcador e o `em` fresco:

```ts
  it("com cidade escolhida na mão E na mesma aba, a montagem não sobrescreve", async () => {
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: agora }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    const pediu = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => {});
    // Nem chega a PEDIR — e isso é asserção própria: disparado, o navegador
    // exibe o balão de permissão do sistema pra quem já respondeu na mão.
    expect(pediu).not.toHaveBeenCalled();
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    const noAparelho = JSON.parse(localStorage.getItem(CHAVE_LOCAL)!);
    expect(noAparelho.tipo).toBe("escolhido");
    expect(noAparelho.nome).toBe("Gravatá");
  });
```

Depois, acrescente no mesmo `describe`:

```ts
  // ——— a escolha VENCIDA, nos dois eixos, e cada um sozinho ———

  // Aba nova: o `localStorage` sobreviveu, o `sessionStorage` não. É o caso de
  // fechar o app e abrir de novo.
  it("cidade escolhida em OUTRA aba: pede o GPS e ele vence", async () => {
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: agora }));
    // sem sessionStorage de propósito
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!)).toMatchObject({
      tipo: "gps", coord: { lat: -7, lng: -34.8 },
    });
  });

  // Mesma aba, escolha velha: é o PWA do iPhone suspenso desde ontem.
  it("cidade escolhida há 7h, mesma aba: pede o GPS e ele vence", async () => {
    const velha = Math.floor(Date.now() / 1000) - (VALIDADE_ESCOLHA_S + 60);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: velha }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
  });

  // 🔴 A METADE QUE IMPEDE O PISCA — e ela é a decisão de produto, não
  // detalhe: vencida a escolha, o que está na tela CONTINUA na tela até o GPS
  // responder, e se ele não responder, fica. Apagar uma localização boa pra
  // mostrar "não sei" tiraria da tela um km que estava certo. Precedente já em
  // produção, escrito em local.tsx no ramo de erro do GPS.
  it("escolha vencida e GPS que ERRA: a cidade fica, não vira 'não sei'", async () => {
    const velha = Math.floor(Date.now() / 1000) - (VALIDADE_ESCOLHA_S + 60);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ ...GRAVATA, em: velha }));
    aparelhoComGps((_ok, erro) =>
      erro({ code: 2, message: "" } as GeolocationPositionError),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("escolhido|nunca")).toBeTruthy();
    await act(async () => {});
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
    expect(JSON.parse(localStorage.getItem(CHAVE_LOCAL)!).nome).toBe("Gravatá");
  });

  // ——— quem escreve o marcador, e quem NÃO escreve ———

  it("escolher uma cidade marca a sessão", async () => {
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Botao /><Espia /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBe(MARCA_SESSAO);
  });

  // 🔴 A OUTRA DIREÇÃO, e sem ela o guarda `l.tipo === "escolhido"` não tem
  // dono: o `escolher` é TAMBÉM o caminho de sucesso do GPS. Marcando ali, uma
  // leitura automática se disfarçaria de escolha manual e sobreviveria 6h como
  // se a pessoa tivesse digitado a cidade.
  it("o GPS entrando sozinho NÃO marca a sessão", async () => {
    aparelhoComGps((ok) =>
      ok({ coords: { latitude: -7, longitude: -34.8 } } as GeolocationPosition),
    );
    render(<LocalVivo><Espia /></LocalVivo>);
    expect(await screen.findByText("gps|nunca")).toBeTruthy();
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  // O ramo que já está no ar e não pode ter mudado: `tipo: "gps"` guardado
  // continua pedindo sozinho. Um guarda largo demais mataria em silêncio o
  // automático que a Task 1 da rodada passada entregou.
  it("com gps guardado, continua buscando sozinho ao montar — mesmo com marcador de sessão", async () => {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: Math.floor(Date.now() / 1000),
    }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    const pediu = vi.fn();
    aparelhoComGps(pediu);
    render(<LocalVivo><Espia /></LocalVivo>);
    await act(async () => {});
    expect(pediu).toHaveBeenCalled();
  });

  // sessionStorage também estoura em aba anônima do Safari. Mesma disciplina
  // dos outros dois try/catch deste arquivo: a escolha vale em memória e
  // pronto, sem tela de erro.
  it("sessionStorage que estoura não derruba a montagem", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });
    function Botao() {
      const { escolher } = useMexerLocal();
      return <button onClick={() => escolher(GRAVATA)}>escolher</button>;
    }
    render(<LocalVivo><Botao /><Espia /></LocalVivo>);
    await act(async () => { screen.getByText("escolher").click(); });
    expect(screen.getByTestId("espia").textContent).toBe("escolhido|nunca");
  });
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/app/local.test.tsx`
Expected: FAIL nos testes novos (o GPS não é pedido / o marcador não é escrito).

- [ ] **Step 3: Implemente**

Em `src/app/local.tsx`. No import de `@/lib/local`, acrescente `CHAVE_SESSAO`, `MARCA_SESSAO`, `escolhaAindaVale`.

No `escolher`:

```ts
  const escolher = useCallback((l: Local) => {
    setLocal(l);
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(l));
      // 🔴 O marcador é SÓ da escolha à mão. Este callback é TAMBÉM o caminho
      // de sucesso do GPS: marcar aqui sem o guarda faria uma leitura
      // automática se disfarçar de escolha manual e mandar por 6h.
      if (l.tipo === "escolhido") sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    } catch {
      // Aba anônima ou armazenamento cheio: a escolha vale nesta sessão e
      // pronto. Não é motivo pra tela de erro. Se o localStorage estourou, o
      // marcador nem é tentado — e isso é o certo: sem a escolha guardada, não
      // há o que a sessão prolongue.
    }
  }, []);
```

No efeito de montagem, troque a última linha do bloco e leia o marcador junto:

```ts
  useEffect(() => {
    let guardado: Local = NAO_SEI;
    let marcador: string | null = null;
    try {
      guardado = lerLocal(localStorage.getItem(CHAVE_LOCAL));
      setGps(lerEstadoGps(localStorage.getItem(CHAVE_GPS)));
      marcador = sessionStorage.getItem(CHAVE_SESSAO);
    } catch { /* sem armazenamento: segue como "não sei" */ }
    if (guardado.tipo !== "nao-sei") setLocal(guardado);
    // A escolha à mão vence — mas só pela sessão. Decisão do João em
    // 2026-08-23, depois de ver no celular que a cidade não mudava nunca: vale
    // enquanto a aba viver E por no máximo 6h (`escolhaAindaVale`).
    //
    // 🔴 A troca PRESERVA os dois ramos que já estão no ar, e não por sorte:
    // pra `tipo: "gps"` e pra `nao-sei` a função é falsa pela PRIMEIRA
    // cláusula, então o GPS continua sendo pedido sozinho na abertura, como a
    // Task 1 da rodada passada entregou.
    //
    // E o que está na tela não pisca: o `setLocal(guardado)` acima já
    // aconteceu. Só o SUCESSO do GPS sobrescreve; erro e recusa deixam a
    // cidade onde está.
    if (!escolhaAindaVale(guardado, Math.floor(Date.now() / 1000), marcador)) buscarGps();
  }, [buscarGps]);
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npx vitest run tests/app/local.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

| # | Mutação em `src/app/local.tsx` | Tem que derrubar |
|---|---|---|
| 1 | `if (!escolhaAindaVale(...))` → `if (guardado.tipo !== "escolhido")` (a versão velha) | "cidade escolhida em OUTRA aba" e "há 7h, mesma aba" |
| 2 | `if (!escolhaAindaVale(...))` → `buscarGps()` sempre | "com cidade escolhida na mão E na mesma aba" |
| 3 | apagar `if (l.tipo === "escolhido")` do `escolher` | "o GPS entrando sozinho NÃO marca a sessão" |
| 4 | apagar a linha do `sessionStorage.setItem` | "escolher uma cidade marca a sessão" |
| 5 | apagar `if (guardado.tipo !== "nao-sei") setLocal(guardado);` | "escolha vencida e GPS que ERRA: a cidade fica" |

- [ ] **Step 6: Rode a suíte inteira e o `tsc`**

Run: `npm test && npx tsc --noEmit`
Expected: tudo verde. **Se algum teste de OUTRO arquivo cair, é porque ele guardava uma cidade sem marcador** — conserte-o acrescentando o marcador, não relaxando o código.

- [ ] **Step 7: Commit**

```bash
git add src/app/local.tsx tests/app/local.test.tsx
git commit -m "feat(local): a cidade a mao vence por sessao -- aba viva E 6h"
```

---

## Task 3: o "de onde eu estou" no painel de busca

**Files:**
- Modify: `src/app/BuscaLugar.tsx`
- Test: `tests/app/BuscaLugar.test.tsx`

**Interfaces:**
- Consumes: `pedirGps` de `useMexerLocal()` e `gps` de `useGps()` — os dois já estão desestruturados no componente.
- Produces: nada. É só um elemento novo na árvore.

🔴 **Conserta um beco que JÁ ESTÁ EM PRODUÇÃO.** `pedirGps` não tem nenhum chamador depois que a pessoa escolhe uma cidade (`BuscaLugar.tsx:32` faz `soGps` virar `false`, e o toque na pílula abre a busca). Quem escolhe uma cidade no app instalado no celular do João hoje fica sem caminho de volta.

🔴 **NADA DE CSS NOVO, e a razão é medida, não preguiça:** `.bp .busca-item` (home.css:330) **não** é escopado sob `.busca-rolo`, então o botão mantém o estilo fora dela; e o `min-height: 44px` dele já impede o encolhimento como item de flex, então não precisa de `flex: none`. Se você **acrescentar** uma classe, ela precisa de regra no `home.css` **e** de teste de existência — o plano escolhe não acrescentar.

- [ ] **Step 1: Escreva os testes que falham**

Em `tests/app/BuscaLugar.test.tsx`, dentro do `describe("a busca")`:

```ts
  // ——— o caminho de volta pro GPS (pedido do João, 2026-08-23) ———
  //
  // 🔴 Isto conserta um beco PRÉ-EXISTENTE, não desta rodada: com uma cidade
  // escolhida, `soGps` é falso, o toque na pílula abre a busca, e a busca só
  // oferecia outras cidades. `pedirGps` ficava sem nenhum chamador.
  it("o painel oferece 'de onde eu estou' e o toque PEDE o GPS", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    render(<LocalVivo><BuscaLugar /></LocalVivo>);
    const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
    await act(async () => { pilula.click(); });
    const volta = screen.getByRole("button", { name: /de onde eu estou/i });
    const antes = pediu.mock.calls.length;
    await act(async () => { volta.click(); });
    expect(pediu.mock.calls.length).toBeGreaterThan(antes);
    // Fecha o painel, igual a escolher uma cidade já faz. Sem esta metade, um
    // botão que pede o GPS e deixa a busca aberta por cima do mapa passaria.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  // Regra da casa (é o mesmo argumento do `rotuloPilula`): negado uma vez, o
  // navegador não pergunta de novo — o item viraria um botão que não faz nada.
  it("com gps negado, o item 'de onde eu estou' NÃO aparece", async () => {
    await abrir();  // o helper já grava bp.gps = "negado"
    expect(screen.queryByRole("button", { name: /de onde eu estou/i })).toBeNull();
    // Não-vacuidade: o painel ESTÁ aberto. Sem esta linha, o teste passa com o
    // componente inteiro apagado — é a família "teste de ausência sem o irmão
    // de presença é meia prova".
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  // 🔴 POSICIONAL, e é a mesma prova do crédito do GeoNames logo acima, pela
  // mesma razão medida: o que mora dentro do `.busca-rolo` sai de vista assim
  // que a lista de cidades cresce (medido em 375×667 com cinco resultados: 168
  // de 344px visíveis). Este é justamente o item que precisa estar sempre
  // alcançável.
  it("o 'de onde eu estou' fica FORA da caixa que rola", async () => {
    const pediu = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: pediu } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json([GRAVATA, RECIFE, GRAVATA, RECIFE, GRAVATA]),
    );
    // 🔴 Uma cidade escolhida É A PRÉ-CONDIÇÃO de o toque ABRIR o painel: com
    // `local` = "não sei" e `gps` = "nunca", `soGps` é true e a pílula PEDE o
    // GPS em vez de abrir. O marcador de sessão vai junto porque, sem ele, a
    // Task 2 faz a escolha vencer e o app volta pro estado "não sei".
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 },
      em: Math.floor(Date.now() / 1000), nome: "Gravatá", regiao: "Pernambuco",
    }));
    sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    render(<LocalVivo><BuscaLugar /></LocalVivo>);
    const pilula = await screen.findByRole("button", { name: /de Gravatá/ });
    await act(async () => { pilula.click(); });
    // A lista cheia é o cenário que torna a posição observável: é com ela que
    // o que mora dentro do rolo sai de vista.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Gravatá" } });
    await screen.findAllByText(/Pernambuco/);

    const volta = screen.getByRole("button", { name: /de onde eu estou/i });
    expect(volta.closest(".busca-rolo"), "o item voltou pra dentro da caixa que rola").toBeNull();
    expect(volta.closest(".busca"), "o item saiu do painel de busca").not.toBeNull();
  });
```

⚠️ **Os imports do arquivo de teste ganham `CHAVE_SESSAO` e `MARCA_SESSAO` de `@/lib/local`**, e o `afterEach` do topo ganha `sessionStorage.clear();`.

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/app/BuscaLugar.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name /de onde eu estou/i`.

- [ ] **Step 3: Implemente**

Em `src/app/BuscaLugar.tsx`, entre o `<input className="busca-campo">` e o `<div className="busca-rolo">`:

```tsx
          {/* 🔴 O caminho de VOLTA pro GPS, e ele conserta um beco que já está
              em produção: com uma cidade escolhida, `soGps` é falso, o toque na
              pílula abre esta busca, e ela só oferecia outras cidades —
              `pedirGps` ficava sem chamador nenhum no app.

              FORA do `.busca-rolo` de propósito, pelo mesmo motivo medido do
              crédito do GeoNames logo abaixo: o que mora dentro da caixa que
              rola sai de vista quando a lista de cidades cresce, e este é o
              item que precisa continuar alcançável.

              Some com o GPS negado — o navegador não pergunta duas vezes, e o
              botão viraria um que não faz nada. Mesmo argumento do
              `rotuloPilula`. */}
          {gps !== "negado" && (
            <button
              className="busca-item"
              onClick={() => {
                pedirGps();
                setFase("fechado");
              }}
            >
              de onde eu estou
            </button>
          )}
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npx vitest run tests/app/BuscaLugar.test.tsx`
Expected: PASS

- [ ] **Step 5: Prova de mutação**

| # | Mutação em `src/app/BuscaLugar.tsx` | Tem que derrubar |
|---|---|---|
| 1 | apagar o bloco inteiro | os três testes novos |
| 2 | `gps !== "negado"` → `true` | "com gps negado, o item NÃO aparece" |
| 3 | apagar `setFase("fechado")` | a segunda metade do primeiro teste |
| 4 | apagar `pedirGps()` | a primeira metade do primeiro teste |
| 5 | mover o bloco pra DENTRO do `<div className="busca-rolo">` | "fica FORA da caixa que rola" |

🔴 A #5 é a que a suíte não pegaria sozinha — é a forma "o DOM escorregando de baixo do próprio seletor", medida na Task 7 da rodada passada.

- [ ] **Step 6: Commit**

```bash
git add src/app/BuscaLugar.tsx tests/app/BuscaLugar.test.tsx
git commit -m "feat(busca): 'de onde eu estou' -- o caminho de volta pro GPS"
```

---

## Task 4: `tetoDaBarraDistancia` — o teto que vem do acervo

**Files:**
- Modify: `src/lib/filtros.ts` (acrescenta; **não** apaga `DIST_MAX_KM` ainda — isso é a Task 5)
- Test: `tests/lib/filtros.test.ts`

**Interfaces:**
- Consumes: `distanciaKm`, `coordDaDistancia`, `kmNaTelaDistancia`, `type Coord` (já importados em `filtros.ts`); `type Ficha`
- Produces:
  - `export const DIST_TETO_MINIMO_KM = 30`
  - `export function tetoDaBarraDistancia(fichas: Ficha[], voce: Coord | null, valorAtual: number | null): number`

- [ ] **Step 1: Escreva os testes que falham**

Em `tests/lib/filtros.test.ts`. Use o helper de ficha sintética que o arquivo já tiver; se não tiver, copie o `fichaFake` de `tests/app/MioloHome.test.tsx` (só os campos que o schema exige) e acrescente um helper que põe o waypoint a uma distância dada:

```ts
// Um grau de latitude ≈ 111,195 km (é o que tests/lib/geo.test.ts mede). Pra
// pôr uma ficha a ~N km de VOCE, desloca-se a latitude. Não é preciso ao
// metro, e nenhum teste abaixo depende disso: os que dependem de um valor
// exato ASSERTAM a distância antes de usá-la.
const VOCE = { lat: -8, lng: -35 };
const fichaA = (slug: string, grausAoNorte: number): Ficha => ({
  ...fichaFake(slug),
  trajeto: { waypoints: [{ nome: slug, lat: VOCE.lat + grausAoNorte, lng: VOCE.lng }] },
});
```

```ts
describe("tetoDaBarraDistancia: o teto vem do acervo, não de um número inventado", () => {
  // O piso. Sem ele, um acervo todo perto degenera a barra em duas paradas.
  it("com tudo perto, o teto é o mínimo — não a trilha mais longe", () => {
    const perto = fichaA("perto", 0.07); // ~7,8 km
    expect(tetoDaBarraDistancia([perto], VOCE, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  // 🔴 O CASO QUE SEPARA a versão "acervo" da versão "constante fixa": a
  // trilha mais longe TEM que estar acima do piso, senão as duas versões
  // devolvem o mesmo número e a prova é oca.
  it("com uma trilha longe, o teto sobe pra ela, arredondado pra cima no passo", () => {
    const longe = fichaA("longe", 0.42); // ~46,7 km
    const bruta = distanciaKm(VOCE, { lat: VOCE.lat + 0.42, lng: VOCE.lng });
    // Não-vacuidade: o caso só separa se a distância cair na faixa que eu digo.
    expect(bruta).toBeGreaterThan(45);
    expect(bruta).toBeLessThan(50);
    expect(tetoDaBarraDistancia([longe], VOCE, null)).toBe(50);
  });

  // 🔴 O CANDIDATO 2, e ele é o que impede a TELA DE MENTIR: com um corte
  // guardado acima do teto do acervo, o elemento `range` prende o pegador no
  // `max` e ele encosta na parada "qualquer" enquanto a leitura ao lado diz
  // "até 500 km". A barra estica pra conter o pegador.
  it("um corte guardado ACIMA do acervo estica o teto", () => {
    const perto = fichaA("perto", 0.07);
    expect(tetoDaBarraDistancia([perto], VOCE, 500)).toBe(500);
  });

  it("um corte guardado ABAIXO do teto não o encolhe", () => {
    const longe = fichaA("longe", 0.42);
    expect(tetoDaBarraDistancia([longe], VOCE, 10)).toBe(50);
  });

  // 🔴 "O FILTRO SEGUE A TELA" aplicado ao teto. O caso que separa km cru de
  // km da tela: uma trilha cuja distância CRUA está logo acima de um múltiplo
  // do passo, mas cujo número NA TELA é o múltiplo. Com o km cru o teto pularia
  // pro próximo passo e sobraria uma parada que não esconde ninguém.
  it("o teto sai do número que a TELA mostra, não do km cru", () => {
    const f = fichaA("borda", 0.2735); // ~30,4 km cru → "~30 km" na tela
    const bruta = distanciaKm(VOCE, { lat: VOCE.lat + 0.2735, lng: VOCE.lng });
    // Não-vacuidade nos dois lados: o caso só separa dentro desta faixa.
    expect(bruta).toBeGreaterThan(30);
    expect(bruta).toBeLessThan(30.5);
    expect(kmNaTelaDistancia(bruta)).toBe(30);
    expect(tetoDaBarraDistancia([f], VOCE, null)).toBe(30); // com o km cru daria 35
  });

  // Sem localização o recorte nem aparece na tela; a função ainda tem que
  // devolver um número usável, e o acervo não entra na conta.
  it("sem localização, o teto é o mínimo", () => {
    const longe = fichaA("longe", 0.42);
    expect(tetoDaBarraDistancia([longe], null, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  it("acervo vazio não estoura", () => {
    expect(tetoDaBarraDistancia([], VOCE, null)).toBe(DIST_TETO_MINIMO_KM);
  });

  // O contrato do FaixaKm: `max` inteiro, e as paradas inteiras. Sem isso a
  // barra sobe km fracionário pelo onChange e o `lerFiltros` o recusa — o
  // filtro se desligando sozinho entre duas aberturas do app.
  it("o teto é sempre múltiplo inteiro do passo — é pré-condição do FaixaKm", () => {
    for (const graus of [0.01, 0.07, 0.2735, 0.42, 1.1, 3.7]) {
      const teto = tetoDaBarraDistancia([fichaA("x", graus)], VOCE, null);
      expect(Number.isInteger(teto)).toBe(true);
      expect(teto % DIST_PASSO_KM).toBe(0);
    }
  });

  // O teto sai da trilha MAIS LONGE, não da primeira nem da última do array.
  it("com várias trilhas, manda a mais longe — em qualquer ordem", () => {
    const a = fichaA("a", 0.07), b = fichaA("b", 0.42), c = fichaA("c", 0.2);
    expect(tetoDaBarraDistancia([a, b, c], VOCE, null)).toBe(50);
    expect(tetoDaBarraDistancia([b, c, a], VOCE, null)).toBe(50);
  });
});
```

⚠️ **O `?? 0` do ramo sub-1km NÃO ganha teste.** Com o piso de 30 km dominando, `null` e `0` produzem o mesmo resultado em toda entrada possível: nenhuma mutação os separa. Ele fica como cinto e **sem asserção fingindo que carrega alguma coisa** — mesma disciplina do `min-height: 0` do `.busca-rolo`.

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/lib/filtros.test.ts`
Expected: FAIL — `tetoDaBarraDistancia is not a function`.

- [ ] **Step 3: Implemente**

Em `src/lib/filtros.ts`, logo abaixo das constantes:

```ts
/** O piso do TETO da barra — não é o teto. Sem ele, um acervo todo perto
 *  degenera a barra em duas ou três paradas. */
export const DIST_TETO_MINIMO_KM = 30;

/** Até onde a barra de distância vai.
 *
 *  🔴 O TETO VEM DO ACERVO, e essa é a decisão do João em 2026-08-23: *"não faz
 *  sentido limitar no bate perna"*. O `DIST_MAX_KM = 100` que morreu era um
 *  número inventado; o limite agora é o mundo que existe.
 *
 *  São três candidatos, e o maior manda:
 *
 *  1. `DIST_TETO_MINIMO_KM`, o piso;
 *  2. **o corte que está ligado agora** — e este é o que impede a TELA DE
 *     MENTIR. Com "até 500 km" guardado e a trilha mais longe a 27, um teto de
 *     30 poria o pegador na parada "qualquer" (o elemento `range` prende
 *     sozinho o valor acima do `max`) enquanto a leitura ao lado diz "até 500
 *     km". A barra estica pra conter o pegador;
 *  3. a trilha mais longe do acervo.
 *
 *  🔴 O candidato 3 usa `kmNaTelaDistancia`, NÃO o km cru: é "o filtro segue a
 *  tela" aplicado ao teto. A barra tem que oferecer uma parada capaz de
 *  alcançar o número que o cartão anuncia — com o km cru, uma trilha a 30,4 km
 *  (cartão: "~30 km") empurraria o teto pra 35 e sobraria uma parada que não
 *  esconde ninguém.
 *
 *  O arredondamento pra cima no passo é PRÉ-CONDIÇÃO do `FaixaKm`: teto ou
 *  passo fracionário fariam km fracionário subir pelo `onChange`, e o
 *  `lerFiltros` recusa fracionário — o filtro se desligando sozinho entre duas
 *  aberturas do app.
 *
 *  ⚠️ O `?? 0` do ramo sub-1km é CINTO e não tem asserção fingindo que carrega
 *  algo: com o piso de 30 dominando, `null` e `0` dão o mesmo resultado em toda
 *  entrada possível, e nenhuma mutação os separa. */
export function tetoDaBarraDistancia(
  fichas: Ficha[],
  voce: Coord | null,
  valorAtual: number | null,
): number {
  const doAcervo = voce
    ? fichas.map((f) => kmNaTelaDistancia(distanciaKm(voce, coordDaDistancia(f))) ?? 0)
    : [];
  const bruto = Math.max(DIST_TETO_MINIMO_KM, valorAtual ?? 0, ...doAcervo);
  return Math.ceil(bruto / DIST_PASSO_KM) * DIST_PASSO_KM;
}
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npx vitest run tests/lib/filtros.test.ts && npx tsc --noEmit`
Expected: PASS, `tsc` limpo.

- [ ] **Step 5: Prova de mutação**

| # | Mutação em `tetoDaBarraDistancia` | Tem que derrubar |
|---|---|---|
| 1 | tirar `DIST_TETO_MINIMO_KM` do `Math.max` | "com tudo perto, o teto é o mínimo" |
| 2 | tirar `valorAtual ?? 0` do `Math.max` | "um corte guardado ACIMA do acervo estica o teto" |
| 3 | tirar `...doAcervo` do `Math.max` | "o teto sobe pra ela" e "com várias trilhas" |
| 4 | `kmNaTelaDistancia(...) ?? 0` → `distanciaKm(...)` (o km cru) | "o teto sai do número que a TELA mostra" |
| 5 | `Math.ceil` → `Math.floor` | "arredondado pra cima no passo" (46,7 → 45) |
| 6 | apagar o arredondamento (`return bruto`) | "o teto é sempre múltiplo inteiro do passo" |
| 7 | `voce ? … : []` → sempre mapear | "sem localização, o teto é o mínimo" (estoura no `voce` nulo) |
| 8 | `coordDaDistancia(f)` → `f.condicao.coords` | ⚠️ **não morde com o `fichaFake`**, cujas duas coordenadas coincidem. Ou escreve-se uma ficha com as duas DIFERENTES, ou declara-se o buraco. **Escreva a ficha** — é a invariante "uma trilha, uma fonte", e ela já custou um Critical. |

- [ ] **Step 6: Commit**

```bash
git add src/lib/filtros.ts tests/lib/filtros.test.ts
git commit -m "feat(filtros): tetoDaBarraDistancia -- o teto vem do acervo"
```

---

## Task 5: a tela usa o teto dinâmico, e `DIST_MAX_KM` morre

**Files:**
- Modify: `src/app/PainelFiltros.tsx` (prop nova, `max` da distância)
- Modify: `src/app/MioloHome.tsx` (calcula e passa)
- Modify: `src/lib/filtros.ts` (`kmGuardado` ganha `max: number | null`; `DIST_MAX_KM` apagada)
- Test: `tests/app/PainelFiltros.test.tsx`, `tests/app/MioloHome.test.tsx`, `tests/lib/filtros.test.ts`

**Interfaces:**
- Consumes: `tetoDaBarraDistancia`, `DIST_TETO_MINIMO_KM` (Task 4)
- Produces:
  - `PainelFiltros({ visiveis, tetoDistanciaKm }: { visiveis: number; tetoDistanciaKm: number })`
  - `kmGuardado(v: unknown, max: number | null)` — `null` quer dizer "sem teto"

🔴 **`kmGuardado` ganha `max: number | null` em vez de perder o parâmetro agora.** A extensão ainda é chamadora nesta task; o parâmetro só morre na Task 7. É expandir → contrair, e mexer nos dois de uma vez deixaria o `tsc` vermelho no meio.

- [ ] **Step 1: Escreva os testes que falham**

Em `tests/lib/filtros.test.ts`, no bloco do `lerFiltros`:

```ts
  // 🔴 O CASO QUE SEPARA a versão nova da velha. Com `DIST_MAX_KM = 100`, este
  // valor virava `null`. Sem teto não existe "grande demais": um corte absurdo
  // guardado produz um filtro INERTE, não um filtro que esconde.
  it("distância guardada acima de 100 km é aceita — não há mais teto", () => {
    expect(lerFiltros(JSON.stringify({ distanciaKm: 5000 })).distanciaKm).toBe(5000);
  });

  // As duas metades que CONTINUAM valendo, e a de baixo é a que impede o
  // "campo indigitável" de voltar: o piso é 1, não o passo.
  it("distância 0 e fracionária continuam virando null", () => {
    expect(lerFiltros(JSON.stringify({ distanciaKm: 0 })).distanciaKm).toBeNull();
    expect(lerFiltros(JSON.stringify({ distanciaKm: 4.5 })).distanciaKm).toBeNull();
  });

  it("distância 4 é aceita — o piso é 1, não o passo", () => {
    expect(lerFiltros(JSON.stringify({ distanciaKm: 4 })).distanciaKm).toBe(4);
  });

  // O teto da EXTENSÃO continua existindo nesta task — ela só some na Task 7.
  it("a extensão continua com teto", () => {
    expect(lerFiltros(JSON.stringify({ extensaoMaxKm: 999 })).extensaoMaxKm).toBeNull();
  });
```

Em `tests/app/PainelFiltros.test.tsx`, ajuste o helper e a prova de fonte:

```ts
// Um teto que NÃO é nenhuma constante do módulo e não é redondo: se o painel
// trocar a prop por uma constante, ou por um número escrito à mão, este valor
// não aparece na tela.
const TETO = 45;

const monta = (visiveis = 4, teto = TETO) =>
  render(
    <LocalVivo><FiltrosVivos>
      <PainelFiltros visiveis={visiveis} tetoDistanciaKm={teto} />
    </FiltrosVivos></LocalVivo>,
  );
```

```ts
  it("a faixa de distância recebe o TETO que veio de fora, e o seu passo", async () => {
    semeiaLocal();
    monta();
    await abrir();
    // O `max` da BARRA é o teto MAIS o passo: a parada extra vale "qualquer"
    // (contrato do FaixaKm). O `max` do CAMPO é o teto cru — é ele que prende.
    expect(barraDe(DISTANCIA).getAttribute("max")).toBe(String(TETO + DIST_PASSO_KM));
    expect(barraDe(DISTANCIA).getAttribute("step")).toBe(String(DIST_PASSO_KM));
    expect(campoDe(DISTANCIA).getAttribute("max")).toBe(String(TETO));
    // A de tamanho continua lendo as constantes dela — ela só some na Task 6.
    expect(barraDe(TAMANHO).getAttribute("max")).toBe(String(EXT_MAX_KM + EXT_PASSO_KM));
    expect(campoDe(TAMANHO).getAttribute("max")).toBe(String(EXT_MAX_KM));
  });

  // Não-vacuidade do teste acima: com um teto DIFERENTE, a tela muda junto.
  // Sem esta metade, um painel que ignorasse a prop e usasse uma constante
  // igual a 45 passaria.
  it("teto diferente, barra diferente — a prop é lida de verdade", async () => {
    semeiaLocal();
    monta(4, 120);
    await abrir();
    expect(campoDe(DISTANCIA).getAttribute("max")).toBe("120");
  });
```

E a prova de fonte (substitui a de hoje, linha ~431):

```ts
  // 🔴 A prova de FONTE, e ela NÃO é redundante com a de comportamento acima:
  // em runtime `45` e `tetoDistanciaKm` são o MESMO valor no render do teste.
  // Só a fonte separa a versão que lê a prop da que digita um número.
  it("o painel não escreve km à mão — o teto vem da prop, o passo do módulo", () => {
    const src = fonte("PainelFiltros.tsx");
    const importados = src.match(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/filtros"/);
    expect(importados, "o painel tem que importar os limites de @/lib/filtros").not.toBeNull();
    for (const c of ["DIST_PASSO_KM", "EXT_MAX_KM", "EXT_PASSO_KM"]) {
      expect(importados![1]).toContain(c);
    }
    // 🔴 DIST_MAX_KM não existe mais. Se ele reaparecer aqui, é o teto
    // inventado voltando.
    expect(importados![1]).not.toContain("DIST_MAX_KM");
    // O outro lado: todo `max=`/`passo=` que o painel passa sai do vocabulário
    // permitido. Sem esta metade, importar tudo e ainda escrever `max={100}`
    // numa das faixas passaria verde.
    const passados = [...src.matchAll(/\b(?:max|passo)=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(passados).toHaveLength(4);
    for (const v of passados) {
      expect(v).toMatch(/^(?:tetoDistanciaKm|DIST_PASSO_KM|EXT_MAX_KM|EXT_PASSO_KM)$/);
    }
    // Anti-vacuidade: sem esta linha, os quatro poderiam ser `DIST_PASSO_KM`.
    expect(passados).toContain("tetoDistanciaKm");
  });
```

Em `tests/app/MioloHome.test.tsx`, o teste de **junção** — o único capaz de pegar a troca de uma palavra. ⚠️ **Os imports do arquivo ganham `CHAVE_LOCAL` de `@/lib/local` e `DIST_TETO_MINIMO_KM` de `@/lib/filtros`** (o arquivo hoje só importa `CHAVE_FILTROS` e `SEM_FILTRO`).

```ts
// ——————— o teto da barra sai de `pares`, nunca de `visiveis` ———————
//
// 🔴 É CIRCULAR com `visiveis`: ligar "até 10 km" esconderia a trilha mais
// longe, o teto encolheria, e a barra se reescreveria embaixo do dedo — o
// caminho de volta pra 50 km deixaria de existir na tela. Mesmo motivo pelo
// qual o `confia` já sai de `pares` neste arquivo.
describe("o teto da barra de distância", () => {
  // VOCE em (-8, -35): `longe` fica a ~46,7 km e `perto` a ~7,8 km.
  const semeiaVoce = () =>
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "gps", coord: { lat: -8, lng: -35 }, em: Math.floor(Date.now() / 1000),
    }));
  const parEm = (slug: string, graus: number): ParFolha => ({
    ficha: { ...fichaFake(slug), trajeto: { waypoints: [{ nome: slug, lat: -8 + graus, lng: -35 }] } },
    leitura: { estado: "fresco", erro: false, calculadoEm: agoraSeg() },
  });
  const maxDoCampo = () =>
    (screen.getByRole("spinbutton", { name: /distância daqui: km/i }) as HTMLInputElement)
      .getAttribute("max");

  it("com um filtro que ESCONDE a trilha mais longe, o teto não encolhe", async () => {
    semeiaVoce();
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, distanciaKm: 10 }));
    render(<Tela pares={[parEm("perto", 0.07), parEm("longe", 0.42)]} />);
    await act(async () => {});
    await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
    // Não-vacuidade: o filtro está de fato escondendo a trilha longe.
    expect(cartoesNaTela(document.body).length).toBe(1);
    // E o teto continua o do ACERVO (46,7 → 50), não o das visíveis (7,8 → 30).
    expect(maxDoCampo()).toBe("50");
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/lib/filtros.test.ts tests/app/PainelFiltros.test.tsx tests/app/MioloHome.test.tsx`
Expected: FAIL — a prop não existe, `distanciaKm: 5000` vira `null`.

- [ ] **Step 3: Implemente**

`src/lib/filtros.ts` — apague `export const DIST_MAX_KM = 100;` e reescreva o comentário do bloco de constantes (ele hoje fala de "os limites dos dois recortes de km" e de a faixa da tela lê-los daqui; o da distância não vem mais daqui). Depois:

```ts
/** Km guardado: inteiro, de 1 até `max` — e `max: null` quer dizer SEM TETO.
 *
 *  A distância passa `null` desde que o teto virou dinâmico: sem teto não
 *  existe valor "grande demais", só filtro inerte. Prender aqui num número
 *  fixo faria a barra aceitar um corte que a releitura joga fora na abertura
 *  seguinte — o filtro se desligando sozinho, que é o defeito central da
 *  rodada passada.
 *
 *  O piso continua sendo `1`, e não o passo: com o piso em 5, um `4` digitado
 *  seria aceito pela tela, guardado, e viraria `null` na releitura. */
function kmGuardado(v: unknown, max: number | null): number | null {
  if (!ehInteiro(v) || v < 1) return null;
  return max !== null && v > max ? null : v;
}
```

E no `lerFiltros`:

```ts
    distanciaKm: kmGuardado(x.distanciaKm, null),
    …
    extensaoMaxKm: kmGuardado(x.extensaoMaxKm, EXT_MAX_KM),
```

`src/app/PainelFiltros.tsx` — a assinatura, o `max` da distância, e o import sem `DIST_MAX_KM`:

```tsx
export default function PainelFiltros({
  visiveis,
  tetoDistanciaKm,
}: {
  visiveis: number;
  /** Até onde a barra de distância vai. Vem PRONTO do `MioloHome`, que é quem
   *  tem o acervo, a sua coordenada e o filtro no mesmo escopo — o painel
   *  continua sem fazer conta de km. Ver `tetoDaBarraDistancia`. */
  tetoDistanciaKm: number;
}) {
```

```tsx
            <FaixaKm
              rotulo="Distância daqui"
              valor={filtros.distanciaKm}
              max={tetoDistanciaKm}
              passo={DIST_PASSO_KM}
              onChange={(km) => trocar({ distanciaKm: km })}
            />
```

Atualize também o comentário 🔴 do topo do arquivo: hoje ele diz *"OS QUATRO LIMITES DE KM SAEM DE `@/lib/filtros`"*, e passam a ser três — o teto da distância vem de prop.

`src/app/MioloHome.tsx` — depois do `const visiveis = …`:

```tsx
  // 🔴 O TETO DA BARRA SAI DE `pares`, NUNCA de `visiveis`, e é circular do
  // mesmo jeito que o `confia`: com as visíveis, ligar "até 10 km" esconderia
  // a trilha mais longe, o teto encolheria, e a barra se reescreveria embaixo
  // do dedo — o caminho de volta pra 50 km deixaria de existir na tela.
  //
  // Ele nasce AQUI porque este é o único escopo que tem as três entradas
  // juntas: o acervo, a coordenada da pessoa e o recorte ligado. Calculá-lo no
  // painel obrigaria o painel a fazer conta de km, que é justamente o que a
  // asserção de fonte de lá protege.
  const tetoDistanciaKm = tetoDaBarraDistancia(
    pares.map((p) => p.ficha),
    voce,
    filtros.distanciaKm,
  );
```

```tsx
      <PainelFiltros visiveis={visiveis.length} tetoDistanciaKm={tetoDistanciaKm} />
```

- [ ] **Step 4: Rode e confirme que passa**

Run: `npm test && npx tsc --noEmit`
Expected: tudo verde. Outros arquivos que montam `<PainelFiltros>` na mão precisam da prop nova — passe `tetoDistanciaKm={DIST_TETO_MINIMO_KM}` neles.

- [ ] **Step 5: Prova de mutação**

| # | Mutação | Tem que derrubar |
|---|---|---|
| 1 | `pares.map(...)` → `visiveis.map(...)` no `MioloHome` | "com um filtro que ESCONDE a trilha mais longe, o teto não encolhe" |
| 2 | `max={tetoDistanciaKm}` → `max={100}` | "o painel não escreve km à mão" (**só** a de fonte) |
| 3 | `max={tetoDistanciaKm}` → `max={DIST_TETO_MINIMO_KM}` | "teto diferente, barra diferente" |
| 4 | `kmGuardado(x.distanciaKm, null)` → `kmGuardado(x.distanciaKm, 100)` | "distância guardada acima de 100 km é aceita" |
| 5 | `v < 1` → `v < DIST_PASSO_KM` | "distância 4 é aceita" |
| 6 | `filtros.distanciaKm` → `null` no 3º argumento do `MioloHome` | ⚠️ **provavelmente NÃO morde** com os fixtures acima. Se não morder, acrescente um teste com um corte guardado maior que o acervo e leia o `max` do campo. |

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(filtros): a barra de distancia sem teto inventado -- DIST_MAX_KM morre"
```

---

## Task 6: a extensão sai da TELA

**Files:**
- Modify: `src/app/PainelFiltros.tsx` (a `<FaixaKm>` de tamanho e os imports `EXT_*`)
- Modify: `src/app/CartaoTrilha.tsx:50-55` (a linha e o comentário)
- Modify: `src/app/[slug]/page.tsx:40-53` (o item de `fatosDaVia` e o comentário)
- Test: `tests/app/PainelFiltros.test.tsx`, `tests/app/CartaoTrilha.test.tsx`, `tests/app/ficha.test.tsx`, `tests/app/km-uma-fonte.test.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `PainelFiltros` sem a faixa de tamanho. `Filtros.extensaoMaxKm` **continua existindo** e fica inerte até a Task 7 — o `tsc` segue verde.

- [ ] **Step 1: Apague os testes da faixa de tamanho e ajuste os que sobram**

Em `tests/app/PainelFiltros.test.tsx`:
- apague `"a faixa de tamanho escreve em extensaoMaxKm"`, `"a faixa de tamanho MOSTRA o recorte guardado…"` e `"sem localização, o grupo Tamanho da trilha CONTINUA aparecendo"`;
- em `"a faixa de distância MOSTRA o recorte guardado, e a de tamanho não herda"`, tire a metade da vizinha e renomeie pra `"a faixa de distância MOSTRA o recorte guardado"`;
- em `"a faixa de distância recebe o TETO que veio de fora"`, tire as duas linhas do `TAMANHO`;
- na prova de fonte, `toHaveLength(4)` → `toHaveLength(2)`, o vocabulário vira `/^(?:tetoDistanciaKm|DIST_PASSO_KM)$/`, e o laço dos importados perde `EXT_MAX_KM`/`EXT_PASSO_KM`;
- acrescente:

```ts
  // A faixa saiu por decisão do João em 2026-08-23: "remova o filtro tamanho
  // da trilha, acho que não está para hoje". Irmã dos testes de Duração e
  // Esforço logo acima — o que sai da tela tem que ter prova de que saiu.
  it("não existe mais grupo Tamanho da trilha", async () => {
    semeiaLocal();
    monta();
    await abrir();
    expect(screen.queryByRole("group", { name: TAMANHO })).toBeNull();
    // Não-vacuidade: o painel está aberto e tem grupos.
    expect(screen.getByRole("group", { name: DISTANCIA })).toBeTruthy();
  });
```

Em `tests/app/CartaoTrilha.test.tsx` e `tests/app/ficha.test.tsx`: apague as asserções que exigem o texto de extensão e substitua por ausência **do elemento certo**, no molde da lição do `?.textContent ?? ""`:

```ts
  // Ausência de TEXTO mascara o sumiço do elemento: `?.textContent ?? ""`
  // devolve a mesma string vazia com o span presente-e-vazio e com ele
  // ausente. Aqui o que se prova é que o número da trilha não está mais na
  // linha, com o elemento PRESENTE — por isso o `toBe` da linha inteira, e não
  // um `not.toContain`.
  // 🔴 A ficha do teste TRAZ `extensaoKm` de propósito: nesta task o campo
  // ainda existe no schema (ele só morre na Task 7), então este é o caso que
  // SEPARA "a tela parou de mostrar" de "o dado sumiu". Com um fixture sem o
  // campo, a asserção passaria com a linha do cartão de volta no lugar.
  //
  // E `piso: "asfalto-esburacado"`, nunca `barro`: `rotuloPiso("barro")`
  // devolve `"barro"`, então com esse exemplo chamar a função ou usar o campo
  // cru dá a MESMA string e a prova fica oca (lição da Task 6 da rodada
  // passada).
  it("o cartão não mostra mais km de trilha, mesmo com o campo na ficha", async () => {
    const ficha = { ...fichaBase, extensaoKm: 4.2, piso: "asfalto-esburacado" as const };
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>,
    );
    // Sem localização e ficha gratuita, o piso é a única parte que sobra — e o
    // `toBe` da linha INTEIRA é o que prova a ausência, porque um
    // `not.toContain("km de trilha")` passaria também com o elemento sumido.
    expect(container.querySelector(".cartao-meta")!.textContent)
      .toBe("asfalto esburacado");
  });
```

Em `tests/app/km-uma-fonte.test.tsx`: apague o par cartão↔ficha da extensão. **O par do `piso` fica.** Se o arquivo ficar sem nenhum teste, apague o arquivo e diga isso no commit.

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/app/PainelFiltros.test.tsx tests/app/CartaoTrilha.test.tsx tests/app/ficha.test.tsx tests/app/km-uma-fonte.test.tsx`
Expected: FAIL — os grupos e os textos ainda existem.

- [ ] **Step 3: Implemente**

`src/app/PainelFiltros.tsx`: apague o bloco `<FaixaKm rotulo="Tamanho da trilha" …/>` inteiro, junto com o comentário acima dele, e tire `EXT_MAX_KM`/`EXT_PASSO_KM` do import. **Mantenha** o comentário que explica que o `FaixaKm` já é o grupo — ele continua valendo pra faixa que sobrou.

`src/app/CartaoTrilha.tsx`: apague a linha 55 **e o comentário das linhas 50-54**, e tire `formatarExtensao` do import.

🔴 **O comentário vira mentira no mesmo instante:** ele fala dos *"DOIS números em km desta linha"* pra justificar o sufixo "de trilha". Com um número só, a frase é falsa e a justificativa some junto. Não o "adapte" — ele existia pra explicar uma coisa que deixou de existir.

`src/app/[slug]/page.tsx`: apague a linha 52 e ajuste o comentário das linhas 40-50, que hoje diz *"Os dois fatos do LUGAR que o cartão da home já mostra"* e cita `formatarExtensao`. Passa a ser **um** fato. Tire `formatarExtensao` do import.

⚠️ **Mantenha o `fatosDaVia` como lista com `.filter(Boolean)` e o guarda único**, mesmo com um item só. A razão está medida na Task 7 da rodada passada: com elementos separados, tirar o guarda faria `rotuloPiso(undefined)` **estourar**, e "quebrou" não é o mesmo que "não mostrou linha vazia" — a mutação passa a falhar pelo motivo errado.

- [ ] **Step 4: Rode e confirme que passa**

Run: `npm test && npx tsc --noEmit`
Expected: verde. O `tsc` continua limpo porque `Filtros.extensaoMaxKm` e `ficha.extensaoKm` ainda existem — eles só somem na Task 7.

- [ ] **Step 5: Prova de mutação**

| # | Mutação | Tem que derrubar |
|---|---|---|
| 1 | devolver a `<FaixaKm>` de tamanho ao painel | "não existe mais grupo Tamanho da trilha" |
| 2 | devolver a linha da extensão ao `CartaoTrilha` | "o cartão não mostra mais km de trilha" |
| 3 | devolver o item ao `fatosDaVia` | o teste equivalente da ficha |
| 4 | apagar o `partes.length > 0 &&` do cartão | o teste de **ausência de ELEMENTO** que já existe (`toBeNull()`) — confirme que ele continua de pé com a extensão fora |

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(tela): o tamanho da trilha sai do painel, do cartao e da ficha"
```

---

## Task 7: A CONTRAÇÃO — `extensaoKm` sai do modelo

**Files:**
- Modify: `src/lib/filtros.ts` (tipo, `SEM_FILTRO`, `contarLigados`, `lerFiltros`, `passaNoFiltro`, `EXT_MAX_KM`, `EXT_PASSO_KM`, `kmGuardado`)
- Modify: `src/lib/geo.ts` (`kmNaTelaExtensao`, `formatarExtensao`, e o comentário de `kmNaTelaDistancia`)
- Modify: `src/lib/piso.ts:3` (a oração que manda ver `formatarExtensao`)
- Modify: `src/types/ficha.ts:59-61` — **POR ÚLTIMO**
- Modify: `docs/questionario-ficha.md`
- Test: `tests/lib/filtros.test.ts`, `tests/lib/geo.test.ts`, `tests/lib/ficha.test.ts`, `tests/lib/questionario.test.ts`

**Interfaces:**
- Produces: `Filtros` com **quatro** campos (`distanciaKm`, `daHoje`, `soGratis`, `pisoMinimo`); `kmGuardado(v: unknown): number | null` sem parâmetro de teto; `Ficha` sem `extensaoKm`.

- [ ] **Step 1: Escreva o teste do FILTRO FANTASMA**

Em `tests/lib/filtros.test.ts`. É a prova de que a contração fechou — a mesma da Task 8 da rodada passada, com o campo desta:

```ts
  // 🔴 O FILTRO FANTASMA. O celular do João tem `extensaoMaxKm` gravado de
  // verdade: ele usou o recorte. Se o `lerFiltros` continuar lendo o campo, a
  // linha de resumo diz "1 filtro ligado" sem chip pra desligar e sem botão de
  // limpar (o `limpar filtros` do FolhaTrilhas vive dentro do ramo
  // `visiveis.length === 0`, e a lista não fica vazia). Foi exatamente o que
  // ele reclamou no primeiro review.
  it("o que está guardado no celular dele não acende filtro nenhum", () => {
    const velho = JSON.stringify({
      distanciaKm: 30, extensaoMaxKm: 6, esforco: "media", duracaoMax: 90,
    });
    const lido = lerFiltros(velho);
    expect(contarLigados(lido)).toBe(1); // só a distância, que continua existindo
    expect(Object.keys(lido).sort()).toEqual(
      ["daHoje", "distanciaKm", "pisoMinimo", "soGratis"],
    );
  });

  // A contagem tem que ser exatamente os campos de `Filtros`. Um que falte faz
  // a tela dizer "2 filtros" com três ligados; um que sobre é o fantasma.
  it("contarLigados conta os QUATRO campos que sobraram", () => {
    expect(contarLigados({
      distanciaKm: 30, daHoje: true, soGratis: true, pisoMinimo: "asfalto-tapete",
    })).toBe(4);
    expect(contarLigados(SEM_FILTRO)).toBe(0);
  });
```

Em `tests/lib/geo.test.ts`: apague os `describe` de `formatarExtensao` e `kmNaTelaExtensao`, e o teste `"as duas divergem de 10 km pra cima — por isso são duas"` (o par deixou de existir). **Mantenha** todos os de distância.

Em `tests/lib/questionario.test.ts`: apague `"a pergunta da extensão diz SÓ IDA…"` e `"a pergunta da extensão diz que é a trilha a pé…"`; em `"o questionário pergunta os dois campos novos"`, tire a linha do `extensaoKm` e renomeie pra `"…o campo novo"`; em `"as duas perguntas novas dizem que pular é permitido"`, deixe só a do piso.

⚠️ O teste `"todo campo do schema tem pergunta"` **deriva de `fichaSchema.shape`** e se ajusta sozinho — não o toque.

Em `tests/lib/ficha.test.ts`: apague o teste que faz `fichaSchema.parse({ ...base, extensaoKm: 4.2 })`.

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run tests/lib/filtros.test.ts`
Expected: FAIL — `contarLigados` devolve 2 e as chaves ainda incluem `extensaoMaxKm`.

- [ ] **Step 3: Contraia, nesta ordem**

**3a. `src/lib/filtros.ts`:**
- tire `kmNaTelaExtensao` do import de `@/lib/geo`;
- apague `EXT_MAX_KM` e `EXT_PASSO_KM`;
- apague `extensaoMaxKm` de `Filtros`, de `SEM_FILTRO`, do array do `contarLigados` e do objeto do `lerFiltros`;
- apague o bloco inteiro do `passaNoFiltro` (`if (filtros.extensaoMaxKm !== null && ficha.extensaoKm) {…}`) **e o comentário gigante acima dele**;
- `kmGuardado` perde o parâmetro:

```ts
/** Km guardado: inteiro, de 1 pra cima. **Não há teto** — o da distância virou
 *  dinâmico (`tetoDaBarraDistancia`) e o da extensão deixou de existir com o
 *  campo. Sem teto não existe valor "grande demais": um corte absurdo produz um
 *  filtro INERTE, não um filtro que esconde.
 *
 *  O piso continua `1`, e não o passo: com o piso em 5, um `4` digitado seria
 *  aceito pela tela, guardado, e viraria `null` na releitura — o filtro se
 *  desligando sozinho entre duas aberturas do app. */
function kmGuardado(v: unknown): number | null {
  return ehInteiro(v) && v >= 1 ? v : null;
}
```

🔴 **O comentário do `contarLigados` crava "CINCO" e passa a valer QUATRO.** E o da REGRA DE HONESTIDADE 2 afirma *"os DOIS campos opcionais que sobraram (`extensaoKm` e `piso`): a única ficha real não tem nenhum dos dois"* — **as duas metades ficam falsas** (o campo não existe, e a Rampa ganha `piso` na Task 8). Reescreva as duas orações; não as adapte pela metade.

**3b. `src/lib/geo.ts`:** apague `kmNaTelaExtensao` e `formatarExtensao` com os comentários delas, e conserte a oração de `kmNaTelaDistancia` (linhas ~42-44) que diz *"Ela e a irmã `kmNaTelaExtensao` NÃO arredondam igual"*. A irmã some — e com ela a razão de o nome ser tão específico. Escreva a razão que **sobra**: o arredondamento da tela é fonte única, e o filtro compara o que sai daqui.

**3c. `src/lib/piso.ts:3`:** a oração manda ver `formatarExtensao` em `geo.ts`. Balde (a) — **afirma um consumidor desfeito**. O corte que ela descreve (via dirigida × trecho a pé) continua sendo o certo; só a referência morre.

**3d. `src/types/ficha.ts`:** por último, apague as linhas 59-61.

**3e. `docs/questionario-ficha.md`:** apague a seção `## Quantos km — extensaoKm` inteira; ajuste a linha ~370 que diz *"`piso` e `extensaoKm` são os dois únicos campos opcionais"* pra falar de um; e confira as menções das linhas ~54-57 e ~205-214.

- [ ] **Step 4: A VARREDURA — termos copiados do diff, busca `-i`**

```bash
git diff --stat HEAD~1
grep -rin "extensaoKm\|extensaoMaxKm\|formatarExtensao\|kmNaTelaExtensao\|EXT_MAX_KM\|EXT_PASSO_KM" src/ docs/questionario-ficha.md
```

Classifique **cada** ocorrência em três baldes:
- **(a) frase que AFIRMA um consumidor desfeito** → corrija a oração agora;
- **(b) referência declarada como HISTÓRIA** ("apagado na contração de 2026-08-23") → deixe;
- **(c) CÓDIGO** → a task não terminou. **Só este bloqueia.**

🔴 Termos **copiados do diff**, não digitados de memória, e `-i` porque `rg` é sensível a caixa. Foi assim que a Task 8 da rodada passada falhou uma vez: `duracao` não acha `formatarDuracao`.

- [ ] **Step 5: Rode tudo, inclusive o build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: os três verdes. **O `npm run build` não é opcional:** o vitest não vê o bundle, e é ele que prova que a contração chegou aos chunks.

- [ ] **Step 6: Prova de mutação — cada ressurreição, uma a uma**

| # | Ressuscite | Quem é o dono, MEDIDO |
|---|---|---|
| 1 | `extensaoKm` no `src/types/ficha.ts` | ? testes — meça. **O `tsc` provavelmente fica LIMPO**: foi o que aconteceu com `esforco` na Task 8 |
| 2 | `extensaoMaxKm` em `Filtros` + `contarLigados` | "o que está guardado no celular dele" e "contarLigados conta os QUATRO" |
| 3 | `lerFiltros` voltando a preservar o campo | "o que está guardado no celular dele" (`Object.keys`) |
| 4 | `formatarExtensao` de volta ao `geo.ts`, **sem chamador** | 🔴 **NINGUÉM.** `tsc` limpo, build passando, suíte verde — não renderiza, não computa, não entra no bundle. **Declare o buraco**; quem a pega é a varredura do Step 4. Uma asserção de fonte aqui seria prova de ARRUMAÇÃO, não de comportamento (a régua está no §4 do RESUME) |

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(contracao): extensaoKm sai do schema, dos filtros, do geo e do questionario"
```

---

## Task 8: `piso: "barro"` na Rampa

**Files:**
- Modify: `content/fichas/rampa-do-pepe.json`
- Test: `tests/app/CartaoTrilha.test.tsx:162`, `tests/app/ficha.test.tsx:213`, `tests/lib/ficha.test.ts:177`

**Interfaces:** nenhuma mudança de código. É **dado**.

🔴 **Vem DEPOIS da contração de propósito:** é ele que muda o sentido de testes que a Task 7 ainda ia tocar.

🔴 **É dado do João** (2026-08-23: *"a rampa do pepê é barro"*), e a ficha real o sustenta em três lugares independentes: `"Mas é barro: molhou, não vá"`, `"o barro segura água"`, `"barro brilhando/pegajoso = não vá"`. **Nada inventado** — é a regra que esta rodada herda de um Critical passado, em que uma proporção asfalto/barro que ninguém deu virou quatro arquivos.

- [ ] **Step 1: Inverta os três testes que afirmam a ausência**

Em `tests/app/CartaoTrilha.test.tsx` (~162):

```ts
  // O teste que fala de PRODUÇÃO. `ficha` é o JSON de verdade da Rampa, que
  // desde 2026-08-23 traz `piso: "barro"` — dado do João, sustentado pela ficha
  // real em três lugares. É a primeira vez que o campo criado na rodada
  // passada aparece na tela dele. Fixture sintética não provaria isso.
  it("a Rampa REAL mostra distância, o piso de barro e o custo", async () => {
    expect(ficha.piso).toBe("barro");
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
      tipo: "escolhido", coord: { lat: -8.20111, lng: -35.56472 },
      em: 1_800_000_000, nome: "Gravatá", regiao: "Pernambuco",
    }));
    const { container } = render(
      <LocalVivo><CartaoTrilha ficha={ficha} inicial={leitura} /></LocalVivo>,
    );
    await screen.findByText(/km em linha reta/);
    const meta = container.querySelector(".cartao-meta")?.textContent ?? "";
    expect(meta).toBe("~60 km em linha reta · barro · R$ 5 por pessoa");
  });
```

⚠️ **O teste precisa do marcador de sessão** se o `em: 1_800_000_000` deixar de valer — confira depois da Task 2. E confirme a ORDEM da linha lendo o `partes` do `CartaoTrilha.tsx`: distância, piso, custo.

Em `tests/app/ficha.test.tsx` (~213):

```ts
  it("a Rampa real abre e mostra o piso no Trajeto", async () => {
    const rampa = getFicha("rampa-do-pepe");
    expect(rampa?.piso).toBe("barro");
    const { container } = await abrir("rampa-do-pepe");
    expect(container.querySelector("h1")?.textContent).toBe("Rampa do Pepê");
    const fatos = blocoTrajeto(container).querySelector(".fatos");
    expect(fatos, "a linha de fatos sumiu do bloco Trajeto").not.toBeNull();
    expect(fatos!.textContent).toBe("barro");
  });
```

Em `tests/lib/ficha.test.ts` (~177):

```ts
  it("a Rampa carrega com piso de barro — é dado real, não fixture", () => {
    const f = getFicha("rampa-do-pepe");
    expect(f).not.toBeNull();
    expect(f!.piso).toBe("barro");
  });
```

- [ ] **Step 2: Prove a Regra de Honestidade 2 do `piso` por FIXTURE**

🔴 **A Rampa era o único exemplo real de "ficha sem o campo".** Com `barro` gravado, ela deixa de servir. Procure em `tests/lib/filtros.test.ts` e nos testes de cartão/ficha qualquer teste de honestidade que carregue a Rampa **pelo loader** e troque-o por fixture sem `piso`:

```ts
  // REGRA DE HONESTIDADE 2: ficha SEM o campo nunca é escondida por ele.
  // 🔴 Por FIXTURE, e de propósito: até 2026-08-23 a Rampa era o exemplo real
  // de ficha sem `piso`, e com `barro` gravado ela deixou de servir. Carregá-la
  // pelo loader aqui faria este teste provar o contrário do que o nome diz.
  it("ficha sem piso não some com nenhum chip ligado", () => {
    const semPiso = fichaFake("sem-piso"); // sem o campo
    for (const p of PISOS_FILTRAVEIS) {
      expect(passaNoFiltro({
        ficha: semPiso, leitura: LEITURA_FRESCA,
        filtros: { ...SEM_FILTRO, pisoMinimo: p }, voce: null, confia: true,
      })).toBe(true);
    }
  });
```

- [ ] **Step 3: Prove a consequência na HOME — o chip esvazia**

Em `tests/app/MioloHome.test.tsx`, com a Rampa real ou com fixture de `piso: "barro"`:

```ts
  // A consequência que o João aceitou de olhos abertos em 2026-08-23: com uma
  // ficha só, e ela de barro, qualquer chip de piso esvazia a home. É a
  // resposta CERTA — "no mínimo asfalto esburacado" realmente exclui uma rampa
  // de barro — e a tela explica em vez de sumir calada.
  it("com a única trilha de barro, um chip de piso esvazia a home e oferece limpar", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({
      ...SEM_FILTRO, pisoMinimo: "asfalto-esburacado",
    }));
    render(<Tela pares={[par("barrenta", "fresco", { piso: "barro" })]} />);
    await act(async () => {});
    expect(screen.getByText(/Nenhuma trilha com esses filtros/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /limpar filtros/i })).toBeTruthy();
  });
```

- [ ] **Step 4: Rode e confirme que falha**

Run: `npm test`
Expected: FAIL nos três testes invertidos (`piso` ainda é `undefined`).

- [ ] **Step 5: Grave o dado**

Em `content/fichas/rampa-do-pepe.json`, depois de `"avisos"`:

```json
  "piso": "barro",
```

- [ ] **Step 6: Rode tudo**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: verde nos três.

- [ ] **Step 7: Prova de mutação**

| # | Mutação | Tem que derrubar |
|---|---|---|
| 1 | tirar `"piso": "barro"` do JSON | os três testes invertidos |
| 2 | `"barro"` → `"asfalto-tapete"` | os três (asserção pelo VALOR, não por presença) |
| 3 | apagar `ficha.piso &&` do `passaNoFiltro` | "ficha sem piso não some com nenhum chip ligado" |

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(rampa): piso 'barro' -- dado do Joao, sustentado pela ficha real"
```

---

## Depois das oito

1. **Chão limpo:** `npm test`, `npx tsc --noEmit`, `npm run build` — **rodados por você, na branch, não relatados por agente.**
2. 🔴 **REVISÃO DA BRANCH INTEIRA, com agente NOVO** (sem o viés de quem revisou task a task). **Oitava rodada seguida em que ela é obrigatória** — nas sete anteriores ela achou pelo menos um Critical de **JUNÇÃO**, invisível pra revisão de task. Pauta:
   - o teto dinâmico × o `MioloHome` × o `FaixaKm` controlado: a barra encolhendo quando o valor vai pra "qualquer" não deixa nenhum portador de texto mentindo?
   - a sessão × a navegação completa (o app não usa `next/link`): tocar num cartão e voltar preserva a escolha em **todos** os caminhos?
   - o "de onde eu estou" × o `rotuloPilula` × o `soGps`: existe algum estado em que a pessoa fica sem caminho?
   - a contração × os comentários dos §7.2 da spec — **todos** os seis foram corrigidos?
   - a Rampa de barro × a Regra de Honestidade 2: sobrou algum teste provando honestidade com a ficha real?
3. **Merge `--no-ff`** pra `main`.
4. **Deploy:** `npx --yes vercel@latest --prod --yes --scope bate-perna`, depois `ls --scope bate-perna` (tem que dar `● Ready · Production`).
5. **Conferência por `curl` em produção:**

```bash
H=https://bateperna.vercel.app
curl -s $H/rampa-do-pepe | grep -c 'class="fatos"'      # 1  — a Rampa agora TEM piso
curl -s $H/rampa-do-pepe | grep -o 'barro' | head -1    # barro
curl -s $H/ | grep -c 'km em linha reta'                # 0  — 1º render sem localização, SEMPRE
curl -s $H/ | grep -c 'FILTRAR'                         # 1
# e nos chunks: 0 de /extensaoKm|formatarExtensao|Tamanho da trilha|DIST_MAX_KM/
# (a contração chegou ao bundle, que é o que o vitest não vê)
```

6. **Atualize `docs/RESUME.md`** — o bloco de triagem do topo, o estado task a task, e as lições novas.

## O que só o iPhone decide (pra fila dele)

- A barra com teto **dinâmico**: soltar o dedo em "qualquer" faz a barra encolher; o pegador salta de um jeito que assusta?
- O item "de onde eu estou" — alvo de toque, e distância do campo que abre teclado.
- O cartão com **"barro"** junto do `~27 km em linha reta · R$ 5`: cabe na linha a ~360px?
- Mais tudo que continua aberto do review anterior e nunca foi visto em WebKit.
