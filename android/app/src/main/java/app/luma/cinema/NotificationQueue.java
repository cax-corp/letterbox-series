package app.luma.cinema;
import org.json.*;
import java.text.Normalizer;
import java.util.Locale;
/** Picks from an already prepared queue. No network, scoring engine or WebView. */
public final class NotificationQueue {
    private NotificationQueue() {}
    static JSONObject title(JSONObject item) { return item.optJSONObject("title") != null ? item.optJSONObject("title") : item; }
    private static String normal(String s) { return Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+"," ").trim(); }
    private static boolean excluded(JSONObject item, JSONArray entries) {
        if(entries==null)return false;
        JSONObject t=title(item);
        for(int i=0;i<entries.length();i++) {
            JSONObject old=entries.optJSONObject(i);if(old==null)continue;old=title(old);
            if(t.optString("id").equals(old.optString("id")))return true;
            if(!old.optString("kind","movie").equals("movie"))continue;
            boolean sameYear=old.optString("year").isEmpty()||t.optString("year").isEmpty()||old.optString("year").equals(t.optString("year"));
            String name=normal(old.optString("name"));
            if(sameYear&&!name.isEmpty()&&(name.equals(normal(t.optString("name")))||name.equals(normal(t.optString("original")))))return true;
        }
        return false;
    }
    public static JSONObject choose(JSONObject config, JSONArray recent) {
        JSONArray candidates=config.optJSONArray("candidates");if(candidates==null)return null;
        for(int i=0;i<Math.min(candidates.length(),30);i++) {
            JSONObject item=candidates.optJSONObject(i);if(item==null)continue;
            JSONObject t=title(item);
            if(!t.optString("id").matches("^(tmdb-)?movie-[0-9]+$")||t.optString("name").isEmpty())continue;
            if(!excluded(item,recent)&&!excluded(item,config.optJSONArray("excluded")))return item;
        }
        return null;
    }
    public static int count(JSONObject config, JSONArray recent) {
        try {
            JSONArray copy=new JSONArray(recent.toString());int count=0;JSONObject item;
            while(count<30&&(item=choose(config,copy))!=null){copy.put(title(item));count++;}
            return count;
        } catch(JSONException ignored){return 0;}
    }
}
