package app.luma.cinema;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState){
        registerPlugin(LumaAppearancePlugin.class);registerPlugin(DailyRecommendationsPlugin.class);super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            private void systemBack(){setEnabled(false);getOnBackPressedDispatcher().onBackPressed();setEnabled(true);}
            @Override public void handleOnBackPressed(){
                if(getBridge()==null||getBridge().getWebView()==null){systemBack();return;}
                getBridge().getWebView().evaluateJavascript("window.lumaHandleBack ? window.lumaHandleBack() : false",value->{if(!"true".equals(value))systemBack();});
            }
        });
    }
}
