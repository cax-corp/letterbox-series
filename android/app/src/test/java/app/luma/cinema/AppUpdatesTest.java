package app.luma.cinema;
import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.pm.PackageInfoCompat;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk={28,34})
public class AppUpdatesTest {
 private final Context context=RuntimeEnvironment.getApplication();
 @Before public void reset(){AppUpdates.prefs(context).edit().clear().commit();shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);}
 private int current() throws Exception{return (int)PackageInfoCompat.getLongVersionCode(context.getPackageManager().getPackageInfo(context.getPackageName(),0));}
 private JSONObject release(int code) throws Exception{return new JSONObject().put("versionCode",code).put("version","9.0.0").put("apk","Vela-9.0.0.apk");}
 @Test public void validatesOnlyVersionedApkNames() throws Exception {
  assertEquals("9.0.0",AppUpdates.validate(release(current()+1)).getString("version"));
  assertThrows(IllegalArgumentException.class,()->AppUpdates.validate(release(0)));
  assertThrows(IllegalArgumentException.class,()->AppUpdates.validate(release(100).put("versionCode",100.5)));
  assertThrows(IllegalArgumentException.class,()->AppUpdates.validate(release(100).put("versionCode","100")));
  assertThrows(IllegalArgumentException.class,()->AppUpdates.validate(release(100).put("apk","https://attacker.example/app.apk")));
  assertThrows(IllegalArgumentException.class,()->AppUpdates.validate(release(100).put("version","../../../file")));
  assertEquals("https://vela.thomasbarial.com/downloads/Vela-9.0.0.apk",AppUpdates.download(AppUpdates.validate(release(100))));
 }
 @Test public void neverSuggestsSameOrOlderVersion() throws Exception {assertFalse(AppUpdates.available(context,release(current())));assertFalse(AppUpdates.available(context,release(current()-1)));assertTrue(AppUpdates.available(context,release(current()+1)));}
 @Test public void oneNotificationPerNewVersionAndUserControlsRemainEffective() throws Exception {
  JSONObject newer=AppUpdates.validate(release(current()+1));AppUpdates.notifyIfNeeded(context,newer);
  NotificationManager manager=context.getSystemService(NotificationManager.class);assertEquals(1,shadowOf(manager).size());
  assertEquals(current()+1,AppUpdates.prefs(context).getInt("notified",0));manager.cancelAll();AppUpdates.notifyIfNeeded(context,newer);assertEquals(0,shadowOf(manager).size());
  AppUpdates.prefs(context).edit().putBoolean("enabled",false).putInt("notified",0).commit();AppUpdates.notifyIfNeeded(context,newer);assertEquals(0,shadowOf(manager).size());
 }
 @Test public void rejectedPermissionDoesNotAcknowledgeAnUnsentNotification() throws Exception {
  shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(false);
  AppUpdates.notifyIfNeeded(context,AppUpdates.validate(release(current()+1)));assertEquals(0,AppUpdates.prefs(context).getInt("notified",0));
 }
 @Test public void aRecentCheckUsesSavedManifestWithoutAnyNetwork() throws Exception {
  JSONObject newer=AppUpdates.validate(release(current()+1));AppUpdates.prefs(context).edit().putString("latest",newer.toString()).putLong("lastAttempt",System.currentTimeMillis()).commit();
  assertEquals(newer.toString(),AppUpdates.check(context,false).toString());
 }
}
