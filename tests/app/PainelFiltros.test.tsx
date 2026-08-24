import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, act, fireEvent, within } from "@testing-library/react";
import PainelFiltros from "@/app/PainelFiltros";
import FiltrosVivos, { useFiltros, useMexerFiltros } from "@/app/filtros";
import LocalVivo from "@/app/local";
import {
  CHAVE_FILTROS,
  DIST_PASSO_KM,
  SEM_FILTRO,
  type Filtros,
} from "@/lib/filtros";
import { PISOS_FILTRAVEIS } from "@/lib/piso";
import { CHAVE_LOCAL } from "@/lib/local";

afterEach(() => { cleanup(); localStorage.clear(); });

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

const semeiaLocal = () =>
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
    tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000,
  }));

const abrir = async () => {
  await act(async () => { screen.getByRole("button", { name: /filtrar/i }).click(); });
};

// Os grupos são achados pelo nome que sai da `<legend>` — o título VISÍVEL.
// Nenhum `<fieldset>` deste painel leva `aria-label`: dois nomes pro mesmo
// grupo mascaram o sumiço do título na tela (medido na Task 4).
const DISTANCIA = /^distância daqui$/i;
const TAMANHO = /^tamanho da trilha$/i;
// Não ancorado no fim de propósito: é o teste da legenda logo abaixo que exige
// o "no mínimo". Ancorar aqui faria os dois provarem a mesma coisa.
const PISO = /^piso/i;

const grupo = (nome: RegExp) => screen.getByRole("group", { name: nome });
const barraDe = (nome: RegExp) => within(grupo(nome)).getByRole("slider") as HTMLInputElement;
const campoDe = (nome: RegExp) => within(grupo(nome)).getByRole("spinbutton") as HTMLInputElement;
// `asfalto-tapete` → `asfalto tapete` pelo `rotuloPiso`. O chip que os testes
// de clique usam é sempre este, e o VALOR que ele grava traz o hífen de volta.
const chipPiso = () => screen.getByRole("button", { name: /^asfalto tapete$/i });

describe("a linha de resumo", () => {
  it("diz quantas trilhas estão APARECENDO", () => {
    monta(4);
    expect(screen.getByText(/4 trilhas/)).toBeTruthy();
  });

  it("no singular quando é uma só", () => {
    monta(1);
    expect(screen.getByText(/1 trilha\b/)).toBeTruthy();
  });

  it("sem filtro ligado, não fala de filtro", () => {
    monta();
    expect(screen.queryByText(/filtro ligado/)).toBeNull();
  });

  it("com filtros ligados, diz quantos", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true, soGratis: true }));
    monta();
    expect(await screen.findByText(/2 filtros ligados/)).toBeTruthy();
  });

  // ——— pré-voo: o singular do FILTRO, irmão do singular da trilha logo acima.
  // O `\b` do teste de "1 trilha" é load-bearing (sem ele, "1 trilhas" casaria
  // e o ternário poderia sumir); o plural dos filtros não tinha o par.
  it("um filtro só também fala no singular", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    monta();
    expect(await screen.findByText(/1 filtro ligado\b/)).toBeTruthy();
  });
});

