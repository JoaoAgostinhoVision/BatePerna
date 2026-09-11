"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { diaRecife, guardar, pendentes, remover, type Relato } from "@/lib/fila-relato";

/** O "✓ Fui": ele volta do passeio e conta como estava. É a alça de confiança do
 *  app — o único dado que não vem de satélite.
 *
 *  🔴 A PERGUNTA SUPUNHA TRÊS COISAS DE UMA VEZ, e as três já tinham sido
 *  corrigidas no carimbo sem ninguém olhar aqui (2026-08-27): *"E no **portão**,
 *  como estava?"* (ele decide **dirigindo**), *"Deu pra **subir**"* (ladeira — a
 *  Pedra Furada é plana) e *"Tava **barro**"* (o material — e aqui é pior que no
 *  selo: quem reporta numa trilha de asfalto não teria botão que sirva). Decisão
 *  dele: **tirar os três de uma vez.**
 *
 *  ⚠️ O RÓTULO E O VALOR GRAVADO DIVERGEM DE PROPÓSITO. O botão diz "Tava ruim"
 *  e manda `tipo: "barro"` — o enum vive no banco (`src/lib/db.ts`, tabela
 *  `confirmacoes`) e já tem linhas gravadas; trocá-lo seria migração de dado, não
 *  troca de copy. **Se um dia migrar, é aqui e nos três arquivos da rota.**
 *
 *  🔴 E DESDE 2026-09-10 O RELATO NÃO SE PERDE SEM SINAL. O `catch` do envio
 *  virava uma tela de erro e o relato morria ali — justamente onde a pessoa
 *  está quando tem o que contar: no lugar, fora de cobertura. Agora ele vai pra
 *  `src/lib/fila-relato.ts` e sobe sozinho quando a tela volta.
 *
 *  ⚠️ **NENHUMA FRASE NOVA ENTROU NA TELA, e é de propósito.** A tela de erro
 *  continua dizendo o que dizia — e continua verdadeira no instante em que
 *  aparece: o relato de fato **não** foi registrado ainda. Quando a fila
 *  escoar, a tela vira "Valeu — anotado 🙏", que já existia. Uma frase do tipo
 *  *"guardei, mando depois"* seria redação minha na tela, e isso é palavra dele.
 *  Está anotado no `docs/RESUME.md` como pergunta, não como dívida escondida. */
type Placar = { foram: number; barro: number };
type Fase = "idle" | "perguntando" | "enviando" | "contado" | "erro";

