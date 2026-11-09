import { useState } from "react";
import { t as tr } from "./i18n";
export default function SpoilerText({
  text,
  spoiler = false,
  protect = true,
}: {
  text: string;
  spoiler?: boolean;
  protect?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  if (spoiler && protect && !revealed)
    return (
      <div className="spoiler-cover">
        <strong>{tr("Cet avis contient des spoilers")}</strong>
        <button className="button tonal" onClick={() => setRevealed(true)}>
          {tr("Afficher l’avis")}
        </button>
      </div>
    );
  return (
    <div className="spoiler-content">
      {spoiler && <span className="spoiler-badge">{tr("Spoilers")}</span>}
      <p>{text}</p>
      {spoiler && protect && (
        <button className="text-button" onClick={() => setRevealed(false)}>
          {tr("Masquer l’avis")}
        </button>
      )}
    </div>
  );
}
