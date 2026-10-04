import { describe, expect, it } from "vitest";
import { atoDeVisibilidade, camposQueMudaram } from "@/lib/campos-mudados";
import { loadAll } from "@/lib/ficha";

/** O "que campo mudou" de uma versão pra anterior (Task 9, 2026-10-01).
 *
 *  🔴 A FUNÇÃO É PURA E MORA EM `src/lib/` (B2 da auditoria): o histórico é
 *  `"use client"` e não pode importar o registro de campos, que traz o zod pro
 *  bundle do celular. Quem chama é a página do servidor, e o componente recebe
 *  os rótulos prontos. Por isso as mutações do DIFF (M1, M2, M7) morrem AQUI, e
 *  não no teste do componente — o componente nunca vê um documento. */

// A Rampa é a única ficha do acervo com `custo.valor` E `custo.curto` E sem
// `horario`; a Pedra Furada tem `horario`. Medido em `content/fichas/`.
const ACERVO = loadAll();
const RAMPA = ACERVO.find((f) => f.slug === "rampa-do-pepe")!;
const PEDRA = ACERVO.find((f) => f.slug === "pedra-furada-de-venturosa")!;
const doc = (x: unknown) => JSON.stringify(x);

describe("camposQueMudaram", () => {
  // 🔴 A premissa: documento idêntico não muda nada. Sem ela, um diff que
  // devolvesse SEMPRE a lista inteira passaria todos os "lista X" abaixo.
  it("o mesmo documento: nenhum campo mudou", () => {
    expect(camposQueMudaram(doc(RAMPA), doc(RAMPA))).toEqual([]);
  });

  // 🔴 M1: o diff de antes (`HistoricoDaVoz.tsx`, renomeado `HistoricoDaFicha.tsx`
  // nesta tarefa) só extraía `voz` — uma versão
  // que mudou o preço aparecia como se nada tivesse mudado, e o dono não via o
  // próprio trabalho.
  it("versão que mudou só o preço NÃO aparece como 'nada mudou' — o campo do preço sai", () => {
    const nova = { ...RAMPA, custo: { ...RAMPA.custo, valor: "R$ 7 por pessoa" } };
    expect(camposQueMudaram(doc(RAMPA), doc(nova))).toEqual(["custo.valor"]);
  });

  it("versão que mudou só a voz lista a voz", () => {
    expect(camposQueMudaram(doc(RAMPA), doc({ ...RAMPA, voz: "outra" }))).toEqual(["voz"]);
  });

  // 🔴 M2: devolver só o PRIMEIRO campo que mudou. E a ORDEM é a do registro
  // (voz antes de custo), que é a ordem em que a ficha inteira mostra os blocos.
  it("versão que mudou DOIS campos lista os dois, na ordem do registro", () => {
    const nova = { ...RAMPA, custo: { ...RAMPA.custo, curto: "R$ 7" }, voz: "outra" };
    expect(camposQueMudaram(doc(RAMPA), doc(nova))).toEqual(["voz", "custo.curto"]);
  });

  // 🔴 M7: comparar por `JSON.stringify` acusa ORDEM DE CHAVE como mudança de
  // conteúdo. O documento é dado — uma gravação por outra porta (a semente, o
  // "voltar") pode reescrever as chaves em outra ordem sem mudar uma palavra.
  // Inverte a ordem no topo E dentro de um valor que é objeto (`condicao.coords`
  // é `{lat, lng}`, o único campo do registro cujo VALOR é um objeto).
  it("as mesmas chaves em outra ordem: nenhum campo mudou", () => {
    const invertido = Object.fromEntries(Object.entries(RAMPA).reverse()) as typeof RAMPA;
    const coords = RAMPA.condicao!.coords;
    invertido.condicao = { ...RAMPA.condicao!, coords: { lng: coords.lng, lat: coords.lat } };
    expect(doc(invertido), "a premissa: os dois textos são DIFERENTES").not.toBe(doc(RAMPA));
    expect(camposQueMudaram(doc(RAMPA), doc(invertido))).toEqual([]);
  });

  it("documento que não parseia: lista vazia, sem derrubar — dos dois lados", () => {
    expect(camposQueMudaram("{lixo", doc(RAMPA))).toEqual([]);
    expect(camposQueMudaram(doc(RAMPA), "{lixo")).toEqual([]);
  });

  // JSON que abre mas não é objeto (`null`, número) também não derruba.
  it("documento que abre mas não é ficha: lista vazia ou só o que dá pra dizer, sem estourar", () => {
    expect(() => camposQueMudaram("null", doc(RAMPA))).not.toThrow();
    expect(() => camposQueMudaram(doc(RAMPA), "42")).not.toThrow();
  });

  // A primeira versão não tem anterior: não há o que comparar, e "mudou tudo"
  // encheria a linha da semente com os 30 rótulos da ficha.
  it("sem versão anterior: lista vazia", () => {
    expect(camposQueMudaram(null, doc(RAMPA))).toEqual([]);
  });

  // 🔴 O MOLDE se expande na UNIÃO das duas versões: um ponto novo no trajeto
  // só existe na versão nova, e um diff que expandisse só pela anterior não o
  // veria.
  it("contagem de pontos diferente entre as duas: as folhas do ponto novo saem", () => {
    const ponto = { nome: "Ponto dois", lat: -8, lng: -36 };
    const nova = { ...RAMPA, trajeto: { ...RAMPA.trajeto, waypoints: [...RAMPA.trajeto.waypoints, ponto] } };
    expect(camposQueMudaram(doc(RAMPA), doc(nova))).toEqual([
      "trajeto.waypoints.1.nome",
      "trajeto.waypoints.1.lat",
      "trajeto.waypoints.1.lng",
    ]);
    // e o ponto que SAIU também aparece — pela versão anterior
    expect(camposQueMudaram(doc(nova), doc(RAMPA))).toEqual([
      "trajeto.waypoints.1.nome",
      "trajeto.waypoints.1.lat",
      "trajeto.waypoints.1.lng",
    ]);
  });

  it("um ponto que mudou só a latitude lista só a latitude dele", () => {
    const [p0] = RAMPA.trajeto.waypoints;
    const nova = { ...RAMPA, trajeto: { ...RAMPA.trajeto, waypoints: [{ ...p0, lat: p0.lat + 0.001 }] } };
    expect(camposQueMudaram(doc(RAMPA), doc(nova))).toEqual(["trajeto.waypoints.0.lat"]);
  });

  // 🔴 O HORÁRIO É UM CAMPO SÓ desde a Tarefa 11c — a lista de faixas. Mudar a
  // hora de fechar de uma faixa é "o horário mudou", e tirá-lo ou devolvê-lo
  // também: uma mudança, a do horário.
  it("o horário que mudou uma hora é UMA mudança, a do horário", () => {
    const nova = { ...PEDRA, horario: [{ ...PEDRA.horario![0], fecha: "18:00" }] };
    expect(camposQueMudaram(doc(PEDRA), doc(nova))).toEqual(["horario"]);
  });

  it("o horário que saiu ou entrou inteiro é uma mudança só", () => {
    const { horario: _, ...semHorario } = PEDRA;
    expect(camposQueMudaram(doc(PEDRA), doc(semHorario))).toEqual(["horario"]);
    expect(camposQueMudaram(doc(semHorario), doc(PEDRA))).toEqual(["horario"]);
  });

  // 🔴 11c-I3 DA AUDITORIA: a primeira edição de QUALQUER campo de uma ficha
  // gravada na forma VELHA (`{abre, fecha}`) reescreve o horário em LISTA,
  // porque a porta passa o documento inteiro pelo schema. Comparando os
  // documentos crus, o histórico diria ao dono que ele mudou o horário numa
  // versão em que ele mudou a voz — o app afirmando o que o DONO fez.
  it("forma velha → lista com a mesma hora, e a voz trocada: só a voz mudou", () => {
    const velha = { ...PEDRA, horario: { abre: "05:00", fecha: "17:00" } };
    const nova = { ...PEDRA, voz: "outra voz", horario: [{ abre: "05:00", fecha: "17:00" }] };
    expect(camposQueMudaram(doc(velha), doc(nova))).toEqual(["voz"]);
    // e ao contrário (o "voltar" a uma versão velha, que grava verbatim)
    expect(camposQueMudaram(doc(nova), doc(velha))).toEqual(["voz"]);
  });

  it("forma velha → lista com OUTRA hora: o horário mudou, de verdade", () => {
    const velha = { ...PEDRA, horario: { abre: "05:00", fecha: "17:00" } };
    const nova = { ...PEDRA, horario: [{ abre: "05:00", fecha: "10:00" }, { abre: "14:00", fecha: "17:00" }] };
    expect(camposQueMudaram(doc(velha), doc(nova))).toEqual(["horario"]);
  });

  it("lista com os mesmos dias em outra ordem É mudança (a ordem da lista é dado)", () => {
    const nova = { ...RAMPA, dias: [...(RAMPA.dias ?? [])].reverse() };
    expect(RAMPA.dias!.length, "a premissa: a Rampa tem mais de um dia").toBeGreaterThan(1);
    expect(camposQueMudaram(doc(RAMPA), doc(nova))).toEqual(["dias"]);
  });
});

