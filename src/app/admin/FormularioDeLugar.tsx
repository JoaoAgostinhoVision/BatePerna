"use client";
import { useState, type FormEvent, type MouseEvent } from "react";
import EditorBloco from "./campos/EditorBloco";
import EditorBooleano from "./campos/EditorBooleano";
import EditorCoordenada from "./campos/EditorCoordenada";
import EditorHora from "./campos/EditorHora";
import EditorLista from "./campos/EditorLista";
import EditorNumeroDeMotor from "./campos/EditorNumeroDeMotor";
import EditorProsa from "./campos/EditorProsa";
import { ERRO_GRAVAR, ERRO_REDE, PortaDoEditor, usarGravacao } from "./campos/gravar";
import { CAIXA_VAZIA, SALVANDO, SALVAR } from "./campos/palavras";
import type { Editor, EspecieNaTela, PerguntaNaTela, PropsDoEditor } from "./campos/tipos";

/** O FORMULÁRIO DE LUGAR NOVO (Tarefa 11) — o questionário na tela, gravando
 *  num RASCUNHO que não vai ao ar.
 *
 *  🔴 ESTE ARQUIVO É DE CLIENTE E NÃO CONHECE O REGISTRO (E1 da auditoria). As
 *  perguntas chegam PRONTAS por prop, montadas por `./novo/perguntas.ts` na
 *  página de servidor; nenhum import daqui alcança `@/lib/campos-da-ficha`, o
 *  `fichaSchema` ou o zod — e há teste seguindo os imports de valor deste
 *  arquivo pra provar (`tests/app/admin-formulario-de-lugar.test.tsx`).
 *
 *  🔴 OS INSTRUMENTOS SÃO OS DA FICHA NO AR, SEM CÓPIA. Caixa de prosa, lista,
 *  interruptor, hora, bloco, número de motor e o mapa do pin são os editores de
 *  `./campos/`, os mesmos que o dono já usa no painel do lugar. O que muda é PRA
 *  ONDE eles gravam: o provedor `PortaDoEditor` aponta pra
 *  `/api/admin/rascunho`, que aceita as mesmas formas de corpo. O "não sei" de
 *  um opcional respondido também é o de sempre (`BotaoNaoSei`, dentro de cada
 *  editor). O que NÃO deu pra reaproveitar, e por quê:
 *   - o MAPA não abre sem ponto: ele centra na coordenada do banco, e um lugar
 *     novo não tem nenhuma — começar num ponto qualquer seria uma coordenada
 *     que ninguém deu, salva com um toque. Então a coordenada vazia entra
 *     DIGITADA (`CoordenadaDigitada`, abaixo: é o que o questionário pergunta,
 *     "a latitude e a longitude"), e depois de gravada o mapa aparece,
 *     centrado nela, pra ajustar;
 *   - o "PULAR" de um opcional ainda sem resposta é novo: o `BotaoNaoSei` some
 *     num campo ausente (lá ele seria um ato vazio), e no questionário pular é
 *     um ato de verdade — o dono dizendo que não vai responder. Ele não grava
 *     nada (a ausência JÁ é o "não sei" no documento); diz que o app vai calar;
 *   - a prévia do carimbo do número de motor fica desligada (`previa: false`):
 *     não há lugar no ar pra calcular;
 *   - acrescentar/tirar etapa (`EditorWaypoints`) não vem: o lugar novo tem um
 *     ponto só, o `0`, que é o próprio lugar. Etapas entram depois de publicar,
 *     pelo painel do lugar.
 *
 *  ⚠️ TODAS AS PERGUNTAS NUMA TELA, numa lista numerada na ordem do
 *  questionário — e não "uma pergunta por vez" como a spec §7.3 descreve. É
 *  desvio, dito no relatório: com o rascunho gravado a cada resposta e a página
 *  recarregando do banco a cada gravação (o padrão dos editores), "uma por vez"
 *  pediria estado de navegação que sobrevivesse ao reload; e o teste que a
 *  auditoria exige ("uma pergunta por campo do registro") lê todas na página.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: as perguntas e os
 *  rótulos chegam por prop, e as palavras fixas abaixo servem a todo lugar. */

// PENDENTE: redação minha, o João ainda não leu
export const AVISO_RASCUNHO = "Isto é um rascunho: nada daqui aparece no app até você publicar.";
// PENDENTE: redação minha, o João ainda não leu
export const PULAR = "Pular";
// PENDENTE: redação minha, o João ainda não leu
export const PULADA = "Pulada: o app vai calar sobre isto.";
// PENDENTE: redação minha, o João ainda não leu
export const COMECAR = "Começar";
// PENDENTE: redação minha, o João ainda não leu
export const COMECANDO = "Começando…";

const PORTA_DO_RASCUNHO = { gravarEm: "/api/admin/rascunho", previa: false } as const;

type Par = { lat: number; lng: number };
const ehPar = (v: unknown): v is Par =>
  typeof v === "object" && v !== null && Number.isFinite((v as Par).lat) && Number.isFinite((v as Par).lng);

/** A COORDENADA AINDA SEM RESPOSTA: duas caixas de número, vazias, sem
 *  placeholder. Grava pelas MESMAS formas de corpo do mapa — o ponto do
 *  trajeto inteiro (`{slug, ponto, lat, lng}`) ou o par da chuva (`{slug,
 *  campo, valor: {lat, lng}}`) —, então a faixa e a finitude quem confere é a
 *  porta, como em todo editor. */
