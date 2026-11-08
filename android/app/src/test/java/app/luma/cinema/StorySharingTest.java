package app.luma.cinema;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.ByteArrayOutputStream;
import java.io.File;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 34})
public class StorySharingTest {
    private final Context context = RuntimeEnvironment.getApplication();
    private final Uri uri = Uri.parse("content://app.luma.cinema.fileprovider/my_cache_images/vela-stories/test.png");
    private String png(int width, int height) {
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        ByteArrayOutputStream stream = new ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream); bitmap.recycle();
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
    }
    private void resolver(Intent intent, String name, boolean exported) {
        ResolveInfo info = new ResolveInfo(); info.activityInfo = new ActivityInfo();
        info.activityInfo.name = name; info.activityInfo.packageName = StoryIntents.INSTAGRAM; info.activityInfo.exported = exported;
        shadowOf(context.getPackageManager()).addResolveInfoForIntent(intent, info);
    }
    @Test public void pngCreatesReadablePrivateContentUri() throws Exception {
        File file = StoryFiles.write(context, png(1080, 1920));
        assertTrue(file.length() > 24); assertEquals("vela-stories", file.getParentFile().getName());
        Uri content = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        assertEquals("content", content.getScheme());
        try (java.io.InputStream input = context.getContentResolver().openInputStream(content)) { assertEquals(137, input.read()); }
    }
    @Test public void invalidDimensionsAndNonPngAreRejected() throws Exception {
        for (String value : new String[] {png(12,12), "not-base64!", Base64.encodeToString(new byte[100], Base64.NO_WRAP)}) {
            assertThrows(java.io.IOException.class, () -> StoryFiles.write(context, value));
        }
    }
    @Test public void sharingGrantsOnlyReadAccessAndSendsImageOnly() {
        Intent intent = StoryIntents.image(uri);
        assertEquals(Intent.ACTION_SEND, intent.getAction()); assertEquals("image/png", intent.getType());
        assertEquals(uri, intent.getParcelableExtra(Intent.EXTRA_STREAM)); assertEquals(uri, intent.getClipData().getItemAt(0).getUri());
        assertTrue((intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0);
        assertEquals(0, intent.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        assertFalse(intent.hasExtra(Intent.EXTRA_TEXT)); assertFalse(intent.hasExtra("source_application"));
    }
    @Test public void noInstagramUsesSystemFallback() { assertNull(StoryIntents.instagram(context, uri)); }
    @Test public void prefersOnlyExportedAdvertisedStoryDestination() {
        Intent query = StoryIntents.image(uri).setPackage(StoryIntents.INSTAGRAM);
        resolver(query, "com.instagram.share.HiddenStory", false);
        resolver(query, "com.instagram.share.Feed", true);
        resolver(query, "com.instagram.share.Stories", true);
        Intent result = StoryIntents.instagram(context, uri);
        assertNotNull(result); assertEquals("com.instagram.share.Stories", result.getComponent().getClassName());
    }
    @Test public void instagramWithoutStoryDestinationUsesItsShareMenu() {
        resolver(StoryIntents.image(uri).setPackage(StoryIntents.INSTAGRAM), "com.instagram.share.Feed", true);
        Intent result = StoryIntents.instagram(context, uri);
        assertNotNull(result); assertEquals(StoryIntents.INSTAGRAM, result.getPackage()); assertNull(result.getComponent());
    }
    @Test public void legacySaveUsesDocumentPickerWithoutStoragePermission() {
        Intent save = StoryIntents.saveDocument(); assertEquals(Intent.ACTION_CREATE_DOCUMENT, save.getAction());
        assertEquals("image/png", save.getType()); assertTrue(save.hasCategory(Intent.CATEGORY_OPENABLE));
        assertEquals("Vela-story.png", save.getStringExtra(Intent.EXTRA_TITLE));
    }
    @Test public void cacheDoesNotGrowIndefinitely() throws Exception {
        String png = png(1080,1920);
        for (int i=0; i<24; i++) StoryFiles.write(context, png);
        assertTrue(new File(context.getCacheDir(),"vela-stories").listFiles().length <= 20);
    }
}
