import { describe, expect, it } from "vitest";
import { REGRAS, violacoesDoAcervo } from "@/lib/coerencia";
import { loadAll } from "@/lib/ficha";
import { DIAS, type Dia } from "@/lib/semana";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";
import { fichaSchema, type Ficha } from "@/types/ficha";

/** 🔴 O TESTE DO MÓDULO DE COERÊNCIA — e ele é o guarda da Task 2 inteira.
 *
 *  As regras que este arquivo exercita moravam DENTRO de
 *  `tests/lib/coerencia-acervo.test.ts`. Teste roda no computador do
 *  desenvolvedor, antes do deploy: um lugar que o dono editar do celular numa
 *  terça de manhã nunca passaria por nenhuma delas. Elas viraram
 *  `src/lib/coerencia.ts`, que é código de produção e vai ser chamado pela
 *  porta de escrita do painel.
 *
 *  ⚠️ O QUE ESTE ARQUIVO PROVA, e é diferente do que o arquivo de acervo prova:
 *  lá se prova que o ACERVO REAL está coerente; aqui se prova que o MÓDULO
 *  ainda sabe acusar. Um módulo que devolvesse `[]` pra tudo passaria no
 *  arquivo de lá com louvor.
 *
 *  🔴 A ASSERÇÃO É SEMPRE PELO NOME DA REGRA, nunca "tem violação". Duas portas
 *  em série já morderam nesta branch: `expect(...).not.toEqual([])` fica verde
 *  quando uma regra DIFERENTE da que se quis testar dispara, e o teste nunca
 *  soube quem recusou. */

const ACERVO = loadAll();

function de(slug: string): Ficha {
  const f = ACERVO.find((x) => x.slug === slug);
  if (!f) {
    throw new Error(
      `A ficha "${slug}" saiu do acervo. As quebras deste arquivo são escritas ` +
        "em cima de fichas reais de propósito (uma fixture sintética não " +
        "provaria que a regra funciona no que o dono escreve). Reescreva a " +
        "quebra em cima de uma ficha que exista — nunca apague o caso.",
    );
  }
  return structuredClone(f) as Ficha;
}

const rampa = () => de("rampa-do-pepe");
const veu = () => de("veu-de-noiva-de-bonito");
const pedra = () => de("pedra-furada-de-venturosa");

/** O acervo inteiro com as fichas dadas TROCADAS pelas versões quebradas.
 *
 *  Nunca só a ficha quebrada sozinha: quatro das regras comparam uma ficha com
 *  as OUTRAS, e um acervo de um elemento não tem com quem comparar. */
const com = (...quebradas: Ficha[]): Ficha[] => [
  ...quebradas,
  ...ACERVO.filter((x) => !quebradas.some((q) => q.slug === x.slug)),
];

/** 🔴 UMA QUEBRA POR REGRA, e é o ponto desta tarefa: é a prova de que nenhuma
 *  das regras se perdeu na extração dos testes pro módulo. Cada entrada quebra
 *  o defeito real que motivou aquela regra — o comentário de cada uma mora em
 *  `src/lib/coerencia.ts`, junto da regra. */
const QUEBRAS: Record<string, () => Ficha[]> = {
  // "cinco reais" é preço pra gente e não é preço pro app: o chip do topo
  // ficaria sem nada pra mostrar.
  "preco-legivel-no-custo": () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "cinco reais por pessoa, cobrados no portão" };
    return com(f);
  },

  // O defeito dos centavos, entrando pelo conteúdo: o chip anuncia METADE do
  // que o lugar cobra.
  "chip-bate-com-preco": () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "R$ 10,00", curto: "R$ 5" };
    return com(f);
  },

  "chip-cabe-na-pilula": () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "R$ 5 por pessoa · cobrado no portão", curto: "R$ 5 no portão da frente" };
    return com(f);
  },

  "chip-nao-repete-a-linha": () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "R$ 5 · portão", curto: "R$ 5 · portão" };
    return com(f);
  },

  // A mentira de 2026-08-26 reintroduzida por conteúdo: o app dizendo "a serra
  // firmou" sobre uma cachoeira do brejo.
  "frase-emprestada": () => {
    const f = veu();
    f.secaRapido = rampa().secaRapido;
    return com(f);
  },

  "texto-emprestado": () => {
    const f = veu();
    f.promessa = rampa().promessa;
    return com(f);
  },

  // `piso: "asfalto-tapete"` numa ficha cuja própria prosa diz barro.
  "prosa-bate-com-piso": () => {
    const f = rampa();
    f.piso = "asfalto-tapete";
    return com(f);
  },

  // `abre: "17:00", fecha: "08:00"` por engano: o app anuncia a trilha aberta a
  // noite toda e fechada o dia todo.
  "horario-invertido-sem-aviso": () => {
    const f = rampa();
    f.horario = [{ abre: "17:00", fecha: "08:00" }];
    return com(f);
  },

  "hora-de-fechar-sem-campo": () => {
    const f = rampa(); // a Rampa não tem `horario`
    f.avisos = `${f.avisos} O lugar fecha às 16h.`;
    return com(f);
  },

  // A prosa da Véu de Noiva diz "fecha às 17h"; o campo passa a dizer outra
  // hora, e as duas frases aparecem na MESMA tela.
  "prosa-bate-com-hora-de-fechar": () => {
    const f = veu();
    f.horario = [{ abre: "08:00", fecha: "15:00" }];
    return com(f);
  },

  // ⚠️ Até 2026-10-01 esta quebra zerava UMA janela. Cada uma passou a valer
  // zero sozinha (decisões do João, no mesmo dia: a previsão, e depois o
  // passado, simétrico). O que continua sendo regra que nunca vê chuva nenhuma
  // é o PAR: as duas janelas em zero.
  "janela-nao-zerada": () => {
    const f = pedra();
    f.condicao.regra.janela_passado_horas = 0;
    f.condicao.regra.janela_previsao_horas = 0;
    return com(f);
  },

  // `480` no lugar de `48`: um dígito a mais, e a Open-Meteo recusa a busca da
  // tela inicial inteira.
  "janela-dentro-do-provedor": () => {
    const f = pedra();
    f.condicao.regra.janela_previsao_horas = 480;
    return com(f);
  },

  "dia-repetido-ou-inventado": () => {
    const f = rampa();
    f.dias = ["sab", "sab"];
    return com(f);
  },

  "semana-inteira-nao-declara": () => {
    const f = rampa();
    f.dias = [...DIAS];
    return com(f);
  },
};

