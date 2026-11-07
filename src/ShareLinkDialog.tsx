import { t as tr } from "./i18n";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { publishShare, type ShareDraft } from "./public-sharing";
import {
  sharedPageUrl,
  shareCard,
  copyShareLink,
  shareMessage,
} from "./sharing";
import { LoaderCircle, ShareIcon } from "./icons";
export default function ShareLinkDialog({
  draft,
  close,
  toast,
}: {
  draft: ShareDraft;
  close: () => void;
  toast: (s: string) => void;
}) {
  const [link, setLink] = useState<ShareDraft | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setError("");
    setLink(null);
    publishShare(draft)
      .then((page) => {
        if (active) setLink({ ...draft, url: sharedPageUrl(page.id) });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [draft, retry]);
  async function send(copy: boolean) {
    if (!link || busy) return;
    setBusy(true);
    try {
      toast(shareMessage(await (copy ? copyShareLink(link) : shareCard(link))));
    } catch {
      toast(tr("Impossible de partager ce lien. Réessayez."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label={tr("Partager un lien public")} close={close}>
      <div className="form-content share-link-panel">
        <h2>
          {tr("Partager ")}
          {draft.kind === "profile" ? tr("mon profil") : tr("cet avis")}
        </h2>
        <p className="muted">
          {tr("Ce lien est accessible sans compte. Il contient uniquement")}{" "}
          {draft.kind === "profile"
            ? tr(
                "votre nom public, votre avatar, votre bio, vos favoris et vos statistiques résumées",
              )
            : tr("cet avis, sa note et votre profil public")}
          {tr(". Vous pourrez le retirer dans les réglages.")}
        </p>
        {!link && !error && (
          <p role="status">
            <LoaderCircle className="spin" size={18} />{" "}
            {tr(" Préparation du lien…")}
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            <p>{tr(error)}</p>
            <button onClick={() => setRetry((n) => n + 1)}>
              {tr("Réessayer")}
            </button>
          </div>
        )}
        {link && (
          <>
            <label className="field">
              {tr("Lien public")}
              <input
                readOnly
                value={link.url}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="share-link-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => send(false)}
              >
                <ShareIcon size={18} /> {tr(" Partager le lien")}
              </button>
              <button
                className="button tonal"
                disabled={busy}
                onClick={() => send(true)}
              >
                {tr("Copier le lien")}
              </button>
            </div>
            <p className="muted fine">
              {tr(
                "La page reflète le contenu au moment du partage. Partagez à nouveau pour la mettre à jour : le lien reste identique.",
              )}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