describe("o painel", () => {
  // A sonda destes dois era o grupo `/esforço/i`, que esta task apagou. Ela
  // passou a ser o grupo de PISO — os testes não são sobre esforço nem sobre
  // piso, são sobre a sanfona abrir e fechar; o grupo é só o que se vê dentro.
  it("nasce fechado", () => {
    monta();
    expect(screen.queryByRole("group", { name: PISO })).toBeNull();
  });

  it("abre no toque e fecha no toque de novo", async () => {
    monta();
    const b = screen.getByRole("button", { name: /filtrar/i });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { b.click(); });
    expect(screen.getByRole("group", { name: PISO })).toBeTruthy();
    // O `aria-expanded` é o ÚNICO sinal que quem usa leitor de tela recebe de
    // que aquele toque abriu alguma coisa — a sanfona é puramente visual.
    // Apagá-lo não derruba nenhuma outra asserção deste arquivo.
    expect(b.getAttribute("aria-expanded")).toBe("true");
    await act(async () => { b.click(); });
    expect(screen.queryByRole("group", { name: PISO })).toBeNull();
  });

  // Os dois recortes que esta rodada aposentou. Sem estas asserções, deixar um
  // deles de pé passaria despercebido — e um chip de `esforco` na tela seria um
  // recorte que a ficha nem descreve mais.
  it("não existe mais grupo Duração nem grupo Esforço", async () => {
    monta();
    await abrir();
    expect(screen.queryByRole("group", { name: /esforço/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /duração/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^leve$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^até 2h$/i })).toBeNull();
  });

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

  // Filtro que não tem como filtrar não entra na tela.
  it("sem localização, o grupo Distância daqui não aparece", async () => {
    monta();
    await abrir();
    expect(screen.queryByRole("group", { name: DISTANCIA })).toBeNull();
  });

  it("com localização, o grupo Distância daqui aparece", async () => {
    semeiaLocal();
    monta();
    await abrir();
    expect(await screen.findByRole("group", { name: DISTANCIA })).toBeTruthy();
  });

  it("ligar um recorte grava no aparelho", async () => {
    monta();
    await abrir();
    const c = chipPiso();
    await act(async () => { c.click(); });
    // O que é gravado é o VALOR do piso (com hífen), não o rótulo da tela.
    expect(localStorage.getItem(CHAVE_FILTROS)).toContain("asfalto-tapete");
    // O `aria-pressed` é o estado do chip. Sem ele o chip só muda de cor, e
    // quem não vê cor não sabe o que está ligado.
    expect(c.getAttribute("aria-pressed")).toBe("true");
  });

  // ——— revisão: um teste de CLIQUE por grupo de chip.
  //
  // Só um grupo era exercitado por clique: neutralizando o `onClick` dos
  // outros — botões MORTOS na tela — a suíte ficava inteira verde. E não fecha
  // na Task 11: lá o único clique é no "limpar filtros", todo o resto é semeado
  // por `localStorage.setItem`. Um chip mal ligado (o "só grátis" escrevendo
  // `daHoje`) entraria em produção sem nada reclamar.
  //
  // Cada um lê o que foi GRAVADO e confere o campo daquele grupo — não basta
  // "mudou alguma coisa": é o campo trocado que o defeito produz. Os três
  // grupos de chip que sobraram são Piso, Hoje e Custo; os dois recortes de km
  // não são mais chips, e têm os testes de faixa logo abaixo.
  const abrirEClicar = async (nome: RegExp) => {
    await abrir();
    await act(async () => { screen.getByRole("button", { name: nome }).click(); });
    return JSON.parse(localStorage.getItem(CHAVE_FILTROS)!);
  };

  it("o chip de PISO escreve em pisoMinimo", async () => {
    monta();
    expect(await abrirEClicar(/^asfalto tapete$/i))
      .toMatchObject({ ...SEM_FILTRO, pisoMinimo: "asfalto-tapete" });
  });

  it("o chip de HOJE escreve em daHoje", async () => {
    monta();
    expect(await abrirEClicar(/^só as que dá hoje$/i)).toMatchObject({ ...SEM_FILTRO, daHoje: true });
  });

  it("o chip de CUSTO escreve em soGratis", async () => {
    monta();
    expect(await abrirEClicar(/^só grátis$/i)).toMatchObject({ ...SEM_FILTRO, soGratis: true });
  });

  // ——— pré-voo: ligar um recorte não pode DESLIGAR os outros.
  //
  // O `trocar` espalha `{...filtros, ...p}`. Trocado por `{...SEM_FILTRO, ...p}`
  // — que é como alguém escreveria "reinicia e aplica" — nenhum teste acima
  // cai, porque todos ligam um recorte só. Na tela: a pessoa liga "só grátis",
  // depois toca num piso, e o "só grátis" se apaga sozinho enquanto ela olha.
  //
  // Este teste tocava o chip `leve`, que esta task apagou; migrou pro chip de
  // piso porque é ele quem prova o `trocar`, e não o grupo em que ele mora.
  it("ligar um recorte preserva os que já estavam ligados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    monta();
    await abrir();
    await act(async () => { chipPiso().click(); });
    const guardado = JSON.parse(localStorage.getItem(CHAVE_FILTROS)!);
    expect(guardado).toMatchObject({ soGratis: true, pisoMinimo: "asfalto-tapete" });
  });

  // ——— pré-voo: o segundo toque no chip de piso é o ÚNICO jeito de desligar
  // aquele recorte.
  //
  // A faixa de km tem a parada "qualquer"; **o piso não tem chip
  // equivalente**. Se o `filtros.pisoMinimo === p ? null : p` virar só `p`, a
  // pessoa que tocou "asfalto tapete" por engano fica presa nele — e nenhum
  // outro teste percebe, porque nenhum toca duas vezes no mesmo chip. Herdado
  // do grupo Esforço, que tinha exatamente esta forma.
  it("tocar duas vezes no mesmo chip de piso desliga — é a única saída dele", async () => {
    monta();
    await abrir();
    const c = chipPiso();
    await act(async () => { c.click(); });
    expect(c.getAttribute("aria-pressed")).toBe("true");
    await act(async () => { c.click(); });
    expect(c.getAttribute("aria-pressed")).toBe("false");
    expect(JSON.parse(localStorage.getItem(CHAVE_FILTROS)!).pisoMinimo).toBeNull();
  });

  // Mesma regra da localização: o HTML do servidor não tem filtro nenhum.
  it("o PRIMEIRO render ignora o que está guardado", () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, daHoje: true }));
    let primeiro = "";
    function Espia() {
      const f = useFiltros();
      primeiro ||= String(f.daHoje);
      return null;
    }
    render(<FiltrosVivos><Espia /></FiltrosVivos>);
    expect(primeiro).toBe("false");
  });
});

