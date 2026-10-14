"use client";
import { useContext, useState, type FormEvent } from "react";
import { SEVERIDADES } from "@/lib/severidade";
import { ERRO_GRAVAR, ERRO_REDE, VersaoDaTela, comBase } from "./gravar";
import { SALVANDO } from "./palavras";

// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const CALIBRAR = "Calibrar a chuva deste lugar";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const CALIBRAR_AJUDA = "Este lugar usa a regra padrão. Responda os quatro pra ele ter a regra dele.";
// LIDA: o João marcou "Serve" no pacote de copy em 2026-10-13.
export const FALTA_UM_DOS_QUATRO = "Faltou responder um dos quatro: nada foi gravado.";

type Rotulos = { previsao: string; passado: string; limiar: string; severidade: string };

/** O "CALIBRAR" (Task 8): os quatro valores de uma vez, VAZIOS no começo —
 *  ninguém calibrou este lugar ainda, e mostrar a regra padrão aqui seria
 *  convidar a copiá-la. Um POST só; no sucesso, a tela se relê do banco. */
export default function EditorCalibrar({ slug, rotulos }: { slug: string; rotulos: Rotulos }) {
  const baseId = useContext(VersaoDaTela);
  const [prev, setPrev] = useState("");
  const [pass, setPass] = useState("");
  const [limiar, setLimiar] = useState("");
  const [severidade, setSeveridade] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function calibrar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    // 🔴 Caixa vazia vira `Number("") === 0`: "vazio" chegaria à porta como
    // ZERO, e a coerência responderia sobre janela zerada — a frase certa pro
    // número errado. Vazio para aqui, sem chamar a rota.
    if ([prev, pass, limiar].some((v) => v.trim() === "") || severidade === "") {
      setErro(FALTA_UM_DOS_QUATRO);
      return;
    }
    setErro(null);
    setIndo(true);
    try {
      const regra = { janela_previsao_horas: Number(prev), janela_passado_horas: Number(pass), limiar_mm: Number(limiar), severidade };
      const r = await fetch("/api/admin/calibrar", { method: "POST", body: JSON.stringify(comBase({ slug, regra }, baseId)) });
      if (r.ok) { location.reload(); return; }
      const frase = (await r.text()).trim();
      setErro(frase === "" ? ERRO_GRAVAR : frase);
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-campo adm-calibrar" onSubmit={calibrar} data-calibrar={slug}>
      <p className="adm-editor-ajuda">{CALIBRAR_AJUDA}</p>
      <label className="adm-rotulo">{rotulos.previsao}
        <input type="number" inputMode="decimal" step="any" value={prev} onChange={(e) => setPrev(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.passado}
        <input type="number" inputMode="decimal" step="any" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.limiar}
        <input type="number" inputMode="decimal" step="any" value={limiar} onChange={(e) => setLimiar(e.target.value)} />
      </label>
      <label className="adm-rotulo">{rotulos.severidade}
        <select value={severidade} onChange={(e) => setSeveridade(e.target.value)}>
          <option value="" />
          {SEVERIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="submit" disabled={indo}>{indo ? SALVANDO : CALIBRAR}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
