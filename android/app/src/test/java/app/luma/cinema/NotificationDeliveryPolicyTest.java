package app.luma.cinema;
import org.junit.Test;
import static org.junit.Assert.*;
public class NotificationDeliveryPolicyTest {
    @Test public void acceptsDueDeliveryAndSmallDelay(){assertTrue(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,10000,0,10000));assertTrue(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,10000,0,13000));}
    @Test public void rejectsDisabledOldGenerationAndReplacedTarget(){assertFalse(NotificationDeliveryPolicy.shouldDeliver(false,7,7,10000,10000,0,10000));assertFalse(NotificationDeliveryPolicy.shouldDeliver(true,6,7,10000,10000,0,10000));assertFalse(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,20000,0,10000));}
    @Test public void rejectsDuplicatesAndEarlyOrObsoleteAlarms(){assertFalse(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,10000,10000,10001));assertFalse(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,10000,0,5000));assertFalse(NotificationDeliveryPolicy.shouldDeliver(true,7,7,10000,10000,0,10000+7*60*60*1000L));}
}
