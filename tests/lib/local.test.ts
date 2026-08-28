import { describe, expect, it } from "vitest";
import {
  CHAVE_GPS,
  CHAVE_LOCAL,
  CHAVE_SESSAO,
  MARCA_SESSAO,
  NAO_SEI,
  VALIDADE_ESCOLHA_S,
  coordDe,
  escolhaAindaVale,
  estadoGpsEfetivo,
  lerEstadoGps,
  lerLocal,
  rotuloPilula,
  type Local,
} from "@/lib/local";

const GPS: Local = { tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: 1_800_000_000 };
const ESCOLHIDO: Local = {
  tipo: "escolhido",
  coord: { lat: -8.20111, lng: -35.56472 },
  em: 1_800_000_000,
  nome: "Gravatá",
  regiao: "Pernambuco",
};

describe("lerLocal: nada guardado, ou guardado torto, é 'não sei'", () => {
  it("sem nada guardado", () => {
    expect(lerLocal(null)).toEqual(NAO_SEI);
  });

  it("texto que não é JSON não derruba a home", () => {
    expect(lerLocal("{isso não é json")).toEqual(NAO_SEI);
  });

  // Uma versão antiga do app pode ter gravado outra forma aqui. Aceitar
  // qualquer objeto faria coordDe devolver {lat: undefined} e o mapa
  // enquadrar contra NaN — mapa em branco, sem erro nenhum.
  it("objeto com tipo desconhecido", () => {
    expect(lerLocal(JSON.stringify({ tipo: "satelite", coord: { lat: 1, lng: 2 } }))).toEqual(NAO_SEI);
  });

  it("gps sem coordenada numérica", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: "-8", lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("escolhido sem nome não vira escolhido — a pílula ficaria sem o que dizer", () => {
    expect(
      lerLocal(JSON.stringify({ tipo: "escolhido", coord: { lat: -8, lng: -35 }, em: 1, regiao: "PE" })),
    ).toEqual(NAO_SEI);
  });

  it("coordenada fora do mundo é recusada", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: 99, lng: -35 }, em: 1 }))).toEqual(NAO_SEI);
  });

  it("escolhido sem regiao não vira escolhido — regiao é obrigatória como nome", () => {
    expect(
      lerLocal(JSON.stringify({ tipo: "escolhido", coord: { lat: -8, lng: -35 }, em: 1, nome: "Gravatá" })),
    ).toEqual(NAO_SEI);
  });

  it("escolhido com regiao não-string não vira escolhido", () => {
    expect(
      lerLocal(
        JSON.stringify({ tipo: "escolhido", coord: { lat: -8, lng: -35 }, em: 1, nome: "Gravatá", regiao: 123 }),
      ),
    ).toEqual(NAO_SEI);
  });

  it("gps sem 'em' não vira gps — timestamp é obrigatório", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: -8, lng: -35 } }))).toEqual(NAO_SEI);
  });

  it("gps com 'em' não-numérico não vira gps", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: -8, lng: -35 }, em: "agora" }))).toEqual(NAO_SEI);
  });

  it("gps com 'em' = NaN não vira gps", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: -8, lng: -35 }, em: NaN }))).toEqual(NAO_SEI);
  });

  it("gps com 'em' = Infinity não vira gps", () => {
    expect(lerLocal(JSON.stringify({ tipo: "gps", coord: { lat: -8, lng: -35 }, em: Infinity }))).toEqual(NAO_SEI);
  });

  it("ida e volta preserva o gps", () => {
    expect(lerLocal(JSON.stringify(GPS))).toEqual(GPS);
  });

  it("ida e volta preserva o escolhido, com nome e região", () => {
    expect(lerLocal(JSON.stringify(ESCOLHIDO))).toEqual(ESCOLHIDO);
  });
});

describe("coordDe", () => {
  it("'não sei' não tem coordenada — quem chama decide o que fazer", () => {
    expect(coordDe(NAO_SEI)).toBeNull();
  });
  it("gps e escolhido têm", () => {
    expect(coordDe(GPS)).toEqual(GPS.coord);
    expect(coordDe(ESCOLHIDO)).toEqual(ESCOLHIDO.coord);
  });
});

