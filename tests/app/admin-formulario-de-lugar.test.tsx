import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { COOKIE_ADMIN } from "@/lib/admin-guarda";
import { DURACAO_SESSAO_S, criarSessao } from "@/lib/admin-sessao";
import { CAMPOS_DA_FICHA, lerCaminho, type CampoDaFicha } from "@/lib/campos-da-ficha";
import { criarRascunho, gravarVersao, historico, lerRascunho, versaoAtual } from "@/lib/db";
import { aberturaDaFicha, fechadoAgora, rotuloAbertura } from "@/lib/horario";
import { fichaSchema } from "@/types/ficha";
import { docDoLugarNovo } from "@/lib/rascunho";
import { rotuloDe } from "@/app/admin/FichaInteira";
import { ORDEM, PERGUNTAS, escolherPosicao } from "@/app/admin/novo/perguntas";
import {
  ANTERIOR,
  AVISO_RASCUNHO,
  COMECAR,
  PROXIMA,
  PULADA,
  PULAR,
  RESPONDIDA,
  SEM_RESPOSTA,
  enderecoDaPergunta,
  posicaoNaTela,
} from "@/app/admin/FormularioDeLugar";
import { enderecoDePublicar } from "@/app/admin/novo/enderecos";
import EditorProsa from "@/app/admin/campos/EditorProsa";
import { ERRO_REDE } from "@/app/admin/campos/gravar";
import { HORA_VAZIA } from "@/app/admin/campos/palavras";
import { APROXIMAR, MARQUE_NO_MAPA, VISTA_CIDADE_AMBIGUA, VISTA_SEM_CIDADE } from "@/app/admin/campos/EditorCoordenada";
import { ESTADO_DO_APP } from "@/lib/lugares";
import { vistaDoAcervo } from "@/lib/vista-do-mapa";
import {
  MAPA_ALTURA_PX,
  MAPA_LARGURA_PX,
  MAPA_ZOOM,
  MAPA_ZOOM_EDITOR,
  coordDaPosicao,
  zoomDeTiles,
} from "@/lib/mapa";
import { IR_PUBLICAR, LUGAR_NOVO, TITULO_RASCUNHOS } from "@/app/admin/ListaDeLugares";
import { regraDe, semComentarios } from "../css";
import { bancoVazio, salvarRascunho, semearAcervo } from "../banco";

/** O FORMULÁRIO DE LUGAR NOVO (Tarefa 11) — medido NA PÁGINA, contra o banco.
 *
 *  🔴 E1 DA AUDITORIA: o `FormularioDeLugar` é de cliente e recebe as perguntas
 *  PRONTAS, montadas pela página de servidor a partir do registro. O teste do
 *  plano renderizava o componente sozinho lendo o registro — o que empurraria o
 *  import do registro pro cliente. Aqui se renderiza a PÁGINA (`/admin/novo`),
 *  com o rascunho no banco: o que se mede é a fiação inteira, não props
 *  escritas à mão.
 *
 *  🔴 E O QUE "QUAIS PERGUNTAS" SIGNIFICA SAI DO REGISTRO, AQUI, nunca da lista
 *  da tela: `esperadas()` é o registro com a dobra que a auditoria decidiu (a
 *  metade `.lng` do ponto mora na `.lat`) e o molde `[]` no ponto `0`. A
 *  outra dobra (folha de bloco mora no bloco) saiu com o bloco, na 11d. */

const SENHA = "s".repeat(24);
const SEGREDO = "segredo-de-assinatura-do-teste-formulario";
const NOME = "Lugar Marcador Um";
const CIDADE = "Cidade Marcador Um";
const S = "lugar-marcador-um";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const notFoundFalso = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const cookiesFalso = vi.fn();
vi.mock("next/navigation", () => ({ notFound: notFoundFalso }));
vi.mock("next/headers", () => ({ cookies: cookiesFalso }));
vi.mock("@/lib/carimbo-estado", () => ({ resolverEstados: vi.fn() }));

let cliente: Client;
vi.mock("@/lib/db", async (real) => ({
  ...(await real<typeof import("@/lib/db")>()),
  getClient: vi.fn(() => cliente),
}));

let token: string;

/** 🔴 A BUSCA DE CIDADE DA VISTA, DUBLADA (Tarefa 11f). Numa pergunta de mapa
 *  sem ponto, a PÁGINA (servidor) pergunta ao serviço de geocoding onde fica a
 *  cidade do rascunho — só pra saber onde a câmera começa. Aqui a resposta é de
 *  MARCADORES, com o homônimo de outro estado PRIMEIRO, como o serviço real faz
 *  (C2 da auditoria). Nenhum teste deste arquivo sai pra rede: o `fetch`
 *  padrão recusa qualquer outra URL. */
const CIDADE_NO_MAPA = { lat: -8.31, lng: -36.42 };
const GEOCODING = {
  results: [
    { name: CIDADE, feature_code: "PPL", admin1: "Estado Marcador", country: "Brasil", latitude: -23.4, longitude: -46.6 },
    {
      name: CIDADE,
      feature_code: "PPL",
      admin1: ESTADO_DO_APP,
      country: "Brasil",
      latitude: CIDADE_NO_MAPA.lat,
      longitude: CIDADE_NO_MAPA.lng,
    },
  ],
};
const ehGeocoding = (url: string): boolean => url.startsWith("https://geocoding-api.open-meteo.com/");
let buscasDeCidade: string[] = [];
let respostaDaCidade: () => Response = () => Response.json(GEOCODING);
function geocodingFalso(url: string): Response {
  buscasDeCidade.push(url);
  return respostaDaCidade();
}

beforeEach(async () => {
  buscasDeCidade = [];
  respostaDaCidade = () => Response.json(GEOCODING);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (ehGeocoding(url)) return geocodingFalso(url);
      throw new Error(`fetch sem dublê neste teste: ${url}`);
    }),
  );
  cliente = bancoVazio();
  await semearAcervo(cliente);
  notFoundFalso.mockClear();
  cookiesFalso.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_SENHA", SENHA);
  vi.stubEnv("ADMIN_SEGREDO", SEGREDO);
  vi.resetModules();
  const { resolverEstados } = await import("@/lib/carimbo-estado");
  vi.mocked(resolverEstados).mockResolvedValue(new Map());
  token = criarSessao(SEGREDO, Math.floor(Date.now() / 1000), DURACAO_SESSAO_S);
  cookiesFalso.mockResolvedValue({ get: (nome: string) => (nome === COOKIE_ADMIN ? { value: token } : undefined) });
});
afterEach(() => vi.unstubAllEnvs());

/** O rascunho nasce pela porta de verdade do banco — o mesmo `criarRascunho`
 *  e o mesmo documento que a rota usa. */
async function lugarNovo(): Promise<void> {
  expect(await criarRascunho(cliente, S, docDoLugarNovo(S, NOME, CIDADE), 1)).toBe(true);
}

async function paginaNovo(slug?: string, p?: string | string[]) {
  const { default: Novo } = await import("@/app/admin/novo/page");
  const params: { slug?: string; p?: string | string[] } = {};
  if (slug !== undefined) params.slug = slug;
  if (p !== undefined) params.p = p;
  return render(await Novo({ searchParams: Promise.resolve(params) }));
}

const pergunta = (caminho: string): HTMLElement => screen.getByTestId(`pergunta-${caminho}`);

/** O caminho de cada pergunta que a tela mostra agora (o `data-testid`). */
const naTela = (): string[] =>
  screen.queryAllByTestId(/^pergunta-/).map((e) => e.getAttribute("data-testid")!.slice("pergunta-".length));

/** A posição (1…M) de uma pergunta na ordem da tela. */
function posDe(caminho: string): number {
  const i = ORDEM.indexOf(caminho);
  expect(i, `${caminho} não está na ordem`).toBeGreaterThan(-1);
  return i + 1;
}
const telaDe = (caminho: string) => paginaNovo(S, String(posDe(caminho)));

/** 🔴 TODAS AS TELAS, uma por uma, de `p=1` a `p=M` — com M lido do REGISTRO,
 *  nunca da página. Cada tela é desmontada antes da próxima. */
async function porTodasAsTelas(fn: (n: number, container: HTMLElement) => void | Promise<void>): Promise<number> {
  const total = esperadas().length;
  for (let n = 1; n <= total; n++) {
    const { container } = await paginaNovo(S, String(n));
    await fn(n, container);
    cleanup();
  }
  return total;
}

/** QUAIS PERGUNTAS, lidas do REGISTRO — e não da lista da página. */
function esperadas(): CampoDaFicha[] {
  return CAMPOS_DA_FICHA.filter((c) => !(c.especie === "coord" && c.caminho.endsWith("[].lng")));
}
const concreto = (molde: string): string => molde.replace("[]", ".0");

