package com.group6.auction.realtime.room;

import java.time.LocalDateTime;

public record AuctionSnapshotBid(long bidId, long auctionId, long userId, long amount, LocalDateTime createdAt) {
}