/** 🔴 R2 DA ONDA DE CONSERTO 1 DA TASK 9 (2026-10-01): o histórico marca o ATO,
 *  não o estado. Antes a marca "escondido" vinha do `oculto` da versão, então
 *  toda edição feita com o lugar escondido a carregava, e a versão que MOSTROU
 *  o lugar de novo aparecia sem nada — o dono perdia a trilha de quando o
 *  lugar voltou ao ar. Decisão do orquestrador: marca só quando o `oculto`
 *  MUDOU em relação à versão anterior. */
describe("atoDeVisibilidade", () => {
  it("a versão que escondeu: 'escondeu'", () => {
    expect(atoDeVisibilidade(false, true)).toBe("escondeu");
  });
  it("a versão que mostrou de novo: 'mostrou'", () => {
    expect(atoDeVisibilidade(true, false)).toBe("mostrou");
  });
  it("edição com o lugar JÁ escondido (e edição com ele no ar): sem marca", () => {
    expect(atoDeVisibilidade(true, true)).toBeNull();
    expect(atoDeVisibilidade(false, false)).toBeNull();
  });
  it("a semente (sem anterior) só leva marca se nasceu escondida", () => {
    expect(atoDeVisibilidade(null, true)).toBe("escondeu");
    expect(atoDeVisibilidade(null, false)).toBeNull();
  });
});
