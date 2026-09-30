package com.group6.auction.account.service;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RegistrationRateLimitTest {
    @Test void limitsAttemptsPerAddressAndExpiresOldWindows() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(0L);
        var limiter = new RegistrationRateLimit(2, clock);
        assertThat(limiter.allow("a")).isTrue();
        assertThat(limiter.allow("a")).isTrue();
        assertThat(limiter.allow("a")).isFalse();
        assertThat(limiter.allow("b")).isTrue();
        when(clock.millis()).thenReturn(60_000L);
        assertThat(limiter.allow("a")).isTrue();
    }
}
