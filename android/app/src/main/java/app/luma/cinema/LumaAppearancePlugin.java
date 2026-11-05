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

    @Override public void load() { apply(dark()); }
    @Override protected void handleOnResume() { apply(dark()); }
    @Override protected void handleOnConfigurationChanged(Configuration config) { apply(dark()); }

    @PluginMethod public void setTheme(PluginCall call) {
        boolean isDark = call.getBoolean("dark", true);
        getContext().getSharedPreferences("luma-appearance", Context.MODE_PRIVATE).edit().putBoolean("dark", isDark).apply();
        getActivity().runOnUiThread(() -> { apply(isDark); call.resolve(); });
    }

    @SuppressWarnings("deprecation")
    private void apply(boolean isDark) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int background = Color.parseColor(isDark ? "#0B141B" : "#F1F8FC");
            int navigation = Color.parseColor(isDark || Build.VERSION.SDK_INT < 26 ? "#17232C" : "#E5EFF6");
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
