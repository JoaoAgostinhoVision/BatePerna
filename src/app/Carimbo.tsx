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
  podeBuscar,
  sintomaDe,
} from "@/lib/carimbo-fase";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe, devolve a
 *  decisão, e se oferece pra ir buscar de novo. "Não suba" ficou reservado pro
 *  barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  pass,
  fut,
  slug,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  pass: number;
  fut: number;
  slug: string;
}) {
  // A leitura do servidor é só o ponto de partida: daqui pra frente o
  // componente pode trocá-la por uma mais nova. O primeiro render usa
  // exatamente o que veio no HTML, pra a hidratação bater.
  const [leitura, setLeitura] = useState<LeituraCarimbo>({ estado, erro, calculadoEm });
  const [venceu, setVenceu] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [falhou, setFalhou] = useState(false);

  // Refs, e não estado: os ouvintes são registrados uma vez e leriam um estado
  // congelado no valor daquele render.
  const leituraRef = useRef(leitura);
  leituraRef.current = leitura;
  const naTela = useRef(false);          // há um "Conferindo…" na tela agora
  const ultimaTentativa = useRef(Number.NEGATIVE_INFINITY);
  const geracao = useRef(0);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

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
      const nova = (await res.json()) as LeituraCarimbo;
      if (geracao.current !== minha || !vivo.current) return;
      setLeitura(nova);
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
  }, [slug]);

  const tentar = useCallback(
    (gatilho: Gatilho) => {
      const jaVenceu = carimboVenceu(leituraRef.current.calculadoEm, Math.floor(Date.now() / 1000));
      // Primeiro a verdade sobre o que JÁ está na tela. Se venceu, o carimbo
      // tem que parar de afirmar agora mesmo — a busca a seguir pode nem sair
      // (piso, sem rede), e sem isto a tela continuaria afirmando leitura velha.
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

  const marca =
    fase === "conferindo" ? "CONFERINDO…"
    : fase === "sem-informacoes" ? "SEM INFORMAÇÕES"
    : estadoAtual === "frio" ? "Não suba"
    : "Pode subir";

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
      <p className="reason">{motivo(fase, sintoma, estadoAtual, calculadoEmAtual, pass, fut)}</p>
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

/** A frase que explica a marca. A hora só aparece quando existiu leitura: sem
 *  leitura nenhuma, não há hora pra citar. */
function motivo(
  fase: Fase,
  sintoma: Sintoma,
  estado: Estado,
  calculadoEm: number,
  pass: number,
  fut: number,
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
    return <>Não deu tempo de ler a chuva. Na dúvida, cheque o barro no portão.</>;
  }
  if (sintoma === "erro") {
    return <>Não deu pra ler a chuva agora. Na dúvida, cheque o barro no portão.</>;
  }
  if (sintoma === "venceu") {
    return (
      <>
        Essa leitura é das <b>{horaCurtaRecife(calculadoEm)}</b> e já passou do prazo. O barro muda
        rápido — cheque no portão antes de decidir.
      </>
    );
  }
  return estado === "fresco" ? (
    <>
      Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>. Área alta,
      escorre rápido — a serra firmou.
    </>
  ) : (
    <>
      Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>). O barro segura
      água — risco de atolar.
    </>
  );
}
