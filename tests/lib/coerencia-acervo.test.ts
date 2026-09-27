import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getAllFichas } from "@/lib/ficha";
import { bancoDeProducao } from "../banco";
import { PRECO, REGRAS, violacoesDoAcervo } from "@/lib/coerencia";

/** 🔴 POR QUE ESTE ARQUIVO EXISTE — e é uma medição, não uma intuição.
 *
 *  Na entrada da 3ª ficha (Cachoeira Véu de Noiva, 2026-09-03) uma auditoria
 *  aplicou **19 mutações** no conteúdo real e no código que o serve. **14
 *  sobreviveram** a 751/751 verde, e não era dispersão: era um padrão só.
 *
 *  **Toda prova sobre conteúdo real deste repositório está endereçada por SLUG
 *  ESCRITO À MÃO.** `veu-de-noiva-de-bonito` não aparecia em nenhum arquivo de
 *  teste. A única exceção era o guarda do `carroComum === false` — que varre o
 *  acervo inteiro, e foi justamente o único que **mudou de comportamento** com
 *  a ficha nova. Esse guarda é o molde deste arquivo.
 *
 *  As quatro mutações que doíam, e que os testes abaixo matam:
 *   - apagar `horario` da 3ª ficha → às 18h ela volta a dizer "Pode ir" num
 *     lugar fechado desde as 17h: a rodada inteira de 2026-08-27 desfeita **por
 *     conteúdo**;
 *   - `custo.curto: "R$ 1 · entrada"` num lugar que cobra R$ 10 → o chip do topo
 *     anuncia **um décimo** do preço. É o defeito dos centavos entrando pelo
 *     JSON, depois de ter sido fechado no código;
 *   - copiar o `secaRapido` da Rampa pra cachoeira → o app diz *"a serra
 *     firmou"* sobre uma cachoeira do brejo: a mentira de 2026-08-26
 *     reintroduzida por conteúdo;
 *   - `piso: "asfalto-tapete"` numa ficha cuja própria prosa diz **barro** cinco
 *     vezes.
 *
 *  ⚠️ **A régua deste arquivo: nada aqui afirma sobre um lugar.** Todo teste é
 *  sobre a ficha ser coerente **consigo mesma** ou distinta das outras. Um
 *  guarda que soubesse que a Véu de Noiva é de barro seria a geografia
 *  inventada com roupa de teste — e morreria no dia em que o João mudasse o
 *  dado. Ver `docs/RESUME.md` e o agente `.claude/agents/prova-que-trava.md`.
 *
 *  🔴 **2026-09-26 — AS REGRAS SAÍRAM DAQUI E VIRARAM `src/lib/coerencia.ts`.**
 *  Elas eram TESTES, e teste roda no computador do desenvolvedor, antes do
 *  deploy: um lugar que o João editar do celular numa terça de manhã nunca
 *  passaria por nenhuma delas. Agora são código de produção, chamado pela porta
 *  de escrita do painel, que recusa a gravação e mostra a frase da violação.
 *
 *  **O QUE ESTE ARQUIVO PROVA HOJE, e continua sendo necessário:** que o ACERVO
 *  REAL — o que está no BANCO, pelo caminho de produção inteiro — não viola
 *  nenhuma delas. Cada caso abaixo tem o MESMO nome que tinha, e a justificativa
 *  de cada regra (o defeito real que a motivou) **viajou junto com ela** pro
 *  módulo: está lá, ao lado do código que a implementa, e não foi perdida nem
 *  duplicada aqui. Quem vier "simplificar" uma regra lê o porquê no lugar onde
 *  ela mora.
 *
 *  Que o MÓDULO ainda sabe ACUSAR é outra pergunta, e ela tem outro arquivo:
 *  `tests/lib/coerencia.test.ts`, onde há uma quebra escrita pra cada uma das 13
 *  regras. Um módulo que devolvesse `[]` pra tudo passaria aqui com louvor. */

// O acervo vem do BANCO desde 2026-09-25 — semeado a partir de
// `content/fichas/`, que continua sendo o conteúdo que este arquivo audita.
// No TOPO porque `fichas` é a constante que todo laço daqui varre.
await bancoDeProducao();
const fichas = await getAllFichas();
const pagas = fichas.filter((f) => f.custo.tag === "pago");

