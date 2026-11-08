import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Avatar from "./Avatar";
import Modal from "./Modal";
import { LoaderCircle, ShareIcon } from "./icons";
import { t as tr } from "./i18n";
import {
  prepareStoryAssets,
  renderStory,
  type StoryAssets,
  type StoryDraft,
  type StoryStyle,
} from "./story-image";
import {
  saveStory,
  sendStory,
  storyBase64,
  storyFilename,
  supportsStoryShare,
} from "./story-export";
import {
  copyShareLink,
  reviewShare,
  sharedPageUrl,
  titleShare,
} from "./sharing";
import { publishShare } from "./public-sharing";
import "./stories.css";

export default function StoryShareDialog({
  draft,
  close,
  toast,
}: {
  draft: StoryDraft;
  close: () => void;
  toast: (text: string) => void;
}) {
  const [format, setFormat] = useState<StoryStyle>("poster"),
    [retry, setRetry] = useState(0);
  const [ready, setReady] = useState<{
    file: File;
    png: string;
    preview: string;
    truncated: boolean;
    missingPoster: boolean;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const avatar = useRef<HTMLDivElement>(null),
    assets = useRef<Promise<StoryAssets> | null>(null),
    alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true,
      preview = "";
    setReady(null);
    setError("");
    const node = avatar.current?.querySelector<HTMLElement>(".preset-avatar");
    if (!node) return;
    assets.current ||= prepareStoryAssets(draft, node);
    assets.current
      .then(async (data) => {
        const result = await renderStory(draft, data, format);
        const png = Capacitor.isNativePlatform()
          ? await storyBase64(result.blob)
          : "";
        if (!active) return;
        preview = URL.createObjectURL(result.blob);
        setReady({
          file: new File([result.blob], storyFilename(draft.entry.title.name), {
            type: "image/png",
          }),
          png,
          preview,
          truncated: result.truncated,
          missingPoster: data.missingPoster,
        });
      })
      .catch(() => {
        if (active) setError(tr("Impossible de préparer le visuel."));
      });
    return () => {
      active = false;
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [draft, format, retry]);
  async function act(action: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const message = await action();
      if (alive.current && message) toast(message);
    } catch {
      if (alive.current)
        toast(
          tr("Le partage n’a pas abouti. Réessayez ou enregistrez le visuel."),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function copyLink() {
    let link = titleShare(draft.entry.title);
    if (draft.entry.review.trim()) {
      link = reviewShare(draft.profile, draft.entry);
      const page = await publishShare(link);
      link = { ...link, url: sharedPageUrl(page.id) };
    }
    await copyShareLink(link);
    return tr("Lien copié. Ajoutez-le avec l’autocollant Lien d’Instagram.");
  }
  return (
    <Modal
      label={tr("Partager en story")}
      close={close}
      wide
      overlayClassName="story-overlay"
    >
      <div className="story-panel">
        <div className="story-avatar-source" ref={avatar} aria-hidden="true">
          <Avatar
            profile={draft.profile}
            name={draft.profile.displayName || "V"}
            size={100}
          />
        </div>
        <div className="story-preview" aria-busy={!ready && !error}>
          {ready ? (
            <img
              src={ready.preview}
              alt={tr("Aperçu de la story pour {0}", draft.entry.title.name)}
            />
          ) : (
            <p role="status">
              <LoaderCircle className="spin" size={22} />
              {error || tr("Préparation du visuel…")}
            </p>
          )}
        </div>
        <div className="story-controls">
          <h2>{tr("Partager en story")}</h2>
          <p className="muted">
            {tr("Votre affiche, votre note, votre signature.")}
          </p>
          <div
            className="story-formats"
            role="group"
            aria-label={tr("Format de la story")}
          >
            <button
              disabled={busy}
              aria-pressed={format === "poster"}
              onClick={() => setFormat("poster")}
            >
              {tr("Affiche et note")}
            </button>
            {draft.entry.review.trim() && (
              <button
                disabled={busy}
                aria-pressed={format === "review"}
                onClick={() => setFormat("review")}
              >
                {tr("Avec un extrait")}
              </button>
            )}
          </div>
          {ready?.truncated && (
            <p className="fine muted">
              {tr(
                "Un extrait est affiché. Votre avis complet reste accessible par lien.",
              )}
            </p>
          )}
          {(error || ready?.missingPoster) && (
            <div className="story-warning">
              <p>
                {error ||
                  tr(
                    "L’affiche n’a pas pu être chargée. Vous pouvez réessayer.",
                  )}
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  assets.current = null;
                  setRetry((n) => n + 1);
                }}
              >
                {tr("Réessayer")}
              </button>
            </div>
          )}
          {Capacitor.isNativePlatform() && (
            <>
              <button
                className="button primary"
                disabled={!ready || busy}
                onClick={() =>
                  ready && act(() => sendStory(ready.file, ready.png, true))
                }
              >
                <ShareIcon size={18} />
                {tr("Partager sur Instagram")}
              </button>
              <p className="fine muted">
                {tr(
                  "Choisissez « Story » si Instagram vous propose plusieurs destinations.",
                )}
              </p>
            </>
          )}
          {(!ready || supportsStoryShare(ready.file)) && (
            <button
              className={
                Capacitor.isNativePlatform() ? "button tonal" : "button primary"
              }
              disabled={!ready || busy}
              onClick={() =>
                ready && act(() => sendStory(ready.file, ready.png))
              }
            >
              <ShareIcon size={18} />
              {tr("Partager le visuel")}
            </button>
          )}
          <button
            className="button tonal"
            disabled={!ready || busy}
            onClick={() => ready && act(() => saveStory(ready.file, ready.png))}
          >
            {tr("Enregistrer le visuel")}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => act(copyLink)}
          >
            {draft.entry.review.trim()
              ? tr("Copier le lien de l’avis")
              : tr("Copier le lien du film ou de la série")}
          </button>
          <p className="fine muted">
            {draft.entry.review.trim()
              ? tr(
                  "Ce bouton crée un lien public vers votre avis. Ajoutez-le avec l’autocollant Lien d’Instagram.",
                )
              : tr("Ajoutez ce lien avec l’autocollant Lien d’Instagram.")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
