// tests/app/aviso-do-dono.test.tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import AvisoDoDono from "@/app/AvisoDoDono";
import { semComentarios, regraDe } from "../css";

afterEach(() => { cleanup(); });
const AGORA = 1_757_000_000;
const aviso = { texto: "A rampa está em reforma", efeito: "fechado" as const, criadoEm: AGORA - 2 * 86400, venceEm: AGORA + 86400 };

describe("AvisoDoDono", () => {
  it("mostra a frase do dono", () => {
    render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(screen.getByText("A rampa está em reforma")).not.toBeNull();
  });

  it("sem aviso, não desenha nada", () => {
    const { container } = render(<AvisoDoDono aviso={null} agora={AGORA} />);
    expect(container.textContent).toBe("");
    // 🔴 GUARDA DE MUTAÇÃO: `container.textContent === ""` também é verdade
    // pra um `<div className="aviso-dono" />` VAZIO — a mutação M3 (Step 5 do
    // brief) sobreviveu a esta asserção sozinha. Sem elemento nenhum é o que
    // prova que o componente não desenhou CAIXA, e não só texto.
    expect(container.querySelector(".aviso-dono")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  // 🔴 A DATA NAO E ENFEITE: um recado sem quando e um recado que a pessoa nao
  // sabe se ainda vale. "Publicado ha 2 dias" e o que deixa ela julgar.
  it("diz quando foi publicado", () => {
    render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(screen.getByText(/há 2 dias/i)).not.toBeNull();
  });

  // 🔴 GUARDA DE MUTAÇÃO: a fixture do arquivo inteiro fixa `criadoEm` em 2
  // dias — a mutação M4 do brief ("dias === 1 → sempre plural") sobrevivia
  // porque NENHUM teste aqui exercitava o caso singular. "1 dias" é o
  // sintoma; este teste é quem trava o singular certo.
  it("com 1 dia, fala no singular", () => {
    const ontem = { ...aviso, criadoEm: AGORA - 1 * 86400 };
    render(<AvisoDoDono aviso={ontem} agora={AGORA} />);
    expect(screen.getByText("publicado há 1 dia")).not.toBeNull();
  });

  // 🔴 A LINHA VERMELHA DO PROJETO. O aviso e do DONO; a `voz` e de quem
  // conhece o lugar. Sao procedencias diferentes, e o app inteiro se apoia
  // nessa distincao. Mesma classe do defeito de setembro, quando prosa minha
  // foi ao ar assinada como a voz dele.
  it("nao usa a marca da voz de quem conhece", () => {
    const { container } = render(<AvisoDoDono aviso={aviso} agora={AGORA} />);
    expect(container.querySelector(".voz")).toBeNull();
    expect(container.querySelector('[data-nivel="b"]')).toBeNull();
    expect(container.textContent).not.toContain("a voz de quem conhece");
  });

  it("o bloco tem estilo proprio no ficha.css", () => {
    expect(regraDe(semComentarios("ficha.css"), ".bp .aviso-dono")).not.toBeNull();
  });
});
