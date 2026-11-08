package app.luma.cinema;

import android.content.ClipData;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import java.util.Locale;

final class StoryIntents {
    static final String INSTAGRAM = "com.instagram.android";
    static Intent image(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_SEND).setType("image/png");
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        intent.setClipData(ClipData.newRawUri("Vela story", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return intent;
    }
    @SuppressWarnings("deprecation")
    static Intent instagram(Context context, Uri uri) {
        Intent intent = image(uri).setPackage(INSTAGRAM);
        boolean available = false;
        for (ResolveInfo info : context.getPackageManager().queryIntentActivities(intent, 0)) {
            if (info.activityInfo == null || !info.activityInfo.exported || !INSTAGRAM.equals(info.activityInfo.packageName)) continue;
            available = true;
            String name = info.activityInfo.name.toLowerCase(Locale.ROOT);
            // Only use a Story destination Instagram actually advertises for image sharing.
            if (name.contains("story") || name.contains("stories")) {
                intent.setComponent(new ComponentName(INSTAGRAM, info.activityInfo.name)); return intent;
            }
        }
        return available ? intent : null;
    }
    static Intent saveDocument() {
        return new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("image/png")
            .addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "Vela-story.png");
    }
}
