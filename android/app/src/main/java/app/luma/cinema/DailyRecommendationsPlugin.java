package app.luma.cinema;

import android.Manifest;
import android.app.ActivityManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.os.PowerManager;
import java.util.Locale;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name="DailyRecommendations",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class DailyRecommendationsPlugin extends Plugin {
    @Override public void load(){DailyRecommendations.channel(getContext());restore();opened(getActivity().getIntent());}
    @Override protected void handleOnResume(){restore();}
    private void restore(){DailyRecommendations.restore(getContext());}
    @Override protected void handleOnNewIntent(Intent intent){opened(intent);}
    private void opened(Intent intent){
        if(intent.getBooleanExtra("luma_open_settings",false)){intent.removeExtra("luma_open_settings");notifyListeners("recommendationOpened",new JSObject().put("openSettings",true),true);return;}
        if(intent.getBooleanExtra("luma_open_recommendations",false)){intent.removeExtra("luma_open_recommendations");notifyListeners("recommendationOpened",new JSObject().put("openFeed",true),true);return;}
        String value=intent.getStringExtra("luma_recommendation");if(value==null)return;intent.removeExtra("luma_recommendation");
        try{notifyListeners("recommendationOpened",new JSObject().put("title",new JSONObject(value)),true);}catch(JSONException ignored){}
    }
    @PluginMethod public void getState(PluginCall call){
        JSObject state=new JSObject();JSONObject config=DailyRecommendations.config(getContext());
        state.put("config",config);state.put("granted",DailyRecommendations.allowed(getContext()));state.put("exactAllowed",DailyRecommendations.exactAllowed(getContext()));
        state.put("nextAt",config.optBoolean("enabled")?DailyRecommendations.prefs(getContext()).getLong("scheduledAt",0):0);
        state.put("testAt",DailyRecommendations.prefs(getContext()).getLong("testAt",0));state.put("lastSentAt",DailyRecommendations.prefs(getContext()).getLong("lastSentAt",0));
        state.put("reserveCount",NotificationQueue.count(config,DailyRecommendations.recent(getContext())));
        android.content.SharedPreferences preferences=DailyRecommendations.prefs(getContext());
        PowerManager power=getContext().getSystemService(PowerManager.class);
        state.put("device",Build.MANUFACTURER+" "+Build.MODEL);state.put("androidApi",Build.VERSION.SDK_INT);state.put("xiaomi",isXiaomi());state.put("batterySaver",power.isPowerSaveMode());
        state.put("batteryExempt",power.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        for(String key:new String[]{"lastAttemptAt","lastAttemptDue","lastMissedAt","armedAt","testArmedAt"})state.put(key,preferences.getLong(key,0));
        for(String key:new String[]{"lastStatus","lastSource","alarmMethod","testAlarmMethod"})state.put(key,preferences.getString(key,""));
        state.put("lastAttemptTest",preferences.getBoolean("lastAttemptTest",false));state.put("lastMissedTest",preferences.getBoolean("lastMissedTest",false));
        boolean active=false;
        for(android.service.notification.StatusBarNotification n:getContext().getSystemService(NotificationManager.class).getActiveNotifications())
            if(n.getId()==DailyRecommendations.NOTIFICATION_ID||n.getId()==DailyRecommendations.TEST_ID)active=true;
        state.put("notificationActive",active);
        state.put("backgroundRestricted",Build.VERSION.SDK_INT>=28&&getContext().getSystemService(ActivityManager.class).isBackgroundRestricted());
        call.resolve(state);
    }
    @PluginMethod public void requestNotificationPermission(PluginCall call){
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissionForAlias("notifications",call,"permissionResult");
        else call.resolve(new JSObject().put("granted",DailyRecommendations.allowed(getContext())));
    }
    @PermissionCallback private void permissionResult(PluginCall call){call.resolve(new JSObject().put("granted",DailyRecommendations.allowed(getContext())));}
    private JSONObject prepared(JSObject input)throws JSONException{
        JSONObject saved=new JSONObject();
        for(String key:new String[]{"enabled","hour","minute","days","reliableAlarm","preparedAt","candidates","excluded"})if(input.has(key))saved.put(key,input.get(key));
        return saved;
    }
    @PluginMethod public void configure(PluginCall call){
        JSObject input=call.getObject("config");if(input==null){call.reject("Configuration manquante");return;}
        try{
            JSONObject config=prepared(input);int hour=config.optInt("hour",-1),minute=config.optInt("minute",-1);JSONArray days=config.optJSONArray("days");
            if(hour<0||hour>23||minute<0||minute>59||days==null||days.length()==0)throw new IllegalArgumentException();
            for(int i=0;i<days.length();i++)if(days.getInt(i)<0||days.getInt(i)>6)throw new IllegalArgumentException();
            if(config.optBoolean("enabled")&&!DailyRecommendations.allowed(getContext())){call.reject("Autorisez les notifications dans Android pour activer ce réglage.");return;}
            synchronized(DailyRecommendations.class){
                long generation=DailyRecommendations.prefs(getContext()).getLong("generation",0)+1;
                DailyRecommendations.prefs(getContext()).edit().putString("config",config.toString()).putLong("generation",generation).remove("scheduledAt").commit();
                DailyRecommendations.schedule(getContext(),false);getState(call);
            }
        }catch(Exception e){call.reject("Vérifiez l’heure et les jours choisis.");}
    }
    @PluginMethod public void updateContext(PluginCall call){
        JSObject context=call.getObject("context");if(context==null){call.reject("Contexte manquant");return;}
        synchronized(DailyRecommendations.class){
            JSONObject saved=DailyRecommendations.config(getContext());if(!saved.optBoolean("enabled")){getState(call);return;}
            try{
                for(String key:new String[]{"preparedAt","candidates","excluded"})saved.put(key,context.opt(key));
                for(String old:new String[]{"token","genreQuery","weights","seedIds"})saved.remove(old);
                // Updating the reserve must NOT replace the generation or postpone an imminent alarm.
                DailyRecommendations.prefs(getContext()).edit().putString("config",saved.toString()).commit();
                DailyRecommendations.schedule(getContext(),false);getState(call);
            }catch(Exception e){call.reject("La réserve ne peut pas être actualisée.");}
        }
    }
    @PluginMethod public void testNotification(PluginCall call){
        if(!DailyRecommendations.allowed(getContext())){call.reject("Autorisez les notifications Android avant le test.");return;}
        JSObject context=call.getObject("context");
        if(context!=null)synchronized(DailyRecommendations.class){
            JSONObject saved=DailyRecommendations.config(getContext());
            try{for(String key:new String[]{"preparedAt","candidates","excluded"})saved.put(key,context.opt(key));DailyRecommendations.prefs(getContext()).edit().putString("config",saved.toString()).commit();}catch(JSONException ignored){}
        }
        DailyRecommendations.test(getContext(),Boolean.TRUE.equals(call.getBoolean("immediate",false)),context==null?DailyRecommendations.config(getContext()).optBoolean("reliableAlarm",false):context.optBoolean("reliableAlarm",false));getState(call);
    }
    @PluginMethod public void openExactAlarmSettings(PluginCall call){
        if(Build.VERSION.SDK_INT<31||launch(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())))||launch(details()))call.resolve();
        else call.reject("Ouvrez Alarmes et rappels dans les paramètres Android de Vela.");
    }
    static boolean isXiaomi(){
        String vendor=(Build.MANUFACTURER+" "+Build.BRAND).toLowerCase(Locale.ROOT);
        return vendor.contains("xiaomi")||vendor.contains("redmi")||vendor.contains("poco");
    }
    private Intent details(){return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));}
    private boolean launch(Intent intent){
        try{getContext().startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));return true;}
        catch(android.content.ActivityNotFoundException|SecurityException unavailable){return false;}
    }
    @PluginMethod public void openAutoStartSettings(PluginCall call){
        // MIUI/HyperOS versions expose different screens; never assume opening one grants access.
        if(isXiaomi()&&launch(new Intent().setComponent(new ComponentName("com.miui.securitycenter","com.miui.permcenter.autostart.AutoStartManagementActivity")))){call.resolve();return;}
        if(launch(details()))call.resolve();else call.reject("Ouvrez manuellement les paramètres Android de Vela.");
    }
    @PluginMethod public void openBackgroundSettings(PluginCall call){
        if(isXiaomi()&&launch(new Intent().setComponent(new ComponentName("com.miui.powerkeeper","com.miui.powerkeeper.ui.HiddenAppsConfigActivity"))
            .putExtra("package_name",getContext().getPackageName()).putExtra("package_label","Vela"))){call.resolve();return;}
        if(launch(details()))call.resolve();else call.reject("Ouvrez manuellement Batterie dans les paramètres Android de Vela.");
    }
    @PluginMethod public void openSettings(PluginCall call){
        Intent intent=new Intent(Build.VERSION.SDK_INT>=26?Settings.ACTION_APP_NOTIFICATION_SETTINGS:Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        if(Build.VERSION.SDK_INT>=26)intent.putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());else intent.setData(Uri.parse("package:"+getContext().getPackageName()));
        if(launch(intent)||launch(details()))call.resolve();else call.reject("Ouvrez les paramètres de notifications Android pour Vela.");
    }
}
