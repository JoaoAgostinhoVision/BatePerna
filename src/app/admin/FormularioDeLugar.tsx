"use client";
import { useState, type FormEvent } from "react";
import EditorFaixas from "./campos/EditorFaixas";
import EditorBooleano from "./campos/EditorBooleano";
import EditorCoordenada from "./campos/EditorCoordenada";
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
 *  interruptor, horário, número de motor e o mapa do pin são os editores de
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
 *  🔴 UMA PERGUNTA POR VEZ, na ordem do questionário — como a spec §7.3 diz, e
 *  como o João decidiu em 2026-10-03, depois de ver o custo da outra forma (com
 *  as ~27 numa tela, cada Salvar recarregava a página e jogava fora o que ele
 *  tinha digitado em OUTRA caixa). O estado de navegação que sobrevive à
 *  gravação é a URL: `/admin/novo?slug=X&p=N`. A página de servidor monta a
 *  lista inteira e entrega a este componente só a pergunta N, a posição e quais
 *  já têm resposta (`escolherPosicao`, em `./novo/perguntas.ts`, decide o `p`
 *  torto ou ausente: a primeira sem resposta).
 *   - Salvar (ou o "não sei") com sucesso AVANÇA: o provedor passa
 *     `depoisDeGravar`, que dá o endereço da pergunta N+1 (na última, a
 *     própria) no slug que a porta DEVOLVEU;
 *     recusa não sai do lugar. O PADRÃO dos editores continua o `reload()`, e
 *     a ficha no ar não mudou.
 *   - Pular também avança, sem gravar nada.
 *   - "Anterior" e "Próxima" são LINKS, não gravam: voltar a uma resposta, ou
 *     deixar uma obrigatória pra depois — rascunho é incompleto por natureza.
 *   - A lista de saltos tem um número por pergunta, marcado respondida ou sem
 *     resposta (no `aria-label`, e no desenho pela folha de estilo).
 *   ⚠️ "Pulada" não fica guardada: no documento, pular e nunca responder são a
 *   mesma ausência, e na volta a pergunta aparece sem resposta de novo.
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
// PENDENTE: redação minha, o João ainda não leu
export const ANTERIOR = "Anterior";
// PENDENTE: redação minha, o João ainda não leu
export const PROXIMA = "Próxima";
// PENDENTE: redação minha, o João ainda não leu
export const RESPONDIDA = "respondida";
// PENDENTE: redação minha, o João ainda não leu
export const SEM_RESPOSTA = "sem resposta";
/** "Pergunta N de M". */
// PENDENTE: redação minha, o João ainda não leu
export const posicaoNaTela = (n: number, total: number): string => `Pergunta ${n} de ${total}`;

/** O endereço da pergunta N do rascunho — a posição mora na URL. */
export const enderecoDaPergunta = (slug: string, n: number): string =>
  `/admin/novo?slug=${encodeURIComponent(slug)}&p=${n}`;

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
  numero: EditorNumeroDeMotor,
  faixas: EditorFaixas,
  coord: CoordenadaDoRascunho,
};

function Pergunta({
  pergunta,
  slug,
  proxima,
}: {
  pergunta: PerguntaNaTela;
  slug: string;
  /** O endereço da próxima pergunta; `null` na última. */
  proxima: string | null;
}) {
  const { especie, campo, texto, valor } = pergunta;
  const [pulada, setPulada] = useState(false);
  const Instrumento = INSTRUMENTO[especie];
  // 🔴 SÓ OPCIONAL, E SÓ SEM RESPOSTA. Obrigatório não se pula (a porta de
  // publicar recusaria; pra deixá-lo pra depois há o "Próxima", que não diz
  // que o app vai calar); respondido, quem tira a resposta é o "não sei" de
  // dentro do editor — dois botões pro mesmo silêncio seriam duas palavras.
  const podePular = !campo.obrigatorio && valor === undefined;

  function pular(): void {
    setPulada(true);
    if (proxima !== null) location.assign(proxima);
  }

  return (
    <section className="adm-pergunta" data-testid={`pergunta-${campo.caminho}`}>
      <p className="adm-pergunta-texto">{texto}</p>
      {/* 🔴 UM instrumento, e com ele UM Salvar (Tarefa 11d, o I-B): toda
          pergunta grava numa requisição só, e é ela que avança. */}
      <Instrumento campo={campo} valor={valor} slug={slug} />
      {podePular &&
        (pulada ? (
          <p className="adm-pergunta-pulada">{PULADA}</p>
        ) : (
          <button type="button" className="adm-pergunta-pular" onClick={pular}>
            {PULAR}
          </button>
        ))}
    </section>
  );
}

