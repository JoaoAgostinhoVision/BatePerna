"use client";
import { useState } from "react";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import type { AvisoLinha, EfeitoAviso } from "@/lib/db";
import { falaMolhada, vozDaFicha } from "@/lib/severidade";
import { marcaAgora } from "./marca-agora";

const EFEITOS: readonly EfeitoAviso[] = ["nenhum", "fresco", "frio", "fechado"];

const DIA = 24 * 3600;

/** Os cinco atalhos de prazo do brief — nenhum select de data solta, porque
 *  aviso sem prazo é mentira agendada (mesma régua do `avisos` em `db.ts`). */
const ATALHOS = [
  { rotulo: "amanhã", segundos: 1 * DIA },
  { rotulo: "3 dias", segundos: 3 * DIA },
  { rotulo: "1 semana", segundos: 7 * DIA },
  { rotulo: "1 mês", segundos: 30 * DIA },
  { rotulo: "6 meses", segundos: 180 * DIA },
] as const;

/** 🔴 "Abre destacando o que vence em breve" não veio com número no brief —
 *  3 dias é escolha do controlador desta task, não do João. */
const VENCE_EM_BREVE_SEGUNDOS = 3 * DIA;

// PENDENTE: redação minha, o João ainda não leu
const AVISO_ERRO_LEITURA = "Não consegui ler o aviso publicado — a seção abaixo pode estar incompleta.";

/** A linha que é o ponto da tela: o que vai pra tela se este efeito for
 *  publicado, nunca o nome do efeito. `frio` nunca escreve a fala à mão — ela
 *  sai de `falaMolhada`, a mesma língua que a ficha fala, porque foi a língua
 *  de um lugar virando a língua de todos que este arquivo existe pra não
 *  repetir (ver `src/lib/severidade.ts`). */
function consequencia(efeito: EfeitoAviso, ficha: Ficha): string {
  if (efeito === "fechado") return "O lugar vai aparecer FECHADO, e não por causa de chuva.";
  if (efeito === "frio") {
    const voz = vozDaFicha(ficha.condicao);
    return `O carimbo vai dizer "${falaMolhada(voz.severidade, voz.horasPassado).marca}".`;
  }
  if (efeito === "fresco") return `O carimbo vai dizer "Pode ir", mesmo se tiver chovido.`;
  return "O carimbo não muda — só o recado aparece na ficha.";
}

/** "Na tela agora: <marca>" — a MESMA pipeline que `ListaDeLugares` usa
 *  (`marcaAgora`, em `./marca-agora.ts`). A função morava aqui inteira até a
 *  Task 5 (2026-09-25), quando `/admin` virou lista: a extração é pra a lista
 *  e o painel do lugar nunca poderem discordar sobre o que está na tela
 *  agora — ver o porquê completo (calendário, dono, erro) no módulo extraído. */
function motorAgora(leitura: LeituraCarimbo, ficha: Ficha, agora: number): string {
  return `Na tela agora: ${marcaAgora(ficha, leitura, agora)}`;
}

function publicadoHa(criadoEm: number, agora: number): string {
  const dias = Math.floor((agora - criadoEm) / DIA);
  if (dias <= 0) return "publicado há menos de 1 dia";
  return `publicado há ${dias} dia${dias === 1 ? "" : "s"}`;
}

type EstadoForm = {
  texto: string;
  efeito: EfeitoAviso;
  prazoSegundos: number;
  enviando: boolean;
  erro: string | null;
};

function formInicial(): EstadoForm {
  return { texto: "", efeito: "nenhum", prazoSegundos: ATALHOS[0].segundos, enviando: false, erro: null };
}

type Props = {
  ficha: Ficha;
  leitura: LeituraCarimbo;
  agora: number;
  /** Row do banco, com `id` — a `Aviso` que viaja na leitura não tem id de
   *  propósito (ver `src/lib/aviso.ts`); é por isso que o painel recebe este
   *  prop a mais, só pra poder mandar o `DELETE ?id=`. */
  aviso?: AvisoLinha;
  /** A leitura do aviso vigente falhou no servidor — banco fora do ar não
   *  pode derrubar o painel, só avisar em uma linha curta. */
  avisoErro?: boolean;
};

