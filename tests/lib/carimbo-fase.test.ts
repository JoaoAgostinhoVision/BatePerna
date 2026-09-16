import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PISO_AUTO_MS,
  PRAZO_CONFERINDO_MS,
  faseDe,
  marcaDe,
  podeBuscar,
  sintomaDe,
  subDe,
} from "@/lib/carimbo-fase";

const OK = { conferindo: false, erro: false, venceu: false, falhou: false, fechadoPeloDono: false };

/** A voz da RAMPA DO PEPÊ — nível `nao-va`, janela de 6h. É a ficha cuja `voz`
 *  deu a palavra "Não vá" ao app inteiro até 2026-09-10; aqui ela é UMA das
 *  três, e as outras duas são provadas em `tests/lib/severidade.test.ts`. */
const RAMPA = { severidade: "nao-va", horasPassado: 6 } as const;

// 🔴 O DEFEITO QUE ESTES TESTES TRANCAM (2026-08-27). "Pode subir"/"Não suba"
// supunham LADEIRA em todo lugar do acervo. Era verdade da Rampa do Pepê, e o
// app repetia na Pedra Furada, que é plana — lá o passeio é chegar, não subir.
// Terceira vez na mesma semana que texto escrito com o acervo pequeno vira
// mentira quando ele cresce (as outras duas: `secaRapido`, `chuvaNoPiso`).
describe("marcaDe: a palavra da decisão, e ela não fala em SUBIR", () => {
  it("leitura boa e chão seco: 'Pode ir'", () => {
    expect(marcaDe("afirmando", "fresco", RAMPA)).toBe("Pode ir");
  });

  it("leitura boa e chão molhado: 'Não vá' — palavra dele, a `voz` da Rampa", () => {
    expect(marcaDe("afirmando", "frio", RAMPA)).toBe("Não vá");
  });

  it("sem leitura, informa em vez de mandar — o estado não decide nada", () => {
    expect(marcaDe("sem-informacoes", "fresco", RAMPA)).toBe("SEM INFORMAÇÕES");
    expect(marcaDe("sem-informacoes", "frio", RAMPA)).toBe("SEM INFORMAÇÕES");
  });

  it("conferindo ganha das duas — é o que está acontecendo agora", () => {
    expect(marcaDe("conferindo", "frio", RAMPA)).toBe("CONFERINDO…");
  });

  // 🔴 O CERCO, e ele é o que dura. As igualdades acima morrem no dia em que ele
  // trocar a palavra de novo; esta asserção sobrevive à troca e continua
  // proibindo a SUPOSIÇÃO — que é o defeito, não a palavra. Vale pros quatro
  // ramos de uma vez.
  it("nenhum ramo supõe ladeira", () => {
    const todas = (["afirmando", "conferindo", "sem-informacoes"] as const).flatMap((f) =>
      (["fresco", "frio"] as const).map((e) => marcaDe(f, e, RAMPA)),
    );
    expect(todas.length).toBe(6); // não passa por vacuidade com a lista vazia
    for (const m of todas) expect(m).not.toMatch(/sub(a|ir|e)/i);
  });

  // PROVA DE FONTE: em runtime, "os dois componentes chamam `marcaDe`" e "cada
  // um escreve a mesma palavra à mão" pintam a MESMA tela — nenhuma asserção de
  // valor as separa enquanto ninguém editar só um lado. É justamente a divergência
  // FUTURA que se quer impedir, e ela só se vê na fonte.
  it("carimbo e selo NÃO escrevem a palavra à mão — os dois perguntam a marcaDe", () => {
    for (const arq of ["Carimbo.tsx", "SeloTrilha.tsx"]) {
      const src = readFileSync(path.join(process.cwd(), "src", "app", arq), "utf8");
      const codigo = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // A tira precisa de guarda, senão a ausência abaixo passa por vacuidade.
      expect(codigo, `a tira comeu ${arq}`).toContain("const marca");
      expect(codigo, `${arq} parou de perguntar a palavra`).toContain("marcaDe(");
      expect(codigo, `${arq} parou de perguntar a linha de baixo`).toContain("subDe(");
      expect(codigo, `a palavra voltou a ser escrita à mão em ${arq}`).not.toMatch(
        /Pode ir|Não vá|SEM INFORMAÇÕES|tome cuidado|dá um tempo|carro comum/,
      );
    }
  });
});

// 🔴 A FASE QUE NÃO FALA DE CHUVA (2026-08-27). O carimbo dizia "Pode ir" às
// 18h num lugar que fecha às 17h. Ver `src/lib/horario.ts`.
describe("a fase fechado", () => {
  it("fechado GANHA de conferindo — com o lugar fechado a chuva não decide nada", () => {
    expect(faseDe({ ...OK, conferindo: true, fechado: true })).toBe("fechado");
  });

  it("fechado ganha também de erro, vencido e falhou", () => {
    expect(faseDe({ conferindo: false, erro: true, venceu: true, falhou: true, fechado: true, fechadoPeloDono: false }))
      .toBe("fechado");
  });

  // O padrão é o comportamento de sempre: ficha sem horário, e primeiro render,
  // não fecham. Sem isto, toda chamada antiga de `faseDe` mudaria de resposta.
  it("sem o campo, nada muda — é o app de antes", () => {
    expect(faseDe(OK)).toBe("afirmando");
    expect(faseDe({ ...OK, fechado: false })).toBe("afirmando");
  });

  it("a palavra é 'Fechado agora', e o estado da chuva não a muda", () => {
    expect(marcaDe("fechado", "fresco", RAMPA)).toBe("Fechado agora");
    expect(marcaDe("fechado", "frio", RAMPA)).toBe("Fechado agora");
  });

  it("a linha de baixo é a próxima abertura, que vem de fora", () => {
    expect(subDe("fechado", "fresco", RAMPA, "abre amanhã às 5h")).toBe("abre amanhã às 5h");
  });

  // Não é fallback disfarçado: é o app CALANDO. Por construção a fase só existe
  // com horário, mas se um dia a construção mudar, silêncio é a saída honesta —
  // inventar "abre cedo" aqui seria o defeito da frase de reserva de volta.
  it("sem a abertura, cala — não inventa horário", () => {
    expect(subDe("fechado", "fresco", RAMPA)).toBe("");
  });
});

