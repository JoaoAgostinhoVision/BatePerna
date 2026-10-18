"use client";
import { useState, type FormEvent } from "react";
import BotaoDesistir from "./BotaoDesistir";
import EditorFaixas from "./campos/EditorFaixas";
import EditorBooleano from "./campos/EditorBooleano";
import EditorCoordenada from "./campos/EditorCoordenada";
import EditorLista from "./campos/EditorLista";
import EditorNumeroDeMotor from "./campos/EditorNumeroDeMotor";
import EditorProsa from "./campos/EditorProsa";
import { ERRO_GRAVAR, ERRO_REDE, PortaDoEditor } from "./campos/gravar";
import type { Editor, EspecieNaTela, PerguntaNaTela } from "./campos/tipos";
import { ROTAS, enderecoDaPergunta, type Onde } from "./novo/enderecos";

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
 *   - (até a Tarefa 11f havia aqui um terceiro: a coordenada vazia entrava
 *     DIGITADA, em duas caixas de número, porque o mapa só sabia abrir centrado
 *     num ponto. Ele viu e pediu o mapa — "latitude e longitude… que horror".
 *     Agora é o MESMO `EditorCoordenada` da ficha no ar: sem ponto, ele nasce
 *     SEM PIN e sem Salvar, na vista que a página de servidor calculou
 *     (`campo.vista`: a cidade do lugar, ou o ponto 0 pra a coordenada da
 *     chuva), e o ponto é o TOQUE dele no mapa — nunca o centro da vista);
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
 *     Na ÚLTIMA pergunta, o "Próxima" leva à tela de PUBLICAR (Tarefa 12, R3 da
 *     auditoria de 06/10): é o fim do questionário, e é por ali que o dono
 *     chega lá — a outra porta é o item do rascunho na lista do painel.
 *   - A lista de saltos tem um número por pergunta, marcado respondida ou sem
 *     resposta (no `aria-label`, e no desenho pela folha de estilo).
 *   ⚠️ "Pulada" não fica guardada: no documento, pular e nunca responder são a
 *   mesma ausência, e na volta a pergunta aparece sem resposta de novo.
 *
 *  🔴 O MESMO FORMULÁRIO SERVE QUEM USA (Task 13 da rodada de 07/10). A prop
 *  `onde` (`"painel"`, o padrão, ou `"contribuir"`) escolhe a linha de `ROTAS`
 *  (`./novo/enderecos`): as portas `/api/contribuir/*` em vez de
 *  `/api/admin/*`, e as telas `/contribuir/novo…` em vez de `/admin/novo…`. Os
 *  endereços `/admin/…` citados neste comentário são os da linha do painel. É
 *  uma STRING e não uma função de endereço porque a página que monta este
 *  componente é de servidor, e função não atravessa essa fronteira como prop.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: as perguntas e os
 *  rótulos chegam por prop, e as palavras fixas abaixo servem a todo lugar. */

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const AVISO_RASCUNHO = "Isto é um rascunho: nada daqui aparece no app até você publicar.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PULAR = "Pular";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PULADA = "Pulada: o app vai calar sobre isto.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const COMECAR = "Começar";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const COMECANDO = "Começando…";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ANTERIOR = "Anterior";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PROXIMA = "Próxima";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const RESPONDIDA = "respondida";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const SEM_RESPOSTA = "sem resposta";
/** "Pergunta N de M". */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const posicaoNaTela = (n: number, total: number): string => `Pergunta ${n} de ${total}`;

/** O endereço da pergunta N mora em `./novo/enderecos` desde a Tarefa 12 (a
 *  página de publicar, de servidor, também o usa); continua saindo daqui. */
export { enderecoDaPergunta };

/** 🔴 `Record` POR ESPÉCIE: uma espécie nova no registro deixa este arquivo sem
 *  compilar até alguém decidir o instrumento dela — mesmo guarda da
 *  `FichaInteira`. */
export const INSTRUMENTO: Record<EspecieNaTela, Editor> = {
  prosa: EditorProsa,
  lista: EditorLista,
  booleano: EditorBooleano,
  numero: EditorNumeroDeMotor,
  faixas: EditorFaixas,
  coord: EditorCoordenada,
};

