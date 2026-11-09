package app.luma.cinema;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.*;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** A tiny public release manifest, independent of the catalogue and account. */
final class AppUpdates {
    static final String BASE="https://vela.thomasbarial.com/", CHANNEL="vela-updates", WORK="vela-update-check";
    static final int NOTIFICATION_ID=4203;
    static SharedPreferences prefs(Context c){return c.getSharedPreferences("vela-updates",Context.MODE_PRIVATE);}
    static JSONObject validate(JSONObject value) throws Exception {
        int code=value.optInt("versionCode",0);String version=value.optString("version","");
        if(!(value.opt("versionCode") instanceof Number)||((Number)value.opt("versionCode")).doubleValue()!=code||code<1||code>2100000000||!version.matches("[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,4}")||!value.optString("apk","").equals("Vela-"+version+".apk"))throw new IllegalArgumentException("Invalid release");
        JSONObject result=new JSONObject();result.put("versionCode",code);result.put("version",version);result.put("apk","Vela-"+version+".apk");return result;
    }
    static JSONObject latest(Context c){try{return validate(new JSONObject(prefs(c).getString("latest","{}")));}catch(Exception error){return new JSONObject();}}
    static boolean available(Context c,JSONObject latest){try{return latest.optInt("versionCode")>androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(c.getPackageManager().getPackageInfo(c.getPackageName(),0));}catch(Exception error){return false;}}
    static String download(JSONObject latest){return BASE+"downloads/"+latest.optString("apk");}
    static void schedule(Context c){
        if(!prefs(c).getBoolean("enabled",true)){WorkManager.getInstance(c).cancelUniqueWork(WORK);return;}
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build();
        PeriodicWorkRequest request=new PeriodicWorkRequest.Builder(UpdateCheckWorker.class,24,TimeUnit.HOURS).setInitialDelay(24,TimeUnit.HOURS).setConstraints(constraints).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(WORK,ExistingPeriodicWorkPolicy.KEEP,request);
    }
    static synchronized JSONObject check(Context c,boolean force) throws Exception {
        SharedPreferences preferences=prefs(c);long now=System.currentTimeMillis();
        if(!force&&now-preferences.getLong("lastAttempt",0)<24*3600000L)return latest(c);
        preferences.edit().putLong("lastAttempt",now).apply();
        HttpURLConnection connection=(HttpURLConnection)new URL(BASE+"release.json").openConnection();
        connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setInstanceFollowRedirects(false);
        String etag=preferences.getString("etag","");if(!etag.isEmpty()&&latest(c).has("apk"))connection.setRequestProperty("If-None-Match",etag);
        try{
            int status=connection.getResponseCode();
            if(status==HttpURLConnection.HTTP_NOT_MODIFIED){preferences.edit().putLong("lastSuccess",now).apply();JSONObject saved=latest(c);notifyIfNeeded(c,saved);return saved;}
            if(status!=200)throw new IllegalStateException("Update check unavailable");
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[2048];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>8192)throw new IllegalArgumentException("Release manifest too large");output.write(buffer,0,count);}}
            JSONObject release=validate(new JSONObject(new String(output.toByteArray(),StandardCharsets.UTF_8)));
            String tag=connection.getHeaderField("ETag");preferences.edit().putString("latest",release.toString()).putString("etag",tag==null?"":tag).putLong("lastSuccess",now).apply();notifyIfNeeded(c,release);return release;
        }finally{connection.disconnect();}
    }
    static void notifyIfNeeded(Context c,JSONObject release){
        if(!prefs(c).getBoolean("enabled",true)||!available(c,release)||prefs(c).getInt("notified",0)>=release.optInt("versionCode")||!NotificationManagerCompat.from(c).areNotificationsEnabled())return;
        boolean english=prefs(c).getString("language","fr-FR").equals("en-US");
        NotificationManager manager=c.getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(CHANNEL,english?"App updates":"Mises à jour",NotificationManager.IMPORTANCE_DEFAULT));
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(download(release)));intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap=PendingIntent.getActivity(c,NOTIFICATION_ID,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification notification=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_stat_luma).setContentTitle(english?"A Vela update is available":"Une mise à jour de Vela est disponible").setContentText((english?"Version ":"Version ")+release.optString("version")+(english?" · Tap to download":" · Appuyez pour télécharger")).setContentIntent(tap).setAutoCancel(true).build();
        try{manager.notify(NOTIFICATION_ID,notification);prefs(c).edit().putInt("notified",release.optInt("versionCode")).apply();}catch(SecurityException ignored){}
    }
}
