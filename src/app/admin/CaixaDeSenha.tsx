"use client";
import { useState } from "react";

/** A caixa de senha do painel.
 *
 *  🔴 POST com a senha no CORPO, nunca na URL: query string entra no log do
 *  servidor, no histórico do navegador e no `Referer` do próximo link. */
export default function CaixaDeSenha() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setIndo(true);
    try {
      const r = await fetch("/api/admin/entrar", {
        method: "POST",
        body: JSON.stringify({ senha }),
      });
      if (r.ok) { location.reload(); return; }
      setErro(r.status === 404 ? "O painel não está configurado." : "Senha não confere.");
    } catch {
      setErro("Sem rede.");
    } finally {
      setIndo(false);
    }
  }

  return (
    <form className="adm-porta" onSubmit={entrar}>
      <label className="adm-rotulo" htmlFor="adm-senha">Senha do painel</label>
      <input
        id="adm-senha"
        type="password"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <button type="submit" disabled={indo}>{indo ? "Entrando…" : "Entrar"}</button>
      {erro && <p className="adm-erro" role="alert">{erro}</p>}
    </form>
  );
}