export default function ConfirmarFui({ slug }: { slug: string }) {
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const jaContouKey = `bp:contou:${slug}:${diaRecife(Date.now())}`;
  // Ref, e não estado: os ouvintes lá embaixo são registrados uma vez e leriam
  // um valor congelado. Mesmo motivo do `vivo` no `Carimbo.tsx`.
  const vivo = useRef(true);

  /** Sobe o que estiver guardado desta trilha. Falhou, fica na fila — a próxima
   *  volta tenta de novo. */
  const escoar = useCallback(async () => {
    const meus = pendentes(Date.now()).filter((r) => r.slug === slug);
    for (const r of meus) {
      try {
        const res = await fetch("/api/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: r.slug, tipo: r.tipo }),
        });
        if (!res.ok) throw new Error();
        const novo: Placar = await res.json();
        // Só sai da fila depois que o servidor aceitou. Remover antes seria
        // perder o relato num 500 — o defeito que esta fila existe pra impedir,
        // de volta com outra roupa.
        remover(r);
        if (!vivo.current) return;
        setPlacar(novo);
        localStorage.setItem(jaContouKey, "1");
        setFase("contado");
      } catch {
        return; // sem sinal ainda: o resto da fila espera junto
      }
    }
  }, [slug, jaContouKey]);

  useEffect(() => {
    vivo.current = true;
    if (typeof window !== "undefined" && localStorage.getItem(jaContouKey)) {
      setFase("contado");
    }
    fetch(`/api/confirmar?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && vivo.current && setPlacar(p))
      .catch(() => {});
    void escoar();
    return () => { vivo.current = false; };
  }, [slug, jaContouKey, escoar]);

  // A volta do bolso e a volta do cache do navegador — os dois mesmos gatilhos
  // que o carimbo usa pra reler a chuva. É quando o sinal costuma ter voltado.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === "visible") void escoar(); };
    const aoCarregar = () => { void escoar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", aoCarregar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", aoCarregar);
    };
  }, [escoar]);

  async function enviar(tipo: "seco" | "barro") {
    setFase("enviando");
    const relato: Relato = { slug, tipo, dia: diaRecife(Date.now()) };
    try {
      const r = await fetch("/api/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tipo }),
      });
      if (!r.ok) throw new Error();
      setPlacar(await r.json());
      localStorage.setItem(jaContouKey, "1");
      setFase("contado");
    } catch {
      // 🔴 GUARDA ANTES DE MOSTRAR O ERRO. A ordem importa: se a tela de erro
      // fosse pintada primeiro e a gravação falhasse, a pessoa veria "tenta de
      // novo" com o relato perdido de verdade.
      guardar(relato);
      setFase("erro");
    }
  }

  return (
    <div className="confirmar">
      {fase === "idle" && (
        <button className="btn" onClick={() => setFase("perguntando")}>✓ Fui</button>
      )}
      {fase === "perguntando" && (
        <div className="perg">
          <div className="q">E como estava o chão?</div>
          <div className="opts">
            <button className="opt seco" onClick={() => enviar("seco")}>Deu pra ir</button>
            <button className="opt barro" onClick={() => enviar("barro")}>Tava ruim</button>
          </div>
        </div>
      )}
      {fase === "enviando" && <div className="soon">enviando…</div>}
      {fase === "contado" && <div className="obrigado">Valeu — anotado 🙏</div>}
      {fase === "erro" && (
        <div className="erro">
          não deu pra registrar agora, tenta de novo
          <button className="btn" onClick={() => setFase("perguntando")}>tentar de novo</button>
        </div>
      )}
      <PlacarLinha placar={placar} />
    </div>
  );
}

/** 🔴 SEM PLACAR, O APP CALA — e até 2026-09-10 ele AFIRMAVA.
 *
 *  A condição era `if (!placar || placar.foram === 0)`, e os dois casos caíam na
 *  mesma frase: *"Ninguém contou ainda hoje"*. Mas `placar === null` não é zero
 *  — é **não perguntei, ou perguntei e não veio resposta**. Com a rede fora do
 *  ar (que é o caso comum na estrada, e o mesmo instante em que a fila acima
 *  entra em ação), a tela dizia que sabia que ninguém tinha ido. **Não sabia.**
 *
 *  É a mesma régua do carimbo, que já não manda ninguém a lugar nenhum quando a
 *  leitura falha: *"Não deu pra ler a chuva agora"*, e não "Pode ir". O
 *  conserto é SUBTRAÇÃO — a frase some, nenhuma frase nova entra.
 *
 *  ✅ E o guarda `if (!placar && fase === "contado") return null` saiu junto: ele
 *  cobria só quem já tinha contado hoje, e agora está contido neste `return
 *  null`. Duas condições pro mesmo caso é a redundância que vira mentira quando
 *  alguém mexe numa só — por isso a prop `fase` também saiu daqui. */
function PlacarLinha({ placar }: { placar: Placar | null }) {
  if (!placar) return null;
  if (placar.foram === 0) {
    return <div className="placar vazio">Ninguém contou ainda hoje — seja o primeiro a dizer como tá.</div>;
  }
  // "achou o chão ruim", e não "achou ruim": em português "achei ruim" lê-se
  // como *não gostei*, que é outra coisa. É a lição da frase invertida da Pedra
  // Furada — ler o que a frase AFIRMA antes de escrevê-la.
  //
  // O verbo concorda, como o "foi/foram" ao lado: "2 achou" estava errado desde
  // sempre e só não aparecia porque ninguém tinha contado duas vezes no mesmo dia.
  const verbo = placar.barro === 1 ? "achou" : "acharam";
  const barroTxt = placar.barro > 0 ? ` · ${placar.barro} ${verbo} o chão ruim` : "";
  return <div className="placar">Hoje: {placar.foram} {placar.foram === 1 ? "foi" : "foram"}{barroTxt}</div>;
}
