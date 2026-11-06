package app.luma.cinema;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.ArrayList;
import java.util.List;

/** Only launcher aliases are toggled. MainActivity stays enabled for notifications. */
final class ThemeIconManager {
    static boolean enabled(Context context, int index) {
        int state = context.getPackageManager().getComponentEnabledSetting(component(context, index));
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && index == 0);
    }

    private static ComponentName component(Context context, int index) {
        return new ComponentName(context, context.getPackageName() + "." + ThemePalettes.ALIASES[index]);
    }

    static void apply(Context context, String id) {
        if (!ThemePalettes.valid(id)) throw new IllegalArgumentException("Unknown colour theme");
        int selected = ThemePalettes.index(id);
        PackageManager pm = context.getPackageManager();
        // Enable the selected alias first on older devices: there is always a launchable entry.
        List<Integer> changes = new ArrayList<>();
        if (!enabled(context, selected)) changes.add(selected);
        for (int i = 0; i < ThemePalettes.IDS.length; i++) {
            if (i != selected && enabled(context, i)) changes.add(i);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            List<PackageManager.ComponentEnabledSetting> settings = new ArrayList<>();
            for (int i : changes) settings.add(new PackageManager.ComponentEnabledSetting(
                component(context, i), i == selected ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP));
            if (!settings.isEmpty()) pm.setComponentEnabledSettings(settings);
        } else {
            for (int i : changes) pm.setComponentEnabledSetting(component(context, i),
                i == selected ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
    }
}