export function Pergunta({
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
  onde = "painel",
}: {
  slug: string;
  /** A pergunta da posição `posicao` — e só ela. */
  pergunta: PerguntaNaTela;
  /** 1 a M. */
  posicao: number;
  /** Uma por pergunta, na ordem da tela: se ela já tem resposta no rascunho.
   *  O tamanho é o total M. */
  respondidas: readonly boolean[];
  /** Quem responde: o João no painel (o padrão) ou quem usa (`"contribuir"`).
   *  Muda só pra onde grava e pra onde leva — ver `ROTAS`. */
  onde?: Onde;
}) {
  const rotas = ROTAS[onde];
  const total = respondidas.length;
  const ir = (n: number): string => rotas.pergunta(slug, n);
  const proxima = posicao < total ? ir(posicao + 1) : null;
  // Gravar AVANÇA; na última, fica na última (relida do banco).
  // ⚠️ Os links são `<a>` simples, não o `Link` do Next, de propósito: medido no
  // build, o `Link` punha +4 kB no First Load JS desta página (111 → 115 kB),
  // no celular. E o `<a>` faz o mesmo que o `location.assign` do Salvar: a
  // página inteira relida do banco — uma navegação só, nos dois caminhos.
  // 🔴 O endereço vem da RESPOSTA da porta (ver `PortaDoEditor`): corrigir o
  // nome, ou o ponto (de onde a cidade sai desde 17/10), muda o endereço do
  // rascunho do João — pro `nome-cidade`, ou pra uma chave provisória quando o
  // par já é de outro (o de quem usa mora numa chave que não muda, Task 17).
  const destino = proxima === null ? posicao : posicao + 1;
  const porta = {
    gravarEm: rotas.rascunhoApi,
    previa: false,
    depoisDeGravar: (novo: string) => rotas.pergunta(novo, destino),
    recarregarSe401: rotas.recarregarSe401,
  };
  return (
    <PortaDoEditor.Provider value={porta}>
      <section className="adm-novo" data-rascunho={slug}>
        <p className="adm-novo-aviso">{AVISO_RASCUNHO}</p>
        {/* Desistir (Tarefa 15): em TODA pergunta, porque este componente só
            existe com o rascunho já nascido — a tela do nome é o
            `ComecarLugarNovo`, sem ele. Apagado, volta à lista (a do painel, ou
            a de quem usa — `ROTAS[onde].desistiu`). */}
        <BotaoDesistir slug={slug} voltarAoPainel onde={onde} />
        <p className="adm-novo-posicao">{posicaoNaTela(posicao, total)}</p>
        <Pergunta key={pergunta.campo.caminho} pergunta={pergunta} slug={slug} proxima={proxima} />
        <nav className="adm-novo-passos">
          {posicao > 1 && (
            <a className="adm-novo-passo" href={ir(posicao - 1)}>
              {ANTERIOR}
            </a>
          )}
          <a className="adm-novo-passo adm-novo-passo-proxima" href={proxima ?? rotas.publicar(slug)}>
            {PROXIMA}
          </a>
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

/** O NOME, ANTES DE TUDO — é a única pergunta da tela 1 (17/10: a cidade não
 *  é mais uma caixa; vem do ponto que ele marca no mapa, e o endereço do lugar
 *  sai dela depois).
 *
 *  A pergunta é a do questionário (chega por prop, do servidor), e a caixa
 *  nasce VAZIA, sem placeholder. A porta (`POST /api/admin/rascunho`) faz o
 *  rascunho nascer, numa chave provisória, e recusa com frase o nome vazio ou
 *  sem letra e o nome de um lugar que ainda não tem cidade; a frase dela
 *  aparece aqui como chegou, e o que ele digitou fica na caixa. Com
 *  `onde="contribuir"` a porta é `POST /api/contribuir/rascunho`, e o 401 (a
 *  sessão do Clerk venceu) recarrega. */
export function ComecarLugarNovo({
  pergunta,
  onde = "painel",
}: {
  pergunta: string;
  onde?: Onde;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function comecar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch(ROTAS[onde].rascunhoApi, { method: "POST", body: JSON.stringify({ nome }) });
      if (r.ok) {
        const { slug } = (await r.json()) as { slug: string };
        location.assign(ROTAS[onde].comecou(slug));
        return;
      }
      if (r.status === 401 && ROTAS[onde].recarregarSe401) {
        location.reload();
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
