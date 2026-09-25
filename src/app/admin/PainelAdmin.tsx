"use client";
import { useState } from "react";
import type { Ficha } from "@/types/ficha";
import type { LeituraCarimbo } from "@/lib/carimbo-estado";
import type { AvisoLinha, EfeitoAviso } from "@/lib/db";
import { falaMolhada, vozDaFicha } from "@/lib/severidade";
import { faseDe, marcaDe } from "@/lib/carimbo-fase";
import { fechadoPeloDono } from "@/lib/aviso";
import { aberturaDaFicha, agoraRecife, fechadoAgora } from "@/lib/horario";

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

/** O que está NA TELA agora, pro dono — byte a byte a mesma palavra que o
 *  selo público (`SeloTrilha`) diria NO INSTANTE em que a página foi lida,
 *  calendário incluso: mesma fonte (`faseDe`/`marcaDe` em `carimbo-fase.ts`),
 *  nunca uma tabela paralela escrita aqui. Foi o defeito desta função na
 *  Task 10 original: "Não vá" fixo pra todo `frio`, quando a fala real de
 *  `frio` depende da severidade da ficha (`espera`/`cuidado` falam outra
 *  coisa) — a mesma "voz de um lugar virou a língua de todos" que
 *  `severidade.ts` já fechou uma vez.
 *
 *  🔴 O CALENDÁRIO ENTRA, e a rodada anterior deste arquivo errou dizendo que
 *  "o servidor não tem relógio de tela" — falso: `agora` já chega por prop
 *  (`page.tsx` o computa com `Date.now()` no load), e `horario.ts` expõe
 *  `agoraRecife`/`aberturaDaFicha`/`fechadoAgora` puros, sem precisar do
 *  `useAgoraRecife` do CLIENTE (esse sim é o "relógio de tela": o hook que
 *  bate a cada minuto na tela viva). O painel é um retrato de um instante —
 *  ele recarrega a página depois de cada ação —, então o instante do retrato
 *  É o relógio certo pra esta tela: sem ele, a Rampa do Pepê apareceria
 *  "Pode ir" numa quarta no painel do dono enquanto a tela pública diz
 *  "Fechado agora".
 *
 *  `erro` não precisa de ramo próprio: `faseDe` já o transforma em
 *  `sem-informacoes`, e é `marcaDe` quem decide a palavra ("SEM
 *  INFORMAÇÕES") — vocabulário único, nunca dois. */
function motorAgora(leitura: LeituraCarimbo, ficha: Ficha, agora: number): string {
  const fase = faseDe({
    conferindo: false,
    erro: leitura.erro,
    venceu: false,
    falhou: false,
    fechado: fechadoAgora(aberturaDaFicha(ficha), agoraRecife(agora)),
    // O instante do retrato também decide o prazo do aviso — o mesmo `agora`.
    fechadoPeloDono: fechadoPeloDono(leitura.aviso, agora),
  });
  return `Na tela agora: ${marcaDe(fase, leitura.estado, vozDaFicha(ficha.condicao))}`;
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
  fichas: Ficha[];
  leituras: Record<string, LeituraCarimbo>;
  agora: number;
  /** Row do banco, com `id` — a `Aviso` que viaja pra ficha não tem id de
   *  propósito (ver `src/lib/aviso.ts`); é por isso que o painel recebe este
   *  prop a mais, só pra poder mandar o `DELETE ?id=`. */
  avisos?: Record<string, AvisoLinha>;
  /** A leitura dos avisos vigentes falhou no servidor — banco fora do ar não
   *  pode derrubar o painel, só avisar em uma linha curta. */
  avisosErro?: boolean;
};

/** O painel do dono: o acervo inteiro, cada ficha com o que o motor diz
 *  agora, o aviso vigente (se houver) e o formulário pra publicar um novo. */