export default function FormularioDeLugar({
  slug,
  pergunta,
  posicao,
  respondidas,
}: {
  slug: string;
  /** A pergunta da posição `posicao` — e só ela. */
  pergunta: PerguntaNaTela;
  /** 1 a M. */
  posicao: number;
  /** Uma por pergunta, na ordem da tela: se ela já tem resposta no rascunho.
   *  O tamanho é o total M. */
  respondidas: readonly boolean[];
}) {
  const total = respondidas.length;
  const ir = (n: number): string => enderecoDaPergunta(slug, n);
  const proxima = posicao < total ? ir(posicao + 1) : null;
  // Gravar AVANÇA; na última, fica na última (relida do banco).
  // ⚠️ Os links são `<a>` simples, não o `Link` do Next, de propósito: medido no
  // build, o `Link` punha +4 kB no First Load JS desta página (111 → 115 kB),
  // no celular. E o `<a>` faz o mesmo que o `location.assign` do Salvar: a
  // página inteira relida do banco — uma navegação só, nos dois caminhos.
  // 🔴 O endereço vem da RESPOSTA da porta (ver `PortaDoEditor`): corrigir o
  // nome ou a cidade muda o endereço do rascunho.
  const destino = proxima === null ? posicao : posicao + 1;
  const porta = {
    gravarEm: "/api/admin/rascunho",
    previa: false,
    depoisDeGravar: (novo: string) => enderecoDaPergunta(novo, destino),
  };
  return (
    <PortaDoEditor.Provider value={porta}>
      <section className="adm-novo" data-rascunho={slug}>
        <p className="adm-novo-aviso">{AVISO_RASCUNHO}</p>
        <p className="adm-novo-posicao">{posicaoNaTela(posicao, total)}</p>
        <Pergunta key={pergunta.campo.caminho} pergunta={pergunta} slug={slug} proxima={proxima} />
        <nav className="adm-novo-passos">
          {posicao > 1 && (
            <a className="adm-novo-passo" href={ir(posicao - 1)}>
              {ANTERIOR}
            </a>
          )}
          {proxima !== null && (
            <a className="adm-novo-passo adm-novo-passo-proxima" href={proxima}>
              {PROXIMA}
            </a>
          )}
        </nav>
        <ol className="adm-novo-saltos" data-testid="saltos">
          {respondidas.map((r, i) => (
            <li key={i}>
              <a
                className={r ? "adm-novo-salto adm-novo-salto-respondida" : "adm-novo-salto"}
                href={ir(i + 1)}
               
                aria-label={`${posicaoNaTela(i + 1, total)}: ${r ? RESPONDIDA : SEM_RESPOSTA}`}
                aria-current={i + 1 === posicao ? "step" : undefined}
              >
                {i + 1}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </PortaDoEditor.Provider>
  );
}

/** O NOME E A CIDADE, ANTES DE TUDO — é deles que sai o endereço do lugar
 *  (Tarefa 11b: dois lugares podem ter o mesmo nome, e a cidade os separa).
 *
 *  As perguntas são as do questionário (chegam por prop, do servidor), e as
 *  duas caixas nascem VAZIAS, sem placeholder. A porta (`POST
 *  /api/admin/rascunho`) faz o rascunho nascer e recusa com frase a caixa vazia,
 *  o nome e a cidade de um lugar (inclusive escondido) ou de um rascunho que já
 *  existe, e o endereço ocupado; a frase dela aparece aqui como chegou, e o que
 *  ele digitou fica nas caixas. */
export function ComecarLugarNovo({ perguntas }: { perguntas: { nome: string; cidade: string } }) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function comecar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/rascunho", { method: "POST", body: JSON.stringify({ nome, cidade }) });
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
        {perguntas.nome}
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="adm-rotulo">
        {perguntas.cidade}
        <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} />
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
