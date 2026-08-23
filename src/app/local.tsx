"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  CHAVE_GPS,
  CHAVE_LOCAL,
  CHAVE_SESSAO,
  MARCA_SESSAO,
  NAO_SEI,
  escolhaAindaVale,
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
      // 🔴 O marcador é SÓ da escolha à mão. Este callback é TAMBÉM o caminho
      // de sucesso do GPS: marcar aqui sem o guarda faria uma leitura
      // automática se disfarçar de escolha manual e mandar por 6h.
      if (l.tipo === "escolhido") sessionStorage.setItem(CHAVE_SESSAO, MARCA_SESSAO);
    } catch {
      // Aba anônima ou armazenamento cheio: a escolha vale nesta sessão e
      // pronto. Não é motivo pra tela de erro. Se o localStorage estourou, o
      // marcador nem é tentado — e isso é o certo: sem a escolha guardada, não
      // há o que a sessão prolongue.
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
      // Só PERMISSION_DENIED (code 1) grava "negado" pra sempre. Sem sinal
      // (2) ou estourou o prazo (3) não são recusa — são o aparelho não
      // tendo resposta agora. Gravar "negado" nesses dois rebaixaria o app
      // permanentemente por causa de um prédio sem sinal, e a busca automática
      // desta tela (pedido do João) torna esse risco real logo na primeira
      // abertura. A localização que já existia NÃO é apagada; trocá-la por
      // "não sei" tiraria da tela um km que estava certo.
      (err) => {
        if (err.code !== 1 /* PERMISSION_DENIED */) return;
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
    let marcador: string | null = null;
    try {
      guardado = lerLocal(localStorage.getItem(CHAVE_LOCAL));
      setGps(lerEstadoGps(localStorage.getItem(CHAVE_GPS)));
      marcador = sessionStorage.getItem(CHAVE_SESSAO);
    } catch { /* sem armazenamento: segue como "não sei" */ }
    if (guardado.tipo !== "nao-sei") setLocal(guardado);
    // A escolha à mão vence — mas só pela sessão. Decisão do João em
    // 2026-08-23, depois de ver no celular que a cidade não mudava nunca: vale
    // enquanto a aba viver E por no máximo 6h (`escolhaAindaVale`).
    //
    // 🔴 A troca PRESERVA os dois ramos que já estão no ar, e não por sorte:
    // pra `tipo: "gps"` e pra `nao-sei` a função é falsa pela PRIMEIRA
    // cláusula, então o GPS continua sendo pedido sozinho na abertura, como a
    // Task 1 da rodada passada entregou.
    //
    // E o que está na tela não pisca: o `setLocal(guardado)` acima já
    // aconteceu. Só o SUCESSO do GPS sobrescreve; erro e recusa deixam a
    // cidade onde está.
    if (!escolhaAindaVale(guardado, Math.floor(Date.now() / 1000), marcador)) buscarGps();
  }, [buscarGps]);

  return (
    <Ctx.Provider value={{ local, gps }}>
      <Mexer.Provider value={{ pedirGps: buscarGps, escolher }}>{children}</Mexer.Provider>
    </Ctx.Provider>
  );
}
