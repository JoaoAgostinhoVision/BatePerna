"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { diaRecife, guardar, pendentes, relatosDaPagina, remover, type Relato } from "@/lib/fila-relato";

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

/** Só um placar de verdade vira placar (I1 da auditoria da 12b): o GET de um
 *  lugar que não está no ar devolve `null`, e qualquer corpo que não tenha os
 *  dois números pintaria "Hoje: undefined foram". */
function ehPlacar(x: unknown): x is Placar {
  if (typeof x !== "object" || x === null) return false;
  const { foram, barro } = x as Record<string, unknown>;
  return typeof foram === "number" && Number.isFinite(foram) && typeof barro === "number" && Number.isFinite(barro);
}

/** O corpo do POST: a identidade vai quando há; sem ela é o relato LEGADO. */
function corpo(slug: string, tipo: Relato["tipo"], lugar: number | undefined): string {
  return JSON.stringify(lugar === undefined ? { slug, tipo } : { slug, tipo, lugar });
}

/** `lugar`: a IDENTIDADE do lugar que esta página mostra (Tarefa 12b, 12-N6) —
 *  o menor `id` das versões dele, lido pela página (`identidadeDoEndereco`).
 *  O endereço NÃO é identidade: P sai de `A`, Q passa a morar em `A`, e um
 *  relato que só dissesse `A` contaria pra Q o que quem foi a P viu. Com a
 *  identidade:
 *   - o relato guardado leva `lugar`, e só a página DESTE lugar o sobe — em
 *     qualquer endereço; o servidor grava onde o lugar mora na hora;
 *   - o "já contei hoje" é por lugar (`bp:contou:L<lugar>:<dia>`): a página de
 *     Q não acende por um relato de P. A leitura das chaves velhas, por
 *     endereço, SAIU — era exatamente a porta que mostrava Q como contado. O
 *     custo: quem contou hoje antes do deploy pode contar de novo no dia dele;
 *   - o placar é pedido por lugar.
 *
 *  `lugar` nulo (a leitura falhou, ou um teste que não o passa) é o ramo
 *  LEGADO: tudo como antes desta tarefa, pelo endereço — aceito como hoje,
 *  decisão do João em 06/10 (ver o relato legado em `fila-relato.ts`).
 *
 *  `antigos`: os endereços de ANTES deste lugar (Tarefa 11e, I1 da auditoria).
 *  Desde a 12b servem SÓ o relato LEGADO, sem identidade, guardado num
 *  endereço velho: ele sobe com o endereço com que foi contado, e o servidor o
 *  resolve.
 *
 *  🔴 A RESPOSTA QUE TIRA DA FILA É O 400, e só ele (I6 da auditoria da 12b):
 *  é a recusa definitiva da própria rota (lugar que não está mais no ar, corpo
 *  torto). 408, 429, 401/403 de proteção, 404 de um deploy no meio, 5xx e
 *  falha de rede FICAM — são de passagem, e perder o relato por eles é o
 *  defeito que a fila existe pra impedir. Recusado, o relato sai e a fila
 *  SEGUE pro próximo. Custo aceito (M4): um lugar escondido e mostrado de novo
 *  no mesmo dia perde o relato recusado enquanto estava escondido. E dois
 *  gatilhos de `escoar` ao mesmo tempo (montagem, `pageshow`) podem mandar o
 *  mesmo relato duas vezes (M3, de antes desta tarefa).
 *
 *  🔴 E UM 2xx SÓ VALE COM PLACAR NO CORPO (I1 da revisão da 12b). O portal
 *  cativo do Wi-Fi da pousada responde 200 com uma página HTML: o servidor
 *  NUNCA viu o relato. Corpo que não é JSON, ou JSON que não é placar, é "não
 *  sei se gravou" — segue a regra da passagem: no `escoar` fica na fila; no
 *  envio online é guardado e a tela é a de erro. O risco do outro lado (o
 *  servidor gravou e só a resposta se perdeu, e o relato sobe de novo) é o
 *  mesmo de um 503 depois do INSERT, e é menor que perder o relato e mentir
 *  "anotado" na tela. */
