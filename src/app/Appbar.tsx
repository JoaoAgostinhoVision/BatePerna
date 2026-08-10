/** A marca é a única saída do app instalado. Em tela cheia não existe barra
 *  de URL: sem esta porta, "abrir na última ficha" vira cárcere. */
export default function Appbar({
  chip,
  comSaida = true,
}: {
  chip?: string;
  comSaida?: boolean;
}) {
  const miolo = (
    <>
      <span className="mk">🥾</span> BatePerna
    </>
  );
  return (
    <div className="appbar">
      {comSaida ? (
        <a className="brand" href="/trilhas" aria-label="Ver todas as trilhas">
          {miolo}
        </a>
      ) : (
        <div className="brand">{miolo}</div>
      )}
      {chip && <span className="cost-chip">{chip}</span>}
    </div>
  );
}
