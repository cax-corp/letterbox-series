package app.luma.cinema;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keeps native glyphs and edge-to-edge backgrounds aligned with the app's theme. */
@CapacitorPlugin(name = "LumaAppearance")
public class LumaAppearancePlugin extends Plugin {
    private boolean dark() {
        return getContext().getSharedPreferences("luma-appearance", Context.MODE_PRIVATE).getBoolean("dark", true);
    }
    private String themeId() {
        String saved = getContext().getSharedPreferences("luma-appearance", Context.MODE_PRIVATE).getString("palette", "blue");
        return ThemePalettes.IDS[ThemePalettes.index(saved)];
    }

    @Override public void load() { apply(dark()); }
    @Override protected void handleOnResume() { apply(dark()); }
    @Override protected void handleOnConfigurationChanged(Configuration config) { apply(dark()); }
    @Override protected void handleOnPause() {
        // Some launchers close an activity whose alias changes. Update only when leaving it.
        try { ThemeIconManager.apply(getContext(), themeId()); }
        catch (RuntimeException error) { android.util.Log.e("VelaTheme", "Launcher icon update failed; will retry on next pause", error); }
    }

    @PluginMethod public void setTheme(PluginCall call) {
        boolean isDark = call.getBoolean("dark", true);
        String id = call.getString("themeId", "blue");
        if (!ThemePalettes.valid(id)) { call.reject("Unknown colour theme"); return; }
        getContext().getSharedPreferences("luma-appearance", Context.MODE_PRIVATE).edit().putBoolean("dark", isDark).putString("palette", id).apply();
        getActivity().runOnUiThread(() -> { apply(isDark); call.resolve(); });
    }

    @SuppressWarnings("deprecation")
    private void apply(boolean isDark) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int background = Color.parseColor(ThemePalettes.background(themeId(), isDark));
            int navigation = Color.parseColor(ThemePalettes.navigation(themeId(), isDark || Build.VERSION.SDK_INT < 26));
            window.getDecorView().setBackgroundColor(background);
            if (getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(background);
            // On Android 15+ edge-to-edge is enforced. CSS paints behind transparent bars.
            window.setStatusBarColor(background);
            window.setNavigationBarColor(navigation);
            if (Build.VERSION.SDK_INT >= 29) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark && Build.VERSION.SDK_INT >= 26);
        });
    }
}
