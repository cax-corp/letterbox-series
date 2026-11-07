import { useLanguage } from "./i18n";
import { useEffect, useRef } from "react";
import type { Title } from "./catalog";
import type { Entry } from "./store";
import {
  dailyNative,
  dailySupported,
  refreshDailyContext,
} from "./notifications";
export function useDailyRecommendations(
  library: Record<string, Entry>,
  fallback: Title[],
  open: (title?: Title) => void,
  account = "local",
  openSettings?: () => void,
) {
  const language = useLanguage();
  const handler = useRef(open);
  handler.current = open;
  const settingsHandler = useRef(openSettings);
  settingsHandler.current = openSettings;
  useEffect(() => {
    if (!dailySupported()) return;
    const listener = dailyNative
      .addListener(
        "recommendationOpened",
        ({ title, openFeed, openSettings }) => {
          if (openSettings) {
            settingsHandler.current?.();
            return;
          }
          if (openFeed) {
            handler.current();
            return;
          }
          if (
            title &&
            /^tmdb-movie-\d+$|^movie-\d+$/.test(title.id) &&
            title.kind === "movie" &&
            typeof title.name === "string"
          )
            handler.current(title);
        },
      )
      .catch(() => null);
    return () => {
      listener.then((l) => l?.remove()).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!dailySupported()) return;
    let timer: ReturnType<typeof setTimeout>;
    const prepare = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          refreshDailyContext(library, fallback, dailyNative, account).catch(
            () => {},
          ),
        500,
      );
    };
    prepare();
    const resume = () => {
      if (!document.hidden) prepare();
    };
    window.addEventListener("luma-feed-impression", prepare);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("luma-feed-impression", prepare);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [library, fallback, account, language]);
}