/** O `fetch` dublado que LEVA O PUT À ROTA DE VERDADE — com o cookie da sessão,
 *  no mesmo banco. É o que faz "sai e volta" ser o rascunho de verdade, e não
 *  um mock dizendo que gravou. */
async function comRotaDeVerdade() {
  const rota = await import("@/app/api/admin/rascunho/route");
  const chamadas: { url: string; metodo: string; corpo: Record<string, unknown> }[] = [];
  const fetchFalso = vi.fn(async (url: string, init: { method: string; body: string }) => {
    // A busca de cidade da vista é do SERVIDOR da página, não do formulário:
    // não entra em `chamadas` (que são o que a TELA mandou pra porta).
    if (ehGeocoding(url)) return geocodingFalso(url);
    chamadas.push({ url, metodo: init.method, corpo: JSON.parse(init.body) });
    const req = new Request(`http://x${url}`, {
      method: init.method,
      headers: { cookie: `${COOKIE_ADMIN}=${token}` },
      body: init.body,
    });
    const metodo = init.method as "PUT" | "POST";
    return rota[metodo](req);
  });
  vi.stubGlobal("fetch", fetchFalso);
  const reload = vi.fn();
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload, assign });
  return { fetchFalso, chamadas, reload, assign };
}

/** 🔴 UM RASCUNHO COM TODAS AS PERGUNTAS RESPONDIDAS (Tarefa 11d). A varredura
 *  R4 rodava só num rascunho NOVO — e foi por isso que o I-B da Tarefa 11 (dois
 *  Salvar na pergunta do horário PRESENTE) passou: o horário presente nunca era
 *  visto. Todo texto aqui é MARCADOR, de um lugar que não existe; o horário é o
 *  do almoço (duas faixas), que é o caso de mais de um par de caixas por tela.
 *  Uma premissa medida confere que ele responde TODA pergunta do registro e que
 *  é uma ficha que o schema aceita. */
const ALMOCO = [
  { abre: "08:00", fecha: "10:00" },
  { abre: "14:00", fecha: "17:00" },
];
function docTodoRespondido(horario: readonly { abre: string; fecha: string }[] = ALMOCO): string {
  return JSON.stringify({
    ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)),
    trajeto: { waypoints: [{ nome: NOME, lat: -8.4, lng: -36.2, nota: "Nota marcadora." }] },
    rotulo_escaneio: "Rótulo marcador",
    promessa: "Promessa marcadora.",
    voz: "Voz marcadora.",
    premio: "Prêmio marcador.",
    acesso: "Acesso marcador.",
    avisos: "Aviso marcador.",
    piso: "barro",
    carroComum: true,
    secaRapido: "Chão marcador.",
    condicao: {
      coords: { lat: -8.4, lng: -36.2 },
      regra: { tipo: "chuva_binaria", janela_previsao_horas: 3, janela_passado_horas: 6, limiar_mm: 1 },
      severidade: "nao-va",
      regra_texto: "Regra marcadora.",
      ressalva_proxy: "Ressalva marcadora.",
    },
    discriminador: { formato: "marcador", como_ler: "Leitura marcadora.", permissao_abortar: "Permissão marcadora." },
    custo: { tag: "pago", valor: "Valor marcador", curto: "Curto marcador" },
    horario,
    dias: ["sab", "dom"],
  });
}

/** Todo valor PRIMITIVO do documento, em texto — é contra isto que se confere
 *  que o que está numa caixa é resposta DELE, e não algo que a tela pôs lá. */
function respostasDe(v: unknown, saida = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) respostasDe(x, saida);
  else if (typeof v === "object" && v !== null) for (const x of Object.values(v)) respostasDe(x, saida);
  else saida.add(String(v));
  return saida;
}

