package app.luma.cinema;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
public class UpdateCheckWorker extends Worker {
    public UpdateCheckWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    @NonNull @Override public Result doWork(){if(!AppUpdates.prefs(getApplicationContext()).getBoolean("enabled",true))return Result.success();try{AppUpdates.check(getApplicationContext(),false);}catch(Exception ignored){}return Result.success();}
}
