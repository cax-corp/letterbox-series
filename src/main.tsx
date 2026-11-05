import "@fontsource/dm-sans/latin-400.css";
import { Brand, SettingsFooter } from "./Brand";
import Avatar from "./Avatar";
import ProfileOverview from "./ProfileOverview";
import ProfileEditor from "./ProfileEditor";
import { useProfile } from "./useProfile";
import { reviewShare, titleShare, shareCard, shareMessage } from "./sharing";
import type { Profile } from "./profile";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Clapperboard,
  Compass,
  Download,
  Film,
  Heart,
  LoaderCircle,
  LogOut,
  Play,
  Plus,
  Search,
  ShareIcon,
  Settings,
  Sparkles,
  Star,
  Sun,
  Moon,
  User,
  X,
} from "./icons";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import {
  palette,
  updateSystemAppearance,
  type ThemePreference,
} from "./appearance";
import { backupService } from "./backup";
import BackupSettings from "./BackupSettings";
import { useCloudBackup, type BackupController } from "./useCloudBackup";
import repairSql from "../supabase/schema.sql?raw";
import { Clipboard } from "@capacitor/clipboard";
import type { User as AuthUser } from "@supabase/supabase-js";
import {
  movies,
  series,
  searchCatalog,
  getTitleDetails,
  tmdbEnabled,
  isTmdb,
  scoreSource,
  getTmdbCredential,
  saveTmdbCredential,
  disableTmdb,
  type Title,
} from "./catalog";
import EpisodeTracker from "./EpisodeTracker";
import Recommendations from "./Recommendations";
import WebRecommendationsNotice from "./WebRecommendationsNotice";
import { personalizeHome } from "./home-personalization";
import { readRecommendationSession } from "./recommendation-session";
import { toneStyle, useArtworkTone } from "./useArtworkTone";
import NotificationSettings from "./NotificationSettings";
import { useDailyRecommendations } from "./useDailyRecommendations";
import {
  cloud,
  empty,
  getConfig,
  read,
  parseCollection,
  saveConfig,
  write,
  type Entry,
} from "./store";
import "./style.css";
import { exportCollection } from "./export";
type Page =
  | "discover"
  | "search"
  | "library"
  | "recommendations"
  | "profile"
  | "settings"
  | "edit-profile";
