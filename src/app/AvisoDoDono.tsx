import type { Aviso } from "@/lib/aviso";

/** Quantos dias inteiros separam os dois instantes. */
function diasDesde(criadoEm: number, agora: number): number {
  return Math.floor((agora - criadoEm) / 86400);
}

function quando(dias: number): string {
  if (dias <= 0) return "publicado hoje";
  if (dias === 1) return "publicado há 1 dia";
  return `publicado há ${dias} dias`;
}

/** O recado do DONO sobre este lugar.
 *
 *  🔴 BLOCO PRÓPRIO, e nunca a marca da `voz`: a voz é de quem conhece o lugar
 *  e é verdade parada; isto é o dono falando de AGORA, e vence. Misturar as
 *  duas apagaria a distinção de procedência sobre a qual este app inteiro se
 *  apoia — a mesma que já falhou uma vez, em setembro.
 *
 *  A data não é enfeite: recado sem quando é recado que a pessoa não sabe se
 *  ainda vale. */
export default function AvisoDoDono({ aviso, agora }: { aviso: Aviso | null; agora: number }) {
  if (!aviso) return null;
  return (
    <div className="aviso-dono">
      <p className="aviso-dono-txt">{aviso.texto}</p>
      <span className="aviso-dono-quando">{quando(diasDesde(aviso.criadoEm, agora))}</span>
    </div>
  );
}
