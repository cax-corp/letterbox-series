import { Download, ArrowRight } from "./icons";

export default function WebRecommendationsNotice({
  explore,
}: {
  explore: () => void;
}) {
  return (
    <section
      className="web-recommendations"
      aria-labelledby="web-recommendations-title"
    >
      <div className="web-recommendations-panel">
        <h1 id="web-recommendations-title">Pour vous</h1>
        <p>
          Cette fonctionnalité est en cours de développement sur le web et n’est
          pas disponible pour le moment. Retrouvez vos recommandations
          personnalisées dans l’application mobile Vela.
        </p>
        <div className="web-recommendations-actions">
          <a
            className="button primary"
            href={`${import.meta.env.BASE_URL}downloads/Vela-2.0.0.apk`}
            download="Vela-2.0.0.apk"
          >
            <Download size={19} /> Télécharger pour Android
          </a>
          <button className="button tonal" onClick={explore}>
            Explorer le catalogue <ArrowRight size={18} />
          </button>
        </div>
        <p className="fine">
          APK Android · Version 2.0.0. L’application n’est pas encore disponible
          sur Google Play ou l’App Store.
        </p>
      </div>
    </section>
  );
}
