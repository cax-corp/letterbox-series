import { useEffect, useRef, useState } from "react";
import {
  decodeProfilePhoto,
  encodeProfilePhoto,
  paintPhotoCrop,
  type PhotoCrop,
} from "./profile-photo";
import Modal from "./Modal";
import { t as tr } from "./i18n";
import "./profile-photo.css";

type Decoded = Awaited<ReturnType<typeof decodeProfilePhoto>>;
export default function ProfilePhotoPicker({
  photo,
  change,
}: {
  photo?: string;
  change: (photo?: string) => void;
}) {
  const [image, setImage] = useState<Decoded | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [crop, setCrop] = useState<PhotoCrop>({ zoom: 1, x: 0, y: 0 });
  const input = useRef<HTMLInputElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    generation = useRef(0),
    drag = useRef<{ x: number; y: number; crop: PhotoCrop } | null>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => () => image?.close?.(), [image]);
  useEffect(() => {
    if (image && canvas.current) paintPhotoCrop(canvas.current, image, crop);
  }, [image, crop]);
  return (
    <div className="profile-photo-picker">
      <input
        className="sr-only"
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={tr("Choisir une photo de profil")}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const request = ++generation.current;
          setLoading(true);
          setError("");
          try {
            const decoded = await decodeProfilePhoto(file);
            if (request !== generation.current) {
              decoded.close?.();
              return;
            }
            setCrop({ zoom: 1, x: 0, y: 0 });
            setImage(decoded);
          } catch (e) {
            if (request === generation.current)
              setError(
                e instanceof Error
                  ? e.message
                  : tr(
                      "Cette image ne peut pas être ouverte. Essayez une autre photo.",
                    ),
              );
          } finally {
            if (request === generation.current) setLoading(false);
          }
        }}
      />
      <div className="profile-photo-actions">
        <button
          className="button tonal"
          type="button"
          disabled={loading}
          onClick={() => input.current?.click()}
        >
          {loading
            ? tr("Ouverture de l’image…")
            : photo
              ? tr("Changer ma photo")
              : tr("Importer une photo")}
        </button>
        {photo && (
          <button
            className="text-button"
            type="button"
            onClick={() => change(undefined)}
          >
            {tr("Retirer ma photo")}
          </button>
        )}
      </div>
      <p className="fine muted">
        {tr(
          "JPEG, PNG ou WebP · 12 Mo maximum. La photo est recadrée et compressée avant l’envoi.",
        )}
      </p>
      {error && !image && (
        <p className="error" role="alert">
          {tr(error)}
        </p>
      )}
      {image && (
        <Modal
          label={tr("Recadrer ma photo")}
          close={() => setImage(null)}
          overlayClassName="photo-crop-overlay"
        >
          <div className="photo-crop-panel">
            {error && (
              <p className="error" role="alert">
                {tr(error)}
              </p>
            )}
            <h2>{tr("Recadrer ma photo")}</h2>
            <p className="muted">
              {tr("Déplacez la photo et ajustez le zoom.")}
            </p>
            <canvas
              ref={canvas}
              width={320}
              height={320}
              className="photo-crop-preview"
              aria-label={tr("Aperçu du recadrage")}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, y: event.clientY, crop };
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                const size = event.currentTarget.getBoundingClientRect().width,
                  scale =
                    Math.max(size / image.width, size / image.height) *
                    crop.zoom;
                const width = image.width * scale,
                  height = image.height * scale,
                  start = drag.current;
                const clamp = (n: number) => Math.min(1, Math.max(-1, n));
                setCrop({
                  ...start.crop,
                  x:
                    width > size + 0.1
                      ? clamp(
                          start.crop.x +
                            (2 * (event.clientX - start.x)) / (width - size),
                        )
                      : 0,
                  y:
                    height > size + 0.1
                      ? clamp(
                          start.crop.y +
                            (2 * (event.clientY - start.y)) / (height - size),
                        )
                      : 0,
                });
              }}
            />
            <label className="field">
              {tr("Zoom")}
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={crop.zoom}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))
                }
              />
            </label>
            <div className="photo-crop-position">
              <label className="field">
                {tr("Position horizontale")}
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={crop.x}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, x: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="field">
                {tr("Position verticale")}
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={crop.y}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, y: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
            <div className="profile-photo-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  try {
                    change(encodeProfilePhoto(image, crop));
                    setImage(null);
                    setError("");
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : tr(
                            "La photo ne peut pas être compressée. Essayez une autre image.",
                          ),
                    );
                  }
                }}
              >
                {tr("Utiliser cette photo")}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setImage(null)}
              >
                {tr("Annuler")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
