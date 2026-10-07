import { PISOS } from "@/lib/piso";
import { DIAS } from "@/lib/semana";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";
import type { Ficha } from "@/types/ficha";

/** 🔴 A COERÊNCIA DO ACERVO, EM PRODUÇÃO — e é por isto que ela saiu dos testes.
 *
 *  Estas regras moravam dentro de `tests/lib/coerencia-acervo.test.ts`. Elas
 *  são o que protege o acervo de dizer bobagem sobre um lugar real: o chip de
 *  preço que não bate com o valor, a ficha que empresta a frase de outra, a
 *  prosa que diz "barro" com o campo dizendo asfalto.
 *
 *  **Como teste, elas rodavam no computador do desenvolvedor, antes do
 *  deploy.** Um lugar que o dono editar do celular numa terça de manhã nunca
 *  passaria por nenhuma delas. Migrar os guardas de fonte (do JSON pro banco)
 *  não resolveria nada: o problema não é de ONDE eles leem, é QUANDO eles
 *  rodam. Aqui eles rodam na hora da gravação, e a porta de escrita do painel
 *  recusa o que produzir violação, mostrando a `frase` ao dono.
 *
 *  A procedência — que o app nunca afirme sobre um lugar real algo que o dono
 *  não disse — é a linha vermelha deste projeto, e este módulo passa a ser
 *  quem a guarda em tempo de execução.
 *
 *  ## 🔴 POR QUE A EXTRAÇÃO DEU 13 REGRAS E NÃO 15
 *
 *  O arquivo de teste de onde elas vieram tinha, na véspera desta extração, 15
 *  casos `it(`. **13 viraram regra aqui, e a conta fecha assim:**
 *
 *  | caso do arquivo de teste | virou |
 *  |---|---|
 *  | "o acervo tem conteúdo pra varrer" | **fica lá**: é não-vacuidade DO TESTE — prova que há acervo pra varrer, não diz nada sobre uma ficha |
 *  | "alguma ficha exercita o campo [dias]" | **fica lá**, pela mesma razão |
 *  | "o regex de preço daqui é o mesmo que a página usa" | **ficou lá** (comparava DOIS ARQUIVOS DE CÓDIGO, lendo o disco — não é fato de ficha nenhuma) até 2026-09-27, e lá **foi apagado**: a `[slug]/page.tsx` passou a IMPORTAR o `PRECO` daqui, e o guarda que o substituiu conta que o texto do regex aparece UMA vez só no `src/` |
 *  | "colchete vazio é o MOLDE do registro de campos" | **fica lá**: varre o `src/`, não o acervo |
 *  | "o `src/` continua cego ao waypoint 2 em diante" | **ficou lá**: varre o `src/`, e MUDOU DE NATUREZA na Tarefa 10 (a cadeia de trajeto) — hoje prova que o bloco Trajeto lê a cadeia e que quem fala do lugar continua no `[0]` |
 *  | "nenhuma ficha do acervo tem 2º waypoint" | **ficou lá** até a Tarefa 10, e lá **caiu a mão**: a razão dela era a tela cega à cadeia |
 *  | os 10 casos restantes | viraram **13 regras** |
 *
 *  Os 10 casos restantes rendem 13 porque **três deles juntavam, num `it(` só,
 *  defeitos de naturezas diferentes — e a `frase` que o dono lê é o que separa
 *  uma regra da outra**:
 *   - "o preço do CHIP é o mesmo da linha completa" → `preco-legivel-no-custo`
 *     (o app não acha preço no texto) **+** `chip-bate-com-preco` (acha, e
 *     diverge). São dois consertos diferentes na mão dele;
 *   - "o chip cabe na pílula e não repete a linha inteira" →
 *     `chip-cabe-na-pilula` **+** `chip-nao-repete-a-linha`;
 *   - "quando a prosa cita a hora de fechar, ela bate com o campo" →
 *     `hora-de-fechar-sem-campo` (não há campo pra bater) **+**
 *     `prosa-bate-com-hora-de-fechar` (há, e diverge).
 *
 *  E **dois deles NÃO se dividem, embora tenham vários `expect`**, porque ali
 *  os vários exames são o MESMO defeito medido em campos irmãos do mesmo
 *  objeto, com um conserto só: `janela-nao-zerada` (as duas janelas e o limiar
 *  da mesma regra de chuva — "regra que nunca fecha não é regra") e
 *  `dia-repetido-ou-inventado` (a mesma lista `dias` malformada).
 *
 *  ⚠️ **Não é que duas regras tenham se perdido na extração.** Se alguém contar
 *  15 lá e 13 aqui e concluir isso, esta tabela é a resposta.
 *
 *  🔴 **E HOJE SÃO 14**: a 14ª (`janela-dentro-do-provedor`) não veio da
 *  extração — nasceu na onda de conserto da Tarefa 7 (2026-10-01). A conta de
 *  13 acima é a da extração, e continua certa como história.
 *
 *  ## 🔴 A ASSINATURA É DO ACERVO, NÃO DA FICHA
 *
 *  Duas das regras (`frase-emprestada` e `texto-emprestado`, esta última sobre
 *  quatro campos) comparam **uma ficha com as outras**. Por isso a porta de
 *  escrita lê o acervo inteiro antes de aceitar uma gravação.
 *
 *  ⚠️ E a lista que chega aqui é **a lista pronta de quem chama** — este módulo
 *  não filtra nada e não sabe o que está visível na tela pública. Quem chamar
 *  tem que passar o acervo INTEIRO: um lugar escondido volta um dia, e se a
 *  comparação de frases o ignorasse, o dono poderia escrever no lugar A a frase
 *  do lugar B escondido, e o defeito só apareceria no dia em que reexibisse B.
 *
 *  ## ⚠️ A RÉGUA QUE VEIO JUNTO: NADA AQUI AFIRMA SOBRE UM LUGAR
 *
 *  Nenhum texto literal sobre um lugar específico mora neste arquivo — ele
 *  serve os três, e vai servir os que vierem. Toda regra é sobre a ficha ser
 *  coerente **consigo mesma** ou **distinta das outras**. Uma regra que soubesse
 *  que a Véu de Noiva é de barro seria a geografia inventada com roupa de
 *  código, e morreria no dia em que o dono mudasse o dado. */

