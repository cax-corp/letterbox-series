package app.luma.cinema;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
/** OS entry point works without MainActivity, WebView, Internet, or the feed model. */
public class RecommendationAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){DailyRecommendations.deliver(context,intent.getLongExtra("generation",-1),intent.getLongExtra("dueAt",-1),intent.getBooleanExtra("test",false),"alarm");}
}
