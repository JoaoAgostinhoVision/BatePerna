"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  CHAVE_GPS,
  CHAVE_LOCAL,
  NAO_SEI,
  lerEstadoGps,
  lerLocal,
  type EstadoGps,
  type Local,
} from "@/lib/local";

/** Onde a pessoa está, pra tela inteira.
 *
 *  Irmão do `leituras.tsx`: existe pela mesma razão. O mapa, o km do cartão e
 *  o filtro de distância são elementos distantes um do outro no DOM — se cada
 *  um chamasse `navigator.geolocation` por conta própria, o app pediria GPS
 *  três vezes e poderia mostrar três respostas diferentes pra mesma pergunta.
 *  Uma pessoa, uma fonte.
 *
 *  Fora de um provedor devolve "não sei", que é exatamente o que o servidor
 *  renderiza. */
const Ctx = createContext<{ local: Local; gps: EstadoGps } | null>(null);
const Mexer = createContext<{ pedirGps: () => void; escolher: (l: Local) => void } | null>(null);

const INERTE = { pedirGps: () => {}, escolher: () => {} };

export function useLocal(): Local {
  return useContext(Ctx)?.local ?? NAO_SEI;
}

export function useGps(): EstadoGps {
  return useContext(Ctx)?.gps ?? "nunca";
}

export function useMexerLocal() {
  return useContext(Mexer) ?? INERTE;
}

/** Prazo e idade máxima iguais aos do `DistanciaDaqui`, que já roda em
 *  produção: 10s é o que se aguenta olhando pra tela, 5min de idade evita
 *  ligar o rádio de novo a cada abertura. */
const PRAZO_GPS_MS = 10_000;
const IDADE_GPS_MS = 300_000;

export default function LocalVivo({ children }: { children: ReactNode }) {
  // `useState(NAO_SEI)`, não `useState(() => lerLocal(...))`: o primeiro
  // render TEM que ser "não sei", igual ao do servidor. A home chega do cache
  // do service worker com HTML velho, e ler o aparelho durante o render
  // quebraria a hidratação bem no elemento que carrega a decisão. Mesma razão
  // do useVenceu devolver false no primeiro quadro.
  const [local, setLocal] = useState<Local>(NAO_SEI);
  const [gps, setGps] = useState<EstadoGps>("nunca");

  const escolher = useCallback((l: Local) => {
    setLocal(l);
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(l));
    } catch {
      // Aba anônima ou armazenamento cheio: a escolha vale nesta sessão e
      // pronto. Não é motivo pra tela de erro.
    }
  }, []);

  const buscarGps = useCallback(() => {
    const geo = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geo) return;
    geo.getCurrentPosition(
      (pos) =>
        escolher({
          tipo: "gps",
          coord: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          em: Math.floor(Date.now() / 1000),
        }),
      // Negado, sem sinal, estourou o prazo: pro app dá tudo no mesmo — não
      // insiste. A localização que já existia NÃO é apagada; trocá-la por
      // "não sei" tiraria da tela um km que estava certo.
      () => {
        setGps("negado");
        try {
          localStorage.setItem(CHAVE_GPS, "negado");
        } catch { /* mesmo caso acima */ }
      },
      { timeout: PRAZO_GPS_MS, maximumAge: IDADE_GPS_MS },
    );
  }, [escolher]);

  useEffect(() => {
    let guardado: Local = NAO_SEI;
    try {
      guardado = lerLocal(localStorage.getItem(CHAVE_LOCAL));
      setGps(lerEstadoGps(localStorage.getItem(CHAVE_GPS)));
    } catch { /* sem armazenamento: segue como "não sei" */ }
    if (guardado.tipo !== "nao-sei") setLocal(guardado);
    // Já usou GPS antes = já concedeu, e o navegador não pergunta de novo.
    // Buscar aqui é o que cumpre "um toque na vida": das próximas vezes a
    // posição chega sozinha e atualizada.
    if (guardado.tipo === "gps") buscarGps();
  }, [buscarGps]);

  return (
    <Ctx.Provider value={{ local, gps }}>
      <Mexer.Provider value={{ pedirGps: buscarGps, escolher }}>{children}</Mexer.Provider>
    </Ctx.Provider>
  );
}
