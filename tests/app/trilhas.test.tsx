import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Trilhas from "@/app/trilhas/page";
import { getAllFichas } from "@/lib/ficha";
import { fatosDaTrilha } from "@/lib/fatos-da-trilha";
import { bancoDeProducao, gravarEdicao } from "../banco";

afterEach(() => { cleanup(); });

// 🔴 O ACERVO VEM DO BANCO DESDE 2026-09-25, e a página passou a ser `async`
// (ela é quem espera o banco; a `ListaDoAcervo` recebe as fichas prontas). Daí
// os `render(await Trilhas())` daqui — o mesmo molde que `tests/app/home.test.tsx`
// já usava pra home.
const banco = await bancoDeProducao();
const acervo = await getAllFichas();

describe("/trilhas", () => {
  it("dá um link pra cada ficha do acervo", async () => {
    const { container } = render(await Trilhas());
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(acervo.length).toBeGreaterThan(0);
    for (const f of acervo) expect(hrefs).toContain(`/${f.slug}`);
  });

  it("mostra o nome do lugar e o rótulo de escaneio de cada ficha", async () => {
    const { container } = render(await Trilhas());
    for (const f of acervo) {
      expect(container.textContent).toContain(f.trajeto.waypoints[0].nome);
      expect(container.textContent).toContain(f.rotulo_escaneio);
    }
  });

  // 🔴 O QUE ESTA TELA PASSOU A MOSTRAR (2026-09-11), e por que doía: até hoje a
  // lista tinha nome, etiqueta e promessa — e mais nada. Piso, preço e QUANDO O
  // LUGAR ABRE existiam na ficha e no cartão da home, e sumiam justamente na
  // tela cujo trabalho é responder "o que existe".
  //
  // O caso concreto: a Rampa do Pepê só abre sábado e domingo, e a única forma
  // de descobrir isso era abrir a ficha NUM DIA EM QUE ELA ESTIVESSE FECHADA.
  // Num sábado o carimbo diz "Pode ir", e o regime do lugar não aparecia em
  // lugar nenhum do app.
  it("cada item mostra os fatos permanentes da ficha — montados pela fonte única", async () => {
    const { container } = render(await Trilhas());
    const itens = Array.from(container.querySelectorAll(".lista-item"));
    expect(itens.length, "a lista ficou sem itens — os laços abaixo passariam vazios").toBe(acervo.length);

    for (const [i, f] of acervo.entries()) {
      const esperado = fatosDaTrilha(f, { comAbertura: true });
      const vistos = Array.from(itens[i].querySelectorAll(".cartao-meta [data-nivel], .cartao-meta span > span"))
        .map((el) => el.textContent?.trim())
        .filter((t) => t && t !== "·");
      for (const fato of esperado) {
        expect(vistos, `${f.slug}: sumiu o fato "${fato.texto}" da lista`).toContain(fato.texto);
      }
    }
  });

  // 🔴 A MARCA DO NÍVEL B ATRAVESSA. Sem isto, a lista poderia mostrar os fatos
  // certos SEM marcação nenhuma — e o mesmo piso seria conhecimento de quem foi
  // no cartão da home e trivialidade aqui. Duas superfícies classificando o
  // mesmo campo de formas diferentes é a família de sempre.
  it("o Nível B atravessa até a lista — a classificação não para no cartão da home", async () => {
    const { container } = render(await Trilhas());
    const marcados = container.querySelectorAll('.cartao-meta [data-nivel="b"]');
    const quantos = acervo
      .flatMap((f) => fatosDaTrilha(f, { comAbertura: true }))
      .filter((x) => x.nivel === "b").length;
    expect(quantos, "o acervo não tem fato de Nível B nenhum — este guarda ficaria oco")
      .toBeGreaterThan(0);
    expect(marcados.length, "a lista mostrou os fatos sem a marca do Nível B").toBe(quantos);
  });

  // 🔴 CARIMBO CONTINUA FORA, e é o desenho da tela: a resposta do acervo não
  // muda com a chuva. Este guarda existe porque a tentação, agora que a lista
  // mostra mais, é mostrar o veredito também — e aí ela vira uma segunda home.
  it("nenhuma palavra de veredito entra na lista — quem julga a chuva é a home", async () => {
    const { container } = render(await Trilhas());
    for (const p of ["Pode ir", "Não vá", "Fechado agora", "Vá com cuidado", "SEM INFORMAÇÕES"]) {
      expect(container.textContent?.includes(p), `a lista do acervo passou a dizer "${p}"`).toBe(false);
    }
  });

  // Sem distância: server component, e a pergunta aqui não é "o que está perto".
  it("a lista não mostra distância — ela depende de onde você está", async () => {
    const { container } = render(await Trilhas());
    expect(container.textContent).not.toMatch(/km em linha reta/);
  });

  it("o acervo tem a barra, marcando que você está nele", async () => {
    const { container } = render(await Trilhas());
    expect(container.querySelector('.barra [aria-current="page"]')?.getAttribute("href"))
      .toBe("/trilhas");
  });

  // 🔴 A PROVA DE QUE A LISTA VEM DO BANCO, e não do JSON do repositório: o
  // painel grava uma versão nova e a próxima visita já mostra o texto novo. Sem
  // ela, todos os testes acima passariam com a página lendo o disco — eles medem
  // a lista contra o acervo, e o acervo é o mesmo conteúdo nos dois casos.
  it("o que o painel grava aparece na lista, na visita seguinte", async () => {
    const rampa = acervo.find((f) => f.slug === "rampa-do-pepe")!;
    expect(rampa, "a Rampa sumiu do acervo semeado").toBeTruthy();
    try {
      await gravarEdicao(banco, rampa, { promessa: "PROMESSA REESCRITA PELO PAINEL" });
      const { container } = render(await Trilhas());
      expect(
        container.textContent,
        "a lista continuou mostrando a promessa do JSON — o banco não é a fonte",
      ).toContain("PROMESSA REESCRITA PELO PAINEL");
    } finally {
      // Desfazer é GRAVAR a antiga de novo (a tabela é append-only, como o
      // painel fará ao voltar uma versão): o banco é do arquivo inteiro.
      await gravarEdicao(banco, rampa, {});
    }
  });
});
