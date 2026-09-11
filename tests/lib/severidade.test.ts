import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getFichasComCondicao } from "@/lib/ficha";
import { fichaSchema } from "@/types/ficha";
import { marcaDe, subDe } from "@/lib/carimbo-fase";
import { SEVERIDADES, falaMolhada, tomDe, vozDaFicha } from "@/lib/severidade";
import { regraDe, semComentarios } from "../css";

/** 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-09-10). O carimbo tinha DUAS
 *  palavras pro acervo inteiro, e elas vinham de bocas diferentes: "Não vá" é a
 *  `voz` da Rampa do Pepê, "barro · dá um tempo" era paráfrase minha da `voz` da
 *  Pedra Furada — e as duas eram aplicadas à Véu de Noiva, sobre a qual ele
 *  disse, perguntado direto, "com chuva dá pra ir sim, com cuidado".
 *
 *  Quarta vez na mesma família (as outras: `secaRapido`, `chuvaNoPiso`,
 *  `discriminador.formato`), e uma camada acima: ali era um FATO de um lugar
 *  escrito num componente que serve todos; aqui era a VOZ de um lugar virando a
 *  língua de todos. */
describe("falaMolhada: cada trilha fala com a força que a ficha DELA declara", () => {
  it("os três níveis dizem coisas diferentes — senão o campo não decide nada", () => {
    const marcas = SEVERIDADES.map((s) => falaMolhada(s, 6).marca);
    expect(marcas.length).toBe(3); // não passa por vacuidade com a lista vazia
    expect(new Set(marcas).size).toBe(3);
  });

  // MUTAÇÃO M1: `marcaDe` voltar a devolver uma palavra fixa no ramo molhado.
  // Verde em tudo que só monte a Rampa. Só o cruzamento pelos TRÊS níveis mata.
  it("a palavra do carimbo muda com o nível, e não com o estado só", () => {
    const ditas = SEVERIDADES.map((severidade) =>
      marcaDe("afirmando", "frio", { severidade, horasPassado: 6 }),
    );
    expect(new Set(ditas).size).toBe(3);
    // E o ramo SECO não é assunto do nível: continua um só pro acervo inteiro.
    const secas = SEVERIDADES.map((severidade) =>
      marcaDe("afirmando", "fresco", { severidade, horasPassado: 6 }),
    );
    expect(new Set(secas)).toEqual(new Set(["Pode ir"]));
  });

  it("a linha de baixo obedece ao nível pela mesma régua", () => {
    const ditas = SEVERIDADES.map((severidade) =>
      subDe("afirmando", "frio", { severidade, horasPassado: 6 }),
    );
    expect(ditas.length).toBe(3);
    expect(new Set(ditas).size).toBeGreaterThan(1);
  });

  // MUTAÇÃO M2: escrever "Espera 3h" fixo na tabela. Verde em qualquer teste
  // que só monte a Pedra Furada — e MENTIRA na Rampa e na Véu, que são 6h.
  it("o nível `espera` diz a janela DA FICHA, não um número escrito na tabela", () => {
    expect(falaMolhada("espera", 3).marca).not.toBe(falaMolhada("espera", 6).marca);
    expect(falaMolhada("espera", 3).marca).toContain("3");
    expect(falaMolhada("espera", 6).marca).toContain("6");
  });

  // MUTAÇÃO M11: a `sub` de `espera` voltar a ser "barro · dá um tempo" — a
  // herança que saiu em 10/09 porque `barro` é MATERIAL (dono: `chuvaNoPiso` em
  // piso.ts) e "dá um tempo" era paráfrase minha de nenhuma fala literal dele.
  //
  // 🔴 A asserção é a REGRA, não a igualdade: a igualdade morre no dia em que
  // ele trocar a palavra, e a regra sobrevive à troca. `nao-va` fica de fora de
  // propósito — o "barro" dela é dívida que ele decidiu manter em 2026-08-27,
  // de olhos abertos, e reabri-la por conta própria é erro.
  it("os níveis novos não nomeiam MATERIAL — isso tem dono em piso.ts", () => {
    for (const severidade of ["espera", "cuidado"] as const) {
      const { marca, sub } = falaMolhada(severidade, 6);
      expect(`${marca} ${sub}`, severidade).not.toMatch(/barro|asfalto|paralelep/i);
    }
    // Controle: a dívida conhecida do `nao-va` continua lá, e este teste sabe
    // disso — sem esta linha, apagá-la passaria despercebido como "melhoria".
    expect(falaMolhada("nao-va", 6).sub).toMatch(/barro/);
  });

  // MUTAÇÃO M3: `vozDaFicha` pegar a janela de PREVISÃO em vez da de passado.
  // As duas são números da mesma `regra`, e trocá-las não quebra tipo nenhum.
  it("a voz da ficha carrega a janela de PASSADO, que é a que o nível cita", () => {
    for (const f of getFichasComCondicao()) {
      const voz = vozDaFicha(f.condicao);
      expect(voz.horasPassado, f.slug).toBe(f.condicao.regra.janela_passado_horas);
      expect(voz.severidade, f.slug).toBe(f.condicao.severidade);
    }
  });
});

