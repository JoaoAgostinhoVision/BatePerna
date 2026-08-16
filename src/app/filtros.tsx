"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CHAVE_FILTROS, SEM_FILTRO, lerFiltros, type Filtros } from "@/lib/filtros";

/** Os recortes da home, pra tela inteira.
 *
 *  Espelho do `local.tsx`, e pela mesma razão: a linha de resumo, o painel e a
 *  folha que aplica os filtros são elementos distantes no DOM. Uma pessoa, uma
 *  fonte — dois donos do mesmo recorte dariam duas respostas pra mesma
 *  pergunta.
 *
 *  Fora de um provedor devolve SEM_FILTRO, que é exatamente o que o servidor
 *  renderiza. */
const Ctx = createContext<Filtros | null>(null);
const Mexer = createContext<((f: Filtros) => void) | null>(null);

/** Fora de provedor mexer não faz nada — em vez de estourar no servidor. */
const INERTE = () => {};

export function useFiltros(): Filtros {
  return useContext(Ctx) ?? SEM_FILTRO;
}

export function useMexerFiltros(): (f: Filtros) => void {
  return useContext(Mexer) ?? INERTE;
}

export default function FiltrosVivos({ children }: { children: ReactNode }) {
  // `useState(SEM_FILTRO)`, não `useState(() => lerFiltros(...))`: o primeiro
  // render TEM que ser sem filtro nenhum, igual ao do servidor. A home chega do
  // cache do service worker com HTML velho, e ler o aparelho durante o render
  // quebraria a hidratação bem na lista que carrega a decisão. Mesma razão do
  // `local.tsx` nascer "não sei" e do useVenceu nascer false.
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);

  const mexer = useCallback((f: Filtros) => {
    setFiltros(f);
    try {
      localStorage.setItem(CHAVE_FILTROS, JSON.stringify(f));
    } catch {
      // Aba anônima ou armazenamento cheio: o recorte vale nesta sessão e
      // pronto. Perder a preferência é aceitável; derrubar a home por causa de
      // um filtro não é.
    }
  }, []);

  useEffect(() => {
    try {
      setFiltros(lerFiltros(localStorage.getItem(CHAVE_FILTROS)));
    } catch {
      // Sem armazenamento (aba anônima do Safari): segue sem filtro.
    }
  }, []);

  return (
    <Ctx.Provider value={filtros}>
      <Mexer.Provider value={mexer}>{children}</Mexer.Provider>
    </Ctx.Provider>
  );
}
