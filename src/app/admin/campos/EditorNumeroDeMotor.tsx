"use client";
import { useState } from "react";
import { usarGravacao } from "./gravar";
import {
  CAIXA_VAZIA,
  COM_ESTE_NUMERO,
  PREVENDO,
  PREVISAO_FALHOU,
  REGRA_QUE_MENTE,
  SALVANDO,
  SALVAR,
  SEM_LEITURA,
} from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** O NÚMERO DE MOTOR, COM A CONSEQUÊNCIA AO VIVO — o instrumento da espécie
 *  `numero` (os três números que governam a regra de chuva).
 *
 *  🔴 POR QUE ESTE CAMPO NÃO É UMA CAIXA COMO AS OUTRAS. `limiar_mm`,
 *  `janela_passado_horas` e `janela_previsao_horas` não descrevem o lugar: eles
 *  DECIDEM o que a tela pública diz sobre ele. Um `6` virando `0` não erra uma
 *  frase — desliga o aviso de um lugar real, em silêncio, e ninguém olhando o
 *  painel veria diferença. Então a tela mostra a CONSEQUÊNCIA antes de ele
 *  gravar: o carimbo que o lugar teria AGORA com esse número, nas palavras que a
 *  ficha pública usaria.
 *
 *  🔴 AS PALAVRAS DA PRÉVIA NÃO SÃO DESTA TELA, e isso é o ponto dela. `marca` e
 *  `sub` vêm da rota, que as tira de `marcaDe`/`subDe` (`src/lib/carimbo-fase.ts`)
 *  sobre a voz da própria ficha (`src/lib/severidade.ts`) — as MESMAS funções que
 *  a ficha pública chama. Uma cópia da fala aqui seria duas fontes pra mesma
 *  pergunta, e a prévia passaria a prometer uma tela que não existe.
 *
 *  🔴 A PRÉVIA NÃO APARECE EM REPOUSO, E ISSO FOI DECIDIDO CONTRA O CERCO DE NOME
 *  DE LUGAR. A metade da TELA daquele cerco varre todo nó de texto dentro de
 *  `[data-editor]`; a fala do motor vem de `src/lib/severidade.ts`, que está FORA
 *  da árvore varrida. Hoje nenhuma daquelas frases nomeia lugar do acervo (medido:
 *  "Não vá", `Espera {h}h`, "Vá com cuidado", "Pode ir" e os quatro subtítulos),
 *  então não haveria vermelho por inocência — mas renderizar em repouso poria
 *  copy de fora da cerca DENTRO do corpus dela sem ninguém ter decidido isso. E há
 *  razão de produto, que é a que decide: em repouso o número é o que está gravado,
 *  e a consequência dele já está no carimbo no topo do mesmo painel. Prever o que
 *  não mudou seria dizer a mesma coisa duas vezes.
 *  (Se um dia uma frase de severidade nomear um lugar, o vermelho estaria CERTO —
 *  é dado de um lugar renderizado como se fosse frase fixa. Este arquivo não é o
 *  lugar de decidir isso.)
 *
 *  🔴 ZERO É RECUSADO AQUI, E AQUI NÃO É A GARANTIA. São três camadas, e cada uma
 *  faz uma coisa diferente:
 *   1. ESTA, que recusa antes de qualquer viagem (`REGRA_QUE_MENTE`) e poupa uma
 *      ida ao Turso numa rede de interior — há teste cravando que a rota **não foi
 *      chamada**;
 *   2. a ROTA DE PRÉVIA, que recusa com 400 pra nenhum cliente (nem um bundle
 *      velho no celular dele) conseguir uma prévia que endosse uma regra que
 *      mente;
 *   3. a PORTA DE ESCRITA, que é a garantia — e ela já existia antes desta tarefa:
 *      o portão de coerência de `PUT /api/admin/ficha` devolve **409** com a frase
 *      da regra `janela-nao-zerada` (*"O limite de chuva de X é 0 mm: qualquer
 *      orvalho fecha o lugar…"*). Medido: é por isso que o `regraSchema` NÃO
 *      ganhou `.min(1)` — ver o docblock dele em `src/types/ficha.ts`.
 *
 *  ⚠️ POR QUE NÃO HÁ CONFERÊNCIA DE FORMATO AQUI, e isto é a mesma medição do
 *  `EditorHora`. Medido em jsdom (2026-09-30), num `<input type="number">`:
 *  escrever `"abc"` deixa o `value` em `""`, e escrever `"1e999"` **também** deixa
 *  em `""` (o controle sanitiza pro algoritmo de "número de ponto flutuante
 *  válido" da especificação, e infinito não é). Então o que este editor recusa é o
 *  estado que o controle DE FATO produz — caixa sem número —, com a frase que os
 *  outros editores já usam pra caixa vazia. Uma regex de número aqui seria condição
 *  semanticamente morta, a 52ª espécie do catálogo deste projeto.
 *
 *  🔴 E O `Number.isFinite` DO `numero` NÃO É REDUNDÂNCIA COM AQUILO, porque a
 *  sanitização é do NAVEGADOR e navegadores divergem: `1e999` é sintaxe válida de
 *  número de ponto flutuante, e um que o aceite entregaria `Infinity`. O custo
 *  desse caso está medido e não é cosmético — `aplicarCampo` ACEITA `Infinity`,
 *  grava `"janela_previsao_horas":null` no documento (é o que `JSON.stringify` faz
 *  com infinito) e esse documento **não relê**: o lugar sai do ar e o dono não
 *  consegue consertar pelo painel, que precisa ler a ficha pra mostrá-la. Quem
 *  fecha isso de verdade é o `.finite()` do `regraSchema` (ver o docblock dele em
 *  `src/types/ficha.ts`); aqui é só a recusa que poupa a viagem.
 *
 *  Há asserção em `tests/app/admin-editor-numero.test.tsx` cravando que o
 *  instrumento é `type="number"`: se ele deixar de ser, o caso fica vermelho e
 *  esta decisão precisa de outra. Quem GARANTE que é número é a porta.
 *
 *  ⚠️ NÃO TEM `BotaoNaoSei`, e não é esquecimento: os três são `obrigatorio: true`
 *  no registro — uma ficha sem limiar não tem regra de chuva nenhuma, então não
 *  existe "não sei" aqui. O `campo.obrigatorio` chega por prop e o teste crava que
 *  nenhuma espécie `numero` do registro é opcional hoje.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui. O número vem da prop
 *  `valor`, o rótulo vem do registro por `campo.rotulo`, e a fala da prévia vem da
 *  rota. */

/** O que a prévia está dizendo agora. `para` é o número que ela responde, e ele
 *  existe por uma razão medida de rede, não por zelo: duas respostas podem chegar
 *  fora de ordem (ele digita `1`, depois `12`, e a resposta de `1` volta por
 *  último). Sem comparar, a tela mostraria a consequência de um número que não
 *  está mais na caixa — a prévia mentindo sobre o que ela mesma prevê. */
type Previsao =
  | { estado: "pedindo"; para: number }
  | { estado: "fala"; para: number; marca: string; sub: string }
  | { estado: "semLeitura"; para: number }
  | { estado: "falhou"; para: number };

export default function EditorNumeroDeMotor({ campo, valor, slug }: PropsDoEditor) {
  const [texto, setTexto] = useState(typeof valor === "number" ? String(valor) : "");
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();

  /** O número que está na caixa, ou `null` se ela não tem número nenhum. */
  const numero = texto.trim() === "" || !Number.isFinite(Number(texto)) ? null : Number(texto);

  /** Mesmo exame da rota e da regra `janela-nao-zerada`: zero, negativo e não
   *  finito mentem sobre o lugar. Fracionário NÃO entra — é valor que um dono
   *  pode querer de verdade, e travá-lo seria travar a gravação de uma verdade. */
  const mente = numero !== null && !(numero > 0);

  function mudou(bruto: string): void {
    setTexto(bruto);
    const n = bruto.trim() === "" || !Number.isFinite(Number(bruto)) ? null : Number(bruto);
    // Caixa vazia e número que mente não pedem prévia: não há consequência
    // honesta a mostrar, e a de um número que mente a rota recusa de qualquer
    // forma. Número igual ao gravado também não — a consequência dele já está no
    // carimbo do topo do painel.
    if (n === null || !(n > 0) || n === valor) {
      setPrevisao(null);
      return;
    }
    setPrevisao({ estado: "pedindo", para: n });
    void prever(n);
  }

  async function prever(n: number): Promise<void> {
    const pousar = (p: Previsao): void =>
      // Só pinta se a caixa ainda está naquele número: resposta atrasada de um
      // número abandonado não vira tela.
      setPrevisao((atual) => (atual !== null && atual.para === n ? p : atual));
    try {
      const r = await fetch("/api/admin/previsao-carimbo", {
        method: "POST",
        body: JSON.stringify({ slug, campo: campo.caminho, valor: n }),
      });
      if (!r.ok) {
        pousar({ estado: "falhou", para: n });
        return;
      }
      const corpo = (await r.json()) as { semLeitura?: boolean; marca?: string; sub?: string };
      // `semLeitura` é a bandeira que a rota manda, nunca uma dedução a partir de
      // campo faltando: as duas formas da resposta têm que ser distinguíveis sem
      // adivinhação.
      if (corpo.semLeitura === true) {
        pousar({ estado: "semLeitura", para: n });
        return;
      }
      pousar({ estado: "fala", para: n, marca: String(corpo.marca), sub: String(corpo.sub) });
    } catch {
      pousar({ estado: "falhou", para: n });
    }
  }

  function salvar(): void {
    if (numero === null) {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    if (mente) {
      recusarAqui(REGRA_QUE_MENTE);
      return;
    }
    void gravar({ slug, campo: campo.caminho, valor: numero });
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      <input
        type="number"
        className="adm-editor-numero"
        aria-label={campo.rotulo}
        data-numero={campo.caminho}
        value={texto}
        onChange={(e) => mudou(e.target.value)}
      />
      {/* 🔴 A REGIÃO DA PRÉVIA ESTÁ SEMPRE NO DOM, E VAZIA EM REPOUSO. Duas
          razões, as duas medidas: `aria-live` só anuncia mudança de uma região
          que já existia (um nó inserido do zero não é anunciado em leitor de
          tela nenhum), e o guarda "toda classe desta tela tem regra no
          `admin.css`" mede as DUAS direções — uma classe que só aparecesse
          depois de uma resposta de rede deixaria a regra dela MORTA com a suíte
          verde. Vazia, ela não põe texto nenhum no corpus do cerco. */}
      <p className="adm-editor-previsao" data-previsao={campo.caminho} aria-live="polite">
        {previsao?.estado === "pedindo" && PREVENDO}
        {previsao?.estado === "semLeitura" && SEM_LEITURA}
        {previsao?.estado === "falhou" && PREVISAO_FALHOU}
        {previsao?.estado === "fala" && `${COM_ESTE_NUMERO} ${previsao.marca} · ${previsao.sub}`}
      </p>
      <button
        type="button"
        className="adm-editor-salvar"
        data-salvar={campo.caminho}
        disabled={salvando}
        onClick={salvar}
      >
        {salvando ? SALVANDO : SALVAR}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
