import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getAllFichas } from "@/lib/ficha";
import { PISOS } from "@/lib/piso";
import type { Ficha } from "@/types/ficha";

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
 */

const fichas = getAllFichas();
const pagas = fichas.filter((f) => f.custo.tag === "pago");

/** O MESMO regex de `src/app/[slug]/page.tsx` — inclusive os centavos, que
 *  ficaram de fora até 2026-08-27 e faziam o chip anunciar menos do que o lugar
 *  cobra. Copiado de propósito e com o porquê ao lado: se o de lá mudar e o
 *  daqui não, o teste do fim deste arquivo acusa. */
const PRECO = /R\$\s?\d+(?:[.,]\d{2})?/;

const prosaDe = (f: Ficha) =>
  [f.voz, f.acesso, f.avisos, f.promessa, f.premio, f.condicao.regra_texto,
    f.discriminador.como_ler].join(" \n ").toLowerCase();

describe("coerência do acervo — varre TODAS as fichas, nunca uma lista de slugs", () => {
  // 🔴 NÃO-VACUIDADE, e ela é load-bearing aqui mais que em qualquer outro
  // arquivo: todo teste abaixo é um laço sobre `fichas`. Com o acervo vazio, ou
  // com o `loadAll` devolvendo [], **todos passariam** — a espécie "prova que
  // passa por não ter o que provar". O número é cravado e cresce a mão junto com
  // o acervo, de propósito: `fichas.length` contra si mesmo não prova nada.
  it("o acervo tem conteúdo pra varrer — sem isto, todo laço abaixo passa vazio", () => {
    expect(fichas.length, "o acervo sumiu: os guardas deste arquivo ficariam ocos").toBeGreaterThanOrEqual(3);
    expect(pagas.length, "sumiu a ficha paga: os guardas de custo ficariam ocos").toBeGreaterThanOrEqual(2);
  });

  // Mata: `custo.curto: "R$ 1 · entrada"` numa ficha que cobra R$ 10, e
  // `curto = valor` inteiro (7 palavras estourando a pílula).
  //
  // O chip e a linha completa são DUAS fontes pro mesmo dinheiro, escritas por
  // ele em campos separados de propósito — a forma de cobrar muda de lugar pra
  // lugar. Separadas, elas podem divergir sem ninguém ver: a tela mostra o chip
  // no topo e o ticket lá no fim, longe um do outro.
  it("em toda ficha paga, o preço do CHIP é o mesmo preço da linha completa", () => {
    for (const f of pagas) {
      if (!f.custo.curto) continue; // ausente é silêncio — o app mostra só o preço
      const noValor = f.custo.valor?.match(PRECO)?.[0];
      const noCurto = f.custo.curto.match(PRECO)?.[0];
      expect(noValor, `${f.slug}: a linha completa do custo não tem preço legível`).toBeTruthy();
      expect(
        noCurto?.replace(/\s/g, ""),
        `${f.slug}: o chip do topo diz "${noCurto}" e a linha completa diz "${noValor}" — ` +
          "a pessoa lê o chip antes de sair de casa e o ticket só quando chega.",
      ).toBe(noValor?.replace(/\s/g, ""));
    }
  });

  // 🔴 BURACO DECLARADO, medido em 2026-09-04: a mutação `custo.curto:
  // "R$ 10 · portão"` numa ficha que cobra **na entrada** SOBREVIVE a este
  // arquivo, e não dá pra fechar aqui. O preço bate, o tamanho cabe, e a
  // diferença — portão × entrada — é **fato do lugar**: só quem conhece sabe
  // onde se paga. Um teste que soubesse seria a geografia inventada com roupa
  // de prova, e morreria no dia em que o João corrigisse o dado.
  //
  // Foi exatamente esta palavra que passou meses escrita no código. O que a
  // impede hoje não é teste: é o campo existir, e `page.tsx` não montar mais o
  // chip. Declarar o buraco é a saída honesta — enterrá-lo junto com o que dá
  // pra medir é a espécie "declarar buraco é certo; enterrar a metade provável,
  // não" (2026-08-21).
  it("o chip cabe na pílula e não repete a linha inteira", () => {
    for (const f of pagas) {
      if (!f.custo.curto) continue;
      expect(
        f.custo.curto.split(/\s+/).length,
        `${f.slug}: o chip tem ${f.custo.curto.split(/\s+/).length} palavras e estoura a barra`,
      ).toBeLessThanOrEqual(4);
      expect(f.custo.curto, `${f.slug}: o chip virou cópia da linha completa`).not.toBe(f.custo.valor);
    }
  });

  // Mata: copiar o `secaRapido` da Rampa pra qualquer outra ficha.
  //
  // 🔴 Substitui a asserção antiga `pedra.secaRapido !== rampa.secaRapido`, que
  // comparava DUAS fichas nomeadas à mão e por isso não via a terceira. A frase
  // é a explicação de por que o chão firma NAQUELE lugar; duas fichas com a
  // mesma frase significam que ela voltou a ser genérica — que é exatamente o
  // estado de onde o campo veio, quando morava fixa no `Carimbo.tsx`.
  it("nenhuma ficha empresta o secaRapido de outra — a frase é do lugar", () => {
    const porFrase = new Map<string, string[]>();
    for (const f of fichas) {
      if (!f.secaRapido) continue; // ausente é silêncio: o carimbo termina antes
      const k = f.secaRapido.trim().toLowerCase();
      porFrase.set(k, [...(porFrase.get(k) ?? []), f.slug]);
    }
    const repetidas = [...porFrase.entries()].filter(([, s]) => s.length > 1);
    expect(
      repetidas.map(([frase, slugs]) => `${slugs.join(" e ")} dizem "${frase}"`),
      "duas fichas explicando o relevo com a MESMA frase: ou uma delas está " +
        "falando do lugar da outra, ou a frase é genérica e não devia estar na ficha.",
    ).toEqual([]);
  });

  // Mesma família, na voz do app: promessa, prêmio, voz e etiqueta são o texto
  // que a pessoa lê pra escolher ENTRE lugares. Dois cartões idênticos na home
  // não escolhem nada — e `tests/app/trilhas.test.tsx` não pega, porque os dois
  // lados dele leem `getAllFichas()`.
  it("nenhuma ficha empresta a voz, a promessa, o prêmio ou a etiqueta de outra", () => {
    for (const campo of ["voz", "promessa", "premio", "rotulo_escaneio"] as const) {
      const vistos = new Map<string, string>();
      for (const f of fichas) {
        const k = String(f[campo]).trim().toLowerCase();
        const dono = vistos.get(k);
        expect(
          dono ? `${dono} e ${f.slug} têm o mesmo ${campo}` : null,
          `o texto de ${campo} foi copiado entre fichas — ele existe pra distinguir um lugar do outro`,
        ).toBeNull();
        vistos.set(k, f.slug);
      }
    }
  });

  // Mata: `piso: "asfalto-tapete"` numa ficha cuja prosa diz barro cinco vezes.
  //
  // 🔴 O QUE ESTE TESTE **NÃO** FAZ: ele não sabe qual é o piso de lugar nenhum.
  // Ele só exige que a ficha não se contradiga — se a prosa dela nomeia um piso
  // da escala, tem que ser o piso dela. O João pode trocar o dado à vontade
  // desde que troque a prosa junto, que é justamente o ponto.
  //
  // Molde: a asserção de `acesso` sustentando `carroComum`, em ficha.test.ts.
  it("a prosa da ficha não nomeia um piso diferente do que o campo declara", () => {
    for (const f of fichas) {
      const prosa = prosaDe(f);
      // "asfalto-esburacado" e "asfalto-tapete" aparecem em prosa como duas
      // palavras; o valor do enum é hifenizado. Comparo pelo primeiro termo.
      const citados = PISOS.filter((p) => prosa.includes(p.split("-")[0]));
      const estranhos = citados.filter((p) => p.split("-")[0] !== (f.piso ?? "").split("-")[0]);
      expect(
        estranhos,
        `${f.slug} declara piso "${f.piso ?? "(nenhum)"}" e a prosa dela fala de ` +
          `${estranhos.join(", ")} — uma das duas está errada, e a tela mostra as duas juntas.`,
      ).toEqual([]);
    }
  });

  // Mata: `abre: "17:00", fecha: "08:00"`. `fechadoAgora` lê faixa invertida
  // como travessia da meia-noite — comportamento deliberado e certo pra um lugar
  // que abre à noite. Numa ficha em que foi engano, o app anuncia a trilha
  // **aberta a noite toda e fechada o dia todo**, com a suíte verde.
  //
  // Não proíbe a travessia: exige que ela esteja DITA na prosa, que é o mesmo
  // critério do piso acima — o dado incomum precisa de dono.
  it("horário invertido só passa se a prosa da ficha disser que atravessa a noite", () => {
    for (const f of fichas) {
      if (!f.horario) continue; // ausente é silêncio: ficha sem horário nunca fecha
      const [ah, am] = f.horario.abre.split(":").map(Number);
      const [fh, fm] = f.horario.fecha.split(":").map(Number);
      if (ah * 60 + am < fh * 60 + fm) continue;
      expect(
        /noite|madrugada|24 ?h|vinte e quatro/.test(prosaDe(f)),
        `${f.slug} abre às ${f.horario.abre} e fecha às ${f.horario.fecha} — o app vai ` +
          "anunciá-la aberta a noite toda e fechada o dia todo. Se for de propósito, " +
          "diga isso na prosa da ficha; se não for, os dois campos estão trocados.",
      ).toBe(true);
    }
  });

  // Mata: `horario.fecha: "23:00"` enquanto o `avisos` da mesma ficha diz
  // "fecha às 17h". A hora vive em DUAS fontes — o campo, que o carimbo lê, e a
  // prosa, que a pessoa lê — e nada as amarrava. É o defeito que
  // `tests/app/km-uma-fonte.test.tsx` fechou pro km e ninguém tinha fechado pra
  // hora. O teste só age quando a prosa realmente cita uma hora de fechar: sem
  // citação não há divergência possível.
  it("quando a prosa cita a hora de fechar, ela bate com o campo", () => {
    for (const f of fichas) {
      const citada = /fecha (?:às|as) (\d{1,2})\s*h/i.exec(prosaDe(f));
      if (!citada) continue;
      expect(
        f.horario,
        `${f.slug}: a prosa diz "fecha às ${citada[1]}h" mas a ficha não tem campo ` +
          "`horario` — o carimbo nunca vai fechar, e a pessoa leu que fecha.",
      ).toBeTruthy();
      expect(
        Number(citada[1]),
        `${f.slug}: a prosa diz que fecha às ${citada[1]}h e o campo diz ${f.horario!.fecha} — ` +
          "as duas frases aparecem na mesma tela.",
      ).toBe(Number(f.horario!.fecha.split(":")[0]));
    }
  });

  // Mata: zerar as duas janelas de chuva na ficha real — o carimbo passa a
  // imprimir "Sem chuva nas últimas ~0h e nada previsto pras próximas ~0h", que
  // é uma regra que nunca diz não. O zod aceita 0 de propósito (as fixtures
  // sintéticas usam), então o guarda pertence ao ACERVO, não ao schema.
  it("nenhuma ficha real tem janela de chuva zerada — regra que nunca fecha não é regra", () => {
    for (const f of fichas) {
      const r = f.condicao.regra;
      expect(r.janela_passado_horas, `${f.slug}: janela do passado zerada`).toBeGreaterThan(0);
      expect(r.janela_previsao_horas, `${f.slug}: janela de previsão zerada`).toBeGreaterThan(0);
      expect(r.limiar_mm, `${f.slug}: limiar de chuva zerado — qualquer orvalho fecha`).toBeGreaterThan(0);
    }
  });

  // 🔴 O regex de preço está ESCRITO DUAS VEZES: aqui e em page.tsx. Duplicação
  // deliberada — o teste não deve importar a implementação que audita, senão
  // vira auto-referência (a espécie em que os dois lados da asserção vêm da
  // mesma constante). Este guarda é o preço da duplicação: se um mudar sem o
  // outro, o chip volta a poder divergir do ticket sem ninguém ver.
  it("o regex de preço daqui é o mesmo que a página usa pra montar o chip", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "[slug]", "page.tsx"), "utf8")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "a tira de comentários comeu o arquivo — a asserção abaixo ficaria vazia")
      .toContain("precoCurto");
    expect(src, "o regex de preço da página mudou; atualize o PRECO deste arquivo junto")
      .toContain(PRECO.source);
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

  it("o `src/` continua cego ao waypoint 2 em diante — a premissa do guarda abaixo", () => {
    // NÃO-VACUIDADE: sem este número, renomear o campo (ou a tira comer o
    // arquivo) deixa `acessos` vazio e o laço seguinte passa sem ler nada.
    // Cravado a mão de propósito, como o `fichas.length` no topo.
    expect(
      acessos.length,
      "nenhum acesso a `waypoints[...]` no src/ — ou o campo mudou de nome, ou a " +
        "tira de comentários comeu os arquivos. O teste abaixo ficaria oco.",
    ).toBeGreaterThanOrEqual(7);

    const alem = acessos.filter((a) => a.indice !== "0");
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