const pageNames: Page[] = [
  "discover",
  "search",
  "library",
  "recommendations",
  "profile",
  "settings",
  "edit-profile",
];
function App() {
  const [feedSession, setFeedSession] = useState(0);
  useEffect(() => {
    let wasHidden = document.hidden;
    const resume = () => {
      if (document.hidden) wasHidden = true;
      else if (wasHidden) {
        wasHidden = false;
        setFeedSession((session) => session + 1);
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, []);
  const [page, setPage] = useState<Page>(() =>
      location.hash === "#settings"
        ? "settings"
        : location.hash === "#profile/edit"
          ? "edit-profile"
          : "discover",
    ),
    [kind, setKind] = useState<"all" | "movie" | "series">("all"),
    [filmList, setFilms] = useState<Title[]>([]),
    [showList, setShows] = useState<Title[]>([]),
    [results, setResults] = useState<Title[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [searching, setSearching] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [searchPage, setSearchPage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [totalResults, setTotalResults] = useState(0),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Title | null>(null),
    [library, setLibrary] = useState(() => read()),
    [notice, setNotice] = useState(""),
    [user, setUser] = useState<AuthUser | null>(null),
    [auth, setAuth] = useState(false),
    [listFilter, setListFilter] = useState("watchlist"),
    [theme, setTheme] = useState<ThemePreference>(() => {
      const saved = localStorage.getItem("luma-theme");
      return saved === "light" || saved === "system" ? saved : "dark";
    }),
    [systemLight, setSystemLight] = useState(
      () => matchMedia("(prefers-color-scheme: light)").matches,
    );
  const personal = useProfile(user);
  const light = theme === "system" ? systemLight : theme === "light";
  const materialTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: light ? "light" : "dark",
          primary: { main: palette[light ? "light" : "dark"].primary },
          background: {
            default: palette[light ? "light" : "dark"].background,
            paper: palette[light ? "light" : "dark"].surface,
          },
          text: {
            primary: palette[light ? "light" : "dark"].text,
            secondary: palette[light ? "light" : "dark"].muted,
          },
        },
        typography: { fontFamily: '"DM Sans", Arial, sans-serif' },
        shape: { borderRadius: 20 },
      }),
    [light],
  );
  useDailyRecommendations(
    library,
    filmList,
    (title) => {
      setPage("recommendations");
      setSelected(title || null);
    },
    user?.id || "local",
    openSettings,
  );
  const moreAbort = useRef<AbortController | null>(null);
  const searchIdentity = useRef("");
  searchIdentity.current = `${page}|${kind}|${query}`;
  const local = useRef(library);
  local.current = library;
  const activeAccount = useRef(user?.id);
  activeAccount.current = user?.id;
  const backup = useCloudBackup(user?.id, (account, data) => {
    if (activeAccount.current !== account) return;
    local.current = data;
    setLibrary(data);
  });
  const syncState = backup.status,
    syncIssue = backup.issue;

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function toast(message: string) {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  }
  async function load() {
    setLoading(true);
    setError("");
    const r = await Promise.allSettled([movies(), series()]);
    if (r[0].status === "fulfilled") setFilms(r[0].value);
    if (r[1].status === "fulfilled") setShows(r[1].value);
    if (r.some((x) => x.status === "rejected"))
      setError(
        [
          ...new Set(
            r
              .filter((x) => x.status === "rejected")
              .map(
                (x) =>
                  (x as PromiseRejectedResult).reason?.message ||
                  "Catalogue indisponible.",
              ),
          ),
        ].join(" ") + " Vos listes restent accessibles.",
      );
    setLoading(false);
  }
  useEffect(() => {
    load();
    if (!cloud) return;
    cloud.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user || null));
    const { data } = cloud.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user || null),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemLight(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("luma-theme", theme);
    updateSystemAppearance(light).catch(() =>
      toast(
        "Les couleurs système n’ont pas pu être mises à jour. Réessayez en changeant le thème.",
      ),
    );
  }, [light, theme]);
  async function syncNow() {
    if (await backup.syncNow()) toast("Synchronisation terminée.");
  }
  useEffect(() => {
    const scoped = read(user?.id);
    local.current = scoped;
    setLibrary(scoped);
  }, [user?.id]);
  useEffect(() => {
    moreAbort.current?.abort();
    setLoadingMore(false);
    if (page !== "search") return;
    const c = new AbortController();
    setHasMore(false);
    setSearchPage(1);
    setTotalResults(0);
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      setError("");
      try {
        const result = await searchCatalog(query.trim(), kind, 1, c.signal);
        if (c.signal.aborted) return;
        setResults(result.results);
        setHasMore(result.hasMore);
        setTotalResults(result.total);
      } catch (e) {
        if (!c.signal.aborted) {
          setResults([]);
          setError(e instanceof Error ? e.message : "Recherche indisponible.");
        }
      } finally {
        if (!c.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      c.abort();
      moreAbort.current?.abort();
    };
  }, [query, kind, page]);
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    const identity = searchIdentity.current;
    const c = new AbortController();
    moreAbort.current = c;
    setLoadingMore(true);
    setError("");
    try {
      const result = await searchCatalog(
        query.trim(),
        kind,
        searchPage + 1,
        c.signal,
      );
      if (c.signal.aborted || searchIdentity.current !== identity) return;
      setResults((previous) => {
        const ids = new Set(previous.map((t) => t.id));
        return [...previous, ...result.results.filter((t) => !ids.has(t.id))];
      });
      setSearchPage(result.page);
      setHasMore(result.hasMore);
      setTotalResults(result.total);
    } catch (e) {
      if (!c.signal.aborted && searchIdentity.current === identity)
        setError(e instanceof Error ? e.message : "Chargement indisponible.");
    } finally {
      if (!c.signal.aborted && searchIdentity.current === identity)
        setLoadingMore(false);
    }
  }
  useEffect(() => {
    if (!selected && !auth) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setAuth(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [selected, auth]);
  function update(title: Title, patch: Partial<Entry>) {
    const previous = local.current[title.id] || empty(title);
    const now = new Date(
      Math.max(Date.now(), Date.parse(previous.updated) + 1),
    ).toISOString();
    const preferenceChanged = (
      ["rating", "favorite", "recommendationFeedback"] as const
    ).some((key) => key in patch && patch[key] !== previous[key]);
    const entry = {
      ...previous,
      ...patch,
      updated: now,
      preferenceUpdated: preferenceChanged
        ? now
        : previous.preferenceUpdated || previous.updated,
    };
    const data = { ...local.current, [title.id]: entry };
    try {
      write(data, user?.id);
      local.current = data;
      setLibrary(data);
    } catch {
      toast("Stockage plein : exportez votre collection.");
      return;
    }
    if (user) {
      try {
        backupService.changed(user.id);
      } catch {
        toast(
          "Votre changement est enregistré. Exportez votre collection si le stockage est plein.",
        );
      }
    }
  }

  function navigate(p: Page) {
    if ((page === "settings" || page === "edit-profile") && p !== page)
      history.replaceState(
        { lumaPage: p },
        "",
        location.pathname + location.search,
      );
    setPage(p);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openProfileEditor() {
    if (page === "edit-profile") return;
    history.replaceState(
      { lumaPage: "profile" },
      "",
      location.pathname + location.search,
    );
    history.pushState(
      { lumaPage: "edit-profile", velaProfileEntry: true },
      "",
      "#profile/edit",
    );
    setSelected(null);
    setPage("edit-profile");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function closeProfileEditor() {
    if (history.state?.velaProfileEntry) history.back();
    else {
      history.replaceState(
        { lumaPage: "profile" },
        "",
        location.pathname + location.search,
      );
      setPage("profile");
    }
  }
  function openSettings() {
    if (page === "settings") return;
    history.replaceState(
      { lumaPage: page },
      "",
      location.pathname + location.search,
    );
    history.pushState(
      { lumaPage: "settings", lumaSettingsEntry: true },
      "",
      "#settings",
    );
    setSelected(null);
    setAuth(false);
    setPage("settings");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function closeSettings() {
    if (history.state?.lumaSettingsEntry) history.back();
    else {
      history.replaceState(
        { lumaPage: "discover" },
        "",
        location.pathname + location.search,
      );
      setPage("discover");
    }
  }
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const target = event.state?.lumaPage;
      setPage(
        pageNames.includes(target)
          ? target
          : location.hash === "#settings"
            ? "settings"
            : location.hash === "#profile/edit"
              ? "edit-profile"
              : "discover",
      );
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const back = () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      if (auth) {
        setAuth(false);
        return true;
      }
      if (page === "edit-profile") {
        closeProfileEditor();
        return true;
      }
      if (page === "settings") {
        closeSettings();
        return true;
      }
      return false;
    };
    (window as any).lumaHandleBack = back;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !selected && !auth) {
        if (page === "settings") closeSettings();
        else if (page === "edit-profile") closeProfileEditor();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      delete (window as any).lumaHandleBack;
      document.removeEventListener("keydown", escape);
    };
  }, [page, selected, auth]);
  const entries = Object.values(library),
    watched = entries.filter((e) => e.watched),
    watchlist = entries.filter((e) => e.watchlist),
    favorites = entries.filter((e) => e.favorite);
  const namedLists = [...new Set(entries.flatMap((e) => e.lists || []))].sort();
  const inList = (e: Entry) =>
    listFilter.startsWith("list:")
      ? e.lists?.includes(listFilter.slice(5))
      : Boolean(e[listFilter as keyof Entry]);
  const home = React.useMemo(() => {
    if (page !== "discover")
      return {
        movies: filmList,
        series: showList,
        hero: filmList[0] || showList[0],
        personalized: false,
      };
    const cached = readRecommendationSession(
      user?.id || "local",
    ).candidates.map((candidate) => candidate.title);
    return personalizeHome(library, [...filmList, ...cached], showList);
  }, [library, filmList, showList, page, user?.id]);
  const hero = home.hero;
  const card = (title: Title, i: number) => (
    <button
      key={title.id}
      className="poster-card"
      onClick={() => setSelected(title)}
      style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
    >
      <div className="poster">
        <Poster title={title} />
        <div className="poster-shade" />
        <span className="poster-open">
          <Plus size={23} />
        </span>
        {library[title.id]?.watched && (
          <span className="watched-badge">
            <Check size={13} />
          </span>
        )}
        {title.score && (
          <span className="score">
            <Star size={10} fill="currentColor" />
            {title.score}
          </span>
        )}
        <span className="media-label">
          {title.kind === "series" ? "SÉRIE" : "FILM"}
        </span>
      </div>
      <h3>{title.name}</h3>
      <p>
        {title.year || "—"}
        <span>•</span>
        {title.genres[0] || "À découvrir"}
      </p>
    </button>
  );
  return (
    <ThemeProvider theme={materialTheme}>
      <aside className="sidebar">
        <a
          className="logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("discover");
          }}
        >
          <Brand />
        </a>
        <div className="nav-caption">VOTRE UNIVERS</div>
        <nav>
          {(
            [
              [Compass, "discover", "Découvrir"],
              [Search, "search", "Explorer"],
              [Sparkles, "recommendations", "Pour vous"],
              [Bookmark, "library", "Ma collection"],
            ] as const
          ).map(([Icon, p, label]) => (
            <button
              key={p}
              className={page === p ? "nav-link active" : "nav-link"}
              onClick={() => navigate(p)}
            >
              <Icon size={19} />
              {label}
              {p === "library" && watchlist.length > 0 && (
                <span className="count">{watchlist.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-link"
            onClick={() => setTheme(light ? "dark" : "light")}
          >
            {light ? <Moon size={18} /> : <Sun size={18} />}Mode{" "}
            {light ? "sombre" : "clair"}
          </button>
          <button className="nav-link" onClick={() => openSettings()}>
            <Settings size={18} />
            Réglages
          </button>
          <button className="account" onClick={() => navigate("profile")}>
            <Avatar
              profile={personal.profile}
              name={
                personal.profile.displayName ||
                user?.email?.split("@")[0] ||
                "Vela"
              }
              size={34}
            />
            <span>
              {user ? "Mon espace" : "Votre espace"}
              <small>
                {user ? "Connecté à Supabase" : "Collection locale"}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <main
        className={
          page === "recommendations" && Capacitor.isNativePlatform()
            ? "is-feed"
            : undefined
        }
      >
        <header className="topbar">
          <div className="mobile-logo logo">
            <Brand />
          </div>
          <div className="breadcrumb">
            Votre dose d’histoires{" "}
            <span className="breadcrumb-dot" aria-hidden="true" />
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={
                light ? "Passer en mode sombre" : "Passer en mode clair"
              }
              onClick={() => setTheme(light ? "dark" : "light")}
            >
              {light ? <Moon size={22} /> : <Sun size={22} />}
            </button>
            <button
              className="icon-button mobile-settings"
              aria-label="Réglages"
              onClick={() => openSettings()}
            >
              <Settings size={22} />
            </button>
          </div>
        </header>
        {page === "settings" && (
          <SettingsPage
            theme={theme}
            setTheme={setTheme}
            repairNeeded={Boolean(syncIssue)}
            library={library}
            fallback={filmList}
            account={user?.id || "local"}
            backup={backup}
            close={closeSettings}
          />
        )}
        {(page === "discover" || page === "search") && !tmdbEnabled() && (
          <aside className="catalog-setup">
            <div>
              <strong>Élargissez votre catalogue avec TMDB</strong>
              <p>
                Le catalogue sans clé est limité. Activez TMDB pour rechercher
                davantage de films et de séries.
              </p>
            </div>
            <button className="button tonal" onClick={() => openSettings()}>
              Configurer TMDB <ArrowRight size={18} />
            </button>
          </aside>
        )}
        {page === "discover" && (
          <>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  <span className="blue-dot" /> LE MONDE EST UN ÉCRAN
                </div>
                <h1>
                  Votre prochaine
                  <br />
                  <em>obsession.</em>
                </h1>
              </div>
              <p>
                Des films qui bousculent.
                <br />
                Des séries qui restent.
                <br />
                <span>Et vous, au premier rang.</span>
              </p>
            </section>
            <section
              className="hero"
              style={
                hero
                  ? { backgroundImage: `url("${hero.backdrop || hero.image}")` }
                  : undefined
              }
            >
              <div className="hero-grain" />
              <div className="hero-content">
                <span className="editorial surface">
                  <Sparkles size={13} /> LE CHOIX VELA
                </span>
                <div className="hero-kicker">
                  {home.personalized
                    ? "SELON VOS GOÛTS"
                    : "UNE HISTOIRE À DÉCOUVRIR"}
                </div>
                <h2>{hero?.name || "Laissez-vous surprendre."}</h2>
                <div className="hero-meta">
                  <span>{hero?.year || "FILMS & SÉRIES"}</span>
                  <i />
                  {hero?.genres.slice(0, 2).join(" / ") ||
                    "Votre cinéma, votre regard"}
                  {hero?.score && (
                    <>
                      <i />
                      <Star size={13} fill="currentColor" />
                      {hero.score}/10
                    </>
                  )}
                </div>
                <p>
                  {hero?.summary ||
                    "Explorez des milliers de films et de séries. Composez votre collection et racontez ce que vous avez ressenti."}
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    disabled={!hero}
                    onClick={() => hero && setSelected(hero)}
                  >
                    Découvrir <ArrowRight size={17} />
                  </button>
                  <button
                    className={
                      "button surface " +
                      (hero && library[hero.id]?.watchlist ? "is-saved" : "")
                    }
                    disabled={!hero}
                    onClick={() => {
                      if (hero) {
                        update(hero, {
                          watchlist: !library[hero.id]?.watchlist,
                        });
                        toast(
                          library[hero.id]?.watchlist
                            ? "Retiré de votre liste"
                            : "Ajouté à votre liste",
                        );
                      }
                    }}
                  >
                    {hero && library[hero.id]?.watchlist ? (
                      <Check size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    Ma liste
                  </button>
                </div>
              </div>
              <div className="hero-number">
                01 <span>/ LA SÉLECTION</span>
              </div>
              <div className="vertical-note">
                CURATED BY VELA — FEEL SOMETHING.
              </div>
            </section>
            <div className="section-bar">
              <div className="tabs surface">
                {(["all", "movie", "series"] as const).map((k) => (
                  <button
                    className={kind === k ? "selected" : ""}
                    key={k}
                    onClick={() => setKind(k)}
                  >
                    {k === "all"
                      ? "À la une"
                      : k === "movie"
                        ? "Films"
                        : "Séries"}
                  </button>
                ))}
              </div>
              <span className="catalog-note">
                <span className="blue-dot" /> À explorer, à ressentir.
              </span>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={load}>Réessayer</button>
              </div>
            )}
            {loading ? (
              <Skeleton />
            ) : (
              <>
                {kind !== "series" && (
                  <section className="shelf">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">L’ART DU GRAND ÉCRAN</span>
                        <h2>
                          Le cinéma, intensément<span>.</span>
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setKind("movie");
                          navigate("search");
                        }}
                      >
                        Tout explorer <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="poster-grid">
                      {home.movies.slice(0, 6).map(card)}
                    </div>
                    {!home.movies.length && (
                      <Empty text="Les films sont indisponibles pour le moment." />
                    )}
                  </section>
                )}
                {kind !== "movie" && (
                  <section className="shelf">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">ENCORE UN ÉPISODE</span>
                        <h2>
                          Impossible de décrocher<span>.</span>
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setKind("series");
                          navigate("search");
                        }}
                      >
                        Toutes les séries <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="poster-grid">
                      {home.series.slice(0, 6).map(card)}
                    </div>
                  </section>
                )}
              </>
            )}
            <section className="manifesto">
              <span>VOTRE REGARD COMPTE.</span>
              <h2>
                Ne laissez pas le générique
                <br />
                effacer le souvenir.
              </h2>
              <button
                className="button surface"
                onClick={() => navigate("library")}
              >
                Créer ma collection <ArrowRight size={17} />
              </button>
              <div className="manifesto-art" aria-hidden="true">
                v<span>e</span>la
              </div>
            </section>
          </>
        )}
        {page === "search" && (
          <section className="page-section">
            <div className="eyebrow">SUIVEZ VOTRE CURIOSITÉ</div>
            <h1>
              Trouvez votre <em>histoire.</em>
            </h1>
            <form
              className="large-search surface"
              onSubmit={(e) => e.preventDefault()}
            >
              <Search size={23} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tmdbEnabled()
                    ? "Un titre français ou original…"
                    : "Un titre de film ou de série…"
                }
                aria-label="Rechercher dans le catalogue"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Effacer"
                  onClick={() => setQuery("")}
                >
                  <X size={19} />
                </button>
              )}
            </form>
            <div className="tabs inline-tabs">
              {(["all", "movie", "series"] as const).map((k) => (
                <button
                  className={kind === k ? "selected" : ""}
                  key={k}
                  onClick={() => setKind(k)}
                >
                  {k === "all" ? "Tout" : k === "movie" ? "Films" : "Séries"}
                </button>
              ))}
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={() => openSettings()}>
                  Réglages du catalogue
                </button>
              </div>
            )}
            {searching ? (
              <Skeleton />
            ) : query.trim() ? (
              <>
                <p className="result-count">
                  {results.length} affichés sur {totalResults} résultat
                  {totalResults > 1 ? "s" : ""}
                </p>
                <div className="poster-grid search-grid">
                  {results.map(card)}
                </div>
                {hasMore && (
                  <div className="load-more">
                    <button
                      className="button tonal"
                      disabled={loadingMore}
                      onClick={loadMore}
                    >
                      {loadingMore ? (
                        <>
                          <LoaderCircle size={18} className="spin" />
                          Chargement…
                        </>
                      ) : (
                        "Charger plus de résultats"
                      )}
                    </button>
                  </div>
                )}
                {!results.length && !error && (
                  <Empty text="Aucune histoire trouvée. Essayez un autre titre." />
                )}
              </>
            ) : (
              <div className="search-suggestions">
                <span className="eyebrow">UNE ENVIE ?</span>
                <div>
                  {[
                    "Interstellar",
                    "Severance",
                    "Dune",
                    "The Bear",
                    "Le Voyage de Chihiro",
                    "Breaking Bad",
                  ].map((q) => (
                    <button
                      className="surface"
                      onClick={() => setQuery(q)}
                      key={q}
                    >
                      {q}
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {page === "recommendations" &&
          (Capacitor.isNativePlatform() ? (
            <Recommendations
              key={`${user?.id || "local"}:${feedSession}`}
              account={user?.id || "local"}
              paused={Boolean(selected || auth)}
              library={library}
              fallback={filmList}
              open={setSelected}
              update={update}
              configure={() => openSettings()}
            />
          ) : (
            <WebRecommendationsNotice explore={() => navigate("search")} />
          ))}
        {page === "library" && (
          <section className="page-section">
            <div className="eyebrow">LES HISTOIRES QUE VOUS GARDEZ</div>
            <h1>
              Votre <em>collection.</em>
            </h1>
            <p className="muted">
              Vos envies, vos coups de cœur, votre cinéma.
            </p>
            <div className="tabs inline-tabs">
              {[
                ["watchlist", "À voir", watchlist.length],
                ["watched", "Vus", watched.length],
                ["favorite", "Favoris", favorites.length],
                ...namedLists.map((name) => [
                  `list:${name}`,
                  name,
                  entries.filter((e) => e.lists?.includes(name)).length,
                ]),
              ].map(([id, label, n]) => (
                <button
                  key={id}
                  className={listFilter === id ? "selected" : ""}
                  onClick={() => setListFilter(String(id))}
                >
                  {label} <small>{n}</small>
                </button>
              ))}
            </div>
            <div className="poster-grid search-grid">
              {entries.filter(inList).map((e, i) => card(e.title, i))}
            </div>
            {!entries.some(inList) && (
              <Empty
                text="Votre collection commence par une histoire."
                action={() => navigate("search")}
              />
            )}
          </section>
        )}
        {page === "edit-profile" && (
          <ProfileEditor
            key={user?.id || "local"}
            initial={personal.profile}
            library={library}
            defaultName={user?.email?.split("@")[0] || ""}
            connected={Boolean(user)}
            busy={personal.busy}
            save={personal.save}
            close={closeProfileEditor}
            toast={toast}
          />
        )}
        {page === "profile" && (
          <section className="page-section profile">
            <div className="eyebrow">CHAQUE REGARD EST UNIQUE</div>
            <h1>
              Votre coin de <em>cinéma.</em>
            </h1>
            <ProfileOverview
              profile={personal.profile}
              library={library}
              email={user?.email}
              edit={openProfileEditor}
              open={setSelected}
              toast={toast}
              pending={Boolean(user && personal.pending)}
            />
            {personal.error && <p className="muted fine">{personal.error}</p>}
            <div className="profile-panel surface">
              <div>
                <h2>
                  {user
                    ? "Votre collection vous suit."
                    : "Vos histoires, partout avec vous."}
                </h2>
                <p className="muted">
                  {user
                    ? syncState === "success"
                      ? "Vos notes et vos listes sont synchronisées."
                      : syncState === "syncing"
                        ? "Synchronisation en cours…"
                        : syncState === "error"
                          ? "La synchronisation a échoué. Vos données restent sur cet appareil."
                          : syncState === "pending"
                            ? "Vos changements sont enregistrés sur cet appareil et attendent la prochaine sauvegarde Supabase."
                            : "Votre collection est enregistrée sur cet appareil."
                    : "Connectez Supabase pour retrouver vos listes sur le web et Android."}
                </p>
                {user && backup.state.lastSuccess > 0 && (
                  <p className="muted fine">
                    Dernière sauvegarde :{" "}
                    {new Date(backup.state.lastSuccess).toLocaleString("fr-FR")}
                    .
                  </p>
                )}
              </div>
              {user ? (
                <>
                  <button
                    className="button"
                    disabled={syncState === "syncing"}
                    onClick={syncNow}
                  >
                    {syncState === "syncing"
                      ? "Synchronisation…"
                      : "Synchroniser"}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Se déconnecter"
                    onClick={() => cloud?.auth.signOut()}
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <button
                  className="button primary"
                  onClick={() => (cloud ? setAuth(true) : openSettings())}
                >
                  {cloud ? "Se connecter" : "Configurer Supabase"}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            {syncIssue && (
              <section className="sync-error" role="alert">
                <h3>Synchronisation à rétablir</h3>
                <p>{syncIssue.message}</p>
                <button className="button tonal" onClick={() => openSettings()}>
                  Corriger Supabase <ArrowRight size={18} />
                </button>
              </section>
            )}
            <div className="profile-panel">
              <div>
                <h3>Vos données vous appartiennent.</h3>
                <p className="muted">
                  Une sauvegarde JSON de vos notes, listes et visionnages.
                </p>
              </div>
              <button
                className="button surface"
                onClick={() =>
                  exportCollection(library).catch(() =>
                    toast("Export annulé ou indisponible."),
                  )
                }
              >
                <Download size={17} />
                Exporter
              </button>
              <label className="button surface">
                Importer
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const data = parseCollection(await file.text());
                      const merged = { ...local.current, ...data };
                      write(merged, user?.id);
                      setLibrary(merged);
                      local.current = merged;
                      if (user) {
                        try {
                          backupService.changed(user.id);
                        } catch {
                          toast(
                            "Collection importée. Vérifiez l’espace disponible avant la sauvegarde.",
                          );
                        }
                      }
                      toast("Collection importée.");
                    } catch {
                      toast(
                        "Import impossible : vérifiez le fichier JSON ou la connexion.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
        )}
      </main>
      <nav className="mobile-nav" aria-label="Navigation principale">
        <BottomNavigation
          showLabels
          value={page === "edit-profile" ? "profile" : page}
          onChange={(_event, value) => navigate(value)}
          sx={{ height: 80, bgcolor: "transparent", width: "100%" }}
        >
          {(
            [
              [Compass, "discover", "Découvrir"],
              [Search, "search", "Explorer"],
              [Sparkles, "recommendations", "Pour vous"],
              [Bookmark, "library", "Collection"],
              [User, "profile", "Profil"],
            ] as const
          ).map(([Icon, p, label]) => (
            <BottomNavigationAction
              key={p}
              value={p}
              label={label}
              icon={
                <span className="nav-indicator">
                  <Icon size={24} />
                </span>
              }
              sx={{
                minWidth: 0,
                maxWidth: 160,
                padding: "12px 0 10px",
                gap: "4px",
                color: "var(--muted)",
                "&.Mui-selected": { color: "var(--text)" },
                "& .MuiBottomNavigationAction-label": {
                  fontSize: "11px!important",
                  fontWeight: 500,
                  letterSpacing: ".1px",
                },
                "&.Mui-selected .nav-indicator": {
                  backgroundColor: "var(--primary-container)",
                  color: "var(--on-container)",
                },
              }}
            />
          ))}
        </BottomNavigation>
      </nav>
      {selected && (
        <Details
          title={selected}
          profile={personal.profile}
          entry={library[selected.id] || empty(selected)}
          update={(p) => update(selected, p)}
          close={() => setSelected(null)}
          toast={toast}
        />
      )}
      {auth && <AuthModal close={() => setAuth(false)} toast={toast} />}
      {notice && (
        <div className="toast surface" role="status">
          {notice}
        </div>
      )}
    </ThemeProvider>
  );
}
function Poster({ title }: { title: Title }) {
  const [failed, setFailed] = useState(false);
  return title.image && !failed ? (
    <img
      src={title.image}
      alt={`Affiche de ${title.name}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="poster-fallback">
      <Film size={30} />
      <span>{title.name}</span>
    </div>
  );
}
function Stars({
  rating,
  onChange,
}: {
  rating: number;
  onChange?: (n: number) => void;
}) {
  return (
    <div
      className={"stars " + (onChange ? "editable" : "")}
      aria-label={`${rating} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            aria-label={`Noter ${n} sur 5`}
            aria-pressed={rating === n}
            onClick={() => onChange(rating === n ? 0 : n)}
          >
            <Star
              size={25}
              fill={n <= rating ? "currentColor" : "none"}
              className={n <= rating ? "filled" : ""}
            />
          </button>
        ) : (
          <Star
            key={n}
            size={14}
            fill={n <= rating ? "currentColor" : "none"}
            className={n <= rating ? "filled" : ""}
          />
        ),
      )}
    </div>
  );
}
function Empty({ text, action }: { text: string; action?: () => void }) {
  return (
    <div className="empty">
      <Clapperboard size={38} />
      <h3>La suite reste à écrire.</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action}>
          Explorer le catalogue <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function Skeleton() {
  return (
    <div className="poster-grid skeletons" aria-label="Chargement du catalogue">
      {[1, 2, 3, 4, 5, 6].map((x) => (
        <div key={x}>
          <div />
          <span />
        </div>
      ))}
    </div>
  );
}
function Modal({
  children,
  close,
  label,
  wide = false,
  style,
}: {
  children: React.ReactNode;
  close: () => void;
  label: string;
  wide?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus();
  }, []);
  return (
    <div
      className={wide ? "modal-overlay details-overlay" : "modal-overlay"}
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const list = ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input,textarea,select",
          );
          if (!list?.length) return;
          const first = list[0],
            last = list[list.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === ref.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <button
          className="modal-close surface"
          aria-label="Fermer"
          onClick={close}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
function Details({
  title: initialTitle,
  entry,
  update: onUpdate,
  close,
  toast,
  profile,
}: {
  profile: Profile;
  title: Title;
  entry: Entry;
  update: (p: Partial<Entry>) => void;
  close: () => void;
  toast: (s: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle),
    [detailState, setDetailState] = useState(
      isTmdb(initialTitle) ? "loading" : "ready",
    ),
    [detailError, setDetailError] = useState(""),
    [detailRetry, setDetailRetry] = useState(0),
    [review, setReview] = useState(entry.review),
    [video, setVideo] = useState(false),
    [sharing, setSharing] = useState(false);
  const update = (patch: Partial<Entry>) => onUpdate({ ...patch, title });
  async function share(reviewOnly = false) {
    if (sharing) return;
    setSharing(true);
    try {
      toast(
        shareMessage(
          await shareCard(
            reviewOnly
              ? reviewShare(profile, { ...entry, title })
              : titleShare(title),
          ),
        ),
      );
    } catch {
      toast("Le partage est indisponible pour le moment.");
    } finally {
      setSharing(false);
    }
  }
  const artwork = title.image || title.backdrop || "";
  const tone = useArtworkTone(artwork);
  useEffect(() => {
    const c = new AbortController();
    if (!isTmdb(initialTitle)) return;
    setDetailState("loading");
    getTitleDetails(initialTitle, c.signal)
      .then((data) => {
        if (!c.signal.aborted) {
          setTitle(data);
          setDetailState("ready");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setDetailState("error");
          setDetailError(e.message || "Fiche indisponible.");
        }
      });
    return () => c.abort();
  }, [initialTitle.id, detailRetry]);
  return (
    <Modal label={title.name} close={close} wide style={toneStyle(tone)}>
      <div className="detail-top">
        <div className="detail-poster">
          <Poster title={title} />
        </div>
        <div>
          <span className="eyebrow">
            {title.kind === "movie" ? "LE GRAND ÉCRAN" : "ENCORE UN ÉPISODE"}
          </span>
          <h2>{title.name}</h2>
          <button
            className="text-button"
            disabled={sharing}
            onClick={() => share()}
          >
            <ShareIcon size={17} />
            Partager cette{" "}
            {title.kind === "movie" ? "fiche film" : "fiche série"}
          </button>
          <p className="detail-meta">
            {title.year} · {title.genres.join(" / ")}
            {title.duration && ` · ${title.duration}`}
          </p>
          {title.score && (
            <p className="detail-score">
              <Star size={15} fill="currentColor" />
              {title.score}
              <span>/10 · {scoreSource(title)}</span>
            </p>
          )}
          <div className="detail-buttons">
            <button
              className={"button " + (entry.watchlist ? "primary" : "surface")}
              onClick={() => update({ watchlist: !entry.watchlist })}
            >
              {entry.watchlist ? <Check size={17} /> : <Plus size={17} />}À voir
            </button>
            <button
              className={"button " + (entry.watched ? "primary" : "surface")}
              onClick={() => update({ watched: !entry.watched })}
            >
              <Check size={17} />
              {entry.watched ? "Vu" : "Marquer vu"}
            </button>
            <button
              className={
                "button icon-button " + (entry.favorite ? "liked" : "surface")
              }
              aria-label="Coup de cœur"
              aria-pressed={entry.favorite}
              onClick={() =>
                update({
                  favorite: !entry.favorite,
                  recommendationFeedback: entry.favorite ? undefined : "like",
                })
              }
            >
              <Heart
                size={19}
                fill={entry.favorite ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>
      </div>
      <div className="detail-body">
        {detailState === "loading" && (
          <p className="muted" role="status">
            Chargement de la fiche TMDB…
          </p>
        )}
        {detailState === "error" && (
          <div className="error" role="alert">
            {detailError}
            <button onClick={() => setDetailRetry((n) => n + 1)}>
              Réessayer la fiche
            </button>
          </div>
        )}
        <h3>L’histoire</h3>
        <p className="synopsis">{title.summary}</p>
        {title.trailer && title.trailerKind === "youtube" && (
          <a
            className="text-button"
            href={title.trailer}
            target="_blank"
            rel="noreferrer"
          >
            <Play size={18} />
            Voir la bande-annonce sur YouTube ↗
          </a>
        )}
        {title.trailer && title.trailerKind !== "youtube" && (
          <>
            <button className="text-button" onClick={() => setVideo(!video)}>
              <Play size={16} />
              {video ? "Fermer l’extrait" : "Voir l’extrait"}
            </button>
            {video && (
              <video
                className="trailer"
                src={title.trailer}
                controls
                autoPlay
                playsInline
              />
            )}
          </>
        )}
        {title.url && (
          <a
            className="source-link"
            href={title.url}
            target="_blank"
            rel="noreferrer"
          >
            {title.kind === "movie"
              ? isTmdb(title)
                ? "Fiche sur TMDB"
                : "Fiche et disponibilité sur Apple TV"
              : isTmdb(title)
                ? "Fiche sur TMDB"
                : "Site de la série"}{" "}
            ↗
          </a>
        )}
        {title.imdbUrl && (
          <a
            className="source-link"
            href={title.imdbUrl}
            target="_blank"
            rel="noreferrer"
          >
            Fiche IMDb ↗
          </a>
        )}
        <div className="review-panel">
          <span className="eyebrow">VOTRE REGARD</span>
          <h3>Et vous, qu’avez-vous ressenti ?</h3>
          <Stars
            rating={entry.rating}
            onChange={(rating) =>
              update({
                rating,
                watched: rating > 0 || entry.watched,
                recommendationFeedback: undefined,
              })
            }
          />
          <label className="field">
            Date du visionnage
            <input
              type="date"
              value={entry.watchedAt}
              onChange={(e) => {
                if (e.target.value) update({ watchedAt: e.target.value });
              }}
            />
          </label>
          <label className="field">
            Votre critique
            <textarea
              maxLength={5000}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Une scène, une émotion, quelques mots…"
              rows={4}
            />
          </label>
          <button
            className="button primary"
            onClick={() => {
              update({ review, watched: true });
              toast("Votre souvenir est enregistré.");
            }}
          >
            Enregistrer mon avis <ArrowRight size={16} />
          </button>
          {entry.review.trim() && (
            <button
              className="text-button"
              disabled={sharing || review !== entry.review}
              onClick={() => share(true)}
            >
              <ShareIcon size={17} />
              Partager mon avis
            </button>
          )}
          {entry.review.trim() && review !== entry.review && (
            <p className="muted fine">
              Enregistrez les modifications avant de partager cet avis.
            </p>
          )}
        </div>
        <label className="field">
          Vos listes personnelles
          <input
            defaultValue={(entry.lists || []).join(", ")}
            placeholder="Soirée cinéma, À revoir, Mes classiques…"
            maxLength={500}
            onBlur={(e) =>
              update({
                lists: [
                  ...new Set(
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  ),
                ].slice(0, 20),
              })
            }
          />
          <span className="muted fine">
            Séparez les noms par une virgule. Enregistrement en quittant le
            champ.
          </span>
        </label>
        {title.kind === "series" &&
          (!isTmdb(title) || detailState === "ready") && (
            <EpisodeTracker
              key={title.id}
              title={title}
              entry={entry}
              update={update}
            />
          )}
      </div>
    </Modal>
  );
}
function SettingsPage({
  close,
  theme,
  setTheme,
  repairNeeded,
  library,
  fallback,
  account,
  backup,
}: {
  backup: BackupController;
  library: Record<string, Entry>;
  fallback: Title[];
  account: string;
  close: () => void;
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  repairNeeded: boolean;
}) {
  const config = getConfig();
  const [url, setUrl] = useState(config.url),
    [key, setKey] = useState(config.key),
    [error, setError] = useState(""),
    [copyMessage, setCopyMessage] = useState(""),
    [tmdbToken, setTmdbToken] = useState(getTmdbCredential()),
    [tmdbError, setTmdbError] = useState(""),
    [checkingTmdb, setCheckingTmdb] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <section className="settings-page page-section" aria-label="Réglages">
      <button
        className="text-button settings-back"
        onClick={close}
        aria-label="Retour"
      >
        <ArrowLeft size={20} /> Retour
      </button>
      <h1 ref={heading} tabIndex={-1}>
        Réglages
      </h1>
      <div className="form-content">
        <span className="eyebrow">À VOTRE IMAGE</span>
        <h2>Apparence</h2>
        <p className="muted">
          {Capacitor.isNativePlatform()
            ? "Les couleurs de l’application et des barres Android suivent ce choix."
            : "Le site suit ce thème sur votre navigateur. Le mode Système s’adapte aux réglages de votre ordinateur ou de votre téléphone."}
        </p>
        <div
          className="theme-options"
          role="group"
          aria-label="Thème de l’application"
        >
          {(["dark", "light", "system"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === "dark"
                ? "Sombre"
                : value === "light"
                  ? "Clair"
                  : "Système"}
            </button>
          ))}
        </div>
        <hr />
        <BackupSettings
          backup={backup}
          connected={account !== "local"}
          configured={Boolean(cloud)}
        />
        <hr />
        <NotificationSettings
          library={library}
          fallback={fallback}
          account={account}
        />
        <hr />
        <span className="eyebrow">PLUS D’HISTOIRES</span>
        <h2>Catalogue TMDB</h2>
        <p className="muted">
          Films et séries, titres français et originaux, affiches, fiches et
          épisodes. Une clé API gratuite est nécessaire pour un usage non
          commercial.
        </p>
        <ol className="catalog-help">
          <li>
            Créez un compte sur{" "}
            <a
              href="https://www.themoviedb.org/signup"
              target="_blank"
              rel="noreferrer"
            >
              themoviedb.org
            </a>
            .
          </li>
          <li>
            Dans le navigateur, ouvrez{" "}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
            >
              Paramètres → API
            </a>
            , puis demandez une clé développeur. Sur téléphone, activez au
            besoin « site pour ordinateur ».
          </li>
          <li>
            Collez ici le jeton de lecture API ou la clé API v3. Ne les envoyez
            pas dans ChatGPT.
          </li>
        </ol>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setCheckingTmdb(true);
            setTmdbError("");
            try {
              await saveTmdbCredential(tmdbToken);
            } catch (error) {
              setTmdbError(
                error instanceof Error
                  ? error.message
                  : "TMDB n’est pas joignable. Vérifiez la connexion et réessayez.",
              );
            } finally {
              setCheckingTmdb(false);
            }
          }}
        >
          <label className="field">
            Jeton de lecture TMDB ou clé API
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={tmdbToken}
              onChange={(e) => setTmdbToken(e.target.value)}
              required
              placeholder="Jeton eyJ… ou clé API v3"
            />
          </label>
          <p className="muted fine">
            Enregistré uniquement sur cet appareil. Ce réglage est indépendant
            de Supabase ; vos listes et notes sont conservées.
          </p>
          {tmdbError && (
            <p className="error" role="alert">
              {tmdbError}
            </p>
          )}
          <button className="button primary" disabled={checkingTmdb}>
            {checkingTmdb ? (
              <>
                <LoaderCircle className="spin" size={18} />
                Vérification…
              </>
            ) : (
              "Activer TMDB"
            )}
          </button>
        </form>
        {tmdbEnabled() && (
          <button className="text-button disconnect" onClick={disableTmdb}>
            Revenir au catalogue limité
          </button>
        )}
        <hr />
        <span className="eyebrow">VOTRE ESPACE, PARTOUT</span>
        <h2>
          Connecter Supabase<span>.</span>
        </h2>
        <p className="muted">
          Sans configuration, Vela garde vos données sur cet appareil. Pour
          synchroniser, créez un projet Supabase gratuit, exécutez le fichier{" "}
          <code>supabase/schema.sql</code> et renseignez les identifiants
          publics du projet.
        </p>
        <details className="sql-guide" open={repairNeeded}>
          <summary>Corriger l’erreur public.library</summary>
          <ol>
            <li>
              Ouvrez le projet Supabase dont l’URL est renseignée ci-dessous.
            </li>
            <li>
              Dans SQL Editor → New query, collez ce script puis appuyez sur
              Run.
            </li>
            <li>
              Revenez dans Profil et appuyez sur Synchroniser. Le site web n’a
              pas besoin d’être publié.
            </li>
          </ol>
          <label className="field">
            Script SQL de réparation
            <textarea
              aria-label="Script SQL de réparation"
              readOnly
              value={repairSql}
              rows={8}
            />
          </label>
          <button
            className="button tonal"
            onClick={async () => {
              try {
                await Clipboard.write({ string: repairSql });
                setCopyMessage(
                  "Script copié. Collez-le dans SQL Editor de Supabase.",
                );
              } catch {
                setCopyMessage(
                  "Copie indisponible. Sélectionnez le script ci-dessus pour le copier.",
                );
              }
            }}
          >
            Copier le script SQL
          </button>
          {copyMessage && (
            <p className="muted" role="status">
              {copyMessage}
            </p>
          )}
        </details>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              saveConfig(url, key);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <label className="field">
            URL du projet
            <input
              type="url"
              required
              placeholder="https://votre-projet.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="field">
            Clé publique (publishable ou anon)
            <input
              required
              placeholder="sb_publishable_… ou eyJ…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <p className="muted fine">
            N’utilisez jamais une clé secret ou service_role. Ces identifiants
            publics restent sur cet appareil. Les politiques de sécurité du
            schéma protègent votre collection.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary">
            Enregistrer et recharger <ArrowRight size={17} />
          </button>
        </form>
        {config.url && (
          <button
            className="text-button disconnect"
            onClick={() => {
              localStorage.removeItem("luma-cloud");
              location.reload();
            }}
          >
            Réinitialiser la configuration locale
          </button>
        )}
      </div>
      <SettingsFooter />
    </section>
  );
}
function AuthModal({
  close,
  toast,
}: {
  close: () => void;
  toast: (s: string) => void;
}) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal label="Connexion" close={close}>
      <div className="form-content">
        <span className="eyebrow">BIENVENUE CHEZ VOUS</span>
        <h2>
          {signup
            ? "Votre histoire commence."
            : "Le plaisir de vous retrouver."}
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cloud) return;
            setBusy(true);
            setError("");
            try {
              const result = signup
                ? await cloud.auth.signUp({
                    email,
                    password,
                    ...(!Capacitor.isNativePlatform()
                      ? {
                          options: {
                            emailRedirectTo:
                              location.origin + location.pathname,
                          },
                        }
                      : {}),
                  })
                : await cloud.auth.signInWithPassword({ email, password });
              if (result.error) throw result.error;
              toast(
                signup && !result.data.session
                  ? "Confirmez votre adresse avec l’e-mail reçu."
                  : "Vous êtes connecté.",
              );
              close();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Mot de passe
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : signup ? (
              "Créer mon compte"
            ) : (
              "Me connecter"
            )}
          </button>
        </form>
        <button
          className="text-button auth-toggle"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
        >
          {signup ? "J’ai déjà un compte" : "Créer un compte gratuit"}
          <ArrowRight size={15} />
        </button>
      </div>
    </Modal>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
