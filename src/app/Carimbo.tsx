"use client";
import { useEffect, useState } from "react";
import type { Estado } from "@/lib/motor";
import { carimboVenceu, horaCurtaRecife } from "@/lib/validade";

/** O carimbo é a única coisa da ficha que apodrece. Tudo o mais — trajeto,
 *  coordenada, aviso, o que ler no portão — é verdade parada.
 *
 *  Sem prazo, uma aba aberta às 7h ainda diz "Pode subir" às 11h; e com o
 *  service worker guardando a página, o offline mostraria clima de três horas
 *  atrás com cara de agora. Vencido, cai no mesmo texto honesto que já existe
 *  pro caso de não conseguir ler a chuva. */
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
}) {
  // Começa sempre válido pra o HTML do servidor e o do cliente baterem na
  // hidratação. Se já nasceu velho, o efeito corrige no mesmo instante.
  const [venceu, setVenceu] = useState(false);

  useEffect(() => {
    const checar = () => setVenceu(carimboVenceu(calculadoEm, Math.floor(Date.now() / 1000)));
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, [calculadoEm]);

  const semLeitura = erro || venceu;
  const marca = semLeitura || estado === "frio" ? "Não suba" : "Pode subir";
  const sub = semLeitura
    ? "sem leitura · cheque no portão"
    : estado === "fresco"
      ? "seco · carro comum"
      : "barro · dá um tempo";

  return (
    <div className="decision" role="status" aria-live="polite" data-venceu={venceu ? "1" : undefined}>
      <div className="stamp">
        <div className="mark">{marca}</div>
        <div className="sub">{sub}</div>
      </div>
      <p className="reason">
        {erro ? (
          <>
            Não deu pra ler a chuva agora. Na dúvida, <b>não suba</b> — cheque o barro no portão.
          </>
        ) : venceu ? (
          <>
            Essa leitura é das <b>{horaCurtaRecife(calculadoEm)}</b> e já passou do prazo. O barro
            muda rápido — na dúvida, <b>não suba</b> sem olhar no portão.
          </>
        ) : estado === "fresco" ? (
          <>
            Sem chuva nas últimas <b>~{pass}h</b> e nada previsto pras próximas <b>~{fut}h</b>. Área
            alta, escorre rápido — a serra firmou.
          </>
        ) : (
          <>
            Choveu nas últimas <b>~{pass}h</b> (ou vem chuva nas próximas <b>~{fut}h</b>). O barro
            segura água — risco de atolar.
          </>
        )}
      </p>
      <div className="live">
        <span className="pulse"></span>
        <span>
          {/* erro ganha de venceu: sem leitura nenhuma, não tem hora de leitura pra citar. */}
          {!erro && venceu
            ? `leitura das ${horaCurtaRecife(calculadoEm)} · vencida`
            : `lido da chuva agora · ${pass}h atrás + ${fut}h à frente`}
        </span>
      </div>
    </div>
  );
}
