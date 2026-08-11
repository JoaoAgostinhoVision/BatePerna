"use client";
import { useEffect, useState } from "react";
import type { Estado } from "@/lib/motor";
import { type Fase, type Sintoma, faseDe, sintomaDe } from "@/lib/carimbo-fase";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Quando não há leitura, ele não manda: informa que não sabe e devolve a
 *  decisão. "Não suba" ficou reservado pro barro que o motor MEDIU. */
export default function Carimbo({
  estado,
  erro,
  calculadoEm,
  pass,
  fut,
}: {
  estado: Estado;
  erro: boolean;
  calculadoEm: number;
  pass: number;
  fut: number;
  slug: string;
}) {
  // Começa sempre válido pra o HTML do servidor e o do cliente baterem na
  // hidratação. Se já nasceu velho, o efeito corrige no mesmo instante.
  const [venceu, setVenceu] = useState(false);

  useEffect(() => {
    const checar = () => setVenceu(carimboVenceu(calculadoEm, Math.floor(Date.now() / 1000)));
    checar();

    // O intervalo é pra tela aberta na mão. Ele não basta: navegador estrangula
    // timer de aba escondida, e o celular passou as últimas quatro horas no
    // bolso. O instante que importa é quando a tela volta a ser olhada — que é
    // o instante do portão. `pageshow` vai junto porque restauração de bfcache
    // não dispara visibilitychange em todo navegador, e o service worker
    // tornou "página retomada do cache" o caso normal.
    const id = setInterval(checar, 60_000);
    document.addEventListener("visibilitychange", checar);
    window.addEventListener("pageshow", checar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", checar);
      window.removeEventListener("pageshow", checar);
    };
  }, [calculadoEm]);

  // `conferindo` e `falhou` entram como literais: nesta task ainda não existe
  // busca pra ligá-los. A Task 5 os troca por estado de verdade.
  const situacao = { conferindo: false, falhou: false, erro, venceu };
  const fase = faseDe(situacao);
  const sintoma = sintomaDe(situacao);

  const marca =
    fase === "conferindo" ? "CONFERINDO…"
    : fase === "sem-informacoes" ? "SEM INFORMAÇÕES"
    : estado === "frio" ? "Não suba"
    : "Pode subir";

  const sub =
    fase === "conferindo" ? "lendo a chuva agora"
    : fase === "sem-informacoes" ? "tome cuidado"
    : estado === "fresco" ? "seco · carro comum"
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
      <p className="reason">{motivo(fase, sintoma, estado, calculadoEm, pass, fut)}</p>
      <div className="live">
        <span className="pulse"></span>
        <span>{linhaViva}</span>
      </div>
    </>
  );

  // Um atributo só. Dois codificando o mesmo fato foi o que deixou o pulso
  // piscando ao lado de "sem leitura" até hoje de manhã.
  const atributos = {
    className: "decision",
    role: "status" as const,
    "aria-live": "polite" as const,
    "data-fase": fase,
  };

  // Só vira botão quando tocar serve pra alguma coisa. A Task 5 liga o onClick.
  return fase === "sem-informacoes" ? (
    <button type="button" {...atributos}>{miolo}</button>
  ) : (
    <div {...atributos}>{miolo}</div>
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
