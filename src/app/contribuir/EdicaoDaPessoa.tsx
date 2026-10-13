"use client";
import { Pergunta } from "../admin/FormularioDeLugar";
import { ComVersaoDaTela, PortaDoEditor } from "../admin/campos/gravar";
import type { PerguntaNaTela } from "../admin/campos/tipos";

/** AS PERGUNTAS DELA SOBRE O LUGAR NO AR, todas numa tela (no rascunho é uma
 *  por tela; aqui ela volta pra mudar UMA coisa). Cada uma grava por
 *  `/api/contribuir/lugar` com a versão que a página leu (`ComVersaoDaTela`), e
 *  a tela se relê do banco. 401 recarrega (Review Focus 4). */
export default function EdicaoDaPessoa({ slug, versaoId, perguntas }: { slug: string; versaoId: number; perguntas: PerguntaNaTela[] }) {
  return (
    <ComVersaoDaTela id={versaoId}>
      <PortaDoEditor.Provider value={{ gravarEm: "/api/contribuir/lugar", previa: false, depoisDeGravar: null, recarregarSe401: true }}>
        {perguntas.map((q) => <Pergunta key={q.campo.caminho} pergunta={q} slug={slug} proxima={null} />)}
      </PortaDoEditor.Provider>
    </ComVersaoDaTela>
  );
}