/** O que está incoerente, pronto pra ir à tela do dono.
 *
 *  `frase` é a que ele lê no celular, no meio de uma edição: diz o que está
 *  incoerente, em português, nomeando o lugar e o valor. Nunca "inválido",
 *  nunca o identificador da regra, nunca jargão. `regra` é pra código e pra
 *  teste; `slug` é pra saber em que ficha mexer. */
export type Violacao = { regra: string; slug: string; frase: string };

/** 🔴 A ÚNICA FONTE DO QUE CONTA COMO PREÇO NESTE APP — e ela deixou de ser duas
 *  em 2026-09-27.
 *
 *  Inclusive os centavos, que ficaram de fora até 2026-08-27: MEDIDO com uma
 *  ficha de ensaio cobrando `R$ 12,50`, o regex antigo (`/R\$\s?\d+/`) casava só
 *  `R$ 12` e o chip do topo **anunciava um preço menor do que o lugar cobra**.
 *  Passou despercebido porque a única ficha paga do acervo cobra R$ 5 redondos.
 *
 *  ⚠️ **ELE ERA COPIADO À MÃO EM DOIS LUGARES** — aqui e em
 *  `src/app/[slug]/page.tsx` —, e havia um guarda de teste comparando os dois,
 *  justificado por "o teste não deve importar a implementação que audita, senão
 *  vira auto-referência". **Aquele argumento não sobreviveu à extração desta
 *  tarefa:** as duas cópias passaram a ser as duas DE PRODUÇÃO, e o teste
 *  auditava uma contra a outra sem que nenhuma fosse a fonte. A versão seguinte
 *  do comentário inventou um motivo novo — "a página não pode importar o módulo"
 *  — que era **falso**: `page.tsx` é server component e já importa `@/lib/piso`,
 *  `@/lib/semana`, `@/lib/horario` e o próprio `@/lib/ficha` (que carrega zod e
 *  `node:fs`). Nada impedia o import, e o comentário era a espécie que este
 *  commit foi caçar sobrevivendo dentro dele.
 *
 *  Decisão, na revisão de 2026-09-27: **a página importa este `PRECO`.** Sobra
 *  uma cópia só, a classe de defeito do `R$ 12,50` deixa de existir por
 *  construção, e o guarda que comparava as duas foi apagado por não ter mais o
 *  que guardar. No lugar dele há um guarda de UMA LINHA de natureza diferente,
 *  em `tests/lib/coerencia-acervo.test.ts`: o texto do regex só pode aparecer
 *  **uma vez** em todo o `src/`, pra ninguém reinlinar a cópia de volta.
 *
 *  ⚠️ SEM a bandeira `g`, de propósito: um regex global carrega `lastIndex`
 *  entre chamadas, e este é compartilhado por duas telas e pelas regras daqui. */
export const PRECO = /R\$\s?\d+(?:[.,]\d{2})?/;

/** Todo texto corrido da ficha, junto e em minúsculas — é sobre ele que as
 *  regras de "a prosa diz uma coisa e o campo diz outra" trabalham. */
