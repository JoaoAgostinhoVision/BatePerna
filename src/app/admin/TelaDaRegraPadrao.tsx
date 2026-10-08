"use client";
import { useState, type FormEvent } from "react";
import { SEVERIDADES, type Severidade } from "@/lib/severidade";
import type { RegraPadrao } from "@/lib/regra-padrao";
import { ERRO_GRAVAR, ERRO_REDE } from "./campos/gravar";
import { SALVANDO } from "./campos/palavras";

// PENDENTE: redação minha, o João ainda não leu
export const SALVAR_REGRA = "Salvar a regra padrão";
// PENDENTE: redação minha, o João ainda não leu
export const VALE_PARA = "Vale pra todo lugar que ainda não tem regra de chuva própria — hoje, os mandados por quem usa o app.";

type Rotulos = { previsao: string; passado: string; limiar: string; severidade: string };

/** A REGRA PADRÃO DA CHUVA (spec de 07/10, Parte 4). Os campos começam com os
 *  valores de AGORA, que são dele — não é pré-preencher, é a tela de editar o
 *  que já existe (a régua da ficha inteira). Os rótulos vêm do painel
 *  (`rotuloDe`), já lidos por ele; nenhuma palavra nova pros números. Um PUT
 *  só pros quatro: a regra é uma coisa, e meia regra gravada seria um estado
 *  que ninguém escolheu. */
export default function TelaDaRegraPadrao({ atual, rotulos }: { atual: RegraPadrao; rotulos: Rotulos }) {
  const [prev, setPrev] = useState(String(atual.janela_previsao_horas));
  const [pass, setPass] = useState(String(atual.janela_passado_horas));
  const [limiar, setLimiar] = useState(String(atual.limiar_mm));
  const [severidade, setSeveridade] = useState<Severidade>(atual.severidade);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (indo) return;
    setErro(null);
    setIndo(true);
    try {
      const corpo = {
        janela_previsao_horas: Number(prev),
        janela_passado_horas: Number(pass),
        limiar_mm: Number(limiar),
        severidade,
      };
      const r = await fetch("/api/admin/regra-padrao", { method: "PUT", body: JSON.stringify(corpo) });
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
    <form className="adm-porta adm-regra-padrao" onSubmit={salvar}>
      <p className="adm-editor-ajuda">{VALE_PARA}</p>
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
        <select value={severidade} onChange={(e) => setSeveridade(e.target.value as Severidade)}>
          {SEVERIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="submit" disabled={indo}>{indo ? SALVANDO : SALVAR_REGRA}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
