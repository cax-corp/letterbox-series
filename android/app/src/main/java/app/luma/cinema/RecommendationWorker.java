package app.luma.cinema;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
/** Delayed safety net only. No catalogue request and no recommendation algorithm. */
public class RecommendationWorker extends Worker {
    public RecommendationWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    @NonNull @Override public Result doWork(){
        DailyRecommendations.deliver(getApplicationContext(),getInputData().getLong("generation",-1),getInputData().getLong("dueAt",-1),getInputData().getBoolean("test",false),"backup");
        return Result.success();
    }
}
