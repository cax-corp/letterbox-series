import { t as tr, recommendationReason } from "./i18n";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { LocalRanker } from "./local-ranker";
import { Capacitor } from "@capacitor/core";
import { readSkipSignals } from "./implicit-feedback";
import { useSkipFeedback } from "./useSkipFeedback";
import { useCardSnap } from "./useCardSnap";
import { useFeedMotion } from "./useFeedMotion";
import { toneStyle, useArtworkTone } from "./useArtworkTone";
import {
  dailyExclusion,
  localDay,
  readFeedTrail,
  rememberSuggestion,
} from "./feed-history";
import {
  mergeCandidates,
  readRecommendationSession,
  saveRecommendationSession,
} from "./recommendation-session";
import { useVirtualizer } from "@tanstack/react-virtual";
import { scoreSource, tmdbEnabled, type Title } from "./catalog";
import type { Entry } from "./store";
import {
  ArrowRight,
  Bookmark,
  Check,
  Dislike,
  Film,
  Heart,
  LoaderCircle,
  Star,
} from "./icons";
import {
  buildTasteProfile,
  getRecommendationChunk,
  sameMovie,
  type RecommendationCursor,
  type Candidate,
  type Suggestion,
} from "./recommendations";
export default function Recommendations({
  library,
  fallback,
  open,
  update,
  configure,
  account = "local",
  paused = false,
}: {
  library: Record<string, Entry>;
  fallback: Title[];
  open: (title: Title) => void;
  update: (title: Title, patch: Partial<Entry>) => void;
  configure: () => void;
  account?: string;
  paused?: boolean;
}) {
  const ranker = useRef<LocalRanker | null>(null);
  const [session] = useState(() => readRecommendationSession(account));
  const feedState = useRef({
    items: [] as Suggestion[],
    index: 0,
    moving: false,
  });
  const pool = useRef<Candidate[]>(session.candidates);
  const sourceMore = useRef(true);
  const request = useRef(0);
  const [skipRevision, setSkipRevision] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === account)
        setSkipRevision((n) => n + 1);
    };
    window.addEventListener("vela-taste-state", changed);
    return () => window.removeEventListener("vela-taste-state", changed);
  }, [account]);
  const appliedRankKey = useRef("");
  const profile = useMemo(
    () => buildTasteProfile(library, readSkipSignals(account)),
    [library, account, skipRevision],
  );
  const current = useRef({ profile, fallback });
  current.current = { profile, fallback };
  const root = useRef<HTMLDivElement>(null),
    cursor = useRef<RecommendationCursor>(session.cursor),
    cursorKey = useRef(session.profile),
    busy = useRef(false),
    controller = useRef<AbortController | null>(null),
    emptyPages = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() &&
      matchMedia("(pointer: fine)").matches &&
      !paused
    )
      root.current?.focus({ preventScroll: true });
  }, [account]);
  const [items, setItems] = useState<Suggestion[]>([]),
    [loading, setLoading] = useState(false),
    [more, setMore] = useState(true),
    [error, setError] = useState(""),
    [manual, setManual] = useState(false),
    [height, setHeight] = useState(500),
    [frame, setFrame] = useState({ left: 0, top: 0, width: 0, height: 0 });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      ranker.current?.dispose();
    };
  }, []);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const resize = () => {
      if (el.clientHeight) {
        const height = Math.max(140, el.clientHeight - 24);
        const bounds = el.getBoundingClientRect();
        const width = Math.min(820, el.clientWidth - 2);
        setHeight(height);
        setFrame({
          left: bounds.left + (el.clientWidth - width) / 2,
          top: bounds.top + 8,
          width,
          height,
        });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    window.addEventListener("scroll", resize, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", resize);
    };
  }, []);
  const visible = items.filter(({ title }) => {
    const entry = library[title.id];
    return (
      !entry?.watched &&
      !entry?.rating &&
      entry?.recommendationFeedback !== "dislike"
    );
  });
  useCardSnap(root, height + 16, visible.length);
  const { index, moving, nearEnd } = useFeedMotion(
    root,
    height + 16,
    visible.length,
  );
  feedState.current = { items: visible, index, moving };
  const active = visible[index]?.title;
  useSkipFeedback({
    root,
    title: active,
    index,
    moving,
    paused,
    account,
    library,
    changed: () => setSkipRevision((n) => n + 1),
  });
  useLayoutEffect(() => {
    // The active index is the majority-visible card, never the virtualizer's prefetched neighbours.
    if (!paused && active?.id && !document.hidden) {
      if (!rememberSuggestion(active, account)) {
        setError(
          tr(
            "Le stockage local est indisponible. Les cartes consultées ne peuvent pas être conservées après fermeture.",
          ),
        );
        setManual(true);
      }
    }
  }, [paused, active?.id, account]);
  const activeArtwork = active?.backdrop || active?.image || "";
  const [appearance, setAppearance] = useState({
    id: "",
    artwork: "",
  });
  useEffect(() => {
    if (moving) return;
    setAppearance((previous) =>
      previous.id === (active?.id || "") && previous.artwork === activeArtwork
        ? previous
        : {
            id: active?.id || "",
            artwork: activeArtwork,
          },
    );
  }, [moving, active?.id, activeArtwork]);
  const artworkAspect = frame.width / frame.height || 0;
  const pendingTone = useArtworkTone(appearance.artwork, artworkAspect, true);
  const [tone, setTone] = useState<string | null>(null);
  useEffect(() => {
    if (!moving) setTone(pendingTone);
  }, [moving, pendingTone]);
  const virtual = useVirtualizer({
    count: visible.length,
    getScrollElement: () => root.current,
    estimateSize: () => height + 16,
    overscan: 2,
    getItemKey: (index) => visible[index].title.id,
  });
  useEffect(() => {
    virtual.measure();
  }, [height]);
  const next = useCallback(
    async (force = false, localOnly = false) => {
      if (!mounted.current || (busy.current && !force)) return;
      if (
        (force || cursorKey.current !== current.current.profile.fetchKey) &&
        feedState.current.moving
      )
        return;
      if (force) controller.current?.abort();
      const id = ++request.current;
      busy.current = true;
      setLoading(true);
      if (!localOnly) {
        setError("");
        setManual(false);
      }
      const { profile, fallback } = current.current;
      const refreshSources = force || cursorKey.current !== profile.fetchKey;
      const refresh = localOnly || refreshSources;
      if (refreshSources) {
        cursor.current = { ...cursor.current, _turn: 0, _seedOffset: 0 };
        cursorKey.current = profile.fetchKey;
        emptyPages.current = 0;
      }
      const c = new AbortController();
      controller.current = c;
      let rankedKey = "";
      const queue = async (prefix: Suggestion[]) => {
        const excludedToday = dailyExclusion(account);
        const candidates = pool.current.filter(
          (candidate) =>
            !excludedToday(candidate.title) &&
            !prefix.some((item) => sameMovie(item.title, candidate.title)),
        );
        ranker.current ||= new LocalRanker();
        rankedKey =
          current.current.profile.rankKey || current.current.profile.fetchKey;
        return ranker.current.rank(
          current.current.profile,
          candidates,
          readFeedTrail(account),
          c.signal,
        );
      };
      const settle = async () => {
        if (refresh && feedState.current.moving) {
          await new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout>;
            const abort = () => {
              clearTimeout(timer);
              reject(new DOMException(tr("Annulé"), "AbortError"));
            };
            const check = () => {
              if (c.signal.aborted) return abort();
              if (!feedState.current.moving) {
                c.signal.removeEventListener("abort", abort);
                resolve();
              } else timer = setTimeout(check, 32);
            };
            c.signal.addEventListener("abort", abort, { once: true });
            check();
          });
        }
      };
      try {
        let prefix = refresh
          ? feedState.current.items.slice(0, feedState.current.index + 1)
          : feedState.current.items;
        let ranked = await queue(prefix),
          pages = 0;
        // Each visit/profile refresh adds genuinely new source data before ranking the whole local pool.
        while (
          !localOnly &&
          pages < 4 &&
          ((pages === 0 && (refresh || !prefix.length)) ||
            (ranked.length < 8 && sourceMore.current))
        ) {
          const result = await getRecommendationChunk(
            current.current.profile,
            current.current.fallback,
            cursor.current,
            c.signal,
          );
          if (c.signal.aborted || id !== request.current) return;
          cursor.current = result.cursor;
          sourceMore.current = result.hasMore;
          pool.current = mergeCandidates(pool.current, result.candidates);
          prefix = refresh
            ? feedState.current.items.slice(0, feedState.current.index + 1)
            : feedState.current.items;
          ranked = await queue(prefix);
          pages++;
          if (!sourceMore.current) break;
        }
        if (c.signal.aborted || id !== request.current) return;
        await settle();
        if (c.signal.aborted || id !== request.current) return;
        prefix = refresh
          ? feedState.current.items.slice(0, feedState.current.index + 1)
          : feedState.current.items;
        const seenNow = dailyExclusion(account);
        ranked = ranked.filter(
          (item) =>
            !seenNow(item.title) &&
            !prefix.some((old) => sameMovie(old.title, item.title)),
        );
        const added = ranked.slice(0, 8),
          merged = [...prefix, ...added];
        appliedRankKey.current = rankedKey;
        setItems(merged);
        const hasMore = sourceMore.current || ranked.length > added.length;
        setMore(hasMore);
        if (!localOnly && !added.length && hasMore) {
          emptyPages.current++;
          setManual(true);
        } else emptyPages.current = 0;
        const excludedToday = dailyExclusion(account);
        pool.current = pool.current
          .filter((candidate) => !excludedToday(candidate.title))
          .slice(-600);
        saveRecommendationSession(
          account,
          current.current.profile.fetchKey,
          cursor.current,
          pool.current,
        );
      } catch (e) {
        if (!c.signal.aborted && id === request.current) {
          const state = feedState.current;
          let prefix = refresh
            ? state.items.slice(0, state.index + 1)
            : state.items;
          let cached: Suggestion[] = [];
          try {
            cached = (await queue(prefix)).slice(0, 8);
            await settle();
          } catch {
            /* A newer request may cancel this cache calculation. */
          }
          if (c.signal.aborted || id !== request.current) return;
          const latest = feedState.current;
          prefix = refresh
            ? latest.items.slice(0, latest.index + 1)
            : latest.items;
          const seenNow = dailyExclusion(account);
          cached = cached.filter(
            (item) =>
              !seenNow(item.title) &&
              !prefix.some((old) => sameMovie(old.title, item.title)),
          );
          if (cached.length) setItems([...prefix, ...cached]);
          setError(
            e instanceof Error
              ? e.message
              : tr("La suite ne peut pas être chargée."),
          );
          setManual(true);
        }
      } finally {
        if (mounted.current && !c.signal.aborted && id === request.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [account],
  );
  useEffect(() => {
    if (!moving && profile.fetchKey !== cursorKey.current) next(true);
  }, [profile.fetchKey, moving, next]);
  useEffect(() => {
    if (
      skipRevision > 0 &&
      items.length > 0 &&
      !moving &&
      !loading &&
      profile.fetchKey === cursorKey.current &&
      (profile.rankKey || profile.fetchKey) !== appliedRankKey.current
    )
      next(false, true);
  }, [profile.rankKey, skipRevision, items.length, moving, loading, next]);
  useEffect(() => {
    if (nearEnd && more && !loading && !manual && !error) next();
  }, [nearEnd, more, loading, manual, error, next, visible.length]);
  useEffect(() => {
    let day = localDay();
    const timer = setInterval(() => {
      const today = localDay();
      if (today !== day) {
        day = today;
        controller.current?.abort();
        request.current++;
        busy.current = false;
        cursor.current = {};
        cursorKey.current = "";
        pool.current = [];
        sourceMore.current = true;
        setLoading(false);
        setManual(false);
        setError("");
        setMore(true);
        next(true);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [next]);
  return (
    <section
      className="recommendations-page"
      aria-label={tr("Pour vous")}
      data-moving={moving}
    >
      {createPortal(
        <div
          className="feed-ambience"
          aria-hidden="true"
          data-moving={moving}
          data-title={active?.id}
          data-artwork={appearance.id}
          style={toneStyle(tone)}
        >
          <span className="feed-halo" style={frame} />
        </div>,
        document.body,
      )}
      <h1 className="sr-only">{tr("Pour vous")}</h1>
      <div
        className="recommendation-scroll"
        ref={root}
        tabIndex={0}
        role="feed"
        aria-label={tr("Films recommandés")}
        aria-busy={loading}
      >
        <div
          className="recommendation-virtual"
          style={{ height: virtual.getTotalSize() }}
        >
          {virtual.getVirtualItems().map((row) => {
            const suggestion = visible[row.index];
            return (
              <div
                className="recommendation-row"
                key={row.key}
                style={{ height, transform: `translateY(${row.start}px)` }}
              >
                <RecommendationCard
                  suggestion={suggestion}
                  entry={library[suggestion.title.id]}
                  open={open}
                  update={update}
                  artworkAspect={artworkAspect}
                />
              </div>
            );
          })}
        </div>
      </div>
      {(loading || error || manual || !more) &&
        (error || !items.length || nearEnd) && (
          <div className="feed-notice">
            {loading && (
              <span role="status" className="feed-progress">
                <LoaderCircle size={18} className="spin" />
                {tr("Chargement…")}
              </span>
            )}
            {error && (
              <div className="error" role="alert">
                {tr(error)}
                <button onClick={() => next()}>
                  {tr("Réessayer la suite")}
                </button>
                <button onClick={configure}>{tr("Réglages")}</button>
              </div>
            )}
            {!loading && !error && more && manual && (
              <button
                className="button tonal"
                onClick={() => {
                  emptyPages.current = 0;
                  next();
                }}
              >
                {tr("Charger la suite")}
              </button>
            )}
            {!loading && !more && !error && (
              <p className="feed-progress">
                {items.length
                  ? tr("Aucun autre film inédit disponible pour aujourd’hui.")
                  : tr("Aucun autre film inédit disponible pour aujourd’hui.")}
                {!tmdbEnabled() && (
                  <button className="text-button" onClick={configure}>
                    {tr("Activer TMDB")}
                  </button>
                )}
              </p>
            )}
          </div>
        )}
    </section>
  );
}
function RecommendationCard({
  suggestion,
  entry,
  open,
  update,
  artworkAspect,
}: {
  suggestion: Suggestion;
  entry?: Entry;
  open: (title: Title) => void;
  update: (title: Title, patch: Partial<Entry>) => void;
  artworkAspect: number;
}) {
  const { title, reason } = suggestion;
  const tone = useArtworkTone(
    title.backdrop || title.image || "",
    artworkAspect,
  );
  const [pulse, setPulse] = useState(0);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null),
    down = useRef<{ at: number; x: number; y: number } | null>(null),
    lastLike = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const liked =
    entry?.recommendationFeedback === "like" ||
    Boolean(entry?.favorite && entry.recommendationFeedback !== "dislike");
  function addToWatchlist() {
    if (Date.now() - lastLike.current < 400) return;
    lastLike.current = Date.now();
    setPulse((n) => n + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPulse(0), 700);
    if (!entry?.watchlist) update(title, { watchlist: true });
  }
  function control(target: EventTarget | null) {
    return (
      target instanceof Element && Boolean(target.closest("button,a,input"))
    );
  }
  return (
    <article
      className="recommendation-card"
      data-title-id={title.id}
      style={toneStyle(tone)}
      aria-label={title.name}
      onDoubleClick={(e) => {
        if (!control(e.target)) {
          e.preventDefault();
          addToWatchlist();
        }
      }}
      onPointerDown={(e) => {
        if (control(e.target)) {
          lastTap.current = null;
          down.current = null;
          return;
        }
        if (
          !control(e.target) &&
          e.isPrimary &&
          (e.pointerType !== "mouse" || e.button === 0)
        )
          down.current = { at: Date.now(), x: e.clientX, y: e.clientY };
      }}
      onPointerCancel={() => {
        down.current = null;
        lastTap.current = null;
      }}
      onPointerUp={(e) => {
        if (control(e.target)) return;
        const start = down.current;
        down.current = null;
        if (
          !start ||
          Date.now() - start.at > 350 ||
          Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12
        ) {
          lastTap.current = null;
          return;
        }
        const previous = lastTap.current;
        if (
          previous &&
          Date.now() - previous.at < 320 &&
          Math.hypot(previous.x - e.clientX, previous.y - e.clientY) < 28
        ) {
          lastTap.current = null;
          addToWatchlist();
        } else lastTap.current = { at: Date.now(), x: e.clientX, y: e.clientY };
      }}
    >
      <div className="recommendation-art">
        {title.backdrop || title.image ? (
          <img
            src={title.backdrop || title.image}
            alt=""
            loading="lazy"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Film size={100} />
        )}
      </div>
      <div className="recommendation-shade" />
      <span className="recommendation-reason">
        {recommendationReason(reason)}
      </span>
      {pulse > 0 && (
        <span className="like-burst" key={pulse} aria-hidden="true">
          <Bookmark size={90} fill="currentColor" />
          <span>{tr("À voir")}</span>
        </span>
      )}
      <div className="recommendation-content">
        <div className="recommendation-meta">
          <span>{title.year}</span>
          <span>{title.genres.slice(0, 2).join(" / ")}</span>
          {title.score && (
            <span className="recommendation-score">
              <Star size={14} fill="currentColor" />
              {title.score}
              <small>{scoreSource(title)}</small>
            </span>
          )}
        </div>
        <h2>{title.name}</h2>
        <p className="recommendation-synopsis">{title.summary}</p>
        <div className="recommendation-actions">
          <button className="button primary" onClick={() => open(title)}>
            {tr("Détails ")}
            <ArrowRight size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={
              liked
                ? tr("Retirer J’aime pour {0}", title.name)
                : tr("J’aime {0}", title.name)
            }
            aria-pressed={liked}
            onClick={() => {
              if (liked)
                update(title, {
                  favorite: false,
                  recommendationFeedback: undefined,
                });
              else
                update(title, {
                  favorite: true,
                  recommendationFeedback: "like",
                });
            }}
          >
            <Heart size={22} fill={liked ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label={tr("Je n’aime pas {0}", title.name)}
            onClick={() =>
              update(title, {
                favorite: false,
                watchlist: false,
                recommendationFeedback: "dislike",
              })
            }
          >
            <Dislike size={21} />
          </button>
          <button
            className="icon-button"
            aria-label={
              entry?.watchlist
                ? tr("Retirer {0} de ma liste", title.name)
                : tr("Ajouter {0} à ma liste", title.name)
            }
            aria-pressed={Boolean(entry?.watchlist)}
            onClick={() => update(title, { watchlist: !entry?.watchlist })}
          >
            {entry?.watchlist ? <Check size={21} /> : <Bookmark size={21} />}
          </button>
        </div>
      </div>
    </article>
  );
}
