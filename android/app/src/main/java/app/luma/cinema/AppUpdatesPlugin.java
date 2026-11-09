package app.luma.cinema;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;
@CapacitorPlugin(name="AppUpdates",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class AppUpdatesPlugin extends Plugin {
    @Override public void load(){AppUpdates.schedule(getContext());}
    private JSObject state(){JSONObject release=AppUpdates.latest(getContext());JSObject result=new JSObject();result.put("available",AppUpdates.available(getContext(),release));result.put("version",release.optString("version"));result.put("url",release.has("apk")?AppUpdates.download(release):"");result.put("enabled",AppUpdates.prefs(getContext()).getBoolean("enabled",true));result.put("lastCheck",AppUpdates.prefs(getContext()).getLong("lastSuccess",0));result.put("granted",NotificationManagerCompat.from(getContext()).areNotificationsEnabled());return result;}
    @PluginMethod public void getState(PluginCall call){call.resolve(state());}
    @PluginMethod public void check(PluginCall call){getBridge().execute(()->{try{AppUpdates.check(getContext(),call.getBoolean("force",false));call.resolve(state());}catch(Exception error){call.reject("La vérification des mises à jour n’a pas abouti.",error);}});}
    @PluginMethod public void configure(PluginCall call){AppUpdates.prefs(getContext()).edit().putBoolean("enabled",call.getBoolean("enabled",true)).putString("language",call.getString("language","fr-FR")).apply();AppUpdates.schedule(getContext());call.resolve(state());}
    @PluginMethod public void requestPermission(PluginCall call){if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissionForAlias("notifications",call,"permissionResult");else call.resolve(state());}
    @PermissionCallback private void permissionResult(PluginCall call){AppUpdates.notifyIfNeeded(getContext(),AppUpdates.latest(getContext()));call.resolve(state());}
    @PluginMethod public void openDownload(PluginCall call){JSONObject release=AppUpdates.latest(getContext());if(!AppUpdates.available(getContext(),release)){call.reject("Aucune mise à jour disponible.");return;}getBridge().executeOnMainThread(()->{try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(AppUpdates.download(release))));call.resolve();}catch(Exception error){call.reject("Le téléchargement ne peut pas être ouvert.",error);}});}
}
