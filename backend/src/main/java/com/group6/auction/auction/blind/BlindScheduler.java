package com.group6.auction.auction.blind;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("!probe")
@ConditionalOnProperty(name="app.auctions.auto-start",havingValue="true",matchIfMissing=true)
public class BlindScheduler {
    private static final Logger log=LoggerFactory.getLogger(BlindScheduler.class);
    private final JdbcTemplate jdbc;
    private final BlindService service;
    private final Clock clock;
    public BlindScheduler(JdbcTemplate jdbc,BlindService service,Clock clock){this.jdbc=jdbc;this.service=service;this.clock=clock;}

    @Scheduled(fixedDelayString="${app.auctions.blind-poll-ms:1000}")
    public void tick(){
        var time=LocalDateTime.ofInstant(clock.instant(),ZoneOffset.UTC);
        var candidates=jdbc.queryForList("SELECT id FROM auctions WHERE auction_type='BLIND' AND status='UPCOMING' AND start_time<=? ORDER BY id LIMIT 100",Long.class,time);
        for(long id:candidates)try{service.startIfReady(id);service.expireUnfilled(id);}catch(RuntimeException ex){log.error("BLIND start failed for auction {}",id,ex);}
        var due=jdbc.queryForList("SELECT a.id FROM auctions a JOIN blind_rounds r ON r.auction_id=a.id WHERE a.auction_type='BLIND' AND a.status='RUNNING' AND a.end_time<=? ORDER BY a.id LIMIT 100",Long.class,time);
        for(long id:due)try{service.finishIfDue(id);}catch(RuntimeException ex){log.error("BLIND settlement failed for auction {}",id,ex);}
    }
}
