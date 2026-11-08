import { authReturn } from "./auth-return";
import AuthConfirmation from "./AuthConfirmation";
import AccountSetup from "./AccountSetup";
import {
  needsAccountSetup,
  applySetupAnswers,
  type SetupDraft,
} from "./account-setup";
import { syncAccountState } from "./account-state";
import LanguageSelect from "./LanguageSelect";
import { useLanguagePreference } from "./language-preferences";
import { t as tr, getLanguage, useLanguage } from "./i18n";
import TasteMap from "./TasteMap";
import { chooseHomeHero } from "./home-history";
import { rememberHomeExposure } from "./home-history";
import { useAccountSettings } from "./useAccountSettings";
import { useNotificationPreference } from "./useNotificationPreference";
import type { PreferenceValues } from "./account-state";
import Welcome from "./Welcome";
import AuthForm from "./AuthForm";
import { readWelcomeCompleted, markWelcomeCompleted } from "./onboarding";
import TitleReview, { PersonalTracking } from "./TitleReview";
import Modal from "./Modal";
import ShareLinkDialog from "./ShareLinkDialog";
import StoryShareDialog from "./StoryShareDialog";
import type { StoryDraft } from "./story-image";
import PublicPage, { parsePublicRoute } from "./PublicPage";
import PublicSharingSettings from "./PublicSharingSettings";
import ViewingSettings from "./ViewingSettings";
import {
  useViewingPreferences,
  syncViewingPreferences,
  type ViewingPreferences,
} from "./viewing-preferences";
import WhereToWatch from "./WhereToWatch";
import CastGallery from "./CastGallery";
import "@fontsource/dm-sans/latin-400.css";
import { Brand, SettingsFooter } from "./Brand";
import Avatar from "./Avatar";
import ProfileOverview from "./ProfileOverview";
import ProfileEditor from "./ProfileEditor";
import { useProfile } from "./useProfile";
import {
  reviewShare,
  titleShare,
  shareCard,
  shareMessage,
  publicTitleUrl,
  type ShareDraft,
} from "./sharing";
import type { Profile } from "./profile";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { updateSystemAppearance, type ThemePreference } from "./appearance";
import {
  applyColourTheme,
  colourThemeKey,
  getColourTheme,
  readColourTheme,
} from "./colour-themes";
import ColourThemePicker from "./ColourThemePicker";
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
import SignInRequired from "./SignInRequired";
import { defaultServices } from "./service-config";
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
  | "public"
  | "discover"
  | "search"
  | "library"
  | "recommendations"
  | "profile"
  | "settings"
  | "edit-profile"
  | "taste-map";
