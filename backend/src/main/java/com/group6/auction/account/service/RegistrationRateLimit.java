package com.group6.auction.account.service;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Bounded, single-server limiter. Never trusts client-supplied forwarding headers. */
@Component
public class RegistrationRateLimit {
    private record Window(long start, int count) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final int attempts;
    private final Clock clock;
    @Autowired
    public RegistrationRateLimit(@Value("${app.registration.attempts-per-minute:5}") int attempts) {
        this(attempts, Clock.systemUTC());
    }
    RegistrationRateLimit(int attempts, Clock clock) {
        this.attempts = attempts;
        this.clock = clock;
    }
    public synchronized boolean allow(String address) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> now - entry.getValue().start() >= 60_000);
        Window current = windows.get(address);
        if (current == null) {
            if (windows.size() >= 10_000) return false;
            windows.put(address, new Window(now, 1));
            return true;
        }
        if (current.count() >= attempts) return false;
        windows.put(address, new Window(current.start(), current.count() + 1));
        return true;
    }
}
