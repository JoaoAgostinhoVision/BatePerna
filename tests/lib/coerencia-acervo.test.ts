import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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
 *  `tests/lib/coerencia.test.ts`, onde há uma quebra escrita pra cada uma das
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
  // arquivo: todo guarda DE ACERVO abaixo lê `violacoes`, que é um laço sobre
  // `fichas` (a costura com o módulo e os dois guardas do `src/` no fim do bloco
  // não dependem dele). Com o acervo vazio, ou com a semente não tendo entrado
  // no banco, **todos esses passariam** — a espécie "prova que
  // passa por não ter o que provar". O número é cravado e cresce a mão junto com
  // o acervo, de propósito: `fichas.length` contra si mesmo não prova nada.
  it("o acervo tem conteúdo pra varrer — sem isto, todo guarda de acervo abaixo passa vazio", () => {
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
    "janela-dentro-do-provedor",
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

  it("nenhuma ficha real pede janela além do que o provedor de chuva aceita", () => {
    expect(
      das("janela-dentro-do-provedor"),
      "a busca da tela inicial é uma só, com a maior janela do acervo: uma ficha acima do teto tira a chuva de todos os lugares",
    ).toEqual([]);
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

  // 🔴 NÃO-VACUIDADE: as regras dos testes abaixo só disparam nas fichas que
  // TÊM o campo. Com zero fichas declarando dias, todos passariam vazios — a espécie
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

/** 🔴 A CADEIA DE WAYPOINTS — quem a lê, e quem tem de continuar no LUGAR.
 *
 *  `src/types/ficha.ts` declara `waypoints: z.array(...).min(1)`. Até a Tarefa 10
 *  do painel completo (2026-10-01) **nenhum leitor do `src/` lia além do
 *  `[0]`**, e este bloco guardava isso com dois testes: um que media a cegueira
 *  do `src/` e outro que proibia o acervo de ter 2º ponto — porque um ponto que
 *  carrega, valida e nunca aparece na tela era conteúdo DELE perdido calado.
 *
 *  🔴 A TAREFA 10 ENSINOU A TELA A LER A CADEIA (spec §6), e os dois mudaram de
 *  natureza, exatamente como o comentário antigo mandava:
 *   - "nenhuma ficha do acervo tem 2º waypoint" **caiu a mão**: a razão dela era
 *     a cegueira, e a cegueira acabou no bloco Trajeto da ficha;
 *   - "o `src/` continua cego ao waypoint 2" **inverteu**: agora prova que o
 *     bloco Trajeto ENXERGA a cadeia, e que os arquivos que falam DO LUGAR
 *     continuam no `[0]`.
 *
 *  🔴 A DISTINÇÃO QUE DECIDE TUDO: `waypoints[0]` é O LUGAR; `waypoints[1..]`
 *  são AS ETAPAS DO CAMINHO até ele. O nome na home, o pin do mapa, a ordem do
 *  acervo, a distância "daqui", o nome nas frases da coerência — todos falam do
 *  lugar. Um deles aprendendo a ler a cadeia sem alguém pensar no assunto é o
 *  defeito que a R7 da spec descreve: a home mostrando o nome de uma etapa do
 *  caminho em vez do nome do destino.
 *
 *  🔴 E O GUARDA LÊ PELO PARSER DO TYPESCRIPT, não por regex. O guarda anterior
 *  tirava comentário com regex e casava `waypoints[...]` em texto — e esse
 *  desenho tem dois furos catalogados neste projeto: a tira que come o arquivo
 *  (espécie 44) e a leitura que não tem colchete (`waypoints.map(...)`,
 *  `waypoints.slice(1)`, `const { waypoints } = ...`), que a regex nunca viu. O
 *  parser não confunde comentário nem string com código.
 *
 *  ⚠️ O QUE ELE VÊ, e não "toda forma" (a redação anterior dizia isso, e a
 *  revisão da Tarefa 10 mediu duas que escapavam): o token `waypoints` como
 *  propriedade (`x.waypoints`), como identificador solto (destruturação,
 *  variável), e como CHAVE de acesso por colchete em string ou em template
 *  literal sem substituição (`x["waypoints"]`, `` x[`waypoints`] `` — esta
 *  fechada na onda de conserto 1). O que ele NÃO vê, de propósito, e está
 *  escrito pra não virar esquecimento: acesso SEM o nome — `Object.values(
 *  trajeto)[0][1]`, chave montada (`x["way" + "points"]`) — e um helper de um
 *  arquivo que edita a cadeia, importado por um que fala do lugar (o guarda
 *  olha o token dentro de cada arquivo). As três exigem código deliberadamente
 *  evasivo; cercá-las pediria análise de tipos, não de texto. */
describe("a cadeia de waypoints — o bloco Trajeto a lê, e o que fala do LUGAR continua no [0]", () => {
  const SRC = path.join(process.cwd(), "src");

  function arquivosDeFonte(dir: string): string[] {
    return readdirSync(dir).flatMap((entrada) => {
      const p = path.join(dir, entrada);
      if (statSync(p).isDirectory()) return arquivosDeFonte(p);
      return /\.tsx?$/.test(entrada) ? [p] : [];
    });
  }

  const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");
  const ARQUIVOS = arquivosDeFonte(SRC).map((f) => ({ arquivo: rel(f), fonte: readFileSync(f, "utf8") }));

  // ───────────────────────────────────────────────────────────────────────────
  // O MOLDE — este caso continua igual desde a Task 1 e é independente da
  // inversão: `src/lib/campos-da-ficha.ts` escreve `trajeto.waypoints[].nome`,
  // o MOLDE do registro, dentro de uma string. Ele vive aqui porque mede o mesmo
  // texto; a tira de comentários dele é a mesma de antes.
  // ───────────────────────────────────────────────────────────────────────────
  const semComentario = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const molde = ARQUIVOS.flatMap(({ arquivo, fonte }) =>
    [...semComentario(fonte).matchAll(/waypoints\s*\[([^\]]*)\]/g)]
      .filter((m) => m[1].trim() === "")
      .map(() => arquivo),
  );

  it("colchete vazio é o MOLDE do registro de campos, e só mora lá", () => {
    expect(
      [...new Set(molde)],
      "`waypoints[]` fora do registro de campos: ou é molde em lugar errado, ou " +
        "é a tira de comentários deixando passar coisa que não é molde",
    ).toEqual(["src/lib/campos-da-ficha.ts"]);
    expect(molde).toHaveLength(4); // nome, lat, lng, nota
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A CLASSIFICAÇÃO — fechada. Todo arquivo do `src/` que TOCA a lista de
  // waypoints mora em exatamente uma destas três, e um arquivo novo que a toque
  // fica vermelho até alguém decidir onde ele mora.
  // ───────────────────────────────────────────────────────────────────────────

  /** Os que falam DO LUGAR: toda leitura é `waypoints[0]`, e só isso. São os
   *  sete que a spec §6 lista (fora o `page.tsx`, que é misto) MAIS a
   *  `coerencia.ts`, que nasceu depois da spec (Tarefa 3) e lê o `[0]` pro nome
   *  do lugar nas frases das regras — o comentário dela diz por quê — e a
   *  `rascunho.ts` (Tarefa 11), que lê o `[0]` pro nome do lugar novo, e os que
   *  vieram depois, cada um com o porquê na lista. Quantos são não está escrito
   *  aqui: a conta escrita à mão já envelheceu uma vez (dizia 10 e a 11f fez 11). */
  const CEGOS = [
    "src/app/CartaoTrilha.tsx",
    "src/app/ListaDoAcervo.tsx",
    "src/app/MapaHome.tsx",
    "src/app/admin/ListaDeLugares.tsx",
    "src/app/admin/PainelAdmin.tsx",
    // Tarefa 11e: o endereço que o painel oferece é `nome-cidade`, e o nome é o
    // do LUGAR — o ponto `[0]`, a mesma regra de quando o lugar nasce.
    "src/app/admin/[slug]/page.tsx",
    "src/lib/coerencia.ts",
    "src/lib/ficha-fonte.ts",
    "src/lib/geo.ts",
    // Tarefa 11: o nome do rascunho na lista do painel é o do ponto `[0]` — o
    // nome que o dono deu ao LUGAR quando o criou.
    "src/lib/rascunho.ts",
    // Tarefa 11f: a vista do mapa da coordenada da CHUVA começa no ponto `[0]`
    // — o lugar que o dono já marcou —, e só nele.
    "src/lib/vista-do-mapa.ts",
  ];

  /** O MISTO: o `h1` e o cartão de compartilhar falam do lugar (`[0]`), e o
   *  bloco Trajeto fala do caminho (a cadeia). A regra: fora do elemento
   *  `data-bloco="trajeto"`, só `[0]`; dentro dele, a cadeia TEM de ser lida. */
  const MISTO = "src/app/[slug]/page.tsx";

  /** Os que existem PRA EDITAR (ou conferir) a cadeia: o registro de campos
   *  (acrescentar e tirar ponto), a tela do painel que conta os pontos, e a
   *  porta de quem usa que recusa ponto além do `[0]`. Nenhuma regra de
   *  leitura — mas a lista é fechada como as outras. */
  const ENXERGAM = [
    "src/app/admin/FichaInteira.tsx",
    "src/lib/campos-da-ficha.ts",
    // Task 10 (07/10): a porta de quem usa o app olha a cadeia INTEIRA pra
    // RECUSAR o que passa do `[0]` (`chavesForaDaPessoa`: etapa do trajeto não
    // é pergunta dela). Não fala do lugar nem do caminho: confere a lista.
    "src/lib/campos-da-pessoa.ts",
  ];

  type Acesso = { indice: "0" | "cadeia"; noTrajeto: boolean; linha: number };

  /** Toda vez que o código TOCA a lista de waypoints, com o que faz com ela.
   *
   *  - `x.waypoints[0]` (ou `x["waypoints"][0]`, `` x[`waypoints`][0] ``) → `"0"`: o lugar;
   *  - qualquer outra coisa — `[1]`, `[i]`, `.map`, `.slice`, `.length`, o
   *    `const { waypoints } = ...` — → `"cadeia"`. Conservador de propósito:
   *    `.at(0)` também conta como cadeia, e quem quiser o lugar escreve `[0]`.
   *
   *  NÃO É LEITURA, e fica de fora: a chave de um tipo (`waypoints: readonly
   *  ...[]` em `geo.ts`) e a chave de um objeto literal (o `z.object` do schema,
   *  e o documento que `campos-da-ficha.ts` monta). Comentário e string nunca
   *  entram — o parser não os vê como código. */
  function acessosDe(fonte: string, arquivo: string): Acesso[] {
    const sf = ts.createSourceFile(
      arquivo,
      fonte,
      ts.ScriptTarget.Latest,
      true,
      arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const saida: Acesso[] = [];

    const dentroDoTrajeto = (no: ts.Node): boolean => {
      for (let p: ts.Node | undefined = no.parent; p; p = p.parent) {
        if (!ts.isJsxElement(p)) continue;
        const ehTrajeto = p.openingElement.attributes.properties.some(
          (a) =>
            ts.isJsxAttribute(a) &&
            a.name.getText(sf) === "data-bloco" &&
            a.initializer !== undefined &&
            ts.isStringLiteral(a.initializer) &&
            a.initializer.text === "trajeto",
        );
        if (ehTrajeto) return true;
      }
      return false;
    };

    const visitar = (no: ts.Node): void => {
      let expr: ts.Node | null = null;
      if (ts.isIdentifier(no) && no.text === "waypoints") {
        const pai = no.parent;
        const ehChave =
          (ts.isPropertySignature(pai) && pai.name === no) ||
          (ts.isPropertyAssignment(pai) && pai.name === no);
        if (!ehChave) expr = ts.isPropertyAccessExpression(pai) && pai.name === no ? pai : no;
      } else if (
        (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) &&
        no.text === "waypoints" &&
        ts.isElementAccessExpression(no.parent) &&
        no.parent.argumentExpression === no
      ) {
        expr = no.parent;
      }

      if (expr) {
        const pai = expr.parent;
        const ehZero =
          ts.isElementAccessExpression(pai) &&
          pai.expression === expr &&
          ts.isNumericLiteral(pai.argumentExpression) &&
          pai.argumentExpression.text === "0";
        saida.push({
          indice: ehZero ? "0" : "cadeia",
          noTrajeto: dentroDoTrajeto(expr),
          linha: sf.getLineAndCharacterOfPosition(expr.getStart(sf)).line + 1,
        });
      }
      ts.forEachChild(no, visitar);
    };
    visitar(sf);
    return saida;
  }

  /** O VEREDITO, separado da varredura pra poder ser provado com entrada
   *  sintética (os casos "o guarda acusa…" lá embaixo). Devolve a lista de
   *  problemas; vazia é verde. */
  function problemas(porArquivo: ReadonlyMap<string, readonly Acesso[]>): string[] {
    const saida: string[] = [];
    const classificados = [...CEGOS, MISTO, ...ENXERGAM].sort();
    const tocam = [...porArquivo].filter(([, a]) => a.length > 0).map(([f]) => f).sort();

    for (const f of tocam) {
      if (!classificados.includes(f)) {
        saida.push(
          `${f} toca a lista de waypoints e não está classificado: decida se ele fala do ` +
            "LUGAR (CEGOS, só `[0]`), do CAMINHO (o bloco Trajeto) ou se EDITA a cadeia (ENXERGAM).",
        );
      }
    }
    for (const f of classificados) {
      if (!tocam.includes(f)) {
        saida.push(`${f} está classificado e não toca mais a lista: a classificação ficou velha.`);
      }
    }
    for (const f of CEGOS) {
      for (const a of porArquivo.get(f) ?? []) {
        if (a.indice !== "0") {
          saida.push(
            `${f}:${a.linha} lê a CADEIA, e este arquivo fala do LUGAR. \`waypoints[0]\` é o ` +
              "lugar; do `[1]` em diante são etapas do caminho até ele (spec §6, R7).",
          );
        }
      }
    }
    const misto = porArquivo.get(MISTO) ?? [];
    for (const a of misto) {
      if (a.indice !== "0" && !a.noTrajeto) {
        saida.push(`${MISTO}:${a.linha} lê a cadeia FORA do bloco Trajeto — só ele fala do caminho.`);
      }
    }
    if (!misto.some((a) => a.indice === "cadeia" && a.noTrajeto)) {
      saida.push(`${MISTO}: o bloco Trajeto não lê mais a cadeia — as etapas sumiriam da ficha.`);
    }
    if (!misto.some((a) => a.indice === "0" && !a.noTrajeto)) {
      saida.push(`${MISTO}: fora do bloco Trajeto ninguém lê mais o \`[0]\` — o nome do lugar saiu de lá?`);
    }
    return saida;
  }

  const REAL = new Map(ARQUIVOS.map(({ arquivo, fonte }) => [arquivo, acessosDe(fonte, arquivo)] as const));

  it("a varredura enumera o `src/` de verdade — e o número sai impresso", () => {
    // 🔴 NÃO-VACUIDADE: uma varredura que enumera ZERO arquivos deixa o veredito
    // abaixo sem nada pra ler (espécie catalogada). O piso é folgado; a prova
    // que fecha é o veredito exigir que CADA arquivo classificado seja achado.
    console.log(`[guarda da cadeia] arquivos enumerados em src/: ${ARQUIVOS.length}`);
    expect(ARQUIVOS.length, "a varredura do src/ ficou oca").toBeGreaterThanOrEqual(80);
    expect(ARQUIVOS.map((a) => a.arquivo)).toContain(MISTO);
  });

  it("o bloco Trajeto lê a cadeia, e o que fala do LUGAR continua no [0]", () => {
    expect(problemas(REAL)).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 🔴 O GUARDA PROVADO VERMELHO, com entrada sintética. Sem isto, um veredito
  // afrouxado ("aceita qualquer arquivo lendo a cadeia", M3 da Tarefa 10) e um
  // `acessosDe` que nunca devolve `cadeia` passariam verdes no caso de cima,
  // porque o `src/` de hoje está certo.
  // ───────────────────────────────────────────────────────────────────────────
  const com = (troca: Record<string, string>): Map<string, Acesso[]> => {
    const m = new Map(REAL);
    for (const [arquivo, fonte] of Object.entries(troca)) m.set(arquivo, acessosDe(fonte, arquivo));
    return m;
  };

  it("a leitura: `[0]` é o lugar; `[1]`, `.map`, `.slice`, `.length` e destruturação são a cadeia", () => {
    const de = (fonte: string) => acessosDe(fonte, "x.ts").map((a) => a.indice);
    expect(de("f.trajeto.waypoints[0].nome")).toEqual(["0"]);
    expect(de('f.trajeto["waypoints"][0].nome')).toEqual(["0"]);
    // 🔴 m1 da revisão da Tarefa 10: a chave em template literal SEM
    // substituição é a mesma string — e passava invisível.
    expect(de("f.trajeto[`waypoints`][0].nome")).toEqual(["0"]);
    expect(de("f.trajeto[`waypoints`][1].nome")).toEqual(["cadeia"]);
    expect(de("f.trajeto.waypoints[1].nome")).toEqual(["cadeia"]);
    expect(de("f.trajeto.waypoints[i].nome")).toEqual(["cadeia"]);
    expect(de("f.trajeto.waypoints.map((w) => w.nome)")).toEqual(["cadeia"]);
    expect(de("f.trajeto.waypoints.slice(1)")).toEqual(["cadeia"]);
    expect(de("f.trajeto.waypoints.length")).toEqual(["cadeia"]);
    expect(de("const { waypoints } = f.trajeto;")).toEqual(["cadeia"]);
    // e o que NÃO é leitura: comentário, string, chave de tipo e de objeto
    expect(de("// f.trajeto.waypoints[1]\n/* waypoints.map */ const s = 'waypoints[2]';")).toEqual([]);
    expect(de("type T = { waypoints: number[] }; const o = { waypoints: [] };")).toEqual([]);
  });

  it("o guarda acusa um arquivo do LUGAR que aprende a ler a cadeia", () => {
    const fonte = "export const n = (f) => f.trajeto.waypoints[1].nome;";
    expect(problemas(com({ "src/app/CartaoTrilha.tsx": fonte })).join("\n")).toMatch(
      /CartaoTrilha\.tsx:1 lê a CADEIA/,
    );
    const lista = "export const n = (f) => f.trajeto.waypoints.map((w) => w.nome);";
    expect(problemas(com({ "src/lib/ficha-fonte.ts": lista })).join("\n")).toMatch(/ficha-fonte\.ts:1 lê a CADEIA/);
  });

  it("o guarda acusa um arquivo NOVO que toca a lista sem ser classificado", () => {
    const fonte = "export const n = (f) => f.trajeto.waypoints[0].nome;";
    // O caminho é MONTADO, e não escrito por extenso, porque o arquivo não existe
    // de propósito — escrito inteiro, o guarda de `tests/smoke.test.ts` (que
    // exige que todo caminho citado exista) o leria como referência morta.
    const novo = ["src", "app", "Novo.tsx"].join("/");
    expect(problemas(com({ [novo]: fonte })).join("\n")).toMatch(/Novo\.tsx toca a lista/);
  });

  it("o guarda acusa a página que lê a cadeia FORA do bloco Trajeto", () => {
    const fonte = [
      "export default function P({ f }) {",
      "  const etapas = f.trajeto.waypoints.slice(1);",
      "  const lugar = f.trajeto.waypoints[0];",
      '  return <div><h1>{lugar.nome}</h1><div data-bloco="trajeto">{f.trajeto.waypoints.length}</div></div>;',
      "}",
    ].join("\n");
    expect(problemas(com({ [MISTO]: fonte }))).toEqual([
      `${MISTO}:2 lê a cadeia FORA do bloco Trajeto — só ele fala do caminho.`,
    ]);
  });

  it("o guarda acusa a página cujo bloco Trajeto voltou a ler só o [0]", () => {
    const fonte = [
      "export default function P({ f }) {",
      "  const wp = f.trajeto.waypoints[0];",
      '  return <div data-bloco="trajeto">{wp.nome}</div>;',
      "}",
    ].join("\n");
    expect(problemas(com({ [MISTO]: fonte })).join("\n")).toMatch(/o bloco Trajeto não lê mais a cadeia/);
  });

  it("o guarda acusa a varredura que não acha nada", () => {
    expect(problemas(new Map()).length, "zero arquivos não pode ser verde").toBeGreaterThanOrEqual(
      CEGOS.length + 1 + ENXERGAM.length,
    );
  });
});