describe("rotuloPilula: a pílula é o único lugar de onde a localização se mexe", () => {
  it("nunca perguntou: convida", () => {
    expect(rotuloPilula(NAO_SEI, "nunca")).toBe("Ver daqui");
  });

  // Negado uma vez, o navegador não pergunta de novo. Continuar oferecendo
  // "Ver daqui" seria um botão que não faz nada.
  it("negado: oferece o caminho manual, sem insistir no GPS", () => {
    expect(rotuloPilula(NAO_SEI, "negado")).toBe("escolher onde estou");
  });

  // 🔴 A PALAVRA TEM QUE DIZER O QUE O DEDO VAI FAZER. Com `falhou`, o toque
  // passa a ABRIR O PAINEL em vez de repedir o GPS (ver `soGps` no
  // `BuscaLugar`): continuar dizendo "Ver daqui" seria o rótulo mentindo sobre
  // a ação — e o beco de 2026-08-27 era exatamente um botão que não fazia nada.
  it("falhou nesta sessão: troca de caminho, como o negado", () => {
    expect(rotuloPilula(NAO_SEI, "falhou")).toBe("escolher onde estou");
  });

  // O GPS não devolve nome de cidade. Inventar um seria inventar geografia.
  it("gps: diz 'daqui', sem nome de lugar", () => {
    expect(rotuloPilula(GPS, "nunca")).toBe("daqui · trocar");
  });

  it("escolhido: diz o nome que o serviço devolveu", () => {
    expect(rotuloPilula(ESCOLHIDO, "nunca")).toBe("de Gravatá · trocar");
  });

  // Já teve localização = já permitiu, ou escolheu na mão. O texto não pode
  // regredir pro convite só porque a flag de gps diz "negado".
  it("com localização, o estado do gps não muda o rótulo", () => {
    expect(rotuloPilula(ESCOLHIDO, "negado")).toBe("de Gravatá · trocar");
  });
});

describe("lerEstadoGps", () => {
  it("sem nada guardado é 'nunca'", () => {
    expect(lerEstadoGps(null)).toBe("nunca");
  });
  it("qualquer coisa que não seja 'negado' é 'nunca'", () => {
    expect(lerEstadoGps("talvez")).toBe("nunca");
  });
  it("'negado' se mantém", () => {
    expect(lerEstadoGps("negado")).toBe("negado");
  });

  // 🔴 A METADE QUE IMPEDE O REMÉDIO DE VIRAR O PRÓXIMO DEFEITO. `falhou` é de
  // SESSÃO: se ele chegasse ao `localStorage`, um prédio sem sinal rebaixaria o
  // app PRA SEMPRE — exatamente o que o `bp.gps = "negado"` eterno do §Z2 fez,
  // com outra causa. Esta é a porta de entrada do que está guardado, e ela não
  // tem como devolver `falhou`.
  it("'falhou' NÃO entra pelo armazenamento — é de sessão, e só", () => {
    expect(lerEstadoGps("falhou")).toBe("nunca");
  });
});

describe("a chave de armazenamento", () => {
  it("tem prefixo do app — o localStorage é compartilhado com todo o domínio", () => {
    expect(CHAVE_LOCAL.startsWith("bp.")).toBe(true);
  });

  it("CHAVE_LOCAL tem valor exato — contrato com Tasks 2, 6 e 10", () => {
    expect(CHAVE_LOCAL).toBe("bp.local");
  });

  it("CHAVE_GPS tem valor exato — contrato com Tasks 2, 6 e 10", () => {
    expect(CHAVE_GPS).toBe("bp.gps");
  });
});