describe("subDe: a linha de baixo, agora de fonte única", () => {
  it("as quatro linhas de sempre continuam as mesmas", () => {
    expect(subDe("conferindo", "fresco", RAMPA)).toBe("lendo a chuva agora");
    expect(subDe("sem-informacoes", "frio", RAMPA)).toBe("tome cuidado");
    expect(subDe("afirmando", "fresco", RAMPA)).toBe("seco · carro comum");
    expect(subDe("afirmando", "frio", RAMPA)).toBe("barro · dá um tempo");
  });
});

describe("faseDe", () => {
  it("leitura boa, o carimbo afirma", () => {
    expect(faseDe(OK)).toBe("afirmando");
  });

  it("conferindo ganha de tudo — é o que está acontecendo agora", () => {
    expect(faseDe({ conferindo: true, erro: true, venceu: true, falhou: true, fechadoPeloDono: false }))
      .toBe("conferindo");
  });

  it("erro, vencido e falha caem todos na mesma fase", () => {
    expect(faseDe({ ...OK, erro: true })).toBe("sem-informacoes");
    expect(faseDe({ ...OK, venceu: true })).toBe("sem-informacoes");
    expect(faseDe({ ...OK, falhou: true })).toBe("sem-informacoes");
  });
});

describe("sintomaDe", () => {
  it("a falha da busca é a notícia mais recente, então ela manda", () => {
    expect(sintomaDe({ ...OK, falhou: true, erro: true, venceu: true })).toBe("falhou");
  });

  it("sem falha, o erro do servidor ganha do vencimento", () => {
    // Não houve leitura nenhuma: não há hora pra citar, então não se cita.
    expect(sintomaDe({ ...OK, erro: true, venceu: true })).toBe("erro");
  });

  it("só vencido, o sintoma é o vencimento", () => {
    expect(sintomaDe({ ...OK, venceu: true })).toBe("venceu");
  });

  it("leitura boa não tem sintoma", () => {
    expect(sintomaDe(OK)).toBe(null);
  });
});

describe("podeBuscar", () => {
  const base = { erro: false, venceu: false, conferindo: false, desdeUltimaMs: Infinity };

  it("o toque sempre busca, mesmo com leitura boa na tela", () => {
    expect(podeBuscar("toque", base)).toBe(true);
  });

  it("o toque atravessa o piso de 30s — quem tocou está pedindo", () => {
    expect(podeBuscar("toque", { ...base, desdeUltimaMs: 1_000 })).toBe(true);
  });

  it("carregar só busca se a leitura já está vencida", () => {
    expect(podeBuscar("carregou", { ...base, venceu: true })).toBe(true);
    expect(podeBuscar("carregou", base)).toBe(false);
  });

  it("carregar NÃO retenta o erro do servidor", () => {
    // A página acabou de tentar, do servidor, milissegundos atrás. Repetir da
    // mão do usuário trocaria a mensagem honesta por 3s de "Conferindo…" em
    // todo carregamento enquanto o Open-Meteo estivesse fora do ar.
    expect(podeBuscar("carregou", { ...base, erro: true })).toBe(false);
  });

  it("carregou com erro E venceu — busca porque venceu (não retenta erro)", () => {
    // Mata a variante incorreta `venceu && !erro`: se fosse assim, este teste
    // falharia; a regra correta é `return venceu`, ignorando o erro.
    expect(podeBuscar("carregou", { ...base, erro: true, venceu: true })).toBe(true);
  });

  it("voltar à tela retenta o erro — o tempo passou", () => {
    expect(podeBuscar("voltou", { ...base, erro: true })).toBe(true);
    expect(podeBuscar("voltou", { ...base, venceu: true })).toBe(true);
  });

  it("voltar com leitura boa não gasta rede", () => {
    expect(podeBuscar("voltou", base)).toBe(false);
  });

  it("o piso de 30s segura o gatilho automático", () => {
    expect(podeBuscar("voltou", { ...base, venceu: true, desdeUltimaMs: 5_000 })).toBe(false);
    expect(podeBuscar("voltou", { ...base, venceu: true, desdeUltimaMs: 31_000 })).toBe(true);
  });

  it("busca em andamento barra qualquer gatilho, inclusive o toque", () => {
    expect(podeBuscar("toque", { ...base, conferindo: true })).toBe(false);
    expect(podeBuscar("voltou", { ...base, venceu: true, conferindo: true })).toBe(false);
  });
});

describe("prazos", () => {
  it("o 'Conferindo…' sai da tela em 3s, bem antes dos 6s do service worker", () => {
    // Lá a tela está em branco; aqui ela já tem conteúdo, e o que está em jogo
    // é por quanto tempo o app fica sem afirmar nada — na hora da decisão.
    expect(PRAZO_CONFERINDO_MS).toBe(3_000);
  });

  it("o piso entre buscas automáticas é de 30s", () => {
    expect(PISO_AUTO_MS).toBe(30_000);
  });
});
