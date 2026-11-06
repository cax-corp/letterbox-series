// Generated from src/colour-themes.json; run npm run themes:generate.
package app.luma.cinema;

final class ThemePalettes {
    static final String[] IDS = {"blue", "champagne", "iris", "slate", "emerald", "coral", "ruby", "copper", "silver"};
    static final String[] ALIASES = {"LauncherBlue", "LauncherChampagne", "LauncherIris", "LauncherSlate", "LauncherEmerald", "LauncherCoral", "LauncherRuby", "LauncherCopper", "LauncherSilver"};
    private static final String[] DARK = {"#001620", "#171410", "#120F19", "#11151E", "#0C1814", "#1D1412", "#1B1016", "#1B140F", "#111315"};
    private static final String[] LIGHT = {"#F6FCFF", "#FCF8F2", "#F9F7FC", "#F7F9FD", "#F4FBF7", "#FFF8F5", "#FFF6F9", "#FFF9F1", "#F9FAFC"};
    private static final String[] DARK_NAV = {"#0A202B", "#1F1A15", "#1C1725", "#171D29", "#12231C", "#271C18", "#25171F", "#261D15", "#1A1E22"};
    private static final String[] LIGHT_NAV = {"#EEF7FC", "#F7F0E6", "#F5F0FA", "#F0F4FA", "#EDF7F0", "#FCF0EA", "#FAEDF3", "#FAF1E6", "#F2F4F7"};
    static int index(String id) {
        for (int i = 0; i < IDS.length; i++) if (IDS[i].equals(id)) return i;
        return 0;
    }
    static boolean valid(String id) { return IDS[index(id)].equals(id); }
    static String background(String id, boolean dark) { return (dark ? DARK : LIGHT)[index(id)]; }
    static String navigation(String id, boolean dark) { return (dark ? DARK_NAV : LIGHT_NAV)[index(id)]; }
}
