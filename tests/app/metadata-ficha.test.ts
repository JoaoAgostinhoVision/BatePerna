import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/[slug]/page";
import { getAllFichas, getFicha } from "@/lib/ficha";
import { bancoDeProducao } from "../banco";

/** 🔴 O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-09-11). As três fichas mandavam o
 *  MESMO cartão no WhatsApp — "BatePerna · Aventura pela via segura.", o título
 *  e a descrição do `layout.tsx`, iguais pra todo mundo. Quem recebia três
 *  links do app recebia três cartões idênticos e não sabia qual trilha era
 *  qual: o app apagando a diferença entre lugares exatamente onde ele é passado
 *  adiante.
 *
 *  ⚠️ A RÉGUA DESTE ARQUIVO: nada aqui afirma sobre um lugar. Todo teste mede
 *  o cartão contra a PRÓPRIA ficha, ou uma ficha contra as outras. Um teste que
 *  soubesse a promessa da Rampa de cor seria a geografia inventada com roupa de
 *  prova — e morreria no dia em que ele reescrevesse a frase. */

const pedir = (slug: string) => generateMetadata({ params: Promise.resolve({ slug }) });

// O acervo vem do BANCO desde 2026-09-25 — e é o MESMO banco que o
// `generateMetadata` lê, porque o `getClient` de produção aponta pra ele.
// Semeado no topo: `fichas` era lida no corpo do `describe`, que roda na coleta,
// antes de qualquer `beforeEach`.
await bancoDeProducao();
const fichas = await getAllFichas();

describe("o cartão que o link de uma trilha mostra", () => {
  // 🔴 NÃO-VACUIDADE: todo laço abaixo varre o acervo. Com ele vazio, todos
  // passariam — a espécie "prova que passa por não ter o que provar". Cravado a
  // mão, como o do `coerencia-acervo`.
  it("o acervo tem fichas pra varrer — sem isto os laços passam vazios", () => {
    expect(fichas.length).toBeGreaterThanOrEqual(3);
  });

  // 🔴 O DEFEITO EXATO, e ele é sobre o CONJUNTO: cada cartão sozinho poderia
  // estar certo e os três ainda serem iguais. Só comparar todos entre si pega
  // isso — é o mesmo formato do guarda "nenhuma ficha empresta a voz de outra".
  it("nenhuma trilha manda o mesmo cartão que outra", () => {
    for (const campo of ["title", "description"] as const) {
      const vistos = new Map<string, string>();
      for (const f of fichas) {
        // o valor vem do próprio conteúdo, não de uma string escrita aqui
        const valor = campo === "title" ? f.trajeto.waypoints[0].nome : f.promessa;
        const dono = vistos.get(valor.trim().toLowerCase());
        expect(
          dono ? `${dono} e ${f.slug} mandam o mesmo ${campo}` : null,
          "dois links do app mostrariam o mesmo cartão, e quem recebe não sabe qual é qual",
        ).toBeNull();
        vistos.set(valor.trim().toLowerCase(), f.slug);
      }
    }
  });

  it("cada ficha REAL manda o nome dela e a promessa dela — palavra dele, sem redação minha", async () => {
    for (const f of fichas) {
      const m = await pedir(f.slug);
      const nome = f.trajeto.waypoints[0].nome;
      expect(m.title, `${f.slug}: o título do cartão`).toBe(nome);
      expect(m.description, `${f.slug}: a descrição do cartão`).toBe(f.promessa);
      // O openGraph é o que o WhatsApp lê de verdade; o `title` acima é a aba
      // do navegador. Duas fontes pro mesmo nome, então as duas são medidas.
      expect(m.openGraph?.title, `${f.slug}: o título do openGraph`).toBe(`${nome} · BatePerna`);
      expect(m.openGraph?.description, `${f.slug}: a descrição do openGraph`).toBe(f.promessa);
    }
  });

  // 🔴 O CARTÃO NÃO PODE CARREGAR VEREDITO, e não é preferência: o WhatsApp
  // CONGELA o cartão no instante em que busca o link, e ele fica no histórico
  // da conversa pra sempre. Um "Pode ir" de terça lido no sábado é o defeito
  // que o decaimento e o `useVenceu` existem pra impedir DENTRO do app,
  // vazando pra fora dele — e lá não há toque que atualize.
  it("nenhum cartão carrega o veredito de hoje — ele congela na conversa", async () => {
    const proibidas = [
      "Pode ir", "Não vá", "Fechado agora", "Espera", "Vá com cuidado",
      "SEM INFORMAÇÕES", "seco", "molhado", "chuva",
    ];
    for (const f of fichas) {
      const m = await pedir(f.slug);
      const texto = [
        m.title, m.description, m.openGraph?.title, m.openGraph?.description,
      ].join(" | ");
      for (const p of proibidas) {
        expect(
          texto.includes(p),
          `${f.slug}: o cartão do link diz "${p}" — e o WhatsApp o congela pra sempre`,
        ).toBe(false);
      }
    }
  });

  // Sem imagem de propósito: gerar uma exigiria escolher o que ela mostra, e
  // isso é decisão dele. Este guarda existe pra que ela não apareça sozinha
  // num refactor — apareceu, alguém decidiu, e a decisão tem dono.
  it("nenhum cartão tem imagem — escolher o que ela mostra é decisão dele", async () => {
    for (const f of fichas) {
      const m = await pedir(f.slug);
      expect(m.openGraph?.images, `${f.slug}: apareceu imagem sem ninguém escolher`).toBeUndefined();
    }
  });

  // 🔴 N6, MEDIDA E SOBREVIVENTE NA PRIMEIRA VARREDURA (2026-09-11): apagar o
  // molde do título no layout deixava a suíte inteira verde. Sem ele, o
  // `title: nome` da ficha SUBSTITUI "BatePerna" em vez de compor com ele, e a
  // aba do navegador passa a dizer só "Rampa do Pepê" — o app perde o nome bem
  // na lista de abas, que é onde alguém procura por ele depois.
  //
  // As duas metades juntas, e é o par que importa: o padrão (toda tela que não
  // declara título) E o molde (a ficha compondo com ele).
  it("o layout tem o MOLDE do título — senão a ficha apaga a marca em vez de compor", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.title, "o título do layout virou string fixa").toEqual({
      default: "BatePerna",
      template: "%s · BatePerna",
    });
  });

  // Slug que não existe herda o título do layout em vez de estourar: a rota 404
  // chama esta função antes do `notFound()`.
  it("slug inexistente devolve cartão vazio, e não um erro", async () => {
    expect(await getFicha("trilha-que-nao-existe"), "a premissa do teste").toBeFalsy();
    await expect(pedir("trilha-que-nao-existe")).resolves.toEqual({});
  });
});
