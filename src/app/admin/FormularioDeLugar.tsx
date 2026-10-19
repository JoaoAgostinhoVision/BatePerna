"use client";
import { useCallback, useState, type FormEvent, type MouseEvent } from "react";
import AvisoDoPar, { CORRIGIR_O_NOME } from "./AvisoDoPar";
import BotaoDesistir from "./BotaoDesistir";
import EditorFaixas from "./campos/EditorFaixas";
import EditorBooleano from "./campos/EditorBooleano";
import EditorCoordenada from "./campos/EditorCoordenada";
import EditorLista from "./campos/EditorLista";
import EditorNumeroDeMotor from "./campos/EditorNumeroDeMotor";
import EditorProsa from "./campos/EditorProsa";
import { AvisoDeMudanca, ERRO_GRAVAR, ERRO_REDE, PortaDoEditor } from "./campos/gravar";
import { PULADA, SEM_RESPOSTA } from "./campos/palavras";
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
 *     (`campo.vista`, de `vistaDaCoordSemPonto`: o ponto 0 pra a coordenada da
 *     chuva; a cidade do documento, quando ele tem uma; senão o acervo — que é
 *     a vista do lugar novo, porque desde 17/10 ele não tem cidade antes do
 *     ponto), e o ponto é o TOQUE dele no mapa — nunca o centro da vista);
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
 *  lista inteira e entrega a este componente só a pergunta N, a posição e a
 *  lista `respondidas` — da qual este componente só lê o TAMANHO, o total M
 *  (quem lê quais têm resposta é `escolherPosicao`, em `./novo/perguntas.ts`,
 *  na página, que decide o `p` torto ou ausente: a primeira sem resposta).
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
 *   - (Até 17/10 havia ainda uma fileira de saltos, um número por pergunta. Saiu:
 *     era uma fileira de portas por onde o texto digitado ia embora com um
 *     toque, e quem quer revisar o todo tem a tela de revisão, antes de
 *     publicar.)
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
 *  🔴 NENHUM TOQUE PERDE UMA RESPOSTA (17/10, Task 7 — a "melhoria 1", que a
 *  spec chama "nenhum toque perde texto"; o ⚠️ abaixo diz qual texto não
 *  conta). Sair desta pergunta sem gravar jogava fora o que estava na caixa, e um "Próxima" discreto era a
 *  porta mais fácil do painel. Todo editor avisa por `AvisoDeMudanca` (via
 *  `BotaoDesfazer`) quando a tela difere do salvo; com algo não salvo,
 *  "Anterior", "Próxima", "Voltar à revisão", "Pular" e o "Corrigir o nome" do
 *  aviso do par (este desde a revisão final de 18/10) pedem o SEGUNDO toque, no
 *  molde do `BotaoDesistir` — o rótulo do toque vira `SEGUIR_SEM_SALVAR`, e só
 *  o segundo navega. Sem nada não salvo, um toque, como sempre. O pedido é de
 *  UM controle por vez e cai sozinho quando o Desfazer devolve a tela ao salvo.
 *  ⚠️ O que conta como "não salvo" é a RESPOSTA do editor, e só ela: o texto
 *  da caixa de BUSCA do mapa (`BuscaNoMapa`) não conta, de propósito — é uma
 *  consulta efêmera, perdê-la custa redigitar uma palavra, e contá-la faria a
 *  busca pedir o segundo toque a cada navegação (ruling do controlador, 18/10).
 *  E o aviso é um booleano só, porque há UM `BotaoDesfazer` por pergunta (ver
 *  `AvisoDeMudanca`, em `./campos/gravar`).
 *
 *  🔴 A PERGUNTA VEM PRIMEIRO. A ordem é "Pergunta N de M" → a pergunta → o aviso
 *  do par → a navegação → o aviso de rascunho → o Desistir. O que não é a
 *  pergunta desce pro rodapé, em toda tela.
 *
 *  🔴 "CORRIGIR" VOLTA À REVISÃO. Com `voltaARevisao` (a URL traz
 *  `&volta=revisao`, de `ROTAS[onde].corrigir`), gravar leva à REVISÃO pelo slug
 *  que a porta devolveu (o do painel pode mudar com o ponto), o "Pular" leva à
 *  revisão, e a navegação é só o `VOLTAR_A_REVISAO` — nada de Anterior nem
 *  Próxima, porque quem veio corrigir uma pergunta não tem por que andar pelas
 *  outras.
 *
 *  ⚠️ NENHUM TEXTO SOBRE UM LUGAR ESPECÍFICO mora aqui: as perguntas e os
 *  rótulos chegam por prop, e as palavras fixas abaixo servem a todo lugar. */

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const AVISO_RASCUNHO = "Isto é um rascunho: nada daqui aparece no app até você publicar.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PULAR = "Pular";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const COMECAR = "Começar";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const COMECANDO = "Começando…";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const ANTERIOR = "Anterior";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const PROXIMA = "Próxima";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const SEGUIR_SEM_SALVAR = "Seguir sem salvar? O que você escreveu aqui some.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-18. Redação minha.
export const VOLTAR_A_REVISAO = "Voltar à revisão";
/** "Pergunta N de M". */
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-07. Redação minha.
export const posicaoNaTela = (n: number, total: number): string => `Pergunta ${n} de ${total}`;

