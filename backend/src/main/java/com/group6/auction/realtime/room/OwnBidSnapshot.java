package com.group6.auction.realtime.room;

public record OwnBidSnapshot(long amount, String createdAt) {
    public static OwnBidSnapshot from(AuctionSnapshotBid bid) {
        return new OwnBidSnapshot(bid.amount(), bid.createdAt().toString());
    }
}
