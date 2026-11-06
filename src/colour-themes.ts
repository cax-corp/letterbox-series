import presets from "./colour-themes.json" with { type: "json" };

export const colourThemes = presets;
export type ColourTheme = (typeof presets)[number];
export const colourThemeKey = "vela-colour-theme-v1";
export const defaultColourTheme = "blue";

export function getColourTheme(id: unknown): ColourTheme {
  return colourThemes.find((preset) => preset.id === id) || colourThemes[0];
}

export function readColourTheme(): string {
  try {
    return getColourTheme(localStorage.getItem(colourThemeKey)).id;
  } catch {
    return defaultColourTheme;
  }
}

export function rgb(hex: string): string {
  return [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
    .join(" ");
}

/** Used by React and by the inline script before the first paint. */
export function colourVariables(
  preset: ColourTheme,
  light: boolean,
): Record<string, string> {
  const p = preset[light ? "light" : "dark"];
  return {
    "--bg": p.bg,
    "--panel": p.panel,
    "--surface": p.surface,
    "--nav-surface": p.nav,
    "--text": p.text,
    "--muted": p.muted,
    "--line": p.line,
    "--brand": preset.hex,
    "--on-brand": preset.ink,
    "--primary": "var(--brand)",
    "--on-primary": "var(--on-brand)",
    "--blue": light ? preset.link : preset.hex,
    "--primary-container": p.secondary,
    "--on-container": p.text,
    "--bg-rgb": rgb(p.bg),
    "--accent-rgb": rgb(preset.hex),
    "--chrome-tint": `rgb(${rgb(p.bg)} / 80%)`,
    "--navigation-tint": `rgb(${rgb(p.nav)} / 84%)`,
    "--dialog-tint": `rgb(${rgb(p.panel)} / 96%)`,
    "--chrome-art-tint": `rgb(${rgb(p.bg)} / ${light ? "70%" : "64%"})`,
    "--ambient": `rgb(${rgb(preset.hex)} / ${light ? "9%" : "7%"})`,
    "--scrim": `rgb(${rgb(preset.dark.bg)} / ${light ? "28%" : "52%"})`,
    // Artwork keeps a dark scrim in light mode to protect the text over images.
    "--hero-bg-rgb": rgb(preset.dark.bg),
    "--hero-text": preset.dark.text,
    "--hero-muted": preset.dark.muted,
    "--hero-surface": preset.dark.surface,
    "--hero-panel": preset.dark.panel,
  };
}

export function applyColourTheme(id: string, light: boolean) {
  const preset = getColourTheme(id);
  const root = document.documentElement;
  root.dataset.colourTheme = preset.id;
  root.dataset.theme = light ? "light" : "dark";
  root.style.backgroundColor = preset[light ? "light" : "dark"].bg;
  root.style.color = preset[light ? "light" : "dark"].text;
  root.style.colorScheme = light ? "light" : "dark";
  for (const [key, value] of Object.entries(colourVariables(preset, light))) {
    root.style.setProperty(key, value);
  }
  document
    .querySelector('link[rel="icon"]')
    ?.setAttribute("href", `./brand/themes/${preset.id}.svg`);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", preset[light ? "light" : "dark"].bg);
}

/** No network request or React startup is needed to restore the saved palette. */
export function colourBootstrap(): string {
  const maps = Object.fromEntries(
    colourThemes.map((p) => [
      p.id,
      {
        dark: colourVariables(p, false),
        light: colourVariables(p, true),
      },
    ]),
  );
  return `(()=>{try{const maps=${JSON.stringify(maps)};const saved=localStorage.getItem(${JSON.stringify(colourThemeKey)});const id=Object.hasOwn(maps,saved)?saved:"blue";const t=localStorage.getItem("luma-theme");const mode=t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";const root=document.documentElement;root.dataset.theme=mode;root.dataset.colourTheme=id;Object.entries(maps[id][mode]).forEach(([k,v])=>root.style.setProperty(k,v));root.style.backgroundColor=maps[id][mode]["--bg"];root.style.color=maps[id][mode]["--text"];root.style.colorScheme=mode;document.querySelector('meta[name="theme-color"]').content=maps[id][mode]["--bg"];document.querySelector('link[rel="icon"]').href="./brand/themes/"+id+".svg";}catch{}})();`;
}
