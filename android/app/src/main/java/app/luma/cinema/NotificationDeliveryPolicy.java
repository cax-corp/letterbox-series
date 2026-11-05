package app.luma.cinema;
/** Pure scheduling guard shared by the alarm and its WorkManager safety net. */
public final class NotificationDeliveryPolicy {
    private NotificationDeliveryPolicy() {}
    public static boolean shouldDeliver(boolean enabled, long generation, long expectedGeneration, long due, long scheduled, long lastDelivered, long now) {
        return enabled && due > 0 && generation == expectedGeneration && due == scheduled && due != lastDelivered && now >= due - 1000 && now - due <= 6 * 60 * 60 * 1000L;
    }
}