describe("o acervo inteiro, e o guarda cresce com ele", () => {
  // 🔴 LÊ `content/fichas/` — não enumera slug à mão. Guarda que lista o acervo
  // na fonte é cego a ele crescer, e é uma das 36 espécies já catalogadas neste
  // projeto: a ficha nova entra sem severidade e nenhum teste pisca.
  const acervo = getFichasComCondicao();

  it("toda ficha declara um nível, e o schema só aceita os três", () => {
    expect(acervo.length).toBeGreaterThan(0);
    for (const f of acervo) {
      expect(SEVERIDADES, f.slug).toContain(f.condicao.severidade);
    }
  });

  // 🔴 A MÁQUINA NÃO PODE FICAR SEM USO. `modos` está nas três fichas desde
  // sempre e não tem um leitor no `src/` — dado que carrega, valida, tem teste,
  // e nunca aparece na tela. Este guarda impede a tabela de níveis de virar a
  // mesma coisa: se um nível deixar de ser exercitado pelo acervo, ou ele sai
  // da tabela, ou entra a ficha que o usa.
  it("o acervo exercita os TRÊS níveis — tabela sem uso é máquina sem costura", () => {
    const usados = new Set(acervo.map((f) => f.condicao.severidade));
    expect([...usados].sort()).toEqual([...SEVERIDADES].sort());
  });

  it("o schema RECUSA ficha sem nível", () => {
    const boa = JSON.parse(
      readFileSync(path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"),
    );
    expect(fichaSchema.safeParse(boa).success).toBe(true); // controle
    const semNivel = { ...boa.condicao };
    delete semNivel.severidade;
    expect(fichaSchema.safeParse({ ...boa, condicao: semNivel }).success).toBe(false);
  });

  it("o schema RECUSA nível inventado", () => {
    const boa = JSON.parse(
      readFileSync(path.join(process.cwd(), "content", "fichas", "rampa-do-pepe.json"), "utf8"),
    );
    const forjada = { ...boa, condicao: { ...boa.condicao, severidade: "talvez" } };
    expect(fichaSchema.safeParse(forjada).success).toBe(false);
  });
});

describe("tomDe: a COR deixou de ser o estado cru", () => {
  it("chão seco é seco em qualquer nível — a chuva é quem manda aqui", () => {
    for (const severidade of SEVERIDADES) expect(tomDe("fresco", severidade)).toBe("fresco");
  });

  // MUTAÇÃO M4: `tomDe` devolver o estado cru no ramo molhado. Verde em tudo
  // que não monte a ficha de nível `cuidado` — e é exatamente o defeito: "Vá
  // com cuidado" dentro de um retângulo VERMELHO.
  it("molhado, só o nível `cuidado` troca de cor", () => {
    expect(tomDe("frio", "cuidado")).toBe("cuidado");
    expect(tomDe("frio", "nao-va")).toBe("frio");
    // ⚠️ `espera` divide o vermelho com `nao-va` DE PROPÓSITO: a cor responde
    // "dá pra ir AGORA?", e "espera 6h" é não-agora. Decisão de desenho, e este
    // teste é o que impede alguém de "consertá-la" por engano.
    expect(tomDe("frio", "espera")).toBe("frio");
  });

  // PROVA DE FONTE: em runtime, "o componente pergunta a `tomDe`" e "o
  // componente escreve o estado cru" pintam a MESMA tela enquanto o acervo não
  // tiver ficha `cuidado` num dia de chuva. É a divergência FUTURA que se quer
  // impedir, e ela só se vê na fonte.
  it("os que pintam data-state perguntam a tomDe — nenhum escreve o estado cru", () => {
    for (const arq of ["Moldura.tsx", "CartaoTrilha.tsx", "PinTrilha.tsx"]) {
      const src = readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8");
      const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // A tira precisa de guarda, senão a ausência abaixo passa por vacuidade.
      expect(codigo, `a tira comeu ${arq}`).toContain("data-state");
      expect(codigo, `${arq} parou de perguntar o tom`).toContain("tomDe(");
      expect(codigo, `${arq} voltou a pintar com o estado cru`).not.toMatch(
        /data-state=\{(leitura\.estado|naTela|estado)\}/,
      );
    }
  });
});

describe("a cor nova existe de verdade no CSS, nos dois temas", () => {
  // 🔴 Sem estas quatro, `tomDe` devolveria "cuidado" e o navegador não teria
  // regra nenhuma pra ele: o selo cairia no fundo padrão e a ficha ficaria SEM
  // cor de veredito — pior que a cor errada, porque não se vê que faltou.
  it("as quatro regras de [data-state=cuidado] existem e usam o token --care", () => {
    const ficha = semComentarios("ficha.css");
    const home = semComentarios("home.css");
    const alvos: [string[] | null, string][] = [
      [regraDe(ficha, `.bp[data-state="cuidado"] .stamp`), "ficha.css .stamp"],
      [regraDe(ficha, `.bp[data-state="cuidado"] .wp-pin`), "ficha.css .wp-pin"],
      [regraDe(home, `.bp .pin-home[data-state="cuidado"]::before`), "home.css .pin-home"],
      [regraDe(home, `.bp .cartao[data-state="cuidado"] .selo`), "home.css .selo"],
    ];
    for (const [corpo, onde] of alvos) {
      expect(corpo, `sem regra pra ${onde}`).toBeTruthy();
      expect(corpo!.join("\n"), `${onde} não usa --care`).toMatch(/var\(--care/);
    }
  });

  // 🔴 O DEFEITO QUE ESTES DOIS TRANCAM, e ele foi ao ar em 2026-09-10 sem que
  // ninguém pudesse vê-lo. O primeiro `--care-bg` (#F6EBD6) estava a **7,0** de
  // distância RGB do `--surface-2` do cartão, contra 17,9 do verde e 14,2 do
  // vermelho: o carimbo âmbar leria como **moldura vazada** ao lado de dois
  // irmãos que leem como caixa pintada. E o `--care-ink` velho punha a linha de
  // baixo (`molhado · sem pressa`) em **3,76:1**, a única das três abaixo do
  // mínimo de 4,5:1 — justamente onde moram as palavras novas.
  //
  // 🔴 E NENHUM OLHO PODERIA TER PEGO: o âmbar só aparece com chuva, e as três
  // trilhas estavam secas. Ele encontraria sozinho, no celular, na primeira
  // chuva, a 120 km de casa. **Cor que só aparece numa condição rara precisa de
  // prova ARITMÉTICA, porque a revisão visual não alcança.**
  const tokens = (metade: string): Record<string, string> =>
    Object.fromEntries(
      [...metade.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]),
    );
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const distancia = (a: string, b: string) =>
    Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  const luz = (h: string) => {
    const [r, g, b] = rgb(h).map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [luz(a), luz(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  /** A `.sub` do carimbo é desenhada com `opacity: .85` (ficha.css) — medir a
   *  cor crua mentiria a favor: são 5,01:1 cru contra 3,76:1 na tela. */
  const sobre = (fg: string, bg: string, o = 0.85) =>
    "#" +
    rgb(fg)
      .map((v, i) => Math.round(v * o + rgb(bg)[i] * (1 - o)).toString(16).padStart(2, "0"))
      .join("");

  const metades = () => {
    const ficha = semComentarios("ficha.css");
    const corte = ficha.indexOf("prefers-color-scheme");
    return [
      ["claro", tokens(ficha.slice(0, corte))],
      ["escuro", tokens(ficha.slice(corte))],
    ] as const;
  };

  it("o âmbar se afasta do cartão tanto quanto o verde e o vermelho — não é moldura vazada", () => {
    for (const [tema, t] of metades()) {
      const alvo = distancia(t["--care-bg"], t["--surface-2"]);
      const verde = distancia(t["--go-bg"], t["--surface-2"]);
      const vermelho = distancia(t["--stop-bg"], t["--surface-2"]);
      // O piso é o MENOR dos dois irmãos, e não um número que eu escolhi: a
      // régua é "lê como caixa pintada igual aos outros", e quem define isso é
      // a paleta que já existe. Se um dia o vermelho se aproximar do cartão,
      // este teste afrouxa junto — de propósito.
      expect(alvo, `tema ${tema}: âmbar a ${alvo.toFixed(1)} do cartão`).toBeGreaterThanOrEqual(
        Math.min(verde, vermelho),
      );
    }
  });

  it("a linha de baixo do carimbo âmbar passa de 4,5:1 — é onde moram as palavras novas", () => {
    for (const [tema, t] of metades()) {
      const naTela = contraste(sobre(t["--care-ink"], t["--care-bg"]), t["--care-bg"]);
      expect(naTela, `tema ${tema}: .sub âmbar em ${naTela.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      // Controle: a conta acusa de verdade. O valor que foi ao ar (#8A5A0E
      // sobre #F6EBD6) tem que REPROVAR nesta mesma função — senão ela está
      // medindo outra coisa e passaria pra sempre.
      expect(contraste(sobre("#8A5A0E", "#F6EBD6"), "#F6EBD6")).toBeLessThan(4.5);
    }
  });

  it("o token --care é definido no tema claro E no escuro", () => {
    const ficha = semComentarios("ficha.css");
    const corte = ficha.indexOf("prefers-color-scheme");
    expect(corte).toBeGreaterThan(0);
    for (const metade of [ficha.slice(0, corte), ficha.slice(corte)]) {
      expect(metade).toMatch(/--care:/);
      expect(metade).toMatch(/--care-ink:/);
      expect(metade).toMatch(/--care-bg:/);
    }
  });
});

describe("as palavras saíram do carimbo-fase de verdade", () => {
  // CONTRAÇÃO: mover as palavras sem apagar as antigas deixaria as duas fontes
  // vivas — e a antiga é a que alguém vai editar sem saber.
  it("o ramo molhado não tem mais palavra escrita à mão em carimbo-fase.ts", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "lib", "carimbo-fase.ts"), "utf8");
    const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(codigo, "a tira comeu o arquivo").toContain("falaMolhada(");
    expect(codigo, "a palavra molhada voltou pro carimbo-fase").not.toMatch(
      /"Não vá"|"barro · dá um tempo"/,
    );
    // Controle: o ramo SECO continua aqui, e é o certo — ele não depende do nível.
    expect(codigo).toContain(`"Pode ir"`);
    expect(codigo).toContain(`"seco · carro comum"`);
  });
});
