"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  CHAVE_GPS,
  CHAVE_LOCAL,
  CHAVE_SESSAO,
  MARCA_SESSAO,
  NAO_SEI,
  escolhaAindaVale,
  estadoGpsEfetivo,
  lerEstadoGps,
  lerLocal,
  type EstadoGps,
  type PermissaoGps,
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
        // 🔴 `code 2`/`code 3` deixavam de gravar QUALQUER coisa até
        // 2026-08-27, e o estado ficava `nunca`: o `soGps` do `BuscaLugar`
        // seguia `true` pra sempre, cada toque na pílula repedia o GPS, e o
        // painel de digitar cidade NUNCA abria. Agora eles marcam `falhou`, que
        // é de SESSÃO e não vai pro `localStorage` — persistir rebaixaria o app
        // pra sempre por causa de um prédio sem sinal.
        if (err.code !== 1 /* PERMISSION_DENIED */) {
          setGps((atual) => (atual === "negado" ? atual : "falhou"));
          return;
        }
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
    let lembranca: EstadoGps = "nunca";
    try {
      guardado = lerLocal(localStorage.getItem(CHAVE_LOCAL));
      lembranca = lerEstadoGps(localStorage.getItem(CHAVE_GPS));
      setGps(lembranca);
      marcador = sessionStorage.getItem(CHAVE_SESSAO);
    } catch { /* sem armazenamento: segue como "não sei" */ }

    // 🔴 PERGUNTA AO NAVEGADOR, e o que ele responder VENCE a lembrança.
    //
    // MEDIDO em produção, no celular do dono do app: a API respondia `granted`
    // e o `bp.gps` guardado dizia `negado` — o app escondia o caminho de volta
    // pro GPS (a coisa que ele pediu duas vezes) por causa de uma lembrança que
    // o navegador desmentia. `"negado"` era gravado uma vez, no callback de
    // erro `code 1`, e nada no código o desfazia: quem negasse uma vez ficava
    // marcado pra sempre, e liberar a permissão nas configurações não adiantava.
    //
    // A chave velha é APAGADA, não só ignorada — senão ela volta a mandar no
    // dia em que a API não responder.
    //
    // Assíncrono e sem `await` antes do `buscarGps()` abaixo de propósito: a
    // resposta da permissão não pode atrasar o pedido de posição, que é o que
    // põe km na tela. Ela chega depois e corrige o rótulo.
    (async () => {
      const api = typeof navigator === "undefined" ? undefined : navigator.permissions;
      if (!api?.query) return;
      // O Safari só passou a responder isto pra geolocalização em versões
      // recentes — antes REJEITA. Sem fonte, a lembrança continua mandando, que
      // é o comportamento de antes desta correção.
      const permissao = await api
        .query({ name: "geolocation" as PermissionName })
        .then((p) => p.state as PermissaoGps)
        .catch(() => null);
      // 🔴 O ESTADO ATUAL, e não a `lembranca` lida na montagem. Esta resposta
      // é ASSÍNCRONA: o pedido de posição sai antes dela e pode falhar antes
      // dela chegar. Com a lembrança congelada, um `granted` que chegasse
      // depois de um `code 2` devolveria o estado pra `nunca` e trancaria o
      // beco de novo, milissegundos depois de ele abrir. A ordem das linhas de
      // `estadoGpsEfetivo` é quem decide quem vence.
      setGps((atual) => estadoGpsEfetivo(atual, permissao));
      // 🔴 A GRAVAÇÃO OLHA A PERMISSÃO, não o estado calculado, e as duas
      // coisas deixaram de ser a mesma quando `falhou` entrou. O que se
      // persiste é a resposta do NAVEGADOR: `denied` grava, qualquer outra
      // resposta APAGA a chave velha (é o conserto do §Z2 — lembrança que o
      // navegador desmente não pode voltar a mandar), e sem API não se mexe em
      // nada. Ler o estado calculado aqui exigiria uma atribuição dentro do
      // `setGps`, que o StrictMode roda duas vezes.
      try {
        if (permissao === "denied") localStorage.setItem(CHAVE_GPS, "negado");
        else if (permissao !== null) localStorage.removeItem(CHAVE_GPS);
      } catch { /* aba anônima: vale nesta sessão e pronto */ }
    })();
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
