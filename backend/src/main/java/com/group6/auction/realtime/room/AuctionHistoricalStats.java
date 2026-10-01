package com.group6.auction.realtime.room;

import java.util.Collection;
import java.util.LongSummaryStatistics;

import com.group6.auction.auction.entity.AuctionStatus;

public record AuctionHistoricalStats(long soldCount, Long averageWinningPrice, Long minimumWinningPrice, Long maximumWinningPrice) {
    public static AuctionHistoricalStats fromResults(Collection<AuctionSnapshotHistoricalResult> results) {
        var stats = results.stream()
                .filter(result -> result.status() == AuctionStatus.SOLD)
                .map(AuctionSnapshotHistoricalResult::winningPrice)
                .filter(price -> price != null && price > 0)
                .mapToLong(Long::longValue)
                .summaryStatistics();

        if (stats.getCount() == 0) {
            return new AuctionHistoricalStats(0, null, null, null);
        }
        return fromSummary(stats);
    }

    private static AuctionHistoricalStats fromSummary(LongSummaryStatistics stats) {
        return new AuctionHistoricalStats(
                stats.getCount(),
                Math.round(stats.getAverage()),
                stats.getMin(),
                stats.getMax()
        );
    }
}