/** As violações do acervo real, calculadas UMA vez. Cada caso abaixo filtra as
 *  suas — e nunca pergunta "tem violação?", que ficaria verde quando uma regra
 *  diferente da que o caso testa fosse a que disparou. */
const violacoes = violacoesDoAcervo(fichas);
const das = (...regras: string[]) =>
  violacoes.filter((v) => regras.includes(v.regra)).map((v) => v.frase);

describe("coerência do acervo — varre TODAS as fichas, nunca uma lista de slugs", () => {
  // 🔴 NÃO-VACUIDADE, e ela é load-bearing aqui mais que em qualquer outro
  // arquivo: todo teste abaixo é um laço sobre `fichas`. Com o acervo vazio, ou
  // com a semente não tendo entrado no banco, **todos passariam** — a espécie "prova que
  // passa por não ter o que provar". O número é cravado e cresce a mão junto com
  // o acervo, de propósito: `fichas.length` contra si mesmo não prova nada.
  it("o acervo tem conteúdo pra varrer — sem isto, todo laço abaixo passa vazio", () => {
    expect(fichas.length, "o acervo sumiu: os guardas deste arquivo ficariam ocos").toBeGreaterThanOrEqual(3);
    expect(pagas.length, "sumiu a ficha paga: os guardas de custo ficariam ocos").toBeGreaterThanOrEqual(2);
  });

  // 🔴 A COSTURA ENTRE ESTE ARQUIVO E O MÓDULO, e ela nasceu com a extração de
  // 2026-09-26. Cada caso abaixo filtra as violações POR NOME de regra; uma
  // regra nova no módulo que ninguém liste aqui nunca seria conferida contra o
  // acervo real — e a falha seria silenciosa, porque nenhum caso ficaria
  // vermelho. É a doença da lista escrita à mão cega ao que cresceu, que este
  // projeto já pagou três vezes; aqui ela é fechada por medição.
  const COBERTAS = [
    "preco-legivel-no-custo",
    "chip-bate-com-preco",
    "chip-cabe-na-pilula",
    "chip-nao-repete-a-linha",
    "frase-emprestada",
    "texto-emprestado",
    "prosa-bate-com-piso",
    "horario-invertido-sem-aviso",
    "hora-de-fechar-sem-campo",
    "prosa-bate-com-hora-de-fechar",
    "janela-nao-zerada",
    "dia-repetido-ou-inventado",
    "semana-inteira-nao-declara",
  ];

  it("todas as regras do módulo são conferidas contra o acervo real, uma a uma", () => {
    expect(
      [...REGRAS].filter((r) => !COBERTAS.includes(r)),
      "regra do módulo que nenhum caso deste arquivo confere contra o acervo real",
    ).toEqual([]);
    expect(
      COBERTAS.filter((r) => !REGRAS.includes(r)),
      "caso deste arquivo apontando pra uma regra que não existe mais no módulo: " +
        "ele passaria verde para sempre, filtrando o que nunca aparece",
    ).toEqual([]);
  });

  it("em toda ficha paga, o preço do CHIP é o mesmo preço da linha completa", () => {
    expect(
      das("preco-legivel-no-custo", "chip-bate-com-preco"),
      "a pessoa lê o chip antes de sair de casa e o ticket só quando chega.",
    ).toEqual([]);
  });

  it("o chip cabe na pílula e não repete a linha inteira", () => {
    expect(das("chip-cabe-na-pilula", "chip-nao-repete-a-linha")).toEqual([]);
  });

  it("nenhuma ficha empresta o secaRapido de outra — a frase é do lugar", () => {
    expect(
      das("frase-emprestada"),
      "duas fichas explicando o relevo com a MESMA frase: ou uma delas está " +
        "falando do lugar da outra, ou a frase é genérica e não devia estar na ficha.",
    ).toEqual([]);
  });

  it("nenhuma ficha empresta a voz, a promessa, o prêmio ou a etiqueta de outra", () => {
    expect(
      das("texto-emprestado"),
      "o texto foi copiado entre fichas — ele existe pra distinguir um lugar do outro",
    ).toEqual([]);
  });

  it("a prosa da ficha não nomeia um piso diferente do que o campo declara", () => {
    expect(
      das("prosa-bate-com-piso"),
      "uma das duas está errada, e a tela mostra as duas juntas.",
    ).toEqual([]);
  });

  it("horário invertido só passa se a prosa da ficha disser que atravessa a noite", () => {
    expect(
      das("horario-invertido-sem-aviso"),
      "o app vai anunciá-la aberta a noite toda e fechada o dia todo. Se for de " +
        "propósito, diga isso na prosa da ficha; se não for, os dois campos estão trocados.",
    ).toEqual([]);
  });

  it("quando a prosa cita a hora de fechar, ela bate com o campo", () => {
    expect(
      das("hora-de-fechar-sem-campo", "prosa-bate-com-hora-de-fechar"),
      "as duas frases aparecem na mesma tela.",
    ).toEqual([]);
  });

  it("nenhuma ficha real tem janela de chuva zerada — regra que nunca fecha não é regra", () => {
    expect(das("janela-nao-zerada")).toEqual([]);
  });

  // 🔴 ESTE GUARDA SUBSTITUI, EM 2026-09-27, O "o regex de preço daqui é o mesmo
  //  que a página usa pra montar o chip" — e a troca é de NATUREZA, não de forma.
  //
  //  O antigo comparava DUAS CÓPIAS à mão do mesmo regex (uma neste arquivo, uma
  //  em `page.tsx`), justificado por "o teste não deve importar a implementação
  //  que audita". Aquele argumento morreu com a extração das regras pro módulo:
  //  as duas cópias passaram a ser as duas DE PRODUÇÃO, e o teste auditava uma
  //  contra a outra sem que nenhuma fosse a fonte. A `page.tsx` agora IMPORTA o
  //  `PRECO` de `src/lib/coerencia.ts` — é server component e já importava
  //  `@/lib/piso`, `@/lib/semana` e `@/lib/ficha`, então nada impedia —, e com
  //  uma cópia só a classe de defeito do `R$ 12,50` deixa de existir por
  //  construção. O guarda antigo foi apagado por não ter mais o que guardar.
  //
  //  O que sobra pra guardar é OUTRA COISA: que ninguém reinline a cópia de
  //  volta. Por isso a conta é de OCORRÊNCIAS no `src/` inteiro, e o número é 1.
  //  Comentário fora pela mesma razão do bloco do waypoint lá embaixo — o
  //  comentário do `PRECO` cita o regex antigo em prosa, e um guarda que lê
  //  comentário não guarda nada.
  it("o texto do regex de preço aparece UMA vez só em todo o src/", () => {
    const SRC = path.join(process.cwd(), "src");
    const semComentario = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    function arquivos(dir: string): string[] {
      return readdirSync(dir).flatMap((e) => {
        const p = path.join(dir, e);
        if (statSync(p).isDirectory()) return arquivos(p);
        return /\.tsx?$/.test(e) ? [p] : [];
      });
    }
    const todos = arquivos(SRC);
    expect(todos.length, "não varreu arquivo nenhum do src/ — o guarda ficaria oco")
      .toBeGreaterThanOrEqual(60);
    const onde = todos
      .filter((f) => semComentario(readFileSync(f, "utf8")).includes(PRECO.source))
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));
    expect(
      onde,
      "o texto do regex de preço voltou a aparecer em mais de um lugar do `src/` (ou " +
        "saiu do módulo): duas fontes pro mesmo fato, que é exatamente o que a " +
        "importação de 2026-09-27 fechou. Quem precisa do regex IMPORTA `PRECO`.",
    ).toEqual(["src/lib/coerencia.ts"]);
  });

  // NÃO-VACUIDADE do guarda acima: sem isto, renomear `precoCurto` na página (ou
  // a página deixar de montar o chip) passaria sem ninguém notar, e o guarda
  // continuaria verde provando só que o módulo tem o regex.
  it("a página continua montando o chip a partir do PRECO importado", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "[slug]", "page.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "a tira de comentários comeu o arquivo — as asserções abaixo ficariam vazias")
      .toContain("precoCurto");
    expect(src, "a página parou de importar o PRECO: ou reinlinou o regex, ou o chip mudou de fonte")
      .toContain('from "@/lib/coerencia"');
    expect(src, "a página não usa mais o PRECO importado pra extrair o preço do custo")
      .toContain("match(PRECO)");
  });
});