describe("os chips de piso", () => {
  // `PISOS_FILTRAVEIS`, não `PISOS`. `barro` é o PIOR piso da escala e o filtro
  // se lê "no mínimo daqui pra cima": aceso, ele não esconderia ficha nenhuma —
  // um chip que a pessoa liga, a linha de resumo conta, e a lista não muda.
  it("o chip 'barro' NÃO aparece — é o piso da escala, e não filtraria nada", async () => {
    monta();
    await abrir();
    const g = grupo(PISO);
    expect(within(g).queryByRole("button", { name: /^barro$/i })).toBeNull();
    // E a contagem, que é a outra metade: sem ela, um chip a mais com outro
    // nome passaria. O número sai da própria lista filtrável, não de um literal.
    expect(within(g).getAllByRole("button")).toHaveLength(PISOS_FILTRAVEIS.length);
  });

  // O texto do chip passa pelo `rotuloPiso`. Sem esta asserção, trocar
  // `rotuloPiso(p)` por `p` deixa tudo verde e o chip diz `asfalto-esburacado`,
  // com hífen, na cara de quem lê.
  //
  // 🔴 O piso escolhido TEM hífen, e isso é a escolha inteira: dos três
  // filtráveis, `paralelepipedo` é o que as duas versões devolvem IGUAL —
  // `rotuloPiso("paralelepipedo")` é `"paralelepipedo"`, e uma asserção nele
  // seria oca. Os outros dois (`asfalto-esburacado` e `asfalto-tapete`) servem;
  // este ficou com o teste por ser o único que nenhum outro teste já usa.
  // (Uma versão anterior deste comentário dizia "o único que separa". São
  // dois — e a medição do fix round o desmentiu: com `rotuloPiso(p)` → `p`
  // caíram seis testes, cinco deles porque o `chipPiso()` procura
  // `asfalto tapete` e o hífen o quebra.)
  it("o chip mostra o rótulo sem hífen", async () => {
    monta();
    await abrir();
    expect(within(grupo(PISO)).getByRole("button", { name: /^asfalto esburacado$/i })).toBeTruthy();
  });

  // Sem o "no mínimo", "asfalto tapete" lê como "SÓ asfalto tapete" — e o
  // recorte é o contrário: daquele piso pra cima.
  it("a legenda do piso diz que é MÍNIMO", async () => {
    monta();
    await abrir();
    expect(grupo(PISO).querySelector("legend")?.textContent).toMatch(/no mínimo/i);
  });
});

