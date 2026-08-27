"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Estado } from "@/lib/motor";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import {
  PRAZO_CONFERINDO_MS,
  type Fase,
  type Gatilho,
  type Sintoma,
  faseDe,
  marcaDe,
  podeBuscar,
  sintomaDe,
} from "@/lib/carimbo-fase";
import { chuvaNoPiso, type Piso } from "@/lib/piso";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";
import { useAvisarEstado } from "./Moldura";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe, devolve a
 *  decisão, e se oferece pra ir buscar de novo. "Não vá" ficou reservado pro
 *  barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  pass,
  fut,
  slug,
  secaRapido,
  piso,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
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
}) {
  // A leitura do servidor é só o ponto de partida: daqui pra frente o
  // componente pode trocá-la por uma mais nova. O primeiro render usa
  // exatamente o que veio no HTML, pra a hidratação bater.
  const [leitura, setLeitura] = useState<LeituraCarimbo>({ estado, erro, calculadoEm });
  const [venceu, setVenceu] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  // A cor mora no <main> (data-state), fora deste componente: ela pinta o selo
  // E o pin do mapa, que é irmão daqui. Sem avisar a Moldura, uma leitura nova
  // trocaria a palavra sem trocar a cor — "Não vá" dentro de um selo verde.
  const avisarEstado = useAvisarEstado();

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
      // pessoa lê no portão. Um 200 com corpo fora do trio daria `undefined`
      // nos três campos e carimboVenceu(undefined) é NaN >= 1800 → false: a
      // tela afirmaria "Pode ir" a partir de nada. Corpo inválido é falha.
      if (!ehLeitura(nova)) throw new Error("corpo fora do trio");
      if (geracao.current !== minha || !vivo.current) return;
      // Os quatro num lote só, de propósito. `venceu` é recalculado aqui em vez
      // de esperar o efeito [leitura.calculadoEm]: efeito passivo roda em tarefa
      // separada do commit, e no meio o navegador pinta um quadro em que a
      // leitura que ACABOU de chegar aparece como "já passou do prazo". O efeito
      // segue dono do relógio contínuo; este é só o instante da chegada.
      setLeitura(nova);
      setVenceu(carimboVenceu(nova.calculadoEm, Math.floor(Date.now() / 1000)));
      avisarEstado(nova.estado);
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
  }, [slug, avisarEstado]);

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
  const situacao = { conferindo, erro: erroAtual, venceu, falhou };
  const fase = faseDe(situacao);
  const sintoma = sintomaDe(situacao);

  // A palavra vem de `marcaDe`, não daqui: é a MESMA do selo do cartão, e
  // escrita à mão nos dois ela já podia divergir. Ver `carimbo-fase.ts`.
  const marca = marcaDe(fase, estadoAtual);

  const sub =
    fase === "conferindo" ? "lendo a chuva agora"
    : fase === "sem-informacoes" ? "tome cuidado"
    : estadoAtual === "fresco" ? "seco · carro comum"
    : "barro · dá um tempo";

  const linhaViva =
    fase === "conferindo" ? "conferindo a chuva agora"
    : fase === "sem-informacoes" ? "toque pra conferir"
    : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`;

  const miolo = (
    <>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">
        {motivo(fase, sintoma, estadoAtual, calculadoEmAtual, pass, fut, secaRapido, piso)}
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
  return fase === "sem-informacoes" ? (
    <button type="button" {...comum} onClick={() => tentar("toque")}>{miolo}</button>
  ) : (
    <div {...comum} role="status" aria-live="polite">{miolo}</div>
  );
}

/** O corpo da rota é o trio, ou não é leitura nenhuma.
 *
 *  Mora aqui, e não em `carimbo-estado.ts` junto do tipo, porque aquele módulo
 *  puxa o motor e o fetch da chuva — importá-lo em runtime daqui arrastaria o
 *  servidor inteiro pro pacote do cliente. O tipo, sendo só tipo, some na
 *  compilação e pode continuar vindo de lá. */
function ehLeitura(x: unknown): x is LeituraCarimbo {
  if (typeof x !== "object" || x === null) return false;
  const { estado, erro, calculadoEm } = x as Record<string, unknown>;
  return (
    (estado === "fresco" || estado === "frio") &&
    typeof erro === "boolean" &&
    typeof calculadoEm === "number" &&
    Number.isFinite(calculadoEm)
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
) {
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
