package com.group6.auction.realtime.protocol;

public record NormalPriceUpdatedPayload(long auctionId, long currentPrice, long nextMinimumBid, Long leadingUserId) {
}
