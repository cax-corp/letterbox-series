import { t as tr } from "./i18n";
import { updateSystemAppearance } from "./appearance";
import { useTasteSound } from "./useTasteSound";
import { useTasteMusic } from "./useTasteMusic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "./icons";
import { buildTasteMap } from "./taste-map";
import StellarMap from "./StellarMap";
import { readSkipSignals } from "./implicit-feedback";
import type { Library } from "./store";
import type { Title } from "./catalog";
const bootSteps = [
  "Lecture de la bibliothèque locale",
  "Chargement de vos préférences mentales",
  "Connexion des affinités cinématographiques",
  "Cartographie prête à explorer",
];
export default function TasteMap({
  library,
  account,
  close,
  open,
}: {
  library: Library;
  account: string;
  close: () => void;
  open: (title: Title) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "boot" | "ready">("idle");
  const [step, setStep] = useState(0);
  const sound = useTasteSound();
  const music = useTasteMusic();
  const audioUnavailable = sound.unavailable && music.unavailable;
  const audioOn = sound.enabled && !audioUnavailable && !music.blocked;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const readyHeading = useRef<HTMLHeadingElement>(null);
  const immersive = phase !== "idle";
  useEffect(() => {
    if (!immersive) return;
    let active = true;
    document.body.classList.add("taste-terminal-active");
    const palette = () =>
      document.documentElement.dataset.colourTheme || "blue";
    void updateSystemAppearance(false, palette())
      .then(() => {
        if (active)
          document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", "#030916");
      })
      .catch(() => {});
    return () => {
      active = false;
      document.body.classList.remove("taste-terminal-active");
      void updateSystemAppearance(
        document.documentElement.dataset.theme === "light",
        palette(),
      ).catch(() => {});
    };
  }, [immersive]);
  useEffect(() => {
    if (phase !== "boot") return;
    const timers = bootSteps.slice(1).map((_, i) =>
      window.setTimeout(
        () => {
          setStep(i + 1);
          soundRef.current.play("step");
        },
        (i + 1) * 520,
      ),
    );
    timers.push(
      window.setTimeout(() => {
        setPhase("ready");
        soundRef.current.play("ready");
      }, 2200),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);
  useEffect(() => {
    if (phase === "ready") readyHeading.current?.focus({ preventScroll: true });
  }, [phase]);
  function launch() {
    music.enter(sound.enabled);
    sound.play("launch", true);
    setPhase(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "ready"
        : "boot",
    );
  }
  const [revision, setRevision] = useState(0),
    [pinned, setPinned] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const changed = (e: Event) => {
      if ((e as CustomEvent).detail === account) setRevision((n) => n + 1);
    };
    window.addEventListener("vela-taste-state", changed);
    return () => window.removeEventListener("vela-taste-state", changed);
  }, [account]);
  const map = useMemo(
    () => buildTasteMap(library, readSkipSignals(account), 300, pinned),
    [library, account, revision, pinned],
  );
  const soundButton = (
    <button
      className="atlas-sound"
      aria-label={tr("Son de la carte")}
      aria-pressed={audioOn}
      disabled={audioUnavailable}
      onClick={() => {
        if (music.blocked) {
          music.setEnabled(true);
          sound.play("select", true);
          return;
        }
        music.setEnabled(!sound.enabled);
        sound.toggle();
        if (!sound.enabled) sound.play("select", true);
      }}
    >
      <span aria-hidden="true">{audioOn ? "◖))" : "◖×"}</span>
      {audioUnavailable
        ? tr("Son indisponible")
        : music.blocked
          ? tr("Activer le son")
          : sound.enabled
            ? tr("Son activé")
            : tr("Son désactivé")}
    </button>
  );
  return (
    <section
      className={`taste-page page-section ${phase === "ready" ? "atlas-terminal atlas-stellar" : phase === "boot" ? "atlas-terminal" : "atlas-idle"}`}
      data-phase={phase}
      aria-label={tr("Carte de mes goûts")}
    >
      <header className="atlas-header">
        <button className="text-button settings-back" onClick={close}>
          <ArrowLeft size={20} />
          {tr("Retour aux réglages")}
        </button>
        <span className="atlas-wordmark" aria-hidden="true">
          vela<span>.</span> <small>/ STELLAR ATLAS</small>
        </span>
        {soundButton}
      </header>
      {phase === "idle" ? (
        <div className="atlas-launch">
          <div className="atlas-launch-orb" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
          </div>
          <span className="atlas-eyebrow">
            {tr("Module expérimental / 01")}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {tr("Carte de mes goûts")}
          </h1>
          <p>{tr("Vos films. Vos affinités. Une constellation à explorer.")}</p>
          <button className="button atlas-start" onClick={launch}>
            {tr("Démarrer la carte ")}
            <ArrowRight size={20} />
          </button>
          <div className="atlas-launch-stats">
            <span>
              <strong>{map.items.length}</strong> {tr(" titres personnels")}
            </span>
            <span>
              <strong>{map.edges.length}</strong> {tr(" connexions")}
            </span>
            <span>
              <strong>LOCAL</strong> {tr(" calcul sur cet appareil")}
            </span>
          </div>
          <p className="atlas-honesty">
            {tr(
              "Un décor de science-fiction, de vrais goûts. Les liens proviennent de vos titres, de leurs genres et de leurs synopsis. Aucune lecture de pensées, promis.",
            )}
          </p>
        </div>
      ) : phase === "boot" ? (
        <div className="atlas-boot">
          <div className="atlas-boot-target" aria-hidden="true">
            <i />
            <span>V</span>
          </div>
          <span className="atlas-eyebrow">
            {tr("Initialisation / Neural Atlas")}
          </span>
          <h1 ref={readyHeading} tabIndex={-1}>
            {tr("Connexion à votre univers")}
          </h1>
          <div
            className="atlas-progress"
            role="progressbar"
            aria-label={tr("Initialisation de la carte")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={(step + 1) * 25}
          >
            <i style={{ width: `${(step + 1) * 25}%` }} />
          </div>
          <div className="atlas-boot-readout">
            <span role="status">{tr(bootSteps[step])}</span>
            <strong>{String((step + 1) * 25).padStart(3, "0")}%</strong>
          </div>
          <div className="atlas-boot-log" aria-hidden="true">
            {bootSteps.map((label, i) => (
              <p key={label} className={i <= step ? "is-loaded" : ""}>
                <span>{i <= step ? "[ OK ]" : "[ -- ]"}</span> {tr(label)}
              </p>
            ))}
          </div>
          <p className="atlas-honesty">
            {tr(
              "Séquence d’ouverture visuelle · données déjà sur cet appareil.",
            )}
          </p>
          <button
            className="text-button"
            onClick={() => {
              setPhase("ready");
              sound.play("ready", true);
            }}
          >
            {tr("Passer l’intro ")}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <StellarMap
          map={map}
          pin={setPinned}
          open={open}
          play={() => sound.play("select", true)}
        />
      )}
    </section>
  );
}
