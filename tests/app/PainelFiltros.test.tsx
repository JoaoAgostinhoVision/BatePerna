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
// Âncora do "o painel abriu/fechou": era o grupo de PISO até 2026-08-27,
// quando o recorte saiu da tela. `Hoje` é o grupo que sobra sempre — o de
// distância só aparece com localização.
const HOJE = /^hoje$/i;

const grupo = (nome: RegExp) => screen.getByRole("group", { name: nome });
const barraDe = (nome: RegExp) => within(grupo(nome)).getByRole("slider") as HTMLInputElement;
const campoDe = (nome: RegExp) => within(grupo(nome)).getByRole("spinbutton") as HTMLInputElement;
// O chip que os testes de CLIQUE usam. Era o de piso até 2026-08-27; virou o de
// custo, que é booleano. ⚠️ O que se PERDEU na troca, registrado pra ninguém
// achar que foi de graça: com o piso, o valor GRAVADO ("asfalto-tapete")
// diferia do rótulo na tela ("asfalto tapete"), e a asserção separava os dois.
// Booleano não tem rótulo pra confundir com valor.
const chipDeClique = () => screen.getByRole("button", { name: /^só grátis$/i });

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
  // passou a ser o grupo de HOJE — os testes não são sobre esforço nem sobre
  // piso, são sobre a sanfona abrir e fechar; o grupo é só o que se vê dentro.
  it("nasce fechado", () => {
    monta();
    expect(screen.queryByRole("group", { name: HOJE })).toBeNull();
  });

  it("abre no toque e fecha no toque de novo", async () => {
    monta();
    const b = screen.getByRole("button", { name: /filtrar/i });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { b.click(); });
    expect(screen.getByRole("group", { name: HOJE })).toBeTruthy();
    // O `aria-expanded` é o ÚNICO sinal que quem usa leitor de tela recebe de
    // que aquele toque abriu alguma coisa — a sanfona é puramente visual.
    // Apagá-lo não derruba nenhuma outra asserção deste arquivo.
    expect(b.getAttribute("aria-expanded")).toBe("true");
    await act(async () => { b.click(); });
    expect(screen.queryByRole("group", { name: HOJE })).toBeNull();
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
    const c = chipDeClique();
    await act(async () => { c.click(); });
    expect(localStorage.getItem(CHAVE_FILTROS)).toContain('"soGratis":true');
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

  // 🔴 "o chip de PISO escreve em pisoMinimo" morreu aqui (2026-08-27) com o
  // recorte que ele provava. Sobraram os dois chips booleanos, abaixo.

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
  // Este teste já tocou o chip `leve` (apagado na Task 2) e o de piso (apagado
  // em 2026-08-27). O que ele prova é o `trocar`, não o grupo em que o chip
  // mora — e o par tem que ser de recortes DIFERENTES, senão a mutação passa.
  it("ligar um recorte preserva os que já estavam ligados", async () => {
    localStorage.setItem(CHAVE_FILTROS, JSON.stringify({ ...SEM_FILTRO, soGratis: true }));
    monta();
    await abrir();
    await act(async () => { screen.getByRole("button", { name: /^só as que dá hoje$/i }).click(); });
    const guardado = JSON.parse(localStorage.getItem(CHAVE_FILTROS)!);
    expect(guardado).toMatchObject({ soGratis: true, daHoje: true });
  });

  // 🔴 "tocar duas vezes no mesmo chip de piso desliga" morreu aqui
  // (2026-08-27). Ele provava que o ternário `=== p ? null : p` era a ÚNICA
  // saída daquele recorte, porque o piso não tinha chip "qualquer". Os dois
  // chips que sobraram são booleanos com `!filtros.x` — alternam por
  // construção, e o `aria-pressed` já é provado nos testes de clique.

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

// 🔴 O GUARDA QUE FALTAVA, e ele nasceu de uma mutação SOBREVIVENTE
// (2026-08-27): acrescentar um chip que não recorta nada passava a suíte
// inteira verde. Era o buraco por onde o `barro` tinha entrado uma vez, e por
// onde o chip do carro entraria agora se ninguém olhasse.
//
// A régua: TODO grupo do painel tem que corresponder a um recorte que existe em
// `Filtros`. Chip que acende, conta na linha de resumo e não muda a lista é
// defeito — não é "preparo pro futuro".
describe("o painel não oferece controle que não recorta", () => {
  const legendas = () =>
    Array.from(document.querySelectorAll(".filtro-painel legend")).map((l) => l.textContent);

  it("sem localização, os grupos são exatamente os recortes que existem", async () => {
    monta();
    await abrir();
    expect(legendas()).toEqual(["Hoje", "Custo"]);
  });

  // Com localização entra a distância, e SÓ ela. O par é o que impede o teste
  // de cima de passar por um painel que simplesmente não desenhou nada.
  it("com localização, entra a distância e mais nada", async () => {
    semeiaLocal();
    monta();
    await abrir();
    expect(legendas()).toEqual(["Distância daqui", "Hoje", "Custo"]);
  });

  // A outra metade, e ela é a que fecha a mutação: cada chip do painel escreve
  // num campo que `SEM_FILTRO` tem. Um chip novo sem campo cai aqui mesmo que
  // alguém se lembre de acrescentar a legenda à lista de cima.
  it("cada chip do painel escreve num campo que existe em Filtros", async () => {
    semeiaLocal();
    monta();
    await abrir();
    const chips = Array.from(document.querySelectorAll(".filtro-painel .chip"));
    expect(chips.length).toBe(2); // anti-vacuidade: os chips estão na tela
    for (const chip of chips) {
      await act(async () => { (chip as HTMLElement).click(); });
    }
    const guardado = JSON.parse(localStorage.getItem(CHAVE_FILTROS)!);
    expect(Object.keys(guardado).sort()).toEqual(Object.keys(SEM_FILTRO).sort());
    // E os dois toques mudaram alguma coisa de verdade — senão um chip inerte
    // passaria por aqui sem ser notado.
    expect(guardado).not.toEqual(SEM_FILTRO);
  });
});

// 🔴 O describe "os chips de piso" morreu aqui (2026-08-27) — TRÊS testes:
//   1. o chip `barro` NÃO aparece, e a contagem bate com `PISOS_FILTRAVEIS`;
//   2. o rótulo passa pelo `rotuloPiso` (senão o chip mostra o hífen);
//   3. a legenda diz "no mínimo" (sem isso lê-se como "SÓ asfalto tapete").
// Os três provavam um grupo de chips que não existe mais na tela. A prova de
// FONTE deles morreu no describe "o que o jsdom não vê", logo abaixo.
//
// ⚠️ A lição do (1) é a que sobreviveu, e ela DECIDIU esta rodada: um chip que
// acende, conta na linha de resumo e não muda a lista é defeito. Foi por ela
// que o chip do carro não entrou no lugar do piso — as duas fichas respondem
// "sim", então ele seria o `barro` de novo com outro nome.

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

  // 🔴 "os chips de piso saem de PISOS_FILTRAVEIS" morreu aqui (2026-08-27):
  // não há chips de piso, e `PISOS_FILTRAVEIS` saiu de `src/lib/piso.ts`. A
  // razão dela continua valendo pras irmãs deste bloco — em runtime uma lista
  // derivada e uma copiada à mão são o MESMO VALOR, e só a fonte separa.
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

  // Tocou o chip `leve`, depois o de piso, e desde 2026-08-27 o de custo. O que
  // se prova aqui não é o recorte, é a tela obedecer com a gravação estourando.
  it("escrita que estoura ao ligar um recorte: o filtro vale nesta sessão", async () => {
    monta();
    await abrir();
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      const c = chipDeClique();
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
