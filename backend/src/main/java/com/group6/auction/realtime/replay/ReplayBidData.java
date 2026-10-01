package com.group6.auction.realtime.replay;

import java.time.LocalDateTime;

public record ReplayBidData(long bidId, long auctionId, long userId, long amount, LocalDateTime createdAt) {
}
