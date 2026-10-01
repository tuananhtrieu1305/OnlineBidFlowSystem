package com.group6.auction.realtime.room;

public record CurrentLeaderSnapshot(long userId, long amount) {
    public static CurrentLeaderSnapshot from(AuctionSnapshotBid bid) {
        return new CurrentLeaderSnapshot(bid.userId(), bid.amount());
    }
}
