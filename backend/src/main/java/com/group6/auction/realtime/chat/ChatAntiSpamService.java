package com.group6.auction.realtime.chat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

@Service
public class ChatAntiSpamService {
    private static final Duration DEFAULT_COOLDOWN = Duration.ofSeconds(2);

    private final Clock clock;
    private final Duration cooldown;
    private final ConcurrentMap<String, Instant> lastMessageAt = new ConcurrentHashMap<>();

    public ChatAntiSpamService() {
        this(Clock.systemUTC(), DEFAULT_COOLDOWN);
    }

    public ChatAntiSpamService(Clock clock, Duration cooldown) {
        this.clock = clock;
        this.cooldown = cooldown;
    }

    public boolean tryAcquire(long auctionId, long userId) {
        var now = clock.instant();
        var key = auctionId + ":" + userId;
        var accepted = new boolean[] {false};

        lastMessageAt.compute(key, (ignored, previous) -> {
            if (previous == null || !now.isBefore(previous.plus(cooldown))) {
                accepted[0] = true;
                return now;
            }
            return previous;
        });

        return accepted[0];
    }
}
