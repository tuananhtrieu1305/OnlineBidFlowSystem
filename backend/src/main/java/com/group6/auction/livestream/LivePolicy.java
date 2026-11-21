package com.group6.auction.livestream;

import java.time.Duration;
import java.time.Instant;

public final class LivePolicy {
    public static final Duration BID_WINDOW = Duration.ofSeconds(5);
    public static final Duration HOST_LEASE = Duration.ofSeconds(3);
    public static final Duration PAUSE_WINDOW = Duration.ofMinutes(5);
    private LivePolicy() {}

    public static long amount(String value) {
        try {
            if (value == null || !value.matches("[1-9][0-9]{0,18}")) throw new NumberFormatException();
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new LiveException(400, "INVALID_AMOUNT", "Nhập số Coin nguyên dương hợp lệ.");
        }
    }
    public static void validateBid(long floor, Long previous, long amount, Instant deadline, Instant now) {
        if (deadline != null && !now.isBefore(deadline)) throw LiveException.conflict("Lượt đấu đã hết giờ.");
        if (amount < floor || previous != null && amount <= previous) throw LiveException.conflict("Giá mới phải cao hơn giá hiện tại.");
    }
    public static Long remaining(Instant deadline, Instant pausedAt) {
        return deadline == null ? null : Math.max(0, Duration.between(pausedAt, deadline).toMillis());
    }
}