/** 🔴 OS DIAS DA SEMANA — e o único campo do acervo cuja fonte NÃO é ele.
 *
 *  `dias` entrou em 2026-09-11, e a resposta da Rampa do Pepê veio da INTERNET,
 *  com autorização dele (*"pode atualizar a hora pela internet"*). Isso muda o
 *  que um guarda pode fazer aqui: em todo outro campo, um teste que soubesse o
 *  dado seria geografia inventada com roupa de prova. **Aqui também** — então
 *  nada abaixo afirma em QUE dias um lugar abre.
 *
 *  O que dá pra provar é a COERÊNCIA, que é a régua deste arquivo inteiro. */
describe("os dias da semana, no acervo", () => {
  const comDias = fichas.filter((f) => f.dias?.length);

  // 🔴 NÃO-VACUIDADE: os testes abaixo são laços sobre as fichas que TÊM o
  // campo. Com zero fichas declarando dias, todos passariam vazios — a espécie
  // "prova que passa por não ter o que provar". O número é cravado a mão, como
  // o do topo deste arquivo.
  it("alguma ficha exercita o campo — senão os guardas abaixo ficam ocos", () => {
    expect(
      comDias.length,
      "nenhuma ficha declara dias: o eixo do dia virou máquina sem uso, que é " +
        "exatamente o que o `modos` é hoje.",
    ).toBeGreaterThanOrEqual(1);
  });

  it("nenhuma ficha repete um dia nem inventa um nome de dia", () => {
    expect(das("dia-repetido-ou-inventado")).toEqual([]);
  });

  it("nenhuma ficha declara a semana inteira — isso é o mesmo que não declarar", () => {
    expect(
      das("semana-inteira-nao-declara"),
      "o campo não muda veredito nenhum e some da ficha sem perda nenhuma.",
    ).toEqual([]);
  });
});

