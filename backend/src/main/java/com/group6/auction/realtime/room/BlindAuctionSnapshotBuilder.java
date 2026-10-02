package com.group6.auction.realtime.room;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import org.springframework.stereotype.Component;

@Component
public class BlindAuctionSnapshotBuilder {
    public BlindAuctionSnapshot build(
            AuctionSnapshotAuction auction,
            List<AuctionSnapshotBid> bids,
            List<AuctionSnapshotHistoricalResult> historicalResults,
            List<ChatMessageSnapshot> chatHistory,
            long userId
    ) {
        var ownBid = bids.stream()
                .filter(bid -> bid.userId() == userId)
                .max(Comparator.comparing(AuctionSnapshotBid::createdAt));

        return new BlindAuctionSnapshot(
                auction.auctionId(),
                auction.auctionType(),
                auction.status(),
                auction.accessType(),
                auction.product(),
                ownBid.map(OwnBidSnapshot::from).orElse(null),
                AuctionHistoricalStats.fromResults(historicalResults),
                remainingSeconds(auction.endTime()),
                chatHistory
        );
    }

    private long remainingSeconds(LocalDateTime endTime) {
        return Math.max(0, Duration.between(LocalDateTime.now(java.time.ZoneOffset.UTC), endTime).getSeconds());
    }
}