// ——————— a validade da escolha à mão ———————
//
// 🔴 AS TRÊS CLÁUSULAS SÃO MEDIDAS SEPARADAS. Num E, a primeira que falha
// esconde as outras: um teste só, com as três erradas ao mesmo tempo, passaria
// verde com duas das três cláusulas apagadas do código.
//
// A decisão do João (2026-08-23) foi cinto E suspensório: "aba viva E no
// máximo 6h". A de tempo sozinha não fecharia a leitura literal de sessão no
// navegador; a de aba sozinha não fecha o PWA do iPhone, que fica SUSPENSO e
// não fechado — reabrir amanhã continuaria mostrando a cidade de ontem.
describe("escolhaAindaVale", () => {
  const escolhida = (em: number): Local => ({
    tipo: "escolhido", coord: { lat: -8.2, lng: -35.56 }, em,
    nome: "Gravatá", regiao: "Pernambuco",
  });
  const AGORA = 1_800_000_000;

  it("escolha fresca, na mesma aba, ainda vale", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, MARCA_SESSAO)).toBe(true);
  });

  // Mata a cláusula do marcador sozinha: idade idêntica à do teste acima, e a
  // ÚNICA diferença é a aba. Sem essa cláusula no código, este teste passa a
  // devolver `true` e cai.
  it("escolha fresca em ABA NOVA não vale — o marcador morre com a aba", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, null)).toBe(false);
  });

  // Mata a cláusula do tempo sozinha: marcador presente, e a única diferença é
  // a idade. É o caso do PWA suspenso.
  it("escolha de 7h, mesma aba, não vale mais", () => {
    const seteHoras = 7 * 60 * 60;
    expect(escolhaAindaVale(escolhida(AGORA - seteHoras), AGORA, MARCA_SESSAO)).toBe(false);
  });

  // A FRONTEIRA, nos dois lados, e ela é escrita contra o SÍMBOLO: prova a
  // relação (`<`, não `<=`) e é cega ao número.
  it("um segundo antes das 6h vale; exatamente 6h não vale mais", () => {
    expect(escolhaAindaVale(escolhida(AGORA - VALIDADE_ESCOLHA_S + 1), AGORA, MARCA_SESSAO)).toBe(true);
    expect(escolhaAindaVale(escolhida(AGORA - VALIDADE_ESCOLHA_S), AGORA, MARCA_SESSAO)).toBe(false);
  });

  // 🔴 A OUTRA METADE, e ela é ORTOGONAL à de cima: o teste da fronteira é
  // auto-referente quanto ao VALOR — trocar a constante pra 30 minutos o
  // deixaria verde, porque ele vira "29min59 vale, 30min não", correto com 30
  // minutos. Só uma asserção sobre o NÚMERO pega isso.
  it("a validade é de 6 horas em SEGUNDOS — o valor, não só a relação", () => {
    expect(VALIDADE_ESCOLHA_S).toBe(21600);
  });

  // A primeira cláusula. Sem ela, uma leitura de GPS herdaria a validade da
  // escolha à mão e o app pararia de se atualizar sozinho por 6h.
  it("gps e 'não sei' NUNCA valem como escolha — nem com marcador, nem frescos", () => {
    const gps: Local = { tipo: "gps", coord: { lat: -8.2, lng: -35.56 }, em: AGORA };
    expect(escolhaAindaVale(gps, AGORA, MARCA_SESSAO)).toBe(false);
    // 🔴 Esta sub-asserção não tem dono de mutação próprio: `{ tipo: "nao-sei" }`
    // não tem `em`, então `AGORA - undefined` é `NaN`, e `NaN < VALIDADE_ESCOLHA_S`
    // é `false` — coincide com o esperado por acidente aritmético, não porque a
    // cláusula do `tipo` tenha sido exercitada. A cobertura de mutação real desta
    // linha vem da metade do `gps`, logo acima; esta linha fica como conferência
    // de FORMA (o `it` continua descrevendo os dois tipos juntos).
    expect(escolhaAindaVale({ tipo: "nao-sei" }, AGORA, MARCA_SESSAO)).toBe(false);
  });

  // Marcador com valor DESCONHECIDO não vale. Sem esta asserção, um
  // `marcadorDaSessao !== null` passaria — e a chave é do domínio inteiro:
  // qualquer coisa pode ter escrito nela.
  it("marcador com outro valor não conta", () => {
    expect(escolhaAindaVale(escolhida(AGORA - 60), AGORA, "sim")).toBe(false);
  });
});