describe("violacoesDoAcervo", () => {
  it("o acervo real de hoje não tem violação nenhuma", () => {
    expect(
      violacoesDoAcervo(ACERVO).map((v) => `${v.regra} · ${v.frase}`),
      "o acervo real ficou incoerente, ou uma regra nova nasceu vermelha",
    ).toEqual([]);
  });

  // 🔴 NÃO-VACUIDADE, e é o guarda desta tarefa. Sem ele, um módulo que devolve
  // `[]` pra tudo passa no teste de cima e a porta fica escancarada.
  //
  // 🔴 E ELE NÃO SE CONTENTA COM A UNIÃO. A forma fraca — juntar todas as
  // violações de todas as quebras num `Set` e conferir que o `Set` cobre
  // `REGRAS` — fica verde quando a quebra escrita pra regra A dispara só a
  // regra B, e alguma outra quebra por acaso dispara a A. Aqui cada quebra é
  // cobrada pela SUA regra, uma a uma.
  it("cada uma das 14 regras dispara na quebra escrita pra ela", () => {
    expect(
      Object.keys(QUEBRAS).sort(),
      "ou nasceu regra sem quebra (a extração perdeu a prova dela), ou há quebra " +
        "de uma regra que não existe mais no módulo",
    ).toEqual([...REGRAS].sort());

    const mudas = Object.entries(QUEBRAS).filter(
      ([regra, quebrar]) => !violacoesDoAcervo(quebrar()).some((v) => v.regra === regra),
    );
    expect(
      mudas.map(([regra]) => regra),
      "a quebra escrita pra esta regra não a fez disparar — ou a regra sumiu do " +
        "módulo, ou ela parou de ver o defeito que a motivou",
    ).toEqual([]);
  });

  // 🔴 O NÚMERO É CRAVADO À MÃO, como todo número deste projeto, e o porquê de
  // a extração dar 13 e não 15 está no docblock de `src/lib/coerencia.ts` — a
  // 14ª (`janela-dentro-do-provedor`) nasceu depois, na onda de conserto 1 da
  // Tarefa 7. Sem ele, apagar uma regra E a quebra dela junto deixaria a suíte
  // verde.
  it("o módulo tem 14 regras, e cada identificador aparece uma vez só", () => {
    expect(REGRAS.length, "uma regra entrou ou saiu do módulo sem passar por aqui").toBe(14);
    expect(new Set(REGRAS).size, "duas regras com o mesmo identificador").toBe(14);
  });

  it("o chip que não bate com o preço é pego", () => {
    const f = rampa();
    f.custo = { ...f.custo, valor: "R$ 10,00", curto: "R$ 5" };
    const v = violacoesDoAcervo(com(f));
    expect(v.map((x) => x.regra)).toContain("chip-bate-com-preco");
    const chip = v.find((x) => x.regra === "chip-bate-com-preco")!;
    expect(chip.frase).toMatch(/R\$ 5/);
    expect(chip.frase).toMatch(/R\$ 10,00/);
    expect(chip.slug).toBe(f.slug);
  });

  it("a prosa que nomeia piso diferente do campo é pega", () => {
    const f = rampa();
    f.piso = "asfalto-tapete";
    f.acesso = "a estrada é de barro até o portão";
    const v = violacoesDoAcervo(com(f));
    expect(v.map((x) => x.regra)).toContain("prosa-bate-com-piso");
    expect(v.find((x) => x.regra === "prosa-bate-com-piso")!.frase).toMatch(/barro/);
  });

  it("uma ficha que empresta a frase de outra é pega", () => {
    const f = veu();
    f.secaRapido = rampa().secaRapido;
    const v = violacoesDoAcervo(com(f));
    expect(v.map((x) => x.regra)).toContain("frase-emprestada");
  });

  // 🔴 A COMPARAÇÃO É ENTRE FICHAS, E NÃO DA FICHA CONSIGO MESMA. Sem este
  // caso, trocar `i !== j` por `i === i` no módulo passaria despercebido: toda
  // ficha é igual a si mesma, e a regra acusaria o acervo INTEIRO — o que o
  // primeiro teste deste arquivo pega, mas só por sorte de ordem.
  it("a ficha sozinha, com a frase dela mesma, não é acusada de emprestar", () => {
    expect(violacoesDoAcervo([rampa()]).map((x) => x.regra)).not.toContain("frase-emprestada");
    expect(violacoesDoAcervo([rampa()]).map((x) => x.regra)).not.toContain("texto-emprestado");
  });

  it("janela de chuva zerada é pega", () => {
    const f = rampa();
    f.condicao.regra.janela_passado_horas = 0;
    f.condicao.regra.janela_previsao_horas = 0;
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).toContain("janela-nao-zerada");
  });

  it("a frase da violação nomeia o lugar e não é o identificador da regra", () => {
    const f = rampa();
    f.condicao.regra.limiar_mm = 0;
    const v = violacoesDoAcervo([f]);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].frase.length).toBeGreaterThan(20);
    expect(v[0].frase).not.toBe(v[0].regra);
    expect(v[0].frase).toContain(f.trajeto.waypoints[0].nome);
  });

  // 🔴 TAREFA 11b (11b-M1): dois lugares podem ter o MESMO nome. Nas frases que
  // comparam dois lugares, só o nome sairia "Lugar e Lugar têm a voz igual" —
  // a cidade entre parênteses é o que diz de QUAL lugar se fala. Cidades
  // marcadoras, sobre um nome real que já está no acervo.
  it("a frase que compara dois lugares de mesmo nome leva a cidade de cada um", () => {
    const um = { ...de("rampa-do-pepe"), cidade: "Cidade Marcador Um" };
    const dois = { ...de("rampa-do-pepe"), slug: "marcador-gemeo", cidade: "Cidade Marcador Dois" };
    const v = violacoesDoAcervo([um, dois]).find((x) => x.regra === "texto-emprestado");
    expect(v, "a premissa: dois lugares de voz igual violam texto-emprestado").toBeDefined();
    const nome = um.trajeto.waypoints[0].nome;
    expect(v!.frase).toContain(`${nome} (Cidade Marcador Um) e ${nome} (Cidade Marcador Dois)`);
    // e sem cidade, só o nome — nenhum parêntese vazio
    const sem = violacoesDoAcervo([de("rampa-do-pepe"), { ...de("rampa-do-pepe"), slug: "marcador-gemeo" }]);
    expect(sem.find((x) => x.regra === "texto-emprestado")!.frase).toContain(`${nome} e ${nome} têm`);
  });

  // 🔴 A frase vai pra TELA DO DONO, no celular, no meio de uma edição. Se ela
  // trouxer o identificador da regra ou o slug cru, ele lê jargão em vez de ler
  // o que está errado. Vale pras 14, não só pra uma.
  it("nenhuma frase carrega o identificador da regra nem jargão de código", () => {
    const todas = Object.values(QUEBRAS).flatMap((quebrar) => violacoesDoAcervo(quebrar()));
    expect(todas.length, "nenhuma quebra produziu violação: o teste abaixo ficaria oco")
      .toBeGreaterThanOrEqual(14);
    for (const v of todas) {
      expect(v.frase, `${v.regra}: a frase repete o identificador da regra`).not.toContain(v.regra);
      expect(v.frase, `${v.regra}: a frase mostra o slug cru em vez do nome do lugar`)
        .not.toContain(v.slug);
      expect(v.frase.length, `${v.regra}: a frase é curta demais pra dizer o que está errado`)
        .toBeGreaterThan(20);
    }
  });

  // 🔴 OS CINCO CASOS ABAIXO NASCERAM DE MUTAÇÃO SOBREVIVENTE, medida nesta
  // tarefa, e as cinco eram A MESMA ESPÉCIE: **regra que confere VÁRIAS coisas,
  // provada por UMA só.** Uma quebra por regra não basta quando a regra tem
  // mais de um exame dentro — desligar o exame não exercitado deixava a suíte
  // verde. As mutações que sobreviveram até estes casos existirem:
  //   - desligar o `janela_passado_horas` (a quebra só zerava a previsão);
  //   - tirar `rotulo_escaneio` da lista de textos que distinguem;
  //   - tirar `voz` da mesma lista (a quebra só copiava a `promessa`);
  //   - desligar o exame do nome de dia inventado (a quebra só repetia o dia);
  //   - arrancar a válvula de escape do horário invertido — a regra passava a
  //     acusar um lugar que abre à noite DE PROPÓSITO, e nada reclamava.

  // ⚠️ AS DUAS JANELAS ENTRAM COM `-1`, não `0`: desde 2026-10-01 cada janela
  // vale zero sozinha (decisões do João). O exame de cada uma existe e recusa o
  // negativo; o par 0/0 tem caso próprio, abaixo.
  it("a janela de chuva é conferida nos TRÊS números, um a um", () => {
    for (const [campo, valor] of [
      ["janela_passado_horas", -1],
      ["janela_previsao_horas", -1],
      ["limiar_mm", 0],
    ] as const) {
      const f = rampa();
      f.condicao.regra[campo] = valor;
      expect(
        violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada").length,
        `${campo} = ${valor} não produziu violação: esse exame da regra está desligado`,
      ).toBe(1);
    }
  });

  // 🔴 PREVISÃO ZERO VALE — decisão do João, 2026-10-01: "só olhar a chuva que já
  // caiu". Medido com `avaliar` (previsão 0, passado 6, limiar 0.2): 5 mm uma
  // hora atrás → `frio`; seco → `fresco`. A regra fecha pelo passado.
  it("previsão ZERO sozinha não é violação: a regra ainda fecha pelo passado", () => {
    const f = rampa();
    f.condicao.regra.janela_previsao_horas = 0;
    expect(f.condicao.regra.janela_passado_horas, "a premissa: o passado está vivo").toBeGreaterThan(0);
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).not.toContain("janela-nao-zerada");
  });

  // 🔴 E O PAR QUE NUNCA FECHA CONTINUA RECUSADO: previsão 0 E passado 0 não vê
  // chuva nenhuma. A frase que sai é a do PASSADO, e nesse par ela é verdade.
  it("previsão 0 E passado 0: violação, com a frase de que o lugar nunca fecha", () => {
    const f = rampa();
    f.condicao.regra.janela_previsao_horas = 0;
    f.condicao.regra.janela_passado_horas = 0;
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada");
    expect(v).toHaveLength(1);
    expect(v[0].frase).toContain("nunca fecha");
    expect(v[0].frase).toContain("pra trás");
  });

  // 🔴 PASSADO ZERO VALE — decisão do João, 2026-10-01, simétrica à da
  // previsão. Medido com `avaliar` (passado 0, previsão 6, limiar 0.2): 5 mm uma
  // hora adiante → `frio`; seco → `fresco`. A regra fecha pela previsão.
  it("passado ZERO sozinho não é violação: a regra ainda fecha pela previsão", () => {
    const f = rampa();
    f.condicao.regra.janela_passado_horas = 0;
    expect(f.condicao.regra.janela_previsao_horas, "a premissa: a previsão está viva").toBeGreaterThan(0);
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).not.toContain("janela-nao-zerada");
  });

  // O par visto pelo outro lado: passado 0 com previsão NEGATIVA também nunca
  // fecha (nenhuma hora adiante entra na soma), e as duas frases saem — a do
  // par e a do negativo.
  it("passado 0 E previsão negativa: as duas frases, a do par e a do negativo", () => {
    const f = rampa();
    f.condicao.regra.janela_passado_horas = 0;
    f.condicao.regra.janela_previsao_horas = -2;
    const frases = violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada").map((x) => x.frase);
    expect(frases).toHaveLength(2);
    expect(frases.some((x) => x.includes("nunca fecha"))).toBe(true);
    expect(frases.some((x) => x.includes("-2 horas pra frente"))).toBe(true);
  });

  it("passado NEGATIVO: a frase não diz que o lugar nunca fecha, e diz o número", () => {
    const f = rampa();
    f.condicao.regra.janela_passado_horas = -5;
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada");
    expect(v).toHaveLength(1);
    expect(v[0].frase).not.toContain("nunca fecha");
    expect(v[0].frase).toContain("-5 horas pra trás");
    expect(v[0].frase).toContain("janela negativa não existe");
  });

  it("previsão NEGATIVA: a frase não diz que o lugar nunca fecha, e aponta o 0", () => {
    const f = rampa();
    f.condicao.regra.janela_previsao_horas = -5;
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada");
    expect(v).toHaveLength(1);
    expect(v[0].frase).not.toContain("nunca fecha");
    expect(v[0].frase).toContain("-5 horas pra frente");
    expect(v[0].frase).toContain("use 0");
  });

  // 🔴 O TETO DO PROVEDOR (onda de conserto 1 da Tarefa 7), nas duas janelas e
  // nas duas direções: no teto passa, um acima é recusado, com o nome do lugar e
  // o número que ele digitou.
  it("a janela é conferida contra o teto do provedor, nas DUAS janelas, um a um", () => {
    for (const [campo, teto, lado] of [
      ["janela_previsao_horas", TETO_PREVISAO_HORAS, "pra frente"],
      ["janela_passado_horas", TETO_PASSADO_HORAS, "pra trás"],
    ] as const) {
      const noTeto = rampa();
      noTeto.condicao.regra[campo] = teto;
      expect(
        violacoesDoAcervo([noTeto]).filter((x) => x.regra === "janela-dentro-do-provedor"),
        `${campo} = ${teto} (o teto exato) foi recusado`,
      ).toEqual([]);

      for (const acima of [teto + 1, teto + 0.5]) {
        const f = rampa();
        f.condicao.regra[campo] = acima;
        const v = violacoesDoAcervo([f]).filter((x) => x.regra === "janela-dentro-do-provedor");
        expect(v, `${campo} = ${acima} passou pelo teto`).toHaveLength(1);
        expect(v[0].frase).toContain(f.trajeto.waypoints[0].nome);
        expect(v[0].frase).toContain(`${acima} horas ${lado}`);
        expect(v[0].frase).toContain(`${teto} horas`);
      }
    }
  });

  it("os QUATRO textos que distinguem um lugar do outro são conferidos, um a um", () => {
    for (const campo of ["voz", "promessa", "premio", "rotulo_escaneio"] as const) {
      const f = veu();
      f[campo] = rampa()[campo];
      expect(
        violacoesDoAcervo(com(f)).filter((x) => x.regra === "texto-emprestado").length,
        `copiar o campo ${campo} de uma ficha pra outra não produziu violação: esse ` +
          "campo saiu da lista dos que distinguem um lugar do outro",
      ).toBe(1);
    }
  });

  // 🔴 O `as Dia` É O PONTO DESTE CASO, não um contorno de tipo. Hoje o
  // `fichaSchema` barra um dia inventado, porque o enum é montado a partir de
  // `DIAS` — mas a porta de escrita do painel chama este módulo com o que o
  // DONO DIGITOU, e no dia em que o campo virar texto livre a única coisa entre
  // "segunda" escrito por extenso e a tela é esta regra.
  it("um nome de dia que não existe é pego, mesmo sem repetição nenhuma", () => {
    const f = rampa();
    f.dias = ["sab", "segunda" as Dia];
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "dia-repetido-ou-inventado");
    expect(v.length, "dia inventado sem repetição passou batido").toBe(1);
    expect(v[0].frase).toContain("segunda");
  });

  // A regra do horário invertido NÃO PROÍBE a travessia da noite: ela exige que
  // esteja DITA na ficha, que é o mesmo critério do piso. Sem este caso, quem
  // arrancasse a válvula de escape faria o app recusar a gravação de um lugar
  // que abre à noite de propósito — e a suíte ficaria verde, porque nenhuma
  // ficha do acervo de hoje abre à noite.
  it("a travessia da noite DITA na ficha passa — a regra exige o aviso, não proíbe o horário", () => {
    const f = rampa();
    f.horario = [{ abre: "17:00", fecha: "08:00" }];
    f.avisos = `${f.avisos} A visita é de madrugada: atravessa a noite inteira.`;
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).not.toContain("horario-invertido-sem-aviso");
  });

  // 🔴 AUSENTE É SILÊNCIO, e é a régua do projeto inteiro: ficha paga sem chip
  // mostra só o preço extraído do custo, e o app CALA sobre onde se paga em vez
  // de inventar um portão. As quatro regras de custo têm que deixar passar.
  it("ficha paga SEM chip é silêncio, não violação", () => {
    const f = rampa();
    f.custo = { tag: "pago", valor: f.custo.valor };
    const regras = violacoesDoAcervo([f]).map((x) => x.regra);
    for (const r of ["preco-legivel-no-custo", "chip-bate-com-preco", "chip-cabe-na-pilula",
      "chip-nao-repete-a-linha"]) {
      expect(regras, `a ficha paga sem chip foi acusada por ${r} — ausente virou afirmação`)
        .not.toContain(r);
    }

    // 🔴 E VALE TAMBÉM COM O CUSTO ESCRITO POR EXTENSO, o que parece contra-
    // intuitivo até se olhar a tela: quem exige preço extraível é o CHIP, que é
    // uma pílula de quatro palavras no topo. Sem chip não há nada pra ficar sem
    // número — a página imprime "Pago" e ao lado o texto dele por inteiro, que a
    // pessoa lê sem dificuldade. Este caso veio de uma mutação que sobreviveu
    // (arrancar a condição `!f.custo.curto` da regra do preço legível), e ele
    // prende a decisão em vez de deixá-la ser tomada por omissão.
    const semNumero = rampa();
    semNumero.custo = { tag: "pago", valor: "cinco reais por pessoa, cobrados no portão" };
    expect(
      violacoesDoAcervo([semNumero]).map((x) => x.regra),
      "ficha paga sem chip e com o custo por extenso foi acusada: a regra do preço " +
        "legível é sobre o CHIP, e aqui não há chip",
    ).not.toContain("preco-legivel-no-custo");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 RODADA DE CONSERTO DE 2026-09-27. Os casos abaixo nasceram de UM Critical
  //  e de SETE mutações que sobreviveram às 33 asserções desta suíte. Nenhum
  //  outro arquivo importa `@/lib/coerencia`, então estes dois arquivos são tudo
  //  que pode matar uma mutação no módulo — o que torna cada furo aqui um furo
  //  do projeto.
  //
  //  A espécie dominante é a mesma das seis da rodada anterior, um nível mais
  //  fundo: **não basta provar que cada EXAME dispara; é preciso provar cada
  //  GUARDA de silêncio e cada FRONTEIRA numérica.** Um `if (!campo) return []`
  //  que ninguém exercita é um falso positivo esperando a 4ª ficha; uma
  //  fronteira `<= 4` provada com 6 palavras deixa o 5 passar.
  //
  //  🔴 E DUAS DELAS ERAM FALSO POSITIVO QUE TRAVA O DONO — a classe mais cara
  //  que este módulo pode ter, porque ele agora RECUSA GRAVAÇÃO: o app afirmando
  //  demais sobre o que o João declarou, quando ele não declarou nada.
  // ═══════════════════════════════════════════════════════════════════════════

  // 🔴 CRITICAL de 2026-09-27. `piso` é opcional DE PROPÓSITO: é fato de roteiro,
  // e quem responde é quem conhece o lugar. Com `(f.piso ?? "")`, ficha sem piso
  // fazia TODO piso citado na prosa virar "estranho" — duas das três fichas reais
  // seriam recusadas com o campo em branco. O João escreve *"é estrada de barro,
  // molhou não vá"* na voz, palavra dele, deixa o piso vazio, e a porta recusava
  // a gravação dizendo que ele "declara o piso (nenhum)". Ele perdia a edição.
  it("ficha SEM piso é silêncio, mesmo com a prosa nomeando um piso", () => {
    for (const ficha of [rampa, veu, pedra]) {
      const f = ficha();
      delete f.piso;
      expect(
        violacoesDoAcervo(com(f)).filter((x) => x.regra === "prosa-bate-com-piso"),
        `${f.slug} sem piso foi acusada de contradizer a própria prosa — ela não ` +
          "declarou piso nenhum, e ausente é silêncio",
      ).toEqual([]);
    }
  });

  // 🔴 FALSO POSITIVO MEDIDO: com o `if (!f.secaRapido) continue` arrancado, duas
  // fichas SEM o campo colidem em `""` e o app diz que os dois lugares "explicam
  // o chão com a MESMA frase: """. Hoje só a Véu não tem o campo, então a
  // mutação sobrevivia; no 4º lugar sem `secaRapido`, a porta travaria o dono.
  it("duas fichas SEM secaRapido não emprestam frase uma da outra", () => {
    const a = rampa();
    const b = pedra();
    delete a.secaRapido;
    delete b.secaRapido;
    expect(
      violacoesDoAcervo([a, b, veu()]).filter((x) => x.regra === "frase-emprestada"),
      "duas fichas sem a frase do relevo foram acusadas de ter a MESMA frase: o " +
        "silêncio das duas virou um texto compartilhado",
    ).toEqual([]);
  });

  // 🔴 O caso "os QUATRO textos" prova que cada um dos quatro dispara — NÃO que a
  // lista é só esses quatro. Acrescentar `acesso` à lista sobrevivia a ele, e
  // recusaria dois lugares que compartilhem "a estrada é de barro até o portão" —
  // frase de CAMINHO, que dois lugares vizinhos podem legitimamente ter igual. O
  // gêmeo abaixo é idêntico em TODOS os campos, então o número de violações de
  // `texto-emprestado` é exatamente o tamanho da lista.
  it("a lista dos textos que distinguem tem EXATAMENTE quatro campos", () => {
    const gemeo = { ...rampa(), slug: "gemeo-sintetico" };
    expect(
      violacoesDoAcervo([rampa(), gemeo]).filter((x) => x.regra === "texto-emprestado").length,
      "uma ficha idêntica a outra em TODOS os campos produziu um número de violações " +
        "diferente de 4: ou um campo entrou na lista dos que distinguem (e aí o nome " +
        "do caso `os QUATRO textos` ficou falso), ou um saiu",
    ).toBe(4);
  });

  it("campo de prosa fora da lista pode ser igual em duas fichas", () => {
    for (const campo of ["acesso", "avisos"] as const) {
      const f = veu();
      f[campo] = rampa()[campo];
      expect(
        violacoesDoAcervo(com(f)).filter((x) => x.regra === "texto-emprestado"),
        `${campo} igual em duas fichas foi acusado: esse texto não existe pra ` +
          "distinguir um lugar do outro, e dois lugares vizinhos podem chegar pela " +
          "mesma estrada",
      ).toEqual([]);
    }
  });

  // Ficha GRÁTIS carregando `valor`/`curto` é o que o schema permite (os dois são
  // opcionais e independem do `tag`). As quatro regras de custo só falam de quem
  // COBRA — sem o `tag !== "pago"`, uma ficha grátis com chip seria acusada de
  // não ter preço.
  it("ficha grátis não é medida por regra de custo nenhuma", () => {
    const f = rampa();
    f.custo = { tag: "gratis", valor: "cinco reais", curto: "R$ 5 · portão" };
    const regras = violacoesDoAcervo([f]).map((x) => x.regra);
    for (const r of ["preco-legivel-no-custo", "chip-bate-com-preco", "chip-cabe-na-pilula",
      "chip-nao-repete-a-linha"]) {
      expect(regras, `ficha grátis foi acusada por ${r}`).not.toContain(r);
    }
  });

  // As regras 1 e 2 são MUTUAMENTE EXCLUSIVAS de propósito: sem preço legível no
  // custo não há o que comparar com o chip, e mostrar dois erros diferentes pro
  // mesmo defeito faz o dono consertar duas vezes a mesma coisa.
  it("custo sem preço legível dá UM erro, não dois", () => {
    const f = rampa();
    f.custo = { tag: "pago", valor: "cinco reais por pessoa", curto: "R$ 5" };
    const v = violacoesDoAcervo([f]).filter((x) => x.regra.startsWith("preco-") || x.regra.startsWith("chip-"));
    expect(v.map((x) => x.regra), "o mesmo defeito de custo produziu mais de uma frase")
      .toEqual(["preco-legivel-no-custo"]);
  });

  // 🔴 A FRONTEIRA DO CHIP É 4, e a quebra da tabela usa 6 — `<= 5` sobrevivia a
  // ela. Chip de 5 palavras estoura a pílula e passaria na porta.
  it("o chip cabe com 4 palavras e não cabe com 5", () => {
    const base = (curto: string) => {
      const f = rampa();
      f.custo = { tag: "pago", valor: "R$ 5 · portão da entrada", curto };
      return violacoesDoAcervo([f]).filter((x) => x.regra === "chip-cabe-na-pilula");
    };
    expect(base("R$ 5 · portão"), "chip de 4 palavras foi recusado").toEqual([]);
    expect(base("R$ 5 · portão grande").length, "chip de 5 palavras passou").toBe(1);
  });

  // 🔴 `abre === fecha` É ACUSADO, e a frase dele é OUTRA. `fechadoNaHora`
  // (`dentroDaFaixa`, em `src/lib/horario.ts`) lê horários iguais como **24h: nunca fecha**, não
  // como travessia da meia-noite — dizer a esse dono que o app vai anunciar o
  // lugar "aberto a noite toda e fechada o dia todo" seria descrever outro caso.
  // Sem este par de asserções, trocar `<` por `<=` sobrevive.
  it("horário igual em abre e fecha é acusado, e a frase fala de 24 horas", () => {
    const f = rampa();
    f.horario = [{ abre: "08:00", fecha: "08:00" }];
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "horario-invertido-sem-aviso");
    expect(v.length, "abrir e fechar no mesmo horário passou batido").toBe(1);
    expect(v[0].frase, "a frase do horário igual descreve o caso invertido").toContain("24 horas");
    expect(v[0].frase).not.toContain("noite toda");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 RODADA 2/5 — FRASE COM BIFURCAÇÃO PRECISA DE PROVA DE TEXTO EM CADA RAMO.
  //
  //  Achado: a bifurcação que eu mesmo introduzi na rodada 1/5 (frase de "24
  //  horas" × frase de "noite toda") tinha asserção de conteúdo só num lado.
  //  Colapsar a ternária pro ramo das 24h deixava as 46 asserções VERDES — e uma
  //  ficha que abre à noite de verdade passaria a ler "está aberto 24 horas e
  //  nunca fecha". Nenhum outro arquivo importa a lógica de frases do módulo (a
  //  página importa só o `PRECO`), então estes dois arquivos são tudo que pode
  //  matar.
  //
  //  🔴 A varredura achou **TRÊS** bifurcações nessa situação, não uma — as
  //  outras duas eram `??` dentro da frase, e as duas escondiam um defeito
  //  DIFERENTE do que a frase descrevia:
  //   - `custo.valor ?? ""` dizia *"o custo está escrito como """* quando o campo
  //     está AUSENTE. Ele não escreveu vazio, não escreveu nada;
  //   - `noCurto ?? "nenhum preço"` produzia *"o chip do topo diz nenhum preço"*,
  //     que além de não ser português escondia o caso do chip sem número dentro.
  //
  //  Os três casos abaixo são simétricos: cada ramo tem a frase dele afirmada E
  //  a do outro ramo negada, e há mutação colapsando cada bifurcação nos dois
  //  sentidos.
  // ═══════════════════════════════════════════════════════════════════════════

  it("a ficha genuinamente invertida recebe a frase da noite, não a das 24 horas", () => {
    const f = rampa();
    f.horario = [{ abre: "17:00", fecha: "08:00" }];
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "horario-invertido-sem-aviso");
    expect(v.length, "horário invertido de verdade passou batido").toBe(1);
    expect(v[0].frase, "a ficha invertida recebeu a frase do caso de 24 horas")
      .toContain("noite toda");
    expect(v[0].frase).not.toContain("24 horas");
  });

  // 🔴 PARTIDOS EM DOIS na rodada 4/5 — 48ª espécie do catálogo: um `it` só,
  // com as DUAS metades da bifurcação dentro, é provado por inteiro ou por
  // nada. E tinha uma consequência medida: o harness de mutação só enxerga o
  // NOME do `it`, então B2a (que força o ramo ilegível) e B2b (que força o
  // ramo ausente) eram obrigados a declarar o MESMO teste em `mata`, sendo
  // metades OPOSTAS. Com os quatro `it` separados, cada mutação declara o lado
  // que ela desliga, e o dia em que uma virar cópia da outra o guarda acusa.
  it("custo completo AUSENTE recebe a frase do campo vazio", () => {
    const ausente = rampa();
    ausente.custo = { tag: "pago", curto: "R$ 5 · portão" };
    const a = violacoesDoAcervo([ausente]).filter((x) => x.regra === "preco-legivel-no-custo");
    expect(a.length, "ficha paga com chip e sem custo completo passou batido").toBe(1);
    expect(a[0].frase, "a frase do campo ausente diz que ele escreveu algo")
      .not.toMatch(/escrito como/);
    expect(a[0].frase).toContain("vazio");
  });

  it("custo completo ILEGÍVEL mostra por extenso o que ele escreveu", () => {
    const ilegivel = rampa();
    ilegivel.custo = { tag: "pago", valor: "cinco reais por pessoa", curto: "R$ 5 · portão" };
    const b = violacoesDoAcervo([ilegivel]).filter((x) => x.regra === "preco-legivel-no-custo");
    expect(b.length, "custo ilegível passou batido").toBe(1);
    expect(b[0].frase, "a frase do custo ilegível não mostra o que ele escreveu")
      .toContain("cinco reais por pessoa");
    expect(b[0].frase).not.toContain("vazio");
  });

  it("chip SEM número recebe a frase de não mostrar preço nenhum", () => {
    const semNumero = rampa();
    semNumero.custo = { tag: "pago", valor: "R$ 5 · portão da entrada", curto: "no portão" };
    const a = violacoesDoAcervo([semNumero]).filter((x) => x.regra === "chip-bate-com-preco");
    expect(a.length, "chip sem número nenhum passou batido").toBe(1);
    expect(a[0].frase, 'a frase do chip sem número virou "diz nenhum preço"')
      .not.toMatch(/diz nenhum/);
    expect(a[0].frase).toContain("não mostra preço nenhum");
  });

  it("chip com número DIVERGENTE mostra os dois preços lado a lado", () => {
    const divergente = rampa();
    divergente.custo = { tag: "pago", valor: "R$ 10,00", curto: "R$ 5" };
    const b = violacoesDoAcervo([divergente]).filter((x) => x.regra === "chip-bate-com-preco");
    expect(b.length, "chip divergente passou batido").toBe(1);
    expect(b[0].frase, "a frase do chip divergente não mostra os dois preços")
      .toMatch(/R\$ 5.*R\$ 10,00/);
    expect(b[0].frase).not.toContain("não mostra preço nenhum");
  });

  // 🔴 O HORÁRIO COM INTERVALO (Tarefa 11c). As três regras da hora passaram a
  // ler a LISTA de faixas, e cada uma tem prova com mais de uma faixa — senão
  // uma regra que só lesse a faixa 0 passaria verde com as fichas de hoje, que
  // têm uma faixa só.
  it("com intervalo, a faixa invertida é achada mesmo não sendo a primeira", () => {
    const f = rampa();
    f.horario = [{ abre: "06:00", fecha: "08:00" }, { abre: "17:00", fecha: "08:00" }];
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "horario-invertido-sem-aviso");
    expect(v.length, "a segunda faixa invertida passou batida").toBe(1);
    expect(v[0].frase).toContain("abre às 17:00 e fecha às 08:00");
  });

  it("com intervalo e as faixas certas, a regra do horário invertido cala", () => {
    const f = rampa();
    f.horario = [{ abre: "08:00", fecha: "10:00" }, { abre: "14:00", fecha: "17:00" }];
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).not.toContain("horario-invertido-sem-aviso");
  });

  // H4 do brief: "a hora de fechar" da prosa é o fim do dia (a ÚLTIMA faixa), e
  // a hora de fechar de uma faixa do MEIO também vale — "fecha às 10h pro
  // almoço" é verdade sobre um lugar de 8–10 e 14–17.
  it("com intervalo, a prosa pode citar o fechamento da última faixa ou de uma do meio", () => {
    const f = veu(); // a prosa da Véu diz "fecha às 17h"
    f.horario = [{ abre: "08:00", fecha: "10:00" }, { abre: "14:00", fecha: "17:00" }];
    expect(violacoesDoAcervo([f]).map((x) => x.regra), "o fim do dia não foi aceito").not.toContain(
      "prosa-bate-com-hora-de-fechar",
    );
    const meio = rampa();
    meio.avisos = `${meio.avisos} Fecha às 10h pro almoço.`;
    meio.horario = [{ abre: "08:00", fecha: "10:00" }, { abre: "14:00", fecha: "17:00" }];
    expect(violacoesDoAcervo([meio]).map((x) => x.regra), "a faixa do meio não foi aceita").not.toContain(
      "prosa-bate-com-hora-de-fechar",
    );
  });

  it("com intervalo, uma hora que não fecha faixa nenhuma é acusada, e a frase diz o fim do dia", () => {
    const f = veu(); // "fecha às 17h"
    f.horario = [{ abre: "08:00", fecha: "10:00" }, { abre: "14:00", fecha: "16:00" }];
    const v = violacoesDoAcervo([f]).filter((x) => x.regra === "prosa-bate-com-hora-de-fechar");
    expect(v.length, "17h não fecha faixa nenhuma e passou").toBe(1);
    expect(v[0].frase).toContain("o horário da ficha diz 16:00");
  });

  it("um minuto de faixa já é faixa normal, e passa calado", () => {
    const f = rampa();
    f.horario = [{ abre: "08:00", fecha: "08:01" }];
    expect(violacoesDoAcervo([f]).map((x) => x.regra)).not.toContain("horario-invertido-sem-aviso");
  });

  // 🔴 ELE DIGITA SEM ACENTO, e as duas regras da hora têm que enxergar. A quebra
  // da tabela escreve "às", então `(?:às|as)` → `às` sobrevivia a ela — e a regra
  // ficava cega justamente na grafia mais provável num teclado de celular.
  it("a hora citada na prosa é lida com acento e sem acento", () => {
    const semCampo = rampa(); // a Rampa não tem `horario`
    semCampo.avisos = `${semCampo.avisos} O lugar fecha as 16h.`;
    expect(
      violacoesDoAcervo([semCampo]).map((x) => x.regra),
      '"fecha as 16h" sem acento passou batido',
    ).toContain("hora-de-fechar-sem-campo");

    const comCampo = rampa();
    comCampo.avisos = `${comCampo.avisos} O lugar fecha as 16h.`;
    comCampo.horario = [{ abre: "05:00", fecha: "17:00" }];
    expect(
      violacoesDoAcervo([comCampo]).map((x) => x.regra),
      '"fecha as 16h" sem acento não foi comparado com o campo',
    ).toContain("prosa-bate-com-hora-de-fechar");
  });

  // 🔴 A frase dizia ao dono que SEGUNDA-FEIRA não é dia da semana. É, claro que
  // é; o que o app não reconhece é a grafia. E ela tem que mostrar as sete
  // palavras que ele pode usar, senão ele adivinha de novo.
  it("a frase do dia não reconhecido fala de GRAFIA e mostra os sete dias", () => {
    const f = rampa();
    f.dias = ["sab", "segunda" as Dia];
    const v = violacoesDoAcervo([f]).find((x) => x.regra === "dia-repetido-ou-inventado")!;
    expect(v.frase, "a frase continua negando que segunda seja dia da semana")
      .not.toMatch(/não é dia da semana/i);
    for (const d of DIAS) {
      expect(v.frase, `a frase não mostra "${d}", que é uma das palavras que ele pode usar`)
        .toContain(d);
    }
  });

  // 🔴 A frase mandava "deixe a lista de dias vazia", e `dias` é
  // `z.array(...).min(1).optional()`: lista VAZIA é inválida. Seguindo a
  // instrução da tela, ele levava um segundo erro de outra natureza. Este caso
  // amarra a frase ao schema — se um dia `[]` passar a valer, ele fica vermelho e
  // a frase pode mudar.
  it("a frase da semana inteira não manda esvaziar a lista, porque o schema recusa", () => {
    expect(
      fichaSchema.safeParse({ ...rampa(), dias: [] }).success,
      "`dias: []` passou a ser válido — a frase desta regra pode ser reescrita",
    ).toBe(false);

    const f = rampa();
    f.dias = [...DIAS];
    const v = violacoesDoAcervo([f]).find((x) => x.regra === "semana-inteira-nao-declara")!;
    expect(v.frase, "a frase manda o dono deixar vazio o que o schema recusa vazio")
      .not.toMatch(/vazi[ao]/i);
  });

  // 🔴 RULING P3: a coerência enxerga o acervo INTEIRO, inclusive o que estiver
  // escondido da tela pública. Quem chama monta a lista; este módulo não filtra
  // nada e não sabe o que é visível. Um lugar escondido VOLTA — e se a
  // comparação de frases o ignorasse, o dono poderia escrever no lugar A a
  // frase do lugar B escondido, e o defeito só apareceria no dia em que
  // reexibisse B.
  it("a comparação entre fichas vale pra toda ficha da lista recebida, sem filtro", () => {
    const f = veu();
    f.secaRapido = pedra().secaRapido;
    // Só as duas, como se o resto do acervo estivesse escondido: a regra tem
    // que acusar mesmo assim.
    expect(violacoesDoAcervo([f, pedra()]).map((x) => x.regra)).toContain("frase-emprestada");
  });
});
