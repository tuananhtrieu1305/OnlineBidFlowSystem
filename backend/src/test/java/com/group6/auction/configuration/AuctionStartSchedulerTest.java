package com.group6.auction.configuration;

import com.group6.auction.auction.lifecycle.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.mockito.Mockito.*;

class AuctionStartSchedulerTest {
 @Test void usesUtcRegardlessOfClockZone(){
  var service=mock(AuctionStartService.class);
  var clock=Clock.fixed(Instant.parse("2030-01-01T01:02:03Z"),ZoneId.of("Asia/Ho_Chi_Minh"));
  new AuctionStartScheduler(service,clock).tick();
  verify(service).startDue(LocalDateTime.of(2030,1,1,1,2,3));
 }
}