/** 🔴 O 2º WAYPOINT — a cadeia que o schema aceita e a tela engole em silêncio.
 *
 *  `src/types/ficha.ts` declara `waypoints: z.array(...).min(1)`. **Nenhum
 *  leitor do `src/` lê além do `[0]`**: o cartão da home, o pin do mapa, a
 *  lista de `/trilhas`, o cabeçalho da ficha e a medição de distância pegam
 *  todos o primeiro ponto e param ali. Uma ficha com três waypoints carrega,
 *  valida, passa na suíte — e o app mostra **um**. Os pontos 2 e 3 somem sem
 *  erro, sem log, sem nada na tela: a espécie "dado que carrega, valida, tem
 *  teste — e nunca aparece" (2026-09-09), agora com o agravante de que o dado
 *  seria conteúdo DELE, escrito à mão e perdido calado.
 *
 *  ⚠️ Isto **não é um teste de produto**: não decide que o app deve mostrar a
 *  cadeia nem que não deve. Ele só impede que a decisão seja tomada por
 *  omissão, no dia em que uma ficha nova tiver dois pontos.
 *
 *  🔴 E ele guarda a PRÓPRIA JUSTIFICATIVA, que é a lição de 2026-09-03 ("o
 *  guarda prova que a pergunta existe, nunca que a justificativa dela ainda é
 *  verdadeira"): o primeiro teste abaixo mede se o `src/` continua cego ao
 *  `[1..]`. No dia em que alguém ENSINAR a tela a ler a cadeia, ele fica
 *  vermelho primeiro — e aí o segundo teste é que deve cair, de propósito e a
 *  mão, junto com este comentário.
 */
