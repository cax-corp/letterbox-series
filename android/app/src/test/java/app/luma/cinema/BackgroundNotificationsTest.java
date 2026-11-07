package app.luma.cinema;

import android.Manifest;
import android.app.*;
import android.content.*;
import androidx.work.*;
import androidx.work.testing.*;
import com.getcapacitor.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=34)
public class BackgroundNotificationsTest {
    private Context context;
    private JSONObject configuration()throws Exception{
        JSONObject title=new JSONObject().put("id","tmdb-movie-1").put("kind","movie").put("name","Film préparé").put("year","2024").put("summary","Une aventure à découvrir.");
        return new JSONObject().put("enabled",true).put("hour",19).put("minute",0).put("days",new JSONArray("[0,1,2,3,4,5,6]")).put("candidates",new JSONArray().put(new JSONObject().put("title",title).put("reason","Choisi pour vos goûts"))).put("excluded",new JSONArray());
    }
    @Before public void setup()throws Exception{
        context=RuntimeEnvironment.getApplication();
        shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(true);
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
        WorkManagerTestInitHelper.initializeTestWorkManager(context,new Configuration.Builder().setExecutor(new SynchronousExecutor()).build());
        DailyRecommendations.prefs(context).edit().clear().putString("config",configuration().toString()).putLong("generation",7).apply();
        DailyRecommendations.channel(context);
    }
    @After public void close(){WorkManager.getInstance(context).cancelAllWork();WorkManagerTestInitHelper.closeWorkDatabase();}
    private Intent dueIntent(long due,boolean test){return new Intent(context,RecommendationAlarmReceiver.class).putExtra("generation",test?DailyRecommendations.prefs(context).getLong("testGeneration",0):7L).putExtra("dueAt",due).putExtra("test",test);}
    private static class Call extends PluginCall{
        JSObject result;String error;
        Call(JSObject data){super(null,"DailyRecommendations","test","test",data);}
        @Override public void resolve(){result=new JSObject();}
        @Override public void resolve(JSObject value){result=value;}
        @Override public void reject(String value){error=value;}
    }
    private DailyRecommendationsPlugin plugin(){return new DailyRecommendationsPlugin(){@Override public Context getContext(){return context;}};}
    @Test public void languageRefreshPostsEnglishWithoutActivityAndKeepsSchedule()throws Exception{
        long due=System.currentTimeMillis()-100;
        DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        JSObject next=new JSObject(configuration().toString()).put("language","en-US");
        next.getJSONArray("candidates").getJSONObject(0).getJSONObject("title").put("name","Space journey").put("summary","An astronaut explores a distant planet.");
        next.getJSONArray("candidates").getJSONObject(0).put("reason","A pick based on your tastes");
        Call call=new Call(new JSObject().put("context",next));plugin().updateContext(call);
        assertNull(call.error);assertEquals(due,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        Notification notification=shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.NOTIFICATION_ID);
        assertNotNull(notification);assertEquals("Discover: Space journey",notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString());
        assertEquals("A pick based on your tastes",notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString());
        assertNull(shadowOf(RuntimeEnvironment.getApplication()).peekNextStartedActivity());
    }
    @Test public void exactAlarmIsRegisteredWithIdlePermissionAndGeneration(){
        DailyRecommendations.schedule(context,false);
        ShadowAlarmManager.ScheduledAlarm alarm=shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm();
        assertNotNull(alarm);assertEquals(AlarmManager.RTC_WAKEUP,alarm.type);assertTrue(alarm.allowWhileIdle);assertEquals(0,alarm.getWindowLengthMs());
        Intent intent=shadowOf(alarm.operation).getSavedIntent();
        assertEquals(7,intent.getLongExtra("generation",-1));assertEquals(DailyRecommendations.prefs(context).getLong("scheduledAt",0),intent.getLongExtra("dueAt",0));
    }
    @Test public void deniedExactAccessKeepsAnInexactIdleAlarm(){
        ShadowAlarmManager.setCanScheduleExactAlarms(false);DailyRecommendations.schedule(context,false);
        ShadowAlarmManager.ScheduledAlarm alarm=shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm();
        assertNotNull(alarm);assertTrue(alarm.allowWhileIdle);assertNotEquals(0,alarm.getWindowLengthMs());assertFalse(DailyRecommendations.exactAllowed(context));
    }
    @Test public void receiverPostsWithoutAnyActivityAndRearmsNextDay()throws Exception{
        long due=System.currentTimeMillis()-100;
        DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        Notification notification=shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.NOTIFICATION_ID);
        assertNotNull(notification);assertTrue(notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString().contains("Film préparé"));
        assertNull(shadowOf(RuntimeEnvironment.getApplication()).peekNextStartedActivity());
        assertEquals(due,DailyRecommendations.prefs(context).getLong("lastDeliveredDue",0));
        assertTrue(DailyRecommendations.prefs(context).getLong("scheduledAt",0)>System.currentTimeMillis());
        assertEquals("posted",DailyRecommendations.prefs(context).getString("lastStatus",""));
        assertEquals("alarm",DailyRecommendations.prefs(context).getString("lastSource",""));
        assertTrue(shadowOf(notification.contentIntent).getSavedIntent().hasExtra("luma_recommendation"));
    }
    @Test public void backupOrDuplicateBroadcastCannotPublishTwice()throws Exception{
        long due=System.currentTimeMillis()-100;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        assertEquals(1,DailyRecommendations.recent(context).length());
    }
    @Test public void emptyReserveStillPostsAnOpenFeedReminder()throws Exception{
        JSONObject config=configuration().put("candidates",new JSONArray());long due=System.currentTimeMillis()-100;
        DailyRecommendations.prefs(context).edit().putString("config",config.toString()).putLong("scheduledAt",due).apply();
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        Notification notification=shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.NOTIFICATION_ID);
        assertNotNull(notification);assertTrue(shadowOf(notification.contentIntent).getSavedIntent().getBooleanExtra("luma_open_recommendations",false));
    }
    @Test public void blockedNotificationsAreNotPosted()throws Exception{
        shadowOf(context.getSystemService(NotificationManager.class)).setNotificationsEnabled(false);long due=System.currentTimeMillis()-100;
        DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,false));
        assertNull(shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.NOTIFICATION_ID));
        assertEquals("blocked",DailyRecommendations.prefs(context).getString("lastStatus",""));
    }
    @Test public void contextRefreshDoesNotMoveTheAlarmOrChangeItsGeneration()throws Exception{
        long due=System.currentTimeMillis()+30000;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        Call call=new Call(new JSObject().put("context",new JSObject(configuration().toString()).put("preparedAt",12345)));
        plugin().updateContext(call);assertNull(call.error);assertNotNull(call.result);
        assertEquals(7,DailyRecommendations.prefs(context).getLong("generation",0));assertEquals(due,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
        assertEquals(due,call.result.optLong("nextAt"));
    }
    @Test public void testInOneMinuteIsIndependentOfTheRegularSchedule()throws Exception{
        long now=System.currentTimeMillis(),regular=now+600000;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",regular).apply();
        Call call=new Call(new JSObject());plugin().testNotification(call);assertNull(call.error);
        assertTrue(call.result.optLong("testAt")>=now+60000);assertEquals(regular,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
        long due=System.currentTimeMillis()-100;DailyRecommendations.prefs(context).edit().putLong("testAt",due).putLong("generation",8).apply();
        new RecommendationAlarmReceiver().onReceive(context,dueIntent(due,true));
        assertNotNull(shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.TEST_ID));
        assertEquals(regular,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
    }
    @Test public void bootReceiverRestoresTheRegisteredAlarm(){
        long due=System.currentTimeMillis()+60000;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        new RecommendationClockReceiver().onReceive(context,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertNotNull(shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm());assertEquals(due,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
    }
    @Test public void disabledScheduleCancelsTheRegisteredAlarm()throws Exception{
        DailyRecommendations.schedule(context,false);DailyRecommendations.prefs(context).edit().putString("config",configuration().put("enabled",false).toString()).apply();
        DailyRecommendations.schedule(context,false);assertNull(shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm());
    }
    @Test public void workManagerBackupPostsWithoutNetworkOrActivity()throws Exception{
        long due=System.currentTimeMillis()-100;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",due).apply();
        RecommendationWorker worker=TestWorkerBuilder.from(context,RecommendationWorker.class,new SynchronousExecutor()).setInputData(new Data.Builder().putLong("generation",7).putLong("dueAt",due).build()).build();
        worker.doWork();
        assertNotNull(shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.NOTIFICATION_ID));
        assertNull(shadowOf(RuntimeEnvironment.getApplication()).peekNextStartedActivity());
        assertEquals(1,DailyRecommendations.recent(context).length());
    }


    @Test public void reinforcedModeRegistersAVisibleAlarmClockAndPreservesUserTime()throws Exception{
        DailyRecommendations.prefs(context).edit().putString("config",configuration().put("reliableAlarm",true).toString()).commit();
        DailyRecommendations.schedule(context,false);
        AlarmManager manager=context.getSystemService(AlarmManager.class);
        AlarmManager.AlarmClockInfo clock=manager.getNextAlarmClock();
        assertNotNull(clock);assertEquals(DailyRecommendations.prefs(context).getLong("scheduledAt",0),clock.getTriggerTime());
        Intent show=shadowOf(clock.getShowIntent()).getSavedIntent();assertTrue(show.getBooleanExtra("luma_open_settings",false));
        assertEquals(MainActivity.class.getName(),show.getComponent().getClassName());
        assertEquals("alarm_clock",DailyRecommendations.prefs(context).getString("alarmMethod",""));
        ShadowAlarmManager.ScheduledAlarm alarm=shadowOf(manager).peekNextScheduledAlarm();
        assertEquals(RecommendationAlarmReceiver.class.getName(),shadowOf(alarm.operation).getSavedIntent().getComponent().getClassName());
    }
    @Test public void reinforcedModeWithoutExactAccessIsReportedAsInexact()throws Exception{
        ShadowAlarmManager.setCanScheduleExactAlarms(false);
        DailyRecommendations.prefs(context).edit().putString("config",configuration().put("reliableAlarm",true).toString()).commit();
        DailyRecommendations.schedule(context,false);Call state=new Call(new JSObject());plugin().getState(state);
        assertNull(context.getSystemService(AlarmManager.class).getNextAlarmClock());
        assertFalse(state.result.optBoolean("exactAllowed"));assertEquals("inexact",state.result.optString("alarmMethod"));
    }
    @Test public void immediateTestPublishesWithoutChangingDailyAlarmOrConsumingReserve()throws Exception{
        DailyRecommendations.schedule(context,false);long regular=DailyRecommendations.prefs(context).getLong("scheduledAt",0);
        Call call=new Call(new JSObject().put("immediate",true));plugin().testNotification(call);
        assertNull(call.error);assertNotNull(shadowOf(context.getSystemService(NotificationManager.class)).getNotification(DailyRecommendations.TEST_ID));
        assertEquals("immediate",call.result.optString("lastSource"));assertEquals("posted",call.result.optString("lastStatus"));
        assertEquals(regular,DailyRecommendations.prefs(context).getLong("scheduledAt",0));assertEquals(0,DailyRecommendations.recent(context).length());
        assertEquals(0,call.result.optLong("testAt"));assertTrue(call.result.optBoolean("notificationActive"));
    }
    @Test public void minuteTestUsesDraftReliabilityWithoutModifyingDailySettings()throws Exception{
        Call call=new Call(new JSObject().put("context",new JSObject(configuration().toString()).put("reliableAlarm",true)));
        plugin().testNotification(call);assertNull(call.error);
        assertNotNull(context.getSystemService(AlarmManager.class).getNextAlarmClock());
        assertEquals("alarm_clock",call.result.optString("testAlarmMethod"));assertFalse(DailyRecommendations.config(context).optBoolean("reliableAlarm"));
    }
    @Test public void returningAfterAnUnfiredAlarmRecordsTheMissedTimeAndPreservesItsDue(){
        long missed=System.currentTimeMillis()-180000;DailyRecommendations.prefs(context).edit().putLong("scheduledAt",missed).commit();
        DailyRecommendations.restore(context);
        assertEquals(missed,DailyRecommendations.prefs(context).getLong("lastMissedAt",0));
        assertEquals(missed,DailyRecommendations.prefs(context).getLong("scheduledAt",0));
    }
    @Test public void bootRestoresStandaloneMinuteTestWhenDailyScheduleIsDisabled()throws Exception{
        DailyRecommendations.prefs(context).edit().putString("config",configuration().put("enabled",false).toString()).commit();
        long due=DailyRecommendations.test(context,false,true);
        context.getSystemService(AlarmManager.class).cancel(shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm().operation);
        assertNull(shadowOf(context.getSystemService(AlarmManager.class)).peekNextScheduledAlarm());
        new RecommendationClockReceiver().onReceive(context,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertNotNull(context.getSystemService(AlarmManager.class).getNextAlarmClock());
        assertEquals(due,context.getSystemService(AlarmManager.class).getNextAlarmClock().getTriggerTime());
        assertFalse(DailyRecommendations.config(context).optBoolean("enabled"));
    }
    @Test public void enablingReinforcedModeThroughPluginSavesItAndCancellationRemovesAlarmClock()throws Exception{
        Call call=new Call(new JSObject().put("config",new JSObject(configuration().toString()).put("reliableAlarm",true)));
        plugin().configure(call);assertNull(call.error);assertTrue(call.result.optJSONObject("config").optBoolean("reliableAlarm"));
        assertNotNull(context.getSystemService(AlarmManager.class).getNextAlarmClock());
        Call off=new Call(new JSObject().put("config",new JSObject(configuration().put("enabled",false).toString())));plugin().configure(off);
        assertNull(off.error);assertNull(context.getSystemService(AlarmManager.class).getNextAlarmClock());
    }


    @Test public void grantingExactAccessUpgradesThePendingReminderWithoutPostponingIt()throws Exception{
        long due=System.currentTimeMillis()+60000;
        DailyRecommendations.prefs(context).edit().putString("config",configuration().put("reliableAlarm",true).toString()).putLong("scheduledAt",due).commit();
        ShadowAlarmManager.setCanScheduleExactAlarms(false);DailyRecommendations.schedule(context,false);
        assertEquals("inexact",DailyRecommendations.prefs(context).getString("alarmMethod",""));
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
        new RecommendationClockReceiver().onReceive(context,new Intent(AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED));
        assertEquals(due,context.getSystemService(AlarmManager.class).getNextAlarmClock().getTriggerTime());
        assertEquals(7,DailyRecommendations.prefs(context).getLong("generation",0));
    }
    @Test public void xiaomiScreensUsePackageScopedBatteryOptionsAndAutostart()throws Exception{
        String maker=android.os.Build.MANUFACTURER,brand=android.os.Build.BRAND;
        try{
            org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"MANUFACTURER","Xiaomi");
            org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"BRAND","POCO");
            assertTrue(DailyRecommendationsPlugin.isXiaomi());
            Call battery=new Call(new JSObject());plugin().openBackgroundSettings(battery);assertNull(battery.error);
            Intent opened=shadowOf(RuntimeEnvironment.getApplication()).getNextStartedActivity();
            assertEquals("com.miui.powerkeeper.ui.HiddenAppsConfigActivity",opened.getComponent().getClassName());
            assertEquals(context.getPackageName(),opened.getStringExtra("package_name"));
            Call auto=new Call(new JSObject());plugin().openAutoStartSettings(auto);assertNull(auto.error);
            assertEquals("com.miui.permcenter.autostart.AutoStartManagementActivity",shadowOf(RuntimeEnvironment.getApplication()).getNextStartedActivity().getComponent().getClassName());
        }finally{
            org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"MANUFACTURER",maker);
            org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"BRAND",brand);
        }
    }
    @Test public void missingOrPrivateXiaomiScreensFallBackToAppDetails(){
        String maker=android.os.Build.MANUFACTURER;
        try{
            org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"MANUFACTURER","Xiaomi");
            final Intent[] fallback=new Intent[1];
            Context restricted=new ContextWrapper(context){@Override public void startActivity(Intent intent){
                if(intent.getComponent()!=null)throw new SecurityException("Private OEM screen");fallback[0]=intent;
            }};
            DailyRecommendationsPlugin nativePlugin=new DailyRecommendationsPlugin(){@Override public Context getContext(){return restricted;}};
            Call call=new Call(new JSObject());nativePlugin.openBackgroundSettings(call);assertNull(call.error);
            assertEquals(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,fallback[0].getAction());
            assertEquals("package:"+context.getPackageName(),fallback[0].getDataString());
            fallback[0]=null;nativePlugin.openAutoStartSettings(call);assertNotNull(fallback[0]);
        }finally{org.robolectric.util.ReflectionHelpers.setStaticField(android.os.Build.class,"MANUFACTURER",maker);}
    }

}
