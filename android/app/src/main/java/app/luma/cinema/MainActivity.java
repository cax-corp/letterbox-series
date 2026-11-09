package app.luma.cinema;
import android.os.Bundle;
import android.view.View;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState){
        registerPlugin(AppUpdatesPlugin.class);registerPlugin(VelaStoriesPlugin.class);registerPlugin(LumaAppearancePlugin.class);registerPlugin(DailyRecommendationsPlugin.class);super.onCreate(savedInstanceState);
        // The WebView includes both navigation bars: never stretch its entire surface.
        if(getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            private void systemBack(){setEnabled(false);getOnBackPressedDispatcher().onBackPressed();setEnabled(true);}
            @Override public void handleOnBackPressed(){
                if(getBridge()==null||getBridge().getWebView()==null){systemBack();return;}
                getBridge().getWebView().evaluateJavascript("window.lumaHandleBack ? window.lumaHandleBack() : false",value->{if(!"true".equals(value))systemBack();});
            }
        });
    }
}
