package app.luma.cinema;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class DailyRecommendations {
    public static final String WORK="luma-daily-recommendation", CHANNEL="luma-recommendations";
    public static final int NOTIFICATION_ID=7301, TEST_ID=7302;
    private static final int SCHEDULER_VERSION=3;
    public static SharedPreferences prefs(Context c){return c.getSharedPreferences("luma-daily",Context.MODE_PRIVATE);}
    public static JSONObject config(Context c){try{return new JSONObject(prefs(c).getString("config","{}"));}catch(JSONException e){return new JSONObject();}}
    public static void channel(Context c){if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"Recommandations Vela",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("Votre idée de film à l’heure choisie");c.getSystemService(NotificationManager.class).createNotificationChannel(channel);}}
    public static boolean allowed(Context c){
        if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return false;
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        if(Build.VERSION.SDK_INT>=26){NotificationChannel ch=c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);if(ch!=null&&ch.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}
        return true;
    }
    public static boolean exactAllowed(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
    public static long next(Context c){
        JSONObject config=config(c);if(!config.optBoolean("enabled"))return 0;
        Set<Integer> days=new HashSet<>();JSONArray array=config.optJSONArray("days");if(array!=null)for(int i=0;i<array.length();i++)days.add(array.optInt(i,-1));
        return DailySchedule.next(System.currentTimeMillis(),config.optInt("hour",19),config.optInt("minute",0),days,TimeZone.getDefault());
    }
    private static PendingIntent alarm(Context c,boolean test,long generation,long due,int flags){
        Intent intent=new Intent(c,RecommendationAlarmReceiver.class).setAction(test?"app.luma.NOTIFICATION_TEST":"app.luma.DAILY_NOTIFICATION").putExtra("generation",generation).putExtra("dueAt",due).putExtra("test",test);
        return PendingIntent.getBroadcast(c,test?TEST_ID:NOTIFICATION_ID,intent,flags|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void cancelAlarm(Context c,boolean test){
        PendingIntent pending=alarm(c,test,0,0,PendingIntent.FLAG_NO_CREATE);
        if(pending!=null){c.getSystemService(AlarmManager.class).cancel(pending);pending.cancel();}
        WorkManager.getInstance(c).cancelUniqueWork(test?WORK+"-test":WORK);
    }
    private static void arm(Context c,boolean test,long due,boolean replaceBackup){
        long generation=prefs(c).getLong(test?"testGeneration":"generation",0),now=System.currentTimeMillis();
        PendingIntent operation=alarm(c,test,generation,due,PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager manager=c.getSystemService(AlarmManager.class);long trigger=Math.max(now+1000,due);
        String method="inexact";
        try {
            if(exactAllowed(c)){
                if(test?prefs(c).getBoolean("testReliableAlarm",false):config(c).optBoolean("reliableAlarm",false)){
                    // Visible, user-selected alarm-clock mode: the OS leaves Doze for this reminder.
                    // The info intent only opens settings when the user taps Android's next-alarm UI.
                    Intent show=new Intent(c,MainActivity.class).setAction("app.luma.SHOW_REMINDER").putExtra("luma_open_settings",true)
                        .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    PendingIntent info=PendingIntent.getActivity(c,test?TEST_ID+10:NOTIFICATION_ID+10,show,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                    manager.setAlarmClock(new AlarmManager.AlarmClockInfo(trigger,info),operation);method="alarm_clock";
                }else{manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,operation);method="exact";}
            }else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,operation);
        }catch(SecurityException denied){manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,operation);}
        prefs(c).edit().putString(test?"testAlarmMethod":"alarmMethod",method).putLong(test?"testArmedAt":"armedAt",now).commit();
        // Notification-only backup: no network, WebView, ranking or foreground service.
        OneTimeWorkRequest backup=new OneTimeWorkRequest.Builder(RecommendationWorker.class)
            .setInputData(new Data.Builder().putLong("generation",generation).putLong("dueAt",due).putBoolean("test",test).build())
            .setInitialDelay(Math.max(1000,due+2*60*1000L-now),TimeUnit.MILLISECONDS).build();
        WorkManager.getInstance(c).enqueueUniqueWork(test?WORK+"-test":WORK,replaceBackup?ExistingWorkPolicy.REPLACE:ExistingWorkPolicy.KEEP,backup);
    }
    public static synchronized void schedule(Context c,boolean advance){
        channel(c);
        if(!config(c).optBoolean("enabled")){
            cancelAlarm(c,false);cancelAlarm(c,true);prefs(c).edit().remove("scheduledAt").remove("testAt").remove("alarmMethod").remove("testAlarmMethod").commit();
            c.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);return;
        }
        long now=System.currentTimeMillis(),saved=prefs(c).getLong("scheduledAt",0),previousTarget=saved;
        boolean migrate=prefs(c).getInt("schedulerVersion",0)!=SCHEDULER_VERSION;
        if(advance||saved<=0||saved==prefs(c).getLong("lastDeliveredDue",-1)||now-saved>6*60*60*1000L)saved=next(c);
        // Persist before handing control to Android, including after a cold background delivery.
        prefs(c).edit().putLong("scheduledAt",saved).putInt("schedulerVersion",SCHEDULER_VERSION).commit();
        arm(c,false,saved,advance||migrate||saved!=previousTarget);
    }
    private static void noticeMissed(Context c,boolean test){
        long due=prefs(c).getLong(test?"testAt":"scheduledAt",0);
        if(due>0&&System.currentTimeMillis()-due>2*60*1000L&&prefs(c).getLong(test?"lastTestDue":"lastDeliveredDue",0)!=due){
            prefs(c).edit().putLong("lastMissedAt",due).putBoolean("lastMissedTest",test).commit();
        }
    }
    public static synchronized void restore(Context c){
        noticeMissed(c,false);noticeMissed(c,true);
        // A stand-alone minute test may be enabled while the daily reminder is disabled.
        if(config(c).optBoolean("enabled"))schedule(c,false);
        long test=prefs(c).getLong("testAt",0);
        if(test>0){
            if(System.currentTimeMillis()-test>6*60*60*1000L){prefs(c).edit().remove("testAt").commit();cancelAlarm(c,true);}
            else arm(c,true,test,false);
        }
    }
    public static synchronized long test(Context c,boolean immediate,boolean reliable){
        channel(c);long due=System.currentTimeMillis()+(immediate?0:60000),generation=prefs(c).getLong("testGeneration",0)+1;
        cancelAlarm(c,true);
        prefs(c).edit().putLong("testAt",due).putLong("testGeneration",generation).putBoolean("testReliableAlarm",reliable).commit();
        if(immediate)deliver(c,generation,due,true,"immediate");else arm(c,true,due,true);
        return due;
    }
    public static JSONArray recent(Context c){try{return new JSONArray(prefs(c).getString("recent","[]"));}catch(JSONException e){return new JSONArray();}}
    public static synchronized void deliver(Context c,long generation,long due,boolean test,String source){
        long now=System.currentTimeMillis(),scheduled=prefs(c).getLong(test?"testAt":"scheduledAt",0);
        boolean valid=NotificationDeliveryPolicy.shouldDeliver(test||config(c).optBoolean("enabled"),generation,prefs(c).getLong(test?"testGeneration":"generation",0),due,scheduled,prefs(c).getLong(test?"lastTestDue":"lastDeliveredDue",-1),now);
        if(!valid){if(!test&&due==scheduled&&generation==prefs(c).getLong("generation",0))schedule(c,false);return;}
        prefs(c).edit().putLong("lastAttemptAt",now).putLong("lastAttemptDue",due).putString("lastSource",source).putString("lastStatus","started").putBoolean("lastAttemptTest",test).commit();
        try {
            channel(c);
            if(allowed(c)){
                JSONObject item=NotificationQueue.choose(config(c),recent(c)),title=item==null?null:NotificationQueue.title(item);
                Intent intent=new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if(title!=null)intent.putExtra("luma_recommendation",title.toString());else intent.putExtra("luma_open_recommendations",true);
                PendingIntent opened=PendingIntent.getActivity(c,test?TEST_ID:NOTIFICATION_ID,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                String heading=title==null?"Votre pause cinéma vous attend":"À découvrir : "+title.optString("name");
                String text=title==null?"Ouvrez Vela pour découvrir vos prochaines recommandations.":item.optString("reason","Un film choisi pour vos goûts");
                NotificationCompat.Builder notification=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(app.luma.cinema.R.drawable.ic_stat_luma)
                    .setContentTitle(test?"Test Vela · "+heading:heading).setContentText(text).setAutoCancel(true).setContentIntent(opened)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(title==null?text:title.optString("summary",text)));
                NotificationManagerCompat.from(c).notify(test?TEST_ID:NOTIFICATION_ID,notification.build());
                SharedPreferences.Editor edit=prefs(c).edit().putLong(test?"lastTestDue":"lastDeliveredDue",due).putLong("lastSentAt",now).putString("lastStatus","posted");
                // Tests must not consume the daily film reserve.
                if(title!=null&&!test){JSONArray old=recent(c);old.put(title);JSONArray trimmed=new JSONArray();for(int i=Math.max(0,old.length()-30);i<old.length();i++)trimmed.put(old.opt(i));edit.putString("recent",trimmed.toString());}
                edit.commit();
            }else prefs(c).edit().putString("lastStatus","blocked").commit();
        }catch(SecurityException denied){prefs(c).edit().putString("lastStatus","permission_error").commit();}
        catch(RuntimeException failed){prefs(c).edit().putString("lastStatus","delivery_error").commit();}
        finally{if(test){prefs(c).edit().remove("testAt").commit();cancelAlarm(c,true);}else schedule(c,true);}
    }
}