const pageNames: Page[] = [
  "public",
  "discover",
  "search",
  "library",
  "recommendations",
  "profile",
  "settings",
  "edit-profile",
  "taste-map",
];
function App() {
  const language = useLanguage();
  const [welcomeCompleted, setWelcomeCompleted] =
    useState(readWelcomeCompleted);
  const [authReady, setAuthReady] = useState(!cloud);
  const welcomeBack = useRef<() => boolean>(() => false);
  const setupBack = useRef<() => boolean>(() => false);
  const [confirmationOpen, setConfirmationOpen] = useState(Boolean(authReturn));
  const [setupRequested, setSetupRequested] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState("");
  const [publicRoute, setPublicRoute] = useState(() => parsePublicRoute());
  const [shareDraft, setShareDraft] = useState<ShareDraft | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);
  const titleSharing = useRef(false);
  const [colourTheme, setColourThemeValue] = useState(readColourTheme);
  const [feedSession, setFeedSession] = useState(0);
  const [homeVisit, setHomeVisit] = useState(0);
  const catalogueAt = useRef(0);
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
      parsePublicRoute()
        ? "public"
        : location.hash === "#settings/tastes"
          ? "taste-map"
          : location.hash === "#settings"
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
    [theme, setThemeValue] = useState<ThemePreference>(() => {
      const saved = localStorage.getItem("luma-theme");
      return saved === "light" || saved === "system" ? saved : "dark";
    }),
    [systemLight, setSystemLight] = useState(
      () => matchMedia("(prefers-color-scheme: light)").matches,
    );
  const needsWelcome =
    Capacitor.isNativePlatform() && !welcomeCompleted && !user && !publicRoute;
  function finishWelcome() {
    markWelcomeCompleted();
    setWelcomeCompleted(true);
  }
  useEffect(() => {
    if (user && !welcomeCompleted) finishWelcome();
  }, [user?.id, welcomeCompleted]);
  const accountSettings = useAccountSettings(
    user,
    (prefs) => {
      if (prefs.palette) setColourThemeValue(prefs.palette);
      if (prefs.theme) setThemeValue(prefs.theme);
    },
    {
      palette: colourTheme,
      theme,
      backupFrequency: backupService.state(user?.id || "local").frequency,
    },
  );
  function setTheme(value: ThemePreference) {
    setThemeValue(value);
    accountSettings.change("theme", value);
  }
  function setColourTheme(value: string) {
    setColourThemeValue(value);
    accountSettings.change("palette", value);
  }
  const languagePreference = useLanguagePreference(user);
  const personal = useProfile(user);
  const viewing = useViewingPreferences(user);
  useEffect(() => {
    setShareDraft(null);
    setStoryDraft(null);
  }, [user?.id]);
  const awaitingSetup = Boolean(
    user &&
    !publicRoute &&
    (setupRequested || (needsAccountSetup(user) && setupDismissed !== user.id)),
  );
  const showSetup = awaitingSetup && accountSettings.ready;
  function closeConfirmation(signIn = false) {
    const url = new URL(location.href);
    for (const key of [
      "auth",
      "code",
      "error",
      "error_code",
      "error_description",
    ])
      url.searchParams.delete(key);
    url.hash = "";
    history.replaceState({}, "", url.pathname + url.search);
    setConfirmationOpen(false);
    if (signIn) {
      finishWelcome();
      setAuth(true);
    }
  }
  const light = theme === "system" ? systemLight : theme === "light";
  const preset = getColourTheme(colourTheme);
  const colors = preset[light ? "light" : "dark"];
  const materialTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: light ? "light" : "dark",
          primary: {
            main: preset.hex,
            contrastText: preset.ink,
          },
          background: {
            default: colors.bg,
            paper: colors.surface,
          },
          text: {
            primary: colors.text,
            secondary: colors.muted,
          },
        },
        typography: { fontFamily: '"DM Sans", Arial, sans-serif' },
        shape: { borderRadius: 20 },
      }),
    [light, preset],
  );
  const recommendationLibrary = React.useMemo(
    () => (cloud && !user ? {} : library),
    [library, user?.id],
  );
  useDailyRecommendations(
    recommendationLibrary,
    filmList,
    (title) => {
      setPage("recommendations");
      setSelected(title || null);
    },
    user?.id || "local",
    openSettings,
  );
  useNotificationPreference(
    accountSettings.values.notifications,
    user?.id || "local",
    accountSettings.ready,
    recommendationLibrary,
    filmList,
  );
  const moreAbort = useRef<AbortController | null>(null);
  const searchIdentity = useRef("");
  searchIdentity.current = `${page}|${kind}|${query}|${language}`;
  const local = useRef(library);
  local.current = library;
  const activeAccount = useRef(user?.id);
  activeAccount.current = user?.id;
  const backup = useCloudBackup(
    user?.id,
    (account, data) => {
      if (activeAccount.current !== account) return;
      local.current = data;
      setLibrary(data);
    },
    accountSettings.ready,
  );
  const syncState = backup.status,
    syncIssue = backup.issue;

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function toast(message: string) {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  }
  function requestShare(draft: ShareDraft) {
    if (draft.kind !== "title") {
      setShareDraft(draft);
      return;
    }
    if (titleSharing.current) return;
    titleSharing.current = true;
    shareCard(draft)
      .then((result) => toast(shareMessage(result)))
      .catch(() => toast(tr("Le partage est indisponible pour le moment.")))
      .finally(() => {
        titleSharing.current = false;
      });
  }
  function openPublicTitle(title: Title) {
    const hash = new URL(publicTitleUrl(title)).hash;
    history.pushState({ lumaPage: "public" }, "", hash);
    setPublicRoute(parsePublicRoute(hash));
    setPage("public");
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function load() {
    const requestedLanguage = getLanguage();
    setLoading(true);
    setError("");
    const r = await Promise.allSettled([movies(), series()]);
    if (requestedLanguage !== getLanguage()) return;
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
                  tr("Catalogue indisponible."),
              ),
          ),
        ].join(" ") + tr(" Vos listes restent accessibles."),
      );
    catalogueAt.current = Date.now();
    setLoading(false);
  }
  useEffect(() => {
    if (!cloud) return;
    let mounted = true;
    cloud.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setUser(data.session?.user || null);
        const restored = data.session;
        if (restored && needsAccountSetup(restored.user)) {
          void cloud!.auth
            .getUser(restored.access_token)
            .then(({ data }) => {
              if (
                mounted &&
                data.user?.id === restored.user.id &&
                activeAccount.current === restored.user.id
              )
                setUser(data.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        /* The welcome screen remains available if session recovery fails. */
      })
      .finally(() => {
        if (mounted) setAuthReady(true);
      });
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user || null);
        setAuthReady(true);
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!needsWelcome && !awaitingSetup && !confirmationOpen) void load();
  }, [needsWelcome, awaitingSetup, confirmationOpen, language]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemLight(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useLayoutEffect(() => {
    applyColourTheme(colourTheme, light);
    try {
      localStorage.setItem("luma-theme", theme);
      localStorage.setItem(colourThemeKey, colourTheme);
    } catch {
      /* The selected theme still works when storage is unavailable. */
    }
  }, [light, theme, colourTheme]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === colourThemeKey)
        setColourThemeValue(getColourTheme(event.newValue).id);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    updateSystemAppearance(light, colourTheme).catch(() =>
      toast(
        tr(
          "Les couleurs système n’ont pas pu être mises à jour. Réessayez en changeant le thème.",
        ),
      ),
    );
  }, [light, colourTheme]);
  async function syncNow() {
    if (await backup.syncNow()) toast(tr("Synchronisation terminée."));
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
          setError(
            e instanceof Error ? e.message : tr("Recherche indisponible."),
          );
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
  }, [query, kind, page, language]);
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
        setError(
          e instanceof Error ? e.message : tr("Chargement indisponible."),
        );
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
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [selected, auth]);
  async function commitSetupTastes(draft: SetupDraft) {
    const account = user?.id;
    if (!account) throw new Error("no account");
    if (Object.values(draft.answers).some((a) => a !== "skip")) {
      if (!(await backup.syncNow()) || activeAccount.current !== account)
        throw new Error("backup failed");
      const previous = local.current,
        next = applySetupAnswers(previous, draft);
      if (Object.keys(next).some((id) => next[id] !== previous[id])) {
        write(next, account);
        local.current = next;
        setLibrary(next);
        backupService.changed(account);
        if (!(await backup.syncNow()) || activeAccount.current !== account)
          throw new Error("backup failed");
      }
    }
    await syncAccountState(account);
    if (activeAccount.current !== account) throw new Error("account changed");
  }
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
      toast(tr("Stockage plein : exportez votre collection."));
      return;
    }
    if (user) {
      try {
        backupService.changed(user.id);
      } catch {
        toast(
          tr(
            "Votre changement est enregistré. Exportez votre collection si le stockage est plein.",
          ),
        );
      }
    }
  }

  function navigate(p: Page) {
    if (p === "discover" && p !== page) setHomeVisit((n) => n + 1);
    if (publicRoute) {
      history.pushState(
        { lumaPage: p },
        "",
        location.pathname + location.search,
      );
      setPublicRoute(null);
    }
    if (
      (page === "settings" ||
        page === "edit-profile" ||
        page === "taste-map") &&
      p !== page
    )
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
      page === "public" ? location.href : location.pathname + location.search,
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
  function openTasteMap() {
    history.replaceState({ lumaPage: "settings" }, "", "#settings");
    history.pushState(
      { lumaPage: "taste-map", velaTasteEntry: true },
      "",
      "#settings/tastes",
    );
    setPage("taste-map");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function closeTasteMap() {
    if (history.state?.velaTasteEntry) history.back();
    else {
      history.replaceState({ lumaPage: "settings" }, "", "#settings");
      setPage("settings");
    }
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
    const pop = (event: PopStateEvent | HashChangeEvent) => {
      const route = parsePublicRoute();
      setPublicRoute(route);
      if (route) {
        setPage("public");
        setSelected(null);
        return;
      }
      const target = ("state" in event ? event.state : history.state)?.lumaPage;
      setPage(
        pageNames.includes(target) && target !== "public"
          ? target
          : location.hash === "#settings/tastes"
            ? "taste-map"
            : location.hash === "#settings"
              ? "settings"
              : location.hash === "#profile/edit"
                ? "edit-profile"
                : "discover",
      );
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", pop);
    };
  }, []);
  useEffect(() => {
    const back = () => {
      if (confirmationOpen) {
        closeConfirmation();
        return true;
      }
      if (awaitingSetup) return setupBack.current() || true;
      if (needsWelcome) return welcomeBack.current();
      if (storyDraft) {
        setStoryDraft(null);
        return true;
      }
      if (shareDraft) {
        setShareDraft(null);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      if (auth) {
        setAuth(false);
        return true;
      }
      if (page === "taste-map") {
        closeTasteMap();
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
      if (
        event.key === "Escape" &&
        !selected &&
        !auth &&
        !storyDraft &&
        !shareDraft
      ) {
        if (confirmationOpen) {
          closeConfirmation();
          return;
        }
        if (awaitingSetup) {
          setupBack.current();
          return;
        }
        if (needsWelcome) {
          welcomeBack.current();
          return;
        }
        if (page === "taste-map") closeTasteMap();
        else if (page === "settings") closeSettings();
        else if (page === "edit-profile") closeProfileEditor();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      delete (window as any).lumaHandleBack;
      document.removeEventListener("keydown", escape);
    };
  }, [
    page,
    selected,
    auth,
    shareDraft,
    storyDraft,
    needsWelcome,
    awaitingSetup,
    confirmationOpen,
  ]);
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
    if (page !== "discover" || (cloud && !user))
      return {
        movies: filmList,
        series: showList,
        hero: chooseHomeHero([...filmList, ...showList], user?.id || "local"),
        personalized: false,
      };
    const cached = readRecommendationSession(
      user?.id || "local",
    ).candidates.map((candidate) => candidate.title);
    return personalizeHome(
      library,
      [...filmList, ...cached],
      showList,
      user?.id || "local",
    );
  }, [
    library,
    filmList,
    showList,
    page,
    user?.id,
    feedSession,
    homeVisit,
    language,
  ]);
  const hero = home.hero;
  useEffect(() => {
    if (
      needsWelcome ||
      awaitingSetup ||
      confirmationOpen ||
      page !== "discover" ||
      !hero ||
      selected ||
      document.hidden
    )
      return;
    const timer = setTimeout(() => {
      if (!document.hidden) rememberHomeExposure(hero, user?.id || "local");
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    page,
    hero?.id,
    selected,
    feedSession,
    homeVisit,
    user?.id,
    needsWelcome,
    awaitingSetup,
    confirmationOpen,
  ]);
  useEffect(() => {
    if (
      !needsWelcome &&
      page === "discover" &&
      catalogueAt.current &&
      Date.now() - catalogueAt.current > 30 * 60000
    )
      void load();
  }, [page, feedSession, homeVisit, needsWelcome]);
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
          {title.kind === "series" ? tr("SÉRIE") : "FILM"}
        </span>
      </div>
      <h3>{title.name}</h3>
      <p>
        {title.year || "—"}
        <span>•</span>
        {title.genres[0] || tr("À découvrir")}
      </p>
    </button>
  );
  if (confirmationOpen)
    return (
      <ThemeProvider theme={materialTheme}>
        <AuthConfirmation
          ready={authReady}
          continueToApp={() => closeConfirmation()}
          signIn={() => closeConfirmation(true)}
        />
      </ThemeProvider>
    );
  if (awaitingSetup && !accountSettings.ready)
    return (
      <ThemeProvider theme={materialTheme}>
        <main
          className="welcome-loading"
          aria-label={tr("Chargement de votre profil")}
        >
          <Brand />
          <LoaderCircle className="spin" />
        </main>
      </ThemeProvider>
    );
  if (showSetup && user)
    return (
      <ThemeProvider theme={materialTheme}>
        <AccountSetup
          key={user.id}
          user={user}
          profile={personal.profile}
          viewing={viewing.value}
          library={library}
          palette={colourTheme}
          theme={theme}
          setPalette={setColourTheme}
          setTheme={setTheme}
          setLanguage={(code) => void languagePreference.save(code)}
          commitTastes={commitSetupTastes}
          backHandler={setupBack}
          finish={() => {
            setSetupRequested(false);
            setSetupDismissed(user.id);
            finishWelcome();
          }}
          postpone={() => {
            setSetupRequested(false);
            setSetupDismissed(user.id);
            finishWelcome();
          }}
        />
      </ThemeProvider>
    );
  if (needsWelcome)
    return (
      <ThemeProvider theme={materialTheme}>
        {authReady ? (
          <Welcome finish={finishWelcome} backHandler={welcomeBack} />
        ) : (
          <main
            className="welcome-loading"
            aria-label={tr("Chargement de Vela")}
            aria-busy="true"
          >
            <span className="welcome-brand" aria-label="Vela">
              <Brand />
            </span>
            <LoaderCircle className="spin" size={24} />
          </main>
        )}
      </ThemeProvider>
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
        <nav>
          {(
            [
              [Compass, "discover", tr("Découvrir")],
              [Search, "search", tr("Explorer")],
              [Sparkles, "recommendations", tr("Pour vous")],
              [Bookmark, "library", tr("Ma collection")],
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
            {light ? <Moon size={18} /> : <Sun size={18} />}
            {light ? tr("Mode sombre") : tr("Mode clair")}
          </button>
          <button className="nav-link" onClick={() => openSettings()}>
            <Settings size={18} />
            {tr("Réglages")}
          </button>
          <button
            className="account"
            onClick={() =>
              cloud && !user ? setAuth(true) : navigate("profile")
            }
          >
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
              {user
                ? tr("Mon espace")
                : cloud
                  ? tr("Se connecter")
                  : tr("Votre espace")}
              <small>
                {user
                  ? tr("Compte Vela")
                  : cloud
                    ? tr("Compte Vela")
                    : tr("Collection locale")}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <main
        className={
          page === "recommendations" &&
          Capacitor.isNativePlatform() &&
          (!cloud || user)
            ? "is-feed"
            : undefined
        }
      >
        <header className="topbar">
          <div className="mobile-logo logo">
            <Brand />
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={
                light ? tr("Passer en mode sombre") : tr("Passer en mode clair")
              }
              onClick={() => setTheme(light ? "dark" : "light")}
            >
              {light ? <Moon size={22} /> : <Sun size={22} />}
            </button>
            <button
              className="icon-button mobile-settings"
              aria-label={tr("Réglages")}
              onClick={() => openSettings()}
            >
              <Settings size={22} />
            </button>
          </div>
        </header>
        {page === "public" && publicRoute && (
          <PublicPage
            route={publicRoute}
            open={openPublicTitle}
            renderTitle={(title) => (
              <Details
                key={`${user?.id || "local"}:${title.id}`}
                title={title}
                profile={personal.profile}
                entry={library[title.id] || empty(title)}
                update={(patch) => update(title, patch)}
                close={() => navigate("discover")}
                toast={toast}
                onShare={requestShare}
                onStory={setStoryDraft}
                inline
                readOnly={Boolean(cloud && !user)}
                signIn={() => setAuth(true)}
                viewing={viewing.value}
                settings={openSettings}
              />
            )}
          />
        )}
        {page === "taste-map" &&
          (cloud && !user ? (
            <SignInRequired
              title={tr("Carte de mes goûts")}
              message={tr(
                "Connectez-vous pour explorer votre carte personnelle.",
              )}
              signIn={() => setAuth(true)}
            />
          ) : (
            <TasteMap
              library={library}
              account={user?.id || "local"}
              close={closeTasteMap}
              open={setSelected}
            />
          ))}
        {page === "settings" && (
          <SettingsPage
            theme={theme}
            setTheme={setTheme}
            colourTheme={colourTheme}
            setColourTheme={setColourTheme}
            viewing={viewing}
            repairNeeded={syncIssue?.kind === "schema"}
            library={library}
            fallback={filmList}
            account={user?.id || "local"}
            backup={backup}
            accountSettings={accountSettings}
            languagePreference={languagePreference}
            openTasteMap={openTasteMap}
            openSetup={() => {
              if (user) {
                setSetupRequested(true);
                setSelected(null);
              } else setAuth(true);
            }}
            close={closeSettings}
            signIn={() => setAuth(true)}
          />
        )}
        {(page === "discover" || page === "search") && !tmdbEnabled() && (
          <aside className="catalog-setup">
            <div>
              <strong>{tr("Élargissez votre catalogue avec TMDB")}</strong>
              <p>
                {tr(
                  "Le catalogue sans clé est limité. Activez TMDB pour rechercher davantage de films et de séries.",
                )}
              </p>
            </div>
            <button className="button tonal" onClick={() => openSettings()}>
              {tr("Configurer TMDB ")}
              <ArrowRight size={18} />
            </button>
          </aside>
        )}
        {page === "discover" && (
          <>
            <section className="intro">
              <h1>{tr("Films et séries")}</h1>
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
                {hero && (
                  <div className="hero-kicker">
                    {home.personalized
                      ? tr("Selon vos goûts")
                      : tr("À découvrir")}
                  </div>
                )}
                <h2>
                  {hero?.name ||
                    (loading
                      ? tr("Chargement…")
                      : tr("Catalogue indisponible"))}
                </h2>
                {hero && (
                  <div className="hero-meta">
                    {hero.year && (
                      <>
                        <span>{hero.year}</span>
                        <i />
                      </>
                    )}
                    {hero.genres.slice(0, 2).join(" / ") ||
                      (hero.kind === "series" ? tr("Série") : tr("Film"))}
                    {hero.score && (
                      <>
                        <i />
                        <Star size={13} fill="currentColor" />
                        {hero.score}/10
                      </>
                    )}
                  </div>
                )}
                <p>
                  {hero
                    ? hero.summary || tr("Synopsis indisponible.")
                    : loading
                      ? tr("Chargement des films et séries…")
                      : tr(
                          "Vérifiez votre connexion ou la configuration du catalogue.",
                        )}
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    disabled={!hero}
                    onClick={() => hero && setSelected(hero)}
                  >
                    {tr("Découvrir ")}
                    <ArrowRight size={17} />
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
                            ? tr("Retiré de votre liste")
                            : tr("Ajouté à votre liste"),
                        );
                      }
                    }}
                  >
                    {hero && library[hero.id]?.watchlist ? (
                      <Check size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    {tr("Ma liste")}
                  </button>
                </div>
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
                      ? tr("À la une")
                      : k === "movie"
                        ? tr("Films")
                        : tr("Séries")}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={load}>{tr("Réessayer")}</button>
              </div>
            )}
            {loading ? (
              <Skeleton />
            ) : (
              <>
                {kind !== "series" && (
                  <section className="shelf">
                    <div className="section-heading">
                      <h2>{tr("Films")}</h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setKind("movie");
                          navigate("search");
                        }}
                      >
                        {tr("Tout explorer ")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="poster-grid">
                      {home.movies.slice(0, 6).map(card)}
                    </div>
                    {!home.movies.length && (
                      <Empty
                        text={tr(
                          "Les films sont indisponibles pour le moment.",
                        )}
                      />
                    )}
                  </section>
                )}
                {kind !== "movie" && (
                  <section className="shelf">
                    <div className="section-heading">
                      <h2>{tr("Séries")}</h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setKind("series");
                          navigate("search");
                        }}
                      >
                        {tr("Toutes les séries ")}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="poster-grid">
                      {home.series.slice(0, 6).map(card)}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
        {page === "search" && (
          <section className="page-section">
            <h1>{tr("Rechercher")}</h1>
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
                    ? tr("Un titre français ou original…")
                    : tr("Un titre de film ou de série…")
                }
                aria-label={tr("Rechercher dans le catalogue")}
              />
              {query && (
                <button
                  type="button"
                  aria-label={tr("Effacer")}
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
                  {k === "all"
                    ? tr("Tout")
                    : k === "movie"
                      ? tr("Films")
                      : tr("Séries")}
                </button>
              ))}
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
                <button onClick={() => openSettings()}>
                  {tr("Réglages du catalogue")}
                </button>
              </div>
            )}
            {searching ? (
              <Skeleton />
            ) : query.trim() ? (
              <>
                <p className="result-count">
                  {results.length} {tr(" affichés sur ")}
                  {totalResults} {tr(" résultat")}
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
                          {tr("Chargement…")}
                        </>
                      ) : (
                        tr("Charger plus de résultats")
                      )}
                    </button>
                  </div>
                )}
                {!results.length && !error && (
                  <Empty text={tr("Aucun résultat. Essayez un autre titre.")} />
                )}
              </>
            ) : (
              <div className="search-suggestions">
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
            cloud && !user ? (
              <SignInRequired
                title={tr("Pour vous")}
                message={tr(
                  "Connectez-vous pour accéder à vos recommandations personnalisées.",
                )}
                signIn={() => setAuth(true)}
              />
            ) : (
              <Recommendations
                key={`${user?.id || "local"}:${feedSession}:${language}`}
                account={user?.id || "local"}
                paused={Boolean(selected || auth)}
                library={library}
                fallback={filmList}
                open={setSelected}
                update={update}
                configure={() => openSettings()}
              />
            )
          ) : (
            <WebRecommendationsNotice
              explore={() => navigate("search")}
              signIn={cloud && !user ? () => setAuth(true) : undefined}
            />
          ))}
        {page === "library" && (
          <section className="page-section">
            <h1>{tr("Collection")}</h1>
            <div className="tabs inline-tabs">
              {[
                ["watchlist", tr("À voir"), watchlist.length],
                ["watched", tr("Vus"), watched.length],
                ["favorite", tr("Favoris"), favorites.length],
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
                text={tr("Votre collection est vide.")}
                action={() => navigate("search")}
              />
            )}
          </section>
        )}
        {page === "edit-profile" &&
          (cloud && !user ? (
            <SignInRequired
              title={tr("Profil")}
              message={tr(
                "Connectez-vous pour modifier votre profil et le retrouver sur vos appareils.",
              )}
              signIn={() => setAuth(true)}
            />
          ) : (
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
          ))}
        {page === "profile" &&
          (cloud && !user ? (
            <SignInRequired
              title={tr("Profil")}
              message={tr(
                "Connectez-vous pour retrouver votre profil, vos statistiques et vos sauvegardes.",
              )}
              signIn={() => setAuth(true)}
            />
          ) : (
            <section className="page-section profile">
              <h1>{tr("Profil")}</h1>
              <ProfileOverview
                profile={personal.profile}
                library={library}
                email={user?.email}
                edit={openProfileEditor}
                open={setSelected}
                toast={toast}
                pending={Boolean(user && personal.pending)}
                share={requestShare}
                story={setStoryDraft}
              />
              {personal.error && <p className="muted fine">{personal.error}</p>}
              <div className="profile-panel surface">
                <div>
                  <h2>{tr("Synchronisation")}</h2>
                  <p className="muted">
                    {user
                      ? syncState === "success"
                        ? tr("Vos notes et vos listes sont synchronisées.")
                        : syncState === "syncing"
                          ? tr("Synchronisation en cours…")
                          : syncState === "error"
                            ? tr(
                                "La synchronisation a échoué. Vos données restent sur cet appareil.",
                              )
                            : syncState === "pending"
                              ? tr(
                                  "Vos changements sont enregistrés sur cet appareil et attendent la prochaine sauvegarde Supabase.",
                                )
                              : tr(
                                  "Votre collection est enregistrée sur cet appareil.",
                                )
                      : tr(
                          "Connectez Supabase pour retrouver vos listes sur le web et Android.",
                        )}
                  </p>
                  {user && backup.state.lastSuccess > 0 && (
                    <p className="muted fine">
                      {tr("Dernière sauvegarde :")}{" "}
                      {new Date(backup.state.lastSuccess).toLocaleString(
                        getLanguage(),
                      )}
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
                        ? tr("Synchronisation…")
                        : tr("Synchroniser")}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={tr("Se déconnecter")}
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
                    {cloud ? tr("Se connecter") : tr("Configurer Supabase")}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              {syncIssue && (
                <section className="sync-error" role="alert">
                  <h3>{tr("Synchronisation à rétablir")}</h3>
                  <p>{tr(syncIssue.message)}</p>
                  <button
                    className="button tonal"
                    onClick={() => openSettings()}
                  >
                    {tr("Corriger Supabase ")}
                    <ArrowRight size={18} />
                  </button>
                </section>
              )}
              <div className="profile-panel">
                <div>
                  <h3>{tr("Sauvegarde locale")}</h3>
                  <p className="muted">
                    {tr(
                      "Une sauvegarde JSON de vos notes, listes et visionnages.",
                    )}
                  </p>
                </div>
                <button
                  className="button surface"
                  onClick={() =>
                    exportCollection(library).catch(() =>
                      toast(tr("Export annulé ou indisponible.")),
                    )
                  }
                >
                  <Download size={17} />
                  {tr("Exporter")}
                </button>
                <label className="button surface">
                  {tr("Importer")}
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
                              tr(
                                "Collection importée. Vérifiez l’espace disponible avant la sauvegarde.",
                              ),
                            );
                          }
                        }
                        toast(tr("Collection importée."));
                      } catch {
                        toast(
                          tr(
                            "Import impossible : vérifiez le fichier JSON ou la connexion.",
                          ),
                        );
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </section>
          ))}
      </main>
      <nav className="mobile-nav" aria-label={tr("Navigation principale")}>
        <BottomNavigation
          showLabels
          value={page === "edit-profile" ? "profile" : page}
          onChange={(_event, value) => navigate(value)}
          sx={{ height: 80, bgcolor: "transparent", width: "100%" }}
        >
          {(
            [
              [Compass, "discover", tr("Découvrir")],
              [Search, "search", tr("Explorer")],
              [Sparkles, "recommendations", tr("Pour vous")],
              [Bookmark, "library", tr("Collection")],
              [User, "profile", tr("Profil")],
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
                  backgroundColor: "var(--brand)",
                  color: "var(--on-brand)",
                },
              }}
            />
          ))}
        </BottomNavigation>
      </nav>
      {selected && (
        <Details
          key={`${user?.id || "local"}:${selected.id}`}
          title={selected}
          readOnly={Boolean(cloud && !user)}
          signIn={() => setAuth(true)}
          onShare={requestShare}
          onStory={setStoryDraft}
          viewing={viewing.value}
          settings={openSettings}
          profile={personal.profile}
          entry={library[selected.id] || empty(selected)}
          update={(p) => update(selected, p)}
          close={() => setSelected(null)}
          toast={toast}
        />
      )}
      {shareDraft && (
        <ShareLinkDialog
          draft={shareDraft}
          close={() => setShareDraft(null)}
          toast={toast}
        />
      )}
      {storyDraft && (
        <StoryShareDialog
          draft={storyDraft}
          close={() => setStoryDraft(null)}
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
      alt={tr("Affiche de {0}", title.name)}
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
function Empty({ text, action }: { text: string; action?: () => void }) {
  return (
    <div className="empty">
      <Clapperboard size={38} />
      <h3>{text}</h3>
      {action && (
        <button className="button primary" onClick={action}>
          {tr("Explorer le catalogue ")}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function Skeleton() {
  return (
    <div
      className="poster-grid skeletons"
      aria-label={tr("Chargement du catalogue")}
    >
      {[1, 2, 3, 4, 5, 6].map((x) => (
        <div key={x}>
          <div />
          <span />
        </div>
      ))}
    </div>
  );
}
function DetailFrame({
  inline,
  children,
  label,
  close,
  style,
}: {
  inline: boolean;
  children: React.ReactNode;
  label: string;
  close: () => void;
  style: React.CSSProperties;
}) {
  return inline ? (
    <section
      className="public-title page-section"
      aria-label={label}
      style={style}
    >
      <button className="text-button" onClick={close}>
        <ArrowLeft size={18} /> {tr(" Découvrir Vela")}
      </button>
      <div className="public-title-content">{children}</div>
    </section>
  ) : (
    <Modal label={label} close={close} wide style={style}>
      {children}
    </Modal>
  );
}
function Details({
  title: initialTitle,
  entry,
  update: onUpdate,
  close,
  toast,
  profile,
  onShare,
  onStory,
  inline = false,
  readOnly = false,
  signIn,
  viewing,
  settings,
}: {
  onShare: (draft: ShareDraft) => void;
  onStory: (draft: StoryDraft) => void;
  inline?: boolean;
  readOnly?: boolean;
  signIn?: () => void;
  viewing: ViewingPreferences;
  settings: () => void;
  profile: Profile;
  title: Title;
  entry: Entry;
  update: (p: Partial<Entry>) => void;
  close: () => void;
  toast: (s: string) => void;
}) {
  const language = useLanguage();
  const [title, setTitle] = useState(initialTitle),
    [detailState, setDetailState] = useState(
      isTmdb(initialTitle) && !inline ? "loading" : "ready",
    ),
    [detailError, setDetailError] = useState(""),
    [detailRetry, setDetailRetry] = useState(0),
    [video, setVideo] = useState(false);
  const update = (patch: Partial<Entry>) => {
    // Cast portraits are fetched on demand, never copied into every backup entry.
    const { cast: _cast, ...savedTitle } = title;
    onUpdate({ ...patch, title: savedTitle });
  };
  function share(reviewOnly = false) {
    onShare(
      reviewOnly
        ? reviewShare(profile, { ...entry, title })
        : titleShare(title),
    );
  }
  const artwork = title.image || title.backdrop || "";
  const tone = useArtworkTone(artwork);
  useEffect(() => {
    const c = new AbortController();
    if (!isTmdb(initialTitle) || inline) return;
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
          setDetailError(e.message || tr("Fiche indisponible."));
        }
      });
    return () => c.abort();
  }, [initialTitle.id, detailRetry, inline, language]);
  return (
    <DetailFrame
      inline={inline}
      label={title.name}
      close={close}
      style={toneStyle(tone)}
    >
      <div className="detail-top">
        <div className="detail-poster">
          <Poster title={title} />
        </div>
        <div>
          <span className="eyebrow">
            {title.kind === "movie" ? tr("Film") : tr("Série")} · {title.year}
            {title.duration && ` · ${title.duration}`}
          </span>
          {inline ? <h1>{title.name}</h1> : <h2>{title.name}</h2>}
          <p className="detail-meta">
            {title.genres.map((genre) => tr(genre)).join(" / ")}
          </p>
          <div className="detail-score-row">
            {title.score && (
              <p className="detail-score">
                <Star size={15} fill="currentColor" />
                {title.score}
                <span>/10 · {scoreSource(title)}</span>
              </p>
            )}
            <button
              className="detail-share icon-button"
              onClick={() => share()}
              aria-label={tr(
                "Partager cette fiche {0}",
                title.kind === "movie" ? tr("film") : tr("série"),
              )}
              title={tr("Partager la fiche")}
            >
              <ShareIcon size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="detail-action-bar">
        {readOnly ? (
          <button className="button tonal" onClick={signIn}>
            {tr("Se connecter pour noter ou ajouter à ma liste")}
          </button>
        ) : (
          <>
            <div className="detail-buttons">
              <button
                className={
                  "button " + (entry.watchlist ? "primary" : "surface")
                }
                onClick={() => update({ watchlist: !entry.watchlist })}
              >
                {entry.watchlist ? <Check size={17} /> : <Plus size={17} />}
                {tr("À voir")}
              </button>
              <button
                className={"button " + (entry.watched ? "primary" : "surface")}
                onClick={() => update({ watched: !entry.watched })}
              >
                <Check size={17} />
                {entry.watched ? tr("Vu") : tr("Marquer vu")}
              </button>
              <button
                className={
                  "button icon-button " + (entry.favorite ? "liked" : "surface")
                }
                aria-label={tr("Coup de cœur")}
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
          </>
        )}
      </div>
      <div className="detail-body">
        {detailState === "loading" && (
          <p className="muted" role="status">
            {tr("Chargement de la fiche TMDB…")}
          </p>
        )}
        {detailState === "error" && (
          <div className="error" role="alert">
            {detailError}
            <button onClick={() => setDetailRetry((n) => n + 1)}>
              {tr("Réessayer la fiche")}
            </button>
          </div>
        )}
        <WhereToWatch title={title} preferences={viewing} settings={settings} />
        <h3>{tr("Synopsis")}</h3>
        <p className="synopsis">{title.summary}</p>
        {!readOnly && (
          <TitleReview
            entry={entry}
            update={update}
            share={() => share(true)}
            story={() => onStory({ entry: { ...entry, title }, profile })}
            saved={() => toast(tr("Avis enregistré."))}
          />
        )}
        <CastGallery cast={title.cast} />
        <div className="detail-links">
          {title.trailer && title.trailerKind === "youtube" && (
            <a
              className="text-button"
              href={title.trailer}
              target="_blank"
              rel="noreferrer"
            >
              <Play size={18} />
              {tr("Voir la bande-annonce sur YouTube ↗")}
            </a>
          )}
          {title.trailer && title.trailerKind !== "youtube" && (
            <>
              <button className="text-button" onClick={() => setVideo(!video)}>
                <Play size={16} />
                {video ? tr("Fermer l’extrait") : tr("Voir l’extrait")}
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
                  ? tr("Fiche sur TMDB")
                  : tr("Fiche et disponibilité sur Apple TV")
                : isTmdb(title)
                  ? tr("Fiche sur TMDB")
                  : tr("Site de la série")}{" "}
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
              {tr("Fiche IMDb ↗")}
            </a>
          )}
        </div>
        {!readOnly && (
          <>
            <PersonalTracking entry={entry} update={update} />
            {title.kind === "series" &&
              (!isTmdb(title) || detailState === "ready") && (
                <EpisodeTracker
                  key={title.id}
                  title={title}
                  entry={entry}
                  update={update}
                />
              )}
          </>
        )}
      </div>
    </DetailFrame>
  );
}
function SettingsPage({
  viewing,
  close,
  theme,
  setTheme,
  colourTheme,
  setColourTheme,
  repairNeeded,
  signIn,
  library,
  fallback,
  account,
  backup,
  accountSettings,
  openTasteMap,
  openSetup,
  languagePreference,
}: {
  languagePreference: ReturnType<typeof useLanguagePreference>;
  openTasteMap: () => void;
  openSetup: () => void;
  accountSettings: ReturnType<typeof useAccountSettings>;
  viewing: ReturnType<typeof useViewingPreferences>;
  backup: BackupController;
  library: Record<string, Entry>;
  fallback: Title[];
  account: string;
  close: () => void;
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  colourTheme: string;
  setColourTheme: (id: string) => void;
  repairNeeded: boolean;
  signIn: () => void;
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
    <section className="settings-page page-section" aria-label={tr("Réglages")}>
      <button
        className="text-button settings-back"
        onClick={close}
        aria-label={tr("Retour")}
      >
        <ArrowLeft size={20} /> {tr(" Retour")}
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {tr("Réglages")}
      </h1>
      <button className="button tonal settings-setup" onClick={openSetup}>
        {tr("Configurer mon profil")}
        <ArrowRight size={18} />
      </button>
      <div className="form-content">
        <section
          className="language-settings"
          aria-label={tr("Langue de l’application")}
        >
          <h2>{tr("Langue de l’application")}</h2>
          <LanguageSelect
            value={getLanguage()}
            onChange={languagePreference.save}
          />
          <p className="muted fine">
            {tr(
              "La langue est liée à votre compte et se retrouve sur vos appareils.",
            )}
          </p>
          {languagePreference.busy && (
            <p className="muted fine" role="status">
              {tr("Synchronisation…")}
            </p>
          )}
          {languagePreference.error && (
            <div className="error" role="status">
              {tr(languagePreference.error)}
              <button
                className="text-button"
                onClick={() => languagePreference.save(getLanguage())}
              >
                {tr("Réessayer")}
              </button>
            </div>
          )}
        </section>
        <hr />
        <h2>{tr("Apparence")}</h2>
        <p className="muted">
          {Capacitor.isNativePlatform()
            ? tr(
                "Les couleurs de l’application et des barres Android suivent ce choix.",
              )
            : tr(
                "Le site suit ce thème sur votre navigateur. Le mode Système s’adapte aux réglages de votre ordinateur ou de votre téléphone.",
              )}
        </p>
        <div
          className="theme-options"
          role="group"
          aria-label={tr("Thème de l’application")}
        >
          {(["dark", "light", "system"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === "dark"
                ? tr("Sombre")
                : value === "light"
                  ? tr("Clair")
                  : tr("Système")}
            </button>
          ))}
        </div>
        <ColourThemePicker value={colourTheme} onChange={setColourTheme} />
        <hr />
        <section className="taste-entry" aria-label={tr("Vos goûts")}>
          <div>
            <h2>{tr("Vos goûts")}</h2>
            <p className="muted">
              {tr("Explorez les liens entre vos titres et vos préférences.")}
            </p>
          </div>
          <button
            className="button tonal"
            onClick={account === "local" && cloud ? signIn : openTasteMap}
          >
            {tr("Carte de mes goûts ")}
            <ArrowRight size={18} />
          </button>
        </section>
        <hr />
        <ViewingSettings
          value={viewing.value}
          save={viewing.save}
          message={viewing.message}
        />
        <hr />
        <PublicSharingSettings account={account} signIn={signIn} />
        <hr />
        <BackupSettings
          backup={backup}
          connected={account !== "local"}
          configured={Boolean(cloud)}
          signIn={signIn}
          setFrequency={(value) => {
            accountSettings.change("backupFrequency", value);
            backup.setFrequency(value);
          }}
        />
        {accountSettings.pending && account !== "local" && (
          <p className="muted fine" role="status">
            {tr("Réglages en attente de synchronisation.")}
          </p>
        )}
        {accountSettings.error && (
          <div className="error" role="status">
            <p>{accountSettings.error}</p>
            <button className="text-button" onClick={accountSettings.retry}>
              {tr("Réessayer la synchronisation des réglages")}
            </button>
          </div>
        )}
        <hr />
        <NotificationSettings
          library={library}
          fallback={fallback}
          account={account}
          preference={accountSettings.values.notifications}
          savePreference={(value) =>
            accountSettings.change("notifications", value)
          }
        />
        <hr />
        <h2>{tr("Compte et catalogue")}</h2>
        <p className="muted">
          {cloud && tmdbEnabled()
            ? tr(
                "Le catalogue et la synchronisation sont configurés. Aucune clé n’est à renseigner.",
              )
            : tr("Configuration des services du catalogue et du compte.")}
        </p>
        {cloud && account === "local" && (
          <button className="button primary" onClick={signIn}>
            {tr("Se connecter")}
          </button>
        )}
        <details
          className="advanced-services"
          open={!defaultServices.supabaseUrl || repairNeeded}
        >
          <summary>{tr("Configuration avancée des services")}</summary>
          <h2>{tr("Catalogue TMDB")}</h2>
          <p className="muted">
            {tr(
              "Films et séries, titres français et originaux, affiches, fiches et épisodes. Une clé API gratuite est nécessaire pour un usage non commercial.",
            )}
          </p>
          <ol className="catalog-help">
            <li>
              {tr("Créez un compte sur")}{" "}
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
              {tr("Dans le navigateur, ouvrez")}{" "}
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noreferrer"
              >
                {tr("Paramètres → API")}
              </a>
              {tr(
                ", puis demandez une clé développeur. Sur téléphone, activez au besoin « site pour ordinateur ».",
              )}
            </li>
            <li>
              {tr(
                "Collez ici le jeton de lecture API ou la clé API v3. Ne les envoyez pas dans ChatGPT.",
              )}
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
                    : tr(
                        "TMDB n’est pas joignable. Vérifiez la connexion et réessayez.",
                      ),
                );
              } finally {
                setCheckingTmdb(false);
              }
            }}
          >
            <label className="field">
              {tr("Jeton de lecture TMDB ou clé API")}
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={tmdbToken}
                onChange={(e) => setTmdbToken(e.target.value)}
                required
                placeholder={tr("Jeton eyJ… ou clé API v3")}
              />
            </label>
            <p className="muted fine">
              {tr(
                "Enregistré uniquement sur cet appareil. Ce réglage est indépendant de Supabase ; vos listes et notes sont conservées.",
              )}
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
                  {tr("Vérification…")}
                </>
              ) : (
                tr("Activer TMDB")
              )}
            </button>
          </form>
          {tmdbEnabled() && (
            <button className="text-button disconnect" onClick={disableTmdb}>
              {defaultServices.tmdbKey
                ? tr("Utiliser la configuration Vela")
                : tr("Revenir au catalogue limité")}
            </button>
          )}
          <hr />
          <h2>{tr("Connecter Supabase")}</h2>
          <p className="muted">
            {tr(
              "Sans configuration, Vela garde vos données sur cet appareil. Pour synchroniser, créez un projet Supabase gratuit, exécutez le fichier",
            )}{" "}
            <code>supabase/schema.sql</code>{" "}
            {tr(" et renseignez les identifiants publics du projet.")}
          </p>
          <details className="sql-guide" open={repairNeeded}>
            <summary>{tr("Corriger l’erreur public.library")}</summary>
            <ol>
              <li>
                {tr(
                  "Ouvrez le projet Supabase dont l’URL est renseignée ci-dessous.",
                )}
              </li>
              <li>
                {tr(
                  "Dans SQL Editor → New query, collez ce script puis appuyez sur Run.",
                )}
              </li>
              <li>
                {tr(
                  "Revenez dans Profil et appuyez sur Synchroniser. Le site web n’a pas besoin d’être publié.",
                )}
              </li>
            </ol>
            <label className="field">
              {tr("Script SQL de réparation")}
              <textarea
                aria-label={tr("Script SQL de réparation")}
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
                    tr("Script copié. Collez-le dans SQL Editor de Supabase."),
                  );
                } catch {
                  setCopyMessage(
                    tr(
                      "Copie indisponible. Sélectionnez le script ci-dessus pour le copier.",
                    ),
                  );
                }
              }}
            >
              {tr("Copier le script SQL")}
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
              {tr("URL du projet")}
              <input
                type="url"
                required
                placeholder="https://votre-projet.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label className="field">
              {tr("Clé publique (publishable ou anon)")}
              <input
                required
                placeholder="sb_publishable_… ou eyJ…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <p className="muted fine">
              {tr(
                "N’utilisez jamais une clé secret ou service_role. Ces identifiants publics restent sur cet appareil. Les politiques de sécurité du schéma protègent votre collection.",
              )}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary">
              {tr("Enregistrer et recharger ")}
              <ArrowRight size={17} />
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
              {tr("Réinitialiser la configuration locale")}
            </button>
          )}
        </details>
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
  toast: (message: string) => void;
}) {
  return (
    <Modal label={tr("Connexion")} close={close}>
      <AuthForm
        success={({ needsConfirmation }) => {
          toast(
            needsConfirmation
              ? tr("Confirmez votre adresse avec l’e-mail reçu.")
              : tr("Vous êtes connecté."),
          );
          close();
        }}
      />
    </Modal>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
