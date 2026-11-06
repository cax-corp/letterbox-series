package app.luma.cinema;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 34})
public class ThemeIconManagerTest {
    @Test public void everyPaletteSwitchLeavesExactlyOneLauncherAndMainActivityEnabled() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        PackageManager pm = context.getPackageManager();
        for (String id : ThemePalettes.IDS) {
            ThemeIconManager.apply(context, id);
            int count = 0;
            for (int i = 0; i < ThemePalettes.IDS.length; i++) {
                if (ThemeIconManager.enabled(context, i)) {
                    count++;
                    assertEquals(id, ThemePalettes.IDS[i]);
                    ActivityInfo info = pm.getActivityInfo(new ComponentName(context, context.getPackageName() + "." + ThemePalettes.ALIASES[i]), 0);
                    assertEquals(MainActivity.class.getName(), info.targetActivity);
                    assertNotEquals(0, info.icon);
                }
            }
            assertEquals(1, count);
            ActivityInfo main = pm.getActivityInfo(new ComponentName(context, MainActivity.class), 0);
            assertTrue(main.enabled);
            assertEquals(PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, pm.getComponentEnabledSetting(new ComponentName(context, MainActivity.class)));
            // Notification intents do not depend on whichever launcher alias is selected.
            assertNotNull(pm.resolveActivity(new Intent(context, MainActivity.class), 0));
            ThemeIconManager.apply(context, id); // Reapplying is harmless.
        }
        ThemeIconManager.apply(context, "blue");
        assertTrue(ThemeIconManager.enabled(context, 0));
        for (int i = 1; i < ThemePalettes.IDS.length; i++) assertFalse(ThemeIconManager.enabled(context, i));
    }

    @Test public void unknownPaletteCannotDisableTheLauncher() {
        Context context = RuntimeEnvironment.getApplication();
        ThemeIconManager.apply(context, "emerald");
        try { ThemeIconManager.apply(context, "not-a-theme"); fail("Invalid palette accepted"); }
        catch (IllegalArgumentException expected) { assertTrue(ThemeIconManager.enabled(context, ThemePalettes.index("emerald"))); }
    }

    @Test public void allPalettesProvideNativeDarkAndLightBackgrounds() {
        assertEquals(9, ThemePalettes.IDS.length);
        for (String id : ThemePalettes.IDS) {
            assertTrue(ThemePalettes.valid(id));
            int dark = Color.parseColor(ThemePalettes.background(id, true));
            int light = Color.parseColor(ThemePalettes.background(id, false));
            assertNotEquals(dark, light);
            assertNotEquals(Color.parseColor(ThemePalettes.navigation(id, true)), Color.parseColor(ThemePalettes.navigation(id, false)));
        }
        assertFalse(ThemePalettes.valid("invalid"));
        assertEquals("#001620", ThemePalettes.background("invalid", true));
        assertEquals("#F6FCFF", ThemePalettes.background("blue", false));
    }
}
