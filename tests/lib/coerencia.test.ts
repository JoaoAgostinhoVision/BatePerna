import { describe, expect, it } from "vitest";
import { REGRAS, violacoesDoAcervo } from "@/lib/coerencia";
import { loadAll } from "@/lib/ficha";
import { DIAS, type Dia } from "@/lib/semana";
import type { Ficha } from "@/types/ficha";

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
    f.horario = { abre: "17:00", fecha: "08:00" };
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
    f.horario = { abre: "08:00", fecha: "15:00" };
    return com(f);
  },

  "janela-nao-zerada": () => {
    const f = pedra();
    f.condicao.regra.janela_previsao_horas = 0;
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
  it("cada uma das 13 regras dispara na quebra escrita pra ela", () => {
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
  // ser 13 e não 15 está no docblock de `src/lib/coerencia.ts`. Sem ele,
  // apagar uma regra E a quebra dela junto deixaria a suíte verde.
  it("o módulo tem 13 regras, e cada identificador aparece uma vez só", () => {
    expect(REGRAS.length, "uma regra entrou ou saiu do módulo sem passar por aqui").toBe(13);
    expect(new Set(REGRAS).size, "duas regras com o mesmo identificador").toBe(13);
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

  // 🔴 A frase vai pra TELA DO DONO, no celular, no meio de uma edição. Se ela
  // trouxer o identificador da regra ou o slug cru, ele lê jargão em vez de ler
  // o que está errado. Vale pras 13, não só pra uma.
  it("nenhuma frase carrega o identificador da regra nem jargão de código", () => {
    const todas = Object.values(QUEBRAS).flatMap((quebrar) => violacoesDoAcervo(quebrar()));
    expect(todas.length, "nenhuma quebra produziu violação: o teste abaixo ficaria oco")
      .toBeGreaterThanOrEqual(13);
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

  it("a janela de chuva é conferida nos TRÊS números, um a um", () => {
    for (const campo of ["janela_passado_horas", "janela_previsao_horas", "limiar_mm"] as const) {
      const f = rampa();
      f.condicao.regra[campo] = 0;
      expect(
        violacoesDoAcervo([f]).filter((x) => x.regra === "janela-nao-zerada").length,
        `zerar ${campo} não produziu violação: esse exame da regra está desligado`,
      ).toBe(1);
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
    f.horario = { abre: "17:00", fecha: "08:00" };
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