/** O painel do dono: UM lugar (Task 5, 2026-09-25 — antes servia o acervo
 *  inteiro numa tela só; `/admin` virou lista, e cada item leva a
 *  `/admin/<slug>`, que é quem monta este componente hoje), com o que o motor
 *  diz agora, o aviso vigente (se houver) e o formulário pra publicar um
 *  novo. */
export default function PainelAdmin({ ficha, leitura, agora, aviso, avisoErro = false }: Props) {
  const [form, setForm] = useState<EstadoForm>(formInicial());

  function atualizar(patch: Partial<EstadoForm>) {
    setForm((atual) => ({ ...atual, ...patch }));
  }

  async function publicar() {
    const texto = form.texto.trim();
    if (texto === "" || form.enviando) return;
    atualizar({ enviando: true, erro: null });
    try {
      const r = await fetch("/api/admin/aviso", {
        method: "POST",
        body: JSON.stringify({ slug: ficha.slug, texto, efeito: form.efeito, venceEm: agora + form.prazoSegundos }),
      });
      if (r.ok) { location.reload(); return; }
      atualizar({ erro: "Não consegui publicar." });
    } catch {
      atualizar({ erro: "Sem rede." });
    } finally {
      atualizar({ enviando: false });
    }
  }

  async function tirar(id: number) {
    atualizar({ enviando: true, erro: null });
    try {
      const r = await fetch(`/api/admin/aviso?id=${id}`, { method: "DELETE" });
      if (r.ok) { location.reload(); return; }
      atualizar({ erro: "Não consegui tirar o aviso." });
    } catch {
      atualizar({ erro: "Sem rede." });
    } finally {
      atualizar({ enviando: false });
    }
  }

  const venceEmBreve = aviso != null && aviso.vence_em - agora <= VENCE_EM_BREVE_SEGUNDOS;

  return (
    <div className="adm-painel">
      {avisoErro && (
        <p className="adm-erro" role="alert">
          {AVISO_ERRO_LEITURA}
        </p>
      )}
      <section
        className="adm-ficha"
        data-ficha={ficha.slug}
        {...(venceEmBreve ? { "data-vence-em-breve": "" } : {})}
      >
        <h2>{ficha.trajeto.waypoints[0].nome}</h2>
        <p className="adm-motor">{motorAgora(leitura, ficha, agora)}</p>

        {aviso && (
          <div className="adm-vigente">
            <p className="adm-vigente-texto">{aviso.texto}</p>
            <p className="adm-vigente-meta">{publicadoHa(aviso.criado_em, agora)}</p>
            <button type="button" data-tirar={ficha.slug} onClick={() => tirar(aviso.id)}>
              Tirar
            </button>
          </div>
        )}

        <label className="adm-rotulo">
          Aviso
          <textarea
            data-slug={ficha.slug}
            value={form.texto}
            onChange={(e) => atualizar({ texto: e.target.value })}
          />
        </label>

        <label className="adm-rotulo">
          Efeito
          <select
            data-efeito={ficha.slug}
            value={form.efeito}
            onChange={(e) => atualizar({ efeito: e.target.value as EfeitoAviso })}
          >
            {EFEITOS.map((efeito) => (
              <option key={efeito} value={efeito}>{efeito}</option>
            ))}
          </select>
        </label>

        <label className="adm-rotulo">
          Prazo
          <select
            data-prazo={ficha.slug}
            value={form.prazoSegundos}
            onChange={(e) => atualizar({ prazoSegundos: Number(e.target.value) })}
          >
            {ATALHOS.map((a) => (
              <option key={a.rotulo} value={a.segundos}>{a.rotulo}</option>
            ))}
          </select>
        </label>

        <p className="adm-consequencia">{consequencia(form.efeito, ficha)}</p>

        <button
          type="button"
          data-publicar={ficha.slug}
          disabled={form.texto.trim() === "" || form.enviando}
          onClick={() => publicar()}
        >
          {form.enviando ? "Publicando…" : "Publicar"}
        </button>

        {form.erro && <p className="adm-erro" role="alert">{form.erro}</p>}
      </section>
    </div>
  );
}
