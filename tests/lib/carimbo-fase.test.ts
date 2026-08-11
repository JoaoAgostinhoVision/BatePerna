import { describe, expect, it } from "vitest";
import {
  PISO_AUTO_MS,
  PRAZO_CONFERINDO_MS,
  faseDe,
  podeBuscar,
  sintomaDe,
} from "@/lib/carimbo-fase";

const OK = { conferindo: false, erro: false, venceu: false, falhou: false };

describe("faseDe", () => {
  it("leitura boa, o carimbo afirma", () => {
    expect(faseDe(OK)).toBe("afirmando");
  });

  it("conferindo ganha de tudo — é o que está acontecendo agora", () => {
    expect(faseDe({ conferindo: true, erro: true, venceu: true, falhou: true }))
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
