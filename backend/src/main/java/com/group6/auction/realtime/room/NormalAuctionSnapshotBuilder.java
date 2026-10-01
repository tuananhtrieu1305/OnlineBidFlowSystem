package com.group6.auction.realtime.room;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import com.group6.auction.realtime.chat.ChatMessageSnapshot;
import org.springframework.stereotype.Component;

@Component
public class NormalAuctionSnapshotBuilder {
    public NormalAuctionSnapshot build(
            AuctionSnapshotAuction auction,
            List<AuctionSnapshotBid> bids,
            List<ChatMessageSnapshot> chatHistory
    ) {
        var leader = bids.stream()
                .max(Comparator.comparingLong(AuctionSnapshotBid::amount)
                        .thenComparing(AuctionSnapshotBid::createdAt, Comparator.reverseOrder()));
        var currentPrice = leader.map(AuctionSnapshotBid::amount).orElse(auction.startingPrice());

        return new NormalAuctionSnapshot(
                auction.auctionId(),
                auction.auctionType(),
                auction.status(),
                auction.accessType(),
                auction.product(),
                auction.startingPrice(),
                currentPrice,
                bids.stream().map(PublicBidSnapshot::from).toList(),
                leader.map(CurrentLeaderSnapshot::from).orElse(null),
                remainingSeconds(auction.endTime()),
                chatHistory
        );
    }

    private long remainingSeconds(LocalDateTime endTime) {
        return Math.max(0, Duration.between(LocalDateTime.now(), endTime).getSeconds());
    }
}
