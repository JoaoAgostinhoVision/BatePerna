import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PISOS } from "@/lib/piso";
import { fichaSchema } from "@/types/ficha";

const DOC = readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8");
const FICHA_RAMPA = readFileSync(
  path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"),
  "utf8",
);

/** Junta as quebras de linha num espaço só. O documento é markdown quebrado a
 *  ~80 colunas, e sem isto toda asserção sobre uma frase vira refém de ONDE a
 *  linha quebrou — uma reflowada inocente derrubaria a suíte sem nada ter
 *  mudado de sentido. */
const plano = (s: string) => s.replace(/\s+/g, " ");

/** O vocabulário de piso, DERIVADO de `PISOS` — `["barro", "paralelepipedo",
 *  "asfalto", "esburacado", "tapete"]`. São os radicais, não os valores do
 *  enum, e a diferença é o que faz o cerco funcionar: a invenção que este
 *  projeto já teve escrevia *"é asfalto liso"* e *"a maior parte do caminho
 *  asfaltada"* — nenhum dos dois é um valor de `PISOS`, os dois contêm
 *  `asfalto`. Sai do enum, e não de uma lista escrita aqui, pelo mesmo motivo
 *  de sempre: lista à mão não envelhece junto com o código. */
const RADICAIS_DE_PISO = [...new Set(PISOS.flatMap((p) => p.split("-")))];

/** Devolve o corpo da SEÇÃO (`## … \`campo\``) até o próximo `## `.
 *
 *  A janela por ocorrência já mentiu neste arquivo, medido: o teste antigo
 *  fatiava a partir do primeiro `` `duracao` `` do documento, que passou a ser
 *  a NOTA DE RODAPÉ ("estes dois campos saíram do questionário"), e casava
 *  `/minuto/i` no texto da nota — verde afirmando uma pergunta que não existe
 *  mais. Ancorar no cabeçalho também é o que dá sentido ao nome do teste: o que
 *  se quer provar é que o campo TEM PERGUNTA PRÓPRIA, não que o nome dele
 *  aparece em algum lugar do arquivo. */
function secaoDoCampo(campo: string): string {
  const cabecalho = new RegExp("^## .*`" + campo + "`\\s*$", "m");
  const achado = DOC.match(cabecalho);
  expect(
    achado,
    `o questionário não tem uma seção "## … \`${campo}\`" — o campo não é perguntado`,
  ).not.toBeNull();
  const resto = DOC.slice(achado!.index! + achado![0].length);
  const fim = resto.indexOf("\n## ");
  return fim === -1 ? resto : resto.slice(0, fim);
}

/** 🔴 O SEGUNDO CORTE, e ele é a correção de um furo medido pela revisão.
 *
 *  A seção inteira era régua grossa demais: dava pra apagar o bullet da opção
 *  `barro` e a suíte fechava 6/6 VERDE, porque a palavra sobrevivia no
 *  parágrafo do exemplo. Dava pra apagar a PERGUNTA INTEIRA do piso — a
 *  redação que desfaz a ambiguidade do "pior trecho" — e a suíte fechava 6/6
 *  verde também, porque `"PIOR"` sobrevivia no exemplo. É a lição 2 aplicada a
 *  texto: num OU implícito (a palavra pode vir da lista OU do exemplo), a
 *  ocorrência que casa primeiro esconde a que sumiu.
 *
 *  Cada bloco rotulado em negrito (`**Pergunta:**`, `**Exemplo (Rampa):**`…) é
 *  uma coisa diferente do documento e tem que ser medido separado. Os bullets
 *  das opções ficam DENTRO do bloco da pergunta de propósito: eles são a
 *  resposta que ela oferece — e ficam porque começam com `- **`, não com `**`
 *  no início de um parágrafo.
 *
 *  🔴 O CORTE É NA FRONTEIRA DE PARÁGRAFO (linha em branco + `**`), não em
 *  qualquer `\n**`, e os dois motivos foram MEDIDOS numa re-revisão:
 *
 *  1. Cortar em `\n**` deixava um FALSO VERDE. Colando a invenção do C1 logo
 *     abaixo do bloco do caso hipotético, sob um rótulo em negrito e sem linha
 *     em branco, o bloco terminava antes dela e o `not.toMatch(/Rampa/)` dizia
 *     que o texto proibido não estava lá — 9/9 verde com a invenção de volta.
 *     Truncar cedo demais deixa asserção POSITIVA vermelha (barulhento, mas
 *     seguro) e asserção NEGATIVA verde (mentira a nosso favor). Este arquivo
 *     tem uma negativa, e era exatamente ela que escapava.
 *  2. Cortar em `\n**` deixava um FALSO VERMELHO. Só re-quebrando as linhas da
 *     pergunta da extensão — sem apagar uma palavra — dois testes ficavam
 *     vermelhos afirmando que uma cláusula sumiu, com ela no lugar. O `plano()`
 *     existe pra isso, mas ele roda DEPOIS daqui: de nada adianta normalizar o
 *     espaço se o recorte já jogou fora metade do texto.
 *
 *  A regex tolera CRLF porque o arquivo é CRLF: `"\n\n**"` literal nunca casa
 *  em `\r\n\r\n**`. */
