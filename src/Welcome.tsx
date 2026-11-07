import { useEffect, useId, useRef, useState } from "react";
import { Brand } from "./Brand";
import Avatar from "./Avatar";
import AuthForm, { type AuthResult } from "./AuthForm";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Heart,
  Play,
  Star,
} from "./icons";

const slides = [
  {
    label: "Découvrir",
    title: "Films et séries, au même endroit.",
    text: "Explorez le catalogue, les acteurs et les plateformes disponibles dans votre pays.",
  },
  {
    label: "Pour vous",
    title: "Des recommandations selon vos goûts.",
    text: "Vos notes, coups de cœur et titres passés affinent votre sélection. Double-tapez pour ajouter à « À voir ».",
  },
  {
    label: "Votre collection",
    title: "Vos envies, vos notes, vos avis.",
    text: "Créez votre profil et retrouvez votre collection sur vos appareils grâce aux sauvegardes de votre compte.",
  },
];
function Preview({ step }: { step: number }) {
  return (
    <div className={`welcome-art welcome-art-${step}`} aria-hidden="true">
      <div className="welcome-orbit" />
      {step === 0 ? (
        <div className="welcome-posters">
          <div className="welcome-poster poster-one">
            <span className="poster-moon" />
            <span className="poster-landscape" />
            <Play size={38} />
          </div>
          <div className="welcome-poster poster-two">
            <span className="poster-rings" />
            <span className="poster-landscape" />
            <Play size={38} />
          </div>
          <div className="welcome-mini-label">
            <Check size={16} /> Catalogue films & séries
          </div>
        </div>
      ) : step === 1 ? (
        <div className="welcome-feed-preview">
          <div className="welcome-poster poster-two">
            <span className="poster-rings" />
            <span className="poster-landscape" />
            <span className="welcome-preview-tag">Pour vous</span>
            <div className="welcome-preview-actions">
              <span>
                <Heart size={23} />
              </span>
              <span>
                <Bookmark size={23} />
              </span>
            </div>
          </div>
          <div className="welcome-like">
            <Bookmark size={24} fill="currentColor" />
          </div>
        </div>
      ) : (
        <div className="welcome-profile-preview">
          <Avatar
            profile={{ avatar: "cool", background: "theme" }}
            name="Vela"
            size={80}
          />
          <div className="welcome-preview-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={22} fill="currentColor" />
            ))}
          </div>
          <div className="welcome-mini-shelf">
            <span>
              <Bookmark size={23} /> À voir
            </span>
            <span>
              <Heart size={23} /> Favoris
            </span>
          </div>
          <div className="welcome-mini-label">
            <Check size={16} /> Sauvegardé sur votre compte
          </div>
        </div>
      )}
    </div>
  );
}
export default function Welcome({
  finish,
  backHandler,
}: {
  finish: () => void;
  backHandler: { current: () => boolean };
}) {
  const [step, setStep] = useState(0),
    [mode, setMode] = useState<"intro" | "signin" | "signup" | "confirm">(
      "intro",
    ),
    [confirmationEmail, setConfirmationEmail] = useState("");
  const heading = useRef<HTMLHeadingElement>(null),
    tabs = useRef<HTMLDivElement>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    id = useId();
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [mode]);
  useEffect(() => {
    backHandler.current = () => {
      if (mode !== "intro") {
        setMode("intro");
        return true;
      }
      if (step > 0) {
        setStep(step - 1);
        return true;
      }
      return false;
    };
    return () => {
      backHandler.current = () => false;
    };
  }, [mode, step, backHandler]);
  function authenticated(result: AuthResult) {
    if (result.needsConfirmation) {
      setConfirmationEmail(result.email);
      setMode("confirm");
    } else finish();
  }
  return (
    <main className="welcome-page" aria-label="Bienvenue dans Vela">
      <div className="welcome-shell">
        <header className="welcome-header">
          <span className="welcome-brand" aria-label="Vela">
            <Brand />
          </span>
          {mode !== "intro" && (
            <button className="text-button" onClick={() => setMode("intro")}>
              <ArrowLeft size={18} /> Présentation
            </button>
          )}
        </header>
        {mode === "intro" ? (
          <div className="welcome-layout">
            <div
              className="welcome-carousel"
              onPointerDown={(event) => {
                start.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => {
                const p = start.current;
                start.current = null;
                if (
                  p &&
                  Math.abs(event.clientY - p.y) < 50 &&
                  Math.abs(event.clientX - p.x) > 60
                )
                  setStep((s) =>
                    Math.max(
                      0,
                      Math.min(2, s + (event.clientX < p.x ? 1 : -1)),
                    ),
                  );
              }}
              onPointerCancel={() => {
                start.current = null;
              }}
            >
              <div
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-tab-${step}`}
                className="welcome-slide"
                key={step}
              >
                <Preview step={step} />
                <h2>{slides[step].title}</h2>
                <p>{slides[step].text}</p>
              </div>
              <div className="welcome-pagination">
                <div
                  ref={tabs}
                  role="tablist"
                  aria-label="Présentation des fonctionnalités"
                  onKeyDown={(event) => {
                    let next = step;
                    if (event.key === "ArrowRight") next = (step + 1) % 3;
                    else if (event.key === "ArrowLeft") next = (step + 2) % 3;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = 2;
                    else return;
                    event.preventDefault();
                    setStep(next);
                    tabs.current
                      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                      [next]?.focus();
                  }}
                >
                  {slides.map((slide, i) => (
                    <button
                      key={slide.label}
                      role="tab"
                      id={`${id}-tab-${i}`}
                      aria-label={slide.label}
                      aria-selected={step === i}
                      aria-controls={`${id}-panel`}
                      tabIndex={step === i ? 0 : -1}
                      onClick={() => setStep(i)}
                    >
                      <span />
                    </button>
                  ))}
                </div>
                <button
                  className="welcome-next text-button"
                  onClick={() => setStep((step + 1) % 3)}
                  aria-label="Fonctionnalité suivante"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
            <section className="welcome-entry" aria-label="Commencer avec Vela">
              <h1 ref={heading} tabIndex={-1}>
                Bienvenue dans Vela.
              </h1>
              <p className="muted">
                Connectez-vous pour retrouver votre profil, ou créez votre
                compte gratuitement.
              </p>
              <div className="welcome-entry-actions">
                <button
                  className="button primary"
                  onClick={() => setMode("signup")}
                >
                  Créer un compte
                  <ArrowRight size={18} />
                </button>
                <button
                  className="button tonal"
                  onClick={() => setMode("signin")}
                >
                  Se connecter
                </button>
              </div>
              <button className="text-button welcome-guest" onClick={finish}>
                Explorer sans compte
              </button>
              <small className="muted">
                Le catalogue est accessible sans compte.
              </small>
            </section>
          </div>
        ) : mode === "confirm" ? (
          <section className="welcome-confirm" aria-live="polite">
            <span className="welcome-confirm-icon">
              <Check size={30} />
            </span>
            <h1 ref={heading} tabIndex={-1}>
              Vérifiez votre boîte mail.
            </h1>
            <p>
              Un lien de confirmation a été demandé pour{" "}
              <strong>{confirmationEmail}</strong>. Consultez aussi vos
              courriers indésirables.
            </p>
            <p className="muted">
              Après confirmation, revenez ici pour vous connecter.
            </p>
            <button
              className="button primary"
              onClick={() => setMode("signin")}
            >
              Se connecter
            </button>
            <button className="text-button" onClick={finish}>
              Explorer en attendant
            </button>
          </section>
        ) : (
          <section className="welcome-auth">
            <h1 className="sr-only" ref={heading} tabIndex={-1}>
              Votre compte Vela
            </h1>
            <AuthForm
              key={mode}
              initialMode={mode}
              initialEmail={confirmationEmail}
              success={authenticated}
            />
            <button className="text-button welcome-guest" onClick={finish}>
              Explorer sans compte
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
