package app.luma.cinema;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class RecommendationClockReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){synchronized(DailyRecommendations.class){
        boolean clock=Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction())||Intent.ACTION_TIME_CHANGED.equals(intent.getAction());
        android.content.SharedPreferences.Editor edit=DailyRecommendations.prefs(context).edit();
        if(clock)edit.remove("scheduledAt").putLong("generation",DailyRecommendations.prefs(context).getLong("generation",0)+1);
        edit.commit();DailyRecommendations.restore(context);
    }}
}