// ——————— a faixa de km ———————
//
// 🔴 Era "as DUAS faixas de km" até a Task 7 (2026-08-23): a faixa de tamanho
// da trilha saiu da tela junto com o campo `extensaoKm`. Só a de distância
// sobrou, e o limite dela hoje tem DUAS origens diferentes — o teto
// (`tetoDaBarraDistancia`, calculado a partir do acervo) chega pelo PROP
// `tetoDistanciaKm` (prova logo abaixo, "recebe o TETO que veio de fora"), e
// o passo (`DIST_PASSO_KM`) continua vindo direto do MÓDULO (prova de FONTE em
// "o painel não escreve km à mão — o teto vem da prop, o passo do módulo",
// mais abaixo neste arquivo). As duas provas são necessárias — em runtime o
// literal e a constante são o mesmo valor.
//
// 🔴 A COSTURA tinha DUAS pontas enquanto havia duas faixas, achado T5-1 da
// revisão: os testes de escrita (mexer na faixa grava) deixavam passar verde
// a mutação de LEITURA `valor={null}` na faixa de distância (o recorte corta
// de verdade, a linha diz "1 filtro ligado", e a faixa fica em branco dizendo
// "qualquer"). O `FaixaKm` é CONTROLADO: a Task 4 provou que ele obedece à
// prop, e provar que o painel a ALIMENTA só é possível aqui. O
// `"o PRIMEIRO render ignora o que está guardado"` agrava — o painel nasce em
// branco de propósito, então esta leitura de volta é O mecanismo que faz um
// recorte guardado reaparecer na tela.
describe("a faixa de km escreve e lê", () => {
  it("a faixa de distância escreve em distanciaKm", async () => {
    semeiaLocal();
    monta();
    await abrir();
    fireEvent.change(campoDe(DISTANCIA), { target: { value: "30" } });
    // `toMatchObject` com o SEM_FILTRO inteiro: nomeia o campo que recebeu E
    // afirma que nenhum outro recebeu.
    expect(JSON.parse(localStorage.getItem(CHAVE_FILTROS)!))
      .toMatchObject({ ...SEM_FILTRO, distanciaKm: 30 });
  });

  // A METADE que sobrou de "MOSTRA o recorte guardado, e a de tamanho não
  // herda": a faixa de tamanho saiu da tela na Task 6, então só resta provar
  // que a de distância mostra o que foi guardado — não há mais vizinha pra
  // checar que NÃO herdou.
  it("a faixa de distância MOSTRA o recorte guardado", async () => {
    semeiaLocal();
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, distanciaKm: 30 }));
    monta();
    await abrir();
    expect(campoDe(DISTANCIA).value).toBe("30");
    expect(barraDe(DISTANCIA).value).toBe("30");
    expect(within(grupo(DISTANCIA)).getByText("até 30 km")).toBeTruthy();
  });

  // O teto vem de FORA (prop `tetoDistanciaKm`, calculada por
  // `tetoDaBarraDistancia`), não de uma constante do módulo — trocar a prop
  // por um literal escrito à mão é a mesma família de "o filtro se desliga
  // sozinho": a tela mostraria um teto que não bate com o que
  // `tetoDaBarraDistancia` calculou pro acervo, e a barra deixaria de ter uma
  // parada capaz de alcançar a trilha mais longe. O passo, esse sim, continua
  // vindo do módulo (`DIST_PASSO_KM`).
  it("a faixa de distância recebe o TETO que veio de fora, e o seu passo", async () => {
    semeiaLocal();
    monta();
    await abrir();
    // O `max` da BARRA é o teto MAIS o passo: a parada extra vale "qualquer"
    // (contrato do FaixaKm). O `max` do CAMPO é o teto cru — é ele que prende.
    expect(barraDe(DISTANCIA).getAttribute("max")).toBe(String(TETO + DIST_PASSO_KM));
    expect(barraDe(DISTANCIA).getAttribute("step")).toBe(String(DIST_PASSO_KM));
    expect(campoDe(DISTANCIA).getAttribute("max")).toBe(String(TETO));
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

  // ——— achado T5-3 da revisão: a emenda item 5 não tinha prova.
  //
  // MEDIDO no fix round: embrulhar a faixa de tamanho num
  // `<fieldset className="filtro-grupo">` SEM legenda deixava a suíte inteira
  // verde. (Com legenda ela já caía por acidente — `getByRole` estoura ao achar
  // dois nós com o mesmo nome.) O `FaixaKm` já É o grupo: um segundo por fora
  // dá grupo dentro de grupo, e o `.filtro-grupo` de fora vira container flex
  // do de dentro, brigando com o layout do de dentro.
  it("nenhum grupo mora dentro de outro — o FaixaKm já É o grupo", async () => {
    semeiaLocal();
    monta();
    await abrir();
    const painel = document.querySelector(".filtro-painel")!;
    const grupos = [...painel.querySelectorAll("fieldset")];
    // Não-vacuidade: sem esta linha, um painel sem `<fieldset>` nenhum passaria
    // no laço abaixo por não ter o que percorrer.
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) {
      expect(g.parentElement?.closest("fieldset")).toBeNull();
    }
  });
});