const prosaDe = (f: Ficha) =>
  [f.voz, f.acesso, f.avisos, f.promessa, f.premio, f.condicao.regra_texto,
    f.discriminador.como_ler].join(" \n ").toLowerCase();

/** O nome do lugar como o dono o escreveu (`waypoints[0]`, O LUGAR), nunca o slug — e a cidade entre
 *  parênteses quando há (Tarefa 11b): dois lugares de mesmo nome compararem-se dizia "X e X". Sem cidade,
 *  só o nome. A `cidade` NÃO entra em `TEXTOS_QUE_DISTINGUEM`: dois lugares na mesma cidade são o normal. */
const nomeDe = (f: Ficha) => f.trajeto.waypoints[0].nome + (f.cidade ? ` (${f.cidade})` : ""); // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Formato meu (" (Cidade)").

/** O que uma regra acha. O identificador da regra é carimbado pela tabela lá
 *  embaixo, nunca escrito aqui dentro — assim nenhuma regra pode carimbar o
 *  nome de outra, nem um nome que não esteja em `REGRAS`. */
type Achado = { slug: string; frase: string };

type Regra = {
  regra: string;
  achar: (fichas: readonly Ficha[]) => Achado[];
};

/** Os quatro campos que existem pra DISTINGUIR um lugar do outro na lista, e o
 *  nome de cada um na boca do dono — a tela dele não fala `rotulo_escaneio`. */
const TEXTOS_QUE_DISTINGUEM = [
  { campo: "voz", rotulo: "a voz" },
  { campo: "promessa", rotulo: "a promessa" },
  { campo: "premio", rotulo: "o prêmio" },
  { campo: "rotulo_escaneio", rotulo: "a etiqueta" },
] as const;

/** 🔴 A TABELA DAS REGRAS. A ORDEM É A DA TELA: o dono lê a primeira frase
 *  primeiro, então as de custo (que é onde o defeito mais caro já entrou) vêm
 *  na frente.
 *
 *  `REGRAS` é DERIVADA desta tabela, nunca uma segunda lista escrita à mão —
 *  lista à mão cega ao que cresceu é a doença que este projeto já pagou três
 *  vezes. */
