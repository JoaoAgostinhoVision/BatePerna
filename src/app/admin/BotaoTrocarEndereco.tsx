"use client";
import { useContext, useState } from "react";
import { ERRO_GRAVAR, ERRO_REDE, VersaoDaTela, comBase } from "./campos/gravar";
import { TROCANDO, TROCAR_MESMO, trocarPara } from "@/lib/endereco";

/** O BOTÃO DE TROCAR O ENDEREÇO (Tarefa 11e) — mora DENTRO do aviso "o
 *  endereço ainda diz X", e só lá (I8 da auditoria: é o desenho que o João viu;
 *  botão solto seria um convite permanente contra a decisão dele de manter os
 *  endereços de hoje).
 *
 *  🔴 DOIS TOQUES, como o "Tirar" do trajeto: trocar o endereço muda o link que
 *  circula (o velho continua levando ao novo, mas é o tipo de coisa que não se
 *  faz sem querer). O primeiro toque só pergunta.
 *
 *  🔴 O CORPO LEVA SÓ O `slug` (e o `baseId` da tela, onda de fix 2) — o
 *  endereço novo é conta do SERVIDOR, do nome e da cidade que o documento diz
 *  (I6). `sugerido` serve só pra escrever o rótulo.
 *  No sucesso a tela vai pro painel do endereço que a porta DEVOLVEU, relido do
 *  banco; o endereço de agora já não é mais o deste lugar. */
export default function BotaoTrocarEndereco({ slug, sugerido }: { slug: string; sugerido: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // A versão que a tela abriu (onda de fix 2 da 11e): ver `VersaoDaTela`.
  const baseId = useContext(VersaoDaTela);

  async function tocar() {
    if (indo) return;
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setErro(null);
    setIndo(true);
    // Só o sucesso liga (ver `usarGravacao`, em `campos/gravar.ts`): o `finally` não
    // pode religar o botão com a página saindo.
    let saindo = false;
    try {
      const r = await fetch("/api/admin/endereco", { method: "POST", body: JSON.stringify(comBase({ slug }, baseId)) });
      if (r.ok) {
        const destino = `/admin/${((await r.json()) as { slug: string }).slug}`;
        saindo = true;
        location.assign(destino);
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
    <>
      <button type="button" className="adm-editor-salvar" disabled={indo} onClick={tocar}>
        {indo ? TROCANDO : confirmando ? TROCAR_MESMO : trocarPara(sugerido)}
      </button>
      {erro && (
        <p className="adm-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}
