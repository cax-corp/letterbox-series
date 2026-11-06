import {
  Capacitor,
  registerPlugin,
  SystemBars,
  SystemBarsStyle,
} from "@capacitor/core";
export const brandBlue = "#009FE3";
export const brandInk = "#062433";
export type ThemePreference = "dark" | "light" | "system";
export const palette = {
  dark: {
    background: "#0B141B",
    surface: "#17232C",
    text: "#E4F1F9",
    muted: "#A6BAC8",
    primary: brandBlue,
    container: "#162E3E",
    onContainer: "#D3EBF6",
  },
  light: {
    background: "#F1F8FC",
    surface: "#E5EFF6",
    text: "#10212D",
    muted: "#526977",
    primary: brandBlue,
    container: "#DBEEF8",
    onContainer: "#00344C",
  },
};
const NativeAppearance = registerPlugin<{
  setTheme(options: { dark: boolean }): Promise<void>;
}>("LumaAppearance");
// Capacitor DARK means white system glyphs on a dark background (including navigation).
export function systemStyle(light: boolean) {
  return light ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
}
export async function updateSystemAppearance(light: boolean) {
  const color = palette[light ? "light" : "dark"].background;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
  if (!Capacitor.isNativePlatform()) return;
  await SystemBars.setStyle({ style: systemStyle(light) });
  await NativeAppearance.setTheme({ dark: !light });
}
