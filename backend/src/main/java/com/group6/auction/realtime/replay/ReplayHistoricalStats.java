package com.group6.auction.realtime.replay;

import java.util.Collection;

import com.group6.auction.auction.entity.AuctionStatus;

public record ReplayHistoricalStats(
        long soldCount,
        Long averageWinningPrice,
        Long minimumWinningPrice,
        Long maximumWinningPrice
) {
    public static ReplayHistoricalStats fromResults(Collection<ReplayHistoricalResult> results) {
        var soldPrices = results.stream()
                .filter(result -> result.status() == AuctionStatus.SOLD)
                .map(ReplayHistoricalResult::winningPrice)
                .filter(price -> price != null)
                .toList();
        if (soldPrices.isEmpty()) {
            return new ReplayHistoricalStats(0, null, null, null);
        }
        var average = Math.round(soldPrices.stream().mapToLong(Long::longValue).average().orElse(0));
        var minimum = soldPrices.stream().mapToLong(Long::longValue).min().orElseThrow();
        var maximum = soldPrices.stream().mapToLong(Long::longValue).max().orElseThrow();
        return new ReplayHistoricalStats(soldPrices.size(), average, minimum, maximum);
    }
}