// A chave é do domínio inteiro, como CHAVE_LOCAL e CHAVE_GPS.
describe("a chave da sessão", () => {
  it("tem prefixo do app", () => {
    expect(CHAVE_SESSAO.startsWith("bp.")).toBe(true);
  });
  it("CHAVE_SESSAO tem valor exato — contrato com o local.tsx", () => {
    expect(CHAVE_SESSAO).toBe("bp.sessao");
  });
});

// ——————— a permissão do navegador vence a lembrança do app ———————
//
// 🔴 O DEFEITO QUE ISTO CORRIGE FOI MEDIDO NO NAVEGADOR DO DONO DO APP, em
// produção: `navigator.permissions.query({name:"geolocation"})` respondia
// `granted` e o `bp.gps` guardado dizia `negado`. O app escondia o botão
// "daqui" com base na lembrança, e a lembrança estava errada.
//
// A causa é de desenho, não de linha: `"negado"` era gravado UMA vez, no
// callback de erro `code 1`, e **nenhum ponto do código o apagava ou
// reescrevia**. Quem negasse uma vez — num teste, sem querer — ficava marcado
// pra sempre, e liberar a permissão nas configurações do navegador não
// desfazia. O app usava MEMÓRIA onde existe FONTE.
describe("estadoGpsEfetivo: quem manda é o navegador, não a lembrança", () => {
  it("navegador PERMITE e a lembrança diz negado: o navegador vence", () => {
    expect(estadoGpsEfetivo("negado", "granted")).toBe("nunca");
  });

  it("navegador ainda vai PERGUNTAR: também não é negado", () => {
    expect(estadoGpsEfetivo("negado", "prompt")).toBe("nunca");
  });

  // A direção oposta, e ela precisa existir junto: sem este caso, devolver
  // "nunca" sempre passaria nos dois testes acima.
  it("navegador NEGA de verdade: negado, mesmo sem lembrança", () => {
    expect(estadoGpsEfetivo("nunca", "denied")).toBe("negado");
    expect(estadoGpsEfetivo("negado", "denied")).toBe("negado");
  });

  // 🔴 O RAMO DO iPHONE, e ele não é hipotético: o Safari só passou a
  // responder `permissions.query` pra geolocalização em versões recentes, e
  // antes disso REJEITA. Sem fonte, a lembrança é tudo o que há — e o
  // comportamento tem que ser exatamente o de hoje, senão esta correção vira
  // uma regressão em quem não tem a API.
  it("sem a API de permissão, a lembrança continua mandando", () => {
    expect(estadoGpsEfetivo("negado", null)).toBe("negado");
    expect(estadoGpsEfetivo("nunca", null)).toBe("nunca");
  });

  // 🔴 O ESTADO `falhou` E A CORRIDA QUE ELE TEM QUE GANHAR (2026-08-27). A
  // resposta da permissão chega ASSÍNCRONA, e o pedido de posição sai antes
  // dela: um `granted` chegando depois de um `code 2` devolveria o estado pra
  // `nunca` e trancaria o beco de novo, milissegundos depois de ele abrir.
  //
  // Os três casos abaixo SÃO a ordem das linhas da função, e cada um morde uma
  // troca de lugar diferente entre elas.
  it("uma falha DESTA SESSÃO sobrevive ao 'granted' que chega depois", () => {
    expect(estadoGpsEfetivo("falhou", "granted")).toBe("falhou");
    expect(estadoGpsEfetivo("falhou", "prompt")).toBe("falhou");
  });

  it("mas 'denied' vence até a falha — é o navegador dizendo não", () => {
    expect(estadoGpsEfetivo("falhou", "denied")).toBe("negado");
  });

  it("sem a API, a falha da sessão também continua valendo", () => {
    expect(estadoGpsEfetivo("falhou", null)).toBe("falhou");
  });
});