// ——————— pré-voo: o que o jsdom NÃO enxerga ———————
//
// Estes testes são feios e são os que separam "passou" de "funciona no
// celular". Ver a lição 5 do docs/RESUME.md: apagar o `"use client"` do
// MapaHome deixou 26 de 27 testes verdes e o mapa parado no aparelho.
describe("o que o jsdom não vê", () => {
  const fonte = (arq: string) =>
    readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8");

  // Sem a diretiva, `useState`/`onClick`/`localStorage` não existem em
  // produção: o painel nasce fechado e nunca abre. O jsdom renderiza tudo
  // como cliente e não acusa nada.
  it("PainelFiltros é client component", () => {
    expect(fonte("PainelFiltros.tsx").trimStart().startsWith('"use client"')).toBe(true);
  });
  it("filtros.tsx é client component", () => {
    expect(fonte("filtros.tsx").trimStart().startsWith('"use client"')).toBe(true);
  });

  // Todos os testes acima embrulham `<FiltrosVivos>` na mão. Se o page.tsx
  // esquecer o provedor, eles continuam TODOS verdes e a home real não tem
  // filtro nenhum — foi exatamente assim com o `<LocalVivo>` na Task 4.
  //
  // Aqui a prova é de FONTE, e ela é fraca de propósito: nesta task nada
  // consome o provedor ainda (o `<PainelFiltros>` só entra no fluxo da home na
  // Task 11), então não há render real pra observar. **A prova forte está
  // transferida pra Task 11**, que renderiza o page.tsx de verdade com um
  // filtro guardado. Precedente da Task 3: achado real que não tem linha pra
  // consertar naquela camada vira ruling registrado, não teste de mentirinha.
  it("o page.tsx da home embrulha tudo no FiltrosVivos", () => {
    expect(fonte("page.tsx")).toContain("<FiltrosVivos>");
  });

  // 🔴 A prova de FONTE, e ela NÃO é redundante com a de comportamento acima:
  // em runtime `45` e `tetoDistanciaKm` são o MESMO valor no render do teste.
  // Só a fonte separa a versão que lê a prop da que digita um número.
  it("o painel não escreve km à mão — o teto vem da prop, o passo do módulo", () => {
    const src = fonte("PainelFiltros.tsx");
    const importados = src.match(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/filtros"/);
    expect(importados, "o painel tem que importar os limites de @/lib/filtros").not.toBeNull();
    for (const c of ["DIST_PASSO_KM"]) {
      expect(importados![1]).toContain(c);
    }
    // 🔴 DIST_MAX_KM não existe mais. Se ele reaparecer aqui, é o teto
    // inventado voltando.
    expect(importados![1]).not.toContain("DIST_MAX_KM");
    // 🔴 EXT_MAX_KM/EXT_PASSO_KM saíram do import na Task 6: a faixa de
    // tamanho não existe mais na tela, e reimportar as constantes seria o
    // painel voltando a falar de um recorte que ninguém liga mais aqui.
    expect(importados![1]).not.toContain("EXT_MAX_KM");
    expect(importados![1]).not.toContain("EXT_PASSO_KM");
    // O outro lado: todo `max=`/`passo=` que o painel passa sai do vocabulário
    // permitido. Sem esta metade, importar tudo e ainda escrever `max={100}`
    // numa das faixas passaria verde.
    const passados = [...src.matchAll(/\b(?:max|passo)=\{([^}]*)\}/g)].map((m) => m[1]);
    expect(passados).toHaveLength(2);
    for (const v of passados) {
      expect(v).toMatch(/^(?:tetoDistanciaKm|DIST_PASSO_KM)$/);
    }
    // Anti-vacuidade: sem esta linha, os dois poderiam ser `DIST_PASSO_KM`.
    expect(passados).toContain("tetoDistanciaKm");
  });

  // 🔴 A prova de FONTE dos chips de piso, irmã da de cima e pela MESMA razão.
  // Em runtime, `PISOS_FILTRAVEIS.map(...)` e os três nomes escritos à mão
  // desenham os MESMOS três chips, com os mesmos rótulos e gravando os mesmos
  // valores: nenhuma asserção sobre a tela separa as duas versões — foi medido,
  // a suíte inteira fecha verde com a lista à mão. O que a fonte garante é que
  // um piso novo em `src/lib/piso.ts` vire chip sozinho, em vez de a tela
  // oferecer um vocabulário e o `lerFiltros` conferir outro — e aí o recorte que
  // a pessoa acabou de tocar voltar `null` na abertura seguinte, calado.
  //
  // Dois lados, como no teste acima: importar não obriga a usar, então a segunda
  // asserção exige que os chips saiam DELE.
  it("os chips de piso saem de PISOS_FILTRAVEIS — nenhum piso escrito à mão", () => {
    const src = fonte("PainelFiltros.tsx");
    expect(src, "o painel tem que importar PISOS_FILTRAVEIS de @/lib/piso").toMatch(
      /import\s*\{[^}]*\bPISOS_FILTRAVEIS\b[^}]*\}\s*from\s*"@\/lib\/piso"/,
    );
    expect(src, "os chips têm que ser mapeados de PISOS_FILTRAVEIS").toMatch(
      /PISOS_FILTRAVEIS\.map\(/,
    );
  });
});

