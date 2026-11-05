package app.luma.cinema;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;
public class DailyScheduleTest {
    private long at(TimeZone zone,int year,int month,int day,int hour,int minute) {Calendar c=Calendar.getInstance(zone);c.clear();c.set(year,month-1,day,hour,minute);return c.getTimeInMillis();}
    private Set<Integer> all(){return new HashSet<>(Arrays.asList(0,1,2,3,4,5,6));}
    @Test public void choosesTodayBeforeTimeAndTomorrowAfterTime(){TimeZone z=TimeZone.getTimeZone("Europe/Paris");long target=at(z,2026,11,5,19,0);assertEquals(target,DailySchedule.next(at(z,2026,11,5,18,0),19,0,all(),z));assertEquals(at(z,2026,11,6,19,0),DailySchedule.next(target,19,0,all(),z));}
    @Test public void respectsChosenWeekdays(){TimeZone z=TimeZone.getTimeZone("UTC");assertEquals(at(z,2026,11,9,19,30),DailySchedule.next(at(z,2026,11,6,20,0),19,30,new HashSet<>(Arrays.asList(1,2,3,4,5)),z));}
    @Test public void daylightSavingPreservesLocalHour(){TimeZone z=TimeZone.getTimeZone("Europe/Paris");long saturday=DailySchedule.next(at(z,2026,3,28,18,0),19,0,all(),z);long sunday=DailySchedule.next(saturday+1,19,0,all(),z);assertEquals(23*60*60*1000L,sunday-saturday);long autumn=DailySchedule.next(at(z,2026,10,24,18,0),19,0,all(),z);assertEquals(25*60*60*1000L,DailySchedule.next(autumn+1,19,0,all(),z)-autumn);}
    @Test public void usesProvidedTimeZone(){TimeZone paris=TimeZone.getTimeZone("Europe/Paris"),newYork=TimeZone.getTimeZone("America/New_York");long now=at(paris,2026,11,5,12,0);assertNotEquals(DailySchedule.next(now,19,0,all(),paris),DailySchedule.next(now,19,0,all(),newYork));}
    @Test(expected=IllegalArgumentException.class) public void refusesEmptyDays(){DailySchedule.next(0,19,0,Collections.emptySet(),TimeZone.getTimeZone("UTC"));}
}