export default function PainelAdmin({ fichas, leituras, agora, avisos = {}, avisosErro = false }: Props) {
  const [formularios, setFormularios] = useState<Record<string, EstadoForm>>(() =>
    Object.fromEntries(fichas.map((f) => [f.slug, formInicial()])),
  );

  function atualizar(slug: string, patch: Partial<EstadoForm>) {
    setFormularios((atual) => ({ ...atual, [slug]: { ...atual[slug], ...patch } }));
  }

  async function publicar(slug: string) {
    const f = formularios[slug];
    const texto = f.texto.trim();
    if (texto === "" || f.enviando) return;
    atualizar(slug, { enviando: true, erro: null });
    try {
      const r = await fetch("/api/admin/aviso", {
        method: "POST",
        body: JSON.stringify({ slug, texto, efeito: f.efeito, venceEm: agora + f.prazoSegundos }),
      });
      if (r.ok) { location.reload(); return; }
      atualizar(slug, { erro: "Não consegui publicar." });
    } catch {
      atualizar(slug, { erro: "Sem rede." });
    } finally {
      atualizar(slug, { enviando: false });
    }
  }

  async function tirar(slug: string, id: number) {
    atualizar(slug, { enviando: true, erro: null });
    try {
      const r = await fetch(`/api/admin/aviso?id=${id}`, { method: "DELETE" });
      if (r.ok) { location.reload(); return; }
      atualizar(slug, { erro: "Não consegui tirar o aviso." });
    } catch {
      atualizar(slug, { erro: "Sem rede." });
    } finally {
      atualizar(slug, { enviando: false });
    }
  }

  return (
    <div className="adm-painel">
      {avisosErro && (
        <p className="adm-erro" role="alert">
          Não consegui ler os avisos publicados — a lista abaixo pode estar incompleta.
        </p>
      )}
      {fichas.map((f) => {
        const form = formularios[f.slug];
        const leitura = leituras[f.slug];
        const avisoAtual = avisos[f.slug];
        const venceEmBreve = avisoAtual != null && avisoAtual.vence_em - agora <= VENCE_EM_BREVE_SEGUNDOS;
        return (
          <section
            key={f.slug}
            className="adm-ficha"
            data-ficha={f.slug}
            {...(venceEmBreve ? { "data-vence-em-breve": "" } : {})}
          >
            <h2>{f.trajeto.waypoints[0].nome}</h2>
            {leitura && <p className="adm-motor">{motorAgora(leitura, f, agora)}</p>}

            {avisoAtual && (
              <div className="adm-vigente">
                <p className="adm-vigente-texto">{avisoAtual.texto}</p>
                <p className="adm-vigente-meta">{publicadoHa(avisoAtual.criado_em, agora)}</p>
                <button type="button" data-tirar={f.slug} onClick={() => tirar(f.slug, avisoAtual.id)}>
                  Tirar
                </button>
              </div>
            )}

            <label className="adm-rotulo">
              Aviso
              <textarea
                data-slug={f.slug}
                value={form.texto}
                onChange={(e) => atualizar(f.slug, { texto: e.target.value })}
              />
            </label>

            <label className="adm-rotulo">
              Efeito
              <select
                data-efeito={f.slug}
                value={form.efeito}
                onChange={(e) => atualizar(f.slug, { efeito: e.target.value as EfeitoAviso })}
              >
                {EFEITOS.map((efeito) => (
                  <option key={efeito} value={efeito}>{efeito}</option>
                ))}
              </select>
            </label>

            <label className="adm-rotulo">
              Prazo
              <select
                data-prazo={f.slug}
                value={form.prazoSegundos}
                onChange={(e) => atualizar(f.slug, { prazoSegundos: Number(e.target.value) })}
              >
                {ATALHOS.map((a) => (
                  <option key={a.rotulo} value={a.segundos}>{a.rotulo}</option>
                ))}
              </select>
            </label>

            <p className="adm-consequencia">{consequencia(form.efeito, f)}</p>

            <button
              type="button"
              data-publicar={f.slug}
              disabled={form.texto.trim() === "" || form.enviando}
              onClick={() => publicar(f.slug)}
            >
              {form.enviando ? "Publicando…" : "Publicar"}
            </button>

            {form.erro && <p className="adm-erro" role="alert">{form.erro}</p>}
          </section>
        );
      })}
    </div>
  );
}
