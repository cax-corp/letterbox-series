import { t as tr } from "./i18n";
import { Download, ArrowRight } from "./icons";

export default function WebRecommendationsNotice({
  explore,
  signIn,
}: {
  explore: () => void;
  signIn?: () => void;
}) {
  return (
    <section
      className="web-recommendations"
      aria-labelledby="web-recommendations-title"
    >
      <div className="web-recommendations-panel">
        <h1 id="web-recommendations-title">{tr("Pour vous")}</h1>
        <p>
          {tr(
            "Cette fonctionnalité est en cours de développement sur le web et n’est pas disponible pour le moment. Retrouvez vos recommandations personnalisées dans l’application mobile Vela.",
          )}
        </p>
        {signIn && (
          <p>
            {tr(
              "Un compte est nécessaire pour personnaliser vos recommandations dans l’application.",
            )}
          </p>
        )}
        <div className="web-recommendations-actions">
          {signIn && (
            <button className="button primary" onClick={signIn}>
              {tr("Se connecter")}
            </button>
          )}
          <a
            className="button primary"
            href={`${import.meta.env.BASE_URL}downloads/Vela-2.9.1.apk`}
            download="Vela-2.9.1.apk"
          >
            <Download size={19} /> {tr(" Télécharger pour Android")}
          </a>
          <button className="button tonal" onClick={explore}>
            {tr("Explorer le catalogue ")}
            <ArrowRight size={18} />
          </button>
        </div>
        <p className="fine">
          {tr(
            "APK Android · Version 2.9.1. L’application n’est pas encore disponible sur Google Play ou l’App Store.",
          )}
        </p>
      </div>
    </section>
  );
}
