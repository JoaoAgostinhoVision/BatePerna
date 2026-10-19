"use client";
import { useRef, useState } from "react";
import { ERRO_REDE } from "./campos/gravar";
import { ROTAS, type Onde } from "./novo/enderecos";

/** DESISTIR DE UM LUGAR NOVO — apagar o RASCUNHO (Tarefa 15, 07/10: o João,
 *  olhando o painel no ar, *"ficou faltando o botão de cancelar"*; escolheu os
 *  dois cancelar, e este é o primeiro). Mora em DOIS lugares, o mesmo botão:
 *  em toda pergunta do `/admin/novo` (`FormularioDeLugar`, no rodapé, depois do aviso de
 *  rascunho) e em cada item de "Começados, ainda fora do ar" (`ListaDeLugares`,
 *  ao lado do "publicar"). A tela do nome (`ComecarLugarNovo`) NÃO o
 *  tem: ali o rascunho ainda não nasceu, e não há nada pra apagar. A tela de
 *  publicar também não — o desenho aprovado não a cita.
 *
 *  🔴 DOIS TOQUES, no molde do "Tirar mesmo?" do `EditorWaypoints`: o primeiro
 *  troca o rótulo pela pergunta (`DESISTIR_MESMO`) e não manda nada; só o
 *  segundo chama `DELETE /api/admin/rascunho` com `{slug}`. O estado de
 *  "confirmar" é desta tela: recarregar desfaz. E, como lá, não há palavra de
 *  espera ("Desistindo…"): o "Tirar mesmo?" não tem, e o botão só se desliga
 *  enquanto a porta responde.
 *
 *  🔴 A TRAVA DO DUPLO ENVIO É UM `useRef`, NÃO O ESTADO (M2 da revisão): um
 *  2º clique que chega ANTES de a tela redesenhar vê o `indo` da renderização
 *  de antes (`false`) e o botão ainda sem `disabled` — com `if (indo) return`
 *  saíam DOIS `DELETE` (medido em `tests/app/admin-desistir.test.tsx`). O ref
 *  é lido na hora, não na renderização. O `disabled={indo}` fica: é o que a
 *  tela mostra.
 *
 *  🔴 NUNCA TIRA LUGAR DO AR. A rota só apaga `ficha_rascunhos`; um slug de
 *  lugar publicado é um DELETE que não toca na versão dele — provado pela página
 *  PÚBLICA em `tests/app/desistir-nao-tira-do-ar.test.tsx`. Por isso o botão não
 *  aparece em lugar no ar nenhum, e a frase fala só do que foi RESPONDIDO.
 *
 *  🔴 O MOLDE DE SUCESSO É O DO PAINEL: a tela vem do banco, nunca de estado
 *  otimista. No formulário, `location.assign("/admin")` (a pergunta de um
 *  rascunho que não existe mais seria 404); na lista, `location.reload()` — a
 *  lista relida não o tem mais. Na FALHA (porta recusou, ou sem rede), nada
 *  navega: a pergunta continua na tela, com a frase. 404 é falha também: a
 *  rota o dá quando não havia rascunho naquele endereço (movido noutra aba
 *  quando o nome ou a cidade mudou) — "desisti" seria mentira, e o rascunho
 *  continua na lista com o endereço novo (M1 da revisão da Tarefa 15).
 *  `voltarAoPainel` é um booleano, e não uma função, porque a lista é
 *  componente de SERVIDOR e função não atravessa pra cá — pelo mesmo motivo,
 *  `onde` (Task 13, 07/10) é uma CHAVE de `ROTAS`: com `"contribuir"` o DELETE
 *  vai a `/api/contribuir/rascunho`, "voltar" é a lista de quem usa
 *  (`/contribuir`), e o 401 (a sessão do Clerk venceu) recarrega. Os endereços
 *  `/admin…` acima são os da linha do painel. */

// PENDENTE: redação minha (Tarefa 15, 07/10). Ele aprovou o DESENHO no chat ("pode fazer assim"), não leu a frase.
export const DESISTIR = "Desistir deste lugar";
// PENDENTE: redação minha (Tarefa 15, 07/10). Ele aprovou o DESENHO no chat ("pode fazer assim"), não leu a frase.
export const DESISTIR_MESMO = "Desistir mesmo? O que foi respondido some.";
/** A porta recusou (a sessão venceu, o corpo não chegou, ou não havia
 *  rascunho naquele endereço — 404). A rota responde
 *  corpo VAZIO nessas recusas, então a frase é desta tela. Não reaproveita o
 *  `ERRO_GRAVAR` ("Não consegui salvar."): desistir não é salvar, e a frase
 *  diria o contrário do que ele tentou. A falta de rede é `ERRO_REDE`, a mesma
 *  do painel inteiro. */
// PENDENTE: redação minha (Tarefa 15, 07/10). Ainda não lida por ele.
export const ERRO_DESISTIR = "Não consegui desistir deste lugar.";

export default function BotaoDesistir({
  slug,
  voltarAoPainel = false,
  onde = "painel",
}: {
  slug: string;
  voltarAoPainel?: boolean;
  /** Quem desiste: o João (o padrão) ou quem usa — ver `ROTAS`. */
  onde?: Onde;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emVoo = useRef(false);

  async function desistir(): Promise<void> {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    // ⚠️ O 2º TOQUE. Dois toques rápidos SÃO a confirmação (M5 da revisão da
    // Tarefa 15, aceito): o 1º redesenha com a pergunta antes do 2º chegar, e o
    // 2º apaga — o mesmo comportamento do "Tirar mesmo?" do `EditorWaypoints`,
    // de propósito. Se um dia pedir intervalo mínimo, é nos dois botões juntos.
    if (emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setIndo(true);
    // Só o sucesso liga (ver `usarGravacao`, em `campos/gravar.ts`): o `finally` não
    // pode religar o botão com a página saindo.
    let saindo = false;
    try {
      const r = await fetch(ROTAS[onde].rascunhoApi, { method: "DELETE", body: JSON.stringify({ slug }) });
      if (r.ok) {
        saindo = true;
        if (voltarAoPainel) location.assign(ROTAS[onde].desistiu);
        else location.reload();
        return;
      }
      if (r.status === 401 && ROTAS[onde].recarregarSe401) {
        saindo = true;
        location.reload();
        return;
      }
      setErro(ERRO_DESISTIR);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      if (!saindo) {
        emVoo.current = false;
        setIndo(false);
      }
    }
  }

  return (
    <>
      <button type="button" className="adm-rascunho-desistir" disabled={indo} onClick={desistir}>
        {confirmando ? DESISTIR_MESMO : DESISTIR}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}
