import { t as tr } from "./i18n";
/** Original wordmark treatment, with a point in the selected accent colour. */
export function Brand() {
  return (
    <>
      <span className="brand-word">vela</span>
      <span className="brand-dot" aria-hidden="true" />
    </>
  );
}
export function SettingsFooter() {
  return (
    <footer
      className="settings-footer"
      role="contentinfo"
      aria-label={tr("À propos de Vela")}
    >
      <div className="settings-brand">
        <span className="footer-brand" aria-label="Vela">
          <Brand />
        </span>
      </div>
      <div className="company-endorsement">
        <span className="cax-logo">
          <img src="./brand/cax-corporation.png" alt="CAX Corporation" />
        </span>
        <span>A CAX Corporation company</span>
      </div>
      <p className="ai-development-credit">
        <span>{tr("Développé avec l’aide de l’IA")}</span>
        {tr("ChatGPT a été utilisé pour accompagner le développement de Vela.")}
      </p>
      <p className="catalog-attribution">
        {tr("Catalogue :")}{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          TMDB
        </a>{" "}
        {tr("(si activé),")}{" "}
        <a
          href="https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/"
          target="_blank"
          rel="noreferrer"
        >
          iTunes
        </a>{" "}
        {tr("et")}{" "}
        <a href="https://www.tvmaze.com/api" target="_blank" rel="noreferrer">
          TVmaze
        </a>{" "}
        (CC BY-SA).
        <br />
        This product uses the TMDB API but is not endorsed or certified by TMDB.
        <br />
        {tr("Les affiches appartiennent à leurs ayants droit.")}
      </p>
    </footer>
  );
}