describe("o 2º waypoint — o acervo não pode ter cadeia enquanto ninguém a lê", () => {
  const SRC = path.join(process.cwd(), "src");

  function arquivosDeFonte(dir: string): string[] {
    return readdirSync(dir).flatMap((entrada) => {
      const p = path.join(dir, entrada);
      if (statSync(p).isDirectory()) return arquivosDeFonte(p);
      return /\.tsx?$/.test(entrada) ? [p] : [];
    });
  }

  /** Comentário fora, e pelos dois motivos já pagos neste repositório: o bloco
   *  de `geo.ts` cita `trajeto.waypoints[0]` em prosa (a espécie "guarda de
   *  fonte lendo o COMENTÁRIO"), e uma linha comentada com `waypoints[1]`
   *  acusaria um leitor que não existe. O preço da tira é a espécie
   *  "tira-de-comentários que come o arquivo" — por isso a contagem abaixo. */
  const semComentario = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const acessos = arquivosDeFonte(SRC).flatMap((f) =>
    [...semComentario(readFileSync(f, "utf8")).matchAll(/waypoints\s*\[([^\]]*)\]/g)].map((m) => ({
      arquivo: path.relative(process.cwd(), f).split(path.sep).join("/"),
      indice: m[1].trim(),
    })),
  );

  // 🔴 2026-09-26 (Task 1 do painel completo): `src/lib/campos-da-ficha.ts`
  //  escreve `trajeto.waypoints[].nome` — o MOLDE do registro de campos, dentro
  //  de uma string. Colchete VAZIO não lê índice nenhum (`waypoints[]` nem é
  //  indexação válida em JS: quem lê a cadeia escreve um índice ali dentro), e
  //  o registro guarda molde de propósito, porque quantos waypoints uma ficha
  //  tem é DADO e não código. Então o molde sai da conta de LEITURAS — e, pra
  //  ele não virar esconderijo de um leitor de verdade, o teste logo abaixo
  //  prova que colchete vazio só existe naquele arquivo.
  const molde = acessos.filter((a) => a.indice === "");
  const leituras = acessos.filter((a) => a.indice !== "");

  it("colchete vazio é o MOLDE do registro de campos, e só mora lá", () => {
    expect(
      [...new Set(molde.map((a) => a.arquivo))],
      "`waypoints[]` fora do registro de campos: ou é molde em lugar errado, ou " +
        "é a tira de comentários deixando passar coisa que não é molde",
    ).toEqual(["src/lib/campos-da-ficha.ts"]);
    expect(molde.map((a) => a.indice)).toEqual(["", "", "", ""]); // nome, lat, lng, nota
  });

  it("o `src/` continua cego ao waypoint 2 em diante — a premissa do guarda abaixo", () => {
    // NÃO-VACUIDADE: sem este número, renomear o campo (ou a tira comer o
    // arquivo) deixa `leituras` vazio e o laço seguinte passa sem ler nada.
    // Cravado a mão de propósito, como o `fichas.length` no topo.
    expect(
      leituras.length,
      "nenhum acesso a `waypoints[...]` no src/ — ou o campo mudou de nome, ou a " +
        "tira de comentários comeu os arquivos. O teste abaixo ficaria oco.",
    ).toBeGreaterThanOrEqual(7);

    const alem = leituras.filter((a) => a.indice !== "0");
    expect(
      alem.map((a) => `${a.arquivo} lê waypoints[${a.indice}]`),
      "alguém ensinou a tela a ler a cadeia de waypoints. Isto é BOA notícia — e " +
        "significa que o guarda seguinte (o acervo só pode ter 1 ponto por ficha) " +
        "perdeu a razão de existir e deve cair a mão, junto com o comentário dele.",
    ).toEqual([]);
  });

  it("nenhuma ficha do acervo tem 2º waypoint — ele sumiria da tela sem aviso", () => {
    for (const f of fichas) {
      const extras = f.trajeto.waypoints.slice(1);
      expect(
        extras.map((w) => w.nome),
        `${f.slug} tem ${f.trajeto.waypoints.length} waypoints e o app mostra só ` +
          `"${f.trajeto.waypoints[0].nome}". Os pontos acima sumiriam da tela sem ` +
          "erro nenhum. Antes de acrescentá-los, a cadeia precisa de um lugar pra " +
          "aparecer — isso é decisão de produto, não conserto de teste.",
      ).toEqual([]);
    }
  });
});
