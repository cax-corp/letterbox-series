import {
  Capacitor,
  registerPlugin,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";
import { getColourTheme } from "./colour-themes";
export type ThemePreference = "dark" | "light" | "system";
const NativeAppearance = registerPlugin<{
  setTheme(options: { dark: boolean; themeId: string }): Promise<void>;
}>("LumaAppearance");
// Capacitor DARK means white system glyphs on a dark background (including navigation).
export function systemStyle(light: boolean) {
  return light ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
}
export async function updateSystemAppearance(light: boolean, themeId: string) {
  const color = getColourTheme(themeId)[light ? "light" : "dark"].bg;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
  if (!Capacitor.isNativePlatform()) return;
  await SystemBars.setStyle({ style: systemStyle(light) });
  await NativeAppearance.setTheme({ dark: !light, themeId });
}
