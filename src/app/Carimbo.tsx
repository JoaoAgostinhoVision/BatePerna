"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Estado } from "@/lib/motor";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import { fechadoPeloDono, type Aviso } from "@/lib/aviso";
import AvisoDoDono from "./AvisoDoDono";
import {
  PRAZO_CONFERINDO_MS,
  type Fase,
  type Gatilho,
  type Sintoma,
  faseDe,
  marcaDe,
  podeBuscar,
  sintomaDe,
  subDe,
} from "@/lib/carimbo-fase";
import { fechadoAgora, rotuloAbertura, rotuloFaixa, type Abertura } from "@/lib/horario";
import type { Voz } from "@/lib/severidade";
import { chuvaNoPiso, type Piso } from "@/lib/piso";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";
import { useAvisarMoldura } from "./Moldura";
import { useAgoraRecife } from "./useAgoraRecife";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, os `avisos` da ficha, o que ler no portão — é verdade parada.
 *
 *  ⚠️ "aviso" virou duas coisas em 2026-09-15, e esta lista fala de UMA. Os
 *  `avisos` da FICHA são texto parado, escrito uma vez. O `aviso` do DONO
 *  (`src/lib/aviso.ts`) tem prazo, vem do banco junto com a leitura e viaja
 *  DENTRO do carimbo — esse apodrece, e é por isso que ele mora aqui.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe, devolve a
 *  decisão, e se oferece pra ir buscar de novo. "Não vá" ficou reservado pro
 *  barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  aviso,
  pass,
  fut,
  slug,
  secaRapido,
  piso,
  abertura,
  voz,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  /** A palavra do dono sobre este lugar, se houver uma valendo. Chega junto com
   *  a leitura do servidor e é o ponto de partida, igual aos três de cima: a
   *  busca do portão pode trazer outra. */
  aviso: Aviso | null;
  pass: number;
  fut: number;
  slug: string;
  /** A meia-frase de relevo da FICHA desta trilha. Opcional: sem ela, a linha
   *  verde termina no ponto final. Ver `secaRapido` em `src/types/ficha.ts`. */
  secaRapido?: string;
  /** O piso da via desta trilha — quem decide o que a CHUVA faz com o chão na
   *  linha vermelha. Opcional pela mesma razão: sem ele, a linha termina no
   *  ponto final. Ver `chuvaNoPiso` em `src/lib/piso.ts`. */
  piso?: Piso;
  /** A faixa de horário desta trilha. Sem ela, o carimbo NUNCA fecha e decide
   *  só pela chuva, como sempre fez. Ver `src/lib/horario.ts`. */
  abertura?: Abertura;
  /** O nível de severidade desta trilha e a janela da própria ficha — é daqui
   *  que saem as palavras do ramo molhado. Obrigatório de propósito: com
   *  padrão, uma ficha nova entraria calada herdando a voz da Rampa, que é o
   *  defeito que `src/lib/severidade.ts` existe pra fechar. */
  voz: Voz;
}) {
  // O relógio da hora do dia, irmão do relógio da validade logo abaixo.
  // `null` no primeiro render — a ficha é pré-renderizada em build, então
  // calcular a hora durante o render brigaria com a hidratação.
  const agora = useAgoraRecife();
  // A leitura do servidor é só o ponto de partida: daqui pra frente o
  // componente pode trocá-la por uma mais nova. O primeiro render usa
  // exatamente o que veio no HTML, pra a hidratação bater.
  const [leitura, setLeitura] = useState<LeituraCarimbo>({ estado, erro, calculadoEm, aviso });
  const [venceu, setVenceu] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  // A cor mora no <main> (data-state), fora deste componente: ela pinta o selo
  // E o pin do mapa, que é irmão daqui. Sem avisar a Moldura, uma leitura nova
  // trocaria a palavra sem trocar a cor — "Não vá" dentro de um selo verde.
  const avisarMoldura = useAvisarMoldura();

  // Refs, e não estado: os ouvintes são registrados uma vez e leriam um estado
  // congelado no valor daquele render.
  const leituraRef = useRef(leitura);
  leituraRef.current = leitura;
  const naTela = useRef(false);          // há um "Conferindo…" na tela agora
  const ultimaTentativa = useRef(Number.NEGATIVE_INFINITY);
  const geracao = useRef(0);
  const vivo = useRef(true);
  // Rearmar na montagem, não só derrubar na limpeza: o StrictMode do `next dev`
  // monta, limpa e monta de novo. Sem esta linha o segundo mount nasce morto —
  // toda resposta é descartada e a tela fica em "CONFERINDO…" pra sempre, que é
  // justamente o estado em que o app não responde à pergunta. Produção não
  // sofre, mas o ambiente onde a gente confere com o olho passaria a mentir.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  // O relógio da validade. Serve a tela aberta na mão; quem cobre o celular no
  // bolso são os gatilhos lá embaixo, porque navegador estrangula timer de aba
  // escondida.
  useEffect(() => {
    const checar = () =>
      setVenceu(carimboVenceu(leitura.calculadoEm, Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [leitura.calculadoEm]);

  const buscar = useCallback(async () => {
    naTela.current = true;
    ultimaTentativa.current = Date.now();
    const minha = ++geracao.current;
    setConferindo(true);
    setFalhou(false);

    // O prazo tira o "Conferindo…" da tela, mas NÃO cancela a requisição: se a
    // resposta chegar aos 7s, ela ainda vale. Libera o toque junto — prender o
    // botão esperando uma resposta que já saiu da tela seria travar por nada.
    const relogio = setTimeout(() => {
      if (geracao.current !== minha || !vivo.current) return;
      naTela.current = false;
      setConferindo(false);
      setFalhou(true);
    }, PRAZO_CONFERINDO_MS);

    try {
      const res = await fetch(`/api/carimbo?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const nova: unknown = await res.json();
      // O corpo é conferido, não assumido: é ele que vira a decisão que a
      // pessoa lê no portão. Um 200 com corpo fora da forma daria `undefined`
      // nos campos e carimboVenceu(undefined) é NaN >= 1800 → false: a
      // tela afirmaria "Pode ir" a partir de nada. Corpo inválido é falha.
      if (!ehLeitura(nova)) throw new Error("corpo fora da forma da leitura");
      if (geracao.current !== minha || !vivo.current) return;
      // Os quatro num lote só, de propósito. `venceu` é recalculado aqui em vez
      // de esperar o efeito [leitura.calculadoEm]: efeito passivo roda em tarefa
      // separada do commit, e no meio o navegador pinta um quadro em que a
      // leitura que ACABOU de chegar aparece como "já passou do prazo". O efeito
      // segue dono do relógio contínuo; este é só o instante da chegada.
      setLeitura(nova);
      setVenceu(carimboVenceu(nova.calculadoEm, Math.floor(Date.now() / 1000)));
      avisarMoldura({ estado: nova.estado });
      setFalhou(false);
    } catch {
      if (geracao.current !== minha || !vivo.current) return;
      setFalhou(true);
    } finally {
      clearTimeout(relogio);
      if (geracao.current === minha) {
        naTela.current = false;
        if (vivo.current) setConferindo(false);
      }
    }
  }, [slug, avisarMoldura]);

  const tentar = useCallback(
    (gatilho: Gatilho) => {
      const jaVenceu = carimboVenceu(leituraRef.current.calculadoEm, Math.floor(Date.now() / 1000));
      // Hoje esta linha é redundante na prática: todo gatilho automático que
      // encontra jaVenceu=true também passa em podeBuscar (que olha esta mesma
      // variável local, não o estado React) e dispara buscar() — e é o prazo
      // de 3s (ou a resposta) de buscar() que acaba levando a tela pra
      // "sem-informacoes", com ou sem este setVenceu. Testamos isto por
      // mutação: apagar a linha não quebra nenhum teste hoje.
      //
      // Mesmo assim ela fica, como cinto de segurança: no instante em que
      // podeBuscar bloquear algum caminho com leitura vencida (o piso é
      // exatamente essa regra — hoje inalcançável a partir de "afirmando",
      // porque a primeira busca automática nunca nasce dentro do piso), sem
      // esta linha a tela ficaria presa afirmando uma leitura que já venceu,
      // porque a busca nem sairia pra corrigir o estado.
      setVenceu(jaVenceu);
      const pode = podeBuscar(gatilho, {
        erro: leituraRef.current.erro,
        venceu: jaVenceu,
        conferindo: naTela.current,
        desdeUltimaMs: Date.now() - ultimaTentativa.current,
      });
      if (pode) void buscar();
    },
    [buscar],
  );

  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") tentar("voltou"); };
    const aoCarregar = () => tentar("carregou");
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoCarregar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoCarregar);
    };
  }, [tentar]);

  const { estado: estadoAtual, erro: erroAtual, calculadoEm: calculadoEmAtual } = leitura;
  const fechado = fechadoAgora(abertura, agora);
  const situacao = {
    conferindo,
    erro: erroAtual,
    venceu,
    falhou,
    fechado,
    fechadoPeloDono: fechadoPeloDono(leitura.aviso),
  };
  const fase = faseDe(situacao);
  const sintoma = sintomaDe(situacao);

  // 🔴 A FASE SOBE PRA MOLDURA, e é o que faz o PIN DO MAPA obedecer ao mesmo
  // veredito que o carimbo (2026-09-10). Antes dela, a cor do pin saía só de
  // `data-state`, que fala de chuva — e as fases que NÃO falam de chuva
  // (`fechado`, `sem-informacoes`) não o alcançavam. Resultado: todo dia depois
  // das 17h, carimbo vermelho "Fechado agora" e pin VERDE, sem chuva nenhuma.
  //
  // Efeito, e não uma chamada durante o render: publicar estado de um
  // componente enquanto outro renderiza é justamente o que o React proíbe. A
  // dependência é a `fase` — o efeito só dispara quando ela muda de verdade, e
  // no primeiro render ela já bate com a que o servidor pintou, então a
  // hidratação não briga.
  useEffect(() => {
    avisarMoldura({ fase });
  }, [fase, avisarMoldura]);

  // A palavra e a linha de baixo vêm de `marcaDe`/`subDe`, não daqui: são as
  // MESMAS do selo do cartão, e escritas à mão nos dois elas já podiam
  // divergir. Ver `carimbo-fase.ts`.
  const marca = marcaDe(fase, estadoAtual, voz);
  const sub = subDe(fase, estadoAtual, voz, fechado ? rotuloAbertura(abertura!, agora!) : null);

  // 🔴 Fechado, o pulso PARA e a linha viva não fala de chuva. Ela existe pra
  // dizer "esta leitura é de agora" — e com o lugar fechado a leitura de chuva
  // não é o que decide nada. Deixá-la pulsando seria o defeito do pulso ao lado
  // de "SEM INFORMAÇÕES" de volta, com outra roupa.
  //
  // 🔴 A FRASE MUDOU EM 2026-09-11, e o motivo é o eixo do DIA. Ela dizia "fora
  // do horário de agora" — escrita quando a única coisa que fechava um lugar
  // era a HORA. Com a Rampa fechando por ser quarta-feira, "horário" passou a
  // nomear o eixo errado: ela não está fora de hora nenhuma, está fora do dia.
  //
  // E a frase nova faz um trabalho que a antiga não fazia: quem vê vermelho
  // supõe CHUVA. Dizer que a chuva não decide isto separa "choveu" de "o lugar
  // está fechado" — duas coisas que levam a decisões diferentes amanhã.
  const linhaViva =
    fase === "fechado" ? "a chuva não decide agora"
    : fase === "conferindo" ? "conferindo a chuva agora"
    : fase === "sem-informacoes" ? "toque pra conferir"
    : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`;

  const miolo = (
    <>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">
        {/* 🔴 `fechado ? abertura : undefined`, E ISSO É A CORREÇÃO INTEIRA. O
            `motivo` não pode decidir pela truthiness de `abertura`: ela vem de
            `aberturaDaFicha`, que devolve SEMPRE um objeto. Quem sabe se foi o
            CALENDÁRIO que fechou é esta linha, que tem o `fechado` na mão. */}
        {motivo(
          fase,
          sintoma,
          estadoAtual,
          calculadoEmAtual,
          pass,
          fut,
          secaRapido,
          piso,
          fechado ? abertura : undefined,
        )}
      </p>
      <div className="live">
        <span className="pulse"></span>
        <span>{linhaViva}</span>
      </div>
    </>
  );

  // Um atributo só pra fase. Dois codificando o mesmo fato foi o que deixou o
  // pulso piscando ao lado de "sem leitura" até hoje de manhã.
  //
  // role="status"/aria-live só fazem sentido na <div>: é uma região que se
  // atualiza sozinha, sem que ninguém precise interagir com ela. No <button>
  // eles sobrescreveriam o papel implícito de botão — um leitor de tela
  // anunciaria "região de status" em vez de "botão", justamente no elemento
  // que a pessoa precisa tocar. Por isso os dois ramos abaixo têm atributos
  // parecidos, mas não idênticos.
  const comum = { className: "decision", "data-fase": fase } as const;

  // Só vira botão quando tocar serve pra alguma coisa.
  const decisao = fase === "sem-informacoes" ? (
    <button type="button" {...comum} onClick={() => tentar("toque")}>{miolo}</button>
  ) : (
    <div {...comum} role="status" aria-live="polite">{miolo}</div>
  );

  // 🔴 IRMÃO da decisão, e não filho dela: `AvisoDoDono` lê `leitura.aviso` —
  // a mesma leitura VIVA que troca a cada busca ao /api/carimbo — nunca a
  // prop `aviso` do servidor. O dono retira o aviso, o próximo `/api/carimbo`
  // troca `leitura` inteira, e o texto retirado tem que sumir junto com o
  // selo; se este bloco lesse a prop do servidor, ele ficaria plantado com um
  // aviso morto enquanto o carimbo já mudou de ideia — a família
  // "cabeçalho × cartão" que este projeto já pagou três vezes.
  //
  // `agora`: `calculadoEmAtual` (o instante da própria leitura), não
  // `Date.now()`. `Date.now()` durante o render de um client component briga
  // com a hidratação (o servidor e o navegador calculariam datas diferentes);
  // `calculadoEmAtual` é o mesmo dos dois lados e fica no máximo ~30min atrás
  // do relógio de parede, o que não muda um "há N dias".
  return (
    <>
      {decisao}
      <AvisoDoDono aviso={leitura.aviso} agora={calculadoEmAtual} />
    </>
  );
}

/** O corpo da rota tem a forma de `LeituraCarimbo`, ou não é leitura nenhuma.
 *
 *  Mora aqui, e não em `carimbo-estado.ts` junto do tipo, porque aquele módulo
 *  puxa o motor e o fetch da chuva — importá-lo em runtime daqui arrastaria o
 *  servidor inteiro pro pacote do cliente. O tipo, sendo só tipo, some na
 *  compilação e pode continuar vindo de lá. */
function ehLeitura(x: unknown): x is LeituraCarimbo {
  if (typeof x !== "object" || x === null) return false;
  const { estado, erro, calculadoEm, aviso } = x as Record<string, unknown>;
  return (
    (estado === "fresco" || estado === "frio") &&
    typeof erro === "boolean" &&
    typeof calculadoEm === "number" &&
    Number.isFinite(calculadoEm) &&
    // 🔴 A CHAVE `aviso` É EXIGIDA, e é por isso que ela é `Aviso | null` em vez
    // de opcional. `undefined` reprova nas duas metades desta linha: corpo sem
    // a chave é corpo de uma versão VELHA do servidor, e aceitá-lo como "sem
    // aviso" apagaria da tela um aviso que talvez exista — o app afirmando
    // aberto por cima da palavra do dono. Reprovado, a tela mantém a leitura
    // anterior, que ao menos se reconhece vencida.
    (aviso === null || typeof aviso === "object")
  );
}

/** A frase que explica a marca. A hora só aparece quando existiu leitura: sem
 *  leitura nenhuma, não há hora pra citar.
 *
 *  🔴 NENHUMA DAS DUAS PONTAS NASCE AQUI, e as duas saíram daqui por defeito.
 *  A do ramo "fresco" vem da FICHA (`secaRapido`, 2026-08-26): fala do relevo
 *  de UM lugar, e este componente serve o acervo inteiro. A do ramo "frio" vem
 *  do PISO (`chuvaNoPiso`, 2026-08-27): fala do MATERIAL, que é o mesmo em
 *  qualquer lugar — mas "O barro segura água" também estava fixo aqui, e era
 *  verdade só porque todo o acervo era de barro.
 *
 *  Sem o dado, os dois ramos terminam no ponto final: o app cala em vez de
 *  inventar serra onde é planície, ou barro onde é asfalto. Ver os comentários
 *  em `src/types/ficha.ts` (`secaRapido`) e `src/lib/piso.ts` (`CHUVA_NO_PISO`).
 *
 *  🔴 E os três ramos de falha NÃO MANDAM NINGUÉM AO PORTÃO. Diziam "cheque o
 *  barro no portão" — duas suposições numa frase só: que o piso é barro, e que
 *  a pessoa para no portão pra decidir. O dono do app olha DIRIGINDO. */
function motivo(
  fase: Fase,
  sintoma: Sintoma,
  estado: Estado,
  calculadoEm: number,
  pass: number,
  fut: number,
  secaRapido?: string,
  piso?: Piso,
  /** A faixa do calendário SÓ quando foi ELE que fechou o lugar agora —
   *  `undefined` em qualquer outro caso. Não é a `abertura` da ficha, e o nome
   *  é diferente de propósito: ver o bloco 🔴 do ramo `fechado` logo abaixo. */
  aberturaQueFechou?: Abertura,
) {
  // Primeiro de todos, pela mesma razão que `fechado` ganha em `faseDe`: com o
  // lugar fechado, contar da chuva é responder a pergunta errada. E a frase diz
  // as HORAS e mais nada — o nome da coisa que fecha não mora no código.
  //
  // 🔴 E QUEM FECHOU DECIDE SE HÁ FRASE (2026-09-15). Este ramo testava
  // `fase === "fechado" && abertura`, e era seguro enquanto `fechado` só podia
  // vir do calendário. Com o DONO podendo fechar ("a rampa está em reforma"),
  // deixou de ser: `abertura` é sempre truthy (vem de `aberturaDaFicha`), então
  // a tela carimbava "Fechado agora" e explicava com uma faixa de horário que
  // naquele instante dizia o CONTRÁRIO — causa falsa, a linha vermelha deste
  // projeto, no eixo do calendário em vez do da chuva.
  //
  // Fechou o dono, o motivo SE CALA, e isso é subtração e não esquecimento:
  // inventar frase aqui seria copy nova indo pra tela sem ele ter lido. O texto
  // verdadeiro é o que o DONO escreveu, e quem o desenha é o `AvisoDoDono`.
  // Incompleto é o lado certo pra errar; falso nunca é.
  if (fase === "fechado") {
    return aberturaQueFechou ? <>{rotuloFaixa(aberturaQueFechou)}</> : null;
  }
  if (fase === "conferindo") {
    return sintoma === "venceu" ? (
      <>
        A leitura das <b>{horaCurtaRecife(calculadoEm)}</b> passou do prazo. Buscando a de agora.
      </>
    ) : (
      <>Buscando a leitura de agora.</>
    );
  }
  if (sintoma === "falhou") {
    return <>Não deu tempo de ler a chuva. Na dúvida, cheque o chão no caminho.</>;
  }
  if (sintoma === "erro") {
    return <>Não deu pra ler a chuva agora. Na dúvida, cheque o chão no caminho.</>;
  }
  if (sintoma === "venceu") {
    return (
      <>
        Essa leitura é das <b>{horaCurtaRecife(calculadoEm)}</b> e já passou do prazo. O chão muda
        rápido — cheque no caminho antes de decidir.
      </>
    );
  }
  const chuva = chuvaNoPiso(piso);
  return estado === "fresco" ? (
    <>
      Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>.
      {secaRapido ? ` ${secaRapido}` : ""}
    </>
  ) : (
    <>
      Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>).
      {chuva ? ` ${chuva}` : ""}
    </>
  );
}
