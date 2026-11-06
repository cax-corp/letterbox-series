import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const themes = JSON.parse(readFileSync(path.join(root, "src/colour-themes.json"), "utf8"));
function write(relative, content) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content.trimEnd() + "\n");
}
const res = "android/app/src/main/res";
const native = "android/app/src/main/java/app/luma/cinema";
const initial = "M20 27H33L44 59L55 27H68L50 75H38Z";
const dot = "M87 27a7 7 0 1 0 -14 0a7 7 0 1 0 14 0Z";
const cap = (id) => id[0].toUpperCase() + id.slice(1);
function vector(p, background = false) {
  return `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">${background ? `<path android:fillColor="${p.dark.bg}" android:pathData="M0,0h108v108h-108z"/>` : ""}<group android:translateX="14" android:translateY="14" android:scaleX="0.8" android:scaleY="0.8"><path android:fillColor="${p.dark.text}" android:pathData="${initial}"/><path android:fillColor="${p.hex}" android:pathData="${dot}"/></group></vector>`;
}
for (const p of themes) {
  write(`public/brand/themes/${p.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="${p.dark.bg}"/><path d="${initial}" fill="${p.dark.text}"/><path d="${dot}" fill="${p.hex}"/></svg>`);
  write(`${res}/drawable/vela_foreground_${p.id}.xml`, vector(p));
  write(`${res}/mipmap-anydpi/vela_${p.id}.xml`, vector(p, true));
  write(`${res}/mipmap-anydpi-v26/vela_${p.id}.xml`, `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/theme_${p.id}_background"/><foreground android:drawable="@drawable/vela_foreground_${p.id}"/><monochrome android:drawable="@drawable/vela_foreground_${p.id}"/></adaptive-icon>`);
}
write(`${res}/values/theme_palettes.xml`, `<!-- Generated from src/colour-themes.json; run npm run themes:generate. -->
<resources>
${themes.map((p) => `  <color name="theme_${p.id}_background">${p.dark.bg}</color>`).join("\n")}
</resources>`);
write(`${native}/ThemePalettes.java`, `// Generated from src/colour-themes.json; run npm run themes:generate.
package app.luma.cinema;

final class ThemePalettes {
    static final String[] IDS = {${themes.map((p) => `"${p.id}"`).join(", ")}};
    static final String[] ALIASES = {${themes.map((p) => `"Launcher${cap(p.id)}"`).join(", ")}};
    private static final String[] DARK = {${themes.map((p) => `"${p.dark.bg}"`).join(", ")}};
    private static final String[] LIGHT = {${themes.map((p) => `"${p.light.bg}"`).join(", ")}};
    private static final String[] DARK_NAV = {${themes.map((p) => `"${p.dark.nav}"`).join(", ")}};
    private static final String[] LIGHT_NAV = {${themes.map((p) => `"${p.light.nav}"`).join(", ")}};
    static int index(String id) {
        for (int i = 0; i < IDS.length; i++) if (IDS[i].equals(id)) return i;
        return 0;
    }
    static boolean valid(String id) { return IDS[index(id)].equals(id); }
    static String background(String id, boolean dark) { return (dark ? DARK : LIGHT)[index(id)]; }
    static String navigation(String id, boolean dark) { return (dark ? DARK_NAV : LIGHT_NAV)[index(id)]; }
}
`);
const manifest = path.join(root, "android/app/src/main/AndroidManifest.xml");
let xml = readFileSync(manifest, "utf8");
const aliases = themes.map((p) => `        <activity-alias android:name=".Launcher${cap(p.id)}" android:targetActivity=".MainActivity" android:enabled="${p.id === "blue"}" android:exported="true" android:label="@string/app_name" android:icon="@mipmap/vela_${p.id}" android:roundIcon="@mipmap/vela_${p.id}">
            <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
        </activity-alias>`).join("\n");
xml = xml.replace(/        <!-- theme-launcher-aliases:start -->[\s\S]*?        <!-- theme-launcher-aliases:end -->/, `        <!-- theme-launcher-aliases:start -->\n${aliases}\n        <!-- theme-launcher-aliases:end -->`);
writeFileSync(manifest, xml);
// The fallback application/splash resources share the default blue preset.
write(`${res}/drawable/vela_foreground.xml`, vector(themes[0]));
write(`${res}/mipmap-anydpi/vela.xml`, vector(themes[0], true));
write("public/icon.svg", readFileSync(path.join(root, "public/brand/themes/blue.svg"), "utf8").trim());
console.log(`Generated ${themes.length} web and Android theme icons.`);
