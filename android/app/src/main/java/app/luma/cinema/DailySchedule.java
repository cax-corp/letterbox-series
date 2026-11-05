package app.luma.cinema;

import java.util.Calendar;
import java.util.Set;
import java.util.TimeZone;

public final class DailySchedule {
    private DailySchedule() {}
    public static long next(long now, int hour, int minute, Set<Integer> days, TimeZone zone) {
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || days.isEmpty()) throw new IllegalArgumentException("Invalid schedule");
        Calendar today = Calendar.getInstance(zone);
        today.setTimeInMillis(now);
        for (int i = 0; i <= 7; i++) {
            Calendar candidate = (Calendar) today.clone();
            candidate.add(Calendar.DAY_OF_YEAR, i);
            candidate.set(Calendar.HOUR_OF_DAY, hour);
            candidate.set(Calendar.MINUTE, minute);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            if (days.contains(candidate.get(Calendar.DAY_OF_WEEK) - 1) && candidate.getTimeInMillis() > now) return candidate.getTimeInMillis();
        }
        throw new IllegalArgumentException("No selected weekday");
    }
}
