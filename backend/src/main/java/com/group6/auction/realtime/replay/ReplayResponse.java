package com.group6.auction.realtime.replay;

import java.util.List;

import com.group6.auction.realtime.room.ProductSnapshot;

public record ReplayResponse(
        long auctionId,
        String auctionType,
        String status,
        String viewerRole,
        ProductSnapshot product,
        ReplayResultSnapshot result,
        ReplayHistoricalStats historicalStats,
        List<ReplayTimelineEvent> events
) {
}
