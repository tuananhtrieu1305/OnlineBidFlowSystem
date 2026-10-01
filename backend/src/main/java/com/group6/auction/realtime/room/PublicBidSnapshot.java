package com.group6.auction.realtime.room;

public record PublicBidSnapshot(long bidId, long userId, long amount, String createdAt) {
    public static PublicBidSnapshot from(AuctionSnapshotBid bid) {
        return new PublicBidSnapshot(bid.bidId(), bid.userId(), bid.amount(), bid.createdAt().toString());
    }
}
