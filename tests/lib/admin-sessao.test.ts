// tests/lib/admin-sessao.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DURACAO_SESSAO_S,
  criarSessao,
  lerSessao,
  senhaConfere,
} from "@/lib/admin-sessao";

const SEGREDO = "segredo-de-teste-com-tamanho-decente";
const AGORA = 1_757_000_000;

describe("criarSessao / lerSessao", () => {
  it("um token recém-criado é válido", () => {
    const t = criarSessao(SEGREDO, AGORA, DURACAO_SESSAO_S);
    expect(lerSessao(SEGREDO, t, AGORA)).toEqual({ valida: true });
  });

  // 🔴 O ponto inteiro da assinatura: o payload diz quando expira, e sem HMAC
  // qualquer um estende a própria sessão editando o cookie.
  it("payload adulterado é recusado", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    const [, hmac] = t.split(".");
    const outroPayload = Buffer.from(JSON.stringify({ exp: AGORA + 999_999 })).toString("base64url");
    expect(lerSessao(SEGREDO, `${outroPayload}.${hmac}`, AGORA)).toEqual({
      valida: false,
      motivo: "assinatura",
    });
  });

  it("assinatura adulterada é recusada", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    const [payload, hmac] = t.split(".");
    const trocado = (hmac[0] === "a" ? "b" : "a") + hmac.slice(1);
    expect(lerSessao(SEGREDO, `${payload}.${trocado}`, AGORA)).toEqual({
      valida: false,
      motivo: "assinatura",
    });
  });

  it("token assinado com OUTRO segredo é recusado", () => {
    const t = criarSessao("outro-segredo-qualquer-aqui", AGORA, 60);
    expect(lerSessao(SEGREDO, t, AGORA)).toEqual({ valida: false, motivo: "assinatura" });
  });

  // A borda decide de UM jeito só: no instante exato da expiração, fora.
  it("expira, e o instante exato do prazo já está fora", () => {
    const t = criarSessao(SEGREDO, AGORA, 60);
    expect(lerSessao(SEGREDO, t, AGORA + 59)).toEqual({ valida: true });
    expect(lerSessao(SEGREDO, t, AGORA + 60)).toEqual({ valida: false, motivo: "expirada" });
  });

  it("lixo no lugar do token não estoura — devolve formato", () => {
    for (const lixo of ["", "semponto", "a.b.c", "...", "a."]) {
      expect(lerSessao(SEGREDO, lixo, AGORA).valida).toBe(false);
    }
  });

  it("a duração padrão é de 7 dias", () => {
    expect(DURACAO_SESSAO_S).toBe(7 * 24 * 60 * 60);
  });
});

describe("senhaConfere", () => {
  it("igual passa, diferente não", () => {
    expect(senhaConfere("abcdefgh", "abcdefgh")).toBe(true);
    expect(senhaConfere("abcdefgh", "abcdefgi")).toBe(false);
  });

  // 🔴 Tamanhos diferentes NÃO podem estourar o timingSafeEqual (ele exige
  // buffers do mesmo tamanho). Sem isto, uma senha de outro comprimento derruba
  // a rota com 500 em vez de recusar.
  it("tamanhos diferentes recusam sem estourar", () => {
    expect(senhaConfere("abcdefgh", "abc")).toBe(false);
    expect(senhaConfere("abc", "abcdefghijk")).toBe(false);
    expect(senhaConfere("", "")).toBe(false);
  });

  // 🔴 GUARDA DE FONTE, não de comportamento. Trocar `timingSafeEqual` por
  // `===` devolve o MESMO booleano em todo caso deste arquivo — só o TEMPO de
  // execução muda, e nenhum teste de valor (medido com mutação) pega isso.
  // A prova que resta é ler o código: a função tem que CHAMAR o comparador de
  // tempo constante de verdade. Checar só `fonte.includes("timingSafeEqual")`
  // não bastaria — o import e este próprio comentário mantêm a palavra no
  // arquivo mesmo com a chamada trocada por `===`; por isso a asserção mira o
  // ponto de retorno, não a palavra solta.
  it("compara com timingSafeEqual, não com ===  — o vazamento é de TEMPO, não de valor", () => {
    const fonte = readFileSync(path.join(process.cwd(), "src", "lib", "admin-sessao.ts"), "utf8");
    expect(fonte).toMatch(/return timingSafeEqual\(ba, bb\);/);
  });
});
