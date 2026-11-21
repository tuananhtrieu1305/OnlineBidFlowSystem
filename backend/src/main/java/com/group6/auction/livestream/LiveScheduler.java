package com.group6.auction.livestream;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.jdbc.core.JdbcTemplate;
@Component @Profile("!probe")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="app.livestream.scheduling-enabled",havingValue="true",matchIfMissing=true)
public class LiveScheduler {
    private final JdbcTemplate db;private final LiveService service;
    private final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(getClass());
    public LiveScheduler(JdbcTemplate db,LiveService service){this.db=db;this.service=service;}
    @EventListener(ApplicationReadyEvent.class) public void recover(){run(true);}
    @Scheduled(fixedDelay=100) public void tick(){run(false);}
    private void run(boolean restart){for(long id:db.queryForList("SELECT id FROM livestream_sessions WHERE status IN ('LIVE','PAUSED')",Long.class))try{service.tick(id,restart);}catch(Exception ex){log.error("Livestream {} settlement/recovery will retry",id,ex);}}
}
