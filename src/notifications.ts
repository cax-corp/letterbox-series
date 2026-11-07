import { t as tr, getLanguage } from "./i18n";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { Title } from "./catalog";
import { rankHomeTitles } from "./home-personalization";
import { dailyExclusion } from "./feed-history";
import { readRecommendationSession } from "./recommendation-session";
import type { Entry } from "./store";

export type DailyOptions = {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
  reliableAlarm?: boolean;
};
export type DailyPayload = DailyOptions & {
  preparedAt: number;
  language?: string;
  excluded: Partial<Title>[];
  candidates: { title: Title; reason: string }[];
};
export type DailyState = {
  config: Partial<DailyOptions>;
  granted: boolean;
  nextAt: number;
  exactAllowed?: boolean;
  reserveCount?: number;
  testAt?: number;
  lastSentAt?: number;
  backgroundRestricted?: boolean;
  xiaomi?: boolean;
  device?: string;
  androidApi?: number;
  batterySaver?: boolean;
  batteryExempt?: boolean;
  alarmMethod?: string;
  testAlarmMethod?: string;
  lastAttemptAt?: number;
  lastAttemptDue?: number;
  lastStatus?: string;
  lastSource?: string;
  lastAttemptTest?: boolean;
  lastMissedAt?: number;
  lastMissedTest?: boolean;
  notificationActive?: boolean;
};
export interface DailyAdapter {
  getState(): Promise<DailyState>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  configure(options: { config: DailyPayload }): Promise<DailyState>;
  updateContext(options: { context: DailyPayload }): Promise<DailyState>;
  openSettings(): Promise<void>;
  openExactAlarmSettings?(): Promise<void>;
  openBackgroundSettings?(): Promise<void>;
  openAutoStartSettings?(): Promise<void>;
  testNotification?(options?: {
    context: DailyPayload;
    immediate?: boolean;
  }): Promise<DailyState>;
  addListener(
    event: "recommendationOpened",
    callback: (event: {
      title?: Title;
      openFeed?: boolean;
      openSettings?: boolean;
    }) => void,
  ): Promise<PluginListenerHandle>;
}
export const dailyNative = registerPlugin<DailyAdapter>("DailyRecommendations");
export const dailySupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const defaultDaily: DailyOptions = {
  enabled: false,
  reliableAlarm: false,
  hour: 19,
  minute: 0,
  days: [0, 1, 2, 3, 4, 5, 6],
};
export function buildDailyPayload(
  options: DailyOptions,
  library: Record<string, Entry>,
  fallback: Title[],
  account = "local",
): DailyPayload {
  const entries = Object.values(library),
    blocked = entries.filter(
      (entry) =>
        entry.watched ||
        entry.rating > 0 ||
        entry.favorite ||
        entry.recommendationFeedback,
    );
  const seen = dailyExclusion(account);
  const cached = readRecommendationSession(account).candidates.map(
    (candidate) => candidate.title,
  );
  const candidates = rankHomeTitles(library, [...fallback, ...cached]).filter(
    (title) =>
      title.kind === "movie" &&
      !seen(title) &&
      !blocked.some(
        (entry) =>
          entry.title.id === title.id ||
          (entry.title.kind === title.kind &&
            entry.title.name === title.name &&
            entry.title.year === title.year),
      ),
  );
  return {
    ...options,
    language: getLanguage(),
    preparedAt: Date.now(),
    excluded: blocked.map((entry) => ({
      id: entry.title.id,
      kind: entry.title.kind,
      name: entry.title.name,
      year: entry.title.year,
    })),
    candidates: candidates.slice(0, 30).map((title) => ({
      title,
      reason: tr("Une idée choisie pour vos goûts"),
    })),
  };
}

export async function setDailyRecommendations(
  options: DailyOptions,
  library: Record<string, Entry>,
  fallback: Title[],
  adapter: DailyAdapter = dailyNative,
  account = "local",
) {
  if (
    !Number.isInteger(options.hour) ||
    options.hour < 0 ||
    options.hour > 23 ||
    !Number.isInteger(options.minute) ||
    options.minute < 0 ||
    options.minute > 59 ||
    !options.days.length ||
    options.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw new Error(tr("Choisissez une heure et au moins un jour."));
  if (options.enabled) {
    const permission = await adapter.requestNotificationPermission();
    if (!permission.granted)
      throw new Error(
        tr(
          "Les notifications sont bloquées par Android. Autorisez-les dans les paramètres du téléphone.",
        ),
      );
  }
  return adapter.configure({
    config: buildDailyPayload(options, library, fallback, account),
  });
}
export async function refreshDailyContext(
  library: Record<string, Entry>,
  fallback: Title[],
  adapter: DailyAdapter = dailyNative,
  account = "local",
) {
  const state = await adapter.getState();
  if (state.config.enabled)
    return adapter.updateContext({
      context: buildDailyPayload(
        { ...defaultDaily, ...state.config } as DailyOptions,
        library,
        fallback,
        account,
      ),
    });
}
