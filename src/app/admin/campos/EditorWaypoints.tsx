"use client";
import { useState } from "react";
import { usarGravacao } from "./gravar";
import { CAIXA_VAZIA, SALVANDO } from "./palavras";

/** A CADEIA DO TRAJETO, PELO CELULAR (Tarefa 10, C1 da auditoria do brief).
 *
 *  🔴 POR QUE ISTO EXISTE. O painel já editava TODO campo de TODO ponto que a
 *  ficha tem (`camposDaFicha` expande o molde `trajeto.waypoints[]`), mas não
 *  havia como CRIAR o segundo ponto: a cadeia só nasceria por semente — código,
 *  deploy, programador. É o contrário da lei do projeto (dado novo entra pelo
 *  APP). Este editor é a menor coisa que devolve essa autonomia ao dono.
 *
 *  🔴 DUAS AÇÕES, E SÓ DUAS:
 *   - ACRESCENTAR UM PONTO NO FIM: o dono digita o nome; a coordenada nasce
 *     COPIADA do último ponto (a porta faz isso, ver `acrescentarEtapa`) e ele a
 *     ajusta no mapa do ponto novo, que a Tarefa 8 já desenha pra qualquer
 *     `trajeto.waypoints.N.lat`. O `reload` do sucesso traz o ponto novo já com
 *     os campos e o mapa dele.
 *   - TIRAR O ÚLTIMO: um botão que nomeia o último ponto. Só aparece com dois
 *     pontos ou mais — com um só, o único ponto é O LUGAR, e a tela nem oferece
 *     (a porta recusaria com 409). Nada se perde: a versão anterior fica no
 *     histórico, e "voltar" a devolve.
 *
 *  🔴 NUNCA O PONTO 1, NUNCA NO MEIO. `waypoints[0]` é o lugar (o nome na home,
 *  o pin, a ordem, a distância); inserir antes dele ou tirá-lo trocaria o lugar
 *  pela primeira etapa do caminho em todas as telas. Reordenar e tirar do meio
 *  não existem — se um dia fizerem falta, é decisão dele, não deste editor.
 *
 *  🔴 O SERVIDOR CONTA, O EDITOR NÃO SABE O QUE É FICHA. `pontos` e o rótulo do
 *  último chegam por PROP, montados por `FichaInteira` — o mesmo contrato de
 *  `./tipos.ts`: nenhum editor importa `@/lib/campos-da-ficha`, que traria o zod
 *  pro celular. O índice mandado em `tirarEtapa` é `pontos - 1`, e a porta
 *  confere que ele ainda é o último (a tela pode estar velha). */

/** O nome da caixa do ponto novo. "O nome" é a palavra que o painel já usa pra
 *  essa folha de todo ponto (`ROTULO_DO_PONTO.nome`), e "ponto" é a que o
 *  trajeto usa — nenhuma palavra nova pra coisa velha. Vai como `aria-label`:
 *  o botão logo abaixo já diz o que a caixa é. */
// PENDENTE: redação minha, o João ainda não leu
export const NOME_DO_PONTO_NOVO = "O nome do ponto novo";

// PENDENTE: redação minha, o João ainda não leu
export const ACRESCENTAR_PONTO = "Acrescentar um ponto no fim do trajeto";

/** A coordenada do ponto novo é uma CÓPIA, e o dono precisa saber disso antes
 *  de tocar no botão — senão o ponto novo aparece no mesmo lugar do anterior e
 *  parece defeito. */
// PENDENTE: redação minha, o João ainda não leu
export const DICA_DO_PONTO_NOVO = "O ponto novo nasce na coordenada do último; depois, ajuste no mapa dele.";

/** `rotulo` é o "Ponto N" que o servidor já escreve no bloco de cada ponto —
 *  uma forma só de nomear um ponto na tela inteira. */
// PENDENTE: redação minha, o João ainda não leu
export const tirarPonto = (rotulo: string): string => `Tirar o ${rotulo}`;

export default function EditorWaypoints({
  slug,
  pontos,
  rotuloDoUltimo,
}: {
  slug: string;
  /** Quantos pontos o trajeto tem AGORA (o lugar conta). */
  pontos: number;
  /** O rótulo do último ponto, como o bloco dele o mostra ("Ponto 3"). */
  rotuloDoUltimo: string;
}) {
  const [nome, setNome] = useState("");
  const { erro, salvando, gravar, recusarAqui } = usarGravacao();

  function acrescentar(): void {
    if (nome.trim() === "") {
      recusarAqui(CAIXA_VAZIA);
      return;
    }
    void gravar({ slug, acrescentarEtapa: { nome } });
  }

  return (
    <div className="adm-campo adm-editor" data-testid="editor-waypoints">
      <input
        type="text"
        className="adm-editor-caixa"
        aria-label={NOME_DO_PONTO_NOVO}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <p className="adm-editor-ajuda">{DICA_DO_PONTO_NOVO}</p>
      <button type="button" className="adm-editor-salvar" disabled={salvando} onClick={acrescentar}>
        {salvando ? SALVANDO : ACRESCENTAR_PONTO}
      </button>
      {pontos > 1 && (
        <button
          type="button"
          className="adm-editor-nao-sei"
          disabled={salvando}
          onClick={() => void gravar({ slug, tirarEtapa: pontos - 1 })}
        >
          {tirarPonto(rotuloDoUltimo)}
        </button>
      )}
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
