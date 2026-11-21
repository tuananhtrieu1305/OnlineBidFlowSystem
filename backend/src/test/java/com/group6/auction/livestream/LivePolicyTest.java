package com.group6.auction.livestream;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

class LivePolicyTest {
    private final Instant now = Instant.parse("2026-11-18T00:00:00Z");
    @Test void acceptsAnyHigherIntegerButRejectsTiesAndTheExactDeadline() {
        assertThatCode(() -> LivePolicy.validateBid(100, 117L, 118, now.plusSeconds(5), now)).doesNotThrowAnyException();
        assertThatThrownBy(() -> LivePolicy.validateBid(100, 117L, 117, now.plusSeconds(5), now)).isInstanceOf(LiveException.class);
        assertThatThrownBy(() -> LivePolicy.validateBid(100, null, 100, now, now)).isInstanceOf(LiveException.class);
        assertThat(LivePolicy.remaining(now.plusMillis(1234), now)).isEqualTo(1234);
        assertThat(LivePolicy.remaining(null, now)).isNull();
    }
    @Test void rejectsNonCanonicalOrOverflowAmounts() {
        for (String amount : new String[]{"0","-1","1.5","1e3"," 100","01","9223372036854775808"}) {
            assertThatThrownBy(() -> LivePolicy.amount(amount)).isInstanceOf(LiveException.class);
        }
        assertThat(LivePolicy.amount("9223372036854775807")).isEqualTo(Long.MAX_VALUE);
    }
}