export default function ConfirmarFui({
  slug,
  lugar = null,
  antigos = [],
}: {
  slug: string;
  lugar?: number | null;
  antigos?: readonly string[];
}) {
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [fase, setFase] = useState<Fase>("idle");
  const jaContouKey =
    lugar === null ? `bp:contou:${slug}:${diaRecife(Date.now())}` : `bp:contou:L${lugar}:${diaRecife(Date.now())}`;
  // Texto, e não a lista: a dependência dos efeitos abaixo tem de ser estável
  // (e `|` nunca aparece num endereço, que é só letra, número e hífen)
  // entre renders, e uma lista nova a cada render os re-dispararia.
  const meusSlugs = [slug, ...antigos].join("|");
  // Ref, e não estado: os ouvintes lá embaixo são registrados uma vez e leriam
  // um valor congelado. Mesmo motivo do `vivo` no `Carimbo.tsx`.
  const vivo = useRef(true);

  /** Sobe o que estiver guardado DESTE lugar. Falha de passagem: fica na fila,
   *  e a próxima volta tenta de novo. Recusa (400): sai, e a fila segue. */
  const escoar = useCallback(async () => {
    const [eu, ...velhos] = meusSlugs.split("|");
    const meus = relatosDaPagina(pendentes(Date.now()), { slug: eu, antigos: velhos, lugar });
    for (const r of meus) {
      let res: Response;
      try {
        res = await fetch("/api/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpo(r.slug, r.tipo, r.lugar),
        });
      } catch {
        return; // sem sinal ainda: o resto da fila espera junto
      }
      if (res.status === 400) {
        // A rota recusou DE VEZ: mandar de novo daria o mesmo 400, e ele
        // seguraria a fila inteira até a virada do dia.
        remover(r);
        continue;
      }
      if (!res.ok) return; // de passagem: fica, e o resto espera junto
      let novo: unknown = null;
      try {
        novo = await res.json();
      } catch {
        novo = null; // 2xx que não é JSON (portal cativo)
      }
      // 2xx sem placar no corpo: "não sei se gravou" — fica, como a passagem.
      if (!ehPlacar(novo)) return;
      // Só sai da fila depois que o servidor aceitou. Remover antes seria
      // perder o relato num 500 — o defeito que esta fila existe pra impedir,
      // de volta com outra roupa.
      remover(r);
      if (!vivo.current) return;
      setPlacar(novo);
      localStorage.setItem(jaContouKey, "1");
      setFase("contado");
    }
  }, [meusSlugs, jaContouKey, lugar]);

  useEffect(() => {
    vivo.current = true;
    const dia = diaRecife(Date.now());
    const contou =
      typeof window !== "undefined" &&
      (lugar === null
        ? meusSlugs.split("|").some((s) => localStorage.getItem(`bp:contou:${s}:${dia}`))
        : localStorage.getItem(`bp:contou:L${lugar}:${dia}`) !== null);
    if (contou) setFase("contado");
    const busca = lugar === null ? `slug=${encodeURIComponent(slug)}` : `slug=${encodeURIComponent(slug)}&lugar=${lugar}`;
    fetch(`/api/confirmar?${busca}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: unknown) => { if (ehPlacar(p) && vivo.current) setPlacar(p); })
      .catch(() => {});
    void escoar();
    return () => { vivo.current = false; };
  }, [slug, lugar, meusSlugs, escoar]);

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
    const dia = diaRecife(Date.now());
    const relato: Relato = lugar === null ? { slug, tipo, dia } : { slug, tipo, dia, lugar };
    let r: Response | null;
    try {
      r = await fetch("/api/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpo(slug, tipo, relato.lugar),
      });
    } catch {
      r = null; // sem sinal
    }
    if (r !== null && r.status === 400) {
      // Recusa definitiva: guardar seria mandar de novo o que nunca passa. A
      // tela de erro que já existe continua verdadeira ("não deu pra
      // registrar") — nenhuma frase nova.
      setFase("erro");
      return;
    }
    let novo: unknown = null;
    if (r !== null && r.ok) {
      try {
        novo = await r.json();
      } catch {
        novo = null; // 2xx que não é JSON (portal cativo): não é aceite
      }
    }
    if (!ehPlacar(novo)) {
      // Sem rede, falha de passagem, ou 2xx sem placar no corpo.
      // 🔴 GUARDA ANTES DE MOSTRAR O ERRO. A ordem importa: se a tela de erro
      // fosse pintada primeiro e a gravação falhasse, a pessoa veria "tenta de
      // novo" com o relato perdido de verdade.
      guardar(relato);
      setFase("erro");
      return;
    }
    setPlacar(novo);
    localStorage.setItem(jaContouKey, "1");
    setFase("contado");
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
