package com.group6.auction.auction.normal;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("!probe")
@ConditionalOnProperty(prefix = "app.normal", name = {"enabled", "scheduler-enabled"}, havingValue = "true", matchIfMissing = true)
public class NormalLifecycle {
    private static final Logger log = LoggerFactory.getLogger(NormalLifecycle.class);
    private final NormalRepository repository;
    private final NormalService service;
    private final Clock clock;
    public NormalLifecycle(NormalRepository repository, NormalService service, Clock clock) {
        this.repository = repository; this.service = service; this.clock = clock;
    }
    @Scheduled(fixedDelayString = "${app.normal.scheduler-delay-ms:1000}")
    public void advanceDueAuctions() {
        for (long id : repository.due(clock.instant())) {
            try { service.advance(id); }
            catch (RuntimeException error) { log.error("Cannot advance NORMAL auction {}; will retry", id, error); }
        }
    }
}
