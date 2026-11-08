package app.luma.cinema;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "VelaStories")
public class VelaStoriesPlugin extends Plugin {
    private boolean busy;
    private synchronized boolean acquire(PluginCall call) {
        if (busy) { call.reject("A story export is already open"); return false; }
        busy = true; return true;
    }
    private synchronized void release() { busy = false; }
    @PluginMethod public void share(PluginCall call) {
        if (!acquire(call)) return;
        getBridge().execute(() -> {
            try {
                File file = StoryFiles.write(getContext(), call.getString("png"));
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                getBridge().executeOnMainThread(() -> {
                    try {
                        Intent target = "instagram".equals(call.getString("target")) ? StoryIntents.instagram(getContext(), uri) : null;
                        String destination = target == null ? "chooser" : target.getComponent() == null ? "instagram" : "instagram-story";
                        try { getActivity().startActivity(target != null ? target : Intent.createChooser(StoryIntents.image(uri), "Vela")); }
                        catch (ActivityNotFoundException error) {
                            getActivity().startActivity(Intent.createChooser(StoryIntents.image(uri), "Vela")); destination = "chooser";
                        }
                        JSObject result = new JSObject(); result.put("destination", destination); call.resolve(result);
                    } catch (Exception error) { call.reject("Unable to open image sharing", error); }
                    finally { release(); }
                });
            } catch (Exception error) { release(); call.reject("Unable to prepare story", error); }
        });
    }
    @PluginMethod public void save(PluginCall call) {
        if (!acquire(call)) return;
        getBridge().execute(() -> {
            try {
                File file = StoryFiles.write(getContext(), call.getString("png"));
                if (Build.VERSION.SDK_INT >= 29) {
                    saveToGallery(file); release(); JSObject result = new JSObject(); result.put("saved", true); call.resolve(result);
                } else {
                    // Keep only our generated path across the system document picker.
                    call.getData().put("storyFile", file.getAbsolutePath()); call.getData().remove("png");
                    getBridge().executeOnMainThread(() -> {
                        try { startActivityForResult(call, StoryIntents.saveDocument(), "saveResult"); }
                        catch (Exception error) { release(); call.reject("Unable to open file picker", error); }
                    });
                }
            } catch (Exception error) { release(); call.reject("Unable to save story", error); }
        });
    }
    private void copy(File file, Uri uri) throws IOException {
        try (FileInputStream input = new FileInputStream(file); OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
            if (output == null) throw new IOException("Image destination unavailable");
            byte[] buffer = new byte[16384]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }
    }
    @android.annotation.TargetApi(29)
    private void saveToGallery(File file) throws IOException {
        ContentValues values = new ContentValues(); values.put(MediaStore.Images.Media.DISPLAY_NAME, "Vela-" + System.currentTimeMillis() + ".png");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png"); values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Vela"); values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Gallery unavailable");
        try {
            copy(file, uri); values.clear(); values.put(MediaStore.Images.Media.IS_PENDING, 0);
            if (getContext().getContentResolver().update(uri, values, null, null) < 1) throw new IOException("Unable to finish image export");
        } catch (IOException | RuntimeException error) { getContext().getContentResolver().delete(uri, null, null); throw error; }
    }
    @ActivityCallback private void saveResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) { release(); return; }
        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null || activityResult.getData().getData() == null) {
            release(); JSObject result = new JSObject(); result.put("saved", false); call.resolve(result); return;
        }
        Uri uri = activityResult.getData().getData();
        getBridge().execute(() -> {
            try {
                File file = new File(call.getString("storyFile", "")), directory = new File(getContext().getCacheDir(), "vela-stories");
                if (!file.getCanonicalFile().getParentFile().equals(directory.getCanonicalFile())) throw new IOException("Invalid story path");
                copy(file, uri); JSObject result = new JSObject(); result.put("saved", true); call.resolve(result);
            } catch (Exception error) { call.reject("Unable to save story", error); }
            finally { release(); }
        });
    }
}
