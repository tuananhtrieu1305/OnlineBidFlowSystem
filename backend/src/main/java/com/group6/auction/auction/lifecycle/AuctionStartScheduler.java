package com.group6.auction.auction.lifecycle;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import java.time.*;

@Configuration
@Profile("!probe")
@EnableScheduling
@ConditionalOnProperty(name="app.auctions.auto-start",havingValue="true",matchIfMissing=true)
public class AuctionStartScheduler {
 private final AuctionStartService service;
 private final Clock clock;
 public AuctionStartScheduler(AuctionStartService service,Clock clock){this.service=service;this.clock=clock;}
 @Scheduled(fixedDelayString="${app.auctions.start-poll-ms:1000}")
 public void tick(){service.startDue(LocalDateTime.ofInstant(clock.instant(),ZoneOffset.UTC));}
}