function blocoDoRotulo(secao: string, rotulo: string): string {
  const inicio = secao.indexOf(`**${rotulo}`);
  expect(inicio, `a seção não tem o bloco "**${rotulo}"`).toBeGreaterThanOrEqual(0);
  const resto = secao.slice(inicio);
  const fim = resto.search(/\r?\n[ \t]*\r?\n\*\*/);
  return fim === -1 ? resto : resto.slice(0, fim);
}

const perguntaDe = (campo: string) => blocoDoRotulo(secaoDoCampo(campo), "Pergunta:");

describe("o questionário cobre a ficha inteira", () => {
  // ⚠️ ESTE TESTE GARANTE MENOS DO QUE O NOME PROMETE, HOJE. Ele varre
  // `fichaSchema.shape`, que durante a EXPANSÃO desta rodada ainda tem
  // `esforco` e `duracao`; os dois já não são perguntados, e o teste passa
  // porque a NOTA DE RODAPÉ do questionário cita os dois nomes entre crases —
  // uma nota que diz textualmente que não são pergunta. Ou seja: para esses
  // dois campos, hoje, ele checa menção, não pergunta.
  //
  // Isso se resolve sozinho na Task 8, quando `esforco` e `duracao` saem do
  // schema: aí o laço deixa de visitá-los e a asserção volta a significar o
  // que diz. Não há máquina a construir aqui — construir uma lista de exceções
  // agora seria código que a Task 8 apaga. Para os campos que importam nesta
  // task (`piso`, `extensaoKm`), quem prova pergunta de verdade é
  // `secaoDoCampo` nos testes abaixo.
  it("todo campo do schema tem pergunta — senão a ficha nova nasce incompleta", () => {
    for (const campo of Object.keys(fichaSchema.shape)) {
      expect(DOC, `faltou pergunta para "${campo}"`).toContain(`\`${campo}\``);
    }
  });

  it("o questionário pergunta os dois campos novos, com o nome do campo", () => {
    // `secaoDoCampo` falha se não existir um `## … \`campo\`` — menção solta na
    // nota de rodapé não serve.
    expect(secaoDoCampo("piso").length).toBeGreaterThan(0);
    expect(secaoDoCampo("extensaoKm").length).toBeGreaterThan(0);
  });

  // 🔴 As QUATRO palavras vêm de `PISOS`, não de uma lista literal escrita
  // aqui: comparar o documento contra uma cópia local não protegeria de o enum
  // mudar e o papel ficar para trás — é a mesma razão que fez
  // `PISOS_FILTRAVEIS` ser derivado (ver tests/lib/piso.test.ts).
  //
  // E a régua é o BLOCO DA PERGUNTA, não a seção: contra a seção inteira,
  // apagar o bullet do `barro` deixava a suíte verde, porque a palavra
  // sobrevivia no exemplo. `barro` é o valor que a única trilha do app tem
  // hoje — some da lista de opções e a resposta vira a menos ruim das três que
  // restaram, ou "terra batida", que o `z.enum` recusa.
  it("a pergunta do piso oferece as QUATRO palavras aceitas, exatamente como o schema as quer", () => {
    const pergunta = perguntaDe("piso");
    for (const palavra of PISOS) {
      expect(pergunta, `a pergunta do piso não oferece a opção "${palavra}"`).toContain(palavra);
    }
  });

  // 🔴 Este teste é o que segura o único achado de conteúdo desta task. Sem
  // ele, dá pra "enxugar" a redação da pergunta — que é longa, e a tentação é
  // real — e reverter sem querer o conserto, com a suíte aplaudindo.
  //
  // As duas cláusulas são medidas separadas porque fecham portas diferentes:
  // "mesmo que ele seja justamente o último" mata a leitura de que a frase
  // manda EXCLUIR o trecho final (na Rampa o pior trecho é o último — era esse
  // o furo), e "não é o piso que predomina" mata a leitura por maioria do
  // caminho. Uma não cobre a outra.
  //
  // Sim, isto prende a redação: reescrever essas frases quebra o teste de
  // propósito. Quem reescrever tem que vir aqui e dizer, por escrito, que a
  // porta continua fechada.
  it("a pergunta do piso diz que é o PIOR trecho, e diz as duas coisas que desfazem a ambiguidade", () => {
    const pergunta = plano(perguntaDe("piso"));
    expect(pergunta).toContain("PIOR");
    expect(pergunta, "sumiu a cláusula que impede excluir o último trecho").toMatch(
      /mesmo que ele seja justamente o último/i,
    );
    expect(pergunta, "sumiu a cláusula que impede responder pelo piso que predomina").toMatch(
      /não é o piso que predomina/i,
    );
  });

  // 🔴 O caso que ENSINA a regra tem que ser um lugar inventado e rotulado
  // como tal. O documento promete no cabeçalho que "todo exemplo abaixo é a
  // resposta real que já existe pra Rampa do Pepê — não é ficção, é o dado que
  // você já deu"; uma versão anterior afirmava, ali, que a estrada da Rampa era
  // asfalto até o pé da serra. A ficha real não tem a palavra "asfalto" uma
  // única vez. Um fato de lugar inventado no arquivo que é a FONTE do dado é a
  // linha vermelha deste projeto.
  it("o caso que ensina a regra é declaradamente inventado, e só os blocos licenciados falam da Rampa e de piso", () => {
    const secao = secaoDoCampo("piso");
    const caso = blocoDoRotulo(secao, "Um caso inventado");
    expect(plano(caso)).toMatch(/hipotético/i);
    // ele só ensina se aterrissar no pior trecho apesar do resto do caminho
    expect(caso).toContain("`barro`");

    // 🔴 A NEGATIVA É SOBRE A SEÇÃO INTEIRA MENOS O BLOCO DO EXEMPLO, e não
    // sobre o bloco do caso hipotético. A versão anterior olhava só o bloco, e
    // isso foi FURADO por medição: colando a invenção sob um rótulo em negrito
    // logo depois do caso, o texto proibido caía fora do recorte e a suíte
    // fechava 9/9 verde com a invenção do C1 de volta. Numa asserção negativa,
    // recortar de menos mente a nosso favor.
    //
    // Escrita assim ela é INDEPENDENTE DE POSIÇÃO: em qualquer lugar da seção
    // do piso, fora do bloco `**Exemplo (Rampa):**` — antes, depois, no meio,
    // com rótulo ou sem —, falar da Rampa é proibido. Um só lugar da seção tem
    // licença de falar dela, e é o que está sob a régua do teste seguinte.
    const foraDoExemplo = secao.replace(blocoDoRotulo(secao, "Exemplo (Rampa):"), "");
    expect(
      foraDoExemplo,
      "só o bloco do Exemplo (Rampa) pode falar da Rampa nesta seção",
    ).not.toMatch(/Rampa/);

    // 🔴 A FRESTA VIZINHA DESSA, e ela foi medida por quem revisou. A negativa
    // acima proíbe a palavra "Rampa"; o cerco de vocabulário do teste seguinte
    // é escopado ao bloco `**Exemplo (Rampa):**`. Entre os dois cabia isto,
    // solto na seção e com linha em branco:
    //
    //     **Nota:** a estrada até o pé da serra é asfalto liso, só a subida é barro.
    //
    // Não diz "Rampa", não está no bloco cercado — 9/9 VERDE, com a invenção do
    // C1 de volta em outra roupa. "Pé da serra" + "asfalto" lê como afirmação
    // sobre a Rampa mesmo sem o nome dela, e essa invenção não é hipótese: é o
    // Critical desta task, que aconteceu e se propagou por quatro arquivos.
    //
    // Na seção do piso, vocabulário de piso só tem licença em TRÊS lugares: a
    // LISTA DE OPÇÕES (as linhas de bullet), o CASO HIPOTÉTICO e o bloco do
    // EXEMPLO (RAMPA) — onde as duas travas do teste seguinte cuidam dele. Em
    // qualquer outro ponto da seção, nomear um piso é descrever o chão de um
    // lugar, e qual é o chão da Rampa fora o pior trecho ninguém disse.
    //
    // MEDIDO ANTES de escrever a asserção, pra não espremer o texto e fazê-lo
    // caber no teste: hoje os três blocos são de fato os únicos com radical de
    // piso na seção. O que sobra — a prosa da pergunta, o "Por que importa" e o
    // "Pular é permitido" — tem ZERO. A palavra "piso" aparece lá, e não é
    // radical; os radicais são os do enum.
    const semLicenca = [
      blocoDoRotulo(secao, "Um caso inventado"),
      blocoDoRotulo(secao, "Exemplo (Rampa):"),
    ]
      .reduce((texto, bloco) => texto.replace(bloco, ""), secao)
      .split(/\r?\n/)
      // a lista de opções: a linha do bullet e a linha indentada que a continua
      .filter((l) => !/^\s*-\s/.test(l) && !/^\s{2,}\S/.test(l))
      .join("\n");
    expect(
      RADICAIS_DE_PISO.filter((r) => semLicenca.includes(r)),
      "a seção nomeia piso fora da lista de opções, do caso hipotético e do exemplo — isso é descrever o chão de um lugar que ninguém descreveu",
    ).toEqual([]);
  });

  // 🔴 O guarda contra a invenção do C1 voltar ao bloco do exemplo. São DUAS
  // travas, porque a invenção sabe entrar por duas portas — e o alcance de
  // cada uma está MEDIDO, não estimado:
  //
  //  (a) CITAÇÃO FABRICADA: toda citação em itálico tem que existir, palavra
  //      por palavra, em `rampa-do-pepe.json`. Medido: inventar uma citação
  //      deixa este teste vermelho, nomeando a citação e o arquivo.
  //
  //  (b) VOCABULÁRIO DE PISO ALÉM DA RESPOSTA: a invenção original não era
  //      citação, era PROSA — *"a estrada até o pé da serra é asfalto"*, *"a
  //      maior parte do caminho asfaltada"*. Medido: com só a trava (a), essa
  //      prosa recolada fechava 9/9 VERDE. O que ela tem de mecanicamente
  //      pegável é o vocabulário: descrever OS OUTROS trechos do caminho exige
  //      nomear outro piso, e quais são os outros pisos da Rampa ninguém
  //      disse. Os radicais saem de `PISOS` (`split("-")`), não de uma lista
  //      escrita aqui, pelo mesmo motivo de sempre — lista à mão não envelhece
  //      junto com o enum.
  //
  // ⚠️ O QUE ESTE TESTE NÃO PEGA, e a frase que dizia o contrário foi apagada
  // depois de medida: invenção em prosa que não use nenhuma palavra de piso —
  // *"a estrada tem 12 km"*, *"o portão fecha às 17h"* — passa verde. As duas
  // travas cobrem a porta por onde a invenção do C1 entrou (prosa sobre o
  // piso do resto do caminho) e a vizinha (citação fabricada); não cobrem
  // "esta frase é verdadeira sobre o mundo", que não é testável. Quem carrega
  // o resto é a ESTRUTURA — o exemplo encolhido a resposta + citações + uma
  // recusa explícita a supor — e a regra humana.
  it("o exemplo da Rampa só cita o que a ficha real diz, e não descreve piso que ninguém deu", () => {
    const exemplo = plano(blocoDoRotulo(secaoDoCampo("piso"), "Exemplo (Rampa):"));
    expect(exemplo, "o exemplo não aterrissa na resposta certa").toContain("`barro`");

    // (a) as citações têm que ser reais
    const citacoes = [...exemplo.matchAll(/\*"([^"]+)"\*/g)].map((m) => m[1]);
    expect(citacoes.length, "o exemplo não cita a ficha — de onde ele tira a resposta?").toBeGreaterThan(0);
    const ficha = plano(FICHA_RAMPA);
    for (const c of citacoes) {
      expect(ficha, `o exemplo cita "${c}", que não está em rampa-do-pepe.json`).toContain(c);
    }

    // (b) o único piso que o exemplo pode nomear é o que ele responde
    const usados = RADICAIS_DE_PISO.filter((r) => exemplo.includes(r));
    expect(
      usados,
      "o exemplo nomeia piso além da resposta — como é o resto da estrada da Rampa ninguém disse",
    ).toEqual(["barro"]);
  });

  // 🔴 Sem "só a ida" com todas as letras, a resposta vem ida e volta: o número
  // sai dobrado e nada no app percebe — nem o schema (é um número positivo
  // válido) nem a tela. É o tipo de erro que só aparece quando alguém caminha.
  it("a pergunta da extensão diz SÓ IDA, com todas as letras", () => {
    const pergunta = plano(perguntaDe("extensaoKm"));
    expect(pergunta).toMatch(/só a ida/i);
    expect(pergunta).toMatch(/não conte a volta/i);
  });

  // 🔴 O campo é a TRILHA — o trecho a pé —, não a estrada de carro até lá, e
  // isso tem que estar na PERGUNTA, não no "Por que importa" (que é a parte
  // que quem responde pula). A seção logo acima, a do piso, acabou de gastar
  // cinco linhas falando da estrada; lidas em sequência, "o trajeto em si"
  // lia como a estrada.
  //
  // O estrago se a resposta vier da estrada: o cartão passa a mostrar
  // "~20 km em linha reta · 27 km de trilha" — dois números em km lado a lado,
  // ambos significando "quão longe fica", o segundo mentindo. É o defeito dos
  // "dois km" da rodada passada com outra roupa. E o filtro inverte: um corte
  // em 5 km esconde justamente a trilha de caminhada curta.
  it("a pergunta da extensão diz que é a trilha a pé, e exclui a estrada de carro", () => {
    const pergunta = plano(perguntaDe("extensaoKm"));
    expect(pergunta, "a pergunta não diz que é o trecho a pé").toMatch(
      /o trecho que se cobre a pé/i,
    );
    expect(pergunta, "a pergunta não exclui a estrada de carro até lá").toMatch(
      /não conte a estrada de carro/i,
    );
  });

  // Os dois campos são `.optional()` no schema, e quem responde precisa saber
  // disso ANTES de inventar um valor pra não deixar em branco — inventar é
  // exatamente o que o aviso no topo do documento proíbe.
  it("as duas perguntas novas dizem que pular é permitido", () => {
    for (const campo of ["piso", "extensaoKm"]) {
      expect(secaoDoCampo(campo), `a seção de \`${campo}\` não diz que dá pra pular`).toMatch(
        /pular é permitido/i,
      );
    }
  });
});
