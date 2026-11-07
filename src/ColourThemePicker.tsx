import { t as tr } from "./i18n";
import { Capacitor } from "@capacitor/core";
import { colourThemes, type ColourTheme } from "./colour-themes";

function ThemeIcon({ preset }: { preset: ColourTheme }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="26" fill={preset.dark.bg} />
      <path d="M20 27H33L44 59L55 27H68L50 75H38Z" fill={preset.dark.text} />
      <path d="M87 27a7 7 0 1 0 -14 0a7 7 0 1 0 14 0Z" fill={preset.hex} />
    </svg>
  );
}

export default function ColourThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="colour-themes">
      <legend>{tr("Palette de couleurs")}</legend>
      <p className="muted">
        {tr(
          "Les fonds, boutons et le logo s’accordent à votre choix, en mode clair comme en mode sombre.",
        )}
      </p>
      <div className="colour-theme-grid">
        {colourThemes.map((p) => (
          <label className="colour-theme-option" key={p.id}>
            <input
              type="radio"
              name="colour-theme"
              value={p.id}
              checked={value === p.id}
              onChange={() => onChange(p.id)}
            />
            <span
              className="colour-theme-preview"
              style={{ background: p.dark.panel }}
            >
              <ThemeIcon preset={p} />
              <span className="colour-theme-swatches" aria-hidden="true">
                {[p.hex, p.dark.bg, p.light.bg].map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
            </span>
            <span className="colour-theme-name">{tr(p.name)}</span>
          </label>
        ))}
      </div>
      <p className="muted fine">
        {tr("Choix mémorisé sur cet appareil.")}
        {Capacitor.isNativePlatform()
          ? tr(
              " L’icône Android sera mise à jour au retour à l’écran d’accueil. Les icônes thématiques du système gardent les couleurs choisies par Android.",
            )
          : tr(" L’icône de l’onglet suit aussi la palette.")}
      </p>
    </fieldset>
  );
}
