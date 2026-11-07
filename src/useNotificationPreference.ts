import { useEffect, useRef } from "react";
import {
  buildDailyPayload,
  dailyNative,
  dailySupported,
  defaultDaily,
} from "./notifications";
import { changePreference, type NotificationPreference } from "./account-state";
import type { Library } from "./store";
import type { Title } from "./catalog";
export function useNotificationPreference(
  value: NotificationPreference | undefined,
  account: string,
  ready: boolean,
  library: Library,
  fallback: Title[],
) {
  const latest = useRef({ library, fallback });
  latest.current = { library, fallback };
  const identity = JSON.stringify(value);
  useEffect(() => {
    if (!ready || !dailySupported()) return;
    let live = true;
    const restore = async () => {
      const state = await dailyNative.getState();
      if (!live) return;
      if (!value && account !== "local") {
        const old = { ...defaultDaily, ...state.config };
        changePreference(account, "notifications", {
          enabled: old.enabled,
          hour: old.hour,
          minute: old.minute,
          days: old.days,
        });
        return;
      }
      const wanted = value || { ...defaultDaily, enabled: false };
      const current = {
        enabled: Boolean(state.config.enabled),
        hour: state.config.hour ?? 19,
        minute: state.config.minute ?? 0,
        days: state.config.days || defaultDaily.days,
      };
      if (
        JSON.stringify(current) === JSON.stringify(wanted) &&
        !state.config.reliableAlarm
      )
        return;
      // OS permission belongs to this device. Restoring an account never prompts silently.
      if (wanted.enabled && !state.granted) return;
      await dailyNative.configure({
        config: buildDailyPayload(
          { ...wanted, reliableAlarm: false },
          latest.current.library,
          latest.current.fallback,
          account,
        ),
      });
    };
    void restore().catch(() => {});
    return () => {
      live = false;
    };
  }, [account, ready, identity]);
}
