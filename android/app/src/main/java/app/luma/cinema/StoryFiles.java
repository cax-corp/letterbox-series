package app.luma.cinema;

import android.content.Context;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;

/** Only accepts a bounded portrait PNG, never a caller-supplied file path. */
final class StoryFiles {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final byte[] SIGNATURE = {(byte)137,80,78,71,13,10,26,10};
    static File write(Context context, String encoded) throws IOException {
        if (encoded == null || encoded.length() > (MAX_BYTES * 4L / 3 + 8)) throw new IOException("Invalid story image size");
        byte[] png;
        try { png = Base64.decode(encoded, Base64.DEFAULT); }
        catch (IllegalArgumentException error) { throw new IOException("Invalid story image", error); }
        if (png.length < 24 || png.length > MAX_BYTES || !Arrays.equals(Arrays.copyOf(png, 8), SIGNATURE)) throw new IOException("Invalid PNG");
        BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(png, 0, png.length, options);
        if (options.outWidth != 1080 || options.outHeight != 1920) throw new IOException("Invalid story dimensions");
        File directory = new File(context.getCacheDir(), "vela-stories");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Story cache unavailable");
        File[] files = directory.listFiles();
        if (files != null) {
            Arrays.sort(files, (a,b) -> Long.compare(b.lastModified(), a.lastModified()));
            for (int i=0; i<files.length; i++) if (i >= 19 || System.currentTimeMillis() - files[i].lastModified() > 86400000L) files[i].delete();
        }
        File result = new File(directory, UUID.randomUUID() + ".png");
        try (FileOutputStream output = new FileOutputStream(result)) { output.write(png); }
        return result;
    }
}
