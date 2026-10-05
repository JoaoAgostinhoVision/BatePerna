import { describe, expect, it } from "vitest";
import { avisoDoEndereco, enderecoSugerido } from "@/lib/endereco";

/** O AVISO "O ENDEREÇO AINDA DIZ X" (Tarefa 11e, E3 com I7/I8 da auditoria).
 *
 *  O desenho que o João viu e escolheu em 04/10: quando ele corrige a cidade de
 *  um lugar publicado, o painel AVISA que o endereço ainda tem a cidade velha e
 *  OFERECE trocar pra `nome-cidade`. O endereço nunca muda sozinho.
 *
 *  Tudo aqui é marcador: nenhuma cidade real. */

describe("enderecoSugerido", () => {
  it("é o nome e a cidade, pela normalização do endereço", () => {
    expect(enderecoSugerido("Lugar Marcador", "Bom Marcador")).toBe("lugar-marcador-bom-marcador");
    expect(enderecoSugerido("Lugár  Márcador!", "Cidade-Marcadora")).toBe("lugar-marcador-cidade-marcadora");
  });

  it("sem cidade (ou cidade sem letra), não há endereço a sugerir", () => {
    expect(enderecoSugerido("Lugar Marcador", undefined)).toBeNull();
    expect(enderecoSugerido("Lugar Marcador", "  ")).toBeNull();
    expect(enderecoSugerido("Lugar Marcador", "!!")).toBeNull();
  });

  it("nome sem letra também não sugere nada (o endereço sairia sem hífen, cara de tela do app)", () => {
    expect(enderecoSugerido("!!", "Bom Marcador")).toBeNull();
  });
});

const NOME = "Lugar Marcador";

describe("avisoDoEndereco", () => {
  it("o caso dele: a cidade foi corrigida, e o endereço ainda diz a de antes", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Outra Marcadora",
        cidadesDoHistorico: ["Bom Marcador", "Outra Marcadora"],
      }),
    ).toEqual({ diz: "bom-marcador", sugerido: "lugar-marcador-outra-marcadora" });
  });

  it("sem aviso nas fichas que só GANHARAM cidade (nunca tiveram outra)", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-de-antes",
        nome: NOME,
        cidade: "Cidade Marcadora",
        cidadesDoHistorico: [undefined, "Cidade Marcadora"],
      }),
    ).toBeNull();
  });

  it("sem cidade, sem aviso (e sem botão)", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: undefined,
        cidadesDoHistorico: ["Bom Marcador", undefined],
      }),
    ).toBeNull();
  });

  // 🔴 I7 da auditoria: o FALSO POSITIVO. Nasceu em "Bom Marcador", foi
  // corrigido por engano pra "Marcador" e de volta. O endereço termina com
  // `-marcador`, que é uma cidade que ele já teve e não tem mais — mas o
  // endereço é EXATAMENTE o sugerido. Avisar ali seria um aviso falso e sem saída.
  it("endereço igual ao sugerido: sem aviso, mesmo com uma cidade velha que é sufixo dele", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Bom Marcador",
        cidadesDoHistorico: ["Bom Marcador", "Marcador", "Bom Marcador"],
      }),
    ).toBeNull();
  });

  // O caso INVERSO continua avisando, e é verdadeiro.
  it("a cidade de agora é sufixo da velha: o aviso diz a velha", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Marcador",
        cidadesDoHistorico: ["Bom Marcador", "Marcador"],
      }),
    ).toEqual({ diz: "bom-marcador", sugerido: "lugar-marcador-marcador" });
  });

  it("duas cidades velhas que servem: vale a MAIOR que o endereço tem como sufixo", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Terceira Marcadora",
        cidadesDoHistorico: ["Marcador", "Bom Marcador", "Terceira Marcadora"],
      })?.diz,
    ).toBe("bom-marcador");
    // A ordem do histórico não decide.
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Terceira Marcadora",
        cidadesDoHistorico: ["Bom Marcador", "Marcador", "Terceira Marcadora"],
      })?.diz,
    ).toBe("bom-marcador");
  });

  it("a cidade de agora, noutra grafia, não conta como cidade velha", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: NOME,
        cidade: "Bom Marcador",
        cidadesDoHistorico: ["bom marcadór", "Bom Marcador"],
      }),
    ).toBeNull();
  });

  // O lugar foi RENOMEADO, e a cidade é a mesma de sempre: o endereço (com o
  // nome velho) termina com a cidade de AGORA. Dizer "ainda diz bom-marcador"
  // seria falso — é a cidade que ele tem. (Renomear não é o caso do aviso.)
  it("a cidade de AGORA no fim do endereço não é cidade velha, mesmo com o nome mudado", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-bom-marcador",
        nome: "Nome Novo Marcador",
        cidade: "Bom Marcador",
        cidadesDoHistorico: ["Bom Marcador", "bom marcadór"],
      }),
    ).toBeNull();
  });

  it("uma cidade velha que NÃO é o fim do endereço não avisa (o endereço não a diz)", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-marcador-de-antes",
        nome: NOME,
        cidade: "Cidade Marcadora",
        cidadesDoHistorico: ["Outra Marcadora", "Cidade Marcadora"],
      }),
    ).toBeNull();
  });

  it("um pedaço de palavra não é a cidade: `-marcador` não casa com `...bommarcador`", () => {
    expect(
      avisoDoEndereco({
        endereco: "lugar-bommarcador",
        nome: "Lugar",
        cidade: "Outra Marcadora",
        cidadesDoHistorico: ["Marcador", "Outra Marcadora"],
      }),
    ).toBeNull();
  });
});
