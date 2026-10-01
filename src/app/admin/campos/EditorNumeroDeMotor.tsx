"use client";
import { useEffect, useRef, useState } from "react";
import { TETO_PASSADO_HORAS, TETO_PREVISAO_HORAS } from "@/lib/weather";
import { usarGravacao } from "./gravar";
import {
  ALEM_DO_PROVEDOR,
  CAIXA_VAZIA,
  COM_ESTE_NUMERO,
  JANELA_NEGATIVA,
  PREVENDO,
  PREVISAO_FALHOU,
  REGRA_QUE_MENTE,
  SALVANDO,
  SALVAR,
} from "./palavras";
import type { PropsDoEditor } from "./tipos";

/** Quanto a prévia espera o dedo PARAR antes de perguntar ao servidor.
 *
 *  🔴 A PRÉVIA BUSCA CHUVA AO VIVO NO PROVEDOR EXTERNO (onda de conserto 1 da
 *  Tarefa 7, 2026-10-01), e o `onChange` do React dispara a CADA TECLA: sem esta
 *  espera, digitar `240` seriam três buscas, duas delas de números que ele nunca
 *  quis. Este projeto já perdeu uma rodada inteira (13/09) pra política de uso de
 *  um terceiro, que proibia pelo PADRÃO de uso. 500 ms é mais que o intervalo
 *  entre duas teclas de quem digita um número (então `240` vira UMA busca) e
 *  menos que a pausa de quem terminou e olha a tela. */
export const ESPERA_PREVIA_MS = 500;

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
 *  🔴 O NÚMERO QUE MENTE É RECUSADO AQUI, E AQUI NÃO É A GARANTIA. (Desde
 *  2026-10-01 "mentir" depende do campo: a janela de previsão aceita zero, e as
 *  duas janelas têm teto — ver `recusaDe`.) São três camadas, e cada uma faz uma
 *  coisa diferente:
 *   1. ESTA, que recusa antes de qualquer viagem (`REGRA_QUE_MENTE`,
 *      `JANELA_NEGATIVA`, `ALEM_DO_PROVEDOR`) e poupa uma ida ao servidor numa
 *      rede de interior — há teste cravando que a rota **não foi chamada**;
 *   2. a ROTA DE PRÉVIA, que recusa com 400 pra nenhum cliente (nem um bundle
 *      velho no celular dele) conseguir uma prévia que endosse uma regra que
 *      mente;
 *   3. a PORTA DE ESCRITA, que é a garantia: o portão de coerência de
 *      `PUT /api/admin/ficha` devolve **409** com a frase das regras
 *      `janela-nao-zerada` (*"O limite de chuva de X é 0 mm: qualquer orvalho
 *      fecha o lugar…"*) e `janela-dentro-do-provedor` (o teto). Medido: é por
 *      isso que o `regraSchema` NÃO ganhou `.min(1)` — ver o docblock dele em
 *      `src/types/ficha.ts`.
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
  | { estado: "falhou"; para: number };

/** A frase de recusa de um número, ou `null` se ele pode ir pra porta.
 *
 *  Espelho, campo a campo, das duas regras de coerência que a porta roda
 *  (`janela-nao-zerada` e `janela-dentro-do-provedor`, em `src/lib/coerencia.ts`)
 *  — a porta é a garantia; isto só poupa a viagem.
 *   - a janela de PREVISÃO aceita zero (decisão do João, 2026-10-01: "só olhar a
 *     chuva que já caiu") e recusa só o negativo;
 *   - as outras duas recusam zero e negativo;
 *   - as duas janelas recusam acima do teto do provedor (`src/lib/weather.ts`).
 *  Fracionário NÃO entra — é valor que um dono pode querer de verdade.
 *
 *  ⚠️ O nome da folha sai do `campo.caminho` que o registro mandou; o editor não
 *  importa o registro (a régua do bundle de `/admin/[slug]`). */
function recusaDe(folha: string, n: number): string | null {
  if (folha === "janela_previsao_horas") {
    if (n < 0) return JANELA_NEGATIVA;
    return n > TETO_PREVISAO_HORAS ? ALEM_DO_PROVEDOR : null;
  }
  if (!(n > 0)) return REGRA_QUE_MENTE;
  if (folha === "janela_passado_horas" && n > TETO_PASSADO_HORAS) return ALEM_DO_PROVEDOR;
  return null;
}

export default function EditorNumeroDeMotor({ campo, valor, slug }: PropsDoEditor) {
  const [texto, setTexto] = useState(typeof valor === "number" ? String(valor) : "");
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();
  const folha = campo.caminho.slice(campo.caminho.lastIndexOf(".") + 1);

  /** A pergunta que está esperando o dedo parar. Uma só de cada vez: cada tecla
   *  cancela a anterior, e desmontar cancela a pendente. */
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarEspera = (): void => {
    if (espera.current !== null) clearTimeout(espera.current);
    espera.current = null;
  };
  useEffect(() => cancelarEspera, []);

  /** O número que está na caixa, ou `null` se ela não tem número nenhum. */
  const numero = texto.trim() === "" || !Number.isFinite(Number(texto)) ? null : Number(texto);

  function mudou(bruto: string): void {
    setTexto(bruto);
    cancelarEspera();
    const n = bruto.trim() === "" || !Number.isFinite(Number(bruto)) ? null : Number(bruto);
    // Caixa vazia e número que a porta recusaria não pedem prévia: não há
    // consequência honesta a mostrar, e a rota recusa de qualquer forma. Número
    // igual ao gravado também não — a consequência dele já está no carimbo do
    // topo do painel.
    if (n === null || recusaDe(folha, n) !== null || n === valor) {
      setPrevisao(null);
      return;
    }
    setPrevisao({ estado: "pedindo", para: n });
    espera.current = setTimeout(() => {
      espera.current = null;
      void prever(n);
    }, ESPERA_PREVIA_MS);
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
      // 503 (a chuva não veio), 400 (recusa) ou qualquer outro: não conferiu.
      if (!r.ok) {
        pousar({ estado: "falhou", para: n });
        return;
      }
      const corpo = (await r.json()) as { marca?: string; sub?: string };
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
    const recusa = recusaDe(folha, numero);
    if (recusa !== null) {
      recusarAqui(recusa);
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