/** O campo do registro de um caminho concreto da tela. */
function campoDe(concretoDaTela: string): CampoDaFicha {
  const c = esperadas().find((x) => concreto(x.caminho) === concretoDaTela);
  expect(c, `${concretoDaTela} não é campo do registro`).toBeDefined();
  return c!;
}

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — as perguntas", () => {
  // 🔴 UMA PERGUNTA POR VEZ (decisão dele, 03/10): cada tela tem EXATAMENTE
  // uma, e a UNIÃO das telas 1…M é o registro — cada campo uma vez só, na ordem
  // do questionário.
  it("o formulário faz uma pergunta por campo do registro, e nenhuma a mais", async () => {
    await lugarNovo();
    const campos = esperadas();
    expect(campos.length, "o registro foi lido vazio: o laço não provaria nada").toBeGreaterThan(20);
    const vistas: string[] = [];
    const total = await porTodasAsTelas((n) => {
      const aqui = naTela();
      expect(aqui, `a tela ${n} não tem exatamente uma pergunta`).toHaveLength(1);
      // 🔴 UM SALVAR POR TELA (Tarefa 11d): a lacuna que deixou o I-B passar. E
      // NENHUM na de mapa sem ponto (Tarefa 11f, M4): ali o Salvar só nasce
      // com o toque dele — antes, ele gravaria o centro da vista.
      const salvares = campoDe(aqui[0]).especie === "coord" ? 0 : 1;
      expect(
        document.querySelectorAll("[data-salvar]"),
        `a tela ${n} (${aqui[0]}) não tem ${salvares} Salvar`,
      ).toHaveLength(salvares);
      vistas.push(aqui[0]);
      expect(screen.getByText(posicaoNaTela(n, campos.length)), `tela ${n}`).toBeTruthy();
      // e nenhum molde cru chega à tela
      expect(document.body.innerHTML).not.toContain("[]");
    });
    expect(vistas).toHaveLength(total);
    expect(new Set(vistas).size, "a mesma pergunta apareceu em duas telas").toBe(vistas.length);
    expect([...vistas].sort()).toEqual(campos.map((c) => concreto(c.caminho)).sort());
    expect(vistas, "a ordem das telas não é a do questionário").toEqual([...ORDEM]);
  });

  // 🔴 A ORDEM E A REDAÇÃO SÃO DO QUESTIONÁRIO, e isto é PROCEDÊNCIA: cada
  // pergunta da tela é um trecho CONTÍNUO da "Pergunta:" do documento que o
  // João leu (só a primeira letra muda de caixa). Uma palavra minha enfiada
  // numa pergunta deixa este caso vermelho.
  it("cada pergunta é um trecho do questionário, e a ordem da tela é a dele", () => {
    const plano = (s: string) =>
      s
        .replace(/\*\*|\*|`/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
    const doc = plano(readFileSync(path.join(process.cwd(), "docs", "questionario-ficha.md"), "utf8"));
    const posicoes: number[] = [];
    for (const molde of ORDEM) {
      const texto = PERGUNTAS[molde];
      if (texto === undefined) continue;
      const onde = doc.indexOf(plano(texto));
      expect(onde, `a pergunta de \`${molde}\` não é trecho do questionário: "${texto}"`).toBeGreaterThan(-1);
      posicoes.push(onde);
    }
    expect(posicoes.length, "nenhuma pergunta do questionário foi medida").toBeGreaterThan(20);
    expect(posicoes, "a ordem da tela não é a do questionário").toEqual([...posicoes].sort((a, b) => a - b));
  });

  // A lista à mão da ordem é vigiada pelo registro, nas duas direções.
  it("ORDEM é exatamente o conjunto de perguntas do registro", () => {
    expect([...ORDEM].sort()).toEqual(esperadas().map((c) => concreto(c.caminho)).sort());
    expect(new Set(ORDEM).size).toBe(ORDEM.length);
  });

  // 🔴 Os campos que o questionário NÃO pergunta caem no rótulo da ficha
  // inteira — nunca numa pergunta inventada. A lista é cravada pra que um campo
  // novo sem pergunta apareça aqui, e no relatório, em vez de passar calado.
  it("campo sem pergunta no questionário mostra o rótulo, e são estes três", async () => {
    const semPergunta = ORDEM.filter((m) => PERGUNTAS[m] === undefined);
    expect(semPergunta.sort()).toEqual([
      "condicao.regra.janela_previsao_horas",
      "condicao.regra.limiar_mm",
      "condicao.severidade",
    ]);
    await lugarNovo();
    let medidas = 0;
    await porTodasAsTelas(() => {
      const [m] = naTela();
      const texto = PERGUNTAS[m] ?? rotuloDe(m);
      if (semPergunta.includes(m)) expect(PERGUNTAS[m]).toBeUndefined();
      expect(within(pergunta(m)).getByText(texto), m).toBeTruthy();
      medidas++;
    });
    expect(medidas).toBe(ORDEM.length);
  });

  it("a tela não traz exemplo nem o caminho velho dos arquivos", async () => {
    await lugarNovo();
    await porTodasAsTelas((n) => {
      expect(document.body.textContent, `tela ${n}`).not.toMatch(/exemplo/i);
      expect(document.body.textContent, `tela ${n}`).not.toContain("content/fichas");
      expect(screen.getByText(AVISO_RASCUNHO), `tela ${n}`).toBeTruthy();
    });
  });

  it("pular só aparece nos campos OPCIONAIS, nunca nos obrigatórios", async () => {
    await lugarNovo();
    let opcionais = 0;
    let obrigatorios = 0;
    await porTodasAsTelas(() => {
      const [m] = naTela();
      const c = campoDe(m);
      const pular = within(pergunta(m)).queryByRole("button", { name: /não sei|não tem|pular/i });
      if (c.obrigatorio) {
        expect(pular, m).toBeNull();
        obrigatorios++;
      } else {
        expect(pular, m).not.toBeNull();
        opcionais++;
      }
    });
    expect(opcionais, "sem opcional nenhum, o ramo de cima não foi medido").toBeGreaterThan(3);
    expect(obrigatorios, "sem obrigatório nenhum, o ramo de cima não foi medido").toBeGreaterThan(3);
  });

  // Com a resposta DADA, o botão é o "não sei" de sempre (tira a resposta);
  // um só por pergunta — "pular" e "não sei" juntos seriam dois botões pro
  // mesmo silêncio.
  it("opcional respondido: o 'não sei' de sempre, e nenhum 'pular' junto", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), piso: "barro" }), 2);
    await telaDe("piso");
    const botoes = within(pergunta("piso")).getAllByRole("button", { name: /não sei|não tem|pular/i });
    expect(botoes).toHaveLength(1);
    expect(botoes[0].textContent).toMatch(/não sei/i);
  });

  // Pular é um ato (o dono dizendo que não vai responder), e como o Salvar,
  // AVANÇA — sem gravar nada: a ausência já é o "não sei" no documento.
  it("pular não grava nada: diz que o app vai calar, o rascunho fica igual, e vai pra próxima", async () => {
    await lugarNovo();
    const { fetchFalso, assign, reload } = await comRotaDeVerdade();
    await telaDe("secaRapido");
    const antes = (await lerRascunho(cliente, S))!.doc;
    fireEvent.click(within(pergunta("secaRapido")).getByRole("button", { name: PULAR }));
    expect(within(pergunta("secaRapido")).getByText(PULADA)).toBeTruthy();
    expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe("secaRapido") + 1));
    expect(reload).not.toHaveBeenCalled();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect((await lerRascunho(cliente, S))!.doc).toBe(antes);
  });

  it("pular na ÚLTIMA pergunta: fica nela", async () => {
    await lugarNovo();
    const { assign, reload } = await comRotaDeVerdade();
    const ultima = ORDEM[ORDEM.length - 1];
    expect(campoDe(ultima).obrigatorio, "a premissa: a última é opcional").toBe(false);
    await telaDe(ultima);
    fireEvent.click(within(pergunta(ultima)).getByRole("button", { name: PULAR }));
    expect(within(pergunta(ultima)).getByText(PULADA)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  // 🔴 E8: "nada pré-preenchido" inclui o PLACEHOLDER — exemplo dentro da
  // caixa é resposta plausível de um lugar real que se salva sem querer. Toda
  // caixa, de toda espécie, em TODA tela: texto, número, hora, escolha, marcação.
  it("nenhum campo vem com resposta de exemplo dentro da caixa", async () => {
    await lugarNovo();
    let lidas = 0;
    // O nome e a cidade são o que ELE digitou ao criar (Tarefa 11b) — e são
    // exatamente isso, nada além.
    const DIGITADOS: Record<string, string> = { "trajeto.waypoints.0.nome": NOME, cidade: CIDADE };
    const conferidos = new Set<string>();
    await porTodasAsTelas((n, container) => {
      const [m] = naTela();
      const caixas = [...container.querySelectorAll<HTMLInputElement>("input, textarea, select")];
      // A de mapa não tem caixa nenhuma (Tarefa 11f): o "nada pré-preenchido"
      // dela é o mapa SEM PIN e o número vazio.
      if (campoDe(m).especie === "coord") {
        expect(caixas, `a tela ${n} (${m}) voltou a ter caixa de número`).toHaveLength(0);
        expect(within(pergunta(m)).getByTestId("mapa-escolher")).toBeTruthy();
        expect(pergunta(m).querySelector("[data-pin]"), `pin que ninguém pôs em ${m}`).toBeNull();
        expect(within(pergunta(m)).getByTestId("coord-atual").textContent).toBe("");
        lidas++;
        return;
      }
      expect(caixas.length, `a tela ${n} não tem caixa nenhuma`).toBeGreaterThan(0);
      for (const caixa of caixas) {
        lidas++;
        expect(caixa.getAttribute("placeholder") ?? "", `placeholder em ${m}`).toBe("");
        if (m in DIGITADOS) continue;
        if (caixa.type === "radio" || caixa.type === "checkbox") expect(caixa.checked, m).toBe(false);
        else expect(caixa.value, m).toBe("");
      }
      if (m in DIGITADOS) {
        expect(within(pergunta(m)).getByRole("textbox")).toHaveProperty("value", DIGITADOS[m]);
        conferidos.add(m);
      }
    });
    expect(lidas, "nenhuma caixa lida: o laço ficaria oco").toBeGreaterThan(20);
    expect([...conferidos].sort()).toEqual(Object.keys(DIGITADOS).sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 A VARREDURA R4 NUM RASCUNHO TODO RESPONDIDO, e o I-B da Tarefa 11 fechado
// (Tarefa 11d). A pergunta do horário presente tinha DOIS Salvar (um por
// folha), o primeiro avançava, e a hora digitada na outra caixa sumia sem
// aviso. O horário virou UM instrumento com UM Salvar que grava a lista inteira.
describe("/admin/novo — rascunho com TODAS as perguntas respondidas", () => {
  it("a premissa: o rascunho responde toda pergunta do registro, e é uma ficha que o schema aceita", () => {
    const doc = JSON.parse(docTodoRespondido());
    const sem = esperadas()
      .map((c) => concreto(c.caminho))
      .filter((m) => lerCaminho(doc, m.split(".")) === undefined);
    expect(sem, "pergunta sem resposta: a varredura abaixo não veria a tela dela respondida").toEqual([]);
    expect(fichaSchema.safeParse(doc).success).toBe(true);
    expect(doc.horario, "sem intervalo, a tela do horário teria um par de caixas só").toHaveLength(2);
  });

  it("uma pergunta por tela, UM Salvar por tela, nenhum botão de enviar, nenhum pular — e as caixas trazem as respostas DELE", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, docTodoRespondido(), 2);
    const respostas = respostasDe(JSON.parse(docTodoRespondido()));
    let caixas = 0;
    const vistas: string[] = [];
    await porTodasAsTelas((n, container) => {
      const aqui = naTela();
      expect(aqui, `a tela ${n} não tem exatamente uma pergunta`).toHaveLength(1);
      const [m] = aqui;
      vistas.push(m);
      expect(container.querySelectorAll("[data-salvar]"), `a tela ${n} (${m}) não tem UM Salvar`).toHaveLength(1);
      // 🔴 M2 da auditoria: um `<button>` sem `type` é SUBMIT. Nenhum, em tela
      // nenhuma — os botões que não gravam (+ faixa, tirar, pular, não sei) são
      // `type="button"`, e quem grava é o Salvar.
      expect(
        container.querySelectorAll('button:not([type="button"])'),
        `a tela ${n} (${m}) tem botão de enviar`,
      ).toHaveLength(0);
      expect(
        within(pergunta(m)).queryByRole("button", { name: PULAR }),
        `a tela ${n} (${m}) respondida oferece pular`,
      ).toBeNull();
      for (const caixa of container.querySelectorAll<HTMLInputElement>("input, textarea, select")) {
        caixas++;
        expect(caixa.getAttribute("placeholder") ?? "", `placeholder em ${m}`).toBe("");
        if (caixa.type === "radio" || caixa.type === "checkbox") continue;
        expect(caixa.value, `${m}: a caixa veio vazia com a resposta dele no rascunho`).not.toBe("");
        expect(respostas.has(caixa.value), `${m}: "${caixa.value}" não é resposta dele`).toBe(true);
      }
    });
    expect(vistas, "a ordem das telas não é a do questionário").toEqual([...ORDEM]);
    expect(caixas, "nenhuma caixa lida: o laço ficaria oco").toBeGreaterThan(20);
  });

  it("a tela do horário respondido: as faixas DELE nas caixas, um Salvar", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, docTodoRespondido(), 2);
    await telaDe("horario");
    const horas = [...pergunta("horario").querySelectorAll<HTMLInputElement>("[data-hora]")].map((c) => c.value);
    expect(horas).toEqual(["08:00", "10:00", "14:00", "17:00"]);
    expect(pergunta("horario").querySelectorAll("[data-salvar]")).toHaveLength(1);
  });

  // 🔴 O I-B, COM A PROVA QUE ELE PEDIA: horário presente, mudar as DUAS horas,
  // tocar UM Salvar — as duas gravadas no rascunho, e a tela avança.
  it("I-B: horário presente, mudar as duas horas, um Salvar — as duas gravadas, e vai pra próxima", async () => {
    await lugarNovo();
    await salvarRascunho(
      cliente,
      S,
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), horario: [{ abre: "08:00", fecha: "17:00" }] }),
      2,
    );
    const { chamadas, assign, reload } = await comRotaDeVerdade();
    await telaDe("horario");
    const caixa = (chave: string) =>
      pergunta("horario").querySelector<HTMLInputElement>(`[data-hora="horario.0.${chave}"]`)!;
    expect([caixa("abre").value, caixa("fecha").value], "a resposta dele não voltou pra caixa").toEqual([
      "08:00",
      "17:00",
    ]);
    fireEvent.change(caixa("abre"), { target: { value: "09:00" } });
    fireEvent.change(caixa("fecha"), { target: { value: "18:00" } });
    fireEvent.click(pergunta("horario").querySelector('[data-salvar="horario"]')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe("horario") + 1)));
    expect(reload).not.toHaveBeenCalled();
    expect(chamadas, "duas requisições: abre e fecha não gravaram juntas").toHaveLength(1);
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "horario", valor: [{ abre: "09:00", fecha: "18:00" }] });
    expect(JSON.parse((await lerRascunho(cliente, S))!.doc).horario).toEqual([{ abre: "09:00", fecha: "18:00" }]);
  });

  it("meia faixa não grava e não avança: a frase do formato, e a hora fica na caixa", async () => {
    await lugarNovo();
    const { chamadas, assign } = await comRotaDeVerdade();
    await telaDe("horario");
    const caixa = (chave: string) =>
      pergunta("horario").querySelector<HTMLInputElement>(`[data-hora="horario.0.${chave}"]`)!;
    fireEvent.change(caixa("abre"), { target: { value: "09:00" } });
    fireEvent.click(pergunta("horario").querySelector('[data-salvar="horario"]')!);
    expect(within(pergunta("horario")).getByRole("alert").textContent).toBe(HORA_VAZIA);
    expect(chamadas).toHaveLength(0);
    expect(assign).not.toHaveBeenCalled();
    expect(caixa("abre").value).toBe("09:00");
  });

  // 🔴 M1 DA AUDITORIA: A PROVA PONTA A PONTA PELO RASCUNHO. 8–10 e 14–17 pelo
  // formulário → o rascunho → a publicação → a leitura PÚBLICA, e às 11h o
  // veredito é "fechado, abre às 14h".
  // ⚠️ A PUBLICAÇÃO É DA TAREFA 12 e ainda não existe. O que ela vai gravar está
  // no brief dela (12-I3): `JSON.stringify(fichaSchema.parse(doc))` do rascunho,
  // como versão. É isso que o caso faz, à mão — não é a rota de publicar.
  it("ponta a ponta: 8–10 e 14–17 pelo formulário → publicado → a fonte pública, às 11h, diz fechado, abre às 14h", async () => {
    await lugarNovo();
    await salvarRascunho(cliente, S, docTodoRespondido([{ abre: "05:00", fecha: "17:00" }]), 2);
    const { assign } = await comRotaDeVerdade();
    await telaDe("horario");
    const h = pergunta("horario");
    fireEvent.click(h.querySelector("[data-mais-faixa]")!);
    const caixa = (i: number, chave: string) =>
      h.querySelector<HTMLInputElement>(`[data-hora="horario.${i}.${chave}"]`)!;
    fireEvent.change(caixa(0, "abre"), { target: { value: "08:00" } });
    fireEvent.change(caixa(0, "fecha"), { target: { value: "10:00" } });
    fireEvent.change(caixa(1, "abre"), { target: { value: "14:00" } });
    fireEvent.change(caixa(1, "fecha"), { target: { value: "17:00" } });
    fireEvent.click(h.querySelector('[data-salvar="horario"]')!);
    await waitFor(() => expect(assign).toHaveBeenCalled());

    const doc = (await lerRascunho(cliente, S))!.doc;
    await gravarVersao(
      cliente,
      S,
      JSON.stringify(fichaSchema.parse(JSON.parse(doc))),
      "painel",
      Math.floor(Date.now() / 1000),
    );
    const { esquecerMemoria } = await import("@/lib/ficha-fonte");
    const { getFicha } = await import("@/lib/ficha");
    esquecerMemoria();
    const f = await getFicha(S);
    expect(f, "a ficha publicada não chegou à fonte pública").not.toBeNull();
    expect(f!.horario).toEqual(ALMOCO);
    // sábado (o rascunho abre sábado e domingo), 11h em Recife
    const sabado11h = { minutos: 11 * 60, dia: 6, epochS: 0 };
    expect(fechadoAgora(aberturaDaFicha(f!), sabado11h)).toBe(true);
    expect(rotuloAbertura(aberturaDaFicha(f!), sabado11h)).toBe("abre às 14h");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 R1: A POSIÇÃO MORA NA URL (`?slug=X&p=N`), e `p` torto nunca é 500 nem
// tela vazia — cai na primeira pergunta ainda sem resposta (ou na 1ª, se todas
// tiverem).
describe("/admin/novo — a posição mora na URL", () => {
  it("escolherPosicao: cada borda de p", () => {
    const r = [true, false, true, false];
    // válido: é ele
    expect(escolherPosicao("1", r)).toBe(1);
    expect(escolherPosicao("3", r)).toBe(3);
    expect(escolherPosicao("4", r)).toBe(4);
    // torto: a primeira sem resposta (a 2ª)
    for (const p of [undefined, "", "abc", "0", "-1", "5", "99", "1.5", "2x", " 3", "1e0", ["1", "3"], []]) {
      expect(escolherPosicao(p as string | string[] | undefined, r), JSON.stringify(p)).toBe(2);
    }
    // todas respondidas: a 1ª
    expect(escolherPosicao(undefined, [true, true, true])).toBe(1);
    expect(escolherPosicao("9", [true, true, true])).toBe(1);
    // nenhuma respondida: a 1ª
    expect(escolherPosicao(undefined, [false, false])).toBe(1);
  });

  it("na página: p torto cai na 1ª sem resposta; p válido é obedecido", async () => {
    await lugarNovo();
    const total = esperadas().length;
    // o nome e a cidade já estão respondidos (é deles que o rascunho nasce): a
    // 1ª sem resposta é a 3ª
    expect(ORDEM.slice(0, 2), "a premissa: as duas primeiras são o nome e a cidade").toEqual([
      "trajeto.waypoints.0.nome",
      "cidade",
    ]);
    for (const p of [undefined, "", "abc", "0", "-2", String(total + 1), "1.5", ["3", "4"]]) {
      await paginaNovo(S, p);
      expect(naTela(), JSON.stringify(p)).toEqual([ORDEM[2]]);
      expect(screen.getByText(posicaoNaTela(3, total)), JSON.stringify(p)).toBeTruthy();
      cleanup();
    }
    await paginaNovo(S, "5");
    expect(naTela()).toEqual([ORDEM[4]]);
    cleanup();
    await paginaNovo(S, "1");
    expect(naTela()).toEqual([ORDEM[0]]);
  });

  // 🔴 R5: quem volta pelo link do rascunho na lista do painel (que não leva
  // `p`) cai na primeira pergunta SEM resposta — e não no começo de novo.
  it("sai e volta pela lista do painel: cai na primeira pergunta sem resposta", async () => {
    await lugarNovo();
    const doc = JSON.parse(docDoLugarNovo(S, NOME, CIDADE));
    doc.trajeto.waypoints[0] = { ...doc.trajeto.waypoints[0], lat: -8.1, lng: -35.2 };
    await salvarRascunho(cliente, S, JSON.stringify(doc), 2);
    const { default: Admin } = await import("@/app/admin/page");
    render(await Admin());
    const href = within(screen.getByTestId("rascunhos")).getByRole("link", { name: new RegExp(NOME) }).getAttribute("href")!;
    cleanup();
    const params = new URL(href, "http://x").searchParams;
    expect(params.get("p"), "a premissa: o link da lista não leva posição").toBeNull();
    await paginaNovo(params.get("slug")!);
    expect(naTela()).toEqual([ORDEM[3]]);
    expect(screen.getByText(posicaoNaTela(4, esperadas().length))).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 R3: ANDAR SEM GRAVAR. "Anterior" e "Próxima" são LINKS — servem pra voltar
// a uma resposta ou deixar uma obrigatória pra depois (rascunho é incompleto
// por natureza). E a lista de saltos diz quais já têm resposta.
describe("/admin/novo — andar entre as perguntas", () => {
  // 🔴 TAREFA 12 (R3 da auditoria de 06/10): na ÚLTIMA, o "Próxima" leva à tela
  // de PUBLICAR — é o fim do questionário. Até a 12, a última não tinha "Próxima".
  it("primeira: só 'Próxima'; do meio: as duas; última: 'Anterior' e o 'Próxima' que leva a publicar — e são links", async () => {
    await lugarNovo();
    const total = esperadas().length;
    await paginaNovo(S, "1");
    expect(screen.queryByRole("link", { name: ANTERIOR })).toBeNull();
    expect(screen.getByRole("link", { name: PROXIMA }).getAttribute("href")).toBe(enderecoDaPergunta(S, 2));
    cleanup();
    await paginaNovo(S, "5");
    expect(screen.getByRole("link", { name: ANTERIOR }).getAttribute("href")).toBe(enderecoDaPergunta(S, 4));
    expect(screen.getByRole("link", { name: PROXIMA }).getAttribute("href")).toBe(enderecoDaPergunta(S, 6));
    expect(screen.queryByRole("button", { name: new RegExp(`${ANTERIOR}|${PROXIMA}`) })).toBeNull();
    cleanup();
    await paginaNovo(S, String(total));
    expect(screen.getByRole("link", { name: ANTERIOR }).getAttribute("href")).toBe(enderecoDaPergunta(S, total - 1));
    expect(screen.getByRole("link", { name: PROXIMA }).getAttribute("href")).toBe(enderecoDePublicar(S));
  });

  it("andar não grava nada", async () => {
    await lugarNovo();
    const { fetchFalso } = await comRotaDeVerdade();
    await paginaNovo(S, "5");
    // o jsdom não navega; o toque no link tem de chegar, e não sair dali
    const parar = (e: Event) => e.preventDefault();
    document.addEventListener("click", parar);
    try {
      fireEvent.click(screen.getByRole("link", { name: PROXIMA }));
      fireEvent.click(screen.getByRole("link", { name: ANTERIOR }));
    } finally {
      document.removeEventListener("click", parar);
    }
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("a lista de saltos: uma por pergunta, cada uma marcada respondida ou sem resposta", async () => {
    await lugarNovo();
    await salvarRascunho(
      cliente,
      S,
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), voz: "frase marcadora" }),
      2,
    );
    const total = esperadas().length;
    await paginaNovo(S, "4");
    const saltos = within(screen.getByTestId("saltos")).getAllByRole("link");
    expect(saltos).toHaveLength(total);
    const respondidas = new Set([posDe("trajeto.waypoints.0.nome"), posDe("cidade"), posDe("voz")]);
    saltos.forEach((a, i) => {
      const n = i + 1;
      expect(a.getAttribute("href"), `salto ${n}`).toBe(enderecoDaPergunta(S, n));
      expect(a.getAttribute("aria-label"), `salto ${n}`).toBe(
        `${posicaoNaTela(n, total)}: ${respondidas.has(n) ? RESPONDIDA : SEM_RESPOSTA}`,
      );
      expect(a.getAttribute("aria-current"), `salto ${n}`).toBe(n === 4 ? "step" : null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — responder, sair e voltar", () => {
  // 🔴 R2: gravar com sucesso AVANÇA pra próxima pergunta (`location.assign`),
  // e não recarrega a mesma.
  it("sai da tela e volta: o que foi respondido continua lá", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    const { unmount } = await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), {
      target: { value: "o chao firma em dois dias" },
    });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe("voz") + 1)));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    // 🔴 pra porta do RASCUNHO, nunca pra da ficha no ar
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("/api/admin/rascunho");
    expect(chamadas[0].metodo).toBe("PUT");
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "voz", valor: "o chao firma em dois dias" });
    expect(await versaoAtual(cliente, S), "o rascunho foi parar no ar").toBeNull();

    unmount();
    await telaDe("voz");
    expect(within(pergunta("voz")).getByDisplayValue("o chao firma em dois dias")).toBeTruthy();
  });

  // 🔴 Y2 DA ONDA DE FIX 2 DA 11b: corrigir a cidade (ou o nome) muda o
  // endereço do rascunho, e a próxima pergunta é a do endereço DEVOLVIDO pela
  // porta — nunca a do slug velho, que já não existe.
  it("corrigir a cidade: vai pra próxima pergunta no endereço NOVO, que a porta devolveu", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    await telaDe("cidade");
    fireEvent.change(within(pergunta("cidade")).getByRole("textbox"), { target: { value: "Cidade Marcador Dois" } });
    fireEvent.click(pergunta("cidade").querySelector('[data-salvar="cidade"]')!);
    const novo = "lugar-marcador-um-cidade-marcador-dois";
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(novo, posDe("cidade") + 1)));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: "cidade", valor: "Cidade Marcador Dois" });
    expect(await lerRascunho(cliente, S)).toBeNull();
    expect(JSON.parse((await lerRascunho(cliente, novo))!.doc).cidade).toBe("Cidade Marcador Dois");
  });

  it("gravar na ÚLTIMA pergunta: fica na última", async () => {
    await lugarNovo();
    const { chamadas, reload, assign } = await comRotaDeVerdade();
    const ultima = ORDEM[ORDEM.length - 1];
    const total = esperadas().length;
    expect(posDe(ultima)).toBe(total);
    await telaDe(ultima);
    fireEvent.click(within(pergunta(ultima)).getAllByRole("checkbox")[0]);
    fireEvent.click(pergunta(ultima).querySelector(`[data-salvar="${ultima}"]`)!);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, total)));
    expect(chamadas).toHaveLength(1);
    expect(reload).not.toHaveBeenCalled();
  });

  // Erro de gravação NÃO avança: a frase da porta aparece, e ele fica na
  // pergunta, com o que digitou na caixa.
  it("recusa da porta: a frase na tela, e não sai da pergunta", async () => {
    await lugarNovo();
    const FRASE = "Frase marcadora da recusa.";
    const fetchFalso = vi.fn(async () => new Response(FRASE, { status: 409 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), { target: { value: "texto marcador" } });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    expect(await within(pergunta("voz")).findByText(FRASE)).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(within(pergunta("voz")).getByDisplayValue("texto marcador")).toBeTruthy();
  });

  // 🔴 ONDA 3 (m-A da re-revisão): a falha de REDE também não avança. No
  // celular com sinal ruim, avançar jogaria fora o texto que ele acabou de
  // escrever — e a mutação "a rede navega" sobrevivia à suíte inteira.
  it("falha de rede: 'Sem rede.' na tela, e não sai da pergunta", async () => {
    await lugarNovo();
    const fetchFalso = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    await telaDe("voz");
    fireEvent.change(within(pergunta("voz")).getByRole("textbox"), { target: { value: "texto marcador" } });
    fireEvent.click(pergunta("voz").querySelector('[data-salvar="voz"]')!);
    expect(await within(pergunta("voz")).findByText(ERRO_REDE)).toBeTruthy();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(within(pergunta("voz")).getByDisplayValue("texto marcador")).toBeTruthy();
  });

  // 🔴 O PADRÃO NÃO MUDOU: fora do formulário de lugar novo (a `FichaInteira`
  // não monta provedor), um editor que grava RECARREGA a página, como antes, e
  // não navega pra lugar nenhum.
  it("editor sem provedor (a ficha no ar): gravar recarrega, e não navega", async () => {
    const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload, assign });
    render(
      <EditorProsa
        campo={{ caminho: "voz", rotulo: "voz", obrigatorio: true }}
        valor="frase marcadora"
        slug="lugar-marcador-no-ar"
      />,
    );
    fireEvent.click(document.querySelector('[data-salvar="voz"]')!);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
    expect((fetchFalso.mock.calls[0] as unknown as [string])[0]).toBe("/api/admin/ficha");
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴 A COORDENADA SE MARCA NO MAPA (Tarefa 11f, pedido dele: "latitude e
  // longitude, era bom ter um mapa e a pessoa arrastar para a localização
  // correta — que horror"). Até a 11f ela entrava DIGITADA em duas caixas.
  // Agora o mapa nasce SEM PIN na vista que a página calculou (a cidade do
  // rascunho, achada só no estado do app), e o ponto é o TOQUE dele.
  // ═════════════════════════════════════════════════════════════════════════

  /** A caixa do mapa como a TELA a desenha (metade do tamanho de layout), e a
   *  moldura mostrando-a inteira — o mesmo dublê de `admin-editor-coordenada`. */
  const RECT = { left: 10, top: 20, width: MAPA_LARGURA_PX / 2, height: MAPA_ALTURA_PX / 2 };
  function dublar(el: HTMLElement): void {
    el.getBoundingClientRect = () =>
      ({ ...RECT, x: RECT.left, y: RECT.top, right: RECT.left + RECT.width, bottom: RECT.top + RECT.height, toJSON: () => ({}) }) as DOMRect;
  }
  /** Um TOQUE no ponto (x, y) de LAYOUT da caixa: encosta e solta no mesmo lugar. */
  function tocar(caminho: string, x: number, y: number): void {
    const mapa = within(pergunta(caminho)).getByTestId("mapa-escolher");
    dublar(mapa);
    dublar(mapa.parentElement!);
    const p = { clientX: RECT.left + x / 2, clientY: RECT.top + y / 2 };
    fireEvent(mapa, new MouseEvent("pointerdown", { bubbles: true, cancelable: true, ...p }));
    fireEvent(mapa, new MouseEvent("pointerup", { bubbles: true, cancelable: true, ...p }));
  }
  const numero = (caminho: string): string => within(pergunta(caminho)).getByTestId("coord-atual").textContent ?? "";
  const salvarDe = (caminho: string): HTMLButtonElement | null =>
    pergunta(caminho).querySelector<HTMLButtonElement>(`[data-salvar="${caminho}"]`);
  const zoomNaTela = (caminho: string): number =>
    Number(/\/(\d+)\/\d+\/\d+\.png$/.exec(pergunta(caminho).querySelector("img")!.getAttribute("src")!)![1]);
  const seis = (n: number): number => Number(n.toFixed(6));

  it("M4: o ponto do lugar — mapa SEM PIN na cidade dele (a de Pernambuco), sem Salvar; o toque de longe não salva nem aproximando, o de perto grava", async () => {
    await lugarNovo();
    const { chamadas, assign } = await comRotaDeVerdade();
    await telaDe("trajeto.waypoints.0.lat");
    const P = "trajeto.waypoints.0.lat";
    // sem pin, sem número, sem Salvar — e a ajuda de marcar
    expect(pergunta(P).querySelector("[data-pin]"), "um pin que ninguém pôs").toBeNull();
    expect(numero(P)).toBe("");
    expect(salvarDe(P), "Salvar sem toque gravaria o centro da vista").toBeNull();
    expect(within(pergunta(P)).getByText(MARQUE_NO_MAPA)).toBeTruthy();
    expect(within(pergunta(P)).queryAllByRole("spinbutton"), "as caixas de número voltaram").toHaveLength(0);
    // a vista é a CIDADE, no zoom da ficha pública — e a do estado do app, não o
    // homônimo que veio primeiro na resposta
    expect(buscasDeCidade).toHaveLength(1);
    expect(new URL(buscasDeCidade[0]).searchParams.get("name")).toBe(CIDADE);
    expect(zoomNaTela(P)).toBe(zoomDeTiles(MAPA_ZOOM));
    tocar(P, MAPA_LARGURA_PX / 2, MAPA_ALTURA_PX / 2);
    expect(numero(P), "o centro da vista não é a cidade de Pernambuco").toBe(
      `${seis(CIDADE_NO_MAPA.lat)}, ${seis(CIDADE_NO_MAPA.lng)}`,
    );
    // o ponto de verdade é outro toque, longe do centro
    tocar(P, 400, 40);
    const e = coordDaPosicao(400, 40, CIDADE_NO_MAPA, MAPA_ZOOM, MAPA_LARGURA_PX, MAPA_ALTURA_PX);
    const tocado = { lat: seis(e.lat), lng: seis(e.lng) };
    expect(numero(P)).toBe(`${tocado.lat}, ${tocado.lng}`);
    // afastado (z11): o Salvar existe e está desligado (C1); clicar não manda nada
    expect(salvarDe(P)!.disabled).toBe(true);
    fireEvent.click(salvarDe(P)!);
    expect(chamadas).toHaveLength(0);
    // 🔴 C-1 da revisão da 11f: aproximar NÃO torna salvável o toque dado de
    // longe — o Salvar vale pelo zoom em que o PIN foi posto, não pelo da vista
    // (até a onda de fix este caso EXIGIA o contrário, e era o furo).
    for (let z = MAPA_ZOOM; z < MAPA_ZOOM_EDITOR; z++) fireEvent.click(within(pergunta(P)).getByRole("button", { name: APROXIMAR }));
    expect(zoomNaTela(P), "premissa: a vista chegou ao zoom do portão").toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
    expect(numero(P), "aproximar mexeu no ponto").toBe(`${tocado.lat}, ${tocado.lng}`);
    expect(salvarDe(P)!.disabled, "o toque do z11 ficou salvável só por aproximar").toBe(true);
    fireEvent.click(salvarDe(P)!);
    expect(chamadas).toHaveLength(0);
    // o ponto que se grava é um toque DE PERTO
    tocar(P, 200, 120);
    const [lat, lng] = numero(P).split(", ").map(Number);
    const dePerto = { lat, lng };
    expect(dePerto, "o toque de perto não moveu o pin").not.toEqual(tocado);
    expect(salvarDe(P)!.disabled).toBe(false);
    fireEvent.click(salvarDe(P)!);
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].corpo).toEqual({ slug: S, ponto: 0, ...dePerto });
    expect(dePerto, "gravou o centro da vista").not.toEqual(CIDADE_NO_MAPA);
    await waitFor(() => expect(assign).toHaveBeenCalledWith(enderecoDaPergunta(S, posDe(P) + 1)));
    // e o rascunho tem o ponto DELE
    const doc = JSON.parse((await lerRascunho(cliente, S))!.doc);
    expect({ lat: doc.trajeto.waypoints[0].lat, lng: doc.trajeto.waypoints[0].lng }).toEqual(dePerto);
  });

  it("gravado, a pergunta volta com o pin no ponto dele, e sem buscar cidade nenhuma", async () => {
    await lugarNovo();
    const doc = JSON.parse(docDoLugarNovo(S, NOME, CIDADE));
    doc.trajeto.waypoints[0] = { ...doc.trajeto.waypoints[0], lat: -8.42, lng: -36.21 };
    await salvarRascunho(cliente, S, JSON.stringify(doc), 2);
    await comRotaDeVerdade();
    await telaDe("trajeto.waypoints.0.lat");
    const P = "trajeto.waypoints.0.lat";
    expect(pergunta(P).querySelector("[data-pin]")).not.toBeNull();
    expect(numero(P)).toBe("-8.42, -36.21");
    expect(zoomNaTela(P)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
    expect(salvarDe(P)!.disabled).toBe(false);
    expect(buscasDeCidade).toHaveLength(0);
  });

  // M2: a coordenada da CHUVA começa no ponto 0 que ele já marcou — sem rede.
  it("a chuva, com o ponto 0 marcado: a vista começa NELE, perto, sem buscar a cidade; tocar e salvar grava o toque", async () => {
    await lugarNovo();
    const doc = JSON.parse(docDoLugarNovo(S, NOME, CIDADE));
    const P0 = { lat: -8.42, lng: -36.21 };
    doc.trajeto.waypoints[0] = { ...doc.trajeto.waypoints[0], ...P0 };
    await salvarRascunho(cliente, S, JSON.stringify(doc), 2);
    const { chamadas } = await comRotaDeVerdade();
    await telaDe("condicao.coords");
    const C = "condicao.coords";
    expect(buscasDeCidade).toHaveLength(0);
    expect(zoomNaTela(C)).toBe(zoomDeTiles(MAPA_ZOOM_EDITOR));
    expect(salvarDe(C)).toBeNull();
    tocar(C, 120, 150);
    const e = coordDaPosicao(120, 150, P0, MAPA_ZOOM_EDITOR, MAPA_LARGURA_PX, MAPA_ALTURA_PX);
    const tocado = { lat: seis(e.lat), lng: seis(e.lng) };
    expect(salvarDe(C)!.disabled, "perto, o Salvar tinha de ligar com o toque").toBe(false);
    fireEvent.click(salvarDe(C)!);
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].corpo).toEqual({ slug: S, campo: C, valor: tocado });
    expect(tocado).not.toEqual(P0);
  });

  for (const [caso, resposta] of [
    ["só em outro estado", () => Response.json({ results: [GEOCODING.results[0]] })],
    ["serviço fora (503)", () => new Response("", { status: 503 })],
  ] as const) {
    it(`cidade não achada (${caso}): a vista cai no ACERVO, e a tela diz que não achou a cidade`, async () => {
      respostaDaCidade = resposta;
      await lugarNovo();
      await comRotaDeVerdade();
      await telaDe("trajeto.waypoints.0.lat");
      const P = "trajeto.waypoints.0.lat";
      expect(buscasDeCidade).toHaveLength(1);
      expect(within(pergunta(P)).getByText(VISTA_SEM_CIDADE)).toBeTruthy();
      expect(pergunta(P).querySelector("[data-pin]")).toBeNull();
      expect(salvarDe(P)).toBeNull();
      // o quadro dos lugares no ar — os do BANCO deste teste —, e não o homônimo
      const linhas = await (await import("@/lib/db")).versoesAtuais(cliente);
      const acervo = [...linhas.values()].map((v) => JSON.parse(v.doc).condicao.coords);
      expect(acervo.length, "acervo vazio: o caso mediria o ramo de sem mapa").toBeGreaterThan(0);
      const quadro = vistaDoAcervo(acervo)!;
      expect(zoomNaTela(P)).toBe(zoomDeTiles(quadro.z));
      tocar(P, MAPA_LARGURA_PX / 2, MAPA_ALTURA_PX / 2);
      expect(numero(P)).toBe(`${seis(quadro.centro.lat)}, ${seis(quadro.centro.lng)}`);
    });
  }

  // I-2 da revisão da 11f: a cidade achada DUAS vezes em Pernambuco (sem sede
  // nem município pra desempatar) cai no acervo, mas a tela não diz "não achei".
  it("cidade achada duas vezes no estado: a vista cai no ACERVO, e a tela diz que achou mais de uma", async () => {
    const outra = { ...GEOCODING.results[1], latitude: -7.9, longitude: -39.9 };
    respostaDaCidade = () => Response.json({ results: [...GEOCODING.results, outra] });
    await lugarNovo();
    await comRotaDeVerdade();
    await telaDe("trajeto.waypoints.0.lat");
    const P = "trajeto.waypoints.0.lat";
    expect(buscasDeCidade).toHaveLength(1);
    expect(within(pergunta(P)).getByText(VISTA_CIDADE_AMBIGUA)).toBeTruthy();
    expect(within(pergunta(P)).queryByText(VISTA_SEM_CIDADE)).toBeNull();
    expect(pergunta(P).querySelector("[data-pin]")).toBeNull();
    expect(salvarDe(P)).toBeNull();
  });

  // A prévia do carimbo pede ao servidor o carimbo do LUGAR com o número novo;
  // um rascunho não tem lugar no ar, e a resposta seria sempre "não consegui
  // conferir". No rascunho, digitar um número não chama rede nenhuma.
  it("número de motor no rascunho: sem prévia, nenhuma ida à rede ao digitar", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await lugarNovo();
      const { fetchFalso } = await comRotaDeVerdade();
      await telaDe("condicao.regra.limiar_mm");
      fireEvent.change(within(pergunta("condicao.regra.limiar_mm")).getByRole("spinbutton"), {
        target: { value: "3" },
      });
      vi.advanceTimersByTime(5_000);
      expect(fetchFalso).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("slug sem rascunho — inclusive o de um lugar no ar — é 404, nunca um formulário", async () => {
    await expect(paginaNovo("nao-tem")).rejects.toThrow("NEXT_NOT_FOUND");
    const noAr = (await (await import("@/lib/db")).versoesAtuais(cliente)).keys().next().value as string;
    await expect(paginaNovo(noAr)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await historico(cliente, noAr)).toHaveLength(1);
  });

  it("sem sessão: a caixa de senha, e nenhuma pergunta", async () => {
    await lugarNovo();
    cookiesFalso.mockResolvedValue({ get: () => undefined });
    const { container } = await paginaNovo(S);
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(screen.queryAllByTestId(/^pergunta-/)).toHaveLength(0);
  });

  it("painel desligado: notFound", async () => {
    vi.stubEnv("ADMIN_SENHA", "");
    await expect(paginaNovo()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("/admin/novo — o lugar novo nasce do nome e da cidade", () => {
  // 🔴 TAREFA 11b: o lugar nasce com as DUAS respostas — o nome e a cidade, as
  // duas caixas vazias e sem placeholder (nada pré-preenchido, spec §4.4).
  it("sem slug: só as perguntas do nome e da cidade, caixas vazias, e começar leva ao rascunho", async () => {
    const { chamadas, assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const caixaDo = (texto: string) => screen.getByRole("textbox", { name: texto }) as HTMLInputElement;
    const nome = caixaDo(PERGUNTAS["trajeto.waypoints.0.nome"]);
    const cidade = caixaDo(PERGUNTAS.cidade);
    expect(screen.getAllByRole("textbox"), "uma caixa a mais ou a menos").toHaveLength(2);
    for (const caixa of [nome, cidade]) {
      expect(caixa.value).toBe("");
      expect(caixa.getAttribute("placeholder") ?? "").toBe("");
    }
    expect(screen.queryAllByTestId(/^pergunta-/)).toHaveLength(0);

    fireEvent.change(nome, { target: { value: NOME } });
    fireEvent.change(cidade, { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    const nasce = "lugar-marcador-um-cidade-marcador-um";
    await waitFor(() => expect(assign).toHaveBeenCalledWith(`/admin/novo?slug=${nasce}`));
    expect(chamadas[0]).toEqual({ url: "/api/admin/rascunho", metodo: "POST", corpo: { nome: NOME, cidade: CIDADE } });
    expect(JSON.parse((await lerRascunho(cliente, nasce))!.doc).cidade).toBe(CIDADE);
  });

  it("sem a cidade: a frase da porta na tela, o nome fica na caixa, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const { CIDADE_VAZIA } = await import("@/lib/rascunho");
    const nome = screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }) as HTMLInputElement;
    fireEvent.change(nome, { target: { value: NOME } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(CIDADE_VAZIA)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(nome.value).toBe(NOME);
    expect(await lerRascunho(cliente, "lugar-marcador-um-cidade-marcador-um")).toBeNull();
  });

  // A INVERSÃO DA INVERSÃO (onda de fix da 11b, X2): o nome de um lugar que já
  // está no ar SEM cidade (como os de hoje) não nasce — a tela mostra a frase
  // que pede a cidade DAQUELE, e o que ele digitou fica nas caixas.
  it("nome de um lugar que já existe SEM cidade: a frase pede a cidade dele, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { container } = await paginaNovo();
    const { getAllFichas } = await import("@/lib/ficha");
    const { gemeoSemCidade, slugDoNome } = await import("@/lib/rascunho");
    const alvo = (await getAllFichas()).find((f) => slugDoNome(f.trajeto.waypoints[0].nome) === f.slug)!;
    expect(alvo.cidade, "a premissa: os lugares de hoje não têm cidade").toBeUndefined();
    const nome = screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }) as HTMLInputElement;
    fireEvent.change(nome, { target: { value: alvo.trajeto.waypoints[0].nome } });
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS.cidade }), { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(gemeoSemCidade(alvo.trajeto.waypoints[0].nome))).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(nome.value).toBe(alvo.trajeto.waypoints[0].nome);
    expect(await lerRascunho(cliente, `${alvo.slug}-cidade-marcador-um`)).toBeNull();
    expect(await historico(cliente, alvo.slug)).toHaveLength(1);
  });

  it("nome e cidade de um rascunho que já existe: a frase da porta na tela, e nada nasce", async () => {
    const { assign } = await comRotaDeVerdade();
    const { parDeRascunho } = await import("@/lib/rascunho");
    await lugarNovo();
    const { container } = await paginaNovo();
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS["trajeto.waypoints.0.nome"] }), {
      target: { value: NOME },
    });
    fireEvent.change(screen.getByRole("textbox", { name: PERGUNTAS.cidade }), { target: { value: CIDADE } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(parDeRascunho(`${NOME} (${CIDADE})`))).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(await lerRascunho(cliente, "lugar-marcador-um-cidade-marcador-um")).toBeNull();
    expect(screen.getByRole("button", { name: COMECAR })).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 E5: VOLTAR AO RASCUNHO PRECISA DE PORTA. Medido NA PÁGINA `/admin`, com o
// rascunho no banco: o "+ lugar novo" abre o formulário, e os rascunhos moram
// numa seção SEPARADA — nunca misturados aos lugares que estão no ar.
describe("/admin — a lista ganha a porta do lugar novo e a dos rascunhos", () => {
  async function paginaAdmin() {
    const { default: Admin } = await import("@/app/admin/page");
    return render(await Admin());
  }

  it("'+ lugar novo' leva ao formulário", async () => {
    await paginaAdmin();
    expect(screen.getByRole("link", { name: LUGAR_NOVO }).getAttribute("href")).toBe("/admin/novo");
  });

  it("o rascunho aparece na seção dele, com link pra continuar — e não na lista dos lugares no ar", async () => {
    await lugarNovo();
    const { container } = await paginaAdmin();
    const secao = screen.getByTestId("rascunhos");
    expect(within(secao).getByText(TITULO_RASCUNHOS)).toBeTruthy();
    const link = within(secao).getByRole("link", { name: new RegExp(NOME) });
    expect(link.getAttribute("href")).toBe(`/admin/novo?slug=${S}`);

    const lugares = container.querySelector<HTMLElement>('[data-testid="lugares"]')!;
    expect(lugares, "a premissa: a lista dos lugares no ar existe").not.toBeNull();
    expect(lugares.contains(secao), "a seção de rascunhos está DENTRO da lista dos lugares").toBe(false);
    expect(within(lugares).queryByText(new RegExp(NOME)), "o rascunho entrou na lista dos lugares no ar").toBeNull();
    expect(within(lugares).getAllByRole("link").length, "a premissa: os lugares no ar estão lá").toBeGreaterThan(1);
  });

  // 🔴 TAREFA 11b: a cidade aparece onde o nome aparece pra ESCOLHER — dois
  // rascunhos de mesmo nome só se distinguem por ela.
  it("o rascunho mostra a cidade dele junto do nome, dentro do item", async () => {
    await lugarNovo();
    await paginaAdmin();
    const item = screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;
    expect(item, "a premissa: o item do rascunho existe").not.toBeNull();
    expect(within(item).getByText(NOME)).toBeTruthy();
    expect(within(item).getByText(CIDADE)).toBeTruthy();
  });

  it("rascunho SEM cidade (nascido antes da 11b): só o nome, e nenhuma palavra no lugar dela", async () => {
    expect(await criarRascunho(cliente, S, JSON.stringify({ slug: S, modos: [], trajeto: { waypoints: [{ nome: NOME }] } }), 1)).toBe(true);
    await paginaAdmin();
    const item = screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;
    // O link de CONTINUAR é o do nome; o outro do item é o "publicar" (Tarefa 12).
    const continuar = within(item).getByRole("link", { name: new RegExp(NOME) });
    expect(continuar.textContent).toBe(NOME);
    expect(item.textContent).toBe(NOME + IR_PUBLICAR);
  });

  // 🔴 TAREFA 12 (R3): a segunda porta pra tela de publicar — e é um LINK, que
  // leva à tela (o que falta, o que o app vai calar); nada vai ao ar pelo toque
  // na lista.
  it("o rascunho tem o link de publicar, que leva à tela de publicar DELE", async () => {
    await lugarNovo();
    await paginaAdmin();
    const item = screen.getByTestId("rascunhos").querySelector<HTMLElement>(`[data-rascunho="${S}"]`)!;
    const link = within(item).getByRole("link", { name: IR_PUBLICAR });
    expect(link.getAttribute("href")).toBe(enderecoDePublicar(S));
  });

  it("sem rascunho, a seção não aparece", async () => {
    await paginaAdmin();
    expect(screen.queryByTestId("rascunhos")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 E1 / M8: O FORMULÁRIO DE CLIENTE NÃO IMPORTA O REGISTRO — nem por tabela.
// O guarda é a FONTE, lida pelo parser do TypeScript, seguindo os imports de
// VALOR a partir do `FormularioDeLugar` (os `import type` somem na compilação e
// não pesam no celular). A medição de kB do build é a outra metade, e está no
// relatório; esta é a que roda em todo `npm test`.
describe("o bundle do celular", () => {
  const RAIZ = path.join(process.cwd(), "src");
  // `@/lib/lugares` e `@/lib/vista-do-mapa` (Tarefa 11f, I1): a vista do mapa
  // é calculada no SERVIDOR; uma busca de cidade no celular faria a vista pular
  // depois do toque.
  const PROIBIDOS = ["@/lib/campos-da-ficha", "@/types/ficha", "zod", "@/lib/lugares", "@/lib/vista-do-mapa"];

  /** Os módulos de valor alcançáveis a partir de `inicio`, e cada especificador
   *  de import visto no caminho. */
  function alcancaveis(inicio: string): { arquivos: string[]; especificadores: string[] } {
    const vistos = new Set<string>();
    const especificadores: string[] = [];
    const resolver = (de: string, esp: string): string | null => {
      const base = esp.startsWith("@/") ? path.join(RAIZ, esp.slice(2)) : esp.startsWith(".") ? path.resolve(path.dirname(de), esp) : null;
      if (base === null) return null;
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        try {
          readFileSync(base + ext);
          return base + ext;
        } catch {
          /* tenta a próxima */
        }
      }
      return null;
    };
    const andar = (arquivo: string): void => {
      if (vistos.has(arquivo)) return;
      vistos.add(arquivo);
      const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true);
      for (const n of fonte.statements) {
        if (!ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)) continue;
        if (ts.isImportDeclaration(n) && n.importClause?.isTypeOnly) continue;
        if (ts.isExportDeclaration(n) && n.isTypeOnly) continue;
        const esp = n.moduleSpecifier;
        if (!esp || !ts.isStringLiteral(esp)) continue;
        especificadores.push(esp.text);
        const alvo = resolver(arquivo, esp.text);
        if (alvo) andar(alvo);
      }
    };
    andar(inicio);
    return { arquivos: [...vistos], especificadores };
  }

  it("o FormularioDeLugar não alcança o registro, o schema, nem o zod", () => {
    const { arquivos, especificadores } = alcancaveis(path.join(RAIZ, "app", "admin", "FormularioDeLugar.tsx"));
    // controle de não-vacuidade: o caminhante seguiu os editores de verdade
    expect(arquivos.some((a) => a.endsWith("EditorProsa.tsx")), "o caminhante não seguiu os imports").toBe(true);
    for (const p of PROIBIDOS) expect(especificadores, `o formulário de cliente alcança ${p}`).not.toContain(p);
    // e por caminho relativo também (um `./lugares` de dentro de `src/lib/`)
    for (const f of ["lugares.ts", "vista-do-mapa.ts"]) {
      expect(arquivos.some((x) => x.endsWith(path.join("lib", f))), `o formulário de cliente alcança ${f}`).toBe(false);
    }
  });

  // 🔴 E O CAMINHANTE ENXERGA O PROIBIDO quando ele está lá: a página de
  // servidor importa o registro (pelas perguntas), e o mesmo caminhante tem de
  // achá-lo. Sem isto, um caminhante cego passaria o caso de cima.
  it("controle: o mesmo caminhante acha o registro a partir da página de servidor", () => {
    const { arquivos, especificadores } = alcancaveis(path.join(RAIZ, "app", "admin", "novo", "page.tsx"));
    expect(especificadores).toContain("@/lib/campos-da-ficha");
    expect(especificadores).toContain("@/lib/vista-do-mapa");
    expect(arquivos.some((x) => x.endsWith(path.join("lib", "lugares.ts")))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Classe que a tela usa e a folha não conhece é elemento sem forma (I6 da
// revisão final de 26/09) — e regra sem classe é regra morta. As duas direções,
// pros prefixos desta tarefa.
describe("o formulário e a lista têm regra no admin.css", () => {
  it("toda classe nova tem regra, e nenhuma regra nova sobra", async () => {
    const css = semComentarios("admin/admin.css");
    await lugarNovo();
    await salvarRascunho(
      cliente,
      S,
      JSON.stringify({ ...JSON.parse(docDoLugarNovo(S, NOME, CIDADE)), horario: { abre: "05:00", fecha: "17:00" } }),
      2,
    );
    await comRotaDeVerdade();
    // uma tela do MEIO (as duas setas) com um opcional sem resposta (o "pular")
    const novo = await telaDe("piso");
    // o "pulada" só existe depois de um toque — sem ele, a regra dela pareceria morta
    fireEvent.click(within(novo.container).getByRole("button", { name: PULAR }));
    // e outra tela com o "pular" ainda de pé (o toque acima o trocou pelo "pulada")
    const outra = await telaDe("secaRapido");
    const { default: Admin } = await import("@/app/admin/page");
    const lista = render(await Admin());
    const semRascunho = await paginaNovo();
    const classes = [novo.container, outra.container, lista.container, semRascunho.container].flatMap((c) =>
      [...c.querySelectorAll("[class]")].flatMap((e) => [...e.classList]),
    );
    const PREFIXO = /^adm-(novo|pergunta|rascunho)/;
    const nossas = [...new Set(classes.filter((c) => PREFIXO.test(c)))];
    expect(nossas.length, "nenhuma classe desta tarefa foi lida").toBeGreaterThan(4);
    for (const c of nossas) expect(regraDe(css, `.${c}`), `.${c} sem regra no admin.css`).not.toBeNull();
    const regras = [...css.matchAll(/\.(adm-(?:novo|pergunta|rascunho)[a-z-]*)\s*[,{:]/g)].map((m) => m[1]);
    expect(regras.length).toBeGreaterThan(4);
    for (const r of new Set(regras)) expect(nossas, `.${r} tem regra e nenhuma tela usa`).toContain(r);
  });
});