// ——————— pré-voo: os guardas do armazenamento ———————
//
// Esta é a família que custou DOIS fix rounds na Task 2, pela mesma causa nas
// duas vezes: guarda de localStorage sem prova de mutação. O `filtros.tsx` é
// espelho do `local.tsx` e herda os dois try/catch — e herdaria também a
// ausência de prova se este bloco não existisse.
//
// Em aba anônima do Safari (e com armazenamento cheio) `localStorage` ESTOURA.
// Sem os guardas, a home inteira cai na tela de erro por causa de um filtro.
describe("armazenamento que estoura não derruba a home", () => {
  it("leitura que estoura na montagem: segue sem filtro, sem quebrar", async () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
    try {
      monta();
      expect(await screen.findByText(/4 trilhas/)).toBeTruthy();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  // Tocava o chip `leve`; migrou pro chip de piso junto com o grupo. O que se
  // prova aqui não é o recorte, é a tela obedecer com a gravação estourando.
  it("escrita que estoura ao ligar um recorte: o filtro vale nesta sessão", async () => {
    monta();
    await abrir();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      const c = chipPiso();
      await act(async () => { c.click(); });
      // Não gravou, mas a tela obedeceu: o recorte vale enquanto o app estiver
      // aberto. Perder a preferência é aceitável; travar a home não é.
      expect(c.getAttribute("aria-pressed")).toBe("true");
      expect(await screen.findByText(/1 filtro ligado/)).toBeTruthy();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  // ——— achado desta task, não teoria: o teste acima NÃO prova o guarda.
  //
  // Com o `try/catch` da escrita apagado ele passa verde, isolado e tudo:
  // `setFiltros(f)` roda ANTES do `setItem`, então a tela obedece do mesmo
  // jeito, e a exceção do handler não chega ao chamador — o despacho sintético
  // de evento do React a transforma em erro global do jsdom (a suíte fica
  // vermelha por "Unhandled Error", sem nenhuma asserção cair).
  //
  // É a MESMA pegadinha já documentada em tests/app/local.test.tsx, e a mesma
  // saída: chamando o setter DIRETO, dentro de `act`, a exceção estoura na
  // cara do teste. Este é o teste que morre quando o guarda morre.
  it("escrita que estoura chamada direto: o guarda é quem segura", () => {
    let mexerCaptado: ((f: Filtros) => void) | null = null;
    function Capta() {
      mexerCaptado = useMexerFiltros();
      return null;
    }
    render(<FiltrosVivos><Capta /></FiltrosVivos>);
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      expect(() => act(() => { mexerCaptado!({ ...SEM_FILTRO, daHoje: true }); })).not.toThrow();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

// ——————— pré-voo: fora de provedor ———————
//
// É o que o SERVIDOR renderiza. O `local.tsx` devolve NAO_SEI e um objeto
// inerte fora de provedor, de propósito; se o `useFiltros` fizer
// `useContext(Ctx)!`, a home estoura no servidor — e nenhum teste acima
// percebe, porque todos montam dentro do provedor.
describe("fora de provedor", () => {
  // O `not.toThrow()` daqui NÃO é o que segura a mutação, e o nome não promete
  // que seja: com `useContext(Ctx)!` o `!` desaparece em runtime e o render
  // passa liso devolvendo `null`. Quem mata a mutação é a asserção de VALOR
  // logo abaixo — o render sem estourar é o cenário, não a prova.
  it("useFiltros devolve SEM_FILTRO — é o valor que prova", () => {
    let visto: unknown = null;
    function Espia() { visto = useFiltros(); return null; }
    expect(() => render(<Espia />)).not.toThrow();
    expect(visto).toEqual(SEM_FILTRO);
  });

  // ——— revisão: a outra metade do guarda não tinha proteção nenhuma.
  //
  // `useContext(Mexer) ?? INERTE` → `useContext(Mexer)!` deixava a suíte
  // inteira verde e o `tsc` em exit 0. Aqui o `not.toThrow()` SEGURA peso, ao
  // contrário do de cima: fora de provedor o valor vira `null` e CHAMAR é o
  // que estoura — que é exatamente o que o servidor faria com a home.
  it("useMexerFiltros devolve um inerte que dá pra CHAMAR", () => {
    let visto: ((f: Filtros) => void) | null = null;
    function Espia() { visto = useMexerFiltros(); return null; }
    render(<Espia />);
    expect(() => visto!({ ...SEM_FILTRO, daHoje: true })).not.toThrow();
  });
});