/** `PULADA` e `SEM_RESPOSTA` moram em `./campos/palavras` (a revisão, de servidor, as lê);
 *  saem daqui como sempre saíram. */
export { PULADA, SEM_RESPOSTA };

/** O endereço da pergunta N mora em `./novo/enderecos` (`ROTAS.painel.pergunta`);
 *  continua saindo daqui. A revisão e a página de publicar usam o `corrigir`
 *  das `ROTAS`, não este. */
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
  podeSair,
  pedindo = false,
}: {
  pergunta: PerguntaNaTela;
  slug: string;
  /** Pra onde o "Pular" leva: a próxima pergunta, ou a revisão quando se veio
   *  corrigir; `null` na última. */
  proxima: string | null;
  /** O segundo toque do formulário (17/10): `true` = pode sair agora; `false` =
   *  há texto não salvo, o pedido foi feito e o toque não sai. Ausente (a
   *  edição de quem usa no lugar no ar) = sai sempre. */
  podeSair?: () => boolean;
  /** O "Pular" está pedindo o segundo toque: o rótulo vira `SEGUIR_SEM_SALVAR`. */
  pedindo?: boolean;
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
    if (podeSair && !podeSair()) return;
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
            {pedindo ? SEGUIR_SEM_SALVAR : PULAR}
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
  aviso,
  voltaARevisao = false,
}: {
  slug: string;
  /** A pergunta da posição `posicao` — e só ela. */
  pergunta: PerguntaNaTela;
  /** 1 a M. */
  posicao: number;
  /** Uma por pergunta, na ordem da tela: se ela já tem resposta no rascunho.
   *  Aqui só o TAMANHO é lido — é o total M do "Pergunta N de M" e da última. */
  respondidas: readonly boolean[];
  /** Quem responde: o João no painel (o padrão) ou quem usa (`"contribuir"`).
   *  Muda só pra onde grava e pra onde leva — ver `ROTAS`. */
  onde?: Onde;
  /** O aviso de nome que já existe na cidade: a frase e o endereço do
   *  "Corrigir o nome", calculados pela página de servidor; desenhado aqui
   *  (`AvisoDoPar`) logo DEPOIS da pergunta, que fica no topo, com o link pelo
   *  `passo()` — o mesmo segundo toque dos outros; na pergunta do nome, que é
   *  pra onde o link leva, só a frase. Ausente quando nada trava o publicar. */
  aviso?: { frase: string; corrigir: string };
  /** Veio de um "Corrigir" (`&volta=revisao`): o seguir volta pra revisão. */
  voltaARevisao?: boolean;
}) {
  const rotas = ROTAS[onde];
  // O segundo toque: `naoSalvo` vem dos editores (`AvisoDeMudanca`); `pedido` é
  // o controle que já pediu — um por vez. Sem nada não salvo, o pedido não vale.
  const [naoSalvo, setNaoSalvo] = useState(false);
  const [pedido, setPedido] = useState<string | null>(null);
  // 🔴 Voltar ao salvo (o Desfazer) DERRUBA o pedido: senão o texto digitado
  // depois já encontraria o "segundo toque" feito, e o 1º toque sairia.
  const avisarMudanca = useCallback((mudou: boolean): void => {
    setNaoSalvo(mudou);
    if (!mudou) setPedido(null);
  }, []);
  const pedindo = (id: string): boolean => naoSalvo && pedido === id;
  /** `true` = pode sair; `false` = pediu o segundo toque e não sai. */
  function podeSair(id: string): boolean {
    if (!naoSalvo || pedido === id) return true;
    setPedido(id);
    return false;
  }
  /** O clique de um link de passo: sem nada não salvo, é o link de sempre; com,
   *  o 1º toque não sai e o 2º navega. */
  function aoTocarNoLink(id: string, href: string) {
    return (e: MouseEvent<HTMLAnchorElement>): void => {
      if (!naoSalvo) return;
      e.preventDefault();
      if (podeSair(id)) location.assign(href);
    };
  }
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
  const revisao = rotas.publicar(slug);
  const porta = {
    gravarEm: rotas.rascunhoApi,
    previa: false,
    depoisDeGravar: (novo: string) => (voltaARevisao ? rotas.publicar(novo) : rotas.pergunta(novo, destino)),
    recarregarSe401: rotas.recarregarSe401,
    buscarEm: rotas.buscaApi,
  };
  const passo = (id: string, href: string, rotulo: string, classe?: string) => (
    <a className={classe} href={href} onClick={aoTocarNoLink(id, href)}>
      {pedindo(id) ? SEGUIR_SEM_SALVAR : rotulo}
    </a>
  );
  return (
    <PortaDoEditor.Provider value={porta}>
      <AvisoDeMudanca.Provider value={avisarMudanca}>
        <section className="adm-novo" data-rascunho={slug}>
          <p className="adm-novo-posicao">{posicaoNaTela(posicao, total)}</p>
          <Pergunta
            key={pergunta.campo.caminho}
            pergunta={pergunta}
            slug={slug}
            proxima={voltaARevisao ? revisao : proxima}
            podeSair={() => podeSair("pular")}
            pedindo={pedindo("pular")}
          />
          {/* 🔴 Na pergunta do nome (a 1, pra onde as duas páginas apontam o
              `corrigir`), o link só recarregaria esta mesma tela: ali vai só a
              frase (decisão do João na onda de copy de 18/10). */}
          {aviso && (
            <AvisoDoPar
              frase={aviso.frase}
              link={posicao === 1 ? null : passo("corrigir-nome", aviso.corrigir, CORRIGIR_O_NOME)}
            />
          )}
          <nav className="adm-novo-passos">
            {voltaARevisao ? (
              passo("revisao", revisao, VOLTAR_A_REVISAO, "adm-novo-passo adm-novo-passo-proxima")
            ) : (
              <>
                {posicao > 1 && passo("anterior", ir(posicao - 1), ANTERIOR, "adm-novo-passo")}
                {passo("proxima", proxima ?? revisao, PROXIMA, "adm-novo-passo adm-novo-passo-proxima")}
              </>
            )}
          </nav>
          <p className="adm-novo-aviso">{AVISO_RASCUNHO}</p>
          {/* Desistir (Tarefa 15): em TODA pergunta, porque este componente só
              existe com o rascunho já nascido — a tela do nome é o
              `ComecarLugarNovo`, sem ele. Apagado, volta à lista (a do painel, ou
              a de quem usa — `ROTAS[onde].desistiu`). Não pede o segundo toque
              dos passos: ele já tem o seu, e é o que apaga tudo. */}
          <BotaoDesistir slug={slug} voltarAoPainel onde={onde} />
        </section>
      </AvisoDeMudanca.Provider>
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
    // Só o sucesso liga (ver `usarGravacao`, em `campos/gravar.ts`): o `finally` não
    // pode religar o botão com a página saindo.
    let saindo = false;
    try {
      const r = await fetch(ROTAS[onde].rascunhoApi, { method: "POST", body: JSON.stringify({ nome }) });
      if (r.ok) {
        const { slug } = (await r.json()) as { slug: string };
        saindo = true;
        location.assign(ROTAS[onde].comecou(slug));
        return;
      }
      if (r.status === 401 && ROTAS[onde].recarregarSe401) {
        saindo = true;
        location.reload();
        return;
      }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      if (!saindo) setIndo(false);
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