function CoordenadaDigitada({ campo, slug }: PropsDoEditor) {
  const [texto, setTexto] = useState<Readonly<Record<string, string>>>({});
  const gravacao = usarGravacao();
  const { erro, salvando, gravar, recusarAqui } = gravacao;
  const metades = campo.folhas ?? [];

  function salvar(): void {
    const numero = (chave: string): number | null => {
      const t = (texto[chave] ?? "").trim();
      return t === "" || !Number.isFinite(Number(t)) ? null : Number(t);
    };
    const lat = numero("lat");
    const lng = numero("lng");
    if (lat === null || lng === null) {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    const ponto = /\.(\d+)\.lat$/.exec(campo.caminho);
    void gravar(
      ponto ? { slug, ponto: Number(ponto[1]), lat, lng } : { slug, campo: campo.caminho, valor: { lat, lng } },
    );
  }

  return (
    <div className="adm-editor" data-editor={campo.caminho}>
      {metades.map((m) => (
        <input
          key={m.chave}
          type="number"
          step="any"
          className="adm-editor-numero"
          aria-label={m.rotulo}
          data-numero={m.caminho}
          value={texto[m.chave] ?? ""}
          onChange={(e) => setTexto((antes) => ({ ...antes, [m.chave]: e.target.value }))}
        />
      ))}
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

/** O mapa quando já há ponto; as caixas de número quando não há. */
function CoordenadaDoRascunho(props: PropsDoEditor) {
  if (ehPar(props.valor) || props.campo.ponto) return <EditorCoordenada {...props} />;
  return <CoordenadaDigitada {...props} />;
}

/** 🔴 `Record` POR ESPÉCIE: uma espécie nova no registro deixa este arquivo sem
 *  compilar até alguém decidir o instrumento dela — mesmo guarda da
 *  `FichaInteira`. */
const INSTRUMENTO: Record<EspecieNaTela, Editor> = {
  prosa: EditorProsa,
  lista: EditorLista,
  booleano: EditorBooleano,
  hora: EditorHora,
  numero: EditorNumeroDeMotor,
  bloco: EditorBloco,
  coord: CoordenadaDoRascunho,
};

function Pergunta({ pergunta, slug }: { pergunta: PerguntaNaTela; slug: string }) {
  const { especie, campo, texto, valor, dentro } = pergunta;
  const [pulada, setPulada] = useState(false);
  const Instrumento = INSTRUMENTO[especie];
  // 🔴 SÓ OPCIONAL, E SÓ SEM RESPOSTA. Obrigatório não se pula (a porta de
  // publicar recusaria); respondido, quem tira a resposta é o "não sei" de
  // dentro do editor — dois botões pro mesmo silêncio seriam duas palavras.
  const podePular = !campo.obrigatorio && valor === undefined;

  function pular(e: MouseEvent<HTMLButtonElement>): void {
    setPulada(true);
    e.currentTarget.closest("li")?.nextElementSibling?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <li className="adm-pergunta" data-testid={`pergunta-${campo.caminho}`}>
      <p className="adm-pergunta-texto">{texto}</p>
      <Instrumento campo={campo} valor={valor} slug={slug} />
      {dentro?.map((d) => (
        <EditorHora key={d.campo.caminho} campo={d.campo} valor={d.valor} slug={slug} />
      ))}
      {podePular &&
        (pulada ? (
          <p className="adm-pergunta-pulada">{PULADA}</p>
        ) : (
          <button type="button" className="adm-pergunta-pular" onClick={pular}>
            {PULAR}
          </button>
        ))}
    </li>
  );
}

export default function FormularioDeLugar({ slug, perguntas }: { slug: string; perguntas: readonly PerguntaNaTela[] }) {
  return (
    <PortaDoEditor.Provider value={PORTA_DO_RASCUNHO}>
      <section className="adm-novo" data-rascunho={slug}>
        <p className="adm-novo-aviso">{AVISO_RASCUNHO}</p>
        <ol className="adm-novo-perguntas">
          {perguntas.map((p) => (
            <Pergunta key={p.campo.caminho} pergunta={p} slug={slug} />
          ))}
        </ol>
      </section>
    </PortaDoEditor.Provider>
  );
}

/** O NOME, ANTES DE TUDO — é dele que sai o endereço do lugar.
 *
 *  A pergunta é a do questionário pro nome do ponto (chega por prop, do
 *  servidor). A porta (`POST /api/admin/rascunho`) faz o rascunho nascer e
 *  recusa com frase o nome de um lugar que já existe (inclusive escondido), de
 *  um rascunho, ou de uma tela do app; a frase dela aparece aqui como chegou,
 *  e o que ele digitou fica na caixa. */
export function ComecarLugarNovo({ pergunta }: { pergunta: string }) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function comecar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/rascunho", { method: "POST", body: JSON.stringify({ nome }) });
      if (r.ok) {
        const { slug } = (await r.json()) as { slug: string };
        location.assign(`/admin/novo?slug=${encodeURIComponent(slug)}`);
        return;
      }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-porta adm-novo-nome" onSubmit={comecar}>
      <label className="adm-rotulo">
        {pergunta}
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <button type="submit" disabled={indo}>
        {indo ? COMECANDO : COMECAR}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
