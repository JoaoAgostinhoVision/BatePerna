import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lugarMarcador } from "../lugar-marcador";

/** 🔴 O ENDEREÇO VELHO LEVA AO NOVO — e só a um lugar NO AR (Tarefa 11e, E4).
 *
 *  O link que já circula no WhatsApp não pode morrer quando o dono troca o
 *  endereço. Mas um lugar escondido não pode aparecer por ele: o velho de um
 *  lugar escondido dá o MESMO 404 de hoje, sem revelar que ali houve um lugar.
 *
 *  🔴 307 (`redirect`), NUNCA 308 (`permanentRedirect`) — I3 da auditoria: o
 *  endereço velho é RETOMÁVEL (E5), então o redirect não é permanente, e um
 *  cache que guardasse um 308 levaria o link do lugar novo pro de antes. Os dois
 *  são dublados aqui pra provar QUAL a página chama.
 *
 *  A página roda contra o banco de VERDADE (`bancoDeProducao`), sem dublê de
 *  `getFicha`. Nomes marcadores. */
const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirectFalso = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
const permanenteFalso = vi.fn((url: string) => {
  throw new Error(`NEXT_PERMANENT ${url}`);
});
vi.mock("next/navigation", () => ({
  notFound: notFoundFalso,
  redirect: redirectFalso,
  permanentRedirect: permanenteFalso,
}));

vi.mock("@/lib/carimbo-estado", async (real) => ({
  ...(await real<typeof import("@/lib/carimbo-estado")>()),
  resolverEstado: vi.fn(),
}));

const { resolverEstado } = await import("@/lib/carimbo-estado");
const { gravarVersao, trocarEndereco, versaoAtual } = await import("@/lib/db");
const { esquecerMemoria } = await import("@/lib/ficha-fonte");
const pagina = await import("@/app/[slug]/page");
const Ficha = pagina.default;
const ConfirmarFui = (await import("@/app/ConfirmarFui")).default;
const { bancoDeProducao, AGORA_SEMENTE } = await import("../banco");

const A = "lugar-marcador-bom-marcador";
const B = "lugar-marcador-outra-marcadora";

const banco = await bancoDeProducao();

const abrir = (slug: string) =>
  Ficha({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

/** O elemento `ConfirmarFui` dentro da árvore que a página devolve — sem
 *  renderizar nada: a página é servidor, e o que se prova é a PROP que ela passa. */
function acharConfirmar(no: ReactNode): { slug: string; antigos?: string[] } | null {
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achou = acharConfirmar(filho);
      if (achou) return achou;
    }
    return null;
  }
  if (!isValidElement(no)) return null;
  const props = no.props as { children?: ReactNode };
  if (no.type === ConfirmarFui) return props as unknown as { slug: string; antigos?: string[] };
  return acharConfirmar(props.children);
}

let quando = AGORA_SEMENTE + 1000;

beforeEach(async () => {
  notFoundFalso.mockClear();
  redirectFalso.mockClear();
  permanenteFalso.mockClear();
  vi.mocked(resolverEstado).mockResolvedValue({ estado: "fresco", erro: false, calculadoEm: AGORA_SEMENTE, aviso: null });
  // Cada caso começa do zero: o acervo de novo, e o lugar marcador em A.
  await bancoDeProducao();
  await gravarVersao(banco, A, JSON.stringify(lugarMarcador(A, "Lugar Marcador", "Outra Marcadora")), "painel", quando++);
  esquecerMemoria();
});

describe("a página pública num endereço velho", () => {
  it("premissa: antes da troca, A abre e B não existe", async () => {
    await expect(abrir(A)).resolves.toBeTruthy();
    await expect(abrir(B)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("depois da troca, /velho REDIRECIONA (307) pra /novo", async () => {
    await trocarEndereco(banco, A, B, quando++);
    esquecerMemoria();

    await expect(abrir(A)).rejects.toThrow(`NEXT_REDIRECT /${B}`);
    expect(redirectFalso).toHaveBeenCalledWith(`/${B}`);
    expect(permanenteFalso, "308 é permanente, e o endereço velho é retomável").not.toHaveBeenCalled();
    expect(notFoundFalso).not.toHaveBeenCalled();
  });

  it("o endereço novo abre, e passa os ANTIGOS ao ✓ Fui (a fila offline de lá)", async () => {
    await trocarEndereco(banco, A, B, quando++);
    esquecerMemoria();
    const arvore = await abrir(B);
    const props = acharConfirmar(arvore as ReactNode);
    expect(props, "a página não tem mais o ✓ Fui").not.toBeNull();
    expect(props!.slug).toBe(B);
    expect(props!.antigos).toEqual([A]);
  });

  it("lugar sem endereço antigo passa a lista vazia", async () => {
    const props = acharConfirmar((await abrir(A)) as ReactNode);
    expect(props!.antigos).toEqual([]);
  });

  it("o novo ESCONDIDO: /velho dá o mesmo 404, e não revela pra onde iria", async () => {
    await trocarEndereco(banco, A, B, quando++);
    await gravarVersao(banco, B, (await versaoAtual(banco, B))!.doc, "painel", quando++, true);
    esquecerMemoria();

    await expect(abrir(A)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirectFalso).not.toHaveBeenCalled();
    await expect(abrir(B)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  // 🔴 C1 + E4 juntos, pela tela: o lugar ESCONDIDO troca de endereço, e
  // nenhum dos dois o põe no ar.
  it("lugar escondido que troca de endereço: /novo dá 404 e /velho dá 404", async () => {
    await gravarVersao(banco, A, (await versaoAtual(banco, A))!.doc, "painel", quando++, true);
    await trocarEndereco(banco, A, B, quando++);
    esquecerMemoria();

    await expect(abrir(B)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(abrir(A)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirectFalso).not.toHaveBeenCalled();
  });

  // O redirect mora no CORPO da página, nunca no `generateMetadata` (I3): o
  // metadata de um endereço velho é o do 404, e não decide nada.
  it("generateMetadata do endereço velho não redireciona", async () => {
    await trocarEndereco(banco, A, B, quando++);
    esquecerMemoria();
    await expect(pagina.generateMetadata({ params: Promise.resolve({ slug: A }) })).resolves.toEqual({});
    expect(redirectFalso).not.toHaveBeenCalled();
  });
});