const TABELA: readonly Regra[] = [
  {
    // Mata: `custo.valor: "cinco reais"`. O chip do topo é montado extraindo o
    // preço de `valor` com o regex acima; sem preço legível ali, a página cai
    // no literal "Pago" e o dono nunca vê que o número dele sumiu da tela.
    regra: "preco-legivel-no-custo",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (f.custo.tag !== "pago" || !f.custo.curto) return [];
        if (PRECO.test(f.custo.valor ?? "")) return [];
        return [{
          slug: f.slug,
          // 🔴 DUAS FRASES, E O `?? ""` QUE MORAVA AQUI ERA A PRIMEIRA A MENTIR
          // (achado na revisão 2/5, 2026-09-27). Com `custo.valor` AUSENTE a
          // frase dizia *"o custo está escrito como """* — ele não escreveu
          // vazio, ele não escreveu NADA, e são dois consertos diferentes: num
          // ele corrige o texto, no outro ele preenche um campo que não existe.
          // O que a tela faz nesse caso: mostra o chip (o curto) e não desenha a linha do custo; "Pago" não vai pra tela (medido 07/10).
          frase: f.custo.valor
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            ? `Em ${nomeDe(f)}, o custo está escrito como "${f.custo.valor}" e o app não ` +
              "acha um preço aí dentro. Escreva o valor em reais (por exemplo, R$ 10), " +
              "senão o chip do topo da ficha não tem número pra mostrar."
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha. ⚠️ MEDIDA COMO FALSA E MANTIDA POR DECISÃO DELE ("Manter como estão", 07/10, sabendo da medição): com chip e sem valor, o chip mostra o curto e a linha do custo nem aparece ([slug]/page.tsx); "Pago" nunca vai pra tela. Não "conserte" sem ele; e não a tome por verdade.
            : `Em ${nomeDe(f)}, o chip do topo está preenchido e o custo completo está ` +
              'vazio. O app não tem de onde tirar o preço, e a ficha vai dizer só "Pago" ' +
              "no lugar do valor.",
        }];
      }),
  },
  {
    // Mata: `custo.curto: "R$ 1 · entrada"` numa ficha que cobra R$ 10.
    //
    // O chip e a linha completa são DUAS fontes pro mesmo dinheiro, escritas
    // por ele em campos separados de propósito — a forma de cobrar muda de
    // lugar pra lugar. Separadas, elas podem divergir sem ninguém ver: a tela
    // mostra o chip no topo e o ticket lá no fim, longe um do outro.
    //
    // 🔴 É o defeito dos centavos entrando pelo JSON depois de ter sido fechado
    // no código: numa auditoria de 2026-09-03 o chip anunciou UM DÉCIMO do
    // preço, com a suíte inteira verde.
    regra: "chip-bate-com-preco",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (f.custo.tag !== "pago" || !f.custo.curto) return []; // ausente é silêncio
        const noValor = f.custo.valor?.match(PRECO)?.[0];
        if (!noValor) return []; // quem acusa isto é a regra de cima
        const noCurto = f.custo.curto.match(PRECO)?.[0];
        if (noCurto?.replace(/\s/g, "") === noValor.replace(/\s/g, "")) return [];
        return [{
          slug: f.slug,
          // 🔴 DUAS FRASES, e o `?? "nenhum preço"` que morava aqui produzia
          // *"o chip do topo diz nenhum preço"* — que além de não ser português
          // escondia um defeito DIFERENTE: o chip existe e não tem número nenhum
          // dentro (ele escreveu só "no portão"). Achado na revisão 2/5.
          frase: noCurto
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            ? `O chip do topo de ${nomeDe(f)} diz ${noCurto} e o custo completo diz ` +
              `${noValor}. A pessoa lê o chip antes de sair de casa e o custo completo só ` +
              "quando chega."
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            : `O chip do topo de ${nomeDe(f)} não mostra preço nenhum ("${f.custo.curto}") e ` +
              `o custo completo diz ${noValor}. A pessoa lê o chip antes de sair de casa, e ` +
              "sem o número ali ela não sabe quanto levar.",
        }];
      }),
  },
  {
    // 🔴 BURACO DECLARADO, medido em 2026-09-04: a mutação `custo.curto:
    // "R$ 10 · portão"` numa ficha que cobra **na entrada** SOBREVIVE a estas
    // regras, e não dá pra fechar aqui. O preço bate, o tamanho cabe, e a
    // diferença — portão × entrada — é **fato do lugar**: só quem conhece sabe
    // onde se paga. Uma regra que soubesse seria a geografia inventada com roupa
    // de código, e morreria no dia em que o João corrigisse o dado.
    //
    // Foi exatamente esta palavra que passou meses escrita no código. O que a
    // impede hoje não é teste nem regra: é o campo existir, e `page.tsx` não
    // montar mais o chip. Declarar o buraco é a saída honesta — enterrá-lo junto
    // com o que dá pra medir é a espécie "declarar buraco é certo; enterrar a
    // metade provável, não" (2026-08-21).
    //
    // O que dá pra medir é o tamanho: o chip é uma pílula no topo da ficha.
    regra: "chip-cabe-na-pilula",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (f.custo.tag !== "pago" || !f.custo.curto) return [];
        const palavras = f.custo.curto.split(/\s+/).length;
        if (palavras <= 4) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `O chip de ${nomeDe(f)} tem ${palavras} palavras ("${f.custo.curto}") e estoura a ` +
            "pílula do topo da ficha. Cabem até 4.",
        }];
      }),
  },
  {
    // Mata: `curto = valor` inteiro (7 palavras estourando a pílula). O chip é a
    // forma CURTA do custo; repetido, ele não acrescenta nada e ainda estoura a
    // barra.
    regra: "chip-nao-repete-a-linha",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (f.custo.tag !== "pago" || !f.custo.curto) return [];
        if (f.custo.curto !== f.custo.valor) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `O chip de ${nomeDe(f)} está igual ao custo completo. O chip é a forma curta, pra ` +
            "ler no topo da ficha; repetido, ele não diz nada de novo.",
        }];
      }),
  },
  {
    // Mata: copiar o `secaRapido` da Rampa pra qualquer outra ficha.
    //
    // 🔴 Substitui a asserção antiga `pedra.secaRapido !== rampa.secaRapido`,
    // que comparava DUAS fichas nomeadas à mão e por isso não via a terceira. A
    // frase é a explicação de por que o chão firma NAQUELE lugar; duas fichas
    // com a mesma frase significam que ela voltou a ser genérica — que é
    // exatamente o estado de onde o campo veio, quando morava fixa no
    // `Carimbo.tsx` e dizia "a serra firmou" sobre uma cachoeira do brejo.
    regra: "frase-emprestada",
    achar: (fichas) => {
      const porFrase = new Map<string, Ficha[]>();
      for (const f of fichas) {
        if (!f.secaRapido) continue; // ausente é silêncio: o carimbo termina antes
        const k = f.secaRapido.trim().toLowerCase();
        porFrase.set(k, [...(porFrase.get(k) ?? []), f]);
      }
      return [...porFrase.values()].flatMap((grupo) =>
        grupo.slice(1).map((f) => ({
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `${grupo.map(nomeDe).join(" e ")} explicam o chão com a MESMA frase: ` +
            `"${f.secaRapido}". Ou uma delas está falando do lugar da outra, ou a frase é ` +
            "genérica demais pra estar na ficha.",
        })),
      );
    },
  },
  {
    // Mesma família, na voz do app: promessa, prêmio, voz e etiqueta são o
    // texto que a pessoa lê pra escolher ENTRE lugares. Dois cartões idênticos
    // na home não escolhem nada — e `tests/app/trilhas.test.tsx` não pega,
    // porque os dois lados dele leem `getAllFichas()`.
    regra: "texto-emprestado",
    achar: (fichas) =>
      TEXTOS_QUE_DISTINGUEM.flatMap(({ campo, rotulo }) => {
        const vistos = new Map<string, Ficha>();
        const achados: Achado[] = [];
        for (const f of fichas) {
          const k = String(f[campo]).trim().toLowerCase();
          const dono = vistos.get(k);
          if (dono) {
            achados.push({
              slug: f.slug,
              // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
              frase:
                `${nomeDe(dono)} e ${nomeDe(f)} têm ${rotulo} exatamente igual: ` +
                `"${String(f[campo])}". Esse texto existe pra distinguir um lugar do outro na ` +
                "lista; repetido, ele não distingue nada.",
            });
          } else {
            vistos.set(k, f);
          }
        }
        return achados;
      }),
  },
  {
    // Mata: `piso: "asfalto-tapete"` numa ficha cuja prosa diz barro cinco
    // vezes.
    //
    // 🔴 O QUE ESTA REGRA **NÃO** FAZ: ela não sabe qual é o piso de lugar
    // nenhum. Ela só exige que a ficha não se contradiga — se a prosa dela
    // nomeia um piso da escala, tem que ser o piso dela. O João pode trocar o
    // dado à vontade desde que troque a prosa junto, que é justamente o ponto.
    //
    // Molde: a asserção de `acesso` sustentando `carroComum`, em ficha.test.ts.
    //
    // 🔴 FICHA SEM `piso` É SILÊNCIO, E ISTO FOI UM CRITICAL (2026-09-27, revisão
    // desta tarefa). A versão anterior fazia `(f.piso ?? "")`, e com o campo
    // ausente TODO piso citado na prosa virava "estranho": **duas das três fichas
    // reais seriam recusadas se o piso estivesse em branco.**
    //
    // Onde isso mordia, e é o pior lugar possível: o João cria um lugar novo do
    // celular, escreve na voz *"é estrada de barro, molhou não vá"* — verdade,
    // palavra dele — e não preenche `piso`, que é opcional DE PROPÓSITO (fato de
    // roteiro; ver `src/lib/piso.ts`). A porta recusava a gravação dizendo que ele
    // *"declara o piso (nenhum)"* — ele não declarou nada — e que *"uma das duas
    // coisas está errada"* — nenhuma estava. Ele perdia a edição.
    //
    // É a linha vermelha do projeto INVERTIDA: em vez de o app afirmar demais
    // sobre o lugar, o app afirmando demais sobre o que o DONO DISSE. O
    // comportamento vinha do teste antigo, onde era só vermelho no laptop; nesta
    // tarefa ele viraria trava no celular. Ausente é silêncio, como em toda outra
    // regra daqui (`!f.secaRapido`, `!f.horario`, `!f.custo.curto`).
    regra: "prosa-bate-com-piso",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (!f.piso) return []; // ausente é silêncio: ele não declarou piso nenhum
        const prosa = prosaDe(f);
        // "asfalto-esburacado" e "asfalto-tapete" aparecem em prosa como duas
        // palavras; o valor do enum é hifenizado. Comparo pelo primeiro termo.
        const citados = PISOS.filter((p) => prosa.includes(p.split("-")[0]));
        const estranhos = citados.filter((p) => p.split("-")[0] !== f.piso!.split("-")[0]);
        if (estranhos.length === 0) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `${nomeDe(f)} declara o piso "${f.piso}" e o texto da ficha fala de ` +
            `${estranhos.join(", ")}. Uma das duas coisas está errada, e a tela mostra as duas ` +
            "juntas.",
        }];
      }),
  },
  {
    // Mata: `abre: "17:00", fecha: "08:00"`. `fechadoAgora` lê faixa invertida
    // como travessia da meia-noite — comportamento deliberado e certo pra um
    // lugar que abre à noite. Numa ficha em que foi engano, o app anuncia a
    // trilha **aberta a noite toda e fechada o dia todo**, com a suíte verde.
    //
    // Não proíbe a travessia: exige que ela esteja DITA na prosa, que é o mesmo
    // critério do piso acima — o dado incomum precisa de dono.
    //
    // 🔴 SÃO DUAS FRASES PORQUE SÃO DOIS COMPORTAMENTOS, e a versão anterior
    // escrevia UMA e ela era FALSA num deles (achado na revisão de 2026-09-27).
    // `dentroDaFaixa` (em `src/lib/horario.ts`) trata `abre === fecha` como
    // **24h: nunca fecha** — não como travessia da meia-noite. Dizer a esse dono
    // que o app vai anunciar o lugar "aberto a noite toda e fechado o dia todo"
    // seria descrever o OUTRO caso. A fronteira `<` × `<=` é de propósito e tem
    // teste nos dois lados.
    //
    // ⚠️ E OS DOIS RAMOS TÊM PROVA DE CONTEÚDO, não só de disparo — a bifurcação
    // nasceu, na revisão 2/5, com prova só num lado: colapsá-la pro ramo das 24h
    // deixava as 46 asserções verdes, e uma ficha que abre à noite de verdade
    // passava a ler "está aberto 24 horas e nunca fecha". Regra com bifurcação de
    // frase precisa de asserção de TEXTO em cada ramo; senão a prova é de metade.
    regra: "horario-invertido-sem-aviso",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (!f.horario) return []; // ausente é silêncio: ficha sem horário nunca fecha
        const faixa = f.horario.find((x) => x.abre >= x.fecha) ?? f.horario[0]; // HH:MM: o texto ordena
        const [[ah, am], [fh, fm]] = [faixa.abre, faixa.fecha].map((x) => x.split(":").map(Number));
        const abre = ah * 60 + am;
        const fecha = fh * 60 + fm;
        if (abre < fecha) return [];
        if (/noite|madrugada|24 ?h|vinte e quatro/.test(prosaDe(f))) return [];
        return [{
          slug: f.slug,
          frase: abre === fecha
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            ? `${nomeDe(f)} abre e fecha no mesmo horário (${faixa.abre}) — assim o app ` +
              "entende que o lugar está aberto 24 horas e nunca fecha. Se for isso, diga no " +
              "texto da ficha; se não for, um dos dois horários está errado."
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            : `${nomeDe(f)} abre às ${faixa.abre} e fecha às ${faixa.fecha} — assim o ` +
              "app vai anunciá-la aberta a noite toda e fechada o dia todo. Se for de " +
              "propósito, diga isso no texto da ficha; se não for, os dois horários estão " +
              "trocados.",
        }];
      }),
  },
  {
    // Mata: o `avisos` dizendo "fecha às 17h" numa ficha SEM campo `horario`. A
    // pessoa leu que fecha, e o carimbo nunca vai fechar — o app dizendo "Pode
    // ir" num lugar que a própria ficha diz estar fechado.
    regra: "hora-de-fechar-sem-campo",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        const citada = /fecha (?:às|as) (\d{1,2})\s*h/i.exec(prosaDe(f));
        if (!citada || f.horario) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `O texto de ${nomeDe(f)} diz que fecha às ${citada[1]}h, mas a ficha não tem ` +
            "horário preenchido. O carimbo nunca vai fechar, e a pessoa leu que fecha.",
        }];
      }),
  },
  {
    // Mata: o horário fechando às "23:00" enquanto o `avisos` da mesma ficha diz
    // "fecha às 17h". A hora vive em DUAS fontes — o campo, que o carimbo lê, e
    // a prosa, que a pessoa lê — e nada as amarrava. É o defeito que
    // `tests/app/km-uma-fonte.test.tsx` fechou pro km e ninguém tinha fechado
    // pra hora. Só age quando a prosa realmente cita uma hora de fechar: sem
    // citação não há divergência possível.
    regra: "prosa-bate-com-hora-de-fechar",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        const citada = /fecha (?:às|as) (\d{1,2})\s*h/i.exec(prosaDe(f));
        if (!citada || !f.horario) return []; // sem campo, quem acusa é a regra de cima
        if (f.horario.some((x) => Number(citada[1]) === Number(x.fecha.split(":")[0]))) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          frase:
            `O texto de ${nomeDe(f)} diz que fecha às ${citada[1]}h e o horário da ficha diz ` +
            `${f.horario[f.horario.length - 1].fecha}. As duas frases aparecem na mesma tela.`,
        }];
      }),
  },
  {
    // Mata: zerar as duas janelas de chuva na ficha real — uma regra que não vê
    // chuva nenhuma e nunca diz não. O zod aceita 0 de propósito (as fixtures
    // sintéticas usam), então o guarda pertence ao ACERVO, não ao schema.
    //
    // ⚠️ UMA REGRA SÓ pros três números: é o mesmo defeito — "regra que nunca
    // fecha não é regra" — medido em campos irmãos da MESMA regra de chuva, e o
    // conserto é um só. (O nome ficou "nao-zerada" por história: desde
    // 2026-10-01 CADA janela pode ser zero sozinha — ver os exames abaixo.)
    regra: "janela-nao-zerada",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        const r = f.condicao.regra;
        const achados: Achado[] = [];
        // 🔴 PASSADO ZERO É ACEITO — decisão do João, 2026-10-01, simétrica à
        // da previsão. Medido com `avaliar` (passado 0, previsão 6, limiar 0.2):
        // 5 mm uma hora adiante → `frio`; seco → `fresco`. A regra fecha pela
        // previsão. Aqui sobra só o NEGATIVO (ou não-número).
        if (!(r.janela_passado_horas >= 0)) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `A regra de chuva de ${nomeDe(f)} olha ${r.janela_passado_horas} horas pra trás, ` +
              "e janela negativa não existe.",
          });
        }
        // O PAR QUE NUNCA FECHA: passado 0 E previsão sem nada pra frente (0, ou
        // negativa — que o exame de baixo também acusa). Medido com `avaliar`:
        // passado 0 e previsão 0 dão `fresco` com chuva atrás E adiante. Nesse
        // par, e só nele, a frase é verdadeira.
        if (r.janela_passado_horas === 0 && !(r.janela_previsao_horas > 0)) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `A regra de chuva de ${nomeDe(f)} olha 0 hora pra trás: assim ela nunca vê chuva ` +
              "nenhuma e o lugar nunca fecha.",
          });
        }
        // 🔴 PREVISÃO ZERO É ACEITA — decisão do João, 2026-10-01: "só olhar a
        // chuva que já caiu". Medido com `avaliar` (previsão 0, passado 6,
        // limiar 0.2): 5 mm uma hora atrás → `frio`; seco → `fresco`. A regra
        // continua fechando pelo passado, então a frase antiga ("o lugar nunca
        // fecha") era FALSA pra este caso. O que nunca fecha é previsão 0 E
        // passado 0 — e esse par é recusado pelo exame do par, logo acima, cuja
        // frase é verdadeira nele. Aqui sobra só o NEGATIVO (ou não-número).
        if (!(r.janela_previsao_horas >= 0)) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `A regra de chuva de ${nomeDe(f)} olha ${r.janela_previsao_horas} horas pra frente, ` +
              "e janela negativa não existe: use 0 pra olhar só a chuva que já caiu.",
          });
        }
        if (!(r.limiar_mm > 0)) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `O limite de chuva de ${nomeDe(f)} é 0 mm: qualquer orvalho fecha o lugar, e o ` +
              "app passa a dizer não o ano inteiro.",
          });
        }
        return achados;
      }),
  },
  {
    // Mata: `dias: ["sab","sab"]`, que faz a tela dizer "Abre sábado e
    // sábado.". E `dias: ["Sab"]`, que o schema pega hoje — mas só porque o
    // enum é montado a partir de DIAS; no dia em que virar `z.string()`, esta
    // regra continua.
    //
    // ⚠️ UMA REGRA SÓ pros dois exames: é a MESMA lista `dias` malformada, e é
    // um conserto só na mão dele.
    regra: "dia-repetido-ou-inventado",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (!f.dias?.length) return [];
        const achados: Achado[] = [];
        if (new Set(f.dias).size !== f.dias.length) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `${nomeDe(f)} tem o mesmo dia repetido na lista de dias, e a tela diria esse dia ` +
              "duas vezes na mesma frase.",
          });
        }
        const inventados = f.dias.filter((d) => !DIAS.includes(d));
        if (inventados.length > 0) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            // 🔴 A VERSÃO ANTERIOR DESTA FRASE DIZIA AO DONO QUE SEGUNDA-FEIRA
            // NÃO É DIA DA SEMANA (achado na revisão de 2026-09-27). Ele digita
            // "segunda" e lia *"isso não é dia da semana"* — é, claro que é. O
            // que o app não reconhece é a GRAFIA, e a frase agora diz isso e
            // mostra as sete palavras que ele pode usar. A lista sai de `DIAS`,
            // nunca escrita à mão aqui.
            frase:
              `${nomeDe(f)} tem ${inventados.map((d) => `"${d}"`).join(", ")} na lista de dias, ` +
              "e o app não reconhece essa grafia. As palavras que ele entende são: " +
              `${DIAS.join(", ")}.`,
          });
        }
        return achados;
      }),
  },
  {
    // 🔴 Mata: `dias` com os SETE dias. Declarar a semana inteira é o mesmo que
    // não declarar nada — e as duas coisas não são iguais no repositório: a
    // ficha com os sete carrega um dado que nunca muda veredito, e quem ler a
    // ficha acha que o app está checando algo que ele não checa. Ausente é
    // silêncio, e aqui o silêncio é o certo — mesma régua do `piso` e do
    // `secaRapido`.
    //
    // Irmã da janela de chuva zerada, do outro lado: lá era a regra que nunca
    // fecha; aqui é a regra que nunca age.
    regra: "semana-inteira-nao-declara",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        if (!f.dias?.length || f.dias.length < 7) return [];
        return [{
          slug: f.slug,
          // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
          // 🔴 A VERSÃO ANTERIOR MANDAVA FAZER O QUE O SCHEMA RECUSA (achado na
          // revisão de 2026-09-27): dizia *"deixe a lista de dias vazia"*, e
          // `dias` é `z.array(...).min(1).optional()` — lista VAZIA é inválida (o
          // porquê está no comentário do campo: `[]` significaria "não abre
          // nunca"). Seguindo a instrução da tela, ele levava um segundo erro, de
          // outra natureza. O que ele tem que fazer é TIRAR o campo, não esvaziá-lo.
          frase:
            `${nomeDe(f)} declara os sete dias da semana, o que é o mesmo que não declarar dia ` +
            "nenhum. Tire os dias da ficha: o app só fala de dia quando o lugar folga em algum.",
        }];
      }),
  },
  {
    // Mata: `janela_previsao_horas: 480` digitado no celular (um dígito a mais
    // que `48`). Medido na revisão da Tarefa 7 e conferido de novo em
    // 2026-10-01: a Open-Meteo recusa `forecast_days=17` e `past_days=94` com
    // 400, e a busca da tela inicial é UMA requisição pra todos os lugares com a
    // MAIOR janela do acervo (`janelaMaxima`) — então um número só tira a chuva
    // de TODOS os lugares PÚBLICOS, não só deste. Nenhuma outra camada recusava: o schema
    // só exige finito, `janela-nao-zerada` só olha o chão.
    //
    // ⚠️ AS FRASES NÃO DIZEM "todos os lugares", e é subtração (onda de
    // conserto 2, 2026-10-01): a home lê `getAllFichas`, que filtra o lugar
    // OCULTO, então a janela de um lugar escondido não derruba ninguém enquanto
    // ele estiver escondido. A recusa continua certa (desesconder derrubaria),
    // mas a frase só afirma o que vale sempre: a busca é recusada.
    //
    // 🔴 OS TETOS NÃO SÃO DESTE ARQUIVO: moram em `src/lib/weather.ts`, ao lado
    // da URL que eles governam, com a medição escrita lá.
    //
    // ⚠️ É a 14ª regra e NÃO veio da extração dos testes (a tabela do topo
    // conta as 13 de lá): nasceu na onda de conserto da Tarefa 7.
    regra: "janela-dentro-do-provedor",
    achar: (fichas) =>
      fichas.flatMap((f) => {
        const r = f.condicao.regra;
        const achados: Achado[] = [];
        if (r.janela_previsao_horas > TETO_PREVISAO_HORAS) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `A regra de chuva de ${nomeDe(f)} olha ${r.janela_previsao_horas} horas pra frente, e a ` +
              `previsão do tempo só vai até ${TETO_PREVISAO_HORAS} horas. Com esse número a busca de ` +
              "chuva é recusada.",
          });
        }
        if (r.janela_passado_horas > TETO_PASSADO_HORAS) {
          achados.push({
            slug: f.slug,
            // LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
            frase:
              `A regra de chuva de ${nomeDe(f)} olha ${r.janela_passado_horas} horas pra trás, e o ` +
              `histórico de chuva só volta ${TETO_PASSADO_HORAS} horas. Com esse número a busca de ` +
              "chuva é recusada.",
          });
        }
        return achados;
      }),
  },
];

/** Os identificadores das regras — DERIVADOS da tabela, nunca uma segunda
 *  lista. É o que o teste de não-vacuidade percorre pra provar que cada uma
 *  ainda dispara. */
export const REGRAS: readonly string[] = TABELA.map((r) => r.regra);

/** Tudo que está incoerente no acervo recebido, em ordem de tabela.
 *
 *  🔴 Recebe O ACERVO, não uma ficha: duas das regras comparam uma ficha com as
 *  outras. E recebe a lista PRONTA de quem chama — ver o docblock do topo sobre
 *  os lugares escondidos. */
export function violacoesDoAcervo(fichas: readonly Ficha[]): Violacao[] {
  return TABELA.flatMap((r) => r.achar(fichas).map((a) => ({ regra: r.regra, ...a })));
}
